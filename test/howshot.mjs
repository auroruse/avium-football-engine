// How does the ball get to the six-yard box? And how closely is a carrier ever guarded?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, meGoalX, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(15);
// where each possession spell started, so a shot can be attributed to a carry or to a pass
let holder=null, gotX=0, gotY=0;
let carriedIn=0, passedIn=0;
const shotGuard=[];
// how tightly guarded is the carrier, by how deep he is in the opponent half
const bands=[[0,18],[18,30],[30,45],[45,105]], lblB=["in their box","18-30m","30-45m","45m+"];
const gsum=bands.map(()=>0), gn=bands.map(()=>0), tight=bands.map(()=>0);
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  if(mp.idx>=0){
    const p=s.players[mp.side][mp.idx], opp=s.players[mp.side==="home"?"away":"home"];
    const key=`${mp.side}${mp.idx}`;
    if(key!==holder){ holder=key; gotX=p.x; gotY=p.y; }
    let near=Infinity;
    for(const q of opp) if(q.pos!=="GK") near=Math.min(near,Math.hypot(q.x-p.x,q.y-p.y));
    const dGoal=Math.abs(meGoalX(mp.side)-p.x);
    const bi=bands.findIndex(([a,b])=>dGoal>=a&&dGoal<b);
    if(bi>=0){ gsum[bi]+=near; gn[bi]++; if(near<3.2) tight[bi]++; }
    const act=meDecide(s,rng,mp.side,mp.idx);
    if(act && act.k==="shot"){
      // did he receive the ball where he is shooting from, or run it there?
      if(Math.hypot(p.x-gotX,p.y-gotY) > 6) carriedIn++; else passedIn++;
      shotGuard.push(near);
    }
  }
  meTick(s,rng,out);
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`shot chances: ran the ball there ${carriedIn}   received it there ${passedIn}`);
console.log(`nearest defender at the moment of the shot: ${mean(shotGuard).toFixed(1)} m`);
console.log("carrier's nearest opponent, by how far he is from the goal he attacks:");
for(let k=0;k<bands.length;k++) if(gn[k])
  console.log(`  ${lblB[k].padEnd(13)} ${(gsum[k]/gn[k]).toFixed(1)} m   within tackling range on ${(100*tight[k]/gn[k]).toFixed(0)}% of slices`);
console.log(`shots ${out.shots.home}/${out.shots.away}  goals ${out.goals.home}/${out.goals.away}`);
