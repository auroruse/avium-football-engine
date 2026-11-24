// THE REFEREE, ON THE PITCH (user, 24 November 2026: "a referee in-match"; "make sure his AI is realistic, doesn't
// glitch with the players, avoids players and the ball").
//
// He is a man the engine moves, kept in mePos.ref and NOT in s.players: nothing can pass to him, mark him, tackle him
// or find him in a nearest-player search, and the ball does not know he is there. What he does here is the running. He
// works the diagonal a referee works: the assistant on the far touchline has the right-hand half of the pitch as the
// screen shows it and the one on the near touchline the left-hand half, so he keeps play between himself and whichever
// of them has it -- above the ball in the left half, below it in the right -- a few metres behind the move, and out of
// the penalty areas. The crew keeps that diagonal all match, as a real one does; the engine does not change ends (the
// second half is only drawn mirrored, App.tsx m.h2), so in its own coordinates the diagonal turns over at the break,
// on mp.h2, which the app sets with the mirror. (Was the other diagonal, fixed in the engine's coordinates: the far
// assistant ran the top left of the screen in the first half, under the scorebug. User, 24 November 2026.)
//
// He takes no dice (the match's rng is not touched) and writes to nothing but himself, so a match with him in it is
// the same match tick for tick.
import { CFG, ME_DT, ME_HOME_ADV, ME_MATCH_TICKS } from "./config";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meDir, meGoalX } from "./geometry";

// side / back: where he stands off the ball, in metres -- this far to his own side of it and this far behind the move.
// diag: the two ends of his diagonal. flip: how far the ball must cross it before he changes sides (so he does not
// hop from one side of a ball rolling along it to the other). jog / run / sprint are metres a second and acc metres a
// second squared; tired is the share of his top speed gone by the last minute. hold: he does not shift for a target
// that has moved less than this. manR / ballR / laneR: how wide a berth he gives a player, the ball, and the line the
// ball is travelling; manAhead is how far ahead, in seconds, he reads where a running man will be, and runR / runT the
// berth he gives the line a man is running and how many seconds of that line he reads. lead: how far ahead
// of a moving ball he reads the play, in seconds. okNear / okFar: with the ball between these distances, on his own side
// of it and not ahead of the move, he has his view and only walks to better it -- a referee who sprints after every pass
// is not a referee.
// Which diagonal, in the engine's coordinates: 1 is near-left to far-right (the half-time mirror), -1 far-left to near-right.
export const meRefDiag = (mp) => mp?.h2 ? 1 : -1;
export const ME_REF = {
  side: 9.5, back: 6, diag: [14, 56, 91, 12], flip: 5,
  yMin: 8, yMax: 60, xMin: 5, xMax: 100, boxOut: 1.8,
  walk: 1.6, jog: 3.2, run: 5.2, sprint: 7.1, acc: 5.4, dodge: 9.5, tired: 0.08,
  hold: 1.6, ease: 0.4, arrive: 0.7, okNear: 7, okFar: 15.5,
  manR: 4.2, manPush: 5.5, manAhead: 0.5, runR: 2.6, runT: 1.5, runPush: 11, ballR: 6, ballPush: 8, laneR: 3.6, lanePush: 7, laneT: 2,
  lead: 0.5, leadMax: 7, read: 0.5, roomR: 4.5, roomK: 0.6,
};

