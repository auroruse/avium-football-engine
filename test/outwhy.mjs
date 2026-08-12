// HE HAD IT WHEN IT WENT OUT. HOW LONG HAD HE HAD IT?
//
// Pricing the carry search's out-of-play terms harder, and reading them fourteen metres ahead
// instead of six, moved nothing: twelve cells all landed between 3.8 and 6.0 carried-out balls a
// match with no trend. So the direction he CHOSE is not what puts it out.
//
// mp.hold is how many slices he has had it. A sustained dribble is hold in the teens; a ball that
// has just arrived is hold of one or two, and at that point nothing he decided has happened yet --
// the first touch set the ball's line before the search ever ran. This splits the two, and reports
// how far the ball was in front of him and whether it was even moving where he was.
//
//   node test/outwhy.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, PITCH_W, PITCH_L, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { hold: [], lead: [], manEdge: [], ballV: [], n: 0 };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, wasSp = !!mp.sp;
    const idx = mp.idx, side = mp.side, hold = mp.hold;
    const q = idx >= 0 && !wasSp ? s.players[side][idx] : null;
    const qx = q ? q.x : 0, qy = q ? q.y : 0;
    const bv = Math.hypot(mp.bvx, mp.bvy);
    meTick(s, rng, out);
    if (!wasSp && mp.sp && mp.sp.kind !== "kickoff" && mp.sp.kind !== "freekick"
        && mp.sp.kind !== "penalty" && idx >= 0 && q) {
      A.n++;
      A.hold.push(hold || 0);
      A.lead.push(Math.hypot(mp.sp.x - qx, mp.sp.y - qy));       // how far in front of him it was
      A.manEdge.push(Math.min(qy, PITCH_W - qy, qx, PITCH_L - qx));
      A.ballV.push(bv / 0.25);
    }
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const cat = (k) => res.flatMap(r => r[k]);
const hold = cat("hold"), lead = cat("lead"), manEdge = cat("manEdge"), ballV = cat("ballV");
const n = hold.length;
const f1 = (x) => x.toFixed(1);
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

console.log(`\n${N} matches, ${f1(n / N)} carried-out balls a match.\n`);
console.log(`  how long he had had it when it crossed (mp.hold, slices):`);
const HB = [[0, 2], [2, 5], [5, 10], [10, 20], [20, 1e9]];
for (const [lo, hi] of HB) {
  const c = hold.filter(h => h >= lo && h < hi).length;
  console.log(`    ${(hi > 1e8 ? lo + "+" : `${lo}-${hi}`).padStart(6)} slices  ${String(c).padStart(4)}  ${f1(100 * c / n).padStart(5)}%`);
}
console.log(`\n  median ball lead in front of him   ${f1(med(lead))} m`);
console.log(`  median HIS distance from the line  ${f1(med(manEdge))} m`);
console.log(`  median ball speed as it left        ${f1(med(ballV))} m/s`);
console.log(`\n  Hold of 0-2 means the ball had only just reached him: the FIRST TOUCH set its line`);
console.log(`  and the carry search never got a say. Hold in double figures means he really did`);
console.log(`  dribble it out, and the search is the thing to fix.`);
