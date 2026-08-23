// The tick loop, the ball, restarts, and match setup.
import { CFG } from "./config";
import { meAerial, meAttrs, meDuel, meGkSkill, meSpeed, meTech } from "./attributes";
import { GOAL_HALF_W, GOAL_H, meBallPredict, meBallStep, meKickBall, meKnock, meLoftFor, meShootBall } from "./ball";
import { meBlock, meDuties, meRuns, meShape, meSlots, meTactical } from "./brain";
import { meSPBegin, meSPFetch, meSPReady, meSPShape, meSPTake } from "./setpiece";
import { meXgCal, meDecide, meShotP } from "./decide";
import { ME_HALF_W, ME_MAP_STRIDE, ME_SIDES, PITCH_L, PITCH_W, meBuildMaps, meClosest, meDanger, meDir, meGoalX, meGroundT, meIntercept, meKeeper, meKeeperIx, meLaneBlock, meOffsideLine, meOther, mePressure, meShotGeom, meTimeToBallMs } from "./geometry";

// ==================== POSITIONAL MATCH ENGINE =============================================
// Twenty-two players on a 105x68 pitch, advanced in quarter-second slices. No team rating appears
// anywhere below this line. A chance exists because somebody found space and a pass reached him; a
// goal exists because a finisher beat a keeper. Instructions bias what a player ATTEMPTS and never
// what succeeds, so every setting costs something somewhere -- turn the press up and the space
// behind it is really there for someone to run into. That is the whole reason for the rewrite.
export { ME_HZ, ME_DT, ME_TPM } from "./config";
import { ME_CHASE, ME_CHASE_W, ME_DEAD_SCALE, ME_DT, ME_HOME_ADV, ME_RED_SAID, ME_SIM_MIN, ME_STRAT_RANGE, ME_TPM, meDrill, meMinute, mePickInjury } from "./config";

// ---- setup ------------------------------------------------------------------------------
// Positions live ON the player records, not in a side table, so cloneState already deep-copies them
// and stepping a live match backwards keeps working with no extra plumbing.
/** `slotsFor(formation)` returns 11 `[x, y]` slots in 0..100 space, y=100 on your own goal line.
 *  Injected rather than imported so the engine has no dependency on the app at all. */
// WHAT A SHAPE BECOMES WHEN IT LOSES THE BALL. A 3-4-3 does not defend as a 3-4-3; the wing-backs
// drop and it is a 5-4-1. Nothing here was ever told that, so a side defended in the shape it
// attacks in -- which is why a back five put fewer men in its own box than a back four.
//
// Names, not coordinates: the app's slot table already has every one of these, and the only thing a
// defensive shape has to supply is relative depth order and width. meBlock derives the actual line
// and spacing from the ball. Two of the names were authored for this (5-4-1 and 4-4-1-1) because
// the generated fallback lays out flat evenly-spaced rows and would have put a back five in one
// line, nine metres higher up the pitch than an authored back four sits.
export const ME_DEF_FORM = {
  "3-4-3": "5-4-1", "3-5-2": "5-3-2", "3-4-1-2": "5-3-2",
  "4-2-4": "4-4-2", "4-1-2-1-2": "4-4-2", "4-3-2-1": "4-4-2",
  "4-3-3": "4-1-4-1", "4-2-3-1": "4-4-1-1",
};

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
  // WHAT THE SIDE HAS DRILLED. Read off the instructions as stamped and fit-damped, and spent as
  // effective rating on everyone who plays -- bench included, since a substitute has been at the
  // same training ground. A side with no instructions gets exactly nothing here, which is the whole
  // design: no plan is the floor, rather than the safest option it used to be.
  // Applied BEFORE the home-advantage nudge below so the two simply add, and before _att is ever
  // read, since meAttrs memoises off ovr the first time anybody asks.
  // THE RATING THE CLUB LISTS, kept before anything bends it. meInit adds the drill penalty below
  // and the home-advantage nudge after it, both properties of THIS MATCH -- so a side carrying no
  // instructions showed every player about ten points under the number on his own page, and the
  // squad average with him. Taken for EVERY side before the loop that applies the penalty, because
  // that loop returns early when a side has none to apply, and a fully committed side needs its
  // base rating just as much. The engine goes on playing at p.ovr; the report reads ovr0.
  for (const side of ME_SIDES)
    for (const p of [...(s.players[side] || []), ...(s.bench?.[side] || [])])
      if (p.ovr0 === undefined) p.ovr0 = p.ovr ?? 70;
  for (const side of ME_SIDES) {
    const d = meDrill(s.strategy?.[side]);
    if (!d) continue;
    for (const p of [...(s.players[side] || []), ...(s.bench?.[side] || [])]) {
      p.ovr = (p.ovr ?? 70) + d; p._att = null;
    }
  }
  // WHERE THE TWO SIDES PLAY FROM, applied before anything else reads an instruction so it lands on
  // the baseline stamped into mp.stratBase below. s.homeAdv names the side WITH the advantage rather
  // than the fixture's home slot: a tie played at the away team's ground sets it to "away".
  if (s.homeAdv === "home" || s.homeAdv === "away") {
    const host = s.homeAdv, k = ME_HOME_ADV.k;
    const tilt = (side, shape) => {
      const st = s.strategy?.[side]; if (!st) return;
      for (const key in shape) {
        const r = ME_STRAT_RANGE[key] || [-2, 2];
        st[key] = Math.max(r[0], Math.min(r[1], (st[key] || 0) + shape[key] * k));
      }
    };
    tilt(host, ME_HOME_ADV.host);
    tilt(meOther(host), ME_HOME_ADV.guest);
    // Bench included: a substitute is playing in front of the same crowd as the man he replaced.
    // _att is memoised off ovr the first time anybody reads it, so it has to be dropped with it.
    if (ME_HOME_ADV.ovr) for (const p of [...(s.players[host] || []), ...(s.bench?.[host] || [])]) {
      p.ovr = (p.ovr ?? 70) + ME_HOME_ADV.ovr * k; p._att = null;
    }
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
    let scramble = (mp.idx < 0 || mp.flight) ? mp.desig[side] : -1;
    if (mp.flight && mp.fside === side && mp.fj >= 0) scramble = mp.fj;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.off) { p.vx = 0; p.vy = 0; continue; }  // sent off
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
      if (i === scramble && !gkShot) {
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
               * (onBall ? (p._strideT > 0
                            ? CFG.carrySpeed + (1 - CFG.carrySpeed) * (p._stride || 0)
                            : CFG.carrySpeed) : 1)
               * (p.knock > 0 ? CFG.injKnockSpd : 1)
               // Beaten. He dived in, the man went past him, and he is turning: taking him out of
               // the pressing pool was not enough on its own, because somebody else simply stepped
               // in. What being beaten costs is the GROUND, and only a committed defender pays it.
               * (p._beat > 0 ? CFG.tkBeatSpd : 1);
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
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
      const stopAt = (mp.sp && p._spSet) ? 0.12 : p.pos === "GK" ? 0.25 : onBall ? 0
                   : i === scramble ? (deadBall ? 0 : CFG.scrambleStop)
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
      const chase = i === scramble || onBall || (p._cut ?? 0) > 0 || p._duty === "press"
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
        if (rival - need < CFG.contestMs) vCap = sp;
        else vCap = Math.max(2.2, Math.min(sp, sp * need / Math.max(1, Math.min(budget, rival + 100))));
      }
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
        const gk = meGkSkill(a);
        const react = CFG.gkReactSlow + (CFG.gkReactFast - CFG.gkReactSlow) * gk;
        if ((mp.tick - mp.shot.t0) * ME_DT >= react) {
          vCap = CFG.gkDiveVmin + (CFG.gkDiveVmax - CFG.gkDiveVmin) * gk;
          diving = true;
        }
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
        const ux = dx / d, uy = dy / d;
        const close = Math.min(d * CFG.pursueGain,
                               Math.sqrt(2 * CFG.recvBrake * Math.max(0, d - CFG.standoff)));
        let dvx = mp.bvx + ux * close, dvy = mp.bvy + uy * close;
        const dm = Math.hypot(dvx, dvy);
        if (dm > sp) { dvx *= sp / dm; dvy *= sp / dm; }   // his legs are the only limit
        wx = dvx * ME_DT; wy = dvy * ME_DT;
      }
      // Nobody stands on a team-mate.
      let sx = 0, sy = 0;
      for (const q of ps) {
        if (q === p) continue;
        const qx = p.x - q.x, qy = p.y - q.y, qd = Math.hypot(qx, qy);
        if (qd > CFG.sepR || qd < 0.05) continue;
        const w = (CFG.sepR - qd) / CFG.sepR;
        sx += qx / qd * w * w; sy += qy / qd * w * w;
      }
      wx += sx * CFG.sepW * sp * ME_DT; wy += sy * CFG.sepW * sp * ME_DT;
      const cur = Math.hypot(p.vx || 0, p.vy || 0);
      // Turning hard scrubs speed off, the way it does on grass.
      let acc = CFG.accel;
      if (cur > 0.02 && step > 0.02) {
        const dot = ((p.vx * wx) + (p.vy * wy)) / (cur * step);
        acc *= 1 - CFG.turnPenalty * Math.max(0, -dot);
      }
      // Walking onto a set-piece mark: no momentum, so he arrives on it rather than orbiting it.
      if (mp.sp && d < CFG.spArrive) acc = 1;
      if (diving) acc = 1;                       // he throws himself; there is no wind-up
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
      p.stamina = Math.max(0, (p.stamina ?? 100) - step * CFG.drain
      // TEMPO IS PAID IN LEGS, not in accuracy. Pressing has always cost stamina here; playing fast
      // is the same kind of thing and a better cost than widening the aim cone, because it is
      // DEFERRED -- you go quick now and fade for it later, which is what makes tempo a decision
      // you take at a moment rather than a slider you set once. The existing fatigue and
      // substitution machinery then handles the consequence without anything new.
      // Clamped at zero as a whole, so a slow side saves legs but can never bank stamina.
      * (1 + Math.max(0, (s.strategy?.[side]?.pressingLOE || 0) * 0.18
                          + (s.strategy?.[side]?.tempo || 0) * CFG.tempoDrain)));
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


