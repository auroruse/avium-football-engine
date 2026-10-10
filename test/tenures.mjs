// THE MANAGER HISTORY AGAINST THE RECORDS (src/data/spells.js). Every side and manager it names exists, every season it
// names is in the archive, each listed side's last manager is its manager now, and nobody runs two clubs or two national
// sides at once, counting every unlisted side as its current manager's since tracking began. Run after a sheet changes
// a manager: a real move goes into spells.js, a cleanup changes nothing.
//
//   node test/tenures.mjs
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MANAGER_HISTORY } from "../src/data/spells.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(ROOT, "src/data", f), "utf8"));
const teams = load("teams.json"), managers = load("managers.json");
const T = new Map(teams.map(t => [t.id, t])), M = new Map(managers.map(m => [m.id, m]));
const idOf = (v) => (v && typeof v === "object" ? v.id : v) || null;
const isNT = (t) => t.file === "AVIUM" || t.file === "ARTERRA";
// A point in time, comparable: a year opens it, a season sits where the archive files it (a World Cup first, then
// qualifying for the next one filed the year before it, then everything else), "after:" a hair past its season.
const KIND = { wc: 0, western: -0.5, eastern: -0.4, cwc: 2, cws: 2.5 };
const at = (p) => { if (/^\d{4}$/.test(p)) return +p - 0.0001;
  const after = p.startsWith("after:"), id = after ? p.slice(6) : p, [dir, y] = id.split("/");
  return +y + (KIND[dir] ?? 1) / 10 + (after ? 0.00001 : -0.00001); };
let bad = 0;
const fail = (s) => { bad++; console.log("  " + s); };
const listed = new Set();
const seats = [];   // [manager, side label, nt, from, to]
for (const h of MANAGER_HISTORY) {
  const t = h.side ? T.get(h.side) : null, label = t ? t.name : h.former?.name;
  if (h.side && !t) fail(`${h.side} (${h.name}): no such team record`);
  else if (t && t.name !== h.name) fail(`${h.side}: listed as ${h.name}, the record says ${t.name}`);
  if (h.side) listed.add(h.side);
  h.spells.forEach(([m, p], i) => {
    if (m && !M.has(m)) fail(`${label}: no manager ${m}`);
    const id = p.replace(/^after:/, "");
    if (!/^\d{4}$/.test(p) && !["md", "tsv"].some(x => existsSync(join(ROOT, "public/avium/pstats", id + "." + x)))) fail(`${label}: no archive season ${id}`);
    const to = i + 1 < h.spells.length ? at(h.spells[i + 1][1]) : Infinity;
    if (m) seats.push([m, label, h.former ? !!h.former.nt : isNT(t), at(p), to]);
  });
  const last = h.spells[h.spells.length - 1][0];
  if (t && idOf(t.manager) !== last) fail(`${label}: its last listed manager is ${M.get(last)?.name || last}, the records have ${M.get(idOf(t.manager))?.name || "nobody"}`);
}
for (const t of teams) if (!listed.has(t.id) && idOf(t.manager)) seats.push([idOf(t.manager), t.name, isNT(t), 0, Infinity]);
const by = new Map();
for (const s of seats) { const a = by.get(s[0]) || []; a.push(s); by.set(s[0], a); }
for (const [m, a] of by) for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
  const x = a[i], y = a[j];
  if (x[2] === y[2] && Math.max(x[3], y[3]) < Math.min(x[4], y[4])) fail(`${M.get(m)?.name || m} runs ${x[1]} and ${y[1]} at once`);
}
console.log(bad ? `${bad} problems` : `the manager history agrees with the records: ${MANAGER_HISTORY.length} sides with moves, ${seats.length} spells, nobody in two places`);
process.exit(bad ? 1 : 0);
