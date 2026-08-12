process.env.QUIET="1";
import { parMap } from "./par.mjs";
const e = await import("./engine.mjs");
const { RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF,CFG } = e;
const sq=(o,f)=>buildSquad(f,null).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5,_att:null}));
const bl=()=>({poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},
 saves:{home:0,away:0},corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,
 carries:0,clears:0,inplay:0,blocked:0,woodwork:0,shotDist:new Array(10).fill(0),xg:0,xgS:{home:0,away:0}});
const N=+(process.env.N||20);
const G=(process.env.GO||"").split(",").filter(Boolean).map(Number);
function run([go,seed]){ if(go) CFG.tkGo=go;
  const s=createMatchState(); const h=sq(75,"4-3-3"),a=sq(75,"4-3-3");
  s.players.home=h.filter(p=>!p.bench); s.bench.home=h.filter(p=>p.bench);
  s.players.away=a.filter(p=>!p.bench); s.bench.away=a.filter(p=>p.bench);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}};
  s.possession="home"; meInit(s,pitchSlots);
  const o=bl(),r=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++) meTick(s,r,o);
  return {try:o.tackleTry||0,win:o.tackleWon||0,beat:o.beaten||0,goals:o.goals.home+o.goals.away,
          shots:o.shots.home+o.shots.away,comp:o.passes?o.passOk/o.passes:0,fouls:o.fouls.home+o.fouls.away};
}
const cells=G.length?G:[CFG.tkGo];
const jobs=[]; for(const g of cells) for(let i=1;i<=N;i++) jobs.push([g,i]);
const res=await parMap(jobs,run); if(!res) process.exit(0);
const f=(x)=>x.toFixed(1);
console.log("\n  tkGo   attempts/side   won%   beaten/side   goals/side   shots/side   pass%   fouls/side");
for(let ci=0;ci<cells.length;ci++){
  const r=res.slice(ci*N,ci*N+N).filter(Boolean), m=(k)=>r.reduce((a,x)=>a+x[k],0)/r.length;
  console.log("  "+String(cells[ci]).padStart(4)+"   "+f(m("try")/2).padStart(13)+"   "+
    f(100*m("win")/(m("try")||1)).padStart(4)+"   "+f(m("beat")/2).padStart(11)+"   "+
    f(m("goals")/2).padStart(10)+"   "+f(m("shots")/2).padStart(10)+"   "+
    f(100*m("comp")).padStart(5)+"   "+f(m("fouls")/2).padStart(10));
}
