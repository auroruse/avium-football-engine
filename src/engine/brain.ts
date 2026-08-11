// The pyramid: tactical brain, coordinators, off-ball positioning.
import { CFG, ME_DT, NO_INSTRUCTIONS } from "./config";
import { meHungarian } from "./assignment";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meCtrl, meDanger, meDir, meGoalX, meIntercept, meLaneBlock, meOffsideLine, meOther, mePressure, meSpaceGain, meTimeToBallMs, meVal, meValHere } from "./geometry";
import { meAttrs, meSpeed } from "./attributes";
import { GOAL_HALF_W } from "./ball";

// The team defensive line, one depth per side per tick: the mentality default, dragged back by the
// deepest live threat -- the ball, the forecast, the carrier, or our own slowest defender.
function meTrap(s, side) {
  const mp = s.mePos, dir = meDir(side), own = meGoalX(meOther(side));
  const offB = mp.offB?.[side] ?? 0.5;
  const d1 = CFG.trapStart + CFG.trapStartOff * offB;
  const b = (mp.bx - own) * dir;
  const offsetX = 20 + 10 * (1 - offB), bTop = d1 + offsetX;
  const s2f = Math.max(0, Math.min(1, (bTop - b) / Math.max(1, bTop - CFG.trapForce)));
  const d2 = b - offsetX * (1 - s2f);
  let d3 = Infinity;
  if (mp.idx >= 0 && mp.side === meOther(side)) {
    const c = s.players[mp.side][mp.idx];
    d3 = ((c.x + (c.vx || 0) * 0.6) - own) * dir - CFG.trapCaution;
  }
  // Only while the ball is actually loose: held, the forecast is stale from the last loose phase,
  // and a dead ball's ghost was dragging the line back. The carrier term (d3) covers a held ball.
  const pd = mp.idx < 0 ? mp.pred?.[3] : null;                    // ball.Predict(700ms)
  const d4 = pd ? (pd[0] - own) * dir : Infinity;
  // Our own slowest outfielder drags the line back: their attackers' offside line IS our second-
  // deepest man, so it doubles as "where the line can actually be held".
  const d5 = (meOffsideLine(s, meOther(side)) - own) * dir - CFG.trapCaution;
  return Math.max(CFG.trapForce, Math.min(55, Math.min(d1, d2, d3, d4, d5)));
}

