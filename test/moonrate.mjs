// HOW OFTEN does the ball end up behind the man carrying it? moonwalk.mjs dumps the tape around a
// trigger, which shows you WHY once it happens but never how often -- so there has never been a
// number on this, only screenshots.
//
// Three separate things, because they are not the same fault and they have different fixes:
//   BEHIND    the ball is on the wrong side of him while he runs. One slice of this is a touch that
//             got away and is perfectly normal football.
//   PINNED    it is behind him AND stuck to his shell at exactly bodyR+ballR, which is the ball
//             being dragged rather than played -- that is the thing that looks broken.
//   REVERSED  he is moving one way in world terms and the ball is moving the other. A real moonwalk.
// And the one that actually matters: a SUSTAINED run of pinned slices. One is a bad touch; eight in
// a row is a man walking backwards with a ball glued to his heels.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, CFG } = eng;

const squad = (o) => buildSquad("4-3-3", null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });

const R = CFG.bodyR + CFG.ballR;
const MOVING = 1.5;                     // m/s: below this he is not carrying it anywhere
const N = +(process.env.N || 20);

function run(seed) {
  const s = createMatchState();
  const hs = squad(75), as = squad(75);
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let carrying = 0, behind = 0, pinned = 0, reversed = 0;
  const byHold = {}, holdAll = {};
  const bands = [0, 0, 0, 0];           // ball-off-his-motion: <45, 45-90, 90-135, >135
  const runs = []; let cur = 0;
  let pbx = 0, pby = 0, ppx = 0, ppy = 0, had = false;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const bx0 = mp.bx, by0 = mp.by;
    const car0 = mp.idx >= 0 && !mp.sp ? s.players[mp.side][mp.idx] : null;
    const px0 = car0 ? car0.x : 0, py0 = car0 ? car0.y : 0;
    meTick(s, rng, out);
    const car = mp.idx >= 0 && !mp.sp ? s.players[mp.side][mp.idx] : null;
    if (!car) { if (cur >= 3) runs.push(cur); cur = 0; had = false; continue; }
    const vs = Math.hypot(car.vx || 0, car.vy || 0);
    if (vs / ME_DT < MOVING) { if (cur >= 3) runs.push(cur); cur = 0; had = false; continue; }
    carrying++;
    const ox = mp.bx - car.x, oy = mp.by - car.y, od = Math.hypot(ox, oy) || 1e-9;
    const cosA = (ox / od) * (car.vx / vs) + (oy / od) * (car.vy / vs);
    const ang = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
    bands[ang < 45 ? 0 : ang < 90 ? 1 : ang < 135 ? 2 : 3]++;
    // WHEN does it happen? mp.hold counts slices since he took possession, so hold 1-2 is the
    // touch he has just taken and anything above that is him running with it.
    const h = Math.min(6, mp.hold || 0);
    holdAll[h] = (holdAll[h] || 0) + 1;
    const isBehind = ang > 100;
    if (isBehind) byHold[h] = (byHold[h] || 0) + 1;
    const isPinned = isBehind && Math.abs(od - R) < 0.06;
    if (isBehind) behind++;
    if (isPinned) { pinned++; cur++; } else { if (cur >= 3) runs.push(cur); cur = 0; }
    // a true reversal: he went one way this slice and the ball went the other
    if (had && car === car0) {
      const mdx = car.x - px0, mdy = car.y - py0, bdx = mp.bx - bx0, bdy = mp.by - by0;
      const ml = Math.hypot(mdx, mdy), bl = Math.hypot(bdx, bdy);
      if (ml > 0.05 && bl > 0.05 && (mdx * bdx + mdy * bdy) / (ml * bl) < -0.3) reversed++;
    }
    had = true; pbx = bx0; pby = by0; ppx = px0; ppy = py0;
  }
  if (cur >= 3) runs.push(cur);
  return { carrying, behind, pinned, reversed, bands, runs, byHold, holdAll };
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const bands = [0, 1, 2, 3].map(i => res.reduce((a, r) => a + r.bands[i], 0));
const runs = res.flatMap(r => r.runs).sort((a, b) => b - a);
const c = S("carrying"), pc = (x) => (100 * x / (c || 1)).toFixed(1) + "%";

console.log(`\n${N} matches, ${c} slices with a man carrying the ball above ${MOVING} m/s.\n`);
console.log(`  ball BEHIND him (>100 deg off his motion)   ${pc(S("behind")).padStart(7)}`);
console.log(`  ...and PINNED to his shell at ${R.toFixed(2)} m       ${pc(S("pinned")).padStart(7)}   <- this is the one that looks broken`);
console.log(`  ball moving OPPOSITE to him                 ${pc(S("reversed")).padStart(7)}`);
console.log(`\n  where the ball sits relative to the way he is running:`);
const lbl = ["in front (<45)", "beside (45-90)", "behind (90-135)", "straight back (>135)"];
for (let i = 0; i < 4; i++) console.log(`    ${lbl[i].padEnd(22)} ${pc(bands[i]).padStart(7)}`);
console.log(`\n  ball behind him, by how long he has had it:`);
{
  const bh = {}, ha = {};
  for (const r of res) { for (const k in r.byHold) bh[k] = (bh[k]||0) + r.byHold[k];
                         for (const k in r.holdAll) ha[k] = (ha[k]||0) + r.holdAll[k]; }
  for (const k of Object.keys(ha).sort((a,b)=>a-b))
    console.log(`    hold ${k === "6" ? "6+" : k}   ${String(ha[k]).padStart(6)} slices   behind on ${(100*(bh[k]||0)/ha[k]).toFixed(1)}%`);
}
console.log(`\n  SUSTAINED drags (3+ consecutive pinned-and-behind slices):`);
console.log(`    stretches: ${runs.length}   longest: ${runs.length ? runs[0] : 0} slices (${((runs[0] || 0) / 4).toFixed(2)}s)`);
console.log(`    per match: ${(runs.length / N).toFixed(2)}`);
if (runs.length) console.log(`    longest few: ${runs.slice(0, 8).join(", ")}`);