// THE CALL (step two of the rework, DESIGN.md "The referee, the touchlines and injuries").
// A foul used to be one roll that was both "did he foul him" and "was it given". They are two questions now. The
// challenge decides the first (mind/duel.ts); this decides the second, from where the referee was standing.
//
// HIS VIEW of a spot is 1 when he is well placed and falls with distance (full inside viewGood metres, down to
// viewFloor by viewFar), with every body standing in his line of sight (bodyCost each, within bodyR of the line, to
// bodyMax in all), and when he is at a run himself (runCost above runV). HOW PLAIN the offence was rises with the pace
// the man came in at (clearBase, clearPace a metre a second). The DOUBT is what is left when both are taken off:
// (1 - view) x (1 - plain), and in the penalty area it counts for boxDoubt times as much, because he wants to be
// surer there. A real foul is missed on missK of the doubt; a fair challenge is whistled on softK of how poorly he saw
// it. A strict referee misses less and whistles more.
//
// THE CROWD works on the doubt and on nothing else: homePull of it, times how much this referee listens, is added to
// the chance a host's foul is missed and a visitor's fair tackle whistled, and taken off the reverse. A foul under his
// nose is given the same for both sides. occK scales how often a foul happens at all, so that fouls GIVEN stay where
// they were calibrated once some are missed.
//
// HIS PATIENCE. In the first earlyMin minutes a booking is `early` as likely: he talks to them first. A man's third
// foul and each one after it is `repeat` likelier to be booked, to repeatMax.
export const ME_CALL = {
  viewGood: 17, viewFar: 44, viewFloor: 0.42, bodyR: 1.1, bodyCost: 0.13, bodyMax: 0.39, runV: 5.6, runCost: 0.08,
  clearBase: 0.3, clearPace: 0.085, boxDoubt: 1.6,
  missK: 0.5, softK: 0.18, softBox: 0.15, missWon: 0.5, occK: 1.01,
  homePull: 0.7,
  strict: [0.84, 1.18], cards: [0.78, 1.22], crowd: [0.55, 1.45],
  early: 0.8, earlyMin: 12, repeat: 0.25, repeatFrom: 3, repeatMax: 1.6,
  runIn: 6,
};

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (ab, t) => ab[0] + (ab[1] - ab[0]) * t;
// A number in [0,1) off the match's drawing seed, so he is not the same man every match and no dice are spent on it.
const hash01 = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };

const inBox = (x, y, pad) => Math.abs(y - ME_HALF_W) < CFG.boxHalfW + pad && (x < CFG.gkBoxR + pad || x > PITCH_L - CFG.gkBoxR - pad);
// Out of the penalty area by the nearer of its front and its side.
function outOfBox(x, y, pad) {
  if (!inBox(x, y, pad)) return [x, y];
  const left = x < PITCH_L / 2, front = left ? CFG.gkBoxR + pad : PITCH_L - CFG.gkBoxR - pad;
  const dFront = Math.abs(front - x), sideY = ME_HALF_W + (y < ME_HALF_W ? -1 : 1) * (CFG.boxHalfW + pad), dSide = Math.abs(sideY - y);
  return dFront <= dSide ? [front, y] : [x, sideY];
}

