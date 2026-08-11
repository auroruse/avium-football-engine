// Is the man on the ball actually a moving player, or a stationary decision point?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, ME_DT, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home";
meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0,
  evt:null, feed:[], min:0};
const rng=new RNG(3);
let carrierSpeed=[], otherSpeed=[], carrierStill=0, carrierTicks=0, evts=0, lastEvt=null;
let poss=[], curPoss=null, decisions=0;
let nearestDefWhenHeld=[];
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  const beforeHold = mp.hold, beforeIdx = mp.idx, beforeSide = mp.side;
  meTick(s,rng,out);
  if (out.evt && out.evt !== lastEvt) { evts++; lastEvt = out.evt; }
  if (mp.idx>=0){
    const p=s.players[mp.side][mp.idx];
    const v=Math.hypot(p.vx||0,p.vy||0)/ME_DT;
    carrierSpeed.push(v); carrierTicks++; if(v<0.4) carrierStill++;
    // nearest opponent to the man on the ball
    let nd=Infinity; for(const q of s.players[mp.side==="home"?"away":"home"]) if(q.pos!=="GK")
      nd=Math.min(nd,Math.hypot(q.x-p.x,q.y-p.y));
    nearestDefWhenHeld.push(nd);
    if (curPoss && curPoss.side===mp.side) { if (mp.hold===0 && beforeHold>0) curPoss.dec++; }
    else { if(curPoss) poss.push(curPoss); curPoss={side:mp.side,dec:1,ticks:0}; }
    if(curPoss) curPoss.ticks++;
    for(const q of s.players[mp.side]) if(q!==p && q.pos!=="GK") otherSpeed.push(Math.hypot(q.vx||0,q.vy||0)/ME_DT);
  } else if (curPoss) { poss.push(curPoss); curPoss=null; }
}
const mean=(a)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
console.log(`man ON the ball:    mean speed ${mean(carrierSpeed).toFixed(2)} m/s   stationary (<0.4 m/s) ${(100*carrierStill/carrierTicks).toFixed(0)}% of the time he has it`);
console.log(`his TEAM-MATES:     mean speed ${mean(otherSpeed).toFixed(2)} m/s`);
console.log(`nearest opponent while he holds it: mean ${mean(nearestDefWhenHeld).toFixed(1)} m   (real: a pressed carrier has someone inside 2-3 m)`);
console.log(`possessions ${poss.length}   mean decisions per possession ${mean(poss.map(p=>p.dec)).toFixed(1)}   mean duration ${(mean(poss.map(p=>p.ticks))*ME_DT).toFixed(1)} s`);
console.log(`viz events fired: ${evts} over the match  = one every ${(90*60/evts).toFixed(1)} s of match time`);
console.log(`action mix: ${out.passes} passes, ${out.carries} carries, ${out.shots.home+out.shots.away} shots, ${out.clears} clears`);
