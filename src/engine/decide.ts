// On-the-ball decisions: shoot, pass, carry or clear, scored as expected goals.
import { CFG, NO_INSTRUCTIONS } from "./config";
import { meAtkW, meAttrs } from "./attributes";
import { ME_HALF_W, PITCH_L, PITCH_W, meDanger, meDir, meGoalX, meGroundT, meLaneBlock, meOffsideLine, meOther, mePassRisk, mePressure, meShotGeom, meTimeToBallMs, meVal, meValHere } from "./geometry";
import { meGroundSpeed, meLoftFor } from "./ball";
import { meMind } from "./attributes";
import { meOppDist } from "./brain";
import { meSpeed } from "./attributes";
import { meTick } from "./match";

// Live-tunable: xgK and shotWorth moved onto CFG so calibration sweeps actually reach them --
// as module constants they were dead knobs and a sweep over them measured pure seed noise.
export const ME_XG_K = 0.143;

export function meShotP(s, side, p, x, y) {
  const g = meShotGeom(side, x, y);
  if (g.d > 40) return 0;
  const a = meAttrs(p);
  // Base conversion from geometry alone, then the finisher, then how hurried he is.
  let q = Math.exp(-g.d * (CFG.xgK ?? ME_XG_K)) * Math.min(1, g.ang / 0.42) * 0.78;
  // The finisher. This slope dates from when execution noise was nearly flat and sp carried the
  // whole of what a finisher was worth; meShootBall now takes meTech, so real skill spread lives in
  // the strike itself and a steep slope HERE double-counts it -- worse, it is a slope on the
  // ESTIMATE, so a poor finisher rationally declines shots a real one takes. Measured, shots per
  // final-third entry fell 0.55 -> 0.38 from the 85 band to the 55 band while real shot counts are
  // nearly flat across divisions. Kept on attr/99, anchored at 75, sweepable.
  q *= CFG.shotFinBase + a.shoot / 99 * CFG.shotFinSkill;
  q *= 1 / (1 + mePressure(s, side, x, y) * 0.35);
  // Bodies between him and the goal, which is most of what separates a chance from a half-chance.
  // Tried and rejected: scoring this as the share of the GOAL MOUTH screened -- each defender's
  // shadow projected onto the goal plane and unioned -- instead of as a pass corridor, on the
  // finding that a block with 6.24 men in its own box returned 1.03 here where one with 4.82
  // returned 0.98. The geometry was right -- project each defender onto the goal plane along the ray
  // from the striker, union the intervals, divide by 7.32 -- and it is not worth writing again.
  // It fails, and it fails for a reason worth writing down: CONDITIONAL ON A SHOT BEING TAKEN, THE
  // SHOOTER HAS ALREADY FOUND A CLEAR LINE. He chose the spot. So a measure of "is my line blocked"
  // reads about the same whoever is defending, however many of them are in the area -- swept over
  // coverScale 2 / 3.5 / 5 / 6.5 / 8, the deep block conceded MORE xG than the mid block at every
  // single setting (1.09 / 1.04 / 1.05 / 1.00 / 0.89 against 0.77 / 0.77 / 0.80 / 0.90 / 0.88), so
  // the ordering this was built to invert never inverted. The quantity is also much smaller than
  // the one it replaced -- lane0 came out 0.30-0.47 against 0.98 -- which halved the crowding
  // penalty, took shots conceded from 5.8-8.4 up to 9-12 and goals a match from 2.80 to 2.73-3.57.
  // A low block cannot be made to pay in the QUALITY of the shots it allows. It has to pay in how
  // many it allows and from where, which is the carry and pass models, not this line.
  const lane0 = meLaneBlock(s, side, x, y, meGoalX(side), ME_HALF_W);
  const clearMax = 1 + (CFG.shotClear - 1)
    * Math.max(0, Math.min(1, 1 - (g.d - CFG.shotClearD) / CFG.shotClearFade));
  q *= Math.max(CFG.shotCrowd, Math.min(clearMax, clearMax - lane0 * CFG.shotLaneK));
  // The keeper. Absolute: his reflexes against this shot, nothing to do with who he plays for.
  const gk = s.players[meOther(side)].find(q2 => q2.pos === "GK");
  if (gk) {
    // WHERE HE IS, not just how good he is. This read his reflexes and nothing else, so a keeper
    // stranded thirty metres upfield discounted the shot exactly as much as one stood on his line --
    // an open net was priced as an ordinary save and the man in front of it rationally declined to
    // shoot. He cannot save what is already behind him, and he cannot save what is across the goal
    // from where he is standing.
    const gxg = meGoalX(side), dr = meDir(side);
    const behind = Math.max(0, (x - gk.x) * dr);          // shooter nearer the goal than the keeper
    const lat = Math.abs(gk.y - y);
    const beat = Math.max(0, Math.min(1, (behind / CFG.gkBeatX + lat / CFG.gkBeatY) / 2));
    const D = Math.max(0.22, 1.24 - meAttrs(gk).reflex / 99 * 0.70);
    q *= (D + (1 - D) * beat) * (gk.emergencyGK ? 1.35 : 1);
  }
  return Math.max(0, Math.min(0.95, q));
}

