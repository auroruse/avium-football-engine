import * as esbuild from "esbuild";
import v from "./vplug.mjs";
await esbuild.build({
  entryPoints: ["/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine/src/App.tsx"],
  bundle: true, format: "esm", platform: "node", outfile: "./test/ssr/app.mjs",
  loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl", ".svg": "dataurl", ".tsv": "text", ".css": "text" },
  external: ["react", "react-dom", "react/jsx-runtime"], define: { "import.meta.env.BASE_URL": "\"/\"" }, plugins: [v], logLevel: "error",
});
console.log("bundled");

// The tab is component state with no prop behind it, so the smoke test steers it by patching the
// bundle's initial value. Nothing else about the component changes.
import fs from "node:fs";
const out = "./test/ssr/app.mjs";
let src = fs.readFileSync(out, "utf8");
const before = src;
src = src.replace(/useState2?\("leagues"\)/, (m) => m.replace('"leagues"', '(globalThis.__TAB || "leagues")'));
if (src === before) throw new Error("could not find the tab useState to patch");
fs.writeFileSync(out, src);
console.log("tab hook patched");
