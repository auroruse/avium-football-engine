// THE ATLAS'S PLACES: where every nation and city sits on the Avium Map, for the Registry's front page. Read off the map's
// own coordinates (Programs/Avium Map/src/data/coordinates.tsv, beside this repo) and its tile versions, and written to
// src/data/atlas.json. A national side stands at its nation's label and a club at its city; every city is kept, so a
// club the editor moves to another city still lands on the map. Run it again when the map's places or tiles change.
//
//   node test/atlas.mjs [path/to/Avium Map]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAP = process.argv[2] || join(ROOT, "../Avium Map");
const rows = readFileSync(join(MAP, "src/data/coordinates.tsv"), "utf8").replace(/\r/g, "").split("\n").filter(Boolean).map(l => l.split("\t"));
const head = rows.shift(), col = (n) => head.indexOf(n);
const [K, N, TY, X, Y] = ["KIND", "NAME", "TYPE", "X", "Y"].map(col);
const nations = {}, cities = {};
for (const r of rows) {
  const xy = [Math.round(+r[X]), Math.round(+r[Y])];
  if (!Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;
  if (r[K] === "label" && (r[TY] === "nation" || r[TY] === "colony")) nations[r[N]] = xy;
  if (r[K] === "city" && !(r[N] in cities)) cities[r[N]] = xy;
}
const tiles = JSON.parse(readFileSync(join(MAP, "src/data/tiles.json"), "utf8"));
const sort = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));
const out = { size: 6000, tiles: { base: tiles.base, borders: tiles.borders }, nations: sort(nations), cities: sort(cities) };
writeFileSync(join(ROOT, "src/data/atlas.json"), JSON.stringify(out) + "\n");
console.log(`atlas: ${Object.keys(nations).length} nations, ${Object.keys(cities).length} cities`);
