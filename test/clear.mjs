// A man with a clear sight of goal: what does he do, by how far out he is?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meDecide,meShotP,meLaneBlock,
       meGoalX,meDir,ME_HALF_W,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const B=[0,10,16,22,30,99], L=["<10m","10-16","16-22","22-30","30m+"];
const act={}, sp=[], n=B.map(()=>0), back=B.map(()=>0);
for(const k of ["shot","carry","pass","clear","touch"]) act[k]=B.map(()=>0);
for(let seed=1;seed<=6;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0 && !mp.sp){
      const side=mp.side, p=s.players[side][mp.idx], dir=meDir(side), gx=meGoalX(side);
      const d=Math.hypot(gx-p.x,p.y-ME_HALF_W);
      const lane=meLaneBlock(s,side,p.x,p.y,gx,ME_HALF_W);
      if(d<40 && lane<0.9){                     // a genuinely clear sight of goal
        const k=B.findIndex((b,i)=>d>=b && d<B[i+1]);
        if(k>=0){ n[k]++;
          const a=meDecide(s,rng,side,mp.idx);
          if(a){ act[a.k]=act[a.k]||B.map(()=>0); act[a.k][k]++;
                 if(a.k==="pass" && (a.ax-p.x)*dir<-2) back[k]++; }
          if(k<=2) sp.push(meShotP(s,side,p,p.x,p.y));
        }
      }
    }
    meTick(s,rng,out);
  }
}
console.log("clear sight of goal, by distance:");
console.log("range     n     shoot  carry   pass   (of passes, backward)");
for(let k=0;k<L.length;k++) if(n[k])
  console.log(`${L[k].padEnd(9)}${String(n[k]).padStart(5)}  ${(100*(act.shot[k]||0)/n[k]).toFixed(0).padStart(5)}% ${(100*(act.carry[k]||0)/n[k]).toFixed(0).padStart(6)}% ${(100*(act.pass[k]||0)/n[k]).toFixed(0).padStart(6)}%   ${String(back[k]).padStart(5)}`);
console.log(`mean shot probability the engine gives a clear chance inside 22 m: ${(sp.reduce((a,b)=>a+b,0)/(sp.length||1)).toFixed(3)}`);
