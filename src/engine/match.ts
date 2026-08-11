// The tick loop, the ball, restarts, and match setup.
import { CFG } from "./config";
import { meAerial, meAttrs, meDuel, meGkSkill, meSpeed } from "./attributes";
import { GOAL_HALF_W, GOAL_H, meBallPredict, meBallStep, meKickBall, meKnock, meLoftFor, meShootBall } from "./ball";
import { meBlock, meDuties, meRuns, meShape, meSlots, meTactical } from "./brain";
import { meSPBegin, meSPReady, meSPShape, meSPTake } from "./setpiece";
import { meDecide } from "./decide";
import { ME_HALF_W, ME_MAP_STRIDE, ME_SIDES, PITCH_L, PITCH_W, meBuildMap, meClosest, meDanger, meDir, meGoalX, meGroundT, meIntercept, meLaneBlock, meOffsideLine, meOther, mePressure, meShotGeom, meTimeToBallMs } from "./geometry";

// ==================== POSITIONAL MATCH ENGINE =============================================
// Twenty-two players on a 105x68 pitch, advanced in quarter-second slices. No team rating appears
// anywhere below this line. A chance exists because somebody found space and a pass reached him; a
// goal exists because a finisher beat a keeper. Instructions bias what a player ATTEMPTS and never
// what succeeds, so every setting costs something somewhere -- turn the press up and the space
// behind it is really there for someone to run into. That is the whole reason for the rewrite.
export { ME_HZ, ME_DT, ME_TPM } from "./config";
import { ME_DEAD_SCALE, ME_DT, ME_SIM_MIN, ME_TPM } from "./config";

// ---- setup ------------------------------------------------------------------------------
// Positions live ON the player records, not in a side table, so cloneState already deep-copies them
// and stepping a live match backwards keeps working with no extra plumbing.
/** `slotsFor(formation)` returns 11 `[x, y]` slots in 0..100 space, y=100 on your own goal line.
 *  Injected rather than imported so the engine has no dependency on the app at all. */
export function meInit(s, slotsFor) {
  for (const side of ME_SIDES) {
    const ps = s.players[side], slots = slotsFor(s.formations?.[side] || "4-3-3");
    const own = meGoalX(meOther(side)), dir = meDir(side);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], sl = slots[Math.min(i, slots.length - 1)] || [50, 50];
      // FPOS2 is 0..100 with y=100 on your own goal line; convert to metres up the pitch.
      p._bd = (100 - sl[1]) / 100 * PITCH_L; p._bw = sl[0] / 100 * PITCH_W;
      p._bd0 = p._bd; p._bw0 = p._bw;
      p.x = own + dir * p._bd * 0.7; p.y = p._bw; p.vx = 0; p.vy = 0;
    }
    // mindSet: GF's one 0..1 role scalar (GK 0, CB 0, CM 0.5, CF 1 -- AIfunctions.cpp:1228-1249).
    // Derived from the formation instead of authored: your natural depth within the XI IS your role.
    let mn = Infinity, mx = -Infinity;
    for (const p of ps) if (p.pos !== "GK") { if (p._bd0 < mn) mn = p._bd0; if (p._bd0 > mx) mx = p._bd0; }
    for (const p of ps) {
      p._mind = p.pos === "GK" ? 0 : Math.max(0, Math.min(1, (p._bd0 - mn) / Math.max(1, mx - mn)));
      p._avgV = 0;
    }
  }
  s.mePos = { bx: PITCH_L / 2, by: ME_HALF_W, bz: 0.11, bvx: 0, bvy: 0, bvz: 0,
    pred: null, lastSide: "home", passPending: null,
    side: s.possession || "home", idx: -1, hold: 0,
    flight: false, ft: 0, fx: 0, fy: 0, fj: -1, fside: "home", dead: 0, rkind: "kickoff", rside: "home",
    counter: null, counterT: 0, tick: 0, possT: 0, drive: 0, shot: null, kickBy: null, sp: null, held: false,
    map: { home: null, away: null }, blk: { home: null, away: null },
    bal: { home: 0, away: 0 }, fading: { home: 1, away: 1 },
    offB: { home: 0.5, away: 0.5 }, trap: { home: 30, away: 30 }, goals: { home: 0, away: 0 },
    desig: { home: -1, away: -1 }, ttbBest: { home: 9999, away: 9999 },
    slots: { home: [], away: [] },
    phase: { home: "def", away: "def" }, phaseT: { home: 0, away: 0 } };
  for (const side of ME_SIDES)
    s.mePos.slots[side] = s.players[side].filter(p => p.pos !== "GK")
      .map(p => ({ bd: p._bd0, bw: p._bw0, wx: p.x, wy: p.y }));
  meKickoff(s, s.possession || "home");
}

