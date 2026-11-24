// EIGHTEEN MINUTES, AND THE REST OF THE TRAITS (22 November 2026), in one run; the follow-up to traits2.mjs.
//   Goals: the build as it stands ("now", twice on other dice) and with fouls in the area as they were before today
//   ("boxold": MT.boxTackleFoul 0.45, boxContactFoul 0.32), in League One and ("nt", "ntboxold") with the twelve strongest
//   national sides stood in for the clubs.
//   Traits: the seventeen of the Ball, the Body, Finishing and Defending, the five rewritten after the first run
//   (Shoulder Check, First-Time Ball, Dictates Tempo, Ball Watcher, Dwells On It), the keeper's again for a second
//   reading, and Composed, Interceptor and Man On as anchors against that run. Traits at level three, flaws at two.
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const G = { CB: ["CB"], FB: ["LB", "RB", "LWB", "RWB"], WIDE: ["LM", "RM", "LW", "RW"], DM: ["DM"], CM: ["CM"], AM: ["AM"], ST: ["ST"], GK: ["GK"] };
const grp = (...gs) => gs.flatMap(g => G[g]);
const OUTF = grp("CB", "FB", "DM", "CM", "AM", "WIDE", "ST");
export const FACTORS = [
  ["pressresistant", grp("DM", "CM", "AM")], ["ontherun", grp("WIDE", "AM", "ST")], ["disguise", grp("CM", "AM")], ["drives", grp("CB", "FB", "DM")],
  ["drawsfoul", grp("WIDE", "AM", "ST")], ["ridestackles", grp("CM", "AM", "WIDE", "ST")], ["poacher", grp("ST")], ["squares", grp("WIDE", "AM", "ST")],
  ["closesdown", grp("DM", "CM", "AM", "WIDE", "ST")], ["lastditch", grp("CB", "FB")], ["tightmarker", grp("CB", "FB", "DM")],
  ["heavytouch", OUTF], ["givesaway", OUTF], ["outoflegs", OUTF], ["greedy", grp("WIDE", "AM", "ST")], ["hothead", grp("CB", "FB", "DM", "CM")], ["losesman", grp("CB", "FB", "DM")],
  ["shouldercheck", grp("DM", "CM", "AM")], ["passandmove", grp("CM", "AM", "ST")], ["tempo", grp("CB", "DM", "CM")], ["ballwatcher", OUTF], ["dwells", OUTF],
  ["safehands", grp("GK")], ["strongwrists", grp("GK")], ["quickrelease", grp("GK")], ["penstopper", grp("GK")], ["flaps", grp("GK")], ["spills", grp("GK")],
  ["shotstopper", grp("GK")], ["commanding", grp("GK")],
  ["composed", OUTF], ["interceptor", grp("CB", "DM")], ["manon", grp("CB", "DM")],
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
    const on = FACTORS.map((_, j) => u01(a + 50, f.ci, f.k, j) < P_ON);
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
export const HASH_OFF = 50;
const NT = ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"];
const nat = (E) => NT.map(c => E.PRESET_CATALOG.find(t => t.league === "Avium International" && t.code === c)).filter(Boolean);
const ntTeam = (t, E, H, f) => { const L = nat(E); return L[f.ci % L.length]; };
const ntOpp = (t, E, H, f) => { const L = nat(E); return L[(f.ci % L.length + 1 + f.k % (L.length - 1)) % L.length]; };
const OLD = { boxTackleFoul: 0.45, boxContactFoul: 0.32 };
const goalArms = [
  { name: "now" }, { name: "now1", seed: 1 }, { name: "boxold", mt: OLD },
  { name: "nt", team: ntTeam, opp: ntOpp }, { name: "nt1", seed: 1, team: ntTeam, opp: ntOpp }, { name: "ntboxold", mt: OLD, team: ntTeam, opp: ntOpp }];
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 72), chunk: 24, base: "now", arms: [...goalArms, ...traitArms] };
