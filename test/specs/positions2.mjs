// WHAT EACH SKILL IS WORTH IN EACH KIND OF SLOT (Moukden and Kirin, 12 October 2026). positions.mjs measured it by line,
// and the check (positions-check.mjs) showed a line is too coarse: a centre-back in a central midfielder's slot cost
// about a point, where the midfield line's weights said four, because the line's shooting weight belongs to its
// attacking midfielders and wide men, not to a holding or central one. So the same design, by the kind of slot a man
// fills: in every fixture each kind's men in the tested side's eleven get a push of D_SKILL up or down in each of
// seven skills and of D_OVR in rating, each sign a hash of (club, fixture, cell); a regression on goal difference reads
// off each skill's worth to each kind of slot (test/specs/positions-fit.mjs <file> gd kinds).
//   LAB_SPEC=positions2.mjs, MINI_N fixtures a club.
export const KINDS = ["CB", "FB", "DM", "CM", "AM", "W", "ST"];
export const KIND_OF = { CB: "CB", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", DM: "DM", CM: "CM", AM: "AM", LM: "W", RM: "W", LW: "W", RW: "W", ST: "ST" };
export const SKILLS = ["pace", "pass", "shoot", "tackle", "position", "strength", "touch"];
export const D_SKILL = 8, D_OVR = 4;
export const CELLS = KINDS.flatMap(g => [...SKILLS.map(k => [g, k]), [g, "ovr"]]);
export function u01(a, b, c, d) {
  let h = 2166136261 >>> 0;
  for (const x of [a, b, c, d]) { h = Math.imul(h ^ (x & 0xffff), 16777619) >>> 0; h = Math.imul(h ^ (x >>> 16), 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const signOf = (ci, k, j) => (u01(13, ci, k, j) < 0.5 ? -1 : 1);
const ensure = (E) => {
  if (E.ME_BADGES._px_pace_p) return;
  for (const k of SKILLS) for (const [s, v] of [["p", D_SKILL], ["m", -D_SKILL]])
    E.ME_BADGES[`_px_${k}_${s}`] = k === "strength" ? { strength: v, air: v } : { [k]: v };
};
const team = (t, E, H, f) => {
  ensure(E);
  const signs = CELLS.map((_, j) => signOf(f.ci, f.k, j));
  const squad = (t.squad || []).map((p, i) => {
    const kind = KIND_OF[p.spos];
    if (p.bench || i >= 11 || !kind) return p;
    const q = { ...p }, bs = [...(p.badges || [])];
    CELLS.forEach(([g, k], j) => { if (g !== kind) return;
      if (k === "ovr") q.ovr = (p.ovr ?? t.skill ?? 70) + D_OVR * signs[j]; else bs.push(`_px_${k}_${signs[j] > 0 ? "p" : "m"}`); });
    q.badges = bs;
    return q;
  });
  return { ...t, squad };
};
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 3000), chunk: 60, base: "pushed", arms: [{ name: "pushed", team }] };
