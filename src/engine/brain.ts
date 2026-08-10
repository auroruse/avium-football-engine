// The pyramid: tactical brain, coordinators, off-ball positioning.
import { CFG, NO_INSTRUCTIONS } from "./config";
import { meHungarian } from "./assignment";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meCtrl, meDanger, meDir, meGoalX, meLaneBlock, meOffsideLine, meOther, meSpaceGain } from "./geometry";

export function meTactical(s) {
  const mp = s.mePos;
  // Possession balance, smoothed. A binary attack/defend flag makes the whole side lurch every time
  // a fifty-fifty wobbles; lagging it is what keeps them from running forwards and backwards.
  for (const side of ME_SIDES) {
    const want = mp.side === side ? 1 : -1;
    mp.bal[side] += (want - mp.bal[side]) * CFG.balLag;
  }
  const settled = mp.possT >= CFG.settleTicks;
  for (const side of ME_SIDES) {
    const has = mp.side === side;
    const want = has ? (settled ? "atk" : "tr_atk") : (settled ? "def" : "tr_def");
    // Hysteresis, so a phase does not flicker every time the ball wobbles.
    if (mp.phase[side] !== want) {
      if (++mp.phaseT[side] >= CFG.phaseHyst) { mp.phase[side] = want; mp.phaseT[side] = 0; }
    } else mp.phaseT[side] = 0;
  }
}

export function meRuns(s, side) {
  const mp = s.mePos, us = s.players[side], dir = meDir(side), own = meGoalX(meOther(side));
  const off = meOffsideLine(s, side);
  const ballDepth = (mp.bx - own) * dir;
  let active = 0;
  for (const p of us) {
    if (p._runT > 0) { p._runT--; if (p._runT === 0) { p._run = null; p._cool = CFG.runCool; } else active++; }
    else if (p._cool > 0) p._cool--;
  }
  if (mp.idx < 0 || active >= 2 || ballDepth < 30) return;      // nothing to run onto
  const carrier = us[mp.idx];
  for (let i = 0; i < us.length; i++) {
    const p = us[i];
    if (p === carrier || p.pos === "GK" || p._runT > 0 || p._cool > 0) continue;
    const ahead = (p.x - mp.bx) * dir;
    // IN BEHIND: he is on the shoulder and there is grass past the last man.
    if (p._duty === "runner" || p._duty === "width") {
      if (Math.abs(p.x - off) < 14 && ahead > -6 && meCtrl(s, side, off + dir * 12, p.y) > -0.55) {
        p._run = "behind"; p._runT = CFG.runTicks;
        p._rx = off + dir * 15; p._ry = p.y + (ME_HALF_W - p.y) * 0.35;
        if (++active >= 2) break; continue;
      }
    }
    // OVERLAP: a full-back going outside the man on the ball, on his own flank.
    if (p._bd < 45 && Math.abs(p._bw - ME_HALF_W) / ME_HALF_W > 0.40) {
      if (Math.abs(p.y - carrier.y) < 16 && ahead < 4 && ahead > -22) {
        p._run = "overlap"; p._runT = CFG.runTicks;
        p._rx = mp.bx + dir * 13; p._ry = p._bw < ME_HALF_W ? 5 : PITCH_W - 5;
        if (++active >= 2) break; continue;
      }
    }
    // THIRD MAN: a midfielder arriving late in the box once the ball is high enough.
    if (p._duty === "support" || p._duty === "hold") {
      if (ballDepth > 62 && ahead > -18 && ahead < 6) {
        p._run = "third"; p._runT = CFG.runTicks;
        p._rx = Math.min(PITCH_L - 8, Math.max(8, meGoalX(side) - dir * 13));
        p._ry = ME_HALF_W + (p.y - ME_HALF_W) * 0.45;
        if (++active >= 2) break;
      }
    }
  }
}

