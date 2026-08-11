// Defenders in the box, split by how long the ball has been down there. A block that is still
// running back is a different thing from a block that has had time to set.
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,ME_MATCH_TICKS,STRAT_DEF}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const B=[0,4,8,16,999], L=["just arrived (<1s)","1-2s","2-4s","settled 4s+"];
const box=B.map(()=>0), err=B.map(()=>0), gap=B.map(()=>0), gn=B.map(()=>0), n=B.map(()=>0);
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed); let siege=0;
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0 && !mp.sp){
      const atk=mp.side, def=atk==="home"?"away":"home", own=meGoalX(atk), dir=def==="home"?1:-1;
      const bd=(mp.bx-own)*dir;
      if(bd<28){
        siege++;
        const k=B.findIndex((b,i)=>siege>=b && siege<B[i+1]);
        if(k>=0){
          n[k]++;
          const ds=s.players[def].filter(p=>p.pos!=="GK");
          box[k]+=ds.filter(p=>(p.x-own)*dir<18).length;
          for(const p of ds) err[k]+=Math.hypot(p.x-(p._sx??p.x),p.y-(p._sy??p.y));
          for(let j=0;j<s.players[atk].length;j++){
            const q=s.players[atk][j];
            if(q.pos==="GK"||j===mp.idx||Math.abs(q.x-own)>18) continue;
            let near=Infinity;
            for(const d2 of ds) near=Math.min(near,Math.hypot(d2.x-q.x,d2.y-q.y));
            gap[k]+=near; gn[k]++;
          }
        }
      } else siege=0;
    } else if(!mp.sp) siege=0;
    meTick(s,rng,out);
  }
}
console.log("how long under siege   slices   in box/10   man off his slot   nearest def to a man in the box");
for(let k=0;k<L.length;k++) if(n[k])
  console.log(`${L[k].padEnd(22)} ${String(n[k]).padStart(6)}   ${(box[k]/n[k]).toFixed(1).padStart(9)}   ${(err[k]/n[k]/10).toFixed(1).padStart(15)} m   ${(gn[k]?gap[k]/gn[k]:0).toFixed(1).padStart(10)} m`);
