// When a player has a CLEAR route to goal, what does he actually do?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, meLaneBlock, meGoalX, ME_TPM, STRAT_DEF } = eng;
eng.CFG.holdBase = 13; eng.CFG.carryAdv = 8;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const rng=new RNG(6);
let thru={fwd:0,back:0,shot:0,carry:0}, set={fwd:0,back:0,shot:0,carry:0};
for(let t=0;t<90*ME_TPM;t++){
  const mp=s.mePos;
  if(mp.idx>=0){
    const side=mp.side, p=s.players[side][mp.idx], dir=side==="home"?1:-1;
    let gs=0; for(const q of s.players[side==="home"?"away":"home"]) if(q.pos!=="GK" && (q.x-p.x)*dir>0 && Math.abs(q.y-p.y)<20) gs++;
    const d=Math.hypot(meGoalX(side)-p.x, 34-p.y);
    if (d < 40) {
      const act=meDecide(s,rng,side,mp.idx);
      const bucket = gs<=1 ? thru : set;
      if(act.k==="shot") bucket.shot++;
      else if(act.k==="carry") bucket.carry++;
      else if(act.k==="pass"){ const q=s.players[side][act.j]; ((q.x-p.x)*dir>0?bucket.fwd++:bucket.back++); }
    }
  }
  meTick(s,rng,out);
}
const pct=(b)=>{const n=b.fwd+b.back+b.shot+b.carry||1; return `shoot ${(100*b.shot/n).toFixed(0)}%  carry ${(100*b.carry/n).toFixed(0)}%  fwd-pass ${(100*b.fwd/n).toFixed(0)}%  back/square ${(100*b.back/n).toFixed(0)}%`;};
console.log(`CLEAR run at goal (<=1 defender goal-side): ${pct(thru)}`);
console.log(`DEFENCE SET (2+ goal-side):                 ${pct(set)}`);
