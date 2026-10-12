// THE GOAL ECONOMY, 12 October 2026, round 8: the long shot through traffic. As shipped, 19% of shots come from outside
// the area against a real 32-38%, blocked shots are 17% against 26%, and a side takes 11 shots a match against 12.5-13.5
// -- the missing shots are midfielders' from range, which is also why one striker takes 40% of some sides' shots. The
// sight bonus (mind/decide.ts appetite) asks for a CLEAR lane (shotLaneClear); a real midfielder shoots from 22 m through
// bodies when the goal is packed, and is blocked a third of the time doing it.   FIX_FIELD, MINI_N as ever.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "now",
  arms: [
    { name: "now" },
    { name: "lane3", cfg: { shotLaneClear: 3.0 } },
    { name: "lane5", cfg: { shotLaneClear: 5.0 } },
    { name: "lane3_rng", cfg: { shotLaneClear: 3.0, shotRange: 17 } },
  ],
};
