const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meSetDbg, meVal, meOffsideLine, ME_TPM, STRAT_DEF, PITCH_L } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
const rng=new RNG(9);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
           corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0};
let shown=0;
for (let t=0;t<90*ME_TPM && shown<8;t++){
  const bc=out.carries, hx=s.mePos.idx>=0?s.players[s.mePos.side][s.mePos.idx]:null, hs=s.mePos.side;
  const dbg={}; meSetDbg(dbg); meTick(s,rng,out); meSetDbg(null);
  if (out.carries>bc && hx && dbg.carry!==undefined){
    shown++;
    const off=meOffsideLine(s,hs), dir=hs==="home"?1:-1;
    const mates=s.players[hs].filter((q,j)=>j!==s.mePos.idx&&q.pos!=="GK");
    const onside=mates.filter(q=>(q.x-off)*dir<=0.4).length;
    const fwd=mates.filter(q=>(q.x-hx.x)*dir>3).length;
    const fwdOn=mates.filter(q=>(q.x-hx.x)*dir>3&&(q.x-off)*dir<=0.4).length;
    console.log(`carry at ${((hx.x-(hs==="home"?0:PITCH_L))*dir).toFixed(0)}m depth: carry ${dbg.carry.toFixed(4)} vs bestPass ${(dbg.pass??-99).toFixed(4)}  press ${dbg.press.toFixed(2)}  | mates onside ${onside}/10, ahead of ball ${fwd}, ahead AND onside ${fwdOn}   offsideLine ${off.toFixed(0)}`);
  }
}
