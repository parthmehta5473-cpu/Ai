// ===== STICKMAN ENGINE: motion. Planted-foot walking and small acting helpers. =====
const blinkAt=(t,l)=>{for(const b of l)if(t>b&&t<b+.16)return Math.sin((t-b)/.16*Math.PI);return 0};
// speaking mouth for on-screen talk between times a and b
const talk=(t,a,b,sp=10)=>(t>a&&t<b)?(.22+.34*Math.abs(Math.sin(t*sp)*Math.sin(t*sp*.37+1))):0;
// accelerate, cruise, decelerate. A sine ease over a whole walk makes the first step take far too long.
const ramp=(t,a,b,r=.14)=>{const u=seg(t,a,b);return u<r?u*u/(2*r*(1-r)):u>1-r?1-(1-u)*(1-u)/(2*r*(1-r)):(u-r/2)/(1-r)};
// path through world points on the floor, 0..1 by length
function pathFn(pts){const L_=[0];for(let i=1;i<pts.length;i++)L_.push(L_[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const T=L_[L_.length-1]||1;
 return u=>{const d=clamp(u)*T;let i=1;while(i<pts.length-1&&L_[i]<d)i++;const k=(d-L_[i-1])/((L_[i]-L_[i-1])||1);return [lerp(pts[i-1][0],pts[i][0],k),lerp(pts[i-1][1],pts[i][1],k)]}}
const stepF=(U,n)=>{const q=U*n,i=Math.floor(q),f=q-i;return {st:clamp((i+.5)/n),sw:clamp(lerp((i-.5)/n,(i+1.5)/n,ease(f))),lift:Math.sin(f*Math.PI)*(U<1?1:0),even:i%2==0,f,i}};
/* makeWalk({pts:[[x,floorY],...],t0,t1,steps,scale:y=>s})
   w.at(t) returns {c:[x,y],s,lW,rW,bob,moving,U}. The walk's clock is position along the path,
   so a stance foot never slides. w.plants() gives footfall times for the sound mix. */
function makeWalk(o){const P=pathFn(o.pts),sc=o.scale||(()=>o.s||.66),n=o.steps;
 const U=t=>ramp(t,o.t0,o.t1,o.r||.14);
 return {U,P,at(t){const u=U(t),c=P(u),s=sc(c[1]),F=stepF(u,n),a=P(F.st),b0=P(F.sw),b=[b0[0],b0[1]-F.lift*34*s],moving=u>0&&u<1;return {c,s,lW:F.even?a:b,rW:F.even?b:a,bob:Math.sin(F.f*Math.PI)*7*(moving?1:0)*s,moving,U:u}},
  plants(){const out=[];let pn=null;for(let f=0;f<FILM.dur*30;f++){const t=f/30,u=U(t);if(u>0&&u<1){const i=stepF(u,n).i;if(pn!==null&&i!==pn)out.push(t);pn=i}}return out}}}
/* standOn: pose fields for someone standing at floor point c at scale s. */
const standY=(floorY,s)=>floorY-(STANDY+22)*s;
/* walkPose(p,w,{lat}): adds planted feet, swinging free arms and walk flag. Set p.face first.
   Clear any tuck on a free arm. Pass arms:false when the hands hold something. */
function walkPose(p,w,o={}){const lat=(o.lat??42)*w.s,toL=q=>[(q[0]-p.x)/p.s,(q[1]-p.y)/p.s-22];p.y-=w.bob;
 const l=[w.lW[0]-lat,w.lW[1]],r=[w.rW[0]+lat,w.rW[1]];p.feet={l:toL(l),r:toL(r)};p._w={l,r};
 if(w.moving){p.walk=true;if(o.arms!==false){const sw=clamp((p.face||1)*(w.rW[0]-w.lW[0])/w.s/110,-1,1);p.hands=Object.assign(p.hands||{},{l:[-96+sw*38,222],r:[96-sw*38,222]})}}else p.settle=true;return p}
