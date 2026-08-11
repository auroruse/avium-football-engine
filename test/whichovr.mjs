// WHERE DOES A RATING GO? The OVR ladder is non-monotone -- an 85 side loses to a 65 side -- and the
// obvious culprit was ME_COMPRESS squeezing the gap. But `tackle` is read exactly nowhere, `strength`
// and `position` have one token channel each, and `pace` has one narrow one, while `pass` is read
// eleven times and `shoot` seven. So the suspicion is not that ratings are compressed. It is that
// ATTACKING quality reaches the pitch and DEFENDING quality does not -- in which case raising both
// sides' ratings changes nothing, because the better side attacks better and defends the same.
//
// One way to know. Give a side better attackers only, then better defenders only.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, STRAT_DEF } = eng;

// ME_COMPRESS is a module const, so it cannot be poked at runtime -- but meOvr is the ONLY reader of
// p.ovr in the whole engine (verified), so feeding a pre-scaled rating is exactly equivalent.
const C0 = 0.40;
const pre = (ovr, C) => 70 + (ovr - 70) * C / C0;

const sq = (att, def, C, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench).map((p, i) => ({
  ...p, name: p.pos + i, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null,
  ovr: pre(p.pos === "FWD" || p.pos === "MID" ? att : def, C),
}));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 14);
// EVERY TIE BOTH WAYS ROUND. Without it this harness cannot tell a rating effect from a side bias,
// and it duly reported two IDENTICAL teams finishing 4.94-5.75 with the home side winning 38% -- a
// reading I nearly took for a broken patch. Whoever kicks off has the ball, and over a whole match
// that is worth something; it has to cancel, not be counted as skill.
function play(hAtt, hDef, aAtt, aDef, C = C0) {
  let gh = 0, ga = 0, sh = 0, sa = 0, w = 0, d = 0, n = 0;
  for (let seed = 1; seed <= N; seed++) for (const flip of [false, true]) {
    const s = createMatchState();
    s.players.home = sq(flip ? aAtt : hAtt, flip ? aDef : hDef, C);
    s.players.away = sq(flip ? hAtt : aAtt, flip ? hDef : aDef, C);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    // "H" is always the side described first, whichever end it happened to be playing from.
    const H = flip ? "away" : "home", A = flip ? "home" : "away";
    gh += out.goals[H]; ga += out.goals[A]; sh += out.shots[H]; sa += out.shots[A]; n++;
    if (out.goals[H] > out.goals[A]) w++; else if (out.goals[H] === out.goals[A]) d++;
  }
  return { gh: gh/n, ga: ga/n, sh: sh/n, sa: sa/n, win: 100*w/n, drw: 100*d/n, ratio: gh/(ga||1) };
}
const f2 = (x) => x.toFixed(2), f0 = (x) => x.toFixed(0);
const row = (lbl, r) => console.log(`  ${lbl.padEnd(42)} ${f2(r.gh)} - ${f2(r.ga)}   ${f2(r.sh).padStart(5)} - ${f2(r.sa).padStart(5)}` +
  `   ${f0(r.win).padStart(3)}%   ratio ${f2(r.ratio)}`);

const CELLS = [
  ["both sides 70 (control)",             [70, 70, 70, 70, C0]],
  ["home ATTACK 90, everything else 70",  [90, 70, 70, 70, C0]],
  ["home DEFENCE 90, everything else 70", [70, 90, 70, 70, C0]],
  ["home all 90 v away all 70",           [90, 90, 70, 70, C0]],
  ["home ATTACK 50 (weak attack)",        [50, 70, 70, 70, C0]],
  ["home DEFENCE 50 (weak defence)",      [70, 50, 70, 70, C0]],
  ...[0.40, 0.60, 0.80, 1.00].map(C => [`ME_COMPRESS ${C.toFixed(2)}   85 v 55`, [85, 85, 55, 55, C]]),
];
const res = await parMap(CELLS, ([, a]) => play(...a));
if (!res) process.exit(0);

console.log(`\n${N * 2} matches each (every tie both ways round). The side described first is "home".`);
console.log(`\n=========== 1. WHICH HALF OF A RATING REACHES THE PITCH? ===========`);
console.log(`  ${"".padEnd(42)}  goals        shots       win%`);
for (let i = 0; i < 6; i++) { if (i === 4) console.log(``); row(CELLS[i][0], res[i]); }

console.log(`\n=========== 2. IS IT REALLY THE COMPRESSION? same 30-point gap, four settings ===========`);
console.log(`  ${"".padEnd(42)}  goals        shots       win%`);
for (let i = 6; i < CELLS.length; i++) row(CELLS[i][0], res[i]);

console.log(`\nif attack transmits and defence does not, raising compression makes it WORSE, not better:`);
console.log(`it amplifies the half that already works and leaves the half that does not where it is.`);
