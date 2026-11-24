// THE TOUCHLINES: the two assistant referees and the two coaches (user, 24 November 2026: "linemen (cosmetic),
// coaches in the technical area walking around (cosmetic; shouting effects when he gives instructions)").
//
// DRAWN, NOT PLAYED. Nothing in the engine reads any of this and none of it takes dice: it is a picture of what the
// match is already doing, kept on the app's own match object (m.tl) and stepped once a slice after the tick, while a
// match is being watched. It sits beside the engine only so the harness build, which mirrors the app's one engine
// import, carries it.
//
// The assistant on the near touchline has the right-hand half and the one on the far touchline the left-hand half,
// each level with the second-last defender of the end he has, or with the ball when that is nearer the goal line. A
// coach stands in his own technical area: back and still when the match is going his way, on the edge of it and
// following play when it is not, and at the front shouting when he gives an order (the manager log, out.mgrLog).
import { CFG, ME_DT } from "./config";
import { ME_HALF_W, PITCH_L, PITCH_W, meDir, meGoalX, meOffsideLine, meOther } from "./geometry";
import { meRefDiag } from "./referee";

// arOff: how far outside the line an assistant runs. arTop / arAcc: his top speed and how fast he gets to it.
// flagT: slices a flag stays up. boxHalf: half the length of a technical area; front / back / aside: how near the
// line a coach comes, how far back he stands, and where he stands when the assistant is running past him.
// walk / hurry: a coach's pace, metres a second. shoutT / protestT: slices an order, and a complaint, last.
export const ME_TL = {
  arOff: 0.75, arTop: 6.6, arAcc: 5.2, arHold: 0.3, flagT: 11,
  boxHalf: 4.3, front: 68.95, back: 69.6, aside: 69.6, asideR: 2.4,
  walk: 1.0, hurry: 2.3, shoutT: 12, protestT: 7, joyT: 14, lowT: 18,
};
// What a coach's order is called over the pitch, by the manager log's own kinds.
export const ME_TL_TAG = { switch: "Change Of Style", orders: "New Orders", lift: "Orders Lifted", talk: "Team Talk",
                           mark: "Man Marking", plan: "Game Plan", sub: "Substitution", shape: "Change Of Shape", reorg: "Reshuffle" };

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const hash01 = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
const boxX = (sd) => PITCH_L / 2 + (sd === "home" ? -1 : 1) * CFG.subEnterX;
// The assistant's own touchline, and the side whose attack he judges. On screen the near one has the left half and the
// far one the right, all match (referee.ts, meRefDiag): in the engine's coordinates that is the away attack for the near
// one and the home attack for the far one in the first half, and the other way round once the picture is mirrored.
const AR = [{ y: PITCH_W + ME_TL.arOff, inY: -1 }, { y: -ME_TL.arOff, inY: 1 }];
const arAtk = (mp, i) => (i === 0) === !!mp?.h2 ? "home" : "away";
// Which of them has the end the ball is at.
const arAt = (mp, x) => (x > PITCH_L / 2) === !!mp?.h2 ? 0 : 1;

const man = (x, y) => ({ x, y, _px: x, _py: y, v: 0, _face: 0 });

export function meTlInit(s, out) {
  const tl = {
    ar: AR.map((a, i) => ({ ...man(meOffsideLine(s, arAtk(s.mePos, i)), a.y), fx: 0, fy: 0, ft: 0, fk: "" })),
    co: {}, sp: s.mePos?.sp || null,
    seen: { log: {}, off: {}, yc: {}, rc: {}, gl: {} },
  };
  for (const sd of ["home", "away"]) {
    tl.co[sd] = { ...man(boxX(sd), ME_TL.back), sx: boxX(sd), wT: 0, sh: 0, tag: "", k: "", joy: 0, low: 0 };
    tl.seen.log[sd] = out?.mgrLog?.[sd]?.length || 0;
    tl.seen.off[sd] = out?.offside?.[sd] || 0;
    tl.seen.yc[sd] = out?.yellows?.[sd] || 0;
    tl.seen.rc[sd] = out?.sendOff?.[sd]?.length || 0;
    tl.seen.gl[sd] = out?.goals?.[sd] || 0;
  }
  return tl;
}