// Which formation slot each player currently fills. When a full-back bombs forward somebody else
// has to cover the space he left, and that is a reassignment problem, not a fixed label. Distances
// are squared so the algorithm shuffles several men a little rather than marching one man miles.
// Where a given formation slot sits on the pitch right now. Shared so the reassignment and the
// positioning can never disagree about where a zone actually is.
export function meAnchor(s, side, bd, bw) {
  const st = s.strategy?.[side] || NO_INSTRUCTIONS, mp = s.mePos;
  const dir = meDir(side), own = meGoalX(meOther(side));
  const ballDepth = (mp.bx - own) * dir;
  const bal = Math.max(-1, Math.min(1, mp.bal[side])), t = (bal + 1) / 2;
  const lineA = Math.max(18, Math.min(64, ballDepth - 30 + st.defLine * 7));
  const lineD = Math.max(7,  Math.min(56, ballDepth - 18 + st.defLine * 7));
  const lineM = lineD + (lineA - lineD) * t, span = 38 + (t * 10 - 4) - st.defLine * 2;
  const sl = mp.slots[side];
  let mn = Infinity, mx = -Infinity;
  for (const q of sl) { if (q.bd < mn) mn = q.bd; if (q.bd > mx) mx = q.bd; }
  const rel = (bd - mn) / Math.max(1, mx - mn);
  const wideness = (bw - ME_HALF_W) / ME_HALF_W, wide = Math.abs(wideness) > 0.40;
  let ax = own + dir * (lineM + rel * span);
  let ay = ME_HALF_W + wideness * ME_HALF_W * (wide ? 0.94 : 0.66) * (1 + st.passingDir * 0.02);
  ay += (mp.by - ay) * (wide ? 0.10 : 0.30);
  ax += (mp.bx - ax) * (t > 0.5 ? CFG.compactAtk : CFG.compactDef + Math.max(0, st.pressingLOE) * 0.03);
  return [ax, ay];
}

export function meSlots(s, side) {
  const ps = s.players[side], slots = s.mePos.slots[side];
  for (const sl of slots) { const a = meAnchor(s, side, sl.bd, sl.bw); sl.wx = a[0]; sl.wy = a[1]; }
  const idx = [];
  for (let i = 0; i < ps.length; i++) if (ps[i].pos !== "GK") idx.push(i);
  const n = Math.min(idx.length, slots.length);
  if (n < 2) return;
  const cost = [];
  for (let a = 0; a < n; a++) {
    const p = ps[idx[a]], row = new Float64Array(n);
    for (let b = 0; b < n; b++) {
      const d = Math.hypot(p.x - slots[b].wx, p.y - slots[b].wy);
      // A player is reluctant to take a slot far from his natural one -- a striker does not become
      // a centre-half because he happens to be standing there.
      const natural = Math.abs(p._bd0 - slots[b].bd) * 0.55;
      row[b] = d * d + natural * natural;
    }
    cost.push(row);
  }
  const asg = meHungarian(cost, n);
  for (let a = 0; a < n; a++) {
    const p = ps[idx[a]], b = asg[a];
    if (b >= 0) { p._bd = slots[b].bd; p._bw = slots[b].bw; }
  }
}

