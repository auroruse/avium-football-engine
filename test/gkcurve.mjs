// The keeper alone. A shooter is placed at a range, strikes it with the real kick model, and the
// ball is flown by the real integrator until it crosses the line or the keeper claims it. No
// decisions, no defenders, no blocks -- just how often a struck ball beats a goalkeeper.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF, CFG, ME_HALF_W } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const RANGES=[4,8,12,16,20,25];
const REAL  =["~70%","~35%","~18%","~10%","~7%","~4%"];
export function curve(N){
  const res=RANGES.map(()=>({shots:0,goals:0,saved:0,off:0}));
  // Force the shot. Left to himself he dribbles: carrying is scored at the full possession value of
  // the spot he runs to, so running at goal outscores striking it from everywhere outside six yards.
  const sw=CFG.shotWorth; CFG.shotWorth=1e4;
  for(let r=0;r<RANGES.length;r++){
    const D=RANGES[r];
    for(let k=0;k<N;k++){
      const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
      s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}};
      s.possession="home"; meInit(s,pitchSlots);
      const rng=new RNG(1000+k*7+r);
      const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
        corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
      // shooter alone in front of goal; everybody else parked on the halfway line out of the way
      const mp=s.mePos, sh=s.players.home[10];
      for(const p of s.players.home) { p.x=52; p.y=6; p.vx=0; p.vy=0; }
      for(const p of s.players.away) { p.x=52; p.y=62; p.vx=0; p.vy=0; }
      const gk=s.players.away.find(p=>p.pos==="GK");
      const yOff=(rng.u()-0.5)*10;
      sh.x=105-D; sh.y=ME_HALF_W+yOff; sh.vx=0; sh.vy=0;
      gk.x=104.2; gk.y=ME_HALF_W; gk.vx=0; gk.vy=0;      // set on his line, as he would be
      mp.side="home"; mp.idx=10; mp.bx=sh.x; mp.by=sh.y; mp.bz=0.11; mp.bvx=0; mp.bvy=0; mp.bvz=0;
      mp.hold=99; mp.dead=0; mp.flight=false; mp.kickBy=null;
      // Stop the instant THIS shot is resolved. Letting the clock run on meant a save was followed
      // by ten more seconds of football, and whatever happened next was scored as the shot's outcome.
      const g0=out.goals.home;
      let done=null;
      for(let t=0;t<24 && !done;t++){
        meTick(s,rng,out);
        if(out.goals.home>g0) done="goal";
        else if(out.saves.away>0) done="save";
        else if(out.woodwork>0) done="frame";
        else if(mp.dead!==0) done="wide";
        else if(mp.idx>=0) done="wide";        // gathered by somebody: it was not on target
      }
      res[r].shots++;
      if(done==="goal") res[r].goals++;
      else if(done==="save") res[r].saved++; else res[r].off++;
    }
  }
  CFG.shotWorth=sw;
  return res;
}
if(!process.env.SWEEP){
  const res=curve(160);
  console.log("range   shots  in   saved  wide/other   conversion   real");
  RANGES.forEach((D,r)=>{const c=res[r];
    console.log(`${String(D).padStart(4)} m ${String(c.shots).padStart(6)} ${String(c.goals).padStart(4)} ${String(c.saved).padStart(6)} ${String(c.off).padStart(10)}   ${(100*c.goals/c.shots).toFixed(0).padStart(9)}%   ${REAL[r]}`);});
}
