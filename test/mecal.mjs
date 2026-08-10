// Does the positional engine produce football? Not "is it balanced" -- does a match look like a
// match. Real-world targets in the header; anything far outside them means the physics is wrong,
// not the tuning.
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = await import(process.env.ENG || "./engine.mjs");
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench).map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5 }));
export function run(hOvr, aOvr, N, hStrat, aStrat) {
  const rng = new RNG(31);
  const agg = { poss: { home: 0, away: 0 }, shots: { home: 0, away: 0 }, goals: { home: 0, away: 0 },
                passes: 0, passOk: 0, passFail: 0, tackles: 0, carries: 0, clears: 0, inplay: 0, stam: 0,
                onTarget: {home:0,away:0}, saves: {home:0,away:0}, corners: {home:0,away:0}, fouls: {home:0,away:0}, shotDist: new Array(10).fill(0), xg: 0 };
  for (let m = 0; m < N; m++) {
    const s = createMatchState();
    s.players.home = sq(hOvr); s.players.away = sq(aOvr);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF, ...(hStrat || {}) }, away: { ...STRAT_DEF, ...(aStrat || {}) } };
    s.possession = "home";
    meInit(s, pitchSlots);
    const out = { poss: { home: 0, away: 0 }, shots: { home: 0, away: 0 }, goals: { home: 0, away: 0 },
                  passes: 0, passOk: 0, passFail: 0, tackles: 0, carries: 0, clears: 0, inplay: 0,
                  onTarget: {home:0,away:0}, saves: {home:0,away:0}, corners: {home:0,away:0}, fouls: {home:0,away:0}, shotDist: new Array(10).fill(0), xg: 0 };
    for (let t = 0; t < 90 * ME_TPM; t++) meTick(s, rng, out);
    for (const k of ["passes", "passOk", "passFail", "tackles", "carries", "clears", "inplay", "xg"]) agg[k] += out[k];
    for (let b = 0; b < 10; b++) agg.shotDist[b] += out.shotDist[b];
    for (const side of ["home", "away"]) for (const k of ["poss","shots","goals","onTarget","saves","corners","fouls"]) agg[k][side] += out[k][side];
    agg.stam += s.players.home.reduce((a, p) => a + p.stamina, 0) / 11;
  }
  const pt = agg.poss.home + agg.poss.away || 1;
  return { possH: 100 * agg.poss.home / pt, shotsH: agg.shots.home / N, shotsA: agg.shots.away / N,
           goalsH: agg.goals.home / N, goalsA: agg.goals.away / N, passes: agg.passes / N,
           passPct: 100 * agg.passOk / (agg.passes || 1), tackles: agg.tackles / N, stam: agg.stam / N, inplay: agg.inplay / N / 4 / 60,
           onT: agg.onTarget.home / N, corners: agg.corners.home / N, fouls: agg.fouls.home / N,
           dist: agg.shotDist.map(b => 100*b/agg.shotDist.reduce((x,y)=>x+y,1)), xg: agg.xg / N / 2 };
}
if (!process.env.QUIET) {
  const r = run(75, 75, 30);
  console.log("target:  poss 50%  shots 13/13  goals 1.4/1.4  passes ~450  pass% ~80  stamina ~70  in-play ~57min  onT 4.5  corners 5  fouls 11");
  console.log(`actual:  poss ${r.possH.toFixed(0)}%  shots ${r.shotsH.toFixed(1)}/${r.shotsA.toFixed(1)}  goals ${r.goalsH.toFixed(2)}/${r.goalsA.toFixed(2)}  passes ${r.passes.toFixed(0)}  pass% ${r.passPct.toFixed(0)}  stamina ${r.stam.toFixed(0)}  in-play ${r.inplay.toFixed(0)}min  onT ${r.onT.toFixed(1)}  corners ${r.corners.toFixed(1)}  fouls ${r.fouls.toFixed(1)}`);
  console.log(`shot distance 5m bands from goal: ${r.dist.map(b=>b.toFixed(0)+'%').join(' ')}   mean xG/shot ${(r.xg/r.shotsH).toFixed(3)} (real ~0.10)`);
}
