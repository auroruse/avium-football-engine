// THE DWELL TAX, NOT THE TOUCH BUDGET.
//
// The carrier releases the ball after a median 1.00 s and 91.4% of releases are FORCED by the touch
// budget expiring. Raising the budget (holdBase) lengthens his spells, but every holdBase cell
// measured DEGRADES how much of the ground he covers is actually toward goal. Killing the dwell tax
// was the only cell that improved it: net approach per metre carried 29% -> 32%, spells gaining
// 20 m or more +89%, xG 0.47 -> 0.70. This is the complaint -- a man with grass in front of him who
// does not take it -- so this sweeps the tax rather than the budget.
//
// dwellDrop compounds against the carry's success probability once he has held it longer than an
// ordinary player would (decide.ts:295). 1.0 removes it entirely.
//
//   node test/dwellsweep2.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX,
        ME_MATCH_TICKS, PITCH_L, PITCH_W, STRAT_DEF, CFG } = eng;
const sq = (o,f) => buildSquad(f,null).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5,_att:null}));
const blank = () => ({ poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},
  saves:{home:0,away:0},corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,
  carries:0,clears:0,inplay:0,blocked:0,woodwork:0,shotDist:new Array(10).fill(0),xg:0,xgS:{home:0,away:0} });
const N = +(process.env.N || 20);
const CELLS = [0.97, 0.99, 1.0];
const ME_HALF_W = PITCH_W / 2;

function run([dd, seed]) {
  CFG.dwellDrop = dd;
  const s = createMatchState();
  const hs = sq(75,"4-3-3"), as = sq(75,"4-3-3");
  s.players.home = hs.filter(p=>!p.bench); s.bench.home = hs.filter(p=>p.bench);
  s.players.away = as.filter(p=>!p.bench); s.bench.away = as.filter(p=>p.bench);
  s.formations = {home:"4-3-3",away:"4-3-3"};
  s.strategy = {home:{...STRAT_DEF},away:{...STRAT_DEF}};
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  // A SPELL: one unbroken possession by one man. Track path length and net approach to goal.
  let cur = null, spells = 0, path = 0, approach = 0, hold = 0, big = 0, idle = 0, wedge = 0;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    meTick(s, rng, out);
    const mp = s.mePos;
    const own = mp.idx >= 0 && !mp.sp ? { side: mp.side, i: mp.idx } : null;
    if (own) {
      const p = s.players[own.side][own.i], gx = meGoalX(own.side), dir = meDir(own.side);
      const dG = Math.hypot(gx - p.x, ME_HALF_W - p.y);
      if (!cur || cur.side !== own.side || cur.i !== own.i) {
        if (cur) { spells++; path += cur.path; approach += cur.d0 - cur.dLast; hold += cur.t;
                   if (cur.d0 - cur.dLast >= 20) big++; }
        cur = { side: own.side, i: own.i, x: p.x, y: p.y, d0: dG, dLast: dG, path: 0, t: 0 };
      }
      cur.path += Math.hypot(p.x - cur.x, p.y - cur.y);
      cur.x = p.x; cur.y = p.y; cur.dLast = dG; cur.t++;
      // THE COMPLAINT POPULATION: opponents' half, a clear 12 m wedge ahead, and he is not going.
      if ((p.x - PITCH_L / 2) * dir > 0) {
        let clear = true;
        for (const q of s.players[own.side === "home" ? "away" : "home"]) {
          if (q.off || q.pos === "GK") continue;
          const ax = (q.x - p.x) * dir, ay = q.y - p.y;
          if (ax > 0 && ax < 12 && Math.abs(ay) < ax * 0.58) { clear = false; break; }
        }
        if (clear) { wedge++; if ((p.vx || 0) * dir / 0.25 < 1) idle++; }
      }
    } else if (cur) { spells++; path += cur.path; approach += cur.d0 - cur.dLast; hold += cur.t;
                      if (cur.d0 - cur.dLast >= 20) big++; cur = null; }
  }
  return { spells, path, approach, hold, big, idle, wedge,
           goals: out.goals.home + out.goals.away, shots: out.shots.home + out.shots.away,
           xg: out.xg || 0, comp: out.passes ? out.passOk / out.passes : 0 };
}
const jobs = []; for (const c of CELLS) for (let i = 1; i <= N; i++) jobs.push([c, i]);
const res = await parMap(jobs, run); if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
console.log(`\n${N} matches a cell. A "spell" is one unbroken possession by one man.\n`);
console.log(`  dwellDrop   hold/spell   path/spell   approach   toward-goal   20m+ spells   wedge&idle   xG    goals`);
console.log(`  ---------   ----------   ----------   --------   -----------   -----------   ----------   ---   -----`);
for (let ci = 0; ci < CELLS.length; ci++) {
  const r = res.slice(ci*N, ci*N+N).filter(Boolean);
  const m = (k) => r.reduce((a,x)=>a+x[k],0)/r.length;
  console.log(`  ${String(CELLS[ci]).padStart(9)}   ${(f2(m("hold")/m("spells")/4)+"s").padStart(10)}   ` +
    `${(f1(m("path")/m("spells"))+"m").padStart(10)}   ${(f1(m("approach")/m("spells"))+"m").padStart(8)}   ` +
    `${(f1(100*m("approach")/m("path"))+"%").padStart(11)}   ${f1(m("big")/2).padStart(11)}   ` +
    `${(f1(100*m("idle")/(m("wedge")||1))+"%").padStart(10)}   ${f2(m("xg")).padStart(3)}   ${f1(m("goals")/2).padStart(5)}`);
}
