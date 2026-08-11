// A reception: how far did he have to stretch, how hard did it arrive, and did he control it?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF,CFG}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
// bucket arriving balls by the reach distance of the nearest man when it was claimed-or-not
const S=[0,0.25,0.5,99], L=["at his feet (<0.25m)","0.25-0.5 m","stretching (0.5m+)"];
const got=[0,0,0], lost=[0,0,0];
const turn=[];
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    const wasLoose=mp.idx<0 && !mp.sp && Math.hypot(mp.bvx,mp.bvy)>1.5;
    let nearest=Infinity, dirBefore=null;
    if(wasLoose){
      dirBefore=Math.atan2(mp.bvy,mp.bvx);
      for(const sd of ["home","away"]) for(const p of s.players[sd])
        nearest=Math.min(nearest,Math.hypot(p.x-mp.bx,p.y-mp.by));
    }
    meTick(s,rng,out);
    if(wasLoose && nearest<CFG.reach+0.3){
      const k=S.findIndex((b,i)=>nearest>=b && nearest<S[i+1]);
      if(k>=0){ if(mp.idx>=0) got[k]++; else lost[k]++;
        if(mp.idx>=0){ const d=Math.atan2(mp.bvy,mp.bvx)-dirBefore;
          turn.push(Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))*180/Math.PI); } }
    }
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log("a moving ball reaching a player:");
for(let k=0;k<L.length;k++){ const n=got[k]+lost[k]; if(n)
  console.log(`  ${L[k].padEnd(22)} ${String(n).padStart(4)}   controlled ${(100*got[k]/n).toFixed(0).padStart(3)}%   squirted away ${(100*lost[k]/n).toFixed(0).padStart(3)}%`); }
console.log(`mean direction change on a controlled touch: ${mean(turn).toFixed(0)} degrees`);
