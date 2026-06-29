import { useState, useCallback, useRef, useEffect } from "react";

// ═══ RNG ═════════════════════════════════════════════════════════════════════
class RNG {
  constructor(seed) { this.s = seed || Date.now(); }
  next() { this.s = (this.s * 1664525 + 1013904223) & 0xffffffff; return (this.s >>> 0) / 0xffffffff; }
  u() { return this.next(); }
}
const pick = (rng, a) => a[Math.floor(rng.u() * a.length)];
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? k);
const TIER_CONV = [1.0, 1.08, 1.18];
const TIER_ATK_W = [1.0, 1.25, 1.6];
const TIER_GK_SAVE = [0, 0.035, 0.07];
const TIER_DEF_SHOT = [0, 0.02, 0.04];
const TIER_PEN = [0, 0.05, 0.12];
const TIER_MID_CTRL = [0, 0.015, 0.03];

// ═══ LIVE MATCH ENGINE ═══════════════════════════════════════════════════════
const C = {
  goal:["{t}'s {n} fires into the net!","{n} scores for {t}! Clinical.","{t}'s {n} slots it past the keeper!","What a strike from {t}'s {n}!","{n} buries it! {t} have scored!","Cool as you like from {t}'s {n}!","{n} finishes from close range!","Composure from {t}'s {n}. Slotted home.","{t}'s {n} finds the bottom corner!","Buried! {n} gives {t} a goal!","Tucked away by {t}'s {n}. Keeper no chance.","That's in! {n} for {t}!","{n} strikes for {t}! Low into the corner.","Clinical finish from {t}'s {n}. Never in doubt.","{t}'s {n} smashes it home!","Placed into the far corner by {t}'s {n}!","Side-footed past the keeper. {n} for {t}!","{n} drills it low and hard. {t} score!","Sweetly struck by {t}'s {n}!","Rifled in by {t}'s {n}! No stopping that.","Instinctive finish from {t}'s {n}!","{t}'s {n} pokes it home from six yards!","Lashed into the roof of the net! {n} for {t}!","{n} ghosts in unmarked and finishes for {t}!","{t}'s {n} chips the keeper! Audacious!","Emphatic from {t}'s {n}. Hammered in.","{t}'s {n} squeezes it inside the near post!","Guided into the corner by {t}'s {n}!","Tidy finish. {t}'s {n} picks the spot.","Wrong-footed the keeper! {t}'s {n} scores!"],
  goal_opener:[" Deadlock broken!"," That opens the scoring!"," First blood!"," First goal of the game!"," And it's the breakthrough!"," The wait is over!"],
  goal_equalizer:[" It's level!"," The equalizer!"," Pegged back!"," Back on level terms!"," All square now!"," Drawn level!"],
  goal_lead:[" {t} take the lead!"," Advantage {t}!"," {t} ahead now!"," {t} go in front!"],
  goal_pullback:[" {t} pull one back!"," Game on!"," {t} are back in this!"," Lifeline for {t}!"," {t} give themselves hope!"],
  goal_consolation:[" Consolation for {t}."," {t} get one back, but still trailing."," Too little too late for {t}."," Small comfort for {t}."],
  goal_extend:[" The lead grows!"," {t} pulling away!"," Breathing room for {t}."," {t} extend their advantage!"," {t} are running riot!"," Comfortable now for {t}."],
  goal_late:[" Late drama!"," What a time to score!"," In the dying minutes!"," Drama at the death!"," Against the run of play in stoppage time!"," Scenes at the death!"],
  save:["Shot on target! {o}'s keeper denies {t}'s {n}.","Good stop from {t}'s {n}'s effort.","Fingertip save! {t}'s {n} thought that was in.","{t}'s {n} forces a save. {o} keeper holds.","Smart save! {o}'s keeper reads {t}'s {n} well.","Comfortable save from {t}'s {n}'s shot.","Strong hands from {o}'s keeper. {t}'s {n} denied.","Straight at the keeper. {t}'s {n} should have done better.","Low save! {o}'s keeper gets down well.","Diving save from {t}'s {n}'s header!","Parried away! {o}'s keeper pushes {t}'s {n}'s shot clear.","Solid save at the near post from {t}'s {n}'s effort.","Full stretch! {o}'s keeper just gets a glove to it.","Point-blank save! {t}'s {n} denied at close range.","Reflex save! {o}'s keeper somehow keeps it out.","Blocked by the keeper's legs! {t}'s {n} can't convert.","Caught cleanly by {o}'s keeper. {t}'s {n} didn't trouble him.","Pushed wide! {o}'s keeper at full stretch from {t}'s {n}.","Acrobatic stop! {o}'s keeper tips {t}'s {n}'s effort over.","Routine save. {t}'s {n} hits it too centrally."],
  miss:["{t}'s {n} shoots wide.","{t}'s {n} fires over the bar.","{n} drags it wide. Off target.","Blazed over by {t}'s {n}.","{t}'s {n} pulls it across the face of goal. Wide.","{n} snatches at it. Over for {t}.","Skied! {t}'s {n} puts it into the stands.","Wide of the mark from {t}'s {n}.","{t}'s {n} leans back and lifts it over.","Miscued! {t}'s {n} gets it all wrong.","Scuffed shot from {t}'s {n}. Easy for the keeper.","Rushed it. {t}'s {n} needed to take a touch.","Shanked wide by {t}'s {n}!","Way off target. {t}'s {n} slices it horribly.","{t}'s {n} curls it over from a good position.","Had time but couldn't find the target. {t}'s {n} wasteful.","Wild effort from {t}'s {n}. Into row Z.","{t}'s {n} swings and misses the ball completely!","{t}'s {n} catches it on the shin. Harmless.","{t}'s {n} hits the side netting. Close but no cigar."],
  foul:["Foul by {t}'s {n}. Free kick {o}.","{t}'s {n} goes through the back of the man. Free kick.","{t}'s {n} clips the ankle. Referee blows.","{t}'s {n} catches {o}'s player late. Free kick.","{t}'s {n} pulls back the shirt. Given.","{t}'s {n} bundles into the challenge. Foul.","Clumsy from {t}'s {n}. Free kick {o}.","Body check from {t}'s {n}. Referee intervenes.","Slide tackle from {t}'s {n}. Caught the man.","Wrestled to the ground. {t}'s {n} gives away the foul.","{t}'s {n} barges into the back. Foul given.","Trip by {t}'s {n}. Too eager.","Cynical foul from {t}'s {n}. Stops the break.","{t}'s {n} uses an arm across the chest. Free kick.","{t}'s {n} stands on the ankle. Accidental but still a foul.","Shove from {t}'s {n}. Easy decision for the referee."],
  yellow:["Yellow card. {t}'s {n} into the book.","Booking for {t}'s {n}. Reckless.","Card shown to {t}'s {n}. Cynical challenge.","That's a yellow for {t}'s {n}. Can't argue with that.","{t}'s {n} picks up a booking. Needless.","In the book. {t}'s {n} will need to be careful now.","{t}'s {n} booked for persistent fouling.","Yellow card. {t}'s {n} knew exactly what he was doing.","{t}'s {n} carded for simulation. Referee not fooled.","{t}'s {n} picks up a caution. Walking a tightrope now."],
  second_yellow:["Second yellow! {t}'s {n} is OFF! Down to {c}!","Two yellows make a red! {t}'s {n} off! Down to {c}.","That's two bookings! {t}'s {n} has to go. {c} men remain.","Off for a second booking! {t}'s {n} leaves {t} with {c}.","Can't believe it! {t}'s {n} picks up a second yellow. {c} men."],
  straight_red:["Straight red! {t}'s {n} sent off! Down to {c}.","RED CARD! {t}'s {n} dismissed! Down to {c}!","Off! {t}'s {n} sees a straight red. {c} men.","Violent conduct! {t}'s {n} given a straight red. Down to {c}.","Serious foul play! {t}'s {n} walks. {c} men for {t}.","Awful challenge! {t}'s {n} gets a straight red. Down to {c}."],
  pen_scored:["SCORED! {t}'s {n} sends the keeper the wrong way!","Converted! {t}'s {n} rolls it home!","No mistake from {t}'s {n}!","Coolly dispatched by {t}'s {n}!","Into the corner! {t}'s {n} makes no mistake!","Ice cold! {t}'s {n} buries it!","Smashed down the middle! {t}'s {n} converts!","Stuttered run, keeper dives early. {t}'s {n} rolls it in."],
  pen_saved:["SAVED! The keeper guesses right against {t}'s {n}!","SAVED! The keeper gets a hand to {n}'s penalty!","Penalty saved! {t}'s {n} can't beat the keeper!","Read it perfectly! The keeper dives low to deny {t}'s {n}!","Kept out! {t}'s {n} goes left, so does the keeper!"],
  pen_missed:["Over the bar! {t}'s {n} blazes it high!","Wide! {t}'s {n} drags the penalty off target!","Off the post! {t}'s {n} can't believe it!","Skied! The pressure got to {t}'s {n}.","Slipped on the run-up! {t}'s {n} balloons it over!","Weak penalty from {t}'s {n}. Barely troubled the corner."],
  offside:["Offside against {t}. {n} mistimed the run.","Flag up. {t}'s {n} caught offside.","Offside. {t}'s {n} went too early.","Linesman's flag. {t}'s {n} just beyond the last man.","Run well-timed? No. {t}'s {n} is offside.","{t}'s {n} strays offside. Good work from the defensive line.","Offside trap works. {t}'s {n} caught out.","Marginal call. {t}'s {n} flagged offside."],
  corner_goal:["{t}'s {n} heads it in from the corner! GOAL!","Towering header from {t}'s {n}! GOAL!","Planted in by {t}'s {n} from the set piece!","Up rises {t}'s {n}! Headed home from the corner!","Bullet header from {t}'s {n}! The delivery was perfect!","Flicked in at the near post! {t}'s {n} from the corner!","Back-post header! {t}'s {n} rises highest!","Volleyed in from the corner! {t}'s {n} with a sweet strike!"],
  corner_save:["Header from {t}'s {n} — keeper saves!","Good delivery, but {o}'s keeper holds from {n}!","Strong header from {n} — saved!","{t}'s {n} gets up well but the keeper tips it over!","Firm header from {t}'s {n}. Straight at the keeper.","Diving header from {t}'s {n}! Keeper pushes it wide!"],
  corner_miss:["Header from {t}'s {n} — over the bar!","{t}'s {n} can't keep the header down!","Free header for {n} — off target!","{t}'s {n} gets a head to it but can't direct it.","Glanced wide by {t}'s {n}. Needed to hit the target.","Completely miscued by {t}'s {n}. Should have scored.","{t}'s {n} rises but heads it into the ground. Bounces wide.","Headed wide from six yards! {t}'s {n} won't want to see that again."],
  corner_retain:["Corner half-cleared. Still {t}'s ball.","Loose clearance, {t} recycle it.","Headed out, but only as far as {t}.","Partially cleared. {t} keep the pressure on.","Punched out by the keeper but {t} gather.","Cleared to the edge of the box. {t} reload."],
  corner_clear:["{o} clear their lines.","{o} deal with the corner.","Headed away by {o}.","{o} punch it clear. Danger averted.","Strong defending from {o}. Corner dealt with.","Commanding from {o}'s keeper. Claimed easily.","{o} get a decisive head on it. Cleared."],
  free_kick:["Free kick {t}. Into the wall.","{t}'s {n} over the free kick. Curls it wide.","{t}'s {n} takes the free kick. Blocked.","{t}'s {n} strikes the free kick. Just over.","Worked short by {t}. Move breaks down.","{t}'s {n} whips it in. Headed clear by {o}.","{t}'s {n} floats the free kick in. {o} deal with it.","Direct free kick from {t}'s {n}. Dipping but over."],
  woodwork:["{t}'s {n} hits the post!","Off the bar! {t}'s {n} so close.","Rattles the crossbar! {t}'s {n} can't believe it.","The frame of the goal denies {t}'s {n}!","Against the post from {t}'s {n}! Agonizing.","{t}'s {n} crashes it against the woodwork!","Off the inside of the post! {t}'s {n} nearly had it.","Cracks the bar! {t}'s {n} had the keeper beaten.","Thumps the upright! {t}'s {n} inches away.","Thunderbolt against the crossbar from {t}'s {n}!"],
  own_goal:["Own goal! {o}'s {n} turns it into his own net!","Calamitous from {o}'s {n}! Into his own goal!","Disaster for {o}'s {n}! Puts it past his own keeper!","It's an own goal! {n} can only watch as it goes in off him.","Unlucky! {o}'s {n} deflects it past his own goalkeeper.","Sliced into his own net by {o}'s {n}!","Horror show! {o}'s {n} heads it past his own keeper!"],
  gk_error:["Goalkeeper error! {n} pounces for {t}!","Howler from the keeper! {t}'s {n} can't believe his luck!","Fumble! The keeper spills it and {t}'s {n} taps it in!","Gift for {t}! Keeper misjudges and {n} finishes into an empty net.","The keeper makes a hash of it! {t}'s {n} rolls it into the empty goal.","Terrible backpass! {t}'s {n} nips in and scores!","Goalkeeper caught off his line! {t}'s {n} lobs it home!"],
  deflection:["Deflection! Wrong-foots the keeper and it's in!","Wicked deflection and {t}'s {n} gets the goal!","It took a nick off a defender! Nothing the keeper could do.","Deflected past the keeper! {t}'s {n} won't care how it went in.","It's in off a defender! {t}'s {n} claims it.","Big deflection takes it past the keeper! {t} score!","Ricochets off two defenders and in! {t}'s {n} gets the credit."],
  woodwork_save:["Tipped onto the post by {o}'s keeper!","Great save pushed onto the bar!","Fingertips! Onto the woodwork and away!","Incredible save onto the frame of the goal!","Pushed onto the post! Brilliant from {o}'s keeper!"],
  neutral:["{t} passing it around the back. Patient.","Cagey spell. Neither side committing.","{t} probe down the flank. Cross cleared.","Midfield tussle. Scrapping for every ball.","{o} press high. {t} play through it.","{t} in {o}'s half. Looking for openings.","Half chance. {t}'s {n} lays it off, move breaks down.","Long ball from {o}. Headed away.","End-to-end briefly. Ball bouncing in midfield.","{t} building from the back. Methodical.","{t} trying to find a way through. {o} compact.","Sideways from {t}. No route forward yet.","Ball out for a throw-in. {t} regroup.","Scrappy period. Neither team finding a rhythm.","{o} soak up pressure. Organized.","{t}'s {n} tries a through ball. Cut out.","Lots of bodies behind the ball from {o}.","Quiet spell. {t} keeping the ball without threatening.","Ball pinballing in midfield. No one in control.","{o} dropping deep. Inviting {t} onto them.","{t} switching the play from side to side.","Tactical foul from {o}. {t} momentum broken.","Nothing doing. {t} probing but {o} have numbers back.","Drinks break. Both managers issuing instructions.","Bit of handbags in midfield. Referee calms it down."],
};

// ═══ ZONE COMMENTARY ═════════════════════════════════════════════════════════
const CZ = {
  buildup:["{t}'s {n} drives forward into {o}'s half.","{t} working it wide. {t}'s {n} looks up.","{t} probing through the middle. {n} involved.","{t}'s {n} carries it forward. Space ahead.","Ball switched by {t}. {n} picks it up wide.","{t} patient. {t}'s {n} picks the pass.","Good move from {t}. {n} advances.","{n} plays a one-two and breaks into {o}'s half.","{t}'s {n} finds space between the lines.","{t} building nicely. {n} receives and turns.","Neat combination play from {t}. {n} carrying it forward.","{t}'s {n} clips it over the top. {t} advancing.","{t}'s {n} plays a diagonal into space. {t} progressing.","Quick passing from {t}. {n} picks it up on the half turn.","{t}'s {n} beats the first man and drives on.","{t} overloading the right side. {n} involved.","{t}'s {n} drops deep to collect, spins, and plays it forward.","Sharp pass from {t}'s {n}. {t} through the first line of pressure.","Lovely touch from {t}'s {n}. {t} advancing with purpose now.","Crossfield ball from {t}'s {n}. Play shifted to the other flank."],
  neutral:["{t} controlling the tempo.","Midfield contest. {o} pressing.","Cagey. Neither side committing.","Throw-in {t}. Worked short.","Loose ball in midfield. Scrappy.","Ball bobbling in midfield. {t}'s {n} recycles.","{t} knocking it around. No urgency.","Both sides happy to keep possession.","{t}'s {n} sprays it wide. Pace slows.","{o} win it back. Sideways. {t} press to recover.","Brief spell of {t} possession. Nothing doing.","Stop-start in the middle third.","Stalemate in the middle of the park.","{t} trying to find the tempo. {o} denying them space.","{t}'s {n} holds it up. Looking for support.","Neither side able to establish a foothold.","{o} content to sit and wait. {t} circulating.","{t}'s {n} plays it backwards. Lacking ideas.","{t} with the ball but no penetration.","Physical battle in the middle. No quarter given."],
  enter_box:["{t}'s {n} feeds it into the area!","Dangerous position. {t}'s {n} inside the box!","{t} work it through! {n} in behind!","{n} picks it up in a dangerous area for {t}!","{t}'s {n} cuts inside and gets a shot away!","Lovely pass and {t}'s {n} is through on goal!","{t}'s {n} drives into the penalty area!","Chance! {t}'s {n} is in space in the box!","Threaded through! {t}'s {n} latches onto it!","One on one! {t}'s {n} bearing down on goal!","{t}'s {n} peels off the back. Ball played in!","In behind! {t}'s {n} is clean through!"],
  pressure:["Still {t}. Relentless pressure.","{o} under the cosh. {t} keep coming.","{t} camped in {o}'s box. Sustained pressure.","{o} pinned back. {t} won't let up.","{t} keep recycling. {o} can't get out.","Wave after wave from {t}. {o} hanging on.","{t} suffocating {o}. Backs to the wall.","{o} haven't touched the ball in minutes. {t} dominant.","{t} laying siege. It feels like a matter of time.","Bombardment from {t}. {o}'s defense under enormous pressure."],
  counter:["COUNTER! {t} catch {o} high up the pitch! {n} leads the break!","{t} break at pace! {n} drives forward!","Long ball over the top! {t}'s {n} is through!","Turnover! {t}'s {n} sprints into space!","{t} hit {o} on the break! {n} racing clear!","Quick transition from {t}! {n} has numbers forward!","Intercepted! {t}'s {n} launches the counter!","{o} caught out! {t}'s {n} breaks with pace!","{t} spring the trap! {n} galloping upfield!","Three on two! {t}'s {n} carrying it on the counter!","{o} overcommitted! {t}'s {n} exploits the space!","Released in behind! {t}'s {n} with acres of space!"],
  sustain:["{t} working it around the edge of the box.","{t} keep probing. {o} holding firm.","{t}'s {n} looks for an opening. Recycled.","Patient from {t}. Waiting for the gap.","{t}'s {n} tries to thread it through. Blocked.","{t} moving it side to side. {o} staying compact.","{t}'s {n} shifts it onto the other foot. Blocked.","{o} standing firm. {t} can't find a way through.","{t} patient in possession. Looking for the killer ball.","{t}'s {n} drops a shoulder. Defender stays with him.","Good defending from {o}. {t} recycling possession.","{t} trying to create something from nothing. {o} resolute."],
};

const lmEffSkill = (base, reds, minute) => { let s = base * Math.pow(0.85, reds); if (minute > 90) s *= Math.max(0.88, 1 - 0.004 * (minute - 90)); return s; };
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
function autoTac(rng, diff, rem, urgency, style, current) {
  const r = Math.max(0, rem - (urgency||0));
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
  // Resignation
  if (diff<=-3&&rem<=12&&rng.u()<0.35) t=-0.3;
  if (diff<=-4&&rem<=20&&rng.u()<0.4) t=-0.5;
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
const STYLE_CLR = {balanced:"#666",gegenpress:"#ebcb8b",tikitaka:"#d4a0c0",counterattack:"#7dc9c9",wingplay:"#a3be8c",parkthebus:"#8b6e4e"};
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
const FORM_CLR={"4-2-4":"#d08770","3-4-3":"#d08770","4-1-2-1-2":"#d08770","4-3-3":"#666","4-4-2":"#666","4-2-3-1":"#666","3-5-2":"#666","3-4-1-2":"#666","4-1-4-1":"#4a7fd4","4-3-2-1":"#4a7fd4","5-3-2":"#4a7fd4"};
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
function lmGoalContext(s, rng, atk, nm) {
  const atkI = atk === "home" ? 0 : 1, tot = s.score[0] + s.score[1], diff = s.score[atkI] - s.score[1 - atkI];
  let ctx = "";
  if (tot === 1) ctx = pick(rng, C.goal_opener); else if (diff === 0) ctx = fill(pick(rng, C.goal_equalizer), {t: nm[atk]}); else if (diff === 1) ctx = fill(pick(rng, C.goal_lead), {t: nm[atk]}); else if (diff > 1) ctx = fill(pick(rng, C.goal_extend), {t: nm[atk]}); else if (diff === -1) ctx = fill(pick(rng, C.goal_pullback), {t: nm[atk]}); else ctx = fill(pick(rng, C.goal_consolation), {t: nm[atk]});
  if (s.minute >= 85 || s.phase.includes("stoppage")) ctx += pick(rng, C.goal_late);
  return ctx;
}
function lmResolveCorner(s, rng, dm, atk, def, atkE, defE, nm) {
  const sm = Math.pow(atkE / defE, 0.3);
  const r = rng.u();
  const cornerPl = s.players[atk].filter(p => p.pos !== "GK"); const scorer = pickPlayer(rng, cornerPl.length > 0 ? cornerPl : s.players[atk], "corner");
  const cGoalP = 0.04 * sm * TIER_CONV[scorer.tier || 0];
  const cGk = s.players[def].find(p => p.pos === "GK");
  const cGkBonus = TIER_GK_SAVE[cGk?.tier || 0];
  if(s.xG) s.xG[atk] = (s.xG[atk]||0) + cGoalP;
  if (r < cGoalP) {
    s.score[atk === "home" ? 0 : 1]++; s.stats[atk].shots++; s.stats[atk].onTarget++; if(s.goalscorers)s.goalscorers[atk].push({name:scorer.name,min:dm,method:"header"});
    scorer.goals++;{const ti=atk==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;scorer.rating=Math.min(10,+(scorer.rating+goalAtkMult(scorer.atkW)*gCtx).toFixed(2));const a=assistPlayer(rng,s.players[atk],scorer.name,0);if(a)a.rating=Math.max(1,Math.min(10,+(a.rating+0.5*assistAtkMult(a.atkW)*aCtx).toFixed(2)));}
    s.events.push({min:dm, type:"goal", team:atk, text:"\u26BD " + fill(pick(rng,C.corner_goal),{t:nm[atk],o:nm[def],n:scorer.name}) + lmGoalContext(s,rng,atk,nm)});
    s.ball = 2; s.pressure = 0; s.possession = def; s.stoppageBank += 45; s.momentum[atk] = 4;
  } else if (r < (0.10 + cGkBonus) * sm) {
    s.stats[atk].shots++; s.stats[atk].onTarget++;
    s.events.push({min:dm, type:"save", team:atk, text:"\uD83E\uDDE4 " + fill(pick(rng,C.corner_save),{t:nm[atk],o:nm[def],n:scorer.name})});
    if (rng.u() < 0.25) {
      s.stats[atk].corners++;
      s.events.push({min:dm, type:"corner", team:atk, text:"\uD83C\uDFF4 Another corner " + nm[atk] + "."});
      lmResolveCorner(s, rng, dm, atk, def, atkE, defE, nm);
    } else { s.possession = def; s.ball = 2; s.pressure = 0; }
  } else if (r < 0.18) {
    // Miss — 12% chance of hitting the bar
    s.stats[atk].shots++;
    if (rng.u() < 0.12) {
      s.stats[atk].woodwork=(s.stats[atk].woodwork||0)+1;
      s.events.push({min:dm, type:"woodwork", team:atk, text:"\uD83E\uDEA8 Header off the bar! "+nm[atk]+"'s "+scorer.name+" can't believe it."});
    } else {
      s.events.push({min:dm, type:"miss", team:atk, text:"\uD83D\uDCA8 " + fill(pick(rng,C.corner_miss),{t:nm[atk],o:nm[def],n:scorer.name})});
    }
    s.possession = def; s.ball = 2; s.pressure = 0;
  } else if (r < 0.43) {
    s.events.push({min:dm, type:"neutral", text:fill(pick(rng,C.corner_retain),{t:nm[atk],o:nm[def]})});
    s.ball = atk === "home" ? 3 : 1; s.pressure = Math.min(s.pressure + 1, 4);
  } else {
    // Clear — 2% chance of own goal
    if (rng.u() < 0.02) {
      const defPlayers = s.players[def].filter(p => p.pos === "DEF");
      const ogPlayer = defPlayers.length > 0 ? defPlayers[Math.floor(rng.u()*defPlayers.length)] : s.players[def].find(p=>p.pos!=="GK");
      if (ogPlayer) {
        s.score[atk === "home" ? 0 : 1]++;
        if(s.goalscorers)s.goalscorers[atk].push({name:ogPlayer.name,min:dm,method:"og",ogTeam:nm[def]});
        ogPlayer.rating=Math.max(1,+(ogPlayer.rating-0.6).toFixed(1));
        s.events.push({min:dm, type:"goal", team:atk, text:"\u26BD " + fill(pick(rng,C.own_goal),{t:nm[atk],o:nm[def],n:ogPlayer.name}) + lmGoalContext(s,rng,atk,nm)});
        s.ball = 2; s.pressure = 0; s.possession = def; s.stoppageBank += 45; s.momentum[atk] = 3;
      } else {
        s.events.push({min:dm, type:"clearance", text:fill(pick(rng,C.corner_clear),{t:nm[atk],o:nm[def]})});
        s.possession = def; s.ball = 2; s.pressure = 0;
      }
    } else {
      s.events.push({min:dm, type:"clearance", text:fill(pick(rng,C.corner_clear),{t:nm[atk],o:nm[def]})});
      s.possession = def; s.ball = 2; s.pressure = 0;
    }
  }
}
function lmResolveShot(s, rng, dm, atk, def, atkE, defE, nm, method) {
  const shooter = pickPlayer(rng, s.players[atk].filter(p=>p.pos!=="GK"), "goal");
  s.stats[atk].shots++;
  const goalP = (0.13+(s.modifiers?s.modifiers[atk]:applyStrategy(mergeModifiers(STYLE_MOD[s.styles?.[atk]]||STYLE_MOD.balanced, FORM_MOD[s.formations?.[atk]]), s.strategy?.[atk])).goalP) * Math.pow(atkE/defE, 0.5) * TIER_CONV[shooter.tier || 0];
  const sGk = s.players[def].find(p => p.pos === "GK");
  const saveP = 0.16+0.16*defE/(atkE+defE) + TIER_GK_SAVE[sGk?.tier || 0];
  if(s.xG) s.xG[atk] = (s.xG[atk]||0) + goalP;
  const roll = rng.u();
  if (roll < goalP) {
    // Goal — check for deflection (8%)
    const isDeflection = rng.u() < 0.08;
    const finalMethod = isDeflection ? "deflection" : (method||null);
    s.score[atk==="home"?0:1]++; s.stats[atk].onTarget++; if(s.goalscorers)s.goalscorers[atk].push({name:shooter.name,min:dm,method:finalMethod});
    shooter.goals++;{const ti=atk==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;shooter.rating=Math.min(10,+(shooter.rating+goalAtkMult(shooter.atkW)*gCtx).toFixed(2));const ast=assistPlayer(rng,s.players[atk],shooter.name,0);if(ast)ast.rating=Math.max(1,Math.min(10,+(ast.rating+0.5*assistAtkMult(ast.atkW)*aCtx).toFixed(2)));}
    s.players[def].forEach(p=>{if(p.pos==="GK")p.rating=Math.max(1,+(p.rating-0.12).toFixed(2));else if(p.pos==="DEF")p.rating=Math.max(1,+(p.rating-0.04).toFixed(2));});
    let txt;
    if (isDeflection) { txt = fill(pick(rng,C.deflection),{t:nm[atk],o:nm[def],n:shooter.name}); }
    else { txt = fill(pick(rng,C.goal),{t:nm[atk],o:nm[def],n:shooter.name}); }
    txt += lmGoalContext(s, rng, atk, nm);
    s.events.push({min:dm,type:"goal",team:atk,text:"\u26BD "+txt});
    s.ball=2;s.pressure=0;s.possession=def;s.stoppageBank+=45;s.momentum[atk]=4;
  } else if (roll < goalP+saveP) {
    // Save — check for GK error (3%) or tipped onto woodwork (8%)
    const gkErrRoll = rng.u();
    if (gkErrRoll < 0.012) {
      // GK error → goal
      s.score[atk==="home"?0:1]++; s.stats[atk].onTarget++; if(s.goalscorers)s.goalscorers[atk].push({name:shooter.name,min:dm,method:"gk-error"});
      shooter.goals++;{const ti=atk==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;shooter.rating=Math.min(10,+(shooter.rating+goalAtkMult(shooter.atkW)*gCtx).toFixed(2));const a=assistPlayer(rng,s.players[atk],shooter.name,0);if(a)a.rating=Math.max(1,Math.min(10,+(a.rating+0.5*assistAtkMult(a.atkW)*aCtx).toFixed(2)));}
      const gk=s.players[def].find(p=>p.pos==="GK");if(gk)gk.rating=Math.max(1,+(gk.rating-0.8).toFixed(1));
      s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.max(1,+(p.rating-0.08).toFixed(1));});
      let txt = fill(pick(rng,C.gk_error),{t:nm[atk],o:nm[def],n:shooter.name});
      txt += lmGoalContext(s, rng, atk, nm);
      s.events.push({min:dm,type:"goal",team:atk,text:"\u26BD "+txt});
      s.ball=2;s.pressure=0;s.possession=def;s.stoppageBank+=45;s.momentum[atk]=4;
    } else if (gkErrRoll < 0.09) {
      // Tipped onto woodwork
      s.stats[atk].onTarget++;s.stats[atk].woodwork=(s.stats[atk].woodwork||0)+1;
      ratePlayer(s.players[atk],shooter.name,0.15);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.03).toFixed(2));});
      s.events.push({min:dm,type:"woodwork",team:atk,text:"\uD83E\uDEA8 "+fill(pick(rng,C.woodwork_save),{t:nm[atk],o:nm[def],n:shooter.name})});
      if(rng.u()<0.50){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 Off the woodwork for a corner."});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
      else{s.possession=def;s.ball=2;s.pressure=0;}
    } else {
      // Normal save
      s.stats[atk].onTarget++;{const gk=s.players[def].find(p=>p.pos==="GK");if(gk)gk.rating=Math.min(10,+(gk.rating+0.2).toFixed(2));ratePlayer(s.players[atk],shooter.name,0.15);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.03).toFixed(2));});}
      s.events.push({min:dm,type:"save",team:atk,text:"\uD83E\uDDE4 "+fill(pick(rng,C.save),{t:nm[atk],o:nm[def],n:shooter.name})});
      if(rng.u()<0.45){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 Corner "+nm[atk]+"."});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
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
      ratePlayer(s.players[atk],shooter.name,0.1);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.02).toFixed(2));});
      s.events.push({min:dm,type:"woodwork",team:atk,text:"\uD83E\uDEA8 "+fill(pick(rng,C.woodwork),{t:nm[atk],o:nm[def],n:shooter.name})});
      if(rng.u()<0.40){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 Rebounds off the woodwork for a corner."});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
      else{s.possession=def;s.ball=2;s.pressure=0;}
    } else {
      ratePlayer(s.players[atk],shooter.name,-0.05);s.players[def].forEach(p=>{if(p.pos==="DEF")p.rating=Math.min(10,+(p.rating+0.02).toFixed(2));});s.events.push({min:dm,type:"miss",team:atk,text:"\uD83D\uDCA8 "+fill(pick(rng,C.miss),{t:nm[atk],o:nm[def],n:shooter.name})});
      if(rng.u()<0.30){s.stats[atk].corners++;s.events.push({min:dm,type:"corner",team:atk,text:"\uD83C\uDFF4 Behind for a corner! "+nm[atk]+"."});lmResolveCorner(s,rng,dm,atk,def,atkE,defE,nm);}
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
    s.stats[team].reds++; {const rp=s.players[team].find(p=>p.name===fn);if(rp){rp.rc=true;ratePlayer(s.players[team],fn,-2.0);s.subbedOff[team].push({...rp});}} s.players[team] = s.players[team].filter(p => p.name !== fn);
    s.events.push({min:dm,type:"red",team,text:"\uD83D\uDFE5 "+fill(pick(rng,C.straight_red),{t:nm[team],n:fn,c:s.players[team].length})});
    s.stoppageBank+=60;
  } else if (s.booked[team].includes(fn)) {
    s.stats[team].yellows++; s.stats[team].reds++; s.stats[team].secondYellows=(s.stats[team].secondYellows||0)+1; {const rp=s.players[team].find(p=>p.name===fn);if(rp){rp.rc=true;ratePlayer(s.players[team],fn,-2.0);s.subbedOff[team].push({...rp});}} s.players[team] = s.players[team].filter(p => p.name !== fn);
    s.events.push({min:dm,type:"red",team,text:"\uD83D\uDFE5 "+fill(pick(rng,C.second_yellow),{t:nm[team],n:fn,c:s.players[team].length})});
    s.stoppageBank+=60;
  } else {
    s.stats[team].yellows++; s.booked[team].push(fn); ratePlayer(s.players[team],fn,-0.3); {const yp=s.players[team].find(p=>p.name===fn);if(yp)yp.yc++;}
    s.events.push({min:dm,type:"yellow",team,text:"\uD83D\uDFE8 Yellow. "+nm[team]+"'s "+fn+"."});
    s.stoppageBank+=30;
  }
}

// ═══ ZONE-BASED MINUTE SIMULATION ═══════════════════════════════════════════
function staminaMod(stam) { return 1 - Math.pow((100 - Math.max(0, stam)) / 100, 1.5) * 0.25; }
function lmSimMinute(s, rng, home, away) {
  const dm = lmDisplayMin(s.phase,s.minute,s.stoppageElapsed);
  let hE = lmEffSkill(home.skill,s.stats.home.reds,s.minute) * (1 + s.momentum.home * 0.02) * staminaMod(s.stamina.home), aE = lmEffSkill(away.skill,s.stats.away.reds,s.minute) * (1 + s.momentum.away * 0.02) * staminaMod(s.stamina.away);
  if (s.homeAdv === "home") hE *= 1.03; else if (s.homeAdv === "away") aE *= 1.03;
  if(s.momentum.home > 0) s.momentum.home--;
  if(s.momentum.away > 0) s.momentum.away--;
  const nm = {home:home.name,away:away.name};

  // Tactics (with style constraints)
  const diff=(s.score[0]+(s.startScore?.[0]||0))-(s.score[1]+(s.startScore?.[1]||0)), rem=s.minute<=90?90-s.minute:120-s.minute;
  const sDef=(s.startScore?.[0]||0)-(s.startScore?.[1]||0);
  const pH=s.tactics.home, pA=s.tactics.away;
  if(s.allowTacChange?.home!==false){s.tactics.home=clampTac(autoTac(rng,diff,rem,sDef<0?Math.abs(sDef)*20:0,s.styles.home,s.tactics.home),s.styles.home);}
  if(s.allowTacChange?.away!==false){s.tactics.away=clampTac(autoTac(rng,-diff,rem,sDef>0?sDef*20:0,s.styles.away,s.tactics.away),s.styles.away);}
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
        s.events.push({min:dm, type:"neutral", text:pick(rng, [nm[po]+" taking their time over the restart.", nm[po]+" in no hurry.", "Ball boy taking his time. "+nm[po]+" happy to wait."])});
        if (poSt.timeWasting === 2 && rng.u() < 0.025) { const waster = pickPlayer(rng, s.players[po], "foul"); lmHandleCard(s, rng, dm, po, waster, nm, 1.0); }
        return;
      }
    }
  }

  // Creative freedom — brilliant chance (expressive: 4% chance to skip to shooting zone)
  if (poSt.creativity === 1 && rng.u() < 0.04) {
    s.ball = po === "home" ? 4 : 0; s.pressure = 1;
    s.events.push({min:dm, type:"chance", team:po, text:"\u2728 Moment of magic from "+nm[po]+"'s "+pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"goal").name+"! Through on goal!"});
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
    s.events.push({min:dm,type:"press",text:nm[op]+" press and win it back."});
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
      // Penalty — zone-based
      s.events.push({min:dm,type:"penalty",team:po,text:"\uD83C\uDFAF PENALTY! Foul by "+nm[op]+"'s "+fouler.name+"!"});s.stoppageBank+=90;s.stats[po].penalties++;
      ratePlayer(s.players[op],fouler.name,-0.3);lmHandleCard(s,rng,dm,op,fouler,nm,0.55*tackleCardMod);
      const taker=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"penalty");
      const skillF2=Math.min(1,poE/85+TIER_PEN[taker.tier||0]);
      const zW2=[18+skillF2*8,8-skillF2*3,18+skillF2*8,20+skillF2*6,10-skillF2*4,20+skillF2*6];
      const zT2=zW2.reduce((a,b)=>a+b,0);let zR2=rng.u()*zT2,zone2=0;for(let i=0;i<6;i++){zR2-=zW2[i];if(zR2<=0){zone2=i;break;}}
      const missP2=[0.14,0.04,0.14,0.07,0.02,0.07][zone2];
      const dive2=Math.floor(rng.u()*3);
      const zCol2=zone2%3;
      const isMiss2=rng.u()<missP2;
      const isSave2=!isMiss2&&dive2===zCol2;
      const result2=isMiss2?"miss":isSave2?"save":"goal";
      s.penVisual={zone:zone2,dive:dive2,result:result2,name:taker.name,team:po,tName:nm[po],min:dm};
      if(isMiss2){
        s.stats[po].shots++;
        ratePlayer(s.players[po],taker.name,-0.5);s.events.push({min:dm,type:"pen_miss",team:po,text:"\u274C "+fill(pick(rng,C.pen_missed),{t:nm[po],n:taker.name})});
        s.possession=op;s.pressure=0;
      }else if(isSave2){
        s.stats[po].shots++;s.stats[po].onTarget++;
        ratePlayer(s.players[po],taker.name,-0.4);{const gk=s.players[op].find(p=>p.pos==="GK");if(gk)gk.rating=Math.min(10,+(gk.rating+0.6).toFixed(2));}s.events.push({min:dm,type:"pen_miss",team:po,text:"\u274C "+fill(pick(rng,C.pen_saved),{t:nm[po],n:taker.name})});
        if(rng.u()<0.30){s.stats[po].corners++;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 Rebound cleared for a corner!"});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}
        else{s.possession=op;s.pressure=0;}
      }else{
        s.score[po==="home"?0:1]++;s.stats[po].shots++;s.stats[po].onTarget++;
        if(s.goalscorers)s.goalscorers[po].push({name:taker.name,min:dm,method:"pen"});taker.goals++;{const ti=po==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti);taker.rating=Math.min(10,+(taker.rating+goalAtkMult(taker.atkW)*gCtx).toFixed(2));}
        s.players[op].forEach(p=>{if(p.pos==="GK")p.rating=Math.max(1,+(p.rating-0.1).toFixed(1));else if(p.pos==="DEF")p.rating=Math.max(1,+(p.rating-0.05).toFixed(1));});
        s.events.push({min:dm,type:"goal",team:po,text:"\u26BD "+fill(pick(rng,C.pen_scored),{t:nm[po],n:taker.name})+lmGoalContext(s,rng,po,nm)});
        s.ball=2;s.pressure=0;s.possession=op;s.stoppageBank+=45;s.momentum[po]=4;
      }
      return;
    }
    s.events.push({min:dm,type:"foul",team:op,text:"\u26A0\uFE0F Foul by "+fouler.name+". Free kick "+nm[po]+"."});s.stoppageBank+=15;
    ratePlayer(s.players[op],fouler.name,-0.05);lmHandleCard(s,rng,dm,op,fouler,nm,0.28*tackleCardMod);
    // Free kick shot in dangerous positions
    if(dg<=1&&rng.u()<0.18){s.stats[po].shots++;const fkShooter=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any");s.events.push({min:dm,type:"neutral",text:fill(pick(rng,C.free_kick),{t:nm[po],n:fkShooter.name})});}
    else if(dg>1)s.ball+=dir; // free kick advances position
    return;
  }

  // === SHOOTING ZONE (dg===0) ===
  if(dg===0){
    s.pressure++;
    if(s.pressure>1)s.events.push({min:dm,type:"press",text:fill(pick(rng,CZ.pressure),{t:nm[po],o:nm[op]})});
    const effDef=opM.def/(1+Math.abs(opM.def)*8);
    const defTierMod = s.players[op].reduce((a, p) => a + ((p.pos === "DEF" || p.pos === "GK") ? TIER_DEF_SHOT[p.tier || 0] : 0), 0);
    let shotP=0.55+0.14*poE/(poE+opE)+Math.min(s.pressure*0.03,0.12)+poM.boxShot-effDef-defTierMod;
    if(s.tactics[op]==="def")shotP-=0.08;if(s.tactics[op]==="park")shotP-=0.18;if(s.tactics[op]==="atk")shotP+=0.04;if(s.tactics[op]==="ultra")shotP+=0.10;
    if(rng.u()<shotP){lmResolveShot(s,rng,dm,po,op,poE,opE,nm);return;}
    // No shot — keep or lose ball
    const keepP=0.35+0.10*poE/(poE+opE)+(s.strategy?.[po]?.chanceCreation===-1?0.04:0);
    if(rng.u()<keepP){s.events.push({min:dm,type:"buildup",text:(()=>{const sp=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any");if(rng.u()<0.5)ratePlayer(s.players[po],sp.name,0.10);return fill(pick(rng,CZ.sustain),{t:nm[po],o:nm[op],n:sp.name});})()});return;}
    // Cleared
    s.possession=op;s.pressure=0;
    const defR=opE/(poE+opE),cl=rng.u();
    if(cl<0.35-0.20*defR){if(rng.u()<0.30){s.stats[po].corners++;s.possession=po;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 Cleared for a corner! "+nm[po]+"."});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}else{s.ball=z===4?3:z===0?1:2;s.events.push({min:dm,type:"clearance",text:nm[op]+" clear, but only to the edge."});}}
    else if(cl<0.70-0.20*defR){s.ball=2;s.events.push({min:dm,type:"clearance",text:"Cleared by "+nm[op]+". Midfield."});}
    else{
      const cm=rng.u()<0.30?2:1;s.ball=Math.max(0,Math.min(4,z-dir*cm));
      const od=op==="home"?(4-s.ball):s.ball;
      if(od===0){s.pressure=1;s.events.push({min:dm,type:"counter",team:op,text:"\u26A1 "+fill(pick(rng,CZ.counter),{t:nm[op],o:nm[po],n:(()=>{const cp2=pickPlayer(rng,s.players[op].filter(p=>p.pos!=="GK"),"any");ratePlayer(s.players[op],cp2.name,0.12);return cp2.name;})()})});if(rng.u()<0.25+0.30*opE/(opE+poE)+opM.ctrShot)lmResolveShot(s,rng,dm,op,po,opE,poE,nm,"counter");}
      else s.events.push({min:dm,type:"clearance",text:nm[op]+" clear it long. Transition."});
    }
    return;
  }

  // === BUILDUP ZONES (dg 1-4) ===
  // Long-range shot from opponent's half (dg===1, 12% chance)
  if(dg===1&&rng.u()<Math.max(0.04,0.24+poM.lr)){
    const shooter=pickPlayer(rng,s.players[po],"any");s.stats[po].shots++;
    const lrScorer=pickPlayer(rng,s.players[po],"longGoal");const lrGoal=0.05*Math.pow(poE/opE,0.5)*TIER_CONV[lrScorer.tier||0],lrSave=0.23;
    if(s.xG) s.xG[po] = (s.xG[po]||0) + lrGoal;
    const lr=rng.u();
    if(lr<lrGoal){s.score[po==="home"?0:1]++;s.stats[po].onTarget++;s.goalscorers[po].push({name:lrScorer.name,min:dm,method:"long-range"});lrScorer.goals++;{const ti=po==="home"?0:1,gCtx=goalCtxMult([s.score[0]-(ti===0?1:0),s.score[1]-(ti===1?1:0)],ti),aCtx=1+(gCtx-1)*0.5;lrScorer.rating=Math.min(10,+(lrScorer.rating+goalAtkMult(lrScorer.atkW)*gCtx).toFixed(2));const a=assistPlayer(rng,s.players[po],lrScorer.name,0);if(a)a.rating=Math.max(1,Math.min(10,+(a.rating+0.5*assistAtkMult(a.atkW)*aCtx).toFixed(2)));}s.events.push({min:dm,type:"goal",team:po,text:"\u26BD "+nm[po]+"'s "+lrScorer.name+" fires from distance! GOAL!"+lmGoalContext(s,rng,po,nm)});s.ball=2;s.pressure=0;s.possession=op;s.stoppageBank+=45;s.momentum[po]=4;}
    else if(lr<lrGoal+lrSave){s.stats[po].onTarget++;ratePlayer(s.players[po],lrScorer.name,0.1);{const gk=s.players[op].find(p=>p.pos==="GK");if(gk)gk.rating=Math.min(10,+(gk.rating+0.15).toFixed(2));}s.events.push({min:dm,type:"save",team:po,text:"\uD83E\uDDE4 Long-range effort from "+nm[po]+"'s "+lrScorer.name+". "+nm[op]+" keeper saves."});if(rng.u()<0.40){s.stats[po].corners++;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 Corner "+nm[po]+"."});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}}
    else{s.events.push({min:dm,type:"miss",team:po,text:"\uD83D\uDCA8 "+nm[po]+"'s "+lrScorer.name+" lets fly from range. Wide."});if(rng.u()<0.25){s.stats[po].corners++;s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 Behind for a corner! "+nm[po]+"."});lmResolveCorner(s,rng,dm,po,op,poE,opE,nm);}}
    return;
  }
  // Standalone corner from cross (4% in attacking territory)
  if(dg<=2&&rng.u()<0.04*poM.corn){
    s.stats[po].corners++;
    s.events.push({min:dm,type:"corner",team:po,text:"\uD83C\uDFF4 Cross blocked! Corner "+nm[po]+"."});
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
        s.events.push({min:dm, type:"chance", team:po, text:"\u26A1 Offside trap beaten! "+nm[po]+"'s "+pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any").name+" is through!"});
        lmResolveShot(s, rng, dm, po, op, poE * 1.25, opE, nm, "counter");
        return;
      }
      s.ball-=dir;s.possession=op;s.events.push({min:dm,type:"offside",team:po,text:"\uD83D\uDEA9 "+fill(pick(rng,C.offside),{t:nm[po],n:pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any").name})});return;
    }
    if(nd===0){s.pressure=1;s.events.push({min:dm,type:"chance",team:po,text:(()=>{const cp=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"goal");ratePlayer(s.players[po],cp.name,0.15);return fill(pick(rng,CZ.enter_box),{t:nm[po],o:nm[op],n:cp.name});})()});if(rng.u()<0.25+0.35*poE/(poE+opE))lmResolveShot(s,rng,dm,po,op,poE,opE,nm);}
    else s.events.push({min:dm,type:"buildup",text:(()=>{const bp=pickPlayer(rng,s.players[po],"any");if(rng.u()<0.4)ratePlayer(s.players[po],bp.name,0.08);return fill(pick(rng,CZ.buildup),{t:nm[po],o:nm[op],n:bp.name});})()});
  }else if(roll<advP+holdP){
    // Hold ball
    s.events.push({min:dm,type:"neutral",text:fill(pick(rng,CZ.neutral),{t:nm[po],o:nm[op],n:pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"any").name})});
  }else if(roll<advP+holdP+longP){
    // Long ball
    s.ball=Math.max(0,Math.min(4,z+dir*2));const nd=po==="home"?(4-s.ball):s.ball;
    if(nd===0){s.pressure=1;s.events.push({min:dm,type:"chance",team:po,text:(()=>{const cp=pickPlayer(rng,s.players[po].filter(p=>p.pos!=="GK"),"goal");ratePlayer(s.players[po],cp.name,0.15);return fill(pick(rng,CZ.enter_box),{t:nm[po],o:nm[op],n:cp.name});})()});if(rng.u()<0.25+0.35*poE/(poE+opE))lmResolveShot(s,rng,dm,po,op,poE,opE,nm);}
    else if(rng.u()<0.45){s.events.push({min:dm,type:"neutral",text:nm[po]+" play it long. Win the second ball."});}
    else{s.possession=op;s.events.push({min:dm,type:"clearance",text:nm[po]+" play it long. Headed away by "+nm[op]+"."});}
  }else{
    // Turnover — but 20% are fouls that give ball back
    const tTackle = s.strategy?.[op]?.tackling || 0;
    if(rng.u()<0.20*(tTackle===1?1.3:tTackle===-1?0.75:1.0)){s.stats[op].fouls++;let fouler=pickPlayer(rng,s.players[op],"foul");if(s.booked[op].includes(fouler.name)&&rng.u()<0.92){const ub=s.players[op].filter(p=>!s.booked[op].includes(p.name));if(ub.length>0)fouler=pick(rng,ub);}s.events.push({min:dm,type:"foul",team:op,text:"\u26A0\uFE0F Foul by "+fouler.name+". Free kick "+nm[po]+"."});s.stoppageBank+=15;lmHandleCard(s,rng,dm,op,fouler,nm,0.22*(tTackle===1?1.4:tTackle===-1?0.65:1.0));return;}
    s.possession=op;
    const ctrP=(dg<=2?0.14:0.06)*opM.ctr;
    if(rng.u()<ctrP){
      const cm=rng.u()<0.5?2:1;s.ball=Math.max(0,Math.min(4,z-dir*cm));
      const od=op==="home"?(4-s.ball):s.ball;
      if(od===0){s.pressure=1;s.events.push({min:dm,type:"counter",team:op,text:"\u26A1 "+fill(pick(rng,CZ.counter),{t:nm[op],o:nm[po],n:(()=>{const cp2=pickPlayer(rng,s.players[op].filter(p=>p.pos!=="GK"),"any");ratePlayer(s.players[op],cp2.name,0.12);return cp2.name;})()})});if(rng.u()<0.25+0.30*opE/(opE+poE)+opM.ctrShot)lmResolveShot(s,rng,dm,op,po,opE,poE,nm,"counter");}
      else s.events.push({min:dm,type:"counter",text:nm[op]+" win it and break forward."});
    }else s.events.push({min:dm,type:"neutral",text:nm[po]+" lose it. "+nm[op]+" have the ball."});
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
  // Substitutions (earlier when trailing, for stamina recovery + clearing yellows)
  for (const side of ["home","away"]) {
    if (s.subs[side] < 3) {
      const scoreDiff = side === "home" ? (s.score[0]+(s.startScore?.[0]||0)) - (s.score[1]+(s.startScore?.[1]||0)) : (s.score[1]+(s.startScore?.[1]||0)) - (s.score[0]+(s.startScore?.[0]||0));
      const trailing = scoreDiff < 0;
      const windows = trailing ? [[50,55],[60,65],[70,75]] : [[58,62],[68,72],[78,82]];
      const prob = trailing ? 0.55 : 0.40;
      const w = windows[s.subs[side]];
      if (s.minute >= w[0] && s.minute <= w[1] && rng.u() < prob) {
        s.subs[side]++;s.stamina[side] = Math.min(100, s.stamina[side] + 4);
        const sn = side === "home" ? home.name : away.name;
        const subOff = pickPlayer(rng, s.players[side], "subOff");
        const subOn = (()=>{ const b=s.bench[side]; if(b.length===0)return null; const outIdx=b.findIndex(p=>p.pos!=="GK"); if(outIdx===-1)return null; return b.splice(outIdx,1)[0]; })();
        if (subOn) { subOn.sub='on'; subOn.rating=6.5; const off=s.players[side].find(p=>p.name===subOff.name); if(off){off.sub='off';s.subbedOff[side].push({...off});} s.players[side] = s.players[side].filter(p=>p.name!==subOff.name); s.players[side].push(subOn); }
        if (s.booked[side].length > 0) {
          const cleared = s.booked[side].shift();
          s.events.push({min:dm,type:"sub",text:"\u21C4 "+sn+"'s "+subOff.name+" \u2192 "+(subOn?subOn.name:"sub")+". Booked player off."});
        } else {
          s.events.push({min:dm,type:"sub",text:"\u21C4 "+sn+"'s "+subOff.name+" \u2192 "+(subOn?subOn.name:"sub")+". Tactical substitution."});
        }
      }
    }
  }
  // Injuries (~0.14 per game, rarer when fresh, more common when tired)
  for (const side of ["home","away"]) {
    const injRate = 0.0008 * (1 + (100 - s.stamina[side]) * 0.008);
    if (rng.u() < injRate && s.players[side].length > 7) {
      const injured = pick(rng, s.players[side]);
      const sn = side === "home" ? home.name : away.name;
      s.stoppageBank += 60; s.stats[side].injuries++;
      if (s.subs[side] < 3) {
        s.subs[side]++; s.stamina[side] = Math.min(100, s.stamina[side] + 2); injured.inj = true;
        const wasBooked = s.booked[side].includes(injured);
        if (wasBooked) s.booked[side] = s.booked[side].filter(p => p !== injured);
        s.events.push({min:dm,type:"injury",team:side,text:"\uD83C\uDFE5 "+sn+"'s "+injured.name+" goes down injured."+(wasBooked ? " Was on a yellow." : "")+" Forced substitution."});
      } else {
        {const ip=s.players[side].find(p=>p.name===injured.name);if(ip){ip.inj=true;s.subbedOff[side].push({...ip});}} s.players[side] = s.players[side].filter(p => p.name !== injured.name);
        if (s.booked[side].includes(injured.name)) s.booked[side] = s.booked[side].filter(p => p !== injured.name);
        s.stats[side].injuriesNoSub++;
        s.events.push({min:dm,type:"red",team:side,text:"\uD83D\uDE91 "+sn+"'s "+injured.name+" goes down injured. No subs remaining. "+sn+" down to "+s.players[side].length+" men."});
      }
    }
  }
  // Record momentum: ball position + possession bias, smoothed
  const rawMom = (s.ball - 2) / 2 + (s.possession === "home" ? 0.15 : -0.15) + (s.pressure * 0.08 * (s.possession === "home" ? 1 : -1));
  const prev = s.momHist.length > 0 ? s.momHist[s.momHist.length - 1].v : 0;
  const smoothed = prev * 0.6 + rawMom * 0.4;
  s.momHist.push({ m: s.minute, v: Math.max(-1, Math.min(1, smoothed)) });
  // Periodic rating: every 5 min, individual performance based on position and match involvement
  if (s.minute > 0 && s.minute % 5 === 0) {
    const ph = s.possCount.home, pa = s.possCount.away, pt = ph + pa || 1;
    for (const side of ["home","away"]) {
      const pct = side === "home" ? ph/pt : pa/pt;
      const sd = side === "home" ? s.score[0]-s.score[1] : s.score[1]-s.score[0];
      const op = side === "home" ? "away" : "home";
      // Minimal team drift (down from 0.04/0.02 per 5min to near-zero)
      if (sd > 0) s.players[side].forEach(p => { p.rating = Math.min(10, +(p.rating + 0.008).toFixed(2)); });
      if (sd < 0) s.players[side].forEach(p => { p.rating = Math.max(1, +(p.rating - 0.004).toFixed(2)); });
      // Position-specific individual adjustments
      s.players[side].forEach(p => {
        // GK: reward for clean intervals, penalize for being beaten often
        if (p.pos === "GK") {
          const gaConceded = side === "home" ? s.score[1] : s.score[0];
          if (gaConceded === 0 && s.minute >= 30) p.rating = Math.min(10, +(p.rating + 0.07).toFixed(2));
          if (pct > 0.58 && s.stats[op].shots < s.minute/12) p.rating = Math.max(1, +(p.rating - 0.02).toFixed(2));
        }
        if (p.pos === "DEF") {
          const gaConceded = side === "home" ? s.score[1] : s.score[0];
          if (gaConceded === 0 && s.minute >= 20) p.rating = Math.min(10, +(p.rating + 0.06).toFixed(2));
          if (s.stats[op].onTarget > s.minute/10) p.rating = Math.max(1, +(p.rating - 0.02).toFixed(2));
        }
        if (p.pos === "MID") {
          if (pct > 0.55) p.rating = Math.min(10, +(p.rating + 0.04).toFixed(2));
          if (pct < 0.42) p.rating = Math.max(1, +(p.rating - 0.02).toFixed(2));
        }
        // FWD: penalize quiet games (no goals, no assists, low involvement)
        if (p.pos === "FWD" && s.minute >= 50) {
          if (p.goals === 0 && p.assists === 0 && p.rating <= 6.2) p.rating = Math.max(1, +(p.rating - 0.03).toFixed(2));
        }
      });
      // Individual involvement bonus: random player from possession team gets credit
      if (pct > 0.52) { const mp = pickPlayer(rng, s.players[side], "any"); ratePlayer(s.players[side], mp.name, 0.06); }
      if (pct < 0.42 && rng.u() < 0.3) { const dp = pickPlayer(rng, s.players[side], "any"); ratePlayer(s.players[side], dp.name, -0.03); }
    }
  }
  // End of match: clean sheet bonus for GK and DEF
  if (s.phase === "finished") {
    for (const side of ["home","away"]) {
      const ga = side === "home" ? s.score[1] : s.score[0];
      if (ga === 0 && !s._cleanSheetApplied?.[side]) {
        s.players[side].forEach(p => {
          if (p.pos === "GK") p.rating = Math.min(10, +(p.rating + 0.5).toFixed(2));
          if (p.pos === "DEF") p.rating = Math.min(10, +(p.rating + 0.3).toFixed(2));
        });
        if (!s._cleanSheetApplied) s._cleanSheetApplied = {};
        s._cleanSheetApplied[side] = true;
      }
    }
  }
}

function createMatchState() {
  return { phase:"pre_match",minute:0,stoppageElapsed:0,stoppageTotal:0,stoppageBank:0,score:[0,0],events:[],stats:{home:{shots:0,onTarget:0,fouls:0,yellows:0,reds:0,corners:0,penalties:0,woodwork:0,injuries:0,injuriesNoSub:0},away:{shots:0,onTarget:0,fouls:0,yellows:0,reds:0,corners:0,penalties:0,woodwork:0,injuries:0,injuriesNoSub:0}},players:{home:[],away:[]},bench:{home:[],away:[]},booked:{home:[],away:[]},goalscorers:{home:[],away:[]},subbedOff:{home:[],away:[]},forceResult:false,penalties:null,ball:2,pressure:0,tactics:{home:"bal",away:"bal"},possession:"home",possCount:{home:0,away:0},styles:{home:"balanced",away:"balanced"},allowTacChange:{home:true,away:true},momentum:{home:0,away:0},formations:{home:"4-3-3",away:"4-3-3"},homeAdv:null,stamina:{home:100,away:100},subs:{home:0,away:0}, startScore:[0,0], penVisual:null, xG:{home:0,away:0},momHist:[],strategy:{home:{...STRAT_DEF},away:{...STRAT_DEF}} };
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
function lmAdvance(prev, rng, home, away, mutate) {
  const s = mutate ? prev : cloneState(prev);
  const playMin = () => lmSimMinute(s,rng,home,away);
  s.penVisual = null;
  const toStop = (phase) => { s.stoppageTotal=lmCalcStoppage(s.stoppageBank,phase,rng);s.stoppageElapsed=0;s.stoppageBank=0;s.phase=phase+"_stoppage";s.events.push({min:"",type:"phase",text:"\u23F1 "+s.stoppageTotal+" minutes added time"}); };
  switch(s.phase){
    case "pre_match": s.phase="first_half";s.minute=1;s.events.push({min:"",type:"phase",text:"\u26BD Kick off!"});playMin();break;
    case "first_half": s.minute++;playMin();if(s.minute>=45)toStop("first_half");break;
    case "first_half_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){s.phase="half_time";s.events.push({min:"",type:"phase",text:"\u23F0 Half time. "+s.score[0]+"\u2013"+s.score[1]});}break;
    case "half_time": s.phase="second_half";s.minute=45;s.ball=2;s.possession="away";s.stamina.home=Math.min(100,s.stamina.home+15);s.stamina.away=Math.min(100,s.stamina.away+15);s.events.push({min:"",type:"phase",text:"\u26BD Second half underway!"});break;
    case "second_half": s.minute++;playMin();if(s.minute>=90)toStop("second_half");break;
    case "second_half_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){const aggH=s.score[0]+(s.startScore?.[0]||0),aggA=s.score[1]+(s.startScore?.[1]||0);if(s.forceResult&&aggH===aggA){s.phase="full_time";s.events.push({min:"",type:"phase",text:"\u23F0 Full time. "+s.score[0]+"\u2013"+s.score[1]+(s.startScore?.[0]||s.startScore?.[1]?" ("+aggH+"\u2013"+aggA+" agg.)":"")+". Extra time to follow."});}else{s.phase="finished";s.events.push({min:"",type:"phase",text:"\uD83C\uDFC1 Full time! "+home.name+" "+s.score[0]+"\u2013"+s.score[1]+" "+away.name+(s.startScore?.[0]||s.startScore?.[1]?" ("+aggH+"\u2013"+aggA+" agg.)":"")});}}break;
    case "full_time": s.phase="et_first";s.minute=90;s.ball=2;s.possession="home";s.events.push({min:"",type:"phase",text:"\u26BD Extra time begins!"});break;
    case "et_first": s.minute++;playMin();if(s.minute>=105)toStop("et_first");break;
    case "et_first_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){s.phase="et_half_time";s.events.push({min:"",type:"phase",text:"\u23F0 ET half time. "+s.score[0]+"\u2013"+s.score[1]});}break;
    case "et_half_time": s.phase="et_second";s.minute=105;s.ball=2;s.possession="away";s.stamina.home=Math.min(100,s.stamina.home+5);s.stamina.away=Math.min(100,s.stamina.away+5);s.events.push({min:"",type:"phase",text:"\u26BD ET second half!"});break;
    case "et_second": s.minute++;playMin();if(s.minute>=120)toStop("et_second");break;
    case "et_second_stoppage": s.stoppageElapsed++;playMin();if(s.stoppageElapsed>=s.stoppageTotal){const aggH2=s.score[0]+(s.startScore?.[0]||0),aggA2=s.score[1]+(s.startScore?.[1]||0);if(aggH2===aggA2){s.phase="penalties";
        const penOrd=(side)=>{const pl=s.players[side].filter(p=>p.pos!=="GK").sort((a,b)=>(b.atkW||0)-(a.atkW||0)).map(p=>p.name);const gk=s.players[side].find(p=>p.pos==="GK");if(gk)pl.push(gk.name);return pl;};
        s.penalties={home:[],away:[],homeOrder:penOrd("home"),awayOrder:penOrd("away"),homeIdx:0,awayIdx:0,nextTeam:"home",decided:false,winner:null};s.events.push({min:"",type:"phase",text:"\uD83C\uDFAF Penalty shootout!"});}else{s.phase="finished";const w=aggH2>aggA2?home.name:away.name;s.events.push({min:"",type:"phase",text:"\uD83C\uDFC1 "+w+" win after extra time! "+s.score[0]+"\u2013"+s.score[1]+(s.startScore?.[0]||s.startScore?.[1]?" ("+aggH2+"\u2013"+aggA2+" agg.)":"")});}}break;
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
      if(scored){s.events.push({min:"PEN",type:"goal",team:tk,text:"\u26BD "+fill(pick(rng,C.pen_scored),{t:tName,n:taker.name})+" "+penScore});}
      else{const penTpl=isMiss?C.pen_missed:C.pen_saved;s.events.push({min:"PEN",type:"pen_miss",team:tk,text:"\u274C "+fill(pick(rng,penTpl),{t:tName,n:taker.name})+" "+penScore});}
      p.nextTeam=ok;const winner=lmCheckPenDecided(p.home,p.away);if(winner){p.decided=true;p.winner=winner;s.phase="finished";const wName=winner==="home"?home.name:away.name;s.events.push({min:"",type:"phase",text:"\uD83C\uDFC6 "+wName+" win on penalties! "+s.score[0]+"\u2013"+s.score[1]+" ("+p.home.filter(k=>k.scored).length+"\u2013"+p.away.filter(k=>k.scored).length+" PENS)"});}break;}
    default:break;
  }
  return s;
}

function lmBtnLabel(s) {
  const map = { pre_match:"\u26BD Kick Off", half_time:"\u25B6 2nd Half", full_time:"\u25B6 Extra Time", et_half_time:"\u25B6 ET 2nd Half" };
  if (map[s.phase]) return map[s.phase];
  if (s.phase==="penalties") return s.penalties?.decided?null:"\u25B6 Next Kick";
  if (s.phase==="finished") return null;
  if (s.phase.includes("stoppage")) { const b={first_half_stoppage:45,second_half_stoppage:90,et_first_stoppage:105,et_second_stoppage:120}[s.phase]; return "\u25B6 "+b+"+"+(s.stoppageElapsed+1)+"'"; }
  return "\u25B6 "+(s.minute+1)+"'";
}


// ═══ INSTANT SIM ═════════════════════════════════════════════════════════════
function simInstantMatch(rng, homeSkill, awaySkill, forceResult, homeStyle, awayStyle, homeForm, awayForm, homeAdv, homeStrat, awayStrat) {
  const home={name:"H",skill:homeSkill},away={name:"A",skill:awaySkill};
  let s=createMatchState();s.forceResult=!!forceResult;
  s.styles={home:homeStyle||"balanced",away:awayStyle||"balanced"};
  s.formations={home:homeForm||"4-3-3",away:awayForm||"4-3-3"};
  s.homeAdv=homeAdv||null;
  s.strategy={home:{...STRAT_DEF,...(homeStrat||{})},away:{...STRAT_DEF,...(awayStrat||{})}};
  s.modifiers={home:applyStrategy(mergeModifiers(STYLE_MOD[s.styles.home]||STYLE_MOD.balanced,FORM_MOD[s.formations.home]),s.strategy.home),away:applyStrategy(mergeModifiers(STYLE_MOD[s.styles.away]||STYLE_MOD.balanced,FORM_MOD[s.formations.away]),s.strategy.away)};
  const mkSq = (form) => { const all = buildSquad(form || "4-3-3", null).map(p => ({...p, rating:6, goals:0, assists:0, yc:0, rc:false})); return { starters: all.filter(p => !p.bench), bench: all.filter(p => p.bench) }; };
  const hSq = mkSq(homeForm), aSq = mkSq(awayForm);
  s.players={home:hSq.starters,away:aSq.starters};
  s.bench={home:hSq.bench,away:aSq.bench};
  s.events={length:0,push(){this.length++;}};
  lmAdvance(s,rng,home,away,true);let ftS=null;
  for(let i=0;i<300&&s.phase!=="finished";i++){if(s.phase==="full_time"&&!ftS)ftS=[...s.score];lmAdvance(s,rng,home,away,true);}
  if(!ftS)ftS=[...s.score];
  const penH=s.penalties?.home?.filter(k=>k?.scored).length||0,penA=s.penalties?.away?.filter(k=>k?.scored).length||0;
  return{ftHome:ftS[0],ftAway:ftS[1],et:(s.score[0]!==ftS[0]||s.score[1]!==ftS[1])?{home:s.score[0]-ftS[0],away:s.score[1]-ftS[1]}:null,pen:s.penalties?.decided?{home:penH,away:penA}:null,cards:{home:{yellows:s.stats.home.yellows,reds:s.stats.home.reds,secondYellows:s.stats.home.secondYellows||0,injuries:s.stats.home.injuries},away:{yellows:s.stats.away.yellows,reds:s.stats.away.reds,secondYellows:s.stats.away.secondYellows||0,injuries:s.stats.away.injuries}}};
}


function simTwoLegMatch(rng, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg1HA, leg2HA, homeStrat, awayStrat, awayGoals) {
  const l1 = simInstantMatch(rng, homeSkill, awaySkill, false, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat);
  const l2f = leg2HA === "home" ? "away" : leg2HA === "away" ? "home" : null;
  const l2 = simInstantMatch(rng, awaySkill, homeSkill, true, awayStyle, homeStyle, awayForm, homeForm, l2f, awayStrat, homeStrat);
  // Aggregate from bracket perspective: bracket-home total = leg1 home goals + leg2 away goals
  const aggH = l1.ftHome + l2.ftAway, aggA = l1.ftAway + l2.ftHome;
  const awayH = l2.ftAway, awayA = l1.ftAway; // away goals for tiebreaker
  const result = { twoLeg:true, leg1:{home:l1.ftHome,away:l1.ftAway}, leg2:{home:l2.ftHome,away:l2.ftAway}, agg:{home:aggH,away:aggA}, awayGoals:{home:awayH,away:awayA}, awayGoalsRule:!!awayGoals, et:null, pen:null, cards:{leg1:l1.cards,leg2:l2.cards} };
  if (aggH !== aggA) return result;
  if (awayGoals && awayH !== awayA) return result;
  // Tied on aggregate AND away goals — use ET/pens from leg 2 (swap perspective)
  if (l2.et) { result.et = {home:l2.et.away, away:l2.et.home}; result.agg.home += l2.et.away; result.agg.away += l2.et.home; }
  if (l2.pen) { result.pen = {home:l2.pen.away, away:l2.pen.home}; }
  return result;
}

function simFirstLeg(rng, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat) {
  const l1 = simInstantMatch(rng, homeSkill, awaySkill, false, homeStyle, awayStyle, homeForm, awayForm, leg1HA, homeStrat, awayStrat);
  return { twoLeg:true, partial:true, leg1:{home:l1.ftHome,away:l1.ftAway}, leg2:null, agg:null, awayGoals:null, awayGoalsRule:false, et:null, pen:null, cards:{leg1:l1.cards} };
}
function simSecondLeg(rng, partial, homeSkill, awaySkill, homeStyle, awayStyle, homeForm, awayForm, leg2HA, homeStrat, awayStrat, awayGoals) {
  const l2f = leg2HA === "home" ? "away" : leg2HA === "away" ? "home" : null;
  const l2 = simInstantMatch(rng, awaySkill, homeSkill, true, awayStyle, homeStyle, awayForm, homeForm, l2f, awayStrat, homeStrat);
  const l1 = partial.leg1, aggH = l1.home + l2.ftAway, aggA = l1.away + l2.ftHome;
  const awayH = l2.ftAway, awayA = l1.away;
  const result = { twoLeg:true, partial:false, leg1:l1, leg2:{home:l2.ftHome,away:l2.ftAway}, agg:{home:aggH,away:aggA}, awayGoals:{home:awayH,away:awayA}, awayGoalsRule:!!awayGoals, et:null, pen:null, cards:{leg1:partial.cards?.leg1,leg2:l2.cards} };
  if (aggH !== aggA) return result;
  if (awayGoals && awayH !== awayA) return result;
  if (l2.et) { result.et = {home:l2.et.away, away:l2.et.home}; result.agg.home += l2.et.away; result.agg.away += l2.et.home; }
  if (l2.pen) { result.pen = {home:l2.pen.away, away:l2.pen.home}; }
  return result;
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
function koWinner(m) { if (!m.result || !m.home) return null; if (m.result.twoLeg) { if (m.result.partial) return null; if (m.result.pen) return m.result.pen.home > m.result.pen.away ? m.home : m.away; const ah=m.result.agg.home, aa=m.result.agg.away; if (ah!==aa) return ah>aa?m.home:m.away; if (m.result.awayGoalsRule) return m.result.awayGoals.home>m.result.awayGoals.away?m.home:m.away; return m.home; } if (m.result.pen) return m.result.pen.home > m.result.pen.away ? m.home : m.away; const h = m.result.ftHome + (m.result.et?.home || 0), a = m.result.ftAway + (m.result.et?.away || 0); return h > a ? m.home : h < a ? m.away : m.home; }
function koLoser(m) { const w = koWinner(m); return w === m.home ? m.away : m.home; }
function koRoundName(total, ri) { const r = total / Math.pow(2, ri); return r === 2 ? "Final" : r === 4 ? "Semi-finals" : r === 8 ? "Quarter-finals" : `Round of ${r}`; }
function koResultText(m) { if (!m.result) return null; if (m.result.twoLeg) { const r=m.result; if (r.partial) return `${r.leg1.home}–${r.leg1.away} (L1)`; let t=`${r.leg1.home}–${r.leg1.away} / ${r.leg2.away}–${r.leg2.home} (${r.agg.home}–${r.agg.away} agg.)`; if (r.et) t+=` AET`; if (r.pen) t+=` (${r.pen.home}–${r.pen.away} PENS)`; if (!r.et&&!r.pen&&r.agg.home===r.agg.away&&r.awayGoalsRule) t+=` (away goals)`; return t; } let t = `${m.result.ftHome}–${m.result.ftAway}`; if (m.result.et) t = `${m.result.ftHome + m.result.et.home}–${m.result.ftAway + m.result.et.away} AET`; if (m.result.pen) t += ` (${m.result.pen.home}–${m.result.pen.away} PENS)`; return t; }
function propagateKO(ko) {
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
  const fm = ko.rounds[ko.rounds.length - 1].matches[0];
  if (fm?.result) ko.champion = koWinner(fm);
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
  const rest = sorted.slice(numByes).sort(() => rng.u() - 0.5);
  const slots = new Array(n2).fill(null);
  const seeds = bracketSeeds(n2);
  const byeMatches = new Set();
  for (let i = 0; i < numByes; i++) { const pos = seeds.indexOf(i + 1); slots[pos] = byeTeams[i]; byeMatches.add(Math.floor(pos / 2)); }
  let ri = 0; for (let i = 0; i < n2; i += 2) { if (byeMatches.has(i / 2)) continue; slots[i] = rest[ri++] || null; slots[i + 1] = rest[ri++] || null; }
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
    // Extract player names after 14 tactic columns (indices 4+14=18 onwards)
    const playerNames = [];
    for (let i = 18; i < p.length; i++) { const pn = p[i]?.trim(); if (pn) playerNames.push(pn); }
    const squad = buildSquad(formation, playerNames.length > 0 ? playerNames : null);
    return { ...base, style, formation, strategy, squad };
  }).filter(Boolean);
}
const abbr = (n, code) => code ? code.toUpperCase().slice(0, 3) : (n || "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();

const POS_W = {goal:{GK:0,DEF:5,MID:25,FWD:70},longGoal:{GK:0,DEF:10,MID:70,FWD:20},corner:{GK:1,DEF:45,MID:25,FWD:29},foul:{GK:1,DEF:35,MID:45,FWD:19},penalty:{GK:0,DEF:5,MID:35,FWD:60},any:{GK:0,DEF:25,MID:40,FWD:35},subOff:{GK:0,DEF:20,MID:40,FWD:40}};
function pickPlayer(rng, players, type) {
  if (!players || players.length === 0) return {name:"?",pos:"MID",atkW:0};
  if (!players[0]?.pos) return {name:String(pick(rng,players)),pos:"MID",atkW:0};
  const hasAtk = players[0]?.atkW != null;
  const pureAtk = (type === "goal" || type === "longGoal" || type === "penalty") && hasAtk;
  const w = POS_W[type] || POS_W.any;
  // For pure atkW types (goal/longGoal/penalty): use atkW directly
  // For other types when atkW available: blend position weight + atkW for formation-specific distribution
  const useTier = type === "goal" || type === "longGoal" || type === "penalty" || type === "corner";
  const weighted = players.map(p => {
    const tw = useTier ? TIER_ATK_W[p.tier || 0] : 1;
    if (pureAtk) return {p, w: (p.atkW || 0) * tw};
    const posW = w[p.pos] || 10;
    if (hasAtk && (type === "any" || type === "corner")) return {p, w: (posW + (p.atkW || 0) * 0.8) * tw};
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
  if (p) p.rating = Math.max(1, Math.min(10, +(p.rating + delta).toFixed(1)));
}
const goalAtkMult = (atkW) => 0.9 + 0.6 * Math.pow(1 - Math.min(atkW||0, 50)/50, 1.5);
const assistAtkMult = (atkW) => 0.95 + 0.25 * Math.pow(1 - Math.min(atkW||0, 50)/50, 2);
const goalCtxMult = (score, ti) => { const us=score[ti],them=score[1-ti],d=us-them; if(us===0&&them===0)return 1.15; if(d===-1)return 1.2; if(d===0)return 1.15; if(d>0)return Math.max(0.8,1.1-d*0.1); return 0.9; };
function assistPlayer(rng, players, scorer, delta) {
  const others = players.filter(p => p.name !== scorer && p.pos !== "GK");
  if (others.length === 0) return null;
  const a = pickPlayer(rng, others, "any");
  a.assists++;
  a.rating = Math.max(1, Math.min(10, +(a.rating + (delta != null ? delta : 0.5)).toFixed(2)));
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
    "4-4-2":     [0, 4,3,3,4, 22,14,14,22, 42,44],           // LB CB CB RB | LM CM CM RM | ST ST
    "4-3-3":     [0, 5,3,3,5, 15,18,15, 36,40,36],           // LB CB CB RB | CM CM(b2b) CM | LW ST RW
    "4-2-3-1":   [0, 4,3,3,4, 8,8, 30,38,30, 36],            // LB CB CB RB | DM DM | LAM CAM RAM | ST
    "4-1-4-1":   [0, 4,3,3,4, 6, 28,14,14,28, 36],           // LB CB CB RB | DM | LW CM CM RW | ST
    "4-1-2-1-2": [0, 4,3,3,4, 6, 14,14, 36, 42,44],          // LB CB CB RB | DM | CM CM | AM | ST ST
    "4-3-2-1":   [0, 4,3,3,4, 12,16,12, 34,34, 36],          // LB CB CB RB | CM CM(b2b) CM | AM AM | ST
    "3-4-3":     [0, 3,4,3, 16,10,10,16, 36,40,36],          // CB CB CB | LWB CM CM RWB | LW ST RW
    "3-5-2":     [0, 3,4,3, 18,12,16,12,18, 42,44],          // CB CB CB | LWB CM CM(b2b) CM RWB | ST ST
    "3-4-1-2":   [0, 3,4,3, 14,10,10,14, 36, 42,44],         // CB CB CB | LWB CM CM RWB | AM | ST ST
    "5-3-2":     [0, 12,3,4,3,12, 18,16,18, 42,44],          // LWB CB CB CB RWB | CM CM(b2b) CM | ST ST
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
  const benchAtk = [0, 8, 25, 35, 60];
  for (let i = 0; i < 5; i++) sq.push({ name: n[11 + i] || "#"+(12+i), pos: benchPos[i], bench: true, atkW: benchAtk[i] });
  sq.forEach(p => { const {name,tier} = parseTier(p.name); p.name = name; p.tier = tier; });
  return sq;
}


const PRESET_AVIUM_TSV = `REI	Reino	87	Tiki-Taka	4-3-3	Play Out of Defence	Much Shorter	Work Ball Into Box	Be More Disciplined	Be More Expressive	No Instruction	Never	Counter-Press	Hold Shape	Short	Much Higher	Much Higher	Offside Trap	Stay On Feet	X. Cienfuegos [*]	V. Peixoto [+]	I. Urrutia [+]	O. Montagut	R. Alvarenga	G. Valbuena	Y. Bengoetxea [*]	T. Candeias [+]	P. Puigcorbé [+]	M. Salcedo	B. Figueira	U. Izagirre	D. Quintana	J. Xirau	L. Escudero	N. Gouveia
NCH	Nichirin	86	Wing Play	4-4-2	No Instruction	Shorter	Work Ball Into Box	Run At Defence	Be More Expressive	No Instruction	Sometimes	Regroup	Counter	Short	Higher	Standard	Drop Off	Stay On Feet	K. Ouyang	S. Segawa [+]	D. Takanashi [+]	G. Fija	A. Nagumo	T. Bashira	T. Mikado [+]	M. Kishima	L. Higashiyama [*]	G. Erdene [+]	S. Itoshi [*]	E. Sato	G. Nishigawa	K. Torigoe	W. Kon	H. Morimoto
ALE	Alemannia	86	Tiki-Taka	4-2-3-1	Pass Into Space	More Direct	Shoot On Sight	Run At Defence	Be More Disciplined	No Instruction	Never	Counter-Press	Counter	Long	Much Higher	Higher	Step Up	Get Stuck In	K. Bernhard [+]	F. Gruber	V. Novotný	J. Van Antwerp [*]	J. Dvořák	T. Svoboda [+]	G. Dreesens	O. Černý	S. Boelens [+]	P. Procházka	F. Van Can [*]	M. Noack	R. Pietach	S. Reier	E. Lehner	D. Kunze
VIC	Vicily	85	Counter	5-3-2	Play Out of Defence	Shorter	Work Ball Into Box	Be More Disciplined	Be More Disciplined	No Instruction	Constantly	Regroup	Hold Shape	Short	Standard	Standard	No Instruction	Stay On Feet	M. Rossi [+]	L. Squillaci [+]	A. Ferrari [+]	F. Castiglione [*]	G. Russo	D. Vivaldi	E. Bianchi	V. Zaccagni	S. Romano	R. Lucchese [*]	C. Colombo	P. Borromeo	T. Ricci	N. Donizetti	I. Esposito	U. Bellarmino
ESU	E.S.U.	85	Gegenpress	3-4-3	Play Out of Defence	Standard	No Instruction	Run At Defence	No Instruction	No Instruction	Never	Counter-Press	Counter	Short	Higher	Higher	Step Up	No Instruction	S. Jackson	N. Vitale	M. Smith	E. Farnsworth [+]	C. Bauer	V. Moretti [+]	R. De Luca [*]	A. Anderson	T. Hawthorne [+]	D. Rossi	L. Vogel [*]	P. Turner	P. Klein	F. Hoffman	W. Bradford	S. Caruso
ELV	Elvester	85	Wing Play	4-2-3-1	No Instruction	Shorter	Work Ball Into Box	Run At Defence	Be More Disciplined	Play for Set Pieces	Sometimes	Regroup	Hold Shape	Short	Lower	Standard	Drop Off	Stay On Feet	J. Stanford [+]	O. Ashworth	H. Brown	W. Wetherby	C. Davies	T. Hargreaves [+]	G. Smith	A. Whitmore	M. Wright	L. Bardsley [*]	H. Caine [*]	R. Townsend	N. Hughes	S. Chadwick	D. Evans	F. Lancaster
ARV	Arverne	84	Balanced	4-2-3-1	Pass Into Space	More Direct	No Instruction	Run At Defence	Be More Expressive	No Instruction	Sometimes	Regroup	Counter	No Instruction	Lower	Standard	Drop Off	No Instruction	F. Beaulieu	E. Delacroix	L. Bernard	M. Vasseur [+]	H. Dubois	G. Chardon	O. Desjardins [*]	C. Lemaitre	T. Durand	A. Blanc [+]	R. Gauthier [+]	M. Martin	N. Richard	V. Tardieu	B. Roux	P. Petit
KAR	Karjania	81	Wing Play	4-3-3	Play Out of Defence	More Direct	Work Ball Into Box	Run At Defence	Be More Expressive	Play for Set Pieces	Never	Regroup	Counter	Long	Higher	Lower	Drop Off	Get Stuck In	A. Väisänen [+]	S. Helkanen	K. Yrjölä	E. Uusitalo [+]	P. Seppälä	K. Kaljurand [*]	J. Soosaar	O. Rástoš	M. Heikinnen	R. Duoŋgi	V. Petrovic [+]	J. Hämäläinen	O. Niskanen	T. Saarela	H. Karlsson	T. Puusepp
HOL	Hollosend	81	Counter	4-2-3-1	Pass Into Space	More Direct	No Instruction	Run At Defence	Be More Expressive	No Instruction	Never	No Instruction	Counter	Long	Higher	Standard	No Instruction	No Instruction	C. Calhoun	L. Urdaneta	T. Uzcátegui [*]	W. Boone	E. Escalona	D. Landry	M. Betancourt	H. Hollis [+]	V. Vivas	B. Covington [+]	S. Arismendi	R. Vance	G. Quintero	A. Pickett	J. Beauregard	F. Machado
ANA	Anahuac	81	Tiki-Taka	4-3-3	No Instruction	Shorter	Work Ball Into Box	Be More Disciplined	Be More Expressive	Play for Set Pieces	Sometimes	Counter-Press	Hold Shape	Short	Higher	Higher	Step Up	Stay On Feet	R. Rosario	J. Salamanca	C. Montoya	E. Arenas [+]	J. Vera	E. Luna	O. Pérez [+]	Á. Fernandez	R. Zapatero [*]	A. Villa	S. Guzmán	C. Acosta	J. Valencia	L. Rivas	O. Vico	A. Garza
SKJ	Skjarnland	77	Balanced	4-4-2	Pass Into Space	Standard	Work Ball Into Box	Run At Defence	No Instruction	Play for Set Pieces	Never	No Instruction	Counter	Long	Higher	Standard	No Instruction	No Instruction	M. Andersson	K. Haugland	E. Hansen	O. Sjöberg [+]	L. Johansson	V. Tvedt	J. Olsen	A. Lundqvist [+]	S. Karlsson	H. Solberg [+]	P. Larsen	N. Nyquist	B. Eriksson	T. Kvamme	R. Pedersen	F. Wallin
GEN	Genosa	77	Counter	4-1-2-1-2	Play Out of Defence	Shorter	Work Ball Into Box	No Instruction	Be More Expressive	No Instruction	Never	Regroup	Counter	Short	Standard	Standard	No Instruction	Stay On Feet	M. Nagy [+]	Z. Váradi	L. Kovács	B. Zsolnay	G. Tóth	A. Hegedűs	P. Szabó [*]	I. Kárpáti	D. Varga	F. Csikós	V. Szilágyi [+]	K. Bátori	J. Németh	T. Almási	R. Farkas	S. Kiss
RUD	Rudania	76	Counter	5-3-2	Pass Into Space	More Direct	No Instruction	No Instruction	Be More Disciplined	Play for Set Pieces	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Get Stuck In	I. Ivanov	V. Krestovsky	S. Smirnov	T. Oorzhak [+]	A. Razumovsky	M. Popov	K. Zvezdinsky [+]	N. Ayusheev	D. Kuznetsov [*]	E. Pobedonostsev	P. Sokolov	R. Safin	F. Chistyakov	I. Novikov	L. Vronsky	O. Yudin
NKI	Kinshū	76	Gegenpress	4-1-4-1	Pass Into Space	More Direct	No Instruction	Run At Defence	Be More Expressive	Play for Set Pieces	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	Drop Off	No Instruction	D. Dhamarrandji [+]	K. Ikeda	G. Munyarryun	A. Gurruwiwi	N. Jungarrayi	O. Matsumoto [+]	L. Mununggurr	H. Tjapaltjarri	B. Wunungmurra	J. Kurosawa	M. Jakamarra [+]	F. Dhurrkay	P. Tjungurrayi	E. Matsumoto	R. Kngwarreye	I. Goto
VER	The Verdanie	75	Gegenpress	4-3-3	No Instruction	Standard	No Instruction	Run At Defence	Be More Expressive	Play for Set Pieces	Never	Counter-Press	Counter	Short	Much Higher	Higher	Step Up	No Instruction	J. Duplessie	M. St. Laurent	C. Beaubari [+]	J. Montecard [+]	M. Pelletier	C. Roy	E. Floranco	M. Dubois [+]	E. Caracciolo	L. Kuzumaki	G. Belkacem	T. Breville	S. Morand	P. Rousseau	L. Vacherot	G. Alexandre
SEL	Selmira	74	Counter	4-1-4-1	No Instruction	More Direct	Shoot On Sight	Run At Defence	Be More Expressive	Play for Set Pieces	Sometimes	Counter-Press	Counter	No Instruction	Higher	Standard	No Instruction	Get Stuck In	A. Aydın [+]	T. Kenaanoğlu	E. Polat	S. Sayda	M. Doğan	V. Surlu	Y. Koç	C. Kartaca	O. Çetin [+]	B. Balyoz	H. Şen	D. Asur	K. Bulut	I. Fenik	F. Kaplan	Z. Tarık
CAL	Calveria	74	Balanced	4-4-2	No Instruction	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Get Stuck In	J. Miller	T. Yazzie	E. Harrison	M. Tsosie	C. Caldwell	A. Begay	W. Gallagher [+]	D. Benally	K. Nakai	L. Nez	H. Peshlakai [+]	P. Chee	N. Jennings	S. Davis	V. Brooks	R. Preston
PON	Ponurvia	73	Gegenpress	4-3-3	Pass Into Space	Standard	Shoot On Sight	Be More Disciplined	Be More Expressive	Play for Set Pieces	Never	Counter-Press	Hold Shape	No Instruction	Much Higher	Standard	Offside Trap	Stay On Feet	M. Mollenhauer	J. Wanamaker	L. Bopp	T. Zartmann	E. Snyder	D. Fassbender	C. Neitzel	A. Rittenhouse [+]	S. Stracke	W. Giesel [+]	R. Schlösser	K. Eckert	N. Custer	P. Hoffmeister	H. Kinkeldey	V. Scherer
LEC	Lechia	70	Balanced	4-3-3	No Instruction	Standard	No Instruction	No Instruction	Be More Disciplined	Play for Set Pieces	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Get Stuck In	P. Nowak	K. Niezgoda	M. Kowalski	B. Jastrzębski	J. Wiśniewski	T. Dziedzic [+]	S. Wójcik	R. Gołębiowski	A. Kaczmarek [+]	Z. Krzyżanowski	G. Brzęczyszczykiewicz	W. Wilczyński	K. Szymański	M. Czarnecki	J. Kamiński	T. Żelechowski
SID	Sidanya	69	Balanced	4-2-3-1	Pass Into Space	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	No Instruction	Counter	No Instruction	Standard	Standard	No Instruction	No Instruction	O. Shevchenko	V. Nalyvaiko	I. Kovalenko	Y. Kryvonis	N. Melnyk	M. Holoborodko	T. Bondarenko	D. Perebyinis [+]	A. Tkachenko	K. Vernydub	S. Boyko	B. Skoropadsky	O. Kravchenko	P. Dovzhenko	I. Moroz	L. Chornovil
GUA	Guandong	69	Tiki-Taka	3-4-1-2	Play Out of Defence	Shorter	No Instruction	Be More Disciplined	Be More Disciplined	No Instruction	Sometimes	Counter-Press	Hold Shape	Short	Higher	Higher	Step Up	Stay On Feet	Z. Wang	X. Qiao	Y. Li	H. Kong	Q. Zhang	B. Yan	W. Zhao	F. Ji [+]	L. Hao	C. Pei	G. Sun	T. Meng	S. Guo	J. Chai	Y. Ma	D. Jia
VKT	Kemet	68	Balanced	4-2-3-1	No Instruction	Standard	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	No Instruction	Standard	Standard	Drop Off	Stay On Feet	B. Shenouda	G. Salvago	R. Makram	L. Moscatelli	P. Tawadros	N. Rossano	Y. Ghattas	F. Noseda	M. Mina	V. Piromalli [+]	S. Doss	M. Loria	T. Bishoy	E. Zanon	W. Fakhry	C. Baliano
VAR	Varahmehr	67	Wing Play	4-3-3	Pass Into Space	More Direct	No Instruction	Run At Defence	No Instruction	No Instruction	Never	Regroup	Counter	Long	Standard	Standard	Drop Off	Get Stuck In	V. Lorestani	E. Dehghan	A. Danesh	P. Tahmasb	T. Hayaii	R. Khalili	M. Sahat	S. Mehrian	A. Mahdavi	S. Shakibaii	P. Nazeri [+]	C. Nassirian	E. Rastkar	M. Shahi	S. Bozorgi	K. Rezghi
SGD	Seignid	67	Balanced	4-4-2	No Instruction	Standard	No Instruction	Run At Defence	No Instruction	No Instruction	Sometimes	Regroup	Counter	No Instruction	Standard	Standard	No Instruction	Stay On Feet	R. Agbayani	T. Batumbakal	N. Catacutan	L. Dimayuga	S. Gatmaitan	H. Halili	K. Ilagan	P. Kalaw	M. Liwanag [+]	J. Macaraeg	C. Nacpil	F. Panganiban	V. Salonga	A. Tapang	E. Umali	D. Yabut
GIA	Giathka	67	Counter	4-2-3-1	Pass Into Space	More Direct	Work Ball Into Box	Be More Disciplined	No Instruction	Play for Set Pieces	Sometimes	Regroup	Counter	Long	Standard	Standard	Drop Off	Get Stuck In	S. Volkov	R. Stepanov	D. Belov	M. Fedorov	A. Orlov	U. Yusupov	N. Lebedev	B. Vinogradov	I. Morozov	T. Rahimov	V. Polyakov [+]	O. Makarov	K. Kozlov	Y. Bogdanov	P. Egorov	G. Voronov
FUR	Furan	67	Counter	4-1-4-1	Pass Into Space	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Stay On Feet	Y. Chen	L. Wu	J. Shen	X. Qian [+]	M. Xiong	H. Peng	F. Lu	Q. Zhu	T. Gu	S. Huang	W. Mao	R. Deng	B. Ye	Z. Fang	K. Tan	N. Jiang
POL	Polabiny	66	Counter	4-4-2	Pass Into Space	More Direct	No Instruction	No Instruction	Be More Disciplined	Play for Set Pieces	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Get Stuck In	J. Svoboda	M. Skočdopole	L. Kučera	P. Kratochvíl	D. Tóth	V. Zlatohlavý	S. Veselý	R. Vohánka	T. Horváth	A. Nejezchleb	K. Černý [+]	E. Valach	F. Novotný	Z. Bezruč	O. Varga	H. Pospíšil
LIV	Livonia	66	Counter	4-1-4-1	No Instruction	More Direct	No Instruction	No Instruction	Be More Disciplined	Play for Set Pieces	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Get Stuck In	A. Berg	H. von Buxhoeveden	M. Müller	E. Tiesenhausen	J. Hermann	R. von Ungern [+]	L. Becker	W. Wrangell	F. Meyer	O. Manteuffel	P. Schmidt	K. Stackelberg	D. Hoffmann	G. Vietinghoff	S. Schultz	V. Krusenstern
CAH	Cahaya	66	Wing Play	3-4-3	Pass Into Space	Standard	No Instruction	Run At Defence	Be More Expressive	No Instruction	Sometimes	Counter-Press	Counter	No Instruction	Higher	Standard	No Instruction	Stay On Feet	R. Wijaya	L. Kitingan	T. Setiawan [+]	P. Jugah	A. Ginting	S. Madius	W. Wibowo	E. Bansa	M. Djelantik	K. Kurup	D. Siregar	G. Parengkuan	H. Mutang	V. Sastrowardoyo	N. Panggabean	C. Kulleh
SHI	Shivon	65	Counter	4-2-3-1	Pass Into Space	Standard	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	No Instruction	Standard	Lower	Drop Off	Stay On Feet	Y. Cohen	A. Bar-Lev	T. Mizrahi	N. Tzur	O. Levi	S. Even-Khen	E. Peretz [+]	M. Shaked	R. Biton	D. Alon	G. Dahan	I. Avni	L. Agam	Z. Peled	H. Friedman	B. Ben-Ami
AST	East Astriya	65	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	No Instruction	N. Papadopoulos	K. Paleologos	A. Georgiou	S. Lykoudis	V. Nikolaou	E. Mavromatis	P. Karagiannis [+]	T. Zervas	D. Vlahos	M. Galanis	I. Christodoulou	Y. Athanasiadis	G. Grivas	O. Katsaros	X. Samaras	C. Angelopoulos
ATK	Tonkin	63	Counter	4-1-4-1	Pass Into Space	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Stay On Feet	J. Nguyen [+]	M. Ton That	P. Le	C. Khuat	D. Tran	F. Doan	L. Vu	A. Thach	S. Pham	E. Trieu	V. Ngo	R. Mach	G. Bui	H. Luong	T. Dang	B. Quach
THO	The Thorne	62	Balanced	4-3-3	No Instruction	Standard	No Instruction	No Instruction	Be More Expressive	No Instruction	Sometimes	No Instruction	Counter	No Instruction	Standard	Standard	No Instruction	Stay On Feet	O. Popescu	T. Zburătoru	M. Ionescu	C. Codreanu	I. Radu	V. Lăutaru	D. Dumitrescu	L. Bucur	S. Stan	E. Botezatu	G. Stoica	R. Fieraru	N. Munteanu	F. Porumbescu	P. Gheorghiu	O. Văduva
PER	Perovska	62	Counter	4-4-2	Pass Into Space	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Get Stuck In	E. Karpov	S. Andreev	G. Nikitin	O. Mamut	L. Gusev	K. Zaytsev	R. Titov	D. Kenzhebayev	M. Kulikov	A. Turghun	F. Frolov	V. Markov	I. Baranov	N. Shirokov	T. Tarasov	P. Denisov
ASP	South Pelagonia	62	Tiki-Taka	4-3-3	Play Out of Defence	Shorter	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Counter-Press	Hold Shape	Short	Higher	Higher	No Instruction	Stay On Feet	J. Dlamini	C. Buthelézi	M. Ndlovu	J. Mocoéna	E. Khumalo	V. Zoulou	P. Modisé	L. Du Phiri	S. Chabalala	R. Khouza	R. Mbeki	D. Sisoulou	F. Hadebé	G. Nhlapo-Marais	H. Bhéngu	O. Makhanya
ANH	Neuhollmar	62	Balanced	4-4-2	No Instruction	More Direct	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Get Stuck In	T. Schmidt	J. Rangitāne	K. Mueller	F. Te Rangi	R. Hoffmann	H. Wihongi	M. Becker	A. von Haast	W. Meyer	E. Waititi	P. Rata	G. Tipene	N. Wagner	L. Ihimaera	A. Dieffenbach	O. Kereopa
ABB	Barbary	61	Gegenpress	3-4-3	Pass Into Space	Standard	Shoot On Sight	Run At Defence	No Instruction	No Instruction	Never	Counter-Press	Counter	No Instruction	Much Higher	Higher	Step Up	Get Stuck In	H. Benali	T. Djaballah	S. Mansouri	A. Aggoun	M. Bensalem	F. Kateb	O. Rahmani	C. Guerroudj	K. Idir	L. Meziane	B. Hamraoui	L. Renard	K. Benfodil	G. Fabre	O. Mebarki	A. Picard
RCO	Costaserá	60	Counter	4-1-4-1	Pass Into Space	Standard	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	No Instruction	Standard	Lower	Drop Off	Stay On Feet	Y. Benali	M. El Andaloussi	A. Berrada	H. Medina	B. Chraibi	T. Amrani	S. Torres	N. Mansouri	O. El Fassi	K. Alami	I. Morón	Y. Zeroual	B. Oufkir	I. Messaoudi	T. Benjumeda	S. Lahlou
MOR	Morozia	60	Counter	5-3-2	No Instruction	More Direct	No Instruction	No Instruction	Be More Disciplined	Play for Set Pieces	Constantly	Regroup	Counter	Long	Lower	Lower	Drop Off	Get Stuck In	A. Ahmaogak	M. Makaroff	P. Ipalook	I. Gromoff	E. Nageak	S. Krukoff	K. Kadashan	V. Tarakanoff	N. Oyagak	D. Lestenkof	L. Kignak	T. Bereskin	R. Naneng	Y. Galaktionoff	F. Ayagalria	M. Katchatag
AWB	West Bangala	60	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Stay On Feet	K. Rahman	L. Chowdhury	E. Islam	J. Hossain	C. Ahmed	M. Hasan	F. Miah	D. Sikder	V. Talukder	P. Bhuiyan	R. Khandaker	S. Majumder	N. Haque	G. Das	T. Barua	I. Kazi
ARU	Arunya	58	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Stay On Feet	T. Annamalai	K. Gunawardena	S. Thiruvengadam	V. Arulampalam	M. Shivaswamy	A. Dissanayake	R. Unnithan	O. Venkataraman	B. Garlett	D. Thuraisingam	N. Madhavan	G. Hegde	H. Amarasinghe	J. Krishnamurthy	E. Arunachalam	W. Bropho
AEK	East Kaukasos	58	Counter	4-4-2	Pass Into Space	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Get Stuck In	N. Nadaraia	A. Aghababyan	T. Bakhshiyev	O. Tvalchrelidze	V. Manukyan	M. Karimli	D. Sulaberidze	S. Ohanian	R. Verdiyev	B. Garnier	C. Chalikyan	D. Khutsishvili	E. Piriyev	V. Bedrossian	Y. Mercier	Z. Tvildiani
ADV	Divia	58	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	No Instruction	Play for Set Pieces	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	No Instruction	K. Janabi	A. Doski	T. Mutairi	O. Bayati	M. Nerweyi	S. Azzawi	R. Enezi	B. Khafaji	V. Kohlmann	R. Barzani	P. Rekabi	H. Rashidi	J. Barwari	G. Musawi	W. Pfeiffer	X. Hawrami
RAN	Anticostia	57	Balanced	4-4-2	No Instruction	More Direct	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Get Stuck In	A. Debassige	F. Varela	G. Wemigwans	D. Obomsawin	M. Herrera	K. Nottaway	E. Wagamese	J. Fonseca	C. Papatie	N. Nadjiwon	B. Manitowabi	P. Pedrosa	H. Tenasco	O. Panadis	L. Kakepetum	I. Wawanolet
NHO	Hōrai	56	Balanced	4-4-2	Pass Into Space	More Direct	No Instruction	Run At Defence	Be More Expressive	Play for Set Pieces	Sometimes	Counter-Press	Counter	Long	Higher	Standard	Drop Off	No Instruction	I. Tarafdar	B. Larma	P. Chakma	R. Mridha	A. Tripura	M. Sangma	S. Murmu	W. Naqvi	N. Fujikawa	K. Nagase	T. Howlader	E. Patwary	O. Bepari	D. Pramanik	Z. Soren	G. Marak
AXE	Axerfreditenshin	56	Balanced	4-4-2	Pass Into Space	More Direct	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	Counter	Long	Standard	Standard	No Instruction	Get Stuck In	B. Bat-Erdene	Y. Ma	D. Dorzhiev	N. Chimeddorj	H. Ha	G. Badmaev	T. Gantulga	I. Mu	R. Tsydypov	E. Tsendbaatar	K. Ding	S. Munkoev	A. Lkhagvadorj	M. Bai	O. Gombojav	J. Na
AKG	Kogelland	55	Tiki-Taka	4-4-2	Play Out of Defence	Shorter	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Counter-Press	Hold Shape	Short	Higher	Standard	No Instruction	Stay On Feet	A. Calfuqueo	D. Brunner	N. Ñanculef	G. Verhoeven	C. Cayupán	L. Painemal	W. Sayhueque	P. Hoekstra	M. Tripailaf	O. Inacayal	I. Loncón	H. Zimmermann	K. Quidel	T. Quilaqueo	F. Huenchullán	E. Panguilef
AED	Dämmerung Islands	55	Balanced	4-3-3	No Instruction	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	No Instruction	No Instruction	No Instruction	Standard	Standard	No Instruction	No Instruction	K. Kanakaole	G. Van Leeuwen	N. Kealoha	A. Steiner	I. Makoa	U. Piipiilani	P. Nainoa	D. Mulder	H. Kahananui	E. Pokipala	L. Kekoa	W. Kooijman	M. Kinimaka	F. Mahoe	O. Naone	J. Kupihea
ACS	Côte de Saumon	54	Gegenpress	4-3-3	Pass Into Space	Standard	No Instruction	Run At Defence	No Instruction	No Instruction	Never	Counter-Press	Counter	No Instruction	Much Higher	Higher	Step Up	Get Stuck In	I. Galadima	A. Dikko	B. Dalori	M. Lefèvre	S. Turaki	N. Maina	O. Jalo	E. Fontaine	Y. Dattijo	K. Mainasara	G. Magaji	T. Tafida	H. Barry	R. Ingawa	U. Yakasai	L. Zanna
GUP	Uj-Pannonia	52	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Stay On Feet	P. Hazarika	K. Basumatary	G. Molnár	R. Gogoi	S. Narzary	L. Balogh	M. Payeng	H. Saikia	T. Lakatos	A. Bhuyan	D. Teron	F. Papp	N. Konwar	J. Brahma	U. Mahanta	B. Rajkhowa
ENR	Noradia	52	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	Stay On Feet	B. Mohapatra	S. Markam	F. Tirkey	R. Cavendish	K. Rath	G. Hansda	A. Bamford	L. Hembrom	D. Soren	N. Senapati	M. Patnaik	P. Toppo	J. Lakra	T. Khuntia	H. Netam	C. Forsyth
SSA	Southeast Aphirica	48	Balanced	4-4-2	No Instruction	More Direct	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	Long	Standard	Standard	No Instruction	No Instruction	D. Akol	T. Tikima	B. Chuol	M. Shapira	A. Madut	G. Hoth	W. Lual	U. Katz	N. Thon	F. Gbaduma	P. Gatluak	Y. Toledano	R. Majok	J. Gony	O. Azoulay	L. Nhial
ANB	Napolyon Bonparterre Islands	48	Wing Play	3-4-3	Pass Into Space	Standard	No Instruction	Run At Defence	Be More Expressive	No Instruction	Sometimes	No Instruction	Counter	No Instruction	Standard	Standard	No Instruction	Stay On Feet	J. Gonelevu	M. Singh	S. Seruvakula	A. Moreau	N. Tikoisuva	I. Titifanue	E. Leweniqila	T. Thibault	V. Latianara	R. Narayan	K. Rigamoto	Y. Lacroix	P. Naivalu	W. Ravuiwasa	D. Koroi	U. Veitayaki
AKN	Kienam	44	Counter	4-1-4-1	No Instruction	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Sometimes	Regroup	Counter	Long	Lower	Lower	Drop Off	Get Stuck In	N. Tikana	A. Kaviu	V. To Ngala	F. Steiner	T. Turuk	G. Vunairoto	S. Vatom	J. Navrátil	M. Tamate	O. Berger	R. Simet	L. Růžička	D. Vunamami	P. Pondros	B. To Warai	W. Nonga
ENC	New Celyddon	43	Wing Play	3-4-3	Pass Into Space	Standard	No Instruction	Run At Defence	Be More Expressive	No Instruction	Sometimes	No Instruction	Counter	No Instruction	Standard	Standard	No Instruction	Stay On Feet	W. Bwemara	S. Lagivaka	K. Hnamano	D. MacKenzie	N. Naisseline	F. Vailala	P. Kabar	R. Sutherland	M. Löpwi	T. Peato	J. Paoume	A. Campbell	H. Tanéouya	G. Waia	E. Tein	Y. Yaka
KKM	Kullanmaan	42	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	No Instruction	O. Hætta	E. Sateräkki	S. Krusinen	B. Tuuliparänen	J. Urujärven	T. Kuutemben	P. Amarainen	L. Vesijärven	F. Kulanen	T. Poule	V. Turkunen	T. Bonkonen	S. Grigoroff	E. Guovžžanen	O. Sieidala	L. Hitalainen
AGN	Gonenite Islands	42	Balanced	4-4-2	No Instruction	Standard	No Instruction	No Instruction	No Instruction	No Instruction	Sometimes	Regroup	No Instruction	No Instruction	Standard	Standard	No Instruction	No Instruction	J. Nanau	T. Meka	H. Kabutaulaka	E. Kessler	M. Tanangada	B. Taupongi	K. Hartmann	N. Suifua	A. Taloikwao	W. Steinberg	P. Iroga	G. Wanefiori	S. Kiloe	F. Boseto	R. Teika	O. Sisiolo
VAN	Aphirica del Nord	41	Counter	5-3-2	No Instruction	More Direct	No Instruction	Be More Disciplined	Be More Disciplined	Play for Set Pieces	Sometimes	Regroup	Counter	Long	Standard	Lower	Drop Off	Get Stuck In	C. Gbanou	M. Ngaradoumbé	E. Amato	R. Yakété	K. Kobanda	G. Mancini	P. Guébré	O. Borkono	N. Nakombo	A. Maïna	B. Wongo	S. Sorrentino	T. Mandaba	I. Gali	F. Mobele	L. Yangongo
AAD	Andam Islands	39	Counter	4-3-2-1	No Instruction	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Constantly	Regroup	Counter	Long	Lower	Lower	Drop Off	Get Stuck In	N. Patchila	S. Htoo	E. Totanange	M. Beneš	P. Atong	G. Sedláček	B. Ponge	I. Nanlong	D. Paw	J. Fischer	K. Chari	C. Melong	T. Moo	R. Zelenka	F. Telong	A. Enam
ASG	Sankt Gerold Island	38	Counter	4-3-2-1	No Instruction	More Direct	No Instruction	No Instruction	Be More Disciplined	No Instruction	Constantly	Regroup	Counter	Long	Lower	Lower	Drop Off	Get Stuck In	H. Kogoya	S. Rumbekwan	W. Pakage	J. Brouwer	I. Wetipo	A. Klafle	N. Wanimbo	P. Van Dam	E. Desap	Y. Tekege	D. Imbiri	F. Hendriks	O. Biwar	G. Mandosir	B. Wandik	M. Mote
KFK	Frederikka Islands	28	Wing Play	4-1-2-1-2	Pass Into Space	More Direct	Work Ball Into Box	Run At Defence	Be More Expressive	Play for Set Pieces	Never	Regroup	Counter	Long	Standard	Lower	Drop Off	Stay On Feet	A. Raivo	P. Shomponen	T. Pacaka	N. Apngan	E. Samāyan	N. Laranyal	V. Chōna	R. Ātlaköneinen	P. Suursaaren	D. Lâchūaton	O. Marvinen	J. Hosea	A. Rani	I. Hatamaaen	T. Ranghonen	E. Fāpen`;
const PRESET_AVIUM = parseBulk(PRESET_AVIUM_TSV);
const PRESET_EUR = [
{ code: "BAY", name: "Bayern Munich", skill: 87, style: "gegenpress", formation: "4-2-3-1", strategy: { approachPlay: -1, chanceCreation: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 2, dlBehavior: 2 }, squad: buildSquad("4-2-3-1", ['M. Neuer', 'A. Davies', 'D. Upamecano', 'J. Tah', 'J. Kimmich', 'A. Pavlovic', 'K. Laimer', 'Luis Díaz', 'J. Musiala', 'M. Olise', 'H. Kane', 'J. Urbig', 'Min-jae Kim', 'L. Goretzka', 'T. Bischof', 'N. Jackson']) },
{ code: "PSG", name: "Paris Saint-Germain", skill: 87, style: "balanced", formation: "4-3-3", strategy: { approachPlay: -1, passingDir: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-3-3", ['L. Chevalier', 'N. Mendes', 'W. Pacho', 'I. Zabarnyi', 'A. Hakimi', 'Vitinha', 'J. Neves', 'W. Zaïre-Emery', 'K. Kvaratskhelia', 'G. Ramos', 'O. Dembélé', 'M. Safonov', 'Marquinhos', 'F. Ruiz', 'B. Barcola', 'R. Kolo Muani']) },
{ code: "BAR", name: "FC Barcelona", skill: 86, style: "tikitaka", formation: "4-3-3", strategy: { approachPlay: -1, passingDir: -2, chanceCreation: -1, creativity: -1, timeWasting: 1, possLost: 1, possWon: -1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: -1 }, squad: buildSquad("4-3-3", ['J. García', 'A. Balde', 'P. Cubarsí', 'R. Araujo', 'J. Koundé', 'Gavi', 'M. Casadó', 'Pedri', 'Raphinha', 'R. Lewandowski', 'L. Yamal', 'W. Szczęsny', 'E. García', 'F. de Jong', 'D. Olmo', 'M. Rashford']) },
{ code: "MCI", name: "Manchester City", skill: 86, style: "tikitaka", formation: "4-3-3", strategy: { approachPlay: -1, passingDir: -2, chanceCreation: -1, dribbling: -1, creativity: -1, timeWasting: 1, possLost: 1, possWon: -1, gkDist: -1, pressingLOE: 2, defLine: 2, dlBehavior: 1, tackling: -1 }, squad: buildSquad("4-3-3", ['G. Donnarumma', 'J. Gvardiol', 'M. Guéhi', 'R. Dias', 'R. Lewis', 'M. Kovačić', 'Rodri', 'T. Reijnders', 'P. Foden', 'E. Haaland', 'J. Doku', 'J. Trafford', 'J. Stones', 'R. Cherki', 'N. González', 'A. Semenyo']) },
{ code: "LIV", name: "Liverpool", skill: 86, style: "gegenpress", formation: "4-3-3", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: 1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("4-3-3", ['Alisson', 'M. Kerkez', 'V. Van Dijk', 'I. Konaté', 'J. Frimpong', 'A. Mac Allister', 'R. Gravenberch', 'D. Szoboszlai', 'C. Gakpo', 'A. Isak', 'M. Salah', 'G. Mamardashvili', 'J. Gomez', 'C. Jones', 'F. Wirtz', 'H. Ekitike']) },
{ code: "RMA", name: "Real Madrid", skill: 85, style: "counterattack", formation: "4-3-3", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, creativity: 1, possWon: 1, gkDist: 1, pressingLOE: 1, defLine: 1 }, squad: buildSquad("4-3-3", ['T. Courtois', 'Á. Carreras', 'A. Rüdiger', 'É. Militão', 'T. Alexander-Arnold', 'E. Camavinga', 'A. Tchouaméni', 'F. Valverde', 'Vinícius Jr.', 'K. Mbappé', 'Rodrygo', 'A. Lunin', 'D. Huijsen', 'Jude Bellingham', 'A. Güler', 'Endrick']) },
{ code: "ARS", name: "Arsenal", skill: 85, style: "counterattack", formation: "4-3-2-1", strategy: { approachPlay: -1, passingDir: -1, chanceCreation: -1, dribbling: -1, creativity: -1, setPieces: 1, timeWasting: 2, possLost: -1, gkDist: -1, pressingLOE: -2, defLine: -2, dlBehavior: -1, tackling: -1 }, squad: buildSquad("4-3-2-1", ['D. Raya', 'R. Calafiori', 'Gabriel', 'W. Saliba', 'B. White', 'M. Merino', 'M. Zubimendi', 'D. Rice', 'M. Ødegaard', 'B. Saka', 'V. Gyökeres', 'K. Arrizabalaga', 'J. Timber', 'K. Havertz', 'G. Martinelli', 'E. Eze']) },
{ code: "CHE", name: "Chelsea", skill: 84, style: "balanced", formation: "4-2-3-1", strategy: { approachPlay: -1, passingDir: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-2-3-1", ['F. Jörgensen', 'M. Cucurella', 'L. Colwill', 'J. Hato', 'R. James', 'M. Caicedo', 'E. Fernández', 'P. Neto', 'C. Palmer', 'Estêvão', 'J. Pedro', 'R. Sánchez', 'M. Gusto', 'R. Lavia', 'D. Essugo', 'J. Gittens']) },
{ code: "INT", name: "Inter Milan", skill: 84, style: "balanced", formation: "3-5-2", strategy: { approachPlay: -1, creativity: 1, timeWasting: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("3-5-2", ['J. Martínez', 'C. Augusto', 'A. Bastoni', 'Y. Bisseck', 'M. Akanji', 'D. Dumfries', 'P. Zieliński', 'N. Barella', 'P. Sučić', 'Lautaro Martínez', 'M. Thuram', 'A. Calligaris', 'T. Palacios', 'D. Frattesi', 'L. Henrique', 'P. Esposito']) },
{ code: "MUN", name: "Manchester United", skill: 83, style: "counterattack", formation: "4-2-3-1", strategy: { approachPlay: 1, passingDir: 2, chanceCreation: 1, dribbling: 1, creativity: 1, possWon: 1, gkDist: 1, pressingLOE: 1 }, squad: buildSquad("4-2-3-1", ['Andre Onana', 'P. Dorgu', 'Lisandro Martínez', 'M. De Ligt', 'D. Dalot', 'K. Mainoo', 'M. Ugarte', 'B. Mbeumo', 'B. Fernandes', 'M. Cunha', 'B. Šeško', 'A. Bayındır', 'L. Yoro', 'Éderson', 'M. Mount', 'A. Diallo']) },
{ code: "NAP", name: "Napoli", skill: 83, style: "balanced", formation: "4-3-3", strategy: { approachPlay: -1, passingDir: -1, chanceCreation: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-3-3", ['V. Milinković-Savić', 'M. Gutiérrez', 'A. Buongiorno', 'S. Beukema', 'G. Di Lorenzo', 'S. McTominay', 'B. Gilmour', 'K. De Bruyne', 'A. Santos', 'R. Højlund', 'D. Neres', 'A. Meret', 'A. Rrahmani', 'F. Anguissa', 'M. Politano', 'R. Lukaku']) },
{ code: "BVB", name: "Borussia Dortmund", skill: 82, style: "gegenpress", formation: "4-2-3-1", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: 1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("4-2-3-1", ['G. Kobel', 'D. Svensson', 'N. Schlotterbeck', 'W. Anton', 'Y. Couto', 'F. Nmecha', 'E. Can', 'K. Adeyemi', 'J. Brandt', 'M. Beier', 'S. Guirassy', 'A. Meyer', 'N. Süle', 'M. Sabitzer', 'Jobe Bellingham', 'F. Silva']) },
{ code: "ATM", name: "Atlético Madrid", skill: 82, style: "counterattack", formation: "5-3-2", strategy: { approachPlay: 1, passingDir: 1, creativity: -1, timeWasting: 2, possLost: -1, possWon: 1, gkDist: 1, defLine: -1, dlBehavior: -1, tackling: 1 }, squad: buildSquad("5-3-2", ['J. Oblak', 'M. Ruggeri', 'D. Hancko', 'J. Giménez', 'R. Le Normand', 'M. Llorente', 'P. Barrios', 'J. Cardoso', 'Á. Baena', 'J. Álvarez', 'A. Lookman', 'J. Musso', 'M. Pubill', 'Koke', 'T. Almada', 'A. Sørloth']) },
{ code: "TOT", name: "Tottenham Hotspur", skill: 82, style: "gegenpress", formation: "4-3-3", strategy: { approachPlay: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 2, dlBehavior: 2 }, squad: buildSquad("4-3-3", ['G. Vicario', 'A. Robertson', 'M. Van de Ven', 'C. Romero', 'P. Porro', 'Y. Bissouma', 'J. Palhinha', 'J. Maddison', 'M. Kudus', 'D. Solanke', 'X. Simons', 'A. Kinský', 'M. Senesi', 'C. Gallagher', 'P. Sarr', 'M. Tel']) },
{ code: "NEW", name: "Newcastle United", skill: 82, style: "counterattack", formation: "4-3-3", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, creativity: 1, setPieces: 1, possLost: 1, possWon: 1, gkDist: 1, pressingLOE: 1, defLine: 1, tackling: 1 }, squad: buildSquad("4-3-3", ['N. Pope', 'L. Hall', 'M. Thiaw', 'D. Burn', 'T. Livramento', 'Joelinton', 'B. Guimarães', 'S. Tonali', 'H. Barnes', 'N. Woltemade', 'A. Elanga', 'M. Gillespie', 'S. Botman', 'L. Miley', 'A. Ramsey', 'Y. Wissa']) },
{ code: "B04", name: "Bayer Leverkusen", skill: 81, style: "balanced", formation: "3-4-3", strategy: { approachPlay: -1, passingDir: -1, chanceCreation: -1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1 }, squad: buildSquad("3-4-3", ['M. Flekken', 'E. Tapsoba', 'L. Badé', 'J. Quansah', 'A. Grimaldo', 'Equi Fernández', 'E. Palacios', 'L. Vázquez', 'E. Ben Seghir', 'P. Schick', 'M. Tillman', 'J. Omlin', 'T. Oermann', 'R. Andrich', 'I. Maza', 'V. Boniface']) },
{ code: "AVL", name: "Aston Villa", skill: 81, style: "balanced", formation: "4-2-3-1", strategy: { approachPlay: 1, chanceCreation: -1, creativity: 1, timeWasting: 1, possLost: -1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 2 }, squad: buildSquad("4-2-3-1", ['E. Martínez', 'I. Maatsen', 'P. Torres', 'E. Konsa', 'M. Cash', 'Amadou Onana', 'B. Kamara', 'J. Sancho', 'J. McGinn', 'L. Bailey', 'O. Watkins', 'M. Bizot', 'V. Lindelöf', 'Y. Tielemans', 'D. Luiz', 'T. Abraham']) },
{ code: "MIL", name: "AC Milan", skill: 81, style: "balanced", formation: "4-2-3-1", strategy: { approachPlay: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-2-3-1", ['M. Maignan', 'P. Estupiñán', 'S. Pavlović', 'K. De Winter', 'Z. Athekame', 'Y. Fofana', 'S. Ricci', 'R. Leão', 'C. Nkunku', 'C. Pulisic', 'S. Gimenez', 'P. Terracciano', 'M. Gabbia', 'A. Jashari', 'A. Rabiot', 'N. Füllkrug']) },
{ code: "JUV", name: "Juventus", skill: 81, style: "balanced", formation: "4-3-2-1", strategy: { approachPlay: -1, creativity: -1, timeWasting: 1, possLost: -1, possWon: 1, gkDist: -1 }, squad: buildSquad("4-3-2-1", ['M. Di Gregorio', 'A. Cambiaso', 'P. Kalulu', 'Bremer', 'E. Holm', 'K. Thuram', 'M. Locatelli', 'W. McKennie', 'K. Yıldız', 'T. Koopmeiners', 'L. Openda', 'M. Perin', 'F. Gatti', 'F. Miretti', 'F. Conceição', 'J. David']) },
{ code: "GS", name: "Galatasaray", skill: 81, style: "wingplay", formation: "4-2-3-1", strategy: { approachPlay: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: 1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-2-3-1", ['U. Çakır', 'I. Jakobs', 'W. Singo', 'D. Sánchez', 'R. Sallai', 'L. Torreira', 'G. Sara', 'B. Yılmaz', 'L. Sané', 'Y. Akgün', 'V. Osimhen', 'G. Güvenç', 'A. Bardakcı', 'İ. Gündoğan', 'Y. Asprilla', 'M. Icardi']) },
{ code: "RBL", name: "RB Leipzig", skill: 80, style: "gegenpress", formation: "4-2-3-1", strategy: { approachPlay: 1, passingDir: 1, chanceCreation: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: 1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("4-2-3-1", ['M. Vandevoordt', 'D. Raum', 'C. Lukeba', 'W. Orbán', 'R. Baku', 'Y. Diomande', 'A. Ouédraogo', 'N. Seiwald', 'C. Baumgartner', 'J. Bakayoko', 'Rômulo', 'P. Gulácsi', 'E. Bitshiabu', 'X. Schlager', 'B. Gruda', 'C. Harder']) },
{ code: "FB", name: "Fenerbahçe", skill: 80, style: "wingplay", formation: "4-4-2", strategy: { dribbling: 1, possWon: 1 }, squad: buildSquad("4-4-2", ['Ederson', 'A. Brown', 'M. Škriniar', 'R. Becão', 'N. Semedo', 'K. Aktürkoğlu', 'M. Guendouzi', 'E. Álvarez', 'M. Asensio', 'J. Durán', 'Talisca', 'D. Livaković', 'Ç. Söyüncü', 'İ. Yüksek', 'S. Amrabat', 'C. Tosun']) },
{ code: "ASM", name: "AS Monaco", skill: 79, style: "counterattack", formation: "4-2-3-1", strategy: { approachPlay: 1, passingDir: 1, chanceCreation: 1, dribbling: 1, creativity: 1, possWon: 1, gkDist: 1, pressingLOE: 1 }, squad: buildSquad("4-2-3-1", ['P. Köhn', 'C. Henrique', 'C. Mawissa', 'T. Kehrer', 'Vanderson', 'D. Zakaria', 'L. Camara', 'S. Adingra', 'A. Golovin', 'M. Akliouche', 'F. Balogun', 'L. Hradecky', 'M. Salisu', 'A. Bamba', 'T. Minamino', 'M. Biereth']) },
{ code: "OM", name: "Olympique de Marseille", skill: 79, style: "gegenpress", formation: "4-2-3-1", strategy: { approachPlay: -1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("4-2-3-1", ['G. Rulli', 'E. Palmieri', 'F. Medina', 'L. Balerdi', 'B. Pavard', 'P. Højbjerg', 'A. Vermeeren', 'I. Paixão', 'Q. Timber', 'M. Greenwood', 'P. Aubameyang', 'J. de Lange', 'N. Aguerd', 'G. Kondogbia', 'E. Nwaneri', 'A. Gouiri']) },
{ code: "CRY", name: "Crystal Palace", skill: 79, style: "counterattack", formation: "3-4-3", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, creativity: 1, possLost: -1, possWon: 1, gkDist: 1, tackling: 1 }, squad: buildSquad("3-4-3", ['D. Henderson', 'M. Lacroix', 'C. Richards', 'D. Muñoz', 'T. Mitchell', 'A. Wharton', 'C. Doucouré', 'I. Sarr', 'D. Kamada', 'Y. Pino', 'J. Mateta', 'W. Benítez', 'C. Riad', 'W. Hughes', 'J. Canvot', 'J. Strand Larsen']) },
{ code: "BHA", name: "Brighton & Hove Albion", skill: 79, style: "tikitaka", formation: "4-3-3", strategy: { approachPlay: -1, passingDir: -1, chanceCreation: -1, creativity: 1, possLost: 1, possWon: -1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1, tackling: -1 }, squad: buildSquad("4-3-3", ['B. Verbruggen', 'F. Kadıoğlu', 'O. Boscagli', 'L. Dunk', 'M. Wieffer', 'C. Baleba', 'P. Groß', 'Y. Ayari', 'K. Mitoma', 'G. Rutter', 'Y. Minteh', 'J. Steele', 'M. De Cuyper', 'J. Hinshelwood', 'J. Milner', 'C. Kostoulas']) },
{ code: "RSO", name: "Real Sociedad", skill: 78, style: "balanced", formation: "4-1-2-1-2", strategy: { approachPlay: -1, passingDir: -1, chanceCreation: -1, possLost: 1, possWon: -1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-1-2-1-2", ['A. Remiro', 'S. Gómez', 'J. Martín', 'I. Zubeldia', 'J. Aramburu', 'J. Gorrotxategi', 'Y. Herrera', 'L. Sučić', 'B. Méndez', 'T. Kubo', 'M. Oyarzabal', 'U. Marrero', 'D. Ćaleta-Car', 'C. Soler', 'A. Barrenetxea', 'O. Óskarsson']) },
{ code: "SCP", name: "Sporting CP", skill: 78, style: "balanced", formation: "3-4-3", strategy: { approachPlay: -1, passingDir: -1, chanceCreation: -1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("3-4-3", ['R. Silva', 'M. Araújo', 'G. Inácio', 'O. Diomande', 'Z. Debast', 'G. Quenda', 'M. Hjulmand', 'D. Bragança', 'P. Gonçalves', 'L. Suárez', 'F. Trincão', 'J. Virgínia', 'E. Quaresma', 'H. Morita', 'G. Catamo', 'F. Ioannidis']) },
{ code: "BRE", name: "Brentford", skill: 78, style: "counterattack", formation: "3-5-2", strategy: { approachPlay: 1, passingDir: 1, creativity: -1, setPieces: 1, possLost: -1, possWon: 1, gkDist: 1, pressingLOE: 1, tackling: 1 }, squad: buildSquad("3-5-2", ['C. Kelleher', 'K. Ajer', 'N. Collins', 'S. Van Den Berg', 'R. Henry', 'J. Henderson', 'V. Janelt', 'M. Jensen', 'M. Damsgaard', 'I. Thiago', 'K. Schade', 'H. Valdimarsson', 'A. Hickey', 'Y. Yarmolyuk', 'B. Kayode', 'D. Ouattara']) },
{ code: "BOU", name: "Bournemouth", skill: 78, style: "gegenpress", formation: "4-2-3-1", strategy: { approachPlay: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("4-2-3-1", ['Đ. Petrović', 'A. Truffert', 'B. Diakité', 'A. Jiménez', 'T. Adams', 'L. Cook', 'A. Scott', 'J. Kluivert', 'M. Tavernier', 'Evanilson', 'E. Kroupi', 'F. Forster', 'V. Milosavljevic', 'R. Christie', 'Rayan Vitor', 'J. Hill']) },
{ code: "NFO", name: "Nottingham Forest", skill: 78, style: "counterattack", formation: "4-2-3-1", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, setPieces: 1, timeWasting: 1, possLost: -1, possWon: 1, gkDist: 1, defLine: -1, dlBehavior: -1, tackling: 1 }, squad: buildSquad("4-2-3-1", ['M. Sels', 'Neco Williams', 'Murillo', 'N. Milenković', 'O. Aina', 'I. Sangaré', 'N. Domínguez', 'C. Hudson-Odoi', 'M. Gibbs-White', 'D. Ndoye', 'C. Wood', 'S. Ortega', 'Morato', 'E. Anderson', 'O. Hutchinson', 'I. Jesus']) },
{ code: "SLB", name: "SL Benfica", skill: 77, style: "balanced", formation: "4-2-3-1", strategy: { approachPlay: -1, passingDir: -1, chanceCreation: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-2-3-1", ['A. Trubin', 'R. Obrador', 'T. Araújo', 'A. Silva', 'A. Bah', 'F. Luís', 'E. Barrenechea', 'H. Sudakov', 'O. Kökçü', 'D. Lukébakio', 'V. Pavlidis', 'S. Soares', 'M. Silva', 'F. Aursnes', 'G. Prestianni', 'F. Ivanović']) },
{ code: "RCL", name: "RC Lens", skill: 77, style: "gegenpress", formation: "3-4-3", strategy: { approachPlay: -1, chanceCreation: -1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("3-4-3", ['R. Risser', 'M. Udol', 'M. Sarr', 'S. Baidoo', 'S. Abdulhamid', 'M. Sangaré', 'A. Haidara', 'R. Aguilar', 'A. Saint-Maximin', 'O. Édouard', 'F. Thauvin', 'M. Fortin', 'I. Ganiou', 'A. Thomasson', 'A. Sima', 'W. Saïd']) },
{ code: "FUL", name: "Fulham", skill: 77, style: "balanced", formation: "4-2-3-1", strategy: { approachPlay: -1, chanceCreation: -1, possLost: -1, possWon: 1, gkDist: -1, tackling: -1 }, squad: buildSquad("4-2-3-1", ['B. Leno', 'A. Robinson', 'J. Andersen', 'C. Bassey', 'T. Castagne', 'S. Berge', 'S. Lukić', 'A. Iwobi', 'E. Smith Rowe', 'H. Wilson', 'R. Jiménez', 'B. Lecomte', 'R. Sessegnon', 'J. King', 'S. Chukwueze', 'R. Muniz']) },
{ code: "SUN", name: "Sunderland", skill: 77, style: "gegenpress", formation: "4-3-3", strategy: { approachPlay: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 1, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-3-3", ['D. Roefs', 'Reinildo', 'O. Alderete', 'D. Ballard', 'N. Mukiele', 'E. Le Fée', 'G. Xhaka', 'N. Sadiki', 'H. Diarra', 'B. Brobbey', 'W. Isidor', 'K. Ellborg', 'T. Hume', 'L. Geertruida', 'C. Rigg', 'M. Talbi']) },
{ code: "EVE", name: "Everton", skill: 77, style: "balanced", formation: "4-4-2", strategy: { approachPlay: -1, creativity: -1, setPieces: 1, timeWasting: 1, possLost: -1, possWon: 1, gkDist: 1, tackling: 1 }, squad: buildSquad("4-4-2", ['J. Pickford', 'V. Mykolenko', 'J. Tarkowski', 'M. Keane', 'J. O\'Brien', 'J. Grealish', 'J. Garner', 'K. Dewsbury-Hall', 'I. Ndiaye', 'Beto', 'T. Barry', 'M. Travers', 'J. Branthwaite', 'T. Iroegbunam', 'I. Gueye', 'D. McNeil']) },
{ code: "PSV", name: "PSV Eindhoven", skill: 76, style: "gegenpress", formation: "4-2-3-1", strategy: { approachPlay: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-2-3-1", ['M. Kovar', 'Mauro Júnior', 'Y. Gasiorowski', 'R. Flamingo', 'S. Dest', 'J. Schouten', 'J. Veerman', 'R. van Bommel', 'I. Saibari', 'D. Man', 'R. Pepi', 'N. Olij', 'K. Sildillia', 'P. Wanner', 'G. Til', 'A. Pléa']) },
{ code: "AJA", name: "Ajax Amsterdam", skill: 76, style: "tikitaka", formation: "4-3-3", strategy: { approachPlay: -1, passingDir: -2, chanceCreation: -1, creativity: 1, possLost: 1, possWon: -1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: -1 }, squad: buildSquad("4-3-3", ['M. Paes', 'Y. Baas', 'J. Šutalo', 'K. Itakura', 'L. Rosa', 'Y. Regeer', 'J. Mokio', 'O. Gloukh', 'M. Godts', 'K. Dolberg', 'M. Carrizo', 'J. Heerkens', 'A. Kaplan', 'S. Steur', 'R. Bounida', 'O. Edvardsen']) },
{ code: "LEE", name: "Leeds United", skill: 76, style: "gegenpress", formation: "4-1-4-1", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("4-1-4-1", ['K. Darlow', 'G. Guðmundsson', 'P. Struijk', 'J. Rodon', 'J. Bogle', 'E. Ampadu', 'A. Stach', 'I. Gruev', 'B. Aaronson', 'W. Gnonto', 'D. Calvert-Lewin', 'L. Perri', 'J. Bijol', 'A. Tanaka', 'L. Nmecha', 'N. Okafor']) },
{ code: "CEL", name: "Celtic", skill: 76, style: "gegenpress", formation: "4-2-4", strategy: { approachPlay: -1, dribbling: 1, creativity: 1, possLost: 1, possWon: 1, gkDist: -1, pressingLOE: 2, defLine: 1, dlBehavior: 1 }, squad: buildSquad("4-2-4", ['V. Sinisalo', 'K. Tierney', 'A. Trusty', 'C. Carter-Vickers', 'A. Johnston', 'A. Engels', 'R. Hatate', 'D. Maeda', 'J. Adamu', 'K. Iheanacho', 'B. Nygren', 'R. Doohan', 'L. Scales', 'C. McGregor', 'Jota', 'T. Čvančara']) },
{ code: "IPS", name: "Ipswich Town", skill: 75, style: "counterattack", formation: "4-2-3-1", strategy: { approachPlay: 1, passingDir: 1, setPieces: 1, possLost: -1, possWon: 1, gkDist: 1, tackling: 1 }, squad: buildSquad("4-2-3-1", ['C. Walton', 'L. Davis', 'D. O\'Shea', 'C. Kipré', 'D. Furlong', 'A. Matusiwa', 'J. Taylor', 'J. Clarke', 'M. Núñez', 'J. Philogene', 'G. Hirst', 'A. Palmer', 'J. Greaves', 'K. McAteer', 'A. Mehmeti', 'S. Walle Egeli']) },
{ code: "SLA", name: "Slavia Praha", skill: 74, style: "gegenpress", formation: "3-4-3", strategy: { approachPlay: 1, passingDir: 1, dribbling: 1, possLost: 1, possWon: 1, gkDist: 1, pressingLOE: 2, defLine: 1, dlBehavior: 1, tackling: 1 }, squad: buildSquad("3-4-3", ['J. Stanek', 'S. Chaloupek', 'D. Zima', 'Igoh Ogbu', 'D. Jurásek', 'D. Moses', 'M. Sadílek', 'D. Doudera', 'L. Provod', 'M. Chytil', 'V. Kusej', 'J. Markovic', 'T. Holes', 'Oscar', 'M. Cham', 'T. Chory']) },
{ code: "USG", name: "Union Saint-Gilloise", skill: 74, style: "counterattack", formation: "3-4-1-2", strategy: { approachPlay: 1, passingDir: 1, setPieces: 1, possLost: -1, possWon: 1, gkDist: 1, pressingLOE: 1, tackling: 1 }, squad: buildSquad("3-4-1-2", ['K. Scherpen', 'F. Leysen', 'R. Sykes', 'K. Mac Allister', 'O. Niang', 'K. Van De Perre', 'A. Zorgane', 'A. Khalaili', 'A. Ait El Hadj', 'K. Rodríguez', 'P. David', 'V. Chambaere', 'C. Burgess', 'B. Zeneli', 'R. Schoofs', 'R. Florucz']) },
{ code: "COV", name: "Coventry City", skill: 74, style: "balanced", formation: "4-3-3", strategy: { approachPlay: -1, chanceCreation: -1, possLost: -1, possWon: 1, gkDist: -1 }, squad: buildSquad("4-3-3", ['C. Rushworth', 'L. Kitching', 'B. Thomas', 'J. Latibeaudiere', 'M. van Ewijk', 'M. Grimes', 'V. Torp', 'J. Eccles', 'B. Rudoni', 'E. Simms', 'H. Wright', 'B. Wilson', 'J. Dasilva', 'M.H. Yang', 'E. Mason-Clark', 'T. Sakamoto']) },
{ code: "HUL", name: "Hull City", skill: 74, style: "balanced", formation: "4-4-2", strategy: { approachPlay: 1, setPieces: 1, possLost: -1, possWon: 1, gkDist: 1, defLine: -1, dlBehavior: -1, tackling: 1 }, squad: buildSquad("4-4-2", ['I. Pandur', 'R. Giles', 'C. Hughes', 'J. Egan', 'L. Coyle', 'L. Millar', 'R. Slater', 'M. Crooks', 'A. Belloumi', 'O. McBurnie', 'K. Joseph', 'D. Phillips', 'C. Drameh', 'A. Hadžiahmetović', 'J. Lundstram', 'D. Akintola']) },
{ code: "OLY", name: "Olympiacos", skill: 74, style: "wingplay", formation: "4-4-2", strategy: { passingDir: 1, chanceCreation: 1, dribbling: 1, setPieces: 1, timeWasting: 1, possLost: -1, possWon: 1, gkDist: 1, pressingLOE: -1, defLine: -1, dlBehavior: -1, tackling: 1 }, squad: buildSquad("4-4-2", ['K. Tzolakis', 'F. Ortega', 'L. Pirola', 'P. Retsos', 'Costinha', 'D. Podence', 'C. Mouzakitis', 'S. Hezze', 'G. Strefezza', 'A. El Kaabi', 'M. Taremi', 'A. Paschalakis', 'G. Biancone', 'Chiquinho', 'Y. Yazıcı', 'R. Yaremchuk']) }
];
function isPow2(n) { return n > 0 && (n & (n - 1)) === 0; }

// ═══ UI STYLES ═══════════════════════════════════════════════════════════════
const mono = { fontFamily: "'JetBrains Mono','Fira Code',monospace", fontVariantNumeric: "tabular-nums" };
const ui = { fontFamily: "'Neue Montreal','Inter','Helvetica Neue',sans-serif" };
const lbl = { display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4c5a4c", marginBottom: 6, ...ui };
const chip = { border: "1px solid #2a3a2a", borderRadius: 6, padding: "7px 16px", fontSize: 13, cursor: "pointer", transition: "all 0.15s", fontFamily: "'Neue Montreal','Inter',sans-serif", fontWeight: 500, letterSpacing: "0.04em" };
const inp = { background: "#0f1310", border: "1px solid #1a221a", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dde5dd", outline: "none", fontFamily: "inherit" };
const sel = { ...inp, cursor: "pointer" };
const addBtn = { background: "transparent", border: "1px solid #2a3a2a", borderRadius: 6, padding: "5px 14px", fontSize: 11, color: "#3d5343", cursor: "pointer", fontFamily: "'Neue Montreal','Inter',sans-serif", fontWeight: 500, letterSpacing: "0.06em" };
const delBtn = { background: "transparent", border: "none", color: "#bf616a", fontSize: 16, cursor: "pointer", padding: "0 4px", fontFamily: "inherit" };
const scBtn = { width: "100%", background: "linear-gradient(135deg, #3d5343 0%, #627661 100%)", border: "none", borderRadius: 8, padding: "14px", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", letterSpacing: "0.08em", fontFamily: "'Neue Montreal','Inter',sans-serif", boxShadow: "0 2px 8px #3d534333" };
const chk = { fontSize: 11, color: "#6b7a6b", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" };
const POS_CLR = {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"};
const evColor = { goal: "#d3ebd3", penalty: "#d08770", chance: "#ebcb8b", red: "#bf616a", second_yellow: "#bf616a", pen_miss: "#bf616a", yellow: "#ebcb8b", save: "#627661", miss: "#7a6e6e", sub: "#7a8b9b", injury: "#c07070", press: "#555", counter: "#555", phase: "#d3ebd3", foul: "#555", corner: "#555", neutral: "#555", offside: "#555", buildup: "#555", clearance: "#555" };
const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.cdnfonts.com/css/neue-montreal');
*{box-sizing:border-box;margin:0;padding:0;}
html{overflow-y:scroll;}
body{font-family:'Neue Montreal','Inter','Helvetica Neue',sans-serif;}
::selection{background:#3d534366;color:#d3ebd3;}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#2a3a2a;border-radius:10px;}
::-webkit-scrollbar-thumb:hover{background:#3d5343;}
input,select,textarea{font-family:inherit;transition:border-color 0.2s,box-shadow 0.2s;}
input[type=number]{-moz-appearance:textfield;}
input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
input:focus,select:focus,textarea:focus{border-color:#3d5343 !important;outline:none;box-shadow:0 0 0 3px #3d534320;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes goalPunch{0%{transform:scale(1)}15%{transform:scale(1.25)}30%{transform:scale(0.95)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes goalGlow{0%{text-shadow:0 0 24px #d3ebd3,0 0 48px #a3be8c66;}50%{text-shadow:0 0 36px #d3ebd3,0 0 72px #a3be8c66;}100%{text-shadow:none;}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes spin{to{transform:rotate(360deg)}}
.ev-enter{animation:slideIn 0.3s ease;}
.goal-flash{animation:goalPunch 0.6s ease-out, goalGlow 1.2s ease-out;}
.tick-btn{transition:all 0.12s ease;}
.tick-btn:hover{filter:brightness(1.15);transform:translateY(-1px);}
.tick-btn:active{transform:scale(0.97) translateY(0);}
button{transition:all 0.15s ease;}
button:hover:not(:disabled){filter:brightness(1.18);}
button:disabled{opacity:0.35;cursor:not-allowed;}
details>summary{cursor:pointer;user-select:none;list-style:none;transition:color 0.15s;}
details>summary:hover{color:#d3ebd3 !important;}
details>summary::-webkit-details-marker{display:none;}
details>summary .dta{display:inline-block;margin-right:6px;transition:transform 0.15s;}
details[id^="doc-"]>summary+p{margin-top:12px;}
details[id^="doc-"]>summary+div{margin-top:12px;}
details[open]>summary .dta{transform:rotate(90deg);}
.team-row{transition:background 0.15s;}
.team-row:hover{background:#141a14 !important;}
.ko-match{transition:border-color 0.15s, box-shadow 0.15s;}
.ko-match:hover{border-color:#2a3a2a !important;}
.panel{background:#0f1310;border:1px solid #1a221a;border-radius:10px;}
select{cursor:pointer;}
input::placeholder{color:#3b4a3b;}
table{border-spacing:0;}
@keyframes goalFlash{0%{text-shadow:0 0 24px #d3ebd3,0 0 48px #a3be8c66;}50%{text-shadow:0 0 36px #d3ebd3,0 0 72px #a3be8c66;}100%{text-shadow:none;}}
.live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#627661;animation:pulse 1.8s ease-in-out infinite;margin-right:5px;vertical-align:middle;}
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
  *{transition-duration:0.01ms !important;}
}
`;

const T_PRESETS = {
  league: { label: "League", config: { mode: "single", singleType: "groups", numGroups: 1, matchFormat: "roundRobin", rrLegs: 2, allocMode: "seed", homeAdvGroup: "first", homeAdvKO: "off", thirdPlace: false, koLegs: 1, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 1, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", tiebreakers: ['gd', 'gf', 'h2h', 'wins'], qualZones: [{ anchor: "top", from: 1, to: 1, label: "Champion", color: "#c9a84c", type: "cosmetic" }, { anchor: "bottom", from: 1, to: 3, label: "Relegation", color: "#bf616a", type: "cosmetic" }] } },
  oldWC: { label: "Old World Cup", config: { mode: "double", singleType: "groups", numGroups: 8, matchFormat: "roundRobin", rrLegs: 1, allocMode: "draw", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: true, koLegs: 1, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 2, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }] } },
  newWC: { label: "New World Cup", config: { mode: "double", singleType: "groups", numGroups: 12, matchFormat: "roundRobin", rrLegs: 1, allocMode: "draw", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: true, koLegs: 1, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 2, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }, { anchor: "top", from: 3, to: 3, label: "Best 3rd", color: "#4a7ab5", type: "best", bestCount: 8 }] } },
  oldUCL: { label: "Old UCL", config: { mode: "double", singleType: "groups", numGroups: 8, matchFormat: "roundRobin", rrLegs: 2, allocMode: "draw", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: false, koLegs: 2, koAwayGoals: true, homeAdvTeams: [], advPerGroup: 2, numPots: 4, swissRounds: 5, koAllocMode: "seed", koByeMode: "auto", tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }] } },
  newUCL: { label: "New UCL", config: { mode: "double", singleType: "groups", numGroups: 1, matchFormat: "swiss", rrLegs: 1, allocMode: "seed", homeAdvGroup: "off", homeAdvKO: "off", thirdPlace: false, koLegs: 2, koAwayGoals: false, homeAdvTeams: [], advPerGroup: 8, numPots: 4, swissRounds: 8, koAllocMode: "seed", koByeMode: "auto", tiebreakers: ['gd', 'gf', 'buchholz', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 8, label: "Advance", color: "#5e9c6b", type: "advance" }, { anchor: "top", from: 9, to: 24, label: "Playoff", color: "#4a7ab5", type: "advance" }] } },
  cup: { label: "Cup", config: { mode: "single", singleType: "knockout", koLegs: 1, koAllocMode: "seed", homeAdvKO: "weak_skill", homeAdvGroup: "off", thirdPlace: false, koAwayGoals: true, homeAdvTeams: [], numGroups: 8, advPerGroup: 2, numPots: 4, matchFormat: "roundRobin", rrLegs: 1, swissRounds: 5, allocMode: "seed", koByeMode: "auto", tiebreakers: ['gd', 'gf', 'h2h', 'wins'], qualZones: [] } },
};
// ═══════════════════════════════════════════════════════════════════════════════
const TB = (t) => t===2?<span style={{color:"#c9a84c",fontSize:"0.9em",marginLeft:2}}>★</span>:t===1?<span style={{color:"#7a9e7a",fontSize:"0.85em",marginLeft:2,fontWeight:700,verticalAlign:"0.1em"}}>+</span>:null;
export default function App() {
  const [tab, setTab] = useState("live");
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [teams, setTeams] = useState(() => PRESET_AVIUM.map(t => ({...t, strategy: {...(t.strategy||{})}, squad: t.squad ? t.squad.map(p => ({...p})) : null})));
  const [showBulk, setShowBulk] = useState(false);
  const [teamSort, setTeamSort] = useState(null);
  const [bulkText, setBulkText] = useState("");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [viewSquad, setViewSquad] = useState(null);
  const [loading, setLoading] = useState(false);

  // ─── LIVE MATCH ───
  const [lmH, setLmH] = useState(0);
  const [lmA, setLmA] = useState(Math.min(1, PRESET_AVIUM.length - 1));
  const [lmForce, setLmForce] = useState(true);
  const [lmAllowTac, setLmAllowTac] = useState(true);
  const [lmHomeAdv, setLmHomeAdv] = useState(null);
  const [lm2ndLeg, setLm2ndLeg] = useState(false);
  const [lmMatch, setLmMatch] = useState(null);
  const [lmStartScore, setLmStartScore] = useState([0, 0]);
  const lmRng = useRef(null);
  const lmFeedRef = useRef(null);
  const [manualSub, setManualSub] = useState({side:null,off:null});
  const [goalFlash, setGoalFlash] = useState(null);
  const [lmTab, setLmTab] = useState("stats");
  const [showReport, setShowReport] = useState(false);
  const summaryRef = useRef("");
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
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" style="background:#0a0f0c">';
    s += '<style>text{font-family:Neue Montreal,Inter,Helvetica Neue,sans-serif;fill:#888;font-size:10px}.w{fill:#d3ebd3;font-weight:600}.h{fill:#3d5343;font-size:8px;text-anchor:middle;letter-spacing:1px;font-weight:600}.p{fill:#d08770;font-size:8px}</style>';
    const card = (m, x, y, fin) => {
      const w = W(m), brd = fin ? "#c9a84c66" : "#1e2a1e", bw = fin ? 2 : 1;
      s += '<rect x="'+x+'" y="'+y+'" width="'+cW+'" height="'+cH+'" rx="4" fill="#141a14" stroke="'+brd+'" stroke-width="'+bw+'"/>';
      const hn = esc(m.home?.name||(m.bye?"BYE":"TBD")), an = esc(m.away?.name||(m.bye?"BYE":"TBD"));
      const is2L = m.result?.twoLeg, isPart = m.result?.partial;
      const maxNameLen = is2L && !isPart ? 18 : 22;
      const hnT = hn.length > maxNameLen ? hn.slice(0, maxNameLen-1) + "…" : hn;
      const anT = an.length > maxNameLen ? an.slice(0, maxNameLen-1) + "…" : an;
      const winnerIsHome = w && w === m.home;
      const addLabel = (lbl, clr, lx, ly) => {
        if (!lbl) return;
        const lblW = lbl.length * 5 + 6;
        s += '<rect x="'+(lx-lblW-2)+'" y="'+(ly-10)+'" width="'+(lblW+2)+'" height="13" fill="#141a14"/>';
        s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" style="font-family:Neue Montreal,Inter,Helvetica Neue,sans-serif;font-size:10px;fill:'+clr+';font-weight:700;font-style:italic">'+lbl+'</text>';
      };
      if (is2L && !isPart) {
        const l1h=m.result.leg1.home, l1a=m.result.leg1.away, l2h=m.result.leg2?.away||0, l2a=m.result.leg2?.home||0;
        const ah=m.result.agg?.home||0, aa=m.result.agg?.away||0;
        const hCls=w===m.home?' class="w"':'', aCls=w===m.away?' class="w"':'';
        s += '<text x="'+(x+6)+'" y="'+(y+19)+'"'+hCls+'>'+hnT+'</text>';
        let hTail = l1h+' '+l2h+' '+ah; if(m.result.pen) hTail+=' ('+m.result.pen.home+')';
        s += '<text x="'+(x+cW-6)+'" y="'+(y+19)+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+hCls+'>'+hTail+'</text>';
        s += '<text x="'+(x+6)+'" y="'+(y+37)+'"'+aCls+'>'+anT+'</text>';
        let aTail = l1a+' '+l2a+' '+aa; if(m.result.pen) aTail+=' ('+m.result.pen.away+')';
        s += '<text x="'+(x+cW-6)+'" y="'+(y+37)+'" text-anchor="end" style="font-family:JetBrains Mono,monospace"'+aCls+'>'+aTail+'</text>';
        const lbl = m.result.pen ? "PENS" : m.result.et ? "AET" : (m.result.awayGoalsRule && ah===aa) ? "AG" : null;
        const lblClr = m.result.pen ? "#d08770" : "#4c5a4c";
        const scoreW = String(l1a+' '+l2a+' '+aa+(m.result.pen?' ('+m.result.pen.away+')':'')).length * 6 + 16;
        addLabel(lbl, lblClr, x+cW-6-scoreW, winnerIsHome ? y+19 : y+37);
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
        const lblClr = m.result?.pen ? "#d08770" : "#4c5a4c";
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
          if(h1) s+='<line x1="'+x+'" y1="'+y1+'" x2="'+(x+cn/2)+'" y2="'+y1+'" stroke="#2a3a2a"/>';
          if(h2) s+='<line x1="'+x+'" y1="'+y2+'" x2="'+(x+cn/2)+'" y2="'+y2+'" stroke="#2a3a2a"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+(h1?y1:mid)+'" x2="'+(x+cn/2)+'" y2="'+(h2?y2:mid)+'" stroke="#2a3a2a"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+mid+'" x2="'+(x+cn)+'" y2="'+mid+'" stroke="#2a3a2a"/>';
        } else {
          if(h1) s+='<line x1="'+(x+cn)+'" y1="'+y1+'" x2="'+(x+cn/2)+'" y2="'+y1+'" stroke="#2a3a2a"/>';
          if(h2) s+='<line x1="'+(x+cn)+'" y1="'+y2+'" x2="'+(x+cn/2)+'" y2="'+y2+'" stroke="#2a3a2a"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+(h1?y1:mid)+'" x2="'+(x+cn/2)+'" y2="'+(h2?y2:mid)+'" stroke="#2a3a2a"/>';
          s+='<line x1="'+(x+cn/2)+'" y1="'+mid+'" x2="'+x+'" y2="'+mid+'" stroke="#2a3a2a"/>';
        }
      }
      if (n % 2 === 1 && cs[n-1] !== null) {
        const y = pd+hd+(n-0.5)*(tH/n);
        if (side==="left") s+='<line x1="'+x+'" y1="'+y+'" x2="'+(x+cn)+'" y2="'+y+'" stroke="#2a3a2a"/>';
        else s+='<line x1="'+(x+cn)+'" y1="'+y+'" x2="'+x+'" y2="'+y+'" stroke="#2a3a2a"/>';
      }
    };
    let cx = pd, prev = null, prevN = 0;
    leftR.forEach((lr, i) => { if(prev){lines(prev,cx,prevN,"left");cx+=cn;} const cs=col(lr.matches,cx,lr.name); prev=cs; prevN=lr.matches.length; cx+=cW; });
    if(prev){lines(prev,cx,prevN,"left");cx+=cn;}
    const fY=pd+hd+tH/2-cH/2;
    s+='<text x="'+(cx+cW/2)+'" y="'+(fY-6)+'" style="fill:#c9a84c;font-size:8px;text-anchor:middle;letter-spacing:1px;font-weight:600">FINAL</text>';
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
  const [lastLiveResult, setLastLiveResult] = useState(null);

  // ─── TOURNAMENT ───
  const [tPhase, setTPhase] = useState("setup");
  const [tPlayerStats, setTPlayerStats] = useState({});
  const [tLeaderboard, setTLeaderboard] = useState(null);
  const [tConfig, setTConfig] = useState({ mode: "double", singleType: "knockout", numGroups: 8, advPerGroup: 2, thirdPlace: true, allocMode: "seed", koAllocMode: "seed", numPots: 4, matchFormat: "roundRobin", rrLegs: 1, swissRounds: 5, homeAdvGroup: "off", homeAdvKO: "off", homeAdvTeams: [], koLegs: 1, koAwayGoals: true, koByeMode: 'auto', tiebreakers: ['gd', 'gf', 'h2h', 'wins', 'manual'], qualZones: [{ anchor: "top", from: 1, to: 2, label: "Qualify", color: "#5e9c6b", type: "advance" }] });
  const [tGroups, setTGroups] = useState([]);
  const [tKO, setTKO] = useState(null);
  const [tDrawLog, setTDrawLog] = useState([]);
  const [tKODrawLog, setTKODrawLog] = useState([]);
  const [tManual, setTManual] = useState(null); // manual allocation state
  const [tKOManual, setTKOManual] = useState(null);
  const [tByeManual, setTByeManual] = useState(null);
  const [tPoolData, setTPoolData] = useState(null);
  const [tEdit, setTEdit] = useState(null); // {gi, ri, mi, h:"", a:""} for manual score entry
  const [tKoEdit, setTKoEdit] = useState(null); // {ri, mi, h:"", a:""} for knockout manual score
  const [tScoreError, setTScoreError] = useState("");
  const [tHomeAdvOverrides, setTHomeAdvOverrides] = useState({});
  const [tLiveTarget, setTLiveTarget] = useState(null);
  const tToggleHA = (key) => setTHomeAdvOverrides(p => { const c = p[key] || null; const n = c === null ? "home" : c === "home" ? "away" : c === "away" ? "off" : null; const nm = { ...p }; if (n === null) delete nm[key]; else nm[key] = n; return nm; });
  const tGetHA = (key, fallback) => { const o = tHomeAdvOverrides[key]; if (o === "off") return null; if (o === "home" || o === "away") return o; return fallback; };

  useEffect(() => { if (lmFeedRef.current) lmFeedRef.current.scrollTop = lmFeedRef.current.scrollHeight; }, [lmMatch?.events.length]);

  // ─── TEAM MGMT ───
  const addTeam = () => setTeams(t => [...t, { name: `Team ${t.length + 1}`, skill: 50, style: "balanced", formation: "4-3-3", strategy: {...STRAT_DEF} }]);
  const removeTeam = (i) => setTeams(t => t.filter((_, j) => j !== i));
  const updateTeam = (i, f, v) => setTeams(t => t.map((tm, j) => { if (j !== i) return tm; const nt = { ...tm, [f]: f === "skill" ? (v === "" ? "" : Number(v)) : v }; if (f === "formation") { const names = tm.squad ? tm.squad.map(p => p.name) : null; const tiers = tm.squad ? tm.squad.map(p => p.tier || 0) : null; nt.squad = buildSquad(v, names); if (tiers) nt.squad.forEach((p, i) => { if (i < tiers.length) p.tier = tiers[i]; }); } return nt; }));
  const teamErrors = teams.some(t => t.skill === "" || t.skill < 25 || t.skill > 100);
  const importBulk = () => { const p = parseBulk(bulkText); if (p.length > 0) { setTeams(p); setShowBulk(false); setBulkText(""); setLmMatch(null); setLmH(0); setLmA(Math.min(1, p.length - 1)); setTPhase("setup"); setTGroups([]); setTKO(null); setTPlayerStats({}); } };
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
        homeName: teams[lmH]?.name, awayName: teams[lmA]?.name,
        homeCode: teams[lmH]?.code, awayCode: teams[lmA]?.code,
        homeScore: lmMatch.score[0], awayScore: lmMatch.score[1],
        goalscorers: JSON.parse(JSON.stringify(lmMatch.goalscorers || {home:[],away:[]})),
        homePlayers: allPlayers("home").map(p => ({name:p.name,pos:p.pos,goals:p.goals||0,assists:p.assists||0,rating:+(p.rating||6).toFixed(1),yc:p.yc||0,rc:p.rc?1:0,inj:p.inj?1:0})),
        awayPlayers: allPlayers("away").map(p => ({name:p.name,pos:p.pos,goals:p.goals||0,assists:p.assists||0,rating:+(p.rating||6).toFixed(1),yc:p.yc||0,rc:p.rc?1:0,inj:p.inj?1:0})),
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
      if (!nk.rounds?.[target.ri]) return;
      const m = target.tp ? nk.thirdPlace : nk.rounds[target.ri].matches[target.mi];
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
          if (l1.away !== ag) { res.awayGoalsRule = true; }
          else if (penData) { res.pen = { home: penData.homeScore, away: penData.awayScore }; }
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
          if (v.rc) { next[k].reds = (next[k].reds||0) + 1; next[k].suspended = (next[k].suspended||0) + 1; }
          if (v.inj) { const r = Math.random(); next[k].injOut = (next[k].injOut||0) + (r < 0.45 ? 1 : r < 0.70 ? 2 : r < 0.85 ? 3 : r < 0.95 ? 4 : 5); }
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
      matchObj = target.tp ? tKO.thirdPlace : tKO.rounds[target.ri].matches[target.mi];
      homeTeam = matchObj.home; awayTeam = matchObj.away;
    }
    if (!homeTeam || !awayTeam) return;
    const hi = teams.findIndex(t => t.name === homeTeam.name);
    const ai = teams.findIndex(t => t.name === awayTeam.name);
    if (hi === -1 || ai === -1) return;

    const isL2 = target.type === "ko" && target.leg === 2 && tConfig.koLegs === 2;
    const liveHi = isL2 ? ai : hi;
    const liveAi = isL2 ? hi : ai;

    const unavail = new Set();
    for (const [k, v] of Object.entries(tPlayerStats)) {
      if ((v.suspended || 0) > 0 || (v.injOut || 0) > 0) unavail.add(k);
    }

    const forceResult = target.type === "ko";
    let startScore = [0, 0];
    if (isL2 && matchObj.result?.leg1) {
      startScore = [matchObj.result.leg1.away, matchObj.result.leg1.home];
    }

    let homeAdv = null;
    if (target.type === "group") {
      const haKey = `g_${target.gi}_${target.ri}_${target.mi}`;
      homeAdv = tGetHA(haKey, resolveHomeAdv(homeTeam.name, awayTeam.name, tConfig, true, teams[hi].skill, teams[ai].skill));
    } else {
      const koHAKey = target.tp ? "tp" : `ko_${target.ri}_${target.mi}`;
      const haVal = tGetHA(koHAKey, resolveKOHomeAdv(matchObj, tConfig));
      if (isL2) { homeAdv = haVal === "home" ? "away" : haVal === "away" ? "home" : null; }
      else { homeAdv = haVal; }
    }

    const buildLiveSquad = (teamName, teamIdx) => {
      const sq = teams[teamIdx]?.squad || buildSquad(teams[teamIdx]?.formation, null);
      const starters = sq.filter(p => !p.bench);
      const bench = sq.filter(p => p.bench);
      const keyOf = (name) => teamName + "|" + name;
      const unavailStarters = starters.filter(p => unavail.has(keyOf(p.name)));
      const availStarters = starters.filter(p => !unavail.has(keyOf(p.name)));
      const availBench = bench.filter(p => !unavail.has(keyOf(p.name)));
      const used = new Set();
      const replacements = [];
      for (const out of unavailStarters) {
        let rep = availBench.find(p => p.pos === out.pos && !used.has(p.name));
        if (!rep) rep = availBench.find(p => p.pos !== "GK" && !used.has(p.name));
        if (!rep) rep = availBench.find(p => !used.has(p.name));
        if (rep) { replacements.push(rep); used.add(rep.name); }
      }
      return { starters: [...availStarters, ...replacements], bench: availBench.filter(p => !used.has(p.name)) };
    };

    const hSquad = buildLiveSquad(teams[liveHi].name, liveHi);
    const aSquad = buildLiveSquad(teams[liveAi].name, liveAi);
    const mapP = (p) => ({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.0,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0});
    const mapB = (p) => ({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0});

    lmRng.current = new RNG(Date.now());
    const init = createMatchState();
    init.forceResult = forceResult;
    init.styles = { home: teams[liveHi].style || "balanced", away: teams[liveAi].style || "balanced" };
    init.formations = { home: teams[liveHi].formation || "4-3-3", away: teams[liveAi].formation || "4-3-3" };
    init.allowTacChange = {home:true, away:true};
    init.homeAdv = homeAdv;
    init.strategy = { home: { ...STRAT_DEF, ...(teams[liveHi].strategy || {}) }, away: { ...STRAT_DEF, ...(teams[liveAi].strategy || {}) } };
    init.score = [0, 0];
    init.startScore = startScore;
    init.players = { home: hSquad.starters.map(mapP), away: aSquad.starters.map(mapP) };
    init.bench = { home: hSquad.bench.map(mapB), away: aSquad.bench.map(mapB) };

    setLmH(liveHi); setLmA(liveAi);
    setLmForce(forceResult); setLmStartScore(startScore); setLmHomeAdv(homeAdv);
    setTLiveTarget({...target, flipped: isL2});
    setLmMatch(init); setManualSub({side:null,off:null}); setTab("live");
  };

  // Auto-save tournament state to persistent storage
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (!tPhase && teams.length <= 1) return; // nothing to save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const state = { v: 2, teams, tConfig, tGroups, tKO, tPlayerStats, tPhase, lmH, lmA, ts: Date.now() };
        localStorage.setItem("avium-engine-autosave", JSON.stringify(state));
      } catch (e) { /* storage unavailable */ }
    }, 1500); // debounce 1.5s
  }, [teams, tConfig, tGroups, tKO, tPlayerStats, tPhase]);

  // Auto-load on mount
  useEffect(() => {
    (async () => {
      try {
        const result = { value: localStorage.getItem("avium-engine-autosave") };
        if (result?.value) {
          const state = JSON.parse(result.value);
          if (state.v && state.teams?.length > 0) {
            setTeams(state.teams.map(t => ({ ...t, squad: t.squad || buildSquad(t.formation || "4-3-3", null), strategy: { ...STRAT_DEF, ...(t.strategy || {}) } })));
            if (state.tConfig) setTConfig(c => ({ ...c, ...state.tConfig, qualZones: state.tConfig.qualZones || c.qualZones, tiebreakers: state.tConfig.tiebreakers || c.tiebreakers }));
            if (state.tGroups) setTGroups(state.tGroups);
            if (state.tKO) setTKO(state.tKO);
            if (state.tPlayerStats) setTPlayerStats(state.tPlayerStats);
            if (state.tPhase) setTPhase(state.tPhase);
            if (state.lmH !== undefined) setLmH(state.lmH);
            if (state.lmA !== undefined) setLmA(state.lmA);
          }
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
      return [code, t.name, t.skill, style, form, ...tactics, players].join("\t");
    }).join("\n");
  };

  const exportState = () => { setShowExport(!showExport); };

  const loadPreset = (preset) => { setTeams(preset); setShowBulk(false); setBulkText(""); setLmMatch(null); setLmH(0); setLmA(Math.min(1, preset.length - 1)); setTPhase("setup"); setTGroups([]); setTKO(null); setTPlayerStats({}); setExpandedTeam(null); };

  // ─── LIVE MATCH ───
  const lmKickOff = () => { if (teams.length < 2) return; lmRng.current = new RNG(Date.now()); const init = createMatchState(); init.forceResult = lmForce; init.styles = { home: teams[lmH].style || "balanced", away: teams[lmA].style || "balanced" }; init.formations = { home: teams[lmH].formation || "4-3-3", away: teams[lmA].formation || "4-3-3" }; init.allowTacChange = {home:lmAllowTac, away:lmAllowTac}; init.homeAdv = lmHomeAdv || null; init.strategy = { home: { ...STRAT_DEF, ...(teams[lmH].strategy || {}) }, away: { ...STRAT_DEF, ...(teams[lmA].strategy || {}) } }; init.score = [0, 0]; init.startScore = [lmStartScore[0] || 0, lmStartScore[1] || 0];
    const hSq = teams[lmH]?.squad || buildSquad(teams[lmH]?.formation, null);
    const aSq = teams[lmA]?.squad || buildSquad(teams[lmA]?.formation, null);
    init.players = {home: hSq.filter(p=>!p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.0,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0})), away: aSq.filter(p=>!p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.0,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0}))};
    init.bench = {home: hSq.filter(p=>p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0})), away: aSq.filter(p=>p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0}))};
    setLmMatch(init); setManualSub({side:null,off:null}); setExpandedTeam(null); setViewSquad(null); };
  const lmTick = useCallback(() => { if (!lmMatch || !lmRng.current) return; setLmMatch(prev => lmAdvance(prev, lmRng.current, { name: teams[lmH].name, skill: teams[lmH].skill }, { name: teams[lmA].name, skill: teams[lmA].skill })); }, [lmMatch, teams, lmH, lmA]);
  const lmSimAll = () => { setLoading(true); setTimeout(() => { const rng = lmRng.current || new RNG(Date.now()); lmRng.current = rng; const h = { name: teams[lmH].name, skill: teams[lmH].skill }, a = { name: teams[lmA].name, skill: teams[lmA].skill }; const init = createMatchState(); init.forceResult = lmForce; init.styles = { home: teams[lmH].style || "balanced", away: teams[lmA].style || "balanced" }; init.formations = { home: teams[lmH].formation || "4-3-3", away: teams[lmA].formation || "4-3-3" }; init.allowTacChange = {home:lmAllowTac, away:lmAllowTac}; init.homeAdv = lmHomeAdv || null; init.strategy = { home: { ...STRAT_DEF, ...(teams[lmH].strategy || {}) }, away: { ...STRAT_DEF, ...(teams[lmA].strategy || {}) } }; init.score = [0, 0]; init.startScore = [lmStartScore[0] || 0, lmStartScore[1] || 0];
    const hSq2 = teams[lmH]?.squad || buildSquad(teams[lmH]?.formation, null);
    const aSq2 = teams[lmA]?.squad || buildSquad(teams[lmA]?.formation, null);
    init.players = {home: hSq2.filter(p=>!p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.0,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0})), away: aSq2.filter(p=>!p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:6.0,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0}))};
    init.bench = {home: hSq2.filter(p=>p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0})), away: aSq2.filter(p=>p.bench).map(p=>({name:p.name,pos:p.pos,tier:p.tier||0,rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:p.atkW||0}))};
    let s = lmMatch && lmMatch.phase !== "pre_match" ? cloneState(lmMatch) : lmAdvance(init, rng, h, a); for (let i = 0; i < 300 && s.phase !== "finished"; i++) lmAdvance(s, rng, h, a, true); setLmMatch(s); setLoading(false); }, 40); };
  const executeManualSub = (side, offName, onName) => {
    setLmMatch(prev => {
      const s = cloneState(prev);
      const dm = s.minute;
      const sn = side === "home" ? teams[lmH]?.name : teams[lmA]?.name;
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
      s.events.push({min:dm,type:"sub",team:side,text:"\uD83D\uDD04 "+sn+"'s "+offName+" \u2192 "+onName+". Manual substitution."});
      return s;
    });
    setManualSub({side:null,off:null});
  };
  const lmReset = () => setLmMatch(null);
  const lmBl = lmMatch ? lmBtnLabel(lmMatch) : null;
  const lmIsSetup = !lmMatch;

  // ─── TOURNAMENT ───
  const tPerGroup = teams.length > 0 && tConfig.numGroups > 0 ? Math.floor(teams.length / tConfig.numGroups) : 0;
  const tPerGroupMax = teams.length > 0 && tConfig.numGroups > 0 ? Math.ceil(teams.length / tConfig.numGroups) : 0;
  const tDivisible = teams.length > 0 && tConfig.numGroups > 0 && teams.length % tConfig.numGroups === 0;
  const tUneven = !tDivisible && tPerGroup >= 2;
  const tHasGroups = tConfig.mode === "double" || (tConfig.mode === "single" && tConfig.singleType === "groups");
  const tHasKO = tConfig.mode === "double" || (tConfig.mode === "single" && tConfig.singleType === "knockout");
  const qz = tConfig.qualZones || [];
  const tUseZones = tHasKO && zonesHaveAdvance(qz);
  const tKoTeams = tConfig.mode === "single" && tConfig.singleType === "knockout" ? teams.length : tUseZones ? countKOTeamsFromZones(tConfig.qualZones, tConfig.numGroups) : tConfig.numGroups * tConfig.advPerGroup;
  const tAdvOk = tConfig.mode === "single" || tKoTeams >= 2;
  const tKoValid = tKoTeams >= 2;
  const tGroupsOk = tConfig.numGroups >= 1 && tConfig.numGroups <= 26;
  const tPotsOk = tConfig.allocMode !== "draw" || (tConfig.numPots >= 2 && tConfig.numPots <= tConfig.numGroups);
  const tSwissOk = tConfig.matchFormat !== "swiss" || (tConfig.swissRounds >= 1 && tConfig.swissRounds <= Math.max(1, tPerGroup - 1));
  const tNumByes = (()=>{ let n2=1; const nt = tHasKO ? (tConfig.mode === "double" ? tKoTeams : teams.length) : 0; while(n2<nt)n2*=2; return n2-nt; })();
  const tValid = !teamErrors && (tConfig.mode === "single" && tConfig.singleType === "knockout" ? teams.length >= 2 : (tPerGroup >= 2 && tGroupsOk && tPotsOk && tSwissOk && tAdvOk && (!tHasKO || tKoValid)));
  const tTotalMatches = tGroups.reduce((s, g) => s + g.schedule.reduce((s2, r) => s2 + r.length, 0), 0);
  const tPlayedMatches = tGroups.reduce((s, g) => s + g.schedule.reduce((s2, r) => s2 + r.filter(m => m.result).length, 0), 0);

  const createTournament = (mode) => {
    if (!tValid) return;
    setLoading(true); setTimeout(() => {
    // Single knockout — skip groups entirely
    if (tConfig.mode === "single" && tConfig.singleType === "knockout") {
      const hasTP = tConfig.thirdPlace && teams.length >= 4;
      let n2=1; while(n2<teams.length)n2*=2; const nb=n2-teams.length;
      if (nb > 0 && tConfig.koByeMode === "manual") {
        const sorted = [...teams].sort((a,b) => b.skill - a.skill);
        setTByeManual({ pool: sorted, numByes: nb, selected: [], hasTP, onConfirm: "single" });
        setTPhase("ko_byes"); setLoading(false); return;
      }
      const km = tConfig.koAllocMode;
      if (km === "seed") { const ko=buildKnockoutSeeded(teams, hasTP); propagateKO(ko); setTKO(ko); setTPhase("knockout"); }
      else if (km === "random") { const ko=buildKnockoutRandom(teams, hasTP, new RNG(Date.now())); propagateKO(ko); setTKO(ko); setTPhase("knockout"); }
      else if (km === "draw") { const rng = new RNG(Date.now()); const { ko, log } = buildKnockoutDraw(teams, hasTP, rng); propagateKO(ko); setTKO(ko); setTKODrawLog(log); setTPhase("knockout"); }
      else if (km === "manual") { let n2=1; while(n2<teams.length)n2*=2; setTKOManual({ pool: [...teams], matches: Array.from({ length: n2/2 }, () => ({ home: null, away: null })), numByes: n2-teams.length }); setTPhase("ko_manual"); }
      setTGroups([]); setTDrawLog([]); setLoading(false); return;
    }
    const ng = tConfig.numGroups;
    const fmt = tConfig.matchFormat;
    const m = ng === 1 ? "seed" : (mode || tConfig.allocMode);
    if (m === "seed") { setTGroups(allocSeed(teams, ng, fmt, tConfig.rrLegs)); setTPhase("groups"); setTDrawLog([]); }
    else if (m === "random") { setTGroups(allocRandom(teams, ng, fmt, tConfig.rrLegs)); setTPhase("groups"); setTDrawLog([]); }
    else if (m === "draw") { const rng = new RNG(Date.now()); const { grps, log } = allocDraw(teams, ng, tConfig.numPots, rng, fmt, tConfig.rrLegs); setTGroups(grps); setTDrawLog(log); setTPhase("groups"); }
    else if (m === "manual") { const grps = Array.from({ length: ng }, (_, i) => ({ label: GL[i], teams: [], schedule: [], standings: [] })); setTManual({ pool: [...teams], grps }); setTPhase("manual"); }
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
  const resetTournament = () => { setTPhase("setup"); setTGroups([]); setTKO(null); setTPlayerStats({}); setTManual(null); setTKOManual(null); setTDrawLog([]); setTKODrawLog([]); setTEdit(null); setTScoreError(""); setTHomeAdvOverrides({}); setTPoolData(null); };

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


  const accumulateMatchStats = (teamObj, goalsFor, goalsAgainst, isWin, isDraw, simCards, unavailSet) => {
    if (!teamObj?.squad) return null;
    const rng2 = new RNG(Date.now() + Math.random() * 99999);
    const starters = teamObj.squad.filter(p => !p.bench);
    const bench = teamObj.squad.filter(p => p.bench);
    const keyOf = (pName) => teamObj.name + "|" + pName;
    const available = unavailSet ? starters.filter(p => !unavailSet.has(keyOf(p.name))) : starters;
    const replacements = bench.slice(0, starters.length - available.length);
    const sq = [...available, ...replacements];
    const key = keyOf;
    const subCandidates = bench.filter(p => p.pos !== "GK" && !sq.some(s => s.name === p.name) && (!unavailSet || !unavailSet.has(keyOf(p.name))));
    const nSubs = Math.min(subCandidates.length, rng2.u() < 0.15 ? 1 : rng2.u() < 0.55 ? 2 : 3);
    const matchSubs = []; const subUsed = new Set();
    for (let si = 0; si < nSubs; si++) { const rem = subCandidates.filter(p => !subUsed.has(p.name)); if (!rem.length) break; const pk = rem[Math.floor(rng2.u() * rem.length)]; matchSubs.push(pk); subUsed.add(pk.name); }
    const allOnPitch = [...sq, ...matchSubs];
    const nYellows = simCards ? (simCards.yellows||0) : (rng2.u() < 0.25 ? 0 : rng2.u() < 0.55 ? 1 : rng2.u() < 0.8 ? 2 : 3);
    const cardedYellows = [];
    for (let cy = 0; cy < nYellows; cy++) {
      const cp = pickPlayer(rng2, allOnPitch.map(p=>({name:p.name,pos:p.pos})), "foul");
      cardedYellows.push(cp.name);
    }
    const redName = (simCards ? (simCards.reds||0) > 0 : rng2.u() < 0.04) ? pickPlayer(rng2, allOnPitch.map(p=>({name:p.name,pos:p.pos})), "foul").name : null;
    const injName = (simCards ? (simCards.injuries||0) > 0 : rng2.u() < 0.07) ? allOnPitch[Math.floor(rng2.u() * allOnPitch.length)]?.name : null;
    const injDur = injName ? ((() => { const r = rng2.u(); return r < 0.45 ? 1 : r < 0.70 ? 2 : r < 0.85 ? 3 : r < 0.95 ? 4 : 5; })()) : 0;
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
      if (goalsAgainst > 0 && p.pos === "GK") rtg -= goalsAgainst * 0.1;
      if (goalsAgainst > 0 && p.pos === "DEF") rtg -= goalsAgainst * 0.06;
      playerRtgs[p.name] = { rtg: Math.max(3, Math.min(10, rtg)), gCount, aCount };
    });
    matchSubs.forEach(p => {
      let rtg = isDraw ? 6.3 : isWin ? 6.8 : 5.8;
      rtg += (rng2.u() - 0.4) * 0.8;
      const gCount = scorers.filter(n => n === p.name).length;
      const aCount = assisters.filter(n => n === p.name).length;
      rtg += gCount * 1.2 * goalAtkMult(p.atkW) + aCount * 0.5 * assistAtkMult(p.atkW);
      if (goalsAgainst > 0 && p.pos === "GK") rtg -= goalsAgainst * 0.1;
      if (goalsAgainst > 0 && p.pos === "DEF") rtg -= goalsAgainst * 0.06;
      playerRtgs[p.name] = { rtg: Math.max(3, Math.min(10, rtg)), gCount, aCount };
    });
    const csBonus = goalsAgainst === 0;
    allOnPitch.forEach(p => {
      if (!playerRtgs[p.name]) return;
      const pr = playerRtgs[p.name];
      if (p.pos === "GK") { if (csBonus) pr.rtg += 0.6; else pr.rtg += Math.min(0.3, rng2.u() * 0.1 + goalsAgainst * 0.03); }
      else if (p.pos === "DEF") { if (csBonus) pr.rtg += 0.35; else if (goalsAgainst === 1) pr.rtg += 0.2; else if (goalsAgainst === 2) pr.rtg += 0.1; }
      else if (p.pos === "MID") { pr.rtg += (rng2.u() - 0.3) * 0.3; if (goalsFor >= 2) pr.rtg += 0.08; }
      pr.rtg = Math.max(3, Math.min(10, pr.rtg));
    });
    setTPlayerStats(prev => {
      const next = {};
      for (const pk of Object.keys(prev)) next[pk] = {...prev[pk]};
      const initP = (p) => ({name:p.name,team:teamObj.name,code:teamObj.code||"",pos:p.pos,tier:p.tier||0,goals:0,assists:0,matches:0,subApp:0,totalRating:0});
      sq.forEach(p => {
        const k = key(p.name);
        if (!next[k]) next[k] = initP(p);
        next[k].matches++;
        const pr = playerRtgs[p.name];
        next[k].goals += pr.gCount;
        next[k].assists += pr.aCount;
        next[k].totalRating += pr.rtg;
        next[k].yellows = (next[k].yellows||0) + cardedYellows.filter(n => n === p.name).length;
        if (redName === p.name) { next[k].reds = (next[k].reds||0) + 1; next[k].suspended = (next[k].suspended||0) + 1; }
        if (p.name === injName) { next[k].injOut = (next[k].injOut||0) + injDur; }
      });
      matchSubs.forEach(p => {
        const k = key(p.name);
        if (!next[k]) next[k] = initP(p);
        next[k].subApp = (next[k].subApp||0) + 1;
        const pr = playerRtgs[p.name];
        next[k].goals += pr.gCount;
        next[k].assists += pr.aCount;
        next[k].totalRating += pr.rtg;
        next[k].yellows = (next[k].yellows||0) + cardedYellows.filter(n => n === p.name).length;
        if (redName === p.name) { next[k].reds = (next[k].reds||0) + 1; next[k].suspended = (next[k].suspended||0) + 1; }
        if (p.name === injName) { next[k].injOut = (next[k].injOut||0) + injDur; }
      });
      return next;
    });
    return { redKey: redName ? keyOf(redName) : null, injKey: injName ? keyOf(injName) : null, injDur };
  };
  const decrementBans = (teamNames) => {
    setTPlayerStats(prev => {
      const next = {};
      for (const k of Object.keys(prev)) next[k] = {...prev[k]};
      for (const k of Object.keys(next)) { if (teamNames.has(next[k].team)) { if (next[k].suspended > 0) next[k].suspended--; if (next[k].injOut > 0) next[k].injOut--; } }
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
    accumulateMatchStats(gm.home, hg, ag, hg>ag, hg===ag, null, mUnavail);
    accumulateMatchStats(gm.away, ag, hg, ag>hg, hg===ag, null, mUnavail);
    ng[gi].standings = recalcStandings(ng[gi], tConfig.tiebreakers);
    setTGroups(ng); setTEdit(null); setTScoreError("");
  };
  const tSetKoManualScore = () => {
    if (!tKoEdit) return;
    const { ri, mi, h, a, tp, step, ftH, ftA, etH, etA, twoLeg: isTL, l1h, l1a } = tKoEdit;
    const hg = parseInt(h, 10), ag = parseInt(a, 10);
    if (isTL && step === "l2" && String(h).trim() === "" && String(a).trim() === "") {
      const submitSkip = (result) => { const ko = JSON.parse(JSON.stringify(tKO)); if (tp) { ko.thirdPlace.result = result; } else { ko.rounds[ri].matches[mi].result = result; for (let r2 = ri + 1; r2 < ko.rounds.length; r2++) ko.rounds[r2].matches.forEach(m2 => { m2.result = null; m2.home = null; m2.away = null; }); if (ko.thirdPlace && ri <= ko.rounds.length - 2) { ko.thirdPlace.result = null; ko.thirdPlace.home = null; ko.thirdPlace.away = null; } ko.champion = null; propagateKO(ko); } setTKO(ko); setTKoEdit(null); setTScoreError(""); const fm = ko.rounds[ko.rounds.length - 1].matches[0]; if (fm?.result && !fm.result.partial && (!ko.thirdPlace || (ko.thirdPlace.result && !ko.thirdPlace.result.partial))) setTPhase("complete"); else setTPhase("knockout"); };
      if (l1h === l1a) { setTKoEdit({ ...tKoEdit, twoLeg: false, step: "et", ftH: l1h, ftA: l1a, h: "", a: "" }); setTScoreError(""); }
      else submitSkip({ ftHome: l1h, ftAway: l1a });
      return;
    }
    if (isNaN(hg) || isNaN(ag)) { setTScoreError("Enter both scores"); return; }
    if (hg < 0 || ag < 0) { setTScoreError("Scores can't be negative"); return; }
    const submit = (result) => {
      const ko = JSON.parse(JSON.stringify(tKO));
      if (tp) { ko.thirdPlace.result = result; }
      else {
        ko.rounds[ri].matches[mi].result = result;
        for (let r = ri + 1; r < ko.rounds.length; r++) ko.rounds[r].matches.forEach(m => { m.result = null; m.home = null; m.away = null; });
        if (ko.thirdPlace && ri <= ko.rounds.length - 2) { ko.thirdPlace.result = null; ko.thirdPlace.home = null; ko.thirdPlace.away = null; }
        ko.champion = null;
        propagateKO(ko);
      }
      setTKO(ko); setTKoEdit(null); setTScoreError("");
      if (result && !result.partial) { const km = tp ? ko.thirdPlace : ko.rounds[ri].matches[mi]; const hGoals = result.twoLeg?(result.agg?.home||0):(result.ftHome+(result.et?.home||0)); const aGoals = result.twoLeg?(result.agg?.away||0):(result.ftAway+(result.et?.away||0)); const dn=new Set(); if(km?.home)dn.add(km.home.name); if(km?.away)dn.add(km.away.name); if(dn.size)decrementBans(dn); const koUnavail = new Set(); for (const [k2,v2] of Object.entries(tPlayerStats)) { if ((v2.suspended||0)>0||(v2.injOut||0)>0) koUnavail.add(k2); } if(km?.home)accumulateMatchStats(km.home,hGoals,aGoals,hGoals>aGoals||(result.pen&&result.pen.home>result.pen.away),hGoals===aGoals&&!result.pen,null,koUnavail); if(km?.away)accumulateMatchStats(km.away,aGoals,hGoals,aGoals>hGoals||(result.pen&&result.pen.away>result.pen.home),hGoals===aGoals&&!result.pen,null,koUnavail); }
      const fm = ko.rounds[ko.rounds.length - 1].matches[0];
      if (fm?.result && !fm.result.partial && (!ko.thirdPlace || (ko.thirdPlace.result && !ko.thirdPlace.result.partial))) setTPhase("complete"); else setTPhase("knockout");
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
      ng.forEach((g, gi) => { if (targetGi !== -1 && targetGi !== gi) return; const rd = g.schedule[ri]; if (!rd) return; rd.forEach((m, mi) => {
        if (m.result) return;
        if (targetMi !== -1 && targetMi !== mi) return;
        m.result = simInstantMatch(rng, m.home.skill, m.away.skill, false, m.home.style, m.away.style, m.home.formation, m.away.formation, tGetHA(`g_${gi}_${ri}_${mi}`, resolveHomeAdv(m.home.name, m.away.name, tConfig, true, m.home.skill, m.away.skill)), m.home.strategy, m.away.strategy);
        applyBan(accumulateMatchStats(m.home, m.result.ftHome, m.result.ftAway, m.result.ftHome>m.result.ftAway, m.result.ftHome===m.result.ftAway, m.result.cards?.home, unavailSet));
        applyBan(accumulateMatchStats(m.away, m.result.ftAway, m.result.ftHome, m.result.ftAway>m.result.ftHome, m.result.ftHome===m.result.ftAway, m.result.cards?.away, unavailSet));
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
    const hasTP = tConfig.thirdPlace && qualified.length >= 4;
    const km = tConfig.koAllocMode;
    if (km === "seed") {
      const ko = buildKnockoutSeeded(qualified, hasTP);
      propagateKO(ko); setTKO(ko); setTPhase("knockout");
    } else {
      if (km === "random") { const ko=buildKnockoutRandom(qualified, hasTP, new RNG(Date.now())); propagateKO(ko); setTKO(ko); setTPhase("knockout"); }
      else if (km === "draw") { const rng = new RNG(Date.now()); const { ko, log } = buildKnockoutDraw(qualified, hasTP, rng); propagateKO(ko); setTKO(ko); setTKODrawLog(log); setTPhase("knockout"); }
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
    const ko = buildKOShell(first, hasTP); propagateKO(ko); setTKO(ko);
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
      const hasTP = tKOManual.hasTP;
      const ko = buildKOShell(first, hasTP); propagateKO(ko); setTKO(ko);
      setTPhase("knockout"); setTKOManual(null); return;
    }
    const first = tKOManual.matches.filter(m => m.home || m.away).map(m => ({ home: m.home, away: m.away, result: null, ...(!m.home || !m.away ? {bye:true} : {}) }));
    if (tKOManual.pool.length === 1) first.push({ home: tKOManual.pool[0], away: null, result: null, bye: true });
    const hasTP = tConfig.thirdPlace && first.length * 2 >= 4;
    const ko = buildKOShell(first, hasTP); propagateKO(ko); setTKO(ko);
    setTPhase("knockout"); setTKOManual(null);
  };
  const tSimKOMatch = (rng, m, legTarget, haKey) => {
    const haDefault = resolveKOHomeAdv(m, tConfig);
    const ov = tHomeAdvOverrides[haKey] || null;
    if (tConfig.koLegs === 1) return simInstantMatch(rng, m.home.skill, m.away.skill, true, m.home.style, m.away.style, m.home.formation, m.away.formation, tGetHA(haKey, haDefault), m.home.strategy, m.away.strategy);
    // 2-legged: each team hosts one leg by default; per-match override can change this
    let leg1HA, leg2HA;
    if (ov === "off") { leg1HA = null; leg2HA = null; }
    else { leg1HA = "home"; leg2HA = "away"; }
    const ag = tConfig.koAwayGoals && ov !== "off";
    if (legTarget === 1 || (!m.result && legTarget !== 0)) return simFirstLeg(rng, m.home.skill, m.away.skill, m.home.style, m.away.style, m.home.formation, m.away.formation, leg1HA, m.home.strategy, m.away.strategy);
    if ((legTarget === 2 || legTarget === undefined) && m.result?.partial) return simSecondLeg(rng, m.result, m.home.skill, m.away.skill, m.home.style, m.away.style, m.home.formation, m.away.formation, leg2HA, m.home.strategy, m.away.strategy, ag);
    if (legTarget === 0) return simTwoLegMatch(rng, m.home.skill, m.away.skill, m.home.style, m.away.style, m.home.formation, m.away.formation, leg1HA, leg2HA, m.home.strategy, m.away.strategy, ag);
    return m.result;
  };
  const tScorinateKO = (targetRi, targetMi, legTarget) => {
    const bulk = targetRi === -1 || targetMi === -1;
    const run = () => {
    const rng = new RNG(Date.now());
    const ko = JSON.parse(JSON.stringify(tKO));
    const localBans = {};
    for (const [k, v] of Object.entries(tPlayerStats)) { if ((v.suspended||0) > 0 || (v.injOut||0) > 0) localBans[k] = { suspended: v.suspended||0, injOut: v.injOut||0 }; }
    const buildUnavail = () => { const s = new Set(); for (const [k, v] of Object.entries(localBans)) { if ((v.suspended||0) > 0 || (v.injOut||0) > 0) s.add(k); } return s; };
    const applyBan = (info) => { if (info?.redKey) { if (!localBans[info.redKey]) localBans[info.redKey] = {suspended:0,injOut:0}; localBans[info.redKey].suspended += 1; } if (info?.injKey) { if (!localBans[info.injKey]) localBans[info.injKey] = {suspended:0,injOut:0}; localBans[info.injKey].injOut += info.injDur; } };
    const decLocal = (tms) => { for (const k of Object.keys(localBans)) { const tn = k.substring(0, k.indexOf("|")); if (tms.has(tn)) { if (localBans[k].suspended > 0) localBans[k].suspended--; if (localBans[k].injOut > 0) localBans[k].injOut--; } } };
    for (let ri = 0; ri < ko.rounds.length; ri++) {
      const koTeams = new Set();
      ko.rounds[ri].matches.forEach((m, mi) => { if (!m.home||!m.away) return; if (m.result&&!m.result.partial) return; if (m.result&&m.result.partial&&legTarget===1) return; if (!m.result&&legTarget===2) return; if (targetRi!==-1&&targetRi!==ri) return; if (targetMi!==-1&&targetMi!==mi) return; koTeams.add(m.home.name); koTeams.add(m.away.name); });
      if (koTeams.size > 0) { decrementBans(koTeams); decLocal(koTeams); }
      const unavailSet = buildUnavail();
      ko.rounds[ri].matches.forEach((m, mi) => {
        if (!m.home || !m.away) return;
        if (m.result && !m.result.partial) return;
        if (m.result && m.result.partial && legTarget === 1) return;
        if (!m.result && legTarget === 2) return;
        if (targetRi !== -1 && targetRi !== ri) return;
        if (targetMi !== -1 && targetMi !== mi) return;
        m.result = tSimKOMatch(rng, m, legTarget, `ko_${ri}_${mi}`);
          if(m.result && !m.result.partial) {
            if (m.result.twoLeg) {
              const l1h=m.result.leg1?.home||0,l1a=m.result.leg1?.away||0;
              applyBan(accumulateMatchStats(m.home,l1h,l1a,l1h>l1a,l1h===l1a,m.result.cards?.leg1?.home,unavailSet));
              applyBan(accumulateMatchStats(m.away,l1a,l1h,l1a>l1h,l1h===l1a,m.result.cards?.leg1?.away,unavailSet));
              const l2h=m.result.leg2?.home||0,l2a=m.result.leg2?.away||0;
              applyBan(accumulateMatchStats(m.home,l2a,l2h,l2a>l2h,l2h===l2a,m.result.cards?.leg2?.away,unavailSet));
              applyBan(accumulateMatchStats(m.away,l2h,l2a,l2h>l2a,l2h===l2a,m.result.cards?.leg2?.home,unavailSet));
            } else {
              const kw=koWinner(m); const hg=m.result.ftHome+(m.result.et?.home||0); const ag=m.result.ftAway+(m.result.et?.away||0);
              applyBan(accumulateMatchStats(m.home,hg,ag,kw===m.home,hg===ag&&!m.result.pen,m.result.cards?.home,unavailSet));
              applyBan(accumulateMatchStats(m.away,ag,hg,kw===m.away,hg===ag&&!m.result.pen,m.result.cards?.away,unavailSet));
            }
          }
      });
      propagateKO(ko);
    }
    const tp = ko.thirdPlace;
    if (tp?.home && tp?.away && (targetRi === -1 || targetRi === -2)) {
      const tpDone = tp.result && !tp.result.partial;
      if (!tpDone) { const tpTeams = new Set([tp.home.name,tp.away.name]); decrementBans(tpTeams); decLocal(tpTeams); const tpUnavail = buildUnavail(); tp.result = tSimKOMatch(rng, tp, legTarget, "tp"); if(tp.result&&!tp.result.partial){
            if (tp.result.twoLeg) {
              const tl1h=tp.result.leg1?.home||0,tl1a=tp.result.leg1?.away||0;
              applyBan(accumulateMatchStats(tp.home,tl1h,tl1a,tl1h>tl1a,tl1h===tl1a,tp.result.cards?.leg1?.home,tpUnavail));
              applyBan(accumulateMatchStats(tp.away,tl1a,tl1h,tl1a>tl1h,tl1h===tl1a,tp.result.cards?.leg1?.away,tpUnavail));
              const tl2h=tp.result.leg2?.home||0,tl2a=tp.result.leg2?.away||0;
              applyBan(accumulateMatchStats(tp.home,tl2a,tl2h,tl2a>tl2h,tl2h===tl2a,tp.result.cards?.leg2?.away,tpUnavail));
              applyBan(accumulateMatchStats(tp.away,tl2h,tl2a,tl2h>tl2a,tl2h===tl2a,tp.result.cards?.leg2?.home,tpUnavail));
            } else {
              const tw=koWinner(tp); const hg2=tp.result.ftHome+(tp.result.et?.home||0); const ag2=tp.result.ftAway+(tp.result.et?.away||0);
              applyBan(accumulateMatchStats(tp.home,hg2,ag2,tw===tp.home,hg2===ag2&&!tp.result.pen,tp.result.cards?.home,tpUnavail));
              applyBan(accumulateMatchStats(tp.away,ag2,hg2,tw===tp.away,hg2===ag2&&!tp.result.pen,tp.result.cards?.away,tpUnavail));
            }
          }}
    }
    setTKO(ko);
    const fm = ko.rounds[ko.rounds.length - 1].matches[0];
    if (fm?.result && !fm.result.partial && (!ko.thirdPlace || (ko.thirdPlace.result && !ko.thirdPlace.result.partial))) setTPhase("complete");
    if (bulk) setLoading(false);
    };
    if (bulk) { setLoading(true); setTimeout(run, 40); } else run();
  };


  return (
    <div style={{ ...ui, background: "#0a0f0c", color: "#c5c8c6", minHeight: "100vh", padding: "24px 18px" }}>
      <style>{APP_CSS}</style>
      {loading && <div style={{ position: "fixed", inset: 0, background: "#0a0f0cdd", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}><div style={{ width: 28, height: 28, border: "3px solid #1a221a", borderTop: "3px solid #627661", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /><span style={{ fontSize: 10, color: "#627661", letterSpacing: "0.15em" }}>SIMULATING…</span></div>}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 20, paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 3, height: 28, background: "linear-gradient(180deg, #d3ebd3 0%, #3d5343 100%)", borderRadius: 2 }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#d3ebd3", margin: 0, ...ui }}>Avium Football Engine</h1>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["live", "Live Match"], ["tournament", "Tournament"], ["docs", "Docs"]].map(([id, l]) => (
              <button key={id} onClick={() => { setTab(id); if (id === "docs") setTeamsOpen(false); else setTeamsOpen(true); }} style={{ ...chip, background: tab === id ? "#3d5343" : "transparent", color: tab === id ? "#fff" : "#6b7a6b", border: tab === id ? "1px solid #627661" : "1px solid #2a3a2a", boxShadow: tab === id ? "0 0 12px #3d534344" : "none" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* SHARED TEAMS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: teamsOpen ? 8 : 16, minHeight: 32 }}>
          <label onClick={() => setTeamsOpen(!teamsOpen)} style={{ ...lbl, margin: 0, cursor: "pointer", userSelect: "none" }}><span style={{ color: "#3b4a3b", marginRight: 6, fontSize: 8, display: "inline-block", transform: teamsOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>Teams <span style={{ color: "#3b4a3b", fontWeight: 400 }}>({teams.length})</span></label>
          <div style={{ display: "flex", gap: 6 }}>
            {teamsOpen && <select onChange={e => { if (e.target.value === "avium") loadPreset(PRESET_AVIUM); else if (e.target.value === "eur") loadPreset(PRESET_EUR); e.target.value = ""; }} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: "#3d5343", background: "transparent", cursor: "pointer" }}><option value="" hidden>☰ Preset</option><option value="avium">Avium (61)</option><option value="eur">European (46)</option></select>}
            {teamsOpen && <button onClick={exportState} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: showExport ? "#bf616a" : "#3d5343" }} title="Export teams">{showExport ? "✕ Export" : "💾"}</button>}
            {teamsOpen && <button onClick={() => setShowBulk(!showBulk)} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: showBulk ? "#bf616a" : "#3d5343" }}>{showBulk ? "✕ Close" : "📂"}</button>}
            {teamsOpen && <button onClick={addTeam} style={addBtn}>+ Add</button>}
          </div>
        </div>
        {teamsOpen && (<>
        {showExport && (<div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}><p style={{ fontSize: 10, color: "#6b7a6b", margin: "0 0 8px" }}>Copy this text and paste into Bulk Import to restore teams.</p><textarea readOnly value={exportTeamsText()} rows={10} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.7, fontSize: 9 }} onClick={e => e.target.select()} /><div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => { navigator.clipboard?.writeText(exportTeamsText()); setShowExport(false); }} style={{ ...addBtn, background: "#3d5343", color: "#fff", border: "none", padding: "6px 16px" }}>Copy to Clipboard</button></div></div>)}
        {showBulk && (<div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}><p style={{ fontSize: 10, color: "#6b7a6b", margin: "0 0 8px" }}>Tab-separated: Code ⇥ Name ⇥ Skill ⇥ Playstyle ⇥ Formation ⇥ 14 tactics ⇥ 16 players (optional)</p><p style={{ fontSize: 10, color: "#5a6e5a", margin: "0 0 8px" }}>Code is optional (auto-generated from name). Only Name is required; all other columns are optional. Player tiers: append [+] (above-avg) or [*] (star) to names.</p><textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"ARV\tArverne\t87\tBalanced\t4-2-3-1\tInto Space\tMore Direct\nNichirin\t86\tWing Play\t4-4-2\nPON\tPonurvia\t74"} rows={10} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.7 }} /><div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={importBulk} style={{ ...addBtn, background: "#3d5343", color: "#fff", border: "none", padding: "6px 16px" }}>Import {(()=>{const n=parseBulk(bulkText).length;return n>0?`(${n})`:""})()}</button><span style={{ fontSize: 10, color: "#5a6e5a" }}>Replaces current list</span></div></div>)}
        <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderBottom: "1px solid #1a221a" }}>
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
                }} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid " + (active ? "#3d5343" : "#1a221a"), background: active ? "#3d534322" : "transparent", color: active ? "#d3ebd3" : "#4c5a4c", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, letterSpacing: "0.08em" }}>{l} {active ? (dir === "asc" ? "↑" : "↓") : ""}</button>
              ); })}
            </div>
            {teams.length > 4 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: "#3b4a3b" }}>Trim to</span>
              {[16, 20, 24, 32, 36, 48].filter(n => n < teams.length).map(n => (
                <button key={n} onClick={() => setTeams(ts => ts.slice(0, n))} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, border: "1px solid #1a221a", background: "transparent", color: "#4c5a4c", cursor: "pointer", fontFamily: "inherit" }}>{n}</button>
              ))}
            </div>}
          </div>
          <div style={{ display: "flex", gap: 6, padding: "10px 12px 8px", borderBottom: "1px solid #1a221a", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5a6e5a" }}>
            <span style={{ width: 22, flexShrink: 0 }} /><span style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>Name</span><span style={{ width: 40, textAlign: "center", flexShrink: 0 }}>Code</span><span style={{ width: 52, textAlign: "center", flexShrink: 0 }}>Skill</span><span style={{ width: 32, textAlign: "center", flexShrink: 0, paddingRight: 6 }}>SQ</span><span style={{ width: 32, textAlign: "center", flexShrink: 0, paddingRight: 6 }}>TAC</span>{teams.length > 2 && <span style={{ width: 28, flexShrink: 0 }} />}
          </div>
          <div style={{ maxHeight: teams.length > 12 ? 520 : "none", overflowY: teams.length > 12 ? "auto" : "visible" }}>
            {teams.map((t, i) => { const badSkill = t.skill === "" || t.skill < 25 || t.skill > 100; const exp = expandedTeam === i; const strat = t.strategy || STRAT_DEF; const nonDefault = Object.entries(strat).filter(([,v]) => v !== 0).length; return (
              <div key={i}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 12px", background: exp ? "#141a14" : i % 2 === 0 ? "transparent" : "#0a0f0c08", cursor: "pointer" }} onClick={() => { if (lmMatch && lmMatch.phase !== 'pre_match') return; setExpandedTeam(exp ? null : i); if (!exp) setViewSquad(null); }}>
                <span style={{ color: "#5a6e5a", fontSize: 10, width: 22, textAlign: "right", flexShrink: 0, ...mono }}>{i + 1}</span>
                <input value={t.name} onClick={e => e.stopPropagation()} onChange={e => updateTeam(i, "name", e.target.value)} style={{ ...inp, flex: 1, minWidth: 0, padding: "5px 8px", border: "1px solid transparent", background: "transparent", fontSize: 13 }} onFocus={e => { e.target.style.borderColor = "#2a3a2a"; e.target.style.background = "#141a14"; }} onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
                <input value={t.code ?? abbr(t.name, t.code)} onClick={e => e.stopPropagation()} onChange={e => { const v = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3); updateTeam(i, "code", v); }} style={{ ...inp, width: 40, textAlign: "center", padding: "5px 4px", border: "1px solid transparent", background: "transparent", fontSize: 11, letterSpacing: "0.08em", color: t.code ? "#d3ebd3" : "#5a6e5a" }} placeholder={abbr(t.name, t.code)} onFocus={e => { e.target.style.borderColor = "#2a3a2a"; e.target.style.background = "#141a14"; }} onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
                <input type="number" value={t.skill} onClick={e => e.stopPropagation()} onChange={e => updateTeam(i, "skill", e.target.value)} style={{ ...inp, width: 52, textAlign: "center", padding: "5px 4px", border: "1px solid transparent", background: "transparent", borderColor: badSkill ? "#bf616a" : "transparent" }} onFocus={e => { if (!badSkill) { e.target.style.borderColor = "#2a3a2a"; e.target.style.background = "#141a14"; } }} onBlur={e => { if (!badSkill) { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; } }} />
                <span onClick={e => { e.stopPropagation(); if (lmMatch && lmMatch.phase !== 'pre_match') return; setViewSquad(viewSquad === i ? null : i); setExpandedTeam(null); }} style={{ width: 32, textAlign: "center", fontSize: 9, color: viewSquad === i ? "#d3ebd3" : t.squad?.some(p => !p.name.startsWith("#")) ? "#627661" : "#2a3a2a", flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600, letterSpacing: "0.04em", border: "1px solid " + (viewSquad === i ? "#3d5343" : t.squad?.some(p => !p.name.startsWith("#")) ? "#1a221a" : "transparent"), borderRadius: 4, padding: "2px 0", background: viewSquad === i ? "#3d534322" : "transparent" }}>{viewSquad === i ? "▾" : t.squad?.some(p => !p.name.startsWith("#")) ? t.squad.filter(p => !p.name.startsWith("#")).length : "–"}</span>
                <span style={{ width: 32, textAlign: "center", fontSize: 9, color: exp ? "#d3ebd3" : nonDefault > 0 ? "#627661" : "#2a3a2a", flexShrink: 0, whiteSpace: "nowrap", fontWeight: 600, border: "1px solid " + (exp ? "#3d5343" : nonDefault > 0 ? "#1a221a" : "transparent"), borderRadius: 4, padding: "2px 0", background: exp ? "#3d534322" : "transparent" }}>{exp ? "\u25BE" : nonDefault > 0 ? nonDefault : "\u2013"}</span>
                {teams.length > 2 && <button onClick={e => { e.stopPropagation(); removeTeam(i); }} style={{ ...delBtn, width: 28, opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>×</button>}
              </div>
              {viewSquad === i && !(lmMatch && lmMatch.phase && lmMatch.phase !== "pre_match") && (() => {
                const sq = t.squad || buildSquad(t.formation || "4-3-3", null);
                const starters = sq.filter(p => !p.bench);
                const bench = sq.filter(p => p.bench);
                // Formation pitch positions: parse formation, distribute layers vertically
                const FPOS2 = {
                  "4-4-2":[[50,93],[15,74],[38,76],[62,76],[85,74],[12,52],[38,54],[62,54],[88,52],[38,28],[62,28]],
                  "4-3-3":[[50,93],[15,74],[38,76],[62,76],[85,74],[33,52],[50,50],[67,52],[15,24],[50,20],[85,24]],
                  "4-2-3-1":[[50,93],[15,74],[38,76],[62,76],[85,74],[40,56],[60,56],[18,36],[50,32],[82,36],[50,14]],
                  "4-1-4-1":[[50,93],[15,74],[38,76],[62,76],[85,74],[50,56],[14,38],[40,40],[60,40],[86,38],[50,18]],
                  "4-1-2-1-2":[[50,93],[15,74],[38,76],[62,76],[85,74],[50,58],[40,44],[60,44],[50,30],[40,16],[60,16]],
                  "4-3-2-1":[[50,93],[15,74],[38,76],[62,76],[85,74],[33,54],[50,52],[67,54],[38,32],[62,32],[50,14]],
                  "4-2-4":[[50,93],[15,74],[38,76],[62,76],[85,74],[42,54],[58,54],[14,26],[40,22],[60,22],[86,26]],
                  "3-4-3":[[50,93],[30,76],[50,78],[70,76],[12,52],[40,54],[60,54],[88,52],[18,24],[50,20],[82,24]],
                  "3-5-2":[[50,93],[30,76],[50,78],[70,76],[10,50],[35,52],[50,48],[65,52],[90,50],[40,22],[60,22]],
                  "3-4-1-2":[[50,93],[30,76],[50,78],[70,76],[12,54],[40,56],[60,56],[88,54],[50,34],[40,16],[60,16]],
                  "5-3-2":[[50,93],[10,68],[30,76],[50,78],[70,76],[90,68],[33,48],[50,46],[67,48],[40,22],[60,22]],
                };
                const pitchPosRaw = FPOS2[t.formation] || (() => {
                  const layers = (t.formation||"4-3-3").split("-").map(Number);
                  const nR=layers.length+1,yT=12,yB=92,rG=(yB-yT)/(nR-1);
                  const pts=[[50,yB]];
                  layers.forEach((c,li)=>{const y=yB-(li+1)*rG;for(let j=0;j<c;j++){pts.push([c===1?50:12+(j*(76/(c-1))),y]);}});
                  return pts;
                })();
                const pitchPos = pitchPosRaw.map(p => Array.isArray(p) ? {x:p[0],y:p[1]} : p);
                return (<div style={{ padding: "12px 16px 14px 42px", background: "#0f1310", borderBottom: "1px solid #1a221a" }}>
                  <div style={{ display: "flex", gap: 20, marginBottom: 12, alignItems: "flex-start" }}>
                    <svg viewBox="0 0 100 105" style={{ width: 160, flexShrink: 0 }}>
                      <rect x="2" y="2" width="96" height="101" fill="#0f1a0f" stroke="#1e2a1e" strokeWidth="1" rx="2" />
                      <rect x="28" y="2" width="44" height="14" fill="none" stroke="#1e2a1e" strokeWidth="0.8" />
                      <rect x="28" y="89" width="44" height="14" fill="none" stroke="#1e2a1e" strokeWidth="0.8" />
                      <circle cx="50" cy="52" r="10" fill="none" stroke="#1e2a1e" strokeWidth="0.8" />
                      <line x1="2" y1="52" x2="98" y2="52" stroke="#1e2a1e" strokeWidth="0.8" />
                      {starters.map((p, pi2) => {
                        const pos = pitchPos[pi2];
                        if (!pos) return null;
                        return (<g key={pi2}>
                          <circle cx={pos.x} cy={pos.y} r="3.6" fill={POS_CLR[p.pos]||"#888"} opacity="0.9" />
                          <text x={pos.x} y={pos.y - 5.5} textAnchor="middle" fill="#8a9b8a" fontSize="3.6" fontFamily="monospace">{p.name.length > 10 ? p.name.slice(0,9)+"…" : p.name}</text>
                        </g>);
                      })}
                    </svg>
                    <div style={{ flex: 1, fontSize: 9, color: "#4c5a4c", paddingTop: 4, lineHeight: 1.6 }}>
                      <div style={{ color: "#627661", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{t.formation || "4-3-3"}</div>
                      <div>{STYLE_LBL[t.style] || "Balanced"}</div>
                      <div style={{ marginTop: 6, fontSize: 8 }}>{starters.filter(p=>p.pos==="DEF").length} DEF · {starters.filter(p=>p.pos==="MID").length} MID · {starters.filter(p=>p.pos==="FWD").length} FWD</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 8 }}>STARTING XI</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", marginBottom: 10 }}>
                    {starters.map((p, pi) => (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                        <span style={{ fontSize: 8, color: POS_CLR[p.pos], fontWeight: 700, width: 24, ...mono }}>{p.pos}</span>
                        <input value={p.name} onClick={e => e.stopPropagation()} onChange={e => {
                          const ns = [...sq]; ns[pi] = {...ns[pi], name: e.target.value};
                          updateTeam(i, "squad", ns);
                        }} style={{ ...inp, flex: 1, minWidth: 0, padding: "2px 6px", fontSize: 11, border: "1px solid transparent", background: "transparent" }}
                        onFocus={e => { e.target.style.borderColor = "#2a3a2a"; e.target.style.background = "#141a14"; }}
                        onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
                        <span onClick={e => { e.stopPropagation(); const ns = [...sq]; ns[pi] = {...ns[pi], tier: ((p.tier||0)+1)%3}; updateTeam(i, "squad", ns); }}
                          style={{ cursor: "pointer", width: 14, textAlign: "center", fontSize: 11, flexShrink: 0, color: p.tier===2?"#c9a84c":p.tier===1?"#7a9e7a":"#2a3a2a", fontWeight: 700, userSelect: "none" }}
                          title={p.tier===2?"Star → Average":p.tier===1?"Above Average → Star":"Average → Above Average"}>{p.tier===2?"★":p.tier===1?"+":"·"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, marginTop: 8 }}>BENCH</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px" }}>
                    {bench.map((p, pi) => (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                        <span style={{ fontSize: 8, color: POS_CLR[p.pos], fontWeight: 700, width: 24, ...mono }}>{p.pos}</span>
                        <input value={p.name} onClick={e => e.stopPropagation()} onChange={e => {
                          const ns = [...sq]; ns[11 + pi] = {...ns[11+pi], name: e.target.value};
                          updateTeam(i, "squad", ns);
                        }} style={{ ...inp, flex: 1, minWidth: 0, padding: "2px 6px", fontSize: 11, border: "1px solid transparent", background: "transparent", color: "#8a9b8a" }}
                        onFocus={e => { e.target.style.borderColor = "#2a3a2a"; e.target.style.background = "#141a14"; }}
                        onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }} />
                        <span onClick={e => { e.stopPropagation(); const ns = [...sq]; ns[11+pi] = {...ns[11+pi], tier: ((p.tier||0)+1)%3}; updateTeam(i, "squad", ns); }}
                          style={{ cursor: "pointer", width: 14, textAlign: "center", fontSize: 11, flexShrink: 0, color: p.tier===2?"#c9a84c":p.tier===1?"#7a9e7a":"#2a3a2a", fontWeight: 700, userSelect: "none" }}
                          title={p.tier===2?"Star → Average":p.tier===1?"Above Average → Star":"Average → Above Average"}>{p.tier===2?"★":p.tier===1?"+":"·"}</span>
                      </div>
                    ))}
                  </div>
                </div>);
              })()}
                            {exp && !(lmMatch && lmMatch.phase && lmMatch.phase !== "pre_match") && (<div style={{ padding: "12px 16px 14px 42px", background: "#0f1310", borderBottom: "1px solid #1a221a" }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 4 }}>STYLE</div>
                    <select value={t.style || "balanced"} onChange={e => updateTeam(i, "style", e.target.value)} style={{ ...inp, width: "100%", fontSize: 12, padding: "5px 6px", cursor: "pointer", color: STYLE_CLR[t.style || "balanced"] }}>{STYLE_GRP.map(([label, styles]) => <optgroup key={label} label={label}>{styles.map(s => <option key={s} value={s} style={{color:STYLE_CLR[s]}}>{STYLE_LBL[s]}</option>)}</optgroup>)}</select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 4 }}>FORMATION</div>
                    <select value={t.formation || "4-3-3"} onChange={e => updateTeam(i, "formation", e.target.value)} style={{ ...inp, width: "100%", fontSize: 12, padding: "5px 6px", cursor: "pointer", color: FORM_CLR[t.formation || "4-3-3"] || "#888" }}>{FORM_GRP.map(([label, forms]) => <optgroup key={label} label={label}>{forms.map(f => <option key={f} value={f} style={{color:FORM_CLR[f]}}>{f}</option>)}</optgroup>)}</select>
                  </div>
                </div>
                {(()=>{ let lastGrp = ""; return Object.entries(STRAT_LABELS).map(([key, {name, vals, grp}]) => {
                  const hdr = grp !== lastGrp; lastGrp = grp;
                  return (<div key={key}>{hdr && <div style={{ fontSize: 8, color: "#5a6e5a", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 10, marginBottom: 4 }}>{grp === "possession" ? "IN POSSESSION" : grp === "transition" ? "TRANSITION" : "DEFENSE"}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "#8a9b8a", width: 60, flexShrink: 0 }}>{name}</span>
                    <select value={strat[key] ?? 0} onChange={e => { const ns = {...(t.strategy || STRAT_DEF), [key]: +e.target.value}; updateTeam(i, "strategy", ns); }} style={{ ...inp, fontSize: 11, padding: "3px 6px", flex: 1, minWidth: 0, color: (strat[key] ?? 0) === 0 ? "#8a9b8a" : (strat[key] ?? 0) > 0 ? "#d08770" : "#81a1c1" }}>
                      {vals.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div></div>);
                }); })()}
              </div>)}
              </div>); })}
          </div>
          {teamErrors && <div style={{ fontSize: 10, color: "#bf616a", padding: "6px 12px", borderTop: "1px solid #1a221a" }}>Skill values must be between 25 and 100.</div>}
        </div>
        </>)}

        {/* ═══ LIVE MATCH TAB ═══ */}
        {tab === "live" && (<div>
          {/* Unified match controls — always at top */}
          <div style={{ marginBottom: 12 }}>
            {lmIsSetup && <>
              <button onClick={lmSimAll} disabled={teamErrors} className="tick-btn" style={{ ...scBtn, fontSize: 12, background: "linear-gradient(135deg, #4c5a4c 0%, #3b4a3b 100%)", opacity: teamErrors ? 0.4 : 1, cursor: teamErrors ? "default" : "pointer", marginBottom: 6 }}>⏩ Sim Entire Match</button>
              <button onClick={lmKickOff} disabled={teamErrors} className="tick-btn" style={{ ...scBtn, fontSize: 12, opacity: teamErrors ? 0.4 : 1, cursor: teamErrors ? "default" : "pointer" }}>⚽ Start Match</button>
            </>}
            {lmMatch && lmBl && <div style={{ display: "flex", gap: 8 }}><button onClick={lmTick} className="tick-btn" style={{ ...scBtn, flex: 1 }}>{lmBl}</button><button onClick={lmSimAll} className="tick-btn" style={{ ...scBtn, flex: "0 0 auto", width: "auto", padding: "12px 20px", background: "linear-gradient(135deg, #4c5a4c 0%, #3b4a3b 100%)", fontSize: 11 }}>⏩ Sim to End</button></div>}
            {lmMatch?.phase === "finished" && <div style={{ display: "flex", gap: 8 }}>
              <button onClick={lmReset} className="tick-btn" style={{ ...scBtn, flex: 1, background: "linear-gradient(135deg, #4c5a4c 0%, #3b4a3b 100%)" }}>New Match</button>
              <button onClick={() => setShowReport(!showReport)} className="tick-btn" style={{ ...scBtn, flex: "0 0 auto", width: "auto", padding: "12px 16px", background: showReport ? "linear-gradient(135deg, #bf616a 0%, #a04050 100%)" : "linear-gradient(135deg, #81a1c1 0%, #5e81ac 100%)", fontSize: 10 }}>{showReport ? "✕ Close" : "📋 Report"}</button>
            </div>}
          </div>
          {/* Match Report — screenshottable */}
          {showReport && lmMatch?.phase === "finished" && (() => {
            const hN = teams[lmH]?.name, aN = teams[lmA]?.name;
            const hS = lmMatch.score[0], aS = lmMatch.score[1];
            const ph = lmMatch.possCount.home, pa = lmMatch.possCount.away, pt = ph+pa||1;
            const hp = Math.round(ph/pt*100), ap = 100-hp;
            const st = lmMatch.stats;
            const allP = [...(lmMatch.players?.home||[]),...(lmMatch.subbedOff?.home||[]),...(lmMatch.players?.away||[]),...(lmMatch.subbedOff?.away||[])];
            const motm = allP.length > 0 ? allP.reduce((best,p) => !best || p.rating > best.rating ? p : best, null) : null;

            const hXG = (lmMatch.xG?.home||0).toFixed(2), aXG = (lmMatch.xG?.away||0).toFixed(2);
            const statRows = [["Possession",hp+"%",ap+"%"],["Shots",st.home.shots,st.away.shots],["On Target",st.home.onTarget,st.away.onTarget],["xG",hXG,aXG],["Corners",st.home.corners,st.away.corners],["Fouls",st.home.fouls,st.away.fouls],["Yellows",st.home.yellows,st.away.yellows],["Reds",st.home.reds,st.away.reds]];
            return (
              <div style={{ background: "#0a0f0c", border: "1px solid #1a221a", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                {/* Scoreboard */}
                <div style={{ textAlign: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #1a221a" }}>
                  {motm && <div style={{ fontSize: 8, color: "#c9a84c", marginBottom: 6 }}>★ {motm.name} ({motm.rating?.toFixed(1)})</div>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#d3ebd3" }}>{hN}</div>
                      <div style={{ fontSize: 9, color: "#4c5a4c", ...mono }}>{teams[lmH]?.skill}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#d3ebd3", letterSpacing: 2 }}>{hS}<span style={{ color: "#1e2a1e", margin: "0 4px" }}>:</span>{aS}</div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#d3ebd3" }}>{aN}</div>
                      <div style={{ fontSize: 9, color: "#4c5a4c", ...mono }}>{teams[lmA]?.skill}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6 }}>
                    <div style={{ flex: 1, textAlign: "right", fontSize: 9, color: "#627661", lineHeight: 1.5 }}>
                      {lmMatch.goalscorers?.home?.map((g,i) => <div key={i}>{g.name} {g.min}'{g.method==="og"?" (OG)":""}</div>)}
                    </div>
                    <div style={{ width: 1, background: "#1a221a" }} />
                    <div style={{ flex: 1, textAlign: "left", fontSize: 9, color: "#627661", lineHeight: 1.5 }}>
                      {lmMatch.goalscorers?.away?.map((g,i) => <div key={i}>{g.name} {g.min}'{g.method==="og"?" (OG)":""}</div>)}
                    </div>
                  </div>
                </div>
                {/* Match Summary */}
                {summaryRef.current && <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #1a221a" }}>
                  <div style={{ fontSize: 11, color: "#b0b8b0", lineHeight: 1.7 }}>{summaryRef.current}</div>
                </div>}
                {/* Match Stats */}
                <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #1a221a" }}>
                  {statRows.map(([label, h, a], i) => { const hv = typeof h === "string" ? parseFloat(h) : h; const av = typeof a === "string" ? parseFloat(a) : a; const mx = Math.max(hv, av, 1); return (
                    <div key={i} style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 11 }}>
                      <span style={{ width: 32, textAlign: "right", color: hv >= av ? "#8ab4e0" : "#4c5a4c", fontWeight: hv >= av ? 600 : 400, ...mono, fontSize: 10, flexShrink: 0 }}>{h}</span>
                      <div style={{ flex: 1, margin: "0 4px", display: "flex", justifyContent: "flex-end" }}><div style={{ width: `${Math.round(hv/mx*100)}%`, height: 4, background: hv >= av ? "#4a7ab588" : "#1a221a", borderRadius: 2 }} /></div>
                      <span style={{ width: 60, textAlign: "center", color: "#4c5a4c", fontSize: 9, flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, margin: "0 4px", display: "flex", justifyContent: "flex-start" }}><div style={{ width: `${Math.round(av/mx*100)}%`, height: 4, background: av >= hv ? "#b55a5a88" : "#1a221a", borderRadius: 2 }} /></div>
                      <span style={{ width: 32, textAlign: "left", color: av >= hv ? "#e08a8a" : "#4c5a4c", fontWeight: av >= hv ? 600 : 400, ...mono, fontSize: 10, flexShrink: 0 }}>{a}</span>
                    </div>
                  ); })}
                </div>
                {/* Player Ratings */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }}>
                {["home","away"].map((side,si) => {
                  const tm = side === "home" ? teams[lmH] : teams[lmA];
                  const sq = tm?.squad || buildSquad(tm?.formation, null);
                  const onPitch = lmMatch.players[side] || [];
                  const off = lmMatch.subbedOff?.[side] || [];
                  const bench = lmMatch.bench?.[side] || [];
                  const lookup = (name) => onPitch.find(p=>p.name===name) || off.find(p=>p.name===name) || bench.find(p=>p.name===name);
                  const starters = sq.filter(p=>!p.bench);
                  const benchSq = sq.filter(p=>p.bench);
                  return (<>
                  {si === 1 && <div style={{ background: "#1a221a" }}></div>}
                  <div>
                    <div style={{ fontSize: 8, color: "#5a6e5a", letterSpacing: "0.1em", marginBottom: 4 }}>{tm?.name?.toUpperCase()}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 18px 18px 28px 12px", gap: "0px 2px", fontSize: 9, alignItems: "center" }}>
                      <span style={{ color: "#5a6e5a", fontSize: 7 }}>POS</span>
                      <span style={{ color: "#5a6e5a", fontSize: 7 }}>PLAYER</span>
                      <span style={{ color: "#5a6e5a", fontSize: 7, textAlign: "center" }}>G</span>
                      <span style={{ color: "#5a6e5a", fontSize: 7, textAlign: "center" }}>A</span>
                      <span style={{ color: "#5a6e5a", fontSize: 7, textAlign: "center" }}>RTG</span>
                      <span></span>
                      {starters.map((sq2,pi) => { const p = lookup(sq2.name) || {rating:6.0,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false}; const isOff = off.some(x=>x.name===sq2.name); const isOn = onPitch.some(x=>x.name===sq2.name&&x.sub==='on'); return (<>
                        <span key={"p"+pi} style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                        <span style={{ color: isOff?"#627661":"#c5c8c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{TB(sq2.tier)}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}</span>
                        <span style={{ textAlign: "center", color: p.goals>0?"#d3ebd3":"#2a3a2a", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                        <span style={{ textAlign: "center", color: p.assists>0?"#d3ebd3":"#2a3a2a", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                        <span style={{ textAlign: "center", color: p.rating>=7.5?"#a3be8c":p.rating>=6.0?"#c5c8c6":"#bf616a", fontWeight: 600, ...mono }}>{p.rating!=null?p.rating.toFixed(1):"\u2013"}</span>
                        <span style={{ fontSize: 7, color: isOff?"#bf616a":"#3b4a3b", textAlign: "center" }}>{isOff?"\u25BC":""}</span>
                      </>); })}
                      <span style={{ gridColumn: "1/-1", borderTop: "1px solid #1a221a", marginTop: 2, marginBottom: 2 }}></span>
                      {[...benchSq].sort((a,b) => { const aOn = onPitch.some(x=>x.name===a.name); const bOn = onPitch.some(x=>x.name===b.name); return aOn===bOn?0:aOn?-1:1; }).map((sq2,pi) => { const p = lookup(sq2.name) || {rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false}; const isOn = onPitch.some(x=>x.name===sq2.name); return (<>
                        <span key={"b"+pi} style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                        <span style={{ color: isOn?"#c5c8c6":"#4c5a4c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{TB(sq2.tier)}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}</span>
                        <span style={{ textAlign: "center", color: p.goals>0?"#d3ebd3":"#2a3a2a", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                        <span style={{ textAlign: "center", color: p.assists>0?"#d3ebd3":"#2a3a2a", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                        <span style={{ textAlign: "center", color: !isOn?"#2a3a2a":p.rating>=7.5?"#a3be8c":p.rating>=6.0?"#c5c8c6":"#bf616a", fontWeight: 600, ...mono }}>{isOn&&p.rating!=null?p.rating.toFixed(1):"\u2013"}</span>
                        <span style={{ fontSize: 7, color: isOn?"#a3be8c":"#3b4a3b", textAlign: "center" }}>{isOn?"\u25B2":""}</span>
                      </>); })}
                    </div>
                  </div>
                  </>);
                })}
                </div>
              </div>
            );
          })()}
          {lmIsSetup && (<div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 22, marginBottom: 24, boxShadow: "0 2px 12px #00000022" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                <select value={lmH} onChange={e => { setLmH(+e.target.value); setLmMatch(null); }} style={{ ...inp, width: "100%", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>{teams.map((t, i) => <option key={i} value={i}>{t.name} ({t.skill})</option>)}</select>
                <span style={{ fontSize: 12, color: "#3b4a3b", letterSpacing: "0.2em", fontWeight: 700, ...ui }}>VS</span>
                <select value={lmA} onChange={e => { setLmA(+e.target.value); setLmMatch(null); }} style={{ ...inp, width: "100%", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>{teams.map((t, i) => <option key={i} value={i}>{t.name} ({t.skill})</option>)}</select>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #1a221a", paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {[[lmForce, e => setLmForce(e), "Force Result", "ET + Penalties"], [lmAllowTac, e => setLmAllowTac(e), "Auto Tempo", "AI manages tempo"]].map(([checked, onChange, label, sub], i) => (
                  <label key={i} onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0" }}>
                    <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#3d5343" : "#1a221a", border: "1px solid " + (checked ? "#627661" : "#2a3a2a"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#d3ebd3" : "#3b4a3b", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: checked ? "#d3ebd3" : "#6b7a6b", fontWeight: 500, lineHeight: 1.2 }}>{label}</div>
                      <div style={{ fontSize: 9, color: "#3b4a3b", lineHeight: 1.2 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1a221a" }}>
                <div style={{ fontSize: 10, color: "#4c5a4c", marginBottom: 8, fontWeight: 600, letterSpacing: "0.08em", textAlign: "center" }}>HOME ADVANTAGE</div>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #1a221a" }}>
                  {[["home", teams[lmH]?.name || "Home"], [null, "Neutral"], ["away", teams[lmA]?.name || "Away"]].map(([val, label]) => (
                    <button key={label} onClick={() => setLmHomeAdv(val)} style={{ flex: 1, padding: "8px 6px", background: lmHomeAdv === val ? "#3d5343" : "transparent", color: lmHomeAdv === val ? "#d3ebd3" : "#4c5a4c", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: lmHomeAdv === val ? 600 : 400, transition: "all 0.15s", borderRight: val !== "away" ? "1px solid #1a221a" : "none" }}>{label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "#3b4a3b", textAlign: "center", marginTop: 4 }}>{lmHomeAdv ? "+3% skill bonus" : "No advantage"}</div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1a221a" }}>
                <div style={{ fontSize: 10, color: "#4c5a4c", marginBottom: 8, fontWeight: 600, letterSpacing: "0.08em", textAlign: "center" }}>AGGREGATE SCORING</div>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #1a221a" }}>
                  {[[false, "Off"], [true, "2nd Leg"]].map(([val, label]) => (
                    <button key={label} onClick={() => { setLm2ndLeg(val); if (!val) setLmStartScore([0, 0]); }} style={{ flex: 1, padding: "8px 6px", background: lm2ndLeg === val ? "#3d5343" : "transparent", color: lm2ndLeg === val ? "#d3ebd3" : "#4c5a4c", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: lm2ndLeg === val ? 600 : 400, transition: "all 0.15s", borderRight: !val ? "1px solid #1a221a" : "none" }}>{label}</button>
                  ))}
                </div>
                {lm2ndLeg && <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: "#3b4a3b", textAlign: "center", marginBottom: 6 }}>1st leg result</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#0a0f0c", border: "1px solid #1a221a", borderRadius: 6, padding: "8px 12px" }}>
                    <span style={{ fontSize: 11, color: "#888", flex: 1, textAlign: "right" }}>{teams[lmH]?.name}</span>
                    <input type="number" min="0" max="99" value={lmStartScore[0]} onChange={e => setLmStartScore(s => [Math.max(0, +e.target.value || 0), s[1]])} style={{ ...inp, width: 44, padding: "6px 4px", fontSize: 16, textAlign: "center", fontWeight: 600, ...mono }} />
                    <span style={{ color: "#3b4a3b", fontSize: 14 }}>–</span>
                    <input type="number" min="0" max="99" value={lmStartScore[1]} onChange={e => setLmStartScore(s => [s[0], Math.max(0, +e.target.value || 0)])} style={{ ...inp, width: 44, padding: "6px 4px", fontSize: 16, textAlign: "center", fontWeight: 600, ...mono }} />
                    <span style={{ fontSize: 11, color: "#888", flex: 1 }}>{teams[lmA]?.name}</span>
                  </div>
                </div>}
                {!lm2ndLeg && <div style={{ fontSize: 9, color: "#3b4a3b", textAlign: "center", marginTop: 4 }}>Single match</div>}
              </div>
            </div>
            {teamErrors && <div style={{ fontSize: 10, color: "#bf616a", marginBottom: 12 }}>Fix skill values (25–100) before playing.</div>}
          </div>)}
          {lmMatch && (<>
            <div style={{ background: "linear-gradient(145deg, #0f1310 0%, #141a14 50%, #0f1310 100%)", border: "1px solid #1a221a", borderRadius: 10, padding: "14px 20px 12px", marginBottom: 12, textAlign: "center", boxShadow: "0 4px 20px #00000040" }}>
              {/* Phase badge */}
              {lmMatch.phase === "finished" && (()=>{
                const allP = [...(lmMatch.players?.home||[]),...(lmMatch.subbedOff?.home||[]),...(lmMatch.players?.away||[]),...(lmMatch.subbedOff?.away||[])];
                if (allP.length === 0) return null;
                const potm = allP.reduce((a,b) => (b.rating||0)>(a.rating||0)?b:a, allP[0]);
                if (!potm || potm.rating < 6.5) return null;
                const isHome = [...(lmMatch.players?.home||[]),...(lmMatch.subbedOff?.home||[])].some(p=>p.name===potm.name);
                const tName = isHome ? teams[lmH]?.name : teams[lmA]?.name;
                return (<div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#c9a84c14", border: "1px solid #c9a84c33", borderRadius: 6, padding: "3px 10px", marginBottom: 8 }}>
                  <span style={{ fontSize: 11 }}>⭐</span>
                  <span style={{ fontSize: 10, color: "#c9a84c", fontWeight: 600 }}>{potm.name}</span>
                  <span style={{ fontSize: 8, color: "#627661" }}>{tName}</span>
                  <span style={{ fontSize: 10, color: "#d3ebd3", fontWeight: 700, ...mono }}>{potm.rating.toFixed(1)}</span>
                </div>);
              })()}
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: lmMatch.phase === "finished" ? "#d3ebd3" : "#4c5a4c", marginBottom: 10 }}>
                {lmMatch.phase === "pre_match" ? "PRE-MATCH" : lmMatch.phase === "first_half" ? "1ST HALF" : lmMatch.phase === "half_time" ? "HALF TIME" : lmMatch.phase === "second_half" ? "2ND HALF" : lmMatch.phase === "full_time" ? "FULL TIME" : lmMatch.phase === "extra_first" ? "EXTRA TIME" : lmMatch.phase === "extra_half_time" ? "ET HALF TIME" : lmMatch.phase === "extra_second" ? "EXTRA TIME" : lmMatch.phase === "penalties" ? "PENALTIES" : lmMatch.phase === "finished" ? "FULL TIME" : ""}
              </div>
              {/* Pre-match tactical preview */}
              {lmMatch.phase === "pre_match" && (()=>{
                const SC = {balanced:"#888",gegenpress:"#bf616a",tikitaka:"#ebcb8b",counterattack:"#81a1c1",wingplay:"#a3be8c",parkthebus:"#d08770"};
                const PitchSVG = ({squad, formation}) => {
                  const starters = (squad||[]).filter(p => !p.bench);

                  const FPOS = {
                    "4-4-2":   [[50,93],[15,74],[38,76],[62,76],[85,74],[12,52],[38,54],[62,54],[88,52],[38,28],[62,28]],
                    "4-3-3":   [[50,93],[15,74],[38,76],[62,76],[85,74],[33,52],[50,50],[67,52],[15,24],[50,20],[85,24]],
                    "4-2-3-1": [[50,93],[15,74],[38,76],[62,76],[85,74],[40,56],[60,56],[18,36],[50,32],[82,36],[50,14]],
                    "4-1-4-1": [[50,93],[15,74],[38,76],[62,76],[85,74],[50,56],[14,38],[40,40],[60,40],[86,38],[50,18]],
                    "4-1-2-1-2":[[50,93],[15,74],[38,76],[62,76],[85,74],[50,58],[40,44],[60,44],[50,30],[40,16],[60,16]],
                    "4-3-2-1": [[50,93],[15,74],[38,76],[62,76],[85,74],[33,54],[50,52],[67,54],[38,32],[62,32],[50,14]],
                    "4-2-4":   [[50,93],[15,74],[38,76],[62,76],[85,74],[42,54],[58,54],[14,26],[40,22],[60,22],[86,26]],
                    "3-4-3":   [[50,93],[30,76],[50,78],[70,76],[12,52],[40,54],[60,54],[88,52],[18,24],[50,20],[82,24]],
                    "3-5-2":   [[50,93],[30,76],[50,78],[70,76],[10,50],[35,52],[50,48],[65,52],[90,50],[40,22],[60,22]],
                    "3-4-1-2": [[50,93],[30,76],[50,78],[70,76],[12,54],[40,56],[60,56],[88,54],[50,34],[40,16],[60,16]],
                    "5-3-2":   [[50,93],[10,68],[30,76],[50,78],[70,76],[90,68],[33,48],[50,46],[67,48],[40,22],[60,22]],
                  };
                  const pitchPos2 = FPOS[formation] || (() => {
                    const layers = (formation||"4-3-3").split("-").map(Number);
                    const nR = layers.length+1, yT=12, yB=90, rG=(yB-yT)/(nR-1);
                    const pts = [{x:50,y:yB}];
                    layers.forEach((c,li)=>{const y=yB-(li+1)*rG;for(let j=0;j<c;j++){pts.push({x:c===1?50:15+(j*(70/(c-1))),y});}});
                    return pts;
                  })();
                  const pp = pitchPos2.map(p => Array.isArray(p) ? {x:p[0],y:p[1]} : p);
                  return (<svg viewBox="0 0 100 100" style={{ width: "100%", height: "auto" }}>
                    <rect x="1" y="1" width="98" height="98" fill="#111a11" stroke="#1e2a1e" strokeWidth="0.6" rx="1.5" />
                    <rect x="26" y="1" width="48" height="13" fill="none" stroke="#1e2a1e" strokeWidth="0.5" />
                    <rect x="37" y="1" width="26" height="5" fill="none" stroke="#1e2a1e" strokeWidth="0.35" />
                    <rect x="26" y="86" width="48" height="13" fill="none" stroke="#1e2a1e" strokeWidth="0.5" />
                    <rect x="37" y="94" width="26" height="5" fill="none" stroke="#1e2a1e" strokeWidth="0.35" />
                    <circle cx="50" cy="50" r="9" fill="none" stroke="#1e2a1e" strokeWidth="0.5" />
                    <line x1="1" y1="50" x2="99" y2="50" stroke="#1e2a1e" strokeWidth="0.5" />
                    {starters.map((p, pi) => {
                      const pos = pp[pi]; if (!pos) return null;
                      return (<g key={pi}>
                        <circle cx={pos.x} cy={pos.y} r="2.8" fill={POS_CLR[p.pos]||"#888"} opacity="0.85" stroke="#0a0f0c" strokeWidth="0.4" />
                        <text x={pos.x} y={pos.y - 4.5} textAnchor="middle" fill="#c5c8c6" fontSize="2.4" fontFamily="monospace" fontWeight="500">{p.name}</text>
                      </g>);
                    })}
                  </svg>);
                };
                return (<div style={{ marginTop: 10, marginBottom: 6 }}>
                  {/* Team names flanking score */}
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginBottom: 4 }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: 13, color: "#c5c8c6", fontWeight: 600 }}>{teams[lmH]?.name}</div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center", marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: SC[teams[lmH]?.style]||"#888", fontWeight: 600 }}>{STYLE_LBL[teams[lmH]?.style]||"Balanced"}</span>
                        <span style={{ fontSize: 9, color: "#3b4a3b" }}>·</span>
                        <span style={{ fontSize: 9, color: "#627661", ...mono }}>{teams[lmH]?.formation||"4-3-3"}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "center", flexShrink: 0, padding: "0 8px" }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: "#d3ebd3", letterSpacing: "0.04em", lineHeight: 1 }}>0 <span style={{ color: "#3b4a3b", fontSize: 20 }}>:</span> 0</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 13, color: "#c5c8c6", fontWeight: 600 }}>{teams[lmA]?.name}</div>
                      <div style={{ display: "flex", justifyContent: "flex-start", gap: 6, alignItems: "center", marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: SC[teams[lmA]?.style]||"#888", fontWeight: 600 }}>{STYLE_LBL[teams[lmA]?.style]||"Balanced"}</span>
                        <span style={{ fontSize: 9, color: "#3b4a3b" }}>·</span>
                        <span style={{ fontSize: 9, color: "#627661", ...mono }}>{teams[lmA]?.formation||"4-3-3"}</span>
                      </div>
                    </div>
                  </div>
                  {/* Formation pitches */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }} className="pre-match-grid">
                    {[{side:"home",idx:lmH},{side:"away",idx:lmA}].map(({side,idx}) => {
                      const t = teams[idx];
                      const sq = t?.squad || buildSquad(t?.formation || "4-3-3", null);
                      return (<div key={side}>
                        <PitchSVG squad={sq} formation={t?.formation} />
                      </div>);
                    })}
                  </div>
                </div>);
              })()}
              {/* Score - hide during pre-match since preview shows it */}
              {lmMatch.phase !== "pre_match" && <>
              {/* Teams + Score row */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 12, marginBottom: 2 }}>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#d3ebd3", ...ui, borderBottom: lmMatch.possession === "home" ? "2px solid #627661" : "2px solid transparent", paddingBottom: 2, transition: "border-color 0.3s", display: "inline-block" }}>{teams[lmH]?.name}</div>
                    {(lmMatch.stats.home.reds > 0 || lmMatch.stats.home.injuries > 0) && <span style={{ fontSize: 10, marginLeft: 6 }}>{Array.from({length:lmMatch.stats.home.reds},(_,i)=><span key={"r"+i} style={{display:"inline-block",width:7,height:10,background:"#bf616a",borderRadius:1,marginRight:2,verticalAlign:"middle"}} />)}</span>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#4c5a4c", ...mono }}>{teams[lmH]?.skill}</span>
                  </div>
                  {lmMatch.goalscorers?.home?.length > 0 && <div style={{ fontSize: 9, color: "#627661", marginTop: 3, lineHeight: 1.6 }}>{Object.entries(lmMatch.goalscorers.home.reduce((a,g) => { const k=g.name+(g.method==="og"?" (OG)":""); a[k]=a[k]||[]; a[k].push(g.min); return a; }, {})).map(([n,mins]) => <div key={n}>{n} {mins.map(m=>m+"'").join(", ")}</div>)}</div>}
                </div>
                <div style={{ textAlign: "center", flexShrink: 0, paddingTop: 0 }}>
                  <div style={{ fontSize: 48, fontWeight: 700, color: "#d3ebd3", letterSpacing: "0.02em", lineHeight: 1 }}>
                    <span className={goalFlash==="home"?"goal-flash":""}>{lmMatch.score[0]}</span>
                    {(lmMatch.startScore[0]>0||lmMatch.startScore[1]>0) && <span style={{ fontSize: 15, fontWeight: 400, color: "#627661", verticalAlign: "top", marginLeft: 3, ...mono }}>({lmMatch.score[0]+lmMatch.startScore[0]})</span>}
                    <span style={{ color: "#1e2a1e", fontSize: 28, margin: "0 8px" }}>:</span>
                    {(lmMatch.startScore[0]>0||lmMatch.startScore[1]>0) && <span style={{ fontSize: 15, fontWeight: 400, color: "#627661", verticalAlign: "top", marginRight: 3, ...mono }}>({lmMatch.score[1]+lmMatch.startScore[1]})</span>}
                    <span className={goalFlash==="away"?"goal-flash":""}>{lmMatch.score[1]}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#627661", letterSpacing: "0.12em", marginTop: 6 }}>{lmClockDisplay(lmMatch)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  {(lmMatch.stats.away.reds > 0 || lmMatch.stats.away.injuries > 0) && <span style={{ fontSize: 10, marginRight: 6 }}>{Array.from({length:lmMatch.stats.away.reds},(_,i)=><span key={"r"+i} style={{display:"inline-block",width:7,height:10,background:"#bf616a",borderRadius:1,marginRight:2,verticalAlign:"middle"}} />)}</span>}
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#d3ebd3", ...ui, borderBottom: lmMatch.possession === "away" ? "2px solid #627661" : "2px solid transparent", paddingBottom: 2, transition: "border-color 0.3s", display: "inline-block" }}>{teams[lmA]?.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#4c5a4c", ...mono }}>{teams[lmA]?.skill}</span>
                  </div>
                  {lmMatch.goalscorers?.away?.length > 0 && <div style={{ fontSize: 9, color: "#627661", marginTop: 3, lineHeight: 1.6 }}>{Object.entries(lmMatch.goalscorers.away.reduce((a,g) => { const k=g.name+(g.method==="og"?" (OG)":""); a[k]=a[k]||[]; a[k].push(g.min); return a; }, {})).map(([n,mins]) => <div key={n}>{n} {mins.map(m=>m+"'").join(", ")}</div>)}</div>}
                </div>
              </div>
              </>}
              {/* Penalties */}
              {lmMatch.penalties && (()=>{
                const pen = lmMatch.penalties;
                const hS=pen.home.filter(k=>k.scored).length, aS=pen.away.filter(k=>k.scored).length;
                // Goal SVG component: shows ball positions and keeper dives
                const GoalSVG = ({kicks, label, flip}) => {
                  const W=180,H=80,gL=20,gR=160,gT=8,gB=72;
                  // Zone positions: [TL,TC,TR,BL,BC,BR] → x,y within goal
                  const zPos=[[gL+22,gT+18],[gL+70,gT+14],[gR-22,gT+18],[gL+22,gB-16],[gL+70,gB-12],[gR-22,gB-16]];
                  // Dive positions (keeper): L=left third, C=center, R=right third
                  const dX=[(gL+gR)/2-36,(gL+gR)/2,(gL+gR)/2+36];
                  const dY=(gT+gB)/2+4;
                  // Miss positions (outside goal)
                  const mPos=[[gL-4,gT-6],[gL+70,gT-10],[gR+4,gT-6],[gL-8,gB+4],[gL+70,gB+8],[gR+8,gB+4]];
                  return (<svg viewBox={`0 0 ${W} ${H+10}`} style={{width:"100%",maxWidth:180,height:"auto",display:"block"}}>
                    <rect x="0" y="0" width={W} height={H+10} fill="transparent" />
                    {/* Goal frame */}
                    <rect x={gL} y={gT} width={gR-gL} height={gB-gT} fill="#0a0f0c" stroke="#3d5343" strokeWidth="2.5" rx="1" />
                    {/* Net lines */}
                    <line x1={gL+47} y1={gT} x2={gL+47} y2={gB} stroke="#1a221a" strokeWidth="0.5" />
                    <line x1={gL+93} y1={gT} x2={gL+93} y2={gB} stroke="#1a221a" strokeWidth="0.5" />
                    <line x1={gL} y1={(gT+gB)/2} x2={gR} y2={(gT+gB)/2} stroke="#1a221a" strokeWidth="0.5" />
                    {/* Penalty spot */}
                    <circle cx={(gL+gR)/2} cy={gB+7} r="1.5" fill="#3d5343" />
                    {/* Kicks */}
                    {kicks.map((k,i) => {
                      const isLast = i === kicks.length-1;
                      const pos = k.result==="miss" ? mPos[k.zone] : zPos[k.zone];
                      const r = isLast ? 5.5 : 3.5;
                      const col = k.result==="goal"?"#a3be8c":k.result==="save"?"#bf616a":"#627661";
                      return (<>
                        {/* Keeper dive indicator for last kick */}
                        {isLast && <rect x={dX[k.dive]-14} y={dY-16} width={28} height={32} rx="3" fill={k.result==="save"?"#bf616a22":"#ffffff08"} stroke={k.result==="save"?"#bf616a44":"#ffffff15"} strokeWidth="1" />}
                        {/* Ball */}
                        <circle cx={pos[0]} cy={pos[1]} r={r} fill={col} opacity={isLast?1:0.6} />
                        {k.result==="miss" && <text x={pos[0]} y={pos[1]+1} textAnchor="middle" dominantBaseline="middle" fill="#627661" fontSize={isLast?"9":"7"} fontWeight="700">×</text>}
                        {isLast && k.result==="goal" && <text x={pos[0]} y={pos[1]+1} textAnchor="middle" dominantBaseline="middle" fill="#0a0f0c" fontSize="7" fontWeight="700">✓</text>}
                      </>);
                    })}
                    {/* Label */}
                    <text x={W/2} y={H+9} textAnchor="middle" fill="#4c5a4c" fontSize="7" fontFamily="monospace">{label}</text>
                  </svg>);
                };
                return (<div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1a221a" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, justifyContent: "center" }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#d3ebd3", ...mono }}>{hS}</span>
                    <span style={{ fontSize: 9, color: "#4c5a4c", letterSpacing: "0.15em" }}>PENALTIES</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#d3ebd3", ...mono }}>{aS}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0 6px", alignItems: "start" }}>
                    {/* Home goal */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <GoalSVG kicks={pen.home} label={abbr(teams[lmH]?.name,teams[lmH]?.code)} />
                    </div>
                    {/* Center: kick list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingTop: 4 }}>
                      {Array.from({length: Math.max(pen.home.length, pen.away.length)}, (_,i) => {
                        const h = pen.home[i], a = pen.away[i];
                        return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 9 }}>
                          <span style={{ width: 60, textAlign: "right", color: h ? (h.scored ? "#a3be8c" : "#bf616a") : "#1a221a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{h?.name||""}</span>
                          <span style={{ color: h ? (h.scored ? "#a3be8c" : "#bf616a") : "#1a221a", fontSize: 12, width: 14, textAlign: "center" }}>{h ? (h.scored ? "●" : "○") : ""}</span>
                          <span style={{ color: "#2a3a2a", fontSize: 8, width: 12, textAlign: "center", ...mono }}>{i+1}</span>
                          <span style={{ color: a ? (a.scored ? "#a3be8c" : "#bf616a") : "#1a221a", fontSize: 12, width: 14, textAlign: "center" }}>{a ? (a.scored ? "●" : "○") : ""}</span>
                          <span style={{ width: 60, textAlign: "left", color: a ? (a.scored ? "#a3be8c" : "#bf616a") : "#1a221a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a?.name||""}</span>
                        </div>);
                      })}
                    </div>
                    {/* Away goal */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <GoalSVG kicks={pen.away} label={abbr(teams[lmA]?.name,teams[lmA]?.code)} />
                    </div>
                  </div>
                </div>);
              })()}
            </div>
            {lmMatch.phase !== "finished" && lmMatch.phase !== "penalties" && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 3, marginBottom: 14 }}>
                <span style={{ fontSize: 9, color: "#4c5a4c", marginRight: 8 }}>{abbr(teams[lmH]?.name, teams[lmH]?.code)}</span>
                {[{ z: 0, l: "BOX" }, { z: 1, l: "HLF" }, { z: 2, l: "MID" }, { z: 3, l: "HLF" }, { z: 4, l: "BOX" }].map(({ z, l }) => (
                  <div key={z} style={{ width: z === 2 ? 76 : z === 0 || z === 4 ? 56 : 64, height: 30, background: lmMatch.ball === z ? "#3d534330" : "#0a0f0c", border: lmMatch.ball === z ? "1px solid #627661" : (z === 0 || z === 4) ? "1px solid #bf616a18" : "1px solid #1a221a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: lmMatch.ball === z ? "#d3ebd3" : "#2a3a2a", fontWeight: lmMatch.ball === z ? 700 : 400, transition: "all 0.3s", boxShadow: lmMatch.ball === z ? "0 0 8px #3d534333" : "none" }}>{lmMatch.ball === z ? "● " + l : l}</div>
                ))}
                <span style={{ fontSize: 9, color: "#4c5a4c", marginLeft: 8 }}>{abbr(teams[lmA]?.name, teams[lmA]?.code)}</span>
              </div>
            )}
            {/* Penalty popup */}
            {lmMatch.penVisual && (()=>{
              const pv = lmMatch.penVisual;
              const W=220,H=100,gL=25,gR=195,gT=10,gB=82;
              const zPos=[[gL+26,gT+20],[gL+85,gT+16],[gR-26,gT+20],[gL+26,gB-18],[gL+85,gB-14],[gR-26,gB-18]];
              const mPos=[[gL-6,gT-8],[gL+85,gT-12],[gR+6,gT-8],[gL-10,gB+6],[gL+85,gB+10],[gR+10,gB+6]];
              const dX=[(gL+gR)/2-44,(gL+gR)/2,(gL+gR)/2+44];
              const dY=(gT+gB)/2+4;
              const pos = pv.result==="miss" ? mPos[pv.zone] : zPos[pv.zone];
              const col = pv.result==="goal"?"#a3be8c":pv.result==="save"?"#bf616a":"#627661";
              const label = pv.result==="goal"?"GOAL!":pv.result==="save"?"SAVED!":"MISSED!";
              return (<div style={{ background: "#0a0f0c", border: "1px solid #1a221a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ textAlign: "center", fontSize: 9, color: "#627661", letterSpacing: "0.1em", marginBottom: 6 }}>{pv.tName}'s {pv.name} — {pv.min}'</div>
                <svg viewBox={`0 0 ${W} ${H+6}`} style={{ width: "100%", maxWidth: 220, height: "auto", display: "block", margin: "0 auto" }}>
                  <rect x="0" y="0" width={W} height={H+6} fill="transparent" />
                  <rect x={gL} y={gT} width={gR-gL} height={gB-gT} fill="#0d120d" stroke="#3d5343" strokeWidth="2.5" rx="1" />
                  <line x1={gL+57} y1={gT} x2={gL+57} y2={gB} stroke="#1a221a" strokeWidth="0.5" />
                  <line x1={gR-57} y1={gT} x2={gR-57} y2={gB} stroke="#1a221a" strokeWidth="0.5" />
                  <line x1={gL} y1={(gT+gB)/2} x2={gR} y2={(gT+gB)/2} stroke="#1a221a" strokeWidth="0.5" />
                  <circle cx={(gL+gR)/2} cy={gB+4} r="2" fill="#3d5343" />
                  {/* Keeper dive */}
                  <rect x={dX[pv.dive]-18} y={dY-20} width={36} height={40} rx="4" fill={pv.result==="save"?"#bf616a33":"#ffffff0a"} stroke={pv.result==="save"?"#bf616a66":"#ffffff18"} strokeWidth="1.5" />
                  <text x={dX[pv.dive]} y={dY+2} textAnchor="middle" dominantBaseline="middle" fill={pv.result==="save"?"#bf616a":"#ffffff30"} fontSize="16">🧤</text>
                  {/* Ball */}
                  <circle cx={pos[0]} cy={pos[1]} r="7" fill={col} />
                  {pv.result==="goal" && <text x={pos[0]} y={pos[1]+1} textAnchor="middle" dominantBaseline="middle" fill="#0a0f0c" fontSize="8" fontWeight="800">✓</text>}
                  {pv.result==="miss" && <text x={pos[0]} y={pos[1]+1} textAnchor="middle" dominantBaseline="middle" fill="#3b4a3b" fontSize="10" fontWeight="700">×</text>}
                  {pv.result==="save" && <text x={pos[0]} y={pos[1]+1} textAnchor="middle" dominantBaseline="middle" fill="#0a0f0c" fontSize="8" fontWeight="800">✕</text>}
                </svg>
                <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: col, marginTop: 4, letterSpacing: "0.1em" }}>{label}</div>
              </div>);
            })()}

            {lmMatch.phase === "finished" && tLiveTarget && lastLiveResult && <div style={{ background: "#81a1c122", border: "1px solid #81a1c144", borderRadius: 8, padding: "6px 12px", marginBottom: 10, textAlign: "center" }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#81a1c1" }}>⚽ {lastLiveResult.homeName} {lastLiveResult.homeScore}–{lastLiveResult.awayScore} {lastLiveResult.awayName}{lastLiveResult.penalties ? " ("+lastLiveResult.penalties.homeScore+"–"+lastLiveResult.penalties.awayScore+" pen)" : ""}</span>
                <button onClick={() => { importLiveToMatch(tLiveTarget); setTLiveTarget(null); setTab("tournament"); }} style={{ background: "#3d5343", border: "none", borderRadius: 4, color: "#d3ebd3", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Import to Tournament</button>
                <button onClick={() => { setLastLiveResult(null); tPlayLive({...tLiveTarget}); }} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 4, color: "#81a1c1", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Replay</button>
                <button onClick={() => { setTLiveTarget(null); setLmMatch(null); setTab("tournament"); }} style={{ background: "none", border: "1px solid #bf616a66", borderRadius: 4, color: "#bf616a", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Abandon</button>
              </div>
            </div>}
            {/* Match Summary */}
            {lmMatch.phase === "finished" && (()=>{
              const R = (arr) => arr[Math.floor(Math.random()*arr.length)];
              const hN = teams[lmH]?.name, aN = teams[lmA]?.name;
              const hS = lmMatch.score[0], aS = lmMatch.score[1];
              const hG = lmMatch.goalscorers?.home||[], aG = lmMatch.goalscorers?.away||[];
              const ph = lmMatch.possCount.home, pa = lmMatch.possCount.away, pt = ph+pa||1;
              const hp = Math.round(ph/pt*100), ap = 100-hp;
              const st = lmMatch.stats;
              const hXG = +(lmMatch.xG?.home||0).toFixed(1), aXG = +(lmMatch.xG?.away||0).toFixed(1);
              const allP = [...(lmMatch.players?.home||[]),...(lmMatch.subbedOff?.home||[]),...(lmMatch.players?.away||[]),...(lmMatch.subbedOff?.away||[])];
              const motm = allP.length>0 ? allP.reduce((a,b) => (b.rating||0)>(a.rating||0)?b:a, allP[0]) : null;
              const hPlayers = [...(lmMatch.players?.home||[]),...(lmMatch.subbedOff?.home||[])];
              const motmSide = hPlayers.some(p=>p.name===motm?.name) ? hN : aN;
              const reds = lmMatch.events.filter(e=>e.type==="red");
              const pens = lmMatch.events.filter(e=>e.type==="penalty");
              const penShootout = lmMatch.penalties?.decided;
              const penW = lmMatch.penalties?.winner;
              const wSide = hS>aS?"home":aS>hS?"away":penW||null;
              const winN = wSide==="home"?hN:wSide==="away"?aN:null, loseN = wSide==="home"?aN:wSide==="away"?hN:null;
              const winS = Math.max(hS,aS), loseS = Math.min(hS,aS);
              const winPoss = wSide==="home"?hp:wSide==="away"?ap:50;
              const allGoals = [...hG.map(g=>({...g,team:hN,side:"home"})),...aG.map(g=>({...g,team:aN,side:"away"}))].sort((a,b)=>(parseInt(a.min)||0)-(parseInt(b.min)||0));
              const margin = winS - loseS;
              const totalG = hS + aS;
              const lateGoals = allGoals.filter(g=>{const n=typeof g.min==="string"?parseInt(g.min):g.min;return n>=85;});
              const hShots = st.home.shots, aShots = st.away.shots, hOT = st.home.onTarget, aOT = st.away.onTarget;
              const winShots = wSide==="home"?hShots:aShots, loseShots = wSide==="home"?aShots:hShots;
              const winOT = wSide==="home"?hOT:aOT;
              const winXG = wSide==="home"?hXG:aXG, loseXG = wSide==="home"?aXG:hXG;

              // Detect narrative archetypes
              const isDraw = hS===aS;
              const isThrashing = margin >= 4;
              const isComfortable = margin === 3;
              const isNarrow = margin === 1 && totalG >= 2;
              const isGoalless = totalG === 0;
              const isLowBlock = winPoss < 42 && !isDraw;
              // Comeback: winner was trailing at some point
              let isComeback = false, leadChanges = 0;
              if (!isDraw && allGoals.length >= 3) {
                let rH=0,rA=0,lastLead="";
                for (const g of allGoals) {
                  if (g.side==="home") rH++; else rA++;
                  const lead = rH>rA?"home":rA>rH?"away":"";
                  if (lead && lead !== lastLead && lastLead) leadChanges++;
                  lastLead = lead;
                }
                const winSide = wSide||"home";
                let trailed = false; rH=0;rA=0;
                for (const g of allGoals) { if(g.side==="home")rH++;else rA++; if((winSide==="home"&&rA>rH)||(winSide==="away"&&rH>rA))trailed=true; }
                isComeback = trailed;
              }
              // Hat tricks and braces
              const scorerCounts = {};
              allGoals.forEach(g => { const k = g.name+"|"+g.team; scorerCounts[k] = (scorerCounts[k]||0)+1; });
              const hatTricks = Object.entries(scorerCounts).filter(([,c])=>c>=3).map(([k])=>({name:k.split("|")[0],team:k.split("|")[1],count:scorerCounts[k]}));
              const braces = Object.entries(scorerCounts).filter(([,c])=>c===2).map(([k])=>({name:k.split("|")[0],team:k.split("|")[1]}));
              // Clinical vs wasteful
              const isClinical = !isDraw && winS >= 2 && winXG < winS - 0.5;
              const isWasteful = !isDraw && loseS === 0 && loseXG >= 1.5;

              const lines = [];

              // ═══ OPENER ═══
              if (isGoalless) {
                lines.push(R(["A goalless draw between "+hN+" and "+aN+".",  hN+" and "+aN+" couldn't find a breakthrough in a 0-0 stalemate.",  "Neither side could break the deadlock as "+hN+" and "+aN+" shared the points.",  "Defences on top as "+hN+" and "+aN+" played out a 0-0 draw.",  "Goalless. Both keepers will take credit after a disciplined display.",  "All square in a cagey affair. 0-0 the final score.",  hN+" and "+aN+" cancel each other out in a scoreless draw."]));
              } else if (penShootout) {
                lines.push(R([winN+" edged past "+loseN+" on penalties after a "+hS+"\u2013"+aS+" draw.",  winN+" prevailed in the shootout, the match finishing "+hS+"\u2013"+aS+" after extra time.",  "Spot kicks decided it. "+winN+" progress after "+hS+"\u2013"+aS+".",  winN+" keep their composure from the spot to knock out "+loseN+".",  "It took penalties to separate them after "+hS+"\u2013"+aS+". "+winN+" held their nerve."]));
              } else if (isThrashing) {
                lines.push(R([winN+" dismantled "+loseN+" "+winS+"\u2013"+loseS+".",  "A ruthless "+winN+" put "+winS+" past "+loseN+" in a one-sided affair.",  winN+" ran riot against "+loseN+", winning "+winS+"\u2013"+loseS+".",  loseN+" had no answer as "+winN+" steamrolled to a "+winS+"\u2013"+loseS+" win.",  "Total demolition. "+winN+" put "+loseN+" to the sword, "+winS+"\u2013"+loseS+".",  loseN+" were taken apart in a humbling "+winS+"\u2013"+loseS+" defeat.",  winN+" were merciless. "+winS+"\u2013"+loseS+" against a shell-shocked "+loseN+"."]));
              } else if (isComeback) {
                lines.push(R([winN+" came from behind to beat "+loseN+" "+winS+"\u2013"+loseS+".",  "A remarkable comeback saw "+winN+" overturn a deficit. Final score: "+winS+"\u2013"+loseS+".",  winN+" fought back to claim a "+winS+"\u2013"+loseS+" victory.",  "Down but not out. "+winN+" recovered to win "+winS+"\u2013"+loseS+".",  "Written off at half-time, "+winN+" turned it on its head. "+winS+"\u2013"+loseS+".",  loseN+" led, but "+winN+" had other ideas. A stunning "+winS+"\u2013"+loseS+" turnaround.",  winN+" showed character, rallying from behind to beat "+loseN+" "+winS+"\u2013"+loseS+"."]));
              } else if (isComfortable) {
                lines.push(R([winN+" saw off "+loseN+" "+winS+"\u2013"+loseS+".",  "A comfortable "+winS+"\u2013"+loseS+" win for "+winN+".",  winN+" cruised past "+loseN+", winning "+winS+"\u2013"+loseS+".",  winN+" were rarely troubled. "+winS+"\u2013"+loseS+" over "+loseN+".",  "Professional from "+winN+". "+winS+"\u2013"+loseS+" without breaking a sweat.",  winN+" controlled this from start to finish. "+winS+"\u2013"+loseS+".",  "Routine for "+winN+". "+winS+"\u2013"+loseS+" and rarely in doubt."]));
              } else if (isNarrow) {
                lines.push(R([winN+" edged "+loseN+" "+winS+"\u2013"+loseS+" in a tight contest.",  "Fine margins. "+winN+" took it "+winS+"\u2013"+loseS+".",  winN+" held on for a narrow "+winS+"\u2013"+loseS+" victory.",  "Nothing in it. "+winN+" prevailed "+winS+"\u2013"+loseS+".",  winN+" squeezed past "+loseN+". Hard-fought, "+winS+"\u2013"+loseS+".",  "A one-goal margin tells the story. "+winN+" "+winS+", "+loseN+" "+loseS+".",  winN+" take all three points in a contest that could have gone either way. "+winS+"\u2013"+loseS+"."]));
              } else if (isDraw && totalG >= 4) {
                lines.push(R([hN+" and "+aN+" played out a thrilling "+hS+"\u2013"+aS+" draw.",  "A "+hS+"\u2013"+aS+" draw that could have gone either way.",  "End-to-end. "+hN+" and "+aN+" shared "+totalG+" goals.",  "What a game. "+hS+"\u2013"+aS+" and either side could have won it.",  totalG+" goals, no winner. "+hN+" and "+aN+" serve up a classic."]));
              } else if (isDraw) {
                lines.push(R([hN+" and "+aN+" drew "+hS+"\u2013"+aS+".",  "Honours even at "+hS+"\u2013"+aS+".",  "A "+hS+"\u2013"+aS+" draw. Neither side could find a winner.",  "A point apiece. "+hN+" "+hS+", "+aN+" "+aS+".",  hN+" and "+aN+" shared the spoils in a "+hS+"\u2013"+aS+" draw.",  "Level at "+hS+"\u2013"+aS+". Both teams will feel they left points on the table.",  hN+" "+hS+", "+aN+" "+aS+". A fair result on the balance of play."]));
              } else {
                lines.push(R([winN+" beat "+loseN+" "+winS+"\u2013"+loseS+".",  winN+" "+winS+", "+loseN+" "+loseS+".",  "Victory for "+winN+", who overcame "+loseN+" "+winS+"\u2013"+loseS+".",  winN+" got the job done. "+winS+"\u2013"+loseS+" over "+loseN+".",  "The spoils go to "+winN+". "+winS+"\u2013"+loseS+".",  winN+" pick up the win, "+winS+"\u2013"+loseS+".",  "Job done for "+winN+". "+winS+"\u2013"+loseS+" and three points in the bag."]));
              }

              // ═══ GOAL NARRATIVE ═══
              if (hatTricks.length > 0) {
                const ht = hatTricks[0];
                lines.push(R([ht.name+" scored "+ht.count+" for "+ht.team+".",  "A "+ht.count+"-goal haul from "+ht.name+" proved decisive.",  ht.name+" was unstoppable, netting "+ht.count+" times.",  ht.team+"'s "+ht.name+" took the match ball with "+ht.count+" goals.",  "All eyes on "+ht.name+", who plundered "+ht.count+" for "+ht.team+"."]));
              }
              if (braces.length > 0 && hatTricks.length === 0 && allGoals.length <= 5) {
                const br = braces[0];
                lines.push(R([br.name+" scored twice for "+br.team+".",  "A brace from "+br.name+" made the difference.",  br.name+" hit a double for "+br.team+".",  "Two goals from "+br.name+" anchored "+br.team+"'s performance.",  br.team+" owe plenty to "+br.name+"'s brace."]));
              }
              if (allGoals.length >= 1 && allGoals.length <= 6 && hatTricks.length === 0) {
                const descs = [];
                let rH = 0, rA = 0;
                for (let gi = 0; gi < allGoals.length; gi++) {
                  const g = allGoals[gi];
                  const wasLevel = rH === rA;
                  const prevLeader = rH > rA ? "home" : rA > rH ? "away" : null;
                  if (g.side === "home") rH++; else rA++;
                  const nowLevel = rH === rA;
                  const m = g.min != null ? g.min + "'" : "";
                  const meth = g.method==="pen"?" from the spot":g.method==="header"?" with a header":g.method==="long-range"?" from distance":g.method==="counter"?" on the counter":g.method==="og"?" via an own goal":g.method==="gk-error"?" after a keeper error":g.method==="deflection"?" via a deflection":"";
                  if (gi === 0) {
                    descs.push(R([g.name+" opened the scoring for "+g.team+meth+" ("+m+")",  g.name+" struck first"+meth+" ("+m+")",  g.team+"'s "+g.name+" drew first blood"+meth+" ("+m+")",  g.name+" gave "+g.team+" the lead"+meth+" on "+m,  g.name+" broke the deadlock"+meth+" ("+m+")",  "First blood to "+g.team+" through "+g.name+meth+" ("+m+")"]));
                  } else if (nowLevel) {
                    descs.push(R([g.name+" levelled for "+g.team+meth+" ("+m+")",  g.name+" pulled "+g.team+" level"+meth+" ("+m+")",  g.name+" equalized"+meth+" ("+m+")",  g.team+"'s "+g.name+" made it "+rH+"\u2013"+rA+meth+" ("+m+")",  g.name+" hauled "+g.team+" back into it"+meth+" ("+m+")",  "All square again through "+g.name+meth+" ("+m+")"]));
                  } else if (wasLevel) {
                    descs.push(R([g.name+" put "+g.team+" ahead"+meth+" ("+m+")",  g.name+" restored "+g.team+"'s lead"+meth+" ("+m+")",  g.team+"'s "+g.name+" made it "+rH+"\u2013"+rA+meth+" ("+m+")",  g.name+" nudged "+g.team+" in front"+meth+" ("+m+")",  g.name+" edged "+g.team+" ahead"+meth+" ("+m+")",  g.team+" retake the lead through "+g.name+meth+" ("+m+")"]));
                  } else if (Math.abs(rH-rA) >= 3) {
                    descs.push(R([g.name+" added another"+meth+" ("+m+")",  g.name+" piled on the misery"+meth+" ("+m+")",  g.team+"'s "+g.name+" made it "+rH+"\u2013"+rA+meth+" ("+m+")",  g.name+" twisted the knife"+meth+" ("+m+")",  "Salt in the wound from "+g.name+meth+" ("+m+")"]));
                  } else if (prevLeader && g.side !== prevLeader) {
                    descs.push(R([g.name+" pulled one back"+meth+" ("+m+")",  g.team+"'s "+g.name+" offered a lifeline"+meth+" at "+rH+"\u2013"+rA+" ("+m+")",  g.name+" gave "+g.team+" hope"+meth+" ("+m+")",  "A way back for "+g.team+" as "+g.name+" scored"+meth+" ("+m+")",  g.name+" halved the deficit"+meth+" ("+m+")"]));
                  } else {
                    descs.push(R([g.name+" extended the lead"+meth+" ("+m+")",  g.name+" made it "+rH+"\u2013"+rA+meth+" ("+m+")",  g.name+" struck for "+g.team+meth+" ("+m+")",  g.name+" doubled down"+meth+" ("+m+")",  g.team+" pull further clear through "+g.name+meth+" ("+m+")"]));
                  }
                }
                if (descs.length === 1) lines.push(descs[0]+".");
                else if (descs.length === 2) lines.push(descs[0]+R([" before "," and then "," but ",". "])+descs[1]+".");
                else {
                  let gt = descs[0];
                  for (let di = 1; di < descs.length; di++) {
                    if (di === descs.length - 1) gt += R([". Finally, ",". ",", and ",". To cap it off, "])+descs[di];
                    else if (di % 2 === 0) gt += ". "+descs[di];
                    else gt += R([" before ",", then ",". ",", and "])+descs[di];
                  }
                  lines.push(gt+".");
                }
              } else if (allGoals.length > 6) {
                const topScorer = Object.entries(scorerCounts).sort(([,a],[,b])=>b-a)[0];
                if (topScorer && topScorer[1] >= 2) {
                  const [key, count] = topScorer; const [name, team] = key.split("|");
                  lines.push(R([name+" led the way with "+count+" goals.",  name+" was the standout scorer with "+count+".",  team+"'s "+name+" helped himself to "+count+".",  "The pick of the bunch: "+name+" ("+team+") with "+count+"."]));
                }
                lines.push(R([totalG+" goals in all. Neither defence covered itself in glory.",  "A "+totalG+"-goal affair that rarely paused for breath.",  "The defences will want to forget this one. "+totalG+" goals tells you everything."]));
              }

              // ═══ TACTICAL ═══
              if (isLowBlock && !isDraw) {
                lines.push(R([winN+" won with just "+winPoss+"% possession, content to absorb and counter.",  "Despite "+winPoss+"% of the ball, "+winN+" were clinical when chances came.",  loseN+" had "+(100-winPoss)+"% possession but couldn't convert dominance into goals.",  "The stats flatter "+loseN+". "+winPoss+"% for "+winN+" and yet the win is theirs.",  winN+" soaked up pressure and made their moments count.",  "A masterclass in efficiency from "+winN+". "+winPoss+"% possession was more than enough."]));
              } else if (!isDraw && Math.abs(hp-50) >= 12) {
                const domN = hp>=62?hN:aN, domP = hp>=62?hp:ap;
                if (domN === winN) lines.push(R([winN+" controlled proceedings with "+domP+"% possession.",  domP+"% possession for "+winN+", who dictated the tempo.",  winN+" kept the ball and made it count. "+domP+"% and a deserved win."]));
                else lines.push(R([loseN+" had "+domP+"% of the ball but couldn't make it count.",  domP+"% possession for "+loseN+" amounted to nothing.",  loseN+" saw plenty of the ball ("+domP+"%) but lacked the edge.",  "Possession without purpose from "+loseN+". "+domP+"% and nothing to show for it."]));
              }

              // ═══ STATS ═══
              if (isClinical) lines.push(R(["Clinical from "+winN+", outperforming their "+winXG+" xG with "+winS+" goals.",  winN+" were ruthless, converting beyond their expected "+winXG+".",  winS+" goals from "+winXG+" xG. Ice-cold finishing from "+winN+".",  "Finishing made the difference. "+winN+" netted "+winS+" from just "+winXG+" xG."]));
              else if (isWasteful) lines.push(R([loseN+" will rue missed chances. "+loseXG+" xG, zero goals.",  "Wasteful from "+loseN+", whose "+loseXG+" xG should have yielded more.",  loseN+" created enough but couldn't find the finish. "+loseXG+" xG.",  "A night to forget in front of goal for "+loseN+". "+loseXG+" expected, none actual."]));
              else if (!isDraw && winShots >= loseShots * 2) lines.push(R([winN+" peppered the goal with "+winShots+" shots, "+winOT+" on target.",  "The shot count tells the story: "+winN+" "+winShots+", "+loseN+" "+loseShots+".",  winN+" had "+winShots+" attempts to "+loseShots+". Dominant."]));
              if (!isDraw && loseS === 0 && winS >= 2) lines.push(R([winN+" kept a clean sheet.",  "A shutout for "+winN+"'s defence.",  winN+" didn't concede. Solid at the back.",  "Nothing past "+winN+"'s backline today."]));
              const hWood = st.home.woodwork||0, aWood = st.away.woodwork||0, totalWood = hWood + aWood;
              if (totalWood >= 3) lines.push(R(["The woodwork was hit "+totalWood+" times.",  totalWood+" strikes against the frame. Either side could have had more.",  "The posts took a beating. "+totalWood+" efforts off the woodwork."]));
              else if (totalWood === 2 && hWood > 0 && aWood > 0) lines.push(R(["Both sides hit the woodwork.",  "The frame denied efforts from both teams."]));
              else if (totalWood === 2) { const wTeam = hWood===2?hN:aN; lines.push(R([wTeam+" hit the woodwork twice. Unlucky not to score more.",  "The frame denied "+wTeam+" twice."])); }
              else if (totalWood === 1) { const wTeam = hWood===1?hN:aN; lines.push(R([wTeam+" hit the woodwork.",  "The post denied "+wTeam+" once."])); }

              // ═══ DRAMA ═══
              if (reds.length === 1) {
                const redTeam = reds[0].team === "home" ? hN : reds[0].team === "away" ? aN : null;
                if (redTeam) lines.push(R(["A red card for "+redTeam+" added to the tension.",  redTeam+" were reduced to ten men after a sending off.",  "A dismissal for "+redTeam+" changed the complexion of the game."]));
                else lines.push(R(["A red card shaped the contest.",  "A sending off changed the complexion of the game."]));
              }
              else if (reds.length >= 2) lines.push(R(["A feisty affair with "+reds.length+" red cards.",  reds.length+" dismissals in a heated encounter.",  "The referee had a busy night. "+reds.length+" reds."]));
              const penScored = allGoals.filter(g=>g.method==="pen").length;
              const penMissed = lmMatch.events.filter(e=>e.type==="pen_miss"&&e.min!=="PEN").length;
              const penTotal = penScored + penMissed;
              if (penTotal === 1 && penScored === 1) lines.push(R(["A penalty was awarded and converted.",  "The referee pointed to the spot, and the penalty was dispatched.",  "A spot kick was won and put away."]));
              else if (penTotal === 1 && penMissed === 1) lines.push(R(["A penalty was awarded but missed.",  "The referee pointed to the spot, but the penalty was wasted.",  "A spot kick was won but couldn't be converted."]));
              else if (penTotal >= 2) {
                if (penScored > 0 && penMissed > 0) lines.push(R([penTotal+" penalties awarded. "+penScored+" scored, "+penMissed+" missed.",  "A match punctuated by "+penTotal+" spot kicks. Not all were converted.",  penTotal+" penalties given. "+penScored+" found the net, "+penMissed+" didn't."]));
                else if (penScored === penTotal) lines.push(R([penTotal+" penalties awarded, all converted.",  penTotal+" spot kicks, "+penTotal+" goals. Clinical from twelve yards."]));
                else lines.push(R([penTotal+" penalties awarded, none converted.",  penTotal+" spot kicks, all wasted. Neither side could convert.",  penTotal+" penalties given. "+penTotal+" missed. Remarkable."]));
              }
              if (lateGoals.length >= 2) lines.push(R(["A frantic finish saw "+lateGoals.length+" goals in the final minutes.",  "The closing stages produced "+lateGoals.length+" goals.",  "The last five minutes delivered "+lateGoals.length+" goals. Drama until the end."]));
              else if (lateGoals.length === 1 && !isDraw && lateGoals[0].team === winN) {
                const lg = lateGoals[0];
                lines.push(R([lg.name+"'s "+lg.min+"' strike proved the winner.",  "Late heartbreak for "+loseN+" as "+lg.name+" struck at "+lg.min+"'.",  lg.name+" ("+lg.min+"') delivered the late blow.",  "Agony for "+loseN+". "+lg.name+" found the net at "+lg.min+"' to settle it."]));
              }

              // ═══ MOTM ═══
              if (motm && motm.rating >= 7.0) {
                const r = motm.rating.toFixed(1);
                if (motm.goals >= 2) lines.push(R([motmSide+"'s "+motm.name+" was the standout ("+r+").",  motm.name+" took the plaudits with "+r+".",  motm.name+" ran the show ("+r+").",  "The match belonged to "+motm.name+" ("+r+")."]));
                else if (motm.rating >= 8.0) lines.push(R([motmSide+"'s "+motm.name+" was immense ("+r+").",  "Player of the match: "+motm.name+" ("+motmSide+", "+r+").",  "Head and shoulders above the rest: "+motm.name+" ("+r+").",  motm.name+" produced a "+r+"-rated masterclass for "+motmSide+"."]));
                else lines.push(R(["Highest-rated: "+motm.name+" ("+motmSide+", "+r+").",  motm.name+" earned the top rating of "+r+".",  motmSide+"'s "+motm.name+" impressed ("+r+").",  motm.name+" caught the eye ("+r+")."]));
              }

              return (<div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141a14" , ...ui }}>Match Summary</div>
                <div style={{ fontSize: 12, color: "#c5c8c6", lineHeight: 1.7 }} ref={el => { if (el) summaryRef.current = lines.join(" "); }}>{lines.join(" ")}</div>
              </div>);
            })()}
            <div style={{ background: "#0a0f0c", border: "1px solid #1a221a", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 18px", borderBottom: "1px solid #141a14", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#627661" }}>Match Events</div>
              <div ref={lmFeedRef} style={{ padding: "10px 0", height: 220, overflowY: "auto" }}>
              {(()=>{ const T2=new Set(["goal","penalty","chance","red","second_yellow","pen_miss"]); const T1=new Set(["save","miss","yellow","sub","injury"]); return lmMatch.events.map((e, i) => { const t2=T2.has(e.type),t1=T1.has(e.type); return (<div key={i} className="ev-enter" style={{ display: e.type === "phase" ? "block" : "flex", gap: 0, padding: e.type === "phase" ? "10px 18px" : "5px 0 5px 0", alignItems: "baseline", borderLeft: t2 ? "2px solid " + (evColor[e.type]||"#555") : "2px solid transparent", borderBottom: "1px solid #0f1310", background: e.type === "goal" ? "#d3ebd308" : "transparent", fontSize: e.type === "phase" ? 13 : t2 ? 14 : t1 ? 12 : 12, color: evColor[e.type] || "#777", fontWeight: e.type === "phase" || t2 || t1 ? 600 : 400, textAlign: e.type === "phase" ? "center" : "left", letterSpacing: "0.02em", lineHeight: 1.5 }}>{e.type !== "phase" && <span style={{ color: "#3b4a3b", width: 44, minWidth: 44, textAlign: "right", fontSize: 10, fontWeight: 600, paddingRight: 10, flexShrink: 0, borderRight: "1px solid #141a14", marginRight: 10, ...mono }}>{e.min}'</span>}<span style={{ flex: 1 }}>{e.text}</span></div>); }); })()}
              {lmMatch.events.length === 0 && <div style={{ padding: "24px 18px", textAlign: "center", color: "#4c5a4c", fontSize: 11 }}>Awaiting kick off...</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 0, marginBottom: 6, background: "#0a0f0c", borderRadius: 6, padding: 2, border: "1px solid #1a221a" }}>
              {[["stats","Stats"],["players","Players"],["tactics","Tactics"]].map(([id,label]) => (
                <button key={id} onClick={() => setLmTab(id)} style={{ flex: 1, background: lmTab === id ? "#1a221a" : "transparent", border: "none", borderRadius: 4, padding: "5px 0", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: lmTab === id ? "#d3ebd3" : "#4c5a4c", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{label}</button>
              ))}
            </div>
            {lmTab === "stats" && <>
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141a14" , ...ui }}>Match Stats</div>
              {(() => { const ph = lmMatch.possCount.home, pa = lmMatch.possCount.away, pt = ph + pa || 1; const hp = Math.round(ph/pt*100), ap = 100-hp; return (<div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 11 }}>
                  <span style={{ width: 20, textAlign: "right", color: hp >= ap ? "#8ab4e0" : "#4c5a4c", fontWeight: hp >= ap ? 600 : 400 }}>{hp}%</span>
                  <div style={{ flex: 1, margin: "0 4px" }}></div>
                  <span style={{ width: 70, textAlign: "center", color: "#3d5343", fontSize: 9, flexShrink: 0 }}>Possession</span>
                  <div style={{ flex: 1, margin: "0 4px" }}></div>
                  <span style={{ width: 20, textAlign: "left", color: ap > hp ? "#e08a8a" : "#4c5a4c", fontWeight: ap > hp ? 600 : 400 }}>{ap}%</span>
                </div>
                <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: "#1a221a" }}>
                  <div style={{ width: `${hp}%`, background: "#4a7ab5", borderRadius: 2, transition: "width 0.3s" }} />
                  <div style={{ width: `${ap}%`, background: "#b55a5a", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>); })()}
              {[["xG", Math.round((lmMatch.xG?.home||0)*100)/100, Math.round((lmMatch.xG?.away||0)*100)/100], ["Shots", lmMatch.stats.home.shots, lmMatch.stats.away.shots], ["On Target", lmMatch.stats.home.onTarget, lmMatch.stats.away.onTarget], ["Corners", lmMatch.stats.home.corners, lmMatch.stats.away.corners], ["Penalties", lmMatch.stats.home.penalties, lmMatch.stats.away.penalties], ["Fouls", lmMatch.stats.home.fouls, lmMatch.stats.away.fouls], ["Yellows", lmMatch.stats.home.yellows, lmMatch.stats.away.yellows], ["Reds", lmMatch.stats.home.reds, lmMatch.stats.away.reds], ["Injuries", lmMatch.stats.home.injuries, lmMatch.stats.away.injuries], ["Subs Left", 3 - lmMatch.subs.home, 3 - lmMatch.subs.away]].map(([label, h, a], i) => { const mx = Math.max(h, a, 1); return (<div key={i} style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 11 }}>
                <span style={{ width: 24, textAlign: "right", color: h > a ? "#8ab4e0" : "#4c5a4c", fontWeight: h > a ? 600 : 400 }}>{typeof h === "number" && h % 1 !== 0 ? h.toFixed(2) : h}</span>
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", padding: "0 4px" }}><div style={{ width: `${(h/mx)*100}%`, height: 4, background: h >= a ? "#2d7a45" : "#1a221a", borderRadius: 2, transition: "width 0.3s", minWidth: h > 0 ? 2 : 0 }} /></div>
                <span style={{ width: 70, textAlign: "center", color: "#3b4a3b", fontSize: 9, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", padding: "0 4px" }}><div style={{ width: `${(a/mx)*100}%`, height: 4, background: a >= h ? "#2d7a45" : "#1a221a", borderRadius: 2, transition: "width 0.3s", minWidth: a > 0 ? 2 : 0 }} /></div>
                <span style={{ width: 24, textAlign: "left", color: a > h ? "#e08a8a" : "#4c5a4c", fontWeight: a > h ? 600 : 400 }}>{typeof a === "number" && a % 1 !== 0 ? a.toFixed(2) : a}</span>
              </div>); })}
              {/* Momentum graph */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1a221a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "#3b4a3b" }}>{abbr(teams[lmH]?.name, teams[lmH]?.code)} ▲</span>
                  <span style={{ fontSize: 9, color: "#627661", letterSpacing: "0.15em", fontWeight: 600 }}>Momentum</span>
                  <span style={{ fontSize: 8, color: "#3b4a3b" }}>{abbr(teams[lmA]?.name, teams[lmA]?.code)} ▼</span>
                </div>
                {(() => {
                  const W = 400, H = 44, mid = H / 2;
                  const h = lmMatch.momHist;
                  const maxMin = h.length > 0 ? Math.max(h[h.length-1].m, 90) : 90;
                  const pts = h.length > 0 ? h.map(p => ({ x: (p.m / maxMin) * W, y: mid - p.v * mid })) : [];
                  const pathD = pts.length > 1 ? "M0," + mid + " " + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + ` L${pts[pts.length-1].x.toFixed(1)},${mid} Z` : "";
                  return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 44, display: "block" }}>
                    <rect x="0" y="0" width={W} height={H} fill="#0a0f0c" rx="3" />
                    {[45,90,105,120].filter(m=>m<=maxMin).map(m => <line key={m} x1={(m/maxMin)*W} y1="0" x2={(m/maxMin)*W} y2={H} stroke="#1a221a" strokeWidth="0.5" strokeDasharray="2,2" />)}
                    <line x1="0" y1={mid} x2={W} y2={mid} stroke="#1e2a1e" strokeWidth="1" />
                    {pathD && <path d={pathD} fill="#3d534344" stroke="#3d5343" strokeWidth="1.5" />}
                  </svg>);
                })()}
              </div>
            </div>
            </>}
            {lmTab === "players" && <>
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: "14px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141a14" }}>Player Stats</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }} className="grid-2col">
              {["home","away"].map((side,si) => {
                const tm = side === "home" ? teams[lmH] : teams[lmA];
                const sq = tm?.squad || buildSquad(tm?.formation, null);
                const onPitch = lmMatch.players[side] || [];
                const off = lmMatch.subbedOff?.[side] || [];
                const bench = lmMatch.bench?.[side] || [];
                const lookup = (name) => onPitch.find(p=>p.name===name) || off.find(p=>p.name===name) || bench.find(p=>p.name===name);
                const starters = sq.filter(p=>!p.bench);
                const benchSq = sq.filter(p=>p.bench);
                return (<>
                {si === 1 && <div style={{ background: "#1a221a" }}></div>}
                <div>
                  <div style={{ fontSize: 8, color: "#5a6e5a", letterSpacing: "0.1em", marginBottom: 4 }}>{tm?.name?.toUpperCase()}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 18px 18px 28px 12px", gap: "0px 2px", fontSize: 9, alignItems: "center" }}>
                    <span style={{ color: "#5a6e5a", fontSize: 7 }}>POS</span>
                    <span style={{ color: "#5a6e5a", fontSize: 7 }}>PLAYER</span>
                    <span style={{ color: "#5a6e5a", fontSize: 7, textAlign: "center" }}>G</span>
                    <span style={{ color: "#5a6e5a", fontSize: 7, textAlign: "center" }}>A</span>
                    <span style={{ color: "#5a6e5a", fontSize: 7, textAlign: "center" }}>RTG</span>
                    <span></span>
                    {starters.map((sq2,pi) => { const p = lookup(sq2.name) || {rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:sq2.atkW||0}; const isOff = off.some(x=>x.name===sq2.name); const isOn = onPitch.some(x=>x.name===sq2.name&&x.sub==='on'); return (<>
                      <span style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                      <span style={{ color: isOff?"#627661":"#c5c8c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{TB(sq2.tier)}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}</span>
                      <span style={{ textAlign: "center", color: p.goals>0?"#d3ebd3":"#2a3a2a", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                      <span style={{ textAlign: "center", color: p.assists>0?"#d3ebd3":"#2a3a2a", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                      <span style={{ textAlign: "center", color: p.rating>=7.5?"#a3be8c":p.rating>=6.0?"#c5c8c6":"#bf616a", fontWeight: 600, ...mono }}>{p.rating!=null?p.rating.toFixed(1):"–"}</span>
                      <span style={{ fontSize: 7, color: isOff?"#bf616a":"#3b4a3b", textAlign: "center" }}>{isOff?"▼":""}</span>
                    </>); })}
                    <span style={{ gridColumn: "1/-1", borderTop: "1px solid #1a221a", marginTop: 2, marginBottom: 2 }}></span>
                    {[...benchSq].sort((a,b) => { const aOn = onPitch.some(x=>x.name===a.name); const bOn = onPitch.some(x=>x.name===b.name); return aOn===bOn?0:aOn?-1:1; }).map((sq2,pi) => { const p = lookup(sq2.name) || {rating:null,goals:0,assists:0,sub:false,yc:0,rc:false,inj:false,atkW:sq2.atkW||0}; const isOn = onPitch.some(x=>x.name===sq2.name); return (<>
                      <span style={{ color: POS_CLR[sq2.pos]||"#888", fontSize: 7, fontWeight: 700, ...mono }}>{sq2.pos}</span>
                      <span style={{ color: isOn?"#c5c8c6":"#4c5a4c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sq2.name}{TB(sq2.tier)}{p.rc&&<span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{!p.rc&&p.yc>0&&<span style={{display:"inline-block",width:6,height:8,background:"#ebcb8b",borderRadius:1,marginLeft:3,verticalAlign:"middle"}} />}{p.inj&&<span style={{marginLeft:3,fontSize:8,color:"#c07070"}}>INJ</span>}</span>
                      <span style={{ textAlign: "center", color: p.goals>0?"#d3ebd3":"#2a3a2a", fontWeight: p.goals>0?700:400 }}>{p.goals||"-"}</span>
                      <span style={{ textAlign: "center", color: p.assists>0?"#d3ebd3":"#2a3a2a", fontWeight: p.assists>0?700:400 }}>{p.assists||"-"}</span>
                      <span style={{ textAlign: "center", color: !isOn?"#2a3a2a":p.rating>=7.5?"#a3be8c":p.rating>=6.0?"#c5c8c6":"#bf616a", fontWeight: 600, ...mono }}>{isOn&&p.rating!=null?p.rating.toFixed(1):"–"}</span>
                      <span style={{ fontSize: 7, color: isOn?"#a3be8c":"#3b4a3b", textAlign: "center" }}>{isOn?"▲":""}</span>
                    </>); })}
                  </div>
                </div>
                </>);
              })}
              </div>
            </div>

            {lmMatch.phase !== "pre_match" && lmMatch.phase !== "finished" && lmMatch.phase !== "penalties" && <>
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141a14" , ...ui }}>Substitutions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }} className="grid-2col">
              {["home","away"].map((side, si) => {
                const tm = side === "home" ? teams[lmH] : teams[lmA];
                const subsLeft = 3 - (lmMatch.subs[side]||0);
                const onPitch = lmMatch.players[side]||[];
                const bench = lmMatch.bench[side]||[];
                const isActive = manualSub.side === side;
                return (<>
                  {si === 1 && <div style={{ background: "#1a221a" }} />}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 8, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600 }}>{tm?.name?.toUpperCase()}</span>
                      <span style={{ fontSize: 8, color: subsLeft > 0 ? "#627661" : "#bf616a", ...mono }}>{subsLeft}/3</span>
                    </div>
                    {subsLeft > 0 && bench.length > 0 ? (<>
                      {/* On-pitch players - click to select for removal */}
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 7, color: "#3b4a3b", marginBottom: 2, ...mono }}>OFF</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                          {onPitch.filter(p => p.pos !== "GK").map((p, pi) => (
                            <span key={pi} onClick={() => setManualSub(isActive && manualSub.off === p.name ? {side:null,off:null} : {side,off:p.name})}
                              style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                                background: isActive && manualSub.off === p.name ? "#3d534344" : "#141a14",
                                border: isActive && manualSub.off === p.name ? "1px solid #3d5343" : "1px solid #1a221a",
                                color: POS_CLR[p.pos]||"#888" }}>{p.name}{TB(p.tier)}</span>
                          ))}
                        </div>
                      </div>
                      {/* Bench players - click to confirm sub (only visible when off-player selected) */}
                      {isActive && manualSub.off && (
                        <div>
                          <div style={{ fontSize: 7, color: "#3b4a3b", marginBottom: 2, ...mono }}>ON</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                            {bench.map((p, pi) => (
                              <span key={pi} onClick={() => executeManualSub(side, manualSub.off, p.name)}
                                style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                                  background: "#141a14", border: "1px solid #1a221a",
                                  color: POS_CLR[p.pos]||"#888" }}>{p.name}{TB(p.tier)}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>) : (
                      <div style={{ fontSize: 8, color: "#3b4a3b", fontStyle: "italic" }}>{subsLeft === 0 ? "No subs remaining" : "No bench players"}</div>
                    )}
                  </div>
                </>);
              })}
              </div>
            </div>
            </>}
            </>}
            {lmTab === "tactics" && <>
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141a14" , ...ui }}>Tactics</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 12px" }} className="grid-2col">
              {["home","away"].map((side, si) => {
                const tm = side === "home" ? teams[lmH] : teams[lmA];
                const isBreak = ["pre_match","half_time","full_time","extra_half_time"].includes(lmMatch.phase);
                const SC2 = {balanced:"#888",gegenpress:"#bf616a",tikitaka:"#ebcb8b",counterattack:"#81a1c1",wingplay:"#a3be8c",parkthebus:"#d08770"};
                const strat = lmMatch.strategy?.[side] || {};
                return (<>
                  {si === 1 && <div style={{ background: "#1a221a" }} />}
                  <div>
                    <div style={{ fontSize: 8, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6 }}>{tm?.name?.toUpperCase()}</div>
                    {/* Style */}
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 7, color: "#3b4a3b", letterSpacing: "0.1em", marginBottom: 2 }}>STYLE</div>
                      {isBreak ? <select value={lmMatch.styles[side]} onChange={e => setLmMatch(m => ({...m, styles:{...m.styles, [side]:e.target.value}}))} style={{ ...inp, fontSize: 10, padding: "3px 6px", width: "100%", color: SC2[lmMatch.styles[side]]||"#666" }}>{STYLE_GRP.map(([label, styles]) => <optgroup key={label} label={label}>{styles.map(s => <option key={s} value={s} style={{color:SC2[s]}}>{STYLE_LBL[s]}</option>)}</optgroup>)}</select> : <div style={{ fontSize: 10, color: SC2[lmMatch.styles[side]]||"#666", fontWeight: 600, padding: "3px 0" }}>{STYLE_LBL[lmMatch.styles[side]]}</div>}
                    </div>
                    {/* Formation + Tempo */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
                      <div><div style={{ fontSize: 7, color: "#3b4a3b", letterSpacing: "0.1em" }}>FORMATION</div><div style={{ fontSize: 10, color: "#888", padding: "2px 0" }}>{lmMatch.formations[side]}</div></div>
                      <div><div style={{ fontSize: 7, color: "#3b4a3b", letterSpacing: "0.1em" }}>TEMPO</div><select value={lmMatch.tactics[side]} onChange={e => setLmMatch(m => ({...m, tactics:{...m.tactics, [side]:e.target.value}, allowTacChange:{...m.allowTacChange, [side]:false}}))} style={{ ...inp, fontSize: 9, padding: "1px 4px", width: "100%", color: "#888" }}><option value="park">Ultra Defensive</option><option value="def">Defensive</option><option value="bal">Balanced</option><option value="atk">Offensive</option><option value="ultra">Ultra Offensive</option></select></div>
                    </div>
                    {/* Stamina */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 7, color: "#3b4a3b", letterSpacing: "0.1em", marginBottom: 3 }}>STAMINA</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: "#141a14", borderRadius: 2 }}><div style={{ width: `${Math.max(2, lmMatch.stamina[side])}%`, height: "100%", borderRadius: 2, background: lmMatch.stamina[side] > 60 ? "#3d5343" : lmMatch.stamina[side] > 30 ? "#ebcb8b" : "#bf616a", transition: "width 0.3s, background 0.3s" }} /></div>
                        <span style={{ fontSize: 8, color: "#4c5a4c", width: 22, textAlign: "right", flexShrink: 0, ...mono }}>{Math.round(lmMatch.stamina[side])}</span>
                      </div>
                    </div>
                    {/* Strategy instructions */}
                    {(()=>{ let lastGrp = ""; return Object.entries(STRAT_LABELS).map(([key, {name, vals, grp}]) => {
                      const hdr = grp !== lastGrp; lastGrp = grp;
                      return (<div key={key}>{hdr && <div style={{ fontSize: 7, color: "#5a6e5a", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6, marginBottom: 2 }}>{grp === "possession" ? "IN POSSESSION" : grp === "transition" ? "TRANSITION" : "DEFENSE"}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
                        <span style={{ fontSize: 8, color: "#627661", width: 44, flexShrink: 0, ...mono }}>{name}</span>
                        <select value={strat[key] ?? 0} onChange={e => setLmMatch(m => ({...m, strategy:{...m.strategy, [side]:{...(m.strategy?.[side]||{}), [key]: +e.target.value}}}))} style={{ ...inp, fontSize: 9, padding: "1px 4px", flex: 1, minWidth: 0, color: (strat[key] ?? 0) === 0 ? "#627661" : (strat[key] ?? 0) > 0 ? "#d08770" : "#81a1c1" }}>
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
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 10, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid #141a14" , ...ui }}>Live Modifiers</div>
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
                const clr = (v, mult) => { const b = mult ? 1.0 : 0; if (Math.abs(v-b) < 0.001) return "#4c5a4c"; return v > b ? "#a3be8c" : "#bf616a"; };
                const wt = (v, mult) => Math.abs(v - (mult ? 1 : 0)) > 0.001 ? 600 : 400;
                return (
                  <div style={{ ...mono }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      <span style={{ width: 66, flexShrink: 0 }} />
                      <span style={{ flex: 1, textAlign: "right", fontSize: 9, color: "#627661", fontWeight: 600 }}>{abbr(teams[lmH]?.name, teams[lmH]?.code)}</span>
                      <span style={{ flex: 1, textAlign: "left", fontSize: 9, color: "#627661", fontWeight: 600 }}>{abbr(teams[lmA]?.name, teams[lmA]?.code)}</span>
                    </div>
                    {ps.map(({k,l,m}) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 10 }}>
                        <span style={{ width: 66, flexShrink: 0, color: "#4c5a4c", fontSize: 9 }}>{l}</span>
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
        </div>)}

        {/* ═══ TOURNAMENT TAB ═══ */}
        {tab === "tournament" && (<div>
          {tScoreError && (tEdit || tKoEdit) && <div style={{ background: "#bf616a22", border: "1px solid #bf616a44", borderRadius: 6, padding: "6px 12px", marginBottom: 12, fontSize: 11, color: "#bf616a", textAlign: "center" }}>⚠ {tScoreError}</div>}
          {/* Tournament Leaderboards */}
          {Object.keys(tPlayerStats).length > 0 && (
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: "14px 18px", marginTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", marginBottom: 12, textAlign: "center", paddingBottom: 8, borderBottom: "1px solid #141a14" }}>Tournament Leaders</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 18px" }} className="grid-4col">
                {/* Top Scorers */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("goals")} style={{ fontSize: 9, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>TOP SCORERS<span style={{ fontSize: 8, color: "#4c5a4c" }}>▸</span></div>
                  {Object.values(tPlayerStats).filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||((a.matches+(a.subApp||0))-(b.matches+(b.subApp||0)))).slice(0,10).map((p,i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 10 }}>
                      <span style={{ color: "#4c5a4c", width: 14, textAlign: "right", ...mono }}>{i+1}</span>
                      <span style={{ flex: 1, color: "#c5c8c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}{TB(p.tier)}</span>
                      <span style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#627661", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.pos}</span>
                      <span style={{ color: "#627661", fontSize: 8, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</span>
                      <span style={{ color: "#d3ebd3", fontWeight: 700, width: 18, textAlign: "right", ...mono }}>{p.goals}</span>
                    </div>
                  ))}
                </div>
                {/* Top Assisters */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("assists")} style={{ fontSize: 9, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>TOP ASSISTS<span style={{ fontSize: 8, color: "#4c5a4c" }}>▸</span></div>
                  {Object.values(tPlayerStats).filter(p=>p.assists>0).sort((a,b)=>b.assists-a.assists||((a.matches+(a.subApp||0))-(b.matches+(b.subApp||0)))).slice(0,10).map((p,i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 10 }}>
                      <span style={{ color: "#4c5a4c", width: 14, textAlign: "right", ...mono }}>{i+1}</span>
                      <span style={{ flex: 1, color: "#c5c8c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}{TB(p.tier)}</span>
                      <span style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#627661", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.pos}</span>
                      <span style={{ color: "#627661", fontSize: 8, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</span>
                      <span style={{ color: "#d3ebd3", fontWeight: 700, width: 18, textAlign: "right", ...mono }}>{p.assists}</span>
                    </div>
                  ))}
                </div>
                {/* Top Rated */}
                <div style={{ minWidth: 0 }}>
                  <div onClick={() => setTLeaderboard("rating")} style={{ fontSize: 9, color: "#8a9b8a", letterSpacing: "0.12em", fontWeight: 600, marginBottom: 6, paddingLeft: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>BEST RATING<span style={{ fontSize: 8, color: "#4c5a4c" }}>▸</span></div>
                  {Object.values(tPlayerStats).filter(p=>(p.matches+(p.subApp||0))>=1).sort((a,b)=>(b.totalRating/(b.matches+(b.subApp||0)))-(a.totalRating/(a.matches+(a.subApp||0)))).slice(0,10).map((p,i) => {
                    const avg = (p.totalRating/(p.matches+(p.subApp||0)));
                    return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 10 }}>
                      <span style={{ color: "#4c5a4c", width: 14, textAlign: "right", ...mono }}>{i+1}</span>
                      <span style={{ flex: 1, color: "#c5c8c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}{TB(p.tier)}</span>
                      <span style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#627661", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.pos}</span>
                      <span style={{ color: "#627661", fontSize: 8, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</span>
                      <span style={{ color: avg>=7.5?"#a3be8c":avg>=6.5?"#c5c8c6":"#bf616a", fontWeight: 700, width: 24, textAlign: "right", ...mono }}>{avg.toFixed(1)}</span>
                    </div>);
                  })}
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
                  <details style={{ marginTop: 12, borderTop: "1px solid #141a14", paddingTop: 10 }}>
                    <summary style={{ fontSize: 9, color: "#bf616a", letterSpacing: "0.12em", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>UNAVAILABLE ({unavail.length})</summary>
                    <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 18px" }} className="grid-4col">
                      {unavail.map((p,i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", fontSize: 10 }}>
                          <span style={{ flex: 1, color: "#c5c8c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}{TB(p.tier)}</span>
                          <span style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#627661", fontSize: 8, fontWeight: 700, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.pos}</span>
                          <span style={{ color: "#627661", fontSize: 8, width: 24, textAlign: "center", flexShrink: 0, ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</span>
                          <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                            {p.reason === "red"
                              ? <span style={{display:"inline-block",width:6,height:8,background:"#bf616a",borderRadius:1}} />
                              : <svg width="8" height="8" viewBox="0 0 8 8" style={{display:"block"}}><rect x="1" y="3" width="6" height="2" rx="0.5" fill="#c07070"/><rect x="3" y="1" width="2" height="6" rx="0.5" fill="#c07070"/></svg>}
                            <span style={{ color: p.reason === "red" ? "#bf616a" : "#c07070", fontSize: 8, ...mono }}>{p.out}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })()}
            </div>
          )}
          {tLeaderboard && (() => {
            const title = tLeaderboard === "goals" ? "TOP SCORERS" : tLeaderboard === "assists" ? "TOP ASSISTS" : "BEST RATING";
            const all = Object.values(tPlayerStats);
            const tApp = p => p.matches + (p.subApp||0);
            const sorted = tLeaderboard === "goals"
              ? all.filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||(tApp(a)-tApp(b)))
              : tLeaderboard === "assists"
              ? all.filter(p=>p.assists>0).sort((a,b)=>b.assists-a.assists||(tApp(a)-tApp(b)))
              : all.filter(p=>tApp(p)>=1).sort((a,b)=>(b.totalRating/tApp(b))-(a.totalRating/tApp(a)));
            return (
              <div onClick={() => setTLeaderboard(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 12, padding: "20px 24px", minWidth: 340, maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px #00000066" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #141a14" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#c9a84c" }}>{title}</span>
                    <span onClick={() => setTLeaderboard(null)} style={{ cursor: "pointer", color: "#627661", fontSize: 14, fontWeight: 700, lineHeight: 1, padding: "2px 6px" }}>✕</span>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {sorted.map((p, i) => {
                      const ap = p.matches + (p.subApp||0);
                      const avg = ap ? (p.totalRating/ap) : 0;
                      const val = tLeaderboard === "goals" ? p.goals : tLeaderboard === "assists" ? p.assists : avg;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 11, borderBottom: i < sorted.length-1 ? "1px solid #0a0d0a" : "none" }}>
                          <span style={{ color: "#4c5a4c", width: 20, textAlign: "right", fontSize: 9, ...mono }}>{i+1}</span>
                          <span style={{ flex: 1, color: "#c5c8c6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}{TB(p.tier)}</span>
                          <span style={{ color: {GK:"#ebcb8b",DEF:"#81a1c1",MID:"#a3be8c",FWD:"#d08770"}[p.pos]||"#627661", fontSize: 8, fontWeight: 700, width: 26, textAlign: "center", flexShrink: 0, ...mono }}>{p.pos}</span>
                          <span style={{ color: "#627661", fontSize: 8, width: 28, textAlign: "center", flexShrink: 0, ...mono }}>{p.code||p.team.slice(0,3).toUpperCase()}</span>
                          <span style={{ color: "#8a9b8a", fontSize: 8, width: 16, textAlign: "center", flexShrink: 0, ...mono }}>{ap}</span>
                          <span style={{ color: tLeaderboard === "rating" ? (avg>=7.5?"#a3be8c":avg>=6.5?"#c5c8c6":"#bf616a") : "#d3ebd3", fontWeight: 700, width: 26, textAlign: "right", ...mono }}>{tLeaderboard === "rating" ? avg.toFixed(1) : val}</span>
                        </div>
                      );
                    })}
                    {sorted.length === 0 && <div style={{ color: "#4c5a4c", fontSize: 10, textAlign: "center", padding: 20 }}>No data yet</div>}
                  </div>
                </div>
              </div>
            );
          })()}
          {/* SETUP */}
          {tPhase === "setup" && (<div>
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 22, boxShadow: "0 2px 12px #00000022" }}>
              {/* Presets */}
              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661" }}>Preset</div>
                <select onChange={e => { const v = e.target.value; e.target.value = ""; if (v && T_PRESETS[v]) setTConfig(c => ({ ...c, ...T_PRESETS[v].config })); }} style={{ ...addBtn, padding: "4px 8px", fontSize: 10, color: "#81a1c1", background: "transparent", cursor: "pointer" }}>
                  <option value="" hidden>☰ Select</option>
                  {Object.entries(T_PRESETS).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              {/* Mode */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 12 }}>Tournament Mode</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {[["single", "Single Stage"], ["double", "Double Stage"]].map(([id, l]) => (
                    <button key={id} onClick={() => setTConfig(c => ({ ...c, mode: id }))} style={{ ...chip, background: tConfig.mode === id ? "#3d5343" : "#1a221a", color: tConfig.mode === id ? "#d3ebd3" : "#6b7a6b" }}>{l}</button>
                  ))}
                </div>
                {tConfig.mode === "single" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["knockout", "Knockout Only"], ["groups", "Groups Only"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, singleType: id }))} style={{ ...chip, fontSize: 10, background: tConfig.singleType === id ? "#3d534380" : "#0a0f0c", color: tConfig.singleType === id ? "#d3ebd3" : "#4c5a4c", border: tConfig.singleType === id ? "1px solid #3d5343" : "1px solid #1a221a" }}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {/* Group Stage / League Format */}
              {tHasGroups && (
                <div style={{ borderTop: "1px solid #1a221a", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 12, paddingLeft: 10, borderLeft: "2px solid #3d5343" }}>Group Stage</div>
                  <div style={{ display: "grid", gridTemplateColumns: tHasKO ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
                    <div><div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 4 }}>Groups</div><input type="number" value={tConfig.numGroups} onChange={e => setTConfig(c => ({ ...c, numGroups: e.target.value === "" ? "" : +e.target.value }))} style={{ ...inp, width: "100%", borderColor: !tGroupsOk ? "#bf616a" : "#1e2a1e" }} /></div>
                    
                  </div>
                  <div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 6 }}>Format</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[["roundRobin", "Round Robin"], ["swiss", "Swiss"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, matchFormat: id }))} style={{ ...chip, background: tConfig.matchFormat === id ? "#3d5343" : "#1a221a", color: tConfig.matchFormat === id ? "#d3ebd3" : "#6b7a6b" }}>{l}</button>
                    ))}
                  </div>{tConfig.matchFormat === "roundRobin" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#4c5a4c" }}>Legs</div>
                      <input type="number" value={tConfig.rrLegs} onChange={e => setTConfig(c => ({ ...c, rrLegs: e.target.value === "" ? "" : Math.max(1, +e.target.value) }))} style={{ ...inp, width: 60, textAlign: "center" }} />
                      
                    </div>
                  )}
                  {tConfig.matchFormat === "swiss" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "#4c5a4c" }}>Rounds</div>
                      <input type="number" value={tConfig.swissRounds} onChange={e => setTConfig(c => ({ ...c, swissRounds: e.target.value === "" ? "" : +e.target.value }))} style={{ ...inp, width: 60, textAlign: "center", borderColor: !tSwissOk ? "#bf616a" : "#1e2a1e" }} />
                      {tPerGroup > 1 && <span style={{ fontSize: 10, color: "#4c5a4c" }}>max {tPerGroup - 1}</span>}
                    </div>
                  )}
                  {tConfig.numGroups > 1 && (<>
                    <div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 6 }}>Allocation</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: tConfig.allocMode === "draw" ? 12 : 0 }}>
                      {[["seed", "Seed"], ["random", "Random"], ["manual", "Manual"], ["draw", "Draw"]].map(([id, l]) => (
                        <button key={id} onClick={() => setTConfig(c => ({ ...c, allocMode: id }))} style={{ ...chip, background: tConfig.allocMode === id ? "#3d5343" : "#1a221a", color: tConfig.allocMode === id ? "#d3ebd3" : "#6b7a6b" }}>{l}</button>
                      ))}
                    </div>
                    {tConfig.allocMode === "draw" && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 11, color: "#4c5a4c" }}>Pots</div>
                        <input type="number" value={tConfig.numPots} onChange={e => setTConfig(c => ({ ...c, numPots: e.target.value === "" ? "" : +e.target.value }))} style={{ ...inp, width: 60, textAlign: "center", borderColor: !tPotsOk ? "#bf616a" : "#1e2a1e" }} />
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
                <div style={{ borderTop: "1px solid #1a221a", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 10, paddingLeft: 10, borderLeft: "2px solid #3d5343" }}>Tiebreakers</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {tbs.filter(tb => allTBs.includes(tb)).map((tb, ti) => (
                      <div key={tb} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0a0f0c", border: "1px solid #1a221a", borderRadius: 5, padding: "5px 10px" }}>
                        <span style={{ ...mono, fontSize: 9, color: "#4c5a4c", width: 14, textAlign: "right" }}>{ti + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, color: "#c5c8c6" }}>{TBL[tb] || tb}{tb === "buchholz" && <span style={{ fontSize: 9, color: "#4c5a4c", marginLeft: 6 }}>Swiss</span>}</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                          {ti > 0 && <button onClick={() => setTBs(t => { const n = [...t]; [n[ti-1], n[ti]] = [n[ti], n[ti-1]]; return n; })} style={{ background: "none", border: "none", color: "#4c5a4c", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▲</button>}
                          {ti < tbs.filter(t => allTBs.includes(t)).length - 1 && <button onClick={() => setTBs(t => { const n = [...t]; [n[ti], n[ti+1]] = [n[ti+1], n[ti]]; return n; })} style={{ background: "none", border: "none", color: "#4c5a4c", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▼</button>}
                        </div>
                      </div>
                    ))}
                    {allTBs.filter(tb => !tbs.includes(tb)).map(tb => (
                      <button key={tb} onClick={() => setTBs(t => [...t, tb])} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "1px dashed #1a221a", borderRadius: 5, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: 10, color: "#3b4a3b" }}>+ {TBL[tb]}</span>
                      </button>
                    ))}

                  </div>
                </div>); })()}
              {/* Qualification Zones */}
              {tHasGroups && (() => {
                const ZC = [["#5e9c6b","Green"],["#3d5343","Dark Green"],["#c9a84c","Gold"],["#4a7ab5","Blue"],["#81a1c1","Light Blue"],["#88c0d0","Cyan"],["#d08770","Orange"],["#ebcb8b","Yellow"],["#bf616a","Red"],["#9a7ab5","Purple"],["#b48ead","Pink"],["#a3be8c","Lime"]];
                const setZones = fn => setTConfig(c => ({ ...c, qualZones: fn(c.qualZones || []) }));
                return (
                <div style={{ borderTop: "1px solid #1a221a", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", paddingLeft: 10, borderLeft: "2px solid #3d5343" }}>Qualification Zones</div>
                    <button onClick={() => setZones(z => [...z, { anchor: "top", from: z.length + 1, to: z.length + 1, label: "Zone", color: ZC[z.length % ZC.length][0], type: "cosmetic" }])} style={{ ...addBtn, fontSize: 10, color: "#627661" }}>+ Zone</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {qz.map((z, zi) => (
                      <div key={zi} style={{ background: "#0a0f0c", border: "1px solid #1a221a", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: z.color, flexShrink: 0 }} />
                          <input value={z.label} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ ...inp, flex: 1, minWidth: 0, padding: "4px 8px", fontSize: 12, fontWeight: 500 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                            {zi > 0 && <button onClick={() => setZones(zs => { const n = [...zs]; [n[zi-1], n[zi]] = [n[zi], n[zi-1]]; return n; })} style={{ background: "none", border: "none", color: "#4c5a4c", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▲</button>}
                            {zi < (tConfig.qualZones||[]).length - 1 && <button onClick={() => setZones(zs => { const n = [...zs]; [n[zi], n[zi+1]] = [n[zi+1], n[zi]]; return n; })} style={{ background: "none", border: "none", color: "#4c5a4c", fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>▼</button>}
                          </div>
                          <button onClick={() => setZones(zs => zs.filter((_, i) => i !== zi))} style={{ background: "none", border: "none", color: "#bf616a", fontSize: 13, cursor: "pointer", padding: "0 4px", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <select value={z.color} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, color: e.target.value } : x))} style={{ ...inp, padding: "3px 6px", fontSize: 10, cursor: "pointer", width: "auto" }}>{ZC.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
                          <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid #1a221a", flexShrink: 0 }}>
                            {[["top", "Top"], ["bottom", "Bot"]].map(([id, l]) => (
                              <button key={id} onClick={() => setZones(zs => zs.map((x, i) => i === zi ? { ...x, anchor: id } : x))} style={{ fontSize: 9, padding: "3px 8px", background: z.anchor === id ? "#3d5343" : "transparent", color: z.anchor === id ? "#d3ebd3" : "#4c5a4c", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                            ))}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="number" min={1} value={z.from} onChange={e => { const v = e.target.value === "" ? "" : Math.max(1, +e.target.value); setZones(zs => zs.map((x, i) => i === zi ? { ...x, from: v } : x)); }} style={{ ...inp, width: 36, padding: "3px 4px", fontSize: 11, textAlign: "center", ...mono }} />
                            <span style={{ color: "#3b4a3b", fontSize: 10 }}>–</span>
                            <input type="number" min={1} value={z.to} onChange={e => { const v = e.target.value === "" ? "" : Math.max(1, +e.target.value); setZones(zs => zs.map((x, i) => i === zi ? { ...x, to: v } : x)); }} style={{ ...inp, width: 36, padding: "3px 4px", fontSize: 11, textAlign: "center", ...mono }} />
                          </div>
                          <select value={z.type || "cosmetic"} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, type: e.target.value } : x))} style={{ ...inp, padding: "3px 6px", fontSize: 10, cursor: "pointer", width: "auto" }}><option value="cosmetic">Cosmetic</option>{tHasKO && <option value="advance">Direct Qualification</option>}{tHasKO && <option value="best">Pool Qualification</option>}</select>
                          {z.type === "best" && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 10, color: "#4c5a4c" }}>Top</span><input type="number" min={1} max={tConfig.numGroups} value={z.bestCount || ""} onChange={e => setZones(zs => zs.map((x, i) => i === zi ? { ...x, bestCount: e.target.value === "" ? "" : Math.min(tConfig.numGroups, Math.max(1, +e.target.value)) } : x))} style={{ ...inp, width: 36, padding: "3px 4px", fontSize: 11, textAlign: "center", ...mono }} /><span style={{ fontSize: 10, color: "#4c5a4c" }}>qualify</span></div>}
                        </div>
                      </div>
                    ))}
                    {qz.length === 0 && <div style={{ fontSize: 10, color: "#3b4a3b", padding: "4px 2px" }}>No zones configured</div>}
                  </div>
                  
                </div>); })()}
              {/* Knockout options */}
              {tHasKO && (
                <div style={{ borderTop: "1px solid #1a221a", paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 12, paddingLeft: 10, borderLeft: "2px solid #3d5343" }}>Knockout Stage</div>
                  {(tConfig.mode === "single" ? teams.length >= 4 : tKoTeams >= 4) && (() => { const checked = tConfig.thirdPlace; return (
                    <div onClick={() => setTConfig(c => ({ ...c, thirdPlace: !c.thirdPlace }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#3d5343" : "#1a221a", border: "1px solid " + (checked ? "#627661" : "#2a3a2a"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#d3ebd3" : "#3b4a3b", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#d3ebd3" : "#6b7a6b", fontWeight: 500 }}>3rd Place Match</div></div>
                    </div>); })()}
                  {(() => { const checked = tConfig.koLegs === 2; return (
                    <div onClick={() => setTConfig(c => ({ ...c, koLegs: c.koLegs === 2 ? 1 : 2 }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#3d5343" : "#1a221a", border: "1px solid " + (checked ? "#627661" : "#2a3a2a"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#d3ebd3" : "#3b4a3b", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#d3ebd3" : "#6b7a6b", fontWeight: 500 }}>2-Legged Ties</div></div>
                    </div>); })()}
                  {tConfig.koLegs === 2 && (() => { const checked = tConfig.koAwayGoals; return (
                    <div onClick={() => setTConfig(c => ({ ...c, koAwayGoals: !c.koAwayGoals }))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0", marginBottom: 8, paddingLeft: 16 }}>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "#3d5343" : "#1a221a", border: "1px solid " + (checked ? "#627661" : "#2a3a2a"), position: "relative", transition: "all 0.2s", flexShrink: 0 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: checked ? "#d3ebd3" : "#3b4a3b", position: "absolute", top: 2, left: checked ? 17 : 3, transition: "all 0.2s" }} /></div>
                      <div><div style={{ fontSize: 12, color: checked ? "#d3ebd3" : "#6b7a6b", fontWeight: 500 }}>Away Goals Rule</div></div>
                    </div>); })()}
                  {tNumByes > 0 && <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 6 }}>Bye Allocation <span style={{ ...mono, fontSize: 10 }}>({tNumByes} bye{tNumByes!==1?"s":""})</span></div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[["auto", "By Ranking"], ["manual", "Manual"]].map(([id, l]) => (
                        <button key={id} onClick={() => setTConfig(c => ({ ...c, koByeMode: id }))} style={{ ...chip, background: tConfig.koByeMode === id ? "#3d5343" : "#1a221a", color: tConfig.koByeMode === id ? "#d3ebd3" : "#6b7a6b" }}>{l}</button>
                      ))}
                    </div>
                  </div>}
                  <div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 6 }}>Allocation</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[["seed", "Seed"], ["random", "Random"], ["manual", "Manual"], ["draw", "Draw"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, koAllocMode: id }))} style={{ ...chip, background: tConfig.koAllocMode === id ? "#3d5343" : "#1a221a", color: tConfig.koAllocMode === id ? "#d3ebd3" : "#6b7a6b" }}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* Home Advantage */}
              <div style={{ borderTop: "1px solid #1a221a", paddingTop: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#627661", marginBottom: 12, paddingLeft: 10, borderLeft: "2px solid #3d5343" }}>Home Advantage</div>
                {tHasGroups && (<div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 6 }}>Group Stage</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[["off", "Off"], ["first", "First Listed"], ["weak_skill", "Weaker (Skill)"], ["host", "Host Team"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, homeAdvGroup: id, homeAdvTeams: id !== "host" && c.homeAdvKO !== "host" ? [] : c.homeAdvTeams }))} style={{ ...chip, background: tConfig.homeAdvGroup === id ? "#3d5343" : "#1a221a", color: tConfig.homeAdvGroup === id ? "#d3ebd3" : "#6b7a6b" }}>{l}</button>
                    ))}
                  </div>
                </div>)}
                {tHasKO && tConfig.koLegs !== 2 && (<div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 6 }}>Knockout Stage</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[["off", "Off"], ["first", "First Listed"], ["weak_skill", "Weaker (Skill)"], ...(tHasGroups ? [["weak_group", "Weaker (Group)"]] : []), ["host", "Host Team"]].map(([id, l]) => (
                      <button key={id} onClick={() => setTConfig(c => ({ ...c, homeAdvKO: id, homeAdvTeams: id !== "host" && c.homeAdvGroup !== "host" ? [] : c.homeAdvTeams }))} style={{ ...chip, background: tConfig.homeAdvKO === id ? "#3d5343" : "#1a221a", color: tConfig.homeAdvKO === id ? "#d3ebd3" : "#6b7a6b" }}>{l}</button>
                    ))}
                  </div>
                </div>)}
                {(tConfig.homeAdvGroup === "host" || (tConfig.homeAdvKO === "host" && tConfig.koLegs !== 2)) && (<div>
                  <div style={{ fontSize: 11, color: "#4c5a4c", marginBottom: 6 }}>Select Host Team(s) <span style={{ color: "#3b4a3b" }}>(always home advantage)</span></div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {teams.map((t, i) => { const sel = tConfig.homeAdvTeams.includes(t.name); return (
                      <button key={i} onClick={() => setTConfig(c => ({ ...c, homeAdvTeams: sel ? c.homeAdvTeams.filter(n => n !== t.name) : [...c.homeAdvTeams, t.name] }))} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid " + (sel ? "#3d5343" : "#1a221a"), background: sel ? "#3d534333" : "transparent", color: sel ? "#d3ebd3" : "#4c5a4c", cursor: "pointer", fontFamily: "inherit" }}>{abbr(t.name, t.code)}</button>
                    ); })}
                  </div>
                  {tConfig.homeAdvTeams.length > 0 && <div style={{ fontSize: 9, color: "#627661", marginTop: 4, ...mono }}>{tConfig.homeAdvTeams.join(", ")}</div>}
                </div>)}
              </div>
              {/* Summary */}
              <div style={{ background: "#0a0f0c", borderRadius: 8, padding: "14px 18px", marginBottom: 18, border: "1px solid #1a221a" }}>
                {tConfig.mode === "single" && tConfig.singleType === "knockout" ? (<>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 12, alignItems: "baseline" }}>
                    <span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>TEAMS</span>
                    <span style={{ color: "#c5c8c6" }}>{teams.length}</span>
                    <span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>FORMAT</span>
                    <span style={{ color: "#c5c8c6" }}>Single-Elimination Bracket</span>
                    {!isPow2(teams.length) && teams.length >= 2 && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>BYES</span><span style={{ color: "#ebcb8b" }}>{(() => { let n = 1; while (n < teams.length) n *= 2; return n - teams.length; })()} byes → {(() => { let n = 1; while (n < teams.length) n *= 2; return n; })()} bracket</span></>}
                    {tConfig.koLegs === 2 && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>LEGS</span><span style={{ color: "#c5c8c6" }}>2-Legged{tConfig.koAwayGoals ? " (Away Goals)" : ""}</span></>}
                    {tConfig.thirdPlace && teams.length >= 4 && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>EXTRA</span><span style={{ color: "#c5c8c6" }}>3rd Place Match</span></>}
                    <span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>KO DRAW</span>
                    <span style={{ color: "#c5c8c6" }}>{({seed:"Seeded",random:"Random",manual:"Manual",draw:"Draw"})[tConfig.koAllocMode]}</span>
                    {(tConfig.homeAdvKO !== "off" || tConfig.homeAdvGroup !== "off") && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>HOME ADV</span><span style={{ color: "#c5c8c6" }}>{({off:"Off",first:"First Listed",weak_skill:"Weaker (Skill)",weak_group:"Weaker (Group)",host:"Host Team"})[tConfig.homeAdvKO] || "Off"}</span></>}
                  </div>
                  {teams.length < 2 && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Need at least 2 teams</div>}
                  {teamErrors && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Fix skill values (25–100)</div>}
                  {tValid && <div style={{ color: "#3d5343", fontSize: 11, marginTop: 8, fontWeight: 600 }}>✓ Ready</div>}
                </>) : (()=>{ const swissOk = tSwissOk; const rrRounds = (tPerGroup - 1) * tConfig.rrLegs; const rrMatchesPerGroup = tPerGroup * (tPerGroup - 1) / 2 * tConfig.rrLegs; const totalMatches = tConfig.matchFormat === "swiss" ? Math.floor(tPerGroup / 2) * tConfig.swissRounds * tConfig.numGroups : tConfig.numGroups * rrMatchesPerGroup; return (<>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 12, alignItems: "baseline" }}>
                    <span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>TEAMS</span>
                    <span style={{ color: "#c5c8c6" }}>{teams.length}{tGroupsOk && tUneven ? <span style={{ color: "#ebcb8b", fontSize: 10, marginLeft: 6 }}>(uneven groups)</span> : ""}</span>
                    <span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>GROUPS</span>
                    <span style={{ color: "#c5c8c6" }}>{tGroupsOk ? tConfig.numGroups : "?"} × {tGroupsOk && tPerGroup >= 2 ? (tDivisible ? tPerGroup : tPerGroup+"–"+tPerGroupMax) : "?"} teams</span>
                    <span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>FORMAT</span>
                    <span style={{ color: "#c5c8c6" }}>{tConfig.matchFormat === "swiss" ? "Swiss" : "Round Robin"}{tConfig.matchFormat === "roundRobin" && tConfig.rrLegs > 1 ? " ("+tConfig.rrLegs+" legs)" : ""}</span>
                    <span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>MATCHES</span>
                    <span style={{ color: "#c5c8c6" }}>{tConfig.matchFormat === "swiss" ? tConfig.swissRounds+" rounds" : rrRounds+" rounds"}{tValid && swissOk ? ", "+totalMatches+" total" : ""}</span>
                    {tConfig.numGroups > 1 && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>DRAW</span><span style={{ color: "#c5c8c6" }}>{({seed:"Seeded",random:"Random",manual:"Manual",draw:"Draw"})[tConfig.allocMode]}{tConfig.allocMode === "draw" ? " ("+tConfig.numPots+" pots)" : ""}</span></>}
                    {tHasKO && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>ADVANCE</span><span style={{ color: "#c5c8c6" }}>{tUseZones ? tKoTeams + " teams via zones" : "Top " + tConfig.advPerGroup + " per group → " + tKoTeams + " teams"}{!isPow2(tKoTeams) ? " (+byes)" : ""}</span></>}
                    {tHasKO && tConfig.koLegs === 2 && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>KO LEGS</span><span style={{ color: "#c5c8c6" }}>2-Legged{tConfig.koAwayGoals ? " (Away Goals)" : ""}</span></>}
                    {tHasKO && tConfig.thirdPlace && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>EXTRA</span><span style={{ color: "#c5c8c6" }}>3rd Place Match</span></>}
                    {tHasKO && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>KO DRAW</span><span style={{ color: "#c5c8c6" }}>{({seed:"Seeded",random:"Random",manual:"Manual",draw:"Draw"})[tConfig.koAllocMode]}</span></>}
                    {!tHasKO && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>STAGE</span><span style={{ color: "#c5c8c6" }}>{tConfig.numGroups === 1 ? "League — no knockout" : "Groups only — no knockout"}</span></>}
                    {(tConfig.homeAdvGroup !== "off" || tConfig.homeAdvKO !== "off") && <><span style={{ color: "#4c5a4c", fontSize: 10, fontWeight: 600 }}>HOME ADV</span><span style={{ color: "#c5c8c6" }}>{tHasGroups ? ({off:"Off",first:"First Listed",weak_skill:"Weaker (Skill)",host:"Host Team"})[tConfig.homeAdvGroup] || "Off" : ""}{tHasGroups && tHasKO && tConfig.homeAdvGroup !== "off" && tConfig.homeAdvKO !== "off" ? " / " : ""}{tHasKO && tConfig.koLegs !== 2 ? ({off:"",first:"First Listed",weak_skill:"Weaker (Skill)",weak_group:"Weaker (Group)",host:"Host Team"})[tConfig.homeAdvKO] || "" : ""}</span></>}
                  </div>
                  {!tGroupsOk && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Groups must be 1–26</div>}
                  {tGroupsOk && tPerGroup < 2 && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Need ≥2 teams per group</div>}
                  {!swissOk && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Swiss rounds must be 1–{tPerGroup - 1}</div>}
                  {tHasKO && !tAdvOk && tDivisible && tPerGroup >= 2 && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Advance must be 1–{tPerGroup}</div>}
                  {teamErrors && <div style={{ color: "#bf616a", fontSize: 11, marginTop: 8 }}>⚠ Fix skill values (25–100)</div>}
                  {tValid && swissOk && <div style={{ color: "#3d5343", fontSize: 11, marginTop: 8, fontWeight: 600 }}>✓ Ready</div>}
                </>); })()}
              </div>
              <button onClick={() => createTournament()} disabled={!tValid} style={{ ...scBtn, opacity: tValid ? 1 : 0.4, cursor: tValid ? "pointer" : "default" }}>▶ {tHasGroups && tConfig.allocMode === "manual" && tConfig.numGroups > 1 ? "Begin Allocation" : "Create Tournament"}</button>
            </div>
          </div>)}

          {/* MANUAL ALLOCATION */}
          {tPhase === "manual" && tManual && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c" }}>MANUAL ALLOCATION</div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ ...mono, fontSize: 10, color: "#555" }}>{tManual.pool.length} remaining</span><button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a" }}>Reset</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 4)}, 1fr)`, gap: 10, marginBottom: 16 }}>
              {tManual.grps.map((g, gi) => (<div key={gi} style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 7, padding: "12px 10px", boxShadow: "0 1px 6px #00000018" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c", textAlign: "center", marginBottom: 8 }}>GROUP {g.label}</div>
                {g.teams.map((t, ti) => (<div key={ti} style={{ fontSize: 11, padding: "3px 0", borderBottom: "1px solid #151e15", display: "flex", justifyContent: "space-between" }}><span>{t.name}</span><span style={{ ...mono, fontSize: 10, color: "#666" }}>{t.skill}</span></div>))}
                {g.teams.length < (gi < (teams.length % tConfig.numGroups) ? tPerGroupMax : tPerGroup) && (<div style={{ marginTop: 4 }}><select onChange={e => { if (e.target.value !== "") { tManualAssign(+e.target.value, gi); e.target.value = ""; } }} style={{ ...sel, width: "100%", fontSize: 10 }}><option value="">+ Assign team...</option>{tManual.pool.map((t, ti) => <option key={ti} value={ti}>{t.name} ({t.skill})</option>)}</select></div>)}
              </div>))}
            </div>
            {tManual.pool.length === 0 && <button onClick={tManualConfirm} style={scBtn}>▶ Start Tournament</button>}
          </div>)}

          {/* KO MANUAL ALLOCATION */}
          {tPhase === "ko_byes" && tByeManual && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c" }}>SELECT BYE TEAMS</div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ ...mono, fontSize: 10, color: "#ebcb8b" }}>{tByeManual.selected.length} / {tByeManual.numByes} selected</span><button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a" }}>Reset</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, marginBottom: 16 }}>
              {tByeManual.pool.map((t, ti) => { const sel = tByeManual.selected.some(s => s.name === t.name); return (
                <button key={ti} onClick={() => { if (sel) { setTByeManual(b => ({...b, selected: b.selected.filter(s => s.name !== t.name)})); } else if (tByeManual.selected.length < tByeManual.numByes) { setTByeManual(b => ({...b, selected: [...b.selected, t]})); } }}
                  style={{ ...chip, background: sel ? "#3d5343" : "transparent", color: sel ? "#fff" : "#6b7a6b", borderColor: sel ? "#3d5343" : "#2a3a2a", fontSize: 10, padding: "6px 10px", textAlign: "left" }}>
                  {t.name} <span style={{ color: sel ? "#a3be8c" : "#555", fontSize: 9 }}>({t.skill})</span>
                </button>
              ); })}
            </div>
            {tByeManual.selected.length === tByeManual.numByes && <button onClick={tByeConfirm} style={scBtn}>▶ Confirm Byes & Allocate</button>}
          </div>)}
          {tPhase === "ko_manual" && tKOManual && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c" }}>KNOCKOUT BRACKET ALLOCATION</div>
              <div style={{ display: "flex", gap: 8 }}>{tKOManual.numByes > 0 && <span style={{ ...mono, fontSize: 10, color: "#ebcb8b" }}>{tKOManual.numByes} bye{tKOManual.numByes !== 1 ? "s" : ""} needed</span>}<span style={{ ...mono, fontSize: 10, color: "#555" }}>{tKOManual.pool.length} remaining</span><button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a" }}>Reset</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tKOManual.matches.length, 4)}, 1fr)`, gap: 10, marginBottom: 16 }}>
              {tKOManual.matches.map((m, mi) => (<div key={mi} style={{ background: "#0f1310", border: `1px solid ${m.home && !m.away || m.away && !m.home ? "#ebcb8b33" : "#1a221a"}`, borderRadius: 7, padding: "12px 10px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: m.home && !m.away || m.away && !m.home ? "#ebcb8b" : "#3d5343", textAlign: "center", marginBottom: 8, ...mono }}>{m.home && !m.away || m.away && !m.home ? "BYE" : `MATCH ${mi + 1}`}</div>
                {["home", "away"].map(slot => (<div key={slot} style={{ marginBottom: 4 }}>
                  {m[slot] ? (
                    <div style={{ fontSize: 11, padding: "4px 8px", background: "#141a14", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c" }}>{tConfig.numGroups === 1 ? "LEAGUE" : "GROUP STAGE"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ ...mono, fontSize: 10, color: "#555" }}>{tPlayedMatches}/{tTotalMatches}</span>
                {tPlayedMatches < tTotalMatches && <button onClick={() => tScorinate(-1, -1, -1)} style={{ ...addBtn, color: "#d3ebd3", borderColor: "#2a3a20" }}>▶ Sim All</button>}
                <button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a", borderColor: "#3a2020" }}>Reset</button>
              </div>
            </div>

            {/* Draw log */}
            {tDrawLog.length > 0 && (<details style={{ marginBottom: 16 }}><summary style={{ fontSize: 10, color: "#c9a84c", cursor: "pointer", ...mono, letterSpacing: 2 }}><span className="dta">▶</span>DRAW LOG ({tDrawLog.length} placements)</summary><div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 5, padding: 10, marginTop: 8, maxHeight: 200, overflowY: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#555" }}><th style={{ padding: "2px 4px", textAlign: "left" }}>Pot</th><th style={{ padding: "2px 4px", textAlign: "left" }}>Team</th><th style={{ padding: "2px 4px", textAlign: "center" }}>Skill</th><th style={{ padding: "2px 4px", textAlign: "center" }}>Group</th></tr></thead><tbody>{tDrawLog.map((e, i) => (<tr key={i} style={{ borderTop: "1px solid #151e15" }}><td style={{ padding: "2px 4px", color: "#c9a84c" }}>{e.pot}</td><td style={{ padding: "2px 4px", color: "#ddd" }}>{e.team}</td><td style={{ padding: "2px 4px", color: "#666", textAlign: "center" }}>{e.skill}</td><td style={{ padding: "2px 4px", color: "#c9a84c", fontWeight: 700, textAlign: "center" }}>{e.group}</td></tr>))}</tbody></table></div></details>)}

            {/* Standings */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 2)}, 1fr)`, gap: 10, marginBottom: 20 }}>
              {tGroups.map((g, gi) => { const form = computeForm(g); const N = g.standings.length; return (<div key={gi} style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 7, padding: "12px 10px", boxShadow: "0 1px 6px #00000018" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c", textAlign: "center", marginBottom: 8 }}>{tConfig.numGroups === 1 ? "LEAGUE TABLE" : "GROUP " + g.label}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#4c5a4c" }}><th style={{ padding: "2px", fontWeight: 400, width: 20 }}>#</th><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>W</th><th style={{ padding: "2px", fontWeight: 400 }}>D</th><th style={{ padding: "2px", fontWeight: 400 }}>L</th><th style={{ padding: "2px", fontWeight: 400 }}>GF</th><th style={{ padding: "2px", fontWeight: 400 }}>GA</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th><th style={{ padding: "2px 2px 2px 6px", fontWeight: 400, textAlign: "right", width: 1, whiteSpace: "nowrap" }}>Form</th></tr></thead>
                  <tbody>{g.standings.map((r, ri) => { const zone = zoneFor(ri, N, tConfig.qualZones); return (<tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#0a0f0c66" }}><td style={{ padding: "2px 4px 2px 2px", textAlign: "right", ...mono, fontSize: 9, color: "#4c5a4c", width: 20 }}>{ri + 1}</td><td style={{ padding: "3px 3px 3px 4px", color: zone ? zone.color : "#8892a6", fontWeight: zone ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderLeft: zone ? "2px solid " + zone.color : "2px solid transparent" }}>{r.name}{ri < N - 1 && areTied(r, g.standings[ri+1], tConfig.tiebreakers, g.schedule) && <button onClick={e => { e.stopPropagation(); tSwapStandings(gi, ri); }} title="Swap with team below (manual tiebreak)" style={{ background: "none", border: "1px solid #d0877044", borderRadius: 3, color: "#d08770", fontSize: 8, cursor: "pointer", padding: "0 4px", fontFamily: "inherit", marginLeft: 6 }}>⇅</button>}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.p}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.w}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.d}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.l}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.gf}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.ga}</td><td style={{ padding: "2px", textAlign: "center", ...mono, color: r.gf - r.ga > 0 ? "#d3ebd3" : r.gf - r.ga < 0 ? "#bf616a" : "#666" }}>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td><td style={{ padding: "2px", color: "#3d5343", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td><td style={{ padding: "2px 0 2px 6px", width: 1, whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>{(form[r.name] || []).slice(-5).map((f, fi) => (<span key={fi} title={f.bye ? "Bye" : (f.home ? "vs " : "@ ") + f.opp + " " + f.gf + "–" + f.ga} style={{ width: 15, height: 15, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, ...mono, flexShrink: 0, background: f.r === "W" ? "#26402a" : f.r === "D" ? "#3a3520" : "#43282a", color: f.r === "W" ? "#8fbf8f" : f.r === "D" ? "#ebcb8b" : "#e08a8a" }}>{f.r}</span>))}{(form[r.name] || []).length === 0 && <span style={{ color: "#2a3a2a", fontSize: 9 }}>—</span>}</div></td></tr>); })}</tbody></table>
                {qz.length > 0 && <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: "1px solid #151e15" }}>{tConfig.qualZones.map((z, zi) => (<div key={zi} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: z.color }} /><span style={{ fontSize: 10, color: "#8892a6" }}>{z.label}</span></div>))}</div>}
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
              <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 7, padding: "12px 10px", marginBottom: 20, boxShadow: "0 1px 6px #00000018" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: bestZone?.color || "#4a7ab5", textAlign: "center", marginBottom: 8 }}>{bestZone?.label?.toUpperCase() || "POOL QUALIFICATION"} — POOL RANKING</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#4c5a4c" }}><th style={{ padding: "2px", fontWeight: 400, width: 20 }}>#</th><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>Grp</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>W</th><th style={{ padding: "2px", fontWeight: 400 }}>D</th><th style={{ padding: "2px", fontWeight: 400 }}>L</th><th style={{ padding: "2px", fontWeight: 400 }}>GF</th><th style={{ padding: "2px", fontWeight: 400 }}>GA</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th><th style={{ padding: "2px 2px 2px 6px", fontWeight: 400, textAlign: "right", width: 1, whiteSpace: "nowrap" }}>Form</th></tr></thead>
                <tbody>{pool.map((r, ri) => { const qual = ri < bestCount; return (<tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#0a0f0c66" }}><td style={{ padding: "2px 4px", ...mono, fontSize: 9, color: "#4c5a4c", textAlign: "right", width: 20 }}>{ri + 1}</td><td style={{ padding: "3px 3px 3px 4px", color: qual ? (bestZone?.color || "#4a7ab5") : "#555", fontWeight: qual ? 600 : 400, borderLeft: qual ? "2px solid " + (bestZone?.color || "#4a7ab5") : "2px solid transparent", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</td><td style={{ padding: "2px", ...mono, fontSize: 9, color: "#627661", textAlign: "center" }}>{r.groupLabel}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.p}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.w}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.d}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.l}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.gf}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.ga}</td><td style={{ padding: "2px", textAlign: "center", ...mono, color: r.gf - r.ga > 0 ? "#d3ebd3" : r.gf - r.ga < 0 ? "#bf616a" : "#666" }}>{r.gf-r.ga>0?"+":""}{r.gf-r.ga}</td><td style={{ padding: "2px", color: "#3d5343", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td><td style={{ padding: "2px 0 2px 6px", width: 1, whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>{(form[r.name] || []).slice(-5).map((f, fi) => (<span key={fi} title={f.bye ? "Bye" : (f.home ? "vs " : "@ ") + f.opp + " " + f.gf + "–" + f.ga} style={{ width: 15, height: 15, borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, ...mono, flexShrink: 0, background: f.r === "W" ? "#26402a" : f.r === "D" ? "#3a3520" : "#43282a", color: f.r === "W" ? "#8fbf8f" : f.r === "D" ? "#ebcb8b" : "#e08a8a" }}>{f.r}</span>))}{(form[r.name] || []).length === 0 && <span style={{ color: "#2a3a2a", fontSize: 9 }}>—</span>}</div></td></tr>); })}</tbody></table>
                {bestCount > 0 && <div style={{ display: "flex", gap: 14, marginTop: 8, paddingTop: 6, borderTop: "1px solid #151e15" }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: bestZone?.color || "#4a7ab5" }} /><span style={{ fontSize: 10, color: "#8892a6" }}>Top {bestCount} qualify</span></div></div>}
              </div>);
            })()}

            {/* Fixtures - compact, scrollable per round */}
            <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c", marginBottom: 12 }}>FIXTURES</div>
              {(()=>{ const maxRds = Math.max(...tGroups.map(g => g.schedule.length)); const firstOpen = Array.from({length:maxRds},(_,ri)=>ri).findIndex(ri => !tGroups.every(g => (g.schedule[ri]||[]).every(m => m.result))); return Array.from({length:maxRds},(_,ri)=>ri).map(ri => { const rdDone = tGroups.every(g => (g.schedule[ri] || []).every(m => m.result)); return (<details key={ri} open={ri === firstOpen} style={{ marginBottom: 8 }}>
                <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", cursor: "pointer", userSelect: "none", borderBottom: "1px solid #1a221a" }}>
                  <div style={{ fontSize: 10, color: rdDone ? "#3b4a3b" : "#3d5343", fontWeight: 600, letterSpacing: 2 }}><span className="dta">▶</span>ROUND {ri + 1} {rdDone && <span style={{ color: "#3b4a3b" }}>✓</span>}</div>
                  {!rdDone && ri === firstOpen && <button onClick={e => {e.preventDefault();tScorinate(-1, ri, -1)}} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#627661" }}>▶ Sim Round</button>}
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 2)}, 1fr)`, gap: 6, padding: "8px 0 12px", borderBottom: "1px solid #1a221a" }}>
                  {tGroups.map((g, gi) => (<div key={gi} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: "#4c5a4c", marginBottom: 2, letterSpacing: 1, ...mono }}>{g.label}</div>
                    {(g.schedule[ri] || []).map((m, mi) => { if (m.bye) return (<div key={mi} style={{ fontSize: 10, padding: "2px 0", borderBottom: "1px solid #121a12", display: "flex", alignItems: "center", gap: 2, minWidth: 0, color: "#3b4a3b" }}><span style={{ flex: 1 }}>{m.home?.name}</span><span style={{ ...mono, fontSize: 9 }}>BYE</span></div>); const editing = tEdit && tEdit.gi===gi && tEdit.ri===ri && tEdit.mi===mi; const haKey = `g_${gi}_${ri}_${mi}`; const haVal = tHomeAdvOverrides[haKey] || null; return (<div key={mi} style={{ fontSize: 10, padding: "2px 0", borderBottom: "1px solid #121a12", display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: m.result ? (m.result.ftHome > m.result.ftAway ? "#d3ebd3" : m.result.ftHome < m.result.ftAway ? "#666" : "#ebcb8b") : "#888", fontSize: 10 }}>{haVal === "home" && <span style={{ color: "#3d5343", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name}</span>
                      <button onClick={() => tToggleHA(haKey)} title={haVal === null ? "Auto" : haVal === "home" ? "Home advantage: Home" : haVal === "away" ? "Home advantage: Away" : "Home advantage: Off"} style={{ background: "none", border: "none", color: haVal === null ? "#1a221a" : haVal === "off" ? "#bf616a" : "#3d5343", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, flexShrink: 0, opacity: haVal ? 1 : 0.4 }}>H</button>
                      {editing ? <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}><input type="number" min={0} value={tEdit.h} onChange={e => setTEdit(p => ({...p, h: e.target.value}))} style={{ width: 30, padding: "0 2px", fontSize: 10, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 2, color: "#c5c8c6", fontFamily: "inherit", lineHeight: "16px" }} /><span style={{ color: "#4c5a4c", fontSize: 8 }}>–</span><input type="number" min={0} value={tEdit.a} onChange={e => setTEdit(p => ({...p, a: e.target.value}))} style={{ width: 30, padding: "0 2px", fontSize: 10, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 2, color: "#c5c8c6", fontFamily: "inherit", lineHeight: "16px" }} /><button onClick={tSetManualScore} style={{ background: "#3d5343", border: "none", color: "#d3ebd3", fontSize: 8, cursor: "pointer", padding: "1px 5px", fontFamily: "inherit", borderRadius: 2, lineHeight: "14px" }}>OK</button><button onClick={() => { setTEdit(null); setTScoreError(""); }} style={{ background: "none", border: "none", color: "#bf616a", fontSize: 12, cursor: "pointer", padding: "0 2px", fontFamily: "inherit", lineHeight: "14px" }}>✗</button></span>
                        : m.result ? <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}><span style={{ ...mono, fontSize: 9, color: "#3d5343", fontWeight: 600 }}>{m.result.ftHome}-{m.result.ftAway}</span><button onClick={() => setTEdit({ gi, ri, mi, h: String(m.result.ftHome), a: String(m.result.ftAway) })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 8, padding: "0 3px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button></span>
                        : ri === firstOpen ? <span style={{ display: "flex", gap: 2, flexShrink: 0 }}><button onClick={() => tScorinate(gi, ri, mi)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 8, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTEdit({ gi, ri, mi, h: "", a: "" })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 8, padding: "0 3px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"group",gi,ri,mi})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 8, padding: "0 3px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span> : <span style={{ ...mono, fontSize: 9, color: "#2a3a2a" }}>–</span>}
                      <span style={{ flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: m.result ? (m.result.ftAway > m.result.ftHome ? "#d3ebd3" : m.result.ftAway < m.result.ftHome ? "#666" : "#ebcb8b") : "#888", fontSize: 10 }}>{m.away?.name}{haVal === "away" && <span style={{ color: "#3d5343", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                    </div>); })}
                  </div>))}
                </div>
              </details>); }); })()}
            </div>

            {/* Swiss: generate next round */}
            {tConfig.matchFormat === "swiss" && tSwissCurrentDone && tSwissRoundsPlayed < tConfig.swissRounds && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#627661", marginBottom: 8, ...mono }}>Round {tSwissRoundsPlayed} complete — {tConfig.swissRounds - tSwissRoundsPlayed} remaining</div>
                <button onClick={tGenNextSwissRound} style={{ ...scBtn, background: "linear-gradient(135deg, #627661 0%, #3d5343 100%)" }}>▶ Generate Round {tSwissRoundsPlayed + 1}</button>
              </div>
            )}

            {((tConfig.matchFormat === "roundRobin" && tPlayedMatches === tTotalMatches && tTotalMatches > 0) || tSwissAllDone) && (
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <div style={{ fontSize: 12, color: "#d3ebd3", marginBottom: 8, ...mono }}>✓ All {tConfig.numGroups === 1 ? "league " : "group "} matches complete</div>
                {tHasKO ? (tHasUnresolved ? <div style={{ background: "#0f1310", border: "1px solid #bf616a33", borderRadius: 8, padding: 16, textAlign: "center" }}><div style={{ fontSize: 11, color: "#bf616a", marginBottom: 8 }}>Tiebreaker required</div><div style={{ fontSize: 10, color: "#666" }}>Teams are tied at a qualification boundary. Use the swap buttons (⇅) in the standings to resolve.</div></div> : <button onClick={tProceedKO} style={scBtn}>▶ Proceed to Knockout Stage</button>)
                  : (<div style={{ background: "#0f1310", border: "1px solid #c9a84c33", borderRadius: 8, padding: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: 4, color: "#c9a84c", marginBottom: 8 }}>{tConfig.numGroups === 1 ? "FINAL STANDINGS" : "TOURNAMENT COMPLETE"}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{tGroups[0]?.standings[0]?.name}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 4, ...mono }}>Champion — {tGroups[0]?.standings[0]?.pts} pts</div>
                  </div>)}
              </div>
            )}
          </div>)}

          {/* KNOCKOUT */}
          {(tPhase === "knockout" || tPhase === "complete") && tKO && (<div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c" }}>KNOCKOUT STAGE</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {tPhase === "knockout" && <button onClick={() => tScorinateKO(-1, -1, 0)} style={{ ...addBtn, color: "#d3ebd3", borderColor: "#2a3a20" }}>▶ Sim All</button>}
                <button onClick={resetTournament} style={{ ...addBtn, color: "#bf616a", borderColor: "#3a2020" }}>Reset</button>
              </div>
            </div>
            {tGroups.length > 0 && (<details style={{ marginBottom: 16 }}><summary style={{ fontSize: 10, color: "#627661", cursor: "pointer", letterSpacing: 2 }}><span className="dta">▶</span>GROUP STAGE RESULTS</summary><div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tConfig.numGroups, 3)}, 1fr)`, gap: 10, marginTop: 10 }}>
              {tGroups.map((g, gi) => (<div key={gi} style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 5, padding: "10px 8px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "#627661", textAlign: "center", marginBottom: 6, ...mono }}>GROUP {g.label}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#4c5a4c" }}><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th></tr></thead>
                  <tbody>{g.standings.map((r, ri) => { const zone = zoneFor(ri, g.standings.length, tConfig.qualZones); return (<tr key={ri} style={{ borderTop: "1px solid #151e15" }}><td style={{ padding: "2px 3px", color: zone ? zone.color : "#666", fontWeight: zone ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderLeft: zone ? "2px solid " + zone.color : "2px solid transparent" }}>{r.name}</td><td style={{ padding: "2px", color: "#555", textAlign: "center" }}>{r.p}</td><td style={{ padding: "2px", textAlign: "center", color: r.gf - r.ga > 0 ? "#d3ebd3" : r.gf - r.ga < 0 ? "#bf616a" : "#555" }}>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td><td style={{ padding: "2px", color: "#3d5343", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td></tr>); })}</tbody></table>
              </div>))}
            </div>
            {tPoolData && tPoolData.pool.length > 0 && (() => { const bz = qz.find(z=>z.type==="best"); return (
              <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 7, padding: "12px 10px", marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: bz?.color || "#4a7ab5", textAlign: "center", marginBottom: 8 }}>{bz?.label?.toUpperCase() || "POOL QUALIFICATION"}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#4c5a4c" }}><th style={{ padding: "2px", fontWeight: 400, width: 20 }}>#</th><th style={{ padding: "2px 3px", textAlign: "left", fontWeight: 400 }}>Team</th><th style={{ padding: "2px", fontWeight: 400 }}>Grp</th><th style={{ padding: "2px", fontWeight: 400 }}>P</th><th style={{ padding: "2px", fontWeight: 400 }}>W</th><th style={{ padding: "2px", fontWeight: 400 }}>D</th><th style={{ padding: "2px", fontWeight: 400 }}>L</th><th style={{ padding: "2px", fontWeight: 400 }}>GF</th><th style={{ padding: "2px", fontWeight: 400 }}>GA</th><th style={{ padding: "2px", fontWeight: 400 }}>GD</th><th style={{ padding: "2px", fontWeight: 400 }}>Pts</th></tr></thead>
                <tbody>{tPoolData.pool.map((r, ri) => { const qual = ri < tPoolData.poolQualified.length; return (<tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#0a0f0c66" }}><td style={{ padding: "2px 4px", ...mono, fontSize: 9, color: "#4c5a4c", textAlign: "right", width: 20 }}>{ri + 1}</td><td style={{ padding: "3px 3px 3px 4px", color: qual ? (bz?.color||"#4a7ab5") : "#555", fontWeight: qual ? 600 : 400, borderLeft: qual ? "2px solid "+(bz?.color||"#4a7ab5") : "2px solid transparent" }}>{r.name}</td><td style={{ padding: "2px", ...mono, fontSize: 9, color: "#627661", textAlign: "center" }}>{r.groupLabel}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.p}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.w}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.d}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.l}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.gf}</td><td style={{ padding: "2px", color: "#666", textAlign: "center", ...mono }}>{r.ga}</td><td style={{ padding: "2px", textAlign: "center", ...mono, color: r.gf - r.ga > 0 ? "#d3ebd3" : r.gf - r.ga < 0 ? "#bf616a" : "#666" }}>{r.gf-r.ga>0?"+":""}{r.gf-r.ga}</td><td style={{ padding: "2px", color: "#3d5343", fontWeight: 600, textAlign: "center", ...mono }}>{r.pts}</td></tr>); })}</tbody></table>
              </div>); })()}
            </details>)}
            {tKODrawLog.length > 0 && (<details style={{ marginBottom: 16 }}><summary style={{ fontSize: 10, color: "#c9a84c", cursor: "pointer", ...mono, letterSpacing: 2 }}><span className="dta">▶</span>BRACKET DRAW LOG ({tKODrawLog.length} pairings)</summary><div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 5, padding: 10, marginTop: 8, maxHeight: 200, overflowY: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}><thead><tr style={{ color: "#555" }}><th style={{ padding: "2px 4px", textAlign: "left" }}>Home</th><th style={{ padding: "2px 4px", textAlign: "center" }}>vs</th><th style={{ padding: "2px 4px", textAlign: "right" }}>Away</th></tr></thead><tbody>{tKODrawLog.map((e, i) => (<tr key={i} style={{ borderTop: "1px solid #151e15" }}><td style={{ padding: "2px 4px", color: "#ddd" }}>{e.home} <span style={{ color: "#555" }}>({e.homeSkill})</span></td><td style={{ padding: "2px 4px", color: "#3d5343", textAlign: "center" }}>vs</td><td style={{ padding: "2px 4px", color: "#ddd", textAlign: "right" }}>{e.away} <span style={{ color: "#555" }}>({e.awaySkill})</span></td></tr>))}</tbody></table></div></details>)}
            {tPhase === "complete" && tKO.champion && (
              <div style={{ textAlign: "center", background: "linear-gradient(145deg, #0f1310 0%, #1a1c12 50%, #0f1310 100%)", border: "1px solid #c9a84c33", borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: "0 4px 24px #c9a84c11" }}>
                <div style={{ fontSize: 10, letterSpacing: 6, color: "#c9a84c", marginBottom: 10 }}>🏆 CHAMPION</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#c9a84c" }}>{tKO.champion.name}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 6, ...mono }}>{tKO.champion.skill}</div>
              </div>
            )}
            {/* Bracket/Stacked toggle */}
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              <button onClick={() => setKoBracketView(true)} style={{ ...chip, fontSize: 9, background: koBracketView ? "#3d534380" : "#0a0f0c", color: koBracketView ? "#d3ebd3" : "#4c5a4c", border: koBracketView ? "1px solid #3d5343" : "1px solid #1a221a" }}>Bracket</button>
              <button onClick={() => setKoBracketView(false)} style={{ ...chip, fontSize: 9, background: !koBracketView ? "#3d534380" : "#0a0f0c", color: !koBracketView ? "#d3ebd3" : "#4c5a4c", border: !koBracketView ? "1px solid #3d5343" : "1px solid #1a221a" }}>Stacked</button>
              {koBracketView && <button onClick={exportBracket} style={{ ...chip, fontSize: 9, background: "#0a0f0c", color: "#81a1c1", border: "1px solid #81a1c133", marginLeft: 4, cursor: "pointer" }}>📷 Export</button>}
            </div>

            {koBracketView && (() => {
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
                const decClr = hasPen || has2LPen ? "#d08770" : "#4c5a4c";
                const winner = w;
                const scoreW = is2L && !isPartial ? { display: "flex", gap: 0, textAlign: "right", ...mono, fontSize: 9, whiteSpace: "nowrap", flexShrink: 0 } : { textAlign: "right", ...mono, fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 };
                const nameClr = (team) => w === team ? "#d3ebd3" : isBye && !team ? "#2a3a2a" : "#888";
                const nameWt = (team) => w === team ? 600 : 400;
                const sClr = (team) => w === team ? "#d3ebd3" : "#555";
                return (
                  <div style={{ background: "#141a14", borderRadius: 4, padding: "4px 6px", border: ri === nR - 1 ? "2px solid #c9a84c66" : ri === -2 ? "1px solid #d0877044" : "1px solid #1e2a1e", width: colW, height: cardH - gap, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                      <span style={{ color: nameClr(m.home), fontWeight: nameWt(m.home), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, position: "relative" }}>{koHAVal === "home" && <span style={{ color: "#3d5343", fontSize: 6, marginRight: 1 }}>H</span>}{m.home?.name || (isBye ? "BYE" : "TBD")}{decLabel && winner === m.home && <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: decClr, fontWeight: 700, fontStyle: "italic", ...ui, background: "linear-gradient(90deg, transparent 0%, #141a14 30%)", paddingLeft: 10, paddingRight: 4 }}>{decLabel}</span>}</span>
                      {is2L && !isPartial ? <span style={scoreW}><span style={{ color: "#555", width: 14, display: "inline-block", textAlign: "center" }}>{l1H}</span><span style={{ color: "#555", width: 14, display: "inline-block", textAlign: "center" }}>{l2H}</span><span style={{ color: sClr(m.home), fontWeight: 600, width: 16, display: "inline-block", textAlign: "center" }}>{aggH}</span>{has2LPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}> ({m.result.pen.home})</span>}</span>
                        : <span style={{ color: sClr(m.home), fontWeight: 600, ...mono, fontSize: 10, whiteSpace: "nowrap" }}>{is2L && isPartial ? l1H : sH}{hasPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}> ({m.result.pen.home})</span>}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                      <span style={{ color: nameClr(m.away), fontWeight: nameWt(m.away), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, position: "relative" }}>{koHAVal === "away" && <span style={{ color: "#3d5343", fontSize: 6, marginRight: 1 }}>H</span>}{m.away?.name || (isBye ? "BYE" : "TBD")}{decLabel && winner === m.away && <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 10, color: decClr, fontWeight: 700, fontStyle: "italic", ...ui, background: "linear-gradient(90deg, transparent 0%, #141a14 30%)", paddingLeft: 10, paddingRight: 4 }}>{decLabel}</span>}</span>
                      {is2L && !isPartial ? <span style={scoreW}><span style={{ color: "#555", width: 14, display: "inline-block", textAlign: "center" }}>{l1A}</span><span style={{ color: "#555", width: 14, display: "inline-block", textAlign: "center" }}>{l2A}</span><span style={{ color: sClr(m.away), fontWeight: 600, width: 16, display: "inline-block", textAlign: "center" }}>{aggA}</span>{has2LPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}> ({m.result.pen.away})</span>}</span>
                        : <span style={{ color: sClr(m.away), fontWeight: 600, ...mono, fontSize: 10, whiteSpace: "nowrap" }}>{is2L && isPartial ? l1A : sA}{hasPen && <span style={{ fontSize: 8, color: "#d08770", fontWeight: 400 }}> ({m.result.pen.away})</span>}</span>}
                    </div>

                    {m.home && m.away && (!m.result || isPartial) && !isBye && (
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 1 }}>
                        {isPartial ? <button onClick={() => tScorinateKO(ri, ri === -2 ? -2 : mi, 2)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 2, color: "#81a1c1", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button>
                          : <button onClick={() => tScorinateKO(ri, ri === -2 ? -2 : mi)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 2, color: "#3d5343", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>▶</button>}
                        <button onClick={() => tPlayLive(ri === -2 ? {type:"ko",ri:0,mi:0,tp:true,leg:isPartial?2:1} : {type:"ko",ri,mi,leg:isPartial?2:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 2, color: "#81a1c1", fontSize: 7, padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }} title={isPartial?"Play L2 live":"Play live"}>{isPartial?"⚽L2":"⚽"}</button>
                        <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? "#3d5343" : "#2a3a2a", fontSize: 7, cursor: "pointer", padding: "0 2px", fontFamily: "inherit", fontWeight: 700 }}>H</button>
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
                            {hasTop && <line x1={0} y1={y1} x2={connW/2} y2={y1} stroke="#2a3a2a" strokeWidth={1} />}
                            {hasBot && <line x1={0} y1={y2} x2={connW/2} y2={y2} stroke="#2a3a2a" strokeWidth={1} />}
                            <line x1={connW/2} y1={hasTop ? y1 : midY} x2={connW/2} y2={hasBot ? y2 : midY} stroke="#2a3a2a" strokeWidth={1} />
                            <line x1={connW/2} y1={midY} x2={connW} y2={midY} stroke="#2a3a2a" strokeWidth={1} />
                          </> : <>
                            {hasTop && <line x1={connW} y1={y1} x2={connW/2} y2={y1} stroke="#2a3a2a" strokeWidth={1} />}
                            {hasBot && <line x1={connW} y1={y2} x2={connW/2} y2={y2} stroke="#2a3a2a" strokeWidth={1} />}
                            <line x1={connW/2} y1={hasTop ? y1 : midY} x2={connW/2} y2={hasBot ? y2 : midY} stroke="#2a3a2a" strokeWidth={1} />
                            <line x1={connW/2} y1={midY} x2={0} y2={midY} stroke="#2a3a2a" strokeWidth={1} />
                          </>}
                        </g>
                      );
                    })}
                    {n % 2 === 1 && (() => {
                      const y = (n - 0.5) * slotH;
                      const hasSrc = !srcMatches[n-1].bye;
                      if (!hasSrc) return null;
                      return side === "left"
                        ? <line x1={0} y1={y} x2={connW} y2={y} stroke="#2a3a2a" strokeWidth={1} />
                        : <line x1={connW} y1={y} x2={0} y2={y} stroke="#2a3a2a" strokeWidth={1} />;
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
                <div id="bracket-export" style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 16, marginBottom: 12, overflowX: "auto" }}>
                  <div style={{ display: "flex", alignItems: "stretch", gap: 0, minWidth: "fit-content" }}>
                    {/* Left half */}
                    {leftRounds.map((lr, i) => (<>
                      {i > 0 && connector(leftRounds[i-1].matches, "left")}
                      <div key={"l"+i} style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#3d5343", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>{lr.name}</div>
                        {renderCol(lr.matches, lr.ri, "left")}
                      </div>
                    </>))}
                    {/* Left → Center connector */}
                    {leftRounds.length > 0 && connector(leftRounds[leftRounds.length-1].matches, "left")}
                    {/* Center: Final */}
                    <div style={{ flexShrink: 0, marginTop: hdrH, position: "relative", height: actualH, width: colW }}>
                      <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: "100%" }}>
                        <div style={{ fontSize: 8, color: "#c9a84c", textAlign: "center", letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>FINAL</div>
                        {miniCard(tKO.rounds[nR-1].matches[0], nR-1, 0, 0)}
                      </div>
                    </div>
                    {/* Center → Right connector */}
                    {rightRounds.length > 0 && connector(rightRounds[rightRounds.length-1].matches, "right")}
                    {/* Right half (reversed) */}
                    {[...rightRounds].reverse().map((rr, i, arr) => (<>
                      <div key={"r"+i} style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#3d5343", textAlign: "center", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>{rr.name}</div>
                        {renderCol(rr.matches, rr.ri, "right")}
                      </div>
                      {i < arr.length - 1 && connector(arr[i+1].matches, "right")}
                    </>))}
                  </div>
                  {tKO.thirdPlace && <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 8, color: "#d08770", textAlign: "center", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>3RD PLACE</div>
                      {miniCard(tKO.thirdPlace, -2, 0, 0)}
                    </div>
                  </div>}
                </div>
              );
            })()}
            {!koBracketView && tKO.rounds.map((round, ri) => { if (ri === tKO.rounds.length - 1) return null; const rdDone = round.matches.every(m => m.result && !m.result.partial); const rdReady = round.matches.some(m => m.home && m.away && (!m.result || m.result.partial)); return (
              <div key={ri} style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#3d5343" }}>{round.name.toUpperCase()}</div>
                  {rdReady && !rdDone && (tConfig.koLegs === 2 ? <span style={{ display: "flex", gap: 4 }}>
                    {round.matches.some(m => m.home && m.away && !m.result) && <button onClick={() => tScorinateKO(ri, -1, 1)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#627661" }}>▶ 1st Legs</button>}
                    {round.matches.some(m => m.result?.partial) && <button onClick={() => tScorinateKO(ri, -1, 2)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#627661" }}>▶ 2nd Legs</button>}
                    <button onClick={() => tScorinateKO(ri, -1, 0)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#81a1c1" }}>▶ Both Legs</button>
                  </span> : <button onClick={() => tScorinateKO(ri, -1)} style={{ ...addBtn, fontSize: 9, padding: "2px 8px", color: "#627661" }}>▶ Sim Round</button>)}
                  {rdDone && <span style={{ fontSize: 9, color: "#3b4a3b", ...mono }}>✓</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: round.matches.length > 2 ? `repeat(${Math.min(round.matches.length, 2)}, 1fr)` : "1fr", gap: 8 }}>
                  {round.matches.map((m, mi) => { const koHAKey = `ko_${ri}_${mi}`; const koHAVal = tHomeAdvOverrides[koHAKey] || null; return (
                    <div key={mi} style={{ background: "#141a14", borderRadius: 4, padding: "8px 10px", border: ri === tKO.rounds.length - 1 ? "1px solid #c9a84c33" : "1px solid #1e2a1e" }}>
                      {round.matches.length > 2 ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: m.result && koWinner(m) === m.home ? "#d3ebd3" : "#999", fontWeight: m.result && koWinner(m) === m.home ? 600 : 400 }}>{koHAVal === "home" && <span style={{ color: "#3d5343", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name || (m.bye ? "BYE" : "TBD")}</div>{m.home && m.away && <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? (koHAVal === "off" ? "#bf616a" : "#3d5343") : "#3b4a3b", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: koHAVal ? 1 : 0.4 }}>H</button>}</div>
                          <div style={{ textAlign: "center", padding: "4px 0" }}>
                            {tKoEdit && tKoEdit.ri===ri && tKoEdit.mi===mi && !tKoEdit.tp ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>{tKoEdit.step === "l1" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 1:</span>}{tKoEdit.step === "l2" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 2 <span style={{color:"#4c5a4c"}}>(L1: {tKoEdit.l1h}–{tKoEdit.l1a})</span></span>}{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#4c5a4c"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#4c5a4c"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 3, color: "#c5c8c6", fontFamily: "inherit" }} /><span style={{ color: "#4c5a4c", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 3, color: "#c5c8c6", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#3d5343", border: "none", color: "#d3ebd3", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3, letterSpacing: "0.05em" }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a2a", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                              : m.result?.partial ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><span style={{ ...mono, fontSize: 10, color: "#81a1c1", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => tScorinateKO(ri, mi, 2)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:2})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play L2 live">⚽ L2</button></span>
                              : m.result ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><span style={{ ...mono, fontSize: 10, color: "#3d5343", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => setTKoEdit({ ri, mi, h: String(m.result.twoLeg ? m.result.leg1.home : m.result.ftHome), a: String(m.result.twoLeg ? m.result.leg1.away : m.result.ftAway), tp: false, ...(m.result.twoLeg ? {twoLeg:true, step:"l1", l2h:String(m.result.leg2?.away??0), l2a:String(m.result.leg2?.home??0)} : {}) })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button></span>
                              : m.home && m.away ? <span style={{ display: "flex", gap: 4, justifyContent: "center" }}><button onClick={() => tScorinateKO(ri, mi)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri, mi, h: "", a: "", tp: false, ...(tConfig.koLegs===2?{twoLeg:true,step:"l1"}:{}) })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                                : <span style={{ ...mono, fontSize: 10, color: "#333" }}>–</span>}
                          </div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: m.result && koWinner(m) === m.away ? "#d3ebd3" : "#999", fontWeight: m.result && koWinner(m) === m.away ? 600 : 400, textAlign: "right" }}>{m.away?.name || (m.bye ? "BYE" : "TBD")}{koHAVal === "away" && <span style={{ color: "#3d5343", fontSize: 7, marginLeft: 2 }}>H</span>}</div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.home ? "#d3ebd3" : "#999", fontWeight: m.result && koWinner(m) === m.home ? 600 : 400, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{koHAVal === "home" && <span style={{ color: "#3d5343", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name || (m.bye ? "BYE" : "TBD")}</span>
                          {m.home && m.away && <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? (koHAVal === "off" ? "#bf616a" : "#3d5343") : "#3b4a3b", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: koHAVal ? 1 : 0.4 }}>H</button>}
                          {tKoEdit && tKoEdit.ri===ri && tKoEdit.mi===mi && !tKoEdit.tp ? <span style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 4px" }}>{tKoEdit.step === "l1" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 1:</span>}{tKoEdit.step === "l2" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 2 <span style={{color:"#4c5a4c"}}>(L1: {tKoEdit.l1h}–{tKoEdit.l1a})</span></span>}{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#4c5a4c"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#4c5a4c"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 3, color: "#c5c8c6", fontFamily: "inherit" }} /><span style={{ color: "#4c5a4c", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 3, color: "#c5c8c6", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#3d5343", border: "none", color: "#d3ebd3", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3, letterSpacing: "0.05em" }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a2a", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                            : m.result?.partial ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#81a1c1", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => tScorinateKO(ri, mi, 2)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:2})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play L2 live">⚽ L2</button></span>
                            : m.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#3d5343", fontWeight: 600 }}>{koResultText(m)}</span><button onClick={() => setTKoEdit({ ri, mi, h: String(m.result.twoLeg ? m.result.leg1.home : m.result.ftHome), a: String(m.result.twoLeg ? m.result.leg1.away : m.result.ftAway), tp: false, ...(m.result.twoLeg ? {twoLeg:true, step:"l1", l2h:String(m.result.leg2?.away??0), l2a:String(m.result.leg2?.home??0)} : {}) })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button></span>
                            : m.home && m.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(ri, mi)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri, mi, h: "", a: "", tp: false, ...(tConfig.koLegs===2?{twoLeg:true,step:"l1"}:{}) })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                              : <span style={{ ...mono, fontSize: 10, color: "#333", margin: "0 6px" }}>–</span>}
                          <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.away ? "#d3ebd3" : "#999", fontWeight: m.result && koWinner(m) === m.away ? 600 : 400, flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.away?.name || (m.bye ? "BYE" : "TBD")}{koHAVal === "away" && <span style={{ color: "#3d5343", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                        </div>
                      )}
                    </div>
                  ); })}
                </div>
              </div>
            ); })}
            {!koBracketView && tKO.thirdPlace && (()=>{ const tpHAVal = tHomeAdvOverrides["tp"] || null; return (
              <div style={{ background: "#0f1310", border: "1px solid #1a221a", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#d08770", marginBottom: 10, ...mono }}>3RD PLACE MATCH</div>
                <div style={{ background: "#141a14", borderRadius: 4, padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: tKO.thirdPlace.result && koWinner(tKO.thirdPlace) === tKO.thirdPlace.home ? "#d3ebd3" : "#999", flex: 1 }}>{tpHAVal === "home" && <span style={{ color: "#3d5343", fontSize: 7, marginRight: 2 }}>H</span>}{tKO.thirdPlace.home?.name || "TBD"}</span>
                    {tKO.thirdPlace.home && tKO.thirdPlace.away && <button onClick={() => tToggleHA("tp")} style={{ background: "none", border: "none", color: tpHAVal ? (tpHAVal === "off" ? "#bf616a" : "#3d5343") : "#3b4a3b", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: tpHAVal ? 1 : 0.4 }}>H</button>}
                    {tKoEdit && tKoEdit.tp ? <span style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 4px" }}>{tKoEdit.step === "l1" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 1:</span>}{tKoEdit.step === "l2" && <span style={{ color: "#81a1c1", fontSize: 9, whiteSpace: "nowrap" }}>Leg 2 <span style={{color:"#4c5a4c"}}>(L1: {tKoEdit.l1h}–{tKoEdit.l1a})</span></span>}{tKoEdit.step === "et" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>After ET <span style={{color:"#4c5a4c"}}>(FT: {tKoEdit.ftH}–{tKoEdit.ftA})</span></span>}{tKoEdit.step === "pen" && <span style={{ color: "#d08770", fontSize: 9, whiteSpace: "nowrap" }}>Penalties <span style={{color:"#4c5a4c"}}>(ET: {tKoEdit.etH}–{tKoEdit.etA})</span></span>}<input type="number" min={0} value={tKoEdit.h} onChange={e => setTKoEdit(p => ({...p, h: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 3, color: "#c5c8c6", fontFamily: "inherit" }} /><span style={{ color: "#4c5a4c", fontSize: 8 }}>–</span><input type="number" min={0} value={tKoEdit.a} onChange={e => setTKoEdit(p => ({...p, a: e.target.value}))} style={{ width: 34, padding: "2px 3px", fontSize: 11, textAlign: "center", background: "#141a14", border: "1px solid #2a3a2a", borderRadius: 3, color: "#c5c8c6", fontFamily: "inherit" }} /><button onClick={tSetKoManualScore} style={{ background: "#3d5343", border: "none", color: "#d3ebd3", fontSize: 9, cursor: "pointer", padding: "3px 8px", fontFamily: "inherit", borderRadius: 3, letterSpacing: "0.05em" }}>OK</button><button onClick={() => { setTKoEdit(null); setTScoreError(""); }} style={{ background: "none", border: "1px solid #2a3a2a", color: "#bf616a", fontSize: 9, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", borderRadius: 3 }}>✗</button></span>
                      : tKO.thirdPlace.result?.partial ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#81a1c1", fontWeight: 600 }}>{koResultText(tKO.thirdPlace)}</span><button onClick={() => tScorinateKO(-2, -1, 2)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶ L2</button><button onClick={() => tPlayLive({type:"ko",ri:0,mi:0,tp:true,leg:2})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play L2 live">⚽ L2</button></span>
                      : tKO.thirdPlace.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#3d5343", fontWeight: 600 }}>{koResultText(tKO.thirdPlace)}</span><button onClick={() => setTKoEdit({ ri: -2, mi: -1, h: String(tKO.thirdPlace.result.twoLeg ? tKO.thirdPlace.result.leg1.home : tKO.thirdPlace.result.ftHome), a: String(tKO.thirdPlace.result.twoLeg ? tKO.thirdPlace.result.leg1.away : tKO.thirdPlace.result.ftAway), tp: true, ...(tKO.thirdPlace.result.twoLeg ? {twoLeg:true, step:"l1", l2h:String(tKO.thirdPlace.result.leg2.away), l2a:String(tKO.thirdPlace.result.leg2.home)} : {}) })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit", opacity: 0.4 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}>✎</button></span>
                      : tKO.thirdPlace.home && tKO.thirdPlace.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(-2, -1)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri: -2, mi: -1, h: "", a: "", tp: true, ...(tConfig.koLegs===2?{twoLeg:true,step:"l1"}:{}) })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri:0,mi:0,tp:true,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                        : <span style={{ ...mono, fontSize: 10, color: "#333", margin: "0 6px" }}>–</span>}
                    <span style={{ fontSize: 11, color: tKO.thirdPlace.result && koWinner(tKO.thirdPlace) === tKO.thirdPlace.away ? "#d3ebd3" : "#999", flex: 1, textAlign: "right" }}>{tKO.thirdPlace.away?.name || "TBD"}{tpHAVal === "away" && <span style={{ color: "#3d5343", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                  </div>
                </div>
              </div>
            ); })()}
            {/* FINAL — rendered after 3rd place */}
            {!koBracketView && (()=>{ const ri = tKO.rounds.length - 1; const round = tKO.rounds[ri]; if (!round) return null; return (
              <div style={{ background: "#0f1310", border: "1px solid #c9a84c33", borderRadius: 10, padding: 16, boxShadow: "0 2px 10px #00000022", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#c9a84c" }}>{round.name?.toUpperCase()}</div>
                </div>
                {round.matches.map((m, mi) => { const koHAKey = `ko_${ri}_${mi}`; const koHAVal = tHomeAdvOverrides[koHAKey] || null; return (
                  <div key={mi} style={{ background: "#141a14", borderRadius: 4, padding: "8px 10px", border: "1px solid #c9a84c33", marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.home ? "#d3ebd3" : "#999", fontWeight: m.result && koWinner(m) === m.home ? 600 : 400, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{koHAVal === "home" && <span style={{ color: "#3d5343", fontSize: 7, marginRight: 2 }}>H</span>}{m.home?.name || "TBD"}</span>
                      {m.home && m.away && <button onClick={() => tToggleHA(koHAKey)} style={{ background: "none", border: "none", color: koHAVal ? (koHAVal === "off" ? "#bf616a" : "#3d5343") : "#3b4a3b", fontSize: 8, cursor: "pointer", padding: "1px 3px", fontFamily: "inherit", fontWeight: 700, opacity: koHAVal ? 1 : 0.4 }}>H</button>}
                      {m.result ? <span style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 4px" }}><span style={{ ...mono, fontSize: 10, color: "#c9a84c", fontWeight: 600 }}>{koResultText(m)}</span></span>
                        : m.home && m.away ? <span style={{ display: "flex", gap: 3, margin: "0 4px" }}><button onClick={() => tScorinateKO(ri, mi)} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#3d5343", fontSize: 9, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>▶</button><button onClick={() => setTKoEdit({ ri, mi, h: "", a: "", tp: false })} style={{ background: "none", border: "1px solid #2a3a2a", borderRadius: 3, color: "#d08770", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }}>✎</button><button onClick={() => tPlayLive({type:"ko",ri,mi,leg:1})} style={{ background: "none", border: "1px solid #81a1c1", borderRadius: 3, color: "#81a1c1", fontSize: 9, padding: "1px 4px", cursor: "pointer", fontFamily: "inherit" }} title="Play live">⚽</button></span>
                        : <span style={{ ...mono, fontSize: 10, color: "#333", margin: "0 6px" }}>–</span>}
                      <span style={{ fontSize: 11, color: m.result && koWinner(m) === m.away ? "#d3ebd3" : "#999", fontWeight: m.result && koWinner(m) === m.away ? 600 : 400, flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.away?.name || "TBD"}{koHAVal === "away" && <span style={{ color: "#3d5343", fontSize: 7, marginLeft: 2 }}>H</span>}</span>
                    </div>
                  </div>
                ); })}
              </div>
            ); })()}
          </div>)}
        </div>)}

        {/* ═══ DOCS TAB ═══ */}
        {tab === "docs" && (<div style={{ lineHeight: 1.7, fontSize: 12, color: "#b0b8b0" }}>
          {(()=>{
            const H1 = ({children, id}) => <div id={id} style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#c9a84c" }}>{children}</div>;
            const H2 = ({children, id}) => <div id={id} style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#627661", marginTop: 24, marginBottom: 10, ...ui }}>{children}</div>;
            const H3 = ({children, id}) => <div id={id} style={{ fontSize: 13, fontWeight: 600, color: "#d3ebd3", marginTop: 18, marginBottom: 8 }}>{children}</div>;
            const P = ({children}) => <p style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.7, color: "#b0b8b0" }}>{children}</p>;
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
              return <details style={{ marginBottom: 12 }}><summary style={{ fontSize: 10, color: "#627661", cursor: "pointer" }}><span className="dta">▶</span>View modifiers</summary>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "3px 6px", padding: "8px 10px", background: "#0a0f0c", borderRadius: 5, marginTop: 6, border: "1px solid #1a221a" }}>
                {items.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 8px", borderRadius: 3, background: it.neutral ? "transparent" : it.positive ? "#5e9c6b0a" : it.isTempo ? "#d087700a" : "#bf616a0a", borderLeft: it.neutral ? "2px solid transparent" : it.positive ? "2px solid #5e9c6b33" : it.isTempo ? "2px solid #d0877033" : "2px solid #bf616a33" }}>
                  <span style={{ color: "#627661", fontSize: 10 }}>{it.name}</span>
                  <span style={{ ...mono, fontSize: 10, fontWeight: it.neutral ? 400 : 600, color: it.neutral ? "#2a3a2a" : it.positive ? "#5e9c6b" : it.isTempo ? "#d08770" : "#bf616a" }}>{it.value}</span>
                </div>)}
              </div></details>;
            };
            const Mod = ({name, desc}) => <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 600, color: "#d3ebd3" }}>{name}</span> <span style={{ color: "#888" }}>{desc}</span></div>;
            const tocLink = (id, label) => <span key={id} onClick={() => { const el=document.getElementById(id); if(el){const d=el.closest("details");if(d)d.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);} }} style={{ cursor: "pointer", color: "#627661", fontSize: 13, fontWeight: 500 }}>{label}</span>;
            return (<>
            <div style={{ background: "#0a0f0c", border: "1px solid #1a221a", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3b4a3b", marginBottom: 8 }}>Contents</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {tocLink("doc-overview", "Overview")}
                {tocLink("doc-engine", "How Matches Play Out")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  {[["doc-pitch","The Pitch"],["doc-minute","Minute Cycle"],["doc-buildup","Buildup & Long-range"],["doc-shooting","Shooting Zone"],["doc-shots","Shot Resolution"],["doc-counters","Counter-attacks"],["doc-corners","Corners"],["doc-fouls","Fouls, Cards & Offsides"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#4c5a4c", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                </div>
                {tocLink("doc-dynamics", "Match Dynamics")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  {[["doc-tempo","Tempo"],["doc-momentum","Momentum"],["doc-stamina","Stamina & Fatigue"],["doc-subs","Substitutions"],["doc-injuries","Injuries"],["doc-homeadv","Home Advantage"],["doc-stoppage","Stoppage Time"],["doc-extra","Extra Time & Penalties"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#4c5a4c", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                </div>
                {tocLink("doc-modifiers", "Modifiers")}
                {tocLink("doc-skill", "Skill")}
                {tocLink("doc-playstyles", "Playstyles")}
                {tocLink("doc-formations", "Formations")}
                {tocLink("doc-tactics", "Tactics")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  <span style={{ color: "#627661", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, marginTop: 8, marginBottom: 2 }}>IN POSSESSION</span>
                  {[["doc-tac-approach","Approach Play"],["doc-tac-passing","Passing Direction"],["doc-tac-chances","Chance Creation"],["doc-tac-dribbling","Dribbling"],["doc-tac-creativity","Creative Freedom"],["doc-tac-setpieces","Set Pieces"],["doc-tac-timewasting","Time Wasting"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#4c5a4c", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                  <span style={{ color: "#627661", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, marginTop: 10, marginBottom: 2 }}>TRANSITION</span>
                  {[["doc-tac-posslost","On Possession Lost"],["doc-tac-posswon","On Possession Won"],["doc-tac-gkdist","GK Distribution"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#4c5a4c", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                  <span style={{ color: "#627661", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, marginTop: 10, marginBottom: 2 }}>DEFENSE</span>
                  {[["doc-tac-pressing","Pressing LOE"],["doc-tac-defline","Defensive Line"],["doc-tac-dlbehavior","DL Behavior"],["doc-tac-tackling","Tackling"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#4c5a4c", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
                </div>
                {tocLink("doc-tournaments", "Tournaments")}
                <div style={{ display: "flex", gap: 0, flexDirection: "column", paddingLeft: 12 }}>
                  {[["doc-tourney-modes","Modes"],["doc-tourney-zones","Qualification Zones"],["doc-tourney-tiebreakers","Tiebreakers"],["doc-tourney-presets","Presets"]].map(([id,l]) => <span key={id} onClick={() => (()=>{const el=document.getElementById(id);if(el){const d=el.closest("details");if(d)d.open=true;const p=d?.parentElement?.closest("details");if(p)p.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),10);}})()} style={{ cursor: "pointer", color: "#4c5a4c", fontSize: 12, lineHeight: 2.0 }}>{l}</span>)}
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
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Play Out</strong> — The team builds from the back with short passes, retaining the ball in deeper areas. Improves hold because the team recycles possession rather than forcing it forward. Advance drops slightly because the team waits for gaps rather than pushing into them. Lower stamina cost. Best paired with possession-heavy playstyles that want extended spells of control. Weak when the team needs to progress the ball urgently.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Into Space</strong> — The team plays direct passes into space behind the opponent's defensive line. Advance increases because the team pushes forward more aggressively. Hold drops because the team prioritizes progression over retention. Higher stamina cost. Best paired with systems that want to attack quickly and exploit space. Weak against deep-sitting opponents who leave no space behind.</P>
            <Stat text="Play Out: advance -0.01, hold +0.02 · Into Space: advance +0.02, hold -0.02" />

            <H3 id="doc-tac-passing">Passing Direction</H3>
            <P>Five levels from Much Shorter to Much More Direct. Each level increases advance and long ball probability while decreasing hold. More direct passing gets the ball forward faster but loses it more often. Shorter passing keeps the ball but progresses slowly. Extreme values in either direction drain stamina faster. Much More Direct paired with a high line and counter-press is intense and exhausting. Much Shorter paired with Tiki-Taka is almost impossible to dispossess but equally hard to score with.</P>
            <Stat text="Per level: advance +0.015, hold -0.02, long ball +0.015" />

            <H3 id="doc-tac-chances">Chance Creation</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Work Ball In</strong> — The team passes around the edge of the box looking for a clear opening rather than shooting early. Box shot probability increases because the team creates better chances through patience. Long-range shots are suppressed because the system discourages speculative efforts. Retains possession in the box more often. Best when dominating territory and wanting to convert pressure into goals. Weak when time is short.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Shoot On Sight</strong> — Players take shots from any position, including long range. Long-range shot rate increases significantly, but goal conversion per shot drops because more speculative attempts dilute quality. Good for generating volume when precision is not available. Weak against teams that clear well from distance.</P>
            <Stat text="Work Ball In: box shot +0.03, long-range -0.04, box retention +4% · Shoot On Sight: goal prob -0.01, long-range +0.04" />

            <H3 id="doc-tac-dribbling">Dribbling</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Disciplined</strong> — Players avoid taking on defenders, passing early instead of running. Advance drops marginally. The opponent's foul rate decreases because fewer tackles are attempted. Lower stamina cost. Safer and more controlled but less direct.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Run At Defence</strong> — Players dribble at defenders, drawing fouls and creating chaos. Advance increases. The opponent's foul rate rises significantly, generating more free kicks in dangerous areas and more penalties. Higher stamina cost. Best for teams that want to win set pieces and put pressure on booked defenders. The risk is that aggressive dribbling can lose the ball in dangerous positions.</P>
            <Stat text="Disciplined: advance -0.01, foul rate 0.9x · Run At Defence: advance +0.02, foul rate 1.25x" />

            <H3 id="doc-tac-creativity">Creative Freedom</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Disciplined</strong> — Players stick to the system. Goal conversion drops marginally because predictable patterns are easier to defend. Safer and more consistent.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Expressive</strong> — Players improvise. Goal conversion rises because unexpected movements create better chances. Additionally, there is a 4% chance per minute of a "moment of magic" where a player beats the system entirely and skips straight to a shooting opportunity. The risk is inconsistency and higher stamina cost.</P>
            <Stat text="Disciplined: goal prob -0.005 · Expressive: goal prob +0.01, 4% skip-to-shot chance" />

            <H3 id="doc-tac-setpieces">Set Pieces</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Play For</strong> — The team deliberately plays for corner kicks by putting crosses in and challenging the keeper. Corner multiplier increases by 1.2x. No other effects. A simple, low-cost choice for teams that want more set-piece opportunities.</P>
            <Stat text="Play For: corners 1.2x" />

            <H3 id="doc-tac-timewasting">Time Wasting</H3>
            <P>Only active when leading. The team slows the game down through delayed restarts and ball retention in non-threatening areas. Dead minutes consume game time without progressing play, and the additional stoppage time added is less than the minutes consumed. Reduces stamina drain because the team is not exerting itself. Constantly time-wasting risks yellow cards (2.5% per dead minute). Useful for closing out matches.</P>
            <Stat text="Sometimes: 25% dead minute chance, +15s stoppage · Constantly: 45% dead minute chance, +25s stoppage, 2.5% card risk" />

            <H2>Transition</H2>

            <H3 id="doc-tac-posslost">On Possession Lost</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Regroup</strong> — The team drops back into defensive shape after losing the ball. Press effectiveness drops because players retreat rather than challenging. Defensive solidity improves marginally. Low stamina cost. Best for teams that cannot afford to be caught out of position. Weak against teams that are slow to transition, since regrouping concedes territory that could have been recovered.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Counter-Press</strong> — The team immediately presses to win the ball back after losing it. Press effectiveness jumps by 1.2x, applied on top of all other pressing modifiers. High stamina cost (+0.10/min, the single most expensive individual tactic). Best for high-intensity systems that want to keep the opponent under constant pressure. Dangerous in the last 20 minutes because the stamina drain can leave the team exhausted.</P>
            <Stat text="Regroup: press 0.85x, defense +0.02 · Counter-Press: press 1.2x" />

            <H3 id="doc-tac-posswon">On Possession Won</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Hold Shape</strong> — The team keeps its defensive shape after winning the ball, building slowly. Hold increases because the team does not rush forward. Counter-attack probability is halved because the system suppresses fast transitions. Best for teams that want to control games and avoid being caught on a failed counter. Weak when the opponent is out of position and a fast break would be more effective.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Counter</strong> — The team launches forward immediately after winning the ball. Counter multiplier jumps by 1.4x, and counter shot probability gets a significant bonus. Hold drops because the team prioritizes speed over retention. Best for teams with a high counter multiplier already (the bonuses stack multiplicatively with the Counter playstyle). Weak when the team wins the ball in its own half and does not have the legs to cover the distance.</P>
            <Stat text="Hold Shape: hold +0.03, counter 0.5x · Counter: hold -0.02, counter 1.4x, counter shot +0.04" />

            <H3 id="doc-tac-gkdist">GK Distribution</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Short</strong> — After saves and goal kicks, the ball goes to the defending team's own half. The team retains possession but starts deep. Best for possession-oriented teams that build from the back.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Long</strong> — The keeper launches it. The attacking team has a 60% chance of retaining possession in midfield; 40% the ball goes to the defending team's half. Gives up possession control for territorial gain. Best for direct teams that want to skip the buildup phase.</P>
            <Stat text="Short: ball to own half · Long: 60% retain in midfield, 40% to defending half" />

            <H2>Defense</H2>

            <H3 id="doc-tac-pressing">Pressing Line of Engagement</H3>
            <P>Five levels from Much Lower to Much Higher. The press multiplier scales from 0.5x to 1.5x. This stacks multiplicatively with playstyle and formation press modifiers: a Gegenpress team at Much Higher presses at 1.5 x 1.5 = 2.25x. Higher pressing wins the ball back more often and higher up the pitch, but drains stamina proportionally and leaves space behind when beaten. Lower pressing concedes territory but conserves energy and maintains defensive shape.</P>
            <Stat text="Much Lower: 0.5x · Lower: 0.7x · Standard: 1.0x · Higher: 1.3x · Much Higher: 1.5x" />

            <H3 id="doc-tac-defline">Defensive Line</H3>
            <P>Five levels from Much Lower to Much Higher. Each level shifts the defense modifier by -0.015 (higher lines are less solid in the box) and increases the base offside rate by 20% (higher lines catch more attackers offside). A high line compresses the pitch, which supports pressing and forces offsides, but leaves space behind for through balls and long passes. A low line is harder to beat in the box but concedes territory and lets the opponent play in front of it.</P>
            <Stat text="Per level: defense -0.015, offside rate +20%" />

            <H3 id="doc-tac-dlbehavior">Defensive Line Behavior</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Drop Off</strong> — The defensive line retreats when the ball approaches. Defense improves marginally because the backline is deeper and harder to beat. Concedes territory. Low stamina cost.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Step Up</strong> — The defensive line holds its ground or pushes forward. Offside rate increases by 15%. More aggressive than Drop Off but less risky than the full trap.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Offside Trap</strong> — The defensive line pushes up sharply when the ball is played forward, attempting to catch attackers offside. Offside rate increases by 40%, which is significant. The risk: 15% of triggered offsides are beaten through, producing a 1v1 with a 1.25x attacker skill boost. When it works, it kills attacks dead. When it fails, it creates the best scoring opportunity in the game.</P>
            <Stat text="Drop Off: defense +0.015 · Step Up: offside rate +15% · Offside Trap: offside rate +40%, 15% beaten-through risk (1.25x skill boost)" />

            <H3 id="doc-tac-tackling">Tackling</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Stay On Feet</strong> — Players jockey rather than diving in. Press effectiveness drops marginally. Foul rate drops significantly, and card chance drops even more. Best for teams with booked players or teams that cannot afford to give away free kicks in dangerous areas. The cost is that the opponent retains the ball more easily.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Get Stuck In</strong> — Players commit to tackles aggressively. Press effectiveness increases. Foul rate rises substantially, and card chance rises even more. Generates more turnovers but also more fouls, more cards, and more penalties. Best for teams that need to disrupt the opponent's rhythm and are willing to risk the disciplinary consequences.</P>
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
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Single Stage</strong> runs one phase only. Choose Knockout Only (single-elimination bracket) or Groups Only (round-robin or Swiss league). Groups Only with one group functions as a league. Groups Only is also used for Monte Carlo simulations where you want to run many group stages without a knockout.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Double Stage</strong> runs groups followed by a knockout. Teams qualifying from groups advance to a bracket. The number of qualifiers is determined by qualification zones (or by the Qualify Per Group fallback if no advance zones are set). Group format can be round-robin or Swiss. Knockout can be seeded, random, drawn, or manually allocated.</P>
            <P>Groups use a round-robin fixture generator that handles odd team counts with byes (awarded as 3-0 wins). Swiss format pairs teams by score group each round, prioritizing teams with fewer games played and allowing rematches when all opponents are exhausted.</P>

            <H3 id="doc-tourney-zones">Qualification Zones</H3>
            <P>Zones mark positions in the standings table with colored strips and control advancement to the knockout stage. Each zone has an anchor (Top or Bottom), a position range (e.g., 1 to 2), a label, a color, and a type.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Cosmetic</strong> zones are visual only. Use them for labels like Champion or Relegation in league formats where there is no knockout stage.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Direct Qualification</strong> zones advance all teams in those positions from every group. Top 2 in an 8-group tournament with Direct Qualification produces 16 teams for the knockout.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Pool Qualification</strong> zones collect teams from those positions across all groups into a single ranked pool table (sorted by points, then goal difference, goals for, and skill). A configurable number of the best-performing teams qualify. This is how the 2026 World Cup handles third-placed teams: 12 groups produce 12 third-placed teams, the best 8 advance.</P>
            <P>The pool ranking table updates live during the group stage as results come in. Zones are evaluated top-to-bottom in the editor, so if two zones overlap, the first one takes priority. Zones integrate with the knockout bracket builder and handle byes automatically for non-power-of-2 team counts.</P>

            <H3 id="doc-tourney-tiebreakers">Tiebreakers</H3>
            <P>When two teams have equal points, the tiebreaker priority determines their order. The priority is configurable and the order matters. Points are always checked first; skill is always the final fallback.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Goal Difference</strong> compares total goals scored minus goals conceded.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Goals For</strong> rewards attacking teams. A team with 15 scored and 10 conceded ranks above one with 8 scored and 3 conceded despite the latter having a better goal difference.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Head-to-Head</strong> extracts the results between the two tied teams specifically: their H2H points, then H2H goal difference, then H2H goals for. This is the primary tiebreaker in UEFA competitions.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Wins</strong> counts total wins regardless of goal difference. Some South American leagues prioritize this.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Median-Buchholz</strong> (Swiss only) sums each team's opponents' final points, removes the highest and lowest, and compares. Rewards teams that faced stronger opposition. Standard in chess-style Swiss systems.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Manual</strong> (Double Stage only) stops automated tiebreaking at its position in the priority list. When two teams are tied at a qualification zone boundary after all criteria above Manual are exhausted, a swap button appears in the standings table. The user resolves the tie by swapping team positions. Advancement to the knockout stage is blocked until all zone-boundary ties are resolved.</P>

            <H3 id="doc-tourney-presets">Presets</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>League</strong> — Single stage, 1 group, double round-robin, first-listed home advantage. Champion (gold, cosmetic) and Relegation (red, cosmetic) zones. Tiebreakers: GD, GF, H2H, Wins.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Old World Cup</strong> — Double stage, 8 groups of 4, single round-robin, pot-based draw. Top 2 advance (direct). 16-team seeded knockout with third-place match.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>New World Cup</strong> — Double stage, 12 groups of 4, single round-robin, pot-based draw. Top 2 advance (direct) plus best 8 third-placed teams (pool). 32-team seeded knockout with third-place match.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Old UCL</strong> — Double stage, 8 groups of 4, double round-robin, pot-based draw. Top 2 advance (direct). 16-team seeded knockout, two-legged ties with away goals.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>New UCL</strong> — Double stage, 1 group of 36, Swiss format (8 rounds). Top 8 advance directly, 9th to 24th advance to playoff round. Seeded knockout, two-legged ties, no away goals. Tiebreakers: GD, GF, Buchholz, H2H, Wins.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Cup</strong> — Single stage knockout. Seeded bracket, single-leg, weaker team gets home advantage.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-modifiers"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Modifiers</H1></summary>
            <P>Playstyles, formations, and tactics all modify the same set of parameters. Additive parameters sum, multiplicative parameters multiply. Tactics apply on top of the combined playstyle + formation values.</P>
            <div style={{ background: "#0a0f0c", borderRadius: 8, border: "1px solid #1a221a", overflow: "hidden", marginBottom: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead><tr style={{ borderBottom: "1px solid #1a221a" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "#627661", fontWeight: 600, fontSize: 9, letterSpacing: "0.1em" }}>PARAMETER</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", color: "#627661", fontWeight: 600, fontSize: 9, letterSpacing: "0.1em", width: 50 }}>TYPE</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "#627661", fontWeight: 600, fontSize: 9, letterSpacing: "0.1em" }}>EFFECT</th>
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
                    <td style={{ padding: "7px 12px", color: "#d3ebd3", fontWeight: 600, fontSize: 11 }}>{name}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center" }}><span style={{ display: "inline-block", width: 22, height: 18, lineHeight: "18px", borderRadius: 3, fontSize: 10, fontWeight: 700, textAlign: "center", background: type === "×" ? "#3d534322" : type === "+" ? "#4a7ab522" : "#d0877022", color: type === "×" ? "#5e9c6b" : type === "+" ? "#4a7ab5" : "#d08770", border: "1px solid " + (type === "×" ? "#5e9c6b33" : type === "+" ? "#4a7ab533" : "#d0877033") }}>{type}</span></td>
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
            <div style={{ fontSize: 10, color: "#888", padding: "6px 12px", background: "#0a0f0c", borderRadius: 4, marginBottom: 10, lineHeight: 1.8, ...mono }}>Code (optional, 3 letters) · Name · Skill · Playstyle · Formation · Approach · Passing · Chances · Dribbling · Creativity · Set Pieces · Time Wasting · Pos. Lost · Pos. Won · GK Dist · Pressing · Def. Line · DL Behavior · Tackling</div>
            <P>Only Name is required. Skill defaults to 50, playstyle to Balanced, formation to 4-3-3, all tactics to No Instruction. Tactic values accept label text from the UI (e.g., "Into Space", "Much Shorter", "Get Stuck In"). Player names can end with [+] (above-average) or [*] (star) to set their tier — this affects selection weight, conversion rate, GK saves, and defensive impact.</P>

            </details>

            <details style={{ marginTop: 16, marginBottom: 8, borderBottom: "none" }} id="doc-tournaments"><summary style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:6 }}><span className="dta">▶</span><H1>Tournaments</H1></summary>

            <H3 id="doc-tourney-modes">Modes</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Single Stage</strong> runs one phase only. Choose Knockout Only (single-elimination bracket) or Groups Only (round-robin or Swiss league). Groups Only with one group functions as a league.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Double Stage</strong> runs groups followed by a knockout. Teams qualifying from groups advance to a bracket. The number of qualifiers is determined by qualification zones. Group format can be round-robin or Swiss. Knockout can be seeded, random, drawn, or manually allocated.</P>
            <P>Groups use a round-robin fixture generator that handles odd team counts with byes (awarded as 3-0 wins). Swiss format pairs teams by score group each round, prioritizing teams with fewer games played and allowing rematches when all opponents are exhausted.</P>

            <H3 id="doc-tourney-zones">Qualification Zones</H3>
            <P>Zones mark positions in the standings table with colored strips and control advancement to the knockout stage. Each zone has an anchor (Top or Bottom), a position range, a label, a color, and a type.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Cosmetic</strong> zones are visual only. Use them for labels like Champion or Relegation in league formats.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Direct Qualification</strong> zones advance all teams in those positions from every group. Top 2 in an 8-group tournament produces 16 teams for the knockout.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Pool Qualification</strong> zones collect teams from those positions across all groups into a ranked pool table (sorted by points, goal difference, goals for, skill). A configurable number of the best-performing teams qualify. The pool ranking updates live during the group stage.</P>

            <H3 id="doc-tourney-tiebreakers">Tiebreakers</H3>
            <P>When two teams have equal points, the configurable tiebreaker priority determines their order. Points are always first; skill is always the final fallback.</P>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>Goal Difference</strong> — total goals scored minus conceded. <strong style={{color:"#d3ebd3",fontSize:10}}>Goals For</strong> — rewards attacking play. <strong style={{color:"#d3ebd3",fontSize:10}}>Head-to-Head</strong> — results between the two tied teams (pts, GD, GF). <strong style={{color:"#d3ebd3",fontSize:10}}>Wins</strong> — total wins. <strong style={{color:"#d3ebd3",fontSize:10}}>Median-Buchholz</strong> (Swiss only) — opponents' points minus best and worst. <strong style={{color:"#d3ebd3",fontSize:10}}>Manual</strong> (Double Stage only) — stops automated tiebreaking; swap buttons appear on tied teams at zone boundaries.</P>

            <H3 id="doc-tourney-presets">Presets</H3>
            <P><strong style={{color:"#d3ebd3",fontSize:10}}>League</strong> — 1 group, double round-robin, home and away, champion + relegation zones. <strong style={{color:"#d3ebd3",fontSize:10}}>Old World Cup</strong> — 8 groups of 4, top 2 advance, 16-team knockout. <strong style={{color:"#d3ebd3",fontSize:10}}>New World Cup</strong> — 12 groups of 4, top 2 advance + best 8 thirds, 32-team knockout. <strong style={{color:"#d3ebd3",fontSize:10}}>Old UCL</strong> — 8 groups of 4, double round-robin, two-legged knockout. <strong style={{color:"#d3ebd3",fontSize:10}}>New UCL</strong> — 36-team Swiss, top 8 advance + 9th-24th playoff, Median-Buchholz tiebreaker. <strong style={{color:"#d3ebd3",fontSize:10}}>Cup</strong> — single-elimination bracket.</P>

            </details>
            </>);
          })()}
        </div>)}

      </div>
    </div>
  );
}
