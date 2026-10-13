// WRITE THE RE-SIMMED ALEMANNIAN SEASONS (13 October 2026) as the app's own season reports (buildSeasonMd: a round at a
// time, the table after each, the final table): the Oberliga over its old table-only files, the 2. Liga as new files.
//
//   node test/hist/ale/write.mjs <real.json>          (HIST_OUT=<dir>/ writes elsewhere, for a look first)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { hash } from "../model.mjs";
const E = await import("../../engine.mjs");
const [rf] = process.argv.slice(2);
const real = JSON.parse(readFileSync(rf, "utf8"));
const P = process.env.HIST_OUT || "public/avium/pstats/";

// A double round robin by the circle method, in an order drawn for the season: every pair once in each half, the second
// half's venues the first's swapped.
function rounds(clubs, y, comp) {
  const arr = [...clubs].sort((a, b) => hash("order", y, comp, a) - hash("order", y, comp, b)), n = arr.length, first = [];
  if (n % 2) arr.push(null);
  const m = arr.length;
  for (let r = 0; r < m - 1; r++) {
    const rd = [];
    for (let i = 0; i < m / 2; i++) { const a = arr[i], b = arr[m - 1 - i]; if (a && b) rd.push((r + i) % 2 === 0 ? [a, b] : [b, a]); }
    first.push(rd);
    arr.splice(1, 0, arr.pop());
  }
  return [...first, ...first.map(rd => rd.map(([h, a]) => [a, h]))];
}
function md(y, comp, s, title) {
  const clubs = s.table, score = new Map(s.results.map(([h, a, hg, ag]) => [h + "|" + a, [hg, ag]]));
  const sched = rounds(clubs, y, comp).map(rd => rd.map(([h, a]) => { const [hg, ag] = score.get(h + "|" + a);
    return { home: { name: h }, away: { name: a }, result: { ftHome: hg, ftAway: ag } }; }));
  if (sched.flat().length !== s.results.length) throw new Error(`${y} ${comp}: ${sched.flat().length} fixtures scheduled, ${s.results.length} played`);
  return E.buildSeasonMd({ title, groups: [{ teams: clubs.map(c => ({ name: c })), schedule: sched }], tiebreakers: ["gd", "gf", "h2h", "wins"] });
}
mkdirSync(P + "ao", { recursive: true }); mkdirSync(P + "2ao", { recursive: true });
let n1 = 0, n2 = 0;
for (const [ys, s] of Object.entries(real.seasons)) {
  const y = +ys;
  if (s.ao) { writeFileSync(`${P}ao/${y}.md`, md(y, "ao", s.ao, `Alemannische Oberliga ${y} — Season Report`)); n1++; }
  if (s.l2) { writeFileSync(`${P}2ao/${y}.md`, md(y, "l2", s.l2, `2. Alemannische Oberliga ${y} — Season Report`)); n2++; }
}
console.log(`wrote ${n1} Oberliga and ${n2} 2. Liga seasons to ${P}`);
