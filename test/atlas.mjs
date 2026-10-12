// THE ATLAS'S PLACES, the copy the app is built with: where every nation and city sits on the Avium Map, read off the
// map's own coordinates (Programs/Avium Map/src/data/coordinates.tsv, beside this repo) and its tile versions, and
// written to src/data/atlas.json by the same reading the app uses (src/data/atlas.js). The app follows the deployed map
// by itself when it opens; this copy is what it shows until then, and whenever the map cannot be reached.
//
//   node test/atlas.mjs [path/to/Avium Map]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { atlasFrom } from "../src/data/atlas.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAP = process.argv[2] || join(ROOT, "../Avium Map");
const out = atlasFrom(readFileSync(join(MAP, "src/data/coordinates.tsv"), "utf8"), JSON.parse(readFileSync(join(MAP, "src/data/tiles.json"), "utf8")));
writeFileSync(join(ROOT, "src/data/atlas.json"), JSON.stringify(out) + "\n");
console.log(`atlas: ${Object.keys(out.nations).length} nations, ${Object.keys(out.cities).length} cities`);
