// Do stoppages actually play out? Nobody frozen, nobody teleported, and each restart delivered.
process.env.QUIET="1";
const eng=await import("./engine.mjs");
const {RNG,buildSquad,createMatchState,pitchSlots,meInit,meTick,ME_MATCH_TICKS,STRAT_DEF,CFG}=eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
  corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
const kinds={}, dur={}, spd=[], jumps=[]; let spSlices=0, frozen=0, maxJump=0;
for(let seed=1;seed<=5;seed++){
  const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
  s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s,pitchSlots);
  const rng=new RNG(seed);
  let prev=null, cur=null;
  for(let t=0;t<ME_MATCH_TICKS;t++){
    const mp=s.mePos;
    const before=s.players.home.concat(s.players.away).map(p=>[p.x,p.y]);
    if(mp.sp && !cur){ cur={kind:mp.sp.kind,t0:t}; kinds[mp.sp.kind]=(kinds[mp.sp.kind]||0)+1; }
    meTick(s,rng,out);
    if(cur && !mp.sp){ (dur[cur.kind]=dur[cur.kind]||[]).push(t-cur.t0); cur=null; }
    if(mp.sp){
      spSlices++;
      const after=s.players.home.concat(s.players.away);
      let moved=0, mx=0;
      for(let i=0;i<after.length;i++){
        const d=Math.hypot(after[i].x-before[i][0],after[i].y-before[i][1]);
        if(d>0.05) moved++; if(d>mx) mx=d;
      }
      spd.push(moved); if(mx>maxJump) maxJump=mx; jumps.push(mx);
      if(moved===0) frozen++;
    }
  }
}
const mean=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`set-piece slices: ${spSlices}   of which nobody moved at all: ${frozen} (${(100*frozen/spSlices).toFixed(0)}%)`);
console.log(`players moving during a stoppage: ${mean(spd).toFixed(1)} of 22 per slice`);
console.log(`biggest single-slice jump by anyone: ${maxJump.toFixed(2)} m  (a teleport would be 20 m+)`);
console.log("restarts and how long they took:");
for(const k of Object.keys(kinds))
  console.log(`  ${k.padEnd(9)} ${String(kinds[k]).padStart(3)}x   ${(mean(dur[k]||[0])/4).toFixed(2)}s`);
