import * as T from '../assets/three.module.js';
import {GLTFLoader} from '../assets/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../assets/addons/libs/meshopt_decoder.module.js';
import {clone as cloneSkinned} from '../assets/addons/utils/SkeletonUtils.js';
import * as Proc from './actors-proc.js';
export {createDummy,labelSprite} from './actors-proc.js';

// Skinned, keyframed wizard built in Blender (tools/blender). One rig serves every student
// and professor. The face is alive at runtime: eyes and head follow a target, the lids blink,
// the jaw follows speech and shape keys carry expressions. Distant actors switch to a lighter
// mesh (LOD1). If the model cannot load, the older procedural figures are used instead.

let ASSET=null;
try{const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);ASSET=await loader.loadAsync(new URL('../assets/models/wizard.glb',import.meta.url).href);}
catch(e){console.warn('Model czarodzieja niedostępny, używam prostszych postaci.',e);}

const RUNTIME_BONES=new Set(['jaw','lidL','lidR','eyeL','eyeR','pony']);
const ADDITIVE=['talk','cast','spell_raise','spell_swish','spell_shield','spell_slash','spell_circle','spell_zigzag','guard','wave','point','nod','shrug','laugh','think','read','cheer'];
const LOOP_LAYERS=['talk','guard','think','read'];
const ONE_SHOT_GESTURES=ADDITIVE.filter(n=>!LOOP_LAYERS.includes(n));
const OVERRIDES=['dodge','dodge_b','dodge_l','dodge_r','hit_front','hit_back','knockdown','lie','getup','sit','sit_read','bow'];
const LOOPED_OVERRIDES=new Set(['lie','sit','sit_read']);
export const SPELL_GESTURE={basic:'cast',lumos:'spell_raise',leviosa:'spell_swish',protego:'spell_shield',expelliarmus:'spell_slash',incendio:'spell_circle',depulso:'cast',glacius:'spell_zigzag',accio:'spell_swish',reparo:'spell_circle'};
// fraction of each gesture at which the spell leaves the wand
const RELEASE={cast:.36,spell_raise:.5,spell_swish:.74,spell_shield:.42,spell_slash:.47,spell_circle:.8,spell_zigzag:.82};
export const EXPRESSIONS={
 neutral:{},happy:{smile:.8,squint:.3,browUp:.12},joy:{smile:1,squint:.5,browUp:.3},sad:{browSad:.9,frown:.65},
 angry:{browAngry:.95,frown:.45,squint:.35},surprised:{browUp:1,mouthO:.45,jaw:.11},worried:{browSad:.75,mouthWide:.22,frown:.2},
 stern:{browAngry:.5,frown:.25},thinking:{browUp:.3,squint:.25,mouthWide:.08},smug:{smile:.45,squint:.3,browUp:.1},
 pain:{browSad:.6,browAngry:.35,squint:.85,mouthWide:.6,jaw:.07},focus:{browAngry:.32,squint:.22},kind:{smile:.45,browSad:.15,squint:.15}
};
const MORPHS=['smile','frown','browUp','browAngry','browSad','mouthO','mouthWide','squint'];

const CLIPS={},BIND={};
if(ASSET){
 for(const c of ASSET.animations){
  c.tracks=c.tracks.filter(t=>{const [node,prop]=t.name.split('.');return prop!=='scale'&&!RUNTIME_BONES.has(node)&&!(prop==='position'&&node!=='hips');});
  CLIPS[c.name]=c;
 }
 for(const n of ADDITIVE)if(CLIPS[n])CLIPS[n]=T.AnimationUtils.makeClipAdditive(CLIPS[n].clone(),0,CLIPS.ref||CLIPS[n],30);
 ASSET.scene.updateMatrixWorld(true);
 ASSET.scene.traverse(o=>{
  if(o.isBone){BIND[o.name]={local:o.quaternion.clone(),world:o.getWorldQuaternion(new T.Quaternion())};}
  if(o.isMesh)o.geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1,0),1.7);
 });
}

