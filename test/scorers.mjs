// DOES EVERY GOAL BELONG TO SOMEBODY?
//
// The engine counted goals per SIDE and stopped, so a tournament could take a scoreline off it and
// nothing else -- no top scorer, no assists, nothing a league table hangs off. Now every goal is
// credited to the man who struck it and, where there was one, to the man who put him in.
//
// The check that matters is that the books balance: per-player goals have to add up to the team's
// score, or the top-scorer table quietly disagrees with the results page. They will not balance
// exactly and should not -- an own goal has no scorer by definition, and a ball turned in off a
// rebound with no fresh strike has no shot attached to it -- so the gap is reported rather than
// hidden, and it is the SIZE of the gap that says whether the attribution is sound.
//
//   node test/scorers.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, ME_SIDES, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 30);

function run(seed) {
  const s = createMatchState();
  s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) { out.min = Math.floor(t / ME_MATCH_TICKS * 90) + 1; meTick(s, rng, out); }
  for (let t = 0, add = meAdded(s); t < add; t++) meTick(s, rng, out);
  const A = { goals: 0, credited: 0, assists: 0, byPos: {}, selfAssist: 0, orphan: 0 };
  for (const sd of ME_SIDES) {
    A.goals += out.goals[sd];
    for (const p of s.players[sd]) {
      A.credited += p.goals || 0; A.assists += p.assists || 0;
      if (p.goals) A.byPos[p.pos] = (A.byPos[p.pos] || 0) + p.goals;
    }
  }
  // an assist credited to the scorer himself would be a bookkeeping bug, not a rare event
  for (const sd of ME_SIDES) for (const g of (out.scorers?.[sd] || []))
    if (g.assist && g.assist === g.name) A.selfAssist++;
  A.orphan = A.goals - A.credited;
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const pos = {};
for (const r of res) for (const [k, v] of Object.entries(r.byPos)) pos[k] = (pos[k] || 0) + v;

const g = S("goals"), c = S("credited");
console.log(`\n${N} matches.\n`);
console.log(`  goals scored                    ${g}`);
console.log(`  goals credited to a player      ${c}   (${(100 * c / (g || 1)).toFixed(1)}%)`);
console.log(`  unattributed                    ${g - c}   own goals and balls turned in with no fresh strike`);
console.log(`  assists                         ${S("assists")}   (${(100 * S("assists") / (c || 1)).toFixed(1)}% of credited goals)`);
console.log(`  assists credited to the scorer  ${S("selfAssist")}   <- must be zero`);
console.log(`\n  who scores them:`);
for (const [k, v] of Object.entries(pos).sort((a, b) => b[1] - a[1]))
  console.log(`    ${k.padEnd(4)} ${String(v).padStart(4)}  ${(100 * v / (c || 1)).toFixed(1)}%`);
console.log(`\n  A forward-heavy split is the sanity check on the credit going to the right man --`);
console.log(`  if defenders are outscoring strikers the index is being read against the wrong squad.`);
