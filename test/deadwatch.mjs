// Freeze-frame the deadlock. Run to the tick it starts, then dump everything that decides whether
// anybody can pick the ball up: reach, distance, the lockout, and whether the two men on it move.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, STRAT_DEF, CFG, meAttrs } = eng;

const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const SEED = +(process.env.SEED || 10), FROM = +(process.env.FROM || 145), FOR = +(process.env.FOR || 26);
const s = createMatchState();
s.players.home = sq(75); s.players.away = sq(75);
s.formations = { home: "4-3-3", away: "4-3-3" };
s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
s.possession = "home"; meInit(s, pitchSlots);
const out = blank(), rng = new RNG(SEED);

for (let t = 0; t < FROM + FOR; t++) {
  const mp = s.mePos;
  if (t >= FROM) {
    const near = [];
    for (const sd of ["home", "away"]) s.players[sd].forEach((q, i) => {
      const d = Math.hypot(q.x - mp.bx, q.y - mp.by);
      if (d < 4) {
        const lock = !!mp.kickBy && mp.kickBy.some(k => k.s === sd && k.i === i && mp.tick - k.t < CFG.kickLock);
        const v = Math.hypot(q.vx || 0, q.vy || 0) / 0.25;
        near.push(`${sd[0]}${i}${q.pos === "GK" ? "gk" : ""} d${d.toFixed(2)} v${v.toFixed(1)}` +
          ` tgt(${(q._tx ?? q.x).toFixed(1)},${(q._ty ?? q.y).toFixed(1)})${lock ? " LOCKED" : ""}` +
          `${mp.desig[sd] === i ? " CHASE" : ""}`);
      }
    });
    console.log(`t${mp.tick} ball(${mp.bx.toFixed(2)},${mp.by.toFixed(2)},z${mp.bz.toFixed(2)}) ` +
      `v(${mp.bvx.toFixed(2)},${mp.bvy.toFixed(2)}) idx=${mp.idx}/${mp.side} fl=${mp.flight ? "y" : "n"} ` +
      `sp=${mp.sp ? mp.sp.kind : "-"} kickBy=${(mp.kickBy || []).map(k => `${k.s[0]}${k.i}@${k.t}`).join(",") || "-"}\n` +
      `      ${near.join("\n      ")}`);
  }
  meTick(s, rng, out);
}
console.log(`\nreach ${CFG.reach}  cutReach ${CFG.cutReach}  bodyR ${CFG.bodyR}  ballR ${CFG.ballR}  kickLock ${CFG.kickLock}  touchKeep ${CFG.touchKeep}`);
