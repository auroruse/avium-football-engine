// THE SIMULATION, ON ITS OWN. Lifted out of App.tsx unchanged -- same code, same order, same
// numbers -- for one reason: a Web Worker cannot import a .tsx file in development. Vite's dev
// server prepends `import { createHotContext } from "/@vite/client"` to every React module, and
// the HMR client wants a window and a document. A worker has neither, so every worker died on
// load and the pool quietly ran everything on the main thread. The production build was fine,
// which is exactly what made it confusing.
//
// Nothing here is a copy. App.tsx imports these back, so there is still one implementation of a
// football match in the project and the worker and the interface run the identical code.
import { ME_MATCH_TICKS, meFinalise, meInit, meShootout, meTick } from "../engine";

export class RNG {
  constructor(seed) { this.s = seed || Date.now(); }
  next() { this.s = (this.s * 1664525 + 1013904223) & 0xffffffff; return (this.s >>> 0) / 0xffffffff; }
  u() { return this.next(); }
}

export const pick = (rng, a) => a[Math.floor(rng.u() * a.length)];

export const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? k);

export const CM = {
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
  save:["Straight at {g} from {t}'s {n}. Comfortable save.","{g} dives low and holds {t}'s {n}'s effort.","Great save! {g} denies {t}'s {n}!","Fingertip save! {t}'s {n} thought that was in!","Strong hands from {g} to keep out {t}'s {n}'s drive.","Parried away! {g} pushes {t}'s {n}'s shot wide!","Point-blank save! {t}'s {n} denied from close range!","Reflex save! {g} reacts brilliantly to {t}'s {n}!","Smothered by {g}! {t}'s {n} couldn't find a way past!","Low save! {t}'s {n}'s effort kept out.","{t}'s {n} tests {g}, who holds comfortably.","Diving save! {g} gets a glove to {t}'s {n}'s effort!","Blocked by {g}! {t}'s {n} frustrated!","Pushed wide by {g} at full stretch!","Acrobatic stop! {t}'s {n}'s effort tipped over!","Palmed over the bar! Big save to deny {t}'s {n}!","{g} reads it early and smothers {t}'s {n}'s shot.","What a stop! {g} springs across to deny {t}'s {n}!","One-handed save! {t}'s {n} can't believe it!","Tipped wide! Superb reflexes to deny {t}'s {n}!","{t}'s {n} forces a save. Tipped around the post.","Beaten the defense but not {g}! {t}'s {n} denied!","Right at him. {t}'s {n} should have placed it better.","Decent save. {t}'s {n}'s shot lacked conviction.","Sharp stop to palm away {t}'s {n}'s drive!"],
  corner_save:["Header from {t}'s {n}... {g} saves! Good reflexes!","Powerful header from {t}'s {n} but {g} holds!","{t}'s {n} gets a head on it... saved! Tipped over!","Firm header from {t}'s {n}. Straight at {g}.","Diving header from {t}'s {n}! {g} pushes it wide!","{t}'s {n} meets the delivery but {g} reacts well!","Glancing header from {t}'s {n}! {g} plucks it out of the air!","Strong header from {t}'s {n} but {g} was equal to it!","{g} punches away {t}'s {n}'s header! Commanding!","{t}'s {n} rises well but can't beat {g}! Good save!"],
  save_lr:["Effort from distance by {t}'s {n}. {g} holds.","Struck from range by {t}'s {n}! {g} pushes it away!","Long-range drive from {t}'s {n}. Good save, pushed wide!","{t}'s {n} tries from outside the box. {g} tips it over!","Ambitious from {t}'s {n} but {g} reads it all the way.","Dipping shot from {t}'s {n}! {g} backpedals and saves!","{t}'s {n} lets rip from 25 yards. Beaten away!","Long-range effort from {t}'s {n} stings {g}'s palms!","Swerving effort from {t}'s {n}! Beaten out by {g}!","From 30 yards! {g} flings himself across to save from {t}'s {n}!","{t}'s {n} unloads from range. Held at the second attempt.","Fizzing drive from distance! {g} takes no chances and parries!","Arrowing toward the corner until {g} intervenes! {t}'s {n} denied from range!","Speculative from {t}'s {n}. Gathered low.","Rasping hit from {t}'s {n}! {g} equal to it!"],
  miss:["{t}'s {n} fires wide! Off target.","Over the bar from {t}'s {n}! Leaned back too far.","{n} drags it just wide for {t}.","Blazed over by {t}'s {n}! Inches too high.","Pulled across the face of goal by {t}'s {n}. Wide.","{n} snatches at it! Over the bar for {t}.","Into the stands from {t}'s {n}! Way too much on it.","Wide of the mark from {t}'s {n}. So close to hitting the target.","Miscued from {t}'s {n}! Gets it all wrong.","Clips the outside of the post! {t}'s {n} will be gutted.","{t}'s {n} had time but couldn't find the target.","Sliced horribly by {t}'s {n}! Miles off target.","{t}'s {n} curls it over from a promising position.","Wild effort from {t}'s {n}! Row Z.","Shanked by {t}'s {n}! Terrible connection.","{t}'s {n} swings a boot and misses the ball entirely!","Grazes the far post on the way past! {t}'s {n} so close.","Hurried his shot. {t}'s {n} needed another touch.","Ballooned over from {t}'s {n}! Had the goal at his mercy.","Just wide of the far post. {t}'s {n} will wonder how that stayed out.","Scooped over by {t}'s {n}! Agonizing.","Side-netting from {t}'s {n}. Close but wrong side of the post.","{t}'s {n} leans back and lifts it over the crossbar.","Inches wide! {t}'s {n} will replay that one in his head.","{t}'s {n} catches it on the shin. Harmless.","Fizzes just over the bar! {t}'s {n} unlucky not to score.","Drags it just past the near post. {t}'s {n} will be furious with himself."],
  corner_miss:["Header from {t}'s {n}... over the bar! Couldn't keep it down.","{t}'s {n} gets a free header but can't direct it! Over.","Glanced wide by {t}'s {n}. Needed to hit the target.","Completely miscued by {t}'s {n}! Should have scored.","Free header for {t}'s {n}... off target! Big miss.","{t}'s {n} can't keep the header down! Over from six yards.","Headed wide from point-blank! {t}'s {n} kicking himself.","{t}'s {n} gets across the front post but the header drifts wide.","Up rises {t}'s {n} but the header sails over. So close.","{t}'s {n} heads it into the ground. Bounces wide.","The delivery finds {t}'s {n}... header over. Chance wasted.","Six yards out and {t}'s {n} puts it wide! How?","Met with power by {t}'s {n} but no accuracy. Off target.","Corner swung in, {t}'s {n} rises... nothing on the header. Wide.","All alone at the back stick, {t}'s {n} heads over! Huge let-off!"],
  miss_lr:["{t}'s {n} tries from range. Sails over.","Ambitious from {t}'s {n}! The shot from distance curls wide.","{t}'s {n} lets fly from 30 yards. Not troubling anyone.","Speculative from {t}'s {n}. Drifts wide of the far post.","{t}'s {n} has a go from outside the box. Over the bar.","{t}'s {n} strikes from distance. Whistles past the post.","{t}'s {n} fancies one from range but fires over.","Long-range punt from {t}'s {n}. Easy for the keeper.","Row Z. {t}'s {n} got that one all wrong.","Optimistic from {t}'s {n}. Never coming down.","{t}'s {n} takes aim from 25 yards... well wide.","Swerving, dipping... and missing. {t}'s {n} from distance.","Better options available. {t}'s {n} shoots from range and wastes it.","The dip never came. {t}'s {n}'s effort clears the bar.","Troubling the fans, not the keeper. {t}'s {n} from range."],
  woodwork:["{t}'s {n} hits the post! So close!","Off the bar! {t}'s {n} inches away!","Rattles the crossbar! {t}'s {n} nearly had it!","Against the post from {t}'s {n}! Agonizing!","Crashes against the frame of the goal! {t}'s {n} can't believe it!","Off the inside of the post and away! Denied by the woodwork!","Thunderbolt from {t}'s {n} smacks the crossbar!","Thumps the upright! {t}'s {n} had the keeper beaten!","The post comes to {o}'s rescue! {t}'s {n} was so close!","It comes back off the bar! {t}'s {n} holds his head!","Cannons off the crossbar! Millimeters away for {t}'s {n}!","The frame of the goal denies {t}'s {n}! It just wouldn't go in!"],
  woodwork_save:["Tipped onto the post by {g}! Incredible!","Fingertips push it onto the bar! Brilliant save!","Pushed onto the frame of the goal by {g}!","Onto the woodwork via {g}'s glove! What a save!","{g} gets just enough to divert it onto the post!","Superb save pushed onto the crossbar! {t}'s {n} denied!","{g} stretches and pushes it onto the frame!","Off the bar from {g}'s save! {t}'s {n} so close!","A glove and the post combine to deny {t}'s {n}!","Somehow it stays out! Fingertips, then the bar! {t}'s {n} robbed!","Turned onto the upright! Magnificent stop!","Clawed onto the crossbar! Unbelievable save to deny {t}'s {n}!"],
  woodwork_hdr:["Header crashes off the crossbar! {t}'s {n} so close from the corner!","{t}'s {n}'s header thunders against the bar!","Off the bar! {t}'s {n} unlucky with that header!","Header off the post! {t}'s {n} smacks the frame!","Powered against the bar by {t}'s {n}! The woodwork saves {o}!","The crossbar rattles! {t}'s {n}'s header stays out!","Inches! {t}'s {n} plants the header against the post!","Nodded onto the woodwork! {t}'s {n} can't believe it!","Bar! {t}'s {n}'s header bounces down and away! No goal!","So near! The header from {t}'s {n} clips the bar!","Denied by the frame! {t}'s {n} met it perfectly!","Upright! {t}'s {n}'s header thuds back out! {o} survive!"],
  foul:["Foul by {t}'s {n}. Free kick {o}.","Late challenge from {t}'s {n}. Free kick {o}.","{t}'s {n} clips the ankle. Referee blows.","{t}'s {n} goes through the back. Free kick.","{t}'s {n} pulls the shirt. Easy call.","{t}'s {n} bundles into the challenge. Foul.","Clumsy from {t}'s {n}. Free kick {o}.","Body check from {t}'s {n}. Stopped the attack.","{t}'s {n} catches the man. Free kick.","Wrestled to the ground by {t}'s {n}. Foul.","{t}'s {n} slides in recklessly. Free kick {o}.","Trip from {t}'s {n}. No hesitation from the referee.","Cynical foul from {t}'s {n}. Killed the counter.","{t}'s {n} uses an arm across the chest. Free kick.","Stands on the ankle. {t}'s {n} gives away a foul.","Shoulder barge from {t}'s {n}. Too aggressive.","{t}'s {n} goes in studs showing. Free kick {o}.","Blocked off by {t}'s {n}. Impedes the run. Foul.","Tugged back by {t}'s {n}. Clear foul.","Shove from {t}'s {n}. Easy decision."],
  foul_pen:["Brought down in the box by {o}'s {n}! PENALTY!","{o}'s {n} clips the attacker in the area! Penalty given!","Fouled in the box! {o}'s {n} couldn't pull out! PENALTY!","{o}'s {n} drags down the attacker! Referee points to the spot!","Handball by {o}'s {n}! PENALTY!","Crunching challenge from {o}'s {n} in the area! PENALTY!","{o}'s {n} catches the attacker's legs in the box! Penalty!","Tripped in the box by {o}'s {n}! PENALTY!","Penalty! {o}'s {n} with a needless shove in the area!","Pointing to the spot! {o}'s {n} the guilty man!","Clumsy from {o}'s {n} in the box! PENALTY!","Wiped out in the area by {o}'s {n}! Spot kick!","{o}'s {n} times it horribly! Penalty conceded!","Arm up from {o}'s {n}! The referee has no doubt! PENALTY!","Reckless in the box from {o}'s {n}! It's a penalty!"],
  yellow:["Yellow card for {t}'s {n}. Into the book.","Booking for {t}'s {n}. Can't argue with that.","Card shown to {t}'s {n}. Cynical challenge.","{t}'s {n} picks up a caution. Reckless.","In the book. {t}'s {n} needs to be careful now.","{t}'s {n} booked for persistent fouling.","Yellow. {t}'s {n} knew what he was doing.","{t}'s {n} carded. Walking a tightrope.","Cautioned. {t}'s {n} catches the referee's eye.","{t}'s {n} goes in the book.","Booking for {t}'s {n}. That was needless.","{t}'s {n} picks up a yellow. One more and he walks."],
  second_yellow:["Second yellow! {t}'s {n} is OFF! Down to {c}!","Two yellows make a red! {t}'s {n} sees the early bath! {c} men.","That's his second booking! {t}'s {n} has to go! Down to {c}!","Off for two yellows! {t}'s {n} leaves {t} with {c}!","{t}'s {n} can't believe it! Second yellow! {c} remain.","He'd been warned! {t}'s {n} picks up a second yellow! Down to {c}!","Dismissed! {t}'s {n} gets a second booking! {t} down to {c}!","Second booking for {t}'s {n}! Off he goes! {c} men left!","Yellow... and red! {t}'s {n} walks! Down to {c}!","Foolish from {t}'s {n}! A second caution and off he goes! {c} left!","The tightrope snaps! {t}'s {n} sent off for a second yellow! {c} men!","No complaints. {t}'s {n} earned both bookings. Down to {c}.","Gone! A second yellow for {t}'s {n}! {c} remain!","Madness from {t}'s {n}! Already booked and he dives in! Off! Down to {c}!","Out comes yellow, then red! {t}'s {n} is off! {c} men!"],
  red_sfp:["Serious foul play! {t}'s {n} gone! {c} men for {t}.","Awful challenge! {t}'s {n} gets a straight red! {c} remain.","Red card all day long! {t}'s {n} is off! Down to {c}!","Dangerous tackle from {t}'s {n}! Straight red! Reduced to {c}!","Horror tackle! {t}'s {n} sees straight red! Down to {c}!","No debate about that one. {t}'s {n} is off. {c} men for {t}.","Shocking from {t}'s {n}! The red card is out! {c} left!","The early bath for {t}'s {n}! Straight red! {t} down to {c}!","Disgraceful challenge from {t}'s {n}! Off without argument! {c} remain!","That's a leg-breaker! {t}'s {n} is rightly sent off! Down to {c}!","Moment of madness from {t}'s {n}! Red! {t} reduced to {c}!","Studs up, knee high! {t}'s {n} walks! Down to {c}!"],
  red_dogso:["Last man! {t}'s {n} brings down the attacker! Red! Down to {c}!","DOGSO! {t}'s {n} denied a clear goalscoring opportunity! Off! {c} men.","Professional foul from {t}'s {n}! Last defender! Red! {c} remain!","Denied a goalscoring opportunity! {t}'s {n} takes one for the team! Down to {c}!","{t}'s {n} hauls down the attacker! Last man! Off! Down to {c}!","He had to! {t}'s {n} brings down the forward with no one else back! Off! {c} men!","Clear goalscoring opportunity denied! {t}'s {n} walks! {c} for {t}!","Tactical foul, last man, red card. {t}'s {n} had no choice. Down to {c}.","Through on goal and brought down by {t}'s {n}! Off he goes! {c} men!","Cynical from {t}'s {n}! Pulls back the attacker clean through! Red! {c} remain!","The keeper was beaten, the defender wasn't having it! {t}'s {n} off! Down to {c}!","One-on-one denied! {t}'s {n} clips the heels! Straight red! {c} left!"],
  red_violent:["Violent conduct! {t}'s {n} throws an elbow! Straight red! Down to {c}!","Disgusting! {t}'s {n} lashes out off the ball! Red card! {c} men!","That's violent conduct! {t}'s {n} headbutts the opponent! Off! {c} remain!","Hands to the face from {t}'s {n}! Straight red! {t} down to {c}!","Inexcusable from {t}'s {n}! Red card! Down to {c}!","{t}'s {n} stamps on the opponent! Violent conduct! Off! {c} left!","Lost his head! {t}'s {n} shoves the opponent to the ground! Red! {c} men!","Off the ball incident! {t}'s {n} elbows the defender! Dismissed! Down to {c}!","Completely lost it! {t}'s {n} kicks out! Red card! {t} reduced to {c}!","Retaliatory kick from {t}'s {n}! Caught on camera! Violent conduct! Off! {c} men!","Ugly scenes! {t}'s {n} goes after the opponent! Red! Down to {c}!","Grabbed him by the shirt and threw him! {t}'s {n} off for violent conduct! {c} remain!"],
  red_abusive:["Sent off for abusive language! {t}'s {n} said too much! Down to {c}!","Red card for dissent! {t}'s {n} crossed the line! {c} men for {t}!","Offensive language toward the officials! {t}'s {n} is off! Down to {c}!","{t}'s {n} loses it at the referee! Red for abusive language! {c} remain!","Whatever {t}'s {n} said, the referee didn't like it! Straight red! Down to {c}!","Dismissed for foul and abusive language! {t}'s {n} only has himself to blame! {c} left!","Mouthed off one too many times! {t}'s {n} walks! Down to {c}!","The referee has had enough! {t}'s {n} sent off for verbal abuse! {c} remain!","Screaming at the linesman! {t}'s {n} shown a straight red! {t} down to {c}!","Gone for dissent! {t}'s {n} went too far! {c} men for {t}!","Words you can't repeat! {t}'s {n} dismissed for offensive language! Down to {c}!","That's a mouthful at the fourth official! {t}'s {n} gets a straight red! {c} men!"],
  pen_saved:["SAVED! {g} guesses right and denies {t}'s {n}!","Penalty saved! {g} springs low to keep {t}'s {n} out!","Read it perfectly! {g} saves from {t}'s {n}!","Kept out! {t}'s {n} goes left and so does {g}!","{g} is the hero! Saves {t}'s {n}'s penalty!","SAVED! Low to his right! {g} denies {t}'s {n}!","Guessed correctly! {g} palms away the spot-kick!","What a save from the penalty! {t}'s {n} denied!","Denied! {g} stands tall and beats it away!","Stopped! {t}'s {n} sees his penalty smothered!","Big hand! The spot kick is turned aside!","Twelve yards, no reward! {g} keeps out {t}'s {n}!","Full stretch! {g} denies {t}'s {n} from the spot!","Down goes {g}... and it stays out! {t}'s {n} denied!","Brilliant from {g}! The penalty is repelled!"],
  pen_missed:["Over the bar! {t}'s {n} blazes the penalty high!","Wide! {t}'s {n} drags the penalty off target!","Off the post! {t}'s {n} can't believe it!","Skied! The pressure got to {t}'s {n}!","Slipped on the run-up! {t}'s {n} balloons it over!","Weak penalty from {t}'s {n}. Way off target.","Hits the bar! {t}'s {n}'s penalty crashes off the crossbar!","{t}'s {n} puts the penalty wide! Terrible miss!","High, wide and anything but handsome! {t}'s {n} misses!","Dragged past the post! {t}'s {n} buries his head in his hands!","The post saves the keeper! {t}'s {n} denied by the frame!","Nowhere near! {t}'s {n} snatches at the penalty!","Ballooned into the stands! Awful from {t}'s {n}!","Too casual! {t}'s {n} chips it wide of the post!","Horrible penalty. {t}'s {n} never looked confident."],
  offside:["Offside against {t}. {n} mistimed the run.","Flag up. {t}'s {n} caught offside.","{t}'s {n} went too early. Offside.","Linesman's flag. {t}'s {n} beyond the last man.","{t}'s {n} is offside. Good call.","Well-timed trap from {o}. {t}'s {n} caught out.","Offside. {t}'s {n} strayed ahead of the line.","Marginal but correct. {t}'s {n} flagged offside.","{t}'s {n} drifts offside. Move is dead.","The flag goes up. {t}'s {n} a fraction offside.","Run timed too early by {t}'s {n}. Offside.","{t}'s {n} springs forward but the flag is up."],
  corner_retain:["Corner half-cleared. Still {t}'s ball.","Loose clearance, {t} recycle it.","Headed out but only as far as {t}.","Partially cleared. {t} keep the pressure on.","Punched away by the keeper but {t} gather.","Cleared to the edge. {t} reload.","Knocked away but it falls to {t}.","Weak clearance from {o}. {t} maintain possession.","Scrambled out, but {t} come again.","Only as far as the edge. {t} still have it.","Nodded clear... and straight back to {t}.","{o} can't get it away. {t} probing again.","Second phase. {t} work it back in.","Half-punched by the keeper. {t} recycle.","The clearance lands at a {t} boot. Pressure stays on."],
  corner_clear:["{n} clears {o}'s lines decisively.","Headed away by {n}. Danger over.","{n} deals with the corner comfortably.","Strong defending from {n}. Corner neutralized.","{n} claims it. Dealt with.","{n} punches it clear. No danger.","{n} with a decisive header. Threat over.","{n} gets in the way. Corner cleared.","Cleared with authority by {n}.","{n} stands firm. Headed away."],
  corner_won:["Corner {t}.","Pushed behind! Corner to {t}.","Behind for a corner! {t} send men forward.","Deflected behind. Corner {t}.","Another set piece opportunity. Corner {t}.","Behind off the last defender. Corner {t}.","Cleared for a corner! {t} sending bodies up.","Last touch {o}. Corner {t}."],
  miss_corner:["Takes a wicked deflection off {o}, behind for a corner.","Nicks off a defender's boot. Corner {t}.","Cannons off {o} and behind. Corner {t}.","Deflects off a despairing challenge. Corner {t}.","Inside out off a defensive leg. Corner {t}."],
  corner_again:["Another corner {t}.","Taken short... and another corner {t}!","Still {t}'s corner. The pressure builds.","Worked back in... and it's another corner!","The corner leads to another! {t} keep the pressure on.","Blocked behind. Corner number two in quick succession for {t}.","In it comes, out it goes... and behind again. Corner {t}.","{o} can only put it behind. {t} will go again.","Deflected over. {t} keep the set-piece pressure coming.","Same routine, same result. Another {t} corner."],
  corner_delivery:["{t}'s {n} stands over the corner. In it comes!","The delivery from {t}'s {n}! Into the mixer!","{t}'s {n} whips it into the box!","{t}'s {n} curls it toward the six-yard area!","In it comes from {t}'s {n}! Looking for heads!","{t}'s {n} delivers to the far post!","{t}'s {n} floats it to the near post!","Swinging delivery from {t}'s {n}!","{t}'s {n} fires it in low! Near post!","Inswinger from {t}'s {n}! Bodies everywhere!"],
  corner_rebound:["Off the woodwork and behind for a corner!","Parried behind! Corner {t}.","Tipped over! Corner to {t}.","Rebounds for a corner!","The save deflects behind for a corner!","Pushed behind by the keeper! Corner {t}."],
  free_kick:["Free kick in a shooting position for {t}. {n} stands over it.","{t} with a direct free kick in range. {n} steps up.","Foul leaves {t} a real sight of goal. {n} eyes the wall.","{t}'s {n} places the ball down for the free kick.","Dangerous free kick for {t}. {n} takes the run-up.","Wall's set. {t}'s {n} ready to strike it.","{n} fancies this one for {t}. Free kick in a good area.","{t} have a direct shot at goal. {n} over the ball.","Promising free kick for {t}. {n} lines it up.","{t}'s {n} steps back, sizing up the free kick."],
  buildup:["{t}'s {n} drives forward into {o}'s half.","{t} working it wide. {n} has options.","{t} probing through the middle. {n} on the ball.","{t}'s {n} carries it forward. Space opening up.","Ball switched by {t}. {n} receives in space.","{t} patient in possession. {n} picks the pass.","Good move from {t}. {n} advancing.","{n} plays a one-two and surges forward for {t}.","{t}'s {n} finds space between the lines.","{t} building nicely. {n} turns and looks forward.","Neat combination from {t}. {n} carrying it forward.","{t}'s {n} clips one over the top. {t} progressing.","Quick passing from {t}. {n} picks it up on the half turn.","{t}'s {n} beats the press and drives on.","{t} overloading the flank. {n} involved.","{t}'s {n} drops deep, collects, turns and plays forward.","Sharp pass from {t}'s {n}. Through the first line.","Crossfield ball from {t}'s {n}. Play shifted wide.","{t}'s {n} threads it through the midfield. On the move.","Lovely first touch from {t}'s {n}. Turns and plays it forward."],
  z_neutral:["{t} controlling the tempo.","Midfield contest. {o} pressing.","Cagey. Neither side committing.","Throw-in {t}. Worked short.","Loose ball in midfield. Scramble.","Ball bobbling around. {t}'s {n} tidies up.","{t} knocking it around. No urgency.","Both sides keeping the ball for now.","{t}'s {n} sprays it wide. Tempo drops.","{o} win it back. Sideways.","Nothing happening in this spell.","Stalemate in midfield.","{t} trying to find a rhythm. {o} denying space.","{t}'s {n} holds it up. Waiting for runners.","Neither side in control.","Physical battle in the center. No quarter given.","{t}'s {n} plays it backwards. Lacking options.","{t} probing without threatening.","{o} sitting back. {t} circulating.","{t}'s {n} clips one sideways. Patience."],
  enter_box:["{t}'s {n} feeds it into the area! Dangerous!","Chance! {t}'s {n} in space inside the box!","{t} work it through! {n} in behind!","{n} picks it up in a dangerous position for {t}!","{t}'s {n} cuts inside and gets a sight of goal!","Lovely pass! {t}'s {n} is through on goal!","{t}'s {n} drives into the penalty area!","Threaded through! {t}'s {n} latches onto it!","One on one! {t}'s {n} bearing down on the keeper!","{t}'s {n} peels off the defender! Ball played in!","In behind! {t}'s {n} is clean through!","{t}'s {n} bursts into the box! This is a chance!","Slipped in! {t}'s {n} is free inside the area!","{t}'s {n} picks it up on the edge of the six-yard box!","Dangerous position! {t}'s {n} has the goal in his sights!"],
  chance_created:["{t}'s {n} threads it through! That's a chance!","What a ball from {t}'s {n}! Someone's in!","{t}'s {n} plays a killer ball into the box!","Incisive pass from {t}'s {n}! In behind!","{t}'s {n} picks out the run perfectly!","{t}'s {n} splits the defence wide open!","Slide-rule pass from {t}'s {n}! Chance created!","{t}'s {n} finds the gap with a sublime through ball!","Vision from {t}'s {n}! Plays it in behind!","{t}'s {n} releases it at the perfect moment!","Wonderful ball from {t}'s {n}! The defence is carved open!","{t}'s {n} clips it over the top! Someone's through!"],
  pressure:["Still {t}. Relentless pressure.","{o} under the cosh. {t} keep coming.","{t} camped in {o}'s half. Wave after wave.","{o} pinned deep. {t} won't relent.","{t} keep recycling. {o} can't escape.","{t} suffocating {o}. All hands defending.","{o} haven't touched the ball in minutes. {t} dominant.","{t} laying siege to {o}'s goal.","Bombardment from {t}. {o}'s defense under strain.","{t} camping in the final third. Feels inevitable.","All {t}. {o} clinging on.","{t} sustaining the pressure. {o} scrambling."],
  counter:["COUNTER! {t} catch {o} up the pitch! {n} leads the charge!","{t} break at pace! {n} driving forward!","Long ball over the top! {t}'s {n} racing clear!","Turnover! {t}'s {n} sprints into space!","{t} hit {o} on the break! {n} carrying it!","Quick transition! {t}'s {n} has support!","Intercepted! {t}'s {n} launches the counter!","{o} caught out! {t}'s {n} breaks with pace!","{t} spring forward! {n} galloping into {o}'s half!","Three on two! {t}'s {n} leading the break!","{o} overcommitted! {t}'s {n} exploits the gap!","Released! {t}'s {n} in behind with acres!","Stolen! {t}'s {n} picks it off and drives forward!","{t} on the counter! {n} has options either side!","Rapid break from {t}! {n} surging through the middle!"],
  sustain:["{t} working it around the edge of the box.","{t} keep probing. {o} holding firm.","{t}'s {n} looking for an opening. Recycled.","Patient from {t}. Waiting for the gap.","{t}'s {n} tries to thread it through. Blocked.","{t} shifting it side to side. {o} staying compact.","{t}'s {n} feints one way, goes the other. Still blocked.","{o} standing firm. {t} can't break through.","{t} patient in the final third. Looking for the killer ball.","{t}'s {n} drops a shoulder. The defender reads it.","Good defending from {o}. {t} recycling.","{t} recycling possession outside the box. {o} resolute.","{t}'s {n} looks for the channel. Cut out.","{t} knocking on the door. {o} barricading it.","{t}'s {n} whips it across the box. Cleared!"],
  neutral:["{t} passing it around at the back. No rush.","Cagey spell. Neither side committing.","{t} probe down the flank. Cross blocked.","Midfield tussle. Every second ball contested.","{o} press high. {t} play through it.","{t} in {o}'s half. Searching for openings.","Half chance breaks down. {t}'s {n} loses possession.","Long ball from {o}. Headed away.","{t} building from the back. Methodical.","{t} trying to find a route through. {o} compact.","Sideways from {t}. Looking for the gap.","Ball out for a throw. {t} regroup.","Scrappy phase of play. Nobody in control.","{o} soaking up pressure. Well-organized.","{t}'s {n} tries a through ball. Intercepted.","Lots of {o} bodies behind the ball.","Quiet passage. {t} keeping the ball without penetrating.","Midfield pinball. Neither team in command.","{t} switching play from side to side.","Tactical foul from {o}. Breaks {t}'s momentum.","{o} sitting deep. Inviting {t} onto them.","Nothing doing for {t}. {o} have numbers back.","Getting heated in midfield. Referee has a word.","End-to-end briefly. Ball bouncing between halves.","Drinks break. Managers issuing instructions."],
  time_waste:["{t} taking their time over the restart.","{t} in absolutely no hurry.","Ball boy taking his time. {t} happy to wait.","{t} slowing the game down. {o} frustrated.","{t} running down the clock. Crowd getting restless.","Every restart takes an age. {t} know exactly what they're doing.","The keeper examines the ball at length. {t} in no rush.","A leisurely stroll to the corner flag from {t}.","Cramp, apparently. The physio jogs on. {t} happy with the delay.","{t} argue over who takes the throw. The clock ticks on.","Substitution board up... eventually. {t} milking every second.","Watch-tapping from the referee. {t} unmoved."],
  press_won:["{t} press and win it back!","Turnover! {t}'s pressing pays off!","{t} win the ball high up the pitch!","Good press from {t}! Won the ball!","{t} force the error! Ball turned over!","High press from {t} forces the turnover!","Hunted down! {t} strip the ball loose in {o}'s half!","{o} play their way into trouble! {t} pounce!","Swarmed! Three {t} shirts and the ball is won!","The press bites! {t} regain it high!","Nowhere to go for {o}! {t} steal it back!","Trapped by the touchline! {t} win it off the press!"],
  chance_magic:["{t}'s {n} nutmegs the defender and bursts through!","{t}'s {n} drops a shoulder, cuts inside and drives into the box!","{t}'s {n} flicks it over the defender's head and collects! Through on goal!","{t}'s {n} beats two men with a drag-back and accelerates clear!","{t}'s {n} dances past three challenges on a mazy dribble!","{t}'s {n} spins away from the marker with a Cruyff turn! Space ahead!","{t}'s {n} rolls the ball through the defender's legs and races on!","{t}'s {n} chops inside off the right and leaves the fullback for dead!","{t}'s {n} knocks it past the defender and wins the footrace!","{t}'s {n} takes on two with quick feet and emerges in space!","{t}'s {n} feints left, shifts right, and surges past the last man!","{t}'s {n} picks up the ball on the halfway line and drives at the defense!"],
  trap_beaten:["{t}'s {n} times the run perfectly! Clean through behind the high line!","{t}'s {n} stays onside and latches onto the through ball! One on one!","{t}'s {n} beats the offside trap! Sprints clear into the channel!","Ball over the top and {t}'s {n} is in behind! The trap has failed!","{t}'s {n} peels off the last defender and collects! Racing through on goal!","{t}'s {n} holds the run and goes! Past the high line and clear!","The flag stays down! {t}'s {n} is away! Clean through!","Caught square! {o}'s line is breached and {t}'s {n} is gone!","One ball undoes the whole back line! {t}'s {n} through on goal!","{o} step up... too late! {t}'s {n} is in behind!","Timed to the centimetre! {t}'s {n} bursts through the gap!","Gambled and lost! {o}'s high line is torn open by {t}'s {n}!"],
  clearance_edge:["{n} clears, but only to the edge.","Headed out by {n}. Ball at the edge of the box.","{n} can't clear the lines properly. Ball falls loose.","Last-ditch clearance from {n}. Not convincing.","{n} scrambles it away. Still in {o}'s half.","Cleared under pressure by {n}. Just about.","Booted away by {n}. Not out of danger yet.","{n} hacks it clear. Temporary relief.","Anywhere will do! {n} smashes it clear, but not far.","Half a clearance from {n}. The danger lingers.","{n} throws a body at it. The ball squirts to the edge.","Desperate stuff from {n}. It drops just outside the box."],
  clearance_mid:["Cleared by {n}. Midfield.","{n} wins the ball and clears it long.","Headed out by {n}. Back in the middle third.","{n} deals with it comfortably. Ball in midfield.","Cleared to halfway by {n}.","{n} clears it. {o} regroup."],
  tackle_won:["{o}'s {n} slides in! Won it cleanly!","Crunching tackle from {o}'s {n}! Ball won!","What a challenge from {o}'s {n}! Timed it perfectly!","{o}'s {n} gets a foot in! Possession won!","{o}'s {n} reads it and nips in! Dispossessed!","{o}'s {n} commits and wins it! Great tackle!","In hard from {o}'s {n}! Clean as a whistle!","{o}'s {n} stands tall! Tackles and wins it!","{o}'s {n} puts in a trademark challenge!","{o}'s {n} recovers and tackles! Superb!","Textbook from {o}'s {n}! Ball cleanly won!","{o}'s {n} sticks a leg out and takes it! Well timed!"],
  interception:["{o}'s {n} reads it! Steps across and intercepts!","Intercepted by {o}'s {n}! Saw it coming a mile off!","{o}'s {n} cuts out the pass! Great anticipation!","Sharp from {o}'s {n}! Picks it off before it arrives!","{o}'s {n} gets across the lane! Intercepted!","Read like a book by {o}'s {n}! Cut out!","{o}'s {n} jumps the passing lane! Snuffed out!","{o}'s {n} pounces on a loose ball! Chance gone!","Brilliant reading from {o}'s {n}! Never getting through!","{o}'s {n} anticipates the through ball! Picked off!","The pass was telegraphed. {o}'s {n} takes it gratefully!","{o}'s {n} steps in front! Intercepted cleanly!"],
  def_block:["{o}'s {n} throws himself in front of it! Blocked!","Last-ditch block from {o}'s {n}! Heroic!","{o}'s {n} gets a vital block in! Saved his team!","Blocked! {o}'s {n} puts his body on the line!","{o}'s {n} sticks out a boot! Crucial block!","Hurls himself at it! {o}'s {n} blocks the danger!","{o}'s {n} stands firm! Shuts the door!","Flung himself in the way! {o}'s {n} denies it!","{o}'s {n} slides across! Gets something on it!","The ball crashes into {o}'s {n}! Smothered!","Brave from {o}'s {n}! Takes it on the chest!","{o}'s {n} closes the angle and blocks!"],
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

export const FORMATIONS=["4-2-4","3-4-3","4-1-2-1-2","4-3-3","4-4-2","4-2-3-1","3-5-2","3-4-1-2","4-1-4-1","4-3-2-1","5-3-2"];

// ponytail: style fit — key-position OVR determines how much of a style's bonus you actually get
// Squad-fit scaled a style's modifiers by how well the players suited it. With no modifiers left to
// scale it has nothing to do, and a side that wants to press now says so on the pressing slider.
// WHICH PLAYERS A STYLE ACTUALLY LEANS ON. computeStyleFit weights the starting XI by these, maps
// the result through (avg - 65) / 20 and scales the style's modifiers by it -- so a style is strong
// when you have the players for it and damps toward Balanced when you do not.
//
// Only counterattack had an entry, so every other style returned a flat 1 and NO squad could ever
// be built to suit it: a side with world-class wingers got nothing from Wing Play. Measured at the
// time, Wing Play, Gegenpress and Tiki-Taka all sat within 0.0006 ppm of Balanced -- three styles
// that were, functionally, the same style with different names.
//
// Weights sum to 1.0 in every entry, or the (avg - 65) / 20 mapping is not comparable between
// styles and one of them silently gets a higher ceiling. Balanced deliberately has NO entry: it is
// the style that asks nothing of your squad, which is what makes it the honest fallback.
// `mid` and `span` CENTRE the fit. The old mapping was a hardcoded (avg - 65) / 20, so fit reached
// 1.00 only at a weighted average of 85 and hit the 0.30 floor at 71 -- and the median international
// squad measures 70-73 on every one of these weight sets. Every style with an entry was therefore
// damped to about a THIRD of its designed strength for a typical side, Counter included; it merely
// looked healthy because only elite squads ever cleared the floor. Measured after adding entries for
// the other four, Wing Play and Gegenpress went from balanced to -0.018 ppm, which is that handicap.
//
// So each style carries its own centre: mid is the median squad on ITS OWN key positions, meaning a
// typical side plays its chosen style at full strength, and span is sized so the best-suited squad
// in the world reaches about 1.20 rather than clamping. Below the median a style damps toward
// Balanced, which is the intended behaviour -- a system you do not have the players for.
export const STYLE_FIT_SPOS = {
  // Width wins it: the wide men, and the full-backs who overlap them.
  wingplay:      { wide: 0.45, fb: 0.20, fwd: 0.20, gk: 0.15, mid: 72.4, span: 74 },
  // Everything runs through the middle third.
  tikitaka:      { cmid: 0.50, def: 0.20, fwd: 0.15, gk: 0.15, mid: 74.5, span: 63 },
  // There is nowhere to hide in a press -- every outfielder has to be able to do it.
  // cmid is weighted, not just needed: computeStyleFit only charges a shortfall on a role the style
  // WEIGHTS, so a need on an unweighted role is silently dead. Gegenpress asked for a midfield
  // overload it never weighted and scored a flat 1.000 for every shape in the game.
  // Weights still sum to 1.0, which the (avg - own) mapping depends on.
  gegenpress:    { all: 0.40, cmid: 0.20, def: 0.20, gk: 0.20, mid: 74.7, span: 58 },
  // Absorb, then hurt them: the front men who finish it and the back line that survives until then.
  counterattack: { fwd: 0.55, def: 0.30, gk: 0.15, mid: 75.2, span: 63 },
  // A back line and a goalkeeper, and enough legs in front of them to screen it.
  parkthebus:    { def: 0.55, gk: 0.30, cmid: 0.15, mid: 74.8, span: 60 },
  // The four styles added later share a curve with their nearest measured neighbour rather than
  // getting four freshly-fitted mid/span pairs. That is deliberate: the curve answers "which
  // players does this ask for", and two styles built on the same players should ask for the same
  // ones. Fitting each separately would also mean four more calibration runs to buy nothing.
  possession:    { cmid: 0.50, def: 0.20, fwd: 0.15, gk: 0.15, mid: 74.5, span: 63 }, // as tikitaka
  verticaltiki:  { cmid: 0.50, def: 0.20, fwd: 0.15, gk: 0.15, mid: 74.5, span: 63 }, // as tikitaka
  routeone:      { fwd: 0.55, def: 0.30, gk: 0.15, mid: 75.2, span: 63 },             // as counterattack
  catenaccio:    { def: 0.55, gk: 0.30, cmid: 0.15, mid: 74.8, span: 60 },            // as parkthebus
  secondball:    { fwd: 0.55, def: 0.30, gk: 0.15, mid: 75.2, span: 63 },             // as counterattack
  zonamista:     { def: 0.55, gk: 0.30, cmid: 0.15, mid: 74.8, span: 60 },            // as parkthebus
  lanuestra:     { all: 0.40, cmid: 0.20, def: 0.20, gk: 0.20, mid: 74.7, span: 58 }, // as gegenpress
  // A mid-block is the one shape here that is genuinely midfield-AND-defence led, so it does not
  // inherit cleanly from either the cmid-heavy or the def-heavy curve. Weights are its own; mid and
  // span are interpolated between the two it sits between rather than fitted from scratch.
  cholismo:      { cmid: 0.40, def: 0.35, gk: 0.15, fwd: 0.10, mid: 74.5, span: 61 },
};

// What a full weight of missing personnel costs. 0.60 puts a style whose entire key group is absent
// at roughly 0.73 fit, which is well inside applyStyleFit's damping toward Balanced without being a
// death sentence -- you can play a system you are not built for, badly.
export const FIT_MISS = 0.60;

// A SYSTEM IS LIMITED BY ITS WORST KEY MAN, NOT ITS AVERAGE ONE. Fit took the mean of a role group,
// so an 85 winger alongside a 57 scored exactly what two 71s scored -- and in football those are not
// the same side, because the weak flank gets attacked for ninety minutes.
// It is also where the only real signal is. Measured across all 61 clubs: the gap between a group's
// average and the squad's own average has a standard deviation of 2.0 rating points, which through
// the old span is worth 0.03 of fit and is why 52% of club-by-style pairs sat inside 0.98-1.02. The
// spread WITHIN a role averages 4.2 points and reaches 28. Fit was reading the flat quantity and
// discarding the varied one.
// FIT_WEAK 0.5 is a half-and-half blend of the group mean and its worst member.
// ...and the spans were fitted for the old population-centred mapping that `mid` served, which the
// zero-mean rewrite retired without re-fitting them. At 58-74 in the denominator a six-point deficit
// moved fit by a tenth. Halved, so the quality term has range comparable to the supply term.
export const FIT_WEAK = 0.5, FIT_SPAN = 0.5;

// A MAN OUT OF POSITION IS NOT THE PLAYER HIS RATING SAYS HE IS. natPos has existed on every player
// since the formation-change work and is read NOWHERE in src/engine -- a striker fielded at centre
// half was worth his full OVR to the shape, the block and the fit alike. Fit is the honest place to
// charge it: the question it asks is whether this squad can carry out this system, and eleven men
// in the wrong shirts cannot.
// Positions sit on a depth/width grid, so the cost is a distance rather than a table of pairs.
// Depth is the expensive axis -- a striker at the back is a catastrophe, a left-back on the right is
// an inconvenience -- and the keeper is its own case, because there is no such thing as nearly a
// goalkeeper.
export const FIT_POS_XY = { GK:[0,0], CB:[1,0], LB:[1,-1], RB:[1,1], DEF:[1,0],
                     LWB:[2,-1], RWB:[2,1], DM:[2,0],
                     CM:[3,0], LM:[3,-1], RM:[3,1], MID:[3,0],
                     AM:[4,0], LW:[4,-1], RW:[4,1],
                     ST:[5,0], FWD:[5,0] };

export const FIT_OOP_DEPTH = 4, FIT_OOP_SIDE = 3, FIT_OOP_GK = 25;

export const fitEffOvr = (p) => {
  const o = p.ovr || 65, np = p.natPos || p.spos || p.pos, sp = p.spos || p.pos;
  if (!np || np === sp) return o;
  if ((np === "GK") !== (sp === "GK")) return Math.max(20, o - FIT_OOP_GK);
  const a = FIT_POS_XY[np], b = FIT_POS_XY[sp];
  if (!a || !b) return o;
  return Math.max(20, o - Math.abs(a[0] - b[0]) * FIT_OOP_DEPTH - Math.abs(a[1] - b[1]) * FIT_OOP_SIDE);
};

// WHICH ROLE POWERS WHICH INSTRUCTION. meStrategyFor scaled all eleven identity axes by ONE number,
// so a side with no wide men had its pressing line damped exactly as hard as its width -- which says
// squad suitability is a volume knob rather than a statement about what you can and cannot do.
// One generic mapping rather than one per style: width and running at people come from the wide men,
// the build-up axes from midfield, shooting from the forwards, the press from everybody, and the
// line and the challenge from the defence. A style that wants something its squad has not got now
// loses THAT, and keeps the rest.
export const FIT_KEY_ROLE = { width: "wide", dribbling: "wide",
                       passingDir: "cmid", approachPlay: "cmid", possWon: "cmid", possLost: "cmid",
                       creativity: "cmid", chanceCreation: "fwd",
                       pressingLOE: "all", tackling: "def", defLine: "def" };

// A WING-BACK IS NOT A WINGER, AND A DM IS NOT AN ATTACKING MIDFIELDER. Membership of a role used to
// be a yes/no: six different positions all counted as fully "wide", so a 3-5-2's wing-backs made it a
// perfect Wing Play side and a holding midfielder was worth exactly what a number ten was worth to
// Tiki-Taka. That is the same flattening as the missing-winger bug, one level down -- the shape
// technically fields the role, so nothing is charged.
// Each position now contributes a WEIGHT to each role. Supply is the sum of those weights, so two
// wing-backs are 1.2 wingers rather than 2, and quality is their weighted mean. Full-backs carry a
// quarter of the width, which is why a back four gives a shape SOME wide presence without being a
// wide system, and the wide men carry a little of the full-back role, which retires the old
// no-fullbacks special case: a 3-4-3 is covered by its wide players rather than exempted by a branch.
export const FIT_ROLE_W = {
  LW:  { wide: 1.00, fb: 0.15 },              RW:  { wide: 1.00, fb: 0.15 },
  LM:  { wide: 0.80, fb: 0.40, cmid: 0.30 },  RM:  { wide: 0.80, fb: 0.40, cmid: 0.30 },
  LWB: { wide: 0.60, fb: 1.00, def: 0.70 },   RWB: { wide: 0.60, fb: 1.00, def: 0.70 },
  LB:  { wide: 0.25, fb: 1.00, def: 1.00 },   RB:  { wide: 0.25, fb: 1.00, def: 1.00 },
  CB:  { def: 1.00 },
  DM:  { cmid: 0.80, def: 0.40 },
  CM:  { cmid: 1.00 },
  AM:  { cmid: 0.85, fwd: 0.30 },
  ST:  { fwd: 1.00 },
  GK:  { gk: 1.00 },
  // Squads carrying only a broad pos rather than a specific one. Deliberately blunt: an unspecified
  // defender is most of a centre-half and a bit of a full-back, and nothing is a winger by accident.
  DEF: { def: 0.90, fb: 0.35, wide: 0.10 },
  MID: { cmid: 0.85, wide: 0.20 },
  FWD: { fwd: 0.95 },
};

export const fitRoleW = (sp, role) => (role === "all" ? (sp === "GK" ? 0 : 1) : (FIT_ROLE_W[sp]?.[role] ?? 0));

// HOW MANY OF EACH A STYLE NEEDS ON THE PITCH, not just how good they are. Anything unlisted needs
// one. This is the half computeStyleFit never had: it asked whether your wide men were good and
// never whether you had any.
export const STYLE_FIT_NEED = {
  // DEMANDING SPECIALISTS, NOT ADEQUATE COVERAGE. These were headcounts of what an ordinary shape
  // already fields, so a plain 4-3-3 satisfied nearly every style and the supply term went silent for
  // three quarters of club-by-style pairs. A system should want MORE of its key role than a generic
  // formation supplies, or picking it says nothing about your squad.
  // Graded units (see FIT_ROLE_W), and what the common shapes actually supply:
  //             wide   cmid    def    fwd
  //   4-3-3     2.50   3.00   4.00   1.00
  //   4-4-2     2.10   2.60   4.00   2.00
  //   4-2-3-1   2.50   2.45   4.80   1.30
  //   3-5-2     1.20   3.00   4.40   2.00
  // Two actual wingers with the full-backs behind them. A 3-5-2 supplies 1.2 of it.
  wingplay:      { wide: 2.5, fb: 2, fwd: 1 },
  // A midfield overload: more than the three a 4-3-3 gives, so only a shape built around the middle
  // clears it. A 4-4-2 diamond (DM, two CM, AM) supplies 3.65.
  tikitaka:      { cmid: 3.5, def: 4, fwd: 1 },
  possession:    { cmid: 3.5, def: 4, fwd: 1 },
  verticaltiki:  { cmid: 3.5, def: 4, fwd: 1 },
  cholismo:      { cmid: 3.2, def: 4, fwd: 1 },
  // Pressing is legs in midfield as much as a back line -- there is nowhere to hide in it, and a
  // side with two holders and nobody ahead of them cannot sustain one.
  // 3.4, not 3: at 3 every common shape cleared it and Gegenpress scored a flat 1.000 for all of
  // them -- a style that asks nothing of your squad, which is the whole defect this table exists to
  // fix. Sustaining a press is a midfield overload for the same reason Tiki-Taka is.
  gegenpress:    { def: 4, cmid: 3.4 },
  lanuestra:     { def: 4, cmid: 3.4 },
  // A front two AND somebody arriving. A flat 4-4-2 supplies exactly 2.0 and is a shade short.
  counterattack: { fwd: 2.2, def: 4 },
  routeone:      { fwd: 2.2, def: 4 },
  secondball:    { fwd: 2.2, def: 4 },
  // Five at the back, which is what these shapes are for: a back four supplies 4.0 against 4.5, a
  // back five with wing-backs 4.4. Plus a screen in front of it rather than a lone holder.
  parkthebus:    { def: 4.5, cmid: 2.5 },
  catenaccio:    { def: 4.5, cmid: 2.5 },
  zonamista:     { def: 4.5, cmid: 2.5 },
};

// One pass over the XI, resolved PER ROLE. Both the scalar fit (which the abstract engine's
// applyStyleFit still wants) and the per-role fit the positional engine damps instructions with are
// collapses of the same numbers, so they cannot disagree about a squad.
// Ratings here are fitEffOvr, not raw OVR: a man in the wrong position is not the player his rating
// says he is, and until now nothing in the project charged for that.
export function _fitParts(style, squad) {
  const w = STYLE_FIT_SPOS[style]; if (!w) return null;
  const starters = squad.filter(p => !p.bench);
  const own = starters.length ? starters.reduce((a, p) => a + fitEffOvr(p), 0) / starters.length : 65;
  const need = STYLE_FIT_NEED[style] || {};
  const roles = {};
  const grp = (key) => {
    const m = starters.filter(p => fitRoleW(p.spos || p.pos, key) > 0);
    // A MISSING POSITION IS NOT A 65-RATED PLAYER. An empty group used to score a flat 65, so a
    // shape with nobody wide "had" two average wingers and Wing Play on a 75-rated side computed
    // 0.94 -- the entire basis of the style absent, for six per cent. Empty now scores the squad's
    // own average, which is neutral on QUALITY, and the absence is charged as SUPPLY below.
    // Weighted by how much of this role each man actually is, so a wing-back lifts the wide group
    // less than a winger does and drags it less when he is poor.
    const ws = m.map(p => fitRoleW(p.spos || p.pos, key)), os_ = m.map(fitEffOvr);
    const wsum = ws.reduce((a, b) => a + b, 0);
    const mean = wsum ? os_.reduce((a, o, i) => a + o * ws[i], 0) / wsum : own;
    // How far this role's WORST man falls below its own average. Charged relative to how lopsided
    // the squad is in general (see penBar), because a blend toward the minimum is always negative --
    // uncentred it is a flat tax on having a style at all, and Balanced pays no fit, so it would
    // quietly make the no-instruction style the strongest thing in the game.
    // Supply is the SUM of the weights, not a headcount: two wing-backs are 1.2 wingers.
    roles[key] = { avg: mean, pen: os_.length ? FIT_WEAK * (mean - Math.min(...os_)) : 0,
                   miss: Math.max(0, 1 - wsum / (need[key] ?? 1)) };
  };
  for (const k of ["wide", "fb", "fwd", "cmid", "def", "gk", "all"]) grp(k);
  // The squad's typical lopsidedness across the four outfield roles, so the weak-link term measures
  // whether THIS role is unusually top-heavy rather than whether the squad has any spread at all.
  const ks = ["wide", "cmid", "def", "fwd"].filter(k => roles[k]);
  const penBar = ks.length ? ks.reduce((a, k) => a + roles[k].pen, 0) / ks.length : 0;
  return { w, own, span: (w.span ?? 20) * FIT_SPAN, roles, penBar };
}

// MEASURED AGAINST THE SQUAD'S OWN LEVEL, not a population median. Centring on the population
// conflated squad QUALITY with style SUITABILITY: a strong side scored high fit for every style, so
// the sixteen best national teams all sat at ~1.13 and collected a flat bonus that had nothing to do
// with whether the system suited them. Quality is already priced in OVR. What decides whether a side
// can carry out a system is whether its strength sits WHERE the system needs it, plus whether the
// bodies are there at all.
export const _fitOf = (avg, miss, own, span) =>
  Math.max(0.3, Math.min(1.25, 1 + (avg - own) / span - miss * FIT_MISS));

export function computeStyleFit(style, squad) {
  const P = _fitParts(style, squad); if (!P) return 1;
  let avg = 0, miss = 0, pen = 0;
  for (const k of ["wide", "fb", "fwd", "cmid", "def", "gk", "all"]) {
    const wt = P.w[k]; if (!wt) continue;
    avg += wt * P.roles[k].avg; miss += wt * P.roles[k].miss; pen += wt * (P.roles[k].pen - P.penBar);
  }
  return _fitOf(avg - pen, miss, P.own, P.span);
}

// The same question asked one role at a time, so an instruction can be damped by the men who
// actually carry it out rather than by a single number standing for the whole squad.
export function computeRoleFit(style, squad) {
  const P = _fitParts(style, squad);
  const out = { overall: P ? computeStyleFit(style, squad) : 1 };
  if (!P) return out;
  for (const k of ["wide", "fwd", "cmid", "def", "all"])
    out[k] = _fitOf(P.roles[k].avg - (P.roles[k].pen - P.penBar), P.roles[k].miss, P.own, P.span);
  return out;
}

export const STRAT_DEF = { tempo:0, width:0, passingDir:0, chanceCreation:0, pressingLOE:0, defLine:0, possWon:0, approachPlay:0, dribbling:0, creativity:0, timeWasting:0, possLost:0, gkDist:0, dlBehavior:0, tackling:0 };

// A team's identity is its playstyle and its formation. These ten axes ARE that identity, so they
// are no longer set per team: STYLE_PRESET stamps them and the UI does not offer them. The engine
// still reads every one of them exactly as before -- nothing here changes what an instruction does,
// only who decides it. This is what retires the stacked "best of every slider" build: it cannot be
// constructed any more, because nine of its ten axes are no longer separately selectable.
export const IDENTITY_KEYS = ["approachPlay","passingDir","width","chanceCreation","dribbling","creativity",
                       "possLost","possWon","pressingLOE","defLine","tackling"];

// STYLE FIT, ON THE ENGINE THAT ACTUALLY PLAYS THE MATCHES. computeStyleFit has existed since the
// abstract engine and is called from nowhere inside src/engine -- so the term built to stop a side
// playing a system it has not got the players for, calibrated at ~3.6 points a season and
// deliberately set ABOVE the style spread so that squad matters more than system, was worth exactly
// zero on the positional engine. The designed hierarchy was missing a leg.
// It lands on the INSTRUCTION MAGNITUDES here rather than on modifier tables, because the positional
// engine has no modifier tables. A side that does not suit its system carries its instructions out
// weakly and drifts toward all-zero, which is precisely Balanced -- the same thing applyStyleFit
// does by interpolating toward the Balanced row, expressed in the only currency this engine has.
// Safe because every identity axis is read arithmetically in brain/decide/match: no array is indexed
// by one, no branch switches on an exact value, and the one boolean gate (possLost > 0) keeps its
// sign under a positive scale factor.
// The three EDITABLE axes are deliberately untouched. Time-wasting, GK distribution and how the line
// behaves are execution choices a manager makes; they are not claims about whether the squad suits
// the system, so squad suitability has no business damping them.
// ...AND IT DAMPS PER ROLE, not by one number. Scaling all eleven identity axes by a single scalar
// said squad suitability is a volume knob: a side with no wide men had its pressing line, its
// tackling and its defensive line pulled toward zero exactly as hard as its width, which is not a
// claim anybody would make about a football team. What a squad without wingers cannot do is play
// wide; it can still press. FIT_KEY_ROLE maps each axis to the men who carry it out.
export const meStrategyFor = (t) => {
  const st = { ...STRAT_DEF, ...(t?.strategy || {}) };
  const rf = computeRoleFit(t?.style || "balanced", t?.squad || []);
  for (const k of IDENTITY_KEYS) {
    const f = rf[FIT_KEY_ROLE[k]] ?? rf.overall;
    if (st[k] && f !== 1) st[k] = st[k] * f;
  }
  return st;
};

export function createMatchState() {
  return { phase:"pre_match",minute:0,stoppageElapsed:0,stoppageTotal:0,stoppageBank:0,score:[0,0],events:[],stats:{home:{shots:0,onTarget:0,fouls:0,yellows:0,reds:0,corners:0,penalties:0,woodwork:0,injuries:0,injuriesNoSub:0},away:{shots:0,onTarget:0,fouls:0,yellows:0,reds:0,corners:0,penalties:0,woodwork:0,injuries:0,injuriesNoSub:0}},players:{home:[],away:[]},bench:{home:[],away:[]},booked:{home:[],away:[]},goalscorers:{home:[],away:[]},subbedOff:{home:[],away:[]},forceResult:false,penalties:null,ball:2,pressure:0,tactics:{home:"bal",away:"bal"},possession:"home",possCount:{home:0,away:0},styles:{home:"balanced",away:"balanced"},allowTacChange:{home:true,away:true},autoSubs:{home:true,away:true},momentum:{home:0,away:0},formations:{home:"4-3-3",away:"4-3-3"},homeAdv:null,venue:null,subs:{home:0,away:0},subCap:{home:3,away:3}, startScore:[0,0], isSecondLeg:false, pendingPenalty:null, activeChance:null, xG:{home:0,away:0},momHist:[],strategy:{home:{...STRAT_DEF},away:{...STRAT_DEF}},matchUrg:{home:0,away:0}, teamForm:{home:0,away:0}, injuriesEnabled:true };
}

// The second leg is played with the sides swapped into the home and away slots, so what a tie is
// worth to each of them has to be swapped with them. Urgency follows the men, not the slot.
export const flipUrg = (u) => u ? { home: u.away ?? 0, away: u.home ?? 0 } : u;

export function quickPenShootout(rng) {
  let h = 0, a = 0;
  for (let i = 0; i < 5; i++) { if (rng.u() < 0.75) h++; if (rng.u() < 0.75) a++; }
  while (h === a) { if (rng.u() < 0.75) h++; else a++; if (h !== a) break; if (rng.u() < 0.75) a++; else h++; }
  return { home: h, away: a };
}

export function simTwoLegMatch(rng, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg1HA, leg2HA, homeStrat, awayStrat, awayGoals, homeSquad, awaySquad, urg, injuriesOn) {
  const l1 = simPositionalMatch(rng, homeSkill, awaySkill, false, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat, homeSquad, awaySquad, urg, null, injuriesOn);
  const l2f = leg2HA === "home" ? "away" : leg2HA === "away" ? "home" : null;
  const l2 = simPositionalMatch(rng, awaySkill, homeSkill, false, awayStyle, homeStyle, awayForm, homeForm, l2f, awayStrat, homeStrat, awaySquad, homeSquad, flipUrg(urg), null, injuriesOn);
  const aggH = l1.ftHome + l2.ftAway, aggA = l1.ftAway + l2.ftHome;
  const awayH = l2.ftAway, awayA = l1.ftAway;
  const result = { twoLeg:true, leg1:{home:l1.ftHome,away:l1.ftAway}, leg2:{home:l2.ftHome,away:l2.ftAway}, agg:{home:aggH,away:aggA}, awayGoals:{home:awayH,away:awayA}, awayGoalsRule:!!awayGoals, et:null, pen:null, cards:{leg1:l1.cards,leg2:l2.cards}, playerData:{leg1:l1.playerData,leg2:l2.playerData} };
  if (aggH !== aggA) return result;
  if (awayGoals && awayH !== awayA) return result;
  // Aggregate tied (and away goals don't decide) — use L2 ET if it happened, else generate pens
  if (l2.et) { result.et = {home:l2.et.away, away:l2.et.home}; result.agg.home += l2.et.away; result.agg.away += l2.et.home; if (result.agg.home !== result.agg.away) return result; }
  if (l2.pen) { result.pen = {home:l2.pen.away, away:l2.pen.home}; }
  else { const p = quickPenShootout(rng); result.pen = { home: p.away, away: p.home }; }
  return result;
}

export function simFirstLeg(rng, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat, homeSquad, awaySquad, urg, injuriesOn) {
  const l1 = simPositionalMatch(rng, homeSkill, awaySkill, false, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat, homeSquad, awaySquad, urg, null, injuriesOn);
  return { twoLeg:true, partial:true, leg1:{home:l1.ftHome,away:l1.ftAway}, leg2:null, agg:null, awayGoals:null, awayGoalsRule:false, et:null, pen:null, cards:{leg1:l1.cards}, playerData:{leg1:l1.playerData} };
}

export function simSecondLeg(rng, partial, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg2HA, homeStrat, awayStrat, awayGoals, homeSquad, awaySquad, urg, injuriesOn) {
  const l2f = leg2HA === "home" ? "away" : leg2HA === "away" ? "home" : null;
  const l2 = simPositionalMatch(rng, awaySkill, homeSkill, false, awayStyle, homeStyle, awayForm, homeForm, l2f, awayStrat, homeStrat, awaySquad, homeSquad, flipUrg(urg), null, injuriesOn);
  const l1 = partial.leg1, aggH = l1.home + l2.ftAway, aggA = l1.away + l2.ftHome;
  const awayH = l2.ftAway, awayA = l1.away;
  const result = { twoLeg:true, partial:false, leg1:l1, leg2:{home:l2.ftHome,away:l2.ftAway}, agg:{home:aggH,away:aggA}, awayGoals:{home:awayH,away:awayA}, awayGoalsRule:!!awayGoals, et:null, pen:null, cards:{leg1:partial.cards?.leg1,leg2:l2.cards}, playerData:{leg1:partial.playerData?.leg1,leg2:l2.playerData} };
  if (aggH !== aggA) return result;
  if (awayGoals && awayH !== awayA) return result;
  if (l2.et) { result.et = {home:l2.et.away, away:l2.et.home}; result.agg.home += l2.et.away; result.agg.away += l2.et.home; if (result.agg.home !== result.agg.away) return result; }
  if (l2.pen) { result.pen = {home:l2.pen.away, away:l2.pen.home}; }
  else { const p = quickPenShootout(rng); result.pen = { home: p.away, away: p.home }; }
  return result;
}

export function parseOvr(raw) { if (!raw) return {name:raw,ovr:null,nat:null}; let s=raw.trimEnd().replace(/\s*\[[*+]\]$/, ""); let nat=null; const nm=s.match(/\s*\[([A-Za-z]{2,4})\]$/); if(nm){nat=nm[1].toUpperCase();s=s.slice(0,nm.index).trim();} const pre=s.match(/^\((\d{1,2})\)\s*/); if(pre) return {name:s.slice(pre[0].length).trim(),ovr:Math.max(1,Math.min(99,+pre[1])),nat}; const suf=s.match(/\((\d{1,2})\)$/); if(suf) return {name:s.slice(0,suf.index).trim(),ovr:Math.max(1,Math.min(99,+suf[1])),nat}; return {name:s,ovr:null,nat}; }

export const FORM_SPOS = {
  "4-2-4":     ["GK","LB","CB","CB","RB","CM","CM","LW","ST","ST","RW"],
  "4-4-2":     ["GK","LB","CB","CB","RB","LM","CM","CM","RM","ST","ST"],
  "4-3-3":     ["GK","LB","CB","CB","RB","CM","CM","CM","LW","ST","RW"],
  "4-2-3-1":   ["GK","LB","CB","CB","RB","DM","DM","AM","AM","AM","ST"],
  "4-1-4-1":   ["GK","LB","CB","CB","RB","DM","LW","CM","CM","RW","ST"],
  "4-1-2-1-2": ["GK","LB","CB","CB","RB","DM","CM","CM","AM","ST","ST"],
  "4-3-2-1":   ["GK","LB","CB","CB","RB","CM","CM","CM","AM","AM","ST"],
  "3-4-3":     ["GK","CB","CB","CB","LM","CM","CM","RM","LW","ST","RW"],
  "3-5-2":     ["GK","CB","CB","CB","LWB","CM","CM","CM","RWB","ST","ST"],
  "3-4-1-2":   ["GK","CB","CB","CB","LWB","CM","CM","RWB","AM","ST","ST"],
  "5-3-2":     ["GK","LWB","CB","CB","CB","RWB","CM","CM","CM","ST","ST"],
};

export function sposFor(fm) {
  if (FORM_SPOS[fm]) return FORM_SPOS[fm];
  const d2=fm.split("-").map(Number); const s=["GK"]; const nd=d2[0]; if(nd<=3)for(let i=0;i<nd;i++)s.push("CB"); else{for(let i=0;i<nd;i++)s.push(i===0?"LB":i===nd-1?"RB":"CB");} for(let d=1;d<d2.length-1;d++){const isDeep=d===1&&d2.length>3;for(let i=0;i<d2[d];i++)s.push(isDeep?"DM":"CM");} const nf=d2[d2.length-1];if(nf===1)s.push("ST");else if(nf===2){s.push("ST","ST");}else{for(let i=0;i<nf;i++)s.push(i===0?"LW":i===nf-1?"RW":"ST");} return s;
}

export function buildSquad(formation, names, benchSize) {
  const n = names || [];
  // benchSize is explicit where the caller knows it (the TSV parser reads it off the row
  // width); otherwise it is inferred from the name count, which is how a rebuild from an
  // existing squad keeps whatever bench that squad already had.
  const dg = (formation || "4-3-3").split("-").map(Number);
  const sq = [];
  // Per-formation attacking weight gradients (contextual to role)
  // Per-formation attacking weight gradients: L-to-R within each layer
  const FG = {
    "4-2-4":     [0, 4,3,3,4, 16,16, 34,40,42,34],          // LB CB CB RB | CM CM | LW ST ST RW
    "4-4-2":     [0, 4,3,3,4, 20,16,16,20, 40,42],           // LB CB CB RB | LM CM CM RM | ST ST
    "4-3-3":     [0, 5,3,3,5, 14,18,14, 34,42,34],           // LB CB CB RB | CM CM(b2b) CM | LW ST RW
    "4-2-3-1":   [0, 4,3,3,4, 10,10, 24,30,24, 42],          // LB CB CB RB | DM DM | LAM CAM RAM | ST
    "4-1-4-1":   [0, 4,3,3,4, 8, 26,16,16,26, 38],           // LB CB CB RB | DM | LW CM CM RW | ST
    "4-1-2-1-2": [0, 4,3,3,4, 8, 16,16, 30, 40,42],          // LB CB CB RB | DM | CM CM | AM | ST ST
    "4-3-2-1":   [0, 4,3,3,4, 12,18,12, 28,28, 42],          // LB CB CB RB | CM CM(b2b) CM | AM AM | ST
    "3-4-3":     [0, 3,4,3, 14,12,12,14, 34,40,34],          // CB CB CB | LM CM CM RM | LW ST RW
    "3-5-2":     [0, 3,4,3, 16,14,18,14,16, 38,40],          // CB CB CB | LWB CM CM(b2b) CM RWB | ST ST
    "3-4-1-2":   [0, 3,4,3, 16,12,12,16, 28, 38,40],         // CB CB CB | LWB CM CM RWB | AM | ST ST
    "5-3-2":     [0, 10,3,4,3,10, 18,16,18, 38,40],          // LWB CB CB CB RWB | CM CM(b2b) CM | ST ST
  };
  const fm = formation || "4-3-3";
  const sposArr = sposFor(fm);
  const atkGrad = FG[fm] || (()=>{ const d2=fm.split("-").map(Number); const g=[0]; let ii=1; for(let i=0;i<d2[0];i++){g.push(4);ii++;} for(let di=1;di<d2.length-1;di++){const isDeep=di===1&&d2.length>3;for(let i=0;i<d2[di];i++){g.push(isDeep?10:Math.round(12+26*((ii-d2[0]-1)/Math.max(1,10-d2[0]-d2[d2.length-1]-1))));ii++;}} for(let i=0;i<d2[d2.length-1];i++){const nf=d2[d2.length-1];g.push(nf===1?36:nf===2?(i===0?40:42):(i===nf-1?38:36));ii++;} return g; })();
  sq.push({ name: n[0] || "#1", pos: "GK", spos: "GK", atkW: 0 });
  let idx = 1;
  for (let i = 0; i < dg[0]; i++) { sq.push({ name: n[idx] || "#"+(idx+1), pos: "DEF", spos: sposArr[idx] || "CB", atkW: atkGrad[idx] || 4 }); idx++; }
  for (let d = 1; d < dg.length - 1; d++)
    for (let i = 0; i < dg[d]; i++) { sq.push({ name: n[idx] || "#"+(idx+1), pos: "MID", spos: sposArr[idx] || "CM", atkW: atkGrad[idx] || 20 }); idx++; }
  for (let i = 0; i < dg[dg.length - 1]; i++) { sq.push({ name: n[idx] || "#"+(idx+1), pos: "FWD", spos: sposArr[idx] || "ST", atkW: atkGrad[idx] || 48 }); idx++; }
  // Bench size follows the roster: 22 names = the 11-man international bench (avium.tsv),
  // anything else keeps the classic 5. An 11-man bench mirrors the starting XI slot for slot,
  // so every starter has a like-for-like understudy; the 5-man bench keeps its own generic shape.
  const benchN = benchSize === 11 || benchSize === 5 ? benchSize : (n.length > 16 ? 11 : 5);
  const benchPos = benchN === 11 ? sq.map(p => p.pos) : ["GK", "DEF", "MID", "MID", "FWD"];
  const benchSpos = benchN === 11 ? sq.map(p => p.spos) : ["GK", "CB", "CM", "CM", "ST"];
  const benchAtk = benchN === 11 ? sq.map(p => p.atkW) : [0, 8, 20, 25, 42];
  // A roster with gaps simply has a smaller bench. An unfilled slot is left out rather than filled
  // with a "#14" placeholder, because a placeholder is a selectable substitute rated at the team's
  // own skill — a nation listing 6 subs was getting 5 more for free. With no real names at all this
  // is a blank template (the national-team selector builds one), so the slots are kept.
  // benchSize records the DECLARED width so a short bench still knows it plays international rules,
  // and slot records where the name came from so callers can zip their own per-slot data back on.
  const named = n.some(v => v && !String(v).startsWith("#"));
  sq.forEach((p, i) => { p.slot = i; });
  for (let i = 0; i < benchN; i++) {
    const nm = n[11 + i];
    if (named && (!nm || String(nm).startsWith("#"))) continue;
    sq.push({ name: nm || "#"+(12+i), pos: benchPos[i], spos: benchSpos[i], bench: true, atkW: benchAtk[i], benchSize: benchN, slot: 11 + i });
  }
  sq.forEach(p => { const {name,ovr} = parseOvr(p.name); p.name = name; p.ovr = ovr; if (!p.natPos) p.natPos = p.spos; });
  return sq;
}

// ── Formation pitch geometry ───────────────────────────────────────────
// Slot positions as x/y percentages across the pitch, y=100 at your own goal line, attacking
// upward. Hand-placed per formation so the shape reads as that formation rather than as evenly
// spaced rows; anything not in the table falls back to the generated layout below.
export const FPOS2 = {
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
  // DEFENSIVE COUNTERPARTS. Not selectable and deliberately absent from FORMATIONS -- a side is
  // never set up in these, it DROPS into one when it loses the ball. A 3-4-3 defends as a 5-4-1 and
  // a 4-2-3-1 as a 4-4-1-1, so the shape the engine holds out of possession is the shape the
  // formation actually becomes rather than the one it attacks in.
  //
  // Authored rather than generated. pitchSlots' fallback lays out flat, evenly spaced rows: it puts
  // a back FIVE in one line 88 units wide at y=65, nine units higher up the pitch than an authored
  // back four sits, which is the opposite of what a back five is for. The stagger here is the one
  // every other entry above uses -- centre-backs narrow and deep, the men outside them wider and a
  // touch higher.
  "5-4-1":[[50,93],[9,68],[28,76],[50,78],[72,76],[91,68],[14,50],[37.3,48],[62.7,48],[86,50],[50,20]],
  "4-4-1-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[12,52],[37.3,54],[62.7,54],[88,52],[50,32],[50,14]],
};

export const pitchSlots = (formation) => FPOS2[formation] || (() => {
  const layers = (formation || "4-3-3").split("-").map(Number);
  const nR = layers.length + 1, yT = 12, yB = 92, rG = (yB - yT) / (nR - 1);
  const pts = [[50, yB]];
  // Keep adjacent dots at least 22 units apart so player-name labels never overlap.
  layers.forEach((c, li) => { const y = yB - (li + 1) * rG; const hs = c <= 1 ? 0 : Math.max(38, 11 * (c - 1)); const lo = 50 - hs; const gap = c <= 1 ? 0 : (2 * hs) / (c - 1); for (let j = 0; j < c; j++) pts.push([c === 1 ? 50 : lo + j * gap, y]); });
  return pts;
})();

// ─── DESIGN SCALE ────────────────────────────────────────────────────────────
// Before this the file carried 13 corner radii and 17 letter-spacings, so the same kind of
// control looked slightly different depending on which screen you were on. These are the
// allowed values; reach for a token rather than a new number.
export const R = { sm: 3, md: 6, lg: 10, pill: 999 };            // chips/inputs · buttons/rows · panels

export const meFreshOut = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0,
  // The engine fills these only if they are offered. Without them every "does this style pass more"
  // question was being answered with both teams' passes added together.
  passSide:{home:0,away:0}, passOkSide:{home:0,away:0},
  possX:{home:0,away:0}, passFwd:{home:0,away:0},
  // xG, WHICH THE ENGINE ONLY KEEPS IF ASKED. Both writes are guarded -- `if (out.xgS)` and
  // `if (out.shotDist)` -- so leaving these out did not zero the numbers, it stopped them being
  // recorded at all, silently. Every sweep run through runPositionalMatch was therefore
  // measuring goals, a Poisson count with a mean around 1.4 a side, when the engine was already
  // able to hand back the same question answered from eight or so continuous samples per match.
  // That is the difference between needing 300 fixtures to see an effect and needing 60.
  xg: 0, xgS:{home:0,away:0}, shotDist: new Array(10).fill(0),
  evt: null, feed: [], min: 0 });

