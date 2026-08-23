// The pyramid: tactical brain, coordinators, off-ball positioning.
import { CFG, ME_DT, NO_INSTRUCTIONS } from "./config";
import { meHungarian } from "./assignment";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meCtrl, meDanger, meDir, meGoalX, meIntercept, meLaneBlock, meOffsideLine, meOther, mePressure, meSpaceGain, meTimeToBallMs, meVal, meValHere } from "./geometry";
import { meAttrs, meGkSkill, meMind, meSpeed } from "./attributes";
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
  // Tried and rejected: flooring the gap between the ball and the line so it cannot taper to nothing
  // on the goal line, on the grounds that the deep block sits too high and the offside line with it.
  // It reads as a no-op and it has to: this value only ever RAISES a defender (see the trap band in
  // meShape -- it pushes stragglers up onto the line and never pulls anybody back), so lowering it
  // releases the back four to sit deeper without asking them to. Where they actually stand is
  // meAnchor, and that is where a fix for the depth of the deep block belongs.
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
  // TRIED AND REJECTED: gating the runs on the GRASS rather than on where the ball is. The rule
  // asks how far up the pitch the ball is and nothing else, which is inverted for the one situation
  // that makes sitting deep worth choosing -- a side winning it on its own eighteen-yard line
  // against a high line has sixty metres in front of it and was forbidden from sending anybody.
  // Added as an alternative qualifier (ballDepth < minD && room < 34, room being the gap between
  // their last man and their own goal) so organised attacks kept the old rule. A/B on the same
  // fixtures and seeds, 360 blocked fixtures a rung, gate off / gate on:
  //   defLine      -2       -1        0       +1       +2      (se ~0.047)
  //   xGD       -0.078   +0.109   +0.190   -0.037   -0.184     off
  //   xGD       -0.091   +0.095   +0.142   +0.089   -0.234     on
  //   GF      1.25/1.38  1.44/1.51  1.65/1.63  1.49/1.65  1.71/1.78
  //   GA      1.29/1.47  1.33/1.32  1.36/1.45  1.65/1.65  1.93/2.01
  // THE MECHANISM WORKS AND THE TRADE IS BAD, which is the useful half. A deep side really does get
  // its dividend -- GF at -2 goes 1.25 to 1.38, the counter this was written to enable -- and pays
  // more for it than it earns, GA 1.29 to 1.47, for a net of nothing. The only rung that gained is
  // +1, the opposite of the target, and the ownThird span NARROWED from 11.9 passes to 10.3: it
  // bought that by making the rungs more alike. Do not re-attempt this; the counter-attack is not
  // what depth is missing.
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
        p._rx = off + dir * CFG.runBehindX; p._ry = p.y + (ME_HALF_W - p.y) * 0.35;
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
// `neutral` answers the same question with the instruction vector zeroed -- where the FORMATION
// alone would put him. The distance between the two is how far this side's system has
// deliberately moved him, and meFindSpace defends a deliberate slot harder than a default one.
export function meAnchor(s, side, bd, bw, neutral) {
  const st = neutral ? NO_INSTRUCTIONS : (s.strategy?.[side] || NO_INSTRUCTIONS), mp = s.mePos;
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
  // KEEPING THE BALL HAS TO BUY GROUND, and until now it bought none. Measured at 360 blocked
  // fixtures, the two styles with the MOST possession had the LEAST territory and the FEWEST shots
  // in the game -- Tiki-Taka 54.3% and 37.0 m and 7.8 shots, Control Possession 52.0 and 35.8 and
  // 8.1, against Counter's 43.5% of the ball, 44.0 m and 10.0 shots. Four of the seven styles
  // outside the noise band sat in the bottom tail and three of them were possession sides, so this
  // is one mechanism producing most of the imbalance rather than four stamps being wrong.
  // The reason is circular and it is structural: every line in here is a function of where the BALL
  // is, so a side's shape follows its ball instead of its ball following its shape. A team that
  // keeps it in front of a low block can pass sideways all afternoon and never move the anchor,
  // because the anchor is measured from the ball it is passing sideways.
  // What breaks the circle is time. A settled possession is one the opposition has stopped being
  // able to contest, and a real side answers that by stepping the whole shape up. The engine
  // already knew the concept -- meTactical has computed `settled` off possT for as long as
  // settleTicks has existed -- and did nothing with it: mp.phase is written every tick, carries its
  // own hysteresis, and IS READ NOWHERE. This is what it was for.
  // It needs no stamp, because it targets itself: a side that strings possessions together earns it
  // and a side that hits it long and loses it never reaches the ramp. And it is paid for on the
  // other side of the ball -- a shape that has stepped up is the shape that transDrop has to bring
  // home when the possession finally ends.
  const settle = mp.side === side
    ? Math.max(0, Math.min(1, (mp.possT - CFG.settleTicks) / CFG.settleRamp)) : 0;
  const hold = settle * CFG.settlePush;
  // GK DISTRIBUTION is a decision the whole side takes, not just the keeper: Short means come and get
  // it and Long means get up the pitch for the second ball.
  // This half covers the keeper holding it in OPEN play, after a catch or a pickup. A stoppage runs
  // meSPShape rather than meShape (match.ts:542), so the goal kick -- the case that actually matters
  // -- is handled there instead, by gkShapePush.
  const gkHas = mp.idx >= 0 && mp.side === side && s.players[side][mp.idx]?.pos === "GK";
  const gkPush = gkHas ? (st.gkDist || 0) * CFG.gkDistPush : 0;
  // Tried and rejected: sweeping this floor -- it is "ball minus thirty", which goes behind the goal
  // line once the ball is inside thirty metres, so the literal 18 was never anything but a catch.
  // Swept 18 / 13 / 9 / 6 over 36 matches a cell looking for the reason nobody stands in the box:
  // the offside line moved 17.3 m to 16.7 and men in the area 0.46 to 0.48, which is nothing. This
  // is the shape of the side IN POSSESSION (t is high when you have the ball) and it barely touches
  // the DEFENDING block, which is meBlock and is where the line really comes from.
  const lineA = Math.max(18, Math.min(64, ballDepth - 30 + st.defLine * CFG.lineADefL + gkPush));
  const lineD = Math.max(7,  Math.min(56, ballDepth - 18 + st.defLine * 7));
  // THE PUSH GOES ON THE BLEND, NOT INSIDE IT. It used to be a term of lineA, and lineA is weighted
  // by t -- which comes off the possession EMA, and the EMA is at its LOWEST in exactly the seconds
  // after you win the ball. So the window and the weight were fighting: transPush was at its maximum
  // at the one moment t was near 0.25, and twelve metres of break arrived on the pitch as three.
  // That is the "moved the anchor line by a few metres" this instruction was written off for.
  // Clamped to the union of the two envelopes, because a push of +/-12 on an unclamped blend can put
  // a line behind its own goal or past the halfway flag.
  const lineM = Math.max(7, Math.min(64, lineD + (lineA - lineD) * t + push + hold));
  // Under siege the whole side squeezes toward its own goal: a block defending its box is ~22 m
  // deep. Held at its full midfield depth, the front of it sat 46 m out while the ball was in the
  // area, so the box itself was defended by two men.
  const siege = Math.max(0, Math.min(1, 1 - ballDepth / CFG.siegeDepth));
  // HOW FAR APART THE SIDE STANDS, and until now passingDir had no say in it. That instruction sets
  // the LENGTH a passer looks for -- want = 16 + passingDir * 4, so Much Shorter hunts eight-metre
  // balls -- while the shape it stands in was spaced for sixteen. At eight metres the only men
  // available are the ones beside and behind him, so a short-passing side passes sideways because
  // sideways is the only short pass that EXISTS. Measured: Tiki-Taka plays 104.8 passes a match, more
  // than any side in the game, for 296 metres of ground, less than any side in the game, with 49% of
  // them going forward against Gegenpress's 75%. It reaches the final third 11 times a match where
  // Gegenpress reaches it 27. Once there it is fine -- it turns final-third entries into box entries
  // at 10.6%, better than Wing Play -- so the whole deficit is that it never arrives.
  // Compressing the shape is what makes a short FORWARD ball exist. It is the option set again,
  // not the objective: a compact side advances as a unit and a stretched one plays over the top,
  // and each gives something up for it.
  const span = (38 + (t * 10 - 4) - st.defLine * 2 + Math.max(0, st.passingDir || 0) * CFG.spanDir)
             * (1 - siege * (1 - CFG.siegeSpan));
  const sl = mp.slots[side];
  let mn = Infinity, mx = -Infinity;
  for (const q of sl) { if (q.bd < mn) mn = q.bd; if (q.bd > mx) mx = q.bd; }
  const rel = (bd - mn) / Math.max(1, mx - mn);
  const wideness = (bw - ME_HALF_W) / ME_HALF_W, wide = Math.abs(wideness) > 0.40;
  // Weighted onto the middle band -- rel runs 0 at the deepest slot to 1 at the highest, so this
  // peaks on the midfielders and leaves the back line and the front line where they are.
  const apW = 4 * rel * (1 - rel);
  const building = mp.side === side && ballDepth < CFG.buildDepth;
  const apAdj = building ? (st.approachPlay || 0) * CFG.buildDrop * apW : 0;
  let ax = own + dir * (lineM + rel * span + apAdj);
  // NOT narrowed under siege. Tried and rejected: the block stayed as wide at its own goalmouth as
  // at the halfway line, which is wrong football, and narrowing it by up to 38% moved the share of
  // shots conceded from inside the box by one tenth of one percent -- 81.1% to 81.0% -- while making
  // the deepest setting concede more. Compactness is not what a low block is missing here. What it
  // is missing is in the next comment down.
  // HOW WIDE THE SIDE PLAYS, which until now nothing could ask for. Every other thing a style is
  // supposed to do to a shape had an instruction behind it and this one had none, so Wing Play was
  // stamped `{passingDir, approachPlay, creativity, dribbling}` and not one of those four touches
  // the y axis. Measured over 90 blocked fixtures a style, every side in the game struck 39-45% of
  // its passes from the wide channels -- which is what you get from a uniform spread across the
  // pitch. Nobody played wide and nobody played narrow, and Wing Play put FEWER balls into the area
  // (2.4 a match) than Gegenpress (3.2) or Vertical Tiki-Taka (3.3).
  // Two terms, because width is two things: how far off centre a man's slot sits, and whether he
  // holds that width when the ball goes to the other side. A narrow side collapses onto the ball --
  // that is what compact MEANS -- and a wide one refuses to, which is what keeps a switch on.
  //
  // AND IT IS THROTTLED, BY MESHAPE RATHER THAN BY ANYTHING HERE. Read the three widths for the side
  // in possession -- what this function asks for, what meShape ends up targeting, and where the men
  // actually stand, each as a mean distance off the centre line over ten outfielders:
  //   Wing Play +2, widthStep 0.16    asked 14.99   targeted 12.22   stood 11.73
  //   Wing Play +2, widthStep 0.90    asked 19.73   targeted 13.81   stood 13.00
  //   Balanced   0, widthStep 0.16    asked 12.04   targeted 11.32   stood 11.02
  //   Tiki-Taka -1, widthStep 0.90    asked  2.81   targeted  7.29   stood  7.70
  // The men chase their targets faithfully -- under a metre is lost between target and boot. Nearly
  // six metres is lost between HERE and the target, and at the narrow end the shape overrides the
  // anchor outright and stands them WIDER than asked. So an anchor range of 2.8 to 19.7 m arrives on
  // the pitch as 7.7 to 13.0, and pinning every wide slot to the touchline (widthStep 0.90, a 5.6x
  // coefficient) buys Wing Play 0.18 m of real width over the default.
  // This is why the defensive instructions bite and the attacking ones do not, and it is not about
  // width: pressingLOE and defLine feed meBlock's wantLine, which IS the target a defender chases,
  // with nothing re-solving on top of it. Everything in possession goes through meAnchor first and
  // is then overwritten by the duty, the leash, the rest-defence pull and the offside clamp. An
  // attacking instruction cannot reach the pitch until it has a path into the TARGET.
  // Kept rather than reverted: correctly ordered and monotone, it lifted Wing Play from +0.011 to
  // +0.102 xG on the blocked table while the spread went 0.428 -> 0.388 and goals a match held at
  // 2.80, and the model plumbing is what a real fix will need. Do not re-tune widthStep -- it is
  // already past saturation. Fix meShape.
  const wd = 1 + (st.width || 0) * CFG.widthStep;
  let ay = ME_HALF_W + wideness * ME_HALF_W * (wide ? 0.94 : 0.66) * wd * (1 + st.passingDir * 0.02);
  ay += (mp.by - ay) * (wide ? 0.10 : 0.30) * Math.max(0, 1 - (st.width || 0) * CFG.widthPull);
  // ...and a slot still has to be on the grass. wideness runs to about +/-0.76 on a real formation,
  // so the widest setting would otherwise post a full-back a metre off the touchline or past it.
  ay = Math.max(CFG.widthEdge, Math.min(PITCH_W - CFG.widthEdge, ay));
  // A side asked to keep it short needs somebody short to give it to, so the shape comes with the
  // instruction rather than leaving the passer to want a ball that is not on. Compress toward the
  // ball when playing shorter, stretch away from it when playing direct.
  const cmpA = CFG.compactAtk * (1 - st.passingDir * CFG.compactDir);
  ax += (mp.bx - ax) * (t > 0.5 ? cmpA : CFG.compactDef + Math.max(0, st.pressingLOE) * 0.03);
  return [ax, ay];
}

