// WHERE DOES THE SHAPE TELL THE FRONT THREE TO STAND WHILE WE DEFEND?
//
// The tracking theory is dead. Giving every defender 100% of his pace closed 0.17 m of a 6.4 m gap
// and freezing the block slot entirely left 4.81 m with the 90th percentile untouched, so nobody is
// failing to reach anything. A quarter of that 6.4 m was men measured against a slot they were never
// given, and most of the rest was the two seconds after a turnover.
//
// What survived is geometry: band 2's slot sits a median 11.9 m UPFIELD OF THE BALL, and the men in
// it are BEHIND their slots rather than in front. They are not refusing to come back -- they are
// being told to stay. So this asks the shape directly, and only where it matters: with the ball in
// our own third, how far from our own goal does the block ORDER each band to stand, and how many
// men does it order into the opponent's half.
//
//   node test/frontband.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        ME_MATCH_TICKS, PITCH_L, PITCH_W, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);
// Ball depth bands from the DEFENDING side's own goal.
const ZONE = [[0, 18, "in our box"], [18, 34, "our third"], [18, 52.5, "our half"], [52.5, 105, "their half"]];

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = {};
  for (const [, , lbl] of ZONE) A[lbl] = { n: 0, slot: [[], [], []], man: [[], [], []],
                                           upSlot: 0, upMan: 0, worst: 0 };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (mp.sp || mp.idx < 0) continue;
    const def = meOther(mp.side), us = s.players[def];
    const dir = meDir(def), own = meGoalX(mp.side);
    const bd = (mp.bx - own) * dir;
    // Bands exactly as meBlock builds them: thirds of _bd0 across the outfielders.
    const idx = us.map((p, i) => i).filter(i => us[i].pos !== "GK" && !us[i].off);
    if (idx.length < 3) continue;
    let mn = Infinity, mx = -Infinity;
    for (const i of idx) { const b = us[i]._bd0; if (b < mn) mn = b; if (b > mx) mx = b; }
    const span = Math.max(1, mx - mn);
    for (const [lo, hi, lbl] of ZONE) {
      if (bd < lo || bd >= hi) continue;
      const a = A[lbl]; a.n++;
      let upS = 0, upM = 0;
      for (const i of idx) {
        const p = us[i];
        const rel = (p._bd0 - mn) / span, b = rel < 0.34 ? 0 : rel < 0.72 ? 1 : 2;
        if (p._bsx !== undefined) a.slot[b].push((p._bsx - own) * dir);
        a.man[b].push((p.x - own) * dir);
        if (p._bsx !== undefined && (p._bsx - own) * dir > PITCH_L / 2) upS++;
        if ((p.x - own) * dir > PITCH_L / 2) upM++;
      }
      a.upSlot += upS; a.upMan += upM;
      if (upM >= 6) a.worst++;                       // the screenshot: six or more men left upfield
    }
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
const md = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };

console.log(`\n${N} matches. Depths measured from the DEFENDING side's own goal, in metres.`);
console.log(`Band 0 is its deepest third by natural depth, band 2 its most advanced.\n`);
console.log(`  ball is        slices   band 0 slot/man   band 1 slot/man   band 2 slot/man   ordered   actually   6+ men`);
console.log(`                                                                                 upfield   upfield    upfield`);
console.log(`  -----------   -------   ---------------   ---------------   ---------------   -------   --------   -------`);
for (const [, , lbl] of ZONE) {
  const n = res.reduce((a, r) => a + r[lbl].n, 0) || 1;
  const cell = (b) => {
    const sl = md(res.flatMap(r => r[lbl].slot[b])), mn2 = md(res.flatMap(r => r[lbl].man[b]));
    return `${f1(sl)} / ${f1(mn2)}`.padStart(15);
  };
  console.log(`  ${lbl.padEnd(11)}   ${String(n).padStart(7)}   ${cell(0)}   ${cell(1)}   ${cell(2)}   ` +
    `${f1(res.reduce((a, r) => a + r[lbl].upSlot, 0) / n).padStart(7)}   ` +
    `${f1(res.reduce((a, r) => a + r[lbl].upMan, 0) / n).padStart(8)}   ` +
    `${(f1(100 * res.reduce((a, r) => a + r[lbl].worst, 0) / n) + "%").padStart(7)}`);
}
console.log(`\n  "ordered upfield" is how many of the ten the BLOCK ITSELF puts in the opponent's half.`);
console.log(`  If that number is close to the number actually there, nobody is failing to track back:`);
console.log(`  the shape is telling them to stay, and the fix is in meBlock's depth, not in anyone's`);
console.log(`  effort. Halfway is 52.5 m.`);
