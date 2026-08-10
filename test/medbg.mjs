const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meShotGeom, meSetDbg, ME_TPM, STRAT_DEF } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
const rng=new RNG(9);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
           corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0};
let shown=0, far=0, near=0;
for (let t=0;t<90*ME_TPM && shown<10;t++){
  const before=out.shots.home+out.shots.away;
  const hx = s.mePos.idx>=0 ? s.players[s.mePos.side][s.mePos.idx] : null, hs = s.mePos.side;
  const dbg={}; meSetDbg(dbg);
  meTick(s,rng,out);
  meSetDbg(null);
  if (out.shots.home+out.shots.away>before && hx){
    const d=meShotGeom(hs,hx.x,hx.y).d;
    if (d>25) far++; else near++;
    if (d>25 && shown<10){ shown++;
      console.log(`shot ${d.toFixed(1)}m  scores: shot ${(dbg.shot??0).toFixed(4)}  bestPass ${(dbg.pass??-1).toFixed(4)}  carry ${(dbg.carry??0).toFixed(4)}  press ${(dbg.press??0).toFixed(2)}`);
    }
  }
}
console.log(`\nshots beyond 25m: ${far}, inside 25m: ${near}`);
