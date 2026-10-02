// ONE AGAINST ONE. The first brain had no duel: a dribbler ran on eight compass bearings at one fixed
// turning rate for everybody, a defender committed when a checklist of angles summed past a bar, and a
// foul was a dice roll against anybody who happened to be standing within two metres of the ball.
//
// THE MAN ON THE BALL (mindCarrier) runs on the heading his decision chose, and when a defender stands in
// his way he does something about it, the way his skill and the room allow: knocks it past him and goes
// if there is grass behind and he has the legs, sells him one way and goes the other, cuts away, or turns
// his back and shields it. How sharply he can turn with it is his own agility, not a league constant.
//
// THE MAN IN FRONT OF HIM (mindDuel) jockeys -- goal-side, backing off as fast as the dribbler comes --
// and goes in when the ball is off the dribbler's foot or there is no choice left. Whether he wins it is
// how exposed the ball was and his tackling against the dribbler's control; whether a miss is a foul is
// where he came from and how hard. A beaten man is beaten: he has to turn and chase. And a side that
// fouls on purpose to stop a break, does so.
import { CFG, ME_DT } from "../config";
import { meAttrs, meMind, meSpeed, meTech } from "../attributes";
import { ME_HALF_W, PITCH_L, PITCH_W, meDanger, meDir, meGoalX, meOther, meThruCover } from "../geometry";
import { meCarrierPos } from "../brain";
import { MT } from "./tune";
import { angDiff, mindAware, mindRand } from "./perceive";
import { ROLES } from "./roles";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// What each man brings to a duel, 0..1 over the band footballers occupy.
export const dribSkill = (p) => { const a = meAttrs(p); return clamp(0.45 * meTech(a.touch) + 0.30 * meTech(a.pace) + 0.25 * meMind(p), 0, 1); };
export const ctrlSkill = (p) => { const a = meAttrs(p); return clamp(0.6 * meTech(a.touch) + 0.4 * meTech(a.strength), 0, 1); };
export const tackSkill = (p) => { const a = meAttrs(p); return clamp(0.75 * meTech(a.tackle) + 0.25 * meTech(a.position), 0, 1); };

