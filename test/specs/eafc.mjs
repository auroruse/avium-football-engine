// THE EAFC REBUILD, OLD AGAINST NEW (22 November 2026): the engine as it stands (passing, headers, the ball in behind,
// showing for the ball, one-on-ones, a thirteen-minute match) against the last commit's (test/engine-head.mjs, built
// from it by test/rebuild.sh; never commit it to main), the same fixtures, so every metric is a paired difference.
//   FIX_FIELD=nt  the twelve strongest national sides, nl2 League Two, ale the Oberliga, otherwise League One.
//   LAB_SPEC=eafc.mjs, MINI_N fixtures a side.
const F = process.env.FIX_FIELD || "";
export default {
  field: F === "nt" ? "Avium International" : F === "nl2" ? "Nichirin League Two" : F === "ale" ? "Alemannische Oberliga" : "Nichirin League One",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 25, base: "now",
  arms: [{ name: "now" }, { name: "before", bundle: "test/engine-head.mjs" }],
};
