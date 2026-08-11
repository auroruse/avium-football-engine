// Where does a touch stop and a header begin? Too low and an ordinary chest-height pass is knocked
// clear instead of controlled, which is what took pass completion from 77% to 68%. Too high and the
// aerial game stops existing again.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 16);
function cell({ z, base }) {
  CFG.headMinZ = z; CFG.headBase = base;
  let g = 0, sh = 0, ok = 0, tot = 0, co = 0, air = 0, cl = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos, z0 = mp.bz, i0 = mp.idx, s0 = mp.side, c0 = out.clears;
      meTick(s, rng, out);
      if (out.clears > c0 && (mp._bpz ?? z0) > z) air++;   // a header specifically
    }
    g += out.goals.home + out.goals.away; sh += out.shots.home + out.shots.away;
    ok += out.passOk; tot += out.passOk + out.passFail;
    co += out.corners.home + out.corners.away; cl += out.clears;
  }
  return { g: g/N/2, sh: sh/N/2, cmp: 100*ok/(tot||1), co: co/N/2, air: air/N, cl: cl/N };
}
const CELLS = [];
for (const z of [1.25, 1.50, 1.70, 1.90]) for (const base of [1.80, 2.00]) CELLS.push({ z, base });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f2 = (x) => x.toFixed(2);
console.log(`\n${N} matches per cell.   want: goals 1.4, shots 12-13, completion 78-86%, corners ~5\n`);
console.log(`  headMinZ  headBase   goals/side  shots/side  completion  corners/side  headers/match`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok2 = r.cmp >= 76 && r.g <= 3;
  console.log(`  ${c.z.toFixed(2).padStart(8)}  ${c.base.toFixed(2).padStart(8)}  ${f2(r.g).padStart(10)}` +
    `  ${f2(r.sh).padStart(10)}  ${r.cmp.toFixed(1).padStart(9)}%  ${f2(r.co).padStart(12)}  ${f2(r.air).padStart(13)}${ok2 ? "  <==" : ""}`); });
