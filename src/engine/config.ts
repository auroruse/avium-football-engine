// Every tuning number the match engine has, in one place and mutable at runtime, so a sweep or a
// tactical preset is DATA rather than an edit to source. Nothing here changes behaviour on its own;
// each field is read live by the module named in its comment.
// The clock. A slice is a quarter of a second; everything downstream is stated in these.
export const ME_HZ = 4, ME_DT = 1 / ME_HZ, ME_TPM = 60 * ME_HZ;

// How many minutes of actual football a match is, and the 1-90 clock painted over it. A positional
// engine at this density produces far more football per minute than ninety real minutes' worth --
// so rather than tune the life out of it to hit a per-90 scorecard, a match IS shorter and the clock
// runs fast over it, which is how every football game you have played does it.
export const ME_SIM_MIN = 18;
// Restart delays are written in real seconds -- nineteen for a throw, thirty-four for a corner -- and
// they have to shrink with a compressed match or the ball is dead for most of it. Scaled by match
// length alone the ball was in play 90% of the time, which is its own kind of wrong; this is set so
// it lands near the real 63%.
// How much of a restart's nominal budget is actually spent. This is the ONLY dial that sets how
// much of the match is dead, and it was being calibrated against the wrong yardstick: restarts were
// timed so their DISPLAYED length looked right next to a real throw-in, but the 90-minute clock is a
// fiction laid over 18 simulated minutes. What has to be right is the SHARE -- a real match is dead
// for 30-40% of itself, and this one was dead for 17%, which is why ball in play read 83%.
export const ME_DEAD_SCALE = 0.75;

// ---- set pieces ------------------------------------------------------------------------------
// A restart takes as long as it takes: play resumes when the taker is over the ball and most of the
// rest are where they belong, with a hard cap so one man jogging in from the far corner can never
// hang the match. spMinT stops a restart being instant even when everybody happens to be in place.
export const SP = {
  spBehind: 0.9,        // how far behind the ball the taker sets himself, so he strikes through it
  spMinT: 6, spMaxT: 68,
  // How long the referee will wait, per restart. A penalty needs the box genuinely cleared and a
  // throw-in needs nobody; one number for both meant half of all penalties were taken on the
  // referee's patience running out rather than on anyone being ready.
  spMaxTBy: { penalty: 140, corner: 86, goalkick: 74, freekick: 68, throw: 52 },
  // A free kick is played quickly when a team-mate is already this far beyond the ball with this
  // much daylight around him. Both in metres, and both deliberately generous: if it is on, take it.
  spQuickAhead: 12, spQuickRoom: 9,
  // WHAT THE RIGHT MAN IS WORTH IN METRES OF WALKING. Set-piece marks were filled purely by who
  // stood nearest, so nobody was ever picked for the job -- the near post at a corner went to a
  // full-back if he happened to be closest. A full attribute advantage now buys 12 m of travel,
  // enough that your best header of a ball attacks the near post and your best striker of one
  // takes the edge, without anybody crossing the pitch for a spot somebody else can fill.
  spRoleW: 12,
  // How far a step of the defensive-line instruction moves the block at a free kick, and how far
  // a keeper has to be out of position before the goal counts as open. gkBeatX is along the pitch
  // (behind him is behind him), gkBeatY across it.
  spLineStep: 2.5, gkBeatX: 8, gkBeatY: 10, clearPress: 1.6,
  // How far onto the line between his man and our goal a marker is drawn off his block slot. 0
  // is the old behaviour -- goal-side on x and anywhere at all across the pitch. 1 abandons the
  // block entirely for man-marking, which measured worse every time it was tried.
  markLine: 0.6,
  // How hard the delivery favours the best-placed man. The choice used to be an argmax, so every
  // corner of a match found the same player; this is the exponent on the same value, turning it
  // into a weighted draw. Higher is more predictable, 0 is a lottery. 0.22 keeps a man at the far
  // post several times likelier than one on the edge without making him certain.
  spAimSharp: 0.22,
  // ...and how far away the man he plays it to may be. A restart nobody can reach quickly is not a
  // quick restart, it is a long ball, and those are taken from a set position like everything else.
  spQuickTo: 30,
  spQuickRoomBy: { goalkick: 14, throw: 11, freekick: 9 },
  // FETCHING THE BALL. How many slices it takes to be brought back to the spot: a floor, plus a bit
  // per metre it has to travel, capped -- and capped again at the restart's own minT, because it has
  // to be on the spot before anybody may strike it. spFetchZ is how far off the ground it is carried.
  spFetchMin: 3, spFetchPerM: 0.45, spFetchMax: 14, spFetchZ: 0.5,
  // How far off his mark a man stands at a restart. Three routines per set piece is variety in the
  // SHAPE; this is variety within one, and it is what stops twenty-two men landing on coordinates.
  spJit: 1.0,
  // THE CELEBRATION. How long before they walk back, how far away a team-mate will come from, how
  // many of them, and how close they get. spCelebOut/In place the corner he runs to.
  spCelebT: 18, spCelebR: 30, spCelebN: 4, spCelebGap: 2.2, spCelebOut: 7, spCelebIn: 5,
  spCelebRun: 14,
  spTol: 2.6, spTakerTol: 0.7, spReadyFrac: 0.62,
  // A kickoff is the one restart where the WHOLE pitch has to be set -- twenty-two men back in their
  // own halves, some of them sixty metres away. Sharing the ordinary eight-second cap meant it timed
  // out long before they arrived and was taken with half the side still walking back.
  spKickoffMaxT: 210, spKickoffFrac: 0.95,
  // Only the men who MATTER to this restart have to be set. Waiting on all twenty-two meant a goal
  // kick took twelve seconds -- the far winger strolling back across the halfway line held up the
  // game. Everyone else keeps walking into position while play goes on, which is what you see.
  spNearBall: 32,
  // Inside this of his restart mark a man stops having momentum and simply walks onto it. The
  // ordinary steering filter only sheds 42% of his velocity per slice while he covers over a metre
  // in one, so against a 0.12 m mark he sailed straight past, turned, and sailed past again --
  // measured, the taker was near his spot but not settling on up to 48% of slices. That circling is
  // what a restart looked like: a man orbiting the ball instead of standing over it.
  spArrive: 1.5,
  // A struck restart has a RUN-UP. He sets himself back from the ball and off to one side, waits for
  // the box to fill, then runs at it and strikes it. Which side he stands depends on which foot he
  // kicks with, and that comes from where he plays: a man whose natural place is on the left of the
  // XI is left-footed. Central players are right-footed, as most footballers are.
  spRunup: 3.0, spRunupSide: 1.7, spRunTol: 0.60, spLeftOf: 4,
  spShootRange: 27,     // a free kick inside this is struck at goal rather than delivered
  spWall: 4, spWallDist: 9.15,
  // How far the defending side has to stand off the ball, per restart. Ten yards at a free kick and
  // a corner, two metres at a throw; a goal kick, a kickoff and a penalty each have their own rule
  // and are not in here. Enforced on the TARGETS, so they walk back rather than being teleported.
  spKeepOut: { freekick: 9.15, corner: 9.15, throw: 2 },
  spMaxBall: 45,        // how far a restart will be played
};
export const ME_MATCH_TICKS = ME_SIM_MIN * ME_TPM;
// Thirty minutes on the same scale the ninety uses, so extra time needs no second clock.
export const ME_ET_TICKS = Math.round(ME_MATCH_TICKS / 3);
export const meMinute = (tick) => Math.min(90, Math.floor(tick / ME_MATCH_TICKS * 90));

