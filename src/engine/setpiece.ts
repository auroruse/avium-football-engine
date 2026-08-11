// Dead-ball play: the set-piece phase.
//
// A stoppage used to be a countdown during which meTick returned immediately -- no brains, no
// movement, twenty-two men frozen where they stood -- and then the taker was TELEPORTED onto the
// ball. The renderer interpolated that jump, so a restart looked like a player rocketing across the
// pitch into a scene that had not moved for several seconds.
//
// A restart is now a phase of the match with its own shape. The ball is placed the moment the
// stoppage is called, every player is given a job for that particular restart, they walk to it, and
// play resumes when the men who matter are actually set. Then it is DELIVERED -- a corner is a
// cross, a goal kick is a punt or a pass out, a free kick near goal can be struck at goal. None of
// that is the ordinary decision code, because none of it is ordinary play.
import { CFG, ME_DT } from "./config";
import { meAttrs, meGkSkill } from "./attributes";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meDir, meGoalX, meOther, meShotGeom } from "./geometry";
import { meKickBall, meShootBall } from "./ball";
import { GOAL_HALF_W } from "./ball";

// Which foot he kicks with, from where he plays. Left only if he is clearly a left-sided player.
export const meFoot = (p) => ((p._bw0 ?? ME_HALF_W) < ME_HALF_W - CFG.spLeftOf ? -1 : 1);

const clampX = (x) => Math.max(0.6, Math.min(PITCH_L - 0.6, x));
const clampY = (y) => Math.max(0.6, Math.min(PITCH_W - 0.6, y));

/** Where the ball is put, per restart. Called once, when play stops. */
function spotFor(s, kind, side) {
  const mp = s.mePos, dir = meDir(side), own = meGoalX(meOther(side)), gx = meGoalX(side);
  if (kind === "kickoff") return [PITCH_L / 2, ME_HALF_W];
  // A goal kick is taken from the six-yard box, on the side the ball went out.
  if (kind === "goalkick") return [own + dir * 5.5, mp.by < ME_HALF_W ? ME_HALF_W - 4 : ME_HALF_W + 4];
  if (kind === "corner") return [gx - dir * 0.4, mp.by < ME_HALF_W ? 0.6 : PITCH_W - 0.6];
  if (kind === "penalty") return [gx - dir * 11, ME_HALF_W];       // twelve yards, dead centre
  if (kind === "throw") return [clampX(mp.bx), mp.by < ME_HALF_W ? 0.3 : PITCH_W - 0.3];
  return [clampX(mp.bx), clampY(mp.by)];             // free kick: where the offence was
}

/** Begin a set piece: place the ball, pick a taker, and hand every man a job. */
export function meSPBegin(s, kind, side, out) {
  const mp = s.mePos;
  const [x, y] = spotFor(s, kind, side);
  mp.bx = x; mp.by = y; mp.bz = CFG.ballR;
  mp.bvx = 0; mp.bvy = 0; mp.bvz = 0;
  mp.idx = -1; mp.flight = false; mp.passPending = null; mp.shot = null; mp.kickBy = null;
  mp.dead = 0;
  if (kind === "corner" && out) out.corners[side]++;
  const us = s.players[side];
  // Who takes it. A keeper takes his own goal kick; otherwise the nearest man who is not the keeper,
  // except at a kickoff where it is whoever is furthest forward.
  let ti = -1;
  // A penalty is taken by whoever is best at it, and nothing else about where he happens to be
  // standing matters. Everything else goes to the nearest man.
  if (kind === "penalty") { let best = -1; for (let i = 0; i < us.length; i++) {
      const p = us[i]; if (p.pos === "GK" || p.off) continue;
      if (best < 0 || meAttrs(p).shoot > meAttrs(us[best]).shoot) best = i; } ti = best; }
  else if (kind === "goalkick") ti = us.findIndex(p => p.pos === "GK");
  else if (kind === "kickoff") { let best = -1; for (let i = 0; i < us.length; i++)
      if (us[i].pos !== "GK" && (best < 0 || (us[i]._bd0 || 0) > (us[best]._bd0 || 0))) best = i; ti = best; }
  else { let bd = Infinity; for (let i = 0; i < us.length; i++) { const p = us[i];
      if (p.pos === "GK") continue; const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; ti = i; } } }
  if (ti < 0) ti = 0;
  // IS ANYTHING ON? A free kick in open play is either a set piece or a chance to catch them before
  // they have got back, and until now it was always the first. That is not a dice roll: it is taken
  // quickly when a team-mate is ALREADY away up the pitch with daylight around him, which is the
  // whole reason a side plays it quickly. Never in shooting range -- nobody waves away a free header
  // at the edge of the box to tap it sideways.
  let quick = 0;
  if (kind === "freekick") {
    const dir2 = meDir(side), them2 = s.players[meOther(side)] || [];
    if (Math.abs(meGoalX(side) - x) >= CFG.spShootRange) {
      for (let i = 0; i < us.length; i++) {
        const p = us[i];
        if (i === ti || p.pos === "GK" || p.off) continue;
        if ((p.x - x) * dir2 < CFG.spQuickAhead) continue;
        let d = Infinity;
        for (const q of them2) { if (q.off) continue;
          const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < d) d = dd; }
        if (d > CFG.spQuickRoom) { quick = 1; break; }
      }
    }
  }
  mp.sp = { kind, side, x, y, ti, t: 0, quick };
}

