// SPREADING THE CHANCES, 12 October 2026 (the user: a club's top scorer took 38-40% of its goals against a real ~25%,
// Peshlakai two-thirds of Sheffield's; "research the gaps between the engine and real football"). The app's own Sim All
// (test/lab.mjs runner "sim") with the anatomy on (lab.mjs anatomyOf); read with a reader over AN/G rows.
//   FIX_FIELD=nl1 | nl2 | epl | nt   MINI_N fixtures a side (38 a season).   RUNNER=play for the lab's watched match.
//
// What was found, League One, 1,520 fixtures an arm (real figures: Opta / Understat, 880 club-seasons 2015-24):
//   a club's top scorer 39.3% of its goals (real 25.6%), its top shooter 31.8% of its shots (real 17.4%); strikers took
//   51% of shots and 62% of goals (real centre-forwards ~43% of goals, midfielders ~30, defenders ~11).
//   The cause is who gets into the box: with the ball wide a side's best box-runner went to the near post and made the
//   run in, and the strikers had the highest weight -- 45% of all box runs. Taking the strikers off their last line
//   altogether (diagnostic) moved their share of goals 63% -> 35%; capping their box runs alone 63% -> 49%; changing
//   where they stand without the runs, nothing. Shipped: mind/roles.ts box weights (strikers 0.6x, central midfield 1.4x)
//   and CFG.roleRecvW 0.12 -> 0.04: top scorer 39.3% -> 35.1%, top two 63% -> 58%, strikers' goals 62% -> 56%,
//   midfielders' 30% -> 35% of goals by sheet position, goals a match 2.72 -> 2.73.
//   Measured and dropped (no effect on the share, or a worse side effect): an honest cross belief (crosses believed
//   0.67, kept 0.40; recalibrated, wide men crossed 60% less), ending a counter's limits 25 m out, wingers tucking in
//   with the ball central, midfielders' late runs, rotating the box spots, drawing the runner by lottery, closing down
//   crossers, glanced defensive headers and physical deflections beyond the area (corners stayed at 2.6-2.7 a match).
//   Ready, not shipped: shotLaneK 1.1 -> 0.65 (from 16.5-25 m through a body or two the shooter believed 3.2% and scored
//   5.7%), which takes shots from outside the area 18.7% -> 26.4% (real 33-37%) and goals to 2.60; with handP 0.0085
//   and MT.boxContactFoul 0.2 penalties stay at 0.19 a match and goals 2.66. It moves the recorded xG, so the ratings
//   harness (test/ratings.mjs) has to be re-derived with it.
globalThis.__anat = true;
const F = process.env.FIX_FIELD || "nl1";
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two", epl: "Elvesterian Premier League", nt: "Avium International" }[F];
export default {
  field: FIELD, runner: process.env.RUNNER === "play" ? undefined : "sim",
  clubs: F === "nt" ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 76), chunk: 19, base: "base",
  arms: [
    { name: "base" },
    { name: "longshots", cfg: { shotLaneK: 0.65, handP: 0.0085 }, mt: { boxContactFoul: 0.2 } },
  ],
};
