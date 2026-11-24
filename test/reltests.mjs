// The match-playing tests, one push on the cloud lab (LAB_TEST=reltests.mjs): the first runner plays the tournament
// test, the second the pool test, and the other eighteen split the card test (merge their output with
// `node test/cards.mjs merge <files>`).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const m = (process.env.SHARD || "0/1").match(/^(\d+)\/(\d+)$/), i = +m[1], n = +m[2];
const run = (file, env) => { const r = spawnSync(process.execPath, [path.join(HERE, file)], { stdio: "inherit", env: { ...process.env, ...env } }); process.exit(r.status ?? 1); };
if (i === 0) run("tourn.mjs", { SHARD: "" });
else if (i === 1) run("pool.mjs", { SHARD: "" });
else run("cards.mjs", { SHARD: `${i - 2}/${n - 2}` });
