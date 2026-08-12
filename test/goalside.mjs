// IS THE MARKER ACTUALLY BETWEEN HIS MAN AND THE GOAL?
//
// Two separate claims, and they need separating before either is fixed:
//
//   HE IS ON THE WRONG SIDE. Marking is supposed to put a defender goal-side of his man. The
//   assignment already charges six metres for picking a defender who is upfield of his target, and
//   the mark target subtracts markBase along dir -- so on paper he is goal-side. Whether he ends up
//   there is a different question, because the target is blended toward a shooting point and then
//   smoothed, and because a man who is beaten never gets back.
//
//   SOMEBODY IS LEFT ALONE. nMark caps how many opponents are marked at all -- five under siege,
//   four inside 34 m, two inside 60, one beyond -- so an attacker outside the top nMark threats is
//   nobody's job however dangerous he is. This asks whether the man in the most dangerous position
//   on the pitch is the one being left, and whether he is left while two defenders share one man.
//
// Measured only while the side is actually defending, and only for outfielders.
//
//   node test/goalside.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        meDanger, ME_MATCH_TICKS, ME_SIDES, PITCH_W, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);
const ME_HALF_W = PITCH_W / 2;

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { pairs: 0, goalSide: 0, offLine: [], gap: [],
              slices: 0, topFree: 0, topD: [], stacked: 0, marked: 0, threats: 0,
              tgtGoalSide: 0, beaten: 0, runDisplaced: 0,
              boxMen: 0, boxFree: 0 };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (mp.sp || mp.idx < 0) continue;
    const side = meOther(mp.side);                 // the side without the ball is defending
    const us = s.players[side], them = s.players[mp.side];
    const dir = meDir(side), own = meGoalX(meOther(side));
    A.slices++;

    // ---- 1. every marked pair
    for (const p of us) {
      if (p.off || p._duty !== "mark" || p._mk < 0) continue;
      const q = them[p._mk]; if (!q || q.off) continue;
      A.pairs++;
      // Goal-side: the defender is nearer his own goal than his man is, along the attack.
      if ((q.x - p.x) * dir > 0) A.goalSide++;
      // THE DECISIVE SPLIT. If the TARGET is goal-side and he is not, this is a movement problem --
      // he is being asked for the right place and cannot get there. If the target itself is on the
      // wrong side, no amount of running fixes it and the fault is in meShape.
      if (p._tx != null && (q.x - p._tx) * dir > 0) A.tgtGoalSide++;
      if ((mk => (mk.x - (p.x + (p.vx || 0) * 0.56)) * dir <= 0)(q)) A.beaten++;
      // ...and how far off the line from his man to the middle of his own goal he is standing.
      const lx = own - q.x, ly = ME_HALF_W - q.y, ll = Math.hypot(lx, ly) || 1;
      A.offLine.push(Math.abs((p.x - q.x) * (-ly / ll) + (p.y - q.y) * (lx / ll)));
      A.gap.push(Math.hypot(p.x - q.x, p.y - q.y));
    }

    // ---- 2. the most dangerous man who is not on the ball
    let bi = -1, bv = -Infinity;
    for (let j = 0; j < them.length; j++) {
      const q = them[j];
      if (q.pos === "GK" || q.off || j === mp.idx) continue;
      const v = meDanger(meOther(side), q.x, q.y);
      if (v > bv) { bv = v; bi = j; }
    }
    if (bi >= 0) {
      A.threats++;
      const q = them[bi];
      let nd = Infinity, ndGoalSide = false;
      for (const p of us) {
        if (p.off || p.pos === "GK") continue;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < nd) { nd = d; ndGoalSide = (q.x - p.x) * dir > 0; }
      }
      A.topD.push(nd);
      // Nobody within five metres, or the nearest man is on the wrong side of him: he is free.
      if (nd > 5 || !ndGoalSide) A.topFree++;
      if (us.some(p => p._duty === "mark" && p._mk === bi)) A.marked++;
      // ...and was he pushed out of the list by somebody's RUN? meDuties adds a flat 0.8 to an
      // active runner's danger, and meDanger is normalised to [0, 1] -- so 0.8 is eighty per cent
      // of the entire scale, and a runner in midfield can outrank a striker on the penalty spot.
      const rank = them.map((q2, j2) => [meDanger(meOther(side), q2.x, q2.y)
                     + ((q2._runT ?? 0) > 0 ? 0.8 : 0), j2, q2])
                    .filter(([, j2, q2]) => q2.pos !== "GK" && !q2.off && j2 !== mp.idx)
                    .sort((a2, b2) => b2[0] - a2[0]);
      const ballDepth2 = (mp.bx - own) * dir;
      const runners2 = them.filter(q2 => (q2._runT ?? 0) > 0 && q2.pos !== "GK").length;
      const nMark2 = (ballDepth2 < CFG.markSiegeDepth ? CFG.markSiege
                    : ballDepth2 < 34 ? 4 : ballDepth2 < 60 ? 2 : 1) + runners2;
      if (!rank.slice(0, nMark2).some(([, j2]) => j2 === bi)) A.runDisplaced++;
    }

    // ---- 3. two defenders on the same square metre
    for (let a = 0; a < us.length; a++) for (let b = a + 1; b < us.length; b++) {
      if (us[a].off || us[b].off || us[a].pos === "GK" || us[b].pos === "GK") continue;
      if (Math.hypot(us[a].x - us[b].x, us[a].y - us[b].y) < 2) { A.stacked++; break; }
    }

    // ---- 4. men in our own box, and how many of them have nobody goal-side
    for (const q of them) {
      if (q.pos === "GK" || q.off) continue;
      if (Math.abs(q.x - own) > CFG.gkBoxR || Math.abs(q.y - ME_HALF_W) > CFG.boxHalfW) continue;
      A.boxMen++;
      if (!us.some(p => !p.off && p.pos !== "GK" && (q.x - p.x) * dir > 0
                        && Math.hypot(p.x - q.x, p.y - q.y) < 6)) A.boxFree++;
    }
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const cat = (k) => res.flatMap(r => r[k]);
const f1 = (x) => x.toFixed(1);
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const pc = (n, d) => f1(100 * n / (d || 1)) + "%";

