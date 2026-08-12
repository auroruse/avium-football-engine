// HOW FAR AHEAD DOES A CARRIER HAVE TO SEE THE LINE?
//
// He turns at dribTurn / (1 + v * dribTurnV) radians a slice, which at carry pace is 0.17 -- a right
// angle takes nine slices and thirteen metres of travel. The carry search looks carryLook = 6 m
// ahead. He therefore cannot physically avoid a line he only notices six metres out, whatever the
// price on it, and 5.0 balls a match go out under somebody's feet.
//
// Value and pressure belong at carryLook: that is where he is taking it. The out-of-play terms
// belong further out, because that is where the consequence is. This sweeps how much further.
//
//   node test/outsweep.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);
const CELLS = [];
for (const edge of [0, 3, 4.5, 6, 8]) CELLS.push({ edge });

function play([cell, seed]) {
  CFG.dribEdge = cell.edge;   // 0 disables the clamp entirely
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let carried = 0, outs = 0;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, hadIdx = mp.idx, wasSp = !!mp.sp;
    meTick(s, rng, out);
    if (!wasSp && mp.sp && mp.sp.kind !== "kickoff" && mp.sp.kind !== "freekick" && mp.sp.kind !== "penalty") {
      outs++; if (hadIdx >= 0) carried++;
    }
  }
  const pt = (out.poss.home + out.poss.away) || 1;
  const sh = out.shots.home + out.shots.away, gl = out.goals.home + out.goals.away;
  return { carried, outs, carries: out.carries, shots: sh / 2, conv: sh ? gl / sh : 0, goals: gl / 2,
           comp: out.passes ? out.passOk / out.passes : 0, inplay: out.inplay / (ME_MATCH_TICKS + meAdded(s)) };
}

const jobs = [];
for (const c of CELLS) for (let i = 1; i <= N; i++) jobs.push([c, i]);
const res = await parMap(jobs, play);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
console.log(`\n${N} matches a cell. dribEdge is how far along his own dribble line the carrier is`);
console.log(`held to the pitch, clamped ${CFG.dribEdgeM} m inside. Real conversion is 10-12%.\n`);
console.log(`  dribEdge   carried out   all balls out   shots   goals   conv%   pass%   in play`);
console.log(`  --------   -----------   -------------   -----   -----   -----   -----   -------`);
for (let ci = 0; ci < CELLS.length; ci++) {
  const r = res.slice(ci * N, ci * N + N).filter(Boolean);
  const m = (k) => r.reduce((a, x) => a + x[k], 0) / r.length;
  const c = CELLS[ci];
  console.log(`  ${(c.edge || "off").toString().padStart(8)}   ${f1(m("carried")).padStart(11)}   ` +
    `${f1(m("outs")).padStart(13)}   ${f1(m("shots")).padStart(5)}   ${f2(m("goals")).padStart(5)}   ` +
    `${f1(100 * m("conv")).padStart(5)}   ${f1(100 * m("comp")).padStart(5)}   ${f1(100 * m("inplay")).padStart(6)}%`);
}
console.log(`\n  Carries and shots are the guard rail: a carrier who will not go near a line is not`);
console.log(`  playing football either, so the cell that kills the out-balls without killing the`);
console.log(`  carry is the one to take.`);
