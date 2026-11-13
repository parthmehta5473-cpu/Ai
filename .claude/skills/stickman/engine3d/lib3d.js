// ===== STICKMAN 3D: three.js helpers, the character rig and the post pipeline. =====
// Real 3D geometry and cameras, drawn to match the flat 2D style exactly: every colour is the same sRGB hex
// as 2D, shading is one flat shadow tone, the rim is a crisp warm edge, and sets are painted by the 2D set code.
// There are no scene lights, so it needs no shadow maps. Soft blob shadows and glow cones are painted, as in 2D.
import * as T from 'three';
T.ColorManagement.enabled=false;
export const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
export const seg=(t,a,b)=>clamp((t-a)/(b-a));
export function kf(t,k){if(t<=k[0][0])return k[0][1];for(let i=1;i<k.length;i++)if(t<k[i][0])return lerp(k[i-1][1],k[i][1],ease((t-k[i-1][0])/(k[i][0]-k[i-1][0])));return k[k.length-1][1]}
export function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
export const LOOK={L:{value:V(.45,.72,.53).normalize()},R:{value:V(.82,.25,.5).normalize()},rimC:{value:new T.Color('#ffc496')},rimK:{value:1},shade:{value:new T.Color('#c9b4d6')}};
const VS='varying vec3 vN,vP;varying vec2 vU;void main(){vU=uv;vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}';
const FS=`uniform vec3 col,L,R,rimC,shade;uniform float rimK,form;uniform sampler2D map;uniform bool hasMap;varying vec3 vN,vP;varying vec2 vU;
void main(){vec3 c=col;if(hasMap){vec4 t=texture2D(map,vU);if(t.a<.5)discard;c=t.rgb;}vec3 N=normalize(vN),Vw=normalize(cameraPosition-vP);
float s=smoothstep(-.12,.2,dot(N,L));c=mix(c,c*mix(shade,vec3(1.),s),form);
float f=1.-max(dot(N,Vw),0.);float r=smoothstep(.70,.74,f)*smoothstep(-.1,.35,dot(N,R));c=mix(c,rimC,r*rimK*form);gl_FragColor=vec4(c,1.);}`;
// flat material. o.form 0 turns off shadow tone and rim (walls, floors). o.map is a painted texture.
export function mat(c,o={}){return new T.ShaderMaterial({vertexShader:VS,fragmentShader:FS,side:o.side||T.FrontSide,uniforms:{col:{value:new T.Color(c||'#ffffff')},map:{value:o.map||null},hasMap:{value:!!o.map},form:{value:o.form??1},L:LOOK.L,R:LOOK.R,rimC:LOOK.rimC,rimK:LOOK.rimK,shade:LOOK.shade}})}
export function mesh(g,m){return new T.Mesh(g,m)}
const UP=V(0,1,0);
function setLimb(o,a,b,L){o.position.copy(a).add(b).multiplyScalar(.5);const d=b.clone().sub(a),l=d.length()||1e-4;o.quaternion.setFromUnitVectors(UP,d.divideScalar(l));o.scale.y=l/L}
export function ik3(a,t,l1,l2,pole){let dv=t.clone().sub(a),d=dv.length();const over=Math.max(0,d-(l1+l2-.002));d=clamp(d,Math.abs(l1-l2)+.01,l1+l2-.002);const dir=dv.normalize(),x=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-x*x)),pp=pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();return {e:a.clone().add(dir.clone().multiplyScalar(x)).add(pp.multiplyScalar(h)),h:a.clone().add(dir.clone().multiplyScalar(d)),over}}
export const THIGH=.33,SHIN=.33,SPINE=.52,UA=.27,FA=.26,HR=.23,STAND=.72,ANK=.07;
export const HERO={skin:'#F8E9CC',cloth:'#FF6B5E',hood:'#E4493F',face:'#1c1a2b',leg:'#2C2A49',shoe:'#17141F'};
export const FRIEND={skin:'#17141F',cloth:'#F6B73C',hood:'#D9962A',face:'#FFFFFF',leg:'#3A2F55',shoe:'#17141F'};
export const STRANGER={skin:'#C9C3CF',cloth:'#2A2536',hood:'#191622',face:'#17141F',leg:'#17141F',shoe:'#0f0d15',coat:true,hat:true};
export const WOMAN={skin:'#E9C6A0',cloth:'#2DB2AE',hood:'#187E86',face:'#1c1a2b',leg:'#2C2A49',shoe:'#17141F',bun:'#3A2030'};
export class Person{
 constructor(sc,c){this.c=c;const g=this.g=new T.Group();sc.add(g);const cl=mat(c.cloth),hd=mat(c.hood),lg=mat(c.leg),sk=mat(c.skin),sh=mat(c.shoe),ink=new T.MeshBasicMaterial({color:c.face});
  const cap=(r,L,m)=>{const o=mesh(new T.CapsuleGeometry(r,L,6,14),m);g.add(o);return o};this.torso=mesh(new T.CapsuleGeometry(.215,.3,8,20),cl);g.add(this.torso);this.hoodM=mesh(new T.TorusGeometry(.13,.062,10,24),hd);g.add(this.hoodM);this.back=mesh(new T.SphereGeometry(.16,16,12),hd);g.add(this.back);
  this.limbs={};for(const k of ['l','r']){const L=this.limbs[k]={th:cap(.088,THIGH,lg),sh:cap(.07,SHIN,lg),ua:cap(.07,UA,cl),fa:cap(.058,FA,cl),shoe:mesh(new T.CapsuleGeometry(.058,.16,4,10),sh),fist:mesh(new T.SphereGeometry(.066,14,12),sk)};g.add(L.shoe,L.fist)}
  const H=this.head=new T.Group();g.add(H);H.add(mesh(new T.SphereGeometry(HR,32,24),sk));this.eyes=[];this.brows=[];const eG=new T.SphereGeometry(1,12,10),bG=new T.CapsuleGeometry(.011,.062,3,6);
  for(const s of [-1,1]){const e=new T.Mesh(eG,ink);e.rotation.y=s*.38;H.add(e);this.eyes.push(e);const b=new T.Mesh(bG,ink);b.position.z=.2;b.rotation.y=s*.4;H.add(b);this.brows.push(b)}
  this.mouth=new T.Mesh(new T.BufferGeometry(),ink);H.add(this.mouth);
  if(c.hat){const dk=mat('#14111B'),band=mat('#8E2F2C'),b=mesh(new T.CylinderGeometry(.36,.38,.02,40),dk);b.position.y=.16;const cr=mesh(new T.CylinderGeometry(.19,.235,.21,32),dk);cr.position.y=.27;const bd=mesh(new T.CylinderGeometry(.228,.236,.05,32),band);bd.position.y=.195;H.add(b,cr,bd);
   const gm=new T.MeshBasicMaterial({color:'#0d0b14'});for(const s of [-1,1]){const l=new T.Mesh(new T.CapsuleGeometry(.05,.05,6,14),gm);l.rotation.z=Math.PI/2;l.scale.set(.95,1,.22);l.position.set(s*.087,.035,.228);l.rotation.y=s*.36;H.add(l)}}
  if(c.coat){this.coat=mesh(new T.CylinderGeometry(.26,.37,.82,28,1,true),mat(c.cloth,{side:T.DoubleSide}));g.add(this.coat)}if(c.bun){const b=mesh(new T.SphereGeometry(.1,14,12),mat(c.bun));b.position.set(0,.2,-.13);H.add(b)}}
 // p: pos yaw lean breath feet{l,r} hands{l,r} pole{l,r} hand{l:'fist'} hy hp hr face{mouth,brow,sad,blink,look,lookY}
 pose(p){const yaw=p.yaw,lean=p.lean||0,F=V(Math.sin(yaw),0,Math.cos(yaw)),S=V(Math.cos(yaw),0,-Math.sin(yaw)),P=V(...p.pos),U=UP.clone().multiplyScalar(Math.cos(lean)).add(F.clone().multiplyScalar(Math.sin(lean))).normalize(),Fd=F.clone().sub(U.clone().multiplyScalar(F.dot(U))).normalize(),Sd=U.clone().cross(Fd).normalize(),C=P.clone().add(U.clone().multiplyScalar(SPINE)),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(Sd,U,Fd)),br=Math.sin(p.breath||0)*.006;
  this.torso.position.copy(P).add(U.clone().multiplyScalar(.24));this.torso.quaternion.copy(q);this.torso.scale.set(1.24,1+br,.9);const nk=C.clone().add(U.clone().multiplyScalar(.05));this.hoodM.position.copy(nk).add(Fd.clone().multiplyScalar(-.01));this.hoodM.quaternion.copy(q).multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2-.2,0,0)));this.back.position.copy(nk).add(Fd.clone().multiplyScalar(-.1)).add(U.clone().multiplyScalar(-.03));this.back.scale.set(1.15,.8,.7);this.back.quaternion.copy(q);if(this.coat){this.coat.position.copy(P).add(U.clone().multiplyScalar(-.09));this.coat.quaternion.copy(q)}
  const out={};for(const k of ['l','r']){const s=k=='l'?1:-1,L=this.limbs[k],hip=P.clone().add(Sd.clone().multiplyScalar(s*.115)),ft=V(...p.feet[k]),ki=ik3(hip,ft,THIGH,SHIN,F.clone().add(V(0,.1,0)));setLimb(L.th,hip,ki.e,THIGH);setLimb(L.sh,ki.e,ki.h,SHIN);L.shoe.position.copy(ft).add(V(Math.sin(yaw)*.06,-.012,Math.cos(yaw)*.06));L.shoe.quaternion.setFromUnitVectors(UP,V(Math.sin(yaw),0,Math.cos(yaw)));
   const sh=C.clone().add(U.clone().multiplyScalar(-.07)).add(Sd.clone().multiplyScalar(s*.255)),ht=p.hands?.[k]?V(...p.hands[k]):sh.clone().add(U.clone().multiplyScalar(-.5)).add(Sd.clone().multiplyScalar(s*.05)).add(Fd.clone().multiplyScalar(.03)),pole=p.pole?.[k]?V(...p.pole[k]):Fd.clone().multiplyScalar(-1).add(Sd.clone().multiplyScalar(s*.5)).add(U.clone().multiplyScalar(-.25)),ar=ik3(sh,ht,UA,FA,pole);setLimb(L.ua,sh,ar.e,UA);setLimb(L.fa,ar.e,ar.h,FA);L.fist.visible=p.hand?.[k]=='fist';L.fist.position.copy(ar.h).add(ar.h.clone().sub(ar.e).normalize().multiplyScalar(.035));out[k]={hand:ar.h,elbow:ar.e,over:ar.over,foot:ft}}
  this.head.position.copy(C).add(U.clone().multiplyScalar(.07+HR-.02));this.head.quaternion.copy(q).multiply(new T.Quaternion().setFromEuler(new T.Euler(p.hp||0,p.hy||0,p.hr||0,'YXZ')));const f=p.face||{},bl=f.blink||0,lx=(f.look||0)*.03,ly=(f.lookY||0)*.018;
  this.eyes.forEach((e,i)=>{const s=i?1:-1;e.position.set(s*.085+lx,.035+ly,.214);e.scale.set(.019,lerp(.034,.004,bl),.008)});this.brows.forEach((b,i)=>{const s=i?1:-1;b.position.y=.115+(f.brow||0)*.022+ly;b.position.x=s*.085+lx;b.rotation.z=Math.PI/2+s*(f.sad||0)*.3});
  const m=f.mouth||0,mw=.07,c=(x,y)=>{const v=V(x+lx,y,0);v.z=Math.sqrt(Math.max(.001,.0545-x*x-y*y));return v},cv=new T.QuadraticBezierCurve3(c(-mw,-.095+m*.022),c(0,-.095-m*.055),c(mw,-.095+m*.022));this.mouth.geometry.dispose();this.mouth.geometry=new T.TubeGeometry(cv,8,.0085,6,false);return out}}
