// Does the ball ever MOVE without its velocity explaining the move? That is a teleport, and it is
// what "sliding around" looks like on screen.
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let n=0, jump=0, big=0, sum=0;
for(let seed=1;seed<=4;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx<0 && mp.sp) { meTick(s,rng,out); continue; }
    const bx=mp.bx, by=mp.by, vx=mp.bvx, vy=mp.bvy;
    meTick(s,rng,out);
    if(mp.sp) continue;
    // how far it went, versus how far its velocity at the start of the slice would carry it
    const moved=Math.hypot(mp.bx-bx,mp.by-by), byV=Math.hypot(vx,vy)*0.25;
    const d=Math.abs(moved-byV);
    n++; sum+=d; if(d>0.35) jump++; if(d>0.8) big++;
  }
}
console.log(`in-play slices: ${n}`);
console.log(`  mean unexplained ball movement per slice: ${(sum/n).toFixed(3)} m`);
console.log(`  slices with a jump over 0.35 m: ${(100*jump/n).toFixed(1)}%   over 0.8 m: ${(100*big/n).toFixed(1)}%`);
