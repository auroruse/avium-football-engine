// WHAT ACTUALLY HAPPENS AT A GOAL KICK?
//
// shape.mjs scores an instruction on eighteen whole-match metrics, and a goal kick is a handful of
// restarts in eighteen simulated minutes -- so an instruction that only changes goal kicks is close
// to invisible there however well it works. gkDist read 2.3 against a noise floor of 1.6, which says
// almost nothing either way. This looks at the restarts themselves.
//
// Three things say whether "short" and "long" are really different: how far the keeper hits it, how
// far up the pitch his team is standing when he does, and where the ball ends up once the dust has
// settled a few seconds later.
//
//   node test/goalkick.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        ME_MATCH_TICKS, STRAT_DEF, PITCH_L, ME_HALF_W } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24), AFTER = 24;      // six seconds later

function play(v) {
  const A = { n: 0, kicks: 0, len: 0, teamX: 0, after: 0, kept: 0, high: 0 };
  for (const SIDE of ["home", "away"]) {
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState(), OTH = SIDE === "home" ? "away" : "home";
    s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF, ...(SIDE === "home" ? { gkDist: v } : {}) },
                   away: { ...STRAT_DEF, ...(SIDE === "away" ? { gkDist: v } : {}) } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const dir = meDir(SIDE), own = meGoalX(meOther(SIDE));
    const depth = (x) => (x - own) * dir;           // metres up the pitch from our own line
    let armed = null, wait = 0;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      // a goal kick of OURS, about to be taken
      const isOurs = mp.sp && mp.sp.kind === "goalkick" && mp.sp.side === SIDE;
      const wasArmed = armed;
      if (isOurs) {
        // where the outfielders are standing while he waits over it
        const of = s.players[SIDE].filter(p => p.pos !== "GK" && !p.off);
        armed = { x: mp.bx, y: mp.by,
                  team: of.reduce((a, p) => a + depth(p.x), 0) / Math.max(1, of.length) };
      }
      meTick(s, rng, out);
      // it has just been struck: the stoppage is gone and the ball is moving
      if (wasArmed && !mp.sp) {
        A.kicks++; A.len += Math.hypot(mp.bx - wasArmed.x, mp.by - wasArmed.y) || 0;
        A.teamX += wasArmed.team;
        if (mp.bz > 0.5) A.high++;
        wait = AFTER; armed = null;
      } else if (!isOurs) armed = null;
      if (wait > 0 && --wait === 0) {
        A.after += depth(mp.bx);
        if (mp.idx >= 0 && mp.side === SIDE) A.kept++;
      }
    }
    A.n++;
  }
  }
  return A;
}

const res = await parMap([-1, 0, 1], play);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1);
const LBL = ["Short", "No Instruction", "Long"];
console.log(`\nGoal kicks. ${N} matches per setting per side, 75 v 75, 4-3-3.\n`);
console.log(`  setting          per match   how far he hits it   team standing at   lofted   ` +
            `6s later: ball at   still ours`);
console.log(`  --------------   ---------   ------------------   ----------------   ------   ` +
            `-----------------   ----------`);
for (let i = 0; i < 3; i++) {
  const A = res[i], k = Math.max(1, A.kicks);
  console.log(`  ${LBL[i].padEnd(14)}   ${f1(A.kicks / A.n).padStart(9)}   ${f1(A.len / k).padStart(15)} m   ` +
    `${f1(A.teamX / k).padStart(14)} m   ${f1(100 * A.high / k).padStart(5)}%   ` +
    `${f1(A.after / k).padStart(15)} m   ${f1(100 * A.kept / k).padStart(9)}%`);
}
console.log(`\n  "team standing at" is the outfielders' mean distance up the pitch while he waits over it.`);
console.log(`  Going long with the side still on its own eighteen-yard line concedes every second ball,`);
console.log(`  which is what this instruction has to move if it is to mean anything.`);
