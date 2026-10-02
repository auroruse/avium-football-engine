// THE TEAM BRAIN. The first brain built every man's spot from a stack of layers -- formation anchor,
// duties re-dealt from nothing each slice, runs, a block, a dozen pulls -- each overwriting the last,
// and nothing above any of them knew what the SIDE was trying to do. Its phase of play was written and
// never read. This one starts from the side's plan:
//
//   1. THE PHASE. With the ball: build-up, progression, final third, or a counter. Without it: counter-
//      press, high press, block, or recovering when caught out. Held for a few slices before it changes.
//   2. THE SHAPE. With the ball, every man takes the lane and line his role asks for in this phase, the
//      side keeps its rest defence behind the ball, no two men stand on each other (one of them moves --
//      which is where the winger comes inside when the full-back overlaps), and each man then finds the
//      spot near his own where the passer can actually see him. Without it, a block of real lines that
//      slides with the ball, a back line whose height is set by the man on the ball, zonal marking that
//      leans onto whoever is in the zone, and a runner in behind followed.
//   3. THE PRESS, as a unit. One man goes, on a curve that shuts the most dangerous pass; the next covers
//      him or jumps the nearest receiver when the moment says so; the front men stand in the passing
//      lanes instead of in a row. After losing it, the nearest few counter-press for as long as the style
//      wants, and everybody else holds instead of retreating.
//   4. RUNS, announced on the side's board: in behind, overlap, underlap, coming short, attacking the box,
//      the third man, give-and-go. A run vacates a cell and the shape refills it; a striker dropping short
//      invites the run in behind he has just made room for.
//
// What a man does with the ball is the player brain (mind/decide.ts). The keeper and the man running with
// the ball keep the first brain's positioning (meKeeperPos, meCarrierPos) for now.
import { CFG, ME_DT, NO_INSTRUCTIONS } from "../config";
import { meAttrs, meSpeed } from "../attributes";
import { meHungarian } from "../assignment";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meDanger, meDir, meGoalX, meIntercept, meLaneBlock, meOffsideLine,
         meOther, mePressure, meTimeToBallMs } from "../geometry";
import { meCarrierPos, meKeeperPos } from "../brain";
import { MT } from "./tune";
import { FAM, FAMPLAN, ROLES, mindRoles } from "./roles";
import { angDiff, mindAware, mindRand, mindSenseInit } from "./perceive";
import { mindCarrier, mindJockey } from "./duel";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const PH_IX = { build: 0, progress: 1, final: 2, counter: 1 };

// ---- setup --------------------------------------------------------------------------------------
export function mindInit(s, rng) {
  const mp = s.mePos;
  const drill = {};
  for (const side of ME_SIDES) drill[side] = clamp(((s.mgmt?.[side] ?? 60) - 40) / 50, 0, 1);
  mp.mind = {
    r: rng ? (Math.floor(rng.u() * 4294967295) | 0) || 0x9e3779b9 : 0x9e3779b9,
    drill, lastSide: mp.side, epi: 1,
    ph: { home: { ph: "block", t: 0, cand: null, candT: 0, won: -999, lost: -999 },
          away: { ph: "block", t: 0, cand: null, candT: 0, won: -999, lost: -999 } },
    p1: { home: -1, away: -1 }, p2: { home: -1, away: -1 },
    L: { home: 20, away: 20 }, roster: { home: "", away: "" },
  };
  for (const side of ME_SIDES) {
    mindRoles(s, side);
    mindDefSlots(s, side);
    for (const p of s.players[side]) if (p) initMan(s, p);
    mp.mind.roster[side] = rosterKey(s, side);
  }
  mindSenseInit(s);
}

function initMan(s, p) {
  const M = s.mePos.mind;
  p._eff = MT.effJog; p._run = null; p._runT = 0; p._cool = 0; p._cut = 0;
  // Where an undrilled man takes up his cell is a little off, and it is the SAME little off all match:
  // that is his habit, not a coin flipped every slice.
  p._dn = [mindRand(M) * 2 - 1, mindRand(M) * 2 - 1];
  p._refT = 0; p._rdx = 0; p._rdy = 0;
}

const rosterKey = (s, side) => (s.styles?.[side] || "") + "/" + s.players[side].map(p => (p ? (p.off ? "x" : p.name + ":" + p.pos) : "-")).join("|");

// THE DEFENSIVE SHAPE THE FORMATION BECOMES. Each outfielder is given a spot in the out-of-possession
// shape (ME_DEF_FORM, built in meInit as mp.dslots) by optimal assignment from his natural spot, and the
// spot is kept as a relative depth (0 the back line, 1 the furthest forward) and a width.
function mindDefSlots(s, side) {
  const mp = s.mePos, ps = s.players[side];
  let ds = mp.dslots?.[side] || [];
  const outf = [];
  for (let i = 0; i < ps.length; i++) if (ps[i] && !ps[i].off && ps[i].pos !== "GK") outf.push(i);
  if (!ds.length || !outf.length) return;
  // A MAN DOWN, THE SHAPE CHANGES: the furthest-forward spots are the ones a side gives up, so a 4-4-2
  // becomes a 4-4-1 and the back line is never the one left short.
  if (outf.length < ds.length) ds = [...ds].sort((a, b) => a.bd - b.bd).slice(0, outf.length);
  let mn = Infinity, mx = -Infinity;
  for (const d of ds) { if (d.bd < mn) mn = d.bd; if (d.bd > mx) mx = d.bd; }
  const span = Math.max(1, mx - mn);
  const n = Math.max(outf.length, ds.length);
  const a = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      if (r >= outf.length || c >= ds.length) { row.push(0); continue; }
      const p = ps[outf[r]], d = ds[c];
      row.push((p._bd0 - d.bd) ** 2 + ((p._bw0 - d.bw) * 1.2) ** 2);
    }
    a.push(row);
  }
  const res = meHungarian(a, n);
  for (let r = 0; r < outf.length; r++) {
    const c = res[r], p = ps[outf[r]];
    const d = c >= 0 && c < ds.length ? ds[c] : { bd: p._bd0, bw: p._bw0 };
    p._dr = clamp((d.bd - mn) / span, 0, 1);
    p._dw = d.bw;
  }
}

// A substitution or a red card changes who is out there: roles and the defensive shape are re-dealt.
// A man nobody has set up yet forces it even when the roster reads the same: a squad that lists a
// player twice, once in the XI and once on the bench, can bring him on for himself, and the name and
// position the roster is keyed on never change.
function mindRoster(s, side) {
  const M = s.mePos.mind, k = rosterKey(s, side);
  if (M.roster[side] === k && !s.players[side].some(p => p && p._dn === undefined)) return;
  M.roster[side] = k;
  mindRoles(s, side);
  mindDefSlots(s, side);
  for (const p of s.players[side]) if (p && p._dn === undefined) initMan(s, p);
}

// ---- small geometry -----------------------------------------------------------------------------
const ownX = (side) => meGoalX(meOther(side));
const depthOf = (side, x) => (x - ownX(side)) * meDir(side);
const xAt = (side, d) => ownX(side) + meDir(side) * d;
const stratOf = (s, side) => s.strategy?.[side] || NO_INSTRUCTIONS;

// Where their lines are, in our depth: the back line (their deepest four), their midfield (the next
// four), and the offside line.
function oppLines(s, side) {
  const ds = [];
  for (const q of s.players[meOther(side)]) if (q && !q.off && q.pos !== "GK") ds.push(depthOf(side, q.x));
  ds.sort((a, b) => b - a);
  const avg = (a, b) => { let t = 0, n = 0; for (let k = a; k < Math.min(b, ds.length); k++) { t += ds[k]; n++; } return n ? t / n : null; };
  const back = avg(0, 4) ?? 70, mid = avg(4, 8) ?? back - 15;
  return { back, mid, off: depthOf(side, meOffsideLine(s, side)) };
}

// PATIENCE: how long a side will keep the ball going back and across before it has to go forward. A
// direct side (passingDir, approachPlay up) has almost none -- it wins it and goes, or it goes long; a
// possession side, told to play short and to hold it when it wins it, will recycle all day. It is used
// as a limit on what the man on the ball looks at (mind/decide.ts), never as a weight on what anything
// is worth.
export const mindPatience = (st) => clamp(0.5 - 0.2 * (st.passingDir || 0) - 0.15 * (st.approachPlay || 0)
                                          + ((st.possWon || 0) < 0 ? 0.15 : 0), 0, 1);

// ---- 1. THE PHASE --------------------------------------------------------------------------------
// How long after winning it a side goes for the throat, and how long after losing it it hunts the ball,
// are the possWon / possLost instructions; how high it presses is pressingLOE.
const counterWin = (st) => Math.round(((st.possWon || 0) > 0 ? 6.0 : (st.possWon || 0) < 0 ? 0 : 3.2) / ME_DT);
const cpWin = (st) => Math.round(((st.possLost || 0) > 0 ? 5.0 : (st.possLost || 0) < 0 ? 0.5 : 2.2) / ME_DT);
const engageD = (st, short) => ((st.pressingLOE || 0) - (short ? 1 : 0) >= 0 ? 66 - 8 * ((st.pressingLOE || 0) - (short ? 1 : 0)) : 999);
// Outfielders a side has on the pitch, and whether it is short of the ten it started with.
const shortOf = (s, side) => s.players[side].filter(p => p && !p.off && p.pos !== "GK").length < 10;
const blockCap = (st) => 32 + 6 * (st.defLine || 0);

function mindPhase(s, side) {
  const mp = s.mePos, M = mp.mind, P = M.ph[side], st = stratOf(s, side);
  const ours = mp.side === side, bD = depthOf(side, mp.bx);
  let ph;
  if (ours) {
    let ahead = 0;     // their outfielders between the ball and their goal
    for (const q of s.players[meOther(side)]) if (q && !q.off && q.pos !== "GK" && depthOf(side, q.x) > bD) ahead++;
    if (mp.tick - P.won < counterWin(st) && ahead <= 6 && bD < 88) ph = "counter";
    else ph = bD < MT.buildTo ? "build" : bD < MT.finalFrom ? "progress" : "final";
  } else {
    let behind = 0, near = 0;
    for (const q of s.players[side]) {
      if (!q || q.off || q.pos === "GK") continue;
      if (depthOf(side, q.x) < bD - 1) behind++;
      if (Math.hypot(q.x - mp.bx, q.y - mp.by) < MT.cpRange) near++;
    }
    if (mp.tick - P.lost < cpWin(st) && near >= 2) ph = "cpress";
    else if (behind < 5 && bD < 62) ph = "recover";
    else if (bD > engageD(st, shortOf(s, side))) ph = "press";
    else ph = "block";
  }
  if (ph === P.ph) { P.t++; P.cand = null; P.candT = 0; return; }
  if (P.cand === ph) P.candT++; else { P.cand = ph; P.candT = 1; }
  // Losing or winning the ball changes the phase at once; drifting from one band to the next waits.
  const flip = (ours !== (P.ph === "build" || P.ph === "progress" || P.ph === "final" || P.ph === "counter"));
  if (flip || ph === "cpress" || ph === "counter" || ph === "recover" || P.candT >= MT.phaseHold) {
    P.ph = ph; P.t = 0; P.cand = null; P.candT = 0;
  }
}

