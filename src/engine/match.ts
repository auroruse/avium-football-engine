// The tick loop, the ball, restarts, and match setup.
import { CFG } from "./config";
import { meAttrs, meDuel, meSpeed } from "./attributes";
import { meDuties, meRuns, meShape, meSlots, meTactical } from "./brain";
import { meDecide } from "./decide";
import { ME_HALF_W, ME_MAP_STRIDE, ME_SIDES, PITCH_L, PITCH_W, meBuildMap, meClosest, meDir, meGoalX, meLaneBlock, meOther, mePressure, meShotGeom } from "./geometry";

// ==================== POSITIONAL MATCH ENGINE =============================================
// Twenty-two players on a 105x68 pitch, advanced in quarter-second slices. No team rating appears
// anywhere below this line. A chance exists because somebody found space and a pass reached him; a
// goal exists because a finisher beat a keeper. Instructions bias what a player ATTEMPTS and never
// what succeeds, so every setting costs something somewhere -- turn the press up and the space
// behind it is really there for someone to run into. That is the whole reason for the rewrite.
export const ME_HZ = 4, ME_DT = 1 / ME_HZ, ME_TPM = 60 * ME_HZ;

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
  }
  s.mePos = { bx: PITCH_L / 2, by: ME_HALF_W, side: s.possession || "home", idx: -1, hold: 0,
    flight: false, ft: 0, fx: 0, fy: 0, fj: -1, fside: "home", dead: 0, rkind: "kickoff", rside: "home",
    counter: null, counterT: 0, tick: 0, possT: 0, drive: 0, map: { home: null, away: null },
    bal: { home: 0, away: 0 }, slots: { home: [], away: [] },
    phase: { home: "def", away: "def" }, phaseT: { home: 0, away: 0 } };
  for (const side of ME_SIDES)
    s.mePos.slots[side] = s.players[side].filter(p => p.pos !== "GK")
      .map(p => ({ bd: p._bd0, bw: p._bw0, wx: p.x, wy: p.y }));
  meKickoff(s, s.possession || "home");
}

export function meKickoff(s, side) {
  const mp = s.mePos, ps = s.players[side];
  let best = 0; for (let i = 1; i < ps.length; i++) if ((ps[i]._bd || 0) > (ps[best]._bd || 0)) best = i;
  mp.bx = PITCH_L / 2; mp.by = ME_HALF_W; mp.bvx = 0; mp.bvy = 0;
  mp.side = side; mp.idx = best; mp.hold = 0; mp.flight = false;
  if (ps[best]) { ps[best].x = PITCH_L / 2; ps[best].y = ME_HALF_W; }
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
    let scramble = (mp.idx < 0 || mp.flight) ? meClosest(ps, mp.bx, mp.by) : -1;
    // Whoever the ball was played to goes for it regardless of who happens to be nearest.
    if (mp.flight && mp.fside === side && mp.fj >= 0) scramble = mp.fj;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.pos === "GK" && !mp.flight) { /* keeper still tracks his target */ }
      let tx = p._tx, ty = p._ty;
      if (mp.idx === i && mp.side === side) continue;            // the man on the ball moves himself
      if (i === scramble) { tx = mp.bx; ty = mp.by; }
      const a = meAttrs(p), sp = meSpeed(a, p.stamina) * (p.pos === "GK" ? 0.75 : 1);
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      const stopAt = p._closing ? 1.6 : 1.3;
      if (d < stopAt) { p.vx = 0; p.vy = 0; continue; }   // arrived; stop rather than jiggle on the spot
      // Flat out only when there is real ground to make up. Everything else is a jog, which is what
      // keeps a side on its feet for ninety minutes.
      const step = Math.min(d, sp * ME_DT * (d > 9 ? 1 : d > 4 ? 0.55 : 0.30));
      let wx = dx / d * step, wy = dy / d * step;          // what he wants to be doing
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
      p.vx = (p.vx || 0) + (wx - (p.vx || 0)) * acc;
      p.vy = (p.vy || 0) + (wy - (p.vy || 0)) * acc;
      // Chasing a ball that has crossed the line would otherwise walk a defender out behind his own
      // goal -- targets were clamped but the resulting position never was.
      p.x = Math.max(0.5, Math.min(PITCH_L - 0.5, p.x + p.vx));
      p.y = Math.max(0.5, Math.min(PITCH_W - 0.5, p.y + p.vy));
      // Running costs. Sprinting flat out for a whole half is what empties a gegenpress.
      p.stamina = Math.max(0, (p.stamina ?? 100) - step * ME_DRAIN * (1 + (s.strategy?.[side]?.pressingLOE || 0) * 0.18));
    }
  }
}

