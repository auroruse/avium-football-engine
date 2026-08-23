import "./shim.js";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const S = new URL("./app.mjs", import.meta.url);
const mod = await import(S);
const App = mod.default;
const TABS = ["leagues", "live", "tournament", "utilities", "docs"];
let fails = 0;
for (const tab of TABS) {
  globalThis.__TAB = tab;
  try {
    const html = renderToStaticMarkup(React.createElement(App));
    console.log(`  ok    ${tab.padEnd(11)} rendered ${html.length} chars`);
  } catch (e) {
    fails++;
    console.log(`  FAIL  ${tab.padEnd(11)} ${e.message}`);
    const at = (e.stack || "").split("\n").slice(1, 4).join("\n");
    console.log(at);
  }
}
process.exit(fails ? 1 : 0);
