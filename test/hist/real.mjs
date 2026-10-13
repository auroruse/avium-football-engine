// PUT EACH SEASON TOGETHER from the engine's results (13 October 2026). Every fixture was played K times; a season takes
// one of the K for each fixture, drawn at random, and is kept only if the right clubs finish where the plan needs them
// (NL1's foot, NL2's top three and last place; the record's winner and top three for NL2 in 1931/32 and 1932/33). A
// season's table is the app's own (recalcStandings, the league's tiebreakers). Then one kept season each, with
// Spartak and Dynamo holding at most 18 of the 37 NL1 titles re-simmed.
//
//   node test/hist/real.mjs <data.json> <plan.json> <out.json> <results.jsonl>...
import { readFileSync, writeFileSync } from "node:fs";
const E = await import("../engine.mjs");
const [df, pf, out, ...rfs] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), plan = JSON.parse(readFileSync(pf, "utf8"));
const TB = ["gd", "gf", "h2h", "wins"], V = 40, TRIES = 3000000, CAP = 18;
let seed = 20261013;
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// Every result, by season, competition and fixture.
const res = new Map();
for (const f of rfs) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.trim()) continue;
  const r = JSON.parse(l); if (r.err != null) { console.error("error in " + r.id + ": " + r.err); continue; }
  const [y, c, h, a] = r.id.split("|"), key = `${y}|${c}`, fx = h + "|" + a;
  if (!res.has(key)) res.set(key, new Map());
  const m = res.get(key); if (!m.has(fx)) m.set(fx, []); m.get(fx).push([r.hg, r.ag]); }

const fold = Object.fromEntries(Object.entries(D.clubs).map(([n, c]) => [n, c.fold ?? 9999]));
const table = (clubs, picks) => E.recalcStandings({ teams: clubs.map(name => ({ name })),
  schedule: [picks.map(([h, a, hg, ag]) => ({ home: { name: h }, away: { name: a }, result: { ftHome: hg, ftAway: ag } }))] }, TB).map(s => s.name);
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));

function season(y, comp, clubs, ok) {
  const m = res.get(`${y}|${comp}`);
  const fx = []; for (const h of clubs) for (const a of clubs) if (h !== a) { const o = m?.get(h + "|" + a); if (!o?.length) throw new Error(`missing ${y} ${comp} ${h} v ${a}`); fx.push([h, a, o]); }
  const idx = new Map(clubs.map((c, i) => [c, i])), n = clubs.length, kept = [];
  const pts = new Float64Array(n), gd = new Float64Array(n), gf = new Float64Array(n);
  let tries = 0;
  for (; tries < TRIES && kept.length < V; tries++) {
    pts.fill(0); gd.fill(0); gf.fill(0);
    const picks = fx.map(([h, a, o]) => { const [hg, ag] = o[Math.floor(rnd() * o.length)]; const i = idx.get(h), j = idx.get(a);
      gf[i] += hg; gf[j] += ag; gd[i] += hg - ag; gd[j] += ag - hg; if (hg > ag) pts[i] += 3; else if (hg < ag) pts[j] += 3; else { pts[i]++; pts[j]++; }
      return [h, a, hg, ag]; });
    // A quick order first (points, difference, goals); only a season that passes it is ranked the app's way.
    const quick = [...clubs].sort((p, q) => pts[idx.get(q)] - pts[idx.get(p)] || gd[idx.get(q)] - gd[idx.get(p)] || gf[idx.get(q)] - gf[idx.get(p)]);
    if (!ok(quick, true)) continue;
    const t = table(clubs, picks);
    if (ok(t, false)) kept.push({ picks, table: t });
  }
  return { kept, tries };
}

