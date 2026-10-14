// THE STADIUMS MOCK: every ground in the records, the chosen one as a photograph across the top and the list under it.
// Writes design/mock/stadiums.html next to this file.
//
//   node design/mock/stadiums.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url)), HERE = fileURLToPath(new URL(".", import.meta.url));
const teams = JSON.parse(readFileSync(join(ROOT, "src/data/teams.json"), "utf8"));
const ASSET = "../../public/avium/";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (s) => String(s || "").replace(/\s*\([\d,]+\)\s*$/, "").trim();
const cap = (s) => (String(s || "").match(/\(([\d,]+)\)\s*$/) || [])[1] || null;
const photos = new Set(readdirSync(join(ROOT, "public/avium/stadiums")).map(f => f.normalize("NFC")));
const crest = (t) => t && existsSync(join(ROOT, `public/avium/badges/${t.code}.png`)) ? `${ASSET}badges/${t.code}.png` : null;

const isNT = (t) => t.file === "AVIUM" || t.file === "ARTERRA";
const NT = new Map(teams.filter(isNT).map(t => [t.code, t]));
const byGround = new Map();
for (const t of teams) {
  const n = strip(t.stadium); if (!n || t.group === "Custom") continue;
  const g = byGround.get(n) || { name: n, cap: null, clubs: [], nts: [], nation: t.nation, city: "" };
  const c = cap(t.stadium); if (c && (!g.cap || +c.replace(/,/g, "") > +g.cap.replace(/,/g, ""))) g.cap = c;
  (isNT(t) ? g.nts : g.clubs).push(t);
  if (!g.city || !isNT(t)) g.city = strip(t.location) || g.city;
  byGround.set(n, g);
}
const side = (t) => ({ code: t.code, name: t.name, crest: crest(t), home: t.home || "#334", away: t.away || "#223" });
const rows = [...byGround.values()].map(g => {
  const nt = NT.get(g.nation);
  const file = g.name.normalize("NFC") + ".jpg";
  const host = g.clubs[0] || g.nts[0];
  return { name: g.name, cap: g.cap, n: g.cap ? +g.cap.replace(/,/g, "") : -1, city: g.city,
    nation: { code: g.nation, name: nt ? nt.name : g.nation, crest: crest(nt) },
    clubs: g.clubs.map(side), nts: g.nts.map(side),
    photo: photos.has(file) ? ASSET + "stadiums/" + encodeURIComponent(g.name.normalize("NFC")) + ".jpg" : null,
    tint: host ? host.home || "#334" : "#334", tint2: host ? host.away || host.home || "#223" : "#223" };
}).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
rows.forEach((r, i) => { r.rank = i + 1; });

const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', fwd: '<path d="M9 18l6-6-6-6"/>', caret: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  play: '<path d="M5 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
};
const icon = (k, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const SECTIONS = ["Home", "Nations", "Competitions", "Players", "Managers", "Stadiums"];
const me = NT.get("NCH");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stadiums</title><link rel="stylesheet" href="../ui.css"><link rel="stylesheet" href="../../src/theme.css"><link rel="stylesheet" href="../../src/ui.css">
<style>
/* The screen: the chosen ground as a lit card across the top, its own photograph blurred behind it as the light; the
   ledger under it, ranked by capacity. */
.st-main { display: grid; grid-template-rows: minmax(280px, 46vh) minmax(0, 1fr); min-height: 0; }
.st-hero { position: relative; overflow: hidden; padding: 14px 12px 14px; isolation: isolate; }
.st-glow { position: absolute; inset: -80px; z-index: -2; background-size: cover; background-position: center;
  filter: blur(60px) saturate(1.6) brightness(.75); opacity: .85; transform: scale(1.1); transition: background-image .4s; }
.st-hero::after { content: ""; position: absolute; inset: 0; z-index: -1;
  background: radial-gradient(120% 90% at 50% 0%, transparent 30%, rgba(6, 11, 20, .55) 70%, var(--bg) 100%),
              linear-gradient(180deg, transparent 60%, var(--bg)); }
.st-card { position: relative; height: 100%; border-radius: 12px; overflow: hidden;
  background: #000 center / cover no-repeat;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, .16), 0 0 0 5px rgba(0, 0, 0, .35), 0 40px 90px -30px #000,
              0 0 140px -20px var(--tint); }
.st-card::after { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), inset 0 0 0 1px rgba(255, 255, 255, .05); }
.st-card.st-ph { cursor: zoom-in; }
.st-card.st-kit { background: linear-gradient(135deg, var(--tint) 0 50%, var(--tint2) 50% 100%); }
.st-rank { position: absolute; right: 28px; top: 6px; font: 700 132px/1 var(--f-title); letter-spacing: -.02em;
  color: transparent; -webkit-text-stroke: 1.5px rgba(255, 255, 255, .45); text-shadow: 0 0 40px rgba(0, 0, 0, .4); }
