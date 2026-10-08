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
  compactLen: 0.35,    // share of that a side set to sit deepest (plan.compact 1) takes off the distance between its lines...
  compactWide: 0.15,   // ...and off its width
  blockWide: 0.74,     // share of the formation's own width a defending line keeps
  blockSlide: 0.45,    // share of the ball's distance from the middle the block slides toward it
  lineSlew: 5.2,       // m/s the back line moves at
  slotSlew: 6.5,       // m/s a man's spot in the block may move across
  markPull: 0.55,      // how far a zonal defender leaves his spot for the man in it (0 spot, 1 man)
  markGoalSide: 1.4,   // m goal-side of his man a marker stands
  markBallSide: 0.35,  // share of a metre per metre of separation he leans toward the ball
  // ---- the box -------------------------------------------------------------------------------------
  boxLine: 12.5,       // m from goal a back line holds with the ball central outside the box (first cut)
  // TRIED AND DROPPED (7 Oct 2026, 140 fixtures an arm against an even mix of all fourteen styles): a deep block
  // (plan.compact) holding its line 3.5 m higher, at the edge of its box, and squeezing a dribbler from 30 m out
  // instead of 24. Every deep style got worse: Park the Bus -0.26 xG a match, Catenaccio and Cholismo -0.16, Zona
  // Mista -0.07. The chances a deep block gives up are shots from twelve metres by a man who carried it there,
  // and neither rule stopped the carry. Nor did a third: its presser standing his ground from 30 m out instead of
  // 25 (tightD / tightFull, 5 and 10 m further out) -- shots against rose, their distance did not move.
  crossLine: 9,        // ...and drops to with the ball wide in the last thirty metres: the penalty spot, not the six-yard box
  boxWideY: 20.2,      // m off the middle the ball is wide (the box's own half-width)
  crossD: 30,          // m from goal inside which a wide ball is a cross coming
  crossFrac: 0.5,      // ...where, with the ball out there, the line drops to at most this share of the ball's distance from goal...
  crossCompact: 0.25,  // ...less this share again for the deepest block (plan.compact 1)...
  crowdLen: 0.4,       // ...whose midfield also closes this share of the gap to its line, into the box
  boxHoldGap: 1.5,     // m the line always stays goal-side of the ball
  tightD: 25,          // m from goal at which the man on the ball's marker starts to stand his ground...
  tightFull: 15,       // ...and by which he no longer backs off at all
  showOutD: 30,        // m from our goal inside which a deep block (plan.compact) shows a man on the ball out wide
  boxDefD: 32,         // m from our goal: with the ball inside this, the men in and around our box are marked
  boxDangerD: 26,      // m from our goal an attacker has to be inside to be one of them...
  boxDangerY: 24,      // ...and this close to the middle
  boxMarkMax: 16,      // m a defender will come across to pick one up
  boxMarkGS: 0.9,      // m goal-side of his man a box marker stands...
  boxMarkBall: 1.0,    // ...and this far toward the ball, between the man and the passer
  boxMarkHold: 4,      // slices a box pairing holds before it is solved again
  sqzD: 24,            // m from our goal inside which a dribbler is closed by two...
  sqzY: 22,            // ...while he is this central
  sqzStand: 1.4,       // m goal-side of him the second man closes...
  sqzSide: 1.8,        // ...and this far across, on the side the first is not
  sqzReach: 16,        // m the second man will come to do it
  contestD: 26,        // m from our goal inside which a marker goes for a high ball at his man
  // ---- the press -------------------------------------------------------------------------------
  pressStand: 1.8,     // m off the man the first presser settles at, goal-side
  pressShade: 1.4,     // m he leans across to sit in the lane he is shutting
  pressKeep: 1.30,     // a new first presser has to be this much quicker to take the job over
  coverBack: 7.5,      // m behind the presser the cover man sits, on the line to goal
  coverR: 5,           // m from the carrier a team-mate, level or goal-side, covers the man on the ball: he stops delaying
  // TRIED AND DROPPED together (7 Oct 2026, 240 fixtures a style against the even mix, paired with the run before):
  // a man the carrier has run past giving up the first-presser job to the next man in front; the first brain's press
  // fatigue (CFG.loeStamLo) on the counter-press, the presser's leash and the jumpers; possWon -1 keeping only what it
  // won in its own half; a deep block's spare men standing on the shot line; and each extra defender within airR adding
  // 0.10 to an aerial duel. Every one fired in traces; none moved the result. Gegenpressing's high regains 13.1 -> 13.4,
  // Park the Bus's xG conceded 1.64 -> 1.65, the field's xG, regains and tackles unchanged; every style moved within noise.
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
  relRun: 0.3,         // a man whose role runs in behind at least this readily is a target over the top...
  relShoulder: 3.5,    // ...standing no more than this far goal-side of their last line...
  relRoom: 16,         // ...with at least this much grass between that line and their goal (m)
  relMaxD: 65,         // m: the longest ball in behind a man will strike
  crossPress: 1.2,     // pressure on a crosser above which a crossing side plays whatever gets him out (plan.crossFirst)
  takeOnD: 40,         // m from goal inside which a side built on its dribblers takes men on (plan.takeOn)...
  takeOnSkill: 0.55,   // ...the dribbling (mind/duel.ts dribSkill) a man needs before he is held to it...
  takeOnGo: 0.2,       // ...and how much more readily he goes at a man
  thruTo: 60,          // m from goal inside which a side playing in behind (plan.thruFirst) keeps it going forward...
  thruLast: 18,        // ...short of this (in the area it is a different game)...
  thruFwd: 8,          // ...when a ball at least this far forward into a runner's path...
  thruOk: 0.4,         // ...is on at least this often
  longBuildTo: 35,     // m from our goal a side that builds long hits it long from (plan.longBuild)...
  longBuildD: 28,      // ...no pass shorter than this...
  longBuildFwd: 12,    // ...or less than this far forward...
  longBuildPress: 1.2, // ...unless he is closed down this hard
  fwdOnlyTo: 75,       // m from our goal a direct side plays only forward to (plan.fwdOnly)...
  fwdOnlyMin: 4,       // ...at least this far forward...
  fwdOnlyPress: 1.0,   // ...unless closed down this hard
  earlyT: 32,          // slices after winning it that a breaking side plays the early ball (plan.earlyBall)...
  earlyLast: 25,       // ...until the ball is this close to their goal line...
  earlyFwd: 10,        // ...to a man at least this far ahead...
  earlyOk: 0.45,       // ...when it is at least this likely to reach him
  simplePress: 0.6,    // pressure on the spot he would carry it to above which a side told to keep it simple does not
  keepUpTo: 70,        // m from his own goal: past this the plan's minOk no longer holds a forward ball back
  loiterBack: 2,       // m/s toward their own goal faster than which a man of theirs behind the ball is going home, not loitering
  cntBack: 4,          // a counter is on when this few of theirs are back: goal-side of the ball...
  cntBackD: 45,        // ...and within this many metres of their own goal
  cntShortX: 2.5,      // ...and the break's window (counterWin) is this many times as long while they are
  cntGo: 15,           // m forward the ball has to go, breaking with them short at the back...
  cntGoOk: 0.5,        // ...when one that far is on at least this often
  cntRunCos: 0.7,      // ...and a man with it runs at them: a carry within ~45 degrees of straight at their goal...
  cntRunOk: 0.6,       // ...that he keeps the ball on this often rules out the carries that go anywhere else...
  cntRunFwd: 5,        // ...and the passes that do not go this far forward
  cntT: 14,            // slices after winning it that a breaking side's first ball must go forward...
  cntFwdMin: 6,        // ...at least this far (m)...
  cntPress: 1.4,       // ...unless he is being closed down harder than this
  cntSupport: 9,       // m short of their last line the men who break in support of the runners get to
  cntSurge: 18,        // m further than usual they go to get there (less for the more defensive roles)
  clrDepth: 32,        // m from his own goal inside which a side that clears its lines does...
  clrPress: 0.9,       // ...once he is being closed down this hard...
  clrFwd: 12,          // ...and a pass has to go this far forward to count as getting it out
  switchW: 0.008,      // what the room a switch finds is worth (CFG.switchW 0.02 was the first brain's)
  blockK: 1.0,         // how much of blockRisk (a man in the way of the ball's first metres) he believes
  // ---- duels -----------------------------------------------------------------------------------
  tkBar: 0.62,         // the chance of winning it a defender wants before he goes in, all else even
  cynBase: 0.035,      // a slice's chance of the foul on purpose to stop a break, before temperament
  contactFoul: 0.05,   // a slice's chance a man tight on the carrier holds, pushes or climbs on him
  sepR: 3.2,           // m; team-mates closer than this ease apart (the shape does the real spacing)
  sepW: 0.25,
};
