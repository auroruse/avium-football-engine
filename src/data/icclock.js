// WHAT THE DATE IS INSIDE AVIUM. Time runs faster there, at a rate that has been changed five times, so the map from a
// real date to an in-universe one is piecewise linear. The table is the Avium Time Counter's, and The Talopedia keeps
// the same one (src/lib/icclock.mjs): if an epoch is added there, add it here too, or the engine and the Talopedia will
// disagree about how old a man is.
const EPOCHS = [
  { ooc: "2026-06-28T00:00:00Z", ic: "1931-06-01", daysPerYear: 52 },
  { ooc: "2026-07-05T00:00:00Z", ic: "1931-12-24", daysPerYear: 26 },
  { ooc: "2026-07-20T00:00:00Z", ic: "1933-01-01", daysPerYear: 26 },
  { ooc: "2026-07-27T00:00:00Z", ic: "1933-04-08", daysPerYear: 52 },
  { ooc: "2026-08-08T00:00:00Z", ic: "1934-01-01", daysPerYear: 52 },
];
const DAY = 86400000, YEAR = 365.2425 * DAY;

// The in-universe instant for a real one.
export function icNow(at = new Date()) {
  const t = at.getTime();
  let ep = EPOCHS[0];
  for (let i = EPOCHS.length - 1; i >= 0; i--) if (t >= Date.parse(EPOCHS[i].ooc)) { ep = EPOCHS[i]; break; }
  return new Date(Date.parse(ep.ic) + (t - Date.parse(ep.ooc)) * (YEAR / (ep.daysPerYear * DAY)));
}

// Whole years between a date ("YYYY-MM-DD") and an instant, the way an age is counted.
export function yearsBetween(fromIso, to) {
  const [y, m, d] = fromIso.split("-").map(Number);
  let n = to.getUTCFullYear() - y;
  if (to.getUTCMonth() + 1 < m || (to.getUTCMonth() + 1 === m && to.getUTCDate() < d)) n -= 1;
  return n;
}

// A man's age today in the world's own time, from his date of birth; null without one.
export const ageOf = (born, at) => (born ? yearsBetween(born, icNow(at)) : null);

// A date of birth the records will take: a real calendar date, and a man at least 14 today.
export function birthDateOk(v, at) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return false;
  return +v.slice(0, 4) >= 1850 && yearsBetween(v, icNow(at)) >= 14;
}