// ---- THE DRIBBLER -------------------------------------------------------------------------------
export function mindCarrier(s, side, i) {
  const mp = s.mePos, p = s.players[side][i], M = mp.mind;
  // A keeper with it, in his hands or at his feet, is the first brain's keeper.
  if (p.pos === "GK") { meCarrierPos(s, side, i); return; }
  const dir = meDir(side), atk = dir > 0 ? 0 : Math.PI;
  const st = s.strategy?.[side] || {};
  const role = p._role2 || ROLES.cm;
  const vNow = Math.hypot(p.vx || 0, p.vy || 0) / ME_DT;
  if (p._drbA == null) {
    p._drbA = vNow > 0.1 ? Math.atan2(p.vy, p.vx)
            : Math.hypot(mp.bx - p.x, mp.by - p.y) > 0.05 ? Math.atan2(mp.by - p.y, mp.bx - p.x) : atk;
  }
  const ha = p._drbA;
  // THE MAN IN HIS WAY: the nearest opponent inside a cone ahead of where he is taking it.
  const opp = s.players[meOther(side)];
  let dq = null, dd = Infinity;
  for (const q of opp) {
    if (!q || q.off || q.pos === "GK") continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (d > 5.5 || d < 0.05) continue;
    if (Math.abs(angDiff(Math.atan2(dy, dx), ha)) < 1.2 && d < dd) { dd = d; dq = q; }
  }
  let mv = p._mv;
  if (mv && mp.tick - (mv.at ?? 0) > 8) mv = p._mv = null;        // a move from his last time on it
  if (mv) { mv.t--; if (mv.t <= 0 || !dq || dd > 5) mv = p._mv = null; }
  let want = p._drbWant ?? ha;
  p._shield = false; p._knockL = 0; p._dribV = 0; p._fk = 0;
  if (dq && dd < 4.2) {
    const dsk = dribSkill(p);
    if (!mv) {
      // HOW OFTEN HE TAKES HIM ON: his role, the side's dribbling instruction, and above all whether he
      // is good enough to. A man with no business dribbling mostly keeps it simple and looks for a pass.
      const go = clamp(0.10 + (role.carry || 0) * 0.35 + (st.dribbling || 0) * 0.12 + (dsk - 0.45) * 0.7, 0.03, 0.75);
      const backToGoal = Math.abs(angDiff(p._face ?? ha, atk)) > 2.0;
      if (backToGoal && dd < 2.6) mv = { k: "shield", t: 6, sgn: 0 };
      else if (mindRand(M) < go) {
        // Which side: the freer one, and the one the defender is not already moving to.
        const lat = (q, a) => { const ex = Math.cos(a), ey = Math.sin(a); return -(q.x - p.x) * ey + (q.y - p.y) * ex; };
        const dlv = -((dq.vx || 0) * Math.sin(ha)) + ((dq.vy || 0) * Math.cos(ha));     // his drift across me
        const free = (sgn) => {
          const a = ha + sgn * 0.9, x = p.x + Math.cos(a) * 5, y = p.y + Math.sin(a) * 5;
          if (x < 1.5 || x > PITCH_L - 1.5 || y < 1.5 || y > PITCH_W - 1.5) return -9;
          let n = 99;
          for (const q of opp) if (q && !q.off && q !== dq) n = Math.min(n, Math.hypot(q.x - x, q.y - y));
          return Math.min(10, n) - sgn * dlv * 2.5 - Math.sign(lat(dq, ha)) * sgn * 0.8;
        };
        const sgn = free(1) >= free(-1) ? 1 : -1;
        // Room behind him, and whether the dribbler has the legs for it.
        const bx = dq.x + Math.cos(ha) * 7, by = dq.y + Math.sin(ha) * 7;
        let room = 99;
        for (const q of opp) if (q && !q.off && q !== dq && q.pos !== "GK") room = Math.min(room, Math.hypot(q.x - bx, q.y - by));
        const paceAdv = meSpeed(meAttrs(p), p.stamina) - meSpeed(meAttrs(dq), dq.stamina);
        if (room > 8 && paceAdv > -0.3 && dd > 1.6) mv = { k: "knock", t: 3, sgn };
        else if (dsk > 0.55 && mindRand(M) < 0.6) mv = { k: "feint", t: 3, sgn, sell: dsk };
        else mv = { k: "cut", t: 3, sgn };
      }
      if (mv) mv.at = mp.tick;
      p._mv = mv;
    }
    if (mv) {
      const burst = 0.45 + 0.55 * dsk;
      if (mv.k === "shield") {
        // Back to the man, ball on the far side of his body, small touches: he is keeping it until
        // somebody comes or a pass opens.
        want = Math.atan2(p.y - dq.y, p.x - dq.x);
        p._shield = true; p._dribV = 0.35;
      } else if (mv.k === "knock") {
        // Past him, on the free side, and run: the ball goes into the space beyond him.
        const a = ha + mv.sgn * 0.55;
        want = a; p._knockL = 3.2 + 1.6 * dsk;
        p._strideT = 2; p._stride = burst;
      } else if (mv.k === "feint") {
        // One way first -- the shoulder, the step -- then the other, hard.
        if (mv.t >= 2) { want = ha + mv.sgn * 0.5; p._fk = mv.sell; p._fs = mv.sgn; }
        else { want = ha - mv.sgn * 1.15; p._strideT = 2; p._stride = burst; p._knockL = 1.6 + 1.2 * dsk; }
      } else {
        want = ha + mv.sgn * 1.0; p._strideT = 2; p._stride = burst * 0.85;
      }
    }
  } else if (mv) p._mv = null;
  // TURNING WITH IT is agility: an elite dribbler comes round twice as sharply as a centre-half does.
  const agil = clamp(0.55 * meTech(meAttrs(p).touch) + 0.45 * meTech(meAttrs(p).pace), 0, 1);
  const mt = CFG.dribTurn * (0.65 + 0.8 * agil) * (p._mv?.k === "feint" || p._mv?.k === "cut" ? 1.6 : 1) / (1 + vNow * CFG.dribTurnV);
  p._drbA += clamp(angDiff(want, p._drbA), -mt, mt);
  // The line stays on the pitch (the first brain's rule, kept).
  {
    const ex = mp.bx + Math.cos(p._drbA) * CFG.dribEdge, ey = mp.by + Math.sin(p._drbA) * CFG.dribEdge;
    const cxE = clamp(ex, CFG.dribEdgeM, PITCH_L - CFG.dribEdgeM), cyE = clamp(ey, CFG.dribEdgeM, PITCH_W - CFG.dribEdgeM);
    if (cxE !== ex || cyE !== ey) p._drbA = Math.atan2(cyE - mp.by, cxE - mp.bx);
  }
  // A ball that has got behind him is fetched before anything else.
  {
    const bx2 = mp.bx - p.x, by2 = mp.by - p.y, bd2 = Math.hypot(bx2, by2), vN = Math.hypot(p.vx || 0, p.vy || 0);
    if (bd2 > 0.05 && vN > 0.02 && ((bx2 / bd2) * (p.vx / vN) + (by2 / bd2) * (p.vy / vN)) < CFG.dribBehind) p._drbA = Math.atan2(by2, bx2);
  }
  let ca = p._drbA;
  if (Math.hypot(mp.bvx, mp.bvy) > 0.5) ca = Math.atan2(mp.bvy, mp.bvx);
  p._tx = mp.bx - Math.cos(ca) * CFG.dribBehindD;
  p._ty = mp.by - Math.sin(ca) * CFG.dribBehindD;
  p._drbT = CFG.carryCommit;
}

