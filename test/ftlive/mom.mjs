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

// The momentum chart at one height across window shapes, the numbers' last line still level with the last man.
const SIZES = [[1600, 1092], [1920, 1080], [1512, 982], [1440, 1200], [2560, 1440]];
const BAND = `(() => {
  const mom = document.querySelector('.ux-ftmom'); if (!mom) return null;
  const centre = mom.parentElement, band = centre.parentElement, kids = [...band.children];
  const k = mom.getBoundingClientRect().height / mom.offsetHeight;
  const mid = (e) => { const b = e.getBoundingClientRect(); return (b.top + b.height / 2) / k; };
  const lastRow = (sh) => { const rows = [...sh.querySelectorAll('div')].filter(d => getComputedStyle(d).display === 'grid'); return rows[rows.length - 1]; };
  const lasts = [kids[0], kids[2]].map(lastRow), statLast = centre.lastElementChild.firstElementChild.lastElementChild;
  const longest = Math.max(...lasts.map(mid));
  return { k: +k.toFixed(3), chartH: mom.offsetHeight, chartW: mom.offsetWidth, statRow: statLast.offsetHeight, sheetRow: lasts[0].offsetHeight,
    off: +(mid(statLast) - longest).toFixed(1), gapOverBar: +((centre.children[2].getBoundingClientRect().top - centre.children[1].getBoundingClientRect().bottom) / k).toFixed(1),
    bars: mom.querySelectorAll('rect').length }; })()`;
const friendly = async (name, home, away) => {
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1092, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base }); await sleep(2500);
  await send("Page.navigate", { url: base + "#/live/" + home + "/" + away }); await sleep(1500);
  await send("Page.reload"); await sleep(4500);
  await val(`(() => { const g = document.querySelector('[aria-label="Venue"]'); const b = g && [...g.querySelectorAll('button')].find(x => x.textContent.trim() === 'Home Ground'); if (b) b.click(); return !!b; })()`);
  await sleep(600); await button("Sim To End");
  await until("!!document.querySelector('.ux-ftmom svg')", 160); await sleep(2500);
  for (const [w, h] of SIZES) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(1500);
    const b = await val(BAND);
    console.log(name.padEnd(9), (w + "x" + h).padEnd(10), "| chart", b?.chartH, "tall,", b?.chartW, "wide | numbers' rows", b?.statRow, "| sheet rows", b?.sheetRow,
      "| last line off the last man", b?.off, "| room over the possession bar", b?.gapOverBar, "| bars", b?.bars);
    if (w === 1920) await shot("mom-" + name + "-" + w);
  }
};
await friendly("clubs", "tsukumo-shinkeisei", "nishijin");
await friendly("mixed", "dynamo-mizuhara", "nichirin");
console.log("\nerrors:", errors.length ? errors.join("\n") : "none");
ws.close(); chrome.kill(); process.exit(0);