// The XI, however the team happens to be defined: a real squad if it has one, otherwise eleven
// players synthesised at the team's own rating so an unfilled preset is still testable.
export const meSide = (t) => {
  const xi = (t?.squad || []).filter(p => !p.bench).slice(0, 11);
  const base = xi.length === 11 ? xi : buildSquad(t?.formation || "4-3-3", null).filter(p => !p.bench);
  return base.map((p, i) => ({ ...p, name: p.name || (p.pos + i), ovr: p.ovr ?? t?.skill ?? 70,
    stamina: 100, rating: 6.5, goals: 0, assists: 0, saves: 0, passOk: 0, defActs: 0, _att: null,
    // What the deepened rating is built out of. Zeroed here so a man who did none of it reads 0
    // rather than undefined, and so the app can show any of them without a guard.
    passFail: 0, duelWon: 0, duelLost: 0, dribbles: 0, beaten: 0, aerials: 0 }));
};

// Everyone who is not in the XI, in the same shape meSide gives the starters.
export const meBench = (t) => (t?.squad || []).filter(p => p.bench).slice(0, 12)
  .map((p, i) => ({ ...p, name: p.name || (p.pos + "B" + i), ovr: p.ovr ?? t?.skill ?? 70,
                    stamina: 100, rating: 6.5, goals: 0, assists: 0, saves: 0, chances: 0,
                    defActs: 0, _att: null, passOk: 0, passFail: 0, duelWon: 0, duelLost: 0,
                    dribbles: 0, beaten: 0, aerials: 0 }));

