// STRUCK FROM OFF THE SPOT: WHICH RESTARTS, AND WHY?
//
// deadball.mjs asserts that no restart is ever struck from anywhere but its own mark, and reports
// 19 of 924. meSPTake calls meBallTo(s, side, sp.ti, sp.x, sp.y) -- it PUTS the ball on the spot as
// it strikes -- so any restart taken while the ball is somewhere else is a visible teleport at the
// exact moment the viewer is looking at it.
//
// Candidate mechanism: the ball is FETCHED to the spot over sp.ft slices (spFetchMin 3, up to
// spFetchMax 14, scaled by how far it has to be carried), but spReady only enforces spMinT, which
// is 6. Nothing anywhere says the ball has to have ARRIVED before somebody may kick it.
//
// This classifies every one of them: was the restart taken or merely superseded by another, what
// kind was it, was it quick, and had the fetch finished.
//
//   node test/offspot.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { taken: 0, bad: [], ftShort: 0, fetchN: 0 };
  let watch = null;
  for (let t = 0; t < ME_MATCH_TICKS + 400; t++) {
    const mp = s.mePos, wasSp = mp.sp;
    const bx0 = mp.bx, by0 = mp.by;
    // snapshot the live restart's own clock BEFORE the tick that ends it
    const st0 = wasSp ? { t: wasSp.t, ft: wasSp.ft, kind: wasSp.kind, quick: wasSp.quick,
                          x: wasSp.x, y: wasSp.y, fx: wasSp.fx, fy: wasSp.fy } : null;
    meTick(s, rng, out);
    const sp = mp.sp;
    if (sp && sp !== wasSp) {
      A.fetchN++;
      // the gap the ready gate leaves open: fetch longer than the minimum wait
      if ((sp.ft || 0) > (sp.minT ?? CFG.spMinT)) A.ftShort++;
    }
    if (watch && sp !== watch) {
      A.taken++;
      const off = Math.hypot(bx0 - watch.x, by0 - watch.y);
      if (off > 0.5 && st0) {
        A.bad.push({
          kind: st0.kind, quick: !!st0.quick, off: +off.toFixed(2),
          t: st0.t, ft: st0.ft,
          fetchDone: st0.t >= st0.ft,
          carried: +Math.hypot(st0.x - st0.fx, st0.y - st0.fy).toFixed(1),
          // did it end because it was TAKEN, or because another restart replaced it?
          how: sp ? "superseded by " + sp.kind : "taken",
        });
      }
      watch = null;
    }
    if (sp && sp !== wasSp) watch = sp;
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const bad = res.flatMap(r => r.bad);

console.log(`\n${N} matches. spMinT ${CFG.spMinT}, spFetchMin ${CFG.spFetchMin}, ` +
            `spFetchPerM ${CFG.spFetchPerM}, spFetchMax ${CFG.spFetchMax}\n`);
console.log(`  restarts                                  ${S("fetchN")}`);
console.log(`  ...whose FETCH is longer than spMinT      ${S("ftShort")}  ` +
            `(${(100 * S("ftShort") / (S("fetchN") || 1)).toFixed(1)}% -- the window the gate leaves open)`);
console.log(`  restarts ended                            ${S("taken")}`);
console.log(`  ball more than 0.5 m off the spot         ${bad.length}\n`);

const by = (f) => { const m = {}; for (const b of bad) m[f(b)] = (m[f(b)] || 0) + 1; return m; };
console.log(`  how it ended:      ${JSON.stringify(by(b => b.how))}`);
console.log(`  by kind:           ${JSON.stringify(by(b => b.kind))}`);
console.log(`  quick:             ${JSON.stringify(by(b => b.quick))}`);
console.log(`  fetch finished:    ${JSON.stringify(by(b => b.fetchDone))}`);
console.log(`\n  the offenders:`);
for (const b of bad.slice(0, 14))
  console.log(`    ${b.kind.padEnd(9)} quick=${b.quick ? 1 : 0}  off ${String(b.off).padStart(5)} m  ` +
              `t=${String(b.t).padStart(2)}/ft=${String(b.ft).padStart(2)}  ` +
              `carried ${String(b.carried).padStart(4)} m  ${b.how}`);