// A flag, as the line it is drawn along from the man: up for offside, along the line the way of the throw, down at the
// corner, in at the goal area.
function flag(a, A, k, d) {
  a.fk = k; a.ft = ME_TL.flagT;
  const g = A.atk === "home" ? 1 : -1;                // the way to the goal line of his end
  if (k === "up") { a.fx = 0; a.fy = A.inY * 1.7; }
  else if (k === "throw") { a.fx = d * 1.35; a.fy = A.inY * 0.75; }
  else if (k === "corner") { a.fx = g * 1.25; a.fy = -A.inY * 0.5; }
  else { a.fx = g * 0.8; a.fy = A.inY * 1.2; }
}

// One slice of the four of them.
export function meTlStep(s, out, tl) {
  const mp = s.mePos, T = ME_TL;
  if (!mp || !tl) return;
  // ---- what has just happened --------------------------------------------------------------
  const ARs = AR.map((A, i) => ({ ...A, atk: arAtk(mp, i) }));
  for (const [i, A] of ARs.entries()) {
    const a = tl.ar[i], n = out?.offside?.[A.atk] || 0;
    if (n > tl.seen.off[A.atk]) flag(a, A, "up", 0);
    tl.seen.off[A.atk] = n;
  }
  if (mp.sp && mp.sp !== tl.sp) {
    const sp = mp.sp;
    if (sp.kind === "throw") { const i = sp.y > ME_HALF_W ? 0 : 1; flag(tl.ar[i], ARs[i], "throw", sp.side === "home" ? 1 : -1); }
    else if (sp.kind === "corner" || sp.kind === "goalkick") { const i = arAt(mp, sp.x); if (tl.ar[i].fk !== "up" || tl.ar[i].ft <= 0) flag(tl.ar[i], ARs[i], sp.kind === "corner" ? "corner" : "gk", 0); }
  }
  tl.sp = mp.sp || null;
  // ---- the assistants ------------------------------------------------------------------------
  for (const [i, A] of ARs.entries()) {
    const a = tl.ar[i], gx = meGoalX(A.atk), sp = mp.sp;
    a._px = a.x; a._py = a.y;
    if (a.ft > 0 && --a.ft <= 0) { a.fk = ""; a.fx = 0; a.fy = 0; }
    const line = meOffsideLine(s, A.atk);
    // Level with the second-last defender, or with the ball if it is nearer the goal line than he is.
    let tx = A.atk === "home" ? Math.max(line, Math.min(PITCH_L, mp.bx)) : Math.min(line, Math.max(0, mp.bx)), ty = A.y;
    const mine = sp && (A.atk === "home" ? sp.x > PITCH_L / 2 : sp.x < PITCH_L / 2);
    if (mine && sp.kind === "corner") tx = gx;
    // A penalty at his end: on the goal line, where the edge of the area meets it.
    if (mine && sp.kind === "penalty") { tx = gx; ty = ME_HALF_W - A.inY * (CFG.boxHalfW + 0.6); }
    // He keeps to the lines: along the touchline to the corner and then along the goal line, and back the same way.
    const offLine = Math.abs(a.y - A.y) > 0.05;
    let wx = tx, wy = ty;
    if (ty !== A.y) { if (Math.abs(a.x - gx) > 0.2 && !offLine) wy = A.y; else wx = gx; }
    else if (offLine) wx = a.x;
    const dx = wx - a.x, dy = wy - a.y, d = Math.hypot(dx, dy);
    if (a.ft > 0 && a.fk === "up") a.v = Math.max(0, a.v - T.arAcc * ME_DT);     // he stands with the flag up
    else a.v = d < T.arHold ? 0 : Math.min(T.arTop, d / 0.5, a.v + T.arAcc * ME_DT);
    if (d > 0.01 && a.v > 0) { const k = Math.min(d, a.v * ME_DT) / d; a.x += dx * k; a.y += dy * k; }
    a._face = Math.atan2(mp.by - a.y, mp.bx - a.x);
  }
  // ---- the coaches -----------------------------------------------------------------------------
  const seed = (mp.vseed | 0) || 1, min = out?.min ?? 0, late = clamp((min - 60) / 30, 0, 1);
  for (const sd of ["home", "away"]) {
    const c = tl.co[sd], opp = meOther(sd), cx = boxX(sd), S = tl.seen;
    c._px = c.x; c._py = c.y;
    // An order given: he comes to the edge and shouts it (the tag is what the pitch prints over him).
    const L = out?.mgrLog?.[sd] || [];
    if (L.length > S.log[sd]) { const e = L[L.length - 1]; c.sh = T.shoutT; c.k = e.k || "orders"; c.tag = ME_TL_TAG[c.k] || ME_TL_TAG.orders; }
    S.log[sd] = L.length;
    // A card against his side: he has something to say about it, and no order to give.
    const yc = out?.yellows?.[sd] || 0, rc = out?.sendOff?.[sd]?.length || 0;
    if ((yc > S.yc[sd] || rc > S.rc[sd]) && c.sh <= 0) { c.sh = T.protestT; c.tag = ""; c.k = ""; }
    S.yc[sd] = yc; S.rc[sd] = rc;
    const g = out?.goals?.[sd] || 0, ga = out?.goals?.[opp] || 0;
    if (g > S.gl[sd]) { c.joy = T.joyT; c.low = 0; }
    S.gl[sd] = g;
    if (c.sh > 0) c.sh--;
    if (c.joy > 0) c.joy--;
    // How much the match is asking of him: behind, or level and late, or hanging on to a goal's lead.
    const lead = g - ga + (s.aggLead?.[sd] || 0);
    let u = lead < 0 ? 0.6 + 0.4 * late : lead === 0 ? 0.3 + 0.3 * late : lead === 1 ? 0.2 + 0.35 * late : 0.08;
    if (mp.side === opp && Math.abs(mp.bx - meGoalX(opp)) < 30) u += 0.15;      // they have it near his goal
    if (c.sh > 0 || c.joy > 0) u = 1;
    u = clamp(u, 0, 1);
    // Where along his area: with the play when it matters, and otherwise a slow walk to nowhere much, with pauses.
    if (u > 0.5) c.sx = clamp(mp.bx, cx - T.boxHalf, cx + T.boxHalf);
    else if (--c.wT <= 0) { const r = hash01(seed + (sd === "home" ? 3 : 11), mp.tick);
      c.sx = cx + (r * 2 - 1) * T.boxHalf * 0.8; c.wT = 28 + Math.floor(hash01(seed, mp.tick + 0.5) * 110); }
    if (c.joy > 0) c.sx = clamp(c.x + (sd === "home" ? 1 : -1) * 1.2, cx - T.boxHalf, cx + T.boxHalf);
    // ...and how near the line, a step back when the assistant is running past.
    const ar = tl.ar[0], near = Math.abs(ar.x - c.x) < T.asideR && Math.abs(ar.y - AR[0].y) < 0.3;
    const ty = near ? T.aside : T.back + (T.front - T.back) * u;
    const dx = c.sx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy), step = (T.walk + (T.hurry - T.walk) * u) * ME_DT;
    if (d > 0.06) { const k = Math.min(d, step) / d; c.x += dx * k; c.y += dy * k; }
    c._face = Math.atan2(mp.by - c.y, mp.bx - c.x);
  }
  meTlCare(s, tl);
}

