// "Attached and moonwalking": the ball riding ON him for slices at a time, not a transient bump.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const R = CFG.bodyR + CFG.ballR, N = 10;
console.log("standoff brake  moonwalk%  runs>=3   longest   mean gap  completion  shots/side  s on ball");
for (const [so, br, ef] of [[0.45,8,0],[0.45,1.5,0],[0.45,8,1],[0.45,3,1],[0.45,1.5,1],[0.55,1.5,1]]) {
  CFG.standoff = so; CFG.recvBrake = br; CFG.ejectFwd = ef;
  let on=0, att=0, runs=0, longest=0, gapSum=0, pa=0, ok=0, sh=0, holds=[];
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    let run = 0, last = null, hr = 0;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      if (mp.idx >= 0 && !mp.sp) {
        const p = s.players[mp.side][mp.idx];
        const bd = Math.hypot(mp.bx - p.x, mp.by - p.y);
        const spd = Math.hypot(p.vx||0, p.vy||0) / ME_DT;
        on++; gapSum += bd;
        // riding ON him: inside or on his body shell, while he is genuinely running
        // MOONWALKING: on his shell, he is running, and it is BEHIND the way he is running.
        const vs = Math.hypot(p.vx||0, p.vy||0);
        const back = vs > 1e-4 && bd > 1e-4 &&
          ((mp.bx-p.x)/bd)*(p.vx/vs) + ((mp.by-p.y)/bd)*(p.vy/vs) < 0;
        if (bd <= R + 0.06 && spd > 1.5 && back) { att++; run++; }
        else { if (run >= 3) { runs++; if (run > longest) longest = run; } run = 0; }
        const key = `${mp.side}${mp.idx}`;
        if (key === last) hr++; else { if (hr > 0) holds.push(hr); hr = 0; }
        last = key;
      } else { if (run >= 3) { runs++; if (run > longest) longest = run; } run = 0; last = null; }
      meTick(s, rng, out);
    }
    pa += out.passes; ok += out.passOk; sh += out.shots.home + out.shots.away;
  }
  const mh = holds.reduce((a,b)=>a+b,0)/(holds.length||1)/4;
  console.log(`${so.toFixed(2).padStart(8)} ${br.toFixed(1).padStart(4)} ${ef}  ${(100*att/on).toFixed(1).padStart(9)}%` +
    ` ${String(runs).padStart(8)}  ${(longest/4).toFixed(2).padStart(7)}s  ${(gapSum/on).toFixed(2).padStart(8)}` +
    `  ${(100*ok/(pa||1)).toFixed(0).padStart(9)}%  ${(sh/N/2).toFixed(1).padStart(10)}  ${mh.toFixed(2).padStart(9)}`);
}
