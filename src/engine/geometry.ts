// The pitch, and every spatial question asked about it.
import { CFG } from "./config";
import { meGroundSpeed, meRollK, meRollR } from "./ball";

export const PITCH_L = 105, PITCH_W = 68, ME_HALF_W = PITCH_W / 2, ME_GOAL_W = 7.32;

// One world frame. Home attacks +x, away attacks -x; every function that cares asks meGoalX.
export const ME_SIDES = ["home", "away"];

export const meGoalX = (side) => side === "home" ? PITCH_L : 0;

export const meOther = (side) => side === "home" ? "away" : "home";

export const meDir = (side) => side === "home" ? 1 : -1;

// Value of holding the ball at a point, 0..1 -- a stand-in for a trained xT grid. Only the shape
// matters: it climbs steeply toward the goal being attacked and falls off toward the touchlines, so
// every decision below can be scored as "does this end up somewhere worth more than here".
// Probability this possession yields a goal from here. Scaled to reality: a possession starting in
// midfield is worth a few percent, one in the six-yard box a good deal more. The old surface sat at
// 0.44 in midfield, which flattened every option to about the same score and made the choice random.
// A STRETCHED exponential, not a plain one. exp(-d/13) halves the value of a position every nine
// metres AT EVERY DISTANCE EQUALLY, and that is wrong at both ends of the pitch. In midfield it says
// carrying eight metres forward nearly doubles what you are worth, which is why a shooter received
// the ball 27 m out and struck it at 12, walking through a defence rather than passing through it.
// Near goal it says the opposite: getting from eleven metres into the six-yard box is worth barely
// more than the same eight metres gained at halfway, so nobody works for the close chance and the
// engine took 19% of its shots from inside eleven metres against a real 38%.
// Real possession value is steep in front of goal and nearly flat a long way from it. exp(-(d/L)^p)
// with p below 1 is exactly that shape: at p = 0.7 the gradient over the last six metres is a fifth
// steeper than it was and the gradient from 25 m to 17 m is a quarter shallower. Same value at
// d = L either way, so the surface is pinned where it was calibrated and only its shape moves.
// valP = 1 reproduces the old surface exactly, so this is sweepable rather than a rewrite.
export function meVal(side, x, y) {
  const d = Math.hypot(meGoalX(side) - x, (y - ME_HALF_W) * 1.35);
  return 0.26 * Math.exp(-Math.pow(d / 13, CFG.valP));
}

// meVal in goal-probability units peaks at 0.26, so anything that wants "how dangerous is this, 0 to
// 1" has to normalise. Marking read the raw number, and when meVal was rescaled its threshold and
// its tightness silently went with it -- the back line stopped marking outside twelve metres.
export const ME_VAL_MAX = 0.26;

export const meDanger = (side, x, y) => meVal(side, x, y) / ME_VAL_MAX;

// What a spot is worth once you account for who is standing on it. meVal is pure geometry: it says a
// ball ten metres from goal is worth 0.12 whether the six-yard box is empty or has five defenders in
// it. That is why running at goal outscored striking it from every range on the pitch -- a carry was
// credited with the full possession value of wherever it ended up, for free -- and why every chance
// in the match was a tap-in walked into the six-yard box.
export const meValHere = (s, side, x, y) => {
  const base = meVal(side, x, y) * (1 - Math.min(CFG.valPressMax, mePressure(s, side, x, y) * CFG.valPress));
  // WHERE THE SPACE IS. Everything above is local: meVal is pure geometry and mePressure counts
  // bodies inside six metres. So a defensive SHAPE twenty metres away was invisible to every
  // decision in the game -- the ground behind a high line scored exactly as the ground behind a deep
  // block, a low block cost nothing to approach, and a press was felt at the ball and never as a
  // thing to play around. Measured consequence: across five archetypes the real matchup interaction
  // came out 0.000 against a ladder spread of 0.254. No style was ever the answer to another one.
  // meCtrl is the missing term and it was already written -- pitch control, positive when this side
  // owns the spot -- sitting in this file with no callers at all. One weight, and all three classic
  // counters follow from the same quantity: space in behind a high line, space wide of a narrow
  // block, space beyond a press.
  return CFG.valCtrlW ? base * (1 + CFG.valCtrlW * meCtrl(s, side, x, y)) : base;
};

