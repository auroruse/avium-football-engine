// How tired a match should leave you, and what that does to the bench. These two only make sense
// together: a threshold cannot fire if nobody ever gets near it, which is why subs read 0.17.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const squad = (o) => buildSquad("4-3-3", null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 14);
function cell({ dr, th }) {
  CFG.drain = dr; CFG.subStamina = th;
  let subs = 0, g = 0, sh = 0, cmp = 0, tot = 0, lo = 0, med = 0, half = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    const hs = squad(75), as = squad(75);
    s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
    s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      meTick(s, rng, out);
      if (t === (ME_MATCH_TICKS >> 1)) {
        const a = []; for (const sd of ["home","away"]) for (const q of s.players[sd]) if (q.pos !== "GK") a.push(q.stamina);
        half += a.reduce((x,y)=>x+y,0) / a.length;
      }
    }
    const a = []; for (const sd of ["home","away"]) for (const q of s.players[sd]) if (q.pos !== "GK") a.push(q.stamina);
    a.sort((x,y)=>x-y); lo += a[0]; med += a[a.length>>1];
    subs += s.subs.home + s.subs.away;
    g += out.goals.home + out.goals.away; sh += out.shots.home + out.shots.away;
    cmp += out.passOk; tot += out.passOk + out.passFail;
  }
  return { subs: subs/N, lo: lo/N, med: med/N, half: half/N, g: g/N/2, sh: sh/N/2, cmp: 100*cmp/(tot||1) };
}
const CELLS = [];
for (const dr of [0.0026, 0.0050, 0.0075]) for (const th of [66, 74]) CELLS.push({ dr, th });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell.   want: ~4-5 subs, half-time ~85, full-time median ~72\n`);
console.log(`   drain   subAt   subs/match   HT stam   FT median   FT lowest   goals/side   completion`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok = r.subs >= 3 && r.subs <= 7;
  console.log(`  ${c.dr.toFixed(4)}  ${String(c.th).padStart(5)}   ${r.subs.toFixed(2).padStart(10)}   ${f1(r.half).padStart(7)}` +
    `   ${f1(r.med).padStart(9)}   ${f1(r.lo).padStart(9)}   ${f1(r.g).padStart(10)}   ${f1(r.cmp).padStart(9)}%${ok ? "  <==" : ""}`); });
