// WHO GETS THE CHANCES, 13 October 2026 (the user: a club's top scorer takes 38-40% of its goals against a real ~25%, and
// Peshlakai two-thirds of Sheffield's; "research the gaps between the engine and real football"). The app's own Sim All
// (test/lab.mjs runner "sim": the managers and the injuries in) with the anatomy on (lab.mjs anatomyOf): every strike
// and goal with the man's role, his big chances, his shots from outside the area and off set pieces.
//   FIX_FIELD=nl1 | nl2 | epl | nt   MINI_N fixtures a side (38 a season).
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
export default {
  field: FIELD, runner: "sim",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 76), chunk: 19, base: "base",
  arms: [{ name: "base" }],
};
