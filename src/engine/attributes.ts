// Player attributes, derived from one absolute OVR.
import { DEFAULT_OVR } from "./config";

// One OVR is all the data there is, and it stays the absolute currency -- these are tilts around it,
// never a rescale. A 70 is a 70 wherever he stands; his position decides what he is a 70 AT. atkW is
// the same attacking weight the rest of the app already carries, so nothing new has to be authored.
export const ME_TILT = {
  GK:  { pace:-16, pass:-8, shoot:-34, tackle:-22, position:  6, strength: 2, reflex: 18 },
  DEF: { pace: -2, pass:-5, shoot:-16, tackle: 11, position:  6, strength: 7, reflex:-34 },
  MID: { pace:  0, pass: 7, shoot: -3, tackle:  1, position:  2, strength: 0, reflex:-34 },
  FWD: { pace:  5, pass:-3, shoot: 11, tackle:-11, position: -2, strength: 3, reflex:-34 },
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
  return (p._att = { pace: c(o + t.pace), pass: c(o + t.pass), shoot: c(o + t.shoot + aw * 16),
    tackle: c(o + t.tackle - aw * 12), position: c(o + t.position), strength: c(o + t.strength),
    reflex: c(o + t.reflex) });
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
// goalkeeping spans: about 260 ms of reaction and a 1.8 m dive at the bottom, 180 ms and 3.0 m at
// the top. The 0..1 is taken over the reflex band a keeper can actually HAVE, not over 0..99 --
// ME_COMPRESS deliberately squeezes ratings, so a 40-rated and a 90-rated keeper come out at 76 and
// 96 reflex, and normalising over the full scale would have made them all but identical.
export const meGkSkill = (a) => Math.max(0, Math.min(1, (a.reflex - 70) / 28));

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

// A duel: skill difference in attribute points to a probability, bounded at both ends. The endpoints
// are the whole design -- they say what the worst and best player in the world achieve at this, and
// nothing outside that band can happen however lopsided the ratings.
export const meDuel = (diff, lo, hi, k) => lo + (hi - lo) / (1 + Math.exp(-diff / k));
