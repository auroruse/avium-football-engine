const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = await import(process.env.ENG || "./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const one=()=>{const s=createMatchState();s.players.home=sq(75);s.players.away=sq(72);
  s.formations={home:"4-3-3",away:"4-3-3"};s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}};s.possession="home";meInit(s, pitchSlots);
  const o={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
  const rng=new RNG(3); for(let t=0;t<90*ME_TPM;t++) meTick(s,rng,o);};
one();
const N=3,t0=process.hrtime.bigint(); for(let i=0;i<N;i++) one();
console.log(`${(Number(process.hrtime.bigint()-t0)/1e6/N).toFixed(0)} ms/match`);
