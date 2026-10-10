// THE MOCKUPS: the screens DESIGN.md describes, drawn from the real records and season archive, so a design is judged on
// the data it will actually carry. Writes design/mock/home.html and design/mock/club.html next to this file.
//
//   node design/mock/build.mjs
//   MOCK_OUT=<dir> node design/mock/build.mjs     a trial copy elsewhere, to check before the real files change
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const HERE = fileURLToPath(new URL(".", import.meta.url)), OUT = process.env.MOCK_OUT || HERE;
const txt = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r/g, "");
const json = (p) => JSON.parse(txt(p));
const has = (p) => existsSync(join(ROOT, p));
const ASSET = "../../public/avium/";                    // from design/mock/ to the app's pictures
const PST = "public/avium/pstats/";

const teams = json("src/data/teams.json"), players = json("src/data/players.json"), managers = json("src/data/managers.json");
const atlas = json("src/data/atlas.json");
const P = new Map(players.map(p => [p.id, p])), M = new Map(managers.map(m => [m.id, m]));
const NT = teams.filter(t => t.file === "AVIUM" || t.file === "ARTERRA");
const CLUBS = teams.filter(t => t.file !== "AVIUM" && t.file !== "ARTERRA" && t.group !== "Custom");
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const byName = new Map([...CLUBS, ...NT].map(t => [fold(t.name), t]));
const ntByCode = new Map(NT.map(t => [t.code, t]));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Display rules the app already has ──────────────────────────────────────────────────────────
const showOvr = (v) => String(Math.round(Number(v)));
const METAL = [[90, "m-iri"], [85, "m-amethyst"], [80, "m-emerald"], [75, "m-gold"], [65, "m-silver"], [-1e9, "m-copper"]];
const badge = (v, cls = "") => { const n = Math.round(Number(v)); return `<span class="badge ${METAL.find(([m]) => n >= m)[1]} ${cls}">${n}</span>`; };
const rateCls = (r) => r >= 9 ? "r9" : r >= 8 ? "r8" : r >= 7 ? "r7" : r >= 6.5 ? "r65" : r >= 6 ? "r6" : r >= 5 ? "r5" : "rlo";
const word = (w) => /\p{L}/u.test(w) && w === w.toUpperCase() && w !== w.toLowerCase()
  ? w.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : w;
const display = (raw) => String(raw).trim().split(/\s+/).map(word).join(" ");
const surname = (raw) => { const caps = String(raw).trim().split(/\s+/).filter(w => /\p{L}/u.test(w) && w === w.toUpperCase());
  return (caps.length ? caps : String(raw).trim().split(/\s+/).slice(-1)).map(word).join(" "); };
