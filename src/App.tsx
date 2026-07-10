import { useState, useCallback, useRef, useEffect, useMemo, Fragment } from "react";
import headerImg from "./header.png";
import aviumTSV from "./presets/avium.tsv?raw";
import nl1TSV from "./presets/nl1.tsv?raw";
import ligaTSV from "./presets/liga-ye-melli.tsv?raw";
import plTSV from "./presets/premier-league.tsv?raw";
import miscEuTSV from "./presets/misc-european.tsv?raw";
import nl2TSV from "./presets/nl2.tsv?raw";
import kplTSV from "./presets/kpl.tsv?raw";
import kullanmaanTSV from "./presets/kullanmaan-cup.tsv?raw";

// ═══ RNG ═════════════════════════════════════════════════════════════════════
class RNG {
  constructor(seed) { this.s = seed || Date.now(); }
  next() { this.s = (this.s * 1664525 + 1013904223) & 0xffffffff; return (this.s >>> 0) / 0xffffffff; }
  u() { return this.next(); }
}
const pick = (rng, a) => a[Math.floor(rng.u() * a.length)];
const pickWeighted = (rng, items, weights) => { const t = weights.reduce((a,b)=>a+b,0); let r = rng.u() * t; for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; } return items[items.length-1]; };
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? k);
const INJ_SEV = [{id:"bruise",label:"Bruise",dur:[1,1]},{id:"sprain",label:"Sprain",dur:[1,2]},{id:"fracture",label:"Fracture",dur:[3,5]},{id:"tear",label:"Tear",dur:[4,7]}];
const INJ_SEV_W = [40,30,15,15];
const INJ_PART = ["upper leg","knee","lower leg","groin","foot","head","shoulder","ribs"];
const INJ_PART_W = [22,20,20,12,8,8,5,5];
// Sprains and tears need a joint/long muscle to injure — the head and ribs don't have
// either in footballing terms, so those two severities are excluded for those parts.
const INJ_PART_SEV_EXCLUDE = { head: ["sprain", "tear"], ribs: ["sprain", "tear"] };
function pickInjury(rng) {
  const part = pickWeighted(rng, INJ_PART, INJ_PART_W);
  const exclude = INJ_PART_SEV_EXCLUDE[part] || [];
  const sevItems = INJ_SEV.filter(s => !exclude.includes(s.id));
  const sevWeights = INJ_SEV_W.filter((_, i) => !exclude.includes(INJ_SEV[i].id));
  const sev = pickWeighted(rng, sevItems, sevWeights);
  return { sev, part };
}
// DOGSO (denying an obvious goalscoring opportunity) is almost always the last line of
// defence — defenders and keepers commit it far more than midfielders, and forwards
// almost never end up as the last man back.
const DOGSO_PROB = { GK: 0.55, DEF: 0.55, MID: 0.15, FWD: 0.03 };
function pickRedCardVariant(rng, pos) {
  const dogsoP = DOGSO_PROB[pos] ?? 0.15;
  const vr = rng.u();
  if (vr < dogsoP) return "dogso";
  const rem = (vr - dogsoP) / (1 - dogsoP);
  return rem < 0.5 ? "violent" : rem < 0.7 ? "abusive" : "sfp";
}
const TIER_CONV = [1.0, 1.08, 1.18];
const TIER_ATK_W = [1.0, 1.25, 1.6];
const TIER_GK_SAVE = [0, 0.035, 0.07];
// Applied when a team has no recognized keeper left and an outfield player has taken the
// gloves — moved straight from save-probability into goal-probability, so shots that would
// have been stopped by a real keeper go in instead, rather than just becoming off-target misses.
const EMERGENCY_GK_SAVE_PENALTY = 0.22;
const TIER_DEF_SHOT = [0, 0.02, 0.04];
const TIER_PEN = [0, 0.05, 0.12];
const TIER_MID_CTRL = [0, 0.015, 0.03];

// ═══ LIVE MATCH ENGINE ═══════════════════════════════════════════════════════
// ═══ MATCH COMMENTARY ════════════════════════════════════════════════════════
const CM = {
  goal:["{n} strikes and it's in! {t} score!","Drilled low into the corner by {t}'s {n}!","{t}'s {n} picks the spot! Past the keeper!","Swept home by {t}'s {n}! First-time finish!","Buried! {n} makes no mistake for {t}!","Cool as ice from {t}'s {n}. Placed into the far corner.","Side-footed past the keeper by {t}'s {n}!","Emphatic from {t}'s {n}! Hammered into the roof of the net!","{n} slots it through the keeper's legs! {t} score!","Instinctive finish! {t}'s {n} reacted first!","{t}'s {n} volleys it home! Sweet connection!","Tucked away by {t}'s {n}. The keeper was rooted.","One touch, one finish. {t}'s {n} is deadly.","{n} ghosts in at the back post and finishes! {t} score!","Bent past the keeper's despairing dive! {t}'s {n}!","Smashed home by {t}'s {n}! Keeper had zero chance!","{t}'s {n} opens the body and guides it in!","Guided into the bottom corner! Sublime from {t}'s {n}!","Wrong-footed the keeper! {n} scores for {t}!","Low drive from {t}'s {n} squirms under the keeper!","{n} pounces! Close range and in for {t}!","{t}'s {n} squeezes it inside the near post!","Half-volley from {t}'s {n}! Thumped into the net!","Dinked over the onrushing keeper! Audacity from {t}'s {n}!","{t}'s {n} finds the far corner from a tight angle!","Controlled and dispatched in one movement! {t}'s {n}!","Lashed into the top corner by {t}'s {n}! Rocket!","{n} scores and wheels away! {t} celebrate!","Clinical from {t}'s {n}. Picked the spot and buried it.","Rifled into the net! {t}'s {n} gave the keeper no chance!","{t}'s {n} takes a touch to steady and drills it home!","First-time finish from {t}'s {n}! Pure instinct!","Chested down and slotted home. Composure from {t}'s {n}.","Curled into the far corner by {t}'s {n}! Exquisite!","{t}'s {n} cracks it across goal and in at the far post!"],
  goal_ctr:["GOAL on the counter! {t}'s {n} finishes the break!","{t}'s {n} completes the counter-attack! Ruthless!","Caught them cold! {t}'s {n} slots it home on the break!","From their box to ours! {t}'s {n} finishes a devastating break!","Counter-attack football at its finest! {t}'s {n} converts!","{t} caught {o} flat-footed! {n} finishes!","Lightning break and {t}'s {n} makes no mistake!","Blistering counter! {t}'s {n} caps it with a cool finish!","{o} left exposed and {t}'s {n} punishes them!","Three passes and it's in! {t}'s {n} completes the devastation!","{t}'s {n} races clear and beats the keeper! Textbook counter!","From defense to attack in seconds! {t}'s {n} applies the finish!"],
  goal_lr:["{t}'s {n} tries from distance... IT'S IN! What a hit!","THUNDERBOLT from {t}'s {n}! From 25 yards! Incredible!","{t}'s {n} lets fly from range and it sails in! Screamer!","Long-range effort from {t}'s {n}! Dips under the bar! GOAL!","Arrowed into the net from 30 yards! {t}'s {n} with a worldie!","{t}'s {n} catches it perfectly from outside the box! It flies in!","From downtown! {t}'s {n} hammers it past the keeper from range!","{t}'s {n} fancies it from distance... and he's right to! GOAL!","Knuckling effort from {t}'s {n}! The keeper could only watch!","Outside the boot from {t}'s {n}! Bends and dips in from 25 yards!","What a strike from {t}'s {n}! Keeper beaten all ends up from distance!","{t}'s {n} lines one up from range... top corner! Sensational!"],
  corner_goal:["{t}'s {n} rises highest! Towering header from the corner!","Planted into the net! {t}'s {n} heads home from the set piece!","Bullet header from {t}'s {n}! Perfect delivery, perfect finish!","Flicked in at the near post by {t}'s {n}! Great movement!","Back-post header! {t}'s {n} was completely unmarked!","Volleyed home from the corner! {t}'s {n} with a sweet connection!","{t}'s {n} powers the header in! Nothing the keeper could do!","Glanced in off {t}'s {n}! Clever header redirecting the ball!","Up rises {t}'s {n}! Headed home with conviction!","{t}'s {n} beats the marker and nods it in!","Thumping header from {t}'s {n}! Inch-perfect delivery!","{t}'s {n} climbs above the defender and heads it home!"],
  own_goal:["{o}'s {n} turns it into his own net! Disaster!","{o}'s {n} can only watch as it deflects past his own keeper!","Calamitous from {o}'s {n}! Sliced into his own goal!","Own goal! {o}'s {n} gets the final touch! Wrong net!","Horrible moment for {o}'s {n}! Past his own goalkeeper!","{o}'s {n} tries to clear and puts it in his own net!","Unlucky deflection off {o}'s {n}! Into the corner of his own goal!","It comes off {o}'s {n} and loops over the keeper! Own goal!","{o}'s {n} misjudges it completely! Past his keeper and in!","Nightmare for {o}'s {n}! The ball ricochets off him and in!"],
  deflection:["Deflection! Wicked bounce off a defender and past the keeper! {t}'s {n} gets the credit.","Cruel deflection wrong-foots the keeper! {t}'s {n} will take it!","It took a nick! Nothing the keeper could do. Goal {t}, {n}.","Deflected past the keeper! {t}'s {n} won't care how it went in!","Ricochets off a defender and nestles in the corner! {t}'s {n} claims it.","Big deflection sends it past the rooted keeper! Lucky break for {t}'s {n}!","Off one defender, off another, and in! {t}'s {n} gets the goal!","A huge deflection loops the ball into the net! {n} for {t}!","Struck goalward and it clips a heel! In! {t}'s {n} takes it!","Fortune favours {t}! {n}'s shot wrong-foots everyone off a defender!","The keeper had it covered... until the deflection! {t}'s {n} scores!","Nicked on its way through! {t}'s {n} won't care one bit!","Via a defender's shin and in! {t}'s {n} claims the goal!","Looped up off the block and over the keeper! Goal for {t}'s {n}!","There's a touch! The shot from {t}'s {n} diverts past the helpless keeper!"],
  gk_error:["HOWLER from the keeper! {t}'s {n} can't believe his luck!","Fumbled! The keeper spills it and {t}'s {n} pounces!","Gift-wrapped! Keeper misjudges and {t}'s {n} rolls it into an empty net!","The keeper makes a hash of it! {t}'s {n} taps into an open goal!","Terrible backpass! {t}'s {n} nips in and the keeper is stranded!","Keeper caught off his line! {t}'s {n} lobs it home!","Horror show in goal! Through the keeper's legs and {t}'s {n} scores!","Spilled by the keeper! {t}'s {n} first to react! Pokes it home!","Keeper error! Tried to play out and {t}'s {n} intercepts and finishes!","The keeper palms it straight to {t}'s {n}! Gift of a goal!"],
  pen_scored:["Sends the keeper the wrong way! {t}'s {n} converts!","Rolls it home! {t}'s {n} makes no mistake from the spot!","Coolly dispatched by {t}'s {n}! Into the corner!","Smashed down the middle! The keeper dived and {t}'s {n} buried it!","Stuttered run, keeper commits, and {t}'s {n} rolls it in!","BURIED into the top corner! {t}'s {n} gives the keeper no chance!","Ice cold from {t}'s {n}! Side-footed into the bottom corner!","Power and placement from {t}'s {n}! Smashes it home!","{t}'s {n} waits for the keeper to move... rolls it the other way!","Driven low and hard by {t}'s {n}! Converted from twelve yards!"],
  goal_desc:["right footed shot from the center of the box to the bottom left corner","left footed shot from the right side of the box to the bottom right corner","right footed shot from the left side of the box to the top right corner","left footed shot from very close range to the center of the goal","right footed shot from the center of the box to the top left corner","side footed finish from the center of the box to the bottom right corner","right footed shot from the right side of the box to the bottom left corner","left footed shot from the left side of the six yard box to the center of the goal","header from very close range to the bottom right corner","left footed shot from the center of the box to the top right corner","right footed shot from the center of the box to the bottom right corner","volley from the center of the box to the top right corner","tap-in from very close range after a low cross","first time right footed shot from the center of the box to the bottom left corner","placed finish from the right side of the box to the far corner","left footed shot from the left side of the box to the bottom left corner","right footed shot from the right side of the six yard box to the top left corner","close range finish from the center of the six yard box to the bottom right corner","left footed volley from the left side of the box to the far corner","right footed shot from the center of the box into the roof of the net","backheel from very close range to the bottom left corner","left footed shot on the turn from the center of the box to the bottom right corner","low right footed shot from the right side of the box to the near post","chipped finish from the center of the box over the goalkeeper","first time left footed shot from the left side of the box to the top right corner"],
  goal_lr_desc:["stunning right footed shot from outside the box to the top left corner","left footed shot from outside the box to the bottom right corner","right footed shot from outside the box to the top right corner","thunderbolt from 25 yards to the top left corner","curling effort from outside the box to the far corner","right footed shot from outside the box to the bottom left corner","left footed shot from long range to the top right corner","powerful strike from 30 yards to the bottom left corner","knuckling shot from outside the box that dips under the crossbar","right footed shot from outside the box to the center of the goal","swerving right footed shot from 28 yards to the top right corner","left footed drive from outside the box to the bottom left corner","rising strike from 22 yards to the top left corner","half volley from outside the box to the bottom right corner","dipping left footed shot from 30 yards under the crossbar","right footed shot from long range into the top corner off the underside of the bar","skidding low drive from 25 yards to the bottom left corner","curling left footed effort from outside the box to the top right corner"],
  corner_goal_desc:["header from the center of the box to the bottom right corner","towering header from the center of the box to the top left corner","header from the left side of the six yard box to the bottom left corner","glancing header from close range to the far corner","bullet header from the center of the box to the top right corner","header from very close range to the center of the goal","back post header from the right side of the six yard box","powerful header from the center of the box to the bottom left corner","flick-on header at the near post to the far corner","header from the penalty spot to the bottom right corner","looping header from the center of the box over the goalkeeper","stooping header from close range to the bottom left corner","downward header from the center of the box that bounces in","near post header glanced to the far corner","volley from the edge of the six yard box after a flick-on"],
  deflection_desc:["right footed shot from the center of the box that deflects off a defender into the bottom left corner","left footed shot from outside the box deflected past the wrong-footed goalkeeper","shot from the right side of the box takes a wicked deflection and loops into the net","effort from the edge of the area deflected into the far corner","cross-shot from the left side deflected past the keeper at the near post","right footed shot from the edge of the box deflected in off a defender's heel","low drive from the center of the box that takes a heavy deflection and rolls in at the near post","left footed effort from the right side of the box deflected over the goalkeeper","shot from distance clipped by a sliding defender and turned into the bottom corner","driven cross-shot deflected in off a covering defender at the back post","toe-poked effort from close range that goes in off a defender's knee","left footed shot from outside the box that flicks off a shoulder and beats the goalkeeper"],
  gk_error_desc:["capitalizes on a goalkeeper error, tapping into an empty net from close range","pounces after the goalkeeper spills a routine shot, finishing from very close range","intercepts a poor goal kick and slots into an empty net","finishes from close range after the goalkeeper fumbles the cross","rounds the stranded goalkeeper and slots into an empty net","collects a miscued clearance and slots into the unguarded net","lobs the goalkeeper after he strays off his line","taps in at the far post after the goalkeeper misjudges a routine cross","steals in as the goalkeeper dallies on the ball and finishes into the empty net","fires into the open goal after the goalkeeper's pass is cut out on the edge of the area","heads into the vacant net after the goalkeeper flaps at a corner","pokes home after the goalkeeper lets a soft shot squirm through his grasp"],
  pen_scored_desc:["converts the penalty with a right footed shot to the bottom left corner","converts the penalty with a left footed shot to the bottom right corner","sends the keeper the wrong way with a right footed shot to the top right corner","converts the penalty with a powerful right footed shot down the middle","side foots the penalty into the bottom left corner as the keeper dives the wrong way","converts the penalty with a left footed shot to the top left corner","drills the penalty into the bottom right corner, sending the keeper the wrong way","converts the penalty with a low left footed shot to the bottom left corner","waits for the goalkeeper to commit and rolls the penalty down the middle","strikes the penalty high into the top left corner","sends the goalkeeper the wrong way with a calm left footed penalty to the bottom right corner","converts the penalty with a stuttered run-up, placing it in the bottom right corner"],
  own_goal_desc:["header turned into his own net from a corner","attempted clearance deflected past his own goalkeeper","slices a clearance into his own net under pressure","unlucky deflection off his body loops over the keeper and in","misjudged header back to his keeper sails into the far corner","turns a low cross into his own net at the near post","diverts a driven cross past his own goalkeeper under pressure","stretches to cut out a cross and steers it into his own goal","inadvertently chests a cross past his own goalkeeper","blocks a shot but the rebound cannons off his back and in","slides to intercept and turns the ball into his own bottom corner","attempted interception loops up and drops over his own goalkeeper"],
  gx_opener:[" First blood!"," That opens the scoring!"," The deadlock is broken!"," First goal of the match!"," And that's the breakthrough!"," The wait is over!"," The opener!"," They've broken through!"," Nil-nil no more!"," Breakthrough!"," Someone had to blink first!"," Now the scoreboard has something to say!"," Goalless no longer!"," Up and running!"," Lift-off!"],
  gx_equal:[" Level!"," The equalizer!"," All square!"," Pegged back!"," Drawn level!"," {t} are back on terms!"," Back to parity!"," That changes everything!"," Honours even!"," The response arrives!"," Cancelled out!"," Slate wiped clean!"," {t} haul themselves level!"," Everything to play for again!"," Parity restored!"],
  gx_lead:[" {t} take the lead!"," {t} go in front!"," Advantage {t}!"," {t} are ahead!"," {t} with their noses in front!"," {t} move into the lead!"," {t} hit the front!"," {t} edge ahead!"," Advantage swings to {t}!"," The lead belongs to {t}!"," In front, {t}!"," {t} seize the lead!"," {t} force their way in front!"," {t} lead!"," It's {t} with the lead!"],
  gx_extend:[" {t} pulling away!"," Breathing room for {t}!"," {t} extend the advantage!"," {t} are running away with it!"," Comfortable now for {t}!"," The lead grows!"," {t} turning the screw!"," This is becoming a rout for {t}!"],
  gx_pull:[" {t} pull one back!"," Game on!"," {t} are back in this!"," Lifeline for {t}!"," {t} give themselves hope!"," The deficit is cut!"," Not done yet, {t}!"," {t} claw one back!"," Hope flickers for {t}!"," The gap narrows!"," No white flags from {t}!"," A way back for {t}!"," {t} halve the deficit!"," Comeback on!"," One more and it's level!"],
  gx_consol:[" Consolation for {t}."," Small comfort for {t}."," {t} get one back, but it's too late."," A matter of pride for {t}."," Too little too late for {t}."," {t} salvage some dignity."," A footnote, nothing more."," Respectability, of a sort, for {t}."," The damage was done long ago."," {t} at least have something to show for it."," Cold comfort for {t}."," That won't change the story of this one."],
  gx_late:[" In the dying minutes!"," Late drama!"," What a time to score!"," Scenes at the death!"," Against the clock!"," You couldn't write this!"," Stoppage time heroics!"," The stadium erupts!"," With seconds left on the clock!"," Right at the death!"," The late, late show!"," Bedlam, this late on!"," Talk about leaving it late!"," Never in doubt!"," Drama in the final act!"],
  save:["Straight at the keeper from {t}'s {n}. Comfortable save.","{o}'s keeper dives low and holds {t}'s {n}'s effort.","Great save! {o}'s keeper denies {t}'s {n}!","Fingertip save! {t}'s {n} thought that was in!","Strong hands from {o}'s keeper to keep out {t}'s {n}'s drive.","Parried away! {o}'s keeper pushes {t}'s {n}'s shot wide!","Point-blank save! {t}'s {n} denied from close range!","Reflex save! {o}'s keeper reacts brilliantly to {t}'s {n}!","Smothered by {o}'s keeper! {t}'s {n} couldn't find a way past!","Low save! {t}'s {n}'s effort kept out.","{t}'s {n} tests the keeper, who holds comfortably.","Diving save! {o}'s keeper gets a glove to {t}'s {n}'s effort!","Blocked by the keeper's legs! {t}'s {n} frustrated!","Pushed wide by {o}'s keeper at full stretch!","Acrobatic stop! {t}'s {n}'s effort tipped over!","Palmed over the bar! Big save to deny {t}'s {n}!","{o}'s keeper reads it early and smothers {t}'s {n}'s shot.","What a stop! {o}'s keeper springs across to deny {t}'s {n}!","One-handed save! {t}'s {n} can't believe it!","Tipped wide! Superb reflexes to deny {t}'s {n}!","{t}'s {n} forces a save. Tipped around the post.","Beaten the defense but not the keeper! {t}'s {n} denied!","Right at him. {t}'s {n} should have placed it better.","Decent save. {t}'s {n}'s shot lacked conviction.","Sharp stop to palm away {t}'s {n}'s drive!"],
  corner_save:["Header from {t}'s {n}... keeper saves! Good reflexes!","Powerful header from {t}'s {n} but {o}'s keeper holds!","{t}'s {n} gets a head on it... saved! Tipped over!","Firm header from {t}'s {n}. Straight at the keeper.","Diving header from {t}'s {n}! {o}'s keeper pushes it wide!","{t}'s {n} meets the delivery but the keeper reacts well!","Glancing header from {t}'s {n}! {o}'s keeper plucks it out of the air!","Strong header from {t}'s {n} but the keeper was equal to it!","{o}'s keeper punches away {t}'s {n}'s header! Commanding!","{t}'s {n} rises well but can't beat the keeper! Good save!"],
  save_lr:["Effort from distance by {t}'s {n}. {o}'s keeper holds.","Struck from range by {t}'s {n}! {o}'s keeper pushes it away!","Long-range drive from {t}'s {n}. Good save, pushed wide!","{t}'s {n} tries from outside the box. {o}'s keeper tips it over!","Ambitious from {t}'s {n} but the keeper reads it all the way.","Dipping shot from {t}'s {n}! {o}'s keeper backpedals and saves!","{t}'s {n} lets rip from 25 yards. Beaten away!","Long-range effort from {t}'s {n} stings the keeper's palms!","Swerving effort from {t}'s {n}! Beaten out by {o}'s keeper!","From 30 yards! {o}'s keeper flings himself across to save from {t}'s {n}!","{t}'s {n} unloads from range. Held at the second attempt.","Fizzing drive from distance! The keeper takes no chances and parries!","Arrowing toward the corner until the keeper intervenes! {t}'s {n} denied from range!","Speculative from {t}'s {n}. Gathered low.","Rasping hit from {t}'s {n}! {o}'s keeper equal to it!"],
  miss:["{t}'s {n} fires wide! Off target.","Over the bar from {t}'s {n}! Leaned back too far.","{n} drags it wide. Poor effort for {t}.","Blazed over by {t}'s {n}! Not even close.","Pulled across the face of goal by {t}'s {n}. Wide.","{n} snatches at it! Over the bar for {t}.","Into the stands from {t}'s {n}! Way too much on it.","Wide of the mark from {t}'s {n}. Should have hit the target.","Miscued from {t}'s {n}! Gets it all wrong.","Scuffed by {t}'s {n}. Bobbles harmlessly wide.","{t}'s {n} had time but couldn't find the target. Wasteful.","Sliced horribly by {t}'s {n}! Miles off target.","{t}'s {n} curls it over from a promising position.","Wild effort from {t}'s {n}! Row Z.","Shanked by {t}'s {n}! Terrible connection.","{t}'s {n} swings a boot and misses the ball entirely!","Drags it wide. {t}'s {n} won't want to see that again.","Hurried his shot. {t}'s {n} needed another touch.","Ballooned over from {t}'s {n}! Had the goal at his mercy.","Off-balance from {t}'s {n}. Drifts harmlessly wide.","Scooped over by {t}'s {n}! Agonizing.","Side-netting from {t}'s {n}. Close but wrong side of the post.","{t}'s {n} leans back and lifts it over the crossbar.","Skewed wide by {t}'s {n}! The chance is gone.","{t}'s {n} catches it on the shin. Harmless."],
  corner_miss:["Header from {t}'s {n}... over the bar! Couldn't keep it down.","{t}'s {n} gets a free header but can't direct it! Over.","Glanced wide by {t}'s {n}. Needed to hit the target.","Completely miscued by {t}'s {n}! Should have scored.","Free header for {t}'s {n}... off target! Big miss.","{t}'s {n} can't keep the header down! Over from six yards.","Headed wide from point-blank! {t}'s {n} kicking himself.","{t}'s {n} gets across the front post but the header drifts wide.","Up rises {t}'s {n} but the header sails over. So close.","{t}'s {n} heads it into the ground. Bounces wide.","The delivery finds {t}'s {n}... header over. Chance wasted.","Six yards out and {t}'s {n} puts it wide! How?","Met with power by {t}'s {n} but no accuracy. Off target.","Corner swung in, {t}'s {n} rises... nothing on the header. Wide.","All alone at the back stick, {t}'s {n} heads over! Huge let-off!"],
  miss_lr:["{t}'s {n} tries from range. Sails over.","Ambitious from {t}'s {n}! The shot from distance curls wide.","{t}'s {n} lets fly from 30 yards. Not troubling anyone.","Speculative from {t}'s {n}. Drifts wide of the far post.","{t}'s {n} has a go from outside the box. Over the bar.","{t}'s {n} strikes from distance. Whistles past the post.","{t}'s {n} fancies one from range but fires over.","Long-range punt from {t}'s {n}. Easy for the keeper.","Row Z. {t}'s {n} got that one all wrong.","Optimistic from {t}'s {n}. Never coming down.","{t}'s {n} takes aim from 25 yards... well wide.","Swerving, dipping... and missing. {t}'s {n} from distance.","Better options available. {t}'s {n} shoots from range and wastes it.","The dip never came. {t}'s {n}'s effort clears the bar.","Troubling the fans, not the keeper. {t}'s {n} from range."],
  woodwork:["{t}'s {n} hits the post! So close!","Off the bar! {t}'s {n} inches away!","Rattles the crossbar! {t}'s {n} nearly had it!","Against the post from {t}'s {n}! Agonizing!","Crashes against the frame of the goal! {t}'s {n} can't believe it!","Off the inside of the post and away! Denied by the woodwork!","Thunderbolt from {t}'s {n} smacks the crossbar!","Thumps the upright! {t}'s {n} had the keeper beaten!","The post comes to {o}'s rescue! {t}'s {n} was so close!","It comes back off the bar! {t}'s {n} holds his head!","Cannons off the crossbar! Millimeters away for {t}'s {n}!","The frame of the goal denies {t}'s {n}! It just wouldn't go in!"],
  woodwork_save:["Tipped onto the post by {o}'s keeper! Incredible!","Fingertips push it onto the bar! Brilliant save!","Pushed onto the frame of the goal by {o}'s keeper!","Onto the woodwork via the keeper's glove! What a save!","The keeper gets just enough to divert it onto the post!","Superb save pushed onto the crossbar! {t}'s {n} denied!","The keeper stretches and pushes it onto the frame!","Off the bar from the keeper's save! {t}'s {n} so close!","A glove and the post combine to deny {t}'s {n}!","Somehow it stays out! Fingertips, then the bar! {t}'s {n} robbed!","Turned onto the upright! Magnificent stop!","Clawed onto the crossbar! Unbelievable save to deny {t}'s {n}!"],
  woodwork_hdr:["Header crashes off the crossbar! {t}'s {n} so close from the corner!","{t}'s {n}'s header thunders against the bar!","Off the bar! {t}'s {n} unlucky with that header!","Header off the post! {t}'s {n} smacks the frame!","Powered against the bar by {t}'s {n}! The woodwork saves {o}!","The crossbar rattles! {t}'s {n}'s header stays out!","Inches! {t}'s {n} plants the header against the post!","Nodded onto the woodwork! {t}'s {n} can't believe it!","Bar! {t}'s {n}'s header bounces down and away! No goal!","So near! The header from {t}'s {n} clips the bar!","Denied by the frame! {t}'s {n} met it perfectly!","Upright! {t}'s {n}'s header thuds back out! {o} survive!"],
  foul:["Foul by {t}'s {n}. Free kick {o}.","Late challenge from {t}'s {n}. Free kick {o}.","{t}'s {n} clips the ankle. Referee blows.","{t}'s {n} goes through the back. Free kick.","{t}'s {n} pulls the shirt. Easy call.","{t}'s {n} bundles into the challenge. Foul.","Clumsy from {t}'s {n}. Free kick {o}.","Body check from {t}'s {n}. Stopped the attack.","{t}'s {n} catches the man. Free kick.","Wrestled to the ground by {t}'s {n}. Foul.","{t}'s {n} slides in recklessly. Free kick {o}.","Trip from {t}'s {n}. No hesitation from the referee.","Cynical foul from {t}'s {n}. Killed the counter.","{t}'s {n} uses an arm across the chest. Free kick.","Stands on the ankle. {t}'s {n} gives away a foul.","Shoulder barge from {t}'s {n}. Too aggressive.","{t}'s {n} goes in studs showing. Free kick {o}.","Blocked off by {t}'s {n}. Impedes the run. Foul.","Tugged back by {t}'s {n}. Clear foul.","Shove from {t}'s {n}. Easy decision."],
  foul_pen:["Brought down in the box by {o}'s {n}! PENALTY!","{o}'s {n} clips the attacker in the area! Penalty given!","Fouled in the box! {o}'s {n} couldn't pull out! PENALTY!","{o}'s {n} drags down the attacker! Referee points to the spot!","Handball by {o}'s {n}! PENALTY!","Crunching challenge from {o}'s {n} in the area! PENALTY!","{o}'s {n} catches the attacker's legs in the box! Penalty!","Tripped in the box by {o}'s {n}! PENALTY!","Penalty! {o}'s {n} with a needless shove in the area!","Pointing to the spot! {o}'s {n} the guilty man!","Clumsy from {o}'s {n} in the box! PENALTY!","Wiped out in the area by {o}'s {n}! Spot kick!","{o}'s {n} times it horribly! Penalty conceded!","Arm up from {o}'s {n}! The referee has no doubt! PENALTY!","Reckless in the box from {o}'s {n}! It's a penalty!"],
  yellow:["Yellow card for {t}'s {n}. Into the book.","Booking for {t}'s {n}. Can't argue with that.","Card shown to {t}'s {n}. Cynical challenge.","{t}'s {n} picks up a caution. Reckless.","In the book. {t}'s {n} needs to be careful now.","{t}'s {n} booked for persistent fouling.","Yellow. {t}'s {n} knew what he was doing.","{t}'s {n} carded. Walking a tightrope.","Cautioned. {t}'s {n} catches the referee's eye.","{t}'s {n} goes in the book.","Booking for {t}'s {n}. That was needless.","{t}'s {n} picks up a yellow. One more and he walks."],
  second_yellow:["Second yellow! {t}'s {n} is OFF! Down to {c}!","Two yellows make a red! {t}'s {n} sees the early bath! {c} men.","That's his second booking! {t}'s {n} has to go! Down to {c}!","Off for two yellows! {t}'s {n} leaves {t} with {c}!","{t}'s {n} can't believe it! Second yellow! {c} remain.","He'd been warned! {t}'s {n} picks up a second yellow! Down to {c}!","Dismissed! {t}'s {n} gets a second booking! {t} down to {c}!","Second booking for {t}'s {n}! Off he goes! {c} men left!","Yellow... and red! {t}'s {n} walks! Down to {c}!","Foolish from {t}'s {n}! A second caution and off he goes! {c} left!","The tightrope snaps! {t}'s {n} sent off for a second yellow! {c} men!","No complaints. {t}'s {n} earned both bookings. Down to {c}.","Gone! A second yellow for {t}'s {n}! {c} remain!","Madness from {t}'s {n}! Already booked and he dives in! Off! Down to {c}!","Out comes yellow, then red! {t}'s {n} is off! {c} men!"],
  red_sfp:["Serious foul play! {t}'s {n} gone! {c} men for {t}.","Awful challenge! {t}'s {n} gets a straight red! {c} remain.","Red card all day long! {t}'s {n} is off! Down to {c}!","Dangerous tackle from {t}'s {n}! Straight red! Reduced to {c}!","Horror tackle! {t}'s {n} sees straight red! Down to {c}!","No debate about that one. {t}'s {n} is off. {c} men for {t}.","Shocking from {t}'s {n}! The red card is out! {c} left!","The early bath for {t}'s {n}! Straight red! {t} down to {c}!","Disgraceful challenge from {t}'s {n}! Off without argument! {c} remain!","That's a leg-breaker! {t}'s {n} is rightly sent off! Down to {c}!","Moment of madness from {t}'s {n}! Red! {t} reduced to {c}!","Studs up, knee high! {t}'s {n} walks! Down to {c}!"],
  red_dogso:["Last man! {t}'s {n} brings down the attacker! Red! Down to {c}!","DOGSO! {t}'s {n} denied a clear goalscoring opportunity! Off! {c} men.","Professional foul from {t}'s {n}! Last defender! Red! {c} remain!","Denied a goalscoring opportunity! {t}'s {n} takes one for the team! Down to {c}!","{t}'s {n} hauls down the attacker! Last man! Off! Down to {c}!","He had to! {t}'s {n} brings down the forward with no one else back! Off! {c} men!","Clear goalscoring opportunity denied! {t}'s {n} walks! {c} for {t}!","Tactical foul, last man, red card. {t}'s {n} had no choice. Down to {c}.","Through on goal and brought down by {t}'s {n}! Off he goes! {c} men!","Cynical from {t}'s {n}! Pulls back the attacker clean through! Red! {c} remain!","The keeper was beaten, the defender wasn't having it! {t}'s {n} off! Down to {c}!","One-on-one denied! {t}'s {n} clips the heels! Straight red! {c} left!"],
  red_violent:["Violent conduct! {t}'s {n} throws an elbow! Straight red! Down to {c}!","Disgusting! {t}'s {n} lashes out off the ball! Red card! {c} men!","That's violent conduct! {t}'s {n} headbutts the opponent! Off! {c} remain!","Hands to the face from {t}'s {n}! Straight red! {t} down to {c}!","Inexcusable from {t}'s {n}! Red card! Down to {c}!","{t}'s {n} stamps on the opponent! Violent conduct! Off! {c} left!","Lost his head! {t}'s {n} shoves the opponent to the ground! Red! {c} men!","Off the ball incident! {t}'s {n} elbows the defender! Dismissed! Down to {c}!","Completely lost it! {t}'s {n} kicks out! Red card! {t} reduced to {c}!","Retaliatory kick from {t}'s {n}! Caught on camera! Violent conduct! Off! {c} men!","Ugly scenes! {t}'s {n} goes after the opponent! Red! Down to {c}!","Grabbed him by the shirt and threw him! {t}'s {n} off for violent conduct! {c} remain!"],
  red_abusive:["Sent off for abusive language! {t}'s {n} said too much! Down to {c}!","Red card for dissent! {t}'s {n} crossed the line! {c} men for {t}!","Offensive language toward the officials! {t}'s {n} is off! Down to {c}!","{t}'s {n} loses it at the referee! Red for abusive language! {c} remain!","Whatever {t}'s {n} said, the referee didn't like it! Straight red! Down to {c}!","Dismissed for foul and abusive language! {t}'s {n} only has himself to blame! {c} left!","Mouthed off one too many times! {t}'s {n} walks! Down to {c}!","The referee has had enough! {t}'s {n} sent off for verbal abuse! {c} remain!","Screaming at the linesman! {t}'s {n} shown a straight red! {t} down to {c}!","Gone for dissent! {t}'s {n} went too far! {c} men for {t}!","Words you can't repeat! {t}'s {n} dismissed for offensive language! Down to {c}!","That's a mouthful at the fourth official! {t}'s {n} gets a straight red! {c} men!"],
  pen_saved:["SAVED! The keeper guesses right and denies {t}'s {n}!","Penalty saved! The keeper springs low to keep {t}'s {n} out!","Read it perfectly! The keeper saves from {t}'s {n}!","Kept out! {t}'s {n} goes left and so does the keeper!","The keeper is the hero! Saves {t}'s {n}'s penalty!","SAVED! Low to his right! The keeper denies {t}'s {n}!","Guessed correctly! The keeper palms away the spot-kick!","What a save from the penalty! {t}'s {n} denied!","Denied! The keeper stands tall and beats it away!","Stopped! {t}'s {n} sees his penalty smothered!","Big hand! The spot kick is turned aside!","Twelve yards, no reward! The keeper keeps out {t}'s {n}!","With his legs! The keeper denies {t}'s {n} from the spot!","Down goes the keeper... and it stays out! {t}'s {n} denied!","Brilliant from the keeper! The penalty is repelled!"],
  pen_missed:["Over the bar! {t}'s {n} blazes the penalty high!","Wide! {t}'s {n} drags the penalty off target!","Off the post! {t}'s {n} can't believe it!","Skied! The pressure got to {t}'s {n}!","Slipped on the run-up! {t}'s {n} balloons it over!","Weak penalty from {t}'s {n}. Way off target.","Hits the bar! {t}'s {n}'s penalty crashes off the crossbar!","{t}'s {n} puts the penalty wide! Terrible miss!","High, wide and anything but handsome! {t}'s {n} misses!","Dragged past the post! {t}'s {n} buries his head in his hands!","The post saves the keeper! {t}'s {n} denied by the frame!","Nowhere near! {t}'s {n} snatches at the penalty!","Ballooned into the stands! Awful from {t}'s {n}!","Too casual! {t}'s {n} chips it wide of the post!","Horrible penalty. {t}'s {n} never looked confident."],
  offside:["Offside against {t}. {n} mistimed the run.","Flag up. {t}'s {n} caught offside.","{t}'s {n} went too early. Offside.","Linesman's flag. {t}'s {n} beyond the last man.","{t}'s {n} is offside. Good call.","Well-timed trap from {o}. {t}'s {n} caught out.","Offside. {t}'s {n} strayed ahead of the line.","Marginal but correct. {t}'s {n} flagged offside.","{t}'s {n} drifts offside. Move is dead.","The flag goes up. {t}'s {n} a fraction offside.","Run timed too early by {t}'s {n}. Offside.","{t}'s {n} springs forward but the flag is up."],
  corner_retain:["Corner half-cleared. Still {t}'s ball.","Loose clearance, {t} recycle it.","Headed out but only as far as {t}.","Partially cleared. {t} keep the pressure on.","Punched away by the keeper but {t} gather.","Cleared to the edge. {t} reload.","Knocked away but it falls to {t}.","Weak clearance from {o}. {t} maintain possession.","Scrambled out, but {t} come again.","Only as far as the edge. {t} still have it.","Nodded clear... and straight back to {t}.","{o} can't get it away. {t} probing again.","Second phase. {t} work it back in.","Half-punched by the keeper. {t} recycle.","The clearance lands at a {t} boot. Pressure stays on."],
  corner_clear:["{o} clear their lines decisively.","Headed away by {o}. Danger over.","{o} deal with the corner comfortably.","Strong defending from {o}. Corner neutralized.","Commanding from {o}'s keeper. Claimed easily.","{o} punch it clear. Dealt with.","Decisive header from {o}. Threat over.","{o} get bodies in the way. Corner cleared.","Cleared with authority by {o}.","{o}'s defense stands firm. Headed away."],
  corner_won:["Corner {t}.","Pushed behind! Corner to {t}.","Behind for a corner! {t} send men forward.","Deflected behind. Corner {t}.","Another set piece opportunity. Corner {t}.","Behind off the last defender. Corner {t}.","Cleared for a corner! {t} sending bodies up.","Last touch {o}. Corner {t}."],
  corner_again:["Another corner {t}.","Taken short... and another corner {t}!","Still {t}'s corner. The pressure builds.","Worked back in... and it's another corner!","The corner leads to another! {t} keep the pressure on.","Blocked behind. Corner number two in quick succession for {t}.","In it comes, out it goes... and behind again. Corner {t}.","{o} can only put it behind. {t} will go again.","Deflected over. {t} keep the set-piece pressure coming.","Same routine, same result. Another {t} corner."],
  corner_rebound:["Off the woodwork and behind for a corner!","Parried behind! Corner {t}.","Tipped over! Corner to {t}.","Rebounds for a corner!","The save deflects behind for a corner!","Pushed behind by the keeper! Corner {t}."],
  free_kick:["Free kick for {t}. {n} over it. Into the wall.","{t}'s {n} whips in the free kick. Headed clear.","{t}'s {n} curls the free kick. Just over the bar.","Direct free kick from {t}'s {n}. Dipping but wide.","{t}'s {n} strikes the free kick. Blocked by the wall.","Worked short by {t}. The move breaks down.","{t}'s {n} floats it in. Keeper claims.","{t}'s {n} tries to bend it over the wall. Wide.","{t}'s {n} fires it low. Deflected behind.","Free kick drilled into the wall by {t}'s {n}. Clear.","{t}'s {n} goes for placement. Curls just wide.","{t}'s {n} strikes it hard. Keeper dives and holds."],
  buildup:["{t}'s {n} drives forward into {o}'s half.","{t} working it wide. {n} has options.","{t} probing through the middle. {n} on the ball.","{t}'s {n} carries it forward. Space opening up.","Ball switched by {t}. {n} receives in space.","{t} patient in possession. {n} picks the pass.","Good move from {t}. {n} advancing.","{n} plays a one-two and surges forward for {t}.","{t}'s {n} finds space between the lines.","{t} building nicely. {n} turns and looks forward.","Neat combination from {t}. {n} carrying it forward.","{t}'s {n} clips one over the top. {t} progressing.","Quick passing from {t}. {n} picks it up on the half turn.","{t}'s {n} beats the press and drives on.","{t} overloading the flank. {n} involved.","{t}'s {n} drops deep, collects, turns and plays forward.","Sharp pass from {t}'s {n}. Through the first line.","Crossfield ball from {t}'s {n}. Play shifted wide.","{t}'s {n} threads it through the midfield. On the move.","Lovely first touch from {t}'s {n}. Turns and plays it forward."],
  z_neutral:["{t} controlling the tempo.","Midfield contest. {o} pressing.","Cagey. Neither side committing.","Throw-in {t}. Worked short.","Loose ball in midfield. Scramble.","Ball bobbling around. {t}'s {n} tidies up.","{t} knocking it around. No urgency.","Both sides keeping the ball for now.","{t}'s {n} sprays it wide. Tempo drops.","{o} win it back. Sideways.","Nothing happening in this spell.","Stalemate in midfield.","{t} trying to find a rhythm. {o} denying space.","{t}'s {n} holds it up. Waiting for runners.","Neither side in control.","Physical battle in the center. No quarter given.","{t}'s {n} plays it backwards. Lacking options.","{t} probing without threatening.","{o} sitting back. {t} circulating.","{t}'s {n} clips one sideways. Patience."],
  enter_box:["{t}'s {n} feeds it into the area! Dangerous!","Chance! {t}'s {n} in space inside the box!","{t} work it through! {n} in behind!","{n} picks it up in a dangerous position for {t}!","{t}'s {n} cuts inside and gets a sight of goal!","Lovely pass! {t}'s {n} is through on goal!","{t}'s {n} drives into the penalty area!","Threaded through! {t}'s {n} latches onto it!","One on one! {t}'s {n} bearing down on the keeper!","{t}'s {n} peels off the defender! Ball played in!","In behind! {t}'s {n} is clean through!","{t}'s {n} bursts into the box! This is a chance!","Slipped in! {t}'s {n} is free inside the area!","{t}'s {n} picks it up on the edge of the six-yard box!","Dangerous position! {t}'s {n} has the goal in his sights!"],
  pressure:["Still {t}. Relentless pressure.","{o} under the cosh. {t} keep coming.","{t} camped in {o}'s half. Wave after wave.","{o} pinned deep. {t} won't relent.","{t} keep recycling. {o} can't escape.","{t} suffocating {o}. All hands defending.","{o} haven't touched the ball in minutes. {t} dominant.","{t} laying siege to {o}'s goal.","Bombardment from {t}. {o}'s defense under strain.","{t} camping in the final third. Feels inevitable.","All {t}. {o} clinging on.","{t} sustaining the pressure. {o} scrambling."],
  counter:["COUNTER! {t} catch {o} up the pitch! {n} leads the charge!","{t} break at pace! {n} driving forward!","Long ball over the top! {t}'s {n} racing clear!","Turnover! {t}'s {n} sprints into space!","{t} hit {o} on the break! {n} carrying it!","Quick transition! {t}'s {n} has support!","Intercepted! {t}'s {n} launches the counter!","{o} caught out! {t}'s {n} breaks with pace!","{t} spring forward! {n} galloping into {o}'s half!","Three on two! {t}'s {n} leading the break!","{o} overcommitted! {t}'s {n} exploits the gap!","Released! {t}'s {n} in behind with acres!","Stolen! {t}'s {n} picks it off and drives forward!","{t} on the counter! {n} has options either side!","Rapid break from {t}! {n} surging through the middle!"],
  sustain:["{t} working it around the edge of the box.","{t} keep probing. {o} holding firm.","{t}'s {n} looking for an opening. Recycled.","Patient from {t}. Waiting for the gap.","{t}'s {n} tries to thread it through. Blocked.","{t} shifting it side to side. {o} staying compact.","{t}'s {n} feints one way, goes the other. Still blocked.","{o} standing firm. {t} can't break through.","{t} patient in the final third. Looking for the killer ball.","{t}'s {n} drops a shoulder. The defender reads it.","Good defending from {o}. {t} recycling.","{t} recycling possession outside the box. {o} resolute.","{t}'s {n} looks for the channel. Cut out.","{t} knocking on the door. {o} barricading it.","{t}'s {n} whips it across the box. Cleared!"],
  neutral:["{t} passing it around at the back. No rush.","Cagey spell. Neither side committing.","{t} probe down the flank. Cross blocked.","Midfield tussle. Every second ball contested.","{o} press high. {t} play through it.","{t} in {o}'s half. Searching for openings.","Half chance breaks down. {t}'s {n} loses possession.","Long ball from {o}. Headed away.","{t} building from the back. Methodical.","{t} trying to find a route through. {o} compact.","Sideways from {t}. Looking for the gap.","Ball out for a throw. {t} regroup.","Scrappy phase of play. Nobody in control.","{o} soaking up pressure. Well-organized.","{t}'s {n} tries a through ball. Intercepted.","Lots of {o} bodies behind the ball.","Quiet passage. {t} keeping the ball without penetrating.","Midfield pinball. Neither team in command.","{t} switching play from side to side.","Tactical foul from {o}. Breaks {t}'s momentum.","{o} sitting deep. Inviting {t} onto them.","Nothing doing for {t}. {o} have numbers back.","Getting heated in midfield. Referee has a word.","End-to-end briefly. Ball bouncing between halves.","Drinks break. Managers issuing instructions."],
  time_waste:["{t} taking their time over the restart.","{t} in absolutely no hurry.","Ball boy taking his time. {t} happy to wait.","{t} slowing the game down. {o} frustrated.","{t} running down the clock. Crowd getting restless.","Every restart takes an age. {t} know exactly what they're doing.","The keeper examines the ball at length. {t} in no rush.","A leisurely stroll to the corner flag from {t}.","Cramp, apparently. The physio jogs on. {t} happy with the delay.","{t} argue over who takes the throw. The clock ticks on.","Substitution board up... eventually. {t} milking every second.","Watch-tapping from the referee. {t} unmoved."],
  press_won:["{t} press and win it back!","Turnover! {t}'s pressing pays off!","{t} win the ball high up the pitch!","Good press from {t}! Won the ball!","{t} force the error! Ball turned over!","High press from {t} forces the turnover!","Hunted down! {t} strip the ball loose in {o}'s half!","{o} play their way into trouble! {t} pounce!","Swarmed! Three {t} shirts and the ball is won!","The press bites! {t} regain it high!","Nowhere to go for {o}! {t} steal it back!","Trapped by the touchline! {t} win it off the press!"],
  chance_magic:["{t}'s {n} nutmegs the defender and bursts through!","{t}'s {n} drops a shoulder, cuts inside and drives into the box!","{t}'s {n} flicks it over the defender's head and collects! Through on goal!","{t}'s {n} beats two men with a drag-back and accelerates clear!","{t}'s {n} dances past three challenges on a mazy dribble!","{t}'s {n} spins away from the marker with a Cruyff turn! Space ahead!","{t}'s {n} rolls the ball through the defender's legs and races on!","{t}'s {n} chops inside off the right and leaves the fullback for dead!","{t}'s {n} knocks it past the defender and wins the footrace!","{t}'s {n} takes on two with quick feet and emerges in space!","{t}'s {n} feints left, shifts right, and surges past the last man!","{t}'s {n} picks up the ball on the halfway line and drives at the defense!"],
  trap_beaten:["⚡ {t}'s {n} times the run perfectly! Clean through behind the high line!","⚡ {t}'s {n} stays onside and latches onto the through ball! One on one!","⚡ {t}'s {n} beats the offside trap! Sprints clear into the channel!","⚡ Ball over the top and {t}'s {n} is in behind! The trap has failed!","⚡ {t}'s {n} peels off the last defender and collects! Racing through on goal!","⚡ {t}'s {n} holds the run and goes! Past the high line and clear!","⚡ The flag stays down! {t}'s {n} is away! Clean through!","⚡ Caught square! {o}'s line is breached and {t}'s {n} is gone!","⚡ One ball undoes the whole back line! {t}'s {n} through on goal!","⚡ {o} step up... too late! {t}'s {n} is in behind!","⚡ Timed to the centimetre! {t}'s {n} bursts through the gap!","⚡ Gambled and lost! {o}'s high line is torn open by {t}'s {n}!"],
  clearance_edge:["{o} clear, but only to the edge.","Headed out by {o}. Ball at the edge of the box.","{o} can't clear their lines properly. Ball falls loose.","Last-ditch clearance from {o}. Not convincing.","{o} scramble it away. Still in their half.","Cleared under pressure by {o}. Just about.","Booted away by {o}. Not out of danger yet.","{o} hack it clear. Temporary relief.","Anywhere will do! {o} smash it clear, but not far.","Half a clearance from {o}. The danger lingers.","{o} throw bodies at it. The ball squirts to the edge.","Desperate stuff from {o}. It drops just outside the box."],
  clearance_mid:["Cleared by {o}. Midfield.","{o} win the ball and clear it long.","Headed out by {o}. Back in the middle third.","{o} deal with it comfortably. Ball in midfield.","Cleared to halfway by {o}.","Strong defending from {o}. Cleared."],
  transition:["{o} win it and break forward.","Turnover. {o} have the ball.","{t} lose it in midfield. {o} advance.","Loose ball falls to {o}. {t} retreating.","{t} lose it cheaply. {o} looking to exploit.","{o} win it back in the middle.","Possession flips. {o} on the move.","Sloppy from {t}. {o} take full advantage of the loose pass.","{o} pick the pocket and push forward.","Given away by {t}. {o} spring upfield.","The pass is cut out. {o} in possession now.","{t} overplay it. {o} pounce and advance."],
  long_ball:["{t} go direct. Second ball contested.","{t} play it long. {o} head it away.","{t} bypass the midfield. Ball launched forward.","{t} send it long. Aerial battle.","Route one from {t}. {o} deal with it.","Channel ball from {t}. Shepherded out.","Up it goes from {t}. Knocked down and scrapped for.","No messing from {t}. Launched toward the front line.","Straight over the top from {t}. Long and hopeful.","Direct from {t}. The flick-on comes to nothing.","A raking ball forward from {t}. Dealt with in the end.","Long from {t}. The striker can't bring it down."],
  sub_in:["Fresh legs. {t}'s {n} replaces {x}.","{t} make a change. {x} off, {n} on.","Change for {t}. {n} enters, {x} makes way.","Here comes {n} for {t}. {x}'s work is done.","The board goes up. {t} swap {x} for {n}.","{x} trudges off. {n} sprints on for {t}.","Tactical switch from {t}. {n} on for {x}.","Straight to the bench for {t}. {n} replaces {x}.","Applause for {x} as he makes way. {n} joins the fray for {t}.","That's it for {x}. {n} takes over for {t}.","{n} strips off the bib and enters for {t}. {x} comes off.","A roll of the dice from {t}. {n} on, {x} off.","Off comes {x}, shaking his head. On goes {n} for {t}.","Like-for-like change from {t}. {n} in for {x}."],
  injury_event:["{t}'s {n} is down and staying down.","Concern for {t}. {n} clutching his ankle.","The physio is on for {t}'s {n}.","Just a knock for {t}'s {n}. He'll run it off.","Down goes {t}'s {n}. Nothing malicious, just awkward.","Hamstring, by the look of it. {t}'s {n} pulls up sharply.","Treatment needed for {t}'s {n}. The bench looks worried.","A hobble to the touchline for {t}'s {n}.","Nasty collision. {t}'s {n} comes off worse.","Straight away {t}'s {n} signals to the bench. Not a good sign.","Lengthy stoppage here. {t}'s {n} in real discomfort.","Up and moving again. {t}'s {n} shakes it off.","Ice and a bandage for {t}'s {n}. He'll soldier on."],
  ht_whistle:["That's the break.","Referee blows for half-time.","Half-time. Time to regroup.","The whistle goes. Forty-five in the books.","And that's the half.","Time for a breather. Half-time.","There's the whistle. Down the tunnel they go.","Break time. Oranges and instructions.","Forty-five minutes gone.","One half done, one to go.","Whistle. Interval.","Players head for the tunnel. Half-time."],
  ft_whistle:["It's all over!","That's it. Final whistle.","The referee ends it.","Full-time. Done and dusted.","There goes the whistle! It's finished!","All over. Handshakes all round.","Peep peep peep! That's full-time!","No more time. The final whistle sounds.","Nothing more to play. The whistle ends it.","Finished. The referee brings it to an end.","And there it is. Full-time.","One last whistle. It's over.","Over. Done. Full-time."],
  et_start:["Thirty more minutes to settle this.","Extra time. Here we go again.","Deadlocked after ninety. Extra time beckons.","Nothing separates them. Extra time it is.","On to extra time. Tired legs everywhere.","An additional half hour to find a winner.","Here comes extra time. Who has anything left?","The players gather themselves. Extra time under way.","No decision yet. Thirty minutes more.","Half an hour more. Someone has to blink.","Cramp, courage and fine margins. Extra time.","Still level. We play on."],
  kickoff:["We're underway!","And they're off.","{t} get us started.","The referee's whistle. Game on.","Kick-off. Here we go.","First touch to {t}.","Under way at last.","Whistle blown, ball rolling. We're off.","Away we go.","Tapped off by {t}. Up and running.","Game on. {t} in possession from the start.","Off we go then."],
  drink_break:["Quick drinks break.","Water break. Managers have a word.","A pause for fluids.","Drinks on the touchline. Brief huddle from both benches.","Cooling break. The tempo can wait.","Bottles out. A minute to reset.","The referee signals a drinks break.","Hydration stop. Coaches make the most of it.","Time for water. Tactical whiteboards appear.","Play pauses. Everyone takes on water.","Brief stop for drinks. Some walk, some listen, some just breathe.","Out come the bottles and the clipboards."],
};
const GOAL_TPS=new Set(["goal","corner_goal","own_goal","deflection","gk_error","pen_scored","goal_ctr","goal_lr"]);
function comm(rng,tp,v,s){const pool=CM[tp];if(!pool||!pool.length)return fill(tp,v||{});let txt=fill(pick(rng,pool),v||{});if(GOAL_TPS.has(tp)&&s&&v&&v.tk){const i=v.tk==="home"?0:1,tot=s.score[0]+s.score[1],diff=s.score[i]-s.score[1-i];if(tot===1)txt+=pick(rng,CM.gx_opener);else if(diff===0)txt+=fill(pick(rng,CM.gx_equal),v);else if(diff===1)txt+=fill(pick(rng,CM.gx_lead),v);else if(diff>1)txt+=fill(pick(rng,CM.gx_extend),v);else if(diff===-1)txt+=fill(pick(rng,CM.gx_pull),v);else txt+=fill(pick(rng,CM.gx_consol),v);if(s.minute>=85||(s.phase&&s.phase.includes("stoppage")))txt+=pick(rng,CM.gx_late);}return txt;}

function goalText(rng, descPool, s, nm, scorer, ast) {
  const desc = pick(rng, CM[descPool] || CM.goal_desc);
  const line = nm.home + " " + s.score[0] + ", " + nm.away + " " + s.score[1];
  let txt = line + ". " + scorer.name + " (" + scorer.pos + ") " + desc + ".";
  if (ast) txt += " Assisted by " + ast.name + " (" + ast.pos + ").";
  return txt;
}
function ownGoalText(rng, s, nm, ogPlayer) {
  const desc = pick(rng, CM.own_goal_desc);
  const line = nm.home + " " + s.score[0] + ", " + nm.away + " " + s.score[1];
  return line + ". " + ogPlayer.name + " (" + ogPlayer.pos + ") " + desc + ".";
}
// Spatial data for goal visualizations. Pitch coords: 100x65 landscape, attacking goal at x=100.
// zone/dive are passed in for penalties (to match the shootout data) and generated otherwise.
function genGoalViz(rng, method, scorerName, assistName, zone, dive) {
  const R = (lo, hi) => lo + rng.u() * (hi - lo);
  const m = method || "reg";
  let shotFrom = null, assistFrom = null;
  if (m === "pen") { shotFrom = { x: 88, y: 32.5 }; }
  else if (m !== "og") {
    if (m === "header") { shotFrom = { x: R(88,96), y: R(20,45) }; assistFrom = { x: R(95,100), y: rng.u() < 0.5 ? R(2,12) : R(53,63) }; }
    else if (m === "corner") { shotFrom = { x: R(90,97), y: R(18,47) }; assistFrom = { x: 100, y: rng.u() < 0.5 ? R(0,5) : R(60,65) }; }
    else if (m === "long-range") { shotFrom = { x: R(68,82), y: R(15,50) }; assistFrom = { x: R(48,68), y: R(12,53) }; }
    else if (m === "deflection") { shotFrom = { x: R(75,90), y: R(16,49) }; assistFrom = { x: R(55,78), y: R(12,53) }; }
    else if (m === "counter") { shotFrom = { x: R(80,94), y: R(18,47) }; assistFrom = { x: R(20,45), y: R(15,50) }; }
    else if (m === "gk-error") { shotFrom = { x: R(82,95), y: R(20,45) }; assistFrom = { x: R(55,78), y: R(15,50) }; }
    else { shotFrom = { x: R(78,92), y: R(18,47) }; assistFrom = { x: R(55,80), y: R(10,55) }; }
    if (!assistName) assistFrom = null;
  }
  let gz = zone, dv = dive;
  if (gz == null) {
    const w = (m === "header" || m === "corner") ? [20,20,20,13,14,13] : m === "long-range" ? [14,10,14,18,12,18] : [14,10,14,20,12,20];
    const tot = w.reduce((a,b)=>a+b,0); let r = rng.u()*tot; gz = 5;
    for (let i = 0; i < 6; i++) { r -= w[i]; if (r <= 0) { gz = i; break; } }
  }
  // Open-play keeper always dives toward the shot's actual side — beaten by pace,
  // placement, or a deflection, never by picking the wrong side outright. Only
  // penalties (dive passed in above) are an independent guess.
  if (dv == null) dv = gz % 3;
  return { method: method || null, scorer: scorerName, assist: assistName || null, shotFrom, assistFrom, goalZone: gz, dive: dv, result: "goal" };
}
function gvParseZone(text, shotY) {
  const d = text.toLowerCase();
  if (d.includes("top left")) return 0;
  if (d.includes("top right")) return 2;
  if (d.includes("bottom left")) return 3;
  if (d.includes("bottom right")) return 5;
  if (d.includes("top corner")) return 0;
  if (d.includes("bottom corner")) return 3;
  if (d.includes("roof of the net") || d.includes("under the crossbar") || d.includes("underside of the bar")) return 1;
  if (d.includes("over the goalkeeper")) return 1;
  if (d.includes("down the middle") || d.includes("through the keeper")) return 4;
  if (d.includes("center of the goal")) return 4;
  if (d.includes("far corner") || d.includes("far post")) return (shotY != null && shotY < 32.5) ? 5 : 3;
  if (d.includes("near post") || d.includes("near corner")) return (shotY != null && shotY < 32.5) ? 3 : 5;
  return null;
}
function gvSync(txt, gv) {
  const pz = gvParseZone(txt, gv?.shotFrom?.y);
  if (pz == null || !gv) return;
  gv.goalZone = pz;
  // A scored penalty is only a goal because the keeper's dive column missed the
  // shot's column (see resolvePendingPenalty/shootout). Re-syncing the zone to the
  // commentary text must preserve that mismatch, or the keeper reads as having
  // guessed correctly on a shot the text describes as beating him.
  if (gv.method === "pen" && gv.dive === pz % 3) gv.dive = (pz % 3 + 1) % 3;
}
const lmEffSkill = (base, reds, minute) => { let s = base * Math.pow(0.85, reds); if (minute > 90) s *= Math.max(0.88, 1 - 0.004 * (minute - 90)); return s; };
const PROMO_DEBUFF = { GK: 0.04, DEF: 0.025, MID: 0.02, FWD: 0.015 };
const rcSuspGames = (variant, r) => variant === "violent" ? 3 + Math.floor(r * 3) : variant === "abusive" ? 2 + Math.floor(r * 3) : 1;
const calcPromoDebuff = (starters, origBenchNames) => { let d = 0; for (const p of starters) { if (origBenchNames.has(p.name)) d += PROMO_DEBUFF[p.pos] || 0.02; } return d; };
function lmDisplayMin(phase, min, se) { const b = { first_half_stoppage:45, second_half_stoppage:90, et_first_stoppage:105, et_second_stoppage:120 }[phase]; return b !== undefined ? `${b}+${se}` : `${min}`; }
function lmClockDisplay(s) {
  const map = { pre_match:"--", half_time:"HT", full_time:"FT", et_half_time:"ET HT", et_full_time:"ET FT", penalties:"PEN", finished:"FT" };
  return map[s.phase] || lmDisplayMin(s.phase, s.minute, s.stoppageElapsed) + "'";
}
function lmCalcStoppage(bank, phase, rng) { const cfg = { first_half:[60,5], second_half:[120,8], et_first:[30,3], et_second:[30,3] }; const [base,cap] = cfg[phase]||[60,3]; return Math.min(cap, Math.max(1, Math.round((base+bank)/60) + (rng.u()<0.5?1:0))); }
function lmCheckPenDecided(hK, aK) {
  const hS = hK.filter(k=>k?.scored??k).length, aS = aK.filter(k=>k?.scored??k).length;
  if (hK.length <= 5) { const hR = 5-hK.length, aR = 5-aK.length; if (hS > aS+aR) return "home"; if (aS > hS+hR) return "away"; if (hK.length===5 && aK.length===5 && hS!==aS) return hS>aS?"home":"away"; }
  else if (hK.length===aK.length && hS!==aS) return hS>aS?"home":"away";
  return null;
}

// ═══ TACTICAL ENGINE ═════════════════════════════════════════════════════════
function autoTac(rng, diff, rem, urgency, style, current, skillAdv, matchUrg) {
  const r = Math.max(0, rem - (urgency||0));
  const sa = skillAdv || 0;
  const mu = matchUrg || 0;
  // Style-specific tempo behavior
  // ds: defensive shift (positive = go defensive earlier when leading)
  // as: attacking shift (positive = go attacking earlier when trailing)
  // ceil: max attacking intensity, floor: max defensive intensity
  // bias: baseline push toward atk(+) or def(-)
  const sp = {
    gegenpress:   {ds:-12, as:10, ceil:2.0, floor:-1.0, bias:0.4},
    wingplay:     {ds:-5,  as:5,  ceil:2.0, floor:-1.2, bias:0.2},
    balanced:     {ds:0,   as:0,  ceil:2.0, floor:-2.0, bias:0},
    tikitaka:     {ds:3,   as:-5, ceil:1.6, floor:-1.5, bias:0.1},
    counterattack:{ds:15,  as:-8, ceil:1.3, floor:-2.0, bias:-0.4},
    parkthebus:   {ds:20,  as:-12,ceil:1.0, floor:-2.0, bias:-0.6},
  }[style] || {ds:0,as:0,ceil:2.5,floor:-2.0,bias:0};
  // Skill mismatch: strong teams hold tempo when leading, press harder when trailing
  // Weak teams turtle when leading, accept deficit when trailing
  sp.ds += Math.round(sa * -20);
  sp.as += Math.round(sa * 12);
  sp.bias += sa * 0.15;
  // Strong teams get a higher attacking ceiling when trailing
  if (sa > 0.15 && diff < 0) sp.ceil = Math.min(2.5, sp.ceil + sa * 0.4);
  // Weak teams get a lower defensive floor when leading
  if (sa < -0.15 && diff > 0) sp.floor = Math.max(-2.0, sp.floor - Math.abs(sa) * 0.3);
  // Group/tournament context: must-win teams attack, dead rubber teams coast
  sp.bias += mu * 0.3;
  sp.ds += Math.round(mu * -10);
  if (mu > 0.5) sp.floor = Math.max(sp.floor, -0.5);
  if (mu < -0.2) sp.ceil = Math.min(sp.ceil, 1.0);
  let t = 0;
  // Trailing thresholds (shifted by as)
  const aOff = sp.as;
  if (diff<=-3&&r<=15+aOff) t=2.5;
  else if (diff<=-2&&r<=20+aOff) t=2.0;
  else if (diff<=-2&&r<=40+aOff) t=1.5;
  else if (diff<=-1&&r<=25+aOff) t=1.2;
  else if (diff<=-1&&r<=50+aOff) t=0.5;
  else if (diff<=-2) t=0.8;
  else if (diff<=-1) t=0.2;
  // Leading thresholds (shifted by ds)
  else if (diff>=1&&r<=12+sp.ds) t=-1.8;
  else if (diff>=1&&r<=30+sp.ds) t=-1.0;
  else if (diff>=2&&r<=45+sp.ds) t=-1.2;
  else if (diff>=3) t=-0.8;
  else if (diff>=1) t=-0.3;
  // Urgency
  if (urgency&&diff<=-2) t=Math.max(t,1.2);
  if (urgency&&diff<=-1&&r<=60) t=Math.max(t,0.6);
  // Style bias
  t += sp.bias;
  // Clamp to style ceiling/floor
  t = Math.min(t, sp.ceil);
  t = Math.max(t, sp.floor);
  // Resignation: strong teams resist resignation, weak teams accept earlier
  const resignThresh = 0.35 + sa * 0.2;
  if (diff<=-3&&rem<=12&&rng.u()<Math.max(0.1, resignThresh)) t=-0.3;
  if (diff<=-4&&rem<=20&&rng.u()<Math.max(0.1, resignThresh+0.05)) t=-0.5;
  // Jitter
  t += (rng.u()-0.5)*0.7;
  // Hysteresis
  if (current) { const ci=TAC_ORD.indexOf(current); if(ci>=0){ t=t*0.65+(ci-2)*0.35; }}
  if (t>=1.2) return "ultra"; if (t>=0.5) return "atk";
  if (t>=-0.5) return "bal"; if (t>=-1.4) return "def"; return "park";
}
const TAC_MSG = {ultra:"throwing everything forward!",atk:"pushing more players forward",def:"dropping deep, protecting the lead",park:"ultra defensive. Wall of defenders",bal:"back to a balanced shape"};
const STYLES = ["gegenpress","wingplay","balanced","tikitaka","counterattack","parkthebus"];
const STYLE_GRP = [["Offensive",["gegenpress","wingplay"]],["Neutral",["balanced","tikitaka"]],["Defensive",["counterattack","parkthebus"]]];
const STYLE_LBL = {balanced:"Balanced",gegenpress:"Gegenpress",tikitaka:"Tiki-Taka",counterattack:"Counter",wingplay:"Wing Play",parkthebus:"Park Bus"};
const STYLE_CLR = {balanced:"#7889a0",gegenpress:"#ebcb8b",tikitaka:"#d4a0c0",counterattack:"#7dc9c9",wingplay:"#a3be8c",parkthebus:"#8b6e4e"};
const STYLE_MOD = {
  balanced:     {press:1.0,adv:0,hold:0,lb:0,boxShot:0,goalP:0,ctr:1.0,ctrShot:0,def:0,lr:0,corn:1.0,maxT:null,minT:null},
  gegenpress:   {press:1.5,adv:0.04,hold:-0.08,lb:0,boxShot:0.03,goalP:-0.01,ctr:0.6,ctrShot:0,def:-0.06,lr:0,corn:1.0,maxT:null,minT:null},
  tikitaka:     {press:1.1,adv:-0.04,hold:0.10,lb:-0.04,boxShot:-0.03,goalP:0.02,ctr:0.7,ctrShot:0,def:0,lr:-0.04,corn:0.8,maxT:"ultra",minT:null},
  counterattack:{press:0.3,adv:-0.06,hold:-0.03,lb:0.02,boxShot:-0.04,goalP:0.02,ctr:2.0,ctrShot:0.10,def:0.08,lr:0,corn:1.0,maxT:"ultra",minT:null},
  wingplay:     {press:1.0,adv:0.02,hold:-0.03,lb:0.04,boxShot:0.02,goalP:0,ctr:1.0,ctrShot:0,def:-0.02,lr:0.04,corn:1.5,maxT:null,minT:null},
  parkthebus:   {press:0.1,adv:-0.10,hold:-0.05,lb:0.02,boxShot:-0.06,goalP:0,ctr:1.3,ctrShot:0.05,def:0.10,lr:-0.04,corn:0.7,maxT:null,minT:"def"},
};
const TAC_ORD=["park","def","bal","atk","ultra"];
const TAC_DRAIN={park:-0.15,def:-0.08,bal:0,atk:0.10,ultra:0.18};
function clampTac(tac,style){const m=STYLE_MOD[style]||STYLE_MOD.balanced;const i=TAC_ORD.indexOf(tac);if(m.maxT){const mx=TAC_ORD.indexOf(m.maxT);if(i>mx)return m.maxT;}if(m.minT){const mn=TAC_ORD.indexOf(m.minT);if(i<mn)return m.minT;}return tac;}
const FORMATIONS=["4-2-4","3-4-3","4-1-2-1-2","4-3-3","4-4-2","4-2-3-1","3-5-2","3-4-1-2","4-1-4-1","4-3-2-1","5-3-2"];
const FORM_GRP=[["Offensive",["4-2-4","3-4-3","4-1-2-1-2"]],["Neutral",["4-3-3","4-4-2","4-2-3-1","3-5-2","3-4-1-2"]],["Defensive",["4-1-4-1","4-3-2-1","5-3-2"]]];
const FORM_CLR={"4-2-4":"#d08770","3-4-3":"#d08770","4-1-2-1-2":"#d08770","4-3-3":"#7889a0","4-4-2":"#7889a0","4-2-3-1":"#7889a0","3-5-2":"#7889a0","3-4-1-2":"#7889a0","4-1-4-1":"#4a7fd4","4-3-2-1":"#4a7fd4","5-3-2":"#4a7fd4"};
const FORM_MOD = {
  "4-3-3":   {press:1.0,adv:0,hold:0,lb:0,boxShot:0.01,goalP:0,ctr:1.0,ctrShot:0,def:0.01,lr:0,corn:1.0},
  "4-4-2":   {press:1.0,adv:0,hold:0,lb:0.02,boxShot:0.04,goalP:0,ctr:0.95,ctrShot:0,def:0.01,lr:-0.02,corn:1.15},
  "4-2-3-1": {press:1.0,adv:0,hold:0.04,lb:-0.01,boxShot:-0.03,goalP:0,ctr:0.9,ctrShot:0,def:0.03,lr:0.03,corn:1.0},
  "4-1-4-1": {press:1.0,adv:0,hold:0.03,lb:0,boxShot:0,goalP:0,ctr:0.85,ctrShot:0,def:0.05,lr:0,corn:1.2},
  "4-1-2-1-2":{press:1.0,adv:0.01,hold:0.01,lb:0,boxShot:0.02,goalP:0,ctr:1.0,ctrShot:0,def:-0.03,lr:0.03,corn:0.75},
  "4-3-2-1": {press:1.0,adv:0,hold:0.03,lb:-0.01,boxShot:0,goalP:0,ctr:0.9,ctrShot:0,def:0.03,lr:0.04,corn:0.85},
  "4-2-4":   {press:0.8,adv:0.04,hold:-0.08,lb:0.03,boxShot:0.04,goalP:0.01,ctr:0.9,ctrShot:0,def:-0.08,lr:0,corn:1.1},
  "3-5-2":   {press:1.0,adv:0.02,hold:0.01,lb:0,boxShot:0.02,goalP:0,ctr:1.05,ctrShot:0,def:-0.04,lr:0,corn:1.15},
  "3-4-3":   {press:1.05,adv:0.04,hold:-0.02,lb:0,boxShot:0.04,goalP:0,ctr:1.0,ctrShot:0,def:-0.05,lr:0,corn:1.0},
  "3-4-1-2": {press:1.0,adv:0.01,hold:0.02,lb:0,boxShot:0,goalP:0,ctr:1.0,ctrShot:0,def:-0.03,lr:0.03,corn:0.95},
  "5-3-2":   {press:0.8,adv:-0.02,hold:0,lb:0.03,boxShot:0,goalP:0,ctr:1.30,ctrShot:0.02,def:0.07,lr:0,corn:0.85},
};
function mergeModifiers(sm, fm) {
  if (!fm) return sm;
  return { press:sm.press*(fm.press||1), adv:sm.adv+(fm.adv||0), hold:sm.hold+(fm.hold||0), lb:sm.lb+(fm.lb||0), boxShot:sm.boxShot+(fm.boxShot||0), goalP:sm.goalP+(fm.goalP||0), ctr:sm.ctr*(fm.ctr||1), ctrShot:sm.ctrShot+(fm.ctrShot||0), def:sm.def+(fm.def||0), lr:sm.lr+(fm.lr||0), corn:sm.corn*(fm.corn||1), maxT:sm.maxT, minT:sm.minT };
}
const STRAT_DEF = { passingDir:0, chanceCreation:0, pressingLOE:0, defLine:0, possWon:0, approachPlay:0, dribbling:0, creativity:0, setPieces:0, timeWasting:0, possLost:0, gkDist:0, dlBehavior:0, tackling:0 };
const STRAT_LABELS = {
  approachPlay: { name:"Approach", vals:[[-1,"Play Out"],[0,"No Instruction"],[1,"Into Space"]], grp:"possession" },
  passingDir: { name:"Passing", vals:[[-2,"Much Shorter"],[-1,"Shorter"],[0,"Standard"],[1,"More Direct"],[2,"Much More Direct"]], grp:"possession" },
  chanceCreation: { name:"Chances", vals:[[-1,"Work Ball In"],[0,"No Instruction"],[1,"Shoot On Sight"]], grp:"possession" },
  dribbling: { name:"Dribble", vals:[[-1,"Disciplined"],[0,"No Instruction"],[1,"Run At Defence"]], grp:"possession" },
  creativity: { name:"Freedom", vals:[[-1,"Disciplined"],[0,"No Instruction"],[1,"Expressive"]], grp:"possession" },
  setPieces: { name:"Set Pcs", vals:[[0,"No Instruction"],[1,"Play For"]], grp:"possession" },
  timeWasting: { name:"Time", vals:[[0,"Never"],[1,"Sometimes"],[2,"Constantly"]], grp:"possession" },
  possLost: { name:"On Loss", vals:[[-1,"Regroup"],[0,"No Instruction"],[1,"Cntr-Press"]], grp:"transition" },
  possWon: { name:"On Win", vals:[[-1,"Hold Shape"],[0,"No Instruction"],[1,"Counter"]], grp:"transition" },
  gkDist: { name:"GK Dist", vals:[[-1,"Short"],[0,"No Instruction"],[1,"Long"]], grp:"transition" },
  pressingLOE: { name:"Pressing", vals:[[-2,"Much Lower"],[-1,"Lower"],[0,"Standard"],[1,"Higher"],[2,"Much Higher"]], grp:"defense" },
  defLine: { name:"Def. Line", vals:[[-2,"Much Lower"],[-1,"Lower"],[0,"Standard"],[1,"Higher"],[2,"Much Higher"]], grp:"defense" },
  dlBehavior: { name:"DL Style", vals:[[-1,"Drop Off"],[0,"No Instruction"],[1,"Step Up"],[2,"Offside Trap"]], grp:"defense" },
  tackling: { name:"Tackle", vals:[[-1,"Stay On Feet"],[0,"No Instruction"],[1,"Get Stuck In"]], grp:"defense" },
};
const PRESS_LOE_MULT = [0.5, 0.7, 1.0, 1.3, 1.5];
function applyStrategy(mod, strat) {
  const st = strat || STRAT_DEF;
  return {
    // Counter-Press: 1.20 (down from 1.25) + def cost below. High line: pressing synergy. RAD: press cost.
    press: mod.press * PRESS_LOE_MULT[st.pressingLOE + 2] * (st.possLost === 1 ? 1.20 : st.possLost === -1 ? 0.85 : 1.0) * (st.tackling === 1 ? 1.08 : st.tackling === -1 ? 0.95 : 1.0) * (st.dribbling === 1 ? 0.95 : 1.0) * (st.defLine > 0 ? 1 + st.defLine * 0.05 : 1.0),
    // High line: advance boost (+0.008/step). Step Up/OT: advance (compress space). Set Pieces: advance cost. Disciplined dribbling: halved from -0.01.
    adv: mod.adv + st.passingDir * 0.015 + (st.approachPlay === 1 ? 0.02 : st.approachPlay === -1 ? -0.01 : 0) + (st.dribbling === 1 ? 0.02 : st.dribbling === -1 ? -0.005 : 0) + (st.dlBehavior === -1 ? -0.008 : st.dlBehavior === 1 ? 0.012 : st.dlBehavior === 2 ? 0.018 : 0) + (st.defLine > 0 ? st.defLine * 0.008 : st.defLine < 0 ? st.defLine * 0.005 : 0) + (st.setPieces === 1 ? -0.008 : 0) + (st.creativity === -1 ? -0.006 : 0) + (st.possLost === -1 ? -0.006 : 0),
    hold: mod.hold + st.passingDir * -0.02 + (st.possWon === -1 ? 0.03 : st.possWon === 1 ? -0.02 : 0) + (st.approachPlay === -1 ? 0.02 : st.approachPlay === 1 ? -0.02 : 0) + (st.possLost === -1 ? -0.02 : 0),
    lb: mod.lb + st.passingDir * 0.015,
    // SoS: slight box shot penalty (shooting from range). WBiB: keeps +0.03.
    boxShot: mod.boxShot + (st.chanceCreation === -1 ? 0.03 : st.chanceCreation === 1 ? -0.015 : 0),
    // SoS: removed goalP penalty. Disciplined creativity: now +0.003 (more clinical) instead of -0.005.
    goalP: mod.goalP + (st.creativity === 1 ? 0.012 : st.creativity === -1 ? 0.003 : 0),
    ctr: mod.ctr * (st.possWon === -1 ? 0.5 : st.possWon === 1 ? 1.5 : 1.0) * (st.possLost === -1 ? 0.92 : 1.0),
    ctrShot: mod.ctrShot + (st.possWon === 1 ? 0.04 : 0),
    // Counter-Press: def cost -0.008. Expressive: def cost -0.006. Step Up/OT: def cost. Disciplined dribbling: def +0.005.
    def: mod.def + st.defLine * -0.012 + (st.possLost === -1 ? 0.010 : st.possLost === 1 ? -0.008 : 0) + (st.dlBehavior === -1 ? 0.012 : st.dlBehavior === 1 ? -0.005 : st.dlBehavior === 2 ? -0.008 : 0) + (st.creativity === 1 ? -0.006 : 0) + (st.dribbling === -1 ? 0.005 : 0),
    // WBiB: removed lr reduction (was double-positive). SoS: keeps lr increase.
    lr: mod.lr + (st.chanceCreation === 1 ? 0.04 : st.chanceCreation === -1 ? -0.02 : 0),
    corn: mod.corn * (st.setPieces === 1 ? 1.2 : 1.0), maxT: mod.maxT, minT: mod.minT,
  };
}
function lmResolveCorner(s, rng, dm, atk, def, atkE, defE, nm) {
  const sm = Math.pow(atkE / defE, 0.3);
  const r = rng.u();
  const cornerPl = s.players[atk].filter(p => p.pos !== "GK"); const scorer = pickPlayer(rng, cornerPl.length > 0 ? cornerPl : s.players[atk], "corner");
  const cGk = s.players[def].find(p => p.pos === "GK");
  const cEmergency = cGk?.emergencyGK ? EMERGENCY_GK_SAVE_PENALTY : 0;
  const cGoalP = 0.04 * sm * TIER_CONV[scorer.tier || 0] + cEmergency;
  const cGkBonus = TIER_GK_SAVE[cGk?.tier || 0] - cEmergency;
  if(s.xG) s.xG[atk] = (s.xG[atk]||0) + cGoalP;
  if (r < cGoalP) {
    s.score[atk === "home" ? 0 : 1]++; s.stats[atk].shots++; s.stats[atk].onTarget++; if(s.goalscorers)s.goalscorers[atk].push({name:scorer.name,min:dm,method:"header"});
    scorer.goals++;let _astCrn;{const ti=atk==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;scorer.rating=Math.min(10,+(scorer.rating+goalAtkMult(scorer.atkW)*gCtx).toFixed(2));_astCrn=assistPlayer(rng,s.players[atk],scorer.name,0);if(_astCrn)_astCrn.rating=Math.max(3,Math.min(10,+(_astCrn.rating+0.6*assistAtkMult(_astCrn.atkW)*aCtx).toFixed(2)));}
    {const _t=goalText(rng,"corner_goal_desc",s,nm,scorer,_astCrn),_g=genGoalViz(rng,"corner",scorer.name,_astCrn?_astCrn.name:null);gvSync(_t,_g);s.events.push({min:dm, type:"goal", team:atk, text:"\u26BD "+_t, goalViz:_g});}
    s.ball = 2; s.pressure = 0; s.possession = def; s.stoppageBank += 45; s.momentum[atk] = 4;
  } else if (r < (0.10 + cGkBonus) * sm) {
    s.stats[atk].shots++; s.stats[atk].onTarget++;
    if (cGk) cGk.saves = (cGk.saves || 0) + 1;
    s.events.push({min:dm, type:"save", team:atk, text:"\uD83E\uDDE4 " + comm(rng,"corner_save",{t:nm[atk],o:nm[def],n:scorer.name},s)});
    if (rng.u() < 0.25) {
      s.stats[atk].corners++;
      s.events.push({min:dm, type:"corner", team:atk, text:"\uD83C\uDFF4 "+comm(rng,"corner_again",{t:nm[atk]},s)});
      lmResolveCorner(s, rng, dm, atk, def, atkE, defE, nm);
    } else { s.possession = def; s.ball = 2; s.pressure = 0; }
  } else if (r < 0.18) {
    // Miss — 12% chance of hitting the bar
    s.stats[atk].shots++;
    if (rng.u() < 0.12) {
      s.stats[atk].woodwork=(s.stats[atk].woodwork||0)+1;
      s.events.push({min:dm, type:"woodwork", team:atk, text:"\uD83E\uDEA8 "+comm(rng,"woodwork_hdr",{t:nm[atk],o:nm[def],n:scorer.name},s)});
    } else {
      s.events.push({min:dm, type:"miss", team:atk, text:"\uD83D\uDCA8 " + comm(rng,"corner_miss",{t:nm[atk],o:nm[def],n:scorer.name},s)});
    }
    s.possession = def; s.ball = 2; s.pressure = 0;
  } else if (r < 0.43) {
    s.events.push({min:dm, type:"neutral", text:comm(rng,"corner_retain",{t:nm[atk],o:nm[def]},s)});
    s.ball = atk === "home" ? 3 : 1; s.pressure = Math.min(s.pressure + 1, 4);
  } else {
    // Clear — 2% chance of own goal
    if (rng.u() < 0.02) {
      const defPlayers = s.players[def].filter(p => p.pos === "DEF");
      const ogPlayer = defPlayers.length > 0 ? defPlayers[Math.floor(rng.u()*defPlayers.length)] : s.players[def].find(p=>p.pos!=="GK");
      if (ogPlayer) {
        s.score[atk === "home" ? 0 : 1]++;
        if(s.goalscorers)s.goalscorers[atk].push({name:ogPlayer.name,min:dm,method:"og",ogTeam:nm[def]});
        ogPlayer.rating=Math.max(3,+(ogPlayer.rating-1.0).toFixed(1));
        {const _t=ownGoalText(rng,s,nm,ogPlayer),_g=genGoalViz(rng,"og",ogPlayer.name,null);gvSync(_t,_g);s.events.push({min:dm, type:"goal", team:atk, text:"\u26BD "+_t, goalViz:_g});}
        s.ball = 2; s.pressure = 0; s.possession = def; s.stoppageBank += 45; s.momentum[atk] = 3;
      } else {
        s.events.push({min:dm, type:"clearance", text:comm(rng,"corner_clear",{t:nm[atk],o:nm[def]},s)});
        s.possession = def; s.ball = 2; s.pressure = 0;
      }
    } else {
      {const _dfs=s.players[def].filter(p=>p.pos==="DEF");if(_dfs.length){const _dp=pickPlayer(rng,_dfs,"any");_dp.defActs=(_dp.defActs||0)+1;}}
      s.events.push({min:dm, type:"clearance", text:comm(rng,"corner_clear",{t:nm[atk],o:nm[def]},s)});
      s.possession = def; s.ball = 2; s.pressure = 0;
    }
  }
}
function lmResolveShot(s, rng, dm, atk, def, atkE, defE, nm, method) {
  const shooter = pickPlayer(rng, s.players[atk].filter(p=>p.pos!=="GK"), "goal");
  s.stats[atk].shots++;
  const sGk = s.players[def].find(p => p.pos === "GK");
  const sEmergency = sGk?.emergencyGK ? EMERGENCY_GK_SAVE_PENALTY : 0;
  const goalP = (0.13+(s.modifiers?s.modifiers[atk]:applyStrategy(mergeModifiers(STYLE_MOD[s.styles?.[atk]]||STYLE_MOD.balanced, FORM_MOD[s.formations?.[atk]]), s.strategy?.[atk])).goalP) * Math.pow(atkE/defE, 0.5) * TIER_CONV[shooter.tier || 0] + sEmergency;
  const saveP = Math.max(0.02, 0.16+0.16*defE/(atkE+defE) + TIER_GK_SAVE[sGk?.tier || 0] - sEmergency);
  if(s.xG) s.xG[atk] = (s.xG[atk]||0) + goalP;
  const roll = rng.u();
  if (roll < goalP) {
    // Goal — check for deflection (8%)
    const isDeflection = rng.u() < 0.08;
    const finalMethod = isDeflection ? "deflection" : (method||null);
    s.score[atk==="home"?0:1]++; s.stats[atk].onTarget++; if(s.goalscorers)s.goalscorers[atk].push({name:shooter.name,min:dm,method:finalMethod});
    shooter.goals++;let _ast;{const ti=atk==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;shooter.rating=Math.min(10,+(shooter.rating+goalAtkMult(shooter.atkW)*gCtx).toFixed(2));_ast=assistPlayer(rng,s.players[atk],shooter.name,0);if(_ast)_ast.rating=Math.max(3,Math.min(10,+(_ast.rating+0.6*assistAtkMult(_ast.atkW)*aCtx).toFixed(2)));}
    s.players[def].forEach(p=>{if(p.pos==="GK")p.rating=Math.max(3,+(p.rating-0.15).toFixed(2));else if(p.pos==="DEF")p.rating=Math.max(3,+(p.rating-0.08).toFixed(2));});
    {const _t=goalText(rng,isDeflection?"deflection_desc":"goal_desc",s,nm,shooter,_ast),_g=genGoalViz(rng,finalMethod,shooter.name,_ast?_ast.name:null);gvSync(_t,_g);s.events.push({min:dm,type:"goal",team:atk,text:"\u26BD "+_t,goalViz:_g});}
    s.ball=2;s.pressure=0;s.possession=def;s.stoppageBank+=45;s.momentum[atk]=4;
  } else if (roll < goalP+saveP) {
    // Save — check for GK error (3%) or tipped onto woodwork (8%)
    const gkErrRoll = rng.u();
    if (gkErrRoll < 0.012) {
      // GK error → goal
      s.score[atk==="home"?0:1]++; s.stats[atk].onTarget++; if(s.goalscorers)s.goalscorers[atk].push({name:shooter.name,min:dm,method:"gk-error"});
      shooter.goals++;let _astGk;{const ti=atk==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;shooter.rating=Math.min(10,+(shooter.rating+goalAtkMult(shooter.atkW)*gCtx).toFixed(2));_astGk=assistPlayer(rng,s.players[atk],shooter.name,0);if(_astGk)_astGk.rating=Math.max(3,Math.min(10,+(_astGk.rating+0.6*assistAtkMult(_astGk.atkW)*aCtx).toFixed(2)));}
      const gk=s.players[def].find(p=>p.pos==="GK");if(gk)gk.rating=Math.max(3,+(gk.rating-0.8).toFixed(1));
      s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.max(3,+(p.rating-0.08).toFixed(1));});
      {const _t=goalText(rng,"gk_error_desc",s,nm,shooter,_astGk),_g=genGoalViz(rng,"gk-error",shooter.name,_astGk?_astGk.name:null);gvSync(_t,_g);s.events.push({min:dm,type:"goal",team:atk,text:"\u26BD "+_t,goalViz:_g});}
      s.ball=2;s.pressure=0;s.possession=def;s.stoppageBank+=45;s.momentum[atk]=4;
    } else if (gkErrRoll < 0.09) {
      // Tipped onto woodwork
      s.stats[atk].onTarget++;s.stats[atk].woodwork=(s.stats[atk].woodwork||0)+1;
      ratePlayer(s.players[atk],shooter.name,0.15);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.03).toFixed(2));});{const _dfs=s.players[def].filter(p=>p.pos==="DEF");if(_dfs.length){const _dp=pickPlayer(rng,_dfs,"any");_dp.defActs=(_dp.defActs||0)+1;}}
      s.events.push({min:dm,type:"woodwork",team:atk,text:"\uD83E\uDEA8 "+comm(rng,"woodwork_save",{t:nm[atk],o:nm[def],n:shooter.name},s)});
      if(rng.u()<0.50){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 "+comm(rng,"corner_rebound",{t:nm[atk]},s)});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
      else{s.possession=def;s.ball=2;s.pressure=0;}
    } else {
      // Normal save
      s.stats[atk].onTarget++;{const gk=s.players[def].find(p=>p.pos==="GK");if(gk){gk.rating=Math.min(10,+(gk.rating+0.2).toFixed(2));gk.saves=(gk.saves||0)+1;}ratePlayer(s.players[atk],shooter.name,0.15);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.03).toFixed(2));});const _dfs=s.players[def].filter(p=>p.pos==="DEF");if(_dfs.length){const _dp=pickPlayer(rng,_dfs,"any");_dp.defActs=(_dp.defActs||0)+1;}}
      s.events.push({min:dm,type:"save",team:atk,text:"\uD83E\uDDE4 "+comm(rng,"save",{t:nm[atk],o:nm[def],n:shooter.name},s)});
      if(rng.u()<0.45){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 "+comm(rng,"corner_won",{t:nm[atk],o:nm[def]},s)});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
      else{
        const gkD = s.strategy?.[def]?.gkDist || 0;
        s.pressure=0;
        if (gkD === -1) { s.ball = def === "home" ? 1 : 3; s.possession = def; }
        else if (gkD === 1) { if (rng.u() < 0.6) { s.possession = atk; s.ball = 2; } else { s.possession = def; s.ball = def === "home" ? 3 : 1; } }
        else { s.ball = 2; s.possession = def; }
      }
    }
  } else {
    // Miss — check for woodwork (15%)
    if (rng.u() < 0.18) {
      s.stats[atk].woodwork=(s.stats[atk].woodwork||0)+1;
      ratePlayer(s.players[atk],shooter.name,0.1);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.02).toFixed(2));});{const _dfs=s.players[def].filter(p=>p.pos==="DEF");if(_dfs.length){const _dp=pickPlayer(rng,_dfs,"any");_dp.defActs=(_dp.defActs||0)+1;}}
      s.events.push({min:dm,type:"woodwork",team:atk,text:"\uD83E\uDEA8 "+comm(rng,"woodwork",{t:nm[atk],o:nm[def],n:shooter.name},s)});
      if(rng.u()<0.40){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 "+comm(rng,"corner_rebound",{t:nm[atk]},s)});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
      else{s.possession=def;s.ball=2;s.pressure=0;}
    } else {
      ratePlayer(s.players[atk],shooter.name,-0.05);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.02).toFixed(2));});{const _dfs=s.players[def].filter(p=>p.pos==="DEF");if(_dfs.length){const _dp=pickPlayer(rng,_dfs,"any");_dp.defActs=(_dp.defActs||0)+1;}}s.events.push({min:dm,type:"miss",team:atk,text:"\uD83D\uDCA8 "+comm(rng,"miss",{t:nm[atk],o:nm[def],n:shooter.name},s)});
      if(rng.u()<0.30){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 "+comm(rng,"corner_won",{t:nm[atk],o:nm[def]},s)});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
      else{
        const gkD = s.strategy?.[def]?.gkDist || 0;
        s.pressure=0;
        if (gkD === -1) { s.ball = def === "home" ? 1 : 3; s.possession = def; }
        else if (gkD === 1) { if (rng.u() < 0.6) { s.possession = atk; s.ball = 2; } else { s.possession = def; s.ball = def === "home" ? 3 : 1; } }
        else { s.ball = 2; s.possession = def; }
      }
    }
  }
}
function lmHandleCard(s, rng, dm, team, fouler, nm, cardChance) {
  const fn = fouler?.name || String(fouler);
  if (rng.u() >= cardChance) return;
  if (rng.u() < 0.015 && s.players[team].length > 7) {
    const rcVariant = pickRedCardVariant(rng, fouler?.pos);
    const cmKey = "red_" + rcVariant;
    s.stats[team].reds++; {const rp=s.players[team].find(p=>p.name===fn);if(rp){rp.rc=true;rp.rcVariant=rcVariant;ratePlayer(s.players[team],fn,-2.0);s.subbedOff[team].push({...rp});}} s.players[team] = s.players[team].filter(p => p.name !== fn);
    s.events.push({min:dm,type:"red",team,player:fn,rcVariant,text:"\uD83D\uDFE5 "+comm(rng,cmKey,{t:nm[team],n:fn,c:s.players[team].length},s)});
    s.stoppageBank+=60;
    ensureGoalkeeper(s, team, dm, nm, rng);
  } else if (s.booked[team].includes(fn)) {
    s.stats[team].yellows++; s.stats[team].reds++; s.stats[team].secondYellows=(s.stats[team].secondYellows||0)+1; {const rp=s.players[team].find(p=>p.name===fn);if(rp){rp.rc=true;ratePlayer(s.players[team],fn,-2.0);s.subbedOff[team].push({...rp});}} s.players[team] = s.players[team].filter(p => p.name !== fn);
    s.events.push({min:dm,type:"red",team,player:fn,text:"\uD83D\uDFE5 "+comm(rng,"second_yellow",{t:nm[team],n:fn,c:s.players[team].length},s)});
    s.stoppageBank+=60;
    ensureGoalkeeper(s, team, dm, nm, rng);
  } else {
    s.stats[team].yellows++; s.booked[team].push(fn); ratePlayer(s.players[team],fn,-0.3); {const yp=s.players[team].find(p=>p.name===fn);if(yp)yp.yc++;}
    s.events.push({min:dm,type:"yellow",team,text:"\uD83D\uDFE8 "+comm(rng,"yellow",{t:nm[team],n:fn},s)});
    s.stoppageBank+=30;
  }
}
// If a team has no recognized keeper left on the pitch, bring on the backup keeper for an
// outfield player (using a substitution, if one's still available); failing that, a random
// outfield player takes the gloves as an emergency stand-in (no substitution used — they're
// just repositioned, same as happens on a real pitch when the bench keeper is unavailable).
function ensureGoalkeeper(s, side, dm, nm, rng) {
  if (s.players[side].some(p => p.pos === "GK")) return;
  const sn = nm[side];
  const benchIdx = s.bench[side].findIndex(p => p.pos === "GK");
  if (benchIdx !== -1 && s.subs[side] < 3 && s.players[side].length > 0) {
    s.subs[side]++;
    const subOn = s.bench[side].splice(benchIdx, 1)[0];
    subOn.sub = 'on'; subOn.rating = 6.5; subOn.chances = 0; subOn.defActs = 0; subOn.saves = 0;
    const subOff = pick(rng, s.players[side]);
    s.players[side] = s.players[side].filter(p => p.name !== subOff.name);
    s.subbedOff[side].push({...subOff, sub: 'off'});
    s.players[side].push(subOn);
    s.events.push({min:dm,type:"sub",text:"🔄 "+sn+"'s backup keeper "+subOn.name+" comes on for "+subOff.name+" to take over between the posts.",offName:subOff.name,onName:subOn.name,reason:"Goalkeeper cover",offPos:subOff.pos,offRating:subOff.rating,onPos:subOn.pos});
  } else {
    const promoted = pick(rng, s.players[side]);
    promoted.pos = "GK"; promoted.emergencyGK = true;
    s.events.push({min:dm,type:"neutral",text:"🧤 With no keeper left, "+sn+"'s "+promoted.name+" pulls on the gloves as an emergency stand-in."});
  }
}

// ═══ ZONE-BASED MINUTE SIMULATION ═══════════════════════════════════════════
function staminaMod(stam) { return 1 - Math.pow((100 - Math.max(0, stam)) / 100, 1.5) * 0.25; }
function lmSimMinute(s, rng, home, away) {
  const dm = lmDisplayMin(s.phase,s.minute,s.stoppageElapsed);
  let hE = lmEffSkill(home.skill,s.stats.home.reds,s.minute) * (1 + s.momentum.home * 0.02) * staminaMod(s.stamina.home), aE = lmEffSkill(away.skill,s.stats.away.reds,s.minute) * (1 + s.momentum.away * 0.02) * staminaMod(s.stamina.away);
  if (s.promoDebuff) { hE *= (1 - (s.promoDebuff.home || 0)); aE *= (1 - (s.promoDebuff.away || 0)); }
  if (s.homeAdv === "home") hE *= 1.03; else if (s.homeAdv === "away") aE *= 1.03;
  if(s.momentum.home > 0) s.momentum.home--;
  if(s.momentum.away > 0) s.momentum.away--;
  const nm = {home:home.name,away:away.name};

  // Tactics (with style constraints + skill mismatch)
  const diff=(s.score[0]+(s.startScore?.[0]||0))-(s.score[1]+(s.startScore?.[1]||0)), rem=s.minute<=90?90-s.minute:120-s.minute;
  const sDef=(s.startScore?.[0]||0)-(s.startScore?.[1]||0);
  const skAdv = (hE - aE) / Math.max(hE, aE, 1);
  const pH=s.tactics.home, pA=s.tactics.away;
  if(s.allowTacChange?.home!==false){s.tactics.home=clampTac(autoTac(rng,diff,rem,sDef<0?Math.abs(sDef)*20:0,s.styles.home,s.tactics.home,skAdv,s.matchUrg?.home),s.styles.home);}
  if(s.allowTacChange?.away!==false){s.tactics.away=clampTac(autoTac(rng,-diff,rem,sDef>0?sDef*20:0,s.styles.away,s.tactics.away,-skAdv,s.matchUrg?.away),s.styles.away);}
  if(s.tactics.home!==pH&&TAC_MSG[s.tactics.home])s.events.push({min:dm,type:"phase",text:"\uD83D\uDCCB "+home.name+" "+TAC_MSG[s.tactics.home]+"."});
  if(s.tactics.away!==pA&&TAC_MSG[s.tactics.away])s.events.push({min:dm,type:"phase",text:"\uD83D\uDCCB "+away.name+" "+TAC_MSG[s.tactics.away]+"."});

  // Possession setup + style modifiers
  let po=s.possession, op=po==="home"?"away":"home";
  let poE=po==="home"?hE:aE, opE=op==="home"?hE:aE;
  const dir0=po==="home"?1:-1;
  const z=s.ball;
  const poM=s.modifiers?s.modifiers[po]:applyStrategy(mergeModifiers(STYLE_MOD[s.styles?.[po]]||STYLE_MOD.balanced, FORM_MOD[s.formations?.[po]]), s.strategy?.[po]);
  const opM=s.modifiers?s.modifiers[op]:applyStrategy(mergeModifiers(STYLE_MOD[s.styles?.[op]]||STYLE_MOD.balanced, FORM_MOD[s.formations?.[op]]), s.strategy?.[op]);

  // Time wasting (dead minute when leading)
  const poSt = s.strategy?.[po] || STRAT_DEF;
  if (poSt.timeWasting > 0) {
    const scoreDiff = po === "home" ? (s.score[0]+(s.startScore?.[0]||0)) - (s.score[1]+(s.startScore?.[1]||0)) : (s.score[1]+(s.startScore?.[1]||0)) - (s.score[0]+(s.startScore?.[0]||0));
    if (scoreDiff > 0) {
      const twProb = poSt.timeWasting === 2 ? 0.45 : 0.25;
      if (rng.u() < twProb) {
        s.stoppageBank += poSt.timeWasting === 2 ? 25 : 15;
        s.events.push({min:dm, type:"neutral", text:comm(rng,"time_waste",{t:nm[po],o:nm[po==="home"?"away":"home"]},s)});
        if (poSt.timeWasting === 2 && rng.u() < 0.025) { const waster = pickPlayer(rng, s.players[po], "foul"); lmHandleCard(s, rng, dm, po, waster, nm, 1.0); }
        return;
      }
    }
  }

  // Creative freedom — brilliant chance (expressive: 4% chance to skip to shooting zone)
  if (poSt.creativity === 1 && rng.u() < 0.04) {
    s.ball = po === "home" ? 4 : 0; s.pressure = 1;
    {const mp=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"goal");s.events.push({min:dm, type:"chance", team:po, text:"\u2728 "+comm(rng,"chance_magic",{t:nm[po],n:mp.name},s)});}
    lmResolveShot(s, rng, dm, po, op, poE, opE, nm);
    return;
  }

  // Pressing
  const pressDiff=Math.max(0,(opE-poE)/(opE+poE));
  let pressMult=opM.press;
  const poMidTier = s.players[po].reduce((a, p) => a + (p.pos === "MID" ? TIER_MID_CTRL[p.tier || 0] : 0), 0);
  const pressChance=(0.28*Math.tanh(5*pressDiff)*pressMult) - poMidTier;
  if(pressChance>0&&rng.u()<pressChance){
    s.possession=op;s.possCount[op]++;
    s.events.push({min:dm,type:"press",text:comm(rng,"press_won",{t:nm[op]},s)});
    return;
  }
  s.possCount[po]++;

  const dir=dir0;
  const dg=po==="home"?(4-z):z; // distance to goal (0=in opponent box)

  // Foul (modified by dribbling + tackling)
  const dribbleFoulMod = poSt.dribbling === 1 ? 1.25 : poSt.dribbling === -1 ? 0.9 : 1.0;
  const opSt = s.strategy?.[op] || STRAT_DEF;
  const tackleFoulMod = opSt.tackling === 1 ? 1.3 : opSt.tackling === -1 ? 0.75 : 1.0;
  const tackleCardMod = opSt.tackling === 1 ? 1.4 : opSt.tackling === -1 ? 0.65 : 1.0;
  if(rng.u()<0.15*dribbleFoulMod*tackleFoulMod){
    let fouler=pickPlayer(rng,s.players[op],"foul");
    if(s.booked[op].includes(fouler.name)&&rng.u()<0.92){const ub=s.players[op].filter(p=>!s.booked[op].includes(p.name));if(ub.length>0)fouler=pick(rng,ub);}
    s.stats[op].fouls++;
    if(dg===0&&rng.u()<0.35){
      // Penalty — award now, defer the kick to the next tick so auto-play can pause before it is taken
      s.events.push({min:dm,type:"penalty",team:po,text:"\uD83C\uDFAF "+comm(rng,"foul_pen",{t:nm[po],o:nm[op],n:fouler.name},s)});s.stoppageBank+=90;s.stats[po].penalties++;
      ratePlayer(s.players[op],fouler.name,-0.3);lmHandleCard(s,rng,dm,op,fouler,nm,0.55*tackleCardMod);
      const taker=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"penalty");
      s.pendingPenalty={po,op,taker:taker.name,dm};
      return;
    }
    s.events.push({min:dm,type:"foul",team:op,text:"\u26A0\uFE0F "+comm(rng,"foul",{t:nm[op],n:fouler.name,o:nm[po]},s)});s.stoppageBank+=15;
    ratePlayer(s.players[op],fouler.name,-0.1);lmHandleCard(s,rng,dm,op,fouler,nm,0.28*tackleCardMod);
    // Free kick shot in dangerous positions
    if(dg<=1&&rng.u()<0.18){s.stats[po].shots++;const fkShooter=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any");s.events.push({min:dm,type:"neutral",text:comm(rng,"free_kick",{t:nm[po],n:fkShooter.name},s)});}
    else if(dg>1)s.ball+=dir; // free kick advances position
    return;
  }

  // === SHOOTING ZONE (dg===0) ===
  if(dg===0){
    s.pressure++;
    if(s.pressure>1)s.events.push({min:dm,type:"press",text:comm(rng,"pressure",{t:nm[po],o:nm[op]},s)});
    const effDef=opM.def/(1+Math.abs(opM.def)*8);
    const defTierMod = s.players[op].reduce((a, p) => a + ((p.pos === "DEF" || p.pos === "GK") ? TIER_DEF_SHOT[p.tier || 0] : 0), 0);
    let shotP=0.55+0.14*poE/(poE+opE)+Math.min(s.pressure*0.03,0.12)+poM.boxShot-effDef-defTierMod;
    if(s.tactics[op]==="def")shotP-=0.08;if(s.tactics[op]==="park")shotP-=0.18;if(s.tactics[op]==="atk")shotP+=0.04;if(s.tactics[op]==="ultra")shotP+=0.10;
    if(rng.u()<shotP){lmResolveShot(s,rng,dm,po,op,poE,opE,nm);return;}
    // No shot — keep or lose ball
    const keepP=0.35+0.10*poE/(poE+opE)+(s.strategy?.[po]?.chanceCreation===-1?0.04:0);
    if(rng.u()<keepP){s.events.push({min:dm,type:"buildup",text:(()=>{const sp=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any");sp.chances=(sp.chances||0)+1;if(rng.u()<0.5)ratePlayer(s.players[po],sp.name,0.10);return comm(rng,"sustain",{t:nm[po],o:nm[op],n:sp.name},s);})()});return;}
    // Cleared
    s.possession=op;s.pressure=0;{const _dfs=s.players[op].filter(p=>p.pos==="DEF");if(_dfs.length){const _dp=pickPlayer(rng,_dfs,"any");_dp.defActs=(_dp.defActs||0)+1;}}
    const defR=opE/(poE+opE),cl=rng.u();
    if(cl<0.35-0.20*defR){if(rng.u()<0.30){s.stats[po].corners++;s.possession=po;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 "+comm(rng,"corner_won",{t:nm[po],o:nm[op]},s)});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}else{s.ball=z===4?3:z===0?1:2;s.events.push({min:dm,type:"clearance",text:comm(rng,"clearance_edge",{t:nm[po],o:nm[op]},s)});}}
    else if(cl<0.70-0.20*defR){s.ball=2;s.events.push({min:dm,type:"clearance",text:comm(rng,"clearance_mid",{t:nm[po],o:nm[op]},s)});}
    else{
      const cm=rng.u()<0.30?2:1;s.ball=Math.max(0,Math.min(4,z-dir*cm));
      const od=op==="home"?(4-s.ball):s.ball;
      if(od===0){s.pressure=1;const cp2=pickPlayer(rng,s.players[op].filter(p=>p.pos!=="GK"),"any");cp2.chances=(cp2.chances||0)+1;ratePlayer(s.players[op],cp2.name,0.12);s.events.push({min:dm,type:"counter",team:op,text:"\u26A1 "+comm(rng,"counter",{t:nm[op],o:nm[po],n:cp2.name},s)});if(rng.u()<0.25+0.30*opE/(opE+poE)+opM.ctrShot)lmResolveShot(s,rng,dm,op,po,opE,poE,nm,"counter");}
      else s.events.push({min:dm,type:"clearance",text:comm(rng,"transition",{t:nm[po],o:nm[op]},s)});
    }
    return;
  }

  // === BUILDUP ZONES (dg 1-4) ===
  // Long-range shot from opponent's half (dg===1, 12% chance)
  if(dg===1&&rng.u()<Math.max(0.04,0.24+poM.lr)){
    const shooter=pickPlayer(rng,s.players[po],"any");s.stats[po].shots++;
    const lrScorer=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"longGoal");lrScorer.chances=(lrScorer.chances||0)+1;const lrGoal=0.05*Math.pow(poE/opE,0.5)*TIER_CONV[lrScorer.tier||0],lrSave=0.23;
    if(s.xG) s.xG[po] = (s.xG[po]||0) + lrGoal;
    const lr=rng.u();
    if(lr<lrGoal){s.score[po==="home"?0:1]++;s.stats[po].onTarget++;s.goalscorers[po].push({name:lrScorer.name,min:dm,method:"long-range"});lrScorer.goals++;let _astLr;{const ti=po==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;lrScorer.rating=Math.min(10,+(lrScorer.rating+goalAtkMult(lrScorer.atkW)*gCtx).toFixed(2));_astLr=assistPlayer(rng,s.players[po],lrScorer.name,0);if(_astLr)_astLr.rating=Math.max(3,Math.min(10,+(_astLr.rating+0.6*assistAtkMult(_astLr.atkW)*aCtx).toFixed(2)));}{const _t=goalText(rng,"goal_lr_desc",s,nm,lrScorer,_astLr),_g=genGoalViz(rng,"long-range",lrScorer.name,_astLr?_astLr.name:null);gvSync(_t,_g);s.events.push({min:dm,type:"goal",team:po,text:"\u26BD "+_t,goalViz:_g});}s.ball=2;s.pressure=0;s.possession=op;s.stoppageBank+=45;s.momentum[po]=4;}
    else if(lr<lrGoal+lrSave){s.stats[po].onTarget++;ratePlayer(s.players[po],lrScorer.name,0.1);{const gk=s.players[op].find(p=>p.pos==="GK");if(gk){gk.rating=Math.min(10,+(gk.rating+0.15).toFixed(2));gk.saves=(gk.saves||0)+1;}}s.events.push({min:dm,type:"save",team:po,text:"\uD83E\uDDE4 "+comm(rng,"save_lr",{t:nm[po],o:nm[op],n:lrScorer.name},s)});if(rng.u()<0.40){s.stats[po].corners++;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 "+comm(rng,"corner_won",{t:nm[po],o:nm[op]},s)});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}}
    else{s.events.push({min:dm,type:"miss",team:po,text:"\uD83D\uDCA8 "+comm(rng,"miss_lr",{t:nm[po],n:lrScorer.name},s)});if(rng.u()<0.25){s.stats[po].corners++;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 "+comm(rng,"corner_won",{t:nm[po],o:nm[op]},s)});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}}
    return;
  }
  // Standalone corner from cross (4% in attacking territory)
  if(dg<=2&&rng.u()<0.04*poM.corn){
    s.stats[po].corners++;
    s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 "+comm(rng,"corner_won",{t:nm[po],o:nm[op]},s)});
    lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);
    return;
  }
  const advBase=0.42;
  const advSkill=0.28*(poE-opE)/(poE+opE);
  const advZone=dg===1?-0.06:dg>=3?0.05:0;
  const opMidTier = s.players[op].reduce((a, p) => a + (p.pos === "MID" ? TIER_MID_CTRL[p.tier || 0] : 0), 0);
  let advP=advBase+advSkill+advZone+poM.adv+poMidTier-opMidTier;
  const pT=s.tactics[po],oT=s.tactics[op];
  if(pT==="ultra")advP+=0.09;else if(pT==="atk")advP+=0.05;
  if(oT==="def")advP-=0.04;if(oT==="park")advP-=0.08;
  advP=Math.max(0.10,Math.min(0.60,advP));
  const holdP=Math.max(0.05,0.10+0.22*poE/(poE+opE)+poM.hold*0.6),longP=Math.max(0.01,0.06+(pT==="ultra"?0.04:pT==="atk"?0.02:0)+poM.lb);

  const roll=rng.u();
  if(roll<advP){
    // Advance with ball
    s.ball+=dir;const nd=po==="home"?(4-s.ball):s.ball;
    // Offside check (6% when entering final third or box)
    const dlBeh = s.strategy?.[op]?.dlBehavior || 0;
    let offsideMod = 1 + (s.strategy?.[op]?.defLine || 0) * 0.2;
    if (dlBeh === 1) offsideMod += 0.25;
    if (dlBeh === 2) offsideMod += 0.60;
    const offsideRate = 0.06 * offsideMod;
    if(nd<=1&&rng.u()<offsideRate){
      if (dlBeh === 2 && rng.u() < 0.15) {
        s.ball = po === "home" ? 4 : 0; s.pressure = 1;
        {const tb=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any");s.events.push({min:dm, type:"chance", team:po, text:"\u26A1 "+comm(rng,"trap_beaten",{t:nm[po],n:tb.name},s)});}
        lmResolveShot(s, rng, dm, po, op, poE * 1.25, opE, nm, "counter");
        return;
      }
      s.ball-=dir;s.possession=op;s.events.push({min:dm,type:"offside",team:po,text:"\uD83D\uDEA9 "+comm(rng,"offside",{t:nm[po],o:nm[op],n:pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any").name},s)});return;
    }
    if(nd===0){s.pressure=1;s.events.push({min:dm,type:"chance",team:po,text:(()=>{const cp=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"goal");cp.chances=(cp.chances||0)+1;ratePlayer(s.players[po],cp.name,0.15);return comm(rng,"enter_box",{t:nm[po],o:nm[op],n:cp.name},s);})()});if(rng.u()<0.25+0.35*poE/(poE+opE))lmResolveShot(s,rng,dm,po,op,poE,opE,nm);}
    else s.events.push({min:dm,type:"buildup",text:(()=>{const bp=pickPlayer(rng,s.players[po],"any");bp.chances=(bp.chances||0)+1;if(rng.u()<0.4)ratePlayer(s.players[po],bp.name,0.08);return comm(rng,"buildup",{t:nm[po],o:nm[op],n:bp.name},s);})()});
  }else if(roll<advP+holdP){
    // Hold ball
    s.events.push({min:dm,type:"neutral",text:comm(rng,"z_neutral",{t:nm[po],o:nm[op],n:pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any").name},s)});
  }else if(roll<advP+holdP+longP){
    // Long ball
    s.ball=Math.max(0,Math.min(4,z+dir*2));const nd=po==="home"?(4-s.ball):s.ball;
    if(nd===0){s.pressure=1;s.events.push({min:dm,type:"chance",team:po,text:(()=>{const cp=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"goal");cp.chances=(cp.chances||0)+1;ratePlayer(s.players[po],cp.name,0.15);return comm(rng,"enter_box",{t:nm[po],o:nm[op],n:cp.name},s);})()});if(rng.u()<0.25+0.35*poE/(poE+opE))lmResolveShot(s,rng,dm,po,op,poE,opE,nm);}
    else if(rng.u()<0.45){s.events.push({min:dm,type:"neutral",text:comm(rng,"long_ball",{t:nm[po],o:nm[op]},s)});}
    else{s.possession=op;s.events.push({min:dm,type:"clearance",text:comm(rng,"long_ball",{t:nm[po],o:nm[op]},s)});}
  }else{
    // Turnover — but 20% are fouls that give ball back
    const tTackle = s.strategy?.[op]?.tackling || 0;
    if(rng.u()<0.20*(tTackle===1?1.3:tTackle===-1?0.75:1.0)){s.stats[op].fouls++;let fouler=pickPlayer(rng,s.players[op],"foul");if(s.booked[op].includes(fouler.name)&&rng.u()<0.92){const ub=s.players[op].filter(p=>!s.booked[op].includes(p.name));if(ub.length>0)fouler=pick(rng,ub);}s.events.push({min:dm,type:"foul",team:op,text:"\u26A0\uFE0F "+comm(rng,"foul",{t:nm[op],n:fouler.name,o:nm[po]},s)});s.stoppageBank+=15;lmHandleCard(s,rng,dm,op,fouler,nm,0.22*(tTackle===1?1.4:tTackle===-1?0.65:1.0));return;}
    s.possession=op;
    const ctrP=(dg<=2?0.14:0.06)*opM.ctr;
    if(rng.u()<ctrP){
      const cm=rng.u()<0.5?2:1;s.ball=Math.max(0,Math.min(4,z-dir*cm));
      const od=op==="home"?(4-s.ball):s.ball;
      if(od===0){s.pressure=1;const cp2=pickPlayer(rng,s.players[op].filter(p=>p.pos!=="GK"),"any");cp2.chances=(cp2.chances||0)+1;ratePlayer(s.players[op],cp2.name,0.12);s.events.push({min:dm,type:"counter",team:op,text:"\u26A1 "+comm(rng,"counter",{t:nm[op],o:nm[po],n:cp2.name},s)});if(rng.u()<0.25+0.30*opE/(opE+poE)+opM.ctrShot)lmResolveShot(s,rng,dm,op,po,opE,poE,nm,"counter");}
      else s.events.push({min:dm,type:"counter",text:comm(rng,"transition",{t:nm[po],o:nm[op]},s)});
    }else s.events.push({min:dm,type:"neutral",text:comm(rng,"transition",{t:nm[po],o:nm[op]},s)});
  }
  // Stamina drain
  for (const side of ["home","away"]) {
    const sm = s.modifiers ? s.modifiers[side] : mergeModifiers(STYLE_MOD[s.styles?.[side]]||STYLE_MOD.balanced, FORM_MOD[s.formations?.[side]]);
    const st = s.strategy?.[side] || STRAT_DEF;
    const stratDrain = Math.abs(st.passingDir) * 0.04
      + (st.pressingLOE > 0 ? st.pressingLOE * 0.04 : st.pressingLOE * 0.03)
      + Math.abs(st.defLine) * 0.03
      + (st.possWon === 1 ? 0.05 : st.possWon === -1 ? -0.04 : 0)
      + (st.approachPlay === 1 ? 0.05 : st.approachPlay === -1 ? -0.04 : 0)
      + (st.dribbling === 1 ? 0.06 : st.dribbling === -1 ? -0.03 : 0)
      + (st.creativity === 1 ? 0.03 : 0)
      + (st.timeWasting > 0 && ((side === "home" ? s.score[0] - s.score[1] : s.score[1] - s.score[0]) > 0) ? (st.timeWasting === 2 ? -0.15 : -0.08) : 0)
      + (st.possLost === 1 ? 0.13 : st.possLost === -1 ? -0.06 : 0)
      + (st.dlBehavior === 1 ? 0.02 : st.dlBehavior === 2 ? 0.03 : st.dlBehavior === -1 ? -0.03 : 0)
      + (st.tackling === 1 ? 0.04 : 0);
    const drain = 0.75 + (sm.press - 1) * 0.3 + (TAC_DRAIN[s.tactics[side]] || 0) + stratDrain;
    s.stamina[side] = Math.max(0, s.stamina[side] - Math.max(0.1, drain));
  }
  // Substitutions \u2014 weighted by rating, tier, and booking status
  for (const side of ["home","away"]) {
    if (s.subs[side] < 3 && s.bench[side].some(p => p.pos !== "GK")) {
      const scoreDiff = side === "home" ? (s.score[0]+(s.startScore?.[0]||0)) - (s.score[1]+(s.startScore?.[1]||0)) : (s.score[1]+(s.startScore?.[1]||0)) - (s.score[0]+(s.startScore?.[0]||0));
      const trailing = scoreDiff < 0;
      const windows = trailing ? [[50,55],[60,65],[70,75]] : [[58,62],[68,72],[78,82]];
      const prob = trailing ? 0.55 : 0.40;
      const w = windows[s.subs[side]];
      if (s.minute >= w[0] && s.minute <= w[1] && rng.u() < prob) {
        s.subs[side]++;s.stamina[side] = Math.min(100, s.stamina[side] + 4);
        const sn = side === "home" ? home.name : away.name;
        const cands = s.players[side].filter(p => p.pos !== "GK");
        const booked = s.booked[side] || [];
        const avgR = cands.reduce((a, p) => a + (p.rating || 6.5), 0) / cands.length;
        const subWeights = cands.map(p => {
          let sw = POS_W.subOff[p.pos] || 10;
          sw *= Math.pow(2, (avgR - (p.rating || 6.5)) * 0.5);
          if (p.tier === 2) sw *= 0.3; else if (p.tier === 1) sw *= 0.6;
          if (booked.includes(p.name)) sw *= 2.5;
          return { p, w: sw };
        });
        const swTotal = subWeights.reduce((a, x) => a + x.w, 0);
        let sr = rng.u() * swTotal;
        let subOff = subWeights[subWeights.length - 1].p;
        for (const x of subWeights) { sr -= x.w; if (sr <= 0) { subOff = x.p; break; } }
        const subOn = (()=>{ const b=s.bench[side]; const outIdx=b.findIndex(p=>p.pos!=="GK"); return b.splice(outIdx,1)[0]; })();
        subOn.sub='on'; subOn.rating=6.5; subOn.chances=0; subOn.defActs=0; subOn.saves=0; const off=s.players[side].find(p=>p.name===subOff.name); if(off){off.sub='off';s.subbedOff[side].push({...off});} s.players[side] = s.players[side].filter(p=>p.name!==subOff.name); s.players[side].push(subOn);
        const wasBooked = booked.includes(subOff.name);
        if (wasBooked) {
          s.booked[side] = s.booked[side].filter(p => p !== subOff.name);
          { const reason=fill(pick(rng,CM.sub_in),{t:sn,n:subOn.name,x:subOff.name}); s.events.push({min:dm,type:"sub",text:"\u21C4 "+sn+"'s "+subOff.name+" \u2192 "+subOn.name+". "+reason,offName:subOff.name,onName:subOn.name,reason,offPos:subOff.pos,offRating:subOff.rating,onPos:subOn.pos}); }
        } else {
          { const reason=fill(pick(rng,CM.sub_in),{t:sn,n:subOn.name,x:subOff.name}); s.events.push({min:dm,type:"sub",text:"\u21C4 "+sn+"'s "+subOff.name+" \u2192 "+subOn.name+". "+reason,offName:subOff.name,onName:subOn.name,reason,offPos:subOff.pos,offRating:subOff.rating,onPos:subOn.pos}); }
        }
      }
    }
  }
  // Injuries (~0.14 per game, rarer when fresh, more common when tired)
  if (s.injuriesEnabled !== false) for (const side of ["home","away"]) {
    const injRate = 0.0008 * (1 + (100 - s.stamina[side]) * 0.008);
    if (rng.u() < injRate && s.players[side].length > 7) {
      const injured = pick(rng, s.players[side]);
      const sn = side === "home" ? home.name : away.name;
      const { sev: injSev, part: injPart } = pickInjury(rng);
      const injTag = " " + injSev.label + " (" + injPart + ").";
      s.stoppageBank += 60; s.stats[side].injuries++;
      const isGK = injured.pos === "GK";
      const canSub = isGK
        ? (s.subs[side] < 3 && s.bench[side].some(p => p.pos === "GK"))
        : (s.subs[side] < 3 && s.bench[side].some(p => p.pos !== "GK"));
      if (canSub) {
        s.subs[side]++; s.stamina[side] = Math.min(100, s.stamina[side] + 2); injured.inj = true; injured.injSev = injSev.id; injured.injPart = injPart;
        const wasBooked = s.booked[side].includes(injured);
        if (wasBooked) s.booked[side] = s.booked[side].filter(p => p !== injured);
        s.events.push({min:dm,type:"injury",team:side,text:"\uD83E\uDD15 "+fill(pick(rng,CM.injury_event),{t:sn,n:injured.name})+injTag+(wasBooked ? " Was on a yellow." : "")});
        const subOn = (()=>{ const b=s.bench[side]; const outIdx = isGK ? b.findIndex(p=>p.pos==="GK") : b.findIndex(p=>p.pos!=="GK"); return b.splice(outIdx,1)[0]; })();
        subOn.sub='on'; subOn.rating=6.5; subOn.chances=0; subOn.defActs=0; subOn.saves=0; const off=s.players[side].find(p=>p.name===injured.name); if(off){off.sub='off';s.subbedOff[side].push({...off});} s.players[side] = s.players[side].filter(p=>p.name!==injured.name); s.players[side].push(subOn);
        { const reason=fill(pick(rng,CM.sub_in),{t:sn,n:subOn.name,x:injured.name}); s.events.push({min:dm,type:"sub",text:"\u21C4 "+sn+"'s "+injured.name+" \u2192 "+subOn.name+". "+reason,offName:injured.name,onName:subOn.name,reason,offPos:injured.pos,offRating:injured.rating,onPos:subOn.pos}); }
      } else {
        {const ip=s.players[side].find(p=>p.name===injured.name);if(ip){ip.inj=true;ip.injSev=injSev.id;ip.injPart=injPart;s.subbedOff[side].push({...ip});}} s.players[side] = s.players[side].filter(p => p.name !== injured.name);
        if (s.booked[side].includes(injured.name)) s.booked[side] = s.booked[side].filter(p => p !== injured.name);
        s.stats[side].injuriesNoSub++;
        s.events.push({min:dm,type:"injury",team:side,text:"\uD83E\uDD15 "+fill(pick(rng,CM.injury_event),{t:sn,n:injured.name})+injTag+" No subs remaining. "+sn+" down to "+s.players[side].length+" men."});
      }
      ensureGoalkeeper(s, side, dm, nm, rng);
    }
  }
  // Record momentum: ball position + possession bias, smoothed
  const rawMom = (s.ball - 2) / 2 + (s.possession === "home" ? 0.15 : -0.15) + (s.pressure * 0.08 * (s.possession === "home" ? 1 : -1));
  const prev = s.momHist.length > 0 ? s.momHist[s.momHist.length - 1].v : 0;
  const smoothed = prev * 0.6 + rawMom * 0.4;
  s.momHist.push({ m: s.minute, v: Math.max(-1, Math.min(1, smoothed)) });
  // Periodic rating: every 5 min, driven by each player's own accumulated stats (saves/defActs/chances)
  if (s.minute > 0 && s.minute % 5 === 0) {
    const ph = s.possCount.home, pa = s.possCount.away, pt = ph + pa || 1;
    for (const side of ["home","away"]) {
      const pct = side === "home" ? ph/pt : pa/pt;
      const op = side === "home" ? "away" : "home";
      const gaConceded = side === "home" ? s.score[1] : s.score[0];
      const gfScored = side === "home" ? s.score[0] : s.score[1];
      s.players[side].forEach(p => {
        if (p.pos === "GK") {
          const sv = p.saves || 0;
          if (sv > 0) p.rating = Math.min(10, +(p.rating + 0.02).toFixed(2));
          if (sv >= 3) p.rating = Math.min(10, +(p.rating + 0.01).toFixed(2));
          if (gaConceded === 0 && s.minute >= 30) p.rating = Math.min(10, +(p.rating + 0.015).toFixed(2));
          if (sv === 0 && pct > 0.58 && s.stats[op].shots < s.minute/12) p.rating = Math.max(3, +(p.rating - 0.01).toFixed(2));
        }
        if (p.pos === "DEF") {
          const da = p.defActs || 0;
          if (da > 0) p.rating = Math.min(10, +(p.rating + 0.03 * Math.min(da, 5)).toFixed(2));
          if (da >= 3 && gaConceded <= 1) p.rating = Math.min(10, +(p.rating + 0.04).toFixed(2));
          if (s.stats[op].onTarget > s.minute / 10) p.rating = Math.max(3, +(p.rating - 0.02).toFixed(2));
        }
        if (p.pos === "MID") {
          const ch = p.chances || 0;
          if (ch > 0) p.rating = Math.min(10, +(p.rating + 0.01 * Math.min(ch, 4)).toFixed(2));
          if (ch >= 3 && gfScored > 0) p.rating = Math.min(10, +(p.rating + 0.03).toFixed(2));
          if (ch === 0 && s.minute >= 40) p.rating = Math.max(3, +(p.rating - 0.01).toFixed(2));
        }
        if (p.pos === "FWD") {
          const ch = p.chances || 0;
          if (p.goals > 0 || p.assists > 0) p.rating = Math.min(10, +(p.rating + 0.01).toFixed(2));
          if (ch >= 2) p.rating = Math.min(10, +(p.rating + 0.02).toFixed(2));
          if (s.minute >= 50 && p.goals === 0 && p.assists === 0 && ch === 0 && p.rating <= 6.7) p.rating = Math.max(3, +(p.rating - 0.04).toFixed(2));
        }
      });
      // Individual involvement bonus: random player from possession team gets credit
      if (pct > 0.52) { const mp = pickPlayer(rng, s.players[side], "any"); ratePlayer(s.players[side], mp.name, 0.04); }
      if (pct < 0.42 && rng.u() < 0.3) { const dp = pickPlayer(rng, s.players[side], "any"); ratePlayer(s.players[side], dp.name, -0.02); }
    }
  }
}

function createMatchState() {
  return { phase:"pre_match",minute:0,stoppageElapsed:0,stoppageTotal:0,stoppageBank:0,score:[0,0],events:[],stats:{home:{shots:0,onTarget:0,fouls:0,yellows:0,reds:0,corners:0,penalties:0,woodwork:0,injuries:0,injuriesNoSub:0},away:{shots:0,onTarget:0,fouls:0,yellows:0,reds:0,corners:0,penalties:0,woodwork:0,injuries:0,injuriesNoSub:0}},players:{home:[],away:[]},bench:{home:[],away:[]},booked:{home:[],away:[]},goalscorers:{home:[],away:[]},subbedOff:{home:[],away:[]},forceResult:false,penalties:null,ball:2,pressure:0,tactics:{home:"bal",away:"bal"},possession:"home",possCount:{home:0,away:0},styles:{home:"balanced",away:"balanced"},allowTacChange:{home:true,away:true},momentum:{home:0,away:0},formations:{home:"4-3-3",away:"4-3-3"},homeAdv:null,venue:null,stamina:{home:100,away:100},subs:{home:0,away:0}, startScore:[0,0], isSecondLeg:false, pendingPenalty:null, xG:{home:0,away:0},momHist:[],strategy:{home:{...STRAT_DEF},away:{...STRAT_DEF}},matchUrg:{home:0,away:0}, promoDebuff:null, injuriesEnabled:true };
}

function cloneState(p) {
  return { ...p, score:[...p.score], events:[...p.events],
    stats:{home:{...p.stats.home},away:{...p.stats.away}},
    players:{home:p.players.home.map(x=>({...x})),away:p.players.away.map(x=>({...x}))},
    bench:{home:p.bench.home.map(x=>({...x})),away:p.bench.away.map(x=>({...x}))},
    booked:{home:[...p.booked.home],away:[...p.booked.away]},
    goalscorers:{home:[...p.goalscorers.home],away:[...p.goalscorers.away]},
    subbedOff:{home:p.subbedOff?p.subbedOff.home.map(x=>({...x})):[],away:p.subbedOff?p.subbedOff.away.map(x=>({...x})):[]},
    tactics:{...p.tactics}, possCount:{...p.possCount}, momentum:{...p.momentum},
    stamina:{...p.stamina}, subs:{...p.subs}, startScore:p.startScore||[0,0], xG:{home:p.xG?.home||0,away:p.xG?.away||0}, momHist:p.momHist?[...p.momHist]:[],
    strategy:{home:{...p.strategy.home},away:{...p.strategy.away}},
    penalties:p.penalties?{...p.penalties,home:[...p.penalties.home],away:[...p.penalties.away],homeOrder:p.penalties.homeOrder?[...p.penalties.homeOrder]:[],awayOrder:p.penalties.awayOrder?[...p.penalties.awayOrder]:[]}:null };
}
function resolvePendingPenalty(s, rng, home, away) {
  const pp = s.pendingPenalty; s.pendingPenalty = null;
  const po = pp.po, op = pp.op, dm = pp.dm;
  const nm = {home:home.name,away:away.name};
  const taker = s.players[po].find(p=>p.name===pp.taker) || pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"penalty");
  const poE = lmEffSkill(po==="home"?home.skill:away.skill, s.stats[po].reds, s.minute) * (1 + s.momentum[po]*0.02) * staminaMod(s.stamina[po]);
  const opE = lmEffSkill(op==="home"?home.skill:away.skill, s.stats[op].reds, s.minute) * (1 + s.momentum[op]*0.02) * staminaMod(s.stamina[op]);
  const skillF2=Math.min(1,poE/85+TIER_PEN[taker.tier||0]);
  const zW2=[18+skillF2*8,8-skillF2*3,18+skillF2*8,20+skillF2*6,10-skillF2*4,20+skillF2*6];
  const zT2=zW2.reduce((a,b)=>a+b,0);let zR2=rng.u()*zT2,zone2=0;for(let i=0;i<6;i++){zR2-=zW2[i];if(zR2<=0){zone2=i;break;}}
  const missP2=[0.14,0.04,0.14,0.07,0.02,0.07][zone2];
  const dive2=Math.floor(rng.u()*3);
  const zCol2=zone2%3;
  const isMiss2=rng.u()<missP2;
  const isSave2=!isMiss2&&dive2===zCol2;
  const result2=isMiss2?"miss":isSave2?"save":"goal";
  if(isMiss2){
    s.stats[po].shots++;
    ratePlayer(s.players[po],taker.name,-0.5);s.events.push({min:dm,type:"pen_miss",team:po,player:taker.name,text:"\u274C "+comm(rng,"pen_missed",{t:nm[po],n:taker.name},s),goalViz:{method:"pen",scorer:taker.name,assist:null,shotFrom:{x:88,y:32.5},assistFrom:null,goalZone:zone2,dive:dive2,result:"miss"}});
    s.possession=op;s.pressure=0;
  }else if(isSave2){
    s.stats[po].shots++;s.stats[po].onTarget++;
    ratePlayer(s.players[po],taker.name,-0.4);{const gk=s.players[op].find(p=>p.pos==="GK");if(gk){gk.rating=Math.min(10,+(gk.rating+1.0).toFixed(2));gk.saves=(gk.saves||0)+1;}}s.events.push({min:dm,type:"pen_miss",team:po,player:taker.name,text:"\u274C "+comm(rng,"pen_saved",{t:nm[po],n:taker.name},s),goalViz:{method:"pen",scorer:taker.name,assist:null,shotFrom:{x:88,y:32.5},assistFrom:null,goalZone:zone2,dive:dive2,result:"save"}});
    if(rng.u()<0.30){s.stats[po].corners++;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 "+comm(rng,"corner_rebound",{t:nm[po]},s)});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}
    else{s.possession=op;s.pressure=0;}
  }else{
    s.score[po==="home"?0:1]++;s.stats[po].shots++;s.stats[po].onTarget++;
    if(s.goalscorers)s.goalscorers[po].push({name:taker.name,min:dm,method:"pen"});taker.goals++;{const ti=po==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti);taker.rating=Math.min(10,+(taker.rating+goalAtkMult(taker.atkW)*gCtx).toFixed(2));}
    s.players[op].forEach(p=>{if(p.pos==="GK")p.rating=Math.max(3,+(p.rating-0.1).toFixed(1));else if(p.pos==="DEF")p.rating=Math.max(3,+(p.rating-0.05).toFixed(1));});
    {const _t=goalText(rng,"pen_scored_desc",s,nm,taker,null),_g=genGoalViz(rng,"pen",taker.name,null,zone2,dive2);gvSync(_t,_g);s.events.push({min:dm,type:"goal",team:po,text:"\u26BD "+_t,goalViz:_g});}
    s.ball=2;s.pressure=0;s.possession=op;s.stoppageBank+=45;s.momentum[po]=4;
  }
}
function lmAdvance(prev, rng, home, away, mutate) {
  const s = mutate ? prev : cloneState(prev);
  if (s.pendingPenalty) { resolvePendingPenalty(s, rng, home, away); return s; }
  const playMin = () => lmSimMinute(s,rng,home,away);
  const toStop = (phase) => { s.stoppageTotal=lmCalcStoppage(s.stoppageBank,phase,rng);s.stoppageElapsed=0;s.stoppageBank=0;s.phase=phase+"_stoppage";s.events.push({min:"",type:"phase",text:"\u23F1 "+s.stoppageTotal+" minutes added time"}); };
  switch(s.phase){
    case "pre_match": s.phase="first_half";s.minute=1;s.events.push({min:"",type:"phase",text:"\u26BD "+fill(pick(rng,CM.kickoff),{t:home.name})});playMin();break;
    case "first_half": s.minute++;playMin();if(s.minute>=45)toStop("first_half");break;
    case "first_half_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){s.phase="half_time";s.events.push({min:"",type:"phase",text:"\u23F0 "+pick(rng,CM.ht_whistle)+" "+s.score[0]+"\u2013"+s.score[1]});}break;
    case "half_time": s.phase="second_half";s.minute=45;s.ball=2;s.possession="away";s.stamina.home=Math.min(100,s.stamina.home+15);s.stamina.away=Math.min(100,s.stamina.away+15);s.events.push({min:"",type:"phase",text:"\u26BD "+fill(pick(rng,CM.kickoff),{t:away.name})});break;
    case "second_half": s.minute++;playMin();if(s.minute>=90)toStop("second_half");break;
    case "second_half_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){const aggH=s.score[0]+(s.startScore?.[0]||0),aggA=s.score[1]+(s.startScore?.[1]||0);if(s.forceResult&&aggH===aggA){s.phase="full_time";s.events.push({min:"",type:"phase",text:"\u23F0 "+pick(rng,CM.ft_whistle)+" "+s.score[0]+"\u2013"+s.score[1]+(s.startScore?.[0]||s.startScore?.[1]?" ("+aggH+"\u2013"+aggA+" agg.)":"")+". Extra time to follow."});}else{s.phase="finished";s.events.push({min:"",type:"phase",text:"\uD83C\uDFC1 "+pick(rng,CM.ft_whistle)+" "+home.name+" "+s.score[0]+"\u2013"+s.score[1]+" "+away.name+(s.startScore?.[0]||s.startScore?.[1]?" ("+aggH+"\u2013"+aggA+" agg.)":"")});}}break;
    case "full_time": s.phase="et_first";s.minute=90;s.ball=2;s.possession="home";s.events.push({min:"",type:"phase",text:"\u26BD "+pick(rng,CM.et_start)});break;
    case "et_first": s.minute++;playMin();if(s.minute>=105)toStop("et_first");break;
    case "et_first_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){s.phase="et_half_time";s.events.push({min:"",type:"phase",text:"\u23F0 "+pick(rng,CM.ht_whistle)+" "+s.score[0]+"\u2013"+s.score[1]});}break;
    case "et_half_time": s.phase="et_second";s.minute=105;s.ball=2;s.possession="away";s.stamina.home=Math.min(100,s.stamina.home+5);s.stamina.away=Math.min(100,s.stamina.away+5);s.events.push({min:"",type:"phase",text:"\u26BD "+fill(pick(rng,CM.kickoff),{t:away.name})});break;
    case "et_second": s.minute++;playMin();if(s.minute>=120)toStop("et_second");break;
    case "et_second_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){const aggH2=s.score[0]+(s.startScore?.[0]||0),aggA2=s.score[1]+(s.startScore?.[1]||0);if(aggH2===aggA2){s.phase="penalties";
        const penOrd=(side)=>{const pl=s.players[side].filter(p=>p.pos!=="GK").sort((a,b)=>(b.atkW||0)-(a.atkW||0)).map(p=>p.name);const gk=s.players[side].find(p=>p.pos==="GK");if(gk)pl.push(gk.name);return pl;};
        s.penalties={home:[],away:[],homeOrder:penOrd("home"),awayOrder:penOrd("away"),homeIdx:0,awayIdx:0,nextTeam:"home",decided:false,winner:null};s.events.push({min:"",type:"phase",text:"\uD83C\uDFAF Penalty shootout!"});}else{s.phase="finished";const w=aggH2>aggA2?home.name:away.name;s.events.push({min:"",type:"phase",text:"\uD83C\uDFC1 "+pick(rng,CM.ft_whistle)+" "+w+" win after extra time! "+s.score[0]+"\u2013"+s.score[1]+(s.startScore?.[0]||s.startScore?.[1]?" ("+aggH2+"\u2013"+aggA2+" agg.)":"")});}}break;
    case "penalties": { const p=s.penalties;if(p.decided)break;const tk=p.nextTeam,ok=tk==="home"?"away":"home";const kE=lmEffSkill(tk==="home"?home.skill:away.skill,s.stats[tk].reds,s.minute);const gE=lmEffSkill(ok==="home"?home.skill:away.skill,s.stats[ok].reds,s.minute);
      // Pick taker from order
      const ordKey=tk+"Order",idxKey=tk+"Idx";
      const ordArr=p[ordKey]||[];let taker;
      if(ordArr.length>0){const tn=ordArr[p[idxKey]%ordArr.length];taker=s.players[tk].find(pl=>pl.name===tn)||pickPlayer(rng,s.players[tk],"penalty");p[idxKey]=(p[idxKey]||0)+1;}else{taker=pickPlayer(rng,s.players[tk],"penalty");}
      const tName=tk==="home"?home.name:away.name;
      // Zone-based penalty: zones 0-5 = [TL,TC,TR,BL,BC,BR], dive 0-2 = [L,C,R]
      const skillF=Math.min(1,kE/85+TIER_PEN[taker.tier||0]);
      const zW=[18+skillF*8, 8-skillF*3, 18+skillF*8, 20+skillF*6, 10-skillF*4, 20+skillF*6]; // corner-heavy for good takers
      const zT=zW.reduce((a,b)=>a+b,0); let zR=rng.u()*zT, zone=0; for(let i=0;i<6;i++){zR-=zW[i];if(zR<=0){zone=i;break;}}
      const missP=[0.14,0.04,0.14,0.07,0.02,0.07][zone]; // miss chance by zone
      const dive=Math.floor(rng.u()*3); // keeper dive: 0=L,1=C,2=R
      const zCol=zone%3; // zone column: 0=L,1=C,2=R
      const isMiss=rng.u()<missP;
      const isSave=!isMiss&&dive===zCol;
      const scored=!isMiss&&!isSave;
      const result=isMiss?"miss":isSave?"save":"goal";
      p[tk].push({scored,name:taker.name,zone,dive,result});
      const hScore=p.home.filter(k=>k.scored).length, aScore=p.away.filter(k=>k.scored).length;
      const penScore="("+hScore+"\u2013"+aScore+")";
      if(scored){s.events.push({min:"PEN",type:"goal",team:tk,text:"\u26BD "+comm(rng,"pen_scored",{t:tName,n:taker.name},s)+" "+penScore,goalViz:genGoalViz(rng,"pen",taker.name,null,zone,dive)});}
      else{s.events.push({min:"PEN",type:"pen_miss",team:tk,player:taker.name,text:"\u274C "+comm(rng,isMiss?"pen_missed":"pen_saved",{t:tName,n:taker.name},s)+" "+penScore,goalViz:{method:"pen",scorer:taker.name,assist:null,shotFrom:{x:88,y:32.5},assistFrom:null,goalZone:zone,dive:dive,result:result}});}
      p.nextTeam=ok;const winner=lmCheckPenDecided(p.home,p.away);if(winner){p.decided=true;p.winner=winner;s.phase="finished";const wName=winner==="home"?home.name:away.name;s.events.push({min:"",type:"phase",text:"\uD83C\uDFC6 "+wName+" win on penalties! "+s.score[0]+"\u2013"+s.score[1]+" ("+p.home.filter(k=>k.scored).length+"\u2013"+p.away.filter(k=>k.scored).length+" PENS)"});}break;}
    default:break;
  }
  // End of match: individual performance bonuses (saves/defActs/chances); clean sheet is a smaller topper
  if (s.phase === "finished") {
    for (const side of ["home","away"]) {
      const cs = (side === "home" ? s.score[1] : s.score[0]) === 0;
      s.players[side].forEach(p => {
        let b = 0;
        if (p.pos === "GK") b = Math.min(1.0, 0.05 * (p.saves || 0) + (cs ? 0.3 : 0));
        else if (p.pos === "DEF") b = Math.min(1.0, 0.12 * Math.min(p.defActs || 0, 6) + (cs ? 0.2 : 0));
        else if (p.pos === "MID") b = Math.min(0.8, 0.10 * Math.min(p.chances || 0, 5));
        else if (p.pos === "FWD") b = Math.min(0.5, 0.06 * Math.min(p.chances || 0, 4));
        if (b > 0) p.rating = Math.min(10, +(p.rating + b).toFixed(2));
      });
    }
  }
  return s;
}

function lmBtnLabel(s) {
  const map = { pre_match:"\u26BD Kick Off", half_time:"\u25B6 2nd Half", full_time:"\u25B6 Extra Time", et_half_time:"\u25B6 ET 2nd Half" };
  if (map[s.phase]) return map[s.phase];
  if (s.pendingPenalty) return "\u26BD Take Penalty";
  if (s.phase==="penalties") return s.penalties?.decided?null:"\u25B6 Next Kick";
  if (s.phase==="finished") return null;
  if (s.phase.includes("stoppage")) { const b={first_half_stoppage:45,second_half_stoppage:90,et_first_stoppage:105,et_second_stoppage:120}[s.phase]; return "\u25B6 "+b+"+"+(s.stoppageElapsed+1)+"'"; }
  return "\u25B6 "+(s.minute+1)+"'";
}


// ═══ INSTANT SIM ═════════════════════════════════════════════════════════════
function simInstantMatch(rng, homeSkill, awaySkill, forceResult, homeStyle, awayStyle, homeForm, awayForm, homeAdv, homeStrat, awayStrat, homeSquad, awaySquad, matchUrg) {
  const home={name:"H",skill:homeSkill},away={name:"A",skill:awaySkill};
  let s=createMatchState();s.forceResult=!!forceResult;
  s.styles={home:homeStyle||"balanced",away:awayStyle||"balanced"};
  s.formations={home:homeForm||"4-3-3",away:awayForm||"4-3-3"};
  s.homeAdv=homeAdv||null;
  if (matchUrg) s.matchUrg = matchUrg;
  s.strategy={home:{...STRAT_DEF,...(homeStrat||{})},away:{...STRAT_DEF,...(awayStrat||{})}};
  s.modifiers={home:applyStrategy(mergeModifiers(STYLE_MOD[s.styles.home]||STYLE_MOD.balanced,FORM_MOD[s.formations.home]),s.strategy.home),away:applyStrategy(mergeModifiers(STYLE_MOD[s.styles.away]||STYLE_MOD.balanced,FORM_MOD[s.formations.away]),s.strategy.away)};
  const mapP = (p) => ({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.5,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0,chances:0,defActs:0,saves:0});
  const mapB = (p) => ({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0});
  if (homeSquad && awaySquad) {
    s.players={home:homeSquad.filter(p=>!p.bench).map(mapP),away:awaySquad.filter(p=>!p.bench).map(mapP)};
    s.bench={home:homeSquad.filter(p=>p.bench).map(mapB),away:awaySquad.filter(p=>p.bench).map(mapB)};
  } else {
    const hAll = buildSquad(homeForm || "4-3-3", null), aAll = buildSquad(awayForm || "4-3-3", null);
    s.players={home:hAll.filter(p=>!p.bench).map(mapP),away:aAll.filter(p=>!p.bench).map(mapP)};
    s.bench={home:hAll.filter(p=>p.bench).map(mapB),away:aAll.filter(p=>p.bench).map(mapB)};
  }
  s.events={length:0,push(){this.length++;}};
  lmAdvance(s,rng,home,away,true);let ftS=null;
  for(let i=0;i<300&&s.phase!=="finished";i++){if(s.phase==="full_time"&&!ftS)ftS=[...s.score];lmAdvance(s,rng,home,away,true);}
  if(!ftS)ftS=[...s.score];
  const penH=s.penalties?.home?.filter(k=>k?.scored).length||0,penA=s.penalties?.away?.filter(k=>k?.scored).length||0;
  const allP = (side) => [...s.players[side], ...s.subbedOff[side]];
  return{ftHome:ftS[0],ftAway:ftS[1],et:(s.score[0]!==ftS[0]||s.score[1]!==ftS[1])?{home:s.score[0]-ftS[0],away:s.score[1]-ftS[1]}:null,pen:s.penalties?.decided?{home:penH,away:penA}:null,cards:{home:{yellows:s.stats.home.yellows,reds:s.stats.home.reds,secondYellows:s.stats.home.secondYellows||0,injuries:s.stats.home.injuries},away:{yellows:s.stats.away.yellows,reds:s.stats.away.reds,secondYellows:s.stats.away.secondYellows||0,injuries:s.stats.away.injuries}},playerData:{home:allP("home"),away:allP("away")}};
}


function simTwoLegMatch(rng, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg1HA, leg2HA, homeStrat, awayStrat, awayGoals, homeSquad, awaySquad) {
  const l1 = simInstantMatch(rng, homeSkill, awaySkill, false, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat, homeSquad, awaySquad);
  const l2f = leg2HA === "home" ? "away" : leg2HA === "away" ? "home" : null;
  const l2 = simInstantMatch(rng, awaySkill, homeSkill, true, awayStyle, homeStyle, awayForm, homeForm, l2f, awayStrat, homeStrat, awaySquad, homeSquad);
  // Aggregate from bracket perspective: bracket-home total = leg1 home goals + leg2 away goals
  const aggH = l1.ftHome + l2.ftAway, aggA = l1.ftAway + l2.ftHome;
  const awayH = l2.ftAway, awayA = l1.ftAway; // away goals for tiebreaker
  const result = { twoLeg:true, leg1:{home:l1.ftHome,away:l1.ftAway}, leg2:{home:l2.ftHome,away:l2.ftAway}, agg:{home:aggH,away:aggA}, awayGoals:{home:awayH,away:awayA}, awayGoalsRule:!!awayGoals, et:null, pen:null, cards:{leg1:l1.cards,leg2:l2.cards}, playerData:{leg1:l1.playerData,leg2:l2.playerData} };
  if (aggH !== aggA) return result;
  if (awayGoals && awayH !== awayA) return result;
  // Tied on aggregate AND away goals — use ET/pens from leg 2 (swap perspective)
  if (l2.et) { result.et = {home:l2.et.away, away:l2.et.home}; result.agg.home += l2.et.away; result.agg.away += l2.et.home; }
  if (l2.pen) { result.pen = {home:l2.pen.away, away:l2.pen.home}; }
  return result;
}

function simFirstLeg(rng, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat, homeSquad, awaySquad) {
  const l1 = simInstantMatch(rng, homeSkill, awaySkill, false, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat, homeSquad, awaySquad);
  return { twoLeg:true, partial:true, leg1:{home:l1.ftHome,away:l1.ftAway}, leg2:null, agg:null, awayGoals:null, awayGoalsRule:false, et:null, pen:null, cards:{leg1:l1.cards}, playerData:{leg1:l1.playerData} };
}
function simSecondLeg(rng, partial, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg2HA, homeStrat, awayStrat, awayGoals, homeSquad, awaySquad) {
  const l2f = leg2HA === "home" ? "away" : leg2HA === "away" ? "home" : null;
  const l2 = simInstantMatch(rng, awaySkill, homeSkill, true, awayStyle, homeStyle, awayForm, homeForm, l2f, awayStrat, homeStrat, awaySquad, homeSquad);
  const l1 = partial.leg1, aggH = l1.home + l2.ftAway, aggA = l1.away + l2.ftHome;
  const awayH = l2.ftAway, awayA = l1.away;
  const result = { twoLeg:true, partial:false, leg1:l1, leg2:{home:l2.ftHome,away:l2.ftAway}, agg:{home:aggH,away:aggA}, awayGoals:{home:awayH,away:awayA}, awayGoalsRule:!!awayGoals, et:null, pen:null, cards:{leg1:partial.cards?.leg1,leg2:l2.cards}, playerData:{leg1:partial.playerData?.leg1,leg2:l2.playerData} };
  if (aggH !== aggA) return result;
  if (awayGoals && awayH !== awayA) return result;
  if (l2.et) { result.et = {home:l2.et.away, away:l2.et.home}; result.agg.home += l2.et.away; result.agg.away += l2.et.home; }
  if (l2.pen) { result.pen = {home:l2.pen.away, away:l2.pen.home}; }
  return result;
}
const playerKey = (team, name) => team + "|" + name;
// Groups an array of teams by their `league` field, ordered by LEAGUE_ORDER.
// Returns [league, teams][] entries, with `null` entries as section dividers.
function groupByLeague(list) {
  const groups = {};
  for (const t of list) { const l = t.league || "Custom"; if (!groups[l]) groups[l] = []; groups[l].push(t); }
  const raw = [];
  const seen = new Set();
  for (const l of LEAGUE_ORDER) {
    if (l === null) { raw.push(null); continue; }
    if (groups[l]) { raw.push([l, groups[l]]); seen.add(l); }
  }
  for (const l of Object.keys(groups)) { if (!seen.has(l)) raw.push([l, groups[l]]); }
  // Collapse dividers left orphaned when a league on either side has no teams
  // (drop leading/trailing nulls, collapse consecutive nulls to one).
  const result = [];
  for (const entry of raw) {
    if (entry === null) { if (result.length > 0 && result[result.length - 1] !== null) result.push(null); continue; }
    result.push(entry);
  }
  if (result.length > 0 && result[result.length - 1] === null) result.pop();
  return result;
}
function filterSquad(squad, teamName, unavailSet) {
  if (!squad) return null;
  const kf = n => playerKey(teamName, n);
  const st = squad.filter(p => !p.bench), bn = squad.filter(p => p.bench);
  const av = unavailSet ? st.filter(p => !unavailSet.has(kf(p.name))) : st;
  const bav = unavailSet ? bn.filter(p => !unavailSet.has(kf(p.name))) : bn;
  const need = st.length - av.length;
  const promoted = bav.slice(0, need).map(p => { const q = {...p}; delete q.bench; return q; });
  return [...av, ...promoted, ...bav.slice(need)];
}
// Ban-aware starters/bench split for live matches: unavailable starters are replaced
// by available bench players, and unavailable bench players are dropped entirely so
// they can never be selected as a live substitute.
function splitAvailSquad(squad, teamName, unavail) {
  const starters = squad.filter(p => !p.bench);
  const bench = squad.filter(p => p.bench);
  const keyOf = (name) => playerKey(teamName, name);
  const unavailStarters = starters.filter(p => unavail.has(keyOf(p.name)));
  const availStarters = starters.filter(p => !unavail.has(keyOf(p.name)));
  const availBench = bench.filter(p => !unavail.has(keyOf(p.name)));
  const used = new Set();
  const repMap = new Map();
  for (const out of unavailStarters) {
    let rep = availBench.find(p => p.pos === out.pos && !used.has(p.name));
    if (!rep) rep = availBench.find(p => p.pos !== "GK" && !used.has(p.name));
    if (!rep) rep = availBench.find(p => !used.has(p.name));
    if (rep) { repMap.set(out.name, rep); used.add(rep.name); }
  }
  const startResult = [];
  for (const p of starters) {
    if (unavail.has(keyOf(p.name))) { const rep = repMap.get(p.name); if (rep) startResult.push(rep); }
    else startResult.push(p);
  }
  return { starters: startResult, bench: availBench.filter(p => !used.has(p.name)) };
}
// Ban-aware starters/bench split for display: suspended/injured starters are shown
// on the bench (tagged `out`), with their replacement promoted into the starting XI.
function displaySquad(squad, teamName, playerStats) {
  if (!squad) return { starters: [], bench: [] };
  const kf = n => playerKey(teamName, n);
  const isOut = n => { const v = playerStats?.[kf(n)]; return !!(v && ((v.suspended||0) > 0 || (v.injOut||0) > 0)); };
  const st = squad.filter(p => !p.bench), bn = squad.filter(p => p.bench);
  const availSt = st.filter(p => !isOut(p.name)), outSt = st.filter(p => isOut(p.name));
  const availBn = bn.filter(p => !isOut(p.name)), outBn = bn.filter(p => isOut(p.name));
  const used = new Set();
  const promoMap = new Map();
  for (const out of outSt) {
    let rep = availBn.find(p => p.pos === out.pos && !used.has(p.name));
    if (!rep) rep = availBn.find(p => p.pos !== "GK" && !used.has(p.name));
    if (!rep) rep = availBn.find(p => !used.has(p.name));
    if (rep) { promoMap.set(out.name, { ...rep, bench: false }); used.add(rep.name); }
  }
  const remainBn = availBn.filter(p => !used.has(p.name));
  const startResult = [];
  for (const p of st) {
    if (isOut(p.name)) { const rep = promoMap.get(p.name); if (rep) startResult.push(rep); }
    else startResult.push(p);
  }
  return {
    starters: startResult,
    bench: [...remainBn, ...outSt.map(p => ({ ...p, bench: true, out: true })), ...outBn.map(p => ({ ...p, out: true }))],
  };
}

// ═══ HOME ADVANTAGE ══════════════════════════════════════════════════════════
function resolveHomeAdv(homeName, awayName, config, isGroup, homeSkill, awaySkill) {
  if (config.homeAdvGroup === "host" || config.homeAdvKO === "host") {
    const ht = config.homeAdvTeams || [];
    const hHost = ht.includes(homeName), aHost = ht.includes(awayName);
    if (hHost && !aHost) return "home";
    if (aHost && !hHost) return "away";
    if (hHost && aHost) return null;
  }
  if (isGroup) {
    if (config.homeAdvGroup === "off" || config.homeAdvGroup === "host") return null;
    if (config.homeAdvGroup === "first") return "home";
    if (config.homeAdvGroup === "weak_skill") return (homeSkill ?? 50) <= (awaySkill ?? 50) ? "home" : "away";
    return null;
  }
  const km = config.homeAdvKO;
  if (km === "off" || km === "host") return null;
  if (km === "first") return "home";
  return null;
}
function resolveKOHomeAdv(m, config) {
  if (!m.home || !m.away) return null;
  if (config.homeAdvKO === "host" || config.homeAdvGroup === "host") {
    const ht = config.homeAdvTeams || [];
    const hHost = ht.includes(m.home.name), aHost = ht.includes(m.away.name);
    if (hHost && !aHost) return "home";
    if (aHost && !hHost) return "away";
    if (hHost && aHost) return null;
    return null;
  }
  const km = config.homeAdvKO;
  if (km === "off") return null;
  if (km === "first") return "home";
  if (km === "weak_skill") return m.home.skill <= m.away.skill ? "home" : "away";
  if (km === "weak_group") { const hp = m.home.pts ?? m.home.skill, ap = m.away.pts ?? m.away.skill; return hp <= ap ? "home" : "away"; }
  return null;
}

// ═══ TOURNAMENT UTILS ════════════════════════════════════════════════════════
const GL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
function genRR(teams, legs) {
  const lg = legs || 1;
  const list = [...teams]; if (list.length % 2 !== 0) list.push(null);
  const n = list.length, base = [];
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      let h = list[i], a = list[n - 1 - i];
      if (i === 0 && r % 2 === 1) { const tmp = h; h = a; a = tmp; }
      if (h && a) matches.push({ home: h, away: a, result: null });
    }
    base.push(matches); const last = list.pop(); list.splice(1, 0, last);
  }
  const rounds = [...base];
  for (let leg = 1; leg < lg; leg++) base.forEach(rd => rounds.push(rd.map(m => leg % 2 === 1 ? { home: m.away, away: m.home, result: null } : { home: m.home, away: m.away, result: null })));
  return rounds;
}
function genSwissRound(group, roundNum) {
  const tm = {}; group.teams.forEach(t => { tm[t.name] = t; });
  const played = new Set();
  group.schedule.forEach(rd => rd.forEach(m => { if (m.home && m.away) played.add([m.home.name, m.away.name].sort().join("|")); }));
  
  let sorted;
  if (roundNum === 0) {
    sorted = [...group.teams].sort((a, b) => b.skill - a.skill);
  } else {
    sorted = [...group.standings].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  }
  
  // Track games played per team to detect imbalance
  const gamesPlayed = {};
  group.teams.forEach(t => { gamesPlayed[t.name] = 0; });
  group.schedule.forEach(rd => rd.forEach(m => {
    if (m.home && m.result) { gamesPlayed[m.home.name] = (gamesPlayed[m.home.name]||0) + 1; }
    if (m.away && m.result) { gamesPlayed[m.away.name] = (gamesPlayed[m.away.name]||0) + 1; }
    if (m.home && m.away && !m.result) { gamesPlayed[m.home.name] = (gamesPlayed[m.home.name]||0) + 1; gamesPlayed[m.away.name] = (gamesPlayed[m.away.name]||0) + 1; }
  }));
  
  // Prioritize teams with fewer games played, then by standings
  const names = sorted.map(s => s.name);
  names.sort((a, b) => (gamesPlayed[a]||0) - (gamesPlayed[b]||0));
  // Within same games-played, restore standings order
  const standingsRank = {}; sorted.forEach((s, i) => { standingsRank[s.name] = i; });
  names.sort((a, b) => {
    const ga = gamesPlayed[a]||0, gb = gamesPlayed[b]||0;
    if (ga !== gb) return ga - gb;
    return (standingsRank[a]||0) - (standingsRank[b]||0);
  });
  
  // Swiss pairing: split into score groups, pair top-half vs bottom-half within each group
  const matches = [], used = new Set();
  
  // Group teams by points (or skill for round 0)
  const scoreGroups = [];
  let currentGroup = [];
  let currentKey = null;
  for (const name of names) {
    if (used.has(name)) continue;
    const standing = sorted.find(s => s.name === name);
    const key = roundNum === 0 ? Math.floor((standingsRank[name]||0) / 2) : (standing?.pts ?? 0);
    if (currentKey !== null && key !== currentKey && currentGroup.length > 0) {
      scoreGroups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(name);
    currentKey = key;
  }
  if (currentGroup.length > 0) scoreGroups.push(currentGroup);
  
  // Flatten score groups back but pair within groups
  const allNames = [];
  scoreGroups.forEach(sg => sg.forEach(n => allNames.push(n)));
  
  // Try to pair: for each unpaired team, find the closest-ranked unpaired opponent not yet played
  for (let i = 0; i < allNames.length; i++) {
    const n1 = allNames[i];
    if (used.has(n1)) continue;
    let bestJ = -1;
    // First pass: find nearest opponent in the same score bracket
    for (let j = i + 1; j < allNames.length; j++) {
      const n2 = allNames[j];
      if (used.has(n2)) continue;
      const key = [n1, n2].sort().join("|");
      if (played.has(key)) continue;
      bestJ = j;
      break;
    }
    // Second pass: if no opponent found, allow rematches for teams with fewer games
    if (bestJ === -1) {
      for (let j = i + 1; j < allNames.length; j++) {
        const n2 = allNames[j];
        if (used.has(n2)) continue;
        bestJ = j;
        break;
      }
    }
    if (bestJ !== -1) {
      const n2 = allNames[bestJ];
      matches.push({ home: tm[n1], away: tm[n2], result: null });
      used.add(n1);
      used.add(n2);
    }
  }
  
  // Handle bye: if odd number of teams, the leftover team gets a bye
  for (const name of allNames) {
    if (!used.has(name)) {
      matches.push({ home: tm[name], away: null, result: { ftHome: 3, ftAway: 0 }, bye: true });
      break;
    }
  }
  
  return matches;
}
function initGroup(g, format, legs) {
  if (format === "swiss") { g.schedule = [genSwissRound(g, 0)]; }
  else { g.schedule = genRR(g.teams, legs); }
  g.standings = g.teams.map(t => ({ name: t.name, code: t.code, skill: t.skill, style: t.style, formation: t.formation, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
}
function allocSeed(teams, ng, format, legs) {
  const sorted = [...teams].sort((a, b) => b.skill - a.skill);
  const grps = Array.from({ length: ng }, (_, i) => ({ label: GL[i], teams: [], schedule: [], standings: [] }));
  sorted.forEach((t, i) => { const row = Math.floor(i / ng); const gi = row % 2 === 0 ? (i % ng) : (ng - 1 - (i % ng)); grps[gi].teams.push(t); });
  grps.forEach(g => initGroup(g, format, legs));
  return grps;
}
function allocRandom(teams, ng, format, legs) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const grps = Array.from({ length: ng }, (_, i) => ({ label: GL[i], teams: [], schedule: [], standings: [] }));
  shuffled.forEach((t, i) => grps[i % ng].teams.push(t));
  grps.forEach(g => initGroup(g, format, legs));
  return grps;
}
function allocDraw(teams, ng, numPots, rng, format, legs) {
  const sorted = [...teams].sort((a, b) => b.skill - a.skill);
  const base = Math.floor(teams.length / ng), extra = teams.length % ng;
  const cap = (gi) => gi < extra ? base + 1 : base;
  const pots = []; const potSize = Math.floor(sorted.length / numPots);
  for (let i = 0; i < numPots; i++) pots.push(sorted.slice(i * potSize, i === numPots - 1 ? sorted.length : (i + 1) * potSize));
  const grps = Array.from({ length: ng }, (_, i) => ({ label: GL[i], teams: [], schedule: [], standings: [] }));
  const log = [];
  pots.forEach((pot, pi) => {
    const potNames = new Set(pot.map(t => t.name));
    const rem = [...pot].sort(() => rng.u() - 0.5);
    rem.forEach(t => {
      const valid = [];
      for (let g = 0; g < ng; g++) {
        if (grps[g].teams.length < cap(g) && !grps[g].teams.some(e => potNames.has(e.name))) valid.push(g);
      }
      if (!valid.length) for (let g = 0; g < ng; g++) { if (grps[g].teams.length < cap(g)) valid.push(g); }
      const gi = valid[Math.floor(rng.u() * valid.length)];
      grps[gi].teams.push(t);
      log.push({ pot: pi + 1, team: t.name, skill: t.skill, group: GL[gi] });
    });
  });
  grps.forEach(g => initGroup(g, format, legs));
  return { grps, log };
}
function recalcStandings(group, tiebreakers) {
  const st = group.teams.map(t => ({ name: t.name, code: t.code, skill: t.skill, style: t.style, formation: t.formation, strategy: t.strategy, squad: t.squad, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  const idx = {}; st.forEach((s, i) => { idx[s.name] = i; });
  group.schedule.forEach(rd => rd.forEach(m => {
    if (!m.result) return;
    if (m.bye) {
      const h = st[idx[m.home.name]]; if (!h) return;
      h.p++; h.w++; h.gf += (m.result.ftHome||0); h.ga += (m.result.ftAway||0); h.pts += 3;
      return;
    }
    if (!m.home || !m.away) return;
    const h = st[idx[m.home.name]], a = st[idx[m.away.name]];
    if (!h || !a) return;
    h.p++; a.p++; h.gf += m.result.ftHome; h.ga += m.result.ftAway; a.gf += m.result.ftAway; a.ga += m.result.ftHome;
    if (m.result.ftHome > m.result.ftAway) { h.w++; a.l++; h.pts += 3; } else if (m.result.ftHome < m.result.ftAway) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
  }));
  // H2H lookup
  const h2h = {};
  st.forEach(s => { h2h[s.name] = {}; });
  group.schedule.forEach(rd => rd.forEach(m => {
    if (!m.result || m.bye || !m.home || !m.away) return;
    const hn = m.home.name, an = m.away.name;
    if (!h2h[hn][an]) h2h[hn][an] = { pts: 0, gf: 0, ga: 0 };
    if (!h2h[an][hn]) h2h[an][hn] = { pts: 0, gf: 0, ga: 0 };
    h2h[hn][an].gf += m.result.ftHome; h2h[hn][an].ga += m.result.ftAway;
    h2h[an][hn].gf += m.result.ftAway; h2h[an][hn].ga += m.result.ftHome;
    if (m.result.ftHome > m.result.ftAway) { h2h[hn][an].pts += 3; }
    else if (m.result.ftHome < m.result.ftAway) { h2h[an][hn].pts += 3; }
    else { h2h[hn][an].pts++; h2h[an][hn].pts++; }
  }));
  // Median-Buchholz (Swiss)
  const buchholz = {};
  const order = tiebreakers || ["gd", "gf", "h2h", "wins", "manual"];
  if (order.includes("buchholz")) {
    const opponents = {}; st.forEach(s => { opponents[s.name] = []; });
    group.schedule.forEach(rd => rd.forEach(m => {
      if (!m.result || m.bye || !m.home || !m.away) return;
      opponents[m.home.name]?.push(m.away.name);
      opponents[m.away.name]?.push(m.home.name);
    }));
    const ptsMap = {}; st.forEach(s => { ptsMap[s.name] = s.pts; });
    st.forEach(s => {
      const op = (opponents[s.name] || []).map(n => ptsMap[n] || 0).sort((a, b) => a - b);
      buchholz[s.name] = op.length >= 3 ? op.slice(1, -1).reduce((a, b) => a + b, 0) : op.reduce((a, b) => a + b, 0);
    });
  }
  st.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    for (const tb of order) {
      if (tb === "manual") break;
      let d = 0;
      if (tb === "gd") d = (b.gf - b.ga) - (a.gf - a.ga);
      else if (tb === "gf") d = b.gf - a.gf;
      else if (tb === "wins") d = b.w - a.w;
      else if (tb === "h2h") {
        const ab = h2h[a.name]?.[b.name] || { pts: 0, gf: 0, ga: 0 };
        const ba = h2h[b.name]?.[a.name] || { pts: 0, gf: 0, ga: 0 };
        d = ba.pts - ab.pts || (ba.gf - ba.ga) - (ab.gf - ab.ga) || ba.gf - ab.gf;
      }
      else if (tb === "buchholz") d = (buchholz[b.name] || 0) - (buchholz[a.name] || 0);
      if (d !== 0) return d;
    }
    return b.skill - a.skill;
  });
  return st;
}
// Form guide: per-team chronological list of recent results { r: 'W'|'D'|'L', opp, gf, ga, home }
function computeForm(group) {
  const form = {}; group.teams.forEach(t => { form[t.name] = []; });
  group.schedule.forEach(rd => rd.forEach(m => {
    if (!m.result) return;
    if (m.bye) { if (form[m.home?.name]) form[m.home.name].push({ r: "W", bye: true }); return; }
    if (!m.home || !m.away) return;
    const hr = m.result.ftHome, ar = m.result.ftAway;
    if (form[m.home.name]) form[m.home.name].push({ r: hr > ar ? "W" : hr < ar ? "L" : "D", opp: m.away.code || m.away.name, gf: hr, ga: ar, home: true });
    if (form[m.away.name]) form[m.away.name].push({ r: ar > hr ? "W" : ar < hr ? "L" : "D", opp: m.home.code || m.home.name, gf: ar, ga: hr, home: false });
  }));
  return form;
}
// Qualification zone for a standings row. ri 0-indexed, N total teams.
function zoneFor(ri, N, zones) {
  if (!zones) return null;
  const top = ri + 1, bot = N - ri;
  for (const z of zones) {
    if (z.anchor === "top" && top >= z.from && top <= z.to) return z;
    if (z.anchor === "bottom" && bot >= z.from && bot <= z.to) return z;
  }
  return null;
}
function computeGroupUrg(standings, teamName, qualCount, remainingAfter) {
  const idx = standings.findIndex(s => s.name === teamName);
  if (idx === -1 || qualCount <= 0 || qualCount >= standings.length) return 0;
  const team = standings[idx];
  const totalGames = remainingAfter + 1;
  const maxPts = team.pts + totalGames * 3;
  const isLast = remainingAfter === 0;
  const qualIdx = qualCount - 1;
  const qualTeam = standings[qualIdx];
  const outTeam = standings[Math.min(qualCount, standings.length - 1)];
  if (idx <= qualIdx) {
    if (qualCount >= standings.length) return -0.1;
    const chaserMax = outTeam.pts + totalGames * 3;
    if (team.pts > chaserMax) return -0.15;
    const cushion = team.pts - outTeam.pts;
    const gdEdge = (team.gf - team.ga) - (outTeam.gf - outTeam.ga);
    if (isLast) {
      if (cushion >= 4) return -0.05;
      if (cushion >= 2) return 0.1;
      if (cushion === 1) return 0.2;
      return gdEdge > 0 ? 0.3 : 0.45;
    }
    if (cushion >= 6) return -0.05;
    return 0.05;
  }
  const deficit = qualTeam.pts - team.pts;
  if (maxPts < qualTeam.pts) return -0.3;
  if (isLast) {
    if (deficit > 3) return -0.2;
    if (deficit === 3) return 0.7;
    const gdGap = (qualTeam.gf - qualTeam.ga) - (team.gf - team.ga);
    if (deficit === 0) return gdGap > 3 ? 0.9 : gdGap > 0 ? 0.7 : 0.4;
    if (deficit <= 2) return 0.6;
    return 0.5;
  }
  if (deficit >= 6) return 0.3;
  if (deficit >= 3) return 0.2;
  return 0.1;
}
function koWinner(m) { if (!m.result || !m.home) return null; if (m.result.twoLeg) { if (m.result.partial) return null; if (m.result.pen) return m.result.pen.home > m.result.pen.away ? m.home : m.away; const ah=m.result.agg.home, aa=m.result.agg.away; if (ah!==aa) return ah>aa?m.home:m.away; if (m.result.awayGoalsRule) return m.result.awayGoals.home>m.result.awayGoals.away?m.home:m.away; return m.home; } if (m.result.pen) return m.result.pen.home > m.result.pen.away ? m.home : m.away; const h = m.result.ftHome + (m.result.et?.home || 0), a = m.result.ftAway + (m.result.et?.away || 0); return h > a ? m.home : h < a ? m.away : m.home; }
function koLoser(m) { const w = koWinner(m); return w === m.home ? m.away : m.home; }
function koRoundName(total, ri) { const r = total / Math.pow(2, ri); return r === 2 ? "Final" : r === 4 ? "Semi-finals" : r === 8 ? "Quarter-finals" : `Round of ${r}`; }
function koResultText(m) { if (!m.result) return null; if (m.result.twoLeg) { const r=m.result; if (r.partial) return `${r.leg1.home}–${r.leg1.away} (L1)`; let t=`${r.leg1.home}–${r.leg1.away} / ${r.leg2.away}–${r.leg2.home} (${r.agg.home}–${r.agg.away} agg.)`; if (r.et) t+=` AET`; if (r.pen) t+=` (${r.pen.home}–${r.pen.away} PENS)`; if (!r.et&&!r.pen&&r.agg.home===r.agg.away&&r.awayGoalsRule) t+=` (away goals)`; return t; } let t = `${m.result.ftHome}–${m.result.ftAway}`; if (m.result.et) t = `${m.result.ftHome + m.result.et.home}–${m.result.ftAway + m.result.et.away} AET`; if (m.result.pen) t += ` (${m.result.pen.home}–${m.result.pen.away} PENS)`; return t; }
function propagateKO(ko) {
  // WB propagation (shared by single & double elim)
  for (let r = 0; r < ko.rounds.length - 1; r++) {
    ko.rounds[r].matches.forEach((m, mi) => {
      const nmi = Math.floor(mi / 2);
      if (m.bye && (m.home || m.away)) { const w = m.home || m.away; if (mi % 2 === 0) ko.rounds[r + 1].matches[nmi].home = w; else ko.rounds[r + 1].matches[nmi].away = w; return; }
      if (!m.result || !m.home || !m.away) return;
      const w = koWinner(m); if (!w) return;
      const l = koLoser(m);
      if (mi % 2 === 0) ko.rounds[r + 1].matches[nmi].home = w; else ko.rounds[r + 1].matches[nmi].away = w;
      if (ko.thirdPlace && r === ko.rounds.length - 2) { if (mi === 0) ko.thirdPlace.home = l; if (mi === 1) ko.thirdPlace.away = l; }
    });
  }
  if (!ko.losers) { const fm = ko.rounds[ko.rounds.length - 1].matches[0]; if (fm?.result) ko.champion = koWinner(fm); return; }
  // Reset all LB/GF/reset slots before repopulating (preserves results)
  ko.losers.forEach(lr => lr.matches.forEach(m => { m.home = null; m.away = null; delete m.bye; }));
  ko.grandFinal.home = null; ko.grandFinal.away = null;
  if (ko.reset) { ko.reset.home = null; ko.reset.away = null; }
  ko.champion = null;
  // Double elim: LB R0 from WB R0 losers (fold cross-pair)
  const wbR0 = ko.rounds[0].matches, nW0 = wbR0.length, nL0 = ko.losers[0].matches.length;
  for (let i = 0; i < nL0; i++) {
    const top = wbR0[i], bot = wbR0[nW0 - 1 - i];
    if (!top.bye && top.result && top.home && top.away) ko.losers[0].matches[i].home = koLoser(top);
    if (!bot.bye && bot.result && bot.home && bot.away) ko.losers[0].matches[i].away = koLoser(bot);
    const lm = ko.losers[0].matches[i];
    // Bye only when WB source was a structural bye (not just unplayed)
    if (lm.home && !lm.away && bot.bye) { lm.bye = true; }
    else if (!lm.home && lm.away && top.bye) { lm.bye = true; lm.home = lm.away; lm.away = null; }
  }
  // Propagate through LB rounds
  for (let lr = 0; lr < ko.losers.length; lr++) {
    const lbRd = ko.losers[lr];
    if (lbRd.type === "dropin") {
      const wbDR = (lr + 1) / 2;
      const wbRd = ko.rounds[wbDR];
      if (wbRd) { const n = lbRd.matches.length; for (let i = 0; i < n; i++) { const wbM = wbRd.matches[n - 1 - i]; if (wbM && !wbM.bye && wbM.result && wbM.home && wbM.away) lbRd.matches[i].away = koLoser(wbM); if (lbRd.matches[i].home && !lbRd.matches[i].away && wbM && wbM.bye) lbRd.matches[i].bye = true; } }
    }
    if (lr < ko.losers.length - 1) {
      const nxt = ko.losers[lr + 1];
      lbRd.matches.forEach((m, mi) => {
        const w = m.bye ? (m.home || m.away) : (m.result && m.home && m.away ? koWinner(m) : null);
        if (!w) return;
        if (nxt.type === "internal") { const nmi = Math.floor(mi / 2); if (mi % 2 === 0) nxt.matches[nmi].home = w; else nxt.matches[nmi].away = w; }
        else nxt.matches[mi].home = w;
      });
    }
  }
  // Grand Final: WB winner vs LB winner
  const wbFM = ko.rounds[ko.rounds.length - 1].matches[0];
  const lbFM = ko.losers[ko.losers.length - 1].matches[0];
  if (wbFM?.result) { const w = koWinner(wbFM); if (w) ko.grandFinal.home = w; }
  const lbW = lbFM?.bye ? (lbFM.home || lbFM.away) : (lbFM?.result ? koWinner(lbFM) : null);
  if (lbW) ko.grandFinal.away = lbW;
  if (ko.grandFinal.result) {
    const gfW = koWinner(ko.grandFinal);
    if (gfW === ko.grandFinal.home || !ko.reset) { ko.champion = gfW; }
    else { ko.reset.home = ko.grandFinal.home; ko.reset.away = ko.grandFinal.away; if (ko.reset.result) ko.champion = koWinner(ko.reset); }
  }
}

function buildKnockoutSeeded(teams, hasTP) {
  const sorted = [...teams].sort((a, b) => (b.pts??0) - (a.pts??0) || ((b.gf??0) - (b.ga??0)) - ((a.gf??0) - (a.ga??0)) || (b.gf??0) - (a.gf??0) || b.skill - a.skill);
  let n2 = 1; while (n2 < sorted.length) n2 *= 2;
  const seeds = bracketSeeds(n2);
  const first = [];
  for (let i = 0; i < n2; i += 2) { const h = seeds[i] <= sorted.length ? sorted[seeds[i]-1] : null, a = seeds[i+1] <= sorted.length ? sorted[seeds[i+1]-1] : null; first.push({ home: h || a, away: h && a ? a : null, result: null, ...((!h || !a) ? {bye:true} : {}) }); }
  return buildKOShell(first, hasTP);
}
function bracketSeeds(n) {
  let s = [1]; while (s.length < n) { const m = s.length * 2 + 1; const e = []; for (const v of s) { e.push(v); e.push(m - v); } s = e; } return s;
}
function buildKOShell(firstRoundMatches, hasTP) {
  let first = [...firstRoundMatches];
  let n = first.length; if (n & (n - 1)) { while (n & (n - 1)) { first.push({ home: null, away: null, result: null, bye: true }); n = first.length; } }
  const total = first.length * 2, nr = Math.round(Math.log2(total));
  const rounds = [{ name: koRoundName(total, 0), matches: first }];
  let mc = first.length;
  for (let r = 1; r < nr; r++) { mc = Math.ceil(mc / 2); rounds.push({ name: koRoundName(total, r), matches: Array.from({ length: mc }, () => ({ home: null, away: null, result: null })) }); }
  return { rounds, thirdPlace: hasTP && total >= 4 ? { home: null, away: null, result: null } : null, champion: null };
}
function convertToDoubleElim(ko, hasReset) {
  const nr = ko.rounds.length, n0 = ko.rounds[0].matches.length;
  const numLB = 2 * (nr - 1); const losers = []; let lbMC = Math.ceil(n0 / 2);
  for (let lr = 0; lr < numLB; lr++) {
    const isInt = lr % 2 === 0;
    losers.push({ name: lr === numLB - 1 ? "LB Final" : `LB Round ${lr + 1}`, type: isInt ? "internal" : "dropin", matches: Array.from({ length: lbMC }, () => ({ home: null, away: null, result: null })) });
    if (!isInt) lbMC = Math.ceil(lbMC / 2);
  }
  ko.losers = losers; ko.grandFinal = { home: null, away: null, result: null };
  ko.reset = hasReset ? { home: null, away: null, result: null } : null; ko.thirdPlace = null;
}
function isKOComplete(ko) {
  if (ko.losers) return !!ko.champion;
  const fm = ko.rounds[ko.rounds.length - 1].matches[0];
  return fm?.result && !fm.result.partial && (!ko.thirdPlace || (ko.thirdPlace.result && !ko.thirdPlace.result.partial));
}
function areTied(a, b, tiebreakers, schedule) {
  if (!a || !b || a.pts !== b.pts || a.p === 0) return false;
  const order = tiebreakers || [];
  // Build H2H for this pair
  const h2hPts = { a: 0, b: 0 }, h2hGF = { a: 0, b: 0 }, h2hGA = { a: 0, b: 0 };
  if (schedule) schedule.forEach(rd => rd.forEach(m => {
    if (!m.result || m.bye || !m.home || !m.away) return;
    if (m.home.name === a.name && m.away.name === b.name) {
      h2hGF.a += m.result.ftHome; h2hGA.a += m.result.ftAway;
      h2hGF.b += m.result.ftAway; h2hGA.b += m.result.ftHome;
      if (m.result.ftHome > m.result.ftAway) h2hPts.a += 3;
      else if (m.result.ftHome < m.result.ftAway) h2hPts.b += 3;
      else { h2hPts.a++; h2hPts.b++; }
    } else if (m.home.name === b.name && m.away.name === a.name) {
      h2hGF.b += m.result.ftHome; h2hGA.b += m.result.ftAway;
      h2hGF.a += m.result.ftAway; h2hGA.a += m.result.ftHome;
      if (m.result.ftHome > m.result.ftAway) h2hPts.b += 3;
      else if (m.result.ftHome < m.result.ftAway) h2hPts.a += 3;
      else { h2hPts.a++; h2hPts.b++; }
    }
  }));
  for (const tb of order) {
    if (tb === "manual") return true;
    if (tb === "gd" && (a.gf-a.ga) !== (b.gf-b.ga)) return false;
    if (tb === "gf" && a.gf !== b.gf) return false;
    if (tb === "wins" && a.w !== b.w) return false;
    if (tb === "h2h") {
      if (h2hPts.a !== h2hPts.b) return false;
      if ((h2hGF.a-h2hGA.a) !== (h2hGF.b-h2hGA.b)) return false;
      if (h2hGF.a !== h2hGF.b) return false;
    }
    if (tb === "buchholz") return false; // buchholz rarely ties, skip detailed check
  }
  return true;
}
function hasUnresolvedTies(groups, zones, tiebreakers) {
  if (!zones || zones.length === 0) return false;
  if (!tiebreakers || !tiebreakers.includes("manual")) return false;
  for (const g of groups) {
    const N = g.standings.length;
    for (let i = 0; i < N - 1; i++) {
      if (areTied(g.standings[i], g.standings[i+1], tiebreakers, g.schedule)) {
        const zA = zoneFor(i, N, zones);
        const zB = zoneFor(i + 1, N, zones);
        if (zA?.type !== zB?.type || (zA && !zB) || (!zA && zB)) return true;
      }
    }
  }
  return false;
}
function zonesHaveAdvance(zones) {
  return (zones || []).some(z => z.type === "advance" || z.type === "best");
}
function collectKOTeamsFromZones(groups, zones) {
  const direct = [], pool = [];
  const advZones = (zones || []).filter(z => z.type === "advance");
  const bestZones = (zones || []).filter(z => z.type === "best");
  groups.forEach(g => {
    const N = g.standings.length;
    g.standings.forEach((r, ri) => {
      for (const z of advZones) {
        const pos = z.anchor === "top" ? ri + 1 : N - ri;
        if (pos >= z.from && pos <= z.to) { direct.push({ ...r, groupLabel: g.label, groupPos: ri + 1 }); return; }
      }
      for (const z of bestZones) {
        const pos = z.anchor === "top" ? ri + 1 : N - ri;
        if (pos >= z.from && pos <= z.to) { pool.push({ ...r, groupLabel: g.label, groupPos: ri + 1 }); return; }
      }
    });
  });
  pool.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || b.skill - a.skill);
  const bestCount = bestZones.reduce((s, z) => s + (z.bestCount || 0), 0);
  const poolQualified = pool.slice(0, bestCount);
  return { direct, pool, poolQualified, all: [...direct, ...poolQualified] };
}
function countKOTeamsFromZones(zones, numGroups) {
  let d = 0, p = 0;
  (zones || []).forEach(z => {
    if (z.type === "advance") d += (z.to - z.from + 1);
    if (z.type === "best") p += (z.bestCount || 0);
  });
  return d * numGroups + p;
}
function collectKOTeams(groups, advPerGroup) {
  const all = [];
  groups.forEach(g => { for (let i = 0; i < advPerGroup && i < g.standings.length; i++) all.push(g.standings[i]); });
  return all;
}
function buildKnockoutRandom(teams, hasTP, rng) {
  const sorted = [...teams].sort((a, b) => (b.pts??b.skill) - (a.pts??a.skill) || (b.skill - a.skill));
  let n2 = 1; while (n2 < sorted.length) n2 *= 2;
  const numByes = n2 - sorted.length;
  const byeTeams = sorted.slice(0, numByes);
  const rest = sorted.slice(numByes);
  const slots = new Array(n2).fill(null);
  const seeds = bracketSeeds(n2);
  const locked = new Set();
  for (let i = 0; i < numByes; i++) { const pos = seeds.indexOf(i + 1); slots[pos] = byeTeams[i]; locked.add(pos); locked.add(pos % 2 === 0 ? pos + 1 : pos - 1); }
  const empty = [];
  for (let i = 0; i < n2; i++) if (!locked.has(i)) empty.push(i);
  for (let i = empty.length - 1; i > 0; i--) { const j = Math.floor(rng.u() * (i + 1)); [empty[i], empty[j]] = [empty[j], empty[i]]; }
  for (let i = 0; i < rest.length; i++) slots[empty[i]] = rest[i];
  const first = [];
  for (let i = 0; i < n2; i += 2) { const h = slots[i], a = slots[i+1]; first.push({ home: h || a, away: h && a ? a : null, result: null, ...((!h || !a) ? {bye:true} : {}) }); }
  return buildKOShell(first, hasTP);
}
function buildKnockoutDraw(teams, hasTP, rng) {
  const sorted = [...teams].sort((a, b) => { const pa = a.pts ?? 0, pb = b.pts ?? 0; if (pa !== pb) return pb - pa; const ga = (a.gf ?? 0) - (a.ga ?? 0), gb = (b.gf ?? 0) - (b.ga ?? 0); if (ga !== gb) return gb - ga; return (b.skill ?? 0) - (a.skill ?? 0); });
  let n2 = 1; while (n2 < sorted.length) n2 *= 2;
  const numByes = n2 - sorted.length;
  const byeTeams = sorted.slice(0, numByes);
  const drawTeams = sorted.slice(numByes);
  const half = Math.ceil(drawTeams.length / 2);
  const pot1 = drawTeams.slice(0, half).sort(() => rng.u() - 0.5);
  const pot2 = drawTeams.slice(half).sort(() => rng.u() - 0.5);
  const drawn = []; const log = [];
  for (let i = 0; i < pot2.length; i++) { drawn.push([pot1[i], pot2[i]]); log.push({ home: pot1[i].name, homeSkill: pot1[i].skill, away: pot2[i].name, awaySkill: pot2[i].skill }); }
  if (pot1.length > pot2.length) { drawn.push([pot1[pot1.length - 1], null]); }
  // Place into bracket using proper seeding for byes
  const seeds = bracketSeeds(n2);
  const slots = new Array(n2).fill(null);
  for (let i = 0; i < numByes; i++) { slots[seeds.indexOf(i + 1)] = byeTeams[i]; log.unshift({ home: byeTeams[i].name, homeSkill: byeTeams[i].skill, away: "BYE", awaySkill: 0 }); }
  // Fill remaining paired slots with drawn matches
  let di = 0;
  for (let i = 0; i < n2; i += 2) { if (!slots[i] && !slots[i+1]) { if (di < drawn.length) { slots[i] = drawn[di][0]; slots[i+1] = drawn[di][1]; di++; } } }
  const first = [];
  for (let i = 0; i < n2; i += 2) { const h = slots[i], a = slots[i+1]; first.push({ home: h || a, away: h && a ? a : null, result: null, ...((!h || !a) ? {bye:true} : {}) }); }
  return { ko: buildKOShell(first, hasTP), log };
}

// ═══ PARSE ═══════════════════════════════════════════════════════════════════
function parseBulk(text) {
  const styleLookup = {};
  STYLES.forEach(s => { styleLookup[s] = s; });
  Object.entries(STYLE_LBL).forEach(([key, label]) => { styleLookup[label.toLowerCase()] = key; });
  const resolveStyle = (str) => str ? (styleLookup[str.trim().toLowerCase()] ?? null) : null;
  const formSet = new Set(FORMATIONS);
  const resolveForm = (str) => str ? (formSet.has(str.trim()) ? str.trim() : null) : null;
  const stratKeys = ["approachPlay","passingDir","chanceCreation","dribbling","creativity","setPieces","timeWasting","possLost","possWon","gkDist","pressingLOE","defLine","dlBehavior","tackling"];
  const stratLookup = {};
  Object.entries(STRAT_LABELS).forEach(([key, {vals}]) => { const m = {}; vals.forEach(([v, l]) => { m[l.toLowerCase()] = v; }); m["no instruction"] = 0; m["standard"] = vals.find(([v]) => v === 0) ? 0 : 0; stratLookup[key] = m; });
  // Full-label aliases (TSV uses long labels, STRAT_LABELS uses short display labels)
  const aliases = {approachPlay:{"play out of defence":-1,"pass into space":1},chanceCreation:{"work ball into box":-1,"shoot on sight":1},dribbling:{"be more disciplined":-1,"run at defence":1},creativity:{"be more disciplined":-1,"be more expressive":1},setPieces:{"play for set pieces":1},possLost:{"counter-press":1},possWon:{"hold shape":-1},tackling:{"stay on feet":-1,"get stuck in":1},dlBehavior:{"drop off":-1,"step up":1,"offside trap":2},gkDist:{"short":-1,"long":1},passingDir:{"much shorter":-2,"much more direct":2,"more direct":1,"shorter":-1},pressingLOE:{"much lower":-2,"much higher":2,"lower":-1,"higher":1},defLine:{"much lower":-2,"much higher":2,"lower":-1,"higher":1}};
  Object.entries(aliases).forEach(([key, map]) => { if (stratLookup[key]) Object.assign(stratLookup[key], map); });
  const resolveStrat = (key, str) => { if (!str) return 0; const s = str.trim().toLowerCase(); return stratLookup[key]?.[s] ?? 0; };

  const isCode = (s) => /^[A-Za-z0-9]{1,4}$/.test(s.trim());

  return text.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split("\t");
    // Detect if first column is a ≤3-letter code (no spaces, letters only)
    let code = null;
    let offset = 0;
    if (parts.length >= 2 && isCode(parts[0])) {
      // Only treat as code if 2nd col is not a number that could be skill without a name
      // Disambiguate: if col[0] is ≤3 alpha chars AND col[1] is non-numeric or col[2] exists as numeric skill
      const col1isNum = !isNaN(parseInt(parts[1], 10));
      const col2isNum = parts.length > 2 && !isNaN(parseInt(parts[2], 10));
      // Heuristic: if col[0]≤3 alpha and col[1] is non-numeric, or col[2] is numeric → col[0] is a code
      if (!col1isNum || col2isNum) {
        code = parts[0].trim().toUpperCase().slice(0, 4);
        offset = 1;
      }
    }
    const p = offset ? parts.slice(offset) : parts;
    if (p.length === 1) return { name: p[0].trim(), skill: 50, style: "balanced", formation: "4-3-3", strategy: {...STRAT_DEF}, squad: buildSquad("4-3-3", null), ...(code ? {code} : {}) };
    const name = p[0].trim();
    const sk = parseInt(p[1], 10);
    if (!name || isNaN(sk)) return null;
    const skill = Math.max(25, Math.min(100, sk));
    const base = { name, skill, ...(code ? {code} : {}) };
    if (p.length === 2) return { ...base, style: "balanced", formation: "4-3-3", strategy: {...STRAT_DEF}, squad: buildSquad("4-3-3", null) };
    if (p.length === 3) {
      const asStyle = resolveStyle(p[2]);
      if (asStyle) return { ...base, style: asStyle, formation: "4-3-3", strategy: {...STRAT_DEF}, squad: buildSquad("4-3-3", null) };
      const asForm = resolveForm(p[2]);
      if (asForm) return { ...base, style: "balanced", formation: asForm, strategy: {...STRAT_DEF}, squad: buildSquad(asForm, null) };
      return { ...base, style: "balanced", formation: "4-3-3", strategy: {...STRAT_DEF}, squad: buildSquad("4-3-3", null) };
    }
    const style = resolveStyle(p[2]) ?? "balanced";
    const formation = resolveForm(p[3]) ?? "4-3-3";
    const strategy = {...STRAT_DEF};
    for (let i = 0; i < stratKeys.length && i + 4 < p.length; i++) {
      strategy[stratKeys[i]] = resolveStrat(stratKeys[i], p[i + 4]);
    }
    // Player names occupy a fixed 16-slot block right after the 14 tactic columns
    // (indices 18..33). Anything past that is optional trailing metadata, in a fixed
    // order: up to 2 #RRGGBB colors, then city, then stadium. Venue fields may carry a
    // trailing "(number)" population/capacity for user reference only — stripped here.
    const isHexColor = (s) => /^#[0-9A-Fa-f]{6}$/.test((s||"").trim());
    const stripVenue = (s) => (s||"").replace(/\s*\([\d,]+\)\s*$/, "").trim();
    const PLAYER_START = 18, PLAYER_SLOTS = 16;
    const playerNames = [];
    for (let i = PLAYER_START; i < Math.min(PLAYER_START + PLAYER_SLOTS, p.length); i++) { const v = p[i]?.trim(); if (v) playerNames.push(v); }
    const meta = [];
    for (let i = PLAYER_START + PLAYER_SLOTS; i < p.length; i++) { const v = p[i]?.trim(); if (v) meta.push(v); }
    let primaryColor = null, secondaryColor = null;
    if (meta.length > 0 && isHexColor(meta[0])) primaryColor = meta.shift();
    if (meta.length > 0 && isHexColor(meta[0])) secondaryColor = meta.shift();
    let city = null, stadium = null;
    if (meta.length > 0) city = stripVenue(meta.shift());
    if (meta.length > 0) stadium = stripVenue(meta.shift());
    const squad = buildSquad(formation, playerNames.length > 0 ? playerNames : null);
    return { ...base, style, formation, strategy, squad, ...(primaryColor ? {primaryColor} : {}), ...(secondaryColor ? {secondaryColor} : {}), ...(city ? {city} : {}), ...(stadium ? {stadium} : {}) };
  }).filter(Boolean);
}
const abbr = (n, code) => code ? code.toUpperCase().slice(0, 3) : (n || "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
// Deterministic string hash — used to pick a stable (non-random) venue per fixture, so
// re-opening the same match always shows the same stadium instead of reshuffling.
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
// Stable per-fixture identity, shared by home-advantage overrides, the host-venue pool,
// and the replay counter — a group match, or a KO bracket slot (both legs share one tie).
function fixtureKey(t) { if (!t) return null; if (t.type === "group") return `g_${t.gi}_${t.ri}_${t.mi}`; return t.tp ? "tp" : `ko_${t.ri}_${t.mi}`; }
// City\tStadium, one per line — parses the host-nation venue pool pasted in tournament setup.
function parseVenuePool(text) {
  return (text || "").split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const [city, stadium] = line.split("\t");
    return { city: (city || "").trim(), stadium: (stadium || "").trim() };
  }).filter(v => v.city || v.stadium);
}
// Long team names: instead of wrapping to a second line, clip to one line with a fade
// at the edges and auto-scroll periodically so the full name is still readable over time.
// Falls back to plain static text (respecting `align`) when the name already fits.
function MarqueeName({ text, align = "left", style }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [dist, setDist] = useState(0);
  useEffect(() => {
    const outer = outerRef.current, inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => setDist(Math.max(0, inner.scrollWidth - outer.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [text]);
  return (
    <span ref={outerRef} style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", ...style }}>
      <span ref={innerRef} className={dist > 0 ? "marquee-name" : ""} style={dist > 0 ? { display: "inline-block", "--marquee-dist": `-${dist}px` } : { display: "block", textAlign: align }}>{text}</span>
    </span>
  );
}
// Crest: looks for an uploaded PNG at /badges/<CODE>.png first; falls back to a plain
// shield in the team's home color, outlined in its away color, if none exists.
function TeamCrest({ team, size = 22, style }) {
  const code = abbr(team?.name, team?.code);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [code]);
  if (code && !imgFailed) {
    return <img src={`${import.meta.env.BASE_URL}badges/${code}.png`} alt="" width={size} height={size * 1.1} style={{ objectFit: "contain", flexShrink: 0, ...style }} onError={() => setImgFailed(true)} />;
  }
  const home = team?.primaryColor || "#7889a0";
  const away = team?.secondaryColor || team?.primaryColor || "#2a3a50";
  return (
    <svg width={size} height={size * 1.1} viewBox="-12 -12 64 68" style={{ flexShrink: 0, ...style }}>
      <path d="M20 2 L35 8 L35 20 C35 30 28.5 37.5 20 41.5 C11.5 37.5 5 30 5 20 L5 8 Z" fill={home} stroke={away} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
const hexToRgb = (hex) => { const h = (hex || "").replace("#", ""); if (h.length !== 6) return null; return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }; };
// "redmean" — a cheap perceptually-weighted RGB distance, much better than plain
// Euclidean distance at telling "different colors" apart from "near-duplicate shades".
const colorsClash = (hex1, hex2) => {
  const c1 = hexToRgb(hex1), c2 = hexToRgb(hex2);
  if (!c1 || !c2) return false;
  const rmean = (c1.r + c2.r) / 2, dR = c1.r - c2.r, dG = c1.g - c2.g, dB = c1.b - c2.b;
  const dist = Math.sqrt((2 + rmean/256) * dR*dR + 4 * dG*dG + (2 + (255-rmean)/256) * dB*dB);
  return dist < 60;
};
// Picks a color visually distinct from bgHex: the color itself, else its alt (e.g. away
// kit), else the color progressively lightened toward white as a last resort. Reuses the
// same redmean distance as colorsClash — this catches colors that blend into the panel
// background, not merely "dark" colors (plenty of real team colors, like black or navy
// kits, are dark but still clearly visible against the app's dark UI).
const lightenUntil = (hex, refHex, factor) => {
  const c = hexToRgb(hex); if (!c) return "#ffffff";
  let r = c.r, g = c.g, b = c.b, cur = hex;
  for (let i = 0; i < 10 && colorsClash(cur, refHex); i++) {
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
    cur = "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  return cur;
};
const readableClr = (hex, altHex, bgHex) => {
  if (!hex) return altHex || "#ffffff";
  if (!colorsClash(hex, bgHex)) return hex;
  if (altHex && altHex !== hex && !colorsClash(altHex, bgHex)) return altHex;
  return lightenUntil(hex, bgHex, 0.3);
};
const ensureMinLum = (hex) => {
  const c = hexToRgb(hex); if (!c) return "#ffffff";
  let r = c.r, g = c.g, b = c.b;
  for (let i = 0; i < 10; i++) {
    if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.3) break;
    r = Math.min(255, Math.round(r + (255 - r) * 0.3));
    g = Math.min(255, Math.round(g + (255 - g) * 0.3));
    b = Math.min(255, Math.round(b + (255 - b) * 0.3));
  }
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
};

const POS_W = {goal:{GK:0,DEF:5,MID:25,FWD:70},longGoal:{GK:0,DEF:10,MID:70,FWD:20},corner:{GK:1,DEF:55,MID:20,FWD:24},foul:{GK:1,DEF:35,MID:45,FWD:19},penalty:{GK:0,DEF:5,MID:35,FWD:60},any:{GK:0,DEF:25,MID:40,FWD:35},subOff:{GK:0,DEF:20,MID:40,FWD:40}};
function pickPlayer(rng, players, type) {
  if (!players || players.length === 0) return {name:"?",pos:"MID",atkW:0};
  if (!players[0]?.pos) return {name:String(pick(rng,players)),pos:"MID",atkW:0};
  const hasAtk = players[0]?.atkW != null;
  const pureAtk = (type === "goal" || type === "penalty") && hasAtk;
  const w = POS_W[type] || POS_W.any;
  // For pure atkW types (goal/longGoal/penalty): use atkW directly
  // For other types when atkW available: blend position weight + atkW for formation-specific distribution
  const useTier = type === "goal" || type === "longGoal" || type === "penalty" || type === "corner";
  const weighted = players.map(p => {
    const tw = useTier ? TIER_ATK_W[p.tier || 0] : 1;
    if (pureAtk) return {p, w: (p.atkW || 0) * tw};
    const posW = w[p.pos] || 10;
    if (hasAtk && (type === "any" || type === "corner" || type === "longGoal")) return {p, w: (posW + (p.atkW || 0) * 0.8) * tw};
    return {p, w: posW};
  });
  const total = weighted.reduce((s,x) => s + x.w, 0);
  if (total === 0) return pick(rng, players);
  let r = rng.u() * total;
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.p; }
  return weighted[weighted.length - 1].p;
}

function ratePlayer(players, name, delta) {
  const p = players.find(x => x.name === name);
  if (p) p.rating = Math.max(3, Math.min(10, +(p.rating + delta).toFixed(1)));
}
const ratingColor = (r) => r >= 9 ? "#4a90d9" : r >= 8 ? "#5bbcd6" : r >= 7 ? "#4caf50" : r >= 6.5 ? "#e6c619" : r >= 6 ? "#e89a3c" : r >= 5 ? "#d55b4a" : "#cc3333";
const goalAtkMult = (atkW) => 0.75 + 0.5 * Math.pow(1 - Math.min(atkW||0, 50)/50, 1.5);
const assistAtkMult = (atkW) => 0.95 + 0.25 * Math.pow(1 - Math.min(atkW||0, 50)/50, 2);
const goalCtxMult = (score, ti) => { const us=score[ti],them=score[1-ti],d=us-them; if(us===0&&them===0)return 1.15; if(d===-1)return 1.2; if(d===0)return 1.15; if(d>0)return Math.max(0.8,1.1-d*0.1); return 0.9; };
function assistPlayer(rng, players, scorer, delta) {
  const others = players.filter(p => p.name !== scorer && p.pos !== "GK");
  if (others.length === 0) return null;
  const a = pickPlayer(rng, others, "any");
  a.assists++; a.chances = (a.chances || 0) + 1;
  a.rating = Math.max(3, Math.min(10, +(a.rating + (delta != null ? delta : 0.6)).toFixed(2)));
  return a;
}
function parseTier(raw) { if (!raw) return {name:raw,tier:0}; const s=raw.trimEnd(); if (s.endsWith("[*]")) return {name:s.slice(0,-3).trim(),tier:2}; if (s.endsWith("[+]")) return {name:s.slice(0,-3).trim(),tier:1}; return {name:s,tier:0}; }
const tierSuffix = (t) => t===2?" [*]":t===1?" [+]":"";
function buildSquad(formation, names) {
  const n = names || [];
  const dg = (formation || "4-3-3").split("-").map(Number);
  const sq = [];
  // Per-formation attacking weight gradients (contextual to role)
  // Per-formation attacking weight gradients: L-to-R within each layer
  const FG = {
    "4-2-4":     [0, 4,3,3,4, 16,16, 34,40,42,34],          // LB CB CB RB | CM CM | LW ST ST RW
    "4-4-2":     [0, 4,3,3,4, 18,14,14,18, 44,46],           // LB CB CB RB | LM CM CM RM | ST ST
    "4-3-3":     [0, 5,3,3,5, 15,18,15, 36,40,36],           // LB CB CB RB | CM CM(b2b) CM | LW ST RW
    "4-2-3-1":   [0, 4,3,3,4, 8,8, 22,28,22, 48],            // LB CB CB RB | DM DM | LAM CAM RAM | ST
    "4-1-4-1":   [0, 4,3,3,4, 6, 20,14,14,20, 46],           // LB CB CB RB | DM | LW CM CM RW | ST
    "4-1-2-1-2": [0, 4,3,3,4, 6, 14,14, 30, 44,46],          // LB CB CB RB | DM | CM CM | AM | ST ST
    "4-3-2-1":   [0, 4,3,3,4, 12,16,12, 24,24, 50],          // LB CB CB RB | CM CM(b2b) CM | AM AM | ST
    "3-4-3":     [0, 3,4,3, 12,10,10,12, 38,42,38],          // CB CB CB | LWB CM CM RWB | LW ST RW
    "3-5-2":     [0, 3,4,3, 14,12,16,12,14, 44,46],          // CB CB CB | LWB CM CM(b2b) CM RWB | ST ST
    "3-4-1-2":   [0, 3,4,3, 14,10,10,14, 28, 44,46],         // CB CB CB | LWB CM CM RWB | AM | ST ST
    "5-3-2":     [0, 10,3,4,3,10, 16,14,16, 44,46],          // LWB CB CB CB RWB | CM CM(b2b) CM | ST ST
  };
  const fm = formation || "4-3-3";
  const atkGrad = FG[fm] || (()=>{ const d2=fm.split("-").map(Number); const g=[0]; let ii=1; for(let i=0;i<d2[0];i++){g.push(4);ii++;} for(let di=1;di<d2.length-1;di++){const isDeep=di===1&&d2.length>3;for(let i=0;i<d2[di];i++){g.push(isDeep?10:Math.round(12+26*((ii-d2[0]-1)/Math.max(1,10-d2[0]-d2[d2.length-1]-1))));ii++;}} for(let i=0;i<d2[d2.length-1];i++){const nf=d2[d2.length-1];g.push(nf===1?36:nf===2?(i===0?42:44):(i===nf-1?40:36));ii++;} return g; })();
  sq.push({ name: n[0] || "#1", pos: "GK", atkW: 0 });
  let idx = 1;
  for (let i = 0; i < dg[0]; i++) { sq.push({ name: n[idx] || "#"+(idx+1), pos: "DEF", atkW: atkGrad[idx] || 4 }); idx++; }
  for (let d = 1; d < dg.length - 1; d++)
    for (let i = 0; i < dg[d]; i++) { sq.push({ name: n[idx] || "#"+(idx+1), pos: "MID", atkW: atkGrad[idx] || 20 }); idx++; }
  for (let i = 0; i < dg[dg.length - 1]; i++) { sq.push({ name: n[idx] || "#"+(idx+1), pos: "FWD", atkW: atkGrad[idx] || 48 }); idx++; }
  const benchPos = ["GK", "DEF", "MID", "MID", "FWD"];
  const benchAtk = [0, 8, 20, 25, 42];
  for (let i = 0; i < 5; i++) sq.push({ name: n[11 + i] || "#"+(12+i), pos: benchPos[i], bench: true, atkW: benchAtk[i] });
  sq.forEach(p => { const {name,tier} = parseTier(p.name); p.name = name; p.tier = tier; });
  return sq;
}


function parsePresetTSV(raw, filterLeagues, skipStart = 1, hasSuffix = true, hasHeader = true) {
  return parseBulk((hasHeader ? raw.split("\n").slice(1) : raw.split("\n")).map(line => {
    const cols = line.split("\t");
    if (hasSuffix) {
      const league = cols[cols.length - 1]?.trim();
      if (filterLeagues && !filterLeagues.includes(league)) return null;
    }
    return cols.slice(skipStart, hasSuffix ? -1 : cols.length).map(c => c.trim()).join("\t");
  }).filter(Boolean).join("\n"));
}
const PRESET_AVIUM = parsePresetTSV(aviumTSV, null, 0, false, false);
const PRESET_NCH_L1 = parsePresetTSV(nl1TSV, null, 0, false, false);
const PRESET_NCH_L2 = parsePresetTSV(nl2TSV, null, 0, false, false);
const PRESET_LIGA = parsePresetTSV(ligaTSV, null, 0, false, false);
const PRESET_KPL = parsePresetTSV(kplTSV, null, 0, false, false);
const PRESET_KULLANMAAN = parsePresetTSV(kullanmaanTSV, null, 0, false, false);
const PRESET_PL = parsePresetTSV(plTSV, null, 0, false, false);
const PRESET_MISC_EU = parsePresetTSV(miscEuTSV, null, 0, false, false);
const TRIM_SIZES = [2, 4, 8, 16, 20, 24, 32, 36, 48];
const LEAGUE_ORDER = [
  "Avium International",
  null,
  "Nichirin League One", "Nichirin League Two", "Karjanian Premier League", "Varahmehri Liga-ye Mellī", "Kullanmaan Cup",
  null,
  "Premier League", "Miscellaneous European",
  null,
  "Custom",
];
const PRESET_CATALOG = [
  ...PRESET_AVIUM.map(t => ({...t, league: "Avium International"})),
  ...PRESET_NCH_L1.map(t => ({...t, league: "Nichirin League One"})),
  ...PRESET_NCH_L2.map(t => ({...t, league: "Nichirin League Two"})),
  ...PRESET_KPL.map(t => ({...t, league: "Karjanian Premier League"})),
  ...PRESET_LIGA.map(t => ({...t, league: "Varahmehri Liga-ye Mellī"})),
  ...PRESET_KULLANMAAN.map(t => ({...t, league: "Kullanmaan Cup"})),
  ...PRESET_PL.map(t => ({...t, league: "Premier League"})),
  ...PRESET_MISC_EU.map(t => ({...t, league: "Miscellaneous European"})),
].map(t => ({...t, id: t.league + "::" + (t.code || t.name)}));
function isPow2(n) { return n > 0 && (n & (n - 1)) === 0; }

// ═══ UI STYLES ═══════════════════════════════════════════════════════════════
const mono = { fontFamily: "'JetBrains Mono','Fira Code',monospace", fontVariantNumeric: "tabular-nums" };
const ui = { fontFamily: "'Neue Montreal','Inter','Helvetica Neue',sans-serif" };
const lbl = { display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7889a0", marginBottom: 6, ...ui };
const chip = { border: "1px solid #2a3a50", borderRadius: 6, padding: "7px 16px", fontSize: 13, cursor: "pointer", transition: "all 0.15s", fontFamily: "'Neue Montreal','Inter','Helvetica Neue',sans-serif", fontWeight: 500, letterSpacing: "0.04em" };
const inp = { background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#ffffff", outline: "none", fontFamily: "inherit" };
const sel = { ...inp, cursor: "pointer" };
const addBtn = { background: "transparent", border: "1px solid #2a3a50", borderRadius: 6, padding: "5px 14px", fontSize: 11, color: "#7889a0", cursor: "pointer", fontFamily: "'Neue Montreal','Inter','Helvetica Neue',sans-serif", fontWeight: 500, letterSpacing: "0.06em" };
const delBtn = { background: "transparent", border: "none", color: "#bf616a", fontSize: 16, cursor: "pointer", padding: "0 4px", fontFamily: "inherit" };
const scBtn = { width: "100%", background: "#e4002b", border: "none", borderRadius: 8, padding: "14px", fontSize: 14, fontWeight: 600, color: "#ffffff", cursor: "pointer", letterSpacing: "0.08em", fontFamily: "'Neue Montreal','Inter','Helvetica Neue',sans-serif", boxShadow: "0 2px 8px #e4002b33" };
const chk = { fontSize: 11, color: "#7889a0", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" };
const POS_CLR = {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"};
function styledPos(txt) { const parts = []; let last = 0; const rx = /\((GK|DEF|MID|FWD)\)/g; let m; while ((m = rx.exec(txt)) !== null) { if (m.index > last) parts.push(txt.slice(last, m.index)); parts.push(<span key={m.index} style={{ ...mono, color: POS_CLR[m[1]] || "#7889a0" }}>({m[1]})</span>); last = rx.lastIndex; } if (last < txt.length) parts.push(txt.slice(last)); return parts; }
const evColor = { goal: "#ffffff", penalty: "#d08770", chance: "#ebcb8b", red: "#bf616a", second_yellow: "#bf616a", pen_miss: "#bf616a", yellow: "#ebcb8b", save: "#ffffff", miss: "#ffffff", sub: "#7a8b9b", injury: "#c07070", press: "#ffffff", counter: "#ffffff", phase: "#ffffff", foul: "#ffffff", corner: "#ffffff", neutral: "#ffffff", offside: "#ffffff", buildup: "#ffffff", clearance: "#ffffff" };
// ═══ GOAL VISUALIZATIONS ═════════════════════════════════════════════════════
const NAME_PFX = new Set(["van","de","del","di","da","dos","das","von","den","der","le","la","el","al","bin","ibn"]);
const shortName = (n) => { const p = String(n||"").trim().split(/\s+/); if (p.length <= 1) return n; if (p.length === 2 && NAME_PFX.has(p[0].toLowerCase())) return n; for (let i = 1; i < p.length; i++) { if (!NAME_PFX.has(p[i].toLowerCase())) { let s = i; while (s > 1 && NAME_PFX.has(p[s-1].toLowerCase())) s--; return p.slice(s).join(" "); } } return p[p.length-1]; };
const gvSn = shortName;
// Front-on goal mouth: ball animates from the grass to its zone, keeper dives. Used for all goals and penalty misses.
function gvGoalMouth(gv, delay) {
  const W=220, gL=25, gR=195, gT=10, gB=82;
  const zone = gv.goalZone ?? 4, dive = gv.dive ?? 1, result = gv.result || "goal";
  const zPos = [[gL+26,gT+20],[gL+85,gT+16],[gR-26,gT+20],[gL+26,gB-18],[gL+85,gB-14],[gR-26,gB-18]];
  const mPos = [[gL-6,gT-8],[gL+85,gT-12],[gR+6,gT-8],[gL-10,gB+6],[gL+85,gB+10],[gR+10,gB+6]];
  const dX = [(gL+gR)/2-44,(gL+gR)/2,(gL+gR)/2+44], dY = (gT+gB)/2+4;
  const pos = result === "miss" ? mPos[zone] : zPos[zone];
  const col = result === "goal" ? "#a3be8c" : result === "save" ? "#bf616a" : "#7889a0";
  const bx = (gL+gR)/2, by = gB+13;
  const saved = result === "save";
  const d = Math.max(0, delay || 0);
  return (<svg viewBox="0 -12 220 136" style={{ width: "100%", maxWidth: 190, height: "auto", display: "block" }}>
    <rect x="3" y={gB+2} width={W-6} height="18" fill="#0e1a12" rx="2" />
    <rect x={gL} y={gT} width={gR-gL} height={gB-gT} fill="#0d120d" stroke="#7889a0" strokeWidth="2.5" rx="1" />
    <line x1={gL+57} y1={gT} x2={gL+57} y2={gB} stroke="#7889a0" strokeWidth="0.5" opacity="0.6" />
    <line x1={gR-57} y1={gT} x2={gR-57} y2={gB} stroke="#7889a0" strokeWidth="0.5" opacity="0.6" />
    <line x1={gL} y1={(gT+gB)/2} x2={gR} y2={(gT+gB)/2} stroke="#7889a0" strokeWidth="0.5" opacity="0.6" />
    <g className="gv-anim" style={{ "--gv-kdx": (dX[1]-dX[dive])+"px", animation: "gvKeep 0.3s ease-out "+(d+0.12).toFixed(2)+"s both" }}>
      <rect x={dX[dive]-18} y={dY-20} width="36" height="40" rx="4" fill={saved?"#bf616a33":"#ffffff0a"} stroke={saved?"#bf616a66":"#ffffff18"} strokeWidth="1.5" />
      <text x={dX[dive]} y={dY+2} textAnchor="middle" dominantBaseline="middle" fill={saved?"#bf616a":"#ffffff30"} fontSize="16">🧤</text>
    </g>
    <g className="gv-anim" style={{ "--gv-bdx": (pos[0]-bx)+"px", "--gv-bdy": (pos[1]-by)+"px", animation: "gvBallTo 0.45s cubic-bezier(0.25,0.8,0.4,1) "+d.toFixed(2)+"s both" }}>
      <circle cx={bx} cy={by} r="7" fill={col} stroke="#141c2b" strokeWidth="1" />
      <text x={bx} y={by+1} textAnchor="middle" dominantBaseline="middle" fill="#141c2b" fontSize="8" fontWeight="800">{result==="goal"?"✓":result==="save"?"✕":"×"}</text>
    </g>
  </svg>);
}
// Overhead build-up pitch: assist pass line, then shot line, ball traveling along both. Attacking goal on the right.
function gvPitch(gv, clr) {
  const S = [gv.shotFrom.x*2, gv.shotFrom.y*2];
  const A = gv.assistFrom ? [gv.assistFrom.x*2, gv.assistFrom.y*2] : null;
  const G = [199, 65];
  const len1 = A ? Math.hypot(S[0]-A[0], S[1]-A[1]) : 0;
  const len2 = Math.hypot(G[0]-S[0], G[1]-S[1]);
  const t2 = A ? 0.9 : 0.1;
  const lx = (x, lim) => Math.max(26, Math.min(lim, x));
  const ly = (y) => y < 16 ? y+13 : y-8;
  const dotClr = clr || "#ffffff";
  return (<svg viewBox="-3 -6 206 142" overflow="visible" style={{ width: "100%", maxWidth: 280, height: "auto", display: "block" }}>
    <rect x="1" y="1" width="198" height="128" fill="#060b14" stroke="#7889a044" strokeWidth="0.8" rx="2" />
    <line x1="100" y1="1" x2="100" y2="129" stroke="#7889a044" strokeWidth="0.6" />
    <circle cx="100" cy="65" r="17" fill="none" stroke="#7889a044" strokeWidth="0.6" />
    <circle cx="100" cy="65" r="1" fill="#7889a044" />
    <rect x="166" y="28" width="33" height="74" fill="none" stroke="#7889a044" strokeWidth="0.6" />
    <rect x="188" y="44" width="11" height="42" fill="none" stroke="#7889a033" strokeWidth="0.5" />
    <circle cx="176" cy="65" r="0.8" fill="#7889a044" />
    <rect x="1" y="28" width="33" height="74" fill="none" stroke="#7889a044" strokeWidth="0.6" />
    <rect x="1" y="44" width="11" height="42" fill="none" stroke="#7889a033" strokeWidth="0.5" />
    <circle cx="24" cy="65" r="0.8" fill="#7889a044" />
    <rect x="199" y="56" width="3.5" height="18" fill="#7889a022" stroke="#7889a066" strokeWidth="0.7" />
    <rect x="-2.5" y="56" width="3.5" height="18" fill="#7889a022" stroke="#7889a066" strokeWidth="0.7" />
    {A && <line x1={A[0]} y1={A[1]} x2={S[0]} y2={S[1]} className="gv-anim" stroke="#ffffff66" strokeWidth="1.1" strokeDasharray={len1} style={{ "--gv-len": len1+"px", animation: "gvLine 0.8s ease-in-out both" }} />}
    <line x1={S[0]} y1={S[1]} x2={G[0]} y2={G[1]} className="gv-anim" stroke="#ffffffcc" strokeWidth="1.4" strokeDasharray={len2} style={{ "--gv-len": len2+"px", animation: "gvLine 0.5s ease-in "+t2.toFixed(2)+"s both" }} />
    {A && <g>
      <circle cx={A[0]} cy={A[1]} r="4" fill={dotClr} stroke="#060b14" strokeWidth="1" opacity="0.95" />
      <text x={lx(A[0],194)} y={ly(A[1])} textAnchor="middle" fill="#ffffff" fontSize="7" fontFamily="monospace" fontWeight="600">{gvSn(gv.assist)}</text>
    </g>}
    <circle cx={S[0]} cy={S[1]} r="4" fill={dotClr} stroke="#060b14" strokeWidth="1" opacity="0.95" />
    <text x={lx(S[0],194)} y={ly(S[1])} textAnchor="middle" fill="#ffffff" fontSize="7" fontFamily="monospace" fontWeight="600">{gvSn(gv.scorer)}</text>
    {A && <g className="gv-anim" style={{ "--gv-dx": (S[0]-A[0])+"px", "--gv-dy": (S[1]-A[1])+"px", animation: "gvBallA 0.8s ease-in-out both" }}>
      <circle cx={A[0]} cy={A[1]} r="2.8" fill="#ffffff" stroke="#060b14" strokeWidth="0.8" />
    </g>}
    <g className="gv-anim" style={{ "--gv-dx": (G[0]-S[0])+"px", "--gv-dy": (G[1]-S[1])+"px", animation: "gvBallB 0.5s ease-in "+t2.toFixed(2)+"s both" }}>
      <circle cx={S[0]} cy={S[1]} r="2.8" fill="#ffffff" stroke="#060b14" strokeWidth="0.8" />
    </g>
    <circle cx={G[0]} cy={G[1]} r="4" fill="none" stroke="#a3be8c" strokeWidth="1.5" className="gv-anim" style={{ transformBox: "fill-box", transformOrigin: "center", animation: "gvBurst 0.5s ease-out "+(t2+0.5).toFixed(2)+"s both" }} />
  </svg>);
}
const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.cdnfonts.com/css/neue-montreal');
*{box-sizing:border-box;margin:0;padding:0;}
html{overflow-y:scroll;}
body{font-family:'Neue Montreal','Inter','Helvetica Neue',sans-serif;}
::selection{background:#e4002b44;color:#ffffff;}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#1e2a3d;border-radius:10px;}
::-webkit-scrollbar-thumb:hover{background:#7889a0;}
input,select,textarea{font-family:inherit;transition:border-color 0.2s,box-shadow 0.2s;}
input[type=number]{-moz-appearance:textfield;}
input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
input[type=color]{-webkit-appearance:none;appearance:none;padding:0;}
input[type=color]::-webkit-color-swatch-wrapper{padding:0;border-radius:2px;}
input[type=color]::-webkit-color-swatch{border:none;border-radius:2px;}
input[type=color]::-moz-color-swatch{border:none;border-radius:2px;}
input:focus,select:focus,textarea:focus{border-color:#e4002b !important;outline:none;box-shadow:0 0 0 3px #e4002b20;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes goalPunch{0%{transform:scale(1)}15%{transform:scale(1.25)}30%{transform:scale(0.95)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes goalGlow{0%{text-shadow:0 0 24px #ffffff,0 0 48px #e4002b44;}50%{text-shadow:0 0 36px #ffffff,0 0 72px #e4002b44;}100%{text-shadow:none;}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes marqueeScroll{0%,20%{transform:translateX(0)}50%,70%{transform:translateX(var(--marquee-dist))}100%{transform:translateX(0)}}
.marquee-name{animation:marqueeScroll 7s ease-in-out infinite;}
.ev-enter{animation:slideIn 0.3s ease;}
.goal-flash{animation:goalPunch 0.6s ease-out, goalGlow 1.2s ease-out;}
.tick-btn{transition:all 0.12s ease;}
.tick-btn:hover{filter:brightness(1.15);transform:translateY(-1px);}
.tick-btn:active{transform:scale(0.97) translateY(0);}
button{transition:all 0.15s ease;}
button:hover:not(:disabled){filter:brightness(1.18);}
.gbtn:hover{filter:brightness(1.05) !important;box-shadow:0 0 12px #e4002b88,0 0 4px #e4002b66;}
button:disabled{opacity:0.35;cursor:not-allowed;}
details>summary{cursor:pointer;user-select:none;list-style:none;transition:color 0.15s;}
details>summary:hover{color:#ffffff !important;}
details>summary::-webkit-details-marker{display:none;}
details>summary .dta{display:inline-block;margin-right:6px;transition:transform 0.15s;}
details[id^="doc-"]>summary+p{margin-top:12px;}
details[id^="doc-"]>summary+div{margin-top:12px;}
details[open]>summary .dta{transform:rotate(90deg);}
.team-row{transition:background 0.15s;}
.team-row:hover{background:#141c2b !important;}
.ko-match{transition:border-color 0.15s, box-shadow 0.15s;}
.ko-match:hover{border-color:#7889a0 !important;}
.panel{background:#141c2b;border:1px solid #2a3a50;border-radius:10px;}
select{cursor:pointer;}
input::placeholder{color:#7889a0;}
table{border-spacing:0;}
@keyframes goalFlash{0%{text-shadow:0 0 24px #ffffff,0 0 48px #e4002b44;}50%{text-shadow:0 0 36px #ffffff,0 0 72px #e4002b44;}100%{text-shadow:none;}}
@keyframes cardPop{0%{opacity:0;transform:translateY(8px) scale(0.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
.ev-card{animation:cardPop 0.35s ease-out;}
@keyframes gvLine{from{stroke-dashoffset:var(--gv-len);}to{stroke-dashoffset:0;}}
@keyframes gvBallA{0%{transform:translate(0,0);opacity:0;}8%{opacity:1;}92%{opacity:1;}100%{transform:translate(var(--gv-dx),var(--gv-dy));opacity:0;}}
@keyframes gvBallB{0%{transform:translate(0,0);opacity:0;}10%{opacity:1;}100%{transform:translate(var(--gv-dx),var(--gv-dy));opacity:1;}}
@keyframes gvBallTo{from{transform:translate(0,0);}to{transform:translate(var(--gv-bdx),var(--gv-bdy));}}
@keyframes gvKeep{from{transform:translateX(var(--gv-kdx));}to{transform:translateX(0);}}
@keyframes gvBurst{0%{opacity:0;transform:scale(0.4);}12%{opacity:0.9;}100%{opacity:0;transform:scale(2.4);}}
.live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#e4002b;animation:pulse 1.8s ease-in-out infinite;margin-right:5px;vertical-align:middle;}
@media(max-width:600px){
  .grid-2col{grid-template-columns:1fr !important;gap:10px 0 !important;}
  .grid-2col>.divider-col{display:none !important;}
  .grid-3col{grid-template-columns:1fr 1fr !important;}
  .grid-4col{grid-template-columns:1fr !important;}
  .pre-match-grid{grid-template-columns:1fr !important;}
}
details{border:none;border-bottom:none;}
@media(prefers-reduced-motion:reduce){
  .ev-enter,.goal-flash,.tick-btn,.live-dot{animation:none !important;}
  .gv-anim{animation-duration:0.01ms !important;animation-delay:0ms !important;}
  *{transition-duration:0.01ms !important;}
}
`;

const T_PRESETS = {
  league: { label: "League", config: { mode: "single", singleType: "groups", numGroups: 1, matchFormat: "roundRobin", rrLegs: 2, allocMode: "seed", homeAdvGroup: "first", homeAdvKO: "off", thirdPlace: false, koLegs: 1, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 1, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", injuries: true, tiebreakers: ['gd', 'gf', 'h2h', 'wins'], qualZones: [{ anchor: "top", from: 1, to: 1, label: "Champion", color: "#ebcb8b", type: "cosmetic" }, { anchor: "bottom", from: 1, to: 3, label: "Relegation", color: "#bf616a", type: "cosmetic" }] } },
  oldWC: { label: "Old World Cup", config: { mode: "double", singleType: "groups", numGroups: 8, matchFormat: "roundRobin", rrLegs: 1, allocMode: "draw", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: true, koLegs: 1, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 2, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", injuries: true, tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }] } },
  newWC: { label: "New World Cup", config: { mode: "double", singleType: "groups", numGroups: 12, matchFormat: "roundRobin", rrLegs: 1, allocMode: "draw", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: true, koLegs: 1, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 2, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", injuries: true, tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }, { anchor: "top", from: 3, to: 3, label: "Best 3rd", color: "#4a7ab5", type: "best", bestCount: 8 }] } },
  oldUCL: { label: "Old UCL", config: { mode: "double", singleType: "groups", numGroups: 8, matchFormat: "roundRobin", rrLegs: 2, allocMode: "draw", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: false, koLegs: 2, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 2, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", injuries: true, tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }] } },
  newUCL: { label: "New UCL", config: { mode: "double", singleType: "groups", numGroups: 1, matchFormat: "swiss", rrLegs: 1, allocMode: "seed", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: false, koLegs: 2, koAwayGoals: false, homeAdvTeams: [], advPerGroup: 8, numPots: 4, swissRounds: 8, koAllocMode: "seed", koByeMode: "auto", injuries: true, tiebreakers: ['gd', 'gf', 'buchholz', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 8, label: "Advance", color: "#5e9c6b", type: "advance" }, { anchor: "top", from: 9, to: 24, label: "Playoff", color: "#4a7ab5", type: "advance" }] } },
  cup: { label: "Cup", config: { mode: "single", singleType: "knockout", koLegs: 1, koAllocMode: "seed", homeAdvKO: "weak_skill", homeAdvGroup: "off", thirdPlace: false, koAwayGoals: true, homeAdvTeams: [], numGroups: 8, advPerGroup: 2, numPots: 4, matchFormat: "roundRobin", rrLegs: 1, swissRounds: 5, allocMode: "seed", koByeMode: "auto", injuries: true, tiebreakers: ['gd', 'gf', 'h2h', 'wins'], qualZones: [] } },
};
// ═══════════════════════════════════════════════════════════════════════════════
const TB = (t) => t===2?<span style={{color:"#e4002b",fontSize:"0.9em",marginLeft:2}}>★</span>:t===1?<span style={{color:"#5b8fa8",fontSize:"0.85em",marginLeft:2,fontWeight:700,verticalAlign:"0.1em"}}>+</span>:null;
export default function App() {
  const [tab, setTab] = useState("live");
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [expandedParticipantLeagues, setExpandedParticipantLeagues] = useState(() => new Set());
  const [teams, setTeams] = useState(() => PRESET_CATALOG.map(t => ({...t, strategy: {...(t.strategy||{})}, squad: t.squad ? t.squad.map(p => ({...p})) : null})));
  const teamById = useMemo(() => { const m = new Map(); teams.forEach(t => m.set(t.id, t)); return m.get.bind(m); }, [teams]);
  const [showBulk, setShowBulk] = useState(false);
  const [teamSort, setTeamSort] = useState(null);
  const [teamLeagueFilter, setTeamLeagueFilter] = useState("");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [viewSquad, setViewSquad] = useState(null);
  const [viewInfo, setViewInfo] = useState(null);
  const [dupCodeId, setDupCodeId] = useState(null);
  const [loading, setLoading] = useState(false);

  // ─── LIVE MATCH ───
  const [lmH, setLmH] = useState(PRESET_CATALOG[0]?.id);
  const [lmA, setLmA] = useState(PRESET_CATALOG[1]?.id);
  const [lmForce, setLmForce] = useState(true);
  const [lmAllowTac, setLmAllowTac] = useState(true);
  const [lmHomeAdv, setLmHomeAdv] = useState(null);
  const [lmNeutralVenueName, setLmNeutralVenueName] = useState("");
  const [lmNeutralVenueLoc, setLmNeutralVenueLoc] = useState("");
  const [lm2ndLeg, setLm2ndLeg] = useState(false);
  const [lmMatch, setLmMatch] = useState(null);
  const [lmStartScore, setLmStartScore] = useState([0, 0]);
  const lmRng = useRef(null);
  const lmFeedRef = useRef(null);
  const [manualSub, setManualSub] = useState({side:null,off:null});
  const [gvReplayKeys, setGvReplayKeys] = useState({});
  const [goalFlash, setGoalFlash] = useState(null);
  const [lmTab, setLmTab] = useState("stats");
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1500);
  const [lmAutoSubs, setLmAutoSubs] = useState(true);
  const [lmStopOnEvents, setLmStopOnEvents] = useState(false);
  const autoRef = useRef(null);
  const [koBracketView, setKoBracketView] = useState(true);
  const exportBracket = () => {
    const ko = tKO; if (!ko?.rounds?.length) return;
    const nR = ko.rounds.length;
    let firstReal = 0;
    for (let ri = 0; ri < nR - 1; ri++) { if (ko.rounds[ri].matches.some(m => !m.bye)) { firstReal = ri; break; } }
    const leftR = [], rightR = [];
    for (let ri = firstReal; ri < nR - 1; ri++) {
      const rd = ko.rounds[ri], h = rd.matches.length / 2;
      leftR.push({ matches: rd.matches.slice(0, h), name: rd.name });
      rightR.push({ matches: rd.matches.slice(h), name: rd.name });
    }
    const dispHalf = leftR.length > 0 ? leftR[0].matches.length : 1;
    const cW = 180, cH = 48, gp = 8, cn = 24, pd = 24, hd = 18;
    const tH = Math.max(dispHalf, 2) * (cH + gp);
    const numCols = leftR.length + 1 + rightR.length;
    const numCn = Math.max(0, (leftR.length > 0 ? leftR.length : 0) + (rightR.length > 0 ? rightR.length : 0));
    const svgW = numCols * cW + numCn * cn + pd * 2;
    const svgH = tH + hd + pd * 2 + (ko.thirdPlace ? 80 : 20);
    const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const W = (m) => koWinner(m);
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" style="background:#141c2b">';
    s += '<style>text{font-family:Neue Montreal,Inter,Helvetica Neue,sans-serif;fill:#7889a0;font-size:10px}.w{fill:#ffffff;font-weight:600}.h{fill:#7889a0;font-size:8px;text-anchor:middle;letter-spacing:1px;font-weight:600}.p{fill:#d08770;font-size:8px}</style>';
    s += '<defs><linearGradient id="nameFade" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#141c2b" stop-opacity="0"/><stop offset="55%" stop-color="#141c2b" stop-opacity="1"/><stop offset="100%" stop-color="#141c2b" stop-opacity="1"/></linearGradient></defs>';
    const card = (m, x, y, fin) => {
      const w = W(m), brd = fin ? "#e4002b" : "#7889a0", bw = fin ? 2 : 1;
      s += '<rect x="'+x+'" y="'+y+'" width="'+cW+'" height="'+cH+'" rx="4" fill="#141c2b" stroke="'+brd+'" stroke-width="'+bw+'"/>';
      const hn = esc(m.home?.name||(m.bye?"BYE":"TBD")), an = esc(m.away?.name||(m.bye?"BYE":"TBD"));
      const is2L = m.result?.twoLeg, isPart = m.result?.partial;
      const maxNameLen = is2L && !isPart ? 18 : 22;
      const hnT = hn.length > maxNameLen ? hn.slice(0, maxNameLen-1) + "…" : hn;
      const anT = an.length > maxNameLen ? an.slice(0, maxNameLen-1) + "…" : an;
      const winnerIsHome = w && w === m.home;
      // The decision label (PENS/AET/AG) sits over the winner's row, right
      // where a long name may still reach. Its backing rect is wider than
      // the label text itself so the fade has real room to work — starting
      // fully transparent well before the label and reaching full opacity
      // before the label's own text begins, like a soft blur rather than a
      // hard cut.
      const addLabel = (lbl, clr, lx, ly) => {
        if (!lbl) return;
        const lblW = lbl.length * 5 + 6, fadeW = 44;
        const maskW = lblW + fadeW;
        s += '<rect x="'+(lx-maskW)+'" y="'+(ly-10)+'" width="'+maskW+'" height="13" fill="url(#nameFade)"/>';
        s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" style="font-family:Neue Montreal,Inter,Helvetica Neue,sans-serif;font-size:10px;fill:'+clr+';font-weight:700;font-style:italic">'+lbl+'</text>';
      };
      if (is2L && !isPart) {
        const l1h=m.result.leg1.home, l1a=m.result.leg1.away, l2h=m.result.leg2?.away||0, l2a=m.result.leg2?.home||0;
        const ah=m.result.agg?.home||0, aa=m.result.agg?.away||0;
        const hCls=w===m.home?' class="w"':'', aCls=w===m.away?' class="w"':'';
        s += '<text x="'+(x+6)+'" y="'+(y+19)+'"'+hCls+'>'+hnT+'</text>';
        s += '<text x="'+(x+6)+'" y="'+(y+37)+'"'+aCls+'>'+anT+'</text>';
        const legColW = 18, aggColW = 24, penColW = m.result.pen ? 26 : 0;
        const rightEdge = x+cW-6, aggEnd = rightEdge-penColW, l2End = aggEnd-aggColW, l1End = l2End-legColW;
        const legText = (val, xEnd, yy) => { s += '<text x="'+xEnd+'" y="'+yy+'" text-anchor="end" style="font-family:JetBrains Mono,monospace;fill:#7889a0">'+val+'</text>'; };
        const aggText = (val, xEnd, yy, cls) => { s += '<text x="'+xEnd+'" y="'+yy+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+cls+'>'+val+'</text>'; };
        const penText = (val, yy) => { if (!m.result.pen) return; s += '<text x="'+rightEdge+'" y="'+yy+'" text-anchor="end" style="font-family:JetBrains Mono,monospace;font-size:8px;fill:#d08770">('+val+')</text>'; };
        legText(l1h, l1End, y+19);
        legText(l2h, l2End, y+19);
        aggText(ah, aggEnd, y+19, hCls);
        penText(m.result.pen?.home, y+19);
        legText(l1a, l1End, y+37);
        legText(l2a, l2End, y+37);
        aggText(aa, aggEnd, y+37, aCls);
        penText(m.result.pen?.away, y+37);
        const lbl = m.result.pen ? "PENS" : m.result.et ? "AET" : (m.result.awayGoalsRule && ah===aa) ? "AG" : null;
        const lblClr = m.result.pen ? "#d08770" : "#7889a0";
        addLabel(lbl, lblClr, l1End-legColW-4, winnerIsHome ? y+19 : y+37);
      } else {
        const hs = m.result?(isPart?m.result.leg1.home:m.result.ftHome+(m.result.et?.home||0)):"";
        const as2 = m.result?(isPart?m.result.leg1.away:m.result.ftAway+(m.result.et?.away||0)):"";
        s += '<text x="'+(x+6)+'" y="'+(y+19)+'"'+(w===m.home?' class="w"':'')+'>'+ hnT+'</text>';
        let hsc = String(hs); if(m.result?.pen) hsc += ' ('+m.result.pen.home+')';
        s += '<text x="'+(x+cW-6)+'" y="'+(y+19)+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+(w===m.home?' class="w"':'')+'>'+hsc+'</text>';
        s += '<text x="'+(x+6)+'" y="'+(y+37)+'"'+(w===m.away?' class="w"':'')+'>'+ anT+'</text>';
        let asc = String(as2); if(m.result?.pen) asc += ' ('+m.result.pen.away+')';
        s += '<text x="'+(x+cW-6)+'" y="'+(y+37)+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+(w===m.away?' class="w"':'')+'>'+asc+'</text>';
        const lbl = m.result && !isPart ? (m.result.pen ? "PENS" : m.result.et ? "AET" : null) : null;
        const lblClr = m.result?.pen ? "#d08770" : "#7889a0";
        const scoreW2 = String(m.result?.pen ? asc : hsc).length * 6 + 16;
        addLabel(lbl, lblClr, x+cW-6-scoreW2, winnerIsHome ? y+19 : y+37);
      }
    };
    const col = (matches, x, label) => {
      s += '<text x="'+(x+cW/2)+'" y="'+(pd+12)+'" class="h">'+esc(label.toUpperCase())+'</text>';
      const n = matches.length, sl = tH / n, cs = [];
      matches.forEach((m, mi) => { if (m.bye) { cs.push(null); return; } const y = pd+hd+(mi+0.5)*sl-cH/2; card(m,x,y,false); cs.push(y+cH/2); });
      return cs;
    };
    const lines = (cs, x, n, side) => {
      const sl = tH / n;
      for (let i = 0; i < (n>>1); i++) {
        const y1=pd+hd+(2*i+0.5)*sl, y2=pd+hd+(2*i+1.5)*sl, mid=(y1+y2)/2;
        const h1=cs[2*i]!==null, h2=cs[2*i+1]!==null;
        if(!h1&&!h2) continue;
        if(side==="left"){
          if(h1) s+='<line x1="'+x+'" y1="'+y1+'" x2="'+(x+cn/2)+'" y2="'+y1+'" stroke="#7889a0"/>';
          if(h2) s+='<line x1="'+x+'" y1="'+y2+'" x2="'+(x+cn/2)+'" y2="'+y2+'" stroke="#7889a0"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+(h1?y1:mid)+'" x2="'+(x+cn/2)+'" y2="'+(h2?y2:mid)+'" stroke="#7889a0"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+mid+'" x2="'+(x+cn)+'" y2="'+mid+'" stroke="#7889a0"/>';
        } else {
          if(h1) s+='<line x1="'+(x+cn)+'" y1="'+y1+'" x2="'+(x+cn/2)+'" y2="'+y1+'" stroke="#7889a0"/>';
          if(h2) s+='<line x1="'+(x+cn)+'" y1="'+y2+'" x2="'+(x+cn/2)+'" y2="'+y2+'" stroke="#7889a0"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+(h1?y1:mid)+'" x2="'+(x+cn/2)+'" y2="'+(h2?y2:mid)+'" stroke="#7889a0"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+mid+'" x2="'+x+'" y2="'+mid+'" stroke="#7889a0"/>';
        }
      }
      if (n % 2 === 1 && cs[n-1] !== null) {
        const y = pd+hd+(n-0.5)*(tH/n);
        if (side==="left") s+='<line x1="'+x+'" y1="'+y+'" x2="'+(x+cn)+'" y2="'+y+'" stroke="#7889a0"/>';
        else s+='<line x1="'+(x+cn)+'" y1="'+y+'" x2="'+x+'" y2="'+y+'" stroke="#7889a0"/>';
      }
    };
    let cx = pd, prev = null, prevN = 0;
    leftR.forEach((lr, i) => { if(prev){lines(prev,cx,prevN,"left");cx+=cn;} const cs=col(lr.matches,cx,lr.name); prev=cs; prevN=lr.matches.length; cx+=cW; });
    if(prev){lines(prev,cx,prevN,"left");cx+=cn;}
    const fY=pd+hd+tH/2-cH/2;
    s+='<text x="'+(cx+cW/2)+'" y="'+(fY-6)+'" style="fill:#7889a0;font-size:8px;text-anchor:middle;letter-spacing:1px;font-weight:600">FINAL</text>';
    card(ko.rounds[nR-1].matches[0],cx,fY,true);
    if(ko.thirdPlace){const tpY=fY+cH+24; s+='<text x="'+(cx+cW/2)+'" y="'+(tpY-6)+'" style="fill:#d08770;font-size:8px;text-anchor:middle;letter-spacing:1px;font-weight:600">3RD PLACE</text>'; card(ko.thirdPlace,cx,tpY,false);}
    cx+=cW;
    const rev=[...rightR].reverse();
    // Right side: calculate all x positions first, render outer→inner
    const rightStartX = cx + (leftR.length > 0 ? cn : 0);
    const rightTotalW = rev.length * cW + Math.max(0, rev.length - 1) * cn;
    // Render right columns from outermost (last in rev) to innermost (first in rev)
    let prevR = null, prevRN = 0;
    for (let i = rev.length - 1; i >= 0; i--) {
      const rr = rev[i];
      const rx = rightStartX + rightTotalW - (rev.length - i) * cW - Math.max(0, rev.length - 1 - i) * cn;
      if (prevR) {
        const connRX = rx + cW;
        lines(prevR, connRX, prevRN, "right");
      }
      const cs = col(rr.matches, rx, rr.name);
      prevR = cs; prevRN = rr.matches.length;
    }
    if (prevR) lines(prevR, cx, prevRN, "right");
    s+='</svg>';
    const blob = new Blob([s], {type: "image/svg+xml"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bracket.svg";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };
  const exportDEBracket = () => {
    const ko = tKO; if (!ko?.rounds?.length || !ko.losers) return;
    const nR = ko.rounds.length;
    let wbFirst = 0;
    for (let ri = 0; ri < nR; ri++) { if (ko.rounds[ri].matches.some(m => !m.bye)) { wbFirst = ri; break; } }
    const wbRounds = ko.rounds.slice(wbFirst);
    const wbN0 = wbRounds[0].matches.length;
    const lbRounds = ko.losers;
    const lbN0 = lbRounds[0].matches.length;
    const cW = 180, cH = 48, gp = 8, cn = 24, pd = 24, hd = 18;
    const wbH = Math.max(wbN0, 2) * (cH + gp);
    const lbH = Math.max(lbN0, 2) * (cH + gp);
    const wbCols = wbRounds.length, lbCols = lbRounds.length;
    const gfCols = 1 + (ko.reset && (ko.reset.home || ko.reset.away) ? 1 : 0);
    const wbTotalCols = wbCols + gfCols;
    const maxCols = Math.max(wbTotalCols, lbCols);
    const svgW = maxCols * cW + Math.max(0, maxCols - 1) * cn + pd * 2;
    const svgH = pd + hd + wbH + 20 + hd + lbH + pd + 20;
    const esc = (str) => String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const W = (m) => koWinner(m);
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" style="background:#141c2b">';
    s += '<style>text{font-family:Neue Montreal,Inter,Helvetica Neue,sans-serif;fill:#7889a0;font-size:10px}.w{fill:#ffffff;font-weight:600}.h{fill:#7889a0;font-size:8px;text-anchor:middle;letter-spacing:1px;font-weight:600}.p{fill:#d08770;font-size:8px}.sec{fill:#7889a0;font-size:9px;font-weight:700;letter-spacing:2px}.gfsec{fill:#e4002b;font-size:9px;font-weight:700;letter-spacing:2px}</style>';
    s += '<defs><linearGradient id="nameFade" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#141c2b" stop-opacity="0"/><stop offset="55%" stop-color="#141c2b" stop-opacity="1"/><stop offset="100%" stop-color="#141c2b" stop-opacity="1"/></linearGradient></defs>';
    const card = (m, x, y, brd, bw) => {
      const w = W(m);
      s += '<rect x="'+x+'" y="'+y+'" width="'+cW+'" height="'+cH+'" rx="4" fill="#141c2b" stroke="'+brd+'" stroke-width="'+bw+'"/>';
      const hn = esc(m.home?.name||(m.bye?"BYE":"TBD")), an = esc(m.away?.name||(m.bye?"BYE":"TBD"));
      const is2L = m.result?.twoLeg, isPart = m.result?.partial;
      const maxNL = is2L && !isPart ? 18 : 22;
      const hnT = hn.length > maxNL ? hn.slice(0, maxNL-1) + "…" : hn;
      const anT = an.length > maxNL ? an.slice(0, maxNL-1) + "…" : an;
      const winnerIsHome = w && w === m.home;
      const addLabel = (lbl, clr, lx, ly) => {
        if (!lbl) return;
        const lblW = lbl.length * 5 + 6, fadeW = 44, maskW = lblW + fadeW;
        s += '<rect x="'+(lx-maskW)+'" y="'+(ly-10)+'" width="'+maskW+'" height="13" fill="url(#nameFade)"/>';
        s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" style="font-family:Neue Montreal,Inter,Helvetica Neue,sans-serif;font-size:10px;fill:'+clr+';font-weight:700;font-style:italic">'+lbl+'</text>';
      };
      if (is2L && !isPart) {
        const l1h=m.result.leg1.home, l1a=m.result.leg1.away, l2h=m.result.leg2?.away||0, l2a=m.result.leg2?.home||0;
        const ah=m.result.agg?.home||0, aa=m.result.agg?.away||0;
        const hCls=w===m.home?' class="w"':'', aCls=w===m.away?' class="w"':'';
        s += '<text x="'+(x+6)+'" y="'+(y+19)+'"'+hCls+'>'+hnT+'</text>';
        s += '<text x="'+(x+6)+'" y="'+(y+37)+'"'+aCls+'>'+anT+'</text>';
        const legColW = 18, aggColW = 24, penColW = m.result.pen ? 26 : 0;
        const rightEdge = x+cW-6, aggEnd = rightEdge-penColW, l2End = aggEnd-aggColW, l1End = l2End-legColW;
        const legText = (val, xEnd, yy) => { s += '<text x="'+xEnd+'" y="'+yy+'" text-anchor="end" style="font-family:JetBrains Mono,monospace;fill:#7889a0">'+val+'</text>'; };
        const aggText = (val, xEnd, yy, cls) => { s += '<text x="'+xEnd+'" y="'+yy+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+cls+'>'+val+'</text>'; };
        const penText = (val, yy) => { if (!m.result.pen) return; s += '<text x="'+rightEdge+'" y="'+yy+'" text-anchor="end" style="font-family:JetBrains Mono,monospace;font-size:8px;fill:#d08770">('+val+')</text>'; };
        legText(l1h, l1End, y+19); legText(l2h, l2End, y+19); aggText(ah, aggEnd, y+19, hCls); penText(m.result.pen?.home, y+19);
        legText(l1a, l1End, y+37); legText(l2a, l2End, y+37); aggText(aa, aggEnd, y+37, aCls); penText(m.result.pen?.away, y+37);
        const lbl = m.result.pen ? "PENS" : m.result.et ? "AET" : (m.result.awayGoalsRule && ah===aa) ? "AG" : null;
        addLabel(lbl, m.result.pen ? "#d08770" : "#7889a0", l1End-legColW-4, winnerIsHome ? y+19 : y+37);
      } else {
        const hs = m.result?(isPart?m.result.leg1.home:m.result.ftHome+(m.result.et?.home||0)):"";
        const as2 = m.result?(isPart?m.result.leg1.away:m.result.ftAway+(m.result.et?.away||0)):"";
        s += '<text x="'+(x+6)+'" y="'+(y+19)+'"'+(w===m.home?' class="w"':'')+'>'+ hnT+'</text>';
        let hsc = String(hs); if(m.result?.pen) hsc += ' ('+m.result.pen.home+')';
        s += '<text x="'+(x+cW-6)+'" y="'+(y+19)+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+(w===m.home?' class="w"':'')+'>'+hsc+'</text>';
        s += '<text x="'+(x+6)+'" y="'+(y+37)+'"'+(w===m.away?' class="w"':'')+'>'+ anT+'</text>';
        let asc = String(as2); if(m.result?.pen) asc += ' ('+m.result.pen.away+')';
        s += '<text x="'+(x+cW-6)+'" y="'+(y+37)+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+(w===m.away?' class="w"':'')+'>'+asc+'</text>';
        const lbl = m.result && !isPart ? (m.result.pen ? "PENS" : m.result.et ? "AET" : null) : null;
        const scoreW2 = String(m.result?.pen ? asc : hsc).length * 6 + 16;
        addLabel(lbl, m.result?.pen ? "#d08770" : "#7889a0", x+cW-6-scoreW2, winnerIsHome ? y+19 : y+37);
      }
    };
    const pairLines = (srcMatches, x, baseY, height) => {
      const srcN = srcMatches.length, sl = height / srcN;
      for (let i = 0; i < (srcN>>1); i++) {
        const m1 = srcMatches[2*i], m2 = srcMatches[2*i+1];
        if (m1.bye && m2.bye) continue;
        const y1 = baseY + (2*i+0.5)*sl, y2 = baseY + (2*i+1.5)*sl, mid = (y1+y2)/2;
        if (!m1.bye) s += '<line x1="'+x+'" y1="'+y1+'" x2="'+(x+cn/2)+'" y2="'+y1+'" stroke="#7889a0"/>';
        if (!m2.bye) s += '<line x1="'+x+'" y1="'+y2+'" x2="'+(x+cn/2)+'" y2="'+y2+'" stroke="#7889a0"/>';
        s += '<line x1="'+(x+cn/2)+'" y1="'+(m1.bye?mid:y1)+'" x2="'+(x+cn/2)+'" y2="'+(m2.bye?mid:y2)+'" stroke="#7889a0"/>';
        s += '<line x1="'+(x+cn/2)+'" y1="'+mid+'" x2="'+(x+cn)+'" y2="'+mid+'" stroke="#7889a0"/>';
      }
      if (srcN % 2 === 1 && !srcMatches[srcN-1].bye) { const y = baseY + (srcN-0.5)*sl; s += '<line x1="'+x+'" y1="'+y+'" x2="'+(x+cn)+'" y2="'+y+'" stroke="#7889a0"/>'; }
    };
    const straightLines = (srcMatches, x, baseY, height) => {
      const srcN = srcMatches.length, sl = height / srcN;
      for (let i = 0; i < srcN; i++) { if (srcMatches[i].bye) continue; const y = baseY + (i+0.5)*sl; s += '<line x1="'+x+'" y1="'+y+'" x2="'+(x+cn)+'" y2="'+y+'" stroke="#7889a0"/>'; }
    };
    const renderSection = (rounds, baseY, height, brd, bw, sectionClr, connTypes) => {
      let cx = pd;
      rounds.forEach((rd, ri) => {
        if (ri > 0) {
          const prevM = rounds[ri-1].matches;
          if (connTypes && connTypes[ri] === "straight") straightLines(prevM, cx, baseY + hd, height);
          else pairLines(prevM, cx, baseY + hd, height);
          cx += cn;
        }
        const n = rd.matches.length, sl = height / n;
        s += '<text x="'+(cx+cW/2)+'" y="'+(baseY+12)+'" class="h" style="fill:'+sectionClr+'">'+esc((rd.name||"").toUpperCase())+'</text>';
        rd.matches.forEach((m, mi) => { if (m.bye) return; const y = baseY + hd + (mi+0.5)*sl - cH/2; card(m, cx, y, brd, bw); });
        cx += cW;
      });
      return cx;
    };
    // WB section + GF + Reset inline
    const wbBaseY = pd;
    s += '<text x="'+pd+'" y="'+(wbBaseY - 4)+'" class="sec">WINNERS BRACKET</text>';
    const lbConnTypes = {};
    lbRounds.forEach((rd, i) => { if (i > 0) lbConnTypes[i] = rd.type === "internal" ? "pair" : "straight"; });
    let wbEndX = renderSection(wbRounds, wbBaseY + 8, wbH, "#2a3a50", 1, "#7889a0", null);
    // GF inline after WB final
    const gfMidY = wbBaseY + 8 + hd + wbH / 2;
    s += '<line x1="'+wbEndX+'" y1="'+gfMidY+'" x2="'+(wbEndX+cn)+'" y2="'+gfMidY+'" stroke="#7889a0"/>';
    wbEndX += cn;
    s += '<text x="'+(wbEndX+cW/2)+'" y="'+(wbBaseY+8+12)+'" class="h" style="fill:#e4002b">Grand Final</text>';
    card(ko.grandFinal, wbEndX, gfMidY - cH/2, "#e4002b", 2);
    wbEndX += cW;
    if (ko.reset && (ko.reset.home || ko.reset.away)) {
      s += '<line x1="'+wbEndX+'" y1="'+gfMidY+'" x2="'+(wbEndX+cn)+'" y2="'+gfMidY+'" stroke="#7889a0"/>';
      wbEndX += cn;
      s += '<text x="'+(wbEndX+cW/2)+'" y="'+(wbBaseY+8+12)+'" class="h" style="fill:#ebcb8b">RESET</text>';
      card(ko.reset, wbEndX, gfMidY - cH/2, "#ebcb8b", 1);
      wbEndX += cW;
    }
    // LB section
    const lbTopY = wbBaseY + 8 + hd + wbH + 16;
    s += '<line x1="'+pd+'" y1="'+(lbTopY - 4)+'" x2="'+(svgW-pd)+'" y2="'+(lbTopY - 4)+'" stroke="#2a3a50" stroke-opacity="0.3"/>';
    s += '<text x="'+pd+'" y="'+(lbTopY + 8)+'" class="sec">LOSERS BRACKET</text>';
    renderSection(lbRounds, lbTopY + 16, lbH, "#2a3a50", 1, "#7889a0", lbConnTypes);
    s += '</svg>';
    const blob = new Blob([s], {type: "image/svg+xml"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "de-bracket.svg";
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };
  const [lastLiveResult, setLastLiveResult] = useState(null);

  // ─── TOURNAMENT ───
  const [tPhase, setTPhase] = useState("setup");
  const [tournamentTeamIds, setTournamentTeamIds] = useState([]);
  const tournamentTeams = tournamentTeamIds.map(id => teamById(id)).filter(Boolean);
  const [tPlayerStats, setTPlayerStats] = useState({});
  const [tLeaderboard, setTLeaderboard] = useState(null);
  const [tConfig, setTConfig] = useState({ mode: "double", singleType: "knockout", numGroups: 8, advPerGroup: 2, thirdPlace: true, allocMode: "seed", koAllocMode: "seed", numPots: 4, matchFormat: "roundRobin", rrLegs: 1, swissRounds: 5, homeAdvGroup: "off", homeAdvKO: "off", homeAdvTeams: [], koLegs: 1, koAwayGoals: true, koByeMode: 'auto', koFormat: 'single', koGFReset: false, injuries: true, tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }] });
  const [tGroups, setTGroups] = useState([]);
  const [tKO, setTKO] = useState(null);
  const [tDrawLog, setTDrawLog] = useState([]);
  const [tKODrawLog, setTKODrawLog] = useState([]);
  const [tManual, setTManual] = useState(null); // manual allocation state
  const [tKOManual, setTKOManual] = useState(null);
  const [tByeManual, setTByeManual] = useState(null);
  const [tDrawAnim, setTDrawAnim] = useState(null);
  const tDrawTimerRef = useRef(null);
  const [tPoolData, setTPoolData] = useState(null);
  const [tEdit, setTEdit] = useState(null); // {gi, ri, mi, h:"", a:""} for manual score entry
  const [tKoEdit, setTKoEdit] = useState(null); // {ri, mi, h:"", a:""} for knockout manual score
  const [tScoreError, setTScoreError] = useState("");
  const [tHomeAdvOverrides, setTHomeAdvOverrides] = useState({});
  const [tHostVenueText, setTHostVenueText] = useState("");
  const [tReplayCounts, setTReplayCounts] = useState({});
  const tHostVenuePool = parseVenuePool(tHostVenueText);
  const [tLiveTarget, setTLiveTarget] = useState(null);
  const tToggleHA = (key) => setTHomeAdvOverrides(p => { const c = p[key] || null; const n = c === null ? "home" : c === "home" ? "away" : c === "away" ? "off" : null; const nm = { ...p }; if (n === null) delete nm[key]; else nm[key] = n; return nm; });
  const tGetHA = (key, fallback) => { const o = tHomeAdvOverrides[key]; if (o === "off") return null; if (o === "home" || o === "away") return o; return fallback; };

  useEffect(() => { if (lmFeedRef.current) lmFeedRef.current.scrollTop = lmFeedRef.current.scrollHeight; }, [lmMatch?.events.length]);
  useEffect(() => {
    if (autoPlay && lmMatch && lmMatch.phase !== "finished") {
      const delay = lmMatch.phase === "pre_match" ? 2000 : autoSpeed;
      autoRef.current = setInterval(() => {
        setLmMatch(prev => {
          if (!prev || prev.phase === "finished") { setAutoPlay(false); return prev; }
          const prevLen = prev.events.length;
          const next = lmAdvance(prev, lmRng.current, { name: teamById(lmH).name, skill: teamById(lmH).skill }, { name: teamById(lmA).name, skill: teamById(lmA).skill });
          if (lmStopOnEvents) {
            const stopPhases = new Set(["half_time", "full_time", "et_half_time", "et_full_time", "finished"]);
            if (stopPhases.has(next.phase) && !stopPhases.has(prev.phase)) { setAutoPlay(false); }
            else if (next.events.length > prevLen) {
              const major = new Set(["goal", "red", "penalty"]);
              for (let i = prevLen; i < next.events.length; i++) {
                if (major.has(next.events[i].type)) { setAutoPlay(false); break; }
              }
            }
          }
          return next;
        });
      }, delay);
      return () => clearInterval(autoRef.current);
    } else { if (autoRef.current) clearInterval(autoRef.current); }
  }, [autoPlay, autoSpeed, lmMatch?.phase, teams, lmH, lmA, lmStopOnEvents]);

  // ─── TEAM MGMT ───
  const addTeam = () => setTeams(t => [...t, { id: "Custom::" + Date.now() + "-" + t.length, league: "Custom", name: `Team ${t.length + 1}`, skill: 50, style: "balanced", formation: "4-3-3", strategy: {...STRAT_DEF} }]);
  const removeTeam = (id) => setTeams(t => t.filter(tm => tm.id !== id));
  const updateTeam = (id, f, v) => setTeams(t => t.map(tm => { if (tm.id !== id) return tm; const nt = { ...tm, [f]: f === "skill" ? (v === "" ? "" : Number(v)) : v }; if (f === "formation") { const names = tm.squad ? tm.squad.map(p => p.name) : null; const tiers = tm.squad ? tm.squad.map(p => p.tier || 0) : null; nt.squad = buildSquad(v, names); if (tiers) nt.squad.forEach((p, i) => { if (i < tiers.length) p.tier = tiers[i]; }); } return nt; }));
  const teamErrors = teams.some(t => t.skill === "" || t.skill < 25 || t.skill > 100);
  const importBulk = () => { const p = parseBulk(bulkText); if (p.length > 0) { setTeams(prev => { const existing = new Set(prev.map(t => t.code || t.name)); const fresh = p.filter(t => !existing.has(t.code || t.name)).map(t => ({...t, league: "Custom", id: "Custom::" + (t.code || t.name), strategy: {...(t.strategy||{})}, squad: t.squad ? t.squad.map(p2 => ({...p2})) : null})); return [...prev, ...fresh]; }); setShowBulk(false); setBulkText(""); } };
  // Capture finished live match result for tournament import
  const lmPhase = lmMatch?.phase;
  const prevScoreRef = useRef([0,0]);
  useEffect(() => {
    if (!lmMatch) return;
    const [ph, pa] = prevScoreRef.current;
    if (lmMatch.score[0] > ph) { setGoalFlash("home"); setTimeout(() => setGoalFlash(null), 1200); }
    else if (lmMatch.score[1] > pa) { setGoalFlash("away"); setTimeout(() => setGoalFlash(null), 1200); }
    prevScoreRef.current = [...lmMatch.score];
  }, [lmMatch?.score?.[0], lmMatch?.score?.[1]]);
  useEffect(() => {
    if (lmPhase === "finished" && lmMatch) {
      const allPlayers = (side) => [...(lmMatch.players?.[side]||[]), ...(lmMatch.subbedOff?.[side]||[])];
      setLastLiveResult({
        homeName: teamById(lmH)?.name, awayName: teamById(lmA)?.name,
        homeCode: teamById(lmH)?.code, awayCode: teamById(lmA)?.code,
        homeScore: lmMatch.score[0], awayScore: lmMatch.score[1],
        goalscorers: JSON.parse(JSON.stringify(lmMatch.goalscorers || {home:[],away:[]})),
        homePlayers: allPlayers("home").map(p => ({name:p.name,pos:p.pos,goals:p.goals||0,assists:p.assists||0,rating:+(p.rating||6.5).toFixed(1),yc:p.yc||0,rc:p.rc?1:0,inj:p.inj?1:0})),
        awayPlayers: allPlayers("away").map(p => ({name:p.name,pos:p.pos,goals:p.goals||0,assists:p.assists||0,rating:+(p.rating||6.5).toFixed(1),yc:p.yc||0,rc:p.rc?1:0,inj:p.inj?1:0})),
        penalties: lmMatch.penalties?.decided ? { homeScore: lmMatch.penalties.home.filter(k=>k.scored).length, awayScore: lmMatch.penalties.away.filter(k=>k.scored).length } : null
      });
    }
  }, [lmPhase]);

  // Import live result into a tournament match
  const importLiveToMatch = (target) => {
    if (!lastLiveResult) return;
    const lr = lastLiveResult;
    const hg = lr.homeScore, ag = lr.awayScore;
    const isFlipped = target.flipped;
    const hPlayers = isFlipped ? lr.awayPlayers : lr.homePlayers;
    const aPlayers = isFlipped ? lr.homePlayers : lr.awayPlayers;
    const penData = lr.penalties ? (isFlipped ? { homeScore: lr.penalties.awayScore, awayScore: lr.penalties.homeScore } : lr.penalties) : null;

    const buildStatsUpdate = (teamObj, players) => {
      if (!teamObj || !players?.length) return {};
      const entries = {};
      players.forEach(p => {
        const k = teamObj.name + "|" + p.name;
        entries[k] = { name:p.name, pos:p.pos, tier:p.tier||0, team:teamObj.name, code:teamObj.code||teamObj.name.slice(0,3).toUpperCase(),
          goals: p.goals||0, assists: p.assists||0, matches: 1, totalRating: p.rating||6,
          yc: p.yc||0, rc: p.rc||0, inj: p.inj||0 };
      });
      return entries;
    };

    let homeTeamObj = null, awayTeamObj = null;

    if (target.type === "group") {
      const ng = JSON.parse(JSON.stringify(tGroups));
      const gm = ng[target.gi].schedule[target.ri][target.mi];
      gm.result = { ftHome: hg, ftAway: ag };
      if (penData) { gm.result.penHome = penData.homeScore; gm.result.penAway = penData.awayScore; }
      homeTeamObj = gm.home;
      awayTeamObj = gm.away;
      ng[target.gi].standings = recalcStandings(ng[target.gi], tConfig.tiebreakers);
      setTGroups(ng);
    } else if (target.type === "ko") {
      const nk = JSON.parse(JSON.stringify(tKO));
      const bk = target.bracket || (target.tp ? "tp" : "wb");
      const m = bk === "lb" ? nk.losers?.[target.ri]?.matches[target.mi] : bk === "gf" ? nk.grandFinal : bk === "reset" ? nk.reset : bk === "tp" ? nk.thirdPlace : nk.rounds[target.ri]?.matches[target.mi];
      if (!m) return;
      homeTeamObj = m.home;
      awayTeamObj = m.away;
      const isTwoLeg = tConfig.koLegs === 2;
      if (!isTwoLeg) {
        const res = { ftHome: hg, ftAway: ag };
        if (penData) { res.pen = { home: penData.homeScore, away: penData.awayScore }; }
        m.result = res;
      } else if (target.leg === 1) {
        m.result = { twoLeg: true, partial: true, leg1: { home: hg, away: ag } };
      } else if (target.leg === 2 && m.result?.leg1) {
        const l1 = m.result.leg1;
        const aggH = l1.home + ag, aggA = l1.away + hg;
        const res = { twoLeg: true, leg1: l1, leg2: { home: hg, away: ag }, agg: { home: aggH, away: aggA } };
        if (aggH === aggA) {
          res.awayGoals = { home: ag, away: l1.away };
          res.awayGoalsRule = !!tConfig.koAwayGoals;
          if (!(tConfig.koAwayGoals && l1.away !== ag) && penData) { res.pen = { home: penData.homeScore, away: penData.awayScore }; }
        }
        m.result = res;
      }
      propagateKO(nk);
      setTKO(nk);
    }

    if (homeTeamObj && awayTeamObj) {
      const homeEntries = buildStatsUpdate(homeTeamObj, hPlayers);
      const awayEntries = buildStatsUpdate(awayTeamObj, aPlayers);
      setTPlayerStats(prev => {
        const next = {};
        for (const pk of Object.keys(prev)) next[pk] = {...prev[pk]};
        const tns = new Set([homeTeamObj.name, awayTeamObj.name]);
        for (const k of Object.keys(next)) { if (tns.has(next[k].team)) { if (next[k].suspended > 0) next[k].suspended--; if (next[k].injOut > 0) next[k].injOut--; } }
        for (const [k, v] of Object.entries({...homeEntries, ...awayEntries})) {
          if (!next[k]) next[k] = { name:v.name, pos:v.pos, tier:v.tier||0, team:v.team, code:v.code, goals:0, assists:0, matches:0, totalRating:0, yellows:0, suspended:0, injOut:0 };
          next[k].goals += v.goals;
          next[k].assists += v.assists;
          next[k].matches += v.matches;
          next[k].totalRating += v.totalRating;
          next[k].yellows += v.yc;
          if (v.rc) { next[k].reds = (next[k].reds||0) + 1; next[k].suspended = (next[k].suspended||0) + rcSuspGames(v.rcVariant, Math.random()); }
          if (v.inj) { const sev = v.injSev ? INJ_SEV.find(s => s.id === v.injSev) : null; const dur = sev ? sev.dur[0] + Math.floor(Math.random() * (sev.dur[1] - sev.dur[0] + 1)) : ((() => { const r = Math.random(); return r < 0.45 ? 1 : r < 0.70 ? 2 : r < 0.85 ? 3 : r < 0.95 ? 4 : 5; })()); next[k].injOut = (next[k].injOut||0) + dur; if (v.injSev) next[k].injSev = v.injSev; if (v.injPart) next[k].injPart = v.injPart; }
        }
        return next;
      });
    }

  };

  const tPlayLive = (target) => {
    let homeTeam, awayTeam, matchObj;
    if (target.type === "group") {
      matchObj = tGroups[target.gi].schedule[target.ri][target.mi];
      homeTeam = matchObj.home; awayTeam = matchObj.away;
    } else {
      const bk = target.bracket || (target.tp ? "tp" : "wb");
      matchObj = bk === "lb" ? tKO.losers?.[target.ri]?.matches[target.mi] : bk === "gf" ? tKO.grandFinal : bk === "reset" ? tKO.reset : bk === "tp" ? tKO.thirdPlace : tKO.rounds[target.ri]?.matches[target.mi];
      homeTeam = matchObj.home; awayTeam = matchObj.away;
    }
    if (!homeTeam || !awayTeam) return;
    const hi = teams.findIndex(t => t.name === homeTeam.name);
    const ai = teams.findIndex(t => t.name === awayTeam.name);
    if (hi === -1 || ai === -1) return;

    const isL2 = target.type === "ko" && target.leg === 2 && tConfig.koLegs === 2;
    const liveHId = isL2 ? teams[ai].id : teams[hi].id;
    const liveAId = isL2 ? teams[hi].id : teams[ai].id;

    const unavail = new Set();
    for (const [k, v] of Object.entries(tPlayerStats)) {
      if ((v.suspended || 0) > 0 || (v.injOut || 0) > 0) unavail.add(k);
    }

    const forceResult = target.type === "ko" && !(tConfig.koLegs === 2 && target.leg === 1);
    let startScore = [0, 0];
    if (isL2 && matchObj.result?.leg1) {
      startScore = [matchObj.result.leg1.away, matchObj.result.leg1.home];
    }

    const venueKey = fixtureKey(target);
    let homeAdv = null, hostModeActive = false;
    if (target.type === "group") {
      homeAdv = tGetHA(venueKey, resolveHomeAdv(homeTeam.name, awayTeam.name, tConfig, true, teams[hi].skill, teams[ai].skill));
      hostModeActive = tConfig.homeAdvGroup === "host";
    } else {
      const haVal = tGetHA(venueKey, resolveKOHomeAdv(matchObj, tConfig));
      if (isL2) { homeAdv = haVal === "home" ? "away" : haVal === "away" ? "home" : null; }
      else { homeAdv = haVal; }
      hostModeActive = tConfig.homeAdvKO === "host";
    }
    setTReplayCounts(c => ({ ...c, [venueKey]: (c[venueKey] || 0) + 1 }));
    // Host-nation tournaments assign a venue from the pasted pool to EVERY match, not just
    // fixtures where the host team itself gets the home-advantage bonus — mirrors how a
    // World Cup plays every game across the host country's stadiums.
    const venue = hostModeActive && tHostVenuePool.length > 0 ? tHostVenuePool[hashStr(venueKey) % tHostVenuePool.length] : null;

    const buildLiveSquad = (teamName, teamId) => {
      const sq = teamById(teamId)?.squad || buildSquad(teamById(teamId)?.formation, null);
      return splitAvailSquad(sq, teamName, unavail);
    };

    const hSquad = buildLiveSquad(teamById(liveHId).name, liveHId);
    const aSquad = buildLiveSquad(teamById(liveAId).name, liveAId);
    const mapP = (p) => ({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.5,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0,chances:0,defActs:0,saves:0});
    const mapB = (p) => ({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0});

    lmRng.current = new RNG(Date.now());
    const init = createMatchState();
    init.forceResult = forceResult;
    init.styles = { home: teamById(liveHId).style || "balanced", away: teamById(liveAId).style || "balanced" };
    init.formations = { home: teamById(liveHId).formation || "4-3-3", away: teamById(liveAId).formation || "4-3-3" };
    init.allowTacChange = {home:true, away:true};
    init.homeAdv = homeAdv;
    init.venue = venue;
    init.strategy = { home: { ...STRAT_DEF, ...(teamById(liveHId).strategy || {}) }, away: { ...STRAT_DEF, ...(teamById(liveAId).strategy || {}) } };
    init.score = [0, 0];
    init.startScore = startScore;
    init.isSecondLeg = isL2;
    init.players = { home: hSquad.starters.map(mapP), away: aSquad.starters.map(mapP) };
    init.bench = { home: hSquad.bench.map(mapB), away: aSquad.bench.map(mapB) };

    setLmH(liveHId); setLmA(liveAId);
    setLmForce(forceResult); setLmStartScore(startScore); setLmHomeAdv(homeAdv);
    setTLiveTarget({...target, flipped: isL2});
    setLmMatch(init); setManualSub({side:null,off:null}); setTab("live");
  };

  // Auto-save tournament state to persistent storage
  // Permanent roster — its own save, independent lifetime from tournament progress.
  const rosterSaveTimeoutRef = useRef(null);
  useEffect(() => {
    if (rosterSaveTimeoutRef.current) clearTimeout(rosterSaveTimeoutRef.current);
    const customTeams = teams.filter(t => t.league === "Custom");
    if (customTeams.length === 0) { try { localStorage.removeItem("avium-roster-db"); } catch(e) {} return; }
    rosterSaveTimeoutRef.current = setTimeout(() => {
      try { localStorage.setItem("avium-roster-db", JSON.stringify({ v: 1, teams: customTeams, ts: Date.now() })); }
      catch (e) { /* storage unavailable */ }
    }, 1500);
  }, [teams]);

  // Tournament/live-match session — resets independently of the roster.
  const sessionSaveTimeoutRef = useRef(null);
  useEffect(() => {
    if (!tPhase && tournamentTeamIds.length === 0) return; // nothing to save
    if (sessionSaveTimeoutRef.current) clearTimeout(sessionSaveTimeoutRef.current);
    sessionSaveTimeoutRef.current = setTimeout(() => {
      try {
        const state = { v: 1, tournamentTeamIds, tConfig, tGroups, tKO, tPlayerStats, tPhase, lmH, lmA, tReplayCounts, ts: Date.now() };
        localStorage.setItem("avium-tournament-session", JSON.stringify(state));
      } catch (e) { /* storage unavailable */ }
    }, 1500);
  }, [tournamentTeamIds, tConfig, tGroups, tKO, tPlayerStats, tPhase, lmH, lmA, tReplayCounts]);

  // Auto-load on mount: roster first (migrating the legacy combined-save key exactly
  // once if no roster-db exists yet), then the tournament session independently.
  useEffect(() => {
    (async () => {
      try {
        // Preset teams always come fresh from PRESET_CATALOG (source of truth = TSV files).
        // Only custom teams are persisted in avium-roster-db.
        const rosterRaw = localStorage.getItem("avium-roster-db");
        let customTeams = [];
        if (rosterRaw) {
          const rs = JSON.parse(rosterRaw);
          if (rs.v && rs.teams?.length > 0) {
            customTeams = rs.teams.filter(t => t.league === "Custom").map(t => ({ ...t, squad: t.squad || buildSquad(t.formation || "4-3-3", null), strategy: { ...STRAT_DEF, ...(t.strategy || {}) } }));
          }
        } else {
          // One-time migration from the legacy combined autosave — extract custom teams only.
          const legacyRaw = localStorage.getItem("avium-engine-autosave");
          if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw);
            if (legacy.v && legacy.teams?.length > 0) {
              const catalogKeys = new Set(PRESET_CATALOG.map(c => c.code || c.name));
              customTeams = legacy.teams
                .filter(t => !catalogKeys.has(t.code || t.name))
                .map(t => ({ ...t, league: "Custom", id: "Custom::" + (t.code || t.name), squad: t.squad || buildSquad(t.formation || "4-3-3", null), strategy: { ...STRAT_DEF, ...(t.strategy || {}) } }));
              // Migrate tournament state from legacy
              const resolveLegacyIdx = (idx) => { if (typeof idx !== "number") return idx; const orig = legacy.teams[idx]; if (!orig) return undefined; const match = PRESET_CATALOG.find(c => (c.code || c.name) === (orig.code || orig.name)); return match ? match.id : "Custom::" + (orig.code || orig.name); };
              const resolvedLmH = resolveLegacyIdx(legacy.lmH);
              const resolvedLmA = resolveLegacyIdx(legacy.lmA);
              if (resolvedLmH !== undefined) setLmH(resolvedLmH);
              if (resolvedLmA !== undefined) setLmA(resolvedLmA);
              if (legacy.tConfig) setTConfig(c => ({ ...c, ...legacy.tConfig, qualZones: legacy.tConfig.qualZones || c.qualZones, tiebreakers: legacy.tConfig.tiebreakers || c.tiebreakers }));
              if (legacy.tGroups) setTGroups(legacy.tGroups);
              if (legacy.tKO) setTKO(legacy.tKO);
              if (legacy.tPlayerStats) setTPlayerStats(legacy.tPlayerStats);
              if (legacy.tPhase) setTPhase(legacy.tPhase);
              setTournamentTeamIds(legacy.teams.map(t => { const match = PRESET_CATALOG.find(c => (c.code || c.name) === (t.code || t.name)); return match ? match.id : "Custom::" + (t.code || t.name); }));
            }
          }
        }
        setTeams([...PRESET_CATALOG, ...customTeams]);
        // Load tournament session independently — it exists whether or not
        // avium-roster-db does (roster-db only gets written when custom teams exist).
        const sessionRaw = localStorage.getItem("avium-tournament-session");
        if (sessionRaw) {
          const ss = JSON.parse(sessionRaw);
          if (ss.tournamentTeamIds) setTournamentTeamIds(ss.tournamentTeamIds);
          if (ss.tConfig) setTConfig(c => ({ ...c, ...ss.tConfig, qualZones: ss.tConfig.qualZones || c.qualZones, tiebreakers: ss.tConfig.tiebreakers || c.tiebreakers }));
          if (ss.tGroups) setTGroups(ss.tGroups);
          if (ss.tKO) setTKO(ss.tKO);
          if (ss.tPlayerStats) setTPlayerStats(ss.tPlayerStats);
          if (ss.tPhase) setTPhase(ss.tPhase);
          if (ss.lmH !== undefined) setLmH(ss.lmH);
          if (ss.lmA !== undefined) setLmA(ss.lmA);
          if (ss.tReplayCounts) setTReplayCounts(ss.tReplayCounts);
        }
      } catch (e) { /* no saved data or storage unavailable */ }
    })();
  }, []);



  const [showExport, setShowExport] = useState(false);
  const exportTeamsText = () => {
    const stratKeys = ["approachPlay","passingDir","chanceCreation","dribbling","creativity","setPieces","timeWasting","possLost","possWon","gkDist","pressingLOE","defLine","dlBehavior","tackling"];
    const valToLabel = {};
    Object.entries(STRAT_LABELS).forEach(([key, {vals}]) => { const m = {}; vals.forEach(([v, l]) => { m[v] = l; }); valToLabel[key] = m; });
    return teams.map(t => {
      const code = t.code || t.name.slice(0,3).toUpperCase();
      const style = STYLE_LBL[t.style] || "Balanced";
      const form = t.formation || "4-3-3";
      const strat = {...STRAT_DEF, ...(t.strategy || {})};
      const tactics = stratKeys.map(k => valToLabel[k]?.[strat[k]] || "No Instruction");
      const players = (t.squad || []).map(p => p.name + tierSuffix(p.tier)).join("\t");
      const colors = t.primaryColor ? (t.secondaryColor ? [t.primaryColor, t.secondaryColor] : [t.primaryColor]) : [];
      return [code, t.name, t.skill, style, form, ...tactics, players, ...colors].join("\t");
    }).join("\n");
  };

  const exportState = () => { setShowExport(!showExport); };


  // ─── LIVE MATCH ───
  const lmKickOff = () => { if (!teamById(lmH) || !teamById(lmA)) return; lmRng.current = new RNG(Date.now()); const init = createMatchState(); init.forceResult = lmForce; init.styles = { home: teamById(lmH).style || "balanced", away: teamById(lmA).style || "balanced" }; init.formations = { home: teamById(lmH).formation || "4-3-3", away: teamById(lmA).formation || "4-3-3" }; init.allowTacChange = {home:lmAllowTac, away:lmAllowTac}; init.homeAdv = lmHomeAdv || null; init.venue = lmHomeAdv === null && (lmNeutralVenueName.trim() || lmNeutralVenueLoc.trim()) ? { stadium: lmNeutralVenueName.trim(), city: lmNeutralVenueLoc.trim() } : null; init.strategy = { home: { ...STRAT_DEF, ...(teamById(lmH).strategy || {}) }, away: { ...STRAT_DEF, ...(teamById(lmA).strategy || {}) } }; init.score = [0, 0]; init.startScore = [lmStartScore[0] || 0, lmStartScore[1] || 0]; init.isSecondLeg = lm2ndLeg; init.injuriesEnabled = tConfig.injuries !== false;
    const hSq = teamById(lmH)?.squad || buildSquad(teamById(lmH)?.formation, null);
    const aSq = teamById(lmA)?.squad || buildSquad(teamById(lmA)?.formation, null);
    const unavail = new Set();
    for (const [k, v] of Object.entries(tPlayerStats)) { if ((v.suspended || 0) > 0 || (v.injOut || 0) > 0) unavail.add(k); }
    const hLive = splitAvailSquad(hSq, teamById(lmH).name, unavail);
    const aLive = splitAvailSquad(aSq, teamById(lmA).name, unavail);
    const hBenchNames = new Set(hSq.filter(p => p.bench).map(p => p.name));
    const aBenchNames = new Set(aSq.filter(p => p.bench).map(p => p.name));
    const hDebuff = calcPromoDebuff(hLive.starters, hBenchNames);
    const aDebuff = calcPromoDebuff(aLive.starters, aBenchNames);
    if (hDebuff || aDebuff) init.promoDebuff = { home: hDebuff, away: aDebuff };
    init.players = {home: hLive.starters.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.5,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0,chances:0,defActs:0,saves:0})), away: aLive.starters.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.5,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0,chances:0,defActs:0,saves:0}))};
    init.bench = {home: hLive.bench.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0})), away: aLive.bench.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0}))};
    setLmMatch(init); setManualSub({side:null,off:null}); setExpandedTeam(null); setViewSquad(null); };
  const lmTick = useCallback(() => { if (!lmMatch || !lmRng.current) return; setLmMatch(prev => lmAdvance(prev, lmRng.current, { name: teamById(lmH).name, skill: teamById(lmH).skill }, { name: teamById(lmA).name, skill: teamById(lmA).skill })); }, [lmMatch, teams, lmH, lmA]);
  const lmSimAll = () => { setLoading(true); setTimeout(() => { const rng = lmRng.current || new RNG(Date.now()); lmRng.current = rng; const h = { name: teamById(lmH).name, skill: teamById(lmH).skill }, a = { name: teamById(lmA).name, skill: teamById(lmA).skill }; const init = createMatchState(); init.forceResult = lmForce; init.styles = { home: teamById(lmH).style || "balanced", away: teamById(lmA).style || "balanced" }; init.formations = { home: teamById(lmH).formation || "4-3-3", away: teamById(lmA).formation || "4-3-3" }; init.allowTacChange = {home:lmAllowTac, away:lmAllowTac}; init.homeAdv = lmHomeAdv || null; init.venue = lmHomeAdv === null && (lmNeutralVenueName.trim() || lmNeutralVenueLoc.trim()) ? { stadium: lmNeutralVenueName.trim(), city: lmNeutralVenueLoc.trim() } : null; init.strategy = { home: { ...STRAT_DEF, ...(teamById(lmH).strategy || {}) }, away: { ...STRAT_DEF, ...(teamById(lmA).strategy || {}) } }; init.score = [0, 0]; init.startScore = [lmStartScore[0] || 0, lmStartScore[1] || 0]; init.isSecondLeg = lm2ndLeg; init.injuriesEnabled = tConfig.injuries !== false;
    const hSq2 = teamById(lmH)?.squad || buildSquad(teamById(lmH)?.formation, null);
    const aSq2 = teamById(lmA)?.squad || buildSquad(teamById(lmA)?.formation, null);
    const unavail2 = new Set();
    for (const [k, v] of Object.entries(tPlayerStats)) { if ((v.suspended || 0) > 0 || (v.injOut || 0) > 0) unavail2.add(k); }
    const hLive2 = splitAvailSquad(hSq2, teamById(lmH).name, unavail2);
    const aLive2 = splitAvailSquad(aSq2, teamById(lmA).name, unavail2);
    const hBenchNames2 = new Set(hSq2.filter(p => p.bench).map(p => p.name));
    const aBenchNames2 = new Set(aSq2.filter(p => p.bench).map(p => p.name));
    const hDebuff2 = calcPromoDebuff(hLive2.starters, hBenchNames2);
    const aDebuff2 = calcPromoDebuff(aLive2.starters, aBenchNames2);
    if (hDebuff2 || aDebuff2) init.promoDebuff = { home: hDebuff2, away: aDebuff2 };
    init.players = {home: hLive2.starters.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.5,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0,chances:0,defActs:0,saves:0})), away: aLive2.starters.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.5,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0,chances:0,defActs:0,saves:0}))};
    init.bench = {home: hLive2.bench.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0})), away: aLive2.bench.map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0}))};
    let s = lmMatch && lmMatch.phase !== "pre_match" ? cloneState(lmMatch) : lmAdvance(init, rng, h, a); for (let i = 0; i < 300 && s.phase !== "finished"; i++) lmAdvance(s, rng, h, a, true); setAutoPlay(false); setLmMatch(s); setLoading(false); }, 40); };
  const executeManualSub = (side, offName, onName) => {
    setLmMatch(prev => {
      const s = cloneState(prev);
      const dm = s.minute;
      const sn = side === "home" ? teamById(lmH)?.name : teamById(lmA)?.name;
      const offP = s.players[side].find(p => p.name === offName);
      const onIdx = s.bench[side].findIndex(p => p.name === onName);
      if (!offP || onIdx === -1 || s.subs[side] >= 3) return prev;
      const onP = s.bench[side].splice(onIdx, 1)[0];
      onP.sub = 'on'; onP.rating = 6.5;
      offP.sub = 'off';
      s.subbedOff[side].push({...offP});
      s.players[side] = s.players[side].filter(p => p.name !== offName);
      s.players[side].push(onP);
      s.subs[side]++;
      s.stamina[side] = Math.min(100, s.stamina[side] + 4);
      { const reason=fill(CM.sub_in[Math.floor(Math.random()*CM.sub_in.length)],{t:sn,n:onName,x:offName}); s.events.push({min:dm,type:"sub",team:side,text:"\uD83D\uDD04 "+sn+"'s "+offName+" \u2192 "+onName+". "+reason,offName,onName,reason,offPos:offP.pos,offRating:offP.rating,onPos:onP.pos}); }
      return s;
    });
    setManualSub({side:null,off:null});
  };
  const lmReset = () => { setAutoPlay(false); setLmMatch(null); };
  const lmBl = lmMatch ? lmBtnLabel(lmMatch) : null;
  const lmIsSetup = !lmMatch;

  // ─── TOURNAMENT ───
  const tPerGroup = tournamentTeams.length > 0 && tConfig.numGroups > 0 ? Math.floor(tournamentTeams.length / tConfig.numGroups) : 0;
  const tPerGroupMax = tournamentTeams.length > 0 && tConfig.numGroups > 0 ? Math.ceil(tournamentTeams.length / tConfig.numGroups) : 0;
  const tDivisible = tournamentTeams.length > 0 && tConfig.numGroups > 0 && tournamentTeams.length % tConfig.numGroups === 0;
  const tUneven = !tDivisible && tPerGroup >= 2;
  const tHasGroups = tConfig.mode === "double" || (tConfig.mode === "single" && tConfig.singleType === "groups");
  const tHasKO = tConfig.mode === "double" || (tConfig.mode === "single" && tConfig.singleType === "knockout");
  const qz = tConfig.qualZones || [];
  const tUseZones = tHasKO && zonesHaveAdvance(qz);
  const tKoTeams = tConfig.mode === "single" && tConfig.singleType === "knockout" ? tournamentTeams.length : tUseZones ? countKOTeamsFromZones(tConfig.qualZones, tConfig.numGroups) : tConfig.numGroups * tConfig.advPerGroup;
  const tAdvOk = tConfig.mode === "single" || tKoTeams >= 2;
  const tKoValid = tKoTeams >= 2;
  const tGroupsOk = tConfig.numGroups >= 1 && tConfig.numGroups <= 26;
  const tPotsOk = tConfig.allocMode !== "draw" || (tConfig.numPots >= 2 && tConfig.numPots <= tConfig.numGroups);
  const tSwissOk = tConfig.matchFormat !== "swiss" || (tConfig.swissRounds >= 1 && tConfig.swissRounds <= Math.max(1, tPerGroup - 1));
  const tNumByes = (()=>{ let n2=1; const nt = tHasKO ? (tConfig.mode === "double" ? tKoTeams : tournamentTeams.length) : 0; while(n2<nt)n2*=2; return n2-nt; })();
  const tParticipantErrors = tournamentTeams.some(t => t.skill === "" || t.skill < 25 || t.skill > 100);
  const tValid = !tParticipantErrors && tournamentTeamIds.length >= 2 && (tConfig.mode === "single" && tConfig.singleType === "knockout" ? tournamentTeams.length >= 2 : (tPerGroup >= 2 && tGroupsOk && tPotsOk && tSwissOk && tAdvOk && (!tHasKO || tKoValid)));
  const tTotalMatches = tGroups.reduce((s, g) => s + g.schedule.reduce((s2, r) => s2 + r.length, 0), 0);
  const tPlayedMatches = tGroups.reduce((s, g) => s + g.schedule.reduce((s2, r) => s2 + r.filter(m => m.result).length, 0), 0);

  const createTournament = (mode) => {
    if (!tValid) return;
    setLoading(true); setTimeout(() => {
    // Snapshot the selected participants' current squads/config at generation time —
    // roster edits afterward must not retroactively affect this tournament.
    const genTeams = tournamentTeams.map(t => ({...t, squad: t.squad ? t.squad.map(p => ({...p})) : null, strategy: {...t.strategy}}));
    // Single knockout — skip groups entirely
    if (tConfig.mode === "single" && tConfig.singleType === "knockout") {
      const isDE = tConfig.koFormat === "double_elim";
      const hasTP = !isDE && tConfig.thirdPlace && genTeams.length >= 4;
      let n2=1; while(n2<genTeams.length)n2*=2; const nb=n2-genTeams.length;
      if (nb > 0 && tConfig.koByeMode === "manual") {
        const sorted = [...genTeams].sort((a,b) => b.skill - a.skill);
        setTByeManual({ pool: sorted, numByes: nb, selected: [], hasTP, onConfirm: "single" });
        setTPhase("ko_byes"); setLoading(false); return;
      }
      const km = tConfig.koAllocMode;
      const applyDE = (ko) => { if (isDE) convertToDoubleElim(ko, tConfig.koGFReset); };
      if (km === "seed") { const ko=buildKnockoutSeeded(genTeams, hasTP); applyDE(ko); propagateKO(ko); setTKO(ko); setTPhase("knockout"); }
      else if (km === "random") { const ko=buildKnockoutRandom(genTeams, hasTP, new RNG(Date.now())); applyDE(ko); propagateKO(ko); setTKO(ko); setTPhase("knockout"); }
      else if (km === "draw") { const rng = new RNG(Date.now()); const { ko, log } = buildKnockoutDraw(genTeams, hasTP, rng); applyDE(ko); propagateKO(ko); setTKO(ko); setTKODrawLog(log); setTPhase("knockout"); }
      else if (km === "manual") { let n2=1; while(n2<genTeams.length)n2*=2; setTKOManual({ pool: [...genTeams], matches: Array.from({ length: n2/2 }, () => ({ home: null, away: null })), numByes: n2-genTeams.length }); setTPhase("ko_manual"); }
      setTGroups([]); setTDrawLog([]); setLoading(false); return;
    }
    const ng = tConfig.numGroups;
    const fmt = tConfig.matchFormat;
    const m = ng === 1 ? "seed" : (mode || tConfig.allocMode);
    if (m === "seed") { setTGroups(allocSeed(genTeams, ng, fmt, tConfig.rrLegs)); setTPhase("groups"); setTDrawLog([]); }
    else if (m === "random") { setTGroups(allocRandom(genTeams, ng, fmt, tConfig.rrLegs)); setTPhase("groups"); setTDrawLog([]); }
    else if (m === "draw") { const rng = new RNG(Date.now()); const { grps, log } = allocDraw(genTeams, ng, tConfig.numPots, rng, fmt, tConfig.rrLegs); setTDrawAnim({ log, grps, index: 0, pending: false, auto: false }); setTDrawLog(log); setTPhase("drawing"); }
    else if (m === "manual") { const grps = Array.from({ length: ng }, (_, i) => ({ label: GL[i], teams: [], schedule: [], standings: [] })); setTManual({ pool: [...genTeams], grps }); setTPhase("manual"); }
    setLoading(false);
    }, 40);
  };
  const tManualAssign = (teamIdx, groupIdx) => {
    if (!tManual) return;
    const nm = JSON.parse(JSON.stringify(tManual));
    const t = nm.pool.splice(teamIdx, 1)[0];
    nm.grps[groupIdx].teams.push(t);
    setTManual(nm);
  };
  const tManualConfirm = () => {
    if (!tManual || tManual.pool.length > 0) return;
    const grps = tManual.grps.map(g => { const ng = { ...g }; initGroup(ng, tConfig.matchFormat, tConfig.rrLegs); return ng; });
    setTGroups(grps); setTPhase("groups"); setTManual(null);
  };
  const tSwapStandings = (gi, ri) => {
    const ng = JSON.parse(JSON.stringify(tGroups));
    const st = ng[gi].standings;
    if (ri >= 0 && ri < st.length - 1) {
      [st[ri], st[ri + 1]] = [st[ri + 1], st[ri]];
    }
    setTGroups(ng);
  };
  const tHasUnresolved = tGroups.length > 0 && tPhase === "groups" && hasUnresolvedTies(tGroups, tConfig.qualZones, tConfig.tiebreakers);
  const resetTournament = () => { setTPhase("setup"); setTGroups([]); setTKO(null); setTPlayerStats({}); setTManual(null); setTKOManual(null); setTDrawLog([]); setTKODrawLog([]); setTEdit(null); setTScoreError(""); setTHomeAdvOverrides({}); setTPoolData(null); setTDrawAnim(null); if (tDrawTimerRef.current) { clearInterval(tDrawTimerRef.current); tDrawTimerRef.current = null; } };

  useEffect(() => {
    if (tDrawAnim?.auto && !(tDrawAnim.index >= tDrawAnim.log.length && !tDrawAnim.pending)) {
      tDrawTimerRef.current = setInterval(() => {
        setTDrawAnim(prev => {
          if (!prev) return prev;
          if (prev.pending) {
            const next = { ...prev, pending: false, index: prev.index + 1 };
            if (next.index >= next.log.length) { clearInterval(tDrawTimerRef.current); tDrawTimerRef.current = null; next.auto = false; }
            return next;
          } else if (prev.index < prev.log.length) {
            return { ...prev, pending: true };
          } else { clearInterval(tDrawTimerRef.current); tDrawTimerRef.current = null; return { ...prev, auto: false }; }
        });
      }, 1200);
      return () => { clearInterval(tDrawTimerRef.current); tDrawTimerRef.current = null; };
    }
  }, [tDrawAnim?.auto, tDrawAnim?.pending, tDrawAnim?.index]);
  const tDrawAdvance = () => {
    setTDrawAnim(prev => {
      if (!prev) return prev;
      if (prev.pending) return { ...prev, pending: false, index: prev.index + 1 };
      if (prev.index < prev.log.length) return { ...prev, pending: true };
      return prev;
    });
  };
  const tDrawSkip = () => { setTDrawAnim(prev => prev ? { ...prev, index: prev.log.length, pending: false, auto: false } : prev); if (tDrawTimerRef.current) { clearInterval(tDrawTimerRef.current); tDrawTimerRef.current = null; } };
  const tDrawConfirm = () => { if (!tDrawAnim) return; setTGroups(tDrawAnim.grps); setTPhase("groups"); setTDrawAnim(null); };

  const tGenNextSwissRound = () => {
    const ng = JSON.parse(JSON.stringify(tGroups));
    ng.forEach(g => {
      g.standings = recalcStandings(g, tConfig.tiebreakers);
      const nextRd = genSwissRound(g, g.schedule.length);
      if (nextRd.length > 0) g.schedule.push(nextRd);
    });
    setTGroups(ng);
  };

  const tSwissRoundsPlayed = tGroups.length > 0 ? tGroups[0]?.schedule.length || 0 : 0;
  const tSwissCurrentDone = tGroups.length > 0 && tGroups.every(g => {
    const lastRd = g.schedule[g.schedule.length - 1];
    return lastRd && lastRd.every(m => m.result);
  });
  const tSwissAllDone = tConfig.matchFormat === "swiss" && tSwissRoundsPlayed >= tConfig.swissRounds && tSwissCurrentDone;


  const accumulateMatchStats = (teamObj, goalsFor, goalsAgainst, isWin, isDraw, simCards, unavailSet, simPlayers) => {
    if (!teamObj?.squad) return null;
    if (simPlayers) {
      const keyOf = (pName) => playerKey(teamObj.name, pName);
      const rng2 = new RNG(Date.now() + Math.random() * 99999);
      const redP = simPlayers.find(p => p.rc);
      const injP = simPlayers.find(p => p.inj);
      const injDur = injP ? ((() => { const sev = INJ_SEV.find(s => s.id === injP.injSev); if (sev) return sev.dur[0] + Math.floor(rng2.u() * (sev.dur[1] - sev.dur[0] + 1)); const r = rng2.u(); return r < 0.45 ? 1 : r < 0.70 ? 2 : r < 0.85 ? 3 : r < 0.95 ? 4 : 5; })()) : 0;
      const diffs = {};
      simPlayers.forEach(p => {
        const k = keyOf(p.name);
        const d = diffs[k] || (diffs[k] = {matches:0,subApp:0,goals:0,assists:0,totalRating:0,yellows:0,reds:0,suspended:0,injOut:0,chances:0,defActs:0,saves:0});
        if (p.sub === 'on') d.subApp++; else d.matches++;
        d.goals += p.goals || 0;
        d.assists += p.assists || 0;
        d.totalRating += p.rating || 6.5;
        d.yellows += p.yc || 0;
        d.chances += p.chances || 0;
        d.defActs += p.defActs || 0;
        d.saves += p.saves || 0;
        if (p.rc) { d.reds++; d.suspended += rcSuspGames(p.rcVariant, rng2.u()); }
        if (p.inj) d.injOut += injDur;
      });
      setTPlayerStats(prev => {
        const next = {};
        for (const pk of Object.keys(prev)) next[pk] = {...prev[pk]};
        const initP = (p) => ({name:p.name,team:teamObj.name,code:teamObj.code||"",pos:p.pos,tier:p.tier||0,goals:0,assists:0,matches:0,subApp:0,totalRating:0,chances:0,defActs:0,saves:0});
        simPlayers.forEach(p => { const k = keyOf(p.name); if (!next[k]) next[k] = initP(p); });
        for (const [k, d] of Object.entries(diffs)) {
          next[k].matches = (next[k].matches||0) + d.matches;
          next[k].subApp = (next[k].subApp||0) + d.subApp;
          next[k].goals = (next[k].goals||0) + d.goals;
          next[k].assists = (next[k].assists||0) + d.assists;
          next[k].totalRating = (next[k].totalRating||0) + d.totalRating;
          next[k].yellows = (next[k].yellows||0) + d.yellows;
          next[k].reds = (next[k].reds||0) + d.reds;
          next[k].suspended = (next[k].suspended||0) + d.suspended;
          next[k].injOut = (next[k].injOut||0) + d.injOut;
          next[k].chances = (next[k].chances||0) + d.chances;
          next[k].defActs = (next[k].defActs||0) + d.defActs;
          next[k].saves = (next[k].saves||0) + d.saves;
        }
        if (injP) { const ik = keyOf(injP.name); next[ik].injSev = injP.injSev; next[ik].injPart = injP.injPart; }
        return next;
      });
      return { redKey: redP ? keyOf(redP.name) : null, injKey: injP ? keyOf(injP.name) : null, injDur, diffs };
    }
    const rng2 = new RNG(Date.now() + Math.random() * 99999);
    const starters = teamObj.squad.filter(p => !p.bench);
    const bench = teamObj.squad.filter(p => p.bench);
    const keyOf = (pName) => playerKey(teamObj.name, pName);
    const available = unavailSet ? starters.filter(p => !unavailSet.has(keyOf(p.name))) : starters;
    const replacements = bench.slice(0, starters.length - available.length);
    const sq = [...available, ...replacements];
    const key = keyOf;
    const subCandidates = bench.filter(p => p.pos !== "GK" && !sq.some(s => s.name === p.name) && (!unavailSet || !unavailSet.has(keyOf(p.name))));
    const nSubs = Math.min(subCandidates.length, rng2.u() < 0.15 ? 1 : rng2.u() < 0.55 ? 2 : 3);
    const matchSubs = []; const subUsed = new Set();
    for (let si = 0; si < nSubs; si++) { const rem = subCandidates.filter(p => !subUsed.has(p.name)); if (!rem.length) break; const pk = rem[Math.floor(rng2.u() * rem.length)]; matchSubs.push(pk); subUsed.add(pk.name); }
    const allOnPitch = [...sq, ...matchSubs];
    const nYellows = simCards ? (simCards.yellows||0) : ((() => { const r = rng2.u(); return r<0.08?0:r<0.307?1:r<0.5665?2:r<0.7655?3:r<0.891?4:r<0.96?5:r<0.9855?6:r<0.9965?7:8; })());
    const cardedYellows = [];
    for (let cy = 0; cy < nYellows; cy++) {
      const cp = pickPlayer(rng2, allOnPitch.map(p=>({name:p.name,pos:p.pos})), "foul");
      cardedYellows.push(cp.name);
    }
    const redPlayer = (simCards ? (simCards.reds||0) > 0 : rng2.u() < 0.06) ? pickPlayer(rng2, allOnPitch.map(p=>({name:p.name,pos:p.pos})), "foul") : null;
    const redName = redPlayer?.name || null;
    const rcVar = redName ? pickRedCardVariant(rng2, redPlayer.pos) : null;
    const rcSusp = redName ? rcSuspGames(rcVar, rng2.u()) : 0;
    const injName = (tConfig.injuries !== false) && (simCards ? (simCards.injuries||0) > 0 : rng2.u() < 0.053) ? allOnPitch[Math.floor(rng2.u() * allOnPitch.length)]?.name : null;
    const injPicked = injName ? pickInjury(rng2) : null;
    const injSevObj = injPicked?.sev || null;
    const injDur = injSevObj ? injSevObj.dur[0] + Math.floor(rng2.u() * (injSevObj.dur[1] - injSevObj.dur[0] + 1)) : 0;
    const injPartName = injPicked?.part || null;
    const scorers = [];
    const starterGoalPool = sq.filter(p => p.pos !== "GK").map(p => ({name:p.name,pos:p.pos,atkW:p.atkW||0,tier:p.tier||0}));
    const subGoalPool = matchSubs.filter(p => p.pos !== "GK").map(p => ({name:p.name,pos:p.pos,atkW:p.atkW||0,tier:p.tier||0}));
    for (let g = 0; g < goalsFor; g++) {
      if (subGoalPool.length > 0 && rng2.u() < 0.2) { scorers.push(pickPlayer(rng2, subGoalPool, "goal").name); }
      else { scorers.push(pickPlayer(rng2, starterGoalPool.length > 0 ? starterGoalPool : [{name:"?",pos:"MID",atkW:0,tier:0}], "goal").name); }
    }
    const assisters = [];
    const allOutfield = allOnPitch.filter(p => p.pos !== "GK").map(p => ({name:p.name,pos:p.pos,atkW:p.atkW||0,tier:p.tier||0}));
    for (let g = 0; g < goalsFor; g++) {
      const others = allOutfield.filter(p => p.name !== scorers[g]);
      if (others.length > 0) { assisters.push(pickPlayer(rng2, others, "any").name); }
    }
    const playerRtgs = {};
    sq.forEach(p => {
      let rtg = isDraw ? 6.5 : isWin ? 7.0 : 6.0;
      rtg += (rng2.u() - 0.4) * 1.0;
      const gCount = scorers.filter(n => n === p.name).length;
      const aCount = assisters.filter(n => n === p.name).length;
      rtg += gCount * goalAtkMult(p.atkW) + aCount * 0.4 * assistAtkMult(p.atkW);
      if (goalsAgainst > 0 && p.pos === "GK") rtg -= goalsAgainst * 0.035;
      if (goalsAgainst > 0 && p.pos === "DEF") rtg -= goalsAgainst * 0.02;
      playerRtgs[p.name] = { rtg: Math.max(3, Math.min(10, rtg)), gCount, aCount };
    });
    matchSubs.forEach(p => {
      let rtg = isDraw ? 6.3 : isWin ? 6.8 : 5.8;
      rtg += (rng2.u() - 0.4) * 0.8;
      const gCount = scorers.filter(n => n === p.name).length;
      const aCount = assisters.filter(n => n === p.name).length;
      rtg += gCount * 1.2 * goalAtkMult(p.atkW) + aCount * 0.5 * assistAtkMult(p.atkW);
      if (goalsAgainst > 0 && p.pos === "GK") rtg -= goalsAgainst * 0.035;
      if (goalsAgainst > 0 && p.pos === "DEF") rtg -= goalsAgainst * 0.02;
      playerRtgs[p.name] = { rtg: Math.max(3, Math.min(10, rtg)), gCount, aCount };
    });
    const csBonus = goalsAgainst === 0;
    allOnPitch.forEach(p => {
      if (!playerRtgs[p.name]) return;
      const pr = playerRtgs[p.name];
      if (p.pos === "GK") { if (csBonus) pr.rtg += 1.25; else pr.rtg += Math.min(0.48, rng2.u() * 0.22 + goalsAgainst * 0.06); }
      else if (p.pos === "DEF") { if (csBonus) pr.rtg += 0.68; else if (goalsAgainst === 1) pr.rtg += 0.36; else if (goalsAgainst === 2) pr.rtg += 0.22; }
      else if (p.pos === "MID") { pr.rtg += (rng2.u() - 0.3) * 0.3; if (goalsFor >= 2) pr.rtg += 0.08; }
      pr.rtg = Math.max(3, Math.min(10, pr.rtg));
    });
    const diffs = {};
    const diffOf = (k) => diffs[k] || (diffs[k] = {matches:0,subApp:0,goals:0,assists:0,totalRating:0,yellows:0,reds:0,suspended:0,injOut:0});
    sq.forEach(p => {
      const k = key(p.name);
      const d = diffOf(k);
      d.matches++;
      const pr = playerRtgs[p.name];
      d.goals += pr.gCount;
      d.assists += pr.aCount;
      d.totalRating += pr.rtg;
      d.yellows += cardedYellows.filter(n => n === p.name).length;
      if (redName === p.name) { d.reds++; d.suspended += rcSusp; }
      if (p.name === injName) d.injOut += injDur;
    });
    matchSubs.forEach(p => {
      const k = key(p.name);
      const d = diffOf(k);
      d.subApp++;
      const pr = playerRtgs[p.name];
      d.goals += pr.gCount;
      d.assists += pr.aCount;
      d.totalRating += pr.rtg;
      d.yellows += cardedYellows.filter(n => n === p.name).length;
      if (redName === p.name) { d.reds++; d.suspended += rcSusp; }
      if (p.name === injName) d.injOut += injDur;
    });
    setTPlayerStats(prev => {
      const next = {};
      for (const pk of Object.keys(prev)) next[pk] = {...prev[pk]};
      const initP = (p) => ({name:p.name,team:teamObj.name,code:teamObj.code||"",pos:p.pos,tier:p.tier||0,goals:0,assists:0,matches:0,subApp:0,totalRating:0});
      [...sq, ...matchSubs].forEach(p => { const k = key(p.name); if (!next[k]) next[k] = initP(p); });
      for (const [k, d] of Object.entries(diffs)) {
        next[k].matches = (next[k].matches||0) + d.matches;
        next[k].subApp = (next[k].subApp||0) + d.subApp;
        next[k].goals = (next[k].goals||0) + d.goals;
        next[k].assists = (next[k].assists||0) + d.assists;
        next[k].totalRating = (next[k].totalRating||0) + d.totalRating;
        next[k].yellows = (next[k].yellows||0) + d.yellows;
        next[k].reds = (next[k].reds||0) + d.reds;
        next[k].suspended = (next[k].suspended||0) + d.suspended;
        next[k].injOut = (next[k].injOut||0) + d.injOut;
      }
      if (injName) { const ik = key(injName); next[ik].injSev = injSevObj?.id; next[ik].injPart = injPartName; }
      return next;
    });
    return { redKey: redName ? keyOf(redName) : null, injKey: injName ? keyOf(injName) : null, injDur, diffs };
  };
  const decrementBans = (teamNames) => {
    setTPlayerStats(prev => {
      const next = {};
      for (const k of Object.keys(prev)) next[k] = {...prev[k]};
      for (const k of Object.keys(next)) { if (teamNames.has(next[k].team)) { if (next[k].suspended > 0) next[k].suspended--; if (next[k].injOut > 0) next[k].injOut--; } }
      return next;
    });
  };
  const reverseMatchStats = (diffsSets) => {
    const merged = {};
    diffsSets.filter(Boolean).forEach(diffs => {
      for (const [k, d] of Object.entries(diffs)) {
        const m = merged[k] || (merged[k] = {matches:0,subApp:0,goals:0,assists:0,totalRating:0,yellows:0,reds:0,suspended:0,injOut:0,chances:0,defActs:0,saves:0});
        for (const f of Object.keys(m)) m[f] += d[f] || 0;
      }
    });
    if (Object.keys(merged).length === 0) return;
    setTPlayerStats(prev => {
      const next = {};
      for (const pk of Object.keys(prev)) next[pk] = {...prev[pk]};
      for (const [k, d] of Object.entries(merged)) {
        if (!next[k]) continue;
        next[k].matches = Math.max(0, (next[k].matches||0) - d.matches);
        next[k].subApp = Math.max(0, (next[k].subApp||0) - d.subApp);
        next[k].goals = Math.max(0, (next[k].goals||0) - d.goals);
        next[k].assists = Math.max(0, (next[k].assists||0) - d.assists);
        next[k].totalRating = (next[k].totalRating||0) - d.totalRating;
        next[k].yellows = Math.max(0, (next[k].yellows||0) - d.yellows);
        next[k].reds = Math.max(0, (next[k].reds||0) - d.reds);
        next[k].suspended = Math.max(0, (next[k].suspended||0) - d.suspended);
        next[k].injOut = Math.max(0, (next[k].injOut||0) - d.injOut);
        next[k].chances = Math.max(0, (next[k].chances||0) - d.chances);
        next[k].defActs = Math.max(0, (next[k].defActs||0) - d.defActs);
        next[k].saves = Math.max(0, (next[k].saves||0) - d.saves);
      }
      return next;
    });
  };
  const tSetManualScore = () => {
    if (!tEdit) return;
    const { gi, ri, mi, h, a } = tEdit;
    const hg = parseInt(h, 10), ag = parseInt(a, 10);
    if (isNaN(hg) || isNaN(ag)) { setTScoreError("Enter both scores"); return; }
    if (hg < 0 || ag < 0) { setTScoreError("Scores can't be negative"); return; }
    const ng = JSON.parse(JSON.stringify(tGroups));
    const gm = ng[gi].schedule[ri][mi];
    gm.result = { ftHome: hg, ftAway: ag };
    decrementBans(new Set([gm.home.name, gm.away.name]));
    const mUnavail = new Set(); for (const [k,v] of Object.entries(tPlayerStats)) { if ((v.suspended||0)>0||(v.injOut||0)>0) mUnavail.add(k); }
    const rH = accumulateMatchStats(gm.home, hg, ag, hg>ag, hg===ag, null, mUnavail);
    const rA = accumulateMatchStats(gm.away, ag, hg, ag>hg, hg===ag, null, mUnavail);
    gm.result.statDiffs = { home: rH?.diffs, away: rA?.diffs };
    ng[gi].standings = recalcStandings(ng[gi], tConfig.tiebreakers);
    setTGroups(ng); setTEdit(null); setTScoreError("");
  };
  const tDeleteGroupResult = (gi, ri, mi) => {
    const ng = JSON.parse(JSON.stringify(tGroups));
    const gm = ng[gi]?.schedule[ri]?.[mi];
    if (!gm) return;
    const sd = gm.result?.statDiffs;
    if (sd) reverseMatchStats([sd.home, sd.away]);
    gm.result = null;
    ng[gi].standings = recalcStandings(ng[gi], tConfig.tiebreakers);
    setTGroups(ng);
    setTEdit(null);
    setTScoreError("");
  };
  const tSetKoManualScore = () => {
    if (!tKoEdit) return;
    const { ri, mi, h, a, step, ftH, ftA, etH, etA, twoLeg: isTL, l1h, l1a } = tKoEdit;
    const bracket = tKoEdit.bracket || (tKoEdit.tp ? "tp" : "wb");
    const hg = parseInt(h, 10), ag = parseInt(a, 10);
    const getTarget = (ko) => { if (bracket === "lb") return ko.losers[ri].matches[mi]; if (bracket === "gf") return ko.grandFinal; if (bracket === "reset") return ko.reset; if (bracket === "tp") return ko.thirdPlace; return ko.rounds[ri].matches[mi]; };
    const cascade = (ko) => {
      const isDE = !!ko.losers;
      const clrLB = (from) => { for (let lr = from; lr < ko.losers.length; lr++) ko.losers[lr].matches.forEach(m2 => { m2.result = null; m2.home = null; m2.away = null; delete m2.bye; }); };
      const clrGFR = () => { ko.grandFinal.result = null; ko.grandFinal.home = null; ko.grandFinal.away = null; if (ko.reset) { ko.reset.result = null; ko.reset.home = null; ko.reset.away = null; } };
      if (bracket === "tp") return;
      if (bracket === "lb") { clrLB(ri + 1); clrGFR(); }
      else if (bracket === "gf") { if (ko.reset) { ko.reset.result = null; ko.reset.home = null; ko.reset.away = null; } }
      else if (bracket === "reset") { /* no further cascade */ }
      else { for (let r = ri + 1; r < ko.rounds.length; r++) ko.rounds[r].matches.forEach(m => { m.result = null; m.home = null; m.away = null; }); if (isDE) { clrLB(0); clrGFR(); } else { if (ko.thirdPlace && ri <= ko.rounds.length - 2) { ko.thirdPlace.result = null; ko.thirdPlace.home = null; ko.thirdPlace.away = null; } } }
      ko.champion = null; propagateKO(ko);
    };
    if (isTL && step === "l2" && String(h).trim() === "" && String(a).trim() === "") {
      const submitSkip = (result) => { const ko = JSON.parse(JSON.stringify(tKO)); const target = getTarget(ko); target.result = result; cascade(ko); setTKO(ko); setTKoEdit(null); setTScoreError(""); if (isKOComplete(ko)) setTPhase("complete"); else setTPhase("knockout"); };
      if (l1h === l1a) { setTKoEdit({ ...tKoEdit, twoLeg: false, step: "et", ftH: l1h, ftA: l1a, h: "", a: "" }); setTScoreError(""); }
      else submitSkip({ ftHome: l1h, ftAway: l1a });
      return;
    }
    if (isNaN(hg) || isNaN(ag)) { setTScoreError("Enter both scores"); return; }
    if (hg < 0 || ag < 0) { setTScoreError("Scores can't be negative"); return; }
    const submit = (result) => {
      const ko = JSON.parse(JSON.stringify(tKO));
      const target = getTarget(ko);
      target.result = result; cascade(ko);
      setTKO(ko); setTKoEdit(null); setTScoreError("");
      if (result && !result.partial) { const km = target; const hGoals = result.twoLeg?(result.agg?.home||0):(result.ftHome+(result.et?.home||0)); const aGoals = result.twoLeg?(result.agg?.away||0):(result.ftAway+(result.et?.away||0)); const dn=new Set(); if(km?.home)dn.add(km.home.name); if(km?.away)dn.add(km.away.name); if(dn.size)decrementBans(dn); const koUnavail = new Set(); for (const [k2,v2] of Object.entries(tPlayerStats)) { if ((v2.suspended||0)>0||(v2.injOut||0)>0) koUnavail.add(k2); } const rHm = km?.home ? accumulateMatchStats(km.home,hGoals,aGoals,hGoals>aGoals||(result.pen&&result.pen.home>result.pen.away),hGoals===aGoals&&!result.pen,null,koUnavail) : null; const rAm = km?.away ? accumulateMatchStats(km.away,aGoals,hGoals,aGoals>hGoals||(result.pen&&result.pen.away>result.pen.home),hGoals===aGoals&&!result.pen,null,koUnavail) : null; result.statDiffs = { home: rHm?.diffs, away: rAm?.diffs }; }
      if (isKOComplete(ko)) setTPhase("complete"); else setTPhase("knockout");
    };
    if (isTL) {
      if (step === "l1") { setTKoEdit({ ...tKoEdit, step: "l2", l1h: hg, l1a: ag, h: tKoEdit.l2h || "", a: tKoEdit.l2a || "" }); setTScoreError(""); return; }
      if (step === "l2") {
        const aH = l1h + hg, aA = l1a + ag;
        const awH = hg, awA = l1a;
        const mkResult = (et, pen) => ({ twoLeg:true, leg1:{home:l1h,away:l1a}, leg2:{home:ag,away:hg}, agg:{home:aH+(et?.home||0),away:aA+(et?.away||0)}, awayGoals:{home:awH,away:awA}, awayGoalsRule:tConfig.koAwayGoals, et, pen });
        if (aH !== aA) { submit(mkResult(null, null)); return; }
        if (tConfig.koAwayGoals && awH !== awA) { submit(mkResult(null, null)); return; }
        setTKoEdit({ ...tKoEdit, step: "et", l2h: hg, l2a: ag, ftH: aH, ftA: aA, h: "", a: "" }); setTScoreError(""); return;
      }
      if (step === "et") {
        if (hg < ftH || ag < ftA) { setTScoreError("AET agg can't be less than FT agg"); return; }
        const etG = { home: hg - ftH, away: ag - ftA };
        if (hg === ag) { setTKoEdit({ ...tKoEdit, step: "pen", etH: hg, etA: ag, h: "", a: "" }); setTScoreError(""); return; }
        submit({ twoLeg:true, leg1:{home:l1h,away:l1a}, leg2:{home:tKoEdit.l2a,away:tKoEdit.l2h}, agg:{home:hg,away:ag}, awayGoals:{home:tKoEdit.l2h,away:l1a}, awayGoalsRule:tConfig.koAwayGoals, et:etG, pen:null }); return;
      }
      if (step === "pen") {
        if (hg === ag) { setTScoreError("Penalty scores can't be equal"); return; }
        const etG = { home: etH - ftH, away: etA - ftA };
        submit({ twoLeg:true, leg1:{home:l1h,away:l1a}, leg2:{home:tKoEdit.l2a,away:tKoEdit.l2h}, agg:{home:etH,away:etA}, awayGoals:{home:tKoEdit.l2h,away:l1a}, awayGoalsRule:tConfig.koAwayGoals, et:etG, pen:{home:hg,away:ag} }); return;
      }
    }
    if (!step || step === "ft") {
      if (hg === ag) { setTKoEdit({ ...tKoEdit, step: "et", ftH: hg, ftA: ag, h: "", a: "" }); setTScoreError(""); return; }
      submit({ ftHome: hg, ftAway: ag });
    } else if (step === "et") {
      if (hg < ftH || ag < ftA) { setTScoreError("AET score can't be less than FT"); return; }
      if (hg === ag) { setTKoEdit({ ...tKoEdit, step: "pen", etH: hg, etA: ag, h: "", a: "" }); setTScoreError(""); return; }
      submit({ ftHome: ftH, ftAway: ftA, et: { home: hg - ftH, away: ag - ftA } });
    } else if (step === "pen") {
      if (hg === ag) { setTScoreError("Penalty scores can't be equal"); return; }
      submit({ ftHome: ftH, ftAway: ftA, et: { home: etH - ftH, away: etA - ftA }, pen: { home: hg, away: ag } });
    }
  };

  const tScorinate = (targetGi, targetRi, targetMi) => {
    const bulk = targetGi === -1 || targetRi === -1 || targetMi === -1;
    const run = () => {
    const rng = new RNG(Date.now());
    const ng = JSON.parse(JSON.stringify(tGroups));
    const maxRds = Math.max(...ng.map(g => g.schedule.length));
    const localBans = {};
    for (const [k, v] of Object.entries(tPlayerStats)) {
      if ((v.suspended||0) > 0 || (v.injOut||0) > 0) localBans[k] = { team: v.team, suspended: v.suspended||0, injOut: v.injOut||0 };
    }
    const buildUnavail = () => { const s = new Set(); for (const [k, v] of Object.entries(localBans)) { if ((v.suspended||0) > 0 || (v.injOut||0) > 0) s.add(k); } return s; };
    const applyBan = (info) => { if (info?.redKey) { if (!localBans[info.redKey]) localBans[info.redKey] = {suspended:0,injOut:0}; localBans[info.redKey].suspended += 1; } if (info?.injKey) { if (!localBans[info.injKey]) localBans[info.injKey] = {suspended:0,injOut:0}; localBans[info.injKey].injOut += info.injDur; } };
    for (let ri = 0; ri < maxRds; ri++) {
      if (targetRi !== -1 && targetRi !== ri) continue;
      const teams = new Set();
      ng.forEach((g, gi) => { if (targetGi !== -1 && targetGi !== gi) return; const rd = g.schedule[ri]; if (!rd) return; rd.forEach((m, mi) => { if (m.result) return; if (targetMi !== -1 && targetMi !== mi) return; if (m.home?.name) teams.add(m.home.name); if (m.away?.name) teams.add(m.away.name); }); });
      if (teams.size > 0) {
        decrementBans(teams);
        for (const k of Object.keys(localBans)) { const tn = k.substring(0, k.indexOf("|")); if (teams.has(tn)) { if (localBans[k].suspended > 0) localBans[k].suspended--; if (localBans[k].injOut > 0) localBans[k].injOut--; } }
      }
      const unavailSet = buildUnavail();
      const urgCache = {};
      ng.forEach((g, gi) => { if (targetGi !== -1 && targetGi !== gi) return; const rd = g.schedule[ri]; if (!rd) return; const qc = tConfig.advPerGroup || 1; rd.forEach((m, mi) => { if (m.result || !m.home?.name || !m.away?.name) return; const remH = g.schedule.slice(ri).reduce((a, r) => a + r.filter(x => !x.result && (x.home.name === m.home.name || x.away.name === m.home.name)).length, 0) - 1; const remA = g.schedule.slice(ri).reduce((a, r) => a + r.filter(x => !x.result && (x.home.name === m.away.name || x.away.name === m.away.name)).length, 0) - 1; urgCache[`${gi}_${mi}`] = { home: computeGroupUrg(g.standings, m.home.name, qc, remH), away: computeGroupUrg(g.standings, m.away.name, qc, remA) }; }); });
      ng.forEach((g, gi) => { if (targetGi !== -1 && targetGi !== gi) return; const rd = g.schedule[ri]; if (!rd) return; rd.forEach((m, mi) => {
        if (m.result) return;
        if (targetMi !== -1 && targetMi !== mi) return;
        const hSq = filterSquad(m.home.squad, m.home.name, unavailSet), aSq = filterSquad(m.away.squad, m.away.name, unavailSet);
        m.result = simInstantMatch(rng, m.home.skill, m.away.skill, false, m.home.style, m.away.style, m.home.formation, m.away.formation, tGetHA(`g_${gi}_${ri}_${mi}`, resolveHomeAdv(m.home.name, m.away.name, tConfig, true, m.home.skill, m.away.skill)), m.home.strategy, m.away.strategy, hSq, aSq, urgCache[`${gi}_${mi}`]);
        const rH = accumulateMatchStats(m.home, m.result.ftHome, m.result.ftAway, m.result.ftHome>m.result.ftAway, m.result.ftHome===m.result.ftAway, m.result.cards?.home, unavailSet, m.result.playerData?.home);
        const rA = accumulateMatchStats(m.away, m.result.ftAway, m.result.ftHome, m.result.ftAway>m.result.ftHome, m.result.ftHome===m.result.ftAway, m.result.cards?.away, unavailSet, m.result.playerData?.away);
        applyBan(rH); applyBan(rA);
        m.result.statDiffs = { home: rH?.diffs, away: rA?.diffs };
      }); });
    }
    ng.forEach(g => { g.standings = recalcStandings(g, tConfig.tiebreakers); });
    setTGroups(ng); if (bulk) setLoading(false);
    };
    if (bulk) { setLoading(true); setTimeout(run, 40); } else run();
  };
  const tProceedKO = () => {
    let qualified, poolData = null;
    if (tUseZones) {
      const result = collectKOTeamsFromZones(tGroups, tConfig.qualZones);
      qualified = result.all;
      poolData = result;
    } else {
      qualified = collectKOTeams(tGroups, tConfig.advPerGroup);
    }
    if (poolData) setTPoolData(poolData);
    let n2p=1; while(n2p<qualified.length)n2p*=2; const nbp=n2p-qualified.length;
    if (nbp > 0 && tConfig.koByeMode === "manual") {
      const sorted = [...qualified].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||b.skill-a.skill);
      const hasTP = tConfig.thirdPlace && qualified.length >= 4;
      setTByeManual({ pool: sorted, numByes: nbp, selected: [], hasTP, onConfirm: "double" });
      setTPhase("ko_byes"); return;
    }
    const isDE = tConfig.koFormat === "double_elim";
    const hasTP = !isDE && tConfig.thirdPlace && qualified.length >= 4;
    const km = tConfig.koAllocMode;
    const applyDE = (ko) => { if (isDE) convertToDoubleElim(ko, tConfig.koGFReset); };
    if (km === "seed") {
      const ko = buildKnockoutSeeded(qualified, hasTP);
      applyDE(ko); propagateKO(ko); setTKO(ko); setTPhase("knockout");
    } else {
      if (km === "random") { const ko=buildKnockoutRandom(qualified, hasTP, new RNG(Date.now())); applyDE(ko); propagateKO(ko); setTKO(ko); setTPhase("knockout"); }
      else if (km === "draw") { const rng = new RNG(Date.now()); const { ko, log } = buildKnockoutDraw(qualified, hasTP, rng); applyDE(ko); propagateKO(ko); setTKO(ko); setTKODrawLog(log); setTPhase("knockout"); }
      else if (km === "manual") { let n2=1; while(n2<qualified.length)n2*=2; setTKOManual({ pool: [...qualified], matches: Array.from({ length: n2/2 }, () => ({ home: null, away: null })), numByes: n2-qualified.length }); setTPhase("ko_manual"); }
    }
  };
  const tByeConfirm = () => {
    if (!tByeManual || tByeManual.selected.length !== tByeManual.numByes) return;
    const byeSet = new Set(tByeManual.selected.map(t => t.name));
    const byeTeams = tByeManual.selected;
    const rest = tByeManual.pool.filter(t => !byeSet.has(t.name));
    const hasTP = tByeManual.hasTP;
    const km = tConfig.koAllocMode;
    let n2=1; while(n2<tByeManual.pool.length)n2*=2;
    const seeds = bracketSeeds(n2);
    const byeMatches = new Set();
    const byeSlots = new Array(n2).fill(null);
    for (let i = 0; i < byeTeams.length; i++) { const pos = seeds.indexOf(i + 1); byeSlots[pos] = byeTeams[i]; byeMatches.add(Math.floor(pos / 2)); }
    if (km === "manual") {
      const nonByeCount = n2 / 2 - byeMatches.size;
      setTKOManual({ pool: [...rest], matches: Array.from({ length: nonByeCount }, () => ({ home: null, away: null })), numByes: byeTeams.length, byeSlots, byeMatches: [...byeMatches], n2, hasTP });
      setTPhase("ko_manual"); setTByeManual(null); return;
    }
    const slots = [...byeSlots];
    let ordered;
    if (km === "random") { ordered = rest.sort(() => new RNG(Date.now()).u() - 0.5); }
    else if (km === "draw") { const rng = new RNG(Date.now()); const half = Math.ceil(rest.length/2); const p1 = rest.slice(0,half).sort(()=>rng.u()-0.5); const p2 = rest.slice(half).sort(()=>rng.u()-0.5); ordered = []; for(let i=0;i<p2.length;i++){ordered.push(p1[i],p2[i]);} if(p1.length>p2.length)ordered.push(p1[p1.length-1]); }
    else { ordered = [...rest]; }
    let oi = 0; for (let i = 0; i < n2; i += 2) { if (byeMatches.has(i / 2)) continue; slots[i] = ordered[oi++] || null; slots[i + 1] = ordered[oi++] || null; }
    const first = [];
    for (let i = 0; i < n2; i += 2) { const h = slots[i], a = slots[i+1]; first.push({ home: h||a, away: h&&a?a:null, result:null, ...((!h||!a)?{bye:true}:{}) }); }
    const ko = buildKOShell(first, hasTP);
    if (tConfig.koFormat === "double_elim") convertToDoubleElim(ko, tConfig.koGFReset);
    propagateKO(ko); setTKO(ko);
    setTPhase("knockout"); setTByeManual(null); setTPlayerStats({});
  };
  const tKOManualAssign = (teamIdx, matchIdx, slot) => {
    if (!tKOManual) return;
    const nm = JSON.parse(JSON.stringify(tKOManual));
    const t = nm.pool.splice(teamIdx, 1)[0];
    nm.matches[matchIdx][slot] = t;
    setTKOManual(nm);
  };
  const tKOManualRemove = (matchIdx, slot) => {
    if (!tKOManual) return;
    const nm = JSON.parse(JSON.stringify(tKOManual));
    const t = nm.matches[matchIdx][slot];
    if (!t) return;
    nm.matches[matchIdx][slot] = null;
    nm.pool.push(t);
    setTKOManual(nm);
  };
  const tKOManualConfirm = () => {
    if (!tKOManual || tKOManual.pool.length > 1) return;
    if (tKOManual.byeSlots) {
      // Merge manual matches with pre-placed byes
      const slots = [...tKOManual.byeSlots];
      const byeSet = new Set(tKOManual.byeMatches);
      const manualMatches = tKOManual.matches.filter(m => m.home || m.away);
      if (tKOManual.pool.length === 1) manualMatches.push({ home: tKOManual.pool[0], away: null });
      let mi = 0;
      for (let i = 0; i < tKOManual.n2; i += 2) { if (byeSet.has(i / 2)) continue; if (mi < manualMatches.length) { slots[i] = manualMatches[mi].home; slots[i + 1] = manualMatches[mi].away; mi++; } }
      const first = [];
      for (let i = 0; i < tKOManual.n2; i += 2) { const h = slots[i], a = slots[i+1]; first.push({ home: h||a, away: h&&a?a:null, result:null, ...((!h||!a)?{bye:true}:{}) }); }
      const hasTP = tConfig.koFormat !== "double_elim" && tKOManual.hasTP;
      const ko = buildKOShell(first, hasTP);
      if (tConfig.koFormat === "double_elim") convertToDoubleElim(ko, tConfig.koGFReset);
      propagateKO(ko); setTKO(ko);
      setTPhase("knockout"); setTKOManual(null); return;
    }
    const first = tKOManual.matches.filter(m => m.home || m.away).map(m => ({ home: m.home, away: m.away, result: null, ...(!m.home || !m.away ? {bye:true} : {}) }));
    if (tKOManual.pool.length === 1) first.push({ home: tKOManual.pool[0], away: null, result: null, bye: true });
    const isDE2 = tConfig.koFormat === "double_elim";
    const hasTP = !isDE2 && tConfig.thirdPlace && first.length * 2 >= 4;
    const ko = buildKOShell(first, hasTP);
    if (isDE2) convertToDoubleElim(ko, tConfig.koGFReset);
    propagateKO(ko); setTKO(ko);
    setTPhase("knockout"); setTKOManual(null);
  };
  const tSimKOMatch = (rng, m, legTarget, haKey, unavailSet) => {
    const haDefault = resolveKOHomeAdv(m, tConfig);
    const ov = tHomeAdvOverrides[haKey] || null;
    const hSq = filterSquad(m.home.squad, m.home.name, unavailSet), aSq = filterSquad(m.away.squad, m.away.name, unavailSet);
    if (tConfig.koLegs === 1) return simInstantMatch(rng, m.home.skill, m.away.skill, true, m.home.style, m.away.style, m.home.formation, m.away.formation, tGetHA(haKey, haDefault), m.home.strategy, m.away.strategy, hSq, aSq);
    let leg1HA, leg2HA;
    if (ov === "off") { leg1HA = null; leg2HA = null; }
    else { leg1HA = "home"; leg2HA = "away"; }
    const ag = tConfig.koAwayGoals && ov !== "off";
    if (legTarget === 1 || (!m.result && legTarget !== 0)) return simFirstLeg(rng, m.home.skill, m.away.skill, m.home.style, m.away.style, m.home.formation, m.away.formation, leg1HA, m.home.strategy, m.away.strategy, hSq, aSq);
    if ((legTarget === 2 || legTarget === undefined) && m.result?.partial) return simSecondLeg(rng, m.result, m.home.skill, m.away.skill, m.home.style, m.away.style, m.home.formation, m.away.formation, leg2HA, m.home.strategy, m.away.strategy, ag, hSq, aSq);
    if (legTarget === 0) return simTwoLegMatch(rng, m.home.skill, m.away.skill, m.home.style, m.away.style, m.home.formation, m.away.formation, leg1HA, leg2HA, m.home.strategy, m.away.strategy, ag, hSq, aSq);
    return m.result;
  };
  const tScorinateKO = (targetRi, targetMi, legTarget, bracket) => {
    const bulk = targetRi === -1 || targetMi === -1;
    const run = () => {
    const rng = new RNG(Date.now());
    const ko = JSON.parse(JSON.stringify(tKO));
    const localBans = {};
    for (const [k, v] of Object.entries(tPlayerStats)) { if ((v.suspended||0) > 0 || (v.injOut||0) > 0) localBans[k] = { suspended: v.suspended||0, injOut: v.injOut||0 }; }
    const buildUnavail = () => { const s = new Set(); for (const [k, v] of Object.entries(localBans)) { if ((v.suspended||0) > 0 || (v.injOut||0) > 0) s.add(k); } return s; };
    const applyBan = (info) => { if (info?.redKey) { if (!localBans[info.redKey]) localBans[info.redKey] = {suspended:0,injOut:0}; localBans[info.redKey].suspended += 1; } if (info?.injKey) { if (!localBans[info.injKey]) localBans[info.injKey] = {suspended:0,injOut:0}; localBans[info.injKey].injOut += info.injDur; } };
    const decLocal = (tms) => { for (const k of Object.keys(localBans)) { const tn = k.substring(0, k.indexOf("|")); if (tms.has(tn)) { if (localBans[k].suspended > 0) localBans[k].suspended--; if (localBans[k].injOut > 0) localBans[k].injOut--; } } };
    const accumStats = (m, unavailSet) => {
      if (!m.result || m.result.partial) return;
      if (m.result.twoLeg) {
        const l1h=m.result.leg1?.home||0,l1a=m.result.leg1?.away||0;
        const rH1=accumulateMatchStats(m.home,l1h,l1a,l1h>l1a,l1h===l1a,m.result.cards?.leg1?.home,unavailSet,m.result.playerData?.leg1?.home); applyBan(rH1);
        const rA1=accumulateMatchStats(m.away,l1a,l1h,l1a>l1h,l1h===l1a,m.result.cards?.leg1?.away,unavailSet,m.result.playerData?.leg1?.away); applyBan(rA1);
        const l2h=m.result.leg2?.home||0,l2a=m.result.leg2?.away||0;
        const rH2=accumulateMatchStats(m.home,l2a,l2h,l2a>l2h,l2h===l2a,m.result.cards?.leg2?.away,unavailSet,m.result.playerData?.leg2?.away); applyBan(rH2);
        const rA2=accumulateMatchStats(m.away,l2h,l2a,l2h>l2a,l2h===l2a,m.result.cards?.leg2?.home,unavailSet,m.result.playerData?.leg2?.home); applyBan(rA2);
        m.result.statDiffs = { leg1:{home:rH1?.diffs,away:rA1?.diffs}, leg2:{home:rH2?.diffs,away:rA2?.diffs} };
      } else {
        const kw=koWinner(m); const hg=m.result.ftHome+(m.result.et?.home||0); const ag2=m.result.ftAway+(m.result.et?.away||0);
        const rH=accumulateMatchStats(m.home,hg,ag2,kw===m.home,hg===ag2&&!m.result.pen,m.result.cards?.home,unavailSet,m.result.playerData?.home); applyBan(rH);
        const rA=accumulateMatchStats(m.away,ag2,hg,kw===m.away,hg===ag2&&!m.result.pen,m.result.cards?.away,unavailSet,m.result.playerData?.away); applyBan(rA);
        m.result.statDiffs = { home:rH?.diffs, away:rA?.diffs };
      }
    };
    const simRound = (matches, haPrefix, ri, tRi, tMi) => {
      const tms = new Set();
      matches.forEach((m, mi) => { if (!m.home||!m.away) return; if (m.result&&!m.result.partial) return; if (m.result&&m.result.partial&&legTarget===1) return; if (!m.result&&legTarget===2) return; if (tRi!==-1&&tRi!==ri) return; if (tMi!==-1&&tMi!==mi) return; tms.add(m.home.name); tms.add(m.away.name); });
      if (tms.size > 0) { decrementBans(tms); decLocal(tms); }
      const unavailSet = buildUnavail();
      matches.forEach((m, mi) => { if (!m.home||!m.away) return; if (m.result&&!m.result.partial) return; if (m.result&&m.result.partial&&legTarget===1) return; if (!m.result&&legTarget===2) return; if (tRi!==-1&&tRi!==ri) return; if (tMi!==-1&&tMi!==mi) return; m.result = tSimKOMatch(rng, m, legTarget, `${haPrefix}_${ri}_${mi}`, unavailSet); accumStats(m, unavailSet); });
    };
    const simOne = (m, haKey) => { if (!m?.home||!m?.away) return; if (m.result&&!m.result.partial) return; const tms=new Set([m.home.name,m.away.name]); decrementBans(tms); decLocal(tms); const u=buildUnavail(); m.result=tSimKOMatch(rng,m,legTarget,haKey,u); accumStats(m,u); };
    const isDE = !!ko.losers;
    const simAll = targetRi === -1;
    if (!bracket || bracket === "wb" || simAll) { for (let ri = 0; ri < ko.rounds.length; ri++) { simRound(ko.rounds[ri].matches, "ko", ri, simAll?-1:targetRi, simAll?-1:targetMi); propagateKO(ko); } }
    if (isDE && (bracket === "lb" || simAll)) { for (let lr = 0; lr < ko.losers.length; lr++) { simRound(ko.losers[lr].matches, "lb", lr, simAll?-1:targetRi, simAll?-1:targetMi); propagateKO(ko); } }
    if (isDE && (bracket === "gf" || simAll)) { simOne(ko.grandFinal, "gf"); propagateKO(ko); }
    if (isDE && (bracket === "reset" || simAll)) { simOne(ko.reset, "reset"); propagateKO(ko); }
    if (!isDE && (simAll || targetRi === -2)) { simOne(ko.thirdPlace, "tp"); }
    setTKO(ko);
    if (isKOComplete(ko)) setTPhase("complete");
    if (bulk) setLoading(false);
    };
    if (bulk) { setLoading(true); setTimeout(run, 40); } else run();
  };
  const tDeleteKoResult = (ri, mi, bracket) => {
    if (bracket === true) bracket = "tp";
    if (bracket === false) bracket = "wb";
    const ko = JSON.parse(JSON.stringify(tKO));
    const isDE = !!ko.losers;
    let target;
    if (bracket === "lb") target = ko.losers?.[ri]?.matches[mi];
    else if (bracket === "gf") target = ko.grandFinal;
    else if (bracket === "reset") target = ko.reset;
    else if (bracket === "tp") target = ko.thirdPlace;
    else target = ko.rounds[ri]?.matches[mi];
    if (!target) return;
    const sd = target.result?.statDiffs;
    if (sd) { const sets = sd.leg1 ? [sd.leg1.home, sd.leg1.away, sd.leg2?.home, sd.leg2?.away] : [sd.home, sd.away]; reverseMatchStats(sets); }
    target.result = null;
    if (isDE) {
      const clearLB = (from) => { for (let lr = from; lr < ko.losers.length; lr++) ko.losers[lr].matches.forEach(m2 => { m2.result = null; m2.home = null; m2.away = null; delete m2.bye; }); };
      const clearGFR = () => { ko.grandFinal.result = null; ko.grandFinal.home = null; ko.grandFinal.away = null; if (ko.reset) { ko.reset.result = null; ko.reset.home = null; ko.reset.away = null; } };
      if (!bracket || bracket === "wb") { for (let r2 = ri + 1; r2 < ko.rounds.length; r2++) ko.rounds[r2].matches.forEach(m2 => { m2.result = null; m2.home = null; m2.away = null; }); clearLB(0); clearGFR(); }
      else if (bracket === "lb") { clearLB(ri + 1); clearGFR(); }
      else if (bracket === "gf") { if (ko.reset) { ko.reset.result = null; ko.reset.home = null; ko.reset.away = null; } }
    } else {
      if (bracket !== "tp") { for (let r2 = ri + 1; r2 < ko.rounds.length; r2++) ko.rounds[r2].matches.forEach(m2 => { m2.result = null; m2.home = null; m2.away = null; }); if (ko.thirdPlace && ri <= ko.rounds.length - 2) { ko.thirdPlace.result = null; ko.thirdPlace.home = null; ko.thirdPlace.away = null; } }
    }
    ko.champion = null;
    propagateKO(ko);
    setTKO(ko);
    setTKoEdit(null);
    setTScoreError("");
    setTPhase("knockout");
  };

  // Live-match team colors: primaryColor is a team's home kit, secondaryColor its away
  // kit. Whichever side actually holds home advantage wears its home color; the other
  // side wears its away color (falling back to its home color if none is set) to avoid
  // clashing with the true host. lmHomeAdv names the fixture SLOT that hosts ("home" or
  // "away"), not which team — a team in the away slot can still be the host. A neutral
  // fixture (no host) defaults both sides to home colors unless they clash, in which
  // case the away-slot side switches as a tie-break.
  const hHomeClr = teamById(lmH)?.primaryColor || "#81a1c1";
  const hAwayClr = teamById(lmH)?.secondaryColor || hHomeClr;
  const aHomeClr = teamById(lmA)?.primaryColor || "#bf616a";
  const aAwayClr = teamById(lmA)?.secondaryColor || aHomeClr;
  const clash = colorsClash(hHomeClr, aHomeClr);
  const hClrPre = lmHomeAdv === "away" ? hAwayClr : hHomeClr;
  const aClrPre = lmHomeAdv === "home" ? aAwayClr : (lmHomeAdv == null && clash) ? aAwayClr : aHomeClr;
  // Team-picked colors can be too dark to read against the app's near-black panels.
  // Fall back to the team's other kit color first, then lighten as a last resort.
  const hClr = readableClr(hClrPre, hClrPre === hHomeClr ? hAwayClr : hHomeClr, "#141c2b");
  let aClr = readableClr(aClrPre, aClrPre === aHomeClr ? aAwayClr : aHomeClr, "#141c2b");
  // The away-kit switch above is a no-op when a team has no away color set (it just
  // falls back to its home color), so a clash can survive it. Guarantee the two final
  // colors are distinguishable no matter what caused the collision: try the away side's
  // other kit color once more, then nudge it toward white until it's clearly distinct.
  if (colorsClash(hClr, aClr)) {
    const aOtherReadable = readableClr(aClr === aHomeClr ? aAwayClr : aHomeClr, aClr, "#141c2b");
    if (!colorsClash(hClr, aOtherReadable)) aClr = aOtherReadable;
    else { aClr = lightenUntil(aClr, hClr, 0.35); }
  }
  const hStatClr = ensureMinLum(hClr), aStatClr = ensureMinLum(aClr);
  const hClr2 = hClr, aClr2 = aClr;

  // Shared penalty-shootout diagram (goal SVGs + kick-by-kick list), used by both
  // the live/persistent scoreboard and the match report.
  const renderPenaltyShootout = (pen, hCode, aCode) => {
    const hS = pen.home.filter(k=>k.scored).length, aS = pen.away.filter(k=>k.scored).length;
    const GoalSVG = ({kicks, label}) => {
      const W=180,H=80,gL=20,gR=160,gT=8,gB=72;
      const zPos=[[gL+22,gT+18],[gL+70,gT+14],[gR-22,gT+18],[gL+22,gB-16],[gL+70,gB-12],[gR-22,gB-16]];
      const dX=[(gL+gR)/2-36,(gL+gR)/2,(gL+gR)/2+36];
      const dY=(gT+gB)/2+4;
      const mPos=[[gL-4,gT-6],[gL+70,gT-10],[gR+4,gT-6],[gL-8,gB+4],[gL+70,gB+8],[gR+8,gB+4]];
      return (<svg viewBox={`0 0 ${W} ${H+10}`} style={{width:"100%",maxWidth:180,height:"auto",display:"block"}}>
        <rect x="0" y="0" width={W} height={H+10} fill="transparent" />
        <rect x={gL} y={gT} width={gR-gL} height={gB-gT} fill="#141c2b" stroke="#7889a0" strokeWidth="2.5" rx="1" />
        <line x1={gL+47} y1={gT} x2={gL+47} y2={gB} stroke="#7889a0" strokeWidth="0.5" />
        <line x1={gL+93} y1={gT} x2={gL+93} y2={gB} stroke="#7889a0" strokeWidth="0.5" />
        <line x1={gL} y1={(gT+gB)/2} x2={gR} y2={(gT+gB)/2} stroke="#7889a0" strokeWidth="0.5" />
        <circle cx={(gL+gR)/2} cy={gB+7} r="1.5" fill="#7889a0" />
        {kicks.map((k,i) => {
          const isLast = i === kicks.length-1;
          const pos = k.result==="miss" ? mPos[k.zone] : zPos[k.zone];
          const r = isLast ? 5.5 : 3.5;
          const col = k.result==="goal"?"#a3be8c":k.result==="save"?"#bf616a":"#7889a0";
          return (<>
            {isLast && <rect x={dX[k.dive]-14} y={dY-16} width={28} height={32} rx="3" fill={k.result==="save"?"#bf616a22":"#ffffff08"} stroke={k.result==="save"?"#bf616a44":"#ffffff15"} strokeWidth="1" />}
            <circle cx={pos[0]} cy={pos[1]} r={r} fill={col} opacity={isLast?1:0.6} />
            {k.result==="miss" && <text x={pos[0]} y={pos[1]+1} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={isLast?"9":"7"} fontWeight="700">×</text>}
            {isLast && k.result==="goal" && <text x={pos[0]} y={pos[1]+1} textAnchor="middle" dominantBaseline="middle" fill="#141c2b" fontSize="7" fontWeight="700">✓</text>}
          </>);
        })}
        <text x={W/2} y={H+9} textAnchor="middle" fill="#ffffff" fontSize="7" fontFamily="monospace">{label}</text>
      </svg>);
    };
    return (<div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, justifyContent: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", ...mono }}>{hS}</span>
        <span style={{ fontSize: 9, color: "#ffffff", letterSpacing: "0.15em" }}>PENALTIES</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", ...mono }}>{aS}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0 6px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <GoalSVG kicks={pen.home} label={hCode} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingTop: 4 }}>
          {Array.from({length: Math.max(pen.home.length, pen.away.length)}, (_,i) => {
            const h = pen.home[i], a = pen.away[i];
            return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 9 }}>
              <span style={{ width: 90, textAlign: "right", color: h ? (h.scored ? "#a3be8c" : "#bf616a") : "#ffffff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{h?.name||""}</span>
              <span style={{ color: h ? (h.scored ? "#a3be8c" : "#bf616a") : "#ffffff", fontSize: 12, width: 14, textAlign: "center" }}>{h ? (h.scored ? "●" : "○") : ""}</span>
              <span style={{ color: "#ffffff", fontSize: 8, width: 12, textAlign: "center", ...mono }}>{i+1}</span>
              <span style={{ color: a ? (a.scored ? "#a3be8c" : "#bf616a") : "#ffffff", fontSize: 12, width: 14, textAlign: "center" }}>{a ? (a.scored ? "●" : "○") : ""}</span>
              <span style={{ width: 90, textAlign: "left", color: a ? (a.scored ? "#a3be8c" : "#bf616a") : "#ffffff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a?.name||""}</span>
            </div>);
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <GoalSVG kicks={pen.away} label={aCode} />
        </div>
      </div>
    </div>);
  };

  const renderScoreboard = () => (
    <div style={{ background: `linear-gradient(90deg, ${hClr2}88 0%, ${hClr2}88 40%, ${aClr2}88 60%, ${aClr2}88 100%)`, border: "1px solid #2a3a50", borderRadius: 10, padding: "14px 20px 12px", marginBottom: 12, textAlign: "center", boxShadow: "0 4px 20px #00000040", textShadow: "0 1px 3px rgba(0,0,0,0.75)" }}>
      {/* Venue + POTM sticker */}
      {lmMatch.phase === "pre_match" && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffffff", marginBottom: 10 }}>PRE-MATCH</div>}
      {/* Pre-match tactical preview */}
      {lmMatch.phase === "pre_match" && (()=>{
        const SC = {balanced:"#888",gegenpress:"#bf616a",tikitaka:"#ebcb8b",counterattack:"#81a1c1",wingplay:"#a3be8c",parkthebus:"#d08770"};
        const sn = shortName;
        const PitchSVG = ({squad, formation}) => {
          const starters = (squad||[]).filter(p => !p.bench);
          const FPOS = {
            "4-4-2":   [[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[12,52],[37.3,54],[62.7,54],[88,52],[38,28],[62,28]],
            "4-3-3":   [[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[28,52],[50,50],[72,52],[15,24],[50,20],[85,24]],
            "4-2-3-1": [[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[39,56],[61,56],[18,36],[50,32],[82,36],[50,14]],
            "4-1-4-1": [[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[50,56],[14,38],[38,40],[62,40],[86,38],[50,18]],
            "4-1-2-1-2":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[50,58],[39,44],[61,44],[50,30],[39,16],[61,16]],
            "4-3-2-1": [[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[28,54],[50,52],[72,54],[38,32],[62,32],[50,14]],
            "4-2-4":   [[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[39,54],[61,54],[14,26],[38,22],[62,22],[86,26]],
            "3-4-3":   [[50,93],[28,76],[50,78],[72,76],[12,52],[37.3,54],[62.7,54],[88,52],[18,24],[50,20],[82,24]],
            "3-5-2":   [[50,93],[28,76],[50,78],[72,76],[9,50],[29.5,52],[50,48],[70.5,52],[91,50],[39,22],[61,22]],
            "3-4-1-2": [[50,93],[28,76],[50,78],[72,76],[12,54],[37.3,56],[62.7,56],[88,54],[50,34],[39,16],[61,16]],
            "5-3-2":   [[50,93],[9,68],[28,76],[50,78],[72,76],[91,68],[28,48],[50,46],[72,48],[39,22],[61,22]],
          };
          const pitchPos2 = FPOS[formation] || (() => {
            const layers = (formation||"4-3-3").split("-").map(Number);
            const nR = layers.length+1, yT=12, yB=90, rG=(yB-yT)/(nR-1);
            const pts = [{x:50,y:yB}];
            // Keep adjacent dots at least 22 units apart so player-name labels never overlap.
            layers.forEach((c,li)=>{const y=yB-(li+1)*rG;const hs=c<=1?0:Math.max(35,11*(c-1));const lo=50-hs;const gap=c<=1?0:(2*hs)/(c-1);for(let j=0;j<c;j++){pts.push({x:c===1?50:lo+j*gap,y});}});
            return pts;
          })();
          const pp = pitchPos2.map(p => Array.isArray(p) ? {x:p[0],y:p[1]} : p);
          return (<svg viewBox="-10 0 120 100" style={{ width: "100%", height: "auto" }}>
            <rect x="1" y="1" width="98" height="98" fill="#060b14" stroke="#7889a044" strokeWidth="0.6" rx="1.5" />
            <rect x="26" y="1" width="48" height="13" fill="none" stroke="#7889a044" strokeWidth="0.5" />
            <rect x="37" y="1" width="26" height="5" fill="none" stroke="#7889a033" strokeWidth="0.35" />
            <rect x="26" y="86" width="48" height="13" fill="none" stroke="#7889a044" strokeWidth="0.5" />
            <rect x="37" y="94" width="26" height="5" fill="none" stroke="#7889a033" strokeWidth="0.35" />
            <circle cx="50" cy="50" r="9" fill="none" stroke="#7889a044" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="0.6" fill="#7889a044" />
            <line x1="1" y1="50" x2="99" y2="50" stroke="#7889a044" strokeWidth="0.5" />
            {starters.map((p, pi) => {
              const pos = pp[pi]; if (!pos) return null;
              return (<g key={pi}>
                <circle cx={pos.x} cy={pos.y} r="3.2" fill={POS_CLR[p.pos]||"#888"} opacity="0.9" stroke="#060b14" strokeWidth="0.5" />
                <text x={pos.x} y={pos.y - 5} textAnchor="middle" fill="#ffffff" fontSize="2.6" fontFamily="monospace" fontWeight="500">{sn(p.name)}</text>
              </g>);
            })}
          </svg>);
        };
        return (<div style={{ marginTop: 10, marginBottom: 6 }}>
          {/* Formation pitches with team info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
            {[{side:"home",id:lmH},{side:"away",id:lmA}].map(({side,id}) => {
              const tm = teamById(id);
              const rawSq = tm?.squad || buildSquad(tm?.formation || "4-3-3", null);
              const { starters, bench } = displaySquad(rawSq, tm?.name, tPlayerStats);
              return (<div key={side} style={{ background: "#0a0e17", border: "1px solid #2a3a50", borderRadius: 8, padding: "10px 10px 8px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 2px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#ffffff" }}>{tm?.name}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 8, color: SC[tm?.style]||"#888", fontWeight: 600 }}>{STYLE_LBL[tm?.style]||"Balanced"}</span>
                    <span style={{ fontSize: 9, color: FORM_CLR[tm?.formation||"4-3-3"]||"#7889a0", fontWeight: 600, ...mono }}>{tm?.formation||"4-3-3"}</span>
                  </div>
                </div>
                <PitchSVG squad={[...starters, ...bench]} formation={tm?.formation} />
                <div style={{ marginTop: 6, padding: "0 2px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 8px", fontSize: 9 }}>
                    {starters.map((p, pi) => (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 4, padding: "1px 0" }}>
                        <span style={{ color: POS_CLR[p.pos], fontWeight: 700, fontSize: 7, width: 20, flexShrink: 0, textAlign: "left", ...mono }}>{p.pos}</span>
                        <span style={{ color: "#ffffff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1, textAlign: "left" }}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                  {bench.length > 0 && <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #2a3a5033" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0 8px", fontSize: 8, color: "#7889a0" }}>
                      {bench.map((p, pi) => <span key={pi} style={p.out ? {color:"#bf616a"} : undefined}>{sn(p.name)}{p.out && " (OUT)"}</span>)}
                    </div>
                  </div>}
                </div>
              </div>);
            })}
          </div>
        </div>);
      })()}
      {/* Score */}
      {lmMatch.phase !== "pre_match" && <>
      {(() => {
        // Venue only reflects a real team's stadium when that team was actually assigned
        // home advantage — a fixture with no HA (or a set-piece neutral venue name/pool
        // entry) shows that instead, rather than defaulting to whichever team sits in
        // the "home" slot.
        let venueText;
        if (lmMatch.venue?.city || lmMatch.venue?.stadium) venueText = [lmMatch.venue.stadium, lmMatch.venue.city].filter(Boolean).join(", ");
        else {
          const hostTeam = lmMatch.homeAdv === "away" ? teamById(lmA) : lmMatch.homeAdv === "home" ? teamById(lmH) : null;
          venueText = hostTeam?.stadium || hostTeam?.city ? [hostTeam.stadium, hostTeam.city].filter(Boolean).join(", ") : "Neutral Venue";
        }
        let potmEl = null;
        if (lmMatch.phase === "finished") {
          const allP = [...(lmMatch.players?.home||[]),...(lmMatch.subbedOff?.home||[]),...(lmMatch.players?.away||[]),...(lmMatch.subbedOff?.away||[])];
          if (allP.length > 0) {
            const potm = allP.reduce((a,b) => (b.rating||0)>(a.rating||0)?b:a, allP[0]);
            if (potm && potm.rating >= 6.5) {
              const isHome = [...(lmMatch.players?.home||[]),...(lmMatch.subbedOff?.home||[])].some(p=>p.name===potm.name);
              const tCode = isHome ? abbr(teamById(lmH)?.name, teamById(lmH)?.code) : abbr(teamById(lmA)?.name, teamById(lmA)?.code);
              const tClr = isHome ? hClr : aClr;
              potmEl = <><span style={{ margin: "0 8px", color: "#ffffff33" }}>|</span><span style={{ fontSize: 11 }}>⭐</span> <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}><span style={{ fontSize: 10, color: "#ffffff", fontWeight: 600, ...ui }}>{potm.name}</span> <span style={{ fontSize: 10, color: tClr, fontWeight: 600, ...mono }}>{tCode}</span> <span style={{ fontSize: 10, color: ratingColor(potm.rating||6.5), fontWeight: 700, ...mono }}>{potm.rating.toFixed(1)}</span></span></>;
            }
          }
        }
        return <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#141c2b", border: "1px solid #2a3a5066", borderRadius: 6, padding: "3px 10px", marginBottom: 8 }}>
          <span style={{ fontSize: 10 }}>📍</span>
          <span style={{ fontSize: 10, color: "#ffffffcc", fontWeight: 500, ...ui }}>{venueText}</span>
          {potmEl}
        </div>;
      })()}
      {(() => {
        const buildItems = (side) => {
          const items = [];
          for (const g of lmMatch.goalscorers?.[side] || [])
            items.push({ type: g.method === "pen" ? "pen_goal" : g.method === "og" ? "og" : "goal", name: g.name, min: g.min });
          for (const e of lmMatch.events || [])
            if (e.team === side && e.player && (e.type === "red" || (e.type === "pen_miss" && e.min !== "PEN")))
              items.push({ type: e.type, name: e.player, min: e.min });
          items.sort((a, b) => {
            const am = typeof a.min === "number" ? a.min : parseInt(a.min) || 999;
            const bm = typeof b.min === "number" ? b.min : parseInt(b.min) || 999;
            return am - bm;
          });
          return items;
        };
        const hI = buildItems("home"), aI = buildItems("away");
        const mTxt = (m) => (m != null && m !== "" && m !== "PEN") ? m + "'" : "";
        const ball = (t) => t === "pen_miss" ? <span style={{ fontSize: 9, color: "#e4002b" }}>⚽︎</span>
          : (t === "goal" || t === "og" || t === "pen_goal") ? <span style={{ fontSize: 9 }}>⚽︎</span>
          : t === "red" ? <svg width="8" height="11" viewBox="0 0 8 11" style={{ verticalAlign: "middle", flexShrink: 0 }}><rect x="1" y="1" width="6" height="9" rx="1" fill="#bf616a" transform="rotate(15 4 5.5)"/></svg>
          : null;
        const ballWithP = (t) => {
          const isPen = t === "pen_goal" || t === "pen_miss";
          const isOG = t === "og";
          const label = isPen ? "P" : isOG ? "OG" : null;
          return <span style={{ display: "inline-flex", alignItems: "flex-start", position: "relative" }}>
            {ball(t)}
            {label && <span style={{ fontSize: 6, color: "#ffffff", position: "absolute", top: -3, right: isOG ? -8 : -4, fontWeight: 700, ...mono }}>{label}</span>}
          </span>;
        };
        const evRows = Array.from({ length: Math.max(hI.length, aI.length) }, (_, i) => ({ h: hI[i], a: aI[i] }));
        const phaseLabelBase = lmMatch.phase === "half_time" ? "HALF TIME"
          : lmMatch.phase === "full_time" ? "FULL TIME"
          : lmMatch.phase === "et_half_time" || lmMatch.phase === "extra_half_time" ? "ET HALF TIME"
          : lmMatch.phase === "et_full_time" ? "ET FULL TIME"
          : lmMatch.phase === "penalties" ? "PENALTIES"
          : lmMatch.phase === "finished" ? "FULL TIME"
          : lmClockDisplay(lmMatch);
        const phaseLabelText = lmMatch.isSecondLeg
          ? `${phaseLabelBase} (${lmMatch.score[0]+lmMatch.startScore[0]}-${lmMatch.score[1]+lmMatch.startScore[1]} AGG.)`
          : phaseLabelBase;
        return <div style={{ marginBottom: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "start", columnGap: 16 }}>
            {/* Left: home crest, big, own column, top-aligned with the phase/clock label.
                Event minutes stack below it, in order, rather than crowding the name row. */}
            <div style={{ minWidth: 100 }}>
              <div style={{ position: "relative", height: 65, width: 100, margin: "0 auto" }}>
                <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)" }}>
                  <TeamCrest team={teamById(lmH)} size={100} />
                </div>
              </div>
              {evRows.map((row, i) => (
                <div key={i} style={{ fontSize: 9, color: "#ffffffcc", textAlign: "center", marginTop: i === 0 ? 0 : 4, ...mono }}>{row.h ? mTxt(row.h.min) :" "}</div>
              ))}
            </div>
            {/* Middle: phase/clock bar, then name+skill (stacked, as a unit) | score | name+skill —
                score centers against the whole 2-line name+skill block, matching the classic layout. */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffffff", textAlign: "center", marginBottom: 6 }}>{phaseLabelText}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", columnGap: 16, alignItems: "center", rowGap: 4 }}>
                <div style={{ textAlign: "right", minWidth: 0 }}>
                  <MarqueeName text={teamById(lmH)?.name} align="right" style={{ fontSize: 18, fontWeight: 600, color: "#ffffff" }} />
                  <div style={{ fontSize: 9, ...mono }}><span style={{ color: "#ffffff" }}>{abbr(teamById(lmH)?.name, teamById(lmH)?.code)}</span> <span style={{ color: "#ffffff" }}>· {teamById(lmH)?.skill}</span></div>
                </div>
                <div style={{ fontSize: 40, fontWeight: 700, color: "#ffffff", letterSpacing: 2, lineHeight: 1, textAlign: "center", whiteSpace: "nowrap" }}>
                  <span className={goalFlash==="home"?"goal-flash":""}>{lmMatch.score[0]}</span>
                  <span style={{ color: "#ffffff", margin: "0 6px" }}>-</span>
                  <span className={goalFlash==="away"?"goal-flash":""}>{lmMatch.score[1]}</span>
                </div>
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <MarqueeName text={teamById(lmA)?.name} align="left" style={{ fontSize: 18, fontWeight: 600, color: "#ffffff" }} />
                  <div style={{ fontSize: 9, ...mono }}><span style={{ color: "#ffffff" }}>{teamById(lmA)?.skill} ·</span> <span style={{ color: "#ffffff" }}>{abbr(teamById(lmA)?.name, teamById(lmA)?.code)}</span></div>
                </div>
                {/* Events: extra rows in this SAME grid, so columns are guaranteed to line up with
                    name/score above — ball icons share the score column, names share the name columns.
                    Minutes live under the crests instead (separate columns, see either side). */}
                {evRows.map((row, i) => (
                  <Fragment key={i}>
                    <div style={{ textAlign: "right", fontSize: 9, color: "#ffffff" }}>{row.h?.name}</div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ flex: 1, display: "flex", justifyContent: "center", transform: "translateX(-6.5px)" }}>{row.h && ballWithP(row.h.type)}</div>
                      <div style={{ flex: 1, display: "flex", justifyContent: "center", transform: "translateX(6.5px)" }}>{row.a && ballWithP(row.a.type)}</div>
                    </div>
                    <div style={{ textAlign: "left", fontSize: 9, color: "#ffffff" }}>{row.a?.name}</div>
                  </Fragment>
                ))}
              </div>
            </div>
            {/* Right: away crest, big, own column. Event minutes stack below it. */}
            <div style={{ minWidth: 100 }}>
              <div style={{ position: "relative", height: 65, width: 100, margin: "0 auto" }}>
                <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)" }}>
                  <TeamCrest team={teamById(lmA)} size={100} />
                </div>
              </div>
              {evRows.map((row, i) => (
                <div key={i} style={{ fontSize: 9, color: "#ffffffcc", textAlign: "center", marginTop: i === 0 ? 0 : 4, ...mono }}>{row.a ? mTxt(row.a.min) :" "}</div>
              ))}
            </div>
          </div>
        </div>;
      })()}
      {lmMatch.penalties && (lmMatch.phase === "penalties" || lmMatch.phase === "finished") && <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #ffffff33" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#ffffff", marginBottom: 8, textAlign: "center" }}>Penalty Shootout</div>
        {renderPenaltyShootout(lmMatch.penalties, abbr(teamById(lmH)?.name, teamById(lmH)?.code), abbr(teamById(lmA)?.name, teamById(lmA)?.code))}
      </div>}
      </>}
    </div>
  );

  const renderStatsReport = () => {
    const ph = lmMatch.possCount.home, pa = lmMatch.possCount.away, pt = ph+pa||1;
    const hp = Math.round(ph/pt*100), ap = 100-hp;
    const st = lmMatch.stats;
    const hXG = (lmMatch.xG?.home||0).toFixed(2), aXG = (lmMatch.xG?.away||0).toFixed(2);
    const statRows = [["Possession",hp+"%",ap+"%"],["Shots",st.home.shots,st.away.shots],["On Target",st.home.onTarget,st.away.onTarget],["xG",hXG,aXG],["Corners",st.home.corners,st.away.corners],["Fouls",st.home.fouls,st.away.fouls],["Yellows",st.home.yellows,st.away.yellows],["Reds",st.home.reds,st.away.reds]];
    return (
      <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, marginBottom: 12 }}>
        {/* Match Stats */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #2a3a50" }}>
          {statRows.map(([label, h, a], i) => { const hv = typeof h === "string" ? parseFloat(h) : h; const av = typeof a === "string" ? parseFloat(a) : a; const mx = Math.max(hv, av, 1); return (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 11 }}>
              <span style={{ width: 32, textAlign: "right", color: hv >= av ? hStatClr : "#7889a0", fontWeight: hv >= av ? 600 : 400, ...mono, fontSize: 10, flexShrink: 0 }}>{h}</span>
              <div style={{ flex: 1, margin: "0 4px", display: "flex", justifyContent: "flex-end" }}><div style={{ width: `${Math.round(hv/mx*100)}%`, height: 4, background: hv >= av ? hClr + "88" : "#7889a0", borderRadius: 2 }} /></div>
              <span style={{ width: 60, textAlign: "center", color: "#7889a0", fontSize: 9, flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, margin: "0 4px", display: "flex", justifyContent: "flex-start" }}><div style={{ width: `${Math.round(av/mx*100)}%`, height: 4, background: av >= hv ? aClr + "88" : "#7889a0", borderRadius: 2 }} /></div>
              <span style={{ width: 32, textAlign: "left", color: av >= hv ? aStatClr : "#7889a0", fontWeight: av >= hv ? 600 : 400, ...mono, fontSize: 10, flexShrink: 0 }}>{a}</span>
            </div>
          ); })}
        </div>
        {/* Player Ratings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }}>
        {["home","away"].map((side,si) => {
          const tm = side === "home" ? teamById(lmH) : teamById(lmA);
          const { starters, bench: benchSq } = displaySquad(tm?.squad || buildSquad(tm?.formation, null), tm?.name, tPlayerStats);
          const onPitch = lmMatch.players[side] || [];
          const off = lmMatch.subbedOff?.[side] || [];
          const bench = lmMatch.bench?.[side] || [];
          const lookup = (name) => onPitch.find(p=>p.name===name) || off.find(p=>p.name===name) || bench.find(p=>p.name===name);
          return (<>
          {si === 1 && <div style={{ background: "#7889a0" }}></div>}
          <div>
            <div style={{ fontSize: 8, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6 }}>{tm?.name?.toUpperCase()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 18px 18px 16px 16px 16px 28px 12px", gap: "0px 2px", fontSize: 9, alignItems: "center" }}>
              <span style={{ color: "#7889a0", fontSize: 7 }}>POS</span>
              <span style={{ color: "#7889a0", fontSize: 7 }}>PLAYER</span>
              <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }}>G</span>
              <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }}>A</span>
              <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }} title="Chances created">C</span>
              <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }} title="Defensive actions">D</span>
              <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }} title="Saves (GK)">S</span>
              <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }}>RTG</span>
              <span></span>
              {starters.map((sq2,pi) => { const p = lookup(sq2.name) || {rating:6.0,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,chances:0,defActs:0,saves:0}; const isOff = off.some(x=>x.name===sq2.name); const isOn = onPitch.some(x=>x.name===sq2.name&&x.sub==='on'); return (<>
                <span key={"p"+pi} style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                <span style={{ color: isOff?"#7889a0":"#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}</span>
                <span style={{ textAlign: "center", color: p.goals>0?"#ffffff":"#7889a0", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                <span style={{ textAlign: "center", color: p.assists>0?"#ffffff":"#7889a0", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                <span style={{ textAlign: "center", color: p.chances>0?"#ffffff":"#7889a0", fontWeight: p.chances>0?700:400 }}>{p.chances||"-"}</span>
                <span style={{ textAlign: "center", color: p.defActs>0?"#ffffff":"#7889a0", fontWeight: p.defActs>0?700:400 }}>{p.defActs||"-"}</span>
                <span style={{ textAlign: "center", color: p.saves>0?"#ffffff":"#7889a0", fontWeight: p.saves>0?700:400 }}>{sq2.pos==="GK"?(p.saves||"-"):""}</span>
                <span style={{ textAlign: "center", color: ratingColor(p.rating||6.5), fontWeight: 600, ...mono }}>{p.rating!=null?p.rating.toFixed(1):"–"}</span>
                <span style={{ fontSize: 7, color: isOff?"#bf616a":"#7889a0", textAlign: "center" }}>{isOff?"▼":""}</span>
              </>); })}
              <span style={{ gridColumn: "1/-1", borderTop: "1px solid #2a3a50", marginTop: 2, marginBottom: 2 }}></span>
              {[...benchSq].sort((a,b) => { const aOn = onPitch.some(x=>x.name===a.name); const bOn = onPitch.some(x=>x.name===b.name); return aOn===bOn?0:aOn?-1:1; }).map((sq2,pi) => { const p = lookup(sq2.name) || {rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,chances:0,defActs:0,saves:0}; const isOn = onPitch.some(x=>x.name===sq2.name); return (<>
                <span key={"b"+pi} style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                <span style={{ color: isOn?"#ffffff":"#7889a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}{sq2.out&&<span style={{marginLeft:3,fontSize:7,color:"#bf616a",fontWeight:700}}>OUT</span>}</span>
                <span style={{ textAlign: "center", color: p.goals>0?"#ffffff":"#7889a0", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                <span style={{ textAlign: "center", color: p.assists>0?"#ffffff":"#7889a0", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                <span style={{ textAlign: "center", color: p.chances>0?"#ffffff":"#7889a0", fontWeight: p.chances>0?700:400 }}>{p.chances||"-"}</span>
                <span style={{ textAlign: "center", color: p.defActs>0?"#ffffff":"#7889a0", fontWeight: p.defActs>0?700:400 }}>{p.defActs||"-"}</span>
                <span style={{ textAlign: "center", color: p.saves>0?"#ffffff":"#7889a0", fontWeight: p.saves>0?700:400 }}>{sq2.pos==="GK"?(p.saves||"-"):""}</span>
                <span style={{ textAlign: "center", color: !isOn?"#7889a0":ratingColor(p.rating||6.5), fontWeight: 600, ...mono }}>{isOn&&p.rating!=null?p.rating.toFixed(1):"–"}</span>
                <span style={{ fontSize: 7, color: isOn?"#a3be8c":"#7889a0", textAlign: "center" }}>{isOn?"▲":""}</span>
              </>); })}
            </div>
          </div>
          </>);
        })}
        </div>
        {tLiveTarget && <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #2a3a50", textAlign: "center" }}>
          <span style={{ fontSize: 9, color: "#7889a0" }} title="Tracked per fixture, persists across abandons and page reloads">Replays: {Math.max(0, (tReplayCounts[fixtureKey(tLiveTarget)] || 1) - 1)}</span>
        </div>}
      </div>
    );
  };

  // Single source of truth for team-list column widths — header spacers and row cells
  // both read from this, so they can't drift out of alignment with each other.
  const TEAM_COLW = { num: 22, crest: 26, code: 40, skill: 40, sq: 32, tac: 32, inf: 32, del: 28 };
  const teamSearchQ = teamSearchQuery.trim().toLowerCase();
  // Prefix match only — code or any word in the name must START with the query, so "NCH"
  // finds Nichirin (code) without also matching the "nch" buried inside "Manchester".
  const teamMatchesSearch = (t) => {
    if (!teamSearchQ) return true;
    if (abbr(t.name, t.code).toLowerCase().startsWith(teamSearchQ)) return true;
    return t.name.toLowerCase().split(/\s+/).some(w => w.startsWith(teamSearchQ));
  };
  const teamsFiltered = teams.filter(t => (!teamLeagueFilter || (t.league||"Custom") === teamLeagueFilter) && teamMatchesSearch(t));

  return (
    <div style={{ ...ui, background: "#0a0e17", color: "#ffffff", minHeight: "100vh", padding: "24px 18px" }}>
      <style>{APP_CSS}</style>
      {loading && <div style={{ position: "fixed", inset: 0, background: "#0a0e17dd", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}><div style={{ width: 28, height: 28, border: "3px solid #141c2b", borderTop: "3px solid #7889a0", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /><span style={{ fontSize: 10, color: "#7889a0", letterSpacing: "0.15em" }}>SIMULATING…</span></div>}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 20, paddingBottom: 12 }}>
          <div style={{ marginBottom: 12, textAlign: "center" }}>
            <img src={headerImg} alt="Avium Football Engine" style={{ width: "100%", height: "auto" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["live", "Live Match"], ["tournament", "Tournament"], ["docs", "Docs"]].map(([id, l]) => (
              <button key={id} onClick={() => setTab(id)} style={{ ...chip, background: tab === id ? "#e4002b" : "transparent", color: tab === id ? "#ffffff" : "#7889a0", border: tab === id ? "1px solid #e4002b" : "1px solid #141c2b", boxShadow: tab === id ? "0 0 12px #e4002b44" : "none" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* SHARED TEAMS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: teamsOpen ? 8 : 16, minHeight: 32 }}>
          <label onClick={() => setTeamsOpen(!teamsOpen)} style={{ ...lbl, margin: 0, cursor: "pointer", userSelect: "none" }}><span style={{ color: "#7889a0", marginRight: 6, fontSize: 8, display: "inline-block", transform: teamsOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>Teams <span style={{ color: "#7889a0", fontWeight: 400 }}>{(teamLeagueFilter || teamSearchQ) ? `(${teamsFiltered.length} / ${teams.length})` : `(${teams.length})`}</span></label>
          <div style={{ display: "flex", gap: 6 }}>
            {teamsOpen && <select value={teamLeagueFilter} onChange={e => setTeamLeagueFilter(e.target.value)} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: teamLeagueFilter ? "#e4002b" : "#7889a0", background: "transparent", cursor: "pointer" }}><option value="">☰ All Leagues</option><option disabled>──────</option>{groupByLeague(teams).map((entry, gi) => entry === null ? <option key={"div"+gi} disabled>──────</option> : <option key={entry[0]} value={entry[0]}>{entry[0]}</option>)}{!teams.some(t => t.league === "Custom") && <><option disabled>──────</option><option value="Custom">Custom</option></>}</select>}
            {teamsOpen && <input value={teamSearchQuery} onChange={e => setTeamSearchQuery(e.target.value)} placeholder="🔍 Search" style={{ ...addBtn, width: 160, background: "transparent", color: teamSearchQuery ? "#e4002b" : "#7889a0", cursor: "text" }} />}
            {teamsOpen && teamLeagueFilter === "Custom" && <button onClick={exportState} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: showExport ? "#bf616a" : "#7889a0" }} title="Export teams">{showExport ? "✕ Export" : "💾"}</button>}
            {teamsOpen && teamLeagueFilter === "Custom" && <button onClick={() => setShowBulk(!showBulk)} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: showBulk ? "#bf616a" : "#7889a0" }}>{showBulk ? "✕ Close" : "📂"}</button>}
            {teamsOpen && teamLeagueFilter === "Custom" && <button onClick={addTeam} style={addBtn}>+ Add</button>}
          </div>
        </div>
        {teamsOpen && (<>
        {showExport && (<div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}><p style={{ fontSize: 10, color: "#7889a0", margin: "0 0 8px" }}>Copy this text and paste into Bulk Import to restore teams.</p><textarea readOnly value={exportTeamsText()} rows={10} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.7, fontSize: 9 }} onClick={e => e.target.select()} /><div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => { navigator.clipboard?.writeText(exportTeamsText()); setShowExport(false); }} style={{ ...addBtn, background: "#e4002b", color: "#ffffff", border: "none", padding: "6px 16px" }}>Copy to Clipboard</button></div></div>)}
        {showBulk && (<div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}><p style={{ fontSize: 10, color: "#7889a0", margin: "0 0 8px" }}>Tab-separated: CODE ⇥ NATION ⇥ SKILL ⇥ PLAYSTYLE ⇥ FORMATION ⇥ APPROACH ⇥ PASSING ⇥ CHANCES ⇥ DRIBBLING ⇥ CREATIVITY ⇥ SET PIECES ⇥ TIME WASTING ⇥ POS. LOST ⇥ POS. WON ⇥ GK PASSING ⇥ PRESSING ⇥ DEF. LINE ⇥ DL BEHAVIOR ⇥ TACKLING ⇥ #1 ⇥ #2 ⇥ #3 ⇥ #4 ⇥ #5 ⇥ #6 ⇥ #7 ⇥ #8 ⇥ #9 ⇥ #10 ⇥ #11 ⇥ #12 ⇥ #13 ⇥ #14 ⇥ #15 ⇥ #16 ⇥ HOME COLOR ⇥ AWAY COLOR ⇥ LOCATION ⇥ STADIUM</p><textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"ARV\tArverne\t87\tBalanced\t4-2-3-1\tInto Space\tMore Direct\nNichirin\t86\tWing Play\t4-4-2\nPON\tPonurvia\t74"} rows={10} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.7 }} /><div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={importBulk} style={{ ...addBtn, background: "#e4002b", color: "#ffffff", border: "none", padding: "6px 16px" }}>Import {(()=>{const n=parseBulk(bulkText).length;return n>0?`(${n})`:""})()}</button><span style={{ fontSize: 10, color: "#7889a0" }}>Merges into the roster as Custom teams</span></div></div>)}
        <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderBottom: "1px solid #2a3a50" }}>
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {[["name","Name"],["code","Code"],["skill","Skill"]].map(([k,l]) => { const active = teamSort?.key === k; const dir = active ? teamSort.dir : null; return (
                <button key={k} onClick={() => {
                  const newDir = active ? (dir === "desc" ? "asc" : "desc") : (k === "skill" ? "desc" : "asc");
                  setTeamSort({ key: k, dir: newDir });
                  setTeams(ts => [...ts].sort((a, b) => {
                    let d = 0;
                    if (k === "skill") d = (a.skill||0) - (b.skill||0);
                    else if (k === "name") d = (a.name||"").localeCompare(b.name||"");
                    else d = (a.code||abbr(a.name,a.code)||"").localeCompare(b.code||abbr(b.name,b.code)||"");
                    return newDir === "desc" ? -d : d;
                  }));
                }} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid " + (active ? "#e4002b" : "#7889a033"), background: active ? "#e4002b22" : "transparent", color: active ? "#e4002b" : "#7889a0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, letterSpacing: "0.08em" }}>{l} {active ? (dir === "asc" ? "↑" : "↓") : ""}</button>
              ); })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "10px 12px 8px", borderBottom: "1px solid #2a3a50", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7889a0" }}>
            <span style={{ width: TEAM_COLW.num, flexShrink: 0 }} /><span style={{ width: TEAM_COLW.crest, flexShrink: 0 }} /><span style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>Name</span><span style={{ width: TEAM_COLW.code, textAlign: "center", flexShrink: 0 }}>Code</span><span style={{ width: TEAM_COLW.skill, textAlign: "center", flexShrink: 0 }}>Skill</span><span style={{ width: TEAM_COLW.sq, textAlign: "center", flexShrink: 0, paddingRight: 6 }}>SQ</span><span style={{ width: TEAM_COLW.tac, textAlign: "center", flexShrink: 0, paddingRight: 6 }}>TAC</span><span style={{ width: TEAM_COLW.inf, textAlign: "center", flexShrink: 0, paddingRight: 6 }}>INF</span>{teamsFiltered.some(t => t.league === "Custom") && <span style={{ width: TEAM_COLW.del, flexShrink: 0 }} />}
          </div>
          {(() => { const visibleTeams = teamsFiltered; return (
          <div style={{ maxHeight: visibleTeams.length > 12 ? 520 : "none", overflowY: visibleTeams.length > 12 ? "auto" : "visible", ...(lmMatch && lmMatch.phase !== 'pre_match' && lmMatch.phase !== 'finished' ? { opacity: 0.6, pointerEvents: "none" } : {}) }}>
            {visibleTeams.map((t, i) => { const badSkill = t.skill === "" || t.skill < 25 || t.skill > 100; const exp = expandedTeam === t.id; const strat = t.strategy || STRAT_DEF; const nonDefault = Object.entries(strat).filter(([,v]) => v !== 0).length; return (
              <div key={t.id}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 12px", background: exp ? "#141c2b" : i % 2 === 0 ? "transparent" : "#141c2b08", cursor: "pointer" }} onClick={() => { if (lmMatch && lmMatch.phase !== 'pre_match' && lmMatch.phase !== 'finished') return; setExpandedTeam(exp ? null : t.id); if (!exp) setViewSquad(null); }}>
                <span style={{ color: "#7889a0", fontSize: 10, width: TEAM_COLW.num, textAlign: "right", flexShrink: 0, ...mono }}>{i + 1}</span>
                <TeamCrest team={t} size={18} style={{ marginLeft: 8 }} />
                <input value={t.name} onClick={e => e.stopPropagation()} onChange={e => updateTeam(t.id, "name", e.target.value)} style={{ ...inp, flex: 1, minWidth: 0, padding: "5px 8px", border: "1px solid transparent", background: "transparent", fontSize: 13 }} onFocus={e => { e.target.style.borderColor = "#7889a0"; e.target.style.background = "#141c2b"; }} onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
                <input value={t.code ?? abbr(t.name, t.code)} onClick={e => e.stopPropagation()} onChange={e => {
                  const v = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
                  if (v && teams.some(o => o.id !== t.id && (o.code || abbr(o.name, o.code)) === v)) {
                    setDupCodeId(t.id); setTimeout(() => setDupCodeId(id => id === t.id ? null : id), 1500); return;
                  }
                  updateTeam(t.id, "code", v);
                }} style={{ ...inp, width: TEAM_COLW.code, textAlign: "center", padding: "5px 4px", border: "1px solid transparent", background: "transparent", fontSize: 11, letterSpacing: "0.08em", color: t.code ? "#ffffff" : "#7889a0", borderColor: dupCodeId === t.id ? "#bf616a" : "transparent" }} placeholder={abbr(t.name, t.code)} title={dupCodeId === t.id ? "Code already in use" : undefined} onFocus={e => { if (dupCodeId !== t.id) { e.target.style.borderColor = "#7889a0"; e.target.style.background = "#141c2b"; } }} onBlur={e => { if (dupCodeId !== t.id) { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; } }} />
                <input type="number" value={t.skill} onClick={e => e.stopPropagation()} onChange={e => updateTeam(t.id, "skill", e.target.value)} style={{ ...inp, width: TEAM_COLW.skill, textAlign: "center", padding: "5px 4px", border: "1px solid transparent", background: "transparent", borderColor: badSkill ? "#bf616a" : "transparent" }} onFocus={e => { if (!badSkill) { e.target.style.borderColor = "#7889a0"; e.target.style.background = "#141c2b"; } }} onBlur={e => { if (!badSkill) { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; } }} />
                <span onClick={e => { e.stopPropagation(); if (lmMatch && lmMatch.phase !== 'pre_match' && lmMatch.phase !== 'finished') return; setViewSquad(viewSquad === t.id ? null : t.id); setExpandedTeam(null); }} style={{ width: TEAM_COLW.sq, textAlign: "center", fontSize: 9, color: viewSquad === t.id ? "#e4002b" : t.squad?.some(p => !p.name.startsWith("#")) ? "#7889a0" : "#7889a066", flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600, letterSpacing: "0.04em", border: "1px solid " + (viewSquad === t.id ? "#e4002b" : t.squad?.some(p => !p.name.startsWith("#")) ? "#7889a033" : "transparent"), borderRadius: 4, padding: "2px 0", background: viewSquad === t.id ? "#7889a022" : "transparent" }}>{viewSquad === t.id ? "▾" : t.squad?.some(p => !p.name.startsWith("#")) ? t.squad.filter(p => !p.name.startsWith("#")).length : "–"}</span>
                <span style={{ width: TEAM_COLW.tac, textAlign: "center", fontSize: 9, color: exp ? "#e4002b" : nonDefault > 0 ? "#7889a0" : "#7889a066", flexShrink: 0, whiteSpace: "nowrap", fontWeight: 600, border: "1px solid " + (exp ? "#e4002b" : nonDefault > 0 ? "#7889a033" : "transparent"), borderRadius: 4, padding: "2px 0", background: exp ? "#7889a022" : "transparent" }}>{exp ? "\u25BE" : nonDefault > 0 ? nonDefault : "\u2013"}</span>
                {(() => { const hasInf = [t.city, t.stadium].filter(Boolean).length; const infOpen = viewInfo === t.id; return <span onClick={e => { e.stopPropagation(); setViewInfo(infOpen ? null : t.id); setViewSquad(null); setExpandedTeam(null); }} style={{ width: TEAM_COLW.inf, textAlign: "center", fontSize: 9, color: infOpen ? "#e4002b" : hasInf ? "#7889a0" : "#7889a066", flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600, letterSpacing: "0.04em", border: "1px solid " + (infOpen ? "#e4002b" : hasInf ? "#7889a033" : "transparent"), borderRadius: 4, padding: "2px 0", background: infOpen ? "#7889a022" : "transparent" }}>{infOpen ? "\u25BE" : hasInf ? hasInf : "\u2013"}</span>; })()}
                {t.league === "Custom" && <button onClick={e => { e.stopPropagation(); removeTeam(t.id); }} style={{ ...delBtn, width: TEAM_COLW.del, opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>×</button>}
              </div>
              {viewInfo === t.id && <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: "6px 8px", alignItems: "center", fontSize: 10 }}>
                  <span style={{ color: "#7889a0", fontWeight: 600 }}>Colors</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="color" value={t.primaryColor || "#81a1c1"} onChange={e => updateTeam(t.id, "primaryColor", e.target.value)} style={{ width: 22, height: 22, border: "1px solid #2a3a50", borderRadius: 3, cursor: "pointer" }} />
                    <span style={{ color: "#7889a066", fontSize: 9 }}>H</span>
                    <input type="color" value={t.secondaryColor || t.primaryColor || "#141c2b"} onChange={e => updateTeam(t.id, "secondaryColor", e.target.value)} style={{ width: 22, height: 22, border: "1px solid #2a3a50", borderRadius: 3, cursor: "pointer" }} />
                    <span style={{ color: "#7889a066", fontSize: 9 }}>A</span>
                  </div>
                  <span style={{ color: "#7889a0", fontWeight: 600 }}>Stadium</span>
                  <input value={t.stadium || ""} onChange={e => updateTeam(t.id, "stadium", e.target.value || null)} placeholder="–" style={{ ...inp, padding: "4px 6px", border: "1px solid #2a3a50", background: "#0d1117", fontSize: 10, width: "100%" }} />
                  <span style={{ color: "#7889a0", fontWeight: 600 }}>City</span>
                  <input value={t.city || ""} onChange={e => updateTeam(t.id, "city", e.target.value || null)} placeholder="–" style={{ ...inp, padding: "4px 6px", border: "1px solid #2a3a50", background: "#0d1117", fontSize: 10, width: "100%" }} />
                </div>
              </div>}
              {viewSquad === t.id && !(lmMatch && lmMatch.phase && lmMatch.phase !== "pre_match" && lmMatch.phase !== "finished") && (() => {
                const sq = t.squad || buildSquad(t.formation || "4-3-3", null);
                const starters = sq.filter(p => !p.bench);
                const bench = sq.filter(p => p.bench);
                // Formation pitch positions: parse formation, distribute layers vertically
                const FPOS2 = {
                  "4-4-2":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[12,52],[37.3,54],[62.7,54],[88,52],[38,28],[62,28]],
                  "4-3-3":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[28,52],[50,50],[72,52],[15,24],[50,20],[85,24]],
                  "4-2-3-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[39,56],[61,56],[18,36],[50,32],[82,36],[50,14]],
                  "4-1-4-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[50,56],[14,38],[38,40],[62,40],[86,38],[50,18]],
                  "4-1-2-1-2":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[50,58],[39,44],[61,44],[50,30],[39,16],[61,16]],
                  "4-3-2-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[28,54],[50,52],[72,54],[38,32],[62,32],[50,14]],
                  "4-2-4":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[39,54],[61,54],[14,26],[38,22],[62,22],[86,26]],
                  "3-4-3":[[50,93],[28,76],[50,78],[72,76],[12,52],[37.3,54],[62.7,54],[88,52],[18,24],[50,20],[82,24]],
                  "3-5-2":[[50,93],[28,76],[50,78],[72,76],[9,50],[29.5,52],[50,48],[70.5,52],[91,50],[39,22],[61,22]],
                  "3-4-1-2":[[50,93],[28,76],[50,78],[72,76],[12,54],[37.3,56],[62.7,56],[88,54],[50,34],[39,16],[61,16]],
                  "5-3-2":[[50,93],[9,68],[28,76],[50,78],[72,76],[91,68],[28,48],[50,46],[72,48],[39,22],[61,22]],
                };
                const pitchPosRaw = FPOS2[t.formation] || (() => {
                  const layers = (t.formation||"4-3-3").split("-").map(Number);
                  const nR=layers.length+1,yT=12,yB=92,rG=(yB-yT)/(nR-1);
                  const pts=[[50,yB]];
                  // Keep adjacent dots at least 22 units apart so player-name labels never overlap.
                  layers.forEach((c,li)=>{const y=yB-(li+1)*rG;const hs=c<=1?0:Math.max(38,11*(c-1));const lo=50-hs;const gap=c<=1?0:(2*hs)/(c-1);for(let j=0;j<c;j++){pts.push([c===1?50:lo+j*gap,y]);}});
                  return pts;
                })();
                const pitchPos = pitchPosRaw.map(p => Array.isArray(p) ? {x:p[0],y:p[1]} : p);
                const lpos = pitchPos.map(p => ({ x: 6 + (1 - (p.y - 2) / 101) * 138, y: 6 + (p.x / 100) * 48 }));
                return (<div onClick={() => setViewSquad(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 12, padding: "20px 24px", width: "90vw", maxWidth: 880, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px #00000066" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #2a3a50" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#7889a0" }}>SQUAD</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>{t.name}</span>
                      <span style={{ fontSize: 10, color: FORM_CLR[t.formation || "4-3-3"] || "#7889a0", fontWeight: 600, ...mono }}>{t.formation || "4-3-3"}</span>
                      <span style={{ fontSize: 9, color: STYLE_CLR[t.style || "balanced"], fontWeight: 600 }}>{STYLE_LBL[t.style || "balanced"]}</span>
                    </div>
                    <span onClick={() => setViewSquad(null)} style={{ cursor: "pointer", color: "#7889a0", fontSize: 14, fontWeight: 700, lineHeight: 1, padding: "2px 6px" }}>✕</span>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    <svg viewBox="0 0 150 60" style={{ width: "100%", height: "auto", marginBottom: 16 }}>
                      <rect x="2" y="2" width="146" height="56" fill="#060b14" stroke="#7889a044" strokeWidth="0.8" rx="1.5" />
                      <line x1="75" y1="2" x2="75" y2="58" stroke="#7889a044" strokeWidth="0.6" />
                      <circle cx="75" cy="30" r="7" fill="none" stroke="#7889a044" strokeWidth="0.6" />
                      <circle cx="75" cy="30" r="0.5" fill="#7889a044" />
                      <rect x="2" y="12" width="16" height="36" fill="none" stroke="#7889a044" strokeWidth="0.6" />
                      <rect x="2" y="19" width="7" height="22" fill="none" stroke="#7889a033" strokeWidth="0.4" />
                      <rect x="132" y="12" width="16" height="36" fill="none" stroke="#7889a044" strokeWidth="0.6" />
                      <rect x="141" y="19" width="7" height="22" fill="none" stroke="#7889a033" strokeWidth="0.4" />
                      {starters.map((p, pi2) => {
                        const pos = lpos[pi2];
                        if (!pos) return null;
                        return (<g key={pi2}>
                          <circle cx={pos.x} cy={pos.y} r="2.2" fill={POS_CLR[p.pos]||"#888"} opacity="0.9" stroke="#060b14" strokeWidth="0.4" />
                          <text x={pos.x} y={pos.y - 3.6} textAnchor="middle" fill="#ffffff" fontSize="2.1" fontFamily="monospace" fontWeight="500">{shortName(p.name)}</text>
                        </g>);
                      })}
                    </svg>
                    <div style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6 }}>STARTING XI</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1px 10px", marginBottom: 10 }}>
                    {starters.map((p, pi) => (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 0" }}>
                        <span style={{ fontSize: 7, color: POS_CLR[p.pos], fontWeight: 700, width: 20, ...mono }}>{p.pos}</span>
                        <input value={p.name} onClick={e => e.stopPropagation()} onChange={e => {
                          const ns = [...sq]; ns[pi] = {...ns[pi], name: e.target.value};
                          updateTeam(t.id, "squad", ns);
                        }} style={{ ...inp, flex: 1, minWidth: 0, padding: "2px 4px", fontSize: 10, border: "1px solid transparent", background: "transparent" }}
                        onFocus={e => { e.target.style.borderColor = "#7889a0"; e.target.style.background = "#0a0e17"; }}
                        onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
                        <span onClick={e => { e.stopPropagation(); const ns = [...sq]; ns[pi] = {...ns[pi], tier: ((p.tier||0)+1)%3}; updateTeam(t.id, "squad", ns); }}
                          style={{ cursor: "pointer", width: 12, textAlign: "center", fontSize: 10, flexShrink: 0, color: p.tier===2?"#e4002b":p.tier===1?"#5b8fa8":"#7889a0", fontWeight: 700, userSelect: "none" }}
                          title={p.tier===2?"Star → Average":p.tier===1?"Above Average → Star":"Average → Above Average"}>{p.tier===2?"★":p.tier===1?"+":"·"}</span>
                      </div>
                    ))}
                    </div>
                    <div style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingTop: 6 }}>BENCH</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1px 10px" }}>
                    {bench.map((p, pi) => (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 0" }}>
                        <span style={{ fontSize: 7, color: POS_CLR[p.pos], fontWeight: 700, width: 20, ...mono }}>{p.pos}</span>
                        <input value={p.name} onClick={e => e.stopPropagation()} onChange={e => {
                          const ns = [...sq]; ns[11 + pi] = {...ns[11+pi], name: e.target.value};
                          updateTeam(t.id, "squad", ns);
                        }} style={{ ...inp, flex: 1, minWidth: 0, padding: "2px 4px", fontSize: 10, border: "1px solid transparent", background: "transparent", color: "#7889a0" }}
                        onFocus={e => { e.target.style.borderColor = "#7889a0"; e.target.style.background = "#0a0e17"; }}
                        onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
                        <span onClick={e => { e.stopPropagation(); const ns = [...sq]; ns[11+pi] = {...ns[11+pi], tier: ((p.tier||0)+1)%3}; updateTeam(t.id, "squad", ns); }}
                          style={{ cursor: "pointer", width: 12, textAlign: "center", fontSize: 10, flexShrink: 0, color: p.tier===2?"#e4002b":p.tier===1?"#5b8fa8":"#7889a0", fontWeight: 700, userSelect: "none" }}
                          title={p.tier===2?"Star → Average":p.tier===1?"Above Average → Star":"Average → Above Average"}>{p.tier===2?"★":p.tier===1?"+":"·"}</span>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
                </div>);
              })()}
                            {exp && !(lmMatch && lmMatch.phase && lmMatch.phase !== "pre_match" && lmMatch.phase !== "finished") && (
                <div onClick={() => setExpandedTeam(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 12, padding: "20px 24px", minWidth: 340, maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px #00000066" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #2a3a50" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#7889a0" }}>TACTICS</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>{t.name}</span>
                    </div>
                    <span onClick={() => setExpandedTeam(null)} style={{ cursor: "pointer", color: "#7889a0", fontSize: 14, fontWeight: 700, lineHeight: 1, padding: "2px 6px" }}>✕</span>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 4 }}>STYLE</div>
                    <select value={t.style || "balanced"} onChange={e => updateTeam(t.id, "style", e.target.value)} style={{ ...inp, width: "100%", fontSize: 12, padding: "5px 6px", cursor: "pointer", color: STYLE_CLR[t.style || "balanced"] }}>{STYLE_GRP.map(([label, styles]) => <optgroup key={label} label={label}>{styles.map(s => <option key={s} value={s} style={{color:STYLE_CLR[s]}}>{STYLE_LBL[s]}</option>)}</optgroup>)}</select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 4 }}>FORMATION</div>
                    <select value={t.formation || "4-3-3"} onChange={e => updateTeam(t.id, "formation", e.target.value)} style={{ ...inp, width: "100%", fontSize: 12, padding: "5px 6px", cursor: "pointer", color: FORM_CLR[t.formation || "4-3-3"] || "#888" }}>{FORM_GRP.map(([label, forms]) => <optgroup key={label} label={label}>{forms.map(f => <option key={f} value={f} style={{color:FORM_CLR[f]}}>{f}</option>)}</optgroup>)}</select>
                  </div>
                </div>
                {(()=>{ let lastGrp = ""; return Object.entries(STRAT_LABELS).map(([key, {name, vals, grp}]) => {
                  const hdr = grp !== lastGrp; lastGrp = grp;
                  return (<div key={key}>{hdr && <div style={{ fontSize: 8, color: "#7889a0", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 10, marginBottom: 4 }}>{grp === "possession" ? "IN POSSESSION" : grp === "transition" ? "TRANSITION" : "DEFENSE"}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "#7889a0", width: 60, flexShrink: 0 }}>{name}</span>
                    <select value={strat[key] ?? 0} onChange={e => { const ns = {...(t.strategy || STRAT_DEF), [key]: +e.target.value}; updateTeam(t.id, "strategy", ns); }} style={{ ...inp, fontSize: 11, padding: "3px 6px", flex: 1, minWidth: 0, color: (strat[key] ?? 0) === 0 ? "#7889a0" : (strat[key] ?? 0) > 0 ? "#d08770" : "#81a1c1" }}>
                      {vals.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div></div>);
                }); })()}
                  </div>
                </div>
                </div>)}
              </div>); })}
          </div>
          ); })()}
          {teamErrors && <div style={{ fontSize: 10, color: "#bf616a", padding: "6px 12px", borderTop: "1px solid #2a3a50" }}>Skill values must be between 25 and 100.</div>}
        </div>
        </>)}

        {/* ═══ LIVE MATCH TAB ═══ */}
        {tab === "live" && (<div>
          {/* Unified match controls — always at top */}
          <div style={{ marginBottom: 12 }}>
            {(() => {
              const finished = lmMatch?.phase === "finished";
              // Tournament fixtures have no "New Match" escape hatch — Import/Replay/Abandon
              // are the only way out, so tReplayCounts can't be bypassed by resetting around them.
              if (finished && tLiveTarget) return (
                <div style={{ background: "#81a1c122", border: "1px solid #81a1c144", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                    {lastLiveResult && <span style={{ fontSize: 10, color: "#81a1c1" }}>⚽ {lastLiveResult.homeName} {lastLiveResult.homeScore}–{lastLiveResult.awayScore} {lastLiveResult.awayName}{lastLiveResult.penalties ? " ("+lastLiveResult.penalties.homeScore+"–"+lastLiveResult.penalties.awayScore+" pen)" : ""}</span>}
                    <button onClick={() => { importLiveToMatch(tLiveTarget); setTLiveTarget(null); setTab("tournament"); }} style={{ background: "#e4002b", border: "none", borderRadius: 4, color: "#ffffff", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Import to Tournament</button>
                    <button onClick={() => { setLastLiveResult(null); tPlayLive({...tLiveTarget}); }} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 4, color: "#81a1c1", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Replay</button>
                    <button onClick={() => { setTLiveTarget(null); setLmMatch(null); setTab("tournament"); }} style={{ background: "none", border: "1px solid #bf616a66", borderRadius: 4, color: "#bf616a", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Abandon</button>
                  </div>
                </div>
              );
              const primaryLabel = lmIsSetup ? "⚽ Start Match" : finished ? "New Match" : lmBl;
              const primaryClick = lmIsSetup ? lmKickOff : finished ? lmReset : () => { if (autoPlay) setAutoPlay(false); else lmTick(); };
              const lmNotReady = teamErrors || teams.length < 2 || !teamById(lmH) || !teamById(lmA);
              const primaryDisabled = lmIsSetup ? lmNotReady : (!finished && autoPlay);
              const autoClick = () => { if (autoPlay) { setAutoPlay(false); return; } if (lmIsSetup) { lmKickOff(); setAutoPlay(true); } else setAutoPlay(true); };
              return primaryLabel ? (<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={primaryClick} disabled={primaryDisabled} className="tick-btn" style={{ ...scBtn, fontSize: 14, opacity: primaryDisabled ? (lmIsSetup ? 0.4 : 0.5) : 1, cursor: primaryDisabled ? "default" : "pointer" }}>{primaryLabel}</button>
                {!finished && <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={autoClick} disabled={lmIsSetup && lmNotReady} className="tick-btn" style={{ ...scBtn, flex: 1, fontSize: 11, padding: "10px 14px", background: autoPlay ? "linear-gradient(135deg, #bf616a 0%, #a04050 100%)" : "#e4002b", opacity: lmIsSetup && lmNotReady ? 0.4 : 1, cursor: lmIsSetup && lmNotReady ? "default" : "pointer" }}>{autoPlay ? "⏸ Pause" : "⏵ Auto"}</button>
                  <button onClick={lmSimAll} disabled={lmIsSetup && lmNotReady} className="tick-btn" style={{ ...scBtn, flex: 1, fontSize: 11, padding: "10px 14px", opacity: lmIsSetup && lmNotReady ? 0.4 : 1, cursor: lmIsSetup && lmNotReady ? "default" : "pointer" }}>⏩ Sim to End</button>
                </div>}
                {autoPlay && <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  {[{l:"1x",v:1500},{l:"2x",v:750},{l:"5x",v:300},{l:"10x",v:150}].map(s => (
                    <button key={s.v} onClick={() => setAutoSpeed(s.v)} className={autoSpeed === s.v ? "gbtn" : ""} style={{ background: autoSpeed === s.v ? "#e4002b" : "#141c2b", border: "1px solid " + (autoSpeed === s.v ? "#e4002b" : "#7889a033"), borderRadius: 4, padding: "3px 10px", fontSize: 9, fontWeight: 600, color: autoSpeed === s.v ? "#ffffff" : "#7889a0", cursor: "pointer", fontFamily: "inherit" }}>{s.l}</button>
                  ))}
                </div>}
              </div>) : null;
            })()}
          </div>
          {lmIsSetup && (<div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 22, marginBottom: 24, boxShadow: "0 2px 12px #00000022" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                <select value={lmH} onChange={e => { setLmH(e.target.value); setLmMatch(null); }} style={{ ...inp, width: "100%", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>{groupByLeague(teams).map((entry, gi) => entry === null ? <optgroup key={"div"+gi} label="───" /> : <optgroup key={entry[0]} label={entry[0]}>{entry[1].map(t => <option key={t.id} value={t.id}>{t.name} ({t.skill})</option>)}</optgroup>)}</select>
                <span style={{ fontSize: 12, color: "#7889a0", letterSpacing: "0.2em", fontWeight: 700, ...ui }}>VS</span>
                <select value={lmA} onChange={e => { setLmA(e.target.value); setLmMatch(null); }} style={{ ...inp, width: "100%", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>{groupByLeague(teams).map((entry, gi) => entry === null ? <optgroup key={"div"+gi} label="───" /> : <optgroup key={entry[0]} label={entry[0]}>{entry[1].map(t => <option key={t.id} value={t.id}>{t.name} ({t.skill})</option>)}</optgroup>)}</select>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #2a3a50", paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {[[lmForce, e => setLmForce(e), "Force Result", "ET + Penalties"], [lmAllowTac, e => setLmAllowTac(e), "Auto Tempo", "AI manages tempo"], [lmAutoSubs, e => setLmAutoSubs(e), "Auto Subs", "AI manages subs"], [lmStopOnEvents, e => setLmStopOnEvents(e), "Auto-Play Stops on Events", "Pause on goals, pens, reds"]].map(([checked, onChange, label, sub], i) => (
                  <label key={i} onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0" }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#e4002b" : "#141c2b66", border: "1px solid " + (checked ? "#e4002b" : "#7889a033"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#141c2b" : "#7889a066", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: checked ? "#e4002b" : "#7889a0", fontWeight: 500, lineHeight: 1.2 }}>{label}</div>
                      <div style={{ fontSize: 9, color: "#7889a0", lineHeight: 1.2 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2a3a50" }}>
                <div style={{ fontSize: 10, color: "#7889a0", marginBottom: 8, fontWeight: 600, letterSpacing: "0.08em", textAlign: "center" }}>HOME ADVANTAGE</div>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #2a3a50" }}>
                  {[["home", teamById(lmH)?.name || "Home"], [null, "Neutral"], ["away", teamById(lmA)?.name || "Away"]].map(([val, label]) => (
                    <button key={label} onClick={() => setLmHomeAdv(val)} className={lmHomeAdv === val ? "gbtn" : ""} style={{ flex: 1, padding: "8px 6px", background: lmHomeAdv === val ? "#e4002b" : "transparent", color: lmHomeAdv === val ? "#ffffff" : "#7889a0", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: lmHomeAdv === val ? 600 : 400, transition: "all 0.15s", borderRight: val !== "away" ? "1px solid #7889a033" : "none" }}>{label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "#7889a0", textAlign: "center", marginTop: 4 }}>{lmHomeAdv ? "+3% skill bonus" : "No advantage"}</div>
                {lmHomeAdv === null && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input value={lmNeutralVenueName} onChange={e => setLmNeutralVenueName(e.target.value)} placeholder="Neutral Venue Name (Optional)" style={{ ...inp, flex: 1, padding: "6px 8px", fontSize: 11 }} />
                  <input value={lmNeutralVenueLoc} onChange={e => setLmNeutralVenueLoc(e.target.value)} placeholder="Neutral Location (Optional)" style={{ ...inp, flex: 1, padding: "6px 8px", fontSize: 11 }} />
                </div>}
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2a3a50" }}>
                <div style={{ fontSize: 10, color: "#7889a0", marginBottom: 8, fontWeight: 600, letterSpacing: "0.08em", textAlign: "center" }}>AGGREGATE SCORING</div>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #2a3a50" }}>
                  {[[false, "Off"], [true, "2nd Leg"]].map(([val, label]) => (
                    <button key={label} onClick={() => { setLm2ndLeg(val); if (!val) setLmStartScore([0, 0]); }} className={lm2ndLeg === val ? "gbtn" : ""} style={{ flex: 1, padding: "8px 6px", background: lm2ndLeg === val ? "#e4002b" : "transparent", color: lm2ndLeg === val ? "#ffffff" : "#7889a0", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: lm2ndLeg === val ? 600 : 400, transition: "all 0.15s", borderRight: !val ? "1px solid #7889a033" : "none" }}>{label}</button>
                  ))}
                </div>
                {lm2ndLeg && <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: "#7889a0", textAlign: "center", marginBottom: 6 }}>1st leg result</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 6, padding: "8px 12px" }}>
                    <span style={{ fontSize: 11, color: "#888", flex: 1, textAlign: "right" }}>{teamById(lmH)?.name}</span>
                    <input type="number" min="0" max="99" value={lmStartScore[0]} onChange={e => setLmStartScore(s => [Math.max(0, +e.target.value || 0), s[1]])} style={{ ...inp, width: 44, padding: "6px 4px", fontSize: 16, textAlign: "center", fontWeight: 600, ...mono }} />
                    <span style={{ color: "#7889a0", fontSize: 14 }}>–</span>
                    <input type="number" min="0" max="99" value={lmStartScore[1]} onChange={e => setLmStartScore(s => [s[0], Math.max(0, +e.target.value || 0)])} style={{ ...inp, width: 44, padding: "6px 4px", fontSize: 16, textAlign: "center", fontWeight: 600, ...mono }} />
                    <span style={{ fontSize: 11, color: "#888", flex: 1 }}>{teamById(lmA)?.name}</span>
                  </div>
                </div>}
                {!lm2ndLeg && <div style={{ fontSize: 9, color: "#7889a0", textAlign: "center", marginTop: 4 }}>Single match</div>}
              </div>
            </div>
            {teams.length < 2 && <div style={{ fontSize: 10, color: "#bf616a", marginBottom: 12 }}>Need at least 2 teams to play.</div>}
            {teamErrors && <div style={{ fontSize: 10, color: "#bf616a", marginBottom: 12 }}>Fix skill values (25–100) before playing.</div>}
          </div>)}
          {lmMatch && (<>
            {renderScoreboard()}
            {lmMatch.phase !== "finished" && lmMatch.phase !== "penalties" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", boxSizing: "border-box" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: hClr, width: 36, textAlign: "center", flexShrink: 0, ...mono }}>{abbr(teamById(lmH)?.name, teamById(lmH)?.code)}</span>
                  <div style={{ display: "flex", flex: 1, gap: 2 }}>
                    {["BOX","HLF","MID","HLF","BOX"].map((label, z) => {
                      const active = lmMatch.ball === z;
                      const clr = lmMatch.possession === "home" ? hClr : aClr;
                      return <div key={z} style={{ flex: 1, height: 24, background: active ? clr + "30" : "#141c2b", border: `1px solid ${active ? clr : "#2a3a50"}`, borderRadius: 4, transition: "all 0.3s", boxShadow: active ? `0 0 10px ${clr}33` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: "0.08em", color: active ? clr : "#7889a066", ...mono }}>{label}</span>
                      </div>;
                    })}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: aClr, width: 36, textAlign: "center", flexShrink: 0, ...mono }}>{abbr(teamById(lmA)?.name, teamById(lmA)?.code)}</span>
                </div>
              </div>
            )}
            {lmMatch.phase === "finished" && renderStatsReport()}
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 18px", borderBottom: "1px solid #141c2b", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7889a0", textAlign: "center" }}>Match Events</div>
              <div ref={lmFeedRef} style={{ padding: "10px 0", maxHeight: lmMatch.events.some(e => e.goalViz && e.type === "goal") ? 290 : 220, overflowY: "auto" }}>
              {(()=>{ const hN=teamById(lmH)?.name, aN=teamById(lmA)?.name, hC=teamById(lmH)?.code, aC=teamById(lmA)?.code;
                const tBadge = (isH) => (<div style={{ width: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ padding: "2px 6px", borderRadius: 4, background: (isH ? hClr : aClr) + "22", fontSize: 8, fontWeight: 700, color: isH ? hClr : aClr, border: "1px solid " + (isH ? hClr : aClr) + "33", letterSpacing: "0.05em", ...mono }}>{isH ? hC : aC}</div>
                </div>);
                const mC = (min) => (<div style={{ width: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#7889a0", ...mono }}>{min}'</span>
                </div>);
                const iC = (content, sz) => (<div style={{ width: 30, minWidth: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: sz || 14 }}>{content || " "}</div>);
                const parseSub = (txt) => { const s = txt.replace(/^(?:🔄|⇄)\s*/, '').split(/\s*→\s*/); if (s.length < 2) return null; const tm = s[0].match(/^(.+?)'s\s+(.+)$/); const rm = s[1].match(/^(.+?)\.\s+(.+?)\.?$/); return { team: tm?.[1]||"", off: tm?.[2]||s[0], on: rm?.[1]||s[1].replace(/\.\s*$/,""), reason: rm?.[2]||"" }; };
                // gvGoalMouth viewBox is 220x136 at up to 190px wide; the goal frame itself
                // spans gT=10 to gB=82 (72 units), excluding the grass strip beneath it.
                const GV_FRAME_H = Math.round(72 * 190 / 220);
                // gvPitch viewBox is 206x142 at up to 280px wide. Sizing the button so its
                // bottom edge lands on the pitch view's bottom edge (mouth height + gap + button).
                const GV_STACKED_BTN_H = Math.round(280 * 142 / 206) - Math.round(190 * 136 / 220) - 16;
                const gvReplayBtn = (i, stacked) => (<button onClick={() => setGvReplayKeys(k => ({ ...k, [i]: (k[i]||0) + 1 }))} style={{ background: "transparent", border: "1px solid #2a3a50", borderRadius: 6, color: "#7889a0", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: stacked ? 0 : "0 14px", width: stacked ? "100%" : "auto", height: stacked ? GV_STACKED_BTN_H : GV_FRAME_H, flexShrink: 0 }}><span style={{ fontSize: 11 }}>⟲</span> Replay</button>);
                return lmMatch.events.map((e, i) => {
                if (e.type === "phase") return (<div key={i} className="ev-enter" style={{ padding: "8px 18px", textAlign: "center", fontSize: 10, fontWeight: 600, color: "#7889a0", letterSpacing: "0.12em", borderBottom: "1px solid #141c2b" }}>{e.text}</div>);
                const isH = e.team === "home" || (e.type === "sub" && e.text.includes(hN+"'s"));
                const isForcedSub = e.type === "injury" && e.text.includes("Forced substitution");
                const T1 = new Set(["goal","penalty","red","second_yellow","sub","pen_miss"]);
                if (T1.has(e.type) || isForcedSub) {
                  let icon, header, headerColor, body, bg;
                  if (e.type === "goal") { icon = <span>⚽</span>; header = "GOAL!"; headerColor = "#ffffff"; const goalClr = isH ? hClr : aClr; const gt = e.text.replace(/^[^\p{L}\p{N}]+/u, ''); const styledGoal = (txt) => { const parts = []; let rest = txt; const scorerMatch = rest.match(/^(.+?\.\s*)(.+?)(\s*\([A-Z]+\)\s*)/); if (scorerMatch) { parts.push(scorerMatch[1]); parts.push(<span key="s" style={{ fontWeight: 700, color: goalClr }}>{scorerMatch[2]}</span>); parts.push(scorerMatch[3]); rest = rest.slice(scorerMatch[0].length); } const astMatch = rest.match(/(.*?Assisted by\s*)(.+?)(\s*\([A-Z]+\)\.?)$/); if (astMatch) { parts.push(astMatch[1]); parts.push(<span key="a" style={{ fontWeight: 700, color: goalClr }}>{astMatch[2]}</span>); parts.push(astMatch[3]); } else { parts.push(rest); } return parts; }; body = <div style={{ fontSize: 11, color: "#7889a0", lineHeight: 1.5 }}>{styledGoal(gt)}</div>; if (e.goalViz) { const gv = e.goalViz; const hasPitch = !!gv.shotFrom && gv.method !== "pen"; const mDelay = hasPitch ? (gv.assistFrom ? 1.55 : 0.75) : 0.15; const rk = gvReplayKeys[i]||0; body = (<>{body}<div key={"gvrow"+i+"-"+rk} style={{ marginTop: 10, display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>{hasPitch && <div style={{ flex: "8 1 220px", maxWidth: 440, minWidth: 200 }}>{gvPitch(gv, goalClr)}</div>}<div style={{ flex: hasPitch ? "7 1 190px" : "1 1 260px", maxWidth: hasPitch ? 385 : 440, minWidth: 175 }}>{hasPitch ? (<div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 190 }}>{gvGoalMouth(gv, mDelay)}{gvReplayBtn(i, true)}</div>) : (<div style={{ display: "flex", flexDirection: "row", gap: 10, alignItems: "flex-start" }}><div style={{ maxWidth: 190, width: "100%" }}>{gvGoalMouth(gv, mDelay)}</div>{gvReplayBtn(i, false)}</div>)}</div></div></>); } bg = "#ffffff08"; }
                  else if (e.type === "penalty") { icon = <span>🎯</span>; header = "PENALTY!"; headerColor = "#ebcb8b"; body = <div style={{ fontSize: 11, color: "#7889a0", lineHeight: 1.5 }}>{styledPos(e.text.replace(/^[^\p{L}\p{N}]+/u, ''))}</div>; bg = "#ebcb8b08"; }
                  else if (e.type === "red" || e.type === "second_yellow") { icon = <div style={{ width: 10, height: 14, background: "#bf616a", borderRadius: 1.5 }} />; const rcLabels = { dogso: "DOGSO", violent: "Violent conduct", abusive: "Abusive language", sfp: "Serious foul play" }; header = e.type === "second_yellow" ? "Second yellow" : e.rcVariant ? "Red card — " + rcLabels[e.rcVariant] : "Red card"; headerColor = "#bf616a"; body = <div style={{ fontSize: 11, color: "#ffffff" }}>{e.text.replace(/^[^\p{L}\p{N}]+/u, '')}</div>; bg = "#bf616a08"; }
                  else if (e.type === "pen_miss") { icon = <span>❌</span>; header = e.goalViz?.result === "save" ? "Penalty saved" : "Penalty missed"; headerColor = "#bf616a"; body = <div style={{ fontSize: 11, color: "#7889a0" }}>{e.text.replace(/^[^\p{L}\p{N}]+/u, '')}</div>; if (e.goalViz) { const rk = gvReplayKeys[i]||0; body = (<>{body}<div key={"gvrow"+i+"-"+rk} style={{ marginTop: 8, display: "flex", flexDirection: "row", gap: 10, alignItems: "stretch" }}><div style={{ maxWidth: 190, width: "100%", alignSelf: "flex-start" }}>{gvGoalMouth(e.goalViz, 0.15)}</div>{gvReplayBtn(i, false)}</div></>); } bg = "transparent"; }
                  else if (isForcedSub) { icon = <span style={{ fontSize: 13 }}>🏥</span>; header = null; headerColor = null; body = <div style={{ fontSize: 11, color: "#c07070", lineHeight: 1.5 }}>{e.text.replace(/^[^\p{L}\p{N}]+/u, '')}</div>; bg = "transparent"; }
                  else if (e.type === "sub") { const p = (e.onName != null || e.offName != null) ? { on: e.onName, off: e.offName, reason: e.reason } : parseSub(e.text); icon = <span style={{ fontSize: 13 }}>🔄</span>; header = null; headerColor = null; body = p ? (<><div style={{ fontSize: 11, color: "#5e9c6b", display: "flex", alignItems: "center", gap: 4 }}>▲ {p.on}{e.onPos && <span style={{ ...mono, color: POS_CLR[e.onPos] || "#7889a0" }}>{e.onPos}</span>}</div><div style={{ fontSize: 11, color: "#bf616a", display: "flex", alignItems: "center", gap: 4 }}>▼ {p.off}{e.offPos && <span style={{ ...mono, color: POS_CLR[e.offPos] || "#7889a0" }}>{e.offPos}</span>}{e.offRating != null && <span style={{ ...mono, color: ratingColor(e.offRating), fontWeight: 600 }}>({e.offRating.toFixed(1)})</span>}</div>{p.reason && <div style={{ fontSize: 9, color: "#7889a0", marginTop: 1 }}>{p.reason}</div>}</>) : <div style={{ fontSize: 11, color: "#7889a0" }}>{e.text}</div>; bg = "transparent"; }
                  return (<div key={i} className="ev-card" style={{ display: "flex", gap: 0, padding: "9px 0", borderBottom: "1px solid #141c2b", background: bg, alignItems: e.goalViz ? "flex-start" : "center" }}>
                    {mC(e.min)}
                    {iC(icon, 16)}
                    <div style={{ flex: 1, padding: "0 8px" }}>
                      {header && <div style={{ fontSize: 13, fontWeight: 700, color: headerColor, marginBottom: 2 }}>{header}</div>}
                      {body}
                    </div>
                    {tBadge(isH)}
                  </div>);
                }
                const T2 = new Set(["yellow","chance","injury"]);
                if (T2.has(e.type)) {
                  let icon, txt, clr;
                  if (e.type === "yellow") { icon = <div style={{ width: 10, height: 14, background: "#ebcb8b", borderRadius: 1.5 }} />; txt = e.text.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^Yellow\.\s*/, ''); clr = "#7889a0"; }
                  else if (e.type === "chance") { icon = <span>✨</span>; txt = e.text.replace(/^✨\s*/, ''); clr = evColor.chance || "#ffffff"; }
                  else { icon = <span>🏥</span>; txt = e.text.replace(/^[^\p{L}\p{N}]+/u, ''); clr = "#c07070"; }
                  return (<div key={i} className="ev-card" style={{ display: "flex", gap: 0, padding: "5px 0", borderBottom: "1px solid #141c2b", alignItems: "center" }}>
                    {mC(e.min)}
                    {iC(icon, 12)}
                    <div style={{ flex: 1, padding: "0 8px", fontSize: 11, color: clr }}>{txt}</div>
                  </div>);
                }
                const t3Icons = { save: "🧤", miss: "💨", corner: "🏴", foul: "⚠️", woodwork: "🪨", offside: "🚩", counter: "⚡", press: "🔥" };
                return (<div key={i} className="ev-enter" style={{ display: "flex", gap: 0, padding: "3px 0", borderBottom: "1px solid #141c2b", alignItems: "center" }}>
                  {mC(e.min)}
                  {iC(t3Icons[e.type] ? <span>{t3Icons[e.type]}</span> : null, 10)}
                  <div style={{ flex: 1, padding: "0 8px", fontSize: 10, color: evColor[e.type] || "#7889a0", lineHeight: 1.4 }}>{e.text.replace(/^[^\p{L}\p{N}]+/u, '')}</div>
                </div>);
              }); })()}
              {lmMatch.events.length === 0 && <div style={{ padding: "24px 18px", textAlign: "center", color: "#7889a0", fontSize: 11 }}>Awaiting kick off...</div>}
              </div>
            </div>
            {lmMatch.phase !== "finished" && (<>
            <div style={{ display: "flex", gap: 0, marginBottom: 6, background: "#141c2b", borderRadius: 6, padding: 2, border: "1px solid #2a3a50" }}>
              {[["stats","Stats"],["players","Players"],["tactics","Tactics"]].map(([id,label]) => (
                <button key={id} onClick={() => setLmTab(id)} className={lmTab === id ? "gbtn" : ""} style={{ flex: 1, background: lmTab === id ? "#e4002b" : "transparent", border: "none", borderRadius: 4, padding: "5px 0", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: lmTab === id ? "#ffffff" : "#7889a0", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{label}</button>
              ))}
            </div>
            {lmTab === "stats" && <>
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141c2b" , ...ui }}>Match Stats</div>
              {(() => { const ph = lmMatch.possCount.home, pa = lmMatch.possCount.away, pt = ph + pa || 1; const hp = Math.round(ph/pt*100), ap = 100-hp; return (<div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 11 }}>
                  <span style={{ width: 20, textAlign: "right", color: hp >= ap ? hStatClr : "#7889a0", fontWeight: hp >= ap ? 600 : 400 }}>{hp}%</span>
                  <div style={{ flex: 1, margin: "0 4px" }}></div>
                  <span style={{ width: 70, textAlign: "center", color: "#7889a0", fontSize: 9, flexShrink: 0 }}>Possession</span>
                  <div style={{ flex: 1, margin: "0 4px" }}></div>
                  <span style={{ width: 20, textAlign: "left", color: ap > hp ? aStatClr : "#7889a0", fontWeight: ap > hp ? 600 : 400 }}>{ap}%</span>
                </div>
                <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: "#7889a0" }}>
                  <div style={{ width: `${hp}%`, background: hClr, borderRadius: 2, transition: "width 0.3s" }} />
                  <div style={{ width: `${ap}%`, background: aClr, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>); })()}
              {[["xG", Math.round((lmMatch.xG?.home||0)*100)/100, Math.round((lmMatch.xG?.away||0)*100)/100], ["Shots", lmMatch.stats.home.shots, lmMatch.stats.away.shots], ["On Target", lmMatch.stats.home.onTarget, lmMatch.stats.away.onTarget], ["Corners", lmMatch.stats.home.corners, lmMatch.stats.away.corners], ["Fouls", lmMatch.stats.home.fouls, lmMatch.stats.away.fouls], ["Yellows", lmMatch.stats.home.yellows, lmMatch.stats.away.yellows], ["Reds", lmMatch.stats.home.reds, lmMatch.stats.away.reds], ["Injuries", lmMatch.stats.home.injuries, lmMatch.stats.away.injuries], ["Subs Left", 3 - lmMatch.subs.home, 3 - lmMatch.subs.away]].map(([label, h, a], i) => { const mx = Math.max(h, a, 1); return (<div key={i} style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 11 }}>
                <span style={{ width: 24, textAlign: "right", color: h > a ? hStatClr : "#7889a0", fontWeight: h > a ? 600 : 400 }}>{typeof h === "number" && h % 1 !== 0 ? h.toFixed(2) : h}</span>
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", padding: "0 4px" }}><div style={{ width: `${(h/mx)*100}%`, height: 4, background: h >= a ? hClr + "88" : "#7889a0", borderRadius: 2, transition: "width 0.3s", minWidth: h > 0 ? 2 : 0 }} /></div>
                <span style={{ width: 70, textAlign: "center", color: "#ffffff", fontSize: 9, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", padding: "0 4px" }}><div style={{ width: `${(a/mx)*100}%`, height: 4, background: a >= h ? aClr + "88" : "#7889a0", borderRadius: 2, transition: "width 0.3s", minWidth: a > 0 ? 2 : 0 }} /></div>
                <span style={{ width: 24, textAlign: "left", color: a > h ? aStatClr : "#7889a0", fontWeight: a > h ? 600 : 400 }}>{typeof a === "number" && a % 1 !== 0 ? a.toFixed(2) : a}</span>
              </div>); })}
              {/* Momentum graph */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #2a3a50" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "#7889a0" }}>{abbr(teamById(lmH)?.name, teamById(lmH)?.code)} ▲</span>
                  <span style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.15em", fontWeight: 600 }}>Momentum</span>
                  <span style={{ fontSize: 8, color: "#7889a0" }}>{abbr(teamById(lmA)?.name, teamById(lmA)?.code)} ▼</span>
                </div>
                {(() => {
                  const W = 400, H = 44, mid = H / 2;
                  const h = lmMatch.momHist;
                  const maxMin = h.length > 0 ? Math.max(h[h.length-1].m, 90) : 90;
                  const pts = h.length > 0 ? h.map(p => ({ x: (p.m / maxMin) * W, y: mid - p.v * mid })) : [];
                  const pathD = pts.length > 1 ? "M0," + mid + " " + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + ` L${pts[pts.length-1].x.toFixed(1)},${mid} Z` : "";
                  return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 44, display: "block" }}>
                    <rect x="0" y="0" width={W} height={H} fill="#141c2b" rx="3" />
                    {[45,90,105,120].filter(m=>m<=maxMin).map(m => <line key={m} x1={(m/maxMin)*W} y1="0" x2={(m/maxMin)*W} y2={H} stroke="#7889a0" strokeWidth="0.5" strokeDasharray="2,2" />)}
                    <line x1="0" y1={mid} x2={W} y2={mid} stroke="#7889a0" strokeWidth="1" />
                    {pathD && <path d={pathD} fill="#7889a044" stroke="#7889a0" strokeWidth="1.5" />}
                  </svg>);
                })()}
              </div>
            </div>
            </>}
            {lmTab === "players" && <>
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141c2b", ...ui }}>Player Stats</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }} className="grid-2col">
              {["home","away"].map((side,si) => {
                const tm = side === "home" ? teamById(lmH) : teamById(lmA);
                const { starters, bench: benchSq } = displaySquad(tm?.squad || buildSquad(tm?.formation, null), tm?.name, tPlayerStats);
                const onPitch = lmMatch.players[side] || [];
                const off = lmMatch.subbedOff?.[side] || [];
                const bench = lmMatch.bench?.[side] || [];
                const lookup = (name) => onPitch.find(p=>p.name===name) || off.find(p=>p.name===name) || bench.find(p=>p.name===name);
                return (<>
                {si === 1 && <div style={{ background: "#7889a0" }}></div>}
                <div>
                  <div style={{ fontSize: 8, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6 }}>{tm?.name?.toUpperCase()}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 18px 18px 16px 16px 16px 28px 12px", gap: "0px 2px", fontSize: 9, alignItems: "center" }}>
                    <span style={{ color: "#7889a0", fontSize: 7 }}>POS</span>
                    <span style={{ color: "#7889a0", fontSize: 7 }}>PLAYER</span>
                    <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }}>G</span>
                    <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }}>A</span>
                    <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }} title="Chances created">C</span>
                    <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }} title="Defensive actions">D</span>
                    <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }} title="Saves (GK)">S</span>
                    <span style={{ color: "#7889a0", fontSize: 7, textAlign: "center" }}>RTG</span>
                    <span></span>
                    {starters.map((sq2,pi) => { const p = lookup(sq2.name) || {rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:sq2.atkW||0,chances:0,defActs:0,saves:0}; const isOff = off.some(x=>x.name===sq2.name); const isOn = onPitch.some(x=>x.name===sq2.name&&x.sub==='on'); return (<>
                      <span style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                      <span style={{ color: isOff?"#7889a0":"#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}</span>
                      <span style={{ textAlign: "center", color: p.goals>0?"#ffffff":"#7889a0", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                      <span style={{ textAlign: "center", color: p.assists>0?"#ffffff":"#7889a0", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                      <span style={{ textAlign: "center", color: p.chances>0?"#ffffff":"#7889a0", fontWeight: p.chances>0?700:400 }}>{p.chances||"-"}</span>
                      <span style={{ textAlign: "center", color: p.defActs>0?"#ffffff":"#7889a0", fontWeight: p.defActs>0?700:400 }}>{p.defActs||"-"}</span>
                      <span style={{ textAlign: "center", color: p.saves>0?"#ffffff":"#7889a0", fontWeight: p.saves>0?700:400 }}>{sq2.pos==="GK"?(p.saves||"-"):""}</span>
                      <span style={{ textAlign: "center", color: ratingColor(p.rating||6.5), fontWeight: 600, ...mono }}>{p.rating!=null?p.rating.toFixed(1):"–"}</span>
                      <span style={{ fontSize: 7, color: isOff?"#bf616a":"#7889a0", textAlign: "center" }}>{isOff?"▼":""}</span>
                    </>); })}
                    <span style={{ gridColumn: "1/-1", borderTop: "1px solid #2a3a50", marginTop: 2, marginBottom: 2 }}></span>
                    {[...benchSq].sort((a,b) => { const aOn = onPitch.some(x=>x.name===a.name); const bOn = onPitch.some(x=>x.name===b.name); return aOn===bOn?0:aOn?-1:1; }).map((sq2,pi) => { const p = lookup(sq2.name) || {rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:sq2.atkW||0,chances:0,defActs:0,saves:0}; const isOn = onPitch.some(x=>x.name===sq2.name); return (<>
                      <span style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                      <span style={{ color: isOn?"#ffffff":"#7889a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}{sq2.out&&<span style={{marginLeft:3,fontSize:7,color:"#bf616a",fontWeight:700}}>OUT</span>}</span>
                      <span style={{ textAlign: "center", color: p.goals>0?"#ffffff":"#7889a0", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                      <span style={{ textAlign: "center", color: p.assists>0?"#ffffff":"#7889a0", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                      <span style={{ textAlign: "center", color: p.chances>0?"#ffffff":"#7889a0", fontWeight: p.chances>0?700:400 }}>{p.chances||"-"}</span>
                      <span style={{ textAlign: "center", color: p.defActs>0?"#ffffff":"#7889a0", fontWeight: p.defActs>0?700:400 }}>{p.defActs||"-"}</span>
                      <span style={{ textAlign: "center", color: p.saves>0?"#ffffff":"#7889a0", fontWeight: p.saves>0?700:400 }}>{sq2.pos==="GK"?(p.saves||"-"):""}</span>
                      <span style={{ textAlign: "center", color: !isOn?"#7889a0":ratingColor(p.rating||6.5), fontWeight: 600, ...mono }}>{isOn&&p.rating!=null?p.rating.toFixed(1):"–"}</span>
                      <span style={{ fontSize: 7, color: isOn?"#a3be8c":"#7889a0", textAlign: "center" }}>{isOn?"▲":""}</span>
                    </>); })}
                  </div>
                </div>
                </>);
              })}
              </div>
            </div>

            {lmMatch.phase !== "pre_match" && lmMatch.phase !== "finished" && lmMatch.phase !== "penalties" && <>
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141c2b" , ...ui }}>Substitutions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }} className="grid-2col">
              {["home","away"].map((side, si) => {
                const tm = side === "home" ? teamById(lmH) : teamById(lmA);
                const subsLeft = 3 - (lmMatch.subs[side]||0);
                const onPitch = lmMatch.players[side]||[];
                const bench = lmMatch.bench[side]||[];
                const isActive = manualSub.side === side;
                return (<>
                  {si === 1 && <div style={{ background: "#7889a0" }} />}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 8, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600 }}>{tm?.name?.toUpperCase()}</span>
                      <span style={{ fontSize: 8, color: subsLeft > 0 ? "#7889a0" : "#bf616a", ...mono }}>{subsLeft}/3</span>
                    </div>
                    {subsLeft > 0 && bench.length > 0 ? (<>
                      {/* On-pitch players - click to select for removal */}
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 7, color: "#7889a0", marginBottom: 2, ...mono }}>OFF</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                          {onPitch.filter(p => p.pos !== "GK").map((p, pi) => (
                            <span key={pi} onClick={() => setManualSub(isActive && manualSub.off === p.name ? {side:null,off:null} : {side,off:p.name})}
                              style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                                background: isActive && manualSub.off === p.name ? "#7889a044" : "#141c2b",
                                border: isActive && manualSub.off === p.name ? "1px solid #2a3a50" : "1px solid #2a3a50",
                                color: POS_CLR[p.pos]||"#888" }}>{p.name}</span>
                          ))}
                        </div>
                      </div>
                      {/* Bench players - click to confirm sub (only visible when off-player selected) */}
                      {isActive && manualSub.off && (
                        <div>
                          <div style={{ fontSize: 7, color: "#7889a0", marginBottom: 2, ...mono }}>ON</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                            {bench.map((p, pi) => (
                              <span key={pi} onClick={() => executeManualSub(side, manualSub.off, p.name)}
                                style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                                  background: "#141c2b", border: "1px solid #2a3a50",
                                  color: POS_CLR[p.pos]||"#888" }}>{p.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>) : (
                      <div style={{ fontSize: 8, color: "#7889a0", fontStyle: "italic" }}>{subsLeft === 0 ? "No subs remaining" : "No bench players"}</div>
                    )}
                  </div>
                </>);
              })}
              </div>
            </div>
            </>}
            </>}
            {lmTab === "tactics" && <>
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141c2b" , ...ui }}>Tactics</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }} className="grid-2col">
              {["home","away"].map((side, si) => {
                const tm = side === "home" ? teamById(lmH) : teamById(lmA);
                const isBreak = ["pre_match","half_time","full_time","extra_half_time"].includes(lmMatch.phase);
                const SC2 = {balanced:"#888",gegenpress:"#bf616a",tikitaka:"#ebcb8b",counterattack:"#81a1c1",wingplay:"#a3be8c",parkthebus:"#d08770"};
                const strat = lmMatch.strategy?.[side] || {};
                return (<>
                  {si === 1 && <div style={{ background: "#7889a0" }} />}
                  <div>
                    <div style={{ fontSize: 8, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6 }}>{tm?.name?.toUpperCase()}</div>
                    {/* Style */}
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 7, color: "#7889a0", letterSpacing: "0.1em", marginBottom: 2 }}>STYLE</div>
                      {isBreak ? <select value={lmMatch.styles[side]} onChange={e => setLmMatch(m => ({...m, styles:{...m.styles, [side]:e.target.value}}))} style={{ ...inp, fontSize: 10, padding: "3px 6px", width: "100%", color: SC2[lmMatch.styles[side]]||"#7889a0" }}>{STYLE_GRP.map(([label, styles]) => <optgroup key={label} label={label}>{styles.map(s => <option key={s} value={s} style={{color:SC2[s]}}>{STYLE_LBL[s]}</option>)}</optgroup>)}</select> : <div style={{ fontSize: 10, color: SC2[lmMatch.styles[side]]||"#7889a0", fontWeight: 600, padding: "3px 0" }}>{STYLE_LBL[lmMatch.styles[side]]}</div>}
                    </div>
                    {/* Formation + Tempo */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
                      <div><div style={{ fontSize: 7, color: "#7889a0", letterSpacing: "0.1em" }}>FORMATION</div><div style={{ fontSize: 10, color: "#888", padding: "2px 0" }}>{lmMatch.formations[side]}</div></div>
                      <div><div style={{ fontSize: 7, color: "#7889a0", letterSpacing: "0.1em" }}>TEMPO</div><select value={lmMatch.tactics[side]} onChange={e => setLmMatch(m => ({...m, tactics:{...m.tactics, [side]:e.target.value}, allowTacChange:{...m.allowTacChange, [side]:false}}))} style={{ ...inp, fontSize: 9, padding: "1px 4px", width: "100%", color: "#888" }}><option value="park">Ultra Defensive</option><option value="def">Defensive</option><option value="bal">Balanced</option><option value="atk">Offensive</option><option value="ultra">Ultra Offensive</option></select></div>
                    </div>
                    {/* Stamina */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 7, color: "#7889a0", letterSpacing: "0.1em", marginBottom: 3 }}>STAMINA</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: "#141c2b", borderRadius: 2 }}><div style={{ width: `${Math.max(2, lmMatch.stamina[side])}%`, height: "100%", borderRadius: 2, background: lmMatch.stamina[side] > 60 ? "#7889a0" : lmMatch.stamina[side] > 30 ? "#ebcb8b" : "#bf616a", transition: "width 0.3s, background 0.3s" }} /></div>
                        <span style={{ fontSize: 8, color: "#7889a0", width: 22, textAlign: "right", flexShrink: 0, ...mono }}>{Math.round(lmMatch.stamina[side])}</span>
                      </div>
                    </div>
                    {/* Strategy instructions */}
                    {(()=>{ let lastGrp = ""; return Object.entries(STRAT_LABELS).map(([key, {name, vals, grp}]) => {
                      const hdr = grp !== lastGrp; lastGrp = grp;
                      return (<div key={key}>{hdr && <div style={{ fontSize: 7, color: "#7889a0", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6, marginBottom: 2 }}>{grp === "possession" ? "IN POSSESSION" : grp === "transition" ? "TRANSITION" : "DEFENSE"}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
                        <span style={{ fontSize: 8, color: "#7889a0", width: 44, flexShrink: 0, ...mono }}>{name}</span>
                        <select value={strat[key] ?? 0} onChange={e => setLmMatch(m => ({...m, strategy:{...m.strategy, [side]:{...(m.strategy?.[side]||{}), [key]: +e.target.value}}}))} style={{ ...inp, fontSize: 9, padding: "1px 4px", flex: 1, minWidth: 0, color: (strat[key] ?? 0) === 0 ? "#7889a0" : (strat[key] ?? 0) > 0 ? "#d08770" : "#81a1c1" }}>
                          {vals.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div></div>);
                    }); })()}
                  </div>
                </>);
              })}
              </div>
            </div>
            {/* Player Stats */}
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141c2b" , ...ui }}>Live Modifiers</div>
              {(()=>{
                const cM = (side) => applyStrategy(mergeModifiers(STYLE_MOD[lmMatch.styles?.[side]]||STYLE_MOD.balanced, FORM_MOD[lmMatch.formations?.[side]]), lmMatch.strategy?.[side]);
                const hM = cM("home"), aM = cM("away");
                const ps = [
                  {k:"press",l:"Press",m:true},{k:"adv",l:"Advance",m:false},{k:"hold",l:"Hold",m:false},
                  {k:"lb",l:"Long Ball",m:false},{k:"boxShot",l:"Box Shot",m:false},{k:"goalP",l:"Goal Prob",m:false},
                  {k:"ctr",l:"Counter",m:true},{k:"ctrShot",l:"Ctr Shot",m:false},{k:"def",l:"Defense",m:false},
                  {k:"lr",l:"Long-range",m:false},{k:"corn",l:"Corners",m:true}
                ];
                const fmt = (v, mult) => mult ? v.toFixed(2)+"x" : (v >= 0 ? "+" : "")+v.toFixed(3);
                const clr = (v, mult) => { const b = mult ? 1.0 : 0; if (Math.abs(v-b) < 0.001) return "#7889a0"; return v > b ? "#a3be8c" : "#bf616a"; };
                const wt = (v, mult) => Math.abs(v - (mult ? 1 : 0)) > 0.001 ? 600 : 400;
                return (
                  <div style={{ ...mono }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      <span style={{ width: 66, flexShrink: 0 }} />
                      <span style={{ flex: 1, textAlign: "right", fontSize: 9, color: "#7889a0", fontWeight: 600 }}>{abbr(teamById(lmH)?.name, teamById(lmH)?.code)}</span>
                      <span style={{ flex: 1, textAlign: "left", fontSize: 9, color: "#7889a0", fontWeight: 600 }}>{abbr(teamById(lmA)?.name, teamById(lmA)?.code)}</span>
                    </div>
                    {ps.map(({k,l,m}) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 10 }}>
                        <span style={{ width: 66, flexShrink: 0, color: "#7889a0", fontSize: 9 }}>{l}</span>
                        <span style={{ flex: 1, textAlign: "right", color: clr(hM[k],m), fontWeight: wt(hM[k],m) }}>{fmt(hM[k],m)}</span>
                        <span style={{ flex: 1, textAlign: "left", color: clr(aM[k],m), fontWeight: wt(aM[k],m) }}>{fmt(aM[k],m)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
</>}
            </>)}

          </>)}
        </div>)}

        {/* ═══ TOURNAMENT TAB ═══ */}
        {tab === "tournament" && (<div>
          {tScoreError && (tEdit || tKoEdit) && <div style={{ background: "#bf616a22", border: "1px solid #bf616a44", borderRadius: 6, padding: "6px 12px", marginBottom: 12, fontSize: 11, color: "#bf616a", textAlign: "center" }}>⚠ {tScoreError}</div>}
          {/* Tournament Leaderboards */}
          {Object.keys(tPlayerStats).length > 0 && (
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: "14px 18px", marginTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#7889a0", marginBottom: 12, textAlign: "center", paddingBottom: 8, borderBottom: "1px solid #141c2b" }}>Tournament Leaders</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px 18px" }} className="grid-4col">
                {/* Top Scorers */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("goals")} style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>TOP SCORERS<span style={{ fontSize: 8, color: "#7889a0" }}>▸</span></div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}><tbody>
                  {Object.values(tPlayerStats).filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||((a.matches+(a.subApp||0))-(b.matches+(b.subApp||0)))).slice(0,5).map((p,i) => (
                    <tr key={i} style={{ fontSize: 10 }}>
                      <td style={{ color: "#7889a0", width: 14, textAlign: "right", padding: "2px 4px 2px 0", ...mono }}>{i+1}</td>
                      <td style={{ color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 4px 2px 0" }}>{p.name}</td>
                      <td style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.pos}</td>
                      <td style={{ color: "#7889a0", fontSize: 8, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</td>
                      <td style={{ color: "#ffffff", fontWeight: 700, width: 18, textAlign: "right", padding: "2px 0", ...mono }}>{p.goals}</td>
                    </tr>
                  ))}
                  </tbody></table>
                </div>
                {/* Top Assisters */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("assists")} style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>TOP ASSISTS<span style={{ fontSize: 8, color: "#7889a0" }}>▸</span></div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}><tbody>
                  {Object.values(tPlayerStats).filter(p=>p.assists>0).sort((a,b)=>b.assists-a.assists||((a.matches+(a.subApp||0))-(b.matches+(b.subApp||0)))).slice(0,5).map((p,i) => (
                    <tr key={i} style={{ fontSize: 10 }}>
                      <td style={{ color: "#7889a0", width: 14, textAlign: "right", padding: "2px 4px 2px 0", ...mono }}>{i+1}</td>
                      <td style={{ color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 4px 2px 0" }}>{p.name}</td>
                      <td style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.pos}</td>
                      <td style={{ color: "#7889a0", fontSize: 8, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</td>
                      <td style={{ color: "#ffffff", fontWeight: 700, width: 18, textAlign: "right", padding: "2px 0", ...mono }}>{p.assists}</td>
                    </tr>
                  ))}
                  </tbody></table>
                </div>
                {/* Top Rated */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("rating")} style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>BEST RATING<span style={{ fontSize: 8, color: "#7889a0" }}>▸</span></div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}><tbody>
                  {(() => { const _all = Object.values(tPlayerStats); const _ap = p => p.matches+(p.subApp||0); const _min = Math.ceil(Math.max(1,..._all.map(_ap))/6); return _all.filter(p=>_ap(p)>=1).sort((a,b)=>{const aq=_ap(a)>=_min?1:0,bq=_ap(b)>=_min?1:0;if(aq!==bq)return bq-aq;return(b.totalRating/_ap(b))-(a.totalRating/_ap(a));}).slice(0,5); })().map((p,i) => {
                    const avg = (p.totalRating/(p.matches+(p.subApp||0)));
                    return (
                    <tr key={i} style={{ fontSize: 10 }}>
                      <td style={{ color: "#7889a0", width: 14, textAlign: "right", padding: "2px 4px 2px 0", ...mono }}>{i+1}</td>
                      <td style={{ color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 4px 2px 0" }}>{p.name}</td>
                      <td style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.pos}</td>
                      <td style={{ color: "#7889a0", fontSize: 8, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</td>
                      <td style={{ color: ratingColor(avg), fontWeight: 700, width: 24, textAlign: "right", padding: "2px 0", ...mono }}>{avg.toFixed(1)}</td>
                    </tr>);
                  })}
                  </tbody></table>
                </div>
                {/* Chances Created */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("chances")} style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>CHANCES CREATED<span style={{ fontSize: 8, color: "#7889a0" }}>▸</span></div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}><tbody>
                  {Object.values(tPlayerStats).filter(p=>p.chances>0).sort((a,b)=>b.chances-a.chances||((a.matches+(a.subApp||0))-(b.matches+(b.subApp||0)))).slice(0,5).map((p,i) => (
                    <tr key={i} style={{ fontSize: 10 }}>
                      <td style={{ color: "#7889a0", width: 14, textAlign: "right", padding: "2px 4px 2px 0", ...mono }}>{i+1}</td>
                      <td style={{ color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 4px 2px 0" }}>{p.name}</td>
                      <td style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.pos}</td>
                      <td style={{ color: "#7889a0", fontSize: 8, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</td>
                      <td style={{ color: "#ffffff", fontWeight: 700, width: 18, textAlign: "right", padding: "2px 0", ...mono }}>{p.chances}</td>
                    </tr>
                  ))}
                  </tbody></table>
                </div>
                {/* Defensive Actions */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("defActs")} style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>DEF ACTIONS<span style={{ fontSize: 8, color: "#7889a0" }}>▸</span></div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}><tbody>
                  {Object.values(tPlayerStats).filter(p=>p.defActs>0).sort((a,b)=>b.defActs-a.defActs||((a.matches+(a.subApp||0))-(b.matches+(b.subApp||0)))).slice(0,5).map((p,i) => (
                    <tr key={i} style={{ fontSize: 10 }}>
                      <td style={{ color: "#7889a0", width: 14, textAlign: "right", padding: "2px 4px 2px 0", ...mono }}>{i+1}</td>
                      <td style={{ color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 4px 2px 0" }}>{p.name}</td>
                      <td style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.pos}</td>
                      <td style={{ color: "#7889a0", fontSize: 8, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</td>
                      <td style={{ color: "#ffffff", fontWeight: 700, width: 18, textAlign: "right", padding: "2px 0", ...mono }}>{p.defActs}</td>
                    </tr>
                  ))}
                  </tbody></table>
                </div>
                {/* Saves */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("saves")} style={{ fontSize: 9, color: "#7889a0", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>SAVES<span style={{ fontSize: 8, color: "#7889a0" }}>▸</span></div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}><tbody>
                  {Object.values(tPlayerStats).filter(p=>p.saves>0).sort((a,b)=>b.saves-a.saves||((a.matches+(a.subApp||0))-(b.matches+(b.subApp||0)))).slice(0,5).map((p,i) => (
                    <tr key={i} style={{ fontSize: 10 }}>
                      <td style={{ color: "#7889a0", width: 14, textAlign: "right", padding: "2px 4px 2px 0", ...mono }}>{i+1}</td>
                      <td style={{ color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "2px 4px 2px 0" }}>{p.name}</td>
                      <td style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.pos}</td>
                      <td style={{ color: "#7889a0", fontSize: 8, width: 24, textAlign: "center", padding: "2px 4px 2px 0", ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</td>
                      <td style={{ color: "#ffffff", fontWeight: 700, width: 18, textAlign: "right", padding: "2px 0", ...mono }}>{p.saves}</td>
                    </tr>
                  ))}
                  </tbody></table>
                </div>
              </div>
              {(() => {
                const unavail = Object.values(tPlayerStats).filter(p => (p.suspended||0) > 0 || (p.injOut||0) > 0)
                  .flatMap(p => {
                    const rows = [];
                    if ((p.suspended||0) > 0) rows.push({...p, reason: "red", out: p.suspended});
                    if ((p.injOut||0) > 0) rows.push({...p, reason: "inj", out: p.injOut});
                    return rows;
                  }).sort((a,b) => b.out - a.out);
                if (!unavail.length) return null;
                return (
                  <details style={{ marginTop: 12, borderTop: "1px solid #141c2b", paddingTop: 10 }}>
                    <summary style={{ fontSize: 9, color: "#bf616a", letterSpacing: "0.12em", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>UNAVAILABLE ({unavail.length})</summary>
                    <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 18px" }} className="grid-4col">
                      {unavail.map((p,i) => {
                        const injReason = p.reason === "inj" && p.injPart ? p.injPart.replace(/\b\w/g, c => c.toUpperCase()) + " " + (INJ_SEV.find(s => s.id === p.injSev)?.label || "") : null;
                        return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 10 }}>
                          <span style={{ flex: 1, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={injReason || undefined}>{p.name}{injReason && <span style={{ color: "#7889a0" }}> ({injReason})</span>}</span>
                          <span style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.pos}</span>
                          <span style={{ color: "#7889a0", fontSize: 8, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</span>
                          <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                            {p.reason === "red"
                              ? <span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1}} />
                              : <svg width="8" height="8" viewBox="0 0 8 8" style={{display:"block"}}><rect x="1" y="3" width="6" height="2" rx="0.5" fill="#c07070"/><rect x="3" y="1" width="2" height="6" rx="0.5" fill="#c07070"/></svg>}
                            <span style={{ color: p.reason === "red" ? "#bf616a" : "#c07070", fontSize: 8, ...mono }}>{p.out}</span>
                          </span>
                        </div>
                      );})}
                    </div>
                  </details>
                );
              })()}
            </div>
          )}
          {tLeaderboard && (() => {
            const title = tLeaderboard === "goals" ? "TOP SCORERS" : tLeaderboard === "assists" ? "TOP ASSISTS" : tLeaderboard === "chances" ? "CHANCES CREATED" : tLeaderboard === "defActs" ? "DEF ACTIONS" : tLeaderboard === "saves" ? "SAVES" : "BEST RATING";
            const all = Object.values(tPlayerStats);
            const tApp = p => p.matches + (p.subApp||0);
            const sorted = tLeaderboard === "goals"
              ? all.filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||(tApp(a)-tApp(b)))
              : tLeaderboard === "assists"
              ? all.filter(p=>p.assists>0).sort((a,b)=>b.assists-a.assists||(tApp(a)-tApp(b)))
              : tLeaderboard === "chances"
              ? all.filter(p=>p.chances>0).sort((a,b)=>b.chances-a.chances||(tApp(a)-tApp(b)))
              : tLeaderboard === "defActs"
              ? all.filter(p=>p.defActs>0).sort((a,b)=>b.defActs-a.defActs||(tApp(a)-tApp(b)))
              : tLeaderboard === "saves"
              ? all.filter(p=>p.saves>0).sort((a,b)=>b.saves-a.saves||(tApp(a)-tApp(b)))
              : (() => { const _min = Math.ceil(Math.max(1,...all.map(tApp))/6); return all.filter(p=>tApp(p)>=1).sort((a,b)=>{const aq=tApp(a)>=_min?1:0,bq=tApp(b)>=_min?1:0;if(aq!==bq)return bq-aq;return(b.totalRating/tApp(b))-(a.totalRating/tApp(a));});})();
            return (
              <div onClick={() => setTLeaderboard(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 12, padding: "20px 24px", minWidth: 340, maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px #00000066" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #141c2b" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#7889a0" }}>{title}</span>
                    <span onClick={() => setTLeaderboard(null)} style={{ cursor: "pointer", color: "#7889a0", fontSize: 14, fontWeight: 700, lineHeight: 1, padding: "2px 6px" }}>✕</span>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}><tbody>
                    {sorted.map((p, i) => {
                      const ap = p.matches + (p.subApp||0);
                      const avg = ap ? (p.totalRating/ap) : 0;
                      const val = tLeaderboard === "goals" ? p.goals : tLeaderboard === "assists" ? p.assists : tLeaderboard === "chances" ? p.chances : tLeaderboard === "defActs" ? p.defActs : tLeaderboard === "saves" ? p.saves : avg;
                      return (
                        <tr key={i} style={{ fontSize: 11, borderBottom: i < sorted.length-1 ? "1px solid #141c2b" : "none" }}>
                          <td style={{ color: "#7889a0", width: 20, textAlign: "right", fontSize: 9, padding: "3px 6px 3px 0", ...mono }}>{i+1}</td>
                          <td style={{ color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "3px 6px 3px 0" }}>{p.name}</td>
                          <td style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#7889a0", fontSize: 8, fontWeight: 700, width: 26, textAlign: "center", padding: "3px 6px 3px 0", ...mono }}>{p.pos}</td>
                          <td style={{ color: "#7889a0", fontSize: 8, width: 28, textAlign: "center", padding: "3px 6px 3px 0", ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</td>
                          <td style={{ color: "#7889a0", fontSize: 8, width: 16, textAlign: "center", padding: "3px 6px 3px 0", ...mono }}>{ap}</td>
                          <td style={{ color: tLeaderboard === "rating" ? ratingColor(avg) : "#ffffff", fontWeight: 700, width: 26, textAlign: "right", padding: "3px 0", ...mono }}>{tLeaderboard === "rating" ? avg.toFixed(1) : val}</td>
                        </tr>
                      );
                    })}
                    </tbody></table>
                    {sorted.length === 0 && <div style={{ color: "#7889a0", fontSize: 10, textAlign: "center", padding: 20 }}>No data yet</div>}
                  </div>
                </div>
              </div>
            );
          })()}
          {/* SETUP */}
          {tPhase === "setup" && (<div>
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 22, boxShadow: "0 2px 12px #00000022", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0" }}>Participants <span style={{ color: "#7889a0", fontWeight: 400 }}>({tournamentTeamIds.length} selected)</span></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setTournamentTeamIds(teams.map(t => t.id))} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: "#7889a0" }}>Select All</button>
                  <button onClick={() => setTournamentTeamIds([])} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: "#bf616a" }}>Clear</button>
                </div>
              </div>
              {groupByLeague(teams).map((entry, gi) => {
                if (entry === null) return <div key={"div"+gi} style={{ borderTop: "1px solid #2a3a5033", margin: "8px 0" }} />;
                const [league, ts] = entry;
                const selCount = ts.filter(t => tournamentTeamIds.includes(t.id)).length;
                const allSel = selCount === ts.length, noneSel = selCount === 0;
                const expanded = expandedParticipantLeagues.has(league);
                return (<div key={league} style={{ marginBottom: 6, border: "1px solid #2a3a50", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#0a0e17", cursor: "pointer" }} onClick={() => setExpandedParticipantLeagues(s => { const ns = new Set(s); ns.has(league) ? ns.delete(league) : ns.add(league); return ns; })}>
                    <span style={{ color: "#7889a0", fontSize: 8, display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                    <span onClick={e => { e.stopPropagation(); setTournamentTeamIds(ids => allSel ? ids.filter(id => !ts.some(t => t.id === id)) : [...new Set([...ids, ...ts.map(t => t.id)])]); }} style={{ width: 14, height: 14, borderRadius: 3, border: "1px solid " + (allSel ? "#e4002b" : noneSel ? "#7889a066" : "#e4002b88"), background: allSel ? "#e4002b" : noneSel ? "transparent" : "#e4002b33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#ffffff", flexShrink: 0 }}>{allSel ? "✓" : !noneSel ? "–" : ""}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#ffffff" }}>{league}</span>
                    <span style={{ fontSize: 10, color: "#7889a0", ...mono }}>{selCount}/{ts.length}</span>
                  </div>
                  {expanded && <div style={{ padding: "8px 10px" }}>
                    {TRIM_SIZES.some(n => ts.length > n) && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #2a3a5033" }}>
                      <span style={{ fontSize: 9, color: "#81a1c1", alignSelf: "center", marginRight: 2, fontWeight: 700, letterSpacing: "0.06em" }}>TRIM:</span>
                      {TRIM_SIZES.filter(n => ts.length > n).map(n => (
                        <button key={n} onClick={() => { const top = new Set([...ts].sort((a, b) => (b.skill||0) - (a.skill||0)).slice(0, n).map(t => t.id)); setTournamentTeamIds(ids => [...ids.filter(id => !ts.some(t => t.id === id)), ...ts.filter(t => top.has(t.id)).map(t => t.id)]); }} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, border: "1px solid #81a1c144", background: "#81a1c11a", color: "#81a1c1", cursor: "pointer", fontFamily: "inherit" }} title={`Keep only the top ${n} by skill in this league`}>{n}</button>
                      ))}
                    </div>}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {ts.map(t => { const sel = tournamentTeamIds.includes(t.id); return (
                      <button key={t.id} onClick={() => setTournamentTeamIds(ids => sel ? ids.filter(id => id !== t.id) : [...ids, t.id])} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid " + (sel ? "#e4002b" : "#7889a033"), background: sel ? "#e4002b33" : "transparent", color: sel ? "#e4002b" : "#7889a0", cursor: "pointer", fontFamily: "inherit" }}>{abbr(t.name, t.code)}</button>
                    ); })}
                    </div>
                  </div>}
                </div>);
              })}
            </div>
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 22, boxShadow: "0 2px 12px #00000022" }}>
              {/* Presets */}
              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0" }}>Preset</div>
                <select onChange={e => { const v = e.target.value; e.target.value = ""; if (v && T_PRESETS[v]) setTConfig(c => ({ ...c, ...T_PRESETS[v].config })); }} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: "#81a1c1", background: "transparent", cursor: "pointer" }}>
                  <option value="" hidden>☰ Select</option>
                  {Object.entries(T_PRESETS).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              {/* Mode */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 12 }}>Tournament Mode</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {[["single", "Single Stage"], ["double", "Double Stage"]].map(([id, l]) => (
                    <button key={id} onClick={() => setTConfig(c => ({ ...c, mode: id }))} className={tConfig.mode === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.mode === id ? "#e4002b" : "#141c2b", color: tConfig.mode === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                  ))}
                </div>
                {tConfig.mode === "single" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["knockout", "Knockout Only"], ["groups", "Groups Only"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, singleType: id }))} style={{ ...chip, fontSize: 10, background: tConfig.singleType === id ? "#7889a080" : "#141c2b", color: tConfig.singleType === id ? "#ffffff" : "#7889a0", border: tConfig.singleType === id ? "1px solid #2a3a50" : "1px solid #2a3a50" }}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {/* Group Stage / League Format */}
              {tHasGroups && (
                <div style={{ borderTop: "1px solid #2a3a50", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 12, paddingLeft: 10, borderLeft: "2px solid #7889a0" }}>Group Stage</div>
                  <div style={{ display: "grid", gridTemplateColumns: tHasKO ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
                    <div><div style={{ fontSize: 11, color: "#7889a0", marginBottom: 4 }}>Groups</div><input type="number" value={tConfig.numGroups} onChange={e => setTConfig(c => ({ ...c, numGroups: e.target.value === "" ? "" : +e.target.value }))} style={{ ...inp, width: "100%", borderColor: !tGroupsOk ? "#bf616a" : "#7889a0" }} /></div>
                    
                  </div>
                  <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Format</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[["roundRobin", "Round Robin"], ["swiss", "Swiss"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, matchFormat: id }))} className={tConfig.matchFormat === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.matchFormat === id ? "#e4002b" : "#141c2b", color: tConfig.matchFormat === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                    ))}
                  </div>{tConfig.matchFormat === "roundRobin" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#7889a0" }}>Legs</div>
                      <input type="number" value={tConfig.rrLegs} onChange={e => setTConfig(c => ({ ...c, rrLegs: e.target.value === "" ? "" : Math.max(1, +e.target.value) }))} style={{ ...inp, width: 60, textAlign: "center" }} />
                      
                    </div>
                  )}
                  {tConfig.matchFormat === "swiss" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#7889a0" }}>Rounds</div>
                      <input type="number" value={tConfig.swissRounds} onChange={e => setTConfig(c => ({ ...c, swissRounds: e.target.value === "" ? "" : +e.target.value }))} style={{ ...inp, width: 60, textAlign: "center", borderColor: !tSwissOk ? "#bf616a" : "#7889a0" }} />
                      {tPerGroup > 1 && <span style={{ fontSize: 10, color: "#7889a0" }}>max {tPerGroup - 1}</span>}
                    </div>
                  )}
                  {tConfig.numGroups > 1 && (<>
                    <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Allocation</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: tConfig.allocMode === "draw" ? 12 : 0 }}>
                      {[["seed", "Seed"], ["random", "Random"], ["manual", "Manual"], ["draw", "Draw"]].map(([id, l]) => (
                        <button key={id} onClick={() => setTConfig(c => ({ ...c, allocMode: id }))} className={tConfig.allocMode === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.allocMode === id ? "#e4002b" : "#141c2b", color: tConfig.allocMode === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                      ))}
                    </div>
                    {tConfig.allocMode === "draw" && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 11, color: "#7889a0" }}>Pots</div>
                        <input type="number" value={tConfig.numPots} onChange={e => setTConfig(c => ({ ...c, numPots: e.target.value === "" ? "" : +e.target.value }))} style={{ ...inp, width: 60, textAlign: "center", borderColor: !tPotsOk ? "#bf616a" : "#7889a0" }} />
                        {!tPotsOk && <span style={{ fontSize: 10, color: "#bf616a" }}>Must be 2–{tConfig.numGroups}</span>}
                      </div>
                    )}
                  </>)}
                </div>
              )}
              {/* Tiebreakers */}
              {tHasGroups && (() => {
                const TBL = {"gd":"Goal Difference","gf":"Goals For","h2h":"Head-to-Head","wins":"Wins","buchholz":"Median-Buchholz","manual":"Manual"};
                const tbs = tConfig.tiebreakers || ["gd", "gf", "h2h", "wins"];
                const isSwiss = tConfig.matchFormat === "swiss";
                const allTBs = isSwiss ? ["gd", "gf", "h2h", "wins", "buchholz", ...(tHasKO ? ["manual"] : [])] : ["gd", "gf", "h2h", "wins", ...(tHasKO ? ["manual"] : [])];
                const setTBs = fn => setTConfig(c => ({ ...c, tiebreakers: fn(c.tiebreakers || ["gd", "gf", "h2h", "wins", "manual"]) }));
                return (
                <div style={{ borderTop: "1px solid #2a3a50", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 10, paddingLeft: 10, borderLeft: "2px solid #7889a0" }}>Tiebreakers</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {tbs.filter(tb => allTBs.includes(tb)).map((tb, ti) => (
                      <div key={tb} style={{ display: "flex", alignItems: "center", gap: 8, background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 5, padding: "5px 10px" }}>
                        <span style={{ ...mono, fontSize: 9, color: "#7889a0", width: 14, textAlign: "right" }}>{ti + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, color: "#ffffff" }}>{TBL[tb] || tb}{tb === "buchholz" && <span style={{ fontSize: 9, color: "#7889a0", marginLeft: 6 }}>Swiss</span>}</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                          {ti > 0 && <button onClick={() => setTBs(t => { const n = [...t]; [n[ti-1], n[ti]] = [n[ti], n[ti-1]]; return n; })} style={{ background: "none", border: "none", color: "#7889a0", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▲</button>}
                          {ti < tbs.filter(t => allTBs.includes(t)).length - 1 && <button onClick={() => setTBs(t => { const n = [...t]; [n[ti], n[ti+1]] = [n[ti+1], n[ti]]; return n; })} style={{ background: "none", border: "none", color: "#7889a0", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▼</button>}
                        </div>
                      </div>
                    ))}
                    {allTBs.filter(tb => !tbs.includes(tb)).map(tb => (
                      <button key={tb} onClick={() => setTBs(t => [...t, tb])} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "1px dashed #7889a0", borderRadius: 5, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: 10, color: "#7889a0" }}>+ {TBL[tb]}</span>
                      </button>
                    ))}

                  </div>
                </div>); })()}
              {/* Qualification Zones */}
              {tHasGroups && (() => {
                const ZC = [["#5e9c6b","Green"],["#7889a0","Slate"],["#4a7ab5","Blue"],["#81a1c1","Light Blue"],["#88c0d0","Cyan"],["#d08770","Orange"],["#ebcb8b","Yellow"],["#bf616a","Red"],["#9a7ab5","Purple"],["#b48ead","Pink"],["#a3be8c","Lime"]];
                const setZones = fn => setTConfig(c => ({ ...c, qualZones: fn(c.qualZones || []) }));
                return (
                <div style={{ borderTop: "1px solid #2a3a50", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", paddingLeft: 10, borderLeft: "2px solid #7889a0" }}>Qualification Zones</div>
                    <button onClick={() => setZones(z => [...z, { anchor: "top", from: z.length + 1, to: z.length + 1, label: "Zone", color: ZC[z.length % ZC.length][0], type: "cosmetic" }])} style={{ ...addBtn, fontSize: 10, color: "#7889a0" }}>+ Zone</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {qz.map((z, zi) => (
                      <div key={zi} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: z.color, flexShrink: 0 }} />
                          <input value={z.label} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ ...inp, flex: 1, minWidth: 0, padding: "4px 8px", fontSize: 12, fontWeight: 500 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                            {zi > 0 && <button onClick={() => setZones(zs => { const n = [...zs]; [n[zi-1], n[zi]] = [n[zi], n[zi-1]]; return n; })} style={{ background: "none", border: "none", color: "#7889a0", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▲</button>}
                            {zi < (tConfig.qualZones||[]).length - 1 && <button onClick={() => setZones(zs => { const n = [...zs]; [n[zi], n[zi+1]] = [n[zi+1], n[zi]]; return n; })} style={{ background: "none", border: "none", color: "#7889a0", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▼</button>}
                          </div>
                          <button onClick={() => setZones(zs => zs.filter((_, i) => i !== zi))} style={{ background: "none", border: "none", color: "#bf616a", fontSize: 13, cursor: "pointer", padding: "0 4px", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <select value={z.color} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, color: e.target.value } : x))} style={{ ...inp, padding: "3px 6px", fontSize: 10, cursor: "pointer", width: "auto" }}>{ZC.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
                          <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid #2a3a50", flexShrink: 0 }}>
                            {[["top", "Top"], ["bottom", "Bot"]].map(([id, l]) => (
                              <button key={id} onClick={() => setZones(zs => zs.map((x, i) => i === zi ? { ...x, anchor: id } : x))} style={{ fontSize: 9, padding: "3px 8px", background: z.anchor === id ? "#7889a0" : "transparent", color: z.anchor === id ? "#ffffff" : "#7889a0", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                            ))}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="number" min={1} value={z.from} onChange={e => { const v = e.target.value === "" ? "" : Math.max(1, +e.target.value); setZones(zs => zs.map((x, i) => i === zi ? { ...x, from: v } : x)); }} style={{ ...inp, width: 36, padding: "3px 4px", fontSize: 11, textAlign: "center", ...mono }} />
                            <span style={{ color: "#7889a0", fontSize: 10 }}>–</span>
                            <input type="number" min={1} value={z.to} onChange={e => { const v = e.target.value === "" ? "" : Math.max(1, +e.target.value); setZones(zs => zs.map((x, i) => i === zi ? { ...x, to: v } : x)); }} style={{ ...inp, width: 36, padding: "3px 4px", fontSize: 11, textAlign: "center", ...mono }} />
                          </div>
                          <select value={z.type || "cosmetic"} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, type: e.target.value } : x))} style={{ ...inp, padding: "3px 6px", fontSize: 10, cursor: "pointer", width: "auto" }}><option value="cosmetic">Cosmetic</option>{tHasKO && <option value="advance">Direct Qualification</option>}{tHasKO && <option value="best">Pool Qualification</option>}</select>
                          {z.type === "best" && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 10, color: "#7889a0" }}>Top</span><input type="number" min={1} max={tConfig.numGroups} value={z.bestCount || ""} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, bestCount: e.target.value === "" ? "" : Math.min(tConfig.numGroups, Math.max(1, +e.target.value)) } : x))} style={{ ...inp, width: 36, padding: "3px 4px", fontSize: 11, textAlign: "center", ...mono }} /><span style={{ fontSize: 10, color: "#7889a0" }}>qualify</span></div>}
                        </div>
                      </div>
                    ))}
                    {qz.length === 0 && <div style={{ fontSize: 10, color: "#7889a0", padding: "4px 2px" }}>No zones configured</div>}
                  </div>
                  
                </div>); })()}
              {/* Knockout options */}
              {tHasKO && (
                <div style={{ borderTop: "1px solid #2a3a50", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 12, paddingLeft: 10, borderLeft: "2px solid #7889a0" }}>Knockout Stage</div>
                  <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Format</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {[["single","Single Elim"],["double_elim","Double Elim"]].map(([id,l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, koFormat: id, ...(id === "double_elim" ? { thirdPlace: false } : {}) }))} className={tConfig.koFormat === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.koFormat === id ? "#e4002b" : "#141c2b", color: tConfig.koFormat === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                    ))}
                  </div>
                  {tConfig.koFormat === "double_elim" && (() => { const checked = tConfig.koGFReset; return (
                    <div onClick={() => setTConfig(c => ({ ...c, koGFReset: !c.koGFReset }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#e4002b" : "#141c2b66", border: "1px solid " + (checked ? "#e4002b" : "#7889a033"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#141c2b" : "#7889a066", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#e4002b" : "#7889a0", fontWeight: 500 }}>Grand Final Reset</div><div style={{ fontSize: 9, color: "#7889a0" }}>If LB winner wins GF, play a deciding match</div></div>
                    </div>); })()}
                  {tConfig.koFormat !== "double_elim" && (tConfig.mode === "single" ? tournamentTeams.length >= 4 : tKoTeams >= 4) && (() => { const checked = tConfig.thirdPlace; return (
                    <div onClick={() => setTConfig(c => ({ ...c, thirdPlace: !c.thirdPlace }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#e4002b" : "#141c2b66", border: "1px solid " + (checked ? "#e4002b" : "#7889a033"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#141c2b" : "#7889a066", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#e4002b" : "#7889a0", fontWeight: 500 }}>3rd Place Match</div></div>
                    </div>); })()}
                  {(() => { const checked = tConfig.koLegs === 2; return (
                    <div onClick={() => setTConfig(c => ({ ...c, koLegs: c.koLegs === 2 ? 1 : 2 }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#e4002b" : "#141c2b66", border: "1px solid " + (checked ? "#e4002b" : "#7889a033"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#141c2b" : "#7889a066", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#e4002b" : "#7889a0", fontWeight: 500 }}>2-Legged Ties</div></div>
                    </div>); })()}
                  {tConfig.koLegs === 2 && (() => { const checked = tConfig.koAwayGoals; return (
                    <div onClick={() => setTConfig(c => ({ ...c, koAwayGoals: !c.koAwayGoals }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8, paddingLeft: 16 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#e4002b" : "#141c2b66", border: "1px solid " + (checked ? "#e4002b" : "#7889a033"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#141c2b" : "#7889a066", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#e4002b" : "#7889a0", fontWeight: 500 }}>Away Goals Rule</div></div>
                    </div>); })()}
                  {(() => { const checked = tConfig.injuries !== false; return (
                    <div onClick={() => setTConfig(c => ({ ...c, injuries: !c.injuries }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#e4002b" : "#141c2b66", border: "1px solid " + (checked ? "#e4002b" : "#7889a033"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#141c2b" : "#7889a066", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#e4002b" : "#7889a0", fontWeight: 500 }}>Injuries</div></div>
                    </div>); })()}
                  {tNumByes > 0 && <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Bye Allocation <span style={{ ...mono, fontSize: 10 }}>({tNumByes} bye{tNumByes!==1?"s":""})</span></div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[["auto", "By Ranking"], ["manual", "Manual"]].map(([id, l]) => (
                        <button key={id} onClick={() => setTConfig(c => ({ ...c, koByeMode: id }))} className={tConfig.koByeMode === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.koByeMode === id ? "#e4002b" : "#141c2b", color: tConfig.koByeMode === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                      ))}
                    </div>
                  </div>}
                  <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Allocation</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[["seed", "Seed"], ["random", "Random"], ["manual", "Manual"], ["draw", "Draw"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, koAllocMode: id }))} className={tConfig.koAllocMode === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.koAllocMode === id ? "#e4002b" : "#141c2b", color: tConfig.koAllocMode === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* Home Advantage */}
              <div style={{ borderTop: "1px solid #2a3a50", paddingTop: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 12, paddingLeft: 10, borderLeft: "2px solid #7889a0" }}>Home Advantage</div>
                {tHasGroups && (<div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Group Stage</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[["off", "Off"], ["first", "First Listed"], ["weak_skill", "Weaker (Skill)"], ["host", "Host Team"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, homeAdvGroup: id, homeAdvTeams: id !== "host" && c.homeAdvKO !== "host" ? [] : c.homeAdvTeams }))} className={tConfig.homeAdvGroup === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.homeAdvGroup === id ? "#e4002b" : "#141c2b", color: tConfig.homeAdvGroup === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                    ))}
                  </div>
                </div>)}
                {tHasKO && tConfig.koLegs !== 2 && (<div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Knockout Stage</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[["off", "Off"], ["first", "First Listed"], ["weak_skill", "Weaker (Skill)"], ...(tHasGroups ? [["weak_group", "Weaker (Group)"]] : []), ["host", "Host Team"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, homeAdvKO: id, homeAdvTeams: id !== "host" && c.homeAdvGroup !== "host" ? [] : c.homeAdvTeams }))} className={tConfig.homeAdvKO === id ? "gbtn" : ""} style={{ ...chip, background: tConfig.homeAdvKO === id ? "#e4002b" : "#141c2b", color: tConfig.homeAdvKO === id ? "#ffffff" : "#7889a0" }}>{l}</button>
                    ))}
                  </div>
                </div>)}
                {(tConfig.homeAdvGroup === "host" || (tConfig.homeAdvKO === "host" && tConfig.koLegs !== 2)) && (<div>
                  <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Host Team</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {tournamentTeams.map((t) => { const sel = tConfig.homeAdvTeams.includes(t.name); return (
                      <button key={t.id} onClick={() => setTConfig(c => ({ ...c, homeAdvTeams: sel ? c.homeAdvTeams.filter(n => n !== t.name) : [...c.homeAdvTeams, t.name] }))} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid " + (sel ? "#e4002b" : "#7889a033"), background: sel ? "#e4002b33" : "transparent", color: sel ? "#e4002b" : "#7889a0", cursor: "pointer", fontFamily: "inherit" }}>{abbr(t.name, t.code)}</button>
                    ); })}
                  </div>
                  {tConfig.homeAdvTeams.length > 0 && <div style={{ fontSize: 9, color: "#7889a0", marginTop: 4, ...mono }}>{tConfig.homeAdvTeams.join(", ")}</div>}
                  {tConfig.homeAdvTeams.length > 0 && <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 6 }}>Host Venues (Optional)</div>
                    <textarea value={tHostVenueText} onChange={e => setTHostVenueText(e.target.value)} placeholder={"City\tStadium\nMizuhara\tTadamune Kuronami National Stadium\nAxiom\tTrekker Stadium"} rows={4} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.6, fontSize: 10 }} />
                    {tHostVenuePool.length > 0 && <div style={{ fontSize: 9, color: "#7889a0", marginTop: 4 }}>{tHostVenuePool.length} venue{tHostVenuePool.length === 1 ? "" : "s"} loaded</div>}
                  </div>}
                </div>)}
              </div>
              {/* Summary */}
              <div style={{ background: "#141c2b", borderRadius: 8, padding: "14px 18px", marginBottom: 18, border: "1px solid #2a3a50" }}>
                {tConfig.mode === "single" && tConfig.singleType === "knockout" ? (<>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 12, alignItems: "baseline" }}>
                    <span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>TEAMS</span>
                    <span style={{ color: "#ffffff" }}>{tournamentTeams.length}</span>
                    <span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>FORMAT</span>
                    <span style={{ color: "#ffffff" }}>Single-Elimination Bracket</span>
                    {!isPow2(tournamentTeams.length) && tournamentTeams.length >= 2 && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>BYES</span><span style={{ color: "#ebcb8b" }}>{(() => { let n = 1; while (n < tournamentTeams.length) n *= 2; return n - tournamentTeams.length; })()} byes → {(() => { let n = 1; while (n < tournamentTeams.length) n *= 2; return n; })()} bracket</span></>}
                    {tConfig.koLegs === 2 && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>LEGS</span><span style={{ color: "#ffffff" }}>2-Legged{tConfig.koAwayGoals ? " (Away Goals)" : ""}</span></>}
                    {tConfig.thirdPlace && tournamentTeams.length >= 4 && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>EXTRA</span><span style={{ color: "#ffffff" }}>3rd Place Match</span></>}
                    <span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>KO DRAW</span>
                    <span style={{ color: "#ffffff" }}>{({seed:"Seeded",random:"Random",manual:"Manual",draw:"Draw"})[tConfig.koAllocMode]}</span>
                    {(tConfig.homeAdvKO !== "off" || tConfig.homeAdvGroup !== "off") && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>HOME ADV</span><span style={{ color: "#ffffff" }}>{({off:"Off",first:"First Listed",weak_skill:"Weaker (Skill)",weak_group:"Weaker (Group)",host:"Host Team"})[tConfig.homeAdvKO] || "Off"}</span></>}
                  </div>
                  {tournamentTeamIds.length < 2 && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Select at least 2 teams</div>}
                  {tParticipantErrors && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Fix skill values (25–100)</div>}
                  {tValid && <div style={{ color: "#7889a0", fontSize: 11, marginTop: 8, fontWeight: 600 }}>✓ Ready</div>}
                </>) : (()=>{ const swissOk = tSwissOk; const rrRounds = (tPerGroup - 1) * tConfig.rrLegs; const rrMatchesPerGroup = tPerGroup * (tPerGroup - 1) / 2 * tConfig.rrLegs; const totalMatches = tConfig.matchFormat === "swiss" ? Math.floor(tPerGroup / 2) * tConfig.swissRounds * tConfig.numGroups : tConfig.numGroups * rrMatchesPerGroup; return (<>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 12, alignItems: "baseline" }}>
                    <span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>TEAMS</span>
                    <span style={{ color: "#ffffff" }}>{tournamentTeams.length}{tGroupsOk && tUneven ? <span style={{ color: "#ebcb8b", fontSize: 10, marginLeft: 6 }}>(uneven groups)</span> : ""}</span>
                    <span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>GROUPS</span>
                    <span style={{ color: "#ffffff" }}>{tGroupsOk ? tConfig.numGroups : "?"} × {tGroupsOk && tPerGroup >= 2 ? (tDivisible ? tPerGroup : tPerGroup+"–"+tPerGroupMax) : "?"} teams</span>
                    <span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>FORMAT</span>
                    <span style={{ color: "#ffffff" }}>{tConfig.matchFormat === "swiss" ? "Swiss" : "Round Robin"}{tConfig.matchFormat === "roundRobin" && tConfig.rrLegs > 1 ? " ("+tConfig.rrLegs+" legs)" : ""}</span>
                    <span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>MATCHES</span>
                    <span style={{ color: "#ffffff" }}>{tConfig.matchFormat === "swiss" ? tConfig.swissRounds+" rounds" : rrRounds+" rounds"}{tValid && swissOk ? ", "+totalMatches+" total" : ""}</span>
                    {tConfig.numGroups > 1 && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>DRAW</span><span style={{ color: "#ffffff" }}>{({seed:"Seeded",random:"Random",manual:"Manual",draw:"Draw"})[tConfig.allocMode]}{tConfig.allocMode === "draw" ? " ("+tConfig.numPots+" pots)" : ""}</span></>}
                    {tHasKO && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>ADVANCE</span><span style={{ color: "#ffffff" }}>{tUseZones ? tKoTeams + " teams via zones" : "Top " + tConfig.advPerGroup + " per group → " + tKoTeams + " teams"}{!isPow2(tKoTeams) ? " (+byes)" : ""}</span></>}
                    {tHasKO && tConfig.koLegs === 2 && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>KO LEGS</span><span style={{ color: "#ffffff" }}>2-Legged{tConfig.koAwayGoals ? " (Away Goals)" : ""}</span></>}
                    {tHasKO && tConfig.thirdPlace && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>EXTRA</span><span style={{ color: "#ffffff" }}>3rd Place Match</span></>}
                    {tHasKO && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>KO DRAW</span><span style={{ color: "#ffffff" }}>{({seed:"Seeded",random:"Random",manual:"Manual",draw:"Draw"})[tConfig.koAllocMode]}</span></>}
                    {!tHasKO && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>STAGE</span><span style={{ color: "#ffffff" }}>{tConfig.numGroups === 1 ? "League — no knockout" : "Groups only — no knockout"}</span></>}
                    {(tConfig.homeAdvGroup !== "off" || tConfig.homeAdvKO !== "off") && <><span style={{ color: "#7889a0", fontSize: 10, fontWeight: 600 }}>HOME ADV</span><span style={{ color: "#ffffff" }}>{tHasGroups ? ({off:"Off",first:"First Listed",weak_skill:"Weaker (Skill)",host:"Host Team"})[tConfig.homeAdvGroup] || "Off" : ""}{tHasGroups && tHasKO && tConfig.homeAdvGroup !== "off" && tConfig.homeAdvKO !== "off" ? " / " : ""}{tHasKO && tConfig.koLegs !== 2 ? ({off:"",first:"First Listed",weak_skill:"Weaker (Skill)",weak_group:"Weaker (Group)",host:"Host Team"})[tConfig.homeAdvKO] || "" : ""}</span></>}
                  </div>
                  {!tGroupsOk && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Groups must be 1–26</div>}
                  {tGroupsOk && tPerGroup < 2 && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Need ≥2 teams per group</div>}
                  {!swissOk && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Swiss rounds must be 1–{tPerGroup - 1}</div>}
                  {tHasKO && !tAdvOk && tDivisible && tPerGroup >= 2 && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Advance must be 1–{tPerGroup}</div>}
                  {tParticipantErrors && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Fix skill values (25–100)</div>}
                  {tValid && swissOk && <div style={{ color: "#7889a0", fontSize: 11, marginTop: 8, fontWeight: 600 }}>✓ Ready</div>}
                </>); })()}
              </div>
              <button onClick={() => createTournament()} disabled={!tValid} style={{ ...scBtn, opacity: tValid ? 1 : 0.4, cursor: tValid ? "pointer" : "default" }}>▶ {tHasGroups && tConfig.allocMode === "manual" && tConfig.numGroups > 1 ? "Begin Allocation" : "Create Tournament"}</button>
            </div>
          </div>)}

          {/* DRAW CEREMONY */}
          {tPhase === "drawing" && tDrawAnim && (() => {
            const { log, index, pending } = tDrawAnim;
            const revealed = log.slice(0, index);
            const activePot = pending ? log[index].pot : (index < log.length ? log[index].pot : null);
            const pots = {};
            log.forEach(e => { if (!pots[e.pot]) pots[e.pot] = []; pots[e.pot].push(e); });
            const groups = {};
            revealed.forEach(e => { if (!groups[e.group]) groups[e.group] = []; groups[e.group].push(e); });
            const allGroups = [...new Set(log.map(e => e.group))].sort();
            const done = index >= log.length && !pending;
            const pendingEntry = pending ? log[index] : null;
            const justPlaced = !pending && index > 0 ? log[index - 1] : null;
            return (<div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0" }}>DRAW CEREMONY</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ ...mono, fontSize: 10, color: "#7889a0" }}>{index}/{log.length}</span>
                  <button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a", borderColor: "#3a2020" }}>Reset</button>
                </div>
              </div>
              {pendingEntry && <div key={"p"+index} style={{ textAlign: "center", marginBottom: 16, padding: "16px 16px", background: "#141c2b", border: "1px solid #e4002b44", borderRadius: 8, animation: "fadeIn 0.3s" }}>
                <div style={{ fontSize: 9, color: "#7889a0", letterSpacing: 2, marginBottom: 6 }}>POT {pendingEntry.pot}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>{pendingEntry.team}</div>
                <div style={{ ...mono, fontSize: 10, color: "#7889a0", marginTop: 4 }}>{pendingEntry.skill}</div>
                <div style={{ fontSize: 10, color: "#7889a0", marginTop: 8, letterSpacing: 1, animation: "pulse 1.5s infinite" }}>awaiting group…</div>
              </div>}
              {!pending && justPlaced && <div key={"g"+index} style={{ textAlign: "center", marginBottom: 16, padding: "16px 16px", background: "#141c2b", border: "1px solid #e4002b", borderRadius: 8, animation: "fadeIn 0.3s" }}>
                <div style={{ fontSize: 9, color: "#7889a0", letterSpacing: 2, marginBottom: 6 }}>POT {justPlaced.pot}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>{justPlaced.team}</div>
                <div style={{ fontSize: 14, color: "#7889a0", marginTop: 8, fontWeight: 700 }}>→ GROUP {justPlaced.group}</div>
              </div>}
              {Object.keys(pots).map(p => {
                const pot = pots[p];
                return (<div key={p} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: activePot === +p ? "#ffffff" : "#7889a0", marginBottom: 4 }}>POT {p}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {pot.map((e, ei) => {
                      const globalIdx = log.indexOf(e);
                      const isPlaced = globalIdx < index;
                      const isPending = pending && globalIdx === index;
                      return <span key={ei} style={{ ...mono, fontSize: 10, padding: "3px 8px", borderRadius: 4, background: isPending ? "#e4002b22" : "#141c2b", border: isPending ? "1px solid #e4002b" : "1px solid #7889a033", color: isPending ? "#ffffff" : "#7889a0", textDecoration: isPlaced ? "line-through" : "none", fontWeight: isPending ? 700 : 400, transition: "all 0.3s" }}>{e.team}</span>;
                    })}
                  </div>
                </div>);
              })}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(allGroups.length, 4)}, 1fr)`, gap: 8, marginTop: 16, marginBottom: 16 }}>
                {allGroups.map(gl => {
                  const gt = groups[gl] || [];
                  const maxPerGroup = Math.ceil(log.length / allGroups.length);
                  const isTarget = justPlaced && justPlaced.group === gl;
                  return (<div key={gl} style={{ background: "#141c2b", border: isTarget ? "1px solid #e4002b66" : "1px solid #2a3a50", borderRadius: 7, padding: "10px 8px", transition: "border 0.3s" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0", textAlign: "center", marginBottom: 6 }}>GROUP {gl}</div>
                    {Array.from({ length: maxPerGroup }, (_, si) => {
                      const t = gt[si];
                      const isLatest = t && justPlaced && t.team === justPlaced.team;
                      return <div key={si} style={{ fontSize: 11, padding: "4px 6px", borderBottom: si < maxPerGroup - 1 ? "1px solid #7889a022" : "none", color: t ? (isLatest ? "#ffffff" : "#7889a0") : "#7889a033", fontWeight: isLatest ? 700 : 400, transition: "all 0.3s", display: "flex", justifyContent: "space-between" }}>
                        <span>{t ? t.team : "—"}</span>
                        {t && <span style={{ ...mono, fontSize: 9, color: "#7889a0" }}>{t.skill}</span>}
                      </div>;
                    })}
                  </div>);
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!done && <button onClick={tDrawAdvance} style={{ ...scBtn, flex: 1 }}>{pending ? "Reveal Group" : "Draw Next"}</button>}
                {!done && !tDrawAnim.auto && <button onClick={() => setTDrawAnim(p => p ? { ...p, auto: true } : p)} style={{ ...addBtn, flex: 0, padding: "14px 20px", color: "#7889a0" }}>▶ Auto</button>}
                {!done && tDrawAnim.auto && <button onClick={() => { setTDrawAnim(p => p ? { ...p, auto: false } : p); if (tDrawTimerRef.current) { clearInterval(tDrawTimerRef.current); tDrawTimerRef.current = null; } }} style={{ ...addBtn, flex: 0, padding: "14px 20px", color: "#bf616a" }}>⏸ Pause</button>}
                {!done && <button onClick={tDrawSkip} style={{ ...addBtn, flex: 0, padding: "14px 20px", color: "#7889a0" }}>Skip</button>}
                {done && <button onClick={tDrawConfirm} style={scBtn}>▶ Continue to Group Stage</button>}
              </div>
            </div>);
          })()}

          {/* MANUAL ALLOCATION */}
          {tPhase === "manual" && tManual && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0" }}>MANUAL ALLOCATION</div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ ...mono, fontSize: 10, color: "#7889a0" }}>{tManual.pool.length} remaining</span><button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a" }}>Reset</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 4)}, 1fr)`, gap: 10, marginBottom: 16 }}>
              {tManual.grps.map((g, gi) => (<div key={gi} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 7, padding: "12px 10px", boxShadow: "0 1px 6px #00000018" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0", textAlign: "center", marginBottom: 8 }}>GROUP {g.label}</div>
                {g.teams.map((t, ti) => (<div key={ti} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid #141c2b", display: "flex", justifyContent: "space-between" }}><span>{t.name}</span><span style={{ ...mono, fontSize: 10, color: "#7889a0" }}>{t.skill}</span></div>))}
                {g.teams.length < (gi < ((tManual.pool.length + tManual.grps.reduce((s,g2) => s + g2.teams.length, 0)) % tConfig.numGroups) ? tPerGroupMax : tPerGroup) && (<div style={{ marginTop: 4 }}><select onChange={e => { if (e.target.value !== "") { tManualAssign(+e.target.value, gi); e.target.value = ""; } }} style={{ ...sel, width: "100%", fontSize: 10 }}><option value="">+ Assign team...</option>{tManual.pool.map((t, ti) => <option key={ti} value={ti}>{t.name} ({t.skill})</option>)}</select></div>)}
              </div>))}
            </div>
            {tManual.pool.length === 0 && <button onClick={tManualConfirm} style={scBtn}>▶ Start Tournament</button>}
          </div>)}

          {/* KO MANUAL ALLOCATION */}
          {tPhase === "ko_byes" && tByeManual && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0" }}>SELECT BYE TEAMS</div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ ...mono, fontSize: 10, color: "#ebcb8b" }}>{tByeManual.selected.length} / {tByeManual.numByes} selected</span><button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a" }}>Reset</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, marginBottom: 16 }}>
              {tByeManual.pool.map((t, ti) => { const sel = tByeManual.selected.some(s => s.name === t.name); return (
                <button key={ti} onClick={() => { if (sel) { setTByeManual(b => ({...b, selected: b.selected.filter(s => s.name !== t.name)})); } else if (tByeManual.selected.length < tByeManual.numByes) { setTByeManual(b => ({...b, selected: [...b.selected, t]})); } }}
                  className={sel ? "gbtn" : ""} style={{ ...chip, background: sel ? "#e4002b" : "transparent", color: sel ? "#ffffff" : "#7889a0", borderColor: sel ? "#e4002b" : "#7889a033", fontSize: 10, padding: "6px 10px", textAlign: "left" }}>
                  {t.name} <span style={{ color: sel ? "#a3be8c" : "#7889a0", fontSize: 9 }}>({t.skill})</span>
                </button>
              ); })}
            </div>
            {tByeManual.selected.length === tByeManual.numByes && <button onClick={tByeConfirm} style={scBtn}>▶ Confirm Byes & Allocate</button>}
          </div>)}
          {tPhase === "ko_manual" && tKOManual && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0" }}>KNOCKOUT BRACKET ALLOCATION</div>
              <div style={{ display: "flex", gap: 8 }}>{tKOManual.numByes > 0 && <span style={{ ...mono, fontSize: 10, color: "#ebcb8b" }}>{tKOManual.numByes} bye{tKOManual.numByes !== 1 ? "s" : ""} needed</span>}<span style={{ ...mono, fontSize: 10, color: "#7889a0" }}>{tKOManual.pool.length} remaining</span><button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a" }}>Reset</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tKOManual.matches.length, 4)}, 1fr)`, gap: 10, marginBottom: 16 }}>
              {tKOManual.matches.map((m, mi) => (<div key={mi} style={{ background: "#141c2b", border: `1px solid ${m.home && !m.away || m.away && !m.home ? "#ebcb8b33" : "#7889a0"}`, borderRadius: 7, padding: "12px 10px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: m.home && !m.away || m.away && !m.home ? "#ebcb8b" : "#7889a0", textAlign: "center", marginBottom: 8, ...mono }}>{m.home && !m.away || m.away && !m.home ? "BYE" : `MATCH ${mi + 1}`}</div>
                {["home", "away"].map(slot => (<div key={slot} style={{ marginBottom: 4 }}>
                  {m[slot] ? (
                    <div style={{ fontSize: 11, padding: "4px 8px", background: "#141c2b", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{m[slot].name}</span>
                      <button onClick={() => tKOManualRemove(mi, slot)} style={{ background: "none", border: "none", color: "#bf616a", fontSize: 13, cursor: "pointer", padding: "0 2px" }}>×</button>
                    </div>
                  ) : (
                    <select onChange={e => { if (e.target.value !== "") { tKOManualAssign(+e.target.value, mi, slot); e.target.value = ""; } }} style={{ ...sel, width: "100%", fontSize: 10 }}>
                      <option value="">+ {slot === "home" ? "Home" : "Away"}...</option>
                      {tKOManual.pool.map((t, ti) => <option key={ti} value={ti}>{t.name} ({t.skill})</option>)}
                    </select>
                  )}
                </div>))}
              </div>))}
            </div>
            {tKOManual.pool.length <= 1 && <button onClick={tKOManualConfirm} style={scBtn}>▶ Start Knockout</button>}
          </div>)}

          {/* GROUPS */}
          {tPhase === "groups" && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0" }}>{tConfig.numGroups === 1 ? "LEAGUE" : "GROUP STAGE"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ ...mono, fontSize: 10, color: "#7889a0" }}>{tPlayedMatches}/{tTotalMatches}</span>
                {tPlayedMatches < tTotalMatches && <button onClick={() => tScorinate(-1, -1, -1)} style={{ ...addBtn, color: "#ffffff", borderColor: "#2a3a20" }}>▶ Sim All</button>}
                <button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a", borderColor: "#3a2020" }}>Reset</button>
              </div>
            </div>

            {/* Draw log */}
            {tDrawLog.length > 0 && (<details style={{ marginBottom: 16 }}><summary style={{ fontSize: 10, color: "#7889a0", cursor: "pointer", ...mono, letterSpacing: 2 }}><span className="dta">▶</span>DRAW LOG ({tDrawLog.length} placements)</summary><div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 5, padding: 10, marginTop: 8, maxHeight: 200, overflowY: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#7889a0" }}><th style={{ padding: "2px 4px", textAlign: "left" }}>Pot</th><th style={{ padding: "2px 4px", textAlign: "left" }}>Team</th><th style={{ padding: "2px 4px", textAlign: "center" }}>Skill</th><th style={{ padding: "2px 4px", textAlign: "center" }}>Group</th></tr></thead><tbody>{tDrawLog.map((e, i) => (<tr key={i} style={{ borderTop: "1px solid #141c2b" }}><td style={{ padding: "2px 4px", color: "#7889a0" }}>{e.pot}</td><td style={{ padding: "2px 4px", color: "#7889a0" }}>{e.team}</td><td style={{ padding: "2px 4px", color: "#7889a0", textAlign: "center" }}>{e.skill}</td><td style={{ padding: "2px 4px", color: "#7889a0", fontWeight: 700, textAlign: "center" }}>{e.group}</td></tr>))}</tbody></table></div></details>)}

            {/* Standings */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 2)}, 1fr)`, gap: 10, marginBottom: 20 }}>
              {tGroups.map((g, gi) => { const form = computeForm(g); const N = g.standings.length; return (<div key={gi} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 7, padding: "12px 10px", boxShadow: "0 1px 6px #00000018" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0", textAlign: "center", marginBottom: 8 }}>{tConfig.numGroups === 1 ? "LEAGUE TABLE" : "GROUP " + g.label}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#7889a0" }}><th style={{ padding: "2px", fontWeight: 400, width: 20 }}>#</th><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>W</th><th style={{ padding: "2px", fontWeight: 400 }}>D</th><th style={{ padding: "2px", fontWeight: 400 }}>L</th><th style={{ padding: "2px", fontWeight: 400 }}>GF</th><th style={{ padding: "2px", fontWeight: 400 }}>GA</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th><th style={{ padding: "2px 2px 2px 6px", fontWeight: 400, textAlign: "right", width: 1, whiteSpace: "nowrap" }}>Form</th></tr></thead>
                  <tbody>{g.standings.map((r, ri) => { const zone = zoneFor(ri, N, tConfig.qualZones); return (<tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#141c2b66" }}><td style={{ padding: "2px 4px 2px 2px", textAlign: "right", ...mono, fontSize: 9, color: "#7889a0", width: 20 }}>{ri + 1}</td><td style={{ padding: "3px 3px 3px 4px", color: zone ? zone.color : "#8892a6", fontWeight: zone ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderLeft: zone ? "2px solid " + zone.color : "2px solid transparent" }}>{r.name}{ri < N - 1 && areTied(r, g.standings[ri+1], tConfig.tiebreakers, g.schedule) && <button onClick={e => { e.stopPropagation(); tSwapStandings(gi, ri); }} title="Swap with team below (manual tiebreak)" style={{ background: "none", border: "1px solid #d0877044", borderRadius: 3, color: "#d08770", fontSize: 8, cursor: "pointer", padding: "0 4px", fontFamily: "inherit", marginLeft: 6 }}>⇅</button>}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.p}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.w}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.d}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.l}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.gf}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.ga}</td><td style={{ padding: "2px", textAlign: "center", ...mono, color: r.gf - r.ga > 0 ? "#ffffff" : r.gf - r.ga < 0 ? "#bf616a" : "#7889a0" }}>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td><td style={{ padding: "2px", color: "#7889a0", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td><td style={{ padding: "2px 0 2px 6px", width: 1, whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>{(form[r.name] || []).slice(-5).map((f, fi) => (<span key={fi} title={f.bye ? "Bye" : (f.home ? "vs " : "@ ") + f.opp + " " + f.gf + "–" + f.ga} style={{ width: 15, height: 15, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, ...mono, flexShrink: 0, background: f.r === "W" ? "#26402a" : f.r === "D" ? "#3a3520" : "#43282a", color: f.r === "W" ? "#8fbf8f" : f.r === "D" ? "#ebcb8b" : "#e08a8a" }}>{f.r}</span>))}{(form[r.name] || []).length === 0 && <span style={{ color: "#7889a0", fontSize: 9 }}>—</span>}</div></td></tr>); })}</tbody></table>
                {qz.length > 0 && <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: "1px solid #141c2b" }}>{tConfig.qualZones.map((z, zi) => (<div key={zi} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: z.color }} /><span style={{ fontSize: 10, color: "#8892a6" }}>{z.label}</span></div>))}</div>}
              </div>); })}
            </div>

            {/* Live Pool Ranking — best-of zones */}
            {(() => {
              const bestZones = qz.filter(z => z.type === "best");
              if (bestZones.length === 0 || tGroups.length === 0) return null;
              const pool = [];
              tGroups.forEach(g => {
                const N = g.standings.length;
                g.standings.forEach((r, ri) => {
                  for (const z of bestZones) {
                    const pos = z.anchor === "top" ? ri + 1 : N - ri;
                    if (pos >= z.from && pos <= z.to) { pool.push({ ...r, groupLabel: g.label, groupPos: ri + 1 }); return; }
                  }
                });
              });
              pool.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || b.skill - a.skill);
              const bestCount = bestZones.reduce((s, z) => s + (z.bestCount || 0), 0);
              const bestZone = bestZones[0];
              if (pool.length === 0) return null;
              const form = {};
              tGroups.forEach(g => { const gf = computeForm(g); Object.assign(form, gf); });
              return (
              <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 7, padding: "12px 10px", marginBottom: 20, boxShadow: "0 1px 6px #00000018" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: bestZone?.color || "#4a7ab5", textAlign: "center", marginBottom: 8 }}>{bestZone?.label?.toUpperCase() || "POOL QUALIFICATION"} — POOL RANKING</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#7889a0" }}><th style={{ padding: "2px", fontWeight: 400, width: 20 }}>#</th><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>Grp</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>W</th><th style={{ padding: "2px", fontWeight: 400 }}>D</th><th style={{ padding: "2px", fontWeight: 400 }}>L</th><th style={{ padding: "2px", fontWeight: 400 }}>GF</th><th style={{ padding: "2px", fontWeight: 400 }}>GA</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th><th style={{ padding: "2px 2px 2px 6px", fontWeight: 400, textAlign: "right", width: 1, whiteSpace: "nowrap" }}>Form</th></tr></thead>
                <tbody>{pool.map((r, ri) => { const qual = ri < bestCount; return (<tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#141c2b66" }}><td style={{ padding: "2px 4px", ...mono, fontSize: 9, color: "#7889a0", textAlign: "right", width: 20 }}>{ri + 1}</td><td style={{ padding: "3px 3px 3px 4px", color: qual ? (bestZone?.color || "#4a7ab5") : "#7889a0", fontWeight: qual ? 600 : 400, borderLeft: qual ? "2px solid " + (bestZone?.color || "#4a7ab5") : "2px solid transparent", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</td><td style={{ padding: "2px", ...mono, fontSize: 9, color: "#7889a0", textAlign: "center" }}>{r.groupLabel}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.p}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.w}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.d}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.l}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.gf}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.ga}</td><td style={{ padding: "2px", textAlign: "center", ...mono, color: r.gf - r.ga > 0 ? "#ffffff" : r.gf - r.ga < 0 ? "#bf616a" : "#7889a0" }}>{r.gf-r.ga>0?"+":""}{r.gf-r.ga}</td><td style={{ padding: "2px", color: "#7889a0", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td><td style={{ padding: "2px 0 2px 6px", width: 1, whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>{(form[r.name] || []).slice(-5).map((f, fi) => (<span key={fi} title={f.bye ? "Bye" : (f.home ? "vs " : "@ ") + f.opp + " " + f.gf + "–" + f.ga} style={{ width: 15, height: 15, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, ...mono, flexShrink: 0, background: f.r === "W" ? "#26402a" : f.r === "D" ? "#3a3520" : "#43282a", color: f.r === "W" ? "#8fbf8f" : f.r === "D" ? "#ebcb8b" : "#e08a8a" }}>{f.r}</span>))}{(form[r.name] || []).length === 0 && <span style={{ color: "#7889a0", fontSize: 9 }}>—</span>}</div></td></tr>); })}</tbody></table>
                {bestCount > 0 && <div style={{ display: "flex", gap: 14, marginTop: 8, paddingTop: 6, borderTop: "1px solid #141c2b" }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: bestZone?.color || "#4a7ab5" }} /><span style={{ fontSize: 10, color: "#8892a6" }}>Top {bestCount} qualify</span></div></div>}
              </div>);
            })()}

            {/* Fixtures - compact, scrollable per round */}
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0", marginBottom: 12 }}>FIXTURES</div>
              {(()=>{ const maxRds = Math.max(...tGroups.map(g => g.schedule.length)); const firstOpen = Array.from({length:maxRds},(_,ri)=>ri).findIndex(ri => !tGroups.every(g => (g.schedule[ri]||[]).every(m => m.result))); return Array.from({length:maxRds},(_,ri)=>ri).map(ri => { const rdDone = tGroups.every(g => (g.schedule[ri] || []).every(m => m.result)); return (<details key={ri} open={ri === firstOpen} style={{ marginBottom: 8 }}>
                <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", cursor: "pointer", userSelect: "none", borderBottom: "1px solid #2a3a50" }}>
                  <div style={{ fontSize: 10, color: "#7889a0", fontWeight: 600, letterSpacing: 2 }}><span className="dta">▶</span>ROUND {ri + 1} {rdDone && <span style={{ color: "#7889a0" }}>✓</span>}</div>
                  {!rdDone && ri === firstOpen && <button onClick={e => {e.preventDefault();tScorinate(-1, ri, -1)}} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ Sim Round</button>}
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 2)}, 1fr)`, gap: 6, padding: "8px 0 12px", borderBottom: "1px solid #2a3a50" }}>
                  {tGroups.map((g, gi) => (<div key={gi} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: "#7889a0", marginBottom: 2, letterSpacing: 1, ...mono }}>{g.label}</div>
                    {(g.schedule[ri] || []).map((m, mi) => { if (m.bye) return (<div key={mi} style={{ fontSize: 10, padding: "2px 0", borderBottom: "1px solid #121a12", display: "flex", alignItems: "center", gap: 2, minWidth: 0, color: "#7889a0" }}><span style={{ flex: 1 }}>{m.home?.name}</span><span style={{ ...mono, fontSize: 9 }}>BYE</span></div>); const editing = tEdit && tEdit.gi===gi && tEdit.ri===ri && tEdit.mi===mi; const haKey = `g_${gi}_${ri}_${mi}`; const haVal = tHomeAdvOverrides[haKey] || null; return (<div key={mi} style={{ fontSize: 10, padding: "2px 0", borderBottom: "1px solid #121a12", display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: m.result ? (m.result.ftHome > m.result.ftAway ? "#ffffff" : m.result.ftHome < m.result.ftAway ? "#7889a0" : "#ebcb8b") : "#888", fontSize: 10 }}>{haVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name}</span>
                      <button onClick={() => tToggleHA(haKey)} title={haVal === null ? "Auto" : haVal === "home" ? "Home advantage: Home" : haVal === "away" ? "Home advantage: Away" : "Home advantage: Off"} style={{ background: "none", border: "none", color: haVal === null ? "#7889a0" : haVal === "off" ? "#bf616a" : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, flexShrink: 0, opacity: haVal ? 1 : 0.4 }}>H</button>
                      {editing ? <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}><input type="number" min={0} value={tEdit.h} onChange={e => setTEdit(p => ({...p, h: e.target.value}))} style={{ width: 30, padding: "0 2px", fontSize: 10, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 2, color: "#ffffff", fontFamily: "inherit", lineHeight: "16px" }} /><span style={{ color: "#7889a0", fontSize: 8 }}>–</span><input type="number" min={0} value={tEdit.a} onChange={e => setTEdit(p => ({...p, a: e.target.value}))} style={{ width: 30, padding: "0 2px", fontSize: 10, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 2, color: "#ffffff", fontFamily: "inherit", lineHeight: "16px" }} /><button onClick={tSetManualScore} style={{ background: "#e4002b", border: "none", color: "#ffffff", fontSize: 8, cursor: "pointer", padding: "1px 5px", fontFamily: "inherit", borderRadius: 2, lineHeight: "14px" }}>OK</button><button onClick={() => { setTEdit(null); setTScoreError(""); }} style={{ background: "none", border: "none", color: "#bf616a", fontSize: 12, cursor: "pointer", padding: "0 2px", fontFamily: "inherit", lineHeight: "14px" }}>✗</button></span>
                        : m.result ? <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}><span style={{ ...mono, fontSize: 9, color: "#7889a0", fontWeight: 600 }}>{m.result.ftHome}-{m.result.ftAway}</span><button onClick={() => setTEdit({ gi, ri, mi, h: String(m.result.ftHome), a: String(m.result.ftAway) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 8, padding: "0 3px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button><button onClick={() => tDeleteGroupResult(gi, ri, mi)} title="Delete result and re-sim" style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#bf616a", fontSize: 8, padding: "0 3px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>🗑</button></span>
                        : ri === firstOpen ? <span style={{ display: "flex", gap: 2, flexShrink: 0 }}><button onClick={() => tScorinate(gi, ri, mi)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 8, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTEdit({ gi, ri, mi, h: "", a: "" })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 8, padding: "0 3px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"group",gi,ri,mi})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 8, padding: "0 3px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span> : <span style={{ ...mono, fontSize: 9, color: "#7889a0" }}>–</span>}
                      <span style={{ flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: m.result ? (m.result.ftAway > m.result.ftHome ? "#ffffff" : m.result.ftAway < m.result.ftHome ? "#7889a0" : "#ebcb8b") : "#888", fontSize: 10 }}>{m.away?.name}{haVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                    </div>); })}
                  </div>))}
                </div>
              </details>); }); })()}
            </div>

            {/* Swiss: generate next round */}
            {tConfig.matchFormat === "swiss" && tSwissCurrentDone && tSwissRoundsPlayed < tConfig.swissRounds && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#7889a0", marginBottom: 8, ...mono }}>Round {tSwissRoundsPlayed} complete — {tConfig.swissRounds - tSwissRoundsPlayed} remaining</div>
                <button onClick={tGenNextSwissRound} style={scBtn}>▶ Generate Round {tSwissRoundsPlayed + 1}</button>
              </div>
            )}

            {((tConfig.matchFormat === "roundRobin" && tPlayedMatches === tTotalMatches && tTotalMatches > 0) || tSwissAllDone) && (
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <div style={{ fontSize: 12, color: "#ffffff", marginBottom: 8, ...mono }}>✓ All {tConfig.numGroups === 1 ? "league " : "group "} matches complete</div>
                {tHasKO ? (tHasUnresolved ? <div style={{ background: "#141c2b", border: "1px solid #bf616a33", borderRadius: 8, padding: 16, textAlign: "center" }}><div style={{ fontSize: 11, color: "#bf616a", marginBottom: 8 }}>Tiebreaker required</div><div style={{ fontSize: 10, color: "#7889a0" }}>Teams are tied at a qualification boundary. Use the swap buttons (⇅) in the standings to resolve.</div></div> : <button onClick={tProceedKO} style={scBtn}>▶ Proceed to Knockout Stage</button>)
                  : (<div style={{ background: "#141c2b", border: "1px solid #e4002b33", borderRadius: 8, padding: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: 4, color: "#e4002b", marginBottom: 8, textShadow: "0 0 8px #e4002b66" }}>{tConfig.numGroups === 1 ? "🏆 CHAMPION" : "🏆 TOURNAMENT COMPLETE"}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#e4002b", textShadow: "0 0 12px #e4002b44" }}>{tGroups[0]?.standings[0]?.name}</div>
                    <div style={{ fontSize: 11, color: "#7889a0", marginTop: 4, ...mono }}>Champion — {tGroups[0]?.standings[0]?.pts} pts</div>
                  </div>)}
              </div>
            )}
          </div>)}

          {/* KNOCKOUT */}
          {(tPhase === "knockout" || tPhase === "complete") && tKO && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0" }}>KNOCKOUT STAGE</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {tPhase === "knockout" && <button onClick={() => tScorinateKO(-1, -1, 0)} style={{ ...addBtn, color: "#ffffff", borderColor: "#2a3a20" }}>▶ Sim All</button>}
                <button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a", borderColor: "#3a2020" }}>Reset</button>
              </div>
            </div>
            {tGroups.length > 0 && (<details style={{ marginBottom: 16 }}><summary style={{ fontSize: 10, color: "#7889a0", cursor: "pointer", letterSpacing: 2 }}><span className="dta">▶</span>GROUP STAGE RESULTS</summary><div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 2)}, 1fr)`, gap: 10, marginTop: 10 }}>
              {tGroups.map((g, gi) => { const form = computeForm(g); const N = g.standings.length; return (<div key={gi} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 7, padding: "12px 10px", boxShadow: "0 1px 6px #00000018" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0", textAlign: "center", marginBottom: 8 }}>{tConfig.numGroups === 1 ? "LEAGUE TABLE" : "GROUP " + g.label}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#7889a0" }}><th style={{ padding: "2px", fontWeight: 400, width: 20 }}>#</th><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>W</th><th style={{ padding: "2px", fontWeight: 400 }}>D</th><th style={{ padding: "2px", fontWeight: 400 }}>L</th><th style={{ padding: "2px", fontWeight: 400 }}>GF</th><th style={{ padding: "2px", fontWeight: 400 }}>GA</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th><th style={{ padding: "2px 2px 2px 6px", fontWeight: 400, textAlign: "right", width: 1, whiteSpace: "nowrap" }}>Form</th></tr></thead>
                  <tbody>{g.standings.map((r, ri) => { const zone = zoneFor(ri, N, tConfig.qualZones); return (<tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#141c2b66" }}><td style={{ padding: "2px 4px 2px 2px", textAlign: "right", ...mono, fontSize: 9, color: "#7889a0", width: 20 }}>{ri + 1}</td><td style={{ padding: "3px 3px 3px 4px", color: zone ? zone.color : "#8892a6", fontWeight: zone ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderLeft: zone ? "2px solid " + zone.color : "2px solid transparent" }}>{r.name}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.p}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.w}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.d}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.l}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.gf}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.ga}</td><td style={{ padding: "2px", textAlign: "center", ...mono, color: r.gf - r.ga > 0 ? "#ffffff" : r.gf - r.ga < 0 ? "#bf616a" : "#7889a0" }}>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td><td style={{ padding: "2px", color: "#7889a0", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td><td style={{ padding: "2px 0 2px 6px", width: 1, whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>{(form[r.name] || []).slice(-5).map((f, fi) => (<span key={fi} title={f.bye ? "Bye" : (f.home ? "vs " : "@ ") + f.opp + " " + f.gf + "–" + f.ga} style={{ width: 15, height: 15, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, ...mono, flexShrink: 0, background: f.r === "W" ? "#26402a" : f.r === "D" ? "#3a3520" : "#43282a", color: f.r === "W" ? "#8fbf8f" : f.r === "D" ? "#ebcb8b" : "#e08a8a" }}>{f.r}</span>))}{(form[r.name] || []).length === 0 && <span style={{ color: "#7889a0", fontSize: 9 }}>—</span>}</div></td></tr>); })}</tbody></table>
                {qz.length > 0 && <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: "1px solid #141c2b" }}>{tConfig.qualZones.map((z, zi) => (<div key={zi} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: z.color }} /><span style={{ fontSize: 10, color: "#8892a6" }}>{z.label}</span></div>))}</div>}
              </div>); })}
            </div>
            {tPoolData && tPoolData.pool.length > 0 && (() => { const bz = qz.find(z=>z.type==="best"); return (
              <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 7, padding: "12px 10px", marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: bz?.color || "#4a7ab5", textAlign: "center", marginBottom: 8 }}>{bz?.label?.toUpperCase() || "POOL QUALIFICATION"}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#7889a0" }}><th style={{ padding: "2px", fontWeight: 400, width: 20 }}>#</th><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>Grp</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>W</th><th style={{ padding: "2px", fontWeight: 400 }}>D</th><th style={{ padding: "2px", fontWeight: 400 }}>L</th><th style={{ padding: "2px", fontWeight: 400 }}>GF</th><th style={{ padding: "2px", fontWeight: 400 }}>GA</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th></tr></thead>
                <tbody>{tPoolData.pool.map((r, ri) => { const qual = ri < tPoolData.poolQualified.length; return (<tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#141c2b66" }}><td style={{ padding: "2px 4px", ...mono, fontSize: 9, color: "#7889a0", textAlign: "right", width: 20 }}>{ri + 1}</td><td style={{ padding: "3px 3px 3px 4px", color: qual ? (bz?.color||"#4a7ab5") : "#7889a0", fontWeight: qual ? 600 : 400, borderLeft: qual ? "2px solid "+(bz?.color||"#4a7ab5") : "2px solid transparent" }}>{r.name}</td><td style={{ padding: "2px", ...mono, fontSize: 9, color: "#7889a0", textAlign: "center" }}>{r.groupLabel}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.p}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.w}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.d}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.l}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.gf}</td><td style={{ padding: "2px", color: "#7889a0", textAlign: "center", ...mono }}>{r.ga}</td><td style={{ padding: "2px", textAlign: "center", ...mono, color: r.gf - r.ga > 0 ? "#ffffff" : r.gf - r.ga < 0 ? "#bf616a" : "#7889a0" }}>{r.gf-r.ga>0?"+":""}{r.gf-r.ga}</td><td style={{ padding: "2px", color: "#7889a0", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td></tr>); })}</tbody></table>
              </div>); })()}
            </details>)}
            {tKODrawLog.length > 0 && (<details style={{ marginBottom: 16 }}><summary style={{ fontSize: 10, color: "#7889a0", cursor: "pointer", ...mono, letterSpacing: 2 }}><span className="dta">▶</span>BRACKET DRAW LOG ({tKODrawLog.length} pairings)</summary><div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 5, padding: 10, marginTop: 8, maxHeight: 200, overflowY: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#7889a0" }}><th style={{ padding: "2px 4px", textAlign: "left" }}>Home</th><th style={{ padding: "2px 4px", textAlign: "center" }}>vs</th><th style={{ padding: "2px 4px", textAlign: "right" }}>Away</th></tr></thead><tbody>{tKODrawLog.map((e, i) => (<tr key={i} style={{ borderTop: "1px solid #141c2b" }}><td style={{ padding: "2px 4px", color: "#7889a0" }}>{e.home} <span style={{ color: "#7889a0" }}>({e.homeSkill})</span></td><td style={{ padding: "2px 4px", color: "#7889a0", textAlign: "center" }}>vs</td><td style={{ padding: "2px 4px", color: "#7889a0", textAlign: "right" }}>{e.away} <span style={{ color: "#7889a0" }}>({e.awaySkill})</span></td></tr>))}</tbody></table></div></details>)}
            {tPhase === "complete" && tKO.champion && (
              <div style={{ textAlign: "center", background: "linear-gradient(145deg, #141c2b 0%, #1a1c12 50%, #141c2b 100%)", border: "1px solid #e4002b44", borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: "0 4px 24px #e4002b22, 0 0 40px #e4002b11" }}>
                <div style={{ fontSize: 10, letterSpacing: 6, color: "#e4002b", marginBottom: 10, textShadow: "0 0 8px #e4002b66" }}>🏆 CHAMPION</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#e4002b", textShadow: "0 0 12px #e4002b44" }}>{tKO.champion.name}</div>
                <div style={{ fontSize: 11, color: "#7889a0", marginTop: 6, ...mono }}>{tKO.champion.skill}</div>
              </div>
            )}
            {/* Bracket/Stacked toggle */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              <button onClick={() => setKoBracketView(true)} className={koBracketView ? "gbtn" : ""} style={{ ...chip, fontSize: 9, background: koBracketView ? "#e4002b" : "#141c2b", color: koBracketView ? "#ffffff" : "#7889a0", border: "1px solid " + (koBracketView ? "#e4002b" : "#7889a033") }}>Bracket</button>
              <button onClick={() => setKoBracketView(false)} className={!koBracketView ? "gbtn" : ""} style={{ ...chip, fontSize: 9, background: !koBracketView ? "#e4002b" : "#141c2b", color: !koBracketView ? "#ffffff" : "#7889a0", border: "1px solid " + (!koBracketView ? "#e4002b" : "#7889a033") }}>Stacked</button>
              {koBracketView && <button onClick={tKO.losers ? exportDEBracket : exportBracket} style={{ ...chip, fontSize: 9, background: "#141c2b", color: "#81a1c1", border: "1px solid #81a1c133", marginLeft: 4, cursor: "pointer" }}>📷 Export</button>}
            </div>

            {koBracketView && !tKO.losers && (() => {
              const nR = tKO.rounds.length;
              const firstRd = tKO.rounds[0];
              const half = firstRd.matches.length / 2;
              const cardH = 52, gap = 6;
              const colW = 170, connW = 20, hdrH = 15;

              const miniCard = (m, ri, mi, actualMi) => {
                const koHAKey = ri === -2 ? "tp" : `ko_${ri}_${mi}`;
                const koHAVal = tHomeAdvOverrides[koHAKey] || null;
                const w = koWinner(m);
                const isPartial = m.result?.partial;
                const is2L = m.result?.twoLeg;
                const isBye = m.bye;
                // Single-leg scores
                const sH = m.result && !is2L ? m.result.ftHome + (m.result.et?.home||0) : "";
                const sA = m.result && !is2L ? m.result.ftAway + (m.result.et?.away||0) : "";
                const hasET = m.result && !is2L && m.result.et && (m.result.et.home || m.result.et.away);
                const hasPen = m.result?.pen;
                // Two-leg scores: leg2 is flipped (away team hosts L2)
                const l1H = is2L && m.result.leg1 ? m.result.leg1.home : "";
                const l1A = is2L && m.result.leg1 ? m.result.leg1.away : "";
                const l2H = is2L && !isPartial && m.result.leg2 ? m.result.leg2.away : "";
                const l2A = is2L && !isPartial && m.result.leg2 ? m.result.leg2.home : "";
                const aggH = is2L && !isPartial && m.result.agg ? m.result.agg.home : "";
                const aggA = is2L && !isPartial && m.result.agg ? m.result.agg.away : "";
                const has2LET = is2L && !isPartial && m.result.et;
                const has2LPen = is2L && !isPartial && m.result.pen;
                const has2LAG = is2L && !isPartial && !m.result.et && !m.result.pen && m.result.awayGoalsRule && m.result.agg?.home === m.result.agg?.away;
                const decLabel = m.result && !isPartial && (hasET || hasPen || has2LET || has2LPen || has2LAG) ? (hasPen || has2LPen ? "PENS" : has2LAG ? "AG" : "AET") : null;
                const decClr = hasPen || has2LPen ? "#d08770" : "#7889a0";
                const winner = w;
                const scoreW = is2L && !isPartial ? { display: "flex", alignItems: "baseline", gap: 0, textAlign: "right", ...mono, fontSize: 9, whiteSpace: "nowrap", flexShrink: 0 } : { textAlign: "right", ...mono, fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 };
                const nameClr = (team) => w === team ? "#ffffff" : isBye && !team ? "#7889a0" : "#888";
                const nameWt = (team) => w === team ? 600 : 400;
                const sClr = (team) => w === team ? "#ffffff" : "#7889a0";
                return (
                  <div style={{ background: "#141c2b", borderRadius: 4, padding: "4px 6px", border: ri === nR - 1 ? "2px solid #e4002b66" : ri === -2 ? "1px solid #d0877044" : "1px solid #2a3a50", width: colW, height: cardH - gap, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                      <span style={{ color: nameClr(m.home), fontWeight: nameWt(m.home), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, position: "relative" }}>{koHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 6, marginRight: 1 }}>H</span>}{m.home?.name || (isBye ? "BYE" : "TBD")}{decLabel && winner === m.home && <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: decClr, fontWeight: 700, fontStyle: "italic", ...ui, background: "linear-gradient(90deg, transparent 0%, #141c2b 30%)", paddingLeft: 10, paddingRight: 4 }}>{decLabel}</span>}</span>
                      {is2L && !isPartial ? <span style={scoreW}><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l1H}</span><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l2H}</span><span style={{ color: sClr(m.home), fontWeight: 600, width: 20, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{aggH}</span>{has2LPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400, flexShrink: 0 }}> ({m.result.pen.home})</span>}</span>
                        : <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, color: sClr(m.home), fontWeight: 600, ...mono, fontSize: 10, whiteSpace: "nowrap" }}><span>{is2L && isPartial ? l1H : sH}</span>{hasPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}>({m.result.pen.home})</span>}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                      <span style={{ color: nameClr(m.away), fontWeight: nameWt(m.away), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, position: "relative" }}>{koHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 6, marginRight: 1 }}>H</span>}{m.away?.name || (isBye ? "BYE" : "TBD")}{decLabel && winner === m.away && <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: decClr, fontWeight: 700, fontStyle: "italic", ...ui, background: "linear-gradient(90deg, transparent 0%, #141c2b 30%)", paddingLeft: 10, paddingRight: 4 }}>{decLabel}</span>}</span>
                      {is2L && !isPartial ? <span style={scoreW}><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l1A}</span><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l2A}</span><span style={{ color: sClr(m.away), fontWeight: 600, width: 20, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{aggA}</span>{has2LPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400, flexShrink: 0 }}> ({m.result.pen.away})</span>}</span>
                        : <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, color: sClr(m.away), fontWeight: 600, ...mono, fontSize: 10, whiteSpace: "nowrap" }}><span>{is2L && isPartial ? l1A : sA}</span>{hasPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}>({m.result.pen.away})</span>}</span>}
                    </div>

                    {m.home && m.away && (!m.result || isPartial) && !isBye && (
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 1 }}>
                        {isPartial ? <button onClick={() => tScorinateKO(ri, ri === -2 ? -2 : mi, 2)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 2, color: "#81a1c1", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button>
                          : <button onClick={() => tScorinateKO(ri, ri === -2 ? -2 : mi)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 2, color: "#7889a0", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶</button>}
                        <button onClick={() => tPlayLive(ri === -2 ? {type:"ko",ri:0,mi:0,tp:true,leg:isPartial?2:1} : {type:"ko",ri,mi,leg:isPartial?2:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 2, color: "#81a1c1", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }} title={isPartial?"Play L2 live":"Play live"}>{isPartial?"⚽L2":"⚽"}</button>
                        <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? "#e4002b" : "#7889a066", fontSize: 7, cursor: "pointer", padding: "0 2px", fontFamily: "inherit", fontWeight: 700 }}>H</button>
                      </div>
                    )}
                  </div>
                );
              };

              const renderCol = (matches, ri, side) => {
                const n = matches.length;
                const slotH = actualH / n;
                return (
                  <div style={{ position: "relative", height: actualH, width: colW, flexShrink: 0 }}>
                    {matches.map((m, mi) => {
                      if (m.bye) return null;
                      const actualMi = side === "right" ? mi + n : mi;
                      const top = (mi + 0.5) * slotH - (cardH - gap) / 2;
                      return <div key={mi} style={{ position: "absolute", top, left: 0 }}>{miniCard(m, ri, actualMi, actualMi)}</div>;
                    })}
                  </div>
                );
              };

              const connector = (srcMatches, side) => {
                const n = srcMatches.length;
                const slotH = actualH / n;
                const pairs = Math.floor(n / 2);
                return (
                  <svg style={{ width: connW, height: actualH, flexShrink: 0, marginTop: hdrH }}>
                    {Array.from({ length: pairs }, (_, i) => {
                      const m1 = srcMatches[2*i], m2 = srcMatches[2*i+1];
                      if (m1.bye && m2.bye) return null;
                      const y1 = (2*i + 0.5) * slotH;
                      const y2 = (2*i + 1.5) * slotH;
                      const midY = (y1 + y2) / 2;
                      const hasTop = !m1.bye, hasBot = !m2.bye;
                      return (
                        <g key={i}>
                          {side === "left" ? <>
                            {hasTop && <line x1={0} y1={y1} x2={connW/2} y2={y1} stroke="#7889a0" strokeWidth={1} />}
                            {hasBot && <line x1={0} y1={y2} x2={connW/2} y2={y2} stroke="#7889a0" strokeWidth={1} />}
                            <line x1={connW/2} y1={hasTop ? y1 : midY} x2={connW/2} y2={hasBot ? y2 : midY} stroke="#7889a0" strokeWidth={1} />
                            <line x1={connW/2} y1={midY} x2={connW} y2={midY} stroke="#7889a0" strokeWidth={1} />
                          </> : <>
                            {hasTop && <line x1={connW} y1={y1} x2={connW/2} y2={y1} stroke="#7889a0" strokeWidth={1} />}
                            {hasBot && <line x1={connW} y1={y2} x2={connW/2} y2={y2} stroke="#7889a0" strokeWidth={1} />}
                            <line x1={connW/2} y1={hasTop ? y1 : midY} x2={connW/2} y2={hasBot ? y2 : midY} stroke="#7889a0" strokeWidth={1} />
                            <line x1={connW/2} y1={midY} x2={0} y2={midY} stroke="#7889a0" strokeWidth={1} />
                          </>}
                        </g>
                      );
                    })}
                    {n % 2 === 1 && (() => {
                      const y = (n - 0.5) * slotH;
                      const hasSrc = !srcMatches[n-1].bye;
                      if (!hasSrc) return null;
                      return side === "left"
                        ? <line x1={0} y1={y} x2={connW} y2={y} stroke="#7889a0" strokeWidth={1} />
                        : <line x1={connW} y1={y} x2={0} y2={y} stroke="#7889a0" strokeWidth={1} />;
                    })()}
                  </svg>
                );
              };

              const leftRounds = [];
              const rightRounds = [];
              // Find first round with at least one real (non-bye) match
              let firstReal = 0;
              for (let ri = 0; ri < nR - 1; ri++) {
                if (tKO.rounds[ri].matches.some(m => !m.bye)) { firstReal = ri; break; }
              }
              for (let ri = firstReal; ri < nR - 1; ri++) {
                const rd = tKO.rounds[ri];
                const h = rd.matches.length / 2;
                leftRounds.push({ matches: rd.matches.slice(0, h), ri, name: rd.name });
                rightRounds.push({ matches: rd.matches.slice(h), ri, name: rd.name });
              }
              // Recalculate height based on first displayed round
              const dispHalf = leftRounds.length > 0 ? leftRounds[0].matches.length : 1;
              const actualH = Math.max(dispHalf, 2) * (cardH + gap);

              return (
                <div id="bracket-export" style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, marginBottom: 12, overflowX: "auto" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: "fit-content" }}>
                    {/* Left half */}
                    {leftRounds.map((lr, i) => (<>
                      {i > 0 && connector(leftRounds[i-1].matches, "left")}
                      <div key={"l"+i} style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#7889a0", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>{lr.name}</div>
                        {renderCol(lr.matches, lr.ri, "left")}
                      </div>
                    </>))}
                    {/* Left → Center connector */}
                    {leftRounds.length > 0 && connector(leftRounds[leftRounds.length-1].matches, "left")}
                    {/* Center: Final + 3rd Place — pixel positions matching SVG export */}
                    {(() => {
                      const cAH = cardH - gap;
                      const fTop = actualH / 2 - cAH / 2;
                      const tpTop = fTop + cAH + 24;
                      const centerH = tKO.thirdPlace ? tpTop + cAH : actualH;
                      return (
                        <div style={{ flexShrink: 0, marginTop: hdrH, position: "relative", height: centerH, width: colW }}>
                          <div style={{ position: "absolute", top: fTop - 14, left: 0, right: 0, fontSize: 8, color: "#7889a0", textAlign: "center", letterSpacing: 1, fontWeight: 600 }}>FINAL</div>
                          <div style={{ position: "absolute", top: fTop, left: 0, right: 0 }}>{miniCard(tKO.rounds[nR-1].matches[0], nR-1, 0, 0)}</div>
                          {tKO.thirdPlace && <>
                            <div style={{ position: "absolute", top: tpTop - 14, left: 0, right: 0, fontSize: 8, color: "#d08770", textAlign: "center", letterSpacing: 1, fontWeight: 600 }}>3RD PLACE</div>
                            <div style={{ position: "absolute", top: tpTop, left: 0, right: 0 }}>{miniCard(tKO.thirdPlace, -2, 0, 0)}</div>
                          </>}
                        </div>
                      );
                    })()}
                    {/* Center → Right connector */}
                    {rightRounds.length > 0 && connector(rightRounds[rightRounds.length-1].matches, "right")}
                    {/* Right half (reversed) */}
                    {[...rightRounds].reverse().map((rr, i, arr) => (<>
                      <div key={"r"+i} style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#7889a0", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>{rr.name}</div>
                        {renderCol(rr.matches, rr.ri, "right")}
                      </div>
                      {i < arr.length - 1 && connector(arr[i+1].matches, "right")}
                    </>))}
                  </div>
                </div>
              );
            })()}
            {/* ═══ DE BRACKET VIEW ═══ */}
            {koBracketView && tKO.losers && (() => {
              const nR = tKO.rounds.length;
              const cardH = 52, gap = 6, colW = 170, connW = 20, hdrH = 15;
              let wbFirst = 0;
              for (let ri = 0; ri < nR; ri++) { if (tKO.rounds[ri].matches.some(m => !m.bye)) { wbFirst = ri; break; } }
              const wbRounds = tKO.rounds.slice(wbFirst);
              const wbN0 = wbRounds[0].matches.length;
              const wbH = Math.max(wbN0, 2) * (cardH + gap);
              const lbN0 = tKO.losers[0].matches.length;
              const lbH = Math.max(lbN0, 2) * (cardH + gap);

              const deMiniCard = (m, bk, ri, mi) => {
                const haKey = bk === "wb" ? `ko_${ri}_${mi}` : bk === "lb" ? `lb_${ri}_${mi}` : bk;
                const haVal = tHomeAdvOverrides[haKey] || null;
                const w = koWinner(m);
                const isPartial = m.result?.partial;
                const is2L = m.result?.twoLeg;
                const isBye = m.bye;
                const sH = m.result && !is2L ? m.result.ftHome + (m.result.et?.home||0) : "";
                const sA = m.result && !is2L ? m.result.ftAway + (m.result.et?.away||0) : "";
                const hasET = m.result && !is2L && m.result.et && (m.result.et.home || m.result.et.away);
                const hasPen = m.result?.pen;
                const l1H = is2L && m.result.leg1 ? m.result.leg1.home : "";
                const l1A = is2L && m.result.leg1 ? m.result.leg1.away : "";
                const l2H = is2L && !isPartial && m.result.leg2 ? m.result.leg2.away : "";
                const l2A = is2L && !isPartial && m.result.leg2 ? m.result.leg2.home : "";
                const aggH = is2L && !isPartial && m.result.agg ? m.result.agg.home : "";
                const aggA = is2L && !isPartial && m.result.agg ? m.result.agg.away : "";
                const has2LET = is2L && !isPartial && m.result.et;
                const has2LPen = is2L && !isPartial && m.result.pen;
                const has2LAG = is2L && !isPartial && !m.result.et && !m.result.pen && m.result.awayGoalsRule && m.result.agg?.home === m.result.agg?.away;
                const decLabel = m.result && !isPartial && (hasET || hasPen || has2LET || has2LPen || has2LAG) ? (hasPen || has2LPen ? "PENS" : has2LAG ? "AG" : "AET") : null;
                const decClr = hasPen || has2LPen ? "#d08770" : "#7889a0";
                const scoreW = is2L && !isPartial ? { display: "flex", alignItems: "baseline", gap: 0, textAlign: "right", ...mono, fontSize: 9, whiteSpace: "nowrap", flexShrink: 0 } : { textAlign: "right", ...mono, fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 };
                const nameClr = (t) => w === t ? "#ffffff" : isBye && !t ? "#7889a0" : "#888";
                const nameWt = (t) => w === t ? 600 : 400;
                const sClr = (t) => w === t ? "#ffffff" : "#7889a0";
                const borderStyle = bk === "gf" ? "2px solid #e4002b66" : bk === "reset" ? "1px solid #ebcb8b44" : "1px solid #2a3a50";
                const onSim = () => { if (bk === "wb") tScorinateKO(ri, mi, isPartial ? 2 : 0); else if (bk === "lb") tScorinateKO(ri, mi, isPartial ? 2 : 0, "lb"); else tScorinateKO(0, 0, 0, bk); };
                const onLive = () => { if (bk === "wb") tPlayLive({type:"ko",ri,mi,leg:isPartial?2:1}); else if (bk === "lb") tPlayLive({type:"ko",ri,mi,bracket:"lb",leg:isPartial?2:1}); else tPlayLive({type:"ko",ri:0,mi:0,bracket:bk,leg:isPartial?2:1}); };
                return (
                  <div style={{ background: "#141c2b", borderRadius: 4, padding: "4px 6px", border: borderStyle, width: colW, height: cardH - gap, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                      <span style={{ color: nameClr(m.home), fontWeight: nameWt(m.home), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, position: "relative" }}>{haVal === "home" && <span style={{ color: "#7889a0", fontSize: 6, marginRight: 1 }}>H</span>}{m.home?.name || (isBye ? "BYE" : "TBD")}{decLabel && w === m.home && <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: decClr, fontWeight: 700, fontStyle: "italic", ...ui, background: "linear-gradient(90deg, transparent 0%, #141c2b 30%)", paddingLeft: 10, paddingRight: 4 }}>{decLabel}</span>}</span>
                      {is2L && !isPartial ? <span style={scoreW}><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l1H}</span><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l2H}</span><span style={{ color: sClr(m.home), fontWeight: 600, width: 20, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{aggH}</span>{has2LPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400, flexShrink: 0 }}> ({m.result.pen.home})</span>}</span>
                        : <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, color: sClr(m.home), fontWeight: 600, ...mono, fontSize: 10, whiteSpace: "nowrap" }}><span>{is2L && isPartial ? l1H : sH}</span>{hasPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}>({m.result.pen.home})</span>}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                      <span style={{ color: nameClr(m.away), fontWeight: nameWt(m.away), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, position: "relative" }}>{haVal === "away" && <span style={{ color: "#7889a0", fontSize: 6, marginRight: 1 }}>H</span>}{m.away?.name || (isBye ? "BYE" : "TBD")}{decLabel && w === m.away && <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: decClr, fontWeight: 700, fontStyle: "italic", ...ui, background: "linear-gradient(90deg, transparent 0%, #141c2b 30%)", paddingLeft: 10, paddingRight: 4 }}>{decLabel}</span>}</span>
                      {is2L && !isPartial ? <span style={scoreW}><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l1A}</span><span style={{ color: "#7889a0", width: 16, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{l2A}</span><span style={{ color: sClr(m.away), fontWeight: 600, width: 20, flexShrink: 0, display: "inline-block", textAlign: "center" }}>{aggA}</span>{has2LPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400, flexShrink: 0 }}> ({m.result.pen.away})</span>}</span>
                        : <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, color: sClr(m.away), fontWeight: 600, ...mono, fontSize: 10, whiteSpace: "nowrap" }}><span>{is2L && isPartial ? l1A : sA}</span>{hasPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}>({m.result.pen.away})</span>}</span>}
                    </div>
                    {m.home && m.away && (!m.result || isPartial) && !isBye && (
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 1 }}>
                        {isPartial ? <button onClick={onSim} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 2, color: "#81a1c1", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button>
                          : <button onClick={onSim} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 2, color: "#7889a0", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶</button>}
                        <button onClick={onLive} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 2, color: "#81a1c1", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }} title={isPartial?"Play L2 live":"Play live"}>{isPartial?"⚽L2":"⚽"}</button>
                        <button onClick={() => tToggleHA(haKey)} style={{ background: "none", border: "none", color: haVal ? "#e4002b" : "#7889a066", fontSize: 7, cursor: "pointer", padding: "0 2px", fontFamily: "inherit", fontWeight: 700 }}>H</button>
                      </div>
                    )}
                  </div>
                );
              };

              const renderCol = (matches, height, bk, ri) => {
                const n = matches.length;
                const slotH = height / n;
                return (
                  <div style={{ position: "relative", height, width: colW, flexShrink: 0 }}>
                    {matches.map((m, mi) => {
                      if (m.bye) return null;
                      const top = (mi + 0.5) * slotH - (cardH - gap) / 2;
                      return <div key={mi} style={{ position: "absolute", top, left: 0 }}>{deMiniCard(m, bk, ri, mi)}</div>;
                    })}
                  </div>
                );
              };

              const pairConn = (srcMatches, height) => {
                const n = srcMatches.length;
                const slotH = height / n;
                const pairs = Math.floor(n / 2);
                return (
                  <svg style={{ width: connW, height, flexShrink: 0, marginTop: hdrH }}>
                    {Array.from({ length: pairs }, (_, i) => {
                      const m1 = srcMatches[2*i], m2 = srcMatches[2*i+1];
                      if (m1.bye && m2.bye) return null;
                      const y1 = (2*i + 0.5) * slotH, y2 = (2*i + 1.5) * slotH, midY = (y1 + y2) / 2;
                      return (
                        <g key={i}>
                          {!m1.bye && <line x1={0} y1={y1} x2={connW/2} y2={y1} stroke="#7889a0" strokeWidth={1} />}
                          {!m2.bye && <line x1={0} y1={y2} x2={connW/2} y2={y2} stroke="#7889a0" strokeWidth={1} />}
                          <line x1={connW/2} y1={!m1.bye ? y1 : midY} x2={connW/2} y2={!m2.bye ? y2 : midY} stroke="#7889a0" strokeWidth={1} />
                          <line x1={connW/2} y1={midY} x2={connW} y2={midY} stroke="#7889a0" strokeWidth={1} />
                        </g>
                      );
                    })}
                    {n % 2 === 1 && !srcMatches[n-1].bye && <line x1={0} y1={(n - 0.5) * slotH} x2={connW} y2={(n - 0.5) * slotH} stroke="#7889a0" strokeWidth={1} />}
                  </svg>
                );
              };

              const straightConn = (srcMatches, height) => {
                const n = srcMatches.length;
                const slotH = height / n;
                return (
                  <svg style={{ width: connW, height, flexShrink: 0, marginTop: hdrH }}>
                    {srcMatches.map((m, i) => m.bye ? null : <line key={i} x1={0} y1={(i + 0.5) * slotH} x2={connW} y2={(i + 0.5) * slotH} stroke="#7889a0" strokeWidth={1} />)}
                  </svg>
                );
              };

              const gfCardH = (cardH - gap) * 2 + 16;

              const gfConn = (height) => {
                const midY = height / 2;
                return (
                  <svg style={{ width: connW, height, flexShrink: 0, marginTop: hdrH }}>
                    <line x1={0} y1={midY} x2={connW} y2={midY} stroke="#7889a0" strokeWidth={1} />
                  </svg>
                );
              };

              return (
                <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, marginBottom: 12, overflowX: "auto" }}>
                  {/* WB + GF + Reset in one row */}
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#7889a0", marginBottom: 10 }}>WINNERS BRACKET</div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: "fit-content", marginBottom: 8 }}>
                    {wbRounds.map((rd, i) => (<Fragment key={"wb"+i}>
                      {i > 0 && pairConn(wbRounds[i-1].matches, wbH)}
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#7889a0", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>{rd.name}</div>
                        {renderCol(rd.matches, wbH, "wb", wbFirst + i)}
                      </div>
                    </Fragment>))}
                    {gfConn(wbH)}
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontSize: 8, color: "#e4002b", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>Grand Final</div>
                      {renderCol([tKO.grandFinal], wbH, "gf", 0)}
                    </div>
                    {tKO.reset && (tKO.reset.home || tKO.reset.away) && (<Fragment>
                      {gfConn(wbH)}
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#ebcb8b", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>RESET</div>
                        {renderCol([tKO.reset], wbH, "reset", 0)}
                      </div>
                    </Fragment>)}
                  </div>
                  {/* LB */}
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#7889a0", marginBottom: 10, marginTop: 8, borderTop: "1px solid #2a3a5033", paddingTop: 12 }}>LOSERS BRACKET</div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: "fit-content" }}>
                    {tKO.losers.map((rd, lr) => (<Fragment key={"lb"+lr}>
                      {lr > 0 && (rd.type === "internal" ? pairConn(tKO.losers[lr-1].matches, lbH) : straightConn(tKO.losers[lr-1].matches, lbH))}
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#7889a0", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>{rd.name}<span style={{ fontSize: 6, marginLeft: 3 }}>{rd.type === "dropin" ? "↓" : ""}</span></div>
                        {renderCol(rd.matches, lbH, "lb", lr)}
                      </div>
                    </Fragment>))}
                  </div>
                </div>
              );
            })()}
            {!koBracketView && tKO.rounds.map((round, ri) => { if (ri === tKO.rounds.length - 1 && !tKO.losers) return null; const rdDone = round.matches.every(m => m.result && !m.result.partial); const rdReady = round.matches.some(m => m.home && m.away && (!m.result || m.result.partial)); return (
              <div key={ri} style={{ background: "#141c2b", border: "1px solid " + (ri === tKO.rounds.length - 1 && tKO.losers ? "#e4002b33" : "#2a3a50"), borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#7889a0" }}>{(tKO.losers ? "WB " : "") + round.name.toUpperCase()}</div>
                  {rdReady && !rdDone && (tConfig.koLegs === 2 ? <span style={{ display: "flex", gap: 4 }}>
                    {round.matches.some(m => m.home && m.away && !m.result) && <button onClick={() => tScorinateKO(ri, -1, 1)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ 1st Legs</button>}
                    {round.matches.some(m => m.result?.partial) && <button onClick={() => tScorinateKO(ri, -1, 2)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ 2nd Legs</button>}
                    <button onClick={() => tScorinateKO(ri, -1, 0)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#81a1c1" }}>▶ Both Legs</button>
                  </span> : <button onClick={() => tScorinateKO(ri, -1)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ Sim Round</button>)}
                  {rdDone && <span style={{ fontSize: 9, color: "#7889a0", ...mono }}>✓</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: round.matches.length > 2 ? `repeat(${Math.min(round.matches.length, 2)}, 1fr)` : "1fr", gap: 8 }}>
                  {round.matches.map((m, mi) => { const koHAKey = `ko_${ri}_${mi}`; const koHAVal = tHomeAdvOverrides[koHAKey] || null; return (
                    <div key={mi} style={{ background: "#141c2b", borderRadius: 4, padding: "8px 10px", border: ri === tKO.rounds.length - 1 ? "1px solid #e4002b33" : "1px solid #2a3a50" }}>
                      {round.matches.length > 2 ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: m.result && koWinner(m) === m.home ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.home ? 600 : 400 }}>{koHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name || (m.bye ? "BYE" : "TBD")}</div>{m.home && m.away && <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? (koHAVal === "off" ? "#bf616a" : "#7889a0") : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: koHAVal ? 1 : 0.4 }}>H</button>}</div>
                          <div style={{ textAlign: "center", padding: "4px 0" }}>
                            {tKoEdit && tKoEdit.ri===ri && tKoEdit.mi===mi && !tKoEdit.tp && !tKoEdit.bracket ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>{tKoEdit.step === "l1" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 1:</span>}{tKoEdit.step === "l2" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 2 <span style={{color:"#7889a0"}}>(L1: {tKoEdit.l1h}–{tKoEdit.l1a})</span></span>}{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#7889a0"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#7889a0"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><span style={{ color: "#7889a0", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#e4002b", border: "none", color: "#ffffff", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3, letterSpacing: "0.05em" }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a50", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                              : m.result?.partial ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><span style={{ ...mono, fontSize: 10, color: "#81a1c1", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => tScorinateKO(ri, mi, 2)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:2})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play L2 live">⚽ L2</button></span>
                              : m.result ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><span style={{ ...mono, fontSize: 10, color: "#7889a0", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => setTKoEdit({ ri, mi, h: String(m.result.twoLeg ? m.result.leg1.home : m.result.ftHome), a: String(m.result.twoLeg ? m.result.leg1.away : m.result.ftAway), tp: false, ...(m.result.twoLeg ? {twoLeg:true, step:"l1", l2h:String(m.result.leg2?.away??0), l2a:String(m.result.leg2?.home??0)} : {}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button><button onClick={() => tDeleteKoResult(ri, mi, false)} title="Delete result and re-sim" style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#bf616a", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>🗑</button></span>
                              : m.home && m.away ? <span style={{ display: "flex", gap: 4, justifyContent: "center" }}><button onClick={() => tScorinateKO(ri, mi)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri, mi, h: "", a: "", tp: false, ...(tConfig.koLegs===2?{twoLeg:true,step:"l1"}:{}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                                : <span style={{ ...mono, fontSize: 10, color: "#7889a0" }}>–</span>}
                          </div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: m.result && koWinner(m) === m.away ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.away ? 600 : 400, textAlign: "right" }}>{m.away?.name || (m.bye ? "BYE" : "TBD")}{koHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.home ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.home ? 600 : 400, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{koHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name || (m.bye ? "BYE" : "TBD")}</span>
                          {m.home && m.away && <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? (koHAVal === "off" ? "#bf616a" : "#7889a0") : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: koHAVal ? 1 : 0.4 }}>H</button>}
                          {tKoEdit && tKoEdit.ri===ri && tKoEdit.mi===mi && !tKoEdit.tp && !tKoEdit.bracket ? <span style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 4px" }}>{tKoEdit.step === "l1" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 1:</span>}{tKoEdit.step === "l2" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 2 <span style={{color:"#7889a0"}}>(L1: {tKoEdit.l1h}–{tKoEdit.l1a})</span></span>}{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#7889a0"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#7889a0"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><span style={{ color: "#7889a0", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#e4002b", border: "none", color: "#ffffff", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3, letterSpacing: "0.05em" }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a50", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                            : m.result?.partial ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#81a1c1", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => tScorinateKO(ri, mi, 2)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:2})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play L2 live">⚽ L2</button></span>
                            : m.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#7889a0", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => setTKoEdit({ ri, mi, h: String(m.result.twoLeg ? m.result.leg1.home : m.result.ftHome), a: String(m.result.twoLeg ? m.result.leg1.away : m.result.ftAway), tp: false, ...(m.result.twoLeg ? {twoLeg:true, step:"l1", l2h:String(m.result.leg2?.away??0), l2a:String(m.result.leg2?.home??0)} : {}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button><button onClick={() => tDeleteKoResult(ri, mi, false)} title="Delete result and re-sim" style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#bf616a", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>🗑</button></span>
                            : m.home && m.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(ri, mi)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri, mi, h: "", a: "", tp: false, ...(tConfig.koLegs===2?{twoLeg:true,step:"l1"}:{}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                              : <span style={{ ...mono, fontSize: 10, color: "#7889a0", margin: "0 6px" }}>–</span>}
                          <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.away ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.away ? 600 : 400, flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.away?.name || (m.bye ? "BYE" : "TBD")}{koHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                        </div>
                      )}
                    </div>
                  ); })}
                </div>
              </div>
            ); })}
            {!koBracketView && !tKO.losers && tKO.thirdPlace && (()=>{ const tpHAVal = tHomeAdvOverrides["tp"] || null; return (
              <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#d08770", marginBottom: 10, ...mono }}>3RD PLACE MATCH</div>
                <div style={{ background: "#141c2b", borderRadius: 4, padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: tKO.thirdPlace.result && koWinner(tKO.thirdPlace) === tKO.thirdPlace.home ? "#ffffff" : "#7889a0", flex: 1 }}>{tpHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{tKO.thirdPlace.home?.name || "TBD"}</span>
                    {tKO.thirdPlace.home && tKO.thirdPlace.away && <button onClick={() => tToggleHA("tp")} style={{ background: "none", border: "none", color: tpHAVal ? (tpHAVal === "off" ? "#bf616a" : "#7889a0") : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: tpHAVal ? 1 : 0.4 }}>H</button>}
                    {tKoEdit && tKoEdit.tp ? <span style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 4px" }}>{tKoEdit.step === "l1" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 1:</span>}{tKoEdit.step === "l2" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 2 <span style={{color:"#7889a0"}}>(L1: {tKoEdit.l1h}–{tKoEdit.l1a})</span></span>}{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#7889a0"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#7889a0"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><span style={{ color: "#7889a0", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#e4002b", border: "none", color: "#ffffff", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3, letterSpacing: "0.05em" }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a50", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                      : tKO.thirdPlace.result?.partial ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#81a1c1", fontWeight: 600 }}>{koResultText(tKO.thirdPlace)}</span><button onClick={() => tScorinateKO(-2, -1, 2)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button><button onClick={() => tPlayLive({type:"ko",ri:0,mi:0,tp:true,leg:2})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play L2 live">⚽ L2</button></span>
                      : tKO.thirdPlace.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#7889a0", fontWeight: 600 }}>{koResultText(tKO.thirdPlace)}</span><button onClick={() => setTKoEdit({ ri: -2, mi: -1, h: String(tKO.thirdPlace.result.twoLeg ? tKO.thirdPlace.result.leg1.home : tKO.thirdPlace.result.ftHome), a: String(tKO.thirdPlace.result.twoLeg ? tKO.thirdPlace.result.leg1.away : tKO.thirdPlace.result.ftAway), tp: true, ...(tKO.thirdPlace.result.twoLeg ? {twoLeg:true, step:"l1", l2h:String(tKO.thirdPlace.result.leg2.away), l2a:String(tKO.thirdPlace.result.leg2.home)} : {}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button><button onClick={() => tDeleteKoResult(-2, -1, true)} title="Delete result and re-sim" style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#bf616a", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>🗑</button></span>
                      : tKO.thirdPlace.home && tKO.thirdPlace.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(-2, -1)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri: -2, mi: -1, h: "", a: "", tp: true, ...(tConfig.koLegs===2?{twoLeg:true,step:"l1"}:{}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri:0,mi:0,tp:true,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                        : <span style={{ ...mono, fontSize: 10, color: "#7889a0", margin: "0 6px" }}>–</span>}
                    <span style={{ fontSize: 11, color: tKO.thirdPlace.result && koWinner(tKO.thirdPlace) === tKO.thirdPlace.away ? "#ffffff" : "#7889a0", flex: 1, textAlign: "right" }}>{tKO.thirdPlace.away?.name || "TBD"}{tpHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                  </div>
                </div>
              </div>
            ); })()}
            {/* FINAL — rendered after 3rd place (single elim only) */}
            {!koBracketView && !tKO.losers && (()=>{ const ri = tKO.rounds.length - 1; const round = tKO.rounds[ri]; if (!round) return null; return (
              <div style={{ background: "#141c2b", border: "1px solid #e4002b33", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#7889a0" }}>{round.name?.toUpperCase()}</div>
                </div>
                {round.matches.map((m, mi) => { const koHAKey = `ko_${ri}_${mi}`; const koHAVal = tHomeAdvOverrides[koHAKey] || null; return (
                  <div key={mi} style={{ background: "#141c2b", borderRadius: 4, padding: "8px 10px", border: "1px solid #e4002b33", marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.home ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.home ? 600 : 400, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{koHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name || "TBD"}</span>
                      {m.home && m.away && <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? (koHAVal === "off" ? "#bf616a" : "#7889a0") : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: koHAVal ? 1 : 0.4 }}>H</button>}
                      {m.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#7889a0", fontWeight: 600 }}>{koResultText(m)}</span></span>
                        : m.home && m.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(ri, mi)} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri, mi, h: "", a: "", tp: false })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                        : <span style={{ ...mono, fontSize: 10, color: "#7889a0", margin: "0 6px" }}>–</span>}
                      <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.away ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.away ? 600 : 400, flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.away?.name || "TBD"}{koHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                    </div>
                  </div>
                ); })}
              </div>
            ); })()}
            {/* ═══ LOSERS BRACKET (double elim) ═══ */}
            {!koBracketView && tKO.losers && tKO.losers.map((lbRound, lr) => { const lbDone = lbRound.matches.every(m => (m.result && !m.result.partial) || (!m.home && !m.away)); const lbReady = lbRound.matches.some(m => m.home && m.away && (!m.result || m.result.partial)); return (
              <div key={"lb"+lr} style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#7889a0" }}>{lbRound.name.toUpperCase()}<span style={{ fontSize: 8, color: "#7889a0", marginLeft: 6 }}>{lbRound.type === "dropin" ? "DROP-IN" : "INTERNAL"}</span></div>
                  {lbReady && !lbDone && (tConfig.koLegs === 2 ? <span style={{ display: "flex", gap: 4 }}>
                    {lbRound.matches.some(m => m.home && m.away && !m.result) && <button onClick={() => tScorinateKO(lr, -1, 1, "lb")} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ 1st Legs</button>}
                    {lbRound.matches.some(m => m.result?.partial) && <button onClick={() => tScorinateKO(lr, -1, 2, "lb")} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ 2nd Legs</button>}
                    <button onClick={() => tScorinateKO(lr, -1, 0, "lb")} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ Both Legs</button>
                  </span> : <button onClick={() => tScorinateKO(lr, -1, 0, "lb")} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#7889a0" }}>▶ Sim Round</button>)}
                  {lbDone && <span style={{ fontSize: 9, color: "#7889a0", ...mono }}>✓</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: lbRound.matches.length > 2 ? "repeat(2, 1fr)" : "1fr", gap: 8 }}>
                  {lbRound.matches.map((m, mi) => { const lbHAKey = `lb_${lr}_${mi}`; const lbHAVal = tHomeAdvOverrides[lbHAKey] || null; return (
                    <div key={mi} style={{ background: "#141c2b", borderRadius: 4, padding: "8px 10px", border: "1px solid #d0877022" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.home ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.home ? 600 : 400, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lbHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name || (m.bye ? "BYE" : "TBD")}</span>
                        {m.home && m.away && <button onClick={() => tToggleHA(lbHAKey)} style={{ background: "none", border: "none", color: lbHAVal ? (lbHAVal === "off" ? "#bf616a" : "#7889a0") : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: lbHAVal ? 1 : 0.4 }}>H</button>}
                        {tKoEdit && tKoEdit.bracket === "lb" && tKoEdit.ri===lr && tKoEdit.mi===mi ? <span style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 4px" }}>{tKoEdit.step === "l1" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 1:</span>}{tKoEdit.step === "l2" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 2 <span style={{color:"#7889a0"}}>(L1: {tKoEdit.l1h}–{tKoEdit.l1a})</span></span>}{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#7889a0"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#7889a0"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><span style={{ color: "#7889a0", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#e4002b", border: "none", color: "#ffffff", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3 }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a50", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                          : m.result?.partial ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#81a1c1", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => tScorinateKO(lr, mi, 2, "lb")} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button><button onClick={() => tPlayLive({type:"ko",ri:lr,mi,bracket:"lb",leg:2})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play L2 live">⚽ L2</button></span>
                          : m.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#7889a0", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => setTKoEdit({ ri: lr, mi, h: String(m.result.twoLeg ? m.result.leg1.home : m.result.ftHome), a: String(m.result.twoLeg ? m.result.leg1.away : m.result.ftAway), bracket: "lb", ...(m.result.twoLeg ? {twoLeg:true, step:"l1", l2h:String(m.result.leg2?.away??0), l2a:String(m.result.leg2?.home??0)} : {}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button><button onClick={() => tDeleteKoResult(lr, mi, "lb")} title="Delete result" style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#bf616a", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>🗑</button></span>
                          : m.home && m.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(lr, mi, 0, "lb")} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri: lr, mi, h: "", a: "", bracket: "lb", ...(tConfig.koLegs===2?{twoLeg:true,step:"l1"}:{}) })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri:lr,mi,bracket:"lb",leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                            : m.bye ? <span style={{ ...mono, fontSize: 10, color: "#7889a0", margin: "0 6px" }}>BYE</span> : <span style={{ ...mono, fontSize: 10, color: "#7889a0", margin: "0 6px" }}>–</span>}
                        <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.away ? "#ffffff" : "#7889a0", fontWeight: m.result && koWinner(m) === m.away ? 600 : 400, flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.away?.name || (m.bye ? "BYE" : "TBD")}{lbHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
            ); })}
            {/* ═══ GRAND FINAL (double elim) ═══ */}
            {!koBracketView && tKO.losers && tKO.grandFinal && (() => { const gf = tKO.grandFinal; const gfHAKey = "gf"; const gfHAVal = tHomeAdvOverrides[gfHAKey] || null; return (
              <div style={{ background: "#141c2b", border: "1px solid #e4002b33", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#e4002b", marginBottom: 10 }}>GRAND FINAL</div>
                <div style={{ background: "#141c2b", borderRadius: 4, padding: "8px 10px", border: "1px solid #e4002b33" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: gf.result && koWinner(gf) === gf.home ? "#ffffff" : "#7889a0", fontWeight: gf.result && koWinner(gf) === gf.home ? 600 : 400, flex: 1 }}>{gfHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{gf.home?.name || "TBD"}<span style={{ fontSize: 8, color: "#7889a0", marginLeft: 4 }}>WB</span></span>
                    {gf.home && gf.away && <button onClick={() => tToggleHA(gfHAKey)} style={{ background: "none", border: "none", color: gfHAVal ? (gfHAVal === "off" ? "#bf616a" : "#7889a0") : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: gfHAVal ? 1 : 0.4 }}>H</button>}
                    {tKoEdit && tKoEdit.bracket === "gf" ? <span style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 4px" }}>{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#7889a0"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#7889a0"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><span style={{ color: "#7889a0", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#e4002b", border: "none", color: "#ffffff", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3 }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a50", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                      : gf.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#7889a0", fontWeight: 600 }}>{koResultText(gf)}</span><button onClick={() => setTKoEdit({ ri: 0, mi: 0, h: String(gf.result.ftHome), a: String(gf.result.ftAway), bracket: "gf" })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button><button onClick={() => tDeleteKoResult(0, 0, "gf")} title="Delete result" style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#bf616a", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>🗑</button></span>
                      : gf.home && gf.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(0, 0, 0, "gf")} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri: 0, mi: 0, h: "", a: "", bracket: "gf" })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri:0,mi:0,bracket:"gf",leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                      : <span style={{ ...mono, fontSize: 10, color: "#7889a0", margin: "0 6px" }}>–</span>}
                    <span style={{ fontSize: 11, color: gf.result && koWinner(gf) === gf.away ? "#ffffff" : "#7889a0", fontWeight: gf.result && koWinner(gf) === gf.away ? 600 : 400, flex: 1, textAlign: "right" }}>{gf.away?.name || "TBD"}<span style={{ fontSize: 8, color: "#7889a0", marginLeft: 4 }}>LB</span>{gfHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                  </div>
                </div>
              </div>
            ); })()}
            {/* ═══ RESET (double elim) ═══ */}
            {!koBracketView && tKO.losers && tKO.reset && (() => { const rs = tKO.reset; const rsHAKey = "reset"; const rsHAVal = tHomeAdvOverrides[rsHAKey] || null; if (!rs.home && !rs.away) return null; return (
              <div style={{ background: "#141c2b", border: "1px solid #ebcb8b33", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#ebcb8b", marginBottom: 10 }}>RESET MATCH</div>
                <div style={{ fontSize: 9, color: "#7889a0", marginBottom: 8 }}>LB winner won the Grand Final. Deciding match.</div>
                <div style={{ background: "#141c2b", borderRadius: 4, padding: "8px 10px", border: "1px solid #ebcb8b33" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: rs.result && koWinner(rs) === rs.home ? "#ffffff" : "#7889a0", fontWeight: rs.result && koWinner(rs) === rs.home ? 600 : 400, flex: 1 }}>{rsHAVal === "home" && <span style={{ color: "#7889a0", fontSize: 7, marginRight: 2 }}>H</span>}{rs.home?.name || "TBD"}</span>
                    {rs.home && rs.away && <button onClick={() => tToggleHA(rsHAKey)} style={{ background: "none", border: "none", color: rsHAVal ? (rsHAVal === "off" ? "#bf616a" : "#7889a0") : "#7889a0", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: rsHAVal ? 1 : 0.4 }}>H</button>}
                    {tKoEdit && tKoEdit.bracket === "reset" ? <span style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 4px" }}>{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#7889a0"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#7889a0"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><span style={{ color: "#7889a0", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 3, color: "#ffffff", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#e4002b", border: "none", color: "#ffffff", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3 }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a50", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                      : rs.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#7889a0", fontWeight: 600 }}>{koResultText(rs)}</span><button onClick={() => setTKoEdit({ ri: 0, mi: 0, h: String(rs.result.ftHome), a: String(rs.result.ftAway), bracket: "reset" })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button><button onClick={() => tDeleteKoResult(0, 0, "reset")} title="Delete result" style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#bf616a", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>🗑</button></span>
                      : rs.home && rs.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(0, 0, 0, "reset")} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#7889a0", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri: 0, mi: 0, h: "", a: "", bracket: "reset" })} style={{ background: "none", border: "1px solid #2a3a50", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri:0,mi:0,bracket:"reset",leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                      : <span style={{ ...mono, fontSize: 10, color: "#7889a0", margin: "0 6px" }}>–</span>}
                    <span style={{ fontSize: 11, color: rs.result && koWinner(rs) === rs.away ? "#ffffff" : "#7889a0", fontWeight: rs.result && koWinner(rs) === rs.away ? 600 : 400, flex: 1, textAlign: "right" }}>{rs.away?.name || "TBD"}{rsHAVal === "away" && <span style={{ color: "#7889a0", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                  </div>
                </div>
              </div>
            ); })()}
          </div>)}
        </div>)}

        {/* ═══ DOCS TAB ═══ */}
        {tab === "docs" && (<div style={{ lineHeight: 1.7, fontSize: 12, color: "#7889a0" }}>
          {(()=>{
            const H1 = ({children, id}) => <div id={id} style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0" }}>{children}</div>;
            const H2 = ({children, id}) => <div id={id} style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7889a0", marginTop: 24, marginBottom: 10, ...ui }}>{children}</div>;
            const H3 = ({children, id}) => <div id={id} style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", marginTop: 18, marginBottom: 8 }}>{children}</div>;
            const P = ({children}) => <p style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.7, color: "#7889a0" }}>{children}</p>;
            const Stat = ({text}) => {
              const items = text.split(" \u00b7 ").map(s => {
                const tempo = s.match(/^(Max|Min) tempo: (.+)$/);
                if (tempo) return { name: tempo[1] + " tempo", value: tempo[2], neutral: false, positive: false, isTempo: true };
                const m = s.match(/^(.+?)\s+([\+\-]?\d+\.?\d*x?)$/);
                if (!m) return { name: s, value: "", neutral: true };
                const isM = m[2].endsWith("x"); const n = parseFloat(m[2]);
                const neut = isM ? n === 1 : n === 0;
                return { name: m[1], value: m[2], neutral: neut, positive: isM ? n > 1 : n > 0, isMulti: isM };
              });
              return <details style={{ marginBottom: 12 }}><summary style={{ fontSize: 10, color: "#7889a0", cursor: "pointer" }}><span className="dta">▶</span>View modifiers</summary>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "3px 6px", padding: "8px 10px", background: "#141c2b", borderRadius: 5, marginTop: 6, border: "1px solid #2a3a50" }}>
                {items.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 8px", borderRadius: 3, background: it.neutral ? "transparent" : it.positive ? "#5e9c6b0a" : it.isTempo ? "#d087700a" : "#bf616a0a", borderLeft: it.neutral ? "2px solid transparent" : it.positive ? "2px solid #5e9c6b33" : it.isTempo ? "2px solid #d0877033" : "2px solid #bf616a33" }}>
                  <span style={{ color: "#7889a0", fontSize: 10 }}>{it.name}</span>
                  <span style={{ ...mono, fontSize: 10, fontWeight: it.neutral ? 400 : 600, color: it.neutral ? "#7889a0" : it.positive ? "#5e9c6b" : it.isTempo ? "#d08770" : "#bf616a" }}>{it.value}</span>
                </div>)}
              </div></details>;
            };
            const Mod = ({name, desc}) => <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 600, color: "#ffffff" }}>{name}</span> <span style={{ color: "#888" }}>{desc}</span></div>;
            const tocLink = (id, label) => <span key={id} onClick={() => { const el=document.getElementById(id); if(el){const d=el.closest("details");if(d)d.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);} }} style={{ cursor: "pointer", color: "#7889a0", fontSize: 13, fontWeight: 500 }}>{label}</span>;
            return (<>
            <div style={{ background: "#141c2b", border: "1px solid #2a3a50", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7889a0", marginBottom: 8 }}>Contents</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {tocLink("doc-overview", "Overview")}
                {tocLink("doc-engine", "How Matches Play Out")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  {[["doc-pitch","The Pitch"],["doc-minute","Minute Cycle"],["doc-buildup","Buildup & Long-range"],["doc-shooting","Shooting Zone"],["doc-shots","Shot Resolution"],["doc-counters","Counter-attacks"],["doc-corners","Corners"],["doc-fouls","Fouls, Cards & Offsides"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#7889a0", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                </div>
                {tocLink("doc-dynamics", "Match Dynamics")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  {[["doc-tempo","Tempo"],["doc-momentum","Momentum"],["doc-stamina","Stamina & Fatigue"],["doc-subs","Substitutions"],["doc-injuries","Injuries"],["doc-homeadv","Home Advantage"],["doc-stoppage","Stoppage Time"],["doc-extra","Extra Time & Penalties"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#7889a0", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                </div>
                {tocLink("doc-modifiers", "Modifiers")}
                {tocLink("doc-skill", "Skill")}
                {tocLink("doc-playstyles", "Playstyles")}
                {tocLink("doc-formations", "Formations")}
                {tocLink("doc-tactics", "Tactics")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  <span style={{ color: "#7889a0", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, marginTop: 8, marginBottom: 2 }}>IN POSSESSION</span>
                  {[["doc-tac-approach","Approach Play"],["doc-tac-passing","Passing Direction"],["doc-tac-chances","Chance Creation"],["doc-tac-dribbling","Dribbling"],["doc-tac-creativity","Creative Freedom"],["doc-tac-setpieces","Set Pieces"],["doc-tac-timewasting","Time Wasting"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#7889a0", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                  <span style={{ color: "#7889a0", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, marginTop: 10, marginBottom: 2 }}>TRANSITION</span>
                  {[["doc-tac-posslost","On Possession Lost"],["doc-tac-posswon","On Possession Won"],["doc-tac-gkdist","GK Distribution"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#7889a0", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                  <span style={{ color: "#7889a0", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, marginTop: 10, marginBottom: 2 }}>DEFENSE</span>
                  {[["doc-tac-pressing","Pressing LOE"],["doc-tac-defline","Defensive Line"],["doc-tac-dlbehavior","DL Behavior"],["doc-tac-tackling","Tackling"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#7889a0", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                </div>
                {tocLink("doc-tournaments", "Tournaments")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  {[["doc-tourney-modes","Modes"],["doc-tourney-zones","Qualification Zones"],["doc-tourney-tiebreakers","Tiebreakers"],["doc-tourney-presets","Presets"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#7889a0", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                </div>
                {tocLink("doc-bulkimport", "Bulk Import")}
              </div>
            </div>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-overview"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Overview</H1></summary>
            <P>Match outcomes are determined by three layers. Skill sets the baseline: a higher-skilled team wins more often, creates more chances, presses more effectively, and converts at a higher rate. Tactical setup (playstyle, formation, and tactics) modifies the probabilities that govern each minute of play, trading strength in one area for weakness in another. The engine then simulates minute by minute, resolving possession, movement, shots, fouls, and set pieces through those modified probabilities.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-skill"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Skill</H1></summary>
            <P>A number from 25 to 100 representing overall team quality. Skill feeds into every probability calculation in the engine: pressing effectiveness, advance rate, shot conversion, save probability, counter-attack success, and penalty conversion. Most formulas use the ratio between the two teams' effective skill, so a 90 vs 70 matchup produces the same relative advantage as 60 vs 47. Effective skill is the base number modified at runtime by red cards (each reduces it by 15%, compounding), momentum (up to +8% after scoring), stamina (up to -25% when exhausted), home advantage (+3% when enabled), and extra-time fatigue (-0.4% per minute past 90').</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-playstyles"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Playstyles</H1></summary>

            <H2>Offensive</H2>

            <H3>Gegenpress</H3>
            <P>High-intensity press designed to win the ball in dangerous areas and immediately attack. The pressing multiplier (1.5x) is the highest in the game, and the advance bonus pushes the team into the opponent's half quickly. The trade-off is structural: the team commits players forward to press, which hollows out the midfield and the backline. Possession retention is poor because the system prioritizes pressure over patience, and when the press is beaten, the defense is exposed with no covering structure. Counter-attacking ability is weak because the team is already high up the pitch with no one sitting deep to transition. Goal conversion per shot drops slightly, but the volume of chances compensates across a full match. Stamina drains faster than any other style because sustained high pressing is physically demanding.</P>
            <Stat text="Press 1.5x · Advance +0.04 · Hold -0.08 · Long ball +0 · Box shot +0.03 · Goal prob -0.01 · Counter 0.6x · Counter shot +0 · Defense -0.06 · Long-range +0 · Corners 1.0x" />

            <H3>Wing Play</H3>
            <P>Width-oriented system that attacks through the flanks. The long ball bonus is the highest in the game, reflecting direct balls into wide channels, and the corner multiplier (1.5x) is the game's highest, representing the volume of crosses and cutbacks that produce set pieces. Long-range shooting is encouraged because wide play creates angles at the edge of the box. The cost is modest but real: defensive solidity takes a minor hit because full-backs push forward, and hold drops because the team progresses through width rather than short combinations. A good choice for teams that want to generate set-piece volume and shoot from range, weaker for teams that need to control the middle.</P>
            <Stat text="Press 1.0x · Advance +0.02 · Hold -0.03 · Long ball +0.04 · Box shot +0.02 · Goal prob +0 · Counter 1.0x · Counter shot +0 · Defense -0.02 · Long-range +0.04 · Corners 1.5x" />

            <H2>Neutral</H2>

            <H3>Balanced</H3>
            <P>No modifiers in any direction. The team's skill rating determines everything. A good default when the skill gap is large enough that tactical amplification is unnecessary, or when flexibility matters more than specialization.</P>
            <Stat text="Press 1.0x · Advance +0 · Hold +0 · Long ball +0 · Box shot +0 · Goal prob +0 · Counter 1.0x · Counter shot +0 · Defense +0 · Long-range +0 · Corners 1.0x" />

            <H3>Tiki-Taka</H3>
            <P>Possession-dominant system that holds the ball and waits for the right moment. The hold modifier (+0.10) is the highest in the game, meaning extended spells of midfield control and high possession percentages. When shots do come, they convert well because the system creates high-quality chances through patient buildup. The cost is volume: advance rate is negative, box shot probability drops, long-range is suppressed, and counter-attacking is weak because the team recycles possession rather than transitioning quickly. Corner generation is low because the style avoids wasteful crosses. Tiki-Taka teams dominate the ball but can struggle to break packed defenses.</P>
            <Stat text="Press 1.1x · Advance -0.04 · Hold +0.10 · Long ball -0.04 · Box shot -0.03 · Goal prob +0.02 · Counter 0.7x · Counter shot +0 · Defense +0 · Long-range -0.04 · Corners 0.8x" />

            <H2>Defensive</H2>

            <H3>Counter</H3>
            <P>Built to absorb pressure and punish opponents on the break. The counter multiplier (2.0x) and counter shot bonus (+0.10) are both the highest in the game, meaning the team is lethal in transition. Defensive solidity is strong, and goal conversion is elevated because the chances that do come tend to be high-quality breakaways. The cost is territorial: the team concedes possession, rarely presses, advances slowly, and generates few chances from open play. The box shot penalty means the team relies almost entirely on counters and set pieces for goals. Tempo caps at Offensive to prevent the system from abandoning its defensive shape.</P>
            <Stat text="Press 0.3x · Advance -0.06 · Hold -0.03 · Long ball +0.02 · Box shot -0.04 · Goal prob +0.02 · Counter 2.0x · Counter shot +0.10 · Defense +0.08 · Long-range +0 · Corners 1.0x" />

            <H3>Park the Bus</H3>
            <P>Maximum defensive solidity at the expense of everything else. The defense modifier (+0.10) is the highest in the game, reducing the opponent's shooting opportunities substantially. Counter ability is elevated, providing an outlet on the break. The cost is across the board: pressing is nearly nonexistent, advance rate is deeply negative, hold drops, box shot probability craters, and corners are rare. The tempo system enforces a minimum of Defensive, meaning a Park the Bus team will never play balanced or higher regardless of scoreline. Effective when protecting a lead or when a massive skill gap needs to be neutralized, but the team will struggle to score if it falls behind.</P>
            <Stat text="Press 0.1x · Advance -0.10 · Hold -0.05 · Long ball +0.02 · Box shot -0.06 · Goal prob +0 · Counter 1.3x · Counter shot +0.05 · Defense +0.10 · Long-range -0.04 · Corners 0.7x · Min tempo: Defensive" />

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-formations"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Formations</H1></summary>

            <H2>Offensive</H2>

            <H3>4-2-4</H3>
            <P>Four attackers. The most extreme offensive formation in the game, with strong box shot, goal probability, and advance numbers. The defensive vacuum is equally extreme: two midfielders cannot control the middle, and the backline is constantly exposed. Press is weakened because the formation pushes bodies forward rather than maintaining a pressing structure. Teams using 4-2-4 will score and concede in volume. Effective when you need goals and can afford to leak them.</P>
            <Stat text="Press 0.8x · Advance +0.04 · Hold -0.08 · Long ball +0.03 · Box shot +0.04 · Goal prob +0.01 · Counter 0.9x · Counter shot +0 · Defense -0.08 · Long-range +0 · Corners 1.1x" />

            <H3>3-4-3</H3>
            <P>Aggressive three-back. Three forwards provide strong advance and box shot numbers with a slightly elevated press. Four midfielders are stretched between attack and defense, reducing hold. Three at the back is the thinnest defensive line available. Less extreme than 4-2-4 because the midfield four provides some structure, but the defensive exposure is still significant.</P>
            <Stat text="Press 1.05x · Advance +0.04 · Hold -0.02 · Long ball +0 · Box shot +0.04 · Goal prob +0 · Counter 1.0x · Counter shot +0 · Defense -0.05 · Long-range +0 · Corners 1.0x" />

            <H3>4-1-2-1-2</H3>
            <P>The diamond. Narrow and central, with two strikers and an attacking midfielder creating chances through the middle. Long-range shooting gets a boost from the central overload. The absence of wingers is the defining trade-off: corner generation collapses to the lowest in the game (0.75x) because there is no natural width, and the flanks are exposed defensively. Strong against teams that play through the middle; vulnerable against teams that attack down the wings.</P>
            <Stat text="Press 1.0x · Advance +0.01 · Hold +0.01 · Long ball +0 · Box shot +0.02 · Goal prob +0 · Counter 1.0x · Counter shot +0 · Defense -0.03 · Long-range +0.03 · Corners 0.75x" />

            <H2>Neutral</H2>

            <H3>4-3-3</H3>
            <P>Near-baseline formation. Marginal bonuses to box shot and defense. Everything else at zero. Neither amplifies nor restricts any tactical approach. The safest default.</P>
            <Stat text="Press 1.0x · Advance +0 · Hold +0 · Long ball +0 · Box shot +0.01 · Goal prob +0 · Counter 1.0x · Counter shot +0 · Defense +0.01 · Long-range +0 · Corners 1.0x" />

            <H3>4-4-2</H3>
            <P>Two strikers provide box presence. Four across midfield generates width and supports direct play, producing high corner rates. The flat midfield four lacks the triangles of a three-man midfield, and long-range shooting is slightly reduced because the shape encourages crosses over shots from distance. Counter-attacking is slightly dampened because the structure sustains attacks rather than transitioning quickly. A solid all-round choice that favors direct play and set pieces.</P>
            <Stat text="Press 1.0x · Advance +0 · Hold +0 · Long ball +0.02 · Box shot +0.04 · Goal prob +0 · Counter 0.95x · Counter shot +0 · Defense +0.01 · Long-range -0.02 · Corners 1.15x" />

            <H3>4-2-3-1</H3>
            <P>Double pivot screens the defence, producing one of the stronger defensive modifiers among four-back formations. Five midfielders dominate possession with the highest hold bonus in the neutral tier. The attacking midfielder creates from deep, encouraging long-range efforts. The lone striker is isolated, reducing box shot probability, and the structured build-up discourages counter-attacking. Best for teams that want to control games through possession and defensive solidity; weaker when chasing goals.</P>
            <Stat text="Press 1.0x · Advance +0 · Hold +0.04 · Long ball -0.01 · Box shot -0.03 · Goal prob +0 · Counter 0.9x · Counter shot +0 · Defense +0.03 · Long-range +0.03 · Corners 1.0x" />

            <H3>3-5-2</H3>
            <P>Wing-backs provide width and high corner rates. Five midfielders offer some territorial advantage and hold. Two strikers give box presence with a slight counter bonus. The trade-off is at the back: three centre-backs leave space when wing-backs push forward. A versatile formation that offers a bit of everything but has clear defensive vulnerability against teams that exploit the flanks.</P>
            <Stat text="Press 1.0x · Advance +0.02 · Hold +0.01 · Long ball +0 · Box shot +0.02 · Goal prob +0 · Counter 1.05x · Counter shot +0 · Defense -0.04 · Long-range +0 · Corners 1.15x" />

            <H3>3-4-1-2</H3>
            <P>Narrow three-back with an attacking midfielder feeding two strikers. Central long-range shooting gets a boost. Modest advance and hold bonuses. The narrow shape limits corner generation and exposes the flanks defensively. Similar to the diamond in its central focus, but trades the extra defender for an additional midfielder and slightly better hold.</P>
            <Stat text="Press 1.0x · Advance +0.01 · Hold +0.02 · Long ball +0 · Box shot +0 · Goal prob +0 · Counter 1.0x · Counter shot +0 · Defense -0.03 · Long-range +0.03 · Corners 0.95x" />

            <H2>Defensive</H2>

            <H3>4-1-4-1</H3>
            <P>Single defensive midfielder anchors four across the middle. Strong defensive modifier and the highest corner rate among four-back formations from maximum width. Moderate hold. The lone striker suffers, and the cautious structure limits counter-attacking ability. Good for grinding out results; limited when needing to score.</P>
            <Stat text="Press 1.0x · Advance +0 · Hold +0.03 · Long ball +0 · Box shot +0 · Goal prob +0 · Counter 0.85x · Counter shot +0 · Defense +0.05 · Long-range +0 · Corners 1.2x" />

            <H3>4-3-2-1</H3>
            <P>The Christmas tree. Three central midfielders screen the defence. Two attacking midfielders shoot from the edge of the box, producing the highest long-range modifier in the game. Possession-friendly with good hold. The narrow shape reduces corner opportunities and limits counter-attacking. A formation that creates chances from distance rather than inside the box; effective when the opponent packs their area.</P>
            <Stat text="Press 1.0x · Advance +0 · Hold +0.03 · Long ball -0.01 · Box shot +0 · Goal prob +0 · Counter 0.9x · Counter shot +0 · Defense +0.03 · Long-range +0.04 · Corners 0.85x" />

            <H3>5-3-2</H3>
            <P>The most defensive formation. Five at the back produces the highest defensive modifier in the game. Two strikers wait for the break with the strongest counter multiplier among formations (1.30x) and a counter shot bonus. Long ball gets a boost for direct transitions. The cost is everywhere else: press is weak, advance is negative, and corner generation is low. This formation concedes few chances and creates fewer, relying on counters for goals. Effective when protecting a lead or absorbing pressure from a stronger team.</P>
            <Stat text="Press 0.8x · Advance -0.02 · Hold +0 · Long ball +0.03 · Box shot +0 · Goal prob +0 · Counter 1.30x · Counter shot +0.02 · Defense +0.07 · Long-range +0 · Corners 0.85x" />

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-tactics"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Tactics</H1></summary>
            <P>Fourteen individual instructions that fine-tune behavior on top of playstyle and formation. Grouped into three categories. All default to "No Instruction" (zero effect). Each instruction also affects stamina drain; aggressive settings tire the team faster, conservative settings preserve energy.</P>

            <H2>In Possession</H2>

            <H3 id="doc-tac-approach">Approach Play</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Play Out</strong> — The team builds from the back with short passes, retaining the ball in deeper areas. Improves hold because the team recycles possession rather than forcing it forward. Advance drops slightly because the team waits for gaps rather than pushing into them. Lower stamina cost. Best paired with possession-heavy playstyles that want extended spells of control. Weak when the team needs to progress the ball urgently.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Into Space</strong> — The team plays direct passes into space behind the opponent's defensive line. Advance increases because the team pushes forward more aggressively. Hold drops because the team prioritizes progression over retention. Higher stamina cost. Best paired with systems that want to attack quickly and exploit space. Weak against deep-sitting opponents who leave no space behind.</P>
            <Stat text="Play Out: advance -0.01, hold +0.02 · Into Space: advance +0.02, hold -0.02" />

            <H3 id="doc-tac-passing">Passing Direction</H3>
            <P>Five levels from Much Shorter to Much More Direct. Each level increases advance and long ball probability while decreasing hold. More direct passing gets the ball forward faster but loses it more often. Shorter passing keeps the ball but progresses slowly. Extreme values in either direction drain stamina faster. Much More Direct paired with a high line and counter-press is intense and exhausting. Much Shorter paired with Tiki-Taka is almost impossible to dispossess but equally hard to score with.</P>
            <Stat text="Per level: advance +0.015, hold -0.02, long ball +0.015" />

            <H3 id="doc-tac-chances">Chance Creation</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Work Ball In</strong> — The team passes around the edge of the box looking for a clear opening rather than shooting early. Box shot probability increases because the team creates better chances through patience. Long-range shots are suppressed because the system discourages speculative efforts. Retains possession in the box more often. Best when dominating territory and wanting to convert pressure into goals. Weak when time is short.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Shoot On Sight</strong> — Players take shots from any position, including long range. Long-range shot rate increases significantly, but goal conversion per shot drops because more speculative attempts dilute quality. Good for generating volume when precision is not available. Weak against teams that clear well from distance.</P>
            <Stat text="Work Ball In: box shot +0.03, long-range -0.04, box retention +4% · Shoot On Sight: goal prob -0.01, long-range +0.04" />

            <H3 id="doc-tac-dribbling">Dribbling</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Disciplined</strong> — Players avoid taking on defenders, passing early instead of running. Advance drops marginally. The opponent's foul rate decreases because fewer tackles are attempted. Lower stamina cost. Safer and more controlled but less direct.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Run At Defence</strong> — Players dribble at defenders, drawing fouls and creating chaos. Advance increases. The opponent's foul rate rises significantly, generating more free kicks in dangerous areas and more penalties. Higher stamina cost. Best for teams that want to win set pieces and put pressure on booked defenders. The risk is that aggressive dribbling can lose the ball in dangerous positions.</P>
            <Stat text="Disciplined: advance -0.01, foul rate 0.9x · Run At Defence: advance +0.02, foul rate 1.25x" />

            <H3 id="doc-tac-creativity">Creative Freedom</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Disciplined</strong> — Players stick to the system. Goal conversion drops marginally because predictable patterns are easier to defend. Safer and more consistent.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Expressive</strong> — Players improvise. Goal conversion rises because unexpected movements create better chances. Additionally, there is a 4% chance per minute of a "moment of magic" where a player beats the system entirely and skips straight to a shooting opportunity. The risk is inconsistency and higher stamina cost.</P>
            <Stat text="Disciplined: goal prob -0.005 · Expressive: goal prob +0.01, 4% skip-to-shot chance" />

            <H3 id="doc-tac-setpieces">Set Pieces</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Play For</strong> — The team deliberately plays for corner kicks by putting crosses in and challenging the keeper. Corner multiplier increases by 1.2x. No other effects. A simple, low-cost choice for teams that want more set-piece opportunities.</P>
            <Stat text="Play For: corners 1.2x" />

            <H3 id="doc-tac-timewasting">Time Wasting</H3>
            <P>Only active when leading. The team slows the game down through delayed restarts and ball retention in non-threatening areas. Dead minutes consume game time without progressing play, and the additional stoppage time added is less than the minutes consumed. Reduces stamina drain because the team is not exerting itself. Constantly time-wasting risks yellow cards (2.5% per dead minute). Useful for closing out matches.</P>
            <Stat text="Sometimes: 25% dead minute chance, +15s stoppage · Constantly: 45% dead minute chance, +25s stoppage, 2.5% card risk" />

            <H2>Transition</H2>

            <H3 id="doc-tac-posslost">On Possession Lost</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Regroup</strong> — The team drops back into defensive shape after losing the ball. Press effectiveness drops because players retreat rather than challenging. Defensive solidity improves marginally. Low stamina cost. Best for teams that cannot afford to be caught out of position. Weak against teams that are slow to transition, since regrouping concedes territory that could have been recovered.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Counter-Press</strong> — The team immediately presses to win the ball back after losing it. Press effectiveness jumps by 1.2x, applied on top of all other pressing modifiers. High stamina cost (+0.10/min, the single most expensive individual tactic). Best for high-intensity systems that want to keep the opponent under constant pressure. Dangerous in the last 20 minutes because the stamina drain can leave the team exhausted.</P>
            <Stat text="Regroup: press 0.85x, defense +0.02 · Counter-Press: press 1.2x" />

            <H3 id="doc-tac-posswon">On Possession Won</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Hold Shape</strong> — The team keeps its defensive shape after winning the ball, building slowly. Hold increases because the team does not rush forward. Counter-attack probability is halved because the system suppresses fast transitions. Best for teams that want to control games and avoid being caught on a failed counter. Weak when the opponent is out of position and a fast break would be more effective.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Counter</strong> — The team launches forward immediately after winning the ball. Counter multiplier jumps by 1.4x, and counter shot probability gets a significant bonus. Hold drops because the team prioritizes speed over retention. Best for teams with a high counter multiplier already (the bonuses stack multiplicatively with the Counter playstyle). Weak when the team wins the ball in its own half and does not have the legs to cover the distance.</P>
            <Stat text="Hold Shape: hold +0.03, counter 0.5x · Counter: hold -0.02, counter 1.4x, counter shot +0.04" />

            <H3 id="doc-tac-gkdist">GK Distribution</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Short</strong> — After saves and goal kicks, the ball goes to the defending team's own half. The team retains possession but starts deep. Best for possession-oriented teams that build from the back.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Long</strong> — The keeper launches it. The attacking team has a 60% chance of retaining possession in midfield; 40% the ball goes to the defending team's half. Gives up possession control for territorial gain. Best for direct teams that want to skip the buildup phase.</P>
            <Stat text="Short: ball to own half · Long: 60% retain in midfield, 40% to defending half" />

            <H2>Defense</H2>

            <H3 id="doc-tac-pressing">Pressing Line of Engagement</H3>
            <P>Five levels from Much Lower to Much Higher. The press multiplier scales from 0.5x to 1.5x. This stacks multiplicatively with playstyle and formation press modifiers: a Gegenpress team at Much Higher presses at 1.5 x 1.5 = 2.25x. Higher pressing wins the ball back more often and higher up the pitch, but drains stamina proportionally and leaves space behind when beaten. Lower pressing concedes territory but conserves energy and maintains defensive shape.</P>
            <Stat text="Much Lower: 0.5x · Lower: 0.7x · Standard: 1.0x · Higher: 1.3x · Much Higher: 1.5x" />

            <H3 id="doc-tac-defline">Defensive Line</H3>
            <P>Five levels from Much Lower to Much Higher. Each level shifts the defense modifier by -0.015 (higher lines are less solid in the box) and increases the base offside rate by 20% (higher lines catch more attackers offside). A high line compresses the pitch, which supports pressing and forces offsides, but leaves space behind for through balls and long passes. A low line is harder to beat in the box but concedes territory and lets the opponent play in front of it.</P>
            <Stat text="Per level: defense -0.015, offside rate +20%" />

            <H3 id="doc-tac-dlbehavior">Defensive Line Behavior</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Drop Off</strong> — The defensive line retreats when the ball approaches. Defense improves marginally because the backline is deeper and harder to beat. Concedes territory. Low stamina cost.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Step Up</strong> — The defensive line holds its ground or pushes forward. Offside rate increases by 15%. More aggressive than Drop Off but less risky than the full trap.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Offside Trap</strong> — The defensive line pushes up sharply when the ball is played forward, attempting to catch attackers offside. Offside rate increases by 40%, which is significant. The risk: 15% of triggered offsides are beaten through, producing a 1v1 with a 1.25x attacker skill boost. When it works, it kills attacks dead. When it fails, it creates the best scoring opportunity in the game.</P>
            <Stat text="Drop Off: defense +0.015 · Step Up: offside rate +15% · Offside Trap: offside rate +40%, 15% beaten-through risk (1.25x skill boost)" />

            <H3 id="doc-tac-tackling">Tackling</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Stay On Feet</strong> — Players jockey rather than diving in. Press effectiveness drops marginally. Foul rate drops significantly, and card chance drops even more. Best for teams with booked players or teams that cannot afford to give away free kicks in dangerous areas. The cost is that the opponent retains the ball more easily.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Get Stuck In</strong> — Players commit to tackles aggressively. Press effectiveness increases. Foul rate rises substantially, and card chance rises even more. Generates more turnovers but also more fouls, more cards, and more penalties. Best for teams that need to disrupt the opponent's rhythm and are willing to risk the disciplinary consequences.</P>
            <Stat text="Stay On Feet: press 0.95x, foul rate 0.75x, card chance 0.65x · Get Stuck In: press 1.08x, foul rate 1.3x, card chance 1.4x" />

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-engine"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>How Matches Play Out</H1></summary>

            <H2 id="doc-pitch">The pitch</H2>
            <P>The engine models the pitch as five zones numbered 0 through 4. Zone 0 is the home team's box, zone 4 is the away team's box, zone 2 is midfield. The ball starts in midfield at kickoff. Each minute, the engine resolves one cycle of play based on the ball's current zone.</P>

            <H2 id="doc-minute">The minute cycle</H2>
            <P>Each minute follows a fixed sequence. First, the opponent attempts to press the ball carrier; if successful, possession switches and the minute ends. If the press fails, the possessing team acts from four possible outcomes: advance (move the ball one zone forward), hold (retain possession in place), long ball (skip a zone), or turnover (lose the ball). The probabilities are set by base rates modified by skill, tempo, and the combined playstyle/formation/tactics modifiers.</P>
            <P>Turnovers can trigger counter-attacks. Fouls can occur on any action, and fouls in the box become penalties. Each minute also drains stamina and can trigger substitutions or injuries.</P>

            <H2 id="doc-buildup">Buildup and long-range shots</H2>
            <P>From the zone just outside the opponent's box (distance-to-goal 1), long-range shots fire at a base 24% rate (modified by the long-range parameter, floored at 4%). Long-range shots convert at approximately 5%, scaled by the skill ratio. Save rate is 23%. Saves and misses generate corners at 40% and 25% respectively.</P>
            <P>Crosses from attacking territory (distance-to-goal 2 or less) produce standalone corners at a 4% rate, scaled by the corners multiplier.</P>

            <H2 id="doc-shooting">Shooting zone</H2>
            <P>When a team reaches the opponent's box, an immediate shot fires at approximately 42.5% for equal teams. If no immediate shot, the team enters sustained pressure. Shot probability in the box starts at 65% for equal teams (with no modifiers) and increases by 3% per minute of sustained pressure, capped at +12%. Defensive tempo and the opponent's defense modifier reduce this.</P>
            <P>If no shot is generated, the defending team may clear the ball: partially (staying near the box, possible corner), fully (back to midfield), or long (possible counter-attack for the clearing team).</P>

            <H2 id="doc-shots">Shot resolution</H2>
            <P>Three outcomes per shot. Goal probability: approximately 13% base, modified by the goal probability parameter and the skill ratio. Save probability: approximately 24% for equal teams. Everything else is a miss. Total on-target rate is approximately 37%, matching modern Premier League averages. Saves produce a corner 45% of the time; misses produce a corner 30% of the time.</P>

            <H2 id="doc-xg">Expected goals (xG)</H2>
            <P>Every shot attempt accumulates its goal probability into a running xG total. Box shots add their computed goalP (approximately 13% base, scaled by skill ratio and modifiers). Long-range shots add approximately 5%. Corners add approximately 4%. The xG total is displayed in match stats alongside actual goals, providing a measure of chance quality independent of finishing luck.</P>

            <H2 id="doc-counters">Counter-attacks</H2>
            <P>Counters trigger when the defending team clears long from the box or when the possessing team turns the ball over in attacking territory. Counter probability scales with the counter multiplier (14% base in attacking zones, 6% deeper). A successful counter carries an elevated shot probability of approximately 45% for equal teams, boosted by the counter shot modifier.</P>

            <H2 id="doc-corners">Corners</H2>
            <P>Corners resolve through a full outcome system. Goal: 4% (skill-scaled). Save: 6% (skill-scaled), with a 25% chance of producing another corner (resolved recursively). Miss: 8%. Retained possession: 25%. Clearance: remaining percentage.</P>

            <H2 id="doc-fouls">Fouls, cards, and offsides</H2>
            <P>Fouls occur at a 15% base rate, modified by dribbling and tackling tactics. Fouls in the box become penalties 35% of the time. Card chances vary by context: 55% on penalty fouls, 28% on regular fouls, 22% on turnover fouls. Tackling tactics scale these rates further.</P>
            <P>1.5% of card events are straight reds. Players already on a yellow receive a second yellow and are sent off. Booked players are cautious: 92% of the time, an unbooked teammate commits the foul instead. Each red card reduces effective skill by 15%, compounding.</P>
            <P>Offsides trigger at a 6% base rate when advancing into the final third or box, modified by the opponent's defensive line and defensive line behavior settings.</P>
            <P>Penalties convert at a base 78% rate, scaled by the skill ratio (floored at 55%, capped at 90%). 7% miss entirely. The rest are saved, with a 30% chance of producing a corner from the rebound.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-dynamics"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Match Dynamics</H1></summary>

            <H2 id="doc-tempo">Tempo</H2>
            <P>The automatic tempo system adjusts based on scoreline, time remaining, and playstyle. Transitions are probabilistic with random jitter and hysteresis (resistance to flip-flopping), so two identical game states won't always produce the same response. The range: Ultra Defensive, Defensive, Balanced, Offensive, Ultra Offensive.</P>
            <P>Playstyle shapes tempo behavior through four parameters. Defensive shift controls how early a team drops back when leading (counter and park-the-bus teams protect leads 15-20 minutes earlier than gegenpress teams, which resist going defensive). Attacking shift controls urgency when trailing. A ceiling caps maximum attacking intensity (counter teams cap at Offensive; tiki-taka at Ultra Offensive). A floor caps maximum defensive intensity (gegenpress teams never park the bus).</P>
            <P>In 2nd-leg matches with a starting aggregate deficit, an urgency factor compresses the remaining-time thresholds: 20 minutes per aggregate goal behind. A team starting 0-2 on aggregate plays attacking from kickoff. Trailing by 3+ goals with under 12 minutes left, teams have a 35% chance of accepting the result and reverting to balanced.</P>
            <P>Offensive tempo adds 5% to advance probability; Ultra Offensive adds 10%. Defensive and Ultra Defensive reduce opponent shot probability in the box by 8% and 18% respectively. Changing tempo manually disables automatic adjustment for the rest of the match.</P>

            <H2 id="doc-momentum">Momentum</H2>
            <P>After a goal, the scoring team receives a four-minute momentum boost. Each remaining minute increases effective skill by 2% (8% immediately, decaying to 0% over four minutes).</P>

            <H2 id="doc-stamina">Stamina and fatigue</H2>
            <P>Teams start at 100 stamina and drain each minute. Base drain is 0.75/min, modified by playstyle intensity (high-press styles drain faster), tactical tempo (Ultra Offensive adds +0.20/min, Ultra Defensive saves -0.15/min), and individual tactic choices. Minimum drain is 0.1/min regardless of settings.</P>
            <P>Low stamina degrades effective skill: at 50 stamina, skill drops roughly 9%; at 20, roughly 18%. Half-time restores 15 stamina. ET half-time restores 5.</P>

            <H2 id="doc-subs">Substitutions</H2>
            <P>Three per team per match. Trailing teams sub earlier (windows at minutes 50-55, 60-65, 70-75) and leading/drawing teams sub later (58-62, 68-72, 78-82). Each sub restores 4 stamina. If the team has a booked player, the sub preferentially removes them, clearing the yellow card risk.</P>

            <H2 id="doc-injuries">Injuries</H2>
            <P>Approximately 0.14 per game. The base rate scales with fatigue (tired teams get injured more). If subs remain, the injured player is replaced. If no subs remain, the team plays a man down.</P>

            <H2 id="doc-homeadv">Home advantage</H2>
            <P>When enabled, the home team receives a flat 3% boost to effective skill. In tournament mode, home advantage can be configured per match (via the H toggle) and globally via group/knockout settings (off, first-listed, weak-skill, host nation).</P>

            <H2 id="doc-stoppage">Stoppage time</H2>
            <P>Match events contribute to a stoppage bank: 45 seconds per goal, 90 per penalty awarded, 15 per foul, 30 per yellow, 60 per red card and per injury. The bank converts to stoppage minutes at each half's end. First half caps at 5 added minutes, second half at 8.</P>

            <H2 id="doc-extra">Extra time and penalties</H2>
            <P>Knockout matches drawn at full time proceed to extra time: two 15-minute halves. Effective skill degrades by 0.4% per minute past the 90th (capped at -12% by minute 120). If still level, a penalty shootout: five kicks per side, then sudden death. Each kick resolves individually. A winner is declared the moment the outcome is mathematically decided.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-tournaments"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Tournaments</H1></summary>

            <H3 id="doc-tourney-modes">Modes</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Single Stage</strong> runs one phase only. Choose Knockout Only (single-elimination bracket) or Groups Only (round-robin or Swiss league). Groups Only with one group functions as a league. Groups Only is also used for Monte Carlo simulations where you want to run many group stages without a knockout.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Double Stage</strong> runs groups followed by a knockout. Teams qualifying from groups advance to a bracket. The number of qualifiers is determined by qualification zones (or by the Qualify Per Group fallback if no advance zones are set). Group format can be round-robin or Swiss. Knockout can be seeded, random, drawn, or manually allocated.</P>
            <P>Groups use a round-robin fixture generator that handles odd team counts with byes (awarded as 3-0 wins). Swiss format pairs teams by score group each round, prioritizing teams with fewer games played and allowing rematches when all opponents are exhausted.</P>

            <H3 id="doc-tourney-zones">Qualification Zones</H3>
            <P>Zones mark positions in the standings table with colored strips and control advancement to the knockout stage. Each zone has an anchor (Top or Bottom), a position range (e.g., 1 to 2), a label, a color, and a type.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Cosmetic</strong> zones are visual only. Use them for labels like Champion or Relegation in league formats where there is no knockout stage.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Direct Qualification</strong> zones advance all teams in those positions from every group. Top 2 in an 8-group tournament with Direct Qualification produces 16 teams for the knockout.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Pool Qualification</strong> zones collect teams from those positions across all groups into a single ranked pool table (sorted by points, then goal difference, goals for, and skill). A configurable number of the best-performing teams qualify. This is how the 2026 World Cup handles third-placed teams: 12 groups produce 12 third-placed teams, the best 8 advance.</P>
            <P>The pool ranking table updates live during the group stage as results come in. Zones are evaluated top-to-bottom in the editor, so if two zones overlap, the first one takes priority. Zones integrate with the knockout bracket builder and handle byes automatically for non-power-of-2 team counts.</P>

            <H3 id="doc-tourney-tiebreakers">Tiebreakers</H3>
            <P>When two teams have equal points, the tiebreaker priority determines their order. The priority is configurable and the order matters. Points are always checked first; skill is always the final fallback.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Goal Difference</strong> compares total goals scored minus goals conceded.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Goals For</strong> rewards attacking teams. A team with 15 scored and 10 conceded ranks above one with 8 scored and 3 conceded despite the latter having a better goal difference.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Head-to-Head</strong> extracts the results between the two tied teams specifically: their H2H points, then H2H goal difference, then H2H goals for. This is the primary tiebreaker in UEFA competitions.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Wins</strong> counts total wins regardless of goal difference. Some South American leagues prioritize this.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Median-Buchholz</strong> (Swiss only) sums each team's opponents' final points, removes the highest and lowest, and compares. Rewards teams that faced stronger opposition. Standard in chess-style Swiss systems.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Manual</strong> (Double Stage only) stops automated tiebreaking at its position in the priority list. When two teams are tied at a qualification zone boundary after all criteria above Manual are exhausted, a swap button appears in the standings table. The user resolves the tie by swapping team positions. Advancement to the knockout stage is blocked until all zone-boundary ties are resolved.</P>

            <H3 id="doc-tourney-presets">Presets</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>League</strong> — Single stage, 1 group, double round-robin, first-listed home advantage. Champion (gold, cosmetic) and Relegation (red, cosmetic) zones. Tiebreakers: GD, GF, H2H, Wins.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Old World Cup</strong> — Double stage, 8 groups of 4, single round-robin, pot-based draw. Top 2 advance (direct). 16-team seeded knockout with third-place match.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>New World Cup</strong> — Double stage, 12 groups of 4, single round-robin, pot-based draw. Top 2 advance (direct) plus best 8 third-placed teams (pool). 32-team seeded knockout with third-place match.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Old UCL</strong> — Double stage, 8 groups of 4, double round-robin, pot-based draw. Top 2 advance (direct). 16-team seeded knockout, two-legged ties with away goals.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>New UCL</strong> — Double stage, 1 group of 36, Swiss format (8 rounds). Top 8 advance directly, 9th to 24th advance to playoff round. Seeded knockout, two-legged ties, no away goals. Tiebreakers: GD, GF, Buchholz, H2H, Wins.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Cup</strong> — Single stage knockout. Seeded bracket, single-leg, weaker team gets home advantage.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-modifiers"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Modifiers</H1></summary>
            <P>Playstyles, formations, and tactics all modify the same set of parameters. Additive parameters sum, multiplicative parameters multiply. Tactics apply on top of the combined playstyle + formation values.</P>
            <div style={{ background: "#141c2b", borderRadius: 8, border: "1px solid #2a3a50", overflow: "hidden", marginBottom: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead><tr style={{ borderBottom: "1px solid #2a3a50" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "#7889a0", fontWeight: 600, fontSize: 9, letterSpacing: "0.1em" }}>PARAMETER</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", color: "#7889a0", fontWeight: 600, fontSize: 9, letterSpacing: "0.1em", width: 50 }}>TYPE</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "#7889a0", fontWeight: 600, fontSize: 9, letterSpacing: "0.1em" }}>EFFECT</th>
                </tr></thead>
                <tbody>
                {[
                  ["Press", "×", "Pressing effectiveness when winning the ball back"],
                  ["Advance", "+", "Probability of moving the ball forward one zone"],
                  ["Hold", "+", "Probability of retaining possession without advancing"],
                  ["Long ball", "+", "Probability of skipping a zone with a direct pass"],
                  ["Box shot", "+", "Generating a shot inside the box — primary driver of shot volume"],
                  ["Goal prob", "+", "Base conversion rate per shot — small changes compound"],
                  ["Counter", "×", "Launching a counter-attack after winning the ball"],
                  ["Counter shot", "+", "Shot probability during counter-attacks"],
                  ["Defense", "+", "Reduces opponent shot probability — primary driver of solidity"],
                  ["Long-range", "+", "Long-range shot frequency from outside the box"],
                  ["Corners", "×", "Corner frequency from crosses in attacking territory"],
                  ["Tactic clamp", "⌐", "Restricts the automatic tempo range (maxT/minT)"],
                ].map(([name, type, desc], i) => (
                  <tr key={i} style={{ borderBottom: i < 11 ? "1px solid #0f1612" : "none" }}>
                    <td style={{ padding: "7px 12px", color: "#ffffff", fontWeight: 600, fontSize: 11 }}>{name}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center" }}><span style={{ display: "inline-block", width: 22, height: 18, lineHeight: "18px", borderRadius: 3, fontSize: 10, fontWeight: 700, textAlign: "center", background: type === "×" ? "#7889a022" : type === "+" ? "#4a7ab522" : "#d0877022", color: type === "×" ? "#5e9c6b" : type === "+" ? "#4a7ab5" : "#d08770", border: "1px solid " + (type === "×" ? "#5e9c6b33" : type === "+" ? "#4a7ab533" : "#d0877033") }}>{type}</span></td>
                    <td style={{ padding: "7px 12px", color: "#888" }}>{desc}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
            <P>Multiplier parameters (×) scale the base value. A press of 1.5× means 50% more effective pressing. Additive parameters (+) shift the probability directly. A box shot of +0.04 adds 4 percentage points to the chance of generating a shot in the box each minute.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-bulkimport"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Bulk Import</H1></summary>
            <P>Tab-separated, one team per line. Columns in order:</P>
            <div style={{ fontSize: 10, color: "#888", padding: "6px 12px", background: "#141c2b", borderRadius: 4, marginBottom: 10, lineHeight: 1.8, ...mono }}>Code (optional, 3 letters) · Name · Skill · Playstyle · Formation · Approach · Passing · Chances · Dribbling · Creativity · Set Pieces · Time Wasting · Pos. Lost · Pos. Won · GK Dist · Pressing · Def. Line · DL Behavior · Tackling</div>
            <P>Only Name is required. Skill defaults to 50, playstyle to Balanced, formation to 4-3-3, all tactics to No Instruction. Tactic values accept label text from the UI (e.g., "Into Space", "Much Shorter", "Get Stuck In"). Player names can end with [+] (above-average) or [*] (star) to set their tier — this affects selection weight, conversion rate, GK saves, and defensive impact.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-tournaments"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Tournaments</H1></summary>

            <H3 id="doc-tourney-modes">Modes</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Single Stage</strong> runs one phase only. Choose Knockout Only (single-elimination bracket) or Groups Only (round-robin or Swiss league). Groups Only with one group functions as a league.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Double Stage</strong> runs groups followed by a knockout. Teams qualifying from groups advance to a bracket. The number of qualifiers is determined by qualification zones. Group format can be round-robin or Swiss. Knockout can be seeded, random, drawn, or manually allocated.</P>
            <P>Groups use a round-robin fixture generator that handles odd team counts with byes (awarded as 3-0 wins). Swiss format pairs teams by score group each round, prioritizing teams with fewer games played and allowing rematches when all opponents are exhausted.</P>

            <H3 id="doc-tourney-zones">Qualification Zones</H3>
            <P>Zones mark positions in the standings table with colored strips and control advancement to the knockout stage. Each zone has an anchor (Top or Bottom), a position range, a label, a color, and a type.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Cosmetic</strong> zones are visual only. Use them for labels like Champion or Relegation in league formats.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Direct Qualification</strong> zones advance all teams in those positions from every group. Top 2 in an 8-group tournament produces 16 teams for the knockout.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Pool Qualification</strong> zones collect teams from those positions across all groups into a ranked pool table (sorted by points, goal difference, goals for, skill). A configurable number of the best-performing teams qualify. The pool ranking updates live during the group stage.</P>

            <H3 id="doc-tourney-tiebreakers">Tiebreakers</H3>
            <P>When two teams have equal points, the configurable tiebreaker priority determines their order. Points are always first; skill is always the final fallback.</P>
            <P><strong style={{color:"#ffffff",fontSize:10}}>Goal Difference</strong> — total goals scored minus conceded. <strong style={{color:"#ffffff",fontSize:10}}>Goals For</strong> — rewards attacking play. <strong style={{color:"#ffffff",fontSize:10}}>Head-to-Head</strong> — results between the two tied teams (pts, GD, GF). <strong style={{color:"#ffffff",fontSize:10}}>Wins</strong> — total wins. <strong style={{color:"#ffffff",fontSize:10}}>Median-Buchholz</strong> (Swiss only) — opponents' points minus best and worst. <strong style={{color:"#ffffff",fontSize:10}}>Manual</strong> (Double Stage only) — stops automated tiebreaking; swap buttons appear on tied teams at zone boundaries.</P>

            <H3 id="doc-tourney-presets">Presets</H3>
            <P><strong style={{color:"#ffffff",fontSize:10}}>League</strong> — 1 group, double round-robin, home and away, champion + relegation zones. <strong style={{color:"#ffffff",fontSize:10}}>Old World Cup</strong> — 8 groups of 4, top 2 advance, 16-team knockout. <strong style={{color:"#ffffff",fontSize:10}}>New World Cup</strong> — 12 groups of 4, top 2 advance + best 8 thirds, 32-team knockout. <strong style={{color:"#ffffff",fontSize:10}}>Old UCL</strong> — 8 groups of 4, double round-robin, two-legged knockout. <strong style={{color:"#ffffff",fontSize:10}}>New UCL</strong> — 36-team Swiss, top 8 advance + 9th-24th playoff, Median-Buchholz tiebreaker. <strong style={{color:"#ffffff",fontSize:10}}>Cup</strong> — single-elimination bracket.</P>

            </details>
            </>);
          })()}
        </div>)}

      </div>
    </div>
  );
}