export const CFG = {
  // The worth of simply still having the ball afterwards. Without it a safe sideways pass scores near
  // zero and nobody ever recycles possession.
  keep: 0.030,
  // How much a ball is worth for the ground it gains, per metre. Without a real term here the safest
  // option is always to pass sideways, and since keeping the ball scores the same wherever it is, the
  // optimal policy is to recycle in your own third for ninety minutes -- which is exactly what the
  // engine did once midfield pressing was correctly switched off: 527 passes at 96% and no shots.
  // meVal is exponential, so fifteen metres of progress seventy metres from goal is worth 0.0026
  // while simply keeping the ball is worth 0.030 -- out there, recycling was TEN TIMES better than
  // going forward. Measured: 55% of all passes went backwards, teams finished a ten-second
  // possession further from goal than they started, and the ball reached the final third only by
  // turnover. Ground gained has to be worth something where the value surface is flat.
  // WHAT GROUND IS WORTH AGAINST SIMPLY KEEPING IT. The value surface is nearly flat through
  // midfield -- twelve metres of progress reads 0.007 on it while merely still having the ball is
  // worth keep, 0.030 -- so retention beat progression four to one before risk was even counted and
  // these two nudges are what argue the other way. At 0.0010 and 0.0030 they could not: the average
  // pass in this engine went 0.5 m BACKWARDS, 60% of passes were played backwards, and only 9.4% of
  // moves starting in a side's own third ever reached the final third against a real fifth.
  // Doubled, with room half again: measured over 40 matches a cell, progression from deep goes to
  // 15.7%, the average pass to +4.4 m and backward passes to 44%. It is not free -- completion falls
  // from 81.9% to 77.3%, which is the honest price of attempting the harder ball, and it is the
  // reason this is a pair of numbers rather than one: pull alone moves direction without moving
  // progression, and room alone moves neither far enough.
  fwdPull: 0.0020,
  // The pass length a side is looking for, and how far each step of the passing instruction moves
  // it. passWantW is what a metre away from that length costs in the pass score -- the whole of the
  // instruction's authority now, and deliberately a preference rather than a veto.
  // passBand is the free half-width around the preferred length -- inside it every ball costs
  // nothing, outside it the charge starts. loftD/loftDir are the ground-to-air crossover and
  // how far a notch of directness moves it. Both sweepable; see meDecide.
  // passWantW was 0.0006 and could not bite at all: mean pass length ran 17.6-20.2 m across all
  // fourteen styles and Route One sat a metre from Tiki-Taka. Swept at 0.0040 and 0.0025 with the
  // band in place -- mean pass length from the shortest style to the longest, then the lofted share,
  // then the blocked spread and goals a match:
  //   0.0040   12.7 -> 23.5 m   13% -> 62%   spread 0.445   goals 2.85
  //   0.0025   14.1 -> 22.6 m   16% -> 56%   spread 0.452   goals 2.77
  // Real football runs about 15 m for a short side to 22 for a direct one, so 0.0025 is the honest
  // match; it also recovers Control Possession, which 0.0040 left toothless at 1.03 goals and 7.3
  // shots a match. The two settings are indistinguishable on spread.
  passWant: 16, passWantStep: 4, passWantW: 0.0025,
  passBand: 6, loftD: 26, loftDir: 3,
  // The range he is looking to shoot from, and how far each step of chance creation moves it.
  // shotBand is the free zone beyond the preferred range before distance starts costing him, and it
  // is ZERO because the band was the wrong idea here. A threshold only works if it sits inside the
  // distribution it is filtering: mean shot distance is about 12.5 m, so shotWant 14 plus a band of
  // 3 put the neutral cutoff at 17 and the term was inactive for nine shots in ten. Swept 3 / 1.5 /
  // 0, the gap between Work Ball Into Box and Shoot On Sight ran 0.79 / 1.34 / 1.83 m and the share
  // of shots from beyond 16 m went 10-20% / 9-25% / 9-34%, with goals a match flat at 2.86 / 2.73 /
  // 2.88. Kept as a named zero rather than deleted: if the shot distribution ever moves, this is the
  // knob that has to move with it.
  shotWant: 14, shotWantStep: 5, shotWantW: 0.004, shotBand: 0,
  // Extra touches per step of the dribbling instruction, before he has to release it.
  // Halved. dribbling turned out to account for ~70% of the entire territorial difference between
  // playstyles -- zeroing it collapsed the field-position spread from 26.4 m to 7.6 m and every style
  // landed between 36 and 44 m up the pitch. It reached the game twice: here, as how long a man keeps
  // running with it, and (added at the same time as this comment) as whether he chooses to carry at
  // all. The same double-count that made tackling the loudest instruction in the engine. Swept
  // together, 0.005/1.0 puts the spread at 15.0 m -- dribbling still shapes territory, it no longer
  // decides it -- while keeping a shot spread of 5.8 across the fourteen.
  dribHold: 1.0,
  // Metres the whole side shifts while its own keeper has the ball, per step of GK distribution.
  gkDistPush: 9,
  // ...and metres the men who are NOT the intended receivers shift at a goal kick. Going long with
  // the whole side still standing on the eighteen-yard line means conceding every second ball.
  gkShapePush: 12,
  // How much of the usual depth gate a counter-attack is allowed to ignore. A break starts deep.
  brkDepth: 0.35,
  // How deep the ball has to be for a side to count as building, and how far the midfield shifts
  // for it per step of the approach instruction: back to offer a short one, or up to go beyond.
  buildDepth: 38, buildDrop: 9,
  // How much the passing instruction squeezes the shape toward the ball. Short passing without it
  // is an order to play a ball that is not on.
  compactDir: 0.15,
  // Slices of extra dwell per step of time-wasting, and only while in front. wasteHold is on the
  // ball; wasteT is the one that matters -- how much longer a restart takes, per step, capped at
  // spMaxT so a stoppage cannot hang. wasteCard is the chance per step that the referee has had
  // enough of it, and a second yellow is a sending off like any other.
  wasteHold: 2, wasteT: 10, wasteCard: 0.05,
  // What it costs to give the ball away here: the opponent starts a possession, and the closer to your
  // own goal the worse that is. Without this term the expected value of a pass was ok*value with no
  // downside, so a 50% ball into the box outscored a 95% square pass every time -- completion sat at
  // 70% against a real 80% and far too much of it reached the box.
  loss: 0.12,
  // How fast running with it stops working as defenders close. At 0.055 a carry retained 88% with a
  // man on him, so the safest option was always to keep running and passing collapsed to a fifth of
  // its real rate. Real dribble success under genuine pressure is closer to half.
  carryRisk: 0.16,
  carryAdv: 8,
  // A carry is a RUN, not a jump. Moving him four metres in one slice is a teleport, and that is what
  // it looked like. It now sets a drive lasting several slices, during which he runs with the ball at
  // carrying pace and can be tackled the whole way.
  driveTicks: 5,
  // How long a player dwells on the ball before doing anything. It used to be SEVEN slices -- nearly
  // two seconds -- for a player in space and two for a player under pressure, so the commonest sight
  // in the match was an unmarked man standing still until a defender arrived. A touch and a look is
  // half a second; being closed down makes you quicker, not slower.
  dwellFree: 4,
  dwellMax: 6,
  // Floors. A positional engine resolves a few hundred duels a match in sequence, so a 1.2x edge per
  // duel compounds to 200:1 over a chain -- measured, a 29-point gap produced a 9.75 goal difference
  // against the old engine's 3.31. Real football has floors everywhere: the best side in the country
  // still gives the ball away to the worst, and a hurried clearance still travels. These are what stop
  // small per-duel edges from multiplying into routs.
  // NO floor on the pass DECISION. Resolution is physical -- there is no completion roll left to
  // bound -- so a floor here does nothing but make hopeless balls look viable. The risk model drove a
  // pass through three men down to 0.08 and this clamped it straight back up to 0.34, which is
  // exactly the "why on earth did he play that" ball. A man with no pass on should dribble.
  passFloor: 0.02,
  carryFloor: 0.46,
  // Tackling, per tick of contact. Ablation put almost the entire rating-gap blowup here and nowhere
  // else: switching this duel off alone took a +20 game from 8.71 GD to 3.29, and took the weaker
  // side from 2.3 shots to 20. The cause is that this is rolled every tick a defender is in reach, so
  // whatever edge it carries is raised to the power of the ticks in contact -- a 1.28x per-tick edge
  // became 1.5x per possession and a rout over a match. Hence a deliberately narrow band.
  tackleLo: 0.170,
  tackleHi: 0.200,
  tackleK: 26,
  // A tackle is CONTACT, not a transfer of ownership. Winning the duel used to teleport the ball to
  // the tackler's feet with no event emitted at all, which is why it read on screen as the ball
  // simply changing colour. How often he comes away with it under control depends on how well he got
  // there: a good tackler who is properly set keeps it, a man stretching at arm's length pokes it
  // loose and it is anybody's.
  tackleCleanBase: 0.18, tackleCleanSkill: 0.34, tackleCleanGap: 0.10, tackleLoose: 7,
  // What "get stuck in" and "stay on feet" are actually worth. Both were dead settings in this
  // engine: more challenges won, more free kicks conceded.
  // foulAggr was 0.0014 -- the tackling instruction moved the foul rate by fourteen HUNDREDTHS of a
  // percent, which is indistinguishable from not reading it at all. A quarter either way is a real
  // difference between a side that dives in and one that stays on its feet.
  tackleAggr: 0.16, foulAggr: 0.25,
  // Marking distance. This is geometry, not skill, so tightening it makes the game harder for everyone
  // equally -- it lowers chance quality without touching the rating gap, which is exactly the knob to
  // reach for once the skill-dependent duels are bounded.
  // How far goal-side of his man a marker is held, as a floor rather than a target. markBase is
  // where he would like to be; this is the line he may never be caught upfield of.
  // Swept 0 / 1.2 / 1.8 / 2.5 against the whole regression, not just the marking metric. 2.5 buys
  // goal-side 61% -> 69% and unguarded men in our own box 30% -> 26%, but it drops the line with it:
  // offsides fall 2.06 -> 1.49 and shots from outside 15 m rise 51% -> 58%, and the score goes 13/21
  // to 11. 1.2 takes the nearest defender to a man in our box from 3.5 m to 3.2 and costs nothing.
  markGoalSide: 1.2,
  markBase: 2.10,
  markTighten: 1.10,
  // How fast a marker's target follows his man, and how far ahead of him it is aimed. An exponential
  // filter at 0.22 lags a target moving at 6 m/s by nearly a second of running -- measured, markers
  // in the box sat 5.3 m off the man they were supposedly on, and that gap WAS the filter. He is
  // tracking one person, not reading a noisy field, so he can follow properly.
  markSmooth: 0.55, markLead: 1.4,
  // How fast a player's target is allowed to move. Recomputed raw it twitched every slice and the
  // whole side looked like it was vibrating; at 0.22 a run takes about a second to redirect, which is
  // roughly how long a footballer takes to change his mind.
  targetSmooth: 0.22,
  // The execution layer. A footballer has mass: he takes about a second to reach top speed and cannot
  // reverse instantly. Steering the velocity toward what he wants rather than snapping to it is what
  // turns a set of positions into running, and it is the last thing between this and looking natural.
  // Separation, straight out of Reynolds. Five of the nine duties place a man relative to the ball or
  // to an opponent who is near it, so under contest the whole side converged and stood on each other.
  // A short-range repulsion between team-mates is the standard fix and costs almost nothing.
  sepR: 7.0,
  sepW: 0.25,
  // And a leash: however urgent the job, a player may not stray more than this from the zone his role
  // gives him. This is what stops one contested ball dragging eleven men into the same square.
  leash: 15,
  leashPress: 24,
  leashRun: 30,
  jockeyR: 3.4,
  // Where the presser stands once he has closed: this far off the ball, on the line between it and
  // his own goal. Goal-side, and in the way of the shot.
  //
  // TRIED AND REJECTED twice before the real cause turned up. Scaling the jockey distance down in
  // the shooting zone made the defence WORSE (nearest defender 4.0 m -> 4.3 m). Moving the presser
  // onto the ball-to-goal line as a separate zone rule did nothing (1-3% blocked at every stride
  // from 0.9 to 2.8 m). Both failed for one reason: he was never reaching ANY target he was given,
  // so rewriting the target could not matter. Measured, the presser stood on his own target 7% of
  // the time and 4.14 m off it. The fix is closeStop, not this. Kept at a plain standoff.
  jockeyStand: 1.5,
  interceptW: 1.9,
  // Only the man actually going for the ball runs flat out. Everyone else -- markers, the man
  // getting back into shape, a runner in behind -- works hard but does not sprint, because a
  // footballer cannot and does not. Being "committed" used to grant TOP SPEED, and with 44% of the
  // pitch flagged committed at any moment the whole match was played at a sprint: mean 3.7 m/s
  // against a real 2, and a third of all player-slices above 5.5 m/s against a real three per cent.
  effortHard: 0.68,
  // How far from his target a committed man has to be before he stops working and starts running,
  // and over how many metres that ramps to a flat sprint. Inside recoverNear he is jockeying or
  // taking up a position; past it he is recovering, and recovering is done at full pace.
  recoverNear: 6, recoverSpan: 12,
  // How far out of his block slot a defending player has to be before he is getting back into shape
  // rather than standing in it, and the pace he does that at. trackBase MUST exceed blkSlew / top
  // speed (5.5 / 7.3 = 0.75) or the shape moves away from him faster than he may follow it.
  // trackBase 0.82 of a 7.3 m/s top speed is 5.99, against a block that slides at blkSlew 5.5 --
  // half a metre per second of margin, so a man 6.5 m out of shape needs thirteen seconds to get
  // back into it and in an eighteen-minute match never does. Measured, the median defender stood
  // 6.5 m off the slot he had been given with a 90th percentile of 17.6, and 4.5 of ten outfielders
  // were still in the opponent's half while their own side defended.
  trackFrom: 3, trackBase: 0.94,
  // A beaten man chases rather than returns to shape: the ball has to be at least recoverBehind
  // metres goal-side of him, and inside recoverZone of his own goal for it to be worth the run.
  recoverBehind: 2.0, recoverZone: 45,
  // ...and only the man who was beaten, only if he is near enough to the ball to have been the one
  // beaten by it (recoverFrom), and he runs to a point recoverAhead metres goal-side of the ball
  // rather than trailing it.
  recoverFrom: 16, recoverAhead: 9,
  accel: 0.42,
  turnPenalty: 0.55,
  // Line of engagement, in metres from your own goal: how far up the pitch you will go to close the
  // ball down. Beyond it the side just holds its shape and waits, which is what a block IS. The
  // default sits around halfway; pressingLOE pushes it into their half or drops it onto your own box.
  loePress: false,
  loeBase: 72,
  loeStep: 15,
  // How tightly the side without the ball squeezes toward it, and how far a man will travel to close
  // it down. Too loose and nobody ever gets near the ball; too tight and eleven players chase it.
  compactDef: 0.22,
  compactAtk: 0.06,
  // WIDTH. widthStep is what one notch moves the distance of a slot from the centre line, so the
  // full range runs about 0.68x to 1.32x of the formation's own shape. widthPull is how much the
  // same notch stops a man drifting toward the ball when it goes to the other side -- holding width
  // is the half of the instruction that keeps a switch of play on. widthEdge keeps the widest
  // setting from posting a full-back on the paint. See meAnchor for what this was fixing.
  widthStep: 0.16, widthPull: 0.20, widthEdge: 3,
  // The old literal 14 out of meFindSpace, now a named constant so width can scale it.
  crowdR: 14,
  // holdDev is how much a metre of deliberate displacement stiffens the base pull in
  // meFindSpace, so an instruction defends its own slot. spaceInner is the second search ring,
  // as a fraction of ME_SPACE_R, which is what lets the search adjust instead of jump.
  holdDev: 0.35, spaceInner: 0.5,
  engageR: 26,
  // How many defenders leave their zonal spot to pick up a man, by how deep the ball is in our half.
  // Ten was the old value and it destroyed the shape entirely; these are tuned against shots conceded.
  markCap: [7, 5, 3],
  markCommit: 0.80,
  laneK: 0.70,
  // Real football completes about 80% of its passes and wins maybe half its take-ons. Getting that
  // ratio wrong is what makes a side dribble instead of playing: at 66% passing and 85% carrying, the
  // engine ran 963 carries to 554 passes, which is the opposite of the sport.
  passBase: 1.06,
  // Completion lost per metre of pass length -- see meDecide, the sole price of directness.
  // Swept 0.0072 / 0.0100 / 0.0130 against Much More Direct: its edge held at +0.167 / +0.162 /
  // +0.258 and its territory at 45.3 / 46.3 / 46.7 m. Making long balls fail more does NOT price
  // directness, because a long ball that fails still moves the ball forty metres upfield -- the
  // opponent wins it in their own half either way. Completion is not the lever; what a side can do
  // after winning it deep is. Left where it was.
  passDistK: 0.0072,
  recvPress: 1.40,
  // The same thing for a ball played OVER the man marking him rather than into his feet. See the rp
  // term in meDecide -- a lofted ball into an area is an aerial contest, and being tight to a man
  // does far less to stop a header than it does to stop a pass being received. Sharing one
  // coefficient priced a cross at a defended box's GROUND-pass completion.
  // Swept 1.40 / 0.55 / 0.30 / 0.15 at blkDrop 14, 36 matches a cell -- balls landing in the box a
  // match, then crosses, then pass completion and goals:
  //   2.8 / 0.8 / 79.5% / 2.83     4.4 / 1.1 / 78.4% / 2.92
  //   4.9 / 1.1 / 77.0% / 2.67     6.0 / 1.4 / 77.7% / 2.83
  // 0.55 buys 57% more balls into the area for a point of completion. Past it the returns go flat
  // and the whole game's completion starts paying for it.
  recvPressHigh: 0.55,
  // ---- distribution and clearances ---------------------------------------------------------
  // Getting rid of it was gated at press > 2.1 -- three opponents inside six metres. Below that bar
  // it did not exist as an option at all, so a keeper being closed down had nothing to choose from
  // but the least-bad short ball, and played it into an opponent. Anyone in his own third has it
  // now, and it is AIMED: a clearance is still a football action, so it goes toward the best-placed
  // man upfield rather than blindly down the middle.
  // clearPanic: this deep it is always on the menu, pressure or not. Between there and clearDepth it
  // needs somebody actually on him. Beyond clearDepth it is not a clearance at all.
  clearPress: 1.1, clearPanic: 22, clearDepth: 40, clearOk: 0.46, clearMinUp: 12,
  // What a clearance is actually WORTH: the danger it removes from your own goal. Scored as an
  // ordinary pass -- the value of the patch of grass it lands on, minus the cost of losing it there
  // -- it came out negative every single time, because meVal forty metres upfield is almost nothing
  // while the loss term is not. Measured: not one clearance in 1652 slices of a side on the ball in
  // its own third. They lobbed it around their own box instead and lost 31% of those balls.
  clearRelief: 0.07,
  // Into touch. Deep and swamped, the ball goes into the stand. A throw-in against you is a much
  // cheaper outcome than a turnover in your own box, and that difference IS the option -- it is
  // scored as the same loss every other action pays, discounted for the ball being dead.
  touchDepth: 26, touchPress: 1.6, touchDiscount: 0.42,
  // The keeper's own distribution. Out of the hands is more accurate than a stroked pass, and what
  // he is really choosing between is playing out and going long -- which is exactly what the gkDist
  // instruction says. It was declared in the strategy object and read by nothing in this engine.
  gkRollD: 24, gkRollOk: 1.16, gkLongD: 32, gkDistW: 0.014,
  // THE FOUL. foulR is how near a challenge has to be to be one at all; foulBase is the chance per
  // slice that a man already that close goes through him. It is then multiplied by how fast he came
  // in (foulPace, per m/s of closing speed), reduced by how good a tackler he is (foulSkill: a
  // 99-rated tackler commits half as many), and scaled by the tackling instruction (foulAggr).
  // Calibrated against a real eleven fouls a side; the old flat roll gave 1.58.
  // Swept: foulBase 0.010 / 0.016 / 0.022 / 0.030 gives 6.2 / 10.1 / 12.4 / 14.9 fouls a side.
  foulR: 2.2, foulBase: 0.018, foulPace: 0.55, foulSkill: 0.50,
  // THE CARD. Severity is the same two things that made it a foul -- the pace of the challenge and
  // what he had to gain by stopping the move -- so a trip in midfield is a free kick and the same
  // challenge on a man running at goal is a booking. Real football: about 1.8 yellows a side and a
  // red every fifteen or twenty matches.
  cardPaceFull: 7, cardPaceW: 0.65, cardDangerW: 0.9,
  // cardYellow swept against foulBase: at 0.16/0.24 with eleven fouls the yellows come out at
  // 1.44 / 2.25 a side. Straight reds cut to 0.002 because most dismissals here arrive as second
  // yellows and the two together were running about three times the real rate.
  cardYellow: 0.18, cardStraightRed: 0.002,
  // How much less readily a challenge in the penalty area is given as a foul.
  // Swept against the penalty count: 0.30 gave 0.55 penalties a match from fouls alone against a
  // real 0.28 for all causes. At 0.115 the foul-derived share is about 0.21, leaving room for the
  // handball to make up the rest.
  foulBoxScale: 0.115,
  // INJURY, off the same challenge that made the foul. injP is the base chance a foul hurts the man
  // fouled, injPace scales it by how fast he was gone through, and injSerious is the share of those
  // he cannot continue with. Serious ones are rare on purpose: nothing can replace him yet.
  injP: 0.030, injPace: 0.25, injSerious: 0.16, injKnockT: 240, injKnockSpd: 0.86,
  // SUBSTITUTIONS. subFromTick is how far into the match before a manager makes a change for tired
  // legs -- an injury is replaced whenever it happens. subStamina is the level he goes at, and a man
  // carrying a knock is treated as this much more tired than he reads. subSamePos favours a like-for
  // -like change over a better player out of position.
  subCap: 5, subFromTick: 1700, subStamina: 74, subKnockBias: 14, subSamePos: 8,
  // Stamina per metre run. Swept in test/stamsweep.mjs against what it does to the bench, because
  // the two are one question -- a threshold cannot fire if nobody ever gets near it:
  //   0.0026 -> half time 93.8, full time median 87.8, 0.29 subs a match   (what shipped)
  //   0.0050 -> 88.1 / 77.1 / 1.50
  //   0.0075 -> 82.5 / 68.4 / 5.86
  // 0.0065 lands half time near 85 and full time near 72, which is roughly four changes a match.
  // Goals and pass completion barely move across that whole range, so this is a free axis.
  drain: 0.0065,
  // STOPPAGE TIME: the fraction of dead-ball time played back, and a ceiling on it.
  addedFrac: 0.55, addedMax: 900,
  foulP: 0.9958,
  // Bodies in the way. About a third of real shots never reach the keeper, and this is the honest place
  // to put that: it depends on how many defenders are between the shooter and the goal, not on how
  // good anybody is, so it lowers scoring without touching the rating gap.
  blockK: 0.6,
  blockMax: 0.58,
  // How much a spot is devalued by the men standing on it. See meValHere.
  valPress: 0.30, valPressMax: 0.80,
  // A clear sight of goal is a reason to shoot in its own right. How far out that reason survives is
  // a property of the finisher -- shotRange metres plus what his shooting buys him, so 14 m for a
  // centre-half and about 23 for a striker -- and it fades over shotRangeFade rather than switching
  // off at a line. Without this nobody ever elected to shoot from outside ten metres all match.
  shotRange: 14, shotRangeSkill: 9, shotRangeFade: 7, shotLaneClear: 1.6, shotSight: 0.8,
  // A clear sight of goal is worth a great deal at ten metres and very little at twenty-five: past
  // that the keeper, not the bodies in front of him, is what stops it. Flat, it made a clean look
  // from twenty-two metres score like a chance and he shot instead of running at the goal.
  shotClearD: 10, shotClearFade: 14,
  // A long shot is right when going closer would make the chance WORSE. Distance always argues for
  // carrying; the bodies that will converge on him as he does argue the other way. A clean sight from
  // twenty metres with the box packed in front of him is a better chance than a crowded one from
  // twelve, and that -- not distance alone -- is when a man should hit it.
  // The mirror of shotNowW: what a man gains by carrying INTO a better chance rather than striking
  // the one he has. See the drive-at-goal term in meDecide.
  // Swept 0 / 0.25 / 0.45 / 0.8 over 1,645 shots, both sides Balanced. Worked chances (twelve
  // seconds or more on the ball) and the shot they produce:
  //   0     0.118 xG from 12.1 m   6.9 shots a match   0.741 xG a match
  //   0.25  0.123 from 11.4        5.7                 0.756
  //   0.45  0.160 from 10.8        4.9                 0.738
  //   0.8   0.169 from 10.8        4.3                 0.680
  // 0.45 buys a 36% better worked chance from a metre and a bit closer at NO cost in total output --
  // it redistributes rather than adds, which is what driving at goal instead of striking from range
  // looks like. Past that the carry starts beating shots it should not and the total falls away.
  // NOTE WHAT IT DOES NOT FIX: turnover chances improved too, 0.167 to 0.234, so transition still
  // out-creates possession by about the same ratio. This corrects an asymmetric decision; it does
  // not make keeping the ball pay.
  carryShotW: 0.45,
  shotNowW: 4.5,
  // How clear the sight of goal is, in the SHOT PROBABILITY itself rather than merely in appetite.
  // Two shots from fourteen metres -- one with five bodies in the way, one clean through on the
  // keeper -- were scored identically, because the only defensive term in meShotP was pressure ON
  // THE SHOOTER. Measured: a man one-on-one from 14 m was given a 5.9% chance, so he dribbled
  // instead of shooting 77% of the time. Real conversion from there is about 0.06 in a crowd and
  // 0.3 or so clean through, and this is the term that tells them apart.
  // A LOW BLOCK HAS TO ACTUALLY STOP GOALS. It did not: Park The Bus faced a middling 11.0 shots and
  // allowed 16.0% conversion, the worst in the game, while sides defending high allowed 11.9%. Every
  // one of its own defensive instructions -- Much Lower press, Much Lower line, Regroup -- made it
  // concede MORE, which on the one style that exists to not concede is backwards.
  // It was never conceding more shots, it was conceding better ones. meShotP prices proximity
  // exponentially, exp(-d * 0.165), so an 8 m chance is worth seven 20 m ones -- while density was
  // priced linearly AND floored: clamp(shotCrowd, clearMax - blk*shotLaneK, clearMax), clearMax up to
  // 3.2 close in. At 0.40/0.80 it took about three and a half bodies on the shot line to reach the
  // floor, and even a wall kept 40% of the chance. A block trading distance for bodies was trading an
  // exponential for a capped linear and losing every time.
  // At 0.25/1.10 it takes ~2.7 bodies, and deep sides now allow 12.3% against a high line's 17.2%.
  shotClear: 3.2, shotCrowd: 0.25, shotLaneK: 1.10,
  // ---- the defensive block ------------------------------------------------------------------
  // blkDrop is how far behind the ball the deepest line sits; blkDepth is how deep the whole thing
  // is when defending its own box (real: 20-25 m) and blkStretch how much it lengthens as it steps
  // up the pitch. blkSlide is how far it shifts sideways toward the ball -- never all the way, or
  // the far side is abandoned. blkZone is how far into your patch a man has to come before you go
  // with him, and blkTight how far goal-side of him you sit once you do.
  // blkMin was 7: the block line was allowed to collapse to seven metres from its own goal line, so
  // the deepest settings put all ten men inside the six-yard box WITH the attackers and every chance
  // conceded was point-blank. That is why sitting deep measured as the two worst edges on the board
  // from opposite directions -- defLine at its lowest conceded the most of any setting (0.87 xG) and
  // pressingLOE at its lowest conceded the least of any (0.55), which cannot both be right. A real
  // low block defends the edge of its area, not its own goalmouth.
  // blkDrop is how far behind the ball the block sits, and it was the whole of the offside problem.
  // Measured: 21.8% of on-ball slices already had a man beyond the line, by 3.6 m on average, and
  // only 1.2 offsides a match were given -- the opportunity was there and the line was too deep to
  // punish it. Sweeping it: 16 -> 0.58 offsides a side, 12 -> 1.31, 8 -> 2.33. The passer's own
  // judgement (offBlind) and how far a runner aims beyond the line (runBehindX) were both swept
  // first and neither moved it: 0.58/0.75/0.92/0.90 and 0.58/0.65/0.71/0.56 respectively. It was
  // never about who could see the line -- it was about where the line was.
  // blkMax caps how far from its own goal the block line may be ordered. At 58 it never bound in
  // practice: wantLine is a flat blkDrop behind the ball wherever the ball is, so with the ball 62 m
  // upfield the back line was sent to 54.3 m -- past halfway -- and the block ORDERED 8.5 of ten
  // outfielders into the opponent's half, with six or more of them up there on 81% of slices. The
  // men were BEHIND their slots in every band, so this was never anybody failing to track back: the
  // shape was telling them to stay, which is why every effort lever measured as noise.
  // Swept 58 / 50 / 44 / 38 with the ball in the opponent's half (ordered upfield, 6+ share):
  // 8.5 / 81%, 6.1 / 80%, 5.8 / 68%, 5.4 / 52%. Goals 1.3-1.6 and shots 9.4-10.2 across the whole
  // range, so the high setting was buying nothing. 44 keeps a genuinely high line and leaves eight
  // metres of recovery room behind halfway.
  // blkDrop is the gap the block holds BEHIND the ball, and at 8 m it was the reason nobody in this
  // game ever stood in a penalty area. The chain: every attacker's off-ball target is clamped to the
  // offside line (meShape), the offside line is the second-deepest defender, and the second-deepest
  // defender is this line -- so where the block stands is where the whole attack stands. Measured,
  // the most advanced attacker was aimed within a metre or two of the offside line in every band on
  // the pitch. With the ball 20 m out the line sat on 17.3 m and the eighteen-yard box starts at
  // 16.5, so being in the area was illegal for the entire match: 75% of every pass struck in the
  // final third had nobody in the box to aim at. A real back four defending a ball 20 m out is on
  // its own six-yard box, not six metres in front of the ball.
  // Swept 8 / 11 / 14 / 17 over 36 matches a cell -- offside line with the ball 16-25 m out, then
  // men in the box with the ball in the final third, then goals and shots a match:
  //   17.3 / 0.51 / 3.06 / 19.4     16.6 / 0.55 / 2.92 / 17.0
  //   14.7 / 0.63 / 2.83 / 17.1     14.0 / 0.78 / 2.53 / 16.5
  // 14 takes the goal rate to 2.83 against a real 2.7-2.8 rather than away from it, which is the
  // tell that 8 was buying chances by leaving the box undefended. 17 keeps going and costs half a
  // goal a match for it.
  // HOW FAR defLine MOVES THE SHAPE THE SIDE ATTACKS WITH. lineA is the in-possession line -- the
  // comment above it in brain.ts says so -- and it carried the same 7 m a rung as the defending line
  // did, so an instruction labelled "Def. Line" was also deciding where the side sets up WITH the
  // ball. At -2 that is fourteen metres, and it is most of what Park The Bus pays for parking:
  // measured against the field, its shooter receives the ball 33.2 m from goal against 29.4 for a
  // neutral line, carries it 28.3 m against 24.7, and takes 18% fewer shots at identical quality
  // (0.124 xG against 0.132). It also explains why telling it to counter does nothing -- possWon +1
  // measured -0.05, because there is nobody up the pitch to counter with.
  // MEASURED AND INERT -- 7 stays. Swept 7 / 5 / 3 / 0 against the full field, 180 blocked fixtures
  // an arm: Park The Bus moved +0.01, +0.00 and +0.01. Nothing. The reason is the clamp on the same
  // line: at defLine -2 the expression `ballDepth - 30 - 14` is negative for most of a match, so
  // lineA is already pinned at its floor of 18 and the coefficient never reaches the pitch. The
  // sweep of that same floor recorded above this line found the same nothing for the same reason.
  // Kept as a named constant rather than reverted to a literal 7, because the next person to look
  // at "defLine also moves the attacking shape" should find this note instead of running it again.
  // What a header at goal is worth against a strike from the same spot. 1 is parity, which is
  // where it ships: both are resolved by the ball physics rather than by a roll, so there is no
  // reason to assume the estimate should differ until it is measured.
  headXg: 1,
  // How much of a system a side has drilled, and what it costs not to have drilled one. commit is
  // scored in units of instruction set, capped, less what its contradictions take back; the result
  // is then read as a SHORTFALL against a full plan and charged in rating points.
  // At 0.077 goals a rating point, drillCap 5 and indecision 2.0 means a side with no instructions
  // at all plays 10 points below its squad -- about 0.77 goals -- while every designed style in the
  // game sits within 1.2 points of its true rating. That asymmetry is the entire mechanism.
  // indecision was pushed to 2.0 on arithmetic that turned out to be wrong, and measured blocked at
  // 80 fixtures a style it bought -0.18 goals for a TEN point penalty -- inside its own error, and a
  // slope of 0.018 goals a rating point rather than the 0.09 the home-advantage sweep reported for
  // the same quantity. Those two blocked measurements disagree by five times and the disagreement is
  // unresolved; until it is, rating is not a channel to push anything through. Back to 1.0, which is
  // the magnitude that measured as closing the squad-fit inversion (+0.427 -> -0.069).
  drillOvr: 1.1, drillCap: 5, clashOvr: 3.0, indecision: 1.0,
  lineADefL: 7,
  //
  // FOUR THINGS THAT DO NOT FIX PARK THE BUS. It sits at -0.28 against the field where Balanced is
  // +0.02, and defLine -2 is the whole of the gap: at defLine 0 it is +0.20. What that costs splits
  // two thirds attacking (goals for 0.98 -> 1.30) and one third defending (against 1.21 -> 1.06).
  //   1. ANOTHER AXIS IN THE STAMP FIGHTING IT. Taken apart axis by axis, no. Every other
  //      instruction it sets is EARNING: approachPlay -0.30, width -0.22, passingDir -0.19.
  //   2. THE BLOCK'S CEILING. At -2 the block may not push past 32 m against 38 at -1. Raising it
  //      32 -> 44: goals for 1.185 -> 1.155, against 1.230 -> 1.240, GD -0.04 +/- 0.15.
  //   3. TELLING IT TO COUNTER. possWon -1 -> +1 measured -0.05 +/- 0.17, and -> 0 measured +0.02.
  //      It wins the ball in the best counter-attacking situation in football -- against a side
  //      committed forward -- and takes 39.6% of its shots from turnovers against a neutral line's
  //      44.1%. The intent is not what is missing.
  //   4. THE IN-POSSESSION LINE, above.
  // What is actually true of it, measured: its shooter receives the ball 33.2 m from goal against
  // 29.4 for a neutral line and carries it 28.3 m against 24.7, for 18% fewer shots at identical
  // quality. And it concedes MORE shots from CLOSER while standing 7.81 men in its own box against
  // 6.97 -- inside 8 m, 1.08 a match against 0.93. More bodies, more shots, nearer the goal.
  // Metres of front-to-back spread per rung of DIRECTNESS, one-sided on purpose. Stretching a direct
  // side measured well -- Wing Play 730 -> 876 metres of ground and +0.43 goals, Route One's box
  // entries 2.40 -> 3.50, Catenaccio +0.30 goals. COMPRESSING a short-passing side measured badly
  // and is not done: Tiki-Taka's ground gained fell 296 -> 162 metres, because bunching everyone
  // behind the ball does not create a short ball FORWARD, it just makes every forward ball tiny.
  // Whatever short passing is missing, it is not a tighter shape.
  // What a pattern step is worth on top of the option's own score. val terms here run about 0.03 for
  // simply keeping the ball and 0.04 for twenty metres of ground, so 0.045 is decisive without being
  // overwhelming -- enough to make a square ball that starts a switch beat a square ball that does
  // not, which is the entire point.
  patW: 0.045,
  spanDir: 5,
  // WHY POSSESSION FOOTBALL DOES NOT WORK IN THIS ENGINE. Written down because four separate
  // attempts tonight aimed at the wrong link, and the funnel says exactly where the break is.
  // Per match, against the same rotating field:
  //   style          passes  fwd%  metres  final 3rd  into box  shots   box/3rd
  //   Tiki-Taka       104.8   49%     296       11.0      1.17   3.60     10.6%
  //   Control Poss     98.1   54%     352        9.1      0.97   4.03     10.6%
  //   Balanced         82.1   64%     570       15.2      1.37   4.00      9.0%
  //   Gegenpress       79.4   75%     869       27.4      4.40   6.30     16.1%
  // Tiki-Taka plays more passes than any side in the game and moves the ball less than any side in
  // the game. It reaches the final third 11 times where Gegenpress reaches it 27.
  //
  // THE LAST LINK IS FINE. Possession sides turn final-third entries into box entries at 10.6%,
  // BETTER than Wing Play's 8.9%. Once they arrive they do the right things. So every fix aimed at
  // chance quality -- the rejected screening model, passShotW, carryShotW's mirror -- is aimed at a
  // chain that breaks four steps earlier.
  //
  // THE BREAK IS GROUND PER PASS. A possession side gains 5.3 m of goalward progress per forward
  // pass; Gegenpress gains 14.0. Crossing thirty metres therefore costs one side about eleven
  // completed passes and the other about three. Completion is already correctly steep with length
  // (92.9% at 0-6 m, 86.0% at 6-10, 68.6% at 18-24, 56.9% at 24-32, all physical interception
  // geometry rather than a coefficient), so eleven passes at 85% is 0.17 against three at 69% for
  // 0.31. Short passing loses to compounding attrition and would break even at about 90% in the
  // 6-14 m band, which is where real tiki-taka sides actually sit.
  //
  // AND 5.3 m FROM A 10 m BALL MEANS THE FORWARD OPTIONS ARE DIAGONAL. That is an off-ball
  // positioning problem: the men a short passer can reach are beside him rather than ahead of him.
  // TRIED AND REJECTED, same night: compressing the shape for short-passing sides (spanDir applied
  // to negative passingDir). It made it worse, not better -- Tiki-Taka's ground gained fell 296 to
  // 162 metres -- because bunching everyone behind the ball does not create a short ball FORWARD,
  // it makes every forward ball tiny. The answer is not a tighter shape and not the shot model.
  // It is whether a short-passing side has anybody standing in front of it.
  blkMin: 10, blkMax: 44, blkDrop: 14, blkDefLine: 6, blkLoe: 3,
  // The window blkMin/blkMax describe moves WITH defLine, at the same step the value moves, so the
  // instruction survives the clamp instead of being eaten by it -- see meBlock. These two are the
  // absolute stops that remain: a back four never inside its own six-yard box, and never past the
  // halfway line, whatever it was told.
  blkFloor: 6, blkCeil: 52,
  // How deep the block is, from defending your own box to camped in their half. A real low block is
  // about thirteen metres from the last man to the first, not twenty-one: held at 21 the front band
  // sat on the edge of the area while the ball was in it, so only the back four were ever inside.
  // A real low block with the ball in your box: back four at six to ten metres, midfield at sixteen
  // to twenty-two, forwards nearer thirty. Thirteen asked the midfield to stand on the six-yard box
  // and the forwards inside the area, which is not a shape any side has ever held -- and it put every
  // one of them twenty metres from a slot they were sprinting at and never reaching.
  // With the line correctly on 10 m and the block 21 m deep, the bands sit at 10 / 20 / 31 -- so
  // only the back four are ever inside the eighteen-yard box, by construction. A side defending its
  // own area is genuinely compact: back four on the six-yard line, midfield on the penalty spot,
  // forwards on the edge.
  blkDepthLow: 15, blkDepth: 32, blkStretch: 14, blkSlide: 0.55,
  // Inertia. chaseFrom is when a possession has outlasted an ordinary one and the block starts to
  // tire (24 ticks, six seconds -- the point the box has finished refilling); chaseRamp is how long
  // it takes to tire fully; chaseSlow is how much of its recovery speed it loses at the end of that.
  // OFF, AND THE REASON IS THE FINDING. Swept 0 / 0.45 / 0.75 over 1,645 shots. It WORKS -- at 0.75 a
  // side that has kept the ball twelve seconds faces 3.71 defenders in the box against 4.27 -- and it
  // buys nothing: the chance is worth 0.110 instead of 0.118, and turnover chances got BETTER, 0.167
  // to 0.191. Emptying the box does not improve the shot, for the third time tonight and for the
  // reason meShotP already gives: conditional on shooting, the shooter has already found his line.
  // What actually separates a turnover chance from a worked one is DISTANCE and nothing else --
  // 10.7 m against 12.1 -- through the exponential in meShotP. Chance quality here is geometry.
  // So possession can only pay if a side with space gets CLOSER before shooting, and it does not:
  // at chaseSlow 0.75 the box emptied and the shot distance went the wrong way, 12.1 m to 12.5.
  // The missing decision is shoot-versus-carry -- a man with nobody in front of him should drive at
  // the goal rather than strike it from where he stands. That is the next thing, and it is the first
  // lever tonight that has not already been measured and refuted.
  // AND IT FAILED AGAIN AFTER THAT LEVER LANDED. Re-tested at 0.6 head to head once carryShotW was
  // in and players would actually use the space: the spread went 0.92 to 1.18 and it hurt the styles
  // it was built for. Control Possession -- the biggest ball-holder in the game -- lost 0.21 a match,
  // Park The Bus 0.09. The side that GAINED most was Gegenpress, +0.23, which barely holds the ball
  // at all: it wins possession back so fast that its own block never tires while everyone else's
  // does, so slowing recovery is a straight gift to the highest press in the game.
  // Twice measured, twice refuted, both before and after the decision it was supposedly waiting on.
  // Do not try a third dose; whatever possession is missing here, it is not defensive inertia.
  chaseFrom: 24, chaseRamp: 40, chaseSlow: 0,
  // Metres between adjacent men in a band, and how much wider the bands in front space out. The
  // whole band is capped at blkWidthMax so a seven-man midfield does not span the touchlines.
  blkSpacing: 8.5, blkSpaceStep: 2.0, blkWidthMax: 44,
  // How far the middle band drops toward the back line as the ball nears our goal, as a fraction of
  // the block's depth, and how much the whole thing tucks in laterally at the same time.
  // Swept: the drop alone leaves the sprint tail where it was (6.8% of player-slices above 5.5 m/s
  // against a baseline 7.0%); adding the lateral squeeze on top pushed it to 11.1%, because the band
  // then has to chase sideways as well as back. The narrowing is off until that is worth paying for.
  blkMidDrop: 0.22, blkSiegeNarrow: 0,
  // Rest defence: how deep a man has to naturally be to hold the block while his own side attacks,
  // over what span of depth that fades out, and how strongly he holds it against his attacking job.
  // At 0.55 / 0.25 it is the back line plus the deepest midfielder, which is a 4+1 rest shape.
  restMind: 0.55, restTaper: 0.25, restW: 0.7,
  // How much a notch of WIDTH releases a wide player from rest defence. At 0.35 the widest
  // setting frees a touchline full-back about half way; a narrow side is untouched, because
  // its full-backs were never the thing providing the width.
  restWide: 0.35,
  blkZone: 8, blkTight: 1.6,
  // How far out of his slot a man will step to pick somebody up, and how much he prefers to stay
  // with the man he already had. Without the stickiness the greedy assignment swapped defenders
  // between attackers from slice to slice and BOTH their slots jumped several metres each time --
  // measured, the side sat 10.7 m off the block it was being asked to hold.
  // Once a man is in your zone you mark him PROPERLY. The step used to scale with 1 - gap/blkZone,
  // so the further into your patch he came the less you went with him -- a defender leaning half a
  // metre toward a man six metres away. Measured, that left the nearest defender to an attacker in
  // the box at 4.9 m. Full commitment inside the zone, tapering only over the last blkTaper metres
  // of it, and still capped by blkStep so nobody abandons the block to chase.
  blkStep: 5, blkStick: 3, blkTaper: 3.0,
  // How fast the block itself can travel, in metres per second. It is a body of men, not a formula:
  // deriving its position straight from the ball moved the slots 3-6 m per slice while a footballer
  // covers 1.7, so the whole side spent the match chasing a shape it could never reach -- measured
  // at 10.8 m out of position on average. Lagging a fast ball is not a defect, it is what a
  // counter-attack IS.
  blkSlew: 5.5,
  // ...and the same limit on the spot an INDIVIDUAL chases, which blkSlew never covered: band
  // membership, row spacing and siege width all moved him instantly. Set below a defender's working
  // pace so that closing on his mark is always possible -- a target that moves as fast as he does
  // can be followed but never caught.
  slotSlew: 4.5,
  // Dropping is quicker than stepping up -- men sprint back and jog forward. Symmetric at 5.5 m/s the
  // block could not follow a direct attack at all: it has to cover 26 m while the ball covers 30, so
  // it arrived a full second late and the whole side spent every attack twelve metres too high.
  blkSlewBack: 9.0,
  // A man caught this far upfield of his slot while his side defends is TRACKING BACK, and a player
  // tracking back runs. Left to the lazy gate the front three jogged home at four metres a second
  // from fifteen metres out and were never part of the block at all -- snapshotted at 52 m from
  // their own goal while the block was asking them for 40 and the ball was in their box.
  blkRecover: 7,
  // A defender who is out of shape is RECOVERING, not easing onto a mark. The arrival ramp cut
  // anyone 4-9 m from his target to 55% of his pace -- which in a block is nearly everybody, all the
  // time -- so the side closed at 4.2 m/s while the block itself slides at 5.5 and it outran them by
  // construction. Measured at exactly 58% of top speed, invariant to every other lever I ablated.
  blkChase: 8,
  // ============ TACTICAL BRAIN ==============================================================
  // A pyramid, not a pile of rules. One brain per team reads the game and classifies the phase; two
  // coordinators hand out jobs from that; each player then solves only his own small problem; the
  // steering layer makes it look like running. The thing this fixes is the one every football game
  // gets wrong first -- six players charging the ball at once -- because "press" is now a job that
  // exactly one player holds, and everyone else has been given something better to do.
  balLag: 0.055,
  settleTicks: 40,
  // Ticks from settled to the full step-up, and how far the whole shape climbs once a possession
  // has stopped being contested. See meAnchor: this is the only thing in the engine that converts
  // TIME on the ball into GROUND, and without it a possession side's anchor is measured from the
  // ball it is passing sideways, so keeping it bought nothing at all.
  // OFF, AND BLOCKED BEHIND MESHAPE RATHER THAN WRONG. Two findings, in order.
  // The gate was set where possessions end. At settleTicks 40 -- ten seconds of unbroken
  // possession before the ramp even starts -- settlePush 8 and 16 both moved Tiki-Taka's fieldX
  // by NOTHING: 37.2 stock, 36.6 and 36.6 swept, with Control Possession equally flat. Reopened at
  // settleTicks 8 / settleRamp 16 the mechanism does reach: Tiki-Taka 37.2 -> 38.0, Zona Mista
  // 36.5 -> 38.1, Park The Bus 36.8 -> 37.9.
  // And that is the second finding, because it is a metre of arrival for a TWELVE metre ask, and
  // Park The Bus is not a possession side. The push is being eaten between meAnchor and the pitch
  // exactly as the width instruction is -- see the long note in meAnchor, "asked 19.73, targeted
  // 13.81, stood 13.00" -- and what survives is a small universal nudge rather than a possession
  // side's reward. Control Possession, one of the two styles this exists for, did not move at all
  // and its xGD fell to -0.243.
  // So territory is not reachable from the anchor by ANY term, and that is now three independent
  // confirmations of the same wall: width, this, and the general finding that defensive
  // instructions bite because they feed meBlock's wantLine while possession instructions do not.
  // The bottom of the balance table -- Tiki-Taka, Control Possession, Catenaccio, Park The Bus --
  // is downstream of meShape's erosion, and no constant in this file can fix it. Left at 0 with the
  // mechanism intact, because it is one number away from live once the target pipeline is fixed.
  settleRamp: 40, settlePush: 0,
  // How much of the anchor's deliberate displacement is restored after the positioning chain has
  // eroded it. 1 is the principled value -- the instruction arrives -- and anything less is an
  // arbitrary fraction of a thing that is already being divided three ways. Left as a knob because
  // the shape of a real side is a tuned quantity and this is the one lever over all of it.
  devRestore: 1,
  phaseHyst: 2,
  // Off-ball brains are staggered rather than run every slice: a quarter of the side re-evaluates each
  // tick, so the cost is spread and nobody twitches.
  brainStride: 4,
  // ---- off-ball runs -------------------------------------------------------------------------
  // A run is a committed movement through time, not a position. This is most of what attacking
  // movement actually IS, and its absence is why the side looked like eleven men standing in a shape:
  // the "runner" duty only held a higher line, and nobody ever went anywhere.
  // A run is committed movement. The old caps meant at most TWO players in the entire match could be
  // running at once, each with a twenty-seven second cooldown, so the pitch was eleven men standing
  // in a shape waiting for the ball.
  // FREEDOM: men allowed on a run at once, how far off the shoulder one may start, and how much
  // less certain the grass beyond the line has to be before he goes anyway.
  creRuns: 1, creBehind: 5, creRisk: 0.18,
  // How far beyond the offside line a man running in behind actually aims. A runner is timing a
  // break, not sprinting to a spot; at 15 m he arrived so far offside that no passer would ever
  // serve him, which is why 21.8% of on-ball slices had somebody beyond the line and only 1.2
  // offsides a match were given.
  runBehindX: 15,
  // THE BACK LINE: metres conceded by dropping off, metres held by stepping up per step, and the
  // trap -- how long the man on the ball must have had it before the line jumps, and how far.
  dlDrop: 4, dlStep: 3, trapHold: 3, trapStep: 6,
  // How much closer Get Stuck In stands to the man on the ball, as a fraction of jockeyStand.
  tkClose: 0.10,
  // How far the ball must get past him to count as beaten, and how long he is out of the play for
  // it, per step of Get Stuck In. Zero at Stay On Feet and at no instruction: only committing costs.
  tkBeatGap: 1.5, tkBeatT: 10, tkBeatSpd: 0.55,
  // THE TACKLE. tkRange is how close he must be to go at all; the tkw* weights are what "his options
  // are closed" is made of, summing to 1 at best. tkGo is the bar, lowered by his own tackle rating
  // and by Get Stuck In. tkCool stops one man lunging every slice.
  // Inside this of his own goal a beaten man drops goal-side; beyond it he turns and chases.
  beatDeep: 34,
  tkRange: 2.8, tkEdge: 8, tkCoverR: 14, tkCool: 10,
  tkwNear: 0.42, tkwSide: 0.20, tkwSlow: 0.20, tkwEdge: 0.08, tkwCover: 0.14,
  // Swept 0.60 / 0.78 / 0.84 / 0.88: attempts a side 103.9 / 27.3 / 9.3 / 2.8 and won 57 / 62 / 62
  // / 68%. A real match is 15-20 tackles a side at about 65%, and this engine runs a fifth of a real
  // one's event volume, so 4-6 attempts is the target -- 0.86.
  tkGo: 0.76, tkGoSkill: 0.16, tkGoInstr: 0.02,
  // tkGo was 0.86 and the whole game tackled 7.1 times a MATCH across both sides, winning 81% of
  // them, because the threshold only ever let through the near-certain challenge. Real football is
  // 15-20 tackles a side at 50-60%. The gate is violently non-linear -- 0.86 gives 2.5 outfield
  // tackles a side and 0.74 gives 21.3 -- so it was swept finely: 0.76 lands 15.9 a side at 62%,
  // with pass completion (79.7%) and fouls (18.0) unmoved.
  // tkGoInstr was 0.10 and tkClose 0.45. `angle` is CAPPED AT 1.0, so shifting the threshold by
  // 0.10 near the top of that range is not a nudge, it is a switch: Stay On Feet sat at ~0.90-0.96
  // and tackled 0.0 times a match, Get Stuck In at ~0.70-0.76 and tackled 15.8. The two compounded,
  // because tkClose also pulled the jockey distance from 2.18 m to 0.83 m, which RAISES angle
  // through its own distance term -- the instruction opened the gate and then walked through it.
  // Measured, that made tackling the loudest instruction in the engine at 328% of mean, and it set
  // the possession table outright: the four Get Stuck In styles were the top four for possession and
  // Park The Bus led the game at 60.4% while passing most and carrying least. Ball-winning was
  // buying possession that nothing on the ball had earned. At 0.02/0.10 the spread is 167% and Park
  // The Bus sits at 49.6%, which is a real difference between a side that dives in and one that
  // does not, rather than a different sport.
  tkBase: 0.34, tkAngleW: 0.34, tkSkillW: 0.24, rateTackle: 0.06,
  runTicks: 14,
  runMax: 4,
  runCool: 28,
  // How far up the pitch the ball must be before ANYBODY runs beyond it. A counter-attack starts by
  // definition with the ball deep, so this number decides whether the engine can counter at all.
  runMinDepth: 30,
  runThirdDepth: 52,
  offsideGrace: 2.2,
  // How far beyond the line he can misjudge it, at the bottom of the rating scale -- a top player
  // sees it almost exactly, a poor one is up to this many metres wrong in either direction. This is
  // what lets offside HAPPEN: with a perfect view nobody ever plays one, and the trap wins nothing.
  offBlind: 3.0,
  // How far beyond the line the linesman actually gives it. Not zero -- benefit of the doubt.
  offTol: 0.5,
  // Playing a man INTO SPACE is a different ball from playing it to his feet, and both are now
  // offered for every team-mate rather than the choice being made for the passer by whether the
  // receiver happened to be on a committed run. thruMax is the furthest ahead of a man it is ever
  // played; the actual lead is solved so the two ARRIVE TOGETHER, because a fixed lead overshoots
  // whenever the ball gets there first -- which, at pass speed against a running man, it always did.
  thruMax: 14, thruMin: 3.5,
  // How much of the real flight time a ball to a moving man is led by. Under one because he will not
  // hold his current line and pace for the whole flight -- he is running to meet it, not past it.
  // Swept 0.6 / 0.85 / 1.0: completion came out 79 / 78 / 76%, which is flat within noise at this
  // sample. The point of the change is not the tuning, it is that this number now MEANS something --
  // a fraction of the real flight -- instead of silently compensating for a flight model that was
  // 27-54% short.
  leadFrac: 0.7,
  // How much clear grass around the receiver counts as fully free, and what a metre of ground gained
  // INTO that grass is worth on top of the flat fwdPull.
  // Swept against ground gained per pass. With space unpriced the side gained HALF A METRE a pass --
  // it went sideways and backwards all afternoon. 0.0016 gives +2.9 m, 0.005 gives +6.6 m and 55%
  // forward, which is a side that only knows one direction. Real football is about +4 m.
  roomFull: 12, roomFwd: 0.0045,
  // How much the pressure at the spot he is dribbling INTO counts against him, next to the pressure
  // he is already under. This is what makes a packed penalty area something to be broken down
  // rather than walked through.
  // Swept 1.0 / 1.8 / 2.2 / 2.6 over 90 fixtures a cell, against the finding that EVERY close-range
  // shot in this engine is carried in -- 0% arrive from a pass into the area, and the man shooting
  // from 11.5 m against a six-man block picked the ball up at 21.5 and dribbled 15.9 m through it.
  // Raising this does bite in the right direction: the deep block's xG-conceded penalty over the mid
  // block runs +0.148 / +0.155 / +0.118 / +0.028 (se ~0.08). But it never inverts -- parity is the
  // ceiling -- and parity costs goals a match 2.95 -> 2.67. A 30-fixture pass at the same values DID
  // show an inversion; it was noise, and it is only recorded here so nobody chases it again.
  carryAhead: 1.0,
};
export type EngineConfig = typeof CFG;

