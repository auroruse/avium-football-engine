// THE BLACK-SCREEN NET. A const read before its own line at module scope is a ReferenceError the
// instant the browser evaluates the bundle: the app paints nothing, and the only record of it is a
// stack in a console no test is watching. It shipped once -- ARTERRA_RAIL was built out of
// ARTERRA_LEAGUE forty lines above ARTERRA_LEAGUE's declaration -- and every other harness passed.
//
// The SSR smoke test CANNOT catch this, and it is worth knowing why rather than assuming it does:
// esbuild concatenates every module into one scope when it bundles, and rewrites all 415 top-level
// consts to `var`. That erases the temporal dead zone, so the SSR bundle reads `undefined`, builds
// a Set containing it, and renders every tab happily. Rollup -- what `vite build` runs -- keeps
// const, so the SHIPPED bundle is the only artifact that still carries the bug.
//
//   npx vite build && node test/tdz.mjs
//
// This evaluates module scope and nothing else. The DOM stub is deliberately thin, so a clean run
// ends in a TypeError from the first real DOM call react-dom makes. That is the pass condition:
// getting far enough to fail on the DOM means every module-scope const evaluated in order.
import fs from "node:fs";
import "./ssr/shim.js";

// Vite prepends a modulepreload polyfill that runs BEFORE any application module, and the SSR
// shim's document is too thin for it -- the first cut of this file died there and reported a clean
// run without ever reaching App.tsx. Everything below exists to get past that polyfill and into
// module scope, which is the only place the bug being hunted can live.
const el = () => ({ style: {}, relList: { supports: () => true }, setAttribute() {}, appendChild() {},
                    getContext: () => null, remove() {}, href: "", rel: "", crossOrigin: null });
Object.assign(globalThis.document, { querySelectorAll: () => [], createElement: el,
  head: { appendChild() {} }, baseURI: "http://localhost/" });
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.fetch = () => Promise.reject(new Error("no network in the TDZ harness"));

const dir = new URL("../dist/assets/", import.meta.url);
const entry = fs.existsSync(dir) && fs.readdirSync(dir).find(n => /^index-.*\.js$/.test(n));
if (!entry) { console.log("no dist bundle -- run `npx vite build` first"); process.exit(1); }

try {
  await import(new URL(entry, dir));
  console.log("module scope evaluated clean (never reached the DOM)");
} catch (e) {
  if (e instanceof ReferenceError) {
    console.log(`BLACK SCREEN: ${e.message}`);
    console.log((e.stack || "").split("\n").slice(1, 4).join("\n"));
    process.exit(1);
  }
  console.log(`module scope evaluated clean (stopped at the DOM: ${e.constructor.name})`);
}
