// The taker during a restart: does he settle on his mark, or circle it?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const per={}, cnt={};
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed); let prevD=null, prevSp=null;
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.sp){
      const tk=s.players[mp.sp.side][mp.sp.ti];
      const d=Math.hypot(tk.x-(tk._tx??tk.x),tk.y-(tk._ty??tk.y));
      const k=mp.sp.kind;
      if(prevSp===mp.sp && prevD!==null && prevD<1.5){
        cnt[k]=(cnt[k]||0)+1;
        // Orbiting means close to the mark and STILL MOVING without getting nearer. A man standing
        // perfectly still on his spot also stops getting closer, and counting that as circling is
        // how the first version of this check reported success as failure.
        const v=Math.hypot(tk.vx||0,tk.vy||0)/0.25;
        if(v>0.6 && d>=prevD-0.02) per[k]=(per[k]||0)+1;
      }
      prevD=d; prevSp=mp.sp;
    } else { prevD=null; prevSp=null; }
    meTick(s,rng,out);
  }
}
console.log("restart   slices   taker close to his mark but not settling");
for(const k of Object.keys(cnt))
  console.log(`  ${k.padEnd(9)} ${String(cnt[k]).padStart(5)}   ${(100*(per[k]||0)/cnt[k]).toFixed(0)}%`);
