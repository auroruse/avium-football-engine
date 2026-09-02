// FORM AND UNIT ROLES. The hub used to be a pure function of the sheet: the same man ran his side
// in every fixture at exactly the same strength, and after a substitution nobody ran it at all.
// This asks three things of meRoles, on the men who finished the match:
//
//   1. the best man in a unit LEADS IT MOST OF THE TIME AND NOT EVERY TIME -- a leadership rate
//      of 100% means the form draw is dead, under 40% means it has swamped the sheet;
//   2. every unit's roles sum to zero, because the role is redistributive and a unit that sums
//      positive has been buffed;
//   3. no side finishes without a hub while it still has a midfielder standing -- the
//      substitution and red-card refresh is the reason meRoles exists.
//
// It also prints what the hub is worth in creation -- the share of his side's chances he made
// against how much of a hub he was -- which the old system was built to deliver and never measured.
//
//   node test/roles.mjs [matches=80]
import { CFG, PRESET_CATALOG, meOvr, runPositionalMatch } from "./engine.mjs";

const N = +(process.argv[2] || 80);
const pool = PRESET_CATALOG.filter(t => t.league === "Nichirin League One" || t.league === "Nichirin League Two");
const BAND = { GK: "GK", CB: "CB", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", DM: "DM",
               CM: "CM", LM: "CM", RM: "CM", AM: "AM", LW: "W", RW: "W", ST: "ST" };
const bandOf = (p) => BAND[(p.spos || "").split("/")[0]] || ({ DEF: "CB", MID: "CM", FWD: "ST", GK: "GK" })[p.pos] || "CM";
const ovr = (p) => p.ovr0 ?? p.ovr ?? 0;

const lead = {}, sumAbs = {}, pmks = [], hubless = [], conc = [];
let sides = 0;
for (let k = 0; k < N; k++) {
  const A = pool[k % pool.length], B = pool[(k * 7 + 3) % pool.length];
  if (A === B) continue;
  const { s } = runPositionalMatch(A, B, 51e5 + k * 7919, null, false);
  for (const sd of ["home", "away"]) {
    const live = s.players[sd].filter(p => p && !p.off);
    sides++;
    // 3. a hub exists wherever a midfielder does
    const mids = live.filter(p => p.pos === "MID");
    const hub = live.reduce((h, p) => (!h || (p._pmk || 0) > (h._pmk || 0)) ? p : h, null);
    // A side whose best midfielder sits under pmkAbsLo has no hub BY DESIGN -- abs01 is zero. The
    // bug this guards is the other case: a midfielder over the floor and still nobody named.
    const o = (p) => meOvr({ ovr: p.ovr0 ?? p.ovr }) + (p._form || 0);   // the sheet, as meRoles reads it
    const overFloor = mids.some(p => o(p) > CFG.pmkAbsLo);
    if (overFloor && !(hub && hub._pmk > 0)) hubless.push(`${A.name} v ${B.name} ${sd}`);
    // ...and nobody OFF the pitch may still hold it.
    for (const p of s.players[sd]) if (p && p.off && (p._pmk > 0 || p._role)) hubless.push(`STALE ${p.name} ${sd}`);
    if (hub && hub._pmk > 0) {
      pmks.push(hub._pmk);
      const cc = live.reduce((t, p) => t + (p.cc || 0), 0);
      if (cc) conc.push([hub._pmk, (hub.cc || 0) / cc]);
      // 1. did the best midfielder on the sheet get the hub today?
      const bestMid = mids.reduce((b, p) => (!b || ovr(p) > ovr(b)) ? p : b, null);
      lead.HUB = lead.HUB || [0, 0]; lead.HUB[1]++; if (bestMid === hub) lead.HUB[0]++;
    }
    // 1 + 2, per unit
    const units = {};
    for (const p of live) (units[bandOf(p)] ||= []).push(p);
    for (const [b, g] of Object.entries(units)) {
      if (g.length < 2) continue;
      sumAbs[b] = Math.max(sumAbs[b] || 0, Math.abs(g.reduce((t, p) => t + (p._role || 0), 0)));
      const best = g.reduce((x, p) => ovr(p) > ovr(x) ? p : x);
      const top = g.reduce((x, p) => (p._role || 0) > (x._role || 0) ? p : x);
      lead[b] = lead[b] || [0, 0]; lead[b][1]++; if (best === top) lead[b][0]++;
    }
  }
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const corr = (xs, ys) => { const mx = mean(xs), my = mean(ys);
  return xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0)
       / Math.sqrt(xs.reduce((t, x) => t + (x - mx) ** 2, 0) * ys.reduce((t, y) => t + (y - my) ** 2, 0)); };

console.log(`${sides} team-matches\n`);
console.log("unit   best man led   n");
let bad = 0;
for (const b of ["HUB", "CB", "FB", "DM", "CM", "AM", "W", "ST"]) {
  if (!lead[b]) continue;
  const r = lead[b][0] / lead[b][1];
  const flag = b === "HUB" && (r >= 0.999 || r < 0.40) ? "   BAD" : "";
  if (flag) bad++;
  console.log(`${b.padEnd(5)}  ${(100 * r).toFixed(1).padStart(8)}%  ${String(lead[b][1]).padStart(4)}${flag}`);
}
const sd = Math.sqrt(mean(pmks.map(v => (v - mean(pmks)) ** 2)));
console.log(`\nhub strength  mean ${mean(pmks).toFixed(3)}  sd ${sd.toFixed(3)}  min ${Math.min(...pmks).toFixed(2)}  max ${Math.max(...pmks).toFixed(2)}`);
if (sd < 0.02) { console.log("  BAD: the hub's strength does not vary -- the form draw is not reaching it"); bad++; }
console.log(`hub's share of his side's chances  corr with _pmk ${corr(conc.map(c => c[0]), conc.map(c => c[1])).toFixed(3)}   mean share ${(100 * mean(conc.map(c => c[1]))).toFixed(1)}% of a ten-man ${(100 / 10).toFixed(0)}%`);
const worst = Math.max(0, ...Object.values(sumAbs));
console.log(`unit roles sum to zero: worst |sum| ${worst.toExponential(1)}${worst > 1e-6 ? "   BAD" : ""}`);
if (worst > 1e-6) bad++;
console.log(`sides that finished with a midfielder and no hub: ${hubless.length}${hubless.length ? "   BAD  " + hubless.slice(0, 3).join("; ") : ""}`);
if (hubless.length) bad++;
console.log(bad ? `\n${bad} check(s) failed` : "\nall roles checks hold");
process.exit(bad ? 1 : 0);