// WHERE HE WANTS TO BE, and how fast he would go there: [x, y, pace].
function refWant(s, r) {
  const mp = s.mePos, R = ME_REF, sp = mp.sp;
  // Which side of the ball is his, by his diagonal. e > 0: the ball is on the near (bench) side of it.
  const dg = meRefDiag(mp), y0 = dg === 1 ? R.diag[1] : R.diag[3], y1 = dg === 1 ? R.diag[3] : R.diag[1];
  const diagY = (x) => y0 + (clamp(x, R.diag[0], R.diag[2]) - R.diag[0]) * (y1 - y0) / (R.diag[2] - R.diag[0]);
  // HE HAS JUST BLOWN: he goes to the spot first, and stops a few metres short of the two men.
  if (r.call && r.call.t > 0 && sp) {
    r.call.t--;
    const dx = r.x - r.call.x, dy = r.y - r.call.y, d = Math.hypot(dx, dy) || 1;
    return [r.call.x + dx / d * 3.2, r.call.y + dy / d * 3.2, R.run];
  }
  if (sp) {
    const dir = meDir(sp.side), gx = meGoalX(sp.side), toGoal = Math.abs(gx - sp.x);
    // The half it is in says which assistant has it, and so which side of it he takes.
    const sg = (sp.x < PITCH_L / 2 ? 1 : -1) * dg;
    let x = sp.x, y = sp.y;
    if (sp.kind === "kickoff") { x = PITCH_L / 2 - dir * 7.5; y = ME_HALF_W + dg * 9.5; }
    // A goal kick: he waits where it will come down.
    else if (sp.kind === "goalkick") { x = sp.x + dir * 36; y = ME_HALF_W + (x < PITCH_L / 2 ? 1 : -1) * 10; }
    // A corner: on the edge of the area at the far side from the kick, looking across the goalmouth.
    else if (sp.kind === "corner") { x = gx - dir * (CFG.gkBoxR + 2.2); y = ME_HALF_W + (sp.y < ME_HALF_W ? 1 : -1) * 11; }
    // A penalty: level with the spot and well to the side of it, opposite his assistant on the goal line.
    else if (sp.kind === "penalty") { x = gx - dir * 9.5; y = ME_HALF_W + sg * 10.5; }
    // A throw: infield of it and a little up the line it will be thrown.
    else if (sp.kind === "throw") { x = sp.x + dir * 7; y = sp.y + (sp.y < ME_HALF_W ? 1 : -1) * 13; }
    // A free kick in range of goal: by the wall, to see the box. Anywhere else: on where it will drop.
    else if (toGoal < 36) { x = sp.x + dir * Math.min(9.5, Math.max(4, toGoal - 13)); y = sp.y + sg * 9; if (Math.abs(y - sp.y) < 6) y = sp.y - sg * 9; }
    else { x = sp.x + dir * 15; y = sp.y + sg * 10; }
    y = clamp(y, R.yMin, R.yMax); x = clamp(x, R.xMin, R.xMax);
    if (sp.kind !== "penalty") [x, y] = outOfBox(x, y, R.boxOut);
    const d = Math.hypot(x - r.x, y - r.y);
    return [x, y, d > 22 ? R.run : R.jog];
  }
  // OPEN PLAY. What he reads is where the play is going, not the ball's every yard: a pass on its way to a man is
  // read at that man, anything else a little ahead of the ball -- and the reading itself moves over rather than jumps,
  // or every pass would have him haring one way and back.
  let ax0 = mp.bx, ay0 = mp.by;
  const to = mp.flight && mp.fj >= 0 && !mp.shot ? s.players[mp.fside]?.[mp.fj] : null;
  if (to && !to.off) { ax0 = to.x * 0.7 + mp.bx * 0.3; ay0 = to.y * 0.7 + mp.by * 0.3; }
  else if (!mp.shot) { const bv = Math.hypot(mp.bvx || 0, mp.bvy || 0), ld = bv > 0.01 ? Math.min(R.leadMax, bv * R.lead) / bv : 0;
    ax0 = mp.bx + (mp.bvx || 0) * ld; ay0 = mp.by + (mp.bvy || 0) * ld; }
  r.fx += (clamp(ax0, 0, PITCH_L) - r.fx) * R.read; r.fy += (clamp(ay0, 0, PITCH_W) - r.fy) * R.read;
  const fx = r.fx, fy = r.fy;
  const side = mp.side === "home" || mp.side === "away" ? mp.side : (mp.lastSide || "home");
  const dir = meDir(side);
  const e = fy - diagY(fx);
  if (r.sg === 1 ? e > R.flip : e < -R.flip) r.sg = -r.sg;
  let x = fx - dir * R.back, y = fy + r.sg * R.side;
  // Hard against his own touchline there is no room on that side of it: he takes the other.
  if (y < R.yMin || y > R.yMax) { const y2 = fy - r.sg * R.side; y = clamp(y, R.yMin, R.yMax); if (Math.abs(y - fy) < 6.5) y = clamp(y2, R.yMin, R.yMax); }
  x = clamp(x, R.xMin, R.xMax);
  [x, y] = outOfBox(x, y, R.boxOut);
  const d = Math.hypot(x - r.x, y - r.y), dB = Math.hypot(fx - r.x, fy - r.y);
  // He has his view already: the ball at a fair distance, on the right side of him, and the move not behind his back.
  if (dB > R.okNear && dB < R.okFar && (r.y - fy) * r.sg > 2.5 && (r.x - fx) * dir < 4) return [x, y, R.walk];
  return [x, y, d > 17 ? R.sprint : d > 7 ? R.run : R.jog];
}

