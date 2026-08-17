// IMPORTING A WATCHED RESULT. Full time now offers Import / Replay / Abandon instead of writing
// the result the instant the whistle goes, which makes importLiveToMatch a button rather than a
// side effect -- and it had never actually been run. This drives it directly, sliced out of
// App.tsx so it is the shipped code and not a copy, over the three shapes a fixture can be:
// a group match, a one-off knockout, and the second leg of a tie.
import fs from "node:fs";
const eng = await import("./engine.mjs");

const SRC = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const slice = (head) => {
  const i = SRC.indexOf(head);
  if (i < 0) throw new Error("not found: " + head);
  let cur = 0, par = 0, sq = 0, j = i, seen = false;
  for (; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") { cur++; seen = true; }
    else if (c === "}") cur--;
    else if (c === "(") par++;
    else if (c === ")") par--;
    else if (c === "[") sq++;
    else if (c === "]") sq--;
    else if (c === ";" && !cur && !par && !sq && seen) { j++; break; }
  }
  return SRC.slice(i, j);
};

let fails = 0;
const ok = (name, cond, got) => {
  if (!cond) { fails++; console.log("  FAIL  " + name + (got === undefined ? "" : "   " + JSON.stringify(got))); }
  else console.log("  ok    " + name + (got === undefined ? "" : "   " + JSON.stringify(got)));
};

// The world the function closes over. Everything it reads or writes is passed in, so the test can
// look at what it did afterwards.
const world = {};
const mkImport = (state) => {
  Object.assign(world, state, { groups: null, ko: null, stats: null });
  const env = {
    tGroups: state.tGroups, tKO: state.tKO, tConfig: state.tConfig,
    lastLiveResult: null,
    // React setters take a value OR an updater, and this function uses both -- the scoreline goes
    // in as a value and storeDiffs comes back through as an updater to stamp the reversal record on
    // it. A stub that only handles the value form stores the callback and loses the write.
    setTGroups: (v) => { world.groups = typeof v === "function" ? v(world.groups ?? state.tGroups) : v; },
    setTKO:     (v) => { world.ko     = typeof v === "function" ? v(world.ko     ?? state.tKO)     : v; },
    setTPlayerStats: (v) => { world.stats = typeof v === "function" ? v(world.stats ?? state.tPlayerStats ?? {}) : v; },
    recalcStandings: eng.recalcStandings, propagateKO: eng.propagateKO,
    rcSuspGames: (v, r) => v === "violent" ? 3 + Math.floor(r * 3)
                         : v === "abusive" ? 2 + Math.floor(r * 3)
                         : v === "sfp" ? 2 + Math.floor(r * 2) : 1,
    ycSuspGames: (prev, now) => (prev < 5 && now >= 5) ? 1 : 0,
    playerFormFrom: (f, r) => r,
    staminaRecoverFrom: (v) => Math.min(100, v + 20),
    ME_INJURY: eng.ME_INJURY,
    INJ_SEV: eng.ME_INJURY,
  };
  const names = Object.keys(env);
  const body = slice("const importLiveToMatch = (target, result) => {") + "\nreturn importLiveToMatch;";
  return new Function(...names, body)(...names.map(k => env[k]));
};

// Eleven men a side, one scorer, one booking.
const squad = (tag) => Array.from({ length: 11 }, (_, i) => ({ name: tag + i, pos: i ? "MID" : "GK", ovr: 70 }));
const players = (tag, goals) => squad(tag).map((p, i) => ({
  ...p, goals: i === 1 ? goals : 0, assists: 0, rating: 6.8, yc: i === 2 ? 1 : 0,
  rc: 0, inj: 0, passOk: 20, defActs: 2, saves: i ? 0 : 3, stamina: 70, sub: false }));
const team = (name) => ({ name, code: name.slice(0, 3).toUpperCase(), squad: squad(name) });

const RESULT = (h, a, pen) => ({
  homeScore: h, awayScore: a,
  homePlayers: players("H", h), awayPlayers: players("A", a),
  penalties: pen || null,
});