// ---- pitch control -------------------------------------------------------------------------
// After Fernandez & Bornn: every player owns an area of the pitch, stretched along the way he is
// running and widened the further he is from the ball. Sum the two sides and you have a number for
// "who would get there first", which is the only honest way to score a place to stand.
export function meInfluence(p, x, y, ballDist) {
  const dx = x - p.x, dy = y - p.y;
  // Reach grows with distance from the ball -- close to it you control almost nothing but your feet.
  const r = 4.5 + Math.min(1, ballDist / 55) * 9.5;
  const sp = Math.hypot(p.vx || 0, p.vy || 0);
  let along = dx, across = dy;
  if (sp > 0.02) {                                   // rotate into his direction of travel
    const ux = p.vx / sp, uy = p.vy / sp;
    along = dx * ux + dy * uy; across = -dx * uy + dy * ux;
  }
  const stretch = 1 + Math.min(1.1, sp * 3.4);       // an ellipse pulled out in front of him
  const a = along / (r * stretch), b = across / r;
  return Math.exp(-(a * a + b * b));
}

// Positive means this side owns the space, negative means the opposition does.
export function meCtrl(s, side, x, y) {
  const mp = s.mePos, bd = Math.hypot(x - mp.bx, y - mp.by);
  let us = 0, them = 0;
  for (const p of s.players[side]) if (p.pos !== "GK") us += meInfluence(p, x, y, bd);
  for (const q of s.players[meOther(side)]) if (q.pos !== "GK") them += meInfluence(q, x, y, bd);
  return (us - them) / (us + them + 0.35);
}

// ---- the team's influence map --------------------------------------------------------------
// Scoring candidate points one at a time answers "is this spot free". It cannot answer the question
// that actually matters -- would standing here open the pitch for the SIDE -- because that needs the
// aggregate. A coarse grid, rebuilt a few times a second, is enough to see it.
export const ME_GRID_X = 15, ME_GRID_Y = 10, ME_MAP_STRIDE = 6;

export const meCellX = (i) => (i + 0.5) * PITCH_L / ME_GRID_X;

export const meCellY = (j) => (j + 0.5) * PITCH_W / ME_GRID_Y;

export function meBuildMap(s, side) {
  const mp = s.mePos;
  let m = mp.map[side];
  if (!m) m = mp.map[side] = new Float32Array(ME_GRID_X * ME_GRID_Y);
  for (let j = 0; j < ME_GRID_Y; j++) for (let i = 0; i < ME_GRID_X; i++)
    m[j * ME_GRID_X + i] = meCtrl(s, side, meCellX(i), meCellY(j));
  return m;
}

// How much of the pitch this side would newly own by putting a man here. Cells we already control
// score nothing, which is what stops everybody crowding the same good area.
export function meSpaceGain(s, side, x, y) {
  const m = s.mePos.map[side]; if (!m) return 0;
  const mp = s.mePos, bd = Math.hypot(x - mp.bx, y - mp.by);
  const ghost = { x, y, vx: 0, vy: 0 };
  let gain = 0;
  const i0 = Math.max(0, Math.floor((x - 14) / PITCH_L * ME_GRID_X)), i1 = Math.min(ME_GRID_X - 1, Math.ceil((x + 14) / PITCH_L * ME_GRID_X));
  const j0 = Math.max(0, Math.floor((y - 14) / PITCH_W * ME_GRID_Y)), j1 = Math.min(ME_GRID_Y - 1, Math.ceil((y + 14) / PITCH_W * ME_GRID_Y));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const c = m[j * ME_GRID_X + i];
    if (c > 0.30) continue;                                    // already ours; nothing to win
    const inf = meInfluence(ghost, meCellX(i), meCellY(j), bd);
    gain += inf * (0.30 - c);
  }
  return gain;
}

