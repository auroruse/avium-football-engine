// WHOSE THROW IS IT?
//
// A throw-in, a corner and a goal kick are all the same question: who touched it last. The engine
// asked mp.lastSide, which only moves on a DELIBERATE play -- a pass, a shot, a clearance, a header.
// A ball that clips a defender's shin on its way out never moved it, so the deflection was invisible
// and the restart went to whoever last meant to kick it.
//
// hitBodies has recorded that contact all along, in mp.hitP, with the comment "he got a foot to it:
// that is the touch". Nothing read it. This counts how often the two disagree at the moment the ball
// leaves play -- which is exactly the number of restarts that were awarded to the wrong side.
//
//   node test/whosball.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, PITCH_W, STRAT_DEF } = eng;

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
  const A = { n: {}, flip: {} };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, wasSp = !!mp.sp;
    const ls = mp.lastSide;
    meTick(s, rng, out);
    if (!wasSp && mp.sp && mp.sp.kind !== "kickoff") {
      const k = mp.sp.kind;
      A.n[k] = (A.n[k] || 0) + 1;
      // touchSide is resolved fresh every slice from the body contact; lastSide only from a kick.
      if (mp.touchSide !== ls) A.flip[k] = (A.flip[k] || 0) + 1;
    }
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const n = {}, flip = {};
for (const r of res) { for (const [k, v] of Object.entries(r.n)) n[k] = (n[k] || 0) + v;
                       for (const [k, v] of Object.entries(r.flip)) flip[k] = (flip[k] || 0) + v; }
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches.\n`);
console.log(`  restart      per match   the ball had since come off SOMEBODY ELSE`);
console.log(`  ----------   ---------   ----------------------------------------`);
let T = 0, F = 0;
for (const [k, v] of Object.entries(n).sort((a, b) => b[1] - a[1])) {
  T += v; F += flip[k] || 0;
  console.log(`  ${k.padEnd(10)}   ${f1(v / N).padStart(9)}   ${(f1((flip[k] || 0) / N) + " a match").padStart(14)}   ` +
    `${f1(100 * (flip[k] || 0) / v).padStart(5)}%`);
}
console.log(`  ${"".padEnd(10)}   ${f1(T / N).padStart(9)}   ${(f1(F / N) + " a match").padStart(14)}   ${f1(100 * F / T).padStart(5)}%`);
console.log(`\n  Every one of those was being awarded to the wrong side before the touch was read.`);
