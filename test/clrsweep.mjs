process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {CFG,RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meDecide,meGoalX,meOther,meDir,
       ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
function m(){
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
  let n=0,clr=0,fwd=0,bak=0,car=0,live=null,att=0,lost=0;
  for(let seed=1;seed<=4;seed++){
    const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
    s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
    const rng=new RNG(seed);
    for(let t=0;t<ME_MATCH_TICKS;t++){
      const mp=s.mePos; let own3=false;
      if(mp.idx>=0 && !mp.sp){
        const side=mp.side,p=s.players[side][mp.idx],dir=meDir(side);
        if((p.x-meGoalX(meOther(side)))*dir<25){
          own3=true; n++;
          const a=meDecide(s,rng,side,mp.idx);
          if(a?.k==="clear"||a?.k==="touch") clr++;
          else if(a?.k==="carry") car++;
          else if(a?.k==="pass"){ if((a.ax-p.x)*dir>3) fwd++; else if((a.ax-p.x)*dir<-3) bak++; }
        }
      }
      const hi=mp.idx,hs=mp.side,wo=own3;
      meTick(s,rng,out);
      if(hi>=0&&mp.idx<0&&mp.passPending&&wo){ live={side:hs}; att++; }
      else if(live){ if(mp.idx>=0){ if(mp.side!==live.side) lost++; live=null; } else if(!mp.flight) live=null; }
    }
  }
  return {clr:100*clr/n, fwd:100*fwd/n, bak:100*bak/n, car:100*car/n, lost:100*lost/(att||1),
          shots:(out.shots.home+out.shots.away)/8, goals:(out.goals.home+out.goals.away)/8};
}
console.log("clearRelief | in own third: clear  fwd-pass  back-pass  carry | lost playing out | shots goals");
for(const c of [0.115,0.07,0.04,0.02]){
  CFG.clearRelief=c; const r=m();
  console.log(`${String(c).padStart(11)} |               ${r.clr.toFixed(0).padStart(3)}%     ${r.fwd.toFixed(0).padStart(4)}%      ${r.bak.toFixed(0).padStart(4)}%   ${r.car.toFixed(0).padStart(4)}% |            ${r.lost.toFixed(0).padStart(3)}% | ${r.shots.toFixed(1).padStart(5)} ${r.goals.toFixed(2).padStart(5)}`);
}
