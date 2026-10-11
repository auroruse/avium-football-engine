// WHAT EACH SKILL IS WORTH IN EACH LINE (Moukden and Kirin, 11 October 2026), for the rating a man is shown at out of
// position (test/posdrop.mjs). In every fixture each line of the tested side's eleven (its defenders, midfielders and
// forwards, as its formation lines them up) gets a push of D_SKILL points up or down in each of seven skills, and of
// D_OVR up or down in rating, each sign drawn by a hash of (club, fixture, cell) that the analysis recomputes; the
// opponents play as their sheets have them. A regression of the side's net xG on the signs reads off what a point of
// each skill is worth to each line, against what a point of rating is: test/specs/positions-fit.mjs.
//   LAB_SPEC=positions.mjs, MINI_N fixtures a club (1,200 for the full run).
export const GROUPS = ["DEF", "MID", "FWD"];
export const SKILLS = ["pace", "pass", "shoot", "tackle", "position", "strength", "touch"];
export const D_SKILL = 8, D_OVR = 4;
export const CELLS = GROUPS.flatMap(g => [...SKILLS.map(k => [g, k]), [g, "ovr"]]);
export function u01(a, b, c, d) {
  let h = 2166136261 >>> 0;
  for (const x of [a, b, c, d]) { h = Math.imul(h ^ (x & 0xffff), 16777619) >>> 0; h = Math.imul(h ^ (x >>> 16), 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const signOf = (ci, k, j) => (u01(11, ci, k, j) < 0.5 ? -1 : 1);
// The pushes ride on the engine's own trait sums (meBadgeFx): a table entry a skill and a direction.
const ensure = (E) => {
  if (E.ME_BADGES._px_pace_p) return;
  for (const k of SKILLS) for (const [s, v] of [["p", D_SKILL], ["m", -D_SKILL]])
    E.ME_BADGES[`_px_${k}_${s}`] = k === "strength" ? { strength: v, air: v } : { [k]: v };
};
const team = (t, E, H, f) => {
  ensure(E);
  const signs = CELLS.map((_, j) => signOf(f.ci, f.k, j));
  const squad = (t.squad || []).map((p, i) => {
    if (p.bench || i >= 11 || !GROUPS.includes(p.pos)) return p;
    const q = { ...p }, bs = [...(p.badges || [])];
    CELLS.forEach(([g, k], j) => { if (g !== p.pos) return;
      if (k === "ovr") q.ovr = (p.ovr ?? t.skill ?? 70) + D_OVR * signs[j]; else bs.push(`_px_${k}_${signs[j] > 0 ? "p" : "m"}`); });
    q.badges = bs;
    return q;
  });
  return { ...t, squad };
};
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 1200), chunk: 40, base: "pushed", arms: [{ name: "pushed", team }] };
