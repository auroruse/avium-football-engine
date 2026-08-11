// Who actually takes the next touch after a pass is struck? If it is the man who struck it, the
// white line on screen is a pass that never happened.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0,
  shotDist:new Array(10).fill(0)};
const rng=new RNG(15);
let kicker=null, kickTick=0, kickX=0, kickY=0;
let self=0, other=0, opp=0, dead=0;
const selfLag=[], selfDist=[];
// carry: how long does one man hold the ball, and how far does he take it?
let holder=null, holdFrom=0, holdX=0, holdY=0;
const holdLen=[], carryDist=[];
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos, before=mp.idx>=0?`${mp.side}${mp.idx}`:null;
  meTick(s,rng,out);
  const after=mp.idx>=0?`${mp.side}${mp.idx}`:null;
  // possession spell bookkeeping
  if(after!==holder){
    if(holder!=null){ holdLen.push(t-holdFrom); carryDist.push(Math.hypot(mp.bx-holdX,mp.by-holdY)); }
    holder=after; holdFrom=t; holdX=mp.bx; holdY=mp.by;
  }
  if(before && !after && mp.passPending){        // a pass was just struck
    kicker=before; kickTick=t; kickX=mp.bx; kickY=mp.by;
  } else if(kicker && after){
    const lag=t-kickTick;
    if(after===kicker){ self++; selfLag.push(lag); selfDist.push(Math.hypot(mp.bx-kickX,mp.by-kickY)); }
    else if(after[0]===kicker[0]) other++; else opp++;
    kicker=null;
  } else if(kicker && !mp.flight && !after){ dead++; kicker=null; }
}
const mean=(a)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const tot=self+other+opp+dead||1;
console.log(`passes struck, next touch taken by:`);
console.log(`  the man who struck it  ${self}  (${(100*self/tot).toFixed(0)}%)  after ${mean(selfLag).toFixed(1)} slices, ball ${mean(selfDist).toFixed(1)} m away`);
console.log(`  a team-mate            ${other}  (${(100*other/tot).toFixed(0)}%)`);
console.log(`  an opponent            ${opp}  (${(100*opp/tot).toFixed(0)}%)`);
console.log(`  nobody / dead ball     ${dead}  (${(100*dead/tot).toFixed(0)}%)`);
console.log(`possession spells: ${holdLen.length}, mean ${(mean(holdLen)/4).toFixed(2)} s on the ball, ball moved ${mean(carryDist).toFixed(1)} m`);
console.log(`shots ${out.shots.home}/${out.shots.away}  goals ${out.goals.home}/${out.goals.away}  passes ${out.passes}  dist ${out.shotDist.join(",")}`);
