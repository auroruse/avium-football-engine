// Which passes fail, and why? Completion by distance, by flight time, and where the cutter was.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const mk=()=>{const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots); return s;};
const blank=()=>({poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0});
// distance bands, then: attempts, completions, total flight slices
const B=[0,8,15,25,40,999], lbl=["<8m","8-15","15-25","25-40","40+"];
const att=B.map(()=>0), ok=B.map(()=>0), fl=B.map(()=>0);
let highAtt=0, highOk=0, lowAtt=0, lowOk=0;
for(let seed=1;seed<=4;seed++){
  const s=mk(), out=blank(), rng=new RNG(seed);
  let live=null;
  for(let t=0;t<90*ME_TPM;t++){
    const mp=s.mePos, hadIdx=mp.idx, hadSide=mp.side, hx=mp.bx, hy=mp.by;
    meTick(s,rng,out);
    if(hadIdx>=0 && mp.idx<0 && mp.passPending){
      const j=mp.fj, tgt=s.players[hadSide][j];
      live={ d:Math.hypot(tgt.x-hx,tgt.y-hy), t0:t, high:mp.bvz>1, side:hadSide };
    } else if(live){
      if(mp.idx>=0){                                     // somebody has it
        const bi=B.findIndex((b,k)=>live.d>=b && live.d<B[k+1]);
        att[bi]++; fl[bi]+=t-live.t0;
        const good=mp.side===live.side;
        if(good) ok[bi]++;
        if(live.high){highAtt++; if(good)highOk++;} else {lowAtt++; if(good)lowOk++;}
        live=null;
      } else if(!mp.flight){ live=null; }                // out of play
    }
  }
}
console.log("band    attempts  completed  flight");
for(let k=0;k<lbl.length;k++) if(att[k])
  console.log(`${lbl[k].padEnd(8)} ${String(att[k]).padStart(6)}   ${(100*ok[k]/att[k]).toFixed(0).padStart(6)}%   ${(fl[k]/att[k]/4).toFixed(2)}s`);
console.log(`ground ${lowAtt} at ${(100*lowOk/(lowAtt||1)).toFixed(0)}%   lofted ${highAtt} at ${(100*highOk/(highAtt||1)).toFixed(0)}%`);
