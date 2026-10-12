// SPREADING THE CHANCES, 13 October 2026 (the user: a club's top scorer takes 38-40% of its goals against a real ~25%, and
// Peshlakai two-thirds of Sheffield's; research the gaps, fix them properly, behaviour normal). Each arm is one candidate
// cause, measured with the anatomy on (test/lab.mjs anatomyOf; FIX_FIELD, MINI_N as chances.mjs). RUNNER=sim (default)
// plays the app's Sim All, so a club's season is the user's; RUNNER=play plays the lab's watched match, for how the
// sides played (passes, crosses, carries, the block).
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
const XCAL = { crossCalA: -0.79, crossCalB: 0.46 };
export default {
  field: FIELD, runner: process.env.RUNNER === "play" ? undefined : "sim",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 76), chunk: 19, base: "base",
  arms: process.env.ARMS === "2" ? [
    { name: "base" },
    { name: "combo1", cfg: XCAL, mt: { cntLast: 25, tuckIn: 0.7, lateRun: 1 } },
    { name: "combo2", cfg: XCAL, mt: { cntLast: 25, tuckIn: 1, lateRun: 1.6 } },
    { name: "late", mt: { lateRun: 1.6 } },
  ] : [
    { name: "base" },
    { name: "xcal", cfg: XCAL },                       // the cross believed at what crosses do
    { name: "cnt25", mt: { cntLast: 25 } },            // a break's limits end 25 m out
    { name: "xcal+cnt25", cfg: XCAL, mt: { cntLast: 25 } },
  ],
};
