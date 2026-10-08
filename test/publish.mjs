// DOES PUBLISHING WRITE WHAT IT SHOULD? The editor's Publish against a stand-in for GitHub that serves this checkout as
// main: a draft that changes one man's rating, nation and badges must commit his record and the sheets he is on, and
// nothing else; a draft that changes nothing must commit nothing; main moving mid-write must be read again, not
// overwritten. No key and no network.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { publishDraft } from "../src/data/publish.js";
import { applyDraft, draftChanges, draftWith } from "../src/data/draft.js";
import { sheetsFromRecords } from "../src/data/sheets.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => readFileSync(ROOT + f, "utf8");
const rec = { players: JSON.parse(read("src/data/players.json")), managers: JSON.parse(read("src/data/managers.json")),
              teams: JSON.parse(read("src/data/teams.json")), sheets: JSON.parse(read("src/data/sheets.json")) };
let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${got === undefined ? "" : "   " + JSON.stringify(got)}`); };

// A man on a club sheet AND a national one, so both must be rewritten.
const both = rec.players.find(p => rec.teams.some(t => t.file === "AVIUM" && t.squad.includes(p.id)) &&
                                   rec.teams.some(t => !["AVIUM", "ARTERRA"].includes(t.file) && t.squad.includes(p.id)));
const files = [...new Set(rec.teams.filter(t => t.squad.includes(both.id)).map(t => t.file))].sort();

// The stand-in: main is this checkout; a tree POST records what would be committed; the first ref update can be refused.
function fakeGitHub({ refuseFirst = false } = {}) {
  const log = { trees: [], refs: 0, reads: 0 };
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url), m = opts.method || "GET", path = u.pathname;
    const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o, text: async () => JSON.stringify(o) });
    if (opts.headers?.Authorization !== "Bearer test-key") return json({ message: "Bad credentials" }, 401);
    if (m === "GET" && path.endsWith("/git/ref/heads/main")) { log.reads++; return json({ object: { sha: "head" + log.reads } }); }
    if (m === "GET" && path.includes("/git/commits/")) return json({ tree: { sha: "tree0" } });
    if (m === "GET" && path.includes("/contents/")) { const f = path.split("/contents/")[1]; return { ok: true, status: 200, text: async () => read(f) }; }
    if (m === "POST" && path.endsWith("/git/trees")) { log.trees.push(JSON.parse(opts.body)); return json({ sha: "newtree" }); }
    if (m === "POST" && path.endsWith("/git/commits")) { log.message = JSON.parse(opts.body).message; return json({ sha: "newcommit" }); }
    if (m === "PATCH" && path.endsWith("/git/refs/heads/main")) { log.refs++; return refuseFirst && log.refs === 1 ? json({ message: "Update is not a fast forward" }, 422) : json({}); }
    return json({ message: "unexpected " + m + " " + path }, 404);
  };
  return log;
}

const nat2 = both.nat === "NCH" ? "ELV" : "NCH";
const draft = draftWith(null, rec, both.id, { ovr: both.ovr + 2, nat: nat2, badges: ["vision", "rapid"] });
console.log(`a draft for ${both.name} (${both.id}), listed on ${files.join(", ")}`);
ok("the draft holds the three fields", Object.keys(draft.players[both.id]).sort().join() === "badges,nat,ovr");
ok("draftWith drops a field set back to the records", !("ovr" in draftWith(draft, rec, both.id, { ovr: both.ovr }).players[both.id]));
ok("three changes listed", draftChanges(rec, draft).length === 3, draftChanges(rec, draft).map(c => c.field));

let log = fakeGitHub();
const res = await publishDraft(draft, "test-key");
const committed = Object.fromEntries(log.trees[0].tree.map(e => [e.path, e.content]));
ok("commits the players file and exactly his sheets", JSON.stringify(Object.keys(committed).sort()) ===
   JSON.stringify(["src/data/players.json", ...files.map(f => `src/presets/${f}.tsv`)].sort()), Object.keys(committed));
const line = committed["src/data/players.json"].split("\n").find(l => l.includes(`"${both.id}"`));
ok("his record carries the new rating, nation and badges in table order", line ===
   JSON.stringify({ id: both.id, name: both.name, nat: nat2, ovr: both.ovr + 2, badges: ["rapid", "vision"] }) + ",", line);
const changedLines = (f) => { const a = read(`src/presets/${f}.tsv`).split("\n"), b = committed[`src/presets/${f}.tsv`].split("\n");
  return a.filter((l, i) => l !== b[i]).length; };
ok("each sheet changes on his row only", files.every(f => changedLines(f) === 1), files.map(changedLines));
ok("the sheets are the records' own export", files.every(f => committed[`src/presets/${f}.tsv`] === sheetsFromRecords(applyDraft(rec, draft))[f]));
ok("the commit names him", log.message === `Records: ${both.name}`, log.message);
ok("one ref update", log.refs === 1 && res.sha === "newcommit");

log = fakeGitHub();
const none = await publishDraft(draftWith(null, rec, both.id, { ovr: both.ovr }), "test-key");
ok("a draft that changes nothing commits nothing", none.sha === null && log.trees.length === 0);

log = fakeGitHub({ refuseFirst: true });
await publishDraft(draft, "test-key");
ok("main moving mid-write is read again, not forced", log.reads === 2 && log.refs === 2 && log.trees.length === 2);

fakeGitHub();
let err = null; try { await publishDraft(draft, ""); } catch (e) { err = e; }
ok("no key: refused before GitHub is asked", err?.message === "No GitHub key", err?.message);
err = null; try { await publishDraft(draft, "wrong-key"); } catch (e) { err = e; }
ok("a wrong key: GitHub's own refusal comes back", err?.status === 401 && /Bad credentials/.test(err.message), err?.message);

// A TEAM AND A MANAGER: Spartak Kanagawa's style and keepers changed, and a manager with other jobs put in charge two
// points higher. Commits the teams and managers files, Spartak's sheet, and the sheets of his other jobs -- on those,
// his cell and nothing else.
{
  const { teamKey, idOf } = await import("../src/data/draft.js");
  const spk = rec.teams.find(t => t.code === "SPK"), key = teamKey(spk);
  const mgr = rec.managers.find(m => rec.teams.filter(t => idOf(t.manager) === m.id).length > 1 && idOf(spk.manager) !== m.id);
  const sq = spk.squad.map(v => idOf(v) ?? null); [sq[0], sq[11]] = [sq[11], sq[0]];
  let d = draftWith(null, rec, key, { style: "Gegenpressing", manager: mgr.id, squad: sq }, "teams");
  d = draftWith(d, rec, mgr.id, { ovr: mgr.ovr + 2 }, "managers");
  const jobs = rec.teams.filter(t => idOf(t.manager) === mgr.id);
  const want = ["src/data/managers.json", "src/data/teams.json", ...new Set([spk, ...jobs].map(t => `src/presets/${t.file}.tsv`))].sort();
  console.log(`a draft for ${spk.name.trim()} under ${mgr.name}, who also manages ${jobs.map(t => t.name.trim()).join(" and ")}`);
  ok("four changes listed", draftChanges(rec, d).length === 4, draftChanges(rec, d).map(c => c.kind + "." + c.field));
  log = fakeGitHub();
  await publishDraft(d, "test-key");
  const got = Object.fromEntries(log.trees[0].tree.map(e => [e.path, e.content]));
  ok("commits teams, managers and exactly the sheets involved", JSON.stringify(Object.keys(got).sort()) === JSON.stringify(want), Object.keys(got).sort());
  ok("players untouched", !("src/data/players.json" in got));
  const rowOf = (text, code) => text.split("\n").find(l => l.split("\t")[1] === code).split("\t");
  const now = rowOf(got[`src/presets/${spk.file}.tsv`], "SPK"), was = rowOf(read(`src/presets/${spk.file}.tsv`), "SPK");
  const hdr = read(`src/presets/${spk.file}.tsv`).split("\n")[0].split("\t");
  const col = (h) => hdr.indexOf(h);
  ok("his row: the new style, manager and keepers", now[col("PLAYSTYLE")] === "Gegenpressing" && now[col("MANAGER")].includes(mgr.name)
     && now[col("#1")] === was[col("#12")] && now[col("#12")] === was[col("#1")], [now[col("PLAYSTYLE")], now[col("MANAGER")], now[col("#1")]]);
  for (const t of jobs) {
    const text = got[`src/presets/${t.file}.tsv`], H = text.split("\n")[0].split("\t"), a = rowOf(read(`src/presets/${t.file}.tsv`), t.code), b = rowOf(text, t.code);
    const diff = a.map((c, i) => c !== b[i] ? H[i] : null).filter(Boolean);
    ok(`${t.name.trim()}: only the manager cell moves, to his new rating`, diff.join() === "MANAGER" && b[H.indexOf("MANAGER")].startsWith(`(${mgr.ovr + 2}) `), b[H.indexOf("MANAGER")]);
  }
  const lines = (f) => { const x = read(f).split("\n"), y = got[f].split("\n"); return x.filter((l, i) => l !== y[i]).length; };
  ok("teams.json: one line, his; managers.json: one line, the manager's", lines("src/data/teams.json") === 1 && lines("src/data/managers.json") === 1);
}

// TRANSFERS, with the app's own position cost and slot labels (the lab bundle, so rebuild it first). Spartak Kanagawa
// releases its last substitute and signs an Alemannian club's number eleven: the signing takes the open place, the
// seller's bench fills the starting place he left, and the released man is kept as a free agent with his last position.
// Then a man on a club and a national side retires: out of both, each bench filling in, his record kept and marked.
{
  const E = await import("./engine.mjs");
  const { vacate, placeFor, without } = await import("../src/data/squads.js");
  const { teamKey, idOf } = await import("../src/data/draft.js");
  const ids = (t) => t.squad.map(v => idOf(v) ?? null);
  const labels = (t) => { const xi = E.sposFor(String(t.formation).trim()); return [...xi, ...(t.squad.length > 16 ? xi : ["GK", "CB", "CM", "CM", "ST"])].slice(0, t.squad.length); };
  const ovrOf = (id) => rec.players.find(p => p.id === id).ovr;
  const spk = rec.teams.find(t => t.code === "SPK"), seller = rec.teams.find(t => t.file === "ALE" && t.code === "LEI");
  const star = ids(seller)[10], gone = ids(spk)[15];
  let sq = vacate(ids(spk), 15, labels(spk), E.posFitCost, ovrOf);
  const at = placeFor(sq, labels(spk), E.posFitCost, labels(seller)[10]);
  sq[at] = star;
  let d = draftWith(null, rec, teamKey(spk), { squad: sq }, "teams");
  const sold = without(ids(seller), star, labels(seller), E.posFitCost, ovrOf);
  d = draftWith(d, rec, teamKey(seller), { squad: sold }, "teams");
  d = draftWith(d, rec, gone, { pos: labels(spk)[15] }, "players");
  const name = (id) => rec.players.find(p => p.id === id).name;
  console.log(`${spk.name.trim()} releases ${name(gone)} and signs ${name(star)} from ${seller.name.trim()}`);
  ok("the signing takes the open place", at === 15, labels(spk)[at]);
  const promoted = sold[10];
  ok("the seller's bench fills the starting place he left", !!promoted && ids(seller).indexOf(promoted) >= 11 && sold.filter(v => v == null).length === 1,
     `${labels(seller)[10]}: ${promoted && name(promoted)}`);
  log = fakeGitHub();
  await publishDraft(d, "test-key");
  let got = Object.fromEntries(log.trees[0].tree.map(e => [e.path, e.content]));
  ok("commits players, teams and the two clubs' sheets", JSON.stringify(Object.keys(got).sort()) ===
     JSON.stringify(["src/data/players.json", "src/data/teams.json", `src/presets/${seller.file}.tsv`, `src/presets/${spk.file}.tsv`].sort()), Object.keys(got).sort());
  const freeLine = got["src/data/players.json"].split("\n").find(l => l.includes(`"${gone}"`));
  ok("the released man is kept, with the position he last played", freeLine.includes(`"pos":"${labels(spk)[15]}"`), freeLine);
  ok("and is on no sheet any more", !Object.values(got).some(t => t.includes(`) ${name(gone)}`)) || got[`src/presets/${spk.file}.tsv`].split("\n").every(l => !l.includes(name(gone))));
  ok(`the signing appears on Spartak's sheet${rec.players.find(p => p.id === star).nat !== "NCH" ? ", tagged with his nation" : ""}`,
     got[`src/presets/${spk.file}.tsv`].includes(name(star)));

  const vet = rec.players.find(p => rec.teams.some(t => t.file === "AVIUM" && ids(t).includes(p.id)) &&
                                    rec.teams.some(t => !["AVIUM", "ARTERRA"].includes(t.file) && ids(t).includes(p.id)));
  let r = draftWith(null, rec, vet.id, { retired: true }, "players");
  const his = applyDraft(rec, r).teams.filter(t => ids(t).includes(vet.id));
  for (const t of his) r = draftWith(r, rec, teamKey(t), { squad: without(ids(t), vet.id, labels(t), E.posFitCost, ovrOf) }, "teams");
  console.log(`${vet.name} retires from ${his.map(t => t.name.trim()).join(" and ")}`);
  const after = applyDraft(rec, r);
  ok("he is on no team", !after.teams.some(t => ids(t).includes(vet.id)));
  ok("each side still puts out eleven", his.every(t => ids(after.teams.find(x => teamKey(x) === teamKey(t))).slice(0, 11).every(Boolean)));
  log = fakeGitHub();
  await publishDraft(r, "test-key");
  got = Object.fromEntries(log.trees[0].tree.map(e => [e.path, e.content]));
  ok("his record stays, marked retired", got["src/data/players.json"].split("\n").some(l => l.includes(`"${vet.id}"`) && l.includes('"retired":true')));
  ok("commits his sheets", [...new Set(his.map(t => `src/presets/${t.file}.tsv`))].every(f => f in got), Object.keys(got).sort());
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
