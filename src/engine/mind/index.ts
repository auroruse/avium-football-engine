// The second brain: the player and team AI built beside the first, behind s.brain === 2.
export { MT } from "./tune";
export { ROLES, ROLE_NAME, FAM, FAMPLAN, mindRoles } from "./roles";
export { mindSense, mindSenseInit, mindLens, mindSeen, mindAware, mindIx } from "./perceive";
export { mindInit, mindTick, mindOnPass, mindDead, mindSetPiece } from "./team";
export { mindDecide, mindChoose, mindFirstTime, mindTouchAngle } from "./decide";
export { mindCarrier, mindDuel, mindJockey, dribSkill, ctrlSkill, tackSkill } from "./duel";
