// THE SAVE. A keeper facing a shot from open play does not guess -- he watches it.
//
// He used to. As the ball left the foot he picked a side, right with a probability his rating set, and
// if he picked right he was sent to the exact spot the shooter had aimed at -- the aim, not even the
// ball -- at a dive fast enough to get there from anywhere. So a good keeper, who picked right 92-97%
// of the time, stopped nearly everything he was sent to; a poor one, right 34% of the time, dived the
// wrong way twice in three. Goals against a good keeper came almost only from his rare wrong guess or
// from him being caught off his line, and a good finish was worth next to nothing against him.
//
// Now the shot is played out. At the strike he SETS where he stands. He sees the ball's line only after
// his reaction -- longer if bodies are in front of him -- and then goes across to where it will cross the
// line he is standing on, at the pace a dive carries a man, stretching out to full length as he goes.
// Whether he gets there is the duel: how hard and how near the post it was hit, how far out it was hit
// from, against how quickly he reacts, how fast he gets across, how far he reaches and where he stood.
// Penalties keep the guess, because a keeper really does go early at one.
import { CFG, ME_DT } from "./config";
import { meAttrs, meGkSkill, meSpeed } from "./attributes";
import { ME_HALF_W, meGoalX, meKeeperIx, meOther } from "./geometry";
import { GOAL_HALF_W } from "./ball";

/** Plan the keeper's save against the shot `sh`, struck by sh.side with the ball already launched
 *  (mp.bvx/bvy set). Stores sh.gk: who he is, where he set himself, where he dives to, when he goes
 *  and how fast, how far he reaches standing and at full stretch. Nothing if there is no keeper. */
export function mePlanSave(s, sh) {
  const g = planFor(s, meOther(sh.side), sh.t0);
  if (g) sh.gk = g;
}

/** A BALL GOING IN THAT NOBODY SHOT. A cross nobody touched, a cutback, a pass or a ricochet on its
 *  way into the net got no save at all: the dive only ever answered a shot, so against anything else
 *  the keeper had his feet, and it rolled in past him. Whatever is going in is saved like a shot. The
 *  forecast says whether it is going in; `dsd` is the side whose goal it is. Stored as mp.gkPlan. */
export function mePlanSaveBall(s, dsd) {
  const mp = s.mePos;
  const g = planFor(s, dsd, mp.tick - 1);
  if (g) mp.gkPlan = g;
}

/** Which side's goal the ball is forecast to go into, inside the frame, or null. mp._intoMs is when. */
export function meIntoGoal(mp) {
  const pr = mp.pred;
  if (!pr) return null;
  for (let k = 1; k < pr.length; k++) {
    const a = pr[k - 1], b = pr[k];
    for (const plane of [0, 105]) {
      if ((a[0] - plane) * (b[0] - plane) >= 0) continue;
      const f = (plane - a[0]) / (b[0] - a[0]);
      const y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
      mp._intoMs = (k - 1 + f) * ME_DT * 1000;
      if (Math.abs(y - ME_HALF_W) < GOAL_HALF_W + CFG.gkWideM && z < CFG.gkReachZ) return plane === 0 ? "home" : "away";
      return null;
    }
  }
  return null;
}

/** A SHOT THAT HAS CLIPPED SOMEBODY is a new ball: read again from here, with a fresh reaction. The
 *  dive planned at the strike had him going full length where the clean ball was headed while the
 *  deflection looped in behind him. */
export function meReplanSave(s) {
  const mp = s.mePos, sh = mp.shot;
  if (sh && sh.gk) sh.gk = planFor(s, meOther(sh.side), mp.tick) || null;
}

