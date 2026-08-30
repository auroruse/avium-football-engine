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
import { meAttrs, meGkSkill , meAttrs } from "./attributes";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meDir, meGoalX, meKeeper, meKeeperIx, meOther, meShotGeom } from "./geometry";
import { meFkArc, meKickBall, meShootBall } from "./ball";
import { GOAL_HALF_W } from "./ball";

// Which foot he kicks with, from where he plays. Left only if he is clearly a left-sided player.
export const meFoot = (p) => ((p._bw0 ?? ME_HALF_W) < ME_HALF_W - CFG.spLeftOf ? -1 : 1);

const clampX = (x) => Math.max(0.6, Math.min(PITCH_L - 0.6, x));
const clampY = (y) => Math.max(0.6, Math.min(PITCH_W - 0.6, y));

// A ROLL FOR THIS PARTICULAR RESTART. Every corner used to produce the same five marks, every wall
// the same four men, every throw the same three options -- watch two corners and you have seen them
// all. Varying them needs randomness, and meSPShape runs every slice, so it cannot be re-rolled
// there: the whole box would twitch. It is rolled once when the ball goes dead and read back.
// There is no rng in meDead's eight call sites and threading one through them to choose between
// three corner routines is not worth the churn -- the tick and the spot are already downstream of
// the seeded stream, so hashing them varies the shape between restarts and repeats identically on
// a replay of the same seed.
// ...and the MATCH is in the hash too. Without vseed this is a pure function of the tick and the
// spot, so any restart taken on the same tick from the same place drew the same routine, the same
// jitter and the same wall in every match ever played, however the match rng was seeded. vseed is 0
// when meInit was given no rng, which keeps every deterministic harness bit-identical.
const spSeed = (vseed, tick, x, y) => {
  let h = (Math.imul(tick, 2654435761) ^ Math.imul(Math.round(x * 8), 40503)
                                      ^ Math.imul(Math.round(y * 8), 22273)
                                      ^ Math.imul(vseed | 0, 2246822519)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return h >>> 0;
};
/** Stream k of this restart's roll, in [0, 1). Same restart and same k always give the same number. */
export const spRnd = (sp, k) => {
  let h = (sp.seed ^ Math.imul(k + 1, 2654435761)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 8) / 16777216;
};
const spJ = (sp, k) => (spRnd(sp, k) * 2 - 1) * CFG.spJit;

/** The ball is FETCHED to the spot, not teleported onto it. Called once a slice while it is dead. */
export function meSPFetch(mp) {
  const sp = mp.sp; if (!sp || !sp.ft) return;
  const u = Math.min(1, sp.t / sp.ft), e = u * u * (3 - 2 * u);
  mp.bx = sp.fx + (sp.x - sp.fx) * e;
  mp.by = sp.fy + (sp.y - sp.fy) * e;
  // Carried rather than dragged through the grass: a little off the ground while it is in transit.
  mp.bz = CFG.ballR + Math.sin(Math.PI * u) * CFG.spFetchZ;
}

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
  // Read spotFor FIRST -- a throw and a goal kick both decide which side of the pitch they are
  // taken from by looking at mp.by -- then remember where the ball really stopped, so it can be
  // fetched from there instead of blinking onto the spot.
  const fx = mp.bx, fy = mp.by;
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
  // ...unless somebody has been NOMINATED. A shootout is a rota, not eleven deferrals to the same
  // best shooter, so meShootout hands the next man in and this consumes the nomination. In-match
  // penalties still go to the best striker of a ball, which is what a designated taker is.
  if (kind === "penalty" && s.mePos._penTaker != null
      && us[s.mePos._penTaker] && !us[s.mePos._penTaker].off) {
    ti = s.mePos._penTaker; s.mePos._penTaker = null;
  }
  else if (kind === "penalty") { let best = -1; for (let i = 0; i < us.length; i++) {
      const p = us[i]; if (p.pos === "GK" || p.off) continue;
      if (best < 0 || meAttrs(p).shoot > meAttrs(us[best]).shoot) best = i; } ti = best; }
  else if (kind === "goalkick") ti = meKeeperIx(us);
  // A CORNER HAS A TAKER. Every dead ball except the penalty went to whoever happened to be
  // standing nearest, so the man who swung a corner in was an accident of position and no side
  // had a dead-ball specialist at all. That is most of why the league's best creator finished a
  // season on eleven assists against a real fifteen to eighteen: real set-piece assists pile up
  // on one or two men a side, and here they were shared out among all eleven. A corner and a
  // free kick within striking range now go to the man who actually strikes them -- fit dominates
  // and distance only separates men of similar quality. Everything else (throws, goal kicks, and
  // the deep free kicks that are usually played quickly) still goes to the nearest man, because
  // that is what happens on a pitch. The restart cannot hang while he walks: spMaxTBy caps a
  // corner at 86 ticks and forces it away.
  else if (kind === "corner"
           // ...MEASURED TO THE GOAL HE IS SHOOTING AT. meGoalX(meOther(side)) is his side's OWN
           // goal, so this asked "is the free kick near the net we are defending" -- and handed
           // every kick in a side's own third to the man with the best strike of a ball, who is a
           // forward. That is the attacker jogging sixty metres back to take a routine free kick,
           // and it also meant the kicks actually worth a specialist, the ones in shooting range,
           // went to whoever happened to be nearest.
           || (kind === "freekick" && Math.abs(meGoalX(side) - x) < CFG.spTakerRange)) {
    const want = kind === "corner" ? "pass" : "shoot";
    let best = -1, bsc = Infinity;
    for (let i = 0; i < us.length; i++) { const p = us[i];
      if (p.pos === "GK" || p.off) continue;
      const fit = Math.max(0, Math.min(1, (meAttrs(p)[want] - 60) / 39));
      const sc = Math.hypot(p.x - x, p.y - y) - fit * CFG.spTakerW;
      if (sc < bsc) { bsc = sc; best = i; } }
    if (best >= 0) ti = best;
  }
  else if (kind === "kickoff") { let best = -1; for (let i = 0; i < us.length; i++)
      if (us[i].pos !== "GK" && !us[i].off
          && (best < 0 || (us[i]._bd0 || 0) > (us[best]._bd0 || 0))) best = i; ti = best; }
  // A SENT-OFF MAN IS NOT AVAILABLE TO RESTART. He is parked at y = -6, six metres beyond the
  // touchline, and this branch picks whoever is NEAREST the ball -- so at a throw-in on his side he
  // was routinely the closest man to a spot sitting on the line, nearer than anyone still playing.
  // Nominated, he could never reach it: the restart hung, the players stood, and the clock ran on.
  // The penalty branch above has always had this guard; the branch that takes every throw, corner
  // and free kick did not. Measured before the fix: a throw still live after 2809 slices.
  else { let bd = Infinity; for (let i = 0; i < us.length; i++) { const p = us[i];
      if (p.pos === "GK" || p.off) continue; const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; ti = i; } } }
  // ...and the fallback cannot be slot 0 either: that is the keeper, and he may be the man off.
  if (ti < 0) ti = Math.max(0, us.findIndex(p => p && !p.off));
  // IS ANYTHING ON? A restart is either a set piece or a chance to get on with it, and this decides
  // which. Not a dice roll: it is played quickly when there is somebody to play it TO -- a team-mate
  // within range with daylight around him -- because that is the only reason anybody ever does.
  //
  // Extended past the free kick it started as. Measured, a goal kick's mean duration EQUALLED its
  // longest, 37.5 displayed seconds every single time, and a corner's 45.5 -- so readiness never
  // decided anything and the floor decided everything. Every goal kick in the match was the keeper
  // waving his defence up the pitch and nobody ever simply rolled it to a full-back.
  //
  // A corner, a penalty and a kickoff are excluded by definition: those ARE set pieces, and nobody
  // takes a penalty quickly. A free kick in shooting range is excluded for the same reason -- nobody
  // waves away a free strike at goal to tap it sideways.
  let quick = 0;
  if (kind === "freekick" || kind === "goalkick" || kind === "throw") {
    const dir2 = meDir(side), them2 = s.players[meOther(side)] || [];
    if (!(kind === "freekick" && Math.abs(meGoalX(side) - x) < CFG.spShootRange)) {
      for (let i = 0; i < us.length; i++) {
        const p = us[i];
        if (i === ti || p.pos === "GK" || p.off) continue;
        if (Math.hypot(p.x - x, p.y - y) > CFG.spQuickTo) continue;   // has to be a ball he can play
        // A free kick is played quickly to catch them before they have got back, so the man has to
        // be AHEAD of the ball for it to be worth anything. A goal kick or a throw is played quickly
        // simply because somebody is free, which is most of the time and should be.
        if (kind === "freekick" && (p.x - x) * dir2 < CFG.spQuickAhead) continue;
        let d = Infinity;
        for (const q of them2) { if (q.off) continue;
          const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < d) d = dd; }
        // PER KIND, because the daylight a man needs is not the same thing at each. A throw-in
        // needs almost none -- you throw it to a man with a yard. A goal kick needs him genuinely
        // free, because a side that presses goal kicks is pressing exactly this: held at the free
        // kick's nine metres, 80% of goal kicks went short and the mean fell to 14.7 displayed
        // seconds against a real 25-35.
        if (d > (CFG.spQuickRoomBy[kind] ?? CFG.spQuickRoom)) { quick = 1; break; }
      }
    }
  }
  mp.sp = { kind, side, x, y, ti, t: 0, quick, fx, fy, ft: 0, seed: spSeed(mp.vseed | 0, mp.tick, x, y) };
  // Which routine this one is. Three of each, so a corner is not the same corner every time.
  mp.sp.v = Math.floor(spRnd(mp.sp, 0) * 3);
  // ...and it is still FETCHED. Quick used to mean the ball blinked onto the spot, which was fine
  // while only free kicks could be quick -- spotFor puts a free kick where the ball already is, so
  // there was nothing to move. A goal kick's spot is the six-yard box and the ball is behind the
  // goal line, so the same shortcut would put the snap straight back. The size below is PROVISIONAL:
  // minT is not known until meDead, which caps it with ft = min(ft, minT) so the ball can never
  // still be in transit when the restart becomes takeable. Do not read this line as the final
  // duration -- it was written as though the cap lived here, and it does not.
  mp.sp.ft = Math.min(CFG.spFetchMax,
    CFG.spFetchMin + Math.round(Math.hypot(x - fx, y - fy) * CFG.spFetchPerM));
  meSPFetch(mp);
}

