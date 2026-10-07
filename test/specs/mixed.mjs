// EVERY STYLE AGAINST AN EVEN MIX OF ALL FOURTEEN: each fixture's opponent plays one of the fourteen in turn, so 240
// matches give every arm about seventeen against each. Styles from the build's ME_STYLE_CANDIDATES, with overrides
// from VARIANTS (JSON: { name: { id, phases: {...}, levers: {...} } }) as extra arms.
const B = process.env.MINI_ENGINE || undefined;      // undefined: the lab's own build, test/engine.mjs
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const OVR = process.env.FIELD ? JSON.parse(process.env.FIELD) : {};     // field definitions overriding the build's
const def = (E, id) => { const d = { id, ...E.ME_STYLE_CANDIDATES[id] }; const o = OVR[id]; if (o) { d.phases = { ...d.phases, ...(o.phases || {}) }; d.levers = { ...(o.levers ?? d.levers) }; } return d; };
const build = (t, E, d) => { const r = E.meResolve(d); return { ...t, style: d.id, strategy: r.strategy, plan: r.plan }; };
const opp = (t, E, H, f) => build(t, E, def(E, ORDER[(f.k * 5 + f.ci * 3) % ORDER.length]));
const arms = [];
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : ORDER;
for (const id of ONLY) arms.push({ name: id, team: (t, E) => build(t, E, def(E, id)) });
const V = process.env.VARIANTS ? JSON.parse(process.env.VARIANTS) : {};
for (const [name, v] of Object.entries(V)) arms.push({ name, team: (t, E) => { const d = def(E, v.id); if (v.phases) d.phases = { ...d.phases, ...v.phases }; if (v.levers) d.levers = { ...v.levers }; return build(t, E, d); } });
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 12), base: arms[0].name, opp, arms: arms.map(a => ({ ...a, bundle: B })) };
