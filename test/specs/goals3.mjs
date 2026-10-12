// THE GOAL ECONOMY, 12 October 2026, round 3. P is round 2's physics (keeper reach standing 1.0, open-play accuracy,
// the gaussian header, block reach 0.9) with the finisher's edge moved from placement and pace to accuracy. Round 3
// adds the shooter's read of a keeper filling the goal at point blank (gkFillK: traced, three in ten close shots
// through the middle were struck at a keeper inside two metres, and came back off him to be struck again), the stride
// ahead priced by how packed the goal is (aheadShut), the deflection in a defender's own area (deflectPhys) and the
// real game's own-goal rule (ogReal), then two ways of setting the level.
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
const P = { gkSetReach: 1.0, shotNoiseOpen: 4.0, shotElevOpen: 1.0, headSigma: 1.1, headV: 15, headAim: 0.8, blockReach: 0.9,
            shotAimBase: 0.68, shotAimSkill: 0.15, shotV0: 21, shotVSkill: 6, shotElevSkill: 0.8 };
const F = { ...P, gkFillK: 1 }, FA = { ...F, aheadShut: 0.8 }, FAD = { ...FA, deflectPhys: 1, ogReal: 1 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "base",
  arms: [
    { name: "base" },
    { name: "P", cfg: P },
    { name: "F", cfg: F },
    { name: "FA", cfg: FA },
    { name: "FA_og", cfg: { ...FA, ogReal: 1 } },
    { name: "FAD", cfg: FAD },
    { name: "FAD_gk115", cfg: { ...FAD, gkSetReach: 1.15 } },
    { name: "FAD_acc34", cfg: { ...FAD, shotNoiseOpen: 3.4 } },
  ],
};