// Locomotion is a 1-D blend space. Every clip starts with the left heel strike,
// so the phase can be shared and the feet do not slide (metres travelled per cycle).
const GAITS=[{name:'walk',speed:1.25,stride:1.0},{name:'jog',speed:3.7,stride:2.467},{name:'run',speed:7.5,stride:4.5}];
const STRAFE={speed:1.5,stride:1.5*22/30};
const HAIR={short:'Hair_Short',long:'Hair_Long',bun:'Hair_Bun',pony:'Hair_Pony',curly:'Hair_Curly'};
const TINT={M_Skin:'skin',M_Hair:'hair',M_Robe:'robe',M_Iris:'eyes'};
const shared=new Map();
let clothTexture,shadowTexture,CAMERA=null,LOD_DISTANCE=13;
// characters are drawn on their own layer: the baked sun shadows skip them, char-shadows.js draws theirs live
export const ACTOR_LAYER=2;
export function setActorCamera(camera){CAMERA=camera;camera.layers.enable(ACTOR_LAYER);}
export function setActorQuality(q){LOD_DISTANCE=q==='ultra'?20:q==='high'?14:9;}
function fabric(){
 if(clothTexture)return clothTexture;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=((x*13+y*29)%17)-8,v=126+n+((x+y)%4<2?20:-20);ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);}
 clothTexture=new T.CanvasTexture(c);clothTexture.wrapS=clothTexture.wrapT=T.RepeatWrapping;clothTexture.repeat.set(26,26);return clothTexture;
}
// Physically based upgrades: fabric sheen on robes, a soft sheen on skin, glossy lips and eyes.
function upgrade(base,hex){
 const key=base.name+'|'+(hex||'')+'|'+base.vertexColors;
 if(shared.has(key))return shared.get(key);
 let m;
 const sheen={M_Robe:['#8090a0',.55,.18],M_Lining:['#ffffff',.4,.3],M_Hair:['#c0a080',.4,.3],M_Skin:['#ff9070',.25,.55],M_Trousers:['#808080',.4,.4],M_Vest:['#9098a0',.45,.3]}[base.name];
 if(sheen||['M_Lips','M_EyeWhite','M_Iris'].includes(base.name)){
  m=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(m,base);m.defines={STANDARD:'',PHYSICAL:''};m.name=base.name;
  if(sheen){m.sheen=sheen[2];m.sheenColor=new T.Color(sheen[0]);m.sheenRoughness=sheen[1];}
  if(base.name==='M_Lips'){m.clearcoat=.35;m.clearcoatRoughness=.35;}
  if(base.name==='M_EyeWhite'||base.name==='M_Iris'){m.clearcoat=1;m.clearcoatRoughness=.05;}
 }else m=base.clone();
 if(hex)m.color.set(hex);
 if(base.name==='M_Robe'){m.bumpMap=fabric();m.bumpScale=.16;}
 shared.set(key,m);return m;
}
function blobShadow(){
 if(!shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'#0009');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(0,0,64,64);shadowTexture=new T.CanvasTexture(c);}
 const g=new T.PlaneGeometry(1.25,1.25),m=new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});const mesh=new T.Mesh(g,m);mesh.rotation.x=-Math.PI/2;mesh.position.y=.02;mesh.userData.skipAO=true;mesh.renderOrder=-1;return mesh;
}
const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
const damp=(a,b,r,dt)=>a+(b-a)*(1-Math.exp(-r*dt));
const clamp=T.MathUtils.clamp;
const _v=new T.Vector3(),_v2=new T.Vector3(),_q=new T.Quaternion(),_q2=new T.Quaternion(),_e=new T.Euler(),_X=new T.Vector3(1,0,0);

