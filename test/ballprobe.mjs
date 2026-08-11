// What share of the match does the ball actually obey physics, and what share is it teleported?
process.env.QUIET = "1";
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
const rng=new RNG(11); let phys=0, held=0, dead=0, air=0, maxZ=0, total=0;
for(let t=0;t<90*ME_TPM;t++){
  meTick(s,rng,out); total++;
  if (s.mePos.dead>0) dead++;
  else if (s.mePos.idx>=0) held++;
  else { phys++; if (s.mePos.bz>0.35) air++; if (s.mePos.bz>maxZ) maxZ=s.mePos.bz; }
}
console.log(`ticks: ${total}   dead ${(100*dead/total).toFixed(0)}%   held by a player ${(100*held/total).toFixed(0)}%   free & integrating ${(100*phys/total).toFixed(0)}%`);
console.log(`of the free ticks, airborne (z>0.35m): ${(100*air/Math.max(1,phys)).toFixed(0)}%   max height reached: ${maxZ.toFixed(2)} m`);
console.log(`shots ${out.shots.home+out.shots.away}   goals ${out.goals.home+out.goals.away}  <- every one of these resolved by a dice roll, not by the ball`);