// A whole positional match, start to whistle, with no React anywhere near it. This is the shape the
// tournament will eventually call instead of simInstantMatch.
// homeAdv is optional and names the side playing at its own ground, or null for a neutral venue,
// which is what the balance harnesses want and therefore what they get by leaving it off.
export function runPositionalMatch(hT, aT, seed, homeAdv, injuriesOn) {
  const st = createMatchState();
  st.homeAdv = homeAdv || null;
  // Default on, like every other caller: the harnesses that leave it off want a normal match.
  st.injuriesOn = injuriesOn !== false;
  st.players.home = meSide(hT); st.players.away = meSide(aT);
  st.bench = { home: meBench(hT), away: meBench(aT) };
  st.subCap = { home: st.bench.home.length >= 11 ? 5 : 3, away: st.bench.away.length >= 11 ? 5 : 3 };
  st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
  st.strategy = { home: meStrategyFor(hT), away: meStrategyFor(aT) };
  st.styles = { home: hT.style || "balanced", away: aT.style || "balanced" };
  st.teamSkill = { home: hT.skill, away: aT.skill };
  st.possession = "home";
  const rng = new RNG(seed >>> 0 || 7);
  meInit(st, pitchSlots, rng);
  const out = meFreshOut();
  for (let t = 0; t < ME_MATCH_TICKS; t++) meTick(st, rng, out);
  meFinalise(st);
  return { s: st, out };
}

