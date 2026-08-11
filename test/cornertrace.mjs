// Watch a corner: does he set himself off to one side, run at it, and does the side follow his foot?
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meFoot,meGoalX,ME_HALF_W,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
let shown=0, L=0, R=0, offs=[];
for(let seed=1;seed<=6 && shown<2;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed); let seen=null;
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.sp && mp.sp.kind==="corner"){
      const sp=mp.sp, tk=s.players[sp.side][sp.ti], f=meFoot(tk), gx=meGoalX(sp.side);
      // signed offset of the taker from the ball->goal line
      const ax=gx-sp.x, ay=ME_HALF_W-sp.y, al=Math.hypot(ax,ay)||1;
      const off=(-(ay/al))*(tk.x-sp.x)+(ax/al)*(tk.y-sp.y);
      if(seen!==sp){ seen=sp; offs.push({f,off}); if(f<0)L++; else R++;
        if(shown<2){ shown++; console.log(`\ncorner: taker ${tk.name} nat-width ${(tk._bw0||0).toFixed(0)} -> ${f<0?"LEFT":"RIGHT"} footed`); } }
      if(shown && shown<=2 && seen===sp && t%3===0)
        console.log(`   d-to-ball ${Math.hypot(tk.x-sp.x,tk.y-sp.y).toFixed(2)} m  side-offset ${off.toFixed(2)}  ${sp.run?"RUNNING UP":"setting"}`);
    }
    meTick(s,rng,out);
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`\n${offs.length} corners: ${L} left-footed takers, ${R} right-footed`);
console.log(`  mean side-offset when left-footed  ${mean(offs.filter(o=>o.f<0).map(o=>o.off)).toFixed(2)} m`);
console.log(`  mean side-offset when right-footed ${mean(offs.filter(o=>o.f>0).map(o=>o.off)).toFixed(2)} m`);
