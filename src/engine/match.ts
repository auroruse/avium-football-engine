// The tick loop, the ball, restarts, and match setup.
import { CFG } from "./config";
import { meAerial, meAttrs, meBadgeFx, meDefLow, meDuel, meFinish, meGkDiveV, meGkLow, meGkReact, meGkSkill, meMind, meOvr, mePassBadge, meSpeed, meTech } from "./attributes";
import { mePlanOf, meStrategyOf, ME_STYLE_DEF, ME_STYLE_NAME } from "./tactics";
import { meChaseStyle, meSetStyle, meShapeFor, meTenMenStyle } from "./manager";
import { ME_DEF_FORM, formAtkW, pitchSlots, sposFor } from "./formations";
import { meHungarian } from "./assignment";
import { BALL_SUB, GOAL_HALF_W, GOAL_H, meBallPredict, meBallRun, meBallSlice, meKickBall, meKnock, meShootBall } from "./ball";
import { meDribbleTouch, meFirstTouch, meTouchTech } from "./touch";
import { meGkAt, meIntoGoal, mePlanSave, mePlanSaveBall, meReplanSave } from "./keeper";
import { meBlock, meCarryPick, meDuties, meOppDist, meRuns, meShape, meSlots, meTactical } from "./brain";
import { meSPBegin, meSPFetch, meSPReady, meSPShape, meSPTake } from "./setpiece";
import { meXgCal, meDecide, meShotP, meShotSit, meWindUp } from "./decide";
import { MT, mindChoose, mindDead, mindDuel, mindFirstTime, mindInit, mindOnPass, mindSense, mindSetPiece, mindTick, mindTouchAngle } from "./mind";
import { ME_HALF_W, ME_MAP_STRIDE, ME_SIDES, PITCH_L, PITCH_W, meBuildMaps, meClosest, meCtrl, meDanger, meDir, meGoalX, meIntercept, meKeeper, meKeeperIx, meLaneBlock, meOffsideLine, meOther, mePressure, meRun01, meShotGeom, meThruCover, meTimeToBallMs } from "./geometry";

// ==================== POSITIONAL MATCH ENGINE =============================================
// Twenty-two players on a 105x68 pitch, advanced in quarter-second slices. No team rating appears
// anywhere below this line. A chance exists because somebody found space and a pass reached him; a
// goal exists because a finisher beat a keeper. Instructions bias what a player ATTEMPTS and never
// what succeeds, so every setting costs something somewhere -- turn the press up and the space
// behind it is really there for someone to run into. That is the whole reason for the rewrite.
export { ME_HZ, ME_DT, ME_TPM } from "./config";
import { STYLE_PRESET, ME_CHASE, ME_CHASE_W, ME_DEAD_SCALE, ME_DT, ME_FIT, ME_HOME_ADV, ME_MGR, ME_MIND_PRICE, ME_STYLE_PRICE, ME_RED_SAID, ME_SIM_MIN, ME_STRAT_RANGE, ME_TPM, meDrill, meMinute, mePickInjury } from "./config";

// ---- setup ------------------------------------------------------------------------------
// Positions live ON the player records, not in a side table, so cloneState already deep-copies them
// and stepping a live match backwards keeps working with no extra plumbing.
/** `slotsFor(formation)` returns 11 `[x, y]` slots in 0..100 space, y=100 on your own goal line.
 *  Injected rather than imported so the engine has no dependency on the app at all. */

// THE SAME TWO TEAMS DO NOT PLAY THE SAME MATCH TWICE. `rng` is OPTIONAL and everything it drives
// is opt-in: 167 harnesses call meInit(s, pitchSlots) and must keep getting the identical, fully
// deterministic match they were calibrated against. Pass an rng -- as the app does -- and the match
// gets the three things that are genuinely fresh every time a fixture is staged.
//
// Measured before this existed, over 40 seeds of one fixture: the starting shape was identical in
// 100% of matches, one single player took every kickoff, the first pass reached one of two men, and
// nothing was more than a stride out of place until tick 4. Everything AFTER that first second
// already varied properly -- 40 of 40 distinct eight-touch openings, 19 distinct scorelines -- which
// is why this is deliberately confined to the kickoff and adds no noise anywhere else.
export function meInit(s, slotsFor, rng) {
  // WHAT THE SIDE HAS DRILLED, whether its squad suits the system (ME_FIT), and what the system
  // costs at the door (ME_STYLE_PRICE): three properties of this match, all spent as effective
  // rating on everyone who plays -- bench included, since a substitute has been at the same
  // training ground. A side with no instructions pays the full drill floor and nothing else.
  // Applied before _att is ever read, since meAttrs memoises off ovr the first time anybody asks.
  // THE RATING THE CLUB LISTS, kept before anything bends it. meInit adds the drill penalty below,
  // a property of THIS MATCH -- so a side carrying no
  // instructions showed every player about ten points under the number on his own page, and the
  // squad average with him. Taken for EVERY side before the loop that applies the penalty, because
  // that loop returns early when a side has none to apply, and a fully committed side needs its
  // base rating just as much. The engine goes on playing at p.ovr; the report reads ovr0.
  for (const side of ME_SIDES)
    for (const p of [...(s.players[side] || []), ...(s.bench?.[side] || [])])
      { if (p.ovr0 === undefined) p.ovr0 = p.ovr ?? 70;
        p._chB = 0; }                              // the chance-build cap is per match
  // THE SECOND BRAIN PLAYS ON THE SHEET'S RATINGS. Everything this loop hands out -- the drill floor,
  // fit spent as rating, the style's price -- is the first brain standing in for how a side plays, and
  // the second brain is meant to play it (user, 2 Oct 2026).
  for (const side of (s.brain === 2 ? [] : ME_SIDES)) {
    const fit = Math.max(ME_FIT.lo, Math.min(ME_FIT.hi, s.fit?.[side] ?? 1));
    const d = meDrill(s.strategy?.[side]) + ME_FIT.ovr * (fit - 1) - (ME_STYLE_PRICE[s.styles?.[side]] || 0);
    if (!d) continue;
    for (const p of [...(s.players[side] || []), ...(s.bench?.[side] || [])]) {
      p.ovr = (p.ovr ?? 70) + d; p._att = null;
    }
  }
  // ...EXCEPT ITS STYLE'S PRICE (ME_MIND_PRICE, user, 7 Oct 2026): the style it kicks off in pays or is paid its
  // measured edge, on the same terms. A sheet name or the second brain's own id both find it.
  if (s.brain === 2) for (const side of ME_SIDES) {
    const sty = s.styles?.[side], d = -(ME_MIND_PRICE[ME_STYLE_DEF[sty] || sty] || 0);
    if (!d) continue;
    for (const p of [...(s.players[side] || []), ...(s.bench?.[side] || [])]) {
      p.ovr = (p.ovr ?? 70) + d; p._att = null;
    }
  }
  // WHERE THE TWO SIDES PLAY FROM, applied before anything else reads an instruction so it lands on
  // the baseline stamped into mp.stratBase below. s.homeAdv names the side WITH the advantage rather
  // than the fixture's home slot: a tie played at the away team's ground sets it to "away".
  if (s.homeAdv === "home" || s.homeAdv === "away") {
    const host = s.homeAdv, k = ME_HOME_ADV.k * (ME_HOME_ADV.tiltK ?? 1);
    const tilt = (side, shape) => {
      const st = s.strategy?.[side]; if (!st) return;
      for (const key in shape) {
        const r = ME_STRAT_RANGE[key] || [-2, 2];
        st[key] = Math.max(r[0], Math.min(r[1], (st[key] || 0) + shape[key] * k));
      }
    };
    tilt(host, ME_HOME_ADV.host);
    tilt(meOther(host), ME_HOME_ADV.guest);
    // Nobody's rating moves. The rest of the advantage is the referee, at the foul roll.
  }
  // Zero-mean, triangular, and drawn only here: it perturbs where a man STANDS, never how he plays.
  const jit = (a) => rng ? (rng.u() + rng.u() - 1) * a : 0;
  // THE TOSS. The app hardcoded possession to home, so home kicked off every match ever played.
  if (rng) s.possession = rng.u() < 0.5 ? "home" : "away";
  for (const side of ME_SIDES) {
    const ps = s.players[side], slots = slotsFor(s.formations?.[side] || "4-3-3");
    const own = meGoalX(meOther(side)), dir = meDir(side);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], sl = slots[Math.min(i, slots.length - 1)] || [50, 50];
      // FPOS2 is 0..100 with y=100 on your own goal line; convert to metres up the pitch.
      p._bd = (100 - sl[1]) / 100 * PITCH_L; p._bw = sl[0] / 100 * PITCH_W;
      p._bd0 = p._bd; p._bw0 = p._bw;
      p.x = own + dir * p._bd * 0.7; p.y = p._bw; p.vx = 0; p.vy = 0;
      // Nobody lines up on the chalk. The SLOT is untouched -- _bd0/_bw0 are what the block, the
      // zonal anchors and mindSet are all built from, so the side's shape and every tactical
      // consequence of it are exactly what they were; only the metre of grass he happens to be
      // standing on when the whistle goes is fresh. A keeper stands on his line, so he gets a
      // quarter of it.
      const amp = CFG.lineJit * (p.pos === "GK" ? 0.25 : 1);
      p.x = Math.max(1.5, Math.min(PITCH_L - 1.5, p.x + jit(amp)));
      p.y = Math.max(1.5, Math.min(PITCH_W - 1.5, p.y + jit(amp)));
    }
    // FORM, then ROLES. Every man on the sheet -- bench included, so a substitute already has
    // his -- draws one number for the match: a normal in compressed-OVR units, clamped at 2.5 sd.
    // It never touches his attributes. It only decides who is the hub and who leads his unit
    // TODAY, so the best man still leads on average and does not lead every time. Zero without
    // an rng, which is what keeps the deterministic harnesses bit-identical.
    const gauss = () => { if (!rng) return 0; const u1 = Math.max(1e-9, rng.u()), u2 = rng.u();
      return Math.max(-2.5, Math.min(2.5, Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2))); };
    for (const q of [...ps, ...(s.bench?.[side] || [])]) if (q) q._form = gauss() * CFG.roleFormSd;
    meRoles(s, side);
    // mindSet: GF's one 0..1 role scalar (GK 0, CB 0, CM 0.5, CF 1 -- AIfunctions.cpp:1228-1249).
    // Derived from the formation instead of authored: your natural depth within the XI IS your role.
    let mn = Infinity, mx = -Infinity;
    for (const p of ps) if (p.pos !== "GK") { if (p._bd0 < mn) mn = p._bd0; if (p._bd0 > mx) mx = p._bd0; }
    for (const p of ps) {
      p._mind = p.pos === "GK" ? 0 : Math.max(0, Math.min(1, (p._bd0 - mn) / Math.max(1, mx - mn)));
      p._avgV = 0;
      // meInfluence's per-man terms. Declared HERE, at kickoff, rather than stamped on first use:
      // a property added to an object later gives it a new hidden class, and these five would have
      // reshaped all twenty-two of them in the middle of the hottest loop in the engine.
      p._ivx = NaN; p._ivy = NaN; p._iux = 0; p._iuy = 0; p._istr = 1;
    }
  }
  // THE KICKOFF SET. A formation scaled by 0.7 is not a kickoff position. At 105 m a forward's slot
  // lands him 73.5 m from his own goal, which is twenty-one metres INSIDE the opposition half, and
  // nothing ever kept the side not kicking off out of the centre circle -- so a restart was staged
  // with men in the wrong half and opponents standing over the ball. Both are laws of the game
  // rather than taste: the referee does not whistle until they hold.
  // Asserted as an invariant rather than fixed by shrinking the 0.7, because a scale factor cannot
  // express either rule -- it moves every man including the ones already legal, and it has no idea
  // where the circle is. The SHAPE is untouched: _bd0/_bw0 still carry the formation, so the block,
  // the zonal anchors and mindSet are all exactly what they were, and only the metre of grass a man
  // stands on at the whistle changes.
  {
    const CIRCLE_R = 9.15, CHALK = 0.6;    // the centre circle, and a stride clear of any line
    const kick = s.possession === "away" ? "away" : "home";
    const cx = PITCH_L / 2;
    for (const side of ME_SIDES) {
      const dir = meDir(side);
      for (const p of s.players[side]) {
        // In his own half.
        const over = (p.x - cx) * dir;
        if (over > 0) p.x -= dir * (over + CHALK);
        // ...and outside the circle unless his side has the ball. He is pushed BACK out of it along
        // the pitch rather than radially, because radially out of a circle straddling the halfway
        // line is exactly how you put a man in the other team's half again.
        if (side === kick) continue;
        const dy = p.y - ME_HALF_W;
        if (Math.abs(dy) >= CIRCLE_R) continue;
        const edge = cx - dir * (Math.sqrt(CIRCLE_R * CIRCLE_R - dy * dy) + CHALK);
        if ((p.x - edge) * dir > 0) p.x = edge;
      }
    }
  }
  s.mePos = { bx: PITCH_L / 2, by: ME_HALF_W, bz: 0.11, bvx: 0, bvy: 0, bvz: 0,
    pred: null, lastSide: "home", touchSide: "home", passPending: null,
    side: s.possession || "home", idx: -1, hold: 0,
    flight: false, ft: 0, fx: 0, fy: 0, fj: -1, fside: "home", dead: 0, rkind: "kickoff", rside: "home",
    // The match's own entropy, for anything that hashes rather than drawing from the stream.
    // 0 without an rng, which is what keeps the deterministic harnesses bit-identical.
    vseed: rng ? (Math.floor(rng.u() * 4294967296) >>> 0) : 0,
    counter: null, counterT: 0, tick: 0, possT: 0, drive: 0, shot: null, kickBy: null, sp: null, held: false,
    map: { home: null, away: null }, blk: { home: null, away: null },
    bal: { home: 0, away: 0 }, fading: { home: 1, away: 1 },
    offB: { home: 0.5, away: 0.5 }, trap: { home: 30, away: 30 }, goals: { home: 0, away: 0 },
    desig: { home: -1, away: -1 }, ttbBest: { home: 9999, away: 9999 },
    slots: { home: [], away: [] }, dslots: { home: [], away: [] },
    phase: { home: "def", away: "def" }, phaseT: { home: 0, away: 0 },
    // The fit-damped instructions as the whistle went. meChase always works out from these rather
    // than from the live values, so a reaction never compounds on the last one, and so how well the
    // squad suits the system still governs the baseline the manager moves away from.
    stratBase: { home: { ...(s.strategy?.home || {}) }, away: { ...(s.strategy?.away || {}) } },
    chaseT: { home: 0, away: 0 } };
  for (const side of ME_SIDES) {
    s.mePos.slots[side] = s.players[side].filter(p => p.pos !== "GK")
      .map(p => ({ bd: p._bd0, bw: p._bw0, wx: p.x, wy: p.y }));
    // ...and the shape the same eleven take when they lose it. Built once, here, because it is a
    // property of the formation rather than of the moment.
    const f = s.formations?.[side] || "4-3-3", df = ME_DEF_FORM[f];
    s.mePos.dslots[side] = df
      ? (slotsFor(df) || []).filter((_, i) => i > 0)
          .map(sl => ({ bd: (100 - sl[1]) / 100 * PITCH_L, bw: sl[0] / 100 * PITCH_W, wx: 0, wy: 0 }))
      : s.mePos.slots[side].map(sl => ({ ...sl }));
  }
  // THE PLAN each side plays (plan.ts): its own if it arrived with one, its style's otherwise.
  s.plan = { home: s.plan?.home || mePlanOf(s.styles?.home), away: s.plan?.away || mePlanOf(s.styles?.away) };
  // THE SECOND BRAIN, when this match is played by it. After the formation shapes above, which it reads.
  if (s.brain === 2) mindInit(s, rng);
  meKickoff(s, s.possession || "home", rng);
}

export function meKickoff(s, side, rng) {
  const mp = s.mePos, ps = s.players[side];
  // WHO TAKES IT. Strictly the furthest-forward man meant one player took every kickoff of every
  // match, and with him fixed the first pass reached one of only two team-mates. A kickoff is two
  // players standing in the circle and either of them can roll it, so the taker is drawn from the
  // koTakers men highest up the pitch -- which is the same small group a manager would send, so
  // nothing about who is plausibly there has changed.
  let best = 0; for (let i = 1; i < ps.length; i++) if ((ps[i]._bd || 0) > (ps[best]._bd || 0)) best = i;
  if (rng) {
    const cand = ps.map((p, i) => i)
      .filter(i => ps[i] && !ps[i].off && ps[i].pos !== "GK")
      .sort((a, b) => (ps[b]._bd || 0) - (ps[a]._bd || 0))
      .slice(0, CFG.koTakers);
    if (cand.length) best = cand[Math.min(cand.length - 1, Math.floor(rng.u() * cand.length))];
  }
  mp.bx = PITCH_L / 2; mp.by = ME_HALF_W; mp.bz = 0.11; mp.bvx = 0; mp.bvy = 0; mp.bvz = 0;
  mp.side = side; mp.idx = best; mp.hold = 0; mp.flight = false; mp.lastSide = side; mp.passPending = null;
  if (ps[best]) { ps[best].x = PITCH_L / 2 - meDir(side) * (CFG.bodyR + CFG.ballR + 0.15); ps[best].y = ME_HALF_W; }
}

// A CHANGE OF SHAPE IN THE MIDDLE OF A MATCH, the manager's to make. Nobody moves along the side's list --
// half the engine keeps men by their place in it -- so each man on the pitch is handed one of the new
// formation's slots instead, by the cheapest assignment from the slot he had: the left-back of a back four
// becomes the left wing-back of a back five, he does not swap flanks with the right-back. He takes the new
// slot's name, its line and its attacking weight, so the shape, the block it drops into and every role are
// the new formation's from the next slice. A man sent off keeps his place in the list, and a side a man
// down gives up its furthest-forward spots as it always has (mindDefSlots).
export function meReshape(s, side, formation) {
  const mp = s.mePos, ps = s.players[side];
  if (!mp || !ps || !formation || s.formations?.[side] === formation) return false;
  const sl = pitchSlots(formation), spos = sposFor(formation), atk = formAtkW(formation);
  const dg = formation.split("-").map(Number), grp = ["GK"];
  for (let i = 0; i < dg[0]; i++) grp.push("DEF");
  for (let d = 1; d < dg.length - 1; d++) for (let i = 0; i < dg[d]; i++) grp.push("MID");
  for (let i = 0; i < dg[dg.length - 1]; i++) grp.push("FWD");
  const outf = [];
  for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].pos !== "GK") outf.push(i);
  const at = (j) => [(100 - sl[j][1]) / 100 * PITCH_L, sl[j][0] / 100 * PITCH_W];
  const n = Math.max(outf.length, sl.length - 1), cost = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      if (r >= outf.length || c >= sl.length - 1) { row.push(0); continue; }
      const p = ps[outf[r]], [bd, bw] = at(c + 1);
      row.push((p._bd0 - bd) ** 2 + ((p._bw0 - bw) * 1.2) ** 2);
    }
    cost.push(row);
  }
  const res = meHungarian(cost, n);
  for (let r = 0; r < outf.length; r++) {
    const j = res[r] + 1;
    if (!(j >= 1 && j < sl.length)) continue;
    const p = ps[outf[r]], [bd, bw] = at(j);
    p._bd0 = p._bd = bd; p._bw0 = p._bw = bw;
    p.spos = spos[j]; p.atkW = atk[j];
    if (p.pos !== grp[j]) { p.pos = grp[j]; p._att = null; p._awO = undefined; }
  }
  (s.formations = s.formations || {})[side] = formation;
  mp.slots[side] = ps.filter(p => p && p.pos !== "GK").map(p => ({ bd: p._bd0, bw: p._bw0, wx: p.x, wy: p.y }));
  const df = ME_DEF_FORM[formation];
  mp.dslots[side] = df
    ? pitchSlots(df).filter((_, i) => i > 0).map(q => ({ bd: (100 - q[1]) / 100 * PITCH_L, bw: q[0] / 100 * PITCH_W, wx: 0, wy: 0 }))
    : mp.slots[side].map(q => ({ ...q }));
  let mn = Infinity, mx = -Infinity;
  for (const p of ps) if (p && p.pos !== "GK") { if (p._bd0 < mn) mn = p._bd0; if (p._bd0 > mx) mx = p._bd0; }
  for (const p of ps) if (p) p._mind = p.pos === "GK" ? 0 : Math.max(0, Math.min(1, (p._bd0 - mn) / Math.max(1, mx - mn)));
  meRoles(s, side);
  // The second brain re-deals every role and the block on its next slice.
  if (mp.mind?.roster) mp.mind.roster[side] = "";
  return true;
}

