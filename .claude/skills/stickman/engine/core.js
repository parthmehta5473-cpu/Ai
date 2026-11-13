// ===== STICKMAN ENGINE: core. Canvas helpers, layers, camera, finish, and the renderAt wrapper. =====
// A film sets FILM = {dur, cuts, cam(shot,u,t), draw(t,c)} and the wrapper does the rest.
const W=1920,H=1080,FPS=30;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
const easeIO=t=>{t=clamp(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
const seg=(t,a,b)=>clamp((t-a)/(b-a));
// keyframes: kf(t,[[t0,v0],[t1,v1]...]) smooth between keys. Every pose value goes through this.
function kf(t,k){if(t<=k[0][0])return k[0][1];for(let i=1;i<k.length;i++)if(t<k[i][0])return lerp(k[i-1][1],k[i][1],ease((t-k[i-1][0])/(k[i][0]-k[i-1][0])));return k[k.length-1][1]}
// seeded random. Always consume r() whatever the branch, or props change at a cut.
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function mk(w=W,h=H){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
const main=document.getElementById('c2d')||document.getElementById('c');const ctx=main.getContext('2d');
// Layers are created on first use: layer('bg') etc.
const L={tmp:mk(),tmp2:mk()};
function clr(c){const x=c.getContext('2d');x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,W,H);x.filter='none';x.globalAlpha=1;x.globalCompositeOperation='source-over';return x}
function camT(x,c,pf=1){const z=1+(c.z-1)*pf,cx=W/2+(c.x-W/2)*pf,cy=H/2+(c.y-H/2)*pf;x.setTransform(z,0,0,z,W/2-cx*z,H/2-cy*z)}
// layer(name,cam,parallax): clears the layer, applies the camera, returns the context.
function layer(name,cam,pf=1){if(!L[name])L[name]=mk();const x=clr(L[name]);if(cam)camT(x,cam,pf);return x}
function blit(dst,src,blur=0,alpha=1,mode='source-over'){dst.save();dst.globalAlpha=alpha;dst.globalCompositeOperation=mode;dst.filter=blur>.4?`blur(${blur}px)`:'none';dst.drawImage(src,0,0);dst.restore()}
// comp([['bg',blur,alpha],...]): draw layers bottom to top onto the screen.
function comp(list){ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.filter='none';ctx.globalCompositeOperation='source-over';ctx.fillStyle='#120a1c';ctx.fillRect(0,0,W,H);for(const [n,b=0,a=1,m] of list)if(L[n])blit(ctx,L[n],b,a,m)}
// wet floor reflection of a layer about a world line y. Long soft smear, never discs.
function reflect(name,wy,cam,a=.24,bl=5){const y=H/2+(wy-cam.y)*cam.z;ctx.save();ctx.beginPath();ctx.rect(0,y,W,H-y);ctx.clip();ctx.globalAlpha=a;ctx.filter=`blur(${bl}px)`;ctx.translate(0,2*y);ctx.scale(1,-1);ctx.drawImage(L[name],0,0);ctx.restore()}
function limb(x,p0,p1,w0,w1,col){const dx=p1[0]-p0[0],dy=p1[1]-p0[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
 x.fillStyle=col;x.beginPath();x.moveTo(p0[0]+nx*w0/2,p0[1]+ny*w0/2);x.lineTo(p1[0]+nx*w1/2,p1[1]+ny*w1/2);
 x.arc(p1[0],p1[1],w1/2,Math.atan2(ny,nx),Math.atan2(ny,nx)+Math.PI,true);x.lineTo(p0[0]-nx*w0/2,p0[1]-ny*w0/2);
 x.arc(p0[0],p0[1],w0/2,Math.atan2(-ny,-nx),Math.atan2(-ny,-nx)+Math.PI,true);x.closePath();x.fill()}
// two-bone IK. over = how far the target was out of reach (audited).
function ik(s,t,a,b,dir){let dx=t[0]-s[0],dy=t[1]-s[1],d=Math.hypot(dx,dy);const reach=a+b-.5;let tt=t;
 if(d>reach){dx*=reach/d;dy*=reach/d;d=reach;tt=[s[0]+dx,s[1]+dy]}
 d=Math.max(d,Math.abs(a-b)+1);const ca=clamp((a*a+d*d-b*b)/(2*a*d),-1,1),ang=Math.atan2(dy,dx)+dir*Math.acos(ca);
 return {e:[s[0]+Math.cos(ang)*a,s[1]+Math.sin(ang)*a],h:tt,over:Math.max(0,Math.hypot(t[0]-s[0],t[1]-s[1])-reach)}}
const grainTile=(()=>{const c=mk(256,256),x=c.getContext('2d'),id=x.createImageData(256,256),r=rng(7);for(let i=0;i<id.data.length;i+=4){const v=r()*255;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255}x.putImageData(id,0,0);return c})();
// vignette, warm grade, moving grain. warm 0..1 lifts the grade for golden moments.
function finish(x,t,warm=0){const g=x.createRadialGradient(W/2,H/2,H*.45,W/2,H/2,H*1.05);g.addColorStop(0,'rgba(20,8,30,0)');g.addColorStop(1,'rgba(20,8,34,.6)');x.fillStyle=g;x.fillRect(0,0,W,H);
 x.save();x.globalCompositeOperation='soft-light';x.globalAlpha=.5;x.fillStyle=`rgb(255,${180+warm*30},${150+warm*10})`;x.fillRect(0,0,W,H);x.restore();
 x.save();x.globalAlpha=.05;x.globalCompositeOperation='overlay';const fi=Math.floor(t*FPS);x.translate(-((fi*97)%256),-((fi*57)%256));x.fillStyle=x.createPattern(grainTile,'repeat');x.fillRect(0,0,W+256,H+256);x.restore()}
function fadeTo(x,a){if(a>0){x.setTransform(1,0,0,1,0,0);x.fillStyle=`rgba(10,5,18,${a})`;x.fillRect(0,0,W,H)}}
// ---- timeline + reports -----
const EVENTS=[];const say=(t,k,o={})=>EVENTS.push(Object.assign({t,k},o));
let REPORT=null; // filled per frame for audit.py
function report(id,p,extra={}){if(!REPORT)return;REPORT.people[id]=Object.assign({x:p.x,y:p.y,s:p.s,face:p.face||1,walk:!!p.walk,settle:!!p.settle,hand:p._h,over:p._over,elbow:p._e,tuck:p.tuck||{},world:p._w||null},extra)}
// contact(name,a,b): two world points that must stay together (hand on prop). Audited to 3 px.
function contact(name,a,b){if(REPORT)REPORT.contacts.push([name,a,b])}
function shotAt(f){const c=FILM.cuts;let s=0;for(let i=0;i<c.length-1;i++)if(f>=c[i])s=i;return s}
window.renderAt=function(t){const dur=FILM.dur;t=clamp(t,0,dur-1/60);const f=Math.round(t*FPS),s=shotAt(f),c=FILM.cuts,u=(f-c[s])/(c[s+1]-c[s]);
 REPORT={t,f,sh:s,people:{},contacts:[],sym:0};const cam=FILM.cam(s,u,t);FILM.draw(t,cam,s,u);
 finish(ctx,t,FILM.warm?FILM.warm(t):0);const fi=FILM.fadeIn??.5,fo=FILM.fadeOut??.6;fadeTo(ctx,Math.max(fi>0?1-seg(t,0,fi):0,fo>0?seg(t,dur-fo,dur-.03):0));
 return REPORT};
window.bootFilm=()=>{window.CUTF=FILM.cuts;window.DUR=FILM.dur;window.EVENTS=EVENTS;window.PLANTS=FILM.plants?FILM.plants():{};window.READY=true};
