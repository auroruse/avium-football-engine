// THE ANATOMY OF A GOAL, 12 October 2026 (the user: goals inflated, top scorers past a goal a game; open play 2.46 a
// match against a real ~2.0, headers 0.18 against ~0.45, goals with no shot behind them 0.20 against ~0.08, one man
// taking half his side's goals). test/lab.mjs records with __anat set: every open-play strike and header by zone (six-
// yard box, rest of the area, outside), whether it was going in the frame, how it ended, who took it, and every goal
// with what put it in (AN/ANo on the row).
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 25, base: "base",
  arms: [{ name: "base" }],
};
