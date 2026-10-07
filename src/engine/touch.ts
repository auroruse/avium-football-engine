// THE TOUCH: the first one, and every one after it while he runs with the ball.
//
// Both are PLACEMENTS. A footballer does not push the ball at his own pace plus a constant; he puts it
// where he means to meet it next -- at his feet with a man on him, a stride ahead in traffic, into
// the space when there is some -- and how precisely he manages that is his touch. So each touch here
// chooses a line and a lead, solves the pace that puts the ball there on this grass, and then misses
// by an amount that depends on how hard the ball was to take and how good he is.
//
// It replaced a steering force: every substep the dribbler pulled the ball toward a point a stride in
// front of him, but the pull only worked inside 0.70 m and he was frozen for the whole slice while the
// ball moved, so the ball rolled free most of the time on whatever line it last had. On the old heavy
// pitch it died before it got far; on real grass it ran over the touchline with nobody near him.
import { CFG, ME_DT } from "./config";
import { meAttrs, meBadgeFx, mePassBadge, meSpeed, meTech } from "./attributes";
import { PITCH_L, PITCH_W, meOther } from "./geometry";

// First touch and close control. See ME_TILT.touch.
export const meTouchTech = (p) => meTech(meAttrs(p).touch);

// How fast a rolling ball is slowing at v m/s: the air drag on it plus the grass (see stepOnce).
export const meRollDecel = (v) => (CFG.ballDrag + CFG.ballFric) * v * v + CFG.ballFricLin;

/** The pace over his own that puts the ball L metres ahead of him at its furthest. Struck d faster
 *  than he is running and slowing at a while he holds his pace, it leads him by d t - a t^2 / 2, which
 *  peaks at d^2 / 2a -- so d = sqrt(2 a L). The slowing is read at the pace it leaves his foot. */
export function meTouchPace(v, L) {
  if (!(L > 0)) return 0;
  let d = Math.sqrt(2 * meRollDecel(v + 1) * L);
  d = Math.sqrt(2 * meRollDecel(v + d) * L);
  return d;
}

/** The pace that rolls a ball D metres in T seconds on this grass -- or, if it would get there with
 *  time to spare, the pace that rolls it to rest there. Slowing at a, D = s T - a T^2 / 2. */
