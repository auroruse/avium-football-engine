// ONE CARRY, SLICE BY SLICE.
//
// Three sweeps have come back flat -- touchOffWide, dribSet, carryAim -- and the aggregate says the
// ball travels at 4.6 m/s while the man carrying it runs at 5.1, so it ends up level with him or
// behind. The touch is supposed to leave his foot at his own speed plus touchMin, which would be
// 7.6. Either it is not firing, or it is firing and being undone. This prints the longest carry in
// a match, one slice per line, so the loop can be read rather than inferred.
//
//   node test/carrytrace.mjs
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, ME_DT,
        STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const s = createMatchState();
const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
s.formations = { home: "4-3-3", away: "4-3-3" };
s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
s.possession = "home"; meInit(s, pitchSlots);
const out = blank(), rng = new RNG(+(process.env.SEED || 3));

const runs = [];
let cur = null;
const snap = [];
for (let t = 0; t < ME_MATCH_TICKS; t++) {
  const mp = s.mePos;
  meTick(s, rng, out);
  const key = mp.sp || mp.idx < 0 ? null : `${mp.side}:${mp.idx}`;
  if (key !== (cur && cur.key)) { if (cur && cur.rows.length > 3) runs.push(cur); cur = key ? { key, rows: [] } : null; }
  if (!cur) continue;
  const c = s.players[mp.side][mp.idx];
  if (c.pos === "GK") { cur = null; continue; }
  const vs = Math.hypot(c.vx || 0, c.vy || 0) / ME_DT;
  const hx = vs > 0.01 ? c.vx / (vs * ME_DT) : 1, hy = vs > 0.01 ? c.vy / (vs * ME_DT) : 0;
  const rx = mp.bx - c.x, ry = mp.by - c.y;
  let nearest = Infinity;
  for (const q of s.players[mp.side === "home" ? "away" : "home"])
    if (!q.off) nearest = Math.min(nearest, Math.hypot(q.x - mp.bx, q.y - mp.by));
  cur.rows.push({
    rd: Math.hypot(rx, ry), fwd: rx * hx + ry * hy, lat: rx * -hy + ry * hx,
    bv: Math.hypot(mp.bvx, mp.bvy), pv: vs,
    hdg: Math.atan2(hy, hx) * 180 / Math.PI,
    drb: c._drbA == null ? NaN : c._drbA * 180 / Math.PI,
    opp: nearest, duty: c._duty,
  });
}
if (cur && cur.rows.length > 3) runs.push(cur);
runs.sort((a, b) => b.rows.length - a.rows.length);

console.log(`\nreach ${CFG.reach}  dribCtrl ${CFG.dribCtrl}  dribSet ${CFG.dribSet}  ` +
            `touchGain ${CFG.touchGain}  touchMin ${CFG.touchMin}  ctrlForce ${CFG.ctrlForce}  ` +
            `touchOffWide ${CFG.touchOffWide}  dribBehind ${CFG.dribBehind}`);
console.log(`\n${runs.length} carries over 3 slices; the three longest.\n`);
for (const r of runs.slice(0, 3)) {
  console.log(`  ${r.key}, ${r.rows.length} slices (${(r.rows.length * ME_DT).toFixed(1)} s)`);
  console.log(`     rd   fwd    lat   ballv  manv   hdg    drbA   nearest opp`);
  for (const w of r.rows.slice(0, 26))
    console.log(`   ${w.rd.toFixed(2).padStart(5)} ${w.fwd.toFixed(2).padStart(6)} ` +
      `${w.lat.toFixed(2).padStart(6)}  ${w.bv.toFixed(2).padStart(5)} ${w.pv.toFixed(2).padStart(5)}  ` +
      `${w.hdg.toFixed(0).padStart(5)}  ${(isNaN(w.drb) ? "-" : w.drb.toFixed(0)).padStart(6)}   ` +
      `${w.opp.toFixed(1).padStart(5)}`);
  console.log("");
}