// ---- GameplayFootball ports (constants verified against the C++; see docs/gameplayfootball-gap-report.md)
Object.assign(CFG, {
  // GetLazyVelocity (elizacontroller.cpp:437-474). start/end are the distances from the action
  // between which effort falls off; both shrink as a player tires so a tired side stays compact.
  lazyStart: 20, lazyEnd: 65, breathExp: 0.7, lazyFloor: 3.5,
  // Role-scaled opponent avoidance in the space search: a centre-half clears out of traffic, a
  // striker stands on the centre-half's toes on purpose (GF repel x2.2 CB .. x1.0 CF).
  oppAvoidW: 0.35,
  // Ball physics (ball.cpp:167-232). Drag is quadratic on the 3D speed; the linear bounce and
  // rolling terms are what let the ball come to rest in finite time.
  ballDrag: 0.015, ballBounce: 0.62, ballBounceLin: 0.06,
  ballFric: 0.055, ballFricLin: 2.1, grassH: 0.025, ballR: 0.11,
  // Grip on the BOUNCE. A ball in the air only ever met air drag, and a bouncing ball spends nearly
  // all its time above the grass band -- so a lofted pass landed and skidded on almost unchecked.
  // Turf takes a real bite out of the horizontal every time the ball hits it.
  // ...only on a REAL impact. Gravity drives bvz negative on every one of the hundred substeps a
  // second, so a ball sitting on the grass counted as bouncing continuously and lost 26% of its pace
  // each time: it died in three tenths of a second.
  bounceGrip: 0.74, bounceMin: 1.2,
  // Kicking. A ground pass is aimed to ARRIVE at passArrive m/s; execution noise replaces the old
  // outcome roll -- degrees of aim error by skill and pressure, and a power wobble.
  passArrive: 6, passMaxV: 30, passNoiseDeg: 3.9, passNoiseSkill: 9, passNoisePress: 2.5, powerNoise: 0.05, powerNoiseSkill: 0.15,
  // Lofted balls: flight time T = highT0 + highTk * distance, launch solved from T.
  highT0: 0.9, highTk: 0.035,
  // Receiving. Reach is a radius around the receiver against the ball's path this tick; a ball
  // quicker than your touch can handle squirts off you instead of sticking.
  // Touching distance: how far a footballer gets a FOOT to the ball, measured from his centre. A man
  // taking it reaches a little further than one poking at it. These are the circles drawn on the
  // pitch -- what you see touching is what the engine counts as a touch.
  // A boot's length past his body: 0.28 m of him plus a leg. At 0.88 he was sweeping up anything
  // that came within nearly a metre, which reads on the pitch as a reach far bigger than the man.
  // How much further than a controlling touch he can stretch to KICK it -- a toe-poke reaches a
  // little past the foot that shepherds it, but not four metres past.
  playReach: 1.10,
  reach: 0.70, cutReach: 0.60, controlV: 11, controlVSkill: 6,
  // How much of the pass-cutting reach is anticipation. cutAntLo + meTech(position) * cutAntW,
  // anchored to 1.0 at a 75-rated centre-half (position attr ~81, meTech ~0.82) so the calibrated
  // baseline is untouched and only the spread across bands is new.
  // The spread is DELIBERATELY SHALLOWER than the passing spread. Interceptions are roughly flat
  // across real divisions -- a worse defender reads less, but bad passing hands him more loose
  // balls to feed on, and the two nearly cancel. Swept at 0.52 the cancellation was total: worse
  // passers against proportionally worse cutters left completion FLAT at 81-83% across thirty
  // rating points. 0.20 is where the bands finally separate (81 / 80 / 79 at 85 / 75 / 55) while
  // the gap games keep their possession stretch.
  cutAntLo: 0.836, cutAntW: 0.20,
  // ---- bodies -------------------------------------------------------------------------------
  // Players are SOLID. A ball cannot pass through one and two men cannot stand in the same place.
  // bodyR is shoulder to shoulder, bodyH is how high you can block a ball before it goes over you,
  // and bodyE is how much of its pace a ball keeps when it hits somebody who is not controlling it.
  // Shoulder to shoulder a footballer is about 0.55 m across, so this is his radius. At 0.42 he was
  // a 0.84 m-wide barrel and two of them could not stand closer than that; the ball met him 0.53 m
  // from his centre. Everything drawn on the pitch reads these, so the hitbox and the dot can never
  // disagree again.
  bodyR: 0.28, bodyH: 1.9, bodyE: 0.45,
  // A TOUCH is not a bump. When the man in control reaches the ball he plays it where he is going,
  // a little quicker than he is running, and then chases it down again -- which is what dribbling
  // is, and it is the only way the ball ends up in FRONT of him rather than dragging at his heel.
  // A touch pushes the ball a little quicker than he is running, so it draws a metre or two ahead and
  // then decelerates back onto his stride. At 1.35x his pace PLUS 2.4 it left his foot at nearly
  // double his speed -- that is the slingshot: a man receives a dead ball and it rockets away from
  // him. Just over his own pace is a touch; half again is a kick.
  touchGain: 1.0, touchMin: 2.5,
  // Where a touch PUTS the ball: in front of him, on the line he is taking it. The collision was
  // ejecting it along the contact normal, so a man who ran onto the ball from behind had it placed
  // BEHIND him -- the velocity went forward and the position did not, and that is the ball dragging
  // at his heel however hard he pushed it.
  // 0.60, INSIDE dribCtrl. The comment below states the contract -- dribCtrl must exceed dribSet --
  // and it was 0.70 against 1.10, so the control law steered the ball to a point at which it
  // switched itself off. Every carry pushed the ball out of its own control radius and left it
  // free on the grass until he caught it up or it ran out of play, which is the losing-it-while-
  // dribbling nobody could place. The comment even names the resolution -- 'dribSet moves instead'
  // -- and then the sweep that followed moved dribCtrl and left this where it was.
  // Swept 1.10 / 0.85 / 0.65 / 0.55 at the fixed radius: goals 2.75 / 2.63 / 2.63 / 2.98, carries
  // and completion flat. Aggregates cannot see this, which is expected -- it is a possession-
  // quality fault, not a scoring one -- so the value is chosen for margin inside 0.70, not fitted.
  dribSet: 0.60,
  // How far out the man in control still has the ball under his feet. MUST exceed dribSet, or the
  // setpoint is outside the zone the control law operates in and the ball can never reach it.
  // It cannot be widened past reach to buy that, though, and the two are not independent: control
  // out to 1.4 m means the carrier steers a ball a defender is nearer to, so nobody can take it off
  // him. Swept, it reads as a straight trade of realism for a broken match -- the ball sits 0.9 m in
  // front of him and conversion goes to 22-30%, fouls halve to 4.3 a side and shots collapse to 5.5.
  // 1.0 / 1.15 / 1.3 measured 12 / 10 / 11 on the regression against 14. dribSet moves instead.
  dribCtrl: 0.70,
  // ctrlPull is deliberately WEAK and ctrlForce strong: he matches the ball's pace rather than
  // yanking it to a spot. A hard positional pull is what made it look like it was sliding on ice --
  // the ball being dragged sideways to a target instead of running with him.
  // Close control is CONTINUOUS. A footballer has two feet and makes many small contacts; he does not
  // shove the ball once every quarter of a second. Setting its position outright teleported it up to
  // a metre in the middle of a smooth roll -- measured, one slice in ten moved the ball somewhere its
  // own velocity never took it, which is the sliding. He steers it instead, and the rate at which he
  // can steer it IS his close control: a good technician keeps it tighter through a turn.
  ctrlPull: 0.9, ctrlForce: 15, ctrlSkill: 17,
  // A FIRST TOUCH cushions the ball, it does not kill it dead. Taking possession used to zero the
  // ball's velocity outright, so every reception began with a stationary ball and a man walking over
  // to it -- that is the stopping and thinking -- and then a full-power touch to get it going again,
  // which is the slingshot. He now takes the pace off it and rolls it into his stride.
  ftKeep: 0.32, ftMax: 4.5, ftAhead: 1.1,
  // How CLEAN the touch is, which is the whole of a first touch. Taking the ball used to be binary:
  // anything that came within reach, at any pace, from any angle, was instantly his and instantly
  // redirected along the way he was facing -- the ball snapping onto him from a metre away. It now
  // depends on how far he had to stretch, how hard it arrived and what his technique is. At his feet
  // he sets it exactly where he wants; at the limit of his reach he gets a toe to it and it keeps
  // going roughly where it was already going. Below ftFail it is not a touch at all: it squirts on
  // and it is anybody's ball.
  // Checking his run for a ball that has arrived behind him: how much of his pace he sheds, and how
  // far behind him it has to be (metres of his own direction, so 0 is level with him).
  ftCheck: 0.30, ftCheckDot: 0,
  ftStretch: 0.55, ftHot: 18, ftPace: 0.5, ftFail: 0.30, ftSquirt: 0.5, ftSquirtArc: 1.2,
  // ---- the ball is its own object -----------------------------------------------------------
  // It is never attached to anybody. A man in possession pushes it ahead of himself and runs onto
  // it, which is what dribbling IS, and a defender takes it by getting to the BALL -- not by winning
  // a dice roll three metres away from the man. Before this, "possession" was a flag: the ball was
  // teleported to a player's feet and stayed glued there, so a tackle could only ever be a
  // probability, a dribble could only ever be a status, and a defender's effective reach was the
  // 3.2 m at which that roll was allowed to fire.
  touchR: 1.05,        // how near the ball you have to be to play it
  touchZ: 1.6,         // and how low it has to be
  touchStick: 0.55,    // head start, in metres, for the man already running with it
  // Dribbling is a CONTINUOUS force, not a series of punts. Knocking it a fixed 3.4 m ahead at his
  // own pace plus two and a half metres a second meant the ball simply outran him -- it was always
  // quicker than he was until it had drifted past the range he could keep it in, so nobody could
  // dribble at all. He now keeps NUDGING it: it travels at his pace a stride in front of him, and he
  // can only correct it as fast as his technique allows. Turn sharply and it takes a moment to come
  // round with you. That is the degree of stickiness -- it is not attached, it is being controlled.
  // How far behind the ball he runs. This MUST be inside contact range (bodyR + ballR = 0.39) or he
  // settles into a spot he can never touch the ball from, and pursuit then faithfully matches the
  // ball's speed of zero -- man and ball at rest, half a metre apart, which is the stall exactly.
  dribTrail: 0.25,
  // Pursuit. How hard he closes the remaining gap, in 1/seconds: at 2.6 a metre of lag is worth
  // 2.6 m/s of extra pace. This is the term that replaces the arrival ramp for the man on the ball,
  // and it is why his speed no longer depends on how near his own target happens to be.
  pursueGain: 2.6,
  // How near the ball he settles, and how hard he can brake to do it. standoff MUST sit between
  // bodyR + ballR (0.39, where the collision starts shoving the ball around) and reach (0.70, where
  // he can still control it) -- that band is the only place a man can run with the ball in front of
  // him rather than under his feet.
  // Swept together: with a weak brake and the ordinary contact-normal ejection there were 20
  // sustained moonwalks a match, the longest a full second of a man gliding backwards with the ball
  // stuck to him. At 0.45 / 3.0, with the ball always knocked out in front, there are none -- and
  // completion and shots are unchanged, so it costs nothing.
  standoff: 0.45, recvBrake: 3.0,
  dribLead: 1.7,       // how far in front of his feet the ball sits at a walk
  dribLeadV: 0.24,     // and how much further per m/s of pace, so a sprinter pushes it out ahead
  dribPull: 3.4,       // how hard the ball is drawn toward the spot in front of him
  dribForce: 5.8,      // how much he can change the ball's velocity per second...
  dribSkill: 7.0,      // ...plus what his technique buys him
  touchWin: 0.35,      // how much of an edge strength buys in a shoulder-to-shoulder for a loose ball
  // How much further a good tackler gets a foot in, in metres, when challenging a man in possession.
  // The carrier holds it out at touchStick + strength; this is the other half of that duel, and the
  // only channel `tackle` has ever had.
  tackleReach: 0.35,
  // How far the ball may get from him before it is no longer his. It has to exceed touchLen, or he
  // loses possession on his OWN touch every time he knocks it forward -- which is exactly what
  // happened: completion fell to 39% because every dribble became a loose ball.
  touchKeep: 4.6,
  // You cannot receive your own pass. The pickup test asks how near a man is to the ball's PATH this
  // slice, and that path begins at the kicker's feet -- so he sat zero metres from it and swept the
  // ball straight back up before it had gone anywhere. Measured: 82% of all passes were re-collected
  // by the man who struck them, one slice later, with the ball 0.6 m away. Every symptom came from
  // here -- the pass line drawn with no pass behind it, seven per cent of passes reaching a team-mate,
  // and a match in which the ball only ever neared a goal because one man walked it there.
  // How many touches back the assist search may look. Long enough to cross a passing move, short
  // enough that it never reaches into a previous phase of play.
  tlogMax: 8,
  // MATCH RATING deltas, on the abstract sim's scale so the two engines agree about what a 7 means.
  // rateGoalXgW is how much of a goal's credit is taken back for it having been an easy one;
  // rateGoalXgDef is what a goal with no shot attached to it is assumed to have been worth.
  rateGoal: 0.9, rateGoalXgW: 0.4, rateGoalXgDef: 0.3, rateAssist: 0.6,
  rateSave: 1.3, rateConcede: 0.18, rateConcedeDef: 0.06, rateOwnGoal: 1.0,
  rateYellow: 0.3, rateRed: 1.5, ratePenWon: 0.4, ratePenGave: 0.6,
  // PHASE B: what only a positional engine can see. rateError is the giveaway that led to the goal
  // and rateErrWin is how long, in slices, it stays his fault. The rest are the ways a defender is
  // finally able to GAIN, which is the whole reason the position means were 0.42 apart.
  rateError: 0.8, rateErrWin: 32, rateBlock: 0.12, rateClear: 0.05, rateKeyPass: 0.15,
  // PHASE C. rateFullFrac is the share of a match a man has to play before his rating is taken at
  // face value; below it he is pulled back toward par. ratePos is the positional par itself,
  // calibrated off test/ratings.mjs -- re-derive it if any delta above changes.
  rateFullFrac: 0.667,
  ratePos: { GK: 0.10, DEF: -0.05, MID: -0.22, FWD: -0.42 },
  kickLock: 3,
  // How much a fast ball shrinks an outfielder's reach. A struck shot is not controllable at arm's
  // length -- at a flat 1.7 m a twenty-metre shot swept a 68 square-metre corridor and somebody in
  // the crowd absorbed six of every ten before they reached the goal.
  fastDodge: 0.62, fastDodgeV0: 12, fastDodgeV1: 26,
  // THE AIR. headBase..headBase+headSpan is how high a man can get to the ball, by strength -- there
  // is no height attribute and strength already means "how big is he". Everything above his own
  // ceiling passes over him, which is what a flat 1.6 m used to do to all twenty-two at once.
  headBase: 1.80, headSpan: 0.80,
  // Above headMinZ he is heading it rather than touching it: reach stops being a boot's span and
  // becomes how well he gets up, scaled headLo..1 by strength. That IS the aerial duel.
  // Swept over headMinZ 1.25/1.50/1.70/1.90: headers a match come out at 30 / 22 / 15 / 11 and pass
  // completion is FLAT at 75-77% across all of them. A 68% reading that looked like headers knocking
  // ordinary passes clear was regress at six matches, not an effect. 1.50 is chest-high: below it he
  // controls it, above it he heads it.
  headMinZ: 1.50, headReach: 0.62, headLo: 0.55,
  // What a header DOES. Inside headShotR of the goal he is attacking he heads it at goal; anywhere
  // else he heads it away from his own. headV is how hard, before strength scales it -- a header
  // travels a fraction of what a struck ball does.
  headShotR: 12, headAim: 0.55, headV: 12,
  // How far a header travels. Inside clearDepth of his own goal it is a clearance, aimed away;
  // beyond it, a knock-down aimed at the best man he can reach within headOut * 1.4.
  headOut: 18,
  // A ball slower than this, arriving barely above headMinZ, is one a footballer kills rather than
  // heads. Diagnostic only until the header gate reads it.
  headSlowV: 7, headSlowLift: 0.45,
  // How high the ball must STILL be one slice from now for heading it to be the only thing on.
  // Zero is not a no-op: it excludes the ball that will already be on the floor by the time he would
  // have headed it, which is 40% of the population. Swept 0 / 0.2 / 0.4 / 0.6 -> headers 12.3 / 10.4
  // / 8.7 / 6.6 a match against a 12-15 target, and knock-downs retained by the heading side
  // 41.1% / 49.5% / 56.2% / 41.8% against a real 35-50%. Zero is the only cell with both in band.
  headHoldZ: 0,
  // ...but a man throwing himself in front of a SHOT is not trying to trap it, he is trying to be in
  // the way, and he does not need a controlling touch to do it. Shrinking his reach to 0.7 m on a
  // struck ball meant nothing was ever blocked: about a third of real shots never reach the keeper,
  // and here they all did.
  // Swept against the share of shots blocked: 1.55 gave 39%, 1.25 gives 28%, 1.05 gives 21%. Real
  // football blocks about 25-30%. At 1.55 a defender swept a 3.1 m corridor -- five times his own
  // body -- so almost nothing got through a crowded box and the shot count was inflated with efforts
  // that were never going to arrive.
  blockReach: 1.25,
  // The man on the ball is a PLAYER, not a state machine. He steers like everyone else; having the
  // ball costs him top speed and nothing else. Before this he was excluded from the movement system
  // and could only shuffle 0.14 m per slice -- measured, 84% of all ball-possession time was
  // somebody walking at 0.56 m/s, which is the "slow nudging" that made the match unwatchable.
  carrySpeed: 0.86, carryLook: 6,
  // Running onto one. strideT is how many touches the momentum survives, strideVTol how far the
  // ball's pace may miss his before he has to check, strideMinV the speed below which he is not
  // running onto anything, and strideTouch what the worst technician in the game still gets.
  strideT: 3, strideVTol: 7, strideMinV: 2.2, strideTouch: 0.55,
  // How far BEYOND the ball the carrier is aimed, along the line he has picked. Zero is a target
  // on the ball itself, which is not a bearing at all -- see meShape. Too far and the run stops
  // being a dribble and becomes him leaving it behind, so it is swept, not guessed.
  carryAim: 2,
  // He commits to a direction and runs with it for about a second before looking up again, and
  // turning costs him. Re-solving an eight-way argmax every quarter-second in a steep value field is
  // what made him shuffle: measured, the steering reversed by more than 90 degrees on 13% of the
  // slices a man had the ball, which on screen is a player dribbling back and forth in the box.
  carryCommit: 4, carryVal: 3.2, carryAvoid: 0.075, carryTurn: 0.012,
  // How fast he can change the line he is taking the ball ALONG, in radians per slice, and how much
  // running hard takes off that. A footballer rearranges his feet to keep the ball in front of him:
  // he cannot knock it across his own body at a sprint. The touch angle used to snap straight to a
  // freshly picked direction while his momentum carried him the old way, and the ball was left
  // behind him -- he was dribbling backwards.
  dribTurn: 0.60, dribTurnV: 0.42,
  // How far across his own line he can PUT the ball, in degrees, and the pace at which he is squeezed
  // down to the tight figure. Nobody knocks the ball thirty degrees across himself at a sprint --
  // traced, his intended line and the way he was actually running sat 33-40 degrees apart for as
  // long as he had it, and the ball went with the line while he went with his body.
  touchOffWide: 180, touchOffTight: 30, touchOffV: 6,
  // What running it over each line costs him, against a carry worth up to 0.83. Seen from outSee
  // metres out, so he drifts away from a line rather than swerving at the last moment.
  outSee: 9, outThrow: 0.06, outGoalkick: 0.12, outCorner: 0.45,
  // ...and what a direction that is simply OFF the pitch costs. Large enough that no carry value
  // can outbid it, so the search always resolves onto the grass instead of returning nothing.
  outHard: 4,
  // How far along his own dribble line he is held to the pitch, and how far inside the line the
  // clamped aim point sits. dribEdge is roughly the ball's roll over one commit window.
  // Swept over 0 / 3 / 4.5 / 6 / 8. Carried-out balls fall 5.6 -> 4.3 by 6 m and only to 3.8 by 8,
  // and 6 is where the regression turns over: it takes pass completion 74% -> 79% and block depth
  // under siege 15.2 -> 18.8 m, both into range, where 3 leaves both short.
  dribEdge: 6, dribEdgeM: 1.0,
  // Below this much of "the ball is the way I am facing" he has overrun it, and recovering it is the
  // whole of his next action. -0.2 is about a hundred degrees off his line.
  dribBehind: -0.2,
  // You cannot be offside with the ball at your feet. The dribble search applied the offside line to
  // the CARRIER, so on 23% of on-ball slices every forward direction was illegal and a man with
  // twenty metres of grass in front of him could only go sideways or backwards.
  carrierOffside: false,
  // A touch budget rather than a mandatory stop. He may play it on any slice; a first-time ball is
  // harder to strike, and being closed down makes him release SOONER, not later. The old rule had a
  // pressed player dwelling 6 slices against a free player's 4 -- exactly backwards.
  holdBase: 5, holdPress: 1.4, actNow: 0.10, firstTouchNoise: 1.75,
  // How much a spot being OWNED is worth, on top of where it is. 0 reproduces the engine that
  // had no idea where the opponent's shape was. Kept a dial rather than a rewrite because this
  // is the value surface every calibrated number in the file sits on.
  // 0 -- MEASURED AND REJECTED, kept as a dial so nobody has to run this again. Wiring meCtrl
  // into the value surface was meant to create matchup structure: in isolation it plainly
  // works, the direct-vs-high-line gap going +0.054 to +0.291 to +0.561 across 0/0.40/0.60.
  // In the round it does nothing. Five archetypes, fifteen cells, measured at 0, 0.20 and
  // 0.50: real interaction came out 0.000 every time, with the residual spread BELOW the
  // measurement noise in all three. It rebalances the ladder -- Counter +0.245 to +0.153, and
  // width finally beats a block -- but it buys no matchup, and it costs half a goal a match
  // that has to be bought back through xgK, which is not the clean conversion dial it looks.
  // The likely reason a meta does not appear is not spatial blindness at all: brain.ts
  // re-solves the whole shape every tick, so no side is ever COMMITTED to anything long enough
  // to be exploited. That would be inertia, and it is a far deeper change than a weight.
  valCtrlW: 0,
  // WHAT BEING DISCIPLINED BUYS. A man who is not looking to beat anyone is SET TO RELEASE, so
  // his first touch is cleaner; one looking to run at people is not, so his is worse. Scales
  // firstTouchNoise by the instruction, which makes the axis a trade in BOTH directions instead
  // of a licence at one end and a fine at the other. Measured paired on xG at 60 fixtures a
  // cell: -1 goes from -0.206 to -0.022, +1 stays a modest +0.026. 0.60 works too but widens
  // the bars and pushes +1 back out to +0.079.
  dribTouch: 0.35,
  // TEMPO, on two channels so neither end is a flat tax -- the mistake dribbling: -1 made, where a
  // shortened budget met a dwell charge measured from natBase and so bought nothing at all.
  // Quick: less time on the ball AND a firmer pass that arrives before the lane shuts.
  // Slow:  more time to find the right ball AND a softer, safer weight into feet -- paid for by
  // press rising while he dwells and dwellDrop compounding, which is where a slow side's cost has
  // always come from. Both values pending the +/-1 measurement; nothing stamps tempo yet.
  // tempoNoise stays 0: the aim cone was the first idea and stamina is the better one. Kept as a
  // hook in case quick tempo still needs an immediate cost on top of the deferred one.
  // tempoDrain 0.30, calibrated so tempo is a CHOICE and not a default. At 0 Much Quicker was worth
  // +0.292 xG for nothing; at 0.22 the extremes were neutral but +1 still read +0.198, which is the
  // reason to test every rung rather than the ends. At 0.30 all four sit within a quarter of a
  // standard error of zero: -0.019, -0.013, -0.024, -0.024.
  // Slow is untouched at every setting -- the Math.max(0, ...) clamp means negative tempo never
  // reaches the drain term, so its neutrality is structural rather than tuned.
  // End-of-match stamina runs 83 / 75 / 68 / 60 across the drain sweep: smooth, so this is a price
  // paid across ninety minutes, not a collapse after the hour.
  tempoHold: 0.8, tempoPace: 0.10, tempoNoise: 0, tempoDrain: 0.30,
  // What every extra slice on the ball past that budget costs his chance of keeping it. Geometric,
  // so a man with genuinely nothing on can drive on for another second or two and a man dwelling in
  // his own box runs out of reasons to.
  // Swept: at 0.80 the longest anyone kept the ball was 2.8 s and the match went dead; with no tax
  // at all one man once held it for 18.5 s. At 0.97 he averages 1.2 s on it, 5% of possessions run
  // past 3.3 s, and the longest carry in sixteen matches was 8.8 s -- which is a mazy dribble.
  // THE TAX ON KEEPING IT, and the one lever that makes a carrier take the grass in front of him.
  // Measured, he releases after a median 1.00 s and 91.4% of releases are FORCED by the touch budget
  // expiring -- but raising the budget (holdBase) lengthens his spells while DEGRADING how much of
  // the ground he covers is toward goal, in every cell swept. Easing the dwell tax is the only cell
  // that improves it. 0.97 -> 0.99 -> 1.00: path per spell 5.9 / 6.5 / 7.1 m, of which toward goal
  // 21.1% / 23.2% / 26.2%, spells gaining 20 m or more 2.4 / 3.0 / 4.3 a side, and the population the
  // complaint is actually about -- a man in the opponents' half with a clear twelve-metre wedge ahead
  // who is not moving at goal -- 31.0% / 29.2% / 26.3% of such slices. Removing it entirely reads
  // best there and costs the regression (10/21 against 12), and it would also hand Run At Defence
  // back the free lunch this constant exists to charge for. 0.99 keeps both.
  // WHAT HOLDING ON COSTS. At 0.99 four extra ticks on the ball cost four per cent of retention,
  // which is nothing -- so Run At Defence bought territory for free and the axis was a gradient
  // rather than a tactic: swept at 300 blocked fixtures a cell it read -0.072 / -0.019 / +0.091 xGD,
  // the two ends 3.7 standard errors apart.
  // The thumb on the carry score was not the cause -- zeroing carryInstrW left the gradient WIDER --
  // because the territory comes from dribHold extending the touch budget, and a longer budget was
  // free. This is the price of using it. Swept 0.99 / 0.96 / 0.92 / 0.88 on the isolated axis:
  //   gradient  0.226 / 0.279 / 0.066 / 0.097     fieldX span  5.4 / 4.2 / 3.0 / 3.0 m
  // 0.92 is where it stops being a gradient (0.066 against a standard error of 0.038) while three
  // metres of territory and a dozen passes still separate the ends.
  // AND IT IS NOT SHIPPABLE, because it charges EVERY side that dwells rather than the instructed
  // one. At 0.92 the isolated axis is healthy and the whole game is not: the blocked table went to
  // a spread of 0.523 with GOALS A MATCH AT 2.21, down from 2.77, with shots falling across every
  // style (5.4-10.9 against 7-11) and carries from about 600 to 510. A fifth of the scoring, to
  // convert one axis. Left at 0.99.
  // The lever is real and the diagnosis stands -- dribHold buys territory for free and this is what
  // it should cost -- so the fix has to charge the dwell of a side that ASKED to run at people,
  // rather than everybody's. That means the penalty belongs on the instruction rather than on the
  // global constant.
  // TRIED, AND IT FAILS THE SAME WAY. dwellDrib steepened this drop by max(0, dribbling), so only
  // the side that bought the extra slices paid for them and the neutral game was untouched by
  // construction. Swept on the isolated axis, 90 blocked fixtures a cell:
  //   dwellDrib     0        0.03      0.06      0.09      (span se ~0.085)
  //   xGD span   +0.156    +0.176    -0.137    -0.104
  //   fieldX +1    41.6      38.1      35.7      34.8      (neutral ~38.5)
  //   passes +1      88        98       105       109      (neutral ~103)
  // The territory dies before the edge does. At 0.03 the whole 3.5 m Run At Defence gains is already
  // gone and the span has not moved; at 0.06 the span has flipped but so has the identity -- a side
  // told to run at people now plays DEEPER than a neutral one and passes MORE. Territory parity is
  // near 0.028 and the span crosses zero near 0.047, so no setting buys the trade.
  // WHY ALL THREE ATTEMPTS FAIL: `drb` in decide.ts is a SCORE, never a roll. The carry handler in
  // match.ts returns without reading it, and the only thing that takes the ball off a carrier is
  // meTackle. So charging this number cannot make carrying cost possession, only make him stop
  // choosing it -- carryInstrW, the global dwellDrop and the targeted dwellDrib all removed the
  // option rather than pricing it.
  // THE AXIS IS FLAT NOW, AND NOT BECAUSE OF ANY OF THIS. Re-measured at 180 blocked fixtures a cell
  // after the positioning fix (devRestore, in meShape) landed, it reads -0.018 / -0.009 / +0.028
  // against a standard error of 0.042: a span of 0.046, inside one se end to end, where it was
  // -0.072 / -0.019 / +0.091 at 3.7 se. Delivering the instruction faithfully to the pitch removed
  // the free lunch that four attempts at pricing it could not.
  // The outcome-side lever WAS then tried, since it was the one thing left: a sixth term in
  // meTackle's `angle`, scaling with slices past the touch budget, so a man who has been running
  // with it is easier to dispossess. It reads mp.hold rather than the instruction, so it prices the
  // behaviour and not the stamp, and it is the right shape. It is also strictly harmful here --
  // against the tkwDwell = 0 control on the same seeds it reopened the gradient to 0.261 at six
  // standard errors, pointing the WRONG WAY, with Run At Defence conceding 1.09 against the
  // control's 1.41. Reverted whole; match.ts is untouched.
  // The lesson for the next person: measure whether the defect still exists before fixing it. This
  // one had already been fixed somewhere else.
  dwellDrop: 0.99,
  // Build-up: what a safe ball is worth when nothing forward is on. Higher means more recycling
  // between attacks, which is what real possessions are made of.
  keepBuild: 0.018,
  // What you GIVE UP by playing it. A pass was scored purely on where the ball ENDS UP, so turning
  // away from a shooting position cost precisely nothing -- which is the only reason a man through on
  // goal could ever be found passing backwards. Handing back a good position is a real price and it
  // belongs in the score. Deep in your own half, where every spot is worth about the same, this is
  // near zero and a defender can still recycle freely; it only bites where position is worth having.
  surrender: 0.85,
  // And a hard rule on top of the price, because this one is absolute: a man in a shooting position
  // does not turn and play it BACKWARDS. He shoots, he runs at goal, or he plays somebody else in --
  // he does not hand the chance back. No amount of scoring makes that read as football, so it is not
  // scored, it is simply not on the menu. Square and forward balls stay available: a team-mate in a
  // better position is a real reason to pass, turning round is not.
  // Keyed on the SITUATION, not on the arithmetic. Gated on shot probability alone it missed the
  // two cases that were left -- a man with a clear run at goal from twenty metres whose chance the
  // engine prices at 0.024, below any sensible threshold. He is still through, and he still does not
  // turn round.
  // Two ways of being through, and it is the UNION of them: near enough to goal with a clear sight,
  // OR nobody in front of him at all, wherever on the pitch that happens.
  noBackShot: 0.035, noBackDist: 3, noBackLane: 1.2, noBackRange: 32,
  // A man through on goal may only play a ball that does not advance it if the receiver is properly
  // better off: sideBetter times the sight of goal he has himself, or sideFreer fewer men on him.
  sideAdvance: 6, sideBetter: 1.15, sideFreer: 0.6,
  // Reading a pass into your own man. cutEdge is how comfortably you have to beat him to the ball
  // before stepping in front is worth it -- a coin-flip read is not one a defender makes -- and
  // cutHold is how long the gamble commits you for, in slices. The commitment is what makes it cost
  // something: guess wrong and you are past the ball with your man behind you.
  cutEdge: 150, cutHold: 3,
  // How close the race for a ball has to be before the man it was played to stops pacing himself
  // and simply goes and gets it, in milliseconds of margin over the best-placed opponent.
  contestMs: 400,
  // How far short of the interception point the man going for the ball settles. Putting him exactly
  // on the spot reads as the obviously right thing -- 1.3 m short is further than his own reach, so
  // he has to take another step as it arrives -- but it cost five points of pass completion (83% to
  // 78%) and put three more balls a match out of play; 0.9, 0.7 and 0.5 all measured worse.
  // TRACED, and it splits in two. Standing off is right for a ball still TRAVELLING: it is coming
  // to him, and running onto it is how a man overruns his own pass. It is indefensible for a ball at
  // REST, which is going nowhere and has to be walked onto -- and that half of it was a deadlock,
  // because 1.3 m is outside the 0.6 m at which anybody may touch the ball. A ball that rolled to a
  // stop in that 0.7 m band could not be picked up by anyone, and both sides' designated chasers
  // stood over it having "arrived". Measured: six matches in twelve froze solid and never restarted.
  scrambleStop: 1.3,
  // How near a man COMMITTED to a spot has to get before he counts as arrived. It was 1.6 -- LOOSER
  // than the 1.3 for a man committed to nothing -- left over from set pieces, which take the mp.sp
  // branch above it and have not needed it for a long time. That spare metre and a half is what kept
  // every presser standing off the man he was pressing, and with him the whole defence.
  closeStop: 0.5,
  // Under this, the ball is not going anywhere on its own and nobody stands off it. Also what the
  // stall watchdog counts as a ball that has stopped.
  deadBallV: 1.0,
  // Slices of a ball nobody owns and nobody is moving before the watchdog simply gives it to the
  // nearest man. Two seconds: far longer than any real scramble, far shorter than a lost match.
  stallGrace: 8,
  // Time-to-ball, the two-phase growing circle in closed form (AIfunctions.cpp:499-598): a player
  // drifts on his momentum for 700 ms while his reachable circle grows; only then is he free.
  ttbChangeMs: 700, ttbDrift: 0.35, ttbRadius: 0.28, ttbRadiusV: 0.329, ttbVmax: 0.94,
  // How much of that commitment lag `position` buys or costs, either side of an average player:
  // at 0.50 the best reader commits in 525 ms and the worst in 805.
  ttbAnticip: 0.50,
  // Possession currency (team.cpp:319-326): the contest ratio smoothed hard and slew-limited, so a
  // full swing takes seconds. This is the hysteresis the entire AI keys off.
  possEmaAlpha: 0.118, possSlew: 0.125,
  // TRIED AND REJECTED. The idea was that losing the ball should snap the shape to the defending
  // line instead of fading there over the EMA. It made the transition SLOWER: the losing side kept
  // going forward until slice 5 instead of slice 3. The reason is that the "defending" line is not
  // deeper -- lineD sits 18 m behind the ball and lineA sits 30 m behind it, so the defending shape
  // is actually TIGHTER TO THE BALL, and forcing it on pulled them up the pitch rather than back.
  // The block follows the BALL; right after a turnover the ball is still in the final third, so
  // there is nothing in this blend that can bring a side home before the ball travels. That needs a
  // transition state, not a different blend -- see possLost.
  dropSnap: 1.0,
  // THE TRANSITION WINDOW, in slices, and what a side does inside it. transDrop is how far the
  // block pulls back from where the ball would otherwise put it, at the instant possession is lost,
  // decaying to nothing by transT. possLost scales it: -1 regroups harder, +1 cancels the drop and
  // sends a second man at the ball instead, which is a counter-press. transPush is the mirror for
  // the side that has just WON it, driven by possWon: break now, or keep it and stay compact.
  transT: 14, transDrop: 15, transPressW: 1.0, transPush: 12,
  // How much deeper a regrouping side sits for the WHOLE of the opposition's possession, as against
  // transDrop's pulse. About one step of blkDefLine, so Regroup reads as a line-step lower while
  // they have it and nothing at all while we do -- which is what makes it a transition instruction
  // rather than a second copy of defLine.
  regroupDrop: 7,
  // What Hold Shape adds to riskM for the length of the window: how much dearer losing it is to a
  // side that has just won it and been told to make sure of it. An addend rather than a factor
  // because it stacks with creativity, which is the same quantity for the whole match.
  holdSafe: 0.7,
  // CREATIVE FREEDOM IS OBEDIENCE, and this engine already had the variable: obey is how hard a man
  // takes his orders as against his own read of what is in front of him. Every other channel the
  // instruction had was an expressive-end perk -- an extra runner, a wider shoulder, a discount on
  // losing it -- so Disciplined was an instruction with nothing on the other side of it, and it
  // measured as no instruction at all: 79.8 completion against neutral's 79.6, 50.4 possession
  // against 49.9. Now Disciplined EXECUTES THE REST OF THE PLAN HARDER, which is a benefit rather
  // than the absence of a licence, and Expressive plays what he sees at the cost of the side's shape
  // being what the coach asked for.
  // Swept 0 / 0.15 / 0.30 on the isolated axis at 90 blocked fixtures a cell, reading the gap
  // between Disciplined and neutral: completion 0.6 / 0.8 / 1.5 points and possession 0.8 / 2.1 /
  // 2.9. Monotone, and 0.30 is where the end that used to be invisible is plainly a different side.
  creObey: 0.30,
  // The team defensive line (teamAIcontroller.cpp:91-128): a default height moved by mentality,
  // dragged back by whichever threat is deepest, never below 6 m. The trap band compresses
  // stragglers UP onto the line so the back four holds its stagger while stepping together.
  trapStart: 30, trapStartOff: 20, trapForce: 6, trapBand: 2, trapCaution: 4,
  // Below this the trap stops applying: you do not hold an offside line on your own six-yard box,
  // you drop and get goal-side. The compression was pinning the back four SIX METRES IN FRONT of a
  // ball twenty metres from goal, which is why only 2.2 of ten defenders were ever in the box.
  trapDropBelow: 30,
  // How much the block squeezes as the ball nears our goal. A side defending its box is about 22 m
  // deep, not the 32 m it was holding while under siege.
  // A LOW BLOCK BLOCKS NOTHING. Measured across the whole defensive-line range, shots blocked per
  // match run 4.5 / 4.8 / 4.8 / 4.9 -- dead flat -- and the deepest line concedes 81% of its shots
  // from inside the box against a high line's 67%. Sitting deep is supposed to buy exactly that
  // trade: they have the ball all game and get nothing but distance and blocked efforts. Here it
  // buys neither, which is why defLine measures as a real 0.69 buff. The fix is resistance to
  // entering a crowded area, not more squeezing of the shape -- see the siegeWide experiment.
  // WHERE IT STANDS NOW: the top half of the axis works and the bottom half is inert. Isolated on a
  // Balanced side, 180 blocked fixtures a rung:
  //   defLine   -2      -1       0      +1      +2      (se ~0.045)
  //   xGD    +0.053  +0.032  +0.023  -0.033  -0.076
  //   GA       1.02    1.11    1.08    1.26    1.56
  // Raising the line moves xGD by -0.099 over two rungs; lowering it moves +0.030, inside one se,
  // and GA across 0 / -1 / -2 is indistinguishable. So defLine is a three-rung instruction wearing
  // five, and the deep rungs are what make Catenaccio and Park The Bus the worst styles on the
  // table. It is NOT a delivery problem: passes from own third run 37.3 / 39.2 / 40.9 as it drops,
  // so the side genuinely plays deeper and gains nothing by it.
  // Two of the three candidate causes are now closed. Shot QUALITY is correctly blind to bodies and
  // must stay that way (see meShotP: conditional on a shot, the shooter already found his line) --
  // measured, 5.83 defenders in the box and 3.56 both yield 0.097 xG a shot. And the PASS route is
  // already stopped: Park The Bus allows 0.1 balls into its area against Gegenpress's 3.6.
  // What is left is volume, and it does not respond. Broken down by origin against a Balanced
  // opponent, 60 matches a cell, everything below is what the deep side CONCEDED per match:
  //   defLine   total  open play  dead ball  goals |  from a pass  carried >5m  off a turnover
  //     -2       8.33     6.13      2.20      1.37 |     4.68         0.50          2.75
  //      0       7.57     5.87      1.70      1.22 |     4.58         0.47          2.52
  //     +2      10.02     8.10      1.92      1.88 |     6.23         0.85          2.87
  // Two things fall out. CARRYING IS NOT THE ROUTE -- 0.50 shots a match, 8% of open play -- so the
  // never-rolled carry score is not how a low block gets opened up, and no amount of contesting the
  // dribbler will fix this. 76% arrive from a PASS. And dropping below neutral does not merely fail
  // to help, it HURTS: more shots, more open-play xG, more goals and 29% more dead balls than a
  // neutral line.
  // THE DEAD BALLS ARE INVISIBLE TO THE BALANCE TABLE. out.xgS is incremented in exactly one place,
  // the open-play shot branch in match.ts, so set-piece xG is counted NOWHERE while set-piece goals
  // count in GF/GA like any other. Dead balls are 20-27% of the shots conceded here and deep sides
  // concede disproportionately many, so xGD -- the statistic every balance reading in this file is
  // built on -- is blind to a fifth of the game and blind unevenly across the styles it compares.
  // Fix the metric before tuning anything else on this axis; a deep block may be being judged on
  // three quarters of its own defensive record.
  siegeDepth: 28, siegeSpan: 0.58,
  // Markers when the ball is in and around our box. Four was a midfield number.
  markSiege: 5, markSiegeDepth: 26,
  // In your own box you defend SPACE. Men not on a specific job fill the corridor between the ball
  // and your goal instead of holding a zonal slot. Marking alone cannot do this: the block's shape
  // just mirrors wherever the attackers stand, so with four of them in the area only four defenders
  // followed and the shooter had 0.71 men near him.
  screenOn: 0.30, screenDeep: 0.66, screenMind: 0.44, screenFan: 0.26,
  // Goal-side marking against the SHOOTING POINT (playercontroller.cpp:53-122).
  shootThreshCarrier: 24, shootThreshOther: 8, markBuffer: 4, defK: 1.9, defKMind: 0.6,
  // The second presser (elizacontroller.cpp:326-390). OFF by default: GF's hunter runs to a goal-
  // side CONTAINING point, which in our duty system is what "cover" already does -- ported as a
  // second ball-charger it measured +14 shots a game of loose-ball chaos. huntBase > 0 re-enables.
  huntBase: 0, huntMind: 10,
  // How far a man will travel to close the ball down, inside and outside the line of engagement.
  // The press used to be gated OFF entirely beyond the line, so while a side built from the back
  // nobody was assigned to press at all -- measured, a presser existed on only 31% of slices and
  // somebody was in tackling range on 15%. The line should govern how hard you go, not whether
  // anyone goes.
  engageIn: 30, engageOut: 15,
  // THE HANDOVER. handEngage is jockeying distance: inside it a man who was already pressing counts
  // as ON the carrier and keeps the job against anyone merely nearer. handTake is how close another
  // man must be to have genuinely taken it off him -- close enough to be on the ball himself.
  handEngage: 4, handTake: 2,
  // How deep the ball must be before a block stops sending one man and starts swarming, how many
  // extra go, and how close they have to be already. Same units as engageIn.
  swarmDepth: 26, swarmMax: 1, swarmR: 11,
  // Reading a pass: how late an opponent can be and still be a threat, and over what span of
  // timing the risk runs from nothing to certain.
  riskLateMs: 160, riskSpanMs: 620, riskW: 0.92,
  // How late the RECEIVER may be to the ball and still collect it. A ground ball keeps rolling, so
  // arriving a little after it is not a failure; arriving a second after it is a ball that has run
  // away from him or into somebody else. Judged on the same span the opponents are, so the two sides
  // of the race are commensurable.
  // Swept 120/200/300: the residual bias on balls into space is about -12 points at EVERY setting,
  // so this is not what is left wrong with them -- it only decides how many get played. At 300 they
  // were 17% of all passes, which is several times what a real side attempts.
  rcvLateMs: 200,
  // How much a lofted ball's risk is discounted for being over people's heads. At 0.45 the decision
  // thought a lob was barely half as cuttable as a ground ball; measured, balls lofted out of a
  // side's own third were lost 31% of the time against 17% for everything else.
  riskHigh: 0.78,
  // Force-field terms (elizacontroller.cpp:597-789): the 12-21 m orbit band around the carrier, and
  // a base pull that grows with how far out of shape you already are.
  orbitLo: 12, orbitHi: 21, orbitW: 0.30, basePullW: 0.7,
  // Shot decision knobs, mirrored from decide.ts so sweeps reach them live.
  // What a shot is worth against keeping the ball. At 0.6 a man through on goal preferred a safe
  // ball sideways: real footballers shoot considerably more than the expected-goals-optimal rate,
  // and a chance that is not taken is worth nothing at all.
  xgK: 0.165, shotWorth: 1.0,
  // Below this chance it is not a shot worth taking at all. Set to clear hopeless efforts from
  // 35 m+ (worth about 0.001) without touching real long-range attempts from 20-25 m (about 0.007).
  shotMinP: 0.004,
  // Shooting, as a real kick. Speed is what carries a shot past defenders before anyone reaches it;
  // the error cone is wider than a pass because a shot is struck, not stroked.
  // Where he aims, as a fraction of the half-goal off centre. At 0.25 + 0.60 a decent finisher put
  // it 2.12 m off centre against a keeper whose dive reaches 1.96 m from ten metres -- clearing him
  // by sixteen centimetres, which execution noise swallows. Measured: clean one-on-ones converted at
  // 4.3% against a real 35-40%, and turning the dive off entirely took it to 93%.
  // Swept against clean one-on-ones: 0.25+0.60 with the old dive gave 4.3%, this gives 37%. A poor
  // finisher still rolls it 1.7 m off centre and into the keeper's arms; a good one finds 3.1 m.
  // How far a player's own valuation of an option strays from its true worth, at the bottom of the
  // rating scale; a top player's is barely off. Scores in meDecide run about 0.1 to 1, so this is a
  // large error for a poor player and that is the intention.
  // Swept: 0 / 0.03 / 0.06 / 0.10 / 0.15 gives shots 16.3 / 14.8 / 15.4 / 13.3 / 11.1 and pass
  // completion 77.6 / 75.9 / 74.8 / 71.5 / 67.3. It does what it is for -- a poorer player takes
  // the shot that is not on and plays the pass that is not there -- but completion is already at
  // the bottom of its band before any of it, so this is what the match can currently carry.
  // It is NOT a conversion fix: conversion sat between 32% and 38% at every setting.
  // --- WHAT THE COACH ACTUALLY CHANGES -------------------------------------------
  // A playstyle is an instruction to the players, so it belongs on the DECISION, not on the outcome
  // and not only on where men stand. meDecide already scores every option as gain*P - loss*(1-P);
  // these put a thumb on that scale. Before this, ten of the thirteen instruction axes only moved
  // positions (brain.ts) or resolved outcomes (match.ts), which is why measured on the pitch the
  // styles separated hard on defensive signals and came out BACKWARDS on attacking ones -- Control
  // Possession held less of the ball than Catenaccio, Park The Bus more than Tiki-Taka.
  // The approachPlay thumb on the CLEAR score, extracted from a literal 0.8 so a sweep can
  // reach it. See the gradient note in meDecide.
  apClearW: 0.8,
  styleW: 0.020,
  // The carry choice gets its own weight rather than borrowing styleW, which also drives the
  // approachPlay clear term -- they need to move independently.
  carryInstrW: 0.005,
  // Nudge for a good player, order for a poor one. meMind is the same read-the-situation term that
  // scales judgement error, so a man who cannot see the better option for himself leans harder on
  // what he was told, and an elite player's own read can overrule the touchline. obeyBase keeps even
  // the best from ignoring the coach outright -- meMind saturates at OVR 84, and (1 - meMind) alone
  // would mean every world-class player plays whatever he likes.
  obeyBase: 0.55,
  obeySpan: 0.75,
  // Be More Expressive discounts what losing it costs; Be More Disciplined inflates it. This is the
  // only one of these that touches every option at once, because risk appetite is not a preference
  // between actions, it is how much the downside of any of them weighs.
  // NAMED styleRiskW, NOT riskW: CFG already has a riskW (0.92, the pass-success discount at
  // config.ts:946, packed mid-line with riskLateMs/riskSpanMs). Adding a second riskW silently
  // overrode it and moved pass completion 80.3% -> 65.0% across every match in the game, with the
  // four new keys appearing completely inert on inspection. Object.assign(CFG, {...}) spans 600
  // lines with several keys per line, so grep for a name before adding one.
  styleRiskW: 0.30,
  judgeErr: 0.06,
  // How much of the judgement error is the shared misreading of the situation (one draw per option
  // class) as against per-option scatter. See meDecide: at 0 the old raffle returns in full.
  judgeShare: 0.75,
  // Where in the goal he aims, as a fraction of the half-width out from centre. At 0.55 a good
  // finisher aimed 2.99 m off centre with the post at 3.66 m -- 0.67 m of margin -- and 30% of every
  // shot struck went wide against a real 25%. He is not that brave.
  // Back to 0.42 -> 0.55 once the elevation error was restored: aiming nearer the post is where
  // wide misses come from, and with the height misses working again the two together land the
  // funnel. Swept in test/convsweep.mjs.
  shotAimBase: 0.35, shotAimSkill: 0.55,
  shotV0: 17, shotVSkill: 11, shotNoiseDeg: 3.2, shotNoiseSkill: 7, shotNoisePress: 3.2,
  // HOW BADLY HE CAN GET UNDER IT. At 0.30 the elevation error was worth about +/-0.94 m/s of launch
  // vz, half a metre of height over a normal flight, so with aimZ topping out at 1.68 m the very
  // highest a shot could arrive was 2.67 m and 0.3% of them cleared a 2.44 m bar. Measured by
  // projecting every shot to the goal plane: width misses had a proper tail (99th percentile 12.55 m
  // off centre) and height misses had none at all, so HALF the ways a real shot misses did not
  // exist. That, not the finish and not the keeper, was the missing 11 points of off-target -- and
  // it is why widening the aim cone alone never moved conversion however far it was pushed.
  // ...scaled by the shooter: a top finisher keeps shotElevSkill of it off, a poor one gets all of it.
  // REGRESSION, found late and worth recording: shotElevSkill was added to stop penalties flying
  // over, and it multiplies this by (1 - skill*0.72) -- 0.36 for a good finisher. That quietly cut
  // open-play elevation error to a third and took shots-over-the-bar from 16.1% to 4.1%, which was
  // most of the missing off-target. 1.8 was set BEFORE that scaling existed; this is the same
  // effective error with it. Swept against conversion: 1.8/3.5/5.0/6.5/8.0 -> 24.4/22.5/17.5/15.7/
  // and goals 2.4/2.4/1.8/1.6.
  shotElevErr: 8.0, shotElevSkill: 0.72,
  // Scales the gaussian shot error against the old triangular one. A triangle on [-1,1] has a
  // standard deviation of 0.41, so this keeps the everyday spread comparable while the tail -- the
  // part that actually misses the target -- finally exists.
  shotSigma: 0.42,
  frameBand: 0.35,                 // how near a post or the bar still counts as hitting the frame
  // The keeper as a physical claimant: he dives, and a shot struck harder than he can hold is
  // parried rather than caught -- which is where rebounds come from.
  // A keeper cannot teleport. His reach is arm's length plus however far he can actually dive in
  // the flight time he is given, minus reaction. As a flat 3.5 m he covered the whole goal instantly
  // and shots from outside the box converted at zero -- he saved literally everything.
  // ---- THE KEEPER --------------------------------------------------------------------------
  // His save range IS his reach. It starts at his WINGSPAN -- arms, not a boot, so half again what
  // an outfielder gets -- and grows by however far he can throw himself in the time he has actually
  // had, which is the flight so far minus his reaction. Both ends of that come off his rating.
  // gkDiveV swept on the same test and the cliff is brutal: 3.9 converts 4.3% of one-on-ones, 2.9
  // converts 40%, 2.4 converts 51%. At 3.9 his reach from ten metres was 1.96 m against a shooter
  // aiming 2.12 m off centre -- sixteen centimetres, which execution noise ate every time.
  gkWing: 0.85, gkDiveV: 2.9,
  gkReactSlow: 0.28, gkReactFast: 0.18,      // seconds, worst keeper to best
  // How often he picks the right side as it is struck, worst keeper to best.
  gkReadMin: 0.45, gkReadMax: 0.82,
  // How much extra a long flight buys his read: nothing under gkReadT0 seconds, full value by
  // gkReadT0 + gkReadTSpan. A close-range shot stays a guess however good he is.
  gkReadT0: 0.25, gkReadTSpan: 0.6, gkReadTime: 0.18,
  // How fast he throws himself once he has read it, in m/s, worst keeper to best. This is the dive
  // as a MOVEMENT -- it replaced the old dive-as-reach entirely.
  gkDiveVmin: 6.0, gkDiveVmax: 9.0,
  // How far past his own wingspan still counts as barely moving. Inside this he catches it; beyond
  // it he has had to dive, and a dive is a deflection. Pace does not come into that: a rocket
  // straight at his chest is a comfortable take and a gentle one into the corner is a fingertip.
  // Swept against goals: a step past his arms is still a catch. Tighter and every save is a parry,
  // so the box fills with rebounds and scoring runs away.
  // How near his middle it has to hit him to be gathered rather than parried, and how far off that
  // still counts as getting something behind it. Both measured across his body now, not across a
  // dive that no longer exists.
  // gkCatchDive swept against gkParryPush once `dive` began measuring from his CENTRE rather than
  // from the nearest bit of a capsule. 0.55 / 16 was the best of twelve cells at 25.4% conversion;
  // catching more than this did not help, because the goals left are second balls in an empty box
  // rather than shots he failed to hold.
  gkCatchR: 0.14, gkCatchDive: 0.55,
  // A parry is a MIRROR off his hands, and how much of a hand he got on it is how far he had to go.
  // At a comfortable height he gets a firm palm behind it and the ball comes back off him properly;
  // at full stretch it is fingertips and the ball mostly carries on the way it was going. The floor
  // stops a touch at the very limit changing nothing at all, which would score as a save and then
  // go in anyway.
  // The floor is NOT a taste knob. In v' = v - 2*firm*(v.n)n the normal component comes out as
  // (1 - 2*firm)*v_n, so at firm below 0.5 the ball is still travelling the way it came -- goalwards
  // -- and the keeper has "parried" it into his own net. Half is the break-even for a deflection
  // being a deflection at all, so even fingertips sit just above it.
  // How long after a parry a goal is still that shot's goal rather than an own goal, in slices.
  // How much pace a ball keeps when it comes off somebody who was not trying to control it. At 0.35
  // and against this pitch's friction a deflection travelled about three metres and died, which is
  // why 91% of loose balls came free more than eight metres from a touchline and there were 5.5
  // throw-ins a match against a real 40-50 -- the ball simply never got near the line.
  deflectKeep: 0.35,
  deflectWin: 12,
  gkParryFloor: 0.55, gkLiveV: 8,
  // A keeper at full stretch, fingertip to toe, is about 1.9 m: gkSpan is the half of that either
  // side of his middle. It opens up with how hard he is going -- nothing at a standstill, all of it
  // at gkSpanV1 -- because a man standing on his line is a body and only a man in the air is a span.
  gkSpan: 0.95, gkSpanV0: 3, gkSpanV1: 6,
  gkHoldOut: 0.5,     // how far in front of him the ball sits while he holds it
  gkHigh: 2.5,        // how high a ball a keeper can still claim; an outfielder is capped at 1.6
  // Where the keeper stands: on the line from the goal centre to the ball, stepping out to narrow
  // the angle. He used to track the ball only 22% laterally, which put him three metres the wrong
  // side of a shot from the left -- invisible while saves were dice, fatal once they were not.
  ...SP,
  gkOutMin: 0.7, gkOutK: 0.26, gkOutMax: 6.5,
  // How far off the centre of his goal he may shade. Clamped to the width of the posts he could not
  // get across to a ball out wide -- he was never actually between it and the goal.
  gkSide: 5.5,
  // The finisher term in meShotP: base + shoot/99 * skill. Anchored at a 75-rated striker
  // (shoot ~0.85 on /99): base + 0.85 * skill = 1.28, the value everything was calibrated against.
  shotFinBase: 0.60, shotFinSkill: 0.80,   // swept 0.18-0.80: no effect on the band gradient
  // HOW A FIXTURE VARIES BETWEEN STAGINGS. lineJit is the most a man's kickoff position may sit off
  // his formation slot, in metres, drawn triangular so the typical offset is about a third of it --
  // his SLOT is untouched, so the shape and everything built on it are unchanged. koTakers is how
  // many of the men highest up the pitch might be the one who rolls it. Both are inert unless meInit
  // is given an rng.
  lineJit: 2.0, koTakers: 3,
  // GF's `panic`: how much wider than the real frame a POOR keeper behaves as though his goal is,
  // as a fraction. It drags him toward the middle and concedes the near post, which is what bad
  // goalkeeping looks like from the stand. 0 makes every keeper position identically.
  gkPanic: 0.55,
  // Coming for it. A keeper who never leaves his line is as wrong as one who always does: if the ball
  // is loose in or around his box and he gets there first by a clear margin, he goes.
  // He comes for a ball he can actually GET, at a point that is still near his goal. Judged against
  // the ball's current spot he chased balls that were already leaving, and judged by distance from
  // goal rather than by where he would meet it he was lured a long way out and then beaten. He also
  // commits: once he has gone he keeps going, rather than flip-flopping every slice.
  gkRushR: 17, gkRushEdge: 280, gkRushV: 0.98, gkRushHold: 8, gkMaxOut: 21,
  // Inside his own area he goes for balls he would reach LATER than an opponent: he has hands, he is
  // bigger than the man, and the alternative is watching it roll in.
  gkBoxR: 16.5,
  // Half the width of the penalty area. Used with gkBoxR to ask whether something happened in it.
  boxHalfW: 20.16,
  // THE PENALTY. spPenBack/Spread put the other twenty on the arc: outside the area, behind the
  // ball and more than 9.15 m off it. spPenAim is how near the post he goes, as a fraction of the
  // half-width. spPenRead is the keeper's chance of going the right way -- he commits before it is
  // struck, so it is close to a coin flip and his rating adds only spPenReadSkill on top.
  // spPenRead swept over 500 penalties a cell in test/pensim.mjs, which stands a match up, awards a
  // penalty and throws the match away -- a penalty happens 0.15 times a match, so measuring it in
  // open play gave six per cell and every figure was four-out-of-five noise.
  //   aim 0.72 / read 0.30 -> 58% scored     aim 0.90 / read 0.10 -> 63% scored, 9% off the frame
  //   aim 0.72 / read 0.10 -> 74% scored, 23% saved, against a real 76/19
  // Aiming NEARER THE POST measured worse, not better: the woodwork takes what the keeper does not.
  // Note this is not "which way he dives" -- with the capsule, a correct read is very nearly a
  // certain save, so this number is really his chance of getting it right AND reaching it.
  spPenBack: 10, spPenSpread: 12, spPenAim: 0.72, spPenRead: 0.10, spPenReadSkill: 0.25,
  // How much of open play's elevation error a SET strike carries. A penalty is a stationary kick at
  // a known target with nobody near him and it should be the most accurate shot in the game; a free
  // kick is struck from further out and over a wall, so it sits between the two.
  // Swept over 500 penalties a cell: 1.00 -> 64.4% scored with 5.2% off the frame (the damage that
  // widening open-play elevation did), 0.55 -> 73.8%, 0.30 -> 78.0%, 0.16 -> 77.8%. Real is 76%
  // scored, 19% saved, 2% woodwork. 0.40 sits between the two cells that bracket it.
  spPenElev: 0.40, spFkElev: 0.60,
  // WHAT A DEAD BALL IS WORTH, because until now it was worth nothing. out.xgS was incremented in
  // exactly one place -- the open-play shot branch in match.ts -- so a penalty and a free kick
  // struck at goal counted in out.shots and in the SCORE, and contributed no xG at all. Dead balls
  // are 20-27% of the shots a side concedes and a deep block concedes disproportionately many, so
  // xGD, the statistic every balance reading in this file rests on, was blind to a fifth of the game
  // and blind unevenly across the styles it was comparing.
  // Both figures are this engine's own measured conversion, not an outside model: the penalty from
  // the spPenRead sweep above (74% scored at the shipped aim and read, against a real 76%), the free
  // kick from the 150-match sweep recorded at the shooting branch in setpiece.ts (9.5% and 9.9% at a
  // standard error of 1.2). They are constants because both are the same shot every time -- a
  // distance model for direct free kicks is the obvious refinement and is not needed to unbias the
  // comparison, which is all this fixes.
  // WHAT IT CHANGED, at 360 blocked fixtures before and after. The behaviour table is byte-identical
  // -- possession, territory, passes, tackles, carries, fouls, and goals a match at 2.74 -- because
  // this is a measurement change and moves nothing on the pitch. Only the xGD column moved, and it
  // moved along exactly the axis predicted: sides that WIN dead balls gained (Vertical Tiki-Taka
  // +0.145, Wing Play +0.109, La Nuestra +0.088, Gegenpress +0.076) and sides that CONCEDE them lost
  // (Park The Bus -0.136, Zona Mista -0.122, Control Possession -0.085, Catenaccio -0.074).
  // The spread went 0.486 -> 0.611, so the old metric was under-reporting the imbalance by about a
  // quarter, and flattering the deep styles specifically. Every balance reading taken before this
  // is biased in that direction; do not compare across the fix.
  spPenXg: 0.75, spFkXg: 0.097,
  // THE ARC OVER THE WALL. See meFkArc. zWall is bodyH plus how high the wall gets off the ground;
  // spFkZ..spFkZ+spFkZVar is the band under the bar he tries to drop it into; spFkNear is how much
  // further out than the wall the ball has to be for there to be an arc worth solving at all, and
  // the two speed bounds are what a man can actually put through a dead ball.
  spFkWallJump: 0.35, spFkZ: 1.25, spFkZVar: 0.90, spFkNear: 4,
  spFkVMin: 13, spFkVMax: 30,
  // What a long flight buys the keeper on a free kick, on gkReadT0/gkReadTSpan's ramp. Its own key
  // rather than gkReadTime so a sweep can reach it without moving every shot in open play with it.
  spFkRead: 0.18,
  // HANDBALL: how high the ball has to strike him to be arm rather than body, and how often the
  // referee gives it when it does.
  // Measured by forcing handP to 1: the geometry -- a ball striking an outfielder above waist
  // height, inside his own area, off an opponent's touch -- comes up about 1.1 times a match, so
  // 0.06 of them given is the real rate of roughly one handball penalty every fifteen matches.
  handMinZ: 0.85, handP: 0.06, gkRushEdgeBox: -260,
  // How close he gets to a man carrying it in his area before he sets himself. Inside gkSmotherR,
  // so standing him up and taking it off him are the same movement.
  // How far in front of the ball he sets himself when closing a carrier in his area, ON his angle.
  // 1.2 m was tuned when he never actually arrived; once he is given keeper pace and a correct
  // bisector he does, and at 1.2 m the shot is struck inside his own reaction time and beats him
  // every time. Swept 1.2 / 2.2 / 3.2 / 4.5: conversion 15 / 14 / 11 / 14%, and 3.2 also reads best
  // on the angle itself at every percentile.
  gkStand: 3.2,
  // HANDS. In his own area, and only when the last man to touch it was NOT a team-mate, he picks it
  // up -- and once it is in his hands nobody can take it off him. That makes collecting it the
  // safest thing he can possibly do, so he goes for those balls even when he would arrive after an
  // opponent: the alternative is a contest, and this is not one.
  gkRushEdgeHands: -260,
  // Outside his own area a keeper is not a footballer. He clears it, or plays it somewhere safe --
  // he has nothing behind him and no hands to use.
  gkSafeOut: 16.5,
  // A parry goes AWAY from goal -- wide and up the pitch. It used to be knocked to a random point in
  // a fourteen-metre square, which is where deflections that made no sense came from: a keeper could
  // palm the ball back toward his own net.
  // A parry REFLECTS: angle in, angle out, about the line from his hands to the ball, plus however
  // hard he pushes it away. It used to be knocked in a fixed "away and wide" direction regardless of
  // where the shot came from, which is why the angles never matched the shot that produced them.
  // gkParryPushV scales the shove with how hard the shot arrived. TRIED AND MEASURED: it does not
  // move the parry-into-net rate at all (15% before, 17% after), so it is off. Whatever is putting
  // parries into the net is not the size of the shove.
  gkParryPush: 16, gkParryPushV: 0, gkParryE: 0.55,
  // And once it is STRUCK he goes where it is actually going. Standing on the goal-centre-to-ball
  // line is the right place to be before the strike; after it he is a post. Measured in isolation
  // the aim point sits about 2.6 m off centre while he stayed on centre, so he was permanently a
  // few centimetres outside his own dive radius and saved essentially nothing from any range.
  gkLineOut: 0.9, gkScramble: 1.25,
  // A keeper smothers. He was excluded from the challenge loop entirely, so a carrier could dribble
  // the ball past him into the six-yard box unopposed -- which is where every shot was coming from.
  gkSmotherR: 2.6, gkSmotherP: 0.34,
});

