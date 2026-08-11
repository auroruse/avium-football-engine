// How long does a TEAM keep the ball, and how far does an attack travel? A block can only form if
// possessions last long enough for it to get back.
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const len=[], hops=[], gain=[], pd=[];
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  let side=null, t0=0, n=0, x0=0, lastIdx=-1;
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos, hadIdx=mp.idx, hadSide=mp.side, hx=mp.bx;
    if(mp.idx>=0 && !mp.sp){
      if(mp.side!==side){ if(side){ len.push(t-t0); hops.push(n); gain.push((mp.bx-x0)*(side==="home"?1:-1)); }
                          side=mp.side; t0=t; n=0; x0=mp.bx; }
      else if(mp.idx!==lastIdx) n++;
      lastIdx=mp.idx;
    }
    meTick(s,rng,out);
    if(hadIdx>=0 && mp.idx<0 && mp.passPending){
      const q=s.players[hadSide][mp.fj];
      if(q) pd.push(Math.hypot(q.x-hx,q.y-mp.by));
    }
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
const pct=(a,q)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length*q)]||0;};
console.log(`team possessions: ${len.length}`);
console.log(`  length          ${(mean(len)/4).toFixed(2)}s  (median ${(pct(len,0.5)/4).toFixed(2)}, 90th ${(pct(len,0.9)/4).toFixed(2)})`);
console.log(`  players touched ${mean(hops).toFixed(1)}  (90th ${pct(hops,0.9)})`);
console.log(`  ground gained   ${mean(gain).toFixed(1)} m`);
console.log(`  mean pass length ${mean(pd).toFixed(1)} m  (90th ${pct(pd,0.9).toFixed(0)} m)`);
console.log(`  real football: possession ~8-12s, 3-5 players, passes ~17 m`);
