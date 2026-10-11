// SET PIECES, 12 October 2026 (the user: goals "so inflated", top scorers past a goal a game, "a lot of free kicks
// converted from ridiculously steep angles"). Every club in the field plays the same fixtures on the engine as it now is
// (base) and on the last commit's (head, test/engine-head.mjs), so each figure's change is a paired difference.
// test/lab.mjs records, per side and match, the free kicks it struck at goal (fkTry, fkWide from more than 12 m off the
// middle, fkD their summed distance) and what they scored (g_fk; on head they land in g_oth), and the penalties it was
// given for a foul (penF) and for a handball (penH); g_pen is what they scored.
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt";
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 25, base: "base",
  arms: [{ name: "base" }, { name: "head", bundle: "test/engine-head.mjs" }],
};
