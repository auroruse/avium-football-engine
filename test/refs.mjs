// EVERY SETTER MUST HAVE ITS STATE. Deleting a `const [x, setX] = useState(...)` while a control
// still calls setX (or reads x) compiles perfectly and throws the moment that code path renders --
// a black screen with nothing in the build output. That is exactly how the abstract engine's
// removal broke the live-match setup screen, and this is the check that would have caught it.
import fs from "node:fs";
const SRC = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

// comments out, so prose naming a setter is not a use
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1");

const declared = new Set(), pairs = new Map();
for (const m of code.matchAll(/const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*(set[A-Z][\w$]*)\s*\]\s*=\s*useState/g)) {
  declared.add(m[2]); pairs.set(m[2], m[1]);
}
// a setter can also be a plain function or a prop
for (const m of code.matchAll(/(?:const|let|function)\s+(set[A-Z][\w$]*)/g)) declared.add(m[1]);
for (const m of code.matchAll(/\(\s*\{([^{}]*)\}\s*\)\s*=>/g))
  for (const p of m[1].split(",")) { const n = p.split(":").pop().trim().split("=")[0].trim(); if (/^set[A-Z]/.test(n)) declared.add(n); }
for (const m of code.matchAll(/\b(set[A-Z][\w$]*)\s*[,)]/g)) { /* passed as an argument name */ }
for (const m of code.matchAll(/(?:^|[(,]\s*)(set[A-Z][\w$]*)\s*(?=[,)])/gm)) declared.add(m[1]);

const called = new Map();
for (const m of code.matchAll(/(?<![.\w$])(set[A-Z][\w$]*)\s*\(/g)) {
  const line = code.slice(0, m.index).split("\n").length;
  if (!called.has(m[1])) called.set(m[1], line);
}
let fails = 0;
const BUILTIN = new Set(["setTimeout", "setInterval", "setImmediate"]);
for (const [name, line] of called) {
  if (declared.has(name) || BUILTIN.has(name)) continue;
  console.log(`  FAIL  ${name}() at ~line ${line} — no useState, no definition`);
  fails++;
}
// and the state variable each surviving setter belongs to must still be readable
for (const [setter, state] of pairs) {
  const reads = [...code.matchAll(new RegExp("(?<![.\\w$])" + state + "(?![\\w$])", "g"))].length;
  if (reads === 0) { console.log(`  warn  ${state} is declared but never read (setter ${setter} still exists)`); }
}
console.log(fails ? `\n${fails} SETTER(S) WITHOUT STATE` : `\nall ${called.size} setters have their state`);
process.exit(fails ? 1 : 0);
