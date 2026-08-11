// Substitutions. The one thing that must never break: a swap is IN PLACE, so every index in the
// engine still points at the man it meant. If that were wrong the symptom would not be "subs look
// odd", it would be the ball teleporting to a random player -- so that is what this checks first.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, ME_TPM, STRAT_DEF, CFG } = eng;
const squad = (o) => buildSquad("4-3-3", null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 24);
function run(seed) {
  const s = createMatchState();
  const hs = squad(75), as = squad(75);
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let bad = 0, xi = 0, dup = 0, gk = 0, firstSub = -1;
  const total = ME_MATCH_TICKS;
  for (let t = 0; t < total + 900; t++) {
    if (t >= total && t >= total + meAdded(s)) break;
    meTick(s, rng, out);
    const mp = s.mePos;
    // INVARIANTS, every slice
    for (const sd of ["home", "away"]) {
      const ps = s.players[sd];
      if (ps.length !== 11) xi++;
      if (ps.some(q => !q)) bad++;
      const names = new Set(ps.map(q => q && q.name));
      if (names.size !== ps.length) dup++;
      if (ps.filter(q => q && q.pos === "GK").length !== 1) gk++;
    }
    if (mp.idx >= 0 && !s.players[mp.side][mp.idx]) bad++;
    if (firstSub < 0 && (s.subs.home + s.subs.away) > 0) firstSub = mp.tick;
  }
  const stam = (sd) => s.players[sd].reduce((a, q) => a + (q.stamina ?? 100), 0) / 11;
  return { subs: s.subs.home + s.subs.away, bad, xi, dup, gk, firstSub,
           stam: (stam("home") + stam("away")) / 2,
           g: out.goals.home + out.goals.away, sh: out.shots.home + out.shots.away,
           inj: (out.injuries?.home || 0) + (out.injuries?.away || 0),
           off10: ["home","away"].reduce((a, sd) => a + s.players[sd].filter(q => q.off).length, 0) };
}
const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const sum = (k) => res.reduce((a, r) => a + r[k], 0);
const mean = (k) => sum(k) / N;
console.log(`\n${N} matches.\n`);
console.log(`  INVARIANTS (any non-zero is a corrupted squad)`);
console.log(`    XI not 11 men          ${sum("xi")}`);
console.log(`    a null in the XI       ${sum("bad")}`);
console.log(`    duplicate player       ${sum("dup")}`);
console.log(`    not exactly one keeper ${sum("gk")}`);
console.log(`\n  substitutions per match  ${mean("subs").toFixed(2)}      real ~4-5 with five allowed`);
console.log(`  first change at          ${(res.filter(r=>r.firstSub>0).reduce((a,r)=>a+r.firstSub,0)/Math.max(1,res.filter(r=>r.firstSub>0).length)/ME_TPM*90/18).toFixed(0)}' on a 90 clock`);
console.log(`  mean stamina at the end  ${mean("stam").toFixed(1)}     was ~70 with nobody able to come off`);
console.log(`  men left on the pitch unable to play: ${sum("off10")}`);
console.log(`  goals/side ${(mean("g")/2).toFixed(2)}   shots/side ${(mean("sh")/2).toFixed(2)}   injuries/match ${mean("inj").toFixed(2)}`);
