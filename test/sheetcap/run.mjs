// Real drags on the Lineup (Chrome's own drag, intercepted and dropped): a striker onto the other striker, then a striker
// onto a bench place; the side's places read before and after from the grid. A picture of the small pitch. Every error.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=9334", "--window-size=1512,829", "about:blank"], { stdio: "ignore" });
let tgt;
for (let i = 0; i < 150 && !tgt; i++) { try { tgt = await (await fetch("http://127.0.0.1:9334/json/new?about:blank", { method: "PUT" })).json(); } catch { await sleep(200); } }
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const wait = new Map(), errors = []; let dragData = null;
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === "Input.dragIntercepted") dragData = m.params.data;
  if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 800));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const val = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) errors.push("eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*avium-registry*"] });
await send("Emulation.setDeviceMetricsOverride", { width: 1512, height: 829, deviceScaleFactor: 2, mobile: false });
const dock = async (name) => { const r = await val("(() => { const b = document.querySelector('.ux-sh-dock').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()");
  const s = await send("Page.captureScreenshot", { format: "png", clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 2 } }); writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, "base64")); };
const viewAs = async (v) => { await val(`(() => { const s = document.querySelector('.ux-sh-as select'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await sleep(1500); };
const centre = async (sel) => val(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const clickAt = async (sel) => { await val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center", inline: "nearest" }); true`); await sleep(300);
  const r = await centre(sel); for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r[0], y: r[1], button: "left", clickCount: 1 }); await sleep(700); };
const drag = async (from, to) => {
  const ok = await val(`(async () => { const a = document.querySelector(${JSON.stringify(from)}), b = document.querySelector(${JSON.stringify(to)}); if (!a || !b) return "missing";
    const dt = new DataTransfer(), tick = () => new Promise(r => setTimeout(r, 60));
    const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    fire(a, "dragstart"); await tick(); fire(b, "dragenter"); await tick(); const over = !fire(b, "dragover"); await tick(); fire(b, "drop"); await tick(); fire(a, "dragend"); await tick();
    return over ? "dropped" : "refused"; })()`);
  console.log("drag", from.slice(-34), "->", to.slice(-34), ":", ok); await sleep(500); };
await send("Page.navigate", { url: base + "next.html#/editor/sheet" }); await sleep(4000);
for (let i = 0; i < 60; i++) { if (await val("!!document.querySelector('.ux-sh-tbl')")) break; await sleep(500); } await sleep(1500);
await viewAs("@overseer");
const K = await val(`(() => { const r = [...document.querySelectorAll('.ux-sh-tbl tbody tr')].find(tr => tr.querySelector('td[data-cell$="|code"]')?.textContent.trim() === 'DYM'); return r.querySelector('td[data-cell$="|name"]').dataset.cell.split('|')[0]; })()`);
const squad = async () => val(`(() => [...document.querySelectorAll('td[data-cell^="${K}|p"] .ux-sh-cn')].map(x => x.textContent.split(' ').pop()).join(' '))()`);
await clickAt(`td[data-cell="${K}|crest"]`);
await dock("1-small-pitch");
console.log("before:      ", await squad());
console.log("pitch token draggable:", await val("document.querySelector('.ux-sh-lpitch .ux-pl:nth-of-type(10) .ux-pl-tok')?.getAttribute('draggable')"),
  "| what is under its centre:", await val("(() => { const b = document.querySelector('.ux-sh-lpitch .ux-pl:nth-of-type(10) .ux-pl-tok').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e.tagName + '.' + e.className; })()"));
// the control: a chip in the grid onto another place of the same row
await drag(`td[data-cell="${K}|p9"] .ux-sh-chip`, `td[data-cell="${K}|p10"]`);
console.log("grid control:", await squad());
await drag(".ux-sh-lpitch .ux-pl:nth-of-type(10) .ux-pl-tok", ".ux-sh-lpitch .ux-pl:nth-of-type(11) .ux-pl-tok");
console.log("ST onto ST:  ", await squad());
await drag(".ux-sh-lpitch .ux-pl:nth-of-type(10) .ux-pl-tok", ".ux-sh-lb:nth-of-type(2)");
console.log("ST to bench: ", await squad());
await dock("2-after-drags");
await val("[...document.querySelectorAll('.ux-sh-dseg button')].find(b => b.textContent === 'Free Agents').click(); true"); await sleep(500);
await val(`(async () => { const a = document.querySelector('td[data-cell="${K}|p15"] .ux-sh-chip'), dt = new DataTransfer(), tick = () => new Promise(r => setTimeout(r, 60));
  const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  fire(a, "dragstart"); await tick(); const b = document.querySelector('.ux-sh-flist'); fire(b, "dragenter"); await tick(); fire(b, "dragover"); await tick(); fire(b, "drop"); await tick(); fire(a, "dragend"); return true; })()`); await sleep(600);
console.log("released #16:", await squad());
writeFileSync(`${out}/errors.txt`, errors.join("\n") + "\n");
console.log(errors.length, "errors"); console.log(errors.slice(0, 8).join("\n"));
chrome.kill(); process.exit(0);
