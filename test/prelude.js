const useState=()=>[],useCallback=f=>f,useRef=()=>({}),useEffect=()=>{},useMemo=f=>f(),Fragment="F";
const headerImg="",wc1933HeaderImg="",wc1934HeaderImg="";
// The preset TSVs are read for real, so PRESET_CATALOG is the same catalog the app builds.
// Anything that only needs the module to evaluate is unaffected; anything that reads a league
// now sees its actual teams instead of an empty string.
import { readFileSync } from "node:fs";
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
      varTSV=__tsv("VAR.tsv"),
      vicTSV=__tsv("VIC.tsv");
const stadiumsTSV = readFileSync("/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/src/stadiums.tsv", "utf8");
const participantsTSV = readFileSync("/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/src/participants.tsv", "utf8");
