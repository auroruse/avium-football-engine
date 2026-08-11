// Stop guessing: print the defending side, man by man, while the ball is in their box.
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,ME_TPM,STRAT_DEF,meAttrs,meSpeed}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const rng=new RNG(7);
let shown=0;
for(let t=0;t<90*ME_TPM && shown<3;t++){
  const mp=s.mePos;
  if(mp.idx>=0){
    const atk=mp.side, def=atk==="home"?"away":"home", own=meGoalX(atk), dir=def==="home"?1:-1;
    if((mp.bx-own)*dir < 22 && t>200){
      shown++;
      console.log(`\n--- t=${t}  ball at depth ${((mp.bx-own)*dir).toFixed(1)} m, y ${mp.by.toFixed(1)}  (${def} defending)`);
      console.log("  name   duty        slot          target        actual        err   speed/max");
      for(const p of s.players[def]){
        if(p.pos==="GK") continue;
        const err=Math.hypot(p.x-(p._sx??p.x),p.y-(p._sy??p.y));
        const v=Math.hypot(p.vx||0,p.vy||0)/0.25, vm=meSpeed(meAttrs(p),p.stamina);
        console.log(`  ${p.name.padEnd(6)} ${String(p._duty).padEnd(10)} `+
          `${((p._sx-own)*dir).toFixed(1).padStart(5)},${(p._sy??0).toFixed(1).padStart(5)}  `+
          `${(((p._tx??p.x)-own)*dir).toFixed(1).padStart(5)},${(p._ty??0).toFixed(1).padStart(5)}  `+
          `${((p.x-own)*dir).toFixed(1).padStart(5)},${p.y.toFixed(1).padStart(5)}  `+
          `${err.toFixed(1).padStart(4)}  ${v.toFixed(1)}/${vm.toFixed(1)}`);
      }
    }
  }
  meTick(s,rng,out);
}
