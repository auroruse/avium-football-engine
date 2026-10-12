// SPREADING THE CHANCES, 13 October 2026 (the user: a club's top scorer takes 38-40% of its goals against a real ~25%, and
// Peshlakai two-thirds of Sheffield's; research the gaps, fix them properly, behaviour normal). Each arm is one candidate
// cause, measured with the anatomy on (test/lab.mjs anatomyOf; FIX_FIELD, MINI_N as chances.mjs). RUNNER=sim (default)
// plays the app's Sim All, so a club's season is the user's; RUNNER=play plays the lab's watched match, for how the
// sides played (passes, crosses, carries, the block).
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
const XCAL = { crossCalA: -0.79, crossCalB: 0.46 };
// Role rewrites for the diagnostic arms: strikers' box propensity scaled by sk (or capped at cap), central midfielders' by mk.
const RO = (sk, cap, mk) => { const R = { st: { drop: 0.35, behind: 0.5, box: 0.85 }, st_complete: { drop: 0.5, behind: 0.45, box: 0.85 },
  st_target: { drop: 0.3, behind: 0.1, box: 0.95 }, st_poach: { behind: 0.9, box: 1.0 }, st_press: { behind: 0.6, drop: 0.25, box: 0.85 },
  cm: { box: 0.4, third: 0.3, behind: 0.1 }, cm_b2b: { box: 0.7, third: 0.5, behind: 0.2 }, cm_mez: { behind: 0.4, box: 0.5, third: 0.6 },
  cm_play: { third: 0.3, box: 0.2 }, am: { box: 0.5, third: 0.4, behind: 0.2 }, am_play: { third: 0.3, box: 0.3 }, dm_box: { box: 0.4, third: 0.3 } };
  const o = {}; for (const [k, r] of Object.entries(R)) { const st = k.startsWith("st");
    o[k] = { run: { ...r, box: Math.min(1, st ? (cap ? Math.min(r.box, cap) : r.box * sk) : r.box * mk) } }; } return o; };
export default {
  field: FIELD, runner: process.env.RUNNER === "play" ? undefined : "sim",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 76), chunk: 19, base: "base",
  arms: process.env.ARMS === "5" ? [
    { name: "base" },
    { name: "R1", roleOv: RO(0.6, 0, 1.4) },
    { name: "R1+role.04", roleOv: RO(0.6, 0, 1.4), cfg: { roleRecvW: 0.04 } },
    { name: "R1+role0", roleOv: RO(0.6, 0, 1.4), cfg: { roleRecvW: 0 } },
    { name: "R1+role.04+recv.03", roleOv: RO(0.6, 0, 1.4), cfg: { roleRecvW: 0.04, passRecvW: 0.03 } },
  ] : process.env.ARMS === "4" ? [
    { name: "base" },
    { name: "P1", roleOv: RO(0.6, 0, 1.4), mt: { cntLast: 25, tuckIn: 1, lateRun: 1.6 } },
    { name: "P1+lane.6", roleOv: RO(0.6, 0, 1.4), cfg: { shotLaneK: 0.6 }, mt: { cntLast: 25, tuckIn: 1, lateRun: 1.6 } },
    { name: "P1+lane.8", roleOv: RO(0.6, 0, 1.4), cfg: { shotLaneK: 0.8 }, mt: { cntLast: 25, tuckIn: 1, lateRun: 1.6 } },
    { name: "P1+lane.6+xhalf", roleOv: RO(0.6, 0, 1.4), cfg: { shotLaneK: 0.6, crossCalA: -0.4, crossCalB: 0.75 }, mt: { cntLast: 25, tuckIn: 1, lateRun: 1.6 } },
  ] : process.env.ARMS === "3" ? [
    { name: "base" },
    { name: "D6", roleOv: RO(0, 0.45, 1) },                       // diagnostic: strikers' box runs capped at 0.45
    { name: "R1", roleOv: RO(0.6, 0, 1.4) },                      // strikers' box x0.6, central midfielders' x1.4
    { name: "R1+pick", roleOv: RO(0.6, 0, 1.4), mt: { runPick: 1, runPickPow: 2 } },
    { name: "R1+combo", roleOv: RO(0.6, 0, 1.4), cfg: XCAL, mt: { cntLast: 25, tuckIn: 1, lateRun: 1.6 } },
  ] : process.env.ARMS === "2" ? [
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