// A side with no instructions set. The engine owns this rather than importing the app's STRAT_DEF,
// which is what keeps the dependency one-way: the UI imports the engine, never the reverse.
export const NO_INSTRUCTIONS = { passingDir:0, chanceCreation:0, pressingLOE:0, defLine:0, possWon:0,
  approachPlay:0, dribbling:0, creativity:0, timeWasting:0, possLost:0, gkDist:0,
  dlBehavior:0, tackling:0 };

// COHERENCE: BUILT, MEASURED, NOT SHIPPED. The real bug it was aimed at is still here and is worth
// restating, because it explains most of the balance table. This engine's rule is that instructions
// move the SCORES and never the success rolls, and the engine then takes the highest-scoring option
// -- so if the evaluation is honest, the UNMODIFIED choice is already the best one available and
// every instruction by construction makes it pick something it rated worse. The rule was written to
// stop instructions being free buffs and it overshot into making them guaranteed debuffs. That is
// why an all-zero stamp finished mid-table against thirteen designed systems, why damping a weak
// style toward zero improved it by 0.2 to 0.5 goals, and why squad fit -- whose only effect is
// damping toward zero -- measured as a REWARD for not having the players for your system.
//
// The attempt: score each stamp for internal consistency over nine authored axis pairs (a high line
// wants a high press; sit deep and BREAK or hold high and keep it; direct passing wants width and
// early shots), then spend that as its own term in meKickBall's aim cone beside pressure and tempo.
// A side with no instructions scores exactly zero and is byte-identical, which would have made "no
// plan" the floor by construction instead of by being nerfed into one.
//
// Why it is not in the tree: measured blocked, 80 fixtures a style, coherence on against off with
// identical seeds. Correlation between how coherent a style is and what coherence was worth to it
// came out 0.53 with a slope of 0.61 goals -- but exactly ONE style moved in the predicted direction
// above two standard errors (Catenaccio, +0.76), one moved AGAINST it above two (Zona Mista, -0.53),
// and the least coherent style in the game gained nearly as much as the most coherent (Park The Bus,
// +0.45 on a coherence of 0.125). Balanced did not sink, which was the entire point.
// The idea is probably right and the aim cone is probably the wrong channel to spend it through.
// Re-attempt it somewhere with more leverage than pass accuracy, and keep the blocked design.