/** Every player's target, for as long as the set piece lasts. */
export function meSPShape(s) {
  const mp = s.mePos, sp = mp.sp; if (!sp) return;
  const side = sp.side, opp = meOther(side);
  const us = s.players[side], them = s.players[opp];
  const dir = meDir(side), gx = meGoalX(side), own = meGoalX(opp);
  const st = s.strategy?.[side] || {};
  // THE DUKED KINDS: no placed shape at all. The live brains have already positioned both sides
  // against the dead ball (see meTick); this function contributes only the taker, the defending
  // keeper, the wall, and the exclusion laws. Rows of men on pregenerated coordinates -- the
  // corner tableau, the goal-kick line-up along the byline -- were exactly what made restarts
  // read as staged, and the duties layer does the position-wrestling better than any script.
  const duked = sp.kind === "goalkick" || sp.kind === "freekick" || sp.kind === "corner";
  for (const sd of ME_SIDES) for (const p of s.players[sd]) { p._closing = p._closing && duked; p._spSet = false; p._celeb = false; }

  // IT HAS JUST GONE IN. A goal restarts with a kickoff, and the kickoff shape used to begin the
  // instant the ball crossed the line -- twenty-two men turning on the spot and walking to their
  // marks while the net was still moving. For a few seconds the side that scored is not walking
  // anywhere: the scorer runs off toward the corner at the end he scored at and whoever was near
  // him goes with him. The side that CONCEDED takes the kickoff, so the taker is never one of them
  // and nothing about the restart itself is held up beyond the time it takes them to come back.
  if (sp.celeb && sp.t < CFG.spCelebT) {
    const cu = s.players[sp.celeb.side] || [];
    const sc = cu[sp.celeb.i] || cu.find(p => p.pos !== "GK" && !p.off);
    if (sc && !sc.off) {
      // A CAPPED RUN, resolved once. Sending him to the corner flag itself made a goal cost 105.8
      // displayed seconds against a real 45-60, and almost none of that was the celebration: it was
      // the fifty metres back. He runs a little way toward the corner at the end he scored at, from
      // where he was when it went in, and that is what a footballer actually does. Resolved on the
      // first slice because his own position is the origin and it moves the moment he sets off.
      if (sp.celeb.rx == null) {
        const dx2 = sp.celeb.x - sc.x, dy2 = sp.celeb.y - sc.y, dl = Math.hypot(dx2, dy2) || 1;
        const run = Math.min(dl, CFG.spCelebRun);
        sp.celeb.rx = sc.x + dx2 / dl * run; sp.celeb.ry = sc.y + dy2 / dl * run;
      }
      sc._tx = clampX(sp.celeb.rx); sc._ty = clampY(sp.celeb.ry);
      sc._spSet = true; sc._closing = true; sc._celeb = true;
      // Whoever can get to him. Not the whole side sprinting the length of the pitch -- the men who
      // were already up there, fanned around him rather than stacked on the same square metre.
      const near = cu.map((p, i) => [i, Math.hypot(p.x - sc.x, p.y - sc.y)])
                     .filter(([i, d]) => cu[i] !== sc && !cu[i].off && cu[i].pos !== "GK" && d < CFG.spCelebR)
                     .sort((a, b) => a[1] - b[1]).slice(0, CFG.spCelebN);
      near.forEach(([i], k) => {
        const p = cu[i], a2 = k * 2.1 + spRnd(sp, 90 + k);
        p._tx = clampX(sp.celeb.rx + Math.cos(a2) * CFG.spCelebGap);
        p._ty = clampY(sp.celeb.ry + Math.sin(a2) * CFG.spCelebGap);
        p._spSet = true; p._closing = true; p._celeb = true;
      });
    }
  }

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
    const gkD = meKeeper(them);
    if (gkD) { gkD._tx = clampX(gx - dir * 0.3); gkD._ty = ME_HALF_W; gkD._spSet = true; gkD._closing = true; }
    const taker = us[sp.ti];
    // The taker waits behind the spot rather than on it: standing on the ball put him inside the
    // area for the readiness test and, on the replay, in the middle of a box that is supposed to
    // be empty. meSPTake's run-up brings him in.
    if (taker && !taker.off && !sp.run) {
      taker._tx = clampX(sp.x - dir * CFG.spRunup);
      taker._ty = clampY(sp.y);
      taker._spSet = true; taker._closing = true;
    }
    let k = 0;
    for (const sd of ME_SIDES) for (const p of s.players[sd]) {
      // EVERYONE is claimed, _spSet or not. A penalty won at a corner arrives with half the box
      // still carrying the corner's _spSet flags, and honouring them left those men standing on
      // the goal line through the kick. Only the taker and the defending keeper keep the spots
      // this branch just gave them.
      if (p.off || p === taker || p === gkD) continue;
      // THE OTHER KEEPER STAYS AT HIS OWN END. This loop runs over BOTH sides and only the defending
      // goalkeeper had been marked _spSet already, so the attacking side's keeper fell through into
      // the arc of men around the box and trotted seventy metres up the pitch for a penalty.
      if (p.pos === "GK") {
        p._tx = clampX(meGoalX(meOther(sd)) + meDir(sd) * 2);
        p._ty = ME_HALF_W; p._spSet = true; continue;
      }
      // A man on an active RUN is steered by meRuns, which overrides the mark he is given here --
      // the one intruder left in a sixteen-penalty sweep was a forward still running the move the
      // foul interrupted. The run is cancelled with the whistle.
      p._run = null; p._runT = 0; p._cool = 0;
      const ang = -1.1 + (k++ % 10) * 0.24;
      p._tx = clampX(sp.x - dir * (CFG.spPenBack + Math.cos(ang) * 2));
      p._ty = clampY(ME_HALF_W + Math.sin(ang) * CFG.spPenSpread);
      p._spSet = true; p._closing = true;
      // ...and anyone still inside the area is WALKED out by the referee, not asked. The pair
      // involved in the foul freeze where the whistle caught them -- the fouled man down, the
      // fouler over him -- and the ordinary mover never shifts them, so the kick used to go with
      // both of them on the goal line. Direct displacement cannot be refused by whatever froze
      // them, and at a stride a slice they clear the box well inside the referee's patience.
      const _inArea = Math.abs(p.x - gx) < 17 && Math.abs(p.y - ME_HALF_W) < 20.8;
      if (_inArea || Math.hypot(p.x - sp.x, p.y - sp.y) < 10.5) {
        let _dx = p._tx - p.x, _dy = p._ty - p.y, _dd = Math.hypot(_dx, _dy);
        // Two men frozen on the SAME point -- the fouler standing over the man he fouled -- have
        // the same target and the same zero-length vector, so neither could be walked anywhere.
        // Push them straight out of the area instead, and fan them apart on the way.
        if (_dd < 0.05) { _dx = -dir * 1; _dy = (p.y < ME_HALF_W ? -1 : 1) * 0.4 + k * 0.01; _dd = Math.hypot(_dx, _dy); }
        const _st = Math.min(_dd, 2.2);
        p.x += _dx / _dd * _st; p.y += _dy / _dd * _st;
        p.vx = 0; p.vy = 0;
      }
    }
    return;
  }

  // ---- the attacking side
  const free = us.map((p, i) => i).filter(i => !us[i]._spSet && us[i].pos !== "GK");
  const place = (i, tx, ty) => { const p = us[i]; p._tx = clampX(tx); p._ty = clampY(ty); p._spSet = true; p._closing = true; };
  // Pick the man whose natural role best suits a spot: nearest by current position, so nobody
  // crosses the whole pitch when somebody else is already there.
  // THE COMMENT ABOVE WAS A LIE FOR AS LONG AS THIS EXISTED: it promised the man whose natural role
  // best suits a spot, and then picked purely on who was standing nearest. So the near post at a
  // corner went to whichever full-back happened to be closest and a centre-half took the short one.
  // Nobody was ever chosen for the job, which is most of why the restarts looked wrong.
  // Distance still decides most of it -- nobody crosses the pitch for a mark somebody else can fill
  // -- but the right KIND of player is worth a few metres of walking, and `want` names which kind.
  // strength IS the aerial attribute here: meAerial reads nothing else.
  const take = (tx, ty, want) => {
    let bi = -1, bs = Infinity;
    for (const i of free) { if (us[i]._spSet) continue;
      const q = us[i], d = Math.hypot(q.x - tx, q.y - ty);
      const fit = want ? Math.max(0, Math.min(1, (meAttrs(q)[want] - 60) / 39)) : 0;
      const sc = d - fit * CFG.spRoleW;
      if (sc < bs) { bs = sc; bi = i; } }
    if (bi >= 0) place(bi, tx, ty);
    return bi;
  };

  const marks = [];
  if (!duked) {
  const targets = [];
  if (sp.kind === "corner") {
    const nearSide = sp.y < ME_HALF_W ? -1 : 1;
    if (sp.v === 0) {                                                // spread across the six-yard box
      targets.push([gx - dir * 5.0, ME_HALF_W + nearSide * 5.0].concat('strength'));    // near post
      targets.push([gx - dir * 10.5, ME_HALF_W + nearSide * 1.0].concat('strength'));   // penalty spot
      targets.push([gx - dir * 6.0, ME_HALF_W - nearSide * 5.5].concat('strength'));    // far post
      targets.push([gx - dir * 19.0, ME_HALF_W].concat('shoot'));   // edge, for the cut-back
      targets.push([sp.x - dir * 7.0, sp.y - nearSide * 5.0].concat('pass'));       // short
    } else if (sp.v === 1) {                                         // flooding the near post
      targets.push([gx - dir * 4.0, ME_HALF_W + nearSide * 6.5].concat('strength'));
      targets.push([gx - dir * 5.5, ME_HALF_W + nearSide * 2.5].concat('strength'));
      targets.push([gx - dir * 9.5, ME_HALF_W + nearSide * 4.5].concat('strength'));
      targets.push([gx - dir * 16.0, ME_HALF_W + nearSide * 3.0].concat('shoot'));
      targets.push([sp.x - dir * 6.0, sp.y - nearSide * 4.0].concat('pass'));
    } else {                                                         // held at the back post
      targets.push([gx - dir * 6.5, ME_HALF_W - nearSide * 7.0].concat('strength'));
      targets.push([gx - dir * 11.0, ME_HALF_W - nearSide * 3.0].concat('strength'));
      targets.push([gx - dir * 5.0, ME_HALF_W + nearSide * 4.0].concat('strength'));
      targets.push([gx - dir * 20.0, ME_HALF_W - nearSide * 2.0].concat('shoot'));
      targets.push([sp.x - dir * 9.5, sp.y - nearSide * 6.5].concat('pass'));
    }
  } else if (sp.kind === "goalkick") {
    const long = (st.gkDist || 0) > 0;
    if (long) {
      targets.push([own + dir * 62, ME_HALF_W - 8].concat('strength'));
      targets.push([own + dir * 62, ME_HALF_W + 8].concat('strength'));
      targets.push([own + dir * 48, ME_HALF_W].concat('strength'));
    } else {
      targets.push([own + dir * 14, 8].concat('pace'));                             // full-backs wide and short
      targets.push([own + dir * 14, PITCH_W - 8].concat('pace'));
      targets.push([own + dir * 24, ME_HALF_W - 7]);
      targets.push([own + dir * 24, ME_HALF_W + 7]);
    }
  } else if (sp.kind === "throw") {
    const inw = sp.y < ME_HALF_W ? 1 : -1;
    targets.push([sp.x + dir * 6, sp.y + inw * 3].concat('pace'));                  // short, down the line
    targets.push([sp.x - dir * 5, sp.y + inw * 5]);                  // back inside
    targets.push([sp.x + dir * 12, sp.y + inw * 9].concat('pace'));                 // longer, infield
  } else if (sp.kind === "kickoff") {
    targets.push([PITCH_L / 2 - dir * 3, ME_HALF_W + 2]);            // the partner
  } else {                                                            // free kick
    const shooting = Math.abs(gx - sp.x) < CFG.spShootRange;
    if (shooting) {
      targets.push([gx - dir * 8, ME_HALF_W - 6].concat('strength'));
      targets.push([gx - dir * 8, ME_HALF_W + 6].concat('strength'));
      targets.push([gx - dir * 13, ME_HALF_W].concat('shoot'));
      targets.push([sp.x - dir * 2, sp.y + 3]);                      // over the ball with him
    } else {
      targets.push([sp.x + dir * 16, sp.y - 10]);
      targets.push([sp.x + dir * 16, sp.y + 10]);
      targets.push([sp.x + dir * 26, ME_HALF_W]);
    }
  }
  // Nobody stands on a coordinate. Scatter is applied here rather than inside each routine so it
  // covers every restart at once, and it is a function of the mark's index so it does not move
  // underneath a man who is already walking to it.
  for (let k2 = 0; k2 < targets.length; k2++) {
    targets[k2][0] += spJ(sp, 10 + k2); targets[k2][1] += spJ(sp, 40 + k2);
  }
  // THE BIG MEN GO UP FOR CORNERS. take() weighs fitness against walking distance, and a centre-half
  // starts forty metres from the box -- so the aerial marks always went to whichever midfielder was
  // nearest and the side's best headers never came up at all. Measured: defenders won the first
  // contact on corners 94-37, and 8 header shots in 339 corners. The prime aerial marks are now
  // handed to the strongest men on the pitch outright, distance be damned, which is exactly what a
  // real corner does; everyone else still takes marks by the normal rule.
  if (sp.kind === "corner") {
    const prime = targets.filter(t => t[2] === "strength").slice(0, CFG.spCornerUp);
    const bigs = free.filter(i => !us[i]._spSet)
      .sort((a2, b2) => meAttrs(us[b2]).strength - meAttrs(us[a2]).strength);
    prime.forEach((t, k2) => {
      if (bigs[k2] !== undefined) { place(bigs[k2], t[0], t[1]); marks.push([us[bigs[k2]], t]); t._up = 1; }
    });
  }
  for (const t of targets) { if (t._up) continue;
    const i = take(t[0], t[1], t[2]); if (i >= 0) marks.push([us[i], t]); }
  // Anybody left holds a sensible shape: behind the ball for a defensive restart, up for an
  // attacking one, and never all in the same place.
  let k = 0;
  for (const i of free) {
    if (us[i]._spSet) continue;
    const p = us[i];
    // A KICKOFF IS A TEAM STANDING IN ITS SHAPE, and this put nine of them on a zigzag ladder:
    // ME_HALF_W +/- (7 + k*3), alternating, which ignores _bw0 completely -- so the left-back could
    // line up on the right and the whole side fanned out in a widening V. Depth already came from
    // the formation; width simply never did. _bw0 is his slot and it is on the player already.
    // 0.5 rather than 0.45 + 18: everyone must be in their own half at a kickoff, and _bd0 runs to
    // about 95, so half of it is the compression that guarantees it.
    const shape = sp.kind === "goalkick" || sp.kind === "kickoff";
    // A GOAL KICK IS NOT A KICKOFF. Halving formation depth is the kickoff's own-half law; applied
    // to a goal kick it stood the centre-halves at _bd0 * 0.5 = five or six metres -- level with
    // the ball at 5.5 and square in front of the goal mouth -- where the take's nearest-man draw
    // then aimed the kick at them. That is the whole own-goal-from-a-goal-kick chain: a 6 m/s
    // floor-speed ball struck goalward at a man standing on his own six-yard line. Nobody stands
    // goal-side of a goal kick; the leftovers hold at least gkShapeMin, which is where a back four
    // actually receives one.
    const base = shape
      ? own + dir * Math.max(sp.kind === "goalkick" ? CFG.gkShapeMin : 0,
                             (p._bd0 ?? 40) * 0.5
                             + (sp.kind === "goalkick" ? (st.gkDist || 0) * CFG.gkShapePush : 0))
      : sp.x - dir * (10 + k * 7);
    const wide = shape ? (p._bw0 ?? ME_HALF_W)
                       : ME_HALF_W + ((k % 2 ? 1 : -1) * (7 + k * 3));
    place(i, base + spJ(sp, 60 + k), wide + spJ(sp, 70 + k));
    k++;
  }
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
  const gk = meKeeper(them);
  if (gk) {
    if (sp.kind === "corner") { gk._tx = clampX(gx - dir * 1.4); gk._ty = ME_HALF_W - (sp.y < ME_HALF_W ? -1 : 1) * 1.5; }
    else { gk._tx = clampX(gx - dir * 2.0); gk._ty = ME_HALF_W; }
    gk._spSet = true; gk._closing = true;
  }
  if (!duked && sp.kind === "corner") {
    const nearSide = sp.y < ME_HALF_W ? -1 : 1;
    // Both posts covered, the near one only, or neither and everybody picks a man up instead.
    if (sp.v !== 2) dtake(gx - dir * 0.8, ME_HALF_W + nearSide * 3.4);
    if (sp.v === 0) dtake(gx - dir * 0.8, ME_HALF_W - nearSide * 3.4);
  } else if (Math.abs(gx - sp.x) < CFG.spShootRange && (sp.kind === "freekick")) {
    // A WALL, on the line between the ball and the goal, ten yards off it. Three, four or five men
    // in it: how many you put in a wall is a decision, and it was the same four every time.
    const wall = Math.max(2, CFG.spWall + sp.v - 1);
    const wx = sp.x + (gx - sp.x) * 0, wy = sp.y;
    const bx2 = gx - sp.x, by2 = ME_HALF_W - sp.y, bl = Math.hypot(bx2, by2) || 1;
    const px = -by2 / bl, py = bx2 / bl;
    for (let w = 0; w < wall; w++) {
      const off = (w - (wall - 1) / 2) * 0.6;
      dtake(wx + bx2 / bl * CFG.spWallDist + px * off, wy + by2 / bl * CFG.spWallDist + py * off);
    }
  }
  // Everyone else picks up whoever is standing in a dangerous place, goal-side of him.
  // PICK UP EVERYBODY WORTH PICKING UP. At 30 m only the men already in the box were marked, so the
  // rest of the attack stood in one group and the rest of the defence in another -- two tidy blocks
  // with a corridor between them, which is not what a set piece looks like from above. 40 m reaches
  // the edge-of-box and cut-back marks as well, and the pairs are goal-side and a stride off, so the
  // two sides end up interleaved the way they actually stand.
  if (!duked) {
  for (const [man] of marks) {
    if (Math.abs(gx - man._tx) > 40) continue;
    dtake(man._tx + dir * 1.1, man._ty + (man._ty < ME_HALF_W ? -0.9 : 0.9));
  }
  let dk = 0;
  for (const i of dfree) {
    if (them[i]._spSet) continue;
    const p = them[i];
    // A BACK LINE, NOT A CONE. This receded (14, 22, 30, 38 m from goal) and widened (+/-8, 11, 14,
    // 17) at the same time, which draws a V opening away from the keeper -- a shape no side has ever
    // defended a free kick in. Men who are not in the wall and not marking anybody drop into a flat
    // line at their OWN formation width, with a second line behind the first once four are used.
    // At a kickoff or a goal kick they are not defending a restart at all, they are just standing in
    // their shape, so they take formation depth too.
    const shape2 = sp.kind === "kickoff" || sp.kind === "goalkick";
    // HOW DEEP THE LINE SITS IS A TACTIC. A flat 13 m meant every side defended a free kick from the
    // same distance, so a team told to hold a high line dropped onto its own six-yard box like a bus
    // and the gap between the two sides was the same whoever was playing. dst is the DEFENDING
    // side's own strategy -- st above belongs to the side taking it.
    const dst = s.strategy?.[opp] || {};
    const dLine = 13 + (dst.defLine || 0) * CFG.spLineStep;
    // NOBODY RETREATS TO HIS OWN HALF FOR A GOAL KICK. The kickoff's half-depth law was applied
    // here too, so the defending side's striker stood 46 m from his own goal -- fifty-nine from
    // the ball -- and the whole side sprinted back out the moment it was struck. The only law a
    // goal kick has is the penalty area: the side stands in nearly its full shape, the front men
    // on the edge of the taker's box, which is what pressing a goal kick is.
    // ...AND A FREE KICK'S LINE IS ANCHORED TO THE BALL. dLine alone sent every leftover to his
    // own box for a free kick at halfway -- retreat, then rush back out, the same artificial
    // pulse. The block holds spDropBack goal-side of the ball wherever the ball is; a kick in
    // shooting range still gets the old deep line, because there dLine wins the max().
    let base;
    if (sp.kind === "kickoff") base = gx - dir * (p._bd0 ?? 40) * 0.5;
    else if (sp.kind === "goalkick")
      base = gx - dir * Math.min(PITCH_L - 17.5, (p._bd0 ?? 40) * CFG.spGkDefScale);
    else {
      const bDep = Math.abs(sp.x - gx);
      base = gx - dir * (Math.max(dLine, bDep - CFG.spDropBack) + Math.floor(dk / 4) * 7);
    }
    dplace(i, base + spJ(sp, 80 + dk), (p._bw0 ?? ME_HALF_W) + spJ(sp, 85 + dk));
    dk++;
  }
  }
  // TEN YARDS. The wall was the only part of the defending side that knew the ball had to be given
  // room -- everybody else was placed by his own rule and several of them landed inside it. A free
  // kick from twenty-four metres put the second line of leftovers on their own thirteen and twenty,
  // which is four metres in FRONT of the ball, and a centre-half standing there is simply in the
  // way: measured, the tenth percentile of every free kick blocked was struck into a body 5.1 m
  // out, well short of the wall's 9.15. The referee moves them back, so this does.
  // THE AREA IS EMPTY AT A GOAL KICK -- the law, now that the brains bring pressers to the edge
  // of the box instead of a script keeping everyone away. Targets inside the taker's area are
  // clamped to its edge; the keepOut radius below handles the other kinds.
  if (sp.kind === "goalkick") for (const p of them) {
    if (p.off || p.pos === "GK") continue;
    const txv = p._tx ?? p.x, tyv = p._ty ?? p.y;
    if (Math.abs(txv - own) < 17.5 && Math.abs(tyv - ME_HALF_W) < 20.8) {
      p._tx = clampX(own + dir * 18); p._ty = clampY(tyv); p._closing = true;
    }
  }
  const keepOut = CFG.spKeepOut[sp.kind];
  if (keepOut) for (const p of them) {
    if (p.off || p.pos === "GK") continue;
    const dx2 = (p._tx ?? p.x) - sp.x, dy2 = (p._ty ?? p.y) - sp.y;
    const d2 = Math.hypot(dx2, dy2);
    if (d2 >= keepOut) continue;
    // Straight back from the ball, or toward his own goal if he is standing on it.
    const ux = d2 > 0.05 ? dx2 / d2 : (gx - sp.x) / (Math.abs(gx - sp.x) || 1);
    const uy = d2 > 0.05 ? dy2 / d2 : 0;
    p._tx = clampX(sp.x + ux * keepOut); p._ty = clampY(sp.y + uy * keepOut);
    p._closing = true;
  }
  // Both sides stay in their own half for a kickoff, and out of the circle.
  if (sp.kind === "kickoff") {
    for (const sd of ME_SIDES) {
      const d2 = meDir(sd), mine = sd === side;
      for (const p of s.players[sd]) {
        if (mine && p === taker) continue;
        if (p._celeb) continue;                       // he is not at the kickoff yet
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
  // A PENALTY WAITS FOR AN EMPTY BOX. The arc targets were always legal; what the replays kept
  // catching was the kick going while men who had been in the box for the corner that won it were
  // still jogging back out -- the referee here blows the moment the taker is set, and a real one
  // does not. Nobody but the taker and the keepers may be inside the area or within 10 m of the
  // spot when it is struck; the hard cap above still breaks a genuine deadlock.
  if (sp.kind === "penalty" && !sp.run && sp.t < (sp.minT ?? CFG.spMinT) + 150) {
    const _gx = meGoalX(sp.side), _boxW = 20.16;
    for (const sd of ME_SIDES) for (const q of s.players[sd]) {
      if (!q || q.off || q.pos === "GK") continue;
      if (sd === sp.side && s.players[sd][sp.ti] === q) continue;
      const inArea = Math.abs(q.x - _gx) < 16.5 && Math.abs(q.y - ME_HALF_W) < _boxW;
      if (inArea || Math.hypot(q.x - sp.x, q.y - sp.y) < 10) {
        // Harness-only: name the man refusing the pen at mid-ceremony -- who he is, where he
        // stands, and where his own target is. See the __pen gate in meSPTake.
        if (globalThis.__pen && sp.t === 100) globalThis.__pen.push({ probe: 1, sd,
          pos: q.pos, qx: +q.x.toFixed(1), qy: +q.y.toFixed(1),
          tx: +(q._tx ?? -1).toFixed(1), ty: +(q._ty ?? -1).toFixed(1),
          dTx: +Math.hypot(q.x - (q._tx ?? q.x), q.y - (q._ty ?? q.y)).toFixed(1),
          runT: q._runT || 0, spSet: q._spSet ? 1 : 0, closing: q._closing ? 1 : 0 });
        return false;
      }
    }
    // ...and the taker's own progress at the same instant, for the runs the box wait passes.
    if (globalThis.__pen && sp.t === 100) {
      const _tk = s.players[sp.side][sp.ti];
      if (_tk) globalThis.__pen.push({ probe: 2, tD: +Math.hypot(_tk.x - sp.x, _tk.y - sp.y).toFixed(1),
        dTx: +Math.hypot(_tk.x - (_tk._tx ?? _tk.x), _tk.y - (_tk._ty ?? _tk.y)).toFixed(1),
        tx: +(_tk._tx ?? -1).toFixed(1), ty: +(_tk._ty ?? -1).toFixed(1),
        qx: +_tk.x.toFixed(1), qy: +_tk.y.toFixed(1), spSet: _tk._spSet ? 1 : 0 });
    }
  }

  const taker = s.players[sp.side][sp.ti];
  if (!taker) return true;
  // NOTHING MAY HANG A RESTART. meSPTake has a capT meant to force one when the players cannot
  // arrange themselves, but it sits BEHIND this gate and so could never be reached -- a restart
  // this refused was refused forever. Measured: a quick throw still live after 2809 slices
  // against a cap of 52, because the taker is marked BEHIND the touchline where a throw is taken
  // from, while the quick test measures him against a ball sitting on the line. He stood 6.3 m
  // outside a 1.75 m tolerance and the game stopped. The mark is arguably the bug, but the gate
  // having no ceiling is what turned it into a frozen match, and that is true of every kind.
  if (sp.t > (sp.maxT ?? CFG.spMaxTBy[sp.kind] ?? CFG.spMaxT) + 20) return true;
  // Taken quickly: the only man who has to be anywhere is the one taking it. Everybody else is
  // wherever the whistle left them, which is exactly the point of playing it before they set.
  if (sp.quick) return Math.hypot(taker.x - sp.x, taker.y - sp.y) < CFG.spTakerTol * 2.5;
  // A GOAL KICK IS NOT A CEREMONY. The keeper has the ball in his hands and the whole point of a
  // short one is that it goes before the other side has set -- waiting on ten outfielders to trot
  // onto their marks is what made every goal kick in the match look identical. He needs to be at the
  // ball and nothing else; the shape can arrive around him or not.
  if (sp.kind === "goalkick") return Math.hypot(taker.x - sp.x, taker.y - sp.y) < CFG.spTakerTol * 2.5;
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
  // The duked kinds wait for NOBODY but the taker: there are no marks to be set on -- both sides
  // are positioning themselves live -- so the crowd fraction below would count men against brain
  // targets that move every slice and the restart would hang. The minT floor above still gives
  // the walk its time, and a struck kind still gets its run-up.
  // ...A CORNER STILL WAITS FOR ITS BOX, though, and dropping that wait with the choreography is
  // what emptied it: the delivery went the moment the taker reached the flag, forty metres before
  // his own big men arrived. Measured, 23% of corners were swung into an EMPTY box and the mean
  // was 2.63 attackers in it against the five the box duty sends. The old crowd fraction cannot
  // be used -- it counts men against brain targets that move every slice -- but the FOOTBALLING
  // condition can be asked directly, and it is the one a real taker waits on: are my men up?
  // spMaxTBy.corner still forces it away, so nothing can hang.
  if (sp.kind === "corner") {
    const gxR = meGoalX(sp.side), usR = s.players[sp.side];
    let inBox = 0;
    for (const q of usR) { if (q.off || q.pos === "GK" || q === taker) continue;
      if (Math.abs(q.x - gxR) < CFG.gkBoxR && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW) inBox++; }
    if (inBox < CFG.cnBoxReady) return false;
    // ...and the defenders too: waiting only for the attack meant the kick went while the
    // defending block was still jogging back from its midfield shape -- seven on three in the
    // area. The referee holds a corner for both sides; spMaxTBy.corner still forces it away.
    const themR = s.players[meOther(sp.side)];
    let defBox = 0;
    for (const q of themR) { if (q.off || q.pos === "GK") continue;
      if (Math.abs(q.x - gxR) < CFG.gkBoxR + 3 && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW + 3) defBox++; }
    if (defBox < CFG.cnDefReady) return false;
    if (struck) { sp.run = 1; return false; }
    return true;
  }
  if (sp.kind === "freekick") {
    if (struck) { sp.run = 1; return false; }
    return true;
  }
  // A SHOOTOUT KICK WAITS FOR NOBODY BUT THE TAKER. The check below wants most of the outfield
  // on its penalty-arc marks, and in a shootout the other eighteen are deliberately stood on the
  // halfway line -- so it could never pass and every kick sat out the full 140-slice ceiling
  // before being forced through. Measured at 144 slices a kick, thirty-six seconds of nothing.
  // The two men who matter are already checked: the taker here, the keeper on his line.
  if (mp._pk) return true;
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
  // A CORNER THAT ALWAYS FINDS THE SAME MAN IS THE SAME CORNER EVERY TIME, and this was an argmax:
  // nearest the goal, most central, no randomness anywhere. With the shape fixed the delivery was
  // fixed too, which is why every corner in a match looked like the one before it.
  // Now it is a weighted draw. Being well placed still dominates -- an exponential on the same value
  // keeps a man at the far post far likelier than one on the halfway line -- but who gets it varies,
  // and for a delivery into the box being able to head it is worth as much as standing in the right
  // spot. strength is the aerial attribute; meAerial reads nothing else.
  const into = sp.kind === "corner" || sp.kind === "freekick";
  const themT = s.players[meOther(side)] || [];
  const cands = [];
  for (let i = 0; i < us.length; i++) {
    if (i === sp.ti || us[i].pos === "GK") continue;
    // Never level with or behind the ball at a goal kick. The weighted draw below is exp(-d), so a
    // man standing two metres away owns it whoever else is free -- and a man behind the ball spot
    // is a pass struck at his own net. The shape floor above should leave nobody there; this is
    // the law for whoever ends up there anyway.
    if (sp.kind === "goalkick" && (us[i].x - sp.x) * dir < 3) continue;
    const q = us[i], d = Math.hypot(q.x - sp.x, q.y - sp.y);
    if (d > CFG.spMaxBall) continue;
    // A CORNER IS NOT AIMED AT THE GOALMOUTH. The old value maximised proximity to the goal line
    // and the centre, which selects the man standing on the keeper -- and with the run and the
    // cross-over both pushing goalward on top, deliveries funnelled into the six-yard box where
    // the claim eats them. Real deliveries land in the scoring band around the spot, so a corner
    // scores its candidates by distance from cnAimD out, not by depth.
    // ...scored at where his RUN puts him at contact (the run fires at the strike and carries
    // spCornerRun metres goalward before the ball lands), not where he stands now.
    // A CORNER IS NOT AIMED AT THE GOALMOUTH. The old value maximised proximity to the goal line
    // and the centre, which selects the man standing on the keeper -- and with the run and the
    // cross-over both pushing goalward on top, deliveries funnelled into the six-yard box where
    // the claim eats them. Real deliveries land in the scoring band around the spot, so a corner
    // scores its candidates by where the RUN puts them at contact (the run fires at the strike
    // and carries spCornerRun metres goalward before the ball lands), against cnAimD.
    // A goal kick or a throw goes to a FREE man, not the near one: -d alone sent every goal
    // kick to the closest centre-back with a striker standing on his toes. Separation from the
    // nearest opponent buys distance at spFreeW per metre, capped so an empty far corner does
    // not outbid the whole midfield.
    // A DEEP FREE KICK IS A RESTART, NOT A DELIVERY. `into` lumped every free kick in with
    // corners and aimed at the goalmouth regardless of who stood there, so one taken inside a
    // side's own half was launched at a crowd. Only a kick within striking range of their goal
    // is a delivery; the rest are played to a free man like a goal kick.
    const deliv = sp.kind === "corner"
      || (sp.kind === "freekick" && Math.abs(gx - sp.x) < CFG.spShootRange + 12);
    let sepT = 0;
    if (!deliv) {
      sepT = Infinity;
      for (const o of themT) { if (o.off) continue;
        const so = Math.hypot(o.x - q.x, o.y - q.y); if (so < sepT) sepT = so; }
      sepT = Math.min(sepT, 12);
    }
    const v = sp.kind === "corner"
      ? -Math.abs(Math.hypot(gx - q.x, ME_HALF_W - q.y) - CFG.spCornerRun - CFG.cnAimD)
        - Math.abs(q.y - ME_HALF_W) * 0.1
      : deliv ? -Math.abs(gx - q.x) - Math.abs(q.y - ME_HALF_W) * 0.35 : -d + sepT * CFG.spFreeW;
    let w = Math.exp(v * CFG.spAimSharp);
    if (into) w *= 0.5 + meAttrs(q).strength / 99;
    cands.push([i, w]);
  }
  let ti = -1;
  if (cands.length) {
    let tw = 0; for (const c of cands) tw += c[1];
    let r = rng.u() * tw;
    for (const c of cands) { r -= c[1]; if (r <= 0) { ti = c[0]; break; } }
    if (ti < 0) ti = cands[cands.length - 1][0];
  }
  const them2 = s.players[meOther(side)];
  if (globalThis.__rst && ti >= 0) {
    let sepR = Infinity;
    for (const o of them2) { if (o.off) continue;
      const so = Math.hypot(o.x - us[ti].x, o.y - us[ti].y); if (so < sepR) sepR = so; }
    (globalThis.__rst[sp.kind] = globalThis.__rst[sp.kind] || []).push(+Math.min(sepR, 40).toFixed(1));
  }
  // Whether the keeper picks the right way. On a shot from open play he READS it -- the ball is
  // already gone and he is going with what he saw. On a penalty he is committing before it is
  // struck against a man who knows that, which is why a penalty is converted three times in four:
  // his rating buys him a little over a coin flip and no more.
  const gkRead = (aimY, base, skillW) => {
    const g = meKeeper(them2);
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
    // A penalty is a shot and it is worth what this engine converts it at. See CFG.spPenXg: xgS was
    // open-play only, so a side that won or conceded dead balls was invisible to the balance table.
    if (out.xgS) out.xgS[side] += CFG.spPenXg;
    if (out.shotDist) out.xg = (out.xg || 0) + CFG.spPenXg;
    // `pen` rides with the shot so whatever it turns into knows where it came from: a penalty
    // scored and a penalty missed are their own events, not a goal and a shot off target.
    mp.shot = { side, name: taker.name, full: taker.fullName || taker.name, i: sp.ti,
                t0: mp.tick, pen: true, xg: CFG.spPenXg }; mp.fj = -1;
    // THE LAW, ENFORCED AT THE KICK. Everything before this is the referee ASKING them to clear:
    // the arc marks, the walk-out, the readiness gate. All of it is timing-dependent, and a man
    // who drifts back in once the run-up has begun beats every one of them, which is the last
    // thing the replays kept catching. This is the referee refusing to allow it -- at the instant
    // the ball is struck, anyone but the taker and the keepers inside the area or the arc is
    // standing on its edge instead.
    for (const _sd of ME_SIDES) for (const _q of s.players[_sd]) {
      if (!_q || _q.off || _q.pos === "GK" || _q === taker) continue;
      const _dy = Math.abs(_q.y - ME_HALF_W);
      const _inArea = Math.abs(_q.x - gx) < 16.6 && _dy < 20.3;
      if (!_inArea && Math.hypot(_q.x - sp.x, _q.y - sp.y) >= 9.2) continue;
      _q.x = clampX(gx + dir * 16.9);
      if (_dy < 20.4) _q.y = clampY(ME_HALF_W + (_q.y < ME_HALF_W ? -1 : 1) * 20.7);
      _q.vx = 0; _q.vy = 0; _q._tx = _q.x; _q._ty = _q.y;
    }
    // Harness-only (same gate pattern as __prov): how every penalty was actually struck. tD is the
    // taker's distance to the ball at the strike -- anything over ~2 is a kick fired by a timeout
    // with the taker still walking, which is the "shot with no kick" a viewer sees. bD is the
    // ball's own distance to the spot, and t/run say which readiness path fired it.
    if (globalThis.__pen) globalThis.__pen.push({ pk: mp._pk ? 1 : 0, t: sp.t, run: sp.run ? 1 : 0,
      ti: sp.ti, tD: +Math.hypot(taker.x - mp.bx, taker.y - mp.by).toFixed(1),
      bD: +Math.hypot(mp.bx - sp.x, mp.by - sp.y).toFixed(1) });
    gkRead(away, mp._pk ? CFG.spPenReadPk : CFG.spPenRead,
                 mp._pk ? CFG.spPenReadSkillPk : CFG.spPenReadSkill);
    meEvt(out, "shot", side, sp.x, sp.y, gx, away, `${taker.fullName || taker.name} steps up`);
    meShootBall(mp, rng, gx, away, 0.35 + rng.u() * 0.95, a.shoot / 99, 0, CFG.spPenElev);
    return;
  }

  if (shooting) {
    // Struck at goal. A free kick from twenty metres IS a shot, and it was never one before.
    const g = meShotGeom(side, sp.x, sp.y);
    const away = ME_HALF_W + (sp.y <= ME_HALF_W ? 1 : -1) * GOAL_HALF_W * (0.35 + a.shoot / 99 * 0.5);
    out.shots[side]++;
    // Same for the free kick, at the conversion measured in the sweep noted below. The shotDist
    // histogram is deliberately NOT fed from here -- it exists to describe open-play shot SELECTION,
    // and a dead ball is struck from wherever the foul happened.
    if (out.xgS) out.xgS[side] += CFG.spFkXg;
    if (out.shotDist) out.xg = (out.xg || 0) + CFG.spFkXg;
    mp.shot = { side, name: taker.name, full: taker.fullName || taker.name, i: sp.ti, t0: mp.tick, xg: CFG.spFkXg };
    mp.fj = -1;
    // ...and this was missing entirely: with no readY the keeper's dive branch never fires, so he
    // stood and watched every free kick struck at his goal.
    // HE HAS ALL DAY. Every shot in open play buys the keeper a better read the longer the flight
    // is -- see the tAv bonus in meTick -- and a free kick from twenty-five metres is the longest
    // flight he ever gets, a full second of a ball he watched being placed. This branch was the one
    // strike in the game that did not pay him for it, so a dead ball struck from range was read no
    // better than a shot from the six-yard box.
    // It BUYS NOTHING, and the honest reason to keep it is consistency rather than effect: swept
    // 0 against 0.18 over 150 matches, conversion came out 9.5% and 9.9% at a standard error of 1.2,
    // and goals a match 2.81 and 2.79. A free kick is decided by the wall and by being off target
    // -- 26% blocked and 24% wide -- long before the keeper's read is asked anything.
    const fkT = Math.max(0, Math.min(1, (g.d / Math.max(8, CFG.shotV0 + a.shoot / 99 * CFG.shotVSkill)
                                         - CFG.gkReadT0) / CFG.gkReadTSpan)) * CFG.spFkRead;
    gkRead(away, CFG.gkReadMin + fkT, CFG.gkReadMax - CFG.gkReadMin);
    meEvt(out, "shot", side, sp.x, sp.y, gx, away, `${taker.fullName || taker.name} strikes the free kick`);
    // Over the wall and under the bar, which is the whole act. meFkArc solves the pair; the target
    // height used to be a coin toss between one metre and two with the wall nowhere in it.
    const [fkZ, fkV] = meFkArc(g.d, mp.bz, rng);
    meShootBall(mp, rng, gx, away, fkZ, a.shoot / 99, 0, CFG.spFkElev, fkV);
    return;
  }
  // THE BOX ATTACKS THE DELIVERY -- and the delivery leads the run. Runs are committed BEFORE the
  // aim is computed, because a corner flight is five or six slices and a man darting goalward at
  // the strike is three metres past his mark when the ball lands on it: the first cut set the
  // runs after the aim and made every runner run AWAY from his own delivery. The ball is flighted
  // to where the target's run ends, which is what "attacking the near post" is.
  if (sp.kind === "corner") {
    for (const q2 of us) {
      if (q2 === taker || q2.pos === "GK" || q2.off) continue;
      const dg = Math.hypot(gx - q2.x, ME_HALF_W - q2.y);
      if (dg > 25 || dg < 2) continue;
      q2._run = "corner"; q2._runT = CFG.spCornerRunT;
      q2._rx = q2.x + (gx - q2.x) / dg * CFG.spCornerRun;
      q2._ry = q2.y + (ME_HALF_W - q2.y) / dg * CFG.spCornerRun;
    }
  }
  const q = ti >= 0 ? us[ti] : null;
  let tx = q ? (sp.kind === "corner" ? (q._rx ?? q.x) : q.x) : sp.x + dir * 20,
      ty = q ? (sp.kind === "corner" ? (q._ry ?? q.y) : q.y) : ME_HALF_W;
  // A CORNER IS FLIGHTED TO HIS HEAD, NOT HIS FEET. The loft lands where it is aimed, so aiming at
  // the man meant the ball fell through head height metres SHORT of him -- at his marker -- and
  // arrived at his boots at z = 0. Landing spCrossOver beyond him puts it at 1.8-2.0 m as it
  // crosses his mark, which turns the reception into the aerial duel a corner actually is.
  if (sp.kind === "corner" && q) {
    const ux = tx - sp.x, uy = ty - sp.y, ul = Math.hypot(ux, uy) || 1;
    tx += ux / ul * CFG.spCrossOver; ty += uy / ul * CFG.spCrossOver;
    if ((gx - tx) * dir < 1.2) tx = gx - dir * 1.2;   // never flighted to land in the net
  }
  if (sp.kind === "goalkick") mp._gkKick = mp.tick;   // provenance stamp; see __prov in match.ts
  const high = sp.kind === "corner"
    || (sp.kind === "goalkick" && (s.strategy?.[side]?.gkDist || 0) > 0)
    || (sp.kind === "freekick" && Math.hypot(tx - sp.x, ty - sp.y) > 24);
  // NO SET-PIECE DELIVERY IS COMMENTARY. A throw, a goal kick, a corner swung in and a free kick
  // played on came to nineteen lines a match between them -- restarts, not events. Whatever comes of
  // the delivery reports on its own, and the foul or the corner that won it already did. meEvt still
  // marks the pitch, and the taker is still credited with the pass in his own column.
  const label = null;
  // The taker gets credited for it like any other pass. Left off, every corner, throw, goal kick
  // and free kick completed into the match total and onto nobody's name -- about twenty-five passes
  // a match, which is where the per-player column stopped reconciling with the team's.
  mp.passPending = { side, byP: taker };
  meEvt(out, "pass", side, sp.x, sp.y, tx, ty, label);
  if (globalThis.__sp) {
    globalThis.__sp[sp.kind] = (globalThis.__sp[sp.kind] || 0) + 1;
    if (sp.kind === "corner") {
      const gxP = meGoalX(side), dP = meDir(side);
      let inBox = 0, ownHalf = 0;
      for (const q2 of us) { if (q2.off || q2.pos === "GK" || q2 === taker) continue;
        if (Math.abs(q2.x - gxP) < 16.5 && Math.abs(q2.y - ME_HALF_W) < 20.16) inBox++;
        if ((q2.x - (PITCH_L / 2)) * dP < 0) ownHalf++; }
      const phaseOK = mp.side === side ? 1 : 0;   // does the duty layer think we are attacking?
      let boxD = 0; for (const q2 of us) if (q2._duty === "box") boxD++;
      let defBox2 = 0;
      for (const q2 of s.players[meOther(side)]) { if (q2.off || q2.pos === "GK") continue;
        if (Math.abs(q2.x - gxP) < 16.5 && Math.abs(q2.y - ME_HALF_W) < 20.16) defBox2++; }
      // WHY it went with an empty box: t is how long the ceremony ran, cap is what it was allowed,
      // so t > cap is the referee forcing it away rather than the box being ready. quick bypasses
      // the wait entirely. dutyD is how far the box men still are from their stations.
      const capP = sp.maxT ?? CFG.spMaxTBy[sp.kind] ?? CFG.spMaxT;
      let far = 0, farSum = 0;
      for (const q2 of us) if (q2._duty === "box") {
        const dd = Math.hypot(q2.x - (q2._tx ?? q2.x), q2.y - (q2._ty ?? q2.y));
        farSum += dd; if (dd > 4) far++;
      }
      (globalThis.__sp.box = globalThis.__sp.box || []).push([inBox, ownHalf, phaseOK, boxD, defBox2,
        sp.t, capP, sp.quick ? 1 : 0, far, +farSum.toFixed(1)]);
      if (inBox < 3) {
        (globalThis.__sp.thin = globalThis.__sp.thin || []).push(us.filter(q2 => q2._duty === "box")
          .map(q2 => ({ k: q2._boxK,
                        dx: +((q2.x - gxP) * dP).toFixed(1), dy: +(q2.y - ME_HALF_W).toFixed(1),
                        ttx: +(((q2._tx ?? 0) - gxP) * dP).toFixed(1), tty: +((q2._ty ?? 0) - ME_HALF_W).toFixed(1),
                        run: q2._run || "", spY: +sp.y.toFixed(0) })));
      }
    }
  }
  meKickBall(mp, rng, tx, ty, high ? "high" : "ground", a.pass / 99, 0);
}
