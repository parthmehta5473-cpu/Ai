// STARTER FILM (2D). A working 12 s skeleton: copy, then replace the shots and the action.
// It shows the patterns that matter: one world with fixed positions, every shot a camera on it,
// a door that opens before anyone walks in, a planted-foot walk, a sip with a clear cup, a report for the audit.
const SEAT=[440,600],CUP=[596,830],OPEN0=3.0,OPEN1=3.9,STEP=4.5,ARRIVE=7.6,STOP=[1820,868];
const inW=makeWalk({pts:[[DOOR.C,642],[DOOR.C-25,735],STOP],t0:STEP,t1:ARRIVE,steps:7,scale:cafeScale});
const sip=t=>ease(seg(t,8.6,9.1))*(1-ease(seg(t,9.9,10.3)));
const cupAt=t=>{const s=sip(t);return [lerp(CUP[0],SEAT[0]+90,s),lerp(CUP[1],SEAT[1]-26,s)]};
function hero(t){const s=sip(t),c=cupAt(t);const p={x:SEAT[0],y:SEAT[1],s:.86,face:1,noLegs:true,breath:t*2.1,look:kf(t,[[0,.55],[3.2,.55],[3.7,.9],[8.5,.9],[8.8,.55]]),lookY:kf(t,[[0,.5],[3.2,.5],[3.7,.1]]),brow:kf(t,[[0,.1],[3.3,.1],[3.7,.8],[6,.3]]),mouth:kf(t,[[0,.65],[3.2,.65],[3.8,.1],[10.4,.1],[11,.6]]),tilt:lerp(.03,-.12,s),blink:blinkAt(t,[1.8,5.6,9.7]),hands:{},tuck:{r:s>.3}};
 p.hands.r=[(c[0]-12-p.x)/p.s,(c[1]-lerp(52,40,s)-p.y)/p.s];return p}
function stranger(t){const w=inW.at(t),p={x:w.c[0],y:standY(w.c[1],w.s),s:w.s,face:-1,breath:t*2,hat:true,glasses:true,time:t,flut:kf(t,[[3,0],[4,1],[6,.6],[8,.2]]),brow:-.5,sad:-.85,mouth:-.6,mouthW:20,look:kf(t,[[0,0],[5,0],[5.5,-.7]]),lookY:.1};return walkPose(p,w)}
FILM={dur:12,cuts:[0,84,144,246,300,360],fadeIn:.5,fadeOut:.7,
 cam(s,u,t){const c=[{x:lerp(1200,1300,ease(u)),y:600,z:.72,b:[3,.6,0]},{x:2150,y:520,z:lerp(1.02,1.12,ease(u)),b:[4,1.2,0]},{x:lerp(1760,1500,ease(u)),y:600,z:.74,b:[3,.6,0]},{x:480,y:lerp(515,505,u),z:lerp(2.4,2.6,u),b:[18,12,0]},{x:lerp(1200,1120,ease(u)),y:600,z:.72,b:[3,.6,0]}][s];return c},
 draw(t,cam){const open=ease(seg(t,OPEN0,OPEN1)),ang=open*2.02+Math.sin(t*3.3)*.018*open,sp=sip(t),cw=cupAt(t);
  let x=layer('out',cam,.6);cafeOutside(x);camT(x,cam,1);cafeRain(x,t);
  x=layer('wall',cam);cafeWall(x);cafeFloor(x);
  const sp_=stranger(t),inside=inW.U(t)>.2;
  const v=layer('vl',cam);actor(v,'stranger',STRANGER,sp_,cam,'rgba(255,186,150,1)',-1);
  const a=layer('act',cam);doorLight(a,open,sp_);for(const lx of [300,860,1500,1950,2680])pendant(a,lx,t,.1+open*.5);softShadow(a,sp_.x,sp_.y+(STANDY+28)*sp_.s,120*sp_.s,14*sp_.s);
  const h=layer('hero',cam),hp=actor(h,'hero',HERO,hero(t),cam);
  const f=layer('fg',cam);sideTable(f,340,900,830);saucer(f,CUP[0],CUP[1],.86);drawCup(f,cw[0],cw[1],.86,lerp(0,-.42,sp));cupGrip(f,cw[0]-10+6*sp,cw[1]-lerp(26,28,sp),lerp(0,-.42,sp),HERO,.86);
  contact('hand-cup',h2w(hp,'r'),[cw[0]-12,cw[1]-lerp(52,40,sp)]);
  const d=layer('door',cam);doorLeaf(d,ang,kf(t,[[1.6,0],[2.2,.75],[2.8,.75],[3.05,0]]));
  comp([['out',cam.b[0]]]);if(!inside)blit(ctx,L.vl,0);blit(ctx,L.wall,cam.b[1]);cafeRefl(open,cam);blit(ctx,L.door,cam.b[1]*.7);blit(ctx,L.act,cam.b[1]*.45);if(inside)blit(ctx,L.vl,0);blit(ctx,L.hero,0);blit(ctx,L.fg,cam.b[2])},
 plants(){return {stranger:inW.plants()}}};
// sound timeline: sound events live on the same clock as the picture
say(OPEN0-.13,'latch');say(OPEN0,'door');say(OPEN1,'doorstop');say(9.95,'cupdown');
