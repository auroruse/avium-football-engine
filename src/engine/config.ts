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
  // THE DEAD-BALL SPECIALIST. spTakerW is how many metres of walking a corner or a shooting free
  // kick is worth handing to a better striker of one -- large enough that fit decides it and
  // distance only separates men of similar quality. spTakerRange is how near goal a free kick has
  // to be before it is a shooting chance rather than a ball to be played quickly.
  spTakerW: 70, spTakerRange: 30,
  // Corners: how many aerial targets are sent up REGARDLESS of distance (the big centre-halves),
  // and how far beyond the aimed man the delivery is flighted so it crosses him at head height
  // rather than landing at his feet -- 3.5 m puts the ball at 1.8-2.0 m over the mark at any
  // realistic corner distance (solved from the loft profile, see meLoftFor).
  spCornerUp: 2, spCrossOver: 2.7,
  // The moment a corner is struck, every attacker in the box breaks goalward on a committed run:
  // metres of dart and slices it lasts. See meSPTake.
  spCornerRun: 4.5, spCornerRunT: 6,
  // How many attackers take the box duty at their own corner (strongest aerial men first, taker
  // excluded). The rest keep ordinary possession duties, which is the rest defence.
  cnBoxN: 5,
  // How many of them must actually BE in the area before the corner is swung in. Below cnBoxN so
  // one man caught upfield cannot hold the kick to its timeout; spMaxTBy.corner forces it anyway.
  cnBoxReady: 4,
  // ...and the DEFENDING side's numbers back before it is swung: the pack needs to arrive or the
  // area is a seven-on-three. The block's corner span while defending one:
  cnDefReady: 6, cnDefDepth: 12,
  // The defending side at an opponent's GOAL KICK stands in nearly its full shape (share of
  // formation depth), front men clamped outside the taker's box -- pressing a goal kick, not
  // retreating to its own half. And at a free kick or throw anywhere upfield, the leftover block
  // holds spDropBack metres goal-side of the BALL rather than dropping to its own box.
  spGkDefScale: 0.85, spDropBack: 26,
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
  // A restart is played to a FREE man, not the near one. The target value was -distance alone, so
  // a goal kick went to the closest centre-back with a striker standing on him. Each metre of
  // separation from the nearest opponent (capped at 12) buys spFreeW metres of distance.
  spFreeW: 1.1,
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
// ...and what the board shows on top of it. meMinute stops at 90 on purpose -- the clock a
// footballer plays to does, and meChase reads it as "minutes left" -- but a goal in stoppage still
// has to be WRITTEN 90+4, so the two halves of the time are stamped separately. `at` is the tick
// the current period began on: 0 for normal time, the first tick of extra time after that.
export const meAddedMin = (tick, at = 0, len = ME_MATCH_TICKS) =>
  Math.max(0, Math.floor((tick - at - len) / ME_MATCH_TICKS * 90));

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
  // 0.0020 was set against the pessimistic belief; see passCal* -- 0.0013 with the belief honest.
  fwdPull: 0.0013,
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
  // How much clearer the AIR has to be before a ball inside loftD goes over instead of along the
  // grass. At 0.45 the marginal chip flew constantly and died half the time: 10-18 m lofted balls
  // completed 51% against 83% for the same ball on the ground, 8% of all passes. The chip has to
  // be clearly the better ball, not slightly.
  loftBar: 0.75,
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
  // The shallowest any leftover outfielder stands at his side's own goal kick, in metres from his
  // own goal line. The kick is taken at 5.5; halved formation depth stood the centre-halves level
  // with it in front of the goal mouth, and the take then aimed the kick at them. Thirteen is a
  // back line receiving on the edge of its own box, comfortably clear of the ball, jitter included.
  gkShapeMin: 13,
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
  // 0.12 was calibrated against a belief that undersold every risky ball; with the belief honest
  // the same cost of losing it buys less caution, so 0.18. See passCal*.
  // Raised 0.18 -> 0.28 in the completion rework: the league attempted passes down to whatever
  // belief this tolerated, so every physical completion gain was spent on extra aggression until
  // the marginal ball was as risky as before. Swept 0.18/0.26/0.34: completion 69.6/71.2/73.9 and
  // goals 2.74/2.63/2.38 -- 0.34 is catatonic, 0.28 prices a professional's actual respect for
  // possession. The manager instructions scale risk appetite around whatever this is.
  // 0.36 -> 0.395 with the balance overhaul: pressActNow makes pressed men release the least-bad
  // ball early, which is the point, and it costs completion at the league level -- 77.8% fell to
  // 76.9. loss is the equilibrium dial (0.18 -> 0.36 bought 69.6 -> 80.0, ~0.58pp per 0.01), so the
  // level is put back here rather than by softening the release change that bought the balance.
  loss: 0.395,
  // How fast running with it stops working as defenders close. At 0.055 a carry retained 88% with a
  // man on him, so the safest option was always to keep running and passing collapsed to a fifth of
  // its real rate. Real dribble success under genuine pressure is closer to half.
  carryRisk: 0.16,
  carryAdv: 8,
  // A carry is a RUN, not a jump. Moving him four metres in one slice is a teleport, and that is what
  // it looked like. It now sets a drive lasting several slices, during which he runs with the ball at
  // carrying pace and can be tackled the whole way.
  // How long a player dwells on the ball before doing anything. It used to be SEVEN slices -- nearly
  // two seconds -- for a player in space and two for a player under pressure, so the commonest sight
  // in the match was an unmarked man standing still until a defender arrived. A touch and a look is
  // half a second; being closed down makes you quicker, not slower.
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
  // A tackle is CONTACT, not a transfer of ownership. Winning the duel used to teleport the ball to
  // the tackler's feet with no event emitted at all, which is why it read on screen as the ball
  // simply changing colour. How often he comes away with it under control depends on how well he got
  // there: a good tackler who is properly set keeps it, a man stretching at arm's length pokes it
  // loose and it is anybody's.
tackleCleanSkill: 0.34, tackleCleanGap: 0.10, tackleLoose: 7,
  // What "get stuck in" and "stay on feet" are actually worth. Both were dead settings in this
  // engine: more challenges won, more free kicks conceded.
  // foulAggr was 0.0014 -- the tackling instruction moved the foul rate by fourteen HUNDREDTHS of a
  // percent, which is indistinguishable from not reading it at all. A quarter either way is a real
  // difference between a side that dives in and one that stays on its feet.
