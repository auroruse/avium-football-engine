// A lab run's entry (test/specs/run.env LAB_TEST): the Nichirin minmax, nt-nch.mjs on this shard's share of nch-jobs.json.
import { fileURLToPath } from "node:url";
process.argv = [process.argv[0], fileURLToPath(new URL("./nt-nch.mjs", import.meta.url)), fileURLToPath(new URL("./nch-jobs.json", import.meta.url))];
await import("./nt-nch.mjs");
