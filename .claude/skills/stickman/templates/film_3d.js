// STARTER FILM (3D). A working 9 s skeleton: real 3D cameras on a set painted exactly like the 2D style.
// Keep one world with fixed positions, and let the camera do what 2D cannot: slow orbits and push-ins.
import * as T from 'three';
import {clamp,lerp,ease,seg,kf,V,mesh,mat,Person,makeRenderer,makePost,HERO,STRANGER,ANK} from './lib3d.js';
import {makeCafe,table3,chair3,cup3,blob,walk3} from './world3d.js';
const FPS=30,DUR_=9,W_=1920,H_=1080,CUTS=[0,96,186,270];
const R=makeRenderer(),post=makePost(R),sc=new T.Scene(),cam=new T.PerspectiveCamera(35,W_/H_,.05,60);
const set=makeCafe(sc),hero=new Person(sc,HERO),man=new Person(sc,STRANGER);
const TX=-2,TZ=.3,OPEN=[2.2,3.1];table3(sc,TX,TZ);chair3(sc,TX-.62,TZ,Math.PI/2);const cup=cup3(sc,TX+.1,.785,TZ+.12);
const hs=blob(sc,1.2,.7),ms=blob(sc,1,.5);hs.position.set(TX-.6,.006,TZ);
const w=walk3({pts:[[set.DOORC,-3.8],[set.DOORC,-1.6],[1.5,.2]],t0:3.2,t1:7,stride:.62});
const sip=t=>ease(seg(t,6.6,7.1))*(1-ease(seg(t,7.9,8.3)));
function bl(t,l){for(const b of l)if(t>b&&t<b+.16)return Math.sin((t-b)/.16*Math.PI);return 0}
window.renderAt=t=>{t=clamp(t,0,DUR_-1/60);const f=Math.round(t*FPS),s=f>=CUTS[2]?2:f>=CUTS[1]?1:0,u=(f-CUTS[s])/(CUTS[s+1]-CUTS[s]);
 set.rain(t);set.door.rotation.y=ease(seg(t,...OPEN))*1.9;
 const q=w.at(t);man.pose({...q,lean:.02,breath:t*2,pole:undefined,hy:0,hp:.04,face:{mouth:-.5,brow:-.3,sad:.8,blink:bl(t,[5])}});ms.position.set(q.x,.006,q.z);
 const sp=sip(t),c=[lerp(TX+.1,TX-.2,sp),lerp(.785,1.16,sp),lerp(TZ+.12,TZ+.16,sp)];cup.position.set(...c);cup.rotation.z=sp*.5;
 const px=TX-.6,y=.54;hero.pose({pos:[px,y,TZ],yaw:Math.PI/2,lean:.05,breath:t*2.1,feet:{l:[px+.34,ANK,TZ+.12],r:[px+.34,ANK,TZ-.12]},hands:{l:[px+.42,.84,TZ-.2],r:[c[0]-.01,c[1]+.03,c[2]-.09]},pole:{l:[0,-1,-.6],r:[0,-1,.6]},hand:{r:'fist'},hy:kf(t,[[0,0],[2.6,0],[3.1,.45],[6.4,.45],[6.7,.25]]),hp:.04,face:{mouth:kf(t,[[0,.65],[2.6,.65],[3.2,.1]]),brow:kf(t,[[0,.1],[2.6,.1],[3.1,.8]]),look:kf(t,[[0,.3],[2.6,.3],[3,.8]]),blink:bl(t,[1.6,4.4])}});
 const C=[()=>({p:[lerp(-1.6,.8,ease(u)),1.5,lerp(5.4,5,u)],l:[lerp(-.6,1.2,ease(u)),1.15,-1],fov:46,focus:5,ap:.08}),()=>({p:[lerp(2.8,1.2,ease(u)),1.3,lerp(3.4,3.8,u)],l:[q.x,1.2,q.z],fov:40,focus:3.2,ap:.2}),()=>({p:[TX+1.3+u*.15,1.25,TZ+1.3],l:[TX-.45,1.22,TZ],fov:30,focus:2,ap:.55})][s]();
 cam.fov=C.fov;cam.position.set(...C.p);cam.lookAt(...C.l);cam.updateProjectionMatrix();post.P.focus.value=C.focus;post.P.ap.value=C.ap;post.P.time.value=f*.137%17;post.P.fade.value=Math.max(1-seg(t,0,.5),seg(t,DUR_-.6,DUR_-.03));post.render(sc,cam);
 return {t,f,sh:s,people:{},contacts:[],sym:0}};
window.CUTF=CUTS;window.DUR=DUR_;window.EVENTS=[];window.PLANTS={};window.READY=true;
