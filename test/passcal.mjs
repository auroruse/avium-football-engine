// Is the passer's own completion model honest? He scores every pass by `ok` and then physics
// settles it. If those two disagree he is not making bad decisions, he is making decisions from
// a fiction -- and no amount of tuning the defence fixes that.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

if (process.env.RCV) CFG.rcvLateMs = +process.env.RCV;
const BINS = [0.3, 0.5, 0.65, 0.75, 0.85, 0.92, 1.01];
const bn = BINS.map(() => ({ n: 0, ok: 0, pred: 0 }));
const grp = {};                     // by kind: feet/thru x ground/high, and forced vs free
const g = (k) => (grp[k] = grp[k] || { n: 0, ok: 0, pred: 0 });

for (let seed = 1; seed <= 6; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let live = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, had = mp.passPending;
    meTick(s, rng, out);
    if (!had && mp.passPending) live = { ...mp.passPending };
    else if (live && !mp.passPending) {
      const ok = mp.idx >= 0 && mp.side === live.side ? 1 : 0;
      if (typeof live.p !== "number") { live = null; continue; }   // a restart, not a decision
      const b = BINS.findIndex(x => live.p < x);
      bn[b].n++; bn[b].ok += ok; bn[b].pred += live.p;
      for (const k of [live.thru ? "into space" : "to feet", live.high ? "lofted" : "along the ground",
                       live.forced ? "forced release" : "free choice",
                       live.d < 12 ? "short  <12 m" : live.d < 25 ? "medium 12-25 m" : "long   >25 m"]) {
        const o = g(k); o.n++; o.ok += ok; o.pred += live.p;
      }
      live = null;
    }
  }
}
const pc = (a, b) => (100 * a / (b || 1)).toFixed(0) + "%";
console.log("\nwhat he predicted        n     he said    it landed    gap");
let lo = 0;
for (let i = 0; i < BINS.length; i++) {
  const o = bn[i]; if (!o.n) { lo = BINS[i]; continue; }
  const pred = 100 * o.pred / o.n, act = 100 * o.ok / o.n;
  console.log(`  ${(lo*100).toFixed(0)}-${(Math.min(1,BINS[i])*100).toFixed(0)}%`.padEnd(22) +
    `${String(o.n).padStart(4)}   ${pred.toFixed(0).padStart(6)}%   ${act.toFixed(0).padStart(8)}%   ` +
    `${(act - pred > 0 ? "+" : "") + (act - pred).toFixed(0)}`);
  lo = BINS[i];
}
console.log("\nby kind                  n     he said    it landed    gap");
for (const k of Object.keys(grp)) {
  const o = grp[k], pred = 100 * o.pred / o.n, act = 100 * o.ok / o.n;
  console.log(`  ${k}`.padEnd(22) + `${String(o.n).padStart(4)}   ${pred.toFixed(0).padStart(6)}%   ${act.toFixed(0).padStart(8)}%   ` +
    `${(act - pred > 0 ? "+" : "") + (act - pred).toFixed(0)}`);
}
const N = bn.reduce((a, o) => a + o.n, 0), OK = bn.reduce((a, o) => a + o.ok, 0), P = bn.reduce((a, o) => a + o.pred, 0);
console.log(`\noverall: he expected ${pc(P, N)}, he got ${pc(OK, N)}  (real football: 78-88%)`);
