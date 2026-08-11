// Offside, now that it can actually happen. Real football: 2-3 a side a match, and it is the payoff
// for holding a high line -- with a perfect view of the linesman's line nobody ever plays one.
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
const N = +(process.env.N || 20);
function cell({ blind, line }) {
  CFG.offBlind = blind;
  let off = 0, g = 0, sh = 0, ok = 0, tot = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF, defLine: line }, away: { ...STRAT_DEF, defLine: line } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    off += (out.offside?.home || 0) + (out.offside?.away || 0);
    g += out.goals.home + out.goals.away; sh += out.shots.home + out.shots.away;
    ok += out.passOk; tot += out.passOk + out.passFail;
  }
  return { off: off/N/2, g: g/N/2, sh: sh/N/2, cmp: 100*ok/(tot||1) };
}
const CELLS = [];
for (const blind of [1.5, 3.0, 5.0]) for (const line of [0, 2]) CELLS.push({ blind, line });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f2 = (x) => x.toFixed(2);
console.log(`\n${N} matches per cell. Per side per match.   want: offside 2-3\n`);
console.log(`  offBlind  defLine   offsides   goals   shots   completion`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok2 = r.off >= 1.8 && r.off <= 3.4;
  console.log(`  ${c.blind.toFixed(1).padStart(8)}  ${String(c.line).padStart(7)}   ${f2(r.off).padStart(8)}` +
    `  ${f2(r.g).padStart(6)}  ${f2(r.sh).padStart(6)}   ${r.cmp.toFixed(1).padStart(9)}%${ok2 ? "  <==" : ""}`); });
console.log(`\n  defLine 2 is a HIGH line -- offsides should rise with it, which is the trap paying off.`);
