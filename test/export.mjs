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
const READER = new Function(fn("parseSeasonReport") + fn("parseTournTabs") + fn("tournWinner") + fn("seasonMoves") + fn("playoffTie") +
  "return { parseSeasonReport, parseTournTabs, tournWinner, seasonMoves, playoffTie };")();

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
  // A league season can carry sections of its own after its table (NL2 1935's promotion playoff), each a tab beside the
  // rounds: the rounds and the table read exactly as before, and the section keeps its stages for the tab.
  const po = md + "\n---\n\n## Promotion Playoff\n\n### Final\n\n| Match | Score |\n|---|---|\n| **Alpha** vs Gamma | 1-0 |\n";
  const P = READER.parseSeasonReport(po);
  ok("a playoff after the table leaves the rounds and the table alone", P.rounds.length === 2 && P.final?.body.length === 4 && P.rest === "", [P.rounds.length, P.final?.body.length, P.rest]);
  ok("...and is a section of its own, its stage and its tie kept", P.extra.length === 1 && P.extra[0].name === "Promotion Playoff"
     && P.extra[0].body.some(l => l === "### Final") && P.extra[0].body.some(l => l.includes("**Alpha** vs Gamma")), P.extra);
  ok("a season without one has none", R.extra.length === 0, R.extra);
}

