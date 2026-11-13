// ===== STICKMAN 3D: sets and walking. The walls are painted by the same code as 2D, so the two styles match. =====
import * as T from 'three';
import {V,lerp,ease,clamp,seg,mat,mesh,texture,gait,ANK} from './lib3d.js';
const PX=238; // painted pixels per 3D unit at the back wall
const wx=x=>(x-1400)/PX, wy=y=>(642-y)/PX;
function painted(fn,x0,y0,x1,y1,k=.5){return texture((x1-x0)*k|0,(y1-y0)*k|0,x=>{x.scale(k,k);x.translate(-x0,-y0);fn(x)})}
function plane(w,h,m,p,ry=0){const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(...p);o.rotation.y=ry;return o}
// soft blob shadow, painted like 2D
const blobT=texture(128,128,(x,w)=>{const g=x.createRadialGradient(w/2,w/2,4,w/2,w/2,w/2);g.addColorStop(0,'rgba(8,4,20,.62)');g.addColorStop(.6,'rgba(8,4,20,.38)');g.addColorStop(1,'rgba(8,4,20,0)');x.fillStyle=g;x.fillRect(0,0,w,w)});
export function blob(sc,w=1.1,d=.5){const m=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:blobT,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.006;m.renderOrder=2;sc.add(m);return m}
const coneT=texture(32,128,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,214,150,.13)');g.addColorStop(1,'rgba(255,200,130,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
export function pendant3(sc,x,z,len=1.25){const G=new T.Group();G.position.set(x,4,z);const dk=mat('#2A1838'),cord=mesh(new T.CylinderGeometry(.008,.008,len,6),dk);cord.position.y=-len/2;const sd=mesh(new T.CylinderGeometry(.09,.29,.3,28,1,true),mat('#8A4A3A',{side:T.DoubleSide}));sd.position.y=-len-.15;const gl=mesh(new T.CylinderGeometry(.26,1.25,2.2,28,1,true),new T.MeshBasicMaterial({map:coneT,transparent:true,depthWrite:false,side:T.FrontSide}));gl.position.y=-len-1.4;gl.renderOrder=3;G.add(cord,sd,gl);sc.add(G);return G}
export function table3(sc,x,z,r=.5,h=.76){const w=mat('#8A4A3A'),m=mat('#5A2F2A'),t=mesh(new T.CylinderGeometry(r,r,.05,44),w);t.position.set(x,h,z);const st=mesh(new T.CylinderGeometry(.04,.04,h,12),m);st.position.set(x,h/2,z);const b=mesh(new T.CylinderGeometry(.27,.29,.03,28),mat('#17141F'));b.position.set(x,.015,z);sc.add(t,st,b);return t}
export function chair3(sc,x,z,ry){const G=new T.Group(),d=mat('#5A2F2A'),s=mesh(new T.BoxGeometry(.44,.05,.44),d);s.position.y=.46;const b=mesh(new T.BoxGeometry(.44,.5,.04),d);b.position.set(0,.74,-.2);G.add(s,b);for(const a of [-1,1])for(const c of [-1,1]){const l=mesh(new T.CylinderGeometry(.018,.018,.46,8),d);l.position.set(a*.18,.23,c*.18);G.add(l)}G.position.set(x,0,z);G.rotation.y=ry;sc.add(G);return G}
export function cup3(sc,x,y,z){const G=new T.Group(),c=mat('#F2E7D6'),b=mesh(new T.CylinderGeometry(.055,.042,.09,22),c);b.position.y=.05;const f=new T.Mesh(new T.CircleGeometry(.047,22),new T.MeshBasicMaterial({color:'#4A2616'}));f.rotation.x=-Math.PI/2;f.position.y=.0955;const h=mesh(new T.TorusGeometry(.027,.008,8,14),c);h.position.set(.066,.05,0);G.add(b,f,h);G.position.set(x,y,z);sc.add(G);return G}
function rain3(sc,x0,x1,z0,z1,h,n=500){const r=[];let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};for(let i=0;i<n;i++)r.push([lerp(x0,x1,rnd()),rnd()*h,lerp(z0,z1,rnd()),5+rnd()*3]);const g=new T.BufferGeometry(),p=new Float32Array(n*6);g.setAttribute('position',new T.BufferAttribute(p,3));const l=new T.LineSegments(g,new T.LineBasicMaterial({color:'#E8E4F4',transparent:true,opacity:.5}));l.frustumCulled=false;sc.add(l);return t=>{for(let i=0;i<n;i++){const d=r[i],y=h-((d[1]+t*d[3])%h),sl=(h-y)*.13;p[i*6]=d[0]-sl;p[i*6+1]=y+.2;p[i*6+2]=d[2];p[i*6+3]=d[0]-sl-.03;p[i*6+4]=y;p[i*6+5]=d[2]}g.attributes.position.needsUpdate=true}}
/* one cafe room. Back wall at z=-3, floor y=0, x from about -9.5 to 9.5. door.rotation.y 0 shut, about 1.9 open. Returns {door,rain(t),DOORX,HINGE} */
export function makeCafe(sc){sc.background=new T.Color('#120a1c');
 sc.add(plane(44,12,mat(null,{map:painted(cafeOutside,-1600,-1200,5400,700,.25),form:0}),[0,3,-9]));
 sc.add(plane(19.33,3.96,mat(null,{map:painted(cafeWall,-900,-300,3700,642),form:0}),[(-900+3700)/2/PX-1400/PX,1.98,-3]));
 const top=mat('#3F2860',{form:0}),side=mat(null,{form:0,map:texture(1024,512,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h*.7);g.addColorStop(0,'#3F2860');g.addColorStop(1,'#62407F');x.fillStyle=g;x.fillRect(0,0,w,h);const y=h*.78;x.fillStyle='#2F9A98';x.fillRect(0,y,w,h-y);x.fillStyle='#237F80';x.fillRect(0,y,w,6);x.strokeStyle='rgba(15,60,62,.45)';x.lineWidth=3;for(let i=0;i<12;i++)x.strokeRect(i*88+8,y+18,72,h-y-34)})});
 sc.add(plane(19.33,6,top,[0,6.96,-3]));sc.add(plane(16,10,side,[-9.5,5,5],Math.PI/2));sc.add(plane(16,10,side,[9.5,5,5],-Math.PI/2));
 const fT=texture(1024,1024,(x,w)=>{const g=x.createLinearGradient(0,0,0,w);g.addColorStop(0,'#5A3F66');g.addColorStop(1,'#34264C');x.fillStyle=g;x.fillRect(0,0,w,w);x.strokeStyle='rgba(20,12,36,.3)';x.lineWidth=1.4;for(let i=0;i<=16;i++){x.beginPath();x.moveTo(i*w/16,0);x.lineTo(i*w/16,w);x.stroke()}x.globalAlpha=.3;for(let i=0;i<=8;i++){x.beginPath();x.moveTo(0,i*w/8);x.lineTo(w,i*w/8);x.stroke()}});
 const fl=new T.Mesh(new T.PlaneGeometry(22,12),mat(null,{map:fT,form:0}));fl.rotation.x=-Math.PI/2;fl.position.set(0,0,3);sc.add(fl);
 const DOORX=(DOOR.L-1400)/PX,HINGE=(DOOR.R-1400)/PX,W_=(DOOR.R-DOOR.L)/PX,H_=(DOOR.B-DOOR.T)/PX;
 const door=new T.Group();door.position.set(HINGE,0,-2.98);const leaf=mesh(new T.BoxGeometry(W_,H_,.05),mat(null,{form:0,map:texture(150,256,(x,w,h)=>{x.fillStyle='#2F8E8E';x.fillRect(0,0,w,h);x.fillStyle='#FFD6A0';x.fillRect(18,20,114,110);x.fillStyle='#237878';x.fillRect(18,150,114,86);x.fillStyle='#E9B872';x.fillRect(16,122,8,24)})}));leaf.position.set(-W_/2,H_/2,0);door.add(leaf);sc.add(door);
 const rain=rain3(sc,-8,8,-6,-3.2,5,400);for(const x of [-4.6,-1.8,1,3.2,5.8])pendant3(sc,x,-1.4);return {door,rain,HINGE,DOORC:(DOOR.C-1400)/PX}}