// THE PHYSIO, AND THE MAN HE HAS COME FOR (the user, 24 November 2026: "ensure the physios' animations are also
// realistic"). The engine has already worked out the whole timetable of a treatment (injury.ts, mp.treats): when the
// physio gets to him, how long he kneels, when they are off the field, when the man is waved back on. This only draws
// it. The physio runs on from his own technical area and kneels beside him; the man lies where he fell until he is
// up; then they go to the nearest way off together -- at a walk, or on a stretcher with two bearers for the bad ones.
// A man coming back waits there with the physio until the engine has him back on. A man who is finished is taken
// round the outside of the pitch to his bench. Nobody is ever moved from one place to another without crossing the
// ground between.
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// Round the outside from a point on the edge of the field to the bench: along that side, down behind the nearer goal
// line if it is the far side, and along the near side.
function roundTo(E, B) {
  const yN = PITCH_W + 1.3, pts = [E];
  if (E[1] < PITCH_W) { const xE = E[0] < PITCH_L / 2 ? -1.9 : PITCH_L + 1.9;
    if (E[0] > 0 && E[0] < PITCH_L) pts.push([xE, E[1]]);
    pts.push([xE, yN]); }
  pts.push([B[0], yN]);
  return pts;
}
function along(pts, d) {
  for (let i = 0; i + 1 < pts.length; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (d <= l) return [...lerp2(pts[i], pts[i + 1], l ? d / l : 1), 0];
    d -= l; }
  return [...pts[pts.length - 1], 1];
}
export function meTlCare(s, tl) {
  const mp = s.mePos, list = mp?.treats || [];
  tl.careOf = tl.careOf || new Map();
  for (const T of [...tl.careOf.keys()]) if (!list.includes(T)) tl.careOf.delete(T);
  const figs = [];
  for (const T of list) {
    const tt = mp.tick - T.t0, B = [boxX(T.side), PITCH_W + 0.9], P = [T.x, T.y], E = [T.ex, T.ey];
    const carried = T.kind === "stretcher", off = T.kind === "walk" || carried;
    // Which way they leave, as a unit step: the physio walks at his shoulder, the bearers at his head and his feet.
    const dl = Math.hypot(E[0] - P[0], E[1] - P[1]) || 1, ux = (E[0] - P[0]) / dl, uy = (E[1] - P[1]) / dl;
    const side = [-uy * 0.78, ux * 0.78];
    let man = null, phys = null, done = false, down = 0;
    const leaving = T.offT > T.up ? clamp((tt - T.up) / (T.offT - T.up), 0, 1) : 1;
    if (tt <= T.arr) { man = P; down = 1; phys = lerp2(B, [P[0] + side[0], P[1] + side[1]], clamp(tt / Math.max(1, T.arr), 0, 1)); }
    else if (tt <= T.up) { man = P; down = 1; phys = [P[0] + side[0], P[1] + side[1]]; }
    else if (T.kind === "gk") {                       // the keeper is up; the physio runs back off the way he came
      const d = (tt - T.up) * 1.6, L = Math.hypot(B[0] - P[0], B[1] - P[1]) || 1;
      phys = lerp2([P[0] + side[0], P[1] + side[1]], B, clamp(d / L, 0, 1)); done = d >= L;
    } else if (tt <= T.offT) { man = lerp2(P, E, leaving); down = carried ? 1 : 0; phys = [man[0] + side[0], man[1] + side[1]]; }
    else if (!off && tt <= (T.backT - T.t0)) { man = E; phys = [E[0] + side[0], E[1] + side[1]]; }
    else {                                            // round to the bench: the man who is finished, or the physio alone
      const d = (tt - (off ? T.offT : T.backT - T.t0)) * (off ? (carried ? 0.9 : 0.7) : 1.5), q = along(roundTo(E, B), d);
      if (off) { man = [q[0], q[1]]; down = carried ? 1 : 0; phys = [q[0] + 0.7, q[1] + 0.55]; } else phys = [q[0], q[1]];
      done = !!q[2];
    }
    if (done) continue;
    const C = tl.careOf.get(T) || tl.careOf.set(T, {}).get(T);
    const put = (key, xy, extra) => { if (!xy) { delete C[key]; return; }
      const f = C[key] || (C[key] = { x: xy[0], y: xy[1] }); f._px = f.x; f._py = f.y; f.x = xy[0]; f.y = xy[1]; Object.assign(f, extra); figs.push(f); };
    // The keeper treated where he lies is the engine's own man and is drawn as one; anybody else is drawn from here.
    put("man", T.kind === "gk" ? null : man, { k: "man", side: T.side, down, gk: T.p.pos === "GK" ? 1 : 0 });
    put("phys", phys, { k: "physio", side: T.side });
    if (carried) {
      const at = tt <= T.arr ? lerp2(B, P, clamp(tt / Math.max(1, T.arr), 0, 1)) : (man || P), w = tt <= T.arr ? [0.9, 0] : [ux * 0.95, uy * 0.95];
      put("b1", [at[0] + w[0], at[1] + w[1]], { k: "bearer", side: T.side });
      put("b2", [at[0] - w[0], at[1] - w[1]], { k: "bearer", side: T.side });
    }
  }
  tl.care = figs;
}