console.log(`\n${N} matches, ${S("slices")} defending slices.\n`);
console.log(`  THE MARKED PAIR                                          real`);
console.log(`    marker is goal-side of his man    ${pc(S("goalSide"), S("pairs")).padStart(7)}      ~95%`);
console.log(`    his TARGET is goal-side           ${pc(S("tgtGoalSide"), S("pairs")).padStart(7)}`);
console.log(`    flagged beaten (wrong side of him)${pc(S("beaten"), S("pairs")).padStart(7)}`);
console.log(`    median offset off the man-to-goal line  ${f1(med(cat("offLine")))} m     0-2 m`);
console.log(`    median gap to his man                  ${f1(med(cat("gap")))} m     1-3 m`);
console.log(`\n  THE MOST DANGEROUS MAN OFF THE BALL`);
console.log(`    somebody is marking him           ${pc(S("marked"), S("threats")).padStart(7)}`);
console.log(`    free -- nobody inside 5 m, or the`);
console.log(`    nearest man is the wrong side     ${pc(S("topFree"), S("threats")).padStart(7)}`);
console.log(`    outranked out of the mark list    ${pc(S("runDisplaced"), S("threats")).padStart(7)}`);
console.log(`    median distance to the nearest    ${f1(med(cat("topD")))} m`);
console.log(`\n  IN OUR OWN BOX`);
console.log(`    opponents in it, per slice        ${f1(S("boxMen") / (S("slices") || 1))}`);
console.log(`    of those, none goal-side within 6 m  ${pc(S("boxFree"), S("boxMen")).padStart(7)}`);
console.log(`\n  TWO DEFENDERS INSIDE 2 m OF EACH OTHER  ${pc(S("stacked"), S("slices"))} of slices`);
