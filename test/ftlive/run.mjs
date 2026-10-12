// Full Time in the real app: matches simmed to the whistle from Play Match, the page drawn at its design size (1600 x 1092)
// and the Copy Image picture, with the banner measured: each crest level with the score, the room left above and below the
// board, and every side whose name or manager line would not fit at the new size.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=9334", "--window-size=1600,1092", "about:blank"], { stdio: "ignore" });
let tgt;
for (let i = 0; i < 150 && !tgt; i++) { try { tgt = await (await fetch("http://127.0.0.1:9334/json/new?about:blank", { method: "PUT" })).json(); } catch { await sleep(200); } }
const ver = await (await fetch("http://127.0.0.1:9334/json/version")).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const wait = new Map(), errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 800));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const val = async (expression, userGesture = false) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture }); if (r.result?.exceptionDetails) errors.push("eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
// Clipboard permission is the browser's to give, so it goes over the browser's own socket.
{ const bw = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => bw.addEventListener("open", r, { once: true }));
  const res = await new Promise(r => { bw.addEventListener("message", (e) => r(JSON.parse(e.data)), { once: true });
    bw.send(JSON.stringify({ id: 1, method: "Browser.grantPermissions", params: { origin: new URL(base).origin, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] } })); });
  console.log("clipboard permission:", res.error ? "refused " + JSON.stringify(res.error) : "granted"); bw.close(); }
