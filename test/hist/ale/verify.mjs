// CHECK THE WRITTEN ALEMANNIAN HISTORY (13 October 2026) off the files alone: every club in being plays in one league or
// the other each season, and none before its founding; each summer the Oberliga's last three go down and the 2. Liga's
// first three come up, a club founded into the Oberliga as the record has it; the chain lands on the Oberliga of
// 1933/34 and the 2. Liga of 1934/35, nobody moving between them; every year the Club World Cup's Alemannian entrants
// finished in the qualifying places; and Arminia Berelstein holds at most 14 of the 29 Oberliga titles.
//
//   node test/hist/ale/verify.mjs <data.json> [pstats dir]
import { readFileSync } from "node:fs";
const [df, dir = "public/avium/pstats/"] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8"));
const final = (f) => readFileSync(f, "utf8").split("## Final Table").pop().split("\n## ")[0].split("\n").map(l => l.split("|").map(x => x.trim()))
  .filter(p => p.length > 4 && /^\d+$/.test(p[1])).map(p => p[2].replace(/\*/g, "").trim());
const ys = D.seasons, all = Object.keys(D.clubs), bad = [];
const t1 = {}, t2 = {};
for (const y of [...ys, 1934, 1935]) { t1[y] = final(`${dir}ao/${y}.md`); t2[y] = final(`${dir}2ao/${y}.md`); }
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const nextY = (y) => (y === ys[ys.length - 1] ? 1934 : ys[ys.indexOf(y) + 1]);
for (const y of [...ys, 1934, 1935]) {
  const here = all.filter(c => D.clubs[c].start <= y), both = [...t1[y], ...t2[y]];
  if (both.length !== new Set(both).size) bad.push(`${y}: a club plays in both leagues`);
  if (!same(both, here)) bad.push(`${y}: the two leagues are not every club in being (${here.filter(c => !both.includes(c)).join(", ")} missing; ${both.filter(c => !here.includes(c)).join(", ")} not yet founded)`);
  if (y <= 1934 && t1[y].length !== D.size[y]) bad.push(`${y}: the Oberliga has ${t1[y].length} clubs, not ${D.size[y]}`);
}
for (const y of ys) {
  const ny = nextY(y), down = t1[y].slice(-3), up = t2[y].slice(0, 3);
  const into = all.filter(c => D.clubs[c].start === ny && D.ao[ny]?.some(r => r.club === c));
  const want1 = [...t1[y].slice(0, -3), ...up, ...into];
  if (!same(t1[ny], want1)) bad.push(`${y}: the Oberliga for ${ny} is not this one less its last three plus the 2. Liga's first three${into.length ? " and " + into.join(", ") : ""}`);
  const E = D.cwc[y] || [];
  if (E.length && !same(t1[y].slice(0, E.length), E)) bad.push(`${y}: the Club World Cup's entrants ${E.join(", ")} but the top ${E.length} are ${t1[y].slice(0, E.length).join(", ")}`);
}
if (!same(t1[1934], D.target.ao)) bad.push("the Oberliga of 1933/34 is not the record's");
if (!same(t2[1934], D.target.l2) || !same(t2[1935], D.target.l2)) bad.push("the 2. Liga of 1933/34 is not 1934/35's eighteen");
if (!same(t1[1935], t1[1934])) bad.push("the Oberliga changed between 1933/34 and 1934/35");
const titles = [...ys, 1934, 1935].map(y => t1[y][0]), arm = titles.filter(c => c === "Arminia Berelstein").length;
const tally = {}; for (const c of titles) tally[c] = (tally[c] || 0) + 1;
console.log(`Oberliga titles 1899/1900-1934/35: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + " " + n).join(", ")}`);
if (arm > 14) bad.push(`Arminia Berelstein holds ${arm} of 29 titles, more than 14`);
console.log(bad.length ? "PROBLEMS:\n" + bad.join("\n") : "every summer follows the rules and the Club World Cup; lands on 1933/34 and 1934/35");
process.exit(bad.length ? 1 : 0);