function planFor(s, dsd, t0) {
  const mp = s.mePos, ps = s.players[dsd];
  const ki = meKeeperIx(ps);
  if (ki < 0) return null;
  const k = ps[ki], gkk = meGkSkill(meAttrs(k)), gx = meGoalX(meOther(dsd));
  const sg = Math.sign(gx - mp.bx) || 1;
  let tx = k.x, ty = k.y;
  // WHERE IT WILL CROSS THE LINE HE IS STANDING ON. A struck ball flies straight in plan -- drag slows
  // it along its own line -- so this is exact. He dives ACROSS, holding his depth: the further out he
  // came, the less ground there is to cover, which is what coming out is for.
  const between = (k.x - mp.bx) * sg > 0.3 && (gx - k.x) * sg >= 0;
  // A BALL ALREADY PAST HIM IS NOT SAVED FROM WHERE HE STANDS. Planned anyway, it held him set, ten
  // metres out, for the whole of a looping header's second on its way into the empty net behind him.
  // No plan leaves him to turn and chase it back (brain.ts).
  if ((k.x - mp.bx) * sg < -0.5) return null;
  if (between && mp.bvx * sg > 0.5) {
    const tC = (k.x - mp.bx) / mp.bvx, yC = mp.by + mp.bvy * tC;
    // ...and he does not go for one that is going wide. The frame, as it looks from the ball, cut
    // at his depth: a ball crossing his line outside that (by more than he could need) is missing.
    const r = (k.x - mp.bx) / (gx - mp.bx);
    const lo = mp.by + (ME_HALF_W - GOAL_HALF_W - mp.by) * r, hi = mp.by + (ME_HALF_W + GOAL_HALF_W - mp.by) * r;
    if (yC > lo - CFG.gkWideM && yC < hi + CFG.gkWideM) ty = yC;
    // A BALL GOING OVER HIM IS MET ON THE WAY DOWN. Across his own line only, a keeper two metres out
    // watched a looping header or a chip pass a hand's breadth over his gloves and drop in behind him.
    // If it will be above his reach where it crosses his line, he goes back and across to where it has
    // come down within it.
    const pr = mp.pred;
    if (pr) for (let j = 1; j < pr.length; j++) {
      if ((pr[j][0] - k.x) * sg < 0 || (pr[j - 1][0] - k.x) * sg >= 0) continue;
      const f = (k.x - pr[j - 1][0]) / ((pr[j][0] - pr[j - 1][0]) || 1e-6);
      if (pr[j - 1][2] + (pr[j][2] - pr[j - 1][2]) * f < CFG.gkReachZ - 0.1) break;
      for (let j2 = j; j2 < pr.length; j2++)
        if (pr[j2][2] < CFG.gkReachZ - 0.3 || (gx - pr[j2][0]) * sg <= 0) {
          tx = pr[j2][0] - sg * Math.max(0, (pr[j2][0] - gx) * sg); ty = pr[j2][1]; break; }
      break;
    }
  }
  // BODIES IN FRONT OF HIM. A shot through a crowd is seen late: every man near the line from the ball
  // to his eyes costs him part of gkScreen, whoever's side he is on.
  let scr = 0;
  const lx = k.x - mp.bx, ly = k.y - mp.by, L2 = lx * lx + ly * ly || 1;
  for (const sd of ["home", "away"]) for (const q of s.players[sd]) {
    if (!q || q.off || q === k || q.pos === "GK") continue;
    const t = ((q.x - mp.bx) * lx + (q.y - mp.by) * ly) / L2;
    if (t <= 0.12 || t >= 0.92) continue;
    const perp = Math.hypot(q.x - (mp.bx + lx * t), q.y - (mp.by + ly * t));
    if (perp < CFG.gkScreenR) scr += 1 - perp / CFG.gkScreenR;
  }
  k.vx = 0; k.vy = 0;                                     // he sets himself
  // Going BACK for a ball dropping over him he runs, then leaps: the dive's pace over six metres was a
  // man jogging back while a lob from twenty-five metres came down in his net.
  const vDive = CFG.gkDiveVmin + (CFG.gkDiveVmax - CFG.gkDiveVmin) * gkk;
  const back = (tx - k.x) * sg > CFG.gkBackRun;
  return {
    side: dsd, i: ki, x0: k.x, y0: k.y, tx, ty, t0, L: Math.hypot(tx - k.x, ty - k.y),
    react: CFG.gkReactSlow + (CFG.gkReactFast - CFG.gkReactSlow) * gkk + Math.min(1, scr) * CFG.gkScreen,
    v: back ? Math.max(vDive, meSpeed(meAttrs(k), k.stamina) * CFG.gkBackV) : vDive,
    set: CFG.gkSetReach * (CFG.gkSetLo + (1 - CFG.gkSetLo) * gkk),
    grab: CFG.gkSaveReachLo + (CFG.gkSaveReachHi - CFG.gkSaveReachLo) * gkk,
  };
}

/** Where the planned keeper is t seconds after the strike: [x, y, ux, uy, ext] -- his centre, the way
 *  he is diving, and how far he is stretched along it either side of his centre (arms one way, legs the
 *  other). Still until his reaction, then across at his dive pace, reaching full stretch over gkSpanT. */
export function meGkAt(g, t) {
  const dx = g.tx - g.x0, dy = g.ty - g.y0, L = Math.hypot(dx, dy);
  const ux = L > 1e-6 ? dx / L : 0, uy = L > 1e-6 ? dy / L : 0;
  const tm = Math.max(0, t - g.react), sm = Math.min(L, g.v * tm);
  // ...and once he has got there and had gkResetT to steady himself he is SET again, standing. A
  // keeper who shuffled two metres across for a lob was still laid out flat a second later when it
  // dropped onto him, and the ball went in over a man standing exactly where it came down.
  const ext = tm > 0 && L > CFG.gkSetStep && tm < L / g.v + CFG.gkResetT
    ? CFG.gkSpan * Math.min(1, tm / CFG.gkSpanT) : 0;
  return [g.x0 + ux * sm, g.y0 + uy * sm, ux, uy, ext];
}
