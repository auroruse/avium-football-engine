// WRITE THE RE-SIMMED SEASONS (13 October 2026) as the app's own season reports (buildSeasonMd: a round at a time, the
// table after each, the final table), NL1 over its old table-only files and NL2 as new files, then NL2's winners.
//
//   node test/hist/write.mjs <data.json> <real.json>
import { readFileSync, writeFileSync } from "node:fs";
import { hash } from "./model.mjs";
const E = await import("../engine.mjs");
const [df, rf] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), real = JSON.parse(readFileSync(rf, "utf8"));
const P = "public/avium/pstats/";
const shown = (c, y) => (c === "Dai-Ichi Sen'ninhara" && y <= 1892 ? "343 Kōkūtai" : c);

// A double round robin by the circle method, in an order drawn for the season: every pair once in each half, the second
// half's venues the first's swapped.
function rounds(clubs, y, comp) {
  const arr = [...clubs].sort((a, b) => hash("order", y, comp, a) - hash("order", y, comp, b)), n = arr.length, first = [];
  for (let r = 0; r < n - 1; r++) {
    const rd = [];
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; rd.push((r + i) % 2 === 0 ? [a, b] : [b, a]); }
    first.push(rd);
    arr.splice(1, 0, arr.pop());
  }
  return [...first, ...first.map(rd => rd.map(([h, a]) => [a, h]))];
}
function md(y, comp, s, title) {
  const clubs = s.table, score = new Map(s.results.map(([h, a, hg, ag]) => [h + "|" + a, [hg, ag]]));
  const sched = rounds(clubs, y, comp).map(rd => rd.map(([h, a]) => { const [hg, ag] = score.get(h + "|" + a);
    return { home: { name: shown(h, y) }, away: { name: shown(a, y) }, result: { ftHome: hg, ftAway: ag } }; }));
  return E.buildSeasonMd({ title, groups: [{ teams: clubs.map(c => ({ name: shown(c, y) })), schedule: sched }], tiebreakers: ["gd", "gf", "h2h", "wins"] });
}
const won = {};
let n1 = 0, n2 = 0;
for (const [ys, s] of Object.entries(real.seasons)) {
  const y = +ys;
  if (s.nl1) { writeFileSync(`${P}nl1/${y}.md`, md(y, "nl1", s.nl1, `Nichirin League One ${y} — Season Report`)); n1++; }
  if (s.nl2) { writeFileSync(`${P}nl2/${y}.md`, md(y, "nl2", s.nl2, `Nichirin League Two ${y} — Season Report`)); n2++; won[y] = shown(s.nl2.table[0], y); }
}
const rows = readFileSync(`${P}nl2/winners.tsv`, "utf8").trim().split("\n");
const keepRows = rows.slice(1).filter(l => !(+l.split("\t")[0] in won));
const all = [...keepRows, ...Object.entries(won).map(([y, w]) => `${y}\t${w}`)].sort((a, b) => +a.split("\t")[0] - +b.split("\t")[0]);
writeFileSync(`${P}nl2/winners.tsv`, [rows[0], ...all].join("\n") + "\n");
console.log(`wrote ${n1} NL1 and ${n2} NL2 seasons; NL2 winners ${Object.keys(won).length}`);
