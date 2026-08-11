process.env.QUIET="1";
const { CFG } = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
const eng = await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meDecide,meGoalX,meDir,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
function probe(){
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
  let fwd=0,np=0,fsum=0,deep=0,n=0,final=0,siege=0,box=0,sn=0;
  for(let seed=1;seed<=3;seed++){
    const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
    s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
    const rng=new RNG(seed);
    for(let t=0;t<ME_MATCH_TICKS;t++){
      const mp=s.mePos;
      if(mp.idx>=0 && !mp.sp){
        const d=Math.abs(meGoalX(mp.side)-mp.bx); n++;
        if(d>70) deep++; if(d<25) final++;
        const p=s.players[mp.side][mp.idx], dir=meDir(mp.side);
        const act=meDecide(s,rng,mp.side,mp.idx);
        if(act&&act.k==="pass"){ const g=(act.ax-p.x)*dir; np++; fsum+=g; if(g>4) fwd++; }
        const def=mp.side==="home"?"away":"home", own=meGoalX(mp.side), dd=def==="home"?1:-1;
        if((mp.bx-own)*dd<28){ sn++; box+=s.players[def].filter(q=>q.pos!=="GK"&&(q.x-own)*dd<18).length; }
      }
      meTick(s,rng,out);
    }
  }
  return {fwd:100*fwd/np, gain:fsum/np, deep:100*deep/n, final:100*final/n, box:sn?box/sn:0,
          shots:(out.shots.home+out.shots.away)/6, goals:(out.goals.home+out.goals.away)/6};
}
console.log("fwdPull  keepBuild | fwd%  gain   deep%  final%  inBox  shots goals");
console.log("real                  ~38  +4.0m    ~30      ~8    4.5-7    13   1.4");
for(const [f,k] of [[0.00022,0.055],[0.0006,0.030],[0.0010,0.018],[0.0016,0.010],[0.0024,0.004]]){
  CFG.fwdPull=f; CFG.keepBuild=k;
  const r=probe();
  console.log(`${String(f).padStart(7)} ${String(k).padStart(10)} | ${r.fwd.toFixed(0).padStart(4)} ${r.gain.toFixed(1).padStart(6)}m ${r.deep.toFixed(0).padStart(6)} ${r.final.toFixed(0).padStart(7)} ${r.box.toFixed(1).padStart(7)} ${r.shots.toFixed(1).padStart(6)} ${r.goals.toFixed(2).padStart(5)}`);
}