// ---- the tick ------------------------------------------------------------------------------------
export function mindTick(s, rng, out) {
  const mp = s.mePos, M = mp.mind;
  if (!M) return;
  // Possession changed hands: the winners' counter clock and the losers' counter-press clock start, and
  // every run of the side that lost it ends.
  if (M.lastSide !== mp.side) {
    if (M.ph[mp.side]) M.ph[mp.side].won = mp.tick;
    const lostS = meOther(mp.side);
    if (M.ph[lostS]) M.ph[lostS].lost = mp.tick;
    for (const q of s.players[lostS]) if (q) { q._run = null; q._runT = 0; }
    M.lastSide = mp.side; M.epi++;
    (M.recyc = M.recyc || { home: 0, away: 0 })[mp.side] = 0;
  }
  for (const side of ME_SIDES) { mindRoster(s, side); mindPhase(s, side); }
  // A beaten man is turning and chasing for a few slices; it runs down here, every slice. And whatever a
  // man was doing with the ball -- a knock, a shield, a feint -- ends when he no longer has it.
  for (const side of ME_SIDES) {
    const ps = s.players[side];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (!p) continue;
      if (p._beat > 0) p._beat--;
      if (!(mp.side === side && mp.idx === i)) { p._knockL = 0; p._dribV = 0; p._shield = false; p._fk = 0; }
    }
  }
  for (const side of ME_SIDES) {
    if (mp.side === side) mindAttack(s, side);
    else mindDefend(s, side);
  }
  // The keeper and the man on the ball, as the first brain places them.
  for (const side of ME_SIDES) {
    const ps = s.players[side];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p || p.off) continue;
      if (mp.side === side && mp.idx === i) { p._closing = false; mindCarrier(s, side, i); p._eff = 1; continue; }
      if (p.pos === "GK") { p._closing = false; p._gkGo = false; p._holdX = null; meKeeperPos(s, side, i); p._eff = 1; }
    }
  }
}

// ---- 2a. WITH THE BALL ---------------------------------------------------------------------------
function laneY(s, side, p, code, st) {
  const L = (p._bw0 ?? ME_HALF_W) < ME_HALF_W;           // the left of the pitch as his slot sits
  const w = st.width || 0;
  const wide = clamp(MT.laneWide0 - w * MT.laneWideStep, 1.5, 9);
  const half = MT.laneHalf - w * 0.8;
  switch (code) {
    case "wide": return L ? wide : PITCH_W - wide;
    case "half": return L ? half : PITCH_W - half;
    case "split": return L ? 12 - w : PITCH_W - 12 + w;
    case "center": return ME_HALF_W + ((p._bw0 ?? ME_HALF_W) - ME_HALF_W) * 0.35;
    default: return ME_HALF_W + ((p._bw0 ?? ME_HALF_W) - ME_HALF_W) * (0.82 + 0.06 * w);
  }
}

function lineD(code, g) {
  switch (code) {
    case "attack": return g.off - MT.attackOff;
    case "between": return g.between;
    case "high": return Math.min(g.between - 2, g.bD + 9);
    case "support": return g.bD + MT.supportAhead;
    case "hold": return (g.bD + MT.supportAhead + g.base) / 2;
    case "base": return g.base;
    case "deep": return g.deep;
    default: return g.bD;
  }
}

function mindAttack(s, side) {
  const mp = s.mePos, M = mp.mind, ps = s.players[side], st = stratOf(s, side), dir = meDir(side);
  const P = M.ph[side], ph = P.ph === "counter" ? "counter" : P.ph;
  const fam = FAM[s.styles?.[side]] || "bal", plan = FAMPLAN[fam];
  const drill = M.drill[side];
  const bD = depthOf(side, mp.bx);
  const ol = oppLines(s, side);
  const restGap = ph === "build" ? MT.restGapBuild : ph === "final" ? MT.restGapFinal : MT.restGapProg;
  const g = {
    bD, off: ol.off,
    between: clamp((ol.back + ol.mid) / 2, bD + MT.betweenMin, ol.off - 3),
    base: clamp(bD - restGap, MT.restFloor, MT.restCeil),
    deep: M.spDeep ?? clamp(Math.min(bD - 2, 14), 6, 20),
  };
  const phi = PH_IX[ph] ?? 1;
  const carrier = mp.idx >= 0 ? ps[mp.idx] : null;
  // The side's own back line, for the keeper's sweeping depth: the deepest outfield cell.
  let deepest = 99;
  // ---- CELLS ----
  const cells = [];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (!p || p.off || p.pos === "GK" || (mp.idx === i)) continue;
    const r = p._role2 || ROLES.cm;
    let y = laneY(s, side, p, r.lane[phi], st);
    let d = lineD(r.ln[phi], g) + (r.lnOff[phi] || 0);
    // A counter is the forwards on the last line and everybody else a step higher than usual.
    if (ph === "counter" && r.ln[1] !== "base" && r.ln[1] !== "deep" && r.rest < 0.7) d = Math.max(d, Math.min(g.off - 1, d + 8));
    // The whole shape leans toward the ball, except the far wide man, who keeps the switch on.
    const wideLane = r.lane[phi] === "wide";
    const farWide = wideLane && Math.sign(y - ME_HALF_W) !== Math.sign(mp.by - ME_HALF_W);
    if (!farWide) y += (mp.by - ME_HALF_W) * MT.ballShift * (wideLane ? 0.35 : 1);
    // Nobody but a man on the last line stands past it.
    d = Math.min(d, g.off - (r.ln[phi] === "attack" ? MT.attackOff : 2.5));
    d = clamp(d, 4, 101);
    y += p._dn[0] * MT.drillNoise * (1 - drill);
    d += p._dn[1] * MT.drillNoise * (1 - drill) * 0.7;
    cells.push({ i, p, r, y: clamp(y, 1.5, PITCH_W - 1.5), d, run: (p._runT ?? 0) > 0,
                 prio: r.rest * 3 + (wideLane ? 1 : 0) - Math.hypot(depthOf(side, p.x) - d, p.y - y) * 0.02 });
    if (r.rest >= 0.7 && d < deepest) deepest = d;
  }
  // ---- THE BOX, WHEN THE BALL IS WIDE ----
  // With the ball out wide in the last third a side fills the box -- near post, far post, the spot, and a
  // man on the edge for the cut-back -- with the men whose job it is to get there. A wide side sends more.
  // They hold the offside line until the ball comes in (the cells are clamped to it); the run at the ball
  // is the box run that goes with the cross.
  if ((ph === "final" || (ph === "progress" && bD > 64) || ph === "counter") && Math.abs(mp.by - ME_HALF_W) > 12) {
    const nearS = mp.by < ME_HALF_W ? -1 : 1;
    const boxN = 2 + ((st.width || 0) > 0 ? 1 : 0) + ((st.width || 0) > 1 ? 1 : 0) + (ph === "final" ? 1 : 0);
    const spots = [[99.5, nearS * 2.5], [98.5, -nearS * 4.5], [94, 0], [87.5, -nearS * 3]];
    const cand = cells.filter(c => !c.run && c.r.rest < 0.7 && Math.abs(c.p.y - mp.by) + Math.abs(depthOf(side, c.p.x) - bD) > 6)
                      .sort((a, b) => ((b.r.run.box || 0) - (a.r.run.box || 0))
                                      || (Math.hypot(depthOf(side, a.p.x) - 95, a.p.y - ME_HALF_W) - Math.hypot(depthOf(side, b.p.x) - 95, b.p.y - ME_HALF_W)));
    cand.slice(0, Math.min(boxN, spots.length)).forEach((c, k) => {
      c.d = spots[k][0]; c.y = ME_HALF_W + spots[k][1]; c.prio += 1.5; c.box = true;
    });
  }
  // ---- REST DEFENCE ----
  // In the last two phases the side keeps restN outfielders behind the ball; if the roles leave too
  // few, the most defensive of the rest are held back, at a width that covers the middle.
  if (ph === "progress" || ph === "final" || ph === "counter") {
    const need = Math.max(2, plan.restN - ((st.possLost || 0) > 0 ? 1 : 0) + ((st.possLost || 0) < 0 ? 1 : 0)
                             + (shortOf(s, side) ? 1 : 0));
    let have = 0;
    for (const c of cells) if (!c.run && c.d < bD - 4) have++;
    if (have < need) {
      const extra = cells.filter(c => !c.run && c.d >= bD - 4).sort((a, b) => b.r.rest - a.r.rest || a.d - b.d);
      for (const c of extra) {
        if (have >= need) break;
        c.d = Math.min(c.d, (g.base + bD) / 2);
        c.y = clamp(c.y, 16, PITCH_W - 16);
        c.prio += 2; have++;
      }
    }
  }
  // ---- NOBODY ON TOP OF ANYBODY ----
  // Placed in order of who has the better claim; a man whose cell is already taken moves to the nearest
  // free one -- inside or outside a lane, or a step up or back. This is the full-back overlapping and the
  // winger coming inside, and the striker dropping and the midfielder going past him.
  const placed = [];
  for (const c of cells) if (c.run) placed.push({ y: (c.p._ry ?? c.y), d: depthOf(side, c.p._rx ?? xAt(side, c.d)) });
  cells.sort((a, b) => b.prio - a.prio);
  const clash = (y, d) => placed.some(q => Math.abs(q.y - y) < MT.occLane && Math.abs(q.d - d) < MT.occDepth);
  for (const c of cells) {
    if (c.run) continue;
    if (clash(c.y, c.d)) {
      const ins = c.y < ME_HALF_W ? 1 : -1;
      const opts = [[ins * 9, 0], [-ins * 9, 0], [0, -8], [0, 8], [ins * 14, 0], [ins * 9, -6], [-ins * 9, -6], [ins * 9, 6], [0, -14]];
      for (const [oy, od] of opts) {
        const y2 = clamp(c.y + oy, 2, PITCH_W - 2), d2 = Math.min(c.d + od, g.off - 1.5);
        if (!clash(y2, d2)) { c.y = y2; c.d = d2; break; }
      }
    }
    placed.push({ y: c.y, d: c.d });
  }
  // ---- A RUN LEAVES A SPACE, AND SOMEBODY FILLS IT ----
  // A full-back who overlaps leaves the rest defence a man short; a midfielder who goes beyond leaves the
  // short option empty; a winger who comes inside leaves the width. The side's own principle refills it:
  // the nearest man whose own job matters less steps into it, so the shape keeps its bones while the
  // move goes on. (This is the rotation: positions are occupied, not owned.)
  {
    const imp = (c) => (c.r.rest >= 0.7 || c.r.ln[phi] === "base" || c.r.ln[phi] === "hold") ? 3
      : ((c.r.lane[phi] === "wide" && ph !== "build" && Math.sign(c.y - ME_HALF_W) === Math.sign(mp.by - ME_HALF_W))
         || (c.r.ln[phi] === "support" && Math.hypot(xAt(side, c.d) - mp.bx, c.y - mp.by) < 22)) ? 2 : 1;
    for (const v of cells) {
      if (!v.run) continue;
      const iv = imp(v);
      if (iv < 2) continue;
      const vx = xAt(side, v.d);
      if (cells.some(c => !c.run && Math.hypot(xAt(side, c.d) - vx, c.y - v.y) < 7)) continue;
      let f = null, fc = Infinity;
      for (const c of cells) {
        if (c.run || c.fill || imp(c) >= iv) continue;
        const dd = Math.hypot(c.p.x - vx, c.p.y - v.y);
        const cost = dd + imp(c) * 6;
        if (dd < 24 && cost < fc) { fc = cost; f = c; }
      }
      if (f) { f.y = v.y; f.d = v.d; f.fill = true; }
    }
  }
  // ---- WHERE THE PASSER CAN SEE HIM ----
  // Each man looks round his cell for the spot with a lane the man on the ball can play through, away from
  // whoever is on him and not on top of a team-mate. Re-solved every few slices, staggered, and only
  // changed for something clearly better.
  for (const c of cells) {
    const p = c.p;
    if (c.run) { mindRunTarget(s, side, p, g); continue; }
    if ((mp.tick + c.i) % MT.refineEvery === 0) {
      let best = 0, bdx = p._rdx || 0, bdy = p._rdy || 0, first = true;
      for (const [ox, oy] of REF) {
        const cy = clamp(c.y + oy * MT.refineR, 1.5, PITCH_W - 1.5);
        const cd = Math.min(c.d + ox * MT.refineR, g.off - (c.r.ln[phi] === "attack" ? MT.attackOff : 1.5));
        const cx = xAt(side, cd);
        const sc = refineScore(s, side, p, carrier, cx, cy) - Math.hypot(ox, oy) * MT.refineR * 0.045;
        if (first || sc > best + (ox === p._rdx0 && oy === p._rdy0 ? -0.04 : 0)) { best = sc; bdx = ox; bdy = oy; first = false; }
      }
      p._rdx0 = bdx; p._rdy0 = bdy;
      p._rdx = bdx; p._rdy = bdy;
    }
    const ty = clamp(c.y + (p._rdy || 0) * MT.refineR, 1.5, PITCH_W - 1.5);
    const td = Math.min(c.d + (p._rdx || 0) * MT.refineR, g.off - (c.r.ln[phi] === "attack" ? MT.attackOff : 1.5));
    setTarget(p, xAt(side, td), ty, 0.35);
    p._duty = c.r.rest >= 0.7 ? "hold" : c.r.lane[phi] === "wide" ? "width" : "support";
    p._closing = false;
    // GETTING FREE. A man with somebody on his back, in range of the passer, does not stand and wait to
    // be marked out of it: he takes his man away a couple of strides, then comes back short, quick, and
    // the gap he made is where the ball goes. A good reader does it more, a drilled side does it on cue.
    if (p._chk) { p._chk.t--; if (p._chk.t <= 0 || !carrier) p._chk = null; }
    if (!p._chk && carrier && c.r.rest < 0.9 && (mp.tick + c.i) % 2 === 0) {
      const dc = Math.hypot(p.x - carrier.x, p.y - carrier.y);
      if (dc > 7 && dc < 26 && roomAt(s, side, p.x, p.y) < 2.6
          && mindRand(M) < 0.16 * (0.5 + mindAware(p)) * (0.6 + 0.6 * drill)) p._chk = { t: 4 };
    }
    if (p._chk) {
      const ux = p.x - carrier.x, uy = p.y - carrier.y, ul = Math.hypot(ux, uy) || 1;
      if (p._chk.t > 2) setTarget(p, p.x + ux / ul * 2.6, p.y + uy / ul * 2.6, 1);
      else setTarget(p, p.x - ux / ul * 4.5, p.y - uy / ul * 4.5, 1);
      p._eff = MT.effSprint; p._closing = true; p._duty = "show";
      continue;
    }
    // How hard he works to get there: a counter is run at, a build-up is walked into.
    const dist = Math.hypot(p.x - p._tx, p.y - p._ty);
    let eff = dist > 14 ? 0.85 : dist > 6 ? 0.72 : MT.effJog;
    if (ph === "counter" && c.r.rest < 0.7) eff = Math.max(eff, dist > 4 ? 0.95 : 0.7);
    if (ph === "build") eff = Math.min(eff, 0.7);
    p._eff = eff * (0.86 + 0.14 * mindAware(p));
  }
  // ---- THE TRIANGLE ----
  // Holding lanes is how a side keeps its shape; it is not how the man on the ball keeps it. He needs two
  // team-mates close enough to play to and on angles a defender cannot cut out together -- one ahead of
  // him and inside, one behind him and inside -- and a side that plays through the thirds gives him them.
  // When he has fewer than two open short options, the nearest men who are free to come do, to the spot
  // on that angle with the clearest lane, and the shape around them stays as it was.
  if (carrier && carrier.pos !== "GK") supportTriangle(s, side, carrier, cells, g);
  // The keeper sweeps behind the line his side's deepest men are holding.
  (mp.blk[side] = mp.blk[side] || { line: 20, cy: ME_HALF_W, depth: 20 }).line = clamp(deepest === 99 ? bD - 25 : deepest, 6, 60);
  mindRuns(s, side, ph, g, carrier);
  mindPatterns(s, side, ph, g, carrier);
}

