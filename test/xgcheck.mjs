// IS IT THE CHANCES, OR THE FINISHING? Conversion is 29% against a real 11% while shots are already
// correct at ~10.5 a side, and the keeper, the blocking and the woodwork all measure right. Two very
// different things fit that, and they want opposite fixes:
//
//   (a) the chances are genuinely twice as good -- the defence concedes shots from places real
//       defences do not, and the answer is defensive;
//   (b) the chances are ordinary and the physics puts twice as many of them in -- the answer is
//       somewhere in the shot-to-goal path, which I have now swept twice without moving it.
//
// A reference xG separates them. Every shot is scored by distance and visible goal angle using a
// plain logistic fitted to public shot data -- nothing from this engine -- and summed. If the
// reference says 1.2 xG a side and the engine scores 3.1, the chances are normal and something
// converts them too well. If the reference says 3.0, the chances really are that good.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, ME_GOAL_W } = eng;

const squad = (o) => buildSquad("4-3-3", null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });

// Reference xG. Distance in metres to the centre of the goal, plus the angle the goal actually
// subtends from where he is standing -- a shot from the byline has almost no goal to aim at however
// close it is. Logit tuned to the public numbers: 6 m central 0.39, 11 m 0.22, 16 m 0.11, 25 m 0.03.
function refXg(d, off) {
  const half = ME_GOAL_W / 2;
  const th = Math.abs(Math.atan2(half - off, Math.max(0.5, d)) - Math.atan2(-half - off, Math.max(0.5, d)));
  const thRef = 2 * Math.atan2(half, Math.max(0.5, d));          // the angle if he were dead central
  const narrow = thRef > 1e-6 ? Math.max(0.15, th / thRef) : 1;  // how much of it he has thrown away
  const logit = 0.5 - 0.16 * d + Math.log(narrow);
  return 1 / (1 + Math.exp(-logit));
}

const N = +(process.env.N || 20);
function run(seed) {
  const s = createMatchState();
  const hs = squad(75), as = squad(75);
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let xg = 0, n = 0, dSum = 0;
  const band = { "0-6": [0,0], "6-11": [0,0], "11-16": [0,0], "16-25": [0,0], "25+": [0,0] };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, b4 = mp.shot, bx = mp.bx, by = mp.by;
    meTick(s, rng, out);
    if (b4 || !mp.shot) continue;
    const gx = meGoalX(mp.shot.side);
    const d = Math.hypot(gx - bx, ME_HALF_W - by), off = by - ME_HALF_W;
    const x = refXg(d, off);
    xg += x; n++; dSum += d;
    const k = d < 6 ? "0-6" : d < 11 ? "6-11" : d < 16 ? "11-16" : d < 25 ? "16-25" : "25+";
    band[k][0]++; band[k][1] += x;
  }
  return { xg, n, dSum, band, g: out.goals.home + out.goals.away, sh: out.shots.home + out.shots.away };
}
const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const bands = {};
for (const r of res) for (const [k, v] of Object.entries(r.band)) {
  const e = bands[k] || (bands[k] = [0, 0]); e[0] += v[0]; e[1] += v[1];
}
const g = S("g"), sh = S("sh"), xg = S("xg"), n = S("n");
console.log(`\n${N} matches, ${n} shots tracked (${sh} counted by the engine).\n`);
console.log(`  reference xG per side per match   ${(xg / N / 2).toFixed(2)}      real ~1.4`);
console.log(`  goals actually scored             ${(g / N / 2).toFixed(2)}`);
console.log(`  reference xG PER SHOT             ${(xg / n).toFixed(3)}     real ~0.10-0.11`);
console.log(`  goals per shot                    ${(g / sh).toFixed(3)}`);
console.log(`  mean shot distance                ${(S("dSum") / n).toFixed(1)} m    real ~17`);
console.log(`\n  where the shots come from, and what those places are worth:`);
console.log(`    band        shots    share    mean xG`);
for (const [k, v] of Object.entries(bands))
  console.log(`    ${k.padEnd(8)} ${String(v[0]).padStart(7)}  ${(100*v[0]/n).toFixed(1).padStart(6)}%  ${(v[1]/(v[0]||1)).toFixed(3).padStart(9)}`);
console.log(`\n  If reference xG is near 1.4 and goals are 3.1, ordinary chances are going in twice as`);
console.log(`  often and the fault is downstream. If reference xG is near 3, the chances themselves`);
console.log(`  are the fault and the answer is defensive.`);
