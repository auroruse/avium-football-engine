// FULL TIME, THE MOCK (user, 23 November 2026: "Redesign the post-match screen in the same style you redesigned the sidebar
// with. Give me mocks first after asking questions"). Of two directions the user took A, the broadcast board, with: "MANY
// malaligned elements", "Momentum, possession, on/off the ball (rename) need to have uniform heights and match the height of
// the player list, whatever it is", "City name and nation next to stadium", and of the banner: "Drop the scoreboard; replace
// formation with code, move badges back to where they are currently, but restyle the center to have everything aligned
// properly, even if number of scorers is very high."
//
// A static page drawn from one real match the app played (a headless dump of its Full Time data), at the page's design
// size, 1600 by 1092. Writes design/mock/fulltime-a.html, and fulltime-a-many.html with the scorers multiplied, to show
// the banner holding a lot of them.
//
//   node design/mock/fulltime.mjs <match.json>
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const D0 = JSON.parse(readFileSync(process.argv[2], "utf8"));
const A = "../../public/avium/";
// The match was played on neutral ground; it is drawn at Nichirin's, to show the photo and the ground's line.
const VENUE = "Tadamune Kuronami National Stadium", CITY = "Mizuhara", NATION = "Nichirin";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sur = (full) => { const p = String(full).split(" "); return p.length > 1 ? p.slice(1).join(" ") : p[0]; };
const first = (full) => { const p = String(full).split(" "); return p.length > 1 ? p[0] : ""; };
const bold = (full) => `${esc(first(full))} <b>${esc(sur(full))}</b>`;
const STYLE = { routeone: ["Route One", "#9a90f0"], verticaltiki: ["Vertical Tiki-Taka", "#c96a6a"] };
const METAL = [[90, null], [85, ["#a878d0", "#5d3096", "#240d3c"]], [80, ["#55dfa0", "#127a4a", "#05361f"]], [75, ["#f2d067", "#b5860f", "#5f4405"]],
               [65, ["#cdd5dd", "#8b949c", "#4d555c"]], [-1e9, ["#e0a071", "#a05f2c", "#4f2a12"]]];
const badge = (v) => { const n = Math.round(v), m = METAL.find(([x]) => n >= x)[1];
  const bg = m ? `linear-gradient(145deg,${m[0]} 0%,${m[1]} 26%,${m[2]} 50%,${m[1]} 74%,${m[0]} 100%)`
               : "linear-gradient(160deg,rgba(0,0,0,.66),rgba(0,0,0,.42) 52%,rgba(0,0,0,.68)),linear-gradient(115deg,#00e5ff,#7c5cff 20%,#ff4fa3 38%,#ffb02e 56%,#35e08a 74%,#2fa8ff)";
  return `<span class="bd" style="background:${bg}">${n}</span>`; };
const rateClr = (r) => r >= 9 ? "#4a90d9" : r >= 8 ? "#5bbcd6" : r >= 7 ? "#4caf50" : r >= 6.5 ? "#e6c619" : r >= 6 ? "#e89a3c" : r >= 5 ? "#d55b4a" : "#cc3333";
const POS = (p) => p === "GK" ? "#ebcb8b" : /^(CB|LB|RB|LWB|RWB|DEF)$/.test(p) ? "#81a1c1" : /^(DM|CM|AM|LM|RM|MID)$/.test(p) ? "#a3be8c" : "#d08770";
const crest = (code) => `${A}badges/${code}.png`;
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const fmin = (m, add) => add ? `${m}+${add}'` : `${m}'`;
const BALL = `<svg class="ic" viewBox="-6 -6 12 12"><circle r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle r="1.8" fill="currentColor"/></svg>`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
@import url('https://fonts.cdnfonts.com/css/neue-montreal');
:root { --bg:#0a0e17; --panel:#141c2b; --panel-2:#182134; --panel-3:#1e2a3d; --line:#2a3a50; --line-2:#3a4d66;
  --text:#fff; --text-2:#b3bfcf; --text-3:#7889a0; --accent:#e4002b; --ok:#a3be8c; --warn:#ebcb8b; --danger:#bf616a; --gold:#ebcb8b;
  --title:'Barlow Condensed', sans-serif; --mono:'JetBrains Mono', monospace; --body:'Neue Montreal', 'Inter', sans-serif;
  --rh:17px; --hh:26px; }
* { box-sizing:border-box; margin:0; padding:0; }
html, body { background:var(--bg); }
body { width:1600px; height:1092px; overflow:hidden; color:var(--text); font:500 12px/1.25 var(--body); position:relative; }
b { font-weight:700; }
.mono { font-family:var(--mono); }
/* EVERY LINE OF THE TITLE FACE IS TRIMMED TO ITS CAPITALS (text-box), so a label centred in its box is centred on the letters
   and not on the face's tall line box, which is what left the codes, minutes and heads sitting low. */