// ---- coordinators --------------------------------------------------------------------------
// Every outfielder gets exactly one job. Defensively that is press / cover / mark / screen / hold;
// in possession it is width / runner / support / hold. Nothing is implicit and nothing is shared.
export function meDuties(s, side) {
  const mp = s.mePos, us = s.players[side], them = s.players[meOther(side)];
  const dir = meDir(side), own = meGoalX(meOther(side));
  const st = s.strategy?.[side] || NO_INSTRUCTIONS, ph = mp.phase[side];
  const ballDepth = (mp.bx - own) * dir;
  for (const p of us) { p._wasPress = p._duty === "press"; p._duty = p.pos === "GK" ? "gk" : "hold"; p._mk = -1; }
  const free = () => us.map((p, i) => i).filter(i => us[i]._duty === "hold");
  const nearest = (x, y, pool) => { let bi = -1, bd = Infinity;
    for (const i of pool) { const d = Math.hypot(us[i].x - x, us[i].y - y); if (d < bd) { bd = d; bi = i; } }
    return [bi, bd]; };

  if (ph === "def" || ph === "tr_def") {
    // ONE presser, and only inside the line of engagement. This is the whole fix.
    const loeM = CFG.loeBase + st.pressingLOE * CFG.loeStep;
    if (mp.idx >= 0 && ballDepth < loeM) {
      const [bi, bd] = nearest(mp.bx, mp.by, free());
      // Hysteresis: whoever was pressing keeps the job unless somebody is clearly better placed.
      const prev = us.findIndex(p => p._wasPress && p._duty === "hold" && p.pos !== "GK");
      const pd = prev >= 0 ? Math.hypot(us[prev].x - mp.bx, us[prev].y - mp.by) : Infinity;
      const use = (prev >= 0 && pd < bd * 1.45) ? prev : bi;
      if (use >= 0) us[use]._duty = "press";
    }
    // ONE cover, goal-side of the ball.
    const [ci] = nearest(mp.bx - dir * 8, mp.by, free());
    if (ci >= 0) us[ci]._duty = "cover";
    // Man-mark the most dangerous opponents, tightening as they get nearer our goal.
    const threats = [];
    for (let j = 0; j < them.length; j++) { const q = them[j]; if (q.pos === "GK") continue;
      if (j === mp.idx && mp.side === meOther(side)) continue;      // the man on the ball is pressed
      threats.push([meDanger(meOther(side), q.x, q.y), j]); }
    threats.sort((a, b) => b[0] - a[0]);
    const nMark = ballDepth < 34 ? 4 : ballDepth < 60 ? 2 : 1;
    // Assigned as one problem, not one pick at a time. Picking greedily hands the same region to
    // several defenders at once, which is what put six of them in the same square metre.
    {
      const avail = free(), pick = threats.slice(0, Math.min(nMark, threats.length));
      const n = Math.max(avail.length, pick.length);
      if (pick.length && avail.length) {
        const cost = [];
        for (let a = 0; a < n; a++) {
          const row = new Float64Array(n);
          for (let b = 0; b < n; b++) {
            if (a >= avail.length || b >= pick.length) { row[b] = 1e6; continue; }
            const p = us[avail[a]], q = them[pick[b][1]];
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            // Goal-side matters: a man already behind his target is not marking him.
            const behind = (q.x - p.x) * dir > 0 ? 6 : 0;
            row[b] = (d + behind) * (d + behind);
          }
          cost.push(row);
        }
        const asg = meHungarian(cost, n);
        for (let a = 0; a < Math.min(avail.length, n); a++) {
          const b = asg[a];
          if (b >= 0 && b < pick.length) { us[avail[a]]._duty = "mark"; us[avail[a]]._mk = pick[b][1]; }
        }
      }
    }
    // The nearest man to the most dangerous OTHER opponent reads the pass rather than screening it:
    // he stands off his shoulder, ahead of him on the lane, playing for the interception.
    {
      const cand = threats.find(([, j]) => !us.some(p => p._mk === j));
      if (cand) { const [ii] = nearest(them[cand[1]].x, them[cand[1]].y, free());
        if (ii >= 0) { us[ii]._duty = "intercept"; us[ii]._mk = cand[1]; } }
    }
    // Everyone left screens a passing lane. Standing IN the line from the ball to a dangerous man
    // is what makes a block dangerous without anybody sprinting at anybody -- it was the missing
    // job, and its absence is why switching the press off produced 96% passing and no shots.
    let k = 0;
    for (const i of free()) {
      while (k < threats.length && us.some(p => p._mk === threats[k][1])) k++;
      if (k >= threats.length) break;
      us[i]._duty = "screen"; us[i]._mk = threats[k][1]; k++;
    }
  } else {
    // In possession. Hold the width, put one man in behind, give the ball a short option.
    for (const i of free()) {
      const p = us[i];
      if (Math.abs(p._bw - ME_HALF_W) / ME_HALF_W > 0.40) p._duty = "width";
      else if (p._bd > 62) p._duty = "runner";
    }
    const [si] = nearest(mp.bx - dir * 6, mp.by, free());
    if (si >= 0) us[si]._duty = "support";
  }
}

// ---- off-ball brain ------------------------------------------------------------------------
// Most of football is played without the ball, so most of the intelligence has to go here: where to
// stand for a pass that probably will not come. Each player grades a ring of candidate spots around
// his zonal anchor and takes the best -- owning the space, being worth something, being reachable,
// and not standing on a team-mate. Staggered across slices so only a couple of brains run per tick.
export const ME_SPACE_R = 9, ME_SPACE_W = 0.55;