// Opponents sitting in a passing lane. Perpendicular distance to the line, only counting those
// actually between the two players -- this is what makes a direct ball into a packed box fail.
export function meLaneBlock(s, side, x0, y0, x1, y1, airborne) {
  const opp = s.players[meOther(side)], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  let blk = 0;
  for (const q of opp) {
    const t = ((q.x - x0) * dx + (q.y - y0) * dy) / (L * L);
    if (t <= 0.02 || t >= 0.98) continue;
    // A lofted ball is only interceptable near its endpoints -- nobody wins a ball sailing five
    // metres over his head (GF HighPass: only u < 0.2 or u > 0.65 count, elizacontroller.cpp:1008-1060).
    if (airborne && t > 0.2 && t < 0.65) continue;
    const px = x0 + dx * t, py = y0 + dy * t, perp = Math.hypot(q.x - px, q.y - py);
    if (perp < 4.5) blk += (4.5 - perp) / 4.5 * (q.pos === "GK" ? 0.4 : q._duty === "intercept" ? CFG.interceptW : 1);
  }
  return blk;
}

// How hard the man on the ball is being closed down: everyone within 6m, weighted by how close.
export function mePressure(s, side, x, y) {
  const opp = s.players[meOther(side)]; let pr = 0;
  for (const q of opp) { const d = Math.hypot(q.x - x, q.y - y); if (d < 6) pr += (6 - d) / 6; }
  return pr;
}

// ---- shooting ---------------------------------------------------------------------------
// Geometry first: how far out, and how much of the goal can he actually see. Then the finisher,
// then the keeper. Three absolute numbers, no team anywhere.
export function meShotGeom(side, x, y) {
  const gx = meGoalX(side), dx = Math.abs(gx - x), dy = y - ME_HALF_W;
  const d = Math.hypot(dx, dy);
  // Angle the goal subtends from here. Dead in front of an open goal this is wide; from the byline
  // it collapses to nothing, which is why cut-backs beat shots from the corner of the six-yard box.
  const ang = Math.atan2(ME_GOAL_W * dx, dx * dx + dy * dy - (ME_GOAL_W / 2) * (ME_GOAL_W / 2)) || 0;
  return { d, ang: ang < 0 ? ang + Math.PI : ang };
}

// The offside line: the second-deepest OUTFIELD opponent. The keeper has to be excluded explicitly
// -- he is almost always the deepest, so counting him made "second deepest" mean "deepest defender",
// which put the line ten metres too high.
export function meOffsideLine(s, side) {
  const opp = s.players[meOther(side)], dir = meDir(side), gx = meGoalX(side);
  let d1 = -Infinity, d2 = -Infinity;
  for (const q of opp) { if (q.pos === "GK") continue;
    const v = q.x * dir; if (v > d1) { d2 = d1; d1 = v; } else if (v > d2) d2 = v; }
  const line = d2 === -Infinity ? gx : d2 * dir;
  return dir > 0 ? Math.max(PITCH_L / 2, Math.min(gx, line)) : Math.min(PITCH_L / 2, Math.max(gx, line));
}

// The presser and his cover.
export function meTwoClosest(ps, x, y) {
  let a = -1, b = -1, da = Infinity, db = Infinity;
  for (let i = 0; i < ps.length; i++) { if (ps[i].pos === "GK") continue;
    const d = Math.hypot(ps[i].x - x, ps[i].y - y);
    if (d < da) { b = a; db = da; a = i; da = d; } else if (d < db) { b = i; db = d; } }
  return [a, b];
}

