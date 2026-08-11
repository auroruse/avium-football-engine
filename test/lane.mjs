// Two questions about defending a pass, measured rather than guessed.
//  1. Does the ball go THROUGH defenders? For every pass, how near did an opponent get to the
//     swept path of the ball, and did the pass complete anyway.
//  2. While the ball is in flight, is anybody actually attacking the lane?
//
// The scan inside meTick runs BEFORE anybody moves, so it sees p(t-1) against the segment
// b(t-1)->b(t). Sampling positions after the tick instead measures a different race entirely --
// a defender who arrived a slice late reads as having been standing in the lane.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        meOther, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;

const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const seg = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
  const t = L2 > 1e-6 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L2)) : 0;
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
};

if (process.env.NOCUT) CFG.cutEdge = 1e9;          // ablate the front-run, keep the contest fix
const N = +(process.env.N || 4);
let hadMarker = 0, cutWonBall = 0;
let flights = 0, done = 0, cut = 0;
const LIM = [0.6, 1.0, 1.5, 2.5];
const near = [0, 0, 0, 0], nearDone = [0, 0, 0, 0];
let closeSum = 0;
let fTicks = 0, towards = 0, aways = 0, inLane = 0;
let cutStarted = 0, cutWon = 0;

for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let live = null;

  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const wasPass = !!mp.passPending;
    // Everything the scan will see, snapshotted BEFORE the tick.
    const b0x = mp.bx, b0y = mp.by;
    const opp = mp.passPending ? s.players[meOther(mp.fside)].map(q =>
      ({ x: q.x, y: q.y, tx: q._tx ?? q.x, ty: q._ty ?? q.y, gk: q.pos === "GK", cut: (q._cut ?? 0) > 0 })) : null;
    const lane = mp.passPending && mp.fj >= 0
      ? { bx: b0x, by: b0y, rx: s.players[mp.fside][mp.fj].x, ry: s.players[mp.fside][mp.fj].y } : null;
    const cutsBefore = opp ? opp.filter(q => q.cut).length : 0;

    meTick(s, rng, out);

    // ---- 1. how near an opponent was to the ball's actual path this slice, as the scan saw it.
    // A ball over their heads is not one they could have taken, so it is not a pass through anybody.
    if (live && opp && mp.bz < 1.6) {
      for (const q of opp) { if (q.gk) continue;
        const d = seg(q.x, q.y, b0x, b0y, mp.bx, mp.by);
        if (d < live.min) live.min = d;
      }
    }
    if (!wasPass && mp.passPending) {
      live = { side: mp.fside, min: Infinity }; flights++;
      if (mp.fj >= 0 && s.players[meOther(mp.fside)].some(q => q._mk === mp.fj)) hadMarker++;
    }
    if (live && !mp.passPending) {
      const ok = mp.idx >= 0 && mp.side === live.side;
      if (ok) done++; else cut++;
      if (!ok && mp.idx >= 0 && (s.players[mp.side][mp.idx]._cut ?? 0) > 0) cutWonBall++;
      closeSum += Math.min(live.min, 6);
      for (let k = 0; k < 4; k++) if (live.min < LIM[k]) { near[k]++; if (ok) nearDone[k]++; }
      live = null;
    }

    // ---- 2. is anybody attacking the lane while it is in the air
    if (lane && opp) {
      fTicks++;
      const now = s.players[meOther(s.mePos.lastSide)];
      for (const q of opp) { if (q.gk) continue;
        const dn = seg(q.x, q.y, lane.bx, lane.by, lane.rx, lane.ry);
        const dw = seg(q.tx, q.ty, lane.bx, lane.by, lane.rx, lane.ry);
        if (dn < 2.0) inLane++;
        else if (dw < dn - 0.15) towards++;
        else if (dw > dn + 0.15) aways++;
      }
      const after = now ? now.filter(q => (q._cut ?? 0) > 0).length : 0;
      if (after > cutsBefore) cutStarted += after - cutsBefore;
    }
  }
}

const pc = (a, b) => (100 * a / (b || 1)).toFixed(0) + "%";
console.log(`\npasses in flight: ${flights}   reached their man ${pc(done, done + cut)}   cut out ${pc(cut, done + cut)}`);
console.log(`mean closest opponent approach to the ball's path: ${(closeSum / (done + cut || 1)).toFixed(2)} m`);
console.log(`\nan outfield opponent was this near the ball's own path...   and it STILL got there`);
for (let k = 0; k < 4; k++)
  console.log(`  ${LIM[k].toFixed(1)} m   ${String(near[k]).padStart(4)} passes  ${pc(near[k], flights).padStart(5)}` +
              `      ${String(nearDone[k]).padStart(4)}  ${pc(nearDone[k], near[k])}`);
console.log(`\n(reach ${CFG.reach} m for the receiver, cutReach ${CFG.cutReach} m for anybody else)`);
console.log(`\nwhile a pass is in the air, per outfield opponent per slice:`);
console.log(`  already within 2 m of the lane   ${pc(inLane, inLane + towards + aways)}`);
console.log(`  moving TOWARD the lane           ${pc(towards, inLane + towards + aways)}`);
console.log(`  moving AWAY from it              ${pc(aways, inLane + towards + aways)}`);
console.log(`\nthe intended receiver had a marker on ${pc(hadMarker, flights)} of passes`);
console.log(`markers who stepped in front of their man: ${cutStarted}  (${(cutStarted / (flights || 1)).toFixed(2)} per pass)`);
console.log(`balls won by a man who had committed to the front-run: ${cutWonBall}`);
