// THE 15 OCTOBER 2026 RECEIVER (the passers rework: "passing behind the receiver"): the man a ground pass is played to
// solves where he meets it on the law he moves by (pass.ts meMeetAir, rolling), instead of a reach model that credited
// him 2.6 m in any direction inside 210 ms; and a man standing exactly on his target is arrived, which ends the NaN that
// froze golden's fixture 23 from its third minute. The lab's own match loop (test/lab.mjs play) on the engine now and on
// the last commit's (test/engine-head.mjs, built from it by git archive and test/rebuild.sh; never commit it), the same
// League One fixtures, so each metric is paired.
//   LAB_SPEC=receive.mjs, MINI_N fixtures a club.
export default {
  field: "Nichirin League One", clubs: "all",
  n: +(process.env.MINI_N || 150), chunk: 25, base: "now",
  arms: [{ name: "now" }, { name: "before", bundle: "test/engine-head.mjs" }],
};