// ---- the tick ---------------------------------------------------------------------------
export function meBallTo(s, side, i, x, y) {
  const mp = s.mePos;
  if (mp.side !== side) { mp.counter = side; mp.counterT = 26; mp.possT = 0; }   // just won it
  mp.drive = 0;
  for (const q of s.players[meOther(side)]) { q._run = null; q._runT = 0; }
  // Never inside the man who has just taken it. The ball is left where it was claimed, and a claim
  // can happen anywhere inside his reach -- including on top of him, where it is drawn inside the
  // player until the next slice's body ejection pushes it back out.
  const _p = s.players[side]?.[i];
  if (_p) {
    const _R = CFG.bodyR + CFG.ballR;
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
  mp.kickBy = null;
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
export const meLockedOut = (mp, sd, i) =>
  !!mp.kickBy && mp.kickBy.some(k => k.s === sd && k.i === i && mp.tick - k.t < CFG.kickLock);


// Whoever is nearest a loose ball takes it, better positional players slightly favoured.
export function meScramble(s, rng) {
  const mp = s.mePos; let bi = -1, bs = "home", bd = Infinity;
  for (const side of ME_SIDES) for (let i = 0; i < s.players[side].length; i++) {
    const q = s.players[side][i];
    const d = Math.hypot(q.x - mp.bx, q.y - mp.by) * (1 - meAttrs(q).position / 99 * 0.18) + rng.u() * 1.5;
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
export const meRate = (p, d) => {
  if (p && d) p.rating = Math.max(3, Math.min(10, +(((p.rating ?? 6.5) + d).toFixed(2))));
};

// FULL TIME, for the ratings only -- nothing else in the engine needs a whistle, which is why there
// has never been one. Two corrections that can only be made once the match is over:
//
// MINUTES. A substitute who came on for the last five minutes and touched nothing must not be rated
// as confidently as a man who played ninety. His deviation from par is shrunk toward it in
// proportion to how much of the match he was actually on for, so a cameo has to be emphatic to
// register at all -- which is exactly how a cameo works.
//
// POSITION. A goal is worth 0.9 and the most a defender can do for one is 0.12, so forwards
// finished 0.52 clear of keepers on identical squads -- and the substitution logic hooks whoever
// sits furthest below his team's average, which means defenders were being taken off all season for
// playing their position. The shift is deliberately NOT a scale: the gap is in the mean, and scaling
// a deviation can only reach a mean of zero by erasing the signal with it. It is a positional par,
// and it says the true thing -- a forward who did nothing all afternoon has failed at his job,
// while a defender who did nothing has done his.
//
// The offsets are calibrated against test/ratings.mjs and have to be re-derived if the phase A or B
// deltas move. That is a real maintenance edge and it is why the harness exists.
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
      const shrink = p.rc ? 1 : Math.min(1, frac / CFG.rateFullFrac);
      const dev = (p.rating - 6.5) * (CFG.rateSpread?.[p.pos] ?? 1) + (CFG.ratePos[p.pos] ?? 0);
      p.rating = Math.max(3, Math.min(10, +((6.5 + dev * shrink).toFixed(2))));
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
const mePenRes = (out, sh, mp) => {
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
  pmList.push({ name: sh.name, full: sh.full || sh.name, min: out.min ?? 0, add: out.add || 0 });
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
  (out.sendOff = out.sendOff || { home: [], away: [] })[side].push(
    { name: q.name, full: q.fullName || q.name, min: out.min ?? 0, add: out.add || 0, second: why === "second", why });
  meEvt(out, "red", side, x, y, x, y,
        `${q.fullName || q.name} is sent off, ${ME_RED_SAID[why] || "serious foul play"}`, { why });
}

export function meTackle(s, rng, out) {
  const mp = s.mePos;
  if (mp.sp || mp.idx < 0) return;
  const atk = mp.side, def = meOther(atk);
  const c = s.players[atk]?.[mp.idx]; if (!c || c.off) return;
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
                        - (s.strategy?.[def]?.tackling || 0) * CFG.tkGoInstr
                        // A booked man jockeys. He wants a better angle than he would have settled
                        // for before, which costs his side tackles -- and that is the handicap.
                        + ((p.yc || 0) ? CFG.tkGoBooked : 0);
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
      // Nobody behind him and it mattered where he did it: that is the tackle a defender is for.
      const lastMan = !covered && Math.abs(meGoalX(atk) - c.x) < CFG.tkLastManR;
      meRate(p, CFG.rateTackle + CFG.rateDuelWon + (lastMan ? CFG.rateLastMan : 0));
      p.defActs = (p.defActs || 0) + 1; p.duelWon = (p.duelWon || 0) + 1;
      // ...and the man he took it off lost it.
      meRate(c, -CFG.rateDuelLost); c.duelLost = (c.duelLost || 0) + 1;
      meKickedBy(mp, def, i); meBallTo(s, def, i, mp.bx, mp.by);
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
    pk.p0.push({ q, goals: q.goals || 0, saves: q.saves || 0, rating: q.rating ?? 6.5 });
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
  for (const s0 of pk.p0 || []) { s0.q.goals = s0.goals; s0.q.saves = s0.saves; s0.q.rating = s0.rating; }
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
    const sp = ME_CHASE[s.styles?.[side]] || ME_CHASE.balanced;
    const lead = (out.goals?.[side] || 0) - (out.goals?.[meOther(side)] || 0);
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
    const k = mp.chaseT[side], w = k > 0 ? ME_CHASE_W.atk : ME_CHASE_W.def, m = Math.abs(k);
    for (const key in ME_STRAT_RANGE) {
      const r = ME_STRAT_RANGE[key];
      st[key] = Math.max(r[0], Math.min(r[1], (base[key] || 0) + (w[key] || 0) * m));
    }
  }
}

export function meTick(s, rng, out) {
  const mp = s.mePos;
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
    if (mp.sp.t === 1) for (const sd of ME_SIDES) { meAutoSubs(s, sd, out); meKeeperCrisis(s, sd, out); }
    meSPShape(s);
    meMove(s, rng);
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
          if (q.yc >= 2) meRed(s, out, wS, q, "second", wX, wY);
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
  const justKicked = (mp.kickBy || []).filter(k => mp.tick - k.t < CFG.kickLock)
                                     .map(k => s.players[k.s]?.[k.i]).filter(Boolean);
  const cross = meBallStep(mp, ME_DT, s.players.home.concat(s.players.away),
                           mp.idx >= 0 ? s.players[mp.side][mp.idx] : null, justKicked);
  meBallPredict(mp);
  // WHO TOUCHED IT LAST -- INCLUDING OFF A SHIN. hitBodies has always recorded the man the ball
  // physically bounced off, and wrote it to mp.hitP with the comment "he got a foot to it: that is
  // the touch". Nothing has ever read it. So a shot deflected behind off a defender was awarded as
  // a GOAL KICK, and a pass that clipped a defender and ran out of touch was thrown in the wrong
  // way, because both decisions asked mp.lastSide -- which only ever moves on a deliberate play.
  //
  // Kept separate from lastSide rather than folded into it. lastSide also gates the back-pass rule
  // and the handball, and both of those mean a DELIBERATE play by a team-mate: a keeper may pick up
  // a ball that has deflected off his own defender, and merging the two would have him unable to.
  mp.touchSide = mp.lastSide;
  // hitP is this tick's touch, touchP the one carried over from an earlier tick that nobody has
  // played on purpose since. Either beats lastSide, which only ever moves on a deliberate play.
  {
    const tp = mp.hitP || mp.touchP;
    if (tp) {
      if (s.players.home.indexOf(tp) >= 0) mp.touchSide = "home";
      else if (s.players.away.indexOf(tp) >= 0) mp.touchSide = "away";
    }
  }
  let stopTick = false;                  // a whistle blown inside tryPickup ends the tick
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
    // Per side as well, when the harness asks: pooled completion hides exactly the thing a
    // mismatch is about -- who is completing and who is coughing it up.
    if (out.passSide) out.passSide[pp.side]++;
    // Banked on COMPLETION, not per tick while it travels. Credited per tick, a forty-metre ball
    // hanging two seconds in the air earned three times what a five-metre one did, and the long-ball
    // styles floated to the top of the possession table -- Park The Bus highest in the game at 58.9%
    // with 261 passes. Airtime is not control. A pass that reaches a team-mate was your possession
    // the whole way; a hoof that gets headed clear never was.
    if (okSide === pp.side) { out.passOk++; if (out.passOkSide) out.passOkSide[pp.side]++;
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
  if (mp.by < 0 || mp.by > PITCH_W) { resolvePending(null); mePenRes(out, mp.shot, mp); mp.shot = null; meDead(s, "throw", meOther(mp.touchSide), 76, out); return; }
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
        if (sh) out.onTarget[sh.side]++;
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
            if (q.pos === "GK") meRate(q, -meConcedePen(xg, !!(sh && sh.pen)));
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
      if (cross.conceding === mp.touchSide) meDead(s, "corner", meOther(cross.conceding), 236, out);
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
    // This runs BEFORE the goal line is adjudicated. A struck shot covers six metres in a slice, so
    // meBallStep would see it cross and score it while the pickup scan -- the only place a keeper
    // can ever touch the ball -- had not run yet. Measured in isolation: from eight metres, 158 of
    // 160 shots went in and the keeper made ZERO saves, because he was never asked.
    const tryPickup = () => {
    if (mp.bz < CFG.gkHigh) {
      const x0 = mp._bpx ?? mp.bx, y0 = mp._bpy ?? mp.by;
      const dx = mp.bx - x0, dy = mp.by - y0, L2 = dx * dx + dy * dy;
      const v2dNow = Math.hypot(mp.bvx, mp.bvy);
      const fast = Math.max(0, Math.min(1, (v2dNow - CFG.fastDodgeV0) / (CFG.fastDodgeV1 - CFG.fastDodgeV0)));
      // How far THIS man gets a foot, a boot or a glove to it. Touching distance is a FOOT away, not
      // a torso away and not a metre and a half: a footballer reaches about 0.7 m, and that circle is
      // drawn on the pitch so what you see touching and what the engine calls a touch cannot
      // disagree. It has to be answered INSIDE the scan. Computing one reach after picking the single
      // nearest body meant a keeper's arm was judged against a defender's toe -- any outfielder a few
      // centimetres nearer the path stopped the man with three times the reach from being considered.
      const reachOf = (q, sd, i, isRcv, zAt) => {
        // A KEEPER SAVES WITH HIS BODY. No reach ring, no radius that swells with the flight time --
        // he stops what he physically gets in front of, exactly like the ball bouncing off anybody
        // else. What separates a good keeper from a poor one is now entirely how quickly he reads the
        // shot and how fast he moves to it, which is where it belongs.
        if (q.pos === "GK") {
          // On the floor of his own box, against a ball the other side touched last, he claims with
          // his hands -- a dive's span, not a boot. Everywhere else, and against any airborne ball,
          // the strict body radius stands: a save is still stopped only by what he gets in front of.
          // ...and only on a ball RUNNING LOOSE -- a dribbler's heavy touch, a spill, a scramble.
          // A struck pass in flight keeps the body radius it always had: with hands against those
          // too he swept every through-ball threaded into the box, and goals a match fell by a
          // fifth. Measured: 2.91 -> 2.33 with hands against everything, 2.84 loose-only.
          if (!mp.flight && zAt < CFG.handMinZ && mp.lastSide !== sd
              && Math.hypot(q.x - meGoalX(meOther(sd)), q.y - ME_HALF_W) < CFG.gkBoxR)
            return CFG.gkClaimReach;
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
                       : CFG.cutReach * (CFG.cutAntLo + meTech(meAttrs(q).position) * CFG.cutAntW))
              * (1 - fast * CFG.fastDodge);
        // Blocking a shot is the same reach as everything else. A separate, larger blocking radius
        // had a defender sweeping a 3.1 m corridor -- five times his own body -- so a crowded box
        // absorbed almost everything struck into it.
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
        else if (mp.idx >= 0 && mp.side !== sd) r += meTech(meAttrs(q).tackle) * CFG.tackleReach;
        // IN THE AIR he is not stretching a boot out, he is getting up. Reach stops being what a
        // foot can span and becomes how well he attacks the ball, which is the aerial duel: put two
        // men under the same cross and the bigger one wins it, with no separate roll to decide it.
        if (zAt > CFG.headMinZ) r = CFG.headReach * (CFG.headLo + (1 - CFG.headLo) * meAttrs(q).strength / 99);
        return r;
      };
      // WHO MEETS IT FIRST. At pass speed the ball covers a metre and a half in a slice, so "nearest
      // body to the segment" samples the race at the wrong instant: a defender the ball crossed at
      // the START of that segment lost to a receiver sitting at the end of it. On top of that the
      // man it was played to used to be handed it outright whenever he was within his own reach, so a
      // defender standing 0.1 m off the line lost the ball to a receiver 0.6 m off it. Measured, 35
      // of the 74 passes that came within 0.6 m of an opponent's boot still reached their man -- a
      // ball passing straight through somebody. Order ALONG THE PATH settles it, with no override.
      // A ball at a man's FEET is a different question: he is in contact with it for the whole slice,
      // so a dribble is still settled by who gets a boot nearer it, which is what tackling is.
      const _bz0 = mp._bpz ?? mp.bz;      // height at the START of the slice; mp.bz is the end of it
      const byTime = mp.idx < 0;
      let bi = -1, bs = null, bd = Infinity, br = 0, bt = Infinity;
      for (const sd of ME_SIDES) for (let i = 0; i < s.players[sd].length; i++) {
        if (meLockedOut(mp, sd, i)) continue;
        if (s.players[sd][i].off) continue;         // sent off: he is not on the pitch
        // It is in his hands. There is no contest for that -- which is exactly why collecting it is
        // the safest thing a keeper can do, and why he should want to.
        if (mp.held && !(mp.idx === i && mp.side === sd)) continue;
        const q = s.players[sd][i];
        let t = L2 > 0.001 ? Math.max(0, Math.min(1, ((q.x - x0) * dx + (q.y - y0) * dy) / L2)) : 0;
        let d = Math.hypot(q.x - (x0 + dx * t), q.y - (y0 + dy * t));
        // A DIVING KEEPER IS NOT A SPHERE, and he is moving while the ball is.
        //
        // Modelling him as a 0.39 m disc is why he could not keep goal. That disc is 2.7% of a 7.32 x
        // 2.44 m mouth and sweeps about 18% of it on a full-length dive, on the one side he read -- so
        // a 69% save rate was arithmetically out of reach whatever his reaction and his dive speed
        // were set to, which is exactly what four rounds of tuning the shooters, the presser and the
        // keeper himself all found. A man fully extended is about two metres from fingertip to toe.
        // This is still his body and nothing but his body: no reach ring, no radius that swells with
        // the flight time. It is the right SHAPE for a man in the air, and it only opens up when he
        // is actually going -- standing still he is a body, and that is all he is.
        //
        // The contest runs in phase 1 and everybody is moved in phase 2, so he is also swept from
        // where he stands to where he will be. At diving pace that lag alone was 1.9 m of a 3.66 m
        // goal: he was beaten before he left the ground.
        if (q.pos === "GK") {
          // WHERE HE IS GOING, not where he was going. The contest runs before this slice's
          // movement, so he was swept along LAST slice's step -- and a keeper who had settled on
          // his read, about to dive at a ball that had strayed off it, had no last step: he stood
          // as a disc while a ball he would have reached went past him. Measured at 0.45-0.85 s of
          // flight, the keeper who read the shot RIGHT conceded 15% and the one who read it wrong
          // 7%, because the wrong-footed man was still diving at full stretch, span out, when the
          // ball arrived, and the right-footed man had stopped and lost his span. That inversion
          // is why a better keeper, who reads right more often, did not concede less. With a shot
          // live and his reaction paid he is swept along the dive he is about to make -- toward his
          // read, at diving pace -- which is what the comment below always said was happening.
          let gvx = q.vx || 0, gvy = q.vy || 0;
          if (q._closing && mp.shot && mp.shot.side !== sd) {
            const gk = meGkSkill(meAttrs(q));
            if ((mp.tick - mp.shot.t0) * ME_DT >= CFG.gkReactSlow + (CFG.gkReactFast - CFG.gkReactSlow) * gk) {
              const tdx = (q._tx ?? q.x) - q.x, tdy = (q._ty ?? q.y) - q.y, tl = Math.hypot(tdx, tdy);
              if (tl > 1e-3) {
                const stp = Math.min(tl, (CFG.gkDiveVmin + (CFG.gkDiveVmax - CFG.gkDiveVmin) * gk) * ME_DT);
                gvx = tdx / tl * stp; gvy = tdy / tl * stp;
              }
            }
          }
          const spd = Math.hypot(gvx, gvy) / ME_DT;
          const ext = Math.max(0, Math.min(1, (spd - CFG.gkSpanV0) / (CFG.gkSpanV1 - CFG.gkSpanV0))) * CFG.gkSpan;
          const ux = spd > 1e-4 ? gvx / (spd * ME_DT) : 0;
          const uy = spd > 1e-4 ? gvy / (spd * ME_DT) : 0;
          for (let k = 0; k <= 2; k++) {                 // across the slice he is about to travel
            const cx = q.x + gvx * (k / 2), cy = q.y + gvy * (k / 2);
            for (let e = -1; e <= 1; e++) {              // ...and along the whole of him
              const sx = cx + ux * ext * e, sy = cy + uy * ext * e;
              const tk = L2 > 0.001 ? Math.max(0, Math.min(1, ((sx - x0) * dx + (sy - y0) * dy) / L2)) : 0;
              const dk = Math.hypot(sx - (x0 + dx * tk), sy - (y0 + dy * tk));
              if (dk < d) { d = dk; t = tk; }
            }
          }
        }
        const zAt = _bz0 + (mp.bz - _bz0) * t;
        const r = reachOf(q, sd, i, mp.flight && sd === mp.fside && i === mp.fj, zAt);
        if (r < 0 || d >= r) continue;              // he cannot get to it at all
        const better = byTime ? (t < bt - 1e-6 || (t < bt + 1e-6 && d - r < bd - br))
                              : (d - r < bd - br);
        if (better) { bt = t; bd = d; br = r; bi = i; bs = sd; }
      }
      if (bi < 0) return false;
      const isGK = s.players[bs][bi].pos === "GK";
      const reach = br;
      {
        const q = s.players[bs][bi], qa = meAttrs(q);
        const v2d = v2dNow;
        // HANDBALL. Only askable now that the ball is an object with a height: it struck him above
        // waist height, inside his own area, off an opponent's touch. An event engine had nothing to
        // test -- there was no ball and no arm for it to hit.
        // ...at the height it STRUCK him, which is not mp.bz. tryPickup runs after meBallStep, so
        // mp.bz is where the ball finished the slice -- by which point a dropping ball has landed and
        // settled at ballR. Asking that gave zero handballs a match even with the probability forced
        // to 1, while the geometry itself occurs about three times a match. The contact height is
        // the previous height interpolated to bt, the point along the path where he met it.
        const zHit = _bz0 + (mp.bz - _bz0) * (bt === Infinity ? 1 : bt);
        if (!isGK && zHit > CFG.handMinZ && mp.lastSide && mp.lastSide !== bs
            && Math.abs(q.x - meGoalX(meOther(bs))) < CFG.gkBoxR
            && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW
            && rng.u() < CFG.handP) {
          out.fouls[bs]++;
          meEvt(out, "foul", bs, mp.bx, mp.by, mp.bx, mp.by, `Handball, ${q.fullName || q.name}`);
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
        // ball is RIGHT NOW. tryPickup resolves the contest against the path the ball swept this
        // slice, so the first slice a man comes within reach of a lofted pass is usually while it is
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
        if (!isGK && zHit > headZ && zNext > CFG.headHoldZ) {
          const gxA = meGoalX(bs), ownA = meGoalX(meOther(bs));
          const dGoalA = Math.hypot(gxA - q.x, ME_HALF_W - q.y);
          const power = CFG.headLo + meAttrs(q).strength / 99 * (1 - CFG.headLo);
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
            // Priced with the same model a strike uses, from where the header is met, so a free
            // header six yards out is worth what a shot from there is worth. headXg is the knob if
            // heading turns out to deserve a discount against a foot; it ships at parity because
            // the outcome here is resolved by the physics either way, exactly as a strike is.
            const hp = meXgCal(meShotP(s, bs, q, q.x, q.y, true) * CFG.headXg);
            if (out.xgS) out.xgS[bs] += hp;
            if (out.shotDist) { out.shotDist[Math.min(9, Math.floor(dGoalA / 5))]++;
                                out.xg = (out.xg || 0) + hp; }
            const aimY = ME_HALF_W + (q.y < ME_HALF_W ? 1 : -1) * GOAL_HALF_W * CFG.headAim;
            mp.shot = { side: bs, name: q.name, full: q.fullName || q.name, i: bi, t0: mp.tick, p: q, xg: hp };
            const gkH = s.players[meOther(bs)].find(z => z.pos === "GK");
            if (gkH) {
              const okH = rng.u() < CFG.gkReadMin + (CFG.gkReadMax - CFG.gkReadMin) * meGkSkill(meAttrs(gkH));
              mp.shot.readY = okH ? aimY : ME_HALF_W - (aimY - ME_HALF_W);
            }
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
            meKnock(mp, rng, gxA, aimY, CFG.headV * power, 0.35);
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
            if (relief) { out.clears++; meBump(out, "clearsSide", meSideOfP(s, q)); meRate(q, CFG.rateClear);
                          q.defActs = (q.defActs || 0) + 1; }
            // Neither a flick-on nor a header away is commentary. Measured, captioned events ran
            // 142 a match against a feed that holds 60, so the routine kinds were literally pushing
            // the goals off the end of the buffer -- which is what the "only second half" summary
            // turned out to be. Everything muted here still FIRES: the pitch draws it and every
            // counter, out.clears and the player T+C column included, still moves.
            meEvt(out, relief ? "clear" : "head", bs, q.x, q.y, tx, ty, null);
            meKnock(mp, rng, tx, ty, CFG.headV * power * 0.75, 0.9);
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
        // ...but ONLY on a new touch. Applied to the man already carrying it this rewinds the ball
        // to his contact point every single slice, which undoes the movement meBallStep just made
        // and freezes it at his feet: measured, the match stopped dead -- 0% pass completion, no
        // goals, no shots, nothing.
        if (!(mp.idx === bi && mp.side === bs)) {
          mp.bx = x0 + dx * bt; mp.by = y0 + dy * bt;
          if (isGK && mp.bx > 0.05 && mp.bx < PITCH_L - 0.05) mp._gkTouch = mp.tick;
        }
        // HANDS: in his own area, and only if the last man to touch it was not a team-mate. A
        // deliberate ball back from his own defender he has to play with his feet like anybody else.
        const inBox = isGK && Math.abs(q.x - meGoalX(meOther(bs))) < CFG.gkBoxR;
        const canHandle = isGK && inBox && mp.lastSide !== bs;
        // How far beyond his own wingspan he had to go. THAT is what decides whether he holds it:
        // inside his arms he barely moved and he catches it, past them he has dived, and a dive is
        // a deflection. Ball speed does not come into it.
        // How far off centre it struck him. Through his middle he gathers it; off the edge of him
        // it comes back off, and the further out the less of him was behind it.
        // How far off CENTRE it struck him -- not how far off the nearest bit of him, which with a
        // capsule is nearly zero for a fingertip save and would have scored the hardest saves in the
        // game as comfortable catches. Through his middle he gathers it; off the end of an
        // outstretched arm it comes back off him, and that is where rebounds come from.
        const dive = isGK ? Math.max(0, Math.hypot(mp.bx - q.x, mp.by - q.y) - CFG.gkCatchR)
                          : Math.max(0, bd - CFG.gkCatchR);
        if (isGK && (dive > CFG.gkCatchDive || !canHandle) && v2d > CFG.gkLiveV) {
          // Too hot to hold: parried away, still live. This is where rebounds come from.
          const shp = mp.shot;
          if (shp) { out.onTarget[shp.side]++; out.saves[bs]++; q.saves = (q.saves || 0) + 1;
            meRate(q, meSaveBonus(shp.xg, shp.pen) + (shp.pen ? CFG.ratePenSave : 0));
            if (shp.p) meRate(shp.p, CFG.rateShotOn);
            mePenRes(out, shp);
                     meEvt(out, shp.pen ? "penmiss" : "save", shp.pen ? shp.side : bs, mp.bx, mp.by, mp.bx, mp.by,
                           shp.pen ? `${q.fullName || q.name} saves the penalty` : `${q.fullName || q.name} parries it`); }
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
                                 credit: meSaveBonus(shp.xg, shp.pen) + (shp.pen ? CFG.ratePenSave : 0) };
          mePenRes(out, mp.shot); mp.shot = null; mp.lastSide = bs; meKickedBy(mp, bs, bi);
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
          const firm = Math.max(CFG.gkParryFloor, 1 - Math.min(1, dive / span));
          let nx2 = mp.bx - q.x, ny2 = mp.by - q.y;
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
          const rx = (mp.bvx - 2 * firm * dotn * nx2) * keepV + px2 * shove;
          const ry = (mp.bvy - 2 * firm * dotn * ny2) * keepV + py2 * shove;
          const rl = Math.hypot(rx, ry) || 1;
          meKnock(mp, rng, mp.bx + rx / rl * 8, mp.by + ry / rl * 8, Math.min(rl, v2d), 0.6);
          return;
        }
        if (isGK && mp.shot) {                       // gathered cleanly
          out.onTarget[mp.shot.side]++; out.saves[bs]++; q.saves = (q.saves || 0) + 1;
          meRate(q, meSaveBonus(mp.shot.xg, mp.shot.pen) + (mp.shot.pen ? CFG.ratePenSave : 0));
          if (mp.shot.p) meRate(mp.shot.p, CFG.rateShotOn);
          mePenRes(out, mp.shot);
          // The SIDE on an event is whose event it is, and a save is the keeper's. Tagged with the
          // shooter it drew the wrong club badge and the wrong colour in the feed, so a goalkeeper
          // keeping his side in it read as something the other lot had done.
          meEvt(out, mp.shot.pen ? "penmiss" : "save", mp.shot.pen ? mp.shot.side : bs,
                mp.bx, mp.by, mp.bx, mp.by,
                mp.shot.pen ? `${q.fullName || q.name} saves the penalty` : `${q.fullName || q.name} saves`);
          mePenRes(out, mp.shot); mp.shot = null;
        }
        // OFFSIDE. Given when he plays it, not when it was struck: a ball rolled into an offside man
        // that a defender cuts out first is simply a ball a defender cut out.
        if (mp.passPending && mp.passPending.off && mp.flight
            && bs === mp.fside && bi === mp.fj) {
          const pp = mp.passPending; mp.passPending = null;
          (out.offside = out.offside || { home: 0, away: 0 })[bs]++;
          meEvt(out, "offside", bs, pp.ox, pp.oy, pp.ox, pp.oy, `${q.fullName || q.name} is offside`);
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
            meRate(q, CFG.rateBlock);
            meEvt(out, "block", mp.shot.side, mp.bx, mp.by, mp.bx, mp.by, `${q.fullName || q.name} blocks it`);
            // Same rule as a parry: a shot that goes in off a DEFENDER is a deflected goal for the
            // man who hit it, not the defence putting it through their own net. Only a ball that
            // comes off the defending side twice is an own goal.
            mp.deflect = { side: mp.shot.side, t: mp.tick,
              n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
            mePenRes(out, mp.shot); mp.shot = null; }
          // A block ends the move: a goal off the rebound is nobody's assist. A deflection of a pass
          // does not, so the chain reads through it to the man who played the ball.
          mp.lastSide = bs; meKickedBy(mp, bs, bi, !wasBlock);
          meKnock(mp, rng, mp.bx + (rng.u() - 0.5) * 8, mp.by + (rng.u() - 0.5) * 8,
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
        if (mp.shot && bs !== mp.shot.side) {
          out.blocked = (out.blocked || 0) + 1; meBump(out, "blockedSide", bs);
          meRate(q, CFG.rateBlock);
          meEvt(out, "block", mp.shot.side, mp.bx, mp.by, mp.bx, mp.by, `${q.fullName || q.name} blocks it`);
          mp.deflect = { side: mp.shot.side, t: mp.tick,
            n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
          mePenRes(out, mp.shot); mp.shot = null;
        }
        const _cut = !!(mp.passPending && mp.passPending.side !== bs);
        resolvePending(bs);
        mp.flight = false;
        if (mp.idx === bi && mp.side === bs) return false;    // still his: not a new touch
        // The ball is NOT dragged to him. He has reached it; it stays where it is.
        const ivx = mp.bvx, ivy = mp.bvy, iv = Math.hypot(ivx, ivy);
        // Where his foot meets it, and how well.
        const stretch = Math.min(1, bd / Math.max(0.05, reach));
        const clean = Math.max(0, (1 - stretch * CFG.ftStretch)
                                * (1 - Math.min(1, iv / CFG.ftHot) * CFG.ftPace)
                                * (0.55 + meTech(qa.pass) * 0.45));
        if (clean < CFG.ftFail && iv > 1.5 && !isGK) {
          // A toe at full stretch. Not his.
          mp.lastSide = bs; meKickedBy(mp, bs, bi);
          const sa = Math.atan2(ivy, ivx) + (rng.u() - 0.5) * CFG.ftSquirtArc;
          meKnock(mp, rng, mp.bx + Math.cos(sa) * 6, mp.by + Math.sin(sa) * 6, iv * CFG.ftSquirt, 0);
          return true;
        }
        // A ball arriving BEHIND him is not one he runs on to. He checks, lets it come, and takes it
        // facing the right way. Left at full pace he sprints on while it chases him down over the
        // next two slices -- and that trailing ball, not any failure of dribbling, is most of what
        // "dragging it behind him" actually is: traced, the slices with the ball at his back were
        // overwhelmingly hold=2, the moment just after he collected it.
        if (!isGK) {
          const qv = Math.hypot(q.vx || 0, q.vy || 0);
          if (qv > 0.02 && ((mp.bx - q.x) * q.vx + (mp.by - q.y) * q.vy) / qv < CFG.ftCheckDot) {
            q.vx *= CFG.ftCheck; q.vy *= CFG.ftCheck;
          }
        }
        // READING IT. Stepping across somebody else's pass was the one defensive act that was free:
        // the passer paid for it, and the man who read it was paid nothing and counted nowhere, so he
        // finished the afternoon indistinguishable from the man beside him who read nothing. It is
        // paid here, on the clean pickup -- a toe-poke at full stretch has already returned above --
        // and it counts as a defensive action. Outfielders only: the keeper is rated on goals
        // prevented and nothing else, by design.
        if (_cut && !isGK) { q.ints = (q.ints || 0) + 1; q.defActs = (q.defActs || 0) + 1;
                             meRate(q, CFG.rateIntercept); }
        meBallTo(s, bs, bi, mp.bx, mp.by);
        // ...and if he was entitled to use them, it is now IN HIS HANDS. Nobody can take it off him
        // and he is not carrying it under his feet, so it sits out in front of him where it can be
        // seen. It used to be left at whatever coordinates it was claimed at, which for a keeper
        // smothering at close range is his own centre -- the ball drawn inside the man.
        if (canHandle) {
          mp.held = true;
          let hx2 = q.vx || 0, hy2 = q.vy || 0;
          let hl = Math.hypot(hx2, hy2);
          if (hl < 1e-3) { hx2 = meDir(meOther(bs)); hy2 = 0; hl = 1; }
          mp.bx = q.x + hx2 / hl * CFG.gkHoldOut; mp.by = q.y + hy2 / hl * CFG.gkHoldOut;
          mp.bvx = 0; mp.bvy = 0; meBallPredict(mp);
          return true;
        }
        // ...and it keeps rolling. A controlled first touch takes the pace off and sets it into his
        // stride; it does not stop the ball dead at his feet.
        // ...and it must leave his first touch at least as quick as HE is, or he simply runs past it.
        // Cushioning an 8 m/s pass to 2.6 while he arrives at 4 hands him a ball that is instantly
        // behind him -- which is the dragging, created at the moment of reception.
        const qsp = Math.hypot(q.vx || 0, q.vy || 0) / ME_DT;
        const keep = Math.max(qsp + CFG.ftAhead, Math.min(iv * CFG.ftKeep, CFG.ftMax));
        if (keep > 0.25) {
          const qs = Math.hypot(q.vx || 0, q.vy || 0);
          const kx = qs > 0.02 ? (q.vx || 0) / qs : (iv > 0.01 ? ivx / iv : 1);
          const ky = qs > 0.02 ? (q.vy || 0) / qs : (iv > 0.01 ? ivy / iv : 0);
          // A clean touch goes where he wants it; a scrappy one mostly carries on the way it came.
          const ox = iv > 0.01 ? ivx / iv : kx, oy = iv > 0.01 ? ivy / iv : ky;
          const mx = kx * clean + ox * (1 - clean), my = ky * clean + oy * (1 - clean);
          const ml = Math.hypot(mx, my) || 1;
          const sp2 = keep * (0.55 + 0.45 * clean);
          mp.bvx = mx / ml * sp2; mp.bvy = my / ml * sp2;
          meBallPredict(mp);
        }
        return true;
      }
    }
    return false;
  };
  const claimed = tryPickup();
  // A stoppage called inside the contest ends the slice. Without this the brains and meMove still
  // ran on top of a set piece that had just been set up, and everyone lurched once before the
  // restart shape took over.
  if (stopTick) return;
  // A keeper who got a hand to it got there BEFORE the line -- the ball has been moved back to where
  // he touched it, so the crossing meBallStep saw never happened. Without this the same shot was
  // recorded as a save and as a goal, which is where onTarget, saves and goals stopped adding up.
  if (cross && mp._gkTouch !== mp.tick) { endOfPlay(); return; }
  // NOTHING IS HAPPENING. A ball nobody owns that nobody is moving is not a slow passage of play,
  // it is a dead match -- and a dead match is worse than any wrong decision the engine could make
  // instead. The one cause of it is fixed in meMove above, but any future gap between "I have
  // arrived" and "I can touch it" would do exactly the same thing, and it costs four lines to make
  // that class of bug survivable. Give it to the nearest man and let the game go on.
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
      else { const ic = meIntercept(q, mp, vmax); q._icx = ic.x; q._icy = ic.y; q._icMs = ic.slotMs; ms = ic.ms; }
      q._ttbMs = ms;
      if (ms < bms) { bms = ms; bi = i; }
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
  if (mp.tick % 8 === 0) for (const side of ME_SIDES) meSlots(s, side);
  if (mp.tick % 2 === 0) meTactical(s);
  // Every tick, not every other one. Possession changes between runs, and a stale duty means a man
  // doing an ATTACKING job while the ball is in his own box -- measured at 22% of defending slices.
  for (const side of ME_SIDES) meDuties(s, side);
  for (const side of ME_SIDES) meRuns(s, side);
  for (const side of ME_SIDES) meBlock(s, side);   // both sides: see rest defence in meShape
  for (const side of ME_SIDES) meShape(s, side);
  meTackle(s, rng, out);          // he has jockeyed long enough: does he go?
  meMove(s, rng);
  // A ball IN HIS HANDS follows him. It is positioned in phase 1 and he is moved in phase 2, so the
  // frame that actually gets drawn has the man a stride further on than the ball he is carrying --
  // and that is the ball appearing inside the keeper rather than held in front of him.
  if (mp.held && mp.idx >= 0) {
    const h = s.players[mp.side][mp.idx];
    if (h) {
      let hx = h.vx || 0, hy = h.vy || 0, hl = Math.hypot(hx, hy);
      if (hl < 1e-3) { hx = mp.bx - h.x; hy = mp.by - h.y; hl = Math.hypot(hx, hy) || 1; }
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
  if (Math.hypot(p.x - mp.bx, p.y - mp.by) > CFG.touchKeep) { mp.idx = -1; return; }
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
  if (Math.hypot(p.x - mp.bx, p.y - mp.by) > CFG.reach * CFG.playReach) { meCarry(s, out, p); return; }
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
  if (qi >= 0 && qGap <= CFG.foulR) {
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
    const rate = CFG.foulBase * (1 + closeV * CFG.foulPace)
               * (1 - qa2.tackle / 99 * CFG.foulSkill)
               * (1 + (dSt.tackling || 0) * CFG.foulAggr)
               * (inArea0 ? CFG.foulBoxScale : 1)
               // On a yellow, and he knows it. This is the same challenge he would have made ten
               // minutes ago and did not make now.
               * ((q.yc || 0) ? CFG.foulBooked : 1);
    if (rng.u() < rate) {
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
      const gx = meGoalX(side), dirG = gx > p.x ? 1 : -1;
      let cover = 0;
      for (const d of opp)
        if (d && d !== q && !d.off && d.pos !== "GK" && (d.x - p.x) * dirG > 0) cover++;
      const clear = cover <= CFG.dogsoCover && meDanger(side, p.x, p.y) > CFG.dogsoDanger;
      let card = "", dogso = false;
      if (clear && rng.u() < CFG.dogsoRed) { card = "red"; dogso = true; }
      else if (rng.u() < CFG.cardStraightRed * sev) card = "red";
      else if (rng.u() < CFG.cardYellow * (0.4 + sev)) card = "yellow";
      meRate(q, card === "red" || card === "red2" ? -CFG.rateRed : card ? -CFG.rateYellow : 0);
      // Giving a penalty away is its own thing, separate from whatever card came with it, and the
      // man who drew it gets the credit for it.
      if (inArea0) { meRate(q, -CFG.ratePenGave); meRate(p, CFG.ratePenWon); }
      if (card === "yellow") {
        q.yc = (q.yc || 0) + 1;
        (out.yellows = out.yellows || { home: 0, away: 0 })[fSide]++;
        if (q.yc >= 2) card = "red2";
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
              card === "yellow" ? `${q.fullName || q.name} is booked` : `Foul by ${q.fullName || q.name}`);
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
      return;
    }
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
  const natBase = Math.max(1, Math.round(CFG.holdBase - press * CFG.holdPress));
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
  const forced = mp.hold >= natural;
  const act = meDecide(s, rng, side, mp.idx, mp.hold - natBase + 1);
  if (act.k === "carry") { meCarry(s, out, p); return; }              // meDribble is already running him
  if (!forced && (act.sc ?? 0) <= CFG.actNow) return;
  mp.firstTouch = mp.hold <= 1;
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
    const sk = meTech(a.shoot);
    const away = gkp && gkp.y > ME_HALF_W ? -1 : 1;
    const aimY = ME_HALF_W + away * GOAL_HALF_W * (CFG.shotAimBase + sk * CFG.shotAimSkill);
    const aimZ = 0.25 + rng.u() * (0.5 + sk * GOAL_H * 0.45);
    // out.xg is both sides pooled, which is what the calibration harnesses want. Per side as well,
    // because a sweep that asks "did this instruction make the side BETTER" needs a difference, and
    // a goal is a Poisson count with a mean of 1.6 -- a whole match of it carries more noise than
    // the effect being measured. xG is the same question answered from ~8 continuous samples.
    // What the book says this shot was worth is the RECORDER's number, not the decision's --
    // see the keeper block in meShotP. act.p keeps steering the choice; xgRec is what is written.
    const xgRec = meXgCal(meShotP(s, side, p, p.x, p.y, true));
    if (out.shotDist) { const _g = meShotGeom(side, p.x, p.y); out.shotDist[Math.min(9, Math.floor(_g.d / 5))]++; out.xg = (out.xg || 0) + xgRec; }
    if (out.xgS) out.xgS[side] += xgRec;
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
    mp.shot = { side, name: p.name, full: p.fullName || p.name, i: shooter, xg: xgRec, t0: mp.tick, p };
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
    // THE READ. A keeper cannot wait to see a shot. From twelve metres it is past him before his
    // reaction and his travel have both been paid for, so waiting is being beaten by geometry every
    // time -- which, with the reach ring gone, is exactly what was happening: five to seven goals a
    // side and no dive speed able to rescue it. He commits to a side as the ball leaves the foot.
    // Reading it right IS goalkeeping, and it is what his rating buys him; read it wrong and he is
    // going the other way with the whole goal open, which is also what goalkeeping looks like.
    if (gkp) {
      const rk = meGkSkill(meAttrs(gkp));
      // ...and the more time he has, the better he reads it. A shot from six metres is a guess; one
      // from twenty-five he can genuinely see and pick a side on.
      const tAv = Math.hypot(gkp.x - p.x, gkp.y - p.y) / Math.max(8, CFG.shotV0 + sk * CFG.shotVSkill);
      const bonus = Math.max(0, Math.min(1, (tAv - CFG.gkReadT0) / CFG.gkReadTSpan)) * CFG.gkReadTime;
      const readOk = rng.u() < Math.min(0.97, CFG.gkReadMin + (CFG.gkReadMax - CFG.gkReadMin) * rk + bonus);
      mp.shot.readY = readOk ? aimY : ME_HALF_W - (aimY - ME_HALF_W);
    }
    meShootBall(mp, rng, gx, aimY, aimZ, sk / (mp.firstTouch ? CFG.firstTouchNoise : 1), press);
    return;
  }
  if (act.k === "clear") { out.clears++; meBump(out, "clearsSide", meSideOfP(s, p)); meRate(p, CFG.rateClear);
    p.defActs = (p.defActs || 0) + 1;
    meEvt(out, "clear", side, p.x, p.y, act.cx ?? p.x, act.cy ?? p.y, null);
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null;
    meKickBall(mp, rng, act.cx ?? (p.x + meDir(side) * 36), act.cy ?? (p.y + (rng.u() - 0.5) * 30),
               "clear", meTech(a.pass), press);
    return; }
  if (act.k === "touch") { out.clears++; meBump(out, "clearsSide", meSideOfP(s, p));
    // Into the stand. It concedes a throw and it keeps the goal, which is the trade being made.
    const sy = p.y < ME_HALF_W ? -4 : PITCH_W + 4;
    meEvt(out, "clear", side, p.x, p.y, p.x + meDir(side) * 6, sy, null);
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null;
    meKickBall(mp, rng, p.x + meDir(side) * 6, sy, "clear", meTech(a.pass), press);
    return; }
  const q = ps[act.j], dist = Math.hypot((act.ax ?? q.x) - p.x, (act.ay ?? q.y) - p.y);
  // Pass to where he WILL be, leading his current movement across the estimated flight.
  // A ball to his FEET is led by his movement across the flight. A ball into SPACE is not: the aim
  // point already IS the meeting point, solved for his run, and leading it again on top of that is
  // what sent every through ball skidding past him.
  // How long it will ACTUALLY take. A ground ball sheds pace the whole way: a twenty metre pass is
  // in flight for 1.90 s, not the 1.18 s a flat 17 m/s says, and an eight metre one for 1.02 s
  // against 0.47 -- so leading a moving receiver off that estimate aimed the ball at where he would
  // be barely half way through the flight, and it arrived behind him. Every other part of the engine
  // already solves this: the kick speed inverts the rolling ODE, the risk model integrates it, and
  // the receiver is charged against it. The one place that aims the pass was using a constant.
  const flight = act.high ? meLoftFor(dist).T : meGroundT(dist, dist);
  const est = Math.max(1, Math.min(20, flight / ME_DT));
  const baseX = act.ax ?? q.x, baseY = act.ay ?? q.y;
  const ld = act.thru ? 0 : est * CFG.leadFrac;
  const lx = Math.max(1, Math.min(PITCH_L - 1, baseX + (q.vx || 0) * ld));
  const ly = Math.max(1, Math.min(PITCH_W - 1, baseY + (q.vy || 0) * ld));
  // No completion roll. The kick carries execution noise (skill and pressure turn into degrees of
  // aim error and a power wobble) and then the flight is geometry's problem: whoever reaches the
  // path first gets it. A lofted ball goes over the midfield instead of through it.
  meEvt(out, "pass", side, p.x, p.y, lx, ly, null);
  meKickedBy(mp, side, mp.idx);
  mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = act.j; mp.lastSide = side;
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
  mp.passPending = { side, p: act.p, c: act.c, thru: !!act.thru, high: !!act.high, d: dist, forced,
                     off: wasOff, ox: q.x, oy: q.y, t: 0, sx: p.x, byP: p };
  meKickBall(mp, rng, lx, ly, act.high ? "high" : "ground",
             meTech(a.pass) / (mp.firstTouch ? Math.max(1, CFG.firstTouchNoise + (s.strategy?.[side]?.dribbling || 0) * CFG.dribTouch) : 1), press,
             s.strategy?.[side]?.tempo || 0);
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
    if (out.feed.length > 60) out.feed.pop();
  }
}


