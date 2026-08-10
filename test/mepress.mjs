// How hard is the side without the ball actually going? Real football: one man closes, the rest hold
// shape. "Defenders within 6m of the ball" should be about 1, not 3.
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, mePressure, ME_TPM, STRAT_DEF } = await import(process.env.ENG || "./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
for (const [lbl, loe] of [["no instruction", 0], ["low block (-2)", -2], ["high press (+2)", 2]]) {
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"};
  s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF,pressingLOE:loe}}; s.possession="home"; meInit(s, pitchSlots);
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
             corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
  const rng=new RNG(6); let pr=0, n=0, dist=0;
  for(let t=0;t<90*ME_TPM;t++){ meTick(s,rng,out);
    if(s.mePos.idx>=0&&s.mePos.side==="home"){ pr+=mePressure(s,"home",s.mePos.bx,s.mePos.by); n++;
      dist+=Math.min(...s.players.away.filter(p=>p.pos!=="GK").map(p=>Math.hypot(p.x-s.mePos.bx,p.y-s.mePos.by))); } }
  console.log(`${lbl.padEnd(16)} defenders within 6m of the ball: ${(pr/n).toFixed(2)}   nearest defender: ${(dist/n).toFixed(1)}m   away stamina ${(s.players.away.reduce((a,p)=>a+p.stamina,0)/11).toFixed(0)}`);
}
console.log("real football: about 1 defender inside 6m, nearest 4-6m");