// ---- THE DEFENDER --------------------------------------------------------------------------------
// The first presser's spot, given the man on the ball. He backs off as fast as the man runs at him, so
// he is never skinned standing still, and stands tight on a man with his back to goal. Against a feint
// he leans the way the dribbler shaped to go -- unless he reads it, which is his awareness against how
// well it was sold.
export function mindJockey(p, c, gux, guy, nx, ny, delay) {
  const cvx = (c.vx || 0) / ME_DT, cvy = (c.vy || 0) / ME_DT;
  const toward = cvx * gux + cvy * guy;                         // the dribbler's pace at our goal
  const backTo = c._shield ? 1 : 0;
  let stand = (delay ? 3.2 : MT.pressStand) + Math.max(0, toward) * 0.30 - backTo * 0.6;
  stand = clamp(stand, 1.0, 4.5);
  let lead = 1.5;
  if (c._fk) {
    // Bitten or not.
    const bite = clamp(0.95 - mindAware(p) * 0.8 + c._fk * 0.35, 0.05, 1);
    lead = 1.5 + bite * 2.2;
  }
  return [c.x + gux * stand + nx * MT.pressShade + (c.vx || 0) * lead,
          c.y + guy * stand + ny * MT.pressShade + (c.vy || 0) * lead];
}

