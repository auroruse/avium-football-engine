const useState=()=>[],useCallback=f=>f,useRef=()=>({}),useEffect=()=>{},useMemo=f=>f(),Fragment="F";
const headerImg="",wc1933HeaderImg="",wc1934HeaderImg="";
// THE RECORDS (src/data) are read for real, so PRESET_CATALOG is the same catalog the app builds from them.
// Anything that only needs the module to evaluate is unaffected; anything that reads a league sees its actual teams.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath as __f2p } from "node:url";
import { sheetsFromRecords } from "../src/data/sheets.js";
import { leagueMaps } from "../src/data/leagues.js";
import { rollSquad } from "../src/data/roll.js";
import { applyDraft, draftChanges, draftSize, draftWith, idOf, teamKey } from "../src/data/draft.js";
import { BADGES, BADGE_BY_ID, badgeOrder } from "../src/data/badges.js";
import { STYLE_LBL } from "../src/data/styles.js";
import { isNational, owns, planSave } from "../src/data/rules.js";
import { cartItems, withoutItem } from "../src/data/cart.js";
import { placeFor, vacate, without } from "../src/data/squads.js";
import { GROUP_NAME, POSITIONS, POS_ROLE, fitsPlace, ovrAt, ownFor, posDrop, posFitCost, posList, posText } from "../src/data/positions.js";
// The repository, wherever it is checked out: every bundle built with this prelude sits in test/.
const __root = __f2p(new URL("..", import.meta.url));
const require_fs_shim = { readdirSync, existsSync };
const __rec = (f) => JSON.parse(readFileSync(__root + "src/data/" + f, "utf8"));
const playersRec = __rec("players.json"), managersRec = __rec("managers.json"),
      teamsRec = __rec("teams.json"), sheetsRec = __rec("sheets.json"), leaguesRec = __rec("leagues.json"), editorsRec = __rec("editors.json"),
      atlasRec = __rec("atlas.json");
// The sheets in src/presets are written FROM the records, for the tools that still read sheets. One edited by hand
// never reaches the app, and every tool reading it would quietly disagree with the app -- so no harness loads then.
{
  // ANCC.tsv is a cup field and Slots.tsv a formation-to-slot lookup: not squads, and not in the records.
  const NOT_A_PRESET = ["ANCC.tsv", "Slots.tsv"];
  const S = sheetsFromRecords({ players: playersRec, managers: managersRec, teams: teamsRec, sheets: sheetsRec });
  const stale = readdirSync(__root + "src/presets").filter(f => f.endsWith(".tsv") && !NOT_A_PRESET.includes(f))
    .filter(f => S[f.replace(/\.tsv$/, "")] !== readFileSync(__root + "src/presets/" + f, "utf8"));
  if (stale.length) throw new Error(`src/presets/${stale.join(", ")} no longer match the records in src/data. A sheet edited by hand: "node test/records.mjs import" brings it in; if the records were edited, "node test/records.mjs export" rewrites the sheets.`);
}
const stadiumsTSV = readFileSync(__root + "src/stadiums.tsv", "utf8");
const participantsTSV = readFileSync(__root + "src/participants.tsv", "utf8");

// The stadium manifest is a Vite virtual module (see vite.config.js), and rebuild.sh strips every
// import -- so without this it is a free variable and a ReferenceError waiting for the first harness
// that touches the stadium browser. Read off the same directory the plugin reads.
const STADIUM_IMAGES = (() => {
  const { readdirSync, existsSync } = require_fs_shim;
  const d = __root + "public/avium/stadiums";
  return existsSync(d) ? readdirSync(d).filter(f => /\.(jpe?g)$/i.test(f))
    .map(f => f.replace(/\.(jpe?g)$/i, "").normalize("NFC")).sort() : [];
})();

// Same story as STADIUM_IMAGES: virtual:pstats is stripped with the imports, so the harness
// reads the directory itself.
const PSTATS_FILES = (() => {
  const { readdirSync, existsSync } = require_fs_shim;
  const d = __root + "public/avium/pstats";
  return existsSync(d) ? readdirSync(d, { recursive: true })
    .map(f => String(f).replace(/\\/g, "/")).filter(f => /\.(tsv|md)$/i.test(f) && !/README\.md$/i.test(f))
    .map(f => f.normalize("NFC")).sort() : [];
})();
