// ŌE TRANSFER (25 November 2026): Ōe in each League One side in turn, in place of its weakest central or attacking
// midfielder (his slot, role and shape theirs), at home to the rest of the league (Dynamo, his own side, left out as an
// opponent). Shard i takes club i of the twenty; Dynamo as it is, with him, is the baseline. One JSON line per club.
//   SHARD=i/20 node test/oexfer.mjs      node test/oexfer.mjs merge <files...>
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
if (process.argv[2] === "merge") {
  const A = {};
  for (const f of process.argv.slice(3)) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.startsWith("{")) continue; const r = JSON.parse(l);
    const a = (A[r.code] ||= { ...r, m: 0, sp: 0, room: 0, sh: 0, g: 0, fk: 0, fkg: 0, mt: 0, pts: 0, tsh: 0 }); for (const k of ["m", "sp", "room", "sh", "g", "fk", "fkg", "mt", "pts", "tsh"]) a[k] += r[k]; a.d = (a.d || 0) + r.dsum; }
  console.log("club                        style          shape      slot (out)                 role       90s  ball 18-30/90  long shots/90  goals/90  conv%  avg m  team pts/match");
  for (const a of Object.values(A).sort((x, y) => y.g / y.mt - x.g / x.mt)) { const n = a.mt / 90;
    console.log(`${(a.code + " " + a.name).padEnd(27)} ${a.style.padEnd(14)} ${a.form.padEnd(10)} ${a.out.padEnd(26)} ${a.role.padEnd(9)} ${n.toFixed(0).padStart(4)} ${(a.sp / n).toFixed(2).padStart(13)} ${(a.sh / n).toFixed(2).padStart(14)} ${(a.g / n).toFixed(3).padStart(9)} ${(100 * a.g / Math.max(1, a.sh)).toFixed(1).padStart(6)} ${(a.d / Math.max(1, a.sh)).toFixed(1).padStart(6)} ${(a.pts / a.m).toFixed(2).padStart(10)}`); }
  process.exit(0);
}
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SH = (process.env.SHARD || "0/20").split("/").map(Number), M = +(process.env.OX_M || 120), CHILD = process.env.OX_CHILD, W = +(process.env.W || cpus().length);
if (CHILD == null) {
  await Promise.all(Array.from({ length: W }, (_, i) => new Promise(done => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, OX_CHILD: `${i}/${W}` }, stdio: ["ignore", "inherit", "inherit"] });
    c.on("exit", done); })));
  process.exit(0);
}
const E = await import(ROOT + "test/engine.mjs");
const [ci, cn] = CHILD.split("/").map(Number);
const L1 = E.PRESET_CATALOG.filter(t => t.league === "Nichirin League One").sort((a, b) => a.code.localeCompare(b.code));
const dym = L1.find(t => t.code === "DYM"), oe = dym.squad.find(p => p.fullName === "Rui Ōe");
const base = L1[SH[0] % L1.length];
let T = base, out0 = "-";
if (base !== dym) {
  const sq = base.squad.map(p => p); let bi = -1;
  for (let i = 0; i < 11; i++) if (sq[i] && /^(CM|AM)$/.test(sq[i].spos) && (bi < 0 || sq[i].ovr < sq[bi].ovr)) bi = i;
  out0 = `${sq[bi].spos} ${sq[bi].fullName} (${sq[bi].ovr | 0})`;
  sq[bi] = { ...oe, spos: sq[bi].spos, slot: sq[bi].slot, atkW: sq[bi].atkW };
  T = { ...base, squad: sq };
}
const opps = L1.filter(t => t !== base && t !== dym);
const r = { code: base.code, name: base.name, style: base.style || "", form: base.formation || "", out: out0, role: "", m: 0, sp: 0, room: 0, sh: 0, g: 0, fk: 0, fkg: 0, mt: 0, dsum: 0, pts: 0, tsh: 0 };
for (let j = 0; j < M; j++) { if (j % cn !== ci) continue;
  const aT = opps[j % opps.length];
  const st = E.createMatchState(); st.brain = 2; st.homeAdv = null; st.injuriesOn = true;
  st.players.home = E.meSide(T); st.players.away = E.meSide(aT);
  st.bench = { home: E.meBench(T), away: E.meBench(aT) }; st.subCap = { home: E.subCapFor(st.bench.home), away: E.subCapFor(st.bench.away) };
  st.formations = { home: T.formation || "4-3-3", away: aT.formation || "4-3-3" };
  st.strategy = { home: E.meStrategyFor(T), away: E.meStrategyFor(aT) }; st.fit = { home: E.meFitFor(T), away: E.meFitFor(aT) };
  st.mgmt = { home: T.mgmt ?? null, away: aT.mgmt ?? null }; st.styles = { home: T.style || "balanced", away: aT.style || "balanced" };
  st.teamSkill = { home: T.skill, away: aT.skill }; st.possession = "home";
  const rng = new E.RNG((4400 + SH[0] * 7919 + j * 104729) >>> 0); E.meInit(st, E.pitchSlots, rng);
  const out = E.meFreshOut(); globalThis.__shots = []; globalThis.__fk = [];
  const TT = E.ME_MATCH_TICKS + E.meAdded(st); let last = null;
  for (let t = 0; t < TT; t++) { out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out);
    const mp = st.mePos, me = st.players.home.find(q => q && !q.off && q.fullName === "Rui Ōe");
    if (me && t % 30 === 0) r.mt += 30 * 90 / TT;
    if (me && !r.role && t > 30) r.role = me._mr || "";
    const q = mp.idx >= 0 && !mp.flight && !mp.sp && mp.side === "home" ? st.players.home[mp.idx] : null;
    if (q && q === me && last !== q) { const d = Math.hypot(E.meGoalX("home") - q.x, E.ME_HALF_W - q.y);
      if (d >= 18 && d < 30) { r.sp++; let near = 99; for (const o of st.players.away) if (o && !o.off) near = Math.min(near, Math.hypot(o.x - q.x, o.y - q.y)); if (near > 4) r.room++; } }
    last = q; }
  for (const s of globalThis.__shots) if (s.side === "home" && s.nm === "Rui Ōe" && !s.hdr && s.d >= 16.5) { r.sh++; r.dsum += s.d; if (s.out === "goal") r.g++; }
  for (const f of globalThis.__fk) if (f.nm === "Rui Ōe") { r.fk++; if (f.goal) r.fkg++; }
  r.tsh += globalThis.__shots.filter(s => s.side === "home").length;
  const gH = out.goals?.home ?? out.score?.home ?? 0, gA = out.goals?.away ?? out.score?.away ?? 0; r.pts += gH > gA ? 3 : gH === gA ? 1 : 0;
  r.m++; }
console.log(JSON.stringify(r));
