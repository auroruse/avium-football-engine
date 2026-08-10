const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meShotP, meVal, ME_TPM, STRAT_DEF } = await import("./engine.mjs");
const sq = (o) => buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,atkW:p.atkW??0.5}));
const s = createMatchState();
s.players.home = sq(75); s.players.away = sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}};
s.possession="home"; meInit(s, pitchSlots);
const shooter = s.players.home.find(p=>p.pos==="FWD");
console.log("meShotP for a 75 FWD, centrally, by distance from goal:");
for (const d of [6,10,14,18,22,26,30,36]) {
  const x = 105 - d;
  console.log(`  ${String(d).padStart(2)}m  shotP ${meShotP(s,"home",shooter,x,34).toFixed(3)}   meVal(here) ${meVal("home",x,34).toFixed(3)}   meVal(+4m) ${meVal("home",x+4,34).toFixed(3)}`);
}
// Action mix over a real match.
const rng = new RNG(5);
const out = { poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0}, onTarget:{home:0,away:0},
              saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
              passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0 };
for (let t=0;t<90*ME_TPM;t++) meTick(s,rng,out);
const shots = out.shots.home+out.shots.away;
console.log(`\naction mix over one match: ${out.passes} passes, ${out.carries} carries, ${shots} shots, ${out.clears} clears`);
console.log(`  -> shots are ${(100*shots/(out.passes+out.carries+shots+out.clears)).toFixed(1)}% of all actions (real ~2.5%)`);