// ── 1. A GROUP FIXTURE ───────────────────────────────────────────────────────
console.log("\ngroup fixture");
{
  const A = team("Alpha"), B = team("Beta");
  const g = { teams: [A, B], schedule: [[{ home: A, away: B }]], standings: [] };
  const imp = mkImport({ tGroups: [g], tKO: null, tConfig: { tiebreakers: [], suspensions: true }, tPlayerStats: {} });
  imp({ type: "group", gi: 0, ri: 0, mi: 0 }, RESULT(3, 1));
  const gm = world.groups?.[0]?.schedule[0][0];
  ok("the scoreline is written", gm?.result?.ftHome === 3 && gm?.result?.ftAway === 1,
     gm?.result && [gm.result.ftHome, gm.result.ftAway]);
  const st = world.groups?.[0]?.standings || [];
  const row = st.find(r => (r.team?.name || r.name) === "Alpha");
  ok("the table recalculates", !!row && (row.pts ?? row.points) === 3, row && (row.pts ?? row.points));
  ok("both squads banked a match", Object.keys(world.stats || {}).length === 22,
     Object.keys(world.stats || {}).length);
  const scorer = world.stats?.["Alpha|H1"];
  ok("the scorer has his goals", scorer?.goals === 3, scorer?.goals);
  ok("passes carried through",   scorer?.passOk === 20, scorer?.passOk);
  ok("the keeper has his saves", world.stats?.["Alpha|H0"]?.saves === 3, world.stats?.["Alpha|H0"]?.saves);
  ok("a booking is recorded",    world.stats?.["Alpha|H2"]?.yellows === 1, world.stats?.["Alpha|H2"]?.yellows);
}

// ── 2. A ONE-OFF KNOCKOUT, SETTLED ON KICKS ──────────────────────────────────
console.log("\nknockout, one leg, decided on penalties");
{
  const A = team("Alpha"), B = team("Beta");
  const ko = { rounds: [{ matches: [{ home: A, away: B }] }] };
  const imp = mkImport({ tGroups: [], tKO: ko, tConfig: { koLegs: 1, suspensions: true }, tPlayerStats: {} });
  imp({ type: "ko", ri: 0, mi: 0, bracket: "wb" }, RESULT(1, 1, { homeScore: 4, awayScore: 2 }));
  const m = world.ko?.rounds[0].matches[0];
  ok("the ninety minutes stand", m?.result?.ftHome === 1 && m?.result?.ftAway === 1,
     m?.result && [m.result.ftHome, m.result.ftAway]);
  ok("the shootout is recorded", m?.result?.pen?.home === 4 && m?.result?.pen?.away === 2, m?.result?.pen);
}

// ── 3. THE SECOND LEG. The sides swap ends, so the result comes in flipped. ──
console.log("\nknockout, second leg (flipped)");
{
  const A = team("Alpha"), B = team("Beta");
  // Leg one at Alpha's ground finished 1-2. Leg two is at Beta's, so tonight's HOME side is Beta.
  const ko = { rounds: [{ matches: [{ home: A, away: B, result: { twoLeg: true, partial: true, leg1: { home: 1, away: 2 } } }] }] };
  const imp = mkImport({ tGroups: [], tKO: ko, tConfig: { koLegs: 2, koAwayGoals: false, suspensions: true }, tPlayerStats: {} });
  // Beta 0 - 1 Alpha tonight: 2-2 on aggregate, settled on kicks.
  imp({ type: "ko", ri: 0, mi: 0, bracket: "wb", leg: 2, flipped: true },
      RESULT(0, 1, { homeScore: 3, awayScore: 5 }));
  const r = world.ko?.rounds[0].matches[0].result;
  ok("aggregate is 2-2",         r?.agg?.home === 2 && r?.agg?.away === 2, r?.agg);
  ok("leg one is preserved",     r?.leg1?.home === 1 && r?.leg1?.away === 2, r?.leg1);
  ok("kicks go to the bracket's away side", r?.pen?.home === 5 && r?.pen?.away === 3, r?.pen);
  // The bracket's home side is Alpha, who played AWAY tonight -- their men must land under Alpha.
  ok("the flip puts each man on his own club",
     !!world.stats?.["Alpha|A1"] && !world.stats?.["Alpha|H1"],
     Object.keys(world.stats || {}).filter(k => k.startsWith("Alpha")).slice(0, 3));
}

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
