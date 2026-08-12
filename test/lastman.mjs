// ARE THE DEFENDERS GOAL-SIDE TO BEGIN WITH?
//
// Marking can only ever be a recovery. If the block's deepest band already sits further from goal
// than the men it is marking, every marker starts beaten and no target, however correct, is
// reachable -- measured, the mark target is now goal-side 98.3% of the time and the defender only
// 63.4%, and that difference is entirely this.
//
// So this asks the prior question: under siege, where is the last outfielder, and how many
// opponents are behind him? Then it sweeps the two constants that decide it -- blkHug, how close to
// its own goal the deepest band may sit as a fraction of the ball's own depth, and blkDepthLow, the
// block's front-to-back spread when it is camped.
//
//   node test/lastman.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        meAdded, ME_MATCH_TICKS, PITCH_W, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 },
  offside: { home: 0, away: 0 } });

const N = +(process.env.N || 16);
const ME_HALF_W = PITCH_W / 2;
const CELLS = [];
for (const hug of [1.0, 0.7, 0.55, 0.4]) for (const dep of [15, 21]) CELLS.push({ hug, dep });

function run([cell, seed]) {
  CFG.blkHug = cell.hug; CFG.blkDepthLow = cell.dep;
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { siege: 0, behind: 0, atk: 0, last: 0, spread: 0, inBox: 0, goalSide: 0, pairs: 0 };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (mp.sp || mp.idx < 0) continue;
    const atk = mp.side, def = meOther(atk);
    const us = s.players[def], them = s.players[atk];
    const dir = meDir(def), own = meGoalX(atk);
    const ballDepth = (mp.bx - own) * dir;
    // every marked pair, wherever the ball is
    for (const p of us) {
      if (p.off || p._duty !== "mark" || p._mk < 0) continue;
      const q = them[p._mk]; if (!q || q.off) continue;
      A.pairs++; if ((q.x - p.x) * dir > 0) A.goalSide++;
    }
    if (ballDepth >= 28) continue;                       // under siege only, as regress defines it
    A.siege++;
    const ds = us.filter(p => p.pos !== "GK" && !p.off).map(p => (p.x - own) * dir);
    if (!ds.length) continue;
    const lastMan = Math.max(...ds);                     // the deepest is the SMALLEST depth
    const deepest = Math.min(...ds);
    A.last += deepest;
    A.inBox += ds.filter(d => d < 18).length;
    const bl = us.filter(p => p.pos === "DEF" || p.pos === "MID").map(p => (p.x - own) * dir);
    if (bl.length) A.spread += Math.max(...bl) - Math.min(...bl);
    for (let j = 0; j < them.length; j++) {
      const q = them[j];
      if (q.pos === "GK" || q.off || j === mp.idx) continue;
      if ((q.x - own) * dir > 28) continue;              // only men who are actually in our third
      A.atk++;
      if ((q.x - own) * dir < deepest) A.behind++;        // nearer our goal than our deepest man
    }
  }
  const tot = (out.shots.home + out.shots.away) || 1;
  A.goals = out.goals.home + out.goals.away;
  A.shots = tot; A.off = out.offside.home + out.offside.away;
  A.inplay = out.inplay / (ME_MATCH_TICKS + meAdded(s));
  return A;
}

const jobs = [];
for (const c of CELLS) for (let i = 1; i <= N; i++) jobs.push([c, i]);
const res = await parMap(jobs, run);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);

console.log(`\n${N} matches a cell. "behind" = opponents in our own third who are nearer our goal`);
console.log(`than our deepest outfielder is. Real defending: close to zero.\n`);
console.log(`  blkHug  depth   behind   deepest   block spread   in box   goal-side   offside   goals`);
console.log(`  ------  -----   ------   -------   ------------   ------   ---------   -------   -----`);
for (let ci = 0; ci < CELLS.length; ci++) {
  const r = res.slice(ci * N, ci * N + N).filter(Boolean);
  const T = (k) => r.reduce((a, x) => a + x[k], 0);
  const c = CELLS[ci];
  console.log(`  ${String(c.hug).padStart(6)}  ${String(c.dep).padStart(5)}   ` +
    `${(f1(100 * T("behind") / (T("atk") || 1)) + "%").padStart(6)}   ` +
    `${(f1(T("last") / (T("siege") || 1)) + "m").padStart(7)}   ` +
    `${(f1(T("spread") / (T("siege") || 1)) + "m").padStart(12)}   ` +
    `${f1(T("inBox") / (T("siege") || 1)).padStart(6)}   ` +
    `${(f1(100 * T("goalSide") / (T("pairs") || 1)) + "%").padStart(9)}   ` +
    `${f1(T("off") / r.length / 2).padStart(7)}   ` +
    `${f1(T("goals") / r.length / 2).padStart(5)}`);
}
console.log(`\n  Targets: block spread 18-26 m, defenders in box 4.5-7 of 10, offsides 1.5-3.5 a side,`);
console.log(`  goals 0.8-3 a side. blkHug 1.0 is the old behaviour -- blkMin's flat ten-metre floor.`);