export const ME_DRAIN = 0.0026;   // stamina per metre run; calibrated so a full 90 lands a busy midfielder near 70

// ---- the tick ---------------------------------------------------------------------------
export function meBallTo(s, side, i, x, y) {
  const mp = s.mePos;
  if (mp.side !== side) { mp.counter = side; mp.counterT = 26; mp.possT = 0; }   // just won it
  mp.drive = 0;
  for (const q of s.players[meOther(side)]) { q._run = null; q._runT = 0; }
  mp.side = side; mp.idx = i; mp.bx = x; mp.by = y; mp.hold = 0; mp.flight = false;
}

export function meLoose(s, x, y) { const mp = s.mePos; mp.idx = -1; mp.bx = x; mp.by = y; mp.flight = true; }

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
// (flight), or it is out of play and the clock is running down to a restart (dead). The dead-ball
// counters are why the ball is only actually in play for about an hour of the ninety.
export function meRestart(s, rng, out) {
  const mp = s.mePos, side = mp.rside, ps = s.players[side];
  let x = mp.bx, y = mp.by;
  if (mp.rkind === "goalkick") { const gk = ps.findIndex(p => p.pos === "GK");
    x = meGoalX(meOther(side)) + meDir(side) * 6; y = ME_HALF_W;
    if (gk >= 0) { ps[gk].x = x; ps[gk].y = y; meBallTo(s, side, gk, x, y); return; } }
  if (mp.rkind === "corner") { x = meGoalX(side) - meDir(side) * 0.5; y = mp.by < ME_HALF_W ? 0.5 : PITCH_W - 0.5; out.corners[side]++; }
  if (mp.rkind === "kickoff") { meKickoff(s, side); return; }
  y = Math.max(0.5, Math.min(PITCH_W - 0.5, y)); x = Math.max(0.5, Math.min(PITCH_L - 0.5, x));
  let bi = meClosest(ps, x, y); if (bi < 0) bi = 0;
  ps[bi].x = x; ps[bi].y = y; meBallTo(s, side, bi, x, y);
}

export function meDead(s, kind, side, ticks) { const mp = s.mePos; mp.dead = ticks; mp.rkind = kind; mp.rside = side; mp.flight = false; mp.idx = -1; }