// foot-locked gait along a line. s = distance walked, L = stride.
export function gait(s,L){const p=s/L,n=Math.floor(p),u=p-n,st=(n+.5)*L,a=(n-.5)*L,b=(n+1.5)*L,sx=lerp(a,b,ease(u)),lift=Math.sin(u*Math.PI)*.1,even=n%2==0,pl=[st,0],pr=[sx,lift];return{l:even?pl:pr,r:even?pr:pl,bob:Math.abs(Math.sin(u*Math.PI))*.018,n}}
export const texture=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.NoColorSpace;t.anisotropy=8;return t};
// post: depth of field in sRGB like the 2D layer blur, then the same vignette, warm soft-light grade and grain as 2D
export function makePost(R,W=1920,H=1080){const dt=new T.DepthTexture(W,H,T.UnsignedIntType),rt=new T.WebGLRenderTarget(W,H,{samples:4,depthTexture:dt,colorSpace:T.NoColorSpace}),qs=new T.Scene(),qc=new T.OrthographicCamera(-1,1,1,-1,0,1),qm=new T.Mesh(new T.PlaneGeometry(2,2));qs.add(qm);
 const P={c:{value:rt.texture},dp:{value:dt},focus:{value:3},ap:{value:0},near:{value:.05},far:{value:60},fade:{value:0},time:{value:0}};
 qm.material=new T.ShaderMaterial({uniforms:P,depthTest:false,depthWrite:false,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D c,dp;uniform float focus,ap,near,far,fade,time;varying vec2 v;
float lz(vec2 u){float d=texture2D(dp,u).x*2.-1.;return 2.*near*far/(far+near-d*(far-near));}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){float z=lz(v);float coc=clamp(abs(z-focus)/max(z,.1)*ap,0.,1.);vec2 px=vec2(1./1920.,1./1080.);vec3 s=texture2D(c,v).rgb;float n=1.;
 if(coc>.02){float R=coc*22.;for(float i=1.;i<=18.;i++){float a=i*2.39996,r=sqrt(i/18.)*R;vec2 o=vec2(cos(a),sin(a))*r*px;float zz=lz(v+o);float k=zz<z-.05?clamp(abs(zz-focus)/max(zz,.1)*ap*1.6,0.,1.):1.;s+=texture2D(c,v+o).rgb*k;n+=k;}s/=n;}
 vec3 col=s;vec2 q=(v-.5)*vec2(1920.,1080.);float vg=smoothstep(486.,1134.,length(q));col=mix(col,vec3(.078,.031,.133),vg*.6);
 vec3 b=vec3(1.,.706,.588);col=mix(col,(1.-2.*b)*col*col+2.*b*col,.5);col+=(h(v*vec2(1920.,1080.)+time)-.5)*.022;col*=1.-fade;gl_FragColor=vec4(col,1.);}`});
 return {P,render(sc,cam){R.setRenderTarget(rt);R.clear();R.render(sc,cam);R.setRenderTarget(null);R.render(qs,qc)}}}
export function makeRenderer(){const R=new T.WebGLRenderer({canvas:document.getElementById('c'),antialias:false,preserveDrawingBuffer:true});R.setSize(1920,1080,false);R.setPixelRatio(1);R.toneMapping=T.NoToneMapping;R.outputColorSpace=T.LinearSRGBColorSpace;return R}