export function meRefInit(s) {
  const mp = s.mePos, x = PITCH_L / 2 - 7.5, y = ME_HALF_W + meRefDiag(mp) * 9.5;
  const seed = (mp.vseed | 0) || 1;
  mp.ref = { x, y, _px: x, _py: y, vx: 0, vy: 0, gx: x, gy: y, fx: mp.bx ?? PITCH_L / 2, fy: mp.by ?? ME_HALF_W, sg: meRefDiag(mp), _face: 0,
             // His legs: a referee is a few per cent quicker or slower than the next one.
             fit: 0.93 + 0.12 * hash01(seed, 7.31),
             // HIS TEMPERAMENT, for this match and no other (the user, 24 November 2026: referees are anonymous, "a
             // temperament rolled for each match"): how readily he blows, how readily he books, and how much the
             // crowd gets to him. Off the match's drawing seed, so no dice are spent on him.
             strict: lerp(ME_CALL.strict, hash01(seed, 1.17)), cards: lerp(ME_CALL.cards, hash01(seed, 2.53)),
             crowd: lerp(ME_CALL.crowd, hash01(seed, 3.91)) };
  return mp.ref;
}

// One slice of him. Called at the head of the tick, so he moves on what he saw a quarter of a second ago.
export function meRefStep(s) {
  const mp = s.mePos; if (!mp) return;
  const R = ME_REF, r = mp.ref || meRefInit(s);
  r._px = r.x; r._py = r.y;
  let [wx, wy, pace0] = refWant(s, r);
  // A PLACE WITH ROOM IN IT. Where he would stand is moved off anybody already standing there, so he is not jostled out
  // of a crowd he chose to stand in: twice over, each man within roomR of the spot moving it away from himself.
  for (let n = 0; n < 2; n++) { let mx = 0, my = 0;
    for (const sd of ME_SIDES) for (const q of s.players[sd] || []) { if (!q || q.off) continue;
      const ax = wx - q.x, ay = wy - q.y, a = Math.hypot(ax, ay);
      if (a < R.roomR) { const k = (R.roomR - a) * R.roomK / Math.max(0.3, a); mx += ax * k; my += ay * k; } }
    wx = clamp(wx + mx, R.xMin, R.xMax); wy = clamp(wy + my, R.yMin, R.yMax); }
  if (mp.sp?.kind !== "penalty") [wx, wy] = outOfBox(wx, wy, R.boxOut);
  // He does not shuffle for every touch: the place he is making for moves only when what he wants has moved a real
  // distance from it, and then eases over rather than jumping.
  if (Math.hypot(wx - r.gx, wy - r.gy) > R.hold) { r.gx += (wx - r.gx) * R.ease; r.gy += (wy - r.gy) * R.ease; }
  const top = R.sprint * r.fit * (1 - R.tired * Math.min(1, mp.tick / ME_MATCH_TICKS));
  const dx = r.gx - r.x, dy = r.gy - r.y, d = Math.hypot(dx, dy);
  const pace = Math.min(top, pace0 * r.fit, d / R.arrive);
  let ux = d > 0.05 ? dx / d * pace : 0, uy = d > 0.05 ? dy / d * pace : 0;
  // OUT OF EVERYBODY'S WAY. A berth round each man, a wider one round the ball, and off the line the ball is on.
  let px = 0, py = 0;
  for (const sd of ME_SIDES) for (const q of s.players[sd] || []) {
    if (!q || q.off) continue;
    // Where the man is, and where he will be in half a second: the nearer of the two is the one to give room to.
    // (His speed is read off the slice he has just run: the engine keeps where he started it, _px, for the drawing.)
    const qvx = (q.x - (q._px ?? q.x)) / ME_DT, qvy = (q.y - (q._py ?? q.y)) / ME_DT;
    let ax = r.x - q.x, ay = r.y - q.y, a = Math.hypot(ax, ay);
    const bx2 = r.x - (q.x + qvx * R.manAhead), by2 = r.y - (q.y + qvy * R.manAhead), b = Math.hypot(bx2, by2);
    if (b < a) { ax = bx2; ay = by2; a = b; }
    if (a < R.manR) { const w = (R.manR - a) / R.manR, k = R.manPush * w * (1 + 2 * w) / Math.max(0.2, a); px += ax * k; py += ay * k; }
    // A MAN RUNNING AT HIM is not got away from by backing off down the line he is running: he steps off it, to the
    // side he is already on, and sooner the sooner the man will be there.
    const qv = Math.hypot(qvx, qvy);
    if (qv > 2.5 && qv < 14) {
      const tx = qvx / qv, ty = qvy / qv, rx = r.x - q.x, ry = r.y - q.y, along = rx * tx + ry * ty;
      if (along > 0 && along < qv * R.runT) {
        const off = rx * -ty + ry * tx, ao = Math.abs(off);
        if (ao < R.runR) { const k = R.runPush * (R.runR - ao) / R.runR * Math.min(1, 1.8 * (1 - along / (qv * R.runT))) * (off < 0 ? -1 : 1); px += -ty * k; py += tx * k; }
      }
    }
  }
  if ((mp.bz ?? 0) < 2.6) {
    const ax = r.x - mp.bx, ay = r.y - mp.by, a = Math.hypot(ax, ay);
    if (a < R.ballR) { const k = R.ballPush * (R.ballR - a) / R.ballR / Math.max(0.2, a); px += ax * k; py += ay * k; }
    const bv = Math.hypot(mp.bvx || 0, mp.bvy || 0);
    if (bv > 3) {
      const tx = mp.bvx / bv, ty = mp.bvy / bv, along = ax * tx + ay * ty;
      if (along > 0 && along < bv * R.laneT + R.laneR) {
        const off = ax * -ty + ay * tx, ao = Math.abs(off);
        if (ao < R.laneR) { const k = R.lanePush * (R.laneR - ao) / R.laneR * (off < 0 ? -1 : 1); px += -ty * k; py += tx * k; }
      }
    }
  }
  ux += px; uy += py;
  const u = Math.hypot(ux, uy);
  if (u > top) { ux *= top / u; uy *= top / u; }
  // Standing where he wants to be with nobody near him, he stands.
  if (d < 0.5 && Math.hypot(px, py) < 0.25) { ux = 0; uy = 0; }
  // (Getting out of the way is a sidestep, and a man sidesteps quicker than he gets into a run.)
  const ax = ux - r.vx, ay = uy - r.vy, a = Math.hypot(ax, ay), aMax = (Math.hypot(px, py) > 1 ? R.dodge : R.acc) * ME_DT;
  if (a > aMax) { r.vx += ax / a * aMax; r.vy += ay / a * aMax; } else { r.vx = ux; r.vy = uy; }
  r.x = clamp(r.x + r.vx * ME_DT, 0.8, PITCH_L - 0.8);
  r.y = clamp(r.y + r.vy * ME_DT, 0.8, PITCH_W - 0.8);
  // The penalty areas are not his: pushed toward one, he goes round its edge. (A penalty is the one time he is in it.)
  if (mp.sp?.kind !== "penalty" && inBox(r.x, r.y, 0.4)) {
    const [ox, oy] = outOfBox(r.x, r.y, 0.4);
    if (ox !== r.x) r.vx = 0; else r.vy = 0;
    r.x = ox; r.y = oy;
  }
  // He watches the ball. Turned a part of the way each slice, the short way round.
  const want = Math.atan2(mp.by - r.y, mp.bx - r.x);
  let df = want - r._face; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
  r._face += df * 0.55;
}

