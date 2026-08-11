// Is the ball IN FRONT of him or behind him? Signed along his direction of travel.
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF,CFG}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0, ahead=0, sum=0, lat=0;
const bands={"behind >1m":0,"behind 0-1m":0,"ahead 0-1m":0,"ahead 1-2m":0,"ahead >2m":0};
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0){
      const p=s.players[mp.side][mp.idx];
      const v=Math.hypot(p.vx||0,p.vy||0);
      if(v>0.02){
        const hx=p.vx/v, hy=p.vy/v;
        const dx=mp.bx-p.x, dy=mp.by-p.y;
        const along=dx*hx+dy*hy, across=Math.abs(-dx*hy+dy*hx);
        n++; sum+=along; lat+=across; if(along>0) ahead++;
        bands[along<-1?"behind >1m":along<0?"behind 0-1m":along<1?"ahead 0-1m":along<2?"ahead 1-2m":"ahead >2m"]++;
      }
    }
    meTick(s,rng,out);
  }
}
console.log(`moving-with-the-ball slices: ${n}`);
console.log(`  ball is IN FRONT of him on ${(100*ahead/n).toFixed(0)}% of them`);
console.log(`  mean along his heading: ${(sum/n).toFixed(2)} m   (positive = ahead)   sideways ${(lat/n).toFixed(2)} m`);
console.log("  " + Object.entries(bands).map(([k,v])=>`${k} ${(100*v/n).toFixed(0)}%`).join("   "));
console.log(`\nhitbox vs drawn:  body radius ${CFG.bodyR} m, ball radius ${CFG.ballR} m`);
