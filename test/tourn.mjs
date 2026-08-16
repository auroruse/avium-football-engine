// Does Play Live actually run the tournament's fixture?
//
// Three things this checks, all by slicing the SHIPPED source out of App.tsx and running it --
// not by re-implementing it here, which would only test the copy:
//   1. meLevel   -- a two-legged tie is level on aggregate, and away goals can settle it.
//   2. meTeamFor -- the tournament's team sheet survives the rewrap into meSide/meBench, so a
//                   suspended man stays out and the eleven that starts is the eleven that was
//                   available.
//   3. meReport  -- every man in the match reaches the tournament's stat tables exactly once.
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

// Pull a declaration out by its opening line: run to the end of the statement, which is the first
// semicolon or closing brace outside every bracket. Balancing only braces cuts an arrow whose body
// is a chained expression in half.
const slice = (head) => {
  const i = SRC.indexOf(head);
  if (i < 0) throw new Error("not found: " + head);
  let cur = 0, par = 0, sq = 0, j = i, seen = false;
  for (; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") { cur++; seen = true; }
    // A `function` declaration ends at its closing brace; a `const` ends at its semicolon, and
    // breaking on the brace would cut `=> sq ? {...} : t` off before the alternative.
    else if (c === "}") { cur--; if (head.startsWith("function") && seen && !cur && !par && !sq) { j++; break; } }
    else if (c === "(") par++;
    else if (c === ")") par--;
    else if (c === "[") sq++;
    else if (c === "]") sq--;
    else if (c === ";" && !cur && !par && !sq) { j++; break; }
  }
  return SRC.slice(i, j);
};

const src = [
  slice("function capAtEleven"),
  slice("function splitAvailSquad"),
  slice("const meSide = (t) => {"),
  slice("const meBench = (t) =>").replace(/^const/, "const"),
  slice("const meTeamFor = (t, sq) =>"),
  slice("const meLevel = (m) => {"),
].join("\n");

const prelude = `
const playerKey = (team, name) => team + "|" + name;
const buildSquad = () => { throw new Error("buildSquad should not be reached"); };
const managerSelect = () => { throw new Error("managerSelect should not be reached"); };
`;

const { capAtEleven, splitAvailSquad, meSide, meBench, meTeamFor, meLevel } =
  new Function(prelude + src + "\nreturn { capAtEleven, splitAvailSquad, meSide, meBench, meTeamFor, meLevel };")();

let fails = 0;
const ok = (name, cond, got) => {
  if (!cond) { fails++; console.log("  FAIL  " + name + (got === undefined ? "" : "   got: " + JSON.stringify(got))); }
  else console.log("  ok    " + name);
};

// ── 1. LEVEL ON AGGREGATE ────────────────────────────────────────────────────
// m.tourn.agg is leg one's goals turned round for THIS leg's home side, so agg[0] is the home
// side's leg-one tally (which they scored away) and agg[1] the visitors'.
console.log("\naggregate and away goals");
const M = (h, a, agg, ag) => ({ out: { goals: { home: h, away: a } },
                                tourn: agg ? { agg, awayGoalsRule: !!ag } : null });

ok("a one-off draw is level",             meLevel(M(1, 1, null)) === true);
ok("a one-off win is not",                meLevel(M(2, 1, null)) === false);
// Leg one 1-0 to the side now at home. They lose 0-1 tonight: 1-1 on aggregate.
ok("2nd leg level on aggregate",          meLevel(M(0, 1, [1, 0])) === true);
ok("2nd leg won on aggregate",            meLevel(M(1, 1, [1, 0])) === false);
ok("2nd leg lost on aggregate",           meLevel(M(0, 2, [1, 0])) === false);
// A 2-2 tonight after a 1-1 first leg: 3-3, and the visitors scored 2 away against the hosts' 1.
ok("away goals settle a level agg",       meLevel(M(2, 2, [1, 1], true)) === false);
ok("...but only where the rule applies",  meLevel(M(2, 2, [1, 1], false)) === true);
// 1-1 tonight after a 1-1 first leg: 2-2, and both sides scored one away. Kicks.
ok("equal away goals stays level",        meLevel(M(1, 1, [1, 1], true)) === true);
// 0-0 tonight after a 0-0 first leg. Nobody scored anywhere; still level.
ok("goalless over two legs is level",     meLevel(M(0, 0, [0, 0], true)) === true);

