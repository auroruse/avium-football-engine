process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {CFG,RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
function m(){
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
  let n=0,sum=0,hi=0,cl=0;
  for(let seed=1;seed<=3;seed++){
    const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
    s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
    const rng=new RNG(seed);
    for(let t=0;t<ME_MATCH_TICKS;t++){ meTick(s,rng,out);
      for(const sd of ["home","away"]) for(const p of s.players[sd]){
        const v=Math.hypot(p.vx||0,p.vy||0)/0.25; n++; sum+=v; if(v>5.5) hi++; if(p._closing) cl++; } }
  }
  return {mean:sum/n, hi:100*hi/n, cl:100*cl/n,
          shots:(out.shots.home+out.shots.away)/6, goals:(out.goals.home+out.goals.away)/6};
}
console.log("effortHard blkChase | mean  >5.5m/s  _closing  shots goals");
console.log("real                   ~2.0     ~3%                13   1.4");
for(const [e,b] of [[1.0,2.5],[0.72,2.5],[0.72,6],[0.60,6],[0.60,10]]){
  CFG.effortHard=e; CFG.blkChase=b; const r=m();
  console.log(`${String(e).padStart(10)} ${String(b).padStart(8)} | ${r.mean.toFixed(2).padStart(4)} ${r.hi.toFixed(0).padStart(7)}% ${r.cl.toFixed(0).padStart(8)}% ${r.shots.toFixed(1).padStart(6)} ${r.goals.toFixed(2).padStart(5)}`);
}
