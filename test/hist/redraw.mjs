// REDRAW THE NL1 SEASONS THE CLUB WORLD CUP CANNOT FOLLOW (13 October 2026). Each year's Nichirian entrants qualified by
// the league's places less one plus the cup winner (a cup winner already in those places passing its place down the
// table), so the clubs in those places must all be entrants. Where the season as drawn says otherwise, it is put together
// again from the same engine results (each fixture's K results) until they are, its foot unchanged; then, across all 37
// re-simmed seasons, Spartak and Dynamo keep to at most 18 titles.
//
//   node test/hist/redraw.mjs <data.json> <plan.json> <real.json> <out.json> <results.jsonl>...
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const E = await import("../engine.mjs");
const [df, pf, rf, out, ...rfs] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), plan = JSON.parse(readFileSync(pf, "utf8")), real = JSON.parse(readFileSync(rf, "utf8"));
const TB = ["gd", "gf", "h2h", "wins"], V = 40, TRIES = 4000000, CAP = 18;
let seed = 20261014;
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// The Club World Cup's Nichirian entrants, a year at a time, off its reports.
const all = new Set(Object.keys(D.clubs));
function entrantsOf(y) {
  let txt; try { txt = readFileSync(`public/avium/pstats/cwc/${y}.md`, "utf8"); } catch { return null; }
  return [...all].filter(c => new RegExp(`(^|[^\\p{L}])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(txt));
}
const res = new Map();
for (const f of rfs) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.trim()) continue;
  const r = JSON.parse(l); if (r.err != null) continue;
  const [y, c, h, a] = r.id.split("|"); if (c !== "nl1") continue;
  if (!res.has(y)) res.set(y, new Map());
  const m = res.get(y), fx = h + "|" + a; if (!m.has(fx)) m.set(fx, []); m.get(fx).push([r.hg, r.ag]); }
const fold = Object.fromEntries(Object.entries(D.clubs).map(([n, c]) => [n, c.fold ?? 9999]));
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const table = (clubs, picks) => E.recalcStandings({ teams: clubs.map(name => ({ name })),
  schedule: [picks.map(([h, a, hg, ag]) => ({ home: { name: h }, away: { name: a }, result: { ftHome: hg, ftAway: ag } }))] }, TB).map(s => s.name);

const fits = (t, E1, k) => t.slice(0, k - 1).every(c => E1.includes(c));
const redrawn = {}, report = [];
for (const s of plan.seasons) {
  const y = s.y, E1 = entrantsOf(y);
  if (!E1) continue;
  const k = E1.length, cur = real.seasons[y].nl1.table;
  if (fits(cur, E1, k)) continue;
  const foot = s.nl2?.length || y >= 1901 ? s.down : s.left;
  const clubs = s.nl1, idx = new Map(clubs.map((c, i) => [c, i])), m = res.get(String(y));
  const fx = []; for (const h of clubs) for (const a of clubs) if (h !== a) fx.push([h, a, m.get(h + "|" + a)]);
  const n = clubs.length, pts = new Float64Array(n), gd = new Float64Array(n), gf = new Float64Array(n), kept = [];
  let tries = 0;
  for (; tries < TRIES && kept.length < V; tries++) {
    pts.fill(0); gd.fill(0); gf.fill(0);
    const picks = fx.map(([h, a, o]) => { const [hg, ag] = o[Math.floor(rnd() * o.length)]; const i = idx.get(h), j = idx.get(a);
      gf[i] += hg; gf[j] += ag; gd[i] += hg - ag; gd[j] += ag - hg; if (hg > ag) pts[i] += 3; else if (hg < ag) pts[j] += 3; else { pts[i]++; pts[j]++; }
      return [h, a, hg, ag]; });
    // Quick screen on points alone (a tie at the edge goes to the app's own ranking).
    const q = [...clubs].sort((p, r) => pts[idx.get(r)] - pts[idx.get(p)] || gd[idx.get(r)] - gd[idx.get(p)] || gf[idx.get(r)] - gf[idx.get(p)]);
    const near = q.slice(0, k).filter(c => E1.includes(c)).length >= k - 1;
    const qa = q.filter(c => fold[c] !== y), footOk = !foot?.length || qa.slice(qa.length - foot.length - 1).filter(c => foot.includes(c)).length === foot.length;
    if (!near || !footOk) continue;
    const t = table(clubs, picks), ta = t.filter(c => fold[c] !== y);
    if (fits(t, E1, k) && (!foot?.length || same(ta.slice(ta.length - foot.length), foot))) kept.push({ picks, table: t });
  }
  report.push(`${y}: entrants ${E1.join(", ")}; ${kept.length} kept of ${tries}`);
  if (!kept.length) { console.error(`${y}: no season fits`); process.exit(2); }
  redrawn[y] = kept;
}
console.log(report.join("\n"));
// One kept season for each redrawn year; then the cap, swapping a redrawn year Spartak or Dynamo won for a version they did not.
const SD = new Set(["Spartak Kanagawa", "Dynamo Mizuhara"]);
for (const [y, ks] of Object.entries(redrawn)) { const p = ks[Math.floor(rnd() * ks.length)]; real.seasons[y].nl1 = { table: p.table, results: p.picks }; }
const sdCount = () => Object.entries(real.seasons).filter(([y, s]) => +y <= 1931 && s.nl1 && SD.has(s.nl1.table[0])).length;
let guard = 0;
while (sdCount() > CAP && guard++ < 1000) {
  const c = Object.entries(redrawn).filter(([y, ks]) => SD.has(real.seasons[y].nl1.table[0]) && ks.some(k => !SD.has(k.table[0])));
  if (!c.length) break;
  const [y, ks] = c[Math.floor(rnd() * c.length)], alt = ks.filter(k => !SD.has(k.table[0])), p = alt[Math.floor(rnd() * alt.length)];
  real.seasons[y].nl1 = { table: p.table, results: p.picks };
}
console.log(`redrawn ${Object.keys(redrawn).length} seasons; Spartak+Dynamo ${sdCount()} of 37 NL1 titles re-simmed (cap ${CAP})`);
if (sdCount() > CAP) { console.error("cap not met"); process.exit(3); }
writeFileSync(out, JSON.stringify({ ...real, sd: sdCount(), redrawn: Object.keys(redrawn).map(Number) }));
