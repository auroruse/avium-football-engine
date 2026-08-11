process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meIntercept, meTimeToBallMs,
        meOther, meGoalX, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_HALF_W, meSpeed, meAttrs } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
let n = 0, failEdge = 0, failR = 0, ok = 0, shown = 0;
let sumIc = 0, sumTheirs = 0, sumOut = 0;
for (let seed = 1; seed <= 6; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    if (mp.idx < 0 && !mp.sp) for (const side of ["home","away"]) {
      const gk = s.players[side].find(q => q.pos === "GK"); if (!gk) continue;
      const own = meGoalX(meOther(side)), them = s.players[meOther(side)];
      if (Math.abs(mp.bx - own) > 18) continue;
      const closing = ((mp.bx - own) * mp.bvx + (mp.by - ME_HALF_W) * mp.bvy) < 0;
      let nearest = Infinity;
      for (const q of them) if (q.pos !== "GK") nearest = Math.min(nearest, Math.hypot(q.x - mp.bx, q.y - mp.by));
      const bs = Math.hypot(mp.bvx, mp.bvy);
      if (!closing || nearest < 6 || bs < 0.5 || bs > 6) continue;   // a ball ROLLING in, not a shot
      const ic = meIntercept(gk, mp, meSpeed(meAttrs(gk), gk.stamina) * CFG.gkRushV);
      const outAt = Math.hypot(ic.x - own, ic.y - ME_HALF_W);
      let theirs = Infinity;
      for (const q of them) if (q.pos !== "GK")
        theirs = Math.min(theirs, meTimeToBallMs(q, ic.x, ic.y, meSpeed(meAttrs(q), q.stamina)));
      const edge = outAt < CFG.gkBoxR ? CFG.gkRushEdgeBox : CFG.gkRushEdge;
      n++; sumIc += ic.ms; sumTheirs += Math.min(theirs, 9999); sumOut += outAt;
      const eOk = ic.ms + edge < theirs, rOk = outAt < CFG.gkRushR;
      if (eOk && rOk) ok++; else if (!rOk) failR++; else failEdge++;
      if (shown < 10 && !(eOk && rOk)) {
        shown++;
        console.log(`  ball ${Math.abs(mp.bx-own).toFixed(1)}m out, v=${Math.hypot(mp.bvx,mp.bvy).toFixed(1)}  |  ` +
          `meet at ${outAt.toFixed(1)}m from goal   his ${ic.ms.toFixed(0)}ms   theirs ${Math.min(theirs,9999).toFixed(0)}ms   ` +
          `edge ${edge}  -> ${!rOk ? "TOO FAR OUT" : "NO EDGE"}`);
      }
    }
    meTick(s, rng, out);
  }
}
const pc=(a,b)=>(100*a/(b||1)).toFixed(0)+"%";
console.log(`\n${n} slices of a loose ball rolling at goal with nobody near it`);
console.log(`  he goes                       ${pc(ok,n)}`);
console.log(`  declines: meeting point too far from goal (>${CFG.gkRushR} m)  ${pc(failR,n)}`);
console.log(`  declines: not enough of an edge                        ${pc(failEdge,n)}`);
console.log(`  means: his ${(sumIc/n).toFixed(0)}ms, theirs ${(sumTheirs/n).toFixed(0)}ms, meeting point ${(sumOut/n).toFixed(1)}m from goal`);
