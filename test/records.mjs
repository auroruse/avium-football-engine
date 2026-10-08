// THE RECORDS (src/data): every player, manager and team once, squads as links to players, so a man called up is the
// same record for club and country. The app reads these (App.tsx, through src/data/sheets.js); the sheets in
// src/presets are written FROM them for the tools that still read sheets, and must never be edited by hand.
//
//   node test/records.mjs import          src/presets/*.tsv -> src/data/*.json, keeping every existing ID
//   node test/records.mjs export [dir]    src/data -> the sheets (default src/presets)
//   node test/records.mjs check           do the sheets in src/presets match the records, byte for byte?
//
// import is how a sheet-sized change still gets in (a pasted squad): edit the sheet, import, and the same people keep
// their IDs; a new name is a new record. ANCC and Slots are not squads.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIELD, isSlot, sheetsFromRecords } from "../src/data/sheets.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const PRE = join(ROOT, "src/presets"), DATA = join(ROOT, "src/data");
const SKIP = new Set(["ANCC.tsv", "Slots.tsv"]);
const NATIONAL = new Set(["AVIUM", "ARTERRA"]);
const CELL = /^\((\d+(?:\.\d+)?)\)\s*(.+?)(?:\s*\[([A-Z]{2,4})\])?$/;
const dump = (rows) => "[\n" + rows.map(r => JSON.stringify(r)).join(",\n") + "\n]\n";
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const records = () => ({ players: load("players.json"), managers: load("managers.json"), teams: load("teams.json"), sheets: load("sheets.json") });

