// Cutting the match to hit the numbers: what actually lands and what does not.
// Totals scale with ticks. RATES do not -- conversion is goals per shot and does not care how long
// the game is. Truncating slightly understates events (restart lengths scale with ME_SIM_MIN, so a
// real ME_SIM_MIN change would shorten them too), so the event columns here are a floor.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF } = eng;
const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 16), FULL = 18;
function cell(mins) {
  const ticks = Math.round(ME_MATCH_TICKS * mins / FULL);
  let sh = 0, g = 0, co = 0, fo = 0, pa = 0, sv = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ticks; k++) meTick(s, rng, out);
    sh += out.shots.home + out.shots.away; g += out.goals.home + out.goals.away;
    co += out.corners.home + out.corners.away; fo += out.fouls.home + out.fouls.away;
    pa += out.passes; sv += out.saves.home + out.saves.away;
  }
  const n = N * 2;
  return { sh: sh / n, g: g / n, conv: 100 * g / (sh || 1), co: co / n, fo: fo / n, pa: pa / N / 2 };
}
const MINS = [18, 12, 9, 6, 5];
const res = await parMap(MINS, cell);
if (!res) process.exit(0);
const f2 = (x) => x.toFixed(2);
console.log(`\n${N} matches per row. Per side per match.\n`);
console.log(`  watch    goals   shots   conversion   passes   corners   fouls`);
MINS.forEach((m, i) => { const r = res[i];
  console.log(`  ${String(m).padStart(2)} min   ${f2(r.g).padStart(5)}   ${f2(r.sh).padStart(5)}   ` +
    `${r.conv.toFixed(1).padStart(9)}%   ${f2(r.pa).padStart(6)}   ${f2(r.co).padStart(7)}   ${f2(r.fo).padStart(5)}`); });
console.log(`\n  real     1.40   12-13        8-14%    ~450      ~5.0    ~11.0`);