.t { font-family:var(--title); text-transform:uppercase; text-box:trim-both cap alphabetic; }
/* a section head, one height everywhere (--hh): the slanted accent tick, the title, a rule to the edge */
.h { display:flex; align-items:center; gap:8px; height:var(--hh); }
.h > span { font:700 14px/1 var(--title); letter-spacing:.07em; text-transform:uppercase; color:var(--text-2); text-box:trim-both cap alphabetic; }
.h::before { content:""; width:4px; height:12px; background:var(--accent); transform:skewX(-20deg); flex:none; }
.h::after { content:""; flex:1; height:1px; background:var(--line); }
.bd { display:inline-block; min-width:21px; padding:1px 4px; color:#fff; font:700 10px/1.3 var(--mono); text-align:center; text-shadow:0 1px 2px rgba(0,0,0,.5);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.5), inset 0 -1px 0 rgba(0,0,0,.34); }
.ic { width:11px; height:11px; flex:none; display:block; }
/* a minute on a plate in the side's kit, its readable colour along the foot; the figure centred above that edge */
.mk { display:inline-flex; align-items:center; justify-content:center; height:16px; width:40px; padding:0 0 2px; flex:none;
  clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%); box-shadow:inset 0 -2px 0 var(--edge); }
.mk > span { font:700 13px/1 var(--title); letter-spacing:.03em; color:#fff; text-box:trim-both cap alphabetic; }
/* the numbers, a row each at the player rows' own height */
.st { display:grid; grid-template-columns:46px 1fr 112px 1fr 46px; align-items:center; gap:8px; height:var(--rh); }
.st .v { font:400 12px/1 var(--mono); color:var(--text-3); } .st .v.r { text-align:right; } .st .v.on { font-weight:700; }
.st .l { text-align:center; font:600 12.5px/1 var(--title); letter-spacing:.08em; text-transform:uppercase; color:var(--text-3); text-box:trim-both cap alphabetic; }
.st .b { height:6px; display:flex; } .st .b.l2 { justify-content:flex-end; } .st .b i { display:block; height:100%; background:var(--line-2); }
/* the team sheet: its plate (one head height), the column heads, the men; the numbers' rows use the same row height */
.sh .hd { display:flex; align-items:center; gap:8px; height:var(--hh); padding:0 14px 2px 8px; color:#fff;
  clip-path:polygon(0 0,100% 0,calc(100% - 11px) 100%,0 100%); box-shadow:inset 0 -2px 0 var(--edge); text-shadow:0 1px 2px rgba(0,0,0,.45); }
.sh .hd img { width:18px; height:18px; object-fit:contain; } .sh .hd .t { font-size:17px; font-weight:700; letter-spacing:.06em; }
.sh .hd .c { margin-left:auto; font:700 15px/1 var(--title); letter-spacing:.06em; color:rgba(255,255,255,.85); text-box:trim-both cap alphabetic; }
.sh .row { display:grid; grid-template-columns:var(--cols); align-items:center; gap:3px; height:var(--rh); font-size:12px; }
.sh .row:nth-child(odd) { background:rgba(24,33,52,.7); }
.sh .row.ch { height:20px; background:none; border-bottom:1px solid var(--line); }
.sh .row.ch > span { font:600 11px/1 var(--title); letter-spacing:.08em; color:var(--text-3); text-transform:uppercase; text-box:trim-both cap alphabetic; }
.sh .row > span { text-align:center; min-width:0; } .sh .row > span.n { text-align:left; white-space:nowrap; overflow:hidden; display:flex; align-items:center; gap:4px; }
.sh .row .p { font:700 9.5px/1 var(--mono); text-align:left; padding-left:4px; }
.sh .row .z { font:400 11.5px/1 var(--mono); color:#4b5a70; } .sh .row .k { font:400 11.5px/1 var(--mono); }
.sh .row .rt { font:700 12px/1 var(--mono); }
.sh .row .tm { font:600 10px/1 var(--mono); text-align:right; padding-right:3px; }
.sh .row.sat { opacity:.45; }
.sh .rule { height:1px; background:var(--line); margin:3px 0; }
.card { display:inline-block; width:6px; height:9px; background:var(--warn); flex:none; } .card.red { background:var(--danger); }
.star { width:11px; height:11px; fill:var(--gold); flex:none; }
`;

const BAN = 290;   // the banner: four rows of scorers always fit above the ground's line
const build = (D, file, title) => {
  const SIDE = { home: { t: D.h, kit: D.h.c1, edge: D.h.c2, hc: "#5b78f0" }, away: { t: D.a, kit: D.a.c1, edge: D.a.c2, hc: "#a3acb8" } };
  const S = D.stats, pc = [pct(D.poss[0], D.poss[0] + D.poss[1]), 0]; pc[1] = 100 - pc[0];
  const xiOvr = (sd) => { const xs = D.men[sd].filter(q => q.kind === "start" && q.pos !== "GK"); return (xs.reduce((a, q) => a + q.ovr, 0) / xs.length).toFixed(1); };
  const top = (() => { let b = null; for (const sd of ["home", "away"]) for (const q of D.men[sd]) if (q.kind !== "unused" && (!b || q.r > b.q.r)) b = { q, sd }; return b; })();
  const goals = D.clips.map(c => { const mt = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(c.txt || ""); return { ...c, who: mt ? mt[1] : c.txt || c.scorer, ast: mt ? mt[2] : null }; });
  const mk = (sd, txt) => `<span class="mk" style="background:${SIDE[sd].kit};--edge:${SIDE[sd].edge}"><span>${txt}</span></span>`;

  // ── THE BANNER: each side's crest at its outer edge and its name, manager and code with the eleven's rating beside it, as
  // today. The score's top stands level with the tops of the two names (the user: "top of score always needs to be lined up
  // with the top of the team names"), the competition over it and FULL TIME under it. The scorers run under all of that,
  // across the banner's whole width, in columns that start at the centre line and go outward (home's leftward, set to the
  // centre, away's rightward): a scorer a line with all his minutes, four to a column before the next one (the user, 24 November
  // 2026: "The goals should be able to display up to four a row before moving on", of these), five columns a side, so twenty
  // goals to one side still fit (the user: "I expect max goals to be around 20"). The ground, its city and nation along the foot. ────────────────────────────────────────────────────────────────────────────────────
  const NT = 70, CAP = (px) => Math.round(px * 0.7);       // the names' top; a Barlow Condensed capital is 0.7 of its size
  const NAME = 40, INFO_H = CAP(NAME) + 12 + 16 + 12 + 16, SC0 = 196, SROW = 16, SMAXC = 5, SW = 740;
  const side = (sd, r) => { const t = SIDE[sd].t, st = STYLE[t.style] || [t.style, "#b3bfcf"];
    return `<div class="bs${r ? " r" : ""}"><img class="bc" src="${crest(t.code)}" alt="">
      <div class="bi"><span class="t bn">${esc(t.name)}</span>
        <span class="bm"><span>${bold(t.manager)}</span><span style="color:${st[1]};font-weight:600">${st[0]}</span></span>
        <span class="bx"><span class="t">${t.code}</span><span class="mono">${xiOvr(sd)}</span></span></div></div>`; };
  const scorerLines = (sd) => { const by = new Map();
    for (const g of goals.filter(g => g.side === sd)) { const k = g.who; if (!by.has(k)) by.set(k, []); by.get(k).push(fmin(g.min, g.add) + (g.pen ? " P" : "")); }
    return [...by].map(([who, ms]) => [sur(who), ms.join(", ")]); };
  const scorers = (sd) => { const L = scorerLines(sd), n = L.length; if (!n) return "";
    const rows = Math.min(n, 4), nc = Math.ceil(n / rows);
    const est = Math.max(...L.map(([w, ms]) => w.length * 7.4 + ms.length * 7.2 + 8)), cw = Math.floor(Math.min(SW / nc, Math.max(120, est + 22)));
    let h = "";
    for (let c = 0; c < nc; c++) { const x = sd === "home" ? 800 - 18 - (c + 1) * cw : 800 + 18 + c * cw;
      h += `<div class="sl${sd === "home" ? " hm" : ""}" style="left:${x}px;width:${cw}px">${L.slice(c * rows, c * rows + rows).map(([w, ms]) =>
        `<div class="sr"><b>${esc(w)}</b><span class="mono">${ms}</span></div>`).join("")}</div>`; }
    return h; };
  const banner = `
  <div class="ban">
    <div class="ph" style="background-image:url('${A}stadiums/${VENUE}.jpg')"></div><div class="veil"></div>
    ${side("home")}${side("away", 1)}
    <div class="cmp"><i></i><span class="t">Friendly</span></div>
    <div class="sco t"><span>${D.score[0]}</span><i></i><span>${D.score[1]}</span></div>
    <div class="ftl t">Full Time</div>
    ${goals.length ? `<span class="ax">${BALL}</span>` : ""}${scorers("home")}${scorers("away")}
    <div class="grd">${VENUE} &middot; ${CITY}, ${NATION}</div>
  </div>`;
  const SCO = 86, SCO_H = CAP(SCO);
  const bannerCss = `
  .ban { position:relative; height:${BAN}px; overflow:hidden; }
  .ban .ph { position:absolute; inset:0; background:center/cover; } .ban .veil { position:absolute; inset:0; background:linear-gradient(180deg,rgba(10,14,23,.5),rgba(10,14,23,.82) 62%,#0a0e17); }
  .bs { position:absolute; top:${NT}px; left:40px; display:flex; align-items:flex-start; gap:22px; }
  .bs.r { left:auto; right:40px; flex-direction:row-reverse; text-align:right; }
  .bs .bc { width:126px; height:126px; margin-top:${Math.round((INFO_H - 126) / 2)}px; object-fit:contain; flex:none; filter:drop-shadow(0 6px 16px rgba(0,0,0,.5)); }
  .bs .bi { display:flex; flex-direction:column; gap:12px; min-width:0; height:${INFO_H}px; } .bs.r .bi { align-items:flex-end; }
  .bs .bn { display:block; height:${CAP(NAME)}px; font-size:${NAME}px; font-weight:700; letter-spacing:.03em; white-space:nowrap; }
  .bs .bm { display:flex; align-items:center; gap:10px; height:16px; font-size:14px; } .bs .bx { display:flex; gap:12px; align-items:center; height:16px; color:var(--text-2); }
  .bs .bx .t { font-size:17px; font-weight:700; letter-spacing:.08em; color:#fff; } .bs .bx .mono { font-size:14px; }
  .cmp { position:absolute; left:0; right:0; top:26px; display:flex; justify-content:center; align-items:center; gap:8px; height:12px; }
  .cmp i { width:4px; height:12px; background:var(--accent); transform:skewX(-20deg); } .cmp .t { font-size:15px; font-weight:700; letter-spacing:.14em; }
  .sco { position:absolute; left:50%; top:${NT}px; width:400px; margin-left:-200px; height:${SCO_H}px; display:grid; grid-template-columns:1fr 36px 1fr; align-items:center;
    font-size:${SCO}px; font-weight:700; font-variant-numeric:tabular-nums; }
  .sco span { text-box:trim-both cap alphabetic; } .sco span:first-child { text-align:right; } .sco i { justify-self:center; width:18px; height:6px; background:#fff; }
  .ftl { position:absolute; left:0; right:0; top:${NT + SCO_H + 20}px; text-align:center; font-size:15px; font-weight:700; letter-spacing:.3em; padding-left:.3em; color:var(--text-2); }
  .ax { position:absolute; left:${800 - 6}px; top:${SC0 + 2}px; color:var(--text-3); }
  .sl { position:absolute; top:${SC0}px; display:flex; flex-direction:column; gap:${SROW - 13}px; }
  .sl.hm { align-items:flex-end; }
  .sr { display:flex; gap:7px; align-items:center; height:13px; font-size:12.5px; white-space:nowrap; } .sl.hm .sr { flex-direction:row-reverse; }
  .sr .mono { font-size:11.5px; color:var(--text-2); }
  .grd { position:absolute; left:0; right:0; top:${SC0 + 4 * SROW + 8}px; text-align:center; font-size:13px; color:var(--text-2); white-space:nowrap; }`;

  // ── THE TIMELINE: the minutes along one line from kick-off to the last whistle; each event on a stem from its minute,
  // home's above and away's below, its minute's plate centred on the stem and what happened beside it (to the left where
  // the right would run off the end). Everything one side did in one minute is one label (a goal and a card at 70' share
  // the plate), so no stem stands on another's. A label goes out a lane until it touches no other label, its stem passes
  // through none nearer the line, and it covers no stem from further out. Cards, goals, missed penalties and injuries;
  // never changes, as the page's timeline always was. The strip is as tall as its lanes. ────────────────────────────────
  const W = 1552, X0 = 46, X1 = W - 46, LH = 16, LG = 6;
  const ev0 = [];
  for (const g of goals) ev0.push({ sd: g.side, m: g.min, add: g.add, k: "goal", who: sur(g.who) });
  for (const sd of ["home", "away"]) for (const b of D.bookings[sd] || []) ev0.push({ sd, m: b.min, add: b.add, k: "yel", who: sur(b.full) });
  const Mx = Math.max(90, ...ev0.map(e => e.m + 1));
  const xOf = (m) => X0 + (X1 - X0) * Math.min(1, m / Mx);
  // One side's events within a minute and a half of each other share a label (and a stem, at the first), each minute on its
  // own plate inside it.
  const groups = [];
  for (const e of ev0.sort((a, b) => a.m - b.m)) { const x = xOf(e.m), g = groups.findLast(q => q.sd === e.sd);
    if (g && x - g.x < 28) g.items.push(e); else groups.push({ sd: e.sd, x, m: e.m, add: e.add, items: [e] }); }
  // Placed from the right, so a label laid over an earlier one's stem is the one further out; those that turn back from the
  // right edge go last. Each takes the nearest lane that breaks nothing. Where no lane will do (a crowd of them at one end),
  // the label joins its neighbour on the left, its minute on its own plate inside the neighbour's, and the lot is placed again.
  // A side too crowded for its names (twenty goals to one side) drops them from the strip, minute and icon only: every
  // name is in the banner and under The Goals as well. Only past that does a label join its neighbour.
  const bare = { home: false, away: false };
  const PW = 40, itemW = (e, i, all) => (i && (e.m !== all[i - 1].m || e.add !== all[i - 1].add) ? PW + 8 : 0) + 6 + 11 + (bare[e.sd] ? 0 : 6 + e.who.length * 7.6);
  let placed;
  for (let tries = 0; tries < 60; tries++) {
    placed = []; let stuck = null;
    const order = groups.map(g => ({ g, w: PW + g.items.reduce((a, e, i, all) => a + itemW(e, i, all), 0) + 4 }))
      .map(o => ({ ...o, flip: o.g.x - 20 + o.w > W - 4 })).sort((p, q) => (p.flip - q.flip) || (q.g.x - p.g.x));
    for (const { g, w, flip } of order) {
      const lo = flip ? g.x + 20 - w : g.x - 20, hi = lo + w;
      const breaks = (k) => placed.some(p => p.sd === g.sd && ((p.k === k && lo < p.hi + 10 && hi > p.lo - 10)
        || (p.k < k && g.x > p.lo - 6 && g.x < p.hi + 6) || (p.k > k && p.x > lo - 6 && p.x < hi + 6)));
      let k = 0; while (k < 6 && breaks(k)) k++;
      if (k === 6) { stuck = g; break; }
      placed.push({ ...g, w, flip, lo, hi, k });
    }
    if (!stuck) break;
    if (!bare[stuck.sd]) { bare[stuck.sd] = true; continue; }
    const mine = groups.filter(q => q.sd === stuck.sd).sort((p, q) => p.x - q.x), at = mine.indexOf(stuck);
    const into = at > 0 ? mine[at - 1] : mine[at + 1];
    if (!into) break;
    into.items = [...into.items, ...stuck.items].sort((p, q) => p.m - q.m);
    groups.splice(groups.indexOf(stuck), 1);
  }
  const upL = 1 + Math.max(0, ...placed.filter(p => p.sd === "home").map(p => p.k)), dnL = 1 + Math.max(0, ...placed.filter(p => p.sd === "away").map(p => p.k));
  const MID = 8 + upL * (LH + LG) + 8, TH = MID + 8 + dnL * (LH + LG) + 4;
  let tl = `<div class="tl"><div class="tla"></div>`;
  for (const [m, l] of [[0, "KO"], [45, "HT"], [Mx, "FT"]]) tl += `<span class="tlm t" style="left:${xOf(m)}px">${l}</span>`;
  for (const p of placed) {
    const up = p.sd === "home", y = up ? MID - 8 - LH - p.k * (LH + LG) : MID + 8 + p.k * (LH + LG);
    // The label in minutes: each minute's plate, then what happened in it. Turned back from the right edge it reads out from
    // the stem the other way: each minute's plate nearest the stem, what happened in it to the left of it.
    const bk = []; for (const e of p.items) { const b0 = bk[bk.length - 1]; if (b0 && b0.m === e.m && (b0.add || 0) === (e.add || 0)) b0.evs.push(e); else bk.push({ m: e.m, add: e.add, evs: [e] }); }
    const ic = (e) => e.k === "goal" ? BALL : `<i class="card"></i>`;
    const html = p.flip
      ? [...bk].reverse().map(b0 => [...b0.evs].reverse().map(e => `<span class="it">${bare[p.sd] ? "" : `<b>${esc(e.who)}</b>`}${ic(e)}</span>`).join("") + mk(p.sd, fmin(b0.m, b0.add))).join("")
      : bk.map(b0 => mk(p.sd, fmin(b0.m, b0.add)) + b0.evs.map(e => `<span class="it">${ic(e)}${bare[p.sd] ? "" : `<b>${esc(e.who)}</b>`}</span>`).join("")).join("");
    tl += `<span class="tls" style="left:${p.x}px;${up ? `top:${y + LH}px;height:${MID - y - LH}px` : `top:${MID}px;height:${y - MID}px`};background:${SIDE[p.sd].hc}"></span>`;
    tl += `<span class="tle" style="${p.flip ? `right:${W - p.x - 20}px` : `left:${p.x - 20}px`};top:${y}px">${html}</span>`;
  }
  tl += `</div>`;
  const tlCss = `
  .tl { position:relative; width:${W}px; height:${TH}px; margin:0 24px; }
  .tla { position:absolute; left:${X0}px; right:${W - X1}px; top:${MID - 1}px; height:2px; background:var(--line-2); }
  .tlm { position:absolute; top:${MID}px; transform:translate(-50%,-50%); padding:0 6px; background:var(--bg); font-size:12px; font-weight:700; letter-spacing:.1em; color:var(--text-3); }
  .tls { position:absolute; width:2px; margin-left:-1px; }
  .tle { position:absolute; display:flex; align-items:center; gap:8px; height:${LH}px; white-space:nowrap; font-size:12.5px; color:#fff; }
  .tle .it { display:flex; align-items:center; gap:6px; } .tle .ic { color:#fff; }`;

  // ── THE MIDDLE BAND: the two sheets and, between them, the numbers in three blocks of one design, each under a head of the
  // sheets' plate height, every row at the sheets' row height; the On The Ball and Off The Ball rows stand on the same lines as
  // the last men of the sheets, Possession above them and Momentum taking the rest, so the column is exactly as tall as the
  // player list however long that is. ────────────────────────────────────────────────────────────────────────────────
  const COLS = "30px 30px minmax(0,1fr) 22px 22px 28px 28px 26px 34px 40px";
  const rh = 17, nRows = Math.max(D.men.home.length, D.men.away.length), sheetH = 26 + 20 + nRows * rh + 7;
  const sheet = (sd) => { const s = SIDE[sd], all = D.men[sd];
    const row = (q) => { const sat = q.kind === "unused", t = top && top.q === q;
      const z = (v, bo) => v ? `<span class="k" style="${bo ? "font-weight:700;color:#fff" : ""}">${v}</span>` : `<span class="z">&ndash;</span>`;
      return `<div class="row${sat ? " sat" : ""}"><span class="p" style="color:${POS(q.pos)}">${q.pos}</span><span>${badge(q.ovr)}</span>
        <span class="n"><span style="overflow:hidden">${bold(q.full)}</span>${t ? `<svg class="star" viewBox="0 0 24 24"><path d="M12 2.6l2.85 5.9 6.5.85-4.75 4.5 1.2 6.45L12 17.2l-5.8 3.1 1.2-6.45-4.75-4.5 6.5-.85z"/></svg>` : ""}${q.rc ? `<i class="card red"></i>` : q.yc ? `<i class="card"></i>` : ""}</span>
        ${z(q.g, 1)}${z(q.a, 1)}${z(q.cc)}${z(q.dc)}${z(q.sv)}
        <span class="rt" style="color:${sat ? "#4b5a70" : rateClr(q.r)}">${sat ? "&ndash;" : q.r.toFixed(1)}</span>
        <span class="tm">${q.on != null ? `<span style="color:var(--ok)">&#8593;${q.on}'</span>` : ""}${q.off != null ? `<span style="color:var(--danger)">&#8595;${q.off}'</span>` : ""}</span></div>`; };
    const start = all.filter(q => q.kind === "start"), rest = all.filter(q => q.kind !== "start");
    return `<div class="sh" style="--cols:${COLS};height:${sheetH}px">
      <div class="hd" style="background:${s.kit};--edge:${s.edge}"><img src="${crest(s.t.code)}" alt=""><span class="t">${esc(s.t.name)}</span><span class="c">${s.t.code}</span></div>
      <div class="row ch"><span></span><span>OVR</span><span style="text-align:left">Player</span><span>G</span><span>A</span><span>CC</span><span>DC</span><span>SV</span><span>RTG</span><span></span></div>
      ${start.map(row).join("")}<div class="rule"></div>${rest.map(row).join("")}</div>`; };
  const stRow = ([lab, [h, a], dp, suf]) => {
    const mx = suf ? 100 : Math.max(h, a, 1), f = (v) => (dp ? v.toFixed(dp) : v) + (suf || ""), hi = h > a, ai = a > h;
    return `<div class="st"><span class="v r${hi ? " on" : ""}" style="${hi ? "color:" + SIDE.home.hc : ""}">${f(h)}</span>
      <span class="b l2"><i style="width:${100 * h / mx}%;${hi ? "background:" + SIDE.home.hc : ""}"></i></span><span class="l">${lab}</span>
      <span class="b"><i style="width:${100 * a / mx}%;${ai ? "background:" + SIDE.away.hc : ""}"></i></span><span class="v${ai ? " on" : ""}" style="${ai ? "color:" + SIDE.away.hc : ""}">${f(a)}</span></div>`; };
  const on = [["xG", S.xg, 2], ["Shots", S.shots], ["On Target", S.ot], ["Woodwork", S.wood], ["Corners", S.corners], ["Passes", S.passes],
    ["Pass %", [pct(S.passOk[0], S.passes[0]), pct(S.passOk[1], S.passes[1])], 0, "%"], ["Carries", S.carries], ["Offsides", S.offs]];
  const off = [["Saves", S.saves], ["Blocks", S.blocks], ["Clearances", S.clears], ["Tackles Won", S.tw],
    ["Tackle %", [pct(S.tw[0], S.tt[0]), pct(S.tw[1], S.tt[1])], 0, "%"], ["Fouls", S.fouls], ["Yellows", S.yel], ["Reds", S.reds]];
  // Every row of the column on one of the sheets' row lines: a sheet's row i starts at 46 + 17i (past the plate and the column
  // heads), 7 lower after the starters' rule. The numbers' rows take the sheets' last lines; Possession's row the line three
  // above their head; Momentum what is left above.
  const nSt = Math.max(on.length, off.length), rowTop = (i) => 46 + i * rh + (i >= 11 ? 7 : 0);
  const stRow0 = nRows - nSt, statsTop = rowTop(stRow0) - 26, possRow = stRow0 - 3, possTop = rowTop(possRow) - 26;
  const statsH = sheetH - statsTop, possH = statsTop - possTop, momH = possTop, chartH = momH - 26 - 16, GAP = 0;
  const CW = 1600 - 48 - 2 * 470 - 2 * 24;
  const chart = (() => { const b = D.mom.b, n = Math.max(94, b.length), Wc = CW - 40, bw = Wc / n, M2 = chartH / 2;
    const sm = b.map((v, i) => { const r = (j) => (b[j] ? b[j][0] - b[j][1] : null), c = r(i); return 0.25 * (r(i - 1) ?? c) + 0.5 * c + 0.25 * (r(i + 1) ?? c); });
    const mx = Math.max(3, ...sm.map(Math.abs));
    let s = `<svg width="${Wc}" height="${chartH}" style="display:block;overflow:visible"><line x1="0" x2="${Wc}" y1="${M2}" y2="${M2}" stroke="#3a4d66"/>
      <line x1="${45 * bw + bw}" x2="${45 * bw + bw}" y1="0" y2="${chartH}" stroke="#7889a0" stroke-dasharray="2 3"/>`;
    sm.forEach((v, i) => { const h = Math.abs(v) / mx * (M2 - 9); if (h < 0.4) return;
      s += `<rect x="${i * bw + 0.4}" width="${Math.max(0.6, bw - 0.8)}" y="${v > 0 ? M2 - h : M2}" height="${h}" fill="${v > 0 ? SIDE.home.hc : SIDE.away.hc}"/>`; });
    for (const g of D.mom.g) s += `<circle cx="${g.i * bw + bw / 2}" cy="${g.side === "home" ? 4 : chartH - 4}" r="3.6" fill="${SIDE[g.side].hc}" stroke="#fff" stroke-width="1.2"/>`;
    return `<div class="mc"><div class="mk2"><span class="t" style="color:${SIDE.home.hc}">${D.h.code}</span><span class="t" style="color:${SIDE.away.hc}">${D.a.code}</span></div>${s}</div>`; })();
  const middle = `
  <div class="band" style="height:${sheetH}px">
    ${sheet("home")}
    <div class="num">
      <div style="height:${momH}px"><div class="h"><span>Momentum</span></div>${chart}</div>
      <div style="height:${possH}px"><div class="h"><span>Possession</span></div>
        <div class="pz"><span class="v r on mono" style="color:${SIDE.home.hc}">${pc[0]}%</span>
          <span class="pb"><i style="width:${pc[0]}%;background:${SIDE.home.hc}"></i><i style="flex:1;background:${SIDE.away.hc}"></i></span>
          <span class="v on mono" style="color:${SIDE.away.hc}">${pc[1]}%</span></div></div>
      <div class="two" style="height:${statsH}px">
        <div><div class="h"><span>On The Ball</span></div>${on.map(stRow).join("")}</div>
        <div><div class="h"><span>Off The Ball</span></div>${off.map(stRow).join("")}</div></div>
    </div>
    ${sheet("away")}
  </div>`;
  const middleCss = `
  .band { display:grid; grid-template-columns:470px minmax(0,1fr) 470px; gap:24px; padding:0 24px; margin-top:8px; }
  .num { display:flex; flex-direction:column; gap:${GAP}px; min-width:0; }
  .num .two { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .num .st { grid-template-columns:40px 1fr 96px 1fr 40px; gap:6px; }
  .pz { display:grid; grid-template-columns:40px 1fr 40px; gap:6px; align-items:center; height:var(--rh); font-size:12px; font-weight:700; }
  .pz .r { text-align:right; } .pb { display:flex; gap:2px; height:6px; }
  .mc { display:flex; gap:10px; margin-top:6px; } .mk2 { display:flex; flex-direction:column; justify-content:space-between; padding:2px 0; width:30px; }
  .mk2 .t { font-size:13px; font-weight:700; letter-spacing:.06em; }`;

  // ── THE GOALS: a card each, its head and its pitch inside one panel on one left edge: the minute's plate, the scorer and
  // who made it, the score; then the move (the passes as dots, the shot a gold line) and the replay button in its corner. ──
  const pitch = (c, sc) => { const F = c.frames, L = F.length - 1, fl = F[L].bx < 52.5, X = (v) => fl ? 105 - v : v, Y = (v) => fl ? 68 - v : v;
    const ev = F.flatMap((f, j) => (f.ev || []).map(e => ({ ...e, t: j - 0.5 })));
    const shot = [...ev].reverse().find(e => e.side === c.side && e.k === "shot") || [...ev].reverse().find(e => e.side === c.side && e.k === "head");
    const sT = shot ? shot.t : L - 6;
    let s = `<svg viewBox="-0.6 -0.6 106.2 69.2" style="display:block;width:100%"><rect x="-0.6" y="-0.6" width="106.2" height="69.2" fill="#1f4a2c"/>`;
    for (let k = 0; k < 10; k++) if (k % 2) s += `<rect x="${k * 10.5}" y="0" width="10.5" height="68" fill="#22502f"/>`;
    s += `<g stroke="rgba(255,255,255,.45)" stroke-width=".3" fill="none"><rect x="0" y="0" width="105" height="68"/><line x1="52.5" y1="0" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/>
      <rect x="0" y="13.85" width="16.5" height="40.3"/><rect x="88.5" y="13.85" width="16.5" height="40.3"/><rect x="0" y="24.85" width="5.5" height="18.3"/><rect x="99.5" y="24.85" width="5.5" height="18.3"/></g>`;
    for (const e of ev) if (e.side === c.side && (e.k === "pass" || e.k === "head") && e.t < sT)
      s += `<line x1="${X(e.x0)}" y1="${Y(e.y0)}" x2="${X(e.x1)}" y2="${Y(e.y1)}" stroke="#fff" stroke-opacity=".85" stroke-width=".55" stroke-linecap="round" stroke-dasharray="0 1.3"/><circle cx="${X(e.x0)}" cy="${Y(e.y0)}" r=".65" fill="#fff"/>`;
    const pts = [shot ? [shot.x0, shot.y0] : null, ...F.slice(Math.ceil(sT)).map(f => [f.bx, f.by])].filter(Boolean).map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
    s += `<polyline points="${pts}" fill="none" stroke="#ffd166" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const sd of [0, 1]) for (let k = 0; k < 11; k++) { const j = sd * 22 + k * 2, x = F[L].xy[j], y = F[L].xy[j + 1]; if (x < -50) continue;
      s += `<circle cx="${X(x)}" cy="${Y(y)}" r="1.05" fill="${c.gk && c.gk[sd * 11 + k] ? "#f5e663" : sd ? SIDE.away.hc : SIDE.home.hc}" stroke="rgba(0,0,0,.6)" stroke-width=".16"/>`; }
    s += `<circle cx="${X(F[L].bx)}" cy="${Y(F[L].by)}" r=".75" fill="#fff" stroke="#000" stroke-width=".15"/></svg>`;
    return `<div class="gp">${s}${sc ? `<span class="gsc mono">${sc}</span>` : ""}<span class="dl" title="Save GIF"><svg viewBox="-1 -1 2 2" width="11" height="11" fill="none" stroke="#fff" stroke-width=".22" stroke-linecap="round" stroke-linejoin="round"><path d="M 0 -0.6 L 0 0.25 M -0.36 -0.1 L 0 0.27 L 0.36 -0.1 M -0.5 0.6 L 0.5 0.6"/></svg></span><span class="play"><svg viewBox="-1 -1 2 2" width="9" height="9"><path d="M -0.45 -0.65 L 0.7 0 L -0.45 0.65 Z" fill="#fff"/></svg></span></div>`; };
  const top0 = BAN + TH + 8 + sheetH + 12, goalsH = 1092 - top0 - 26 - 6 - 14;
  // As big as the strip allows: one row, or two or three when that makes every card bigger. A narrow card names the scorer
  // by surname alone.
  const n = goals.length, HEAD = 8 + 22 + 8 + 8;
  let fit = { cw: 0, rows: 1, per: n };
  for (let rows = 1; rows <= 3 && n; rows++) { const per = Math.ceil(n / rows);
    const byW = (1552 - 14 * (per - 1)) / per, byH = ((goalsH - 10 * (rows - 1)) / rows - HEAD) * 106.2 / 69.2 + 19;
    const cw = Math.floor(Math.min(byW, byH, 340)); if (cw > fit.cw) fit = { cw, rows, per }; }
  const cw = fit.cw, narrow = cw < 240, tiny = cw < 190;
  const goalCard = (g) => `<div class="gc" style="width:${cw}px;box-shadow:inset 3px 0 0 ${SIDE[g.side].hc}">
      <div class="gh">${mk(g.side, fmin(g.min, g.add))}<span class="gw">${narrow ? `<b>${esc(sur(g.who))}</b>` : bold(g.who)}${g.ast && !narrow ? ` <span class="ga">${esc(sur(g.ast))}</span>` : ""}</span>${tiny ? "" : `<span class="mono gs">${g.score}</span>`}</div>
      ${pitch(g, tiny ? g.score : null)}</div>`;
  // Past what a card can show a move at (narrower than 160), every goal is a chip instead: its minute, scorer, the score and
  // the replay button, five to a row, in order.
  const chip = (g) => `<div class="gx" style="box-shadow:inset 3px 0 0 ${SIDE[g.side].hc}">${mk(g.side, fmin(g.min, g.add))}<span class="gw"><b>${esc(sur(g.who))}</b></span>
      <span class="mono gs">${g.score}</span><span class="dl sm" title="Save GIF"><svg viewBox="-1 -1 2 2" width="11" height="11" fill="none" stroke="#fff" stroke-width=".22" stroke-linecap="round" stroke-linejoin="round"><path d="M 0 -0.6 L 0 0.25 M -0.36 -0.1 L 0 0.27 L 0.36 -0.1 M -0.5 0.6 L 0.5 0.6"/></svg></span><span class="play sm"><svg viewBox="-1 -1 2 2" width="8" height="8"><path d="M -0.45 -0.65 L 0.7 0 L -0.45 0.65 Z" fill="#fff"/></svg></span></div>`;
  const goalsHtml = `<div style="padding:12px 24px 0"><div class="h"><span>The Goals</span></div>
    ${cw >= 160 ? `<div style="display:flex;flex-wrap:wrap;gap:10px 14px;justify-content:center;margin:6px auto 0;width:${fit.per * cw + 14 * (fit.per - 1)}px">${goals.map(goalCard).join("")}</div>`
      : `<div class="gxs">${goals.map(chip).join("")}</div>`}</div>`;
  const goalsCss = `
  .gc { background:var(--panel); padding:8px 8px 8px 11px; display:flex; flex-direction:column; gap:8px; }
  .gh { display:flex; align-items:center; gap:9px; height:22px; } .gw { flex:1; min-width:0; white-space:nowrap; overflow:hidden; font-size:12.5px; } .ga { color:var(--text-3); }
  .gs { font-weight:700; font-size:12px; }
  .gxs { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:8px 14px; margin-top:6px; }
  .gx { display:flex; align-items:center; gap:9px; height:30px; padding:0 8px 0 11px; background:var(--panel); font-size:12.5px; }
  .play.sm { position:static; width:20px; height:20px; flex:none; }
  .dl { position:absolute; right:6px; top:6px; width:24px; height:24px; border:1px solid rgba(255,255,255,.3); border-radius:50%; background:rgba(0,0,0,.5); display:grid; place-items:center; }
  .dl.sm { position:static; width:20px; height:20px; flex:none; }
  .gsc { position:absolute; left:6px; bottom:6px; padding:3px 5px; background:rgba(0,0,0,.55); font-weight:700; font-size:11px; }
  .gp { position:relative; } .play { position:absolute; right:6px; bottom:6px; width:24px; height:24px; border:1px solid rgba(255,255,255,.3); border-radius:50%; background:rgba(0,0,0,.5); display:grid; place-items:center; }`;

  writeFileSync(HERE + file, `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}${bannerCss}${tlCss}${middleCss}${goalsCss}</style></head><body>
  ${banner}${tl}${middle}${goalsHtml}</body></html>`);
  return { sheetH, momH, possH, statsH };
};

console.log(build(D0, "fulltime-a.html", "Full Time"));
// The banner under load: the same match with fifteen more goals, twenty in all (a stress test, not a result).
const many = structuredClone(D0);
const NAMES = ["Kenta Mori", "Daichi Sato", "Hiro Abe", "Jun Ito", "Ren Ota", "Yuto Kato", "Sho Endo", "Kai Ueda", "Taro Mori", "Ryo Kudo", "Aki Noda", "Gen Tani",
               "Ken Oka", "Jo Baba", "Yu Mita"];
many.clips = [...D0.clips, ...NAMES.map((n, i) => ({ ...D0.clips[i % D0.clips.length], side: i % 4 ? "home" : "away", min: 4 + i * 6, add: 0, txt: n }))];
many.score = [many.clips.filter(c => c.side === "home").length, many.clips.filter(c => c.side === "away").length];
build(many, "fulltime-a-many.html", "Full Time, Twenty Goals");
// And twenty to one side, every one by a different man: the most the banner is planned for.
const one = structuredClone(D0), N20 = [...NAMES, "Ike Sano", "Mu Kōno", "Tsu Hara", "Ei Iida", "Ao Yano"];
one.clips = N20.map((n, i) => ({ ...D0.clips[2 + (i % 3)], side: "home", min: 3 + i * 4 + (i > 10 ? 2 : 0), add: 0, txt: n, score: `${i + 1}-0` }));
one.score = [20, 0]; one.bookings = { home: [], away: D0.bookings.away };
build(one, "fulltime-a-twenty.html", "Full Time, Twenty To One Side");
console.log("wrote fulltime-a.html, fulltime-a-many.html, fulltime-a-twenty.html");
