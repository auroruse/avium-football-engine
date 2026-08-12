// IS THE KEEPER ON HIS ANGLE?
//
// The resting stance (brain.ts, the tail of the GK branch) puts him on the line from the middle of
// his goal to the ball, a fraction of the way out. That is not where a goalkeeper stands. He stands
// on the BISECTOR of the two angles to the posts, which for a ball out wide is a different line
// entirely: the bisector leans toward the near post, the centre line does not. Covering your near
// post is the whole of the job, and the difference between the two rules is exactly the near post.
//
// Measured at the moment every shot is struck:
//
//   bisector offset   how far he is off the bisector ray, signed, in fractions of the half-angle.
//                     0 is perfect. -1 is standing on the near post, +1 on the far post. A keeper
//                     on the goal-centre line reads POSITIVE on every wide shot -- too far across.
//   near/far          which half of the goal mouth the ball crossed on the goals that went in.
//                     Real football concedes more at the far post than the near one; a keeper who
//                     stands too central concedes at the near post, which is the error being looked
//                     for here.
//   depth             how far off his line he is, and how much of the goal his body actually covers
//                     from where the shooter is standing.
//
//   node test/gkangle.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        ME_MATCH_TICKS, PITCH_W, GOAL_HALF_W, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 30);
const ME_HALF_W = PITCH_W / 2;

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { shots: 0, off: [], wide: [], depth: [], cover: [], goals: 0, near: 0, far: 0,
              wideShots: 0, wideOff: [], inBox: 0, offBox: [], offRest: [], lag: [], tgtOff: [] };
  let seen = null, live = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const g0 = out.goals.home + out.goals.away;
    meTick(s, rng, out);
    // ---- a new shot: measure the keeper where he was standing when it was struck
    if (mp.shot && mp.shot !== seen) {
      seen = mp.shot;
      const atk = mp.shot.side, def = meOther(atk);
      const gk = s.players[def].find(q => q.pos === "GK" && !q.off);
      const gx = meGoalX(atk);                       // the goal being shot at
      if (gk) {
        const sx = mp.bx, sy = mp.by;
        // The two posts, and the unit vectors to them from the shooter.
        const pA = [gx, ME_HALF_W - GOAL_HALF_W], pB = [gx, ME_HALF_W + GOAL_HALF_W];
        const u = (px, py) => { const dx = px - sx, dy = py - sy, l = Math.hypot(dx, dy) || 1;
                                return [dx / l, dy / l]; };
        const [ax, ay] = u(pA[0], pA[1]), [bx, by] = u(pB[0], pB[1]);
        let mx = ax + bx, my = ay + by; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
        // Half-angle of the goal mouth as seen from the shooter, and where the keeper sits in it.
        const half = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by))) / 2;
        const kx = gk.x - sx, ky = gk.y - sy, kl = Math.hypot(kx, ky) || 1;
        let ang = Math.atan2((mx * ky - my * kx) / kl, (mx * kx + my * ky) / kl);
        // Sign it so NEGATIVE is toward the near post -- the post the shooter is nearer to.
        const nearIsLow = Math.abs(sy - pA[1]) < Math.abs(sy - pB[1]);
        const toNear = nearIsLow ? Math.atan2(ay * mx - ax * my, ax * mx + ay * my)
                                 : Math.atan2(by * mx - bx * my, bx * mx + by * my);
        if (toNear > 0) ang = -ang;
        A.shots++;
        A.off.push(half > 1e-4 ? ang / half : 0);      // -1 near post, 0 bisector, +1 far post
        A.depth.push(Math.hypot(gk.x - gx, gk.y - ME_HALF_W));
        // How much of the mouth his body blocks, as a share of the angle he has to cover.
        A.cover.push(Math.min(1, Math.atan2(CFG.bodyR, kl) / Math.max(1e-4, half)));
        // WHICH BRANCH SET HIS TARGET. meShape runs before meDecide in the same tick, so the ball
        // was still at the shooter's feet when he was positioned. Inside gkBoxR of the goal the
        // carrier-in-my-area branch fires and he charges the ball in a straight line, with no angle
        // in it at all; outside it he is on the resting stance, which is the one being changed.
        const dG = Math.hypot(sx - gx, sy - ME_HALF_W);
        if (dG < CFG.gkBoxR) { A.inBox++; A.offBox.push(half > 1e-4 ? ang / half : 0); }
        else A.offRest.push(half > 1e-4 ? ang / half : 0);
        // IS IT THE RULE OR IS IT HIM? How far he is from the spot he was actually told to stand
        // on, and what the offset would have been if he had been standing on it. If the target is on
        // the angle and he is not, the stance rule is innocent and this is a movement problem.
        if (gk._tx !== undefined) {
          A.lag.push(Math.hypot(gk.x - gk._tx, gk.y - gk._ty));
          const tx2 = gk._tx - sx, ty2 = gk._ty - sy, tl2 = Math.hypot(tx2, ty2) || 1;
          let ta = Math.atan2((mx * ty2 - my * tx2) / tl2, (mx * tx2 + my * ty2) / tl2);
          if (toNear > 0) ta = -ta;
          A.tgtOff.push(half > 1e-4 ? ta / half : 0);
        }
        const offset = Math.abs(sy - ME_HALF_W);
        if (offset > 9) { A.wideShots++; A.wideOff.push(half > 1e-4 ? ang / half : 0); }
        live = { atk, sy, nearIsLow };
      }
    }
    // ---- a goal: which half of the mouth did it cross?
    if (out.goals.home + out.goals.away > g0 && live) {
      A.goals++;
      const crossed = mp.by - ME_HALF_W;
      const nearSide = live.nearIsLow ? crossed < 0 : crossed > 0;
      if (nearSide) A.near++; else A.far++;
      live = null;
    }
    if (mp.sp) live = null;
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const cat = (k) => res.flatMap(r => r[k]);
const f2 = (x) => x.toFixed(2);
const q = (a, p) => { const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : 0; };
const pc = (n, d) => (100 * n / (d || 1)).toFixed(1) + "%";