// ---- SIGNATURE MOVES ------------------------------------------------------------------------------
// Each style has a few moves it drills, and reaches for when the moment appears. A move is a cue (who has
// it, where, and who is placed where), the runs it sends, and the pass the man on the ball has been drilled
// to look for -- a bonus in his pricing of exactly that ball, sized by how drilled the side is and how much
// he sees. The other ten do not wait to be told: the runs start on the cue.
//   third man (possession styles): a ball into a man between the lines with his back to goal, a third man
//     going in behind for the lay-off and the ball through.
//   overlap and cross (wide styles): the full-back round the winger on the ball, the box filled for the cross.
//   switch (wide and possession): one flank crowded, the far side free: the ball goes across.
//   over the top (counter and block styles, and any side breaking): the forward goes the moment it is won.
//   second ball (direct): see mindOnPass -- the long ball's landing zone is swarmed.
const PAT_FAMS = {
  thirdman: { pos: 1, vert: 1, flair: 1, zona: 0.6, bal: 0.4, press: 0.5 },
  overlap:  { wide: 1, press: 0.6, bal: 0.5, direct: 0.4, counter: 0.3, flair: 0.4 },
  switch:   { wide: 1, pos: 0.8, bal: 0.5, vert: 0.5, zona: 0.4 },
  overtop:  { counter: 1, block: 0.9, catenaccio: 0.9, bus: 0.8, direct: 0.7, press: 0.6, vert: 0.5, bal: 0.4 },
};
function mindPatterns(s, side, ph, g, carrier) {
  const mp = s.mePos, M = mp.mind, ps = s.players[side], dir = meDir(side), drill = M.drill[side];
  const fam = FAM[s.styles?.[side]] || "bal";
  M.pat = M.pat || { home: null, away: null };
  const cur = M.pat[side];
  if (cur && (mp.tick > cur.until || mp.side !== side)) M.pat[side] = null;
  if (M.pat[side] || !carrier || carrier.pos === "GK") return;
  if ((M.patCool?.[side] ?? 0) > mp.tick) return;
  const ci = ps.indexOf(carrier), cr = carrier._role2 || ROLES.cm, cD = depthOf(side, carrier.x);
  const opp = s.players[meOther(side)];
  const free = (q) => roomAt(s, side, q.x, q.y);
  const tryStart = (k, w, pat) => {
    const want = (PAT_FAMS[k]?.[fam] ?? 0) * w * (0.35 + 0.65 * drill) * (0.6 + 0.4 * mindAware(carrier));
    if (want <= 0 || mindRand(M) >= want * 0.35) return false;
    pat.k = k; pat.until = mp.tick + (pat.dur || 14); pat.from = ci;
    M.pat[side] = pat;
    (M.patCool = M.patCool || { home: 0, away: 0 })[side] = mp.tick + 20;
    (M.patN = M.patN || {})[k] = (M.patN[k] || 0) + 1;
    return true;
  };
  // THIRD MAN.
  if (PAT_FAMS.thirdman[fam] && cD > 25 && cD < 75 && (ph === "build" || ph === "progress")) {
    let wall = -1, wd = Infinity;
    for (let j = 0; j < ps.length; j++) {
      const q = ps[j];
      if (!q || q === carrier || q.off || q.pos === "GK" || (q._runT ?? 0) > 0) continue;
      const qd = depthOf(side, q.x), d = Math.hypot(q.x - carrier.x, q.y - carrier.y);
      if (qd < cD + 6 || d > 24 || free(q) > 3.5) continue;          // ahead of the ball, marked: a wall
      if (d < wd) { wd = d; wall = j; }
    }
    if (wall >= 0) {
      let run = -1, rs = -Infinity;
      for (let j = 0; j < ps.length; j++) {
        const q = ps[j];
        if (!q || j === wall || q === carrier || q.off || q.pos === "GK" || (q._runT ?? 0) > 0) continue;
        const qr = q._role2 || ROLES.cm, qd = depthOf(side, q.x);
        if (((qr.run.behind || 0) + (qr.run.third || 0)) < 0.4 || qd < g.off - 14 || qd > g.off - 0.5) continue;
        const sc = qd - Math.abs(q.y - ps[wall].y) * 0.3;
        if (sc > rs) { rs = sc; run = j; }
      }
      if (run >= 0 && tryStart("thirdman", 1, { j: wall, kinds: ["feet"], runner: run, dur: 14 })) return;
    }
  }
  // OVERLAP AND CROSS.
  if (PAT_FAMS.overlap[fam] && (ph === "progress" || ph === "final") && Math.abs(carrier.y - ME_HALF_W) > 14) {
    let fb = -1, fd = Infinity;
    for (let j = 0; j < ps.length; j++) {
      const q = ps[j];
      if (!q || q === carrier || q.off || (q._runT ?? 0) > 0) continue;
      const qr = q._role2 || ROLES.cm;
      if ((qr.run.overlap || 0) < 0.3 || Math.sign(q.y - ME_HALF_W) !== Math.sign(carrier.y - ME_HALF_W)) continue;
      const qd = depthOf(side, q.x), d = Math.hypot(q.x - carrier.x, q.y - carrier.y);
      if (qd > cD + 2 || d > 22) continue;
      if (d < fd) { fd = d; fb = j; }
    }
    if (fb >= 0 && tryStart("overlap", 1, { j: fb, kinds: ["through", "space", "feet"], dur: 16 })) {
      const ny = carrier.y < ME_HALF_W ? 3.5 : PITCH_W - 3.5;
      startRun(s, side, ps[fb], "overlap", Math.min(g.off + 6, cD + 14), ny);
      // ...and the box fills for the cross that is coming.
      boxRuns(s, side, carrier, ps[fb], g);
      return;
    }
  }
  // SWITCH.
  if (PAT_FAMS.switch[fam] && ph === "progress" && Math.abs(carrier.y - ME_HALF_W) > 8) {
    let crowd = 0;
    for (const q of opp) if (q && !q.off && Math.hypot(q.x - carrier.x, q.y - carrier.y) < 13) crowd++;
    if (crowd >= 4) {
      let far = -1, fr = 0;
      for (let j = 0; j < ps.length; j++) {
        const q = ps[j];
        if (!q || q === carrier || q.off || q.pos === "GK") continue;
        if (Math.sign(q.y - ME_HALF_W) === Math.sign(carrier.y - ME_HALF_W) || Math.abs(q.y - ME_HALF_W) < 16) continue;
        const r = free(q);
        if (r > 9 && r > fr) { fr = r; far = j; }
      }
      if (far >= 0 && tryStart("switch", 1, { j: far, kinds: ["switch", "long"], dur: 8 })) return;
    }
  }
  // OVER THE TOP.
  const cUp = Math.abs(angDiff(carrier._face ?? 0, dir > 0 ? 0 : Math.PI)) < 1.2 && mePressure(s, side, carrier.x, carrier.y) < 1.2;
  if (PAT_FAMS.overtop[fam] && cUp && (ph === "counter" || (cD < 60 && (cr.rest >= 0.5 || cr.risk > 0.2)))) {
    let fw = -1, fs = 0;
    for (let j = 0; j < ps.length; j++) {
      const q = ps[j];
      if (!q || q === carrier || q.off || q.pos === "GK" || (q._runT ?? 0) > 0) continue;
      const qr = q._role2 || ROLES.cm, qd = depthOf(side, q.x);
      if ((qr.run.behind || 0) < 0.4 || qd < g.off - 6) continue;
      const room = roomAt(s, side, xAt(side, Math.min(100, g.off + 12)), q.y);
      if (room > 9 && room > fs) { fs = room; fw = j; }
    }
    if (fw >= 0 && tryStart("overtop", ph === "counter" ? 1.4 : 0.4, { j: fw, kinds: ["over", "through"], dur: 10 })) {
      startRun(s, side, ps[fw], "behind", g.off + MT.runBehindL, ps[fw].y + (ME_HALF_W - ps[fw].y) * 0.3);
      ps[fw]._rHold = 0;
      return;
    }
  }
}