console.log("\nwho a finished season sends up and down");
{
  const t = ["A", "B", "C", "D", "E", "F", "G", "H"], tie = (s) => READER.playoffTie(s.split("\n"));
  const po = tie("### Final\n\n| Match | Score |\n|---|---|\n| **E** vs C | 1-0 |");
  ok("a playoff is won by its bold side", po?.win === "E" && po?.lose === "C", po);
  ok("...else by the score, two legs by the aggregate", tie("| Match | Leg 1 | Leg 2 | Agg |\n|---|---|---|---|\n| X vs Y | 1-0 | 0-2 | 1-2 |")?.win === "Y");
  ok("a level tie with no winner marked settles nothing", tie("| Match | Score |\n|---|---|\n| X vs Y | 1-1 |") === null);
  const mv = (rules, ties, above, below) => Object.fromEntries(READER.seasonMoves(t, rules, ties, above, below));
  ok("the top places go up and the bottom ones down", JSON.stringify(mv({ up: 2, down: 3 }, [], true, true)) === JSON.stringify({ A: "up", B: "up", F: "down", G: "down", H: "down" }), mv({ up: 2, down: 3 }, [], true, true));
  ok("nobody goes up from the top division, nor down from the bottom one", JSON.stringify(mv({ up: 2, down: 3 }, [], false, false)) === "{}");
  ok("a playoff winner of the division takes a place up besides", mv({ up: 2 }, [po], true, false).E === "up" && mv({ up: 2 }, [po], true, false).C === undefined, mv({ up: 2 }, [po], true, false));
  const rel = { win: "Z", lose: "G" };
  ok("a relegation playoff lost to the division below sends its man down", mv({ down: 1 }, [rel], false, true).G === "down" && mv({ down: 1 }, [{ win: "G", lose: "Z" }], false, true).G === undefined);
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
console.log("\na college league's season: the preset, the export and the archive's reading of it");
{
  // The preset is the league's record: its clubs in their conferences, in bracket order, each group named.
  const lg = eng.RECORDS.leagues.find(l => l.college && l.conferences?.length), P = eng.PARTICIPANT_PRESETS.get(lg?.name);
  ok("the college league has a preset under its own name", !!P, lg?.name);
  ok("...its groups are its conferences, in order, named after them",
     JSON.stringify(Object.values(P.names)) === JSON.stringify(lg.conferences.map(c => c.name)), P.names);
  ok("...every club in its conference's group, all of them placed", Object.values(P.groups).every((g, i) => g.length === lg.conferences[i].clubs.length)
     && P.teams.length === lg.conferences.reduce((n, c) => n + c.clubs.length, 0), Object.values(P.groups).map(g => g.length));
  const cat = new Map(eng.PRESET_CATALOG.map(t => [t.name.normalize("NFC"), t]));
  ok("...every club found by name among the sides a tournament picks from", P.teams.every(n => cat.has(n.normalize("NFC"))), P.teams.filter(n => !cat.has(n.normalize("NFC"))));
  ok("...played to the college format", P.config.koAllocMode === "crossover" && P.config.rrLegs === 1 && P.config.homeAdvKO === "off"
     && !P.config.thirdPlace && P.config.qualZones[0].to === 2 && P.config.stages.join("|") === "Conferences|Playoff", P.config);
  ok("...and the archive knows it as a college league", eng.COLLEGE_COMPS.has(lg.name));

  // A season: the preset's groups, every conference match a fixed score, the crossed playoff off the tables.
  const teams = P.teams.map(n => cat.get(n.normalize("NFC")));
  const G = eng.allocPreset(teams, P.groups, "roundRobin", 1, P.names);
  ok("the groups carry their conferences' names", G.map(g => eng.groupName(g)).join("|") === lg.conferences.map(c => c.name).join("|"), G.map(g => g.name));
  ok("...and their initials where a column has room for a letter", G.map(g => eng.groupTag(g)).join("|") === "CE|FL|SC|BW", G.map(g => eng.groupTag(g)));
  ok("...each a single round robin", G.every(g => g.schedule.length === 7 && g.schedule.every(rd => rd.length === 4)), G.map(g => g.schedule.length));
  let n = 0;
  for (const g of G) for (const rd of g.schedule) for (const m of rd) { n++; m.result = { ftHome: n % 4, ftAway: (n * 7) % 3 }; }
  const tb = P.config.tiebreakers;
  G.forEach(g => { g.standings = eng.recalcStandings(g, tb); });
  const half = eng.buildSeasonMd({ title: "ANCC 35/36", groups: G, ko: null, tiebreakers: tb, koLegs: 1, stages: P.config.stages });
  const H = READER.parseSeasonReport(half), HT = READER.parseTournTabs(half);
  ok("halfway, before the playoff, it is still the tab shape, not a league's", H.rounds.length === 0 && !H.final && HT.tabs.map(t => t.name).join("|") === "Conferences",
     HT.tabs.map(t => t.name));
  const q = eng.collectKOTeamsFromZones(G, P.config.qualZones).all, ko = eng.buildKnockoutCrossover(q, false);
  const top = (L, k) => G[L].standings[k - 1].name, r1 = ko.rounds[0].matches.map(m => m.home.name + " v " + m.away.name);
  ok("the playoff is crossed: Capital 1 v Western 2, Southern 1 v Eastern 2, then Western 1 v Capital 2, Eastern 1 v Southern 2",
     r1.join("|") === [[0, 1, 1, 2], [2, 1, 3, 2], [1, 1, 0, 2], [3, 1, 2, 2]].map(([a, x, b, y]) => top(a, x) + " v " + top(b, y)).join("|"), r1);
  eng.propagateKO(ko);
  const win = (m, pens) => { m.result = pens ? { ftHome: 1, ftAway: 1, pen: { home: 4, away: 2 } } : { ftHome: 2, ftAway: 0 }; };
  ko.rounds.forEach((r, ri) => { r.matches.forEach((m, mi) => win(m, ri === 2)); eng.propagateKO(ko); });
  const champ = ko.rounds[2].matches[0].home.name, runner = ko.rounds[2].matches[0].away.name, semi = ko.rounds[1].matches[0].away.name;
  const md = eng.buildSeasonMd({ title: "ANCC 35/36", groups: G, ko, tiebreakers: tb, koLegs: 1, stages: P.config.stages });
  const T = READER.parseTournTabs(md);
  ok("the season file's tabs are Conferences then Playoff", T.tabs.map(t => t.name).join("|") === "Conferences|Playoff", T.tabs.map(t => t.name));
  ok("each conference's table under its name", lg.conferences.every(c => md.includes("### " + c.name + "\n")));
  ok("...its rounds under the round and its name", md.includes("### Round 7 — Capital Eight\n") && md.includes("### Round 1 — Blue Water Conference\n"));
  ok("the two each conference sent through are in bold, and nobody else", (md.match(/^\| \d+ \| \*\*/gm) || []).length === 8, (md.match(/^\| \d+ \| \*\*/gm) || []).length);
  ok("the champion is the playoff's", READER.tournWinner(md) === champ, READER.tournWinner(md));
  const won = eng.archResult(md, champ), lost = eng.archResult(md, runner), sf = eng.archResult(md, semi), out = eng.archResult(md, top(0, 8));
  ok("a club's season is its conference line, as a league's", won.league && won.college && won.of === 8 && won.pos >= 1 && won.pos <= 2 && !!won.conf && won.pts != null, won);
  ok("...with how far it went: the champion Winner, the final's loser Runner-up, a semi-finalist Semi-finals",
     won.stage === "Winner" && lost.stage === "Runner-up" && sf.stage === "Semi-finals", [won.stage, lost.stage, sf.stage]);
  ok("...and a club out in its conference the conference stage, its place and its conference", out.stage === "Conference stage" && out.pos === 8 && out.conf === "Capital Eight", out);
  // A tournament of lettered groups still writes Group A, and Knockouts.
  const plain = eng.buildSeasonMd({ title: "Cup", groups: G.map(({ name, ...g }) => g), ko, tiebreakers: tb, koLegs: 1 });
  ok("lettered groups still read Group A, its rounds Round 1 — Group A, the knockout Knockouts",
     plain.includes("### Group A\n") && plain.includes("### Round 1 — Group A\n") && plain.includes("## Group Stage\n") && plain.includes("## Knockouts\n"));
  ok("...and a World Cup group's club still went out in the Group stage", eng.archResult(plain, top(0, 8)).stage === "Group stage", eng.archResult(plain, top(0, 8)));
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
