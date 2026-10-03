// Player attributes, derived from one absolute OVR.
import { CFG, DEFAULT_OVR } from "./config";

// One OVR is all the data there is, and it stays the absolute currency -- these are tilts around it,
// never a rescale. A 70 is a 70 wherever he stands; his position decides what he is a 70 AT. atkW is
// the same attacking weight the rest of the app already carries, so nothing new has to be authored.
// TOUCH is first touch and close control, split off `pass` so that a position can be worse at one
// than the other. On `pass` a 90-rated forward controlled the ball like a 73-rated midfielder, which
// made every striker's first touch a coin toss. Midfielders stay the best technicians; a forward is
// a few points behind the midfielder of the same rating, a defender a little further, and a keeper's
// feet are a keeper's feet.
export const ME_TILT = {
  GK:  { pace:-16, pass:-8, shoot:-34, tackle:-22, position:  6, strength: 2, reflex: 18, touch:-10 },
  DEF: { pace: -2, pass:-5, shoot:-10, tackle: 11, position:  6, strength: 7, reflex:-34, touch:  2 },
  MID: { pace:  0, pass: 7, shoot: -1, tackle:  1, position:  2, strength: 0, reflex:-34, touch:  7 },
  FWD: { pace:  5, pass:-3, shoot:  4, tackle:-11, position: -2, strength: 3, reflex:-34, touch:  4 },
};

// atkW is NOT a 0..1 weight -- it runs 0 for a keeper to about 42 for a striker. Treating it as a
// fraction pinned every forward at shoot 99 / tackle 20 whatever his rating, and gave strikers a
// 13x shot appetite, which is where the thirty-metre shots were coming from.
export const meAtkW = (p) => Math.min(1, Math.max(0, (p.atkW ?? 0) / 40));

// How much of a rating difference reaches the pitch. A positional engine chains a few hundred duels,
// so the per-duel edge is deliberately damped rather than passed through whole -- the same job the
// old engine's ovrVs caps did, done once at the source instead of at every call site.
//
// It sat at 0.40 on the strength of "at 1.0 a 29-point gap produced a nine-goal difference", which
// does not reproduce: that was measured while a third of every match was frozen solid. Re-measured
// on a working engine, and with `tackle`, `position` and pace finally reaching the pitch, a 30-point
// gap wins 76% of its matches at 0.40 and 92% at 0.80. 0.60 is where the ladder lands on what a
// football sim should produce -- 76% at a 20-point gap, 86% at 30 -- with every tie played both
// ways round so the side that kicks off is not read as the better team. See test/compress.mjs.
export const ME_COMPRESS = 0.60, ME_OVR_MID = 70;

export const meOvr = (p) => ME_OVR_MID + ((p.ovr ?? DEFAULT_OVR) - ME_OVR_MID) * ME_COMPRESS;

export function meAttrs(p) {
  if (p._att) return p._att;
  const t = ME_TILT[p.pos] || ME_TILT.MID, o = meOvr(p), aw = meAtkW(p) - 0.45;
  const c = (v) => Math.max(20, Math.min(99, v));
  return (p._att = { pace: c(o + t.pace), pass: c(o + t.pass), shoot: c(o + t.shoot + aw * CFG.shootAtkW), shootRaw: o + t.shoot + aw * CFG.shootAtkW, reflexRaw: o + t.reflex,
    tackle: c(o + t.tackle - aw * 12), position: c(o + t.position), strength: c(o + t.strength),
    reflex: c(o + t.reflex), touch: c(o + t.touch) });
}

