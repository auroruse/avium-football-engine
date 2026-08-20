const useState=()=>[],useCallback=f=>f,useRef=()=>({}),useEffect=()=>{},useMemo=f=>f(),Fragment="F";
const headerImg="",wc1933HeaderImg="",wc1934HeaderImg="";
// The preset TSVs are read for real, so PRESET_CATALOG is the same catalog the app builds.
// Anything that only needs the module to evaluate is unaffected; anything that reads a league
// now sees its actual teams instead of an empty string.
import { readFileSync, readdirSync, existsSync } from "node:fs";
const require_fs_shim = { readdirSync, existsSync };
const __tsv = (f) => readFileSync("/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/src/presets/" + f, "utf8");
const aviumTSV=__tsv("AVIUM.tsv"),
      aleTSV=__tsv("ALE.tsv"),
      arvTSV=__tsv("ARV.tsv"),
      elvTSV=__tsv("ELV.tsv"),
      karTSV=__tsv("KAR.tsv"),
      kfkTSV=__tsv("KFK.tsv"),
      kkmTSV=__tsv("KKM.tsv"),
      nchTSV=__tsv("NCH.tsv"),
      rudTSV=__tsv("RUD.tsv"),
      shiTSV=__tsv("SHI.tsv"),
      turTSV=__tsv("TUR.tsv"),
      varTSV=__tsv("VAR.tsv"),
      vicTSV=__tsv("VIC.tsv");
const stadiumsTSV = readFileSync("/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/src/stadiums.tsv", "utf8");
const participantsTSV = readFileSync("/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/src/participants.tsv", "utf8");

// The stadium manifest is a Vite virtual module (see vite.config.js), and rebuild.sh strips every
// import -- so without this it is a free variable and a ReferenceError waiting for the first harness
// that touches the stadium browser. Read off the same directory the plugin reads.
const STADIUM_IMAGES = (() => {
  const { readdirSync, existsSync } = require_fs_shim;
  const d = "/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/public/stadiums";
  return existsSync(d) ? readdirSync(d).filter(f => /\.(jpe?g)$/i.test(f))
    .map(f => f.replace(/\.(jpe?g)$/i, "").normalize("NFC")).sort() : [];
})();

// Same story as STADIUM_IMAGES: virtual:pstats is stripped with the imports, so the harness
// reads the directory itself.
const PSTATS_FILES = (() => {
  const { readdirSync, existsSync } = require_fs_shim;
  const d = "/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/public/pstats";
  return existsSync(d) ? readdirSync(d, { recursive: true })
    .map(f => String(f).replace(/\\/g, "/")).filter(f => /\.tsv$/i.test(f))
    .map(f => f.normalize("NFC")).sort() : [];
})();
