// THE AFA RANKING, A YEAR AT A TIME (src/data/afa.js). Moukden and Kirin, 24 October 2026: "Add AFA ranking history back
// to national teams, one per year", then "Actually use points for 1934 and 1935 rankings too": every year is ranked by
// results, an Elo table over every recorded World Cup, World Cup qualifying and Nations League match, every side
// starting 1932 on 1500. At each year's turn a side keeps two thirds of its distance from 1500 (KEEP), so one year's run
// counts less in the next ("Lead Fades Each Year"; taken out, then "put the fade back in", all the same day). A World Cup
// match counts most; the margin scales the swing; a shootout is a draw. The confederation championships are left out,
// matches and titles ("Don't use championships at all"). A year's
// matches are the ones played in it: its World Cup and Nations League, and the qualifying for the next World Cup, which
// is filed under that World Cup's year. Sides that no longer exist (Calveria, Slytlia, the Independent XIs) play in the
// table but are not ranked. A year is added when it closes: add its files to YEARS and write.
//
//   node test/afa.mjs           print every year
//   node test/afa.mjs write     write src/data/afa.js
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const teams = JSON.parse(readFileSync(join(ROOT, "src/data/teams.json"), "utf8"));
const avium = teams.filter(t => t.file === "AVIUM" && !t.removed);
const codeOf = new Map(avium.map(t => [t.name.trim(), t.code]));
codeOf.set("NB Islands", "ANB");
const byName = (a, b) => (avium.find(t => t.code === a[0])?.name || a[0]).localeCompare(avium.find(t => t.code === b[0])?.name || b[0]);
const rank = (rows) => rows.sort((a, b) => b[1] - a[1] || byName(a, b));

