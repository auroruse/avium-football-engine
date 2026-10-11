// DOES THE SHOWN FIGURE TELL THE TRUTH, AND DID ANYTHING ELSE MOVE (Moukden and Kirin, 11 October 2026). Every Nichirin
// League One club plays the same fixtures under each arm:
//   base     the sheets as they are, every man in his own positions
//   head     the same on the engine before positions (test/engine-head.mjs, built from the last commit): what the
//            feature changed across a league, substitutions and all
//   X as Y   two of the side's men in X slots play them on Y's skills (their own positions set to Y)
//   X -6     the same two men six rating points down, in their own positions
// A move's cost in rating points is its effect over its line's -6 effect, times six: the figure the app shows
// (src/data/positions.js POS_DROP) should be about that. test/specs/positions-check-fit.mjs reads it.
//   LAB_SPEC=positions-check.mjs, MINI_N fixtures a club.
const pick = (t, test, n = 2) => (t.squad || []).map((p, i) => [p, i]).filter(([p, i]) => i < 11 && !p.bench && test(p.spos || "")).slice(0, n).map(([, i]) => i);
const recast = (who, own) => (t) => { const at = new Set(pick(t, who));
  return { ...t, squad: t.squad.map((p, i) => (at.has(i) ? { ...p, own: [typeof own === "function" ? own(p) : own], _att: null } : p)) }; };
const down = (who, by) => (t) => { const at = new Set(pick(t, who));
  return { ...t, squad: t.squad.map((p, i) => (at.has(i) ? { ...p, ovr: (p.ovr ?? t.skill ?? 70) - by } : p)) }; };
const CB = (s) => s === "CB", MIDC = (s) => s === "CM" || s === "DM", ST = (s) => s === "ST", FB = (s) => s === "LB" || s === "RB",
  WIDE = (s) => s === "LW" || s === "RW" || s === "LM" || s === "RM";
const side = (s) => (/^L/.test(s) ? "L" : "R");
export const MOVES = [
  ["CB as CM", CB, "CM", "CB -6"], ["CM as CB", MIDC, "CB", "CM -6"], ["ST as CM", ST, "CM", "ST -6"], ["CM as ST", MIDC, "ST", "CM -6"],
  ["FB as W", FB, (p) => side(p.spos) + "W", "FB -6"], ["W as FB", WIDE, (p) => side(p.spos) + "B", "W -6"],
];
const CAL = { "CB -6": CB, "CM -6": MIDC, "ST -6": ST, "FB -6": FB, "W -6": WIDE };
const arms = [
  { name: "base" },
  { name: "head", bundle: "test/engine-head.mjs" },
  ...MOVES.map(([name, who, own]) => ({ name, team: recast(who, own) })),
  ...Object.entries(CAL).map(([name, who]) => ({ name, team: down(who, 6) })),
];
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 100), chunk: 25, base: "base", arms };
