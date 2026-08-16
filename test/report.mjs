// The four fixes, checked against real matches.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
let badOvr = 0, drift = 0, saveWrong = 0, saveN = 0, abbrev = [], goalFmt = [], noFull = 0, goals = 0;
for (let k = 0; k < 12; k++) {
  const H = { ...pool[k % 12], style: "balanced", strategy: {} };                 // -10 drill penalty
  const A = { ...pool[(k + 5) % 12], style: "gegenpress", strategy: { ...eng.STYLE_PRESET.gegenpress } };
  eng.DIAG.evt = [];
  const { s, out } = eng.runPositionalMatch(H, A, 9900 + k * 7919, "home");
  // 1. base OVR survives the drill penalty and the home bump
  for (const sd of ["home", "away"]) for (const q of s.players[sd]) {
    if (q.ovr0 === undefined) badOvr++;
    else if (Math.abs(q.ovr0 - q.ovr) > 0.001) drift++;
  }
  // 2. a save event carries the KEEPER's side
  for (const [, kind, side, , , txt] of eng.DIAG.evt) {
    if (kind === "save") { saveN++;
      const gkHome = (s.players.home.find(p => p.pos === "GK")?.fullName || "");
      if (txt && gkHome && txt.startsWith(gkHome.split(" ").pop()) === false) { /* name check below */ }
      // the keeper named in the caption must belong to the side the event is tagged with
      const named = (s.players[side] || []).some(p => txt && txt.startsWith(p.fullName || p.name));
      if (!named) saveWrong++;
    }
    // 3. no abbreviated names anywhere
    if (txt && /\p{Lu}\.\s?\p{Lu}/u.test(txt)) abbrev.push(kind + ": " + txt);
    if (kind === "goal" && txt) { goals++; if (goalFmt.length < 4) goalFmt.push(txt); }
  }
  // 4. scorers carry a full name
  for (const sd of ["home", "away"]) for (const g of (out.scorers?.[sd] || [])) if (!g.full) noFull++;
}
console.log(`\n1. base OVR: ${badOvr} players missing ovr0, ${drift} where it drifted from live ovr`);
console.log(`   (drift SHOULD be non-zero: Balanced carries -10 and home advantage adds on top)`);
console.log(`2. save events tagged to the wrong side: ${saveWrong} of ${saveN}`);
console.log(`3. captions with an abbreviated name: ${abbrev.length}` + (abbrev.length ? "  e.g. " + abbrev[0] : ""));
console.log(`4. scorers missing a full name: ${noFull} of ${goals} goals`);
console.log(`   goal captions: ${goalFmt.join(" | ")}`);
