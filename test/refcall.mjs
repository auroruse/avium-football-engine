// What the referee calls (engine/referee.ts meRefJudge), over a few matches: REFCALL_N matches, REFCALL_OFF=1 for the old referee.
import * as eng from "./engine.mjs"; import fs from "node:fs";
const pool = JSON.parse(fs.readFileSync(new URL("./golden-teams.json", import.meta.url), "utf8"));
const N = +(process.env.REFCALL_N || 12); if (process.env.REFCALL_OFF) globalThis.__refOff = 1;
globalThis.__ref = [];
const T = { adv: [0, 0], back: [0, 0], fouls: [0, 0], yel: [0, 0], red: [0, 0], pens: 0, miss: [0, 0], soft: [0, 0], goals: [0, 0], softY: 0 };
for (let k = 0; k < N; k++) {
  const { out } = eng.runPositionalMatch(pool[k % pool.length], pool[(k * 7 + 3) % pool.length], 1000 + k * 7919, "home");
  ["home", "away"].forEach((sd, i) => { T.fouls[i] += out.fouls?.[sd] || 0; T.yel[i] += out.yellows?.[sd] || 0; T.red[i] += out.sendOff?.[sd]?.length || 0;
    T.adv[i] += out.advantage?.[sd] || 0; T.back[i] += out.advBack?.[sd] || 0; T.miss[i] += out.refMiss?.[sd] || 0; T.soft[i] += out.refSoft?.[sd] || 0; T.goals[i] += out.goals?.[sd] || 0; });
  T.pens += (out.feed || []).filter(f => /penalty/i.test(f.txt || "") && f.k !== "pk").length;
}
const R = globalThis.__ref, per = (a) => a.map(v => (v / N).toFixed(2)).join(" / ");
const real = R.filter(r => r.real), fair = R.filter(r => !r.real), avg = (a, f) => a.length ? (a.reduce((x, r) => x + f(r), 0) / a.length).toFixed(2) : "-";
console.log(`${N} matches, host at home${process.env.REFCALL_OFF ? " (old referee)" : ""}`);
console.log(`a match, host / visitor: fouls ${per(T.fouls)}, yellows ${per(T.yel)}, reds ${per(T.red)}, goals ${per(T.goals)}`);
console.log(`fouls not given ${per(T.miss)}; soft fouls given ${per(T.soft)}; advantage played ${per(T.adv)}, of them brought back ${per(T.back)}`);
if (R.length) {
  console.log(`real fouls judged ${real.length}: given ${(100 * real.filter(r => r.give).length / real.length).toFixed(1)}%; view mean ${avg(real, r => r.view)}, plain mean ${avg(real, r => r.plain)}, from him mean ${avg(real, r => r.d)} m`);
  for (const [nm, f] of [["by the host", r => r.host === 1], ["by the visitor", r => r.host === -1], ["in the area", r => r.box], ["view under 0.7", r => r.view < 0.7], ["view 0.9 and over", r => r.view >= 0.9]]) {
    const a = real.filter(f); console.log(`   ${nm}: ${a.length}, given ${a.length ? (100 * a.filter(r => r.give).length / a.length).toFixed(1) : "-"}%`); }
  console.log(`fair tackles judged ${fair.length}: whistled ${(100 * fair.filter(r => r.give).length / Math.max(1, fair.length)).toFixed(1)}% (host's ${fair.filter(r => r.host === 1 && r.give).length}, visitor's ${fair.filter(r => r.host === -1 && r.give).length})`);
}
