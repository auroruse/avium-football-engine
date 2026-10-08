// PUBLISHING THE DRAFT: one commit to main on GitHub, made from the browser with the overseer's own key (a
// fine-grained token for this repository with Contents read and write, kept only in his browser). It reads the records
// as main has them NOW, lays the draft over them and writes each records file and each sheet that changed, so a
// change pushed since the page was built is kept, never overwritten. If main moves while it writes, it starts again.
import { applyDraft, draftChanges, dumpRecords } from "./draft.js";
import { sheetsFromRecords } from "./sheets.js";

const REPO = "auroruse/avium-football-engine", API = "https://api.github.com";

export async function publishDraft(draft, token, onStep = () => {}) {
  if (!token) throw new Error("No GitHub key");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const gh = async (path, opts = {}) => {
    const r = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
    if (!r.ok) {
      let msg = ""; try { msg = (await r.json()).message || ""; } catch {}
      throw Object.assign(new Error(`GitHub ${r.status}${msg ? ": " + msg : ""}`), { status: r.status });
    }
    return opts.raw ? r.text() : r.json();
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    onStep("Reading main");
    const head = (await gh(`/repos/${REPO}/git/ref/heads/main`)).object.sha;
    const tree = (await gh(`/repos/${REPO}/git/commits/${head}`)).tree.sha;
    const read = async (f) => JSON.parse(await gh(`/repos/${REPO}/contents/src/data/${f}?ref=${head}`,
      { raw: true, headers: { Accept: "application/vnd.github.raw+json" } }));
    const rec = { players: await read("players.json"), managers: await read("managers.json"),
                  teams: await read("teams.json"), sheets: await read("sheets.json") };
    const changes = draftChanges(rec, draft);
    if (!changes.length) return { sha: null, changes };
    const next = applyDraft(rec, draft);
    const files = {};
    for (const k of ["players", "managers", "teams"]) {
      const was = dumpRecords(rec[k]), now = dumpRecords(next[k]);
      if (now !== was) files[`src/data/${k}.json`] = now;
    }
    const before = sheetsFromRecords(rec), after = sheetsFromRecords(next);
    for (const f of Object.keys(after)) if (after[f] !== before[f]) files[`src/presets/${f}.tsv`] = after[f];
    onStep("Writing");
    const names = [...new Set(changes.map(c => c.name))];
    const message = `Records: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`;
    const t = await gh(`/repos/${REPO}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: tree,
      tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })) }) });
    const c = await gh(`/repos/${REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: t.sha, parents: [head] }) });
    try {
      await gh(`/repos/${REPO}/git/refs/heads/main`, { method: "PATCH", body: JSON.stringify({ sha: c.sha, force: false }) });
      return { sha: c.sha, changes, files: Object.keys(files) };
    } catch (e) {
      if (e.status === 422 && attempt < 2) continue;       // main moved under us: read it again and redo
      throw e;
    }
  }
  throw new Error("main kept moving; try again");
}
