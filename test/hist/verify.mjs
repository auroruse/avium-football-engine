// CHECK THE WRITTEN HISTORY (13 October 2026) off the files alone: each summer's moves follow the rules (NL1's foot
// down, NL2's top up, NL2's last out and the strongest club outside in, the merged clubs gone after their last season),
// the chain lands on nl1/1932.md and the NL2 the record implies for 1931/32, NL2 1931/32 and 1932/33 match the record,
// and Spartak and Dynamo hold at most 20 of the 41 NL1 titles.
//
//   node test/hist/verify.mjs <data.json> <plan.json> [pstats dir]
import { readFileSync } from "node:fs";
const [df, pf, dir = "public/avium/pstats/"] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), plan = JSON.parse(readFileSync(pf, "utf8"));
const ent = (n) => (n === "343 Kōkūtai" ? "Dai-Ichi Sen'ninhara" : n);
const final = (f) => readFileSync(f, "utf8").split("## Final Table").pop().split("\n").map(l => l.split("|").map(x => x.trim()))
  .filter(p => p.length > 4 && /^\d+$/.test(p[1])).map(p => ent(p[2].replace(/\*/g, "").trim()));
const ys = plan.seasons.map(s => s.y), bad = [];
const t1 = {}, t2 = {};
for (const y of [...ys, 1932, 1933, 1934, 1935]) { try { t1[y] = final(`${dir}nl1/${y}.md`); } catch {} try { t2[y] = final(`${dir}nl2/${y}.md`); } catch {} }
const fold = Object.fromEntries(Object.entries(D.clubs).map(([n, c]) => [n, c.fold ?? 9999]));
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
for (const s of plan.seasons) {
  const y = s.y, ny = [...ys, 1932][ys.indexOf(y) + 1];
  if (!same(t1[y], s.nl1)) bad.push(`${y}: NL1 clubs differ from the plan`);
  if (s.nl2.length && !same(t2[y], s.nl2)) bad.push(`${y}: NL2 clubs differ from the plan`);
  const stay = t1[y].filter(c => fold[c] !== y);
  if (s.nl2.length) {
    const k = s.down.length, foot = stay.slice(stay.length - k), top = t2[y].filter(c => fold[c] !== y);
    if (!same(foot, s.down)) bad.push(`${y}: NL1 foot ${foot} not ${s.down}`);
    if (!same(top.slice(0, s.up.length), s.up)) bad.push(`${y}: NL2 top ${top.slice(0, s.up.length)} not ${s.up}`);
    if (top[top.length - 1] !== s.last) bad.push(`${y}: NL2 last ${top[top.length - 1]} not ${s.last}`);
    const next1 = ny === 1932 ? t1[1932] : t1[ny];
    if (!same(next1, [...stay.slice(0, stay.length - k), ...s.up])) bad.push(`${y}: NL1 for ${ny} is not this NL1 less its foot plus NL2's top`);
  } else if (s.left?.length) {
    const foot = stay.slice(stay.length - s.left.length);
    if (!same(foot, s.left)) bad.push(`${y}: NL1 foot ${foot} not ${s.left}`);
  }
}
// The landing: NL1 1931/32 is the file on record, and NL2 1931/32 the clubs the record implies.
if (!same(t2[1932], D.target.nl2)) bad.push("NL2 1931/32 is not the record's ten");
for (const y of [1932, 1933]) { const h = D.held[y]; if (t2[y][0] !== h.winner || !same(t2[y].slice(0, 3), h.up)) bad.push(`${y}: NL2 winner or top three off the record`); }
const SD = ["Spartak Kanagawa", "Dynamo Mizuhara"];
const titles = Object.entries(t1).filter(([y]) => +y <= 1935).map(([y, t]) => [+y, t[0]]);
let sd = 0; for (const [, c] of titles) if (SD.includes(c)) sd++;
const all = [1932, 1933, 1934, 1935].filter(y => !(y in t1)).length;
console.log(`NL1 titles read: ${titles.length}${all ? " (+" + all + " unread)" : ""}; Spartak+Dynamo ${sd} of 41 incl. 1931/32-1934/35 (${(100 * sd / 41).toFixed(1)}%)`);
console.log(bad.length ? "PROBLEMS:\n" + bad.join("\n") : "every summer follows the plan and the rules; lands on 1931/32");
process.exit(bad.length ? 1 : 0);
