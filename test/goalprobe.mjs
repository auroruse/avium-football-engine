// Widening the shot error cone fourfold did not move conversion. So goals are not being placed past
// the keeper -- something else is putting them in. Watch the goal line itself: for every goal, where
// did the ball cross, how high, where was the keeper, and had he read the right side.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, meOther,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, PITCH_L, CFG } = eng;

const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 24);
function run(seed) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const goals = [];
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const gh = out.goals.home, ga = out.goals.away;
    // Everything about the world one slice BEFORE the ball crossed.
    const bx = mp.bx, by = mp.by, bz = mp.bz, v = Math.hypot(mp.bvx, mp.bvy);
    const shot = mp.shot ? { side: mp.shot.side, readY: mp.shot.readY, age: mp.tick - mp.shot.t0 } : null;
    const gks = { home: s.players.home.find(q => q.pos === "GK"), away: s.players.away.find(q => q.pos === "GK") };
    const gkPos = { home: gks.home ? { x: gks.home.x, y: gks.home.y } : null,
                    away: gks.away ? { x: gks.away.x, y: gks.away.y } : null };
    const held = mp.held, idx = mp.idx, lastSide = mp.lastSide;
    meTick(s, rng, out);
    const scorer = out.goals.home > gh ? "home" : out.goals.away > ga ? "away" : null;
    if (!scorer) continue;
    const gk = gkPos[meOther(scorer)];                 // the keeper who was beaten
    const gx = meGoalX(scorer);
    goals.push({
      hadShot: !!shot, shotAge: shot ? shot.age : -1,
      // where the ball was the slice before it went in, relative to the goal it went into
      dist: Math.hypot(gx - bx, ME_HALF_W - by), z: bz, v,
      offGk: gk ? Math.abs(by - gk.y) : -1,            // how far off the keeper, laterally
      gkDepth: gk ? Math.abs(gx - gk.x) : -1,          // how far off his line he was
      readOk: shot && shot.readY !== undefined
        ? Math.sign(shot.readY - ME_HALF_W) === Math.sign(by - ME_HALF_W) || Math.abs(by - ME_HALF_W) < 0.5
        : null,
      held, carried: idx >= 0, lastSide, scorer,
    });
  }
  return goals;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const G = res.flat();
const pc = (a) => (100 * a / G.length).toFixed(1) + "%";
const mean = (f) => (G.reduce((a, g) => a + f(g), 0) / G.length).toFixed(2);

console.log(`\n${N} matches, ${G.length} goals (${(G.length / N / 2).toFixed(2)} a side).\n`);
console.log(`  came from a live shot          ${pc(G.filter(g => g.hadShot).length)}`);
console.log(`    ...struck this same slice    ${pc(G.filter(g => g.hadShot && g.shotAge <= 1).length)}`);
console.log(`  the man had it at his feet     ${pc(G.filter(g => g.carried).length)}   <- walked/dribbled in`);
console.log(`  keeper had it in his hands     ${pc(G.filter(g => g.held).length)}`);
console.log(`  last touch was the DEFENDING side ${pc(G.filter(g => g.lastSide !== g.scorer).length)}   <- own goals / deflections`);

const shots = G.filter(g => g.hadShot);
console.log(`\n  of the ${shots.length} that were live shots:`);
console.log(`    keeper read the right side   ${(100 * shots.filter(g => g.readOk).length / (shots.length || 1)).toFixed(1)}%`);
console.log(`    ball crossed this far off him laterally  ${(shots.reduce((a, g) => a + g.offGk, 0) / (shots.length || 1)).toFixed(2)} m`);
console.log(`    keeper was this far off his line         ${(shots.reduce((a, g) => a + g.gkDepth, 0) / (shots.length || 1)).toFixed(2)} m`);

console.log(`\n  every goal, one slice before it crossed:`);
console.log(`    ball height        ${mean(g => g.z)} m      (crossbar 2.44)`);
console.log(`    ball speed         ${mean(g => g.v)} m/s`);
console.log(`    distance out       ${mean(g => g.dist)} m`);
const bands = [[0, 0.5], [0.5, 2], [2, 6], [6, 12], [12, 99]];
console.log(`\n    how far out it was when it went in:`);
for (const [lo, hi] of bands) {
  const b = G.filter(g => g.dist >= lo && g.dist < hi);
  console.log(`      ${String(lo).padStart(4)}-${String(hi).padEnd(4)} m   ${String(b.length).padStart(4)}  ${pc(b.length)}` +
    `   of which ${(100 * b.filter(g => g.carried).length / (b.length || 1)).toFixed(0)}% were at a man's feet`);
}
console.log(`\n  keeper covers ${(2 * (CFG.bodyR + CFG.ballR)).toFixed(2)} m of a 7.32 m goal standing still.`);
