// FIELDS, END TO END (cloud: .github/workflows/lab.yml on lab/fields). Loads one Field from New Tournament's Preset menu in
// the built app, creates the tournament and plays it out (Sim All, the draws, the byes) until it names a result; prints one
// JSON line. FIELD=<name> picks the Field; CHROME the browser. Expects `npx vite preview --port 4599` running.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
const FIELD = process.env.FIELD, CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${mkdtempSync("/tmp/chr-")}`, "--window-size=1680,1000",
  "--no-first-run", "--no-sandbox", "--disable-gpu", "about:blank"], { stdio: "ignore" });
let info = null;
for (let i = 0; i < 120 && !info; i++) { await new Promise(r => setTimeout(r, 250)); try { info = await (await fetch("http://127.0.0.1:9333/json/list")).json(); } catch {} }
const ws = new WebSocket(info.find(t => t.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.addEventListener("open", r));
let id = 0; const wait = new Map(), errs = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300)); });
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
await send("Runtime.enable"); await send("Page.enable");
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const btns = async () => JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('button')].filter(b => !b.disabled).map(b => b.textContent.trim()).filter(t => t && t.length < 40))`));
const click = (t) => ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(t)} && !b.disabled); if (b) b.click(); return !!b; })()`);
const text = () => ev(`document.body.innerText.replace(/\\s+/g,' ')`);
await send("Page.navigate", { url: "http://localhost:4599/?universe=avium#/tournament" }); await sleep(6000);
await click("New Tournament"); await sleep(1500);
await ev(`(() => { const s = document.querySelector('select[aria-label=Preset]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify("p:" + FIELD)}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(1500);
const t0 = await text(), i0 = t0.indexOf("SIDES");
const out = { field: FIELD, sides: t0.slice(i0, i0 + 160).replace(/ (Eastern|Western) Conference.*/, ""), steps: [], result: null, stuck: null };
for (const b of ["Create Tournament", "Set Up Draw"]) if (await click(b)) { out.steps.push(b); break; }
await sleep(2000);
const ORDER = ["Sim All", "Proceed To Knockout", "Begin Draw", "Draw All", "Start Knockout", "Continue", "Confirm Byes", /^Top \d+ By Ranking$/, "Fill At Random"];
for (let i = 0; i < 400; i++) {
  const bs = await btns(), t = await text();
  if (/SUMMARY|THROUGH THE PLAYOFF/.test(t) && !bs.includes("Sim All")) { out.result = (t.match(/(SUMMARY|THROUGH THE PLAYOFF).{0,260}/) || [""])[0]; break; }
  let pick = null; for (const o of ORDER) { pick = bs.find(b => (o instanceof RegExp ? o.test(b) : b === o)); if (pick) break; }
  if (!pick) { out.stuck = bs; break; }
  await click(pick); out.steps.push(pick); await sleep(pick === "Sim All" ? 2500 : 1200);
}
out.errors = errs;
console.log(JSON.stringify(out));
ws.close(); proc.kill(); process.exit(0);
