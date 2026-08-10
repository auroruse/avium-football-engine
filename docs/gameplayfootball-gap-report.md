# GameplayFootball gap report

Source research from `github.com/BazkieBumpercar/GameplayFootball` -- the author of the
properlydecent.com soccer game development blog -- plus a strict audit of `src/engine` against
the blog's 18 mechanisms. Produced by a 7-agent read of the C++ source; claims carry file:line
citations into that repo. Ported constants need x0.955 on x and x0.944 on y (GF's pitch is
110x72, ours is 105x68); absolute-metre constants transfer unchanged.

---

# Gap report: GameplayFootball → Avium Football Engine

Engine under review: `/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/src/engine/` — 1,143 lines across 9 files, 4 Hz tick, 105×68 pitch. GF source at `.../scratchpad/gf/src`, 110×72 pitch (`pitchHalfW=55, pitchHalfH=36`, gamedefines.hpp:271-272), 100 Hz tick. Pitch-fraction constants need ×0.955 on x and ×0.944 on y; absolute-metre constants (shoot thresholds, hunt radii, orbit bands) transfer unchanged.

**What our engine already does better, so nobody rips it out during a port:** `meDecide` is EV-maximisation in real xG units (decide.ts:35-107) against GF's weighted-rating heuristic; `meCtrl`/`meInfluence` is a Fernandez & Bornn pitch-control field (geometry.ts:37-59) with no GF equivalent; marking and slot assignment both use Hungarian (brain.ts:112, 173) where GF's marking is greedy (teamAIcontroller.cpp:570-623).

---

## 1. Highest-impact techniques we do not have

Ranked by visible change to 22 dots on a 2D pitch, divided by cost.

### 1. Ball prediction array + real ball physics
**Impact: highest. Everything below #4 depends on it.**

What we have: `meFlight` stores a destination and a tick count; the flight branch does `mp.bx += (mp.fx - mp.bx) * (1/mp.ft)` (match.ts:164-165). Every ball in the match travels at exactly 17 m/s (`ticks = dist/17/ME_DT`, match.ts:251), in a straight line, at constant speed, with no height. `mp.bvx/bvy` are zeroed at kickoff (match.ts:47) and never read again. There is no trajectory to query, so nothing can be intercepted; a pass fails only when `rng.u() >= act.p`.

GF: one 300-slot array at 10 ms spacing, 3 s horizon (`ballPredictionSize_ms = 3000`, gamedefines.hpp:56), rebuilt from scratch every tick, and the ball's own next position is slot [1] of its own forecast — there is exactly one integrator in the codebase (ball.cpp:521-570). Rebuilt on every `Touch()`/`SetMomentum()` so a kick is visible to AI within one tick (ball.cpp:82-130).

Integrator, verified at ball.cpp:167-232:
```
vz   += -9.81 * dt
v    -= 0.015 * v² * dt                      // quadratic air drag, on the 3D speed
if z < 0.11:  vz = max(-vz*0.62 - 0.06, 0)   // restitution + linear brake kills the micro-bounce tail
if z < 0.135: v2d -= (0.04*v2d² + 1.6) * dt  // rolling: quadratic + linear, clamped at 0
```
The linear terms (`linearBounce 0.06`, `linearFriction 1.6`) are the load-bearing part — they stop the ball in finite time instead of asymptotically.

**Port:** ~55 lines. Give the ball `{x, y, z, vx, vy, vz}`, integrate at 10 ms sub-steps, cache 12 slots at 250 ms into a `Float64Array`, rebuild on every touch. 12 slots × 25 sub-steps = 300 integrations per tick — negligible next to what `meFindSpace` already spends (~2,000 `exp()` calls per tick through `meCtrl`/`meSpaceGain`). Skip the Magnus swerve (ball.cpp:480-495) and the spin↔momentum coupling (ball.cpp:409-475): both need a spin state we don't carry. Skip woodwork in the forecast — GF itself only resolves posts on sub-step 1 (`if (firstTime && woodwork_enabled)`, ball.cpp:163) and deliberately lets the AI forecast a shot through the post.

Side benefit: `CFG.passBase - d*0.0072` and `CFG.passFloor` currently fake distance decay with a linear fudge. Real drag makes long balls slower *in the geometry*, which is where the risk belongs.

### 2. Time-to-ball: two-phase growing circle
**Impact: highest. This is the single largest source of unfootballing outcomes we have.**

Every "who gets there" question in our engine is raw euclidean distance — `meClosest` (geometry.ts:152), `meTwoClosest` (144), `meScramble` (match.ts:124, which adds only a positioning tilt and 1.5 m of RNG). A defender sprinting *away* from the ball at 7 m/s and one standing still are treated as identical if they are the same distance from it.

GF (`AI_GetTimeNeededForDistance_ms`, AIfunctions.cpp:499-598, read in full): the player is modelled as *drifting* on existing momentum while a reachability circle grows around the drift point. Momentum decays linearly over `changeTime_ms = 700`; acceleration ramps in over the same 700 ms; `adaptedMaxVelocity = maxVelocity * 0.94`. That single coupling is the whole trick — a sprinting player needs ~0.7 s before he can move at full speed in a new direction, and it falls out of the model rather than being a rule.

At our 250 ms tick, don't port the 10 ms loop. Closed form (integrating the loop exactly):
```
vmax  = meSpeed(a, stamina) * 0.94
drift = pos + v * 0.35                   // ∫₀^0.7 v(1 - t/0.7) dt
r     = 0.28 + 0.329 * vmax              // ∫₀^0.7 0.94·vmax·(t/0.7) dt ; ≈2.9 m at vmax 8
t_ms  = 700 + max(0, |target - drift| - r) / vmax * 1000
```
Evaluate at t = 250 ms and 500 ms explicitly for close targets, closed form beyond. Also port the twin radius: `radius_usual = 0.28` (leg extension) and `radius_optimistic = 0.9` (AIfunctions.cpp:532-534) — the gap between the two is what licenses a last-ditch lunge (`Player::AllowLastDitch()` fires when `optimistic*1.7 + 800 < usual`, player.cpp:128-131). And the early-out: beyond 16 m, skip the whole thing and return `|target - (pos + v*0.2)| / (vmax*0.75) * 1000` (AIfunctions.cpp:503-512).

**Port:** ~25 lines in `geometry.ts` as `meTimeToBall(p, x, y)`. Then replace `meClosest`, `meTwoClosest`, `meScramble`'s distance sort and `meDuties`' `nearest()` helper (brain.ts:129-131) with it. Depends on #1 only for the *ball-side* queries; the player-side solver stands alone and can ship first.

### 3. Interception-point selection — run at where the ball *will* be
**Impact: very high. This is what makes defenders look like defenders.**

Our chaser runs at the ball's current coordinates: `if (i === scramble) { tx = mp.bx; ty = mp.by; }` (match.ts:68). He permanently trails a moving ball. Whether he wins it is then decided by fiat at landing — receiver within 3.4 m collects, else `meScramble` at 4.0 m (match.ts:173-178) — which is why defensive interception has to be faked by inflating `CFG.interceptW = 1.9` in the lane-block term (geometry.ts:107) instead of anyone actually running onto anything.

GF (`AI_GetToBallMovement`, AIfunctions.cpp:619-813): scan the prediction array from your own `timeNeededToGetToBall_ms`, skip slots with `z >= 1.0`, and rate every *reachable* slot rather than taking the earliest:
```
rating = movementRating*1.0 + timeRating*0.0 + perpendicularRating*0.1   // haste flips to (0.0, 1.0)
movementRating      = 0.4·velocity-match + 0.6·direction-match
perpendicularRating = 1 - clamp(dist to the 0→1000 ms ball line / 16, 0, 1)
```
Three `forced` conditions break the scan and commit: slot is off-pitch, `dot(toTarget, ballDirection) > 0` (angle too shallow, stop cutting and just go), or `timeNeededToGetToBall / time_ms < 0.35` (this target wastes the available time).

Then velocity from the *time budget*, not the distance (AIfunctions.cpp:827-838):
```
v = clamp(timeNeeded_ms / time_ms * maxVelocity, 0, sprintVelocity)
```
That one line replaces our `d > 9 ? 1 : d > 4 ? 0.55 : 0.30` speed gate (match.ts:75) and gives urgency for free: a man with time jogs, a man who is late sprints.

**Port:** ~30 lines. Drop the 16-way direction quantization at AIfunctions.cpp:639-656 — it exists for a PS2 D-pad.

### 4. `GetLazyVelocity` — role × possession × distance-to-action effort throttle
**Impact: very high, cost near zero, zero dependencies. Do this first regardless of everything else.**

This is why GF looks like football and most sims don't: strikers visibly jog when their side is defending, fullbacks visibly jog when it's attacking, and the midfield always works. We have nothing — every outfielder in our engine runs to his target at the same distance-gated pace.

Verified at elizacontroller.cpp:437-474:
```
start = 20 * (fatigueInv*0.8 + 0.2);  end = 65 * (fatigueInv*0.5 + 0.5)
actionDistance  = |playerPos - oppTeamDesignatedPossessionPlayerPos|
teamPossession  = clamp(fadingPossession - 0.5, 0, 1)
lazinessByRole  = mindSet + teamPossession * (1 - mindSet*2)
lazinessByPos   = NormalizedClamp(actionDistance, start, end)
lazyFactor      = lazinessByPos * (0.5 + lazinessByRole*0.5)
v *= (1 - lazyFactor)                     // floored at dribbleVelocity 3.5 if the request was ≥ 3.5
```
`lazinessByRole` collapses beautifully: CF (mindSet 1) → `1 - teamPossession`; CB (0) → `+teamPossession`; midfielders (0.5) → a flat 0.5 either way.

Then the breath model, which is the part that reads as *lungs*:
```
breath = (1 - NormalizedClamp(avgVelocity over last 10 samples, 0, 8)) ^ (0.8 - workrate*0.2)
breath = min(breath*1.2, 1)                       // first seconds of a sprint are full speed
breath = breath*lazyFactor + 1*(1 - lazyFactor)   // a man who genuinely must run is not throttled
v = min(v, sprintVelocity * breath)
```

**Port:** ~12 lines replacing the speed gate at match.ts:75. `fatigueInv` maps to our `p.stamina/100`; `avgVelocity(10)` maps to a 10-tick rolling mean of `hypot(p.vx, p.vy)*ME_HZ`. Needs #5.

### 5. `mindSet` — the one role scalar
**Impact: high. Cost: one line. Zero dependencies.**

GF's cheapest high-value idea: one 0..1 number per role that differentiates *everything* (AIfunctions.cpp:1228-1249). GK 0.0, CB 0.0, LB/RB 0.25, DM 0.25, LM/CM/RM 0.5, AM 0.75, CF 1.0. Consumed as: pass `forwardWeight = 2 + mindSet*6`, `tacticalDiffWeight = 1 + mindSet²*10`, `passMinimum = 0.2*(1 - mindSet)`, hunt distance `10 + (1 - mindSet)*10`, laziness-by-role, defensive bias `K - mindSet - possession`, force-field forward push `mindSet^1.5`, panic gate `mindSet < 0.25`.

We have `p.pos` at four levels only (GK/DEF/MID/FWD, attributes.ts:8-12) — too coarse. But we already carry the right data: `p._bd0` is the natural formation slot's depth in metres (match.ts:29). `p._mind = clamp(p._bd0 / PITCH_L, 0, 1)` gives a continuous mindset straight from the formation, no new authoring.

**Port:** 1 line at `meInit`, then consume in items 4, 6, 8, 9.

### 6. Team defensive line (`offsideTrapX`) + smooth trap compression
**Impact: high.** We compute an offside line for our *attackers* (`meOffsideLine`, geometry.ts:134-141) but have no defensive line of our own. The back four's depth is whatever `meAnchor`'s `lineD` says plus wherever marking dragged each man, so the line breaks constantly and there is no such thing as holding it.

GF, verified at teamAIcontroller.cpp:91-128 — one x per team per tick, a `max()` over four threat sources:
```
startDistance = 30 + 20*offensivenessBias;  forceDistance = 6
deepestDanger = (pitchHalfW - startDistance) * side          // default line
(1) adapted ball x: offsetX = 20 + 10*(1 - offensivenessBias)
    startToForcedBias = NormalizedClamp(ballX_own, pitchHalfW - startDistance - offsetX, pitchHalfW - forceDistance)
    adaptedBallX += offsetX * (1 - startToForcedBias)        // drops back generously far out, refuses to buckle near goal
(2) ball.Predict(700)
(3) opponent carrier x + movement*0.15 + 4.0 caution
(4) own offside line - 4.0                                   // one slacking defender drags the line back
```
And `ApplyOffsideTrap` (teamAIcontroller.cpp:625-651) is the detail that matters visually — not a hard clamp but a compression: the 4 m band `[trap-2, trap+2]` maps onto the 2 m band `[trap-2, trap]`, so the deepest man doesn't move and the most advanced is pulled back 2 m. The back line keeps its stagger instead of stacking on one x. Defenders and midfielders apply it, forwards don't (absent from default_off.cpp).

**Port:** ~18 lines in `meTactical` + 3 in `meShape` after the duty switch. `offensivenessBias` can be a stub 0.5 initially; upgrade with item 11 later. Depends on #1 only for term (2).

### 7. `AddDefensiveComponent` — goal-side shooting-point marking
**Impact: high.** Our `mark` duty stands a fixed distance goal-side: `tx = mk.x - dir*tight` with `tight = 2.10 - danger*1.10` (brain.ts:292-294, CFG.markBase/markTighten). That is a leash, not marking — it says nothing about whether the defender can actually get to the ball before his man shoots, and it never gives up and retreats.

GF (playercontroller.cpp:53-122). Constants: `possessionPlayerShootThreshold 24`, `genericOpponentShootThreshold 8`, `bufferDistance 4.0`:
```
oppPos        = image.position + movement*0.5
shootingPoint = oppPos + normalize(goal - oppPos) * clamp(|goal - oppPos| - shootThreshold, 0.4, pitchHalfW)
if shootingPoint beyond own offsideTrapX: re-derive as opp→goal ∩ trap line   // keeps the line intact
slack = |shootingPoint - desired| - (oppToThreshold - 4)
if slack > 0: defendPos = desired + normalize(toThreshold) * clamp(slack, 0, dist)
// second pass on ACTUAL position (pos + movement*0.14): if you are genuinely beaten,
// defendPos += normalize(goal - defendPos) * actualSlack * 0.7    ← retreat goalward, don't chase
desired = lerp(desired, defendPos, bias)
bias    = pow(clamp(K - mindSet - fadingPossession, 0, 1), 0.7),  K = 1.9 def / 1.5 mid / 1.3 att
```
The retreat-when-beaten term is the one you can see. The re-derivation against the trap line is what stops a marker dropping and playing everyone onside.

**Do not reproduce as written:** at K = 1.3 with mindSet 1.0 and fading ∈ [0.5, 1.5], the offense strategy's defensive block is ≤ −0.2 for the entire legal range — dead code for its only caller role (default_off.cpp:50-51). Either fix K or drop the branch, deliberately.

**Port:** ~22 lines replacing the `mark` case. Needs #5 and #6.

### 8. Force-field terms we lack — the orbit band and the lane-clearing repel
**Impact: medium-high. Cheap, because it's four terms bolted into `meFindSpace`, not a rewrite.**

Do **not** replace `meFindSpace` (brain.ts:215-236) with GF's force field. Our 9-candidate ring is the same algorithm GF abandoned (`GetSupportPosition`, elizacontroller.cpp:476-595, no callers), and ours scores it better — pitch control beats nearest-opponent distance, and `meSpaceGain` has no GF equivalent. Steal only the four spots we're missing (elizacontroller.cpp:597-789):

- **Carrier orbit band.** Attract at `scale 28*0.75 = 21` and repel at `scale 16*0.75 = 12`, both power 0.45 — the pair produces a preferred 12-21 m ring around the ball carrier. This is exactly the audit's missing "ideal distance to possession player" term; without it a spot 3 m off the carrier's shoulder and one 40 m away score identically.
- **Lane-clearing opponent repel.** The repel origin is pushed **2 m behind** the opponent along the opponent→carrier axis, so what you clear is the *passing lane*, not the body (elizacontroller.cpp:698-706).
- **Role-scaled opponent repel.** ×2.2 CB/LB/RB, ×2.0 DM, ×1.6 CM/LM/RM, ×1.2 AM, ×1.0 CF. Defenders avoid opponents hard, strikers barely at all — a striker standing on a centre-half's toes is *correct*.
- **Distance-growing base pull.** `power = 0.7 * (0.3 + 0.7*NormalizedClamp(|base - pos|, 0, 20))` — the further out of shape you are, the harder you're pulled back. Ours is a flat `- dist * 0.010` (brain.ts:232).

**Do not port** the opponent query point: `AI_GetClosestPlayers(oppTeam, mainManPos*0.3f + currentPos + 0.7f, ...)` at elizacontroller.cpp:698 adds the *scalar* 0.7 to every vector component. Intent was plainly `currentPos * 0.7f`. As written the query lands off the pitch for most positions and picks a near-arbitrary three opponents.

**Port:** ~14 lines into `meFindSpace`'s score. Needs #5 for the role scaling.

### 9. Ball-hunt trigger with an anti-swarm cap
**Impact: medium.** Our press is exactly one man (brain.ts:136-143) plus one cover — deliberately, and it fixed the six-men-charging-the-ball problem. But it means a defender standing 3 m from an unpressed carrier does nothing because someone else holds the `press` duty.

GF runs a second, independent trigger (elizacontroller.cpp:326-390):
```
threshold = 10 + (1 - mindSet)*10                                      // CB travels 20 m, CF 10 m
threshold *= 0.5*fatigueInv + 0.5*(1 - NormalizedClamp(avgVelocity(10), 0, 8))
threshold *= 0.3 + matchDifficulty*0.7
fires if: !teamHasBestPossession && manMarkingID == -1
          && |(oppPos + oppMov*0.12) - (myPos + myMov*0.04)| < threshold
then: only the 2 closest teammates to (oppPos + oppMov*0.1) may actually press  ← huntingPlayersNum = 2
```
The anti-swarm rule is the cap, not the trigger. And the gate that stops pointless shuffling (`NeedDefendingMovement`, humanoid_utils.cpp:105-115): move only if `|Δy| > max((target.x - pos.x)*-side, 0) - 0.5` — only when the lateral correction dominates the forward one.

**Port:** ~16 lines. Lets us raise the cap from 1 to 2 pressers with a principled trigger instead of a duty slot. Needs #5.

### 10. Goalkeeper: angle bisector, come-out decision, shot-stopping line
**Impact: medium.** Our keeper is four lines (brain.ts:264-268): a push forward scaled by ball depth, a lateral lerp at 0.22. He never comes out, never claims a cross (`meClosest` excludes GK, geometry.ts:154), and saves are `rng.u() < 0.42` (match.ts:233).

GF (goalie_default.cpp:41-269): build vectors to both posts at ±3.7 m, bisect the angle, extend to the backline drawn at `pitchHalfW - 0.7`, clamp the intersection inside the posts. `awayFromGoalBias = 0.3 * NormalizedClamp(fadingPossession, 1.0, 1.5)`, so he stands further out when the ball is further away. Come-out is a two-level race: primary threshold 20 m, `shootingPoint` along opp→goal, come out if the nearest teammate is >1.0 m further from that point than the attacker is — then *discount* by the danger of the attacker's nearest support option (helper threshold 24 m, `helperVSPrimaryRatio` ×0.7, "always allow some coming out despite opp mate danger"). Shot-stopping: `panic = 1.02 + (1 - (defensivepositioning*0.6 + vision*0.4))*0.5` inflates the effective goal width per keeper — a worse keeper dives at things going wide.

**Port:** ~30 lines. Low priority for match *statistics* (our xG model already handles saves) but it is one of 22 visible dots and currently the least footballing one.

### 11. `offensivenessBias` — scoreline and clock move team shape
**Impact: medium.** Cheap and it's the only thing on this list that changes how a match *narrates*.

teamAIcontroller.cpp:946-1001, recomputed every 1000 ms and on every goal:
```
goalFactor  = clamp(0.5 + (oppGoals - goals)*0.25, 0, 1)     // 2 down saturates
timeFactor  = 0.5 + 0.5*clamp(matchTime_ms/6300000, 0, 1)    // desperation ramps 0.5→1.0
offenseBias = clamp(0.5 + (goalFactor - 0.5)*timeFactor, 0, 1)
offensivenessBias = offenseBias*0.5 + recentPossessionBias*0.5
```
Consumed by the defensive line's `startDistance = 30 + 20*bias`, by `possessionBias += (bias - 0.5)*0.3`, and by side-focus strengths.

**Port:** ~12 lines in `meTactical`. Feeds #6. A side 2-0 down with 15 minutes left will visibly push its line 20 m up the pitch, which we currently cannot express at all.

### 12. Set-piece team placement
**Impact: medium, and it is a gap the blog list doesn't mention at all.**

Our restarts (`meRestart`, match.ts:133-144) place the ball, teleport the nearest player onto it, and hand him possession. **Nobody else moves.** A corner is taken with all 20 outfielders wherever the last passage of play left them. Set pieces are roughly a quarter of real goals.

GF reuses the same `AI_GetAdaptedFormationPosition` rectangle with hand-tuned bounds per situation (teamAIcontroller.cpp:653-905) — no bespoke set-piece code, no separate formation data. Attacking corner: `back = -side*pitchHalfW*0.2, front = -side*pitchHalfW*0.96, xFocus = front*0.85 str 0.7, yFocus = ballY*0.1 str 0.7, microFocus (ballX*0.95, ballY*0.1) str 0.9, midfieldFocus 0.9 str 0.5`. Defending: `back = side*pitchHalfW*0.98, front = side*pitchHalfW*0.5, midfieldFocus 0.1 str 0.7`. Free kick wall: the 3 closest players at exactly 9.15 m along ball→goal with a 0.07 lateral fan, only if the ball is within 40 m of goal. Set pieces also force `fadingTeamPossession` to 1.5 (taker) / 0.5 (defender).

**Port:** ~45 lines. Our `meAnchor` is already the rectangle primitive — this is a table of per-restart bound overrides driven through it during the `mp.dead` countdown, which currently does nothing but tick down (match.ts:154).

### 13. High passes as a distinct pass type
**Impact: medium. Not in the blog list; a real gap.**

Every ball in our engine is a ground pass. `meLaneBlock` (geometry.ts:100-110) charges an opponent at `t ∈ (0.02, 0.98)` on the line identically for a 5 m square ball and a 45 m diagonal, so a lofted ball over a press is not representable — which is why the only escape from pressure is `clear`, an untargeted 38 m hoof (decide.ts:100-105).

GF's HighPass rules (elizacontroller.cpp:1008-1060) are four lines and give the whole behaviour: returns 0 outright if the target is under 10 m; only opponents at `u < 0.2` or `u > 0.65` count (nobody intercepts a ball in the air over them); `penaltyTime = 2.5 s` if `u > 0.5` (trapping a high ball is slow); flat `danger += 0.4` so a ground pass always wins a tie. Power: `NormalizedClamp(dist, 0, 60)^1.4 * 1.15` with launch height `0.45 - NormalizedClamp(dist, 0, 60)*0.15` (AIfunctions.cpp:1063-1074).

**Port:** ~15 lines — a `type` flag on the pass option in `meDecide`, an alternate window in `meLaneBlock`, a `z` arc in the flight. Depends on #1 for height.

### Not worth porting

| Mechanism | Why not |
|---|---|
| Mental image ring (mentalimage.cpp:9-106) | GF reaction time is 40-180 ms. Our tick is 250 ms — the tick *is* the reaction time, and off-ball targets already lag through `CFG.targetSmooth = 0.22` and `brainStride = 4`. |
| `CalculatePhysicsVector` 10 ms locomotion (humanoidbase.cpp:2015-2516) | Turn-rate caps and delta-velocity caps per 10 ms substep are meaningless at 250 ms. `meMove`'s accel lerp (`CFG.accel 0.42`) + `CFG.turnPenalty 0.55` (match.ts:89-95) is the right altitude already. |
| Candidate-ring support position (elizacontroller.cpp:476-595) | We have this, better. |
| Animation machinery, controller quantization, `autoBias` human blending, celebrations, `desiredLookAt` | Headless. |
| Man-marking blend in `_MovementCommand` (playercontroller.cpp:507-558) | `autoBias = actionBias * 0.0f` for AI — computes a full result and multiplies it by zero. |
| Tiered per-player decision cadence (humanoid.cpp:148-168) | Exists to serve animation requeue. We already have `brainStride`. Keep only the per-team stagger idea. |

---

## 2. Honest status against the blog's 18 items

### Not implemented at all (5)

| # | Item | State |
|---|---|---|
| 1 | Ball prediction array (2-3 s, shifted per frame, recalc on touch, drag/rolling/bounce/swerve) | **Nothing.** No velocity, no z, no ground, no array. `grep -E "predict\|trajectory\|bounce\|swerve\|drag"` across `src/engine` returns zero hits. |
| 2 | Time-to-ball via two-phase growing circle | **Nothing.** All contests are euclidean distance. Momentum is invisible to every race. |
| 4 | Per-player possession balance = `oppBestTimeToBall - myTimeToBall` | **Nothing.** No such field exists in `MePlayerState` (types.ts:28-39). `mp.bal` is per-team only. |
| 8 | Iterate future interception timestamps, score on time / direction / opponent proximity | **Nothing.** Chasers run at `mp.bx, mp.by` (match.ts:68). Interception is resolved by fiat at landing. |
| 11 | More movement for midfielders than defenders and attackers | **Nothing.** `ME_SPACE_R = 9` and `CFG.leash = 15` are uniform. Worse, the bias runs backwards: `meFindSpace` is only reached from runner/support/width/hold (brain.ts:307-317), and width/hold only when `attacking` — so defenders in a defensive phase do no space search whatsoever. |

### Partially implemented (7)

| # | Item | Have | Missing |
|---|---|---|---|
| 3 | Designated possession player, per team + per match | `mp.side`/`mp.idx` is the match-level designation (match.ts:109-115). Two ad-hoc per-team picks: `meClosest` in `meMove` (match.ts:61), the presser in `meDuties` (brain.ts:136-143). | Neither per-team pick is stored on `mp`, so nothing can read "our best man for this ball". Both are raw distance. No match-level designation derived by comparing team bests — `meScramble` compares across sides then discards it. |
| 5 | Team possession balance | `mp.bal[side]` ∈ [-1,1], exponentially smoothed at `CFG.balLag = 0.055` (brain.ts:10-13), genuinely load-bearing in `meAnchor`. | The *target* is binary `mp.side === side ? 1 : -1`. It carries no information about a contest — during a 50/50, a loose ball, or an opponent under heavy pressure it does not move until possession has already flipped, then takes ~18 updates to swing. |
| 7 | Ball desire / magnet scaled by possession balance | Ball attraction on the anchor: `ay += (mp.by - ay) * (wide ? 0.10 : 0.30)`, `ax += (mp.bx - ax) * (t > 0.5 ? 0.06 : 0.22)` (brain.ts:88-89). Two players go directly at the ball. | No per-player desire scalar. The gate is a hard `t > 0.5` threshold snapping between two constants, applied team-wide. The two who chase are all-or-nothing targets. Nothing about role, distance, or being the best-placed man modulates the pull. |
| 10 | Adaptive rectangle with manager depth/width and a possession-driven focus | Is exactly a rectangle: `rel = (bd - mn)/(mx - mn)`, `ax = own + dir*(lineM + rel*span)` (brain.ts:84-86). Depth is manager-set via `st.defLine`. Slides with ball and possession. | No width control worth the name — `* (1 + st.passingDir * 0.02)` is a few percent, and 0.94/0.66 are hardcoded. `NO_INSTRUCTIONS` has no width slider (config.ts:125-127). No explicit focus-position vector in (-1,-1)..(1,1) — the slide is direct arithmetic, leaving no quantity a manager or debug view can read or override. |
| 13 | Per-role defensiveness × laggy balance | The blend exists: `lineM = lineD + (lineA - lineD) * t` (brain.ts:80). | **The per-role constant does not exist anywhere in the engine.** `t` is team-uniform: centre-half and striker blend identically. `span` growing ~10 m with `t` is stretch, not a per-role offset, and cannot produce CB 1.0→0.6 alongside ST 0.4→0.0. Also `meShape` (brain.ts:249-257) computes `lineM`, `span`, `bdRange` and never reads them — dead locals under a comment claiming per-player commitment the code doesn't implement. |
| 15 | Weighted options: closer to carrier / forward run / go wide / move back | `meFindSpace` scores 9 compass candidates so all four directions emerge. `meRuns` implements behind/overlap/third with triggers, `runTicks 14`, `runCool 110`, capped at 2 active. | The options are never *enumerated* as alternatives and never weighted against each other. `meFindSpace`'s candidates are geometric neighbours scored by one identical function with no concept of "this is the wide one". No get-closer-to-carrier option — `support` hardcodes `mp.bx - dir*7` (brain.ts:311); going wide is a slot property. `meRuns` is a rule cascade: first matching `if` fires, so an overlap is never compared against a run in behind. |
| 16 | Weighted on nearest opponent / passing lane / goal proximity / ideal distance to carrier | Three of four (brain.ts:227-232). Lane: `meLaneBlock * 0.30`, exactly as specified. Goal: `meDanger * 1.30`. Opponents: `meCtrl * 1.00` — a substitution, but strictly richer (velocity-aware, sums all opponents). Plus two extras: `meSpaceGain`, crowding. | **The ideal-distance-to-carrier band.** No term references distance from candidate to ball carrier. Strictly, nearest-opponent distance is also not computed — the aggregate control field cannot tell one man tight on you from three loosely spread. |

