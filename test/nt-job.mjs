// ONE JOB OF A SIDE'S TACTICS SEARCH: a (style, formation) cell played over the fixtures k in
// [k0, k0+n). Opponent, venue and seed are functions of k alone, so every cell plays the same
// matches (paired) and a later round that continues from a cell's last k never replays one.
//
//   node test/nt-job.mjs <CODE> <style> <formation> <k0> <n> [league]  -> one JSON line on stdout
//
// The side is built the way the app builds it when you change its style: STRAT_DEF, then the
// row's own three editables, then every identity key overwritten by the style stamp. The
// editables are not part of the search -- they are stylistic and measure inert -- so a club keeps
// the character its sheet gives it and the national sides, whose three are zero, are unaffected.
// The XI is re-slotted into the formation through refitLineup rather than relabelled.
//
// The field is the opposition the side would actually meet: for a league, every other club in it;
// for the international pool, every side within 15 OVR (at least the 16 nearest). Both ways round.
import { PRESET_CATALOG, STRAT_DEF, STYLE_PRESET, IDENTITY_KEYS, refitAs, runPositionalMatch } from "./engine.mjs";

const [CODE, style, formation, k0S, nS, leagueS] = process.argv.slice(2);
const K0 = +k0S, N = +nS, LEAGUE = leagueS || "Avium International";
const intl = PRESET_CATALOG.filter(t => t.league === LEAGUE);
const base = intl.find(t => t.code === CODE);
if (!base) { console.error("no such side", CODE); process.exit(2); }
const self = Number(base.skill), gap = (t) => Math.abs(Number(t.skill) - self);
let field = intl.filter(t => t.code !== CODE);
if (LEAGUE === "Avium International") {
  field = field.filter(t => gap(t) <= 15);
  if (field.length < 16) field = intl.filter(t => t.code !== CODE).sort((a, b) => gap(a) - gap(b)).slice(0, 16);
}
const F = field.length;

const strategy = { ...STRAT_DEF, timeWasting: base.strategy.timeWasting, gkDist: base.strategy.gkDist, dlBehavior: base.strategy.dlBehavior };
for (const k of IDENTITY_KEYS) strategy[k] = STYLE_PRESET[style]?.[k] ?? 0;
const T = { ...base, style, formation, strategy,
  squad: formation === base.formation ? base.squad : refitAs(base.squad, formation) };
let pts = 0, w = 0, d = 0, gf = 0, ga = 0;
for (let k = K0; k < K0 + N; k++) {
  const opp = field[k % F], home = Math.floor(k / F) % 2 === 0;
  const r = runPositionalMatch(home ? T : opp, home ? opp : T, 90e5 + (k * 131 + 7) * 7919, null, false).out;
  const f = home ? r.goals.home : r.goals.away, a = home ? r.goals.away : r.goals.home;
  if (f > a) { pts += 3; w++; } else if (f === a) { pts += 1; d++; }
  gf += f; ga += a;
}
console.log(JSON.stringify({ code: CODE, style, formation, k0: K0, n: N, F, pts, w, d, gf, ga }));