// ---- movement ---------------------------------------------------------------------------
// Everyone runs at their target; whoever is closest to a loose ball chases it instead, and the
// nearest defenders leave their slot to close the man on the ball.
export function meMove(s, rng) {
  const mp = s.mePos;
  // Snapshot before anybody moves, so the renderer can draw between slices instead of on them.
  for (const sd of ME_SIDES) for (const q of s.players[sd]) { q._px = q.x; q._py = q.y; }
  for (const side of ME_SIDES) {
    const ps = s.players[side];
    // The chaser is the DESIGNATED man -- the one who wins the race to the forecast, not the one
    // who happens to be standing nearest. The intended receiver keeps his own ball.
    // ...and NEVER during a dead ball. meDead clears the designation, but a restart born early
    // in the tick (a handball penalty, an aerial foul) has the possession-currency block run
    // AFTER it in the same tick and re-designate somebody against the dead ball -- and the set
    // piece path never recomputes it, so that one man was steered to his stale intercept for the
    // whole ceremony. The pen taker stood at the goalmouth he had been running for while the
    // readiness gate waited on him and the timeout fired the kick from a man ten metres away;
    // a defender whose intercept sat in the box was driven in by this and walked out by the
    // referee, in a loop. One gate at the choke point protects every restart from every caller.
    // ...and NOBODY CHASES A SHOT. It has no receiver, so the quickest man to its path was sent after
    // it -- usually the man who had just hit it -- and a shot on target is going into the net, so he
    // followed it in. Until it is saved, blocked, off the frame or in, the keeper deals with it and
    // everybody else holds where the shape has him; the rebound is a loose ball like any other.
    let scramble = (mp.idx < 0 || mp.flight) && !mp.sp && !mp.shot ? mp.desig[side] : -1;
    if (mp.flight && mp.fside === side && mp.fj >= 0) scramble = mp.fj;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.off) { p.vx = 0; p.vy = 0; continue; }  // sent off
      // A keeper making a save is where the save puts him (keeper.ts), at the end of this slice.
      const gp = mp.shot?.gk ?? mp.gkPlan;
      if (gp && gp.side === side && gp.i === i) {
        const [lx, ly] = meGkAt(gp, Math.max(0, (mp.tick - gp.t0) * ME_DT));
        p.vx = lx - p.x; p.vy = ly - p.y; p.x = lx; p.y = ly; p._gkPl = true;
        continue;
      }
      // A SAVE ENDS WITH HIM ON THE GROUND, not still travelling at diving pace. Carrying the dive's
      // velocity out of it, he had to brake and turn it round like a sprinter before he could go back
      // for a ball that had dropped dead a stride from him -- 0.3 m in three slices, traced.
      if (p._gkPl) { p._gkPl = false; p.vx = 0; p.vy = 0; }
      let tx = p._tx, ty = p._ty;
      // The man on the ball is steered like everybody else. He used to be skipped entirely, which
      // left him shuffling 0.14 m a slice -- 84% of all ball-possession time was somebody walking
      // at half a metre per second, and that was the whole texture of the match.
      const onBall = mp.idx === i && mp.side === side;
      let budget = 0;
      // ...but NOT a keeper facing a struck shot. His target is his READ, decided in meShape, and
      // meIntercept on a shot he cannot physically reach returns the LAST point of the three-second
      // forecast -- well behind his own goal. This override was therefore sending him diving
      // backwards past his own line while the ball flew past him: the half-backwards dive, and the
      // reason every change to the read model landed in _tx/_ty and was thrown away one function
      // later. He is not chasing this ball down. He is getting across it.
      const gkShot = p.pos === "GK" && mp.shot && mp.shot.side !== side;
      // The keeper is sent by his own judgement (brain.ts), which already names the spot he is going to.
      if (i === scramble && !gkShot && p.pos !== "GK") {
        // Run at where the ball WILL be, not where it is, and spend only the effort the race needs:
        // a man with time jogs to the spot, a man who is late sprints (AIfunctions.cpp:827-838).
        if (mp.idx < 0 && p._icx !== undefined) { tx = p._icx; ty = p._icy; budget = p._icMs || 0; }
        else { tx = mp.bx; ty = mp.by; }
      }
      const a = meAttrs(p);
      // Running with the ball costs you speed. That is the only thing having it changes.
      // A keeper jogs about his box, but a keeper going for a ball dives, and a dive is quick.
      if (p.knock > 0) p.knock--;
      if (p._strideT > 0) p._strideT--;
      const sp = meSpeed(a, p.stamina) * (p.pos === "GK" ? (p._closing ? CFG.gkScramble : 0.75) : 1)
               // ...unless he has just taken it in stride, in which case he keeps what he had for a
               // touch or two and only then settles to carrying pace.
               * (onBall && Math.hypot(mp.bx - p.x, mp.by - p.y) < CFG.dribSprintGap
                    ? (p._strideT > 0 ? CFG.carrySpeed + (1 - CFG.carrySpeed) * (p._stride || 0) : CFG.carrySpeed)
                    : 1)
               * (p.knock > 0 ? CFG.injKnockSpd : 1)
               // Beaten. He dived in, the man went past him, and he is turning: taking him out of
               // the pressing pool was not enough on its own, because somebody else simply stepped
               // in. What being beaten costs is the GROUND, and only a committed defender pays it.
               * (p._beat > 0 ? CFG.tkBeatSpd : 1);
      // Harness-only: how often the man on the ball has it behind his own motion. Same gate
      // pattern as __prov/__shots; the [1] bucket is a moving carrier with the ball in his back
      // cone, which is the overrun the fluidity rework exists to kill.
      if (globalThis.__drag && onBall) {
        const vm2 = Math.hypot(p.vx || 0, p.vy || 0);
        if (vm2 / ME_DT > 1.5) {
          const bd2 = Math.hypot(mp.bx - p.x, mp.by - p.y) || 1;
          const dt2 = ((mp.bx - p.x) * p.vx + (mp.by - p.y) * p.vy) / (vm2 * bd2);
          globalThis.__drag[0]++; if (dt2 < -0.2) globalThis.__drag[1]++;
        }
      }
      let dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      // Harness-only: per-tick trace of the penalty taker's movement solve. Same gate pattern
      // as __pen; a watched match pays one truthiness test per player per tick.
      if (globalThis.__penTrace && mp.sp?.kind === "penalty" && side === mp.sp.side
          && i === mp.sp.ti && mp.sp.t % 10 === 0)
        globalThis.__penTrace.push({ t: mp.sp.t, x: +p.x.toFixed(2), y: +p.y.toFixed(2),
          tx: +tx.toFixed(2), ty: +ty.toFixed(2), d: +d.toFixed(2),
          vx: +(p.vx || 0).toFixed(3), vy: +(p.vy || 0).toFixed(3),
          knock: p.knock || 0, stam: +(p.stamina ?? -1).toFixed(0), off: p.off ? 1 : 0,
          duty: p._duty || "", closing: p._closing ? 1 : 0, spSet: p._spSet ? 1 : 0 });
      // A keeper has to arrive exactly. Stopping 1.3 m short of the spot is the difference between
      // a save and a goal, which for everyone else is just a man not jiggling on his mark.
      // The man on the ball never "arrives" -- he is running onto it to touch it again. Stopping him
      // 1.3 m short is the stall you can see on screen: man and ball both standing still a metre
      // apart while he "thinks", until his touch budget runs out and he plays a pass from a stop.
      // The man on the ball never "arrives": pursuit handles his approach, so he is never frozen.
      // At a set piece a man walks to a PRECISE spot. Everyone at a restart is flagged _closing, and
      // that stopped them 1.6 m short -- while the taker had to be within 0.7 m of his mark to be
      // counted ready and within 0.6 m of the ball to strike it. He could satisfy neither, so every
      // corner and free kick sat waiting out two timeouts after the whole box was already set.
      // The man going for the ball has to arrive ON it, not a stride and a half short of it -- that
      // gap is the difference between receiving a pass and watching a defender step in front of it.
      // ...and a ball AT REST is not one you stand off. The stand-off exists because a travelling
      // ball is coming to you and running onto it is how you overrun it. A stationary ball is coming
      // nowhere, and 1.3 m short of it is outside the 0.6 m at which anybody may touch it -- so a
      // ball that rolled to a stop in that band was unreachable by all twenty-two men, and the two
      // chasers stood over it for the rest of the match. That is the freeze.
      const deadBall = Math.hypot(mp.bvx, mp.bvy) < CFG.deadBallV;
      // _closing means HE IS COMMITTED TO GETTING SOMEWHERE, and it carried the loosest arrival
      // tolerance on the pitch: 1.6 m against 1.3 m for a man who is not committed to anything. The
      // 1.6 dates from set pieces, which now take the mp.sp branch above it and have not needed it
      // for some time. Stacked on a jockey target already offset from the ball it put the presser
      // 3.4 m away from the man he was pressing -- measured, he was standing on his own target 7% of
      // the time and 4.14 m off it -- which is the whole reason nothing was ever contested: 43% of
      // shots had a defender inside 2 m and 2% were blocked, because near is not in the way.
      // ...and it is 0.12 only for the men meSPShape actually PLACED. Keyed on mp.sp alone it
      // tightened the arrival tolerance ten-fold for all twenty-two the instant a restart was
      // called, so every player already standing still on his mark was abruptly no longer arrived
      // and took a step for no reason. That is the twitch you can see on the whistle. The precision
      // is for the taker, the wall and the men on their spots -- _spSet is exactly that set, and it
      // is cleared for everybody at the top of meSPShape each time it runs.
      // The chaser's stand-off is measured against the ball's LINE, not against his intercept
      // point. Reach is 0.70 m: a man arrived 1.3 m perpendicular to the path can never touch the
      // ball that sweeps through it, so he watched it roll past and chased the re-solve -- which
      // is what receiving anything not struck straight at him looked like. Off the line he keeps
      // converging; only once he is standing ON it does the overrun stand-off apply.
      let onLine = true;
      if (i === scramble && !deadBall) {
        const bv0 = Math.hypot(mp.bvx, mp.bvy);
        if (bv0 > 0.01)
          onLine = Math.abs((p.x - mp.bx) * (-mp.bvy / bv0) + (p.y - mp.by) * (mp.bvx / bv0)) < CFG.lineStand;
      }
      // MEETING IT. On the line and a stride from where it will reach him, he used to stop dead and
      // let it come -- every pass to feet met a statue, and the touch was taken from a standstill.
      // He now walks into it along its line, quicker with a man on him, so he meets it moving.
      let meet = 0;
      if (i === scramble && !gkShot && !deadBall && onLine && mp.idx < 0 && d < CFG.scrambleStop) {
        const bdx = mp.bx - p.x, bdy = mp.by - p.y, bd = Math.hypot(bdx, bdy);
        if (bd > 0.05 && (mp.bvx * bdx + mp.bvy * bdy) < 0) {        // it is still coming to him
          let nearO = Infinity;
          for (const z of s.players[meOther(side)]) if (!z.off) nearO = Math.min(nearO, Math.hypot(z.x - p.x, z.y - p.y));
          meet = CFG.recvMeetV + CFG.recvMeetPress * Math.max(0, Math.min(1, 1 - (nearO - 1) / 3));
          tx = mp.bx; ty = mp.by; dx = bdx; dy = bdy; d = bd;
        }
      }
      // ...and ONLY WHILE IT IS COMING TO HIM. Chasing a ball that is running away from him -- an
      // opponent's through ball he is racing a striker to -- the stand-off stopped him dead a stride
      // short of his meeting point every slice: he stopped, the ball rolled on, he started again from
      // nothing. Traced, a defender 0.7 m from a through ball was down to 2.7 m/s and let the striker
      // arriving behind him take it. That is the jockeying.
      const coming = mp.bvx * (p.x - mp.bx) + mp.bvy * (p.y - mp.by) > 0;
      const stopAt = (mp.sp && p._spSet) ? 0.12 : p.pos === "GK" ? 0.25 : onBall ? 0
                   : i === scramble ? (deadBall || !onLine || meet || !coming ? 0 : CFG.scrambleStop)
                   : p._closing ? CFG.closeStop : 1.3;
      if (d < stopAt) { p.vx = 0; p.vy = 0; continue; }   // arrived; stop rather than jiggle on the spot
      // GetLazyVelocity (elizacontroller.cpp:437-474): how hard you run depends on who you are, what
      // the score of the possession contest is, and how far you are from the action -- a striker
      // visibly jogs while his side defends, a centre-half while it attacks, and the midfield always
      // works. The arrival gate underneath it stays: nobody orbits his own target at a sprint.
      // ...and a KEEPER is always working. Adjusting your angle is two metres of side-shuffle, which
      // put him inside the d > 4 arm of the lazy ramp at 0.30 of a pace already multiplied by 0.75
      // for being a goalkeeper: about 1.5 m/s, while the ball is switched across the box at fifteen.
      // Measured, he stood 2.45 m from the spot he had been told to stand on at the moment shots
      // were struck, 8.2 m at the ninetieth percentile -- so the angle he was given no longer had
      // anything to do with the angle he was on.
      const must = p._closing || i === scramble || (p._runT ?? 0) > 0 || onBall || p.pos === "GK";
      // Easing into your spot is what stops off-ball players skidding past their mark. Applied to a
      // man who MUST get somewhere it is ruinous: his target is by definition close, so the ramp
      // pinned him at 30% of his pace for the whole last four metres. Traced, a keeper diving at a
      // shot moved 0.7 m in three slices while the ball went 2.6 m across him -- and the same cap was
      // on every presser closing the last stride and everyone chasing a loose ball.
      // A man who has committed to cutting a pass out is going for the ball as surely as the
      // designated chaser is, and he is racing somebody to it. Left on the ordinary "committed"
      // effort he ran at 68% of his pace at a ball he had to BEAT a man to, and lost.
      // ...and the man pressing the ball. He was on effortHard like any other committed player, which
      // is 0.68 of his top speed -- 4.97 m/s for a 70-pace man against a carrier running at 0.86 of
      // his, 6.30 m/s. He was a metre and a third per second SLOWER than the man he was chasing, so
      // he could not close whatever target he was given. That single comparison is why the presser
      // hovered at 3.3 m, why he stood on his own target 7% of the time, why 43% of shots had a
      // defender inside 2 m and 2% were blocked, and why repositioning him three separate ways all
      // measured as doing nothing. Closing a man down is a sprint, not a jog.
      // A KEEPER MOVES AT KEEPER PACE, always. His own 0.75 multiplier (and gkScramble when he is
      // committed) is already in `sp` above, so he does not need a second throttle on top of it --
      // and `must` alone is the wrong one, because that arm is effortHard, 0.68, which is SLOWER
      // than the 1.0 the lazy ramp hands out beyond nine metres. He was made to work and got further
      // from his spot for it, 2.45 m to 2.68.
      // ...BUT CLOSING DOWN IS NOT ALWAYS A SPRINT. Every presser ran flat out, everywhere on the
      // pitch, for the whole match -- and the drain below is paid per metre at full pace, so sides
      // with no pressing instruction at all were emptying their legs in the opponent's third and
      // going off before half time. A man goes at it hard when he is nearly there (the last few
      // metres, where the tackle is), when his side is told to press high, or when the ball is
      // near his own goal. Otherwise he closes at a working pace and holds his shape, which is
      // what a side that is not pressing actually does.
      const pStrat = s.strategy?.[side] || {};
      const pressHot = d < CFG.pressSprintD
        || (pStrat.pressingLOE || 0) > 0
        || (mp.bx - meGoalX(meOther(side))) * meDir(side) < CFG.pressOwnD;
      const chase = i === scramble || onBall || (p._cut ?? 0) > 0
                 || (p._duty === "press" && pressHot)
                 || p.pos === "GK";
      // ...and how hard a committed man works depends on how far out of position he is. A marker
      // jockeying his man does not sprint, and should not -- but a forward fourteen metres upfield
      // of his slot with the ball in his own box is not "working hard", he is running for his life.
      // Held at a flat 68% they all jogged home: measured under siege, the block asked for
      // 8.6 / 16.0 / 24.3 m and the men stood at 13.7 / 23.8 / 36.4, so the side defended twelve
      // metres too high and one forward in a hundred was inside his own area, while 85% of them were
      // already flagged as recovering. Recovering is a sprint. Jockeying is not.
      // A man getting into his defensive shape starts ABOVE the speed the block itself travels at,
      // or he is chasing something he can never reach, and ramps to a flat sprint the further out of
      // it he is. Everyone else committed -- markers jockeying, runners in behind -- stays at the
      // ordinary hard-working pace, which is what keeps the match off a permanent sprint.
      const hard = p._track
        ? Math.min(1, CFG.trackBase + Math.max(0, d - CFG.recoverNear) / CFG.recoverSpan * (1 - CFG.trackBase))
        : CFG.effortHard;
      let vCap = chase ? sp : must ? sp * hard : sp * (d > 9 ? 1 : d > 4 ? 0.55 : 0.30);
      // THE CORNER TAKER HURRIES to the flag, flat out until he is nearly there: with more corners a
      // match the walk was dead time.
      if (mp.sp && mp.sp.kind === "corner" && side === mp.sp.side && i === mp.sp.ti) vCap = sp * (d > 2 ? 1 : 0.5);
      if (i === scramble && !gkShot && budget > 0) {
        // Pace against the CONTEST, not the ball's clock: having 200 ms in hand on the ball means
        // nothing if the striker you are racing arrives first. This is why every through ball was
        // being strolled onto -- defenders jogged to slots the opponent reached at a sprint.
        const rival = mp.ttbBest[meOther(side)];
        const need = p._ttbMs ?? budget;
        // ...but a CONTESTED ball is not one you pace yourself to. Measured, in races settled by
        // under a quarter of a second the man the ball was played to was below three-quarter pace on
        // 95% of slices: he was jogging to a spot to arrive on schedule while a defender sprinted at
        // the same ball. Nobody who is being raced for it arrives on schedule; he goes and gets it.
        // ...and paced to arrive BEFORE him, by contestMs. It was paced to rival + 100: a defender with
        // "time" on a through ball jogged to arrive a tenth of a second after the striker he was racing,
        // which is the defender strolling alongside it until the striker catches up and takes it.
        const target = Math.min(budget, rival - CFG.contestMs);
        if (rival - need < CFG.contestMs || target <= need) vCap = sp;
        else vCap = Math.max(2.2, Math.min(sp, sp * need / Math.max(1, target)));
      }
      // THE GATHER. Both arms above can leave him at a flat sprint onto a ball that is dying in
      // front of him -- a through ball arrives at 2.3 m/s and he closes at 8, which is how the
      // race is won and the ball ends up behind the winner. Inside gatherR of a ball receding
      // along his own approach he shortens his stride to the ball's pace plus gatherOver, so he
      // arrives WITH it. A ball coming toward him or crossing him is not gathered, it is met --
      // and a CONTESTED ball is never gathered at all: slowing a man who is racing somebody to it
      // hands the race over (first cut of this clamped the defender closing on an interception,
      // and shots went up 28% league-wide because through balls stopped being cut out).
      // ...and only for a ball of his OWN side's, or one nobody else is anywhere near. On the other
      // side's through ball it had the defender behind it shortening his stride to its pace -- walking
      // after it -- while the striker sprinted up and took it off him.
      if (i === scramble && !gkShot && !deadBall
          && (mp.flight ? mp.fside === side : true)
          && mp.ttbBest[meOther(side)] - (p._ttbMs ?? 0) >= CFG.contestMs * (mp.flight ? 1 : 3)) {
        const bvG = Math.hypot(mp.bvx, mp.bvy);
        const gdx = mp.bx - p.x, gdy = mp.by - p.y, gd = Math.hypot(gdx, gdy);
        if (bvG > CFG.deadBallV && gd > 0.01 && gd < CFG.gatherR
            && (mp.bvx * gdx + mp.bvy * gdy) / (bvG * gd) > 0.5)
          vCap = Math.min(vCap, bvG + CFG.gatherOver);
      }
      if (meet) vCap = Math.min(vCap, meet);
      if (!must) {
        const fInv = Math.max(0, Math.min(1, (p.stamina ?? 100) / 100));
        const start = CFG.lazyStart * (fInv * 0.8 + 0.2), end = CFG.lazyEnd * (fInv * 0.5 + 0.5);
        const t = Math.max(0, Math.min(1, (mp.bal[side] + 1) / 2));
        const mind = p._mind ?? 0.5;
        const lazyRole = mind + t * (1 - mind * 2);          // CF: 1-t, CB: t, CM: flat 0.5
        const lazyPos = Math.max(0, Math.min(1, (Math.hypot(p.x - mp.bx, p.y - mp.by) - start) / Math.max(1, end - start)));
        const lazy = lazyPos * (0.5 + lazyRole * 0.5);
        // The breath model: recent average speed is the lungs, and the throttle only binds on a man
        // who is allowed to be lazy -- someone who genuinely must run is never held back by it.
        let breath = Math.pow(1 - Math.max(0, Math.min(1, (p._avgV ?? 0) / 8)), CFG.breathExp);
        breath = Math.min(breath * 1.2, 1);
        breath = breath * lazy + (1 - lazy);
        vCap = Math.min(vCap * (1 - lazy), sp * breath);
        if (sp >= CFG.lazyFloor && vCap < CFG.lazyFloor && d > 4) vCap = CFG.lazyFloor;
        // SHOWING FOR IT IS WORK, AND THE GOOD ONES DO IT. With his side in possession an
        // off-ball man ambled at 30-55% of his pace whatever his rating -- the loiter. The floor
        // scales with meMind: an 88 keeps moving between spots, a 62 still strolls. Stamina pays
        // through meSpeed and the breath model exactly as for any other running.
        if (mp.side === side && !onBall && p.pos !== "GK" && d > 2)
          vCap = Math.max(vCap, sp * (CFG.liveLo + CFG.liveMind * meMind(p)));
      }
      // THE SECOND BRAIN SAYS HOW HARD. Its team brain has already decided what each man is doing --
      // sprinting to press, jogging into his cell, getting back -- so the lazy ramp above, which guessed
      // effort from the possession contest and his natural depth, is replaced by that decision. He still
      // eases into his spot over the last couple of metres. Not at a restart, where the first brain's
      // set-piece shapes are walking him.
      if (s.brain === 2 && !mp.sp && p._eff != null && i !== scramble && !onBall && p.pos !== "GK") {
        vCap = sp * p._eff;
        if (d < MT.easeD) vCap = Math.min(vCap, sp * Math.max(MT.easeMin, d / MT.easeD) * Math.max(0.55, p._eff));
      }
      // Everyone else eases into their target so they do not skid past it. The man on the ball must
      // NOT: his target is the ball, the ball is about a metre away, and clamping his stride to that
      // distance meant he could never run -- measured, he averaged 2.4 m/s of a possible 7.3 and
      // spent the whole match jogging up to a ball he was permanently about to arrive at. Running
      // THROUGH it is the point: that is what makes contact, and contact is what pushes it forward.
      // Clamped again for everyone: with his target now sitting just behind the ball rather than on
      // it, an unclamped stride simply carried him straight past both.
      // A DIVE IS A BURST, not an acceleration curve. Now that he saves with his body rather than a
      // reach ring, getting there is the whole of goalkeeping -- and the ordinary steering sheds only
      // 42% of the difference per slice, so in the half second a shot takes he barely left the spot:
      // 0.2 saves and six goals a side. Reaction comes off the front, then he goes at diving pace and
      // arrives without having to build up to it. Both ends come off his rating.
      let diving = false;
      if (p.pos === "GK" && mp.shot && mp.shot.side !== side) {
        const react = meGkReact(a);
        if ((mp.tick - mp.shot.t0) * ME_DT >= react) {
          vCap = meGkDiveV(a);
          diving = true;
        }
      }
      // ...AND AT A LOOSE BALL NEAR HIM. Going for one, inside gkBurstR, he throws himself at it too. On
      // the ordinary steering he turned like a sprinter: a parry or a ricochet that died a stride away
      // after he had been running the other way was 0.3 m nearer three slices later, and the striker
      // coming onto it had it first.
      if (!diving && p.pos === "GK" && p._gkGo && d < CFG.gkBurstR) {
        vCap = Math.max(vCap, meGkDiveV(a));
        diving = true;
      }
      const step = Math.min(d, vCap * ME_DT);
      let wx = dx / d * step, wy = dy / d * step;          // what he wants to be doing
      // PURSUIT, for the man on the ball. Everyone else eases into a spot they are walking to, and
      // capping their stride by the distance left is what stops them skidding past it. He is not
      // walking to a spot -- he is chasing a moving object whose position IS his target, so that cap
      // read "you may run only as fast as the ball is near", and it pinned him at a jog for the whole
      // match: 2.4 m/s of a possible 7.3. Here his pace comes from the BALL's pace plus how far
      // behind it he is -- he sprints while it runs away from him and settles gently when it does
      // not. Velocity matching, not an arrival ramp.
      if (onBall) {
        // ...and he PACES it. His closing speed on the ball has to fall away as the gap does, or he
        // runs straight over it. Traced: he collected it at 0.60 m doing 4.5 m/s, closed to 0.15,
        // then to 0.04 -- standing on it -- and at that separation the body ejection in hitBodies
        // places the ball on his shell along the contact normal, which by then points BACKWARDS.
        // From there it is pinned: the control force pulls it toward a point a stride in front of
        // him, so the pull runs through his own body and can never recover it, while the ejection
        // re-pins it to his back every substep. That is the moonwalk, and it begins with the overrun.
        // Braking curve: at `standoff` he is matching the ball exactly, and standoff sits OUTSIDE
        // his body (0.39 m) and inside his control reach (0.70), so he settles a boot's length
        // behind it and never on top of it.
        // His target is now a boot's length BEHIND the ball (meShape), so he settles on it exactly: the
        // ball is inside dribTouchR there, which is where his next touch comes from.
        const ux = dx / d, uy = dy / d;
        const close = Math.min(d * CFG.pursueGain, Math.sqrt(2 * CFG.recvBrake * d));
        let dvx = mp.bvx + ux * close, dvy = mp.bvy + uy * close;
        const dm = Math.hypot(dvx, dvy);
        if (dm > sp) { dvx *= sp / dm; dvy *= sp / dm; }   // his legs are the only limit
        wx = dvx * ME_DT; wy = dvy * ME_DT;
      }
      // Nobody stands on a team-mate. (The second brain spaces its men itself, so it only keeps them off
      // each other's toes.)
      const sepR = s.brain === 2 ? MT.sepR : CFG.sepR, sepW = s.brain === 2 ? MT.sepW : CFG.sepW;
      let sx = 0, sy = 0;
      for (const q of ps) {
        if (q === p) continue;
        const qx = p.x - q.x, qy = p.y - q.y, qd = Math.hypot(qx, qy);
        if (qd > sepR || qd < 0.05) continue;
        const w = (sepR - qd) / sepR;
        sx += qx / qd * w * w; sy += qy / qd * w * w;
      }
      wx += sx * sepW * sp * ME_DT; wy += sy * sepW * sp * ME_DT;
      const cur = Math.hypot(p.vx || 0, p.vy || 0);
      // Turning hard scrubs speed off, the way it does on grass.
      let acc = CFG.accel * (meBadgeFx(p).acc ?? 1);
      if (cur > 0.02 && step > 0.02) {
        const dot = ((p.vx * wx) + (p.vy * wy)) / (cur * step);
        acc *= 1 - CFG.turnPenalty * Math.max(0, -dot);
      }
      // Walking onto a set-piece mark: no momentum, so he arrives on it rather than orbiting it.
      if (mp.sp && d < CFG.spArrive) acc = 1;
      if (diving) acc = 1;                       // he throws himself; there is no wind-up
      // A KEEPER SHUFFLES. Adjusting his angle is side-steps, not a sprinter's turn: on the runner's
      // momentum a reversal kept 19% of the change a slice, and a pass across the box moved his spot a
      // metre while he moved ten centimetres toward it -- still a stride nearer the post when it was hit.
      else if (p.pos === "GK" && !mp.sp) acc = Math.max(acc, CFG.gkAccel);
      // Tried and rejected: a turn-rate cap on the velocity update, turnLat/v radians a second, on
      // the theory that nothing limits how fast a man's DIRECTION may change and men near the ball
      // were measured spinning at 354 deg/s at the ninetieth percentile. It moves that figure by
      // nothing (354 -> 349 at a cap of 8 m/s^2 of lateral acceleration, 6 m/s^2 starts breaking the
      // match) because the tail is not men turning too fast for their pace -- it is men below 1 m/s,
      // where a 350 deg/s rotation is a 2.5 cm circle and the cap never binds. That is jitter on the
      // spot, which target smoothing and the arrival gate already own, not orbiting.
      p.vx = (p.vx || 0) + (wx - (p.vx || 0)) * acc;
      p.vy = (p.vy || 0) + (wy - (p.vy || 0)) * acc;
      // Chasing a ball that has crossed the line would otherwise walk a defender out behind his own
      // goal -- targets were clamped but the resulting position never was.
      p.x = Math.max(0.5, Math.min(PITCH_L - 0.5, p.x + p.vx));
      p.y = Math.max(0.5, Math.min(PITCH_W - 0.5, p.y + p.vy));
      // Running costs. Sprinting flat out for a whole half is what empties a gegenpress.
      p.stamina = Math.max(0, (p.stamina ?? 100) - step * CFG.drain * (meBadgeFx(p).drain ?? 1)
      // TEMPO IS PAID IN LEGS, not in accuracy. Pressing has always cost stamina here; playing fast
      // is the same kind of thing and a better cost than widening the aim cone, because it is
      // DEFERRED -- you go quick now and fade for it later, which is what makes tempo a decision
      // you take at a moment rather than a slider you set once. The existing fatigue and
      // substitution machinery then handles the consequence without anything new.
      // Clamped at zero as a whole, so a slow side saves legs but can never bank stamina.
      // ...AND EACH SURCHARGE IN ITS OWN PHASE. The pressing surcharge used to apply to every metre
      // a presser ran, including the metres he ran while his own side had the ball -- so a high
      // press paid the same whether it faced a side that gave the ball straight back or one that
      // made it chase for sixty seconds a spell. Scoped to the defending phase, the cost of
      // pressing now scales with how much defending the opponent makes you do, which is the whole
      // of what "making the ball do the work" is supposed to buy a possession side. Tempo is the
      // mirror: playing quick costs legs while you HAVE the ball.
      * (1 + Math.max(0, (s.mePos?.side !== side ? (s.strategy?.[side]?.pressingLOE || 0) * CFG.pressDrain : 0)
                          + (s.mePos?.side === side ? (s.strategy?.[side]?.tempo || 0) * CFG.tempoDrain : 0))));
      // The ball is NOT dragged along with him. He is running near an object.
      p._avgV = (p._avgV ?? 0) * 0.9 + (step / ME_DT) * 0.1;   // ~10-tick lungs for the breath model
    }
  }
  // Nobody stands where somebody else already is. A soft separation STEER was not enough -- it is a
  // preference, and two men could and did end up on the same square metre, which is not football.
  const all = s.players.home.concat(s.players.away);
  const D = CFG.bodyR * 2;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const u = all[i], w = all[j];
    const dx = w.x - u.x, dy = w.y - u.y;
    let d = Math.hypot(dx, dy);
    if (d >= D) continue;
    if (d < 1e-4) d = 1e-4;
    const push = (D - d) / 2, nx = dx / d, ny = dy / d;
    u.x = Math.max(0.5, Math.min(PITCH_L - 0.5, u.x - nx * push));
    u.y = Math.max(0.5, Math.min(PITCH_W - 0.5, u.y - ny * push));
    w.x = Math.max(0.5, Math.min(PITCH_L - 0.5, w.x + nx * push));
    w.y = Math.max(0.5, Math.min(PITCH_W - 0.5, w.y + ny * push));
  }
}


// EVERY BODY'S LINE THROUGH THIS SLICE, before the ball moves. The ball is stepped a hundred times a
// second and the players four, so each man is taken to be running on at the pace he was last going
// (vx/vy are metres per slice) and meBallRun places him on that line at every substep -- which is also
// where the renderer draws him, since it tweens the same step. A keeper who has read a shot and reacted
// is on the dive he is making instead, stretched out along it: that is his capsule in the contest.
function mePoses(s) {
  const mp = s.mePos;
  for (const sd of ME_SIDES) for (const q of s.players[sd]) {
    if (!q) continue;
    q._pvx = q.off ? 0 : (q.vx || 0); q._pvy = q.off ? 0 : (q.vy || 0); q._pext = 0;
    if (q.pos !== "GK" || q.off) continue;
    // The planned save draws him along its own law (keeper.ts); the contest reads it off the clock.
    const gp = mp.shot?.gk ?? mp.gkPlan;
    if (gp && gp.side === sd && s.players[sd][gp.i] === q) {
      const [lx, ly] = meGkAt(gp, Math.max(0, (mp.tick - gp.t0) * ME_DT));
      q._pvx = lx - q.x; q._pvy = ly - q.y;
      continue;
    }
    let gvx = q._pvx, gvy = q._pvy;
    if (q._closing && mp.shot && mp.shot.side !== sd) {
      const qa = meAttrs(q);
      if ((mp.tick - mp.shot.t0) * ME_DT >= meGkReact(qa)) {
        const tdx = (q._tx ?? q.x) - q.x, tdy = (q._ty ?? q.y) - q.y, tl = Math.hypot(tdx, tdy);
        if (tl > 1e-3) {
          const stp = Math.min(tl, meGkDiveV(qa) * ME_DT);
          gvx = tdx / tl * stp; gvy = tdy / tl * stp;
        }
      }
    }
    const spd = Math.hypot(gvx, gvy) / ME_DT;
    q._pvx = gvx; q._pvy = gvy;
    q._pext = Math.max(0, Math.min(1, (spd - CFG.gkSpanV0) / (CFG.gkSpanV1 - CFG.gkSpanV0))) * CFG.gkSpan;
    q._pux = spd > 1e-4 ? gvx / (spd * ME_DT) : 0; q._puy = spd > 1e-4 ? gvy / (spd * ME_DT) : 0;
  }
}

// ---- the tick ---------------------------------------------------------------------------
export function meBallTo(s, side, i, x, y) {
  const mp = s.mePos;
  // RECEPTION AUDIT (harness-only): when the intended receiver takes a pass, how far did he come
  // TO it? Positive means he moved up the line toward the passer to meet it early, which is what a
  // man under pressure does; zero means he stood and let it arrive. Recorded with the nearest
  // opponent's distance at contact, so the pressured and free cases can be read apart.
  if (globalThis.__recv && mp._rcvAt && mp._rcvAt.side === side && mp._rcvAt.i === i) {
    const pp = mp._rcvAt; mp._rcvAt = null;
    const q = s.players[side]?.[i];
    if (q) {
      const sx = pp.sx, sy = pp.sy;                       // where the pass was struck from
      const d0 = Math.hypot(pp.ox - sx, pp.oy - sy);      // he was this far from the passer
      const d1 = Math.hypot(x - sx, y - sy);              // he took it this far from the passer
      let opp = Infinity;
      for (const z of s.players[meOther(side)]) { if (z.off) continue;
        const dz = Math.hypot(z.x - x, z.y - y); if (dz < opp) opp = dz; }
      // d0-d1 is how far he came TOWARD the passer; aim-d1 is how far short of where the ball was
      // aimed he actually took it, which is the same question asked against the pass's intent.
      globalThis.__recv.push([+(d0 - d1).toFixed(2), +Math.min(opp, 30).toFixed(1),
                              pp.thru ? 1 : 0, +(pp.aim - d1).toFixed(2)]);
    }
  }
  if (mp.side !== side) { mp.counter = side; mp.counterT = 26; mp.possT = 0; }   // just won it
  mp.drive = 0;
  for (const q of s.players[meOther(side)]) { q._run = null; q._runT = 0; }
  // Never inside the man who has just taken it. The ball is left where it was claimed, and a claim
  // can happen anywhere inside his reach -- including on top of him, where it is drawn inside the
  // player until the next slice's body ejection pushes it back out.
  const _p = s.players[side]?.[i];
  if (_p) {
    const _R = CFG.bodyR + CFG.ballR;
    // The ball used to be relocated a stride in front of a man who claimed it behind his motion. The
    // first touch is a placement now (touch.ts), made by the caller the moment this returns.
    let _dx = x - _p.x, _dy = y - _p.y, _d = Math.hypot(_dx, _dy);
    if (_d < _R) {
      if (_d < 1e-3) { const _v = Math.hypot(_p.vx || 0, _p.vy || 0);
        if (_v > 1e-4) { _dx = _p.vx / _v; _dy = _p.vy / _v; } else { _dx = meDir(side); _dy = 0; } _d = 1; }
      x = _p.x + _dx / _d * _R; y = _p.y + _dy / _d * _R;
    }
  }
  // TAKING IT IN STRIDE. carrySpeed says having the ball costs you speed, and it applied from the
  // very first frame of a reception -- so a man sprinting onto a through ball decelerated the instant
  // it reached him, every time, however well it was played. That is the whole of "nobody ever runs
  // onto one cleanly": there was no such thing as a good ball, only a completed one.
  // Quality is measured off the ball itself, here, because this is the last moment it still has any:
  // how nearly it is travelling the way he is running, and how nearly at his pace. A ball laid into
  // his path at the speed he is going costs him nothing; one played behind him or twenty metres too
  // hard makes him check, which is what checking IS. Touch buys a little of it back, so a good
  // technician takes a worse ball cleanly.
  {
    const rc = s.players[side][i];
    if (rc) {
      const bs = Math.hypot(mp.bvx || 0, mp.bvy || 0), vs = Math.hypot(rc.vx || 0, rc.vy || 0);
      let str = 0;
      if (bs > 0.5 && vs > CFG.strideMinV) {
        const dot = ((mp.bvx || 0) * rc.vx + (mp.bvy || 0) * rc.vy) / (bs * vs);
        const pace = 1 - Math.min(1, Math.abs(bs - vs) / CFG.strideVTol);
        str = Math.max(0, dot) * Math.max(0, pace)
            * (CFG.strideTouch + meAttrs(rc).pass / 99 * (1 - CFG.strideTouch));
      }
      rc._stride = str; rc._strideT = CFG.strideT;
    }
  }
  mp.side = side; mp.idx = i; mp.bx = x; mp.by = y; mp.hold = 0; mp.flight = false;
  if (s.players[side][i]) { s.players[side][i]._drbA = null; s.players[side][i]._drbT = 0; }
  // No `out` reaches this function, so an unresolved penalty is parked on the state and the next
  // tick flushes it through the funnel -- the weak penalty a defender simply collects ends here.
  if (mp.shot && mp.shot.pen && !mp.shot._pd) mp._penGone = mp.shot;
  mp._carryBy = null;                          // a fresh claim opens a fresh episode
  mp.bz = 0.11; mp.bvx = 0; mp.bvy = 0; mp.bvz = 0; mp.lastSide = side; mp.passPending = null; mp.shot = null;
  mp.kickBy = null; mp.gkPlan = null; mp.bpass = null;
  mp.held = false;              // any new possession is with the feet until proven otherwise
}

// A man who has just struck the ball cannot take the next touch. Without this the pickup scan finds
// him zero metres from a path that starts at his own feet and hands it straight back.
// It is a list because a tackle locks out BOTH men in the challenge -- otherwise the tackler, who
// is by definition within three metres, simply collects the ball he has just knocked loose and
// nothing about it is loose.
// WHO HAS BEEN ON IT. kickBy is the lock that stops a man re-winning a ball he has just played; it
// is overwritten every kick and remembers nothing. An assist needs the touch BEFORE the shot, so the
// same event is also pushed onto a short history. Bounded, because nothing needs the first half.
// `deflect` marks a touch the man did not choose: the ball was moving too fast to control and came
// off him. He still locks out of re-winning it and he still owns it for last-touch bookkeeping, but
// the assist chain reads past him, because football does not credit a defender for a ricochet. Only
// the caller can know this -- by the time the log sees a touch, a block and a deflection look the
// same -- so it is passed in rather than inferred here.
export const meKickedBy = (mp, side, i, deflect) => {
  mp._carryBy = null;                          // a deliberate play ends the carry episode
  mp.kickBy = [{ s: side, i, t: mp.tick }];
  // A deliberate play supersedes any earlier deflection: he has the ball now, so whatever it last
  // bounced off stops deciding the next throw-in.
  mp.touchP = null;
  const g = (mp.tlog = mp.tlog || []);
  // ...and where. mp.bx/mp.by at the moment of the kick IS where he played it, so an error can be
  // located without threading a position through every call site.
  g.push(deflect ? { s: side, i, t: mp.tick, x: mp.bx, y: mp.by, d: 1 }
                 : { s: side, i, t: mp.tick, x: mp.bx, y: mp.by });
  if (g.length > CFG.tlogMax) g.shift();
};
// A plain loop: asked for every man at every substep, the .some() built a closure each time.
export const meLockedOut = (mp, sd, i) => {
  const kb = mp.kickBy;
  if (!kb) return false;
  for (let j = 0; j < kb.length; j++) { const k = kb[j]; if (k && k.s === sd && k.i === i && mp.tick - k.t < CFG.kickLock) return true; }
  return false;
};


// Whoever is nearest a loose ball takes it, better positional players slightly favoured.
export function meScramble(s, rng) {
  const mp = s.mePos; let bi = -1, bs = "home", bd = Infinity;
  for (const side of ME_SIDES) for (let i = 0; i < s.players[side].length; i++) {
    const q = s.players[side][i];
    if (!q || q.off) continue;                     // parked off the pitch: never handed the ball
    // Who reads the loose ball first. On position/99 this was worth 3% between a 70 and a 90 --
    // an attribute called positioning deciding almost nothing about who gets there. Same fix the
    // interception reach already had (cutAntLo/cutAntW): over the band a footballer occupies, with
    // the league's mean man left exactly where he was, so only the spread around him widens.
    const d = Math.hypot(q.x - mp.bx, q.y - mp.by)
            * (1 - meTech(meAttrs(q).position) * CFG.chaseAntW) + rng.u() * 1.5;
    if (d < bd) { bd = d; bi = i; bs = side; }
  }
  if (bi >= 0 && bd < 4.0) meBallTo(s, bs, bi, s.players[bs][bi].x, s.players[bs][bi].y);
}

// Three ball states, and only three: somebody has it (idx >= 0), it is travelling to somewhere
// (flight), or play has stopped and a set piece is being walked into shape (mp.sp -- see setpiece.ts).

// Restart delays are stated in real seconds -- nineteen for a throw, thirty-four for a corner -- so
// they have to shrink with the match. Left at their ninety-minute values against an eighteen-minute
// game the ball was DEAD for 65% of the match, and since no brain runs during a stoppage every duty
// and every block slot froze across it: measured, 89% of duties during a siege were stale attacking
// ones inherited from before the last throw-in.
// HOW LONG TO PLAY. Every slice the ball spent dead is counted, and a share of it is added back --
// which is all stoppage time is. The caller drives the tick loop, so it asks for this rather than
// the engine deciding when a match ends: `for (t = 0; t < ME_MATCH_TICKS + meAdded(s); t++)`.
// MATCH RATINGS. Deliberately the abstract sim's model rather than a new one: a season table that
// switches engines part-way must not switch scales with it, and those coefficients are already
// balanced. Base 6.5, event deltas, clamped to [3, 10].
// A goal at 0-0 or while behind counts for more than the fourth in a rout, and a late one counts
// for more again.
export const meCtxMult = (gFor, gAg, min) => {
  const d = gFor - gAg;
  const b = (gFor === 0 && gAg === 0) ? 1.15 : d === -1 ? 1.2 : d === 0 ? 1.15
          : d > 0 ? Math.max(0.8, 1.1 - d * 0.1) : 0.9;
  return b * (min >= 85 ? 1.3 : min >= 75 ? 1.15 : min >= 60 ? 1.05 : 1);
};
// Saving a chance that was going in is a bigger save. Conceding one that was NOT going in is a
// worse goal to concede. Both are measured against what an ordinary keeper concedes from a shot on
// target of that quality, and they share one weight, so over a match he is paid W times the goals
// he prevented and nothing for volume. See rateSave in config.
const clamp01 = (x) => Math.max(0, Math.min(1, x || 0));
// What an ordinary keeper concedes from this shot on target: the engine's own conversion curve by
// xg band, and a penalty's own figure. See gkExp in config.
export const meGkExp = (xg, pen) => {
  if (pen) return CFG.gkExpPen;
  const x = clamp01(xg), T = CFG.gkExp;
  for (const [hi, e] of T) if (x < hi) return e;
  return T[T.length - 1][1];
};
export const meSaveBonus = (xg, pen) => CFG.rateSave * meGkExp(xg, pen);
export const meConcedePen = (xg, pen) => CFG.rateSave * (1 - meGkExp(xg, pen));
// The running total is kept unclamped in _rr and only the shown rating is held to [3, 10]: clamped
// on the way, a brace with three assists and a goal on a tidy afternoon both arrived at full time as
// the same 10, and the finish could no longer tell them apart.
export const meRate = (p, d) => {
  if (!p || !d) return;
  p._rr = (p._rr ?? p.rating ?? 6.5) + d;
  p.rating = Math.max(3, Math.min(10, +p._rr.toFixed(2)));
};

// FULL TIME, for the ratings only -- nothing else in the engine needs a whistle, which is why there
// has never been one. Two corrections that can only be made once the match is over:
//
// MINUTES. A substitute who came on for the last five minutes and touched nothing must not be rated
// as confidently as a man who played ninety. His deviation from par is shrunk toward it in
// proportion to how much of the match he was actually on for, so a cameo has to be emphatic to
// register at all -- which is exactly how a cameo works.
//
// POSITION. A goal is worth 0.9 and the most a defender can do for one is 0.12, so the raw totals
// sit in different places by position: an ordinary afternoon is +0.2 for a keeper and +0.6 for a
// midfielder, and they swing by different amounts. The finish reads each man against his own
// position's ordinary afternoon and puts every position on the same scale (CFG.rateFin), so the
// rating says how well he played and nothing about where. Fitted by test/ratings.mjs derive, and
// re-derived whenever a rating delta or the football moves.
export function meFinalise(s) {
  const total = s.mePos.tick || 1;
  for (const sd of ME_SIDES) {
    for (const p of [...(s.players[sd] || []), ...(s.subbedOff?.[sd] || [])]) {
      if (!p || p.rating == null) continue;
      const on = p._onAt ?? 0, off = p._offAt ?? total;
      const frac = Math.max(0, Math.min(1, (off - on) / total));
      // ...EXCEPT WHERE THE SHORT APPEARANCE IS THE POINT. A red card is not a cameo, it is the
      // reason the cameo happened, and it is the most emphatic thing he did all afternoon. Shrinking
      // his deviation for having played twenty minutes forgives him for precisely the thing being
      // punished: a man dismissed in the twentieth had -1.5 scaled down to -0.45 and finished on
      // 6.05, a better afternoon than most of the men who stayed on the pitch. He is rated in full.
      // An injury keeps the shrink -- going off hurt is not something he did.
      // MINUTES, KEPT. frac is worked out here for the rating shrink and was then thrown away, so
      // every appearance looked alike downstream and a four-minute cameo weighed what a full ninety
      // did on a season's rating board. Nominal, because that is how a minutes column reads: a full
      // match is 90 whatever the stoppage ran to, and a match that went to extra time also reads 90.
      p.mins = Math.round(frac * 90);
      const shrink = p.rc ? 1 : Math.min(1, frac / CFG.rateFullFrac);
      // The rating is the PERFORMANCE, not the duration. Accumulated deviation used to be taken at
      // face value from rateFullFrac up, so a striker subbed on 65 carried 72% of his own afternoon
      // while the back four carried 100% of theirs -- across a season that discount alone kept
      // every forward off the top of the ratings board. The deviation now projects to the full
      // match (raw / frac) and the shrink below rateFullFrac stands unchanged on top, so for a
      // cameo the two cancel to raw / rateFullFrac and a fifteen-minute goal still cannot swing a
      // season. A red card stays unprojected: his minutes are the punishment, not a rate.
      // ...CAPPED, because 1/frac against the shrink below cancels to a constant: (1/frac) *
      // (frac/rateFullFrac) is 1.5 for EVERY partial appearance, so a man who played ten minutes
      // and scored was amplified exactly as much as one who played sixty, and the season board's
      // top man was a substitute with nine appearances. The cap restores the confidence weighting:
      // a sixty-minute shift still projects to its per-ninety rate, and below that the shrink wins.
      const proj = p.rc ? 1 : Math.min(1 / Math.max(frac, 0.05), CFG.rateProjMax);
      // AGAINST HIS OWN POSITION'S ORDINARY AFTERNOON, then one scale for everybody. `mid` is that
      // afternoon per ninety, and it lands on ratePar; the swing above it is scaled by `up` and the
      // swing below by `dn`, because drifting down for a poor afternoon is easy and drifting up for
      // a merely tidy one is not, and each position's afternoons are lopsided by a different amount.
      // The par and `mid` shrink with the minutes like the swing does, so a cameo starts where
      // everybody starts: 6.5.
      // THE TOP END BENDS INSTEAD OF CLIPPING: linear to rateKnee, then logarithmic, so the order is
      // kept all the way up. `tail` is the slope at the knee, per position -- a keeper's twelve-save
      // afternoons and a striker's hat-tricks are rare by different amounts, so each position gets
      // the same share at 9.0 or better -- and rateBend is how late it bends, which is what makes a
      // 10.0 possible but historic.
      const f = CFG.rateFin[p.pos] ?? CFG.rateFin.MID;
      const z = ((p._rr ?? p.rating) - 6.5) * proj * shrink - f.mid * shrink;
      const rTop = 6.5 + z * (z >= 0 ? f.up : f.dn) + (CFG.ratePar - 6.5) * shrink, KNEE = CFG.rateKnee;
      const S = CFG.rateBend, rSoft = rTop > KNEE ? KNEE + f.tail * S * Math.log(1 + (rTop - KNEE) / S) : rTop;
      p.rating = Math.max(3, Math.min(10, +(rSoft.toFixed(2))));
    }
  }
}