export function meRollPace(D, T) {
  if (!(D > 0)) return 0;
  let a = meRollDecel(D / T), s = D / T + a * T / 2;
  a = meRollDecel(s); s = D / T + a * T / 2;
  return D / T < a * T / 2 ? Math.sqrt(2 * meRollDecel(Math.sqrt(2 * a * D)) * D) : s;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// WHERE HE WILL BE T seconds on, and which way he will be facing. He cannot turn on a sixpence: his
// velocity comes round from where it is toward `vd` along the line he wants at the rate his legs
// allow -- the same rate meMove moves him at, accel per slice, less turnPenalty of it for every bit of
// the turn that is a reversal -- so v(t) = u vd + (v0 - u vd) e^(-t/tau). A touch aimed where he would
// be had he already turned is a ball he runs past, and one aimed along his old run when he means to
// come back is a ball he runs away from; this is both, answered by his own momentum.
function onHisWay(px, py, pvx, pvy, ux, uy, vd, T) {
  const v0 = Math.hypot(pvx, pvy);
  const cosA = v0 > 0.3 ? (pvx * ux + pvy * uy) / v0 : 1;
  const acc = Math.min(0.95, CFG.accel * (1 - CFG.turnPenalty * Math.max(0, -cosA)));
  const tau = -ME_DT / Math.log(1 - acc), e = Math.exp(-T / tau), k = tau * (1 - e);
  const hx = ux * vd + (pvx - ux * vd) * e, hy = uy * vd + (pvy - uy * vd) * e, hl = Math.hypot(hx, hy);
  return [px + ux * vd * T + (pvx - ux * vd) * k, py + uy * vd * T + (pvy - uy * vd) * k,
          hl > 0.1 ? hx / hl : ux, hl > 0.1 ? hy / hl : uy];
}
/** THE TOUCH ITSELF: the velocity that keeps the ball with him, plus the push that puts it ahead.
 *  The keeping part aims it at a boot's length in front of where he will be T seconds on and strikes
 *  it at the pace that gets it there on this grass -- which is his own average pace over those
 *  seconds, so it travels WITH him. The push is meTouchPace(L) along the way he will be facing: the
 *  knock into space, which he then runs onto. The first cut folded the lead into the meeting point
 *  instead, and a metre and a half of lead over half a second is three metres a second of excess:
 *  the ball arrived where he would be still going far quicker than he was, and ran on over the line. */
function touchVel(s, p, px, py, pvx, pvy, ux, uy, near, T, L) {
  // A KEEPER WITH IT AT HIS FEET STOPS IT. Touched like a dribbler's -- a stride on, at his running pace
  // -- the ball stayed out of the reach he can play it from, so he never had to part with it: traced,
  // one took a throw-in in his area and chased his own touches twelve metres up the pitch into a
  // striker. He means to stand still with it, so it is played to where he stops, with no push.
  const gkF = p.pos === "GK";
  if (gkF) L = 0;
  const mp = s.mePos, m = CFG.touchEdge, vd = gkF ? 0 : dribPace(p, near);
  const [wx, wy, hx, hy] = onHisWay(px, py, pvx, pvy, ux, uy, vd, T);
  // WHERE HE WILL BE IS NOT ALWAYS ON THE PITCH. His momentum can carry him at the line, and he is
  // held half a metre inside it while the ball is not -- so the meeting point is kept touchEdge inside
  // every line, and the ball waits there for a man who has to turn to reach it.
  const mx = Math.max(m, Math.min(PITCH_L - m, wx + hx * CFG.dribBehindD));
  const my = Math.max(m, Math.min(PITCH_W - m, wy + hy * CFG.dribBehindD));
  const dx = mx - mp.bx, dy = my - mp.by, dist = Math.hypot(dx, dy);
  const keep = meRollPace(dist, T);
  let vx = dist > 0.01 ? dx / dist * keep : 0, vy = dist > 0.01 ? dy / dist * keep : 0;
  // The push, only as much as there is grass for: the lead point stays on the pitch too.
  let Lp = L;
  while (Lp > 0.05 && (mx + hx * Lp < m || mx + hx * Lp > PITCH_L - m || my + hy * Lp < m || my + hy * Lp > PITCH_W - m)) Lp *= 0.6;
  const push = Lp > 0.05 ? meTouchPace(Math.hypot(vx, vy), Lp) : 0;
  vx += hx * push; vy += hy * push;
  let sp = Math.hypot(vx, vy);
  if (sp < 0.01) return [0, 0];
  // NEVER FASTER THAN HE MEANS TO RUN WITH IT, plus the push. A ball struck at his pace plus a push, at
  // a man already flat out, sat a metre and a half in front of him until it reached the touchline;
  // capped at his top pace instead, it ran far enough ahead that he could sprint after it, the next
  // touch was struck at the sprint, and the whole league dribbled at seven metres a second, away
  // from everybody pressing it. His carrying pace, dribCapV over it at most, and whatever push he chose.
  sp = Math.min(sp, vd * CFG.dribCapV + push);
  // Kept on the pitch, as a plan: where it is going to roll before he is back on it.
  const [kx, ky] = keepIn(mp.bx, mp.by, vx / Math.hypot(vx, vy), vy / Math.hypot(vx, vy), sp * CFG.touchLook + Lp);
  return [kx * sp, ky * sp];
}

// How fast he means to go with it: his carrying pace in the open, dribCloseV of it with a man on him.
// (_dribV is the second brain slowing him down to shield it; the first brain never sets it.)
const dribPace = (p, near) => meSpeed(meAttrs(p), p.stamina) * CFG.carrySpeed * (near < CFG.touchPressR ? CFG.dribCloseV : 1) * (p._dribV || 1);
const gauss = (rng) => {
  const u = Math.max(1e-9, rng.u());
  return Math.max(-3, Math.min(3, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.u())));
};

