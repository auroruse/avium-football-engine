// THE RECORDS AS MAIN HAS THEM NOW, WITHOUT WAITING FOR THE SITE (server/worker.js GET /live). The site's bundle carries
// the records of the commit it was built from, and a build takes a minute or more, longer when saves queue, with the
// page cached up to ten minutes on top (user, 25 November 2026: "It's frustrating right now how long it takes to
// update"). So the app asks the registry what has changed on main since its own commit and lays that over the records
// it was built with; a change shows for everyone within seconds, and the bundle stays the fallback when the registry
// cannot be reached.
//
// A live patch: { v: 1, built, head, files: { <name>: { put: [records], drop: [keys] } | { all: <whole file> } | { text } } }.
// put replaces a record in place by its key or adds it at the end; drop removes one. A patch that would not rebuild the
// file exactly (records reordered, say) is sent whole instead, so applying one always gives main's file.
import { teamKey } from "./draft.js";

// The files the app reads that the registry changes, by the name a patch uses.
export const LIVE_FILES = {
  players: "src/data/players.json", managers: "src/data/managers.json", teams: "src/data/teams.json", leagues: "src/data/leagues.json",
  sheets: "src/data/sheets.json", editors: "src/data/editors.json",
  "trades/avium": "public/avium/pstats/trades.tsv", "trades/arterra": "public/arterra/pstats/trades.tsv",
};
const KEYED = { players: (r) => r.id, managers: (r) => r.id, teams: teamKey, leagues: (r) => r.id };
const isText = (name) => name.startsWith("trades/");

const putDrop = (rows, d, key) => {
  const put = new Map((d.put || []).map(r => [key(r), r])), drop = new Set(d.drop || []), seen = new Set();
  const out = [];
  for (const r of rows || []) { const k = key(r); if (drop.has(k)) continue; seen.add(k); out.push(put.get(k) || r); }
  for (const [k, r] of put) if (!seen.has(k)) out.push(r);
  return out;
};

// One file's patch from its contents at the two commits (text, as read; null for a file that is not there).
export function liveFileDiff(name, before, after) {
  if (before === after) return null;
  if (isText(name)) return { text: after ?? "" };
  const now = after == null ? null : JSON.parse(after);
  const key = KEYED[name];
  if (!key || before == null || now == null || !Array.isArray(now)) return { all: now };
  const was = JSON.parse(before), old = new Map(was.map(r => [key(r), JSON.stringify(r)])), keys = new Set(now.map(key));
  const d = { put: now.filter(r => old.get(key(r)) !== JSON.stringify(r)), drop: was.map(key).filter(k => !keys.has(k)) };
  return JSON.stringify(putDrop(was, d, key)) === JSON.stringify(now) ? d : { all: now };
}

// The records (players, managers, teams, leagues, sheets, editors as the app imports them) with a live patch laid over.
export function applyLive(rec, live) {
  const files = live?.v === 1 ? live.files : null;
  if (!files || !Object.keys(files).length) return rec;
  const out = { ...rec };
  for (const [name, d] of Object.entries(files)) {
    if (isText(name) || !(name in rec) || !d) continue;
    out[name] = "all" in d ? d.all ?? rec[name] : KEYED[name] ? putDrop(rec[name], d, KEYED[name]) : rec[name];
  }
  return out;
}

// A trades log as main has it, or null when the patch leaves the built one standing.
export const liveText = (live, name) => (live?.v === 1 && live.files?.[name] && "text" in live.files[name] ? live.files[name].text : null);
