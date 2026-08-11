process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {CFG}=eng;
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,ME_MATCH_TICKS,STRAT_DEF,meAttrs,meSpeed}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
function run(){
  let n=0,err=0,spd=0,frac=0,inBox=0,sieges=0;
  const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
    corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
  for(let seed=1;seed<=4;seed++){
    const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
    s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
    const rng=new RNG(seed);
    for(let t=0;t<ME_MATCH_TICKS;t++){
      const mp=s.mePos;
      if(mp.idx>=0){
        const atk=mp.side, def=atk==="home"?"away":"home", own=meGoalX(atk), dir=def==="home"?1:-1;
        if((mp.bx-own)*dir<28){
          sieges++;
          const ds=s.players[def].filter(p=>p.pos!=="GK");
          inBox+=ds.filter(p=>(p.x-own)*dir<18).length;
          for(const p of ds){
            const e=Math.hypot(p.x-(p._sx??p.x),p.y-(p._sy??p.y));
            if(e>3){ n++; err+=e; const v=Math.hypot(p.vx||0,p.vy||0)/0.25, vm=meSpeed(meAttrs(p),p.stamina);
                     spd+=v; frac+=v/vm; }
          }
        }
      }
      meTick(s,rng,out);
    }
  }
  return {err:err/n, spd:spd/n, frac:100*frac/n, inBox:inBox/sieges};
}
console.log("turnPenalty blkSlide sepW |  err   speed  %ofmax  inBox");
for(const [tp,bs,sw] of [[0.55,0.55,0.25],[0,0.55,0.25],[0.55,0.30,0.25],[0.55,0.55,0],[0,0.30,0]]){
  CFG.turnPenalty=tp; CFG.blkSlide=bs; CFG.sepW=sw;
  const r=run();
  console.log(`${String(tp).padStart(11)} ${String(bs).padStart(8)} ${String(sw).padStart(4)} | ${r.err.toFixed(1).padStart(4)} ${r.spd.toFixed(2).padStart(6)}  ${r.frac.toFixed(0).padStart(5)}%  ${r.inBox.toFixed(1)}`);
}