// A SIDE THAT DRILLS SOMETHING GETS GOOD AT IT.
// This reverses the engine's oldest rule, deliberately. That rule -- instructions move the SCORES
// and never the success rolls -- was written to stop instructions being free buffs, and it worked so
// well that it made them guaranteed debuffs: the engine takes the highest-scoring option, so if its
// evaluation is honest then the UNMODIFIED choice is already the best available and every
// instruction makes it pick something it rated worse. Measured, that is exactly what happened. An
// all-zero stamp finished mid-table against thirteen designed systems, damping a weak style toward
// zero improved it by 0.2 to 0.5 goals, and squad fit -- whose only effect is damping toward zero --
// came out as a REWARD for not having the players for your system.
//
// The design now is the other way round. Setting an instruction is a small competence gain in the
// thing you set, because a side that has drilled something is better at it. Nothing is earned for
// agreeing with yourself, so there is no stacking bonus; what a contradiction does is take some of
// it back. A side with no instructions collects nothing and is therefore the floor by construction,
// which is the point -- "no plan" should be the worst plan, not the safest one.
//
// Spent as effective rating rather than through the aim cone. The first attempt spent it on pass
// accuracy and it had nowhere near enough leverage: blocked over 80 fixtures a style, exactly one
// style of fourteen moved in the predicted direction above two standard errors, one moved against
// it, and Balanced did not sink at all. Rating is the channel this engine actually turns into
// goals, it is already measured at 0.077 goals a point, and meInit already applies a rating nudge
// for home advantage, so it is the same code path.
export const ME_AXIS_MAX = { defLine: 2, pressingLOE: 2, passingDir: 2, width: 2, tempo: 2,
  approachPlay: 1, chanceCreation: 1, creativity: 1, dribbling: 1, possLost: 1, possWon: 1,
  tackling: 1, timeWasting: 2, gkDist: 1, dlBehavior: 2 };

