// How often does the handball GEOMETRY even occur? Run it with handP = 1 so every qualifying
// contact is given, and the count is the opportunity rate. Then the probability is just
// target / opportunities, rather than a number picked and re-picked.
//
// The ceiling is not free: reachOf returns -1 for an outfielder above 1.6 m, so a ball over head
// height is not in contact with anybody and there is nothing to strike an arm. The band that can
// ever be tested is handMinZ..1.6.
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
function cell({ z, hp, box }) {
  CFG.handMinZ = z; CFG.handP = hp; CFG.foulBoxScale = box;
  let hand = 0, pens = 0, fo = 0, ye = 0, g = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    let last = null;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const was = s.mePos.sp ? s.mePos.sp.kind : null;
      meTick(s, rng, out);
      const mp = s.mePos;
      if (mp.sp && mp.sp.kind === "penalty" && was !== "penalty") pens++;
      if (out.evt && out.evt.text && out.evt.text !== last) {
        last = out.evt.text; if (/Handball/.test(last)) hand++;
      }
    }
    fo += out.fouls.home + out.fouls.away;
    ye += (out.yellows?.home || 0) + (out.yellows?.away || 0);
    g += out.goals.home + out.goals.away;
  }
  return { hand: hand / N, pens: pens / N, fo: fo / N / 2, ye: ye / N / 2, g: g / N / 2 };
}
const CELLS = [];
for (const z of [0.85, 0.60]) for (const box of [0.30, 0.115]) CELLS.push({ z, hp: 1.0, box });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f2 = (x) => x.toFixed(2);
console.log(`\n${N} matches per cell. handP forced to 1.0: every qualifying contact is given.\n`);
console.log(`  handMinZ   handball events         and the penalties they should have produced`);
CELLS.forEach((c, i) => { const r = res[i];
  console.log(`  ${c.z.toFixed(2).padStart(8)} box=${c.box.toFixed(3)}   ${f2(r.hand).padStart(12)}   penalties/match ${f2(r.pens)}   fouls/side ${f2(r.fo)}`); });
