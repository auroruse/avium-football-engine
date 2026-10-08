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

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