// THE BOX, FOR A CROSS: whoever attacks the box goes -- near post, the spot, the far post -- as the ball
// goes wide, not once it is already in the air.
function boxRuns(s, side, carrier, wide, g) {
  const ps = s.players[side];
  const near = carrier.y < ME_HALF_W ? -1 : 1;
  const spots = [[5.5, near * 2.5], [11, 0], [6.5, -near * 4.5]];
  const cand = ps.filter(q => q && q !== carrier && q !== wide && !q.off && q.pos !== "GK" && !((q._runT ?? 0) > 0)
                       && ((q._role2?.run?.box || 0) > 0.4))
                 .sort((a, b) => (b._role2.run.box - a._role2.run.box));
  cand.slice(0, 3).forEach((q, k) => startRun(s, side, q, "box", 105 - spots[k][0], ME_HALF_W + spots[k][1]));
}

function supportTriangle(s, side, c, cells, g) {
  const dir = meDir(side), ps = s.players[side];
  const laneOpen = (x, y) => 1 - Math.min(1, meLaneBlock(s, side, c.x, c.y, x, y) / 1.2);
  let open = 0;
  for (const q of ps) {
    if (!q || q === c || q.off || q.pos === "GK") continue;
    const d = Math.hypot(q.x - c.x, q.y - c.y);
    if (d > 4.5 && d < 16 && laneOpen(q.x, q.y) > 0.6 && roomAt(s, side, q.x, q.y) > 2.5) open++;
  }
  if (open >= 2) return;
  const ins = c.y < ME_HALF_W ? 1 : -1;                     // toward the middle
  const wantSpots = [[7.5, 7.5], [-6.5, 8.5], [9, -3]].map(([fx, fy]) => [c.x + dir * fx, c.y + ins * fy]);
  const used = new Set();
  for (const [sx0, sy0] of wantSpots.slice(0, 2 - open + (open === 0 ? 0 : 0))) {
    // the man: nearest free one, not a rest-defence centre-half unless the ball is deep, not on a run
    let best = null, bd = Infinity;
    for (const cl of cells) {
      const q = cl.p;
      if (cl.run || used.has(q) || q === c || (q._runT ?? 0) > 0) continue;
      if (cl.r.rest >= 0.9 && depthOf(side, c.x) > 40) continue;
      const d = Math.hypot(q.x - sx0, q.y - sy0);
      if (d < bd) { bd = d; best = cl; }
    }
    if (!best || bd > 22) continue;
    used.add(best.p);
    // the spot on that angle with the clearest lane, onside and on the pitch
    let bx = sx0, by = sy0, bs = -Infinity;
    for (const [ox, oy] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
      const x = clamp(sx0 + ox, 2, PITCH_L - 2), y = clamp(sy0 + oy, 2, PITCH_W - 2);
      if (depthOf(side, x) > g.off - 1) continue;
      const sc = laneOpen(x, y) + Math.min(6, roomAt(s, side, x, y)) * 0.08 - Math.hypot(ox, oy) * 0.03;
      if (sc > bs) { bs = sc; bx = x; by = y; }
    }
    const p = best.p;
    setTarget(p, bx, by, 0.6);
    p._duty = "support"; p._closing = true;
    p._eff = Math.max(p._eff ?? 0, Math.hypot(p.x - bx, p.y - by) > 5 ? MT.effRun : MT.effJog);
  }
}

// Nine spots round his cell: in front, behind, either side, and the corners.
const REF = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7]];

function refineScore(s, side, p, carrier, x, y) {
  const opp = s.players[meOther(side)];
  let near = 99;
  for (const q of opp) if (q && !q.off) { const d = Math.hypot(q.x - x, q.y - y); if (d < near) near = d; }
  let crowd = 0;
  for (const q of s.players[side]) if (q && q !== p && !q.off) { const d = Math.hypot(q.x - x, q.y - y); if (d < 6) crowd += (6 - d) / 6; }
  let lane = 0.5;
  if (carrier) {
    const L = Math.hypot(x - carrier.x, y - carrier.y);
    if (L > 3 && L < 42) lane = 1 - Math.min(1, meLaneBlock(s, side, carrier.x, carrier.y, x, y) / 1.2);
    else if (L <= 3) lane = 0.2;
  }
  return lane * 0.55 + Math.min(9, near) * 0.05 - crowd * 0.3;
}

// Move his steering target toward a point, eased unless he must get there at once.
function setTarget(p, x, y, ease) {
  x = clamp(x, 1.5, PITCH_L - 1.5); y = clamp(y, 1.5, PITCH_W - 1.5);
  if (p._tx === undefined || ease >= 1) { p._tx = x; p._ty = y; return; }
  p._tx += (x - p._tx) * ease; p._ty += (y - p._ty) * ease;
}

// ---- 4. RUNS ---------------------------------------------------------------------------------------
const RUN_T = { behind: 12, overlap: 12, underlap: 10, drop: 8, box: 11, third: 10, wall: 8 };

