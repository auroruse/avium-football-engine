// When a side loses the ball, how long before it is actually going the other way? The block line is
// blended by mp.bal, a slew-limited EMA, so the SHAPE lags the turnover even though `attacking`
// flips on the same slice. This measures the lag in slices.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther, meGoalX, meDir,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, CFG } = eng;
const squad = (o) => buildSquad("4-3-3", null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const W = 16;                                  // slices watched after a turnover
const N = +(process.env.N || 20);
function run(seed) {
  const s = createMatchState();
  const hs = squad(75), as = squad(75);
  s.players.home = hs.filter(p=>!p.bench); s.bench.home = hs.filter(p=>p.bench);
  s.players.away = as.filter(p=>!p.bench); s.bench.away = as.filter(p=>p.bench);
  s.formations = { home:"4-3-3", away:"4-3-3" };
  s.strategy = { home:{...STRAT_DEF}, away:{...STRAT_DEF} };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const adv = new Array(W).fill(0), balAt = new Array(W).fill(0);
  let n = 0, watch = null, prev = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    meTick(s, rng, out);
    const mp = s.mePos; if (mp.sp) { watch = null; continue; }
    const now = mp.idx >= 0 ? mp.side : null;
    if (now && prev && now !== prev) { watch = { lost: prev, k: 0, base: null }; n++; }
    prev = now || prev;
    if (!watch) continue;
    const L = watch.lost, own = meGoalX(meOther(L)), dir = meDir(L);
    // mean ADVANCEMENT of the losing side's outfielders, in their own attacking frame
    const of = s.players[L].filter(q => q.pos !== "GK");
    const mean = of.reduce((a, q) => a + (q.x - own) * dir, 0) / of.length;
    if (watch.base === null) watch.base = mean;
    if (watch.k < W) { adv[watch.k] += mean - watch.base; balAt[watch.k] += mp.bal[L]; watch.k++; }
    else watch = null;
  }
  return { adv, balAt, n };
}
const res = await parMap(Array.from({length:N},(_,i)=>i+1), run);
if (!res) process.exit(0);
const n = res.reduce((a,r)=>a+r.n,0);
console.log(`\n${n} turnovers across ${N} matches. Slice 0 is the one possession changed on.\n`);
console.log(`  slice   the losing side has moved   its mp.bal`);
for (let k = 0; k < W; k++) {
  const a = res.reduce((x,r)=>x+r.adv[k],0)/n, b = res.reduce((x,r)=>x+r.balAt[k],0)/n;
  const bar = a > 0 ? "+".repeat(Math.min(20, Math.round(a*8))) : "-".repeat(Math.min(20, Math.round(-a*8)));
  console.log(`   ${String(k).padStart(3)}   ${a >= 0 ? "+" : ""}${a.toFixed(2).padStart(6)} m  ${bar.padEnd(21)} ${b.toFixed(2).padStart(6)}`);
}
console.log(`\n  positive = still going FORWARD after losing it. possEmaAlpha ${CFG.possEmaAlpha}, possSlew ${CFG.possSlew}.`);
