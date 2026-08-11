// Can a player actually run with the ball? How near his feet does it stay, and how far does he take it?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF,meDir}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const gaps=[], runs=[], fwd=[];
let holder=null, acc=0, fx=0, px=0, py=0, n=0;
for(let seed=1;seed<=6;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    const key = mp.idx>=0 ? `${mp.side}${mp.idx}` : null;
    if(mp.idx>=0){
      const p=s.players[mp.side][mp.idx];
      gaps.push(Math.hypot(p.x-mp.bx,p.y-mp.by)); n++;
      const d=meDir(mp.side);
      if(key!==holder){ if(holder!==null) runs.push(acc); holder=key; acc=0; fx=0; }
      else { acc+=Math.hypot(mp.bx-px,mp.by-py); fx+=(mp.bx-px)*d; }
    } else if(holder!==null){ runs.push(acc); holder=null; acc=0; }
    px=mp.bx; py=mp.by;
    meTick(s,rng,out);
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
const pctl=(a,q)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length*q)]||0;};
console.log(`slices with a man in possession: ${n}`);
console.log(`  ball sits ${mean(gaps).toFixed(2)} m from his feet  (median ${pctl(gaps,0.5).toFixed(2)}, 90th ${pctl(gaps,0.9).toFixed(2)})`);
console.log(`  ground covered per possession: ${mean(runs).toFixed(1)} m  (median ${pctl(runs,0.5).toFixed(1)}, 90th ${pctl(runs,0.9).toFixed(1)})`);
console.log(`  possessions: ${runs.length}, of which ran the ball 5 m or more: ${(100*runs.filter(r=>r>=5).length/runs.length).toFixed(0)}%`);
console.log(`  carries logged ${out.carries}   passes ${out.passes}   shots ${out.shots.home+out.shots.away}`);
