// The keeper in a real match: is he on the line between ball and goal, do his parries go away from
// it, and does he ever come for a ball?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,meOther,ME_HALF_W,ME_MATCH_TICKS,STRAT_DEF,CFG}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0, offLine=0, outOfGoal=0, rush=0;
const parry=[];
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  let sv=out.saves.home+out.saves.away, pre=null;
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(!mp.sp) for(const sd of ["home","away"]){
      const gk=s.players[sd].find(p=>p.pos==="GK"); if(!gk) continue;
      const own=meGoalX(meOther(sd));
      // perpendicular distance from the keeper to the ball->goal-centre line
      const ax=mp.bx-own, ay=mp.by-ME_HALF_W, al=Math.hypot(ax,ay)||1;
      const perp=Math.abs((-(ay/al))*(gk.x-own)+(ax/al)*(gk.y-ME_HALF_W));
      n++; offLine+=perp; if(perp>2.5) outOfGoal++;
      if(Math.hypot(gk.x-own,gk.y-ME_HALF_W)>7.5) rush++;
    }
    pre={bx:mp.bx,by:mp.by,sv:out.saves.home+out.saves.away};
    meTick(s,rng,out);
    const nsv=out.saves.home+out.saves.away;
    if(nsv>pre.sv && mp.idx<0){
      // where is the ball heading relative to the goal it was parried at?
      const sd=mp.lastSide, own=meGoalX(meOther(sd));
      const away=(mp.bvx*(own===0?1:-1))*-1;      // positive = travelling away from that goal
      parry.push(away>0?1:0);
    }
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`keeper samples: ${n}`);
console.log(`  mean distance off the ball-to-goal line: ${(offLine/n).toFixed(2)} m   (more than 2.5 m off on ${(100*outOfGoal/n).toFixed(0)}%)`);
console.log(`  more than 7.5 m off his goal line (came for it): ${(100*rush/n).toFixed(1)}% of slices`);
console.log(`  parries/saves recorded: ${parry.length}, of which the ball travels AWAY from goal: ${(100*mean(parry)).toFixed(0)}%`);
console.log(`  shots ${out.shots.home+out.shots.away}  on target ${out.onTarget.home+out.onTarget.away}  saves ${out.saves.home+out.saves.away}  goals ${out.goals.home+out.goals.away}`);
