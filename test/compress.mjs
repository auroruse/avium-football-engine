// CALIBRATING ME_COMPRESS. The 0.40 it sits at is defended by a comment -- "at 1.0 a 29-point gap
// produced a nine-goal difference" -- that does not reproduce: at 1.0 the same gap gives 5.79-3.93.
// That measurement was taken while a third of every match was frozen solid, so the constant is
// currently held down by nothing. This finds out what it should be.
//
// Above 1.0 is AMPLIFICATION, which is a legitimate answer: nothing says one OVR point has to be
// worth one attribute point. What bites up there is the 20..99 clamp in meAttrs -- a very high or
// very low rating saturates -- so the sweep goes past 1.0 to find where that starts to matter.
//
// Reference points a football sim should hit, strong side's win rate:
//   gap 10  (top four v mid table)      60-65%
//   gap 20  (champions v relegated)     75-80%
//   gap 30  (a league apart)            85%+
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, STRAT_DEF } = eng;

const C0 = 0.40;                                    // what meOvr already applies
const pre = (ovr, C) => 70 + (ovr - 70) * C / C0;   // meOvr is the only reader of p.ovr, verified
const sq = (ovr, C, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: pre(ovr, C), stamina: 100, rating: 6.5,
                    atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 18);
// Both orderings of every tie, so the strong side plays half its matches at home and the
// first-possession bias cancels instead of being read as rating.
function play(strong, weak, C) {
  let gs = 0, gw = 0, w = 0, d = 0, n = 0;
  for (let seed = 1; seed <= N; seed++) for (const flip of [false, true]) {
    const s = createMatchState();
    s.players.home = sq(flip ? weak : strong, C); s.players.away = sq(flip ? strong : weak, C);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    const S = flip ? out.goals.away : out.goals.home, W = flip ? out.goals.home : out.goals.away;
    gs += S; gw += W; n++;
    if (S > W) w++; else if (S === W) d++;
  }
  return { gs: gs/n, gw: gw/n, win: 100*w/n, drw: 100*d/n, ratio: gs/(gw || 1) };
}

// Trimmed to the band the answer lives in. A 24-cell grid answered a question that needed nine,
// and cost seven minutes doing it. GAPS/CS override from the environment when a wider look is wanted.
const GAPS = (process.env.GAPS || "0,10,20,30").split(",").map(Number);
const CS = (process.env.CS || "0.4,0.5,0.6,0.8").split(",").map(Number);
const WANT = { 0: "50%", 10: "60-65%", 20: "75-80%", 30: "85%+" };
const f2 = (x) => x.toFixed(2), f0 = (x) => x.toFixed(0);

const cells = [];
for (const g of GAPS) for (const C of CS) cells.push({ g, C });
const res = await parMap(cells, ({ g, C }) => play(70 + g / 2, 70 - g / 2, C));
if (!res) process.exit(0);                       // a worker; it has posted its slice already

console.log(`\n${N * 2} matches per cell (each tie played both ways round so home bias cancels).`);
console.log(`strong side's win% -- and in brackets its goals-for over goals-against.\n`);
console.log(`  gap   want    ` + CS.map(c => `C=${c.toFixed(1)}`.padStart(14)).join(""));
GAPS.forEach((g, gi) => {
  const row = CS.map((C, ci) => {
    const r = res[gi * CS.length + ci];
    return `${f0(r.win)}% (${f2(r.ratio)})`.padStart(14);
  });
  console.log(`  ${String(g).padStart(3)}   ${WANT[g].padEnd(7)} ${row.join("")}`);
});
console.log(`\nread DOWN a column: does a bigger gap produce a bigger edge? that is the monotonicity that is broken today.`);
console.log(`read ACROSS a row:  how much of the edge compression alone can buy before it saturates on the 20..99 clamp.`);