// THE TOURNAMENT'S ENGINE. Same signature as simInstantMatch and the same result shape, so the
// fixture-scoring call sites swap in place -- everything downstream (accumulateMatchStats, the
// suspension counters, the player-stat tables) keeps working untouched.
//
// Three things the abstract sim modelled that had to be rebuilt rather than ported:
//   MATCH URGENCY and TEAM FORM reach the pitch through meChase, which is the manager on the
//     touchline: what a fixture is worth and what sort of run a side is on both feed the intent it
//     reads the game with. In the abstract sim both were multipliers on effectiveness -- form was
//     two per cent, well under the noise floor, and urgency only ever moved a tactic label. Here
//     they move where the team stands and what it looks for, which is what they always meant.
//   HOME ADVANTAGE is territory, handled by ME_HOME_ADV in meInit. The abstract sim's `hE *= 1.03`
//     and the rating bump that first replaced it both said a crowd makes the players better, which
//     it does not; it pushes one side up the pitch and pins the other back. Passed through as
//     st.homeAdv and applied to the instructions, not to anybody's numbers.
export function simPositionalMatch(rng, homeSkill, awaySkill, forceResult, homeStyle, awayStyle, homeForm,
                            awayForm, homeAdv, homeStrat, awayStrat, homeSquad, awaySquad,
                            matchUrg, teamForm, injuriesOn) {
  const hT = { skill: homeSkill, style: homeStyle || "balanced", formation: homeForm || "4-3-3",
               strategy: homeStrat, squad: homeSquad };
  const aT = { skill: awaySkill, style: awayStyle || "balanced", formation: awayForm || "4-3-3",
               strategy: awayStrat, squad: awaySquad };
  const st = createMatchState();
  st.players.home = meSide(hT); st.players.away = meSide(aT);
  st.bench = { home: meBench(hT), away: meBench(aT) };
  st.subCap = { home: st.bench.home.length >= 11 ? 5 : 3, away: st.bench.away.length >= 11 ? 5 : 3 };
  st.formations = { home: hT.formation, away: aT.formation };
  st.strategy = { home: meStrategyFor(hT), away: meStrategyFor(aT) };
  st.styles = { home: hT.style, away: aT.style };
  st.teamSkill = { home: homeSkill, away: awaySkill };
  st.homeAdv = homeAdv || null;
  st.injuriesOn = injuriesOn !== false;
  if (matchUrg) st.matchUrg = matchUrg;
  if (teamForm) st.teamForm = teamForm;
  st.possession = "home";
  // RNG.next() returns a FLOAT in [0,1). `float >>> 0` is always 0, and `0 || 7` is 7 -- so every
  // jobbed sim played from seed 7 and a knockout tie produced the same score on every re-run.
  // Scale the float to a 31-bit int instead: the job's seed stream reaches the match again.
  const r = new RNG((Math.floor((rng?.next?.() ?? Math.random()) * 2 ** 31) >>> 0) || 7);
  meInit(st, pitchSlots, r);
  const out = meFreshOut();
  for (let t = 0; t < ME_MATCH_TICKS; t++) meTick(st, r, out);
  const ftH = out.goals.home, ftA = out.goals.away;
  let et = null, pen = null;
  // Extra time is a third of a match, the same proportion thirty minutes is of ninety, and then
  // kicks. meShootout drives itself to a conclusion in one call.
  if (forceResult && ftH === ftA) {
    for (let t = 0; t < Math.round(ME_MATCH_TICKS / 3); t++) meTick(st, r, out);
    if (out.goals.home !== ftH || out.goals.away !== ftA)
      et = { home: out.goals.home - ftH, away: out.goals.away - ftA };
    if (out.goals.home === out.goals.away) {
      const sh = meShootout(st, r, out, 40);
      if (sh) pen = { home: sh.home ?? 0, away: sh.away ?? 0 };
    }
  }
  meFinalise(st);
  const allP = (sd) => [...st.players[sd], ...((st.subbedOff && st.subbedOff[sd]) || [])];
  // A second yellow shows up in the engine as a red on a man already booked, so it is counted rather
  // than reported -- accumulateMatchStats needs it separately for the suspension rules.
  const cardsOf = (sd) => ({
    yellows: out.yellows?.[sd] || 0,
    reds: out.reds?.[sd] || 0,
    secondYellows: allP(sd).filter(p => p.rc && (p.yc || 0) >= 2).length,
    injuries: out.injuries?.[sd] || 0,
  });
  return { ftHome: ftH, ftAway: ftA, et, pen,
           cards: { home: cardsOf("home"), away: cardsOf("away") },
           playerData: { home: allP("home"), away: allP("away") } };
}

// THE ONE DOOR INTO THE ENGINE FROM ANOTHER THREAD. Everything a fixture needs arrives as plain
// data and a result goes back as plain data, so the same call works on this thread or on a worker
// and there is exactly one implementation of a football match in the project.
export function simJob(job) {
  const rng = new RNG(job.seed >>> 0 || 7), a = job.a;
  switch (job.kind) {
    case "twoLeg": return simTwoLegMatch(rng, ...a);
    case "leg1":   return simFirstLeg(rng, ...a);
    case "leg2":   return simSecondLeg(rng, ...a);
    default:       return simPositionalMatch(rng, ...a);
  }
}
