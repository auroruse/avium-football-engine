// RATINGS ROLLED TO A TEAM RATING (Moukden and Kirin, 11 October 2026). A club's rating is the average of its sixteen.
// The new men whose ratings were left blank, or rolled before, are drawn the way the clubs on file sit: starters about
// 1.3 over the club's rating with a spread of 2.3 (measured over the 234 clubs with sixteen rated men, 11 October 2026),
// and each bench man below the starter at his position, the nearest position where nobody plays his. They then move a
// point at a time until the sixteen average the target. A rating someone typed, and a man already on file, stays.
import { posFitCost } from "./positions.js";

// squad: sixteen places, each empty, a record ID (a man on file) or a new man { pos, ovr, auto }.
// labels: each place's position. ovrOf: a man on file's rating. Returns the squad with the rolled men rated, each
// marked auto, so the next roll knows they are its own.
export function rollSquad(squad, labels, target, ovrOf, rnd = Math.random) {
  const isNew = (v) => !!v && typeof v === "object";
  const n = squad.filter(Boolean).length, XI = Math.min(11, squad.length);
  const free = squad.map(v => isNew(v) && (!(+v.ovr > 0) || !!v.auto));
  const val = squad.map((v, i) => (!v || free[i] ? null : isNew(v) ? +v.ovr : ovrOf(v) ?? null));
  const gauss = () => { let u = 0, w = 0; while (!u) u = rnd(); while (!w) w = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); };
  const clamp = (x) => Math.max(25, Math.min(99, x));
  const posOf = (i) => (isNew(squad[i]) && squad[i].pos) || labels[i];
  // The starters a bench man backs up: those at his position, else those at the nearest one.
  const over = (pos) => { let best = Infinity, at = [];
    for (let k = 0; k < XI; k++) { if (!squad[k]) continue; const c = posFitCost(pos, labels[k]);
      if (c < best) { best = c; at = [k]; } else if (c === best) at.push(k); }
    return at; };
  const backs = squad.map((v, i) => (i >= XI && v ? over(posOf(i)) : []));
  const cap = (i) => Math.min(...backs[i].map(k => val[k] ?? 99));
  for (let k = 0; k < XI; k++) if (free[k]) val[k] = clamp(Math.round(target + 1.3 + gauss() * 2.3));
  // A rolled starter is never below a typed bench man he stands in front of.
  for (let i = XI; i < squad.length; i++) if (squad[i] && !free[i] && val[i] != null)
    for (const k of backs[i]) if (free[k] && val[k] <= val[i]) val[k] = clamp(val[i] + 1 + Math.round(Math.abs(gauss()) * 2));
  for (let i = XI; i < squad.length; i++)
    if (free[i]) val[i] = clamp((backs[i].length ? cap(i) : Math.round(target)) - 1 - Math.round(Math.abs(gauss()) * 3));
  // The dice answers for its own men: a rolled bench man stays below every starter he backs up, and a rolled starter
  // above any bench man behind him. Two typed men out of order are not the dice's to fix.
  const ok = () => { for (let i = XI; i < squad.length; i++) {
      if (!squad[i] || val[i] == null) continue;
      const ks = free[i] ? backs[i] : backs[i].filter(k => free[k]);
      if (ks.length && val[i] >= Math.min(...ks.map(k => val[k] ?? 99))) return false; }
    return true; };
  const idx = free.map((f, i) => (f ? i : -1)).filter(i => i >= 0);
  let need = Math.round(target * n) - val.reduce((s, x) => s + (x ?? 0), 0);
  for (let t = 0; need !== 0 && idx.length && t < 5000; t++) {
    const i = idx[Math.floor(rnd() * idx.length)], s = Math.sign(need), was = val[i];
    if (clamp(was + s) === was) continue;
    val[i] = was + s;
    if (ok()) need -= s; else val[i] = was;
  }
  return squad.map((v, i) => (free[i] ? { ...v, ovr: String(val[i]), auto: true } : v));
}
