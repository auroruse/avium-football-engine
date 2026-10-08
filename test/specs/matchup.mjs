// THE MATCHUP TABLE IN ONE RUN (src/engine/matchup.ts): every style against every other at level squads, one direction
// of each pairing, the other being the same matches seen from the other side, and each style against itself, which the
// managers' neighbour table (manager.ts ME_STYLE_ADJ) reads as well. An arm is "style|opponent's style". Styles from
// the build's ME_STYLE_CANDIDATES, each paying its price as in a real match; no managers, so nobody switches.
const B = process.env.MINI_ENGINE || undefined;      // undefined: the lab's own build, test/engine.mjs
const ORDER = ["positional", "control", "vertical", "gegenpress", "flair", "wing", "routeone", "secondball", "counter", "cholismo", "zonamista", "catenaccio", "bus", "balanced"];
const side = (id) => (t, E) => { const r = E.meResolve({ id, ...E.ME_STYLE_CANDIDATES[id] }); return { ...t, style: id, strategy: r.strategy, plan: r.plan }; };
const arms = [];
ORDER.forEach((o, i) => { for (const a of ORDER.slice(i)) arms.push({ name: `${a}|${o}`, team: side(a), opp: side(o), bundle: B }); });
export default { field: "Nichirin League One", n: +(process.env.MINI_N || 12), base: arms[0].name, arms };
