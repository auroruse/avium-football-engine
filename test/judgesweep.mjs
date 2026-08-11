// judgeErr at 0.15 cut shots from 16.5 to 10.6 -- which is the point -- but took pass completion
// from 77% to 68%, which is not. How much misjudgement the match can carry.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 14);
function cell(je) {
  CFG.judgeErr = je;
  let sh = 0, g = 0, ok = 0, tot = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    sh += out.shots.home + out.shots.away; g += out.goals.home + out.goals.away;
    ok += out.passOk; tot += out.passOk + out.passFail;
  }
  return { sh: sh / N / 2, g: g / N / 2, conv: 100 * g / (sh || 1), cmp: 100 * ok / (tot || 1) };
}
const JE = [0, 0.03, 0.06, 0.10, 0.15];
const res = await parMap(JE, cell);
if (!res) process.exit(0);
console.log(`\n${N} matches per cell.   want: shots 12-13, completion 78-86%, conversion 8-14%\n`);
console.log(`  judgeErr   shots/side   goals/side   conversion   completion`);
JE.forEach((je, i) => { const r = res[i];
  console.log(`  ${je.toFixed(2).padStart(6)}   ${r.sh.toFixed(2).padStart(9)}   ${r.g.toFixed(2).padStart(9)}` +
    `   ${r.conv.toFixed(1).padStart(9)}%   ${r.cmp.toFixed(1).padStart(9)}%`); });
