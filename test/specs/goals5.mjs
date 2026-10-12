// THE GOAL ECONOMY, 12 October 2026, round 5. R is round 4's best (keeper reach standing 0.85, the shot's own read of a
// body in the way at half), with the finisher's edge in ACCURACY flattened too (shotElevSkill 0.6, shotNoiseSkill 8):
// with aim, pace and height all equal, a 0.97+ finisher still scored twice a 0.6's rate from 12-18 m on accuracy alone,
// where the real gap between an elite striker and a midfielder from the same spot is a fifth to a third. Then the level
// (open-play accuracy, block reach), the shot's read of a body for first-time shots only, more long shots.
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
const R = { gkSetReach: 0.85, shotNoiseOpen: 4.0, shotElevOpen: 1.0, headSigma: 1.1, headV: 15, headAim: 0.8, blockReach: 0.9,
            shotAimBase: 0.68, shotAimSkill: 0.15, shotV0: 21, shotVSkill: 6, shotElevSkill: 0.6, shotNoiseSkill: 8,
            gkFillK: 1, aheadShut: 0.8, deflectPhys: 1, ogReal: 1 };
const sbk = { shotBlockK: 0.5 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "base",
  arms: [
    { name: "base" },
    { name: "R", cfg: R, mt: sbk },
    { name: "R_n34", cfg: { ...R, shotNoiseOpen: 3.4 }, mt: sbk },
    { name: "R_n30", cfg: { ...R, shotNoiseOpen: 3.0 }, mt: sbk },
    { name: "R_n34_b10", cfg: { ...R, shotNoiseOpen: 3.4, blockReach: 1.0 }, mt: sbk },
    { name: "R_n34_a10", cfg: { ...R, shotNoiseOpen: 3.4, aheadShut: 1.0 }, mt: sbk },
    { name: "R_n34_ft", cfg: { ...R, shotNoiseOpen: 3.4 }, mt: { shotBlockK: 1.0, shotBlockSet: 0.3 } },
    { name: "R_n34_e085", cfg: { ...R, shotNoiseOpen: 3.4, shotElevOpen: 0.85 }, mt: sbk },
  ],
};
