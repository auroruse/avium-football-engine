// A lab run's entry (test/specs/run.env LAB_TEST): the NL2 1935 re-sim pool, samples 2 to 15, this shard's share to stdout.
import { fileURLToPath } from "node:url";
process.argv = [process.argv[0], fileURLToPath(new URL("./nl2play.mjs", import.meta.url)),
  fileURLToPath(new URL("../public/avium/pstats/nl2/1935.md", import.meta.url)), "2", "16", "0", "-"];
await import("./nl2play.mjs");
