process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const rng=new RNG(3);
let printed=0, last=null;
for(let t=0;t<ME_MATCH_TICKS && printed<26;t++){
  const mp=s.mePos;
  const key=mp.idx>=0?`${mp.side}${mp.idx}`:"--";
  if(mp.idx>=0 && t>120){
    const p=s.players[mp.side][mp.idx];
    console.log(`t${t} ${key.padEnd(7)} man(${p.x.toFixed(1)},${p.y.toFixed(1)}) v${(Math.hypot(p.vx||0,p.vy||0)/0.25).toFixed(1)}  ball(${mp.bx.toFixed(1)},${mp.by.toFixed(1)}) bv${Math.hypot(mp.bvx,mp.bvy).toFixed(1)}  gap ${Math.hypot(p.x-mp.bx,p.y-mp.by).toFixed(2)}  hold ${mp.hold}`);
    printed++;
  }
  meTick(s,rng,out);
}