export function meFindSpace(s, side, p, baseX, baseY, off) {
  const mp = s.mePos, dir = meDir(side);
  let bx = baseX, by = baseY, best = -Infinity;
  for (let k = 0; k <= 8; k++) {
    const ang = k * Math.PI / 4;
    const cx = k === 8 ? baseX : baseX + Math.cos(ang) * ME_SPACE_R;
    const cy = k === 8 ? baseY : baseY + Math.sin(ang) * ME_SPACE_R;
    if (cx < 2 || cx > PITCH_L - 2 || cy < 2 || cy > PITCH_W - 2) continue;
    if ((cx - off) * dir > 0 && (cx - mp.bx) * dir > 0) continue;          // would be offside
    let crowd = 0;
    for (const q of s.players[side]) { if (q === p || q.pos === "GK") continue;
      const d = Math.hypot(q.x - cx, q.y - cy); if (d < 14) crowd += (14 - d) / 14; }
    const sc = meCtrl(s, side, cx, cy) * 1.00                    // do we own it
             + meDanger(side, cx, cy) * 1.30                     // is it worth owning
             - meLaneBlock(s, side, mp.bx, mp.by, cx, cy) * 0.30 // can the ball reach me
             + meSpaceGain(s, side, cx, cy) * ME_SPACE_W          // would we newly own ground here
             - crowd * 0.55                                      // is somebody already there
             - Math.hypot(cx - baseX, cy - baseY) * 0.010;       // do not abandon the shape
    if (sc > best) { best = sc; bx = cx; by = cy; }
  }
  return [bx, by];
}

