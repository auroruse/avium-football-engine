process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meDecide,meGoalX,meDir,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const zone=[0,0,0,0]; let n=0;                       // by distance from the goal being ATTACKED
let fwd=0,sq2=0,back=0,fsum=0,np=0;
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0 && !mp.sp){
      const d=Math.abs(meGoalX(mp.side)-mp.bx);
      zone[d<25?0:d<45?1:d<70?2:3]++; n++;
      const p=s.players[mp.side][mp.idx], dir=meDir(mp.side);
      const act=meDecide(s,rng,mp.side,mp.idx);
      if(act && act.k==="pass"){
        const g=(act.ax-p.x)*dir; np++; fsum+=g;
        if(g>4) fwd++; else if(g<-4) back++; else sq2++;
      }
    }
    meTick(s,rng,out);
  }
}
console.log(`on-ball slices by distance from the goal they ATTACK:`);
console.log(`  inside 25 m  ${(100*zone[0]/n).toFixed(1)}%   25-45 m ${(100*zone[1]/n).toFixed(1)}%   45-70 m ${(100*zone[2]/n).toFixed(1)}%   70 m+ ${(100*zone[3]/n).toFixed(1)}%`);
console.log(`  real football: roughly 8% / 22% / 40% / 30%`);
console.log(`passes chosen: forward ${(100*fwd/np).toFixed(0)}%  square ${(100*sq2/np).toFixed(0)}%  backward ${(100*back/np).toFixed(0)}%`);
console.log(`  mean ground gained per pass: ${(fsum/np).toFixed(2)} m   (real: about +4 m)`);
