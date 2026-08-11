// Realized conversion vs the model's own expectation, per resolution path.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = eng;
Object.assign(eng.CFG, { blockK: 0.6, shotWorth: 0.75, xgK: 0.165, passNoiseDeg: 4.5 });
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const rng=new RNG(7); let pSum=0, shots=0, goals=0, blocked=0, dists=[0,0,0];
for (let m=0;m<8;m++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home";
  meInit(s,pitchSlots);
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,
    shotDist:new Array(10).fill(0), xg:0};
  for(let t=0;t<90*ME_TPM;t++){
    const b4={s:out.shots.home+out.shots.away, g:out.goals.home+out.goals.away, b:out.blocked||0};
    const hx = s.mePos.idx>=0 ? s.players[s.mePos.side][s.mePos.idx] : null, hs=s.mePos.side;
    meTick(s,rng,out);
    const ns=out.shots.home+out.shots.away;
    if(ns>b4.s && hx){ shots++;
      if((out.blocked||0)>b4.b) blocked++;
      else { const p=eng.meShotP(s,hs,hx,hx.x,hx.y); pSum+=p;
        const d=eng.meShotGeom(hs,hx.x,hx.y).d; dists[d<8?0:d<16?1:2]++; }
      if(out.goals.home+out.goals.away>b4.g) goals++;
    }
  }
}
console.log(`shots ${shots}  blocked ${blocked}  goals ${goals}`);
console.log(`realized conversion ${(goals/shots).toFixed(3)}   model E[p] on unblocked ${(pSum/(shots-blocked)).toFixed(3)}`);
console.log(`unblocked shot dists <8m/<16m/16m+: ${dists.join("/")}`);