// ---- shape ------------------------------------------------------------------------------
// The zonal skeleton, then the job on top of it. Nobody's position is implicit any more: every
// outfielder is doing exactly one thing the coordinator told him to do.
export function meShape(s, side) {
  const st = s.strategy?.[side] || NO_INSTRUCTIONS, ps = s.players[side], mp = s.mePos;
  const dir = meDir(side), own = meGoalX(meOther(side));
  const ballDepth = (mp.bx - own) * dir;
  const attacking = mp.side === side;
  // Blend the attacking and defending shapes by the lagged balance rather than snapping between
  // them, and let each player's own depth decide how much he commits: a centre-half stays honest
  // when his side attacks, a striker barely tracks back when it does not.
  const bal = Math.max(-1, Math.min(1, mp.bal[side]));
  const t = (bal + 1) / 2;
  const lineA = Math.max(18, Math.min(64, ballDepth - 30 + st.defLine * 7));
  const lineD = Math.max(7,  Math.min(56, ballDepth - 18 + st.defLine * 7));
  const lineM = lineD + (lineA - lineD) * t;
  const span = 38 + (t * 10 - 4) - st.defLine * 2;
  let minBd = Infinity, maxBd = -Infinity;
  for (const q of ps) if (q.pos !== "GK") { if (q._bd < minBd) minBd = q._bd; if (q._bd > maxBd) maxBd = q._bd; }
  const bdRange = Math.max(1, maxBd - minBd);
  const off = meOffsideLine(s, side);
  const them = s.players[meOther(side)];

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p._closing = false;
    if (p.pos === "GK") {
      const push = 6 + st.dlBehavior * 3 + (st.defLine > 0 ? st.defLine * 3.5 : 0);
      p._tx = own + dir * Math.max(2, Math.min(20, push * (0.4 + ballDepth / PITCH_L)));
      p._ty = ME_HALF_W + (mp.by - ME_HALF_W) * 0.22;
      continue;
    }
    // The zonal anchor for whatever slot he is currently filling.
    const _a = meAnchor(s, side, p._bd, p._bw);
    let ax = _a[0], ay = _a[1];

    let tx = ax, ty = ay;
    const mk = p._mk >= 0 ? them[p._mk] : null;
    switch (p._duty) {
      case "press": {                                           // close him, then jockey
        const gap = Math.hypot(p.x - mp.bx, p.y - mp.by);
        if (gap > CFG.jockeyR) { tx = mp.bx; ty = mp.by; p._closing = true; }
        else {
          // Close enough. Now stand him up and shepherd him toward the nearest touchline instead of
          // diving in, which is the difference between defending and lunging.
          const outward = mp.by < ME_HALF_W ? -1 : 1;
          tx = mp.bx - dir * 1.5; ty = mp.by + outward * 1.2; p._closing = true;
        }
        break;
      }
      case "cover":                                             // goal-side of the ball, not on it
        tx = mp.bx - dir * 9; ty = mp.by + (ME_HALF_W - mp.by) * 0.30; break;
      case "mark": {                                            // goal-side of your man, tight
        if (!mk) break;
        const v = meDanger(meOther(side), mk.x, mk.y);
        const tight = CFG.markBase - v * CFG.markTighten;
        tx = mk.x - dir * tight; ty = mk.y + (ME_HALF_W - mk.y) * 0.04; break;
      }
      case "screen": {                                          // stand IN the lane to your man
        if (!mk) break;
        const t = 0.62;                                         // nearer him than the ball
        tx = mp.bx + (mk.x - mp.bx) * t; ty = mp.by + (mk.y - mp.by) * t; break;
      }
      case "intercept": {                                       // off his shoulder, reading it
        if (!mk) break;
        tx = mp.bx + (mk.x - mp.bx) * 0.80 - dir * 1.0;
        ty = mp.by + (mk.y - mp.by) * 0.80; break;
      }
      case "runner": {                                          // stretch them, stay onside
        const [sx, sy] = meBrainPos(s, side, p, i, ax + dir * 10, ay, off);
        tx = sx; ty = sy; break;
      }
      case "support": {                                         // short option for the ball
        const [sx, sy] = meBrainPos(s, side, p, i, mp.bx - dir * 7, mp.by + (ay > mp.by ? 8 : -8), off);
        tx = sx; ty = sy; break;
      }
      case "width": case "hold": default: {
        if (attacking) { const [sx, sy] = meBrainPos(s, side, p, i, ax, ay, off); tx = sx; ty = sy; }
        break;
      }
    }
    const ax0 = ax, ay0 = ay;                     // remember the zone before the job moves him
    // A committed run overrides the job for as long as it lasts -- but a man going in behind holds
    // the last shoulder until the ball is actually played into the space, and only then breaks.
    if (p._runT > 0) {
      const played = mp.flight && mp.fside === side && mp.fj === i;
      if (p._run === "behind" && !played) { tx = off - dir * 0.5; ty = p._ry; }
      else { tx = p._rx; ty = p._ry; }
    }
    // The leash. Whatever the job asked for, he does it from inside his own zone.
    {
      const lx = tx - ax0, ly = ty - ay0, ld = Math.hypot(lx, ly);
      const leash = p._runT > 0 ? CFG.leashRun
                  : (p._duty === "press" || p._duty === "cover") ? CFG.leashPress : CFG.leash;
      if (ld > leash) { tx = ax0 + lx / ld * leash; ty = ay0 + ly / ld * leash; }
    }
    // Offside holds everyone except a man running in behind, who is gambling on the timing.
    if (p._run !== "behind" && (tx - off) * dir > 0 && (tx - mp.bx) * dir > 0) tx = off - dir * 0.6;
    tx = Math.max(1.5, Math.min(PITCH_L - 1.5, tx));
    ty = Math.max(1.5, Math.min(PITCH_W - 1.5, ty));
    p._tx = p._tx === undefined ? tx : p._tx + (tx - p._tx) * CFG.targetSmooth;
    p._ty = p._ty === undefined ? ty : p._ty + (ty - p._ty) * CFG.targetSmooth;
  }
}

// Staggered: a player re-solves his position every CFG.brainStride slices and coasts on the answer
// in between, which is both cheaper and steadier than re-deciding four times a second.
export function meBrainPos(s, side, p, i, ax, ay, off) {
  const mp = s.mePos;
  if (p._sx === undefined || (mp.tick + i) % CFG.brainStride === 0) {
    const r = meFindSpace(s, side, p, ax, ay, off);
    p._sx = r[0]; p._sy = r[1];
  }
  return [p._sx, p._sy];
}
