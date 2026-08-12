// CONSTS THAT EVALUATE TOO EARLY.
//
// `const x = (<div>{thing}</div>)` runs the moment that line executes. Inside a 7,000-line React
// component that is near the top, while most of what it reads is declared hundreds of lines below --
// so it throws a ReferenceError before React renders anything. The screen goes black and the build
// is green, because nothing about it is visible to a compiler: it is a temporal dead zone, not a
// type error. `const x = () => (<div>...</div>)` is fine, because the body waits until it is called.
//
// This lands on exactly that: every const whose initialiser is immediately-evaluated JSX, checked
// against the declaration order of everything it names. It caught matchSetupScreen reading 71
// identifiers -- lmH, lmA, lmHomeAdv, tConfig -- that are declared after it.
//
//   node test/tdz.mjs
import { readFileSync } from "node:fs";
const SRC = "src/App.tsx";
const lines = readFileSync(SRC, "utf8").split("\n");

// where each top-level-of-component const is declared
const declAt = new Map();
lines.forEach((l, i) => {
  const m = l.match(/^\s{2,4}const \[?([A-Za-z_$][\w$]*)/);
  if (m && !declAt.has(m[1])) declAt.set(m[1], i);
  for (const m2 of l.matchAll(/const \[([A-Za-z_$][\w$]*), set/g))
    if (!declAt.has(m2[1])) declAt.set(m2[1], i);
});

const bad = [];
lines.forEach((l, i) => {
  // a const whose initialiser starts a JSX expression right now -- not a function, not a call
  const m = l.match(/^\s{2,6}const ([A-Za-z_$][\w$]*)\s*=\s*\(\s*$/);
  if (!m) return;
  const name = m[1];
  // gather the initialiser by paren depth
  let depth = 0, end = i;
  for (let j = i; j < lines.length; j++) {
    depth += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
    if (depth === 0 && j > i) { end = j; break; }
  }
  const body = lines.slice(i, end + 1).join("\n");
  if (!/<[A-Za-z]/.test(body)) return;                     // no JSX: not this bug
  const late = [...new Set(body.match(/\b[A-Za-z_$][\w$]*\b/g) || [])]
    .filter(id => declAt.has(id) && declAt.get(id) > i);
  if (late.length) bad.push({ name, line: i + 1, late });
});

if (!bad.length) { console.log("\n  no immediately-evaluated JSX consts read anything declared later.\n"); process.exit(0); }
console.log("");
for (const b of bad) {
  console.log(`  ${SRC}:${b.line}  const ${b.name} = ( ... JSX ... )`);
  console.log(`     reads ${b.late.length} identifier(s) declared LATER, e.g. ${b.late.slice(0, 6).join(", ")}`);
  console.log(`     -> make it a function: const ${b.name} = () => ( ... ), and call it at the use site.`);
}
console.log(`\n  ${bad.length} will throw before React renders. Black screen, green build.\n`);
process.exit(1);
