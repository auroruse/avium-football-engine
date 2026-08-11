process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, ME_DT, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home";
meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(3);
// TRUE possession: the last side to control the ball, ignoring flight.
let ctrl=null, spells=[], cur=null, touches=0;
// TRUE carrier motion: measure displacement, not the (stale) velocity field.
let dispDwell=[], dispDrive=[], dwellTicks=0, driveTicks=0;
let prevHolder=null, prevPos=null, prevDrive=0;
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  const h = mp.idx>=0 ? {side:mp.side, p:s.players[mp.side][mp.idx], drive:mp.drive} : null;
  if (h && prevHolder && h.p===prevHolder) {
    const d=Math.hypot(h.p.x-prevPos[0], h.p.y-prevPos[1]);
    if (prevDrive>0) { dispDrive.push(d); driveTicks++; } else { dispDwell.push(d); dwellTicks++; }
  }
  prevHolder = h?h.p:null; prevPos = h?[h.p.x,h.p.y]:null; prevDrive = h?h.drive:0;
  meTick(s,rng,out);
  if (mp.idx>=0){
    touches++;
    if (ctrl!==mp.side){ if(cur) spells.push(cur); cur={side:mp.side,t:0}; ctrl=mp.side; }
    if(cur) cur.t++;
  }
}
if(cur) spells.push(cur);
const mean=(a)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
console.log(`TRUE possession spells: ${spells.length}   mean length ${(mean(spells.map(x=>x.t))*ME_DT).toFixed(1)} s   (real football: ~250-300 spells, 8-12 s)`);
console.log(`carrier displacement while DWELLING: ${(mean(dispDwell)/ME_DT).toFixed(2)} m/s over ${dwellTicks} ticks`);
console.log(`carrier displacement while DRIVING:  ${(mean(dispDrive)/ME_DT).toFixed(2)} m/s over ${driveTicks} ticks`);
console.log(`  -> he has the ball for ${((dwellTicks+driveTicks)/(90*ME_TPM)*100).toFixed(0)}% of ticks; ${(100*dwellTicks/(dwellTicks+driveTicks)).toFixed(0)}% of that is dwelling`);
console.log(`passes ${out.passes} (real ~900 both sides)   carries ${out.carries}   turnovers ${out.tackles}`);
