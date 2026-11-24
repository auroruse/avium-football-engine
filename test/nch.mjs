// NICHIRIN AGAINST THE WORLD (24 November 2026). Nichirin's national side against each of the twenty strongest other
// national sides, NCH_N matches apiece on a neutral ground, Nichirin listed first in half of them. One opponent a shard.
//   LAB_TEST=nch.mjs on the cloud (SHARD=i/20: shard i plays opponent i on all its cores)
//   node test/nch.mjs merge <dir>   the report, from the downloaded rows
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const N = +(process.env.NCH_N || 100), US = process.env.NCH_TEAM || "NCH";

if (process.argv[2] === "merge") {
  const dir = process.argv[3], files = fs.readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith(".jsonl")).map(f => path.join(dir, String(f)));
  const R = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l)));
  console.log(`${R.length} matches from ${files.length} files`);
  const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), avg = (a) => a.reduce((s, x) => s + x, 0) / (a.length || NaN);
  const opps = [...new Set(R.map(r => r.opp))].sort((a, b) => R.find(r => r.opp === b).oskill - R.find(r => r.opp === a).oskill);
  const line = (lab, rs) => { const w = rs.filter(r => r.gf > r.ga).length, d = rs.filter(r => r.gf === r.ga).length, l = rs.length - w - d;
    return lab.padEnd(22) + [rs.length, w, d, l].map(x => String(x).padStart(5)).join("") + f2((3 * w + d) / rs.length).padStart(7)
      + f2(avg(rs.map(r => r.gf))).padStart(7) + f2(avg(rs.map(r => r.ga))).padStart(7) + f2(avg(rs.map(r => r.xf))).padStart(7) + f2(avg(rs.map(r => r.xa))).padStart(7)
      + f1(avg(rs.map(r => r.sf))).padStart(7) + f1(avg(rs.map(r => r.sa))).padStart(7) + f1(avg(rs.map(r => r.pos))).padStart(7)
      + f1(avg(rs.map(r => r.pf))).padStart(7) + f1(avg(rs.map(r => r.pa))).padStart(7); };
  console.log("\n" + "".padEnd(22) + ["n", "W", "D", "L"].map(x => x.padStart(5)).join("") + ["ppg", "GF", "GA", "xGF", "xGA", "shF", "shA", "poss", "pass%", "opp%"].map(x => x.padStart(7)).join(""));
  for (const o of opps) { const rs = R.filter(r => r.opp === o); console.log(line(`${o} ${rs[0].oskill} ${rs[0].ostyle}`.slice(0, 21), rs)); }
  console.log(line("ALL", R));
  console.log(line("top 5 opponents", R.filter(r => opps.indexOf(r.opp) < 5)));
  console.log(line("listed first", R.filter(r => r.first))); console.log(line("listed second", R.filter(r => !r.first)));
  const byStyle = [...new Set(R.map(r => r.ostyle))];
  console.log("\nby opponent style"); for (const s of byStyle) console.log(line(s, R.filter(r => r.ostyle === s)));

  // how goals come, both ways
  const kind = (s) => s.pen ? "penalty" : s.hdr ? "header" : s.from === "cross" ? "foot, from a cross" : (s.from === "corner" || s.from === "freekick" || s.from === "throw" || s.from === "longthrow" || s.from === "set") ? "foot, set piece" : s.d >= 18 ? "foot, 18 m+" : s.d >= 11 ? "foot, 11-18 m" : "foot, inside 11 m";
  for (const [lab, us] of [["SCORED", 1], ["CONCEDED", 0]]) {
    const sh = R.flatMap(r => r.shots.filter(s => s.us === us)), g = sh.filter(s => s.out === "goal");
    const pens = R.reduce((a, r) => a + (us ? r.penF : r.penA), 0);
    console.log(`\n${lab}: ${f2(avg(R.map(r => us ? r.gf : r.ga)))} a match; shots ${f1(sh.length / R.length)} a match, ${f1(100 * g.length / sh.length)}% scored, xG a shot ${f2(avg(sh.map(s => s.xg)))}; penalties scored ${pens}`);
    const K = {}; for (const s of sh) { const k = kind(s); (K[k] ||= { n: 0, g: 0, x: 0 }); K[k].n++; K[k].x += s.xg; if (s.out === "goal") K[k].g++; }
    for (const [k, v] of Object.entries(K).sort((a, b) => b[1].g - a[1].g)) console.log("  " + k.padEnd(22) + `shots ${f1(v.n / R.length)}  goals ${f2(v.g / R.length)}  xG ${f2(v.x / R.length)}  conv ${f1(100 * v.g / v.n)}%`);
    const bands = [0, 0, 0, 0, 0, 0, 0]; for (const r of R) for (const m of (us ? r.gmF : r.gmA)) bands[Math.min(6, Math.floor(m / 15))]++;
    console.log("  by minute 0-15 .. 75-90, 90+: " + bands.map(b => f2(b / R.length)).join(" "));
  }
  // game state
  const ht = { lead: [], level: [], trail: [] };
  for (const r of R) ht[r.htf > r.hta ? "lead" : r.htf === r.hta ? "level" : "trail"].push(r);
  console.log("\nat half time"); for (const [k, rs] of Object.entries(ht)) console.log("  " + k.padEnd(8) + `${f1(100 * rs.length / R.length)}% of matches; then won ${f1(100 * rs.filter(r => r.gf > r.ga).length / rs.length)}% drew ${f1(100 * rs.filter(r => r.gf === r.ga).length / rs.length)}% lost ${f1(100 * rs.filter(r => r.gf < r.ga).length / rs.length)}%`);
  console.log(`cards a match: yellow ${f2(avg(R.map(r => r.yf)))} (opp ${f2(avg(R.map(r => r.ya)))}), red ${f2(avg(R.map(r => r.rf)))} (opp ${f2(avg(R.map(r => r.ra)))}); fouls ${f1(avg(R.map(r => r.ff)))} (opp ${f1(avg(R.map(r => r.fa)))}); corners ${f1(avg(R.map(r => r.cf)))} (opp ${f1(avg(R.map(r => r.ca)))})`);
  console.log(`matches with a Nichirin red card: ${R.filter(r => r.rf > 0).length}, ppg ${f2(avg(R.filter(r => r.rf > 0).map(r => r.gf > r.ga ? 3 : r.gf === r.ga ? 1 : 0)))}`);

  // the players
  const P = {};
  for (const r of R) for (const p of r.pl) { const q = (P[p.n] ||= { pos: p.pos, ovr: p.ovr, apps: 0, starts: 0, mins: 0, rt: 0, rn: 0, g: 0, a: 0, ch: 0, da: 0, po: 0, pf: 0, dw: 0, dl: 0, dr: 0, sv: 0 });
    q.apps++; if (p.st) q.starts++; q.mins += p.m; if (p.r) { q.rt += p.r * p.m; q.rn += p.m; } q.g += p.g; q.a += p.a; q.ch += p.ch; q.da += p.da; q.po += p.po; q.pf += p.pf; q.dw += p.dw; q.dl += p.dl; q.dr += p.dr; q.sv += p.sv; }
  console.log("\nNICHIRIN PLAYERS (per 90 unless marked)\n" + "".padEnd(22) + ["pos", "ovr", "apps", "start", "min/m", "rating", "G/90", "A/90", "ch/90", "def/90", "pass%", "duel%", "drb/90", "sv/90"].map(x => x.padStart(7)).join(""));
  const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  for (const [n, q] of Object.entries(P).sort((a, b) => (order[a[1].pos] - order[b[1].pos]) || b[1].mins - a[1].mins)) { const p9 = (v) => f2(90 * v / (q.mins || NaN));
    console.log(n.slice(0, 21).padEnd(22) + [q.pos, q.ovr, q.apps, q.starts, f1(q.mins / R.length), f2(q.rt / (q.rn || NaN)), p9(q.g), p9(q.a), p9(q.ch), p9(q.da), f1(100 * q.po / (q.po + q.pf || NaN)), f1(100 * q.dw / (q.dw + q.dl || NaN)), p9(q.dr), p9(q.sv)].map(x => String(x).padStart(7)).join("")); }
  const subs = {}; for (const r of R) for (const s of r.mgr || []) subs[s] = (subs[s] || 0) + 1;
  console.log("\nNichirin manager's moves, a match: " + Object.entries(subs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f2(v / R.length)}`).join(", "));
  const os = {}; for (const r of R) for (const s of r.oscorers) os[s] = (os[s] || 0) + 1;
  console.log("their top scorers against us: " + Object.entries(os).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(", "));
  process.exit(0);
}

const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);

if (process.env.NCH_CHILD != null) {
  const [ci, cn] = process.env.NCH_CHILD.split("/").map(Number);
  const E = await import("./engine.mjs");
  const nat = E.PRESET_CATALOG.filter(t => t.league === "Avium International" && t.squad?.length).sort((a, b) => b.skill - a.skill);
  const us = nat.find(t => t.code === US), them = nat.filter(t => t.code !== US).slice(0, 20);
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
    const rng = new E.RNG(seed >>> 0 || 7); E.meInit(st, E.pitchSlots, rng);
    const out = E.meFreshOut(); globalThis.__shots = [];
    const starters = new Set(st.players.home.concat(st.players.away).filter(Boolean).map(p => p.rid || p.name));
    let ht = null;
    for (let t = 0; t < E.ME_MATCH_TICKS + E.meAdded(st); t++) { out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out);
      if (!ht && out.min >= 46) ht = { home: out.goals.home, away: out.goals.away }; }
    E.meFinalise(st);
    return { st, out, shots: globalThis.__shots, ht: ht || { ...out.goals }, starters };
  };
  for (let k = 0; k < N; k++) { if (k % cn !== ci) continue;
    const opp = them[si]; if (!opp) break;
    const first = k % 2 === 0, [hT, aT] = first ? [us, opp] : [opp, us], u = first ? "home" : "away", o = first ? "away" : "home";
    const { st, out, shots, ht, starters } = play(hT, aT, 7e6 + si * 104729 + k * 7919);
    const S = st.stats || {}, sc = out.scorers || { home: [], away: [] };
    const pl = [...(st.players[u] || []), ...(st.subbedOff?.[u] || [])].filter(p => p && (p.mins || 0) > 0).map(p => ({ n: p.name, pos: p.pos, ovr: p.ovr0 ?? p.ovr,
      st: starters.has(p.rid || p.name) ? 1 : 0, m: +(p.mins || 0).toFixed(1), r: p.rating ? +p.rating.toFixed(2) : 0, g: p.goals || 0, a: p.assists || 0, ch: p.chances || 0,
      da: p.defActs || 0, po: p.passOk || 0, pf: p.passFail || 0, dw: p.duelWon || 0, dl: p.duelLost || 0, dr: p.dribbles || 0, sv: p.saves || 0 }));
    const pt = (x) => x.home + x.away || 1;
    console.log(JSON.stringify({ opp: opp.code, oskill: opp.skill, ostyle: opp.style, oform: opp.formation, k, first,
      gf: out.goals[u], ga: out.goals[o], htf: ht[u], hta: ht[o], xf: +(out.xgS[u] || 0).toFixed(3), xa: +(out.xgS[o] || 0).toFixed(3),
      sf: out.shots[u], sa: out.shots[o], of: out.onTarget[u], oa: out.onTarget[o], pos: +(100 * out.poss[u] / pt(out.poss)).toFixed(1),
      pf: +(100 * out.passOkSide[u] / (out.passSide[u] || 1)).toFixed(1), pa: +(100 * out.passOkSide[o] / (out.passSide[o] || 1)).toFixed(1),
      cf: out.corners[u], ca: out.corners[o], ff: out.fouls[u], fa: out.fouls[o],
      yf: S[u]?.yellows || 0, ya: S[o]?.yellows || 0, rf: S[u]?.reds || 0, ra: S[o]?.reds || 0,
      penF: sc[u].filter(s => s.pen).length, penA: sc[o].filter(s => s.pen).length,
      gmF: sc[u].map(s => s.min + (s.add || 0) * 0), gmA: sc[o].map(s => s.min),
      shots: shots.map(s => ({ us: s.side === u ? 1 : 0, d: +(+s.d || 0).toFixed(1), xg: +(+s.xg || 0).toFixed(3), hdr: s.hdr ? 1 : 0, ft: s.ft ? 1 : 0, from: s.from || "-", out: s.out || "-" }))
        .concat(sc[u].filter(s => s.pen).map(() => ({ us: 1, d: 11, xg: 0.76, pen: 1, out: "goal" }))).concat(sc[o].filter(s => s.pen).map(() => ({ us: 0, d: 11, xg: 0.76, pen: 1, out: "goal" }))),
      oscorers: sc[o].map(s => s.name), pl, mgr: (out.mgrLog?.[u] || []).map(m => m.t || m.k) }));
  }
  process.exit(0);
}

const W = Math.max(1, +(process.env.NCH_W || availableParallelism()));
await Promise.all(Array.from({ length: W }, (_, i) => new Promise((res, rej) => {
  const c = spawn("node", [fileURLToPath(import.meta.url)], { env: { ...process.env, NCH_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
  c.stdout.on("data", (b) => process.stdout.write(b));
  c.on("exit", (code) => code === 0 ? res() : rej(new Error("child " + i + " exit " + code)));
})));
