// One shot at a time, slice by slice: where the ball is, where the keeper is, how far he is from
// the ball's path this slice, and how far he could actually reach.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF, CFG, ME_HALF_W, meAttrs } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
CFG.shotWorth = 1e4;
for (const D of [4, 8, 12, 20]) {
  for (let k = 0; k < 2; k++) {
    const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
    s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}};
    s.possession="home"; meInit(s,pitchSlots);
    const rng=new RNG(1000+k*7);
    const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
      corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
    const mp=s.mePos, sh=s.players.home[10];
    for(const p of s.players.home){p.x=52;p.y=6;p.vx=0;p.vy=0;}
    for(const p of s.players.away){p.x=52;p.y=62;p.vx=0;p.vy=0;}
    const gk=s.players.away.find(p=>p.pos==="GK");
    sh.x=105-D; sh.y=ME_HALF_W; sh.vx=0; sh.vy=0;
    gk.x=104.2; gk.y=ME_HALF_W; gk.vx=0; gk.vy=0;
    mp.side="home"; mp.idx=10; mp.bx=sh.x; mp.by=sh.y; mp.bz=0.11; mp.bvx=0; mp.bvy=0; mp.bvz=0;
    mp.hold=99; mp.dead=0; mp.flight=false; mp.kickBy=null;
    const rows=[];
    for(let t=0;t<8;t++){
      const px=mp.bx, py=mp.by;
      meTick(s,rng,out);
      const x0=mp._bpx, y0=mp._bpy, dx=mp.bx-x0, dy=mp.by-y0, L2=dx*dx+dy*dy;
      const tt = L2>0.001 ? Math.max(0,Math.min(1,((gk.x-x0)*dx+(gk.y-y0)*dy)/L2)) : 0;
      const gd = Math.hypot(gk.x-(x0+dx*tt), gk.y-(y0+dy*tt));
      const v2 = Math.hypot(mp.bvx, mp.bvy);
      let reach = "-";
      if (mp.shot && v2 > CFG.gkLiveV) {
        const fl = Math.max(0,(mp.tick-mp.shot.t0)*0.25), rf = meAttrs(gk).reflex/99;
        const us = Math.max(0, fl - CFG.gkReactS*(1.4-rf*0.8));
        reach = (CFG.gkArm + Math.min(CFG.gkReachMax, us*CFG.gkDiveV*(0.75+rf*CFG.gkReachSkill*0.4))).toFixed(2);
      }
      rows.push(`t${t} ball(${mp.bx.toFixed(1)},${mp.by.toFixed(1)},${mp.bz.toFixed(2)}) v${v2.toFixed(0)} gk@${gk.x.toFixed(1)},${gk.y.toFixed(1)} gap ${gd.toFixed(2)} reach ${reach} ${mp.idx>=0?"HELD":""}${mp.dead?"DEAD":""}`);
      if (out.goals.home || out.saves.away || mp.dead || mp.idx>=0) break;
    }
    console.log(`--- ${D} m, seed ${k}: goals ${out.goals.home} saves ${out.saves.away} wood ${out.woodwork}`);
    for (const r of rows) console.log("   " + r);
  }
}
