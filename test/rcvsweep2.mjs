process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const N = 12;
console.log("contest  stop   completion  passes/side  shots/side  goals/side  out/match");
for (const [cm, st] of [[-9e9,1.3],[400,1.3],[400,0.9],[400,0.7],[400,0.5]]) {
  CFG.contestMs = cm; CFG.scrambleStop = st;
  let pa=0, ok=0, sh=0, go=0, outs=0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const wasSp = !!s.mePos.sp;
      meTick(s, rng, out);
      if (!wasSp && s.mePos.sp && ["throw","corner","goalkick"].includes(s.mePos.sp.kind)) outs++;
    }
    pa += out.passes; ok += out.passOk; sh += out.shots.home + out.shots.away; go += out.goals.home + out.goals.away;
  }
  console.log(`${(cm < -1e8 ? "off" : String(cm)).padStart(7)} ${st.toFixed(2).padStart(5)}  ${(100*ok/(pa||1)).toFixed(0).padStart(9)}%` +
    `  ${(pa/N/2).toFixed(0).padStart(11)}  ${(sh/N/2).toFixed(1).padStart(10)}  ${(go/N/2).toFixed(2).padStart(10)}  ${(outs/N).toFixed(1).padStart(9)}`);
}