const KEEP = 2 / 3;
const K = { wc: 60, natl: 40, western: 40, eastern: 40 };
const YEARS = {
  1932: ["wc/1932", "natl/1932"],
  1933: ["wc/1933", "natl/1933"],
  1934: ["wc/1934", "natl/1934", "western/1935", "eastern/1935"],
  1935: ["wc/1935", "natl/1935"],
};
const elo = new Map(), played = new Set();
// A year's record a side (P, W, D, L, GF, GA, every leg a match, a shootout a draw) and the titles it won that year.
const NAMES = { wc: "World Cup", natl: "Nations League" };
let rec = new Map(), won = new Map();
const tally = (s, gf, ga) => { const r = rec.get(s) || [0, 0, 0, 0, 0, 0]; r[0]++; r[gf > ga ? 1 : gf === ga ? 2 : 3]++; r[4] += gf; r[5] += ga; rec.set(s, r); };
// Its winner: the Grand Final Reset's, else the Grand Final's, else the Final's, the side in bold.
function winnerOf(text) {
  for (const re of [/^#{2,3}\s+Grand Final Reset\s*$/i, /^#{2,3}\s+Grand Final\s*$/i, /^#{2,3}\s+Final\s*$/i]) {
    const L = text.replace(/\r/g, "").split("\n"), i = L.findIndex(x => re.test(x)); if (i < 0) continue;
    const row = L.slice(i + 1).find(x => / vs /.test(x)); const m = row && row.match(/\*\*([^*]+)\*\*/);
    if (m) return codeOf.get(m[1].trim()) || m[1].trim();
  }
  return null;
}
const score = /^(\d+)-(\d+)/;
function season(year) {
  let n = 0;
  for (const file of YEARS[year]) {
    const comp = file.split("/")[0];
    const text = readFileSync(join(ROOT, `public/avium/pstats/${file}.md`), "utf8");
    const w = NAMES[comp] && winnerOf(text); if (w) won.set(w, [...(won.get(w) || []), NAMES[comp]]);
    let head = [];
    for (const L of text.replace(/\r/g, "").split("\n")) {
      if (!L.startsWith("|")) { head = []; continue; }
      const c = L.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(x => x.trim());
      if (/^[-:\s|]+$/.test(L.replace(/\|/g, ""))) continue;
      const mi = c.findIndex(x => / vs /.test(x));
      if (mi < 0) { head = c.map(x => x.toLowerCase()); continue; }
      if (/\(bye\)/.test(c[mi])) continue;
      // A side is scored under its code, so a name written two ways ("NB Islands") is one side.
      const [ra, rb] = c[mi].split(" vs ").map(x => { x = x.replace(/\*/g, "").trim(); return codeOf.get(x) || x; });
      // Each leg its own match, read from the first-named side; an aggregate column is not a match.
      const cols = head.length ? head.map((h, i) => (/^(score|leg 1|leg 2)$/.test(h) ? i : -1)).filter(i => i >= 0) : [mi + 1];
      for (const i of cols) {
        const m = (c[i] || "").match(score); if (!m) continue;
        const ga = +m[1], gb = +m[2], ea = elo.get(ra) ?? 1500, eb = elo.get(rb) ?? 1500;
        const w = ga > gb ? 1 : ga < gb ? 0 : 0.5, exp = 1 / (1 + 10 ** ((eb - ea) / 400)), d = Math.abs(ga - gb);
        const g = d <= 1 ? 1 : d === 2 ? 1.5 : (11 + d) / 8, swing = K[comp] * g * (w - exp);
        elo.set(ra, ea + swing); elo.set(rb, eb - swing); played.add(ra); played.add(rb); tally(ra, ga, gb); tally(rb, gb, ga); n++;
      }
    }
  }
  return n;
}
const results = {}, detail = {};
for (const y of Object.keys(YEARS).map(Number)) {
  if (y > 1932) for (const [s, v] of elo) elo.set(s, 1500 + KEEP * (v - 1500));
  const n = season(y);
  const live = new Set(avium.map(t => t.code));
  const unknown = [...played].filter(x => !live.has(x) && !/^Independent XI|^Calveria$|^Slytlia$/.test(x));
  if (unknown.length) throw new Error(`${y}: sides with no record: ${unknown.join(", ")}`);
  results[y] = rank([...played].filter(x => live.has(x)).map(x => [x, Math.round(elo.get(x))]));
  detail[y] = Object.fromEntries(results[y].map(([c]) => [c, [...(rec.get(c) || [0, 0, 0, 0, 0, 0]), ...(won.get(c) ? [won.get(c)] : [])]]));
  rec = new Map(); won = new Map();
  console.error(`${y}: ${n} matches, ${results[y].length} sides ranked`);
}
const years = results;
for (const [y, list] of Object.entries(years)) console.log(y, list.slice(0, 10).map(([c, v]) => `${c} ${v}`).join(", "), `... (${list.length})`);

if (process.argv[2] === "write") {
  const fmt = (list) => list.map(([c, v]) => `["${c}", ${v}]`).reduce((rows, x, i) => { if (i % 8 === 0) rows.push([]); rows[rows.length - 1].push(x); return rows; }, [])
    .map(r => "    " + r.join(", ")).join(",\n");
  const out = `// THE AFA RANKING, A YEAR AT A TIME, written by test/afa.mjs (read it for the method): every Avium national side that
// has played, ranked by its points at the year's close, strongest first, ties by name. Points are an Elo table over every
// recorded World Cup, qualifying and Nations League match from 1932, a third of each side's lead fading at every year's
// turn (Moukden and Kirin, 24 October 2026). A year is added when it closes.
// The share of its distance from 1500 a side keeps at each year's turn.
export const AFA_KEEP = ${KEEP};
export const AFA_RANKINGS = {
${Object.entries(years).map(([y, list]) => `  ${y}: [\n${fmt(list)}]`).join(",\n")},
};
// A side's year (the AFA Rankings page): P, W, D, L, GF, GA in international matches that year, and the titles it won.
export const AFA_YEARS = {
${Object.entries(detail).map(([y, d]) => `  ${y}: {\n${Object.entries(d).map(([c, r]) => `    ${c}: ${JSON.stringify(r)}`).reduce((rows, x, i) => { if (i % 4 === 0) rows.push([]); rows[rows.length - 1].push(x); return rows; }, []).map(r => r.join(", ")).join(",\n")} }`).join(",\n")},
};
`;
  writeFileSync(join(ROOT, "src/data/afa.js"), out);
  console.error("wrote src/data/afa.js");
}