export const meAdded = (s) => Math.min(CFG.addedMax,
  Math.round((s.mePos.stopT || 0) * CFG.addedFrac));

export function meDead(s, kind, side, ticks, out) {
  // The countdown is gone. A stoppage is now a phase with a shape: see setpiece.ts. `ticks` survives
  // only so the call sites still read as "this is a long stoppage" / "this is a quick one", and it
  // sets the MINIMUM before anyone can take it.
  const mp = s.mePos;
  meSPBegin(s, kind, side, out);
  mp.sp.minT = mp.sp.quick ? CFG.spMinT
             : Math.max(CFG.spMinT, Math.round(ticks * ME_DEAD_SCALE * ME_SIM_MIN / 90));
  // The ball has to be on the spot before anybody can strike it. minT is only known here, after
  // meSPBegin has already sized the fetch, so this is where the two are reconciled.
  mp.sp.ft = Math.min(mp.sp.ft, mp.sp.minT);
  // The restart itself is a feed event. A corner, a throw or a goal kick is a stoppage the
  // sidebar should be able to explain; a foul or an offside already reports itself upstream.
  if (kind === "corner" || kind === "throw" || kind === "goalkick")
    meEvt(out, kind, side, mp.sp.x, mp.sp.y, mp.sp.x, mp.sp.y,
      kind === "corner" ? "Corner" : kind === "throw" ? "Throw-in" : "Goal kick");
  // TIME-WASTING, WHERE IT ACTUALLY HAPPENS. Nobody sees out a lead by dribbling the clock away in
  // midfield; they take an age over every goal kick, throw and free kick, and get booked for it.
  // Only restarts this side is taking, and never a kickoff -- nobody dawdles over the restart after
  // conceding -- nor a penalty, which the referee is standing over. Dead time is added back at
  // addedFrac, which is 0.55, so the clock burned is real but only about half of what is spent:
  // that is the benefit. The caution is the price, and it is what makes this a choice.
  const twSide = s.strategy?.[side]?.timeWasting || 0;
  const twLead = (out?.goals?.[side] ?? 0) - (out?.goals?.[meOther(side)] ?? 0);
  if (twSide > 0 && twLead > 0 && kind !== "kickoff" && kind !== "penalty") {
    mp.sp.waste = twSide;
    mp.sp.maxT = (CFG.spMaxTBy[kind] ?? CFG.spMaxT) + Math.round(twSide * CFG.wasteT);
    mp.sp.minT = Math.min(mp.sp.maxT - 2, mp.sp.minT + Math.round(twSide * CFG.wasteT));
  }
  mp.desig.home = -1; mp.desig.away = -1;      // nobody chases a dead ball
  mp.held = false;
  if (s.brain === 2) mindDead(s);
  // ...and nobody is still committed to cutting out a pass that no longer exists. meShape does not
  // run during a stoppage, so the flag would survive the whole restart and then send him sprinting
  // at a spot the ball left thirty seconds ago.
  for (const sd of ME_SIDES) for (const q of s.players[sd]) q._cut = 0;
}

// THE SHOOTOUT. Five each, then sudden death, and it is stopped the moment it cannot be caught --
// a shootout that plays all five when one side is three up is not a shootout. Each kick is the
// ordinary penalty set piece driven to its conclusion, so it is settled by the same taker, keeper,
// read and physics as one in open play rather than by a separate dice roll.
// SUBSTITUTIONS. The swap is IN PLACE, into the same index, and that is the whole design: mp.idx,
// mp.fj, mp.desig, _mk and every block slot are positions in s.players[side], so splicing or
// reordering would silently repoint all of them at the wrong man. The man coming on inherits the
// slot, the shirt and the spot on the grass; nothing else in the engine has to know it happened.
// THE TACKLE. There was no such thing in this engine. The press duty closed to jockeyR, stood the
// man up at jockeyStand, and jockeyed there indefinitely; the ball changed hands only when somebody
// happened to be within reach of its path. out.tackles counted GOALKEEPER SAVES.
//
// A defender jockeys until the angle is good enough and then goes -- and being BEATEN is the price
// of going and missing, not a state that appears from geometry. It used to be set only when
// st.tackling was non-zero, which the default strategy never sets, so it fired on 0.0% of slices and
// tkBeatSpd and the press-pool exclusion at brain.ts:227 were both dead code.
//
// The angle is how closed the carrier's options are: how near the defender already is, whether he is
// goal-side, whether the man is slowed or turning, whether a touchline is doing half the work, and
// whether there is cover behind. A better tackler needs less of it, because he trusts himself at a
// worse one, and Get Stuck In lowers the bar for everybody. That is a THRESHOLD moving, not a
// success coefficient being scaled -- the rule every other instruction in here follows.
// Which side a man plays for. tackles/carries/clears were pooled match totals, so a harness that
// asked "does this style tackle more" was reading both teams at once and attributing the lot to
// whichever happened to be home. Cards, offsides and injuries already carry per-side counts; these
// now do too, on the same self-initialising pattern so an out object that does not want them is
// unaffected.
const meSideOfP = (s, pl) => (s.players.home.indexOf(pl) >= 0 ? "home" : "away");
const meBump = (out, key, side) => { (out[key] = out[key] || { home: 0, away: 0 })[side]++; };
// A PENALTY RESOLVES EXACTLY ONCE, whatever ends it. Scored, the goal path tags the shot record;
// everything else -- parried, gathered, dragged wide, off the frame, blocked, shanked out for a
// throw, or a stoppage beginning while the rebound is loose -- funnels through here on its way to
// clearing mp.shot. Without the funnel a penalty whose ball died quietly simply evaporated: taken
// twenty-three times, resolved twenty-one.
// ONE CARRY IS ONE RUN. Both carry paths used to bump the counter on every quarter-second slice
// the man kept running, so a single burst down the wing arrived in the report as thirty carries
// and a match totted up seven hundred. An episode opens when a man starts running with it and
// closes when the ball leaves him -- meKickedBy for a deliberate release, meBallTo for any fresh
// claim -- so holding it longer no longer manufactures statistics.
const meCarry = (s, out, p) => {
  const mp = s.mePos, key = mp.side + ":" + mp.idx;
  if (mp._carryBy === key) return;
  mp._carryBy = key;
  out.carries++; meBump(out, "carriesSide", meSideOfP(s, p));
};
// `gk` is the keeper when his hands ended it, so the report can say who saved it.
const mePenRes = (out, sh, mp, gk) => {
  if (!sh || sh._pd) return;
  sh._pd = 1;
  // A BIG CHANCE SPURNED. This function is reached by every ending a shot can have except the one
  // where it goes in -- saved, blocked, wide, off the frame, whistle -- so it is the honest place to
  // charge it, and the guard above means the several sites that call it twice only charge once.
  // Scaled by how good the chance was, because a tap-in missed is not a half-volley missed.
  let bigMiss = 0;
  if (sh.p && (sh.xg || 0) >= CFG.bigChanceXg) {
    bigMiss = CFG.rateBigMiss * Math.min(CFG.rateBigMissCap, (sh.xg || 0) / CFG.bigChanceXg);
    meRate(sh.p, -bigMiss);
  }
  if (!sh.pen) return;
  if (sh.p) meRate(sh.p, -CFG.ratePenMiss);
  const pmList = (out.penMiss = out.penMiss || { home: [], away: [] })[sh.side];
  pmList.push({ name: sh.name, full: sh.full || sh.name, min: out.min ?? 0, add: out.add || 0,
                saved: gk ? (gk.fullName || gk.name) : null });
  // A PARRIED PENALTY THAT STILL GOES IN WAS NEVER MISSED. It is logged here because the
  // keeper's hand ended the shot, and that it finished in the net is not known for several
  // slices yet -- so leave the trail the revocation needs instead of the entry standing beside
  // the goal it became. Same shape as mp._parry, which takes the save back for the same reason.
  sh._pm = { side: sh.side, i: pmList.length - 1, p: sh.p,
             back: (sh.p ? CFG.ratePenMiss : 0) + bigMiss };
  // The silent endings still get a line -- a defender collecting a weak penalty is a missed
  // penalty, and the feed should say so, not just the ledger. Sites that already emitted their own
  // penmiss event (the parry, the gather, the wide, the frame) resolve BEFORE their meEvt call
  // overwrites out.evt, so passing mp only from the genuinely wordless sites keeps one event per
  // penalty.
  if (mp) meEvt(out, "penmiss", sh.side, mp.bx, mp.by, mp.bx, mp.by,
                `${sh.full || sh.name} misses the penalty`);
};

// THE BOOKINGS, NAMED. out.yellows only counts them, and the feed that names them keeps its last
// 200 lines, so by full time a first-half caution has usually scrolled out of it. A second yellow
// is not listed here: it is a sending off, and meRed files it with the reason.
const meBook = (out, side, q) => {
  (out.bookings = out.bookings || { home: [], away: [] })[side].push(
    { name: q.name, full: q.fullName || q.name, min: out.min ?? 0, add: out.add || 0 });
};

// EVERY DISMISSAL GOES THROUGH HERE. There were three sites writing the flag, the counter, the
// ledger entry and the caption by hand, and they had already drifted once -- one said "is off" and
// one said "is sent off", which is how a time-wasting second yellow fell out of the feed. Two of
// them also forgot _offAt, so a man sent off in the twentieth minute was rated over ninety.
export function meRed(s, out, side, q, why, x, y) {
  q.rc = true; q.off = true; q.rcVariant = why;
  // Where he was when the card came out, so the app can walk him off from there. The park at
  // y = -6 still happens on this tick -- every engine read of an off player expects him there.
  q._offX = q.x; q._offY = q.y;
  q.y = -6; q.vx = 0; q.vy = 0; q._offAt = s.mePos.tick;
  (out.reds = out.reds || { home: 0, away: 0 })[side]++;
  meRoles(s, side);                                   // ten men: somebody else is the hub now
  // A MAN DOWN (manager.ts): unless he is behind and has to chase it, he goes to the most cautious style beside his own.
  if (s.managers) {
    const to = meTenMenStyle(s, side, (out.goals?.[side] || 0) - (out.goals?.[meOther(side)] || 0) + (s.aggLead?.[side] || 0));
    if (to) {
      const from = s.styles[side]; meSetStyle(s, side, to);
      const L = (out.mgrLog = out.mgrLog || { home: [], away: [] })[side];
      if (L.length < 40) L.push({ min: meMinute(s.mePos.tick), k: "switch", t: `Down to ten: ${ME_STYLE_NAME[from] || from} set aside for ${ME_STYLE_NAME[to] || to}` });
    }
  }
  (out.sendOff = out.sendOff || { home: [], away: [] })[side].push(
    { name: q.name, full: q.fullName || q.name, min: out.min ?? 0, add: out.add || 0, second: why === "second", why });
  meEvt(out, "red", side, x, y, x, y,
        `${q.fullName || q.name} is sent off, ${ME_RED_SAID[why] || "serious foul play"}`, { why });
}

// A defensive act is worth the danger it extinguished: base pay in safe space, up to
// (1 + rateDefDanger) of it on the six-yard line. `side` is the DEFENDER's side; the danger read
// is the attack he stopped.
const meDefPay = (s, side, x, y, base) =>
  base * (1 + CFG.rateDefDanger * Math.max(0, Math.min(1, meDanger(meOther(side), x, y) / 0.26)));
export function meTackle(s, rng, out) {
  const mp = s.mePos;
  if (mp.sp || mp.idx < 0) return;
  const atk = mp.side, def = meOther(atk);
  const c = s.players[atk]?.[mp.idx]; if (!c || c.off) return;
  // THE LAW: a keeper in control of the ball may not be challenged for it. Nothing here knew that
  // -- meTackle excluded a keeper from TACKLING and said nothing about tackling one, so a held
  // ball was harried and could be taken off his hands.
  if (mp.held && c.pos === "GK") return;
  const us = s.players[def], dir = meDir(def);
  for (let i = 0; i < us.length; i++) {
    const p = us[i];
    if (!p || p.off || p.pos === "GK") continue;
    if (p._tkCool > 0) { p._tkCool--; continue; }
    if (p._duty !== "press" || p._beat > 0) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d > CFG.tkRange) continue;
    const cv = Math.hypot(c.vx || 0, c.vy || 0) / ME_DT;
    // Hoisted out of the angle sum below, unchanged, because it is also the question "is there
    // anybody behind me" -- which is what makes a tackle a last-man tackle.
    const covered = us.some((q, j) => j !== i && q && !q.off && q.pos !== "GK" && (c.x - q.x) * dir > 0
                  && Math.hypot(q.x - c.x, q.y - c.y) < CFG.tkCoverR);
    const angle = Math.min(1,
        Math.max(0, 1 - d / CFG.tkRange) * CFG.tkwNear
      + ((c.x - p.x) * dir > 0 ? CFG.tkwSide : 0)
      + Math.max(0, 1 - cv / 7) * CFG.tkwSlow
      + (Math.min(c.y, PITCH_W - c.y) < CFG.tkEdge ? CFG.tkwEdge : 0)
      + (covered ? CFG.tkwCover : 0));
    const a = meAttrs(p);
    const go = CFG.tkGo - (a.tackle - 60) / 99 * CFG.tkGoSkill
                        - (((s.strategy?.[def]?.tackling || 0) + (p._ci?.tackling || 0)) * CFG.tkGoInstr)
                        // A booked man jockeys. He wants a better angle than he would have settled
                        // for before, which costs his side tackles -- and that is the handicap.
                        + ((p.yc || 0) ? CFG.tkGoBooked : 0)
                        // The second brain's first presser out of a recovering side is DELAYING him.
                        + (s.brain === 2 && p._delay ? 0.12 : 0);
    if (angle < go) continue;
    out.tackleTry = (out.tackleTry || 0) + 1; meBump(out, "tackleTrySide", def);
    p._tkCool = CFG.tkCool;
    const win = rng.u() < Math.min(0.92, Math.max(0.05,
      CFG.tkBase + angle * CFG.tkAngleW + ((a.tackle - meAttrs(c).pace) / 99 - CFG.tkSkillMid) * CFG.tkSkillW));
    if (win) {
      // out.tackles is ALSO incremented by the keeper-save path below, which is the bug that made
      // the app print saves under the word tackles. Kept for compatibility, but the honest count of
      // tackles WON is its own field.
      out.tackles++; meBump(out, "tacklesSide", meSideOfP(s, p));
      out.tackleWon = (out.tackleWon || 0) + 1; meBump(out, "tackleWonSide", def);
      if (globalThis.__rx) globalThis.__rx.tackle = (globalThis.__rx.tackle || 0) + 1;
      // Nobody behind him and it mattered where he did it: that is the tackle a defender is for.
      const lastMan = !covered && Math.abs(meGoalX(atk) - c.x) < CFG.tkLastManR;
      meRate(p, meDefPay(s, def, c.x, c.y, CFG.rateTackle) + CFG.rateDuelWon + (lastMan ? CFG.rateLastMan : 0));
      p.defActs = (p.defActs || 0) + 1; p.duelWon = (p.duelWon || 0) + 1;
      // ...and the man he took it off lost it.
      meRate(c, -CFG.rateDuelLost); c.duelLost = (c.duelLost || 0) + 1;
      // A tackle is not a pass to yourself. Most wins POKE the ball loose -- see the derivation at
      // CFG.tkLooseP -- and the fifty-fifty that follows is resolved by the same pickup physics as
      // any other loose ball. The clean minority below keeps the old behaviour.
      if (rng.u() < CFG.tkLooseP) {
        mp.lastSide = def; meKickedBy(mp, def, i, true);
        mp._loose = mp.tick; mp._looseWhy = "tackle";
        meKnock(mp, rng, mp.bx + (rng.u() - 0.5) * CFG.tkLooseD * 2,
                         mp.by + (rng.u() - 0.5) * CFG.tkLooseD * 2, CFG.tkLooseV, 0);
        // ...AND IT IS NOBODY'S NOW. The knock left mp.idx on the man who had just been tackled, so he
        // was still "in possession" of a ball rolling away from him -- he could pass or shoot it in
        // the same slice, and the next touch was his by default.
        mp.idx = -1; mp.flight = false; mp.passPending = null;
      } else {
        meKickedBy(mp, def, i); meBallTo(s, def, i, mp.bx, mp.by);
      }
      meEvt(out, "tackle", def, p.x, p.y, c.x, c.y, `${p.fullName || p.name} wins it off ${c.fullName || c.name}`);
    } else {
      p._beat = CFG.tkBeatT;
      out.beaten = (out.beaten || 0) + 1;
      // He went past him. Worth something to the carrier and something off the man he left.
      meRate(c, CFG.rateDribble); c.dribbles = (c.dribbles || 0) + 1;
      meRate(p, -CFG.rateBeaten); p.beaten = (p.beaten || 0) + 1;
      // A failed tackle is not news -- it happens dozens of times a match and reads as a man
      // being praised for beating somebody who barely engaged him. Still drawn on the pitch.
      meEvt(out, "tackle", atk, p.x, p.y, c.x, c.y, null);
    }
    return;                                   // one challenge a slice, not a scrum
  }
}

// THE SECOND BRAIN'S CHALLENGE, settled with the first brain's bookkeeping: a tackle won is credited and
// rated exactly as meTackle credits one, a man beaten is charged as meTackle charges him, and a foul goes
// through meFoulCommit -- the same laws, cards and restarts. mind/duel.ts decides; this records.
function meDuelHooks(s, rng, out) {
  const mp = s.mePos;
  return {
    won: (p, i, c) => {
      const atk = mp.side, def = meOther(atk);
      out.tackles++; meBump(out, "tacklesSide", meSideOfP(s, p));
      out.tackleWon = (out.tackleWon || 0) + 1; meBump(out, "tackleWonSide", def);
      const covered = s.players[def].some(q => q && q !== p && !q.off && q.pos !== "GK" && (c.x - q.x) * meDir(def) > 0
                                          && Math.hypot(q.x - c.x, q.y - c.y) < CFG.tkCoverR);
      const lastMan = !covered && Math.abs(meGoalX(atk) - c.x) < CFG.tkLastManR;
      meRate(p, meDefPay(s, def, c.x, c.y, CFG.rateTackle) + CFG.rateDuelWon + (lastMan ? CFG.rateLastMan : 0));
      p.defActs = (p.defActs || 0) + 1; p.duelWon = (p.duelWon || 0) + 1;
      meRate(c, -CFG.rateDuelLost); c.duelLost = (c.duelLost || 0) + 1;
      if (rng.u() < CFG.tkLooseP) {
        mp.lastSide = def; meKickedBy(mp, def, i, true);
        mp._loose = mp.tick; mp._looseWhy = "tackle";
        // Poked away from the man who had it, the way the tackler came through it -- not anywhere at all.
        const ax = mp.bx - p.x, ay = mp.by - p.y, al = Math.hypot(ax, ay) || 1;
        const a = Math.atan2(ay / al, ax / al) + (rng.u() - 0.5) * 1.6;
        meKnock(mp, rng, mp.bx + Math.cos(a) * CFG.tkLooseD * 0.7, mp.by + Math.sin(a) * CFG.tkLooseD * 0.7, CFG.tkLooseV, 0);
        mp.idx = -1; mp.flight = false; mp.passPending = null;
      } else { meKickedBy(mp, def, i); meBallTo(s, def, i, mp.bx, mp.by); }
      meEvt(out, "tackle", def, p.x, p.y, c.x, c.y, `${p.fullName || p.name} wins it off ${c.fullName || c.name}`);
    },
    beaten: (p, c) => {
      const atk = mp.side;
      out.beaten = (out.beaten || 0) + 1;
      meRate(c, CFG.rateDribble); c.dribbles = (c.dribbles || 0) + 1;
      meRate(p, -CFG.rateBeaten); p.beaten = (p.beaten || 0) + 1;
      meEvt(out, "tackle", atk, p.x, p.y, c.x, c.y, null);
    },
    commit: (q, p, closeV) => {
      const side = mp.side;
      const inArea0 = Math.abs(p.x - meGoalX(side)) < CFG.gkBoxR && Math.abs(p.y - ME_HALF_W) < CFG.boxHalfW;
      const host = s.homeAdv === "home" || s.homeAdv === "away" ? s.homeAdv : null;
      const lean = host ? Math.max(-1, ME_HOME_ADV.ref * ME_HOME_ADV.k * (meOther(side) === host ? -1 : 1)) : 0;
      meFoulCommit(s, rng, out, side, p, q, closeV, inArea0, lean);
    },
  };
}

// A SPECIFIC position folded to the unit he plays in. Full-backs contest each other, wingers
// contest each other; a lone striker has no peers and gets no role. Falls back on the band when a
// sheet carries no specific position.
const ROLE_BAND = { GK: "GK", CB: "CB", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", DM: "DM",
                    CM: "CM", LM: "CM", RM: "CM", AM: "AM", LW: "W", RW: "W", ST: "ST" };
const roleBandOf = (p) => ROLE_BAND[(p.spos || "").split("/")[0]]
                       || ({ DEF: "CB", MID: "CM", FWD: "ST", GK: "GK" })[p.pos] || "CM";
const roleClamp01 = (x) => Math.max(0, Math.min(1, x));

// WHO PLAYS THROUGH WHOM, TODAY. Called at kickoff, after every substitution and after every red
// card, on the men who are actually on the pitch -- the hub used to be named once in meInit and
// left there, so a side whose hub went off at seventy played the last twenty minutes through
// nobody at all.
//
// THE HUB is the formula it always was, on form-perturbed rating: the best midfielder, scaled by
// how good he is (abs01) and how clear of his own midfield he is (rel01). With form in the OVR the
// argmax is contested -- a peer 2.4 compressed points behind overtakes about one match in five at
// roleFormSd 2, three peers at that gap leave the best man leading roughly three in five, and a
// 90 among 80s still leads better than nineteen in twenty. The strength varies with the win: a
// narrow win is a weak hub, a rout is a strong one. E[_pmk] is what it was, so nothing calibrated
// against it moves in expectation.
//
// THE ROLE is new and covers every unit: within his band, how far a man's form-perturbed rating
// sits from the band mean, in [-1, 1], centred so the band sums to zero. It feeds only zero-sum
// choices -- which receiver a passer prefers, who gets a run slot first -- because a term that
// scales an objective is a buff and the best full-back running more must mean the other running
// less, not the side running more. See roleRecvW and the run order in brain.ts.
export function meRoles(s, side) {
  const ps = s.players[side] || [];
  const live = ps.filter(q => q && !q.off);
  // ON THE LISTED RATING. p.ovr carries the drill nudge and moves during the
  // match; ovr0 is the sheet. Keying roles off p.ovr made the hub depend on WHEN meRoles last ran
  // -- a midfielder a fraction under the floor at the last substitution was a fraction over it at
  // full time, and the side finished with nobody named. The sheet does not move.
  const o = (q) => meOvr({ ovr: q.ovr0 ?? q.ovr }) + (q._form || 0);
  for (const q of ps) if (q) { q._pmk = 0; q._role = 0; }
  const out2 = live.filter(q => q.pos !== "GK");
  const mids = out2.filter(q => q.pos === "MID");
  const cands = mids.length ? mids : out2;
  let best = null;
  for (const q of cands) if (!best || o(q) > o(best)) best = q;
  if (best && out2.length > 1) {
    const peers = cands.filter(q => q !== best);
    const rest = peers.length ? peers : out2.filter(q => q !== best);
    const restMean = rest.reduce((t, q) => t + o(q), 0) / rest.length;
    const abs01 = roleClamp01((o(best) - CFG.pmkAbsLo) / CFG.pmkAbsSpan);
    const rel01 = roleClamp01((o(best) - restMean) / CFG.pmkRelFull);
    best._pmk = abs01 * (CFG.pmkRelLo + rel01 * (1 - CFG.pmkRelLo));
  }
  const bands = new Map();
  for (const q of live) { const b = roleBandOf(q); if (!bands.has(b)) bands.set(b, []); bands.get(b).push(q); }
  for (const g of bands.values()) {
    if (g.length < 2) continue;
    const m = g.reduce((t, q) => t + o(q), 0) / g.length;
    // Bounded by SCALING THE BAND, not by clipping the man: a clamp on one end leaves the unit
    // summing to something, and a unit that sums positive has been buffed. Dividing everyone by
    // the largest deviation keeps the sum at exactly zero and the ratios intact.
    const dev = g.map(q => (o(q) - m) / CFG.roleSpan);
    const top = Math.max(1, ...dev.map(Math.abs));
    g.forEach((q, i) => { q._role = dev[i] / top; });
  }
}

export function meSub(s, side, outIdx, benchIdx, out) {
  const ps = s.players[side], bench = s.bench?.[side];
  const gone = ps[outIdx], inn = bench && bench[benchIdx];
  if (!gone || !inn) return false;
  // He takes over the outgoing man's place in the shape, not a fresh one off the formation.
  for (const k of ["_bd", "_bw", "_bd0", "_bw0", "_mind", "_bsx", "_bsy", "_tx", "_ty", "x", "y"])
    inn[k] = gone[k];
  inn.vx = 0; inn.vy = 0; inn._att = null;          // his own attributes, recomputed on first use
  inn._duty = "hold"; inn._mk = -1; inn._mkPrev = -1;
  inn._runT = 0; inn._run = null; inn._cool = 0; inn._cut = 0;
  inn._track = false; inn._closing = false; inn._avgV = 0;
  inn.knock = 0; inn.off = false; inn.inj = false; inn.rc = false;
  inn.injSev = undefined; inn.injPart = undefined; inn.rcVariant = undefined; inn.inGoal = false;
  if (inn.stamina === undefined) inn.stamina = 100;
  // Minutes played, for the shrink in meFinalise. Without it a substitute who came on for the last
  // five and touched nothing is rated as confidently as a man who played the whole match.
  gone._offAt = s.mePos.tick; inn._onAt = s.mePos.tick;
  ps[outIdx] = inn; bench[benchIdx] = null;
  s.subs = s.subs || { home: 0, away: 0 }; s.subs[side]++;
  (s.subbedOff = s.subbedOff || { home: [], away: [] })[side].push(gone);
  if (out) meEvt(out, "sub", side, inn.x, inn.y, inn.x, inn.y, `${inn.fullName || inn.name} on for ${gone.fullName || gone.name}`);
  meRoles(s, side);                                   // the hub and every unit, on who is out there now
  return true;
}

// WHO COMES OFF, AND WHEN. A man who cannot continue is replaced whatever the clock says; after
// that it is the tired legs, and only once there is enough of a match left for it to be worth a
// change. A keeper is only ever replaced by a keeper.
export function meAutoSubs(s, side, out) {
  const cap = (s.subCap && s.subCap[side]) ?? CFG.subCap;
  s.subs = s.subs || { home: 0, away: 0 };
  const bench = s.bench?.[side]; if (!bench) return;
  for (let guard = 0; guard < 3 && s.subs[side] < cap; guard++) {
    const ps = s.players[side];
    let pick = -1, worst = Infinity, forced = false;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i]; if (!q) continue;
      if (q.off && q.inj) { pick = i; forced = true; break; }      // cannot continue
      if (q.off) continue;                                          // sent off: nobody replaces him
      if (s.mePos.tick < CFG.subFromTick) continue;
      // A booking is read here the way a knock is: not a reason on its own, but it moves a man up
      // the list, and a tiring player already on a yellow is the first one a manager protects.
      const tired = (q.stamina ?? 100) - (q.knock > 0 ? CFG.subKnockBias : 0)
                                       - ((q.yc || 0) ? CFG.subBooked : 0);
      if (tired < CFG.subStamina && tired < worst) { worst = tired; pick = i; }
    }
    if (pick < 0) return;
    const need = s.players[side][pick].pos;
    let bi = -1, bv = -Infinity;
    for (let j = 0; j < bench.length; j++) {
      const b = bench[j]; if (!b) continue;
      if (need === "GK" && b.pos !== "GK") continue;                // only a keeper goes in goal
      if (need !== "GK" && b.pos === "GK") continue;
      const v = (b.ovr ?? 65) + (b.pos === need ? CFG.subSamePos : 0);
      if (v > bv) { bv = v; bi = j; }
    }
    if (bi < 0) return;                                             // nobody suitable on the bench
    if (!meSub(s, side, pick, bi, out)) return;
    if (!forced) return;                                            // one tactical change at a time
  }
}

// THE SECOND BRAIN'S BENCH. The same mechanics as meAutoSubs -- an injury is replaced at once, a keeper
// only by a keeper, one tactical change a stoppage -- with the manager in it. A good one replaces tired
// legs sooner (his line is higher) and reads the scoreline: chasing late he sends on the most attacking
// man who can play the position, protecting a lead the most defensive. A poor one waits for the legs to
// go and picks on rating alone.
export function meCoachSubs(s, side, out) {
  const cap = (s.subCap && s.subCap[side]) ?? CFG.subCap;
  s.subs = s.subs || { home: 0, away: 0 };
  const bench = s.bench?.[side]; if (!bench) return;
  const g = Math.max(0, Math.min(1, ((s.mgmt?.[side] ?? ME_MGR.mgmtDef) - 40) / 50));
  const lead = (s.mePos.goals?.[side] ?? 0) - (s.mePos.goals?.[meOther(side)] ?? 0);
  const late = s.mePos.tick >= CFG.subFromTick * 1.35;
  const want = late && lead < 0 ? 1 : late && lead > 0 ? -1 : 0;     // chase, protect, or neither
  const line = CFG.subStamina + (g - 0.4) * 10;                      // 70 for a poor coach, 80 for the best
  for (let guard = 0; guard < 3 && s.subs[side] < cap; guard++) {
    const ps = s.players[side];
    let pick = -1, worst = Infinity, forced = false;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i]; if (!q) continue;
      if (q.off && q.inj) { pick = i; forced = true; break; }
      if (q.off) continue;
      if (s.mePos.tick < CFG.subFromTick * (1.15 - 0.3 * g)) continue;
      let tired = (q.stamina ?? 100) - (q.knock > 0 ? CFG.subKnockBias : 0) - ((q.yc || 0) ? CFG.subBooked : 0);
      // Chasing, a defensive man is the one to give up; protecting, an attacking one.
      if (want > 0 && (q._role2?.rest ?? 0) >= 0.7 && q.pos !== "GK") tired -= 8 * g;
      if (want < 0 && q.pos === "FWD") tired -= 8 * g;
      if (tired < line && tired < worst) { worst = tired; pick = i; }
    }
    if (pick < 0) return;
    const out0 = s.players[side][pick], need = out0.pos;
    let bi = -1, bv = -Infinity;
    for (let j = 0; j < bench.length; j++) {
      const b = bench[j]; if (!b) continue;
      if (need === "GK" && b.pos !== "GK") continue;
      if (need !== "GK" && b.pos === "GK") continue;
      let v = (b.ovr ?? 65) + (b.pos === need ? CFG.subSamePos : 0);
      // The game he is in decides which kind of man comes on, as much as the coach can read it.
      if (want > 0) v += ((b.pos === "FWD" ? 6 : b.pos === "MID" ? 2 : -4)) * g;
      if (want < 0) v += ((b.pos === "DEF" ? 6 : b.pos === "MID" ? 3 : -5)) * g;
      if (v > bv) { bv = v; bi = j; }
    }
    if (bi < 0) return;
    if (!meSub(s, side, pick, bi, out)) return;
    if (out?.mgrLog && !forced) {
      const L = out.mgrLog[side] = out.mgrLog[side] || [];
      if (L.length < 40) L.push({ min: out.min ?? 0, k: "sub", t: want > 0 ? "Chasing it: fresh legs further forward" : want < 0 ? "Seeing it out: fresh legs at the back" : "Fresh legs" });
    }
    if (!forced) return;
  }
}

// ── NOBODY IN GOAL ──────────────────────────────────────────────────────────────────────────
// The keeper has been sent off or carried off, and that is not a substitution like any other.
// Carried off, the reserve simply takes his place. SENT off, nobody replaces him at all -- so a
// team-mate has to come off to let the reserve on, and the side finishes with ten and a bench one
// change shorter. And if there is no reserve, or no changes left, somebody pulls the gloves on.
// Nothing here ever handled any of it: a dismissed keeper left the goal empty for the rest of the
// match, because his side kept a man labelled GK who happened to be standing on the touchline.
export function meKeeperCrisis(s, side, out) {
  const ps = s.players[side];
  if (meKeeperIx(ps) >= 0) return;                              // somebody is in it
  const gone = ps.find(p => p && p.pos === "GK" && p.off) || null;
  const bench = s.bench?.[side] || [];
  const cap = (s.subCap && s.subCap[side]) ?? CFG.subCap;
  s.subs = s.subs || { home: 0, away: 0 };
  const bj = bench.findIndex(b => b && b.pos === "GK");

  if (bj >= 0 && s.subs[side] < cap) {
    // Who makes way. An injured keeper makes way for himself; a sent-off one cannot, so the weakest
    // man still on the pitch is sacrificed for him -- which is what a manager actually does.
    let oi = -1;
    if (gone && gone.inj) oi = ps.indexOf(gone);
    else { let worst = Infinity;
      for (let i = 0; i < ps.length; i++) { const q = ps[i];
        if (!q || q.off || q.pos === "GK") continue;
        if ((q.ovr ?? 65) < worst) { worst = q.ovr ?? 65; oi = i; } } }
    if (oi >= 0 && meSub(s, side, oi, bj, out)) {
      // He came on into somebody else's place in the shape. Put him in the one he is here for, or
      // he keeps goal from wherever the man he replaced happened to be standing.
      const gk = ps[oi];
      if (gone) for (const k of ["_bd", "_bw", "_bd0", "_bw0", "_mind", "_bsx", "_bsy", "_tx", "_ty", "x", "y"])
        gk[k] = gone[k];
      gk._duty = "gk"; gk._att = null;
      return;
    }
  }

  // AN OUTFIELD PLAYER GOES IN. The man standing nearest his own goal, which is a centre-half, the
  // way it always is. He is HALF the player he was and the number says so: being good at football
  // is not being good at goalkeeping, and the engine reads his rating for reflexes it will not
  // find. His real OVR is untouched on ovr0 -- the competition still knows who he is.
  let pi = -1, deep = Infinity;
  for (let i = 0; i < ps.length; i++) {
    const q = ps[i]; if (!q || q.off || q.pos === "GK") continue;
    const d = q._bd0 ?? q._bd ?? 99;
    if (d < deep) { deep = d; pi = i; }
  }
  if (pi < 0) return;
  const p = ps[pi];
  p.pos = "GK"; p.inGoal = true;
  p.ovr = Math.max(1, Math.round((p.ovr0 ?? p.ovr ?? 70) / 2));
  p._att = null; p._duty = "gk";
  if (gone) for (const k of ["_bd", "_bw", "_bd0", "_bw0", "_mind"]) p[k] = gone[k];
  meEvt(out, "gloves", side, p.x, p.y, p.x, p.y,
        `${p.fullName || p.name} goes in goal`, { inGoal: true });
}

// THE SHOOTOUT, IN PIECES. It used to be one function that ran every kick to its conclusion inside
// a single call, which is correct and unwatchable: by the time control came back the thing was over.
// Split so a caller can take it one kick, or one tick, at a time. meShootout below is still the
// whole thing in one call and still produces the identical sequence of ticks, so nothing headless
// notices; the live match drives the same pieces itself and gets to show them.