// The nearest opponent to (x, y), keepers included -- a keeper on you is as much a man on you as a
// centre-half is.
export function meTouchNear(s, side, x, y) {
  let d = Infinity;
  for (const q of s.players[meOther(side)] || []) {
    if (!q || q.off) continue;
    const e = Math.hypot(q.x - x, q.y - y);
    if (e < d) d = e;
  }
  return d;
}

// Room in front along (ux, uy): the nearest opponent inside a 45-degree cone either side of the line,
// capped at 25 m. This is what decides whether he knocks it on or keeps it close.
function roomAhead(s, side, x, y, ux, uy) {
  let d = 25;
  for (const q of s.players[meOther(side)] || []) {
    if (!q || q.off) continue;
    const dx = q.x - x, dy = q.y - y, e = Math.hypot(dx, dy);
    if (e < 0.01 || e >= d) continue;
    if ((dx * ux + dy * uy) / e > Math.SQRT1_2) d = e;
  }
  return d;
}

/** THE LINE IS PART OF THE PLAN. A touch is aimed so that where the ball is going to roll stays
 *  touchEdge inside every line: first by turning it in, the smallest turn that does it, and failing
 *  that by playing it shorter. Only the PLAN is kept in -- the execution error is added afterwards, so
 *  a bad touch can still put it out, which is the only way a ball should go out off a man's own feet. */
function keepIn(bx, by, ux, uy, dist) {
  const m = CFG.touchEdge;
  const inside = (x, y) => x >= m && x <= PITCH_L - m && y >= m && y <= PITCH_W - m;
  if (inside(bx + ux * dist, by + uy * dist)) return [ux, uy];
  const a0 = Math.atan2(uy, ux);
  for (let k = 1; k <= 12; k++) for (const sg of [1, -1]) {
    const a = a0 + sg * k * Math.PI / 24, vx = Math.cos(a), vy = Math.sin(a);
    if (inside(bx + vx * dist, by + vy * dist)) return [vx, vy];
  }
  // Pinned in a corner, where no line of that length stays on the grass: straight at the middle.
  const cx = PITCH_L / 2 - bx, cy = PITCH_W / 2 - by, cl = Math.hypot(cx, cy) || 1;
  return [cx / cl, cy / cl];
}

// How far ahead he wants it: at his feet with a man on him, otherwise a share of the room in front.
// ...and never so far that the nearest man anywhere, not just the one in front, can step across it:
// touchLeadNear of his distance at most.
function leadFor(s, side, x, y, ux, uy, near) {
  if (near < CFG.touchPressR) return CFG.touchCloseL;
  return clamp(Math.min(CFG.touchLeadK * roomAhead(s, side, x, y, ux, uy), CFG.touchLeadNear * near),
               CFG.touchLeadMin, CFG.touchLeadMax);
}

/** THE FIRST TOUCH. He is at (px, py) moving at (pvx, pvy) m/s, the ball has come within his reach
 *  (`reach` m) at height z, and he wants it on the line `uAng`.
 *  Returns { ok, vx, vy, ang, D }: ok false is a miscontrol and (vx, vy) is how it comes off him.
 *
 *  HOW HARD IT IS decides everything, and skill decides how much of that difficulty gets through. The
 *  failure chance goes with the SQUARE of the difficulty and a steep power of what he lacks, which is
 *  the big gap: the elite lose an ordinary ball almost never and a hard one now and then, while a poor
 *  touch is in trouble on anything firm, awkward or contested. */
