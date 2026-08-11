// HOW does a failed pass die? Cut out early in the lane, or does it simply reach a spot the man it
// was meant for never gets to?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(15);
let live=null;
// failure modes
let cutEarly=0, cutLate=0, arrivedShort=0, okN=0;
const gapAtEnd=[], recvGap=[], loseT=[];
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  let plan=null;
  if(mp.idx>=0){
    const act=meDecide(s,rng,mp.side,mp.idx);
    if(act && act.k==="pass") plan={ j:act.j, ax:act.ax, ay:act.ay, side:mp.side };
  }
  const hadIdx=mp.idx;
  meTick(s,rng,out);
  if(hadIdx>=0 && mp.idx<0 && mp.passPending && plan){ live={...plan, t0:t, d0:Math.hypot(mp.bx-plan.ax,mp.by-plan.ay)}; }
  else if(live){
    if(mp.idx>=0){
      const lag=t-live.t0;
      const rcv=s.players[live.side][live.j];
      if(mp.side===live.side) okN++;
      else{
        // where did it die, relative to the flight?
        const frac = 1 - Math.hypot(mp.bx-live.ax,mp.by-live.ay)/Math.max(1,live.d0);
        if(frac < 0.6) cutEarly++; else if(lag<=Math.ceil(live.d0/4)) cutLate++; else arrivedShort++;
        gapAtEnd.push(Math.hypot(mp.bx-live.ax,mp.by-live.ay));
        recvGap.push(Math.hypot(rcv.x-mp.bx,rcv.y-mp.by));
        loseT.push(lag/4);
      }
      live=null;
    } else if(!mp.flight) live=null;
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
const bad=cutEarly+cutLate+arrivedShort;
console.log(`completed ${okN}   lost ${bad}`);
console.log(`  cut out in the first 60% of the lane   ${cutEarly}  (${(100*cutEarly/bad).toFixed(0)}%)`);
console.log(`  taken near the target, on time         ${cutLate}  (${(100*cutLate/bad).toFixed(0)}%)`);
console.log(`  ball still loose when it was collected ${arrivedShort}  (${(100*arrivedShort/bad).toFixed(0)}%)`);
console.log(`on a lost pass: died ${mean(gapAtEnd).toFixed(1)} m from the target, the intended man was ${mean(recvGap).toFixed(1)} m away, ${mean(loseT).toFixed(2)}s after the kick`);
