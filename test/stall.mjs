// The man in possession: is he actually moving, and if not, why not?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF,CFG,meAttrs,meSpeed}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0, slow=0, spdSum=0, gapSum=0, tgtSum=0;
const runs=[]; let cur=0;
const bands={"<0.5":0,"0.5-2":0,"2-4":0,"4-6":0,"6+":0};
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0){
      const p=s.players[mp.side][mp.idx];
      const v=Math.hypot(p.vx||0,p.vy||0)/0.25;
      n++; spdSum+=v;
      gapSum+=Math.hypot(p.x-mp.bx,p.y-mp.by);
      tgtSum+=Math.hypot(p.x-(p._tx??p.x),p.y-(p._ty??p.y));
      bands[v<0.5?"<0.5":v<2?"0.5-2":v<4?"2-4":v<6?"4-6":"6+"]++;
      if(v<1){ slow++; cur++; } else { if(cur>0) runs.push(cur); cur=0; }
    } else { if(cur>0) runs.push(cur); cur=0; }
    meTick(s,rng,out);
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`slices with a man on the ball: ${n}`);
console.log(`  his mean speed ${(spdSum/n).toFixed(2)} m/s;  below 1 m/s on ${(100*slow/n).toFixed(0)}% of them`);
console.log(`  speed spread: ` + Object.entries(bands).map(([k,v])=>`${k} ${(100*v/n).toFixed(0)}%`).join("  "));
console.log(`  stationary stretches: ${runs.length}, mean ${(mean(runs)/4).toFixed(2)}s, longest ${(Math.max(0,...runs)/4).toFixed(2)}s`);
console.log(`  ball is ${(gapSum/n).toFixed(2)} m away; his TARGET is ${(tgtSum/n).toFixed(2)} m away`);
