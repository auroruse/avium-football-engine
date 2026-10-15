// THE HEADER, 15 October 2026 (the user: "Make header velocity dependent on two things. Momentum of the player going
// into it, and momentum of the ball. To adjust accuracy, more header can then go over, and wider too"). The app's own
// Sim All with the anatomy on (as test/specs/crosses.mjs), on four engines over the same fixtures:
//   now        the header as a collision (ball.ts meHeadV) at its spread as shipped, headNoise 13 / headNoiseZ 5.5
//   law-11-3   the collision at the old spread, 11 / 3 -- what the pace alone does
//   law-15-7   the collision at more spread, 15 / 7 -- the other side of the target
//   cross-only the engine before the header change (lab commit bbec832, test/engine-xonly.mjs), the old pace
// The target is the Premier League's 2019/20-2023/24 headed shots: 36-39% on target, 10-13.5% scored, 28-35% of the ones
// on target scored, about a third of the misses over the bar. test/engine-xonly.mjs is built from bbec832 by git archive
// and test/rebuild.sh, with the over-the-bar flag patched into its "wide" label; never commit it.
//   FIX_FIELD=nl1 | nl2 | epl | nt   MINI_N fixtures a side (200).
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
export default {
  field: FIELD, runner: "sim",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 200), chunk: 25, base: "now",
  arms: [{ name: "now" }, { name: "law-11-3", cfg: { headNoise: 11, headNoiseZ: 3 } }, { name: "law-15-7", cfg: { headNoise: 15, headNoiseZ: 7 } },
         { name: "cross-only", bundle: "test/engine-xonly.mjs" }],
};
