// THE EXPORT IS THE ARCHIVE FORMAT. Whatever buildSeasonMd writes gets dropped into
// public/pstats and read straight back, so it is checked against the reader here rather than
// rewritten by hand afterwards — which is what happened to three cup reports.
import fs from "node:fs";
const eng = await import("./engine.mjs");
const { buildSeasonMd, recalcStandings } = eng;

// the reader, sliced out of App.tsx so this tests the shipped parser
const SRC = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const fn = (name) => {
  const i = SRC.indexOf("function " + name);
  let d = 0, j = i, seen = false;
  for (; j < SRC.length; j++) {
    if (SRC[j] === "{") { d++; seen = true; }
    else if (SRC[j] === "}") { d--; if (seen && d === 0) { j++; break; } }
  }
  return SRC.slice(i, j);
};
const READER = new Function(fn("parseSeasonReport") + fn("parseTournTabs") + fn("tournWinner") +
  "return { parseSeasonReport, parseTournTabs, tournWinner };")();

let fails = 0;
const ok = (n, c, got) => { if (!c) { fails++; console.log("  FAIL  " + n + (got === undefined ? "" : "   " + JSON.stringify(got))); } else console.log("  ok    " + n); };

const team = (n) => ({ name: n, code: n.slice(0, 3).toUpperCase(), skill: 75 });
const A = team("Alpha"), B = team("Beta"), C = team("Gamma"), D = team("Delta");

console.log("\nleague season");
{
  const g = { teams: [A, B, C, D], standings: [], schedule: [
    [{ home: A, away: B, result: { ftHome: 2, ftAway: 1 } }, { home: C, away: D, result: { ftHome: 0, ftAway: 0 } }],
    [{ home: A, away: C, result: { ftHome: 1, ftAway: 3 } }, { home: B, away: D, result: { ftHome: 2, ftAway: 2 } }]] };
  const md = buildSeasonMd({ title: "Test League 33/34", groups: [g], ko: null, tiebreakers: [] });
  const R = READER.parseSeasonReport(md);
  ok("the round stepper sees both rounds", R.rounds.length === 2, R.rounds.length);
  ok("every round has its fixtures", R.rounds.every(r => r.fixtures), R.rounds.map(r => !!r.fixtures));
  ok("every round has its running table", R.rounds.every(r => r.table), R.rounds.map(r => !!r.table));
  ok("a final table closes it", !!R.final && R.final.body.length === 4, R.final?.body.length);
  ok("nothing is left over as prose", R.rest === "", R.rest.slice(0, 60));
  ok("no champion line", !/champions/i.test(md));
}

console.log("\nknockout cup, one leg, a shootout and extra time");
{
  const ko = { rounds: [
    { matches: [
      { home: A, away: B, result: { ftHome: 1, ftAway: 1, pen: { home: 5, away: 3 } } },
      { home: C, away: D, result: { ftHome: 2, ftAway: 0 } }] },
    { matches: [{ home: A, away: C, result: { ftHome: 1, ftAway: 0, et: { home: 1, away: 0 } } }] }] };
  const md = buildSeasonMd({ title: "Test Cup 33/34", groups: [], ko, tiebreakers: [], koLegs: 1 });
  const T = READER.parseTournTabs(md);
  ok("one Knockouts tab", T.tabs.length === 1 && T.tabs[0].name === "Knockouts", T.tabs.map(t => t.name));
  ok("no preamble", T.pre === "", T.pre);
  ok("pens read as a comma suffix", /\| 1-1, 5-3 pens \|/.test(md), md.match(/\| 1-1[^|]*\|/)?.[0]);
  ok("aet reads as a comma suffix", /, aet \|/.test(md), md.match(/\| 2-0[^|]*\|/)?.[0]);
  ok("no exporter-only spelling", !/\(\d+-\d+p\)/.test(md) && !/agg /.test(md));
  ok("the champion is the bold side of the Final", READER.tournWinner(md) === "Alpha", READER.tournWinner(md));
}

console.log("\ngroup tournament: tabs, not a round stepper");
{
  const g = { teams: [A, B, C, D], standings: [], schedule: [
    [{ home: A, away: B, result: { ftHome: 3, ftAway: 0 } }, { home: C, away: D, result: { ftHome: 1, ftAway: 2 } }]] };
  const ko = { rounds: [{ matches: [{ home: A, away: D, result: { ftHome: 2, ftAway: 1 } }] }] };
  const md = buildSeasonMd({ title: "Test Tournament 1934", groups: [g], ko, tiebreakers: [], koLegs: 1 });
  const R = READER.parseSeasonReport(md), T = READER.parseTournTabs(md);
  ok("no round stepper", R.rounds.length === 0, R.rounds.length);
  ok("Group Stage then Knockouts", T.tabs.map(t => t.name).join("|") === "Group Stage|Knockouts", T.tabs.map(t => t.name));
  ok("the standings lead the group tab", T.tabs[0].body.join("\n").indexOf("| # | Team |") < T.tabs[0].body.join("\n").indexOf("| Match | Score |"));
  ok("the champion still resolves", READER.tournWinner(md) === "Alpha", READER.tournWinner(md));
}

console.log("\ntwo-legged knockout");
{
  const ko = { rounds: [{ matches: [{ home: A, away: B, result: {
    twoLeg: true, leg1: { home: 1, away: 2 }, leg2: { home: 1, away: 2 },
    agg: { home: 3, away: 3 }, awayGoals: { home: 2, away: 2 }, awayGoalsRule: true } }] }] };
  const md = buildSeasonMd({ title: "Test Two Legs", groups: [], ko, tiebreakers: [], koLegs: 2 });
  ok("legs and aggregate are their own columns", /\| Match \| Leg 1 \| Leg 2 \| Agg \|/.test(md), md.split("\n").find(l => l.includes("Leg 1")));
  ok("away goals read as a comma suffix", /3-3, ag \|/.test(md), md.split("\n").find(l => l.includes("3-3")));
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
