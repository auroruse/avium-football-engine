// HOW LONG DOES EACH RESTART ACTUALLY TAKE, AND WHY DOES IT END?
//
// A stoppage in this engine is a phase with a shape: the ball is placed, everyone is given a job for
// that particular restart, they walk to it, and play resumes when the men who matter are set. Two
// things can end it -- everybody arrives (meSPReady is satisfied), or the referee runs out of
// patience and it is taken anyway at spMaxT. Which of the two is doing the work decides whether the
// shapes in setpiece.ts mean anything at all: if nearly every restart is being FORCED, then nobody
// is ever actually in position and the whole per-kind choreography is decoration.
//
// Durations are reported in the match's own displayed minutes, because that is the clock a viewer
// reads. ME_SIM_MIN compresses 90 minutes into 18, so one simulated second is about five of theirs.
//
//   node test/restarts.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, ME_DT, ME_SIM_MIN, CFG, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 30);
// Real seconds from the ball going dead to it being back in play, as a viewer would time it.
const REAL = { throw: "15-20", goalkick: "25-35", corner: "30-45", freekick: "25-60",
               penalty: "60-90", kickoff: "45-60" };

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = {};                       // kind -> {n, t, forced, run}
  let cur = null;
  const total = ME_MATCH_TICKS + 400;
  for (let t = 0; t < total; t++) {
    const mp = s.mePos, sp = mp.sp;
    if (sp && (!cur || cur.kind !== sp.kind || cur.started !== sp)) cur = { kind: sp.kind, started: sp };
    meTick(s, rng, out);
    // it has just been taken: mp.sp is gone and we know how long it stood there
    if (cur && !s.mePos.sp) {
      const k = cur.kind, e = (A[k] = A[k] || { n: 0, t: 0, forced: 0, max: 0 });
      const dur = cur.started.t;
      e.n++; e.t += dur; if (dur > e.max) e.max = dur;
      // spMaxT is the referee's patience; a restart that reaches it was taken whether or not
      // anybody had arrived.
      // Mirror meSPReady exactly. Reading the global spMaxT here while the engine resolves a
      // per-kind one reported every penalty as forced simply because a penalty is allowed longer
      // than eight seconds -- the instrument disagreeing with the thing it measures.
      const cap = k === "kickoff" ? CFG.spKickoffMaxT
                : (cur.started.maxT ?? CFG.spMaxTBy[k] ?? CFG.spMaxT);
      if (dur >= cap) e.forced++;
      cur = null;
    }
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const A = {};
for (const r of res) for (const [k, v] of Object.entries(r)) {
  const e = (A[k] = A[k] || { n: 0, t: 0, forced: 0, max: 0 });
  e.n += v.n; e.t += v.t; e.forced += v.forced; e.max = Math.max(e.max, v.max);
}
// one simulated second is 90/ME_SIM_MIN of a viewer's second
const SCALE = 90 / ME_SIM_MIN;
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches. Durations as the clock shows them, ${f1(SCALE)}x simulated time.\n`);
console.log(`  restart      per match   as shown   longest    real       forced at the cap`);
console.log(`  ----------   ---------   --------   -------    --------   -----------------`);
for (const [k, e] of Object.entries(A).sort((a, b) => b[1].n - a[1].n)) {
  const secs = e.t / e.n * ME_DT * SCALE;
  console.log(`  ${k.padEnd(10)}   ${f1(e.n / N).padStart(9)}   ${(f1(secs) + "s").padStart(8)}   ` +
    `${(f1(e.max * ME_DT * SCALE) + "s").padStart(7)}    ${(REAL[k] || "?").padEnd(8)}   ` +
    `${f1(100 * e.forced / e.n).padStart(5)}%`);
}
console.log(`\n  "forced" is the share taken because the referee ran out of patience rather than because`);
console.log(`  the players were ready. A high number there means the choreography never completes.`);
