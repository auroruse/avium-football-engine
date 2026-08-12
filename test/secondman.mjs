// WHEN IS A SECOND MAN ON THE BALL ACTUALLY WORTH IT?
//
// One presser is the steady state (meDuties ~line 240), plus at most swarmMax = 1 extra body and
// only inside swarmDepth = 26 m of our own goal, plus one counter-presser in the transT window.
// Everywhere else on the pitch the carrier is faced by exactly one man.
//
// A second man is not free -- he is a man not marking somebody -- so it is worth it only where the
// carrier cannot punish it. Real football commits a second body in four situations:
//   FACING HIS OWN GOAL. He cannot turn, so he cannot beat two. The engine knows where he is facing:
//     the carrier's _drbA is the line he is taking the ball on.
//   PINNED ON A TOUCHLINE. The line defends for you; two men close the only exit.
//   THE FIRST MAN IS BEATEN. _beat is already flagged, and cover has to become containment.
//   DEEP. Already covered by swarmDepth, and the only one currently implemented.
//
// This measures how common each is, how many defenders are actually near the carrier in each, and
// what happens next -- so the trigger is chosen on evidence rather than on the list.
//
//   node test/secondman.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        ME_MATCH_TICKS, PITCH_W, STRAT_DEF, CFG } = eng;
const sq = (o,f) => buildSquad(f,null).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5,_att:null}));
const blank = () => ({ poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},
  saves:{home:0,away:0},corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,
  carries:0,clears:0,inplay:0,blocked:0,woodwork:0,shotDist:new Array(10).fill(0),xg:0,xgS:{home:0,away:0} });
const N = +(process.env.N || 24);
const ME_HALF_W = PITCH_W / 2;
const SIT = ["facing own goal", "on a touchline", "presser beaten", "in our third", "open play"];

function run(seed) {
  const s = createMatchState();
  const hs = sq(75,"4-3-3"), as = sq(75,"4-3-3");
  s.players.home = hs.filter(p=>!p.bench); s.bench.home = hs.filter(p=>p.bench);
  s.players.away = as.filter(p=>!p.bench); s.bench.away = as.filter(p=>p.bench);
  s.formations = {home:"4-3-3",away:"4-3-3"};
  s.strategy = {home:{...STRAT_DEF},away:{...STRAT_DEF}};
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = {}; for (const k of SIT) A[k] = { n: 0, pressers: 0, near6: 0, near12: 0, lost: 0, prog: 0 };
  let prev = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (mp.sp || mp.idx < 0) { prev = null; continue; }
    const atk = mp.side, def = meOther(atk);
    const c = s.players[atk][mp.idx]; if (!c) { prev = null; continue; }
    const us = s.players[def], dir = meDir(def), own = meGoalX(atk);
    // WHICH SITUATION. Checked in priority order; every slice lands in exactly one.
    const adir = meDir(atk);
    const facing = c._drbA != null ? Math.cos(c._drbA) * adir < -0.2 : false;
    const edge = Math.min(c.y, PITCH_W - c.y) < 8;
    const beaten = us.some(p => p._duty === "press" && (p._beat || 0) > 0);
    const deep = (c.x - own) * dir < CFG.swarmDepth;
    const k = facing ? SIT[0] : edge ? SIT[1] : beaten ? SIT[2] : deep ? SIT[3] : SIT[4];
    const a = A[k]; a.n++;
    for (const p of us) {
      if (p.off || p.pos === "GK") continue;
      if (p._duty === "press") a.pressers++;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < 6) a.near6++; if (d < 12) a.near12++;
    }
    // Did he get away with it? Progress toward goal this slice, and whether he lost it.
    if (prev && prev.k === k && prev.side === atk && prev.i === mp.idx)
      a.prog += (prev.d - Math.hypot(meGoalX(atk) - c.x, ME_HALF_W - c.y));
    if (prev && prev.side !== atk) A[prev.k].lost++;
    prev = { k, side: atk, i: mp.idx, d: Math.hypot(meGoalX(atk) - c.x, ME_HALF_W - c.y) };
  }
  return A;
}
const res = await parMap(Array.from({length:N},(_,i)=>i+1), run);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
console.log("");
console.log(N + " matches. Every on-ball slice lands in exactly one situation, checked in this order.");
console.log("");
console.log("  situation          share    pressers   within 6 m   within 12 m   he gains   turnovers");
console.log("  ---------------   ------   ---------   ----------   -----------   --------   ---------");
const tot = SIT.reduce((a,k)=>a+res.reduce((x,r)=>x+r[k].n,0),0) || 1;
for (const k of SIT) {
  const T = (f) => res.reduce((a,r)=>a+r[k][f],0);
  const n = T("n") || 1;
  console.log("  " + k.padEnd(15) + "   " + (f1(100*T("n")/tot)+"%").padStart(6) + "   " +
    f2(T("pressers")/n).padStart(9) + "   " + f2(T("near6")/n).padStart(10) + "   " +
    f2(T("near12")/n).padStart(11) + "   " + (f2(T("prog")/n*4)+"m/s").padStart(8) + "   " +
    f1(T("lost")/N).padStart(9));
}
console.log("");
console.log("  'pressers' is how many men the engine ASSIGNS to the ball; 'within 6 m' is how many are");
console.log("  actually close enough to be a second man if one were wanted. A situation where he gains");
console.log("  ground fast with only one presser and bodies already within six metres is one where a");
console.log("  second man is being left on the table.");
