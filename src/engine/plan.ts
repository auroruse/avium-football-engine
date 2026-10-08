// THE PLAN. Everything about how a side plays that is not a number on its instruction sheet: how many men
// stay behind the ball, whether there is a libero, how much of the block marks men rather than space, the
// moves it has drilled, where it wants the ball to go, how it chases or protects a result, and how many it
// leaves up when it defends a corner. The brain reads the plan and never a style's name, so a style is data,
// and a manager can change any part of it in the middle of a match.
//
// mePlanOf (tactics.ts) builds the plan for a style; meInit gives every side one unless it arrives with
// its own (s.plan[side]).
import { ME_CHASE, ME_PAT_MAP } from "./config";
import { FAM, FAMPLAN } from "./mind/roles";

// How readily each family reaches for each drilled move (mind/team.ts, mindPatterns).
//   third man (possession styles): a ball into a man between the lines with his back to goal, a third man
//     going in behind for the lay-off and the ball through.
//   overlap and cross (wide styles): the full-back round the winger on the ball, the box filled for the cross.
//   switch (wide and possession): one flank crowded, the far side free: the ball goes across.
//   over the top (counter and block styles, and any side breaking): the forward goes the moment it is won.
const PAT_W = {
  thirdman: { pos: 1, vert: 1, flair: 1, zona: 0.6, bal: 0.4, press: 0.5 },
  overlap:  { wide: 1, press: 0.6, bal: 0.5, direct: 0.4, counter: 0.3, flair: 0.4 },
  switch:   { wide: 1, pos: 0.8, bal: 0.5, vert: 0.5, zona: 0.4 },
  overtop:  { counter: 1, block: 0.9, catenaccio: 0.9, bus: 0.8, direct: 0.7, press: 0.6, vert: 0.5, bal: 0.4 },
};

// The plan a style played before the rebuild, by its role family. Kept as the base every rebuilt style starts
// from (tactics.ts, meResolve) and for any id the rebuild does not define.
export function mePlanLegacy(style) {
  const id = style || "balanced", fam = FAM[id] || "bal", fp = FAMPLAN[fam];
  return {
    style: id, fam,
    restN: fp.restN, libero: fp.libero, manMark: fp.manMark,
    pats: { thirdman: PAT_W.thirdman[fam] ?? 0, overlap: PAT_W.overlap[fam] ?? 0,
            switch: PAT_W.switch[fam] ?? 0, overtop: PAT_W.overtop[fam] ?? 0 },
    // The second ball (direct): a long ball at a big man sends the midfield to where it will drop.
    secondBall: fam === "direct",
    zones: ME_PAT_MAP[id] || null,
    chase: ME_CHASE[id] || ME_CHASE.balanced,
    cornerUp: fam === "counter" || fam === "catenaccio" || fam === "block" ? 2 : 1,
    // Men left up when the side does not have the ball (mind/team.ts, THE OUTLET). None, until a style asks.
    outlet: 0,
  };
}
