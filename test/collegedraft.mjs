// THE COLLEGE DRAFT (src/data/collegedraft.js) on the real records: starting it off the tables, the picks Nichirin's clubs
// make at once, an editor's pick and its refusals, who makes way in a full squad, a clock running out, and the end, when
// every final-year man nobody took goes free. Whole run, no server.
//
//   node test/collegedraft.mjs        (bundles src/data with esbuild first)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "cdraft-")), ENTRY = join(DIR, "entry.js"), OUT = join(DIR, "cdraft.mjs");
writeFileSync(ENTRY, ["data/collegedraft.js", "data/draft.js", "data/positions.js", "data/rules.js"].map(f => `export * from ${JSON.stringify(join(ROOT, "src", f))};`).join("\n")
  + `\nexport { sposFor } from ${JSON.stringify(join(ROOT, "src/engine/formations.ts"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const D = await import(pathToFileURL(OUT).href), E = D;
const { applyDraft, idOf, teamKey, posFitCost, posList, slotLabels, ownersOf } = D;

let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${got === undefined ? "" : "   " + JSON.stringify(got)}`); };
const read = (f) => JSON.parse(fs.readFileSync(new URL("../src/data/" + f, import.meta.url), "utf8"));
const rec0 = { players: read("players.json"), managers: read("managers.json"), teams: read("teams.json"), leagues: read("leagues.json") };
const editors = read("editors.json"), drafts = read("drafts.json");
const judge = (rec) => { const P = new Map(rec.players.map(p => [p.id, p]));
  return { labels: (t) => slotLabels(E.sposFor, t.formation, t.squad.length, !["AVIUM", "ARTERRA"].includes(t.file)), fit: posFitCost,
           ovr: (id) => P.get(id)?.ovr ?? 0, pos: (id) => posList(P.get(id)?.pos) }; };
const over = new Set(editors.overseers.map(o => o.toLowerCase()));
const handOf = (rec) => (k) => { const t = rec.teams.find(x => teamKey(x) === k); return !!t && ownersOf(editors, t).some(u => !over.has(u.toLowerCase())); };
const name = (id) => rec0.players.find(p => p.id === id)?.name;
const clubOf = (rec, id) => rec.teams.find(t => (t.squad || []).some(v => idOf(v) === id)) || null;

console.log("\nthe draft on file");
const d0 = D.currentDraft(drafts);
ok("one draft waiting, 44 picks, two hours each", d0 && d0.status === "waiting" && d0.picks.length === 44 && d0.window === 7200, d0 && [d0.status, d0.picks.length]);
const traded = d0.picks.filter(p => p.club);
ok("Nichirin's twelve traded picks, all among NL1's (25 to 44)", traded.length === 12 && traded.every(p => p.n >= 25 && p.n <= 44), traded.map(p => p.n));
const tally = {}; for (const p of traded) { const t = rec0.teams.find(x => x.id === p.club); tally[t.name.trim()] = (tally[t.name.trim()] || 0) + 1; }
ok("two each to Daryā and Homā, one each to the other eight", tally["Daryā Shushabad"] === 2 && tally["Homā Nourabad"] === 2
   && ["Tarāzu Dashtvār", "Mehrāvar AC", "Murmánska Partisani", "Åulot FK", "RöPS", "XIV. District JK", "VKS", "Szatmár SK"].every(n => tally[n] === 1), tally);
ok("every one of them picks by hand", traded.every(p => handOf(rec0)(p.club)));
const pool = D.draftPool(rec0, d0);
ok("the pool is every final-year man at a college", pool.size === rec0.players.filter(p => p.grad === 1935).length && pool.size > 100, pool.size);

console.log("\nstarting it");
// The tables: NL2 then NL1, each in a made-up finishing order, worst first.
const lg = (n) => rec0.teams.filter(t => t.group === n && !t.removed).map(teamKey);
const order = [...lg("Nichirin League Two").reverse(), ...lg("Nichirin League One").reverse()];
ok("the tables give 44 clubs", order.length === 44, order.length);
ok("starting is refused with a club given two picks by the tables", !!D.startDraft(rec0, d0, order.map((k, i) => (i === 2 ? order[0] : k)), null).errors);
const st = D.startDraft(rec0, d0, order, "public/avium/pstats/ancc/35-36.tsv", new Date("2026-10-14T12:00:00Z"));
ok("it starts: every pick the tables give has its club, the traded ones keep theirs", st.draft?.status === "running"
   && st.draft.picks.every((p, i) => p.club === (d0.picks[i].club || order[i])), st.errors);
