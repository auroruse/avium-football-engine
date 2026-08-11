// Long shots convert at ~0%. Where do they actually END UP? Saved, blocked, wide, or short?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = eng;
eng.CFG.shotWorth = 12;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const rng=new RNG(4);
let far=0, farSave=0, farBlock=0, farWide=0, farGoal=0, farOther=0, minZ=99, maxZ=0, zAtLine=[];
for(let m=0;m<4;m++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home";
  meInit(s,pitchSlots);
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
  let live=null;
  for(let t=0;t<90*ME_TPM;t++){
    const b={s:out.shots.home+out.shots.away,g:out.goals.home+out.goals.away,sv:out.saves.home+out.saves.away,bl:out.blocked||0};
    const hx=s.mePos.idx>=0?s.players[s.mePos.side][s.mePos.idx]:null, hs=s.mePos.side;
    meTick(s,rng,out);
    if(out.shots.home+out.shots.away>b.s && hx){
      const d=eng.meShotGeom(hs,hx.x,hx.y).d;
      live = d>=14 ? {gx:eng.meGoalX(hs)} : null;
      if(live) far++;
    } else if (live) {
      if(out.goals.home+out.goals.away>b.g){ farGoal++; live=null; }
      else if(out.saves.home+out.saves.away>b.sv){ farSave++; live=null; }
      else if((out.blocked||0)>b.bl){ farBlock++; live=null; }
      else if(s.mePos.dead>0){ farWide++; live=null; }
      else if(s.mePos.idx>=0){ farOther++; live=null; }
      else if(s.mePos.bz>maxZ) maxZ=s.mePos.bz;
    }
  }
}
console.log(`shots from 14m+: ${far}`);
console.log(`  goal ${farGoal}  saved ${farSave}  blocked ${farBlock}  dead-ball(wide/behind) ${farWide}  picked up in play ${farOther}`);
console.log(`  max ball height seen during a long shot's flight: ${maxZ.toFixed(2)} m  (crossbar 2.44)`);
