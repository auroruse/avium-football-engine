// HOW does the ball end up pinned to a man? Find the moment he acquires it, and dump the slices
// either side. No hypothesis -- just the tape.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const R = CFG.bodyR + CFG.ballR;
const s = createMatchState();
s.players.home = sq(75); s.players.away = sq(75);
s.formations = { home: "4-3-3", away: "4-3-3" };
s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
s.possession = "home"; meInit(s, pitchSlots);
const out = blank(), rng = new RNG(5);
const ring = [];
let shown = 0;
for (let t = 0; t < ME_MATCH_TICKS && shown < 4; t++) {
  const mp = s.mePos;
  const car = mp.idx >= 0 && !mp.sp ? s.players[mp.side][mp.idx] : null;
  const row = { t, who: car ? `${mp.side[0]}${mp.idx}` : "--",
    hold: mp.hold, px: car ? car.x : mp.bx, py: car ? car.y : mp.by,
    spd: car ? Math.hypot(car.vx||0, car.vy||0)/ME_DT : 0,
    bspd: Math.hypot(mp.bvx, mp.bvy),
    gap: car ? Math.hypot(mp.bx-car.x, mp.by-car.y) : NaN,
    // angle of the ball off the way he is MOVING, and off the line he means to take it
    off: null, along: null };
  if (car) {
    const vs = Math.hypot(car.vx||0, car.vy||0), bx = mp.bx-car.x, by = mp.by-car.y, bd = Math.hypot(bx,by);
    if (vs > 1e-4 && bd > 1e-4)
      row.off = Math.acos(Math.max(-1,Math.min(1,(bx/bd)*(car.vx/vs)+(by/bd)*(car.vy/vs))))*180/Math.PI;
    if (car._drbA != null && vs > 1e-4)
      row.along = ((car.vx/vs)*Math.cos(car._drbA)+(car.vy/vs)*Math.sin(car._drbA));
  }
  ring.push(row); if (ring.length > 12) ring.shift();
  // trigger: ball pinned to his shell while he is moving and it is behind him
  if (car && Math.abs(row.gap - R) < 0.05 && row.spd > 1.5 && row.off > 100) {
    shown++;
    console.log(`\n=== pinned to ${row.who} at t=${t} ===`);
    console.log("  t   who  hold   hisV  ballV   gap   ball-off-his-motion  moving-along-his-line");
    for (const r of ring)
      console.log(`${String(r.t).padStart(4)} ${r.who.padStart(5)} ${String(r.hold).padStart(5)}` +
        ` ${r.spd.toFixed(1).padStart(6)} ${r.bspd.toFixed(1).padStart(6)} ${(isNaN(r.gap)?0:r.gap).toFixed(2).padStart(6)}` +
        `   ${(r.off==null?" --":r.off.toFixed(0)).padStart(17)}   ${(r.along==null?" --":r.along.toFixed(2)).padStart(18)}`);
    ring.length = 0;
  }
  meTick(s, rng, out);
}
