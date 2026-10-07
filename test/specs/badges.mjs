// BADGE SIZING. Every style against an even mix of all fourteen (as mixed.mjs). In each fixture the tested side gets each
// badge placement below with probability P_ON, chosen by a hash of (style, club, fixture, placement) that analysis
// recomputes; the opponents carry none. A regression of the side's net xG on the placements sizes each one, per style.
const B = process.env.MINI_ENGINE || undefined;      // undefined: the lab's own build, test/engine.mjs
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const G = { CB: ["CB"], FB: ["LB", "RB", "LWB", "RWB"], WIDE: ["LM", "RM", "LW", "RW"], DM: ["DM"], CM: ["CM"], AM: ["AM"], ST: ["ST"], GK: ["GK"] };
const grp = (...gs) => gs.flatMap(g => G[g]);
export const FACTORS = [
  ["rapid", grp("ST")], ["rapid", grp("CB")], ["rapid", grp("FB", "WIDE")], ["quickstep", grp("ST", "WIDE", "AM")],
  ["relentless", grp("FB", "DM", "CM", "AM", "WIDE", "ST")], ["aerial", grp("CB")], ["aerial", grp("ST")], ["strong", grp("ST")],
  ["firsttouch", grp("DM", "CM", "AM")], ["trickster", grp("WIDE", "AM", "ST")], ["tikitaka", grp("CB", "DM", "CM")], ["incisive", grp("CM", "AM")],
  ["longball", grp("CB", "DM")], ["crosser", grp("FB", "WIDE")], ["finisher", grp("ST", "AM")], ["longshot", grp("CM", "AM")],
  ["deadball", grp("DM", "CM", "AM")], ["vision", grp("DM", "CM", "AM")], ["composed", grp("CB", "FB", "DM", "CM", "AM", "WIDE", "ST")],
  ["tackler", grp("CB", "DM")], ["interceptor", grp("CB", "DM")], ["blocker", grp("CB", "FB")], ["disciplined", grp("CB", "FB", "DM", "CM")],
  ["shotstopper", grp("GK")], ["commanding", grp("GK")], ["+5 rating", null],
];
const P_ON = +(process.env.P_ON || 0.2);
export function u01(a, b, c, d) {
  let h = 2166136261 >>> 0;
  for (const x of [a, b, c, d]) { h = Math.imul(h ^ (x & 0xffff), 16777619) >>> 0; h = Math.imul(h ^ (x >>> 16), 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const def = (E, id) => ({ id, ...E.ME_STYLE_CANDIDATES[id] });
const build = (t, E, d) => { const r = E.meResolve(d); return { ...t, style: d.id, strategy: r.strategy, plan: r.plan }; };
const opp = (t, E, H, f) => build(t, E, def(E, ORDER[(f.k * 5 + f.ci * 3) % ORDER.length]));
const arms = ORDER.map((id, a) => ({ name: id, bundle: B, opp,
  team: (t, E, H, f) => {
    const on = FACTORS.map((_, j) => u01(a, f.ci, f.k, j) < P_ON);
    const squad = (t.squad || []).map(p => {
      const bs = [];
      FACTORS.forEach(([b, to], j) => { if (on[j] && to && to.includes(p.spos)) bs.push(b); });
      const q = { ...p };
      if (bs.length) q.badges = bs;
      if (on[FACTORS.length - 1]) q.ovr = (p.ovr ?? t.skill ?? 70) + 5;
      return q;
    });
    return build({ ...t, squad }, E, def(E, id));
  } }));
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 36), base: arms[0].name, arms };