foulAggr: 0.25,
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
  // The two halves of the anti-freeze (both born of a 90-minute 95%-possession statue match):
  // a presser walks onto the ball once the carrier has camped pressTakeHold slices, and the
  // carrier's own carry option is hard-banned holdHardT slices past his touch budget.
  pressTakeHold: 10, holdHardT: 40,
  // ...and the third: a stationary ball further than this from the man who nominally holds it is
  // nobody's ball. Control reach is 0.70; the slack covers a settling touch without ever letting
  // "possession" stand for a ball the holder cannot reach.
  holdLostR: 1.6,
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
  // How many defenders leave their zonal spot to pick up a man, by how deep the ball is in our half.
  // Ten was the old value and it destroyed the shape entirely; these are tuned against shots conceded.
  laneK: 0.70,
  // Real football completes about 80% of its passes and wins maybe half its take-ons. Getting that
  // ratio wrong is what makes a side dribble instead of playing: at 66% passing and 85% carrying, the
  // engine ran 963 carries to 554 passes, which is the opposite of the sport.
  passBase: 1.06,
  // How much the passer's own skill lifts his BELIEF that a ball will arrive: passSkillLo +
  // pass/99 * passSkillW, anchored near 1.0 at a 75-rated midfielder (pass attr 80).
  // ON THE OCCUPIED BAND, not attr/99. Execution has always used meTech -- see its note: forty OVR
  // points squeeze into thirty attribute points, so attr/99 makes everybody identical -- while the
  // BELIEF stayed on the compressed scale, so the engine struck a pass on one measure of a player
  // and decided it on another. Measured: a 90-rated playmaker thought a ball 5% likelier to arrive
  // than a 77-rated one did, which is why no midfielder ever became his side's creator. Re-anchored
  // so a 75-rated midfielder (pass attr 80, meTech 0.80) keeps the 0.995 everything was calibrated
  // against; the spread around him widens from 11% to 27% across the league.
  passSkillLo: 0.515, passSkillW: 0.60,
  // WHAT IT TAKES TO SEE A PASS. Hardness is the through ball, the blocked lane and the long ball,
  // capped at one; visMiss is what a man who reads nothing gives up on the hardest of them, in the
  // same units meDecide scores everything else (roughly 0.1 to 1). Scaled by (1 - meMind), so an
  // elite player pays none of it.
  visMiss: 0.12, visThru: 0.60, visLane: 0.50, visD0: 18, visDSpan: 25,
  // WHAT THE DECISION BELIEVES AGAINST WHAT HAPPENS. Measured over 76,000 passes (test/ratings.mjs
  // logs them): balls the decision rated at 0.19 reached the man they were played to 62% of the
  // time, 0.61 reached him 70%, 0.94 reached him 87%. The estimate was far too pessimistic low
  // down and a little optimistic at the top, so the objective every player optimised was a
  // conservative one -- and that was the ceiling on what judgement is worth: a sharp player
  // picked the safe ball precisely, a noisy one stumbled into the forward ball that came off.
  // The belief is now P = logistic(passCal0 + passCalB ln okBase + passCalR ln okRisk + passCalL
  // ln okLate), fitted on the chosen passes' outcomes. Re-fit with `node test/ratings.mjs` if
  // any term of okBase, mePassRisk or the late-receiver ramp moves; the fit is printed.
  // WHAT IT DID TO THE GAME, AND WHAT WAS RE-TUNED AROUND IT. Honest beliefs made every forward
  // ball rational: completion fell 74% -> 64%, balls into space rose from 38% to 52% of passes,
  // goals 2.80 -> 3.18. The brake on that had been the pessimism itself, so the ground terms that
  // were set high to overcome it came down (roomFwd 0.0045 -> 0.001, fwdPull 0.0020 -> 0.0013) and
  // the cost of giving it away went up (loss 0.12 -> 0.18). Swept loss / keep / roomFwd / fwdPull
  // one and two at a time over 400 matches each: loss alone was weak (0.30 bought five points of
  // completion and crushed shooting), keep only added volume (131 passes a side at 0.12 with the
  // same mix), the ground terms were the lever. Landed: completion 70.7%, into space 39%, lofted
  // 33%, 16.8 m a pass, 2.85 goals, 9.4 shots a side at higher xG each. The payoff, which was the
  // point: a midfielder ten OVR above his own XI's mean now gets +1.8 more balls a match and
  // rates +0.28 higher, against +1.1 and +0.15 before, and a better passer's sharper judgement
  // finally buys him something because the objective he sharpens is the real one.
  // Refitted at the landing (400 matches); `node test/ratings.mjs check` holds it within 0.30.
  // passCal0 carries +0.10 over the joined fit's 2.35: the 0.3-0.5 belief band sat 0.06 under
  // its real completion across three independent fits -- a residual of the model's shape, not of
  // any one sample -- and recentering the intercept closes it while the high bands stay inside
  // tolerance. Do not chase that band with more derive cycles; it oscillates.
  // Refit 29 Aug 2026 (the check had been printing the drift for five reworks): the shipped
  // belief ran about five points optimistic everywhere and priced a late-arriving receiver far
  // too kindly (L 3.08 against a fitted 3.43) -- players attempted interceptable balls because
  // the model told them they would keep them, and in their own third the honest clearance kept
  // losing the argument to a dishonest pass. Passing for its own sake was this line.
  // Second iteration 29 Aug (the fit's own note says the chosen passes move with the belief):
  // L was still chasing at 3.87 on the new distribution -- late balls still over-believed.
  passCal0: 2.10, passCalB: 1.22, passCalR: 1.77, passCalL: 5.08,
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
  // A CLEARANCE IS NOT A PASS. It used to fly on the identical loft solver as a high ball to a
  // teammate, so it arrived catchable on somebody's chest and read as a long pass. It is struck
  // harder and flatter (clearPow on the launch, clearFlat off the arc), never solved for less
  // than clearMinD of carry, and its landing is pushed clearPast metres BEYOND the outlet man --
  // relief that has to be chased in their half, not received.
  clearMinD: 40, clearPow: 1.18, clearFlat: 0.85, clearPast: 8,
  // What a clearance is actually WORTH: the danger it removes from your own goal. Scored as an
  // ordinary pass -- the value of the patch of grass it lands on, minus the cost of losing it there
  // -- it came out negative every single time, because meVal forty metres upfield is almost nothing
  // while the loss term is not. Measured: not one clearance in 1652 slices of a side on the ball in
  // its own third. They lobbed it around their own box instead and lost 31% of those balls.
  clearRelief: 0.07,
  // Into touch. Deep and swamped, the ball goes into the stand. A throw-in against you is a much
  // cheaper outcome than a turnover in your own box, and that difference IS the option -- it is
  // scored as the same loss every other action pays, discounted for the ball being dead.
  // THE ESCAPE VALVE, widened. A press's goals were measured coming off balls won in the pressed
  // side's OWN THIRD -- 73 of 93 traceable goals in the verticaltiki-catenaccio cell started from a
  // turnover at a mean 71.6 m up the pitch, 69% converted inside ten seconds -- and the reason the
  // pressed side kept coughing it up there is that its two escape options were rigged: into touch
  // only existed nearly on the goal line under maximum press, and a pressed clearance was aimed AT
  // a team-mate, so its failure mode was a charged-down ball at 33 m from goal with the block
  // scattered. A throw-in against you resets both shapes; a live strip does not. touchDepth now
  // covers the defensive third and touchPress opens at real rather than desperate pressure.
  touchDepth: 38, touchPress: 1.15, touchDiscount: 0.16,
  // ...and a clearance struck under press carries OVER its man rather than into the contest -- per
  // unit of pressure on the kicker, in metres. The ball lands beyond the target running forward,
  // which is where an outlet chases it, instead of dropping into the second-ball scrum at the
  // exact height the press wants it back.
  clearOver: 4.0,
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
  cardYellow: 0.148, cardStraightRed: 0.0065,
  // A BOOKED MAN IS A DIFFERENT PLAYER. Measured, second yellows came out at 0.265 a match against
  // a real 0.06 -- not because the yellow rate is wrong, 3.5 a match is right, but because nothing
  // here knew he was already on one, and independent rolls over eleven men predict 0.26 exactly.
  // The first fix damped the CARD, which says the referee goes soft on him. Referees do not; the
  // player does. He pulls out of challenges he would otherwise make (foulBooked), he needs the ball
  // to be a certainty before he goes to ground for it (tkGoBooked), and his manager starts looking
  // at the bench (subBooked). All three cost his side something real, which is the point: a booking
  // is a handicap you carry, not a dice roll you survive. Measured together: second yellows 0.19 to
  // 0.09 a match, and the number of booked men hooked before the end more than doubles.
  foulBooked: 0.50, tkGoBooked: 0.10, subBooked: 10,
  // How much less readily a challenge in the penalty area is given as a foul.
  // Swept against the penalty count: 0.30 gave 0.55 penalties a match from fouls alone against a
  // real 0.28 for all causes. At 0.115 the foul-derived share is about 0.21, leaving room for the
  // handball to make up the rest.
  foulBoxScale: 0.115,
  // INJURY, off the same challenge that made the foul. injP is the base chance a foul hurts the man
  // fouled, injPace scales it by how fast he was gone through, and injSerious is the share of those
  // he cannot continue with. Serious ones are rare on purpose: nothing can replace him yet.
  injP: 0.030, injPace: 0.25, injSerious: 0.16, injKnockT: 240, injKnockSpd: 0.86,
  // WHY HE WALKED, where the engine can tell. A challenge red is DOGSO if the man fouled had a
  // clear run at goal and nobody but the keeper behind him, and serious foul play otherwise --
  // dogsoDanger is how close to goal that run has to be pointing (meDanger units, 1.0 at the goal
  // line, about 0.05 at twenty-five metres). flashP is the chance per restart of an off-the-ball
  // flashpoint, which is the only way violent conduct and dissent can happen at all: everything
  // else the referee does here comes out of a tackle, and neither of those is a tackle.
  // dogsoCover is how many outfield defenders may still be goalside and it still count: the letter
  // of the law is the last man, but a single defender chasing back from behind the play does not
  // save a chance, and at zero the engine produced DOGSO on 9% of straight reds against a real
  // third or so -- a back four means almost nobody is ever the genuine last man.
  // dogsoRed is its OWN gate, not a label stuck on a straight red after the fact. A straight red
  // here is rolled off how hard he came in, and the foul that denies a goal is usually the opposite
  // of that -- a shirt pulled, a heel clipped, nothing violent about it. Labelling produced DOGSO
  // on 5% of dismissals against a real third, because cynical fouls were never reaching the roll.
  // A genuine denial outside the area is a sending off almost every time -- the residue is the
  // referee not seeing it that way. dogsoCover is retained only by the old headcount's ghost; the
  // test is meThruCover now. spaDanger/cardSpa are stopping a promising attack, handCardY is the
  // caution for a deliberate handball that did not deny a goal.
  dogsoRed: 0.88, dogsoDanger: 0.34, dogsoCover: 1, spaDanger: 0.075, cardSpa: 0.30,
  handCardY: 0.45, flashP: 0.00044, flashViolent: 0.62,
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
  // Bodies in the way. About a third of real shots never reach the keeper, and this is the honest place
  // to put that: it depends on how many defenders are between the shooter and the goal, not on how
  // good anybody is, so it lowers scoring without touching the rating gap.
  // How much a spot is devalued by the men standing on it. See meValHere.
  valPress: 0.30, valPressMax: 0.80,
  // A clear sight of goal is a reason to shoot in its own right. How far out that reason survives is
  // a property of the finisher -- shotRange metres plus what his shooting buys him, so 14 m for a
  // centre-half and about 23 for a striker -- and it fades over shotRangeFade rather than switching
  // off at a line. Without this nobody ever elected to shoot from outside ten metres all match.
  // How much a carry is discounted for the time it takes, per unit of pressure already on the man.
  // At 1.4 a carrier with a defender engaged reads the spot eight metres on as roughly half what a
  // frozen defence would make it, which is what forces the ball to be struck rather than improved.
  carryDelay: 1.4,
  // Metres of room the spot ahead needs, DERIVED rather than picked: he covers carryAdv in about
  // 1.6 s and a defender covers the same ground in the same time, so anybody within roughly carryAdv
  // of the destination is standing on it when he arrives. carryReach adds the margin he needs beyond
  // that to actually get the ball out of his feet. At 9 the radius was smaller than the distance he
  // was travelling, which is why a clear sight from twenty-five metres still read as a free carry:
  // the lane was empty NOW and nothing modelled it closing.
  carryReach: 1.6,
  // Shape of the positional value surface, exp(-(d/13)^valP). SWEPT AND LEFT AT 1.0, the plain
  // exponential. 0.7 was tried on the reasoning that real possession value is steep in front of goal
  // and flat far from it, which is true, and that a stretched exponential delivers it, which is not:
  // p below 1 flattens the GRADIENT far out but also lifts the LEVEL there -- 0.038 to 0.054 at 25 m
  // -- so midfield became a comfortable place to stand, the drive to progress fell, and goals a
  // match went 2.90 -> 2.61 while the carry before a shot got LONGER, 13.1 m -> 13.9.
  // The algebra says no single exponential can do it. Steep near goal and flat far out are in
  // tension: the curve has to get from high to low, so steepening one stretch flattens another, and
  // p above 1 steepens the near range and the midfield together. A knee -- flat outside the box,
  // sharp inside it -- needs a different function, not a different exponent, and it re-prices every
  // pass, carry and clearance in the engine at once. Do not retry this as a one-line change.
  valP: 1.0,
  // Metres of extra range a completely unobstructed sight of goal buys.
  shotClearRange: 8,
  shotRange: 14, shotRangeSkill: 9, shotRangeFade: 7, shotLaneClear: 1.6,
  // 0.8 -> 1.8. What a clear sight of goal is worth to a man's appetite, and the knob that decides
  // how many efforts come from range. TRIED AND REVERTED at 1.15: long-range shots fell to 13.8%,
  // under the real 15-20% band, and goals a match went 2.83 -> 3.16 because the shots that survived
  // were closer and better. Fewer long efforts is not a free saving; it concentrates the mix.
  shotSight: 1.8,
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
  // RESTORED to 2.0. It was cut to 1.0 on a blocked run that read 0.018 goals a rating point, and
  // that reading was wrong: it came from a regression across fourteen styles of which nine carried a
  // penalty of exactly zero and contributed only noise, so the line was anchored flat. Measured
  // properly afterwards -- the home-advantage shape emptied so only rating moved, 250 fixtures a
  // rung, five rungs, paired -- a rating point is worth 0.092 goals, and +10 came out at +0.920
  // against a standard error of 0.159. Five and a half sigma, and dead on what the home-advantage
  // calibration had assumed all along.
  // At 2.0 a side with no instructions plays 6.7 points below its squad, worth about 0.62 goals,
  // while every designed style sits within 0.1 of its true rating. Cutting it to 1.0 handed Balanced
  // back 0.31 goals -- five times the margin that separated it from the styles below it.
  // (That 6.7 was measured on the contaminated harness whose "Balanced" carried the pool clubs'
  // own instructions. Built the way the app builds a side, a no-instruction side pays the full cap
  // and it converts at the rating slope: the pure ladder read Balanced at -10.00 applied, -1.02
  // goals against the field, dead last.)
  //
  // THE CAP RESIZED, 5 -> 4, WITH INDECISION RAISED TO KEEP THE FLOOR EXACTLY WHERE IT WAS. A cap
  // of 5 demanded ~4.5 normalized axes before a plan counted as fully drilled, which defined
  // "complete system" as "big system": Control Possession's four live instructions ARE a complete
  // football identity and were paying -2.89 applied for compactness, Wing Play -1.16, and both sat
  // in the ladder's bottom half carrying a tax their football never earned. At cap 4 a coherent
  // eight-notch identity is a full system. The arithmetic that matters:
  //   Balanced:      (0 - 4) x 2.5 = -10.0, unchanged to the decimal -- the floor does not move.
  //   Full commit:   still 0. Nothing is lifted above its squad, same as always.
  //   Compact plans: Control Possession -2.3 -> -0.4 nominal, Wing Play and Zona Mista similar
  //                  relief in proportion. This is the whole intent of the change.
  //   Contradictions: a unit of clash now costs 2.5 rating points of penalty instead of 2.0, since
  //                  indecision multiplies it. Deliberate -- no shipped stamp carries a clash, so
  //                  only a hand-authored contradiction pays, and it should.
  drillOvr: 1.1, drillCap: 4, clashOvr: 3.0, indecision: 2.5,
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
  // What a pass is paid for the shot it creates, in the same units and the same role as carryShotW,
  // which ships at 0.45. Same starting value for the same reason: the two are the same idea applied
  // to the two ways a man can move the ball.
  passShotW: 0.45,
  // The escape ball, priced -- both terms fire only on through balls to a man running in behind,
  // and both are keyed on what the DEFENDING side's height actually concedes, so they price
  // aggression without touching any stamp. escDistRelief is the fraction of the distance charge
  // returned when the aim point is genuinely empty (meOppDist against roomFull); escThruW is the
  // matured-chance bonus for a runner put clean through, scaled down by each outfield man still
  // goal-side of the aim.
  // CALIBRATED 25 Aug 2026 at 0.08/0.06, the mildest cell with a real effect: the worst counter
  // in the game (zonamista vs gegenpress, restamped equal squads) compresses -2.13 to -1.85 xGD
  // and completion pays about two points, which the pass-belief refit below absorbs. Sweeping
  // hotter (0.15/0.12) bought only -1.71 for twice the completion damage -- the rest of the
  // ladder is press-side machinery, not the escape ball, and raising these past 0.08/0.06 buys
  // almost nothing. Re-sweep with escsweep.mjs before ever moving them.
  escDistRelief: 0.08, escThruW: 0.06,
  // WHO HE IS PLAYING IT TO. passShotW above values a receiver by what he can FINISH, and nothing
  // valued him by what he can DO: a ball to the best midfielder on the pitch and a ball to the
  // worst scored identically, so the ball never looked for the good player -- measured, a
  // midfielder ten OVR better completed one pass FEWER a match than the man beside him. This pays
  // for the better head the ball is going to, relative to the passer's own (floored at zero: a
  // pass to a worse man is not a worse pass), so it re-ranks receivers and never inflates passing
  // against carrying or shooting. Swept 0 / 0.03 / 0.06 over 400 matches each: a midfielder ten
  // OVR above his own side's mean received +0.4 / +0.7 / +1.1 more balls a match, and only at
  // 0.06 did his completion stop falling as his rating rose. Team completion and possession did
  // not move at any setting.
  passRecvW: 0.06,
  // THE PLAYMAKER. pmkAbsLo/Span read his own quality off meOvr (so ovr 77 is about 0.2 and ovr 90
  // about 0.83); pmkRelFull is how far clear of his own outfield mean he has to be to count as
  // fully the difference; pmkRelLo is what a man in a completely flat squad still gets, since
  // somebody takes the ball even when nobody stands out. pmkRecvW is what a team-mate adds to the
  // value of giving it to him, and pmkSupport is how many metres of walking the support duty --
  // the short option for the carrier, which is where touches come from -- is worth handing him.
  // pmkRelLo is what a man who is NOT clear of his peers still gets. At 0.35 it was too generous:
  // a midfielder level with the other three took a third of the hub for nothing, which is how a
  // side with no playmaker ended up with one anyway. Somebody still takes the ball in a flat
  // midfield, so it is not zero -- it is small.
  pmkAbsLo: 72, pmkAbsSpan: 12, pmkRelFull: 4, pmkRelLo: 0.15,
  pmkRecvW: 0.40,
  // TRIED AND MEASURED, and it is OFF: handing the hub the support duty -- the short option BEHIND
  // the carrier -- moved creation barely at all (top creator's share of his club's key passes 15%
  // to 16%) and cost 0.28 goals a match, with the best side's GF falling 75 to 65 and the league's
  // top scorer 27 to 22. It drags a side's best midfielder backwards, away from the places chances
  // are made. A hub receives in ADVANCED space, which is what pmkDanger and pmkRoam do instead.
  pmkSupport: 0,
  // How much more a hub wants the dangerous pocket, added to the 1.30 every player weighs it at,
  // and how much of the pull back toward his formation slot he is released from. Both scale by
  // _pmk, so a squad with nobody who stands out plays exactly as it did.
  pmkDanger: 1.40, pmkRoam: 0.55,
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
  // chaseStretch MEASURED NULL at 0.45 and is off. Stretching a chased block's front bands was
  // meant to open the between-lines pocket for patient sides; the matrix moved tikitaka 0.13 ->
  // 0.13 exactly, and verticaltiki 0.99 -> 1.13 -- because every strong side holds the ball, so a
  // mechanism keyed on possession length pays the styles that already win. Same grave as chaseSlow,
  // one row over. Do not re-run either; possession length is the wrong key for a possession payoff.
  chaseFrom: 24, chaseRamp: 40, chaseSlow: 0, chaseStretch: 0,
  // THE OUTLET. A deep side that intends to counter leaves its most advanced man OUT of the block,
  // stood on the opponent's last line, and defends with nine. Every earlier attempt to make
  // possWon +1 mean something moved anchors AFTER the turnover -- "telling it to counter" measured
  // -0.05 because the box refills in three seconds and there was nobody up the pitch to counter
  // with; the note above blkMidDrop found pulling the front band back "just shortens the block, and
  // the men it moves stop being an out-ball". This is the inverse: the out-ball is permanent, paid
  // for with a defender. Gated structurally on possWon > 0 AND pressingLOE < 0 -- the sit-off
  // counter identity (Counter, Catenaccio, Zona Mista) -- so a pressing side cannot have it: its
  // press IS its transition game. outletBack is how far onside of the line he stands; outletWide
  // how much of his natural width he keeps, pulled toward the centre where the out-ball goes.
  outletBack: 1.5, outletWide: 0.5,
  // THE STIR, tried and reverted in one night: bank "disorganisation" while the other side holds
  // the ball, decay it on a clock, spend it as deterministic positional error on every man in the
  // block (worse for a poor position attribute), so lanes that do not exist against a set block
  // exist against a stirred one and the existing scorers price the gaps. The SPEND was sound and
  // cheap; the CURRENCY refused to point at possession five times, paired probes at 15 fixtures a
  // cell, TT / Control Poss / Route One vs four blocks, bank quoted as inflicted-vs-eaten:
  //   commanded slide |d wantCy|          2.5 vs 8.9   backwards: proportional to ball speed, one
  //                                                    cleared diagonal banked 27 m in two seconds
  //   performed slide |d bs.cy|           2.5 vs 9.3   backwards: transitions chase at the slew
  //                                                    ceiling, eight-metre passing barely moves
  //   + settled gate (possT > 24)         2.8 vs 5.4   still backwards, goals clean -- the gate
  //                                                    fixed the drift, not the direction
  //   pressed completions (mePressure)    2.8 vs 1.9   right way at last, and inert: bank ~3 of 16
  //   ...dosed 9.0 / tau 14               2.6 vs 3.4   levels would not rise, CP backwards again --
  //                                                    mePressure is PROXIMITY, so a compact block
  //                                                    "presses" every pass played near it by
  //                                                    standing there, and beats-a-press cannot be
  //                                                    read off it
  // Two structural reasons it kept failing, both worth keeping: every metres-per-second currency
  // crowns whoever moves the ball FASTEST, and the shortest-passing side in the game is by
  // construction the slowest; and at any bank level the styles actually reach, ~1 m of per-man
  // error is small against 8.5 m of band spacing, so the spend never opened a lane a scorer could
  // take. Do not re-attempt a bank-and-jitter stir without first building a probe that separates a
  // Tiki-Taka settled spell from a Balanced one in the engine's own texture -- the one channel
  // measured to move possession arrival remains the patterns (ME_PATTERN, +89% ground progression,
  // +104% box entries), and that is where the next attempt belongs.
  // Metres between adjacent men in a band, and how much wider the bands in front space out. The
  // whole band is capped at blkWidthMax so a seven-man midfield does not span the touchlines.
  blkSpacing: 8.5, blkSpaceStep: 2.0, blkWidthMax: 44,
  // How far the middle band drops toward the back line as the ball nears our goal, as a fraction of
  // the block's depth, and how much the whole thing tucks in laterally at the same time.
  // Swept: the drop alone leaves the sprint tail where it was (6.8% of player-slices above 5.5 m/s
  // against a baseline 7.0%); adding the lateral squeeze on top pushed it to 11.1%, because the band
  // then has to chase sideways as well as back. The narrowing is off until that is worth paying for.
  blkMidDrop: 0.22, blkSiegeNarrow: 0,
  // ---- SHAPE DEBT -------------------------------------------------------------------------
  // The engine's creation economy is inverted at the source and every stamp-level fix bounced off
  // it: a chance taken within a second of the turnover is worth 0.167 xG, one worked for three to
  // six seconds 0.089, and the box refills inside three seconds. So transition creates and
  // possession does not, which is why the three transition styles finish top and the two
  // possession styles finish bottom whatever their stamps say.
  // Two previous attempts to pay possession -- chaseSlow and chaseStretch -- both measured dead
  // null, and both failed the same way: they keyed on POSSESSION LENGTH, which is a quantity the
  // strong sides maximise anyway, so the payoff landed on whoever was already winning.
  // This keys on DEFENSIVE WORK instead: how far the block has had to drag itself, and how many of
  // its men are out of it chasing. A side that is moved about pays; a side that wins the ball back
  // in two seconds pays nothing, however long the opponent had it. That is the asymmetry the other
  // two lacked, and it is what "making the ball do the work" is supposed to buy.
  // debtMove is per metre of block slide, debtChase per man out of the shape per second, debtRest
  // how fast it is paid back once the side is on the ball or the whistle has gone.
  // Rates set so the CURVE is right rather than the endpoint: at 0.055/0.020 the debt hit its cap
  // inside five seconds of any defending at all, which is a flat tax on defending -- it would have
  // charged the deep blocks this exists to help. At these rates an ordinary three-second spell
  // costs about 0.03, ten seconds of being moved about costs ~0.44, and only a sustained siege of
  // twenty-plus seconds reaches the cap. Repayment at 0.30 clears a full debt in about three
  // seconds, roughly the life of a transition, so winning it back and immediately losing it again
  // does not wipe the slate.
  debtMove: 0.008, debtChase: 0.004, debtRest: 0.30,
  // What the debt BUYS the side in possession, at full debt. Spacing is the pocket between men --
  // the gap a worked ball is played into -- and markLoss is the share of the marking assignments
  // that stop being made at all, so the late runner arrives unattended. Both are shape quality,
  // not shooting or passing coefficients: the chance still has to be created and taken.
  // Sized against the debt's REAL range, not its nominal one. Measured on the accrual above, the
  // debt runs 0.03 at three seconds, 0.12 at ten to twenty, 0.18 on a sustained siege and peaks
  // near 0.33 -- the cap is unreachable by construction, because repayment is fast and a side has
  // to be genuinely dragged about to climb. Coefficients set so the siege end of that range does
  // what the original 0.30/0.45 were meant to do at a full debt: a twenty-second spell opens the
  // pocket about 13% and drops one marking assignment in six, and the worst spells in a match roughly
  // double that. Effect size beyond that shape is unverified -- this has not been measured yet.
  debtGap: 0.75, debtMarkLoss: 0.90,
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
tkBeatT: 14, tkBeatSpd: 0.55,
  // THE PRICE OF THE PRESS. Measured (80 fixtures, gegenpress vs possession, restamped equal
  // squads): the press dividend is 55 turnovers a match won in the opponent's half feeding 1.99
  // of its 2.72 xG through transition shots, while settled play is dead even -- and a press
  // engagement that FAILED cost nothing, because only a missed tackle set _beat. Two prices:
  // a designated presser whom the ball completes past, forward, from inside his engagement
  // radius is beaten exactly as a missed tackle leaves him (pressThruR metres from the strike,
  // pressThruT ticks); and a man's press REACH decays with his legs -- at zero stamina he
  // arrives on loeStamLo of the distance a fresh man covers, so the 90th-minute gegenpress is
  // a jog, which is the cost every real press pays.
  pressThruR: 6, pressThruT: 14, loeStamLo: 0.55,
  // The free carry's room-times-forward mirror (see decide.ts): 1.0 is parity with the pass
  // term's pricing of the same metres.
  carryRoomW: 1.0,
  // Execution fatigue: at zero stamina a man strikes and passes at fatExLo of his technique.
  // Movement already slows with stamina (meSpeed, 20%); this is the other half -- the mishit --
  // and it is what finally sends the press a bill: measured before it, gegenpress's BEST phase
  // was 75-90 minutes despite being ten stamina points down.
  fatExLo: 0.72,
  // THE TACKLE. tkRange is how close he must be to go at all; the tkw* weights are what "his options
  // are closed" is made of, summing to 1 at best. tkGo is the bar, lowered by his own tackle rating
  // and by Get Stuck In. tkCool stops one man lunging every slice.
  // Inside this of his own goal a beaten man drops goal-side; beyond it he turns and chases.
  beatDeep: 34,
  tkRange: 2.8, tkEdge: 8, tkCoverR: 14, tkCool: 10,
  // Reweighted 28 Aug 2026 with the first-touch rework: the old mix leaned 0.20 on a slow
  // carrier, and most of "slow" was the reception drag artifact -- a claimed ball pinned at a
  // man's heels for half a second. With first touches going in front, carriers move at real pace
  // and the slow term stopped firing: tackle attempts fell 25% and goals rose 0.6 on nothing but
  // uncontested carries. A defender AT the man goes in whatever pace the man carries at -- that
  // is what a challenge on the run is -- so the weight lives on proximity now.
  tkwNear: 0.50, tkwSide: 0.22, tkwSlow: 0.10, tkwEdge: 0.08, tkwCover: 0.14,
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
  // tkSkillW is the whole of what being a better tackler is worth once he has gone in. At 0.24 on
  // a rating difference already squeezed by ME_COMPRESS, a defender fifteen points better than the
  // man he was challenging won four per cent more of his tackles -- while tkGoSkill had him going
  // in more often, so he was beaten more often too and the two charges cancelled: measured across
  // a league, defenders' ratings did not move with their OVR. tkSkillMid is the population mean of
  // the (tackle - pace)/99 term, so the league-wide win rate stays where tkBase calibrated it and
  // only the spread between good and bad tacklers widens.
  // ---- THE POKE, derived rather than swept ---------------------------------------------------
  // The style imbalance closes to one equation. GF = S_t*C_t + S_w*C_w with the engine's own
  // measured chance values C_t 0.167 (shot within 1s of the turnover) and C_w 0.089 (worked for
  // 3-6s). Decomposed from the probes: a press archetype runs S_t ~12.5, S_w ~9; the possession
  // archetype S_t ~2.9, S_w ~16.3. The gap that equation predicts, (9.6 x 0.167) - (7.2 x 0.089)
  // = 0.96 goals, is the 2.90 - 1.94 the screens measured -- the model closes to two decimal
  // places, so the model is the diagnosis. Parity requires dS_t = (C_w/C_t) x dS_w ~ 0.53 x dS_w:
  // the press may keep about +4 transition chances against +7 worked ones, and it currently keeps
  // +9.6. S_t must fall ~45% and nothing else needs to move.
  // WHERE: every won tackle handed the winner clean, controlled possession at the strip point
  // (meBallTo immediately after the roll), facing a side still shaped to attack. Real tackles do
  // not do that -- roughly half are "tackle without possession": the ball is poked loose, runs
  // 3-8 m, and becomes a fifty-fifty that the stripped side's eight goal-side men are well placed
  // to win, or a throw-in. tkLooseP is the share of wins that poke rather than keep; retention of
  // the loose ball then falls out of the pickup physics that already exist. At 0.7, with scramble
  // recovery biased toward the tackler's supporting press, effective clean-chance retention lands
  // near the 0.55 the parity equation asks for. Incidence is automatic: chaos-sourced play is 72%
  // of a press's GF and 25% of a possession side's, so the same physical rule discounts one three
  // times harder than the other without touching a style coefficient.
  // The league-level cost is also arithmetic, not hope: transition share of all goals ~0.45-0.5,
  // so goals/match falls roughly 2.96 x (0.5 x 0.55 + 0.5) ~ 2.3-2.5, and the difference comes
  // back on the global keeper dial (gkSaveReach), which is style-blind. Fit both from ONE
  // instrumented validation, not from sweeps.
  // Fit round 1 (6-archetype decomposition, 40/pair): worked play reached parity (S_w 0.67 press
  // vs 0.71 possession) and the whole residual gap is S_t volume, 1.36 vs 0.76. The retention
  // arithmetic saturates in tkLooseP -- the scramble bias floors clean retention near 0.62 -- so
  // the second notch is scatter DISTANCE: a longer poke runs to open grass, the stripped side's
  // goal-side eight, or dead, all of which deny the instant chance.
  tkLooseP: 0.78, tkLooseD: 8, tkLooseV: 6.5,
  tkBase: 0.34, tkAngleW: 0.34, tkSkillW: 0.80, tkSkillMid: 0.05, rateTackle: 0.042,
  runTicks: 14,
  // Threat-list bonus for an opponent standing goal-side of our own trap line. Above the active-run
  // bonus (0.8) on purpose: being through does not time out the way a run's fourteen slices do,
  // and losing this man is losing the match. He also counts toward the nMark budget like a runner.
  markThruW: 1.2,
  // How much more the assignment cares about reaching the DANGEROUS man than the harmless one.
  // The Hungarian minimises a total, so without this every man on the shortlist was worth the
  // same and the one through on goal could be handed a defender from the far side of the pitch.
  markPrio: 2.5,
  // How many men may be reserved to shadow opponents nobody is covering, before the ball-chasing
  // duties are handed out, and how far up the pitch that reservation applies (metres from our own
  // goal). Two is a defence keeping its head; more would be a side that stops defending the ball.
  markResN: 2, markResDepth: 78,
  // How far his man may get from him before a standing mark is released. Beyond this he is not
  // marking anybody, he is following somebody around, and the assignment should be re-thought.
  markHoldD: 26,
  // A man with nobody covering him, this deep in the attacking half, runs at the goal instead of
  // holding his lane: he aims thruRunStop short of the line and keeps thruRunKeep of his own
  // width so the run arcs in rather than snapping to the middle.
  thruRunDepth: 62, thruRunStop: 6, thruRunKeep: 0.35,
  // Through-on-goal is a race (meThruCover): the run to goal is sampled to thruShotAt short of the
  // goal, and a defender covers if he reaches a sample no later than the runner plus thruCovSlack
  // seconds -- arriving together is contesting. A goal-side man two channels wide no longer counts
  // as cover, and a diagonal chaser who really does get across now does.
  thruShotAt: 15, thruCovSlack: 0.15,
  // Where a corner wants its contact: the scoring band around the penalty spot, in metres from
  // goal centre. The aim scores candidates by |their distance to goal - cnAimD|.
  cnAimD: 9.5,
  // The press approach: how much of the closing distance bends toward the ball-to-own-goal line,
  // and the cap. Zero reproduces the tail-chase.
  pressCut: 0.35, pressCutMax: 6,
  // When closing down is worth a sprint: inside pressSprintD of the ball (the last few metres,
  // where the challenge is), or with the ball inside pressOwnD of your own goal. Everything else
  // is closed at a working pace -- see the chase gate in meMove. A side told to press high sprints
  // regardless, which is what the instruction buys.
  pressSprintD: 7, pressOwnD: 40,
  // How much further off his man a marker stands at a restart taken beyond spMarkNear of his own
  // goal. Tight marking belongs in the box, not at a halfway-line throw-in.
  spMarkNear: 30, spMarkOff: 3.5,
  runMax: 4,
  // Runs are TIMED off the carrier: nobody breaks in behind while the man on the ball is being
  // smothered past runFreeP of pressure -- he cannot deliver, and the run is spent for nothing.
  runFreeP: 1.2,
  runCool: 28,
  // THE BOX IS OCCUPIED, at last. With the ball in the final third the side's most attacking men
  // take stations in the penalty area -- near post, penalty spot, far post -- clamped to the legal
  // frontier: level with the second-last defender, or with the ball when the ball is deeper, which
  // is exactly what the offside law allows. Nothing else changes; the cross valuation, the aerial
  // duel and the cutback were all built years of sessions ago and measured as "outscored because
  // there is nobody there": 74% of final-third passes were struck with ZERO team-mates in the box
  // (0.65 men on average, 65% of samples empty), because the anchor never asked for the area and
  // the space search never proposes what the anchor does not ask for. That emptiness is why match
  // xG was a count of ~1.5 rare big chances a side -- blowout or nothing -- with the whole
  // 0.08-0.2 band of ordinary box chances missing.
  // boxFrom is ballDepth (distance from the ATTACKER'S OWN goal) past which stations engage, and
  // boxHold is how many ticks they persist after the ball drops back out. Both exist because of
  // the same measurement: engaged only inside the final third, the front men averaged 20.8 m from
  // their stations and reached them on 7% of sampled ticks -- a final-third spell lasts seconds,
  // and a twenty-metre commute does not fit inside one. A striker is not commuting; he is already
  // pinned on the last shoulder while the ball is still being worked forward, which is what
  // engaging from 56 with six seconds of hold actually is.
  boxFrom: 56, boxHold: 24, boxMen: 3, boxNear: 6.5, boxSpot: 11, boxFar: 9, boxSlack: 0.3,
  // How far up the pitch the ball must be before ANYBODY runs beyond it. A counter-attack starts by
  // definition with the ball deep, so this number decides whether the engine can counter at all.
  runMinDepth: 30,
  runThirdDepth: 52,
  // How far beyond the line the PASSER will still play him. At 2.2 this was a standing gamble on
  // a ball the rule flags at offTol 0.5 -- the engine deliberately playing men it knew were off,
  // which from the stand is a side with no offside awareness at all. Just over the tolerance now:
  // a runner arriving level is playable, a runner already gone is not.
  offsideGrace: 0.9,
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
  // A LED BALL IS RUN ONTO, NOT MET AT THE LIMIT. The lead used to be solved so ball and man
  // arrive together at the far end of his sprint: any hesitation and it ran through him -- which
  // it did, constantly. Measured over 22,097 passes: 31% of everything attempted was an
  // into-space ball completing 47%, and HALF of all interceptions were the ball running past its
  // own receiver -- against 9% cut in the lane, the thing interceptions are supposed to be.
  // thruReact is the seconds of flight the receiver does not get to use (he has to see it played
  // before he runs), and thruLeadFrac aims the ball short of the solved limit so the last stride
  // belongs to the man, not the flight. Both shorten every lead; neither touches a ball to feet.
  thruReact: 0.35, thruLeadFrac: 0.85,
  // The gate and the cap on jog-leads: a receiver moving slower than thruMoveV (m/s) has no
  // into-space option at all, and one merely jogging is led at most thruJogMax metres.
  thruMoveV: 1.6, thruJogMax: 10,
  // A pass to FEET still leads a moving man: above feetMoveV he is led by his own pace across the
  // flight, at feetLeadFrac of the solve and never more than feetLeadMax metres -- enough that he
  // runs onto it, short of the through ball that mode 1 exists to be.
  feetMoveV: 1.2, feetLeadFrac: 0.55, feetLeadMax: 4.5,
  // ...and space is only space if there is pitch around it. Within edgeMin of a touchline the room
  // bonus is worth edgeLo of itself, whole again edgeFull metres infield.
  edgeMin: 3.5, edgeFull: 13, edgeLo: 0.25,
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
  // ...and 0.0045 was measured against a belief that priced a ball into space at a fifth of what
  // it was worth. With the belief honest (passCal*), 0.0045 had sides playing into space 52% of
  // the time; 0.001 with fwdPull at 0.0013 puts the mix back where it was measured to be right.
  roomFull: 12, roomFwd: 0.001,
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
  // ── GameplayFootball ports below ─────────────────────────────────────────────────────────
  // These used to arrive through Object.assign(CFG, {...}) after the literal was closed, and
  // that one call was costing more than any algorithm in the engine: adding eight hundred
  // properties to a finished object drops it out of fast properties into a hash dictionary, so
  // every CFG read anywhere -- and this engine does millions a match -- became a hash lookup.
  // Measured on the same object with the same contents: 7 ms for five million reads as one
  // literal, 97 ms as a dictionary. Folded in here, where a later duplicate key overrides an
  // earlier one exactly as Object.assign did, so the values are unchanged.

