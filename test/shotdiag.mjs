// Where do physical shots actually end up? Every outcome is now emergent, so this is the honest
// scorecard: goal / saved / parried / blocked / frame / wide.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const rng=new RNG(9); const tot={shots:0,goals:0,onT:0,saves:0,blocked:0,wood:0,corners:0};
let dist=[0,0,0,0];
for(let m=0;m<8;m++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home";
  meInit(s,pitchSlots);
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0,
    shotDist:new Array(10).fill(0), xg:0};
  for(let t=0;t<90*ME_TPM;t++){
    const b4=out.shots.home+out.shots.away;
    const hx=s.mePos.idx>=0?s.players[s.mePos.side][s.mePos.idx]:null, hs=s.mePos.side;
    meTick(s,rng,out);
    if(out.shots.home+out.shots.away>b4 && hx){ const d=eng.meShotGeom(hs,hx.x,hx.y).d;
      dist[d<8?0:d<16?1:d<24?2:3]++; }
  }
  tot.shots+=out.shots.home+out.shots.away; tot.goals+=out.goals.home+out.goals.away;
  tot.onT+=out.onTarget.home+out.onTarget.away; tot.saves+=out.saves.home+out.saves.away;
  tot.blocked+=out.blocked||0; tot.wood+=out.woodwork||0; tot.corners+=out.corners.home+out.corners.away;
}
const n=8, pc=(v)=>`${(100*v/tot.shots).toFixed(0)}%`;
console.log(`per match (both sides): shots ${(tot.shots/n).toFixed(1)}  goals ${(tot.goals/n).toFixed(2)}  onTarget ${(tot.onT/n).toFixed(1)}  saves ${(tot.saves/n).toFixed(1)}  blocked ${(tot.blocked/n).toFixed(1)}  woodwork ${(tot.wood/n).toFixed(2)}  corners ${(tot.corners/n).toFixed(1)}`);
console.log(`of all shots: on target ${pc(tot.onT)}  saved ${pc(tot.saves)}  blocked ${pc(tot.blocked)}  frame ${pc(tot.wood)}  scored ${pc(tot.goals)}`);
console.log(`shot distance <8/<16/<24/24m+: ${dist.join("/")}   (real football: roughly 25/40/25/10)`);
