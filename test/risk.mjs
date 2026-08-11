// Do the passes players CHOOSE actually survive? Model estimate vs what physically happens.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(12);
for(let t=0;t<90*ME_TPM;t++) meTick(s,rng,out);
console.log(`passes ${out.passes}  completed ${(100*out.passOk/Math.max(1,out.passes)).toFixed(0)}%  (real ~80%)`);
console.log(`shots ${out.shots.home+out.shots.away}  goals ${out.goals.home+out.goals.away}  corners ${out.corners.home+out.corners.away}  fouls ${out.fouls.home+out.fouls.away}  in-play ${(out.inplay/ME_TPM).toFixed(0)}m`);
