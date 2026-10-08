// THE RECORDS (src/data): every player, manager and team once, squads as links to players, so a man called up is the
// same record for club and country. The sheets in src/presets are written FROM these; import builds them from the
// sheets once, and check proves the round trip by writing every sheet back and comparing it byte for byte.
//
//   node test/records.mjs import          src/presets/*.tsv -> src/data/*.json (ANCC and Slots are not squads)
//   node test/records.mjs export [dir]    src/data -> sheets (default src/presets)
//   node test/records.mjs check [dir]     export into dir (default a temp folder) and compare with src/presets
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const PRE = join(ROOT, "src/presets"), DATA = join(ROOT, "src/data");
const SKIP = new Set(["ANCC.tsv", "Slots.tsv"]);
const NATIONAL = new Set(["AVIUM", "ARTERRA"]);
const CELL = /^\((\d+(?:\.\d+)?)\)\s*(.+?)(?:\s*\[([A-Z]{2,4})\])?$/;
const isSlot = (h) => /^(SUB\s*)?#\s*\d+$/i.test(h.trim());
// Each sheet column, by its header, to the team field it holds. Slots and MANAGER are links, handled apart.
const FIELD = { "@": "at", "#": "code", "TEAM": "name", "NATION": "name", "OVR": "ovr", "PLAYSTYLE": "style",
  "FORMATION": "formation", "TIME WASTING": "timeWasting", "GK PASSING": "gkPassing", "DL BEHAVIOR": "dlBehavior",
  "HOME": "home", "AWAY": "away", "LOCATION": "location", "STADIUM": "stadium", "LEAGUE": "group", "CONFERENCE": "group",
  "CONTINENT": "group" };
const dump = (rows) => "[\n" + rows.map(r => JSON.stringify(r)).join(",\n") + "\n]\n";
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

async function importSheets() {
  const sheets = [], teams = [], players = new Map(), managers = new Map();
  const cellsOf = [];   // [team, kind, index, parsed] for the nationality pass
  for (const f of readdirSync(PRE).filter(f => f.endsWith(".tsv") && !SKIP.has(f)).sort()) {
    const raw = readFileSync(join(PRE, f), "utf8"), eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const lines = raw.split(eol), finalEol = lines[lines.length - 1] === "";
    if (finalEol) lines.pop();
    const file = f.replace(/\.tsv$/, ""), header = lines[0].split("\t");
    sheets.push({ file, header: lines[0], eol: eol === "\r\n" ? "crlf" : "lf", finalEol });
    for (const line of lines.slice(1)) {
      const c = line.split("\t");
      const t = { file, nation: NATIONAL.has(file) ? null : file === "MISC" ? null : file };
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
      if (NATIONAL.has(file)) t.nation = t.code;
      teams.push(t);
    }
  }
  // A club's own nation is the one the app gives it (MISC clubs take theirs from their competition), so an untagged
  // man is read the way the app reads him. Needs the lab bundle: zsh test/rebuild.sh.
  const E = await import(join(ROOT, "test/engine.mjs"));
  for (const t of teams.filter(t => !NATIONAL.has(t.file))) {
    const c = E.PRESET_CATALOG.find(x => x.code === t.code && x.name === t.name.trim() && !/International/.test(x.league));
    if (!c?.nat) { console.error(`no nation for ${t.code} ${t.name}`); process.exit(1); }
    t.nation = c.nat;
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
    c.all.add(m[3] || t.nation || "?");
    seen.set(key, c);
  }
  if (clash.length) { console.error("ratings disagree:\n  " + clash.join("\n  ")); process.exit(1); }
  const split = [];
  for (const [k, B] of Object.entries(book)) for (const r of B.values()) {
    const c = seen.get(k + r.name);
    r.nat = (k === "p" ? c.nt || c.tag || c.club : c.tag || c.club || c.ntm) || null;
    if (c.all.size > 1) split.push(`${r.name} (${[...c.all].join("/")})`);
  }
  const ids = (B, pre) => { let i = 0; const id = new Map(); for (const r of B.values()) { r.id = pre + String(++i).padStart(4, "0"); id.set(r.name, r.id); } return id; };
  const pid = ids(players, "p"), mid = ids(managers, "m");
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
  if (split.length) console.log(`${split.length} people carry different nationalities on different sheets (${kept} cells keep their own tag):\n  ${split.join("\n  ")}`);
  mkdirSync(DATA, { recursive: true });
  const order = (r) => ({ id: r.id, name: r.name, nat: r.nat, ovr: r.ovr });
  writeFileSync(join(DATA, "players.json"), dump([...players.values()].map(order)));
  writeFileSync(join(DATA, "managers.json"), dump([...managers.values()].map(order)));
  writeFileSync(join(DATA, "teams.json"), dump(teams));
  writeFileSync(join(DATA, "sheets.json"), dump(sheets));
  console.log(`${teams.length} teams, ${players.size} players, ${managers.size} managers -> src/data`);
}

function exportSheets(dir) {
  const players = new Map(load("players.json").map(r => [r.id, r])), managers = new Map(load("managers.json").map(r => [r.id, r]));
  const teams = load("teams.json");
  const cell = (r, t, tag) => `(${r.ovr}) ${r.name}${(tag ?? (r.nat && r.nat !== t.nation ? r.nat : "")) ? ` [${tag ?? r.nat}]` : ""}`;
  const say = (B, v, t) => v == null ? "" : typeof v === "string" ? cell(B.get(v), t) : v.raw ?? cell(B.get(v.id), t, v.tag);
  for (const s of load("sheets.json")) {
    const header = s.header.split("\t"), eol = s.eol === "crlf" ? "\r\n" : "\n", out = [s.header];
    for (const t of teams.filter(t => t.file === s.file)) {
      let k = 0;
      const c = header.map(h => {
        const H = h.trim().toUpperCase();
        if (isSlot(h)) return say(players, t.squad[k++], t);
        if (H === "MANAGER") return say(managers, t.manager, t);
        return FIELD[H] ? t[FIELD[H]] ?? "" : t.extra?.[h] ?? "";
      });
      out.push((t.cols ? c.slice(0, t.cols).concat(Array(Math.max(0, t.cols - c.length)).fill("")) : c).join("\t"));
    }
    writeFileSync(join(dir, s.file + ".tsv"), out.join(eol) + (s.finalEol ? eol : ""));
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "import") await importSheets();
else if (cmd === "export") exportSheets(arg ? resolve(arg) : PRE);
else if (cmd === "check") {
  const dir = arg ? resolve(arg) : mkdtempSync(join(tmpdir(), "records-"));
  mkdirSync(dir, { recursive: true });
  exportSheets(dir);
  let bad = 0;
  for (const s of load("sheets.json")) {
    const a = readFileSync(join(PRE, s.file + ".tsv")), b = readFileSync(join(dir, s.file + ".tsv"));
    if (Buffer.compare(a, b)) {
      bad++;
      const A = a.toString().split("\n"), B = b.toString().split("\n");
      const i = A.findIndex((l, j) => l !== B[j]);
      console.log(`${s.file}.tsv DIFFERS at line ${i + 1}\n  sheet:   ${(A[i] || "").slice(0, 300)}\n  records: ${(B[i] || "").slice(0, 300)}`);
    }
  }
  console.log(bad ? `${bad} sheets differ` : "every sheet written from the records is byte-identical to src/presets");
  process.exit(bad ? 1 : 0);
} else { console.error("usage: node test/records.mjs import | export [dir] | check [dir]"); process.exit(2); }
