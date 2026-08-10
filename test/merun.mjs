const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
           corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
const rng=new RNG(5); const runs={}; let active=0,n=0;
for(let t=0;t<90*ME_TPM;t++){ meTick(s,rng,out);
  for(const sd of ["home","away"]) for(const p of s.players[sd]) if(p._runT===14) runs[p._run]=(runs[p._run]||0)+1;
  if(t%10===0){ active += ["home","away"].reduce((a,sd)=>a+s.players[sd].filter(p=>p._runT>0).length,0); n++; } }
console.log("runs started over the match: " + (Object.keys(runs).length? Object.entries(runs).map(([k,v])=>`${k} ${v}`).join("  ") : "NONE"));
console.log(`players making a run at any moment: ${(active/n).toFixed(2)}`);
