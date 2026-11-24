// THE LOOK, AND EVERY TRAIT (22 November 2026), in one run.
//   Goals: the build as it stands ("now") against the same build with the look switched off ("nolook": MT.think*,
//   touchSet, lookHold and ownMouthD at nothing), in League One as the sheets have it and, "nt"/"ntnolook", with the
//   twelve strongest national sides stood in for the clubs. Each twice, on other dice (arm.seed), for more pairs.
//   Traits: as badges.mjs sized them on 7 October. Every style against an even mix of all fourteen; in each fixture the
//   tested side gets each placement below with probability P_ON, chosen by a hash of (style, club, fixture, placement)
//   that the analysis recomputes; the opponents carry none. The first twenty-five are the old traits at their std, so
//   they are measured against today's passing errors; then the Mind and the Keeper at level three, and the flaws at two.
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const G = { CB: ["CB"], FB: ["LB", "RB", "LWB", "RWB"], WIDE: ["LM", "RM", "LW", "RW"], DM: ["DM"], CM: ["CM"], AM: ["AM"], ST: ["ST"], GK: ["GK"] };
const grp = (...gs) => gs.flatMap(g => G[g]);
const OUTF = grp("CB", "FB", "DM", "CM", "AM", "WIDE", "ST");
export const FACTORS = [
  ["rapid", grp("ST")], ["rapid", grp("CB")], ["rapid", grp("FB", "WIDE")], ["quickstep", grp("ST", "WIDE", "AM")],
  ["relentless", grp("FB", "DM", "CM", "AM", "WIDE", "ST")], ["aerial", grp("CB")], ["aerial", grp("ST")], ["strong", grp("ST")],
  ["firsttouch", grp("DM", "CM", "AM")], ["trickster", grp("WIDE", "AM", "ST")], ["tikitaka", grp("CB", "DM", "CM")], ["incisive", grp("CM", "AM")],
  ["longball", grp("CB", "DM")], ["crosser", grp("FB", "WIDE")], ["finisher", grp("ST", "AM")], ["longshot", grp("CM", "AM")],
  ["deadball", grp("DM", "CM", "AM")], ["vision", grp("DM", "CM", "AM")], ["composed", OUTF],
  ["tackler", grp("CB", "DM")], ["interceptor", grp("CB", "DM")], ["blocker", grp("CB", "FB")], ["disciplined", grp("CB", "FB", "DM", "CM")],
  ["shotstopper", grp("GK")], ["commanding", grp("GK")],
  ["shouldercheck", grp("DM", "CM", "AM")], ["passandmove", grp("CM", "AM", "ST")], ["tempo", grp("CB", "DM", "CM")], ["manon", grp("CB", "DM")],
  ["ballwatcher", OUTF], ["dwells", OUTF],
  ["safehands", grp("GK")], ["strongwrists", grp("GK")], ["quickrelease", grp("GK")], ["penstopper", grp("GK")], ["flaps", grp("GK")], ["spills", grp("GK")],
  ["+5 rating", null],
];
export const P_ON = +(process.env.P_ON || 0.2);
export { ORDER };
export function u01(a, b, c, d) {
  let h = 2166136261 >>> 0;
  for (const x of [a, b, c, d]) { h = Math.imul(h ^ (x & 0xffff), 16777619) >>> 0; h = Math.imul(h ^ (x >>> 16), 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const def = (E, id) => ({ id, ...E.ME_STYLE_CANDIDATES[id] });
const build = (t, E, d) => { const r = E.meResolve(d); return { ...t, style: d.id, strategy: r.strategy, plan: r.plan }; };
const opp = (t, E, H, f) => build(t, E, def(E, ORDER[(f.k * 5 + f.ci * 3) % ORDER.length]));
const traitArms = ORDER.map((id, a) => ({ name: id, opp,
  team: (t, E, H, f) => {
    const on = FACTORS.map((_, j) => u01(a, f.ci, f.k, j) < P_ON);
    const squad = (t.squad || []).map(p => {
      const bs = [];
      FACTORS.forEach(([b, to], j) => { if (on[j] && to && to.includes(p.spos) && !bs.includes(b)) bs.push(b); });
      const q = { ...p };
      if (bs.length) q.badges = bs;
      if (on[FACTORS.length - 1]) q.ovr = (p.ovr ?? t.skill ?? 70) + 5;
      return q;
    });
    return build({ ...t, squad }, E, def(E, id));
  } }));
const NT = ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"];
const nat = (E) => NT.map(c => E.PRESET_CATALOG.find(t => t.league === "Avium International" && t.code === c)).filter(Boolean);
const ntTeam = (t, E, H, f) => { const L = nat(E); return L[f.ci % L.length]; };
const ntOpp = (t, E, H, f) => { const L = nat(E); return L[(f.ci % L.length + 1 + f.k % (L.length - 1)) % L.length]; };
const OFF = { thinkLo: 0, thinkHi: 0, thinkMin: 0, touchSet: 0, lookHold: 0, ownMouthD: 0 };
const goalArms = [0, 1].flatMap(s => [
  { name: "now" + (s || ""), seed: s }, { name: "nolook" + (s || ""), seed: s, mt: OFF },
  { name: "nt" + (s || ""), seed: s, team: ntTeam, opp: ntOpp }, { name: "ntnolook" + (s || ""), seed: s, mt: OFF, team: ntTeam, opp: ntOpp }]);
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 72), chunk: 24, base: "now", arms: [...goalArms, ...traitArms] };