// A season board: the pool's men in a fixed order, as the stats file would rank them.
const board = [...pool.keys()].sort().reverse().map(id => ({ name: name(id), team: rec0.teams.find(t => teamKey(t) === pool.get(id)).code }));
let t0 = new Date("2026-10-14T12:00:00Z"), run = D.runDraft(rec0, st.draft, { now: t0, hand: handOf(rec0), board, h: judge(rec0) });
let d = run.draft, rec = applyDraft(rec0, run.patch);
const first = d.picks.find(p => !p.player);
ok("Nichirin's clubs pick at once, up to the first pick made by hand", run.made.length === first.n - 1 && handOf(rec0)(first.club)
   && d.picks.slice(0, first.n - 1).every(p => p.auto && p.by === "auto"), [run.made.length, first.n]);
ok("...each taking the best man left on the board", d.picks[0].player === board.map(b => [...pool].find(([id]) => name(id) === b.name)[0])[0]);
ok("...who leaves his college and joins the club", !!d.picks[0].player && clubOf(rec, d.picks[0].player)?.id === d.picks[0].club);
ok("the club on the clock has two hours", d.clock?.n === first.n && Date.parse(d.clock.until) - t0.getTime() === 7200e3, d.clock);
ok("the drafted men's ratings now show: none is at a college", d.picks.filter(p => p.player).every(p => clubOf(rec, p.player).group !== "All-Nichirin Collegiate Championship"));

console.log("\npicking by hand");
const left = D.draftPool(rec, d), [manA, manB] = [...left.keys()];
ok("a pick not on the clock is refused", !!D.runDraft(rec, d, { now: t0, hand: handOf(rec), board, h: judge(rec), pick: { n: first.n + 1, player: manA } }).errors);
ok("a man already drafted is refused", !!D.runDraft(rec, d, { now: t0, hand: handOf(rec), board, h: judge(rec), pick: { n: first.n, player: d.picks[0].player } }).errors);
const club = rec.teams.find(t => t.id === first.club), someone = idOf(club.squad.find(v => idOf(v)));
ok("naming someone to make way with a place open is refused", !!D.runDraft(rec, d, { now: t0, hand: handOf(rec), board, h: judge(rec),
   pick: { n: first.n, player: manA, out: someone } }).errors);
run = D.runDraft(rec, d, { now: t0, hand: handOf(rec), board, h: judge(rec), pick: { n: first.n, player: manA, by: "GeneralVarah" } });
ok("the editor's pick is made, with whoever is due after it", !run.errors && run.draft.picks[first.n - 1].player === manA && run.draft.picks[first.n - 1].by === "GeneralVarah"
   && !run.draft.picks[first.n - 1].auto, run.errors);
d = run.draft; rec = applyDraft(rec, run.patch);
ok("...into an open place at his new club", clubOf(rec, manA)?.id === first.club && rec.teams.find(t => t.id === first.club).squad.length === 22);

console.log("\na full squad");
const next = d.picks.find(p => !p.player), full = rec.teams.find(t => t.id === next.club);
// Fill its open places with free men, for the test.
const freeMen = rec.players.filter(p => !rec.teams.some(t => (t.squad || []).some(v => idOf(v) === p.id)) && !p.retired && !p.grad).map(p => p.id);
const filled = full.squad.map(v => idOf(v) ?? freeMen.shift());
const recFull = { ...rec, teams: rec.teams.map(t => (t.id === full.id ? { ...t, squad: filled } : t)) };
const free2 = D.draftPool(recFull, d), man2 = [...free2.keys()][0];
const pr = D.runDraft(recFull, d, { now: t0, hand: handOf(recFull), board, h: judge(recFull), pick: { n: next.n, player: man2 } });
ok("with no open place, the editor has to name who makes way", !!pr.errors && /makes way/.test(pr.errors[0]), pr.errors);
const bench = filled.slice(11), out = bench[3];
const pf = D.runDraft(recFull, d, { now: t0, hand: handOf(recFull), board, h: judge(recFull), pick: { n: next.n, player: man2, out } });
const recF = applyDraft(recFull, pf.patch);
ok("...and the man he names goes free as the drafted man comes in", !pf.errors && !clubOf(recF, out) && clubOf(recF, man2)?.id === full.id && pf.draft.picks[next.n - 1].out === out, pf.errors);
ok("an automatic pick names the weakest bench man at the drafted man's position", D.makesWay(recFull, filled, man2) != null);