### Implemented (6)
6 (laggy balance as exponential lerp), 9 (single ball-control owner — stricter than spec, one per match not one per team), 12 (Hungarian on squared distances, plus a `natural` role-affinity penalty), 14 (Hungarian marking with both optional tweaks: danger pre-filter and a 6 m already-beaten penalty — note `CFG.markCap`/`markCommit` are dead, `nMark` is hardcoded at brain.ts:153), 17 (per-player stagger via `brainStride` — but the author's suggested previous-choice preference is *not* done), 18 (weighted on-ball decisions, done as full EV maximisation in xG — more principled than the blog).

### Gaps beyond the blog list
Work-rate/laziness throttle (§1.4), team defensive line and trap compression (§1.6), goalkeeper positioning (§1.10), set-piece team placement (§1.12), high passes (§1.13), scoreline-driven mentality (§1.11). None of these are in items 1-18; all six are absent from our engine.

---

## 3. Recommended implementation order

```
Phase 0 ──────────────── no dependencies, ~40 lines total, ship in one sitting
  mindSet scalar ─────┬─→ laziness throttle
                      ├─→ role-scaled opponent repel
                      └─→ per-role anchor offsets

Phase 1 ──────────────── the foundation
  ball state + physics ──→ prediction array (12 slots @ 250 ms)

Phase 2 ──────────────── needs Phase 1
  time-to-ball ─┬─→ interception-point selection
                ├─→ possession currency (team EMA + designated player hysteresis)
                └─→ per-player possession balance ──→ ball desire

Phase 3 ──────────────── needs mindSet; defensive line needs prediction for one term
  defensive line + trap compression ──→ marking solver
  hunt trigger (2-man cap)
  scoreline mentality ──→ feeds defensive line

Phase 4 ──────────────── independent, do last
  force-field terms into meFindSpace   goalkeeper   set pieces   high passes
```

**Phase 0 — do first, unconditionally.** ~40 lines, zero dependencies, and the largest visible change per line in the whole report. `p._mind = clamp(p._bd0 / PITCH_L, 0, 1)` at `meInit`; the laziness formula replacing the speed gate at match.ts:75; role scaling on the crowding term in `meFindSpace`; the CB/LB/RB/LM/RM/AM/CF tactic offsets (teamAIcontroller.cpp:230-275) as additive tweaks in `meAnchor`. After this a striker visibly stops tracking back and a centre-half visibly stops overlapping, which is most of what "looks like footballers" means.

**Phase 1 — the foundation.** Ball physics is the only thing here and it blocks five downstream items. Rewires `meFlight` (match.ts:271-274), the flight branch (163-179), `meScramble`, and the `ticks` calculation in the pass path (251). Expect the pass-completion calibration to move — `CFG.passBase`, `CFG.passFloor` and the linear `d*0.0072` distance penalty were compensating for the absence of real ball decay and will need re-sweeping. Budget for that, don't be surprised by it.

**Phase 2 — where the engine stops being a distance sim.** Time-to-ball is 25 lines but touches every "who gets there" call site: `meClosest`, `meTwoClosest`, `meScramble`, `meDuties`' `nearest()`. Do the player-side solver and the call-site swap first (it works without Phase 1), then interception-point selection (needs the array), then rewrite `meTactical`'s target from `mp.side === side ? 1 : -1` to `(oppTeamTimeToBall + 1500) / (ownTimeToBall + 1500)` with GF's slew limit (`±0.005 per 10 ms` → `±0.125 per 250 ms tick`, team.cpp:325-326) so a full 0.5→1.5 swing still takes ≥2 seconds. That single change fixes blog items 5 and 7 and unblocks 4 and 13.

**Phase 3 — defensive coherence.** Line before marking: the marking solver re-derives its shooting point against `offsideTrapX` (playercontroller.cpp:88-97), so building it first means building it twice. Mentality feeds the line's `startDistance` but is optional — stub `offensivenessBias = 0.5` and add it after.

**Phase 4 — independent polish.** Nothing here blocks anything. Force-field terms are the cheapest (~14 lines) and the highest-value of the four; set pieces are the largest (~45 lines) and the biggest gap in match *outcomes*.

**Two orderings that matter and one that doesn't.** Time-to-ball's player-side solver does *not* need ball prediction — only the ball-side queries do, so it can ship in Phase 1.5 and start paying off immediately. The marking solver does need the defensive line. And Phase 0 needs nothing at all, which is exactly why it goes first.

---

## Appendix A: audit of src/engine against the blog

```json
{
 "implemented": [
  {
   "item": "(6) LAGGY possession balance = Lerp(laggy, actual, 1-exp(-changeSpeed*dt))",
   "evidence": "meTactical, src/engine/brain.ts:10-13 \u2014 `mp.bal[side] += (want - mp.bal[side]) * CFG.balLag` with CFG.balLag = 0.055 (config.ts:107). Exponential smoothing toward a target with a tunable rate constant, mathematically the blog's form at this engine's fixed timestep (ME_HZ=4, and meTactical runs every 2nd tick, match.ts:158). Consumed downstream by meAnchor/meShape via `t = (bal+1)/2`. Caveat recorded under item (5): the value it lerps toward is a binary \u00b11, not a continuous actual."
  },
  {
   "item": "(9) ball control boolean (dribble mode), at most one per team",
   "evidence": "mp.idx / mp.side set by meBallTo (src/engine/match.ts:109-115); the ball is glued to the carrier every tick (`mp.bx = p.x; mp.by = p.y`, match.ts:208, 217). Dribble mode is mp.drive, set to CFG.driveTicks=5 on a carry decision (match.ts:245) and consumed by the drive branch at match.ts:202-210, which advances him at carrying pace and leaves him tackleable on every slice. Stricter than the spec: at most one controller in the whole match, not one per team."
  },
  {
   "item": "(12) dynamic formation distribution via Hungarian on squared distances",
   "evidence": "meSlots (src/engine/brain.ts:93-117): `row[b] = d*d + natural*natural` where d is the euclidean distance from the player to slot anchor (slots[b].wx/wy, set from meAnchor), solved by meHungarian (src/engine/assignment.ts:9, Jonker-Volgenant O(n^3)). Squared distances exactly as specified, plus a `natural` penalty term (|p._bd0 - slots[b].bd| * 0.55) that discourages a striker taking a centre-half slot. Re-run every 8 ticks (match.ts:157)."
  },
  {
   "item": "(14) man-marking assignment via Hungarian on distances to opponents, cost-tweaked",
   "evidence": "meDuties marking block, src/engine/brain.ts:156-179. Threats ranked by meDanger (brain.ts:151-152), the top nMark taken, then a square cost matrix `row[b] = (d + behind) * (d + behind)` solved by meHungarian. Both optional tweaks are present: danger-weighting (as a pre-filter on which opponents get marked) and the already-beaten-defender penalty (`const behind = (q.x - p.x) * dir > 0 ? 6 : 0`, brain.ts:168 \u2014 a defender goal-side-wrong of his man is charged 6 extra metres). Note: CFG.markCap [7,5,3] and CFG.markCommit 0.80 (config.ts:87-88) are dead \u2014 nMark is hardcoded `ballDepth < 34 ? 4 : ballDepth < 60 ? 2 : 1` at brain.ts:153."
  },
  {
   "item": "(17) invoked on a per-player interval",
   "evidence": "meBrainPos (src/engine/brain.ts:345-352): `if (p._sx === undefined || (mp.tick + i) % CFG.brainStride === 0)` with CFG.brainStride = 4 (config.ts:112). At ME_HZ = 4 that is one re-solve per second per player, staggered by player index `+ i` so roughly a quarter of the side re-evaluates each tick; the answer is cached in _sx/_sy and coasted between ticks. The author's suggested improvement is NOT done: there is no preference-for-previous-choice weighting in meFindSpace \u2014 the only stabilisers are a penalty on distance from the zonal anchor (`- Math.hypot(cx - baseX, cy - baseY) * 0.010`, brain.ts:232) and the CFG.targetSmooth = 0.22 lerp at the steering layer (brain.ts:338-339)."
  },
  {
   "item": "(18) a weighting system for on-the-ball decisions",
   "evidence": "meDecide (src/engine/decide.ts:35-107). Shoot, pass-to-each-team-mate, carry and clear are all scored in one currency \u2014 expected goals \u2014 as `ok * val - (1 - ok) * loss`, and argmax wins. Value surface meVal/meDanger (geometry.ts:21-31), shot probability meShotP (decide.ts:9-21) with ME_XG_K = 0.143, pass completion built from meLaneBlock, mePressure on both passer and receiver, distance and passer/receiver attributes (decide.ts:73-76), and the CFG terms keep / fwdPull / loss / carryRisk / carryFloor / passFloor. Manager instructions bias the scores only, never the success rolls (decide.ts:81-83, 47). More principled than the blog's weighting \u2014 this is EV maximisation."
  }
 ],
 "partial": [
  {
   "item": "(3) designated possession player per team + designated possession team + match designated possession player",
   "whatsThere": "The match-level designation exists as literal state: mp.side is the team in possession and mp.idx the player holding the ball (meBallTo, src/engine/match.ts:109-115). Two ad-hoc per-team designations are computed: meClosest picks one chaser per side when the ball is loose or in flight (meMove, match.ts:61-63), and meDuties picks one presser per defending side as the nearest free man to the ball, with hysteresis so the job does not hop (brain.ts:136-143).",
   "whatsMissing": "Neither per-team pick is stored as shared state on mp \u2014 meMove's is a local recomputed every tick, meDuties' lives only as a _duty string \u2014 so nothing else in the engine can read 'who is our best man for this ball'. Both are raw euclidean distance, not time-to-ball, so momentum, top speed and stamina are ignored. The team in possession has no designated player other than the man literally holding it, and there is no match-level designation derived by comparing the two teams' bests: meScramble (match.ts:120-128) does compare across both sides but only at the instant a flight resolves, and it discards the comparison immediately."
  },
  {
   "item": "(5) team possession balance",
   "whatsThere": "mp.bal.home / mp.bal.away, a continuous value in [-1, 1] per team, maintained in meTactical (src/engine/brain.ts:10-13) and genuinely load-bearing: `t = (bal + 1) / 2` blends the defensive and attacking lines in meAnchor (brain.ts:77-80) and switches the ball-compactness coefficient (brain.ts:89). A separate discrete phase machine (atk / tr_atk / def / tr_def) with hysteresis sits on top (brain.ts:14-22).",
   "whatsMissing": "It is not derived from per-player time-to-ball at all. The target it tracks is `mp.side === side ? 1 : -1` \u2014 a binary who-holds-the-ball flag \u2014 so the number carries no information about a contest. During a 50/50, a loose ball or an opponent under heavy pressure it does not move until possession has already flipped, at which point it needs ~1/0.055 \u2248 18 updates to swing. A real team possession balance would already be positive while the ball is still travelling toward your man."
  },
  {
   "item": "(7) ball desire / ball magnet, scaled by possession balance",
   "whatsThere": "A ball attraction on the zonal anchor: meAnchor (src/engine/brain.ts:88-89) pulls every slot toward the ball \u2014 `ay += (mp.by - ay) * (wide ? 0.10 : 0.30)` laterally and `ax += (mp.bx - ax) * (t > 0.5 ? CFG.compactAtk : CFG.compactDef + ...)` longitudinally \u2014 and the longitudinal coefficient is chosen by the lagged possession balance (0.06 in possession, 0.22 out of it, config.ts:82-83). Two players go directly at the ball: the 'press' duty (brain.ts:277-286) and the loose-ball scrambler (match.ts:61-68).",
   "whatsMissing": "There is no per-player desire scalar. The possession-balance gate is a hard threshold (`t > 0.5`) that snaps between two constants rather than scaling continuously, and it applies team-wide \u2014 every slot on the pitch gets the identical coefficient. The two players who do go for the ball are binary, all-or-nothing targets (tx = mp.bx, ty = mp.by), not a weighted pull. Nothing about the individual player \u2014 role, aggression, distance, whether he is the designated best \u2014 modulates how strongly the ball draws him."
  },
  {
   "item": "(10) adaptive formation rectangle with manager depth/width scale and a focus-position sliding it by ball and possession",
   "whatsThere": "meAnchor (src/engine/brain.ts:73-91) is exactly a rectangle in normalised slot space: `rel = (bd - mn) / (mx - mn)` and `ax = own + dir * (lineM + rel * span)`, with wideness = (bw - HALF_W)/HALF_W. Depth scale is manager-set \u2014 st.defLine shifts lineA/lineD by \u00b17m each and trims span (brain.ts:78-80). The rectangle slides by ball position (lineA/lineD are both computed from ballDepth, then ax/ay lerp toward the ball) and by possession (`t = (bal+1)/2` blends lineD\u2192lineA and adds up to 10m of span).",
   "whatsMissing": "No manager width scale worth the name: the only width control is `* (1 + st.passingDir * 0.02)` (brain.ts:87), a few percent, and the real width multipliers 0.94 / 0.66 are hardcoded constants selected by whether the slot is wide (|wideness| > 0.40). The strategy object has no width slider at all (NO_INSTRUCTIONS, config.ts:125-127). There is no explicit focus-position vector in (-1,-1)..(1,1) \u2014 the slide is done by direct arithmetic on ballDepth plus a lerp toward the ball, which reaches similar behaviour but leaves no single quantity a manager or a debug view can read or override."
  },
  {
   "item": "(13) per-role 'defensiveness' constant combined with laggy possession balance to mix offensive and defensive micro-positioning",
   "whatsThere": "Half the mechanism: an explicit defensive shape (lineD) and offensive shape (lineA) blended by the laggy possession balance, `lineM = lineD + (lineA - lineD) * t`, in meAnchor (src/engine/brain.ts:78-80).",
   "whatsMissing": "The per-role constant \u2014 the whole point of the item \u2014 does not exist. There is no defensiveness field on players or roles anywhere in the engine, and `t` is team-uniform: every slot from centre-back to striker is blended with the identical weight. The only role-dependent differentiation is that span grows ~10m with t, so a forward (rel\u22481) travels ~10m further than a centre-back (rel\u22480) between the two shapes \u2014 that is stretch, not a per-role offset, and it cannot produce the specified behaviour (CB 1.0\u21920.6 alongside ST 0.4\u21920.0, equal deltas at different offsets). Worse, meShape (brain.ts:249-257) computes bal, t, lineA, lineD, lineM, span, minBd, maxBd and bdRange and then never reads lineM, span or bdRange again \u2014 the loop calls meAnchor, which recomputes everything internally. Those are dead locals, and the comment above them at brain.ts:246-248 claims per-player commitment ('a centre-half stays honest when his side attacks, a striker barely tracks back') that the code does not implement."
  },
  {
   "item": "(15) weighted option system: closer to possession player / forward run / go wide / move back",
   "whatsThere": "Two separate mechanisms that between them produce the movement. meFindSpace (src/engine/brain.ts:215-236) scores 9 candidate points \u2014 eight compass directions at ME_SPACE_R = 9m plus stay-put \u2014 and takes the best, so forward, wide and backward movement all emerge. meRuns (brain.ts:25-66) implements three named committed runs, 'behind' / 'overlap' / 'third', each with trigger geometry, a CFG.runTicks = 14 duration and a CFG.runCool = 110 cooldown, capped at two active runs per side.",
   "whatsMissing": "The options are never enumerated as strategic alternatives and never weighted against each other. meFindSpace's nine candidates are geometric neighbours scored by one identical function; the scorer has no concept of 'this candidate is the wide one' or 'this one is the tiki-taka one'. There is no get-closer-to-the-possession-player option \u2014 the 'support' duty hardcodes a fixed offset `mp.bx - dir*7` (brain.ts:311) and going wide is a slot property (_bw), decided by formation, not chosen. meRuns is a rule cascade, not a weighting: the first if-condition that matches fires (`if (++active >= 2) break; continue`), so an overlap is never compared against a run in behind, and once two runs are live no third option is even considered."
  },
  {
   "item": "(16) weighted on distance-to-closest-opponent, passing lane, closeness to opponent goal, ideal distance to possession player",
   "whatsThere": "Three of the four, in meFindSpace's score (src/engine/brain.ts:227-232). Passing lane from ball to candidate: `- meLaneBlock(s, side, mp.bx, mp.by, cx, cy) * 0.30`, exactly as specified (geometry.ts:100-110, perpendicular distance to the line counting only opponents actually between the endpoints). Closeness to opponent goal: `+ meDanger(side, cx, cy) * 1.30` off the meVal surface. Opponent proximity: `meCtrl(s, side, cx, cy) * 1.00`, a Fernandez & Bornn pitch-control field (meInfluence, geometry.ts:37-59) \u2014 a substitution rather than the specified term, but a strictly richer one since it is velocity-aware and sums all opponents. Two extra terms beyond the spec: meSpaceGain (team-level ground newly owned) and a team-mate crowding penalty.",
   "whatsMissing": "The ideal-distance-to-the-possession-player band. No term anywhere in meFindSpace references the distance from the candidate point to the ball carrier, so a spot 3m off his shoulder and one 40m away are scored identically on that axis \u2014 the only ball-relative term is meLaneBlock, which measures obstruction, not range. Strictly, distance-to-closest-opponent is also not computed; it is approximated by the aggregate control field, which cannot distinguish one man tight on you from three men loosely spread."
  }
 ],
 "missing": [
  {
   "item": "(1) future ball position prediction array covering 2-3s, shifted each frame, recalculated on touch, with drag, rolling resistance, bounces and swerve",
   "why_it_matters": "The ball has no physics and no state beyond a destination. meFlight (src/engine/match.ts:271-274) stores a target (fx, fy) and a tick count ft; meTick's flight branch (match.ts:163-166) does `const k = 1 / Math.max(1, mp.ft); mp.bx += (mp.fx - mp.bx) * k` \u2014 a linear crawl to a fixed point. There is no velocity vector (mp.bvx/bvy are zeroed once in meKickoff at match.ts:47 and never read again), no z-axis, no ground, no bounces, no drag, no swerve, and no array of any kind. Grep for predict/trajectory/bounce/swerve/drag across src/engine returns nothing. Everything else on this list is downstream of it: with no predicted path there is nothing to compute a time-to-ball against, nothing to score interception points on, and no way for a defender to read a ball early. It also means loose balls travel in straight lines at constant speed to a spot chosen when they were struck, which is why the only way a pass can fail is a probability roll rather than someone getting there first."
  },
  {
   "item": "(2) time-needed-to-get-to-ball via a two-phase growing circle (momentum phase, then radial at max velocity, transition scaled by agility)",
   "why_it_matters": "No time-to-ball quantity exists anywhere. Every 'who gets there' question is answered with raw euclidean distance: meClosest and meTwoClosest (src/engine/geometry.ts:144-157) and meScramble (match.ts:120-128), the last of which adds only a positioning-attribute tilt `* (1 - meAttrs(q).position / 99 * 0.18)` and 1.5m of RNG. Momentum is therefore invisible to every contest \u2014 a defender sprinting away from the ball at 7 m/s and one standing still are treated as equal if they are the same distance from it, which is the single largest source of unfootballing outcomes in a positional engine, and pace only reaches the pitch through meSpeed in the movement layer, never through who wins a race. This is also the value items (3), (4), (5), (7) and (8) are all defined in terms of, so its absence is what forces those five to be approximated by possession flags and distances."
  },
  {
   "item": "(4) possession balance as a continuous per-player value = opponentBestTimeToBall - myTimeToBall",
   "why_it_matters": "There is no per-player balance of any kind \u2014 mp.bal (src/engine/brain.ts:10-13) is per-team only, and no player field in MePlayerState (src/engine/types.ts:28-39) holds anything comparable. Consequence: the engine cannot tell a striker who is nominally attacking but is actually 4m closer to the ball than any defender from one who is 30m adrift, so both get the same duty logic and the same shape blend. It also removes the natural source for item (7)'s ball desire and item (13)'s per-player commitment, both of which currently fall back to a team-wide scalar."
  },
  {
   "item": "(8) 'what ball position exactly' \u2014 iterate over future interception timestamps, scoring each on time, direction and opponent proximity",
   "why_it_matters": "No player ever targets a future ball position. meMove sends the chaser at the ball's current coordinates \u2014 `if (i === scramble) { tx = mp.bx; ty = mp.by; }` (src/engine/match.ts:68) \u2014 so chasers permanently trail a moving ball rather than cutting it off. The one piece of lead-the-target logic in the engine runs the other way: meTick's pass aims at where the receiver will be, `baseX + (q.vx || 0) * ticks * 0.85` (match.ts:255-256), which is the passer leading his man, not a receiver or a defender choosing an interception point. Interception is instead resolved by fiat at the end of flight: if the intended receiver happens to be within 3.4m of the landing spot he collects it, otherwise meScramble rolls for it (match.ts:173-178). That is why defensive interception has to be faked through CFG.interceptW = 1.9 inflating a defender's lane-blocking weight (geometry.ts:107) rather than anyone actually running onto the ball."
  },
  {
   "item": "(11) more movement for midfielders than defenders and attackers within the rectangle",
   "why_it_matters": "No role- or line-dependent movement amplitude exists. Every outfielder searches the same ME_SPACE_R = 9m ring in meFindSpace (src/engine/brain.ts:213-220) and is held by the same CFG.leash = 15m (config.ts:67); the two larger leashes, leashPress 24 and leashRun 30, are selected by duty (press/cover, or an active run) at brain.ts:330-331, never by whether the player is a centre-back or a central midfielder. The result is a shape with uniform elasticity: the back line roams as freely as the midfield, and the midfield never does the extra covering that makes a 4-3-3 read as a 4-3-3. Note the actual bias currently runs the wrong way \u2014 meFindSpace is only reached from the runner, support, width and hold duties (brain.ts:307-317), and only when `attacking` for the last two, so defenders in a defensive phase do no space search whatsoever while forwards do."
  }
 ]
}
```

## Appendix B: raw subsystem reads

```json
[
 {
  "subsystem": "Off-the-ball positioning AI (GameplayFootball). Repo root: /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf \u2014 all `where` paths below are relative to that root. The four offtheball/*.cpp files are thin 40-line wrappers; the actual mechanisms live in ElizaController, PlayerController, TeamAIController and AIfunctions, all read in full. Pitch is 110x68 here (pitchHalfW=55, pitchHalfH=36, gamedefines.hpp:271-272) so metre constants need a ~0.955 x-rescale for a 105x68 pitch. Velocities: idle 0, dribble 3.5, walk 5.0, sprint 8.0 m/s (gamedefines.hpp:18-21). NOTE: `curve()` and `NormalizedClamp()` are engine helpers from the `blunted` base lib, which is NOT vendored in this tree. From consistent usage, NormalizedClamp(v,a,b) = clamp((v-a)/(b-a),0,1); curve(x,bias) = lerp(x, -cos(x*pi)*0.5+0.5, bias), i.e. cosine smoothstep blended with linear \u2014 the identical expression appears inline at AIfunctions.cpp:93. Treat those two as inferred, everything else is read from source.",
  "mechanisms": [
   {
    "name": "Static/dynamic formation blend by distance to the ball carrier",
    "whatItDoes": "Every off-ball player's target starts as a blend of his OWN formation slot and the slot he was reassigned to by the Hungarian solver. Near the action he uses the swapped (dynamic) slot; far from the action he reverts to his own slot.",
    "howItWorks": "actionDistance = NormalizedClamp(dist(player, match->GetDesignatedPossessionPlayer()), 15.0, 20.0); staticPositionBias = curve(K * actionDistance, 1.0); desired = static*bias + dynamic*(1-bias). K differs per line and is the only difference between the three files: DEF K=1.0, MID K=0.9, OFF K=0.8 (comment: 'lower values = swap position with other players' formation positions more easily'). So inside 15m of the carrier everyone is 100% dynamic; beyond 20m DEF is 100% static, MID ~97.6% static, OFF ~90.5% static.",
    "where": "default_def.cpp:20-24, default_mid.cpp:22-26, default_off.cpp:22-26",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Dynamic role reassignment (Hungarian assignment on formation slots)",
    "whatItDoes": "Players swap formation slots with each other so nobody has to cross the pitch to reach 'his' position. This is what makes a fullback who drifted centrally take the CB slot instead of running back around.",
    "howItWorks": "Every 400ms (staggered per team) build the 10 outfield adapted formation positions, cost[x][y] = |players[x].pos + players[x].movement*0.5 - formationPos[y]|, quantised to int(round(dist*10)). Then run libhungarian repeatedly with a rising distance ceiling: sort all n^2 distances, walk them from index n in steps of 5, mark any cost >= distances[i] as 50000, solve, accept the first solve whose totalCost < 50000. The winning assignment writes the OTHER player's FormationEntry into this player's dynamicFormationEntry. GK is removed from the pool first.",
    "where": "teamAIcontroller.cpp:413-510, called from team.cpp:341-344 at (actualTime_ms + 200*teamID) % 400 == 0",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Formation position = normalized slot mapped into a possession-driven bounding box",
    "whatItDoes": "Turns a slot's fixed (-1..1, -1..1) coordinate into a pitch position by computing a rectangle that slides up/down the pitch and stretches/squeezes with possession, then placing the slot proportionally inside it.",
    "howItWorks": "depth=0.45, width=0.95 base (ctor teamAIcontroller.cpp:25-26). adaptedDepth = depth*(offense_depth*possBias + defense_depth*(1-possBias)) with offense_depth_factor 0.9 / defense 0.75; adaptedWidth likewise from 0.9 / 0.8. offsetX = pitchHalfW*side*((offense_ownhalf*2-1)*possBias + (defense_ownhalf*2-1)*(1-possBias)) with ownhalf factors 0.52 offense / 0.54 defense. centerX = clamp(ballX*(1-sideFocusStrength) + sideX*sideFocusStrength + offsetX, \u00b1pitchHalfW) where sideX = 0.2*sideFocus*-side*pitchHalfW + 0.8*-avgPossessionSide(6000ms)*pitchHalfW. centerY = clamp(ballY, \u00b1pitchHalfH). Then centerX *= ((1-adaptedDepth))*0.95 + 0.05 and centerY *= ((1-adaptedWidth))*0.9 + 0.1 so the box stays on the pitch. Box = [centerX \u2213 adaptedDepth*pitchHalfW*-side] x [centerY \u00b1 adaptedWidth*pitchHalfH]. ballX/ballY are time-averaged ball positions over 3500ms/4000ms shortened by urgency: urgencyBias = 1 - NormalizedClamp(dist(carrier, player), 2, 30), windows scale by (1 - urgency*0.7) and (1 - urgency*0.5).",
    "where": "teamAIcontroller.cpp:277-411 (esp. 287-290, 313-359), base tactics teamAIcontroller.cpp:39-52",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "possessionBias \u2014 the master 0..1 scalar for attack vs defend shape",
    "whatItDoes": "Single blend factor that every formation term interpolates on. Combines fading possession with where the ball actually is, weighting the ball more when possession is ambiguous.",
    "howItWorks": "possessionAmountBias = NormalizedClamp(fadingTeamPossessionAmount - 0.5, 0.3, 0.7); ballBias = NormalizedClamp((ballX/pitchHalfW)*-side, -0.7, 0.7); ballBiasBias = (1 - |possessionAmountBias*2 - 1|) * 0.6  (peaks at 0.6 when possession is exactly 50/50, zero when possession is clear); possessionBias = possessionAmountBias*(1-ballBiasBias) + ballBias*ballBiasBias; then clamp(possessionBias + (offensivenessBias-0.5)*0.3, 0, 1).",
    "where": "teamAIcontroller.cpp:313-322",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "fadingTeamPossessionAmount \u2014 rate-limited possession EMA (the core hysteresis of the whole AI)",
    "whatItDoes": "Prevents the entire team shape from flipping between attack and defence on every loose touch. Nearly every weight in the off-ball code reads this.",
    "howItWorks": "teamPossessionAmount = (oppTeamTimeToBall_ms + 1500) / (ownTeamTimeToBall_ms + 1500). tmp = fading*0.995 + clamp(teamPossessionAmount, 0.5, 1.5)*0.005; fading += clamp(tmp - fading, -0.005, +0.005) per 10ms tick \u2014 i.e. a hard slew limit of 0.5 units/second over a range of [0.5, 1.5], so a full swing takes 2 seconds minimum. Forced to 1.5/0.5 outright during set pieces or when a keeper holds the ball. Per-player override: if this player is his team's designated possession player, distanceBias = NormalizedClamp(dist(player, ball@300ms), 2, 14)^2 and fading is re-mixed toward the instantaneous value so the man nearest the ball can react without waiting for the EMA.",
    "where": "team.cpp:324-334; per-player override playercontroller.cpp:589-597; setter clamp team.cpp:237-239",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Support position: force-field / boids solver (the actual off-ball movement)",
    "whatItDoes": "Produces the attacking off-ball target: sit in space, don't crowd teammates, don't stand on the passing lane, orbit the ball carrier at a band, stay onside.",
    "howItWorks": "Builds a ForceSpot list around currentPos = pos + movement*0.1, then target = currentPos + AI_GetForceFieldMovement(field, currentPos, dampingDist=7). Weights (overallWeight=1.0, webScale=0.75): basePositionWeight 0.7, opponentRepel 0.3, teammateRepel 0.4, ballRepel 1.0, run 1.0, flockToPossessionPlayer 0.45. opponentRepel is then multiplied by role: CB/LB/RB x2.2, DM x2.0, CM/LM/RM x1.6, AM x1.2, CF x1.0 \u2014 defenders avoid opponents hard, strikers barely at all. Spots: (a) base formation position, Attract/Constant, power 0.7 * (0.3 + 0.7*NormalizedClamp(dist,0,20)) so the pull grows with distance; (b) 3 nearest opponents, Repel/Variable, scale 5.0, exp 0.7, origin pushed 2.0m BEHIND the opponent along the opponent\u2192carrier axis so the passing lane is what gets cleared; (c) 6 nearest teammates, Repel/Variable, scale 14*0.75=10.5, exp 1.0, only when fadingPossession >= 1.02; (d) ball repel at ball predictions 200/350/500/650ms, Repel/Variable, scale 2.0, exp 0.5, only when fadingPossession >= 1.06 and not the carrier; (e) attract to carrier scale 28*0.75=21, exp 1.0 AND repel from carrier scale 16*0.75=12, exp 1.0, both power 0.45 \u2014 the pair forms a ~12-21m orbit band. Finally hard-clamped behind the offside line with margin 0.08 and to the pitch.",
    "where": "elizacontroller.cpp:597-789; called from default_def.cpp:29, default_mid.cpp:37, default_off.cpp:45",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "AI_GetForceFieldMovement \u2014 the force-field integrator",
    "whatItDoes": "Turns a list of attract/repel spots into a single displacement vector of at most one sprint-second.",
    "howItWorks": "For each spot: distance = |origin - currentPos|; intensity = 1.0 for e_DecayType_Constant, else clamp(1 - distance/scale, 0, 1)^exp. Direction = normalize(origin - currentPos), negated for Repel. Attractors are damped: if distance < attractorDampingDistance then direction *= distance/attractorDampingDistance (prevents overshoot). force = power * intensity; accumulate cumulVec += dir*force and cumulForce += force. Result = (cumulVec / cumulForce) * sprintVelocity \u2014 a WEIGHTED AVERAGE of directions scaled to 8m, not a sum. Returns zero vector if cumulForce == 0.",
    "where": "AIfunctions.cpp:458-497; default damping 10 (AIfunctions.hpp:38), off-ball callers pass 7",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "attackBias \u2014 how much of the target is support position vs formation position",
    "whatItDoes": "Gates how far the force-field support position overrides the formation position, per line.",
    "howItWorks": "attackBias = NormalizedClamp((fadingTeamPossessionAmount - 0.5) * 1.0, lo, hi) with DEF lo/hi = 0.2/0.9, MID = 0.1/0.7, OFF = 0.1/0.6. desired = desired*(1-attackBias) + supportPosition*attackBias. So at fadingPossession 1.0 (v=0.5): DEF 0.43, MID 0.67, OFF 0.80 \u2014 attackers commit to support runs earlier and harder than defenders.",
    "where": "default_def.cpp:28-30, default_mid.cpp:30-38, default_off.cpp:38-46",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Attacking run trigger (team-level, 4-second window, one runner)",
    "whatItDoes": "Periodically elects exactly one player to make a straight run in behind, if conditions favour it.",
    "howItWorks": "Evaluated at (actualTime_ms % 500 == 0) and only if the previous run window has expired. Requires match->GetBestPossessionTeamID() == own team. Runner candidate = AI_GetClosestPlayer(team, carrierPos + (-side*26.0, 0, 0), onlyAIControlled=true, except=carrier). distanceRating = (1 - NormalizedClamp(|runner - carrier|, 0, 40))^0.5. oppDensityRating starts at 1.0 and SUBTRACTS, for each of the 4 opponents nearest to spot = runnerPos*(1, 0.8, 0) + (side*10, 0, 0): (curve(1 - NormalizedClamp(oppDist, 0, 15), 1.0))^0.5 * 0.3. runConditionsRating = distanceRating * oppDensityRating; fires if >= 0.5. ApplyAttackingRun sets endApplyAttackingRun_ms = now + 4000 and stores attackingRunPlayer.",
    "where": "teamAIcontroller.cpp:76-83 (SelectAttackingRunPlayer), 189-222 (trigger), 907-911 (ApplyAttackingRun)",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Run consumption in the strategies (and the DEF/MID/OFF asymmetry)",
    "whatItDoes": "The elected runner actually runs only if his line's attackBias is above a threshold \u2014 so runs are effectively a striker/attacking-midfield behaviour.",
    "howItWorks": "makeRun = (attackBias > T) && teamController->GetEndApplyAttackingRun_ms() > now && GetAttackingRunPlayer() == this player. T = 0.9 for MID, 0.7 for OFF, and DEF NEVER passes makeRun at all (it calls GetSupportPosition_ForceField with the default makeRun=false). Solving the thresholds: MID needs fadingPossession > 1.14, OFF needs > 0.95 \u2014 strikers make runs almost whenever possession is neutral, midfielders only under sustained dominance. When makeRun is true the force field gains an Attract/Constant spot at (-side*pitchHalfW, currentPos.y*0.5, 0) with power 2.0*runWeight, and opponent-repel spots are weakened (scale 5.0 -> 2.0, power *0.5) so the runner will run past defenders instead of around them.",
    "where": "default_mid.cpp:31-37, default_off.cpp:39-45, default_def.cpp:29; run spot elizacontroller.cpp:687-694; repel weakening elizacontroller.cpp:708-711",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Forward support player + the 'lane' push",
    "whatItDoes": "Keeps one designated teammate constantly ahead of the carrier for a forward option, and pushes everyone else forward according to which flank the ball is on.",
    "howItWorks": "forwardSupportPlayer = AI_GetClosestPlayer(team, carrierPos + (-side*1.5, 0, 0), except carrier), recomputed every 1500ms (teamAIcontroller.cpp:224-226). In the force field, if this player IS the forward support player his base spot is shifted forward by -side * (0.3 + 0.7*dynamicMindSet) * 12.0 metres. Otherwise the 'lane version': amount = 22.0; laneY = -signSide(carrierY) * 8.0 (the OPPOSITE flank at 8m); amount *= curve(1 - NormalizedClamp(|laneY - currentY|, 0, 30), 1.0); delta = -side * dynamicMindSet^1.5 * amount. So players in the far-side lane push up to 22m forward, scaled steeply by role offensiveness. A commented-out sine version (period 7s, amplitude 8-14m, phase from pitch Y) is left in place as the previous approach.",
    "where": "elizacontroller.cpp:653-685; forwardSupportPlayer election teamAIcontroller.cpp:224-226",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "AddDefensiveComponent \u2014 marking-position solver (goal-side interception point)",
    "whatItDoes": "The core defensive mechanism: pulls a marker's target toward the point where his assigned opponent would shoot from, ensuring he gets there first, and bailing toward his own goal when he is already beaten.",
    "howItWorks": "Runs only if opponentID != -1 (from GetManMarkingID(), or a forced ID). Constants: possessionPlayerShootThreshold 24.0m (if the marked man IS the ball carrier), genericOpponentShootThreshold 8.0m otherwise, minDistance 0.4, bufferDistance 4.0. oppPos = mentalImage position + movement*0.5 (half-second lead). oppToThresholdDistance = clamp(|goal - oppPos| - shootThreshold, 0.4, pitchHalfW); shootingPoint = oppPos + normalize(goal - oppPos)*oppToThresholdDistance. If shootingPoint is beyond the team's offsideTrapX, shootingPoint is re-derived as the intersection of the opp\u2192goal line with the offside line (keeps the defensive line intact instead of dropping). Then: slackedDistance = |shootingPoint - desiredPosition| - (oppToThresholdDistance - 4.0); if positive, defendPosition = desiredPosition + normalize(toThreshold)*clamp(slack, 0, dist) \u2014 i.e. move exactly enough to be 4m closer to the shooting point than the attacker is. Second correction using ACTUAL position (pos + movement*0.14): if actualToThreshold - oppToThreshold > 0 (we're losing the race), add (goalPos - defendPosition).normalized * thatSlack * 0.7 \u2014 retreat goalward instead of chasing. Finally desiredPosition = lerp(desiredPosition, defendPosition, bias).",
    "where": "playercontroller.cpp:53-122",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Defensive bias by role mindset and possession",
    "whatItDoes": "How strongly each line applies the marking solver, as a function of role offensiveness and team possession.",
    "howItWorks": "bias = pow(clamp(C - mindset - fadingTeamPossessionAmount, 0, 1), 0.7) with C = 1.9 (DEF), 1.5 (MID), 1.3 (OFF). mindset from AI_GetMindSet(dynamicRole). Worked examples: CB (mindset 0) at full possession 1.5 -> 0.4^0.7 = 0.53, so a CB always keeps at least ~half the marking pull; CM (0.5) at possession 1.0 -> 0.0, no marking at all; CF (1.0) gives 1.3-1.0-fadingPossession which is <= -0.2 for the whole legal range [0.5,1.5], so the offense strategy's defensive block is DEAD CODE for its only caller role. Worth reproducing deliberately or fixing deliberately, not by accident.",
    "where": "default_def.cpp:35-36, default_mid.cpp:43-44, default_off.cpp:50-51; AI_GetMindSet AIfunctions.cpp:1228-1249 (GK/CB 0.0, LB/RB/DM 0.25, LM/CM/RM 0.5, AM 0.75, CF 1.0)",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Man-marking assignment (top-3 danger, greedy by marking quality)",
    "whatItDoes": "Assigns markers to the three most dangerous opponents; everyone else is free to hold shape.",
    "howItWorks": "numMarkedOpponents = 3 (hardcoded, with the 11-vs-11 alternative commented out). Reset all ManMarkingID to -1. Walk the pre-sorted danger list; for each opponent, scan all remaining non-GK teammates, score each with CalculateMarkingQuality, take the best, set his ManMarkingID and REMOVE him from the pool. Greedy, most-dangerous-first, one marker per opponent, no re-optimisation. Recomputed every 400ms at (actualTime_ms + 200*teamID + 100) % 400 == 0, deliberately offset 100ms from the dynamic-role solve.",
    "where": "teamAIcontroller.cpp:570-623; cadence team.cpp:346-349",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "CalculateMarkingQuality \u2014 who is best placed to mark whom",
    "whatItDoes": "Scores a (defender, attacker) pair not by raw distance but by whether the defender is goal-side and laterally in range.",
    "howItWorks": "Build a virtual line through the defender PERPENDICULAR to his own goal direction: toGoal = goalPos - playerPos; lineLength = clamp(|toGoal|, 4.0, 14.0); safetyVec = -normalize(toGoal)*0.5; endpoints = playerPos + safetyVec \u00b1 rotate2D(normalize(toGoal), \u00b1pi/2)*lineLength. Then oppFromLineDistance and u (0..1 along the line). If the opponent is on the goal-far side, adaptedDist = |dist - 2.0| (the sweet spot sits 2m off the line). oppFromLineDistanceFactor = NormalizedClamp(adaptedDist, 0, 60)^0.5; oppOnLineDistanceFactor = clamp(|u*2-1|, 0, 1)^0.5. result = 1 - 0.5*fromLine - 0.5*onLine, clamped; then *0.6 if the opponent has already got past the line; then result = result*0.8 + (1 - NormalizedClamp(|player-opp|, 0, 110))*0.2 to break ties when everything is zero.",
    "where": "teamAIcontroller.cpp:512-568",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Opponent danger ranking",
    "whatItDoes": "Orders opponents by threat so marking is spent on the right men.",
    "howItWorks": "mostDangerousPos = ((pitchHalfW - 2)*side, 0, 0)*0.8 + ballPredict(100ms)*0.2 \u2014 mostly the defending team's own goalmouth, nudged toward the ball. dangerFactor = 1 - NormalizedClamp(|oppPos - mostDangerousPos|, 0, 2*pitchHalfW); then *0.95, and +0.05 if that opponent is the designated possession player. Sorted descending. Rebuilt every TeamAIController::Process tick.",
    "where": "teamAIcontroller.cpp:133-157",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Defensive line / offside trap line (offsideTrapX = 'deepestDanger')",
    "whatItDoes": "One X coordinate per team defining how high the back line holds. Everything defensive clamps to it.",
    "howItWorks": "startDistance = 30 + 20*offensivenessBias (distance from own goal where holding starts); forceDistance = 6.0 (never hold tighter than this). Start with deepestDanger = (pitchHalfW - startDistance)*side, then take the max (in own-goal-ward terms) of: (1) an adapted ball X \u2014 offsetX = 20 + 10*(1-offensivenessBias); startToForcedBias = NormalizedClamp(ballX_ownHalfSpace, pitchHalfW - startDistance - offsetX, pitchHalfW - forceDistance); adaptedBallX += offsetX*(1 - startToForcedBias), so the line drops back generously far from goal and refuses to buckle near it; (2) ball prediction at 700ms; (3) the ball carrier's position + movement*0.15 + cautionDistance 4.0m; (4) own team's own offside line minus allowSlackDistance 4.0m, so one slacking defender drags the whole line back rather than playing everyone onside. Result assigned to offsideTrapX.",
    "where": "teamAIcontroller.cpp:91-128",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "ApplyOffsideTrap \u2014 smooth line compression, not a hard clamp",
    "whatItDoes": "Squeezes the defensive line flat around the trap line without the visible snap of a hard clamp.",
    "howItWorks": "areaHalfLength = 2.0m. Working in own-goal-positive space: if absPosX > absTrapX - 2.0, then areaFront = absTrapX - 2.0; posFactor = clamp((absPosX - areaFront)/4.0, 0, 1); result = areaFront + 2.0*posFactor. That maps the 4m band [trap-2, trap+2] onto the 2m band [trap-2, trap] \u2014 deepest player unmoved, most advanced player pulled back 2m. The commented-out binary version is right above it. Called by DEF and MID strategies AFTER AddDefensiveComponent; the OFF strategy never calls it.",
    "where": "teamAIcontroller.cpp:625-651; callers default_def.cpp:39, default_mid.cpp:47 (absent in default_off.cpp)",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "AI_GetOffsideLine \u2014 second-deepest opponent, with ball override",
    "whatItDoes": "Correct association-football offside line, used both by attackers (stay onside) and by the defending team (line integrity check).",
    "howItWorks": "For teamID's players, extrapolate position.x by movement.x * futureSim_ms*0.001. Find the deepest (dud, i.e. the keeper normally), then find the deepest EXCLUDING him \u2014 that is the line. If the ball is deeper than that, the ball becomes the line. If the line is on the attacking half in signed terms, snap to 0.01*-side (halfway line). Clamp to \u00b1pitchHalfW. Off-ball callers use futureSim_ms=240 (support position) or 0 (line integrity).",
    "where": "AIfunctions.cpp:319-358; callers elizacontroller.cpp:521 and 649, teamAIcontroller.cpp:115",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Offside enforcement on the support position",
    "whatItDoes": "Hard veto: the force-field result is never allowed past the offside line.",
    "howItWorks": "margin = 0.08m; if forceFieldPosition.x*-side > offsideX*-side - margin, then forceFieldPosition.x = offsideX - margin*-side. offsideX comes from AI_GetOffsideLine(..., oppTeamID, 240ms). Then clamped to the pitch. The (unused) candidate-rating variant instead uses offsideWeight = 10.0 against total weights summing to ~4-5, an effective veto by weight rather than by clamp.",
    "where": "elizacontroller.cpp:649, 782-786; weight version elizacontroller.cpp:483, 554-559",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "GetLazyVelocity \u2014 role- and distance-based effort throttling plus stamina",
    "whatItDoes": "Stops all 22 players sprinting to their target every tick. Produces the recognisable behaviour of strikers jogging when defending and fullbacks jogging when attacking.",
    "howItWorks": "Input is UNCLAMPED distance*2.6; overflow above sprint is compressed to 10%. startLazinessDistance = 20.0*(fatigueInv*0.8 + 0.2); endLazinessDistance = 65.0*(fatigueInv*0.5 + 0.5). actionDistance = |playerPos - oppCarrierPos|. teamPossession = clamp(fadingPossession - 0.5, 0, 1). lazinessByRole = mindSet + teamPossession*(1 - mindSet*2) \u2014 for a CF (mindSet 1) this is 1 - teamPossession (lazy without the ball), for a CB (0) it is +teamPossession (lazy with the ball), and midfielders (0.5) sit at a constant 0.5. lazinessByPosition = NormalizedClamp(actionDistance, start, end). lazyFactor = lazinessByPosition * (0.5 + lazinessByRole*0.5). result = velocity*(1 - lazyFactor), floored at dribbleVelocity 3.5 if the input was already >= 3.5. Then a short-term breath model: breathLeft = (1 - NormalizedClamp(avgVelocity over last 10 samples, 0, 8)) ^ (0.8 - workrateStat*0.2), *1.2 clamped to 1 (so the start of a sprint is full speed), then re-mixed as breathLeft*lazyFactor + 1*(1-lazyFactor) so a player who genuinely must run is not throttled; result = min(result, sprintVelocity*breathLeft).",
    "where": "elizacontroller.cpp:437-474; called from default_def.cpp:46, default_mid.cpp:54, default_off.cpp:66",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Arrival velocity from distance",
    "whatItDoes": "Converts a target position into a speed; the whole off-ball layer outputs (direction, speed), never a path.",
    "howItWorks": "direction = normalize(desiredPosition - playerPosition) (falls back to current facing when zero-length); desiredVelocity = |desiredPosition - playerPosition| * distanceToVelocityMultiplier where the constant is 2.6 (gamedefines.hpp:54); after laziness, clamp(0, sprintVelocity=8). So speed saturates at ~3.08m from target and decays linearly inside that \u2014 a built-in arrival behaviour with no separate braking rule.",
    "where": "default_def.cpp:42-50, default_mid.cpp:50-58, default_off.cpp:62-70; constant gamedefines.hpp:54",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Ball-hunting / pressing fallback for unmarked players",
    "whatItDoes": "A player with no marking assignment who happens to be near the opposition carrier converts to a presser, overriding his positional target.",
    "howItWorks": "Runs only when NOT the designated possession player. huntDistanceThreshold = 10.0 + (1 - mindSet)*10.0, then *= (0.5*fatigueFactorInv + 0.5*(1 - NormalizedClamp(avgVelocity(10), 0, 8))) \u2014 a tired or already-sprinting player has a smaller trigger radius \u2014 then *= (0.3 + matchDifficulty*0.7). Fires if !teamHasBestPossession && ManMarkingID == -1 && |(oppPos + oppMovement*0.12) - (myPos + myMovement*0.04)| < threshold. Then only the 2 closest teammates (huntingPlayersNum = 2) to (oppPos + oppMovement*0.1) may actually press. If eligible: defendPosition = GetDefendPosition(opp); if NeedDefendingMovement passes, direction/velocity are overridden and forceMagnet is set. Separately, if this player is his team's designated possession player and possessionAmount > 0.8, forceMagnet and extraHaste are set outright ('don't give up battles too easily').",
    "where": "elizacontroller.cpp:328-387",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "GetDefendPosition \u2014 interception point on the opponent\u2192goal line",
    "whatItDoes": "Where to run to cut a carrier off, rather than chasing his current position.",
    "howItWorks": "Geometric construction: (1) line A-B from me to the opponent; (2) the perpendicular bisector of A-B; (3) intersect that bisector with the opponent\u2192own-goal line and take parameter u, clamped to [0,1] \u2014 this is the point equidistant from both of us, i.e. the earliest point on his path to goal I can reach. target = that point, then offset by normalize(oppToGoal)*sprintVelocity*0.1 (0.8m) + oppImage.movement*0.14 + normalize(oppToGoal)*distance (distance defaults 0).",
    "where": "playercontroller.cpp:124-167",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "NeedDefendingMovement \u2014 'only move if absolutely necessary'",
    "whatItDoes": "Gate that stops defenders shuffling backwards pointlessly when they are already goal-side of the interception point.",
    "howItWorks": "howDeepIsTarget = max((target.x - pos.x)*-mySide, 0) - 0.5 (0.5m reaction-time buffer); howWideIsTarget = |target.y - pos.y|; return howWideIsTarget > howDeepIsTarget * 0.8. Move only if the lateral correction dominates the forward one.",
    "where": "humanoid_utils.cpp:105-115",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Goalie base position: angle-bisector line + come-out bias",
    "whatItDoes": "Keeper positioning that narrows the angle, sitting on the line that bisects his view of the goal, and decides whether to leave the line.",
    "howItWorks": "Default lineDistance 10.0m in front of goal. Ball position read as prediction at (600 + timeNeededToGetToBall_ms*0.2). Build vectors to both posts at \u00b13.7m; bisect the angle; extend the resulting ray to the backline (drawn at pitchHalfW - 0.7 rather than on the line itself); clamp the backline intersection to \u00b13.7 (inside the posts). awayFromGoalOffset_m base 0.7; awayFromGoalBias base 0.3, multiplied by NormalizedClamp(fadingTeamPossession, 1.0, 1.5). When possession < 1.0 the line origin is re-mixed toward the opponent carrier: oppPos*0.6 + ballPos*0.4 if he is NOT in control, oppPos*0.4 + ballPos*0.6 if he is (opp position lead 0.32s). awayFromGoalOffset = clamp(lineLength*bias, 0.7, pitchHalfW), applied along the bisector, so the keeper stands further out when the ball is further away.",
    "where": "goalie_default.cpp:41-181",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Goalie come-out decision (two-level shooting-point race)",
    "whatItDoes": "Decides whether to rush an attacker, discounted by how dangerous the attacker's nearest support option is.",
    "howItWorks": "Primary: shootThreshold 20.0m; oppToThresholdDistance = clamp(oppToGoalDistance - 20.0*NormalizedClamp(oppToGoalDistance, 0, 40), 0, pitchHalfW) \u2014 a threshold that itself shrinks close to goal; shootingPoint = along opp\u2192goal at that distance. mateToThresholdDistance = distance from the nearest outfield teammate (position + movement*0.24) to that point. If mate is more than 1.0m further than the opponent, set awayFromGoalBias = 1.0 (come out). Then discount by secondary danger: repeat the whole calculation for the opponent nearest the goal (helperShootThreshold 24.0m, lead 0.32s); secondaryDistanceDiff = NormalizedClamp(mateHelperDist - oppHelperDist, 0, 2) when positive; helperVSPrimaryDistanceRatio = (1 - NormalizedClamp(oppHelperToThreshold/(oppToThreshold+1e-4), 1.0, 1.5)) * 0.7 ('always allow some coming out despite opp mate danger'); awayFromGoalBias = clamp(1 - secondaryDistanceDiff*helperVSPrimaryRatio, 0, 1).",
    "where": "goalie_default.cpp:88-152",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Goalie shot-stopping: is the ball bound for goal, and where to intercept",
    "whatItDoes": "Switches the keeper from positional mode to interception mode.",
    "howItWorks": "panic = 1.02 + (1 - (stat mental_defensivepositioning*0.6 + stat mental_vision*0.4)) * 0.5 \u2014 a per-keeper goal-width inflation factor (a worse keeper reacts to more balls, i.e. dives at things that were going wide). Precondition: ballPredict(4000ms) is past the backline AND |playerPos - ballPredict(250)| < 32.0m (cpu optimisation). 2D test: line from ballPredict(0) to ballPredict(800), intersect with the goal line; bound-for-goal iff |intersect.y| <= 3.7*panic; store that y. In intercept mode build a line from ballPredict(10) to the goal-line crossing point pulled 0.4m back off the line, project (playerPos + movement*0.05) onto it, clamp u to [0,1], target that point, x clamped to pitchHalfW - 0.2. A commented-out 3D triangle-intersection version (goal height 2.5*panic) is retained above the 2D one.",
    "where": "goalie_default.cpp:211-269 (detection), 182-203 (interception)",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "CalculateBestAchievableTarget (disabled) \u2014 reachability walk along a line",
    "whatItDoes": "Picks the furthest point along a segment the player can actually reach in time; left in the source but commented out at the call site because it 'doesn't work good enough'.",
    "howItWorks": "stepsPerMeter 4.0; stepSize = 1/clamp(|pos1-pos2|*4, 1, 20); walk percentage 0..1, interpolating both position and the allowed time, and return the first point where AI_GetTimeNeededForDistance_ms(...).optimistic_ms*0.001 <= allowed time; else return the far end.",
    "where": "goalie_default.cpp:20-39, call site commented out at goalie_default.cpp:164-172",
    "portable": "yes",
    "priority": "low"
   },
   {
    "name": "Candidate-sampling support position (dead code, alternative algorithm)",
    "whatItDoes": "The predecessor to the force field: samples a ring of candidate positions and scores them. Never called \u2014 kept because it is a complete, cheaper alternative worth knowing.",
    "howItWorks": "37 candidates: current position plus 12 directions (2*pi/12 steps) at radii dribbleVelocity 3.5, walkVelocity 5.0, sprintVelocity 8.0. Weights: offense = 0.8 + mindSet*clamp((fadingPossession-0.5)*2, 0, 1); distance 1.0; pass 0.8; movement 1.5; formation = 1.6 + clamp(|pos - ball@100ms|/30, 0, 1); offside 10.0 (veto). Sub-ratings all normalised as clamp(delta/sprintVelocity*0.5 + 0.5, 0, 1): offenseRating on change in goal distance (with a 5m 'not too close' offset), distanceRating on change in ball distance where a desiredBallDistance of 10.0m is mirrored so closer than 10m is penalised, movementRating = 1 - clamp(|currentMovement - candidateDelta|/(2*sprint), 0, 1), formationRating on change in distance to the base position, offsideRating binary. +0.1 bonus for the current position (stickiness). Two-phase for cost: sort by total, then compute the expensive passRating only for the top third \u2014 passRating = min over the 4 nearest opponents of clamp(|opp - checkPoint|/8.0, 0, 1)^1.2, where checkPoint is 2m from the candidate toward ball@240ms.",
    "where": "elizacontroller.cpp:476-595 (definition), declared elizacontroller.hpp:48, PreRating struct elizacontroller.hpp:18-29; no callers anywhere in the tree",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "AI_GetAdaptedFormationPosition \u2014 slot-to-pitch mapping with midfield stretch and focus pulls",
    "whatItDoes": "The lowest layer of formation positioning: places a normalized slot inside the computed box, then applies up to three attractors.",
    "howItWorks": "Slot position is normalized (-1..1, -1..1). Midfield stretch (before mapping): stretchBias = curve(clamp(1 - |slotX*1.2|, 0, 1), 1.0) * midfieldFocusStrength \u2014 the 1.2 overstretch means only genuinely central slots are affected; slotX = lerp(slotX, midfieldFocus*2-1, stretchBias). Mapping: x = backXBound + (slotX*0.5+0.5)*(frontXBound - backXBound); y = lowYBound + (slotY*-side*0.5+0.5)*(highYBound - lowYBound). xFocus pull: bias = 1 - clamp(|xFocus - x|/|back-front|, 0, 1), then bias = (-cos(bias*pi)*0.5+0.5)^0.8 * xFocusStrength. yFocus pull: bias = (1 - clamp(|yFocus - y|/|high-low|, 0, 1)) * (0.2 + 0.8*|yFocus|/pitchHalfH) * yFocusStrength. microFocus (pull toward the action): homogeneousYInfluenceBias 0.2, homogeneousYPositionBias 0.4; dist = |(microFocus - purePosition)*(1, 0.8, 0)| / 50.0 measured from the PURE slot position not the live position ('players are more strictly keeping to their positions'); if dist < 1: bias = curve(1 - dist, 0.3) \u2014 deliberately near-binary, 'come over completely or not at all' \u2014 plus a short-distance peak of (1 - NormalizedClamp(|dist - 0.15|, 0, 0.25))*0.1, clamped, then *microFocusStrength; the target blends microFocus.x fully but only 60% of microFocus.y.",
    "where": "AIfunctions.cpp:58-168",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "microFocus / midfieldFocus strengths \u2014 auto-modulation by pitch side",
    "whatItDoes": "Makes teams collapse onto the ball in their own half when defending and hold shape when attacking, without any explicit state machine.",
    "howItWorks": "microFocus point itself = lerp between an offensive point (focalPoint shifted 1.0m forward, y*0.9) and a defensive point (focalPoint shifted 2.0m back toward own goal, clamped to backXBound, y*0.9), on possessionBias. microFocusStrength = (0.7*possBias + 0.8*(1-possBias)) then * (0.2 + 0.8*autoMicroFocusStrength) where microFocusSideBias = NormalizedClamp((ballX/pitchHalfW)*-side, -0.7, 0.7)*0.7 + 0.3 and autoMicroFocusStrength = microFocusSideBias^0.8 * possBias + (1-microFocusSideBias)^0.6 * (1-possBias). midfieldFocus = manual*0.7 + autoMidfieldFocus*0.3 where auto = NormalizedClamp((ballX/pitchHalfW)*-side, -0.8, 0.8); midfieldFocusStrength = 0.35 for both phases by default. yFocus = ballY with yFocusStrength = 0.5*possBias + 0.2*(1-possBias).",
    "where": "teamAIcontroller.cpp:370-403",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Per-role tactic offsets (mixup)",
    "whatItDoes": "Small hardcoded role deviations from the team tactic values, applied before any blending \u2014 the cheapest way to give roles distinct shape behaviour.",
    "howItWorks": "Additive offsets clamped to [0,1]: CB offense_width +0.2; LB/RB defense_ownhalf -0.075, offense_width +0.2, offense_ownhalf -0.1; LM/RM defense_ownhalf -0.05, offense_ownhalf -0.1 ('wingers stay high up to offer counter-attack support'); AM defense_depth +0.125; CF defense_depth +0.125. Additionally offense_sideFocusStrength += (mindSet - 0.5)*0.2 and defense_sideFocusStrength += (0.5 - mindSet)*0.2, then both shifted by \u00b10.3 on offensivenessBias.",
    "where": "teamAIcontroller.cpp:230-275, 307-310",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "offensivenessBias \u2014 scoreline, clock and recent possession feed team shape",
    "whatItDoes": "Slowly moves the whole team's shape based on match state, which then shifts the defensive line, possessionBias and side focus.",
    "howItWorks": "Recomputed every 1000ms. goalFactor = clamp(0.5 + (oppGoals - goals)*0.25, 0, 1); timeFactor = 0.5 + 0.5*clamp(matchTime_ms/6300000, 0, 1); offenseBias = clamp(0.5 + (goalFactor - 0.5)*timeFactor, 0, 1); recentPossessionBias = 1 - |possessionFactor_60seconds - teamID|; offensivenessBias = offenseBias*0.5 + recentPossessionBias*0.5. User tactic sliders are folded in as (value - 0.5)*2*multiplier offsets with per-key multipliers of 0.1 (depth/width), 0.3 (midfieldfocus), 0.1 (sidefocus), 0.15 (microfocus).",
    "where": "teamAIcontroller.cpp:946-1001, cadence teamAIcontroller.cpp:87",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Mental image \u2014 reaction-time-delayed world snapshot",
    "whatItDoes": "Every strategy reads the world through a per-player delayed, deviation-bounded snapshot rather than ground truth. This is the source of realistic reaction lag and of players being briefly wrong.",
    "howItWorks": "match->GetMentalImage(reactionTime_ms); the last-touch player gets reactionTime 0 (he knows what he just did), and AI teams get + (1 - matchDifficulty)*100 ms extra. Player images are extrapolated forward by movement*timeStampNeg_ms*0.001 and then clamped: EnforceMaximumDeviation vs reality at maxDistanceDeviation 2.5m and maxMovementDeviation = walkVelocity (5.0). Ball predictions are stored on a 10ms grid up to ballPredictionSize_ms 3000, indexed at (time_ms + timeStampNeg_ms)/10, and also deviation-clamped to 2.5m against the true prediction.",
    "where": "mentalimage.cpp:9-106; reaction time playercontroller.cpp:23-45",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Possession-player election hysteresis (two levels)",
    "whatItDoes": "Stops the 'who is going for the ball' designation flickering, which would otherwise thrash every off-ball target on the pitch since desiredPosition keys off the designated possession player.",
    "howItWorks": "Team level: timeRating = (bestPlayerTimeToBall + 500)/(designatedTimeToBall + 500); *0.5 if the challenger already has possession, /0.5 if the incumbent does; switch only if timeRating < 0.8. Also, if the incumbent can reach the ball more than 100ms before the nearest opponent, timeRating += 0.2 then *= 1.2 (extra stickiness). Match level: timeRating = (candidateTime + 10)/(designatedTime + 10), switch only if < 0.85. Underlying per-player possessionAmount = (oppTeamTimeToBall + 200)/(myTimeToBall + 200).",
    "where": "team.cpp:408-432, match.cpp:909-925, playercontroller.cpp:589",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Update cadences and stagger",
    "whatItDoes": "The expensive team-level solves are not run every tick, and the two teams are deliberately offset so they never solve on the same frame.",
    "howItWorks": "Base tick is 10ms. UpdateTactics every 1000ms; attacking-run evaluation every 500ms; forwardSupportPlayer every 1500ms; CalculateDynamicRoles at (t + 200*teamID) % 400 == 0; CalculateManMarking at (t + 200*teamID + 100) % 400 == 0. Timers: attacking run window 4000ms, team pressure window 500ms, keeper rush window 300ms. At a 250ms timestep these map to: dynamic roles and man marking roughly every 2 ticks, run window 16 ticks, tactics 4 ticks.",
    "where": "teamAIcontroller.cpp:87, 189, 224; team.cpp:341-349; timers teamAIcontroller.cpp:907-932",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Team pressure (trigger disabled, mechanism intact)",
    "whatItDoes": "Sends one extra player to press the carrier and temporarily overrides his man-marking assignment.",
    "howItWorks": "ApplyTeamPressure sets endApplyTeamPressure_ms = now + 500, picks teamPressurePlayer = AI_GetClosestPlayer(team, oppPos + oppMovement*0.24 + (side*1.0, 0, 0), onlyAIControlled=true, except goalie) and overwrites his ManMarkingID with the opponent's ID. The elected player then gets forceMagnet in the controller. The trigger block that would call it is commented out ('DISABLED, interferes with other defense AI code for now'); the intended conditions were opponentFreeRun (nearest teammate to a midpoint between opp and goal is more than 3.2m worse off than the opponent) or closeEnemy (opponent within 20m of a danger point).",
    "where": "teamAIcontroller.cpp:913-928 (mechanism), 160-184 (disabled trigger), consumption elizacontroller.cpp:294-300",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Set-piece formation placement via the same box primitive",
    "whatItDoes": "Every dead-ball arrangement is the same AI_GetAdaptedFormationPosition call with hand-tuned bounds and focus points, rather than bespoke code per set piece.",
    "howItWorks": "Per set piece the bounds and focuses differ. Corner attacking: back = -side*pitchHalfW*0.2, front = -side*pitchHalfW*0.96, xFocus = front*0.85 strength 0.7, yFocus = ballY*0.1 strength 0.7, microFocus at (ballX*0.95, ballY*0.1) strength 0.9, midfieldFocus 0.9 strength 0.5; defending corner: back = side*pitchHalfW*0.98, front = side*pitchHalfW*0.5, xFocus strength 0.8, yFocus strength 0.9, midfieldFocus 0.1 strength 0.7. Free kick: an xOffset term derived from ball position scales all four. Wall: the 3 closest players are placed at exactly 9.15m from the ball along the ball\u2192goal vector with a 0.07 lateral fan, only if the ball is within 40m of goal. Non-taking side keeps 9.15m; penalties additionally push everyone outside the 16.5m line and the 9.15m arc. Set pieces also force fadingTeamPossession to 1.5 (taker) / 0.5 (defender).",
    "where": "teamAIcontroller.cpp:653-905",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Controller quantization and human-input blending (do NOT port)",
    "whatItDoes": "Emulates a PS2 pad: quantized stick directions, ranged velocities, and an autoBias that blends AI intent with a human's stick. Exists purely because a human shares the pitch with the AI.",
    "howItWorks": "inputVelocityFloat = RangeVelocity(...) 'emulate controller quantization' before the movement command; quantizeDirection = true globally with QuantizeDirection(dir, bias); _MovementCommand computes autoBias to mix manual and auto movement, with branches explicitly gated on team->IsHumanControlled(...) and GetLastSwitchBias(). The man-marking/hunt blend inside it (manMarkingBias = (1 - curve(NormalizedClamp(playerOppDistance, 0, 7), 0.7))^1.2, mixing 'mimic the opponent's movement vector' against 'run to huntTarget = oppPos + oppToGoalDir*dist*0.3') is itself portable, but only ever executes for the designated possession player and is wrapped in human-input plumbing.",
    "where": "elizacontroller.cpp:391; playercontroller.cpp:404-578 (esp. 507-556); gamedefines.hpp:29",
    "portable": "partly",
    "priority": "low"
   },
   {
    "name": "Animation-serving goalie and body-direction code (do NOT port)",
    "whatItDoes": "Velocity and target choices made only so the animation system can pick a better clip.",
    "howItWorks": "goalie_default.cpp:174-178 drops maxVelocity to walkVelocity when moving back toward goal 'to allow for proper body direction' (gated on being closer to goal than the target, within 1.0m of the ball\u2192goal line, u > 0). Line 59-60 keeps a commented-out walk-velocity choice for the same reason. The backline is drawn at pitchHalfW - 0.7 rather than on the line because 'some anims may only touch the ball when it's already behind the line'. Also non-portable in these files: celebrations (elizacontroller.cpp:1062-1130), look-at-referee (75-92), all desiredLookAt computation, and the debug overlay draws in default_off.cpp:28-34 and 54-60.",
    "where": "goalie_default.cpp:59-60, 73, 174-178; elizacontroller.cpp:65-118, 1062-1130; default_off.cpp:28-34, 54-60",
    "portable": "no",
    "priority": "low"
   },
   {
    "name": "Source bug worth not reproducing: opponent query point in the force field",
    "whatItDoes": "The 'stay away from opponents' spot selects the 3 opponents nearest to a malformed query point.",
    "howItWorks": "AI_GetClosestPlayers(oppTeam, mainManPos * 0.3f + currentPos + 0.7f, false, opponents, 3) \u2014 `currentPos + 0.7f` adds the scalar 0.7 to every component of the vector. Given the adjacent `mainManPos * 0.3f`, the intent was plainly `currentPos * 0.7f`, i.e. a 30/70 blend of carrier and self. As written the query point is the carrier at 30% plus the player at 100% plus a (0.7, 0.7, 0.7) offset, which lands far off the pitch for most positions and therefore selects a near-arbitrary set of three opponents to avoid.",
    "where": "elizacontroller.cpp:698",
    "portable": "no",
    "priority": "medium"
   }
  ]
 },
 {
  "subsystem": "Player-level AI controller (ElizaController / PlayerController / IController) in GameplayFootball \u2014 the per-player decision loop, on-the-ball action selection, pass/shot rating, off-the-ball positioning, and ball-magnet arbitration. Sim runs at 100 Hz (10 ms tick, match.cpp:963-964); every constant below is from the real source.",
  "mechanisms": [
   {
    "name": "Single-owner arbitration: designatedPossessionPlayer",
    "whatItDoes": "Exactly one player on the whole pitch runs on-the-ball decision code each tick; every other player runs off-the-ball positioning. This is what prevents 22 agents all trying to play the ball.",
    "howItWorks": "Three-level hierarchy. (1) Per player: timeNeededToGetToBall_ms = smallest t where the player can physically reach the ball's predicted position at t (player.cpp:150-240, walks the 3 s ball prediction with an adaptive timestep = clamp((ballDist+0.2)/50 m/s, 10, 500) ms, then a 10 ms refinement pass). (2) Per team: designatedTeamPossessionPlayer = closest-by-time player, but switched only with hysteresis \u2014 timeRating = (bestTime+500)/(currentTime+500), \u00d70.5 if the challenger already has possession, \u00f70.5 if the incumbent does, and +0.2 then \u00d71.2 if the incumbent beats the closest opponent by >100 ms; switch only if timeRating < 0.8 (team.cpp:405-425). (3) Match: designatedPossessionPlayer = the better team's designated player, switched only if (candidateTime+10)/(currentTime+10) < 0.85 (match.cpp:911-925). Ball retainer (keeper holding ball) overrides all.",
    "where": "onthepitch/player/controller/elizacontroller.cpp:244, 264; onthepitch/player/player.cpp:150-240; onthepitch/team.cpp:405-425; onthepitch/match.cpp:911-925",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "possessionAmount \u2014 the scalar every decision keys off",
    "whatItDoes": "A single continuous number expressing 'how much better than the opposition am I / are we placed to reach the ball', used as the gate for aggression, laziness, panic, ball magnets, tackling, and support positioning.",
    "howItWorks": "Per player: possessionAmount = (oppTeamTimeToBall_ms + 200) / (myTimeToBall_ms + 200) (playercontroller.cpp:589). >1 means I get there first. hasBestPossession = hasPossession && possessionAmount >= 1.0 (line 601). Per team: teamPossessionAmount = (oppTeamTime + 1500)/(myTime + 1500) (team.cpp:324) \u2014 the larger +1500 constant makes the team number far less twitchy than the player one. fadingTeamPossessionAmount low-passes it: target = fading*0.995 + clamp(teamPossession, 0.5, 1.5)*0.005, then the change is hard-clamped to \u00b10.005 per 10 ms tick (= \u00b10.5/sec) (team.cpp:325-326). Out of play / set piece / ball retainer force it to a flat 1.5 or 0.5. One override: if a player has the best chance of possession, the fading value is re-blended toward the instantaneous one by distanceBias = NormalizedClamp(ballDist_at_300ms, 2, 14)^2, so a player near the ball reacts instantly instead of on the slow filter (playercontroller.cpp:594-597).",
    "where": "onthepitch/player/controller/playercontroller.cpp:580-602; onthepitch/team.cpp:324-332",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Reaction time via delayed mental image",
    "whatItDoes": "Players decide on a stale snapshot of the world rather than ground truth, which produces late reactions, being wrong-footed, and misjudged interceptions without any explicit error injection.",
    "howItWorks": "reactionTime_ms = round(80 - stat('physical_reaction')*40) (icontroller.cpp:14-16), plus (1 - matchDifficulty)*100 for teams with no human players (playercontroller.cpp:41-45; default difficulty 0.6 \u2192 +40 ms). Set to 0 if this player made the last non-accidental touch (playercontroller.cpp:25) \u2014 'you know what you just did'. The controller then fetches match->GetMentalImage(reactionTime_ms), a ring of past snapshots. Reading a stale image linearly extrapolates each player by movement * age_sec, then clamps the result against reality: position within maxDistanceDeviation = 2.5 m and movement within maxMovementDeviation = walkVelocity (5 m/s) of the true value (mentalimage.cpp:11-12, 47-62). Ball predictions are indexed with the age added, so old images see an old prediction curve.",
    "where": "onthepitch/player/controller/icontroller.cpp:14-16; playercontroller.cpp:23-30, 41-45; onthepitch/AIsupport/mentalimage.cpp:11-12, 47-80",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Two-stage pass selection with tactical-improvement gating",
    "whatItDoes": "The core on-the-ball decision: score my own situation, score every teammate's, and only consider passing to someone who is meaningfully better placed \u2014 then trade that gain off against the odds of the pass surviving.",
    "howItWorks": "Stage 1 (cheap, tactical): rating = (forwardSpaceRating*0.4 + spaceRating*0.3 + forwardRating*forwardWeight) / totalWeight1, where forwardWeight = 2.0 + mindSet*6.0 and totalWeight1 = 0.4+0.3+forwardWeight. GK receivers are multiplied by 0.7 ('don't like playing back to goalie'). A mate is only considered if mateRating > myRating + tacticalImprovementThreshold, threshold = 0.06*(1 - mindSet). Stage 2 (expensive, only for survivors): compute passing odds for ShortPass, LongPass and HighPass and take the best type; total = (tacticalDiff*tacticalDiffWeight + passRating*1.0 - oneTouchIsHard)/totalWeight2, tacticalDiffWeight = 1.0 + mindSet^2*10, totalWeight2 = tacticalDiffWeight + 1. Accept the best mate only if total > passThreshold and passRating > passMinimum, where passThreshold = 0.1 - longPossessionFactor*0.05 and passMinimum = 0.2*(1 - mindSet) - longPossessionFactor*0.1, longPossessionFactor = NormalizedClamp(possessionDuration_ms, 0, 5000)^2. Net effect worth copying: a CF (mindSet 1.0) has tacticalDiffWeight 11 and passMinimum 0, so strikers pass for gain almost regardless of risk; a CB (mindSet 0) has tacticalDiffWeight 1 and passMinimum 0.2, so defenders weight safety equally and refuse risky balls. Holding the ball 5 s relaxes both thresholds, forcing a decision.",
    "where": "onthepitch/player/controller/elizacontroller.cpp:808-905",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "_GetPassingOdds \u2014 pass-lane interception model",
    "whatItDoes": "Scores 0..1 how likely a pass along a straight line is to survive, by racing every opponent to the point on the line they are closest to. Also reused verbatim to score shots.",
    "howItWorks": "origin = myPos + myMovement*0.12. Target for a player is targetPlayer.pos + movement*clamp(0.7 + dist*0.03, 0, 0.5) (lead the runner); LongPass adds a forward offset of dist*0.2 toward the opponent goal. For each opponent (image position + movement*0.2): find u = closest point along the line; skip unless u \u2208 [0, 1.2]. oppToIntersect_sec = (perpendicular distance + 1.0) / sprintVelocity(8). ballToIntersect_sec = 0.7 + |intersect - origin| * u * 0.03 + penaltyTime, divided by ballVelocityMultiplier. danger += clamp(ballToIntersect - oppToIntersect + 0.5, 0, 1.0) \u2014 the +0.5 encodes 'a dead heat is still dangerous'. HighPass rules: returns 0 outright if the target is closer than 10 m; only opponents at u<0.2 or u>0.65 count (nobody intercepts a ball that is in the air over them); penaltyTime = 2.5 s if u>0.5 (trapping a high ball is slow); a flat danger += 0.4 so a low pass always wins ties. Finally danger = NormalizedClamp(danger, 0, 1) \u2014 'one really dangerous guy is basically 100% danger' \u2014 and odds = 1 - danger. Quirk to be aware of when porting: |intersect - origin| is already dist*u, so multiplying by u again makes ball travel time grow with u\u00b2, i.e. long passes are penalised superlinearly. Probably unintentional but it is what the tuned behaviour rests on.",
    "where": "onthepitch/player/controller/elizacontroller.cpp:1008-1060",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Shot decision: three aim points, odds gate, stat-driven spread",
    "whatItDoes": "Decides whether to shoot and where, reusing the pass-lane model against the goal instead of a teammate.",
    "howItWorks": "Gate: idealShotPosFactor = curve(1 - NormalizedClamp(distance to the point 7 m in front of the goal centre, 0, 16), 1.0); skip entirely unless > 0.1. Then compute _GetPassingOdds against three targets at x = \u00b1(pitchHalfW+1) and y = -3.6, 0, +3.6, with ballVelocityMultiplier = 3.0 (a shot travels ~3\u00d7 a pass, so opponents have less time). Take the best, odds = sqrt(best). Fire if odds + random(0, 0.5) > 0.5 \u2014 so odds \u2265 0.5 always shoots, odds = 0 never does, and the band in between is stochastic. Aim: y + random(-1 + technical_shot, 1 - technical_shot), so a shot stat of 1.0 gives no spread and 0.0 gives \u00b11 m. Direction is then blended 0.7 * toGoal + 0.3 * (-facing * (currentVelocity/sprintVelocity)), i.e. sprinting drags the shot behind you. Power = random(0.7, 1.0) * (0.6 + goalDist*0.4) where goalDist = NormalizedClamp(distance to goal, 0, 32).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:928-955",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Ranked intent queue instead of a single decision",
    "whatItDoes": "The controller does not output one action; it pushes an ordered list of candidate commands and the consumer takes the first feasible one. Gives free graceful degradation when the preferred action is impossible.",
    "howItWorks": "GetOnTheBallCommands pushes, in strict order: panic-clearance commands (HighPass 0.7, Shot 0.6, LongPass 0.8) if panicking, then the chosen constructive pass, then the shot (elizacontroller.cpp:907-955). RequestCommand then appends ball-control, trap, interfere, sliding, and finally movement as the always-valid fallback (elizacontroller.cpp:307-393). The humanoid iterates the queue and takes the first command it can satisfy (humanoid.cpp:216-235). Portable as a pattern \u2014 'emit ranked intents, let the resolver pick the first legal one' \u2014 but in GF feasibility is decided by whether a matching animation exists, so in a headless sim you supply your own feasibility test (in range, has possession, not tackled).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:307-393, 907-955; onthepitch/player/humanoid/humanoid.cpp:216-235",
    "portable": "partly",
    "priority": "high"
   },
   {
    "name": "Ball magnet: autoBias arbitration in _MovementCommand",
    "whatItDoes": "Blends the player's tactically-desired movement with an automatic go-get-the-ball movement, weighted by a single 0..1 'ball desire'. This is the literal ball-magnet system.",
    "howItWorks": "autoBias starts at 0. It goes to 1.0 (full magnet) if any of: forceMagnet is set; I am the match designated possession player; OR I am my team's designated player AND (lastTouchBias(2000) > 0.01 AND possessionAmount > 0.5) OR (!oppTeamHasPossession AND possessionAmount > 0.5) OR possessionAmount > 0.99 (for air balls where several players are equally likely) OR hasBestPossession (playercontroller.cpp:449-454). With hasBestPossession the auto movement comes from AI_GetBallControlMovement, otherwise from AI_GetToBallMovement with haste=1. If I am NOT the match designated player, autoBias is instead computed as pow(lastTouchBias(2000), 0.4) * pow(sameDirFactor, 0.5), and only when timeToBall < 1700 ms \u2014 i.e. you keep chasing a ball you just touched, and only if you were already running roughly that way. lastTouchBias(decay) = 1 - clamp((now - lastTouchTime)/decay, 0, 1) (playerbase.cpp:141-146). Ball retainer sets autoBias = 0. Final: resultingMovement = manualDir*manualVel*(1-autoBias) + autoDir*autoVel*autoBias, velocity clamped to [0, 8].",
    "where": "onthepitch/player/controller/playercontroller.cpp:404-578, especially 438-505 and 563-574",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Force-field support positioning (GetSupportPosition_ForceField)",
    "whatItDoes": "Off-the-ball movement for every non-possessing outfield player: a weighted sum of attractors and repellers that produces spacing, passing lanes, forward runs and offside discipline in one pass.",
    "howItWorks": "Spots and weights (elizacontroller.cpp:615-778): base formation position, attract, constant decay, power 0.7 scaled by 0.3 + 0.7*NormalizedClamp(distance from it, 0, 20) \u2014 the farther out of shape you are the harder you're pulled back. Opponents (3 nearest to a blend of carrier and self), repel, power 0.3 \u00d7 a role multiplier (CB/LB/RB \u00d72.2, DM \u00d72.0, CM/LM/RM \u00d71.6, AM \u00d71.2, CF \u00d71.0), scale 5, exp 0.7, and critically the spot origin is offset 2 m BEHIND the opponent along the away-from-carrier axis, so you clear the passing lane rather than just avoiding bodies. Teammates (6 nearest), repel, power 0.4, scale 14*0.75 = 10.5, only when fadingTeamPossession \u2265 1.02. Ball, repel, power 1.0, scale 2.0, exp 0.5, placed at FOUR ball predictions (200/350/500/650 ms) so you stay out of the flight path, only when fadingTeamPossession \u2265 1.06. Carrier: attract at scale 21 AND repel at scale 12, both power 0.45 \u2014 the pair creates a preferred ring roughly 12-21 m from the ball carrier. Optional makeRun spot: attract to the opponent goal line at power 2.0, and while running the opponent repel shrinks to scale 2 and half power. A lane term shifts the base position forward by -side * mindSet^1.5 * 22 * curve(1 - NormalizedClamp(|laneY - myY|, 0, 30), 1.0), laneY = -sign(carrierY)*8 \u2014 attackers push up the pitch on the opposite side to the ball. Resolver (AIfunctions.cpp:458-497): intensity = 1 for constant decay else clamp(1 - dist/scale, 0, 1)^exp; attractors are damped by dist/7 within 7 m to stop overshoot; result = (\u03a3 dir*force / \u03a3 force) * sprintVelocity, i.e. a normalised weighted mean, never a runaway sum. Finally the position is clamped behind the offside line (margin 0.08) and inside the pitch.",
    "where": "onthepitch/player/controller/elizacontroller.cpp:597-789; onthepitch/AIsupport/AIfunctions.cpp:458-497",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Laziness / stamina throttle (GetLazyVelocity)",
    "whatItDoes": "Stops all 22 players sprinting for 90 minutes. Modulates desired speed by role, team possession, distance from the action, and short-term breath.",
    "howItWorks": "startLazinessDistance = 20 * (fatigueInv*0.8 + 0.2); endLazinessDistance = 65 * (fatigueInv*0.5 + 0.5). actionDistance = distance to the opponent team's designated possession player. teamPossession = clamp(fadingTeamPossessionAmount - 0.5, 0, 1). lazinessByRole = mindSet + teamPossession*(1 - mindSet*2) \u2014 attackers idle when their team lacks the ball, defenders idle when their team has it, midfielders are half-lazy either way. lazinessByPosition = NormalizedClamp(actionDistance, start, end). lazyFactor = lazinessByPosition * (0.5 + lazinessByRole*0.5). velocity *= (1 - lazyFactor), floored at dribbleVelocity(3.5) if the request was \u2265 3.5. Then a separate breath term: breathLeft = (1 - NormalizedClamp(averageVelocity over last 10 s, 0, 8))^(0.8 - workrate*0.2), \u00d71.2 clamped to 1 so the first seconds of a sprint are full speed, then lerped back toward 1.0 by lazyFactor ('sometimes we really need to force it'), and velocity = min(velocity, 8 * breathLeft). Fatigue itself: fatigueFactorInv -= distanceMoved * 0.00003 * (2 - staminaStat) / matchDurationFactor, clamped to [0.01, 1] (player.cpp:315-317).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:437-474; onthepitch/player/player.cpp:315-317",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Free-space ratings (tactical situation)",
    "whatItDoes": "The 0..1 inputs to every pass decision: how much space a player has now, how much space is ahead of him, and how advanced he is.",
    "howItWorks": "Recomputed every 100 ms, staggered per player by ((actualTime_ms + playerID*10) % 100 == 0) so the cost is spread across ticks (player.cpp:302-304). forwardSpaceRating = AI_CalculateFreeSpace at checkPos = myPos + forward*8*0.5 (4 m ahead), horizon 0.5 s. spaceRating = same at myPos + movement*0.1, horizon 0.1 s. forwardRating = (1 - clamp(distanceToOppGoal / 110, 0, 1))^1.5 \u2014 exponent makes it bite near goal. AI_CalculateFreeSpace itself (AIfunctions.cpp:288-317): move each opponent by movement*0.2, then advance them toward the check position at sprintVelocity * clamp(horizon - 0.2, 0, \u221e) \u2014 i.e. assume they close you down; situation += 1 - clamp(dist, 0, 5)/5 per opponent; return 1 - NormalizedClamp(sum, 0, 2.5). Keepers excluded.",
    "where": "onthepitch/player/player.cpp:302-304, 545-564; onthepitch/AIsupport/AIfunctions.cpp:288-317",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "AddDefensiveComponent \u2014 goal-side interception geometry",
    "whatItDoes": "Turns 'mark this opponent' into a concrete target position that is always goal-side and always closer to the shot than the man being marked.",
    "howItWorks": "Constants: possessionPlayerShootThreshold 24 m (the ball carrier must be marked from far out), genericOpponentShootThreshold 8 m, minDistance 0.4, bufferDistance 4.0. oppPos = image.position + movement*0.5. shootingPoint = oppPos + toOwnGoal.normalized * clamp(oppToGoalDist - shootThreshold, 0.4, pitchHalfW). If the shooting point sits beyond the team's offside trap line, it is re-derived as the intersection of the opp-to-goal line with the offside line. Then: slack = myDistToShootingPoint - (oppDistToShootingPoint - 4); if slack > 0, step toward the shooting point by clamp(slack, 0, myDist). Separately, using the actual (not desired) position, if actualSlack = actualDist - oppDist > 0 \u2014 i.e. you are genuinely beaten \u2014 add (goal - defendPos).normalized * actualSlack * 0.7, dropping toward your own goal instead of chasing. Blended into the desired position by a bias. Per-role bias from the strategies: pow(clamp(K - mindSet - fadingTeamPossession, 0, 1), 0.7) with K = 1.9 (defenders), 1.5 (midfield), 1.3 (attackers).",
    "where": "onthepitch/player/controller/playercontroller.cpp:53-122; strategies/offtheball/default_def.cpp:36, default_mid.cpp:44, default_off.cpp:52",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Hunting: who presses the ball carrier",
    "whatItDoes": "Decides which non-possessing players leave their shape to close down the opponent in possession, and how far they will travel to do it.",
    "howItWorks": "huntDistanceThreshold = 10 + (1 - mindSet)*10 (so a CB will travel 20 m, a CF 10 m), then \u00d7 (0.5*fatigueFactorInv + 0.5*(1 - NormalizedClamp(averageVelocity(10 s), 0, 8))) \u2014 tired or already-sprinting players press less \u2014 then \u00d7 (0.3 + matchDifficulty*0.7), the difficulty knob. Triggered only when !teamHasBestPossession, the player has no explicit man-marking assignment, and the carrier (position + movement*0.12) is inside the threshold. Two extra rules: if I am my team's designated possession player and possessionAmount > 0.8, set forceMagnet and extraHaste \u2014 'don't give up battles too easily'. Otherwise only the 2 closest teammates to the carrier are allowed to hunt (huntingPlayersNum = 2), which is the anti-swarm rule. The hunt target is GetDefendPosition(opp) (a perpendicular-bisector intercept on the opp-to-goal line, playercontroller.cpp:124-167), and movement is only issued if NeedDefendingMovement passes: |\u0394y| > max((target.x - my.x)*-side, 0) - 0.5, i.e. only move if you are not already goal-side and roughly in line (humanoid_utils.cpp:105-115).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:326-390; playercontroller.cpp:124-167; onthepitch/player/humanoid/humanoid_utils.cpp:105-115",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Panic clearance",
    "whatItDoes": "Deep defenders and keepers hoof the ball clear rather than pick a pass when they are under real pressure near their own goal.",
    "howItWorks": "Only fires when mindSet < 0.25, which given the mindSet table means GK and CB only (LB/RB/DM sit exactly at 0.25 and are excluded). panicProneness = 1 - mindSet*2 (= 1.0 for both). goalCloseness = 1 - NormalizedClamp(distance to own goal, 2, 16). Outfield: panic if (no pass target was found OR bestPassRating < panicProneness*goalCloseness) AND possessionAmount < 0.9 + panicProneness*goalCloseness*0.8. Keeper: panic whenever possessionAmount < 3.0, i.e. nearly always. The clearance direction is a blend of facing (x scaled 0.8) with (away from own goal 0.7, outward in y 0.5) plus a 0.3 vertical lift, and three commands are queued at descending desperation: HighPass power 0.7, Shot power 0.6, LongPass power 0.8, all with autoDirectionBias and autoPowerBias 0 (no aim assist \u2014 it is a hoof, not a pass).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:907-922, 977-1006; onthepitch/AIsupport/AIfunctions.cpp:1228-1249",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Pass power and lead-target formula",
    "whatItDoes": "Converts a chosen target position into a kick power, and leads moving receivers.",
    "howItWorks": "AI_GetAutoPass (AIfunctions.cpp:1063-1074): power = NormalizedClamp(|targetVector|, 0, 60)^1.4 * 1.8 for ground passes; for HighPass, power = same^1.4 * 1.15 with a launch height offset of 0.45 - NormalizedClamp(dist, 0, 60)*0.15. So power saturates at 60 m and the 1.4 exponent means short passes are disproportionately soft. Lead: passDuration = pow(clamp(0.3 + dist*0.05, 0, 1), 0.7) * 0.7 seconds, and the aim point is receiver.position + receiver.movement * passDuration (AIfunctions.cpp:1124-1129) \u2014 max lead is 0.7 s of the receiver's velocity. LongPass additionally offsets the target by -side * dist * 0.2 toward the opponent goal, i.e. it is played into space ahead of the receiver, not to his feet (AIfunctions.cpp:1193-1197 and elizacontroller.cpp:1015).",
    "where": "onthepitch/AIsupport/AIfunctions.cpp:1063-1074, 1118-1204; onthepitch/player/controller/elizacontroller.cpp:1014-1015, 962-975",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Duel-likeliness gates on contest actions",
    "whatItDoes": "One cheap geometric test decides whether a player is allowed to attempt ball control, a trap, an interference, or a slide \u2014 replacing four separate heuristics.",
    "howItWorks": "OppBetweenBallAndMeDot = dot(normalize(oppPos - myPos), normalize(ballPos_at_100ms - oppPos)) using positions extrapolated by movement*0.1. Near 1 means the opponent is between me and the ball. CouldWinABallDuelLikeliness = 1 - (dot*0.5 + 0.5), so 0 = hopeless, 1 = clear path. Thresholds actually used: ball control \u2265 0.25 (playercontroller.cpp:276), trap \u2265 0.5 with the extra conditions optimisticTimeToBall < 1000 ms and oppTimeToBall > 400 ms and !oppTeamHasPossession (line 323), interfere \u2265 0.2 (line 360), sliding \u2265 0.7 (line 380). Sliding additionally requires possessionAmount < 0.6, oppTeamHasPossession, and ball distance in (0.7, 1.6) m with oppTimeToBall > 260 ms \u2014 or (0.6, 1.8) m if the opponent is mid-shot with a touch pending, which is the block-the-shot case.",
    "where": "onthepitch/player/controller/playercontroller.cpp:193-220, 265-402",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Two-phase candidate sampling (GetSupportPosition)",
    "whatItDoes": "An alternative positional search to the force field: sample discrete destinations around the player, rate them, and take the best. Included mainly for the optimisation pattern.",
    "howItWorks": "37 candidates: current position plus 12 compass directions \u00d7 3 radii (dribbleVelocity 3.5, walkVelocity 5, sprintVelocity 8). Phase 1 computes only the cheap terms \u2014 offenseRating (progress toward goal, measured against a goal point offset to y*0.8 because the goal is wide, with 5 m subtracted so you don't crowd it), distanceRating (prefer ~10 m from the ball; being closer than 10 m is penalised by mirroring the error), movementRating (prefer continuing current momentum), formationRating (prefer moving toward the formation slot), offsideRating (binary 0/1). Weights: offense 0.8 + mindSet*clamp((fadingTeamPossession-0.5)*2, 0, 1), distance 1.0, movement 1.5, formation 1.6 + clamp(ballDistance/30, 0, 1), offside 10.0 \u2014 the offside weight is deliberately an order of magnitude above everything else, functioning as a hard veto rather than a preference. The current position gets a +0.1 stickiness bonus to prevent dithering. Phase 2 sorts and evaluates the expensive passing-lane term (passWeight 0.8) on only the top third: passRating = min over the 4 nearest opponents of clamp(dist to a point 2 m along the candidate\u2192ball line / 8, 0, 1)^1.2.",
    "where": "onthepitch/player/controller/elizacontroller.cpp:476-595; struct at elizacontroller.hpp:18-31",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Tiered decision cadence with per-team stagger",
    "whatItDoes": "Level-of-detail on thinking: players closer to the action re-decide more often, and the two teams are phase-offset so they never re-plan on the same tick.",
    "howItWorks": "At 100 Hz, re-evaluation is allowed only when a modulo predicate hits (humanoid.cpp:148-168): match designated possession player within 3 m of the ball \u2192 (time_ms + teamID*10) % 20 == 0 (every 20 ms); match designated player otherwise \u2192 % 30; team designated player \u2192 (time_ms + teamID*20) % 40; anyone within 5 m of the ball \u2192 % 50; within 10 m \u2192 (time_ms + teamID*40) % 80; beyond that, no voluntary re-decision at all \u2014 those players only re-decide when their current action ends. The teamID term is the stagger. Separately, tactical situation ratings refresh on (time_ms + playerID*10) % 100 (player.cpp:302). Portable as the LOD-plus-stagger concept and the 'far players think rarely' budget; the exact frame gating also exists to serve animation requeue rules, and at a 250 ms tick you would simply run everyone every tick and keep only the stagger idea for tie-breaking.",
    "where": "onthepitch/player/humanoid/humanoid.cpp:148-168; onthepitch/player/player.cpp:302-304",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Strategy dispatch and the priority chain in RequestCommand",
    "whatItDoes": "How the controller picks which behaviour to run at all \u2014 a flat if/else-if chain evaluated top to bottom every decision, not a state machine.",
    "howItWorks": "Order (elizacontroller.cpp:38-408): 1) goal scored and out of play \u2192 celebration; 2) out of play with a referee foul buffer active \u2192 stand and look at the referee; 3) out of play \u2192 drift toward the centre spot, velocity decaying by *0.95 - random(0, 3.2) per tick; 4) set-piece taker or ball retainer \u2192 set-piece playbook; 5) in play, not the possessor, not GK \u2192 one of three off-the-ball strategies picked purely by static formation role (LB/CB/RB \u2192 defense, DM/LM/CM/RM/AM \u2192 midfield, CF \u2192 offense); 6) in play, IS the match possessor, AI team, not GK, and timeToBall < 1000 ms \u2192 GetOnTheBallCommands; 7) GK \u2192 goalie strategy plus deflect. Note the three field strategies are near-identical code differing only in three constants (attackBias clamp range 0.2-0.9 / 0.1-0.7 / 0.1-0.6, defensive bias K 1.9 / 1.5 / 1.3, staticPositionBias multiplier 1.0 / 0.9 / 0.8), so in a port they collapse to one function parameterised by role. Also note the split: strategy selection uses GetFormationEntry().role (static), while mindSet everywhere else uses GetDynamicFormationEntry().role (current, possibly swapped).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:38-408, 422-427; strategies/offtheball/default_def.cpp:14-51, default_mid.cpp:17-59, default_off.cpp:17-71",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Formation anchoring with proximity-based shape abandonment",
    "whatItDoes": "Blends a static formation slot with a dynamic (position-swapped) one so players hold shape far from the ball but abandon it near the action.",
    "howItWorks": "actionDistance = NormalizedClamp(distance to the match possession player, 15, 20) \u2014 note the narrow 15-20 m band, so this is effectively a soft switch. staticPositionBias = curve(K * actionDistance, 1.0) with K = 1.0 (defenders), 0.9 (midfield), 0.8 (attackers); lower K = swap slots more readily. desiredPosition = static*bias + dynamic*(1-bias). That result is then blended with the force-field support position by attackBias = NormalizedClamp(fadingTeamPossession - 0.5, lo, hi) per role, then has the defensive component added, then the offside trap applied (defenders and midfielders only \u2014 attackers skip it). Final conversion to motion: direction = normalize(desired - current), velocity = |desired - current| * distanceToVelocityMultiplier (2.6), passed through GetLazyVelocity, clamped to [0, 8].",
    "where": "onthepitch/player/controller/strategies/offtheball/default_def.cpp:20-50; default_mid.cpp:23-58; default_off.cpp:23-70",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Set-piece playbook: pick a target zone, then the nearest man to it",
    "whatItDoes": "Randomised but role-appropriate restart behaviour without any hard-coded receiver logic.",
    "howItWorks": "Each set piece rolls a die for delivery type and generates a target POSITION, then AI_GetClosestPlayer picks whoever is nearest to that position as the receiver (elizacontroller.cpp:204). GoalKick: 60% HighPass to x = \u00b111 with random y across the full pitch width, else ShortPass to x*0.9 random y. KickOff: ShortPass 1 m ahead. FreeKick: 50% HighPass to the opponent goal line \u00b110 y, else ShortPass 10 m forward \u00b110 y. Corner: 70% HighPass to x = \u00b155*(0.99 - random(0, 0.12)) with y \u00b110, else short to x = \u00b144, y = own y*0.8. ThrowIn: ShortPass to the closest player. Penalty: aim at (goal, random(-5, 5)), power random(0.4, 1.0). Keeper distribution has a release condition rather than a die: only throw if the nearest opponent to the chosen receiver is more than 10 m away, OR possessionDuration > 4000 ms (so he cannot hold forever).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:122-239",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "mindSet role table",
    "whatItDoes": "The single scalar that differentiates all eleven roles across passing, pressing, laziness, positioning and panic. Cheapest high-value thing to copy.",
    "howItWorks": "GK 0.0, CB 0.0, LB/RB 0.25, DM 0.25, LM/CM/RM 0.5, AM 0.75, CF 1.0. It is consumed as: pass forwardWeight 2+mindSet*6, tacticalDiffWeight 1+mindSet\u00b2*10, tacticalImprovementThreshold 0.06*(1-mindSet), passMinimum 0.2*(1-mindSet), hunt distance 10+(1-mindSet)*10, laziness-by-role mindSet + poss*(1-2*mindSet), defensive bias K - mindSet - possession, force-field forward push mindSet^1.5, panic gate mindSet < 0.25.",
    "where": "onthepitch/AIsupport/AIfunctions.cpp:1228-1249",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Dead branch: man-marking blend in _MovementCommand is zeroed for AI",
    "whatItDoes": "Worth knowing before porting \u2014 the defensive man-marking/hunting blend inside _MovementCommand computes a full result and then multiplies its weight by zero for AI players.",
    "howItWorks": "At playercontroller.cpp:530-533, autoBias = actionBias * 0.0f for AI ('not sure what would be a proper value here. needs more testing'), and actionBias * 0.0f + GetLastSwitchBias() * 0.3f for human-controlled players. So the manMarkingBias = pow(1 - curve(NormalizedClamp(playerOppDistance, 0, 7), 0.7), 1.2) blend between mimicking the opponent's movement and hunting a point at oppPos + oppToGoal*dist*0.3 never affects an AI player's output. AI pressing is actually produced by the separate hunt block in elizacontroller.cpp:344-387. Do not port this branch as written; either drop it or give it a real weight.",
    "where": "onthepitch/player/controller/playercontroller.cpp:507-558",
    "portable": "no",
    "priority": "low"
   },
   {
    "name": "Animation- and human-input-only machinery",
    "whatItDoes": "Parts of these files that exist purely to serve animation blending or a human gamepad, and should not be ported.",
    "howItWorks": "(a) desiredLookAt / body direction on every command, and the toFocusAngle * desiredVeloFactor^0.7 head-turn blend (playercontroller.cpp:406-425, 570-573) \u2014 body orientation for animation only. (b) QuantizeDirection and RangeVelocity, explicitly 'emulate controller quantization', snapping velocity to the four discrete values 0/3.5/5/8 (elizacontroller.cpp:391; animcollection.hpp:57-63). (c) GetLastSwitchBias, lastSwitchTime_ms, and every team->IsHumanControlled branch \u2014 ElizaController zeroes these at entry (elizacontroller.cpp:40-41), they exist for player-switching assistance (playercontroller.cpp:47-51, 490-497, 530-533). (d) reQueueDelayFrames = 22, e_InterruptAnim_*, SelectAnim, stickyRunDirection, strictMovement, knockOn, onlyDeflectAnimsThatPickupBall \u2014 animation requeue gating (humanoid.cpp:43, 216-311; playercontroller.cpp:291-297, 367-370). (e) _AddCelebration (elizacontroller.cpp:1062-1130). (f) AI_GetPass's fullAutoDirection/fullAutoPower keyboard cheat and the distanceFactor/proximityBonus aim-assist maths \u2014 dead for AI, which always passes forcedTargetPlayer with both biases at 1.0 (AIfunctions.cpp:1080-1086, 1170-1191).",
    "where": "onthepitch/player/controller/elizacontroller.cpp:40-41, 391, 1062-1130; playercontroller.cpp:47-51, 291-297, 406-425, 490-497; onthepitch/AIsupport/AIfunctions.cpp:1080-1086, 1170-1191",
    "portable": "no",
    "priority": "low"
   }
  ]
 },
 {
  "subsystem": "Team-level coordination in GameplayFootball (Team, TeamAIController, Match possession arbitration, AIsupport/AIfunctions formation math). Everything runs on a 10ms fixed tick; pitch is pitchHalfW=55, pitchHalfH=36 (gamedefines.hpp:271-272), sprintVelocity=8.0 m/s (gamedefines.hpp:21), 11 players (gamedefines.hpp:61). Note: helpers clamp(), NormalizedClamp(x,lo,hi) (= clamp((x-lo)/(hi-lo),0,1)), and curve(x,bias) (an S-curve/sine easing blended by `bias`; bias=1 is full curve, 0 is linear) live in the external blunted2 library, which is NOT vendored in this repo, so their exact bodies are not citable here.",
  "mechanisms": [
   {
    "name": "Formation representation (normalized position + role, softened toward a role archetype)",
    "whatItDoes": "A formation is 11 FormationEntry records; each is a role enum plus a position in normalized formation space where x in [-1,1] is own-goal\u2192opponent-goal and y in [-1,1] is across the pitch. Nothing in the formation is in metres \u2014 the rectangle mapping (see next) supplies the metres at runtime.",
    "howItWorks": "struct FormationEntry { e_PlayerRole role; Vector3 databasePosition; Vector3 position; } (gamedefines.hpp:249-253). Roles: GK, CB, LB, RB, DM, CM, LM, RM, AM, CF (gamedefines.hpp:233-244). The authored position is normalized toward a hardcoded per-role archetype: position = databasePosition*0.6 + GetDefaultRolePosition(role)*0.4 (teamdata.cpp:116-117). Archetypes (teamdata.cpp:15-57): GK(-1,0), CB(-1,0), LB(-0.8,0.8), RB(-0.8,-0.8), DM(-0.5,0), CM(0,0), LM(0,1), RM(0,-1), AM(0.5,0), CF(1,0). Then a personal-space relaxation runs: up to 10 iterations, any two non-GK entries closer than minDistanceFraction=0.5 in normalized space push apart along their difference by 0.5*minDistance*(1 - dist/minDistance) each, then clamp x,y to [-1,1] (teamdata.cpp:127-167).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/gamedefines.hpp:233-253; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/data/teamdata.cpp:15-57, 109-167; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/data/teamdata.hpp:45-46, 71",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Adaptive formation rectangle (scale + focus position)",
    "whatItDoes": "Every tick the whole team's shape is re-derived as an axis-aligned rectangle on the pitch: a centre (centerX, centerY) that chases the ball/possession, and half-extents (adaptedDepth, adaptedWidth) that expand in possession and contract when defending. Normalized formation positions are then mapped linearly into that rectangle. This is the single biggest lever in the system.",
    "howItWorks": "Base scale constants: depth=0.45, width=0.95 as fractions of pitchHalfW/pitchHalfH (teamAIcontroller.cpp:25-26).\nadaptedDepth = depth * (offense_depthFactor*pb + defense_depthFactor*(1-pb));\nadaptedWidth = width * (offense_widthFactor*pb + defense_widthFactor*(1-pb)) (lines 328-331), pb = possessionBias.\nWith base tactics (0.9/0.75 depth, 0.9/0.8 width) that is \u00b122.3 m deep in possession vs \u00b118.6 m defending, and \u00b130.8 m vs \u00b127.4 m wide.\noffsetX = pitchHalfW*side*((off_ownHalf*2-1)*pb + (def_ownHalf*2-1)*(1-pb)) \u2014 base 0.52/0.54 gives only +2.2 m / +4.4 m shift toward own goal (line 333-334).\nsideFocus = pb*2-1; sideX = 0.2*sideFocus*(-side)*pitchHalfW + 0.8*(-match.GetAveragePossessionSide(6000))*pitchHalfW (line 341-342).\ncenterX = clamp(ballX*(1-sideFocusStrength) + sideX*sideFocusStrength + offsetX, \u00b1pitchHalfW); centerY = clamp(ballY, \u00b1pitchHalfH) (345-348).\nThen the centre is pulled toward the middle so the rectangle fits: centerX *= (1-adaptedDepth)*0.95 + 0.05; centerY *= (1-adaptedWidth)*0.9 + 0.1 (351-354).\nbackXBound = centerX - adaptedDepth*pitchHalfW*(-side); frontXBound = centerX + adaptedDepth*pitchHalfW*(-side); lowYBound = centerY - adaptedWidth*pitchHalfH; highYBound = centerY + adaptedWidth*pitchHalfH (356-359). Finally backXBound is clipped to the offside-trap line if it is deeper (line 368).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:25-26, 277-368",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "possessionBias \u2014 the master 0..1 offense/defense scalar (with ball-position fallback)",
    "whatItDoes": "One number per player-query that decides whether the team behaves as attacking or defending. Every rectangle parameter, every focus strength, and the midfield stretch is a lerp between an 'offense' and a 'defense' constant using this number.",
    "howItWorks": "possessionAmountBias = NormalizedClamp(fadingTeamPossessionAmount - 0.5, 0.3, 0.7) \u2014 i.e. fading amount 0.8\u21920, 1.2\u21921.\nballBias = NormalizedClamp((ballX/pitchHalfW) * -side, -0.7, 0.7) (0 = own half, 1 = opponent half).\nballBiasBias = (1 - |possessionAmountBias*2 - 1|) * 0.6 \u2014 'biasception': when possession is ambiguous (near 0.5), trust the ball's position instead, but never more than 60%.\npossessionBias = possessionAmountBias*(1-ballBiasBias) + ballBias*ballBiasBias, then possessionBias = clamp(possessionBias + (offensivenessBias-0.5)*0.3, 0, 1).\nThe focal point is likewise blended: focalPoint = ballAvgPos(3000ms)*pb + (ballAvgPos(2000ms)*0.5 + possessionPlayerPos*0.5)*(1-pb) \u2014 attacking teams orient on the smoothed ball, defending teams half on the ball carrier.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:313-326",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Ball position smoothing with urgency-scaled window",
    "whatItDoes": "The rectangle does not chase the instantaneous ball; it chases a moving average whose window shrinks for players near the action, so distant players hold shape while nearby players react fast.",
    "howItWorks": "urgencyBias = 1 - NormalizedClamp(|possessionPlayerPos - playerPos|, 2.0, 30.0).\nballX = ball.GetAveragePosition(3500 * (1 - urgencyBias*0.7)).x \u2014 window 3500ms far away, 1050ms right next to the action.\nballY = ball.GetAveragePosition(4000 * (1 - urgencyBias*0.5)).y \u2014 4000ms \u2192 2000ms.\nGetAveragePosition walks the 10ms position history backward and means it over duration_ms (ball.cpp:533-545).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:287-290; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:533-545",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Mapping a normalized formation slot into the rectangle, plus midfield stretch",
    "whatItDoes": "Converts FormationEntry.position into a pitch position inside the current rectangle, and (before that) stretches only the midfielders forward or back so 'midfield joins the attack' / 'midfield sits' is a real shape change rather than a whole-team shift.",
    "howItWorks": "Midfield stretch (only when midfieldFocusStrength>0): midfieldPositionFactor = midfieldFocus*2-1; stretchBias = curve(clamp(1 - |pos.x*1.2|, 0, 1), 1.0) \u2014 the 1.2 overstretch means defenders/attackers (|x| near 1) get ~0 stretch; stretchBias *= midfieldFocusStrength; pos.x = pos.x*(1-stretchBias) + midfieldPositionFactor*stretchBias.\nRectangle mapping: pos.x = backXBound + (pos.x*0.5+0.5)*(frontXBound-backXBound); pos.y = lowYBound + (pos.y * -side * 0.5 + 0.5)*(highYBound-lowYBound). The -side on y mirrors the formation for the team playing the other way.\nCaller-side midfield inputs: manualMidfieldFocus = off_mf*pb + def_mf*(1-pb) (base 0.6/0.5); autoMidfieldFocus = NormalizedClamp((ballX/pitchHalfW)*-side, -0.8, 0.8); midfieldFocus = manual*0.7 + auto*0.3; strength = 0.35 for both phases (teamAIcontroller.cpp:393-400).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:58-87; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:393-400",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Microfocus \u2014 local compaction toward the ball/carrier",
    "whatItDoes": "Pulls players who are already near the action toward the ball or ball carrier, leaving distant players on their formation slot. This is what produces the 'ball-side compactness' look without collapsing the whole team.",
    "howItWorks": "In AIfunctions.cpp:110-165: homogeneousYInfluenceBias=0.2, homogeneousYPositionBias=0.4.\ndist = |(microFocus - purePosition) * (1, 0.8, 0)| / 50.0 \u2014 distance measured from the player's FORMATION slot (not his actual position), with y de-weighted 20%.\nIf dist < 1: bias = 1 - dist; bias = curve(bias, 0.3) (makes it more binary \u2014 come all the way or not at all); then a short-range bump: bias += (1 - NormalizedClamp(|dist - 0.15|, 0, 0.25)) * 0.1; clamp 0..1; bias *= microFocusStrength.\nmicroFocusPosition = microFocus*(1, 0.6, 1) + position*(0, 0.4, 0) \u2014 only 60% of the y pull is applied, so players keep their lane.\nposition = position*(1-bias) + microFocusPosition*bias.\nCaller (teamAIcontroller.cpp:376-390): in possession microFocus = focalPoint shifted 1.0 m toward opponent goal with y*0.9; defending it is focalPoint shifted 2.0 m toward own goal, x clamped to the back bound, y*0.9. microFocusStrength = (off_micro*pb + def_micro*(1-pb)) * (0.2 + 0.8*autoMicro), where microFocusSideBias = NormalizedClamp((ballX/pitchHalfW)*-side, -0.7, 0.7)*0.7 + 0.3 and autoMicro = pow(msb,0.8)*pb + pow(1-msb,0.6)*(1-pb) \u2014 i.e. little compaction on your own half in possession, lots of compaction on your own half when defending.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:110-165; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:376-390",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "xFocus / yFocus \u2014 generic focal attractors inside the rectangle",
    "whatItDoes": "Two extra attractors that squeeze the mapped formation toward a given x line or y line. During open play only yFocus is used (drift toward the ball's y); during set pieces both are the whole placement mechanism.",
    "howItWorks": "xFocus: bias = 1 - clamp(|xFocus - pos.x| / |backXBound - frontXBound|, 0, 1); bias = -cos(bias*pi)*0.5 + 0.5; bias = pow(bias, 0.8); bias *= xFocusStrength; pos.x = lerp(pos.x, xFocus, bias).\nyFocus: distance = clamp(|yFocus - pos.y| / |highYBound - lowYBound|, 0, 1); bias = (1-distance) * (0.2 + 0.8*|yFocus|/pitchHalfH) * yFocusStrength; pos.y = lerp(pos.y, yFocus, bias). The |yFocus|/pitchHalfH term means the whole team only shifts sideways when the ball is genuinely wide.\nOpen play: xFocus=0, xFocusStrength=0; yFocus = ballY, yFocusStrength = 0.5*pb + 0.2*(1-pb) (teamAIcontroller.cpp:370-374).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:91-107; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:370-374",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Dynamic formation redistribution (Hungarian assignment with progressive bottleneck threshold)",
    "whatItDoes": "Reassigns which player occupies which formation slot, so a right back who ended up on the left plays as the left back rather than sprinting across the pitch. Runs every 400ms per team.",
    "howItWorks": "teamAIcontroller.cpp:413-510. Drop the GK, leaving playerNum=10 outfielders. Compute the 10 STATIC adapted formation positions (GetAdaptedFormationPosition(player, useDynamic=false)). Cost(x,y) = |(playerPos_x + movement_x*0.5) - formationPos_y| rounded to decimetres (int(round(d*10))).\nBuild the sorted list of all 100 costs. Then for i = 10, 15, 20, \u2026 : rebuild the matrix with every cost >= distances[i] replaced by 50000 (forbidden), run libhungarian MINIMIZE_COST, and accept the solution when totalCost < 50000 (no forbidden edge used) or when i has run out. This is a min-total-cost assignment subject to the smallest feasible maximum edge \u2014 a cheap bottleneck-assignment approximation.\nOn accept: for each assignment[y][x]==1, players[x]->SetDynamicFormationEntry(players[y]->GetFormationEntry()) \u2014 the player inherits the whole entry (role AND normalized position) of the slot he was matched to.\nScheduling: Team::Process calls it when (actualTime_ms + 200*teamID) % 400 == 0, so the two teams alternate (team.cpp:341-344).\nPortability caveat: the GK-removal loop at lines 418-424 has no iterator increment \u2014 it only terminates because the GK is players[0]. Do not copy that loop shape.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:413-510; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:341-344",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Static-vs-dynamic formation blend by distance to the action",
    "whatItDoes": "Prevents role-swapping chaos near the ball: players far from the action use their swapped (dynamic) slot, players near the action stay in their own (static) slot. Each of the three off-the-ball strategies uses a slightly different constant.",
    "howItWorks": "actionDistance = NormalizedClamp(|playerPos - designatedPossessionPlayerPos|, 15.0, 20.0);\nstaticPositionBias = curve(k * actionDistance, 1.0) with k = 1.0 for defenders (default_def.cpp:23), 0.9 for midfielders (default_mid.cpp:25), 0.8 for forwards (default_off.cpp:25);\ndesiredPosition = staticPos*staticPositionBias + dynamicPos*(1-staticPositionBias).\nBoth positions come from TeamAIController::GetAdaptedFormationPosition(player, false) and (player, true) \u2014 the same function, differing only in whether it reads GetFormationEntry() or GetDynamicFormationEntry().",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/strategies/offtheball/default_def.cpp:20-24; .../default_mid.cpp:22-26; .../default_off.cpp:22-26",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Team possession amount and its lagged (fading) twin",
    "whatItDoes": "The team-level possession scalar the whole tactical layer runs on. 1.0 is neutral, >1 means we are closer to the ball than they are, <1 the reverse. The fading version is a heavily rate-limited low-pass of it, and is what positioning actually reads \u2014 instantaneous possession is far too twitchy for shape.",
    "howItWorks": "Per 10ms tick in Team::Process:\nteamPossessionAmount = (oppTeam.timeNeededToGetToBall_ms + 1500) / (ownTeam.timeNeededToGetToBall_ms + 1500);\ntmp = fadingTeamPossessionAmount*0.995 + clamp(teamPossessionAmount, 0.5, 1.5)*0.005;\nfadingTeamPossessionAmount += clamp(tmp - fading, -0.005, +0.005) \u2014 a 0.5% EMA per 10ms tick PLUS a hard slew limit of 0.005 per tick (0.5 units/second), so a full swing 0.5\u21921.5 needs \u22652 seconds.\nHard overrides: when not in play, in a set piece, or someone is the ballRetainer, both values are snapped to 1.5 (our ball) or 0.5 (theirs) (team.cpp:328-334).\nfadingTeamPossessionAmount is always clamped to [0.5, 1.5] on write (team.cpp:237-239); both reset to 1.0 on ResetSituation (team.cpp:254-255).\nAn alternative, unsmoothed metric also exists: AI_GetTeamPossessionFactor = clamp(((oppTime - ownTime)/5000)*0.5 + 0.5, 0, 1) (AIfunctions.cpp:933-942).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:229-239, 250-255, 320-334; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:933-942",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "time-needed-to-get-to-ball as the possession currency",
    "whatItDoes": "Every possession judgement in the engine \u2014 team possession amount, best-possession team, designated player, switching \u2014 is expressed as 'ms until this player can touch the ball', not distance. A team's value is the min over its active players.",
    "howItWorks": "Team::UpdatePossessionStats: hasPossession = OR over active players; timeNeededToGetToBall_ms = min over active players (team.cpp:488-506).\nPer player (player.cpp:150-279): sweep the ball prediction from t=0 to ballPredictionSize_ms=3000 in adaptive steps, skipping samples where predicted ball height >= 1.5 m; for each t, compute AI_GetTimeNeededForDistance_ms(playerPos, playerMovement, ballPos(t)); the answer is the first t where timeNeeded <= t (with one refinement pass at 10ms granularity). Coarse step = clamp(round(ballDist/50 m/s * 1000), 10, 500) rounded down to 10s.\nAI_GetTimeNeededForDistance_ms (AIfunctions.cpp:499-580): beyond optimizeDist (16 m, 48 m for the designated player) it short-circuits to dist/(maxVelocity*0.75)*1000. Below that it integrates: existing momentum decays linearly over changeTime_ms=700, adaptedMaxVelocity = maxVelocity*0.94, reach radius starts at radius_usual=0.28 m (radius_optimistic=0.9 m) and grows by adaptedMaxVelocity*bias*dt.\nAnimation-derived shortcuts (TouchAnim/TouchPending clamping, the sub-80ms 'quantum' case) are engine-specific.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:488-506; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/player.cpp:150-279; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:499-580",
    "portable": "partly",
    "priority": "high"
   },
   {
    "name": "Designated team possession player (per team) with anti-chaos hysteresis",
    "whatItDoes": "Each team nominates exactly one 'our man on the ball / going for the ball'. Every other coordination mechanism (attacking runs, force-field flocking, focal point, forward support) references him. The hysteresis stops the nomination flickering between two players in a 50/50.",
    "howItWorks": "Team::Process (team.cpp:408-432), each tick:\ntimeRating = (bestPlayer.timeToBall + 500) / (designated.timeToBall + 500);\nif (bestPlayer.HasPossession()) timeRating *= 0.5; if (designated.HasPossession()) timeRating /= 0.5;\n(human-control terms *0.8 / /0.8 exist too and are not portable);\nif designated can reach the ball before the closest opponent by >100ms: timeRating += 0.2; timeRating *= 1.2 (less need to switch);\nswitch only if timeRating < 0.8 \u2014 i.e. the challenger must be ~20% faster before the nomination moves.\nGetBestPossessionPlayer is the plain argmin of timeNeededToGetToBall_ms over active players (team.cpp:211-227). Reset picks players[0] (team.cpp:263).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:207-227, 408-432",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Match-level best possession team and designated possession player",
    "whatItDoes": "Above the two teams sits a single match-wide 'who has the ball' verdict and a single 'the ball carrier' pointer that both teams' AI reads (it is the focal point of the defending team's shape).",
    "howItWorks": "CalculateBestPossessionTeamID (match.cpp:1468-1482): if a ballRetainer exists, his team; otherwise compare the two teams' timeNeededToGetToBall_ms \u2014 strictly lower wins, exact tie yields -1 (no team).\nMatch-level designated player (match.cpp:909-925): candidate = bestPossessionTeam's designated player; switch only if timeRating = (candidateTime+10)/(designatedTime+10) < 0.85 \u2014 a second, tighter hysteresis on top of the per-team one. If bestTeamID == -1, keep the current team's designated player. If a ballRetainer exists he is the designated player unconditionally.\nOrder of operations each tick (match.cpp:899-925): UpdateSwitch \u2192 Team::Process (both) \u2192 UpdatePossessionStats (both) \u2192 CalculateBestPossessionTeamID \u2192 designated-player arbitration. Note the tactical layer therefore reads last tick's possession numbers.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/match.cpp:899-925, 1468-1482; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/match.hpp:159-162",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Average possession side history (6 s) driving lateral team shift",
    "whatItDoes": "A 6-second rolling record of which half of the pitch the game is being played in, used so the defensive block sits toward the side the match has actually been on rather than snapping to the instantaneous ball x.",
    "howItWorks": "Every tick in play with a valid best-possession team: sideValue = \u03a3 over both teams of (team.fadingTeamPossessionAmount - 0.5) * team.side, inserted into ValueHistory<float>(6000) (match.cpp:1019-1028). GetAveragePossessionSide(t) returns the mean of the last t ms (match.hpp:164).\nConsumed as: sideX = 0.2*sideFocus*(-side)*pitchHalfW + 0.8*(-avgPossessionSide(6000))*pitchHalfW \u2014 80% of the 'where should our block sit' term is this 6-second history, only 20% is the instantaneous possession bias (teamAIcontroller.cpp:339-342). It then competes with the raw ball x via sideFocusStrength.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/match.cpp:1019-1028; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/match.hpp:164, 311; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:336-345",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Team mentality (offensivenessBias) from scoreline, clock and recent possession",
    "whatItDoes": "A slow 0..1 team-level mood that makes a trailing team push and a leading team sit, more strongly as the match runs down, and blends in whether the team has actually been dominating. Recomputed once per second and immediately after every goal.",
    "howItWorks": "TeamAIController::UpdateTactics (teamAIcontroller.cpp:946-1001):\ngoalFactor = clamp(0.5 + (oppGoals - goals)*0.25, 0, 1) \u2014 2 goals down saturates at 1.0;\ntimeFactor = 0.5 + 0.5*clamp(matchTime_ms / 6300000, 0, 1) \u2014 desperation ramps from 0.5 to 1.0 over the full match (6,300,000 ms = end of 2nd extra time);\noffenseBias = clamp(0.5 + (goalFactor-0.5)*timeFactor, 0, 1);\npossessionFactor = MatchData::GetPossessionFactor_60seconds(); recentPossessionBias = 1 - |possessionFactor - teamID|;\noffensivenessBias = offenseBias*0.5 + recentPossessionBias*0.5.\nThe 60s possession meter is a bounded integrator: on each 10ms of possession, possession60seconds moves \u22130.01 clamped to \u00b160, and the getter returns value/60*0.5+0.5 (matchdata.cpp:28-33, matchdata.hpp:25).\nCalled every 1000ms (teamAIcontroller.cpp:87) and on each goal (match.cpp:982, 989).\nConsumers: possessionBias += (offensivenessBias-0.5)*0.3 (line 322); side-focus strengths (309-310); and the defensive-line start distance startDistance = 30 + 20*offensivenessBias (line 91).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:87, 91, 309-310, 322, 946-1001; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/data/matchdata.cpp:28-33; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/data/matchdata.hpp:25; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/match.cpp:982, 989",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Tactical sliders \u2192 positioning: base values, mod multipliers, live values",
    "whatItDoes": "The complete user-facing tactics model. Ten authored 0..1 sliders are turned into bounded offsets on hardcoded base constants; the result (liveTeamTactics) is what the formation rectangle reads. The design deliberately keeps user influence small.",
    "howItWorks": "baseTeamTactics (teamAIcontroller.cpp:39-52): position_offense_depth_factor 0.9, position_defense_depth_factor 0.75, position_offense_width_factor 0.9, position_defense_width_factor 0.8, position_offense_ownhalf_factor 0.52, position_defense_ownhalf_factor 0.54, position_offense_midfieldfocus 0.6, position_defense_midfieldfocus 0.5, position_offense_midfieldfocus_strength 0.35, position_defense_midfieldfocus_strength 0.35, position_offense_sidefocus_strength 0.1, position_defense_sidefocus_strength 0.4, position_offense_microfocus_strength 0.7, position_defense_microfocus_strength 0.8.\nteamTacticsModMultipliers (lines 55-64) \u2014 the \u00b1 range a slider may move each: depth \u00b10.1, width \u00b10.1, midfieldfocus \u00b10.3, sidefocus_strength \u00b10.1, microfocus_strength \u00b10.15.\nMapping (lines 980-999): offset = (userSliderValue - 0.5)*2*multiplier; liveTeamTactics[k] = clamp(baseValue + offset, 0, 1), only for keys that exist in baseTeamTactics.\nNote: ownhalf_factor and midfieldfocus_strength have NO entry in teamTacticsModMultipliers, so GetReal(...,0.0f) returns 0 and those four values are effectively not user-adjustable.\nHuman-readable slider names/descriptions confirm the intent (teamdata.cpp:179-227): 'attacking: team depth', 'defending: team width', 'midfield joins attack', 'attacking: forward drive' (= sidefocus strength), 'compactness around ball' (= microfocus strength).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:39-64, 946-1001; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/data/teamdata.cpp:172-232; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/data/teamdata.hpp:14-25",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Per-role tactic overrides (mixup)",
    "whatItDoes": "Bends the team-wide tactic values per role before they are used, so full backs push on, wingers stay high for counters, centre backs spread wide. A small hardcoded table, applied as an additive offset.",
    "howItWorks": "mixup(base, varname, role) returns clamp(base + value, 0, 1) where value comes from a table, else base unchanged (teamAIcontroller.cpp:230-275):\nCB: position_offense_width_factor +0.2;\nLB/RB: position_defense_ownhalf_factor -0.075, position_offense_width_factor +0.2, position_offense_ownhalf_factor -0.1;\nLM/RM: position_defense_ownhalf_factor -0.05, position_offense_ownhalf_factor -0.1;\nAM: position_defense_depth_factor +0.125;\nCF: position_defense_depth_factor +0.125.\nApplied to all 14 tactic reads at the top of GetAdaptedFormationPosition (lines 292-305), using the DYNAMIC role when useDynamicFormationPosition is true. A commented-out 'bias version' shows the author also tried lerping toward the role value at rolebias 0.5.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:230-275, 283-305",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "AI_GetMindSet \u2014 role offensiveness scalar",
    "whatItDoes": "A single 0..1 number per role used everywhere as 'how far up the pitch does this man think'. It is the cheapest way the engine differentiates behaviour by position.",
    "howItWorks": "GK 0.0, CB 0.0, LB/RB 0.25, DM 0.25, LM/CM/RM 0.5, AM 0.75, CF 1.0 (AIfunctions.cpp:1228-1249).\nUses: side-focus asymmetry \u2014 offense_sideFocusStrength += (-0.5 + mindset)*0.2 and defense_sideFocusStrength += (0.5 - mindset)*0.2, then each clamped after adding -0.3 + offensivenessBias*0.3 (resp. -0.3 + (1-offensivenessBias)*0.3) (teamAIcontroller.cpp:307-310); defendFactor = (1-mindset)*(1-possessionBias) (line 376); defensive-component bias per strategy = pow(clamp(K - mindset - fadingPossession, 0, 1), 0.7) with K = 1.9 (def), 1.5 (mid), 1.3 (off); laziness by role; opponent-repel weighting in the support force field; hunt distance = 10 + (1-mindset)*10 m.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:1228-1249; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:307-310, 376; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/strategies/offtheball/default_def.cpp:35-36, default_mid.cpp:43-44, default_off.cpp:50-51",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Defensive line / offside trap x (deepestDanger)",
    "whatItDoes": "One x coordinate per team per tick that the whole back line will not go behind. It is a max() over several threat sources, so the line drops for the ball, for the ball's near future, for the deepest opponent, and refuses to be dragged too deep by a slacking teammate.",
    "howItWorks": "TeamAIController::Process (teamAIcontroller.cpp:91-128):\nstartDistance = 30 + 20*offensivenessBias (distance from own goal where we start holding); forceDistance = 6 (never hold closer than this);\ndeepestDanger = (pitchHalfW - startDistance) * side \u2014 the default line;\nBall term with gradual fallback: adaptedBallX = ballX*side; offsetX = 20 + 10*(1-offensivenessBias); startToForcedBias = NormalizedClamp(adaptedBallX, pitchHalfW - startDistance - offsetX, pitchHalfW - forceDistance); adaptedBallX += offsetX*(1 - startToForcedBias); back to absolute; take max.\nBall future: max with ball.Predict(700).x.\nOpponent: max with oppDesignatedPlayer.x + oppMovement.x*0.1 + 4.0*side (cautionDistance).\nSlacking teammate: lineX = AI_GetOffsideLine(own team); allowSlackDistance = 4.0; if lineX*side - 4 is deeper, deepestDanger = lineX - 4*side.\noffsideTrapX = deepestDanger. Also clips backXBound of the formation rectangle (line 368) and the marking shooting-point (playercontroller.cpp:88-97).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:91-131, 368",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Smooth offside-trap application (compression instead of hard clamp)",
    "whatItDoes": "Applies the trap line to a desired position without stacking every defender on exactly the same x \u2014 the band around the line is compressed rather than clipped, so the back line keeps its stagger.",
    "howItWorks": "ApplyOffsideTrap (teamAIcontroller.cpp:625-651): areaHalfLength = 2.0 m. Work in 'absolute' space (multiply x by side). If absPosX > absTrapX - areaHalfLength: areaFront = absTrapX - areaHalfLength; posFactor = clamp((absPosX - areaFront) / (areaHalfLength*2), 0, 1); absResultPosX = areaFront + areaHalfLength*posFactor. That maps the 4 m band [trap-2, trap+2] onto the 2 m band [trap-2, trap]. The commented-out alternative is the binary hard clamp.\nApplied by defenders and midfielders after the defensive component, not before (default_def.cpp:38-39, default_mid.cpp:46-47). Forwards do not apply it.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:625-651; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/strategies/offtheball/default_def.cpp:38-39; .../default_mid.cpp:46-47",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "AI_GetOffsideLine (correct second-deepest-opponent rule)",
    "whatItDoes": "Computes the real offside line for a team, used both to clip attacking runs/support positions and as an input to the defensive line.",
    "howItWorks": "AIfunctions.cpp:319-358. Optionally extrapolate every opponent by movement.x * futureSim_ms/1000 (callers use 0 or 240 ms). Find the deepest opponent, then find the deepest of the REST \u2014 the second-deepest is the line. Then: if the ball is deeper than that, the ball becomes the line; if the line ends up on the attacking team's own half (line*side < 0), it is snapped to 0.01*-side (the halfway line); finally clamp to \u00b1pitchHalfW.\nCallers: the slacking-teammate term of the defensive line (teamAIcontroller.cpp:115), offside rating in the support-position search (elizacontroller.cpp:521, 556), and a hard no-offside clamp on the force-field result with a 0.08 m margin (elizacontroller.cpp:649, 783).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:319-358; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:649, 783",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Opponent danger ranking + man-marking assignment (top-3 only)",
    "whatItDoes": "Every 400ms the defending team ranks the opponents by danger and greedily assigns its three best-placed players to mark the three most dangerous. Everyone else is positioned purely by formation/zone.",
    "howItWorks": "Danger (teamAIcontroller.cpp:133-157): mostDangerousPos = 0.8 * (own goal at ((pitchHalfW-2)*side, 0)) + 0.2 * ball.Predict(100); dangerFactor = (1 - NormalizedClamp(|oppPos - mostDangerousPos|, 0, 2*pitchHalfW)) * 0.95, plus 0.05 if that opponent is their designated possession player. Sorted descending.\nAssignment (CalculateManMarking, teamAIcontroller.cpp:570-623): numMarkedOpponents = 3. Clear every player's manMarkingID to -1. For each of the top 3 opponents in order, scan all remaining non-GK players, pick the one with the highest CalculateMarkingQuality, set his manMarkingID, and remove him from the pool. Greedy, not optimal \u2014 unlike the formation redistribution it does not use Hungarian.\nScheduled at (actualTime_ms + 200*teamID + 100) % 400 == 0, i.e. 100ms offset from the dynamic-role pass so the two never run on the same tick (team.cpp:346-349).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:133-157, 570-623; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:346-349",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "CalculateMarkingQuality \u2014 geometric 'can I cover him' score",
    "whatItDoes": "Scores how well a given defender is placed to mark a given attacker, using goal-side geometry rather than raw distance, so a defender who is goal-side and level scores far better than one who is nearer but already beaten.",
    "howItWorks": "teamAIcontroller.cpp:512-568. Positions extrapolated by movement*0.1. Build a virtual line through the defender perpendicular to defender\u2192own-goal, of length clamp(distToGoal, 4, 14), offset back from the defender by safetyVec = -toGoalNorm*0.5, endpoints at \u00b10.5\u03c0 rotation.\noppIsOnRightSideOfLine = line.WhatSide(oppPos); oppFromLineDistance and the parameter u (0 at one end, 1 at the other) come from line.GetDistanceToPoint.\nIf the opponent is on the good side, adaptedDistance = |oppFromLineDistance - 2.0| (best spot is 2 m off the line, not on it).\noppFromLineDistanceFactor = sqrt(NormalizedClamp(adaptedDistance, 0, 60)); oppOnLineDistanceFactor = sqrt(clamp(|u*2-1|, 0, 1)).\nresult = 1 - 0.5*oppFromLineDistanceFactor - 0.5*oppOnLineDistanceFactor, clamped 0..1; if the opponent has already passed the defender, result *= 0.6.\nFinally mixed with plain proximity so ties break sensibly: result = result*0.8 + (1 - NormalizedClamp(|defPos - oppPos|, 0, 2*pitchHalfW))*0.2.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:512-568",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Marking \u2192 position: AddDefensiveComponent (shooting-point interception)",
    "whatItDoes": "Turns a manMarkingID into an actual positional offset: get closer to the opponent's likely shooting point than he is, by a buffer, and if you are already beaten, fall back toward your own goal instead of chasing.",
    "howItWorks": "playercontroller.cpp:53-122. Constants: possessionPlayerShootThreshold 24 m (tight marking radius when the man is the ball carrier), genericOpponentShootThreshold 8 m, minDistance 0.4 m, bufferDistance 4 m.\noppPos = delayed mental image position + movement*0.5; oppToThresholdDistance = clamp(distOppToGoal - shootThreshold, 0.4, pitchHalfW); shootingPoint = oppPos + normalize(goal - oppPos)*oppToThresholdDistance.\nIf shootingPoint is beyond the team's offsideTrapX, it is replaced with the intersection of the opp\u2192goal line and the vertical trap line.\nslackedDistance = |shootingPoint - desiredPosition| - (oppToThresholdDistance - buffer); if >0, defendPosition = desiredPosition + normalize(toThreshold)*slackedDistance.\nIf the defender's ACTUAL position is already further from the shooting point than the opponent is, add normalize(goal - defendPosition) * actualSlack * 0.7 \u2014 retreat instead of chasing.\nBlended in with a role/possession-scaled bias: desiredPosition = lerp(desiredPosition, defendPosition, bias), bias = pow(clamp(K - mindset - fadingTeamPossessionAmount, 0, 1), 0.7), K = 1.9 defenders / 1.5 midfielders / 1.3 forwards.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/playercontroller.cpp:53-122; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/strategies/offtheball/default_def.cpp:35-36; .../default_mid.cpp:43-44; .../default_off.cpp:50-51",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Team-triggered attacking run (conditions, runner selection, 4 s window)",
    "whatItDoes": "The team AI periodically decides that a run in behind is on, nominates one runner, and publishes him for 4 seconds; the runner's own strategy then adds a strong forward attractor.",
    "howItWorks": "Trigger check every 500ms, only while no run is active and only if the team has best possession (teamAIcontroller.cpp:189-222; the 'fewer than 2 human gamers' guard is not portable).\nRunner selection (SelectAttackingRunPlayer, lines 76-83): offenseFocusPos = possessionPlayer.pos + 26 m toward the opponent goal; runner = closest AI player to that point, excluding the possession player.\nConditions: distanceRating = pow(1 - NormalizedClamp(|runner - possessionPlayer|, 0, 40), 0.5) \u2014 beyond 40 m a run is pointless because you cannot pass that far.\noppDensityRating starts at 1.0; spot = runner.pos*(1, 0.8, 0) + 10 m*side; for each of the 4 closest opponents to that spot, subtract 0.3 * pow(curve(1 - NormalizedClamp(oppDist, 0, 15), 1.0), 0.5).\nrunConditionsRating = distanceRating * oppDensityRating; fire if >= 0.5 (neededRating).\nApplyAttackingRun sets endApplyAttackingRun_ms = now + 4000 and stores attackingRunPlayer (lines 907-911).\nConsumption: the runner only actually runs if his own attackBias is high enough \u2014 forwards need attackBias > 0.7 where attackBias = NormalizedClamp(fadingPossession - 0.5, 0.1, 0.6) (default_off.cpp:38-44), midfielders need > 0.9 with range (0.1, 0.7) (default_mid.cpp:30-36). Defenders never run. In the force field a run adds an attractor at (-side*pitchHalfW, currentY*0.5) with power 2.0*runWeight and halves/tightens opponent repulsion (elizacontroller.cpp:687-711).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:76-83, 187-222, 907-911; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/strategies/offtheball/default_off.cpp:36-47; .../default_mid.cpp:28-39; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:687-694",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Forward support player + flank lane oscillation",
    "whatItDoes": "Guarantees exactly one nearby teammate always pushes ahead of the ball carrier for a forward option, while everyone else's forward push depends on which lateral lane the ball is in \u2014 this is what stops the shape being static and stops everyone pushing at once.",
    "howItWorks": "Recomputed every 1500ms: forwardSupportPlayer = closest player to (possessionPlayer.pos + 1.5 m toward the opponent goal), excluding the possession player (teamAIcontroller.cpp:224-226).\nIn the support force field (elizacontroller.cpp:653-685), the base-position attractor origin is shifted forward:\n  if this player IS the forward support player: origin.x += -side * (0.3 + 0.7*dynamicMindSet) * 12.0 m;\n  otherwise 'lane version': amount = 22.0; laneY = -signSide(possessionPlayerY) * 8.0 (the opposite-side lane); amount *= curve(1 - NormalizedClamp(|laneY - currentY|, 0, 30), 1.0); delta = -side * pow(dynamicMindSet, 1.5) * amount; origin.x += delta.\nThe attractor's power also scales with how far off it you are: power = basePositionWeight(0.7) * (0.3 + 0.7*NormalizedClamp(|origin - currentPos|, 0, 20)).\nA commented-out earlier version used a 7-second sine wave phase-offset by the player's y \u2014 worth knowing as the alternative.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:224-226; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:653-685",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Support position force field (off-the-ball flocking around the formation slot)",
    "whatItDoes": "Given the formation-derived base position, produces the actual off-the-ball target by summing attractors and repulsors: hold your slot, spread from opponents, spread from teammates, get out of the pass lane, orbit the ball carrier at a preferred radius, stay onside.",
    "howItWorks": "ElizaController::GetSupportPosition_ForceField (elizacontroller.cpp:597-789). Weights: basePositionWeight 0.7, opponentRepelWeight 0.3, teammateRepelWeight 0.4, ballRepelWeight 1.0, runWeight 1.0, flockToPossessionPlayerWeight 0.45, webScale 0.75. Opponent repulsion is scaled by role: CB/LB/RB \u00d72.2, DM \u00d72.0, CM/LM/RM \u00d71.6, AM \u00d71.2, CF \u00d71.0 (defenders keep their distance, strikers do not).\nSpots: base position (constant decay, see previous entry); optional run attractor; the 3 closest opponents to a point biased toward the carrier, each repelling from oppPos + 2 m further from the carrier ('anti-magnet behind opponent, because the pass-way must be cleared'), scale 5, exp 0.7; the 6 closest teammates repelling at scale 14*webScale, exp 1, but only when fadingTeamPossessionAmount >= 1.02; four ball-prediction points (200/350/500/650 ms) repelling at scale 2, exp 0.5, only when fading >= 1.06; and an attract/repel pair on the ball carrier at scale 28*webScale and 16*webScale with equal power, which produces a preferred orbit radius rather than a magnet.\nAI_GetForceFieldMovement (AIfunctions.cpp:458-497): for each spot, intensity = 1.0 for e_DecayType_Constant, else pow(clamp(1 - dist/scale, 0, 1), exp); direction is toward (attract) or away (repel); attractors are damped within attractorDampingDistance (7 here) by multiplying by dist/damping to prevent overshoot; result = (\u03a3 dir*power*intensity / \u03a3 power*intensity) * sprintVelocity, i.e. a force-weighted mean direction scaled to one sprint-second.\nResult is clamped to the offside line with a 0.08 m margin and to the pitch.\nBlended into the formation position by attackBias = NormalizedClamp(fadingPossession - 0.5, lo, hi) with (lo,hi) = (0.2,0.9) defenders, (0.1,0.7) midfielders, (0.1,0.6) forwards.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:597-789; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:458-497; strategies at .../default_def.cpp:28-30, .../default_mid.cpp:30-38, .../default_off.cpp:38-46",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Candidate-ring support position (alternative, superseded)",
    "whatItDoes": "The earlier, non-force-field way of picking an off-the-ball target: sample a ring of candidate positions and score them. Kept in the source, no longer called by the strategies. Useful as a discrete alternative for a 4 Hz sim where a force field may jitter.",
    "howItWorks": "ElizaController::GetSupportPosition (elizacontroller.cpp:476-595). Candidates = current position plus 12 compass directions \u00d7 3 radii (dribbleVelocity 3.5, walkVelocity 5.0, sprintVelocity 8.0), rejected if off-pitch. Weights: offense 0.8 + mindset*clamp((fadingPossession-0.5)*2,0,1), distance 1.0, pass 0.8, movement 1.5, formation 1.6 + clamp(distToBall/30,0,1), offside 10.0 (effectively a veto).\nRatings: offenseRating from change in distance-to-opponent-goal (with a 5 m 'not too close' offset) normalized by sprintVelocity; distanceRating from change in distance-to-ball with desiredBallDistance = 10 m and a reflection so too-close is penalised equally; movementRating = 1 - |currentMovement - (candidate - pos)|/(2*sprintVelocity); formationRating from change in distance to the base formation position; offsideRating binary. Current position gets a +0.1 stickiness bonus.\nOnly the top third by pre-rating then gets the expensive pass-lane check (nearest of 4 opponents to a point 2 m from the candidate toward ball.Predict(240), pow(clamp(d/8,0,1),1.2)) added at passWeight.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:476-595",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Work-rate / laziness throttle by role and team possession",
    "whatItDoes": "Players do not sprint to their formation position at all times; how hard they work is a function of their role's mindset, the team's possession state, and how far the action is. This is what keeps a team from looking like 22 identical bots and what creates natural transitional gaps.",
    "howItWorks": "ElizaController::GetLazyVelocity (elizacontroller.cpp:437-474):\nstartLazinessDistance = 20 * (fatigueInv*0.8 + 0.2); endLazinessDistance = 65 * (fatigueInv*0.5 + 0.5);\nactionDistance = |playerPos - oppDesignatedPossessionPlayerPos|; teamPossession = clamp(fadingPossession - 0.5, 0, 1); mindSet = AI_GetMindSet(dynamic role);\nlazinessByRole = mindSet + teamPossession*(1 - mindSet*2) \u2014 offensive players are lazy when the team lacks possession, defenders when it has it, midfielders always half-lazy;\nlazinessByPosition = NormalizedClamp(actionDistance, startLazinessDistance, endLazinessDistance);\nlazyFactor = lazinessByPosition * (0.5 + lazinessByRole*0.5); velocity *= (1 - lazyFactor), with a floor at dribbleVelocity if the raw desire was >= dribbleVelocity.\nA short-term breath model then caps it: breathLeft = pow(1 - NormalizedClamp(avgVelocity(last 10 samples), idle, sprint), 0.8 - workRateStat*0.2), *1.2 clamped, then blended back toward 1 by (1-lazyFactor); velocity = min(velocity, sprintVelocity*breathLeft).\nAlso, desiredVelocity from any strategy = distance * distanceToVelocityMultiplier (2.6) before clamping to sprintVelocity.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:437-474; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/gamedefines.hpp:18-21, 54; strategies .../default_def.cpp:43-48",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Staggered per-team update scheduling",
    "whatItDoes": "The expensive team-level passes are not run every tick and never on the same tick for both teams, which both saves cost and desynchronises the two teams' reactions.",
    "howItWorks": "Team::Process runs every 10ms tick but gates: CalculateDynamicRoles when (actualTime_ms + 200*teamID) % 400 == 0; CalculateManMarking when (actualTime_ms + 200*teamID + 100) % 400 == 0 (team.cpp:341-349). Inside TeamAIController::Process: UpdateTactics when actualTime_ms % 1000 == 0 (line 87); attacking-run check when actualTime_ms % 500 == 0 (line 189); forwardSupportPlayer when actualTime_ms % 1500 == 0 (line 224). The defensive line, opponent danger ranking and formation rectangle are the only things recomputed every tick.\nFor a 4 Hz sim the direct translation is: shape every step, marking and role reassignment every 1-2 steps alternating by team, mentality every 4 steps, runs every 2.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:338-350; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:85-89, 187-226",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Set-piece team placement (rectangle reuse with hand-tuned bounds and focuses)",
    "whatItDoes": "All set pieces reuse exactly the same AI_GetAdaptedFormationPosition rectangle machinery, only with hardcoded bounds/focuses per situation and per taker/non-taker, plus a few special cases. No separate set-piece formation data exists.",
    "howItWorks": "PrepareSetPiece (teamAIcontroller.cpp:653-905). GK snapped to (pitchHalfW*side*0.98, 0). Taker team's fadingTeamPossessionAmount forced to 1.5, the other to 0.5.\nKickOff: basePos = formationPos scaled by (-side*pitchHalfW*0.6, -side*pitchHalfH*0.6), x halved then +0.2*pitchHalfW*side, forbidden from crossing halfway (min 0.5 m) or standing inside the 9.4 m centre circle; \u00b12 m random y jitter to stop bunching; the taker team's 2 closest players to the centre spot are placed at (0, i*1.4*side).\nGoalKick: taker team backX = side*pitchHalfW*0.5, frontX = -side*pitchHalfW*0.2; other team 0.4/-0.1; y bounds \u00b10.7*pitchHalfH; no focuses.\nCorner: taker backX/frontX = -side*pitchHalfW*0.2 / *0.96, xFocus = frontX*0.85 str 0.7, yFocus = ballY*0.1 str 0.7, midfieldFocus 0.9 str 0.5; defenders backX/frontX = side*pitchHalfW*0.98 / *0.5, xFocus = backX*0.94 str 0.8, yFocus str 0.9, midfieldFocus 0.1 str 0.7; microFocus at (ballX*0.95, ballY*0.1) strength 0.9; y bounds \u00b10.6*pitchHalfH.\nThrowIn: bounds relative to the ball (\u00b130 m back, 20/15 m forward), xFocus 4 m past / 16 m behind the ball, strengths 0.4/0.2, yFocus ~ballY strengths 0.6/0.5, y bounds \u00b10.75*pitchHalfH shifted by ballY*0.25, microFocus = ballPos strength 0.7.\nFreeKick: an xOffset = (ballX*-side/pitchHalfW)*0.5+0.5 term scales all bounds and strengths; non-takers pushed out to at least 9.15 m from the ball; a 3-man wall built from the 3 closest players at exactly 9.15 m along ball\u2192goal with \u00b10.07 fan, only if the ball is within 40 m of goal.\nPenalty: everyone outside the box (x beyond pitchHalfW-16.5-0.5 pushed back) and outside the 9.15+0.5 m arc.\nCommon: taker = closest player to the ball, placed 2.3 m off it (0.3 m for throw-in/kickoff, 3.0 m for a penalty); all others pushed to at least 2 m (own team) or 5 m (opposition) from the ball.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:653-905",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Delayed mental image (per-team world snapshots with reaction time)",
    "whatItDoes": "AI queries do not read the true world state; they read a ring buffer of snapshots taken every 10ms and indexed by the querying player's reaction time, with a bounded deviation from reality. Produces natural reaction lag and mistakes without any explicit randomness.",
    "howItWorks": "Match keeps up to 30 MentalImages, one per 10ms tick, index 0 = now (match.cpp:885-894, match.hpp:274); GetMentalImage(history_ms) indexes history_ms/10 and stamps the snapshot with its age (match.cpp:639-644).\nEach snapshot stores per player: team, side, id, position, direction, body direction, velocity, movement, static and dynamic formation entries (mentalimage.cpp:18-45), plus the full ball prediction array.\nOn read, positions are extrapolated forward by movement * age and then clipped: EnforceMaximumDeviation from the true position by maxDistanceDeviation = 2.5 m and from true movement by maxMovementDeviation = walkVelocity (5.0) (mentalimage.cpp:11-12, 47-63, 87-106).\nReaction time itself: PlayerController::GetReactionTime_ms adds (1 - matchDifficulty)*100 ms for fully AI teams (playercontroller.cpp:41-45).\nAt 4 Hz a 10ms ring is meaningless, but the pattern \u2014 a 1-2 step delayed snapshot plus a bounded deviation clamp \u2014 ports directly and is cheap.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/mentalimage.cpp:9-106; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/match.cpp:635-648, 885-894; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/playercontroller.cpp:41-45",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Hunt / close-down override (nearest-two pressing outside the marking system)",
    "whatItDoes": "Independently of man-marking, any player who is within a role-dependent radius of the opposing ball carrier and among the two closest teammates to him abandons his formation position and goes to intercept. This is what actually presses the ball.",
    "howItWorks": "elizacontroller.cpp:324-389: huntDistanceThreshold = 10 + (1 - mindSet)*10 m, then multiplied by (0.5*fatigueFactorInv + 0.5*(1 - NormalizedClamp(avgVelocity(10), idle, sprint))) and by (0.3 + matchDifficulty*0.7).\nCondition: team does NOT have best possession, player has no manMarkingID, and |(oppCarrierPos + oppMovement*0.12) - (myPos + myMovement*0.04)| < huntDistanceThreshold.\nThen AI_GetClosestPlayers(team, oppPos + oppMovement*0.1, 2) \u2014 only if this player is one of the two closest does he actually engage (huntingPlayersNum = 2), and only if NeedDefendingMovement() says the interception is worth moving for; then he heads for GetDefendPosition(opp) with forceMagnet.\nGetDefendPosition (playercontroller.cpp:124-167) computes the point on the opponent\u2192own-goal line equidistant from him and me (perpendicular bisector of me-to-opp intersected with opp-to-goal, u clamped to [0,1]), then leads it by normalize(oppToGoal)*sprintVelocity*0.1 + oppMovement*0.14.\nAlso: the team's designated possession player with possessionAmount > 0.8 sets forceMagnet and extraHaste so 50/50 battles are not abandoned (lines 346-349).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:324-389; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/playercontroller.cpp:124-167",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Role \u2192 strategy dispatch (three off-the-ball strategies + goalie)",
    "whatItDoes": "The only behavioural branch above the shared positioning code: which of three off-the-ball strategies a player runs is decided purely by his STATIC formation role, not his dynamic one. The three differ only in a handful of constants.",
    "howItWorks": "elizacontroller.cpp:244-261: if in play, not a set piece, not the ball retainer, not the match's designated possession player, and not a GK \u2014 LB/CB/RB \u2192 DefaultDefenseStrategy, DM/LM/CM/RM/AM \u2192 DefaultMidfieldStrategy, CF \u2192 DefaultOffenseStrategy. Designated possession player goes to GetOnTheBallCommands instead (line 264), GK to GoalieDefaultStrategy (line 271). Strategies instantiated once in LoadStrategies (lines 422-427).\nThe three differ only in: static-position blend constant (1.0 / 0.9 / 0.8), attackBias range ((0.2,0.9) / (0.1,0.7) / (0.1,0.6)), defensive-component constant K (1.9 / 1.5 / 1.3), makeRun eligibility (none / >0.9 / >0.7), and whether the offside trap is applied (yes / yes / no). Everything else is identical code.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:244-290, 422-427; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/strategies/offtheball/default_def.cpp, default_mid.cpp, default_off.cpp",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Team pressure and keeper rush triggers",
    "whatItDoes": "Two short-lived team-level overrides: send one nominated player to hard-press the ball carrier, and let the keeper rush off his line. Both exist in the team controller but in the shipped build only human input fires them \u2014 the AI trigger block is commented out.",
    "howItWorks": "ApplyTeamPressure (teamAIcontroller.cpp:913-928): endApplyTeamPressure_ms = now + 500; teamPressurePlayer = closest AI player (excluding the GK) to oppCarrierPos + oppMovement*0.24 + 1 m toward own goal; his manMarkingID is overwritten with that opponent's id. Consumed in elizacontroller.cpp:296-300 as forceMagnet, which redirects the movement input straight at the own goal so the ball-magnet code takes over.\nApplyKeeperRush (930-932): endApplyKeeperRush_ms = now + 300; consumed by goalie_default.cpp:154.\nThe AI-side trigger (teamAIcontroller.cpp:162-184, disabled) is still readable and worth porting: press when the opponent carrier has a free run (our closest player's distance to the midpoint of carrier-and-goal exceeds his by more than 3.2 m) or when he is within 20 m of the danger position (pitchHalfW*side, carrierY*0.5). It was disabled because it 'interferes with other defense AI code'.\nThe only live callers are humancontroller.cpp:218, 224 (and 462 for attacking runs).",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/teamAIcontroller.cpp:160-184, 913-932; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/elizacontroller.cpp:292-300; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/humancontroller.cpp:218, 224, 462",
    "portable": "partly",
    "priority": "low"
   },
   {
    "name": "Human gamer selection, switching and switch priority",
    "whatItDoes": "Everything in Team that manages which player a human controls: round-robin switch priority across multiple human gamers, auto-switch to the ball carrier, and the directional switch-target search. Pure controller-input plumbing.",
    "howItWorks": "Team holds humanGamers plus std::list<int> switchPriority (begin() == due next); SelectPlayer assigns to the front of the queue and rotates it (team.cpp:287-296); UpdateSwitch rotates the queue when the current human already controls the designated possession player and auto-selects the designated player when he gains unique possession or a set piece starts (team.cpp:508-545); the switch button handler with its extra hysteresis terms lives in Team::Process (team.cpp:360-394). AI_GetBestSwitchTargetPlayer picks a target from an action position blended between a defensive point (+4 m toward own goal, y*0.8, then 0.8/0.2 mixed with the team's designated player) and an offensive one (-8 m), weighted by a deliberately binarised offenseBias = clamp(pow(clamp((x-0.5)*2+0.5,0,1),1.5),0,1) (AIfunctions.cpp:996-1044).\nNote for porting: designatedTeamPossessionPlayer is written by SelectPlayer, so in an all-AI sim that write path simply disappears and the hysteresis in Team::Process becomes the sole author. The IsHumanControlled terms in that hysteresis (\u00d70.8, \u00f70.8) should be dropped.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:162-193, 274-310, 360-406, 508-545; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:996-1044; /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/humangamer.hpp",
    "portable": "no",
    "priority": "low"
   },
   {
    "name": "Deprecated AI_GetAdaptedInitialPos (ball-magnet formation mapping)",
    "whatItDoes": "The earlier, much simpler version of adaptive formation positioning, marked deprecated in the source. Worth knowing as a minimal baseline: a fixed-size rectangle that slides with the ball, plus a radial ball magnet.",
    "howItWorks": "AIfunctions.cpp:25-56. Fixed width 0.8, depth 0.4. focusPoint (defaults to ball.Predict(100)) is clamped to the pitch and normalized to [-1,1]. targetPos = formationPos*(depth, width) + (1-depth, 1-width)*scaledFocusPoint, then scaled up by (pitchHalfW, pitchHalfH). Then a magnet: if the ball is within ballMagnetDistance (default 50 m), add (ballPos - targetPos) * pow((ballMagnetDistance - dist)/ballMagnetDistance, ballMagnetDistancePow=1.5).\nThe production version replaced the fixed depth/width with possession-driven ones, the magnet with the microfocus curve, and added the x/y/midfield focuses.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:23-56",
    "portable": "yes",
    "priority": "low"
   }
  ]
 },
 {
  "subsystem": "Ball physics, the shared future-ball-position prediction array, and the two-phase \"growing circle\" time-to-ball / interception solver (GameplayFootball)",
  "mechanisms": [
   {
    "name": "Ball prediction array (300 slots, 10 ms apart, 3000 ms horizon)",
    "whatItDoes": "One array of future ball positions that every AI query reads, so no AI code ever integrates ball physics itself.",
    "howItWorks": "`Vector3 predictions[ballPredictionSize_ms / 10]` with `ballPredictionSize_ms = 3000` and `ballHistorySize_ms = 4000` \u2192 300 entries at exactly 10 ms spacing. Lookup is `Predict(ms)`: clamp `ms >= 3000` to 2990, then integer-divide by 10, index. Out-of-range queries silently return the last slot (goalie deliberately calls `GetBallPrediction(4000)` to mean \"final resting place\"). Array is filled by one loop of 300 sub-steps of `timeStep = 0.01f` seconds inside `CalculatePrediction()`. Your 4 Hz equivalent: 12 slots of 0.25 s, or keep an internal 10-40 ms sub-step and sample the array at your tick rate \u2014 the horizon (3 s) is the number that matters, not the resolution.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/gamedefines.hpp:56-57; ball.hpp:38-44,79; ball.cpp:159,167,510-519; goalie_default.cpp:220-225",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "The prediction IS the simulation (no separate physics step)",
    "whatItDoes": "Eliminates prediction/reality divergence: the ball advances by consuming its own forecast.",
    "howItWorks": "`Ball::Process()` calls `CalculatePrediction()`, which returns `BallSpatialInfo(newMomentum, newRotation_ms)` captured at `predictTime_ms == 10`. The ball's real state then becomes `momentum = spatialInfo.momentum; positionBuffer = Predict(10)`. So the entire 3 s forecast is recomputed from scratch every 10 ms tick, and slot [1] of that forecast is the new authoritative position. There is exactly one integrator in the codebase. Cost: 300 sub-steps per tick, once per match, not per player.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:137,521-525,530,565-570; match.cpp:881-882",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Event-driven prediction invalidation",
    "whatItDoes": "Any change to ball state immediately rebuilds the forecast and refreshes the newest AI snapshot, so a kick is visible to AI within one tick.",
    "howItWorks": "`CalculatePrediction()` is re-run inside `Touch()`, `SetMomentum()` and `SetRotation()`. `Touch()` additionally calls `match->UpdateLatestMentalImageBallPredictions()`, which does `mentalImages.at(0)->UpdateBallPredictions()` \u2192 a `memcpy` of the whole 300-entry array (`GetPredictionArray`). Only slot 0 (the freshest snapshot) is refreshed; older lagged snapshots keep the stale forecast on purpose, which is what produces \"players who haven't noticed the pass yet\".",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:82-84,91-103,114-117,130; match.cpp:647-649; mentalimage.cpp:83-85",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Quadratic air drag",
    "whatItDoes": "Slows the ball proportional to speed squared; gives long passes a realistic decay and caps effective ball speed.",
    "howItWorks": "`drag = 0.015f` (comment says previously 0.025). Per sub-step: `v = |momentum|; vDragged = v - drag * v^2 * dt; momentum = normalize(momentum) * vDragged`, applied to the full 3D vector including the vertical component, after `momentum.z += gravity * dt` with `gravity = -9.81f`. Implied terminal fall speed: sqrt(9.81/0.015) \u2248 25.6 m/s. Note the drag is applied to speed, not per-axis.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:25,28,175,180-182",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Ground/grass rolling resistance (quadratic + linear, depth-weighted)",
    "whatItDoes": "Stops a rolling ball in a finite distance instead of asymptotically, and makes grass bite harder the deeper the ball sits in it.",
    "howItWorks": "`friction = 0.04f` (quadratic), `linearFriction = 1.6f` (linear, m/s per second), `grassHeight = 0.025f`, ball radius 0.11. Active while `z < 0.11 + 0.025`. `ballBottom = z - 0.11; grassInfluenceBias = clamp(1 - ballBottom/0.025, 0, 1)^0.7` (the 0.7 exponent means half-submerged already gives >50% friction). Then on the 2D component only: `newVelo = velo - (friction*grassInfluenceBias) * velo^2 * dt`, then `newVelo = clamp(newVelo - linearFriction*grassInfluenceBias*dt, 0, inf)`. The linear term is what actually brings the ball to rest. For a headless 2D sim: drop `grassInfluenceBias` (always 1) and keep `v -= (0.04*v^2 + 1.6) * dt`.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:26-27,29,185-188,207-224",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Bounce: restitution plus a linear brake",
    "whatItDoes": "Kills the endless micro-bounce tail that pure coefficient-of-restitution produces.",
    "howItWorks": "When `z < 0.11` and `vz < 0`: `vz = -vz * bounce` with `bounce = 0.62f`, then `vz = max(vz - linearBounce, 0)` with `linearBounce = 0.06f`, then `z` is snapped to 0.11. The linear subtraction guarantees the ball stops bouncing in finite time. Impact hardness is captured as `frictionFactor = NormalizedClamp(-vz - 0.5, 0, 12)` and reused below to spike spin coupling on that one sub-step.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:23-24,194-202",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Spin \u2194 momentum coupling on the ground",
    "whatItDoes": "Backspin/sidespin makes a landing ball check, kick on, or squirt sideways; a rolling ball spins up to match its own velocity.",
    "howItWorks": "Two halves, both gated on `z < 0.11 + grassHeight`. (a) Friction-induced rotation: target roll rates `xR = vy/0.11, yR = vx/0.11`; the current spin quaternion is slerped toward that target, capped at `maxRotationChangePerSecond = 1.0*pi*grassInfluenceBias`, plus `4.0*pi` extra on an impact sub-step (`frictionFactor > 0`). (b) Rotation-induced momentum: `ballRotationMomentum = (spinY*0.11*1000, spinX*0.11*1000)`; then lerp `momentum.xy = momentum.xy*(1-rotBias) + ballRotationMomentum*rotBias` with `rotBias = 0.01f * grassInfluenceBias` (comment: lower == lighter ball, higher == more rubbery) plus `0.5f * frictionFactor` on impact, clamped 0..1. Needs a scalar/vector spin state you probably do not have; the cheap portable slice is only the impact term \u2014 on a bounce, blend the horizontal momentum toward the spin-implied velocity by up to 0.5.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:409-475",
    "portable": "partly",
    "priority": "low"
   },
   {
    "name": "Magnus swerve with a velocity-windowed strength curve",
    "whatItDoes": "Curves free kicks and crosses, and \u2014 the interesting part \u2014 makes swerve peak at mid speed rather than growing forever with pace.",
    "howItWorks": "`rotVec` = spin as Euler angles (radians per ms) `* 10.0f`. `swerveAmount = NormalizedClamp(|momentum|, 0, 70)` then `swerveAmount = fastpow(sin(swerveAmount * pi * 0.94f), 2.6f)` \u2014 a hump that rises from 0, peaks near 53% of 70 m/s (~37 m/s) and falls back toward 0 at the top end (the author links the Wolfram plot in a comment). Then `adapted = normalize(momentum) * swerveAmount * 30.0f; swerve = cross(adapted, -rotVec); momentum += swerve * dt`. Portable to 2D only if you carry a scalar spin; the reusable idea is the sin^2.6 speed window, which is what stops 100 mph shots from bending absurdly.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:480-495",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Woodwork and netting resolved on the first sub-step only",
    "whatItDoes": "Deflects the ball off posts/bar and absorbs it in the net \u2014 but deliberately does NOT propagate those collisions into the forecast.",
    "howItWorks": "Post/crossbar handling is wrapped in `if (firstTime && woodwork_enabled)` and `firstTime` is cleared at the end of sub-step 1; netting is `if (predictTime_ms <= 10)`. So slots 2..299 of the prediction array ignore the goal frame entirely \u2014 AI forecasts a shot passing straight through the post. Constants: `ballRadius = 0.11`, `postRadius = 0.07`, `postAbsorbInv = 0.8` (post restitution), reflection is `normalize(momentum2D reflected) + normal*1.1` renormalized; net absorb `0.95^(dt*100)` per step, `powFactor = 2.6`, `powerFac = 1.8` with `+3.0` extra tension near the woodwork. Pitch: `pitchHalfW = 55, pitchHalfH = 36, goalHalfWidth = 3.7, goalHeight = 2.5, goalDepth = 2.55`.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:163,226-233,238-330,404,527; gamedefines.hpp:271-279",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Two-phase growing-circle time-to-ball (AI_GetTimeNeededForDistance_ms)",
    "whatItDoes": "The core answer to \"how long until this player can touch a ball at this point?\", correctly penalising players who are running the wrong way.",
    "howItWorks": "Phase A, `t < changeTime_ms = 700`, stepped at 10 ms: the player is modelled as *drifting* on its existing momentum while a reachability circle grows around that drifting point. `bias = clamp(t/700, 0, 1)`; `currentMovement = playerMovement * (1 - bias)` (x/y only, hand-inlined to avoid temporaries); `currentPos += currentMovement * dt`; `radius += adaptedMaxVelocity * bias * dt` where `adaptedMaxVelocity = maxVelocity * 0.94f` (\"the last part of that velo is very hard to attain\"). Hit test each step: `if (|targetPos - currentPos| < radius) return t`. Phase B, once `bias >= 1` (t = 700 ms), closed form, no more stepping: `t = 700 + (|target - currentPos| - radius) / adaptedMaxVelocity * 1000`. Start position is offset by `ffo = 0.1f` m in front of the foot (along movement if `|movement| > idleDribbleSwitch = 1.8`, else toward the target) plus `movement * 0.01`. Concretely for maxVelocity 8 m/s: the circle is 0.28 m at t=0 and \u22482.91 m at t=700 ms (radius growth integrates to 0.94*8*0.35). This is the whole trick \u2014 momentum decays linearly over 700 ms while acceleration ramps in over the same 700 ms, so a sprinting player needs ~0.7 s before he can move at full speed in a new direction.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:499-617 (core loop 539-598); gamedefines.hpp:25",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Twin radii: \"usual\" vs \"optimistic\" reach, and the last-ditch test",
    "whatItDoes": "One call returns both a normal-control arrival time and a desperate-lunge arrival time; the gap between them is what licenses slide tackles.",
    "howItWorks": "`radius_usual = 0.28f` (\"leg extension length\") and `radius_optimistic = 0.9f` grow in lockstep at `adaptedMaxVelocity * bias * dt`. The loop records `optimistic_ms` the first time the optimistic circle covers the target and keeps going until the usual circle does; both are returned in `struct TimeNeeded {usual_ms, optimistic_ms}`. Consumer: `Player::AllowLastDitch()` returns true when `optimistic*1.7 + 800 < usual` \u2014 i.e. only lunge when a controlled arrival is hopeless but a stretch is not. The goalie's positioning solver uses `.optimistic_ms` exclusively.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.hpp:20-27; AIfunctions.cpp:532-534,558-561,583-586; player.cpp:128-131; goalie_default.cpp:31",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Distance early-out for the growing-circle solver",
    "whatItDoes": "Skips the whole iterative solve for far-away targets, which is most calls \u2014 this is what makes 22 players \u00d7 300 prediction slots affordable.",
    "howItWorks": "`optimizeDist = 16.0f`, raised to `48.0f` when `precise` is set. If `|playerPos - targetPos| > optimizeDist`, return the closed form immediately: `usual_ms = round(|targetPos - (playerPos + playerMovement*0.2f)| / (maxVelocity*0.75f) * 1000)` and `optimistic_ms = usual_ms - 200`. Note the 0.75 fudge (assume you average 75% of top speed over a long run) and the 0.2 s momentum lead. `precise` is passed true only for the team's currently designated possession player.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:503-512; player.cpp:171,175",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Per-player interception scan: coarse-to-fine with a refinement rewind",
    "whatItDoes": "Finds each player's earliest interceptable slot of the prediction array \u2014 the definition of `timeNeededToGetToBall_ms`.",
    "howItWorks": "In `Player::UpdatePossessionStats()`, walk `ms` from `startTime_ms` to 3000. For each slot with `Predict(ms).z < 1.5f` (reachable height), call the growing-circle solver against `Predict(ms).Get2D()` with `maxTime_ms = ms`; the first `ms` where `timeNeeded <= ms` is an intercept. Coarse step is adaptive and provably safe: `balldist = |playerPos - Predict(ms).2D| + 0.2f`, assume `maxBallVelo = 50` m/s, `timeStep_ms = clamp(balldist/50*1000, 10, 500)` floored to a multiple of 10 \u2014 the ball cannot possibly arrive sooner than that, so skipping is lossless. On the first hit the loop does NOT accept it: it rewinds `ms = previous_ms`, forces `timeStep_ms = 10`, sets `refine = true`, and rescans; the second hit is the answer. `startTime_ms = 500` if the player is mid pass/shot animation. Fallback when nothing is interceptable: `max(3000, |Predict(2990).2D - (pos + movement*0.2)| / (maxVel*0.75) * 1000)`. Final sub-resolution clamp: if the result is under `defaultTouchOffset_ms = 80`, replace it with `NormalizedClamp(|(pos + movement*0.08) - Predict(80).2D|, 0, 0.6) * 80` (\"apply quantum mechanics on the scale of the very small\") so near-identical players still rank against each other instead of tying at 0.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/player.cpp:150-252; gamedefines.hpp:64",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Time-to-ball rolls up to team and match possession state",
    "whatItDoes": "Every tactical decision in the game keys off one scalar per team, derived purely from time-to-ball.",
    "howItWorks": "`Team::UpdatePossessionStats()` sets `timeNeededToGetToBall_ms = min` over active players. `Match::CalculateBestPossessionTeamID()` compares the two team minima (equal \u2192 -1, contested). `AI_GetTeamPossessionFactor` maps the difference to 0..1: `factor = clamp((t_opp - t_own)/5000 * 0.5 + 0.5, 0, 1)`. Designated possession player switches with hysteresis: candidate replaces incumbent only if `(candidateTime + 10) / (designatedTime + 10) < 0.85f` \u2014 the +10 avoids divide-by-zero and the 0.85 stops flicker. `hasBestPossession = hasPossession && oppTeamTime > myTime`.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/team.cpp:488-506; match.cpp:898-921; AIfunctions.cpp:933-942; player.cpp:263-264",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "MentalImage: lagged snapshots as the AI's only view of the world",
    "whatItDoes": "Gives every player a reaction time without any per-player state machine, and is the sole route by which AI reads the ball forecast.",
    "howItWorks": "A ring of up to 30 snapshots (300 ms of history at 10 ms) pushed at the front each tick; each holds a full copy of the 300-slot ball prediction array plus every `PlayerImage`. `Match::GetMentalImage(history_ms)` indexes `round(history_ms/10)` and stamps `timeStampNeg_ms`. Reaction time: `IController::GetReactionTime_ms() = round(80.0f - stat(\"physical_reaction\") * 40.0f)` (40-80 ms), `+ (1 - matchDifficulty)*100` for AI-only teams, referee is flat 60, and it is forced to 0 for the player who last deliberately touched the ball. Two safety valves stop stale data becoming absurd: player positions are dead-reckoned forward by `movement * timeStampNeg_ms` then `EnforceMaximumDeviation` against reality at `maxDistanceDeviation = 2.5f` m and `maxMovementDeviation = walkVelocity (5.0)`; the ball prediction is likewise clamped to within 2.5 m of the true current forecast, so a sudden pass is misread for at most 2.5 m rather than 30.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/mentalimage.cpp:9-13,47-63,87-106; match.cpp:637-644,886-893; icontroller.cpp:14-16; playercontroller.cpp:24-29,41-44; refereecontroller.cpp:159-161",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Interception-point selection (AI_GetToBallMovement): rate every future slot, not just the earliest",
    "whatItDoes": "Chooses WHICH slot of the prediction array to run at, trading arrival time against approach angle \u2014 this is why players cut balls off instead of chasing them.",
    "howItWorks": "Scans `time_ms` from `startTime_ms` (the player's own `timeNeededToGetToBall_ms`, clamped 40..2990, reset to 80 if that slot is off the pitch) to 3000, skipping slots with `z >= 1.0f` (unattainable). Adaptive skip: `timeStep = clamp(round((timeNeeded_ms - time_ms) * 0.05f) - 5, 1, 10)` \u00d7 10 ms. Reachable slots (`timeNeeded <= time_ms`) get `rating = movementRating*movementWeight + timeRating*timeWeight + perpendicularRating*perpendicularWeight`, defaults `movementWeight = 1.0, timeWeight = 0.0, perpendicularWeight = 0.1`; with `haste > 0` it flips to `movementWeight = 0, timeWeight = 1`. `movementRating = 0.4*velocity-match + 0.6*direction-match`; `timeRating = 1 - NormalizedClamp(time_ms, 0, 5000)`; `perpendicularRating = 1 - NormalizedClamp(dist to the closest point on the 0\u21921000 ms ball line, 0, 2*sprintVelocity)`. Three `forced` conditions break the scan and commit: the slot is off-pitch, `dot(toTarget, ballDirection) > 0` (too shallow an angle, stop cutting and just go), or `justInTimeFactor = clamp(timeNeededToGetToBall / time_ms, 0, 1) < 0.35f` (this target wastes too much of the available time). Portability caveat: the 16-way direction quantization at the top of the function exists to serve PES6-style digital gamepad input and should be dropped.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:619-813 (weights 623-626, quantization 639-656, scan 724-813); gamedefines.hpp:28-29",
    "portable": "partly",
    "priority": "high"
   },
   {
    "name": "Velocity derived from the time budget, not from distance",
    "whatItDoes": "Makes players jog when they have time and sprint when they don't, without a separate urgency system.",
    "howItWorks": "After the target slot is chosen: `bestVelocityTimeBased = clamp((timeNeeded_ms / time_ms) * player->GetMaxVelocity(), idleVelocity, sprintVelocity)` \u2014 the ratio of \"how long I need\" to \"how long I have\" scales top speed directly. Alternatives kept but unused: `bestVelocityRelaxed` (adds `defaultTouchOffset_ms = 80` to the numerator) and `bestVelocityASAP = clamp(distance * distanceToVelocityMultiplier, ...)` with `distanceToVelocityMultiplier = 2.6f` (\"to travel 4 m, go at velo 4*2.6\"). Smoothing: if `time_ms > 250`, `v = v*0.97 + currentVelocity*0.03`. Speed ladder: `idle 0, dribble 3.5, walk 5.0, sprint 8.0`; per-player top speed is `sprintVelocity * (0.9f + stat(\"physical_velocity\") * 0.1f)`, i.e. only a 10% spread between the slowest and fastest player in the game.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:827-838; playerbase.cpp:131-139; gamedefines.hpp:18-21,54",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "CalculateBestAchievableTarget: walk a line, take the first point you can reach in time",
    "whatItDoes": "Generic \"how far along my ideal path can I actually get\" solver; used by the keeper to pick a rush-out point between his line position and the ball.",
    "howItWorks": "Given (pos1, time1_sec) and (pos2, time2_sec), step `percentage` from 0 to 1 with `stepSize = 1 / clamp(|pos1-pos2| * 4.0f, 1, 20)` (4 steps per metre, 20 steps max). At each step lerp both position and time, call the growing-circle solver for `optimistic_ms`, and return the first `checkPos` where `timeNeeded*0.001 <= checkTime_sec`. Falls through to `pos2`. Cheap and directly reusable for \"where do I meet this pass\" and \"how far up can I press\".",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/controller/strategies/offtheball/goalie_default.cpp:20-39,45",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "AI_HasPossession: a possession test with a movement-agreement term",
    "whatItDoes": "Decides who \"has\" the ball; refuses possession to a player the ball is merely passing through.",
    "howItWorks": "Early-out if `|playerPos - Predict(0)| > 5.0` or `Predict(0).z > 0.5`. Then two conditions, both required: (a) distance \u2014 ball within `radius = 1.0f` m of `center = playerPos + movement*0.05f + directionVec*0.1f` (biased in front of the player); (b) movement agreement \u2014 `ballMovement3D = (Predict(10) - Predict(0)) * 100.0f` and `|ballMovement3D - playerMovement| <= 6.0f` m/s. Condition (b) is the good part: a ball rolling past at speed fails it even at zero distance. Overridden entirely when a `ballRetainer` is set (keeper holding it), which also pins `timeNeededToGetToBall_ms = 1`.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/AIsupport/AIfunctions.cpp:911-931; player.cpp:266-277",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Smoothed ball position as the team-shape focal point",
    "whatItDoes": "Stops the whole defensive block twitching every time the ball is kicked; team shape follows a lagged average, individuals follow the live prediction.",
    "howItWorks": "`Ball::GetAveragePosition(duration_ms)` averages the last `duration_ms/10` entries of `ballPosHistory` (capped at `ballHistorySize_ms = 4000`). The team AI uses different windows per axis and scales them by urgency: `ballX = GetAveragePosition(3500 * (1 - urgencyBias*0.7))`, `ballY = GetAveragePosition(4000 * (1 - urgencyBias*0.5))`, and the focal point blends `GetAveragePosition(3000)` when in possession against `GetAveragePosition(2000)*0.5 + focalPoint*0.5` when not. The referee uses a 2000 ms window. Two different time constants for the same ball \u2014 long for shape, ~0 for the man chasing it \u2014 is the mechanism worth stealing.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:533-545,572-573; teamAIcontroller.cpp:289-290,325-326; refereecontroller.cpp:27",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Animation touch-frame override of time-to-ball",
    "whatItDoes": "Overrides the computed arrival time with the exact frame the current animation will contact the ball.",
    "howItWorks": "`if (TouchAnim() && TouchPending()) { animTimeToBall_ms = (GetTouchFrame() - GetCurrentFrame()) * 10; timeNeededToGetToBall_ms = min(timeNeededToGetToBall_ms, animTimeToBall_ms); }`. Pure animation-blend bookkeeping \u2014 there is no touch frame in a sim without animations. The related `defaultTouchOffset_ms = 80` (\"how far into an animation the ball is usually touched\") is worth keeping though, reinterpreted as a flat contact latency.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/player/player.cpp:242-246; gamedefines.hpp:63-64",
    "portable": "no",
    "priority": "low"
   },
   {
    "name": "TemporalSmoother put/fetch buffers",
    "whatItDoes": "Decouples the 10 ms physics tick from the render frame by interpolating ball position and orientation.",
    "howItWorks": "`PreparePutBuffers(snapshotTime_ms)` writes `positionBuffer`/`orientationBuffer` into `TemporalSmoother` at the sim timestamp; `FetchPutBuffers(putTime_ms)` samples it at the render timestamp; `Put()` pushes the result into the scene graph geometry. `temporalSmoother_history_ms = 20`. Exists only to serve rendering \u2014 a headless sim reads `positionBuffer` directly.",
    "where": "/private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf/src/onthepitch/ball.cpp:581-594; ball.hpp:54,86-92; gamedefines.hpp:68",
    "portable": "no",
    "priority": "low"
   }
  ]
 },
 {
  "subsystem": "Player locomotion / steering physics in GameplayFootball (root: /private/tmp/claude-505/-Users-zli-Documents-NICHIRIN/cc5fe55a-1593-4005-8fc3-e6a7007223d3/scratchpad/gf). The whole locomotion model lives in one function, HumanoidBase::CalculatePhysicsVector (humanoidbase.cpp:2015-2516): a desired direction+speed goes in, a per-10ms integrated position path comes out, constrained by a stack of caps (turn rate, delta-velocity, acceleration falloff). Everything else (playerbase.cpp, player.cpp, humanoid_utils.cpp) supplies the per-player stat scaling and the velocity quantisation vocabulary it operates in.",
  "mechanisms": [
   {
    "name": "Substepped decision integration (10ms inner loop)",
    "whatItDoes": "A movement decision is not applied as one big step. The engine picks a target, then integrates the entire path forward in fixed 10ms substeps applying every constraint per substep, caches the resulting positions, and replays them until the next decision.",
    "howItWorks": "const int timeStep_ms = 10 (humanoidbase.cpp:2071). Loop `for (time_ms = 0; time_ms < anim->GetFrameCount()*10; time_ms += timeStep_ms)` (2192). Each substep computes toDesired = resultingPhysicsMovement - temporalMovement, applies the cornering/maxChange/air-resistance caps to toDesired, then temporalMovement += toDesired and currentPosition += temporalMovement * (timeStep_ms/1000) (2451). Positions pushed to positions_ret every 10ms (2454-2456). Decisions happen only at path end or on interrupt (Process, humanoidbase.cpp:593-594).",
    "where": "humanoidbase.cpp:2071, 2192, 2280, 2448-2456; humanoidbase.cpp:570-671 (Process)",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Per-player max velocity from physical_velocity",
    "whatItDoes": "Sets each player's top speed as a narrow band off a global sprint constant.",
    "howItWorks": "GetMaxVelocity() = sprintVelocity * GetVelocityMultiplier(); GetVelocityMultiplier() = 0.9f + GetStat(\"physical_velocity\") * 0.1f. With sprintVelocity = 8.0 m/s, a 0.0-stat player tops out at 7.2 m/s and a 1.0-stat player at 8.0 m/s \u2014 only an 11% spread. Reduced a further 8% while touching the ball: `if (touch) maxVelocity *= 0.92f` (humanoidbase.cpp:2067).",
    "where": "playerbase.cpp:131-139; gamedefines.hpp:21; humanoidbase.cpp:2066-2067",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Four-tier velocity quantisation with hysteresis-style switch points",
    "whatItDoes": "All speed reasoning happens in four discrete classes (idle/dribble/walk/sprint) with switch thresholds that sit between the class values, not at them.",
    "howItWorks": "Class values: idleVelocity 0.0, dribbleVelocity 3.5, walkVelocity 5.0, sprintVelocity 8.0. Switch points: idleDribbleSwitch 1.8, dribbleWalkSwitch 4.2, walkSprintSwitch 6.0 (gamedefines.hpp:18-27). RangeVelocity(v) snaps a float to the class value using the switch points; FloatToEnumVelocity(v) = class id of RangeVelocity(v); EnumToFloatVelocity goes back; ClampVelocity clamps 0..8; FloatVelocity 0..3 ids via GetVelocityID (utils.cpp:81). Note the asymmetry: 3.6 m/s snaps to dribble (3.5) but 4.3 snaps to walk (5.0) \u2014 the switch points are deliberately not midpoints.",
    "where": "gamedefines.hpp:18-27, 86-91; animcollection.hpp:57-104; utils.cpp:81-95",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Speed-increase-only acceleration cap with velocity-dependent falloff (\"air resistance\")",
    "whatItDoes": "The core acceleration model. Caps how fast you can gain speed, with the cap decaying to zero as you approach your personal max velocity \u2014 but leaves turning and braking uncapped by this rule.",
    "howItWorks": "Runs only when (temporalMovement + toDesired).GetLength() > falloffStartVelo (= idleDribbleSwitch = 1.8). accelPower = 11.0f * accelerationMultiplier where accelerationMultiplier = 0.5f + _cache_AccelerationFactor and _default_AccelerationFactor = 0.5 \u2192 accelPower = 11.0 m/s^2 by default. accelPower *= 1.0f - difficultyPenaltyFactor*0.4f. veloAirResistanceFactor = clamp(pow(clamp((|v| - 1.8)/(maxVelocity - 1.8), 0, 1), 1.8f), 0, 1). maxAccelerationMPS = accelPower * (1 - veloAirResistanceFactor) * (stat_acceleration*0.3f + 0.7f) \u2014 so the acceleration stat only spans 0.7x..1.0x. Crucially the cap applies ONLY to the component that grows |v|: if |v+toDesired| > |v|, forwardVector = normalize(v+toDesired) * (|v+toDesired| - |v|); if |forwardVector| exceeds maxAccelerationMPS*(dt), only that component is scaled back (toDesired -= forwardVector*(1-remainingFactor)). Pure direction change costs nothing here.",
    "where": "humanoidbase.cpp:2387-2423 (accel core), 2144 (accelerationMultiplier), 2076 (difficultyPenaltyFactor), gamedefines.hpp:44 (_default_AccelerationFactor)",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Velocity-dependent turning circle (mod_MaxCornering)",
    "whatItDoes": "The turning-circle constraint. Limits the per-substep heading change, tightening as speed rises, and enforces it by bleeding speed rather than by refusing to turn.",
    "howItWorks": "Active only when both |v| and |v+toDesired| exceed startVelo = idleDribbleSwitch (1.8). angle = angle between predicted and current movement. maxAngleFactor = 1.0f * (timeStep_ms/1000.0f); maxAngleFactor *= (0.7f + 0.3f*stat_agility); if (!touch) maxAngleFactor *= 1.5f; maxAngle = maxAngleFactor * pi; then maxAngle /= (veloFactor + 0.01f) where veloFactor = clamp(|v|/sprintVelocity, 0, 1). So at 10ms, full agility, no ball: maxAngle = 0.015*pi / (|v|/8) rad per 10ms \u2014 i.e. ~4.7 rad/s at 8 m/s, ~9.4 rad/s at 4 m/s: turn rate is inversely proportional to speed. Enforcement uses mode 1 (mode 0 is dead code): overAngle = |angle| - maxAngle; toDesired += -temporalMovement * clamp(overAngle/pi*3.0f, 0, 1) \u2014 an over-tight turn scrubs velocity off, up to a full stop.",
    "where": "humanoidbase.cpp:2322-2349; flag set at 2139",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Per-substep delta-velocity cap (mod_MaxChange)",
    "whatItDoes": "A hard limit on how much the velocity vector can change per substep in any direction, ramped in at the start of a movement and reduced at high speed.",
    "howItWorks": "maxChange = 0.03f base (units: m/s per ms \u2192 30 m/s^2). *0.7 for trip anims, =0.1 for sliding. Ramp-in: veloFactor = pow(clamp(|v|/sprintVelocity,0,1), 1.5f); firstStepFactor = veloFactor (*0.4 for plain movement); maxChange *= (1-firstStepFactor) + firstStepFactor * curve(NormalizedClamp(time_ms, 0, 160), 1.0f) \u2014 i.e. the first ~160ms of a movement has reduced authority, more so if you were already fast. Then maxChange *= 1.2f - veloFactor*0.4f (less authority at speed), *= 0.75f + _cache_AgilityFactor*0.5f (global agility knob, default 0.5 \u2192 1.0), *= powerFactor. Applied as maxAddition = maxChange * timeStep_ms; toDesired.NormalizeMax(min(|toDesired|, maxAddition)) \u2192 0.3 m/s max change per 10ms at defaults.",
    "where": "humanoidbase.cpp:2351-2382; flag at 2140; _default_AgilityFactor = 0.5 at gamedefines.hpp:43",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "powerFactor: contact and recent-touch degradation of steering authority",
    "whatItDoes": "Scales down the delta-velocity cap when the player has just touched the ball or is being physically jostled \u2014 the model for losing your footing.",
    "howItWorks": "powerFactor = 1.0f - clamp(fastpow(player->GetLastTouchBias(1000), 0.8f) * (0.8f - stat_dribble*0.3f), 0.0f, 0.4f) \u2014 up to 40% loss right after a touch, decaying linearly over 1000ms, mitigated by technical_dribble. Then powerFactor *= 1.0f - clamp(|decayingPositionOffset| * (10.0f - stat_balance*5.0f) - 0.1f, 0.0f, 0.3f) \u2014 up to a further 30% loss from being pushed, mitigated by physical_balance. GetLastTouchBias(decay_ms) = 1 - clamp((now - lastTouchTime)/decay_ms, 0, 1) (playerbase.cpp:141-146). powerFactor multiplies maxChange at humanoidbase.cpp:2376.",
    "where": "humanoidbase.cpp:2078-2080, 2376; playerbase.cpp:141-146",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Decaying position offset (being pushed / physical contest)",
    "whatItDoes": "External shoves accumulate into a small clamped offset that decays exponentially and degrades both steering authority and ball control while it lasts.",
    "howItWorks": "OffsetPosition(offset) adds to nextStartPos, startPos, spatialState.position, and decayingPositionOffset, then clamps: `if (decayingPositionOffset.GetLength() > 0.1f) decayingPositionOffset = normalized * 0.1f` \u2014 max 10cm. Per Process tick: decayingPositionOffset *= 0.95f, zeroed below 0.005 (\u2248 half-life 135ms at 10ms ticks; at 250ms ticks use ~0.28 per tick for the same decay). Consumed by powerFactor (2080) and by ball-control difficulty (humanoid_utils.cpp:142: positionOffsetPenalty = NormalizedClamp(|offset|, 0, 0.1) * 2.0).",
    "where": "humanoidbase.cpp:1028-1044, 575-576; humanoid_utils.cpp:142",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Cornering brake bias \u2014 aim slower into sharp turns",
    "whatItDoes": "A compact rule that reduces the target speed as a function of how sharp the turn is and how fast you are already going. Used to bias the choice of movement toward braking before cornering.",
    "howItWorks": "CalculateBiasForFastCornering(currentMovement, desiredMovement, veloPow, bias): angle = angle between desired and current; currentMovementBias = sin(|angle| - 0.5*pi)*0.5 + 0.5 (0 for straight ahead, 1 for a 180); velocityBias = pow(clamp(|current| / (sprintVelocity - 0.5f), 0, 1), veloPow) \u2014 i.e. |v|/7.5; total = velocityBias * currentMovementBias * bias. Called with veloPow=1.0, bias=0.9 (humanoidbase.cpp:1824). Applied as desiredMovement = desiredMovement * (1.0f - corneringBias) (humanoidbase.cpp:1845): a full-speed 180 collapses the target speed to near zero.",
    "where": "humanoid_utils.cpp:41-54; humanoidbase.cpp:1819-1825, 1845",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Capped heading rotation per decision, with a hard 90-degree rejection",
    "whatItDoes": "Limits how far a single movement decision can rotate the player away from the heading they were already committed to, and refuses turns beyond 90 degrees outright.",
    "howItWorks": "toDesiredAngle = angle from committed outgoing vector to desired vector. `if (fabs(toDesiredAngle) <= 0.5f*pi || sliding)` \u2014 beyond 90 degrees the whole option is skipped. Caps: maxAngleMod_underAnimAngle / overAnimAngle / straightAnimAngle all default 0.125f*pi (22.5 degrees). For ball-touch movements: bonus = 1.0f - pow(NormalizedClamp((|v_in| + |v_out|)*0.5f, 0, sprintVelocity), 0.8f)*0.8f, bonus *= 0.6f + 0.4f*technical_ballcontrol; then under=0.2*pi*bonus, over=0, straight=0.1*pi*bonus (so you can turn further INTO the direction the movement already curves, not further past it). Sliding gets 0.5*pi all round. The capped angle is then applied progressively across the path: resultingPhysicsMovement.GetRotated2D(toDesiredAngle_capped * frameBias) (2270).",
    "where": "humanoidbase.cpp:2099-2113, 2149-2172, 2270",
    "portable": "partly",
    "priority": "high"
   },
   {
    "name": "lagExp \u2014 agility as an easing exponent on when the turn happens",
    "whatItDoes": "Controls whether a player's direction change is front-loaded (agile, pointy) or trails through the movement (sluggish), without changing the endpoint.",
    "howItWorks": "frameBias = (time_ms + 10) / ((effectiveFrameCount + 1) * 10) \u2014 linear 0..1 progress. lagExp = 1.4f - _cache_AgilityFactor*0.8f; lagExp *= 1.2f - stat_agility*0.4f; then += (-0.1 + clamp(difficultyFactor*0.4, 0, 0.5)) on touches, or (-0.2 + clamp(difficultyFactor*0.2, 0, 0.2)) otherwise; clamped to 0.25..4.0; forced >= 0.7 before the touch frame. adaptedFrameBias = pow(frameBias, lagExp) and the movement is sampled at that warped progress. lagExp < 1 = front-loaded turn, > 1 = trailing. Only active for ballcontrol and movement types (mod_PointinessCurve, true).",
    "where": "humanoidbase.cpp:2136, 2197, 2199-2215",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "maxSlower / maxFaster \u2014 asymmetric speed deviation from the committed profile",
    "whatItDoes": "Bounds how much the resolved speed may deviate below or above the speed the player committed to, with a strong bias against speeding up mid-movement.",
    "howItWorks": "maxSlower = 1.6f m/s (1.2f when touching the ball) \u2014 commented rationale: \"don't want to end up below dribbleVelocity - idleDribbleSwitch (= change velocity)\", i.e. never fall through a whole velocity class. maxFaster = 0.0f by default; only if you are ALREADY faster than the profile: maxFaster = min(1.0f*(1 - frameBias), max(0, |v| - profileSpeed)) \u2014 and then maxFaster *= max(0, dot(profileDirection, desiredDirection)) so you only keep the excess if it is in the direction you want. Sliding gets maxFaster = 100. Applied as adaptedAnimVelo = clamp(desiredVelocity, adaptedAnimVelo - maxSlower, adaptedAnimVelo + maxFaster).",
    "where": "humanoidbase.cpp:2234-2243",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "StretchSprintTo \u2014 remap only the band above walk/sprint switch",
    "whatItDoes": "Rescales a reference speed profile onto a player's personal max velocity without touching sub-sprint speeds, so slow and fast players walk identically and differ only when sprinting.",
    "howItWorks": "if (inputVelocity < walkSprintSwitch) return inputVelocity unchanged. Else howMuchSprintage = inputVelocity - walkSprintSwitch (6.0); toNewFactor = (targetMaxVelocity - 6.0) / (inputSpaceMaxVelocity - 6.0); return 6.0 + howMuchSprintage*toNewFactor. Called with inputSpaceMaxVelocity = animSprintVelocity (7.0, gamedefines.hpp:23) inside the physics loop (humanoidbase.cpp:2227) and with sprintVelocity (8.0) when scaling ball-control target speed (humanoid_utils.cpp:213). Applied only when the source speed is above walkSprintSwitch and only to speed up, never slow down: `if (maxVelocity > animVelo)`.",
    "where": "humanoid_utils.cpp:117-132; humanoidbase.cpp:2224-2231; humanoid_utils.cpp:213",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Velocity-class snapping at decision boundaries",
    "whatItDoes": "At the end of a movement, forces the resulting speed to be in the same velocity class the player committed to \u2014 no in-between speeds are carried across a decision boundary.",
    "howItWorks": "In the last 2 frames (`if (time_ms >= (anim->GetFrameCount() - 2) * 10)`), hardQuantize = true: if the committed outgoing class is Idle but the physics speed is not, movement is set to zero outright; if the committed class is non-Idle but physics went Idle, movement is renormalised to dribbleVelocity (3.5) along the committed direction. A soft variant exists (normalise to idleDribbleSwitch +/- 0.01) but is disabled.",
    "where": "humanoidbase.cpp:2431-2445",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Heading falls back to facing below idle threshold",
    "whatItDoes": "Prevents heading jitter at near-zero speed by deriving direction from body facing rather than from the velocity vector.",
    "howItWorks": "floatVelocity = |movement|; enumVelocity = FloatToEnumVelocity(floatVelocity). `if (enumVelocity != e_Velocity_Idle) directionVec = movement.GetNormalized(); else directionVec = bodyDirectionVec;` \u2014 i.e. below idleDribbleSwitch (1.8 m/s) the velocity vector is not trusted as a heading. angle = ModulateIntoRange(-pi, pi, FixAngle(directionVec.GetAngle2D())).",
    "where": "humanoidbase.cpp:1671-1682",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Body-angle / speed compatibility clamp (no sprinting sideways)",
    "whatItDoes": "Enforces that facing and movement direction are physically compatible: you cannot sprint while facing sideways, and cannot walk while facing backwards.",
    "howItWorks": "bodyAngleRel = angle between body direction and movement direction. If enumVelocity == Sprint and |bodyAngleRel| >= 0.125f*pi (22.5 deg): with preferCorrectVeloOverCorrectAngle = true, body angle is snapped to 0.12f*pi*sign; the disabled alternative drops speed to walkSprintSwitch - 0.1. If enumVelocity == Walk and |bodyAngleRel| >= 0.5f*pi (90 deg): body angle snapped to 0.495f*pi*sign (else speed dropped to dribbleWalkSwitch - 0.1).",
    "where": "humanoidbase.cpp:1684-1713",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Direction quantisation into preferred / allowed angle sets",
    "whatItDoes": "Snaps headings and facings to a small discrete set of relative angles, which is what gives the movement its stepped, readable character rather than continuous drift.",
    "howItWorks": "preferredDirectionVecs / preferredDirectionAngles: 0, +/-0.111*pi (20 deg), +/-0.25*pi (45), +/-0.5*pi (90), +/-0.75*pi (135), +/-0.999*pi (180) \u2014 11 entries. allowedBodyDirVecs / allowedBodyDirAngles are coarser: 0, +/-0.25*pi, +/-0.75*pi only (5 entries). ForceIntoPreferredDirectionVec / ForceIntoAllowedBodyDirectionVec pick the entry with the highest dot product; the *Angle variants pick the smallest absolute difference. relBodyDirectionVec is stored quantized while relBodyDirectionVecNonquantized keeps the raw value (1715-1716). Separately, QuantizeDirection(dir, bias) snaps the desired direction to N=8 compass points and lerps by bias \u2014 but _default_QuantizedDirectionBias = 0.0f, so it is a no-op at factory settings.",
    "where": "humanoidbase.cpp:64-98, 1716, 2519-2578; utils.cpp:18-33; gamedefines.hpp:29, 41",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Time-to-reach-target model with momentum decay",
    "whatItDoes": "The interception/possession estimator: how long until this player can reach a point, accounting for the momentum they must shed first. Everything about who chases the ball keys off this.",
    "howItWorks": "Coarse closed form (used beyond 16m, or 48m if precise): timeNeeded_ms = |target - (pos + movement*0.2f)| / (maxVelocity*0.75f) * 1000. Fine model: adaptedMaxVelocity = maxVelocity * 0.94f (\"the last part of that velo is very hard to attain due to exponential air resistance\"); changeTime_ms = 700; per 10ms step bias = clamp(t/700, 0, 1); currentMovement = playerMovement * (1 - bias) (old momentum decays linearly over 700ms); currentPos += currentMovement*dt; and a reach radius grows: radius += adaptedMaxVelocity * bias * dt, starting at radius_usual = 0.28f (leg extension) and radius_optimistic = 0.9f. Once bias hits 1.0 it closes the form: t + (distance - radius)/adaptedMaxVelocity. Player::UpdatePossessionStats walks ball predictions in adaptive steps (timeStep = clamp(ballDist/50 * 1000, 10, 500), rounded to 10s) and re-refines at 10ms once a hit is found.",
    "where": "player.cpp:157, 173-240; AIfunctions.cpp:499-600",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Time needed to change movement",
    "whatItDoes": "A cheap scalar estimate of how long a given velocity change will take, used to reason about whether a manoeuvre is worth attempting.",
    "howItWorks": "time_ms = NormalizedClamp(|desiredMovement - currentMovement|, idleVelocity, sprintVelocity*2.0f) * 1000 \u2014 i.e. the delta mapped over 0..16 m/s onto 0..1000ms. Then currentVeloFactor = 1.0f - NormalizedClamp(|currentMovement|, idleVelocity, sprintVelocity) and time_ms *= 1.0f + currentVeloFactor \u2014 starting from standstill doubles the cost, starting at full sprint does not. Author's note: \"this function is quick 'n dirty... just don't expect exact results\".",
    "where": "humanoid_utils.cpp:28-39",
    "portable": "yes",
    "priority": "medium"
   },
   {
    "name": "Fatigue accrual by distance covered, applied to every stat read",
    "whatItDoes": "Distance run degrades a single fatigue scalar, and that scalar multiplies every stat the player reads \u2014 including velocity, acceleration and agility \u2014 so tired players are measurably slower and less agile.",
    "howItWorks": "Per tick: distance = |posAfter - posBefore|; fatigueFactorInv -= distance * 0.00003f * (2.0f - GetStaminaStat()) * (1.0f / match->GetMatchDurationFactor()); clamped to 0.01..1.0. Recovery: RelaxFatigue(x) adds x, same clamp (playerbase.hpp:92). Consumption: Player::GetStat multiplies every stat by (0.7f + 0.3f * GetFatigueFactorInv()) \u2014 so full exhaustion costs 30% of every attribute. A separate team multiplier applies for AI-only teams: multiplier = 0.3f + 0.7f * GetMatchDifficulty(). averageStat (playerbase.cpp:26-48) is the unweighted mean of 22 named stats.",
    "where": "player.cpp:313-315, 510-524; playerbase.hpp:91-92; playerbase.cpp:26-48",
    "portable": "yes",
    "priority": "high"
   },
   {
    "name": "Velocity as unsmoothed finite difference at handoff points",
    "whatItDoes": "Defines how velocity is measured from a position path, and deliberately refuses to smooth the value that gets handed to the next decision.",
    "howItWorks": "CalculateMovementAtFrame(positions, frameNum, smoothFrames): movement = (positions[f] - positions[f-1]).Get2D() * 100.0f (100 = 1/0.01s), averaged over the +/-smoothFrames window. Two special cases override the smoothing: at the last frame it returns the raw single-frame difference, with the comment \"we don't want the wrong quantized velocity\"; at frame 0 it uses 0->1 instead of -1->0. CalculateOutgoingMovement does the same on the last pair. spatialState.actualMovement = (position - previousPosition2D) * 100.0f, then physicsMovement subtracts the non-physical offsets (action smuggle, movement smuggle, and 0.5x the position offset) and is used as the default .movement.",
    "where": "humanoid_utils.cpp:56-88; humanoidbase.cpp:1618-1621, 1643-1656",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Which constraint stack is actually switched on",
    "whatItDoes": "Half the constraint machinery in CalculatePhysicsVector is dead at ship. Porting the disabled ones reproduces behaviour the author rejected.",
    "howItWorks": "ON: mod_AllowRotation, mod_PointinessCurve, mod_MaxCornering, mod_MaxChange, mod_AirResistance. OFF: mod_CorneringBraking (the explicit brake-into-corner speed cap at 2177-2188 and 2245-2251 never runs), mod_MaximumAccelDecel (the flat +/-20 m/s^2 clamp at 2253-2265 never runs \u2014 the air-resistance model supersedes it, per the comment \"decided to not let them live together\"), mod_BrakeOnTouch (the 15-frame post-touch braking at 2290-2307), mod_CheatBodyDirection (2479-2511). physicsBias per movement class: movement/ballcontrol/trap/sliding = 1.0, interfere = 0.5, trip type 1 = 0.5, and shortpass/highpass/shot/deflect/special = 0.0 \u2014 a shot or pass ignores the physics solver entirely and plays its canned motion.",
    "where": "humanoidbase.cpp:2134-2142 (flags), 2097, 2115-2132 (physicsBias), 2253-2265, 2177-2188",
    "portable": "partly",
    "priority": "medium"
   },
   {
    "name": "Non-portable: animation selection machinery",
    "whatItDoes": "The bulk of humanoidbase.cpp exists to pick and blend a motion-capture clip. None of it survives into a headless sim, but it is worth naming so it is not mistaken for gameplay logic.",
    "howItWorks": "SelectAnim runs a crude query then a stack of stable_sorts on similarity predicates (foot, incoming velocity, incoming body direction, movement, look direction, base-anim, trip direction, an \"idlelevel\" numeric var), then _KeepBestDirectionAnims prunes everything outside the winner's quadrant_id. Also non-portable: rotationSmuggle / actionSmuggle / movementSmuggle (position and angle fudge applied across a clip to hide mismatch: bodyRotationSmoothingMaxAngle = 0.25*pi, bodyRotationSmoothingFactor = 1.0, humanoidbase.cpp:24-25), the requeue-delay logic (initialReQueueDelayFrames = 32, humanoidbase.cpp:26, 665-667), quadrant rejection on requeue (1538-1554), and all the Put/PreparePutBuffers/TemporalSmoother render-thread buffering. The one transferable idea inside it: GetMovementSimilarity scores a candidate as |desiredMovement*(1-corneringBias) - outgoingMovement| minus |dot(desiredDir, outgoingDir)|*4.0 \u2014 a distance-in-velocity-space cost with an explicit bonus for straight lines.",
    "where": "humanoidbase.cpp:1104-1230, 1375-1602, 1776-2013, 24-26, 717-803",
    "portable": "no",
    "priority": "low"
   }
  ]
 }
]
```