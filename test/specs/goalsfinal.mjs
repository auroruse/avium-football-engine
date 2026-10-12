// THE GOAL ECONOMY, 12 October 2026: the check. The app's own Sim All (test/lab.mjs runner "sim": the managers and the
// injuries in), before that night's changes (every one of them set back in `before`) and as shipped, for a league's
// scorers over whole seasons. What was found and changed, from eight rounds of test/specs/anatomy.mjs-style arms (the
// anatomy instruments: lab.mjs with __anat), is in the comments at each constant: the box ball attacked in the air
// (CFG.boxBallK), the header (headSigma, headV, headAim, headXg), the keeper's reach standing (gkSetReach), open-play
// accuracy (shotNoiseOpen, shotElevOpen), blocks (blockReach), the shooter's reads of a keeper filling the goal
// (gkFillK) and of a body in the way (MT.shotBlockK), the stride ahead priced by a packed goal (aheadShut), deflections
// in a defender's own area (deflectPhys) and the real game's own-goal rule (ogReal).
// Sim All, 76 fixtures a club: League One 3.03 -> 2.71 goals a match, League Two 2.96 -> 2.65, the top nations 2.91 ->
// 2.69, the Elvesterian Premier League 2.48 -> 2.27; a club's top scorer 22.2 -> 19.9 a 38-game season in League One.
//   FIX_FIELD=nl1 | nl2 | epl | nt   MINI_N fixtures a side.
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
