// How tightly is an attacker in the box actually picked up, and does a receiver have anybody on him
// at the moment the ball reaches him?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let inBoxN=0, inBoxHasMk=0, inBoxTight=0;
const mkGap=[], recvGap=[];
const duties={};
let recvN=0, recvTight=0;
for(let seed=1;seed<=4;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  let prevIdx=-1, prevSide=null;
  for(let t=0;t<90*ME_TPM;t++){
    const mp=s.mePos;
    const atk=mp.side, def=atk==="home"?"away":"home", own=meGoalX(atk);
    // every attacker standing in the opponent box while the other side has possession of the ball
    if(mp.idx>=0 && Math.abs(mp.bx-own)<30){
      for(let j=0;j<s.players[atk].length;j++){
        const q=s.players[atk][j];
        if(q.pos==="GK" || j===mp.idx) continue;
        if(Math.abs(q.x-own)>18) continue;
        inBoxN++;
        const mk=s.players[def].find(d2=>d2._duty==="mark" && d2._mk===j);
        if(mk){ inBoxHasMk++; mkGap.push(Math.hypot(mk.x-q.x,mk.y-q.y)); }
        let near=Infinity;
        for(const d2 of s.players[def]) if(d2.pos!=="GK") near=Math.min(near,Math.hypot(d2.x-q.x,d2.y-q.y));
        if(near<3) inBoxTight++;
      }
      for(const d2 of s.players[def]) duties[d2._duty]=(duties[d2._duty]||0)+1;
    }
    meTick(s,rng,out);
    // a new man just took possession: who was on him?
    if(mp.idx>=0 && (mp.idx!==prevIdx || mp.side!==prevSide)){
      const p=s.players[mp.side][mp.idx], ds=s.players[mp.side==="home"?"away":"home"];
      if(Math.abs(p.x-meGoalX(mp.side))<25 && p.pos!=="GK"){
        let near=Infinity;
        for(const d2 of ds) if(d2.pos!=="GK") near=Math.min(near,Math.hypot(d2.x-p.x,d2.y-p.y));
        recvN++; recvGap.push(near); if(near<3) recvTight++;
      }
      prevIdx=mp.idx; prevSide=mp.side;
    }
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`attacker-in-the-box sightings: ${inBoxN}`);
console.log(`  had a marker assigned to him   ${(100*inBoxHasMk/inBoxN).toFixed(0)}%, that marker ${mean(mkGap).toFixed(1)} m away`);
console.log(`  ANY defender within 3 m        ${(100*inBoxTight/inBoxN).toFixed(0)}%`);
console.log(`taking possession inside 25 m of goal: ${recvN} times, nearest defender ${mean(recvGap).toFixed(1)} m, within 3 m on ${(100*recvTight/recvN).toFixed(0)}%`);
const tot=Object.values(duties).reduce((a,b)=>a+b,0)||1;
console.log("defending duties while the ball is inside 30 m: " + Object.entries(duties).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/tot).toFixed(0)}%`).join("  "));
