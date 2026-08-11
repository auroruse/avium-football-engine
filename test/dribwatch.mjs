process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const deg = (r) => (r * 180 / Math.PI).toFixed(0);
const s = createMatchState();
s.players.home = sq(75); s.players.away = sq(75);
s.formations = { home: "4-3-3", away: "4-3-3" };
s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
s.possession = "home"; meInit(s, pitchSlots);
const out = blank(), rng = new RNG(3);
let shown = 0, runLen = 0, lastKey = null;
console.log(" t  who     hisV  ballV   gap  ball-vs-vel  ballV-vs-hisV  vel-vs-drbA  cone lost  hold");
for (let t = 0; t < ME_MATCH_TICKS && shown < 46; t++) {
  const mp = s.mePos;
  if (mp.idx >= 0 && !mp.sp) {
    const p = s.players[mp.side][mp.idx], key = `${mp.side}${mp.idx}`;
    if (key === lastKey) runLen++; else runLen = 0;
    lastKey = key;
    const bx = mp.bx - p.x, by = mp.by - p.y, bd = Math.hypot(bx, by);
    const vs = Math.hypot(p.vx || 0, p.vy || 0), spd = vs / ME_DT;
    const bs = Math.hypot(mp.bvx, mp.bvy);
    const aBall = Math.atan2(by, bx), aVel = vs > 1e-4 ? Math.atan2(p.vy, p.vx) : NaN;
    const aDrb = p._drbA ?? NaN;
    const wrap = (x) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x)));
    const half = (CFG.coneWide - (CFG.coneWide - CFG.coneTight) * Math.min(1, spd / CFG.coneV));
    const inC = vs < 1e-3 ? true : wrap(aBall - aVel) * 180 / Math.PI <= half;
    const aBv = bs > 1e-4 ? Math.atan2(mp.bvy, mp.bvx) : NaN;
    if (runLen > 1 && shown < 46) {
      shown++;
      console.log(`${String(t).padStart(3)} ${p.name.padEnd(6)} ${spd.toFixed(1).padStart(5)}` +
        ` ${bs.toFixed(1).padStart(6)} ${bd.toFixed(2).padStart(5)}` +
        ` ${deg(wrap(aBall - aVel)).padStart(12)} ${deg(wrap(aBv - aVel)).padStart(14)}` +
        ` ${deg(wrap(aVel - aDrb)).padStart(12)}  ${(inC ? "in " : "OUT").padStart(4)} ${String(p._lost ?? 0).padStart(4)} ${String(mp.hold).padStart(5)}`);
    }
  } else { lastKey = null; runLen = 0; }
  meTick(s, rng, out);
}