// WHICH INSTRUCTIONS FIGHT EACH OTHER. This is an opinion and the only one in the engine -- it says
// what this game thinks good football is, and it is the right thing to argue about. It is used for
// the PENALTY ONLY: a pair that agrees earns nothing, because the two instructions were already
// each paid for on their own.
//   +1  the two agree when they point the SAME way, so opposite directions are the contradiction
//   -1  the two agree when they point OPPOSITE ways
export const ME_CLASH = [
  ["defLine", "pressingLOE", 1],      // press where you defend from, or do neither
  ["defLine", "possLost", 1],         // a high line counter-presses; a deep one drops off
  // Gated to deep blocks only. A side that sits in and then KEEPS the ball is the contradiction --
  // measured on Park The Bus, which wins it in the best counter-attacking position in football and
  // takes 39.6% of its shots from turnovers against a neutral line's 44.1%. The mirror is not true:
  // winning it high and going straight at them is what a high press IS, not a contradiction, and
  // an ungated rule charged Vertical Tiki-Taka three rating points for pressing properly.
  ["defLine", "possWon", -1, "neg"],
  // Gated to DIRECT only. Playing it long and then insisting on building from the back is the
  // contradiction. Short passing into space is not -- it is the whole of what "vertical" means in
  // vertical tiki-taka, and an ungated rule charged that style for being itself.
  ["passingDir", "approachPlay", 1, "pos"],
  ["passingDir", "chanceCreation", 1],// hit it long and shoot early, or work it in patiently
  // Gated to SHORT only. Combining in tight spaces needs licence, so short-and-disciplined is the
  // contradiction. Direct-and-expressive is not: getting it wide for a winger to beat his man is
  // Wing Play, and the ungated rule charged it three rating points for having wingers.
  ["passingDir", "creativity", -1, "neg"],
  ["pressingLOE", "tackling", 1],     // a side that presses has to go and win it
];
// REMOVED, both of them my error rather than the stamps':
//   approachPlay vs dribbling -- the single largest clash in the table at -3.00, charged to Park The
//     Bus and Second Ball for playing into space with disciplined dribbling. Balls into space are
//     for RUNNERS. Hit it into the channel, run onto it, do not try to beat a man. Coherent.
//   passingDir vs width -- charged for being direct and narrow, which is a long ball through the
//     middle to a target man. That is Route One, not a contradiction.