export function meSlots(s, side) {
  // OUT OF POSSESSION HE TAKES HIS DEFENSIVE SLOT. Same Hungarian, same naturalness cost -- only
  // the target shape changes, so a 3-4-3's wide midfielders get assigned into a back five without
  // anybody being told individually to drop.
  const ps = s.players[side];
  const slots = (s.mePos.side !== side && s.mePos.dslots?.[side]?.length)
    ? s.mePos.dslots[side] : s.mePos.slots[side];
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

// THE KEEPER'S ANGLE. The unit vector from the ball toward his goal along the bisector of the two
// posts (goalie_default.cpp:41-269) -- which is where a goalkeeper stands, and is not the line to
// the middle of the goal. For a ball in front of the goal the two agree; out wide they do not, and
// the difference is the near post, the one thing he is never allowed to give away.
//
// The frame he bisects is WIDER the worse he is. GF calls it `panic`: a keeper with poor positioning
// behaves as though he has more goal to cover, which drags him toward the middle and concedes the
// near post. It is the only place in the engine where goalkeeping is worth anything beyond reaction
// time and diving speed.
export function meGkAngle(p, own, bx, by) {
  const h = GOAL_HALF_W * (1 + (1 - meGkSkill(meAttrs(p))) * CFG.gkPanic);
  const ax = own - bx, ay = (ME_HALF_W - h) - by, al = Math.hypot(ax, ay) || 1;
  const cx = own - bx, cy = (ME_HALF_W + h) - by, cl = Math.hypot(cx, cy) || 1;
  let mx = ax / al + cx / cl, my = ay / al + cy / cl;
  const ml = Math.hypot(mx, my) || 1;
  return [mx / ml, my / ml];
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
    // PRESS THE BALL, NOT ONLY THE MAN. This branch was gated on mp.idx >= 0, so the moment the ball
    // came loose -- a tackle, a deflection, a bad touch -- nobody on the defending side was assigned
    // to it at all. Two things fell out of that, and they are the two complaints:
    //   a man standing over a loose ball holds his shape and watches an attacker come and take it,
    //   because the only defender who goes is mp.desig and he may be somebody else entirely;
    //   and the presser's duty EVAPORATES for those ticks, so on the next one he is back in the free
    //   pool where the assignment hands him a mark. He never chose to leave the ball -- a loose
    //   frame released him and something else picked him up.
    // A ball in flight is deliberately still excluded: that one has an intended receiver and a
    // designated chaser already, and sending the block after it is how a side gets pulled apart.
    const ballLive = mp.idx >= 0 || (!mp.flight && !mp.sp);
    if (ballLive) {
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
      // Tried and rejected: choosing the presser from the men with a CLAIM on the ball -- everyone
      // who was pressing and is still inside jockeying distance, plus anyone who has got within
      // handTake of it -- nearest first, instead of the single nearest by time-to-ball. It is the
      // rule the complaint describes and it reads worse on the complaint's own measure: the carrier
      // had nobody within four metres a second later on 4.6% of handovers against 1.3%, and the
      // relieved man ended up further away rather than nearer. Sticky at the DUTY level is the
      // wrong instrument, because the duty was never really the thing changing hands; see the
      // handover below, which is about where the relieved man goes.
    }
    // A CROWD CONTESTS. Exactly one man was sent to the ball however many were standing behind it,
    // so a side defending its own penalty area gave the man shooting the same 2.3 m of room as a
    // side holding the highest line in the game, blocked no more shots for it (4.5 against 4.9 a
    // match across the whole range) and conceded 81% of its shots from inside the box against a high
    // line's 67%. Sitting deep is supposed to buy a crowd you have to break down; it was buying
    // scenery. Near its own goal the block now closes with everybody near enough to matter, which is
    // the resistance a low block is for -- and it costs what it should, because every extra man at
    // the ball is a man not marking somebody.
    if (ballLive && ballDepth < CFG.swarmDepth) {
      // Tried and rejected: restricting the swarm to men already goal-side of the ball, on the
      // theory that they would contest without leaving the area. It read worse on every count --
      // 10/21 on the regression against 12, and the box share stopped falling monotonically with
      // the line at all. Whoever is nearest goes.
      // Tops the ball up to a TOTAL, rather than adding on top of whatever retention already kept
      // there: added unconditionally it stacked on the men who were already engaged and put three
      // defenders on the ball 8.4% of the time.
      // TRIED AND REJECTED: scaling the swarm with depth, so a besieged box converges more men than a
      // midfield one (swarmMax + round((1 - ballDepth/swarmDepth) * 2), i.e. up to four on the goal
      // line). The motive was sound -- a block at -2 keeps 5.83 men in its own box against a high
      // line's 3.56 and concedes exactly the same 4.0 shots at an identical 0.097 xG each, so the
      // extra bodies were scenery. It is strictly worse. Measured against a common attack, 60 matches
      // a cell, shots conceded / xG conceded at defLine -2 / 0 / +2:
      //   flat swarmMax   4.0 / 4.0 / 7.3     0.38 / 0.43 / 0.71
      //   scaled          5.7 / 5.7 / 8.6     0.57 / 0.58 / 0.75
      // Every rung concedes MORE and -2 is still identical to 0. Every extra man at the ball is a man
      // not marking somebody, and the marking is the half that works: Park The Bus allows 0.1 balls
      // into its area. Do not send more men at the carrier -- the shots are not arriving that way.
      for (let k = us.reduce((n, p) => n + (p._duty === "press" ? 1 : 0), 0); k <= CFG.swarmMax; k++) {
        const [si, sdist] = nearest(mp.bx, mp.by, free());
        if (si < 0 || sdist > CFG.swarmR) break;
        us[si]._duty = "press";
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
    // THE HANDOVER. A man who has just been relieved of the ball does not turn and sprint off to
    // pick somebody up thirty metres away -- he drops in behind whoever took it off him. Without
    // this the press job changing hands put him straight back into the free pool, where the
    // Hungarian is looking for the cheapest man for a mark and he is by definition the nearest
    // defender to the most dangerous part of the pitch. Measured: he ended up a further 2.5 m from
    // the carrier a second later, 6.7 m at the ninetieth percentile, and 30% of the time he was
    // marking somebody else. That is the thing being watched from the stand, and it is not the
    // duty changing hands -- somebody was still within a metre and a half of the ball on 98.7% of
    // those handovers -- it is where the relieved man goes afterwards. Cover is where he goes.
    if (mp.idx >= 0) for (let i = 0; i < us.length; i++) {
      const p = us[i];
      if (!p._wasPress || p._duty !== "hold" || p.off || p.pos === "GK" || p._beat > 0) continue;
      if (Math.hypot(p.x - mp.bx, p.y - mp.by) < CFG.handEngage) p._duty = "cover";
    }
    // ONE cover, goal-side of the ball.
    const [ci] = nearest(mp.bx - dir * 8, mp.by, free());
    if (ci >= 0) us[ci]._duty = "cover";
    // A BEATEN MAN HAS A DECISION TO MAKE, and until now he made none: _beat drops him out of free()
    // so he takes no job at all and drifts back to his block slot. He has just gone in and missed.
    // Deep in his own third the answer is to get goal-side and let the cover engage; out in midfield
    // there is room to turn and go with the man, and dropping off just concedes the whole half.
    //
    // WHICH HE PICKS IS HIS OWN READING OF IT. meAttrs().position is exactly that attribute, so a
    // good defender is usually on the right side of the choice and a poor one is often not -- which
    // is what "he gave up and marked somebody else" looks like from the stand. Rolled off a hash of
    // the tick rather than the rng, so it is reproducible and does not consume the seeded stream in
    // a function that has never needed one.
    for (let i = 0; i < us.length; i++) {
      const p = us[i];
      if (!(p._beat > 0) || p.off || p.pos === "GK") continue;
      const deep = ballDepth < CFG.beatDeep;
      let h = (Math.imul(mp.tick, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0;
      h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
      const reads = (h >>> 8) / 16777216 < meAttrs(p).position / 99;
      p._duty = reads === deep ? "recover" : "press";
    }
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
    // TRIED AND REJECTED: scaling the marker budget with how many men are actually back, so a deep
    // block's surplus bodies pick opponents up instead of standing in the shape. nMark keys on where
    // the BALL is and nothing else, so a block on defLine -2 with 5.83 men in its own area marked as
    // many opponents as a high line caught out with 3.56, and the passer always had a free man --
    // measured over 200 matches controlled for distance, a ball into the box completed 49.3% against
    // 0-2 defenders and 42.9% against six, flat inside the noise.
    // It makes the deep block WORSE. Every man back beyond a spare-count of 7 picking somebody up,
    // at 360 blocked fixtures a rung, goals against at defLine -2 / -1 / 0 / +1 / +2:
    //   before   1.35 / 1.26 / 1.33 / 1.53 / 1.73     xGD at -2  -0.080
    //   after    1.43 / 1.36 / 1.32 / 1.47 / 1.80     xGD at -2  -0.191
    // Box-pass completion did fall in aggregate, 51.3% to 45.5% over the 8-20 m band, and it bought
    // nothing: the men doing the marking leave the block, and the block is worth more than the marks.
    // That is the SECOND confirmation of the same law tonight -- the swarm experiment took men out of
    // the shape to contest the ball and also made it worse. A low block cannot be improved by giving
    // its members a different job. Whatever is wrong with depth here, it is not the duties.
    const nMark = (ballDepth < CFG.markSiegeDepth ? CFG.markSiege
                 : ballDepth < 34 ? 4 : ballDepth < 60 ? 2 : 1) + runners;
    // Assigned as one problem, not one pick at a time. Picking greedily hands the same region to
    // several defenders at once, which is what put six of them in the same square metre.
    {
      // ...and never ask for more men than we have. The Hungarian minimises TOTAL cost and has no
      // idea that pick[0] is the most dangerous man on the pitch: handed eight threats and five
      // free defenders it leaves three unassigned, and the three it leaves are whichever are
      // expensive to reach -- which is precisely the man who has already got away. Measured, the
      // most dangerous opponent off the ball was marked 59.6% of the time and free 61.7%. Cutting
      // the list to the number of men available makes the ones we cannot cover the ones that
      // matter least, which is the decision a defence actually makes.
      const avail = free();
      const pick = threats.slice(0, Math.min(nMark, threats.length, avail.length));
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
            // Tried and rejected: a markStick discount for keeping the man you already had, read
            // off _mkPrev. It moved the "marks somebody else after being beaten" figure by nothing
            // (8.9% -> 9.2%, noise) and cost the regression a point. The figure is not measuring
            // what it looks like: it counts EVERY defender the carrier goes past, about 120 a match,
            // almost none of whom were marking him -- they were never engaged, so marking somebody
            // else is them doing their job. A man who is genuinely beaten is excluded from free()
            // and cannot be assigned a mark at all.
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
// The ring is eight fixed compass points and it has always been eight fixed compass points, but
// the sine and the cosine of each were taken fresh on every candidate, of every player, of every
// tick -- a million and a half trig calls a match for sixteen numbers that never change.
const RING = Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
export function meFindSpace(s, side, p, baseX, baseY, off) {
  const mp = s.mePos, dir = meDir(side);
  // HOW CLOSE THE SIDE IS WILLING TO STAND. A flat radius here is a MINIMUM SPACING nothing can
  // reach, and it is the single biggest thing standing between an instruction and the pitch.
  // Measured, as the mean distance off the centre line for ten outfielders at each stage of
  // meShape, with both sides on the same style:
  //                anchor   after this   after rest   after leash   target   stood
  //   Wing Play +2  15.06   15.10 (+.04)  13.20        13.29         12.79    12.41
  //   Balanced   0  12.06   13.41 (+1.36) 11.80        11.78         11.36    11.06
  //   Tiki-Taka -1   9.57   12.01 (+2.43) 10.72        10.62         10.27    10.11
  // It does not clamp the wide end -- it INFLATES the narrow one, by 2.43 m against 0.04 -- so an
  // anchor range of 5.49 m leaves this one stage as 3.09. A compact side stands close together by
  // definition, every central candidate is therefore crowd-penalised, and the search shoves them
  // back apart. The leash, for the record, is innocent: it moves the target 0.09 / -0.02 / -0.10.
  // Same disease as blkSpacing in meBlock, and the same cure -- the constant carries the
  // instruction instead of overruling it.
  // AND IT ONLY GETS PART OF IT BACK, so do not read this as solved. Scaling the radius takes the
  // range surviving THIS stage from 3.09 m to 3.67 m of the anchor's 5.50 -- 19% more -- and the
  // table is unmoved by it (spread 0.412 -> 0.418, goals 2.77 -> 2.81, both inside a se of 0.07).
  // End to end it buys nothing yet: 43% of the anchor's range reaches the pitch either way, because
  // rest defence then takes 2.12 m off a wide side against 1.17 off a narrow one and the smoothing
  // takes a flat half metre more. There is no single villain left -- three stages each shave a
  // legitimate slice, and the sum is the instruction. Kept because it is a correctness fix of the
  // same kind that DID work in meBlock, and because it composes: fix the compression downstream and
  // this gain stops being eaten. The next real move is architectural -- solve the target once from
  // (anchor, job, ball) instead of as a chain of overwrites and pulls.
  const st = s.strategy?.[side] || NO_INSTRUCTIONS;
  const cr = Math.max(4, CFG.crowdR * (1 + (st.width || 0) * CFG.widthStep));
  // NINE CANDIDATES WAS A JUMP OR NOTHING. The search offered his own slot or a point exactly
  // ME_SPACE_R away in one of eight directions, so it could never make a small adjustment: either
  // the base won outright or he was displaced nine metres. That is why raising basePullW bought so
  // little -- swept to fourteen times its value it moved the width arriving on the pitch from 18%
  // to 26%, because the term was not losing a close contest, it was losing a binary one. A second
  // ring at half the radius lets him shade a couple of metres off his slot, which is what a
  // footballer adjusting his position actually does.
  // ...and how hard the base pulls is now a property of WHY he is standing there. A man on his
  // formation's own slot is cheap to move; one an instruction has deliberately placed is not.
  const hold = CFG.basePullW * (1 + CFG.holdDev * (p._dev || 0));
  // Two terms in the score below depend on the MAN and not on the candidate, and both were being
  // worked out again for every one of the seventeen -- including a square root of a distance from
  // a point that cannot move inside this loop. Same arithmetic, same order, computed once.
  const mindK = (2.2 - 1.2 * (p._mind ?? 0.5)) / 2.2;
  const awayK = 0.3 + 0.7 * Math.min(1, Math.hypot(p.x - baseX, p.y - baseY) / 20);
  let bx = baseX, by = baseY, best = -Infinity;
  for (let k = 0; k <= 16; k++) {
    const ring = RING[k % 8], rad = k >= 8 ? ME_SPACE_R : ME_SPACE_R * CFG.spaceInner;
    const cx = k === 16 ? baseX : baseX + ring[0] * rad;
    const cy = k === 16 ? baseY : baseY + ring[1] * rad;
    if (cx < 2 || cx > PITCH_L - 2 || cy < 2 || cy > PITCH_W - 2) continue;
    if ((cx - off) * dir > 0 && (cx - mp.bx) * dir > 0) continue;          // would be offside
    let crowd = 0;
    for (const q of s.players[side]) { if (q === p || q.pos === "GK") continue;
      const d = Math.hypot(q.x - cx, q.y - cy); if (d < cr) crowd += (cr - d) / cr; }
    const sc = meCtrl(s, side, cx, cy) * 1.00                    // do we own it
             + meDanger(side, cx, cy) * 1.30                     // is it worth owning
             - meLaneBlock(s, side, mp.bx, mp.by, cx, cy) * 0.30 // can the ball reach me
             + meSpaceGain(s, side, cx, cy) * ME_SPACE_W          // would we newly own ground here
             - crowd * 0.55                                      // is somebody already there
             - mindK * Math.max(0, 1 - meOppDist(s, side, cx, cy) / 8) * CFG.oppAvoidW
             // The carrier orbit band: an ideal 12-21 m ring for a supporting man -- without it a
             // spot on the carrier's shoulder and one forty metres away scored identically.
             + (attackingRing(s, side, cx, cy)) * CFG.orbitW
             // The further out of shape you already are, the harder the base pulls you back.
             - Math.hypot(cx - baseX, cy - baseY) * 0.010 * awayK * hold;
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
  // ONLY THE COUNTER-PRESS END SCALES THIS. Regroup used to double the drop to 30 m and it bought
  // literally nothing -- the -1 column was identical to neutral on every behaviour measure in the
  // isolated axis. Two reasons, and they compound: the drop DECAYS to zero by transT, so it is a
  // three-and-a-half second pulse that ends where it started, and the block slides at running pace.
  // Men cannot chase a pulse. Cancelling the drop (the +1 end) is a different proposition because it
  // holds for the window rather than pulsing, and it is unclamped whenever the ball is lost in
  // midfield -- at ballDepth 50 it is the difference between a wanted line of 21 and one of 36.
  // (High up the pitch both clamp to blkMax and the +1 end does its work through the extra presser
  // in meDuties instead.)
  // ...AND THE REGROUP END GETS A SUSTAINED ONE INSTEAD. Urgency alone was measured and it is not
  // enough: sprinting men into a block that is still clamped to blkMax wins the ball back HIGHER,
  // which is the counter-press's job. fieldX read 40.5 against a neutral 38.9 -- the axis moving
  // backwards. What separates regrouping from counter-pressing is not speed, it is that a regrouping
  // side CONCEDES the territory and re-forms behind the ball, and it does that for as long as they
  // have it rather than for three and a half seconds. So this half does not decay: it holds while
  // the other side is in possession and lifts the moment we win it back.
  const drop = trans * CFG.transDrop * (1 - Math.max(0, st.possLost || 0) * CFG.transPressW)
             + (lostT < 1e9 && (st.possLost || 0) < 0 ? CFG.regroupDrop : 0);
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
  // Tried and rejected: letting the deepest band hug the ball under siege instead of sitting on
  // blkMin's flat ten-metre floor, on the theory that attackers were getting goal-side of the whole
  // defence. They are not -- measured, only 1.2% of opponents in our own third are nearer our goal
  // than our deepest outfielder, who sits at 13.1 m. Swept over 1.0 / 0.7 / 0.55 / 0.4 it moved that
  // to 0.9% and took the nearest defender to a man in our box the WRONG way, 3.2 m to 3.8. The
  // block's depth problem is real -- 15.3 m of spread against a wanted 18-26, and 3.6 of ten men
  // inside the box against 4.5-7 -- but it is not the line's floor, and it is not blkDepthLow
  // either, which moved the spread 15.0 to 16.4 and nothing else.
  // THE BOUNDS CARRY THE INSTRUCTION INSTEAD OF OVERRULING IT. blkMin/blkMax were fixed, and they
  // ate defLine almost entirely: measured over 25,000 defending samples a rung, 63-66% of all
  // defending time was spent pinned against a bound, and the high clamp rose monotonically with the
  // instruction -- 44% / 51% / 56% at -2 / 0 / +2 -- which is the instruction being applied and then
  // erased. The line the back four actually held spanned 31.6 to 35.3 m across the whole range: 3.7
  // metres of an instruction worth 6 a step, so 24 metres nominal arrived as 15%.
  // Delivery below this line is faultless, which is why it took so long to find. Ask -> block loses
  // 0.1 m and block -> where the men stand loses 0.3, at every rung. Nothing downstream is broken;
  // the ASK never contained the instruction in the first place.
  // Shifting the window by the same step the value moves is exact rather than approximate:
  // clamp(a + k, lo, hi) eats k, clamp(a + k, lo + k, hi + k) is clamp(a, lo, hi) + k. So a side
  // told to sit deep gets a deeper sane range and one told to push up gets a higher one, and the
  // absolute bounds below only stop a line leaving the pitch or crossing halfway.
  const lineShift = st.defLine * CFG.blkDefLine;
  const lineLo = Math.max(CFG.blkFloor, CFG.blkMin + lineShift);
  const lineHi = Math.min(CFG.blkCeil, CFG.blkMax + lineShift);
  const wantLine = Math.max(lineLo, Math.min(lineHi,
    ballDepth - CFG.blkDrop + st.defLine * CFG.blkDefLine + st.pressingLOE * CFG.blkLoe - drop + dlA));
  const wantCy = ME_HALF_W + (mp.by - ME_HALF_W) * CFG.blkSlide;
  // The block slides at running pace, because it is a body of men rather than a formula.
  // Compact defending your own box, long when you are camped in their half.
  const wantDepth = CFG.blkDepthLow
    + Math.max(0, Math.min(1, (ballDepth - 18) / 42)) * (CFG.blkDepth - CFG.blkDepthLow);
  const bs = (mp.blk[side] = mp.blk[side] || { line: wantLine, cy: wantCy, depth: wantDepth });
  // A BLOCK THAT HAS BEEN CHASED ALL AFTERNOON DOES NOT RESET PERFECTLY. This is the inertia the
  // note above valCtrlW says is missing: the shape is re-solved every tick, so no side is ever out
  // of position long enough to be exploited, and therefore keeping the ball buys nothing.
  // Measured over 1,645 shots with both sides Balanced -- xG per shot against how long the side had
  // held the ball: 0.167 within a second of winning it, 0.101 at one to three seconds, 0.089 at
  // three to six, 0.118 after twelve. A worked chance is WORSE than a turnover chance, and the box
  // refills inside three seconds (4.43 defenders at the turnover, 4.80 by six). Transition is the
  // only way to create, which is why the three transition styles finish first, second and third and
  // the two possession styles finish last.
  // So the longer they keep it, the slower the block recovers its line. It is not a penalty on
  // defending -- a side that wins the ball back promptly is untouched, and the ramp only starts once
  // a possession has already outlasted a normal one.
  const chased = (mp.side !== side && mp.side !== null)
    ? Math.max(0, Math.min(1, (mp.possT - CFG.chaseFrom) / CFG.chaseRamp)) : 0;
  const mv = (wantLine < bs.line ? CFG.blkSlewBack : CFG.blkSlew)
           * (1 - chased * CFG.chaseSlow) * ME_DT;
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
  // THE LIVE SLOT, NOT THE ONE HE STARTED IN. These read _bd0, which match.ts:32 writes once at
  // kickoff and nothing but a substitution ever touches -- so which band a man belonged to was fixed
  // for the whole match. meSlots (brain.ts:179) meanwhile runs every eighth tick and solves exactly
  // the problem that creates: a Hungarian assignment of players to formation slots, with a
  // naturalness cost so a striker does not become a centre-half, which is how a vacated slot gets
  // covered when somebody leaves it to press. It writes _bd/_bw, and meBlock never read them. The
  // re-covering machinery has been running all along with its output discarded.
  //
  // Measured before this: a 5-3-2 put FEWER men in its own box than a 4-3-3 (0.87 against 1.01),
  // because bands are thirds of the _bd0 RANGE rather than of the formation's actual lines, so a
  // back five was split across bands by natural depth and never defended as a five.
  for (const i of idx) { const b = us[i]._bd ?? us[i]._bd0; if (b < mn) mn = b; if (b > mx) mx = b; }
  const span = Math.max(1, mx - mn);
  const bands = [[], [], []];
  for (const i of idx) {
    const rel = ((us[i]._bd ?? us[i]._bd0) - mn) / span;
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
    // Tried and rejected: dropping the FRONT band under siege too, on the finding that the forwards
    // are ordered to stand a median 12 m ahead of the ball even with it in our own box. Swept at
    // 0 / 0.20, defenders inside the box went 4.3 -> 3.8 of ten and the regression 13/21 -> 12 --
    // the wrong way. Pulling the front three back does not add bodies to the area; it just shortens
    // the block, and the men it moves stop being an out-ball without ever reaching the box.
    const frac = b === 1 ? 0.5 - siege * CFG.blkMidDrop : b / 2;
    const bx = own + dir * (line + depth * frac);
    // A BAND IS AS WIDE AS THE MEN IN IT. Held at a flat width, a back FOUR stood ten metres apart
    // and a back THREE stood fifteen -- so the fewer defenders a formation had, the bigger the holes
    // it left, which is exactly backwards. A real back three defends narrow and lets the wing backs
    // cover the width; that is the whole idea of the shape. Spacing is what is constant, not span.
    const spacing = CFG.blkSpacing + b * CFG.blkSpaceStep;
    // ...AND THE BLOCK IS AS WIDE AS THE SIDE IS ASKED TO BE. Without this the width instruction is
    // undone by the side's own rest defence: a man who is not on a run is dragged restW of the way
    // back to his BLOCK slot while his own team attacks (see meShape), and that slot was a pure
    // function of spacing and row size. Full-backs are both the men who give a side its width and
    // the men rest defence holds hardest, so the instruction was being written and then erased by
    // the next line of the same function.
    // Measured, with restW swept 0.7 / 0.35 / 0 on Wing Play at width +2: the share of the asked-for
    // width that survives to the pitch goes 18% / 24% / 37%, crosses 0.50 / 0.60 / 0.96 and balls
    // into the area 2.44 / 2.25 / 2.69. Turning rest defence off is not the fix -- it is there
    // because a side with no shape to fall into arrives four seconds late to every counter -- so the
    // slot it pulls them to carries the instruction instead.
    // It also gives width the second half an instruction needs: a wide side now DEFENDS wide, which
    // is a real cost in the middle, and a narrow one defends narrow. That is the trade.
    const bwd = 1 + (st.width || 0) * CFG.widthStep;
    const w = Math.min(CFG.blkWidthMax, spacing * Math.max(1, rowi.length - 1) * bwd)
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
  const lineA = Math.max(18, Math.min(64, ballDepth - 30 + st.defLine * CFG.lineADefL));
  const lineD = Math.max(7,  Math.min(56, ballDepth - 18 + st.defLine * 7));
  const lineM = lineD + (lineA - lineD) * t;
  const span = 38 + (t * 10 - 4) - st.defLine * 2 + Math.max(0, st.passingDir || 0) * CFG.spanDir;
  let minBd = Infinity, maxBd = -Infinity;
  for (const q of ps) if (q.pos !== "GK") { if (q._bd < minBd) minBd = q._bd; if (q._bd > maxBd) maxBd = q._bd; }
  const bdRange = Math.max(1, maxBd - minBd);
  const off = meOffsideLine(s, side);
  const them = s.players[meOther(side)];
  // How besieged we are: 0 with the ball far away, 1 with it on our goal line.
  const siege = Math.max(0, Math.min(1, 1 - ballDepth / CFG.siegeDepth));

  // BOX STATIONS. See CFG.boxFrom: with the ball in the final third the boxMen most attacking men
  // -- not the carrier, not the keeper -- man the near post, the penalty spot and the far post.
  // Lanes are dealt by formation width so they do not flicker: the man nearest the ball's side
  // takes the near post, the farthest the far post.
  const boxLane = new Map();
  // Engagement with hysteresis: on past boxFrom, and held boxHold ticks once on, so the front men
  // do not yo-yo between their stations and the anchor every time the ball dips out of range.
  mp._boxT = mp._boxT || { home: 0, away: 0 };
  // ...and which side of the pitch the ball is on is remembered with a dead zone, not read raw:
  // the near and far posts swap when the ball crosses the centre line of the pitch, and the ball's
  // y oscillates through the centre every few seconds of build-up -- read raw, the two wide men
  // exchanged an eleven-metre shuffle each time and spent the whole spell commuting (mean 18.6 m
  // from station, 13% arrival). The side only updates when the ball is clearly wide of centre.
  mp._boxLow = mp._boxLow || { home: true, away: true };
  if (Math.abs(mp.by - ME_HALF_W) > 6) mp._boxLow[side] = mp.by < ME_HALF_W;
  // THE LANES ARE STICKY. Re-picked every tick, the carrier exclusion rotated membership through
  // exactly the front men -- whoever took a touch surrendered his lane and its next holder started
  // thirty metres away -- so the far post was a job description everyone briefly held and nobody
  // did. Measured before this: mean 17.6 m from station, 12% arrival. Picked once per engagement
  // spell; a man on the ball or mid-run keeps his lane and simply skips the override for a tick.
  const engaged = attacking && ballDepth > CFG.boxFrom;
  if (engaged && mp._boxT[side] <= 0) {
    const cand = [];
    for (let j = 0; j < ps.length; j++) {
      const q = ps[j];
      if (q.pos === "GK" || q.off) continue;
      cand.push([j, q.atkW ?? 0]);
    }
    cand.sort((a, b) => b[1] - a[1]);
    mp._boxPick = mp._boxPick || {};
    mp._boxPick[side] = cand.slice(0, CFG.boxMen).map(c => c[0]);
  }
  if (engaged) mp._boxT[side] = CFG.boxHold;
  else if (mp._boxT[side] > 0) mp._boxT[side]--;
  // The hold timer is the ONLY gate on holding a station. Gated on `attacking` as well, a
  // fifty-fifty scramble in the final third -- where mp.side flips on every touch -- released the
  // front men once a second and they drifted off their posts mid-move. A striker stays high
  // through a scramble; if possession has genuinely gone, the timer runs out and rest defence
  // collects him.
  if (mp._boxT[side] > 0 && mp._boxPick?.[side]) {
    const picks = mp._boxPick[side].filter(j => !ps[j]?.off);
    const ballLow = mp._boxLow[side];
    picks.sort((a, b) => ballLow ? (ps[a]._bw ?? ME_HALF_W) - (ps[b]._bw ?? ME_HALF_W)
                                 : (ps[b]._bw ?? ME_HALF_W) - (ps[a]._bw ?? ME_HALF_W));
    picks.forEach((j, r) => boxLane.set(j, r));
  }

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
        // ...and he closes ALONG HIS ANGLE. Walking straight at the ball from wherever he happened
        // to be means the angle he ends up covering is whatever it was when the carrier entered the
        // area, and he arrives square to nothing. Two thirds of all shots are struck inside the area,
        // so this branch owns the keeper for most of them: measured, even with the resting stance on
        // the bisector his target still sat 0.19 of the half-angle toward the far post, and all of
        // that was here. He now stands gkStand short of the ball ON the bisector, so coming out and
        // being on his angle are the same movement instead of two that fight each other.
        // ...AND HE POUNCES ON A HEAVY TOUCH. Standing gkStand short is right while the carrier
        // has it under control -- but gkStand is OUTSIDE his own smother radius, so a keeper who
        // only ever set himself could never start the smother; he waited for the carrier to walk
        // into him. The moment the touch puts the ball beyond the carrier's playable reach it is
        // loose, his hands beat anybody's feet to a loose ball, and he goes for the ball itself.
        // Whether he goes is judgement (meMind): the sharp keeper recognises the races he wins.
        const carrier2 = s.players[mp.side][mp.idx];
        if (carrier2) {
          const bg = Math.hypot(carrier2.x - mp.bx, carrier2.y - mp.by);
          const gb = Math.hypot(p.x - mp.bx, p.y - mp.by);
          if (bg > CFG.reach * CFG.playReach * CFG.gkPounceGap
              && gb < bg * (CFG.gkPounceLo + CFG.gkPounceMind * meMind(p))) {
            p._tx = mp.bx; p._ty = mp.by; p._closing = true;
            continue;
          }
        }
        const [mx3, my3] = meGkAngle(p, own, mp.bx, mp.by);
        p._tx = mp.bx + mx3 * CFG.gkStand;
        p._ty = mp.by + my3 * CFG.gkStand;
        p._closing = true;
        continue;
      }
      const bx2 = mp.bx, by2 = mp.by;
      const vx2 = bx2 - own, vy2 = by2 - ME_HALF_W, vd = Math.hypot(vx2, vy2) || 1;
      const out2 = Math.max(CFG.gkOutMin,
                   Math.min(CFG.gkOutMax, CFG.gkOutMin + vd * CFG.gkOutK + st.dlBehavior * 1.2));
      // HIS ANGLE IS THE BISECTOR OF THE TWO POSTS, not the line to the middle of his goal
      // (goalie_default.cpp:41-269). For a ball in front of the goal the two are the same line; for
      // a ball out wide they are not, and the whole of the difference is the near post. Bisecting
      // the posts leans him toward the post the shooter is nearest, which is the one thing a keeper
      // never gives away; the centre line leans him off it. Measured from the shooter's own view of
      // the mouth, he stood 35% of the way from his angle toward the FAR post on a median shot and
      // 57% of the way on shots from outside the width of the six-yard box.
      //
      // ...and against a goal that is wider the worse he is. GF calls it `panic`: a keeper with poor
      // positioning behaves as though he has more frame to cover, which drags him toward the middle
      // and concedes the near post. It is the only place in the engine where being a good goalkeeper
      // is worth anything other than diving speed and reaction time.
      const [mx2, my2] = meGkAngle(p, own, bx2, by2);
      const sgn2 = vx2 >= 0 ? 1 : -1;
      // Walk down the bisector from the ball until he is out2 metres off his line. If the ball is
      // level with the goal the bisector runs parallel to it and there is no such point, so the old
      // radial rule stands in -- which is also the case where the two rules agree anyway.
      const step2 = Math.abs(mx2) > 1e-3 ? (own + sgn2 * out2 - bx2) / mx2 : -1;
      p._tx = own + vx2 / vd * out2;
      const rawY = step2 > 0 ? by2 + step2 * my2 : ME_HALF_W + vy2 / vd * out2;
      // Not clamped to the width of the posts, which is what GF does: held inside the frame he could
      // never get across to a ball out wide, and that was measured and fixed here long before this.
      p._ty = ME_HALF_W + Math.max(-CFG.gkSide, Math.min(CFG.gkSide, rawY - ME_HALF_W));
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
      let tx2 = p._bsx ?? p.x, ty2 = p._bsy ?? p.y;
      // ...BUT A MAN WHO HAS BEEN GIVEN SOMEBODY TO MARK GOES AND MARKS HIM. The block owning every
      // defending position meant the whole of `case "mark"` below -- the goal-side offset, the
      // shooting point, the drop-off-when-beaten -- was dead code whenever the side was actually
      // defending, because this branch returns before the switch is ever reached. meDuties assigned
      // markers, _mk decided he should hurry, and then nobody walked toward anybody: measured, the
      // marker was goal-side of his man 56.3% of the time against a real defence's ~95%, the most
      // dangerous opponent off the ball had nobody goal-side within five metres 61.7% of the time,
      // and a third of the men standing in our own box had nobody between them and the goal at all.
      //
      // The block stays the base -- it is the thing that actually holds a shape, and every previous
      // attempt to replace it with man-marking positions read worse. He is drawn off it toward his
      // man by markPull, and then the invariant is asserted rather than approached: whatever the
      // slot says, a marker is never left standing upfield of the man he is marking.
      // Swept a markPull term alongside this -- how far off the slot he is drawn toward his man --
      // over 0 / 0.5 / 0.75 / 1.0. It measured as noise at every value (60.5 to 63.2% goal-side)
      // because the clamp below already does the work, so it is not here: a knob that reads as
      // noise is a knob that should not exist.
      // BETWEEN THE MAN AND THE GOAL IS TWO-DIMENSIONAL. This asserted it on x alone, so a marker
      // could satisfy it completely while standing eight metres to one side of his man -- goal-side
      // along the pitch, beside him on the grass, and no use to anybody. That is also why the
      // markPull sweep above read as noise at every value: it was testing a knob against a clamp
      // that only ever fixed half the geometry.
      // The goal-side point is markGoalSide metres from him ALONG THE LINE TO OUR GOAL, not simply
      // lower x. He is drawn onto that line by markLine -- the block still shapes him, which is the
      // thing that actually holds a defensive structure -- and then the x invariant is asserted on
      // top, so however the pull lands he is never level with his man or upfield of him.
      const mk2 = p._mk >= 0 ? them[p._mk] : null;
      if (mk2 && !mk2.off) {
        const vx = own - mk2.x, vy = ME_HALF_W - mk2.y, L = Math.hypot(vx, vy) || 1;
        const gsx = mk2.x + vx / L * CFG.markGoalSide, gsy = mk2.y + vy / L * CFG.markGoalSide;
        tx2 += (gsx - tx2) * CFG.markLine;
        ty2 += (gsy - ty2) * CFG.markLine;
        if ((mk2.x - tx2) * dir < CFG.markGoalSide) tx2 = mk2.x - dir * CFG.markGoalSide;
      }
      tx2 = Math.max(1.5, Math.min(PITCH_L - 1.5, tx2));
      ty2 = Math.max(1.5, Math.min(PITCH_W - 1.5, ty2));
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
    // How far the system has moved him off his own formation slot. An instruction that has
    // deliberately put a man somewhere is worth more than a default, and this is what tells
    // the space search to hold it rather than trade it away for the nearest patch of grass.
    const _a0 = meAnchor(s, side, p._bd, p._bw, true);
    p._dev = Math.hypot(_a[0] - _a0[0], _a[1] - _a0[1]);
    p._anx = _a0[0]; p._any = _a0[1];        // kept as a vector too -- see the restore below the leash
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
          // _beat is set in meTackle now, as the outcome of a challenge he chose to make. It was
          // set here from "the ball has gone past me", gated behind an instruction nobody sets by
          // default, which is why being beaten measured at 0.0% of slices.
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
          // OFF THE PITCH IS NOT AN OPTION, and it used to be removed from the search rather than
          // scored -- `continue` on any point outside a 2 m margin. A man already inside that margin
          // therefore had every one of his eight directions vetoed, the search returned nothing, and
          // he simply held his previous committed angle: straight over the line. Measured, 5.5 balls
          // a match were carried out, 36% of every ball that left the pitch, and the median carrier
          // was 1.2 m from the touchline at the moment he committed. Priced instead of vetoed, the
          // search always has an answer and the answer always points back onto the grass.
          const outBy = Math.max(0, 2 - Math.min(eSide, cx, PITCH_L - cx));
          if (outBy > 0) sc2 -= CFG.outHard * (1 + outBy);
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
      // THE LINE IS ALWAYS THERE. Pricing the out-of-play terms in the search above is the wrong
      // instrument for this and measured like it: twelve cells over outLook 6-18 m and 1-20x the
      // price all landed between 3.8 and 6.0 carried-out balls a match with no trend at all. The
      // search only runs every carryCommit slices, and at carry pace that is five metres of travel
      // -- traced, the median man who ran it out was 0.5 m from the line with the ball already
      // 1.4 m in front of him and rolling at 5.2 m/s. Nothing he DECIDED could still reach that.
      // A footballer does not re-notice the touchline once a second; he can see it the whole time.
      // So the line he is taking the ball on is clamped against the pitch every slice, from where
      // the BALL is rather than where he is. Running the touchline is untouched -- a heading that
      // stays inside is never bent -- and only one that genuinely exits gets turned back.
      {
        const ex = mp.bx + Math.cos(p._drbA) * CFG.dribEdge, ey = mp.by + Math.sin(p._drbA) * CFG.dribEdge;
        const cxE = Math.max(CFG.dribEdgeM, Math.min(PITCH_L - CFG.dribEdgeM, ex));
        const cyE = Math.max(CFG.dribEdgeM, Math.min(PITCH_W - CFG.dribEdgeM, ey));
        if (cxE !== ex || cyE !== ey) p._drbA = Math.atan2(cyE - mp.by, cxE - mp.bx);
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
      //
      // ...but a target ON the ball is not a bearing, it is a point under his own feet, and that is
      // the whole of "he drags it by his side". Traced: his target was the ball on 99.6% of carried
      // slices, the ball sat 0.62 m away, and his velocity was 65 degrees off both. The direction to
      // a target that close swings through a right angle in the time it takes him to move past it,
      // so his steering can never settle and he circles the ball instead of running with it -- which
      // is also the slow gravitating around the ball, the same mechanism seen from further away.
      // Tightening the touch-offset limit was the obvious answer and is not the mechanism: swept
      // from 180 degrees down to 30 it moved the angle the wrong way, 78 to 87, because the limit is
      // measured against a velocity that is itself pointing at the off-line ball.
      //
      // So he is aimed BEYOND the ball, along the line he has picked. That is a bearing that holds
      // for several slices, and it does not stall the way a point behind the ball does: the target
      // is on the far side of it, so he runs THROUGH the ball, and the touch is what puts it back in
      // front. He cannot outrun it either -- the touch leaves his foot touchMin quicker than he is
      // going, every time.
      const ca = p._drbA ?? (dir > 0 ? 0 : Math.PI);
      p._tx = mp.bx + Math.cos(ca) * CFG.carryAim;
      p._ty = mp.by + Math.sin(ca) * CFG.carryAim;
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
      let rest = Math.max(0, Math.min(1, (CFG.restMind - (p._mind ?? 0.5)) / Math.max(0.01, CFG.restTaper)));
      // WHO STAYS HOME IS A PROPERTY OF THE SYSTEM, not only of how deep a man naturally plays.
      // Keyed on _mind alone, a full-back is pinned back exactly as hard in a side built to attack
      // from the flanks as in one built to sit -- and a full-back IS the width of a wide system.
      // Measured stage by stage, this line was the largest single loss left: it took 2.10 m off a
      // wide side's shape against 1.03 off a narrow one, because the block it drags them to is
      // rightly narrower than the attack. So a side told to play wide commits the men who provide
      // that width, and the centre-halves and the holder do the resting instead.
      // It is a trade rather than a gift, and the cost is the one real football pays for it: those
      // full-backs are not behind the ball when it turns over.
      const wideSlot = Math.abs((p._bw ?? ME_HALF_W) - ME_HALF_W) / ME_HALF_W;
      rest *= Math.max(0, 1 - Math.max(0, st.width || 0) * wideSlot * CFG.restWide);
      // Tried and rejected: scaling this by creativity, so that Be More Disciplined bought rest
      // defence. The motive was real -- leave-one-out on Cholismo says creativity: -1 costs +0.185
      // xG at 2.1 standard errors and the side scores MORE and concedes LESS without it, which is a
      // tax rather than a tactic, exactly what dribbling: -1 was. This is not the fix. Swept
      // 0 / 0.30 / 0.55 over 90 blocked fixtures a cell, it FAILED ITS OWN CONTROL: Balanced carries
      // creativity 0, so the term is identically 1 for it and its shape cannot change, and it still
      // moved +0.241 +/- 0.119 -- as far as any style the knob actually touches. Wing Play and La
      // Nuestra both carry +1 and went opposite ways, +0.165 and -0.155. Moving rest defence moves
      // the whole game through territory, so it cannot carry one axis.
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
    // SOLVE ONCE, rather than chasing the stages one at a time. Measured end to end, both sides on
    // the same style, mean distance off centre for ten outfielders:
    //                anchor  after duty  after rest  after leash  target  stood
    //   Wing Play +2  15.09    15.54       13.44       13.50      12.99   12.57
    //   Balanced   0  12.08    13.39       11.86       11.83      11.39   11.11
    //   Tiki-Taka -1   9.59    11.47       10.44       10.34      10.06    9.93
    // An anchor range of 5.50 m arrives as 2.64. There is no villain: the space search inflates the
    // narrow end (+1.88 against Wing Play's +0.45, because a compact side crowd-penalises its own
    // central candidates), rest defence pulls proportionally toward a block that is rightly narrower
    // than the attack, and the smoothing takes a flat slice. Each is doing its job. THE SUM is the
    // instruction, which is why widthStep, basePullW and the search radius each bought a fraction
    // and the balance table never moved -- three fractions of a thing that is being divided.
    // So the invariant is asserted instead of defended. Whatever the chain did, the component of the
    // target ALONG the deliberate part of the anchor is restored, and only along that axis: the
    // crowd search, the rest pull and the leash keep their full effect perpendicular to it. He still
    // avoids traffic and still works inside his zone -- he does it from the width and the height he
    // was told to hold, instead of trading them away first. A man the system never moved has dl ~ 0
    // and is untouched, so a side carrying no instructions cannot be shifted by this at all, which
    // is the control every previous attempt at this failed.
    if (attacking && p._anx !== undefined) {
      const dx = ax - p._anx, dy = ay - p._any, dl = Math.hypot(dx, dy);
      if (dl > 0.5) {
        const ux = dx / dl, uy = dy / dl;
        const got = (tx - p._anx) * ux + (ty - p._any) * uy;   // how much of the ask survived
        const add = Math.max(0, dl - got) * CFG.devRestore;    // never past it: add is clamped at 0
        tx += ux * add; ty += uy * add;
      }
    }
    // ...and a man with a box station goes to it, whatever the chain above decided. Placed HERE,
    // after the leash and the restore, because the station is nothing like his zone by design and
    // the leash exists precisely to stop targets like it -- the first cut sat before the leash and
    // measured 0.67 men in the box against 0.65 untouched. The support man keeps his short-option
    // job (the cutback needs somebody OUTSIDE the area to pull back to) and a man mid-burst
    // finishes his run. Clamped to the legal frontier: as near the goal as the more advanced of
    // the offside line and the ball, a shade behind it -- a striker holding his line. As defenders
    // drop, the frontier drops, and the box fills with them.
    const _lane = boxLane.get(i);
    if (_lane !== undefined && (p._runT ?? 0) <= 0
        && p._duty !== "support" && p._duty !== "press" && p._duty !== "cover" && p._duty !== "recover"
        && !(mp.side === side && mp.idx === i)) {
      const depth3 = _lane === 0 ? CFG.boxNear : _lane === 1 ? CFG.boxSpot : CFG.boxFar;
      const ballLow3 = mp._boxLow[side];
      ty = _lane === 0 ? ME_HALF_W + (ballLow3 ? -1 : 1) * (GOAL_HALF_W + 1.5)
         : _lane === 1 ? ME_HALF_W
         : ME_HALF_W + (ballLow3 ? 1 : -1) * (GOAL_HALF_W + 2.5);
      tx = meGoalX(side) - dir * depth3;
      const frontier = dir > 0 ? Math.max(off, mp.bx) : Math.min(off, mp.bx);
      if ((tx - frontier) * dir > -CFG.boxSlack) tx = frontier - dir * CFG.boxSlack;
      if (Math.hypot(p.x - tx, p.y - ty) > 3) p._closing = true;
    }
    // Offside holds everyone except a man running in behind, who is gambling on the timing.
    if (p._run !== "behind" && (tx - off) * dir > 0 && (tx - mp.bx) * dir > 0) tx = off - dir * 0.6;
    tx = Math.max(1.5, Math.min(PITCH_L - 1.5, tx));
    ty = Math.max(1.5, Math.min(PITCH_W - 1.5, ty));
    // REGROUP, and it is urgency rather than geometry. Everybody upfield of the ball in the seconds
    // after losing it is committed: _closing takes a man off the lazy ramp in match.ts -- which
    // otherwise pins him at 30% of his pace for the last four metres -- and off target smoothing
    // below. That is the difference between jogging back into the shape and sprinting into it, and
    // it is what the doubled block drop was trying and failing to buy. The men upfield of the ball
    // are the ones who were committed to the attack, so the instruction reaches exactly them, and
    // it costs the stamina of running rather than nothing.
    // GATED ON THE TARGET BEING BEHIND HIM, not on him being upfield of the ball. The first version
    // used the ball test and moved the axis the WRONG WAY -- fieldX 40.7 against a neutral 38.8 --
    // because _closing only makes a man reach his target sooner, and a side that loses it in the
    // final third has a block whose front slots are up there with it. So "urgency" bought a faster
    // arrival into an ADVANCED shape. Pointing it at men whose target is goal-side of where they
    // stand means it can only ever accelerate a retreat, which is the whole of what regrouping is.
    if (!attacking && (st.possLost || 0) < 0 && mp.possT < CFG.transT
        && (tx - p.x) * dir < 0 && p.pos !== "GK") p._closing = true;
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
