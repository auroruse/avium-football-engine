// Penalty conversion to the real 76% scored / 19% saved / 5% missed.
//
// Two levers. spPenAim is how near the post he goes: further out is harder to reach but nearer the
// miss. spPenRead is the keeper's chance of going the right way -- he commits before it is struck,
// so this is close to a coin flip and it is the lever that actually decides the number.
//
// The outcome is read off goals and saves, never off out.evt.text: that is a single slot which
// meDead overwrites in the same tick, and trusting it is what made a working handball read 0.00.
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
const N = +(process.env.N || 40);
function cell({ aim, read }) {
  CFG.spPenAim = aim; CFG.spPenRead = read;
  let pens = 0, sc = 0, sv = 0, other = 0, wood = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    let pend = null;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos, was = mp.sp ? mp.sp.kind : null;
      const g0 = { home: out.goals.home, away: out.goals.away };
      const sv0 = out.saves.home + out.saves.away, w0 = out.woodwork;
      meTick(s, rng, out);
      if (mp.sp && mp.sp.kind === "penalty" && was !== "penalty") { pens++; pend = null; }
      if (was === "penalty" && !mp.sp) pend = { sd: mp.lastSide, n: 0 };
      if (pend) {
        pend.n++;
        if (out.goals[pend.sd] > g0[pend.sd]) { sc++; pend = null; }
        else if (out.saves.home + out.saves.away > sv0) { sv++; pend = null; }
        else if (out.woodwork > w0) { wood++; pend = null; }
        else if (pend.n > 14) { other++; pend = null; }
      }
    }
  }
  const d = pens || 1;
  return { pens: pens / N, sc: 100*sc/d, sv: 100*sv/d, wood: 100*wood/d, other: 100*other/d };
}
const CELLS = [];
for (const aim of [0.72, 0.82, 0.90]) for (const read of [0.30, 0.18, 0.08]) CELLS.push({ aim, read });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell.\n`);
console.log(`  spPenAim  spPenRead   pens/match   scored    saved   woodwork   other`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok = r.sc >= 70 && r.sc <= 82;
  console.log(`  ${c.aim.toFixed(2).padStart(8)}  ${c.read.toFixed(2).padStart(9)}   ${r.pens.toFixed(2).padStart(10)}` +
    `   ${f1(r.sc).padStart(6)}%  ${f1(r.sv).padStart(6)}%  ${f1(r.wood).padStart(8)}%  ${f1(r.other).padStart(6)}%${ok ? "  <==" : ""}`); });
console.log(`\n  real:                                      76%      19%         2%       3%`);
