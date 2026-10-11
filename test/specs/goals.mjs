// WHERE THE GOALS WENT (user, 12 October 2026: "why the hell are goals so inflated in quicksims?", and top scorers past a
// goal a game). The same fixtures on the engine at twelve points since 30 September, every build reading today's squads
// and ratings off src/ at run time, each fixture played the way Sim All plays one (lab.mjs simMatch: the app's own
// simPositionalMatch, managers and injuries in, no home side). Goals a match by build, and how much of a club's scoring
// its top man takes (each row's G).
//   FIX_FIELD=nl1 | nl2   MINI_N fixtures a club.   The builds are test/engine-<commit>.mjs, made by each commit's own
//   test/rebuild.sh.
const BUILDS = ["9ced4d9", "786d8cf", "452ab06", "9a68210", "c93917a", "878a940", "ed7a1d6", "8575545", "b6964dc", "94b9d3e",
                "1c02275", "4de4e2c"];
const FIELD = { nl1: "Nichirin League One", nl2: "Nichirin League Two" }[process.env.FIX_FIELD || "nl1"];
export default {
  field: FIELD, clubs: "all", n: +(process.env.MINI_N || 50), chunk: 25, base: "4de4e2c", runner: "sim",
  arms: BUILDS.map(b => ({ name: b, bundle: "test/engine-" + b + ".mjs" })),
};