.st-rank small { font-size: 56px; vertical-align: 50px; margin-right: 4px; }
.st-id { position: absolute; left: 36px; bottom: 26px; right: 40%; display: flex; flex-direction: column; gap: 14px; }
.st-nat { display: flex; align-items: center; gap: 10px; font: 700 13px/1 var(--f-title); letter-spacing: .14em; text-shadow: 0 1px 8px rgba(0, 0, 0, .9); text-transform: uppercase;
  color: rgba(255, 255, 255, .82); }
.st-nat img { width: 22px; height: 22px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(0, 0, 0, .6)); }
.st-nat .dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
.st-name { display: flex; min-width: 0; font: 700 clamp(34px, 4.2vw, 68px)/.95 var(--f-title); letter-spacing: .01em; text-transform: uppercase;
  text-shadow: 0 2px 4px rgba(0, 0, 0, .6), 0 4px 30px rgba(0, 0, 0, .8); }
.st-name > span { flex: none; white-space: nowrap; transform-origin: left center; }
.st-facts { display: flex; align-items: flex-end; gap: 34px; }
.st-fact { display: flex; flex-direction: column; gap: 4px; }
.st-fact span { font-size: 10px; text-shadow: 0 1px 6px rgba(0, 0, 0, .9); letter-spacing: .14em; text-transform: uppercase; color: rgba(255, 255, 255, .6); }
.st-fact b { font: 700 28px/1 var(--f-text); letter-spacing: -.01em; text-shadow: 0 2px 12px rgba(0, 0, 0, .8); }
.st-fact b.t { font: 700 26px/1 var(--f-title); letter-spacing: .04em; text-transform: uppercase; }
.st-ten { position: absolute; right: 30px; bottom: 28px; display: flex; gap: 10px; }
.st-tn { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 10px;
  background: rgba(6, 10, 18, .62); backdrop-filter: blur(10px); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .14), inset 3px 0 0 var(--c); }
.st-tn img, .st-tn .nob { width: 34px; height: 34px; object-fit: contain; }
.st-tn span { display: flex; flex-direction: column; gap: 3px; }
.st-tn i { font-style: normal; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: rgba(255, 255, 255, .55); }
.st-tn b { font: 700 15px/1 var(--f-title); letter-spacing: .04em; text-transform: uppercase; }

