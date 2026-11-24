// Injuries as the engine now makes them (engine/injury.ts): how many by cause and by level, and the chances each had.
import * as eng from "./engine.mjs"; import fs from "node:fs";
const pool = JSON.parse(fs.readFileSync(new URL("./golden-teams.json", import.meta.url), "utf8"));
const N = +(process.argv[2] || 16);
globalThis.__hurt = []; globalThis.__hurtOpp = { tackle: 0, air: 0, sprint: 0 };
let fouls = 0, treatOff = 0, stuck = 0, ticks = 0, subs = 0, tm = 0, longest = 0, adv = 0;
const t0 = Date.now();
for (let k = 0; k < N; k++) {
  const { s, out } = eng.runPositionalMatch(pool[k % pool.length], pool[(k * 7 + 3) % pool.length], 3000 + k * 7919, "home");
  fouls += out.fouls.home + out.fouls.away; adv += (out.advantage?.home || 0) + (out.advantage?.away || 0);
  for (const sd of ["home", "away"]) { for (const p of s.players[sd]) if (p.treat) stuck++; treatOff += out.treated?.[sd] || 0; subs += s.subs?.[sd] || 0; }
  ticks += s.mePos.tick; tm += eng.meAdded(s);
}
const H = globalThis.__hurt, O = globalThis.__hurtOpp, by = (f) => H.reduce((o, h) => (o[f(h)] = (o[f(h)] || 0) + 1, o), {});
console.log(`${N} matches in ${((Date.now() - t0) / 1000).toFixed(0)} s; slices a match ${(ticks / N).toFixed(0)}, added ${(tm / N).toFixed(0)}`);
console.log(`a match: hurt ${(H.length / N).toFixed(2)}, off ${(H.filter(h => h.lvl === "off").length / N).toFixed(3)}, treated ${(treatOff / N).toFixed(2)}, fouls ${(fouls / N).toFixed(1)}, advantage ${(adv / N).toFixed(1)}, changes ${(subs / N).toFixed(1)}`);
console.log("by cause", by(h => h.cause), "by level", by(h => h.lvl));
console.log("off, by what", by(h => h.lvl === "off" ? h.id : "-"));
console.log(`chances a match: fair tackles at pace ${(O.tackle / N).toFixed(1)}, aerial duels ${(O.air / N).toFixed(1)}, sprint slices ${(O.sprint / N).toFixed(0)}; still off for treatment at the whistle ${stuck}`);
