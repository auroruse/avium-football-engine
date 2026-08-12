// HOW HIGH MUST IT STILL BE A SLICE FROM NOW?
//
// Target is 12-15 headers a match, not the 30-45 of a real ninety minutes: this match produces
// about a fifth of a real one's event volume (104 passes a side against a real 500), so every count
// scales with it. At 21.0 the engine heads roughly 1.7x too much.
//
//   node test/headhold.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        ME_MATCH_TICKS, PITCH_W, STRAT_DEF, CFG } = eng;
const sq = (o,f) => buildSquad(f,null).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5,_att:null}));
const blank = () => ({ poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},
  saves:{home:0,away:0},corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,
  carries:0,clears:0,inplay:0,blocked:0,woodwork:0,shotDist:new Array(10).fill(0),xg:0,xgS:{home:0,away:0},feed:[],min:0 });
const N = +(process.env.N || 20);
const CELLS = [0, 0.2, 0.4, 0.6];

function run([hz, seed]) {
  CFG.headHoldZ = hz;
  const s = createMatchState();
  const hs = sq(75,"4-3-3"), as = sq(75,"4-3-3");
  s.players.home = hs.filter(p=>!p.bench); s.bench.home = hs.filter(p=>p.bench);
  s.players.away = as.filter(p=>!p.bench); s.bench.away = as.filter(p=>p.bench);
  s.formations = {home:"4-3-3",away:"4-3-3"};
  s.strategy = {home:{...STRAT_DEF},away:{...STRAT_DEF}};
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { on: 0, clear: 0, kept: 0, lost: 0, outp: 0, prog: [] };
  let watch = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    const f = out.feed[0]; out.feed.length = 0;
    if (f && /heads it/.test(f.txt || "")) {
      const on = /heads it on/.test(f.txt);
      if (on) { A.on++; watch = { side: f.side, x0: mp.bx, dir: meDir(f.side), t }; } else A.clear++;
    }
    if (watch) {
      if (mp.sp) { A.outp++; A.prog.push((mp.bx - watch.x0) * watch.dir); watch = null; }
      else if (mp.idx >= 0) { if (mp.side === watch.side) A.kept++; else A.lost++;
                              A.prog.push((mp.bx - watch.x0) * watch.dir); watch = null; }
      else if (t - watch.t > 40) watch = null;
    }
  }
  A.goals = out.goals.home + out.goals.away; A.shots = out.shots.home + out.shots.away;
  A.clears = out.clears; A.comp = out.passes ? out.passOk / out.passes : 0;
  return A;
}
const jobs = []; for (const c of CELLS) for (let i = 1; i <= N; i++) jobs.push([c, i]);
const all = await parMap(jobs, run); if (!all) process.exit(0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
console.log("");
console.log(N + " matches a cell. Target 12-15 headers at this engine's event volume.");
console.log("");
console.log("  headHoldZ   headers   knock-downs   kept%   out%   gained   goals/side   shots/side   pass%");
console.log("  ---------   -------   -----------   -----   ----   ------   ----------   ----------   -----");
for (let ci = 0; ci < CELLS.length; ci++) {
  const r = all.slice(ci * N, ci * N + N).filter(Boolean);
  const T = (k) => r.reduce((a, x) => a + x[k], 0), m = (k) => T(k) / r.length;
  const set = T("kept") + T("lost") + T("outp") || 1;
  const pr = r.flatMap(x => x.prog).sort((a, b) => a - b);
  console.log("  " + String(CELLS[ci]).padStart(9) + "   " + f1(m("on") + m("clear")).padStart(7) +
    "   " + f1(m("on")).padStart(11) + "   " + (f1(100 * T("kept") / set) + "%").padStart(5) +
    "   " + (f1(100 * T("outp") / set) + "%").padStart(4) +
    "   " + (f1(pr.length ? pr[pr.length >> 1] : 0) + "m").padStart(6) +
    "   " + f2(m("goals") / 2).padStart(10) + "   " + f1(m("shots") / 2).padStart(10) +
    "   " + f1(100 * m("comp")).padStart(5));
}
