// THE MISTAKES AND THE GOAL MIX (22 November 2026): the build as it stands against the last commit's and against
// variants of its own settings, the same fixtures, so every metric is a paired difference from "now".
//   FIX_FIELD=nt  the twelve strongest national sides, otherwise League One. MINI_N fixtures a side.
//   ARMS=a,b      only those arms beside "now".
const F = process.env.FIX_FIELD || "";
const all = [
  { name: "before", bundle: "test/engine-head.mjs" },
  // the leg thrown at a pass in his own area: none of it, and more of it
  { name: "nocut", cfg: { boxCutK: 1 } },
  { name: "cut2", cfg: { boxCutK: 2 } },
  // the mistakes a step softer and a step harder
  { name: "soft", cfg: { passNoisePress: 5, pressQHi: 1.3, execNoiseDeg: 9.5, execPow: 0.13, execShotLoss: 0.6, ftDp: 0.40, ttbAnticip: 0.8, judgeErr: 0.075 } },
  { name: "hard", cfg: { passNoisePress: 8, pressQHi: 1.6, execNoiseDeg: 12.5, execPow: 0.16, execShotLoss: 0.75, ftDp: 0.5, ttbAnticip: 1.0, judgeErr: 0.09 } },
  // headed chances a step down and a step up
  { name: "hdr1", cfg: { crossHeadK: 1.6, airDef: 0.45 } },
  { name: "hdr3", cfg: { crossHeadK: 2.6, airDef: 0.38, headShotR: 14.5 } },
  // penalties as they were
  { name: "pen0", cfg: { handP: 0.016 }, mt: { boxTackleFoul: 0.3, boxContactFoul: 0.2 } },
];
const pick = (process.env.ARMS || "").split(",").filter(Boolean);
export default {
  field: F === "nt" ? "Avium International" : "Nichirin League One",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 60), chunk: 25, base: "now",
  arms: [{ name: "now" }].concat(pick.length ? all.filter(a => pick.includes(a.name)) : all),
};
