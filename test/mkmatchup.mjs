// THE MANAGERS' TABLES, written from a matchup run (test/specs/matchup.mjs: arms "style|opponent", one direction of
// each pairing): src/engine/matchup.ts (ME_MATCHUP, the xG difference a match) and, in src/engine/manager.ts,
// ME_STYLE_ADJ (the three styles that play most like each one) and ME_STYLE_ATTACK (the xG a match each creates over
// Balanced). The style ids come from the lab bundle, so rebuild it first (zsh test/rebuild.sh).
//
//   node test/mkmatchup.mjs <run.jsonl | a folder of lab-*.jsonl> "<where it came from, for the comment>"
import { readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENG = resolve(HERE, "../src/engine");
const E = await import(resolve(HERE, "engine.mjs"));
const [src, label] = process.argv.slice(2);
if (!src || !label) { console.error('usage: node test/mkmatchup.mjs <run.jsonl | folder> "<source>"'); process.exit(2); }

const files = statSync(src).isDirectory() ? readdirSync(src).filter(f => f.endsWith(".jsonl")).map(f => join(src, f)) : [src];
const OLD = Object.fromEntries(Object.entries(E.ME_STYLE_DEF).map(([reg, id]) => [id, reg]));   // brain-2 id -> registry id
const ROWS = Object.keys(E.ME_STYLE_DEF);
const cells = {}, by = {};
const put = (a, o, d) => ((cells[a] ??= {})[o] ??= []).push(d);
for (const f of files) for (const l of readFileSync(f, "utf8").split("\n")) {
  if (!l.trim()) continue;
  const r = JSON.parse(l), [a, o] = r.arm.split("|").map(id => OLD[id]);
  if (!a || !o) throw new Error("not a matchup record: " + r.arm);
  const d = r.S.xgf - r.S.xga;
  put(a, o, d); if (a !== o) put(o, a, -d);
  (by[a] ??= []).push(r.S); if (a !== o) (by[o] ??= []).push(r.O);
}
const miss = ROWS.flatMap(a => ROWS.filter(o => !cells[a]?.[o]?.length).map(o => a + "|" + o));
if (miss.length) throw new Error("cells with no matches: " + miss.slice(0, 6).join(", "));

const mean = (v) => v.reduce((t, x) => t + x, 0) / v.length;
const sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / Math.max(1, v.length - 1)); };
const M = Object.fromEntries(ROWS.map(a => [a, Object.fromEntries(ROWS.map(o => [o, a === o ? 0 : Math.round(mean(cells[a][o]) * 100) / 100]))]));
const off = ROWS.flatMap(a => ROWS.filter(o => o !== a).map(o => cells[a][o]));
const med = (v) => [...v].sort((x, y) => x - y)[v.length >> 1];
const nCell = med(off.map(v => v.length)), seCell = med(off.map(v => sd(v) / Math.sqrt(v.length)));
const f2 = (v) => (v < 0 ? "-" : "") + Math.abs(v).toFixed(2);

// How each style plays, averaged over every opponent: what "plays most like it" is measured on.
const KEYS = ["poss", "terr", "tilt", "pass", "cmp", "plen", "pfwd", "phigh", "k_cross", "k_thru", "carry", "drib", "sh", "shd", "fast",
              "hdr", "reg", "regD", "regH", "regCP", "ppda", "line", "blen", "dwid", "awid", "ahead", "run", "tkTry", "fouls"];
const vec = (s) => [...KEYS.map(k => s[k]), s.k_long + s.k_sw + s.k_over];
const all = Object.values(by).flat().map(vec), K = all[0].length;
const mu = [...Array(K)].map((_, i) => mean(all.map(v => v[i])));
const sg = [...Array(K)].map((_, i) => Math.sqrt(mean(all.map(v => (v[i] - mu[i]) ** 2))) || 1);
const z = Object.fromEntries(ROWS.map(a => { const vs = by[a].map(vec); return [a, mu.map((m, i) => (mean(vs.map(v => v[i])) - m) / sg[i])]; }));
const dist = (a, b) => Math.hypot(...z[a].map((x, i) => x - z[b][i]));
const ADJ = Object.fromEntries(ROWS.map(a => [a, ROWS.filter(b => b !== a).sort((x, y) => dist(a, x) - dist(a, y)).slice(0, 3)]));
const xgf = Object.fromEntries(ROWS.map(a => [a, mean(by[a].map(s => s.xgf))]));
const ATT = ROWS.map(a => [a, Math.round((xgf[a] - xgf.balanced) * 100) / 100]).sort((x, y) => y[1] - x[1]);

const swap = (path, text) => { writeFileSync(path + ".tmp", text); renameSync(path + ".tmp", path); };
swap(join(ENG, "matchup.ts"),
`// WHAT EACH STYLE IS WORTH AGAINST EACH OTHER: xG difference a match for the row style against the column style,
// level squads, each paying its style's price (config ME_MIND_PRICE), the twenty League One clubs. Measured by
// test/specs/matchup.mjs (${label}), written by test/mkmatchup.mjs, read by the managers (manager.ts).
// One direction per pairing, the other being the same matches seen from the other side, so each row is the negative
// of its column. About ${nCell} matches a cell, so a cell is good to about ${seCell.toFixed(2)} either way.
export const ME_MATCHUP = {
${ROWS.map(a => `  ${a}: { ${ROWS.map(o => `${o}: ${f2(M[a][o])}`).join(", ")} },`).join("\n")}
};
`);
const MGR = join(ENG, "manager.ts");
let mgr = readFileSync(MGR, "utf8");
const put1 = (re, text) => { const n = (mgr.match(re) || []).length; if (n !== 1) throw new Error(`${re}: ${n} matches in manager.ts`); mgr = mgr.replace(re, text); };
put1(/export const ME_STYLE_ADJ = \{[\s\S]*?\n\};/g,
  `export const ME_STYLE_ADJ = {\n${ROWS.map(a => `  ${a}: [${ADJ[a].map(b => `"${b}"`).join(", ")}],`).join("\n")}\n};`);
const attLines = []; for (let i = 0; i < ATT.length; i += 6) attLines.push("  " + ATT.slice(i, i + 6).map(([a, v]) => `${a}: ${f2(v)}`).join(", ") + ",");
put1(/export const ME_STYLE_ATTACK = \{[\s\S]*?\n\};/g, `export const ME_STYLE_ATTACK = {\n${attLines.join("\n")}\n};`);
swap(MGR, mgr);

console.log(`${files.length} files; ${nCell} matches a cell, cell SE ${seCell.toFixed(3)}`);
console.log("".padEnd(14) + ROWS.map(o => o.slice(0, 6).padStart(7)).join("") + "    mean");
for (const a of ROWS) console.log(a.padEnd(14) + ROWS.map(o => (M[a][o] >= 0 ? "+" : "") + M[a][o].toFixed(2)).map(s => s.padStart(7)).join("") + "  " + (mean(ROWS.map(o => M[a][o])) >= 0 ? "+" : "") + mean(ROWS.map(o => M[a][o])).toFixed(2));
console.log("neighbours:", ROWS.map(a => `${a} -> ${ADJ[a].join("/")}`).join("; "));
console.log("attack over Balanced:", ATT.map(([a, v]) => `${a} ${f2(v)}`).join(", "));
const pairs = ROWS.flatMap((a, i) => ROWS.slice(i + 1).map(b => [dist(a, b), a, b])).sort((x, y) => x[0] - y[0]);
console.log("closest pairs:", pairs.slice(0, 6).map(([d, a, b]) => `${a}~${b} ${d.toFixed(2)}`).join(", "));
