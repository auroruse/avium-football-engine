// The ball. One integrator, one prediction array, and every flight in the match comes out of it.
//
// Ported from GameplayFootball's ball.cpp (constants verified at ball.cpp:167-232): quadratic air
// drag on the 3D speed, restitution with a linear brake so the bounce tail dies in finite time, and
// rolling resistance with a linear term so the ball actually stops. The linear terms are the
// load-bearing part -- without them everything decays asymptotically and never settles.
//
// The prediction IS the simulation: the ball advances each tick by integrating the same function
// that fills the forecast, so the two can never diverge. Rebuilt on every touch, so a kick is
// visible to every brain within one slice.
import { CFG, ME_DT } from "./config";
import { meAttrs, meTech } from "./attributes";

import { ME_HALF_W, PITCH_L } from "./geometry";

// The goal, in metres. Until this existed a ball rolling into the net was recorded as a corner: the
// only boundary test in the engine was `bx < 0 || bx > PITCH_L`.
export const GOAL_HALF_W = 3.66, GOAL_H = 2.44;

export const BALL_SUB = 0.01;           // 10 ms substep, same as GF
export const PRED_SLOTS = 13;           // 0..3 s at 250 ms -- slot i is i*ME_DT seconds out

function stepOnce(b) {
  // gravity, then drag on the full 3D velocity
  b.bvz -= 9.81 * BALL_SUB;
  const v3 = Math.hypot(b.bvx, b.bvy, b.bvz);
  if (v3 > 0.01) {
    const v2 = Math.max(0, v3 - CFG.ballDrag * v3 * v3 * BALL_SUB) / v3;
    b.bvx *= v2; b.bvy *= v2; b.bvz *= v2;
  }
  b.bx += b.bvx * BALL_SUB; b.by += b.bvy * BALL_SUB; b.bz += b.bvz * BALL_SUB;
  // ground: restitution minus a linear brake, never upward from nothing
  if (b.bz < CFG.ballR) {
    b.bz = CFG.ballR;
    if (b.bvz < 0) {
      // The turf grips on a real impact: a bounce costs horizontal pace as well as vertical.
      if (b.bvz < -CFG.bounceMin) { b.bvx *= CFG.bounceGrip; b.bvy *= CFG.bounceGrip; }
      b.bvz = Math.max(-b.bvz * CFG.ballBounce - CFG.ballBounceLin, 0);
    }
  }
  // rolling through the grass
  if (b.bz < CFG.ballR + CFG.grassH) {
    const v = Math.hypot(b.bvx, b.bvy);
    if (v > 0.01) {
      const nv = Math.max(0, v - (CFG.ballFric * v * v + CFG.ballFricLin) * BALL_SUB) / v;
      b.bvx *= nv; b.bvy *= nv;
    }
  }
}

/** Advance the real ball by `seconds`, stopping at the first goal-line crossing.
 *
 *  Crossings are detected INSIDE the substep loop and interpolated to the exact plane, because a
 *  struck ball covers six metres in one engine slice -- sampling y and z at slice boundaries would
 *  miss the frame and score a goal as a corner.
 *
 *  Returns null, or `{ kind, conceding, y, z }` with kind "goal" | "woodwork" | "behind". */
/** Bodies. Solid, every substep: the ball is pushed back out of anyone it has entered, and it takes
 *  an impulse from him. For anybody who is not controlling it that is a BOUNCE -- it ricochets off a
 *  defender's shins like a real ball. For the man in control it is a TOUCH: he plays it in the
 *  direction he is running, slightly quicker than he is going, and then runs onto it again. That is
 *  the whole of dribbling, and it is why the ball travels in front of him. */
