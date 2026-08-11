process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
function probe(){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
  const rng=new RNG(15); let n=0,inBox=0,span=0,shots=0,nearSh=0;
  for(let t=0;t<90*ME_TPM;t++){
    const mp=s.mePos; const b=out.shots.home+out.shots.away;
    const hx=mp.idx>=0?s.players[mp.side][mp.idx]:null, hs=mp.side;
    if(mp.idx>=0){
      const def=hs==="home"?"away":"home", own=meGoalX(hs), dir=def==="home"?1:-1;
      const bd=(mp.bx-own)*dir;
      if(bd<28){ n++; const ds=s.players[def].filter(p=>p.pos!=="GK").map(p=>(p.x-own)*dir);
        inBox+=ds.filter(d=>d<18).length; span+=Math.max(...ds)-Math.min(...ds); }
    }
    meTick(s,rng,out);
    if(out.shots.home+out.shots.away>b && hx){ shots++;
      let c=0; for(const q of s.players[hs==="home"?"away":"home"]) if(q.pos!=="GK"&&Math.hypot(q.x-hx.x,q.y-hx.y)<8) c++;
      nearSh+=c; }
  }
  return {inBox:inBox/n, span:span/n, shots, goals:out.goals.home+out.goals.away, nearSh:nearSh/Math.max(1,shots), corners:out.corners.home+out.corners.away};
}
console.log("depth span   inBox/10  blockDepth  defNearShooter  shots goals corners");
for (const [d,sp] of [[28,0.58],[50,0.5],[50,0.35],[70,0.35]]) {
  eng.CFG.siegeDepth=d; eng.CFG.siegeSpan=sp;
  const r=probe();
  console.log(`${String(d).padEnd(6)}${String(sp).padEnd(6)} ${r.inBox.toFixed(1)}       ${r.span.toFixed(0)}m        ${r.nearSh.toFixed(2)}           ${r.shots}   ${r.goals}    ${r.corners}`);
}
console.log("real:                7-9       20-25m       2.5             26    2.8    10");
