// CHECK THE CLUB WORLD CUP AGAINST THE LEAGUE AND THE CUP (13 October 2026), off the written files alone: every year
// from 1900 to 1931 Nichirin's entrants are the league's places less one plus the cup winner, or the league's places
// themselves when the cup winner was already in them; and Spartak and Dynamo hold at most half of the 41 league titles
// and half of the 41 cups.
//
//   node test/hist/cwccheck.mjs <data.json> [pstats dir]
import { readFileSync, readdirSync } from "node:fs";
const [df, dir = "public/avium/pstats/"] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8"));
const ent = (n) => (n === "343 Kōkūtai" ? "Dai-Ichi Sen'ninhara" : n);
const table = (f) => readFileSync(f, "utf8").split("## Final Table").pop().split("\n").map(l => l.split("|").map(x => x.trim()))
  .filter(p => p.length > 4 && /^\d+$/.test(p[1])).map(p => ent(p[2].replace(/\*/g, "").trim()));
const cupWin = (f) => ent(readFileSync(f, "utf8").split("### Final").pop().match(/\*\*([^*]+)\*\*/)[1].trim());
const all = Object.keys(D.clubs);
const entrants = (y) => { const txt = readFileSync(`${dir}cwc/${y}.md`, "utf8");
  return all.filter(c => new RegExp(`(^|[^\\p{L}])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(txt)); };
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const bad = [], rows = [];
for (const f of readdirSync(dir + "cwc").filter(f => /^\d{4}\.md$/.test(f))) {
  const y = +f.slice(0, 4); if (y > 1931) continue;
  const E = entrants(y), k = E.length, t = table(`${dir}nl1/${y}.md`), w = cupWin(`${dir}stsc/${y}.md`);
  const top = t.slice(0, k - 1), want = top.includes(w) ? t.slice(0, k) : [...top, w];
  rows.push(`${y}: ${E.map(c => c.split(" ")[0]).join(", ")}  <- league ${top.map(c => c.split(" ")[0]).join(", ")} + cup ${w.split(" ")[0]}${top.includes(w) ? " (already in, next: " + t[k - 1].split(" ")[0] + ")" : ""}`);
  if (!same(E, want)) bad.push(`${y}: entrants ${E.join(", ")} but league + cup give ${want.join(", ")}`);
}
const SD = ["Spartak Kanagawa", "Dynamo Mizuhara"];
const n1 = readdirSync(dir + "nl1").filter(f => /^\d{4}\.md$/.test(f)).map(f => table(dir + "nl1/" + f)[0]);
const cups = readdirSync(dir + "stsc").filter(f => /^\d{4}\.md$/.test(f)).map(f => cupWin(dir + "stsc/" + f));
const sdL = n1.filter(c => SD.includes(c)).length, sdC = cups.filter(c => SD.includes(c)).length;
console.log(rows.join("\n"));
console.log(`Spartak+Dynamo: league ${sdL} of ${n1.length}, cup ${sdC} of ${cups.length}`);
if (sdL * 2 > n1.length) bad.push("league cap broken"); if (sdC * 2 > cups.length) bad.push("cup cap broken");
console.log(bad.length ? "PROBLEMS:\n" + bad.join("\n") : "every Club World Cup from 1900 to 1931 follows the league and the cup");
process.exit(bad.length ? 1 : 0);