function hitBodies(b, players, ctrl, skip) {
  if (b.bz > CFG.bodyH) return;
  const R = CFG.bodyR + CFG.ballR;
  // IN HIS HANDS. It is not rolling, it is not being steered, and nobody can bump it off him: it is
  // carried, out in front of his chest, and it moves exactly as he does. Left to the ordinary
  // close-control path the keeper was being shoved the ball a stride ahead of himself at his own
  // pace plus two and a half metres a second -- he was kicking it out of his own hands -- and it
  // then rolled back through his body, which is the ball drawn inside the man.
  if (ctrl && b.held) {
    let hx = ctrl.vx || 0, hy = ctrl.vy || 0;
    let hl = Math.hypot(hx, hy);
    if (hl < 1e-3) { hx = b.bx - ctrl.x; hy = b.by - ctrl.y; hl = Math.hypot(hx, hy) || 1; }
    b.bx = ctrl.x + hx / hl * CFG.gkHoldOut; b.by = ctrl.y + hy / hl * CFG.gkHoldOut;
    b.bvx = 0; b.bvy = 0; b.bvz = 0; b.bz = CFG.ballR + 0.5;
    return;
  }
  // The man in control shepherds it with both feet the whole time it is within his reach: a steer,
  // every substep, never a jump. His position is only ever changed by the integrator.
  // The line the man in control is taking it along. Hoisted out of the control block because the
  // BODY loop below needs it too: a ball under his own feet has to come out in front of him.
  let chx = 1, chy = 0;
  if (ctrl) {
    const rx0 = b.bx - ctrl.x, ry0 = b.by - ctrl.y, rd0 = Math.hypot(rx0, ry0);
    const cvx0 = (ctrl.vx || 0) / ME_DT, cvy0 = (ctrl.vy || 0) / ME_DT, hs0 = Math.hypot(cvx0, cvy0);
    if (ctrl._drbA != null) { chx = Math.cos(ctrl._drbA); chy = Math.sin(ctrl._drbA); }
    else if (hs0 > 0.3) { chx = cvx0 / hs0; chy = cvy0 / hs0; }
    else if (rd0 > 0.01) { chx = rx0 / rd0; chy = ry0 / rd0; }
    if (hs0 > 0.3) {
      const vxn = cvx0 / hs0, vyn = cvy0 / hs0;
      const off = Math.atan2(vxn * chy - vyn * chx, vxn * chx + vyn * chy);
      const lim = (CFG.touchOffWide - (CFG.touchOffWide - CFG.touchOffTight)
                   * Math.min(1, hs0 / CFG.touchOffV)) * Math.PI / 180;
      if (Math.abs(off) > lim) {
        const a2 = Math.atan2(vyn, vxn) + (off > 0 ? lim : -lim);
        chx = Math.cos(a2); chy = Math.sin(a2);
      }
    }
  }
  if (ctrl && b.bz < CFG.touchZ) {
    const rx = b.bx - ctrl.x, ry = b.by - ctrl.y, rd = Math.hypot(rx, ry);
    // CLOSE CONTROL REACHES FURTHER THAN A TOE. This used to be gated on CFG.reach, 0.70 m, while
    // the setpoint it is steering toward -- dribSet -- is 1.10 m: the ball was wanted at a distance
    // at which it could no longer be touched, so the control law could never arrive anywhere. Past
    // 0.70 m the ball was simply free, decelerating on the grass at 4.6 m/s while the man ran at
    // 5.1, so he caught it up and went past it. Measured, the ball sat 0.11 m ahead of the carrier
    // at the median and a metre BEHIND him at the tenth percentile, which is the dragging. reach is
    // the radius for getting a boot to somebody else's ball; running with your own is not that.
    if (rd < CFG.dribCtrl) {
      const cvx = (ctrl.vx || 0) / ME_DT, cvy = (ctrl.vy || 0) / ME_DT;
      const hs = Math.hypot(cvx, cvy);
      const hx = chx, hy = chy;
      // Where he wants it: a stride in front, on the line he is taking it. The friction term is what
      // stops the grass quietly dragging it back onto his heels.
      const wx = ctrl.x + hx * CFG.dribSet, wy = ctrl.y + hy * CFG.dribSet;
      const bspd = Math.hypot(b.bvx, b.bvy);
      const fr = (CFG.ballFric * bspd * bspd + CFG.ballFricLin) * BALL_SUB;
      const want = hs * CFG.touchGain + CFG.touchMin + fr;
      const dvx = hx * want + (wx - b.bx) * CFG.ctrlPull - b.bvx;
      const dvy = hy * want + (wy - b.by) * CFG.ctrlPull - b.bvy;
      const dm = Math.hypot(dvx, dvy);
      const cap = (CFG.ctrlForce + meTech(meAttrs(ctrl).pass) * CFG.ctrlSkill) * BALL_SUB;
      const k = dm > cap ? cap / dm : 1;
      b.bvx += dvx * k; b.bvy += dvy * k;
      if (!b.hitP) { b.hitP = ctrl; b.hitV = 0; }
    }
  }
  for (const q of players) {
    // The man who has just struck it does not then block it with his own shins. The ball leaves his
    // foot about a metre from his centre, so any pass whose line went back across him ricocheted off
    // the passer -- which on screen is a player passing in the wrong direction for no reason.
    if (skip && skip.indexOf(q) >= 0) continue;
    const dx = b.bx - q.x, dy = b.by - q.y;
    let d = Math.hypot(dx, dy);
    if (d >= R) continue;
    // Dead centre on a man is a real state -- every restart puts the ball on the taker's toes -- and
    // the contact normal is undefined there. Falling back to dx/1e-4 gave a normal of nearly zero,
    // so the ball was never pushed out of his body and simply lived inside him: 0.12 m from his feet,
    // three passes a side, and a match that stopped being football after the first throw-in.
    let nx, ny;
    if (d < 1e-3) {
      const qs = Math.hypot(q.vx || 0, q.vy || 0);
      if (qs > 1e-4) { nx = (q.vx || 0) / qs; ny = (q.vy || 0) / qs; } else { nx = 1; ny = 0; }
      d = 1e-3;
    } else { nx = dx / d; ny = dy / d; }
    const vqx = (q.vx || 0) / ME_DT, vqy = (q.vy || 0) / ME_DT;
    if (q === ctrl) {
      // UNDER HIS OWN FEET. He knocks it out IN FRONT of himself, along the line he is taking it --
      // a footballer does not carry the ball on his hip. Ejecting it along the contact normal like
      // anybody else put it wherever he happened to have passed it, and for a man who has just
      // overrun it that is BEHIND him. There it stayed: the control pull is aimed a stride in front,
      // so it runs straight through his own body and can never recover the ball, while this very
      // line re-pinned it to his back every substep. Measured, the ball was riding on a running
      // player for 28.6% of all on-ball slices, in stretches of up to three seconds. That is the
      // moonwalk, and this is the half of it that had nothing to do with how he was running.
      b.bx = q.x + chx * R; b.by = q.y + chy * R;
      continue;
    }
    b.bx = q.x + nx * R; b.by = q.y + ny * R;          // never inside a man
    const vn = b.bvx * nx + b.bvy * ny, qn = vqx * nx + vqy * ny;
    if (vn - qn >= 0) continue;                        // already moving apart
    const inSpd = Math.hypot(b.bvx, b.bvy), qSpd = Math.hypot(vqx, vqy);
    if (!b.hitP) { b.hitP = q; b.hitV = inSpd; }       // he got a foot to it: that is the touch
    const nv = (1 + CFG.bodyE) * qn - CFG.bodyE * vn;
    b.bvx += (nv - vn) * nx; b.bvy += (nv - vn) * ny;
    // A collision cannot invent pace. Without this every one of twenty-two men converging on a loose
    // ball added his own closing speed to it, so it stayed permanently above the speed anybody can
    // control and the match became one long ricochet nobody could claim: measured, the ball was in
    // play 100% of the time, nobody had possession on 93% of slices, and there were no shots.
    const outSpd = Math.hypot(b.bvx, b.bvy), lim = inSpd + qSpd * 1.1;
    if (outSpd > lim && outSpd > 0.01) { const k = lim / outSpd; b.bvx *= k; b.bvy *= k; }
  }
}