/** Every player's target, for as long as the set piece lasts. */
export function meSPShape(s) {
  const mp = s.mePos, sp = mp.sp; if (!sp) return;
  const side = sp.side, opp = meOther(side);
  const us = s.players[side], them = s.players[opp];
  const dir = meDir(side), gx = meGoalX(side), own = meGoalX(opp);
  const st = s.strategy?.[side] || {};
  for (const sd of ME_SIDES) for (const p of s.players[sd]) { p._closing = false; p._spSet = false; }

  // ---- the taker. A corner or a free kick is STRUCK, so he backs off the ball and to one side and
  // then runs at it; everything else he simply stands over.
  const taker = us[sp.ti];
  if (taker) {
    // Standing over it: mid run-up, or playing it quickly, which has no run-up at all. Without the
    // quick case he was sent BACKWARDS for a run-up he was never going to take, so he could never
    // satisfy a readiness check measured against the ball and the restart hung -- ball in play fell
    // from 83% to 17% and every count in the match with it.
    if (sp.run || sp.quick) { taker._tx = sp.x; taker._ty = sp.y; }
    else if (sp.kind === "corner" || sp.kind === "freekick" || sp.kind === "penalty") {
      // Back along the line he means to hit it, and off to the side his kicking foot wants.
      const ax = gx - sp.x, ay = ME_HALF_W - sp.y, al = Math.hypot(ax, ay) || 1;
      const ux = ax / al, uy = ay / al, foot = meFoot(taker);
      taker._tx = clampX(sp.x - ux * CFG.spRunup - uy * foot * CFG.spRunupSide);
      taker._ty = clampY(sp.y - uy * CFG.spRunup + ux * foot * CFG.spRunupSide);
    } else {
      const ang = sp.kind === "throw" ? (sp.y < ME_HALF_W ? Math.PI / 2 : -Math.PI / 2) : Math.atan2(0, dir);
      taker._tx = clampX(sp.x - Math.cos(ang) * CFG.spBehind);
      taker._ty = clampY(sp.y - Math.sin(ang) * CFG.spBehind);
    }
    taker._spSet = true; taker._closing = true;
  }

  // ---- A PENALTY empties the box. Nobody but the taker and the keeper may be inside the area,
  // within 9.15 m of the spot, or ahead of the ball, so the other twenty wait on the arc behind it.
  if (sp.kind === "penalty") {
    const gkD = them.find(p => p.pos === "GK");
    if (gkD) { gkD._tx = clampX(gx - dir * 0.3); gkD._ty = ME_HALF_W; gkD._spSet = true; gkD._closing = true; }
    let k = 0;
    for (const sd of ME_SIDES) for (const p of s.players[sd]) {
      if (p._spSet || p.off) continue;
      const ang = -1.1 + (k++ % 10) * 0.24;
      p._tx = clampX(sp.x - dir * (CFG.spPenBack + Math.cos(ang) * 2));
      p._ty = clampY(ME_HALF_W + Math.sin(ang) * CFG.spPenSpread);
      p._spSet = true; p._closing = true;
    }
    return;
  }

  // ---- the attacking side
  const free = us.map((p, i) => i).filter(i => !us[i]._spSet && us[i].pos !== "GK");
  const place = (i, tx, ty) => { const p = us[i]; p._tx = clampX(tx); p._ty = clampY(ty); p._spSet = true; p._closing = true; };
  // Pick the man whose natural role best suits a spot: nearest by current position, so nobody
  // crosses the whole pitch when somebody else is already there.
  const take = (tx, ty) => {
    let bi = -1, bd = Infinity;
    for (const i of free) { if (us[i]._spSet) continue;
      const d = Math.hypot(us[i].x - tx, us[i].y - ty); if (d < bd) { bd = d; bi = i; } }
    if (bi >= 0) place(bi, tx, ty);
    return bi;
  };

  const targets = [];
  if (sp.kind === "corner") {
    // The box: near post, penalty spot, far post, the edge, and a short option at the flag.
    const nearSide = sp.y < ME_HALF_W ? -1 : 1;
    targets.push([gx - dir * 5.0, ME_HALF_W + nearSide * 5.0]);      // near post
    targets.push([gx - dir * 10.5, ME_HALF_W + nearSide * 1.0]);     // penalty spot
    targets.push([gx - dir * 6.0, ME_HALF_W - nearSide * 5.5]);      // far post
    targets.push([gx - dir * 19.0, ME_HALF_W]);                      // edge, for the cut-back
    targets.push([sp.x - dir * 7.0, sp.y - nearSide * 5.0]);         // short
  } else if (sp.kind === "goalkick") {
    const long = (st.gkDist || 0) > 0;
    if (long) {
      targets.push([own + dir * 62, ME_HALF_W - 8]);
      targets.push([own + dir * 62, ME_HALF_W + 8]);
      targets.push([own + dir * 48, ME_HALF_W]);
    } else {
      targets.push([own + dir * 14, 8]);                             // full-backs wide and short
      targets.push([own + dir * 14, PITCH_W - 8]);
      targets.push([own + dir * 24, ME_HALF_W - 7]);
      targets.push([own + dir * 24, ME_HALF_W + 7]);
    }
  } else if (sp.kind === "throw") {
    const inw = sp.y < ME_HALF_W ? 1 : -1;
    targets.push([sp.x + dir * 6, sp.y + inw * 3]);                  // short, down the line
    targets.push([sp.x - dir * 5, sp.y + inw * 5]);                  // back inside
    targets.push([sp.x + dir * 12, sp.y + inw * 9]);                 // longer, infield
  } else if (sp.kind === "kickoff") {
    targets.push([PITCH_L / 2 - dir * 3, ME_HALF_W + 2]);            // the partner
  } else {                                                            // free kick
    const shooting = Math.abs(gx - sp.x) < CFG.spShootRange;
    if (shooting) {
      targets.push([gx - dir * 8, ME_HALF_W - 6]);
      targets.push([gx - dir * 8, ME_HALF_W + 6]);
      targets.push([gx - dir * 13, ME_HALF_W]);
      targets.push([sp.x - dir * 2, sp.y + 3]);                      // over the ball with him
    } else {
      targets.push([sp.x + dir * 16, sp.y - 10]);
      targets.push([sp.x + dir * 16, sp.y + 10]);
      targets.push([sp.x + dir * 26, ME_HALF_W]);
    }
  }
  const marks = [];
  for (const t of targets) { const i = take(t[0], t[1]); if (i >= 0) marks.push([us[i], t]); }
  // Anybody left holds a sensible shape: behind the ball for a defensive restart, up for an
  // attacking one, and never all in the same place.
  let k = 0;
  for (const i of free) {
    if (us[i]._spSet) continue;
    const p = us[i];
    const base = sp.kind === "goalkick" || sp.kind === "kickoff"
      ? own + dir * (18 + (p._bd0 || 40) * 0.45
                     + (sp.kind === "goalkick" ? (st.gkDist || 0) * CFG.gkShapePush : 0))
      : sp.x - dir * (10 + k * 7);
    place(i, base, ME_HALF_W + ((k % 2 ? 1 : -1) * (7 + k * 3)));
    k++;
  }

  // ---- the defending side
  const dfree = them.map((p, i) => i).filter(i => them[i].pos !== "GK");
  const dplace = (i, tx, ty) => { const p = them[i]; p._tx = clampX(tx); p._ty = clampY(ty); p._spSet = true; p._closing = true; };
  const dtake = (tx, ty) => {
    let bi = -1, bd = Infinity;
    for (const i of dfree) { if (them[i]._spSet) continue;
      const d = Math.hypot(them[i].x - tx, them[i].y - ty); if (d < bd) { bd = d; bi = i; } }
    if (bi >= 0) dplace(bi, tx, ty);
    return bi;
  };
  const gk = them.find(p => p.pos === "GK");
  if (gk) {
    if (sp.kind === "corner") { gk._tx = clampX(gx - dir * 1.4); gk._ty = ME_HALF_W - (sp.y < ME_HALF_W ? -1 : 1) * 1.5; }
    else { gk._tx = clampX(gx - dir * 2.0); gk._ty = ME_HALF_W; }
    gk._spSet = true; gk._closing = true;
  }
  if (sp.kind === "corner") {
    const nearSide = sp.y < ME_HALF_W ? -1 : 1;
    dtake(gx - dir * 0.8, ME_HALF_W + nearSide * 3.4);               // near post
    dtake(gx - dir * 0.8, ME_HALF_W - nearSide * 3.4);               // far post
  } else if (Math.abs(gx - sp.x) < CFG.spShootRange && (sp.kind === "freekick")) {
    // A WALL, on the line between the ball and the goal, ten yards off it.
    const wx = sp.x + (gx - sp.x) * 0, wy = sp.y;
    const bx2 = gx - sp.x, by2 = ME_HALF_W - sp.y, bl = Math.hypot(bx2, by2) || 1;
    const px = -by2 / bl, py = bx2 / bl;
    for (let w = 0; w < CFG.spWall; w++) {
      const off = (w - (CFG.spWall - 1) / 2) * 0.6;
      dtake(wx + bx2 / bl * CFG.spWallDist + px * off, wy + by2 / bl * CFG.spWallDist + py * off);
    }
  }
  // Everyone else picks up whoever is standing in a dangerous place, goal-side of him.
  for (const [man] of marks) {
    if (Math.abs(gx - man._tx) > 30) continue;                       // only in and around the box
    dtake(man._tx + dir * 1.2, man._ty + 0.8);
  }
  let dk = 0;
  for (const i of dfree) {
    if (them[i]._spSet) continue;
    const p = them[i];
    const base = gx - dir * (14 + dk * 8);
    dplace(i, base, ME_HALF_W + ((dk % 2 ? 1 : -1) * (8 + dk * 3)));
    dk++;
  }
  // Both sides stay in their own half for a kickoff, and out of the circle.
  if (sp.kind === "kickoff") {
    for (const sd of ME_SIDES) {
      const d2 = meDir(sd), mine = sd === side;
      for (const p of s.players[sd]) {
        if (mine && p === taker) continue;
        if ((p._tx - PITCH_L / 2) * d2 > 0) p._tx = PITCH_L / 2 - d2 * 2;
        if (!mine && Math.hypot(p._tx - PITCH_L / 2, p._ty - ME_HALF_W) < 9.2) {
          const a2 = Math.atan2(p._ty - ME_HALF_W, p._tx - PITCH_L / 2) || Math.PI;
          p._tx = PITCH_L / 2 + Math.cos(a2) * 9.6; p._ty = ME_HALF_W + Math.sin(a2) * 9.6;
        }
      }
    }
  }
}

