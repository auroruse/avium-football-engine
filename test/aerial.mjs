// Do aerial contacts happen at all now? Stage 1 only: a man can reach a high ball, and the bigger
// man wins it. What he DOES with it is still an ordinary touch -- that is stage 2, and there is no
// point building it until this shows the contests are actually occurring.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, meOther,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 16);
function run(seed) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let air = 0, airBox = 0, claims = 0, high = 0, lofted = 0;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, z0 = mp.bz, i0 = mp.idx, s0 = mp.side;
    if (z0 > CFG.headMinZ) high++;
    meTick(s, rng, out);
    if (mp.idx >= 0 && (mp.idx !== i0 || mp.side !== s0)) {
      claims++;
      const zc = (mp._bpz ?? z0);
      if (zc > CFG.headMinZ) {
        air++;
        const q = s.players[mp.side][mp.idx];
        const atk = meGoalX(mp.side);
        if (Math.hypot(atk - q.x, ME_HALF_W - q.y) < 20 || Math.hypot(meGoalX(meOther(mp.side)) - q.x, ME_HALF_W - q.y) < 20) airBox++;
      }
    }
    if (mp.passPending && mp.passPending.high) lofted++;
  }
  return { air, airBox, claims, high, g: out.goals.home + out.goals.away,
           sh: out.shots.home + out.shots.away, co: out.corners.home + out.corners.away };
}
const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const sum = (k) => res.reduce((a, r) => a + r[k], 0) / N;
console.log(`\n${N} matches. Per match, both sides.\n`);
console.log(`  slices with the ball above ${CFG.headMinZ} m      ${sum("high").toFixed(0)}`);
console.log(`  AERIAL contacts (claimed above ${CFG.headMinZ} m)  ${sum("air").toFixed(1)}      real: roughly 40-60 a match`);
console.log(`    ...of them inside a penalty area          ${sum("airBox").toFixed(1)}`);
console.log(`  all claims                                  ${sum("claims").toFixed(0)}`);
console.log(`\n  goals ${sum("g").toFixed(2)}   shots ${sum("sh").toFixed(1)}   corners ${sum("co").toFixed(2)}`);
console.log(`\n  a man reaches ${CFG.headBase.toFixed(2)}-${(CFG.headBase + CFG.headSpan).toFixed(2)} m by strength; above ${CFG.headMinZ} m his reach is`);
console.log(`  ${(CFG.headReach * CFG.headLo).toFixed(2)}-${CFG.headReach.toFixed(2)} m instead of a boot's ${CFG.cutReach} m.`);