export function meBallStep(mp, seconds, players, ctrl, skip) {
  const n = Math.round(seconds / BALL_SUB);
  mp._touched = 0;
  // CARRY THE LAST PHYSICAL TOUCH FORWARD. hitP is a per-step field and was cleared here every tick,
  // but a ball that clips a defender and then runs out of play crosses the line several ticks later
  // -- by which point the deflection had been forgotten and the restart fell back to whoever last
  // played it deliberately. So a shot deflected behind was a goal kick and a pass off a defender's
  // shin was thrown in the wrong way. touchP survives until somebody plays it on purpose.
  if (mp.hitP) mp.touchP = mp.hitP;
  mp.hitP = null; mp.hitV = 0;
  for (let i = 0; i < n; i++) {
    const px = mp.bx, py = mp.by, pz = mp.bz;
    stepOnce(mp);
    if (players) hitBodies(mp, players, ctrl, skip);
    for (const plane of [0, PITCH_L]) {
      if ((px - plane) * (mp.bx - plane) >= 0) continue;        // did not cross this plane
      const t = (plane - px) / (mp.bx - px);
      const y = py + (mp.by - py) * t, z = pz + (mp.bz - pz) * t;
      const conceding = plane === 0 ? "home" : "away";
      const dy = Math.abs(y - ME_HALF_W);
      if (dy <= GOAL_HALF_W && z <= GOAL_H) return { kind: "goal", conceding, y, z };
      if (dy <= GOAL_HALF_W + CFG.frameBand && z <= GOAL_H + CFG.frameBand) {
        mp.bx = plane; mp.by = y; mp.bz = z;                    // sit it on the frame to bounce off
        return { kind: "woodwork", conceding, y, z };
      }
      return { kind: "behind", conceding, y, z };
    }
  }
  return null;
}