export function meTick(s, rng, out) {
  const mp = s.mePos;
  if (mp.counterT > 0) mp.counterT--;
  mp.possT++;
  if (out.evt) out.evt.age++;
  mp._bpx = mp.bx; mp._bpy = mp.by;
  if (mp.dead > 0) { if (--mp.dead === 0) meRestart(s, rng, out); return; }
  mp.tick++;
  if (mp.tick % ME_MAP_STRIDE === 0) for (const side of ME_SIDES) meBuildMap(s, side);
  if (mp.tick % 8 === 0) for (const side of ME_SIDES) meSlots(s, side);
  if (mp.tick % 2 === 0) { meTactical(s); for (const side of ME_SIDES) meDuties(s, side); }
  for (const side of ME_SIDES) meRuns(s, side);
  for (const side of ME_SIDES) meShape(s, side);
  meMove(s, rng);
  out.inplay++;
  if (mp.flight) {                                   // ball travelling
    const k = 1 / Math.max(1, mp.ft);
    mp.bx += (mp.fx - mp.bx) * k; mp.by += (mp.fy - mp.by) * k;
    if (--mp.ft > 0) return;
    mp.flight = false;
    if (mp.by < 0 || mp.by > PITCH_W) { meDead(s, "throw", meOther(mp.fside), 76); return; }
    if (mp.bx < 0 || mp.bx > PITCH_L) { const conceding = mp.bx < 0 ? "home" : "away";
      if (conceding === mp.fside) meDead(s, "corner", meOther(conceding), 138);
      else meDead(s, "goalkick", conceding, 100);
      return; }
    if (mp.fj >= 0) {
      const rc = s.players[mp.fside][mp.fj];
      // He has to actually get there. A ball played into space nobody reaches is loose, not a gift.
      if (rc && Math.hypot(rc.x - mp.bx, rc.y - mp.by) < 3.4) meBallTo(s, mp.fside, mp.fj, rc.x, rc.y);
      else meScramble(s, rng);
    } else meScramble(s, rng);
    return;
  }
  if (mp.idx < 0) { meScramble(s, rng); return; }
  const side = mp.side, ps = s.players[side], p = ps[mp.idx];
  if (!p) { mp.idx = -1; return; }
  out.poss[side]++;
  const a = meAttrs(p), sp = meSpeed(a, p.stamina), opp = s.players[meOther(side)];
  // Anyone on top of him can take it off him. A failed challenge from behind is a foul.
  for (let qi = 0; qi < opp.length; qi++) {
    const q = opp[qi]; if (q.pos === "GK") continue;
    const gap = Math.hypot(q.x - p.x, q.y - p.y); if (gap > 3.2) continue;
    const qa = meAttrs(q);
    const win = meDuel(qa.tackle - (a.strength * 0.55 + a.pace * 0.45), CFG.tackleLo, CFG.tackleHi, CFG.tackleK);
    const r = rng.u();
    // Closer means a better chance of winning it cleanly.
    if (r < win * (1 - gap / 4.4)) { out.tackles++; q.defActs = (q.defActs || 0) + 1; meBallTo(s, meOther(side), qi, q.x, q.y); return; }
    // A mistimed challenge. Rare per tick because this loop runs on every opponent in range on
    // every one of the four ticks a second -- at 1.2% it produced a hundred and ten fouls a game.
    if (r > CFG.foulP) { out.fouls[meOther(side)]++; meEvt(out, "foul", meOther(side), p.x, p.y, p.x, p.y, `Foul on ${p.name}`); meDead(s, "freekick", side, 104); mp.bx = p.x; mp.by = p.y; return; }
  }
  const press = mePressure(s, side, p.x, p.y);
  // Running with it. The tackle checks above apply on every slice of the drive, so it is a real risk
  // taken over real ground instead of one roll followed by a jump.
  if (mp.drive > 0) {
    mp.drive--;
    const run = Math.min(meSpeed(a, p.stamina) * 0.82, CFG.carryAdv / (CFG.driveTicks * ME_DT)) * ME_DT;
    p.x = Math.max(0.5, Math.min(PITCH_L - 0.5, p.x + meDir(side) * run));
    p.y += (ME_HALF_W - p.y) * 0.02;
    p.stamina = Math.max(0, (p.stamina ?? 100) - run * ME_DRAIN * 1.4);
    mp.bx = p.x; mp.by = p.y;
    return;
  }
  // A touch and a look: short in space so he plays quickly, shorter still when he is hurried.
  if (++mp.hold < Math.max(1, Math.round(CFG.dwellFree + Math.min(CFG.dwellMax - CFG.dwellFree, press * 0.9)
                                          + (s.strategy?.[side]?.timeWasting || 0) * 2))) {
    const shift = press > 0.9 ? -0.22 : 0.14;         // he shifts the ball; he is not a statue
    p.x += meDir(side) * shift;
    p.stamina = Math.max(0, (p.stamina ?? 100) - Math.abs(shift) * ME_DRAIN);
    mp.bx = p.x; mp.by = p.y; return;
  }
  const act = meDecide(s, rng, side, mp.idx);
  mp.hold = 0;
  if (act.k === "shot") {
    out.shots[side]++;
    meEvt(out, "shot", side, p.x, p.y, meGoalX(side), ME_HALF_W, null);
    const _blk = Math.min(CFG.blockMax, meLaneBlock(s, side, p.x, p.y, meGoalX(side), ME_HALF_W) * CFG.blockK);
    if (rng.u() < _blk) { out.blocked = (out.blocked || 0) + 1; meEvt(out, "block", side, p.x, p.y, p.x, p.y, `${p.name} sees it blocked`);
      if (rng.u() < 0.35) meDead(s, "corner", side, 138); else meFlight(s, side, -1, p.x - meDir(side) * 6, p.y + (rng.u() - 0.5) * 10, 3);
      return; }
    if (out.shotDist) { const _g = meShotGeom(side, p.x, p.y); out.shotDist[Math.min(9, Math.floor(_g.d / 5))]++; out.xg = (out.xg || 0) + act.p; }
    if (rng.u() < act.p) { out.goals[side]++; out.onTarget[side]++;
      meEvt(out, "goal", side, p.x, p.y, meGoalX(side), ME_HALF_W, `GOAL - ${p.name}`);
      meDead(s, "kickoff", meOther(side), 190); return; }
    // Not a goal. Either the keeper got to it, or it was never going in.
    if (rng.u() < 0.42) { out.onTarget[side]++; out.saves[meOther(side)]++;
      meEvt(out, "save", side, p.x, p.y, meGoalX(side), ME_HALF_W, `${p.name} forces a save`);
      // One roll, not two: it is either behind for a corner or the keeper holds it.
      if (rng.u() < 0.58) meDead(s, "corner", side, 138); else meDead(s, "goalkick", meOther(side), 100); }
    else if (rng.u() < 0.30) meDead(s, "corner", side, 138);   // blocked or deflected behind
    else { meEvt(out, "miss", side, p.x, p.y, meGoalX(side), ME_HALF_W, `${p.name} drags it wide`); meDead(s, "goalkick", meOther(side), 100); }
    return;
  }
  if (act.k === "carry") { out.carries++;
    if (rng.u() > act.p) { out.tackles++; meEvt(out, "lost", side, p.x, p.y, p.x, p.y, `${p.name} is dispossessed`);
      meFlight(s, side, -1, p.x + meDir(side) * 2, p.y + (rng.u() - 0.5) * 6, 2); return; }
    // He sets off with it. The running happens over the following slices, in the drive branch.
    mp.drive = CFG.driveTicks;
    return; }
  if (act.k === "clear") { out.clears++;
    meFlight(s, side, -1, p.x + meDir(side) * 34, p.y + (rng.u() - 0.5) * 30, 9); return; }
  const q = ps[act.j], dist = Math.hypot((act.ax ?? q.x) - p.x, (act.ay ?? q.y) - p.y);
  out.passes++;
  const ticks = Math.max(1, Math.min(14, Math.round(dist / 17 / ME_DT)));
  // Pass to where he WILL be. Aiming at where he is standing means the ball can only ever be played
  // to a stationary man, which is precisely why nothing resembling a through ball ever happened.
  const baseX = act.ax ?? q.x, baseY = act.ay ?? q.y;
  const lx = Math.max(1, Math.min(PITCH_L - 1, baseX + (q.vx || 0) * ticks * 0.85));
  const ly = Math.max(1, Math.min(PITCH_W - 1, baseY + (q.vy || 0) * ticks * 0.85));
  if (rng.u() < act.p) { out.passOk++; meEvt(out, "pass", side, p.x, p.y, lx, ly, null); meFlight(s, side, act.j, lx, ly, ticks); }
  else { out.passFail++; meEvt(out, "cut", side, p.x, p.y, q.x, q.y, null);   // cut out along the line
    const t = 0.35 + rng.u() * 0.5;
    meFlight(s, side, -1, p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, Math.max(1, Math.round(ticks * t)));
  }
}

// Published for the viewer: the last thing that happened and where, plus a rolling commentary.
export function meEvt(out, k, side, x0, y0, x1, y1, txt) {
  if (!out) return;
  out.evt = { k, side, x0, y0, x1, y1, age: 0 };
  if (out.feed && txt) { out.feed.unshift({ min: out.min || 0, side, k, txt }); if (out.feed.length > 60) out.feed.pop(); }
}

export function meFlight(s, side, j, x, y, ticks) {
  const mp = s.mePos;
  mp.flight = true; mp.idx = -1; mp.fside = side; mp.fj = j; mp.fx = x; mp.fy = y; mp.ft = ticks;
}
