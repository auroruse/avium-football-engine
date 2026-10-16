// THE NATIONS LEAGUE FINAL'S FIXES, A/B (16 October 2026): restarts priced as passes (mind/decide.ts mindRestart, the
// restart's own belief CFG.passCalS*), a quick restart only while it is still on, the receiver law for restarts, the
// coach weighing each change (match.ts meCoachSubs, CFG.subLegsW), and a substitute who comes on at halfway and is waited
// for (meSub, setpiece.ts meSPReady). The lab's own match loop on the engine now and on the last commit's
// (test/engine-head.mjs, built from it by git archive and test/rebuild.sh; never commit it), the same fixtures, so each
// metric is a paired difference.
//   FIX_FIELD=nt  the twelve strongest national sides, nl2 League Two;  LAB_SPEC=nightab.mjs, MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt", NL2 = process.env.FIX_FIELD === "nl2";
// Every throw, goal kick and free kick, on either engine: still his side's ball five seconds after it is taken (nobody of
// theirs on it in twenty slices, and a dead ball in that time a restart of his side's). Per match, as X: [kind, kept].
// ...and the expected goals each side shot in the fifteen seconds after it (sixty slices): [kind, kept, side, xG for, xG
// against].
let prev = null, live = null, rows = [], lastShot = null;
const open = [];
globalThis.__tick = (st, mp) => {
  if (mp.shot && mp.shot !== lastShot) { lastShot = mp.shot;
    for (const o of open) if (mp.tick - o.t0 <= 60) { if (mp.shot.side === o.side) o.f += mp.shot.xg || 0; else o.a += mp.shot.xg || 0; } }
  for (let i = open.length - 1; i >= 0; i--) if (mp.tick - open[i].t0 > 60) { const o = open[i]; rows.push([o.k, o.kept, o.side, +o.f.toFixed(3), +o.a.toFixed(3)]); open.splice(i, 1); }
  if (live) {
    if (mp.idx >= 0 && mp.side !== live.side) live.lost = 1;
    const dead = mp.sp && mp.tick > live.t0;
    if (dead && mp.sp.side !== live.side) live.lost = 1;
    if (dead || mp.tick - live.t0 >= 20) { live.o.kept = live.lost ? 0 : 1; live = null; }
  }
  if (!live && prev && !mp.sp && mp.passPending && ["throw", "goalkick", "freekick"].includes(mp.passPending.k)) {
    const o = { k: mp.passPending.k, side: prev.side, t0: mp.tick, f: 0, a: 0, kept: 1 };
    open.push(o); live = { k: o.k, side: o.side, t0: mp.tick, lost: 0, o };
  }
  prev = mp.sp ? { side: mp.sp.side } : null;
};
globalThis.__labRow = () => { const r = rows; rows = []; live = null; prev = null; open.length = 0; lastShot = null; return r; };
export default {
  field: NT ? "Avium International" : NL2 ? "Nichirin League Two" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 150), chunk: 25, base: "now",
  arms: [{ name: "now" }, { name: "before", bundle: "test/engine-head.mjs" }],
};