// THE ROTA. Five different men, best takers first, and if it goes the distance everybody kicks
// before anybody kicks twice -- the keeper going last of all, which is the law's own order of
// desperation. Built once from whoever is still on the pitch at the whistle.
export function mePkInit(s) {
  const rota = {};
  for (const sd of ME_SIDES) {
    const ps = s.players[sd];
    const idx = ps.map((q, i) => i).filter(i => !ps[i].off);
    idx.sort((a, b) => (ps[a].pos === "GK") - (ps[b].pos === "GK")
                     || meAttrs(ps[b]).shoot - meAttrs(ps[a]).shoot);
    rota[sd] = idx;
  }
  return { sc: { home: 0, away: 0 }, taken: { home: 0, away: 0 },
           order: ["home", "away"], rota, k: 0 };
}

// Whose turn it is, or null once the shootout is decided.
export function mePkNext(pk, maxKicks) {
  if (pk.k >= (maxKicks || 40)) return null;
  const side = pk.order[pk.k % 2], other = meOther(side);
  // Sudden death is a kick each, always: it can only end on level kicks. Computing "kicks left"
  // as 5-minus-taken here made any deficit read as unwinnable and ended rounds after the FIRST
  // kick, with the reply still owed.
  if (pk.taken.home >= 5 && pk.taken.away >= 5)
    return pk.taken.home === pk.taken.away && pk.sc.home !== pk.sc.away ? null : side;
  // Best of five: over as soon as the trailing side cannot catch up with what it has in hand.
  const left = (sd) => Math.max(0, 5 - pk.taken[sd]);
  if (pk.sc[side] + left(side) < pk.sc[other] && pk.taken[other] >= pk.taken[side]) return null;
  if (pk.sc[other] + left(other) < pk.sc[side] && pk.taken[side] > pk.taken[other]) return null;
  return side;
}

// Who is about to take it, so a caller can name him before he has.
export function mePkTaker(s, pk, side) {
  const r = pk.rota[side];
  return r && r.length ? s.players[side][r[pk.taken[side] % r.length]] : null;
}

// WHERE EVERYONE STANDS. Both teams wait in the centre circle and only three men leave it: the
// taker, and a goalkeeper at each end. That is what a shootout looks like, and it is also the fix
// for the old arrangement -- a diagonal smear across the halfway line that meant twenty players
// spent every kick jogging toward a penalty-arc they would never reach before it was struck.
export function mePkLineUp(s, pk, side) {
  for (const sd of ME_SIDES) {
    const ps = s.players[sd], dir = meDir(sd);
    const wait = [];
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i];
      q.vx = 0; q.vy = 0; q._cut = 0; q.knock = 0; q._runT = 0;
      // Both keepers go to their own line: one is about to be worked, and the other has nowhere
      // else to be that reads as football.
      if (q.pos === "GK") { q.x = meGoalX(meOther(sd)) + dir * 0.3; q.y = ME_HALF_W; }
      else wait.push(q);
    }
    // A line inside their own half, shoulder to shoulder, centred on the spot.
    const n = wait.length, x = PITCH_L / 2 - dir * 6.5;
    wait.forEach((q, i) => { q.x = x; q.y = ME_HALF_W + (i - (n - 1) / 2) * 3.6; });
  }
}

// Open one kick: ball on the spot, taker nominated, set piece begun.
export function mePkSetup(s, out, pk, side) {
  const mp = s.mePos;
  pk.g0 = out.goals[side]; pk.s0 = out.shots[side];
  pk.sc0 = out.scorers?.[side]?.length ?? 0; pk.pm0 = out.penMiss?.[side]?.length ?? 0;
  pk.sv0 = out.saves.home + out.saves.away; pk.w0 = out.woodwork;
  // A SHOOTOUT IS NOT PART OF THE MATCH -- all of it, not just the scoreline. Goals and shots were
  // already put back; the rest of what one kick can touch is snapshotted here and put back in
  // mePkTally: the team's saves, on-target, woodwork and xG, and the two actors' own goals, saves
  // and ratings. A keeper does not climb the ratings in the shootout, and a taker does not fall.
  // BOTH SIDES, ALWAYS. A kick's timeout can declare it over while the shot's bookkeeping is
  // still in flight, so a miss from home's kick can land in the ledger DURING away's kick -- and a
  // one-sided scrub of away's list left it standing. Every counter here is restored for both
  // sides on every kick, so a stale write from the previous kick is cleaned by the next.
  pk.r0 = { gH: out.goals.home, gA: out.goals.away, shH: out.shots.home, shA: out.shots.away,
            scH: out.scorers?.home?.length ?? 0, scA: out.scorers?.away?.length ?? 0,
            pmH: out.penMiss?.home?.length ?? 0, pmA: out.penMiss?.away?.length ?? 0,
            otH: out.onTarget.home, otA: out.onTarget.away,
            svH: out.saves.home, svA: out.saves.away,
            ww: out.woodwork, wwH: out.woodworkSide?.home ?? 0, wwA: out.woodworkSide?.away ?? 0,
            xg: out.xg, xgH: out.xgS?.home ?? 0, xgA: out.xgS?.away ?? 0,
            sdv: out.shotDist ? [...out.shotDist] : null, i0: out.inplay };
  // EVERY player, not just the two actors: the per-tick positional rating runs during shootout
  // ticks like any others, so the whole squad's ratings were drifting a quarter-point across ten
  // kicks. And inplay, or the shootout counts as playing time.
  pk.p0 = [];
  for (const sd of ME_SIDES) for (const q of s.players[sd])
    pk.p0.push({ q, goals: q.goals || 0, saves: q.saves || 0, rating: q.rating ?? 6.5, rr: q._rr });
  pk.struck = -1; pk.t = 0; pk.how = "wide";
  mePkLineUp(s, pk, side);
  mp.bx = meGoalX(side) - meDir(side) * 11; mp.by = ME_HALF_W;
  // The same pre-kick a penalty in open play gets. At 40 the sequence was a third as long, and a
  // keeper who has just been placed from a standstill is still a 0.39 m disc when it is struck --
  // his capsule only opens with speed.
  if (pk.rota[side].length) mp._penTaker = pk.rota[side][pk.taken[side] % pk.rota[side].length];
  mp._pk = 1;                                   // this kick is a shootout kick; see spPenReadPk
  meDead(s, "penalty", side, mp._pk ? CFG.spPenTicksPk : 470, out);
}

// ONE ATTEMPT. A shootout kick is dead the moment the keeper touches it or it misses -- there is
// no rebound and no second bite, which is a rule and not a physical fact. Letting it play on for a
// dozen slices meant a parry rolled into an empty box and trickled in unopposed: 88.8% converted
// against 74.7% for the identical kick in a match.
// Returns null while the kick is still live, or how it ended.
export function mePkTick(s, rng, out, pk, side) {
  const mp = s.mePos;
  const wasSp = !!mp.sp;
  meTick(s, rng, out);
  if (wasSp && !mp.sp) pk.struck = pk.t;
  const t = pk.t++;
  if (pk.struck < 0) return t >= 219 ? (pk.how = "untaken") : null;
  if (out.goals[side] > pk.g0) return (pk.how = "scored");
  if (out.saves.home + out.saves.away > pk.sv0) return (pk.how = "saved");
  if (out.woodwork > pk.w0) return (pk.how = "post");
  if (t - pk.struck > 12) return (pk.how = "wide");
  return t >= 219 ? (pk.how = "wide") : null;
}

// Tally it, and scrub it back out of the match's own records.
export function mePkTally(s, out, pk, side) {
  const mp = s.mePos;
  const tk = mePkTaker(s, pk, side);
  pk.taken[side]++;
  // A shootout is not part of the match: neither its goals nor its kicks belong in the scoreline.
  // Read whether it scored BEFORE putting the counter back, or the answer is always no.
  const scored = pk.how === "scored";
  if (scored) pk.sc[side]++;
  out.goals[side] = pk.g0; out.shots[side] = pk.s0;
  // ...nor in the match's own records. The scorer list is truncated for the same reason the two
  // counters above are: a converted kick was otherwise leaking into the report as a 120th-minute
  // goal, and the miss funnel would leak the failures the same way.
  if (out.scorers?.[side]) out.scorers[side].length = pk.sc0;
  if (out.penMiss?.[side]) out.penMiss[side].length = pk.pm0;
  if (pk.r0) {
    out.goals.home = pk.r0.gH; out.goals.away = pk.r0.gA;
    out.shots.home = pk.r0.shH; out.shots.away = pk.r0.shA;
    if (out.scorers?.home) out.scorers.home.length = pk.r0.scH;
    if (out.scorers?.away) out.scorers.away.length = pk.r0.scA;
    if (out.penMiss?.home) out.penMiss.home.length = pk.r0.pmH;
    if (out.penMiss?.away) out.penMiss.away.length = pk.r0.pmA;
    out.onTarget.home = pk.r0.otH; out.onTarget.away = pk.r0.otA;
    out.saves.home = pk.r0.svH; out.saves.away = pk.r0.svA;
    out.woodwork = pk.r0.ww;
    if (out.woodworkSide) { out.woodworkSide.home = pk.r0.wwH; out.woodworkSide.away = pk.r0.wwA; }
    out.xg = pk.r0.xg;
    if (out.xgS) { out.xgS.home = pk.r0.xgH; out.xgS.away = pk.r0.xgA; }
    if (pk.r0.sdv && out.shotDist) for (let i = 0; i < out.shotDist.length; i++) out.shotDist[i] = pk.r0.sdv[i] ?? 0;
    out.inplay = pk.r0.i0;
  }
  for (const s0 of pk.p0 || []) { s0.q.goals = s0.goals; s0.q.saves = s0.saves; s0.q.rating = s0.rating; s0.q._rr = s0.rr; }
  // ...and because both lists are truncated, the kicks had no record anywhere except the aggregate
  // score. Kept here instead, so the shootout can be reported as a shootout.
  (out.pens = out.pens || []).push({ side, n: pk.taken[side], scored, how: pk.how,
    name: tk ? tk.name : "", full: tk ? (tk.fullName || tk.name) : "",
    sc: { home: pk.sc.home, away: pk.sc.away } });
  mp.sp = null; mp.idx = -1; mp.flight = false; mp.shot = null; mp._pk = 0;
  pk.k++;
}

export function mePkResult(pk) {
  return { home: pk.sc.home, away: pk.sc.away, kicks: pk.taken.home + pk.taken.away,
           winner: pk.sc.home === pk.sc.away ? null : (pk.sc.home > pk.sc.away ? "home" : "away") };
}

export function meShootout(s, rng, out, maxKicks) {
  const pk = mePkInit(s);
  for (;;) {
    const side = mePkNext(pk, maxKicks);
    if (!side) break;
    mePkSetup(s, out, pk, side);
    while (!mePkTick(s, rng, out, pk, side)) { /* one attempt, then it is dead */ }
    mePkTally(s, out, pk, side);
  }
  return mePkResult(pk);
}

// Once a football minute, per side: read the scoreline, the clock and what the fixture is worth, and
// decide whether to go and get it or see it out. The intent is recomputed from scratch every time
// rather than nudged, so it cannot drift, and the instructions then SLEW toward it -- a manager
// changes a game over a few minutes, not between two ticks, and a side that equalises walks its
// shape back rather than snapping into it.
//
// Sits on top of the kickoff baseline, which is already fit-damped. Chasing a game is a call the
// manager makes, not a claim that the squad suits the system, so squad fit has no business damping
// it: the same reasoning that keeps time-wasting and GK distribution out of meStrategyFor.
//
// Extra time reads as nought minutes left for its whole half hour, because meMinute clamps at 90.
// That is close enough to right to leave alone: everybody is committed in extra time, and a side in
// front is protecting from the moment it goes in front.
function meChase(s, out) {
  const mp = s.mePos;
  if (!ME_CHASE_W.on || mp.tick < ME_CHASE_W.fromTick
      || mp.tick % ME_CHASE_W.every || !mp.stratBase) return;
  const rem = 90 - meMinute(mp.tick);
  for (const side of ME_SIDES) {
    if (s.allowTacChange?.[side] === false) continue;
    const base = mp.stratBase[side], st = s.strategy?.[side];
    if (!base || !st) continue;
    const sp = s.plan?.[side]?.chase || ME_CHASE[s.styles?.[side]] || ME_CHASE.balanced;
    // In a second leg it is the aggregate that matters (s.aggLead, carried in from the first leg).
    const lead = (out.goals?.[side] || 0) - (out.goals?.[meOther(side)] || 0) + (s.aggLead?.[side] || 0);
    const urg = s.matchUrg?.[side] || 0, form = s.teamForm?.[side] || 0;
    let t = urg * ME_CHASE_W.urg + form * ME_CHASE_W.form;
    // How hard depends on the size of the deficit AND on how little time is left to fix it, which is
    // why it is a ramp rather than a threshold: one down with an hour to go is barely a change of
    // plan, one down with ten minutes is a different sport.
    //
    // bias is inside the branch, not outside it, because it is a lean on the REACTION and not a
    // second helping of the style. Added unconditionally it was a permanent offset on top of a
    // side's own stamp -- Park The Bus, bias -0.60, would have sat 0.27 of a step deeper than its
    // preset at nought-nought with an hour left, which is not a manager reacting to anything, it is
    // the style being applied twice. Level, with nothing at stake and no run behind them, both sides
    // now play exactly what they were set up to play, which is also what keeps this off the balance
    // table for every match that stays level.
    if (lead < 0) { const rA = rem - sp.as; t += sp.bias - lead * 0.35 + Math.max(0, Math.min(1, (50 - rA) / 50)) * 1.40; }
    else if (lead > 0) { const rD = rem - sp.ds; t += sp.bias - lead * 0.20 - Math.max(0, Math.min(1, (40 - rD) / 40)) * 1.10; }
    // Nobody chases a game that has stopped mattering. A dead rubber can coast; it cannot go for it.
    if (urg < -0.2) t = Math.min(t, 1.0);
    t = Math.max(sp.floor, Math.min(sp.ceil, t));
    mp.chaseT[side] += (t - mp.chaseT[side]) * ME_CHASE_W.slew;
    // The touchline diary: what each manager is thinking, for the tactics tab to print.
    const mgrSay = (kind, txt) => {
      const L = (out.mgrLog = out.mgrLog || { home: [], away: [] })[side];
      if (L.length < 40) L.push({ min: meMinute(mp.tick), k: kind, t: txt });
    };
    // THE TALK. Once, as the second half opens: the manager retunes his side. See ME_MGR.
    if (ME_MGR.coach && !mp.coachHT?.[side] && meMinute(mp.tick) >= 45) {
      (mp.coachHT = mp.coachHT || {})[side] = true;
      const g = Math.max(0, Math.min(1, (s.mgmt?.[side] ?? ME_MGR.mgmtDef) / 99));
      const d = s.brain === 2 ? 0 : ME_MGR.htBase + ME_MGR.htSlope * g;
      if (d) for (const p of [...(s.players[side] || []), ...(s.bench?.[side] || [])]) {
        if (!p) continue;
        p.ovr = (p.ovr ?? 70) + d; p._att = null;
      }
      // The extreme situation: abandon the plan for the adjacent style. See ME_MGR.swAdj.
      const _oth = meOther(side);
      const _lead = (out.goals?.[side] || 0) - (out.goals?.[_oth] || 0) + (s.aggLead?.[side] || 0);
      const _xgd = (out.xgS?.[side] || 0) - (out.xgS?.[_oth] || 0);
      const _sh = 1 - ME_MGR.swMgmt * g;
      // With managers (manager.ts) he reads it: the style beside his own that does best against what they are playing.
      const _target = s.managers ? meChaseStyle(s, side, s.mgrKey ?? 0) : ME_MGR.swAdj[s.styles?.[side]];
      if (_target && (_lead <= -2
          || (_lead <= -1 && _xgd <= -ME_MGR.sw1Xg * _sh))) {
        const _from = s.styles?.[side];
        meSetStyle(s, side, _target);
        mgrSay("switch", (ME_STYLE_NAME[_from] || _from) + " abandoned for " + (ME_STYLE_NAME[_target] || _target));
      } else if (s.brain !== 2) mgrSay("talk", "Whole squad sharper for the second half; plan unchanged");
    }
    // The flow read. See ME_MGR in config: an EWMA of the xG this side is conceding minus
    // creating decides whether the manager steps in at all, MGMT decides how small a deficit he
    // acts on and how fast his change walks on, and where the side holds the ball picks which of
    // the two answers he reaches for. The offsets compose with the chase in the same write below.
    if (ME_MGR.on) {
      const mg = (mp.mgr = mp.mgr || { home: { flow: 0, mode: 0, kind: 0, lastF: 0, lastA: 0 },
                                       away: { flow: 0, mode: 0, kind: 0, lastF: 0, lastA: 0 } })[side];
      const xf = out.xgS?.[side] ?? 0, xa = out.xgS?.[meOther(side)] ?? 0;
      mg.flow = mg.flow * ME_MGR.decay + ((xa - mg.lastA) - (xf - mg.lastF));
      mg.lastF = xf; mg.lastA = xa;
      const mgmt = Math.max(0, Math.min(1, (s.mgmt?.[side] ?? ME_MGR.mgmtDef) / 99));
      const tau = ME_MGR.tauDull + (ME_MGR.tauSharp - ME_MGR.tauDull) * mgmt;
      const slew = ME_MGR.slewDull + (ME_MGR.slewSharp - ME_MGR.slewDull) * mgmt;
      const want = mg.flow > tau ? 1 : mg.flow < tau * ME_MGR.off ? 0 : mg.mode > 0.5 ? 1 : 0;
      if (want && mg.mode <= 0.02) {
        const meanX = (out.poss?.[side] || 0) > 200 ? (out.possX?.[side] || 0) / out.poss[side] : 50;
        mg.kind = meanX < ME_MGR.pinBelow ? 0 : 1;
      }
      const _wasOn = mg.mode > 0.5;
      mg.mode += (want - mg.mode) * slew;
      if (!_wasOn && mg.mode > 0.5) {
        // Compose THIS railing's orders from what is failing right now. Each diagnostic offers
        // one order; the manager takes them in priority order, as many as his rating allows.
        const menu = [];
        const meanX = (out.poss?.[side] || 0) > 200 ? (out.possX?.[side] || 0) / out.poss[side] : 50;
        const compl = (out.passSide?.[side] || 0) > 25 ? (out.passOkSide?.[side] || 0) / out.passSide[side] : 0.7;
        const mins = Math.max(1, meMinute(mp.tick));
        const shotsPm = (out.shots?.[side] || 0) / mins;
        if (mg.kind === 0) {
          menu.push(["defLine", 1, "line +1"], ["pressingLOE", 1, "press +1"]);
          if (compl < ME_MGR.sigCompLo) menu.push(["passingDir", -1, "keep it simple"]);
          else menu.push(["passingDir", 1, "more direct"]);
          menu.push(["tempo", 1, "tempo up"]);
        } else {
          if (shotsPm < ME_MGR.sigShotsLow) menu.push(["chanceCreation", 1, "shoot sooner"]);
          menu.push(["width", 1, "wider"]);
          if (compl > ME_MGR.sigCompHi) menu.push(["passingDir", 1, "more direct"]);
          menu.push(["dribbling", 1, "take men on"], ["chanceCreation", 1, "shoot sooner"]);
        }
        const nOrd = ME_MGR.ordMax + Math.round(mgmt * ME_MGR.ordMgmt);
        const seen = new Set(); const take = [];
        for (const o of menu) { if (seen.has(o[0])) continue; seen.add(o[0]); take.push(o); if (take.length >= nOrd) break; }
        mg.vec = {}; for (const [k2, v2] of take) mg.vec[k2] = v2;
        mgrSay("orders", (mg.kind === 0 ? "DEF + MID: " : "MID + FWD: ") + take.map(o => o[2]).join(", "));
      }
      else if (_wasOn && mg.mode <= 0.5) mgrSay("lift", "Individual orders lifted; back to the plan");
      // The answer lands on individuals: each targeted man carries the vector at the current
      // engagement, and it leaves with the mode. Untargeted men never allocate anything.
      const vec = mg.vec || (mg.kind === 0 ? ME_MGR.pin : ME_MGR.blunt);
      const who = mg.kind === 0 ? ME_MGR.pinPos : ME_MGR.bluntPos;
      for (const p of s.players[side] || []) {
        if (!p || p.off) continue;
        if (mg.mode > 0.02 && who[p.pos]) {
          p._ci = p._ci || {};
          for (const key in vec) p._ci[key] = vec[key] * mg.mode;
        } else if (p._ci) p._ci = null;
      }
    }
    // THE SHAPE, LATE (manager.ts meShapeFor): once a match, seeing it out.
    if (s.managers && !mp.shapeDone?.[side]) {
      const from = s.formations?.[side], to = meShapeFor(s, side, lead, rem);
      if (to && meReshape(s, side, to)) {
        (mp.shapeDone = mp.shapeDone || {})[side] = true;
        mgrSay("shape", `${from} to ${to}, seeing it out`);
      }
    }
    const k = mp.chaseT[side], w = k > 0 ? ME_CHASE_W.atk : ME_CHASE_W.def, m = Math.abs(k);
    for (const key in ME_STRAT_RANGE) {
      const r = ME_STRAT_RANGE[key];
      st[key] = Math.max(r[0], Math.min(r[1], (base[key] || 0) + (w[key] || 0) * m));
    }
  }
}

