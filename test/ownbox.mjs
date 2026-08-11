// Defenders and keepers playing out of their own third: what do they choose, and what happens?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meDecide,meGoalX,meOther,meDir,
       ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0, hi=0, thru=0, back=0, clr=0, carry=0, shot=0;
let live=null, att=0, lost=0, lostHi=0, attHi=0;
for(let seed=1;seed<=6;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    let inOwn=false;
    if(mp.idx>=0 && !mp.sp){
      const side=mp.side, p=s.players[side][mp.idx], dir=meDir(side);
      const own=meGoalX(meOther(side)), depth=(p.x-own)*dir;
      if(depth<25){                                   // his own third
        inOwn=true; n++;
        const a=meDecide(s,rng,side,mp.idx);
        if(a?.k==="pass"){ if(a.high) hi++; if(a.thru) thru++;
                           if((a.ax-p.x)*dir<-2) back++; }
        else if(a?.k==="clear"||a?.k==="touch") clr++;
        else if(a?.k==="carry") carry++;
        else if(a?.k==="shot") shot++;
      }
    }
    const hadIdx=mp.idx, hadSide=mp.side, wasOwn=inOwn;
    meTick(s,rng,out);
    if(hadIdx>=0 && mp.idx<0 && mp.passPending && wasOwn){ live={side:hadSide,high:mp.bvz>1}; att++; if(live.high) attHi++; }
    else if(live){
      if(mp.idx>=0){ if(mp.side!==live.side){ lost++; if(live.high) lostHi++; } live=null; }
      else if(!mp.flight) live=null;
    }
  }
}
console.log(`on the ball in his own third: ${n} slices`);
console.log(`  chose: pass ${(100*(hi+thru+back+ (n-hi-thru-back-clr-carry-shot))/n).toFixed(0)}%  clear ${(100*clr/n).toFixed(0)}%  carry ${(100*carry/n).toFixed(0)}%`);
console.log(`  of those passes: LOFTED ${hi}, into space ${thru}, backward ${back}`);
console.log(`passes played out of the own third: ${att}, lost ${lost} (${(100*lost/(att||1)).toFixed(0)}%)`);
console.log(`  of the lofted ones: ${attHi} played, ${lostHi} lost (${(100*lostHi/(attHi||1)).toFixed(0)}%)`);
