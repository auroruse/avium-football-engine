// THE GOAL ECONOMY, 12 October 2026, round 1: what each piece of the strike and the save does to where goals come from.
// Base has the box ball attacked in the air (match.ts boxBall/boxHead). Arms, as CFG overrides: the keeper's reach
// standing (gkSetReach), open-play accuracy (shotNoiseOpen, shotElevOpen), the header (headSigma, headV, headAim), a
// flatter finish (shotElevSkill, shotAimSkill, shotVSkill with shotAimBase/shotV0 holding the mean), the block
// (blockReach), and all of them at once. test/lab.mjs with __anat records the anatomy (AN/ANo).
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
const head1 = { headSigma: 0.9, headV: 14, headAim: 0.75 };
const acc = { shotNoiseOpen: 4.0, shotElevOpen: 1.0 };
const flat = { shotElevSkill: 0.8, shotAimSkill: 0.35, shotAimBase: 0.5, shotVSkill: 7, shotV0: 20 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "base",
  arms: [
    { name: "base" },
    { name: "gk100", cfg: { gkSetReach: 1.0 } },
    { name: "gk085", cfg: { gkSetReach: 0.85 } },
    { name: "acc", cfg: acc },
    { name: "head1", cfg: head1 },
    { name: "head2", cfg: { headSigma: 1.2, headV: 15, headAim: 0.8 } },
    { name: "flat", cfg: flat },
    { name: "blk", cfg: { blockReach: 0.8 } },
    { name: "combo", cfg: { gkSetReach: 1.0, ...acc, ...head1, ...flat } },
  ],
};