.st-list { min-height: 0; display: grid; padding: 0 12px 12px; }
.st-list .ux-panel { min-height: 0; }
.ux-app.st-ux { display: grid; grid-template-rows: minmax(0, 1fr); height: auto; min-height: 0; background: none; }
.st-tbl .ux-nm { font-weight: 600; }
.st-tbl .ux-n, .st-tbl .rk, .st-tbl .mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-variant-numeric: tabular-nums; }
.st-tbl .ux-tc img, .st-tbl .ux-tc .nob { width: 16px; height: 16px; object-fit: contain; flex: none; }
.st-tbl .many { display: flex; gap: 14px; min-width: 0; overflow: hidden; -webkit-mask-image: var(--ux-fade); mask-image: var(--ux-fade); }
.st-tbl .many .ux-tc { flex: none; }
.st-tbl .many .ux-tc > span { flex: none; -webkit-mask-image: none; mask-image: none; }
.st-tbl .ux-c svg { width: 15px; height: 15px; vertical-align: middle; }
.st-tbl .has { color: var(--ux-text-2); } .st-tbl tr.ux-sel .has { color: var(--ux-text); }
.st-lb { position: fixed; inset: 0; z-index: 100; display: none; place-items: center; background: rgba(4, 7, 13, .88); backdrop-filter: blur(6px); cursor: zoom-out; }
.st-lb.on { display: grid; }
.st-lb figure { display: flex; flex-direction: column; gap: 10px; max-width: 92vw; }
.st-lb img { max-width: 92vw; max-height: 80vh; width: auto; height: auto; border-radius: 8px; box-shadow: 0 30px 80px -20px #000; }
.st-lb figcaption { display: flex; align-items: baseline; gap: 12px; }
.st-lb b { font: 700 22px/1 var(--f-title); letter-spacing: .03em; text-transform: uppercase; }
.st-lb span { font-size: 12px; color: var(--text-3); }
</style></head>
<body><div class="app">
<header class="topbar">
  <img class="wordmark" src="../../src/header.png" alt="Avium Football Engine">
  <button class="navbtn" aria-label="Back">${icon("back")}</button><button class="navbtn" aria-label="Forward">${icon("fwd")}</button>
  <nav class="sections">${SECTIONS.map(s => `<button class="sec${s === "Stadiums" ? " on" : ""}">${s}${s === "Home" || s === "Stadiums" ? "" : icon("caret")}</button>`).join("")}</nav>
  <div class="tb-right">
    <label class="search">${icon("search", "s")}<input placeholder="Search Nations, Clubs, Players"></label>
    <button class="iconbtn" aria-label="Requests">${icon("inbox")}</button>
    <button class="avatar" aria-label="Account">${crest(me) ? `<img src="${crest(me)}" alt="">` : ""}</button>
    <button class="play">Play Match ${icon("play")}</button>
  </div>
</header>
<nav class="pagebar"><div class="pb-title"><h1>Stadiums</h1></div><div class="pb-right"><span class="mute" style="color:var(--text-3);font-size:12px;align-self:center">${rows.length} Grounds</span></div></nav>
<main class="st-main">
  <section class="st-hero" id="hero"></section>
  <div class="st-list"><div class="ux-app st-ux"><section class="ux-panel">
    <div class="ux-ph"><h2 class="ux-pt">Stadiums</h2></div>
    <div class="ux-filters">
      <label class="ux-search"><svg class="ux-i ux-s" viewBox="0 0 24 24" aria-hidden="true">${I.search}</svg><input id="q" placeholder="Search Stadiums" aria-label="Search Stadiums"></label>
      <label class="ux-pick"><select id="nat" aria-label="Nation"><option value="">All Nations</option></select><svg class="ux-i ux-xs" viewBox="0 0 24 24" aria-hidden="true">${I.caret}</svg></label>
      <span class="ux-fcount"><span id="cnt" style="font-family:'JetBrains Mono',monospace"></span> Stadiums</span>
    </div>
    <div class="ux-pbody ux-ps"><table class="ux-tbl st-tbl">
      <colgroup><col style="width:40px"><col style="width:250px"><col style="width:52px"><col style="width:64px"><col style="width:130px"><col style="width:84px"><col><col style="width:150px"></colgroup>
      <thead><tr id="hd"></tr></thead>
      <tbody id="rows"></tbody></table></div>
  </section></div></div>
</main>
</div>
<div class="st-lb" id="lb"><figure><img id="lbi" alt=""><figcaption><b id="lbn"></b><span id="lbc"></span></figcaption></figure></div>
<script>
const R = ${JSON.stringify(rows).replace(/</g, "\\u003c")};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const img = (t, cls = "") => t.crest ? '<img src="' + t.crest + '" alt="">' : '<span class="nob"></span>';
const sideCell = (t) => '<span class="cl">' + img(t) + '<span>' + esc(t.name) + '</span></span>';
let on = location.hash ? +location.hash.slice(1) - 1 : R.findIndex(r => r.photo); if (!(on >= 0)) on = 0;
function hero() {
  const r = R[on], h = document.getElementById("hero");
  h.style.setProperty("--tint", r.tint); h.style.setProperty("--tint2", r.tint2);
  const ten = [...r.clubs.map(t => [t, "Club"]), ...r.nts.map(t => [t, "National Team"])].slice(0, 3);
  h.innerHTML = '<div class="st-glow" style="background-image:' + (r.photo ? 'url(' + r.photo + ')' : 'linear-gradient(135deg,' + r.tint + ',' + r.tint2 + ')') + '"></div>'
    + '<div class="st-card' + (r.photo ? ' st-ph' : ' st-kit') + '"' + (r.photo ? ' style="background-image:url(' + r.photo + ')"' : '') + '>'
    + '<div class="st-rank"><small>#</small>' + r.rank + '</div>'
    + '<div class="st-id"><div class="st-nat">' + (r.nation.crest ? '<img src="' + r.nation.crest + '" alt="">' : '') + esc(r.nation.name) + '<span class="dot"></span>' + esc(r.city) + '</div>'
    + '<div class="st-name"><span>' + esc(r.name) + '</span></div>'
    + '<div class="st-facts"><div class="st-fact"><span>Capacity</span><b>' + (r.cap || "–") + '</b></div></div></div>'
    + '<div class="st-ten">' + ten.map(([t, l]) => '<div class="st-tn" style="--c:' + t.home + '">' + img(t) + '<span><i>' + l + '</i><b>' + esc(t.name) + '</b></span></div>').join("") + '</div>'
    + '</div>';
  const nm = h.querySelector(".st-name"), ln = nm.firstChild, k = nm.clientWidth / ln.offsetWidth;
  ln.style.transform = k < 1 ? "scaleX(" + k.toFixed(4) + ")" : "";
  const card = h.querySelector(".st-card");
  if (r.photo) card.addEventListener("click", e => { if (e.target.closest(".st-tn")) return;
    document.getElementById("lbi").src = r.photo; document.getElementById("lbn").textContent = r.name;
    document.getElementById("lbc").textContent = r.cap ? "Capacity " + r.cap : ""; document.getElementById("lb").classList.add("on"); });
}
document.getElementById("lb").addEventListener("click", () => document.getElementById("lb").classList.remove("on"));
addEventListener("keydown", e => { if (e.key === "Escape") document.getElementById("lb").classList.remove("on"); });
addEventListener("resize", () => hero());
const PIC = '<svg class="ux-i" viewBox="0 0 24 24" aria-label="Image"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-11 8"/></svg>';
const COLS = [["rank", "#", "", 0], ["name", "Stadium", "", 1], ["photo", "Image", "ux-c", 0], ["nat", "Nation", "", 1], ["city", "City", "", 1], ["n", "Capacity", "ux-n", 0], ["club", "Club", "ux-sep", 1], ["nt", "National Team", "", 1]];
const st = { k: "n", asc: false, q: "", nat: "" };
const nats = [...new Map(R.map(r => [r.nation.code, r.nation.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
document.getElementById("nat").innerHTML += nats.map(([c, n]) => '<option value="' + c + '">' + esc(n) + '</option>').join("");
const val = (r, k) => k === "nat" ? r.nation.name : k === "club" ? (r.clubs[0] || {}).name : k === "nt" ? (r.nts[0] || {}).name : k === "n" ? (r.n < 0 ? null : r.n) : k === "photo" ? (r.photo ? 1 : 0) : r[k];
const dash = '<span class="ux-dim">&#8211;</span>';
let view = [];
function list() {
  const q = st.q.toLowerCase();
  view = R.filter(r => (!st.nat || r.nation.code === st.nat) && (!q || (r.name + " " + r.city + " " + r.clubs.map(t => t.name).join(" ")).toLowerCase().includes(q)));
  const dir = st.asc ? 1 : -1;
  view.sort((a, b) => { const va = val(a, st.k), vb = val(b, st.k);
    if (va == null || vb == null) return va == null && vb == null ? a.rank - b.rank : va == null ? 1 : -1;
    const d = typeof va === "string" ? va.localeCompare(vb) : va - vb; return d ? d * dir : a.rank - b.rank; });
  document.getElementById("cnt").textContent = view.length;
  document.getElementById("hd").innerHTML = COLS.map(([k, l, c]) => { const on = st.k === k;
    return '<th data-k="' + k + '" class="ux-sort' + (on ? ' ux-sorted' : '') + (c ? ' ' + c : '') + '"><span class="ux-sl">' + l
      + (on ? '<span class="ux-caret' + (st.asc ? ' ux-up' : '') + '"><svg class="ux-i ux-xs" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>' : '') + '</span></th>'; }).join("");
  const side = (t) => '<div class="ux-tc ux-a">' + img(t) + '<span>' + esc(t.name) + '</span></div>';
  document.getElementById("rows").innerHTML = view.map((r, i) => '<tr class="ux-link' + (R[on] === r ? ' ux-sel' : '') + '" data-i="' + R.indexOf(r) + '">'
    + '<td class="ux-dim rk">' + (i + 1) + '</td>'
    + '<td><span class="ux-a ux-nm">' + esc(r.name) + '</span></td>'
    + '<td class="ux-c">' + (r.photo ? '<span class="has" title="Image">' + PIC + '</span>' : '') + '</td>'
    + '<td title="' + esc(r.nation.name) + '"><div class="ux-tc ux-a">' + img(r.nation) + '<b class="ux-code mono">' + esc(r.nation.code) + '</b></div></td>'
    + '<td><div class="ux-tc ux-a"><span>' + esc(r.city || "–") + '</span></div></td>'
    + '<td class="ux-n">' + (r.cap || dash) + '</td>'
    + '<td class="ux-sep">' + (r.clubs.length ? (r.clubs.length > 1 ? '<div class="many">' + r.clubs.map(side).join("") + '</div>' : side(r.clubs[0])) : dash) + '</td>'
    + '<td>' + (r.nts.length ? r.nts.map(side).join("") : dash) + '</td></tr>').join("")
    || '<tr><td colspan="8" class="ux-dim">No Stadiums Found</td></tr>';
}
document.getElementById("hd").addEventListener("click", e => { const th = e.target.closest("th"); if (!th) return; const k = th.dataset.k, c = COLS.find(x => x[0] === k);
  st.asc = st.k === k ? !st.asc : !!c[3]; st.k = k; list(); });
document.getElementById("q").addEventListener("input", e => { st.q = e.target.value.trim(); list(); });
document.getElementById("nat").addEventListener("change", e => { st.nat = e.target.value; list(); });
document.getElementById("rows").addEventListener("click", e => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; on = +tr.dataset.i; hero(); list(); });
list();
hero();
</script></body></html>
`;
writeFileSync(join(HERE, "stadiums.html"), html);
console.log(rows.length, "grounds,", rows.filter(r => r.photo).length, "with photographs,", rows.filter(r => r.cap).length, "with capacities");
