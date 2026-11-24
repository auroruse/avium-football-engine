// FINISHER, LONG SHOT AND PREDATORY AFTER THEY WERE CUT (23 November 2026; config.ts), Composed beside them as an anchor.
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const G = { CB: ["CB"], FB: ["LB", "RB", "LWB", "RWB"], W: ["LM", "RM", "LW", "RW"], DM: ["DM"], CM: ["CM"], AM: ["AM"], ST: ["ST"], GK: ["GK"] };
const grp = (s) => (s === "ALL" ? "CB FB DM CM AM W ST" : s).split(" ").flatMap(g => G[g]);
const AT = { finisher: "ST AM", longshot: "CM AM ST W", poacher: "ST", composed: "ALL" };
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
export const HASH_OFF = 650, HASH_OPP = 750;
export const onOf = (off, a, ci, k) => FACTORS.map((_, j) => u01(a + off, ci, k, j) < P_ON);
const dress = (t, on) => ({ ...t, squad: (t.squad || []).map(p => {
  const q = { ...p, badges: [] };
  FACTORS.forEach(([, to, what], j) => { if (!on[j] || !to.includes(p.spos)) return;
    if (typeof what === "number") q.ovr = (q.ovr ?? t.skill ?? 70) + what; else q.badges.push(what); });
  return q;
}) });
const def = (E, id) => ({ id, ...E.ME_STYLE_CANDIDATES[id] });
const build = (t, E, d) => { const r = E.meResolve(d); return { ...t, style: d.id, strategy: r.strategy, plan: r.plan }; };
const arms = ORDER.map((id, a) => ({ name: id,
  team: (t, E, H, f) => build(dress(t, onOf(HASH_OFF, a, f.ci, f.k)), E, def(E, id)),
  opp: (t, E, H, f) => build(dress(t, onOf(HASH_OPP, a, f.ci, f.k)), E, def(E, ORDER[(f.k * 5 + f.ci * 3) % ORDER.length])) }));
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 60), chunk: 24, base: ORDER[0], arms };
