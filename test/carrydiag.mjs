// The ball carrier's steering: an 8-direction greedy search, re-run every slice. How often is
// forward even a legal candidate, and how much does his chosen direction flip about?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meOffsideLine,meDir,meGoalX,ME_TPM,STRAT_DEF,CFG,PITCH_L,PITCH_W}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0, fwdBlocked=0, allBlocked=0, flips=0, held=0;
let lastDir=null, lastHolder=null, runLen=[], cur=0;
for(let seed=1;seed<=4;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<90*ME_TPM;t++){
    const mp=s.mePos;
    if(mp.idx>=0){
      const side=mp.side, p=s.players[side][mp.idx], dir=meDir(side), off=meOffsideLine(s,side);
      n++;
      // replicate the candidate filter in meShape
      let legal=0, legalFwd=0, fwdTotal=0;
      for(let k=0;k<8;k++){
        const ang=k*Math.PI/4, cx=p.x+Math.cos(ang)*CFG.carryLook, cy=p.y+Math.sin(ang)*CFG.carryLook;
        const isFwd=(cx-p.x)*dir>0.5;
        if(isFwd) fwdTotal++;
        if(cx<2||cx>PITCH_L-2||cy<2||cy>PITCH_W-2) continue;
        if((cx-off)*dir>0.4) continue;
        legal++; if(isFwd) legalFwd++;
      }
      if(fwdTotal>0 && legalFwd===0) fwdBlocked++;
      if(legal===0) allBlocked++;
      // direction churn while one man holds it
      const key=`${side}${mp.idx}`;
      const d2=Math.atan2(p._ty-p.y,p._tx-p.x);
      if(key===lastHolder){ held++; cur++;
        if(lastDir!==null && Math.abs(Math.atan2(Math.sin(d2-lastDir),Math.cos(d2-lastDir)))>Math.PI/2) flips++; }
      else { if(cur>0) runLen.push(cur); cur=0; }
      lastHolder=key; lastDir=d2;
    }
    meTick(s,rng,out);
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`slices with a man on the ball: ${n}`);
console.log(`  every FORWARD dribble direction illegal (offside clamp): ${(100*fwdBlocked/n).toFixed(0)}%`);
console.log(`  no legal direction at all:                               ${(100*allBlocked/n).toFixed(0)}%`);
console.log(`  steering reversed >90 degrees between slices:            ${(100*flips/(held||1)).toFixed(0)}% of held slices`);
console.log(`  mean unbroken time on the ball: ${(mean(runLen)/4).toFixed(2)}s`);