/** Rebuild the forecast: PRED_SLOTS entries of [x, y, z], one per engine slice. */
// One scratch ball and thirteen scratch triples, written over in place. This ran several times a
// tick and allocated fourteen objects each time -- and every reader of mp.pred consumes it inside
// the same tick it was built, so there is nothing alive to invalidate by writing over it.
const _pg = { bx: 0, by: 0, bz: 0, bvx: 0, bvy: 0, bvz: 0 };
export function meBallPredict(mp) {
  const g = _pg;
  g.bx = mp.bx; g.by = mp.by; g.bz = mp.bz; g.bvx = mp.bvx; g.bvy = mp.bvy; g.bvz = mp.bvz;
  const pred = mp.pred && mp.pred.length === PRED_SLOTS ? mp.pred : (mp.pred = []);
  const per = Math.round(ME_DT / BALL_SUB);
  for (let s = 0; s < PRED_SLOTS; s++) {
    if (s) for (let i = 0; i < per; i++) stepOnce(g);
    const a = pred[s] || (pred[s] = [0, 0, 0]);
    a[0] = g.bx; a[1] = g.by; a[2] = g.bz;
  }
}

// THE PITCH THE BALL IS ACTUALLY PLAYED ON. stepOnce takes ballDrag off the full 3D velocity every
// substep and then takes ballFric and ballFricLin off the horizontal velocity AGAIN while the ball
// is down in the grass, so a rolling ball really decelerates by
//     (ballDrag + ballFric) v^2 + ballFricLin
// Both closed forms below -- the one that decides how hard a pass is struck, and the one that says
// when it will arrive -- had that baked in as 0.04 and 1.6 while the integrator ran 0.070 and 2.1.
// The passer was aiming at a faster pitch than the ball was played on, and the arithmetic of being
// wrong by that much is brutal: a ball struck for a 15 m pass stopped at 14.9 m, one struck for 20 m
// stopped at 17.9, and one struck for 30 m stopped at 23.6 and never reached the man at all. Every
// ground pass beyond about twelve metres died in the lane in front of its receiver, which is where
// 83% of all possessions ended, why the 8-22 m pass completed at 66-78% against a real 84-89%, and
// why only 8.4% of moves starting in a side's own third ever reached the final third.
// One derivation, read off the constants, so the two can never disagree again.
export const meRollK = () => CFG.ballDrag + CFG.ballFric;      // the v^2 coefficient
export const meRollR = () => CFG.ballFricLin / meRollK();      // C/k -- the "40" that was hardcoded

