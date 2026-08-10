// How bunched is the side, in the same units sports science uses: distance to nearest team-mate,
// stretch index (mean distance of each player to his team's centroid), and convex-hull surface area.
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_TPM, STRAT_DEF } = await import(process.env.ENG || "./engine.mjs");
const sq=(o)=>buildSquad("4-3-3",null).filter(p=>!p.bench).map((p,i)=>({...p,name:p.pos+i,ovr:o,stamina:100,rating:6.5,_att:null}));
const hull=(pts)=>{ if(pts.length<3) return 0;
  const s=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];
  for(const p of s){ while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop(); lo.push(p); }
  for(let i=s.length-1;i>=0;i--){ const p=s[i]; while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop(); up.push(p); }
  const h=lo.slice(0,-1).concat(up.slice(0,-1)); let a=0;
  for(let i=0;i<h.length;i++){ const j=(i+1)%h.length; a+=h[i][0]*h[j][1]-h[j][0]*h[i][1]; }
  return Math.abs(a)/2; };
const s=createMatchState(); s.players.home=sq(75); s.players.away=sq(75);
s.formations={home:"4-3-3",away:"4-3-3"}; s.strategy={home:{...STRAT_DEF},away:{...STRAT_DEF}}; s.possession="home"; meInit(s, pitchSlots);
const out={poss:{home:0,away:0},shots:{home:0,away:0},goals:{home:0,away:0},onTarget:{home:0,away:0},saves:{home:0,away:0},
           corners:{home:0,away:0},fouls:{home:0,away:0},passes:0,passOk:0,passFail:0,tackles:0,carries:0,clears:0,inplay:0,blocked:0};
const rng=new RNG(5); let near=0,stretch=0,area=0,n=0,overlap=0,cnt=0;
for(let t=0;t<90*ME_TPM;t++){ meTick(s,rng,out);
  if(t%8) continue;
  for(const sd of ["home","away"]){
    const ps=s.players[sd].filter(p=>p.pos!=="GK");
    const cx=ps.reduce((a,p)=>a+p.x,0)/ps.length, cy=ps.reduce((a,p)=>a+p.y,0)/ps.length;
    stretch += ps.reduce((a,p)=>a+Math.hypot(p.x-cx,p.y-cy),0)/ps.length;
    area += hull(ps.map(p=>[p.x,p.y]));
    for(const p of ps){ let d=Infinity;
      for(const q of ps) if(q!==p) d=Math.min(d,Math.hypot(q.x-p.x,q.y-p.y));
      near+=d; cnt++; if(d<3) overlap++; }
    n++; } }
console.log(`nearest team-mate      ${(near/cnt).toFixed(1)} m`);
console.log(`stretch index          ${(stretch/n).toFixed(1)} m`);
console.log(`surface area           ${(area/n).toFixed(0)} m2`);
console.log(`players inside 3m of a team-mate: ${(100*overlap/cnt).toFixed(0)}%`);