// A BREAK, WALKED. The engine does not tick at the interval, so the app walks everyone off and back out (App.tsx
// meBreakStep), and these go with them: off down the tunnel, and back out to where each of them starts a half.
export function meTlWalk(s, tl, back, tunnel, step) {
  const go = (p, tx, ty, st) => { p._px = p.x; p._py = p.y; const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > 0.02) { const k = Math.min(d, st) / d; p.x += dx * k; p.y += dy * k; p._face = Math.atan2(dy, dx); } };
  const r = s.mePos?.ref;
  const ko = s.mePos?.sp?.kind === "kickoff" ? s.mePos.sp.side : "home";
  if (r) { go(r, back ? PITCH_L / 2 - meDir(ko) * 7.5 : tunnel[0], back ? ME_HALF_W + meRefDiag(s.mePos) * 9.5 : tunnel[1], step * 1.5); r.vx = 0; r.vy = 0; r.gx = r.x; r.gy = r.y; }
  if (!tl) return;
  tl.ar.forEach((a, i) => { go(a, back ? (arAt(s.mePos, PITCH_L) === i ? PITCH_L * 0.75 : PITCH_L * 0.25) : tunnel[0], back ? AR[i].y : tunnel[1], step * 1.9); a.v = 0; a.ft = 0; a.fk = ""; a.fx = 0; a.fy = 0; });
  for (const sd of ["home", "away"]) { const c = tl.co[sd]; go(c, back ? boxX(sd) : tunnel[0], back ? ME_TL.back : tunnel[1], step); c.sx = c.x; c.sh = 0; c.joy = 0; }
}
// Everybody put where the walk was taking him, at once: the ends change on screen while the pitch is empty, and a man
// still on his way would be thrown across it.
export function meTlPark(s, tl, back, tunnel) {
  for (let n = 0; n < 400; n++) meTlWalk(s, tl, back, tunnel, 4);
  const r = s.mePos?.ref; if (r) { r._px = r.x; r._py = r.y; }
  if (!tl) return;
  for (const p of [...tl.ar, tl.co.home, tl.co.away]) { p._px = p.x; p._py = p.y; }
}

// The five of them on one frame of the tape: referee, near assistant, far assistant, home coach, away coach, as x and
// y, then the two flags as the lines they are drawn along.
export function meTlPack(s, tl) {
  const r = s.mePos?.ref;
  if (!r && !tl) return null;
  const f = new Float32Array(14).fill(-99);
  if (r) { f[0] = r.x; f[1] = r.y; }
  if (tl) { tl.ar.forEach((a, i) => { f[2 + i * 2] = a.x; f[3 + i * 2] = a.y; f[10 + i * 2] = a.fx; f[11 + i * 2] = a.fy; });
    f[6] = tl.co.home.x; f[7] = tl.co.home.y; f[8] = tl.co.away.x; f[9] = tl.co.away.y; }
  return f;
}
