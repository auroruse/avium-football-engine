// Every tuning number the match engine has, in one place and mutable at runtime, so a sweep or a
// tactical preset is DATA rather than an edit to source. Nothing here changes behaviour on its own;
// each field is read live by the module named in its comment.
export const CFG = {
  // The worth of simply still having the ball afterwards. Without it a safe sideways pass scores near
  // zero and nobody ever recycles possession.
  keep: 0.030,
  // How much a ball is worth for the ground it gains, per metre. Without a real term here the safest
  // option is always to pass sideways, and since keeping the ball scores the same wherever it is, the
  // optimal policy is to recycle in your own third for ninety minutes -- which is exactly what the
  // engine did once midfield pressing was correctly switched off: 527 passes at 96% and no shots.
  fwdPull: 0.00022,
  // What it costs to give the ball away here: the opponent starts a possession, and the closer to your
  // own goal the worse that is. Without this term the expected value of a pass was ok*value with no
  // downside, so a 50% ball into the box outscored a 95% square pass every time -- completion sat at
  // 70% against a real 80% and far too much of it reached the box.
  loss: 0.12,
  // How fast running with it stops working as defenders close. At 0.055 a carry retained 88% with a
  // man on him, so the safest option was always to keep running and passing collapsed to a fifth of
  // its real rate. Real dribble success under genuine pressure is closer to half.
  carryRisk: 0.16,
  carryAdv: 4.5,
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
  passFloor: 0.34,
  carryFloor: 0.46,
  // Tackling, per tick of contact. Ablation put almost the entire rating-gap blowup here and nowhere
  // else: switching this duel off alone took a +20 game from 8.71 GD to 3.29, and took the weaker
  // side from 2.3 shots to 20. The cause is that this is rolled every tick a defender is in reach, so
  // whatever edge it carries is raised to the power of the ticks in contact -- a 1.28x per-tick edge
  // became 1.5x per possession and a rout over a match. Hence a deliberately narrow band.
  tackleLo: 0.170,
  tackleHi: 0.200,
  tackleK: 26,
  // Marking distance. This is geometry, not skill, so tightening it makes the game harder for everyone
  // equally -- it lowers chance quality without touching the rating gap, which is exactly the knob to
  // reach for once the skill-dependent duels are bounded.
  markBase: 2.10,
  markTighten: 1.10,
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
  sepW: 0.55,
  // And a leash: however urgent the job, a player may not stray more than this from the zone his role
  // gives him. This is what stops one contested ball dragging eleven men into the same square.
  leash: 15,
  leashPress: 24,
  leashRun: 30,
  jockeyR: 3.4,
  interceptW: 1.9,
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
  recvPress: 1.40,
  foulP: 0.9958,
  // Bodies in the way. About a third of real shots never reach the keeper, and this is the honest place
  // to put that: it depends on how many defenders are between the shooter and the goal, not on how
  // good anybody is, so it lowers scoring without touching the rating gap.
  blockK: 0.28,
  blockMax: 0.58,
  // ============ TACTICAL BRAIN ==============================================================
  // A pyramid, not a pile of rules. One brain per team reads the game and classifies the phase; two
  // coordinators hand out jobs from that; each player then solves only his own small problem; the
  // steering layer makes it look like running. The thing this fixes is the one every football game
  // gets wrong first -- six players charging the ball at once -- because "press" is now a job that
  // exactly one player holds, and everyone else has been given something better to do.
  balLag: 0.055,
  settleTicks: 40,
  phaseHyst: 6,
  // Off-ball brains are staggered rather than run every slice: a quarter of the side re-evaluates each
  // tick, so the cost is spread and nobody twitches.
  brainStride: 4,
  // ---- off-ball runs -------------------------------------------------------------------------
  // A run is a committed movement through time, not a position. This is most of what attacking
  // movement actually IS, and its absence is why the side looked like eleven men standing in a shape:
  // the "runner" duty only held a higher line, and nobody ever went anywhere.
  runTicks: 14,
  runCool: 110,
  offsideGrace: 2.2,
};
export type EngineConfig = typeof CFG;

// A side with no instructions set. The engine owns this rather than importing the app's STRAT_DEF,
// which is what keeps the dependency one-way: the UI imports the engine, never the reverse.
export const NO_INSTRUCTIONS = { passingDir:0, chanceCreation:0, pressingLOE:0, defLine:0, possWon:0,
  approachPlay:0, dribbling:0, creativity:0, setPieces:0, timeWasting:0, possLost:0, gkDist:0,
  dlBehavior:0, tackling:0 };
export const DEFAULT_OVR = 60;
