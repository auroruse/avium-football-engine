// DOES THE KEEPER ACTUALLY STAND ON THE BISECTOR? A direct check, not a match aggregate.
//
// The match numbers moved only slightly when the resting stance was changed from the goal-centre
// line to the post bisector, and both keeper branches reported the same offset, which is exactly
// what a change that never fires looks like. So this asks the rule itself: put the ball at a known
// spot, run the brains, and compare where the keeper was TOLD to stand against the bisector solved
// on paper. No match, no dynamics, no lag.
//
//   node test/gkcheck.mjs
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meDuties, meBlock, meShape, meSlots,
        meGoalX, meOther, meAttrs, meGkSkill, PITCH_W, GOAL_HALF_W, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const ME_HALF_W = PITCH_W / 2;

const s = createMatchState();
const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
s.formations = { home: "4-3-3", away: "4-3-3" };
s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
s.possession = "home"; meInit(s, pitchSlots);

const mp = s.mePos;
const DEF = "away";                       // away defends the goal home is attacking
const own = meGoalX(meOther(DEF));        // away's own goal line
const gk = s.players[DEF].find(p => p.pos === "GK");
const dir = own < PITCH_W ? 1 : 1;        // unused; kept explicit below

// The ball is carried by home's striker. Placed OUTSIDE gkBoxR of the goal so the "carrier in my
// area" branch does not fire and the resting stance is the one under test.
const carrier = 10;
let fails = 0, rows = 0;

console.log(`\ngkPanic ${CFG.gkPanic}   gkOutMin ${CFG.gkOutMin} gkOutK ${CFG.gkOutK} ` +
            `gkOutMax ${CFG.gkOutMax}   gkSide ${CFG.gkSide}`);
console.log(`keeper reflex ${meAttrs(gk).reflex}, gkSkill ${meGkSkill(meAttrs(gk)).toFixed(2)}\n`);
console.log(`   ball          told to stand      bisector says     centre-line says   verdict`);

for (const [bx, by] of [[25, 34], [25, 20], [25, 48], [30, 10], [30, 58], [40, 14], [22, 34], [35, 25]]) {
  mp.bx = bx; mp.by = by; mp.bz = 0.11; mp.bvx = 0; mp.bvy = 0; mp.bvz = 0;
  mp.idx = carrier; mp.side = "home"; mp.flight = false; mp.shot = null; mp.sp = null;
  s.players.home[carrier].x = bx; s.players.home[carrier].y = by;
  gk.x = own; gk.y = ME_HALF_W;                       // start him on his line every time
  gk._gkOut = 0;
  for (const sd of ["home", "away"]) meSlots(s, sd);
  for (const sd of ["home", "away"]) meDuties(s, sd);
  for (const sd of ["home", "away"]) meBlock(s, sd);
  for (const sd of ["home", "away"]) meShape(s, sd);

  // ---- the same thing, solved on paper
  const vx = bx - own, vy = by - ME_HALF_W, vd = Math.hypot(vx, vy) || 1;
  const st = s.strategy[DEF];
  const outD = Math.max(CFG.gkOutMin,
               Math.min(CFG.gkOutMax, CFG.gkOutMin + vd * CFG.gkOutK + (st.dlBehavior || 0) * 1.2));
  const half = GOAL_HALF_W * (1 + (1 - meGkSkill(meAttrs(gk))) * CFG.gkPanic);
  const uA = [own - bx, (ME_HALF_W - half) - by], uB = [own - bx, (ME_HALF_W + half) - by];
  const lA = Math.hypot(uA[0], uA[1]), lB = Math.hypot(uB[0], uB[1]);
  let mx = uA[0] / lA + uB[0] / lB, my = uA[1] / lA + uB[1] / lB;
  const ml = Math.hypot(mx, my); mx /= ml; my /= ml;
  const sgn = vx >= 0 ? 1 : -1;
  const step = (own + sgn * outD - bx) / mx;
  const bisY = ME_HALF_W + Math.max(-CFG.gkSide, Math.min(CFG.gkSide, (by + step * my) - ME_HALF_W));
  const bisX = own + vx / vd * outD;
  const ctrY = ME_HALF_W + Math.max(-CFG.gkSide, Math.min(CFG.gkSide, vy / vd * outD));

  const ok = Math.abs(gk._tx - bisX) < 0.02 && Math.abs(gk._ty - bisY) < 0.02;
  const isCentre = Math.abs(gk._ty - ctrY) < 0.02 && Math.abs(bisY - ctrY) > 0.05;
  rows++; if (!ok) fails++;
  console.log(`  (${String(bx).padStart(2)},${String(by).padStart(2)})   ` +
    `(${gk._tx.toFixed(2)}, ${gk._ty.toFixed(2)})     ` +
    `(${bisX.toFixed(2)}, ${bisY.toFixed(2)})     ` +
    `(${bisX.toFixed(2)}, ${ctrY.toFixed(2)})    ` +
    `${ok ? "bisector" : isCentre ? "STILL THE CENTRE LINE" : "neither -- another branch"}`);
}
console.log(`\n  ${rows - fails}/${rows} on the bisector.`);
if (fails) { console.log("  FAIL: the stance is not the rule that was written."); process.exit(1); }