// Top speed in m/s. Stamina is applied here rather than baked into the attribute so that a tiring
// side loses its shape and its press in the same breath, which is what fatigue actually looks like.
//
// The SPAN is the whole of what pace is worth, and at 2.0 m/s it was worth almost nothing: across
// the entire 0..99 scale, and then squeezed again by ME_COMPRESS, the fastest man alive finished
// about 6% quicker than the slowest. In a positional engine where nearly everything is settled by
// who reaches the ball first, that one number is most of why ratings did not reach the pitch.
// Widened to 3.6, which is nearer the real spread, with the midpoint pinned: a 70 still runs at the
// 7.31 m/s everything else in here was calibrated against, and only the spread around him changes.
export const SPEED_BASE = 4.77, SPEED_SPAN = 3.6;   // pace 20 -> 5.5 m/s, pace 70 -> 7.31, pace 99 -> 8.37
export const meSpeed = (a, stam) => (SPEED_BASE + a.pace / 99 * SPEED_SPAN) * (0.80 + 0.20 * Math.max(0, Math.min(100, stam ?? 100)) / 100);

// THE KEEPER, as two physical numbers. One OVR, tilted into reflex, mapped onto the range real
// goalkeeping spans: about 280 ms of reaction and a 2.8 m/s dive at the bottom of the band, 200 ms
// and 3.8 m/s at the top (CFG.gkReactSlow/Fast, gkDiveVmin/max). The 0..1 is taken over the reflex
// band a keeper can actually HAVE, not over 0..99 -- ME_COMPRESS deliberately squeezes ratings, so a 40-rated and a 90-rated keeper come out at 76 and
// 96 reflex, and normalising over the full scale would have made them all but identical.
// ...carried past 1 off the unclamped reflex, so a keeper keeps improving to 90 (CFG.gkSkillMax) rather
// than topping out at 87.
export const meGkSkill = (a) => Math.max(0, Math.min(CFG.gkSkillMax, ((a.reflexRaw ?? a.reflex) - 70) / 28));
// ...AND UNDER THE BAND, A PART-TIMER. The band above is sized for league keepers, and clamped at zero it
// made every keeper under 40 the same man as a 40, and a 40 very nearly a 60: against the best attack in
// the world an island side's 37 kept out 69% of what was put on target, an 85 79%. meGkLow is how far he
// sits under gkLowAt reflex, over gkLowSpan -- nothing for a keeper of 60 or better, all of it for a 35 --
// and it is charged on top of the band: later off the mark, slower across, less reach, softer hands, and
// a worse idea of where to stand.
export const meGkLow = (a) => Math.max(0, Math.min(1, (CFG.gkLowAt - a.reflex) / CFG.gkLowSpan));
export const meGkReact = (a) => CFG.gkReactSlow + (CFG.gkReactFast - CFG.gkReactSlow) * meGkSkill(a) + meGkLow(a) * CFG.gkReactLow;
export const meGkDiveV = (a) => CFG.gkDiveVmin + (CFG.gkDiveVmax - CFG.gkDiveVmin) * meGkSkill(a) - meGkLow(a) * CFG.gkDiveLow;

// HOW WELL HE READS HIS OWN OPTIONS. Rating drove execution -- how accurately he struck the pass he
// chose -- and never the choosing. Every one of the twenty-two scored the same menu with the same
// precision and took the same best option, so a 45 executed badly and CHOSE like a world-class
// player. That is also why the finish and the keeper could both be fixed without conversion moving:
// with all 22 picking optimally the engine manufactures the chance quality of a perfect game, and
// the shot was going in because it was a good chance, not because it was well struck.
// Taken over the rating band a footballer occupies, like meGkSkill, because ME_COMPRESS deliberately
// squeezes the scale and normalising over 0..99 would make everyone identical.
export const meMind = (p) => Math.max(0, Math.min(1, (meOvr(p) - 58) / 26));

// HOW HIGH HE CAN GET TO IT. There is no height attribute and no jump attribute, and adding an
// eighth would mean authoring it for every player in the league -- strength is already "how big and
// strong is he", which is what wins a ball in the air, so it does that job here too.
// A ball above this is over him and he cannot touch it at all, which until now was true of EVERY
// player at a flat 1.6 m: the ball simply passed through all twenty-two. That one line is why
// crossing produced half a chance a side, why a corner was a loose ball rather than a threat, and
// why the whole aerial half of football did not exist.
export const meAerial = (a, CFG) => CFG.headBase + a.strength / 99 * CFG.headSpan;

