// THE CROSS, 15 October 2026 (the user, after Arminia v Viridia: "the vast majority of crosses were too fast to be
// threatening, whizzing past the striker in front"; then, of headers, "they seemed limp and weak when I played them").
// The app's own Sim All (test/lab.mjs runner "sim": the managers and the injuries in) with the anatomy on, on the engine
// as it now is ("now": the men attacking a cross meet it on its flight and plant on the spot, CFG.airFineSub, and the
// cross is put a beat ahead of them, CFG.crossLead) and on the same build with both switched off ("before",
// test/engine-before.mjs: crossLead 0 and the meeting never taken -- byte-identical to the last commit on golden), so
// every number is a paired difference. Each side's row carries AN.cx (every open-play cross: struck, who touched it
// first, the aerial duels on it) and the header block (how each header at goal ended, its xG, how hard the ball came in
// and how hard it left his head, and its goals by what delivered it).
//   FIX_FIELD=nl1 | nl2 | epl | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
export default {
  field: FIELD, runner: "sim",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 300), chunk: 25, base: "now",
  arms: [{ name: "now" }, { name: "before", bundle: "test/engine-before.mjs" }],
};