function mindRuns(s, side, ph, g, carrier) {
  const mp = s.mePos, M = mp.mind, ps = s.players[side], st = stratOf(s, side), dir = meDir(side);
  const drill = M.drill[side];
  for (const p of ps) if (p && (p._cool ?? 0) > 0) p._cool--;
  if (!carrier || (mp.tick % MT.runEvery) !== 0) return;
  if (ph === "build" && (st.passingDir || 0) < 1) return;
  let active = 0;
  for (const p of ps) if (p && !p.off && (p._runT ?? 0) > 0) active++;
  const cap = MT.runMaxBase + Math.max(0, st.creativity || 0) + (ph === "counter" ? 1 : 0) + (ph === "final" ? 1 : 0);
  if (active >= cap) return;
  const cD = depthOf(side, carrier.x);
  const cAw = mindAware(carrier);
  // CAN HE PLAY IT? A run is made for the man on the ball, and only when he can see it and has time.
  const cFace = Math.abs(angDiff(carrier._face ?? 0, dir > 0 ? 0 : Math.PI));
  const cPress = mePressure(s, side, carrier.x, carrier.y);
  const canPlay = clamp((1.6 - cFace) / 1.0, 0, 1) * clamp((1.8 - cPress) / 1.2, 0, 1);
  const wide = Math.abs(carrier.y - ME_HALF_W) > 15;
  let best = null, bestU = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (!p || p.off || p.pos === "GK" || p === carrier || (p._runT ?? 0) > 0 || (p._cool ?? 0) > 0) continue;
    const r = p._role2 || ROLES.cm;
    const pd = depthOf(side, p.x);
    const sameFlank = Math.sign(p.y - ME_HALF_W) === Math.sign(carrier.y - ME_HALF_W);
    const consider = (kind, u, rx, ry) => {
      if (u > bestU) { bestU = u; best = { p, kind, rx, ry }; }
    };
    // IN BEHIND: a man near the last line with grass beyond it in his lane, and a passer who can play it.
    if ((r.run.behind || 0) > 0 && pd > g.off - 9 && canPlay > 0.25) {
      const tx = g.off + MT.runBehindL, ty = p.y + (ME_HALF_W - p.y) * 0.3;
      const room = roomAt(s, side, xAt(side, Math.min(100, tx)), ty);
      if (room > MT.runSpace) consider("behind", r.run.behind * canPlay * Math.min(1, room / 14) * (ph === "counter" ? 1.4 : 1), tx, ty);
    }
    // OVERLAP / UNDERLAP: round or inside a team-mate on the ball out wide on his own flank.
    if (wide && sameFlank && pd < cD + 2 && pd > cD - 18) {
      const ny = carrier.y < ME_HALF_W ? 3.5 : PITCH_W - 3.5;
      if ((r.run.overlap || 0) > 0) consider("overlap", r.run.overlap * 0.9, Math.min(g.off + 4, cD + 12), ny);
      if ((r.run.underlap || 0) > 0)
        consider("underlap", r.run.underlap * 0.9, Math.min(g.off + 3, cD + 11), carrier.y < ME_HALF_W ? 17 : PITCH_W - 17);
    }
    // COMING SHORT: a forward with a man on his back drops into the space between the lines.
    if ((r.run.drop || 0) > 0 && pd > cD + 12 && cD > 25 && cD < 72) {
      const mk = roomAt(s, side, p.x, p.y);
      if (mk < 3.5) consider("drop", r.run.drop * 0.8, cD + 11, clamp(p.y, 22, PITCH_W - 22));
    }
    // THE BOX: with the ball wide in the last third, the box men go for the near post, the spot, the far post.
    if ((r.run.box || 0) > 0 && wide && cD > 76 - Math.max(0, st.width || 0) * 4 && pd > 58) {
      const near = carrier.y < ME_HALF_W ? -1 : 1;
      const slot = (M.boxN = ((M.boxN || 0) + 1) % 3);
      const spots = [[5.5, near * 2.5], [11, 0], [6.5, -near * 4.5]];
      const sp2 = spots[slot % spots.length];
      consider("box", r.run.box * 0.95, 105 - sp2[0], ME_HALF_W + sp2[1]);
    }
  }
  if (!best) return;
  // How often a good run is made, out of all the moments it could be: the reader, and the drilling.
  const want = clamp(bestU * 0.42 * (0.55 + 0.45 * mindAware(best.p)) * (0.65 + 0.55 * drill) * (0.8 + 0.4 * cAw), 0, 0.7);
  if (mindRand(M) >= want) return;
  startRun(s, side, best.p, best.kind, best.rx, best.ry);
  // A RUN ANSWERS A RUN. A striker coming short has dragged a centre-half with him; the man best placed
  // to go into the space he left goes now.
  if (best.kind === "drop") {
    let q2 = null, qd = Infinity;
    for (const q of ps) {
      if (!q || q.off || q === best.p || q === carrier || (q._runT ?? 0) > 0 || !((q._role2?.run?.behind || 0) > 0.3)) continue;
      const d = Math.hypot(q.x - best.p.x, q.y - best.p.y);
      if (d < qd && d < 24) { qd = d; q2 = q; }
    }
    if (q2 && mindRand(M) < 0.45 + 0.4 * drill) startRun(s, side, q2, "behind", g.off + MT.runBehindL, ME_HALF_W + (q2.y - ME_HALF_W) * 0.45);
  }
}

function startRun(s, side, p, kind, rd, ry) {
  p._run = kind === "behind" ? "behind" : kind === "overlap" || kind === "underlap" ? "overlap" : kind === "third" ? "third"
         : kind === "wall" ? "wall" : kind;
  p._rk = kind;
  p._runT = RUN_T[kind] || 10;
  p._rx = xAt(side, clamp(rd, 3, 102)); p._ry = clamp(ry, 2, PITCH_W - 2);
  p._rHold = kind === "behind" ? MT.runHoldMax : 0;
  p._cool = 0;
}

// Open grass at a point: the nearest outfield opponent's distance.
function roomAt(s, side, x, y) {
  let d = 99;
  for (const q of s.players[meOther(side)]) if (q && !q.off && q.pos !== "GK") d = Math.min(d, Math.hypot(q.x - x, q.y - y));
  return d;
}

// A man on a run: where he is going, and how he times it. In behind he walks the line until the passer
// can play him, then goes; anybody else is going now. A run that has done its job, or whose passer has
// turned away, is over.
function mindRunTarget(s, side, p, g) {
  const mp = s.mePos, dir = meDir(side);
  p._runT--;
  p._closing = true;
  const played = mp.flight && mp.fside === side && mp.fj === s.players[side].indexOf(p);
  if (p._rk === "behind" && !played && (p._rHold ?? 0) > 0) {
    const carrier = mp.idx >= 0 && mp.side === side ? s.players[side][mp.idx] : null;
    const cFace = carrier ? Math.abs(angDiff(carrier._face ?? 0, dir > 0 ? 0 : Math.PI)) : 3;
    const ready = carrier && cFace < 1.15 && mePressure(s, side, carrier.x, carrier.y) < 1.6;
    if (!ready) {
      // On the shoulder, onside, drifting to where he will go from.
      p._rHold--;
      setTarget(p, xAt(side, g.off - 0.8), p._ry, 0.5);
      p._eff = MT.effJog;
      p._duty = "runner";
      if (p._rHold <= 0) { p._run = null; p._runT = 0; p._cool = MT.runCool; }
      return;
    }
    p._rHold = 0;
  }
  setTarget(p, p._rx, p._ry, 1);
  p._eff = MT.effSprint;
  p._duty = "runner";
  if (Math.hypot(p.x - p._rx, p.y - p._ry) < 1.5 || p._runT <= 0) { p._run = null; p._runT = 0; p._cool = MT.runCool; }
}

// THE PASS IS STRUCK: does the passer go, and does a third man go? Instead of the first brain's dice,
// each is a run with a reason: a give-and-go needs grass beyond his marker and a man who makes them; the
// third man needs a ball into feet that will be laid off, and somebody onside with room behind the line.
export function mindOnPass(s, side, i, act) {
  const mp = s.mePos, M = mp.mind;
  if (!M) return;
  const us = s.players[side], p = us[i], q = us[act.j];
  if (!p || !q || act.k !== "pass") return;
  const st = stratOf(s, side), dir = meDir(side), drill = M.drill[side];
  mp._lastPassBack = act.ax !== undefined && (act.ax - p.x) * dir < -3 ? side : null;
  // Who gave it to whom, and which way the last switch went, for the two limits in mind/decide.ts.
  q._gotFrom = i; q._gotT = mp.tick;
  if (act.pk === "switch") M.lastSw = { side, t: mp.tick, from: Math.sign(p.y - ME_HALF_W) };
  // HOW MANY TIMES IT HAS GONE BACK OR ACROSS in our own half without going forward. A side's patience
  // (mindPatience) is how many of those it will put up with before it has to go forward.
  {
    const R = (M.recyc = M.recyc || { home: 0, away: 0 });
    const fwd = act.ax !== undefined ? (act.ax - p.x) * dir : 0;
    if (fwd > 8) R[side] = 0;
    else if (fwd < 2 && depthOf(side, p.x) < PITCH_L / 2) R[side]++;
  }
  // THE DRILLED MOVE GOES ON. The ball into the wall sends the third man and asks the wall for the lay-off
  // or the ball through; the ball into the overlap fills the box.
  const pat = M.pat?.[side];
  if (pat && act.j === pat.j) {
    if (pat.k === "thirdman" && pat.runner >= 0 && us[pat.runner] && !(us[pat.runner]._runT > 0)) {
      const rn = us[pat.runner];
      startRun(s, side, rn, "third", depthOf(side, meOffsideLine(s, side)) + MT.runBehindL - 3, rn.y + (ME_HALF_W - rn.y) * 0.35);
      rn._rHold = 0;
      M.pat[side] = { k: "thirdman2", j: pat.runner, kinds: ["through", "space", "over"], back: i, until: mp.tick + 10 };
    } else M.pat[side] = null;
  }
  // THE SECOND BALL. A long ball at a big man: the midfield gets to where it will drop, and somebody goes
  // beyond him for the flick.
  const fam = FAM[s.styles?.[side]] || "bal";
  if (fam === "direct" && act.high && (q._role2 === ROLES.st_target || (q._role2?.hold ?? 0) > 0)) {
    const lx = act.ax ?? q.x, ly = act.ay ?? q.y;
    const mids = us.filter(z => z && z !== p && z !== q && !z.off && z.pos === "MID" && !((z._runT ?? 0) > 0))
                   .sort((a, b) => Math.hypot(a.x - lx, a.y - ly) - Math.hypot(b.x - lx, b.y - ly)).slice(0, 2);
    mids.forEach((z, k) => startRun(s, side, z, "box", depthOf(side, lx) - 7, ly + (k ? 7 : -7)));
    const pc = us.find(z => z && z !== q && !z.off && z._role2 === ROLES.st_poach && !((z._runT ?? 0) > 0));
    if (pc) { startRun(s, side, pc, "behind", depthOf(side, lx) + 9, ly); pc._rHold = 0; }
  }
  let active = 0;
  for (const z of us) if (z && !z.off && (z._runT ?? 0) > 0) active++;
  const cap = MT.runMaxBase + 1 + Math.max(0, st.creativity || 0);
  const g = { off: depthOf(side, meOffsideLine(s, side)) };
  const pd = depthOf(side, p.x);
  // GIVE AND GO.
  const r = p._role2 || ROLES.cm;
  const goer = p.pos !== "GK" && r.rest < 0.7 && pd > 30;
  const d = Math.hypot(q.x - p.x, q.y - p.y);
  // A give-and-go is for getting past the man in front of him: no man to beat, no reason to go.
  let beat = false;
  for (const z of s.players[meOther(side)]) {
    if (!z || z.off || z.pos === "GK") continue;
    const ahead = (z.x - p.x) * dir;
    if (ahead > -1 && ahead < 7 && Math.abs(z.y - p.y) < 5) { beat = true; break; }
  }
  if (goer && beat && active < cap && !act.high && d < 20 && (q.x - p.x) * dir > -4) {
    const ry = clamp(p.y + (q.y > p.y ? -3 : 3), 4, PITCH_W - 4);
    const rd = Math.min(g.off + 2, pd + 11);
    const room = roomAt(s, side, xAt(side, rd), ry);
    const want = clamp(0.08 + 0.12 * ((st.passingDir || 0) < 0 ? 1 : 0) + 0.12 * drill + 0.06 * (st.creativity || 0), 0, 0.45)
               * Math.min(1, room / 6);
    if (mindRand(M) < want) { startRun(s, side, p, "wall", rd, ry); active++; }
  }
  // THE THIRD MAN: a ball into feet, a man ahead of it with room behind the line.
  if (active >= cap || act.thru || act.high) return;
  const qd = depthOf(side, q.x);
  if (qd < 38) return;
  let bi = null, bsc = -Infinity;
  for (const c of us) {
    if (!c || c === p || c === q || c.off || c.pos === "GK" || (c._runT ?? 0) > 0 || (c._cool ?? 0) > 0) continue;
    const rc = c._role2 || ROLES.cm;
    if (!((rc.run.third || 0) + (rc.run.behind || 0) > 0.3)) continue;
    const cd = depthOf(side, c.x);
    if (Math.hypot(c.x - q.x, c.y - q.y) > 24 || cd > g.off - 0.5 || cd < qd - 6) continue;
    if (roomAt(s, side, xAt(side, g.off + 8), c.y) < 5) continue;
    const sc = cd - qd - Math.abs(c.y - q.y) * 0.3 + ((rc.run.third || 0) * 6);
    if (sc > bsc) { bsc = sc; bi = c; }
  }
  if (!bi) return;
  const want = clamp(0.25 + 0.35 * drill + 0.2 * mindAware(q), 0, 0.8);
  if (mindRand(M) < want) startRun(s, side, bi, "third", g.off + MT.runBehindL - 3, bi.y + (ME_HALF_W - bi.y) * 0.35);
}

