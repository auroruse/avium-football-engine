// WHY ARE THERE SO FEW OFFSIDES?
//
// 0.75 a side against a real 1.5-3.5, and the rule itself checks out: the line is the second-deepest
// outfielder and it is clamped to the halfway line, which is what the law says. So the shortfall is
// upstream of the rule, and there are only two places it can be.
//
//   NOBODY IS THERE. If attackers never stray beyond the line there is nothing to give offside for,
//   however sharp the officiating. The tell is the share of the match with at least one man beyond
//   it, and how far beyond he is.
//
//   NOBODY PLAYS IT. A passer judges the line with error scaled by his rating -- offBlind at 3.0 m,
//   times (1 - meMind). At 75 OVR that is about one metre, so a good passer effectively never
//   misjudges and simply declines every ball to an offside man. Perfect officiating by the ATTACKER
//   is just as good at preventing offsides as a deep line is.
//
// This measures both, so the fix goes where the shortfall actually is.
//
//   node test/offdiag.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOffsideLine, meDir,
        ME_MATCH_TICKS, PITCH_L, ME_SIDES, CFG, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 },
  offside: { home: 0, away: 0 } });

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
  const A = { slices: 0, anyBeyond: 0, nBeyond: 0, depth: 0, depthN: 0, given: 0, lineDepth: 0 };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    // only while somebody actually has the ball -- offside is judged at the pass
    if (mp.idx >= 0 && !mp.sp) {
      const side = mp.side, dir = meDir(side), off = meOffsideLine(s, side);
      let n = 0;
      for (const p of s.players[side]) {
        if (p.pos === "GK" || p.off) continue;
        const beyond = (p.x - off) * dir;
        // and only where offside can be given at all: opponent's half, ahead of the ball
        if (beyond > 0 && (p.x - PITCH_L / 2) * dir > 0 && (p.x - mp.bx) * dir > 0) {
          n++; A.depth += beyond; A.depthN++;
        }
      }
      A.slices++; if (n) A.anyBeyond++; A.nBeyond += n;
      A.lineDepth += (off - PITCH_L / 2) * dir;
    }
    meTick(s, rng, out);
  }
  A.given = out.offside.home + out.offside.away;
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const sl = S("slices") || 1;

console.log(`\n${N} matches.\n`);
console.log(`  offsides given per match        ${f2(S("given") / N)}      real 3-7`);
console.log(`\n  IS ANYBODY THERE?`);
console.log(`    slices with a man beyond the line   ${f1(100 * S("anyBeyond") / sl)}%`);
console.log(`    men beyond it, on average           ${f2(S("nBeyond") / sl)}`);
console.log(`    how far beyond, when there is one   ${f1(S("depth") / (S("depthN") || 1))} m`);
console.log(`    the line itself sits                ${f1(S("lineDepth") / sl)} m past halfway`);
console.log(`\n  WOULD ANYBODY PLAY IT?`);
console.log(`    offBlind ${CFG.offBlind} m, scaled by (1 - meMind). At 75 OVR meMind is 0.65, so a`);
console.log(`    passer's judgement of the line is out by about ${f1(CFG.offBlind * 0.35)} m -- and offsideGrace`);
console.log(`    lets a through ball go ${CFG.offsideGrace} m beyond before he even considers it a risk.`);
console.log(`\n  If men ARE regularly beyond the line and offsides are still rare, the passer is the`);
console.log(`  bottleneck and no amount of pushing the defence up will help.`);
