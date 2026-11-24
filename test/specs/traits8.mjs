// LONG SHOT THAT CURLS IT (23 November 2026; the user: "make long shot give holders the ability to curve shots outside of
// the box. Also make them more likely to attempt long shots"). Three settings side by side, each written at level three
// as config.ts would give it: longshot is the table as it stands (range 8, farW 0.08, curl 0.5 at its std of two); lsB
// shoots a little less (range 7, farW 0.05); lsC shoots as often as before the change (range 6, farW 0.03) and only
// curls. The bundle reads an unknown trait at level zero, so lsB and lsC ride on two other std-two traits nobody else
// holds here (the squads are stripped): Incisive and First Touch, their tables replaced for this run. A side holds at
// most one of the three (GROUP), so no man carries two settings at once.
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const G = { CB: ["CB"], FB: ["LB", "RB", "LWB", "RWB"], W: ["LM", "RM", "LW", "RW"], DM: ["DM"], CM: ["CM"], AM: ["AM"], ST: ["ST"], GK: ["GK"] };
const grp = (s) => (s === "ALL" ? "CB FB DM CM AM W ST" : s).split(" ").flatMap(g => G[g]);
const AT = { longshot: "CM AM ST W", lsB: "CM AM ST W", lsC: "CM AM ST W", composed: "ALL" };
const GROUP = ["longshot", "lsB", "lsC"], GP = 0.22;
// Third round (LS_ROUND=3): the shot valued for its curl (curlP) instead of a flat urge. longshot as config.ts has it
// (curlP 0.6, farW 0.03); lsB with no flat urge at all (farW 0); lsC valued at half (curlP 0.3).
const ROUND = process.env.LS_ROUND || "1";
const EXTRA = ROUND === "3" ? { incisive: { range: 6, farShot: 0.15, farW: 0, curl: 0.5, curlP: 0.6 }, firsttouch: { range: 6, farShot: 0.15, farW: 0.03, curl: 0.5, curlP: 0.3 } }
  : ROUND === "2" ? { longshot: { range: 7, farShot: 0.15, farW: 0.05, curl: 0.8 }, incisive: { range: 7, farShot: 0.3, farW: 0.05, curl: 0.5 }, firsttouch: { range: 7, farShot: 0.3, farW: 0.05, curl: 0.8 } }
  : { incisive: { range: 7, farShot: 0.15, farW: 0.05, curl: 0.5 }, firsttouch: { range: 6, farShot: 0.15, farW: 0.03, curl: 0.5 } };
const RIDE = { lsB: "incisive", lsC: "firsttouch" };
const FLAW_AT = {};
// [name, positions, the trait key a man carries, or a number: rating points added]
export const LINES = { GK: grp("GK"), DEF: grp("CB FB"), MID: grp("DM CM AM"), ATT: grp("W ST") };
export const FACTORS = [
  ...Object.entries(AT).map(([b, s]) => [b, grp(s), b + ":3"]),
  ...Object.entries(FLAW_AT).map(([b, s]) => [b, grp(s), b + ":2"]),
  ...Object.entries(LINES).map(([l, to]) => ["+5 " + l, to, 5]),
];
export const FLAWS = Object.keys(FLAW_AT);
export const P_ON = +(process.env.P_ON || 0.5);
export { ORDER };
export function u01(a, b, c, d) {
  let h = 2166136261 >>> 0;
  for (const x of [a, b, c, d]) { h = Math.imul(h ^ (x & 0xffff), 16777619) >>> 0; h = Math.imul(h ^ (x >>> 16), 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
// Which placements a side has in a fixture: its own draw (HASH_OFF) and its opponent's (HASH_OPP), from the style, the
// club and the fixture number alone, so the reading afterwards rebuilds them without the records carrying them.
export const HASH_OFF = 850 + 200 * ((+process.env.LS_ROUND || 1) - 1), HASH_OPP = HASH_OFF + 100;
export const onOf = (off, a, ci, k) => { const g = Math.floor(u01(a + off, ci, k, 99) / GP);
  return FACTORS.map(([b], j) => (GROUP.includes(b) ? GROUP.indexOf(b) === g : u01(a + off, ci, k, j) < P_ON)); };
const dress = (t, on, E) => (Object.assign(E.ME_BADGES, EXTRA), { ...t, squad: (t.squad || []).map(p => {
  const q = { ...p, badges: [] };
  FACTORS.forEach(([, to, what], j) => { if (!on[j] || !to.includes(p.spos)) return;
    if (typeof what === "number") q.ovr = (q.ovr ?? t.skill ?? 70) + what; else q.badges.push(what.replace(/^(lsB|lsC)/, m => RIDE[m])); });
  return q;
}) });
const def = (E, id) => ({ id, ...E.ME_STYLE_CANDIDATES[id] });
const build = (t, E, d) => { const r = E.meResolve(d); return { ...t, style: d.id, strategy: r.strategy, plan: r.plan }; };
const arms = ORDER.map((id, a) => ({ name: id,
  team: (t, E, H, f) => build(dress(t, onOf(HASH_OFF, a, f.ci, f.k), E), E, def(E, id)),
  opp: (t, E, H, f) => build(dress(t, onOf(HASH_OPP, a, f.ci, f.k), E), E, def(E, ORDER[(f.k * 5 + f.ci * 3) % ORDER.length])) }));
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 60), chunk: 24, base: ORDER[0], arms };
