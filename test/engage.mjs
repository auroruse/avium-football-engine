process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(8);
let held=0, inRange=0, nd=[], hasPresser=0, thirds=[0,0,0], inR3=[0,0,0], held3=[0,0,0];
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  if(mp.idx>=0){
    held++;
    const p=s.players[mp.side][mp.idx], dir=mp.side==="home"?1:-1, own=meGoalX(mp.side==="home"?"away":"home");
    const depth=(p.x-own)*dir;
    const th = depth<35?0:depth<70?1:2; held3[th]++;
    let m=Infinity;
    for(const q of s.players[mp.side==="home"?"away":"home"]) if(q.pos!=="GK") m=Math.min(m,Math.hypot(q.x-p.x,q.y-p.y));
    nd.push(m); if(m<=3.2){ inRange++; inR3[th]++; }
    if(s.players[mp.side==="home"?"away":"home"].some(q=>q._duty==="press")) hasPresser++;
  }
  meTick(s,rng,out);
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/a.length;
console.log(`carrier-ticks ${held}`);
console.log(`  someone within TACKLE range (3.2 m): ${(100*inRange/held).toFixed(0)}%   <- the tackle roll only exists here`);
console.log(`  a presser was even assigned:         ${(100*hasPresser/held).toFixed(0)}%`);
console.log(`  mean nearest opponent: ${mean(nd).toFixed(1)} m  (real: a carrier in the middle third has someone inside 3 m most of the time)`);
console.log(`by third (own/middle/final): in-range ${["own","mid","final"].map((n,i)=>`${n} ${(100*inR3[i]/Math.max(1,held3[i])).toFixed(0)}%`).join("  ")}`);
