// A lab run's entry (test/specs/run.env LAB_TEST): wc-awards.mjs on this shard's share of the cloud's 1936 World Cups.
import { fileURLToPath } from "node:url";
process.argv = [process.argv[0], fileURLToPath(new URL("./wc-awards.mjs", import.meta.url)), process.env.WC_N || "600", "0"];
await import("./wc-awards.mjs");
