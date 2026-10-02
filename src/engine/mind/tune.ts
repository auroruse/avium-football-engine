// THE SECOND BRAIN'S NUMBERS. Everything the new player and team brain reads lives here rather than in
// CFG, so the first brain's calibration stays exactly where it is while this one is built beside it.
// Units are stated per line. Anything marked "first cut" has not been measured yet.
export const MT = {
  // ---- the senses ------------------------------------------------------------------------------
  fovHalf: 1.65,       // rad either side of where his head points that he takes in (about 95 degrees)
  viewR: 75,           // m; past this a man is a dot he does not read
  feelR: 2.2,          // m; a man this close is felt and heard whichever way he is looking
  hearR: 6.5,          // m; behind him and nearer than this, he may still sense him...
  hearP: 0.30,         // ...with this chance a slice, scaled by awareness
  scanLo: 0.14,        // shoulder checks a second, the least aware player on the pitch (first cut)
  scanHi: 0.58,        // ...and the most aware (elite midfielders measure around 0.6-0.8)
  scanRecv: 1.9,       // he checks this much more often when the ball may be coming to him
  scanOnBall: 0.40,    // ...and this much less with it at his feet, where his eyes are on the ball
  scanTicks: 1,        // a shoulder check lasts one slice, and in it he is not watching the ball
  headMax: 1.75,       // rad his head turns off his body before the body has to come round too
  posNoise: 0.032,     // m of misjudged position per metre away, for the least aware player
  velNoise: 0.10,      // share of a man's velocity he misjudges, least aware
  memFade: 1.4,        // s of straight-line guessing he trusts on a man he has stopped watching
  visMemLo: 2.5,       // s he still counts a team-mate he has not seen as an option, least aware...
  visMemHi: 7.0,       // ...and most aware
  visRangeLo: 50,      // m he looks for a pass at all, least aware (seeing the hard ball is priced in the pass)...
  visRangeHi: 72,      // ...and most aware
  callLo: 0.10,        // chance a slice that a team-mate shouts "man on" for him, an undrilled side...
  callDrill: 0.45,     // ...plus this much for a perfectly drilled one
  callR: 5.5,          // m; the shout is for a man this close
  // ---- the body --------------------------------------------------------------------------------
  turnStill: 11.0,     // rad/s his body turns standing
  turnRun: 2.6,        // rad/s at a full sprint
  turnRunV: 8.0,       // m/s that counts as a full sprint for the turn
  runFaceV: 3.0,       // m/s above which his body faces where he is running
  openBody: 0.55,      // share of the angle toward their goal he opens up when he expects the ball
  openMax: 1.25,       // rad; most he opens up
  // ---- effort ----------------------------------------------------------------------------------
  effWalk: 0.30, effJog: 0.55, effRun: 0.78, effSprint: 1.0,
  easeD: 2.6,          // m; inside this he settles into his spot instead of running through it
  easeMin: 0.22,       // the least of his pace he keeps while settling
  // ---- phases ----------------------------------------------------------------------------------
  buildTo: 35,         // m from own goal: below this the ball is in build-up
  finalFrom: 68,       // m from own goal: past this it is the final third
  phaseHold: 3,        // slices a phase must hold before a new one replaces it
  // ---- the shape in possession -----------------------------------------------------------------
  laneHalf: 19.5,      // m from a touchline: the middle of the half-space
  laneWide0: 4.5,      // m from a touchline the wide lane sits at with width 0; width moves it
  laneWideStep: 1.6,   // m per width step
  ballShift: 0.22,     // share of the ball's distance from the middle the whole shape slides toward it
  attackOff: 1.0,      // m inside the offside line a man on the last line stands
  betweenMin: 6,       // m ahead of the ball the space between the lines starts, at least
  supportAhead: 1.5,   // m: a support man stands level with the ball, a step ahead, off to the side
  occLane: 7.5,        // m; two men in one lane closer than this along it are standing on each other
  occDepth: 7.0,       // m...
  refineR: 4.5,        // m he will drift off his cell to find a lane the passer can see
  refineEvery: 3,      // slices between re-solving it
  restGapBuild: 9,     // m behind the ball the rest defence sits, in build-up...
  restGapProg: 17,     // ...in progression...
  restGapFinal: 24,    // ...and in the final third
  restFloor: 9,        // m from own goal the rest defence never drops below while attacking
  restCeil: 58,        // m from own goal it never pushes past
  drillNoise: 3.0,     // m of slack in where an undrilled man takes up his cell
  // ---- the shape out of possession -------------------------------------------------------------
  blockLen0: 24,       // m from the back line to the front line, a settled mid block
  blockLenPress: 30,   // m in a high press, which has to stretch
  blockLenLow: 18,     // m in a low block
  blockWide: 0.74,     // share of the formation's own width a defending line keeps
  blockSlide: 0.45,    // share of the ball's distance from the middle the block slides toward it
  lineSlew: 5.2,       // m/s the back line moves at
  slotSlew: 6.5,       // m/s a man's spot in the block may move across
  markPull: 0.55,      // how far a zonal defender leaves his spot for the man in it (0 spot, 1 man)
  markGoalSide: 1.4,   // m goal-side of his man a marker stands
  markBallSide: 0.35,  // share of a metre per metre of separation he leans toward the ball
  // ---- the press -------------------------------------------------------------------------------
  pressStand: 1.8,     // m off the man the first presser settles at, goal-side
  pressShade: 1.4,     // m he leans across to sit in the lane he is shutting
  pressKeep: 1.30,     // a new first presser has to be this much quicker to take the job over
  coverBack: 7.5,      // m behind the presser the cover man sits, on the line to goal
  cpRange: 14,         // m; a counter-presser is one this close to the ball when it goes
  cpMax: 3,            // most men who counter-press
  shadowFrac: 0.40,    // where along a passing lane a screening man stands, from the passer
  shadowMaxD: 30,      // m; lanes longer than this are not worth a screen
  trigTouch: 1.25,     // m; a ball this far off the carrier's foot is a heavy touch, and a trigger
  trigEdge: 9,         // m from a touchline the carrier is trapped
  // ---- runs ------------------------------------------------------------------------------------
  runEvery: 2,         // slices between looking for a run
  runCool: 10,         // slices before the same man runs again
  runMaxBase: 2,       // men allowed on runs at once, before creativity
  runHoldMax: 8,       // slices a runner waits on the shoulder for the passer to look up
  runBehindL: 13,      // m beyond the line a run in behind goes
  runSpace: 7,         // m of room behind the line his run needs
  // ---- decisions -------------------------------------------------------------------------------
  hystAbs: 0.006,      // a new choice must beat the one he is holding by this much...
  hystRel: 0.18,       // ...or by this share of it, whichever is larger
  lookK: 0.55,         // how much of the next ball's value the best reader adds to a pass (first cut)
  lookTop: 4,          // passes he looks two moves ahead from
  carryDirs: 7,        // headings he considers carrying it on
  patW: 0.012,         // what a drilled move's ball is worth on top of its own price (first cut)
  switchW: 0.008,      // what the room a switch finds is worth (CFG.switchW 0.02 was the first brain's)
  // ---- duels -----------------------------------------------------------------------------------
  tkBar: 0.62,         // the chance of winning it a defender wants before he goes in, all else even
  cynBase: 0.035,      // a slice's chance of the foul on purpose to stop a break, before temperament
  contactFoul: 0.05,   // a slice's chance a man tight on the carrier holds, pushes or climbs on him
  sepR: 3.2,           // m; team-mates closer than this ease apart (the shape does the real spacing)
  sepW: 0.25,
};