const out1 = {}, report = [];
const at = (t, y) => t.filter(c => fold[c] !== y);
for (const s of plan.seasons) {
  const y = s.y;
  // NL1: its foot, the clubs the plan has leaving.
  const foot = s.nl2?.length || s.y >= 1901 ? s.down : s.left;
  const ok1 = (t) => { const tt = at(t, y); return !foot?.length || same(tt.slice(tt.length - foot.length), foot); };
  const a = season(y, "nl1", s.nl1, (t, quick) => ok1(t) || (quick && near(t, foot, y)));
  report.push(`${y} NL1: ${a.kept.length} kept of ${a.tries}`);
  out1[y] = { nl1: a.kept };
  if (s.nl2?.length) {
    const ok2 = (t) => { const tt = at(t, y); return same(tt.slice(0, s.up.length), s.up) && tt[tt.length - 1] === s.last; };
    const b = season(y, "nl2", s.nl2, (t, quick) => ok2(t) || (quick && near2(t, s, y)));
    report.push(`${y} NL2: ${b.kept.length} kept of ${b.tries}`);
    out1[y].nl2 = b.kept;
  }
}
for (const y of [1932, 1933]) {
  const h = D.held[y];
  const ok = (t) => t[0] === h.winner && same(t.slice(0, 3), h.up);
  const b = season(y, "nl2", h.nl2, (t, quick) => ok(t) || (quick && t.slice(0, 4).filter(c => h.up.includes(c)).length >= 3));
  report.push(`${y} NL2 (held): ${b.kept.length} kept of ${b.tries}`);
  out1[y] = { nl2: b.kept };
}
// The quick order can split a tie the app's way would not, so a season close to passing is ranked properly too.
function near(t, foot, y) { if (!foot?.length) return true; const tt = at(t, y); return tt.slice(tt.length - foot.length - 1).filter(c => foot.includes(c)).length === foot.length; }
function near2(t, s, y) { const tt = at(t, y); return tt.slice(0, s.up.length + 1).filter(c => s.up.includes(c)).length === s.up.length && tt.slice(tt.length - 2).includes(s.last); }
console.log(report.join("\n"));

// One kept season each; then, while Spartak and Dynamo hold more than 18 titles, a season they won swaps to a kept
// version somebody else won.
const SD = new Set(["Spartak Kanagawa", "Dynamo Mizuhara"]);
const pick = {};
for (const [y, v] of Object.entries(out1)) pick[y] = { nl1: v.nl1 ? v.nl1[Math.floor(rnd() * v.nl1.length)] : null, nl2: v.nl2 ? v.nl2[Math.floor(rnd() * v.nl2.length)] : null };
const missing = Object.entries(out1).filter(([, v]) => (v.nl1 && !v.nl1.length) || (v.nl2 && !v.nl2.length)).map(([y]) => y);
if (missing.length) { console.error("no season kept for " + missing.join(", ")); process.exit(2); }
const sdCount = () => Object.entries(pick).filter(([y, p]) => +y <= 1931 && p.nl1 && SD.has(p.nl1.table[0])).length;
let guard = 0;
while (sdCount() > CAP && guard++ < 1000) {
  const cands = Object.entries(pick).filter(([y, p]) => +y <= 1931 && p.nl1 && SD.has(p.nl1.table[0]) && out1[y].nl1.some(k => !SD.has(k.table[0])));
  if (!cands.length) break;
  const [y] = cands[Math.floor(rnd() * cands.length)];
  const alt = out1[y].nl1.filter(k => !SD.has(k.table[0]));
  pick[y].nl1 = alt[Math.floor(rnd() * alt.length)];
}
const sd = sdCount();
console.log(`Spartak+Dynamo: ${sd} of ${plan.seasons.length} NL1 titles re-simmed (cap ${CAP})`);
if (sd > CAP) { console.error("cap not met"); process.exit(3); }
writeFileSync(out, JSON.stringify({ sd, seasons: Object.fromEntries(Object.entries(pick).map(([y, p]) => [y, {
  nl1: p.nl1 ? { table: p.nl1.table, results: p.nl1.picks } : null, nl2: p.nl2 ? { table: p.nl2.table, results: p.nl2.picks } : null }])) }));
