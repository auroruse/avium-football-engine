// THE GAME GETS STUCK. Not "the carrier is slow" -- properly frozen, and it never comes back.
// So: run whole matches and watch for a stretch where the ball does not go anywhere. Record what
// the world looked like when it started, because the screenshot says two men were contesting it.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;

const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const STILL = 0.06;              // metres the ball moves in a slice and we call it standing still
const RUN = +(process.env.RUN || 20);   // slices of that before it counts as stuck (5 s of sim)
const N = +(process.env.N || 12);

let stuck = 0, worst = 0, worstAt = null;
const runs = [];
for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let cur = 0, start = null;

  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const px = mp.bx, py = mp.by, sp = !!mp.sp;
    meTick(s, rng, out);
    // A set piece being walked into shape is not a stall, it is the game working.
    const moved = Math.hypot(mp.bx - px, mp.by - py);
    if (!sp && !mp.sp && moved < STILL) {
      if (cur === 0) {
        const near = [];
        for (const sd of ["home", "away"]) s.players[sd].forEach((q, i) => {
          const d = Math.hypot(q.x - mp.bx, q.y - mp.by);
          if (d < 2.5) near.push(`${sd[0]}${i}:${q.pos} ${d.toFixed(2)}m${mp.side === sd && mp.idx === i ? " *ON*" : ""}`);
        });
        start = { seed, t, x: mp.bx.toFixed(1), y: mp.by.toFixed(1), idx: mp.idx, side: mp.side,
                  held: mp.held, flight: mp.flight, near };
      }
      cur++;
    } else {
      if (cur >= RUN) { runs.push({ len: cur, ...start }); }
      if (cur > worst) { worst = cur; worstAt = start; }
      cur = 0;
    }
  }
  if (cur >= RUN) { runs.push({ len: cur, ...start }); stuck++; }   // still frozen at the whistle
  if (cur > worst) { worst = cur; worstAt = start; }
}

console.log(`\n${N} matches. Stretches where the ball did not move for ${RUN}+ slices (${(RUN / 4).toFixed(1)} s): ${runs.length}`);
console.log(`matches still frozen when time ran out: ${stuck}`);
console.log(`longest freeze anywhere: ${worst} slices (${(worst / 4).toFixed(1)} s)`);
if (worstAt) console.log(`  it began: seed ${worstAt.seed} tick ${worstAt.t} at (${worstAt.x}, ${worstAt.y}) ` +
  `idx=${worstAt.idx} side=${worstAt.side} held=${worstAt.held} flight=${worstAt.flight}\n  within 2.5 m: ${worstAt.near.join(" | ") || "nobody"}`);
for (const r of runs.slice(0, 12))
  console.log(`  seed ${r.seed} t${r.t}  ${r.len} slices  (${r.x}, ${r.y})  idx=${r.idx}/${r.side} held=${r.held} flight=${r.flight}  [${r.near.join(" | ")}]`);
