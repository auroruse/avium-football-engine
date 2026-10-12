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

// A club's page left to right: profile, squad (pitch or list), season and honours, results.
const go = async (hash) => { await send("Page.navigate", { url: base + hash }); await sleep(4500); };
await send("Page.navigate", { url: base }); await sleep(2500);
const MEAS = `(() => {
  const body = document.querySelector('.ux-body'); if (!body) return null;
  const cols = [...body.children], tbl = document.querySelector('.ux-tbl.ux-sq');
  const pitch = document.querySelector('.ux-pitch, .ux-pitch-wrap svg, .ux-lineup, [class*="ux-pitch"]');
  const names = tbl ? [...tbl.querySelectorAll('tbody tr')].filter(r => !r.classList.contains('ux-vac') && !r.classList.contains('ux-sep')).map(r => {
    const box = r.querySelector('.ux-sqnm > div'), sp = box?.querySelector('span'); return { name: sp?.textContent, over: sp && box ? Math.max(0, sp.scrollWidth - box.clientWidth) : 0 }; }) : [];
  return { widths: cols.map(c => Math.round(c.getBoundingClientRect().width)), pageX: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    overflow: cols.map(c => c.scrollHeight - c.clientHeight), pitchW: pitch ? Math.round(pitch.getBoundingClientRect().width) : null, pitchH: pitch ? Math.round(pitch.getBoundingClientRect().height) : null,
    rows: tbl ? tbl.querySelectorAll('tbody tr').length : null, cut: names.filter(n => n.over > 0).map(n => n.name + ' ' + n.over),
    view: document.querySelector('[aria-label="Squad View"] .ux-on')?.textContent,
    col3: [...cols[2].children].map(p => p.querySelector('h2')?.textContent) }; })()`;
const list = () => val(`(() => { const b = [...document.querySelectorAll('[aria-label="Squad View"] button')].find(x => x.textContent === 'List'); if (!b) return false; b.click(); return true; })()`);
const pitch = () => val(`(() => { const b = [...document.querySelectorAll('[aria-label="Squad View"] button')].find(x => x.textContent === 'Pitch'); if (!b) return false; b.click(); return true; })()`);
for (const [w, h] of [[1512, 829]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  for (const [name, hash] of [["club", "#/registry/clubs/dym"], ["nation", "#/registry/national-teams/nch"]]) {
    await go(hash); await until("!!document.querySelector('.ux-body')", 30); await sleep(2000);
    await pitch(); await sleep(800);
    const a = await val(MEAS); console.log(name.padEnd(7), (w + "x" + h).padEnd(9), "pitch", JSON.stringify(a));
    await shot(name + "-pitch-" + w);
    await list(); await sleep(1200);
    const b = await val(MEAS); console.log(name.padEnd(7), (w + "x" + h).padEnd(9), "list ", JSON.stringify(b));
    await shot(name + "-list-" + w);
  }
}
// The season's league name, and a national side's History with its AFA column.
await go("#/registry/clubs/dym"); await sleep(1500);
console.log("season league name:", JSON.stringify(await val(`(() => { const b = [...document.querySelectorAll('.ux-hero .ux-t1 > div')][0], sp = b?.querySelector('span'); return { text: sp?.textContent, over: sp && b ? sp.scrollWidth - b.clientWidth : null, strip: [...document.querySelectorAll('.ux-strip')][0]?.textContent }; })()`)));
await shot("club-season-1512");
await go("#/registry/national-teams/nch/history"); await sleep(2500);
console.log("history:", JSON.stringify(await val(`(() => { const t = document.querySelector('.ux-tbl'); if (!t) return null; return { head: [...t.querySelectorAll('thead th')].map(x => x.textContent), rows: [...t.querySelectorAll('tbody tr')].slice(0, 4).map(r => r.textContent) }; })()`)));
await shot("nation-history-1512");
console.log("\nerrors:", errors.length ? errors.join("\n") : "none");
ws.close(); chrome.kill(); process.exit(0);