console.log(`\n${N} matches, ${S("shots")} shots.\n`);
console.log(`  WHERE HE IS STANDING, AS THE SHOOTER SEES IT`);
console.log(`    offset from the bisector      p10 ${f2(q(cat("off"), 0.1))}  p50 ${f2(q(cat("off"), 0.5))}  p90 ${f2(q(cat("off"), 0.9))}`);
console.log(`      (-1 on the near post, 0 on his angle, +1 on the far post)`);
console.log(`    ...on shots from wide (>9 m)  p50 ${f2(q(cat("wideOff"), 0.5))}   ${S("wideShots")} shots`);
console.log(`    shots struck inside gkBoxR    ${pc(S("inBox"), S("shots"))}  -- he is CHARGING, not on his angle`);
console.log(`      their offset                p50 ${f2(q(cat("offBox"), 0.5))}`);
console.log(`    shots from outside it         ${pc(S("shots") - S("inBox"), S("shots"))}  -- the resting stance`);
console.log(`      their offset                p50 ${f2(q(cat("offRest"), 0.5))}`);
console.log(`    his TARGET's offset           p50 ${f2(q(cat("tgtOff"), 0.5))}   <- the rule itself`);
console.log(`    how far he is FROM that spot  p50 ${f2(q(cat("lag"), 0.5))} m  p90 ${f2(q(cat("lag"), 0.9))} m`);
console.log(`    off his goal line             p50 ${f2(q(cat("depth"), 0.5))} m   p90 ${f2(q(cat("depth"), 0.9))} m`);
console.log(`    share of the mouth he blocks  p50 ${pc(q(cat("cover"), 0.5), 1)}`);
console.log(`\n  GOALS, BY THE HALF OF THE MOUTH THEY CROSSED`);
console.log(`    near post   ${pc(S("near"), S("goals")).padStart(6)}       real ~35-45%`);
console.log(`    far post    ${pc(S("far"), S("goals")).padStart(6)}       real ~55-65%`);
console.log(`    (${S("goals")} goals)`);