/** Are they set? The taker has to be over it; most of the rest have to be roughly where they belong.
 *  A hard cap stops a restart hanging on one man jogging in from the far corner. */
export function meSPReady(s) {
  const mp = s.mePos, sp = mp.sp; if (!sp) return false;
  if (sp.t < (sp.minT ?? CFG.spMinT)) return false;
  const taker = s.players[sp.side][sp.ti];
  if (!taker) return true;
  // Taken quickly: the only man who has to be anywhere is the one taking it. Everybody else is
  // wherever the whistle left them, which is exactly the point of playing it before they set.
  if (sp.quick) return Math.hypot(taker.x - sp.x, taker.y - sp.y) < CFG.spTakerTol * 2.5;
  const struck = sp.kind === "corner" || sp.kind === "freekick" || sp.kind === "penalty";
  // Second phase: he has started his run-up, and it is struck the moment he reaches the ball.
  if (sp.run) return Math.hypot(taker.x - sp.x, taker.y - sp.y) < CFG.spRunTol || sp.t > CFG.spMaxT + 14;
  // Out of patience. A struck restart still gets its run-up -- waiting on the last man to trot into
  // the box must not turn a corner into a shot from a standstill, which is what it did.
  // PER KIND. One global cap said a penalty and a throw-in deserve the same eight seconds, and
  // measured, 53% of penalties were taken because the referee gave up rather than because twenty men
  // had cleared the area -- while still finishing quicker than the real thing. A throw-in does not
  // need the patience a penalty does, and a penalty cannot be rushed at a throw-in's pace.
  const capT = sp.kind === "kickoff" ? CFG.spKickoffMaxT
             : (sp.maxT ?? CFG.spMaxTBy[sp.kind] ?? CFG.spMaxT);
  if (sp.t > capT) { if (struck) { sp.run = 1; return false; } return true; }
  // First phase: he has to be on his mark, and so does everyone whose job is near this restart.
  if (Math.hypot(taker.x - (taker._tx ?? sp.x), taker.y - (taker._ty ?? sp.y)) > CFG.spTakerTol) return false;
  let set = 0, n = 0;
  for (const sd of ME_SIDES) for (const p of s.players[sd]) {
    if (p === taker) continue;
    // A man whose job is nowhere near this restart does not hold it up -- except at a kickoff, where
    // the whole pitch has to be set and both sides in their own half before it can be taken.
    if (sp.kind !== "kickoff"
        && Math.hypot((p._tx ?? p.x) - sp.x, (p._ty ?? p.y) - sp.y) > CFG.spNearBall) continue;
    n++;
    if (Math.hypot(p.x - (p._tx ?? p.x), p.y - (p._ty ?? p.y)) < CFG.spTol) set++;
  }
  const frac = sp.kind === "kickoff" ? CFG.spKickoffFrac : CFG.spReadyFrac;
  if (!(n === 0 || set >= n * frac)) return false;
  // Everyone is set. If this one is struck he now runs at it; otherwise it is taken from a standstill.
  if (struck) { sp.run = 1; return false; }
  return true;
}