// Rating points a side earns for how far it commits, minus what its contradictions cost. Positive
// for any consistent plan, zero for no plan, and negative only for a genuinely self-defeating one.
export function meDrill(st) {
  if (!st) return 0;
  let commit = 0, clash = 0;
  for (const k in ME_AXIS_MAX) {
    const v = (st[k] || 0) / ME_AXIS_MAX[k];
    commit += Math.abs(v);
  }
  for (const [a, b, w, gate] of ME_CLASH) {
    const va = (st[a] || 0) / (ME_AXIS_MAX[a] || 1), vb = (st[b] || 0) / (ME_AXIS_MAX[b] || 1);
    if (!va || !vb) continue;
    // Some rules only run one way -- see the notes on each. "neg" fires only when the first axis is
    // set low, "pos" only when it is set high.
    if (gate === "neg" && va >= 0) continue;
    if (gate === "pos" && va <= 0) continue;
    clash += Math.max(0, -w * va * vb);        // only the disagreements; agreeing pays nothing
  }
  // NEGATIVE OR ZERO, never positive. A side that has drilled a full system plays at its rating; one
  // that has drilled nothing plays below it. Expressed as a penalty rather than a bonus on purpose:
  // a bonus inflates real styles above what their squad is worth, which breaks the rule that squad
  // quality should outweigh system, and that ceiling is what stopped the effect being pushed hard
  // enough to matter. Nothing here lifts anybody -- it only declines to penalise the committed.
  const drilled = Math.min(CFG.drillCap, commit * CFG.drillOvr) - clash * CFG.clashOvr;
  return (Math.max(0, drilled) - CFG.drillCap) * CFG.indecision;
}

