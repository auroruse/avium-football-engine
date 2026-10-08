// WHERE A MAN PLAYS, as the squad tools judge it: each position on a grid of line and side, and how far a man who plays
// one position is from a slot that asks for another. App.tsx re-slots lineups by it, and the registry server fills a
// vacated starting place by it, so the two always agree.

// Natural-position model: [line, side] -- line GK->DEF->WB->DM->MID->AM->FWD, side left/centre/right.
// Side mismatches cost slightly more than line ones: a left back at right back is a worse ask
// than a left back pushed to left midfield.
export const POS_ROLE = { GK:[0,0], LB:[1,-1], CB:[1,0], RB:[1,1], LWB:[1.5,-1], RWB:[1.5,1], DM:[2,0], CM:[3,0], AM:[4,0], LM:[3,-1], RM:[3,1], LW:[4,-1], RW:[4,1], ST:[5,0] };
export function posFitCost(a, b) {
  if ((a === "GK") !== (b === "GK")) return 1000;
  const A = POS_ROLE[a] || POS_ROLE.CM, B = POS_ROLE[b] || POS_ROLE.CM;
  return Math.abs(A[0] - B[0]) + 1.2 * Math.abs(A[1] - B[1]);
}

// A squad's slot positions: the formation's eleven (sposFor, from the engine's formations), then the bench. An
// eleven-man national bench mirrors the XI slot for slot; a club's five-man bench is GK, CB, CM, CM, ST.
export const slotLabels = (sposFor, formation, n) => {
  const xi = sposFor(String(formation || "4-3-3").trim());
  return [...xi, ...(n > 16 ? xi : ["GK", "CB", "CM", "CM", "ST"])].slice(0, n);
};
