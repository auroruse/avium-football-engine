const { buildSquad, createMatchState, pitchSlots, meInit, meShotP, meAttrs, STRAT_DEF } = await import("./engine.mjs");
const raw = buildSquad("4-3-3",null).filter(p=>!p.bench);
console.log("atkW values from buildSquad:", raw.map(p=>`${p.pos}:${p.atkW}`).join(" "));
const sq=(o)=>raw.map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
// Move every away player far away so pressure is zero -- isolate the geometry.
s.players.away.forEach(p=>{p.x=2;p.y=2;});
const f = s.players.home.find(p=>p.pos==="FWD");
console.log("FWD attrs:", JSON.stringify(meAttrs(f)));
console.log("unpressured meShotP by distance (real xG: 6m .35, 11m .16, 16m .08, 22m .035, 30m .015):");
for (const d of [6,11,16,22,26,30,34,38]) console.log(`  ${String(d).padStart(2)}m  ${meShotP(s,"home",f,105-d,34).toFixed(4)}`);
