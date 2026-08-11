// Where is the block's LINE, against where it should be? Absolute depths, not spans.
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,meGoalX,ME_MATCH_TICKS,STRAT_DEF,CFG}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const B=[[0,20],[20,35],[35,55],[55,105]], L=["ball in our box","20-35 m","35-55 m","55 m+"];
const want=B.map(()=>0), got=B.map(()=>0), back=B.map(()=>0), n=B.map(()=>0);
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    if(mp.idx>=0 && !mp.sp){
      const atk=mp.side, def=atk==="home"?"away":"home";
      const own=meGoalX(atk), dir=def==="home"?1:-1;
      const bd=(mp.bx-own)*dir;
      const bi=B.findIndex(([a,b])=>bd>=a&&bd<b);
      if(bi>=0 && mp.blk[def]){
        const st=s.strategy[def]||{};
        const w=Math.max(CFG.blkMin,Math.min(CFG.blkMax, bd-CFG.blkDrop+(st.defLine||0)*CFG.blkDefLine+(st.pressingLOE||0)*CFG.blkLoe));
        want[bi]+=w; got[bi]+=mp.blk[def].line;
        const ds=s.players[def].filter(p=>p.pos!=="GK").map(p=>(p.x-own)*dir);
        back[bi]+=Math.min(...ds); n[bi]++;
      }
    }
    meTick(s,rng,out);
  }
}
console.log("ball depth        slices   line WANTED   line HELD   deepest man");
for(let k=0;k<B.length;k++) if(n[k])
  console.log(`${L[k].padEnd(16)} ${String(n[k]).padStart(6)}   ${(want[k]/n[k]).toFixed(1).padStart(11)}   ${(got[k]/n[k]).toFixed(1).padStart(9)}   ${(back[k]/n[k]).toFixed(1).padStart(11)}`);
