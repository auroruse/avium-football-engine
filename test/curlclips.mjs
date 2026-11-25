// CURLED AND DIPPED GOALS, by kind, as the app records them (25 November 2026): Vicily, Varahmehr and Nichirin against
// the international field, every slice taped with the app's own meSnap, and every goal from a curled or dipped strike cut
// into a clip the way meCelebrate cuts one, for the app's own GIF export (meClipGif). The kind: "trivela" (curled with
// the outside of the foot, Long Shot and Trickster), "curler" (with the instep), "dipper" (Long Shot and Finisher, no
// curl), "dipcurl" (both). On the cloud lab: SHARD=i/n plays every nth match from the i-th over the runner's cores.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cpus } from "node:os";
// On the cloud lab: SHARD=i/n takes every nth match from the i-th, over the runner's cores; each clip one JSON line.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const E = await import(ROOT + "test/engine.mjs");
const N = +(process.env.OE_N || 400), W = +(process.env.W || cpus().length);
const SH = (process.env.SHARD || "0/1").split("/").map(Number);
const cat = E.PRESET_CATALOG.filter(t => t.league === "Avium International" && t.squad?.length).sort((a, b) => b.skill - a.skill);
const FEAT = ["VIC", "VAR", "NCH"].map(c => cat.find(t => t.code === c)), opp = cat.filter(t => !FEAT.includes(t)).slice(0, 24);
const short = (n) => { const p = String(n || "").trim().split(/\s+/); return p.length <= 1 ? n : p.slice(1).join(" "); };
const crest = (t) => ({ code: t.code, url: `/avium/badges/${t.code}.png`, c1: t.primaryColor || null, c2: t.secondaryColor || null });
const pack = (f) => ({ ...f, xy: Array.from(f.xy), fc: Array.from(f.fc, v => (Number.isNaN(v) ? null : v)) });
const play = (hT, aT, seed) => {
  const st = E.createMatchState(); st.brain = 2; st.homeAdv = null; st.injuriesOn = true;
  st.players.home = E.meSide(hT); st.players.away = E.meSide(aT);
  st.bench = { home: E.meBench(hT), away: E.meBench(aT) };
  st.subCap = { home: E.subCapFor(st.bench.home), away: E.subCapFor(st.bench.away) };
  st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
  st.strategy = { home: E.meStrategyFor(hT), away: E.meStrategyFor(aT) };
  st.fit = { home: E.meFitFor(hT), away: E.meFitFor(aT) };
  st.mgmt = { home: hT.mgmt ?? null, away: aT.mgmt ?? null };
  st.styles = { home: hT.style || "balanced", away: aT.style || "balanced" };
  st.teamSkill = { home: hT.skill, away: aT.skill }; st.possession = "home";
  const rng = new E.RNG(seed >>> 0); E.meInit(st, E.pitchSlots, rng);
  const out = E.meFreshOut(); globalThis.__shots = [];
  const T = E.ME_MATCH_TICKS + E.meAdded(st), tape = [], memo = {}, clips = [];
  let tl = E.meTlInit(st, out), gH = 0, gA = 0; const used = new Set();
  for (let t = 0; t < T; t++) {
    out.min = E.meMinute(t); out.add = E.meAddedMin(t);
    E.meTick(st, rng, out); E.meTlStep(st, out, tl);
    let fxNew = null, evNew = null;
    if (out.fx && out.fx.length) {
      for (const e of out.fx) if (e.k === "pass" || e.k === "head" || e.k === "shot") (evNew = evNew || []).push({ k: e.k, side: e.side, x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1 });
      fxNew = E.meFxMake(st, out.fx, memo); out.fx.length = 0; }
    const snap = E.meSnap(st, tl); if (fxNew && fxNew.length) snap.fx = fxNew; if (evNew) snap.ev = evNew; tape.push(snap); if (tape.length > 400) tape.shift();
    st.mePos._rec = 1;
    const S = globalThis.__shots;
    const side = out.goals.home > gH ? "home" : out.goals.away > gA ? "away" : null;
    if (side) {
      gH = out.goals.home; gA = out.goals.away;
      // the strike that scored it: the one shot marked a goal that no earlier goal has claimed
      let gi = -1; for (let i = S.length - 1; i >= 0; i--) if (S[i].out === "goal" && !used.has(i)) { gi = i; break; }
      if (gi >= 0) used.add(gi);
      const R = gi >= 0 ? S[gi] : null, kind = !R || R.hdr ? null : R.cu === -1 ? "trivela" : R.dip && R.cu ? "dipcurl" : R.dip ? "dipper" : R.cu === 1 ? "curler" : null;
      if (kind && R.side === side) { const lastDip = gi;
        const frames = tape.slice(E.meClipFrom(tape, side)), last = frames[frames.length - 1];
        const sc = (out.scorers?.[side] || []).slice(-1)[0];
        clips.push({ k: seed, kind, who: R.nm, vs: aT.name, d: +S[lastDip].d.toFixed(1), dip: S[lastDip].dip, gkd: S[lastDip].gkd,
          clip: { min: out.min, add: out.add || 0, side, frames: frames.map(pack), txt: null, hn: hT.name, an: aT.name, comp: null,
            hb: crest(hT), ab: crest(aT), scorer: sc ? (sc.full || sc.name) : R.nm, assist: sc?.assist || null, score: `${gH}-${gA}`,
            chain: E.meChain(st, frames), end: { x: last.bx, y: last.by },
            names: ["home", "away"].flatMap(sd => Array.from({ length: 11 }, (_, i) => { const p = st.players[sd][i]; return p ? short(p.fullName || p.name) : ""; })),
            gk: ["home", "away"].flatMap(sd => Array.from({ length: 11 }, (_, i) => st.players[sd][i]?.pos === "GK")), pen: false } });
      }
    }
  }
  return clips;
};
if (process.env.CHILD != null) {
  const [ci, cn] = process.env.CHILD.split("/").map(Number);
  let j = 0;
  for (let k = 0; k < N; k++) { if (k % SH[1] !== SH[0]) continue; if ((j++) % cn !== ci) continue; for (const c of play(FEAT[k % 3], opp[Math.floor(k / 3) % opp.length], 4242 + k * 7919)) console.log(JSON.stringify(c)); }
  process.exit(0);
}
// the shard's matches over this runner's cores, each child's lines passed on whole
await Promise.all(Array.from({ length: W }, (_, i) => new Promise(done => {
  const c = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
  let buf = ""; c.stdout.on("data", b => { buf += b; const j = buf.lastIndexOf("\n"); if (j < 0) return; process.stdout.write(buf.slice(0, j + 1)); buf = buf.slice(j + 1); });
  c.on("exit", done); })));
