// Is the block being computed wrong, or are the players just not getting to it?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,meDir,ME_TPM,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const rng=new RNG(7);
let n=0, errSum=0, slotSpan=0, realSpan=0, tgtSpan=0, mk=0, duties={};
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  if(mp.idx>=0){
    const atk=mp.side, def=atk==="home"?"away":"home", own=meGoalX(atk), dir=def==="home"?1:-1;
    if((mp.bx-own)*dir < 28){
      n++;
      const ds=s.players[def].filter(p=>p.pos!=="GK");
      const sl=ds.map(p=>(p._sx-own)*dir), re=ds.map(p=>(p.x-own)*dir), tg=ds.map(p=>((p._tx??p.x)-own)*dir);
      slotSpan+=Math.max(...sl)-Math.min(...sl);
      realSpan+=Math.max(...re)-Math.min(...re);
      tgtSpan +=Math.max(...tg)-Math.min(...tg);
      for(const p of ds){ errSum+=Math.hypot(p.x-p._sx,p.y-p._sy); if(p._mk>=0) mk++; duties[p._duty]=(duties[p._duty]||0)+1; }
    }
  }
  meTick(s,rng,out);
}
const d=n*10;
console.log(`siege slices: ${n}`);
console.log(`  depth of the SLOTS the block asks for : ${(slotSpan/n).toFixed(1)} m`);
console.log(`  depth of the SMOOTHED TARGETS        : ${(tgtSpan/n).toFixed(1)} m`);
console.log(`  depth of where the players ACTUALLY are: ${(realSpan/n).toFixed(1)} m`);
console.log(`  mean distance from a man to his slot : ${(errSum/d).toFixed(1)} m`);
console.log(`  had a man to pick up: ${(100*mk/d).toFixed(0)}%`);
console.log("  duties: " + Object.entries(duties).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/d).toFixed(0)}%`).join("  "));
