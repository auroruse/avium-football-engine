const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF, PITCH_L, PITCH_W } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
console.log("base slots (metres from own goal / across):");
console.log("  " + s.players.home.map(p=>`${p.pos}:${p._bd.toFixed(0)}/${p._bw.toFixed(0)}`).join("  "));
const rng=new RNG(4);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
           corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
for(let t=0;t<ME_TPM*10;t++) meTick(s,rng,out);
const span=(ps,f)=>{const v=ps.filter(p=>p.pos!=="GK").map(f);return `${Math.min(...v).toFixed(0)}-${Math.max(...v).toFixed(0)} (span ${(Math.max(...v)-Math.min(...v)).toFixed(0)})`;};
console.log(`\nafter 10 min, ball at x=${s.mePos.bx.toFixed(0)} y=${s.mePos.by.toFixed(0)}`);
console.log(`home x ${span(s.players.home,p=>p.x)}   y ${span(s.players.home,p=>p.y)}`);
console.log(`away x ${span(s.players.away,p=>p.x)}   y ${span(s.players.away,p=>p.y)}`);
console.log(`real football: x span ~45m, y span ~50m`);
console.log("\nhome outfield positions x/y:");
console.log("  " + s.players.home.filter(p=>p.pos!=="GK").map(p=>`${p.pos}:${p.x.toFixed(0)}/${p.y.toFixed(0)}`).join("  "));
// Jitter: how far does a player move per tick, and does he reverse direction?
let flips=0, tot=0; const prev=s.players.home.map(p=>({vx:p.vx,vy:p.vy}));
for(let t=0;t<40;t++){ meTick(s,rng,out);
  s.players.home.forEach((p,i)=>{ if(p.pos==="GK")return; tot++;
    if(prev[i].vx*p.vx+prev[i].vy*p.vy<0) flips++; prev[i]={vx:p.vx,vy:p.vy}; }); }
console.log(`\njitter: direction reversed on ${(100*flips/tot).toFixed(0)}% of ticks (a real player almost never reverses at 4Hz)`);