export function meTick(s, rng, out) {
  const mp = s.mePos;
  if (s.brain === 2) mp._min = out.min ?? 0;          // the clock, for the second brain's coach
  if (mp.counterT > 0) mp.counterT--;
  mp.possT++;
  if (out.evt) out.evt.age++;
  if (mp._penGone) { mePenRes(out, mp._penGone, mp); mp._penGone = null; }
  mp._bpx = mp.bx; mp._bpy = mp.by; mp._bpz = mp.bz;
  mp.tick++;
  meChase(s, out);
  // A restart is played out, not waited out. Everyone walks to the job this particular stoppage
  // gives him, and it is taken when the men who matter are actually set -- so nobody freezes and
  // nobody is teleported onto the ball.
  if (mp.sp) {
    mp.stopT = (mp.stopT || 0) + 1;      // time the ball was not in play; added back at the end
    mp.sp.t++;
    meSPFetch(mp);                       // somebody is bringing it back; it does not teleport
    // Changes are made at a stoppage, once, as the ball goes dead -- not mid-move.
    if (mp.sp.t === 1) for (const sd of ME_SIDES) { (s.brain === 2 ? meCoachSubs : meAutoSubs)(s, sd, out); meKeeperCrisis(s, sd, out); }
    // NO CHOREOGRAPHY AT GOAL KICKS, FREE KICKS AND CORNERS. The placed shapes read as rows of
    // dots on pregenerated coordinates because that is what they were. For these three kinds the
    // ordinary brains run against the dead ball -- duties, marking, block, shape -- and the men
    // duke it out for position the way they do in open play; meSPShape then adds only what the
    // laws and the act demand (taker, keeper, wall, exclusion distances). Kickoffs and penalties
    // keep their ceremony: both really are choreographed in the real game.
    if (s.brain === 2 && (mp.sp.kind === "goalkick" || mp.sp.kind === "freekick" || mp.sp.kind === "corner"
                          || mp.sp.kind === "throw")) {
      if (mp.tick % ME_MAP_STRIDE === 0) meBuildMaps(s);
      mindSetPiece(s);
    } else if (mp.sp.kind === "goalkick" || mp.sp.kind === "freekick" || mp.sp.kind === "corner") {
      if (mp.tick % ME_MAP_STRIDE === 0) meBuildMaps(s);
      if (mp.tick % 8 === 0) for (const side of ME_SIDES) meSlots(s, side);
      if (mp.tick % 2 === 0) meTactical(s);
      for (const side of ME_SIDES) meDuties(s, side);
      for (const side of ME_SIDES) meBlock(s, side);
      for (const side of ME_SIDES) meShape(s, side);
    }
    meSPShape(s);
    meMove(s, rng);
    if (s.brain === 2) mindSense(s);
    if (meSPReady(s)) {
      // Read off the restart before it is taken, because meSPTake clears it. The card is applied
      // AFTER the ball has gone, so a second yellow can send him off without the delivery having to
      // come off the boot of a man who is already walking.
      const wW = mp.sp.waste || 0, wI = mp.sp.ti, wS = mp.sp.side, wX = mp.sp.x, wY = mp.sp.y;
      meSPTake(s, rng, out, meBallTo, meEvt, meKickedBy);
      if (wW > 0 && rng.u() < CFG.wasteCard * wW) {
        const q = s.players[wS]?.[wI];
        if (q && !q.off) {
          q.yc = (q.yc || 0) + 1;
          meRate(q, -CFG.rateYellow);
          (out.yellows = out.yellows || { home: 0, away: 0 })[wS]++;
          // Counted, not inferred from the event text: meDead overwrites out.evt inside the same
          // tick, so anything reading it back sees whatever was written last and reports zero.
          out.wasteYc = (out.wasteYc || 0) + 1;
          meEvt(out, "yellow", wS, wX, wY, wX, wY, `${q.fullName || q.name} booked for time-wasting`);
          if (q.yc >= 2) meRed(s, out, wS, q, "second", wX, wY); else meBook(out, wS, q);
        }
      }
      // TEMPERS AT A DEAD BALL. Every other card in this engine comes out of a challenge, so
      // violent conduct and dissent -- the two offences that happen with the ball nowhere near --
      // could not happen at all, and the competition's three-match bans never got handed out. A
      // stoppage is when they happen: twenty-two men standing next to each other with nothing to
      // do, and a referee being told what he is.
      if (rng.u() < CFG.flashP) {
        const fS = rng.u() < 0.5 ? "home" : "away";
        // Not the keeper. Nothing in the engine puts an outfield man in the gloves, so a dismissed
        // keeper is an empty net for the rest of the match -- which is a bigger thing to build than
        // a flashpoint, and not one to smuggle in behind this.
        const on = s.players[fS].filter(z => z && !z.off && z.pos !== "GK");
        const z = on[Math.floor(rng.u() * on.length)];
        if (z) meRed(s, out, fS, z, rng.u() < CFG.flashViolent ? "violent" : "abusive", mp.bx, mp.by);
      }
    }
    return;
  }
  // ================ 1. THE BALL =============================================================
  // It moves, and who has it is settled, BEFORE anybody thinks about anything. The brains used to
  // run first: every block position, every marking assignment and every duty was derived from where
  // the ball was and who had it a quarter of a second ago. That was survivable while possession was
  // a flag that changed a few times a minute; once the contest for the ball ran every slice it meant
  // the defensive shape was permanently reacting to a stale world -- measured, 23% of duties during
  // a siege were still ATTACKING duties, and defenders sat 14-26 m off their slots at exactly the
  // moments that decide a match.
  out.inplay++;
  // The moment he lets go of it, it is not in his hands any more. Cleared only where possession
  // CHANGED, the flag survived his own throw or kick -- and since nobody may claim a held ball, the
  // ball became unclaimable by all twenty-two men for the rest of the half. Measured as the match
  // dropping from 10.7 shots a side to 1.9.
  if (mp.idx < 0) mp.held = false;
  // The ball is an OBJECT: integrated every slice, whether or not somebody is on it. It used to be
  // stepped only when nobody had possession, so a dribbler's control force piled velocity into a ball
  // whose position never changed -- traced, a man running at 5.6 m/s alongside a stationary ball
  // holding 13 m/s of stored speed. That single line is why nobody could dribble.
  // ...AND IT MOVES WITH THE PLAYERS, NOT AHEAD OF THEM. The slice used to step the ball first with
  // all twenty-two frozen where they stood, and settle who had touched it afterwards, a quarter of a
  // second later, from wherever it had got to -- so a dribbler's touch rolled away from a man who was
  // not moving, a pass bounced off its own receiver before anybody asked whether he had controlled it,
  // and a ball a man had already stopped on the line was given as a throw against him. Each man now
  // runs his own line through the slice (mePoses) and the slice is played in pieces, each ending at
  // the next thing that happens to the ball -- a man reaching it, a touch, a line -- which is settled
  // there and then before the ball goes on.
  meBallSlice(mp);
  // A BALL GOING IN IS SAVED LIKE A SHOT, whoever sent it on its way (keeper.ts): a cross nobody
  // touched, a cutback, a ricochet. Planned from where the ball is now, so he reacts from now.
  // ...and given up, too, once the ball has slowed to one he can go and get: planned when it was
  // quick, a cutback dying to a roll held him set in the middle of his goal for nearly two seconds.
  if (mp.gkPlan && ((mp.tick - mp.gkPlan.t0) * ME_DT > CFG.gkPlanMax
                    || Math.hypot(mp.bvx, mp.bvy) < CFG.gkPlanV * CFG.gkPlanSlow)) mp.gkPlan = null;
  // Only a ball coming quicker than gkPlanV: one rolling at him he goes and gets (brain.ts). A save
  // planned against a slow ball froze him where he stood while it trickled past him into the net.
  // ...and only one nobody else gets to first. A long ball dropping thirty metres out was saved like a
  // shot the moment its forecast ended in the net, and the keeper was held on his line while a striker
  // brought it down in the box. (_ttbMs is each man's first touch, from the slice before.)
  if (!mp.sp && mp.idx < 0 && !mp.shot && !mp.gkPlan && Math.hypot(mp.bvx, mp.bvy) > CFG.gkPlanV) {
    const into = meIntoGoal(mp);
    if (into) {
      let first = Infinity;
      for (const sd of ME_SIDES) for (const q of s.players[sd]) if (!q.off && q.pos !== "GK") first = Math.min(first, q._ttbMs ?? Infinity);
      if (mp._intoMs < first) mePlanSaveBall(s, into);
    }
  }
  // A BALL OF OURS RUNNING INTO OUR OWN NET, gone beyond the man it belongs to, is the keeper's to take
  // (the probe below; brain.ts sends him). Still "possessed" by the defender whose heavy touch sent it
  // goalward, it was nobody else's on his side to touch, and it rolled in past a keeper standing aside.
  mp._ownIn = null;
  // Which goal the ball is on its way into, if any, read once for the probe's keeper hands below.
  mp._inGoal = mp.sp ? null : meIntoGoal(mp);
  if (!mp.sp && mp.idx >= 0 && !mp.held) {
    const hp = s.players[mp.side]?.[mp.idx];
    if (hp && hp.pos !== "GK" && Math.hypot(hp.x - mp.bx, hp.y - mp.by) > CFG.reach * CFG.playReach
        && meIntoGoal(mp) === mp.side) mp._ownIn = mp.side;
  }
  mePoses(s);
  const NSUB = Math.round(ME_DT / BALL_SUB), all = s.players.home.concat(s.players.away);
  const subNow = (jj) => mp.tick * NSUB + jj;
  let cross = null;
  // WHO TOUCHED IT LAST -- INCLUDING OFF A SHIN. hitBodies has always recorded the man the ball
  // physically bounced off, and wrote it to mp.hitP with the comment "he got a foot to it: that is
  // the touch". Nothing has ever read it. So a shot deflected behind off a defender was awarded as
  // a GOAL KICK, and a pass that clipped a defender and ran out of touch was thrown in the wrong
  // way, because both decisions asked mp.lastSide -- which only ever moves on a deliberate play.
  //
  // Kept separate from lastSide rather than folded into it. lastSide also gates the back-pass rule
  // and the handball, and both of those mean a DELIBERATE play by a team-mate: a keeper may pick up
  // a ball that has deflected off his own defender, and merging the two would have him unable to.
  // Read again at the moment the ball goes out, since the slice can now hold several touches.
  const touchSideNow = () => {
    mp.touchSide = mp.lastSide;
    // hitP is this tick's touch, touchP the one carried over from an earlier tick that nobody has
    // played on purpose since. Either beats lastSide, which only ever moves on a deliberate play.
    const tp = mp.hitP || mp.touchP;
    if (tp) {
      if (s.players.home.indexOf(tp) >= 0) mp.touchSide = "home";
      else if (s.players.away.indexOf(tp) >= 0) mp.touchSide = "away";
    }
  };
  touchSideNow();
  let stopTick = false;                  // a whistle blown inside the contest ends the tick
  const resolvePending = (okSide) => {
    const pp = mp.passPending; mp.passPending = null;
    if (!pp) return;
    // COUNTED WHEN IT RESOLVES, not when it is struck. out.passes++ used to fire at the boot, but
    // 9.8% of passes never get an outcome -- the whistle goes while the ball is travelling, or a
    // defender heads it away down a branch that clears the pending without recording anything -- so
    // every one of those was counted as attempted and never as completed. Reported completion came
    // out at 70.6% against a true 78.3%, which is the difference between failing this target and
    // meeting it, and it was the bookkeeping rather than the football.
    out.passes++;
    // Harness-only ledger by kind of ball: attempts, completions, and the same two for first time.
    if (globalThis.__pk) { const K = globalThis.__pk, kk = pp.k || "set", e = K[kk] || (K[kk] = [0, 0, 0, 0]);
      e[0]++; if (okSide === pp.side) e[1]++; if (pp.ft) { e[2]++; if (okSide === pp.side) e[3]++; } }
    // ...and every pass whole, for test/lab.mjs: who played it, what kind, from where, and where it ended.
    if (globalThis.__pass) globalThis.__pass(pp, okSide, mp.bx, mp.by);
    // Per side as well, when the harness asks: pooled completion hides exactly the thing a
    // mismatch is about -- who is completing and who is coughing it up.
    if (out.passSide) out.passSide[pp.side]++;
    // Banked on COMPLETION, not per tick while it travels. Credited per tick, a forty-metre ball
    // hanging two seconds in the air earned three times what a five-metre one did, and the long-ball
    // styles floated to the top of the possession table -- Park The Bus highest in the game at 58.9%
    // with 261 passes. Airtime is not control. A pass that reaches a team-mate was your possession
    // the whole way; a hoof that gets headed clear never was.
    if (okSide === pp.side) { out.passOk++; if (out.passOkSide) out.passOkSide[pp.side]++;
                              if ((globalThis.__shots || globalThis.__gfrom) && pp.fj >= 0) { const rq = s.players[pp.side]?.[pp.fj]; if (rq) { rq._rcvK = pp.k || "set"; rq._rcvT = mp.tick; } }
                              // The played-through press: a defender who had committed to the
                              // ball at the strike and watched it complete forward past him is
                              // beaten, exactly as a missed tackle leaves him. See config.
                              // In the second brain the men are the ones committed at the strike (pp.eng), and the ball
                              // has to have gone past him inside his reach: within pressThruR of the line it travelled.
                              if (pp.sy !== undefined) {
                                const _d2 = pp.side === "home" ? 1 : -1, _op = s.players[meOther(pp.side)] || [];
                                const _lx = mp.bx - pp.sx, _ly = mp.by - pp.sy, _ll = _lx * _lx + _ly * _ly || 1;
                                if ((mp.bx - pp.sx) * _d2 > 4)
                                  for (let j2 = 0; j2 < _op.length; j2++) {
                                    const q2 = _op[j2];
                                    if (!q2 || q2.off || q2.pos === "GK" || q2._beat > 0) continue;
                                    let past;
                                    if (pp.eng) {
                                      // The price of pressing: men caught committed upfield. A defender stepping in on the
                                      // edge of his own box is defending, and charging him too cost the deep blocks most
                                      // (traced: 19 of 25 Park the Bus men caught were in their own third).
                                      if (!pp.eng.includes(j2) || (meGoalX(pp.side) - q2.x) * _d2 < CFG.pressThruFrom) continue;
                                      const u = Math.max(0, Math.min(1, ((q2.x - pp.sx) * _lx + (q2.y - pp.sy) * _ly) / _ll));
                                      past = Math.hypot(q2.x - (pp.sx + _lx * u), q2.y - (pp.sy + _ly * u)) < CFG.pressThruR;
                                    } else past = (q2._duty === "press" || q2._wasPress) && Math.hypot(q2.x - pp.sx, q2.y - pp.sy) < CFG.pressThruR;
                                    if (past && (mp.bx - q2.x) * _d2 > 2) q2._beat = CFG.pressThruT;
                                  }
                              }
                              if (pp.byP) { pp.byP.passOk = (pp.byP.passOk || 0) + 1;
                                // What it was worth: a completed pass, plus what it gained. Only
                                // forward progress pays, and it is capped so one long ball out of
                                // defence cannot outscore a passage of play.
                                const _fwd = pp.sx === undefined ? 0
                                           : (pp.side === "home" ? 1 : -1) * (mp.bx - pp.sx);
                                meRate(pp.byP, CFG.ratePass
                                  + Math.max(0, Math.min(CFG.ratePassProgCap, _fwd)) * CFG.ratePassProg);
                                // The table stat. Raw completions crowned the man who recycled at
                                // the back; a pass that GAINS ground is the one worth counting, and
                                // the gain required shrinks as play moves higher (Wyscout tiers).
                                if (pp.sx !== undefined) {
                                  const _gx = meGoalX(pp.side);
                                  const _sOwn = Math.abs(pp.sx - _gx) > PITCH_L / 2;
                                  const _eOwn = Math.abs(mp.bx - _gx) > PITCH_L / 2;
                                  const _need = _sOwn && _eOwn ? CFG.progOwn
                                              : _sOwn ? CFG.progCross : CFG.progOpp;
                                  if (_fwd >= _need) pp.byP.prog = (pp.byP.prog || 0) + 1;
                                } }
                              out.poss[pp.side] += (pp.t || 0);
                              // Ground actually gained by a pass that found a team-mate. A side can
                              // complete 160 passes a game and be no nearer the goal at the end of it.
                              if (out.passFwd && pp.sx !== undefined)
                                out.passFwd[pp.side] += (pp.side === "home" ? 1 : -1) * (mp.bx - pp.sx); }
    else { out.passFail++;
           if (pp.byP) { pp.byP.passFail = (pp.byP.passFail || 0) + 1; meRate(pp.byP, -CFG.ratePassFail); }
           meEvt(out, "cut", pp.side, mp.bx, mp.by, mp.bx, mp.by, null); }
  };
  // Crossing your own goal line is the same event whether you dribbled it there or shot it.
  const endOfPlay = () => {
      resolvePending(null);
      const sh = mp.shot; mp.shot = null;
      const scorer = meOther(cross.conceding);
      if (cross.kind === "goal") {
        // onTarget belongs to a shot. A clearance or backpass that crosses the line is a goal but
        // was never a shot, and counting it inflated on-target past the number of shots taken.
        // Every goal is a shot on target by somebody, or it is an own goal. A rebound turned in
        // without a fresh strike, or a man carrying it over the line, was being recorded as a goal
        // attached to no shot at all -- which is why saves plus goals never added up to on-target.
        out.goals[scorer]++; mp.goals[scorer]++;
        // The reorganisation after conceding: the ball walks back to the spot and the manager is
        // shouting the whole way. On-pitch men only, capped for the match -- see ME_MGR.
        if (ME_MGR.coach && s.brain !== 2) {
          const _cs = meOther(scorer);
          mp.coachStop = mp.coachStop || { home: 0, away: 0 };
          const _g = Math.max(0, Math.min(1, (s.mgmt?.[_cs] ?? ME_MGR.mgmtDef) / 99));
          const _inc = Math.min(ME_MGR.stopInc * _g, ME_MGR.stopCap - mp.coachStop[_cs]);
          if (_inc > 0) {
            mp.coachStop[_cs] += _inc;
            for (const p of s.players[_cs] || []) if (p && !p.off) { p.ovr = (p.ovr ?? 70) + _inc; p._att = null; }
            const L2 = (out.mgrLog = out.mgrLog || { home: [], away: [] })[_cs];
            if (L2.length < 40) L2.push({ min: meMinute(mp.tick), k: "reorg", t: "Reorganised after conceding: XI +" + _inc.toFixed(2) + " sharpness" });
          }
        }
        if (sh) out.onTarget[sh.side]++;
        if (globalThis.__gfrom) globalThis.__gfrom.push(sh ? (sh.pen ? "penalty" : sh.hdr ? "header" : sh.from || "set piece") : "no shot");
        if (sh && globalThis.__svd) globalThis.__svd.push([sh.d, 0]);
        else if (mp.lastSide === scorer) { out.shots[scorer]++; out.onTarget[scorer]++; }
        // Parried in. The shot was counted when he struck it, so it only needs the on-target credit
        // -- and it stops being recorded as the defending side putting it through their own net.
        else if (mp.deflect && mp.deflect.side === scorer && mp.deflect.n < 2
                 && mp.tick - mp.deflect.t < CFG.deflectWin) out.onTarget[scorer]++;
        // WHOSE GOAL, AND WHO MADE IT. The engine counted goals per SIDE and stopped there, so a
        // tournament could take a scoreline off it and nothing else -- no top scorer, no assists,
        // nothing a league table hangs off. Credited onto the player objects themselves, which is
        // already how this engine reports a booking or an injury, so a caller reads it off the squad
        // it handed in.
        let gi = -1;
        // The commentary line is built where the scorer is RESOLVED, not at the meEvt below. Reading
        // `sh` there meant the feed disagreed with out.scorers on four goals in five -- the table had
        // the name, the line said "GOAL".
        let goalTxt = "GOAL";
        {
          // WHO STRUCK IT. Not simply mp.shot: a block, a save and a header all clear it, so most
          // goals arrive with no live shot attached -- 78 of 96 in a thirty-match sample, which is
          // why crediting off sh alone booked barely a fifth of them. The onTarget bookkeeping
          // immediately above has always known this and falls back to the last side to touch it;
          // this uses the same rule, one man deeper, and lands on the last man of the SCORING side
          // to have kicked it. A true own goal leaves nobody: the last touch was theirs.
          gi = sh && sh.side === scorer && sh.i >= 0 ? sh.i : -1;
          let gt = sh ? sh.t0 : mp.tick;
          const lg = mp.tlog || [];
          // A KEEPER DOES NOT SAVE A GOAL. He was credited when he got a hand to it; the ball has
          // now finished in his net, so the save, his counter and the rating it earned all come off
          // again. The event line stays -- he did parry it, and then it went in, which is the story.
          if (mp._parry && mp._parry.side === cross.conceding
              && mp.tick - mp._parry.t < CFG.deflectWin) {
            const pv = mp._parry;
            out.saves[pv.side] = Math.max(0, (out.saves[pv.side] || 0) - 1);
            pv.q.saves = Math.max(0, (pv.q.saves || 0) - 1);
            meRate(pv.q, -pv.credit);
            // 1 = the parry itself carried in (nobody touched it after the keeper);
            // 2 = an attacker put the rebound in, which is ordinary football.
            if (globalThis.__prov) globalThis.__prov._parried =
              (mp.tlog || []).some(e2 => e2.t > pv.t) ? 2 : 1;
          }
          mp._parry = null;
          // ...AND THE TAKER DID NOT MISS IT. The same ball was written into the missed-penalty
          // ledger when the parry ended the shot, so it was showing as a miss AND a goal, and the
          // taker was carrying both rating charges for a penalty he had just scored.
          if (sh && sh._pm && out.penMiss?.[sh._pm.side]) {
            const L = out.penMiss[sh._pm.side];
            if (sh._pm.i === L.length - 1) L.pop(); else L.splice(sh._pm.i, 1);
            if (sh._pm.p) meRate(sh._pm.p, sh._pm.back);
            sh._pm = null;
          }
          // AN OWN GOAL IS THE LAST TOUCH BEING THEIRS. The old test asked for no scoring-side touch
          // anywhere in the last eight deliberate plays, which essentially never happens once a move
          // has reached the box -- measured, zero own goals in 112. What makes it an own goal is
          // simply who put it in, so that is what is asked. A shot that goes in off a defender or a
          // keeper is still the striker is: those set mp.deflect for the SCORING side, and that is
          // what protects them here, which is the same rule the block and parry sites already state.
          // ...and it is only HIS if the attack did not just put it there. A defender who gets the
          // last touch moments after an attacker played the ball has deflected it in, and this
          // engine credits a deflected goal to the man who hit it -- the same rule the parry and the
          // block already state. A defender who puts it in with no attacker near it in time is the
          // only one who has actually scored an own goal.
          const lastT = lg.length ? lg[lg.length - 1] : null;
          const atkNear = !!lastT && lg.some(e => e.s === scorer && lastT.t - e.t <= CFG.ogWin && e.t <= lastT.t);
          const ownGoal = !!lastT && lastT.s === cross.conceding && !atkNear
            && !(mp.deflect && mp.deflect.side === scorer && mp.tick - mp.deflect.t < CFG.deflectWin);
          if (ownGoal) gi = -1;
          else if (gi < 0) for (let k = lg.length - 1; k >= 0; k--)
            if (lg[k].s === scorer) { gi = lg[k].i; gt = lg[k].t; break; }
          const gp = gi >= 0 ? s.players[scorer]?.[gi] : null;
          // Named, counted and rated against the man who actually put it in. out.owns is its own
          // list because an own goal belongs in the match events and belongs to nobody in the
          // scorers table -- reading it back off a "-" in a name was how it stayed invisible.
          if (ownGoal) { const og = s.players[cross.conceding]?.[lastT.i];
            if (og) { og.ownGoals = (og.ownGoals || 0) + 1;
              (out.owns = out.owns || { home: [], away: [] })[cross.conceding].push(
                { name: og.name, full: og.fullName || og.name, min: out.min ?? 0, add: out.add || 0 }); } }
          if (gp) gp.goals = (gp.goals || 0) + 1;
          // The assist is the last DIFFERENT team-mate to have kicked it, and only if the other side
          // never had it in between -- a goal that came from winning the ball off somebody is not
          // assisted by the man he took it from.
          let ast = null;
          // A penalty is one man against the keeper; the touch-log walk would hand an assist to
          // whoever rolled him the ball to spot it, which in a shootout meant kicks arriving with
          // assists attached. No penalty has one, by definition rather than by data.
          if (gp && !(sh && sh.pen)) for (let k = lg.length - 1; k >= 0; k--) {
            const e = lg[k];
            if (e.t > gt) continue;                    // touches after the strike are deflections
            // A ricochet off an opponent is not him having the ball, so it does not end the move he
            // was not part of. Measured over 240 matches: every OTHER thing that ends the chain here
            // is a real football reason to deny an assist -- he passed it and the scorer won it off
            // him, the keeper parried, a tackle, a block -- and only this one was a bookkeeping
            // artefact, worth 3 points of assist rate on its own.
            if (e.s !== scorer && e.d) continue;
            if (e.s !== scorer) break;                 // they had it: no assist
            if (e.i !== gi) { ast = s.players[e.s]?.[e.i] || null; break; }
          }
          if (ast && ast !== gp) ast.assists = (ast.assists || 0) + 1;
          // Same three cases the rating code below already distinguishes: a scorer, a scorer with a
          // team-mate who made it, and a true own goal -- which leaves nobody on the scoring side and
          // is named off the last man of the CONCEDING side to have touched it, exactly as the
          // own-goal rating is.
          if (gp) goalTxt = `${gp.fullName || gp.name}`
                          + (ast && ast !== gp ? ` (${ast.fullName || ast.name})` : "");
          else { const og = s.players[cross.conceding]?.[(mp.tlog || []).slice(-1)[0]?.i];
                 // Named the way a scorer is, with the tag after it rather than a sentence in
                 // front: the feed already says GOAL above this line.
                 if (og) { goalTxt = `${og.fullName || og.name} (OG)`;
                   // A separate ledger, not an entry in out.scorers: the scorers list feeds the
                   // golden digest and the shootout revocation, both of which count real goals.
                   (out.ogs = out.ogs || { home: [], away: [] })[scorer].push(
                     { name: og.name, full: og.fullName || og.name, min: out.min ?? 0, add: out.add || 0 }); } }
          if (gp) (out.scorers = out.scorers || { home: [], away: [] })[scorer].push(
            { name: gp.name, full: gp.fullName || gp.name, assist: ast ? ast.name : null,
              min: out.min ?? 0, add: out.add || 0, pen: !!(sh && sh.pen) });
          // GOAL PROVENANCE, for harnesses only: was this goal born of a ricochet, a restart, or a
          // worked move? `lt` is ticks between the last loose-ball event and the strike, read off
          // the shot; a goal with no live shot reads it at the crossing instead. Gated on a global
          // the app never sets, so a watched match pays one truthiness test per goal.
          if (globalThis.__prov) globalThis.__prov.push({
            side: scorer, par: globalThis.__prov._parried || 0,
            og: ownGoal ? 1 : 0, pen: sh && sh.pen ? 1 : 0,
            dead: sh && !sh.p ? 1 : 0, noShot: sh ? 0 : 1,
            lt: sh ? (sh.lt ?? 1e9) : mp.tick - (mp._loose ?? -1e9),
            pt: sh ? (sh.pt ?? -1) : (mp.possT ?? -1),
            d: sh ? sh.d : null, gkd: sh ? sh.gkd : null, gko: sh ? sh.gko : null,
            sgk: mp.tick - (mp._gkKick ?? -1e9),
            // what put it in when nobody shot: the last touches, what last made it loose, how hard it
            // was going and where the keeper was
            why: mp._looseWhy || "", v: +Math.hypot(mp.bvx, mp.bvy).toFixed(1),
            last: (mp.tlog || []).slice(-3).map(e2 => (e2.s === scorer ? "A" : "D") + (s.players[e2.s]?.[e2.i]?.pos === "GK" ? "k" : "") + (e2.d ? "~" : "") + (mp.tick - e2.t)).join(" "),
            gkb: (() => { const g2 = meKeeper(s.players[cross.conceding]); return g2 ? +Math.hypot(g2.x - mp.bx, g2.y - mp.by).toFixed(1) : -1; })() });
          if (globalThis.__prov) globalThis.__prov._parried = 0;
          // ...and what it was worth to them. The context is read BEFORE this goal is counted, so a
          // winner is scored as the goal that won it rather than as the one that made it 2-1.
          const gm = out.min ?? 0, xg = sh ? sh.xg : CFG.rateGoalXgDef;
          const ctx = meCtxMult((out.goals[scorer] || 0) - 1, out.goals[cross.conceding] || 0, gm);
          // A tap-in is a goal; it is not the same afternoon as one from twenty yards.
          if (gp) meRate(gp, CFG.rateGoal * ctx * (1 - CFG.rateGoalXgW * clamp01(xg)));
          else meRate(s.players[cross.conceding]?.[(mp.tlog || []).slice(-1)[0]?.i], -CFG.rateOwnGoal);
          if (ast) meRate(ast, CFG.rateAssist * (1 + (ctx - 1) * 0.5));
          // THE MOVE. A goal is not two men. The pre-assist, the ball before that, and the man who
          // won it back are the midfield's whole contribution to a goal, and until now every one of
          // them finished the move on exactly what he started it with. Walked back through the
          // scoring side's unbroken run of touches: each earlier DIFFERENT man is paid a share that
          // decays a step at a time, and if the run began with a ball won in open play the man who
          // won it is paid for winning it. Ricochets read through, as the assist does. Nobody is
          // paid twice for one goal, and the scorer and the assister are paid already.
          if (gp) {
            const paid = new Set([gi]); if (ast) paid.add(s.players[scorer].indexOf(ast));
            let k = lg.length - 1, share = CFG.rateBuild, firstK = -1;
            for (; k >= 0; k--) {
              const e = lg[k];
              if (e.t > gt) continue;                    // after the strike: deflections, the parry
              if (e.s !== scorer) { if (e.d) continue; break; }
              firstK = k;
              if (paid.has(e.i)) continue;
              paid.add(e.i);
              const bp = s.players[scorer]?.[e.i];
              if (bp) meRate(bp, share);
              share *= CFG.rateBuildDecay;
            }
            // k sits on the other side's last touch, or at -1 if the window is all ours. A ball won
            // within recoverWin of their touch was won in play -- a tackle logs at once, an
            // interception when he first plays it -- while a restart is taken later than that by
            // construction (spMinT and the dead-ball timings in meDead), so it is never a recovery.
            if (k >= 0 && firstK >= 0 && lg[firstK].i !== gi && lg[firstK].t - lg[k].t <= CFG.recoverWin) {
              const w = s.players[scorer]?.[lg[firstK].i];
              if (w) meRate(w, CFG.rateRecover);
            }
          }
          // THE MAN WHO GAVE IT AWAY. In phase A a defender could only ever lose rating, and only
          // collectively, when his side conceded -- so the model said nothing about whether he had
          // anything to do with it, and defenders sat 0.42 below forwards for playing their
          // position. This is the other half: the last man of the CONCEDING side to have touched it,
          // if he lost it in his own third and recently enough for the goal to be his fault.
          {
            const cs = cross.conceding, cown = meGoalX(meOther(cs)), cdir = meDir(cs);
            for (let k = lg.length - 1; k >= 0; k--) {
              const e = lg[k];
              if (e.s !== cs) continue;
              const em = s.players[cs]?.[e.i];
              // Not the keeper. He is already charged for the goal itself through meConcedePen, and
              // he is the man most likely to have last touched it in his own third simply by being
              // the goalkeeper -- so charging him twice took keepers to 6.10 against forwards on
              // 6.92 and made the positional spread worse than phase A's, not better. He gets away
              // with dribbling into trouble; that is the price of not punishing him for the position
              // he plays.
              if (em && em.pos !== "GK"
                  && mp.tick - e.t <= CFG.rateErrWin && (e.x - cown) * cdir < PITCH_L / 3)
                meRate(em, -CFG.rateError);
              break;
            }
          }
          // The men it went past. The keeper carries most of it and the back line shares the rest.
          for (const q of s.players[cross.conceding] || []) {
            if (q.off) continue;
            if (q.pos === "GK") meRate(q, -meConcedePen(sh ? (sh.xgN ?? sh.xg) : xg, !!(sh && sh.pen)));
            else if (q.pos === "DEF") meRate(q, -CFG.rateConcedeDef);
          }
        }
        if (sh && sh.pen) sh._pd = 1;                    // scored: the funnel must not call it missed
        meEvt(out, sh && sh.pen ? "pen" : "goal", scorer, mp.bx, mp.by, meGoalX(scorer), cross.y, goalTxt);
        meDead(s, "kickoff", cross.conceding, 190, out);
        // Where he runs. The corner at the end he has just scored at, on the side he finished from,
        // which is near enough to where a footballer actually goes. meSPShape does the rest.
        if (mp.sp && gi >= 0)
          mp.sp.celeb = { side: scorer, i: gi,
                          x: meGoalX(scorer) - meDir(scorer) * CFG.spCelebOut,
                          y: cross.y < ME_HALF_W ? CFG.spCelebIn : PITCH_W - CFG.spCelebIn };
        return;
      }
      if (cross.kind === "woodwork") {
        // Off the frame and back into play: a live ball, not a stoppage.
        out.woodwork = (out.woodwork || 0) + 1; meBump(out, "woodworkSide", scorer);
        mePenRes(out, sh);
        meEvt(out, sh && sh.pen ? "penmiss" : "block", scorer, mp.bx, mp.by, mp.bx, mp.by,
              sh ? `${sh.full || sh.name} hits the frame` : "Off the woodwork");
        mp.bvx = -mp.bvx * 0.55; mp.bvy = mp.bvy * 0.55 + (rng.u() - 0.5) * 3; mp.bvz = Math.abs(mp.bvz) * 0.4 + 1;
        mp.bx += mp.bvx * 0.05;
        mp.lastSide = scorer;
        meBallPredict(mp);
        return;
      }
      if (sh) { out.offTarget = (out.offTarget || 0) + 1;
                if (sh.p) meRate(sh.p, -CFG.rateShotOff);
                mePenRes(out, sh);
                meEvt(out, sh.pen ? "penmiss" : "miss", sh.side, mp.bx, mp.by, meGoalX(sh.side), cross.y,
                      sh.pen ? `${sh.full || sh.name} misses the penalty` : `${sh.full || sh.name} drags it wide`); }
      if (cross.conceding === mp.touchSide) meDead(s, "corner", meOther(cross.conceding), CFG.cornerTicks, out);
      else meDead(s, "goalkick", cross.conceding, 200, out);
      return;
  };
  // The contest for the ball, EVERY slice. This used to sit inside `if (mp.idx < 0)`, so while a man
  // was dribbling nobody else could touch the ball at all -- it passed straight through defenders,
  // which is why there was no collision however tight the reach was set. A dribbler now keeps it
  // only by still being the one who can reach it, and anybody who gets a foot in front of it takes
  // it. This IS the collision, and it is also the whole of tackling.
  // Reach is tested against the ball's PATH this slice, not its endpoint -- an arriving
  // pass covers 1.5 m per slice and would otherwise pass straight through the receiver.
  // ...and now against the ball at every substep of it (the probe below, run by meBallRun).
    // The contest runs BEFORE the goal line is adjudicated. A struck shot covers six metres in a
    // slice, and when the line was tested first the keeper -- who can only ever touch the ball here
    // -- was never asked: from eight metres, 158 of 160 shots went in and he made ZERO saves. In the
    // substep loop the probe comes before the crossing test by construction.
      // How far THIS man gets a foot, a boot or a glove to it. Touching distance is a FOOT away, not
      // a torso away and not a metre and a half: a footballer reaches about 0.7 m, and that circle is
      // drawn on the pitch so what you see touching and what the engine calls a touch cannot
      // disagree. It has to be answered INSIDE the scan. Computing one reach after picking the single
      // nearest body meant a keeper's arm was judged against a defender's toe -- any outfielder a few
      // centimetres nearer the path stopped the man with three times the reach from being considered.
      const reachOf = (q, sd, i, isRcv, zAt, fast, sf) => {
        // A KEEPER SAVES WITH HIS BODY. No reach ring, no radius that swells with the flight time --
        // he stops what he physically gets in front of, exactly like the ball bouncing off anybody
        // else. What separates a good keeper from a poor one is now entirely how quickly he reads the
        // shot and how fast he moves to it, which is where it belongs.
        if (q.pos === "GK") {
          // A live opposing shot: arms along the whole path. See CFG.gkSaveReach. Not penalties:
          // the spot-kick duel has its own read/dive calibration (spPenRead, test/pensim.mjs) and
          // the wider reach on top of it took conversion from 80% to 68% against a real ~78.
          if (mp.shot && mp.shot.side !== sd && !mp.shot.pen) {
            // ...BUT ONLY AS MUCH OF IT AS HE HAS HAD TIME TO USE. The contact test is a pure
            // geometric one -- d >= r against his swept capsule -- so this ring was granted in
            // full from the instant the ball left the boot, and a keeper parried a rocket struck
            // at his shoulder from eight yards exactly as reliably as a tame one from thirty.
            // Reaction gated only his MOVEMENT, never his reach. The arms now arrive on a clock:
            // nothing but his body until his reaction has elapsed, opening to the full ring over
            // gkReachSpan after it. Shot speed and distance need no term of their own -- they set
            // how long the ball takes to arrive, and that is what this reads.
            const gka = meAttrs(q), gkk = meGkSkill(gka), gkl = meGkLow(gka);
            const react = meGkReact(gka);
            // ...ON THE CLOCK OF THE SUBSTEP. The contest is now asked every hundredth of a second, and
            // the shot left the boot at the end of slice t0, so this far into it is how long he has had
            // -- not the whole of the slice, which handed every keeper a quarter of a second of arms he
            // had not yet got out.
            const tSince = Math.max(0, (mp.tick - mp.shot.t0 - 1 + (sf ?? 1)) * ME_DT);
            const openF = Math.max(0, Math.min(1, (tSince - react) / CFG.gkReachSpan));
            // THE SET KEEPER. Before he has reacted he is still not only a body: set for the shot he has
            // feet and hands out, and a ball struck at him or just beside him is kept out without a dive.
            // Nothing but his torso counted here, so from inside twelve metres -- where the ball arrives
            // before anybody's reaction -- save rates fell to a third once the contest was timed, against
            // the half and more a real keeper keeps out. gkSetReach, a little more for a better keeper.
            return Math.max(CFG.gkSetReach * (CFG.gkSetLo + (1 - CFG.gkSetLo) * gkk) * (1 - gkl * CFG.gkSetLow),
                            Math.max(0.04, CFG.gkSaveReachLo + (CFG.gkSaveReachHi - CFG.gkSaveReachLo) * gkk - gkl * CFG.gkGrabLow) * openF);
          }
          // On the floor of his own box, against a ball the other side touched last, he claims with
          // his hands -- a dive's span, not a boot. Everywhere else, and against any airborne ball,
          // the strict body radius stands: a save is still stopped only by what he gets in front of.
          // ...and only on a ball RUNNING LOOSE -- a dribbler's heavy touch, a spill, a scramble.
          // A struck pass in flight keeps the body radius it always had: with hands against those
          // too he swept every through-ball threaded into the box, and goals a match fell by a
          // fifth. Measured: 2.91 -> 2.33 with hands against everything, 2.84 loose-only.
          // A fresh ricochet counts as loose whatever the flight flag and last touch say.
          const loose = mp.tick - (mp._loose ?? -99) < CFG.gkLooseWin;
          // ...and a ball on its way into his net is his to stop with his hands, whoever struck it and
          // however: a cross running in at his knees went past a keeper allowed only his boots for it.
          if ((!mp.flight || loose || mp._inGoal === sd) && zAt < CFG.handMinZ && (mp.bpass !== sd || loose)
              && Math.hypot(q.x - meGoalX(meOther(sd)), q.y - ME_HALF_W) < CFG.gkBoxR)
            return CFG.gkClaimReach + (meBadgeFx(q).claim ?? 0);
          // THE CROSS IS HIS. Above handMinZ he had bodyR + ballR -- 0.51 m, LESS than an
          // outfielder's header reach -- so the keeper was structurally the worst aerial player
          // on his own six-yard line and every high ball near him was somebody's free header.
          // Hands above head height, in his own box, against a ball the opponents delivered:
          // that is claiming a cross, and it is the one duel a keeper is built to win.
          // ...never against a live shot: the save branch above deliberately excludes penalties
          // (their duel has its own calibration), so a penalty fell through to here and was
          // "claimed" mid-flight with 1.15 m hands -- conversion went 85% to 71% in one check.
          if (!mp.shot && zAt >= CFG.handMinZ && zAt < CFG.gkHigh && mp.bpass !== sd
              && Math.hypot(q.x - meGoalX(meOther(sd)), q.y - ME_HALF_W) < CFG.gkBoxR)
            return CFG.gkClaimAir + (meBadgeFx(q).claim ?? 0);
          // No hands does not mean no feet. Body-only here had him WORSE at kicking a ground ball
          // than any outfielder, which is how a shanked clearance trickled in 0.7 m from him: the
          // backpass law takes his hands, not his boots.
          if (zAt < CFG.touchZ) return Math.max(CFG.bodyR + CFG.ballR, CFG.reach * (1 - fast * CFG.fastDodge));
          return CFG.bodyR + CFG.ballR;
        }
        // OVER HIM, or not. Every outfielder used to share a 1.6 m ceiling; now it is how high this
        // particular man gets, which is what makes an aerial ball a contest between two people
        // rather than something that passes through both of them.
        const air = meAerial(meAttrs(q), CFG);
        if (zAt > air) return -1;
        // A defender stretching to cut out someone else's ball is poking at it; the man it was
        // played to is taking a touch, and takes it a little more comfortably.
        // Stepping in front of somebody else's pass is ANTICIPATION -- the comment below has said
        // so for some time ("reading a loose ball or a pass is anticipation, which is `position`")
        // while the reach itself stayed a constant, so a 55-rated back four cut passes exactly as
        // well as a 90-rated one. That constant was most of why the bands would not separate:
        // completion sat at 76-81% everywhere and a 26-point mismatch held 57% of the ball.
        let r = (isRcv ? CFG.reach
                       : CFG.cutReach * (CFG.cutAntLo + Math.max(0, meTech(meAttrs(q).position) - (sd !== mp.side ? meDefLow(q) : 0)) * CFG.cutAntW))
              * (1 - fast * CFG.fastDodge);
        // Blocking a shot is the same reach as everything else. A separate, larger blocking radius
        // had a defender sweeping a 3.1 m corridor -- five times his own body -- so a crowded box
        // absorbed almost everything struck into it.
        // ...back, and smaller, now that the contest is TIMED. The 3.1 m corridor was a radius swept
        // along the whole slice; a defender now has to be in the line at the moment the ball passes,
        // and at the ordinary reach blocked shots fell from 15% to 9%. A man throwing himself at a
        // shot -- a leg out, a slide -- gets blockReach, against a live shot from the other side only.
        if (mp.shot && mp.shot.side !== sd && !mp.shot.pen && zAt < CFG.bodyH) r = Math.max(r, CFG.blockReach + (meBadgeFx(q).block ?? 0));
        // The man already running with it has a head start on his own touch -- but only a head
        // start. Anyone who genuinely gets to the ball first takes it off him: that is tackling now.
        if (mp.idx === i && mp.side === sd) r += CFG.touchStick + meAttrs(q).strength / 99 * CFG.touchWin;
        // ...and GETTING A FOOT IN is a skill somebody has. `tackle` was computed for all twenty-two
        // men every match and read by nothing at all -- the one line that mentioned it was the line
        // that assigned it -- so a defender's defending rating reached the pitch through no channel
        // whatsoever. Measured: dropping a back four and a keeper from 70 to 50 changed goals
        // conceded from 4.86 to 4.86.
        // It belongs HERE, in the challenge, because this is where the ball is actually taken off
        // somebody. It applies only against a man in possession: reading a loose ball or a pass is
        // anticipation, which is `position`, and stretching for one is reach, which everybody has.
        // Strength already sat on the other side of this duel as the carrier's head start; it simply
        // had nothing to be a duel against.
        else if (mp.idx >= 0 && mp.side !== sd) r += Math.max(0, meTech(meAttrs(q).tackle) - meDefLow(q)) * CFG.tackleReach;
        // IN THE AIR he is not stretching a boot out, he is getting up. Reach stops being what a
        // foot can span and becomes how well he attacks the ball, which is the aerial duel: put two
        // men under the same cross and the bigger one wins it, with no separate roll to decide it.
        if (zAt > CFG.headMinZ) r = CFG.headReach * (CFG.headLo + (1 - CFG.headLo) * meAttrs(q).air / 99);
        return r;
      };
      // WHO MEETS IT FIRST. At pass speed the ball covers a metre and a half in a slice, so "nearest
      // body to the segment" samples the race at the wrong instant: a defender the ball crossed at
      // the START of that segment lost to a receiver sitting at the end of it. On top of that the
      // man it was played to used to be handed it outright whenever he was within his own reach, so a
      // defender standing 0.1 m off the line lost the ball to a receiver 0.6 m off it. Measured, 35
      // of the 74 passes that came within 0.6 m of an opponent's boot still reached their man -- a
      // ball passing straight through somebody. Order ALONG THE PATH settles it, with no override.
      // ...and now it is asked where it is decided: every substep, against where each man actually is
      // at that moment on his own line through the slice, so the first man the ball really reaches
      // is the one who plays it. The keeper is his capsule along the dive he is making (mePoses).
      // A ball at a man's FEET is a different question: he is in contact with it, so while he has it
      // an opponent takes it only by getting a boot nearer than his, which is what tackling is --
      // and a team-mate never takes it off him at all.
      const probe = (jj, f) => {
        if (mp.bz >= CFG.gkHigh) return null;
        const v2 = Math.hypot(mp.bvx, mp.bvy);
        const fast = Math.max(0, Math.min(1, (v2 - CFG.fastDodgeV0) / (CFG.fastDodgeV1 - CFG.fastDodgeV0)));
        let best = null, bm = Infinity, carM = Infinity;
        for (const sd of ME_SIDES) for (let i = 0; i < s.players[sd].length; i++) {
          const q = s.players[sd][i];
          if (!q || q.off) continue;                 // sent off: he is not on the pitch
          if (meLockedOut(mp, sd, i)) continue;
          // It is in his hands. There is no contest for that -- which is exactly why collecting it is
          // the safest thing a keeper can do, and why he should want to.
          if (mp.held && !(mp.idx === i && mp.side === sd)) continue;
          // THE PLANNED SAVE (keeper.ts), on the clock of the substep: set until he reacts, then across
          // to where the ball is going, stretching to full length. Standing he covers his set reach;
          // diving, his body along the dive and a hand's grab beyond it. Nothing over his head.
          const gp = mp.shot?.gk ?? mp.gkPlan;
          if (gp && gp.side === sd && gp.i === i) {
            if (mp.bz > CFG.gkReachZ) continue;
            const tS = Math.max(0, (mp.tick - gp.t0 - 1 + f) * ME_DT);
            const [gcx, gcy, gux, guy, gext] = meGkAt(gp, tS);
            const ax = gcx - gux * gext, ay = gcy - guy * gext, ex = 2 * gux * gext, ey = 2 * guy * gext, e2 = ex * ex + ey * ey;
            const tt = e2 > 1e-6 ? Math.max(0, Math.min(1, ((mp.bx - ax) * ex + (mp.by - ay) * ey) / e2)) : 0;
            const dg = Math.hypot(mp.bx - (ax + ex * tt), mp.by - (ay + ey * tt));
            // Standing -- before he goes, or when there is nowhere to go -- he covers his set reach.
            // Stretched out, his body along the dive and a hand's grab past it. Shrinking to the
            // grab alone the moment he had reacted left a ball struck straight at him to bounce
            // off his chest instead of being saved.
            // ...and at full stretch the CORNERS are the hard part: a ball in the top corner or along the
            // floor by the post is further from a body flying flat across the goal than one at his
            // waist, which is what a finish placed there is for.
            const stretch = gext / CFG.gkSpan;
            const dzH = Math.max(0, mp.bz - CFG.gkZHi) + Math.max(0, CFG.gkZLo - mp.bz);
            // ...but only a LONG dive lays him flat. The cost was charged on any dive at all, so a keeper
            // who stepped 0.8 m across was as flat as one who flew to the post: at full stretch his
            // reach came to 0.5 m less a metre for every metre over 1.7, and a free kick dipping in at
            // 2.25 m straight at his chest could not be saved by anybody. A dive gkFlatL long pays it all.
            const flat = Math.min(1, (gp.L ?? CFG.gkFlatL) / CFG.gkFlatL);
            const rg = gp.set + (gp.grab + CFG.bodyR - gp.set) * stretch - dzH * stretch * flat * CFG.gkZCost;
            if (dg < rg && dg - rg < bm) { bm = dg - rg; best = { kind: "reach", q, sd, i, d: dg, r: rg, qx: gcx, qy: gcy, z: mp.bz }; }
            continue;
          }
          const qx = q.x + (q._pvx ?? 0) * f, qy = q.y + (q._pvy ?? 0) * f;
          // Well beyond the 3.2 m below on the squared distance -- strictly beyond, so the exact test
          // would rule him out too -- costs no root. A diving keeper is a body, not a point: he is not.
          if (!(q.pos === "GK" && q._pext > 0)) { const ex0 = mp.bx - qx, ey0 = mp.by - qy; if (ex0 * ex0 + ey0 * ey0 > 10.2401) continue; }
          let d = Math.hypot(mp.bx - qx, mp.by - qy);
          if (q.pos === "GK" && q._pext > 0) {
            // A DIVING KEEPER IS NOT A SPHERE: fully stretched he is about two metres fingertip to
            // toe, along the line he is diving. Nothing but his body -- the right SHAPE for a man in
            // the air, and it only opens up when he is actually going.
            const ax = qx - q._pux * q._pext, ay = qy - q._puy * q._pext;
            const ex = 2 * q._pux * q._pext, ey = 2 * q._puy * q._pext, e2 = ex * ex + ey * ey;
            const t = e2 > 1e-6 ? Math.max(0, Math.min(1, ((mp.bx - ax) * ex + (mp.by - ay) * ey) / e2)) : 0;
            d = Math.hypot(mp.bx - (ax + ex * t), mp.by - (ay + ey * t));
          }
          if (d > 3.2) continue;
          const r = reachOf(q, sd, i, mp.flight && sd === mp.fside && i === mp.fj, mp.bz, fast, f);
          if (r < 0 || d >= r) continue;             // he cannot get to it at all
          const m = d - r;
          if (mp.idx === i && mp.side === sd) { carM = m; continue; }
          if (mp.idx >= 0 && sd === mp.side && !(q.pos === "GK" && mp._ownIn === sd)) continue;
          if (m < bm) { bm = m; best = { kind: "reach", q, sd, i, d, r, qx, qy, z: mp.bz }; }
        }
        if (best && (mp.idx < 0 || bm < carM)) return best;
        // THE MAN ON THE BALL PLAYS IT AGAIN when it is back at his feet and not running away from
        // him -- see touch.ts. Never twice inside dribGap: that is a stride.
        if (mp.idx >= 0 && !mp.held && mp.bz < CFG.touchZ) {
          const c = s.players[mp.side][mp.idx];
          if (c && subNow(jj) - (c._tchAt ?? -1e9) >= CFG.dribGap / BALL_SUB) {
            const cx = c.x + (c._pvx ?? 0) * f, cy = c.y + (c._pvy ?? 0) * f;
            const gx = mp.bx - cx, gy = mp.by - cy, g = Math.hypot(gx, gy);
            if (g < CFG.dribTouchR) {
              const rvx = mp.bvx - (c._pvx ?? 0) / ME_DT, rvy = mp.bvy - (c._pvy ?? 0) / ME_DT;
              if ((g > 0.01 ? (gx * rvx + gy * rvy) / g : 0) < 0.25) return { kind: "dribble", c, cx, cy };
            }
          }
        }
        return null;
      };
      const respond = (c) => {
      const bi = c.i, bs = c.sd, bd = c.d, br = c.r;
      mp.gkPlan = null;                              // whoever touched it, the ball is a new ball
      if (mp.bpass && mp.bpass !== bs) mp.bpass = null;    // an opponent's touch ends a back-pass
      // Harness-only ledger of how the ball changes hands (gated like __fire; the app never sets it).
      if (globalThis.__rx && mp.idx >= 0 && mp.side !== bs) globalThis.__rx.steal = (globalThis.__rx.steal || 0) + 1;
      const isGK = s.players[bs][bi].pos === "GK";
      const reach = br;
      {
        const q = s.players[bs][bi], qa = meAttrs(q);
        const v2d = Math.hypot(mp.bvx, mp.bvy);
        // Harness-only: the FIRST contact with a ball somebody passed -- who got there, how far from
        // where it was aimed, how high and how fast. Gated like __fire.
        if (globalThis.__pres && mp.passPending && mp.passPending.k && !mp.passPending._seen) {
          const pp0 = mp.passPending; pp0._seen = 1;
          globalThis.__pres.push({ k: pp0.k, who: bs !== pp0.side ? "opp" : bi === pp0.fj ? "rcv" : "mate",
            d: +Math.hypot(mp.bx - (pp0.ax ?? mp.bx), mp.by - (pp0.ay ?? mp.by)).toFixed(1),
            past: pp0.ax === undefined ? 0 : +(((mp.bx - pp0.sx) * (pp0.ax - pp0.sx) + (mp.by - pp0.sy) * (pp0.ay - pp0.sy))
                  / Math.max(0.1, Math.hypot(pp0.ax - pp0.sx, pp0.ay - pp0.sy)) - Math.hypot(pp0.ax - pp0.sx, pp0.ay - pp0.sy)).toFixed(1),
            z: +mp.bz.toFixed(1), v: +v2d.toFixed(1), t: pp0.t,
            late: bi === pp0.fj && bs === pp0.side ? 0 : +Math.hypot(s.players[pp0.side][pp0.fj]?.x - mp.bx, s.players[pp0.side][pp0.fj]?.y - mp.by).toFixed(1) }); }
        // HANDBALL. Only askable now that the ball is an object with a height: it struck him above
        // waist height, inside his own area, off an opponent's touch. An event engine had nothing to
        // test -- there was no ball and no arm for it to hit.
        // ...at the height it STRUCK him. Read off the end of the slice, a dropping ball had landed
        // and settled at ballR by then: zero handballs a match even with the probability forced to 1,
        // while the geometry occurs about three times a match. The contest is now found at the substep
        // it happens, so this is simply the ball's height when he met it.
        const zHit = c.z;
        const hbGeo = !isGK && zHit > CFG.handMinZ && mp.lastSide && mp.lastSide !== bs
            && Math.abs(q.x - meGoalX(meOther(bs))) < CFG.gkBoxR
            && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW;
        if (hbGeo && globalThis.__hb) globalThis.__hb.geo++;
        if (hbGeo && rng.u() < CFG.handP) {
          if (globalThis.__hb) { globalThis.__hb.given++; if (mp.shot && mp.shot.side !== bs) globalThis.__hb.shot++; }
          out.fouls[bs]++;
          // A HANDBALL CARRIES A CARD, and this one never did: deliberate handball was a penalty
          // and nothing else, so a defender could punch one off the line all match for free. If it
          // stopped a shot that was on its way in, that is denying a goal and he goes; otherwise it
          // is the ordinary caution for a deliberate one.
          const hbGoal = !!mp.shot && mp.shot.side !== bs;
          if (hbGoal) meRed(s, out, bs, q, "dogso", mp.bx, mp.by);
          else if (rng.u() < CFG.handCardY) {
            q.yc = (q.yc || 0) + 1;
            meRate(q, -CFG.rateYellow);
            (out.yellows = out.yellows || { home: 0, away: 0 })[bs]++;
            meEvt(out, "yellow", bs, mp.bx, mp.by, mp.bx, mp.by, `Booked, ${q.fullName || q.name}`);
            if (q.yc >= 2) meRed(s, out, bs, q, "second", mp.bx, mp.by); else meBook(out, bs, q);
          }
          if (!hbGoal) meEvt(out, "foul", bs, mp.bx, mp.by, mp.bx, mp.by, `Handball, ${q.fullName || q.name}`);
          meDead(s, "penalty", meOther(bs), 470, out);
          return true;
        }
        // A HEADER IS NOT A TOUCH. Above headMinZ he has no foot on it and no control -- he gets his
        // head to it and it goes where his head sends it. That is why heading is a way of MOVING the
        // ball rather than a way of keeping it, and treating a won header as clean possession was
        // worth twelve extra shots a match: a man rose in a crowded box and landed with it at his
        // feet, every time, with nobody able to contest what came next.
        // ...AND ONLY IF HE HAS TO. The gate was ball height alone, so a ball dropping gently onto
        // a man's chest at walking pace was headed away exactly like a driven cross: measured, 37.4%
        // of all headers were struck on a ball slow enough and low enough to have been controlled.
        // A footballer heads what he cannot kill. The threshold therefore rises as the ball slows --
        // at pace it is headMinZ as before, and at a standstill he has to reach headSlowLift higher
        // before heading is the only thing available.
        const inV = Math.hypot(mp.bvx, mp.bvy);
        const headZ = CFG.headMinZ + (1 - Math.min(1, inV / CFG.headSlowV)) * CFG.headSlowLift;
        // ...AND WHETHER IT WILL STILL BE OVER HIM WHEN HE GETS TO IT. The gate asked only where the
        // ball is RIGHT NOW, and the contest meets a lofted pass the moment it comes within his reach,
        // so the first time a man can get to one is usually while it is
        // still falling through 1.5-2.6 m ON ITS WAY TO HIS FEET -- and it came off his head instead.
        // Measured, 73% of all headers were struck on a ball that would have been in ordinary touch
        // range a quarter of a second later, at a median 1.94 m falling at 5.79 m/s. The slow-ball
        // rule above never touched those: it reaches about a tenth of the population and doubling
        // headSlowLift is byte-identical.
        //
        // This was written once, reverted on the grounds that 21 headers a match is already short of
        // a real 30-45, and reinstated because that comparison was wrong. THIS MATCH PRODUCES ABOUT
        // A FIFTH OF A REAL ONE'S EVENT VOLUME -- 104 passes a side against a real 500 -- so a real
        // match's 55-70 headed contacts is 12-15 here, not 40. At 21 the engine was heading roughly
        // 1.7x too much, and the surplus is exactly the population this term removes.
        const zNext = zHit + mp.bvz * ME_DT - 4.905 * ME_DT * ME_DT;
        // ...UNLESS SOMEBODY IS ON HIM. Letting it drop to your feet is only the better ball when
        // you will still have it once it lands: with a marker inside headDuelR the wait is how you
        // get robbed, and a real player attacks it with his head. The drop-wait veto is waived in
        // a crowd, which is most of the box at a corner -- exactly the low-reaction moments where
        // heading it is the point.
        const duel = !isGK && meOppDist(s, bs, q.x, q.y) < CFG.headDuelR;
        // Behaviour audit (test/behav.mjs): every gate that is supposed to bite reports whether
        // it ever did. A zero here is the bug -- headHoldZ sat at 0 for weeks and this veto never
        // fired once. Gated on a global the app never sets.
        if (globalThis.__fire && !isGK && zHit > headZ) {
          globalThis.__fire.headTry = (globalThis.__fire.headTry || 0) + 1;
          if (!(zNext > CFG.headHoldZ || duel)) globalThis.__fire.headWait = (globalThis.__fire.headWait || 0) + 1;
          else if (duel && !(zNext > CFG.headHoldZ)) globalThis.__fire.headDuel = (globalThis.__fire.headDuel || 0) + 1;
        }
        if (!isGK && zHit > headZ && (zNext > CFG.headHoldZ || duel)) {
          // THE DUEL. A ball delivered to him in a crowd is jumped for. Whoever reached it first along the flight
          // used to have it outright, so a marker a stride behind his man never challenged and crosses into a
          // packed box found their man 35% of the time against a real 20%. With an opponent inside airR he wins
          // it only if he wins the duel -- strength, who is goal-side, how close the other man got -- and losing
          // it, the other man heads it clear. The tackle has always been settled this way (mind/duel.ts).
          if (mp.passPending && mp.passPending.side === bs) {
            const ob = meOther(bs), gxD = meGoalX(bs);
            let c = null, ci = -1, cd = CFG.airR;
            s.players[ob].forEach((o, j) => { if (o && !o.off && o.pos !== "GK") { const d = Math.hypot(o.x - q.x, o.y - q.y); if (d < cd) { cd = d; c = o; ci = j; } } });
            if (c) {
              const goalSide = Math.abs(gxD - c.x) < Math.abs(gxD - q.x);
              const pDef = Math.max(0.05, Math.min(0.85, CFG.airDef + (meAttrs(c).air - meAttrs(q).air) / 99 * CFG.airStr
                                                         + (goalSide ? CFG.airGoalSide : -CFG.airGoalSide) - Math.max(0, cd - 0.8) * CFG.airDist));
              if (rng.u() < pDef) {
                mp.bz = Math.max(CFG.ballR, zHit); mp.bpass = null;
                mp.lastSide = ob; meKickedBy(mp, ob, ci);
                c.aerials = (c.aerials || 0) + 1; meRate(c, CFG.rateAerial);
                c.defActs = (c.defActs || 0) + 1; out.clears++; meBump(out, "clearsSide", ob);
                mp.idx = -1; mp.flight = true; mp.fside = ob; mp.fj = -1; mp.passPending = null;
                const ax = gxD - c.x, ay = ME_HALF_W - c.y, al = Math.hypot(ax, ay) || 1;
                const tx = c.x - ax / al * CFG.headOut, ty = c.y - ay / al * CFG.headOut + (rng.u() - 0.5) * 14;
                meEvt(out, "clear", ob, c.x, c.y, tx, ty, null);
                meKnock(mp, rng, tx, ty, CFG.headClearV * (CFG.headLo + meAttrs(c).air / 99 * (1 - CFG.headLo)), CFG.headClearVz);
                mp._loose = mp.tick; mp._looseWhy = "won header";
                if (globalThis.__airDuel) globalThis.__airDuel.push({ won: 0, pDef });
                return true;
              }
              if (globalThis.__airDuel) globalThis.__airDuel.push({ won: 1, pDef });
            }
          }
          // HE HEADS IT WHERE HE MET IT. The ground branch below rewinds the ball to the contact
          // point; this one never did, so the header was struck FROM the end-of-slice position --
          // up to a couple of metres past his head along the old flight -- and on screen the ball
          // sailed through him, then came back out in the new direction. That is the backwards
          // clip. Contact is at bt along the swept path, at the height the gate already computed.
          mp.bz = Math.max(CFG.ballR, zHit);
          mp.bpass = null;                             // a header back to him he may pick up
          const gxA = meGoalX(bs), ownA = meGoalX(meOther(bs));
          const dGoalA = Math.hypot(gxA - q.x, ME_HALF_W - q.y);
          const power = CFG.headLo + meAttrs(q).air / 99 * (1 - CFG.headLo);
          if (globalThis.__hdr) { const pp0 = mp.passPending;
            globalThis.__hdr.push({ k: pp0 ? (pp0.k || "set") : mp.shot ? "shot" : mp.flight && mp.fj < 0 ? (mp._looseWhy || "clear") : "loose",
                                    mine: pp0 ? (pp0.side === bs ? 1 : 0) : -1, rcv: pp0 && pp0.side === bs && pp0.fj === bi ? 1 : 0,
                                    z: +zHit.toFixed(2), duel: duel ? 1 : 0 }); }
          mp.lastSide = bs; meKickedBy(mp, bs, bi);
          q.aerials = (q.aerials || 0) + 1; meRate(q, CFG.rateAerial);
          mp.idx = -1; mp.flight = true; mp.fside = bs; mp.fj = -1; mp.passPending = null;
          if (dGoalA < CFG.headShotR && !mp.shot) {
            // Close enough to attack it: a header at goal, and it counts as a shot like any strike.
            out.shots[bs]++;
            // ...AND IT DID NOT COUNT ITS xG, which is what "like any strike" was supposed to mean.
            // A strike adds out.xgS[side] += act.p sixteen lines below; this counted the shot, made
            // the shot object and emitted the shot event, and skipped the only line that feeds the
            // expected-goals model. Every header at goal was therefore free: it could score, and it
            // registered nothing to have scored from.
            // Measured before the fix, goals a match against the engine's own total xG: Balanced
            // 1.50 against 1.118, Control Possession 1.58 against 0.950, Route One 1.33 against
            // 0.880. About a quarter of all scoring arrived with no xG behind it -- and unevenly,
            // 40% of Control Possession's goals against 11% of Park The Bus's, so every balance
            // reading taken on xGD was biased BETWEEN the styles it was comparing.
            // Priced with the same model a strike uses, from where the header is met, and then at
            // headXg of it: shipped at parity, a header was credited twice what it scored (config).
            const hp = meXgCal(meShotP(s, bs, q, q.x, q.y, true)) * CFG.headXg;
            if (out.xgS) out.xgS[bs] += hp;
            if (out.shotDist) { out.shotDist[Math.min(9, Math.floor(dGoalA / 5))]++;
                                out.xg = (out.xg || 0) + hp; }
            const aimY = ME_HALF_W + (q.y < ME_HALF_W ? 1 : -1) * GOAL_HALF_W * CFG.headAim;
            mp.shot = { side: bs, name: q.name, full: q.fullName || q.name, i: bi, t0: mp.tick, p: q, xg: hp,
                        xgN: meXgCal(meShotP(s, bs, q, q.x, q.y, true, CFG.gkRefSkill)) * CFG.headXg,
                        lt: mp.tick - (mp._loose ?? -1e9), pt: mp.possT ?? -1, d: dGoalA, hdr: 1 };
            if (globalThis.__shots) globalThis.__shots.push({ side: bs, d: dGoalA, pt: mp.possT ?? -1,
              lt: mp.tick - (mp._loose ?? -1e9), press: 0, xg: hp, hdr: 1, why: mp._looseWhy });

            // Headers goalwards are frequent and mostly speculative; the ones that matter
            // arrive as a save, a miss or a goal a moment later and those still report.
            meEvt(out, "shot", bs, q.x, q.y, gxA, aimY, null);
            // The delivery that made the header is a chance created too. Counted, not rated:
            // header shots never carried the key-pass rating and changing that would move every
            // baseline for a bookkeeping stat.
            { const lg2 = mp.tlog || [];
              for (let k2 = lg2.length - 1; k2 >= 0; k2--) {
                const e2 = lg2[k2];
                if (e2.s !== bs && e2.d) continue;
                if (e2.s !== bs) break;
                if (e2.i !== bi) { const kp2 = s.players[bs]?.[e2.i];
                  if (kp2) kp2.cc = (kp2.cc || 0) + 1; break; }
              } }
            // A HEADER IS NOT A LASER. It was knocked at its target with no error at all, so every
            // header at goal went exactly where it was meant to, low, at 0.55 of the way to the post.
            // How wide it goes is the man (a strong header of a ball is a good one), whether somebody
            // is jumping with him, and how hard the ball was coming.
            {
              const hs = meAttrs(q).air / 99;
              const hw = CFG.headNoise * (1 - CFG.headNoiseSkill * hs) * (1 + (duel ? CFG.headNoiseDuel : 0))
                       * (1 + Math.min(1, inV / 20) * CFG.headNoisePace) * Math.PI / 180;
              const ha = Math.atan2(aimY - q.y, gxA - q.x) + (rng.u() + rng.u() - 1) * hw;
              const hd = Math.hypot(gxA - q.x, aimY - q.y);
              meKnock(mp, rng, q.x + Math.cos(ha) * hd, q.y + Math.sin(ha) * hd, CFG.headV * power,
                      0.35 + (rng.u() - 0.5) * CFG.headNoiseZ * (1 + (duel ? CFG.headNoiseDuel : 0)));
            }
            mePlanSave(s, mp.shot);
          } else {
            // A HEADER AT HALFWAY IS NOT A CLEARANCE. Every won aerial duel outside heading range of
            // goal was counted in out.clears, given the clearance rating bonus and drawn on the pitch
            // in clearance green -- measured, 23.5 of the 27.8 "clearances" a match were headers and
            // half of them were struck beyond 45 m from the header's own goal. A clearance is RELIEF,
            // so like the struck one in decide.ts it only exists where there is something to be
            // relieved of; everywhere else the same contact is a knock-down, and a knock-down is
            // aimed at somebody rather than hoofed blind at a compass bearing.
            const bdir = meDir(bs), hDepth = (q.x - ownA) * bdir;
            const relief = hDepth < CFG.clearDepth;
            // The contact itself is unchanged. Heading it AT somebody -- the best man within reach,
            // led two metres into his path -- was tried and is not a knock-down, it is a pass off
            // the head: goals went from 1.42 a side to 2.58 and conversion from 13% to 22%, because
            // every won header near the box teed a team-mate up. A flick is a ball into an area.
            const ax = ownA - q.x, ay = ME_HALF_W - q.y, al = Math.hypot(ax, ay) || 1;
            const tx = q.x - ax / al * CFG.headOut, ty = q.y - ay / al * CFG.headOut + (rng.u() - 0.5) * 14;
            if (relief) { out.clears++; meBump(out, "clearsSide", meSideOfP(s, q)); meRate(q, meDefPay(s, meSideOfP(s, q), q.x, q.y, CFG.rateClear));
                          q.defActs = (q.defActs || 0) + 1; }
            // A RELIEF HEADER IS A CLEARANCE AND HAS TO TRAVEL LIKE ONE. At headV * power * 0.75
            // it left his head at 5-9 m/s with almost no loft and carried six to ten metres --
            // the arithmetic of the knock against the aim is why "clearances barely do anything":
            // the ball landed on the edge of his own box at a fifty-fifty. A defensive header is
            // the one contact a defender puts everything through: headClearV and a real loft
            // carry it past the second ball.
            if (relief) {
              meEvt(out, "clear", bs, q.x, q.y, tx, ty, null);
              meKnock(mp, rng, tx, ty, CFG.headClearV * power, CFG.headClearVz);
              mp._loose = mp.tick; mp._looseWhy = "relief header";
              return true;
            }
            if (meFlick(s, rng, out, bs, bi, q, power)) return true;
            // Neither a flick-on nor a header away is commentary. Measured, captioned events ran
            // 142 a match against a feed that holds 60, so the routine kinds were literally pushing
            // the goals off the end of the buffer -- which is what the "only second half" summary
            // turned out to be. Everything muted here still FIRES: the pitch draws it and every
            // counter, out.clears and the player T+C column included, still moves.
            meEvt(out, relief ? "clear" : "head", bs, q.x, q.y, tx, ty, null);
            meKnock(mp, rng, tx, ty, CFG.headV * power * 0.75, 0.9);
            mp._loose = mp.tick; mp._looseWhy = "knock-down header";  // a headed ball into an area is nobody's yet
          }
          return true;
        }
        // He touched it WHERE HE TOUCHED IT. A struck shot covers six metres in a quarter of a
        // second, so the ball's end-of-slice position is routinely well past him -- and for a shot
        // on target, past the line. Everything below was working off that: the parry normal pointed
        // INTO the goal, so his shove went with it, and the crossing was then adjudicated anyway, so
        // one shot was scored as a save AND a goal. The contact point is where the save happened.
        // ...and this is true of EVERYBODY, not just the keeper. The contest is against the path the
        // ball swept this slice -- at 6.7 m/s that is 1.7 m of it -- so a man who got a foot to it
        // early on that sweep was having the ball placed wherever the slice happened to END, up to
        // a metre and a half further on. On screen the ball snaps sideways into him, which reads as
        // an enormous hitbox when the reach is really 0.6 m: measured, interceptions happen at a
        // median of 0.43 m from the path and a 90th percentile of 0.57.
        // ...and it now is by construction: the contact is found at the substep it happens, so the ball
        // is where he touched it and nothing has to be wound back.
        if (!(mp.idx === bi && mp.side === bs) && isGK && mp.bx > 0.05 && mp.bx < PITCH_L - 0.05) mp._gkTouch = mp.tick;
        // HANDS: in his own area, and not off a team-mate's deliberate kick or throw -- the back-pass law.
        // It used to ask who touched it LAST, so a shot deflected off his own defender, a ricochet off a
        // team-mate's shin and a header back to him all had to be kicked, which the law forbids none of,
        // and he was booting clear balls he should simply have picked up. mp.bpass is set by a kick or a
        // throw and cleared by any other touch. The area is the area: forty metres wide, not a radius.
        const ownG = meGoalX(meOther(bs));
        const inBox = isGK && Math.abs(q.x - ownG) < CFG.gkAreaD && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW;
        const canHandle = isGK && inBox && mp.bpass !== bs;
        // How far beyond his own wingspan he had to go. THAT is what decides whether he holds it:
        // inside his arms he barely moved and he catches it, past them he has dived, and a dive is
        // a deflection. Ball speed does not come into it.
        // How far off centre it struck him. Through his middle he gathers it; off the edge of him
        // it comes back off, and the further out the less of him was behind it.
        // How far off CENTRE it struck him -- not how far off the nearest bit of him, which with a
        // capsule is nearly zero for a fingertip save and would have scored the hardest saves in the
        // game as comfortable catches. Through his middle he gathers it; off the end of an
        // outstretched arm it comes back off him, and that is where rebounds come from.
        const dive = isGK ? Math.max(0, Math.hypot(mp.bx - c.qx, mp.by - c.qy) - CFG.gkCatchR)
                          : Math.max(0, bd - CFG.gkCatchR);
        // CATCH IT WHEN HE CAN. It was a line: anything that struck him more than gkCatchDive off his middle
        // was palmed away however gently it came, and with the save now made by his whole stretched body
        // most balls meet him there -- so he punched crosses he could have held and parried shots at his
        // chest. Now it is how hard the take is -- how far from his middle, how hard it is coming, how many
        // bodies are round him -- against how good his hands are. A slow ball he always holds.
        let hold = false;
        if (canHandle) {
          if (v2d <= CFG.gkLiveV) hold = true;
          else {
            let crowd = 0;
            for (const o of s.players[meOther(bs)]) if (o && !o.off && Math.hypot(o.x - c.qx, o.y - c.qy) < CFG.gkCatchCrowdR) crowd++;
            const dc = Math.max(0, dive - CFG.gkCatchEasy) / CFG.gkCatchSpan + Math.max(0, v2d - CFG.gkCatchV0) / CFG.gkCatchVSpan
                     + Math.min(2, crowd) * CFG.gkCatchCrowd;
            hold = rng.u() < 1 - dc * (CFG.gkCatchLo - CFG.gkCatchSkill * meGkSkill(qa) + meGkLow(qa) * CFG.gkCatchLow);
          }
        }
        if (globalThis.__gkh && isGK) { const H = globalThis.__gkh, w = !canHandle ? "no hands" : v2d <= CFG.gkLiveV ? "slow, held" : hold ? "held" : "parried"; H[w] = (H[w] || 0) + 1; }
        if (isGK && !hold && v2d > CFG.gkLiveV) {
          // Too hot to hold: parried away, still live. This is where rebounds come from.
          const shp = mp.shot;
          if (shp && globalThis.__svd) globalThis.__svd.push([shp.d, 1]);
          if (shp) { out.onTarget[shp.side]++; out.saves[bs]++; q.saves = (q.saves || 0) + 1;
            meRate(q, meSaveBonus(shp.xgN ?? shp.xg, shp.pen) + (shp.pen ? CFG.ratePenSave : 0));
            if (shp.p) meRate(shp.p, CFG.rateShotOn);
            mePenRes(out, shp, null, q);
                     // A MISSED PENALTY IS THE TAKER'S EVENT. Named for the keeper it read as
                     // his save in a feed whose penalty lines are otherwise the taker's, so the
                     // panel showed one man for a scored penalty and another for a missed one.
                     meEvt(out, shp.pen ? "penmiss" : "save", shp.pen ? shp.side : bs, mp.bx, mp.by, mp.bx, mp.by,
                           shp.pen ? `${shp.full || shp.name} has his penalty saved`
                                   : `${q.fullName || q.name} parries it`); }
          // Whose goal it still is, if this parry ends up in the net. One touch off the keeper is a
          // deflected shot and the goal belongs to the man who hit it; only a ball that comes off him
          // and then off him AGAIN is an own goal.
          if (shp) mp.deflect = { side: shp.side, t: mp.tick,
            n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
          // ...AND THE SAVE IS ONLY A SAVE IF IT STAYS OUT. The counter above fires the moment he
          // gets a hand to it, which is the only moment it CAN fire -- where the ball finishes is
          // twelve slices away. Measured over forty matches: 343 shots on target against 243 saves
          // plus 112 goals, an excess of twelve, and eleven goals had "parries it" as the line
          // immediately before them. So it is banked provisionally and the goal takes it back.
          if (shp) mp._parry = { side: bs, q, t: mp.tick,
                                 credit: meSaveBonus(shp.xgN ?? shp.xg, shp.pen) + (shp.pen ? CFG.ratePenSave : 0) };
          mePenRes(out, mp.shot); mp.shot = null; mp.lastSide = bs; meKickedBy(mp, bs, bi);
          // ...and HE MAY GO STRAIGHT BACK FOR IT. The lock that stops a man re-winning his own kick held
          // the keeper off his own parry for three slices, so one that dropped at his feet and trickled
          // toward the line went in 0.4 m from him. He is kept off it for gkParryLock slices, long
          // enough for the parry to leave his hands.
          mp.kickBy[0].t = mp.tick - CFG.kickLock + CFG.gkParryLock;
          // A REFLECTION off his hands. The surface is square to the line from him to the ball, so
          // angle in equals angle out -- that is the whole geometry of a parry and there is nothing
          // random in it. What varies is how much of a HAND he got on it, and that is how far he had
          // to dive: a firm palm mirrors the ball properly and shoves it clear, fingertips barely
          // change its line at all. v' = v - 2*firm*(v.n)n does both ends of that with one number.
          // Firmness is GEOMETRY, deliberately: how far he had to dive, not how good he is. His
          // rating already reached this save through the read, the reaction and the dive speed that
          // got a hand there at all -- and measured with everything else held identical (gkband.mjs)
          // that is worth half a goal a match across 90 to 45, save percentage 79% down to 66%,
          // which is the real span. A skill term here as well would double-charge it.
          const span = Math.max(0.01, CFG.gkSpan + CFG.bodyR + CFG.ballR - CFG.gkCatchR);
          // Quadratic, not linear: palms, wrists and forearms are firm for most of the span and
          // only the last stretch is a true fingertip. Linear, with contacts landing at 0.9-1.4
          // of a 1.32 m span, called nearly every real save a graze -- and a graze carries in.
          const firm = Math.max(CFG.gkParryFloor, 1 - Math.min(1, (dive / span) * (dive / span)));
          let nx2 = mp.bx - c.qx, ny2 = mp.by - c.qy;
          const nl = Math.hypot(nx2, ny2);
          if (nl < 1e-3) { nx2 = meDir(bs); ny2 = 0; } else { nx2 /= nl; ny2 /= nl; }
          const dotn = mp.bvx * nx2 + mp.bvy * ny2;
          // The MIRROR is physics and may send it anywhere -- that is what a deflection is. The
          // SHOVE is a decision, and no keeper decides to palm the ball into his own net, so any
          // component of it pointing at his goal is taken out.
          let px2 = nx2, py2 = ny2;
          let gx2 = meGoalX(meOther(bs)) - q.x, gy2 = ME_HALF_W - q.y;
          const gl2 = Math.hypot(gx2, gy2) || 1; gx2 /= gl2; gy2 /= gl2;
          const gdot = px2 * gx2 + py2 * gy2;
          if (gdot > 0) {
            px2 -= gx2 * gdot; py2 -= gy2 * gdot;
            const pl2 = Math.hypot(px2, py2);
            if (pl2 < 0.1) { px2 = -gx2; py2 = -gy2; } else { px2 /= pl2; py2 /= pl2; }
          }
          const keepV = 1 - (1 - CFG.gkParryE) * firm;         // a firm hand takes the pace off it
          // The shove scales with how hard it arrived. A hand on a ball changes its ANGLE, so a flat
          // few metres a second was nothing against a twenty-five metre-per-second strike -- and a
          // shot already heading for the corner carried on into it. Measured, 15% of parries were
          // forecast to finish in his own net.
          const shove = (CFG.gkParryPush + v2d * CFG.gkParryPushV) * firm;
          let rx = (mp.bvx - 2 * firm * dotn * nx2) * keepV + px2 * shove;
          let ry = (mp.bvy - 2 * firm * dotn * ny2) * keepV + py2 * shove;
          // A FIRM HAND NEVER SCORES ITS OWN NET. Removing the goal-CENTRE component (the shove's
          // rule) still let the residual angle inside the far post, so it is asked as the real
          // question instead: would this result CROSS THE LINE inside the frame? If it would,
          // the same energy is bent round the nearer post -- behind for a corner, which is what
          // a firm save at full stretch actually is. A fingertip below gkParrySafe still carries
          // its own risk, which is the real, rare deflected own-net goal.
          // ...and the gate is a ROLL below gkParrySafe, not a pass. The reach ring grants
          // contacts beyond his physical span, and every one of those is a fingertip by
          // construction -- gating the steer on firmness alone left the whole ring class
          // carrying the ball in, 14.5% of all goals. A graze that genuinely beats the hand
          // now happens at gkGrazeP, which puts deflected own-net goals at the real game's
          // few-percent rather than at the geometry of the ring.
          if (firm >= CFG.gkParrySafe || rng.u() >= CFG.gkGrazeP) {
            const ownX3 = meGoalX(meOther(bs));
            const s3 = Math.sign(ownX3 - (mp.bx - rx * 0.01) || 1);
            if (s3 * rx > 0.01) {
              const tC = (ownX3 - mp.bx) / rx;
              if (tC > 0) {
                const yC = mp.by + ry * tC;
                if (Math.abs(yC - ME_HALF_W) < GOAL_HALF_W + 0.6) {
                  const postY = ME_HALF_W + (yC >= ME_HALF_W ? 1 : -1) * (GOAL_HALF_W + 1.4);
                  const spd3 = Math.hypot(rx, ry);
                  let ax3 = ownX3 - mp.bx, ay3 = postY - mp.by;
                  const al3 = Math.hypot(ax3, ay3) || 1;
                  rx = ax3 / al3 * spd3; ry = ay3 / al3 * spd3;
                }
              }
            }
          }
          const rl = Math.hypot(rx, ry) || 1;
          meKnock(mp, rng, mp.bx + rx / rl * 8, mp.by + ry / rl * 8, Math.min(rl, v2d), 0.6);
          mp._loose = mp.tick; mp._looseWhy = "parry";  // a parry is loose too -- his own to gather
          return;
        }
        if (isGK && mp.shot) {                       // gathered cleanly
          if (globalThis.__svd) globalThis.__svd.push([mp.shot.d, 1]);
          out.onTarget[mp.shot.side]++; out.saves[bs]++; q.saves = (q.saves || 0) + 1;
          meRate(q, meSaveBonus(mp.shot.xgN ?? mp.shot.xg, mp.shot.pen) + (mp.shot.pen ? CFG.ratePenSave : 0));
          if (mp.shot.p) meRate(mp.shot.p, CFG.rateShotOn);
          mePenRes(out, mp.shot, null, q);
          // The SIDE on an event is whose event it is, and a save is the keeper's. Tagged with the
          // shooter it drew the wrong club badge and the wrong colour in the feed, so a goalkeeper
          // keeping his side in it read as something the other lot had done.
          meEvt(out, mp.shot.pen ? "penmiss" : "save", mp.shot.pen ? mp.shot.side : bs,
                mp.bx, mp.by, mp.bx, mp.by,
                mp.shot.pen ? `${mp.shot.full || mp.shot.name} has his penalty saved`
                            : `${q.fullName || q.name} saves`);
          mePenRes(out, mp.shot); mp.shot = null;
        }
        // OFFSIDE. Given when he plays it, not when it was struck: a ball rolled into an offside man
        // that a defender cuts out first is simply a ball a defender cut out.
        if (mp.passPending && mp.passPending.off && mp.flight
            && bs === mp.fside && bi === mp.fj) {
          const pp = mp.passPending; mp.passPending = null;
          (out.offside = out.offside || { home: 0, away: 0 })[bs]++;
          meEvt(out, "offside", bs, pp.ox, pp.oy, pp.ox, pp.oy, `Offside, ${q.fullName || q.name}`);
          mp.bx = pp.ox; mp.by = pp.oy;             // the free kick is where he was standing
          meDead(s, "freekick", meOther(bs), 104, out);
          stopTick = true;                          // and the tick ends here, as a foul's does
          return true;
        }
        // A ball quicker than your touch squirts off you. First contact still changes everything --
        // it kills most of the pace and it counts as a touch for last-man bookkeeping.
        if (v2d > CFG.controlV + meTech(qa.pass) * CFG.controlVSkill) {
          // A deflection. If a shot was live, that was a block.
          // Which of the two it was decides whether an assist survives it, and the block branch
          // below clears mp.shot -- so the question has to be asked here, before the answer is gone.
          const wasBlock = !!(mp.shot && bs !== mp.shot.side);
          if (mp.shot && bs !== mp.shot.side) { out.blocked = (out.blocked || 0) + 1;
            meBump(out, "blockedSide", bs);
            meRate(q, meDefPay(s, meSideOfP(s, q), q.x, q.y, CFG.rateBlock));
            meEvt(out, "block", mp.shot.side, mp.bx, mp.by, mp.bx, mp.by, `${q.fullName || q.name} blocks it`);
            // Same rule as a parry: a shot that goes in off a DEFENDER is a deflected goal for the
            // man who hit it, not the defence putting it through their own net. Only a ball that
            // comes off the defending side twice is an own goal.
            mp.deflect = { side: mp.shot.side, t: mp.tick,
              n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
            mePenRes(out, mp.shot); mp.shot = null; }
          // A block ends the move: a goal off the rebound is nobody's assist. A deflection of a pass
          // does not, so the chain reads through it to the man who played the ball.
          mp.lastSide = bs; meKickedBy(mp, bs, bi, !wasBlock); mp.bpass = null;
          mp._loose = mp.tick; mp._looseWhy = "deflection";  // a squirt off a man: loose, not a backpass
          // Biased off the goalward line -- see CFG.deflectAway.
          const ownX = meGoalX(meOther(bs));
          const gwd = Math.sign(ownX - mp.bx) || 1;
          const away = mp.bvx * gwd > 4 ? -gwd * CFG.deflectAway : 0;
          meKnock(mp, rng, mp.bx + (rng.u() - 0.5) * 8 + away, mp.by + (rng.u() - 0.5) * 8,
                  v2d * CFG.deflectKeep, 0);
          return;
        }
        // A BLOCK IS A BLOCK AT ANY SPEED. The counter above only fires on the branch for a ball
        // travelling faster than a man can control, so a defender who got a foot to a shot that had
        // already slowed was recorded as an ordinary change of possession and nothing else.
        // Measured: 4.6% of shots were counted blocked and another 15.0% were blocked without being
        // counted, so the real figure was 19.6% against a reported 4.3% -- and every conclusion
        // drawn from that number, including three rounds of work on defensive positioning that was
        // not actually broken, was drawn from a stat that was undercounting by four times.
        // Asked BEFORE the branch below clears mp.shot, the same way the fast one asks it: the toe
        // branch further down needs to know whether this contact was a block.
        const wasBlockSlow = !!(mp.shot && bs !== mp.shot.side);
        if (mp.shot && bs !== mp.shot.side) {
          out.blocked = (out.blocked || 0) + 1; meBump(out, "blockedSide", bs);
          meRate(q, meDefPay(s, meSideOfP(s, q), q.x, q.y, CFG.rateBlock));
          meEvt(out, "block", mp.shot.side, mp.bx, mp.by, mp.bx, mp.by, `${q.fullName || q.name} blocks it`);
          mp.deflect = { side: mp.shot.side, t: mp.tick,
            n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
          mePenRes(out, mp.shot); mp.shot = null;
        }
        const _cut = !!(mp.passPending && mp.passPending.side !== bs);
        if (globalThis.__pftk) mp._lastPk = mp.passPending && mp.passPending.side === bs && mp.passPending.fj === bi ? mp.passPending.k : "-";
        resolvePending(bs);
        mp.flight = false;
        if (mp.idx === bi && mp.side === bs) return false;    // still his: not a new touch
        // READING IT. Stepping across somebody else's pass was the one defensive act that was free:
        // the passer paid for it, and the man who read it was paid nothing and counted nowhere, so he
        // finished the afternoon indistinguishable from the man beside him who read nothing. It is
        // paid on the clean pickup -- a touch that comes off him has already returned -- and it
        // counts as a defensive action. Outfielders only: the keeper is rated on goals prevented and
        // nothing else, by design.
        const payRead = () => { if (_cut && !isGK) { q.ints = (q.ints || 0) + 1; q.defActs = (q.defActs || 0) + 1;
                                  meRate(q, meDefPay(s, meSideOfP(s, q), q.x, q.y, CFG.rateIntercept)); } };
        // ...and if he was entitled to use them, it is now IN HIS HANDS. Nobody can take it off him
        // and he is not carrying it under his feet, so it sits out in front of him where it can be
        // seen. It used to be left at whatever coordinates it was claimed at, which for a keeper
        // smothering at close range is his own centre -- the ball drawn inside the man.
        if (canHandle) {
          payRead();
          meBallTo(s, bs, bi, mp.bx, mp.by);
          mp.held = true;
          let hx2 = q.vx || 0, hy2 = q.vy || 0;
          let hl = Math.hypot(hx2, hy2);
          if (hl < 1e-3) { hx2 = meDir(meOther(bs)); hy2 = 0; hl = 1; }
          mp.bx = q.x + hx2 / hl * CFG.gkHoldOut; mp.by = q.y + hy2 / hl * CFG.gkHoldOut;
          mp.bvx = 0; mp.bvy = 0; meBallPredict(mp);
          return true;
        }
        // FIRST TIME (meFirstTime): the lay-off, the wall pass, the ball round the corner, the tap-in --
        // played on at the substep it reaches him, from where he met it, before anything is stopped.
        if (!isGK && zHit < CFG.ftMaxZ) {
          const fa = s.brain === 2 ? mindFirstTime(s, bs, bi, zHit) : meFirstTime(s, rng, bs, bi, zHit);
          if (fa) {
            payRead();
            const z0 = mp.bz;
            meBallTo(s, bs, bi, mp.bx, mp.by);
            mp.bz = Math.max(CFG.ballR, z0);
            q._tchAt = subNow(c.at);
            if (globalThis.__pk) globalThis.__pk._ft = (globalThis.__pk._ft || 0) + 1;
            mePlay(s, rng, out, bs, bi, fa, mePressure(s, bs, q.x, q.y), false);
            return true;
          }
        }
        // THE FIRST TOUCH (touch.ts). He takes it the way he is about to run with it -- the same
        // eight-way search the dribble uses -- and how hard the ball is to take, against how good his
        // touch is, decides whether it sticks and how close to his line and his lead it goes. It used
        // to be one formula for everybody: the ball's pace blended with his run, a flat speed floor
        // over his own, and a squirt below a quality line that a 90 and a 60 crossed almost equally
        // often. Measured before this: a pass to a free man was lost 3.3% of the time by the best
        // touch in the league and 4.5% by the worst.
        const pvx = (q._pvx ?? 0) / ME_DT, pvy = (q._pvy ?? 0) / ME_DT;
        // ...AND HIS MOMENTUM IS PART OF THE ANSWER. Asked with no turn cost, more than half of every
        // first touch taken at a run chose a line over 90 degrees off it; the ball went where he would
        // have been had he turned, he ran on at seven metres a second, and it was behind him. Turning is
        // priced by his pace: a man standing still takes it any way he likes, a man sprinting takes it
        // on in his stride.
        const pvm = Math.hypot(pvx, pvy);
        let uAng = meCarryPick(s, bs, q, pvm > 1 ? Math.atan2(pvy, pvx) : null, CFG.carryTurn + CFG.ftTurnCost * pvm)
                  ?? Math.atan2(pvy, pvx);
        // THE SECOND BRAIN takes the touch toward what he means to do next -- within what his running
        // allows: a man at a sprint takes it on near his own line or checks.
        if (s.brain === 2) {
          const want = mindTouchAngle(s, bs, bi);
          if (want != null) {
            const lim = Math.max(0.8, Math.min(Math.PI, 2.6 - pvm * 0.25));
            const base = pvm > 1 ? Math.atan2(pvy, pvx) : want;
            const off = Math.atan2(Math.sin(want - base), Math.cos(want - base));
            uAng = base + Math.max(-lim, Math.min(lim, off));
          }
        }
        const ft = meFirstTouch(s, rng, bs, q, c.qx, c.qy, pvx, pvy, zHit, reach, uAng);
        if (globalThis.__pftk) globalThis.__pftk.push({ k: mp._lastPk || "-", ok: ft.ok ? 1 : 0, D: +ft.D.toFixed(2) });
        if (globalThis.__rx) { const R = globalThis.__rx; (R.ft = R.ft || []).push([+meTouchTech(q).toFixed(2), +ft.D.toFixed(2), ft.ok ? 1 : 0, mp.flight ? 1 : 0]); }
        if (!ft.ok) {
          // It comes off him. Not his -- and the move it interrupted is not over either: logged as a
          // deflection so the assist walk reads through it, unless it was a block, which really does
          // end a move.
          mp.lastSide = bs; meKickedBy(mp, bs, bi, !wasBlockSlow); mp.bpass = null;
          mp._loose = mp.tick; mp._looseWhy = "miscontrol";
          mp.bvx = ft.vx; mp.bvy = ft.vy; mp.bvz = mp.bz > CFG.ballR + 0.05 ? Math.min(0, mp.bvz) * 0.3 : 0;
          meBallPredict(mp);
          return true;
        }
        // Sending it BEHIND his own run is a check: he stops to take it the other way. Left at full
        // pace he sprints on while it sits behind him, which is the dragging.
        if (!isGK) {
          const qv = Math.hypot(q.vx || 0, q.vy || 0);
          if (qv > 0.02 && (Math.cos(ft.ang) * q.vx + Math.sin(ft.ang) * q.vy) / qv < CFG.ftCheckDot) {
            q.vx *= CFG.ftCheck; q.vy *= CFG.ftCheck;
          }
        }
        payRead();
        meBallTo(s, bs, bi, mp.bx, mp.by);
        mp.bvx = ft.vx; mp.bvy = ft.vy; mp.bvz = 0; mp.bz = CFG.ballR;
        // The touch counts as a touch: he does not play it again inside a stride. And the line he took
        // it on is the line he now carries it along, until the dribble next looks up.
        q._tchAt = subNow(c.at);
        q._drbA = uAng; q._drbWant = uAng; q._drbT = CFG.carryCommit;
        meBallPredict(mp);
        return true;
      }
      };
  // A stoppage called inside the contest ends the slice. Without this the brains and meMove still
  // ran on top of a set piece that had just been set up, and everyone lurched once before the
  // restart shape took over.
  // ...but ending the slice before meMove leaves every _px/_py stale -- meMove's first act is the
  // renderer's tween-origin snapshot -- so on the whistle frame every dot replayed its previous
  // step and snapped back. That one-frame judder was the stutter on every restart: goal kicks,
  // free kicks, offsides, corners alike. The whistle now freezes people HONESTLY: origins synced
  // to where they stand, one genuinely stationary frame, and the restart shape takes over from
  // there. (The invariants note has always said this: anything that stops being moved must have
  // its origin synced.)
  const holdFrame = () => {
    for (const sd of ME_SIDES) for (const q of s.players[sd]) { q._px = q.x; q._py = q.y; }
  };
  // THE SLICE, PIECE BY PIECE. The ball runs until the next thing happens to it, that thing is
  // settled, and the ball runs on from there with whatever it was given -- a touch, a claim, a
  // deflection -- until the slice is used up or the whistle goes. A keeper who gets a hand to a shot
  // does so before the line in this order by construction, so nothing has to be taken back.
  let claimed = false;
  for (let jj = 0; jj < NSUB;) {
    const justKicked = (mp.kickBy || []).filter(k => mp.tick - k.t < CFG.kickLock)
                                       .map(k => s.players[k.s]?.[k.i]).filter(Boolean);
    const ev = meBallRun(mp, all, jj, NSUB, NSUB, mp.idx >= 0 ? s.players[mp.side][mp.idx] : null,
                         justKicked, probe, true);
    if (!ev) break;
    jj = ev.at + 1;
    if (ev.kind === "dribble") {
      mp.gkPlan = null;
      if (globalThis.__rx) globalThis.__rx.drib = (globalThis.__rx.drib || 0) + 1;
      const car = ev.c;
      const t = meDribbleTouch(s, rng, mp.side, car, ev.cx, ev.cy, (car._pvx ?? 0) / ME_DT, (car._pvy ?? 0) / ME_DT);
      mp.bvx = t.vx; mp.bvy = t.vy; mp.bvz = 0; mp.bz = CFG.ballR;
      car._tchAt = subNow(ev.at);
      if (!mp.hitP) { mp.hitP = car; mp.hitV = 0; }
      continue;
    }
    if (ev.kind === "reach") {
      if (respond(ev)) claimed = true;
      if (stopTick) { holdFrame(); return; }
      continue;
    }
    touchSideNow();
    if (ev.kind === "touchline") {
      if (globalThis.__rx) { const R = globalThis.__rx, lg = mp.tlog || [], lt = lg[lg.length - 1];
        const why = mp.idx >= 0 ? "carrier" : mp.flight && mp.fj >= 0 ? "pass" : mp.flight ? "clear/head" : lt && lt.d ? "deflection" : "loose";
        (R.outWhy = R.outWhy || {})[why] = (R.outWhy[why] || 0) + 1; }
      resolvePending(null); mePenRes(out, mp.shot, mp); mp.shot = null;
      meDead(s, "throw", meOther(mp.touchSide), 76, out); holdFrame(); return;
    }
    cross = ev; endOfPlay(); holdFrame(); return;
  }
  meBallPredict(mp);
  // A SHOT THAT HAS STOPPED BEING ONE IS A LOOSE BALL. Nobody chases a shot (meMove) and the keeper
  // is held in his save while it lives, so one that clipped a defender and ran back up the pitch lay
  // dead in the centre circle, unchased, from the 75th minute to the whistle. Once it has died, has
  // been turned away from goal by a touch, or is older than shotMaxT, it is over.
  // A PASS THAT HAS HIT SOMEBODY IS A LOOSE BALL, not a pass still on its way to the man it was meant
  // for: it kept that man's head start and kept the keeper to his boots, so one that came off a
  // defender's shins and died at the keeper's feet was never his to pick up.
  if (mp.flight && !mp.shot && mp.idx < 0 && mp.hitP) { mp.flight = false; mp._loose = mp.tick; mp._looseWhy = "deflect"; }
  if (mp.shot && !mp.shot.pen) {
    const turned = mp.hitP && mp.hitP !== mp.shot.p && meIntoGoal(mp) !== meOther(mp.shot.side);
    if (turned || Math.hypot(mp.bvx, mp.bvy) < CFG.shotOverV || (mp.tick - mp.shot.t0) * ME_DT > CFG.shotMaxT) {
      mePenRes(out, mp.shot); mp.shot = null;
    // ...and one that clipped somebody and is still going in is read again by the keeper (keeper.ts).
    } else if (mp.shot.gk && mp.hitP && mp.hitP.pos !== "GK" && mp.hitP !== mp.shot.p) meReplanSave(s);
  }
  // NOTHING IS HAPPENING. A ball nobody owns that nobody is moving is not a slow passage of play,
  // it is a dead match -- and a dead match is worse than any wrong decision the engine could make
  // instead. The one cause of it is fixed in meMove above, but any future gap between "I have
  // arrived" and "I can touch it" would do exactly the same thing, and it costs four lines to make
  // that class of bug survivable. Give it to the nearest man and let the game go on.
  // ...AND POSSESSION THAT ISN'T REAL IS REVOKED FIRST. mp.idx can survive pointing at a man the
  // ball has stopped dead OUTSIDE the reach of: he cannot touch it, so no decision ever fires (the
  // touch cycle is the only entry), the stall rescue below is gated on idx < 0, and the presser
  // jockeys the spot -- the 90-minute statue match with 95% possession to the beaten side. If he
  // cannot play it and it is not moving, it is nobody's ball, and the ordinary loose machinery
  // (desig, the stall rescue, the press) takes over on the next slice.
  if (mp.idx >= 0 && Math.hypot(mp.bvx, mp.bvy) < CFG.deadBallV) {
    const hp = s.players[mp.side]?.[mp.idx];
    if (!hp || hp.off || Math.hypot(hp.x - mp.bx, hp.y - mp.by) > CFG.holdLostR) {
      if (globalThis.__rx) globalThis.__rx.revoke = (globalThis.__rx.revoke || 0) + 1;
      if (globalThis.__fire) globalThis.__fire.possRevoke = (globalThis.__fire.possRevoke || 0) + 1;
      mp.idx = -1;
    }
  }
  if (mp.idx < 0 && Math.hypot(mp.bvx, mp.bvy) < CFG.deadBallV) {
    if ((mp.stallT = (mp.stallT || 0) + 1) > CFG.stallGrace) { meScramble(s, rng); mp.stallT = 0; }
  } else mp.stallT = 0;

  // ================ 2. THE BRAINS ===========================================================
  // Now they read a settled world: this ball, in this place, belonging to this side.
  // ---- the possession currency -----------------------------------------------------------
  // Every brain downstream keys off this. Per player: how long until I could have the ball
  // (against the forecast when it is loose). Per team: the best of those, and a slew-limited EMA
  // of the CONTEST ratio -- not who holds it, but who would win the race to it. During a fifty-
  // fifty the balance already moves; a full swing still takes a couple of seconds (team.cpp:319-326).
  for (const sd of ME_SIDES) {
    let bi = -1, bms = Infinity;
    for (let i = 0; i < s.players[sd].length; i++) {
      const q = s.players[sd][i], vmax = meSpeed(meAttrs(q), q.stamina);
      if (q.off) { q._ttbMs = 1e9; continue; }      // sent off: never the designated man
      let ms;
      if (mp.idx >= 0) ms = mp.side === sd && mp.idx === i && mp.side === sd ? 0 : meTimeToBallMs(q, mp.bx, mp.by, vmax);
      // THE MAN IT IS PLAYED TO IS ALREADY WATCHING IT. The time-to-ball model carries the moment
      // between the ball changing and a player acting on it -- right for a defender reading somebody
      // else's pass, wrong for the receiver, who has been looking at it since it left the passer's foot.
      // Charged the full lag, the near end of the flight was "out of reach" and he was sent to a point
      // far down it: on real grass a pass a metre off target ran past him at his side and out of play,
      // about eleven times a match. He pays rcvLag of it.
      else { const ic = meIntercept(q, mp, vmax, undefined, mp.flight && mp.fside === sd && mp.fj === i ? CFG.rcvLag : 1);
             q._icx = ic.x; q._icy = ic.y; q._icMs = ic.slotMs; ms = ic.ms; }
      q._ttbMs = ms;
      // ...and THE KEEPER IS NOT THE MAN SENT AFTER A LOOSE BALL unless he has decided to come for it
      // (brain.ts, _gkOut). Nearest to it near his own area, he was being sent after every one, whatever
      // his own judgement said -- out to the flank, past the ball, and the goal left empty behind him.
      if (ms < bms && !(q.pos === "GK" && !(q._gkOut > 0))) { bms = ms; bi = i; }
    }
    mp.desig[sd] = bi; mp.ttbBest[sd] = bms;
  }
  for (const sd of ME_SIDES) {
    const contest = Math.max(0.5, Math.min(1.5, (mp.ttbBest[meOther(sd)] + 1500) / (mp.ttbBest[sd] + 1500)));
    const f = mp.fading[sd];
    mp.fading[sd] = f + Math.max(-CFG.possSlew, Math.min(CFG.possSlew, (contest - f) * CFG.possEmaAlpha));
    mp.bal[sd] = (mp.fading[sd] - 1) * 2;
    for (const q of s.players[sd]) q._poss = (mp.ttbBest[meOther(sd)] + 200) / ((q._ttbMs ?? 9999) + 200);
  }
  if (mp.tick % ME_MAP_STRIDE === 0) meBuildMaps(s);
  // Harness-only freeze probe: dump who holds it, who is meant to press, and where everyone is.
  if (globalThis.__freeze && mp.tick === globalThis.__freeze.at) {
    const fz = globalThis.__freeze, car = mp.idx >= 0 ? s.players[mp.side][mp.idx] : null;
    fz.out = { tick: mp.tick, side: mp.side, idx: mp.idx, bx: +mp.bx.toFixed(1), by: +mp.by.toFixed(1),
      carrier: car ? { n: car.name, x: +car.x.toFixed(1), y: +car.y.toFixed(1),
                      tx: +(car._tx ?? -1).toFixed(1), ty: +(car._ty ?? -1).toFixed(1) } : null,
      duties: {}, nearOpp: [] };
    for (const sd of ME_SIDES) {
      const h = {};
      for (const q of s.players[sd]) h[q._duty || "?"] = (h[q._duty || "?"] || 0) + 1;
      fz.out.duties[sd] = h;
    }
    const opp = s.players[meOther(mp.side)] || [];
    fz.out.nearOpp = opp.filter(q => !q.off).map(q => ({ n: q.name, pos: q.pos, duty: q._duty,
        d: +Math.hypot(q.x - mp.bx, q.y - mp.by).toFixed(1),
        dTx: +Math.hypot(q.x - (q._tx ?? q.x), q.y - (q._ty ?? q.y)).toFixed(1) }))
      .sort((a, b) => a.d - b.d).slice(0, 5);
  }
  // Every 8 is enough: halving this to 4 was measured against the first-touch shot inflation and
  // moved nothing (3.58 -> 3.62, noise) -- the block's lag was never the leak. Not worth the CPU.
  if (s.brain === 2) mindTick(s, rng, out);      // the second brain: see mind/team.ts
  else {
  if (mp.tick % 8 === 0) for (const side of ME_SIDES) meSlots(s, side);
  if (mp.tick % 2 === 0) meTactical(s);
  // Every tick, not every other one. Possession changes between runs, and a stale duty means a man
  // doing an ATTACKING job while the ball is in his own box -- measured at 22% of defending slices.
  for (const side of ME_SIDES) meDuties(s, side);
  for (const side of ME_SIDES) meRuns(s, side);
  for (const side of ME_SIDES) meBlock(s, side);   // both sides: see rest defence in meShape
  for (const side of ME_SIDES) meShape(s, side);
  }
  if (s.brain === 2) {
    mindDuel(s, rng, out, meDuelHooks(s, rng, out));
    // A foul in the challenge is a whistle: everybody stops where he stands (see the stoppage note in
    // the contest above -- the renderer's origins are synced so nobody replays a step).
    if (mp.sp) { for (const sd of ME_SIDES) for (const q of s.players[sd]) { q._px = q.x; q._py = q.y; } return; }
  } else meTackle(s, rng, out);   // he has jockeyed long enough: does he go?
  meMove(s, rng);
  if (s.brain === 2) mindSense(s);                 // what everybody can now see
  // A ball IN HIS HANDS follows him. It is positioned in phase 1 and he is moved in phase 2, so the
  // frame that actually gets drawn has the man a stride further on than the ball he is carrying --
  // and that is the ball appearing inside the keeper rather than held in front of him.
  if (mp.held && mp.idx >= 0) {
    const h = s.players[mp.side][mp.idx];
    if (h) {
      // Out in front of him TOWARD THE PITCH (brain.ts faces him up it while he holds it), not along
      // whatever way he was moving: pinned against his own goal line by the momentum of the catch, the
      // ball was held on the line itself, 0.79 m from him and out of the reach he can play from.
      const fa = h._drbA != null ? h._drbA : meDir(mp.side) > 0 ? 0 : Math.PI;
      let hx = Math.cos(fa), hy = Math.sin(fa), hl = 1;
      mp.bx = h.x + hx / hl * CFG.gkHoldOut; mp.by = h.y + hy / hl * CFG.gkHoldOut;
      mp.bvx = 0; mp.bvy = 0; mp.bvz = 0; mp.bz = CFG.ballR + 0.5;
      meBallPredict(mp);
    }
  }

  // A PASS IN FLIGHT IS STILL YOUR POSSESSION. out.poss only ever counted ticks with a man within
  // touchKeep of the ball, so a ball travelling between two team-mates belonged to nobody -- which
  // systematically under-counts precisely the sides that pass most and flatters the ones that run
  // with it. Measured on the pitch, Control Possession played 258 passes a game and registered the
  // LOWEST possession in the game at 38.9%, below a deep block, while Wing Play carried 1371 times
  // and registered among the highest. Real possession is credited to the side in control while the
  // ball travels, and mp.passPending is exactly who that is.
  {
    const _h = (!claimed && mp.idx >= 0) ? s.players[mp.side]?.[mp.idx] : null;
    const _onBall = !!_h && Math.hypot(_h.x - mp.bx, _h.y - mp.by) <= CFG.touchKeep;
    if (!_onBall && mp.passPending) mp.passPending.t++;
  }

  // ================ 3. THE MAN ON THE BALL ==================================================
  // He has been moved by the steering layer above, so he decides from where he actually is.
  if (claimed || mp.idx < 0) return;
  const side = mp.side, ps = s.players[side], p = ps[mp.idx];
  if (!p) { mp.idx = -1; return; }
  // He has to still be NEAR it. Possession is not a flag you hold until somebody rolls it off you:
  // if the ball has run away from him, or somebody has got to it first, he simply does not have it.
  // He keeps it while it is still HIS -- inside the range of his own touch, and with nobody nearer.
  // A KEEPER DOES NOT DRIBBLE, so a ball more than gkKeepR from his feet is not his: kept "his" out to
  // touchKeep, a team-mate running into it knocked it goalward and nobody else was allowed to touch it
  // while it rolled four metres into the net ahead of him.
  if (Math.hypot(p.x - mp.bx, p.y - mp.by) > (p.pos === "GK" && !mp.held ? CFG.gkKeepR : CFG.touchKeep)) {
    if (globalThis.__rx) globalThis.__rx.away = (globalThis.__rx.away || 0) + 1;
    mp.idx = -1; return; }
  out.poss[side]++;
  // WHERE the ball is while you have it, not just how long. "This side passes a lot and never
  // shoots" has two completely different causes -- progressing and declining to shoot, or never
  // leaving its own half -- and possession share alone cannot tell them apart.
  if (out.possX) out.possX[side] += (side === "home" ? mp.bx : PITCH_L - mp.bx);
  // ...and he can only PLAY it if he can actually reach it. Possession deliberately runs out to
  // touchKeep so a man does not lose the ball every time it gets a stride ahead of him -- but
  // between his own reach and that he is CHASING it, not carrying it, and he certainly cannot pass
  // it. Nothing enforced that: measured, 26% of every pass, shot and clearance in the match was
  // struck from beyond touching distance and the furthest was from 4.59 m.
  // It is also the whole of the trailing-ball problem. At hold 6+ the ball sits behind him on 8.5%
  // of slices while it is inside his control radius and on 74.6% while it is outside -- because
  // outside it nothing steers it at all, and he was free to keep "dribbling" anyway.
  // He is already pursuing it in meMove; this just stops him kicking what he cannot touch.
  // (A ball in the keeper's hands he can always play: it goes where he goes.)
  if (!(mp.held && p.pos === "GK") && Math.hypot(p.x - mp.bx, p.y - mp.by) > CFG.reach * CFG.playReach) { meCarry(s, out, p); return; }
  const a = meAttrs(p), sp = meSpeed(a, p.stamina), opp = s.players[meOther(side)];
  // A challenge is one against one: only the CLOSEST opponent in range rolls the duel. Letting every
  // body within 3.2 m roll independently meant a second presser doubled the dispossession rate and
  // the whole match dissolved into loose-ball transitions -- measured at +14 shots a game for BOTH
  // sides. The extra men still matter: they are pressure, and pressure taxes every other option.
  // The keeper smothers first: at close range in his own box he is the challenge, not a spectator.
  {
    const gki = meKeeperIx(opp);
    if (gki >= 0) {
      const gk = opp[gki], gd = Math.hypot(gk.x - p.x, gk.y - p.y);
      if (gd < CFG.gkSmotherR && rng.u() < CFG.gkSmotherP * (1 - gd / CFG.gkSmotherR)
          * (CFG.gkSmotherLo + meGkSkill(meAttrs(gk)) * CFG.gkSmotherSkill)) {
        out.tackles++; meBump(out, "gkStopSide", meSideOfP(s, gk)); gk.saves = (gk.saves || 0) + 1;
        meEvt(out, "save", meOther(side), p.x, p.y, p.x, p.y, `${gk.fullName || gk.name} smothers it`);
        // In his hands, held out in front of him. Placing it at gk.x, gk.y put the ball at his exact
        // centre, which is the ball drawn INSIDE the keeper.
        const sx2 = p.x - gk.x, sy2 = p.y - gk.y, sl2 = Math.hypot(sx2, sy2) || 1;
        meBallTo(s, meOther(side), gki, gk.x + sx2 / sl2 * CFG.gkHoldOut, gk.y + sy2 / sl2 * CFG.gkHoldOut);
        mp.held = true;
        return;
      }
    }
  }
  // The old one-against-one tackle ROLL is gone. A defender no longer wins the ball by being within
  // 3.2 m of the man and passing a dice check -- he wins it by reaching the ball, in the contest
  // above. What survives is the foul: going through somebody to get there.
  let qi = -1, qGap = Infinity;
  for (let k = 0; k < opp.length; k++) {
    const q = opp[k];
    // A sent-off man is parked at y = -6, six metres beyond the touchline. Nothing excluded him
    // here, so a carrier hugging the byline could be fouled by somebody who was not on the pitch.
    if (!q || q.off) continue;
    // A KEEPER OFF HIS LINE IS A DEFENDER. He was skipped outright, which is why a goalkeeper in
    // this engine could not be sent off at all -- and the one red card a keeper really does get is
    // rushing out, missing, and taking the man down. Inside his own area he is the smother above
    // rather than a challenge, and letting him foul there would invent penalties nobody conceded.
    if (q.pos === "GK" && Math.abs(q.x - meGoalX(side)) < CFG.gkBoxR) continue;
    const g = Math.hypot(q.x - p.x, q.y - p.y);
    if (g < qGap) { qGap = g; qi = k; }
  }
  // A FOUL IS A CHALLENGE THAT MISSED THE BALL. It was a flat dice roll against anybody standing
  // within 2.2 m, which gave 1.58 fouls a side against a real eleven and made a defender's tackling
  // rating worth nothing at all. It is a physical event now: how hard he came in, and whether he was
  // good enough to get the ball instead of the man.
  // (The second brain fouls only in a challenge -- mind/duel.ts -- never by standing near the ball.)
  if (qi >= 0 && qGap <= CFG.foulR && s.brain !== 2) {
    const q = opp[qi], qa2 = meAttrs(q);
    const dSt = s.strategy?.[meOther(side)] || {};
    // How committed the challenge was -- his speed along the line into the man he is challenging. A
    // defender arriving at pace catches people; one already alongside, jockeying, does not.
    const cvx = (p.x - q.x) / Math.max(0.3, qGap), cvy = (p.y - q.y) / Math.max(0.3, qGap);
    const closeV = Math.max(0, ((q.vx || 0) * cvx + (q.vy || 0) * cvy) / ME_DT);
    // A referee wants to be surer before he points to the spot, and a defender knows it and pulls
    // out of challenges he would make anywhere else. Without this the box produced 0.93 penalties a
    // match against a real 0.28.
    const dGoal0 = meGoalX(side);
    const inArea0 = Math.abs(p.x - dGoal0) < CFG.gkBoxR && Math.abs(p.y - ME_HALF_W) < CFG.boxHalfW;
    // THE REFEREE AT A GROUND THAT IS NOT NEUTRAL. The marginal call goes the host's way: the
    // visitor's challenges are whistled and booked a little more readily, the host's a little less.
    // It rides on the foul and on the discretionary cards only; a denied goalscoring chance is the
    // law and is left alone below.
    const host = s.homeAdv === "home" || s.homeAdv === "away" ? s.homeAdv : null;
    const lean = host ? Math.max(-1, ME_HOME_ADV.ref * ME_HOME_ADV.k * (meOther(side) === host ? -1 : 1)) : 0;
    const rate = CFG.foulBase * (1 + closeV * CFG.foulPace)
               * (1 + lean)
               * (1 - qa2.tackle / 99 * CFG.foulSkill)
               * (1 + (dSt.tackling || 0) * CFG.foulAggr)
               * (inArea0 ? CFG.foulBoxScale : 1)
               // On a yellow, and he knows it. This is the same challenge he would have made ten
               // minutes ago and did not make now.
               * ((q.yc || 0) ? CFG.foulBooked : 1);
    if (rng.u() < rate) { meFoulCommit(s, rng, out, side, p, q, closeV, inArea0, lean); return; }
  }
  const press = mePressure(s, side, p.x, p.y);
  mp.hold++;
  // A touch BUDGET, not a mandatory stop. He can play it on any slice: when he has had it long
  // enough to look up, when what is on is good enough to take first time, or when he is being
  // closed down -- pressure SHORTENS this. The old rule had a pressed player dwelling six slices
  // against a free player's four, which is exactly backwards and is why contested men stood still.
  // TIME-WASTING IS FOR SEEING OUT A LEAD. In an engine with no scoreboard, holding the ball two
  // slices longer was a pure benefit -- more time to look up, and nothing charged for it -- which is
  // why it measured as a 0.91 goal buff at a setting called "Constantly". It only becomes football
  // when there is something to protect, so the extra dwell is now conditional on being in front.
  // Level or behind, running the clock down is simply worse, and the instruction does nothing.
  const lead = (out.goals?.[side] ?? 0) - (out.goals?.[meOther(side)] ?? 0);
  const tw = lead > 0 ? (s.strategy?.[side]?.timeWasting || 0) : 0;
  // ...and the dribbling instruction, which is the same kind of thing: how long he is allowed to
  // keep running with it before he has to let go. Run At Defence buys touches, Disciplined releases
  // early, and holding on is charged for by the pressure closing in on him while he does it.
  // THE BUDGET MOVES WITH THE INSTRUCTIONS; THE TAX DOES NOT. dwellDrop compounds against a carrier
  // from the moment he has held it longer than an ordinary player would -- but dwell was measured
  // against `natural`, so raising the budget did not merely extend his licence to keep running, it
  // postponed the entire cost of doing so. Measured: Run At Defence took what a side concedes from
  // 0.83 xG to 0.45 and was the largest buff left on the board at 0.75. Buying touches now buys
  // exactly that, and the ball gets harder to keep the whole time he has it.
  // ...and by who he is. See CFG.holdMind: an elite player has already seen the picture, so his
  // budget is shorter; a poor one needs the extra look. Centred so the league mean barely moves.
  // A ball held in the keeper's HANDS cannot be taken off him: the press term is a lie there,
  // and he gets gkHoldT extra slices to survey before distributing. He was on the outfielder's
  // budget, which is the instant punt and the bad kick that follows it.
  // ...except to start a counter: with his side breaking (the second brain's counter phase) he lets it go at once,
  // the way a keeper who has just caught a cross with their attackers still in his box does.
  const pressN = mp.held ? 0 : press;
  const gkSurvey = mp.held && p.pos === "GK" && mp.mind?.ph?.[side]?.ph !== "counter";
  // COMPOSED (badge): pressure does not hurry him -- he keeps his time on it and does not snatch at the ball.
  const fxH = meBadgeFx(p), pressC = pressN * (1 - (fxH.calm ?? 0));
  const natBase = Math.max(1, Math.round(CFG.holdBase - pressC * CFG.holdPress
                                         - (meMind(p) - 0.55) * CFG.holdMind
                                         + (gkSurvey ? CFG.gkHoldT : 0)));
  const natural = Math.max(1, natBase + tw * CFG.wasteHold
                              // UP ONLY. The dwell tax is charged from natBase, which excludes this term, so a
                              // negative budget forced a disciplined man off the ball a slice BEFORE the cost he
                              // was supposedly avoiding began -- a constraint that bought nothing. Measured at
                              // -0.21 xG against a +0.07 benefit at the other end: a tax wearing a tactic's name.
                              + Math.max(0, s.strategy?.[side]?.dribbling || 0) * CFG.dribHold
                              // Quicker tempo means less time on it before he has to move it on.
                              - (s.strategy?.[side]?.tempo || 0) * CFG.tempoHold);
  // Carrying is not a terminal state. It used to be -- if `carry` scored best he simply never let
  // go of it, so a man could dribble in the box indefinitely, which is exactly what it looked like.
  // Once his time is up the carry is off the menu and he plays the best ball there is.
  // A KEEPER WITH IT AT HIS FEET DOES NOT DRIBBLE. On the outfielder's budget, with carry on the menu,
  // he took a back-pass and walked it up his area with a striker closing, and was robbed twelve metres
  // from his own goal. He gets gkFeetT slices to pick his ball, and carrying is not one of them.
  const gkFeet = p.pos === "GK" && !mp.held;
  const forced = mp.hold >= (gkFeet ? Math.min(natural, CFG.gkFeetT) : natural);
  let act = s.brain === 2 ? mindChoose(s, side, mp.idx, mp.hold - natBase + 1, gkFeet)
                           : meDecide(s, rng, side, mp.idx, mp.hold - natBase + 1, gkFeet);
  if (act.k === "carry") {
    // ...but not FOREVER. The dwell tax shrinks a camped carry toward zero, and zero still wins
    // against a menu of all-negative passes, so this return was a bypass around the forced
    // release and a beaten side's centre-back could stand on the ball for the rest of the match.
    // Far enough past his budget, carry comes off the menu and he plays the least-bad ball.
    if (mp.hold < natural + CFG.holdHardT) { meCarry(s, out, p); return; }
    if (globalThis.__fire) globalThis.__fire.hardRelease = (globalThis.__fire.hardRelease || 0) + 1;
    act = s.brain === 2 ? mindChoose(s, side, mp.idx, mp.hold - natBase + 1, true)
                        : meDecide(s, rng, side, mp.idx, mp.hold - natBase + 1, true);
    if (act.k === "carry") { meCarry(s, out, p); return; }           // nothing else exists at all
  }
  // THE KEEPER WITH IT IN HIS HANDS HOLDS IT while his side spreads out, unless the break is on NOW:
  // a free man well up the pitch with their side caught forward, and then he throws it at once. He
  // used to let it go the moment anything scored well enough, which out of a crowded area was usually
  // a man with somebody on him. Waiting is capped by his budget, and at the end of it he plays the best
  // there is -- long, if nobody short is free.
  if (mp.held && p.pos === "GK" && !forced && mp.hold < CFG.gkSettleT) {
    let quick = false;
    if (act.k === "pass" && act.ax !== undefined && (act.ax - p.x) * meDir(side) > CFG.gkQuickFwd
        && meOppDist(s, side, act.ax, act.ay) > CFG.gkFreeR * 1.3) {
      let up = 0;
      for (const o of s.players[meOther(side)]) if (o && !o.off && o.pos !== "GK" && (o.x - PITCH_L / 2) * meDir(side) < 0) up++;
      quick = up >= CFG.gkCounterN;
    }
    if (!quick) return;
  }
  // ...and VISION plays it early to a man making a run: the bar for letting that pass go now is lower.
  if (!forced && (act.sc ?? 0) <= CFG.actNow * Math.max(0, 1 - pressC * CFG.pressActNow) * (act.k === "pass" && (act._q?._runT ?? 0) > 0 ? 1 - (fxH.early ?? 0) : 1)) return;
  mePlay(s, rng, out, side, mp.idx, act, press, forced);
}

// A FOUL, AND EVERYTHING IT BRINGS: the card, a sending-off, a penalty, the injury, and the restart.
// `side` is the side fouled and `p` the man fouled, `q` the man who did it. Lifted out of the on-ball
// step unchanged so both brains go through the same laws; the second brain reaches it only from a
// challenge (mind/duel.ts), never from somebody merely standing near the ball.
export function meFoulCommit(s, rng, out, side, p, q, closeV, inArea0, lean) {
  const mp = s.mePos;
  const fSide = meOther(side);
  out.fouls[fSide]++;
  // HOW BAD IT WAS. The same two things that made it a foul make it a booking: the pace he came
  // in at, and how much he had to gain by stopping the move. A trip in midfield is a free kick;
  // the same challenge on a man running at goal is a card.
  const sev = Math.min(1, closeV / CFG.cardPaceFull) * CFG.cardPaceW
            + meDanger(side, p.x, p.y) * CFG.cardDangerW;
  // WAS THERE A GOAL IN IT. Judged before the card, because the two questions are different:
  // this one is about what the foul took away -- a run at goal with nobody but the keeper left
  // to stop it -- and the one below is about how hard he went in.
  // DENYING A GOALSCORING OPPORTUNITY IS A LAW, NOT A DICE ROLL. Two things were wrong here.
  // The test counted every defender goal-side of the ball with NO lateral bound, so a full-back
  // on the opposite touchline cancelled a sending-off -- the same headcount flaw the marking
  // used to have, and meThruCover answers it properly by racing each defender to the run. And
  // the outcome was `rng.u() < 0.027`, so 97% of genuine denials produced no card at all:
  // measured over 60 matches, DOGSO generated ONE red while second yellows generated six.
  // The fouler is excluded from the cover race -- the question is what the foul took away.
  const denial = meDanger(side, p.x, p.y) > CFG.dogsoDanger && !meThruCover(s, side, p, q);
  // ...AND WHERE IT HAPPENED DECIDES THE COLOUR. Law 12 as amended in 2016: inside his own
  // area, a defender who fouls while genuinely going for the ball is cautioned rather than
  // sent off -- the penalty is the punishment. Outside it, the same foul is a red.
  let card = "", dogso = false;
  if (denial) {
    if (inArea0) card = "yellow";
    else if (rng.u() < CFG.dogsoRed) { card = "red"; dogso = true; }
    else card = "yellow";
  }
  // STOPPING A PROMISING ATTACK is its own caution in the laws, and was not modelled at all:
  // a cynical trip on a man breaking away scored exactly as a trip in midfield does.
  else if (meDanger(side, p.x, p.y) > CFG.spaDanger && rng.u() < CFG.cardSpa * (1 + lean)) card = "yellow";
  else if (rng.u() < CFG.cardStraightRed * sev * (1 + lean)) card = "red";
  else if (rng.u() < CFG.cardYellow * (0.4 + sev) * (1 + lean)) card = "yellow";
  meRate(q, card === "red" || card === "red2" ? -CFG.rateRed : card ? -CFG.rateYellow : 0);
  // Giving a penalty away is its own thing, separate from whatever card came with it, and the
  // man who drew it gets the credit for it.
  if (inArea0) { meRate(q, -CFG.ratePenGave); meRate(p, CFG.ratePenWon); }
  if (card === "yellow") {
    q.yc = (q.yc || 0) + 1;
    (out.yellows = out.yellows || { home: 0, away: 0 })[fSide]++;
    if (q.yc >= 2) card = "red2"; else meBook(out, fSide, q);
  }
  if (card === "red" || card === "red2") {
    const why = card === "red2" ? "second" : dogso ? "dogso" : "sfp";
    // OFF. He cannot be spliced out of the squad: mp.idx, _mk, mp.fj and mp.desig are all array
    // indices into it, so removing him would silently repoint every one of them at the wrong
    // man. He is flagged instead, parked off the touchline and skipped everywhere he could act.
    // He keeps his slot in the shape and nobody fills it, which is exactly what a man down is.
    meRed(s, out, fSide, q, why, p.x, p.y);
  } else {
    meEvt(out, card === "yellow" ? "yellow" : "foul", fSide, p.x, p.y, p.x, p.y,
          card === "yellow" ? `Booked, ${q.fullName || q.name}` : `Foul, ${q.fullName || q.name}`);
  }
  // IN THE BOX IT IS A PENALTY. Same challenge, same card, different restart.
  // INJURY. A man who has just been gone through at pace is the one who gets hurt, so it hangs
  // off the same closing speed that made it a foul. Most of it is a knock he runs off; a small
  // share of it he cannot continue with, and meAutoSubs treats that as a forced change at the
  // next dead ball -- so a side only finishes with ten if the bench is already spent.
  if (s.injuriesOn !== false && rng.u() < CFG.injP * (1 + closeV * CFG.injPace)) {
    (out.injuries = out.injuries || { home: 0, away: 0 })[side]++;
    if (rng.u() < CFG.injSerious) {
      // WHAT HE DID AND HOW LONG IT KEEPS HIM OUT. "Cannot continue" was the whole diagnosis,
      // so every injury cost the same guessed one-to-five matches downstream. A knee that tears
      // is not an ankle he rolled, and the competition's injury counter spends the difference.
      const { sev, part } = mePickInjury(rng);
      p.rc = false; p.off = true; p.inj = true; p.injSev = sev.id; p.injPart = part;
      // Named for the report; out.injuries above counts knocks as well, and only this is a man lost.
      (out.injured = out.injured || { home: [], away: [] })[side].push(
        { name: p.name, full: p.fullName || p.name, min: out.min ?? 0, add: out.add || 0, part, sev: sev.id });
      p._offX = p.x; p._offY = p.y;
      p.y = -6; p.vx = 0; p.vy = 0; p._offAt = s.mePos.tick;
      meEvt(out, "injury", side, p.x, p.y, p.x, p.y,
            `${p.fullName || p.name} cannot continue, ${part} ${sev.label.toLowerCase()}`,
            { sev: sev.id, part });
    } else {
      p.knock = CFG.injKnockT;                 // he runs it off
      meEvt(out, "injury", side, p.x, p.y, p.x, p.y, `${p.fullName || p.name} is hurt but carries on`);
    }
  }
  // THE OFFENCE IS WHERE HE WAS FOULED, and the ball has to be moved there BEFORE the restart
  // is set up rather than after it. spotFor reads mp.bx/mp.by to place a free kick, so doing it
  // in the other order left the spot the taker walks to and the ball he is walking to disagreeing
  // -- by a median half a metre and, once in a sample of nine hundred restarts, by forty-eight.
  // Invisible while the ball was teleported onto the spot anyway; not invisible now that it is
  // carried there. The offside branch above has always done it in this order.
  if (!inArea0) { mp.bx = p.x; mp.by = p.y; }
  meDead(s, inArea0 ? "penalty" : "freekick", side, inArea0 ? 470 : 104, out);
  return true;
}

// THE STRIKE: whatever he decided, played from where the ball is. Out of the tick's own on-ball step
// so that a ball can also be played the instant it arrives -- first time, in the contest -- through the
// same code as one he has stopped. act.execD is how hard the ball was to strike (mePassExecD), which the
// decision has already charged against his skill and the kick now spends as noise. It replaced a flat
// division of every quick pass's skill by 1.75, which charged the lay-off into a man's stride what it
// charged a ball driven at his shins.
export function mePlay(s, rng, out, side, i, act, press, forced) {
  const mp = s.mePos, ps = s.players[side], p = ps[i], a = meAttrs(p);
  const exD = act.execD || 0;
  mp.hold = 0;
  if (act.k === "shot") {
    // He strikes it, and that is the whole of his involvement. No goal roll, no save roll, none of
    // the hardcoded 0.42/0.58/0.30 cascade: the ball is in the air, and the outcome is wherever it
    // ends up -- past the keeper, off the frame, into his hands, or behind for a goal kick.
    out.shots[side]++;
    const gx = meGoalX(side);
    // Aim away from the KEEPER, not at a fixed far post. Aiming across himself every time meant that
    // from any wide angle the far-post line ran straight through the man in goal and from a central
    // one it found an empty corner -- conversion alternated between 98% and 7% with distance for no
    // footballing reason at all. Better finishers pick the side he has left; poorer ones aim nearer
    // the middle, where he is.
    const gkp = meKeeper(s.players[meOther(side)]);
    const sk = meFinish(a) + (Math.hypot(gx - p.x, ME_HALF_W - p.y) > 18 ? (meBadgeFx(p).farShot ?? 0) : 0);
    const away = gkp && gkp.y > ME_HALF_W ? -1 : 1;
    // A man with time to set himself picks his corner (meWindUp): he aims wider by shotAimSet of it.
    const wind = meWindUp(Math.hypot(gx - p.x, ME_HALF_W - p.y), meShotSit(s, side, p, gx, ME_HALF_W), exD, act.ft);
    const aimY = ME_HALF_W + away * GOAL_HALF_W * Math.min(CFG.shotAimMax, CFG.shotAimBase + sk * CFG.shotAimSkill + wind * CFG.shotAimSet);
    // ...and up into the top corner as well as along the ground, shotSetZ more of the frame's height.
    const aimZ = Math.min(CFG.shotAimZMax, 0.25 + rng.u() * (0.5 + sk * GOAL_H * 0.45 + wind * CFG.shotSetZ));
    // out.xg is both sides pooled, which is what the calibration harnesses want. Per side as well,
    // because a sweep that asks "did this instruction make the side BETTER" needs a difference, and
    // a goal is a Poisson count with a mean of 1.6 -- a whole match of it carries more noise than
    // the effect being measured. xG is the same question answered from ~8 continuous samples.
    // What the book says this shot was worth is the RECORDER's number, not the decision's --
    // see the keeper block in meShotP. act.p keeps steering the choice; xgRec is what is written.
    const xgRec = meXgCal(meShotP(s, side, p, p.x, p.y, true) * (1 + wind * CFG.shotSetK));
    if (out.shotDist) { const _g = meShotGeom(side, p.x, p.y); out.shotDist[Math.min(9, Math.floor(_g.d / 5))]++; out.xg = (out.xg || 0) + xgRec; }
    if (out.xgS) out.xgS[side] += xgRec;
    // The build is paid on the CHANCE, in proportion to it -- see rateChanceBuild. Same walk as
    // the goal credit: back through this side's unbroken run of touches, each earlier different
    // man a decayed share, the shooter excluded (his shot is his own reward), deflections read
    // through. Capped per man per match so a carousel side cannot farm it.
    {
      // The shooter's own share first: getting to the end of the move is the contribution,
      // whatever the keeper does next. Same cap pool as the build credit.
      p._chB = p._chB || 0;
      const get3 = Math.min(xgRec * CFG.rateChanceGet, Math.max(0, CFG.rateChanceCap - p._chB));
      if (get3 > 0) { meRate(p, get3); p._chB += get3; }
      const lg3 = mp.tlog || [];
      const paid3 = new Set([mp.idx]);
      let share3 = xgRec * CFG.rateChanceBuild;
      for (let k3 = lg3.length - 1; k3 >= 0 && share3 > 0.005; k3--) {
        const e3 = lg3[k3];
        if (e3.t >= mp.tick) continue;
        if (e3.s !== side) { if (e3.d) continue; break; }
        if (paid3.has(e3.i)) continue;
        paid3.add(e3.i);
        const bp3 = s.players[side]?.[e3.i];
        if (bp3 && !bp3.off) {
          bp3._chB = bp3._chB || 0;
          const room3 = Math.max(0, CFG.rateChanceCap - bp3._chB);
          const pay3 = Math.min(share3, room3);
          if (pay3 > 0) { meRate(bp3, pay3); bp3._chB += pay3; }
        }
        share3 *= CFG.rateBuildDecay;
      }
    }
    // ...but only if the pass actually MADE the chance. _gotFj is stamped when a man receives the
    // ball and it persists, so a centre-half who found a forward in his own half was being credited
    // with a chance the forward then carried thirty metres and manufactured himself -- which is why
    // an unguarded version of this put 55% of all chances created on DEFENDERS. A key pass is one
    // the shot follows from, so the shooter has to still be near where he received it.
    meEvt(out, "shot", side, p.x, p.y, gx, aimY, null);
    // Read the shooter BEFORE the ball leaves him: mp.idx is cleared on the line above, so taking
    // the index after it recorded -1 on every shot from open play. The goal attribution only looked
    // right because it falls back to the touch log, which meKickedBy had already filled in correctly
    // one line earlier -- a bug that a working answer was hiding.
    const shooter = mp.idx;
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null;
    mp.shot = { side, name: p.name, full: p.fullName || p.name, i: shooter, xg: xgRec, t0: mp.tick, p,
                xgN: meXgCal(meShotP(s, side, p, p.x, p.y, true, CFG.gkRefSkill) * (1 + wind * CFG.shotSetK)),
                lt: mp.tick - (mp._loose ?? -1e9), pt: mp.possT ?? -1,
                d: Math.hypot(gx - p.x, p.y - ME_HALF_W) };
    if (globalThis.__gfrom) mp.shot.from = (p._rcvT !== undefined && mp.tick - p._rcvT <= 8 ? p._rcvK : "-") + (act.ft ? " first time" : "");
    // Shot genesis, harness-only: same gate pattern as __prov. WHERE THE KEEPER WAS as well as
    // where the shot came from -- a goal conceded with him twelve metres off his line and still
    // committed to a ball he lost the race for is a different fact from a goal conceded on his line,
    // and only the pair of them can say which is happening.
    if (globalThis.__shots || globalThis.__prov) {
      const gkD = (s.players[meOther(side)] || []).find(q => q && q.pos === "GK" && !q.off);
      mp.shot.gkd = gkD ? Math.hypot(gkD.x - gx, gkD.y - ME_HALF_W) : -1;
      mp.shot.gko = gkD && gkD._gkOut > 0 ? 1 : 0;
    }
    if (globalThis.__shots) globalThis.__shots.push({ side, d: mp.shot.d, pt: mp.shot.pt,
      lt: mp.shot.lt, press, xg: xgRec, gkd: mp.shot.gkd, gko: mp.shot.gko, why: mp._looseWhy,
      ft: act.ft ? 1 : 0, exD: +exD.toFixed(2), from: p._rcvT !== undefined && mp.tick - p._rcvT <= 8 ? p._rcvK : "-" });
    // THE PASS THAT MADE IT. An assist is only credited when the thing goes in; a man who puts a
    // team-mate through six times and watches him miss six times did that six times. Credited on
    // every shot, so an assist on a goal is this plus the goal bonus, which is how it is counted
    // everywhere else.
    { const lg = mp.tlog || [];
      for (let k = lg.length - 1; k >= 0; k--) {
        const e = lg[k];
        // Same rule as the assist: a ricochet off an opponent did not end the move he started.
        if (e.s !== side && e.d) continue;
        if (e.s !== side) break;
        if (e.i !== shooter) { const kp = s.players[side]?.[e.i];
          meRate(kp, CFG.rateKeyPass + (act.p >= CFG.bigChanceXg ? CFG.rateBigChance : 0));
          // CHANCES CREATED, the table stat: every pass that led to a shot, assists included --
          // the walk fires on the shot's creation, before anyone knows how it ends.
          if (kp) kp.cc = (kp.cc || 0) + 1; break; }
      } }
    // What he is carrying into the strike, read once: it sets the pace.
    const run = meRun01(p, side);
    // Tired legs mishit. Execution decays with stamina the same way for every man on the pitch,
    // so the bill lands hardest on whoever spent the most running -- which is the press.
    // What is around him when he hits it: see meShotSit.
    const sit = meShotSit(s, side, p, gx, aimY);
    if (globalThis.__shots) globalThis.__shots[globalThis.__shots.length - 1].sit = +sit.toFixed(2);
    meShootBall(mp, rng, gx, aimY, aimZ, sk * (CFG.fatExLo + (1 - CFG.fatExLo) * (p.stamina ?? 100) / 100) * Math.max(0, 1 - exD * CFG.execShotLoss), sit, undefined, undefined, run, wind);
    // THE KEEPER WATCHES IT. He used to commit to a side as it left the foot, right as often as his
    // rating said, and a right guess put him on the spot the shooter aimed at; see keeper.ts for what
    // that did to the balance between a finish and a keeper. He sets, reacts, and goes to the ball.
    mePlanSave(s, mp.shot);
    return;
  }
  if (act.k === "clear") { out.clears++; meBump(out, "clearsSide", meSideOfP(s, p)); meRate(p, meDefPay(s, meSideOfP(s, p), p.x, p.y, CFG.rateClear));
    p.defActs = (p.defActs || 0) + 1;
    meEvt(out, "clear", side, p.x, p.y, act.cx ?? p.x, act.cy ?? p.y, null);
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null; mp.bpass = side;
    if (globalThis.__clr) globalThis.__clr.push(Math.hypot((act.cx ?? p.x) - p.x, (act.cy ?? p.y) - p.y));
    meKickBall(mp, rng, act.cx ?? (p.x + meDir(side) * 36), act.cy ?? (p.y + (rng.u() - 0.5) * 30),
               "clear", meTech(a.pass), press);
    return; }
  if (act.k === "touch") { out.clears++; meBump(out, "clearsSide", meSideOfP(s, p));
    // Into the stand. It concedes a throw and it keeps the goal, which is the trade being made.
    const sy = p.y < ME_HALF_W ? -4 : PITCH_W + 4;
    meEvt(out, "clear", side, p.x, p.y, p.x + meDir(side) * 6, sy, null);
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null; mp.bpass = side;
    meKickBall(mp, rng, p.x + meDir(side) * 6, sy, "clear", meTech(a.pass), press);
    return; }
  const q = ps[act.j];
  // THE POINT THE DECISION SCORED IS THE POINT STRUCK. Every kind of ball arrives here already solved
  // -- a ball to feet led by his own pace over the flight, a ball into space aimed at where he and it
  // meet, a lofted one at where it comes down to him -- with the weight and the flight it was scored
  // on. This line used to lead the ball again on top of the decision's lead, so every pass to a
  // moving man was struck a second lead ahead of the point that was scored; on real grass that ran on
  // past him and out, and passes became the main source of throw-ins.
  const lx = Math.max(1, Math.min(PITCH_L - 1, act.ax ?? q.x)), ly = Math.max(1, Math.min(PITCH_W - 1, act.ay ?? q.y));
  const dist = Math.hypot(lx - p.x, ly - p.y);
  if (globalThis.__pmark) globalThis.__pmark.push(+meOppDist(s, side, lx, ly).toFixed(2));
  // No completion roll. The kick carries execution noise (skill and pressure turn into degrees of
  // aim error and a power wobble) and then the flight is geometry's problem: whoever reaches the
  // path first gets it. A lofted ball goes over the midfield instead of through it.
  meEvt(out, "pass", side, p.x, p.y, lx, ly, null);
  meKickedBy(mp, side, mp.idx);
  mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = act.j; mp.lastSide = side; mp.bpass = side;
  // What he THOUGHT would happen, carried alongside the ball. A completion model nobody ever
  // checks against the resolution is a model that drifts: the decision scored passes with one set
  // of assumptions while physics settled them with another, and the two only have to agree because
  // somebody measured it.
  // WHERE HE WAS WHEN IT WAS PLAYED. Offside is judged at the moment of the pass and nowhere else,
  // so it is settled here and carried with the ball rather than re-derived when it arrives -- by
  // then he has run on and the line has moved.
  const offL = meOffsideLine(s, side);
  const wasOff = (q.x - offL) * meDir(side) > CFG.offTol
    && (q.x - PITCH_L / 2) * meDir(side) > 0        // only in the opponent's half
    && (q.x - p.x) * meDir(side) > 0;               // and ahead of the ball
  mp._passK = { k: act.pk || "feet", d: dist, high: !!act.high, run: ((act._q?._runT ?? 0) > 0) };  // the ball, for the first touch (crisp)
  mp.passPending = { side, p: act.p, c: act.c, thru: !!act.thru, high: !!act.high, d: dist, forced,
                     off: wasOff, ox: q.x, oy: q.y, t: 0, sx: p.x, sy: p.y, byP: p, ax: lx, ay: ly, fj: act.j,
                     k: act.pk || "feet", ft: !!act.ft };
  // WHO WAS COMMITTED TO THE BALL WHEN IT WAS PLAYED (the second brain): the man on it, the man squeezing him and
  // the men jumping his passes. The second brain gives everyone a new job the moment the ball is in the air, so by
  // the time a pass arrived nobody was still pressing, and the played-through press (where a pass completes) never
  // found anybody to charge: a counter-press that was played through cost nothing. Taken here, where the jobs are
  // still the ones the pass was played against.
  if (s.brain === 2) mp.passPending.eng = (s.players[meOther(side)] || [])
    .flatMap((o, j) => o && !o.off && (o._duty === "press" || (o._duty === "cover" && o._closing)) ? [j] : []);
  // Reception audit (harness-only): passPending is cleared before the ball is handed over, so the
  // strike-time geometry is stamped here where it still exists.
  if (globalThis.__recv) mp._rcvAt = { side, i: act.j, sx: p.x, sy: p.y, ox: q.x, oy: q.y,
    thru: !!act.thru, aim: dist };
  meKickBall(mp, rng, lx, ly, act.high ? "high" : "ground",
             (meTech(a.pass) + mePassBadge(p, act.pk || "feet", dist, !!act.high)) * (CFG.fatExLo + (1 - CFG.fatExLo) * (p.stamina ?? 100) / 100),
             press * (1 - (meBadgeFx(p).calm ?? 0)),                   // COMPOSED: pressure does not hurry his strike
             s.strategy?.[side]?.tempo || 0, { va: act.va, kind: act.kind, zEnd: act.zEnd, execD: exD });
  if (s.brain === 2) mindOnPass(s, side, i, act); else mePassMove(s, rng, side, i, act);
}

// PASS AND MOVE. A pass used to be the end of the passer's part in the move: he went back to his slot
// and the man he found was on his own, which is half of why the football looked wooden -- nobody ever
// gave it and went. Two runs start from the pass itself, and each is only a RUN; whether the ball
// comes back is the receiver's decision, into a runner the pass menu already knows how to find.
//   THE GIVE-AND-GO: the passer, off a short ball forward of his own third, goes past his man for
//   the return -- the wall pass, the one-two.
//   THE THIRD MAN: a ball into a team-mate's feet sends a third man in behind off the shoulder, for
//   the lay-off first time.
// Both count against the side's budget of men on runs, the same one meRuns spends.
function mePassMove(s, rng, side, i, act) {
  const us = s.players[side], p = us[i], q = us[act.j];
  if (!p || !q || act.high) return;
  const st = s.strategy?.[side] || {};
  const dir = meDir(side), own = meGoalX(meOther(side));
  let active = 0;
  for (const z of us) if (z && !z.off && (z._runT ?? 0) > 0) active++;
  const cap = Math.max(1, CFG.runMax + (st.creativity || 0) * CFG.creRuns);
  const cre = st.creativity || 0;
  // A centre-half does not play one-twos; a full-back going outside does.
  const mover = (z) => z.pos === "MID" || z.pos === "FWD"
    || (z.pos === "DEF" && Math.abs((z._bw ?? ME_HALF_W) - ME_HALF_W) / ME_HALF_W > 0.40);
  const d = Math.hypot(q.x - p.x, q.y - p.y);
  if (active < cap && mover(p) && (p._runT ?? 0) <= 0 && (p.x - own) * dir > CFG.wallFrom
      && d < CFG.wallMaxD && (q.x - p.x) * dir > -8
      && rng.u() < CFG.wallP + CFG.wallShort * Math.max(0, -(st.passingDir || 0)) + CFG.wallCre * cre) {
    // Straight past the man in front of him, on the side away from the ball he has just played, so
    // the return goes across behind that man. Clamped onto the pitch; meShape holds him onside.
    const side0 = q.y > p.y ? -1 : 1;
    const rx = Math.max(2, Math.min(PITCH_L - 2, p.x + dir * CFG.wallRunL));
    const ry = Math.max(4, Math.min(PITCH_W - 4, p.y + side0 * 3));
    if (meOppDist(s, side, rx, ry) > 3) {
      p._run = "wall"; p._runT = CFG.wallRunT; p._rx = rx; p._ry = ry; p._cool = 0; active++;
      if (globalThis.__pk) globalThis.__pk._wall = (globalThis.__pk._wall || 0) + 1;
    }
  }
  if (active >= cap || act.thru || (q.x - own) * dir < CFG.tmFrom) return;
  if (rng.u() >= CFG.tmP + CFG.tmCre * cre) return;
  const off = meOffsideLine(s, side);
  let bi = -1, bsc = -Infinity;
  for (let k = 0; k < us.length; k++) {
    const c = us[k];
    if (k === i || k === act.j || !c || c.off || c.pos === "GK" || !mover(c)) continue;
    if ((c._runT ?? 0) > 0 || (c._cool ?? 0) > 0) continue;
    if (Math.hypot(c.x - q.x, c.y - q.y) > CFG.tmMaxD) continue;
    if ((c.x - off) * dir > -0.5 || (c.x - q.x) * dir < -6) continue;      // onside, and not behind him
    // ...and only with grass behind the line to run into, the same test meRuns asks of a runner.
    if (meCtrl(s, side, off + dir * 12, c.y) <= -0.55) continue;
    const sc = (c.x - q.x) * dir - Math.abs(c.y - q.y) * 0.3;
    if (sc > bsc) { bsc = sc; bi = k; }
  }
  if (bi < 0) return;
  const c = us[bi];
  c._run = "behind"; c._runT = CFG.runTicks; c._cool = 0;
  c._rx = Math.max(2, Math.min(PITCH_L - 2, off + dir * CFG.runBehindX));
  c._ry = c.y + (ME_HALF_W - c.y) * 0.35;
  if (globalThis.__pk) globalThis.__pk._third = (globalThis.__pk._third || 0) + 1;
}

// FIRST TIME. The ball has reached him and he has not stopped it yet: is the ball he would play now
// better than whatever a touch buys him? He asks the ordinary decision with the ball as it is ARRIVING
// (so every option is charged for being struck first time -- how hard it is coming, how far he has to
// turn it), and plays it on only if the best of it is a pass, a shot or a clearance worth ftActNow.
// That is the lay-off to a man facing play, the wall pass back into a runner, the ball round the
// corner and the tap-in: none of them existed, because every reception was a touch first and a
// decision a quarter of a second later. Anything else, and he takes it down.
function meFirstTime(s, rng, side, i, z) {
  const mp = s.mePos, p = s.players[side][i];
  const act = meDecide(s, rng, side, i, 0, false, { bvx: mp.bvx, bvy: mp.bvy, bz: z });
  if (!act || (act.k !== "pass" && act.k !== "shot" && act.k !== "clear")) return null;
  const press = mePressure(s, side, p.x, p.y);
  if ((act.sc ?? 0) <= CFG.ftActNow * Math.max(0, 1 - press * CFG.pressActNow)) return null;
  act.ft = true;
  return act;
}

// THE FLICK-ON. A header is a way of moving the ball rather than keeping it, and it went into an area
// ahead of him at random -- so the knock-on of a long ball, the most ordinary header in the game, never
// found anybody. It does now, and only that: a ball already travelling their way, played on in the same
// direction to a team-mate beyond him who is onside, from outside flickGoalD of goal. (Heading AT a
// team-mate from anywhere was tried and is not a flick-on: every won header near the box teed somebody
// up and goals nearly doubled.) Returns true if he played one.
function meFlick(s, rng, out, side, i, q, power) {
  const mp = s.mePos, dir = meDir(side), gx = meGoalX(side);
  if (Math.hypot(gx - q.x, ME_HALF_W - q.y) < CFG.flickGoalD) return false;
  const bv = Math.hypot(mp.bvx, mp.bvy);
  if (bv < 4 || mp.bvx / bv * dir < 0.2) return false;
  const bux = mp.bvx / bv, buy = mp.bvy / bv;
  const us = s.players[side], off = meOffsideLine(s, side);
  const spd = Math.min(18, bv * CFG.flickKeep + CFG.headV * power * 0.25);
  let bj = -1, bsc = -Infinity, bx = 0, by = 0;
  for (let j = 0; j < us.length; j++) {
    const t = us[j];
    if (j === i || !t || t.off || t.pos === "GK") continue;
    const dx = t.x - q.x, dy = t.y - q.y, d = Math.hypot(dx, dy);
    if (d < CFG.flickMinD || d > CFG.flickMaxD || (dx * bux + dy * buy) / d < CFG.flickCos) continue;
    if ((t.x - off) * dir > CFG.offTol && (t.x - PITCH_L / 2) * dir > 0 && (t.x - q.x) * dir > 0) continue;
    const T = d / spd, ax = t.x + (t.vx || 0) / ME_DT * T, ay = t.y + (t.vy || 0) / ME_DT * T;
    const sc = (t.x - q.x) * dir + Math.min(8, meOppDist(s, side, ax, ay)) * 1.5 + ((t._runT ?? 0) > 0 ? 4 : 0);
    if (sc > bsc) { bsc = sc; bj = j; bx = ax; by = ay; }
  }
  if (bj < 0) return false;
  const sk = Math.max(0, Math.min(1, (meAttrs(q).strength / 99 + meTech(meAttrs(q).pass)) / 2));
  const ang = Math.atan2(by - mp.by, bx - mp.bx) + (rng.u() + rng.u() - 1) * CFG.flickNoise * (1 - 0.6 * sk) * Math.PI / 180;
  mp.bvx = Math.cos(ang) * spd; mp.bvy = Math.sin(ang) * spd; mp.bvz = 2.5;
  mp.fj = bj;
  mp.passPending = { side, p: 0.5, thru: true, high: true, d: Math.hypot(bx - q.x, by - q.y), off: false,
                     ox: us[bj].x, oy: us[bj].y, t: 0, sx: q.x, sy: q.y, byP: q, ax: bx, ay: by, fj: bj, k: "flick" };
  meEvt(out, "head", side, q.x, q.y, bx, by, null);
  meBallPredict(mp);
  return true;
}

// Published for the viewer: the last thing that happened and where, plus a rolling commentary.
export function meEvt(out, k, side, x0, y0, x1, y1, txt, extra) {
  if (!out) return;
  out.evt = { k, side, x0, y0, x1, y1, age: 0 };
  // extra is for what the caption cannot carry structurally -- which offence the red was for, which
  // part of him went. Reading those back out of the wording is how the feed used to do it, and a
  // reworded caption silently broke it.
  if (out.feed && txt) {
    out.feed.unshift(extra ? { min: out.min || 0, add: out.add || 0, side, k, txt, ...extra }
                           : { min: out.min || 0, add: out.add || 0, side, k, txt });
    // 200, not 60: with restarts in the feed a whole match no longer fits in 60, and the
    // in-match sidebar scrolls its full history.
    if (out.feed.length > 200) out.feed.pop();
  }
}


