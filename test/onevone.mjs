// A clean one-on-one: forward on the ball 24 m out, keeper, nobody else. Real football converts
// these around 35-40%. How does it end?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meBallTo, CFG, ME_HALF_W, PITCH_L, STRAT_DEF } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const N = 300;
const run = (label) => {
const end = {}; let shots = 0, goals = 0;
for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  // everyone off the pitch except the striker and the away keeper
  for (const sd of ["home","away"]) s.players[sd].forEach((p, i) => {
    if (sd === "away" && p.pos === "GK") { p.x = PITCH_L - 1.5; p.y = ME_HALF_W; }
    else if (sd === "home" && i === 10) { p.x = PITCH_L - 24; p.y = ME_HALF_W + (seed % 7 - 3) * 2.2; }
    else { p.x = 4; p.y = 2 + (i * 5) % 60; }
    p.vx = 0; p.vy = 0;
  });
  const st = s.players.home[10];
  meBallTo(s, "home", 10, st.x + 0.5, st.y);
  const out = blank(), rng = new RNG(seed * 7919);
  let how = "ran out of time";
  for (let t = 0; t < 60; t++) {
    const g0 = out.goals.home, sv0 = out.saves.away, sh0 = out.shots.home;
    meTick(s, rng, out);
    if (out.shots.home > sh0) shots++;
    if (out.goals.home > g0) { how = "GOAL"; goals++; break; }
    if (out.saves.away > sv0) { how = s.mePos.held ? "keeper claimed it" : "keeper saved / smothered"; break; }
    if (s.mePos.sp) { how = "out of play (" + s.mePos.sp.kind + ")"; break; }
    if (s.mePos.idx >= 0 && s.mePos.side === "away") { how = "keeper won the ball"; break; }
  }
  end[how] = (end[how] || 0) + 1;
}
const top = Object.keys(end).sort((a,b)=>end[b]-end[a])[0];
console.log(`  ${label.padEnd(34)} scored ${(100*goals/N).toFixed(1).padStart(5)}%   shots ${(100*shots/N).toFixed(0).padStart(4)}%   mostly: ${top}`);
};
console.log("\n300 clean one-on-ones from 24 m each  (real football converts about 35-40%)");
const V = CFG.gkDiveV;
for (const [dv, ab, ask] of [[3.9,0.25,0.60],[3.9,0.45,0.50],[2.9,0.45,0.50],[2.9,0.55,0.42],[2.4,0.45,0.50],[2.4,0.55,0.42],[2.9,0.35,0.55]]) {
  CFG.gkDiveV = dv; CFG.shotAimBase = ab; CFG.shotAimSkill = ask;
  run(`diveV ${dv}  aim ${ab}+${ask}k`);
}
CFG.gkDiveV = V;
