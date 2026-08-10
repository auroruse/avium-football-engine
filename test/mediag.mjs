// Where is the funnel wrong? Real football: ~900 passes and ~26 shots a match, so ~35 passes per
// shot, and a shot comes with two or three defenders inside 8m. If shots are cheap here it is either
// because the ball reaches the box too easily (a defending problem) or because players shoot from
// everywhere (a scoring problem). These two histograms separate the cases.
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meShotGeom, mePressure, ME_TPM, STRAT_DEF, PITCH_L } =
  await import("./engine.mjs");
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench).map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5 }));

const N = 12, rng = new RNG(5);
const dist = new Array(9).fill(0);          // shot distance, 5m bands
let shots = 0, passes = 0, turnovers = 0, lastSide = null, pressSum = 0, xgSum = 0;
const thirds = [0, 0, 0];                    // where completed passes END up, by third

for (let m = 0; m < N; m++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = { poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0}, onTarget:{home:0,away:0},
                saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
                passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0 };
  let pShots = 0, pPass = 0;
  for (let t = 0; t < 90 * ME_TPM; t++) {
    const beforeShots = out.shots.home + out.shots.away, beforePass = out.passOk;
    const holder = s.mePos.idx >= 0 ? s.mePos.side : null;
    const hx = s.mePos.idx >= 0 ? s.players[s.mePos.side][s.mePos.idx] : null;
    meTick(s, rng, out);
    const nowShots = out.shots.home + out.shots.away;
    if (nowShots > beforeShots && hx) {
      const g = meShotGeom(holder, hx.x, hx.y);
      dist[Math.min(8, Math.floor(g.d / 5))]++; shots++;
      pressSum += mePressure(s, holder, hx.x, hx.y);
    }
    if (out.passOk > beforePass && hx) {
      const adv = holder === "home" ? s.mePos.fx : PITCH_L - s.mePos.fx;
      thirds[adv < PITCH_L / 3 ? 0 : adv < 2 * PITCH_L / 3 ? 1 : 2]++;
    }
    if (holder && s.mePos.idx >= 0 && s.mePos.side !== holder) turnovers++;
  }
  passes += out.passOk;
}
console.log(`per match: ${(passes/N).toFixed(0)} completed passes, ${(shots/N).toFixed(0)} shots  ->  ${(passes/shots).toFixed(1)} passes per shot (real ~35)`);
console.log(`turnovers/match ${(turnovers/N).toFixed(0)} (real ~280)   defenders within 8m of shooter: ${(pressSum/shots).toFixed(2)} (real ~2.5)`);
console.log("completed passes ending in own third / middle / final third: " +
  thirds.map(t => (100*t/thirds.reduce((a,b)=>a+b,1)).toFixed(0) + "%").join(" / ") + "   (real ~30/45/25)");
console.log("shot distance, 5m bands from 0:  " + dist.map(d => (100*d/shots).toFixed(0)+"%").join(" "));