console.log("\nthe clock runs out");
const late = new Date(Date.parse(d.clock.until) + 60e3);
const tick = D.runDraft(rec, d, { now: late, hand: handOf(rec), board, h: judge(rec) });
ok("a club whose two hours are up gets the best man left", tick.draft.picks[next.n - 1].player && tick.draft.picks[next.n - 1].by === "clock" && tick.draft.picks[next.n - 1].auto);
ok("...and the next pick by hand starts its own two hours", tick.draft.clock && tick.draft.clock.n > next.n && Date.parse(tick.draft.clock.until) - late.getTime() === 7200e3, tick.draft.clock);
ok("nothing happens before the two hours are up", D.runDraft(rec, d, { now: new Date(Date.parse(d.clock.until) - 60e3), hand: handOf(rec), board, h: judge(rec) }).made.length === 0);

console.log("\npaused, and a pick given away");
const ps = D.steerDraft(rec, d, "pause", { now: t0 });
ok("paused, the clock keeps what it had left and nobody can pick", ps.draft.status === "paused" && ps.draft.clock.left === 7200e3
   && !!D.runDraft(rec, ps.draft, { now: late, hand: handOf(rec), board, h: judge(rec), pick: { n: next.n, player: manB } }).errors);
const rs = D.steerDraft(rec, ps.draft, "resume", { now: late });
ok("resumed, it has the same time left", rs.draft.status === "running" && Date.parse(rs.draft.clock.until) - late.getTime() === 7200e3, rs.draft.clock);
const gv = D.steerDraft(rec, d, "give", { n: 44, club: "t0287" });
ok("a pick still to come can be given to another club", gv.draft.picks[43].club === "t0287");
ok("...but not one already made", !!D.steerDraft(rec, d, "give", { n: 1, club: "t0287" }).errors);

console.log("\nto the end");
let dd = d, rr = rec, guard = 0;
while (dd.status === "running" && guard++ < 50) {
  const c = dd.clock; const r2 = D.runDraft(rr, dd, { now: new Date(Date.parse(c.until) + 1), hand: handOf(rr), board, h: judge(rr) });
  if (r2.errors) { ok("no errors on the way", false, r2.errors); break; }
  dd = r2.draft; if (r2.patch) rr = applyDraft(rr, r2.patch);
}
ok("all 44 picks made and the draft over", dd.status === "done" && dd.picks.every(p => p.player) && !!dd.ended, dd.status);
ok("44 different men", new Set(dd.picks.map(p => p.player)).size === 44);
const finals = rr.players.filter(p => p.grad === 1935).map(p => p.id), drafted = new Set(dd.picks.map(p => p.player));
ok("every final-year man nobody took has left his college for free agency", finals.filter(id => !drafted.has(id)).every(id => !clubOf(rr, id)), finals.filter(id => !drafted.has(id) && clubOf(rr, id)).length);
ok("the men in their other years stay", rr.players.filter(p => p.grad > 1935).every(p => clubOf(rr, p.id)?.group === "All-Nichirin Collegiate Championship"));
const seen = new Map(); let twice = 0;
for (const t of rr.teams.filter(t => !["AVIUM", "ARTERRA"].includes(t.file))) for (const v of t.squad || []) { const id = idOf(v); if (!id) continue; if (seen.has(id)) twice++; seen.set(id, t.id); }
ok("nobody at two clubs, every squad still 22 places", twice === 0 && rr.teams.every(t => !t.squad || t.squad.length === 22 || ["AVIUM", "ARTERRA"].includes(t.file)), twice);
ok("the file reads back as it was written", JSON.stringify(JSON.parse(D.dumpDrafts([dd]))[0]) === JSON.stringify(dd));

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