// Initial speed for a ground pass that should ARRIVE at about CFG.passArrive m/s rather than die at
// the receiver's feet. Closed form of the rolling ODE d(v^2)/ds = -2(k v^2 + C):
//   v0^2 = (arrive^2 + C/k) * e^(2 k d) - C/k
// which also says the honest thing about ground passes: past some distance the required speed
// becomes absurd and the ball should be lofted instead. That emerges here rather than being a rule,
// and it moves when the pitch moves, which is the point of deriving it.
export function meGroundSpeed(d) {
  const a2 = CFG.passArrive * CFG.passArrive, k = meRollK(), r = meRollR();
  return Math.min(CFG.passMaxV, Math.sqrt(Math.max(36, (a2 + r) * Math.exp(2 * k * d) - r)));
}

/** The distance past which a ground pass CANNOT arrive: the launch the ODE above asks for exceeds
 *  passMaxV, so the ball is struck at the cap and dies short whatever the decision believed. This is
 *  the crossover to a lofted ball, and it belongs here rather than as the literal 26 that decide.ts
 *  used to carry -- it is about nineteen metres on these constants, so the whole 19 to 26 m band was
 *  a window of ground passes that physically could not get there, which is exactly the length a
 *  through ball is. It moves when the pitch moves, which is the point of deriving it. */
export function meGroundMaxD() {
  const a2 = CFG.passArrive * CFG.passArrive, k = meRollK(), r = meRollR();
  return Math.log((CFG.passMaxV * CFG.passMaxV + r) / (a2 + r)) / (2 * k);
}

// A lofted ball: pick a flight time from distance, split it into a launch. GF's HighPass power is
// NormalizedClamp(dist,0,60)^1.4 * 1.15 (AIfunctions.cpp:1063-1074); this parameterisation lands in
// the same place while staying in metres and seconds.
export function meLoftFor(d) {
  const T = CFG.highT0 + CFG.highTk * d;
  return { vxy: d / T * 1.12, vz: 4.905 * T, T };
}

/** Kick the real ball at (tx, ty). `type`: "ground" | "high" | "clear". Skill and pressure turn
 *  into execution noise -- the roll of the dice moved from the OUTCOME to the KICK, which is the
 *  whole point: whether a pass arrives is now geometry's problem. */
export function meKickBall(mp, rng, tx, ty, type, skill01, press, tempo) {
  const dx = tx - mp.bx, dy = ty - mp.by, d = Math.max(0.5, Math.hypot(dx, dy));
  const g2 = (r) => (r.u() + r.u() - 1);          // cheap gaussian-ish, [-1, 1], peaked at 0
  // HASTE COSTS ACCURACY, and this is where the engine already prices haste -- the aim cone widens
  // with pressure and with a worse passer, but not with how fast a side is trying to play. Without
  // it, quick tempo bought a firmer ball that arrived before the lane shut and cost nothing:
  // measured at +0.320 xG for Much Quicker, 3.3 standard errors, which is not an instruction but a
  // setting nobody would ever move off. Symmetric, so a patient side strikes it more precisely.
  const sigma = (CFG.passNoiseDeg + (1 - skill01) * CFG.passNoiseSkill + (press || 0) * CFG.passNoisePress
                 + (tempo || 0) * CFG.tempoNoise)
              * Math.PI / 180;
  const ang = Math.atan2(dy, dx) + g2(rng) * sigma;
  // WEIGHT is a skill. The aim cone always was, and the power wobble sat at a flat 0.08 for all
  // twenty-two -- but weight is the half of passing that actually separates levels: an under-hit
  // ball dies in the lane and belongs to whoever is standing there, however short his reach, and an
  // over-hit one runs through the receiver. Swept, the aim cone alone could not move completion at
  // the low bands at all (83% at slope 6 and 82% at slope 15) because a short recycling ball barely
  // misses at any angle. Anchored at 75 like every meTech site.
  const pow = 1 + g2(rng) * (CFG.powerNoise + (1 - skill01) * CFG.powerNoiseSkill);
  let vxy, vz;
  // TEMPO IS WEIGHT ON THE BALL. Playing quickly is not merely deciding sooner -- it is striking
  // it harder, so it arrives before the lane closes. That is a genuine trade rather than a bonus:
  // a firmer ball spends less time interceptable but `pow` noise scales with it, so it runs
  // through the receiver more often. A slow side plays it softer and safer into feet.
  const tmp = 1 + (tempo || 0) * CFG.tempoPace;
  if (type === "ground") { vxy = meGroundSpeed(d) * pow * tmp; vz = 0; }
  else if (type === "clear") {
    // Harder and flatter than any pass: solved at no less than clearMinD of carry, the launch
    // sped up by clearPow and the arc cut by clearFlat, so it sails past the man it was pointed
    // at and has to be chased. See the clearance block in config.ts.
    const L = meLoftFor(d);                    // the aim already carries clearMinD; see decide.ts
    vxy = L.vxy * CFG.clearPow * pow * tmp;
    vz = L.vz * CFG.clearFlat * (1 + g2(rng) * CFG.powerNoise * 0.5);
  }
  else { const L = meLoftFor(d); vxy = L.vxy * pow * tmp; vz = L.vz * (1 + g2(rng) * CFG.powerNoise * 0.5); }
  mp.bvx = Math.cos(ang) * vxy; mp.bvy = Math.sin(ang) * vxy; mp.bvz = vz;
  mp.bz = Math.max(mp.bz, CFG.ballR);
  meBallPredict(mp);
}

