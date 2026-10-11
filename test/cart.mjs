// THE CART'S ITEMS (src/data/cart.js), on the real records: a cart holding a transfer, a release, a call-up, a rating,
// a retirement, a manager's move and a change of positions must list seven items, with a transfer's two clubs, a
// retired man's teams and a manager's two clubs each one item; and removing any item must put back exactly what it
// changed, leaving the rest of the cart as it was. (A man's positions are his own since 11 October 2026: a move writes
// none, and a change to them is an item like any other.)
//
//   node test/cart.mjs        (bundles src/data with esbuild first)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "cart-")), ENTRY = join(DIR, "entry.js"), OUT = join(DIR, "cart.mjs");
writeFileSync(ENTRY, ["data/cart.js", "data/draft.js", "data/squads.js", "data/positions.js"].map(f => `export * from ${JSON.stringify(join(ROOT, "src", f))};`).join("\n")
  + `\nexport { sposFor } from ${JSON.stringify(join(ROOT, "src/engine/formations.ts"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const { cartItems, withoutItem, applyDraft, draftSize, draftWith, idOf, teamKey, vacate, placeFor, without, posFitCost, slotLabels, sposFor } = await import(pathToFileURL(OUT).href);

let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${got === undefined ? "" : "   " + JSON.stringify(got)}`); };
const rec = Object.fromEntries(["players", "managers", "teams", "sheets"].map(k => [k, JSON.parse(readFileSync(join(ROOT, `src/data/${k}.json`), "utf8"))]));
const byKey = new Map(rec.teams.map(t => [teamKey(t), t])), ovr = new Map(rec.players.map(p => [p.id, p.ovr]));
const ids = (t) => t.squad.map(v => idOf(v) ?? null), lab = (t) => slotLabels(sposFor, String(t.formation).trim(), t.squad.length);
const ovrOf = (id) => ovr.get(id) ?? 0, nat = (t) => t.file === "AVIUM" || t.file === "ARTERRA";
const team = (f) => rec.teams.find(f);

// The cart, built the way the app builds each change.
const A = team(t => t.file === "ALE" && t.code === "LEI"), B = team(t => t.file === "SKJ"), C = team(t => t.file === "ALE" && t.code === "ARM");
const N = team(t => t.file === "AVIUM" && t.code === "SKJ"), F = team(t => t.file === "ALE" && t.code === "HAN"), G = team(t => t.file === "KAR");
const used = new Set([A, B, C, N, F, G].map(teamKey));
const clubOf = new Map(), ntOf = new Map();
for (const t of rec.teams) for (const id of ids(t)) if (id) (nat(t) ? ntOf : clubOf).set(id, t);
const Z = rec.players.find(p => clubOf.has(p.id) && ntOf.has(p.id) && !used.has(teamKey(clubOf.get(p.id))) && !used.has(teamKey(ntOf.get(p.id)))).id;
const D = clubOf.get(Z), E = ntOf.get(Z), Y = ids(A)[3];
let d = { v: 1, players: {} };
// 1. A transfer: A's number 10 to B, whose last bench man is released to make room.
const star = ids(A)[10], r1 = ids(B)[15];
let sqB = vacate(ids(B), 15, lab(B), posFitCost, ovrOf); sqB[placeFor(sqB, lab(B), posFitCost, lab(A)[10])] = star;
d = draftWith(d, rec, teamKey(B), { squad: sqB }, "teams");
d = draftWith(d, rec, teamKey(A), { squad: without(ids(A), star, lab(A), posFitCost, ovrOf) }, "teams");
// 2. A release from C.
const x = ids(C)[14];
d = draftWith(d, rec, teamKey(C), { squad: vacate(ids(C), 14, lab(C), posFitCost, ovrOf) }, "teams");
// 3. A call-up: N drops its last man for another of its nationals.
const callee = rec.players.find(p => p.nat === N.code && !p.retired && !ids(N).includes(p.id)).id, sqN = ids(N); sqN[21] = callee;
d = draftWith(d, rec, teamKey(N), { squad: sqN }, "teams");
// 4. A rating.
d = draftWith(d, rec, Y, { ovr: ovrOf(Y) + 1 }, "players");
// 5. A retirement: out of his club and his country.
d = draftWith(d, rec, Z, { retired: true }, "players");
for (const t of [D, E]) d = draftWith(d, rec, teamKey(t), { squad: without(ids(t), Z, lab(t), posFitCost, ovrOf) }, "teams");
// 6. F's manager moves to G.
const M = idOf(F.manager);
d = draftWith(d, rec, teamKey(G), { manager: M }, "teams");
d = draftWith(d, rec, teamKey(F), { manager: null }, "teams");
// 7. A change of positions, for a man nothing else in the cart touches.
const P = ids(A)[2], P0 = rec.players.find(p => p.id === P).pos;
d = draftWith(d, rec, P, { pos: [...P0, P0[0] === "DM" ? "CM" : "DM"].slice(0, 2) }, "players");

const items = cartItems(rec, d), keys = (it) => it.groups.map(g => g.key).sort().join(" ");
const want = { transfer: [A, B].map(t => "teams:" + teamKey(t)), release: ["teams:" + teamKey(C)], callup: ["teams:" + teamKey(N)], rating: ["players:" + Y],
               retire: ["players:" + Z, "teams:" + teamKey(D), "teams:" + teamKey(E)], manager: [F, G].map(t => "teams:" + teamKey(t)), positions: ["players:" + P] };
const itemFor = (k) => items.find(it => keys(it) === want[k].sort().join(" "));
ok("seven items", items.length === 7, items.map(keys));
for (const k of Object.keys(want)) ok(`the ${k} is one item`, !!itemFor(k));
ok("a move writes no positions", !items.some(it => it.groups.some(g => g.id === r1 || g.id === x)));

const at = (draft, id) => applyDraft(rec, draft).teams.filter(t => ids(t).includes(id)).map(teamKey).sort();
const rest = (draft, gone) => cartItems(rec, draft).map(keys).sort().join("|") === items.filter(it => it !== gone).map(keys).sort().join("|");
let w = withoutItem(rec, d, itemFor("transfer"));
ok("without the transfer: he is back at his club, in his slot", JSON.stringify(at(w, star)) === JSON.stringify(at({}, star)) && ids(applyDraft(rec, w).teams.find(t => teamKey(t) === teamKey(A)))[10] === star);
ok("...the man released for him is back", at(w, r1).includes(teamKey(B)) && !w.players[r1]);
ok("...and the rest of the cart is as it was", rest(w, itemFor("transfer")));
w = withoutItem(rec, d, itemFor("release"));
ok("without the release: he is back", at(w, x).includes(teamKey(C)) && !w.players[x] && rest(w, itemFor("release")));
w = withoutItem(rec, d, itemFor("retire"));
ok("without the retirement: back with club and country, not retired", JSON.stringify(at(w, Z)) === JSON.stringify(at({}, Z)) && !w.players[Z] && rest(w, itemFor("retire")));
w = withoutItem(rec, d, itemFor("manager"));
ok("without the manager's move: both clubs as they were", !w.teams?.[teamKey(F)] && !w.teams?.[teamKey(G)] && rest(w, itemFor("manager")));
w = withoutItem(rec, d, itemFor("rating"));
ok("without the rating: only that goes", !w.players[Y] && rest(w, itemFor("rating")));
w = withoutItem(rec, d, itemFor("positions"));
ok("without the positions: only that goes", !w.players[P] && rest(w, itemFor("positions")));
let all = d;
for (const it of items) all = withoutItem(rec, all, it);
ok("removing every item empties the cart", draftSize(all) === 0, all);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
