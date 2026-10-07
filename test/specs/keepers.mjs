// KEEPER BADGES, PAIRED. Every fixture is played three times -- the tested side's keeper with no badge, with Shot Stopper,
// with Commanding -- against an even mix of styles, so each badge's worth is a paired difference on the same matches. The
// factorial (badges.mjs) gives each keeper badge to one man in a fifth of its matches, which reads a keeper's worth to
// about +-3 rating points; this is the instrument for the keepers.
const B = process.env.MINI_ENGINE || undefined;
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const def = (E, id) => ({ id, ...E.ME_STYLE_CANDIDATES[id] });
const build = (t, E, d) => { const r = E.meResolve(d); return { ...t, style: d.id, strategy: r.strategy, plan: r.plan }; };
const opp = (t, E, H, f) => build(t, E, def(E, ORDER[(f.k * 5 + f.ci * 3) % ORDER.length]));
const me = (badge) => (t, E, H, f) => {
  const b = build(t, E, def(E, ORDER[(f.k * 3 + f.ci * 7 + 1) % ORDER.length]));
  return badge ? { ...b, squad: (b.squad || []).map(p => (p.spos === "GK" ? { ...p, badges: [badge] } : p)) } : b;
};
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 150), base: "none", opp,
  arms: [{ name: "none", team: me(null) }, { name: "shotstopper", team: me("shotstopper") }, { name: "commanding", team: me("commanding") }].map(a => ({ ...a, bundle: B })) };
