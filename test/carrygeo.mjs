// WHERE IS THE BALL, RELATIVE TO THE MAN CARRYING IT?
//
// The touch-offset limit is not the mechanism: clamping it from 180 degrees to 30 moved the angle
// the WRONG way, 78 to 87. So the ball is not off to his side because the touch is aimed there.
//
// The carrier's movement target is the ball itself, so he should be running straight at it and the
// angle should be near zero. It is 78 degrees. Either he is not running at it, or the ball is not
// where the touch means to put it. This asks which:
//
//   rd       how far the ball is from him. The touch only applies inside reach (0.70 m); it wants
//            the ball at dribSet (1.10 m). Those two cannot both be true, so the question is what
//            share of carried slices the ball is being steered on at all.
//   toBall   the angle between his VELOCITY and the ball. If he is chasing it this is near zero.
//   toTgt    the angle between his velocity and his TARGET. Steering lag, nothing to do with the ball.
//   drbA     the angle between the line he has picked and his velocity.
//
//   node test/carrygeo.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, ME_DT,
        STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 16);
const deg = (ax, ay, bx, by) => {
  const al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
  return Math.abs(Math.atan2((ax / al) * (by / bl) - (ay / al) * (bx / bl),
                             (ax / al) * (bx / bl) + (ay / al) * (by / bl))) * 180 / Math.PI;
};

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { rd: [], toBall: [], toTgt: [], drbA: [], inReach: 0, n: 0, bspd: [], pspd: [],
              tgtIsBall: 0, ahead: 0, fwd: [], lat: [], turn: [], offTurn: [], offSpd: [],
              fwdNew: [], fwdOld: [], latNew: [], latOld: [] };
  let lastK = null, age = 0;
  // Heading change per second is what ORBITING actually is: a man circling something keeps his
  // speed and spins his bearing. A dribbler changes direction slowly; 200 deg/s is a man on a
  // roundabout. Tracked for the carrier and for everyone near the ball who is not him.
  const hd = new Map();
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (mp.sp || mp.idx < 0) continue;
    const c = s.players[mp.side][mp.idx];
    if (c.pos === "GK") continue;
    const vs = Math.hypot(c.vx || 0, c.vy || 0);
    if (vs / ME_DT < 1.0) continue;
    const rx = mp.bx - c.x, ry = mp.by - c.y, rd = Math.hypot(rx, ry);
    if (rd < 0.05) continue;
    A.n++;
    A.rd.push(rd);
    // Split by AGE OF THE POSSESSION. The first slices after a reception are a man checking onto a
    // ball that arrived behind him; they are not carrying and they swamp any average that mixes
    // them in. holdT counts slices this man has had it.
    const kk = `${mp.side}:${mp.idx}`;
    if (kk !== lastK) { lastK = kk; age = 0; } else age++;
    (age < 4 ? A.fwdNew : A.fwdOld).push(0);
    if (rd < CFG.reach) A.inReach++;
    A.toBall.push(deg(c.vx, c.vy, rx, ry));
    // In metres, along and across the line he is running. An angle at half a metre is noise.
    const ux = c.vx / vs, uy = c.vy / vs;
    const fw = rx * ux + ry * uy, la = Math.abs(rx * -uy + ry * ux);
    A.fwd.push(fw); A.lat.push(la);
    if (age < 4) { A.fwdNew[A.fwdNew.length - 1] = fw; A.latNew.push(la); }
    else { A.fwdOld[A.fwdOld.length - 1] = fw; A.latOld.push(la); }
    {
      const k = `${mp.side}:${mp.idx}`, h0 = hd.get(k);
      const h1 = Math.atan2(c.vy, c.vx);
      if (h0 !== undefined)
        A.turn.push(Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) * 180 / Math.PI / ME_DT);
      hd.set(k, h1);
    }
    A.pspd.push(vs / ME_DT);
    A.bspd.push(Math.hypot(mp.bvx, mp.bvy));
    if (c._tx !== undefined) {
      A.toTgt.push(deg(c.vx, c.vy, c._tx - c.x, c._ty - c.y));
      // Is his target actually the ball this slice, or has something else written it?
      if (Math.hypot(c._tx - mp.bx, c._ty - mp.by) < 0.05) A.tgtIsBall++;
    }
    if (c._drbA != null) A.drbA.push(deg(c.vx, c.vy, Math.cos(c._drbA), Math.sin(c._drbA)));
    // ...and the men AROUND the ball. "Gravitating slowly around it" is a low speed with a high
    // turn rate: going nowhere, but continuously.
    for (const sd of ["home", "away"]) for (let i = 0; i < s.players[sd].length; i++) {
      const qq = s.players[sd][i];
      if (qq.off || qq.pos === "GK" || (sd === mp.side && i === mp.idx)) continue;
      if (Math.hypot(qq.x - mp.bx, qq.y - mp.by) > 12) continue;
      const qv = Math.hypot(qq.vx || 0, qq.vy || 0);
      A.offSpd.push(qv / ME_DT);
      if (qv < 1e-4) continue;
      const k2 = `o${sd}${i}`, h0b = hd.get(k2), h1b = Math.atan2(qq.vy, qq.vx);
      if (h0b !== undefined)
        A.offTurn.push(Math.abs(Math.atan2(Math.sin(h1b - h0b), Math.cos(h1b - h0b))) * 180 / Math.PI / ME_DT);
      hd.set(k2, h1b);
    }
    // Is the ball in front of the man along the line HE has picked?
    if (c._drbA != null && (rx * Math.cos(c._drbA) + ry * Math.sin(c._drbA)) > 0) A.ahead++;
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const cat = (k) => res.flatMap(r => r[k]);
const f2 = (x) => x.toFixed(2);
const q = (a, p) => { const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : 0; };
const row = (lbl, a, u) => console.log(`    ${lbl.padEnd(34)} p10 ${f2(q(a, 0.1)).padStart(6)}  ` +
  `p50 ${f2(q(a, 0.5)).padStart(6)}  p90 ${f2(q(a, 0.9)).padStart(6)}  ${u}`);

console.log(`\n${N} matches, ${S("n")} carried slices above 1 m/s.\n`);
row("ball distance from him", cat("rd"), "m   reach " + CFG.reach + ", wants " + CFG.dribSet);
console.log(`    inside reach, so being steered      ${(100 * S("inReach") / S("n")).toFixed(1)}%`);
console.log(`    his target IS the ball              ${(100 * S("tgtIsBall") / S("n")).toFixed(1)}%`);
console.log(`    ball ahead of him on his own line   ${(100 * S("ahead") / S("n")).toFixed(1)}%`);
row("angle: his velocity to the BALL", cat("toBall"), "deg   ~0 if he chases it");
row("angle: his velocity to his TARGET", cat("toTgt"), "deg   steering lag");
row("angle: his velocity to his LINE", cat("drbA"), "deg");
row("ball AHEAD of him", cat("fwd"), "m     0.4-1.2");
row("ball ACROSS him", cat("lat"), "m     0-0.4");
row("  ...first second of possession", cat("fwdNew"), "m");
row("  ...after that, settled carry", cat("fwdOld"), "m     0.4-1.2");
row("  ...across him, settled", cat("latOld"), "m     0-0.4");
row("his heading change", cat("turn"), "deg/s   20-90");
row("near men: heading change", cat("offTurn"), "deg/s   20-90");
row("near men: speed", cat("offSpd"), "m/s");
row("his speed", cat("pspd"), "m/s");
row("ball speed", cat("bspd"), "m/s");
