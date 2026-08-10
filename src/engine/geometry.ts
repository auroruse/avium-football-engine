// The pitch, and every spatial question asked about it.
import { CFG } from "./config";

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
export function meVal(side, x, y) {
  const d = Math.hypot(meGoalX(side) - x, (y - ME_HALF_W) * 1.35);
  return 0.26 * Math.exp(-d / 13);
}

// meVal in goal-probability units peaks at 0.26, so anything that wants "how dangerous is this, 0 to
// 1" has to normalise. Marking read the raw number, and when meVal was rescaled its threshold and
// its tightness silently went with it -- the back line stopped marking outside twelve metres.
export const ME_VAL_MAX = 0.26;

export const meDanger = (side, x, y) => meVal(side, x, y) / ME_VAL_MAX;

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
export function meLaneBlock(s, side, x0, y0, x1, y1) {
  const opp = s.players[meOther(side)], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  let blk = 0;
  for (const q of opp) {
    const t = ((q.x - x0) * dx + (q.y - y0) * dy) / (L * L);
    if (t <= 0.02 || t >= 0.98) continue;
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

export function meClosest(ps, x, y) {
  let bi = -1, bd = Infinity;
  for (let i = 0; i < ps.length; i++) { if (ps[i].pos === "GK") continue;
    const d = Math.hypot(ps[i].x - x, ps[i].y - y); if (d < bd) { bd = d; bi = i; } }
  return bi;
}
