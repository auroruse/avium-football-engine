// THE 15 OCTOBER 2026 PASS (the user: balls run out "with the ball fully in their control", "defenders will slowly back
// towards the ball's destination instead of just intercepting it", passes "behind the receiver"): the lab's own match loop
// (test/lab.mjs play, which books passes by kind) on the engine now and on the last commit's (test/engine-head.mjs, built
// from it by git archive and test/rebuild.sh; never commit it), the same League One fixtures, so each metric is paired.
//   LAB_SPEC=defend.mjs, MINI_N fixtures a club.
export default {
  field: "Nichirin League One", clubs: "all",
  n: +(process.env.MINI_N || 150), chunk: 25, base: "now",
  arms: [{ name: "now" }, { name: "before", bundle: "test/engine-head.mjs" }],
};