// ---- the decision -----------------------------------------------------------------------
// Every option is scored as "how much is the ball worth after this, times the chance it comes off".
// Instructions move the SCORES, never the success rolls. Asking for more direct passing really does
// mean attempting balls that get cut out more often, and that asymmetry is the whole design.
export const ME_SHOT_WORTH = 1.0;    // a shot is worth exactly its xG now; the constant survives only so
                              // chanceCreation has something to scale. See mecal.mjs.

// Set to an array to have every decision record what it considered. Off in normal play.
export let ME_DBG = null;

export const meSetDbg = (v) => { ME_DBG = v; };

// `dwell` is how many slices he is PAST his touch budget. Zero means he still has time to look up.
export function meDecide(s, rng, side, i, dwell) {
  const ps = s.players[side], p = ps[i], a = meAttrs(p), st = s.strategy?.[side] || NO_INSTRUCTIONS;
  const isGK = p.pos === "GK";
  const mp = s.mePos, press = mePressure(s, side, p.x, p.y), here = meVal(side, p.x, p.y);
  const off = meOffsideLine(s, side), dir = meDir(side);
  // How shut is the route to goal? Bodies goal-side of him in his channel, plus how covered the
  // line to the goal itself is. This gates recycling: a side plays it backwards to find space when
  // the defence is set, and a man with a clear run at goal does not recycle at all.
  // A clear run at goal: the lane is open and he is near enough for it to be a chance. From here he
  // shoots or he runs at it. He does not turn round, whatever the arithmetic says about a safe ball.
  let goalSide = 0;
  for (const q of s.players[meOther(side)]) {
    if (q.pos === "GK") continue;
    if ((q.x - p.x) * dir > 0 && Math.abs(q.y - p.y) < 20) goalSide++;
  }
  // THROUGH ON GOAL IS A SITUATION, NOT A DISTANCE. Capping the rule at 32 m from goal meant a man
  // who broke the line around halfway -- which is exactly what "he has dribbled past the defence"
  // means -- fell outside it, and his shot probability from out there is 0.000 so the other gate did
  // not catch him either. Measured, every backpass that survived with nobody goal-side of him sat in
  // the 40-50 m band. Nobody in front of him and a clear run at the goal IS being through, wherever
  // on the pitch it happens, and from there he does not turn round.
  // Either way of being through counts, and the first version REPLACED one with the other instead of
  // adding it -- which stopped covering a man twenty metres out with bodies around him but a clear
  // sight of goal, and the backpass rate went up rather than down.
  const runAtGoal = meLaneBlock(s, side, p.x, p.y, meGoalX(side), ME_HALF_W) < CFG.noBackLane
    && (goalSide === 0 || Math.abs(meGoalX(side) - p.x) < CFG.noBackRange);
  const shut = Math.max(0, Math.min(1,
        Math.min(1, goalSide / 3.5) * 0.65
      + Math.min(1, meLaneBlock(s, side, p.x, p.y, meGoalX(side), ME_HALF_W) / 3) * 0.35));
  // Every option below is scored the same way -- what you gain times the chance of getting it, minus
  // what you lose times the chance of not. Charging that cost to passes ALONE made carrying strictly
  // dominant and passing collapsed to a fifth of its rate, so it has to be applied to all three.
  // How hard this player takes his orders. See CFG.obeyBase -- and CFG.creObey, because creative
  // freedom IS this quantity: Expressive backs his own read over the touchline, Disciplined does
  // what the side was told to do. Note this multiplies styleW and riskM below, so it reaches every
  // instruction the side carries rather than adding a channel of its own.
  const obey = (CFG.obeyBase + CFG.obeySpan * (1 - meMind(p)))
             * (1 - (st.creativity || 0) * CFG.creObey);
  const styleW = CFG.styleW * obey;
  // HOLD SHAPE, in the seconds after winning it. The instruction had exactly one channel and it was
  // a removal -- `if (brk < 0) return` in meRuns, which withholds runners -- so it gave things up
  // and bought nothing back: measured, it scored 0.18 fewer than neutral and saved 0.05. Not
  // breaking is only half of it. The other half is that the man who has just won the ball MAKES SURE
  // OF IT, and that is a risk appetite for a few seconds rather than a shape. Counter needs no
  // equivalent here: its channels are the extra runner and the depth gate, and both already bite.
  const held = (st.possWon || 0) < 0 && mp.side === side && mp.possT < CFG.transT ? CFG.holdSafe : 0;
  // Risk appetite multiplies EVERY loss term below, so it has to be a factor rather than an offset.
  const riskM = Math.max(0.3, 1 - (st.creativity || 0) * CFG.styleRiskW * obey + held);
  const lose = CFG.loss * riskM * (0.35 + meDanger(meOther(side), p.x, p.y));
  let best = null, bestSc = -Infinity;
  // He does not see his own options perfectly. Every score below is what he THINKS it is worth, and
  // how far that is from the truth is his rating. A good player's ranking is nearly right; a poor one
  // rates the shot that is not on above the pass that is, and takes it. Nothing here decides an
  // outcome -- it decides a CHOICE, and the choice is then played out by the same physics as anybody
  // else's. This is the whole of judgement: one term, applied to every option equally.
  const miss = CFG.judgeErr * (1 - meMind(p));
  // ...but the error is mostly in his reading of the SITUATION, so it is CORRELATED across options
  // of the same kind. Drawn independently per option it stops being judgement and becomes a raffle
  // the biggest ticket-holder wins: a decision menu holds one shot and twenty-odd passes, and the
  // maximum of twenty independent draws beats one draw structurally -- by about sigma * sqrt(2 ln n)
  // -- so the noisier the player, the more the menu itself steered him away from shooting. Measured,
  // shots per final-third entry fell 0.55 -> 0.38 from the 85 band to the 55 band, and with the
  // jitter forced to zero the gradient INVERTED (0.58 / 0.64 / 0.70) -- the collapse was never his
  // finishing, his range, or the defence, it was the raffle. Flattening the finisher term in sp did
  // nothing (swept 0.18-0.80); this is the whole mechanism.
  // One draw per CLASS carries judgeShare of the variance -- misreading the moment moves every pass
  // together -- and each option keeps its own residue, so a poor player still picks the wrong pass
  // as well as the wrong kind of action. Per-option variance is unchanged; only the correlation is
  // new, so judgement stays exactly as costly as it was calibrated to be.
  const clsW = Math.sqrt(CFG.judgeShare), ownW = Math.sqrt(1 - CFG.judgeShare);
  const cls = { shot: (rng.u() + rng.u() - 1), pass: (rng.u() + rng.u() - 1),
                carry: (rng.u() + rng.u() - 1), clear: (rng.u() + rng.u() - 1) };
  const jit = (c) => (clsW * cls[c] + ownW * (rng.u() + rng.u() - 1)) * miss;
  // Shoot.
  const sp = meShotP(s, side, p, p.x, p.y);
  // A hopeless shot is not an option, it is a giveaway. Every other option is scored against losing
  // the ball, so when a man is swamped and nothing is on, a shot worth a tenth of a percent can win
  // simply by being the least negative thing available -- which is where an attempt from forty
  // metres comes from. He clears it or he keeps it; he does not shoot from his own half.
  if (sp > CFG.shotMinP) {
    // Nothing between him and the goal IS the reason to have a go, and how far out that reason
    // survives belongs to the finisher rather than to a fixed threshold.
    const gsh = meShotGeom(side, p.x, p.y);
    const lane = meLaneBlock(s, side, p.x, p.y, meGoalX(side), ME_HALF_W);
    const range = CFG.shotRange + a.shoot / 99 * CFG.shotRangeSkill;
    const sight = Math.max(0, 1 - lane / CFG.shotLaneClear)
                * Math.max(0, Math.min(1, 1 - (gsh.d - range) / CFG.shotRangeFade));
    // Would carrying closer improve this chance, or ruin it? meShotP already knows about the bodies
    // in the lane and the pressure at a point, so ask it about the spot he would dribble to.
    const spAhead = meShotP(s, side, p, p.x + dir * CFG.carryAdv, p.y);
    const nowBetter = sp > spAhead ? (sp - spAhead) / Math.max(sp, 1e-4) : 0;
    const appetite = 1 + meAtkW(p) * 0.30 + sight * CFG.shotSight + nowBetter * CFG.shotNowW;
    // CHANCE CREATION IS A RANGE, the same way passing directness is. It used to multiply the value
    // of the shot itself by up to 1.55, which is an instruction to misjudge how good a chance is --
    // and against a shot model that is roughly right, misjudging it can only cost you. Measured, it
    // moved mean shot distance all of 1.4 m for its trouble. A preferred range moves where the shots
    // come from without touching what any of them is worth: work it into the box and he waits for a
    // better one, shoot on sight and he will take it from twenty yards. Both are defensible; that is
    // the point of a tactic.
    // Charged RELATIVE to the neutral range, so an instruction left at zero is exactly a no-op --
    // as an absolute penalty it moved shots from outside 15 m from 40% to 32% with nobody having
    // asked for anything. A tactic must cost nothing until it is set.
    // THE SIGN WAS BACKWARDS. Read the paragraph above: shoot on sight takes it from twenty yards.
    // The line said `shotWant - chanceCreation * shotWantStep`, so Shoot On Sight asked for a
    // preferred range of 9 m and Work Ball Into Box asked for 19 -- each instruction did the other
    // one's job. Measured across the five styles stamped Shoot On Sight, they took the SHORTEST
    // shots in the game: Counter and La Nuestra at 11.7 m against Tiki-Taka's 12.6 on Work Ball In.
    // It never showed up because the term was too weak to move anything: mean shot distance ran
    // 11.7-12.9 m across all fourteen styles, so the whole axis was 1.2 m wide and pointing the
    // wrong way inside that.
    // ONE-SIDED, because nobody declines a tap-in. For passing a preferred length cuts both ways --
    // a short side really does not want the thirty-metre ball -- but no forward alive turns down six
    // yards because he was told to shoot from distance. The instruction moves where distance STARTS
    // costing him, and closer than that is always free.
    // Still charged relative to neutral, so an instruction left at zero remains exactly a no-op.
    const wantD = CFG.shotWant + st.chanceCreation * CFG.shotWantStep;
    const offWant = Math.max(0, gsh.d - wantD - CFG.shotBand)
                  - Math.max(0, gsh.d - CFG.shotWant - CFG.shotBand);
    const sc = sp * (CFG.shotWorth ?? ME_SHOT_WORTH) * appetite - (1 - sp) * lose * 0.32
             - offWant * CFG.shotWantW;   // a miss is only a goal kick
    if (ME_DBG) ME_DBG.shot = sc;
    const j = sc + jit("shot");
    if (j > bestSc) { bestSc = j; best = { k: "shot", p: sp }; }
  }
  // Pass.
  for (let j = 0; j < ps.length; j++) {
    if (j === i) continue;
    const q = ps[j];
    // Two different balls to the same man, scored against each other: one to his feet, one into the
    // space in front of him. Which is right is the passer's decision, not a property of the receiver.
    for (let mode = 0; mode < 2; mode++) {
    let aimX, aimY, thru = false;
    if (mode === 0) { aimX = q.x; aimY = q.y; }
    else {
      // Into space. Solve the lead so the ball and the man arrive together: guess the furthest
      // sensible ball, see how long it takes, and only play it as far as he can actually run.
      const rvx = (q._runT > 0 && q._run === "behind") ? (q._rx - q.x) : dir * CFG.thruMax;
      const rvy = (q._runT > 0 && q._run === "behind") ? (q._ry - q.y) : 0;
      const rl = Math.hypot(rvx, rvy);
      if (rl < 0.5) continue;
      const ux = rvx / rl, uy = rvy / rl;
      const d0 = Math.hypot(q.x + ux * CFG.thruMax - p.x, q.y + uy * CFG.thruMax - p.y);
      const tB = meGroundT(d0, d0);
      const lead = Math.max(CFG.thruMin, Math.min(CFG.thruMax, meSpeed(meAttrs(q), q.stamina) * tB));
      aimX = q.x + ux * lead; aimY = q.y + uy * lead;
      if (aimX < 2 || aimX > PITCH_L - 2 || aimY < 2 || aimY > PITCH_W - 2) continue;
      thru = true;
    }
    const dx = aimX - p.x, dy = aimY - p.y, d = Math.hypot(dx, dy) || 0.1;
    if (d > 55) continue;
    // OFFSIDE, AS HE SEES IT. A man running in behind gets the benefit of the doubt for a couple of
    // metres, which is what makes a through ball possible at all. But where the line IS, at the
    // moment he strikes it, is a judgement made at speed by somebody facing the other way -- he is
    // not a linesman and he does not have the freeze-frame. He used to: the old rule vetoed every
    // ball to a man an inch beyond the line, so offside could not happen and the trap had no payoff.
    // His perception carries error scaled by his rating, which errs BOTH ways -- a poor player plays
    // the one that is off and declines the one that is on, and a good one judges it well.
    // ...and offside is being nearer the goal than the second-last man AND THE BALL, which is half
    // the law and the half that was missing here. Enforcement has it right -- see wasOff in
    // match.ts, which asks for both -- so the decision was refusing balls the referee would have
    // allowed: a man at the byline is beyond the last defender by definition, and every team-mate in
    // the area is too, so the veto fired on all of them. A cross is exactly that ball.
    // It did NOT restore crossing, and the measurement is here so nobody runs it again: 0.9 balls a
    // match from a wide attacking spot into the area against 1.4 before, which is noise on 30
    // matches. Crossing is not being declined -- there is nobody to cross to. 74% of every pass
    // struck in the final third has ZERO team-mates in the box, because the whole attacking shape is
    // clamped to the offside line (see meShape) and the offside line sits at 16.7 m while the area
    // starts at 16.5. Standing in the box is illegal for the entire match. That is a question about
    // how deep the defending block sits, and it lives in meAnchor.
    const slack = thru ? CFG.offsideGrace : 0.4;
    const seen = (q.x - off) * dir + (rng.u() + rng.u() - 1) * CFG.offBlind * (1 - meMind(p));
    if (seen > slack && (q.x - p.x) * dir > 0 && (q.x - PITCH_L / 2) * dir > 0) continue;
    const fwd = (aimX - p.x) * meDir(side);
    // Never backwards from a shooting position. Square and forward balls stay available -- a
    // team-mate better placed is a real reason to pass; turning round is not.
    if (fwd < -CFG.noBackDist && (sp > CFG.noBackShot || runAtGoal)) continue;
    // ...and when he is through, a SQUARE ball has to be earned as well. Rolling it across to a man
    // who is no better placed is handing off a chance for nothing -- the only reasons to pass from
    // there are that he has a better sight of goal or fewer bodies on him, so those are the only two
    // things that will do it. Anything that genuinely advances the ball is exempt.
    if (runAtGoal && fwd < CFG.sideAdvance) {
      const betterSight = meShotP(s, side, q, aimX, aimY) > sp * CFG.sideBetter;
      const freer = mePressure(s, side, aimX, aimY) < press - CFG.sideFreer;
      if (!betterSight && !freer) continue;
    }
    let blk = meLaneBlock(s, side, p.x, p.y, aimX, aimY);
    // The lofted alternative: over the press instead of through it. Ground physics makes a long
    // ground ball futile anyway (it arrives dead or needs an absurd strike), so past 26 m the loft
    // is the only real option; in between, it pays a flat tax so a ground pass wins any tie.
    let isHigh = false;
    // Tried and rejected: deriving this crossover from meGroundMaxD -- the distance past which the
    // launch the ODE asks for exceeds passMaxV, about 19 m -- instead of the literal 26, on the
    // grounds that the 19-26 m band is ground passes that physically cannot arrive. With the flight
    // time now honest they already score as the slow balls they are, and forcing the loft on top of
    // that read 12/21 against 13. The rule is redundant once the physics stops lying.
    // ...AND WHERE THAT CROSSOVER SITS IS A TACTIC. A ball went long on pure geometry, so nothing a
    // style could say ever made it go over the top: measured across the fourteen, the lofted share
    // ran 27-38% and was INVERTED -- Gegenpress hit more long balls than Route One, whose entire
    // description is skipping the middle third. Directness moves the crossover, which is what
    // choosing to play over a midfield rather than through it actually is.
    const loftAt = CFG.loftD - (st.passingDir || 0) * CFG.loftDir;
    if (d > loftAt) { blk = meLaneBlock(s, side, p.x, p.y, aimX, aimY, true); isHigh = true; }
    else if (d > 10) {
      const blkH = meLaneBlock(s, side, p.x, p.y, aimX, aimY, true);
      if (blkH * CFG.laneK + 0.45 < blk * CFG.laneK) { blk = blkH; isHigh = true; }
    }
    // Longer balls and covered lanes fail more. This is the only place directness is ever paid for.
    // Whether the RECEIVER is marked, which is the thing that was missing: success depended on the
    // lane and on the passer being closed down, but never on the man you were passing to being
    // picked up. With marking limited to a sensible few, that left every receiver free and
    // completion sat at 95% -- no turnovers, no shots, a match of endless sideways passing.
    const rPress = mePressure(s, side, q.x, q.y);
    let val0 = 0;
    // ...and how much that marking MATTERS depends on whether the ball is coming to his feet or over
    // the man marking him. A defender standing on your toes is most of why a ball rolled in is cut
    // out; he is very little of why a ball delivered above his head is not headed. This term did not
    // know the difference, so a lofted ball into a defended box was priced at a defended box's
    // ground-pass completion. The gates were never the problem: 82% of every candidate cross reached
    // the decision menu and was simply outscored, 95% of the time by carrying it instead.
    // STILL OUT BY FIFTEEN POINTS, and the number is here so the next person starts from it rather
    // than from a theory. Checked against the engine's own resolution -- what the decision believed
    // a ball into the box was worth, against what then happened to it -- the model expects 28-31%
    // and the physics delivers 43-50%, at every setting of this coefficient from 1.40 down to 0.15.
    // So this is not the term causing it. What is left is the pair that both count bodies near the
    // TARGET: the airborne lane block in meLaneBlock, which charges a dropping ball for every
    // defender within 4.5 m of where it lands using a ground pass's radius, and mePassRisk, which
    // charges for the same men again on the same geometry.
    const rp = isHigh ? CFG.recvPressHigh : CFG.recvPress;
    // WHAT A LONG BALL COSTS, and it is the only thing directness ever pays. Measured on the isolated
    // axis, Much More Direct plays SEVEN METRES further up the pitch, scores 0.34 more a match and
    // concedes 0.10 LESS, for three and a half points of completion -- a free lunch rather than a
    // trade, and the two styles that max it (Second Ball, Route One) finish first and second in the
    // head-to-head table with Second Ball beating all thirteen opponents.
    // Giving the ball away is nearly free when you give it away in their half, so the only lever that
    // can price directness is how often the long ball fails in the first place. It was a hard-coded
    // 0.0072 a metre; named and raised so a forty-metre ball is meaningfully worse than a twenty.
    let ok = (CFG.passBase - d * CFG.passDistK) * Math.exp(-blk * CFG.laneK) * (0.72 + a.pass / 99 * 0.34)
           * (1 / (1 + press * 0.20)) * (1 / (1 + rPress * rp)) * (0.86 + meAttrs(q).position / 99 * 0.20);
    // The decision now asks the resolution's own question: can anyone reach this ball first? A
    // lofted ball is only cuttable near its ends, so it is judged on a straighter, faster line.
    const spd = isHigh ? meLoftFor(d).vxy : meGroundSpeed(d);
    const risk = mePassRisk(s, side, p.x, p.y, aimX, aimY, spd, isHigh) * (isHigh ? CFG.riskHigh : 1);
    ok *= 1 - risk * CFG.riskW;
    // THE MAN IT IS PLAYED TO HAS TO GET THERE AS WELL. Every opponent was charged for the race to
    // the ball and the receiver alone was exempt, so a ball rolled into space he had no chance of
    // reaching scored the same as one laid into his feet. Worse, the lead above is solved off his TOP
    // speed while he is actually jogging at whatever off-ball job he has been given, and for a man
    // not on a committed run the direction is a guess -- straight up the pitch. Measured: balls into
    // space were predicted at 71% and landed at 52%, and they were a third of every pass played,
    // while balls to feet were already completing at 84%. The whole deficit was here.
    // Free for a ball to his feet, which is why those were calibrated all along.
    const tBall = (isHigh ? d / Math.max(1, spd) : meGroundT(d, d)) * 1000;
    const late = meTimeToBallMs(q, aimX, aimY, meSpeed(meAttrs(q), q.stamina)) - tBall;
    if (late > CFG.rcvLateMs)
      ok *= 1 - Math.min(1, (late - CFG.rcvLateMs) / CFG.riskSpanMs) * CFG.riskW;
    if (isGK) {
      // A rolled or thrown ball out of the hands beats a stroked pass for accuracy, and gkDist
      // decides whether he is looking for a full-back or for the halfway line.
      if (d < CFG.gkRollD) ok *= CFG.gkRollOk;
      val0 += (d > CFG.gkLongD ? 1 : -1) * (st.gkDist || 0) * CFG.gkDistW;
    }
    ok = Math.max(CFG.passFloor, Math.min(0.985, ok));   // floor is ~0: see config
    // What the pass is WORTH, before instructions.
    // Keeping the ball is worth more when it is a SAFE ball -- but ONLY when the way forward is
    // genuinely shut. Applied flat, this made every backward pass worth more than midfield position
    // itself, so players recycled with a clear run at goal. Now it scales with how set the defence
    // is, and vanishes for a man who is through.
    // Plain meVal, NOT meValHere. Discounting a pass by the pressure on its destination double-charges
    // it -- `ok` above already pays for the receiver being marked, through recvPress -- and because a
    // forward ball always goes to a pressured man while a backward one goes to a free one, it made
    // going forward systematically worse than going backwards. Measured: teams kept the ball for ten
    // seconds and finished 2.1 m FURTHER from goal than they started, so the ball only ever reached
    // the final third by turnover, and the defensive block never had two seconds to form.
    let val = meVal(side, aimX, aimY) + CFG.keep + (fwd <= 0 ? CFG.keepBuild * shut : 0) + val0;
    // Directness: bias toward balls that gain ground. Work-ball-in does the reverse. These are the
    // only lines an instruction touches, and they move what is ATTEMPTED, never whether it lands.
    val += fwd * CFG.fwdPull;
    // DIRECTNESS IS THE RANGE HE IS LOOKING IN. It used to scale fwdPull -- the worth of a metre of
    // ground -- which meant Much Shorter instructed a side to value the right thing wrongly. Against
    // an objective that is already about right, distorting it can only make a team worse, and that
    // is precisely what it measured as: at the short end 0.54 xG created and 0.78 conceded, at the
    // direct end 0.74 and 0.62, a buff of 1.08 goals wearing a tactic's name. No amount of tuning
    // fixes that shape, because the coefficient IS the team's judgement.
    // A preferred length is a constraint instead. Both ends play the best ball they can see; they
    // are looking at different balls, and each pays for it -- short forgoes ground, long forgoes
    // completion. That is a trade, which is what a tactic is supposed to be.
    // A BAND HE IS LOOKING IN, not a tax on every ball he is not. As a flat penalty on |d - want|
    // this could not bite: at passWantW 0.0006 a ball ten metres off the preferred length cost 0.006
    // against option scores that differ by 0.05, so the preference was stated and then outvoted.
    // Measured, mean pass length across all fourteen styles ran 17.6 m to 20.2 -- Route One sat one
    // metre from Tiki-Taka. Inside the band a ball is free, and the charge only starts where the
    // side stops looking. That is a constraint on the option set rather than a distortion of the
    // objective, which is the only shape of instruction that has ever worked in here.
    const want = CFG.passWant + st.passingDir * CFG.passWantStep;
    val -= Math.max(0, Math.abs(d - want) - CFG.passBand) * CFG.passWantW;
    // ...and it is worth far more if the man receiving it has ROOM. meVal is pure geometry: on a
    // surface that is nearly flat through midfield it says twelve metres of progress is worth 0.007
    // against 0.030 for simply still having the ball, so a ball into twenty metres of open grass and
    // one into a crowd scored the same and the safe square ball won every time. Space is precisely
    // what a stretched defence is giving away, and nothing was pricing it -- which is why the ball
    // never went into the gap you could see from the touchline. Ground gained into nobody is worth
    // taking; the same ground into a body is not, so the two are multiplied rather than added.
    const room = Math.min(1, meOppDist(s, side, aimX, aimY) / CFG.roomFull);
    val += room * Math.max(0, fwd) * CFG.roomFwd;
    // Losing it costs what it costs WHERE IT IS LOST, not where the passer happens to be standing.
    // Charged at his own position, every option out of a defence paid the same enormous penalty --
    // the danger of his own box -- so only completion could separate them, and the shortest backward
    // ball always won. That is the cycling: forward football was not merely unattractive, it was
    // strictly dominated. A ball intercepted thirty metres upfield hands the opposition possession
    // thirty metres further from your goal, and that difference is the entire case for playing out.
    // The position he is handing back. Only ever a cost, never a bonus for passing to a worse spot.
    const giveUp = Math.max(0, here - meVal(side, aimX, aimY)) * CFG.surrender;
    const sc = ok * (val - giveUp) - (1 - ok) * CFG.loss * riskM * (0.35 + meDanger(meOther(side), aimX, aimY))
             + (q.pos === "GK" ? -0.020 : 0);
    if (ME_DBG) ME_DBG.pass = Math.max(ME_DBG.pass ?? -1, sc);
    const jsc = sc + jit("pass");
    if (jsc > bestSc) { bestSc = jsc; best = { k: "pass", j, p: ok, ax: aimX, ay: aimY, high: isHigh, thru }; }
    }
  }
  // Carry it. Cheap, safe, gains a little -- and the option a pressed player loses first.
  // drb is now a real retention probability, and meTick rolls against exactly this number.
  //
  // It is never OFF THE MENU. He used to be forbidden from keeping the ball the moment his touch
  // budget expired, so a man with nothing on had to play the least-bad pass rather than do what a
  // footballer does: drive at somebody, or hit it long. Measured, 1038 of 1041 passes in a match
  // were struck on the exact slice the budget ran out -- the budget was not shaping his decision,
  // it WAS his decision. What holding it too long really costs is that they close you down, so it
  // taxes the carry instead of removing it, geometrically, which is also what stops him dribbling
  // in his own box for the rest of the afternoon.
  {
  // The dribbling instruction is NOT in here any more. It used to divide the risk -- Run At Defence
  // made you better at keeping the ball, full stop, which is why it was the highest edge left on the
  // board at 0.65. What running at people actually is, is licence to hold on for another touch, and
  // that is set on the touch budget in match.ts. The cost comes for free from the two terms already
  // in this line: press rises while you dwell, and dwellDrop compounds against you.
  // BOX ENTRY RESISTANCE. Carry risk was charged on the pressure at his own FEET, so driving off the
  // edge of the box into six defenders scored exactly as safe as driving into open grass. A pass
  // into a crowd was already priced -- recvPress reads the pressure where the receiver is standing --
  // but a man could always simply dribble in, so a low block bought nothing at all. Measured: the
  // deepest defensive line conceded 81% of its shots from inside the box against a high line's 67%,
  // and blocks per match were flat at 4.5 / 4.8 / 4.8 / 4.9 across the whole range, because bodies
  // that nobody has to go past are never in the way of anything.
  // The harder of where he is and where he is going, so this can only ever make carrying harder --
  // you do not dribble out of trouble by running into more of it.
  const cdx = p.x + dir * CFG.carryAdv;
  const carryPress = Math.max(press, mePressure(s, side, cdx, p.y) * CFG.carryAhead);
  // NOTE THAT `drb` IS A SCORE AND NOT A ROLL. It is computed here, handed out on the carry option,
  // and the handler in match.ts returns without ever reading it -- the only thing that actually takes
  // the ball off a carrier is meTackle finding him. So every attempt to charge the carrier through
  // this number has removed his option rather than priced it, which is the whole history below.
  const drb = Math.max(CFG.carryFloor, Math.min(0.97, 1 - (0.05 + carryPress * CFG.carryRisk) * (1.7 - a.pace / 99 * 0.7)))
            * Math.pow(CFG.dwellDrop, Math.max(0, dwell || 0));
  // Same for running with it: he loses it where he has taken it to.
  const dsc = drb * (meValHere(s, side, cdx, p.y) + CFG.keep * 0.72)
            - (1 - drb) * CFG.loss * riskM * (0.35 + meDanger(meOther(side), cdx, p.y));
  if (ME_DBG) { ME_DBG.carry = dsc; ME_DBG.press = press; ME_DBG.nopts = ps.length; }
  // Run At Defence / Be More Disciplined, on the choice itself.
  const jdsc = dsc + CFG.carryInstrW * obey * (st.dribbling || 0) + jit("carry");
  if (jdsc > bestSc) { bestSc = jdsc; best = { k: "carry", p: drb }; }
  }
  // Hoofing it. You probably concede possession, but you concede it forty metres from your own goal
  // instead of ten, and the cost of losing it is charged WHERE IT LANDS rather than where you stand.
  // That is the whole value of the option, and it is why it has to be scored rather than used as a
  // last resort: with a hard threshold it fired exactly zero times a match, so a pinned side had no
  // way of ever resetting field position and a rating gap compounded territorially without limit.
  const ownGoal = meGoalX(meOther(side)), ownDepth = (p.x - ownGoal) * dir;
  // A keeper caught outside his own area does not try to play. He gets rid of it.
  if (isGK && ownDepth > CFG.gkSafeOut) {
    let cx = Math.max(2, Math.min(PITCH_L - 2, p.x + dir * 40)), cy = ME_HALF_W, cw = -Infinity;
    for (const q of ps) {
      if (q === p) continue;
      const up = (q.x - p.x) * dir;
      if (up < 8) continue;
      const w = up - mePressure(s, side, q.x, q.y) * 12;
      if (w > cw) { cw = w; cx = q.x; cy = q.y; }
    }
    return { k: "clear", p: 0.5, cx, cy, sc: 9 };
  }
  // A clearance is RELIEF, so it only exists where there is something to be relieved of. The gate
  // was "under pressure ANYWHERE, or deep" -- and pressure happens all over the pitch, so 44% of all
  // clearances were struck from the attacking half. Out there the aim falls back to forty metres
  // straight ahead, which clamps near the opponent's goal line, and meVal then credits the hoof with
  // 0.26 -- the worth of standing in their six-yard box -- at a flat 46% success. Nothing could
  // outscore that, which is why a midfielder under a bit of pressure launched it.
  if (ownDepth < CFG.clearPanic || (ownDepth < CFG.clearDepth && press > CFG.clearPress)) {
    // Aimed, not hoofed blind: the best-placed man upfield, discounted for whoever is near him.
    let cx = Math.max(2, Math.min(PITCH_L - 2, p.x + dir * 40)), cy = ME_HALF_W, cw = -Infinity;
    for (const q of ps) {
      if (q === p || q.pos === "GK") continue;
      const up = (q.x - p.x) * dir;
      if (up < CFG.clearMinUp) continue;
      const w = up - mePressure(s, side, q.x, q.y) * 9 - Math.abs(q.y - p.y) * 0.25;
      if (w > cw) { cw = w; cx = q.x; cy = q.y; }
    }
    const ok2 = CFG.clearOk;
    // The relief: how much danger it takes off your own goal. That is the whole point of a clearance
    // and it was the one thing not being counted.
    const relief = Math.max(0, meDanger(meOther(side), p.x, p.y) - meDanger(meOther(side), cx, cy))
                 * CFG.clearRelief;
    // ...but relief is relief from DANGER, and a man with six metres of space around him is not in
    // any. Unweighted, this was the reason for headed clearances nobody had asked for: a defender
    // standing alone in his own half scored the same relief as one with three men on him, so he
    // launched it. Under real pressure it counts in full; unpressured it nearly vanishes and he is
    // left choosing between a pass and a carry, which is what he should be choosing between.
    const urgency = Math.min(1, press / CFG.clearPress);
    const sc = ok2 * (meVal(side, cx, cy) + CFG.keep * 0.40) + relief * (0.2 + 0.8 * urgency)
             - (1 - ok2) * CFG.loss * riskM * (0.35 + meDanger(meOther(side), cx, cy));
    // Play Out of Defence means he would rather find a pass than clear it, and Pass Into Space
    // means he is happier to send it. Neither reached this decision before.
    // THIS ONE ALREADY WORKS, which is worth writing down because it does not look like it does --
    // there is no column for it in the behaviour audit and it is easy to assume it is as dead as
    // width and directness were. Isolated on a Balanced side with only this axis moved, over 90
    // blocked fixtures a cell, every measure is monotone and pointed the right way:
    //   -1 Play Out    3.5 clears   101 passes   50.5% poss   41.6 from own third   30% lofted
    //    0             3.8          97           49.4         34.9                  32%
    //   +1 Into Space  4.4          94           48.1         31.9                  35%
    // Thirty per cent more of the ball played out from its own third is the largest behavioural
    // swing any instruction in this engine produces. Do not "fix" it.
    // Two things that ARE worth doing, neither of them here. The label is wrong: +1 raises the score
    // of CLEARING it, so the axis is build-from-the-back against get-it-forward, and "Pass Into
    // Space" implies a feet-versus-channels choice that is not what is modelled. And nine of the
    // fourteen styles are stamped +1, so across the style set the axis is very nearly a constant --
    // it separates almost nothing, and all nine share the +0.11 xG that Into Space is worth over
    // Play Out. That gradient is about 1.2 standard errors, so it is a slope rather than a trade,
    // but it is too marginal to act on without a bigger sample.
    const jc = sc + styleW * (st.approachPlay || 0) * CFG.apClearW + jit("clear");
    if (jc > bestSc) { bestSc = jc; best = { k: "clear", p: ok2, cx, cy }; }
  }
  // Into the stand. No gain at all, so it only ever wins when everything else is worse than a
  // throw-in against you -- which, ten metres from your own goal with three men on you, it is.
  if (ownDepth < CFG.touchDepth && press > CFG.touchPress) {
    const sc = meDanger(meOther(side), p.x, p.y) * CFG.clearRelief
             - CFG.loss * riskM * (0.35 + meDanger(meOther(side), p.x, p.y)) * CFG.touchDiscount;
    const jt = sc + jit("clear");
    if (jt > bestSc) { bestSc = jt; best = { k: "touch", p: 1 }; }
  }
  if (best) best.sc = bestSc;
  return best || { k: "carry", p: 0.5, sc: 0 };
}
