// ===== STICKMAN ENGINE: characters. One rig, fixed proportions, so identity never drifts. =====
const INK='#1c1a2b';
const HERO={skin:'#F8E9CC',cloth:'#FF6B5E',hood:'#E4493F',hand:'#F8E9CC',face:INK,leg:'#2C2A49',shoe:'#17141F',finger:INK};
const FRIEND={skin:'#17141F',cloth:'#F6B73C',hood:'#D9962A',hand:'#17141F',face:'#FFFFFF',leg:'#3A2F55',shoe:'#17141F',finger:'#5b5468'};
const WOMAN={skin:'#E9C6A0',cloth:'#2DB2AE',hood:'#187E86',hand:'#E9C6A0',face:INK,leg:'#2C2A49',shoe:'#17141F',finger:INK,hair:'#3A2230'};
const STRANGER={skin:'#C9C3CF',cloth:'#2A2536',hood:'#191622',hand:'#C9C3CF',face:'#17141F',leg:'#17141F',shoe:'#0f0d15',finger:'#17141F',coat:true};
const GUEST_A={skin:'#17141F',cloth:'#7A56A0',hood:'#5C3F80',hand:'#17141F',face:'#FFFFFF',leg:'#2C2A49',shoe:'#17141F',finger:'#5b5468'};
const GUEST_B={skin:'#E9C7A2',cloth:'#3A5C9A',hood:'#223A6C',hand:'#E9C7A2',face:INK,leg:'#2C2A49',shoe:'#17141F',finger:INK};
// rig units: full figure height is about 800 at s=1
const UA=102,FA=98,HR=96,TH=235,THIGH=130,SHIN=130,STANDY=TH+250,TW=215;
/* pose p: x,y,s  face(1 right,-1 left)  breath  look lookY blink brow sad mouth mouthW open wide laugh tilt headX headY
   hands{l,r}(rig units) showH{l,r} tuck{l,r} walk feet{l,r} noLegs noFace bend(hip lean radians)
   accessories: hat glasses glassY glassR  coat flutter: flut time
   Idle arms end with no hand, on purpose. Show a hand only when it is doing something. */