// ---- time-to-ball ------------------------------------------------------------------------
// The two-phase growing circle (AI_GetTimeNeededForDistance_ms, AIfunctions.cpp:499-598) in closed
// form at our slice size. A player is modelled as DRIFTING on his existing momentum for 700 ms while
// the circle of what he can reach grows around the drift point; integrating that exactly gives a
// drift offset of v*0.35 and a first-phase radius of 0.28 + 0.329*vmax. A sprinting player needing
// most of a second before he is at full speed in a new direction falls out of the model -- a man
// running away from the ball is now genuinely further from it than one standing still.
import { CFG, ME_DT } from "./config";
import { meAerial, meAttrs, meSpeed } from "./attributes";
export function meTimeToBallMs(p, tx, ty, vmax) {
  const vx = (p.vx || 0) / ME_DT, vy = (p.vy || 0) / ME_DT;      // per-slice displacement -> m/s
  const rawD = Math.hypot(tx - p.x, ty - p.y);
  // Beyond 16 m the fine structure is noise; GF itself switches to a straight-line estimate.
  if (rawD > 16) return Math.hypot(tx - (p.x + vx * 0.2), ty - (p.y + vy * 0.2)) / (vmax * 0.75) * 1000;
  const vm = vmax * CFG.ttbVmax;
  const d = Math.hypot(tx - (p.x + vx * CFG.ttbDrift), ty - (p.y + vy * CFG.ttbDrift));
  const r = CFG.ttbRadius + CFG.ttbRadiusV * vm;
  // The circle GROWS across those 700 ms -- it is not 700 ms of nothing followed by running. Adding
  // the constant flat meant a defender standing ON the ball's path was modelled as needing 700 ms to
  // reach a ball already at his feet, while the ball crossed him in 470. That single term is why the
  // decision scored a lane with a man in it as risk-free and 68% of all lost passes were struck
  // straight through somebody.
  // READING IT. Those 700 ms of drift before he is free to go anywhere are the moment between the
  // ball changing and the player acting on it, and how short that moment is is exactly what a high
  // `position` rating means -- it was worth one 20% term on how good a receiver looked and nothing
  // else. Here it reaches every query in the engine at once: intercepting, marking, chasing a loose
  // ball, closing a carrier down. A defender who reads it commits a quarter of a second sooner than
  // one who does not, and over a match that is the difference between getting there and watching.
  const lag = CFG.ttbChangeMs * (1 - (meAttrs(p).position / 99 - 0.5) * CFG.ttbAnticip);
  const over = d - r;
  return over > 0 ? lag + over / vm * 1000
                  : lag * (d / Math.max(r, 0.01));
}

// Ball-side query: scan the forecast for the first slot this player can actually make, and return
// where to run and how urgent it is. `run at where the ball WILL be` lives here.
export function meIntercept(p, mp, vmax) {
  const pred = mp.pred;
  if (!pred) { const ms = meTimeToBallMs(p, mp.bx, mp.by, vmax); return { x: mp.bx, y: mp.by, ms, slotMs: ms }; }
  for (let i = 0; i < pred.length; i++) {
    const [x, y, z] = pred[i];
    // Over HIS head there -- not over a flat 1.6 m that nobody could ever reach. Without this he
    // would never even set off for a ball he is perfectly capable of winning.
    if (z >= meAerial(meAttrs(p), CFG)) continue;
    const t = i * ME_DT * 1000;
    const need = meTimeToBallMs(p, x, y, vmax);
    if (need <= t + 60) return { x, y, ms: Math.max(need, t), slotMs: Math.max(t, 1) };
  }
  const last = pred[pred.length - 1];
  return { x: last[0], y: last[1], ms: meTimeToBallMs(p, last[0], last[1], vmax), slotMs: (pred.length - 1) * ME_DT * 1000 };
}

