// HOW LONG DOES IT TAKE TWO MATCHES TO STOP BEING THE SAME MATCH?
//
// Same two teams, different RNG seeds. In the app the seed is Date.now(), so every kickoff the user
// watches is a fresh seed -- and yet the opening of the match is reported as identical every time.
// Two candidate reasons, and this separates them:
//
//   INITIAL CONDITIONS. meInit puts all twenty-two on their exact formation slots, to the
//   millimetre, every match. Nothing about a team sheet varies.
//
//   THE SET-PIECE SEED. mp.sp.seed = spSeed(tick, x, y) -- derived from the TICK and the BALL's
//   position, not from the match rng. The opening kickoff is always tick 0 at (52.5, 34), so its
//   seed is a compile-time constant: same routine variant, same jitter, same everything, in every
//   match ever played. And it is not just the kickoff -- ANY restart taken at the same tick from
//   the same spot draws the same numbers regardless of seed.
//
// Reported: the tick at which the ball's position first differs by more than a centimetre, the
// first divergence in ANY player position, and whether the opening events match.
//
//   node test/diverge.mjs
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, ME_DT,
        STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 }, feed: [], min: 0 });

function build(seed) {
  const s = createMatchState();
  const hs = sq(78, "4-3-3"), as = sq(76, "4-2-3-1");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-2-3-1" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  return { s, out: blank(), rng: new RNG(seed) };
}

const A = build(12345), B = build(987654321);

// Initial conditions, before a single tick.
let initSame = true;
for (const sd of ["home", "away"])
  for (let i = 0; i < A.s.players[sd].length; i++) {
    const p = A.s.players[sd][i], q = B.s.players[sd][i];
    if (Math.abs(p.x - q.x) > 1e-9 || Math.abs(p.y - q.y) > 1e-9) initSame = false;
  }
console.log(`\n  starting positions identical across seeds:  ${initSame ? "YES -- every match begins in exactly the same shape" : "no"}`);
console.log(`  opening set-piece seed A / B:                ${A.s.mePos.sp?.seed} / ${B.s.mePos.sp?.seed}` +
            `   ${A.s.mePos.sp?.seed === B.s.mePos.sp?.seed ? "<- IDENTICAL, and it is a constant" : ""}`);
console.log(`  opening kickoff routine variant A / B:      ${A.s.mePos.sp?.v} / ${B.s.mePos.sp?.v}`);

let ballTick = -1, playerTick = -1;
const evA = [], evB = [];
for (let t = 0; t < ME_MATCH_TICKS; t++) {
  meTick(A.s, A.rng, A.out); meTick(B.s, B.rng, B.out);
  if (A.out.feed[0] && A.out.feed[0] !== evA[evA.length - 1]) evA.push(A.out.feed[0]);
  if (B.out.feed[0] && B.out.feed[0] !== evB[evB.length - 1]) evB.push(B.out.feed[0]);
  if (ballTick < 0 && Math.hypot(A.s.mePos.bx - B.s.mePos.bx, A.s.mePos.by - B.s.mePos.by) > 0.01)
    ballTick = t;
  if (playerTick < 0) {
    for (const sd of ["home", "away"])
      for (let i = 0; i < A.s.players[sd].length; i++) {
        const p = A.s.players[sd][i], q = B.s.players[sd][i];
        if (Math.hypot(p.x - q.x, p.y - q.y) > 0.01) { playerTick = t; break; }
      }
  }
  if (ballTick >= 0 && playerTick >= 0 && t > 200) break;
}
const secs = (t) => t < 0 ? "never" : `${(t * ME_DT).toFixed(2)} s (tick ${t})`;
console.log(`\n  ball position first differs:                ${secs(ballTick)}`);
console.log(`  any player position first differs:          ${secs(playerTick)}`);
console.log(`\n  first six events, seed A vs seed B:`);
for (let i = 0; i < 6; i++)
  console.log(`    ${(evA[i]?.txt || "-").slice(0, 46).padEnd(48)} | ${(evB[i]?.txt || "-").slice(0, 46)}`);
console.log(`\n  A kickoff that is identical for the first second or two of every match is the`);
console.log(`  complaint. Divergence should begin on the FIRST touch, not once physics noise`);
console.log(`  has had time to accumulate.`);