function importSheets() {
  const had = existsSync(join(DATA, "players.json")) ? records() : null;
  const sheets = [], teams = [], players = new Map(), managers = new Map();
  const cellsOf = [];   // [team, kind, index, parsed, as written] for the nationality pass
  for (const f of readdirSync(PRE).filter(f => f.endsWith(".tsv") && !SKIP.has(f)).sort()) {
    const raw = readFileSync(join(PRE, f), "utf8"), eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const lines = raw.split(eol), finalEol = lines[lines.length - 1] === "";
    if (finalEol) lines.pop();
    const file = f.replace(/\.tsv$/, ""), header = lines[0].split("\t");
    sheets.push({ file, header: lines[0], eol: eol === "\r\n" ? "crlf" : "lf", finalEol });
    for (const line of lines.slice(1)) {
      const c = line.split("\t");
      const t = { file, nation: null };
      header.forEach((h, i) => {
        const v = c[i] ?? "", H = h.trim().toUpperCase();
        if (isSlot(h)) {
          (t.squad ??= []);
          const m = CELL.exec(v.trim());
          if (!v.trim()) t.squad.push(null);
          else if (!m) t.squad.push({ raw: v });
          else { t.squad.push(m[2]); cellsOf.push([t, "p", t.squad.length - 1, m, v]); }
        } else if (H === "MANAGER") {
          const m = CELL.exec(v.trim());
          t.manager = !v.trim() ? null : m ? m[2] : { raw: v };
          if (m) cellsOf.push([t, "m", 0, m, v]);
        } else if (FIELD[H]) t[FIELD[H]] = v;
        else (t.extra ??= {})[h] = v;
      });
      if (c.length !== header.length) t.cols = c.length;
      teams.push(t);
    }
  }
  // A team's own nation: a national side is its code, a club on a nation's sheet that nation, and a club on the mixed
  // sheet (MISC) the nation of its competition, as the app reads it -- known from the records already there.
  const compNat = {};
  for (const t of had?.teams || []) if (t.file === "MISC" && t.nation) compNat[t.group] = t.nation;
  for (const t of teams) {
    t.nation = NATIONAL.has(t.file) ? t.code : t.file !== "MISC" ? t.file : compNat[t.group] ?? null;
    if (!t.nation) { console.error(`no nation for ${t.code} ${t.name.trim()}: a new competition on MISC.tsv ("${t.group}"). Add its nation to compNat in test/records.mjs.`); process.exit(1); }
  }
  // One record a person. A rating must agree wherever he is listed, or the import stops. His nationality is the
  // national side he plays for, else his tag, else his club's nation (a manager: tag, club, national side); a sheet
  // that tags him otherwise keeps its own tag on that one cell, and the man is listed for a ruling.
  const book = { p: players, m: managers }, clash = [], seen = new Map();
  for (const [t, k, , m] of cellsOf) {
    const B = book[k], ovr = +m[1], key = k + m[2];
    if (!B.has(m[2])) B.set(m[2], { name: m[2], nat: null, ovr });
    else if (B.get(m[2]).ovr !== ovr) clash.push(`${m[2]}: rated ${B.get(m[2]).ovr} and ${ovr}`);
    const c = seen.get(key) || { nt: null, tag: null, club: null, all: new Set() };
    if (NATIONAL.has(t.file) && k === "p") c.nt = t.code;
    if (m[3]) c.tag = c.tag || m[3];
    if (!NATIONAL.has(t.file) && !m[3]) c.club = c.club || t.nation;
    if (NATIONAL.has(t.file) && k === "m" && !m[3]) c.ntm = c.ntm || t.code;
    c.all.add(m[3] || t.nation);
    seen.set(key, c);
  }
  if (clash.length) { console.error("ratings disagree:\n  " + clash.join("\n  ")); process.exit(1); }
  const split = [];
  for (const [k, B] of Object.entries(book)) for (const r of B.values()) {
    const c = seen.get(k + r.name);
    r.nat = (k === "p" ? c.nt || c.tag || c.club : c.tag || c.club || c.ntm) || null;
    if (c.all.size > 1) split.push(`${r.name} (${[...c.all].join("/")})`);
  }
  // IDs never change: a name the records already hold keeps its ID, and a new one takes the next free number.
  const ids = (B, pre, old) => {
    const id = new Map((old || []).map(r => [r.name, r.id]));
    let next = Math.max(0, ...(old || []).map(r => +r.id.slice(1)));
    for (const r of B.values()) { r.id = id.get(r.name) ?? pre + String(++next).padStart(4, "0"); id.set(r.name, r.id); }
    return id;
  };
  const pid = ids(players, "p", had?.players), mid = ids(managers, "m", had?.managers);
  let kept = 0;
  const link = (t, B, id, m, v) => {
    const r = B.get(m[2]), want = r.nat && r.nat !== t.nation ? r.nat : "", has = m[3] || "";
    if (`(${r.ovr}) ${r.name}${has ? ` [${has}]` : ""}` !== v) { kept++; return { id: id.get(m[2]), raw: v }; }   // stray spacing
    if (want === has) return id.get(m[2]);
    kept++; return { id: id.get(m[2]), tag: has };
  };
  for (const [t, k, i, m, v] of cellsOf) {
    if (k === "p") t.squad[i] = link(t, players, pid, m, v); else t.manager = link(t, managers, mid, m, v);
  }
  if (split.length) console.log(`${split.length} people carry different nationalities on different sheets (${kept} cells keep their own text):\n  ${split.join("\n  ")}`);
  const byId = (a, b) => +a.id.slice(1) - +b.id.slice(1);
  const order = (r) => ({ id: r.id, name: r.name, nat: r.nat, ovr: r.ovr });
  if (had) {
    const gone = (o, B) => o.filter(r => ![...B.values()].some(x => x.id === r.id)).length;
    const fresh = (o, B) => [...B.values()].filter(r => !o.some(x => x.id === r.id)).length;
    console.log(`players: ${fresh(had.players, players)} new, ${gone(had.players, players)} no longer on any sheet; managers: ${fresh(had.managers, managers)} new, ${gone(had.managers, managers)} gone`);
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, "players.json"), dump([...players.values()].sort(byId).map(order)));
  writeFileSync(join(DATA, "managers.json"), dump([...managers.values()].sort(byId).map(order)));
  writeFileSync(join(DATA, "teams.json"), dump(teams));
  writeFileSync(join(DATA, "sheets.json"), dump(sheets));
  console.log(`${teams.length} teams, ${players.size} players, ${managers.size} managers -> src/data`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "import") importSheets();
else if (cmd === "export") {
  const dir = arg ? resolve(arg) : PRE, S = sheetsFromRecords(records());
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(S)) writeFileSync(join(dir, file + ".tsv"), text);
  console.log(`${Object.keys(S).length} sheets written to ${dir}`);
} else if (cmd === "check") {
  const S = sheetsFromRecords(records());
  let bad = 0;
  for (const [file, text] of Object.entries(S)) {
    const disk = readFileSync(join(PRE, file + ".tsv"), "utf8");
    if (disk === text) continue;
    bad++;
    const A = disk.split("\n"), B = text.split("\n"), i = A.findIndex((l, j) => l !== B[j]);
    console.log(`${file}.tsv DIFFERS at line ${i + 1}\n  sheet:   ${(A[i] || "").slice(0, 300)}\n  records: ${(B[i] || "").slice(0, 300)}`);
  }
  const extra = readdirSync(PRE).filter(f => f.endsWith(".tsv") && !SKIP.has(f) && !(f.replace(/\.tsv$/, "") in S));
  for (const f of extra) { bad++; console.log(`${f} has no records: import it`); }
  console.log(bad ? `${bad} sheets differ from the records` : "every sheet written from the records is byte-identical to src/presets");
  process.exit(bad ? 1 : 0);
} else { console.error("usage: node test/records.mjs import | export [dir] | check"); process.exit(2); }
