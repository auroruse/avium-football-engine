// Full Time in the real app: matches simmed to the whistle from Play Match, the page drawn at its design size (1600 x 1092)
// and the Copy Image picture, with the banner measured: each crest level with the score, the room left above and below the
// board, and every side whose name or manager line would not fit at the new size.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=9334", "--window-size=1512,829", "about:blank"], { stdio: "ignore" });
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
await send("Emulation.setDeviceMetricsOverride", { width: 1512, height: 829, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
const until = async (expr, n = 60) => { for (let i = 0; i < n; i++) { if (await val(expr)) return true; await sleep(500); } return false; };
const button = async (label) => val(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; if (b.disabled) return 'disabled'; b.click(); return true; })()`);
const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, "base64")); };

// The eleven-man club bench in the squad views (12 October 2026): a club's page, Play Match's bench sheet, the Editor's
// Sheet; and Full Time, which lists only men who exist.
const go = async (hash) => { await send("Page.navigate", { url: base + hash }); await sleep(3500); };
await send("Page.navigate", { url: base }); await sleep(2500);
await val(`localStorage.clear(); true`); await send("Page.reload"); await sleep(3000);

// A club's page.
await go("#/registry/clubs/dym"); await until("!!document.querySelector('.ux-tbl tbody tr')", 30); await sleep(1500);
const club = await val(`(() => { const t = document.querySelector('.ux-tbl'); if (!t) return null; const rows = [...t.querySelectorAll('tbody tr')];
  return { rows: rows.length, vacant: rows.filter(r => r.classList.contains('ux-vac')).map(r => r.textContent.trim()), last: rows.slice(-7).map(r => r.textContent.trim().slice(0, 40)),
    panelH: Math.round(t.closest('section, .ux-panel')?.getBoundingClientRect().height || 0), colScroll: (() => { const c = t.closest('.ux-col'); return c ? [c.scrollHeight, c.clientHeight] : null; })() }; })()`);
console.log("club page:", JSON.stringify(club));
await shot("club-page");

// Play Match: the home side's bench.
await go("#/live/dynamo-mizuhara/imperial-sports-society"); await sleep(1500);
const sw = await val(`(() => { const g = [...document.querySelectorAll('[aria-label="Team Sheet"]')][0]; const b = g && [...g.querySelectorAll('button')].find(x => x.textContent.trim() === 'Bench'); if (!b) return false; b.click(); return true; })()`);
await sleep(800);
const pm = await val(`(() => { const b = document.querySelector('.ux-mbench'); if (!b) return null; const rows = [...b.querySelectorAll('.ux-mb-row')];
  return { rows: rows.length, vacant: rows.filter(r => r.classList.contains('ux-vac')).length, texts: rows.map(r => r.textContent.trim().slice(0, 30)) }; })()`);
console.log("play match bench (switch", sw + "):", JSON.stringify(pm));
await shot("play-match-bench");

// Full Time: the bench lists only men who exist.
const sim = await button("Sim To End");
await until("!!document.querySelector('.ux-ftban')", 160); await sleep(2500);
const ft = await val(`(() => [...document.querySelectorAll('*')].some(e => e.children.length === 0 && /^Vacant$/.test(e.textContent.trim())))()`);
console.log("full time (sim", sim + ") shows Vacant anywhere:", ft);
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1092, deviceScaleFactor: 1, mobile: false }); await sleep(800);
await shot("full-time");
await send("Emulation.setDeviceMetricsOverride", { width: 1512, height: 829, deviceScaleFactor: 1, mobile: false });

// The Editor's Sheet, signed in as the overseer: a club row's places.
await send("Network.setBlockedURLs", { urls: ["*avium-registry*"] });
await go(""); 
const tok = Buffer.from(JSON.stringify({ login: "auroruse", exp: 4102444800 })).toString("base64url") + ".x";
await val(`localStorage.clear(); localStorage.setItem("avium-session", ${JSON.stringify(tok)}); localStorage.setItem("avium-scope", ${JSON.stringify(JSON.stringify({ login: "auroruse", role: "overseer", nations: ["NCH"] }))}); true`);
await send("Page.reload"); await sleep(3500);
await go("#/editor/sheet"); await until("!!document.querySelector('.ux-sh-tbl')", 40); await sleep(1500);
const sheet = await val(`(() => { const rows = [...document.querySelectorAll('.ux-sh-tbl tbody tr')];
  const row = rows.find(tr => tr.querySelector('td[data-cell$="|code"]')?.textContent.trim() === 'DYM') || rows.find(tr => tr.querySelector('td[data-cell$="|code"]'));
  if (!row) return { rows: rows.length };
  const places = [...row.querySelectorAll('td[data-cell]')].filter(td => /\|p\d+$|\|s\d+$|\|\d+$/.test(td.dataset.cell));
  const heads = [...document.querySelectorAll('.ux-sh-tbl thead th')].map(th => th.textContent.trim()).filter(Boolean);
  return { code: row.querySelector('td[data-cell$="|code"]')?.textContent.trim(), cells: [...row.querySelectorAll('td[data-cell]')].map(td => td.dataset.cell.split('|')[1]).slice(-24),
    filled: places.filter(td => td.textContent.trim()).length, places: places.length, heads: heads.slice(-24) }; })()`);
console.log("sheet:", JSON.stringify(sheet));
await shot("sheet");
writeFileSync(`${out}/bench.json`, JSON.stringify({ club, pm, ft, sheet, errors }, null, 1));
console.log("\nerrors:", errors.length ? errors.join("\n") : "none");
ws.close(); chrome.kill(); process.exit(0);
