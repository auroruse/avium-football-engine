// Balls played in behind: who actually gets them?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,ME_TPM,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0,toGK=0,toMate=0,toOther=0;
for(let seed=1;seed<=6;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed); let live=null;
  for(let t=0;t<90*ME_TPM;t++){
    const mp=s.mePos, had=mp.idx>=0, hs=mp.side;
    meTick(s,rng,out);
    // a pass aimed into the final 25 m
    if(had && mp.idx<0 && mp.passPending && Math.abs(mp.fx??mp.bx)>=0){
      const j=mp.fj, tgt=j>=0?s.players[hs][j]:null;
      if(tgt && Math.abs(meGoalX(hs)-tgt.x)<25) live={side:hs};
    } else if(live){
      if(mp.idx>=0){ n++;
        const p=s.players[mp.side][mp.idx];
        if(mp.side!==live.side && p.pos==="GK") toGK++;
        else if(mp.side===live.side) toMate++; else toOther++;
        live=null;
      } else if(!mp.flight) live=null;
    }
  }
}
console.log(`balls played into the final 25 m: ${n}`);
console.log(`  reached a team-mate       ${toMate}  (${(100*toMate/n).toFixed(0)}%)`);
console.log(`  straight to the keeper    ${toGK}  (${(100*toGK/n).toFixed(0)}%)`);
console.log(`  cut out by an outfielder  ${toOther}  (${(100*toOther/n).toFixed(0)}%)`);
