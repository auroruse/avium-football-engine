// THE GOAL ECONOMY, 12 October 2026, round 4. FAD is round 3's package with the keeper read moved onto the shot he can
// take now (meKeeperFill: priced into passes and carries it read today's keeper into tomorrow's chance and cost goals),
// and "sbk" the shot's own read of a body in the way (blockRisk; traced, a man at the byline struck the defender a
// metre away up to six times running as the ball came back to him). Then the level, set by the keeper's reach standing
// (gkSetReach; close and mid-range shots are saved more than in the real game) and open-play accuracy.
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
const FAD = { gkSetReach: 1.0, shotNoiseOpen: 4.0, shotElevOpen: 1.0, headSigma: 1.1, headV: 15, headAim: 0.8, blockReach: 0.9,
              shotAimBase: 0.68, shotAimSkill: 0.15, shotV0: 21, shotVSkill: 6, shotElevSkill: 0.8,
              gkFillK: 1, aheadShut: 0.8, deflectPhys: 1, ogReal: 1 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "base",
  arms: [
    { name: "base" },
    { name: "FAD", cfg: FAD },
    { name: "sbk05", cfg: FAD, mt: { shotBlockK: 0.5 } },
    { name: "sbk10", cfg: FAD, mt: { shotBlockK: 1.0 } },
    { name: "sbk05_gk085", cfg: { ...FAD, gkSetReach: 0.85 }, mt: { shotBlockK: 0.5 } },
    { name: "sbk05_gk085_n34", cfg: { ...FAD, gkSetReach: 0.85, shotNoiseOpen: 3.4 }, mt: { shotBlockK: 0.5 } },
    { name: "sbk05_gk075", cfg: { ...FAD, gkSetReach: 0.75 }, mt: { shotBlockK: 0.5 } },
    { name: "sbk05_gk085_b08", cfg: { ...FAD, gkSetReach: 0.85, blockReach: 0.8 }, mt: { shotBlockK: 0.5 } },
  ],
};
