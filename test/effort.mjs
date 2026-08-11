process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0, closing=0, running=0, both=0;
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const rng=new RNG(3);
for(let t=0;t<ME_MATCH_TICKS;t++){
  meTick(s,rng,out);
  for(const sd of ["home","away"]) for(const p of s.players[sd]){
    n++; const c=!!p._closing, r=(p._runT??0)>0;
    if(c) closing++; if(r) running++; if(c||r) both++;
  }
}
console.log(`player-slices: ${n}`);
console.log(`  flagged _closing (bypasses the effort limits): ${(100*closing/n).toFixed(0)}%`);
console.log(`  making a committed run:                        ${(100*running/n).toFixed(0)}%`);
console.log(`  exempt from the lazy gate one way or another:  ${(100*both/n).toFixed(0)}%`);
