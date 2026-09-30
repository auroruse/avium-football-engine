// THE PASS: where it is played, how hard, and how hard it is to strike -- solved with the same
// physics the ball and the man will then obey, so the ball that is chosen is the ball that happens.
//
// A ball into space used to be a lead guessed from the receiver's top speed times the flight to a
// point fourteen metres up his run, struck at the firm pace of a ball to feet. A runner parked on the
// defensive line was taken to be sprinting already, the ball arrived at twelve metres a second, and it
// ran on past him to the keeper: through balls were "short or behind him" because they were aimed at
// a man who did not exist. Here the meeting is found: where he will actually be -- from where he is,
// at the pace he is going, turning and building speed at the rate his legs allow -- at the moment a
// ball struck now gets there, weighted so it arrives running into his path.
import { CFG, ME_DT } from "./config";
import { meGroundSpeed, meLoftT } from "./ball";
import { PITCH_L, PITCH_W, meGroundT } from "./geometry";

/** WHERE HE WILL BE, and how fast he will be going: a man at (x, y) moving (vx, vy) m/s who runs along
 *  (ux, uy) at vd m/s, t seconds on. His velocity comes round toward u*vd at the rate meMove moves him
 *  -- accel per slice, less turnPenalty of it for the part of the turn that is a reversal -- so
 *  v(t) = u vd + (v0 - u vd) e^(-t/tau). Returns [x, y, vx, vy]. Same law as the touch's onHisWay. */
export function meRunAt(x, y, vx, vy, ux, uy, vd, t) {
  const v0 = Math.hypot(vx, vy);
  const cosA = v0 > 0.3 ? (vx * ux + vy * uy) / v0 : 1;
  const acc = Math.min(0.95, CFG.accel * (1 - CFG.turnPenalty * Math.max(0, -cosA)));
  const tau = -ME_DT / Math.log(1 - acc), e = Math.exp(-t / tau), k = tau * (1 - e);
  return [x + ux * vd * t + (vx - ux * vd) * k, y + uy * vd * t + (vy - uy * vd) * k,
          ux * vd + (vx - ux * vd) * e, uy * vd + (vy - uy * vd) * e];
}

const onPitch = (x, y, m) => x >= m && x <= PITCH_L - m && y >= m && y <= PITCH_W - m;

// The meeting, by bisection on its time: f(t) is how late a ball struck now would reach the spot he
// will be on at t. Early meetings have the ball late (he is still near, it has to travel), late ones
// have it early (he has run on, it is quicker than him), and the root is the one ball that arrives
// with him. No root inside [lo, hi] means there is no such ball: he is close enough that it is a ball
// to his feet, or so far on that nothing a boot can strike will catch him.
function meet(at, lo, hi) {
  if (at(lo).f <= 0) return null;
  let b = at(hi);
  if (b.f > 0) return null;
  let bt = hi;
  for (let it = 0; it < 22; it++) {
    const m = (lo + hi) / 2, c = at(m);
    if (c.f > 0) lo = m; else { hi = m; b = c; bt = m; }
  }
  if (!onPitch(b.ax, b.ay, 1.5)) return null;
  b.t = bt;
  return b;
}

/** A BALL ALONG THE GROUND INTO HIS STRIDE, from (sx, sy) to a man at (qx, qy) moving (qvx, qvy) m/s who
 *  will run along (ux, uy) at vd. THE WEIGHT is the half of a through ball that decides it: rolled to
 *  arrive at his own pace along its line plus thruOver, it runs into his path and he takes it in his
 *  stride -- softer and he has to check for it, firmer and it is past him to the keeper.
 *  Returns { ax, ay, va, d, t } -- aim, arrival pace, length and the time it meets him -- or null. */
export function meMeetGround(sx, sy, qx, qy, qvx, qvy, ux, uy, vd) {
  return meet((t) => {
    const [ax, ay, rvx, rvy] = meRunAt(qx, qy, qvx, qvy, ux, uy, vd, t);
    const dx = ax - sx, dy = ay - sy, d = Math.hypot(dx, dy) || 0.1;
    const va = Math.max(CFG.thruVaMin, Math.min(CFG.thruVaMax, (rvx * dx + rvy * dy) / d + CFG.thruOver));
    // A ball that needs more than a boot can give it arrives late whatever it is aimed at.
    const tb = meGroundSpeed(d, va) >= CFG.passMaxV - 1e-6 ? Infinity : meGroundT(d, d, va);
    return { ax, ay, va, d, f: tb - t };
  }, CFG.meetTMin, CFG.meetTMax);
}

/** A BALL IN THE AIR INTO HIS PATH, of kind `kind` (CFG.loftK): landing, or arriving at its height,
 *  `early` seconds before he gets to the spot. Over the top that is the ball dropping just in front of
 *  him so it is bouncing into his stride; a cross is met as it arrives. Returns { ax, ay, d, t } or null. */
export function meMeetLoft(sx, sy, qx, qy, qvx, qvy, ux, uy, vd, kind, early) {
  return meet((t) => {
    const [ax, ay] = meRunAt(qx, qy, qvx, qvy, ux, uy, vd, t);
    const d = Math.hypot(ax - sx, ay - sy);
    return { ax, ay, d, f: meLoftT(d, kind) - (t - early) };
  }, CFG.meetTMin + early, CFG.meetTMax + early);
}

/** HOW HARD A BALL IS TO STRIKE, and nothing for one he has stopped. A first-time ball, or one still
 *  rolling off his last touch, is harder to place by how hard it is coming at him, how high it is, how
 *  far he has to turn it -- back the way it came or on the way it was going is a side-foot, square
 *  across it is not -- and whether somebody is on him while he does it. (bvx, bvy) is the ball's
 *  pace and bz its height, (pvx, pvy) his in m/s, (ox, oy) the way he means to send it, `near` the
 *  nearest opponent. The same number widens the kick (meKickBall) and lowers the skill the decision
 *  believes he has (decide.ts), so what he chooses already knows how hard it will be. */
export function mePassExecD(bvx, bvy, bz, pvx, pvy, ox, oy, near) {
  const vrel = Math.hypot(bvx - pvx, bvy - pvy);
  const mv = Math.min(1, vrel / CFG.exVEasy);                 // a ball moving with him is a ball at rest
  const bv = Math.hypot(bvx, bvy), ol = Math.hypot(ox, oy) || 1;
  const redir = bv > 1 ? 1 - Math.abs((bvx * ox + bvy * oy) / (bv * ol)) : 0;
  const air = bz > 0.3 ? Math.min(1, (bz - 0.3) / 0.8) : 0;
  const press = Math.max(0, Math.min(1, 1 - (near - 1) / CFG.exPressR));
  return mv * (CFG.exD0 + CFG.exDa * redir + CFG.exDp * press)
       + CFG.exDv * Math.max(0, Math.min(1.5, (vrel - CFG.exVEasy) / CFG.exVSpan)) + CFG.exDz * air;
}
