// THE DEFENDER WHO GETS BEATEN AND THEN MARKS SOMEBODY ELSE.
//
// meDuties recomputes every duty from scratch every tick and keeps no memory of what a man was
// doing a quarter of a second ago. The marking assignment is a Hungarian on CURRENT distance, so the
// instant a carrier goes past a defender, that defender is standing upfield of him and near some
// other attacker -- and the assignment reads him as well placed to mark that other man.
//
// This finds every moment a carrier goes past a defender and follows THAT DEFENDER for the next two
// seconds: what job he is given, whether he is still involved with the man who beat him, and which
// way he is running.
//
//   node test/gaveup.mjs
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
const FORMS = (process.env.FORMS || "4-3-3,3-4-3,5-3-2").split(",");
const ME_HALF_W = PITCH_W / 2;
const WATCH = 8;                       // two seconds

function run([form, seed]) {
  const s = createMatchState();
  const hs = sq(75, form), as = sq(75, form);
  s.players.home = hs.filter(p=>!p.bench); s.bench.home = hs.filter(p=>p.bench);
  s.players.away = as.filter(p=>!p.bench); s.bench.away = as.filter(p=>p.bench);
  s.formations = {home:form, away:form};
  s.strategy = {home:{...STRAT_DEF},away:{...STRAT_DEF}};
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { beaten: 0, duty: {}, stillOn: 0, markedOther: 0, chasing: 0, away: 0, watched: 0,
              // coverage, measured independently of all that
              covSlices: 0, inBox: 0, backBand: 0, boxFree: 0, boxMen: 0 };
  let watch = [];
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const pre = mp.idx >= 0 && !mp.sp ? { side: mp.side, x: mp.bx, y: mp.by } : null;
    const preD = pre ? s.players[meOther(pre.side)].map(p => (p.x - pre.x) * meDir(meOther(pre.side))) : null;
    meTick(s, rng, out);
    if (mp.sp || mp.idx < 0) { watch = []; continue; }
    const atk = mp.side, def = meOther(atk), us = s.players[def], dir = meDir(def);
    const c = s.players[atk][mp.idx];
    // BEATEN: he was goal-side of the ball a slice ago and is not now.
    if (pre && pre.side === atk && preD) {
      for (let i = 0; i < us.length; i++) {
        const p = us[i];
        if (p.off || p.pos === "GK") continue;
        const was = preD[i] < 0, now = (p.x - mp.bx) * dir < 0;
        if (was && !now && Math.hypot(p.x - mp.bx, p.y - mp.by) < 12) {
          A.beaten++; watch.push({ i, t, mk0: c });
        }
      }
    }
    // ...and what he does for the next two seconds.
    watch = watch.filter(w => {
      if (t - w.t > WATCH) return false;
      const p = us[w.i]; if (!p || p.off) return false;
      A.watched++;
      A.duty[p._duty] = (A.duty[p._duty] || 0) + 1;
      const onHim = (p._duty === "press") || (p._duty === "mark" && s.players[atk][p._mk] === w.mk0);
      if (onHim) A.stillOn++;
      else if (p._duty === "mark" && p._mk >= 0) A.markedOther++;
      // which way is he running: toward his own goal, or not
      const own = meGoalX(atk);
      if ((p.vx || 0) * dir < -0.02) A.chasing++; else A.away++;
      return true;
    });
    // COVERAGE, while defending, independent of the above.
    {
      const own = meGoalX(atk);
      A.covSlices++;
      const ds = us.filter(p => p.pos !== "GK" && !p.off).map(p => (p.x - own) * dir);
      A.inBox += ds.filter(d => d < 18).length;
      A.backBand += ds.filter(d => d < 24).length;
      for (const q of s.players[atk]) {
        if (q.pos === "GK" || q.off) continue;
        if (Math.abs(q.x - own) > CFG.gkBoxR || Math.abs(q.y - ME_HALF_W) > CFG.boxHalfW) continue;
        A.boxMen++;
        if (!us.some(p => !p.off && p.pos !== "GK" && (q.x - p.x) * dir > 0
                          && Math.hypot(p.x - q.x, p.y - q.y) < 6)) A.boxFree++;
      }
    }
  }
  A.goals = out.goals.home + out.goals.away;
  return A;
}
const jobs = []; for (const f of FORMS) for (let i = 1; i <= N; i++) jobs.push([f, i]);
const all = await parMap(jobs, run); if (!all) process.exit(0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
console.log("");
console.log(N + " matches a formation, both sides on the same shape.");
for (let fi = 0; fi < FORMS.length; fi++) {
  const r = all.slice(fi*N, fi*N+N).filter(Boolean);
  const T = (k) => r.reduce((a,x)=>a+x[k],0);
  const w = T("watched") || 1;
  const D = {}; for (const x of r) for (const [k,v] of Object.entries(x.duty)) D[k]=(D[k]||0)+v;
  console.log("");
  console.log("  " + FORMS[fi] + "   beaten " + f1(T("beaten")/N) + " a match; for two seconds afterwards he was:");
  console.log("      still on the man who beat him   " + (f1(100*T("stillOn")/w)+"%").padStart(6));
  console.log("      marking somebody ELSE           " + (f1(100*T("markedOther")/w)+"%").padStart(6));
  console.log("      running back toward his goal    " + (f1(100*T("chasing")/w)+"%").padStart(6));
  console.log("      duties: " + Object.entries(D).sort((a,b)=>b[1]-a[1])
    .map(([k,v]) => k + " " + f1(100*v/w) + "%").join(", "));
  console.log("      COVERAGE   defenders inside the box " + f2(T("inBox")/(T("covSlices")||1)) +
    " of 10 (want 4.5-7)   within 24 m " + f2(T("backBand")/(T("covSlices")||1)) +
    "   men in our box with nobody goal-side " + f1(100*T("boxFree")/(T("boxMen")||1)) + "%");
}
