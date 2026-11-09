import * as T from '../assets/three.module.js';

// Third-person camera in the spirit of story RPGs: an over-the-shoulder follow camera
// with lag, sprint breathing and hit shake, and a conversation director that cuts
// between over-the-shoulder shots, close-ups and a two-shot, keeping the 180° rule.
const V=()=>new T.Vector3(),UP=new T.Vector3(0,1,0);
const damp=(a,b,r,dt)=>a+(b-a)*(1-Math.exp(-r*dt));

export function createCameraRig(camera,graphics){
 const state={fov:57,shake:0,shakeT:0,idleLook:0,lastYawInput:0};
 const pos=V(),look=V(),tmp=V(),tmp2=V();
 const bars=document.createElement('div');bars.id='letterbox';bars.innerHTML='<i></i><i></i>';document.body.append(bars);
 // ---------------------------------------------------------------- conversation director
 const talk={active:false,npc:null,player:null,side:1,shot:'two',t:0,shotT:0,from:V(),to:V(),to0:V(),fov:38,drift:V(),focus:2,lines:0,blocked:null,shift:0,lift:0,move:null,back:null,seed:0};
 // every shot moves a little, like a camera on a slider or a slow crane: push in, arc around, never still
 const MOVES={npc:{push:.07,arc:.035},player:{push:.06,arc:-.03},close:{push:.05,arc:.05},two:{push:.02,arc:.09},demo:{push:.1,arc:.07},practice:{push:.06,arc:-.05},react:{push:.05,arc:-.04}};
 const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
 // eye level: the head bone sits at the base of the skull, the eyes ~13 cm above it
 function headOf(actor,out){if(!actor.head)return out.copy(actor.root.position).add(new T.Vector3(0,1.6,0));actor.head.getWorldPosition(out);return out.addScaledVector(UP,.12*actor.root.scale.y);}
 function pickSide(playerPos,npcPos){
  // stay on the side of the line where the camera already is (no disorienting jump)
  const axis=tmp.copy(npcPos).sub(playerPos);axis.y=0;axis.normalize();
  const side=tmp2.set(axis.z,0,-axis.x);
  return side.dot(V().copy(camera.position).sub(playerPos))>=0?1:-1;
 }
 function framing(kind){
  const P=headOf(talk.player,V()),N=headOf(talk.npc,V());
  const axis=V().copy(N).sub(P);axis.y=0;const d=Math.max(.8,axis.length());axis.normalize();
  const side=V().set(axis.z,0,-axis.x).multiplyScalar(talk.side);
  const from=V(),to=V();let fov=36,focus=1.5;
  if(kind==='npc'){from.copy(P).addScaledVector(axis,-.62).addScaledVector(side,.46).addScaledVector(UP,.06);to.copy(N).addScaledVector(side,-.14).addScaledVector(UP,-.11);fov=34;}
  else if(kind==='player'){from.copy(N).addScaledVector(axis,.62).addScaledVector(side,.46).addScaledVector(UP,.06);to.copy(P).addScaledVector(side,-.14).addScaledVector(UP,-.11);fov=34;}
  else if(kind==='react'){from.copy(P).addScaledVector(axis,1.05).addScaledVector(side,-.3).addScaledVector(UP,.03);to.copy(P).addScaledVector(UP,-.05);fov=27;}
  // lesson shots: a medium frame that shows the wand arm (demo = the teacher, practice = you)
  else if(kind==='demo'){from.copy(P).addScaledVector(axis,.15).addScaledVector(side,.85).addScaledVector(UP,-.12);to.copy(N).addScaledVector(UP,-.22);fov=38;}
  // practice: the mirror of the demo shot, from beside the teacher onto you and the shape you draw in the air
  else if(kind==='practice'){from.copy(N).addScaledVector(axis,-.15).addScaledVector(side,.85).addScaledVector(UP,-.12);to.copy(P).addScaledVector(UP,-.22);fov=38;}
  else if(kind==='close'){from.copy(N).addScaledVector(axis,-1.05).addScaledVector(side,.32).addScaledVector(UP,.02);to.copy(N).addScaledVector(UP,-.06);fov=27;}
  else{const mid=V().copy(P).lerp(N,.5);from.copy(mid).addScaledVector(side,Math.max(2.2,d*1.25)).addScaledVector(axis,-d*.18).addScaledVector(UP,.05);to.copy(mid).addScaledVector(UP,-.12);fov=40;}
  focus=from.distanceTo(kind==='player'||kind==='react'||kind==='practice'?P:kind==='two'?V().copy(P).lerp(N,.5):N);
  aim(from,to);
  return {from,to,fov,focus};
 }
 // keep the subject clear of an overlay: aim a little to the side (shift) or above (lift)
 function aim(from,to){if(talk.shift){const d=V().copy(to).sub(from);d.y=0;d.normalize();to.addScaledVector(V().set(-d.z,0,d.x),-talk.shift);}if(talk.lift)to.addScaledVector(UP,talk.lift);return to;}
 function cut(kind){
  let f=framing(kind);
  // never put the lens inside a wall: try the other side, then pull in closer
  if(talk.blocked&&talk.blocked(f.to,f.from)){talk.side*=-1;f=framing(kind);if(talk.blocked(f.to,f.from)){talk.side*=-1;f=framing('close');}}
  talk.shot=kind;talk.shotT=0;talk.from.copy(f.from);talk.to.copy(f.to);talk.to0.copy(f.to);talk.fov=f.fov;talk.focus=f.focus;talk.move=MOVES[kind]||{push:.04,arc:.03};talk.seed=Math.random()*100;
  talk.drift.set((Math.random()-.5)*.05,(Math.random()-.5)*.02,(Math.random()-.5)*.05).add(V().copy(f.to).sub(f.from).normalize().multiplyScalar(.035));
  camera.position.copy(talk.from);camera.fov=talk.fov;camera.updateProjectionMatrix();camera.lookAt(talk.to);
 }
 return {
  get talking(){return talk.active;},
  shake(amount=.25){state.shake=Math.max(state.shake,amount);state.shakeT=0;},
  yawInput(){state.lastYawInput=performance.now();},
  // ------------------------------------------------------------ exploration follow camera
  follow(dt,{focus,yaw,pitch,distance,sprint=0,facing=null,moving=false,combat=null,inside=false,clampTo=null,collide=null}){
   if(talk.active)return;
   // gentle recentre behind the character after a while without mouse input
   const idle=(performance.now()-state.lastYawInput)/1000;
   let y=yaw;
   if(facing!==null&&moving&&idle>2.2&&!combat){const target=facing+Math.PI,diff=Math.atan2(Math.sin(target-y),Math.cos(target-y));y+=diff*(1-Math.exp(-.9*dt));}
   if(combat){const toT=Math.atan2(focus.x-combat.x,focus.z-combat.z),diff=Math.atan2(Math.sin(toT-y),Math.cos(toT-y));if(Math.abs(diff)>.55)y+=Math.sign(diff)*(Math.abs(diff)-.55)*(1-Math.exp(-2.4*dt));}
   const dist=distance+(combat?.8:0)+sprint*.35;
   const right=tmp.set(Math.cos(y),0,-Math.sin(y));
   const shoulder=.42*Math.min(1.3,dist/4);
   const pivot=tmp2.copy(focus).addScaledVector(right,shoulder);
   const desired=V().copy(pivot).add(new T.Vector3(Math.sin(y)*dist*Math.cos(pitch),.32+Math.sin(pitch)*dist,Math.cos(y)*dist*Math.cos(pitch)));
   if(clampTo){
    // shorten the boom along its own line instead of sliding the lens sideways (no top-down views)
    let t=1;const dx=desired.x-pivot.x,dz=desired.z-pivot.z;
    if(dx>0)t=Math.min(t,(clampTo.maxX-.3-pivot.x)/dx);else if(dx<0)t=Math.min(t,(clampTo.minX+.3-pivot.x)/dx);
    if(dz>0)t=Math.min(t,(clampTo.maxZ-.3-pivot.z)/dz);else if(dz<0)t=Math.min(t,(clampTo.minZ+.3-pivot.z)/dz);
    if(t<1)desired.lerpVectors(pivot,desired,Math.max(.08,t));
   }
   if(collide){const t=collide(pivot,desired);if(t<1)desired.lerpVectors(pivot,desired,Math.max(.12,t-.06));}
   pos.lerp(desired,1-Math.exp(-(talk.wasActive?40:11)*dt));talk.wasActive=false;
   look.lerp(V().copy(pivot).addScaledVector(UP,.05),1-Math.exp(-16*dt));
   state.fov=damp(state.fov,57+sprint*7+(combat?2:0),4,dt);
   camera.fov=state.fov;camera.updateProjectionMatrix();
   camera.position.copy(pos);
   if(state.shake>0){state.shakeT+=dt;const k=state.shake*Math.exp(-state.shakeT*9);camera.position.add(new T.Vector3(Math.sin(state.shakeT*91)*k*.12,Math.sin(state.shakeT*77+1)*k*.1,Math.sin(state.shakeT*67+2)*k*.12));if(k<.003)state.shake=0;}
   camera.lookAt(look);
   return y;
  },
  snap(focus){pos.copy(camera.position);look.copy(focus);},
  // ------------------------------------------------------------ conversation
  startDialogue(player,npc,{blocked=null}={}){
   talk.active=true;talk.player=player;talk.npc=npc;talk.lines=0;talk.blocked=blocked;
   talk.side=pickSide(player.root.position,npc.root.position);
   document.body.classList.add('cinematic');
   cut('two');
  },
  npcLine(emphasis=false){if(!talk.active)return;talk.shift=talk.lift=0;talk.back=null;talk.lines++;cut(emphasis?'close':talk.lines===1&&talk.shot==='two'?'npc':(talk.lines%3===0?'close':'npc'));},
  shot(kind,{shift=0,lift=0}={}){if(!talk.active)return;talk.shift=shift;talk.lift=lift;cut(kind);},
  playerLine(){if(!talk.active)return;talk.shift=talk.lift=0;talk.back=null;cut('player');},
  // a short cut to the listener's face in the middle of a long line, then back to the speaker
  reaction(seconds=1.3){if(!talk.active||talk.shift||talk.lift)return;const back=talk.shot;cut('react');talk.back={kind:back,at:seconds};},
  endDialogue(){if(!talk.active)return;talk.active=false;talk.shift=talk.lift=0;talk.wasActive=true;document.body.classList.remove('cinematic');graphics?.setDOF(false);camera.fov=state.fov;camera.updateProjectionMatrix();},
  updateDialogue(dt){
   if(!talk.active)return;
   talk.shotT+=dt;
   if(talk.back&&talk.shotT>=talk.back.at){const k=talk.back.kind;talk.back=null;cut(k);}
   // the camera glides: a slow push-in and a small arc around the subject, eased, with a breath of handheld sway
   const m=talk.move,e=ease(Math.min(1,talk.shotT/7));
   const off=V().copy(talk.from).sub(talk.to0);
   off.applyAxisAngle(UP,m.arc*talk.side*e).multiplyScalar(1-m.push*e);
   const s=talk.seed,t=talk.shotT;
   camera.position.copy(talk.to0).add(off).add(V(Math.sin(t*.9+s)*.006,Math.sin(t*1.3+s*2)*.004,Math.cos(t*.7+s)*.006));
   const k=talk.shot;let target;
   // lesson shots hold their composition; conversation shots keep the speaker's eyes on the upper third
   if(k==='demo'||k==='practice')target=V().copy(talk.to0);
   else{
    target=k==='player'||k==='react'?headOf(talk.player,V()):k==='two'?headOf(talk.player,V()).lerp(headOf(talk.npc,V()),.5):headOf(talk.npc,V());
    target.addScaledVector(UP,k==='two'?-.12:k==='close'||k==='react'?-.06:-.11);aim(camera.position,target);
   }
   talk.to.lerp(target,1-Math.exp(-3*dt));
   camera.lookAt(talk.to);
   graphics?.setDOF(true,camera.position.distanceTo(talk.to),talk.shot==='close'?.009:.006,.009);
  }
 };
}
