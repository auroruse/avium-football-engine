// ONE JOB OF A NATIONAL SIDE'S TACTICS SEARCH: a (style, formation) cell played over the fixtures
// k in [k0, k0+n). Opponent, venue and seed are functions of k alone, so every cell plays the same
// matches (paired) and a later round that continues from a cell's last k never replays one.
//
//   node test/nt-job.mjs <CODE> <style> <formation> <k0> <n>       -> one JSON line on stdout
//
// The side is built the way the app builds it when you change its style -- {...STRAT_DEF,
// ...STYLE_PRESET[style]}, the three editables at zero -- and its XI re-slotted into the
// formation through refitLineup. The field is every international side within 15 OVR (at least
// the 16 nearest), the opposition it would actually meet, both ways round.
import { PRESET_CATALOG, STRAT_DEF, STYLE_PRESET, refitLineup, runPositionalMatch } from "./engine.mjs";

const [CODE, style, formation, k0S, nS] = process.argv.slice(2);
const K0 = +k0S, N = +nS;
const intl = PRESET_CATALOG.filter(t => t.league === "Avium International");
const base = intl.find(t => t.code === CODE);
if (!base) { console.error("no such side", CODE); process.exit(2); }
const self = Number(base.skill), gap = (t) => Math.abs(Number(t.skill) - self);
let field = intl.filter(t => t.code !== CODE && gap(t) <= 15);
if (field.length < 16) field = intl.filter(t => t.code !== CODE).sort((a, b) => gap(a) - gap(b)).slice(0, 16);
const F = field.length;

const T = { ...base, style, formation,
  strategy: { ...STRAT_DEF, ...(STYLE_PRESET[style] || {}) },
  squad: formation === base.formation ? base.squad : refitLineup(base.squad, formation) };
let pts = 0, w = 0, d = 0, gf = 0, ga = 0;
for (let k = K0; k < K0 + N; k++) {
  const opp = field[k % F], home = Math.floor(k / F) % 2 === 0;
  const r = runPositionalMatch(home ? T : opp, home ? opp : T, 90e5 + (k * 131 + 7) * 7919, null, false).out;
  const f = home ? r.goals.home : r.goals.away, a = home ? r.goals.away : r.goals.home;
  if (f > a) { pts += 3; w++; } else if (f === a) { pts += 1; d++; }
  gf += f; ga += a;
}
console.log(JSON.stringify({ code: CODE, style, formation, k0: K0, n: N, F, pts, w, d, gf, ga }));
