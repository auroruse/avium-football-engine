// WHAT A MAN IS WORTH OUT OF POSITION (Moukden and Kirin, 11 October 2026), as the app shows it: POS_DROP in
// src/data/positions.js, rewritten by this script between its markers.
//
// Out of position the engine plays a man on his own position's skills, each no better than the slot's
// (src/engine/attributes.ts meAttrs). What that costs him is the skills his own position lacks for this place, each
// worth what it is worth to a man in the place's line. WEIGHTS is that worth, in rating points a skill point: how
// much a side's results move when its men in a line gain a point of one skill, over how much they move when the same
// men gain a point of rating. It is measured by test/specs/positions.mjs (every match gives each line of one side a
// random push up or down in every skill and in rating, and a regression reads each one's worth off the results).
//
//   node test/posdrop.mjs            prints the table
//   node test/posdrop.mjs write      writes it into src/data/positions.js
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "posdrop-")), ENTRY = join(DIR, "e.js"), OUT = join(DIR, "o.mjs");
writeFileSync(ENTRY, `export * from ${JSON.stringify(join(ROOT, "src/engine/attributes.ts"))};\nexport * from ${JSON.stringify(join(ROOT, "src/engine/formations.ts"))};\n`
  + `export { CFG } from ${JSON.stringify(join(ROOT, "src/engine/config.ts"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const E = await import(pathToFileURL(OUT).href);

// Rating points a skill point, by the line a man plays in. MEASURED: see the header. (Until a measurement lands, the
// figures are reasoned: a defender's tackling and reading of the game, a midfielder's passing and touch, a forward's
// finishing and pace, adding up to the share of a rating point that skills carry rather than judgement.)
export const WEIGHTS = {
  DEF: { pace: 0.18, pass: 0.09, shoot: 0.04, tackle: 0.33, position: 0.29, strength: 0.12, air: 0.08, touch: 0.05 },
  MID: { pace: 0.12, pass: 0.32, shoot: 0.19, tackle: 0.14, position: 0.12, strength: 0.06, air: 0.03, touch: 0.20 },
  FWD: { pace: 0.21, pass: 0.12, shoot: 0.37, tackle: 0.05, position: 0.07, strength: 0.09, air: 0.09, touch: 0.16 },
};
export const WEIGHTS_SOURCE = "reasoned";

const lineOf = (f) => { const d = f.split("-").map(Number), g = ["GK"];
  for (let i = 0; i < d[0]; i++) g.push("DEF");
  for (let k = 1; k < d.length - 1; k++) for (let i = 0; i < d[k]; i++) g.push("MID");
  for (let i = 0; i < d[d.length - 1]; i++) g.push("FWD");
  return g; };
// How often each position plays in each line, over every shape.
const share = {};
for (const f of E.FORMATIONS) { const s = E.sposFor(f), g = lineOf(f);
  s.forEach((p, i) => { const e = (share[p] ||= {}); e[g[i]] = (e[g[i]] || 0) + 1; }); }
for (const p in share) { const n = Object.values(share[p]).reduce((a, b) => a + b, 0); for (const g in share[p]) share[p][g] /= n; }

// A man's skills on a profile, at a rating of 70 (the engine's midpoint, where no skill touches its floor or ceiling).
const skills = (prof) => { const t = prof.tilt, aw = Math.min(1, Math.max(0, prof.atkW / 40)) - 0.45, o = 70;
  return { pace: o + t.pace, pass: o + t.pass, shoot: o + t.shoot + aw * E.CFG.shootAtkW, tackle: o + t.tackle - aw * 12,
           position: o + t.position, strength: o + t.strength, air: o + t.strength, touch: o + t.touch }; };
const POS = ["GK", "LB", "CB", "RB", "LWB", "RWB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"];
export function dropTable() {
  const T = {};
  for (const own of POS) {
    if (own === "GK") continue;
    const row = {};
    for (const place of POS) {
      if (place === "GK" || place === own) continue;
      const a = skills(E.ME_OWN[place]), b = skills(E.ME_OWN[own]);
      let d = 0;
      for (const [g, fr] of Object.entries(share[place])) {
        if (!WEIGHTS[g]) continue;
        for (const k in WEIGHTS[g]) d += fr * WEIGHTS[g][k] * Math.max(0, a[k] - b[k]);
      }
      row[place] = Math.round(d);
    }
    T[own] = row;
  }
  return T;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const T = dropTable();
  const cols = POS.filter(p => p !== "GK");
  console.log("own\\place " + cols.map(c => c.padStart(4)).join(""));
  for (const o of cols) console.log(o.padEnd(10) + cols.map(c => (o === c ? "  ." : String(T[o][c]))).map(v => v.padStart(4)).join(""));
  if (process.argv[2] === "write") {
    const f = join(ROOT, "src/data/positions.js"), src = readFileSync(f, "utf8");
    const body = "export const POS_DROP = {\n" + cols.map(o => `  ${o}: ${JSON.stringify(T[o]).replace(/"/g, "").replace(/,/g, ", ").replace(/:/g, ": ")},`).join("\n") + "\n};";
    const a = src.indexOf("// POS_DROP BEGIN"), b = src.indexOf("// POS_DROP END");
    if (a < 0 || b < 0) throw new Error("markers missing in positions.js");
    const out = src.slice(0, a) + `// POS_DROP BEGIN (test/posdrop.mjs write, weights ${WEIGHTS_SOURCE})\n` + body + "\n" + src.slice(b);
    writeFileSync(f, out);
    console.log("written to src/data/positions.js");
  }
}
