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
// ARTERRA KEEPS ITS OWN TIME (src/data/worlds.js: the two universes share nothing), and this is its own counter's
// arithmetic (tpop-lightbound.github.io/TPOP-RP-Time, which Moukden and Kirin gave on 19 November 2026: "use this for
// exact time"): midnight GMT on 28 July 2026 was 1 January 2043, time runs four times as fast (three real months a
// year), and its calendar has twelve months, 365 days and no leap years. If that counter's anchor is moved, move it here.
const ARTERRA_CLOCK = { ooc: "2026-07-28T00:00:00Z", year: 2043, mult: 4 };
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// Its date as a Date (read with the UTC getters, like Avium's): never a 29 February, since its years have none.
function arterraNow(t) {
  const days = (t - Date.parse(ARTERRA_CLOCK.ooc)) * ARTERRA_CLOCK.mult / DAY, y = ARTERRA_CLOCK.year + Math.floor(days / 365);
  let rem = ((days % 365) + 365) % 365, m = 0;
  while (m < 11 && rem >= MONTH_DAYS[m]) { rem -= MONTH_DAYS[m]; m++; }
  return new Date(Date.UTC(y, m, Math.floor(rem) + 1, 0, 0, Math.floor((rem - Math.floor(rem)) * 86400)));
}
// The clock read when none is named: Avium's, unless a copy of the app that is Arterra's says otherwise as it starts
// (App.tsx). The registry server never does; it names the universe of each man it dates.
let HERE = "avium";
export const setClockWorld = (w) => { HERE = w === "arterra" ? "arterra" : "avium"; };

// The in-universe instant for a real one, in Avium's time or (world "arterra") Arterra's.
export function icNow(at = new Date(), world = HERE) {
  const t = (at || new Date()).getTime(), eps = EPOCHS;
  if ((world || HERE) === "arterra") return arterraNow(t);
  let ep = eps[0];
  for (let i = eps.length - 1; i >= 0; i--) if (t >= Date.parse(eps[i].ooc)) { ep = eps[i]; break; }
  return new Date(Date.parse(ep.ic) + (t - Date.parse(ep.ooc)) * (YEAR / (ep.daysPerYear * DAY)));
}

// Whole years between a date ("YYYY-MM-DD") and an instant, the way an age is counted.
export function yearsBetween(fromIso, to) {
  const [y, m, d] = fromIso.split("-").map(Number);
  let n = to.getUTCFullYear() - y;
  if (to.getUTCMonth() + 1 < m || (to.getUTCMonth() + 1 === m && to.getUTCDate() < d)) n -= 1;
  return n;
}

// A man's age today in his world's own time, from his date of birth; null without one.
export const ageOf = (born, at, world) => (born ? yearsBetween(born, icNow(at, world)) : null);

// A date of birth the records will take: a real calendar date, and a man at least 14 today.
export function birthDateOk(v, at, world) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return false;
  return +v.slice(0, 4) >= 1850 && yearsBetween(v, icNow(at, world)) >= 14;
}
