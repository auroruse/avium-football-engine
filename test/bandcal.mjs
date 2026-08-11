// With resolution physical, what is a shot ACTUALLY worth from each distance? Force exploration by
// raising appetite, then read conversion per band -- that is the honest input for the decision model.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = eng;
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const BANDS=[0,6,11,16,22,30,45];
for (const worth of [0.75, 4, 12]) {
  eng.CFG.shotWorth = worth;
  const taken=new Array(BANDS.length-1).fill(0), scored=new Array(BANDS.length-1).fill(0);
  const rng=new RNG(21);
  for(let m=0;m<6;m++){
    const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
    s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home";
    meInit(s,pitchSlots);
    const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
      corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0,woodwork:0};
    let pend=null;
    for(let t=0;t<90*ME_TPM;t++){
      const b4s=out.shots.home+out.shots.away, b4g=out.goals.home+out.goals.away;
      const hx=s.mePos.idx>=0?s.players[s.mePos.side][s.mePos.idx]:null, hs=s.mePos.side;
      meTick(s,rng,out);
      if(out.shots.home+out.shots.away>b4s && hx){
        const d=eng.meShotGeom(hs,hx.x,hx.y).d;
        let b=0; while(b<BANDS.length-2 && d>=BANDS[b+1]) b++;
        taken[b]++; pend=b;
      }
      if(out.goals.home+out.goals.away>b4g && pend!==null){ scored[pend]++; pend=null; }
    }
  }
  const tot=taken.reduce((a,b)=>a+b,0);
  console.log(`shotWorth ${worth}:  ${tot} shots  ` + taken.map((t,i)=>
    `${BANDS[i]}-${BANDS[i+1]}m ${t}${t?`(${(100*scored[i]/t).toFixed(0)}%)`:""}`).join("  "));
}
