// THE BALL BY HIS SIDE.
//
// hitBodies shepherds the ball along the line the carrier has PICKED, _drbA, and then limits how far
// that line may sit off the line he is actually running: touchOffWide degrees at a standstill,
// narrowing to touchOffTight by touchOffV. touchOffWide is 180, which is not a limit -- at anything
// below jogging pace the ball may be pushed in literally any direction relative to his own momentum,
// including straight backwards. Measured, the ball sits more than 60 degrees off his direction of
// travel on 53% of carried slices and more than 120 degrees on 30% of them.
//
// The carry direction is re-picked from an eight-way search every carryCommit slices and _drbA turns
// toward it at dribTurn radians a slice, so a 90-degree change of mind is a second of the ball going
// sideways while the man keeps running the old way. The limit is what stops that being visible, and
// it has been switched off. This sweeps it, against the angle itself and against what it costs:
// carrying is how the ball advances, so a limit that is too tight kills the dribble.
//
//   node test/sidesweep.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 20);
const CELLS = [];
const KNOB = process.env.KNOB || "touchOffTight";
const VALS = { turnLat: [1000, 12, 8, 6, 4.5, 3],
               touchOffTight: [30, 22, 15, 10, 6, 3],
               carryTurn: [0.012, 0.05, 0.12, 0.25, 0.5, 1.0],
               dribTurn: [0.60, 0.40, 0.28, 0.20, 0.14, 0.10] }[KNOB];
for (const aim of VALS) CELLS.push({ aim });

function play([cell, seed]) {
  CFG[KNOB] = cell.aim;
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { n: 0, a60: 0, a120: 0, ang: 0, spd: 0, hold: 0, holdN: 0, prog: 0, lat: [], turn: [] };
  let run = 0, who = -1, h0 = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const x0 = mp.bx;
    meTick(s, rng, out);
    if (mp.sp) { if (run) { A.hold += run; A.holdN++; run = 0; who = -1; h0 = null; } continue; }
    if (mp.idx < 0) { if (run) { A.hold += run; A.holdN++; run = 0; who = -1; h0 = null; } continue; }
    const c = s.players[mp.side][mp.idx];
    if (mp.idx !== who) { if (run) { A.hold += run; A.holdN++; } run = 0; who = mp.idx; h0 = null; }
    run++;
    A.prog += Math.abs(mp.bx - x0);
    const vs = Math.hypot(c.vx || 0, c.vy || 0) / ME_DT;
    if (vs > 1.0) {
      const rx = mp.bx - c.x, ry = mp.by - c.y, rd = Math.hypot(rx, ry);
      if (rd > 0.15) {
        const vx = c.vx / vs / ME_DT, vy = c.vy / vs / ME_DT;
        A.n++; A.spd += vs;
        A.ang += rx * vx + ry * vy;                       // metres AHEAD of him
        const lat = Math.abs(rx * -vy + ry * vx);
        A.lat.push(lat);
        if (lat > 0.4) A.a60++;                           // more than 0.4 m across him
        if (rx * vx + ry * vy < 0) A.a120++;              // behind him outright
        const h1 = Math.atan2(vy, vx);
        if (h0 !== null) A.turn.push(Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) * 180 / Math.PI / ME_DT);
        h0 = h1;
      }
    }
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  A.pass = out.passes; A.ok = out.passOk; A.shots = out.shots.home + out.shots.away;
  A.goals = out.goals.home + out.goals.away; A.carries = out.carries;
  return A;
}

const jobs = [];
for (let c = 0; c < CELLS.length; c++) for (let k = 0; k < N; k++) jobs.push([CELLS[c], k + 1]);
const res = await parMap(jobs, play);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);

console.log(`\n${N} matches a cell.\n`);
console.log(`${KNOB}\n`);
console.log(`   val    fwd   lat50  lat90  across  behind  turn/s  hold   passes  ok    shots  goals`);
for (let c = 0; c < CELLS.length; c++) {
  const g = res.slice(c * N, (c + 1) * N);
  const S = (k) => g.reduce((a, r) => a + r[k], 0);
  const qq = (k, pp) => { const b = g.flatMap(r => r[k]).sort((x, y) => x - y);
    return b.length ? b[Math.floor(b.length * pp)] : 0; };
  console.log(`  ${String(CELLS[c].aim).padStart(5)}  ` +
    `${f1(S("ang") / S("n")).padStart(5)}  ` +
    `${qq("lat", 0.5).toFixed(2).padStart(5)}  ${qq("lat", 0.9).toFixed(2).padStart(5)}  ` +
    `${(f1(100 * S("a60") / S("n")) + "%").padStart(6)}  ` +
    `${(f1(100 * S("a120") / S("n")) + "%").padStart(6)}  ` +
    `${f1(qq("turn", 0.5)).padStart(6)}  ` +
    `${f1(S("hold") / S("holdN") * ME_DT).padStart(4)}s  ` +
    `${f1(S("pass") / N / 2).padStart(6)}  ` +
    `${(f1(100 * S("ok") / S("pass")) + "%").padStart(4)}  ` +
    `${f1(S("shots") / N / 2).padStart(5)}  ` +
    `${f1(S("goals") / N / 2).padStart(5)}`);
}
console.log(`\n  Real: the ball is in front of a man running with it. Anything past about 25 degrees`);
console.log(`  is him shielding it or turning, and past 90 it is behind him. Unbroken time on the`);
console.log(`  ball is 3.2-6.4 s and the engine is at 1.5, so a cell that RAISES hold is not a cost.`);