// Can anybody actually get to this ball before it arrives? This is the SAME question the resolution
// asks -- whoever reaches the path first takes it -- and asking it here is what stops a player
// serving the ball to a defender standing in the lane. Before this the decision scored passes with a
// lane-block heuristic while the ball's fate was settled by physical interception; the two had
// nothing to do with each other, so "safe" passes were routinely intercepted on the spot.
// How long a ground ball really takes to cover the first `s` metres of an `L` metre pass. Closed
// form of the same rolling ODE meGroundSpeed inverts: with C = (arrive^2 + r)e^(2kL),
//   t(s) = 2/(2k*sqrt(r)) * ( atan(v0/sqrt(r)) - atan(v(s)/sqrt(r)) )
// Same coefficients as the launch and as the integrator -- see meRollK in ball.ts for what happened
// while these three each believed in a different pitch.
// The ball is decelerating hard the whole way, so scoring risk off the LAUNCH speed says a 12 m pass
// arrives in 0.90 s when it really takes 1.33 s. Four hundred milliseconds is more than half the
// entire window over which a defender goes from no threat to a certain interception, which is why
// 268 of every 290 passes were scored as under 0.2 risk and then completed at 56%.
// ...and off the speed it was ACTUALLY STRUCK AT. meGroundSpeed clamps the launch at passMaxV,
// because past about nineteen metres the speed this ODE asks for is more than a foot can put through
// a ball. C was rebuilt here from passArrive and L regardless, so for every pass beyond that this
// returned the flight time of a ball nobody kicked -- a 26 m pass came back at 1.64 s when it is
// struck at 30 m/s and arrives at 2.3, not 6. Everything downstream believed it: the lead a through
// ball is played with, the interception risk, and how late the receiver is judged to be. Measured,
// through balls arrived at the aim point at 2.3 m/s at the tenth percentile against the 6 they were
// solved for, and the man they were played to was already past the ball 21% of the time.
export function meGroundT(L, s) {
  const k2 = 2 * meRollK(), r = meRollR(), rr = Math.sqrt(r), sc = 2 / (k2 * rr);
  const v0 = meGroundSpeed(L), C = v0 * v0 + r;
  // No floor at passArrive here either: a clamped ball genuinely does die below it, and flooring
  // the far end at 6 m/s is what hid that.
  const vs = Math.sqrt(Math.max(0, C * Math.exp(-k2 * s) - r));
  return sc * (Math.atan(v0 / rr) - Math.atan(vs / rr));
}

export function mePassRisk(s, side, x0, y0, x1, y1, speed, high) {
  const opp = s.players[side === "home" ? "away" : "home"];
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
  let risk = 0;
  for (const q of opp) {
    // The keeper counts. Skipping him meant a through ball slid in behind the last defender was
    // scored as completely safe when the man it was really being played to was the goalkeeper --
    // which is exactly what it looked like. No special case is needed: a keeper forty metres from
    // the lane has a time-to-ball that contributes nothing, and one six metres from a ball rolling
    // into his six-yard box beats it there. He is slower than an outfielder, so he is charged the
    // same three-quarter pace the movement code gives him.
    const vmaxQ = meSpeed(meAttrs(q), q.stamina) * (q.pos === "GK" ? 0.75 : 1);
    let t = ((q.x - x0) * dx + (q.y - y0) * dy) / L2;
    if (t <= 0.04) continue;                                   // behind the passer; he cannot cut it
    t = Math.min(1.06, t);                                     // just past the target still counts
    const px = x0 + dx * t, py = y0 + dy * t;
    // A lofted ball holds its horizontal speed; a ground ball does not.
    const tBall = high ? L * t / Math.max(1, speed) * 1000 : meGroundT(L, L * t) * 1000;
    const tMan = meTimeToBallMs(q, px, py, vmaxQ);
    // How comfortably he beats the ball there, in milliseconds. Arriving 400 ms late is no threat;
    // arriving early is an interception.
    const margin = tBall - tMan;
    if (margin > -CFG.riskLateMs) risk = Math.max(risk, Math.min(1, (margin + CFG.riskLateMs) / CFG.riskSpanMs));
  }
  return risk;
}

export function meClosest(ps, x, y) {
  let bi = -1, bd = Infinity;
  for (let i = 0; i < ps.length; i++) { if (ps[i].pos === "GK") continue;
    const d = Math.hypot(ps[i].x - x, ps[i].y - y); if (d < bd) { bd = d; bi = i; } }
  return bi;
}
