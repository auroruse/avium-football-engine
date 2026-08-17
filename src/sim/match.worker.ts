// One engine, on its own thread. It takes a fixture and hands back a result and nothing else.
//
// It imports the sim from App.tsx rather than from an extracted copy, which is deliberate: the
// alternative is lifting fifteen functions and their data tables out of a thirteen-thousand-line
// file, and the moment there are two copies of a football engine one of them starts being wrong.
// The cost is that the worker bundle carries React along for the ride, which it never calls -- a
// bundle-size charge nobody sees, paid once per worker at startup, against a whole class of bug
// avoided. App.tsx touches no browser API at module scope, so it loads here perfectly well.
import { simJob } from "../App";

self.onmessage = (e: MessageEvent) => {
  const { i, job } = e.data || {};
  // Errors are not swallowed: the pool listens for them and does the fixture on the main thread
  // instead, so a thrown job costs time rather than a hole in the tournament.
  (self as unknown as Worker).postMessage({ i, r: simJob(job) });
};