// TECHNIQUE, over the band a footballer can actually occupy. Every execution term used to read
// attr/99 -- but ME_COMPRESS squeezes forty OVR points into thirty attribute points, so across the
// whole rating scale pass noise moved 1.4 degrees and completion was measured FLAT across bands
// (76-81%) while real football spans about 70-85. Same trick as meGkSkill and meMind: normalise
// over the occupied band, anchored so a 75-rated player (pass attr 80 -> 0.80) keeps the exact
// execution everything was calibrated against, and only the spread around him widens.
// EXECUTION ONLY -- kick noise, first touch, close control, reach. Never the utility scores: what
// an option is WORTH does not depend on who is weighing it, judgement already has its own term
// (meMind), and set-piece strikes deliberately stay on attr/99 because a dead ball is the great
// equaliser: penalty conversion barely varies by level in the real game, and ours is calibrated.
// ...and NOT CAPPED AT 1. The band tops out at an attribute of 88, which a position's tilt reached long
// before 90: a defender's tackling at 76, a midfielder's passing at 88, so every defender from 76 up
// tackled alike. Below 88 nothing moves; above it the scale carries on to CFG.techMax, which is where a
// 90 lands. Every site reading it either scales with it or takes max(0, 1 - tech).
export const meTech = (attr) => Math.max(0, Math.min(CFG.techMax, (attr - 48) / 40));

// ...AND UNDER LEAGUE ONE'S AVERAGE MAN, DEFENDING COSTS MORE. Every defensive act ran on the same band
// as the attacking ones, and the attack chains several of them (the pass, the touch, the take-on, the
// finish) where the defence gets one, so quality told far more going forward: seven points on every
// attacker added 14% to the chances a side made and 0.75 goals a match, seven on every defender took 4%
// off the chances conceded and no goals. A league weaker all round therefore scored less -- League Two
// 2.42 a match to League One's 2.92 -- where real second tiers sit only a little under their top
// flights. Each point a man is rated under defLowAt comes off the skill he DEFENDS with: the tackle,
// reading a pass to cut it out, the reach for a carried ball, not biting on the dummy. At or above it,
// nothing changes. It stops counting defLowCap points down, because the leagues and nations far under
// League One would otherwise lose the tackle altogether: a 58 pays what a 68 does, and his band already
// makes him the worse defender of the two.
export const meDefLow = (p) => Math.min(CFG.defLowCap, Math.max(0, CFG.defLowAt - (p?.ovr ?? DEFAULT_OVR))) * CFG.defLowK;

// THE FINISH, which does not stop at the top of meTech's band. A striker's tilt and attacking weight put
// his shooting twenty points over his rating, so every forward from about 70 up sat at meTech's 1 and an
// 88 finished exactly like a 75 (measured, shot for shot, in the shot lab). Same scale below the band,
// carried on past it off the unclamped attribute, to CFG.finMax for the best finisher alive.
// Past the band it climbs at finAbove a point, not the band's 1/40: the strike is steep in it (pace, aim,
// both errors), and at the band's own slope a 90 scored 61% from twenty metres unpressured.
export const meFinish = (a) => { const r = a.shootRaw ?? a.shoot;
  return r <= 88 ? Math.max(0, (r - 48) / 40) : Math.min(CFG.finMax, 1 + (r - 88) * CFG.finAbove); };

// A duel: skill difference in attribute points to a probability, bounded at both ends. The endpoints
// are the whole design -- they say what the worst and best player in the world achieve at this, and
// nothing outside that band can happen however lopsided the ratings.
export const meDuel = (diff, lo, hi, k) => lo + (hi - lo) / (1 + Math.exp(-diff / k));
