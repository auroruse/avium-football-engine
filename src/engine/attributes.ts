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
// so the per-duel edge is raised to a large power -- at 1.0 a 29-point gap produced a nine-goal
// difference. This is the same job the old engine's ovrVs caps did, done once at the source instead
// of at every call site.
export const ME_COMPRESS = 0.40, ME_OVR_MID = 70;

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
export const meSpeed = (a, stam) => (5.9 + a.pace / 99 * 2.0) * (0.80 + 0.20 * Math.max(0, Math.min(100, stam ?? 100)) / 100);

// A duel: skill difference in attribute points to a probability, bounded at both ends. The endpoints
// are the whole design -- they say what the worst and best player in the world achieve at this, and
// nothing outside that band can happen however lopsided the ratings.
export const meDuel = (diff, lo, hi, k) => lo + (hi - lo) / (1 + Math.exp(-diff / k));