function drawPerson(x,ch,p){x.save();x.translate(p.x,p.y);x.scale(p.s,p.s);const br=Math.sin(p.breath||0)*3,face=p.face||1;
 const ft=p.feet||{l:[-48,STANDY],r:[48,STANDY]};
 if(!p.noLegs)for(const k of (face<0?['r','l']:['l','r'])){const hip=[k=='l'?-46:46,TH-14],f=ft[k],r=ik(hip,f,THIGH,SHIN,face<0?1:-1);limb(x,hip,r.e,62,50,ch.leg);limb(x,r.e,r.h,50,38,ch.leg);
  x.fillStyle=ch.shoe;x.beginPath();x.roundRect(r.h[0]-(face<0?58:20),r.h[1]+6,78,28,13);x.fill()}
 if(p.bend){x.translate(0,TH-14);x.rotate(p.bend);x.translate(0,-(TH-14))}
 x.fillStyle=ch.hood;x.beginPath();x.ellipse(-8,-30+br,98,70,0,0,7);x.fill();
 if(ch.coat){const fl=p.flut||0,fa=Math.sin((p.time||0)*5.5),fb=Math.sin((p.time||0)*4.1+1),hem=TH+150;
  x.fillStyle=ch.cloth;x.beginPath();x.moveTo(-TW/2,70);x.quadraticCurveTo(-TW/2,-5,-TW/2+60,-8+br);x.lineTo(TW/2-60,-8+br);x.quadraticCurveTo(TW/2,-5,TW/2,70);
  x.quadraticCurveTo(TW/2+8,TH,TW/2+34+fl*(20+fa*20),hem+fb*fl*10);x.quadraticCurveTo(50,hem+24+fa*fl*12,0,hem+8);x.quadraticCurveTo(-60,hem+24-fb*fl*12,-TW/2-34-fl*(46+fb*20),hem-fa*fl*12);x.quadraticCurveTo(-TW/2-8,TH,-TW/2,70);x.closePath();x.fill();
  x.strokeStyle=ch.hood;x.lineWidth=7;x.lineCap='round';x.beginPath();x.moveTo(0,10);x.lineTo(0,hem);x.stroke();x.lineWidth=16;x.beginPath();x.moveTo(-TW/2+6,TH-20);x.lineTo(TW/2-6,TH-20);x.stroke();
  x.fillStyle=ch.hood;x.beginPath();x.moveTo(-70,-10);x.lineTo(0,70);x.lineTo(70,-10);x.lineTo(30,-16);x.lineTo(0,18);x.lineTo(-30,-16);x.closePath();x.fill()}
 else{x.fillStyle=ch.cloth;x.beginPath();x.moveTo(-TW/2,TH);x.lineTo(-TW/2,60);x.quadraticCurveTo(-TW/2,-5,-TW/2+60,-8+br);x.lineTo(TW/2-60,-8+br);x.quadraticCurveTo(TW/2,-5,TW/2,60);x.lineTo(TW/2,TH);x.quadraticCurveTo(0,TH+14,-TW/2,TH);x.closePath();x.fill();
  x.strokeStyle=ch.hood;x.lineWidth=14;x.lineCap='round';x.beginPath();x.arc(0,-8+br,52,.15*Math.PI,.85*Math.PI);x.stroke();x.lineWidth=6;x.globalAlpha=.55;x.beginPath();x.moveTo(-60,TH-90);x.lineTo(60,TH-90);x.stroke();x.globalAlpha=1}
 const sh={l:[-TW/2+34,34+br],r:[TW/2-34,34+br]},hd=p.hands||{};p._h={};p._over={};p._e={};
 for(const k of ['l','r']){const s=sh[k],tgt=hd[k]||[s[0]+(k=='l'?-24:24),s[1]+UA+FA-14],side=k=='l'?1:-1;
  // walking: elbows trail the direction of travel. A tucked arm folds toward the body to hold something close.
  const dir=(p.tuck&&p.tuck[k])?-side:(p.walk?(face>0?1:-1):side),r=ik(s,tgt,UA,FA,dir);
  limb(x,s,r.e,66,54,ch.hood);limb(x,r.e,r.h,54,44,ch.hood);limb(x,s,r.e,58,48,ch.cloth);limb(x,r.e,r.h,46,38,ch.cloth);
  if(p.showH&&p.showH[k]){const a=Math.atan2(r.h[1]-r.e[1],r.h[0]-r.e[0]);x.save();x.translate(r.h[0],r.h[1]);x.rotate(a);x.fillStyle=ch.hand;x.beginPath();x.roundRect(-4,-12,32,24,12);x.fill();x.restore()}
  p._h[k]=r.h;p._over[k]=r.over;p._e[k]=r.e}
 x.save();x.translate(p.headX||0,-HR-20+br+(p.headY||0));x.rotate(p.tilt||0);
 if(ch.hair){x.fillStyle=ch.hair;x.beginPath();x.moveTo(-HR-16,44);x.quadraticCurveTo(-HR-24,-HR-22,0,-HR-16);x.quadraticCurveTo(HR+24,-HR-22,HR+16,44);x.quadraticCurveTo(HR+8,66,HR-18,62);x.lineTo(-HR+18,62);x.quadraticCurveTo(-HR-8,66,-HR-16,44);x.fill()}
 x.fillStyle=ch.skin;x.beginPath();x.arc(0,0,HR,0,7);x.fill();
 if(ch.hair){x.fillStyle=ch.hair;x.beginPath();x.moveTo(-HR-4,-6);x.quadraticCurveTo(-HR+4,-HR-10,10,-HR-6);x.quadraticCurveTo(HR+4,-HR+4,HR+4,-6);x.quadraticCurveTo(HR-16,-52,44,-58);x.quadraticCurveTo(-30,-44,-HR-4,-6);x.fill()}
 if(!p.noFace){const lk=p.look||0,ly=p.lookY||0,fx=lk*46,fy=ly*18+6;x.strokeStyle=ch.face;x.fillStyle=ch.face;x.lineCap='round';const bl=p.blink||0;
  for(let i=0;i<2;i++){const e=(i?30:-30)+fx*(i?1.1:.9);x.lineWidth=8;
   if(p.laugh){x.beginPath();x.arc(e,fy+6,13,Math.PI*1.1,Math.PI*1.9);x.stroke()}
   else if(bl>.5){x.beginPath();x.moveTo(e-12,fy);x.lineTo(e+12,fy);x.stroke()}
   else{x.beginPath();x.ellipse(e,fy,7,13*(1-bl*1.6)+2+(p.wide||0)*4,0,0,7);x.fill()}
   // brows: positive sad lifts the inner end. Negative sad reads angry.
   const by=fy-30-(p.brow||0)*7,sl=(p.sad||0)*8*(i?-1:1);x.lineWidth=6;x.beginPath();x.moveTo(e-14,by+sl);x.lineTo(e+14,by-sl);x.stroke()}
  const m=p.mouth||0,my=fy+44,mx=fx*.95,mw=p.mouthW||26;x.lineWidth=7;x.beginPath();
  if(p.open>.02){x.ellipse(mx,my+6,14+p.open*7,5+p.open*17,0,0,7);x.fill()}else{x.moveTo(mx-mw,my-m*5);x.quadraticCurveTo(mx,my+m*22,mx+mw,my-m*5);x.stroke()}
  if(p.glasses){x.save();x.translate(0,p.glassY||0);x.rotate(p.glassR||0);x.fillStyle='#0d0b14';for(const s of [-1,1]){x.beginPath();x.roundRect(fx+s*32-26,fy-15,52,31,12);x.fill()}x.strokeStyle='#0d0b14';x.lineWidth=5;x.beginPath();x.moveTo(fx-8,fy-6);x.lineTo(fx+8,fy-6);x.moveTo(fx-58,fy-6);x.lineTo(-92,fy-14);x.moveTo(fx+58,fy-6);x.lineTo(92,fy-14);x.stroke();x.strokeStyle='rgba(255,255,255,.28)';x.lineWidth=3;x.beginPath();x.moveTo(fx-48,fy+7);x.lineTo(fx-34,fy-7);x.stroke();x.restore()}}
 if(p.hat){x.fillStyle='#14111B';x.beginPath();x.ellipse(0,-68,150,20,0,0,7);x.fill();x.beginPath();x.moveTo(-82,-70);x.quadraticCurveTo(-78,-165,-30,-168);x.quadraticCurveTo(0,-154,30,-168);x.quadraticCurveTo(78,-165,82,-70);x.closePath();x.fill();x.fillStyle='#8E2F2C';x.fillRect(-81,-94,162,18);x.strokeStyle='rgba(255,190,150,.32)';x.lineWidth=3;x.beginPath();x.moveTo(-140,-62);x.quadraticCurveTo(0,-48,140,-62);x.stroke()}
 x.restore();x.restore()}
