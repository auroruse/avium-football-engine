// WHY DOES THE BALL NEVER GO OUT OF TOUCH?
//
// Ball in play is 78% against a real 58-72, and it is not that restarts are quick -- those now match
// their real durations to the second. It is that there are about 40 stoppages a match against a real
// 90-100, and the whole of that gap is throw-ins: 4.4 a match against 40-50.
//
// test/outplay.mjs asked this before and its answer cannot be used: it calls the ball loose whenever
// mp.idx < 0, which is true for every pass FOR ITS ENTIRE FLIGHT. Its "264.6 loose balls a match,
// 94.6% collected" is therefore mostly just passes arriving, and says nothing about loose balls.
//
// A genuinely loose ball is one nobody owns and nobody was aimed at: no carrier, and either not in
// flight at all or in flight with no intended receiver (mp.fj < 0 -- a clearance, a deflection, a
// header, a shot). That is the population that should sometimes run out of play.
//
//   node test/looseball.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, PITCH_W, PITCH_L, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 16);

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { loose: 0, collected: 0, out: 0, edge: [], live: 0, dead: 0,
              nearEdge: 0, restarts: 0, kinds: {} };
  let wasLoose = false;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, wasSp = !!mp.sp;
    meTick(s, rng, out);
    if (!wasSp && mp.sp) { A.restarts++; A.kinds[mp.sp.kind] = (A.kinds[mp.sp.kind] || 0) + 1; }
    if (mp.sp) { A.dead++; wasLoose = false; continue; }
    A.live++;
    // GENUINELY LOOSE: nobody has it, and nobody is the intended receiver of it.
    const loose = mp.idx < 0 && !(mp.flight && mp.fj >= 0);
    if (loose && !wasLoose) {
      A.loose++;
      A.edge.push(Math.min(mp.by, PITCH_W - mp.by, mp.bx, PITCH_L - mp.bx));
    }
    if (!loose && wasLoose) A.collected++;
    wasLoose = loose;
  }
  A.inplay = out.inplay / (ME_MATCH_TICKS + meAdded(s));
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const f1 = (x) => x.toFixed(1);
const K = {}; for (const r of res) for (const [k, v] of Object.entries(r.kinds)) K[k] = (K[k] || 0) + v;
const edge = res.flatMap(r => r.edge).sort((a, b) => a - b);
const L = S("loose") || 1;

console.log(`\n${N} matches.\n`);
console.log(`  GENUINELY LOOSE BALLS -- nobody owns it and nobody was aimed at it`);
console.log(`    per match                   ${f1(S("loose") / N)}`);
console.log(`    of those, collected again   ${f1(100 * S("collected") / L)}%`);
console.log(`    median distance to the nearest line when it came loose  ${f1(edge[edge.length >> 1] || 0)} m`);
console.log(`    under 3 m from a line       ${f1(100 * edge.filter(e => e < 3).length / L)}%`);
console.log(`\n  STOPPAGES                     ${f1(S("restarts") / N)} a match      real 90-100`);
for (const [k, v] of Object.entries(K).sort((a, b) => b[1] - a[1])) {
  const real = { throw: "40-50", goalkick: "12-18", corner: "8-12", freekick: "22-30", kickoff: "3-6", penalty: "0-1" }[k] || "?";
  console.log(`    ${k.padEnd(10)}                ${f1(v / N).padStart(5)}          real ${real}`);
}
console.log(`\n  ball in play                  ${f1(100 * S("inplay") / res.length)}%       real 58-72`);
console.log(`\n  A loose ball that is always collected never reaches a line. If the collected share is`);
console.log(`  very high AND loose balls appear a long way from any line, then the ball is being`);
console.log(`  hoovered up rather than escaping, and that -- not restart length -- is the ball-in-play`);
console.log(`  gap. Real football turns roughly a quarter of its loose balls into a restart.`);
