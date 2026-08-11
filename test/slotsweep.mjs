// The slot slew has to be quick enough that a block can compress when the ball arrives, and slow
// enough that the spot a man is chasing never outruns him. Those pull opposite ways, so measure
// both ends: block depth under siege AND whether defenders reach their marks.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther, meGoalX, meDir,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, ME_HALF_W, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 14);
function cell({ fwd, back }) {
  CFG.slotSlew = fwd; CFG.slotSlewBack = back;
  let g = 0, sh = 0, ok = 0, tot = 0, dep = 0, depN = 0, box = 0, boxN = 0, at = 0, atN = 0, slotV = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const prev = new Map();
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      meTick(s, rng, out);
      const mp = s.mePos; if (mp.idx < 0) continue;
      const d = meOther(mp.side), of = s.players[d].filter(q => q.pos !== "GK");
      const own = meGoalX(mp.side), dep2 = Math.abs(mp.bx - own);
      if (dep2 < 30) {                                  // under siege: ball inside 30 m of their goal
        const xs = of.map(q => q.x);
        dep += Math.max(...xs) - Math.min(...xs); depN++;
        box += of.filter(q => Math.abs(q.x - own) < CFG.gkBoxR && Math.abs(q.y - ME_HALF_W) < CFG.boxHalfW).length;
        boxN++;
      }
      for (const q of of) {
        const tx = q._tx ?? q.x, ty = q._ty ?? q.y;
        const pv = prev.get(q); prev.set(q, { tx, ty });
        if (pv) { slotV += Math.hypot(tx - pv.tx, ty - pv.ty) / ME_DT; atN++;
                  if (Math.hypot(q.x - tx, q.y - ty) < 1.0) at++; }
      }
    }
    g += out.goals.home + out.goals.away; sh += out.shots.home + out.shots.away;
    ok += out.passOk; tot += out.passOk + out.passFail;
  }
  return { g: g/N/2, sh: sh/N/2, cmp: 100*ok/(tot||1), dep: dep/(depN||1),
           box: box/(boxN||1), at: 100*at/(atN||1), sv: slotV/(atN||1) };
}
const CELLS = [];
for (const fwd of [4.5, 7.0]) for (const back of [4.5, 9.0, 14.0]) CELLS.push({ fwd, back });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell.  want: depth 18-26 m, defenders in box 4.5-7, completion 78-86%\n`);
console.log(`  fwd  back   depth   in box   at target   slot speed   completion  goals/side  shots/side`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok2 = r.dep <= 27 && r.box >= 4.2;
  console.log(`  ${c.fwd.toFixed(1).padStart(4)} ${c.back.toFixed(1).padStart(5)}  ${f1(r.dep).padStart(6)}` +
    `  ${f1(r.box).padStart(7)}  ${f1(r.at).padStart(9)}%  ${f1(r.sv).padStart(9)}   ${f1(r.cmp).padStart(9)}%` +
    `  ${f1(r.g).padStart(10)}  ${f1(r.sh).padStart(10)}${ok2 ? "  <==" : ""}`); });