export function meFirstTouch(s, rng, side, p, px, py, pvx, pvy, z, reach, uAng) {
  const mp = s.mePos, ts = meTouchTech(p);
  const vin = Math.hypot(mp.bvx, mp.bvy);
  const bdx = vin > 0.1 ? mp.bvx / vin : Math.cos(uAng), bdy = vin > 0.1 ? mp.bvy / vin : Math.sin(uAng);
  const near = meTouchNear(s, side, px, py);
  const ux = Math.cos(uAng), uy = Math.sin(uAng);
  // Its pace AGAINST HIM: a ball rolled into his stride is easy at any speed, one driven at his chest
  // is not.
  const vrel = Math.hypot(mp.bvx - pvx, mp.bvy - pvy);
  // Off the grass: the higher and the faster it is dropping, the harder it is to kill.
  const air = z > CFG.ftChestZ ? clamp((z - CFG.ftChestZ) / 1.1, 0, 1) * 0.6 + clamp(-mp.bvz / 8, 0, 1) * 0.4
                               : clamp(-mp.bvz / 8, 0, 1) * 0.3;
  // THE STRETCH is how far to his side the ball's line runs, not how far away it was when it came
  // within reach -- the contest meets it at the edge of his reach every time, and a ball rolled
  // straight at him is no stretch at all however far out he first touches it.
  const rvx = mp.bvx - pvx, rvy = mp.bvy - pvy, rv = Math.hypot(rvx, rvy);
  const ox = mp.bx - px, oy = mp.by - py;
  const stretch = clamp((rv > 0.5 ? Math.abs(ox * rvy - oy * rvx) / rv : Math.hypot(ox, oy)) / Math.max(0.1, reach), 0, 1);
  // THE TURN is his body, not the ball: from the way he is facing -- his run if he is running, the
  // ball if he is not -- to the way he wants to go. Taking a ball on in his stride costs nothing;
  // standing with his back to the line he wants and turning with it is the hard one.
  const pv = Math.hypot(pvx, pvy);
  const fx = pv > 1.5 ? pvx / pv : -bdx, fy = pv > 1.5 ? pvy / pv : -bdy;
  const turn = (1 - (fx * ux + fy * uy)) / 2;
  const press = clamp(1 - (near - 1) / CFG.ftPressR, 0, 1);
  // Turning is only hard with somebody there to turn into: ftTurnLo of it with nobody near.
  const turnD = turn * (CFG.ftTurnLo + (1 - CFG.ftTurnLo) * press);
  let D = CFG.ftD0 + CFG.ftDv * clamp((vrel - CFG.ftVEasy) / CFG.ftVSpan, 0, 1.5) + CFG.ftDz * air
          + CFG.ftDs * stretch * stretch + CFG.ftDt * turnD + CFG.ftDp * press;
  // INTO THE RIGHT FOOT (badges: crisp). A ball of his kind from a passer known for it arrives the way the receiver
  // wants it, and is that much easier to take.
  const kb = mp.kickBy?.[0], pk = mp._passK;
  if (kb && kb.s === side && pk) {
    const by = s.players[side]?.[kb.i];
    if (by && by !== p) { const cr = meBadgeFx(by).crisp; if (cr && mePassBadge(by, pk.k, pk.d, pk.high) > 0) D *= 1 - cr; }
  }
  const pf = Math.min(CFG.ftFailMax, CFG.ftFailK * D * D * Math.pow(Math.max(0, 1 - CFG.ftFailTech * ts), 1.5));
  if (rng.u() < pf) {
    const a = Math.atan2(bdy, bdx) + (rng.u() - 0.5) * 2 * CFG.ftMissArc;
    const sp = vin * (CFG.ftMissV0 + (CFG.ftMissV1 - CFG.ftMissV0) * rng.u());
    return { ok: false, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, D };
  }
  // The plan: the ball a lead in front of where he will be when he next plays it, on this line, at
  // the pace that gets it there on this grass -- the same meeting point the dribble aims at, so the
  // first touch and the run that follows it are one movement.
  const L = leadFor(s, side, mp.bx, mp.by, ux, uy, near);
  const T = near < CFG.touchPressR ? CFG.dribTClose : CFG.ftT;
  const [vx, vy] = touchVel(s, p, px, py, pvx, pvy, ux, uy, near, T, L);
  // ...and the execution. The weight error is the heavy touch: a ball struck harder than he meant.
  const eA = gauss(rng) * D * (CFG.ftAng0 + CFG.ftAngTech * Math.max(0, 1 - ts) ** 2);
  const eW = gauss(rng) * D * (CFG.ftW0 + CFG.ftWTech * Math.max(0, 1 - ts) ** 2);
  const sp = Math.hypot(vx, vy) * Math.max(0.2, 1 + eW);
  const a = (sp > 0.01 ? Math.atan2(vy, vx) : uAng) + eA;
  return { ok: true, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, D };
}

