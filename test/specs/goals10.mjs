// Round 10 (12 October 2026): the shot through bodies, decision side. FIX_FIELD, MINI_N.
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
export default {
  field: FIELD, runner: process.env.RUNNER === "sim" ? "sim" : undefined,
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 80), chunk: 20, base: "now",
  arms: [
    { name: "now" },
    { name: "lk06", cfg: { shotLaneK: 0.6 } },
    { name: "lk03", cfg: { shotLaneK: 0.3 } },
    { name: "soft", cfg: { gkFillK: 0.5 }, mt: { shotBlockK: 0.3 } },
    { name: "lk06_soft", cfg: { shotLaneK: 0.6, gkFillK: 0.5 }, mt: { shotBlockK: 0.3 } },
  ],
};
