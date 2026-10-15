// THE NATIONS LEAGUE FINAL'S FIXES, A/B (16 October 2026): restarts priced as passes (mind/decide.ts mindRestart, the
// restart's own belief CFG.passCalS*), a quick restart only while it is still on, the receiver law for restarts, the
// coach weighing each change (match.ts meCoachSubs, CFG.subLegsW), and a substitute who comes on at halfway and is waited
// for (meSub, setpiece.ts meSPReady). The lab's own match loop on the engine now and on the last commit's
// (test/engine-head.mjs, built from it by git archive and test/rebuild.sh; never commit it), the same fixtures, so each
// metric is a paired difference.
//   FIX_FIELD=nt  the twelve strongest national sides;  LAB_SPEC=nightab.mjs, MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt";
// Every throw, goal kick and free kick, on either engine: still his side's ball five seconds after it is taken (nobody of
// theirs on it in twenty slices, and a dead ball in that time a restart of his side's). Per match, as X: [kind, kept].
let prev = null, live = null, rows = [];
globalThis.__tick = (st, mp) => {
  if (live) {
    if (mp.idx >= 0 && mp.side !== live.side) live.lost = 1;
    const dead = mp.sp && mp.tick > live.t0;
    if (dead && mp.sp.side !== live.side) live.lost = 1;
    if (dead || mp.tick - live.t0 >= 20) { rows.push([live.k, live.lost ? 0 : 1, live.side]); live = null; }
  }
  if (!live && prev && !mp.sp && mp.passPending && ["throw", "goalkick", "freekick"].includes(mp.passPending.k))
    live = { k: mp.passPending.k, side: prev.side, t0: mp.tick, lost: 0 };
  prev = mp.sp ? { side: mp.sp.side } : null;
};
globalThis.__labRow = () => { const r = rows; rows = []; live = null; prev = null; return r; };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 150), chunk: 25, base: "now",
  arms: [{ name: "now" }, { name: "before", bundle: "test/engine-head.mjs" }],
};
