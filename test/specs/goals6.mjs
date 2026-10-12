// THE GOAL ECONOMY, 12 October 2026, round 6. Rounds 2 and 5 showed the finisher's edge (aim, pace, accuracy) barely
// moves the top scorer's share -- it is set by who gets the shots -- and flattening it cost a quarter of a goal, so K
// keeps the finish as it was. K: the keeper's reach standing 0.85, open-play accuracy 3.4/0.85, the gaussian header,
// block reach 0.9, the shot's reads of a keeper filling the goal and a body in the way, the stride ahead priced by a
// packed goal, the deflection in a defender's own area and the real own-goal rule. Then the level, by the keeper (the
// real game's keepers keep out about 70% of what is on target) or by the strike.
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
const K = { gkSetReach: 0.85, shotNoiseOpen: 3.4, shotElevOpen: 0.85, headSigma: 1.1, headV: 15, headAim: 0.8, blockReach: 0.9,
            gkFillK: 1, aheadShut: 0.8, deflectPhys: 1, ogReal: 1 };
const sbk = { shotBlockK: 0.5 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "base",
  arms: [
    { name: "base" },
    { name: "K", cfg: K, mt: sbk },
    { name: "K_n30", cfg: { ...K, shotNoiseOpen: 3.0 }, mt: sbk },
    { name: "K_grab", cfg: { ...K, gkSaveReachLo: 0.12, gkSaveReachHi: 0.18 }, mt: sbk },
    { name: "K_dive", cfg: { ...K, gkDiveVmin: 2.6, gkDiveVmax: 3.6 }, mt: sbk },
    { name: "K_set75", cfg: { ...K, gkSetReach: 0.75 }, mt: sbk },
    { name: "K_e075", cfg: { ...K, shotElevOpen: 0.75 }, mt: sbk },
    { name: "K_react", cfg: { ...K, gkReactSlow: 0.30, gkReactFast: 0.22 }, mt: sbk },
  ],
};