// Visemes from written Polish: vowels open the jaw; o/u round the lips; e/i/y widen them.
function visemes(text){
 const out=[];
 for(const ch of String(text).toLowerCase()){
  if('aą'.includes(ch))out.push([.16,0,0]);else if('oóuy'.includes(ch))out.push(['y'===ch?.09:.11,ch==='y'?0:.75,ch==='y'?.4:0]);
  else if('eęi'.includes(ch))out.push([.08,0,.7]);else if('mbp'.includes(ch))out.push([0,0,0]);
  else if(/[a-ząćęłńóśźż]/.test(ch))out.push([.04,.1,.1]);else if(/[.,!?;:—–]/.test(ch))out.push([0,0,0],[0,0,0]);else out.push([.01,0,0]);
 }
 return out;
}

export function createActor(options={}){
 if(!ASSET)return Proc.createActor(options);
 const {color='#547da9',skin='#c6a183',hair='#342824',robe='#202c35',eyes='#4b3a28',hat=false,beard=false,style='short',scale=1,face={},build=1,headScale=1}=options;
 const root=new T.Group(),model=cloneSkinned(ASSET.scene);root.add(model);root.scale.setScalar(scale);
 const colours={skin,hair,robe,eyes};
 let accent=null;
 const rigNode=model.getObjectByName('WizardRig')||model;
 const parts=rigNode.children.filter(c=>!c.isBone);
 const lod=[[],[]],wantHair=HAIR[style]||HAIR.short,headMeshes=[];
 for(const o of parts){
  const base=o.name.replace(/_LOD1$/,''),isLod=o.name!==base;
  let show=true;
  if(base==='Hat')show=!!hat;else if(base==='Beard')show=!!beard;else if(base==='Book')show=false;else if(base.startsWith('Hair_'))show=base===wantHair;
  o.userData.wanted=show;o.userData.base=base;lod[isLod?1:0].push(o);
  o.traverse(m=>{
   if(!m.isMesh)return;
   m.receiveShadow=true;m.castShadow=!isLod;m.layers.set(ACTOR_LAYER);
   const swap=mt=>{
    if(mt.name==='M_Lining'){if(!accent){accent=upgrade(mt,null).clone();accent.color.set(color);}return accent;}
    const k=TINT[mt.name];return upgrade(mt,k?colours[k]:null);
   };
   m.material=Array.isArray(m.material)?m.material.map(swap):swap(m.material);
   if(base==='Head'&&!isLod&&m.morphTargetDictionary)headMeshes.push(m);
  });
 }
 const setLodVisibility=level=>{for(let i=0;i<2;i++)for(const o of lod[i])o.visible=o.userData.wanted&&i===level;};
 setLodVisibility(0);
 const book=parts.find(o=>o.name==='Book'),bookLod=parts.find(o=>o.name==='Book_LOD1');
 const bone=n=>model.getObjectByName(n);
 const B={};for(const n of ['hips','spine','chest','neck','head','jaw','lidL','lidR','eyeL','eyeR','pony','handR','handL'])B[n]=bone(n);
 // face variety (identity shape keys) shared by every primitive of the head
 const setMorph=(k,v)=>{for(const m of headMeshes){const i=m.morphTargetDictionary[k];if(i!==undefined)m.morphTargetInfluences[i]=v;}};
 for(const [k,v] of Object.entries({faceSoft:face.soft||0,faceOld:face.old||0,faceBroad:face.broad||0,faceNose:face.nose||0}))setMorph(k,v);
 if(B.head&&headScale!==1)B.head.scale.setScalar(headScale);
 if(build!==1&&B.chest){B.chest.scale.set(build,1,build);for(const c of B.chest.children)if(c.isBone)c.scale.set(1/build,1,1/build);}
 const tipBone=bone('wand_tip')||model;
 const tipMaterial=new T.MeshBasicMaterial({color:'#fff2cc'}),tipGeometry=new T.SphereGeometry(1,12,8);
 const tip=new T.Mesh(tipGeometry,tipMaterial);tip.scale.setScalar(.012);tip.visible=false;tipBone.add(tip);
 root.add(blobShadow());

 const mixer=new T.AnimationMixer(model);
 const A={};
 for(const n in CLIPS){if(n==='ref')continue;const a=mixer.clipAction(CLIPS[n]);a.play();a.setEffectiveWeight(0);a.timeScale=0;A[n]=a;}
 if(A.idle){A.idle.time=Math.random()*A.idle.getClip().duration;A.idle.timeScale=.9+Math.random()*.2;}
 for(const n of LOOP_LAYERS)if(A[n]){A[n].timeScale=1;A[n].time=Math.random()*A[n].getClip().duration;}
 const dur=n=>A[n]?A[n].getClip().duration:0;

 // ---------------------------------------------------------------- state
 let phaseAcc=Math.random(),smoothedSpeed=0,smoothedSide=0,talkWeight=0,disposed=false,lodLevel=0,skipped=0,dist=0;
 const gestures=[];                         // additive one-shots {name,t,speed,hold,release,weight}
 const loops={guard:0,think:0,read:0},loopTarget={guard:0,think:0,read:0};
 let over=null;const fading=[];           // full-body override and the ones fading out
 let down=false,seated=null;
 const expr={},exprTarget={};for(const k of MORPHS){expr[k]=0;exprTarget[k]=0;}
 let jawExpr=0,exprHold=0,blinkT=1+Math.random()*3,blink=0,speech=null,jaw=0,mO=0,mW=0;
 let lookTarget=null,lookWeight=0,lookYaw=0,lookPitch=0,eyeYaw=0,eyePitch=0,lumosGlow=0;
 const saccade={x:0,y:0,t:0},savedNeck=new T.Quaternion(),savedHead=new T.Quaternion();let gazeApplied=false;
 function play(name,{fadeIn=.2,fadeOut=.2,speed=1,next=null,onEnd=null}={}){
  if(!A[name])return;
  if(over?.name==='getup')down=false;
  if(over){fading.push({name:over.name,w:over.w,rate:1/Math.max(.08,Math.min(.3,fadeIn+.05))});}
  over={name,t:0,w:0,speed,loop:LOOPED_OVERRIDES.has(name),fadeIn:Math.max(.001,fadeIn),fadeOut,next,onEnd};
 }
 function stop(fade=.3){if(!over)return;fading.push({name:over.name,w:over.w,rate:1/fade});over=null;}
 const api={root,rig:model,head:B.head,wand:bone('wand'),tip,book,arms:[bone('upper_armL'),bone('upper_armR')],legs:[bone('thighL'),bone('thighR')],
  onStep:null,
  state:()=>({down,seated:!!seated,override:over?.name||null}),
  setColor(c){accent?.color.set(c);},
  cast(spell='basic',speed=1){
   const name=SPELL_GESTURE[spell]||'cast';
   for(const g of gestures)if(g.name==='cast'||g.name.startsWith('spell'))g.fade=true;
   const g={name,t:0,speed:speed*(name==='cast'?1.25:1),hold:spell==='protego',release:false,weight:1};
   gestures.push(g);
   return {gesture:name,release:(RELEASE[name]||.4)*dur(name)/g.speed,duration:dur(name)/g.speed};
  },
  releaseShield(){for(const g of gestures)if(g.name==='spell_shield')g.release=true;},
  gesture(name,speed=1){if(!A[name])return 0;gestures.push({name,t:0,speed,weight:1});return dur(name)/speed;},
  setLoop(name){for(const k in loopTarget)loopTarget[k]=k===name?1:0;},
  setGuard(on){loopTarget.guard=on?1:0;},
  read(on=true){loopTarget.read=on?1:0;},
  dodge(dir='f'){play({f:'dodge',b:'dodge_b',l:'dodge_l',r:'dodge_r'}[dir]||'dodge',{fadeIn:.04,fadeOut:.1});},
  hit(front=true){if(down)return;play(front?'hit_front':'hit_back',{fadeIn:.03,fadeOut:.18});},
  knockdown(){if(down)return dur('knockdown');down=true;seated=null;play('knockdown',{fadeIn:.05,next:'lie'});return dur('knockdown');},
  getUp(){if(!down)return 0;play('getup',{fadeIn:.15,fadeOut:.25,onEnd:()=>{down=false;}});return dur('getup');},
  sit(on=true,reading=false){if(down&&over?.name!=='getup')return;if(down)down=false;seated=on?(reading?'sit_read':'sit'):null;if(on)play(seated,{fadeIn:.55});else stop(.5);},
  bow(){play('bow',{fadeIn:.15,fadeOut:.25});return dur('bow');},
  setExpression(name='neutral',hold=0){const e=EXPRESSIONS[name]||{};for(const k of MORPHS)exprTarget[k]=e[k]||0;jawExpr=e.jaw||0;exprHold=hold;},
  say(text,seconds){const v=visemes(text);speech={v,t:0,len:seconds||Math.max(.6,v.length*.055)};return speech.len;},
  stopSpeaking(){speech=null;},
  speaking:()=>!!speech,
  _debug:()=>({lookYaw,lookPitch,eyeYaw,eyePitch,jaw}),
  lookAt(target,weight=1){lookTarget=target||null;lookWeight=target?weight:0;},
  setLumos(on){lumosGlow=on?1:0;},
  tipWorld(out=new T.Vector3()){return tip.getWorldPosition(out);},
  update(dt,time,motion=0,talking=false){
   if(disposed)return;
   const speed=typeof motion==='number'?motion:motion.speed||0,side=typeof motion==='number'?0:motion.side||0,back=typeof motion==='object'&&!!motion.back;
   if(CAMERA){
    dist=CAMERA.position.distanceTo(root.getWorldPosition(_v));
    const want=dist>LOD_DISTANCE*1.08?1:dist<LOD_DISTANCE*.92?0:lodLevel;
    if(want!==lodLevel){lodLevel=want;setLodVisibility(lodLevel);}
    // far actors are animated at a lower rate
    const every=dist>55?4:dist>30?2:1;skipped+=dt;
    if(every>1&&(Math.floor(time*60)%every)!==0)return;
    dt=skipped;skipped=0;
   }
   if(book)book.visible=lodLevel===0&&(seated==='sit_read'||loops.read>.05);
   if(bookLod)bookLod.visible=false;
   smoothedSpeed=damp(smoothedSpeed,speed,10,dt);smoothedSide=damp(smoothedSide,side,10,dt);
   const s=smoothedSpeed<.05?0:smoothedSpeed;
   // ---------------------------------------------------------- locomotion blend space
   const w={idle:0,walk:0,jog:0,run:0,strafe_l:0,strafe_r:0};let stride=GAITS[0].stride;
   if(s<=GAITS[0].speed){const k=smooth(s/GAITS[0].speed);w.idle=1-k;w.walk=k;}
   else{let done=false;for(let i=0;i<GAITS.length-1;i++){const a=GAITS[i],b=GAITS[i+1];if(s<=b.speed){const k=smooth((s-a.speed)/(b.speed-a.speed));w[a.name]=1-k;w[b.name]=k;stride=a.stride*(1-k)+b.stride*k;done=true;break;}}
    if(!done){w.run=1;stride=GAITS[2].stride;}}
   const sideK=clamp(Math.abs(smoothedSide),0,1);
   if(sideK>.01&&s>.05){const st=(1-w.idle)*sideK;for(const n of ['walk','jog','run'])w[n]*=1-sideK;w[smoothedSide>0?'strafe_l':'strafe_r']=st;stride=stride*(1-sideK)+STRAFE.stride*sideK;}
   const dir=back?-1:1,before=Math.floor(phaseAcc*2);
   phaseAcc+=dir*dt*s/stride;
   const phase=((phaseAcc%1)+1)%1;
   for(const n of ['walk','jog','run','strafe_l','strafe_r'])if(A[n])A[n].time=phase*dur(n);
   // footsteps: every gait plants the left heel at phase 0 and the right one at 0.5
   const after=Math.floor(phaseAcc*2);
   if(after!==before&&w.idle<.65&&!over&&api.onStep)api.onStep(((after%2)+2)%2===0?'L':'R',s,dist);
   // ---------------------------------------------------------- full-body overrides
   let ow=0;
   if(over){
    over.t+=dt*over.speed;const D=dur(over.name);
    if(over.loop){A[over.name].time=over.t%D;over.w=Math.min(1,over.t/over.fadeIn);}
    else{
     A[over.name].time=Math.min(over.t,D*.999);
     over.w=Math.min(1,over.t/over.fadeIn);if(!over.next&&over.fadeOut)over.w=Math.min(over.w,Math.max(0,(D-over.t)/over.fadeOut));
     if(over.t>=D){const done=over;over=null;done.onEnd?.();if(done.next)play(done.next,{fadeIn:.001});else if(seated)play(seated,{fadeIn:.3});}
    }
   }
   for(const n of OVERRIDES)if(A[n])A[n].setEffectiveWeight(0);
   for(let i=fading.length-1;i>=0;i--){const f=fading[i];f.w-=dt*f.rate;if(f.w<=0){fading.splice(i,1);continue;}A[f.name].setEffectiveWeight(f.w);ow+=f.w;}
   if(over){A[over.name].setEffectiveWeight(over.w);ow+=over.w;}
   const baseW=1-clamp(ow,0,1);
   for(const n in w)A[n]?.setEffectiveWeight(w[n]*baseW);
   // ---------------------------------------------------------- additive layers
   talkWeight=damp(talkWeight,talking&&s<.5&&!down?1:0,5,dt);
   for(const k in loops){loops[k]=damp(loops[k],down?0:loopTarget[k],6,dt);A[k]?.setEffectiveWeight(loops[k]);}
   A.talk?.setEffectiveWeight(talkWeight*(1-loops.read)*(1-loops.think));
   const active={};
   for(let i=gestures.length-1;i>=0;i--){
    const g=gestures[i],D=dur(g.name);
    if(g.hold&&!g.release&&g.t>=D*.97)g.t=D*.97;else g.t+=dt*g.speed;
    if(g.fade||(g.hold&&g.release))g.weight-=dt*6;
    if(g.t>=D||g.weight<=0||down){gestures.splice(i,1);continue;}
    active[g.name]=Math.max(active[g.name]||0,g.weight);A[g.name].time=Math.min(g.t,D*.999);
   }
   for(const n of ONE_SHOT_GESTURES)A[n]?.setEffectiveWeight(active[n]||0);
   // the mixer only writes changed values, so undo last frame's gaze offsets first
   if(gazeApplied){B.neck?.quaternion.copy(savedNeck);B.head?.quaternion.copy(savedHead);gazeApplied=false;}
   mixer.update(dt);
   if(lodLevel===0&&dist<26)faceUpdate(dt,time);
   const casting=gestures.some(g=>g.name==='cast'||g.name.startsWith('spell'));
   tip.visible=casting||!!lumosGlow;tip.scale.setScalar(casting?.016+Math.sin(time*40)*.004:.014);
  },
  dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);accent?.dispose();tipMaterial.dispose();tipGeometry.dispose();root.traverse(o=>{if(o.isMesh&&o.material?.map===shadowTexture){o.geometry.dispose();o.material.dispose();}});}
 };
 // ---------------------------------------------------------------- face
 function rotateBoneModel(boneObj,rest,bindWorld,qModel){
  // apply a rotation expressed in model axes on top of the bone's (rest or animated) local rotation
  _q2.copy(bindWorld).invert().multiply(qModel).multiply(bindWorld);
  if(rest)boneObj.quaternion.copy(rest);
  boneObj.quaternion.multiply(_q2);
 }
 const qYawPitch=(yaw,pitch)=>_q.setFromEuler(_e.set(-pitch,yaw,0,'YXZ'));
 function faceUpdate(dt,time){
  if(exprHold>0){exprHold-=dt;if(exprHold<=0)api.setExpression('neutral');}
  for(const k of MORPHS)expr[k]=damp(expr[k],exprTarget[k],6,dt);
  let jT=jawExpr,oT=0,wT=0;
  if(speech){speech.t+=dt;const i=Math.floor(speech.t/speech.len*speech.v.length);
   if(i>=speech.v.length)speech=null;else{const v=speech.v[i];jT=Math.max(jT,v[0]*(.85+.3*Math.sin(time*31)));oT=v[1];wT=v[2];}}
  jaw=damp(jaw,jT,speech?22:10,dt);mO=damp(mO,oT,18,dt);mW=damp(mW,wT,18,dt);
  for(const k of MORPHS){let v=expr[k];if(k==='mouthO')v=Math.max(v,mO);if(k==='mouthWide')v=Math.max(v,mW*.8);setMorph(k,v);}
  if(B.jaw)rotateBoneModel(B.jaw,BIND.jaw.local,BIND.jaw.world,_q.setFromAxisAngle(_X,jaw));
  let yawT=0,pitchT=0,want=0;
  if(lookTarget&&B.head&&B.chest){
   const target=lookTarget.isObject3D?lookTarget.getWorldPosition(_v2):_v2.copy(lookTarget);
   B.head.getWorldPosition(_v);const d=target.sub(_v);
   B.chest.getWorldQuaternion(_q2);_q2.multiply(_q.copy(BIND.chest.world).invert());d.applyQuaternion(_q2.invert());
   yawT=Math.atan2(d.x,d.z);pitchT=Math.atan2(d.y,Math.hypot(d.x,d.z));
   if(Math.abs(yawT)<2.1){want=lookWeight;yawT=clamp(yawT,-1.25,1.25);pitchT=clamp(pitchT,-.55,.45);}else{yawT=0;pitchT=0;}
  }
  const rate=want?5:3;lookYaw=damp(lookYaw,yawT*want,rate,dt);lookPitch=damp(lookPitch,pitchT*want,rate,dt);
  if(B.neck&&B.head){savedNeck.copy(B.neck.quaternion);savedHead.copy(B.head.quaternion);gazeApplied=true;}
  if(B.neck)rotateBoneModel(B.neck,null,BIND.neck.world,qYawPitch(lookYaw*.3,lookPitch*.3));
  if(B.head)rotateBoneModel(B.head,null,BIND.head.world,qYawPitch(lookYaw*.5,lookPitch*.45));
  saccade.t-=dt;if(saccade.t<=0){saccade.t=.4+Math.random()*1.6;saccade.x=(Math.random()-.5)*.12;saccade.y=(Math.random()-.5)*.07;}
  eyeYaw=damp(eyeYaw,clamp(yawT*want-lookYaw*.8,-.45,.45)+saccade.x,25,dt);eyePitch=damp(eyePitch,clamp(pitchT*want-lookPitch*.75,-.3,.3)+saccade.y,25,dt);
  for(const n of ['eyeL','eyeR'])if(B[n])rotateBoneModel(B[n],BIND[n].local,BIND[n].world,qYawPitch(eyeYaw,eyePitch));
  blinkT-=dt;if(blinkT<=0){blink=.16;blinkT=1.8+Math.random()*4.2;if(Math.random()<.15)blinkT=.25;}
  let b=0;if(blink>0){blink-=dt;const p=1-blink/.16;b=p<.4?p/.4:1-(p-.4)/.6;}
  const lid=clamp(b*.62+Math.max(0,-eyePitch)*.5+expr.squint*.1-expr.browUp*.06,-.1,.62);
  for(const n of ['lidL','lidR'])if(B[n])rotateBoneModel(B[n],BIND[n].local,BIND[n].world,_q.setFromAxisAngle(_X,lid));
 }
 api.setExpression('neutral');
 return api;
}
