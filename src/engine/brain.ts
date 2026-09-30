// The pyramid: tactical brain, coordinators, off-ball positioning.
import { CFG, ME_DT, NO_INSTRUCTIONS } from "./config";
import { meHungarian } from "./assignment";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meCtrl, meDanger, meDir, meGoalX, meIntercept, meLaneBlock, meOffsideLine, meOther, mePressure, meSpaceGain, meThruCover, meTimeToBallMs, meVal, meValHere } from "./geometry";
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
  // TIMED OFF THE CARRIER. A run in behind is spent the moment it starts, and a man being
  // smothered cannot deliver it -- so nobody breaks while the ball is under runFreeP of press.
  // Runs already going keep going; this gates only the trigger.
  if (mePressure(s, side, mp.bx, mp.by) > CFG.runFreeP) {
    if (globalThis.__fire) globalThis.__fire.runHeld = (globalThis.__fire.runHeld || 0) + 1;
    return;
  }
  const carrier = us[mp.idx];
  // LEADERS RUN FIRST. runCap fixes how many break; this decides WHO, and it used to be shirt
  // order. Stable sort, so with every role at zero it is shirt order still and nothing moves.
  const order = us.map((_, i) => i);
  if (CFG.roleRunOrder) order.sort((a, b) => (us[b]._role || 0) - (us[a]._role || 0));
  for (const i of order) {
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
// WHERE THE OUTLET STANDS, as ONE number. meDuties picks the man nearest this point and meShape
// sends him to it, and until now each worked it out for itself -- 6 m behind the ball for the pick,
// 7 m behind for the destination. Harmless while both were behind; the moment a short-passing side
// wanted its outlet in FRONT, the side went on choosing the man nearest a spot behind the ball and
// then asking him to run eleven metres past it, which he never completed before the ball moved.
// That is why moving the destination alone measured as nothing at all. See CFG.suppBack.
export function meSuppX(s, side) {
  const mp = s.mePos, dir = meDir(side), st = s.strategy?.[side] || NO_INSTRUCTIONS;
  const x = mp.bx + dir * (-CFG.suppBack - Math.min(0, st.passingDir || 0) * CFG.suppDirStep);
  const off = meOffsideLine(s, side);
  return (x - off) * dir > 0 ? off : x;          // never offer from an offside spot
}

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
  // AT A DEAD BALL, POSSESSION IS THE RESTARTING SIDE -- not whoever touched it last. A corner is
  // conceded off a defender, so mp.side pointed at THEM through the whole ceremony: the attacking
  // side ran its defending branch, the box duty (which lives in the possession branch) was never
  // assigned, and the corner swung into a box its own side had not attacked -- while the actual
  // defenders ran possession duties and marked nobody. Same class of wrongness at every restart
  // won against the run of play.
  // AT A DEAD BALL, POSSESSION IS THE RESTARTING SIDE -- not whoever touched it last. A corner is
  // conceded off a defender, so mp.side pointed at THEM through the whole ceremony: the attacking
  // side ran its defending branch, the box duty (which lives in the possession branch) was never
  // assigned, and the corner swung into a box its own side had not attacked -- while the actual
  // defenders ran possession duties and marked nobody. Same class of wrongness at every restart
  // won against the run of play.
  const defending = mp.sp ? mp.sp.side !== side : mp.side !== side;
  const ballDepth = (mp.bx - own) * dir;
  for (const p of us) { p._wasPress = p._duty === "press"; p._wasCover = p._duty === "cover";
    // WHO HE HAD, keyed on the MAN and not the duty label -- screen and intercept carry _mk too,
    // and a single tick of either wiped the memory. Costs nothing: it is read only when he is
    // being given a mark anyway, and never removes him from the pool the ball-chasing duties draw
    // from. That distinction is the whole difference between this and the version below.
    p._mkPrev = p._mk >= 0 ? p._mk : -1;
    // MARKING IS A STANDING ASSIGNMENT, NOT A PER-TICK DERIVATION. This used to be `p._mk = -1`:
    // every defender forgot his man four times a second and the whole back line was re-dealt from
    // a re-sorted danger list, which is the entire "he went off to mark someone else" complaint.
    // The mark now persists and is RELEASED FOR CAUSE below -- his man leaves, gets the ball, goes
    // too far away, or he is beaten. Crucially the release list does NOT include "he was needed to
    // press": ball-chasing duties are still dealt first from everybody, so no body is reserved and
    // the tackle count is untouched, and his mark is waiting for him when the stint ends.
    // TRIED AND REVERTED (31 Aug 2026): a RECLAIM pass -- _mkPrev, a reclaim pass that re-took
    // your man before the ball-chasing duties were dealt, and a markStick discount in the
    // Hungarian. The diagnosis behind it is sound and measured: duties are rebuilt from nothing
    // every tick, and on 25.6% of marker-ticks a defender was marking somebody else a quarter of
    // a second later. But every tuning of it (stick 0.20/D20 and 0.65/D8) cost the same 0.57
    // goals a match (2.97 -> 3.54) and three to six tackles a side, because a man held onto his
    // mark is a man not contesting the ball -- and tenure came out no better than the 1.35 s it
    // started at. The trade is real: marking memory and ball contest pull against each other.
    // Whatever fixes this has to buy tenure without spending the ball. The reclaim spent it: a
    // man who has taken his mark back is not in free(), so press, cover and the hunt were a body
    // short all match -- tackles fell from 19.9 to 14.2 a side. The stick discount below is the
    // half that is free, and it is kept.
    if (p._beat > 0) p._beat--;
    p._duty = p.off ? "off" : p.pos === "GK" ? "gk" : "hold"; }
  // A man who has just been gone past cannot be the one who presses next -- that is what being
  // beaten MEANS, and without it a defender who dived in and lost simply closed again a quarter of
  // a second later, which is why standing on the man's toes was free.
  // THE OUTLET, exempted before any job is handed out. "outlet" is not "hold", so free() and every
  // press/mark/screen search below skip him without knowing he exists. See CFG.outletBack.
  if (defending && (st.possWon || 0) > 0 && (st.pressingLOE || 0) < 0) {
    let oi = -1, od = -Infinity;
    for (let i = 0; i < us.length; i++) { const p = us[i];
      if (p.off || p.pos === "GK") continue;
      const b = p._bd ?? p._bd0 ?? 0;
      if (b > od) { od = b; oi = i; } }
    if (oi >= 0) us[oi]._duty = "outlet";
  }
  // RELEASE FOR CAUSE. Anything that survives this is a mark he keeps.
  {
    const seen = new Map();
    for (let i2 = 0; i2 < us.length; i2++) {
      const p2 = us[i2];
      if (!p2 || p2.off || p2.pos === "GK") { if (p2) p2._mk = -1; continue; }
      const j2 = p2._mk;
      if (j2 == null || j2 < 0) { p2._mk = -1; continue; }
      const q2 = them[j2];
      const gone = !q2 || q2.off || q2.pos === "GK";
      const hasBall = mp.idx === j2 && mp.side === meOther(side);       // press him, do not shadow him
      const tooFar = !gone && Math.hypot(p2.x - q2.x, p2.y - q2.y) > CFG.markHoldD;
      // BEING BEATEN IS NOT A REASON TO FORGET HIM -- it is the reason to chase him. It was in
      // this list, so a defender who got skinned dropped the man who did it and was dealt a
      // stranger the moment he recovered. He keeps the mark; the beaten branch below changes his
      // JOB to recover or press, and free() already keeps him out of new assignments while he does
      // it, so the man is still his when he gets back.
      if (gone || hasBall || tooFar) { p2._mk = -1; continue; }
      // ...and one man each. If two ended up on the same opponent, the nearer keeps him.
      const prev = seen.get(j2);
      if (prev === undefined) { seen.set(j2, i2); continue; }
      const dPrev = Math.hypot(us[prev].x - q2.x, us[prev].y - q2.y);
      const dNow = Math.hypot(p2.x - q2.x, p2.y - q2.y);
      if (dNow < dPrev) { us[prev]._mk = -1; seen.set(j2, i2); } else p2._mk = -1;
    }
  }
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
    // ...EXCEPT A RICOCHET. A parry, a block, a poked tackle and a squirt off a shin all leave
    // mp.flight standing from the strike they interrupted, and none of them has a receiver -- so
    // the exclusion built for passes was eating exactly the balls this branch was written for.
    // Measured at the goal ledger: 26.6% of all goals were born within a second of one of those
    // events or trickled in with no strike at all, with the defence standing in shape watching,
    // because no duty ever pointed at the rebound. _loose is stamped at every one of those sites;
    // for loosePressWin after it the ball is live whatever the flight flag says, so the presser
    // and the box swarm below converge on the spill the way a defence actually does.
    // ...and a flight with NO intended receiver -- a punt, a clearance, a knock-down (fj -1) --
    // has neither of the things the exclusion was built around, and sails for two or three
    // seconds while ten men hold shape and one designated chaser runs. That reads from the stand
    // as a defence with no idea pressing exists whenever nobody has the ball. Receiverless
    // flights are live; a pass to a man keeps its exclusion.
    // THE MAN THROUGH ON GOAL IS CLAIMED BEFORE ANY OTHER JOB IS HANDED OUT. Every duty below --
    // press, cover, intercept, the recovery run -- picks the man nearest the BALL, and during a
    // break that is the same defender who should be going with the runner. Measured: on 20% of
    // assignments the nearest defender to the most dangerous attacker was already unavailable when
    // marking ran, three fifths of them taken by `cover` alone. The marking layer then did what it
    // was told with whoever was left, which from the stand is a defender turning his back on the
    // man clean through to go and stand near somebody harmless. Nothing downstream could fix this,
    // which is why three attempts at the ranking never touched it. Reserve first, then carry on:
    // at most markResN men, only for opponents nobody is covering, and only in our own half of the
    // move -- a striker "through" in his own third is not a chance and does not deserve a shadow.
    {
      let taken = 0;
      for (let j = 0; j < them.length && taken < CFG.markResN; j++) {
        const q = them[j];
        if (!q || q.off || q.pos === "GK") continue;
        if (mp.idx === j && mp.side === meOther(side)) continue;      // the carrier is pressed, not shadowed
        if ((q.x - own) * dir > CFG.markResDepth) continue;
        if (meThruCover(s, meOther(side), q)) continue;               // somebody already covers him
        let bi2 = -1, bd2 = Infinity;
        for (const i2 of free()) {
          const p2 = us[i2];
          if (p2.pos === "GK") continue;
          const d2 = Math.hypot(p2.x - q.x, p2.y - q.y);
          if (d2 < bd2) { bd2 = d2; bi2 = i2; }
        }
        if (bi2 >= 0) { us[bi2]._duty = "mark"; us[bi2]._mk = j; taken++;
          if (globalThis.__fire) globalThis.__fire.markReserve = (globalThis.__fire.markReserve || 0) + 1; }
      }
    }
    // (A live SHOT is not a receiverless flight to be pressed: nobody runs after it into his own net.)
    const ballLive = mp.idx >= 0 || (!mp.flight && !mp.sp)
      || (!mp.sp && mp.flight && mp.fj < 0 && !mp.shot)
      || (!mp.sp && mp.tick - (mp._loose ?? -99) < CFG.loosePressWin);
    if (ballLive) {
      // Inside the line of engagement a man travels a long way to the ball; outside it he goes only
      // if he is already close. Somebody is always tasked with it -- that is the difference between
      // a block and eleven men watching.
      const travel = ballDepth < loeM ? CFG.engageIn : CFG.engageOut;
      const [bi, bd] = nearest(mp.bx, mp.by, free());
      // ...and NOBODY presses a keeper with the ball in his hands. It cannot be won, so closing
      // him down is a man out of the shape for nothing -- and on screen it is a striker standing
      // over a keeper who is holding the ball, which is not a thing that happens.
      const heldGk = mp.held && s.players[mp.side]?.[mp.idx]?.pos === "GK";
      if (bd <= travel && !heldGk) {
        // Hysteresis: whoever was pressing keeps the job unless somebody is clearly better placed.
        const prev = us.findIndex(p => p._wasPress && p._duty === "hold" && p.pos !== "GK");
        const pd = prev >= 0 ? Math.hypot(us[prev].x - mp.bx, us[prev].y - mp.by) : Infinity;
        const use = (prev >= 0 && pd < bd * 1.45) ? prev : bi;
        // His reach is his legs: a spent man covers loeStamLo of a fresh man's engagement
        // distance, so the late-match press arrives late or not at all. See config.
        const _ud = use === prev ? pd : bd;
        const _stF = CFG.loeStamLo + (1 - CFG.loeStamLo) * ((us[use]?.stamina ?? 100) / 100);
        if (use >= 0 && _ud <= travel * _stF) us[use]._duty = "press";
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
    // ONE cover, goal-side of the ball. (Hysteresis tried here and removed: 0.95 -> 0.96 s of
    // marking tenure, which is noise.)
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
    // A MAN PAST THE LAST OF US OUTRANKS EVERYTHING. The first version of this keyed on the trap
    // line and was INERT: meTrap is dragged back by the deepest live threat -- the ball, its
    // forecast, the carrier -- so the moment a through ball was PLAYED the line collapsed to its
    // landing point and the runner was never goal-side of it. The marker was released exactly at
    // the pass, which is exactly when the abandonment was being watched. Through is not a
    // relationship with a line that follows you; it is having nobody left in front of you:
    // zero of our outfielders goal-side of the man. Trap-free, and true at the precise moment he
    // beats the last defender. Does not time out.
    // ...and "in front of you" is a race, not an x-comparison. The second version counted any
    // outfielder deeper than the man as cover, so a defender standing goal-side but two channels
    // wide -- a body that can never make the interception -- cancelled the through flag while the
    // runner ran on alone. meThruCover races every defender to the run itself.
    const thruOf = (q) => {
      const t = !meThruCover(s, meOther(side), q);
      if (globalThis.__fire && t) globalThis.__fire.thruSeen = (globalThis.__fire.thruSeen || 0) + 1;
      return t;
    };
    for (let j = 0; j < them.length; j++) { const q = them[j]; if (q.pos === "GK" || q.off) continue;
      if (j === mp.idx && mp.side === meOther(side)) continue;      // the man on the ball is pressed
      // An ACTIVE run is the most dangerous thing on the pitch regardless of where its owner
      // currently stands -- unmarked runners were arriving alone at the far post all match.
      const runBonus = (q._runT ?? 0) > 0 ? 0.8 : 0;
      threats.push([meDanger(meOther(side), q.x, q.y) + runBonus + (thruOf(q) ? CFG.markThruW : 0), j]); }
    threats.sort((a, b) => b[0] - a[0]);
    const runners = them.filter(q => ((q._runT ?? 0) > 0 || thruOf(q)) && q.pos !== "GK" && !q.off).length;
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
    // ...LESS WHATEVER THE SHAPE HAS SPENT. A side that has been dragged around loses track of
    // people; the man it stops picking up is the last one on the list, which is the late runner.
    // One tick stale by construction -- meBlock writes the debt after meDuties reads it -- and that
    // is fine, a defence's memory of who it was tracking is stale too.
    const _debt = mp.blk?.[side]?.debt ?? 0;
    // ...AND IT MOVES ONE MAN AT A TIME. This is a step function of ball depth (5 / 4 / 2 / 1) plus
    // a live runner count, recomputed from nothing four times a second -- and traced, it thrashed
    // 1-4-5-2-1 inside two seconds. Every collapse demotes men who were marking to screening a
    // lane, every rise hands the marks to DIFFERENT men, and because the threat list is re-sorted
    // by danger each tick the screeners are re-dealt a different opponent too. That churn is the
    // whole of "the defender went off to mark somebody else": nothing was pushing him, the budget
    // under him kept changing size. Slewed one man per tick, a defence asked to pick two more up
    // does it over half a second, and a ball crossing a depth boundary no longer re-deals the
    // entire back line.
    const nMarkRaw = Math.max(1, Math.round(((ballDepth < CFG.markSiegeDepth ? CFG.markSiege
                 : ballDepth < 34 ? 4 : ballDepth < 60 ? 2 : 1) + runners)
                 * (1 - _debt * CFG.debtMarkLoss)));
    const nPrev = mp._nMark?.[side];
    const nMark = nPrev === undefined ? nMarkRaw
                : nMarkRaw > nPrev ? nPrev + 1 : nMarkRaw < nPrev ? nPrev - 1 : nPrev;
    (mp._nMark = mp._nMark || {})[side] = nMark;
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
      // THE MEN WHO ALREADY HAVE SOMEBODY KEEP HIM, and they count against the budget. Only the
      // slots left over are dealt to new pairings, and only for opponents nobody is already on --
      // so a defence that is holding four men picks up a fifth rather than re-shuffling all four.
      let held = 0;
      const claimed = new Set();
      for (const p2 of us) {
        if (!p2 || p2.off || p2._mk < 0) continue;
        claimed.add(p2._mk);
        if (p2._duty === "hold" && !(p2._beat > 0)) { p2._duty = "mark"; held++; }
        else if (p2._duty === "mark") held++;
      }
      const avail = free();
      const pick = threats.filter(t => !claimed.has(t[1]))
                          .slice(0, Math.max(0, Math.min(nMark - held, avail.length)));
      const n = Math.max(avail.length, pick.length);
      if (pick.length && avail.length) {
        const topSc = Math.max(1e-6, pick[0][0]);      // threats are sorted, so pick[0] is the worst of them
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
            // ...AND THE MOST DANGEROUS MAN GETS THE NEAREST DEFENDER. The Hungarian minimises the
            // TOTAL cost, and this matrix said nothing about which attacker mattered: the danger
            // ranking chose who made the shortlist and then every man on it was worth exactly the
            // same. So the solver would hand the man through on goal a defender from forty metres
            // away whenever that shaved a few metres off somebody else's pairing -- which is the
            // defender who trots off to mark somebody harmless while the elephant runs through.
            // Two previous attempts at this bug fixed the RANKING (trap-keyed, then cover-count,
            // then the race in meThruCover) and never touched the assignment, which is why it
            // survived all three. Scaling each pairing by its threat's share of the top score
            // makes reaching the dangerous man dominate the sum: his marker is chosen first in
            // everything but name, and the harmless are covered with whoever is left.
            const prio = 1 + CFG.markPrio * Math.max(0, pick[b][0]) / topSc;
            // TRIED AND REMOVED: a markStick discount for the pairing he already had. Tenure was
            // 0.95 s with it and 0.95 s without -- the assignment is not where marks are decided.
            row[b] = (d + behind) * (d + behind) * prio;
          }
          cost.push(row);
        }
        const asg = meHungarian(cost, n);
        for (let a = 0; a < Math.min(avail.length, n); a++) {
          const b = asg[a];
          if (b >= 0 && b < pick.length) { us[avail[a]]._duty = "mark"; us[avail[a]]._mk = pick[b][1]; }
        }
        // Behaviour audit: for the MOST dangerous man, how far away is the marker he was actually
        // given, against the nearest defender who was available? A gap here is the elephant bug.
        if (globalThis.__mkgap) {
          const q0 = them[pick[0][1]];
          let got = Infinity, best = Infinity;
          for (let a = 0; a < Math.min(avail.length, n); a++) {
            const pA = us[avail[a]], dA = Math.hypot(pA.x - q0.x, pA.y - q0.y);
            if (dA < best) best = dA;
            if (asg[a] === 0) got = dA;
          }
          if (got < Infinity && best < Infinity) globalThis.__mkgap.push(+(got - best).toFixed(2));
          // ...and was the truly nearest man even AVAILABLE, or had press/cover/intercept taken
          // him before marking ran? Those duties are handed out first and they pick the man
          // nearest the ball, which during a break is often the last defender.
          if (globalThis.__mkbusy) {
            let bi2 = -1, bd2 = Infinity;
            for (let z = 0; z < us.length; z++) {
              const pz = us[z];
              if (!pz || pz.off || pz.pos === "GK") continue;
              const dz = Math.hypot(pz.x - q0.x, pz.y - q0.y);
              if (dz < bd2) { bd2 = dz; bi2 = z; }
            }
            if (bi2 >= 0) {
              globalThis.__mkbusy.n++;
              if (!avail.includes(bi2)) {
                globalThis.__mkbusy.busy++;
                const dz = us[bi2]._duty || "?";
                globalThis.__mkbusy[dz] = (globalThis.__mkbusy[dz] || 0) + 1;
              }
            }
          }
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
      // ...and if the man he was marking is still on the threat list and nobody has him, he
      // screens HIM. Same body, same job, no cost -- but he stops walking off to stand in a
      // stranger's lane, which is the mark:1 -> screen:4 the incident capture kept catching.
      // This list is re-sorted by danger every tick, so without it a screener is handed a
      // different opponent four times a second -- and when his side is defending his target is
      // his block slot pulled toward whoever _mk names, so the man under him changing identity
      // IS the defender turning and walking away. Nothing pushed him; his assignment moved.
      const kp = us[i]._mkPrev;
      if (kp >= 0 && threats.some(t => t[1] === kp) && !us.some(p => p._mk === kp)) {
        us[i]._duty = "screen"; us[i]._mk = kp; continue;
      }
      while (k < threats.length && us.some(p => p._mk === threats[k][1])) k++;
      if (k >= threats.length) break;
      us[i]._duty = "screen"; us[i]._mk = threats[k][1]; k++;
    }
    // THE TRACE: one line per tick, the whole back line's duty:man vector, plus how many marks the
    // budget allowed and how many men were free to take them. Four failed hypotheses in a row
    // (assignment cost, reserve, reclaim, cover hysteresis) means the shape of the churn has to be
    // read directly rather than reasoned about.
    if (globalThis.__trace && globalThis.__trace.side === side && globalThis.__trace.rows.length < 34) {
      const T = globalThis.__trace;
      if (mp.idx >= 0 && mp.side === meOther(side)) {
        T.rows.push(us.filter(q => !q.off && q.pos !== "GK").slice(0, 6)
          .map(q => (q._duty || "?").slice(0, 4) + (q._mk >= 0 ? ":" + q._mk : "")).join(" ")
          + "   | nMark " + nMark + " free " + free().length);
      }
    }
    // MARK CHURN: does a defender KEEP the man he had? _duty and _mk are rebuilt from scratch every
    // tick, so nothing makes yesterday's marker today's marker -- this counts how often a man who
    // was marking somebody is marking somebody ELSE a quarter of a second later, and what took him.
    if (globalThis.__churn) {
      const C = globalThis.__churn;
      for (let z = 0; z < us.length; z++) {
        const p2 = us[z];
        if (!p2 || p2.off || p2.pos === "GK") continue;
        const had = p2._mkWas, now = p2._mk >= 0 ? p2._mk : -1;
        // TENURE, not churn rate: how many consecutive ticks he holds ONE man. A rate is polluted
        // by how many markers there are; a tenure is not. 4 ticks = one second.
        if (now >= 0 && now === had) p2._mkRun = (p2._mkRun || 0) + 1;
        else {
          if (had !== undefined && had >= 0) {
            C.runs.push((p2._mkRun || 0) + 1);
            const tgt = them[had];
            if (tgt && !tgt.off && !us.some(z2 => z2 !== p2 && !z2.off
                && Math.hypot(z2.x - tgt.x, z2.y - tgt.y) < 6)) C.dropped++;   // nobody NEAR him
            if (now < 0) C[p2._duty || "?"] = (C[p2._duty || "?"] || 0) + 1;
          }
          p2._mkRun = 0;
        }
        // THE INCIDENT: he was TIGHT on a man in a dangerous area, and a quarter of a second later
        // he is doing something else and nobody is near that man. This is the thing being watched
        // from the stand, captured verbatim rather than inferred from a rate.
        if (had !== undefined && had >= 0 && now !== had && C.inc.length < 12) {
          const tgt = them[had];
          if (tgt && !tgt.off) {
            const wasTight = Math.hypot(p2.x - tgt.x, p2.y - tgt.y) < 4;
            const dangerous = (tgt.x - own) * dir > 62;
            let near = Infinity;
            for (const z2 of us) if (z2 !== p2 && !z2.off)
              near = Math.min(near, Math.hypot(z2.x - tgt.x, z2.y - tgt.y));
            if (wasTight && dangerous && near > 6) C.inc.push({
              def: p2.name, was: "mark:" + had, now: p2._duty + (p2._mk >= 0 ? ":" + p2._mk : ""),
              man: tgt.name, tightAt: +Math.hypot(p2.x - tgt.x, p2.y - tgt.y).toFixed(1),
              nowNearest: +near.toFixed(1), depth: +((tgt.x - own) * dir).toFixed(0) });
          }
        }
        p2._mkWas = now;
      }
    }
    // THE ELEPHANT TEST, measured after every duty is handed out: a man nobody is covering, in
    // our half, with the ball live -- does anybody have him? This is the question the complaint
    // actually asks, and neither of the earlier metrics answered it: one measured the assignment
    // among AVAILABLE men, and both went blind the moment a reserved marker stopped counting as
    // available. Here the only thing that matters is whether some defender's _mk points at him.
    if (globalThis.__eleph && mp.idx >= 0) {
      for (let j = 0; j < them.length; j++) {
        const q = them[j];
        if (!q || q.off || q.pos === "GK") continue;
        if (mp.idx === j && mp.side === meOther(side)) continue;
        if ((q.x - own) * dir > CFG.markResDepth) continue;
        if (meThruCover(s, meOther(side), q)) continue;
        globalThis.__eleph.n++;
        let md = Infinity;
        for (const p2 of us) if (p2._mk === j) md = Math.min(md, Math.hypot(p2.x - q.x, p2.y - q.y));
        if (md === Infinity) globalThis.__eleph.free++; else globalThis.__eleph.d.push(+md.toFixed(1));
      }
    }
  } else {
    // ATTACK THE BOX AT YOUR OWN CORNER. The de-choreography rightly deleted the placed marks,
    // but it deleted the team instruction with them: nobody's brain sent him into the box, the
    // strike-runs started from outside it, and corners went toothless. This is the instruction
    // rebuilt at the duty level -- the strongest aerial men are told to attack a ZONE of the box,
    // the live markers contest them, and where each pair ends up is the duke-out, not a script.
    if (mp.sp?.kind === "corner" && mp.sp.side === side) {
      const cands = free().filter(i2 => i2 !== mp.sp.ti)
        .sort((a2, b2) => meAttrs(us[b2]).strength - meAttrs(us[a2]).strength)
        .slice(0, CFG.cnBoxN);
      cands.forEach((i2, k2) => { us[i2]._duty = "box"; us[i2]._boxK = k2; });
    }
    // In possession. Hold the width, put one man in behind, give the ball a short option.
    for (const i of free()) {
      const p = us[i];
      // Probe: what job does a man who is CLEAN THROUGH actually hold? If he is holding width,
      // his target is his touchline slot and he will drift to the wing with an open goal in front
      // of him -- which is the complaint. Gated, so it costs nothing when unset.
      if (globalThis.__fire && (p.x - own) * dir > 62 && !meThruCover(s, side, p)) {
        const kf = "thru_" + (Math.abs(p._bw - ME_HALF_W) / ME_HALF_W > 0.40 ? "width"
                   : p._bd > 62 ? "runner" : "other");
        globalThis.__fire[kf] = (globalThis.__fire[kf] || 0) + 1;
      }
      if (Math.abs(p._bw - ME_HALF_W) / ME_HALF_W > 0.40) p._duty = "width";
      else if (p._bd > 62) p._duty = "runner";
    }
    // THE SHORT OPTION IS THE HUB'S JOB. Support went to whoever was nearest the ball, so a side's
    // best midfielder showed for it exactly as often as its worst -- which is why creation never
    // concentrated on anybody. The playmaker is worth pmkSupport metres of walking here, scaled by
    // how much of a hub he actually is: in a flat squad this barely moves, and in a side built
    // around one man he comes to get the ball nearly every time. Touches are what creation is
    // made of, so this is the half of the role that matters.
    let si = -1, sbest = Infinity;
    const suppX = meSuppX(s, side);
    for (const i of free()) {
      const q = us[i];
      const d = meTimeToBallMs(q, suppX, mp.by, meSpeed(meAttrs(q), q.stamina)) / 1000 * 7
              - (q._pmk || 0) * CFG.pmkSupport;
      if (d < sbest) { sbest = d; si = i; }
    }
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
    if (q.pos === "GK" || q.off) continue;
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
  // The ring the side actually passes in, not a fixed one. See CFG.orbitBand.
  const st = s.strategy?.[side] || NO_INSTRUCTIONS;
  const want = CFG.passWant + (st.passingDir || 0) * CFG.passWantStep;
  const lo = Math.max(CFG.orbitMin, want - CFG.orbitBand), hi = want + CFG.orbitBand;
  let v = d >= lo && d <= hi ? 1
        : Math.max(0, 1 - Math.min(Math.abs(d - lo), Math.abs(d - hi)) / 8);
  // ...and it is worth standing AHEAD of him. Behind is an out-ball, not an option.
  const back = Math.max(0, (c.x - cx) * meDir(side));
  return v * (1 - (1 - CFG.orbitBackLo) * Math.min(1, back / CFG.orbitBackSpan));
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
  // THE CHECK TO THE BALL. Sixteen ring spots and the anchor -- all within nine metres of the
  // slot -- so a man anchored twenty-five metres from play could not PROPOSE any spot the orbit
  // and lane terms would reward: availability lost by unreachability, which from the stand is a
  // player loitering. The eighteenth candidate is the point on the ball-to-anchor line at the
  // side's own preferred pass distance from the ball -- the show a footballer actually makes --
  // and it wins exactly when the scoring already says being available beats holding the slot.
  let ckx = baseX, cky = baseY;
  {
    const bdx = baseX - mp.bx, bdy = baseY - mp.by, bl = Math.hypot(bdx, bdy) || 1;
    const want = CFG.passWant + ((st.passingDir || 0) * CFG.passWantStep);
    ckx = mp.bx + bdx / bl * Math.min(bl, want); cky = mp.by + bdy / bl * Math.min(bl, want);
  }
  for (let k = 0; k <= 17; k++) {
    const ring = RING[k % 8], rad = k >= 8 ? ME_SPACE_R : ME_SPACE_R * CFG.spaceInner;
    const cx = k === 16 ? baseX : k === 17 ? ckx : baseX + ring[0] * rad;
    const cy = k === 16 ? baseY : k === 17 ? cky : baseY + ring[1] * rad;
    if (cx < 2 || cx > PITCH_L - 2 || cy < 2 || cy > PITCH_W - 2) continue;
    if ((cx - off) * dir > 0 && (cx - mp.bx) * dir > 0) continue;          // would be offside
    let crowd = 0;
    for (const q of s.players[side]) { if (q === p || q.pos === "GK" || q.off) continue;
      const d = Math.hypot(q.x - cx, q.y - cy); if (d < cr) crowd += (cr - d) / cr; }
    const sc = meCtrl(s, side, cx, cy) * 1.00                    // do we own it
             // ...and the HUB wants it more. A playmaker is the man who finds the pocket between
             // the lines, and this is the term that says a spot is worth standing in. Scaled by
             // how much of a hub he is, so a side without one is unchanged.
             + meDanger(side, cx, cy) * (1.30 + (p._pmk || 0) * CFG.pmkDanger)
             - meLaneBlock(s, side, mp.bx, mp.by, cx, cy)
               * 0.30 * (1 + Math.max(0, -(st.passingDir || 0)) * CFG.laneSeekShort) // can the ball reach me -- and a short-passing side lives on it, see laneSeekShort
             + meSpaceGain(s, side, cx, cy) * ME_SPACE_W          // would we newly own ground here
             - crowd * 0.55                                      // is somebody already there
             - mindK * Math.max(0, 1 - meOppDist(s, side, cx, cy) / 8) * CFG.oppAvoidW
             // The carrier orbit band: an ideal 12-21 m ring for a supporting man -- without it a
             // spot on the carrier's shoulder and one forty metres away scored identically.
             + (attackingRing(s, side, cx, cy)) * CFG.orbitW
             // The further out of shape you already are, the harder the base pulls you back.
             // ...and he is allowed off his slot to do it. Everyone else is held to the shape;
             // roaming to find the ball is most of what being a creative hub IS.
             - Math.hypot(cx - baseX, cy - baseY) * 0.010 * awayK * hold
               * (1 - (p._pmk || 0) * CFG.pmkRoam);
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
  // ...BUT NOT THE FLOOR. The bottom of the window moved with the instruction too, so a side told to
  // hold a high line never let its back four below twenty-two metres, even with the ball in its own
  // six-yard box. The ceiling is where a line is allowed to push up to; how deep it goes is the ball's
  // business, and with the ball at the goal every line in football is on the edge of the six-yard box.
  const lineShift = st.defLine * CFG.blkDefLine;
  const lineLo = CFG.lnFloor;
  const lineHi = Math.min(CFG.blkCeil, CFG.blkMax + lineShift);
  // THE HEIGHT OF THE LINE IS SET BY THE MAN ON THE BALL. It was fourteen metres behind the ball,
  // whoever had it and whatever he could do with it -- so the line stood exactly as high against a
  // centre-half being closed down on his own byline as against a playmaker turning free in the hole
  // with a runner on the shoulder. A line SQUEEZES when he cannot hurt it (pressed, or facing his own
  // goal, or the ball going backwards) and DROPS when he can (free, and facing ours), because the
  // space it is protecting is the space behind it and only a man with time and a view can use that.
  //   lnGapPress  metres behind the ball with him pressed or turned away     lnGapFree  free and facing us
  //   lnPressNear-Far  a defender this near him is full pressure / none      lnFwdV-BackV  pace toward / away
  //   lnFacing  how much of a threat a free man standing still is             lnGapLoose  a ball nobody has
  // A ball travelling our way that nobody has yet -- a pass forward, a long ball -- is defended where it
  // is GOING, the forecast lnLook slices on, which is what the line turning and running is.
  let bD = ballDepth, gap = CFG.blkDrop;          // our ball: rest defence, as ever
  const theirs = mp.sp ? mp.sp.side !== side : mp.side !== side;
  if (theirs) {
    if (mp.idx >= 0 && !mp.sp) {
      const c = them[mp.idx];
      let nd = Infinity;
      for (const q of us) if (q && !q.off && q.pos !== "GK") nd = Math.min(nd, Math.hypot(q.x - c.x, q.y - c.y));
      const pr = Math.max(0, Math.min(1, (CFG.lnPressFar - nd) / (CFG.lnPressFar - CFG.lnPressNear)));
      const tv = -((c.vx || 0) / ME_DT) * dir;                   // his pace toward our goal
      const fw = Math.max(0, Math.min(1, tv / CFG.lnFwdV)), bk = Math.max(0, Math.min(1, -tv / CFG.lnBackV));
      const threat = (1 - pr) * (CFG.lnFacing + (1 - CFG.lnFacing) * fw) * (1 - bk);
      gap = CFG.lnGapPress + (CFG.lnGapFree - CFG.lnGapPress) * threat;
    } else gap = CFG.lnGapLoose;
    if (mp.idx < 0 && mp.pred && !mp.sp) {
      const pd = mp.pred[CFG.lnLook];
      if (pd) bD = Math.min(bD, (pd[0] - own) * dir);
    }
  }
  const wantLine = Math.max(lineLo, Math.min(lineHi,
    bD - gap + st.defLine * CFG.blkDefLine + st.pressingLOE * CFG.blkLoe - drop + dlA));
  const wantCy = ME_HALF_W + (mp.by - ME_HALF_W) * CFG.blkSlide;
  // The block slides at running pace, because it is a body of men rather than a formula.
  // Compact defending your own box, long when you are camped in their half.
  let wantDepth = CFG.blkDepthLow
    + Math.max(0, Math.min(1, (ballDepth - 18) / 42)) * (CFG.blkDepth - CFG.blkDepthLow);
  // DEFENDING A CORNER PACKS THE AREA. The open-play block holds a fifteen-metre depth span with
  // its front slots screening lanes that do not exist at a corner -- measured, seven attackers in
  // the box against three defenders, with six men holding a midfield shape while the delivery
  // came in. Everybody comes back: the line on the six-yard box, the span inside the area. The
  // centre snaps to the goal too -- blkSlide would leave the pack hanging toward the corner flag.
  let wantLine2 = wantLine, wantCy2 = wantCy;
  if (mp.sp?.kind === "corner" && mp.sp.side !== side) {
    wantLine2 = 3.5; wantCy2 = ME_HALF_W; wantDepth = CFG.cnDefDepth;
  }
  const bs = (mp.blk[side] = mp.blk[side] || { line: wantLine2, cy: wantCy2, depth: wantDepth });
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
  const mv = (wantLine2 < bs.line ? CFG.blkSlewBack : CFG.blkSlew)
           * (1 - chased * CFG.chaseSlow) * ME_DT;
  bs.line += Math.max(-mv, Math.min(mv, wantLine2 - bs.line));
  bs.cy += Math.max(-mv, Math.min(mv, wantCy2 - bs.cy));
  // ...AND ITS DEPTH. Only the line was ever slew-limited. The depth was recomputed straight off the
  // ball every tick, and it swings seventeen metres between a low block and a high one -- so the
  // front band's slot, which sits a full depth ahead of the line, jumped at 0.4x the ball's own
  // speed. A pass at 20 m/s moved it at 8, which no footballer can follow. That is why every band
  // sat eight to twelve metres behind its slot no matter how hard they were allowed to run, and no
  // amount of effort was ever going to fix it: they were chasing something that teleported.
  bs.depth += Math.max(-mv, Math.min(mv, wantDepth - bs.depth));
  // THE DEBT. Charged for being moved about and for having men out of the shape; repaid the moment
  // the side has the ball back or play stops. See CFG.debtMove.
  {
    const drag = Math.abs(wantLine - bs.line) + Math.abs(wantCy - bs.cy);
    let chasers = 0;
    for (const q of us) if (q && !q.off && (q._duty === "press" || q._duty === "recover" || q._duty === "cover")) chasers++;
    const live = mp.side !== side && mp.side !== null && !mp.sp;
    bs.debt = Math.max(0, Math.min(1, (bs.debt ?? 0) + (live
      ? (drag * CFG.debtMove + chasers * CFG.debtChase) * ME_DT
      : -CFG.debtRest * ME_DT)));
  }
  const line = bs.line, cy = bs.cy, depth = bs.depth;
  // How besieged we are, read off the SLEWED line for the same reason.
  const siege = Math.max(0, Math.min(1, 1 - (line + CFG.blkDrop) / CFG.siegeDepth));

  const idx = [];
  // The outlet is not in the block -- that is the whole trade. The nine that remain re-space.
  // Nor is a man who is off: a sent-off defender kept his slot, the row never closed round the hole,
  // and the zonal pick below could hand him an attacker he would never move to mark.
  for (let i = 0; i < us.length; i++) if (us[i].pos !== "GK" && us[i]._duty !== "outlet" && !us[i].off) idx.push(i);
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
  // IN THE LINE ARE THE MEN WHO ARE IN IT. A man pressing, covering, recovering or following a runner is
  // not at his slot, and the row used to be spaced for him anyway: his slot sat empty and his neighbours
  // stood where they would have stood beside him -- the hole nobody fills. The row is spaced across the
  // men who are actually holding it, so when one steps out the others slide across.
  const free = (p) => p._duty !== "press" && p._duty !== "cover" && p._duty !== "recover";
  for (let b = 0; b < 3; b++) {
    const rowi = bands[b].filter(i => free(us[i]) && !us[i]._btrk);
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
    // A BLOCK THAT HAS BEEN CHASED STRETCHES, and it stretches from the front. chaseSlow -- lagging
    // the whole block's recovery -- was tried and zeroed: it emptied the box and moved shots the
    // wrong way, because the back line lagged with everything else. Scaling DEPTH by the chase
    // leaves the back band exactly where it stands (frac 0) and draws the middle and front bands
    // up and apart, hunting the ball they cannot get back -- which opens the pocket between the
    // lines that a patient side's extra passes are supposed to buy. The back line never moves, so
    // the box stays manned and the chance this concedes is the 12-18 m pocket shot, not the tap-in.
    const bx = own + dir * (line + depth * (1 + chased * CFG.chaseStretch) * frac);
    // A BAND IS AS WIDE AS THE MEN IN IT. Held at a flat width, a back FOUR stood ten metres apart
    // and a back THREE stood fifteen -- so the fewer defenders a formation had, the bigger the holes
    // it left, which is exactly backwards. A real back three defends narrow and lets the wing backs
    // cover the width; that is the whole idea of the shape. Spacing is what is constant, not span.
    // ...AND A TIRED SHAPE STANDS FURTHER APART. This is the pocket a worked possession is meant
    // to open, and it is why the payoff had to be keyed on work rather than on the clock.
    const spacing = (CFG.blkSpacing + b * CFG.blkSpaceStep) * (1 + (bs.debt ?? 0) * CFG.debtGap);
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
  // ---- WHO HAS WHOM ------------------------------------------------------------------------------
  // A ZONE THAT REMEMBERS, AND A RUNNER WHO IS FOLLOWED. Marks used to be dealt from nothing four times
  // a second: every one wiped, the attackers sorted by danger, each handed the nearest free slot within
  // eight metres. Two things fell out of that, and they are the two complaints. A defender was dealt a
  // different man whenever the danger order shuffled -- the switch -- and a striker who ran in behind
  // left every slot's eight metres and was dealt to NOBODY: the man clean through with his marker gone
  // to stand near somebody else.
  // Now a mark is kept until there is a reason to let it go. Every man in the back two bands owns a strip
  // of the width, halfway to his neighbour on each side, and whoever comes into his strip at his band's
  // depth is his. His man leaving the strip -- lnHandM past the edge, so a man on the seam is not passed
  // back and forth -- is dropped, and the neighbour whose strip he went into picks him up. A man RUNNING
  // IN BEHIND is not handed on: whoever has him goes with him (tracking), out of the strip and off the
  // line, and the line closes the gap he left. A man behind the line, or running in behind, with nobody
  // on him is dealt first, before any strip, to the nearest defender not already following somebody --
  // whatever that defender was doing -- because nothing on a football pitch is more dangerous.
  const defending2 = mp.sp ? mp.sp.side !== side : mp.side !== side;
  if (!defending2) {
    for (const p of us) { p._bmk = -1; p._btrk = false; p._mk = -1; p._trk = false; }
    return;
  }
  const depthOf = (q) => (q.x - own) * dir;
  const L = line, midL = line + depth * (0.5 - siege * CFG.blkMidDrop);
  for (let b = 0; b < 3; b++) for (const i of bands[b]) us[i]._band = b;
  // The strips, among the men actually standing in each band.
  for (const b of [0, 1]) {
    const row = bands[b].filter(i => free(us[i]) && !us[i]._btrk).sort((x, y) => us[x]._bsy - us[y]._bsy);
    for (let k = 0; k < row.length; k++) {
      const p = us[row[k]];
      p._zlo = k === 0 ? -1e9 : (us[row[k - 1]]._bsy + p._bsy) / 2;
      p._zhi = k === row.length - 1 ? 1e9 : (p._bsy + us[row[k + 1]]._bsy) / 2;
    }
  }
  // Running in behind: on a run at the line, or coming at it quicker than lnTrackV near it. Behind the
  // line: deeper than it, and not merely standing offside while his side still has the ball.
  const ballD0 = (mp.bx - own) * dir, held = mp.idx >= 0 && mp.side !== side;
  const runner = (q) => ((q._runT ?? 0) > 0 && (q._run === "behind" || q._run === "wall" || q._run === "third"))
    || (-((q.vx || 0) / ME_DT) * dir > CFG.lnTrackV && depthOf(q) < L + CFG.lnTrackAhead);
  const behind = (q) => depthOf(q) < L - CFG.lnBehindM && (!held || depthOf(q) >= ballD0 - 0.5);
  // Which band's depth a man is at -- with lnBandM of slack for a man somebody already has, because the
  // boundary moves with the line and a man standing near it flickered from one band to the other.
  const inBand = (b, d, m = 0) => b === 0 ? d < L + CFG.lnZoneFront + m
                                : d >= L + CFG.lnZoneFront - m && d < midL + CFG.lnZoneFront + m;
  const taken = new Map();                                  // attacker -> defender
  // 1. KEEP WHAT IS STILL HIS.
  for (const i of idx) {
    const p = us[i];
    p._trk = false;
    const j = p._bmk ?? -1;
    if (j < 0) continue;
    const q = them[j];
    const R = globalThis.__mkwhy;
    // ...and a man sent to press or to cover has NOT given his man up. He was dropping him the moment
    // the job came -- and the job changes hands every few slices, so a marker called out to the ball for
    // a second came back to a stranger. His claim waits for him; somebody else covers his man meanwhile,
    // and when he comes back the nearer of the two keeps him.
    if (!free(p)) continue;
    if (!q || q.off || q.pos === "GK" || (held && mp.idx === j) || (p._band ?? 2) > 1) {
      if (R) { const w = held && mp.idx === j ? "his man got the ball" : "other"; R[w] = (R[w] || 0) + 1; }
      p._bmk = -1; continue; }
    const dq = Math.hypot(p.x - q.x, p.y - q.y), qd = depthOf(q);
    if (dq < CFG.lnTrackHold && (runner(q) || behind(q) || (p._btrk && qd < L + CFG.lnTrackRelease))) p._trk = true;
    else {
      const inStrip = q.y > (p._zlo ?? -1e9) - CFG.lnHandM && q.y < (p._zhi ?? 1e9) + CFG.lnHandM;
      if (!(inStrip && inBand(p._band, qd, CFG.lnBandM) && dq < CFG.markHoldD)) {
        if (R) { const w = !inStrip ? "left his strip" : !inBand(p._band, qd, CFG.lnBandM) ? "left his band's depth" : "too far"; R[w] = (R[w] || 0) + 1; }
        p._bmk = -1; continue; }
    }
    const o = taken.get(j);
    if (o !== undefined) {                                 // two on one: the nearer keeps him
      const po = us[o];
      if (Math.hypot(po.x - q.x, po.y - q.y) <= dq) { p._bmk = -1; p._trk = false; continue; }
      po._bmk = -1; po._trk = false;
    }
    taken.set(j, i);
  }
  const threats = [];
  for (let j = 0; j < them.length; j++) {
    const q = them[j];
    if (!q || q.off || q.pos === "GK" || (held && mp.idx === j) || taken.has(j)) continue;
    threats.push([meDanger(meOther(side), q.x, q.y) + (runner(q) ? CFG.lnRunW : 0) + (behind(q) ? CFG.lnBehindW : 0), j]);
  }
  threats.sort((a, b) => b[0] - a[0]);
  // 2. THROUGH, OR GOING THROUGH, AND NOBODY WITH HIM: the nearest man in the back two bands who is not
  // already following somebody, goal-side men first. He gives up whoever he had; this one is worse.
  for (const [, j] of threats) {
    const q = them[j];
    if (!(behind(q) || runner(q))) continue;
    let bi = -1, bd2 = Infinity;
    for (const i of idx) {
      const p = us[i];
      if (!free(p) || p._trk || (p._band ?? 2) > 1) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y) + ((p.x - q.x) * dir > 0 ? CFG.lnWrongSide : 0);
      if (d < bd2) { bd2 = d; bi = i; }
    }
    if (bi < 0 || bd2 > CFG.lnTrackHold) continue;
    const p = us[bi];
    if (p._bmk >= 0) { taken.delete(p._bmk); if (globalThis.__mkwhy) globalThis.__mkwhy["taken off him for a runner"] = (globalThis.__mkwhy["taken off him for a runner"] || 0) + 1; }
    p._bmk = j; p._trk = true; taken.set(j, bi);
  }
  // 3. THE STRIPS. Whoever is in mine at my band's depth is mine if I am free; if I am not, the nearest
  // free man in my band takes him if he is near enough to be doing it.
  for (const [, j] of threats) {
    if (taken.has(j)) continue;
    const q = them[j], qd = depthOf(q);
    const b = inBand(0, qd) ? 0 : inBand(1, qd) ? 1 : -1;
    if (b < 0) continue;
    let owner = -1, bi = -1, bd2 = Infinity;
    for (const i of idx) {
      const p = us[i];
      if (p._band !== b || !free(p) || p._trk || p._btrk) continue;
      if (q.y >= (p._zlo ?? -1e9) && q.y < (p._zhi ?? 1e9)) owner = i;
      const d = Math.hypot(p._bsx - q.x, p._bsy - q.y);
      if (p._bmk < 0 && d < bd2) { bd2 = d; bi = i; }
    }
    const pick = owner >= 0 && us[owner]._bmk < 0 ? owner : (bd2 <= CFG.blkZone ? bi : -1);
    if (pick < 0) continue;
    us[pick]._bmk = j; taken.set(j, pick);
  }
  for (const p of us) { p._mk = free(p) ? (p._bmk ?? -1) : -1; p._btrk = !!p._trk; }
}

// WHICH WAY HE TAKES IT. The eight directions a man on the ball can carry it, scored on what the
// ground is worth with the bodies there, the lines, and -- when he is through -- the goal. The
// dribble re-picks it every carryCommit slices; the FIRST TOUCH asks it once, as the ball arrives,
// so that a man takes the ball the way he is about to run with it. `prevA` is the line he is on, which
// it costs turnW per radian to leave (carryTurn unless the caller says otherwise).
export function meCarryPick(s, side, p, prevA, turnW) {
  const mp = s.mePos, dir = meDir(side), own = meGoalX(meOther(side));
  const off = CFG.carrierOffside ? meOffsideLine(s, side) : 0;
  // A CLEAR RUN AT GOAL BENDS THE CARRY AT THE GOAL. The eight directions below are scored
  // on meValHere minus pressure, and the arithmetic of that pair is why a man clean through
  // never ran at the net: the value surface gains about 0.083 (at carryVal) for the goalward
  // step from twenty metres out, and the keeper standing in it is worth up to 0.075 of
  // pressure -- the one body left on the pitch cancelled the entire reason to go there, and
  // any loose body near the goalward ray beat it from further out. So the search literally
  // steered AWAY from the keeper, which from the stand is a man declining an open goal.
  // Same corridor test as decide.ts runAtGoal, priced per metre of ground gained on the goal
  // mouth so it dominates the flat surface only when he is actually through.
  const gx2 = meGoalX(side);
  let atGoal = 0;
  // ...AND IT USES THE SAME TEST AS decide.ts, WHICH IS WHAT THE COMMENT ABOVE PROMISES.
  // It was left on the old headcount -- any opponent goal-side within 20 m of his channel
  // cancelled it, including one who could never get across -- while runAtGoal moved to the
  // race in meThruCover. So the two disagreed: the shooting logic knew he was through and
  // the STEERING did not, which drops the goalward term and hands the eight-way search back
  // to the value surface. The value surface pays for empty grass, and on a pitch with the
  // defence beaten the empty grass is the wing. That is the man clean through drifting to
  // the touchline instead of running at the net.
  if (meLaneBlock(s, side, p.x, p.y, gx2, ME_HALF_W) < CFG.noBackLane) {
    if (!meThruCover(s, side, p) || Math.abs(gx2 - p.x) < CFG.noBackRange) atGoal = 1;
  }
  if (globalThis.__fire && atGoal) globalThis.__fire.carryAtGoal = (globalThis.__fire.carryAtGoal || 0) + 1;
  const gd0 = atGoal ? Math.hypot(gx2 - p.x, ME_HALF_W - p.y) : 0;
  let bAng = null, bSc = -Infinity;
  for (let k = 0; k < 8; k++) {
    const ang = k * Math.PI / 4;
    const cx = p.x + Math.cos(ang) * CFG.carryLook, cy = p.y + Math.sin(ang) * CFG.carryLook;
    if (CFG.carrierOffside && (cx - off) * dir > 0.4) continue;
    // Where he takes it is worth what it is worth WITH the bodies there, and a footballer
    // does not turn on a sixpence: holding your line is cheaper than reversing it.
    let sc2 = meValHere(s, side, cx, cy) * CFG.carryVal - mePressure(s, side, cx, cy) * CFG.carryAvoid;
    if (atGoal) sc2 += (gd0 - Math.hypot(gx2 - cx, ME_HALF_W - cy)) * CFG.carryGoalW;
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
    if (prevA != null) sc2 -= Math.abs(Math.atan2(Math.sin(ang - prevA), Math.cos(ang - prevA))) * (turnW ?? CFG.carryTurn);
    if (sc2 > bSc) { bSc = sc2; bAng = ang; }
  }
  return bAng;
}

// ---- shape ------------------------------------------------------------------------------
// The zonal skeleton, then the job on top of it. Nobody's position is implicit any more: every
// outfielder is doing exactly one thing the coordinator told him to do.
export function meShape(s, side) {
  const st = s.strategy?.[side] || NO_INSTRUCTIONS, ps = s.players[side], mp = s.mePos;
  const dir = meDir(side), own = meGoalX(meOther(side));
  const ballDepth = (mp.bx - own) * dir;
  // AT A DEAD BALL, POSSESSION IS THE RESTARTING SIDE. Same law as meDuties (see `defending`
  // there) and the same bug: a corner is conceded off a touch that can leave mp.side pointing at
  // EITHER team, so the side about to take it ran the defending branch of this function -- every
  // man took a block slot on the halfway line and hit the `continue` below, hundreds of lines
  // before the corner station. Measured: 27% of corners were delivered into a box of fewer than
  // three, every one of them a referee timeout with five men holding box duty they were never
  // given a station for. Fixing meDuties alone was not enough; the duty is assigned here.
  const attacking = mp.sp ? mp.sp.side === side : mp.side === side;
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
    p._closing = false; p._track = false; p._gkGo = false;
    if (p.pos === "GK" && !(mp.held && mp.side === side && mp.idx === i)) p._holdX = null;
    // ...unless he has the ball, in which case he is a footballer like everybody else. The keeper
    // branch used to return before the carrier logic was ever reached, so a keeper in possession ran
    // back to his line and left the ball where it was: traced, four metres away and still climbing.
    if (p.pos === "GK" && !(mp.side === side && mp.idx === i)) {
      // Making a save: it owns him until it is over (keeper.ts, meMove).
      const gp2 = mp.shot?.gk ?? mp.gkPlan;
      if (gp2 && gp2.side === side && gp2.i === i) { p._closing = true; p._gkWhy = gp2 === mp.gkPlan ? "save(ball)" : "save(shot)"; continue; }
      // ---- THE KEEPER WHEN HE IS NOT MAKING A SAVE ------------------------------------------------
      // Penalties keep the read (keeper.ts): he goes where he guessed, holding his depth.
      if (mp.idx < 0 && !mp.sp && mp.shot && mp.shot.side !== side && mp.shot.readY !== undefined) {
        const sx4 = mp.bx, sy4 = mp.by;
        const f4 = Math.max(0, Math.min(1, (p.x - sx4) / ((own - sx4) || 1e-6)));
        const cy4 = sy4 + (mp.shot.readY - sy4) * f4;
        p._tx = p.x;
        p._ty = Math.max(1.5, Math.min(PITCH_W - 1.5, cy4));
        p._closing = true;
        continue;
      }
      const gkk = meGkSkill(meAttrs(p));
      const ballD = Math.hypot(mp.bx - own, mp.by - ME_HALF_W);
      // HIS STYLE: how commanding he is -- how readily he comes for a cross, how high he sweeps, how far
      // he comes in a one-on-one. It comes from how good he is and how his side plays: a high line and a
      // high press want a keeper behind them, a side that sits deep wants him at home. 0 is a keeper who
      // lives on his line, 1 one who owns his area and the ground behind his defence.
      const stT = Math.max(-1, Math.min(1, ((st.defLine || 0) + 0.5 * (st.pressingLOE || 0)) / 2.5));
      const cmd = Math.max(0, Math.min(1, 0.5 + (gkk - 0.5) * CFG.gkStyleSkill + stT * CFG.gkStyleTeam));
      const inArea = (x, y) => (x - own) * dir < CFG.gkAreaD && Math.abs(y - ME_HALF_W) < CFG.boxHalfW;
      // HIS READ OF A RACE. A keeper does not have the forecast; he judges who will get there first, and
      // how well is his rating. The error is fixed for the life of a ball (keyed on its last touch), so
      // he does not change his mind four times a second, and it is up to gkJudgeMs for the worst keeper.
      const judge = (salt) => {
        let h = (Math.imul(salt | 0, 2654435761) ^ Math.imul(i + 7, 40503)) >>> 0;
        h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
        return ((h >>> 8) / 16777216 * 2 - 1) * (1 - gkk) * CFG.gkJudgeMs;
      };
      // 0. A BALL OF OURS RUNNING INTO OUR NET, beyond the man it belongs to (match.ts, _ownIn), is his.
      if (mp._ownIn === side) {
        const ic0 = meIntercept(p, mp, meSpeed(meAttrs(p), p.stamina) * CFG.gkRushV, undefined, CFG.gkLag);
        p._tx = ic0.x; p._ty = ic0.y; p._closing = true; p._gkGo = true; p._gkWhy = "own ball in";
        continue;
      }
      if (mp.idx < 0 && !mp.sp) {
        // 1. COMING FOR IT, and only when it is his. The old rule let him lose the race and go anyway --
        // a flat 260 ms of licence inside his area, "because he can pick it up" -- and once gone he went
        // on to 21 m, which is the keeper running out for a cross the striker heads over him and the
        // through ball he meets a stride after the man who rounds him. He now goes when he believes he
        // gets there FIRST by gkClaimEdge (a ball he may handle, in his area), gkBoxEdge (in his area
        // with only his feet) or gkRushEdge (outside it, and then only if the man who would win it is
        // through); never when one of his own defenders has it comfortably covered (gkLeaveMs); and he
        // gives it up if it has plainly gone against him while his line is still close behind him.
        //
        // ...AND THE RACE IS FOR THE BALL, not for his spot. Everybody else was timed to where HE would
        // meet it, as if the striker had to wait for it there, so a striker running a stride from a
        // through ball -- certain to take it long before the keeper's spot -- lost the race on paper,
        // and the keeper set off from twenty metres for a ball that was then shot past him. Traced, that
        // and the cross he ran nine metres out for (a volley met at the penalty spot first) were half the
        // goals he gave away. Each man's time is now his own first touch: the number the chaser is
        // picked by (the possession currency in match.ts), computed this tick, receiver's lag and all.
        const vmaxG = meSpeed(meAttrs(p), p.stamina) * CFG.gkRushV;
        // A BALL LOOSE IN HIS AREA HE HAS BEEN WATCHING ALL ALONG, the way a man a pass is played to has
        // (rcvLag): charged the full reaction a defender reading somebody else's pass is given, a parry
        // he had just made, rolling 1.8 m from him, came out at 1.75 s to reach -- slower than a striker
        // five metres away -- and he walked back to his angle while it was put in.
        const lagG = inArea(mp.bx, mp.by) ? CFG.gkLag : 1;
        const ic = meIntercept(p, mp, vmaxG, undefined, lagG);
        const icIn = inArea(ic.x, ic.y);
        const outAt = Math.hypot(ic.x - own, ic.y - ME_HALF_W);
        // ...and he credits every one of them with watching it, as the man it was played to does. A
        // striker running under a floated ball, half a metre from it, was charged a defender's reading
        // time and came out a second and a quarter from a ball he headed down a slice later, so the
        // keeper left his line for it.
        let theirs = Infinity, qNear = null, ours = Infinity;
        for (const q of them) if (q.pos !== "GK" && !q.off) {
          const tq = Math.min(q._ttbMs ?? Infinity, meIntercept(q, mp, meSpeed(meAttrs(q), q.stamina), undefined, CFG.rcvLag).ms);
          if (tq < theirs) { theirs = tq; qNear = q; }
        }
        for (const q of ps) if (q !== p && q.pos !== "GK" && !q.off) ours = Math.min(ours, q._ttbMs ?? Infinity);
        const hands = icIn && mp.bpass !== side;
        // The commanding keeper needs less of an edge, and comes further for a ball he can take in his
        // hands; the one who lives on his line only comes for what drops near his goal.
        let edge = (hands ? CFG.gkClaimEdge : icIn ? CFG.gkBoxEdge : CFG.gkRushEdge) * (1.6 - 1.2 * cmd);
        // A BALL IN THE AIR HE WINS CLEARLY OR NOT AT ALL. The forecast steps a quarter of a second, and a
        // high ball drops through a whole step at a time, so a race "won" by 30 ms was a tie decided by
        // rounding -- the keeper leaving his line for a ball the striker waiting under it headed first.
        if (mp.bz > CFG.gkAirZ || (mp.pred && mp.pred.some(k => k[2] > CFG.gkHigh)))
          edge = Math.max(edge, CFG.gkAirEdge * (1.6 - 1.2 * cmd));
        const claimOK = !hands || (ic.x - own) * dir < CFG.gkClaimD0 + cmd * CFG.gkClaimDA;
        const lg = mp.tlog && mp.tlog.length ? mp.tlog[mp.tlog.length - 1].t : 0;
        const lead = theirs - ic.ms + judge(lg * 31);
        // A ball he can take in his hands in his six-yard box is his whoever else is near: a parry rolling
        // across the face of goal was left to a centre-half chasing it from behind, and the keeper walked
        // back to his angle while the striker coming the other way scored.
        const six = (ic.x - own) * dir < CFG.gkSixD && Math.abs(ic.y - ME_HALF_W) < CFG.gkSixW;
        const covered = !(hands && six) && ours + CFG.gkLeaveMs < Math.min(ic.ms, theirs);
        const sweepOK = icIn || (qNear && !meThruCover(s, meOther(side), qNear));
        const go = lead > edge && !covered && sweepOK && claimOK && outAt < CFG.gkRushR;
        // HE GOES TO MEET THE MAN when the man will get there first but only just, close to him and on the
        // floor: a ball loose in front of goal with a striker arriving. Walking back to his angle from two
        // metres away, traced, gave the striker the whole goal to aim at; arriving as he shoots, the keeper
        // is the thing the shot has to go through.
        const mzI = qNear && qNear._icx !== undefined && mp.pred
          ? mp.pred[Math.min(mp.pred.length - 1, Math.round((qNear._icMs ?? 0) / (ME_DT * 1000)))] : null;
        const meetOK = !!mzI && theirs < ic.ms && inArea(qNear._icx, qNear._icy)
          && Math.hypot(qNear._icx - p.x, qNear._icy - p.y) < CFG.gkMeetR
          && meTimeToBallMs(p, qNear._icx, qNear._icy, vmaxG, lagG) < theirs + CFG.gkMeetMs;
        const lost = !meetOK && lead < -CFG.gkAbortMs && Math.hypot(p.x - own, p.y - ME_HALF_W) < CFG.gkAbortOut;
        if (globalThis.__gkd && go && !(p._gkOut > 0)) globalThis.__gkd.push({ in: icIn ? 1 : 0, hands: hands ? 1 : 0, lead: Math.round(lead), out: +outAt.toFixed(1), t: mp.tick, i, side });
        // Harness-only: the whole race as the keeper saw it, every slice (gkwhy.mjs).
        if (globalThis.__gkr) globalThis.__gkr[side] = { t: mp.tick, ic: [+ic.x.toFixed(1), +ic.y.toFixed(1)], me: Math.round(ic.ms),
          th: Math.round(theirs), us: Math.round(ours), lead: Math.round(lead), edge: Math.round(edge), go, lost, meet: meetOK,
          cov: covered, hands, icIn };
        if (go || (p._gkOut > 0 && outAt < CFG.gkMaxOut && !lost)) {
          p._gkOut = go ? CFG.gkRushHold : p._gkOut - 1;
          // Committed and beaten to it, he goes at the man where he takes it, to spread himself there --
          // not on to the spot the ball would have reached if nobody had touched it.
          const meet = !go && qNear && theirs < ic.ms && qNear._icx !== undefined
            && Math.hypot(qNear._icx - own, qNear._icy - ME_HALF_W) < CFG.gkMaxOut;
          p._tx = meet ? qNear._icx : ic.x; p._ty = meet ? qNear._icy : ic.y;
          p._closing = true; p._gkGo = true; p._gkWhy = go ? "rush" : "rush(committed)";
          continue;
        }
        p._gkOut = 0;
        if (meetOK && mzI[2] < CFG.gkMeetZ) {
          p._tx = qNear._icx; p._ty = qNear._icy; p._closing = true; p._gkGo = true; p._gkWhy = "block";
          continue;
        }
        const pr = mp.pred;
        if (mp.flight && pr) {
          // 2. A HIGH BALL INTO HIS AREA THAT IS NOT HIS: he stays on his line and sets for the header, a
          // step across toward where it will be met -- not stranded at whatever depth the ball's old
          // position gave him, which is where he was when the cross came over.
          let my = null;
          for (let k = 1; k < pr.length; k++) {
            const pk = pr[k];
            if (pk[2] > 0.8 && pk[2] < CFG.gkHigh + 0.5 && inArea(pk[0], pk[1])) { my = pk[1]; break; }
          }
          if (my !== null) {
            p._tx = own + dir * CFG.gkCrossOut;
            p._ty = ME_HALF_W + Math.max(-CFG.gkCrossSpan, Math.min(CFG.gkCrossSpan, (my - ME_HALF_W) * CFG.gkCrossTrack));
            p._closing = true; p._gkWhy = "cross stance";
            continue;
          }
          // ...and one that will cross his line out of his reach: get across to where it crosses.
          let cy = null, tIn = 0;
          for (let k = 1; k < pr.length; k++) {
            if ((pr[k][0] - own) * dir <= 0 && (pr[k - 1][0] - own) * dir > 0) {
              const f = (pr[k - 1][0] - own) / (pr[k - 1][0] - pr[k][0] || 1);
              cy = pr[k - 1][1] + (pr[k][1] - pr[k - 1][1]) * f;
              tIn = (k - 1 + f) * ME_DT * 1000;
              break;
            }
          }
          // ...and only one nobody else will touch first. A pass rolling toward the goal from fifteen
          // metres, to a man who was going to take it long before it got there, sent him across his
          // line to where it would have gone in, and the man it was meant for shot into the side he left.
          let firstOut = Infinity;
          for (const sd2 of ME_SIDES) for (const q of s.players[sd2]) if (!q.off && q.pos !== "GK") firstOut = Math.min(firstOut, q._ttbMs ?? Infinity);
          if (tIn >= firstOut) cy = null;
          // Only one crossing INSIDE the frame. A pass running out past the post sent him to stand on the
          // post -- two metres outside it, traced -- while the man it was played to shot across him.
          if (cy !== null && Math.abs(cy - ME_HALF_W) < GOAL_HALF_W + CFG.gkWideM) {
            p._tx = own + dir * CFG.gkLineOut;
            p._ty = ME_HALF_W + Math.max(-GOAL_HALF_W - 0.8, Math.min(GOAL_HALF_W + 0.8, cy - ME_HALF_W));
            p._closing = true; p._gkWhy = "back to line";   // committed: no lazy gate, no target smoothing
            continue;
          }
        }
      } else p._gkOut = 0;
      const carrier2 = mp.idx >= 0 && mp.side === meOther(side) ? s.players[mp.side][mp.idx] : null;
      // 3. A MAN WITH THE BALL IN HIS AREA. He pounces on a heavy touch -- the moment the ball is beyond
      // the carrier's reach his hands beat anybody's feet to it, and whether he sees that is judgement.
      if (carrier2 && ballD < CFG.gkBoxR) {
        const bg = Math.hypot(carrier2.x - mp.bx, carrier2.y - mp.by);
        const gb = Math.hypot(p.x - mp.bx, p.y - mp.by);
        if (bg > CFG.reach * CFG.playReach * CFG.gkPounceGap
            && gb < bg * (CFG.gkPounceLo + CFG.gkPounceMind * meMind(p)) * (0.8 + 0.4 * cmd)) {
          p._tx = mp.bx; p._ty = mp.by; p._closing = true; p._gkGo = true; p._gkWhy = "pounce";
          continue;
        }
      }
      // 4. ONE ON ONE. A man through on goal with it -- nobody of ours can get across -- is met: the keeper
      // comes out along his angle to make the goal small and sets himself gk1v1Keep in front of him, no
      // further than gk1v1Max off his line, and he does not back off again while it lasts. Anybody else
      // carrying it at him, with defenders round him, gets the keeper standing gkStand in front of him
      // on his angle, no further out than gkOutShot: coming out to a man who can still pass is how a
      // keeper is left in no man's land.
      if (carrier2 && ballD < CFG.gk1v1From) {
        const thru = !meThruCover(s, meOther(side), carrier2);
        if (thru || ballD < CFG.gkBoxR) {
          const cap = thru ? CFG.gk1v1Max * (0.5 + cmd) : CFG.gkOutShot;
          const [mx3, my3] = meGkAngle(p, own, mp.bx, mp.by);
          // CLOSE IN, HE CLOSES. His spot was a fixed gk1v1Keep (gkStand) in front of the man, so with the
          // man inside that distance of goal the spot was BEHIND the goal line: the keeper sat on his line
          // while a striker dribbled in from six metres and picked his corner from three. He comes at most
          // half the way from the man to the line along his angle -- no nearer the man than gkCloseStand,
          // no nearer the line than gkOutMin -- which is the smother at close range and unchanged far out.
          const toLine = Math.abs(mx3) > 1e-3 ? Math.abs((own - mp.bx) / mx3) : ballD;
          const stand = Math.max(Math.min(CFG.gkCloseStand, toLine - CFG.gkOutMin),
                                 Math.min(thru ? CFG.gk1v1Keep : CFG.gkStand, toLine * 0.5));
          let tx3 = mp.bx + mx3 * stand, ty3 = mp.by + my3 * stand;
          let out3 = Math.hypot(tx3 - own, ty3 - ME_HALF_W);
          if (thru) out3 = Math.max(out3, Math.min(cap, p._gk1 ?? 0));        // no backing off mid-duel
          const f3 = Math.min(cap, Math.max(CFG.gkOutMin, out3)) / Math.max(0.01, Math.hypot(tx3 - own, ty3 - ME_HALF_W));
          tx3 = own + (tx3 - own) * f3; ty3 = ME_HALF_W + (ty3 - ME_HALF_W) * f3;
          p._gk1 = thru ? Math.hypot(tx3 - own, ty3 - ME_HALF_W) : 0;
          p._tx = tx3; p._ty = ty3;
          p._closing = true; p._gkWhy = thru ? "1v1" : "carrier in box";
          continue;
        }
      }
      p._gk1 = 0;
      // WHERE THE NEXT SHOT COMES FROM. With the ball on its way to one of theirs he sets himself for
      // where that man will take it, not for where the ball happens to be: a keeper moves while the
      // pass travels. Placed off the ball, he was a pass behind all the way across the box.
      let bx2 = mp.bx, by2 = mp.by;
      if (mp.idx < 0 && !mp.sp) {
        let tq = null, tt = Infinity, to = Infinity;
        for (const q of them) if (!q.off && q.pos !== "GK" && (q._ttbMs ?? Infinity) < tt) { tt = q._ttbMs; tq = q; }
        for (const q of ps) if (!q.off) to = Math.min(to, q._ttbMs ?? Infinity);
        // ...as much as it is about to happen: a pass a second from its man still has him set for the
        // ball, and he comes round onto the receiver as it arrives. Set for a touch predicted a second
        // ahead, he stood outside his post for a man who took it early and shot across him.
        if (tq && tt < to && tq._icx !== undefined) {
          const w = Math.max(0, Math.min(1, 1 - (tt - CFG.gkRefMs0) / CFG.gkRefMs1));
          bx2 += (tq._icx - bx2) * w; by2 += (tq._icy - by2) * w;
        }
      }
      const vx2 = bx2 - own, vy2 = by2 - ME_HALF_W, vd = Math.hypot(vx2, vy2) || 1;
      // 5. THE BALL OUT WIDE IN THE LAST THIRD: the crossing stance. He used to be placed as if it were
      // about to be SHOT from out there -- a depth that grew with the ball's distance -- so a winger
      // thirty metres out on the touchline had him three or four metres off his line when the cross came
      // over. A keeper facing a cross stands gkCrossOut off his line, on his angle for the near post but
      // no nearer it than gkCrossNear from the middle, where he can still come for the ball.
      if (vd < CFG.gkCrossFrom && Math.abs(by2 - ME_HALF_W) > CFG.gkWideY) {
        const [mx5, my5] = meGkAngle(p, own, bx2, by2);
        const sg5 = vx2 >= 0 ? 1 : -1;
        const st5 = Math.abs(mx5) > 1e-3 ? (own + sg5 * CFG.gkCrossOut - bx2) / mx5 : -1;
        const ry5 = st5 > 0 ? by2 + st5 * my5 : ME_HALF_W;
        p._tx = own + dir * CFG.gkCrossOut;
        p._ty = ME_HALF_W + Math.max(-CFG.gkCrossNear, Math.min(CFG.gkCrossNear, ry5 - ME_HALF_W));
        p._gkWhy = "wide stance";
        continue;
      }
      // 6. EVERYWHERE ELSE: on his angle, at a depth for where the ball is. In shooting range he stays
      // near his line -- inside gkShotZone gkOutMin + gkOutK a metre, never past gkOutShot, because a
      // keeper who has to WATCH a shot is beaten over his head if he is far out. Further away he sweeps
      // behind his own back line: gkSweepFrac of its height, up to gkSweepMax, reached over gkSweepBlend
      // metres beyond the shooting zone. A high line gets a keeper behind it; a deep block keeps him home.
      const lineH = mp.blk?.[side]?.line ?? 20;
      const sweepMax = CFG.gkSweepMax * (0.6 + 0.6 * cmd);
      const sweep = Math.max(CFG.gkOutShot, Math.min(sweepMax, lineH * CFG.gkSweepFrac * (0.6 + 0.8 * cmd)));
      const near2 = vd < CFG.gkShotZone;
      const base2 = near2 ? CFG.gkOutMin + vd * CFG.gkOutK
                  : CFG.gkOutShot + (sweep - CFG.gkOutShot) * Math.min(1, (vd - CFG.gkShotZone) / CFG.gkSweepBlend);
      const out2 = Math.max(CFG.gkOutMin,
                   Math.min(near2 ? CFG.gkOutShot : sweepMax, (base2 + st.dlBehavior * 1.2)
                     * (1 + (gkk - 0.5) * CFG.gkOutSkill)));
      // HIS ANGLE IS THE BISECTOR OF THE TWO POSTS, not the line to the middle of his goal
      // (goalie_default.cpp:41-269). For a ball in front of the goal the two are the same line; for
      // a ball out wide they are not, and the whole of the difference is the near post. ...and against
      // a goal that is wider the worse he is (gkPanic): a keeper with poor positioning behaves as though
      // he has more frame to cover, which drags him toward the middle and concedes the near post.
      const [mx2, my2] = meGkAngle(p, own, bx2, by2);
      const sgn2 = vx2 >= 0 ? 1 : -1;
      // Walk down the bisector from the ball until he is out2 metres off his line. If the ball is
      // level with the goal the bisector runs parallel to it and there is no such point, so the old
      // radial rule stands in -- which is also the case where the two rules agree anyway.
      const step2 = Math.abs(mx2) > 1e-3 ? (own + sgn2 * out2 - bx2) / mx2 : -1;
      p._tx = own + vx2 / vd * out2;
      const rawY = step2 > 0 ? by2 + step2 * my2 : ME_HALF_W + vy2 / vd * out2;
      // Near his line he is never outside his post by more than gkPostOut; further out the angle may
      // take him wider, up to gkSide, as the cone from the ball widens with his depth.
      const sideLim = Math.min(CFG.gkSide, GOAL_HALF_W + CFG.gkPostOut + Math.max(0, out2 - CFG.gkOutShot) * CFG.gkSideK);
      p._ty = ME_HALF_W + Math.max(-sideLim, Math.min(sideLim, rawY - ME_HALF_W));
      p._gkWhy = "angle";
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
      // ANYBODY IN THE LANE MAY GO FOR IT, not just the man marking the receiver. This was gated
      // on p._mk === mp.fj, so a defender standing in the ball's path -- nearer to it, quicker to
      // it, and marking nobody in particular -- watched the pass go by because the interception
      // was somebody else's job. That is most of why receiving looked unopposed. Any defender who
      // beats the receiver to the point by cutEdge now commits, capped at cutMaxN a side so the
      // shape is never emptied into one lane.
      const rcv = mp.flight && mp.fj >= 0 && mp.fside === meOther(side) ? them[mp.fj] : null;
      const cutN = rcv ? ps.reduce((a, z) => a + ((z._cut ?? 0) > 0 ? 1 : 0), 0) : 0;
      if (rcv && (p._mk === mp.fj || cutN < CFG.cutMaxN)) {
        const ic = meIntercept(p, mp, meSpeed(meAttrs(p), p.stamina));
        // Both men measured the same way: how long each takes to GET THERE. meIntercept floors his
        // answer at the ball's own arrival time, so a defender who would be standing on the spot
        // waiting scored as arriving exactly when the ball did -- which is also when the receiver
        // does. Read that way the gate could only ever pass when the receiver was nowhere near the
        // point, so the only front-runs it allowed were the ones there was no need to make.
        const mine = meTimeToBallMs(p, ic.x, ic.y, meSpeed(meAttrs(p), p.stamina));
        const his = meTimeToBallMs(rcv, ic.x, ic.y, meSpeed(meAttrs(rcv), rcv.stamina));
        // A MAN WHO IS NOT MARKING HIM HAS TO BE CLEARLY QUICKER TO IT. At the marker's own edge
        // every defender in the lane jumped every pass and completion fell five points league-wide
        // (78.2 -> 72.7) with goals at 2.22 -- an interception is a read, not a right of way. The
        // marker keeps the ordinary edge; anyone else needs cutEdgeOther on top.
        const edgeC = (p._mk === mp.fj ? 0 : CFG.cutEdgeOther) + CFG.cutEdge;
        if (mine + edgeC < his) {
          p._cut = CFG.cutHold; p._cutx = ic.x; p._cuty = ic.y;
          p._tx = ic.x; p._ty = ic.y; p._closing = true; continue;
        }
      }
    }
    // Defending, the BLOCK owns where you stand. Press and cover are the only two jobs that leave
    // it. Nothing else applies -- no trap compression, no leash back to a formation slot, no
    // screening rule -- because those were all separate attempts to recover a shape the block just
    // has. A man who has picked somebody up moves at his own pace rather than easing into a mark.
    if (!attacking && p._duty === "outlet") {
      // Stood on their last line, waiting for the out-ball. `off` is the opponent's second-last
      // defender -- the exact line his side's attackers must respect -- so against a high line he
      // holds at halfway with the whole pitch behind it, which is the punishment a high line has
      // never had to price. Written straight to the target the way the block branch writes its
      // slot: this is a standing order, not a graded choice.
      p._tx = Math.max(1.5, Math.min(PITCH_L - 1.5, off - dir * CFG.outletBack));
      p._ty = Math.max(1.5, Math.min(PITCH_W - 1.5, ME_HALF_W + ((p._bw0 ?? ME_HALF_W) - ME_HALF_W) * CFG.outletWide));
      continue;
    }
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
        if (p._trk) {
          // GOING WITH HIM. Goal-side of where he is going, tight, and nothing holds him to the line or
          // his strip: the line closes the gap he has left (meBlock) and he stays with his man.
          const lx = mk2.x + (mk2.vx || 0) / ME_DT * CFG.trkLead, ly = mk2.y + (mk2.vy || 0) / ME_DT * CFG.trkLead;
          const vx = own - lx, vy = ME_HALF_W - ly, L = Math.hypot(vx, vy) || 1;
          tx2 = lx + vx / L * CFG.trkGoalSide; ty2 = ly + vy / L * CFG.trkGoalSide;
          p._track = true; p._closing = true;
        } else {
          // HIS MAN IN HIS STRIP: across to him, goal-side -- and at the LINE'S depth. The mark used to
          // pull him sixty per cent of the way to a point beside his man in both directions, so every
          // back four was as level as its opponents' forward line, which is not level at all. He
          // leaves the line's depth only to stay goal-side of a man who is deeper than it; a midfielder
          // may also step up lnMidStep toward a man in front of him to shut the ball into him.
          const vx = own - mk2.x, vy = ME_HALF_W - mk2.y, L = Math.hypot(vx, vy) || 1;
          const gsx = mk2.x + vx / L * CFG.markGoalSide, gsy = mk2.y + vy / L * CFG.markGoalSide;
          ty2 += (gsy - ty2) * CFG.lnMarkY;
          const up = (gsx - tx2) * dir;
          if (up < 0) tx2 = gsx;
          else if ((p._band ?? 0) >= 1) tx2 += dir * Math.min(CFG.lnMidStep, up);
        }
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
        if (gap > CFG.jockeyR) {
          // HE CLOSES GOAL-SIDE TOO. The approach aimed at the ball's current position, and
          // against a carrier moving at goal that point is always his tail -- the defender
          // arrived into a chase he could never win, and the goal-side logic below only existed
          // once he was already there. The closing run bends toward the point between the ball
          // and his own goal, further ahead the further out he starts, which is the curved
          // recovery run every real defender makes. A man already goal-side finds the target
          // beside himself and simply jockeys backward with the carrier.
          const gx3 = own - mp.bx, gy3 = ME_HALF_W - mp.by, gl3 = Math.hypot(gx3, gy3) || 1;
          const cut = Math.min(CFG.pressCutMax, gap * CFG.pressCut);
          tx = mp.bx + gx3 / gl3 * cut; ty = mp.by + gy3 / gl3 * cut; p._closing = true;
        }
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
          // A STATUE GETS TACKLED. The jockey stand is right against a live dribbler; against a
          // carrier who has simply stopped with nothing on it froze whole matches -- the presser
          // stood at jockeyStand for the rest of the afternoon while a beaten side's centre-back
          // held the ball in his own corner and the possession clock ran to 95%. mp.hold counts
          // his slices over the ball: once he has camped past pressTakeHold the presser walks
          // through the jockey point onto the ball itself and the ordinary challenge code wins it.
          if (mp.idx >= 0 && (mp.hold || 0) > CFG.pressTakeHold
              && Math.hypot(mp.bvx, mp.bvy) < CFG.deadBallV) { tx = mp.bx; ty = mp.by; }
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
        // A RESTART IS NOT OPEN PLAY. With the live brains running against a dead ball the marking
        // is as tight at a halfway-line throw as it is in the six-yard box, so a side taking a
        // routine throw-in or free kick had no free man anywhere and the restart became a
        // fifty-fifty. Away from his own area a marker stands spMarkOff metres further off his
        // man; near his own goal nothing changes, because that is where tight marking belongs.
        const spSlack = (mp.sp && mp.sp.kind !== "corner"
          && Math.hypot(mp.bx - own, mp.by - ME_HALF_W) > CFG.spMarkNear) ? CFG.spMarkOff : 0;
        const thresh = (isCarrier ? CFG.shootThreshCarrier : CFG.shootThreshOther) - spSlack;
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
      // NOTE (31 Aug 2026): `mark`, `screen` and `intercept` in this switch are DEAD when the side
      // is defending -- the block branch above returns first for every duty except press, cover and
      // recover. Instrumented: the screen/intercept geometry executed 0 times in eight matches, so
      // a stand-off clamp added here measured byte-identical. The live defending geometry, and the
      // marking clamp, are in that block branch. Kept because they run for rest defence.
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
      // "box" is not handled here ON PURPOSE -- see the corner station below the leash. A target
      // that deliberately abandons the zone cannot be set before the thing whose whole job is to
      // drag targets back into it.
      case "support": {                                         // short option for the ball
        // Behind the ball for a direct side, in front of it for a short-passing one. See suppBack.
        const [sx, sy] = meBrainPos(s, side, p, i, meSuppX(s, side), mp.by + (ay > mp.by ? 8 : -8), off);
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
    // ...or whose man has nobody left in front of him. Keyed on the trap it was inert -- the
    // trap follows the deepest threat, so a genuinely through man was never goal-side of it (see
    // thruOf in meDuties, the other half of the same fix). The marker may stand as deep as the
    // chase requires; compressing him up onto the line is how the runner ends up alone.
    const _mkq = p._duty === "mark" && p._mk >= 0 ? them[p._mk] : null;
    let _mkThru = false;
    if (_mkq && (_mkq._runT ?? 0) <= 0) {
      // The race test, excluding the marker himself: whether HIS MAN is through if he lets go.
      _mkThru = !meThruCover(s, meOther(side), _mkq, p);
    }
    const tracking = !!_mkq && ((_mkq._runT ?? 0) > 0 || _mkThru);
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
    // A KEEPER WITH IT IN HIS HANDS STANDS, facing the pitch, and takes a step or two up to throw. He was
    // steered like a dribbler, along the way he happened to be moving when he took it -- usually back
    // toward his own goal after a save -- and with two seconds to hold it he walked it over his own line.
    if (mp.side === side && mp.idx === i && mp.held && p.pos === "GK") {
      p._holdX ??= (p.x - own) * dir;                      // from where he took it, not from each step
      p._tx = own + dir * Math.max(CFG.gkHoldStep, Math.min(CFG.gkAreaD - 1.5, p._holdX + CFG.gkHoldStep));
      p._ty = p.y; p._drbA = dir > 0 ? 0 : Math.PI; p._drbWant = p._drbA;
      continue;
    }
    if (mp.side === side && mp.idx === i) {
      // A dribble is a committed movement, not an argmax re-solved four times a second.
      if ((p._drbT ?? 0) > 0) p._drbT--;
      else {
        const bAng = meCarryPick(s, side, p, p._drbA);
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
      // ...WHICH WAS TRUE WHILE THE BALL WAS STEERED BY A FORCE. It is now TOUCHED (touch.ts): he plays
      // it on when it comes back to his feet, and what he needs from his running is to arrive there,
      // a boot's length behind it on the line he is taking it -- so that is where he is aimed. A
      // target beyond the ball made him run through it every slice and lean on the body shove to put
      // it back in front of him.
      // Behind it along the way it is ROLLING, not along the line he wants: a ball going off his line
      // is chased from behind, not run alongside.
      let ca = p._drbA ?? (dir > 0 ? 0 : Math.PI);
      if (Math.hypot(mp.bvx, mp.bvy) > 0.5) ca = Math.atan2(mp.bvy, mp.bvx);
      p._tx = mp.bx - Math.cos(ca) * CFG.dribBehindD;
      p._ty = mp.by - Math.sin(ca) * CFG.dribBehindD;
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
    if (attacking && (p._runT ?? 0) <= 0 && p._bsx !== undefined && p._duty !== "box") {
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
    // ...and the CORNER station, for the same reason and in the same slot. Set inside the duty
    // switch it read exactly like the first cut of boxLane above: 3.80 men took the duty and 2.37
    // reached the area, because the leash is built to refuse targets that abandon the zone and a
    // corner station abandons it by design. 26% of corners were still delivered into an empty box.
    // Zones are corner-side aware: near post, back stick, penalty spot, far post, edge for the
    // knock-down. No offside from a corner, so the frontier clamp above is not wanted here.
    if (p._duty === "box" && mp.sp?.kind === "corner") {
      const nearB = mp.sp.y < ME_HALF_W ? -1 : 1;
      const ZB = [[5.5, 5.0], [6.0, -5.5], [10.5, 1.0], [11.5, -7.0], [16.5, 2.5]];
      const zb = ZB[(p._boxK ?? 0) % ZB.length];
      tx = meGoalX(side) - dir * zb[0];
      ty = ME_HALF_W + nearB * zb[1];
      p._closing = true;
    }
    // SHOWING FOR IT IS A MOVEMENT MADE BEFORE THE PASS, NOT AFTER. Tried and rejected first:
    // yanking the intended receiver toward the ball at the moment of the strike. It measured as a
    // real improvement in isolation -- a pressed man came 1.05 m to meet it against 0.39 -- and
    // cost five points of league completion and a third of all goals (3.12 -> 2.16), because it
    // takes him off a point he was certain to reach, onto one he may not, and walks him INTO the
    // defender who is pressing him. A man cannot check to a ball that has already been played.
    // So it lives here instead, in the off-ball shape: with his side in possession and somebody
    // on his shoulder, his target drifts showStep metres toward the ball for as long as the
    // pressure lasts. He is already moving when the pass comes, which is the whole of it.
    if (attacking && !(mp.side === side && mp.idx === i) && p.pos !== "GK"
        && (p._runT ?? 0) <= 0 && p._duty !== "press" && p._duty !== "cover") {
      const bdS = Math.hypot(p.x - mp.bx, p.y - mp.by);
      if (bdS > CFG.showMinD && bdS < CFG.showMaxD && meOppDist(s, meOther(side), p.x, p.y) < CFG.showPressR) {
        const sx2 = mp.bx - tx, sy2 = mp.by - ty, sl2 = Math.hypot(sx2, sy2) || 1;
        const st2 = Math.min(CFG.showStep, sl2 * 0.5);
        tx += sx2 / sl2 * st2; ty += sy2 / sl2 * st2;
        if (globalThis.__fire) globalThis.__fire.showFor = (globalThis.__fire.showFor || 0) + 1;
      }
    }
    // A MAN CLEAN THROUGH RUNS AT THE GOAL, NOT AT HIS LANE. Measured: on 20% of the slices where
    // an attacker in the final third had nobody covering him, he was holding WIDTH duty -- his
    // target the touchline slot his formation gives him -- so he drifted to the wing with an open
    // goal in front of him. The carry search already bends the man ON the ball at the net; this is
    // the same law for the man running ONTO it. Placed here, after the leash and the restore, for
    // the reason the corner station is: a target that abandons the zone by design cannot be set
    // before the thing whose whole job is to drag targets back into it. He keeps a share of his
    // own width (thruRunKeep) so he arcs in like a footballer instead of snapping to the centre.
    if (attacking && p.pos !== "GK" && !(mp.side === side && mp.idx === i)
        && (p.x - own) * dir > CFG.thruRunDepth && !meThruCover(s, side, p)) {
      const gxT = meGoalX(side);
      tx = gxT - dir * CFG.thruRunStop;
      ty = ME_HALF_W + (p.y - ME_HALF_W) * CFG.thruRunKeep;
      p._closing = true;
      if (globalThis.__fire) globalThis.__fire.thruRun = (globalThis.__fire.thruRun || 0) + 1;
    }
    // A re-instructed man's own line and width, before the law: his defLine pushes his target
    // up or drops it, his width stretches him off the shape's lane. On-ball behaviour reads his
    // overlay in meDecide; these two are the overlay's body.
    if (p._ci) {
      if (p._ci.defLine) tx += dir * p._ci.defLine * 3;
      if (p._ci.width) ty = ME_HALF_W + (ty - ME_HALF_W) * (1 + p._ci.width * 0.18);
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
  // A KEEPER WITH IT IN HIS HANDS IS LEFT ALONE. Nobody may take it off him, so a man standing over him
  // is doing nothing but staying out of his own shape -- a striker loitering on a keeper who is waiting
  // to throw it, which is not a thing that happens. Every opponent is held gkRespectR away from him.
  const hk = mp.held && mp.idx >= 0 && mp.side !== side ? s.players[mp.side][mp.idx] : null;
  if (hk && hk.pos === "GK") for (const p of ps) {
    if (!p || p.off || p.pos === "GK" || p._tx === undefined) continue;
    const dx = p._tx - hk.x, dy = p._ty - hk.y, d = Math.hypot(dx, dy);
    if (d >= CFG.gkRespectR) continue;
    if (d < 0.1) { p._tx = hk.x + (hk.x < PITCH_L / 2 ? 1 : -1) * CFG.gkRespectR; continue; }
    p._tx = Math.max(1.5, Math.min(PITCH_L - 1.5, hk.x + dx / d * CFG.gkRespectR));
    p._ty = Math.max(1.5, Math.min(PITCH_W - 1.5, hk.y + dy / d * CFG.gkRespectR));
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
