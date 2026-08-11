// A penalty happens 0.15 times a match, so forty matches a cell gives six of them and every
// percentage in that table was four-out-of-five noise. Test the mechanism directly instead: stand a
// match up, award a penalty, tick until it resolves, throw the match away and do it again. Sixty
// slices a trial against 4320 for a match, so thousands of penalties cost less than one sweep.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDead,
        STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const TRIALS = +(process.env.TRIALS || 500);

function cell({ aim, read, elev }) {
  CFG.spPenAim = aim; CFG.spPenRead = read; CFG.spPenElev = elev;
  let sc = 0, sv = 0, wood = 0, other = 0;
  for (let k = 0; k < TRIALS; k++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(k + 1);
    // Put the ball in the away box so the spot lands where it should, then award it.
    s.mePos.bx = 95; s.mePos.by = 34;
    meDead(s, "penalty", "home", 150, out);
    let struck = -1, done = null;
    for (let t = 0; t < 200 && !done; t++) {
      const g0 = out.goals.home, sv0 = out.saves.home + out.saves.away, w0 = out.woodwork;
      const wasSp = !!s.mePos.sp;
      meTick(s, rng, out);
      if (wasSp && !s.mePos.sp) struck = t;
      if (struck < 0) continue;
      if (out.goals.home > g0) done = "sc";
      else if (out.saves.home + out.saves.away > sv0) done = "sv";
      else if (out.woodwork > w0) done = "wood";
      else if (t - struck > 12) done = "other";
    }
    if (done === "sc") sc++; else if (done === "sv") sv++;
    else if (done === "wood") wood++; else other++;
  }
  const d = TRIALS;
  return { sc: 100*sc/d, sv: 100*sv/d, wood: 100*wood/d, other: 100*other/d };
}
const CELLS = [];
for (const elev of [1.0, 0.55, 0.30, 0.16]) CELLS.push({ aim: 0.72, read: 0.10, elev });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${TRIALS} penalties per cell (+/- ${(100*Math.sqrt(0.25/TRIALS)).toFixed(1)}% on a proportion).\n`);
console.log(`  spPenElev              scored    saved   woodwork    other`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok = r.sc >= 72 && r.sc <= 80;
  console.log(`  ${c.elev.toFixed(2).padStart(9)}            ${f1(r.sc).padStart(6)}%` +
    `  ${f1(r.sv).padStart(6)}%  ${f1(r.wood).padStart(8)}%  ${f1(r.other).padStart(6)}%${ok ? "  <==" : ""}`); });
console.log(`\n  real:                            76%      19%         2%       3%`);
