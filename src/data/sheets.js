// THE SHEETS, WRITTEN FROM THE RECORDS. players.json, managers.json and teams.json hold every person and team once,
// squads as links to players; sheets.json keeps each preset sheet's header and line endings. This turns them back
// into each sheet's text, byte for byte what src/presets holds, so the app parses exactly what it always has
// (App.tsx reads the records through it), and test/records.mjs writes and checks the sheets with the same code.

// A squad column: #1..#16 on a club sheet, #1..#11 then SUB #1..SUB #11 on a national one.
export const isSlot = (h) => /^(SUB\s*)?#\s*\d+$/i.test(h.trim());
// Each sheet column, by its header, to the team field that holds it. Squad columns and MANAGER are links.
export const FIELD = { "@": "at", "#": "code", "TEAM": "name", "NATION": "name", "OVR": "ovr", "PLAYSTYLE": "style",
  "FORMATION": "formation", "TIME WASTING": "timeWasting", "GK PASSING": "gkPassing", "DL BEHAVIOR": "dlBehavior",
  "HOME": "home", "AWAY": "away", "LOCATION": "location", "STADIUM": "stadium", "LEAGUE": "group", "CONFERENCE": "group",
  "CONTINENT": "group" };

// A club sheet's columns, for a nation whose first league is made in the Editor and so has no sheet yet.
export const CLUB_HEADER = ["@", "#", "TEAM", "OVR", "PLAYSTYLE", "FORMATION", "TIME WASTING", "GK PASSING", "DL BEHAVIOR", "MANAGER",
  ...Array.from({ length: 16 }, (_, i) => "#" + (i + 1)), "HOME", "AWAY", "LOCATION", "STADIUM", "LEAGUE"].join("\t");

// { players, managers, teams, sheets } -> { AVIUM: "<the sheet's text>", NCH: ..., ... }; a team on a file with no sheet
// yet gets a club sheet of its own.
export function sheetsFromRecords({ players, managers, teams, sheets }) {
  const P = new Map(players.map(r => [r.id, r])), M = new Map(managers.map(r => [r.id, r]));
  // "(84) Jordan STANFORD [ELV]": the nation is written when it is not the team's own. A link that carries its own
  // tag keeps it (a sheet that tags a man with his club's nation), and one that carries raw text is written as is.
  const cell = (r, t, tag) => {
    const nat = tag ?? (r.nat && r.nat !== t.nation ? r.nat : "");
    return `(${r.ovr}) ${r.name}${nat ? ` [${nat}]` : ""}`;
  };
  const say = (B, v, t) => v == null ? "" : typeof v === "string" ? cell(B.get(v), t) : v.raw ?? cell(B.get(v.id), t, v.tag);
  const byFile = {};
  for (const t of teams) (byFile[t.file] = byFile[t.file] || []).push(t);
  const out = {}, known = new Set(sheets.map(s => s.file));
  const all = [...sheets, ...Object.keys(byFile).filter(f => !known.has(f)).sort().map(file => ({ file, header: CLUB_HEADER, eol: "lf", finalEol: false }))];
  for (const s of all) {
    const header = s.header.split("\t"), eol = s.eol === "crlf" ? "\r\n" : "\n", lines = [s.header];
    for (const t of byFile[s.file] || []) {
      let k = 0;
      const c = header.map(h => {
        const H = h.trim().toUpperCase();
        if (isSlot(h)) return say(P, t.squad[k++], t);
        if (H === "MANAGER") return say(M, t.manager, t);
        return FIELD[H] ? t[FIELD[H]] ?? "" : t.extra?.[h] ?? "";
      });
      // A row the sheet left short (or long) keeps its own width.
      lines.push((t.cols ? c.slice(0, t.cols).concat(Array(Math.max(0, t.cols - c.length)).fill("")) : c).join("\t"));
    }
    out[s.file] = lines.join(eol) + (s.finalEol ? eol : "");
  }
  return out;
}