// ---- 2b/3. WITHOUT THE BALL ----------------------------------------------------------------------
function mindDefend(s, side) {
  const mp = s.mePos, M = mp.mind, us = s.players[side], them = s.players[meOther(side)];
  const st = stratOf(s, side), dir = meDir(side), own = ownX(side);
  const P = M.ph[side], ph = P.ph;
  const fam = FAM[s.styles?.[side]] || "bal", plan = FAMPLAN[fam];
  const drill = M.drill[side];
  const bD = depthOf(side, mp.bx);
  const carrier = mp.idx >= 0 && mp.side !== side ? them[mp.idx] : null;
  // ---- THE BACK LINE'S HEIGHT, set by the man on the ball (the first brain's rule, kept) ----
  let gap = CFG.lnGapLoose, bDeff = bD;
  if (carrier && !mp.sp) {
    let nd = Infinity;
    for (const q of us) if (q && !q.off && q.pos !== "GK") nd = Math.min(nd, Math.hypot(q.x - carrier.x, q.y - carrier.y));
    const pr = clamp((CFG.lnPressFar - nd) / (CFG.lnPressFar - CFG.lnPressNear), 0, 1);
    const tv = -((carrier.vx || 0) / ME_DT) * dir;
    const fw = clamp(tv / CFG.lnFwdV, 0, 1), bk = clamp(-tv / CFG.lnBackV, 0, 1);
    // ...and which way he is FACING, which the first brain could not know: a man with his back to our
    // goal cannot play behind us, whoever is near him.
    const facing = carrier._face !== undefined ? Math.cos(angDiff(carrier._face, dir > 0 ? Math.PI : 0)) : 0.5;
    const threat = (1 - pr) * (CFG.lnFacing + (1 - CFG.lnFacing) * fw) * (1 - bk) * (0.55 + 0.45 * Math.max(0, facing));
    gap = CFG.lnGapPress + (CFG.lnGapFree - CFG.lnGapPress) * threat;
  } else if (mp.idx < 0 && mp.pred && !mp.sp) {
    const pd = mp.pred[CFG.lnLook];
    if (pd) bDeff = Math.min(bD, depthOf(side, pd[0]));
  }
  const dlb = st.dlBehavior || 0;
  let dlA = dlb < 0 ? -CFG.dlDrop : dlb * CFG.dlStep;
  if (dlb === 2 && carrier && mp.hold >= CFG.trapHold) dlA += CFG.trapStep;
  let cap = blockCap(st) + dlA;
  if (ph === "press" || ph === "cpress") cap += 8;
  let want = clamp(bDeff - gap + dlA, CFG.lnFloor, cap);
  if (ph === "recover") want = Math.min(want, bD - 18);
  want = clamp(want, CFG.lnFloor, CFG.blkCeil);
  const mv = MT.lineSlew * ME_DT * (want < M.L[side] ? 1.25 : 1);
  M.L[side] += clamp(want - M.L[side], -mv, mv);
  const L = M.L[side];
  (mp.blk[side] = mp.blk[side] || { line: L, cy: ME_HALF_W, depth: 20 }).line = L;
  const len = ph === "press" || ph === "cpress" ? MT.blockLenPress : L < 22 ? MT.blockLenLow : MT.blockLen0;
  // The far full-back stays near the far post: the block slides, it does not abandon the far side.
  const cy = clamp(ME_HALF_W + (mp.by - ME_HALF_W) * MT.blockSlide, 24, PITCH_W - 24);
  mp.blk[side].cy = cy; mp.blk[side].depth = len;
  // ---- READING A PASS INTO ONE OF THEIRS (the first brain's rule, kept) ----
  const rcv = mp.flight && mp.fj >= 0 && mp.fside === meOther(side) ? them[mp.fj] : null;
  let cutN = 0;
  for (const z of us) if (z && (z._cut ?? 0) > 0) cutN++;
  // ---- THE ZONES ----
  const zone = [];
  for (let i = 0; i < us.length; i++) {
    const p = us[i];
    if (!p || p.off || p.pos === "GK") continue;
    const r = p._dr ?? 0.5;
    let zd = L + r * len, zy = cy + ((p._dw ?? p._bw0 ?? ME_HALF_W) - ME_HALF_W) * MT.blockWide;
    if (p._mr === "cb_lib") { zd = Math.max(CFG.lnFloor, L - 5); zy = cy; }
    zy = clamp(zy + p._dn[0] * MT.drillNoise * 0.6 * (1 - drill), 2, PITCH_W - 2);
    zd = clamp(zd + p._dn[1] * MT.drillNoise * 0.4 * (1 - drill), 3, 100);
    // A spot cannot jump across the pitch faster than a man can run to it.
    const zx = xAt(side, zd);
    if (p._zy !== undefined) zy = p._zy + clamp(zy - p._zy, -MT.slotSlew * ME_DT, MT.slotSlew * ME_DT);
    p._zy = zy; p._zx = zx;
    zone.push(i);
  }
  // ---- THE PRESS ----
  let p1 = -1, p2 = -1;
  const pressing = carrier && !mp.held && (ph === "press" || ph === "cpress"
    || depthOf(side, carrier.x) < L + len + 4 || ph === "recover");
  if (pressing) {
    const cxp = carrier.x, cyp = carrier.y;
    let bestC = Infinity, cur = M.p1[side], curC = Infinity;
    for (const i of zone) {
      const p = us[i];
      if ((p._run && p._runT > 0) || p._trk2 || (p._beat ?? 0) > 0) continue;
      const vmax = meSpeed(meAttrs(p), p.stamina);
      const t = meTimeToBallMs(p, cxp, cyp, vmax);
      // His job, his zone: a man pressing out of his zone leaves a hole; the back line only steps out
      // for a man in its own zone.
      const zoneD = Math.hypot((p._zx ?? p.x) - cxp, (p._zy ?? p.y) - cyp);
      const isBack = (p._dr ?? 0.5) < 0.15;
      const backPen = isBack && depthOf(side, cxp) > L + 9 ? 2500 : 0;
      const c = t * (1.15 - 0.35 * ((p._role2 || ROLES.cm).press)) + Math.max(0, zoneD - 12) * 55 + backPen;
      if (i === cur) curC = c;
      if (c < bestC) { bestC = c; p1 = i; }
    }
    if (cur >= 0 && curC < Infinity && !(bestC * MT.pressKeep < curC)) p1 = cur;
  }
  M.p1[side] = p1;
  // TRIGGERS: what tells a side to go now. His back to our goal, a heavy touch, a ball that went
  // backwards to him, the touchline doing half the work.
  let trig = 0;
  if (carrier) {
    const facingAway = carrier._face !== undefined ? Math.cos(angDiff(carrier._face, dir > 0 ? Math.PI : 0)) < -0.2 : false;
    if (facingAway) trig += 0.45;
    if (Math.hypot(mp.bx - carrier.x, mp.by - carrier.y) > MT.trigTouch) trig += 0.35;
    if (Math.min(carrier.y, PITCH_W - carrier.y) < MT.trigEdge) trig += 0.3;
    if (mp.possT < 6 && mp._lastPassBack === meOther(side)) trig += 0.3;
    if (carrier.pos === "GK" || carrier.pos === "DEF") trig += 0.15;
  }
  // ---- PEOPLE ----
  const marked = new Set();
  // Runners in behind are followed first: the nearest back-line man goes with him.
  const behindRunners = [];
  for (let j = 0; j < them.length; j++) {
    const q = them[j];
    if (!q || q.off || q.pos === "GK" || (carrier && q === carrier)) continue;
    const qd = depthOf(side, q.x), vq = -((q.vx || 0) / ME_DT) * dir;
    const run = ((q._runT ?? 0) > 0 && (q._run === "behind" || q._run === "third" || q._run === "wall"))
             || (vq > 4.2 && qd < L + 6) || qd < L - 1.5;
    if (run && qd < L + 14) behindRunners.push(j);
  }
  for (const i of zone) us[i]._trk2 = false;
  for (const j of behindRunners) {
    const q = them[j];
    let bi = -1, bd = Infinity;
    for (const i of zone) {
      const p = us[i];
      if (i === p1 || p._trk2 || (p._dr ?? 0.5) > 0.45) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y) + ((p.x - q.x) * dir > 0 ? 6 : 0);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi >= 0 && bd < 20) { us[bi]._trk2 = true; us[bi]._mk2 = j; marked.add(j); }
  }
  for (const i of zone) {
    const p = us[i];
    if (p._cut > 0) p._cut--;
    p._closing = false; p._duty = "hold";
    // Reading the pass.
    if (p._cut > 0) {
      if (mp.flight && mp.idx < 0) { const ic2 = meIntercept(p, mp, meSpeed(meAttrs(p), p.stamina)); p._cutx = ic2.x; p._cuty = ic2.y; }
      setTarget(p, p._cutx, p._cuty, 1); p._closing = true; p._eff = 1; continue;
    }
    if (rcv && (p._mk2 === mp.fj || cutN < CFG.cutMaxN)) {
      const ic = meIntercept(p, mp, meSpeed(meAttrs(p), p.stamina));
      const mine = meTimeToBallMs(p, ic.x, ic.y, meSpeed(meAttrs(p), p.stamina));
      const his = meTimeToBallMs(rcv, ic.x, ic.y, meSpeed(meAttrs(rcv), rcv.stamina));
      const edgeC = (p._mk2 === mp.fj ? 0 : CFG.cutEdgeOther) + CFG.cutEdge;
      if (mine + edgeC < his) {
        p._cut = CFG.cutHold; p._cutx = ic.x; p._cuty = ic.y; cutN++;
        setTarget(p, ic.x, ic.y, 1); p._closing = true; p._eff = 1; continue;
      }
    }
    if (i === p1) { pressTarget(s, side, p, carrier, ph, trig, drill); continue; }
    if (p._trk2) {
      // FOLLOWING HIM IN: goal-side of the runner, whatever the line does.
      const q = them[p._mk2];
      if (q && !q.off) {
        const gx = own, gy = ME_HALF_W;
        const ux = gx - q.x, uy = gy - q.y, ul = Math.hypot(ux, uy) || 1;
        setTarget(p, q.x + ux / ul * 1.6 + (q.vx || 0) * 2, q.y + uy / ul * 1.6 + (q.vy || 0) * 2, 1);
        p._closing = true; p._eff = 1; p._duty = "mark"; continue;
      }
    }
    // THE SPOT, leaned onto whoever is in it.
    let tx = p._zx, ty = p._zy;
    let mk = -1, mkD = Infinity;
    const rad = (p._dr ?? 0.5) < 0.15 ? 9 : 11;
    for (let j = 0; j < them.length; j++) {
      const q = them[j];
      if (!q || q.off || q.pos === "GK" || marked.has(j) || (carrier && q === carrier)) continue;
      const d = Math.hypot(q.x - tx, q.y - ty);
      if (d < rad && d < mkD) { mkD = d; mk = j; }
    }
    if (mk >= 0) {
      const q = them[mk];
      marked.add(mk);
      // Goal-side of him and a little toward the ball, pulled as far off the spot as the danger he is
      // in and the style's appetite for man-marking say.
      const dang = meDanger(meOther(side), q.x, q.y);
      const pull = clamp(MT.markPull + plan.manMark * 0.35 + dang * 0.5, 0, 0.95);
      const ux = own - q.x, uy = ME_HALF_W - q.y, ul = Math.hypot(ux, uy) || 1;
      const bx2 = mp.bx - q.x, by2 = mp.by - q.y, bl = Math.hypot(bx2, by2) || 1;
      const lean = Math.min(3, bl * MT.markBallSide * 0.1);
      const mx = q.x + ux / ul * MT.markGoalSide + bx2 / bl * lean, my = q.y + uy / ul * MT.markGoalSide + by2 / bl * lean;
      tx += (mx - tx) * pull; ty += (my - ty) * pull;
      p._duty = "mark"; p._mk2 = mk;
    } else p._mk2 = -1;
    // THE SCREEN: a front man with nobody in his zone stands in the lane from the ball to the most
    // dangerous man he can shut out.
    if (carrier && mk < 0 && (p._dr ?? 0.5) > 0.6) {
      let bj = -1, bv = 0;
      for (let j = 0; j < them.length; j++) {
        const q = them[j];
        if (!q || q.off || q === carrier || q.pos === "GK") continue;
        const ld = Math.hypot(q.x - carrier.x, q.y - carrier.y);
        if (ld < 6 || ld > MT.shadowMaxD) continue;
        if ((q.x - carrier.x) * -dir < 0) continue;                  // only balls toward our goal
        const v = meDanger(meOther(side), q.x, q.y) / (1 + Math.hypot(q.x - p._zx, q.y - p._zy) / 10);
        if (v > bv) { bv = v; bj = j; }
      }
      if (bj >= 0) {
        const q = them[bj];
        const sx = carrier.x + (q.x - carrier.x) * MT.shadowFrac, sy = carrier.y + (q.y - carrier.y) * MT.shadowFrac;
        tx += (sx - tx) * 0.6; ty += (sy - ty) * 0.6;
        p._duty = "screen";
      }
    }
    setTarget(p, tx, ty, 0.5);
    const dist = Math.hypot(p.x - p._tx, p.y - p._ty);
    const behindIt = (p._tx - p.x) * dir < -2;                       // his spot is back toward our goal
    let eff = dist > 10 ? 0.85 : dist > 4 ? 0.72 : MT.effJog;
    if ((ph === "recover" || ph === "cpress" || ph === "press") && behindIt) eff = dist > 6 ? MT.effSprint : MT.effRun;
    if (p._duty === "mark") eff = Math.max(eff, dist > 3 ? MT.effRun : MT.effJog);
    p._eff = eff * (0.86 + 0.14 * mindAware(p));
  }
  // ---- THE SECOND MAN, AND THE COUNTER-PRESS ----
  if (p1 >= 0 && carrier) {
    const n = ph === "cpress" ? MT.cpMax - 1 : (trig + drill * 0.4 > 0.75 && (ph === "press" || ph === "block") ? 1 : 0);
    const used = new Set([p1]);
    for (let k = 0; k < n; k++) {
      // The man the carrier is most likely to give it to, and whoever can get to him first.
      let bj = -1, bv = -Infinity;
      for (let j = 0; j < them.length; j++) {
        const q = them[j];
        if (!q || q.off || q === carrier || q.pos === "GK") continue;
        const d = Math.hypot(q.x - carrier.x, q.y - carrier.y);
        if (d > 18 || d < 3) continue;
        const v = -d - meLaneBlock(s, meOther(side), carrier.x, carrier.y, q.x, q.y) * 6;
        if (v > bv && ![...used].some(u => us[u]._mk2 === j && u !== p1)) { bv = v; bj = j; }
      }
      if (bj < 0) break;
      const q = them[bj];
      let bi = -1, bt = Infinity;
      for (const i of zone) {
        if (used.has(i) || us[i]._trk2 || (us[i]._cut ?? 0) > 0) continue;
        const t = meTimeToBallMs(us[i], q.x, q.y, meSpeed(meAttrs(us[i]), us[i].stamina));
        if (t < bt) { bt = t; bi = i; }
      }
      if (bi < 0 || bt > 2600) break;
      used.add(bi);
      const p = us[bi];
      // Between him and the ball, close enough to take the pass or the touch.
      const ux = carrier.x - q.x, uy = carrier.y - q.y, ul = Math.hypot(ux, uy) || 1;
      setTarget(p, q.x + ux / ul * 1.6, q.y + uy / ul * 1.6, 1);
      p._closing = true; p._eff = MT.effSprint; p._duty = "cover"; p._mk2 = bj;
      if (k === 0) p2 = bi;
    }
    // Nobody jumped: the second man covers the presser instead, behind him on the line to goal.
    if (n === 0 || p2 < 0) {
      const c0 = us[p1];
      let bi = -1, bd = Infinity;
      const gx = own, ux = gx - carrier.x, uy = ME_HALF_W - carrier.y, ul = Math.hypot(ux, uy) || 1;
      const cvx = carrier.x + ux / ul * MT.coverBack, cvy = carrier.y + uy / ul * MT.coverBack;
      for (const i of zone) {
        if (used.has(i) || us[i]._trk2 || (us[i]._cut ?? 0) > 0 || us[i]._duty === "mark") continue;
        const d = Math.hypot(us[i].x - cvx, us[i].y - cvy);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi >= 0 && bd < 14 && c0) {
        setTarget(us[bi], cvx, cvy, 0.6);
        us[bi]._duty = "cover"; us[bi]._eff = Math.max(us[bi]._eff, MT.effRun); p2 = bi;
      }
    }
  }
  M.p2[side] = p2;
}