// HOW WELL HE SAW IT: 0 to 1, of the spot (x, y), not counting the two men in the challenge themselves.
export function meRefView(s, x, y, a, b) {
  const mp = s.mePos, r = mp?.ref, C = ME_CALL;
  if (!r) return 1;
  const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy);
  let v = d <= C.viewGood ? 1 : Math.max(C.viewFloor, 1 - (1 - C.viewFloor) * (d - C.viewGood) / (C.viewFar - C.viewGood));
  if (d > 1.5) {
    let cost = 0;
    for (const sd of ME_SIDES) for (const q of s.players[sd] || []) {
      if (!q || q.off || q === a || q === b) continue;
      const t = ((q.x - r.x) * dx + (q.y - r.y) * dy) / (d * d);
      if (t < 0.08 || t > 0.97) continue;
      if (Math.hypot(q.x - (r.x + dx * t), q.y - (r.y + dy * t)) < C.bodyR) cost += C.bodyCost;
    }
    v -= Math.min(C.bodyMax, cost);
  }
  if (Math.hypot(r.vx, r.vy) > C.runV) v -= C.runCost;
  return clamp(v, 0.15, 1);
}

// THE DECISION. `side` is the side fouled, p the man fouled (or nobody: a handball), q the man who did it, closeV how
// fast he came in. `real`: there was a foul, and the question is whether it is given; otherwise the challenge was
// fair, and the question is whether he blows anyway. Returns what meFoulCommit needs: give, the lean on the
// discretionary cards (the crowd again, and only on what was not plain), and how ready he is with a card for this man.
export function meRefJudge(s, rng, out, side, p, q, closeV, inArea, real) {
  const mp = s.mePos, r = mp.ref || meRefInit(s), C = ME_CALL;
  const fSide = side === "home" ? "away" : "home";
  if (globalThis.__refOff) {                                 // the old referee, for an A/B on the same bundle
    const host0 = s.homeAdv === "home" || s.homeAdv === "away" ? s.homeAdv : null;
    return { give: real, lean: host0 ? Math.max(-1, ME_HOME_ADV.ref * ME_HOME_ADV.k * (fSide === host0 ? -1 : 1)) : 0, cardK: 1, view: 1 };
  }
  const view = meRefView(s, q.x, q.y, p, q);
  const plain = real ? clamp(C.clearBase + C.clearPace * (closeV || 0), 0, 1) : 0;
  const host = s.homeAdv === "home" || s.homeAdv === "away" ? s.homeAdv : null;
  // +1: the man who did it plays for the host, and the crowd is on his side. -1: he is the visitor.
  const h = host ? (fSide === host ? 1 : -1) : 0, pull = clamp(C.homePull * ME_HOME_ADV.k * r.crowd * h, -0.9, 0.9);
  let give;
  if (real) {
    const doubt = clamp((1 - view) * (1 - plain) * (inArea ? C.boxDoubt : 1), 0, 0.9);
    give = rng.u() >= clamp(doubt * C.missK / r.strict * (1 + pull), 0, 0.95);
  } else {
    give = rng.u() < clamp((1 - view) * C.softK * r.strict * (inArea ? C.softBox : 1) * (1 - pull), 0, 0.5);
  }
  if (globalThis.__ref) globalThis.__ref.push({ real: real ? 1 : 0, give: give ? 1 : 0, view: +view.toFixed(2), plain: +plain.toFixed(2), box: inArea ? 1 : 0, host: h,
                                                d: +Math.hypot(q.x - r.x, q.y - r.y).toFixed(1) });
  // Patience: early in the match he talks first; a man who keeps fouling runs out of it.
  const fl = (q._fl || 0) + 1, min = out?.min ?? 0;
  const cardK = r.cards * (min < C.earlyMin ? C.early : 1) * Math.min(C.repeatMax, 1 + C.repeat * Math.max(0, fl - C.repeatFrom + 1));
  const lean = host ? clamp(-h * ME_HOME_ADV.ref * ME_HOME_ADV.k * r.crowd * 2 * (1 - plain), -1, 1) : 0;
  // He goes to it: a few slices at the spot before he takes his place for the restart (refWant).
  if (give) r.call = { x: q.x, y: q.y, t: C.runIn };
  return { give, lean, cardK, view, soft: !real };
}