// WHAT A STYLE IS TRYING TO DO, rather than what it prefers.
// The engine scores every option with one global utility and takes the argmax, and that utility is
// well calibrated and exactly ONE MOVE DEEP. Those two facts together are why a side with no
// instructions finished mid-table against thirteen designed systems: it plays the argmax of the
// engine's own definition of good football, and every instruction moves it off a maximum. No
// coefficient fixes that. It is the shape of the thing.
//
// It is also why possession football cannot move the ball. A short-passing side gains 5.3 m of
// ground per forward pass where Gegenpress gains 14.0, because a greedy scorer looking at eight
// metre options takes the safest one and the safest one is sideways. That pass is not wrong -- a
// square ball is the first move of a switch, a cutback, a third man through the seam -- but its
// worth lives three actions later and a one-move utility cannot see three actions later.
//
// A pattern is that missing knowledge, and it is what a tactical system actually is: the manager
// knows what comes next and the player choosing greedily does not. Nine zones, three depth bands by
// three lateral, in attacking orientation. A pattern says moving the ball from this zone to that one
// is worth more than it looks. Balanced declares NOTHING, plays one move deep, and is last by
// construction rather than by penalty.
export function meZone(dGoal, y) {
  const depth = dGoal < 35 ? 2 : dGoal < 70 ? 1 : 0;   // 0 own third, 1 middle, 2 final
  const lat = y < 20.4 ? 0 : y > 47.6 ? 2 : 1;         // 0 left, 1 centre, 2 right
  return depth * 3 + lat;
}
// [fromZone, toZone, worth 0..1]. Zones: 0-2 own L/C/R, 3-5 middle L/C/R, 6-8 final L/C/R.
export const ME_PATTERN = {
  // Combine through the middle, and switch to move them before you do.
  tikitaka:      [[4,7,1.0],[3,5,0.6],[5,3,0.6],[3,4,0.5],[5,4,0.5]],
  possession:    [[4,7,0.9],[3,5,0.7],[5,3,0.7],[3,4,0.5],[5,4,0.5]],
  lanuestra:     [[4,7,0.9],[3,4,0.6],[5,4,0.6],[6,7,0.6],[8,7,0.6]],
  // Straight through the seam, fast.
  verticaltiki:  [[4,7,1.0],[3,7,0.8],[5,7,0.8],[1,4,0.5]],
  gegenpress:    [[4,7,0.9],[6,7,0.8],[8,7,0.8],[3,7,0.6],[5,7,0.6]],
  // Get it wide, then cut it back. The cutback is the whole style and nothing priced it.
  wingplay:      [[4,6,0.8],[4,8,0.8],[6,7,1.0],[8,7,1.0],[3,6,0.5],[5,8,0.5]],
  // Skip the midfield entirely; win what comes off it.
  routeone:      [[1,7,1.0],[4,7,0.8],[0,6,0.6],[2,8,0.6]],
  secondball:    [[1,7,0.9],[4,7,0.7],[6,7,0.7],[8,7,0.7]],
  // Absorb, win it deep, release into the channel.
  catenaccio:    [[1,6,0.9],[1,8,0.9],[0,3,0.6],[2,5,0.6],[4,7,0.5]],
  counterattack: [[1,7,1.0],[3,7,0.8],[5,7,0.8],[1,6,0.7],[1,8,0.7]],
  parkthebus:    [[1,6,0.8],[1,8,0.8],[0,3,0.5],[2,5,0.5]],
  cholismo:      [[1,4,0.6],[4,7,0.8],[3,7,0.5],[5,7,0.5]],
  zonamista:     [[4,7,0.7],[1,4,0.6],[3,4,0.5],[5,4,0.5]],
  // balanced: deliberately absent. No plan, no lookahead.
};
// Flattened once at module load: from*9+to -> worth.
export const ME_PAT_MAP = Object.fromEntries(Object.entries(ME_PATTERN).map(
  ([k, rows]) => [k, new Map(rows.map(([a, b, w]) => [a * 9 + b, w]))]));

export const DEFAULT_OVR = 60;

// THE MANAGER ON THE TOUCHLINE. Every instruction in this engine is read fresh off s.strategy on
// every tick, in brain, decide, match and setpiece alike -- and until now nothing ever wrote to it.
// meStrategyFor ran once at kickoff and that was the side's football for ninety minutes. A team
// losing 0-1 at 85 played exactly as it had at 0-0 in the first minute: it never pushed the line up,
// never went more direct, never stopped running the clock down. Protecting a lead did not exist
// either, which is the likeliest reason the two styles built to do nothing else sit at the bottom of
// the balance table. Catenaccio and Park The Bus had no mechanism for the one thing they are for.
//
// ds and as are MINUTES OF SHIFT on the clock a side reads, lifted from the abstract sim's autoTac
// so the fourteen styles keep the reactions they were tuned with. ds positive means this style
// starts protecting a lead that many minutes earlier than neutral; as positive means it starts
// chasing that many minutes earlier. ceil and floor cap how far it will ever go either way, so Park
// The Bus will not throw everybody forward however far behind it gets and La Nuestra will not park.
// bias is where the style leans with the game level.
export const ME_CHASE = {
  gegenpress:   { ds:-12, as: 10, ceil:2.0, floor:-1.5, bias: 0.15 },
  verticaltiki: { ds: -6, as:  6, ceil:2.0, floor:-1.5, bias: 0.15 },
  wingplay:     { ds: -5, as:  5, ceil:2.0, floor:-1.2, bias: 0.20 },
  lanuestra:    { ds:-14, as: 11, ceil:2.3, floor:-1.0, bias: 0.20 },
  secondball:   { ds: -3, as:  6, ceil:2.0, floor:-1.5, bias: 0.05 },
  routeone:     { ds:  0, as:  5, ceil:2.0, floor:-1.5, bias: 0.00 },
  balanced:     { ds:  0, as:  0, ceil:2.0, floor:-2.0, bias: 0.00 },
  tikitaka:     { ds:  3, as: -5, ceil:1.6, floor:-1.5, bias: 0.10 },
  possession:   { ds:  6, as: -8, ceil:1.6, floor:-1.5, bias: 0.00 },
  cholismo:     { ds: 10, as: -6, ceil:1.6, floor:-2.0, bias:-0.20 },
  zonamista:    { ds: 12, as: -8, ceil:1.5, floor:-2.0, bias:-0.25 },
  counterattack:{ ds: 15, as: -8, ceil:1.3, floor:-2.0, bias:-0.40 },
  catenaccio:   { ds: 18, as:-10, ceil:1.2, floor:-2.0, bias:-0.50 },
  parkthebus:   { ds: 20, as:-12, ceil:1.0, floor:-2.0, bias:-0.60 },
};

// Intent is one scalar, positive to chase and negative to protect, and these turn it into football.
// Chasing is the line up the pitch, the press up with it, the ball forward faster, shots taken
// earlier and the clock left alone. Protecting is the line dropped, the press pulled off, the tempo
// killed and the clock run down. One step of defLine is six metres of block (CFG.blkDefLine), so a
// hard chase at 1.5 lifts the line about four metres and a side protecting at -1.0 drops it under
// three: a real shift in where the team stands, not a wholesale change of identity.
//
// Deliberately a shift in WHERE THE TEAM STANDS AND WHAT IT LOOKS FOR, never a multiplier on
// anything that resolves. Pushing up has to be genuinely beatable in behind, and here it is, because
// the space is simulated. That is the one thing the abstract sim could never have priced honestly,
// and it is why this belongs on the positional engine rather than being ported onto the old one.
export const ME_CHASE_W = {
// TRIED AND REJECTED: width 0.40 and possLost 0.45 on the chase, meant as the exposure a desperate
// side leaves behind it -- wide men gone and no drop-off when it loses the ball. Both read as
// exposure and neither is. Over 400 fixtures with the first seventy minutes held bit-identical, they
// cost the chaser 0.054 goals SCORED (0.313 down to 0.259) and moved his goals against by 0.007,
// which is nothing. width widens crowdR at brain.ts:673, so a wider side engages the ball over a
// bigger radius rather than being stretched thin by it, and possLost positive is a counter-press,
// which wins the ball back instead of conceding the break. Two axes that sound like a gamble and
// score like a downgrade.
  atk: { defLine: 0.45, pressingLOE: 0.40, passingDir: 0.35, tempo: 0.40,
         chanceCreation: 0.30, timeWasting: -0.80 },
  def: { defLine:-0.45, pressingLOE:-0.30, tempo:-0.35, timeWasting: 0.80 },
  on: true,     // the A/B switch. The harness flips this to measure chasing against not chasing.
  // Ships at 0, which is every minute of the match. It exists because the obvious A/B is not a valid
  // one: chasing starts long before the seventy-minute mark you want to measure from, so by then the
  // two arms have already diverged and "the side behind at 70" is a DIFFERENT SET OF MATCHES in each
  // (278 against 302 on the first run). Holding the layer off until the snapshot makes everything
  // before it bit-identical, so the arms share one population and the window is a clean comparison.
  fromTick: 0,
  urg: 0.60,    // must-win adds to intent, dead rubber subtracts. Stakes reach the pitch here.
  form: 0.25,   // a side on a run is marginally braver. Small on purpose: form was always ~2%.
  every: 48,    // ticks between decisions, which is one football minute at ME_MATCH_TICKS over 90.
  slew: 0.34,   // fraction of the gap closed per decision, so a change takes about three minutes.
};
// MEASURED, 400 fixtures, identical clubs, styles and seeds, chasing live from the first minute:
//   goals per match          2.82 -> 2.85    it is a reaction, not a goal-printer
//   goals after 70 minutes   0.66 -> 0.58    FEWER, because the side in front now sees it out
//   draws                   22.8% -> 25.0%   real football sits around a quarter
//   four goals or more      30.3% -> 29.5%   the tail does not bloat
//   behind at 70, rescues it  5.8% -> 12.6%  real football is 12 to 15 per cent; 5.8 was nonsense
//
// One thing this does NOT do, and it is worth writing down because two rounds of work went into
// trying: chasing does not cost the chaser goals at his own end. Holding the first seventy minutes
// bit-identical so both arms shared one population, a trailing side that pushed conceded 0.44 -> 0.34
// LESS, and it made no difference which axes did the pushing -- the block half and the on-the-ball
// half each bought about the same drop on their own. The mechanism is possession: a side that
// attacks more has the ball more, and it cannot concede while it has it. Adding exposure did not
// touch it and only cost goals at the other end (see the rejected width/possLost note above).
// That is not a bug to fix here. Chasing SHOULD beat not chasing when you are behind -- nobody sits
// back at 0-1 with fifteen left -- and the trailing side still ends the last twenty net negative
// even at full tilt. If anything is undermodelled it is the counter-attack, which is an engine
// question and a much larger one than the touchline.
//
// PLAYING AT HOME. The abstract sim made this a three per cent bump to effectiveness, and the first
// positional adapter carried that over as HOME_ADV_OVR on every player of the favoured side -- which
// says a crowd makes the goalkeeper better at saving and the striker better at finishing. It does
// not. What a crowd does is push one side up the pitch and pin the other one back, so that is what
// this is: the home side defends from further forward and presses from further forward, the away
// side sits deeper and plays slower. Nobody gets better at football.
//
// Applied in meInit before the kickoff instructions are stamped, so it lands on the baseline the
// touchline manager works out from and a chase stacks on top of it rather than replacing it. Kept
// out of the fit damping on the same reasoning as the chase: where you play is not a claim about
// whether your squad suits the system.
//
// TRIED AND REJECTED: the territorial version, host pushed up the pitch and visitor pinned back.
// It is the obvious model of a home crowd and it does NOTHING. Swept at 0.10, 0.20, 0.30 and 0.45
// over 320 blocked fixtures a row, every magnitude landed inside one standard error of zero with no
// monotonic response: -0.016 goals at the setting meant to be worth a third of one. The reason is
// that pushing up and dropping off are BOTH defensive gains in this engine (see the chase note
// above, where each half of the block bought the same drop on its own), so tilting the two sides in
// opposite directions cancels. A visitor made cautious instead was worth +0.113, and both together
// +0.075, which is worse than either alone; all three sit inside their own error.
//
// What is left is what measured: the host plays with its tail up, quicker and shooting earlier, and
// a rating nudge to carry the magnitude the instructions cannot. Calibrated on the shipped path,
// 320 blocked fixtures a row, goal difference against the same fixture at a neutral venue:
//   behaviour alone      +0.125 (se 0.13)   45.0/20.9/34.1
//   behaviour + 2 ovr    +0.219 (se 0.12)   42.5/23.8/33.8
//   behaviour + 3 ovr    +0.359 (se 0.13)   48.1/19.1/32.8    shipped
//   behaviour + 4 ovr    +0.553 (se 0.13)   50.0/23.1/26.9
//   behaviour + 6 ovr    +0.666 (se 0.12)   51.6/24.1/24.4
// Against a real-football +0.35 and a 45/25/30 home record.
//
// Measure this on the SHIPPED path or not at all. A first calibration bumped the ratings on the
// squad before the match was built, which fed computeRoleFit as well, so the crowd was also making
// the squad better suited to its own system and un-damping its instructions. That read +0.328 for a
// nudge genuinely worth +0.219. The bump belongs after fit is computed, which is where it now is.
//
// It also prices what this replaced: the old adapter's flat 2 points with no behaviour at all sat
// between the rows above at roughly +0.15 goals, under half of real football's home advantage. The
// brute carry was not only blunt, it was badly calibrated, and nobody had ever checked.
//
// k scales the whole thing, shape and rating together, so it is one dial. k=1 is real football.
// Not modelled, deliberately: the referee. Marginal fouls and cards do go the home side's way in
// real football, and it is probably the largest single cause, but a thumb on the whistle is its own
// mechanic and this is not the place for it.
export const ME_HOME_ADV = {
  k: 1,
  ovr: 3,
  host:  { chanceCreation: 0.50, tempo: 0.50, passingDir: 0.40 },
  guest: {},
};

// What the UI could legally set. A chase must not push an instruction somewhere a manager could not.
export const ME_STRAT_RANGE = { defLine:[-2,2], pressingLOE:[-2,2], passingDir:[-2,2], tempo:[-2,2],
  chanceCreation:[-1,1], timeWasting:[0,2] };