// ---- GameplayFootball ports (constants verified against the C++; see docs/gameplayfootball-gap-report.md)
  // GetLazyVelocity (elizacontroller.cpp:437-474). start/end are the distances from the action
  // between which effort falls off; both shrink as a player tires so a tired side stays compact.
  lazyStart: 20, lazyEnd: 65, breathExp: 0.7, lazyFloor: 3.5,
  // The in-possession movement floor, as a share of top pace: liveLo + liveMind * meMind. The
  // lazy ramp above strolled every off-ball attacker at 0.30-0.55 flat; now the elite work at
  // ~0.60 of pace between spots and the poor keep their stroll. See meMove.
  liveLo: 0.30, liveMind: 0.30,
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
  passArrive: 6, passMaxV: 30, passNoiseDeg: 2.5, passNoiseSkill: 6.8, passNoisePress: 2.5,
  // Weight, trimmed 26 Aug 2026 as part of the completion rework: at 0.05 + 0.15 the mean player
  // put +-20% swings on the ball and the overrun tail fed the ran-past-the-receiver class above.
  // The skill slope stays meaningful -- weight is still the half of passing that separates levels.
  powerNoise: 0.028, powerNoiseSkill: 0.11,
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
  // cutReach trimmed 0.60 -> 0.53 in the completion rework: at 0.60 a marker's poke matched 88%
  // of the receiver's own reach, so 27% of all interceptions were clean picks AT the target man's
  // feet -- real markers arrive a beat late and tackle after the touch instead. The anticipation
  // span (cutAntLo/W below) still separates a reader of the game from a statue.
  reach: 0.70, cutReach: 0.53, controlV: 11, controlVSkill: 6,
  // How much of the pass-cutting reach is anticipation. cutAntLo + meTech(position) * cutAntW,
  // anchored to 1.0 at a 75-rated centre-half (position attr ~81, meTech ~0.82) so the calibrated
  // baseline is untouched and only the spread across bands is new.
  // The spread used to be DELIBERATELY SHALLOW -- 0.20, on the finding that a wider one cancelled
  // against worse passing and left team completion flat across bands. At 0.20 the whole of the
  // rating scale moved the reach by about five centimetres, which is to say reading the game was
  // switched off: a 55-rated back four cut passes as well as a 90-rated one, and measured across a
  // league the interceptions a defender made did not move with his rating at all. Widened, with
  // the POPULATION mean held: outfielders average meTech(position) ~0.72, which the old pair put
  // at 0.98 of cutReach, and cutAntLo is set so the new pair puts it at exactly the same place.
  // Only the spread around the mean is new, so pass completion and possession are untouched.
  cutAntLo: 0.404, cutAntW: 0.80,
  // THE OTHER TWO POSITIONING CHANNELS, moved onto the same band as the interception reach above.
  // `position` reaches the pitch three ways -- cutting a pass out, getting to a loose ball first,
  // and how reliably a ball played to him arrives -- and only the first was ever read over the
  // occupied band. The other two sat on position/99, where twenty OVR is twelve attribute points:
  // measured, they were worth 3% and 2% between a 70 and a 90 while judgement was worth 100%.
  // Both are anchored on the league's mean man (OVR ~77, position attr ~76) so the calibration he
  // was fitted to does not move; the ends separate.
  chaseAntW: 0.20,                 // loose-ball chase: 3% spread -> 7%
  rcvPosLo: 0.8025, rcvPosW: 0.30, // ball played to him arrives: 2% spread -> 9%
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
  // ftCheckDot is METRES of ball ahead along his own line, not a cosine: below it he checks.
  // Widening it to 0.35 was measured and rejected (goals 3.58 -> 3.89, passes +6): the brake
  // slows INTERCEPTING defenders as much as receivers, and a defender braked to 30% on his own
  // cut is re-pressed and stripped. Leave it on the strictly-behind ball.
  ftCheck: 0.30, ftCheckDot: 0,
  ftStretch: 0.55, ftHot: 18, ftPace: 0.5, ftFail: 0.30, ftSquirt: 0.5, ftSquirtArc: 1.2,
  // How much of the stretch penalty technique buys back: at 0.5 an 85-technique man halves it
  // (full-stretch clean 0.53 against the flat model's 0.29) and a 60 keeps most of it. This is
  // the bad-touch dial for quick-succession build-up.
  ftStretchTech: 0.5,
  // ---- the ball is its own object -----------------------------------------------------------
  // It is never attached to anybody. A man in possession pushes it ahead of himself and runs onto
  // it, which is what dribbling IS, and a defender takes it by getting to the BALL -- not by winning
  // a dice roll three metres away from the man. Before this, "possession" was a flag: the ball was
  // teleported to a player's feet and stayed glued there, so a tackle could only ever be a
  // probability, a dribble could only ever be a status, and a defender's effective reach was the
  // 3.2 m at which that roll was allowed to fire.
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
  // Twelve so a move can be paid back through its pre-assist and to the man who won it. Every
  // reader of the log breaks on the first change of side or bounds itself in time, so the extra
  // length never reaches a previous phase of play.
  tlogMax: 12,
  // MATCH RATING deltas, on the abstract sim's scale so the two engines agree about what a 7 means.
  // rateGoalXgW is how much of a goal's credit is taken back for it having been an easy one;
  // rateGoalXgDef is what a goal with no shot attached to it is assumed to have been worth.
  // rateGoal raised 0.9 -> 1.15 in the board rebalance: through ctx and the xg discount the
  // effective credit was ~0.7 a goal against the ~1.0-1.2 the reference systems pay, and goals
  // are the one currency concentrated in the players a season board is FOR -- the top scorers.
  // Uniform cuts to hub pay could never reorder the board (the positional par re-centers the
  // mean and hands most of it back); paying the striker's currency properly is the symmetric fix.
  rateGoal: 1.15, rateGoalXgW: 0.4, rateGoalXgDef: 0.3, rateAssist: 0.6,
  // THE KEEPER IS RATED ON GOALS PREVENTED. A save paid rateSave x xg and a goal cost rateConcede x
  // (1 - xg), at 1.3 and 0.18, so every shot on target was worth about +0.2 to him on average --
  // a busy keeper rated well for being busy, and the good keeper on the good side, facing three
  // shots a match, had no way to earn. Measured: saves a match fell 0.30 per ten OVR and rating
  // rose 0.07, when the same keepers were preventing 0.21 more goals a match per ten OVR.
  // Now one weight, on his performance against what an ORDINARY keeper concedes from that shot:
  // a save pays rateSave x gExp and a goal costs rateSave x (1 - gExp), so a keeper who concedes
  // exactly what his shots deserved nets zero however many he faces, and the rating is W times the
  // goals he kept out. gExp is NOT the pre-shot xg, which predicts conversion on target badly in
  // this engine: measured over 3,650 shots on target, the near-zero band (xg < 0.05) goes in 17%
  // of the time, the 0.30-0.40 band 83% (rebounds and tap-ins the model underprices) and the
  // 0.40-0.60 band 54%. A straight line through that charged a keeper 0.4 for a rebound he could
  // do nothing about and paid him 0.2 for a tap-in he kept out, and the bias moved with the shot
  // mix a side faced. So it is the engine's OWN conversion curve, by band: each pair is
  // [upper xg bound, share scored]. Penalties carry no xg and convert at 85%, so they have their
  // own figure. Re-derive both from the probe if the shot model or the keeper physics move.
  // 0.65 because a busy clean sheet (five saves) lands near 7.7 and three conceded from five
  // shots near 5.7, which is where the systems this is modelled on put them; 0.85 put the latter
  // at 5.4 and had one keeper in nine finishing below 5.5.
  // Re-derived 23 Aug 2026 (600 matches) after the keeper's sweep fix and the wider spans, and
  // again after the pass-belief recalibration changed what he faces.
  rateSave: 0.65, gkExpPen: 0.71, rateConcedeDef: 0.06, rateOwnGoal: 1.0,
  // Re-derived 28 Aug 2026 after the fluidity rework's keeper-reach offset: with more reach the
  // keeper concedes less per shot, so the whole expectation table shifts down a few points.
  // Re-derived 29 Aug 2026 (goalkeeping rework). The [0.6,1) band keeps its prior figure: the
  // derive sample holds under ten shots there and the instruction above says not to trust one.
  gkExp: [[0.05, 0.07], [0.10, 0.12], [0.20, 0.13], [0.30, 0.34], [0.40, 0.74], [0.60, 0.57], [1.01, 0.89]],
  rateYellow: 0.3, rateRed: 1.5, ratePenWon: 0.4, ratePenGave: 0.6,
  // PHASE B: what only a positional engine can see. rateError is the giveaway that led to the goal
  // and rateErrWin is how long, in slices, it stays his fault. The rest are the ways a defender is
  // finally able to GAIN, which is the whole reason the position means were 0.42 apart.
  rateError: 0.8, rateErrWin: 32, rateBlock: 0.12, rateClear: 0.035, rateKeyPass: 0.08,
  // THE READER AND THE MOVE. An interception was the one defensive act that paid nothing: the passer
  // was charged and the man who stepped across the ball was paid nothing and counted nowhere, so
  // anticipation -- the channel `position` reaches the pitch through -- had no way into the rating.
  // rateBuild is what the pre-assist earns, decaying by rateBuildDecay a step further back through
  // the scoring side's unbroken run of touches; rateRecover is for the man who won the ball that
  // started it, if it was won in open play -- his first kick within recoverWin ticks of the other
  // side's last one, which a tackle or an interception-and-short-carry is and a restart never is
  // (the quickest, a throw, is taken eleven ticks after the ball died). Both are small on
  // purpose: they are how a deep midfielder finishes a 3-0 on 7.6 rather than on exactly what he
  // started with.
  rateIntercept: 0.063, rateBuild: 0.18, rateBuildDecay: 0.6, rateRecover: 0.20, recoverWin: 12,
  // THE CHANCE IS THE CONTRIBUTION, not the goal. The build walk above only ran when the move
  // scored, so a winger who manufactured two goals of expected chances on the striker's blank
  // afternoon finished on par -- his rating tracked the statline, not the football. Every
  // recorded shot now pays its own build chain in proportion to the chance's xG: the last
  // different man before the shooter earns rateChanceBuild per unit of xG, decaying a step at a
  // time exactly like the goal walk, and the goal walk itself is unchanged on top -- scoring
  // still pays like scoring.
  // ...and the man who REACHED the end of it gets the same currency: rateChanceGet per unit of
  // xG for arriving where the chance was, from the same per-match cap pool as the build credit.
  // Without it a striker's whole afternoon was the binary of conversion -- the board's forwards
  // vanished behind defenders the moment defensive actions started paying properly.
  // rateChanceCap cut 1.1 -> 0.75 with the board rebalance (27 Aug 2026): the playmaker role
  // concentrates the build chains on one man, and at 80% completion he hit the old cap most
  // afternoons -- the cap is what keeps a hub's season from towering over every striker's.
  // The cap is the hub's board rating: he saturates it nearly every match, so whatever it is
  // set to lands on his season as a flat bonus the rest of his position never collects. 1.1
  // built a board of nine midfielders; 0.30 is what keeps the credit real without deciding the
  // whole table by itself.
  rateChanceBuild: 0.35, rateChanceGet: 0.35, rateChanceCap: 0.25,
  // ...and STOPPING the chance is worth what the chance was. A flat tackle rate said cutting out
  // a square ball on halfway and an interception on the six-yard line were the same act. Every
  // defensive action -- tackle, interception, block, clearance -- now scales with the danger of
  // the spot it happened on: base pay in safe space, up to (1 + rateDefDanger) of it at the
  // goalmouth. 1.5 handed the top of the season board to full-minute defenders (16 of the top
  // 25, four of them on 0g 0a), and 0.7 with the base rates below still paid ACCUMULATION: a
  // centre-half with no goal, one assist and four chances created all season rated 7.3 purely on
  // volume, alongside one who had genuinely played well. So the danger premium goes UP and the
  // base rates come DOWN by about a third together -- the mean is unchanged and the same
  // afternoon's worth of routine work pays less, while the block on the line and the interception
  // in the six-yard box pay more. The standout defender separates from his own back four, which
  // is the whole point of rating a defender at all.
  rateDefDanger: 1.3,
  // PHASE D: THE ROUTINE. Everything above is a moment -- a goal, a card, an error -- and a match
  // is mostly not moments. A full-back who played ninety composed minutes and a midfielder who
  // completed eighty passes both finished on exactly 6.50, because nothing either of them did all
  // afternoon was on the list. Measured over a full season, every rated player in the division fell
  // between 6.29 and 7.08: a 0.79 band standing in for the difference between the best footballer
  // in the league and the worst.
  // These are the contributions that happen dozens of times a match. They are what makes two men
  // who neither scored nor conceded rate differently, which is the whole job.
  //
  // THE SHAPE IS DELIBERATELY ASYMMETRIC, because the real distribution is: the mode sits just
  // ABOVE the 6.5 start, the left tail is thin, and the right tail is long and reaches 10. So the
  // routine positives are small and frequent, the routine punishments are smaller still, and only
  // goals, saves, errors and dismissals reach far from par.
  ratePass: 0.023, ratePassProg: 0.0016, ratePassProgCap: 26, ratePassFail: 0.046,
  // A pass is PROGRESSIVE by the Wyscout rule: the gain toward the opponent's goal that counts
  // shrinks as play moves higher, so a defender lumping it forward from all that free grass does
  // not out-count a midfielder threading it in traffic. Both ends in own half: 28 m. Crossing
  // halves: 14 m. Both in the opponent's half: 9 m. Measured at a flat 10 m, DEF still topped the
  // table (2.4/match vs MID 1.5); tiered, the table belongs to the men who play forward.
  progOwn: 28, progCross: 14, progOpp: 9,
  rateDuelWon: 0.066, rateDuelLost: 0.052, rateDribble: 0.094, rateBeaten: 0.062,
  rateAerial: 0.052, rateShotOn: 0.05, rateShotOff: 0.018,
  // A chance is big when the model says roughly a third of them go in. Creating one is worth more
  // than the key pass it already scores; spurning one is a real cost, and it is charged whether the
  // keeper saved it or it went wide, exactly as it is in the systems this is modelled on.
  bigChanceXg: 0.30, rateBigChance: 0.20, rateBigMiss: 0.28, rateBigMissCap: 1.7,
  // The moments that were missing. A penalty saved and a tackle made with nobody behind you are two
  // of the biggest single things a keeper or a defender can do in a match, and neither existed.
  ratePenSave: 0.85, ratePenMiss: 0.80, rateLastMan: 0.28, tkLastManR: 34,
  // PHASE C. rateFullFrac is the share of a match a man has to play before his rating is taken at
  // face value; below it he is pulled back toward par. ratePos is the positional par itself,
  // calibrated off test/ratings.mjs -- re-derive it if any delta above changes.
  rateFullFrac: 0.667,
  // The ceiling on the per-ninety projection above. 1/rateFullFrac, so a man who plays the
  // qualifying share reaches his full rate and anything shorter is damped by the shrink.
  rateProjMax: 1.5,
  // RE-DERIVED 23 Aug 2026 with `node test/ratings.mjs derive`: 400 league matches with this set
  // to zero, full-match players only, and each position's par set so its mean lands on 6.85 --
  // about where the systems this is modelled on put a man who played the ninety. The raw means
  // were GK 6.65, DEF 7.28, MID 7.41, FWD 7.39: the outfield ones climbed when interceptions,
  // build-up and recoveries started paying and rateSpread scaled the deviation, and the keeper's
  // fell when his save volume stopped paying. The par absorbs all of that, which is its job.
  // Re-derive it the same way if any delta above, or rateSpread, moves.
  // ...and again the same day, 600 matches, after the keeper's sweep fix and spans, and once more
  // after the pass-belief recalibration (GK raw 6.63, DEF 7.32, MID 7.36, FWD 7.34).
  // Re-derived 28 Aug 2026 after the loose-ball rework (loosePressWin, carryGoalW, the goal-kick
  // shape floor): the trickle-in and own-goal classes it removed were mostly forward goals, so the
  // FWD par climbed a third of a point and the others moved a few hundredths.
  // The derive-to-zero figures overshoot because the projection shrink interacts with the par;
  // interpolate from measured (par, mean) points at slope ~0.88 rating per unit of par instead.
  // Re-set 28 Aug 2026 after the fluidity rework and its keeper-reach offset: FWD from
  // (-1.243, 6.999) at slope 0.88; GK's own slope is steeper, ~1.72 -- interpolated from
  // (0.086, 7.087) and (-0.183, 6.625). DEF and MID held (both passed).
  // DEF nudged 28 Aug (set-piece/header rework): real clearances pay defenders more, par ran
  // 6.975 -- interpolated at the outfield slope 0.88.
  // Re-derived 29 Aug 2026 with the goalkeeping rework (dive speed, depth skill, cross claims,
  // shot patience): keepers concede differently and forwards' shot diet moved.
  // FWD interpolated from its own two measured points ((-1.412, 6.963), (-1.225, 7.132),
  // slope 0.90) -- the derive-to-zero figure overshoots, as it always does.
  // FWD moved again by the pass-belief refit; at the established slope 0.90 from (−1.538, 6.641).
  // GK interpolated at its own slope 1.72 from (0.054, 6.971) after the through-ball revival.
  ratePos: { GK: -0.006, DEF: -0.644, MID: -0.532, FWD: -1.402 },
  // HOW FAR A POSITION'S AFTERNOON IS ALLOWED TO SWING. ratePos puts the four means in the same
  // place; this puts the spreads nearer each other. Measured over a full-match sample, a forward's
  // rating had a standard deviation of 0.87 and a midfielder's 0.59 -- a goal is 0.9 and nothing a
  // midfielder does is, so the top of every table was a forward by construction and a fifth of
  // all midfield and defensive afternoons finished within 0.15 of par. A factor on the deviation,
  // applied before the positional par: 1.0 is the forward, and the others are lifted part of the
  // way toward him, not all of it -- forwards genuinely swing more. Re-derive ratePos after
  // touching this, since scaling the deviation moves the mean.
  // RE-DERIVED 26 Aug 2026, then CORRECTED the same day. Lifting the other three toward the
  // forward is what the ghost problem asked for and it is also how a season board fills up with
  // centre-halves: at DEF 1.15 against FWD 1.0 a defender's afternoon swung as wide as a striker's
  // (sd 0.746 against 0.839), and since a league fields four defenders a side and two forwards,
  // the tail of the season table was defenders by sheer weight of bodies -- twelve of the top
  // twenty-five finished within 0.1 of each other, so ties decided the order. The forward is now
  // the widest swing in the game and the defender the narrowest, which is what the real boards
  // look like. Ghosts come back a little at DEF 1.0; that is the price and it is the right one.
  // ...and the MIDFIELDER is the other half of the same mistake. Squeezing the defender without
  // lifting him left the middle of the pitch as the worst-represented position on the board --
  // two of the top ten and four of the top twenty-five, behind a back four who had scored nothing
  // between them. A season table should read forwards, then midfielders, then defenders, and the
  // three multipliers are what say so: applied to neutral swings of DEF 0.649 / MID 0.655 /
  // FWD 0.839, these give 0.584 / 0.753 / 1.049.
  // ...and the KEEPER was left at 1.0 while the other three moved, which quietly made him the
  // narrowest swing on the pitch: nought of the top twenty-five in a full season, so a keeper
  // could not have a great year at all. A screamer of a season should reach the board and an
  // ordinary one should not, which is a WIDE keeper, not a high one -- the par is unchanged and
  // both tails open together.
  // TRIED AND REVERTED: DEF 0.80 with FWD 1.15, to move the defenders who fill the eleven-to-
  // twenty-five band. It cost the thing that matters -- the top ten went to two forwards and
  // three defenders, with the league's leading scorer down at twelfth -- because compressing the
  // forward compresses the men whose seasons the board is supposed to be about. The middle of a
  // season table carries defenders and that is what a defender's season looks like; the top of it
  // is forwards and midfielders, and that is what these hold.
  // Re-tuned after the pass-completion rework (27 Aug 2026): the safer league pays midfielders
  // far more routine volume -- completions, progressions, key passes, assists all rose -- so at
  // MID 1.15 the season board went nine midfielders in the top ten. The middle band comes down
  // and the forward opens up; the raw swing the multipliers act on is not what it was in August's
  // first derivation, so these are set by the board they produce, not by the old sd ratios.
  // Re-set with the accumulation trims (rateChanceCap, rateKeyPass): once the hub's rating
  // volume is capped at source, the multipliers stop fighting the economy and come back to sane
  // values -- MID 0.90 was compressing every ordinary midfielder's afternoon to protect the board
  // from three playmakers. The board should read: forwards and midfielders who carried their
  // team, the standout defender, the standout keeper.
  // Composition-tuned (27 Aug 2026, third pass): a 19-goal striker already rates 7.8 -- the
  // problem was tier width, not the top. Every club fields a playmaker at 7.3+, only a few
  // forwards a season post carry-the-team numbers, so the forward tier is wide open and the hub
  // tier comes in. GK 1.30 put two keepers in one top ten; one standout is the brief.
  // Fourth and final composition pass: the multipliers stopped moving the board (8 MID at FWD
  // 1.55 vs MID 0.94), because the towering seasons are the CREATION ECONOMY, not the spread --
  // so the key-pass and chain-credit rates above took the cut instead, and the multipliers hold
  // here. Note for the next person: half the board's "midfielders" are creative winger/AM
  // profiles that real-world taxonomies list as forwards; the preset position labels understate
  // the board's true attacker share.
  rateSpread: { GK: 1.28, DEF: 1.15, MID: 0.94, FWD: 1.55 },
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
  // The drop-wait veto (zNext, in the aerial gate) is waived when an opponent stands inside this:
  // letting it fall to your feet in a crowd is how you get robbed, so a marked man attacks it
  // with his head -- which is most of the box at a corner.
  headDuelR: 2.4,
  // A relief header is a clearance and travels like one: launch speed before the strength scale,
  // and its loft. The old knock (headV * power * 0.75, vz 0.9) left the head at 5-9 m/s and
  // carried six to ten metres against an 18 m aim -- a fifty-fifty on the edge of his own box.
  headClearV: 13, headClearVz: 3.5,
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
  // THE DROP-WAIT VETO, RE-ARMED. At 0 the test `zNext > headHoldZ` was true for any ball still
  // off the grass next slice, so the veto it guards never fired and every ball above head height
  // was headed -- including the 73% measured as reaching ordinary touch range a quarter-second
  // later. A ball that will still be above this when he next touches it is genuinely a header;
  // one dropping below it is a ball to take down. The duel arm still overrides in a crowd, which
  // is what keeps corners headed.
  headHoldZ: 1.15,
  // ...but a man throwing himself in front of a SHOT is not trying to trap it, he is trying to be in
  // the way, and he does not need a controlling touch to do it. Shrinking his reach to 0.7 m on a
  // struck ball meant nothing was ever blocked: about a third of real shots never reach the keeper,
  // and here they all did.
  // Swept against the share of shots blocked: 1.55 gave 39%, 1.25 gives 28%, 1.05 gives 21%. Real
  // football blocks about 25-30%. At 1.55 a defender swept a 3.1 m corridor -- five times his own
  // body -- so almost nothing got through a crowded box and the shot count was inflated with efforts
  // that were never going to arrive.
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
  // THE DRIVE AT AN OPEN GOAL, per metre of ground gained on the goal mouth, paid only while the
  // carrier has a clear run (the runAtGoal corridor in meShape). Sized off the terms it has to
  // beat: the goalward step at carryLook = 6 is worth about 0.083 of carryVal from twenty metres
  // and the keeper standing in the lane costs up to 0.075 of carryAvoid -- the pair that cancelled
  // and left a through man steering around the goal. 0.03/m is 0.18 per step: the drive wins
  // against a keeper, and an outfield body back in the corridor (which drops the gate) frees the
  // search to swerve as before.
  carryGoalW: 0.03,
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
  // pressActNow: how fast the act-now bar FALLS with pressure. The bar said "only play early if
  // the option is genuinely good" -- and under press every option is degraded, so the harder a man
  // was pressed the longer he stood there holding it, which handed the press its duel. Measured in
  // the verticaltiki-catenaccio cell: 52 possession-wins a match in the pressed side's own half,
  // all ground duels and loose balls off the carrier, feeding 69% of the presser's goals inside ten
  // seconds. A pressed man plays the least-bad ball NOW; the inaccuracy of doing so is already
  // priced by the pass noise and risk terms, which is what makes this a release change and not a
  // buff. At press 1.8 the bar is gone entirely.
  holdBase: 5, holdPress: 1.4, actNow: 0.10, pressActNow: 0.55, firstTouchNoise: 1.75,
  // A keeper with the ball IN HIS HANDS surveys before he distributes -- nobody may take it off
  // him, so his budget gets gkHoldT extra slices and the press term is ignored while held. He was
  // on the outfielder's five-slice budget, which is the instant punt and the bad kick after it.
  gkHoldT: 10,
  // THE PATIENCE TERM. What an unpressed shooter pays for striking a chance that is still
  // maturing: (spAhead - sp) * shotWaitW, faded by pressure at shotWaitPress. On a free
  // breakaway at twenty metres the charge is comparable to the shot's whole score, so he
  // carries in; with a defender arriving it fades and he takes what he has.
  shotWaitW: 0.5, shotWaitPress: 1.2,
  // Inside this range the sight bonus is unconditional -- the chance is already made and
  // finishing is right; beyond it the bonus is scaled by (sp/spAhead)^2, so a man who can carry
  // into a much better chance loses his urge to hit it from range. See appetite in decide.ts.
  sightHoldD: 11,
  // SPEED OF THOUGHT IS A RATING. The touch budget was flat: a 92 looked up on exactly the
  // schedule a 58 did, so elite football had the same standing-on-the-ball cadence as a second
  // division. Slices shaved off (or added to) the budget per unit of meMind, centred near the
  // check leagues' mean so the league-wide tempo barely moves while the top of it visibly plays
  // quicker and the bottom dwells longer.
  holdMind: 2.4,
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
  // Per notch of pressingLOE, the drain surcharge while DEFENDING -- see the phase-scoping note at
  // the drain line. 0.30 against the old always-on 0.18: a side that defends half the match pays
  // about what it always did, and one made to defend sixty per cent pays more precisely because
  // the opponent is making it. The counterweight a possession game never had.
  pressDrain: 0.30,
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
  // ZEROED, 25 Aug 2026, the settled-creation surgery's one real mover. The term paid BACKWARD
  // passes extra precisely when the defence was set (times `shut`), which made recycling against
  // a block a standing bribe: 68% of a possession side's settled spells died before the middle
  // third, tikitaka created 0.18 settled xG a match against a deep block, and every patient style
  // starved. Its original job -- stopping suicidal forward forcing -- is done by the risk model
  // now (the pass-belief logistic prices what a forward ball actually costs). Measured at 0:
  // settled xG 0.18 to 0.52, final-third spells 1.5 to 2.1, tikitaka-vs-verticaltiki -1.30 to
  // -0.94, goals level; completion pays about three points because sides finally attempt the
  // forward ball, and the belief refit absorbs the honesty.
  keepBuild: 0.000,
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
  // How many men a side may commit to cutting one pass out. The gate used to be "only the
  // receiver's marker", which left every other lane unguarded.
  cutMaxN: 2, cutEdgeOther: 260,
  // A receiver with an opponent inside recvPressR checks to the ball instead of waiting for it,
  // meeting it as early in the flight as he can reach within recvHurry ms of the ball passing.
  // Showing for the ball: a marked man between showMinD and showMaxD of it, with an opponent
  // inside showPressR, drifts showStep metres toward it while his side has possession.
  showMinD: 6, showMaxD: 34, showPressR: 5.0, showStep: 2.6,
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
  // THE STAND-OFF IS FROM THE BALL'S LINE, NOT THE MEETING POINT. scrambleStop stops the chaser
  // 1.3 m short of his intercept point so a travelling ball is not overrun -- but reach is 0.70,
  // so a man 1.3 m PERPENDICULAR to the path watched the ball roll past untouchable and chased
  // the re-solve, which is the whole of "he can't receive a ball that isn't straight at him".
  // Standing off is only legal once he is within lineStand of the path itself.
  lineStand: 0.55,
  // THE GATHER. Winning the race to a through ball is a sprint; taking a ball that is dying in
  // front of you is not. With no arrival control the receiver closed on a 2.3 m/s ball at 8 and
  // ran straight over it -- inside gatherR of a ball receding along his approach, his pace is
  // capped at the ball's plus gatherOver, so he arrives with it playable instead of behind him.
  gatherR: 2.5, gatherOver: 1.5,
  // A clean claim on the move puts the FIRST TOUCH in front, along the line he is running --
  // claims land anywhere inside reach, including 0.6 m behind a sprinting man, and the ball was
  // simply left there (or ejected along the claim direction, which can be backwards). Below this
  // speed in m/s he is standing and the claim spot stands with him.
  ftFwdV: 1.5,
  // ...and how fast that touch degrades with the pressure on the receiver. The effect of the
  // forward touch is binary (once the ball is out of the behind-cone the drag never starts), so
  // the only honest price is the situations in which it is denied: a man receiving under a
  // tackler's shadow scuffs it under himself whoever he is. At press 1.25 the touch is gone.
  ftFwdPress: 0.8,
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
  // Slices after a ricochet (_loose) during which the ball counts as live for the press and the
  // swarm even though mp.flight still says a strike is in the air. A parry, a block and a poked
  // tackle have no intended receiver, so the flight exclusion built for passes left the rebound
  // unassigned -- the defence stood in shape while it sat in the six-yard box. Two seconds covers
  // the scramble window; the keeper's own claim (gkLooseWin) stays wider.
  loosePressWin: 8,
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
  // WHERE HIS TEAM-MATES STAND RELATIVE TO HIM, and it used to be a fixed 12-21 m ring measured on
  // raw distance. Both halves of that were wrong for anybody not passing at 16 m.
  // The band is now the side's OWN preferred length, orbitBand either side of it, so a side told to
  // keep it short stands inside its own range instead of outside it. At passingDir -2 the old ring
  // asked for 12-21 m against a pass band of 2-14: the men it positioned were, by construction,
  // beyond the balls it wanted to play. orbitMin stops a very short side standing on the carrier.
  // ...AND IN FRONT OF HIM. A spot seven metres behind the carrier scored exactly what one seven
  // metres ahead did, because Math.hypot does not know which way the goal is. That is the whole of
  // why a short-passing side's reachable options were beside and behind it: measured, Tiki-Taka
  // gained 0.50 m of ground per completed pass against Gegenpress's 5.24, and 40.9% of its completed
  // passes went backwards against 40.5% forwards. orbitBackLo is what a spot directly behind is
  // worth against the same spot ahead, reached orbitBackSpan metres back. Not zero: a side still
  // needs an out-ball, and the support duty is a separate mechanism that provides one regardless.
  orbitBand: 6, orbitMin: 5, orbitBackLo: 0.35, orbitBackSpan: 12, orbitW: 0.30, basePullW: 0.7,
  // SHOWING FOR IT. A short-passing side's whole game is receivers who keep presenting a clean lane,
  // and the space search priced a blocked lane identically for every style -- so Tiki-Taka stood in
  // traffic exactly as often as Route One and completed 87.6% against Balanced's 91.4%, backwards
  // for the side taking the shortest, safest balls in the game. Per notch of NEGATIVE passingDir
  // the lane term scales up by this much; direct sides are untouched -- a target man does not care
  // about the lane, the ball arrives over it.
  laneSeekShort: 0.6,
  // WHERE THE OUTLET STANDS, and it follows the passing length now. suppBack is where he stands at
  // passingDir 0 -- seven metres behind the ball, which is the right place for a side that hits it
  // forward and needs somewhere to recycle to. For a side told to keep it short it was dead centre
  // of its own preferred range, so the single most attractive option on the pitch was the backward
  // one, by construction, and only for the styles least able to afford it.
  // ONE-SIDED, on the shotWant pattern: only NEGATIVE passingDir moves him, because a direct side's
  // outlet behind it is already correct and nothing measured says it wants to be deeper. At
  // passingDir 0 this is exactly the number that was hard-coded here, so a side carrying no
  // instruction is unchanged. At -2 he stands five metres in FRONT of the ball, clamped to the
  // offside line so the shortest option is never an illegal one.
  // MEASURED, AND IT IS A NULL. Three runs at 40 fixtures a style: the two styles this is for moved
  // less than the passingDir-0 control did. The instruction is issued and never executed. Where the
  // outlet is ASKED to stand against where he ACTUALLY stands, metres ahead of the ball:
  //   tikitaka -0.67 asked / -7.02 actual     balanced -7.01 asked / -8.25 actual
  // Balanced's outlet is 0.2 m from his target; Tiki-Taka's is 5.8 m behind it, which is to say
  // exactly where he was before any of this. Two things eat it, and the second is fatal. The offside
  // clamp takes +5 down to about level on its own, because a side camped in the final third has its
  // offside line behind the ball. Then the man picked as nearest to a point in FRONT of the ball is,
  // in practice, always a man behind it -- and he is walking forward while the ball moves, so he
  // never arrives. One man cannot be moved across the ball by asking him to.
  // A forward short option has to come from somebody ALREADY in front: the runner and hold
  // population, which is what attackingRing reaches. Do not re-tune suppDirStep expecting this to
  // land; the next attempt has to change WHO is picked, not where he is sent.
  suppBack: 7, suppDirStep: 6,
  // Shot decision knobs, mirrored from decide.ts so sweeps reach them live.
  // What a shot is worth against keeping the ball. At 0.6 a man through on goal preferred a safe
  // ball sideways: real footballers shoot considerably more than the expected-goals-optimal rate,
  // and a chance that is not taken is worth nothing at all.
  // 0.165 -> 0.135. A single exponential at 0.165 decays far faster than real chance quality does,
  // and the error is all at range: against an eleven-metre shot, this engine valued a twenty-five
  // metre one at 0.099 of it where real xG puts that ratio at about 0.21. Half. No appetite term can
  // rescue a base value that is half of reality, which is why efforts from distance were 2.1% of all
  // shots -- against something nearer 15-20% in the real game -- and why nobody ever has a go with
  // the goal wide open. Fitted across 6-28 m against real xG by distance (0.35 / 0.12 / 0.06 / 0.03
  // / 0.018 at 6 / 11 / 16 / 22 / 28 m central), one exponential lands at k = 0.135.
  // Real xG is steeper than one exponential close in and flatter far out; 0.135 splits that, so
  // six-yard chances are slightly under-valued and twenty-five yard ones slightly over. That is the
  // right way round for a model that has to pick ONE curve.
  // shotWorth scales the shot in the DECISION only -- act.p, the recorded xG and the resolution are
  // untouched -- so it buys willingness to have a go without making any shot better than it is. That
  // separation is what lets the mix and the goal level be set independently: this decides how often
  // the ball is struck, xgBase decides what the strikes are worth.
  xgK: 0.135, xgBase: 0.68, shotWorth: 1.6,
  // Below this chance it is not a shot worth taking at all. Set to clear hopeless efforts from
  // 35 m+ (worth about 0.001) without touching real long-range attempts from 20-25 m (about 0.007).
  // What a missed shot costs against what an open-play giveaway costs. It has to sit well under a
  // failed dribble's (1 - drb), which is about 0.20, or the engine is telling everyone to run with
  // it instead of hitting it -- which is exactly what it was doing at 0.32.
  shotMissW: 0.10,
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
  // shotElevSkill is THE TOP-END DIAL. Elevation error is shotElevErr * (1 - skill*this), so
  // raising it takes the ballooned shot away from an elite finisher and leaves it with a poor one:
  // measured over a full season, 0.72 / 0.85 / 0.90 give a club's top scorer a mean of
  // 16.3 / 18.1 / 17.5 and the league's best 25 / 32 / 25, with the best side's GF 75 / 95 / 86.
  // It concentrates goals in the good sides and the good strikers rather than floating the whole
  // league, which is what the keeper dial does. 0.90 overshoots and flattens again.
  shotElevErr: 8.0, shotElevSkill: 0.95,
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
gkDiveV: 2.9,
  // THE SPANS, widened 23 Aug 2026 with the league's mean keeper held where he was. meGkSkill
  // runs 0.43 to 0.94 across the keepers in the registries, and at 0.28-0.18 / 6-9 / 0.45-0.82
  // nearly all of them sat in the top third of every span: measured, a keeper ten OVR better
  // prevented +0.01 goals a match on the shots that reached him, against a standard error of
  // 0.06. The mean keeper (skill ~0.76) keeps his read at 0.73, his reaction near 0.20 s and his
  // dive near 8.3 m/s; the ends move. Conversion on target came back from 30.0% to 31.2% because
  // the worse keepers lose more than the better ones gain, and a 10-OVR step is now worth about
  // +0.13 goals a match on target with the gradient visible in his rating.
  gkReactSlow: 0.30, gkReactFast: 0.11,      // seconds, worst keeper to best; cut with the reach
  // How often he picks the right side as it is struck, worst keeper to best.
  // Raised 29 Aug as the reach cut's compensation: he saves by being THERE, so committing to
  // the right side is most of goalkeeping now.
  gkReadMin: 0.34, gkReadMax: 0.92,
  // How much extra a long flight buys his read: nothing under gkReadT0 seconds, full value by
  // gkReadT0 + gkReadTSpan. A close-range shot stays a guess however good he is.
  gkReadT0: 0.25, gkReadTSpan: 0.6, gkReadTime: 0.18,
  // The open goal, as meShotP prices it: a keeper gkOpenLat off the shot line (past a 0.7 m body
  // allowance) is fully beaten, and a fully beaten goal converts at xgOpenCap decayed with
  // distance. See the keeper block in meShotP for the measurement that forced this.
  gkOpenLat: 2.4, gkOpenReach: 1.3, xgOpenCap: 0.93, xgOpenDecay: 0.015,
  // HOW BEATABLE THE SHOOTER THINKS HE IS. Same bug the pass belief had, and worse: this DECIDED
  // on reflex/99 while the save RESOLVES on meGkSkill, so a striker saw the division's best keeper
  // as 11% different from its worst while the save itself separated them by 55%. Nobody shot
  // differently against a great goalkeeper. On the band the resolution uses, anchored so the mean
  // league keeper (77.4 OVR) keeps the 0.586 everything was calibrated against.
  gkBeatLo: 0.907, gkBeatW: 0.40,
  // The recorder's calibration: P = sigma(xgCal0 + xgCalB * logit(q)), fitted on 7,193 attempts
  // joined to their outcomes by shot id (test/ratings.mjs collects the data). After the open-goal
  // term the raw recorder ran monotonically hot close in and cold from range; through this map
  // every band lands within a few points of what the physics actually converts. Re-fit whenever
  // the shot or keeper physics move.
  // The intercept is raised over the joined fit's -1.135 because the join can only see goals
  // that resolve with a live shot attached: about thirty percent go in off a deflection or a
  // scramble and resolve with none, so a map calibrated to the joined outcomes booked 2.50 xG a
  // match against 3.17 goals. The deflected goal was still created by the attempt that produced
  // it, so its mass is returned to the attempts proportionally -- +0.24 in logit space is the
  // 3.17/2.50 ratio -- and the season's xG ledger balances against its goals.
  // (A rebound bonus keyed on mp._parry was tried here and reverted: post-parry strikes realize
  // 19-31%, not the 82% a bookkeeping artefact suggested -- goals with no live shot fall back to
  // rateGoalXgDef 0.3 in the KEEPER's ledger and had pooled into one measurement band.)
  // Intercept dropped 0.24 in logit space (ln 2.64/3.34) when the keeper's save reach and the
  // loose-ball claim took goals a match from 3.7 to ~2.6 and the recorder kept booking the old
  // conversion. Slope untouched; gkExp re-derived against the new physics the same day.
  xgCal0: -0.69, xgCalB: 0.468,
  // How fast he throws himself once he has read it, in m/s, worst keeper to best. This is the dive
  // as a MOVEMENT -- it replaced the old dive-as-reach entirely.
  // Real dive launch speed is 4-6 m/s; 9.5 was superhuman late coverage papering over positioning.
  // The compensation is positional: gkOutSkill below, the angle already sharpens with skill
  // through gkPanic, and the cross claim plus the shot-patience term take chances away upstream.
  gkDiveVmin: 4.2, gkDiveVmax: 7.0,
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
  // A deflection off a man is not uniform. His body arrived between the ball and whatever he was
  // protecting, so a ball travelling goalward leaves off him biased AWAY from his own net -- the
  // knock target shifts this many metres off the goalward line. Uniform here was worth a goal a
  // match: 63 of 154 no-live-shot goals in 150 matches were deflected crosses and passes rolling
  // in, plus most of the deflected-strike class. Applied only when the incoming ball is moving
  // at his own goal above walking pace, so attacking flicks and neutral squirts stay uniform.
  deflectAway: 3.0,
  deflectWin: 12,
  // HOW RECENTLY AN ATTACKER HAD TO HAVE TOUCHED IT for a goal off a defender to be his rather than
  // an own goal. Without this the test was only "was the last touch theirs", which made every box
  // scramble an own goal: 10.5% of all goals against a real 2-3%.
  // Measured at 400 matches a value, ~1,160 goals each: 3 -> 6.45%, 5 -> 3.51%, 6 -> 2.66%,
  // 8 -> 2.33%, standard error under 0.5pp. Six sits in the middle of the real-football 2-3% band.
  // Every goal is accounted for at all four settings -- each one is either credited to a scorer or
  // recorded as an own goal, never dropped.
  ogWin: 6,
  // The floor was 0.55: every fingertip pretended to be a half-firm palm, which both overdrove
  // weak deflections and made every touch look like a botched save. A real fingertip barely
  // bends the line -- and above gkParrySafe the WHOLE result (mirror and shove) refuses the
  // goalward component: a firm palm does not put the ball in its own net. Below it, a genuine
  // fingertip can still deflect one in, which is the real, rare, deflected own-net goal.
  gkParryFloor: 0.25, gkParrySafe: 0.32, gkLiveV: 8,
  // The chance a sub-gkParrySafe fingertip genuinely beats the hand and keeps its goalward line.
  gkGrazeP: 0.15,
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
  // Depth is awareness too, and it was skill-flat while only the angle (gkPanic) scaled. A better
  // keeper takes a smarter starting depth -- narrowing the angle is the real-life compensation for
  // not being able to fly 9.5 m/s -- and a poor one hugs his line. Multiplies the resting out2.
  gkOutSkill: 0.35,
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
  // ...and OUTSIDE his box he sweeps only for a man who would actually be through -- the race
  // being winnable is not a reason to leave the goal when a defender has the runner covered.
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
  spPenBack: 10, spPenSpread: 12, spPenAim: 0.84, spPenRead: 0.10, spPenReadSkill: 0.25,
  // A SHOOTOUT KICK READS DIFFERENTLY, and the reason is positional rather than psychological.
  // The numbers above are right for open play and measurably so -- pensim puts an in-match penalty
  // at 73.6% scored and 19.8% saved against a real 76/19 -- but they are right there partly by
  // accident: meSPShape gives the keeper his spot as a TARGET and the kick often arrives while he is
  // still travelling to it, so a read that is too strong is paid for by a keeper who is not set.
  // A shootout removes that. Everyone is reset, the pre-kick is long, and he is stood exactly on his
  // line dead centre every single time -- perfectly set, which is also what the laws require of him.
  // With the same read that produced 28% saves and 63% scored, against a real shootout's 19 and 73.
  // Swept over ~400 kicks a cell: skill 0.25 -> 63.0%, 0.16 -> 66.5%, 0.10 -> 68.3%, 0.05 -> 72.7%.
  spPenReadPk: 0.10, spPenReadSkillPk: 0.05,
  // A shootout kick is walked up to and struck; it does not need the full pre-kick an open-play
  // penalty gets, and at 470 each one cost about thirty-six seconds of real time before anyone
  // touched the ball. Shorter here only -- in-match penalties keep their ceremony.
  // 470 is the open-play ceremony. This is shorter but not absent: it sets the minimum before
  // anyone may strike, which is the pause and the run-up. Cut to 150 there was no wind-up at
  // all -- he arrived and it was already gone.
  // ...and shorter again now the app stages the kick: the carry to the spot and the step-back
  // happen on screen before the engine is armed, so this is pure wind-up from a placed ball --
  // about nine seconds from placement to strike.
  spPenTicksPk: 220,
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
  // Smother success runs on the keeper's rating through the same band meGkSkill normalises over,
  // not on reflex/99 -- ME_COMPRESS squeezes the raw attribute so badly that a 40-rated and a
  // 90-rated keeper differed by a tenth. Measured before the change: rush episodes ended in a
  // smother 5.6% of the time and in a shot against 55%.
  gkSmotherR: 2.6, gkSmotherP: 0.52, gkSmotherLo: 0.62, gkSmotherSkill: 0.68,
  // THE POUNCE. A keeper facing a carrier in his box attacks the ball the moment a heavy touch
  // puts it outside the carrier's playable reach (gkPounceGap of it) -- but only when he judges
  // he can win the race: his distance against the carrier's, allowed up to gkPounceLo +
  // gkPounceMind * meMind of the gap. Judgement is the skill: a sharp keeper recognises the
  // real chances, a dull one hesitates and stays on his feet.
  gkPounceGap: 0.95, gkPounceLo: 0.55, gkPounceMind: 0.55,
  // ...and when he gets there, HANDS. A keeper claiming an opponent's loose touch on the floor of
  // his own box is diving on it, not toeing it: his reach at a ground ball there is a dive's span,
  // where everywhere else he keeps the strict body radius a shot save demands. Without this the
  // pounce entered races it could not win -- the carrier's re-take always beat a 0.5 m body.
  gkClaimReach: 1.05,
  // ...and his hands ABOVE head height, in his own box, on a ball the opponents delivered: the
  // cross claim. He had bodyR + ballR up there -- 0.51 m, less than an outfielder's header reach --
  // so the six-yard box belonged to whoever attacked the delivery. Slightly wider than the ground
  // claim: arms up and a step of jump. meIntercept's keeper ceiling is gkHigh for the same reason.
  gkClaimAir: 1.15,
  // A live opposing SHOT he plays with his arms along its whole path -- that is what a save is.
  // The body-only rule was measured against through-balls and stands for them; lumping shots in
  // with passes gave him 0.46 m of reach against a strike, which is why 16-25 m converted at 19%
  // on target and the median conceded goal crossed 0.6 m from his body. Not his full claim span:
  // he is reacting to a strike, not gathering a roller -- swept 0.46/0.60/0.70/0.80/1.05 against
  // goals a match. THE LEAGUE'S GOALS DIAL, and it must be set on the full 380-fixture season
  // rather than a 120-fixture sample -- the sample frame ran 0.4 goals hot, so 0.58 measured 2.64
  // there and 2.24 over a real season. Paired on the season fixtures with the foot-reach floor
  // below: 0.44 / 0.48 / 0.52 / 0.58 give 2.75 / 2.60 / 2.40 / 2.24 goals a match, with the top
  // scorer on 25 / 23 / 23 / 22 in thirty-eight. 0.44 is a real league.
  // ...AND IT IS NOT ONE NUMBER FOR EVERY KEEPER. Shipped flat, it handed the worst goalkeeper in
  // the division exactly the arms of the best, and since this reach is most of what a save now is,
  // it flattened goalkeeping itself: measured, a keeper ten OVR better prevented +0.01 goals a
  // match against +0.28 before the reach existed, so no keeper could have a season worth putting
  // on a board -- there was nothing to have. The reach spans by meGkSkill between Lo and Hi, and
  // the league's mean keeper (skill about 0.76) still lands on the 0.44 the goals dial was set at.
  // The span is wide because meGkSkill only runs 0.43 to 0.94 across the keepers in the registries:
  // at 0.28-0.50 the actual spread between the division's worst keeper and its best was 0.11 m and
  // bought +0.07 goals prevented per ten OVR. These put the real spread near 0.19 m with the mean
  // keeper still on 0.44.
  // gkSaveReach is the INFORMATIONAL centre only -- the live pair is Lo/Hi, spanned by meGkSkill.
  // Shifted down 26 Aug 2026 as the completion rework's goals offset: the safer league creates
  // fewer chances, so the keeper gives back what the passing took (about +0.45 goals a match,
  // per the dial's measured ~0.17 per 0.04 of reach).
  // Shifted up 28 Aug 2026 as the fluidity rework's goals offset, the mirror of the 26 Aug move:
  // first touches going in front (ftFwdV) raised shot volume 17% at IDENTICAL conversion-on-
  // target, so the league scores more on pure throughput. The attack got quicker; the keeper gets
  // the reach to answer it. Both ends move together so the keeper spread is untouched. Sized off
  // the dial's measured rate scaled to the new volume (~0.21 a match per 0.04 of reach).
  // ...and nudged again 29 Aug with the goalkeeping rework: real dive speed (gkDiveVmax 9.5 ->
  // 7.0) plus breakaways carried in close cost 0.34 goals a match; the claims and the patience
  // term bought back some, the reach dial covers the rest (+0.055 for -0.29 at the measured rate).
  // ...and back down 29 Aug with the pass-belief refit: honest passing took 0.43 goals out of
  // the league, so the keeper returns 0.3 of the flat reach he was given as the dive-cut offset.
  // The skill terms (gkOutSkill, gkPanic, the claim) are untouched -- only the level moves.
  // CUT 29 Aug: at 0.215/0.645 the arm ring covered so much of the frame that 18.7% of ALL
  // goals went in off the keeper (real: 2-5%) -- every goal-bound ball got a fingertip and every
  // goal read as a parry-in. The save load moves from blanket reach to the read and the
  // reaction (gkReadMin/gkReactSlow below), which is what a keeper's rating is supposed to buy.
  // Partially restored once the crossing steer landed: a reach contact now turns the ball
  // round the post instead of carrying it in, so reach reads as saves again, not own-nets.
  gkSaveReach: 0.42, gkSaveReachLo: 0.14, gkSaveReachHi: 0.69,
  // How long after his reaction the arms take to reach full extension. With the ring now on a
  // clock (see reachOf), THIS is what makes a good keeper good: gkReact* sets when he starts and
  // this sets how fast he opens, so the save that separates levels is the one that was always
  // going to be close. A ball arriving inside his reaction beats him whoever he is.
  gkReachSpan: 0.17,
  // ...and a ball squirting off anybody UNCONTROLLED is loose for this many ticks: a ricochet is
  // not a backpass, and mp.flight staying up through a deflection is bookkeeping, not football.
  // 108 of 121 no-live-shot goals crossed the line under 10 m/s with the keeper a step away,
  // frozen by the flight flag and the backpass gate.
  gkLooseWin: 16,
};

