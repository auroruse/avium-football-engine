// At the moment a chance is taken: is the shooter anybody's man, what is the defending side doing,
// and how long has it been since they lost the ball?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, meGoalX, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let marked=0, unmarked=0, nShot=0;
const phases={}, mkGap=[], sinceLost=[], nBox=[];
for(let seed=1;seed<=6;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  let lastTurnover=0, lastSide=null;
  for(let t=0;t<90*ME_TPM;t++){
    const mp=s.mePos;
    if(mp.idx>=0 && mp.side!==lastSide){ lastSide=mp.side; lastTurnover=t; }
    if(mp.idx>=0){
      const atk=mp.side, def=atk==="home"?"away":"home";
      const act=meDecide(s,rng,atk,mp.idx);
      if(act && act.k==="shot"){
        nShot++;
        const p=s.players[atk][mp.idx], ds=s.players[def];
        const mk=ds.find(q=>q._duty==="mark" && q._mk===mp.idx);
        if(mk){ marked++; mkGap.push(Math.hypot(mk.x-p.x,mk.y-p.y)); } else unmarked++;
        phases[mp.phase[def]]=(phases[mp.phase[def]]||0)+1;
        sinceLost.push((t-lastTurnover)/4);
        const own=meGoalX(atk);
        nBox.push(ds.filter(q=>q.pos!=="GK" && Math.abs(q.x-own)<18).length);
      }
    }
    meTick(s,rng,out);
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`chances taken: ${nShot}`);
console.log(`  the shooter was somebody's man   ${marked}  (${(100*marked/nShot).toFixed(0)}%), marker ${mean(mkGap).toFixed(1)} m away`);
console.log(`  nobody had him at all            ${unmarked}  (${(100*unmarked/nShot).toFixed(0)}%)`);
console.log(`  defending side's phase: ` + Object.entries(phases).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/nShot).toFixed(0)}%`).join("  "));
console.log(`  ${mean(sinceLost).toFixed(1)}s since they lost it; ${mean(nBox).toFixed(1)} of their outfielders inside the box`);
