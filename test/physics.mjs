process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meBallStep,meBallPredict,
       ME_MATCH_TICKS,ME_SIM_MIN,STRAT_DEF,CFG,meAttrs,meSpeed}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
// ---- ball: how far does it roll, and how long until it stops?
console.log("BALL ON GRASS");
for(const v0 of [5,10,15,20]){
  const b={bx:0,by:34,bz:CFG.ballR,bvx:v0,bvy:0,bvz:0,pred:null};
  let t=0;
  while(Math.hypot(b.bvx,b.bvy)>0.15 && t<40){ meBallStep(b,0.25); t+=0.25; }
  console.log(`  struck at ${String(v0).padStart(2)} m/s -> rolls ${b.bx.toFixed(1)} m, stops after ${t.toFixed(1)} s`);
}
console.log("  real grass: 15 m/s rolls about 25-30 m and takes 4-5 s");
// ---- players: how fast do they actually move over a match?
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0,sum=0,hi=0,vhi=0,still=0,dist=0;
for(let seed=1;seed<=4;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    meTick(s,rng,out);
    for(const sd of ["home","away"]) for(const p of s.players[sd]){
      const v=Math.hypot(p.vx||0,p.vy||0)/0.25;
      n++; sum+=v; dist+=v*0.25; if(v>5.5) hi++; if(v>7) vhi++; if(v<0.5) still++;
    }
  }
}
console.log("\nPLAYERS");
console.log(`  mean speed ${(sum/n).toFixed(2)} m/s   (real match average ~1.8-2.2)`);
console.log(`  above 5.5 m/s on ${(100*hi/n).toFixed(0)}% of slices, above 7 on ${(100*vhi/n).toFixed(0)}%   (real: ~3% and under 1%)`);
console.log(`  standing still (<0.5 m/s) ${(100*still/n).toFixed(0)}%   (real: a lot -- walking and standing is most of a match)`);
console.log(`  ground covered per player per match: ${(dist/(n/22/1)/1000*0+dist/22/4/1000).toFixed(2)} km over ${ME_SIM_MIN} real minutes`);
