// THE ATLAS'S PLACES: where every nation and city sits on the Avium Map, for the Registry's Atlas and the editors' city
// list. The map publishes its own table with every deploy (auroruse.github.io/avium-map/coordinates.tsv, with its tile
// versions beside it), and the app reads it from there when it opens, so a city added to the map is in the app as soon
// as the map is live. src/data/atlas.json is the copy the page starts from and keeps when the map cannot be reached;
// test/atlas.mjs writes it from a checkout of the map, read the same way.
export const MAP_SITE = "https://auroruse.github.io/avium-map/";

// A national side stands at its nation's label (a colony's too) and a club at its city; every city is kept, so a club
// the editor moves to another city still lands on the map.
export function atlasFrom(tsv, tiles) {
  const rows = String(tsv).replace(/\r/g, "").split("\n").filter(Boolean).map(l => l.split("\t"));
  const head = rows.shift() || [], at = ["KIND", "NAME", "TYPE", "X", "Y"].map(n => head.indexOf(n)), [K, N, TY, X, Y] = at;
  if (at.some(i => i < 0)) throw new Error("not the map's coordinates table");
  const nations = {}, cities = {};
  for (const r of rows) {
    const xy = [Math.round(+r[X]), Math.round(+r[Y])];
    if (!Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;
    if (r[K] === "label" && (r[TY] === "nation" || r[TY] === "colony")) nations[r[N]] = xy;
    if (r[K] === "city" && !(r[N] in cities)) cities[r[N]] = xy;
  }
  if (!Object.keys(cities).length || !tiles?.base || !tiles?.borders) throw new Error("the map's places came back empty");
  const sort = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));
  return { size: 6000, tiles: { base: tiles.base, borders: tiles.borders }, nations: sort(nations), cities: sort(cities) };
}

// The places as the map is deployed now. "no-cache" has the browser ask the map each time (a short answer when nothing
// has changed) instead of keeping its own copy for ten minutes.
export async function fetchAtlas(site = MAP_SITE) {
  const get = async (f) => { const r = await fetch(site + f, { cache: "no-cache" }); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r; };
  const [tsv, tiles] = await Promise.all([get("coordinates.tsv").then(r => r.text()), get("tiles.json").then(r => r.json())]);
  return atlasFrom(tsv, tiles);
}
