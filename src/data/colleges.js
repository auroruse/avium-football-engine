// THE COLLEGES (the All-Nichirin Collegiate Championship, Moukden and Kirin, 12 and 13 October 2026). A league whose record
// says `college` is a college competition. Its players' ratings, values and traits are hidden in the app from everyone but
// the overseer (App.tsx), and each carries `grad`, the year his course ends, which is the draft he enters.

// The season the colleges are playing, by the year it ends, which is also the draft it feeds: 1935/36 and the 1936 draft
// to start. It moves on once a draft is held (the draft, stage 3).
export const COLLEGE_SEASON = 1936;

// A course is four years.
export const YEARS = ["First Year", "Second Year", "Third Year", "Final Year"];
export const gradOk = (v) => Number.isInteger(v) && v >= 1900 && v <= 2100;
// His year, 1 to 4, from his graduation year; null once it falls outside the course.
export const yearOf = (grad, season = COLLEGE_SEASON) => { const y = 4 - (grad - season); return gradOk(grad) && y >= 1 && y <= 4 ? y : null; };
// The graduation year of a man joining at this age: 21 or more Final Year, 20 Third, 19 Second, 18 or less First.
export const gradFor = (age, season = COLLEGE_SEASON) => season + 3 - Math.max(0, Math.min(3, (age ?? 18) - 18));

// The college leagues by name, and the men at their clubs.
export const collegeLeagues = (leagues) => new Set((leagues || []).filter(l => l.college).map(l => l.name));
export function collegeMen(records) {
  const names = collegeLeagues(records.leagues), out = new Set();
  for (const t of records.teams || []) if (names.has(t.group) && t.file !== "AVIUM" && t.file !== "ARTERRA")
    for (const v of t.squad || []) { const id = v && typeof v === "object" ? v.id : v; if (id) out.add(id); }
  return out;
}
