process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {CFG,RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
function m(){
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
  let n=0,ahead=0,along=0,jn=0,jump=0;
  for(let seed=1;seed<=3;seed++){
    const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
    s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
    const rng=new RNG(seed);
    for(let t=0;t<ME_MATCH_TICKS;t++){
      const mp=s.mePos, bx=mp.bx, by=mp.by, vx=mp.bvx, vy=mp.bvy, sp0=!!mp.sp;
      if(mp.idx>=0 && !sp0){
        const p=s.players[mp.side][mp.idx], v=Math.hypot(p.vx||0,p.vy||0);
        if(v>0.02){ const a=((mp.bx-p.x)*(p.vx/v)+(mp.by-p.y)*(p.vy/v)); n++; along+=a; if(a>0) ahead++; }
      }
      meTick(s,rng,out);
      if(!sp0 && !mp.sp){ const d=Math.abs(Math.hypot(mp.bx-bx,mp.by-by)-Math.hypot(vx,vy)*0.25);
                          jn++; if(d>0.8) jump++; }
    }
  }
  return {ahead:100*ahead/n, along:along/n, jump:100*jump/jn,
          shots:(out.shots.home+out.shots.away)/6, goals:(out.goals.home+out.goals.away)/6};
}
console.log("pull force skill | ahead%  along   jumps>0.8m  shots goals");
for(const [pu,fo,sk] of [[3.0,15,16],[1.8,15,16],[1.2,15,16],[0.8,16,18]]){
  CFG.ctrlPull=pu; CFG.ctrlForce=fo; CFG.ctrlSkill=sk; const r=m();
  console.log(`${String(pu).padStart(4)} ${String(fo).padStart(5)} ${String(sk).padStart(5)} | ${r.ahead.toFixed(0).padStart(5)}% ${r.along.toFixed(2).padStart(7)} ${r.jump.toFixed(1).padStart(11)}% ${r.shots.toFixed(1).padStart(6)} ${r.goals.toFixed(2).padStart(5)}`);
}
