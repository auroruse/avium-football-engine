// Off target is 23.3% against a real 35%, and that gap is most of what is left in conversion.
// HOW does a shot miss -- wide, or over?
//
// Tracking the ball to the goal line does not work: the slice that crosses it also resets the ball
// (a goal restarts from the centre, a miss from the six-yard box), so the crossing is gone before it
// can be read. Project it instead. At the moment of the strike the launch velocity is known and the
// flight model is closed form, so where an UNOBSTRUCTED shot would arrive can be solved exactly --
// which is the right question anyway, because it isolates the accuracy model from every block, save
// and deflection downstream.
//
//   horizontal: 1D quadratic drag, s(t) = ln(1 + k v0 t)/k, so t(s) = (e^(k s) - 1)/(k v0)
//   vertical:   z(t) = z0 + vz t - g t^2 / 2
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, ME_GOAL_W, CFG } = eng;

const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });

const HALF = ME_GOAL_W / 2, BAR = 2.44;
const N = +(process.env.N || 16);

function run(seed) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const hits = [];
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const b4 = s.mePos.shot;
    meTick(s, rng, out);
    const mp = s.mePos;
    if (b4 || !mp.shot) continue;                        // only the slice it was struck on
    const gx = meGoalX(mp.shot.side);
    const v0 = Math.hypot(mp.bvx, mp.bvy);
    if (v0 < 1) continue;
    const ux = mp.bvx / v0, uy = mp.bvy / v0;
    const need = gx - mp.bx;
    if (need * ux <= 0) { hits.push({ kind: "away", d: Math.abs(need) }); continue; }  // not even goalwards
    const path = need / ux;                              // ground distance to the goal plane
    const k = CFG.ballDrag;
    const tt = (Math.exp(k * path) - 1) / (k * v0);
    const y = mp.by + uy * path;
    const z = mp.bz + mp.bvz * tt - 4.905 * tt * tt;
    hits.push({ kind: "shot", y, z, d: Math.hypot(need, mp.by - ME_HALF_W), t: tt,
                off: Math.abs(y - ME_HALF_W) });
  }
  return hits;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const H = res.flat().filter(h => h.kind === "shot");
const pc = (a) => (100 * a / (H.length || 1)).toFixed(1) + "%";
const qOf = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : NaN;

const inGoal = H.filter(h => h.off < HALF && h.z > 0 && h.z < BAR).length;
const wide   = H.filter(h => h.off >= HALF).length;
const over   = H.filter(h => h.off < HALF && h.z >= BAR).length;
const under  = H.filter(h => h.off < HALF && h.z <= 0).length;

console.log(`\n${N} matches, ${H.length} shots, projected to the goal plane with no obstruction.\n`);
console.log(`  would be ON TARGET   ${String(inGoal).padStart(4)}  ${pc(inGoal)}      real: about 45% of unobstructed shots`);
console.log(`  WIDE of the post     ${String(wide).padStart(4)}  ${pc(wide)}`);
console.log(`  OVER the bar         ${String(over).padStart(4)}  ${pc(over)}      <- in real football about as common as wide`);
console.log(`  into the ground      ${String(under).padStart(4)}  ${pc(under)}`);

const zs = H.map(h => h.z).sort((a, b) => a - b);
console.log(`\n  height at the goal plane:`);
console.log(`    median ${qOf(zs, 0.5).toFixed(2)} m   90th ${qOf(zs, 0.9).toFixed(2)} m   99th ${qOf(zs, 0.99).toFixed(2)} m` +
            `   highest ${zs[zs.length - 1].toFixed(2)} m       crossbar ${BAR} m`);
const ys = H.map(h => h.off).sort((a, b) => a - b);
console.log(`  off centre at the goal plane:`);
console.log(`    median ${qOf(ys, 0.5).toFixed(2)} m   90th ${qOf(ys, 0.9).toFixed(2)} m   99th ${qOf(ys, 0.99).toFixed(2)} m` +
            `   widest ${ys[ys.length - 1].toFixed(2)} m       post ${HALF.toFixed(2)} m`);
console.log(`\n  aim: shotAimBase ${CFG.shotAimBase} + skill*${CFG.shotAimSkill} of the half-width, so about` +
            ` ${((CFG.shotAimBase + 0.85 * CFG.shotAimSkill) * HALF).toFixed(2)} m off centre for a good finisher.`);
console.log(`  error cone: shotNoiseDeg ${CFG.shotNoiseDeg} + (1-skill)*${CFG.shotNoiseSkill} deg, bounded (two uniforms summed).`);
console.log(`  elevation: aimZ 0.25..${(0.25 + 0.5 + 0.85 * 2.44 * 0.45).toFixed(2)} m, elev error ${CFG.shotElevErr}.`);
