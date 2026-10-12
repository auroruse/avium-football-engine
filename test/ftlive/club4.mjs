// A club's page in the real app at several window sizes, after the profile became one sidebar: every piece of text cut
// short anywhere on the page (outside the pitch), the sidebar's sections and whether it has to scroll, the pitch and the
// bench beside it, and how many of the app's club names would slide in the sidebar's heading at its width.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=9334", "--window-size=1600,1092", "about:blank"], { stdio: "ignore" });
let tgt;
for (let i = 0; i < 150 && !tgt; i++) { try { tgt = await (await fetch("http://127.0.0.1:9334/json/new?about:blank", { method: "PUT" })).json(); } catch { await sleep(200); } }
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const wait = new Map(), errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 800));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const val = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) errors.push("eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Network.enable"); await send("Network.setBlockedURLs", { urls: ["*avium-registry*"] });
const until = async (expr, n = 60) => { for (let i = 0; i < n; i++) { if (await val(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, "base64")); };
const go = async (hash) => { await send("Page.navigate", { url: base + hash }); await sleep(4000); await until("!!document.querySelector('.ux-body')", 30); await sleep(1800); };
const view = (k) => val(`(() => { const b = [...document.querySelectorAll('[aria-label="Squad View"] button')].find(x => x.textContent === ${JSON.stringify(k)}); if (!b) return false; b.click(); return true; })()`);
await send("Page.navigate", { url: base }); await sleep(2500);

const MEAS = `(() => {
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  // Text cut short: any box that clips across and holds more text than it shows. Nested boxes report the same words once.
  const clipped = (root) => { const seen = new Map();
    for (const el of root.querySelectorAll('*')) {
      const t = el.textContent.trim(); if (!t) continue;
      const cs = getComputedStyle(el); if (!/hidden|clip/.test(cs.overflowX)) continue;
      const d = el.scrollWidth - el.clientWidth; if (d > 1 && !seen.has(t)) seen.set(t, d);
    }
    return [...seen].map(([t, d]) => t.slice(0, 32) + ' +' + d); };
  const body = document.querySelector('.ux-body'); if (!body) return null;
  const cols = [...body.children], sb = document.querySelector('.ux-psb');
  const pitch = document.querySelector('.ux-sqp .ux-pitch'), bn = document.querySelector('.ux-bn'), tbl = document.querySelector('.ux-tbl.ux-sq');
  return {
    view: document.querySelector('[aria-label="Squad View"] .ux-on')?.textContent,
    cols: cols.map(c => Math.round(c.getBoundingClientRect().width)), page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    sections: [...(sb?.children || [])].map(s => (s.querySelector('h3')?.textContent || 'id') + ':' + Math.round(s.getBoundingClientRect().height)).join(' '),
    sbScroll: sb ? sb.scrollHeight - sb.clientHeight : null, photo: R(document.querySelector('.ux-pstad-ph img, .ux-pstad-kit')),
    kits: [...document.querySelectorAll('.ux-pkit')].map(k => R(k).join(',')).join(' '),
    heading: (() => { const b = document.querySelector('.ux-prof-nm'), l = b?.firstElementChild; return b ? [Math.round(b.getBoundingClientRect().width), l?.style.transform || 'none'] : null; })(),
    stadName: document.querySelector('.ux-pstad-cap b > span > span')?.style.transform || 'none',
    crest: R(document.querySelector('.ux-prof-crest img, .ux-prof-crest svg')), kitText: [...document.querySelectorAll('.ux-pkit')].map(k => k.textContent).join(' | '),
    pitch: R(pitch), ratio: pitch ? +(pitch.getBoundingClientRect().width / pitch.getBoundingClientRect().height).toFixed(3) : null, bench: R(bn),
    cut: [...clipped(cols[0]), ...(tbl ? clipped(tbl) : []), ...(bn ? clipped(bn) : []), ...clipped(cols[2]), ...clipped(cols[3])] }; })()`;

const PAGES = [["club", "#/registry/clubs/dym"], ["nation", "#/registry/national-teams/nch"], ["nophoto", "#/registry/clubs/arm"], ["vir", "#/registry/clubs/vir"]];
for (const [w, h] of [[1512, 949], [1512, 829], [1440, 790], [1920, 1080]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  for (const [name, hash] of PAGES) {
    await go(hash);
    console.log(name.padEnd(8), (w + "x" + h).padEnd(9), "first", JSON.stringify(await val(MEAS)));
    if (w === 1512 && h === 949) await shot(`${name}-list-${w}x${h}`);
    await view("Pitch"); await sleep(900);
    console.log(name.padEnd(8), (w + "x" + h).padEnd(9), "pitch", JSON.stringify(await val(MEAS)));
    if (w === 1512 && h === 949 && name !== "vir" || name === "club") await shot(`${name}-pitch-${w}x${h}`);
    if (w === 1440 && name === "nation") await shot(`${name}-pitch-${w}x${h}`);
    await view("List"); await sleep(600);
  }
}
// Every club and national side's name in the sidebar's heading face, against the heading's width at each window.
await send("Emulation.setDeviceMetricsOverride", { width: 1512, height: 949, deviceScaleFactor: 1, mobile: false });
await go("#/registry/clubs/dym");
console.log("names:", JSON.stringify(await val(`(async () => {
  const el = document.querySelector('.ux-prof-nm'), cs = getComputedStyle(el), box = el.getBoundingClientRect().width;
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; ctx.letterSpacing = cs.letterSpacing;
  const teams = await (await fetch('/src/data/teams.json')).json(), list = (Array.isArray(teams) ? teams : teams.teams || Object.values(teams)).filter(t => t && t.name);
  const ws = list.map(t => [t.name, Math.ceil(ctx.measureText(t.name.toUpperCase()).width)]).sort((a, b) => b[1] - a[1]);
  // The heading's width at the side column's least (260) and at this window.
  return { font: ctx.font, box: Math.round(box), n: ws.length, over: ws.filter(x => x[1] > box).length,
    under85: ws.filter(x => box / x[1] < 0.85).map(x => x[0] + ' ' + (box / x[1]).toFixed(2)), longest: ws.slice(0, 5).map(x => x.join(' ')) }; })()`)));
console.log("\nerrors:", errors.length ? errors.join("\n") : "none");
ws.close(); chrome.kill(); process.exit(0);
