// Drives Chrome over its debugging port (no packages): reads the page's report and takes the pictures asked for.
//   node test/lineup/run.mjs <base url> <out dir> [shot ...]   shot = traits,height,shape
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const [base, out, ...shots] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=9333", "--window-size=1600,1000", "about:blank"], { stdio: "ignore" });
let tgt;
for (let i = 0; i < 100 && !tgt; i++) { try { tgt = await (await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" })).json(); } catch { await sleep(200); } }
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const wait = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const val = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
const load = async (url) => {
  await send("Page.navigate", { url });
  for (let i = 0; i < 600; i++) { await sleep(500); if (await val("window.__done === true")) return true; }
  return false;
};
if (!(await load(base + "test/lineup/index.html"))) { console.error("the page never finished"); process.exit(1); }
const rep = JSON.parse(await val("JSON.stringify(window.__report)"));
writeFileSync(`${out}/report.json`, JSON.stringify(rep));
for (const s of shots) {
  if (!(await load(base + "test/lineup/index.html?one=" + s))) continue;
  const r = await val("(() => { const b = document.querySelector('.case').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()");
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 2 } });
  writeFileSync(`${out}/${s.replace(/,/g, "_")}.png`, Buffer.from(shot.result.data, "base64"));
}
const bad = rep.filter(c => c.edge.length || c.names.length || c.slide.length);
console.log(`${rep.length} pitches: ${bad.length} with a name off the pitch, on another name, or not sliding right`);
chrome.kill();
process.exit(0);