await send("Page.enable"); await send("Runtime.enable");
await send("Network.enable"); await send("Network.setBlockedURLs", { urls: ["*avium-registry*"] });
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1092, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
const until = async (expr, n = 60) => { for (let i = 0; i < n; i++) { if (await val(expr)) return true; await sleep(500); } return false; };
const button = async (label) => val(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; if (b.disabled) return 'disabled'; b.click(); return true; })()`);
const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, "base64")); };

// The banner, measured in design pixels (the page is drawn at 1600 x 1092, so one CSS pixel is one design pixel).
const MEASURE = `(() => {
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) }; };
  const ban = document.querySelector('.ux-ftban'); if (!ban) return null;
  const c2 = document.createElement('canvas').getContext('2d');
  // Where an element's glyphs fall: its baseline from the font's own metrics and the element's box, then the extent of the
  // sample glyphs round it (H for capitals, 0 for figures, or the element's own text).
  const glyph = (el, sample) => { if (!el) return null; const cs = getComputedStyle(el), rb = el.getBoundingClientRect();
    c2.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const fm = c2.measureText(sample == null ? el.textContent : sample), pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
    const h = rb.height - pt - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth);
    const base = rb.top + pt + (h - (fm.fontBoundingBoxAscent + fm.fontBoundingBoxDescent)) / 2 + fm.fontBoundingBoxAscent;
    const top = base - fm.actualBoundingBoxAscent, bot = base + fm.actualBoundingBoxDescent;
    return { top: +top.toFixed(1), base: +base.toFixed(1), bot: +bot.toFixed(1), mid: +((top + bot) / 2).toFixed(1) }; };
  const scaleOf = (el) => { if (!el) return null; const t = getComputedStyle(el).transform; return t && t.startsWith('matrix(') ? +(+t.slice(7).split(',')[0]).toFixed(3) : 1; };
  const crestInk = (img) => { if (!img || img.tagName !== 'IMG' || !img.naturalWidth) return null;
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, cv.width, cv.height).data;
    let t = 1e9, b = -1, l = 1e9, r = -1;
    for (let yy = 0; yy < cv.height; yy++) for (let xx = 0; xx < cv.width; xx++) if (d[(yy * cv.width + xx) * 4 + 3] > 24) { if (yy < t) t = yy; if (yy > b) b = yy; if (xx < l) l = xx; if (xx > r) r = xx; }
    const bb = img.getBoundingClientRect(), s = Math.min(bb.width / cv.width, bb.height / cv.height);
    const ox = bb.left + (bb.width - cv.width * s) / 2, oy = bb.top + (bb.height - cv.height * s) / 2;
    return { top: +(oy + t * s).toFixed(1), bot: +(oy + (b + 1) * s).toFixed(1), mid: +(oy + (t + b + 1) / 2 * s).toFixed(1) }; };
  const score = ban.querySelector('.ux-ftban-score'), ft = ban.querySelector('.ux-ftban-ft'), comp = ban.querySelector('.ux-ftban-comp');
  const art = comp?.querySelector('img'), artShown = !!art && getComputedStyle(art).display !== 'none';
  const ground = ban.querySelector('.ux-ftban-ground'), extra = ban.querySelector('.ux-ftban-extra');
  const fig = glyph(score, '0'), ftG = glyph(ft, 'H');
  const side = (s) => { const crest = s.querySelector(':scope > img, :scope > svg'), nameLine = s.querySelector('.ux-ftban-name > span'), mLine = s.querySelector('.ux-ftban-mtext > span');
    const code = s.querySelector('.ux-ftban-code'), mName = mLine?.firstElementChild, face = s.querySelector('.ux-ftban-mface');
    const cap = glyph(nameLine, 'H'), metaG = glyph(code, 'H'), mg = glyph(mName, 'H'), fr = R(face);
    const avail = crest ? +(s.getBoundingClientRect().width - crest.getBoundingClientRect().width - parseFloat(getComputedStyle(s).columnGap || getComputedStyle(s).gap)).toFixed(1) : null;
    return { avail, name: nameLine?.textContent, nameScale: scaleOf(nameLine), mgrScale: scaleOf(mLine), box: R(s), id: R(s.querySelector('.ux-ftban-id')), crest: R(crest), crestInk: crestInk(crest),
      nameCapTop: cap?.top, nameBase: cap?.base, metaBase: metaG?.base, mgrCapMid: mg?.mid, faceMid: fr ? +(fr.y + fr.h / 2).toFixed(1) : null,
      figTopOff: cap && fig ? +(fig.top - cap.top).toFixed(1) : null, figFootOff: metaG && fig ? +(fig.base - metaG.base).toFixed(1) : null,
      ftOff: mg && ftG ? +(ftG.mid - mg.mid).toFixed(1) : null, ftFaceOff: fr && ftG ? +(ftG.mid - (fr.y + fr.h / 2)).toFixed(1) : null }; };
  const sides = [...ban.querySelectorAll('.ux-ftban-side')].map(side);
  const inkTop = artShown ? R(art).y : glyph(comp?.querySelector('span'), 'H')?.top, inkBot = glyph(ground)?.bot;
  const bb = ban.getBoundingClientRect();
  return { banner: R(ban), artShown, art: artShown ? R(art) : null, compText: comp?.querySelector('span')?.textContent, compCap: glyph(comp?.querySelector('span'), 'H'),
    scoreText: score?.textContent, score: R(score), fig, ftText: ft?.textContent, ft: ftG, extra: extra?.textContent || null, extraG: glyph(extra, 'H'), groundText: ground?.textContent, ground: glyph(ground),
    roomAbove: inkTop != null ? +(inkTop - bb.top).toFixed(1) : null, roomBelow: inkBot != null ? +(bb.bottom - inkBot).toFixed(1) : null,
    gapArtToComp: artShown ? +(glyph(comp.querySelector('span'), 'H').top - R(art).b).toFixed(1) : null,
    gapCompToNames: sides.length ? +(Math.min(...sides.map(x => x.nameCapTop)) - glyph(comp?.querySelector('span'), 'H').base).toFixed(1) : null,
    gapFtToNext: ftG ? +(((extra ? glyph(extra, 'H').top : glyph(ground, 'H').top)) - Math.max(ftG.base, ...sides.map(x => x.id.b))).toFixed(1) : null,
    sides }; })()`;

// The middle band: the numbers' last line against each team sheet's last man, the momentum chart and its goals.
const BAND = `(() => {
  const mom = document.querySelector('.ux-ftmom'); if (!mom) return null;
  const centre = mom.parentElement, band = centre.parentElement, kids = [...band.children];
  const mid = (e) => { const b = e.getBoundingClientRect(); return +(b.top + b.height / 2).toFixed(1); };
  const sheets = [kids[0], kids[2]].map(sh => { const rows = [...sh.querySelectorAll('div')].filter(d => getComputedStyle(d).display === 'grid');
    const last = rows[rows.length - 1]; return { rows: rows.length - 1, lastName: last?.textContent.slice(0, 40), lastMid: last ? mid(last) : null, bottom: +sh.getBoundingClientRect().bottom.toFixed(1), rowH: last ? +last.getBoundingClientRect().height.toFixed(1) : null }; });
  const stats = centre.lastElementChild, col = stats.firstElementChild, lastStat = col.lastElementChild;
  const svg = mom.querySelector('svg'), mb = mom.getBoundingClientRect(), cb = centre.getBoundingClientRect();
  return { sheets, statsLast: lastStat?.textContent, statsLastMid: lastStat ? mid(lastStat) : null, statRowH: lastStat ? +lastStat.getBoundingClientRect().height.toFixed(1) : null,
    centreTop: +cb.top.toFixed(1), centreBottom: +cb.bottom.toFixed(1), chart: { w: +mb.width.toFixed(1), h: +mb.height.toFixed(1), top: +mb.top.toFixed(1) },
    bars: svg ? svg.querySelectorAll('rect').length : 0, goals: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent) : [],
    sheetTop: +kids[0].getBoundingClientRect().top.toFixed(1) }; })()`;

const results = {};
const finish = async (name, info) => {
  const ft = await until("!!document.querySelector('.ux-ftban')", 160);
  await sleep(3000);
  const m = await val(MEASURE), band = await val(BAND);
  results[name] = { ...info, ft, m, band };
  await shot("ft-" + name);
  // The picture Copy Image makes, caught as the app hands it to the clipboard.
  await val(`navigator.clipboard.write = async (items) => { window.__ftItems = items; }; true`);
  const copied = await val(`(async () => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Copy Image'); if (!b) return 'no button'; b.click();
    for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 250)); const t = [...document.querySelectorAll('button')].map(x => x.textContent.trim()).find(x => /^(Copied|Copy Failed)$/.test(x)); if (t) return t; } return 'timeout'; })()`, true);
  results[name].copied = copied;
  if (copied === "Copied") {
    const data = await val(`(async () => { const it = window.__ftItems?.[0]; if (!it) return null; const blob = await it.getType('image/png');
      return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); })()`, true);
    if (typeof data === "string") writeFileSync(`${out}/copy-${name}.png`, Buffer.from(data.split(",")[1], "base64")); else console.log("no picture back:", JSON.stringify(data));
  }
  console.log("\n==", name, JSON.stringify(info), "| full time", ft, "| copy", copied);
  if (band) {
    console.log("band | sheets' rows", band.sheets.map(x => x.rows + " (row " + x.rowH + ", last man's middle " + x.lastMid + ")").join(" / "),
      "| numbers' last line", JSON.stringify(band.statsLast), "middle", band.statsLastMid, "(row " + band.statRowH + ")",
      "| off the longer sheet's last man by", (band.statsLastMid - Math.max(...band.sheets.map(x => x.lastMid))).toFixed(1));
    console.log("chart", band.chart.w + "x" + band.chart.h, "top", band.chart.top, "(sheets' top " + band.sheetTop + ")", "| bars", band.bars, "| goals", JSON.stringify(band.goals));
  } else console.log("NO BAND");
  if (!m) { console.log("NO BANNER"); return; }
  console.log("banner", m.banner.w + "x" + m.banner.h, "| ink room above", m.roomAbove, "below", m.roomBelow, "| mark", m.artShown ? m.art.w + "x" + m.art.h : "none", "| comp", JSON.stringify(m.compText),
    "| mark to comp", m.gapArtToComp, "comp baseline to names' capitals", m.gapCompToNames, "| FULL TIME (or the side) to the next line", m.gapFtToNext);
  console.log("score", JSON.stringify(m.scoreText), "figures", m.fig.top, "-", m.fig.base, "(" + (m.fig.base - m.fig.top).toFixed(1) + " tall) | FULL TIME", JSON.stringify(m.ftText), "caps mid", m.ft.mid, "| extra", JSON.stringify(m.extra), "| ground", JSON.stringify(m.groundText));
  for (const s of m.sides) console.log("side", JSON.stringify(s.name), "| name scale", s.nameScale, "manager scale", s.mgrScale,
    "| figures' top minus capitals' top", s.figTopOff, "| figures' foot minus code baseline", s.figFootOff, "| FULL TIME minus manager caps", s.ftOff, "minus face", s.ftFaceOff,
    "| crest ink mid", s.crestInk?.mid, "text block", s.id.y, "-", s.id.b);
};

const friendly = async (name, theme, home, away) => {
  await send("Page.navigate", { url: base }); await sleep(2500);
  await val(`localStorage.setItem("avium-theme", ${JSON.stringify(theme)}); true`);
  await send("Page.navigate", { url: base + "#/live/" + home + "/" + away }); await sleep(1500);
  await send("Page.reload"); await sleep(4500);
  const venue = await val(`(() => { const g = document.querySelector('[aria-label="Venue"]'); const b = g && [...g.querySelectorAll('button')].find(x => x.textContent.trim() === 'Home Ground'); if (b) b.click(); return !!b; })()`);
  await sleep(600);
  const sim = await button("Sim To End");
  await finish(name, { theme, home, away, venue, sim });
};
// A tournament's fixture: the 1935 World Cup's field as a one-legged cup, its first tie played live and simmed to the end.
const tournament = async (name, theme) => {
  await send("Page.navigate", { url: base }); await sleep(2500);
  await val(`localStorage.setItem("avium-theme", ${JSON.stringify(theme)}); true`);
  await send("Page.navigate", { url: base + "#/tournament" }); await sleep(1500);
  await send("Page.reload"); await sleep(4500);
  const steps = [];
  steps.push(await button("New Tournament")); await sleep(1500);
  const pick = (v) => val(`(() => { const s = document.querySelector('select[aria-label="Preset"]'); if (!s) return 'no select'; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change', { bubbles: true })); return 'picked'; })()`);
  steps.push(await pick("p:1935 World Cup")); await sleep(1500);
  steps.push(await pick("f:cup")); await sleep(1500);
  steps.push(await button("Create Tournament")); await sleep(3500);
  // An odd field asks for byes first: the best-ranked side takes it.
  steps.push(await val(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^Top \\d+ By Ranking$/.test(x.textContent.trim())); if (!b) return 'no byes'; b.click(); return 'byes'; })()`)); await sleep(1200);
  steps.push(await button("Confirm Byes")); await sleep(3500);
  steps.push(await val(`(() => { const b = document.querySelector('button[title="Play It Live"], button[aria-label="Play It Live"]'); if (!b) return 'no live button'; b.click(); return 'live'; })()`)); await sleep(4000);
  steps.push(await button("Sim To End"));
  await finish(name, { theme, steps });
};

await friendly("friendly", "stsc", "tsukumo-shinkeisei", "nishijin");
await friendly("mixed", "nl1", "dynamo-mizuhara", "nichirin");
await tournament("tournament", "1935skj");

// Every side at the new size: the name at 48px and the manager line, against the room the three matches above left.
const teams = JSON.parse(readFileSync("src/data/teams.json", "utf8")), managers = JSON.parse(readFileSync("src/data/managers.json", "utf8"));
const mById = new Map(managers.map(x => [x.id, x]));
const rows = teams.filter(t => !t.removed).map(t => { const mg = mById.get(t.manager && typeof t.manager === "object" ? t.manager.id : t.manager); return { name: t.name, file: t.file, mgr: mg?.name || "", style: t.style || "" }; });
const avails = Object.entries(results).filter(([, v]) => v.m).map(([k, v]) => [k, Math.min(...v.m.sides.map(x => x.avail))]);
const survey = await val(`(() => { const rows = ${JSON.stringify(rows)}, avails = ${JSON.stringify(avails)};
  const page = document.querySelector('.ux-ftban').parentElement;
  const host = document.createElement('div'); host.className = 'ux-ftban'; host.style.cssText = 'position:absolute;left:-30000px;top:0;height:auto;display:block;padding:0';
  page.appendChild(host);
  const nm = document.createElement('span'); nm.className = 'ux-ftban-name'; nm.style.cssText = 'display:inline-block;white-space:nowrap'; host.appendChild(nm);
  const mg = document.createElement('span'); mg.className = 'ux-ftban-mgr'; mg.style.display = 'inline-flex'; host.appendChild(mg);
  const res = rows.map(r => { nm.textContent = r.name; const nameW = nm.getBoundingClientRect().width;
    const parts = r.mgr.split(' '), last = parts.pop(), first = parts.join(' ');
    mg.innerHTML = '<span class="ux-ftban-mface"></span><span class="ux-ftban-mtext"><span><span></span><span style="font-weight:600"></span></span></span>';
    const ln = mg.querySelector('.ux-ftban-mtext > span'); ln.children[0].innerHTML = (first ? first + ' ' : '') + '<b></b>'; ln.querySelector('b').textContent = last ? last[0] + last.slice(1).toLowerCase() : ''; ln.children[1].textContent = r.style;
    const mgrW = r.mgr ? mg.getBoundingClientRect().width : 0;
    const at = {}; for (const [k, a] of avails) at[k] = { name: Math.min(1, a / nameW), mgr: r.mgr ? Math.min(1, a / mgrW) : 1 };
    return { ...r, nameW: Math.round(nameW), mgrW: Math.round(mgrW), at }; });
  host.remove(); return res; })()`);
writeFileSync(`${out}/results.json`, JSON.stringify({ results, survey, errors }, null, 1));
if (!survey) console.log("NO SURVEY");
else for (const [k, a] of avails) {
  const nar = survey.filter(r => r.at[k].name < 1).sort((x, y) => x.at[k].name - y.at[k].name), mnar = survey.filter(r => r.at[k].mgr < 1).sort((x, y) => x.at[k].mgr - y.at[k].mgr);
  const band = (f) => nar.filter(r => r.at[k].name >= f[0] && r.at[k].name < f[1]).length;
  console.log("\nroom beside the crest in", k, "=", a, "| names narrowed", nar.length, "of", survey.length, "(0.9-1:", band([0.9, 1]), "0.8-0.9:", band([0.8, 0.9]), "0.7-0.8:", band([0.7, 0.8]), "under 0.7:", band([0, 0.7]) + ") | manager lines narrowed", mnar.length);
  console.log("  narrowest names:", nar.slice(0, 12).map(r => r.name + " " + r.at[k].name.toFixed(2)).join(", "));
  if (mnar.length) console.log("  manager lines:", mnar.slice(0, 12).map(r => r.mgr + " / " + r.style + " " + r.at[k].mgr.toFixed(2)).join(", "));
}
console.log("\nerrors:", errors.length ? errors.join("\n") : "none");
ws.close(); chrome.kill(); process.exit(0);
