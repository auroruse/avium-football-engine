// WHY DOESN'T THE BALL GO OUT?
//
// Ball in play sits at 83% against a real 58-72, and the reason is not that restarts are quick --
// they were timed against a viewer's clock and are right. It is that there are a quarter as many of
// them: 17 ball-out events a match against a real 65-75, of which throw-ins are 5.8 against 40-50.
//
// A real match is full of balls that simply run out: a pass behind a man, a clearance into the
// stand, a heavy touch on the touchline. This asks what happens to the ones that should. Every ball
// that ends a possession is classified by where it stopped and how close it got to going out, so the
// difference between "nobody is missing" and "everybody misses but the grass eats it" is visible.
//
//   node test/outplay.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
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
  const A = { loose: 0, near: [0, 0, 0, 0], stopped: 0, collected: 0, rolled: 0, throws: 0,
              freeMax: 0, freeN: 0 };
  let wasFree = false;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const beforeSp = !!mp.sp;
    meTick(s, rng, out);
    if (mp.sp && !beforeSp && mp.sp.kind === "throw") A.throws++;
    if (mp.sp) { wasFree = false; continue; }
    // a LOOSE ball: nobody has it. How close is it to a touchline, and is it still moving?
    const free = mp.idx < 0;
    if (free) {
      const edge = Math.min(mp.by, PITCH_W - mp.by);
      const v = Math.hypot(mp.bvx, mp.bvy);
      if (!wasFree) {                                   // the moment it came loose
        A.loose++;
        A.near[edge < 1 ? 0 : edge < 3 ? 1 : edge < 8 ? 2 : 3]++;
      }
      // how far a free ball still had to travel when it stopped, measured off the touchline
      if (v < 0.4 && wasFree) { A.stopped++; A.freeMax += edge; A.freeN++; }
    } else if (wasFree) A.collected++;
    wasFree = free;
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const near = [0, 1, 2, 3].map(i => res.reduce((a, r) => a + r.near[i], 0));
const f1 = (x) => x.toFixed(1);
const L = S("loose") || 1;

console.log(`\n${N} matches.\n`);
console.log(`  loose balls per match          ${f1(S("loose") / N)}`);
console.log(`  throw-ins per match            ${f1(S("throws") / N)}      real 40-50`);
console.log(`  loose balls collected          ${f1(100 * S("collected") / L)}%`);
console.log(`  loose balls that STOPPED dead  ${f1(100 * S("stopped") / L)}%`);
console.log(`\n  when a ball comes loose, how far it is from a touchline:`);
const lbl = ["under 1 m", "1-3 m", "3-8 m", "over 8 m"];
for (let i = 0; i < 4; i++) console.log(`    ${lbl[i].padEnd(10)} ${f1(100 * near[i] / L).padStart(6)}%`);
console.log(`\n  a ball that stops dead had, on average, ${f1(S("freeMax") / (S("freeN") || 1))} m still to travel to be out.`);
console.log(`\n  If loose balls are dying several metres short of the line, the grass is eating the`);
console.log(`  throw-ins. If they are dying in midfield, the ball simply never gets near the touchline.`);
