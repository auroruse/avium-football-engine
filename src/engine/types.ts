// Units, carried in the type. Three of the worst bugs in this engine were the same mistake: a number
// in one frame of reference assigned to a variable expecting another. An offside line returned in
// direction-multiplied space and compared against a world x; a depth measured from a side's own goal
// used as a pitch coordinate; an attacking weight on a 0-42 scale treated as 0-1. These aliases cost
// nothing at runtime and make those assignments say what they mean.
/** Metres along the pitch from the left touchline's goal, 0..105. Absolute, not per-side. */
export type WorldX = number;
/** Metres across the pitch, 0..68. Absolute. */
export type WorldY = number;
/** Metres from THIS side's own goal, along the way it is kicking. 0 at own line, 105 at theirs. */
export type Depth = number;
/** -1 or +1: the direction this side attacks along WorldX. */
export type Dir = -1 | 1;
export type Side = "home" | "away";
/** 0..1. Probability this possession ends in a goal from here, normalised by CFG.valMax. */
export type Danger = number;
/** -1..1. Positive means this side controls the space. */
export type Control = number;

/** What the coordinator has told a player to do. Exactly one per outfielder, every slice. */
export type Duty = "gk" | "press" | "cover" | "mark" | "screen" | "intercept" | "hold"
                 | "width" | "runner" | "support";
export type RunKind = "behind" | "overlap" | "third" | null;
export type Phase = "atk" | "tr_atk" | "def" | "tr_def";

/** The per-player state the engine keeps. Lives on the same objects the rest of the app already
 *  passes around, so cloneState keeps working untouched. */
export interface MePlayerState {
  x: WorldX; y: WorldY; vx: number; vy: number;
  _px?: WorldX; _py?: WorldY;      // position before this slice, for render interpolation
  _bd: Depth; _bw: WorldY;         // the formation slot he currently fills
  _bd0: Depth; _bw0: WorldY;       // the slot he naturally belongs to
  _tx?: WorldX; _ty?: WorldY;      // steering target
  _sx?: WorldX; _sy?: WorldY;      // last solved off-ball position, held between brain ticks
  _duty?: Duty; _mk?: number;      // job, and the opponent index it refers to
  _run?: RunKind; _runT?: number; _rx?: WorldX; _ry?: WorldY; _cool?: number;
  _closing?: boolean; _wasPress?: boolean;
  _att?: Record<string, number>;   // derived attributes, cached
}
