process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const N = 10, R = CFG.bodyR + CFG.ballR;
console.log("catchDive parryFloor  shots/side  onTgt  saves  goals/side  held%  inside%");
for (const [w, e] of [[0.35,0.25],[0.35,0.45],[0.70,0.25],[0.70,0.45],[1.20,0.35],[1.20,0.55],[0.70,0.65]]) {
  CFG.gkCatchDive = w; CFG.gkParryFloor = e;
  let sh=0,ot=0,sv=0,go=0,gkOn=0,held=0,ins=0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      if (mp.idx >= 0 && !mp.sp && s.players[mp.side][mp.idx].pos === "GK") {
        const p = s.players[mp.side][mp.idx];
        gkOn++; if (mp.held) held++;
        if (Math.hypot(mp.bx-p.x, mp.by-p.y) < R - 0.02) ins++;
      }
      meTick(s, rng, out);
    }
    sh += out.shots.home+out.shots.away; ot += out.onTarget.home+out.onTarget.away;
    sv += out.saves.home+out.saves.away; go += out.goals.home+out.goals.away;
  }
  const pc=(a,b)=>(100*a/(b||1)).toFixed(0)+"%";
  console.log(`${w.toFixed(2).padStart(9)} ${e.toFixed(2).padStart(10)}   ${(sh/N/2).toFixed(1).padStart(10)}` +
    ` ${(ot/N/2).toFixed(1).padStart(6)} ${(sv/N/2).toFixed(1).padStart(6)}  ${(go/N/2).toFixed(2).padStart(10)}` +
    `  ${pc(held,gkOn).padStart(5)}  ${pc(ins,gkOn).padStart(7)}`);
}
