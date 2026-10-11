// THE FOUR FIXES OF 11 OCTOBER 2026, A/B (the user's Nichirin v Alemannia report: a throw-in returned to the thrower and
// lost, defenders shadowing a ball they could win, unchallenged receivers missing high balls, through balls overhit or
// played to the keeper). Every side in the field plays the same fixtures on the engine as it now is (base) and on the
// last commit's (head, test/engine-head.mjs, built from it), so each metric's change is a paired difference.
//   FIX_FIELD=nl1  Nichirin League One, every club (where the league's scoring is calibrated)
//   FIX_FIELD=nt   the twelve strongest national sides, against each other (where the faults were seen)
//   LAB_SPEC=fixes.mjs, MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt";
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 25, base: "base",
  arms: [{ name: "base" }, { name: "head", bundle: "test/engine-head.mjs" }],
};
