// BEFORE RELEASE (23 November 2026): the engine as it stands, played as the app plays it, after the free kick, the
// corner and the swing were rebuilt and the traits re-sized. League One as the sheet has it ("now", three times on
// other dice) and the twelve strongest national sides stood in for the clubs ("nt", three times). Goals and where they
// come from: headers, free kicks, penalties, from range.
const NT = ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"];
const nat = (E) => NT.map(c => E.PRESET_CATALOG.find(t => t.league === "Avium International" && t.code === c)).filter(Boolean);
const ntTeam = (t, E, H, f) => { const L = nat(E); return L[f.ci % L.length]; };
const ntOpp = (t, E, H, f) => { const L = nat(E); return L[(f.ci % L.length + 1 + f.k % (L.length - 1)) % L.length]; };
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 60), chunk: 24, base: "now", arms: [
  { name: "now" }, { name: "now1", seed: 1 }, { name: "now2", seed: 2 },
  { name: "nt", team: ntTeam, opp: ntOpp }, { name: "nt1", seed: 1, team: ntTeam, opp: ntOpp }, { name: "nt2", seed: 2, team: ntTeam, opp: ntOpp }] };
