// At 15-30 m: does he shoot when the route ahead is packed, and carry when it is open?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meDecide,meShotP,meLaneBlock,
       meGoalX,meDir,ME_HALF_W,ME_MATCH_TICKS,STRAT_DEF,CFG}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const G=["route ahead OPEN","route ahead PACKED"];
const n=[0,0], sh=[0,0], ca=[0,0], pa=[0,0], nb=[0,0];
for(let seed=1;seed<=6;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0 && !mp.sp){
      const side=mp.side, p=s.players[side][mp.idx], dir=meDir(side), gx=meGoalX(side);
      const d=Math.hypot(gx-p.x,p.y-ME_HALF_W);
      if(d>=15 && d<30){
        const now=meShotP(s,side,p,p.x,p.y);
        const ah=meShotP(s,side,p,p.x+dir*CFG.carryAdv,p.y);
        const better=now>ah?(now-ah)/Math.max(now,1e-4):0;
        const k=better>0.15?1:0;
        n[k]++; nb[k]+=better;
        const a=meDecide(s,rng,side,mp.idx);
        if(a?.k==="shot") sh[k]++; else if(a?.k==="carry") ca[k]++; else if(a?.k==="pass") pa[k]++;
      }
    }
    meTick(s,rng,out);
  }
}
console.log("at 15-30 m from goal:");
for(let k=0;k<2;k++) if(n[k])
  console.log(`  ${G[k].padEnd(20)} ${String(n[k]).padStart(5)}   shoot ${(100*sh[k]/n[k]).toFixed(0).padStart(3)}%  carry ${(100*ca[k]/n[k]).toFixed(0).padStart(3)}%  pass ${(100*pa[k]/n[k]).toFixed(0).padStart(3)}%   (chance is ${(100*nb[k]/n[k]).toFixed(0)}% worse if he goes on)`);