// Rim light: a tinted, offset copy of the silhouette under the figure. Legs are skipped because rim on dark trousers reads as an outline.
function personRim(dst,ch,p,rimCol='rgba(255,196,150,1)',dx=4,dy=-1){const qr=Object.assign({},p,{noLegs:true}),t2=L.tmp2,tc=t2.getContext('2d');tc.setTransform(1,0,0,1,0,0);tc.globalCompositeOperation='source-over';tc.clearRect(0,0,W,H);tc.setTransform(dst.getTransform());drawPerson(tc,ch,qr);tc.setTransform(1,0,0,1,0,0);tc.globalCompositeOperation='source-in';tc.fillStyle=rimCol;tc.fillRect(0,0,W,H);tc.globalCompositeOperation='source-over';dst.save();dst.setTransform(1,0,0,1,0,0);dst.drawImage(t2,dx,dy);dst.restore();drawPerson(dst,ch,p);return p}
// actor(x,id,ch,p,cam): rim + draw + report for audit. Use this for every character.
function actor(x,id,ch,p,cam,rim='rgba(255,196,150,1)',side=1){personRim(x,ch,p,rim,side*(3+1.4*(cam?cam.z:1)),-1);report(id,p);return p}
// rig-space hand point to world, and back
const h2w=(p,k)=>[p.x+p._h[k][0]*p.s,p.y+p._h[k][1]*p.s];
const w2l=(p,w)=>[(w[0]-p.x)/p.s,(w[1]-p.y)/p.s];