/** Take it. Each restart has its own delivery -- this is not the open-play decision code. */
export function meSPTake(s, rng, out, meBallTo, meEvt, meKickedBy) {
  const mp = s.mePos, sp = mp.sp;
  const side = sp.side, us = s.players[side];
  const dir = meDir(side), gx = meGoalX(side);
  const taker = us[sp.ti] || us[0];
  const a = meAttrs(taker);
  mp.sp = null;
  meBallTo(s, side, sp.ti, sp.x, sp.y);
  // Pick the man it is aimed at: whoever the shape put in the best place for this restart.
  let ti = -1, bestV = -Infinity;
  for (let i = 0; i < us.length; i++) {
    if (i === sp.ti || us[i].pos === "GK") continue;
    const q = us[i], d = Math.hypot(q.x - sp.x, q.y - sp.y);
    if (d > CFG.spMaxBall) continue;
    // For a delivery into the box, nearer the goal is better; for a short restart, nearer the ball.
    const v = (sp.kind === "corner" || sp.kind === "freekick")
      ? -Math.abs(gx - q.x) - Math.abs(q.y - ME_HALF_W) * 0.35
      : -d;
    if (v > bestV) { bestV = v; ti = i; }
  }
  const them2 = s.players[meOther(side)];
  // Whether the keeper picks the right way. On a shot from open play he READS it -- the ball is
  // already gone and he is going with what he saw. On a penalty he is committing before it is
  // struck against a man who knows that, which is why a penalty is converted three times in four:
  // his rating buys him a little over a coin flip and no more.
  const gkRead = (aimY, base, skillW) => {
    const g = them2.find(q => q.pos === "GK");
    if (!g) return;
    const ok = rng.u() < Math.min(0.97, base + meGkSkill(meAttrs(g)) * skillW);
    mp.shot.readY = ok ? aimY : ME_HALF_W - (aimY - ME_HALF_W);
  };
  const shooting = sp.kind === "freekick" && Math.abs(gx - sp.x) < CFG.spShootRange;
  meKickedBy(mp, side, sp.ti);
  mp.idx = -1; mp.flight = true; mp.fside = side; mp.fj = ti; mp.lastSide = side; mp.passPending = null;

  // The penalty has to sit BELOW the line above. Returning before it left mp.idx pointing at the
  // taker, so for one slice the ball counted as still being at his feet -- and the keeper's read
  // branch is inside `if (mp.idx < 0)`. He therefore never read it, dropped through to the ordinary
  // intercept path, and charged three metres off his line straight down the ball's flight. Measured:
  // he saved 100% of penalties by running out and catching them.
  if (sp.kind === "penalty") {
    const away = ME_HALF_W + (rng.u() < 0.5 ? -1 : 1) * GOAL_HALF_W * CFG.spPenAim;
    out.shots[side]++;
    mp.shot = { side, name: taker.name, i: sp.ti, t0: mp.tick }; mp.fj = -1;
    gkRead(away, CFG.spPenRead, CFG.spPenReadSkill);
    meEvt(out, "shot", side, sp.x, sp.y, gx, away, `${taker.name} steps up`);
    meShootBall(mp, rng, gx, away, 0.35 + rng.u() * 0.95, a.shoot / 99, 0, CFG.spPenElev);
    return;
  }

  if (shooting) {
    // Struck at goal. A free kick from twenty metres IS a shot, and it was never one before.
    const g = meShotGeom(side, sp.x, sp.y);
    const away = ME_HALF_W + (sp.y <= ME_HALF_W ? 1 : -1) * GOAL_HALF_W * (0.35 + a.shoot / 99 * 0.5);
    out.shots[side]++;
    mp.shot = { side, name: taker.name, i: sp.ti, t0: mp.tick };
    mp.fj = -1;
    // ...and this was missing entirely: with no readY the keeper's dive branch never fires, so he
    // stood and watched every free kick struck at his goal.
    gkRead(away, CFG.gkReadMin, CFG.gkReadMax - CFG.gkReadMin);
    meEvt(out, "shot", side, sp.x, sp.y, gx, away, `${taker.name} strikes the free kick`);
    meShootBall(mp, rng, gx, away, 1.0 + rng.u() * 1.1, a.shoot / 99, 0, CFG.spFkElev);
    return;
  }
  const q = ti >= 0 ? us[ti] : null;
  const tx = q ? q.x : sp.x + dir * 20, ty = q ? q.y : ME_HALF_W;
  const high = sp.kind === "corner"
    || (sp.kind === "goalkick" && (s.strategy?.[side]?.gkDist || 0) > 0)
    || (sp.kind === "freekick" && Math.hypot(tx - sp.x, ty - sp.y) > 24);
  const label = sp.kind === "corner" ? `${taker.name} swings it in`
    : sp.kind === "throw" ? `${taker.name} takes the throw`
    : sp.kind === "goalkick" ? `${taker.name} goes ${high ? "long" : "short"}`
    : sp.kind === "kickoff" ? "Kick off" : `${taker.name} plays it`;
  out.passes++;
  mp.passPending = { side };
  meEvt(out, "pass", side, sp.x, sp.y, tx, ty, label);
  meKickBall(mp, rng, tx, ty, high ? "high" : "ground", a.pass / 99, 0);
}
