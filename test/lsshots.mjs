// LONG SHOT, HOW A CURLED STRIKE ENDS (23 November 2026). The same fixtures twice, the home side's attackers all with
// Long Shot at level three: once as config.ts has it, once with the curl taken off (LS_FLAT). Every home shot from
// outside the box is tallied by how it ended. SHARD=i/n splits the fixtures; stops itself at LS_SECS seconds.
const E = await import("./engine.mjs");
const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number), SECS = +(process.env.LS_SECS || 240), t0 = Date.now();
const L1 = E.PRESET_CATALOG.filter(t => t.league === "Nichirin League One");
const ATT = ["CM", "AM", "ST", "LW", "RW", "LM", "RM"], BASE = { ...E.ME_BADGES.longshot };
const dress = (t, ls) => ({ ...t, squad: t.squad.map(p => ({ ...p, badges: ls && ATT.includes(p.spos) ? ["longshot:3"] : [] })) });
const T = {};
for (let n = si; Date.now() - t0 < SECS * 1000; n += sn) for (const arm of ["curl", "flat"]) {
  E.ME_BADGES.longshot = arm === "flat" ? { ...BASE, curl: 0 } : BASE;
  const H = dress(L1[n % 20], true), A = dress(L1[(n * 7 + 3) % 20 === n % 20 ? (n + 1) % 20 : (n * 7 + 3) % 20], false);
  globalThis.__shots = [];
  const sr = E.simPositionalMatch(new E.RNG(9000 + n), H.skill, A.skill, false, H.style, A.style, H.formation, A.formation, "home",
    H.strategy, A.strategy, H.squad, A.squad, null, null, true, { home: null, away: null });
  const r = T[arm] = T[arm] || { m: 0, G: 0, xg: 0, sh: 0, n: 0, fr: 0, d: 0, by: {} };
  r.m++; r.G += sr.ftHome;
  for (const s of globalThis.__shots) { if (s.side !== "home") continue; r.sh++; r.xg += s.xg;
    if (!(s.sx > 16.5 || Math.abs(s.y) > 20.16)) continue;
    r.n++; r.fr += s.fr ? 1 : 0; r.d += s.d; r.by[s.out || "?"] = (r.by[s.out || "?"] || 0) + 1; }
}
console.log(JSON.stringify(T));
