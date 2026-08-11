// How much of an edge should a defender need before he steps in front of his man?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

console.log("cutEdge hold   fires  won   hit%   completion  shots/side  goals/side");
for (const [edge, hold] of [[80,3],[150,2],[150,3],[150,5],[250,3],[400,3],[250,5]]) {
  CFG.cutEdge = edge; CFG.cutHold = hold;
  let fires = 0, won = 0, pa = 0, ok = 0, sh = 0, go = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    let prev = 0, wasPass = false;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const before = s.players.home.concat(s.players.away).filter(q => (q._cut ?? 0) > 0).length;
      const had = !!mp.passPending, side = mp.fside;
      meTick(s, rng, out);
      const after = s.players.home.concat(s.players.away).filter(q => (q._cut ?? 0) > 0).length;
      if (after > before) fires += after - before;
      if (had && !mp.passPending && mp.idx >= 0 && mp.side !== side && (s.players[mp.side][mp.idx]._cut ?? 0) > 0) won++;
    }
    pa += out.passes; ok += out.passOk; sh += out.shots.home + out.shots.away; go += out.goals.home + out.goals.away;
  }
  console.log(`${String(edge).padStart(7)} ${String(hold).padStart(4)}  ${String(fires).padStart(6)} ${String(won).padStart(4)}` +
    `  ${(100*won/(fires||1)).toFixed(0).padStart(4)}%  ${(100*ok/(pa||1)).toFixed(0).padStart(9)}%` +
    `  ${(sh/8).toFixed(1).padStart(10)}  ${(go/8).toFixed(2).padStart(10)}`);
}
