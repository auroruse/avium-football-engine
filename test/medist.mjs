const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, mePressure, ME_TPM, STRAT_DEF } = await import("./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
           corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
const rng=new RNG(5);
for(let t=0;t<ME_TPM*20;t++) meTick(s,rng,out);
console.log(`minute 20. ball at x=${s.mePos.bx.toFixed(0)} y=${s.mePos.by.toFixed(0)}  holder=${s.mePos.idx>=0?s.mePos.side+"#"+s.mePos.idx:"loose"}  dead=${s.mePos.dead}`);
console.log("\nhome player -> distance to nearest away player, and his _mk / _closing:");
for (const p of s.players.home) {
  const d = Math.min(...s.players.away.map(q=>Math.hypot(q.x-p.x,q.y-p.y)));
  console.log(`  ${p.pos.padEnd(3)} at ${p.x.toFixed(0).padStart(3)}/${p.y.toFixed(0).padStart(2)}   nearest opponent ${d.toFixed(1)}m   press ${mePressure(s,"home",p.x,p.y).toFixed(2)}`);
}
console.log("\naway markers: " + s.players.away.map(p=>`${p.pos}:_mk=${p._mk ?? "-"}${p._closing?" CLOSING":""}`).join("  "));
console.log(`\nmatch so far: ${out.passes} passes (${(100*out.passOk/(out.passes||1)).toFixed(0)}%), ${out.carries} carries, ${out.shots.home+out.shots.away} shots, ${out.tackles} tackles, inplay ${(out.inplay/ME_TPM).toFixed(0)}m of 20`);
