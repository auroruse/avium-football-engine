// Round 9 (12 October 2026): two on their main man in the box (MT.boxDouble). FIX_FIELD, MINI_N; RUNNER=sim for Sim All.
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
export default {
  field: FIELD, runner: process.env.RUNNER === "sim" ? "sim" : undefined,
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 80), chunk: 19, base: "now",
  arms: [{ name: "now" }, { name: "double", mt: { boxDouble: 1 } }],
};