// THE FIRST PRESSER. He goes at the man on a line that shuts the pass that hurts most -- or, out wide,
// the pass back inside, so the touchline does the rest -- and settles at a stride's distance goal-side
// to jockey. Out of a recovering side, he only delays: in front of him, never diving in.
function pressTarget(s, side, p, c, ph, trig, drill) {
  const mp = s.mePos, them = s.players[meOther(side)], dir = meDir(side), own = ownX(side);
  const gx = own, ux = gx - c.x, uy = ME_HALF_W - c.y, ul = Math.hypot(ux, uy) || 1;
  const gux = ux / ul, guy = uy / ul;
  // Which side to come from.
  let shade = 0;
  const wide = Math.min(c.y, PITCH_W - c.y) < 16;
  if (wide) shade = c.y < ME_HALF_W ? 1 : -1;      // from inside: show him the line
  else {
    let bv = -Infinity;
    for (const q of them) {
      if (!q || q.off || q === c || q.pos === "GK") continue;
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      if (d < 5 || d > 32) continue;
      const v = meDanger(meOther(side), q.x, q.y);
      if (v > bv) { bv = v; shade = Math.sign((q.x - c.x) * -guy + (q.y - c.y) * gux) || 1; }
    }
  }
  const nx = -guy * shade, ny = gux * shade;
  const delay = ph === "recover" || ph === "block" && trig < 0.4;
  const [tx, ty] = mindJockey(p, c, gux, guy, nx, ny, delay);
  setTarget(p, tx, ty, 1);
  const d = Math.hypot(p.x - c.x, p.y - c.y);
  p._closing = true; p._duty = "press"; p._delay = delay;
  p._eff = d > 6 || trig > 0.6 || ph === "cpress" ? MT.effSprint : MT.effRun + (MT.effSprint - MT.effRun) * drill * 0.5;
}

