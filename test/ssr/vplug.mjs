import fs from "node:fs"; import path from "node:path";
const ROOT = "/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine";
const walk = (d, base = "") => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name), base + e.name + "/") : [base + e.name]) : [];
export default {
  name: "virtual",
  setup(build) {
    build.onResolve({ filter: /^virtual:/ }, a => ({ path: a.path, namespace: "v" }));
    build.onLoad({ filter: /.*/, namespace: "v" }, a => {
      if (a.path === "virtual:pstats")
        return { contents: `export const PSTATS_FILES = ${JSON.stringify(walk(ROOT + "/public/avium/pstats").filter(f => /\.(tsv|md)$/i.test(f) && !/README/i.test(f)))};` };
      if (a.path === "virtual:stadium-images")
        { const fs2 = walk(ROOT + "/public/avium/stadiums").filter(f => /\.(jpe?g|png)$/i.test(f)).sort(), ext = {};
          for (const f of fs2) { const n = f.replace(/\.(jpe?g|png)$/i, "").normalize("NFC"); if (!ext[n]) ext[n] = f.slice(n.length); }
          return { contents: `export const STADIUM_IMAGES = ${JSON.stringify(Object.keys(ext))}; export const STADIUM_EXT = ${JSON.stringify(ext)};` }; }
      return { contents: "export default {};" };
    });
  },
};
