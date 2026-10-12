// THE GOAL ECONOMY, 12 October 2026, round 2. Round 1 (goals1.mjs) found every arm's top scorer still at 37-39% of his
// club's goals: the strike's finishing gradient lives in the AIM and the PACE (a 0.97+ finisher aims 3.5 m off centre
// at 28.5 m/s, a 0.7 at 2.6 m and 24 m/s, so at 12-18 m the keeper saved 90% of one's and 66% of the other's on-frame
// shots) and the shots themselves sit on the strikers (the first two take 54% of a side's shots). "phys" is round 1's
// realism set (keeper reach standing 1.0, open-play accuracy, the gaussian header, block reach 0.8); "fin" moves the
// finisher's edge from placement and pace into accuracy; "A" prices the stride ahead by how packed the goal is.
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
globalThis.__anat = true;
const NT = process.env.FIX_FIELD === "nt";
const phys = { gkSetReach: 1.0, shotNoiseOpen: 4.0, shotElevOpen: 1.0, headSigma: 1.1, headV: 15, headAim: 0.8, blockReach: 0.8 };
const fin = { shotAimBase: 0.68, shotAimSkill: 0.15, shotV0: 21, shotVSkill: 6, shotElevSkill: 0.8 };
const A = { aheadShut: 0.8 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 20, base: "base",
  arms: [
    { name: "base" },
    { name: "phys", cfg: phys },
    { name: "physfin", cfg: { ...phys, ...fin } },
    { name: "pfA", cfg: { ...phys, ...fin, ...A } },
    { name: "pfA_gk09", cfg: { ...phys, ...fin, ...A, gkSetReach: 0.9 } },
    { name: "pfA_acc34", cfg: { ...phys, ...fin, ...A, shotNoiseOpen: 3.4 } },
    { name: "pfA_blk09", cfg: { ...phys, ...fin, ...A, blockReach: 0.9 } },
    { name: "pfA_flat2", cfg: { ...phys, ...fin, ...A, shotAimBase: 0.75, shotAimSkill: 0.05, shotV0: 23, shotVSkill: 4 } },
  ],
};
