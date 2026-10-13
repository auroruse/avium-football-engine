// EACH SIDE'S STRENGTH AS THE ENGINE PLAYED IT (13 October 2026). A historical side is a club's rating that season plus
// the style and shape drawn for it, and the engine prices the style and shape too: in 1925 VfL Franmark and SpVgg
// Leinenfeld, both rated 75.1, averaged 49.9 and 33.7 points. The stand-in sees only the rating, so a plan made on it can
// ask the engine for a season it will almost never play. This fits each side's rating on the stand-in to what it
// actually took off its league's other sides over all K plays of every fixture, the league's mean held at its ratings'
// mean (the two leagues never meet, so that is the scale). The planner reads these instead (PLAN_EFF).
//
//   node test/hist/ale/eff.mjs <plan.json> <model.json> <out.json> <results.jsonl>...
import { readFileSync, writeFileSync } from "node:fs";
import { fitTable } from "../model.mjs";
const [pf, mf, out, ...rfs] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(pf, "utf8")), M = JSON.parse(readFileSync(mf, "utf8"));
const pts = new Map(), games = new Map();
const add = (k, p) => { pts.set(k, (pts.get(k) || 0) + p); games.set(k, (games.get(k) || 0) + 1); };
for (const f of rfs) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.trim()) continue;
  const r = JSON.parse(l); if (r.err != null) continue;
  const [y, c, h, a] = r.id.split("|");
  add(`${y}|${c}|${h}`, r.hg > r.ag ? 3 : r.hg === r.ag ? 1 : 0); add(`${y}|${c}|${a}`, r.ag > r.hg ? 3 : r.hg === r.ag ? 1 : 0); }
const eff = {}, spread = [];
const leagues = [...plan.seasons.flatMap(s => [[s.y, "ao", s.ao], [s.y, "l2", s.l2]]), [plan.held.y, "l2", plan.held.l2]];
for (const [y, c, clubs] of leagues) {
  const n = clubs.length, mean = clubs.reduce((a, x) => a + plan.ratings[x][y], 0) / n;
  const rows = clubs.map(x => { const k = `${y}|${c}|${x}`; if (!games.get(k)) throw new Error(`no results for ${k}`); return { club: x, Pts: pts.get(k) / games.get(k) * 2 * (n - 1) }; });
  const s = fitTable(M, rows, mean);
  clubs.forEach((x, i) => { (eff[x] ||= {})[y] = Math.round(s[i] * 10) / 10; spread.push(s[i] - plan.ratings[x][y]); });
}
writeFileSync(out, JSON.stringify(eff));
const sd = Math.sqrt(spread.reduce((a, d) => a + d * d, 0) / spread.length);
console.log(`${spread.length} sides; engine strength against rating: spread ${sd.toFixed(2)}, widest ${Math.min(...spread).toFixed(1)} to +${Math.max(...spread).toFixed(1)}`);