// ---- RESTARTS ------------------------------------------------------------------------------------
// Goal kicks, free kicks, corners and throws are positioned by the same team brain as open play, with
// the ball where it will be played from, and the parts that are rehearsed laid on top: who goes up for a
// corner and where, how a side defends one, the box at a free kick in range, the men who show for a
// throw, the second balls round a long goal kick. setpiece.ts then adds what the laws demand -- the taker,
// the keeper, the wall, the ten yards -- and decides when it is taken.
export function mindSetPiece(s) {
  const mp = s.mePos, sp = mp.sp, M = mp.mind;
  if (!sp || !M) return;
  const kind = sp.kind;
  if (kind !== "goalkick" && kind !== "freekick" && kind !== "corner" && kind !== "throw") return;
  const atk = sp.side, def = meOther(atk);
  for (const side of ME_SIDES) mindRoster(s, side);
  const bD = depthOf(atk, sp.x);
  M.ph[atk].ph = kind === "goalkick" ? "build" : bD < MT.buildTo ? "build" : bD < MT.finalFrom ? "progress" : "final";
  M.ph[def].ph = kind === "goalkick" && depthOf(def, sp.x) > engageD(stratOf(s, def), shortOf(s, def)) ? "press" : "block";
  M.spDeep = kind === "goalkick" ? 13 : null;
  mindAttack(s, atk);
  mindDefend(s, def);
  M.spDeep = null;
  for (const side of ME_SIDES) for (const p of s.players[side]) if (p && !p.off && p.pos !== "GK") { p._run = null; p._runT = 0; p._chk = null; }
  if (kind === "corner") spCorner(s, sp, atk, def);
  else if (kind === "freekick" && Math.abs(meGoalX(atk) - sp.x) < CFG.spShootRange + 6) spBox(s, sp, atk, def, 3);
  else if (kind === "throw") spThrow(s, sp, atk);
  else if (kind === "goalkick" && (stratOf(s, atk).gkDist || 0) > 0) spLong(s, sp, atk);
  // The keepers, as the first brain places them (setpiece.ts then sets the defending one for the kick).
  for (const side of ME_SIDES) {
    const ps = s.players[side];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p || p.off || p.pos !== "GK" || (side === atk && i === sp.ti) || (p._up && s.mePos.tick - p._up < 2)) continue;
      p._closing = false; p._gkGo = false; meKeeperPos(s, side, i);
    }
  }
}

// THE CORNER. Three routines, and the side's best in the air on the marks; a man on the edge for the
// knock-down; the rest of the side's back men stay at home. Defending it: zonal or by the man as the side
// plays, a man on the near post, the edge covered, and one or two left up for the break.
const CORNER_RT = [
  [[5.0, 5.0], [10.5, 1.0], [6.0, -5.5], [8.0, -1.0]],
  [[4.0, 6.5], [5.5, 2.5], [9.5, 4.5], [7.0, -3.0]],
  [[6.5, -7.0], [11.0, -3.0], [5.0, 4.0], [8.0, 0.5]],
];
const aerialOf = (p) => meAttrs(p).strength + ((p._role2?.hold ?? 0) > 0 ? 6 : 0);
function spCorner(s, sp, atk, def) {
  const us = s.players[atk], them = s.players[def], gx = meGoalX(atk), dir = meDir(atk);
  const near = sp.y < ME_HALF_W ? -1 : 1;
  const fam = FAM[s.styles?.[atk]] || "bal", plan = FAMPLAN[fam];
  const taker = us[sp.ti];
  const pool = us.filter(p => p && p !== taker && !p.off && p.pos !== "GK");
  // Who stays back: the most defensive men, as many as the side's rest defence asks, never fewer than two.
  const stayN = Math.max(2, plan.restN - 1);
  const stay = [...pool].sort((a, b) => ((b._role2?.rest ?? 0) - aerialOf(b) / 400) - ((a._role2?.rest ?? 0) - aerialOf(a) / 400)).slice(0, stayN);
  const go = pool.filter(p => !stay.includes(p)).sort((a, b) => aerialOf(b) - aerialOf(a));
  const rt = CORNER_RT[(sp.v ?? 0) % 3];
  let k = 0;
  for (const p of go) {
    if (k < rt.length) {
      const [dd, dy] = rt[k];
      setTarget(p, gx - dir * dd, ME_HALF_W + near * dy, 1);
      p._duty = "box"; p._boxK = k; p._closing = true; k++;
    } else if (k === rt.length) {
      setTarget(p, gx - dir * 18.5, ME_HALF_W - near * 3, 1);      // the edge, for the knock-down
      p._duty = "support"; p._closing = true; k++;
    } else {
      setTarget(p, gx - dir * 24, ME_HALF_W + near * 10, 1);
      p._duty = "support"; p._closing = true;
    }
  }
  stay.forEach((p, n) => { setTarget(p, xAt(atk, 52 + n * 4), ME_HALF_W + (n - (stay.length - 1) / 2) * 14, 1); p._duty = "hold"; p._closing = true; });
  // A GOAL DOWN AT THE DEATH, THE KEEPER GOES UP. Everybody has seen it; it is the most desperate thing a
  // side can do and it is sometimes how a match is saved.
  const mp = s.mePos;
  if ((mp._min ?? 0) >= 88 && (mp.goals?.[atk] ?? 0) - (mp.goals?.[def] ?? 0) === -1) {
    const gki = us.findIndex(p => p && !p.off && p.pos === "GK");
    if (gki >= 0) { const gk = us[gki]; setTarget(gk, gx - dir * 8.5, ME_HALF_W - near * 1.5, 1); gk._duty = "box"; gk._closing = true; gk._up = mp.tick; }
  }
  // ---- defending it ----
  const dfam = FAM[s.styles?.[def]] || "bal", dplan = FAMPLAN[dfam];
  const dpool = them.filter(p => p && !p.off && p.pos !== "GK");
  const upN = dfam === "counter" || dfam === "catenaccio" || dfam === "block" ? 2 : 1;
  const ups = [...dpool].sort((a, b) => (b._role2?.press ?? 0) + (b._mr?.startsWith("st") ? 1 : 0) - (a._role2?.press ?? 0) - (a._mr?.startsWith("st") ? 1 : 0)).slice(0, upN);
  ups.forEach((p, n) => { setTarget(p, gx - dir * (40 + n * 6), ME_HALF_W + (n ? 9 : -6), 1); p._duty = "hold"; p._closing = true; });
  const zoneN = Math.max(1, Math.round(5 * (1 - dplan.manMark)));
  const zones = [[1.0, near * 3.4], [5.5, near * 3.5], [5.5, -near * 0.5], [5.5, -near * 4.5], [11, 0]].slice(0, zoneN);
  const left = dpool.filter(p => !ups.includes(p));
  const used = new Set();
  // The men by the man: the most dangerous in the air first, each picked up by the nearest of the strong.
  const threats = go.slice(0, rt.length).sort((a, b) => aerialOf(b) - aerialOf(a));
  const markers = [...left].sort((a, b) => aerialOf(b) - aerialOf(a)).slice(0, Math.max(0, left.length - zoneN));
  for (const t of threats) {
    let bi = null, bd = Infinity;
    for (const m of markers) { if (used.has(m)) continue; const d = Math.hypot(m.x - t._tx, m.y - t._ty) - aerialOf(m) * 0.05; if (d < bd) { bd = d; bi = m; } }
    if (!bi) break;
    used.add(bi);
    setTarget(bi, t._tx + dir * 0.9, t._ty + (t._ty < ME_HALF_W ? -0.6 : 0.6), 1);
    bi._duty = "mark"; bi._mk2 = us.indexOf(t); bi._closing = true;
  }
  const rest = left.filter(p => !used.has(p));
  zones.forEach((z, n) => {
    const p = rest[n]; if (!p) return;
    setTarget(p, gx - dir * z[0], ME_HALF_W + z[1], 1); p._duty = "hold"; p._closing = true;
  });
  rest.slice(zones.length).forEach((p, n) => { setTarget(p, gx - dir * (17 + n * 2), ME_HALF_W + (n % 2 ? 6 : -6), 1); p._duty = "screen"; p._closing = true; });
}

// A FREE KICK IN RANGE that is crossed rather than struck is a corner from further out: the box filled,
// a man on the line of the wall for the rebound; the defence holds a line and marks.
function spBox(s, sp, atk, def, n) {
  const us = s.players[atk], them = s.players[def], gx = meGoalX(atk), dir = meDir(atk);
  const taker = us[sp.ti];
  const ups = us.filter(p => p && p !== taker && !p.off && p.pos !== "GK").sort((a, b) => aerialOf(b) - aerialOf(a)).slice(0, n + 1);
  const side = sp.y < ME_HALF_W ? -1 : 1;
  ups.forEach((p, k) => {
    const spots = [[9, side * 3], [10.5, -side * 3.5], [8, 0], [14, side * 7]];
    setTarget(p, gx - dir * spots[k][0], ME_HALF_W + spots[k][1], 1); p._duty = "box"; p._boxK = k; p._closing = true;
  });
  const markers = them.filter(p => p && !p.off && p.pos !== "GK").sort((a, b) => aerialOf(b) - aerialOf(a));
  ups.forEach((t, k) => {
    const m = markers[k + 4]; if (!m) return;                    // the first few will be in the wall
    setTarget(m, t._tx + dir * 1.0, t._ty, 1); m._duty = "mark"; m._closing = true;
  });
}

// A THROW. The two nearest men show for it -- one down the line, one back inside -- and a third gives the
// longer option infield; everybody else holds the shape the ball is in.
function spThrow(s, sp, atk) {
  const us = s.players[atk], dir = meDir(atk), taker = us[sp.ti];
  const inw = sp.y < ME_HALF_W ? 1 : -1;
  const spots = [[7, 3.5], [-4.5, 6.5], [13, 11]];
  const near = us.filter(p => p && p !== taker && !p.off && p.pos !== "GK")
                 .sort((a, b) => Math.hypot(a.x - sp.x, a.y - sp.y) - Math.hypot(b.x - sp.x, b.y - sp.y)).slice(0, 3);
  near.forEach((p, k) => {
    const [ax, ay] = spots[k];
    setTarget(p, sp.x + dir * ax, sp.y + inw * ay, 1); p._duty = "show"; p._closing = true;
  });
}

// A LONG GOAL KICK: the big man where it will land, two round him for the knock-down, a runner beyond.
function spLong(s, sp, atk) {
  const us = s.players[atk];
  const big = us.filter(p => p && !p.off && p.pos !== "GK" && p.pos !== "DEF").sort((a, b) => aerialOf(b) - aerialOf(a))[0];
  if (!big) return;
  const ly = ME_HALF_W + (big.y < ME_HALF_W ? -6 : 6);
  setTarget(big, xAt(atk, 60), ly, 1); big._duty = "box"; big._closing = true;
  const mids = us.filter(p => p && p !== big && !p.off && p.pos === "MID").sort((a, b) => Math.hypot(a.x - xAt(atk, 56), a.y - ly) - Math.hypot(b.x - xAt(atk, 56), b.y - ly)).slice(0, 2);
  mids.forEach((p, k) => { setTarget(p, xAt(atk, 52), ly + (k ? 8 : -8), 1); p._duty = "support"; p._closing = true; });
}

// A dead ball: every run of the open play before it is over.
export function mindDead(s) {
  if (!s.mePos?.mind) return;
  for (const side of ME_SIDES) for (const p of s.players[side]) if (p) {
    if (p._rk) { p._run = null; p._runT = 0; p._rk = null; }
    p._trk2 = false; p._cut = 0;
  }
}
