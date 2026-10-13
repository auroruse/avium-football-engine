// PUT EACH ALEMANNIAN SEASON TOGETHER from the engine's results (13 October 2026). Every fixture was played K times; a
// season takes one of the K for each fixture, drawn at random, and is kept only if the right clubs finish where the plan
// needs them: the Club World Cup's entrants in the Oberliga's qualifying places (any order) and the plan's three at its
// foot; the plan's three at the top of the 2. Liga. The 2. Liga of 1933/34 needs nothing: nobody moved after it. A
// season's table is the app's own (recalcStandings, the league's tiebreakers). Then one kept season each, with Arminia
// Berelstein holding at most 12 of the 27 Oberliga titles re-simmed.
//
//   node test/hist/ale/real.mjs <data.json> <plan.json> <out.json> <results.jsonl>...
import { readFileSync, writeFileSync } from "node:fs";
const E = await import("../../engine.mjs");
const [df, pf, out, ...rfs] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), plan = JSON.parse(readFileSync(pf, "utf8"));
const TB = ["gd", "gf", "h2h", "wins"], V = 60, TRIES = 3000000, CAP = 12, ARM = "Arminia Berelstein";
let seed = 20261013;
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// Every result, by season and fixture: a fixture is the same two sides whichever league it was played in.
const res = new Map();
let errs = 0;
for (const f of rfs) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.trim()) continue;
  const r = JSON.parse(l); if (r.err != null) { errs++; console.error("error in " + r.id + ": " + r.err); continue; }
  const [y, , h, a] = r.id.split("|"), key = y, fx = h + "|" + a;
  if (!res.has(key)) res.set(key, new Map());
  const m = res.get(key); if (!m.has(fx)) m.set(fx, []); m.get(fx).push([r.hg, r.ag]); }

const table = (clubs, picks) => E.recalcStandings({ teams: clubs.map(name => ({ name })),
  schedule: [picks.map(([h, a, hg, ag]) => ({ home: { name: h }, away: { name: a }, result: { ftHome: hg, ftAway: ag } }))] }, TB).map(s => s.name);
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const inAll = (xs, ys) => xs.every(x => ys.includes(x));

function season(y, comp, clubs, ok, near) {
  const m = res.get(String(y));
  const fx = []; for (const h of clubs) for (const a of clubs) if (h !== a) { const o = m?.get(h + "|" + a); if (!o?.length) throw new Error(`missing ${y} ${comp} ${h} v ${a}`); fx.push([h, a, o]); }
  const idx = new Map(clubs.map((c, i) => [c, i])), n = clubs.length, kept = [];
  const pts = new Float64Array(n), gd = new Float64Array(n), gf = new Float64Array(n);
  let tries = 0;
  for (; tries < TRIES && kept.length < V; tries++) {
    pts.fill(0); gd.fill(0); gf.fill(0);
    const picks = fx.map(([h, a, o]) => { const [hg, ag] = o[Math.floor(rnd() * o.length)]; const i = idx.get(h), j = idx.get(a);
      gf[i] += hg; gf[j] += ag; gd[i] += hg - ag; gd[j] += ag - hg; if (hg > ag) pts[i] += 3; else if (hg < ag) pts[j] += 3; else { pts[i]++; pts[j]++; }
      return [h, a, hg, ag]; });
    // A quick order first (points, difference, goals); a season near passing on it is ranked the app's way.
    const quick = [...clubs].sort((p, q) => pts[idx.get(q)] - pts[idx.get(p)] || gd[idx.get(q)] - gd[idx.get(p)] || gf[idx.get(q)] - gf[idx.get(p)]);
    if (!near(quick)) continue;
    const t = table(clubs, picks);
    if (ok(t)) kept.push({ picks, table: t });
  }
  return { kept, tries };
}

const got = {}, report = [];
for (const s of plan.seasons) {
  const y = s.y, Ey = D.cwc[y] || [], k = Ey.length;
  const okA = (t) => (!k || same(t.slice(0, k), Ey)) && same(t.slice(t.length - 3), s.down);
  const nearA = (t) => (!k || inAll(Ey, t.slice(0, k + 1))) && inAll(s.down, t.slice(t.length - 4));
  const a = season(y, "ao", s.ao, okA, nearA);
  const okB = (t) => same(t.slice(0, 3), s.up), nearB = (t) => inAll(s.up, t.slice(0, 4));
  const b = season(y, "l2", s.l2, okB, nearB);
  report.push(`${y}: Oberliga ${a.kept.length} kept of ${a.tries}, 2. Liga ${b.kept.length} of ${b.tries}`);
  got[y] = { ao: a.kept, l2: b.kept };
}
{ const h = plan.held, b = season(h.y, "l2", h.l2, () => true, () => true); report.push(`${h.y}: 2. Liga ${b.kept.length} kept of ${b.tries}`); got[h.y] = { l2: b.kept }; }
console.log(report.join("\n"));
const missing = Object.entries(got).filter(([, v]) => (v.ao && !v.ao.length) || !v.l2.length).map(([y]) => y);
if (missing.length) { console.error("no season kept for " + missing.join(", ")); process.exit(2); }

// One kept season each; then, while Arminia holds more than 12 titles, a season it won swaps to a kept version somebody
// else won.
const one = (xs) => xs[Math.floor(rnd() * xs.length)];
const pick = Object.fromEntries(Object.entries(got).map(([y, v]) => [y, { ao: v.ao ? one(v.ao) : null, l2: one(v.l2) }]));
const armCount = () => Object.values(pick).filter(p => p.ao && p.ao.table[0] === ARM).length;
let guard = 0;
while (armCount() > CAP && guard++ < 1000) {
  const cands = Object.entries(pick).filter(([y, p]) => p.ao && p.ao.table[0] === ARM && got[y].ao.some(k => k.table[0] !== ARM));
  if (!cands.length) break;
  const [y] = one(cands);
  pick[y].ao = one(got[y].ao.filter(k => k.table[0] !== ARM));
}
const arm = armCount();
console.log(`Arminia Berelstein: ${arm} of ${plan.seasons.length} Oberliga titles re-simmed (cap ${CAP}); ${errs} match errors`);
if (arm > CAP) { console.error("cap not met"); process.exit(3); }
writeFileSync(out, JSON.stringify({ arm, seasons: Object.fromEntries(Object.entries(pick).map(([y, p]) => [y, {
  ao: p.ao ? { table: p.ao.table, results: p.ao.picks } : null, l2: { table: p.l2.table, results: p.l2.picks } }])) }));