// WHETHER ANYBODY GOES IN, this slice. One challenge a slice at most.
export function mindDuel(s, rng, out, foul) {
  const mp = s.mePos;
  for (const sd of ["home", "away"]) for (const q of s.players[sd]) if (q && q._tkCool > 0) q._tkCool--;
  if (mp.sp || mp.idx < 0) return;
  const atk = mp.side, def = meOther(atk);
  const c = s.players[atk]?.[mp.idx];
  if (!c || c.off) return;
  if (mp.held && c.pos === "GK") return;
  const us = s.players[def], st = s.strategy?.[def] || {};
  const gx = meGoalX(atk);                                     // the goal we defend
  const inBoxC = (q) => Math.abs(q.x - gx) < CFG.gkBoxR && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW;
  const dBC = Math.hypot(mp.bx - c.x, mp.by - c.y);
  // How far the ball is off his foot: between touches, or a heavy one, it is there to be taken.
  const exposed = clamp((dBC - 0.42) / 0.75, 0, 1);
  const danger = meDanger(atk, c.x, c.y);
  const through = !meThruCover(s, atk, c);
  const ct = ctrlSkill(c);
  // HOW LONG EACH MAN HAS BEEN ON HIM. A defender jockeys first and goes in when the moment comes; the
  // longer he has stood the man up, the readier he is.
  for (const p of us) if (p) p._jkT = !p.off && Math.hypot(p.x - c.x, p.y - c.y) < 3.2 ? (p._jkC === c ? (p._jkT || 0) + 1 : 1) : 0;
  for (const p of us) if (p) p._jkC = p._jkT ? c : null;
  let pick = null, pickP = 0;
  for (let i = 0; i < us.length; i++) {
    const p = us[i];
    if (!p || p.off || p.pos === "GK" || (p._beat ?? 0) > 0 || (p._tkCool ?? 0) > 0) continue;
    const dP = Math.hypot(p.x - c.x, p.y - c.y);
    if (dP > 2.8) continue;
    const dPB = Math.hypot(p.x - mp.bx, p.y - mp.by);
    // Where he is coming from: in front of the man (goal-side), alongside, or chasing from behind.
    const ux = gx - c.x, uy = ME_HALF_W - c.y, ul = Math.hypot(ux, uy) || 1;
    const front = ((p.x - c.x) * ux + (p.y - c.y) * uy) / (ul * Math.max(0.1, dP));
    const behind = clamp((-front - 0.1) / 0.6, 0, 1);
    const slide = dPB > CFG.reach + 0.55;
    if (dPB > CFG.reach + (slide ? 1.35 : 0.55)) continue;
    const tk = tackSkill(p);
    const pWin = clamp(0.12 + 0.52 * exposed + 0.34 * (tk - ct) + 0.10 * clamp(front, 0, 1) - 0.14 * behind - (slide ? 0.05 : 0), 0.03, 0.9);
    // HIS BAR. He goes when he likes his chances well enough; how well is temperament and the moment.
    // A side told to get stuck in goes sooner, a booked man later, a man delaying a break later still,
    // and a last man with the ball about to be past him has no bar at all.
    const role = p._role2 || ROLES.cm;
    let bar = MT.tkBar - (st.tackling || 0) * 0.07 - (role.press - 0.4) * 0.08 + ((p.yc || 0) ? 0.1 : 0)
            + (p._delay ? 0.14 : 0) + (exposed < 0.2 ? 0.08 : 0)
            + 0.15 * clamp(1 - (p._jkT || 0) / 8, 0, 1);
    if (through && danger > 0.25) bar -= 0.22;
    if (pWin - bar > pickP) { pickP = pWin - bar; pick = { p, i, pWin, behind, slide, dP }; }
  }
  if (pick) {
    const { p, i, pWin, behind, slide } = pick;
    p._tkCool = CFG.tkCool;
    out.tackleTry = (out.tackleTry || 0) + 1;
    (out.tackleTrySide = out.tackleTrySide || { home: 0, away: 0 })[def]++;
    if (rng.u() < pWin) { foul.won(p, i, c); return; }
    // MISSED. Whether it is a foul is where he came from and how he came: from behind, on the floor,
    // at pace, and not good enough to be sure of it.
    const closeV = Math.max(0, ((p.vx || 0) * (c.x - p.x) + (p.vy || 0) * (c.y - p.y)) / Math.max(0.3, pick.dP) / ME_DT);
    const pFoul = clamp(0.13 + 0.40 * behind + (slide ? 0.20 : 0) + 0.04 * closeV - 0.22 * tackSkill(p)
                        + (st.tackling || 0) * 0.05, 0.03, 0.85);
    if (rng.u() < pFoul) { if (globalThis.__fouls) globalThis.__fouls.push(["tackle", inBoxC(c)]); foul.commit(p, c, closeV); return; }
    // Beaten: committed and gone past, he has to turn and run.
    p._beat = slide ? CFG.tkBeatT + 6 : CFG.tkBeatT;
    foul.beaten(p, c);
    return;
  }
  // CONTACT. Most fouls in football are not tackles: a man tight on the carrier holds him, leans on him,
  // climbs on a man shielding it. A slice spent body to body is a chance of it -- more for a side told to
  // get stuck in, a defender who cannot tackle, a man coming from behind, a strong carrier who invites
  // it; far less in the area, where a defender keeps his hands to himself.
  {
    const inBox = Math.abs(c.x - gx) < CFG.gkBoxR && Math.abs(c.y - ME_HALF_W) < CFG.boxHalfW;
    const cs = meTech(meAttrs(c).strength);
    for (const p of us) {
      if (!p || p.off || p.pos === "GK") continue;
      const dP = Math.hypot(p.x - c.x, p.y - c.y);
      if (dP > 1.5) continue;
      const ux = gx - c.x, uy = ME_HALF_W - c.y, ul = Math.hypot(ux, uy) || 1;
      const front = ((p.x - c.x) * ux + (p.y - c.y) * uy) / (ul * Math.max(0.1, dP));
      const pC = MT.contactFoul * (1 + (st.tackling || 0) * 0.6) * (1.3 - tackSkill(p)) * (0.6 + cs)
               * (front < -0.2 ? 1.6 : 1) * ((p.yc || 0) ? 0.5 : 1) * (inBox ? 0.22 : 1);
      if (rng.u() < pC) { if (globalThis.__fouls) globalThis.__fouls.push(["contact", inBox]); foul.commit(p, c, 0.6); return; }
    }
  }
  // THE FOUL ON PURPOSE. A man who has just been beaten, or is chasing from behind, with the dribbler
  // breaking into space toward goal: a side that does this stops the break and takes the card.
  for (const p of us) {
    if (!p || p.off || p.pos === "GK") continue;
    const dP = Math.hypot(p.x - c.x, p.y - c.y);
    if (dP > 1.7) continue;
    const ux = gx - c.x, uy = ME_HALF_W - c.y, ul = Math.hypot(ux, uy) || 1;
    const front = ((p.x - c.x) * ux + (p.y - c.y) * uy) / (ul * Math.max(0.1, dP));
    if (front > -0.2 && !((p._beat ?? 0) > 0)) continue;
    // Only worth it if the break is real: space ahead, few men back.
    let back = 0;
    for (const q of us) if (q && !q.off && q.pos !== "GK" && ((q.x - c.x) * (gx - c.x) > 0)) back++;
    if (back > 3 || danger < 0.04) continue;
    const pCyn = MT.cynBase * (1 + (st.tackling || 0) * 0.8) * ((p.yc || 0) ? 0.25 : 1) * (1 + danger * 2);
    if (rng.u() < pCyn) { if (globalThis.__fouls) globalThis.__fouls.push(["cynical", inBoxC(c)]); foul.commit(p, c, 1.5); return; }
  }
}
