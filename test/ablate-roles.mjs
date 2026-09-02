// WHICH ROLE TERM FLATTENS THE OVR GRADIENT. The better side's result by XI gap fell from
// 57/73/80 to 55/60/69 when form and unit roles went in. One arm per lever, paired seeds keyed to
// the fixture, so arms differ only in the lever.
//
//   node test/ablate-roles.mjs <arm> [perBand=80]     arm: full | old | recv0 | run0 | form0
import { CFG, PRESET_CATALOG, runPositionalMatch } from "./engine.mjs";

const ARMS = {
  full:  {},
  old:   { roleFormSd: 0, roleRecvW: 0, roleRunOrder: 0 },   // the system as it was
  recv0: { roleRecvW: 0 },
  run0:  { roleRunOrder: 0 },
  form0: { roleFormSd: 0 },
};
const arm = process.argv[2] || "full", PER = +(process.argv[3] || 80), SEEDS = +(process.argv[4] || 1);
if (!ARMS[arm]) { console.error("arm?"); process.exit(2); }
Object.assign(CFG, ARMS[arm]);

const pool = PRESET_CATALOG.filter(t => t.league === "Nichirin League One" || t.league === "Nichirin League Two");
const sk = (t) => Number(t.skill) || 0;
// Deterministic fixture lists per gap band: every (A,B) with the gap in band, in catalog order.
const bands = { "4-8": [4, 8], "8-14": [8, 14] };
const fx = {};
for (const [name, [lo, hi]] of Object.entries(bands)) {
  fx[name] = [];
  for (const A of pool) for (const B of pool) {
    const g = sk(A) - sk(B);
    if (g >= lo && g < hi) fx[name].push([A, B]);
  }
  // spread the sample across the list rather than taking the first PER
  const step = Math.max(1, Math.floor(fx[name].length / PER));
  fx[name] = fx[name].filter((_, i) => i % step === 0).slice(0, PER);
  // Both ways round, so the side that kicks off is not read as the better team; and SEEDS
  // replicas of each, paired by (fixture, replica) across arms.
  const both = fx[name].flatMap(([A, B]) => [[A, B, 1], [B, A, -1]]);
  fx[name] = [];
  for (let r = 0; r < SEEDS; r++) for (const f of both) fx[name].push([...f, r]);
}
const out = {};
for (const [name, list] of Object.entries(fx)) {
  let w = 0, d = 0, gf = 0, ga = 0;
  list.forEach(([A, B, sign, rep], k) => {
    const r = runPositionalMatch(A, B, 61e5 + (k * 131 + rep) * 7919, null, false).out;
    // "better side" is whoever the gap favours, whichever end he is playing from
    const bf = sign > 0 ? r.goals.home : r.goals.away, ba = sign > 0 ? r.goals.away : r.goals.home;
    if (bf > ba) w++; else if (bf === ba) d++;
    gf += bf; ga += ba;
  });
  out[name] = { n: list.length, win: w / list.length, res: (w + 0.5 * d) / list.length, gf: gf / list.length, ga: ga / list.length };
}
console.log(`${arm.padEnd(6)} ${Object.entries(out).map(([b, o]) =>
  `${b}: win ${(100 * o.win).toFixed(0)}%  result ${(100 * o.res).toFixed(0)}%  ${o.gf.toFixed(2)}-${o.ga.toFixed(2)} (n=${o.n})`).join("   |   ")}`);
