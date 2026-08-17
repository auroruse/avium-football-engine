// One engine, on its own thread. It takes a fixture and hands back a result and nothing else.
//
// It imports src/sim/core.ts, NOT App.tsx. That is not tidiness: Vite's dev server prepends the
// HMR client to every .tsx module, the HMR client needs a window, and a worker has none -- so a
// worker that reaches App.tsx dies on load in development while working perfectly in a build.
// core.ts is plain TypeScript, served clean, and App.tsx imports the very same module.
import { simJob } from "./core";

self.onmessage = (e: MessageEvent) => {
  const { i, job } = e.data || {};
  // Errors are not swallowed: the pool listens for them and does the fixture on the main thread
  // instead, so a thrown job costs time rather than a hole in the tournament.
  (self as unknown as Worker).postMessage({ i, r: simJob(job) });
};