// ── 2. THE TOURNAMENT'S TEAM SHEET SURVIVES THE REWRAP ───────────────────────
console.log("\nsuspended men stay out of the eleven");
const POS = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD"];
const squad = [
  ...POS.map((pos, i) => ({ name: "S" + i, pos, ovr: 80 - i, bench: false })),
  ...["GK", "DEF", "MID", "MID", "FWD", "FWD", "DEF"].map((pos, i) => ({ name: "B" + i, pos, ovr: 68 - i, bench: true })),
];
const banned = new Set(["Team|S2", "Team|S6"]);          // a centre-half and a midfielder
const sq = splitAvailSquad(squad.map(p => ({ ...p })), "Team", banned, null, null);
const t = { name: "Team", skill: 75, formation: "4-3-3" };
const xi = meSide(meTeamFor(t, sq));
const bench = meBench(meTeamFor(t, sq));
const names = new Set(xi.map(p => p.name));

ok("eleven start",                        xi.length === 11, xi.length);
ok("one keeper starts",                   xi.filter(p => p.pos === "GK").length === 1);
ok("banned centre-half is out",           !names.has("S2"));
ok("banned midfielder is out",            !names.has("S6"));
ok("nobody is in twice",                  names.size === 11);
ok("nobody starts and sits",              bench.every(p => !names.has(p.name)));
ok("the bench is what is left",           bench.length === sq.bench.length, [bench.length, sq.bench.length]);
// Without a tournament sheet the club's own eleven is untouched -- meTeamFor has to be a no-op.
const plain = meSide(meTeamFor(t, null) === t ? { ...t, squad } : null);
ok("no fixture, no interference",         plain.length === 11 && plain.some(p => p.name === "S2"));

// ── 3. EVERY MAN REACHES THE TABLES ONCE ─────────────────────────────────────
// meReport's mapper, verbatim from source, over a match state where two men have been replaced.
console.log("\nevery man reaches the tournament tables once");
const rptSrc = slice("const meReport = (m) => {");
const mapBody = rptSrc.slice(rptSrc.indexOf("const men = (side) =>"), rptSrc.indexOf("importLiveToMatch("));
const men = new Function("m", mapBody + "\nreturn men;")({
  s: {
    players: { home: [
      ...POS.map((pos, i) => ({ name: "S" + i, pos, ovr: 60, ovr0: 80, rating: 7.1, passOk: 30, defActs: 2, saves: 0 })).slice(0, 9),
      { name: "B1", pos: "DEF", ovr: 55, ovr0: 68, rating: 6.4, passOk: 9, defActs: 1, _onAt: 60 },
      { name: "B2", pos: "MID", ovr: 55, ovr0: 67, rating: 6.6, passOk: 12, defActs: 0, _onAt: 70 },
    ], away: [] },
    subbedOff: { home: [
      { name: "S9", pos: "FWD", ovr: 58, ovr0: 71, rating: 6.9, passOk: 14, defActs: 0, _offAt: 60 },
      { name: "S10", pos: "FWD", ovr: 57, ovr0: 70, rating: 6.2, passOk: 8, defActs: 0, _offAt: 70 },
    ], away: [] },
  },
});
const rows = men("home");
ok("thirteen men reported",               rows.length === 13, rows.length);
ok("no duplicates",                       new Set(rows.map(r => r.name)).size === 13);
ok("two came off the bench",              rows.filter(r => r.sub).length === 2);
ok("the men who came off started",        rows.filter(r => ["S9", "S10"].includes(r.name)).every(r => r.sub === false));
ok("base OVR, not the tired one",         rows.find(r => r.name === "S0").ovr === 80);
ok("passes carried per man",              rows.find(r => r.name === "B2").passOk === 12);
ok("no chances field left behind",        rows.every(r => r.chances === undefined));

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