export function meKickoff(s, side) {
  const mp = s.mePos, ps = s.players[side];
  let best = 0; for (let i = 1; i < ps.length; i++) if ((ps[i]._bd || 0) > (ps[best]._bd || 0)) best = i;
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
      const sp = meSpeed(a, p.stamina) * (p.pos === "GK" ? (p._closing ? CFG.gkScramble : 0.75) : 1)
               * (onBall ? CFG.carrySpeed : 1) * (p.knock > 0 ? CFG.injKnockSpd : 1)
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
      const stopAt = mp.sp ? 0.12 : p.pos === "GK" ? 0.25 : onBall ? 0
                   : i === scramble ? (deadBall ? 0 : CFG.scrambleStop)
                   : p._closing ? CFG.closeStop : 1.3;
      if (d < stopAt) { p.vx = 0; p.vy = 0; continue; }   // arrived; stop rather than jiggle on the spot
      // GetLazyVelocity (elizacontroller.cpp:437-474): how hard you run depends on who you are, what
      // the score of the possession contest is, and how far you are from the action -- a striker
      // visibly jogs while his side defends, a centre-half while it attacks, and the midfield always
      // works. The arrival gate underneath it stays: nobody orbits his own target at a sprint.
      const must = p._closing || i === scramble || (p._runT ?? 0) > 0 || onBall;
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
      const chase = i === scramble || onBall || (p._cut ?? 0) > 0 || p._duty === "press";
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
      p.vx = (p.vx || 0) + (wx - (p.vx || 0)) * acc;
      p.vy = (p.vy || 0) + (wy - (p.vy || 0)) * acc;
      // Chasing a ball that has crossed the line would otherwise walk a defender out behind his own
      // goal -- targets were clamped but the resulting position never was.
      p.x = Math.max(0.5, Math.min(PITCH_L - 0.5, p.x + p.vx));
      p.y = Math.max(0.5, Math.min(PITCH_W - 0.5, p.y + p.vy));
      // Running costs. Sprinting flat out for a whole half is what empties a gegenpress.
      p.stamina = Math.max(0, (p.stamina ?? 100) - step * CFG.drain * (1 + (s.strategy?.[side]?.pressingLOE || 0) * 0.18));
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

// Stamina per metre run. Lives on CFG so it can be swept -- as a module const it never was, and it
// had drifted a long way out: the comment here claimed a full match left a busy midfielder near 70
// and the measured figure was 87.6, with the most-run outfielder in the game finishing on 85. A
// match that costs twelve stamina cannot make anybody tired, so no manager ever had a reason to use
// his bench. Kept as an alias because it is exported and read elsewhere.
export const ME_DRAIN = CFG.drain;

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
  mp.side = side; mp.idx = i; mp.bx = x; mp.by = y; mp.hold = 0; mp.flight = false;
  if (s.players[side][i]) { s.players[side][i]._drbA = null; s.players[side][i]._drbT = 0; }
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
export const meKickedBy = (mp, side, i) => {
  mp.kickBy = [{ s: side, i, t: mp.tick }];
  const g = (mp.tlog = mp.tlog || []);
  // ...and where. mp.bx/mp.by at the moment of the kick IS where he played it, so an error can be
  // located without threading a position through every call site.
  g.push({ s: side, i, t: mp.tick, x: mp.bx, y: mp.by });
  if (g.length > CFG.tlogMax) g.shift();
};
export const meAlsoKicked = (mp, side, i) => { (mp.kickBy = mp.kickBy || []).push({ s: side, i, t: mp.tick }); };
export const meLockedOut = (mp, sd, i) =>
  !!mp.kickBy && mp.kickBy.some(k => k.s === sd && k.i === i && mp.tick - k.t < CFG.kickLock);

// Compatibility shims over the physical ball. A "flight" is now a real kick; a "loose" ball is a
// nudge. Both leave the ball to the integrator and the pickup logic in meTick.
export function meLoose(s, x, y) { const mp = s.mePos; mp.idx = -1; mp.flight = true; meKnock(mp, { u: () => 0.5 }, x, y, 6, 0); }
export function meFlight(s, side, j, x, y, ticks) {
  const mp = s.mePos;
  mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = j; mp.fx = x; mp.fy = y;
  meKnock(mp, { u: () => 0.5 }, x, y, Math.max(4, Math.hypot(x - mp.bx, y - mp.by) / Math.max(1, ticks) / ME_DT), 0);
}

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
// worse goal to concede -- the inversion is deliberate, and it is the abstract sim's.
const clamp01 = (x) => Math.max(0, Math.min(1, x || 0));
export const meSaveBonus = (xg) => CFG.rateSave * clamp01(xg);
export const meConcedePen = (xg) => CFG.rateConcede * (1 - clamp01(xg));
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
      const shrink = Math.min(1, frac / CFG.rateFullFrac);
      const dev = (p.rating - 6.5) + (CFG.ratePos[p.pos] ?? 0);
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
  if (inn.stamina === undefined) inn.stamina = 100;
  // Minutes played, for the shrink in meFinalise. Without it a substitute who came on for the last
  // five and touched nothing is rated as confidently as a man who played the whole match.
  gone._offAt = s.mePos.tick; inn._onAt = s.mePos.tick;
  ps[outIdx] = inn; bench[benchIdx] = null;
  s.subs = s.subs || { home: 0, away: 0 }; s.subs[side]++;
  (s.subbedOff = s.subbedOff || { home: [], away: [] })[side].push(gone);
  if (out) meEvt(out, "sub", side, inn.x, inn.y, inn.x, inn.y, `${inn.name} on for ${gone.name}`);
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
      const tired = (q.stamina ?? 100) - (q.knock > 0 ? CFG.subKnockBias : 0);
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

export function meShootout(s, rng, out, maxKicks) {
  const mp = s.mePos;
  const sc = { home: 0, away: 0 }, taken = { home: 0, away: 0 };
  const order = ["home", "away"];
  const left = (sd) => Math.max(0, 5 - taken[sd]);
  for (let k = 0; k < (maxKicks || 40); k++) {
    const side = order[k % 2], other = meOther(side);
    // Decided? Neither can catch the other with the kicks they have left.
    if (taken.home >= 5 && taken.away >= 5 && taken.home === taken.away && sc.home !== sc.away) break;
    if (sc[side] + left(side) < sc[other] && taken[other] >= taken[side]) break;
    if (sc[other] + left(other) < sc[side] && taken[side] > taken[other]) break;
    const g0 = out.goals[side], s0 = out.shots[side];
    // EVERYBODY RESETS BETWEEN KICKS. They were left standing wherever the final whistle caught
    // them, and meSPReady gives up after spMaxT -- so a keeper sixty metres up the pitch simply did
    // not get back before the kick was taken, and the first version of this converted 98%.
    for (const sd of ME_SIDES) for (const q of s.players[sd]) {
      q.vx = 0; q.vy = 0; q._cut = 0; q.knock = 0; q._runT = 0;
      if (q.pos === "GK") { q.x = meGoalX(meOther(sd)) + meDir(sd) * 0.3; q.y = ME_HALF_W; }
      else { q.x = PITCH_L / 2 + (meDir(sd) > 0 ? -6 : 6); q.y = 8 + (q._bw0 ?? ME_HALF_W) * 0.75; }
    }
    mp.bx = meGoalX(side) - meDir(side) * 11; mp.by = ME_HALF_W;
    // The same pre-kick a penalty in open play gets. At 40 the sequence was a third as long, and a
    // keeper who has just been placed from a standstill is still a 0.39 m disc when it is struck --
    // his capsule only opens with speed. Shootout conversion sat at 88.8% against 74.7% for the
    // identical kick in a match.
    meDead(s, "penalty", side, 470, out);
    // ONE ATTEMPT. A shootout kick is dead the moment the keeper touches it or it misses -- there is
    // no rebound and no second bite, which is a rule and not a physical fact. Letting it play on for
    // a dozen slices meant a parry rolled into an empty box (everyone else is on the halfway line)
    // and trickled in unopposed: 88.8% converted against 74.7% for the identical kick in a match.
    const sv0 = out.saves.home + out.saves.away, w0 = out.woodwork;
    let struck = -1;
    for (let t = 0; t < 220; t++) {
      const wasSp = !!mp.sp;
      meTick(s, rng, out);
      if (wasSp && !mp.sp) struck = t;
      if (struck < 0) continue;
      if (out.goals[side] > g0) break;                              // scored
      if (out.saves.home + out.saves.away > sv0) break;             // saved: dead
      if (out.woodwork > w0) break;                                 // off the frame: dead
      if (t - struck > 12) break;                                   // wide, or it simply ran out
    }
    taken[side]++;
    // A shootout is not part of the match: neither its goals nor its kicks belong in the scoreline.
    if (out.goals[side] > g0) sc[side]++;
    out.goals[side] = g0; out.shots[side] = s0;
    mp.sp = null; mp.idx = -1; mp.flight = false; mp.shot = null;
  }
  return { home: sc.home, away: sc.away, kicks: taken.home + taken.away,
           winner: sc.home === sc.away ? null : (sc.home > sc.away ? "home" : "away") };
}

export function meTick(s, rng, out) {
  const mp = s.mePos;
  if (mp.counterT > 0) mp.counterT--;
  mp.possT++;
  if (out.evt) out.evt.age++;
  mp._bpx = mp.bx; mp._bpy = mp.by; mp._bpz = mp.bz;
  mp.tick++;
  // A restart is played out, not waited out. Everyone walks to the job this particular stoppage
  // gives him, and it is taken when the men who matter are actually set -- so nobody freezes and
  // nobody is teleported onto the ball.
  if (mp.sp) {
    mp.stopT = (mp.stopT || 0) + 1;      // time the ball was not in play; added back at the end
    mp.sp.t++;
    // Changes are made at a stoppage, once, as the ball goes dead -- not mid-move.
    if (mp.sp.t === 1) for (const sd of ME_SIDES) meAutoSubs(s, sd, out);
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
          meEvt(out, "yellow", wS, wX, wY, wX, wY, `${q.name} booked for time-wasting`);
          if (q.yc >= 2) {
            q.rc = true; q.off = true; q.y = -6; q.vx = 0; q.vy = 0; q._offAt = mp.tick; q._offAt = mp.tick;
            (out.reds = out.reds || { home: 0, away: 0 })[wS]++;
            meEvt(out, "red", wS, wX, wY, wX, wY, `${q.name} is off, second yellow`);
          }
        }
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
  let stopTick = false;                  // a whistle blown inside tryPickup ends the tick
  const resolvePending = (okSide) => {
    const pp = mp.passPending; mp.passPending = null;
    if (!pp) return;
    if (okSide === pp.side) out.passOk++; else { out.passFail++; meEvt(out, "cut", pp.side, mp.bx, mp.by, mp.bx, mp.by, null); }
  };
  if (mp.by < 0 || mp.by > PITCH_W) { resolvePending(null); mp.shot = null; meDead(s, "throw", meOther(mp.lastSide), 76, out); return; }
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
        {
          // WHO STRUCK IT. Not simply mp.shot: a block, a save and a header all clear it, so most
          // goals arrive with no live shot attached -- 78 of 96 in a thirty-match sample, which is
          // why crediting off sh alone booked barely a fifth of them. The onTarget bookkeeping
          // immediately above has always known this and falls back to the last side to touch it;
          // this uses the same rule, one man deeper, and lands on the last man of the SCORING side
          // to have kicked it. A true own goal leaves nobody: the last touch was theirs.
          let gi = sh && sh.side === scorer && sh.i >= 0 ? sh.i : -1;
          let gt = sh ? sh.t0 : mp.tick;
          const lg = mp.tlog || [];
          if (gi < 0) for (let k = lg.length - 1; k >= 0; k--)
            if (lg[k].s === scorer) { gi = lg[k].i; gt = lg[k].t; break; }
          const gp = gi >= 0 ? s.players[scorer]?.[gi] : null;
          if (gp) gp.goals = (gp.goals || 0) + 1;
          // The assist is the last DIFFERENT team-mate to have kicked it, and only if the other side
          // never had it in between -- a goal that came from winning the ball off somebody is not
          // assisted by the man he took it from.
          let ast = null;
          if (gp) for (let k = lg.length - 1; k >= 0; k--) {
            const e = lg[k];
            if (e.t > gt) continue;                    // touches after the strike are deflections
            if (e.s !== scorer) break;                 // they had it: no assist
            if (e.i !== gi) { ast = s.players[e.s]?.[e.i] || null; break; }
          }
          if (ast && ast !== gp) ast.assists = (ast.assists || 0) + 1;
          if (gp) (out.scorers = out.scorers || { home: [], away: [] })[scorer].push(
            { name: gp.name, assist: ast ? ast.name : null, min: out.min ?? 0 });
          // ...and what it was worth to them. The context is read BEFORE this goal is counted, so a
          // winner is scored as the goal that won it rather than as the one that made it 2-1.
          const gm = out.min ?? 0, xg = sh ? sh.xg : CFG.rateGoalXgDef;
          const ctx = meCtxMult((out.goals[scorer] || 0) - 1, out.goals[cross.conceding] || 0, gm);
          // A tap-in is a goal; it is not the same afternoon as one from twenty yards.
          if (gp) meRate(gp, CFG.rateGoal * ctx * (1 - CFG.rateGoalXgW * clamp01(xg)));
          else meRate(s.players[cross.conceding]?.[(mp.tlog || []).slice(-1)[0]?.i], -CFG.rateOwnGoal);
          if (ast) meRate(ast, CFG.rateAssist * (1 + (ctx - 1) * 0.5));
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
            if (q.pos === "GK") meRate(q, -meConcedePen(xg));
            else if (q.pos === "DEF") meRate(q, -CFG.rateConcedeDef);
          }
        }
        meEvt(out, "goal", scorer, mp.bx, mp.by, meGoalX(scorer), cross.y, sh ? `GOAL - ${sh.name}` : "GOAL");
        meDead(s, "kickoff", cross.conceding, 190, out);
        return;
      }
      if (cross.kind === "woodwork") {
        // Off the frame and back into play: a live ball, not a stoppage.
        out.woodwork = (out.woodwork || 0) + 1;
        meEvt(out, "block", scorer, mp.bx, mp.by, mp.bx, mp.by, sh ? `${sh.name} hits the frame` : "off the woodwork");
        mp.bvx = -mp.bvx * 0.55; mp.bvy = mp.bvy * 0.55 + (rng.u() - 0.5) * 3; mp.bvz = Math.abs(mp.bvz) * 0.4 + 1;
        mp.bx += mp.bvx * 0.05;
        mp.lastSide = scorer;
        meBallPredict(mp);
        return;
      }
      if (sh) { out.offTarget = (out.offTarget || 0) + 1;
                meEvt(out, "miss", sh.side, mp.bx, mp.by, meGoalX(sh.side), cross.y, `${sh.name} drags it wide`); }
      if (cross.conceding === mp.lastSide) meDead(s, "corner", meOther(cross.conceding), 236, out);
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
        if (q.pos === "GK") return CFG.bodyR + CFG.ballR;
        // OVER HIM, or not. Every outfielder used to share a 1.6 m ceiling; now it is how high this
        // particular man gets, which is what makes an aerial ball a contest between two people
        // rather than something that passes through both of them.
        const air = meAerial(meAttrs(q), CFG);
        if (zAt > air) return -1;
        // A defender stretching to cut out someone else's ball is poking at it; the man it was
        // played to is taking a touch, and takes it a little more comfortably.
        let r = (isRcv ? CFG.reach : CFG.cutReach) * (1 - fast * CFG.fastDodge);
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
        else if (mp.idx >= 0 && mp.side !== sd) r += meAttrs(q).tackle / 99 * CFG.tackleReach;
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
          const spd = Math.hypot(q.vx || 0, q.vy || 0) / ME_DT;
          const ext = Math.max(0, Math.min(1, (spd - CFG.gkSpanV0) / (CFG.gkSpanV1 - CFG.gkSpanV0))) * CFG.gkSpan;
          const ux = spd > 1e-4 ? (q.vx || 0) / (spd * ME_DT) : 0;
          const uy = spd > 1e-4 ? (q.vy || 0) / (spd * ME_DT) : 0;
          for (let k = 0; k <= 2; k++) {                 // across the slice he is about to travel
            const cx = q.x + (q.vx || 0) * (k / 2), cy = q.y + (q.vy || 0) * (k / 2);
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
          meEvt(out, "foul", bs, mp.bx, mp.by, mp.bx, mp.by, `Handball, ${q.name}`);
          meDead(s, "penalty", meOther(bs), 470, out);
          return true;
        }
        // A HEADER IS NOT A TOUCH. Above headMinZ he has no foot on it and no control -- he gets his
        // head to it and it goes where his head sends it. That is why heading is a way of MOVING the
        // ball rather than a way of keeping it, and treating a won header as clean possession was
        // worth twelve extra shots a match: a man rose in a crowded box and landed with it at his
        // feet, every time, with nobody able to contest what came next.
        if (!isGK && zHit > CFG.headMinZ) {
          const gxA = meGoalX(bs), ownA = meGoalX(meOther(bs));
          const dGoalA = Math.hypot(gxA - q.x, ME_HALF_W - q.y);
          const power = CFG.headLo + meAttrs(q).strength / 99 * (1 - CFG.headLo);
          mp.lastSide = bs; meKickedBy(mp, bs, bi);
          mp.idx = -1; mp.flight = true; mp.fside = bs; mp.fj = -1; mp.passPending = null;
          if (dGoalA < CFG.headShotR && !mp.shot) {
            // Close enough to attack it: a header at goal, and it counts as a shot like any strike.
            out.shots[bs]++;
            const aimY = ME_HALF_W + (q.y < ME_HALF_W ? 1 : -1) * GOAL_HALF_W * CFG.headAim;
            mp.shot = { side: bs, name: q.name, i: bi, t0: mp.tick };
            const gkH = s.players[meOther(bs)].find(z => z.pos === "GK");
            if (gkH) {
              const okH = rng.u() < CFG.gkReadMin + (CFG.gkReadMax - CFG.gkReadMin) * meGkSkill(meAttrs(gkH));
              mp.shot.readY = okH ? aimY : ME_HALF_W - (aimY - ME_HALF_W);
            }
            meEvt(out, "shot", bs, q.x, q.y, gxA, aimY, `${q.name} heads it goalwards`);
            meKnock(mp, rng, gxA, aimY, CFG.headV * power, 0.35);
          } else {
            // Anywhere else it is a clearance or a knock-down: away from his own goal, and nothing
            // like the distance a struck ball travels.
            const ax = ownA - q.x, ay = ME_HALF_W - q.y, al = Math.hypot(ax, ay) || 1;
            const tx = q.x - ax / al * 18, ty = q.y - ay / al * 18 + (rng.u() - 0.5) * 14;
            out.clears++; meRate(q, CFG.rateClear);
            meEvt(out, "clear", bs, q.x, q.y, tx, ty, `${q.name} heads it clear`);
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
            meRate(q, meSaveBonus(shp.xg));
                     meEvt(out, "save", shp.side, mp.bx, mp.by, mp.bx, mp.by, `${q.name} parries it`); }
          // Whose goal it still is, if this parry ends up in the net. One touch off the keeper is a
          // deflected shot and the goal belongs to the man who hit it; only a ball that comes off him
          // and then off him AGAIN is an own goal.
          if (shp) mp.deflect = { side: shp.side, t: mp.tick,
            n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
          mp.shot = null; mp.lastSide = bs; meKickedBy(mp, bs, bi);
          // A REFLECTION off his hands. The surface is square to the line from him to the ball, so
          // angle in equals angle out -- that is the whole geometry of a parry and there is nothing
          // random in it. What varies is how much of a HAND he got on it, and that is how far he had
          // to dive: a firm palm mirrors the ball properly and shoves it clear, fingertips barely
          // change its line at all. v' = v - 2*firm*(v.n)n does both ends of that with one number.
          const kq = meGkSkill(qa);
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
          meRate(q, meSaveBonus(mp.shot.xg));
          meEvt(out, "save", mp.shot.side, mp.bx, mp.by, mp.bx, mp.by, `${q.name} saves`);
          mp.shot = null;
        }
        // OFFSIDE. Given when he plays it, not when it was struck: a ball rolled into an offside man
        // that a defender cuts out first is simply a ball a defender cut out.
        if (mp.passPending && mp.passPending.off && mp.flight
            && bs === mp.fside && bi === mp.fj) {
          const pp = mp.passPending; mp.passPending = null;
          (out.offside = out.offside || { home: 0, away: 0 })[bs]++;
          meEvt(out, "offside", bs, pp.ox, pp.oy, pp.ox, pp.oy, `${q.name} is offside`);
          mp.bx = pp.ox; mp.by = pp.oy;             // the free kick is where he was standing
          meDead(s, "freekick", meOther(bs), 104, out);
          stopTick = true;                          // and the tick ends here, as a foul's does
          return true;
        }
        // A ball quicker than your touch squirts off you. First contact still changes everything --
        // it kills most of the pace and it counts as a touch for last-man bookkeeping.
        if (v2d > CFG.controlV + qa.pass / 99 * CFG.controlVSkill) {
          // A deflection. If a shot was live, that was a block.
          if (mp.shot && bs !== mp.shot.side) { out.blocked = (out.blocked || 0) + 1;
            meRate(q, CFG.rateBlock);
            meEvt(out, "block", mp.shot.side, mp.bx, mp.by, mp.bx, mp.by, `${q.name} blocks it`);
            // Same rule as a parry: a shot that goes in off a DEFENDER is a deflected goal for the
            // man who hit it, not the defence putting it through their own net. Only a ball that
            // comes off the defending side twice is an own goal.
            mp.deflect = { side: mp.shot.side, t: mp.tick,
              n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
            mp.shot = null; }
          mp.lastSide = bs; meKickedBy(mp, bs, bi);
          meKnock(mp, rng, mp.bx + (rng.u() - 0.5) * 8, mp.by + (rng.u() - 0.5) * 8, v2d * 0.35, 0);
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
          out.blocked = (out.blocked || 0) + 1;
          meRate(q, CFG.rateBlock);
          meEvt(out, "block", mp.shot.side, mp.bx, mp.by, mp.bx, mp.by, `${q.name} blocks it`);
          mp.deflect = { side: mp.shot.side, t: mp.tick,
            n: (mp.deflect && mp.tick - mp.deflect.t < CFG.deflectWin ? mp.deflect.n : 0) + 1 };
          mp.shot = null;
        }
        resolvePending(bs);
        mp.flight = false;
        if (mp.idx === bi && mp.side === bs) return false;    // still his: not a new touch
        // The ball is NOT dragged to him. He has reached it; it stays where it is.
        const ivx = mp.bvx, ivy = mp.bvy, iv = Math.hypot(ivx, ivy);
        // Where his foot meets it, and how well.
        const stretch = Math.min(1, bd / Math.max(0.05, reach));
        const clean = Math.max(0, (1 - stretch * CFG.ftStretch)
                                * (1 - Math.min(1, iv / CFG.ftHot) * CFG.ftPace)
                                * (0.55 + qa.pass / 99 * 0.45));
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
  if (mp.tick % ME_MAP_STRIDE === 0) for (const side of ME_SIDES) meBuildMap(s, side);
  if (mp.tick % 8 === 0) for (const side of ME_SIDES) meSlots(s, side);
  if (mp.tick % 2 === 0) meTactical(s);
  // Every tick, not every other one. Possession changes between runs, and a stale duty means a man
  // doing an ATTACKING job while the ball is in his own box -- measured at 22% of defending slices.
  for (const side of ME_SIDES) meDuties(s, side);
  for (const side of ME_SIDES) meRuns(s, side);
  for (const side of ME_SIDES) meBlock(s, side);   // both sides: see rest defence in meShape
  for (const side of ME_SIDES) meShape(s, side);
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
  // ...and he can only PLAY it if he can actually reach it. Possession deliberately runs out to
  // touchKeep so a man does not lose the ball every time it gets a stride ahead of him -- but
  // between his own reach and that he is CHASING it, not carrying it, and he certainly cannot pass
  // it. Nothing enforced that: measured, 26% of every pass, shot and clearance in the match was
  // struck from beyond touching distance and the furthest was from 4.59 m.
  // It is also the whole of the trailing-ball problem. At hold 6+ the ball sits behind him on 8.5%
  // of slices while it is inside his control radius and on 74.6% while it is outside -- because
  // outside it nothing steers it at all, and he was free to keep "dribbling" anyway.
  // He is already pursuing it in meMove; this just stops him kicking what he cannot touch.
  if (Math.hypot(p.x - mp.bx, p.y - mp.by) > CFG.reach * CFG.playReach) { out.carries++; return; }
  const a = meAttrs(p), sp = meSpeed(a, p.stamina), opp = s.players[meOther(side)];
  // A challenge is one against one: only the CLOSEST opponent in range rolls the duel. Letting every
  // body within 3.2 m roll independently meant a second presser doubled the dispossession rate and
  // the whole match dissolved into loose-ball transitions -- measured at +14 shots a game for BOTH
  // sides. The extra men still matter: they are pressure, and pressure taxes every other option.
  // The keeper smothers first: at close range in his own box he is the challenge, not a spectator.
  {
    const gki = opp.findIndex(q => q.pos === "GK");
    if (gki >= 0) {
      const gk = opp[gki], gd = Math.hypot(gk.x - p.x, gk.y - p.y);
      if (gd < CFG.gkSmotherR && rng.u() < CFG.gkSmotherP * (1 - gd / CFG.gkSmotherR) * (0.6 + meAttrs(gk).reflex / 99 * 0.6)) {
        out.tackles++; gk.saves = (gk.saves || 0) + 1;
        meEvt(out, "save", side, p.x, p.y, p.x, p.y, `${gk.name} smothers it`);
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
    const q = opp[k]; if (q.pos === "GK") continue;
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
               * (inArea0 ? CFG.foulBoxScale : 1);
    if (rng.u() < rate) {
      const fSide = meOther(side);
      out.fouls[fSide]++;
      // HOW BAD IT WAS. The same two things that made it a foul make it a booking: the pace he came
      // in at, and how much he had to gain by stopping the move. A trip in midfield is a free kick;
      // the same challenge on a man running at goal is a card.
      const sev = Math.min(1, closeV / CFG.cardPaceFull) * CFG.cardPaceW
                + meDanger(side, p.x, p.y) * CFG.cardDangerW;
      let card = "";
      if (rng.u() < CFG.cardStraightRed * sev) card = "red";
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
        // OFF. He cannot be spliced out of the squad: mp.idx, _mk, mp.fj and mp.desig are all array
        // indices into it, so removing him would silently repoint every one of them at the wrong
        // man. He is flagged instead, parked off the touchline and skipped everywhere he could act.
        // He keeps his slot in the shape and nobody fills it, which is exactly what a man down is.
        q.rc = true; q.off = true;
        q.x = q.x; q.y = -6; q.vx = 0; q.vy = 0;
        (out.reds = out.reds || { home: 0, away: 0 })[fSide]++;
        meEvt(out, "red", fSide, p.x, p.y, p.x, p.y,
              card === "red2" ? `${q.name} is sent off, second yellow` : `${q.name} is sent off`);
      } else {
        meEvt(out, card === "yellow" ? "yellow" : "foul", fSide, p.x, p.y, p.x, p.y,
              card === "yellow" ? `${q.name} is booked` : `Foul by ${q.name}`);
      }
      // IN THE BOX IT IS A PENALTY. Same challenge, same card, different restart.
      // INJURY. A man who has just been gone through at pace is the one who gets hurt, so it hangs
      // off the same closing speed that made it a foul. Most of it is a knock he runs off; a small
      // share of it he cannot continue with. NOTE: with no substitutions in the engine yet, a man
      // who goes off leaves his side playing on with ten, so serious injuries are deliberately rare
      // until subs exist to answer them.
      if (rng.u() < CFG.injP * (1 + closeV * CFG.injPace)) {
        (out.injuries = out.injuries || { home: 0, away: 0 })[side]++;
        if (rng.u() < CFG.injSerious) {
          p.rc = false; p.off = true; p.inj = true; p.y = -6; p.vx = 0; p.vy = 0;
          meEvt(out, "injury", side, p.x, p.y, p.x, p.y, `${p.name} cannot continue`);
        } else {
          p.knock = CFG.injKnockT;                 // he runs it off
          meEvt(out, "injury", side, p.x, p.y, p.x, p.y, `${p.name} is hurt but carries on`);
        }
      }
      meDead(s, inArea0 ? "penalty" : "freekick", side, inArea0 ? 470 : 104, out);
      if (!inArea0) { mp.bx = p.x; mp.by = p.y; }
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
                              + (s.strategy?.[side]?.dribbling || 0) * CFG.dribHold);
  // Carrying is not a terminal state. It used to be -- if `carry` scored best he simply never let
  // go of it, so a man could dribble in the box indefinitely, which is exactly what it looked like.
  // Once his time is up the carry is off the menu and he plays the best ball there is.
  const forced = mp.hold >= natural;
  const act = meDecide(s, rng, side, mp.idx, mp.hold - natBase + 1);
  if (act.k === "carry") { out.carries++; return; }              // meDribble is already running him
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
    const gkp = s.players[meOther(side)].find(q => q.pos === "GK");
    const sk = a.shoot / 99;
    const away = gkp && gkp.y > ME_HALF_W ? -1 : 1;
    const aimY = ME_HALF_W + away * GOAL_HALF_W * (CFG.shotAimBase + sk * CFG.shotAimSkill);
    const aimZ = 0.25 + rng.u() * (0.5 + sk * GOAL_H * 0.45);
    // out.xg is both sides pooled, which is what the calibration harnesses want. Per side as well,
    // because a sweep that asks "did this instruction make the side BETTER" needs a difference, and
    // a goal is a Poisson count with a mean of 1.6 -- a whole match of it carries more noise than
    // the effect being measured. xG is the same question answered from ~8 continuous samples.
    if (out.shotDist) { const _g = meShotGeom(side, p.x, p.y); out.shotDist[Math.min(9, Math.floor(_g.d / 5))]++; out.xg = (out.xg || 0) + act.p; }
    if (out.xgS) out.xgS[side] += act.p;
    meEvt(out, "shot", side, p.x, p.y, gx, aimY, null);
    // Read the shooter BEFORE the ball leaves him: mp.idx is cleared on the line above, so taking
    // the index after it recorded -1 on every shot from open play. The goal attribution only looked
    // right because it falls back to the touch log, which meKickedBy had already filled in correctly
    // one line earlier -- a bug that a working answer was hiding.
    const shooter = mp.idx;
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null;
    mp.shot = { side, name: p.name, i: shooter, xg: act.p, t0: mp.tick };
    // THE PASS THAT MADE IT. An assist is only credited when the thing goes in; a man who puts a
    // team-mate through six times and watches him miss six times did that six times. Credited on
    // every shot, so an assist on a goal is this plus the goal bonus, which is how it is counted
    // everywhere else.
    { const lg = mp.tlog || [];
      for (let k = lg.length - 1; k >= 0; k--) {
        const e = lg[k];
        if (e.s !== side) break;
        if (e.i !== shooter) { meRate(s.players[side]?.[e.i], CFG.rateKeyPass); break; }
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
    meShootBall(mp, rng, gx, aimY, aimZ, a.shoot / 99 / (mp.firstTouch ? CFG.firstTouchNoise : 1), press);
    return;
  }
  if (act.k === "clear") { out.clears++; meRate(p, CFG.rateClear);
    meEvt(out, "clear", side, p.x, p.y, act.cx ?? p.x, act.cy ?? p.y, `${p.name} clears it`);
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null;
    meKickBall(mp, rng, act.cx ?? (p.x + meDir(side) * 36), act.cy ?? (p.y + (rng.u() - 0.5) * 30),
               "clear", a.pass / 99, press);
    return; }
  if (act.k === "touch") { out.clears++;
    // Into the stand. It concedes a throw and it keeps the goal, which is the trade being made.
    const sy = p.y < ME_HALF_W ? -4 : PITCH_W + 4;
    meEvt(out, "clear", side, p.x, p.y, p.x + meDir(side) * 6, sy, `${p.name} puts it out`);
    meKickedBy(mp, side, mp.idx);
    mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = -1; mp.lastSide = side; mp.passPending = null;
    meKickBall(mp, rng, p.x + meDir(side) * 6, sy, "clear", a.pass / 99, press);
    return; }
  const q = ps[act.j], dist = Math.hypot((act.ax ?? q.x) - p.x, (act.ay ?? q.y) - p.y);
  out.passes++;
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
  mp.passPending = { side, p: act.p, thru: !!act.thru, high: !!act.high, d: dist, forced,
                     off: wasOff, ox: q.x, oy: q.y };
  meKickBall(mp, rng, lx, ly, act.high ? "high" : "ground",
             a.pass / 99 / (mp.firstTouch ? CFG.firstTouchNoise : 1), press);
}

// Published for the viewer: the last thing that happened and where, plus a rolling commentary.
export function meEvt(out, k, side, x0, y0, x1, y1, txt) {
  if (!out) return;
  out.evt = { k, side, x0, y0, x1, y1, age: 0 };
  if (out.feed && txt) { out.feed.unshift({ min: out.min || 0, side, k, txt }); if (out.feed.length > 60) out.feed.pop(); }
}


