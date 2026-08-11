// When the ball is near our goal, where actually ARE our ten outfielders?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(15);
let n=0, inBox=0, in25=0, deep=[], span=[], duties={};
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  if(mp.idx>=0){
    const atk=mp.side, def=atk==="home"?"away":"home";
    const own=meGoalX(atk), dir=def==="home"?1:-1;          // own = defender's own goal
    const ballDepth=(mp.bx-own)*dir;                        // ball distance from the DEFENDING goal
    if(ballDepth<28){                                       // ball on the edge of our box or inside
      n++;
      const ds=s.players[def].filter(p=>p.pos!=="GK").map(p=>(p.x-own)*dir);
      inBox += ds.filter(d=>d<18).length;                   // inside the penalty area depth
      in25  += ds.filter(d=>d<25).length;
      deep.push(Math.min(...ds)); span.push(Math.max(...ds)-Math.min(...ds));
      for(const p of s.players[def]) duties[p._duty]=(duties[p._duty]||0)+1;
    }
  }
  meTick(s,rng,out);
}
const mean=(a)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
console.log(`slices with the ball within 28 m of a goal: ${n}`);
console.log(`  defenders inside 18 m (the box):  ${(inBox/n).toFixed(1)} of 10   (real: 7-9)`);
console.log(`  defenders inside 25 m:            ${(in25/n).toFixed(1)} of 10   (real: 9-10)`);
console.log(`  deepest outfielder sits at ${mean(deep).toFixed(1)} m; block depth ${mean(span).toFixed(1)} m  (real block defending its box: ~20-25 m)`);
const tot=Object.values(duties).reduce((a,b)=>a+b,0)||1;
console.log("  duties while under siege: " + Object.entries(duties).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/tot).toFixed(0)}%`).join("  "));
