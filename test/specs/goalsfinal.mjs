// THE GOAL ECONOMY, 12 October 2026, the check: the app's own Sim All (test/lab.mjs runner "sim": the managers and the
// injuries in), before tonight's changes (every one of them set back in `before`) and as shipped, for a league's scorers
// over whole seasons.   FIX_FIELD=nl1 | nl2 | epl | nt   MINI_N fixtures a side.
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
const before = { boxBallK: {}, gkSetReach: 1.3, shotNoiseOpen: 2.6, shotElevOpen: 0.7, headSigma: 0, headV: 12, headAim: 0.55,
                 blockReach: 0.6, gkFillK: 0, aheadShut: 0, deflectPhys: 0, ogReal: 0 };
export default {
  field: FIELD, runner: "sim",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 76), chunk: 19, base: "now",
  arms: [{ name: "now" }, { name: "before", cfg: before, mt: { shotBlockK: 0 } }],
};
