// A lab run's entry (test/specs/run.env LAB_TEST): the E.S.U. style and shape check of 25 October 2026, played by
// nt-app.mjs on this shard's share of esu-jobs.json, one line a job to stdout.
import { fileURLToPath } from "node:url";
process.argv = [process.argv[0], fileURLToPath(new URL("./nt-app.mjs", import.meta.url)), fileURLToPath(new URL("./esu-jobs.json", import.meta.url))];
await import("./nt-app.mjs");
