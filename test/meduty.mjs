const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
           corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
const rng=new RNG(5); const tally={}; let pressers=0,n=0;
for(let t=0;t<90*ME_TPM;t++){ meTick(s,rng,out);
  if(t%20===0){ for(const sd of ["home","away"]) for(const p of s.players[sd]) tally[p._duty]=(tally[p._duty]||0)+1;
    const d=s.players[s.mePos.side==="home"?"away":"home"].filter(p=>p._duty==="press").length; pressers+=d; n++; } }
console.log("duty distribution across the match: " + Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/Object.values(tally).reduce((a,b)=>a+b,0)).toFixed(0)}%`).join("  "));
console.log(`players pressing the ball at once: ${(pressers/n).toFixed(2)} (the bug this fixes was 6-7)`);
console.log(`phases now: home=${s.mePos.phase.home} away=${s.mePos.phase.away}`);
