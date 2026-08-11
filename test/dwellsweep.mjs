// What should holding the ball past your touch budget cost? dwellDrop 0 is the old outright ban.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

console.log("dwellDrop  completion  passes/side  carries/side  shots/side  goals/side  s on ball   p95    max");
for (const dd of [0.90, 0.93, 0.95, 0.97, 1.0]) {
  CFG.dwellDrop = dd;
  let pa = 0, ok = 0, ca = 0, sh = 0, go = 0, holds = [], N = 16;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    let last = null, run = 0;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const key = mp.idx >= 0 ? `${mp.side}${mp.idx}` : null;
      if (key && key === last) run++; else { if (run > 0) holds.push(run); run = 0; }
      last = key;
      meTick(s, rng, out);
    }
    pa += out.passes; ok += out.passOk; ca += out.carries; sh += out.shots.home + out.shots.away; go += out.goals.home + out.goals.away;
  }
  const mh = holds.reduce((a, b) => a + b, 0) / (holds.length || 1) / 4;
  holds.sort((a, b) => a - b);
  const p95 = (holds[Math.floor(holds.length * 0.95)] || 0) / 4, mx = (holds[holds.length - 1] || 0) / 4;
  console.log(`${dd.toFixed(2).padStart(9)}  ${(100*ok/(pa||1)).toFixed(0).padStart(9)}%` +
    `  ${(pa/N/2).toFixed(0).padStart(11)}  ${(ca/N/2).toFixed(0).padStart(12)}` +
    `  ${(sh/N/2).toFixed(1).padStart(10)}  ${(go/N/2).toFixed(2).padStart(10)}  ${mh.toFixed(2).padStart(9)}` +
    `  ${p95.toFixed(1).padStart(5)}  ${mx.toFixed(1).padStart(5)}`);
}