/** A shot: struck at a point IN the goal mouth, elevation solved for the flight, with a wider error
 *  cone than a pass. Nothing about the outcome is decided here -- the ball leaves his foot, and
 *  whether it is a goal, a save, the post or a corner is settled by where it actually goes. */
export function meShootBall(mp, rng, tx, ty, tz, skill01, press, elevMul, v0) {
  const dx = tx - mp.bx, dy = ty - mp.by, d = Math.max(1, Math.hypot(dx, dy));
  // A SHOT MISSES BECAUSE OF THE OCCASIONAL BAD ONE. Two uniforms summed is a triangle on
  // [-sigma, +sigma]: the largest error physically possible is exactly sigma and the typical one is
  // about a third of it, so the distribution has no tail at all. From 11-16 m -- where 46% of shots
  // are taken -- the aim point sits 2.1 m inside the post, which a triangular error cannot reach
  // even at three times the base cone. That is why widening the cone was swept twice, across 3x on
  // aim and 2.2x on elevation, and conversion never left 20-27%: the SHAPE was wrong, not the size.
  // A gaussian has the tail a real strike has. Clamped at three sigma so nothing goes into orbit.
  const g2 = (r) => {
    const u = Math.max(1e-9, r.u());
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r.u());
    return Math.max(-3, Math.min(3, z)) * CFG.shotSigma;
  };
  // How hard he hits it is normally a property of the man. A free kick is the exception: the pace is
  // part of the SOLUTION, because clearing a wall and staying under the bar is two constraints and
  // an ordinary strike only has room for one. See meFkArc.
  const v = v0 || (CFG.shotV0 + skill01 * CFG.shotVSkill);
  // Drag is NOT a second-order dip on a struck ball: quadratic drag at 0.015 costs a twenty-metre
  // shot a third of its speed, so solving the flight as d/v launched it too flat and it fell short.
  // Traced: a 20 m shot was down to 7 m/s and still three metres outside the six-yard box when the
  // keeper walked out and picked it up, which is why every shot from range converted at zero.
  // 1D quadratic drag integrates exactly: x(t) = ln(1 + k*v0*t)/k, so t(d) = (e^(k d) - 1)/(k v0).
  const T = (Math.exp(CFG.ballDrag * d) - 1) / (CFG.ballDrag * v);
  const vz = (tz - mp.bz) / T + 4.905 * T;
  const sigma = (CFG.shotNoiseDeg + (1 - skill01) * CFG.shotNoiseSkill + (press || 0) * CFG.shotNoisePress)
              * Math.PI / 180;
  const ang = Math.atan2(dy, dx) + g2(rng) * sigma;
  mp.bvx = Math.cos(ang) * v; mp.bvy = Math.sin(ang) * v;
  // ...and how badly he gets under it depends on WHO KICKED IT. This never consulted skill at all
  // while the lateral cone always did, so a 99-rated finisher ballooned a shot exactly as often as a
  // 20-rated one -- and a penalty, struck at full power over a short flight, went over the bar about
  // half the time. Mirrors the horizontal error: a floor everybody has, plus what he lacks in skill.
  // elevMul lets a SET strike keep its own accuracy. A penalty and an open-play shot are not the
  // same act -- one is a stationary, unpressured kick at a known spot -- and sharing one elevation
  // error meant that widening it to fix off-target in open play took penalty conversion from 74.7%
  // to 64.5% and put 5.5% of them off the frame.
  mp.bvz = vz + g2(rng) * CFG.shotElevErr * (elevMul === undefined ? 1 : elevMul)
                        * (1 - skill01 * CFG.shotElevSkill) * v * 0.12;
  mp.bz = Math.max(mp.bz, CFG.ballR);
  meBallPredict(mp);
}