/** A DRIBBLE TOUCH, played when the ball comes back to his feet. It is aimed at WHERE HE WILL BE when
 *  he next plays it -- a boot's length in front of him on his line, T seconds on -- so every touch pulls
 *  a ball that has strayed off his path back onto it. The first version pushed it along his line at his
 *  own pace plus a lead, from wherever it happened to be: a ball half a metre to his side stayed half a
 *  metre to his side at exactly his pace, just outside the reach that triggers the next touch, and for
 *  most of a second it belonged to whichever defender stepped across it. T is short in traffic and
 *  longer with room in front, which is the difference between close control and knocking it on.
 *  Nothing here fails outright; a bad dribble touch is simply too long or off his line, and whoever
 *  gets to it first has it. */
export function meDribbleTouch(s, rng, side, p, px, py, pvx, pvy) {
  const mp = s.mePos, ts = meTouchTech(p);
  const v = Math.hypot(pvx, pvy);
  const uA = p._drbA != null ? p._drbA
           : v > 0.3 ? Math.atan2(pvy, pvx) : Math.atan2(mp.by - py, mp.bx - px);
  const ux = Math.cos(uA), uy = Math.sin(uA);
  const near = meTouchNear(s, side, px, py);
  const bv = Math.hypot(mp.bvx, mp.bvy);
  const turn = bv > 0.5 ? (1 - (mp.bvx * ux + mp.bvy * uy) / bv) / 2 : 0;
  const press = clamp(1 - (near - 1) / CFG.drPressR, 0, 1);
  const D = CFG.drD0 + CFG.drDv * Math.min(1, v / CFG.drVSpan) + CFG.drDp * press + CFG.drDt * turn;
  // A KNOCK PAST A MAN (the second brain's dribbler, _knockL): the ball goes into the space beyond him,
  // further than any touch kept under control would, and he runs onto it. The first brain never sets it.
  const knock = p._knockL > 0;
  const T = knock ? CFG.dribTMax : near < CFG.touchPressR ? CFG.dribTClose
          : clamp(CFG.dribTK * roomAhead(s, side, px, py, ux, uy), CFG.dribTMin, CFG.dribTMax);
  const L = knock ? p._knockL : near < CFG.touchPressR ? CFG.touchCloseL : leadFor(s, side, mp.bx, mp.by, ux, uy, near);
  const [vx, vy] = touchVel(s, p, px, py, pvx, pvy, ux, uy, near, T, L);
  const eA = gauss(rng) * D * (CFG.drAng0 + CFG.drAngTech * Math.max(0, 1 - ts) ** 2);
  const eW = gauss(rng) * D * (CFG.drW0 + CFG.drWTech * Math.max(0, 1 - ts) ** 2);
  const sp = Math.hypot(vx, vy) * Math.max(0.3, 1 + eW);
  const a = (sp > 0.01 ? Math.atan2(vy, vx) : uA) + eA;
  return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, D };
}
