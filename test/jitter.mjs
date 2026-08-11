// Is the carrier actually dithering, or is the regression metric just reading a 0.39 m lever?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
let held=0, tgtRev=0, velRev=0, drbRev=0, sumTurn=0;
for (let seed = 1; seed <= 8; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let key=null, lt=null, lv=null, ld=null;
  const wrap = (x) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x)));
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    if (mp.idx >= 0 && !mp.sp) {
      const p = s.players[mp.side][mp.idx], k = `${mp.side}${mp.idx}`;
      const at = Math.atan2((p._ty??p.y)-p.y, (p._tx??p.x)-p.x);
      const vs = Math.hypot(p.vx||0, p.vy||0);
      const av = vs > 1e-4 ? Math.atan2(p.vy, p.vx) : null;
      const ad = p._drbA ?? null;
      if (k === key) {
        held++;
        if (lt !== null && wrap(at-lt) > Math.PI/2) tgtRev++;
        if (lv !== null && av !== null && wrap(av-lv) > Math.PI/2) velRev++;
        if (ld !== null && ad !== null) { sumTurn += wrap(ad-ld); if (wrap(ad-ld) > Math.PI/2) drbRev++; }
      }
      key=k; lt=at; lv=av; ld=ad;
    } else { key=null; lt=null; lv=null; ld=null; }
    meTick(s, rng, out);
  }
}
const pc=(a,b)=>(100*a/(b||1)).toFixed(1)+"%";
console.log(`\n${held} slices of one man keeping the ball`);
console.log(`  direction to his TARGET reversed >90 deg   ${pc(tgtRev,held)}   <- what regress measures`);
console.log(`  his own VELOCITY reversed >90 deg          ${pc(velRev,held)}   <- what you would SEE`);
console.log(`  the line he is taking it along reversed    ${pc(drbRev,held)}`);
console.log(`  mean turn of that line per slice           ${(sumTurn/held*180/Math.PI).toFixed(1)} deg`);