const ordinal = (k) => { const s = ["th", "st", "nd", "rd"], v = k % 100; return k + (s[(v - 20) % 10] || s[v] || s[0]); };
const posCls = (p) => p === "GK" ? "gk" : /B$|CB|WB/.test(p) ? "df" : /M$|CM|DM|AM|LM|RM/.test(p) ? "mf" : p === "SUB" ? "" : "fw";
const lum = (hex) => { const h = hex.replace("#", ""); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

const crestSrc = (t) => t && has(`public/avium/badges/${t.code}.png`) ? `${ASSET}badges/${t.code}.png` : null;
const crest = (t, cls = "") => { const s = crestSrc(t); return s ? `<img class="crest ${cls}" src="${s}" alt="">` : `<span class="crest ${cls}"></span>`; };
const named = (name) => byName.get(fold(name));
const teamCell = (name, cls = "") => { const t = named(name); return `<div class="tc">${crest(t, cls)}<span>${esc(t ? t.name : name)}</span></div>`; };
const leagueLogo = (name) => has(`public/avium/leagues/${name}.png`) ? `<img class="crest" src="${ASSET}leagues/${esc(name)}.png" alt="">` : "";
const portrait = (name) => { const f = `public/avium/players/${name.normalize("NFC")}.png`; return has(f) ? `${ASSET}players/${esc(name)}.png` : null; };

// ── Icons: inline, 1.5px stroke, round caps ────────────────────────────────────────────────────
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', fwd: '<path d="M9 18l6-6-6-6"/>', caret: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  play: '<path d="M5 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', same: '<path d="M6 12h12"/>',
};
const icon = (k, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

// ── The season archive ─────────────────────────────────────────────────────────────────────────
const md = (p) => txt(PST + p).split("\n");
const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
// The table that follows a heading, as rows of cells (the header and the rule dropped).
const tableAfter = (lines, heading) => {
  let i = lines.findIndex(l => l.trim() === heading); if (i < 0) return [];
  while (i < lines.length && !lines[i].trim().startsWith("|")) i++;
  const out = []; for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) out.push(cells(lines[i]));
  return out;
};
const finalTable = (lines) => {
  let i = lines.findIndex(l => l.trim() === "## Final Table"); if (i < 0) return [];
  while (i < lines.length && !lines[i].trim().startsWith("|")) i++;
  const head = cells(lines[i]), at = (k) => head.indexOf(k), rows = tableAfter(lines, "## Final Table");
  return rows.map(r => ({ pos: +r[at("#")], name: r[at("Team")].replace(/\*\*/g, "").trim(), p: +r[at("P")], w: +r[at("W")], d: +r[at("D")],
    l: +r[at("L")], gf: at("GF") < 0 ? null : +r[at("GF")], ga: at("GA") < 0 ? null : +r[at("GA")], gd: r[at("GD")], pts: +r[at("Pts")], of: rows.length }));
};
// Every match line under each heading: { stage, home, away, score, winner }.
const matches = (lines) => {
  const out = []; let stage = "";
  for (const l of lines) {
    if (/^#{2,3} /.test(l)) { stage = l.replace(/^#+\s*/, "").replace(/^Round \d+ — /, "").trim(); continue; }
    if (!l.trim().startsWith("|") || !/ vs /.test(l)) continue;
    const c = cells(l), m = c[0].match(/^(.*?) vs (.*)$/); if (!m) continue;
    const bare = (s) => s.replace(/\*\*/g, "").trim();
    const winner = /^\*\*/.test(m[1].trim()) ? bare(m[1]) : /^\*\*/.test(m[2].trim()) ? bare(m[2]) : null;
    out.push({ stage, home: bare(m[1]), away: bare(m[2]), score: c[c.length - 1], winner });
  }
  return out;
};
const goals = (s) => { const m = String(s).match(/(\d+)\s*-\s*(\d+)/); return m ? [+m[1], +m[2]] : null; };
const outcome = (m, me) => { const g = goals(m.score); if (!g) return "d"; const [a, b] = m.home === me ? g : [g[1], g[0]];
  if (m.winner) return m.winner === me ? "w" : "l"; return a > b ? "w" : a < b ? "l" : "d"; };
const scoreFor = (m, me) => { const g = goals(m.score); if (!g) return m.score; const [a, b] = m.home === me ? g : [g[1], g[0]];
  const tail = String(m.score).replace(/^\s*\d+\s*-\s*\d+/, ""); return `${a}-${b}${tail}`; };
// A one-off competition's winner: the final's bold side, its score, and the beaten finalist.
const finalOf = (comp, season) => {
  const lines = md(`${comp}/${season}.md`), all = matches(lines);
  const ms = ["Grand Final Reset", "Grand Final", "Final"].map(st => all.filter(m => m.stage === st)).find(a => a.length) || [];
  const m = ms[ms.length - 1]; if (!m) return null;
  const named = (lines.slice(lines.findIndex(l => /^#{2,3} Final\s*$/.test(l))).join("\n").match(/\*\*Winner:\s*(.+?)\*\*/) || [])[1];
  const w = m.winner || named || (outcome(m, m.home) === "w" ? m.home : m.away);
  return { winner: w, loser: w === m.home ? m.away : m.home, score: m.winner ? scoreFor(m, w) : m.score };
};
const latest = (comp) => readdirSync(join(ROOT, PST, comp)).filter(f => /^\d{4}\.md$/.test(f)).map(f => f.slice(0, 4)).sort().pop();
// The six leaderboards, side by side in one TSV, each block cut off by an empty column. Older files carry
// #, PLAYER, POS, TEAM, GP and the figure; newer ones add ST and MIN before it. The figure is always the block's last column.
const boards = (p) => {
  const rows = txt(PST + p).split("\n").filter(Boolean).map(l => l.split("\t")), head = rows.shift(), out = {};
  let start = 0;
  for (let i = 0; i <= head.length; i++) {
    if (i < head.length && head[i] !== "") continue;
    const blk = head.slice(start, i), at = (k) => start + blk.indexOf(k), key = blk[blk.length - 1];
    if (blk.length >= 6 && blk.includes("PLAYER")) out[key] = rows.map(r => ({ name: r[at("PLAYER")], pos: r[at("POS")], team: r[at("TEAM")],
      gp: +r[at("GP")], v: +r[start + blk.length - 1] })).filter(r => r.name);
    start = i + 1;
  }
  return out;
};

// ── The frame ──────────────────────────────────────────────────────────────────────────────────
const SECTIONS = ["Home", "Nations", "Competitions", "Players", "Managers"];
const me = ntByCode.get("NCH");
const topbar = (on) => `
<header class="topbar">
  <img class="wordmark" src="../../src/header.png" alt="Avium Football Engine">
  <button class="navbtn" aria-label="Back">${icon("back")}</button><button class="navbtn" aria-label="Forward">${icon("fwd")}</button>
  <nav class="sections">${SECTIONS.map(s => `<button class="sec${s === on ? " on" : ""}">${s}${s === "Home" ? "" : icon("caret")}</button>`).join("")}</nav>
  <div class="tb-right">
    <label class="search">${icon("search", "s")}<input placeholder="Search Nations, Clubs, Players"></label>
    <button class="iconbtn" aria-label="Requests, 2 for you">${icon("inbox")}<span class="count">2</span></button>
    <button class="avatar" aria-label="Account">${crestSrc(me) ? `<img src="${crestSrc(me)}" alt="">` : ""}</button>
    <button class="play">Play Match ${icon("play")}</button>
  </div>
</header>`;
const pagebar = (title, tabs, on, right = "") => `
<nav class="pagebar">
  <div class="pb-title">${title}</div>
  ${tabs.map(t => `<a class="pb-tab${t === on ? " on" : ""}" href="#">${t}</a>`).join("")}
  <div class="pb-right">${right}</div>
</nav>`;
const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${OUT === HERE ? "" : `<base href="${pathToFileURL(HERE).href}">`}<link rel="stylesheet" href="../ui.css"></head>
<body><div class="app">${body}</div></body></html>
`;
const panel = (title, meta, inner, cls = "") => `
<section class="panel ${cls}"><div class="ph"><h2 class="pt">${title}</h2>${meta}</div>${inner}</section>`;

// ════════════════════════════════════════════════════════════════════════════════════════════════
// HOME
// ════════════════════════════════════════════════════════════════════════════════════════════════
const home = () => {
  // Nations, by rating and nothing else.
  const ranked = [...NT].sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name));
  const list = (file) => ranked.filter(t => t.file === file).map((t, i) => `
    <div class="lrow${t.code === "NCH" ? " me" : ""}"><span class="rk">${i + 1}</span>${crest(t, "m")}<span class="nm">${esc(t.name)}</span>
      <span class="meta">${esc(t.group)}</span>${badge(t.ovr)}</div>`).join("");
  const nationsPanel = `
<section class="panel grow">
  <input type="radio" name="world" id="w-av" class="seg-in" checked><input type="radio" name="world" id="w-ar" class="seg-in">
  <div class="ph"><h2 class="pt">Nations</h2><div class="seg"><label for="w-av">Avium</label><label for="w-ar">Arterra</label></div></div>
  <label class="sbox">${icon("search", "s")}<input placeholder="Search Nations"></label>
  <div class="pb"><div class="world-av">${list("AVIUM")}</div><div class="world-ar">${list("ARTERRA")}</div></div>
</section>`;

  // Champions: the four titles still contested, each with its recent winners.
  const winners = (comp) => {
    const out = new Map(), f = `${PST}${comp}/winners.tsv`;
    if (has(f)) for (const r of txt(f).split("\n").slice(1).filter(Boolean).map(l => l.split("\t"))) out.set(r[0], r[1]);
    for (const y of readdirSync(join(ROOT, PST, comp)).filter(f => /^\d{4}\.md$/.test(f)).map(f => f.slice(0, 4))) { const w = finalOf(comp, y); if (w) out.set(y, w.winner); }
    return [...out].sort((a, b) => b[0].localeCompare(a[0]));
  };
  const TITLES = [["wc", "World Cup"], ["natl", "Nations League"], ["cwc", "Club World Cup"], ["cws", "Club World Shield"]].map(([c, label]) => [label, ...winners(c)[0]]);
  const held = TITLES.filter(([, , w]) => w === me.name).map(([l]) => l);
  const champs = TITLES.map(([label, y, w]) => {
    return `<tr class="link"><td><div class="tc">${leagueLogo(label)}<span>${esc(label)}</span></div></td><td class="dim">${esc(y)}</td><td>${teamCell(w)}</td></tr>`; }).join("");

  // Your nation.
  const wcYear = latest("wc"), wc = finalOf("wc", wcYear), mgr = M.get(me.manager);
  const [ground, cap] = [me.stadium.replace(/\s*\(.*$/, ""), (me.stadium.match(/\(([\d,]+)\)/) || [])[1]];
  const nation = `
    <div class="hero">${crest(me, "l")}<div class="lines"><span class="t1">${esc(me.name)}</span></div>
      <span style="margin-left:auto">${badge(me.ovr, "lg")}</span></div>
    <dl><div class="kv"><dt>Manager</dt><dd>${esc(display(mgr.name))} ${badge(mgr.ovr)}</dd></div>
      <div class="kv"><dt>Style</dt><dd>${esc(me.style)} <span class="sub">${esc(me.formation)}</span></dd></div>
      <div class="kv"><dt>Ground</dt><dd>${esc(ground)} <span class="sub">${esc(cap || "")}</span></dd></div>
      ${held.length ? `<div class="kv"><dt>Holds</dt><dd>${held.map(l => `<span class="tc" style="flex:none">${leagueLogo(l)}${esc(l)}</span>`).join("")}</dd></div>` : ""}</dl>`;

  // Leaders across everything in one season: every competition's 1933/34 record, each man's figures added up over all of them.
  const SEASON = "1934", INTL = new Set(["wc", "natl", "eastern", "western", "conseaf", "eufa", "pfa", "vafc"]);
  const files = readdirSync(join(ROOT, PST), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    .filter(c => has(`${PST}${c}/${SEASON}.tsv`)).map(c => [c, `${SEASON}.tsv`]);
  const tot = new Map();
  for (const [c, f] of files) {
    const B = boards(`${c}/${f}`), seen = new Map();
    for (const [k, list] of Object.entries(B)) for (const r of list) {
      const key = r.name.normalize("NFC"), e = seen.get(key) || { gp: 0, v: {}, team: r.team }; e.gp = Math.max(e.gp, r.gp || 0); e.v[k] = r.v; seen.set(key, e); }
    for (const [key, e] of seen) {
      const t = tot.get(key) || { name: key, gp: 0, G: 0, A: 0, CC: 0, DC: 0, S: 0, rs: 0, rg: 0, club: null, nat: null };
      t.gp += e.gp; for (const k of ["G", "A", "CC", "DC", "S"]) t[k] += e.v[k] || 0;
      if (e.v.RTG) { t.rs += e.v.RTG * e.gp; t.rg += e.gp; }
      if (INTL.has(c)) t.nat = t.nat || e.team; else t.club = t.club || e.team;
      tot.set(key, t);
    }
  }
  const all = [...tot.values()], who = (t) => CLUBS.find(c => c.code === t.club) || ntByCode.get(t.nat);
  const LB = [["RTG", "Highest Average Rating"], ["G", "Most Goals"], ["A", "Most Assists"], ["GA", "Most Goal Contributions"], ["CC", "Most Chances Created"],
    ["DC", "Most Defensive Actions"], ["S", "Most Saves"], ["GP", "Most Appearances"]];
  const val = (t, k) => k === "RTG" ? (t.rg >= 15 ? t.rs / t.rg : 0) : k === "GA" ? t.G + t.A : k === "GP" ? t.gp : t[k];
  const fig = (t, k) => k === "RTG" ? val(t, k).toFixed(2) : val(t, k);
  const leaders = LB.map(([k, label]) => { const top = [...all].sort((a, b) => val(b, k) - val(a, k))[0];
    return `<div class="ldr"><span class="ldr-cat">${label}</span>
      <span class="ldr-who"><img class="ldr-face" src="${portrait(top.name) || ASSET + "players/placeholder.jpg"}" alt="">${crest(who(top), "s")}<span class="ldr-nm">${esc(top.name)}</span></span>
      <span class="ldr-v">${fig(top, k)}</span></div>`; }).join("");

  // The map: the world fitted to the Avium nations, every nation a dot in its home colour.
  const v = atlas.tiles, natXY = new Map(Object.entries(atlas.nations).map(([k, xy]) => [fold(k), xy]));
  const cityXY = new Map(Object.entries(atlas.cities).map(([k, xy]) => [fold(k), xy]));
  const pins = NT.filter(t => t.file === "AVIUM").map(t => [t, natXY.get(fold(t.name)) || cityXY.get(fold(String(t.location).replace(/\s*\(.*$/, "")))]).filter(([, xy]) => xy);
  const xs = pins.map(([, xy]) => xy[0]), ys = pins.map(([, xy]) => xy[1]), W = atlas.size;
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], vx = (x1 - x0) * 1.12, vy = (y1 - y0) * 1.1;
  const span = 1024, n = Math.ceil(W / span), pct = (span / W * 100).toFixed(4);
  let tiles = "";
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) for (const layer of ["base", "borders"])
    tiles += `<img class="tile" src="https://auroruse.github.io/avium-map/tiles/${layer}/3/${ty}/${tx}.png?v=${v[layer]}" style="left:${(tx * span / W * 100).toFixed(3)}%;top:${(ty * span / W * 100).toFixed(3)}%;width:calc(${pct}% + 1px);height:calc(${pct}% + 1px)" alt="">`;
  const dots = pins.map(([t, xy]) => `<span class="dot${t.code === "NCH" ? " me" : ""}" title="${esc(t.name)}" style="left:${(xy[0] / W * 100).toFixed(2)}%;top:${(xy[1] / W * 100).toFixed(2)}%;background:${t.home}"></span>`).join("");
  const map = `<div class="map fill" style="--cx:${((x0 + x1) / 2 / W).toFixed(4)};--cy:${((y0 + y1) / 2 / W).toFixed(4)};--vx:${(W / vx).toFixed(4)};--vy:${(W / vy).toFixed(4)}">
    <div class="world">${tiles}${dots}</div>
    <div class="ctl"><button aria-label="Zoom in">${icon("plus", "s")}</button><button aria-label="Zoom out">${icon("minus", "s")}</button><button aria-label="Full screen">${icon("full", "s")}</button></div></div>`;

  const body = `
<main class="body" style="grid-template-columns:300px 380px minmax(0,1fr)">
  <div class="col">${nationsPanel}</div>
  <div class="col">
    ${panel("Your Nation", "", nation)}
    ${panel("Leaders", `<button class="pick">1933/34 ${icon("caret", "s")}</button>`, `<div class="pb">${leaders}</div>`, "grow")}
    ${panel("Champions", "", `<div class="pb" style="flex:none"><table class="tbl"><colgroup><col><col style="width:46px"><col style="width:46%"></colgroup>
      <thead><tr><th>Competition</th><th>Season</th><th>Winner</th></tr></thead><tbody>${champs}</tbody></table></div>`)}
  </div>
  <div class="col">${panel("Atlas", "", map, "grow")}</div>
</main>`;
  writeFileSync(join(OUT, "home.html"), page("Home", topbar("Home") + pagebar(`<h1>Home</h1>`, ["Overview", "Requests", "Your Teams"], "Overview") + body));
  return { nations: ranked.length, placed: pins.length, files: files.length, players: all.length };
};

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CLUB
// ════════════════════════════════════════════════════════════════════════════════════════════════
const club = (code) => {
  const t = CLUBS.find(c => c.code === code), nation = ntByCode.get(t.nation);
  const formations = txt("src/engine/formations.ts");
  const spos = JSON.parse(formations.match(new RegExp(`"${t.formation}":\\s*(\\[[^\\]]*\\])`))[1]);
  const xy = JSON.parse(formations.match(new RegExp(`"${t.formation}":(\\[\\[[^\\n]*\\]\\])`))[1]);
  const squad = t.squad.map((id, i) => ({ ...P.get(id), slot: i < 11 ? spos[i] : "SUB", xi: i < 11 }));

  // Last season's numbers, where the man played them here.
  const B = boards("nl1/1934.tsv"), stat = (k, name) => (B[k] || []).find(r => r.name === name && r.team === code);
  const row = (p) => { const nm = display(p.name), gp = stat("G", nm) || stat("RTG", nm) || stat("A", nm), g = stat("G", nm), a = stat("A", nm), r = stat("RTG", nm);
    const natT = ntByCode.get(p.nat);
    return `<tr class="link"><td><span class="pos ${posCls(p.slot)}">${p.slot}</span></td><td class="strong"><span class="fx">${esc(nm)}</span></td>
      <td><div class="tc">${crest(natT)}<b class="code">${esc(p.nat)}</b></div></td><td class="c">${badge(p.ovr)}</td>
      <td class="n${gp ? "" : " dim"}">${gp ? gp.gp : "–"}</td><td class="n${g ? "" : " dim"}">${g ? g.v : "–"}</td><td class="n${a ? "" : " dim"}">${a ? a.v : "–"}</td>
      <td class="n">${r ? `<span class="${rateCls(r.v)} strong">${r.v.toFixed(2).replace(/0$/, "")}</span>` : `<span class="dim">–</span>`}</td></tr>`; };
  const squadRows = squad.filter(p => p.xi).map(row).join("") + `<tr class="sep"><td colspan="8"></td></tr>` + squad.filter(p => !p.xi).map(row).join("");
  const avg = squad.slice(0, 11).reduce((s, p) => s + p.ovr, 0) / 11;

  // The pitch.
  const ink = (hex) => lum(hex) > 0.55 ? "#101418" : "#ffffff";
  const POS_CLR = { GK: "#ebcb8b", LB: "#81a1c1", CB: "#81a1c1", RB: "#81a1c1", LWB: "#81a1c1", RWB: "#81a1c1", DM: "#a3be8c", CM: "#a3be8c",
    AM: "#a3be8c", LM: "#a3be8c", RM: "#a3be8c", LW: "#d08770", RW: "#d08770", ST: "#d08770" };
  const men = squad.filter(p => p.xi).map((p, i) => { const nm = display(p.name), last = surname(p.name), first = nm.slice(0, nm.length - last.length).trim();
    return `<div class="pl" style="left:${xy[i][0]}%;top:${xy[i][1]}%;--pos:${POS_CLR[p.slot]}">
      <div class="pl-label">${first ? `<span class="pl-first">${esc(first)}</span>` : ""}<span class="pl-last">${esc(last)}</span></div>
      <div class="pl-tok"><img src="${portrait(nm) || ASSET + "players/placeholder.jpg"}" alt=""></div>
      ${badge(p.ovr, "pl-rtg")}<span class="pl-pos">${p.slot}</span></div>`; }).join("");
  const lines = `<svg class="lines" viewBox="0 0 68 105" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".3">
    <rect x="1.5" y="1.5" width="65" height="102"/><path d="M1.5 52.5h65"/><circle cx="34" cy="52.5" r="9.15"/><circle cx="34" cy="52.5" r=".45" fill="rgba(255,255,255,.6)"/><circle cx="34" cy="12.5" r=".45" fill="rgba(255,255,255,.6)"/><circle cx="34" cy="92.5" r=".45" fill="rgba(255,255,255,.6)"/>
    <rect x="13.84" y="1.5" width="40.32" height="16.5"/><rect x="24.84" y="1.5" width="18.32" height="5.5"/><path d="M26.7 18a9.15 9.15 0 0 0 14.6 0"/>
    <rect x="13.84" y="87" width="40.32" height="16.5"/><rect x="24.84" y="98" width="18.32" height="5.5"/><path d="M26.7 87a9.15 9.15 0 0 1 14.6 0"/></svg>`;

  // The club's facts.
  const mgr = M.get(t.manager), stadium = t.stadium.replace(/\s*\(.*$/, ""), cap = (t.stadium.match(/\(([\d,]+)\)/) || [])[1];
  const city = t.location.replace(/\s*\(.*$/, ""), pop = (t.location.match(/\(([\d,]+)\)/) || [])[1];
  const photo = has(`public/avium/stadiums/${stadium}.jpg`) ? `${ASSET}stadiums/${esc(stadium)}.jpg` : null;
  const shirt = (c) => `<svg class="kit" viewBox="0 0 32 32" aria-hidden="true"><path d="M11 4l-7 4 3 6 3-1.5V28h12V12.5l3 1.5 3-6-7-4c-1 2-2.6 3-5 3s-4-1-5-3z" fill="${c}" stroke="rgba(255,255,255,.55)" stroke-width="1"/></svg>`;
  const info = `${photo ? `<div style="position:relative;height:148px;margin:0 12px 10px;border-radius:6px;overflow:hidden">
      <img src="${photo}" alt="" style="width:100%;height:100%;object-fit:cover">
      <div style="position:absolute;inset:auto 0 0 0;padding:18px 10px 7px;background:linear-gradient(transparent,rgba(5,4,10,.92))">
        <div style="font-size:13px;font-weight:600">${esc(stadium)}</div><div style="font-size:11px;color:var(--text-2)">Capacity ${esc(cap)}</div></div></div>` : ""}
    <dl><div class="kv"><dt>City</dt><dd>${esc(city)} <span class="sub">${esc(pop || "")}</span></dd></div>
      <div class="kv"><dt>League</dt><dd>${leagueLogo(t.group)} ${esc(t.group)}</dd></div>
      <div class="kv"><dt>Manager</dt><dd>${esc(display(mgr.name))} ${crest(ntByCode.get(mgr.nat))} ${badge(mgr.ovr)}</dd></div>
      <div class="kv"><dt>Style</dt><dd>${esc(t.style)}</dd></div>
      <div class="kv"><dt>Shape</dt><dd>${esc(t.formation)}</dd></div>
      <div class="kv"><dt>Time Wasting</dt><dd>${esc(t.timeWasting)}</dd></div>
      <div class="kv"><dt>Kits</dt><dd>${shirt(t.home)}${shirt(t.away)}</dd></div></dl>`;

  // Last season, from the archive.
  const table = finalTable(md("nl1/1934.md")), me = table.find(r => r.name === t.name);
  const ms = matches(md("nl1/1934.md")).filter(m => /^Round \d+$/.test(m.stage) && (m.home === t.name || m.away === t.name));
  const last = ms.slice(-10), form = last.map(m => outcome(m, t.name));
  const top = (k) => (B[k] || []).find(r => r.team === code);
  const season = me ? `
    <div class="hero"><span class="big">${me.pos}<small>${ordinal(me.pos).slice(-2)}</small></span>
      <div class="lines"><span class="t1">${esc(t.group)}</span></div>
      <span class="big" style="margin-left:auto;color:var(--accent-ink)">${me.pts}<small>PTS</small></span></div>
    <div class="strip">${[["P", me.p], ["W", me.w], ["D", me.d], ["L", me.l], ["GF", me.gf], ["GA", me.ga], ["GD", me.gd]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div>
    <div class="form" style="padding:12px 12px 0">${form.map(o => `<i class="${o}">${o.toUpperCase()}</i>`).join("")}</div>
    <dl style="margin-top:10px">${[["Top Scorer", top("G")], ["Most Assists", top("A")]].filter(([, r]) => r).map(([k, r]) =>
      `<div class="kv"><dt>${k}</dt><dd>${esc(r.name)} <span class="sub">${r.v}</span></dd></div>`).join("")}</dl>` : "";
  const resultRows = [...ms].reverse().map(m => { const opp = m.home === t.name ? m.away : m.home, o = outcome(m, t.name);
    return `<tr class="link"><td class="dim">${m.stage.replace("Round ", "R")}</td><td>${teamCell(opp)}</td><td class="c dim">${m.home === t.name ? "H" : "A"}</td>
      <td class="n"><span class="res ${o}">${esc(scoreFor(m, t.name))}</span></td></tr>`; }).join("");

  // Honours: league titles from the final tables, cups from the finals.
  const hon = [];
  const nlYears = readdirSync(join(ROOT, PST, "nl1")).filter(f => /^\d{4}\.md$/.test(f)).map(f => f.slice(0, 4))
    .filter(y => finalTable(md(`nl1/${y}.md`))[0]?.name === t.name);
  if (nlYears.length) hon.push(["Nichirin League One", nlYears]);
  const cupYears = (comp) => { const dir = join(ROOT, PST, comp); if (!existsSync(dir)) return [];
    const tsv = existsSync(join(dir, "winners.tsv")) ? txt(`${PST}${comp}/winners.tsv`).split("\n").slice(1).filter(Boolean).map(l => l.split("\t")) : [];
    const ys = new Set(tsv.filter(r => r[1] === t.name).map(r => r[0]));
    for (const f of readdirSync(dir).filter(f => /^\d{4}\.md$/.test(f))) { const y = f.slice(0, 4), w = finalOf(comp, y); if (w && w.winner === t.name) ys.add(y); }
    return [...ys].sort(); };
  for (const [comp, label] of [["stsc", "Sei'i Tai Shogun Cup"], ["cwc", "Club World Cup"], ["cws", "Club World Shield"]]) { const ys = cupYears(comp); if (ys.length) hon.push([label, ys]); }
  const honours = hon.map(([label, ys]) => `
    <tr class="link"><td><div class="tc">${leagueLogo(label)}<span>${esc(label)}</span></div></td><td class="n strong" style="color:var(--gold)">${ys.length}</td>
      <td class="n dim">${ys[ys.length - 1]}</td></tr>`).join("");

  const finishes = readdirSync(join(ROOT, PST, "nl1")).filter(f => /^\d{4}\.md$/.test(f)).map(f => f.slice(0, 4)).sort()
    .map(y => { const r = finalTable(md(`nl1/${y}.md`)).find(r => r.name === t.name); return { y, pos: r ? r.pos : null, of: r ? r.of : null }; });
  const W = 100 / finishes.length, gap = Math.min(0.9, W * 0.22);
  const bars = finishes.map((f, i) => f.pos == null ? "" :
    `<rect x="${(i * W + gap / 2).toFixed(2)}" y="${(100 - (f.of - f.pos + 1) / f.of * 100).toFixed(2)}" width="${(W - gap).toFixed(2)}" height="${((f.of - f.pos + 1) / f.of * 100).toFixed(2)}"
      class="${f.pos === 1 ? "b-gold" : "b"}"><title>${f.y}: ${ordinal(f.pos)} / ${f.of}</title></rect>`).join("");
  const chart = `<div class="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${bars}</svg>
    <div class="chart-x"><span>${finishes[0].y}</span><span>${finishes[finishes.length - 1].y}</span></div></div>`;
  const log = txt(PST + "changelog.tsv").split("\n").filter(Boolean).map(l => l.split("\t"));
  const moves = log.filter(r => r[0] === "1934" && r[1] === "nl1" && r[3] === code).map(r => ({ name: r[2], pos: r[4], old: +r[5], now: +r[6] }))
    .sort((a, b) => (b.now - b.old) - (a.now - a.old) || b.now - a.now);
  const moveRows = moves.map(m => { const d = m.now - m.old;
    return `<tr class="link"><td><span class="pos ${posCls(m.pos === "DEF" ? "CB" : m.pos === "MID" ? "CM" : m.pos === "FWD" ? "ST" : m.pos)}">${esc(m.pos)}</span></td>
      <td><span class="fx">${esc(m.name)}</span></td><td class="n dim">${m.old}</td><td class="n">${m.now}</td>
      <td class="n"><span class="delta ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "+" + d : d}</span></td></tr>`; }).join("");

  const title = `<span class="up">${crest(nation)}${esc(nation.name)} ${icon("fwd", "s")}</span><img src="${crestSrc(t)}" alt=""><h1>${esc(t.name)}</h1>`;
  const right = `<button class="btn">${icon("edit", "s")}Edit Club</button><button class="btn">${icon("play", "s")}Play Match</button>`;
  const body = `
<main class="body" style="grid-template-columns:468px 430px 290px minmax(0,1fr)">
  <div class="col">
    ${panel("Squad", `<button class="pick">1933/34 ${icon("caret", "s")}</button>`, `<div class="pb" style="flex:none"><table class="tbl">
      <colgroup><col style="width:46px"><col><col style="width:62px"><col style="width:44px"><col style="width:34px"><col style="width:30px"><col style="width:30px"><col style="width:46px"></colgroup>
      <thead><tr><th>Pos</th><th>Player</th><th>Nat</th><th class="c">Rtg</th><th class="n">GP</th><th class="n">G</th><th class="n">A</th><th class="n">Avg</th></tr></thead>
      <tbody>${squadRows}</tbody></table></div>`)}
    ${panel("Season 1933/34", "", `<div class="pb">${season}</div>`, "grow")}
  </div>
  <div class="col">${panel("Formation", `<button class="pick">${esc(t.formation)} ${icon("caret", "s")}</button>`,
    `<div class="pitch-wrap"><div class="pitch">${lines}${men}</div></div>`, "grow")}</div>
  <div class="col">
    ${panel("Club", "", info)}
    ${panel("Honours", "", `<div class="pb" style="flex:none"><table class="tbl"><colgroup><col><col style="width:34px"><col style="width:48px"></colgroup>
      <thead><tr><th>Competition</th><th class="n">Won</th><th class="n">Last</th></tr></thead><tbody>${honours}</tbody></table></div>`)}
    ${panel("League Finishes", "", chart, "grow")}
  </div>
  <div class="col">
    ${panel("Results", "", `<div class="pb"><table class="tbl"><colgroup><col style="width:36px"><col><col style="width:22px"><col style="width:52px"></colgroup>
      <tbody>${resultRows}</tbody></table></div>`, "grow")}
    ${panel("Rating Changes", "", `<div class="pb" style="flex:none"><table class="tbl"><colgroup><col style="width:44px"><col><col style="width:30px"><col style="width:30px"><col style="width:36px"></colgroup>
      <thead><tr><th></th><th>Player</th><th class="n">Was</th><th class="n">Now</th><th class="n"></th></tr></thead><tbody>${moveRows}</tbody></table></div>`)}
  </div>
</main>`;
  writeFileSync(join(OUT, "club.html"), page(t.name, topbar("Nations") + pagebar(title, ["Overview", "Squad", "Tactics", "History", "Honours"], "Overview", right) + body));
  return { squad: squad.length, statted: squad.filter(p => stat("RTG", display(p.name)) || stat("G", display(p.name))).length, results: last.length, honours: hon, moves: moves.length };
};

console.log("home", home());
console.log("club", JSON.stringify(club("SPK")));
