const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5}));
const one=()=>{const s=createMatchState();s.players.home=sq(75);s.players.away=sq(72);
  s.formations={home:"4-3-3",away:"4-3-3"};s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}};s.possession="home";meInit(s, pitchSlots);
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0};
  const rng=new RNG(3); for(let t=0;t<90*ME_TPM;t++) meTick(s,rng,out); return out;};
for(let i=0;i<12;i++) one();
const N=40, t0=process.hrtime.bigint(); for(let i=0;i<N;i++) one();
const ms=Number(process.hrtime.bigint()-t0)/1e6/N;
console.log(`positional engine: ${ms.toFixed(1)} ms/match   (old engine 0.56 ms)   380-match season ${(ms*380/1000).toFixed(0)}s`);
