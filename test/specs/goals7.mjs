// THE GOAL ECONOMY, 12 October 2026, round 7: who takes the shots. With K (round 6) the goals, headers, own goals and
// penalties land on the real game's, and the top scorer still takes 38.5% of a club's goals in a 38-game season (the
// first two 62.6%, against a real ~27% and ~43%); the top shooter takes 31% of the shots (real ~18-22%), getting more of
// every kind of chance rather than a kind of his own. Arms: an attacker's extra keenness to shoot (shotAtkApp, x atkW),
// how much the pass looks for the better-placed finisher (passShotW), and the long shot (aheadShut 1).
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
const K = { gkSetReach: 0.85, shotNoiseOpen: 3.4, shotElevOpen: 0.85, headSigma: 1.1, headV: 15, headAim: 0.8, blockReach: 0.9,
            gkFillK: 1, aheadShut: 0.8, deflectPhys: 1, ogReal: 1 };
const sbk = { shotBlockK: 0.5 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "K",
  arms: [
    { name: "K", cfg: K, mt: sbk },
    { name: "app10", cfg: { ...K, shotAtkApp: 0.10 }, mt: sbk },
    { name: "app00", cfg: { ...K, shotAtkApp: 0.0 }, mt: sbk },
    { name: "psw30", cfg: { ...K, passShotW: 0.30 }, mt: sbk },
    { name: "app10_psw30", cfg: { ...K, shotAtkApp: 0.10, passShotW: 0.30 }, mt: sbk },
    { name: "ahead10", cfg: { ...K, aheadShut: 1.0 }, mt: sbk },
    { name: "app10_ahead10", cfg: { ...K, shotAtkApp: 0.10, aheadShut: 1.0 }, mt: sbk },
    { name: "psw20", cfg: { ...K, passShotW: 0.20 }, mt: sbk },
  ],
};
