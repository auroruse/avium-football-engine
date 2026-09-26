// HOME ADVANTAGE, MEASURED. Every ordered pair of Nichirin League One clubs plays with the listed
// home side as host, so team strength cancels across the two orders and what is left is the venue:
// the mean of (host goals - visitor goals). Each arm sets ME_HOME_ADV before it plays, and every arm
// plays the same fixtures on the same seeds.
//
//   node test/homeadv.mjs [cycles=4] [workers=10] "shipped:;tilt:ref=0;lean:ref=0.3"
//
// A cycle is all 380 ordered pairs once. The standard error of the mean is about 1.6 goals over the
// square root of the matches, so four cycles (1,520 matches) resolve an arm to about +/-0.04.
// `neutral=1` in an arm plays it with no host at all, which should read zero: the check that
// nothing else in the engine favours the home slot.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CHUNK = 38;

if (process.argv[2] === 'job') {
  const [, , , spec, k0s, ns] = process.argv;
  const { PRESET_CATALOG, runPositionalMatch, ME_HOME_ADV } = await import('./engine.mjs');
  let neutral = false;
  for (const kv of spec.split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    if (k === 'neutral') neutral = v === '1'; else ME_HOME_ADV[k] = +v;
  }
  const nl1 = PRESET_CATALOG.filter((t) => t.league === 'Nichirin League One');
  const pairs = [];
  for (let a = 0; a < nl1.length; a++) for (let b = 0; b < nl1.length; b++) if (a !== b) pairs.push([a, b]);
  const t = { n: 0, gd: 0, gd2: 0, w: 0, d: 0, l: 0, foul: [0, 0], yel: [0, 0], red: [0, 0], pen: [0, 0] };
  for (let k = +k0s; k < +k0s + +ns; k++) {
    const [a, b] = pairs[k % pairs.length];
    const o = runPositionalMatch(nl1[a], nl1[b], 77e5 + k * 7919 + 13, neutral ? null : 'home', false).out;
    const gd = o.goals.home - o.goals.away;
    t.n++; t.gd += gd; t.gd2 += gd * gd;
    if (gd > 0) t.w++; else if (gd === 0) t.d++; else t.l++;
    ['home', 'away'].forEach((sd, i) => {
      t.foul[i] += o.fouls?.[sd] || 0; t.yel[i] += o.yellows?.[sd] || 0; t.red[i] += o.reds?.[sd] || 0;
      // A penalty is charged to the side that conceded it, the way a foul is.
      t.pen[i] += (o.feed || []).filter((e) => /^pen/.test(e.k) && e.side !== sd).length;
    });
  }
  console.log(JSON.stringify(t));
  process.exit(0);
}

const [cyclesS, wS, armsS] = process.argv.slice(2);
const CYCLES = +(cyclesS || 4), W = +(wS || 10), N = CYCLES * 380;
const arms = (armsS || 'shipped:;neutral:neutral=1').split(';').map((a) => { const [name, spec = ''] = a.split(':'); return { name, spec }; });
const jobs = [];
for (const arm of arms) for (let k = 0; k < N; k += CHUNK) jobs.push({ arm, k, n: Math.min(CHUNK, N - k) });

const run = ({ arm, k, n }) => new Promise((res, rej) => {
  let out = '', err = '';
  const c = spawn('node', [fileURLToPath(import.meta.url), 'job', arm.spec, k, n], { stdio: ['ignore', 'pipe', 'pipe'] });
  c.stdout.on('data', (b) => { out += b; }); c.stderr.on('data', (b) => { err += b; });
  c.on('exit', (code) => (code === 0 ? res(JSON.parse(out.trim().split('\n').pop())) : rej(new Error(err.slice(0, 400)))));
});
const tot = new Map(arms.map((a) => [a.name, { n: 0, gd: 0, gd2: 0, w: 0, d: 0, l: 0, foul: [0, 0], yel: [0, 0], red: [0, 0], pen: [0, 0] }]));
let next = 0, done = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: W }, async () => {
  while (next < jobs.length) {
    const j = jobs[next++], r = await run(j), t = tot.get(j.arm.name);
    for (const k of ['n', 'gd', 'gd2', 'w', 'd', 'l']) t[k] += r[k];
    for (const k of ['foul', 'yel', 'red', 'pen']) { t[k][0] += r[k][0]; t[k][1] += r[k][1]; }
    if (++done % 40 === 0) console.error(`${done}/${jobs.length} jobs, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
}));

const f = (x, d = 2) => x.toFixed(d);
console.log(`\n${CYCLES} cycles, ${N} matches an arm, NL1, host = listed home side\n`);
console.log('arm              host GD      se      W / D / L %          fouls h/a    yellows h/a   reds h/a     pens h/a');
for (const a of arms) {
  const t = tot.get(a.name), m = t.gd / t.n, se = Math.sqrt(Math.max(0, t.gd2 / t.n - m * m) / t.n);
  const per = (v) => `${f(v[0] / t.n)}/${f(v[1] / t.n)}`;
  console.log(`${a.name.padEnd(16)} ${(m >= 0 ? '+' : '') + f(m, 3)}   ${f(se, 3)}   ${f(100 * t.w / t.n, 1)}/${f(100 * t.d / t.n, 1)}/${f(100 * t.l / t.n, 1)}`.padEnd(58)
    + `${per(t.foul).padEnd(13)}${per(t.yel).padEnd(14)}${per(t.red).padEnd(13)}${per(t.pen)}`);
}