export function meTactical(s) {
  const mp = s.mePos;
  // Scoreline and clock move the whole side (teamAIcontroller.cpp:946-1001): a team two down with
  // a quarter of an hour left visibly pushes its line up the pitch.
  for (const side of ME_SIDES) {
    const gFor = mp.goals?.[side] ?? 0, gAg = mp.goals?.[meOther(side)] ?? 0;
    const goalFactor = Math.max(0, Math.min(1, 0.5 + (gAg - gFor) * 0.25));
    const timeFactor = 0.5 + 0.5 * Math.min(1, mp.tick * 250 / 6300000);
    const offense = Math.max(0, Math.min(1, 0.5 + (goalFactor - 0.5) * timeFactor));
    mp.offB[side] = offense * 0.5 + ((mp.bal[side] + 1) / 2) * 0.5;
    mp.trap[side] = meTrap(s, side);
  }
  // mp.bal is maintained by the possession currency in meTick: a slew-limited EMA of the race-to-
  // the-ball contest, not of who happens to be holding it. Nothing to do here.
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
  const st = s.strategy?.[side] || NO_INSTRUCTIONS;
  const mp = s.mePos, us = s.players[side], dir = meDir(side), own = meGoalX(meOther(side));
  const off = meOffsideLine(s, side);
  const ballDepth = (mp.bx - own) * dir;
  let active = 0;
  for (const p of us) {
    if (p._runT > 0) { p._runT--; if (p._runT === 0) { p._run = null; p._cool = CFG.runCool; } else active++; }
    else if (p._cool > 0) p._cool--;
  }
  // FREEDOM is how many men are allowed to be gambling at once and how speculative a run may be.
  // It was read nowhere at all, which is why it scored a flat zero on every shape metric. Expressive
  // sends more of them and off a wider shoulder; disciplined keeps them in the picture. This is a
  // trade rather than a buff -- every man on a run is a man out of the shape behind the ball.
  const cre = st.creativity || 0;
  // ON WINNING IT. possWon moved the anchor line by a few metres and measured at 2.5 against a noise
  // floor of 1.6 -- because a counter-attack is not a line, it is men going. In the seconds after a
  // side wins the ball the opposition is at its least organised, and Counter spends that window:
  // an extra runner, and the depth gate lifted, because a break starts deep by definition and the
  // gate exists to stop men running at nothing. Hold Shape spends it the other way and settles.
  const wonT = mp.side === side ? mp.possT : 1e9;
  const brk = wonT < CFG.transT ? (st.possWon || 0) : 0;
  if (brk < 0) return;                                          // hold shape: nobody breaks yet
  const runCap = Math.max(1, CFG.runMax + cre * CFG.creRuns + brk);
  const minD = brk > 0 ? CFG.runMinDepth * CFG.brkDepth : CFG.runMinDepth;
  if (mp.idx < 0 || active >= runCap || ballDepth < minD) return;   // nothing to run onto
  const carrier = us[mp.idx];
  for (let i = 0; i < us.length; i++) {
    const p = us[i];
    if (p === carrier || p.pos === "GK" || p._runT > 0 || p._cool > 0) continue;
    const ahead = (p.x - mp.bx) * dir;
    // IN BEHIND: he is on the shoulder and there is grass past the last man.
    if (p._duty === "runner" || p._duty === "width") {
      if (Math.abs(p.x - off) < 14 + cre * CFG.creBehind && ahead > -6
          && meCtrl(s, side, off + dir * 12, p.y) > -0.55 - cre * CFG.creRisk) {
        p._run = "behind"; p._runT = CFG.runTicks;
        p._rx = off + dir * 15; p._ry = p.y + (ME_HALF_W - p.y) * 0.35;
        if (++active >= runCap) break; continue;
      }
    }
    // OVERLAP: a full-back going outside the man on the ball, on his own flank.
    if (p._bd < 45 && Math.abs(p._bw - ME_HALF_W) / ME_HALF_W > 0.40) {
      if (Math.abs(p.y - carrier.y) < 16 && ahead < 4 && ahead > -22) {
        p._run = "overlap"; p._runT = CFG.runTicks;
        p._rx = mp.bx + dir * 13; p._ry = p._bw < ME_HALF_W ? 5 : PITCH_W - 5;
        if (++active >= runCap) break; continue;
      }
    }
    // THIRD MAN: a midfielder arriving late in the box once the ball is high enough.
    if (p._duty === "support" || p._duty === "hold") {
      if (ballDepth > CFG.runThirdDepth && ahead > -18 && ahead < 6) {
        p._run = "third"; p._runT = CFG.runTicks;
        p._rx = Math.min(PITCH_L - 8, Math.max(8, meGoalX(side) - dir * 13));
        p._ry = ME_HALF_W + (p.y - ME_HALF_W) * 0.45;
        if (++active >= runCap) break;
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
  const bal = Math.max(-1, Math.min(1, mp.bal[side]));
  // Mentality tilts the possession blend (teamAIcontroller.cpp: possessionBias += (offB-0.5)*0.3),
  // and the same asymmetry as meBlock applies: eased going up, immediate coming back.
  const tRaw = Math.max(0, Math.min(1, (bal + 1) / 2 + ((mp.offB?.[side] ?? 0.5) - 0.5) * 0.3));
  const t = mp.side === side ? tRaw : Math.min(tRaw, CFG.dropSnap);
  // ...and the mirror of the drop. A side that has JUST won it is at its most dangerous and the
  // side it took it from is at its least organised, so possWon decides whether that is used --
  // break at once, or keep it and let the shape catch up. This is why counter-attacking works at
  // all: it is a window, not a style, and it closes in a couple of seconds.
  const wonT = mp.side === side ? mp.possT : 1e9;
  const push = Math.max(0, 1 - wonT / CFG.transT) * CFG.transPush * (st.possWon || 0);
  // GK DISTRIBUTION is a decision the whole side takes, not just the keeper: Short means come and get
  // it and Long means get up the pitch for the second ball.
  // This half covers the keeper holding it in OPEN play, after a catch or a pickup. A stoppage runs
  // meSPShape rather than meShape (match.ts:542), so the goal kick -- the case that actually matters
  // -- is handled there instead, by gkShapePush.
  const gkHas = mp.idx >= 0 && mp.side === side && s.players[side][mp.idx]?.pos === "GK";
  const gkPush = gkHas ? (st.gkDist || 0) * CFG.gkDistPush : 0;
  const lineA = Math.max(18, Math.min(64, ballDepth - 30 + st.defLine * 7 + push + gkPush));
  const lineD = Math.max(7,  Math.min(56, ballDepth - 18 + st.defLine * 7));
  const lineM = lineD + (lineA - lineD) * t;
  // Under siege the whole side squeezes toward its own goal: a block defending its box is ~22 m
  // deep. Held at its full midfield depth, the front of it sat 46 m out while the ball was in the
  // area, so the box itself was defended by two men.
  const siege = Math.max(0, Math.min(1, 1 - ballDepth / CFG.siegeDepth));
  const span = (38 + (t * 10 - 4) - st.defLine * 2) * (1 - siege * (1 - CFG.siegeSpan));
  const sl = mp.slots[side];
  let mn = Infinity, mx = -Infinity;
  for (const q of sl) { if (q.bd < mn) mn = q.bd; if (q.bd > mx) mx = q.bd; }
  const rel = (bd - mn) / Math.max(1, mx - mn);
  const wideness = (bw - ME_HALF_W) / ME_HALF_W, wide = Math.abs(wideness) > 0.40;
  let ax = own + dir * (lineM + rel * span);
  let ay = ME_HALF_W + wideness * ME_HALF_W * (wide ? 0.94 : 0.66) * (1 + st.passingDir * 0.02);
  ay += (mp.by - ay) * (wide ? 0.10 : 0.30);
  // A side asked to keep it short needs somebody short to give it to, so the shape comes with the
  // instruction rather than leaving the passer to want a ball that is not on. Compress toward the
  // ball when playing shorter, stretch away from it when playing direct.
  const cmpA = CFG.compactAtk * (1 - st.passingDir * CFG.compactDir);
  ax += (mp.bx - ax) * (t > 0.5 ? cmpA : CFG.compactDef + Math.max(0, st.pressingLOE) * 0.03);
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
  const st = s.strategy?.[side] || NO_INSTRUCTIONS;
  // Jobs key off who actually has the ball, not off the smoothed phase. The phase carries a second
  // of hysteresis, and a second is the whole life of a chance: measured, 86% of all shots were taken
  // while the side being shot at was still labelled "attacking", so meDuties never reached its
  // defensive branch -- no presser, no cover, not one marker -- and 91% of shooters had nobody
  // within seven metres. The phase still shapes the BLOCK (how high, how wide); it must not decide
  // whether anyone defends at all. A ball in flight keeps mp.side with the passer, so the two sides
  // never both think they are attacking.
  const defending = mp.side !== side;
  const ballDepth = (mp.bx - own) * dir;
  for (const p of us) { p._wasPress = p._duty === "press"; p._mk = -1;
    if (p._beat > 0) p._beat--;
    p._duty = p.off ? "off" : p.pos === "GK" ? "gk" : "hold"; }
  // A man who has just been gone past cannot be the one who presses next -- that is what being
  // beaten MEANS, and without it a defender who dived in and lost simply closed again a quarter of
  // a second later, which is why standing on the man's toes was free.
  const free = () => us.map((p, i) => i).filter(i => us[i]._duty === "hold" && !(us[i]._beat > 0));
  const nearest = (x, y, pool) => { let bi = -1, bd = Infinity;
    for (const i of pool) {
      const q = us[i];
      const d = meTimeToBallMs(q, x, y, meSpeed(meAttrs(q), q.stamina)) / 1000;
      if (d < bd) { bd = d; bi = i; }
    }
    return [bi, bd * 7]; };   // callers compare against metres; 7 m/s makes seconds commensurable

  if (defending) {
    // ONE presser, and only inside the line of engagement. This is the whole fix.
    const loeM = CFG.loeBase + st.pressingLOE * CFG.loeStep;
    if (mp.idx >= 0) {
      // Inside the line of engagement a man travels a long way to the ball; outside it he goes only
      // if he is already close. Somebody is always tasked with it -- that is the difference between
      // a block and eleven men watching.
      const travel = ballDepth < loeM ? CFG.engageIn : CFG.engageOut;
      const [bi, bd] = nearest(mp.bx, mp.by, free());
      if (bd <= travel) {
        // Hysteresis: whoever was pressing keeps the job unless somebody is clearly better placed.
        const prev = us.findIndex(p => p._wasPress && p._duty === "hold" && p.pos !== "GK");
        const pd = prev >= 0 ? Math.hypot(us[prev].x - mp.bx, us[prev].y - mp.by) : Infinity;
        const use = (prev >= 0 && pd < bd * 1.45) ? prev : bi;
        if (use >= 0) us[use]._duty = "press";
      }
    }
    // COUNTER-PRESSING is the other half of possLost: instead of dropping, swarm the man who has
    // just taken it, in the seconds when his side is least organised. One presser is the shape's
    // steady state; this is the extra body that makes it a press rather than a chase.
    if (mp.idx >= 0 && (st.possLost || 0) > 0 && mp.possT < CFG.transT) {
      const [bi2, bd2] = nearest(mp.bx, mp.by, free());
      if (bi2 >= 0 && bd2 <= CFG.engageIn) us[bi2]._duty = "press";
    }
    // ONE RECOVERY RUNNER: the man who was beaten. Applied to everyone upfield of the ball it
    // emptied the box -- under siege the ball is deep, so almost the whole side is "upfield of it"
    // and the whole side went chasing. Measured, the nearest defender to a man in the box went from
    // 3.3 m to 4.2. Being beaten is one player's problem, so it is one player who runs.
    // A man already inside his own area is not beaten, he is where he should be; he holds.
    if (mp.idx >= 0 && mp.side === meOther(side)) {
      const bDepth = (mp.bx - own) * dir;
      if (bDepth < CFG.recoverZone) {
        let ri = -1, rd = Infinity;
        for (const i of free()) {
          const q = us[i];
          if (q.pos === "GK") continue;
          if ((q.x - own) * dir < bDepth + CFG.recoverBehind) continue;      // not beaten
          if (Math.abs(q.x - own) < CFG.gkBoxR && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW) continue;
          const d = Math.hypot(q.x - mp.bx, q.y - mp.by);
          if (d < rd) { rd = d; ri = i; }
        }
        if (ri >= 0 && rd < CFG.recoverFrom) us[ri]._duty = "recover";
      }
    }
    // ONE cover, goal-side of the ball.
    const [ci] = nearest(mp.bx - dir * 8, mp.by, free());
    if (ci >= 0) us[ci]._duty = "cover";
    // Man-mark the most dangerous opponents, tightening as they get nearer our goal.
    const threats = [];
    for (let j = 0; j < them.length; j++) { const q = them[j]; if (q.pos === "GK") continue;
      if (j === mp.idx && mp.side === meOther(side)) continue;      // the man on the ball is pressed
      // An ACTIVE run is the most dangerous thing on the pitch regardless of where its owner
      // currently stands -- unmarked runners were arriving alone at the far post all match.
      const runBonus = (q._runT ?? 0) > 0 ? 0.8 : 0;
      threats.push([meDanger(meOther(side), q.x, q.y) + runBonus, j]); }
    threats.sort((a, b) => b[0] - a[0]);
    const runners = them.filter(q => (q._runT ?? 0) > 0 && q.pos !== "GK").length;
    const nMark = (ballDepth < CFG.markSiegeDepth ? CFG.markSiege
                 : ballDepth < 34 ? 4 : ballDepth < 60 ? 2 : 1) + runners;
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
            // Goal-side matters: a man UPFIELD of his target is not marking him, he is chasing
            // him. Own goal is at `own`, so the defender is goal-side when (q.x - p.x) * dir > 0 --
            // and that was the case being charged the six-metre penalty, so the assignment actively
            // preferred handing each attacker the defender on the wrong side of him.
            const behind = (p.x - q.x) * dir > 0 ? 6 : 0;
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
    // The hunt (elizacontroller.cpp:326-390): a man close enough to the carrier joins the press even
    // though someone else holds the duty -- a CB will travel 20 m to it, a CF only 10, and a tired
    // or already-sprinting man stops bothering. Cap of one extra so the swarm never returns.
    // GF gates the hunt on LOSING the race to the ball (!teamHasBestPossession) -- without that
    // gate it fired on every opposition possession and stacked a third man onto press + cover,
    // which measured as +14 shots a game of pure chaos. And it only fires for a man clearly
    // better placed than the current presser, so it is a correction, not a pile-on.
    if (mp.idx >= 0 && mp.side === meOther(side) && (mp.fading?.[side] ?? 1) < 1.0) {
      const carrier = them[mp.idx];
      const presser = us.find(q => q._duty === "press");
      const pressD = presser ? Math.hypot(presser.x - carrier.x, presser.y - carrier.y) : Infinity;
      if (carrier && pressD > 8) {
        const cx2 = carrier.x + (carrier.vx || 0) * 0.48, cy2 = carrier.y + (carrier.vy || 0) * 0.48;
        let hi = -1, hd = Infinity;
        for (const i of free()) {
          const q = us[i];
          const fInv = Math.max(0, Math.min(1, (q.stamina ?? 100) / 100));
          let thresh = (CFG.huntBase + (1 - (q._mind ?? 0.5)) * CFG.huntMind)
                     * (0.5 * fInv + 0.5 * (1 - Math.max(0, Math.min(1, (q._avgV ?? 0) / 8)))) * 0.72;
          const d = Math.hypot(cx2 - (q.x + (q.vx || 0) * 0.16), cy2 - (q.y + (q.vy || 0) * 0.16));
          if (d < thresh && d < hd && d < pressD * 0.7) {
            // Anti-shuffle: only move if the lateral correction dominates the goal-side cushion
            // you already hold (NeedDefendingMovement, humanoid_utils.cpp:105-115).
            const deep = Math.max(0, (cx2 - q.x) * dir) - 0.5;
            if (Math.abs(cy2 - q.y) > deep * 0.8) { hd = d; hi = i; }
          }
        }
        if (hi >= 0) us[hi]._duty = "press";
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

// Nearest outfield opponent to a point. The aggregate control field cannot tell one man tight on
// you from three loosely spread, and role-scaled avoidance (GF repel x2.2 CB .. x1.0 CF) needs the
// one-man answer: a defender clears out of traffic, a striker stands in it on purpose.
export function meOppDist(s, side, x, y) {
  let d = Infinity;
  for (const q of s.players[side === "home" ? "away" : "home"]) {
    if (q.pos === "GK") continue;
    const qd = Math.hypot(q.x - x, q.y - y); if (qd < d) d = qd;
  }
  return d;
}
// 1 inside the ideal support ring around the carrier, falling to 0 well inside or outside it.
function attackingRing(s, side, cx, cy) {
  const mp = s.mePos;
  if (mp.side !== side || mp.idx < 0) return 0;
  const c = s.players[side][mp.idx];
  if (!c) return 0;
  const d = Math.hypot(cx - c.x, cy - c.y);
  if (d >= CFG.orbitLo && d <= CFG.orbitHi) return 1;
  return Math.max(0, 1 - Math.min(Math.abs(d - CFG.orbitLo), Math.abs(d - CFG.orbitHi)) / 8);
}
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
             - (2.2 - 1.2 * (p._mind ?? 0.5)) / 2.2 * Math.max(0, 1 - meOppDist(s, side, cx, cy) / 8) * CFG.oppAvoidW
             // The carrier orbit band: an ideal 12-21 m ring for a supporting man -- without it a
             // spot on the carrier's shoulder and one forty metres away scored identically.
             + (attackingRing(s, side, cx, cy)) * CFG.orbitW
             // The further out of shape you already are, the harder the base pulls you back.
             - Math.hypot(cx - baseX, cy - baseY) * 0.010 * (0.3 + 0.7 * Math.min(1, Math.hypot(p.x - baseX, p.y - baseY) / 20)) * CFG.basePullW;
    if (sc > best) { best = sc; bx = cx; by = cy; }
  }
  return [bx, by];
}

// ---- the defensive block --------------------------------------------------------------------
// A LINE, a band in front of it, and a front pair, sliding together toward the ball.
//
// What was here before gave every defender an independent zonal anchor derived from his formation
// slot, and then let a global assignment pull five of them out to man-mark whoever was most
// dangerous -- so the block's shape was the ATTACKERS' shape. Measured, a side defending its own box
// was 31 m deep with 3 of its 10 outfielders inside the area and the man about to shoot standing in
// five metres of room. Compressing a zone that half the side had already left could never work.
//
// Marking still happens, but as a LOCAL override: you pick up whoever comes into your zone, goal-
// side, and you do not leave it. That is the whole difference between a block and eleven decisions.
export function meBlock(s, side) {
  const mp = s.mePos, us = s.players[side], them = s.players[meOther(side)];
  const st = s.strategy?.[side] || NO_INSTRUCTIONS;
  const dir = meDir(side), own = meGoalX(meOther(side));
  const ballDepth = (mp.bx - own) * dir;
  // THE TRANSITION. For the first few seconds after losing the ball a side is not simply
  // "defending" -- it is GETTING BACK, and it does that before the ball has gone anywhere. Every
  // line in this function is a function of where the ball IS, so without this nothing can bring a
  // side home until the ball travels: measured over 2100 turnovers, a side that gave it away was
  // still moving forward three slices later and had retreated 0.66 m after three full seconds.
  // Snapping to the "defending" blend does not do it either -- that line sits 18 m behind the ball
  // against the attacking line's 30, so it is TIGHTER to the ball and pulls them further up.
  // This is the missing phase, and it is what possLost has always meant: drop, or swarm it.
  const lostT = mp.side !== side && mp.side !== null ? mp.possT : 1e9;
  const trans = Math.max(0, 1 - lostT / CFG.transT);        // 1 the instant it goes, 0 by transT
  const drop = trans * CFG.transDrop * (1 - (st.possLost || 0) * CFG.transPressW);
  // THE BACK LINE'S OWN INSTRUCTION. Offside became a real rule with a real free kick, and the one
  // instruction named after it moved the keeper's sweeper distance by 1.2 m and nothing else -- so
  // the setting called Offside Trap sprang no trap, and dlBehavior sat on the noise floor.
  // Drop Off concedes depth. Step Up holds a higher line. The Trap holds a higher line AND pushes up
  // in unison the moment the man on the ball has had it long enough to be looking to release, which
  // is the difference between a high line and a trap. It carries its own punishment for free: a line
  // that steps up and gets it wrong has left the whole pitch behind it, and the passer's own
  // misjudgement of the line (offBlind) means it will sometimes be wrong.
  const dlb = st.dlBehavior || 0;
  let dlA = dlb < 0 ? -CFG.dlDrop : dlb * CFG.dlStep;
  if (dlb === 2 && mp.idx >= 0 && mp.side !== side && mp.hold >= CFG.trapHold) dlA += CFG.trapStep;
  const wantLine = Math.max(CFG.blkMin, Math.min(CFG.blkMax,
    ballDepth - CFG.blkDrop + st.defLine * CFG.blkDefLine + st.pressingLOE * CFG.blkLoe - drop + dlA));
  const wantCy = ME_HALF_W + (mp.by - ME_HALF_W) * CFG.blkSlide;
  // The block slides at running pace, because it is a body of men rather than a formula.
  // Compact defending your own box, long when you are camped in their half.
  const wantDepth = CFG.blkDepthLow
    + Math.max(0, Math.min(1, (ballDepth - 18) / 42)) * (CFG.blkDepth - CFG.blkDepthLow);
  const bs = (mp.blk[side] = mp.blk[side] || { line: wantLine, cy: wantCy, depth: wantDepth });
  const mv = (wantLine < bs.line ? CFG.blkSlewBack : CFG.blkSlew) * ME_DT;
  bs.line += Math.max(-mv, Math.min(mv, wantLine - bs.line));
  bs.cy += Math.max(-mv, Math.min(mv, wantCy - bs.cy));
  // ...AND ITS DEPTH. Only the line was ever slew-limited. The depth was recomputed straight off the
  // ball every tick, and it swings seventeen metres between a low block and a high one -- so the
  // front band's slot, which sits a full depth ahead of the line, jumped at 0.4x the ball's own
  // speed. A pass at 20 m/s moved it at 8, which no footballer can follow. That is why every band
  // sat eight to twelve metres behind its slot no matter how hard they were allowed to run, and no
  // amount of effort was ever going to fix it: they were chasing something that teleported.
  bs.depth += Math.max(-mv, Math.min(mv, wantDepth - bs.depth));
  const line = bs.line, cy = bs.cy, depth = bs.depth;
  // How besieged we are, read off the SLEWED line for the same reason.
  const siege = Math.max(0, Math.min(1, 1 - (line + CFG.blkDrop) / CFG.siegeDepth));

  const idx = [];
  for (let i = 0; i < us.length; i++) if (us[i].pos !== "GK") idx.push(i);
  let mn = Infinity, mx = -Infinity;
  for (const i of idx) { const b = us[i]._bd0; if (b < mn) mn = b; if (b > mx) mx = b; }
  const span = Math.max(1, mx - mn);
  const bands = [[], [], []];
  for (const i of idx) {
    const rel = (us[i]._bd0 - mn) / span;
    bands[rel < 0.34 ? 0 : rel < 0.72 ? 1 : 2].push(i);
  }
  for (let b = 0; b < 3; b++) {
    const rowi = bands[b];
    if (!rowi.length) continue;
    rowi.sort((x, y) => us[x]._bw0 - us[y]._bw0);          // keep left-to-right order in the line
    // THE MIDDLE BAND DROPS IN. Three evenly spaced lines is a mid-block; a side defending its own
    // area is two banks almost on top of each other with the forwards ahead of them. Held at an even
    // half-spacing the midfield sat 23 m up the pitch with the ball in the six-yard box and only a
    // third of it ever got inside the area -- so a back three defended the box on its own, which is
    // why a formation with fewer defenders had nothing at all against a forward run.
    const frac = b === 1 ? 0.5 - siege * CFG.blkMidDrop : b / 2;
    const bx = own + dir * (line + depth * frac);
    // A BAND IS AS WIDE AS THE MEN IN IT. Held at a flat width, a back FOUR stood ten metres apart
    // and a back THREE stood fifteen -- so the fewer defenders a formation had, the bigger the holes
    // it left, which is exactly backwards. A real back three defends narrow and lets the wing backs
    // cover the width; that is the whole idea of the shape. Spacing is what is constant, not span.
    const spacing = CFG.blkSpacing + b * CFG.blkSpaceStep;
    const w = Math.min(CFG.blkWidthMax, spacing * Math.max(1, rowi.length - 1))
            * (1 - siege * CFG.blkSiegeNarrow);
    for (let k = 0; k < rowi.length; k++) {
      const p = us[rowi[k]];
      const f = rowi.length === 1 ? 0.5 : k / (rowi.length - 1);
      // A MAN'S OWN SLOT CANNOT TELEPORT. blkSlew limits how fast the block's LINE slides, but the
      // spot an individual is actually chasing is that line plus his band, his row, the spacing for
      // however many men are in that row and the siege width -- none of which was rate-limited. So
      // whenever a band gained or lost a man, or a row respaced, every marker in it was moved
      // instantly. Measured: the slot a defender chases moved at a median 4.22 m/s, a 90th
      // percentile of 34.7 and a maximum of 308 -- against a man who can run 5.98. He was chasing
      // something that outran him half the time and jumped the pitch the rest, which is why every
      // defensive duty stood 6.76 m off its mark and only 8-17% of them ever arrived.
      // Slewing it here fixes both at once: a re-spacing becomes a walk across rather than a jump,
      // and the shape never asks for more pace than a footballer has.
      // ...ACROSS ONLY. The jumps this exists to stop are lateral: `f` is his place in the row and
      // `w` is the row's width, and both change the instant a band gains or loses a man, moving
      // every marker in it at once. His DEPTH is line + depth * frac, and both of those are already
      // slew-limited above -- rate-limiting x a second time only adds lag, and against a signal that
      // legitimately swings sixteen metres as play goes end to end it never catches up at all.
      // Measured with x slewed too: the block itself was correctly compressed to 16.4 m under siege
      // with its bands at 8 / 16 / 25 m, while the slots the men were chasing sat 34 m apart with
      // the front one 42 m from his own goal. The shape was right and every man was following a
      // stale copy of it.
      const nbx = bx;
      let nby = Math.max(3, Math.min(PITCH_W - 3, cy + (f - 0.5) * w));
      if (p._bsy !== undefined) {
        const sdy = nby - p._bsy, cap = CFG.slotSlew * ME_DT;
        if (Math.abs(sdy) > cap) nby = p._bsy + Math.sign(sdy) * cap;
      }
      p._bsx = nbx; p._bsy = nby;
    }
  }
  // Pick up whoever comes into your zone, most dangerous man first.
  for (const p of us) p._mk = -1;
  const cand = [];
  for (let j = 0; j < them.length; j++) {
    const q = them[j];
    if (q.pos === "GK") continue;
    if (mp.side === meOther(side) && j === mp.idx) continue;     // the man on the ball is pressed
    cand.push([meDanger(meOther(side), q.x, q.y) + ((q._runT ?? 0) > 0 ? 0.5 : 0), j]);
  }
  cand.sort((x, y) => y[0] - x[0]);
  const taken = new Set();
  for (const [, j] of cand) {
    const q = them[j];
    let bi = -1, bd2 = Infinity;
    for (const i of idx) {
      if (taken.has(i) || us[i]._duty === "press") continue;
      const p2 = us[i];
      const d = Math.hypot(p2._bsx - q.x, p2._bsy - q.y) - (p2._mkPrev === j ? CFG.blkStick : 0);
      if (d < bd2) { bd2 = d; bi = i; }
    }
    if (bi < 0 || bd2 > CFG.blkZone) continue;
    taken.add(bi);
    const p = us[bi]; p._mk = j;
    // He steps onto him in proportion to how far into the patch the man has come, and only so far:
    // a defender who abandons his slot to chase is how the block became the attackers' shape.
    const w = Math.max(0, Math.min(1, (CFG.blkZone - Math.max(0, bd2)) / CFG.blkTaper));
    let ox = ((q.x - dir * CFG.blkTight) - p._bsx) * w, oy = (q.y - p._bsy) * w;
    const om = Math.hypot(ox, oy);
    if (om > CFG.blkStep) { ox *= CFG.blkStep / om; oy *= CFG.blkStep / om; }
    p._bsx += ox; p._bsy += oy;
  }
  for (const p of us) p._mkPrev = p._mk;
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
  // LOSING IT IS NOT A FADE. Blending BOTH ways meant the shape came back at the EMA's pace, and the
  // EMA barely moves: measured over 2100 turnovers, the side that had just given the ball away was
  // still going FORWARD three slices later, had retreated 0.66 m after three full seconds, and its
  // mp.bal never got past -0.22 of a possible -1. Pushing up the pitch is a decision taken over
  // several seconds and should ease; dropping is a reaction to something that has already happened.
  // So the blend still eases upward and snaps down.
  const t = mp.side === side ? (bal + 1) / 2 : Math.min((bal + 1) / 2, CFG.dropSnap);
  const lineA = Math.max(18, Math.min(64, ballDepth - 30 + st.defLine * 7));
  const lineD = Math.max(7,  Math.min(56, ballDepth - 18 + st.defLine * 7));
  const lineM = lineD + (lineA - lineD) * t;
  const span = 38 + (t * 10 - 4) - st.defLine * 2;
  let minBd = Infinity, maxBd = -Infinity;
  for (const q of ps) if (q.pos !== "GK") { if (q._bd < minBd) minBd = q._bd; if (q._bd > maxBd) maxBd = q._bd; }
  const bdRange = Math.max(1, maxBd - minBd);
  const off = meOffsideLine(s, side);
  const them = s.players[meOther(side)];
  // How besieged we are: 0 with the ball far away, 1 with it on our goal line.
  const siege = Math.max(0, Math.min(1, 1 - ballDepth / CFG.siegeDepth));

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p._closing = false; p._track = false;
    // ...unless he has the ball, in which case he is a footballer like everybody else. The keeper
    // branch used to return before the carrier logic was ever reached, so a keeper in possession ran
    // back to his line and left the ball where it was: traced, four metres away and still climbing.
    if (p.pos === "GK" && !(mp.side === side && mp.idx === i)) {
      // CAN HE GET IT? That question has to come first. It used to be asked second, behind "is this
      // ball forecast to cross my goal line" -- and if it was, he walked back and stood on the line.
      // For a struck shot that is exactly right. For a ball trickling goalwards with nobody near it,
      // it is a keeper retreating into his own net while it rolls past him, which is what it looked
      // like: measured, with a loose ball inside 18 m of his goal he was moving AWAY from it on 81%
      // of slices and aiming goal-side of it on 97%.
      if (mp.idx < 0) {
        // He goes where he READ it, not where the forecast says. The forecast is the truth and a
        // keeper does not have it -- giving it to him made him a machine that was nonetheless still
        // late; taking it away and giving him a read makes him a goalkeeper.
        if (mp.shot && mp.shot.side !== side && mp.shot.readY !== undefined) {
          // HE DIVES ACROSS, NOT BACK. Sending him to a point off his own GOAL LINE meant a keeper
          // who had correctly come out to close the shooter was told, the instant it was struck, to
          // retreat five metres while also moving sideways -- a half-backwards diagonal that covers
          // neither, and he was beaten every time. He holds the depth he has and takes the ball where
          // it crosses the plane he is already standing on. That is also what makes coming out worth
          // doing: the further out he is, the less ground there is to cover across.
          const sx4 = mp.bx, sy4 = mp.by;
          const f4 = Math.max(0, Math.min(1, (p.x - sx4) / ((own - sx4) || 1e-6)));
          const cy4 = sy4 + (mp.shot.readY - sy4) * f4;
          p._tx = p.x;
          p._ty = Math.max(1.5, Math.min(PITCH_W - 1.5, cy4));
          p._closing = true;
          continue;
        }

        // Where he would actually MEET it, not where it happens to be now.
        const vmaxG = meSpeed(meAttrs(p), p.stamina) * CFG.gkRushV;
        const ic = meIntercept(p, mp, vmaxG);
        const outAt = Math.hypot(ic.x - own, ic.y - ME_HALF_W);
        let theirs = Infinity;
        for (const q of them) if (q.pos !== "GK")
          theirs = Math.min(theirs, meTimeToBallMs(q, ic.x, ic.y, meSpeed(meAttrs(q), q.stamina)));
        // How much of an edge he needs before he commits, and it is not one number. Outside his
        // area he is a footballer with nothing behind him and no hands, so he wants a clear margin.
        // INSIDE it he is a keeper: he is bigger than the ball, he can pick it up, and there is a
        // goal behind him. Charging a flat 280 ms everywhere meant that with a ball rolling at his
        // own goal and the nearest opponent six metres away he still declined to go and get it, on
        // half of all such slices, and retreated to his line instead.
        // ...and if he can pick it UP -- in his own area, last touched by an opponent -- he wants it
        // badly. A ball in his hands cannot be tackled, so collecting it does not merely win the
        // duel, it ends the attack outright. That is worth going for even when he would get there
        // after somebody else, because the alternative is a contest and this is not one.
        const mayHandle = outAt < CFG.gkBoxR && mp.lastSide !== side;
        const edge = mayHandle ? CFG.gkRushEdgeHands
                   : outAt < CFG.gkBoxR ? CFG.gkRushEdgeBox : CFG.gkRushEdge;
        const canGet = ic.ms + edge < theirs && outAt < CFG.gkRushR;
        // Once he has gone, he goes. Flip-flopping is worse than either choice.
        if (canGet || (p._gkOut > 0 && outAt < CFG.gkMaxOut)) {
          p._gkOut = canGet ? CFG.gkRushHold : (p._gkOut || 0) - 1;
          p._tx = ic.x; p._ty = ic.y; p._closing = true;
          continue;
        }
        p._gkOut = 0;
        // He cannot reach it. NOW being a post is the right answer: read the forecast for where it
        // will cross and get across to that spot.
        if (mp.flight && mp.pred) {
          const pr = mp.pred;
          let cy = null;
          for (let k = 1; k < pr.length; k++) {
            if ((pr[k][0] - own) * dir <= 0 && (pr[k - 1][0] - own) * dir > 0) {
              const f = (pr[k - 1][0] - own) / (pr[k - 1][0] - pr[k][0] || 1);
              cy = pr[k - 1][1] + (pr[k][1] - pr[k - 1][1]) * f;
              break;
            }
          }
          if (cy !== null) {
            p._tx = own + dir * CFG.gkLineOut;
            p._ty = ME_HALF_W + Math.max(-GOAL_HALF_W - 0.8, Math.min(GOAL_HALF_W + 0.8, cy - ME_HALF_W));
            p._closing = true;                  // committed: no lazy gate, no target smoothing
            continue;
          }
        }
      } else p._gkOut = 0;
      // AN OPPONENT CARRYING IT IN HIS AREA IS HIS PROBLEM, and the rush decision above cannot see
      // that case at all -- it is gated on the ball being loose. So he fell through to the angle
      // line, which puts him a FRACTION of the ball's distance off his goal: as a man carries it
      // toward him that fraction shrinks and he walks backwards onto his own line. Measured, with
      // the ball being carried inside his area he was backing off it on 67% of slices and stepping
      // goalwards on 71%, sitting seven metres away while it was walked in. A keeper goes out and
      // closes it down. He stops a stride short so he sets himself rather than diving through the
      // man, and the smother in meTick does the rest.
      if (mp.idx >= 0 && mp.side === meOther(side)
          && Math.hypot(mp.bx - own, mp.by - ME_HALF_W) < CFG.gkBoxR) {
        const dx3 = mp.bx - p.x, dy3 = mp.by - p.y, dl3 = Math.hypot(dx3, dy3) || 1;
        const step3 = Math.max(0, dl3 - CFG.gkStand);
        p._tx = p.x + dx3 / dl3 * step3; p._ty = p.y + dy3 / dl3 * step3;
        p._closing = true;
        continue;
      }
      const bx2 = mp.bx, by2 = mp.by;
      const vx2 = bx2 - own, vy2 = by2 - ME_HALF_W, vd = Math.hypot(vx2, vy2) || 1;
      const out2 = Math.max(CFG.gkOutMin,
                   Math.min(CFG.gkOutMax, CFG.gkOutMin + vd * CFG.gkOutK + st.dlBehavior * 1.2));
      p._tx = own + vx2 / vd * out2;
      // On the line between the ball and the middle of his goal -- properly, not clamped to the width
      // of the posts. Held inside the frame he could never get across to a ball out wide.
      p._ty = ME_HALF_W + Math.max(-CFG.gkSide, Math.min(CFG.gkSide, vy2 / vd * out2));
      continue;
    }
    // READING THE PASS. A ball played into the man I am marking is a decision, not something I
    // watch go past. The block puts me GOAL-SIDE of him, which is behind the point the ball arrives
    // at, so left alone I let it run to his feet and then mark him -- and that is what it looked
    // like. If I can reach the ball before he does, I step in FRONT of him instead.
    //
    // And I commit. Once I have gone I keep going for cutHold slices at the spot I read, whether or
    // not the ball is still there: front-running is a gamble, and a defender who could abandon it
    // the instant it went wrong would have no reason ever not to try. Read it late and the ball has
    // gone, my momentum is carrying me at grass, and the man I was marking has me.
    if (p._cut > 0) p._cut--;
    if (!attacking && p.pos !== "GK") {
      if (p._cut > 0) {
        // Committed, but not blind. While the ball is still in the air he keeps re-reading where he
        // will meet it -- a ground pass sheds pace fast, so the meeting point slides back down the
        // lane underneath him, and a man running at the spot he picked two slices ago overruns it
        // every time. Once the ball has gone he IS still running at that spot, and that is what
        // being beaten looks like.
        if (mp.flight && mp.idx < 0) {
          const ic2 = meIntercept(p, mp, meSpeed(meAttrs(p), p.stamina));
          p._cutx = ic2.x; p._cuty = ic2.y;
        }
        p._tx = p._cutx; p._ty = p._cuty; p._closing = true; continue;
      }
      const rcv = mp.flight && mp.fj >= 0 && mp.fside === meOther(side) ? them[mp.fj] : null;
      if (rcv && p._mk === mp.fj) {
        const ic = meIntercept(p, mp, meSpeed(meAttrs(p), p.stamina));
        // Both men measured the same way: how long each takes to GET THERE. meIntercept floors his
        // answer at the ball's own arrival time, so a defender who would be standing on the spot
        // waiting scored as arriving exactly when the ball did -- which is also when the receiver
        // does. Read that way the gate could only ever pass when the receiver was nowhere near the
        // point, so the only front-runs it allowed were the ones there was no need to make.
        const mine = meTimeToBallMs(p, ic.x, ic.y, meSpeed(meAttrs(p), p.stamina));
        const his = meTimeToBallMs(rcv, ic.x, ic.y, meSpeed(meAttrs(rcv), rcv.stamina));
        if (mine + CFG.cutEdge < his) {
          p._cut = CFG.cutHold; p._cutx = ic.x; p._cuty = ic.y;
          p._tx = ic.x; p._ty = ic.y; p._closing = true; continue;
        }
      }
    }
    // Defending, the BLOCK owns where you stand. Press and cover are the only two jobs that leave
    // it. Nothing else applies -- no trap compression, no leash back to a formation slot, no
    // screening rule -- because those were all separate attempts to recover a shape the block just
    // has. A man who has picked somebody up moves at his own pace rather than easing into a mark.
    if (!attacking && p._duty !== "press" && p._duty !== "cover" && p._duty !== "recover") {
      const tx2 = Math.max(1.5, Math.min(PITCH_L - 1.5, p._bsx ?? p.x));
      const ty2 = Math.max(1.5, Math.min(PITCH_W - 1.5, p._bsy ?? p.y));
      // Picked somebody up, caught upfield, or simply out of shape: either way he is not strolling.
      if (p._mk >= 0 || (p.x - (p._bsx ?? p.x)) * dir > CFG.blkRecover
          || Math.hypot(p.x - tx2, p.y - ty2) > CFG.blkChase) p._closing = true;
      // GETTING INTO THE BLOCK. Not just the men caught upfield -- anyone who is not in his slot
      // while his side defends. The arithmetic was against them: the block slides toward the ball at
      // blkSlew 5.5 m/s, a man flagged as closing is capped at effortHard 0.68 of 7.3 = 4.96, and one
      // between four and eight metres out was on the arrival ramp at 4.02. The shape outran the side
      // by construction, so every band sat eight to twelve metres behind its own slot however long it
      // had -- which on the pitch is a midfield standing around while the box is under threat.
      if (Math.hypot(p.x - tx2, p.y - ty2) > CFG.trackFrom) { p._track = true; p._closing = true; }
      // No smoothing. The slot is ALREADY a smooth function of where the ball is, so filtering it
      // again only adds lag -- at 0.22 that is nearly a second, and against a block sliding with the
      // ball it was most of the ten metres the side spent out of position.
      p._tx = tx2; p._ty = ty2;
      continue;
    }
    // The zonal anchor for whatever slot he is currently filling.
    const _a = meAnchor(s, side, p._bd, p._bw);
    let ax = _a[0], ay = _a[1];

    let tx = ax, ty = ay;
    const mk = p._mk >= 0 ? them[p._mk] : null;
    switch (p._duty) {
      case "press": {                                           // close him, then stand him up
        const gap = Math.hypot(p.x - mp.bx, p.y - mp.by);
        if (gap > CFG.jockeyR) { tx = mp.bx; ty = mp.by; p._closing = true; }
        else {
          // Close enough. Stand him up rather than dive in -- that is the difference between
          // defending and lunging -- but stand him up GOAL-SIDE, on the line from the ball to the
          // goal he is defending.
          //
          // It used to be a fixed offset: goal-side in x, and pushed toward whichever touchline was
          // nearer in y. For a defender arriving from the other side of the ball that spot is BEHIND
          // it -- he would have to run around the man to reach it -- so he never did, and he orbited
          // at jockey distance instead. Measured: the presser was standing on his own target 7% of
          // the time and 4.14 m off it, which is why 43% of shots had a defender inside 2 m and 2%
          // were blocked. Near is not the same as in the way.
          //
          // On the ball-to-goal line he is between the man and the goal, which is where a defender
          // belongs and also the only place a shot can be blocked from.
          // TACKLING is the distance he settles at. It used to scale the foul rate by 0.14% and do
          // nothing else, which is why it measured at 0.3 against a noise floor of 1.6 -- a dead
          // instruction wearing a live one's name. Get Stuck In stands on the man's toes: more balls
          // won, more fouls, and far less room to recover if he goes past you. Stay On Feet holds
          // off and keeps the shape.
          // COMMITTED AND BEATEN. Getting tight wins the ball far more often -- measured, it took
          // what a side concedes from 0.80 xG to 0.46 -- and that was very nearly free, because
          // nothing in the engine modelled going PAST a man. Dive in and lose, and you are out of it
          // for a couple of seconds; only Get Stuck In pays that, which is what makes it a trade
          // rather than a better way to defend.
          if ((st.tackling || 0) > 0 && (mp.bx - own) * dir < (p.x - own) * dir - CFG.tkBeatGap)
            p._beat = Math.max(p._beat || 0, Math.round(CFG.tkBeatT * st.tackling));
          const jk = CFG.jockeyStand * (1 - (st.tackling || 0) * CFG.tkClose);
          const gx2 = own - mp.bx, gy2 = ME_HALF_W - mp.by, gl2 = Math.hypot(gx2, gy2) || 1;
          tx = mp.bx + gx2 / gl2 * jk;
          ty = mp.by + gy2 / gl2 * jk;
          p._closing = true;
        }
        break;
      }
      case "recover": {
        // He is behind the play and running at the ball from there is futile -- he will never catch
        // it, and every stride is a stride further from his own goal. A recovery run is a run to get
        // BACK GOAL-SIDE: he heads for the point between the ball and his own net, which is where he
        // needed to be, and rejoins the defence there rather than trailing the man who beat him.
        const rx = own - mp.bx, ry = ME_HALF_W - mp.by, rl = Math.hypot(rx, ry) || 1;
        tx = mp.bx + rx / rl * CFG.recoverAhead;
        ty = mp.by + ry / rl * CFG.recoverAhead;
        p._track = true; p._closing = true;
        break;
      }
      case "cover":                                             // goal-side of the ball, not on it
        tx = mp.bx - dir * 9; ty = mp.by + (ME_HALF_W - mp.by) * 0.30; break;
      case "mark": {
        // Not a fixed leash: defend the SHOOTING POINT -- where your man would shoot from -- and if
        // you are genuinely beaten, retreat toward goal rather than chase (playercontroller.cpp:53-122).
        if (!mk) break;
        const isCarrier = mp.side === meOther(side) && s.players[meOther(side)][p._mk] === mk;
        const ox = mk.x + (mk.vx || 0) * 2, oy = mk.y + (mk.vy || 0) * 2;   // his pos + movement*0.5s
        const gx = meGoalX(meOther(side)), gdx = gx - ox, gdy = ME_HALF_W - oy;
        const gd = Math.max(0.5, Math.hypot(gdx, gdy));
        const thresh = isCarrier ? CFG.shootThreshCarrier : CFG.shootThreshOther;
        const reachIn = Math.max(0.4, Math.min(52, gd - thresh));
        let spx = ox + gdx / gd * reachIn, spy = oy + gdy / gd * reachIn;
        // Never plan to defend behind our own trap line: re-derive on the line so the trap holds.
        const trapX = own + dir * (mp.trap?.[side] ?? 30);
        if ((spx - trapX) * dir < 0 && Math.abs(ox - gx) > 0.5) {
          const tt = (ox - trapX) / (ox - gx);
          if (tt > 0 && tt < 1) { spx = ox + (gx - ox) * tt; spy = oy + (ME_HALF_W - oy) * tt; }
        }
        // The component is ADDED to the man-following position, not to the zonal anchor -- starting
        // from the anchor left markers nowhere near their man and receivers under no pressure at all.
        const v = meDanger(meOther(side), mk.x, mk.y);
        const tight = CFG.markBase - v * CFG.markTighten;
        // Lead him: you mark where he is going, not where he was.
        const desX = mk.x + (mk.vx || 0) * CFG.markLead - dir * tight,
              desY = mk.y + (mk.vy || 0) * CFG.markLead + (ME_HALF_W - mk.y) * 0.04;
        const oppToSp = Math.hypot(ox - spx, oy - spy);
        const slack = Math.hypot(spx - desX, spy - desY) - (oppToSp - CFG.markBuffer);
        let dfx = desX, dfy = desY;
        if (slack > 0) {
          const dd = Math.max(0.1, Math.hypot(spx - desX, spy - desY));
          const m = Math.min(slack, dd);
          dfx = desX + (spx - desX) / dd * m; dfy = desY + (spy - desY) / dd * m;
        }
        // Second pass on where I actually am: beaten men drop goalward, they do not chase.
        const ax2 = p.x + (p.vx || 0) * 0.56, ay2 = p.y + (p.vy || 0) * 0.56;
        const actualSlack = Math.hypot(spx - ax2, spy - ay2) - (oppToSp - CFG.markBuffer);
        const beaten = (mk.x - ax2) * dir <= 0;      // he has got the wrong side of me; I cannot chase
        if (beaten && actualSlack > 0) {
          const gd2 = Math.max(0.5, Math.hypot(gx - dfx, ME_HALF_W - dfy));
          dfx += (gx - dfx) / gd2 * actualSlack * 0.7; dfy += (ME_HALF_W - dfy) / gd2 * actualSlack * 0.7;
        }
        const K = CFG.defK - CFG.defKMind * (p._mind ?? 0.5);
        const bias = Math.pow(Math.max(0, Math.min(1, K - (p._mind ?? 0.5) - (mp.fading?.[side] ?? 1))), 0.7);
        tx = desX + (dfx - desX) * bias; ty = desY + (dfy - desY) * bias;
        break;
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
    // Under siege, anyone without a man fills the corridor from the ball to our goal, fanned across
    // the mouth so they screen rather than stack. Deeper players sit nearer the line.
    if (!attacking && siege > CFG.screenOn &&
        (p._duty === "hold" || p._duty === "screen" || p._duty === "intercept")) {
      const t2 = CFG.screenDeep - (p._mind ?? 0.5) * CFG.screenMind;
      tx = mp.bx + (own - mp.bx) * t2;
      ty = mp.by + (ME_HALF_W - mp.by) * t2 + (p._bw - ME_HALF_W) * CFG.screenFan;
    }
    {
    }
    const ax0 = ax, ay0 = ay;                     // remember the zone before the job moves him
    // (block closed above)
    // The offside trap: no defender or midfielder PLANS to stand deeper than the line; stragglers
    // in the band are compressed up onto it, keeping the stagger (teamAIcontroller.cpp:625-651).
    // Forwards are exempt, and so is anyone actually engaged with the ball.
    // A marker whose man has broken beyond the line goes WITH him -- compressing the tracker back
    // onto the trap is exactly how the runner ends up alone at the far post.
    const tracking = p._duty === "mark" && p._mk >= 0 && (them[p._mk]?._runT ?? 0) > 0;
    if ((p._mind ?? 0.5) < 0.65 && p._duty !== "press" && !p._closing && !tracking && p.pos !== "GK") {
      const trap = mp.trap?.[side];
      // Only while there is a line worth holding. Deep in our own third the priority is bodies
      // goal-side of the ball, not an offside line.
      if (trap !== undefined && ballDepth >= CFG.trapDropBelow) {
        const depth = (tx - own) * dir, front = trap + CFG.trapBand;
        if (depth < front) {
          const posFactor = Math.max(0, Math.min(1, (front - depth) / (CFG.trapBand * 2)));
          tx = own + dir * (front - CFG.trapBand * posFactor);
        }
      }
    }
    // The man on the ball has his own target: where he wants to TAKE it. Forward when the space is
    // there, away from the press when it is not. He is then steered by the ordinary movement code,
    // which is what makes carrying continuous instead of a fixed five-slice lunge.
    if (mp.side === side && mp.idx === i) {
      // A dribble is a committed movement, not an argmax re-solved four times a second.
      if ((p._drbT ?? 0) > 0) p._drbT--;
      else {
        let bAng = null, bSc = -Infinity;
        for (let k = 0; k < 8; k++) {
          const ang = k * Math.PI / 4;
          const cx = p.x + Math.cos(ang) * CFG.carryLook, cy = p.y + Math.sin(ang) * CFG.carryLook;
          if (cx < 2 || cx > PITCH_L - 2 || cy < 2 || cy > PITCH_W - 2) continue;
          if (CFG.carrierOffside && (cx - off) * dir > 0.4) continue;
          // Where he takes it is worth what it is worth WITH the bodies there, and a footballer
          // does not turn on a sixpence: holding your line is cheaper than reversing it.
          let sc2 = meValHere(s, side, cx, cy) * CFG.carryVal - mePressure(s, side, cx, cy) * CFG.carryAvoid;
          // Running it out of play is a real cost, and it is not the same cost everywhere. A throw
          // near halfway is almost nothing; a goal kick hands them the ball; a defender who puts it
          // behind for a corner has conceded the most dangerous restart in football. Measured, 7.4
          // restarts a match were a man dribbling it over a line, 1.6 of them corners off his own
          // byline. A flat margin would have stopped wingers running the touchline, which is real
          // football -- so it is priced, and the winger stays willing while the defender does not.
          const eSide = Math.min(cy, PITCH_W - cy), eOwn = Math.abs(cx - own), eFar = Math.abs(cx - meGoalX(side));
          if (eSide < CFG.outSee) sc2 -= (1 - eSide / CFG.outSee) * CFG.outThrow;
          if (eFar  < CFG.outSee) sc2 -= (1 - eFar  / CFG.outSee) * CFG.outGoalkick;
          if (eOwn  < CFG.outSee) sc2 -= (1 - eOwn  / CFG.outSee) * CFG.outCorner;
          if (p._drbA != null) sc2 -= Math.abs(Math.atan2(Math.sin(ang - p._drbA), Math.cos(ang - p._drbA))) * CFG.carryTurn;
          if (sc2 > bSc) { bSc = sc2; bAng = ang; }
        }
        if (bAng !== null) { p._drbWant = bAng; p._drbT = CFG.carryCommit; }
      }
      // Turn INTO it rather than snapping. His feet, and the line the ball is running on, come round
      // together at a rate his own pace allows.
      // On taking the ball his line starts where he is ALREADY FACING, not at whatever the search has
      // just picked. Snapping it meant the very first touch went up to 135 degrees across his own
      // body while his momentum carried him straight on -- the ball behind him from the first
      // contact, before the turn limit had any chance to apply.
      if (p._drbA == null) {
        const vN0 = Math.hypot(p.vx || 0, p.vy || 0);
        p._drbA = vN0 > 0.02 ? Math.atan2(p.vy, p.vx)
                : Math.hypot(mp.bx - p.x, mp.by - p.y) > 0.05 ? Math.atan2(mp.by - p.y, mp.bx - p.x)
                : (dir > 0 ? 0 : Math.PI);
      }
      if (p._drbWant != null) {
        const dth = Math.atan2(Math.sin(p._drbWant - p._drbA), Math.cos(p._drbWant - p._drbA));
        const vNow = Math.hypot(p.vx || 0, p.vy || 0) / ME_DT;
        const mt = CFG.dribTurn / (1 + vNow * CFG.dribTurnV);
        p._drbA += Math.max(-mt, Math.min(mt, dth));
      }
      // And if it HAS got behind him, getting it back in front is the only thing he is doing: he
      // checks, turns onto it, and takes it on again from there.
      {
        const bx2 = mp.bx - p.x, by2 = mp.by - p.y, bd2 = Math.hypot(bx2, by2);
        const vN = Math.hypot(p.vx || 0, p.vy || 0);
        if (bd2 > 0.05 && vN > 0.02) {
          const dotf = (bx2 / bd2) * ((p.vx || 0) / vN) + (by2 / bd2) * ((p.vy || 0) / vN);
          if (dotf < CFG.dribBehind) p._drbA = Math.atan2(by2, bx2);   // face the ball, take it on
        }
      }
      // He runs AT THE BALL, not at a point six metres away. He has to reach it to touch it, and the
      // direction he has picked is where he pushes it once he gets there -- that is what dribbling
      // is. Aiming him at a distant spot instead left him running away from a ball he then never
      // made contact with: measured, the man "in possession" stood 1.6 m off it all match and the
      // whole game ran at two passes a side.
      const ca = p._drbA ?? (dir > 0 ? 0 : Math.PI);
      // Aimed THROUGH the ball, not just past it. At a metre and a half his arrival gate stopped him
      // a stride short of it -- man and ball both standing still, a metre apart, for the rest of the
      // possession. He has to be running somewhere beyond it to keep making contact.
      // He chases a point just BEYOND the ball, along the line he means to take it. Aimed at the ball
      // itself he ran straight through it -- a 1.8 m stride at a ball 1.15 m away -- then turned a
      // full 180 to come back, and the turn penalty took his legs every time. That oscillation on top
      // of the ball is the dithering: he never built any speed and never got anywhere.
      // While the ball is running he follows HIS OWN TOUCH -- onto the line it is already travelling,
      // not to a point behind it that his intended angle happens to name. Fighting the ball's own
      // momentum is what turned him round every second slice.
      // He chases THE BALL, and nothing else. A target held a fixed distance behind it looks right
      // and is fatal: standing at that target means matching the ball's velocity exactly, so the gap
      // never closes, the two decelerate together and both come to rest a stride apart. That is the
      // stall. What keeps the ball in front of him is not where he aims -- it is the TOUCH.
      p._tx = mp.bx; p._ty = mp.by;
      continue;                                                    // no leash, no trap, no offside clamp
    }
    // A committed run overrides the job for as long as it lasts -- but a man going in behind holds
    // the last shoulder until the ball is actually played into the space, and only then breaks.
    if (p._runT > 0) {
      const played = mp.flight && mp.fside === side && mp.fj === i;
      if (p._run === "behind" && !played) { tx = off - dir * 0.5; ty = p._ry; }
      else { tx = p._rx; ty = p._ry; }
    }
    // REST DEFENCE. The block was only ever built for the side WITHOUT the ball, so at the instant
    // possession changed every target switched formula and the whole side teleported -- there was no
    // shape to fall back into, only one to build from scratch. That is why it arrived four seconds
    // late to every counter however hard anybody ran, and no amount of recovery pace ever touched
    // it. The deep men now sit in their block slot WHILE their own side attacks, so when the ball
    // goes the shape is already there and only has to slide. How much of the attack a man joins
    // comes off his natural depth: a centre-half almost none of it, a holding midfielder some, a
    // forward all of it. A man on a committed run is exempt -- that is the whole point of the run.
    if (attacking && (p._runT ?? 0) <= 0 && p._bsx !== undefined) {
      const rest = Math.max(0, Math.min(1, (CFG.restMind - (p._mind ?? 0.5)) / Math.max(0.01, CFG.restTaper)));
      const w2 = rest * CFG.restW;
      tx += (p._bsx - tx) * w2; ty += (p._bsy - ty) * w2;
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
    // Target smoothing stops off-ball players twitching, but a man closing the ball must track it
    // exactly -- filtered, he permanently chased where the carrier WAS and never arrived.
    // Only the man going for the BALL tracks it frame-exact. Snapping markers onto their man as
    // well made every attacker permanently smothered and turned the box into a scramble -- 82 shots
    // and 28 goals a match. A marker still follows, he just does not teleport.
    const sm = (p._closing || p._duty === "press") ? 1
             : p._duty === "mark" ? CFG.markSmooth : CFG.targetSmooth;
    p._tx = p._tx === undefined ? tx : p._tx + (tx - p._tx) * sm;
    p._ty = p._ty === undefined ? ty : p._ty + (ty - p._ty) * sm;
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
