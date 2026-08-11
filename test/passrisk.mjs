// Does the DECISION know which passes will fail? Predicted risk vs what actually happened.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, mePassRisk,
        meGroundSpeed, meLoftFor, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(15);
// risk buckets 0-.2 .2-.4 .4-.6 .6-.8 .8-1
const att=[0,0,0,0,0], ok=[0,0,0,0,0];
let pred=null, live=null;
// how long does a ground pass ACTUALLY take vs what the risk model assumes?
const tReal=[], tModel=[];
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  pred=null;
  if(mp.idx>=0){
    const act=meDecide(s,rng,mp.side,mp.idx);
    if(act && act.k==="pass"){
      const p=s.players[mp.side][mp.idx];
      const d=Math.hypot(act.ax-p.x,act.ay-p.y);
      const spd=act.high?meLoftFor(d).vxy:meGroundSpeed(d);
      pred={ risk:mePassRisk(s,mp.side,p.x,p.y,act.ax,act.ay,spd), d, spd, high:act.high };
    }
  }
  const hadIdx=mp.idx, hadSide=mp.side;
  meTick(s,rng,out);
  if(hadIdx>=0 && mp.idx<0 && mp.passPending && pred){ live={...pred, t0:t, side:hadSide}; }
  else if(live){
    if(mp.idx>=0){
      const b=Math.min(4,Math.floor(live.risk*5));
      att[b]++; if(mp.side===live.side) ok[b]++;
      if(!live.high){ tReal.push((t-live.t0)/4); tModel.push(live.d/live.spd); }
      live=null;
    } else if(!mp.flight) live=null;
  }
}
console.log("predicted risk   attempts  actually completed");
const lbl=["0.0-0.2","0.2-0.4","0.4-0.6","0.6-0.8","0.8-1.0"];
for(let k=0;k<5;k++) if(att[k]) console.log(`  ${lbl[k]}        ${String(att[k]).padStart(5)}      ${(100*ok[k]/att[k]).toFixed(0).padStart(3)}%`);
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`ground flight: really ${mean(tReal).toFixed(2)}s, the risk model assumes ${mean(tModel).toFixed(2)}s`);
