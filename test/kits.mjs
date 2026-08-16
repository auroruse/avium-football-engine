// DO THE TWO SIDES COME OUT DISTINGUISHABLE ON GRASS? Replays the app's colour maths for every
// pairing in the international preset and reports the worst cases: kits that land close to each
// other, or close to the pitch itself. Mirrors App.tsx's helpers exactly.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const hexToRgb = (h) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(h||"").trim());
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null; };
const percLum = (r,g,b) => (0.299*r + 0.587*g + 0.114*b) / 255;
const toHex = (r,g,b) => "#" + [r,g,b].map(x => Math.max(0,Math.min(255,x)).toString(16).padStart(2,"0")).join("");
const TEAM_LUM_MIN = 0.3, TEAM_LUM_MAX = 0.82;
const ensureMaxLum = (h) => { const c = hexToRgb(h); if (!c) return h; let {r,g,b} = c;
  for (let i=0;i<12 && percLum(r,g,b)>TEAM_LUM_MAX;i++){r=Math.round(r*0.88);g=Math.round(g*0.88);b=Math.round(b*0.88);}
  return toHex(r,g,b); };
const ensureMinLum = (h) => { const c = hexToRgb(h); if (!c) return h; let {r,g,b} = c;
  for (let i=0;i<24 && percLum(r,g,b)<TEAM_LUM_MIN;i++){
    if (Math.max(r,g,b)<8){r+=12;g+=12;b+=12;continue;}
    const k = Math.min(255/Math.max(r,g,b,1), 1.12);
    if (k<=1.0001){r=Math.min(255,r+8);g=Math.min(255,g+8);b=Math.min(255,b+8);continue;}
    r=Math.min(255,Math.round(r*k));g=Math.min(255,Math.round(g*k));b=Math.min(255,Math.round(b*k));}
  return toHex(r,g,b); };
// Perceptual distance, the same weighted-RGB form colorsClash uses (threshold 60).
const dist = (h1,h2) => { const a=hexToRgb(h1), b=hexToRgb(h2); if(!a||!b) return 999;
  const rm=(a.r+b.r)/2, dr=a.r-b.r, dg=a.g-b.g, db=a.b-b.b;
  return Math.sqrt((2+rm/256)*dr*dr + 4*dg*dg + (2+(255-rm)/256)*db*db); };
const clash = (a,b) => dist(a,b) < 60;
const GRASS = "#17311d";
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const kit = (t) => ({ home: t.primaryColor || null, away: t.secondaryColor || t.primaryColor || null, name: t.name });
const teams = clubs.map(kit).filter(t => t.home);
console.log(`${teams.length} teams with kit colours.\n`);
const lightenUntil = (hex, ref, f) => { const c = hexToRgb(hex); if(!c) return hex;
  let {r,g,b} = c, cur = hex;
  for (let i=0;i<10 && clash(cur,ref);i++){
    r=Math.min(255,Math.round(r+(255-r)*f)); g=Math.min(255,Math.round(g+(255-g)*f));
    b=Math.min(255,Math.round(b+(255-b)*f)); cur=toHex(r,g,b); }
  return cur; };
const resolve = (H, A) => {
  const hPre = H.home, aPre = clash(H.home, A.home) ? A.away : A.home;
  let h2 = ensureMaxLum(hPre), a2 = ensureMaxLum(aPre);
  if (clash(h2,a2)) { const o = ensureMaxLum(a2===A.home ? A.away : A.home); if(!clash(h2,o)) a2 = o;
                      else a2 = ensureMaxLum(lightenUntil(a2,h2,0.35)); }
  let h = ensureMinLum(h2), a = ensureMinLum(a2);
  // the post-lift re-check, as shipped: other kit first, then lighten
  if (clash(h,a)) { const o = ensureMinLum(ensureMaxLum(a2===A.home ? A.away : A.home));
    a = !clash(h,o) ? o : ensureMinLum(lightenUntil(a,h,0.35)); }
  return { h, a };
};
let worstPair = null, worstGrass = null, badPair = 0, badGrass = 0, n = 0;
for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
  if (i === j) continue;
  const { h, a } = resolve(teams[i], teams[j]); n++;
  const dp = dist(h, a), dgH = dist(h, GRASS), dgA = dist(a, GRASS);
  if (dp < 60) { badPair++; if (!worstPair || dp < worstPair.d) worstPair = { d: dp, t: `${teams[i].name} ${h} vs ${teams[j].name} ${a}` }; }
  const dg = Math.min(dgH, dgA);
  if (dg < 60) { badGrass++; if (!worstGrass || dg < worstGrass.d) worstGrass = { d: dg, t: `${dgH<dgA?teams[i].name+" "+h:teams[j].name+" "+a}` }; }
}
console.log(`pairings checked: ${n}`);
console.log(`kits too close to EACH OTHER: ${badPair} (${(100*badPair/n).toFixed(1)}%)` + (worstPair ? `   worst ${worstPair.d.toFixed(0)}: ${worstPair.t}` : ""));
console.log(`kits too close to the GRASS: ${badGrass} (${(100*badGrass/n).toFixed(1)}%)` + (worstGrass ? `   worst ${worstGrass.d.toFixed(0)}: ${worstGrass.t}` : ""));
const nch = teams.find(t => /Nichirin/i.test(t.name)), van = teams.find(t => /Aphirica del Nord/i.test(t.name));
if (nch && van) { const r = resolve(nch, van);
  console.log(`\nthe reported fixture: Nichirin ${r.h}  vs  Aphirica del Nord ${r.a}   separation ${dist(r.h,r.a).toFixed(0)}`);
  console.log(`  vs grass: ${dist(r.h,GRASS).toFixed(0)} and ${dist(r.a,GRASS).toFixed(0)}   (60 is the clash threshold)`); }