/** A FREE KICK HAS TWO CONSTRAINTS AND EVERY OTHER STRIKE HAS ONE. It has to pass ABOVE the wall
 *  nine metres in front of the ball, and still be UNDER the bar at the goal line -- and satisfying
 *  both fixes the PACE as well as the angle, which is why a free kick from twenty metres is clipped
 *  and one from thirty is hit. That was never solved: the strike picked a target height at the goal
 *  between one metre and two, aimed a plain parabola at it, and the four men standing in front of it
 *  played no part in the arithmetic at all. Whether it cleared them was therefore the elevation
 *  error and nothing else -- measured, the ball passed the wall plane at 0.81 m at the tenth
 *  percentile and 3.74 m at the ninetieth, and 54% of every free kick in the game was struck into
 *  somebody's legs. Half of them into the wall and half of them over everything is not a technique,
 *  it is a coin toss.
 *
 *  Quadratic drag makes the time to cover s metres (e^(k s) - 1)/(k v), so the RATIO of the time to
 *  the wall and the time to the goal is a constant r that does not depend on how hard he hits it.
 *  Pinning z(t) = z0 + vz t - 4.905 t^2 at both ends then leaves one unknown:
 *      t_goal = sqrt( (z0 + (zWall - z0)/r - zGoal) / (4.905 (1 - r)) ),   v = B / t_goal
 *  Returns [zGoal, v] for meShootBall, which re-derives the same launch from the pair. */
export function meFkArc(d, z0, rng) {
  const zg = CFG.spFkZ + rng.u() * CFG.spFkZVar;
  const k = CFG.ballDrag, w = CFG.spWallDist, zw = CFG.bodyH + CFG.spFkWallJump;
  // Nothing to clear: from inside about thirteen metres the wall is standing on the goal line, and
  // once it is not comfortably nearer than the goal the solve has no answer anyway. v = 0 hands
  // meShootBall back its own pace and the strike is the ordinary one.
  if (d < w + CFG.spFkNear || zg >= zw) return [zg, 0];
  const A = (Math.exp(k * w) - 1) / k, B = (Math.exp(k * d) - 1) / k, r = A / B;
  const num = z0 + (zw - z0) / r - zg;
  if (r >= 1 || !(num > 0)) return [zg, 0];
  const t = Math.sqrt(num / (4.905 * (1 - r)));
  // ...and a man can only strike a dead ball so hard and so softly. Clamped, the two constraints
  // stop both being met and he hits the one he can: from close range that is a flatter ball into
  // the wall, which is exactly what a free kick from eighteen metres without any dip on it does.
  return [zg, Math.max(CFG.spFkVMin, Math.min(CFG.spFkVMax, B / t))];
}

/** A nudge rather than a kick: deflections, dispossessions, blocks. */
export function meKnock(mp, rng, tx, ty, speed, vz) {
  const dx = tx - mp.bx, dy = ty - mp.by, d = Math.max(0.3, Math.hypot(dx, dy));
  mp.bvx = dx / d * speed; mp.bvy = dy / d * speed; mp.bvz = vz || 0;
  mp.bz = Math.max(mp.bz, CFG.ballR);
  meBallPredict(mp);
}
