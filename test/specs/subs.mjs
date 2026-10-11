// THE BENCH OF 11 OCTOBER 2026, A/B (the user: "Why the hell are subs so early?"). The rebuild of 2 October let a better
// manager change sooner and on a higher line from 35 minutes, so a pressing side made its five changes before half time;
// match.ts meCoachSubs now keeps tactical changes for legs that are gone before the hour and takes them in the law's three
// windows. Every side in the field plays the same fixtures on the engine as it now is (base) and on the last commit's
// (head, test/engine-head.mjs), so each metric's change is a paired difference. test/lab.mjs records each side's changes
// (nsub, sub45, sub60, subT the minutes added up) and its outfield stamina at half time (stamHT) and the end (stam).
//   FIX_FIELD=nl1  Nichirin League One, every club
//   FIX_FIELD=nt   the twelve strongest national sides, against each other
//   LAB_SPEC=subs.mjs, MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt";
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 25, base: "base",
  arms: [{ name: "base" }, { name: "head", bundle: "test/engine-head.mjs" }],
};