/* wet street. Floor y=0, kerb at z=-1.5, buildings behind. */
export function makeStreet(sc){sc.background=new T.Color('#120a1c');
 sc.add(plane(50,16,mat(null,{map:painted(x=>streetSky(x,0),-500,-500,2420,900,.4),form:0}),[1,3.2,-16]));
 const mid=texture(1400,560,(x)=>{x.scale(.5,.5);x.translate(300,-120);streetBuildings(x)});
 sc.add(plane(16,6.4,new T.MeshBasicMaterial({map:mid,transparent:true,alphaTest:.5}),[1,.26,-6]));
 const gT=texture(1024,512,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#42305F');g.addColorStop(.24,'#2C2346');g.addColorStop(.25,'#6C5A82');g.addColorStop(.28,'#413058');g.addColorStop(.29,'#3F3360');g.addColorStop(1,'#231B3A');x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='rgba(255,220,170,.28)';for(let i=0;i<14;i++)x.fillRect(i*74,62,38,3)});
 const gl=new T.Mesh(new T.PlaneGeometry(40,18),mat(null,{map:gT,form:0}));gl.rotation.x=-Math.PI/2;gl.position.set(0,0,3);sc.add(gl);return {rain:rain3(sc,-9,9,-3,5,5.5,900)}}
/* planted-foot walk along [x,z] points. w.at(t) gives pos, yaw, feet and hands. Feet are placed by distance along the path, so they never slide. */
export function walk3(o){const pts=o.pts,Ls=[0];for(let i=1;i<pts.length;i++)Ls.push(Ls[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const T_=Ls[Ls.length-1],st=o.stride||.62;
 const P=d=>{d=clamp(d,-1,T_+1);let i=1;while(i<pts.length-1&&Ls[i]<d)i++;const k=(d-Ls[i-1])/((Ls[i]-Ls[i-1])||1);const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return {x:lerp(a[0],b[0],k),z:lerp(a[1],b[1],k),dx:dx/l,dz:dz/l}};
 const dist=t=>{const u=seg(t,o.t0,o.t1),r=.14;return T_*(u<r?u*u/(2*r*(1-r)):u>1-r?1-(1-u)*(1-u)/(2*r*(1-r)):(u-r/2)/(1-r))};
 return {at(t,y0=.72){const s=dist(t),g=gait(s,st),c=P(s),walking=ease(seg(t,o.t0,o.t0+.25))*(1-ease(seg(t,o.t1-.3,o.t1))),nx=c.dz,nz=-c.dx;
   const yaw=Math.atan2(c.dx,c.dz),foot=(k,sd)=>{const f=g[k],q=P(f[0]),w=[q.x+nx*sd*.115,ANK+f[1],q.z+nz*sd*.115],stand=[c.x+nx*sd*.13,ANK,c.z+nz*sd*.13];return [lerp(stand[0],w[0],walking),lerp(stand[1],w[1],walking),lerp(stand[2],w[2],walking)]},l=foot('l',1),r=foot('r',-1),sw=(l[0]-r[0])*c.dx+(l[2]-r[2])*c.dz,hand=(sd,q)=>[c.x+nx*sd*.33+c.dx*q*.5*walking,y0-.03,c.z+nz*sd*.33+c.dz*q*.5*walking];
   return {pos:[c.x,y0-g.bob*walking,c.z],yaw,feet:{l,r},hands:{l:hand(1,-sw),r:hand(-1,sw)},x:c.x,z:c.z,walking}}}}
