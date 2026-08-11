// A man through on goal: what does he actually decide, and what are the three options worth?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meDecide,meSetDbg,meShotP,
       meGoalX,meDir,meLaneBlock,ME_HALF_W,ME_MATCH_TICKS,STRAT_DEF,CFG}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const chose={}, sums={shot:0,pass:0,carry:0}; let n=0, spSum=0, dSum=0;
for(let seed=1;seed<=8;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0){
      const side=mp.side, p=s.players[side][mp.idx], dir=meDir(side), gx=meGoalX(side);
      const d=Math.hypot(gx-p.x,p.y-ME_HALF_W);
      if(d<24){
        // is anybody outfield between him and the goal?
        let block=0;
        for(const q of s.players[side==="home"?"away":"home"]){
          if(q.pos==="GK") continue;
          if((q.x-p.x)*dir>0 && Math.abs(q.y-p.y)<12 && (gx-q.x)*dir>0) block++;
        }
        if(block===0){                       // through on goal
          n++; dSum+=d; spSum+=meShotP(s,side,p,p.x,p.y);
          const dbg={}; meSetDbg(dbg);
          const act=meDecide(s,rng,side,mp.idx);
          meSetDbg(null);
          chose[act.k]=(chose[act.k]||0)+1;
          sums.shot+=dbg.shot??0; sums.pass+=dbg.pass??0; sums.carry+=dbg.carry??0;
          if(act.k==="pass"){
            const g=(act.ax-p.x)*dir;
            const lab = g<-3 ? "__BACK>3m" : g<0 ? "__back0-3m" : "__fwdpass";
            chose[lab]=(chose[lab]||0)+1;
            if(g<-3) console.log(`    a real backpass: ${g.toFixed(1)} m back, shot prob here ${meShotP(s,side,p,p.x,p.y).toFixed(3)}`);
          }
        }
      }
    }
    meTick(s,rng,out);
  }
}
console.log(`through on goal, inside 24 m, nobody outfield in the way: ${n} times`);
console.log(`  mean distance ${(dSum/n).toFixed(1)} m, engine's own shot probability ${(spSum/n).toFixed(3)}`);
console.log(`  he chose: ` + Object.entries(chose).filter(([k])=>!k.startsWith("__")).map(([k,v])=>`${k} ${(100*v/n).toFixed(0)}%`).join("  "));
console.log(`  of the passes: MORE THAN 3 m BACK ${chose["__BACK>3m"]||0}, slight lay-off ${chose["__back0-3m"]||0}, forward ${chose.__fwdpass||0}`);
console.log(`  mean option score -- shot ${(sums.shot/n).toFixed(4)}   best pass ${(sums.pass/n).toFixed(4)}   carry ${(sums.carry/n).toFixed(4)}`);