export type EngineConfig = typeof CFG;

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
  // Gated to HIGH press only. Pressing high while staying on your feet is the contradiction -- you
  // arrive and then decline to win it. The mirror is not a contradiction, it is Cholismo: a
  // mid-to-low block that bites the moment you enter it is how Simeone's football works, and the
  // ungated rule charged that style three rating points for its own signature. Measured with the
  // charge still on: tackling +1 was worth +0.46 goals to Cholismo across a twelve-style field.
  ["pressingLOE", "tackling", 1, "pos"],
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
// EXTENDED FOR CONTROL POSSESSION ALONE, and the two reversions are the finding. The extension
// was authored for all three circulation styles -- deeper sequences being the one channel with a
// positive record (+89% progression, +104% box entries on the first pattern pass) -- and the
// paired probes kept exactly one third of it:
//   Control Possession: the carousel legs (3->6, 5->8 advances, 6->7, 8->7 half-space entries)
//     bought 12% more box entries at +0.02 goal difference, arrival for free. Kept.
//   Tiki-Taka: the identical legs read -0.21 to -0.35 in two doses. It is the narrowest style in
//     the game and width -1 pulls its men off the very wings the patterns aimed at, so the balls
//     went to nobody. Do not hand the narrow style wide patterns; its shipped table already IS
//     its optimum. Reverted whole.
//   Zona Mista: seam releases (3->7, 5->7) read -0.03 against a se of 0.10. A knob that reads as
//     noise is a knob that should not exist. Reverted whole.
//   All three: the own-third play-out legs (1->4, 0->3, 2->5) at 0.5-0.6 gained CP 36% forward
//     metres and cost 0.22 a match -- ambition out of the defensive third flips marginal balls
//     under the press, and a turnover there feeds the transition economy at 0.167 xG a shot.
//     Ambition is priced only where its failures are cheap: the opponent's half.
// The outward halves 4->3 and 4->5 stay absent everywhere, because pricing both directions of the
// carousel pays perpetual ping-pong, and that is a bribe to the objective rather than a plan.
export const ME_PATTERN = {
  // Combine through the middle, and switch to move them before you do.
  tikitaka:      [[4,7,1.0],[3,5,0.6],[5,3,0.6],[3,4,0.5],[5,4,0.5]],
  possession:    [[4,7,0.9],[3,5,0.7],[5,3,0.7],[3,4,0.5],[5,4,0.5],
                  [3,6,0.5],[5,8,0.5],[6,7,0.8],[8,7,0.8]],
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
// THE STYLE STAMPS, moved here from App.tsx so the engine itself can restamp a side (the
// half-time emergency switch in meChase). App.tsx imports this back; there is one copy.
export const STYLE_PRESET = {
  balanced:      {},
  // Win it back high and go again. The only style that maxes both press and line.
  gegenpress:    { pressingLOE: 2, defLine: 2, approachPlay: 1, possLost: 1, possWon: 1, tackling: 1 },
  // Keep it, move it, never hurry. Presses to restart possession, not to score off the turnover.
  // ELEVEN INSTRUCTIONS AND NINE OF THEM COST. Last in the head-to-head, beating two of thirteen and
  // losing to the side that carries no instructions at all. The two dropped here are the two that are
  // NOT what Tiki-Taka is: gkDist is classified in this file as an execution choice rather than an
  // identity axis (it is in STRAT_EDITABLE, excluded from fit damping) and costs 0.08 whichever way
  // it is set, and tackling -1 is incidental at 0.10. Together that is a fifth of a goal of pure tax
  // for nothing anyone would call tiki-taka.
  // What makes it the style is untouched: shortest passing in the game, narrow, high line, presses to
  // restart possession, holds shape, works the ball in, expressive.
  tikitaka:      { pressingLOE: 1, defLine: 1, passingDir: -2, approachPlay: -1, possLost: 1,
                   possWon: -1, chanceCreation: -1, creativity: 1, width: -1 },
  // Tiki-Taka pointed at the goal: same short passing, opposite intent on the ball and in transition.
  verticaltiki:  { pressingLOE: 1, defLine: 2, passingDir: -1, approachPlay: 1, possLost: 1,
                   possWon: 1, dribbling: 1, creativity: 1, width: -1 },
  // Patient without the press: shortest passing outside Tiki-Taka, plays out from the back, holds
  // shape, keeps the ball. It used to carry SEVEN negative instructions and not one positive -- a
  // style defined entirely by refusal -- and measured as the worst side in the game on territory,
  // shots and goals. Leave-one-out showed no single culprit: removing ANY of the seven gained shots,
  // between +0.5 and +2.7. It was the accumulation.
  // dribbling and chanceCreation are gone because they contradict the name as well as the numbers:
  // a possession side's midfielders carry the ball, that is how positional play advances, and a side
  // that works it into the box then declines to shoot has no way to finish what it starts.
  // ...AND THE LINE IS HIGH, which it was not. "Patient without the press" was read as a standard
  // line, and with short passing and playing out on top of it the side held the ball DEEPER THAN
  // PARK THE BUS -- a mean possession position of 35.8 m, the lowest of all fourteen. Controlling
  // possession without controlling territory is not a style, it is sterile possession, and it left
  // this a notch of line and a notch of press away from Zona Mista: 0.34 apart on twelve behaviour
  // columns, the closest pair in the game and the only one too close to tell apart.
  // A high line with NO press is a combination nobody else holds -- Tiki-Taka presses from its high
  // line, Zona Mista sits deep and does not -- so this is what separates all three.
  // IT DID NOT FIX THE TERRITORY, and the honest number belongs here rather than the intention: a
  // full notch of defensive line moved the mean possession position 35.8 m to 36.4, and the distance
  // to Zona Mista 0.34 to 0.41. Where a side HOLDS the ball is contested -- it is capped by the
  // opponent's block and by the offside line -- so its own defensive line does not push the ball up
  // the pitch. Kept because a control side genuinely should hold a high line and because it is now
  // two notches of line from Zona Mista rather than one, but a possession side that cannot gain
  // territory is a progression problem in the pass model, not something a stamp can reach.
  // ...AND THE LINE IS GONE, on this stamp's own evidence. The note above records what it bought:
  // 0.6 m of possession position and 0.07 of separation from Zona Mista. Measured since, a notch of
  // defensive line is the most expensive instruction in the game at ANY setting -- 0.23 at one notch,
  // 0.37 at two -- and this side had six instructions of which every single one was a net cost, which
  // is why it finished last of fourteen head to head, beating one opponent.
  // gkDist goes with it: this file classifies it as an execution choice rather than an identity axis
  // (STRAT_EDITABLE, excluded from fit damping) and it costs about 0.08 whichever way it is set.
  // What a control side IS survives intact -- shortest passing outside Tiki-Taka, plays out from the
  // back, holds shape rather than countering, stays on its feet, and presses at nobody.
  // REVERTED to possWon -1. Flipping it measured +0.49 goals against the field, the largest gain
  // anyone found for this style -- and it still did not clear Balanced (-0.70 to -0.22), so it paid
  // distinctness for a result it did not achieve. The reason it looked like a gain is the same
  // reason every style below Balanced looked fixable by deletion: an all-zero stamp IS the engine's
  // unconstrained optimum, so ANY instruction reads as a cost. That is an engine problem, not a
  // stamp problem, and it is being fixed at the source. Do not re-apply this without re-measuring
  // once instruction coherence is in.
  possession:    { pressingLOE: 0, passingDir: -1, approachPlay: -1, possLost: 0,
                   possWon: -1, tackling: -1 },
  // Width, overlaps, and licence to take a man on.
  wingplay:      { passingDir: 1, approachPlay: 1, creativity: 1, dribbling: 1, width: 2 },
  // Sit off, then hurt them the moment it breaks.
  counterattack: { gkDist: 1, pressingLOE: -2, defLine: -1, passingDir: 2, approachPlay: 1, possLost: -1,
                   possWon: 1, chanceCreation: 1 },
  // Skip the middle third entirely. Distinct from Counter by NOT sitting deep to earn the ball.
  routeone:      { gkDist: 1, pressingLOE: 0, defLine: 0, passingDir: 2, approachPlay: 1, possWon: 1,
                   chanceCreation: 1, creativity: -1, dribbling: -1, tackling: 1 },
  // The deep block that still intends to score: absorbs like Park The Bus, breaks like Counter,
  // and sits deeper and more disciplined than either. Its whole value is the transition.
  // dribbling: -1 is gone for the same reason it left Cholismo, and the measurement is the same
  // shape: worst style in the game at -0.30 goal difference, fewest shots (8.2) and fewest goals
  // (1.03) despite allowing a mid-table 14.9%. It was not defending badly, it was not breaking.
  // Five candidates at 260 fixtures each, where a real difference needs about 0.26 GD: dropping
  // dribbling was worth +0.31 and nothing else cleared the bar. Shots 8.2 -> 9.1, scored 1.03 ->
  // 1.23, conceded 1.33 -> 1.22 -- it improves at BOTH ends, which is what a side that can finally
  // carry the ball out looks like.
  // The block itself is untouched: pressingLOE -2 is where it presses from. What moves is where the
  // ball is when this side HAS it, 35.3 m to 40.0 m, and that is the counter actually happening.
  //
  // defLine -2 -> -1, AND IT IS THE ONLY INSTRUCTION IN THIS STAMP THAT WAS COSTING ANYTHING.
  // Taken apart axis by axis against the full field, 180 blocked fixtures an arm: dropping defLine
  // was worth +0.73 goals and nothing else in the stamp cleared its own error. Every other
  // instruction is EARNING -- possWon -0.30, width -0.28, passingDir -0.17, approachPlay -0.12, so
  // the side is worse without them. It is not a broken setting at -2 either; depth is penalised
  // about 0.25 goals a rung all the way down, because the four styles at the top of the table
  // (Route One, Wing Play, Second Ball, Gegenpress) all feast on a deep line and nothing punishes
  // them back. One rung up puts this style at +0.16 against Balanced's +0.02, which is the whole
  // point of the change, and it is still in the deepest tier in the game beside Zona Mista.
  // Park The Bus is NOT fixable this way -- at -1 it is still -0.09, below Balanced. See its note.
  catenaccio:    { gkDist: 1, pressingLOE: -2, defLine: -1, passingDir: 2, approachPlay: 1, possLost: -1,
                   possWon: 1, chanceCreation: 1, creativity: -1, tackling: -1, width: -1 },
  // The deep block that does not. Holds shape, kills the game, concedes the ball on purpose --
  // except it did not concede it. Measured at 52.1% possession, second most in the game and ahead of
  // Tiki-Taka, while passing more (120 a match) and completing more (80.8%) than any side in the
  // list. A bus that outpasses Tiki-Taka is not a bus.
  // Leave-one-out found one axis responsible and it was not the obvious one: dropping `tackling`
  // alone was worth -4.7pp, five times any other instruction in the vector. Get Stuck In was winning
  // it 17.4 times a match and every one of those is a turnover in its own favour. Stay On Feet is
  // also how a low block actually defends -- diving in is what breaks the block, which is why
  // Catenaccio has carried -1 all along.
  // approachPlay biases the CLEAR option in decide.ts, so at 0 this side never hoofed it, it
  // recycled among the back four; and passingDir 1 asked for 20 m balls, which in its own third
  // means short, safe and kept. The three together land it at 44.6% with MORE clearances, and it
  // both scores more (1.11 -> 1.23) and concedes less (1.34 -> 1.14) than the version that hogged
  // the ball. Two axes still separate it from Catenaccio, and they are the two that matter:
  // possWon -1 rather than +1, and no Shoot On Sight. It absorbs and it does not break.
  // timeWasting is what keeps it from BEING Catenaccio. Taking tackling out fixed the possession
  // profile and left the two indistinguishable -- 45.2 / 44.9 possession, 36.2 / 35.7 up the pitch,
  // 6.8 / 6.7 clearances, a 0.03 gap in goal difference against a 0.09 standard error -- because
  // possWon and chanceCreation, the two axes meant to carry the difference, are both worth less than
  // the noise. Killing the game is the one thing this style does that a side trying to counter must
  // not, and the engine charges for it properly: dead time comes back at 55% and the caution is the
  // price, and it only applies while in front. Measured separation goes 0.66 to 2.12 with goal
  // difference untouched.
  // The cost, stated: holding the ball longer means carriers travel further before releasing it, so
  // this sits 2.6 m higher up the pitch than it did and Catenaccio is now the deeper of the two.
  // MEASURED, +0.90 goals against the field (se 0.16), -0.53 to +0.37 -- the largest single gain in
  // the table, and it clears Balanced at +0.02. Three axes, each measured as a cost INSIDE this
  // stamp rather than guessed: defLine -2 -> -1, possLost -1 -> 0, pressingLOE -2 -> -1.
  // It still parks, and it is still the deepest tier in the game beside Zona Mista. What it stops
  // doing is parking so far back that it cannot get out. At -2 its shooter received the ball 33.2 m
  // from goal and carried it 28.3 m, taking 18% fewer shots than a neutral line at identical chance
  // quality (0.124 xG against 0.132) -- and it conceded MORE shots from CLOSER while standing 7.81
  // men in its own box against 6.97. More bodies, more shots, nearer the goal.
  // Two thirds of what depth cost this side was at the OTHER end: goals for 0.98 against 1.30.
  // Four things that did NOT fix it are recorded in engine/config.ts beside lineADefL, with their
  // numbers. Read those before touching this again.
  // possWon -1 -> +1. A side that parks the bus and then KEEPS the ball is the one contradiction
  // left in this stamp, and it is measured rather than argued: it takes 39.6% of its shots from
  // turnovers where a neutral line takes 44.1%, and the engine had it at 52.1% possession, second
  // most in the game. Park it and hit them on the break, which is what the style is.
  parkthebus:    { gkDist: 1, pressingLOE: -1, defLine: -1, passingDir: 2, approachPlay: 1, possLost: 0,
                   possWon: 1, creativity: -1, dribbling: -1, tackling: -1,
                   timeWasting: 2, width: -1 },
  // ── The four below fill holes the first ten left. Measured before being named: the press-by-line
  // grid had FOUR styles stacked on (0,0), nothing at all on pressingLOE -1, and nothing anywhere
  // off the diagonal -- every style either pressed high from a high line or sat deep behind a low
  // one. These occupy the empty cells.
  //
  // Compact in the middle third, deny the centre, never chase. The only style on pressingLOE -1,
  // and the answer to "what sits between Gegenpress and Counter", which was nothing.
  // A mid-block defends narrow and deep; it does not refuse to run with the ball. dribbling: -1 was
  // the only axis in this vector doing real damage -- leave-one-out moved shots by at most 1.5 for
  // everything else, while dropping dribbling was worth +0.54 goals and 4.9 m of territory. The rest
  // of the vector measured as working: sitting deeper IS the style, and 33 m up the pitch is a
  // mid-block behaving like one rather than a fault.
  // tackling +1, measured once the drill equilibrium was fixed: +0.46 goals against a twelve-style
  // field on paired seeds -- and it earned that while still being CHARGED for the old clash rule
  // that called a low press with hard tackling a contradiction. A mid-block that bites when you
  // enter it is the whole brand; the rule was wrong, not the stamp, and it is gated one-way in
  // engine/config.ts now. possWon +1 was measured alongside and rejected at -0.51: a mid-block
  // that sends breakers the moment it wins it leaks the shape it just defended with.
  cholismo:      { pressingLOE: -1, defLine: 0, passingDir: 1, possLost: -1, creativity: -1, width: -1,
                   tackling: 1 },
  // Go long, then hunt the knock-down. The one style that presses HIGH from a LOW line, which
  // nothing else in the list does. possLost Counter-Press is the whole point rather than a
  // trimming: swarming the second ball IS the style, and without it this was two axes from
  // Counter and read as a rename of it.
  // ...AND IT WAS A RENAME OF ROUTE ONE INSTEAD. Measured at 0.45 rms z-distance, the closest pair
  // in the game, and the stamps say why: eight of the instructions were byte-identical to Route
  // One's and all three differences were defensive, so the two had the same attack by construction.
  // Pass length 21.1 against 21.2, long balls 51% against 52%, shot distance 13.7 against 13.6,
  // fouls 13.4 against 13.4.
  // The high-press-from-a-low-line signature does not separate them because it cancels ITSELF:
  // pressingLOE and defLine both feed meBlock's wantLine at blkDefLine 6 m a step against blkLoe's
  // 3, so -1 line and +1 press nets to three metres DEEPER, and this side wins its tackles at 50.8 m
  // against Route One's 53.6 -- pressing lower than a side carrying no press instruction at all.
  // The signature is kept because it is the design; the separation comes from the one thing the
  // concept names that Route One has no claim on. You do not spread out to contest a knock-down,
  // you compress around where it lands.
  // DIRECT, NOT ROUTE ONE. passingDir 2 is the biggest single buff in the game -- worth +0.37 on the
  // isolated axis, more than twice anything else -- and the two styles that maxed it finished first
  // and second head to head, with this one beating all thirteen opponents and its WORST result still
  // a win. Nothing else in the game has no bogey team.
  // Dropped to 1, which also sharpens the pair: Route One keeps 2 and is THE long-ball style; this
  // one goes direct and contests the knock-down, which is what its name says and what the width
  // stamp already expresses.
  // defLine -1 -> 0. A second-ball side fights for knock-downs from a compact MID block; it does
  // not defend deep AND press high at the same time, which is what -1 alongside pressingLOE +1
  // was asking for.
  secondball:    { gkDist: 1, pressingLOE: 1, defLine: 0, passingDir: 1, approachPlay: 1, possLost: 1,
                   possWon: 1, chanceCreation: 1, creativity: -1, dribbling: -1, tackling: 1, width: -1 },
  // The deep block that builds instead of clearing. Catenaccio's line with Control Possession's
  // patience, then Counter's intent once it is out.
  zonamista:     { pressingLOE: -1, defLine: -1, passingDir: -1, approachPlay: -1, possWon: 1,
                   possLost: -1 },
  // Everything forward, nobody disciplined. This is the build that used to be worth +3.3 a season
  // when a user could assemble it slider by slider; it measures under +1 now, which is the only
  // reason it can exist as a named option instead of a exploit.
  // ...BUT NOT LONG. It carried passingDir 1 and approachPlay 1 together, which is a preference for
  // the longer ball plus a taste for clearing it, and once directness became an instruction that
  // actually reaches the pitch that is what it played: a mean pass of 20.7 m with 43% of them
  // lofted, which is Route One's profile under the name of the most technical style in football.
  // La Nuestra is la gambeta -- short, on the deck, through the middle, with the licence to beat a
  // man. The expression stays (dribbling, creativity, shoot on sight, and pressing high to get it
  // back); the long ball goes, and it no longer hoofs it clear.
  // chanceCreation +1 -> 0. Short passing and shoot-on-sight pull against each other. La Nuestra is
  // about working the opening and individual brilliance, not speculative efforts -- but this is the
  // most arguable of the five, so it goes to NO instruction rather than asserting the opposite.
  lanuestra:     { pressingLOE: 1, defLine: 1, passingDir: -1, approachPlay: 0, chanceCreation: 0,
                   dribbling: 1, creativity: 1, possWon: 1, possLost: 1 },
};

// A player carrying coach instructions (p._ci, written by the manager layer in meChase) plays
// the side's instructions plus his own, clamped to the legal range. Everyone else costs one
// truthy check and no allocation.
export const meCoachSt = (st, p) => {
  if (!p || !p._ci) return st;
  const o = { ...st };
  for (const k in p._ci) {
    const r = ME_STRAT_RANGE[k] || [-2, 2];
    o[k] = Math.max(r[0], Math.min(r[1], (o[k] || 0) + p._ci[k]));
  }
  return o;
};
// THE MANAGER'S READ OF THE FLOW. meChase reads the scoreline; this reads the match underneath
// it -- the windowed xG a side is conceding minus creating -- and answers a fixture that is going
// wrong before the score says so. There is no fixed minute: a side clearly being railed at 0-0 in
// the 25th gets its answer then.
//
// The window is an EWMA updated once a football minute: steady-state reads roughly
// netXgPerMin / (1 - decay), so a sustained deficit of ~1.0 xG per 90 sits near 0.17 and a true
// railing (~2.4 per 90) near 0.45. tau maps the MGMT rating between those: a sharp manager
// (99) steps in at tauSharp, a dinosaur (25) needs tauDull, and everyone stands down with
// hysteresis at tau * off so the response does not flap.
//
// Two prepared answers, chosen by where the side HOLDS the ball when it steps in (mean
// possession metres): pinned deep = break the siege (line up, press up, directer, faster);
// holding the ball but creating nothing = stop the sterile passing (directer, shoot sooner,
// wider, carry it). One notch per axis, always -- the leash is identity's, not the manager's --
// and MGMT gates only WHEN he moves and how fast, never how far. Like chasing, this is a
// reaction rather than a claim the squad suits the system, so squad fit does not damp it.
export const ME_MGR = {
  // THE TALK. What a manager is worth is guaranteed positive and scales with his rating, by
  // construction: at half time he retunes the whole side -- every behaviour his players run on
  // reads off OVR through meAttrs, so the talk lands as OVR points to every man (the drill
  // channel's own mechanism, ovr0 keeps the reports honest) plus legs back for the second half.
  // A sharper manager gives a better talk; nobody's talk makes his side worse.
  coach: true,
  htBase: 0.3, htSlope: 1.7,     // OVR points at the break: 0.73 at MGMT 25, 2.0 at 99
  // ...and DURING STOPPAGES: conceding stops the match, and the reorganisation while the ball
  // walks back is the same channel in miniature, on-pitch men only, capped across the match.
  stopInc: 0.15, stopCap: 0.6,
  // THE HALF-TIME SWITCH. In an extreme situation -- two down, or a goal down and clearly
  // outplayed, or level but battered -- the manager may abandon the plan, once, at the break,
  // and only for the ADJACENT style: each style's desperate pivot is the more aggressive
  // sibling that shares its football (tikitaka is already verticaltiki without the verticals;
  // a catenaccio that must chase becomes a counterattack, not a tiki-taka). His rating is his
  // read: a sharp manager recognises a lost cause at a smaller deficit, a dull one needs the
  // scoreboard to spell it out. The switch restamps the whole instruction vector, exactly as
  // the app does on the tactics panel, and the emergency plan keeps the kickoff drill bonus --
  // an undrilled restamp would be a second punishment for already losing.
  swAdj: { balanced: "secondball", tikitaka: "verticaltiki", possession: "tikitaka",
           zonamista: "counterattack", catenaccio: "counterattack", counterattack: "cholismo",
           cholismo: "secondball", parkthebus: "catenaccio", routeone: "secondball",
           secondball: "gegenpress", wingplay: "lanuestra", lanuestra: "verticaltiki",
           verticaltiki: "gegenpress", gegenpress: "verticaltiki" },
  sw1Xg: 0.9, sw0Xg: 1.8, swMgmt: 0.55,   // deficits shrink by swMgmt * (mgmt/99) of their base
  // THE FLOW-RESPONSE, delivered man by man. The trigger (the xG a side is conceding minus
  // creating, EWMA'd) and the MGMT gates are unchanged; what changed is where the answer lands.
  // A side-wide instruction stamp was measured useless against a railing (+0.02 at best), so the
  // manager now re-instructs INDIVIDUALS: the pin answer goes to the back line and midfield, the
  // blunt answer to the midfield and front line, each man carrying his own p._ci overlay on top
  // of the side's instructions -- read on the ball in meDecide, in the tackle in meTackle, and
  // as his own line and width in meShape.
  on: true,
  pinPos: { DEF: 1, MID: 1 }, bluntPos: { MID: 1, FWD: 1 },
  // The order MENU. The old design had two fixed vectors, so every railed match produced the
  // same order sheet -- the manager now composes his orders from what is actually failing, one
  // entry per diagnostic, in priority order, and his rating decides how many he may give: a
  // sharp manager reads four problems, a dull one grabs the first two. Conditions read the
  // match's own counters at the moment he steps in.
  ordMax: 2, ordMgmt: 2,          // orders = ordMax + round(mgmt01 * ordMgmt)
  sigCompLo: 0.62, sigCompHi: 0.74, sigShotsLow: 0.09,
  mgmtDef: 60,          // a club with no rated manager gets a league-average touchline
  decay: 0.94,
  tauSharp: 0.16, tauDull: 0.42,
  off: 0.5,             // stand-down threshold as a fraction of tau
  slewSharp: 0.30, slewDull: 0.10,
  pinBelow: 36,         // held deeper than this = pinned; the deepest style tier lives near 35
  pin:   { defLine: 1, pressingLOE: 1, passingDir: 1, tempo: 1 },
  blunt: { passingDir: 1, chanceCreation: 1, width: 1, dribbling: 1 },
};
export const ME_STRAT_RANGE = { defLine:[-2,2], pressingLOE:[-2,2], passingDir:[-2,2], tempo:[-2,2],
  chanceCreation:[-1,1], timeWasting:[0,2] };

// ── WHY HE WALKED ───────────────────────────────────────────────────────────────────────────
// A dismissal is not one offence and the difference is the ban: violent conduct costs three
// matches and a second yellow costs one, so a competition cannot count them the same. The engine
// decides DOGSO and serious foul play from the challenge itself -- where it happened and who was
// left behind it -- and rolls the two off-the-ball offences at a stoppage.
export const ME_RED_WHY = { second: "2nd Yellow", dogso: "DOGSO", sfp: "Serious Foul Play",
                            violent: "Violent Conduct", abusive: "Abusive Language" };
// How the feed says it. Same five reasons, worded to follow "is sent off,".
export const ME_RED_SAID = { second: "second yellow", dogso: "denying a goalscoring opportunity",
                             sfp: "serious foul play", violent: "violent conduct",
                             abusive: "abusive language" };

// ── WHAT HE DID TO HIMSELF ──────────────────────────────────────────────────────────────────
// One table, joint over the part and the injury, because those two are not independent and the
// old model treated them as though they were: it rolled a severity, rolled a body part, and had
// to carry an exclusion list to stop itself producing head sprains. Worse, a "Tear" was four to
// seven matches whether it was a hamstring or a cruciate ligament -- so the injury that ends a
// career and the one that costs a fortnight were the same event with different words on them.
//
// dur is MATCHES missed, min to max inclusive. The shape follows the UEFA elite-club injury
// picture: muscle strains are most of it and cost a week or two, thigh is roughly a third of
// everything, and the long ones are rare but real. THERE IS NO CEILING. A cruciate, an Achilles
// and a broken leg take the rest of the season, which is what they take.
//
// w is the relative weight. Totals land near: thigh 31%, knee 15%, ankle 13%, groin 11%,
// calf 10%, foot 7%, trunk 6%, head 4%, shoulder 3%.
export const ME_INJURY = [
  // ── thigh: the most-injured part of a footballer, and the hamstring most of that ──
  { id: "ham-strain",   part: "hamstring",   label: "Strain",            dur: [1, 2],   w: 95 },
  { id: "ham-tear",     part: "hamstring",   label: "Tear",              dur: [4, 9],   w: 30 },
  { id: "quad-strain",  part: "quadriceps",  label: "Strain",            dur: [1, 3],   w: 32 },
  { id: "thigh-dead",   part: "thigh",       label: "Dead Leg",          dur: [1, 1],   w: 30 },
  // ── knee ──
  { id: "knee-mcl",     part: "knee",        label: "Ligament Sprain",   dur: [3, 7],   w: 50 },
  { id: "knee-bruise",  part: "knee",        label: "Contusion",         dur: [1, 2],   w: 20 },
  { id: "knee-cart",    part: "knee",        label: "Cartilage Damage",  dur: [6, 14],  w: 14 },
  { id: "knee-acl",     part: "knee",        label: "Cruciate Rupture",  dur: [30, 42], w: 8 },
  // ── ankle ──
  { id: "ank-sprain",   part: "ankle",       label: "Sprain",            dur: [2, 5],   w: 60 },
  { id: "ank-lig",      part: "ankle",       label: "Ligament Damage",   dur: [6, 12],  w: 14 },
  { id: "ank-frac",     part: "ankle",       label: "Fracture",          dur: [12, 20], w: 4 },
  // ── calf and Achilles ──
  { id: "calf-strain",  part: "calf",        label: "Strain",            dur: [2, 4],   w: 45 },
  { id: "ach-tend",     part: "Achilles",    label: "Tendinitis",        dur: [3, 8],   w: 10 },
  { id: "ach-rupt",     part: "Achilles",    label: "Rupture",           dur: [32, 44], w: 4 },
  { id: "leg-frac",     part: "lower leg",   label: "Fracture",          dur: [18, 30], w: 3 },
  // ── groin and hip ──
  { id: "groin-strain", part: "groin",       label: "Strain",            dur: [2, 5],   w: 50 },
  { id: "add-tear",     part: "adductor",    label: "Tear",              dur: [5, 10],  w: 12 },
  { id: "hip-imp",      part: "hip",         label: "Impingement",       dur: [4, 10],  w: 6 },
  // ── foot ──
  { id: "foot-bruise",  part: "foot",        label: "Contusion",         dur: [1, 2],   w: 22 },
  { id: "foot-sprain",  part: "foot",        label: "Sprain",            dur: [2, 4],   w: 12 },
  { id: "meta-frac",    part: "metatarsal",  label: "Fracture",          dur: [9, 15],  w: 6 },
  // ── head and face. A concussion is short and non-negotiable; nobody plays on. ──
  { id: "concussion",   part: "head",        label: "Concussion",        dur: [1, 3],   w: 14 },
  { id: "head-cut",     part: "head",        label: "Laceration",        dur: [1, 1],   w: 8 },
  { id: "face-frac",    part: "cheekbone",   label: "Fracture",          dur: [2, 5],   w: 5 },
  // ── trunk ──
  { id: "back-strain",  part: "back",        label: "Strain",            dur: [2, 4],   w: 18 },
  { id: "rib-bruise",   part: "ribs",        label: "Contusion",         dur: [1, 2],   w: 14 },
  { id: "rib-frac",     part: "ribs",        label: "Fracture",          dur: [3, 6],   w: 5 },
  // ── shoulder ──
  { id: "sh-sprain",    part: "shoulder",    label: "Sprain",            dur: [2, 4],   w: 12 },
  { id: "sh-disloc",    part: "shoulder",    label: "Dislocation",       dur: [5, 10],  w: 5 },
  { id: "clav-frac",    part: "collarbone",  label: "Fracture",          dur: [8, 14],  w: 3 },
];
// Anything past this is gone for the season on any ordinary calendar; used only to say so.
export const ME_INJ_SEASON = 30;

export function mePickInjury(rng) {
  let t = 0;
  for (const v of ME_INJURY) t += v.w;
  let r = rng.u() * t;
  for (const v of ME_INJURY) { r -= v.w; if (r <= 0) return { sev: v, part: v.part }; }
  const last = ME_INJURY[ME_INJURY.length - 1];
  return { sev: last, part: last.part };
}
