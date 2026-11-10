import * as T from '../assets/three.module.js';
import {traceEase} from './gestures.js';
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
// Fresnel rim light: a soft edge glow tinted by the place (torchlight indoors, sky outdoors) that
// keeps characters readable against dark stone and gives them a filmic separation from the set.
const RIM={color:{value:new T.Color('#ffd9b0')},strength:{value:.4},power:{value:2.7}};
const RIM_MATERIALS=new Set(['M_Skin','M_Hair','M_Robe','M_Lining','M_Vest','M_Shirt','M_Trousers','M_Shoes']);
export function setActorRim(color,strength){RIM.color.value.set(color);RIM.strength.value=strength;}
function addRim(m){
 m.onBeforeCompile=sh=>{
  sh.uniforms.rimColor=RIM.color;sh.uniforms.rimStrength=RIM.strength;sh.uniforms.rimPower=RIM.power;
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 rimColor;uniform float rimStrength;uniform float rimPower;')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{float rimF=1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0);totalEmissiveRadiance+=rimColor*rimStrength*pow(rimF,rimPower)*mix(vec3(.3),diffuseColor.rgb,.55);}');
 };
 m.customProgramCacheKey=()=>'actor-rim';
}
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
 if(RIM_MATERIALS.has(base.name))addRim(m);
 shared.set(key,m);return m;
}
function blobShadow(){
 if(!shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'#0009');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(0,0,64,64);shadowTexture=new T.CanvasTexture(c);}
 const g=new T.PlaneGeometry(1.25,1.25),m=new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});const mesh=new T.Mesh(g,m);mesh.rotation.x=-Math.PI/2;mesh.position.y=.02;mesh.userData.skipAO=true;mesh.renderOrder=-1;return mesh;
}
// Far characters are one merged mesh (Body_LOD2) with one material. Its vertex colour carries the baked
// shading in RGB and a palette slot in alpha; each character owns a 16-texel palette with its colours.
const PALETTE=['M_Skin','M_Hair','M_Robe','M_Lining','M_Vest','M_Shirt','M_Trousers','M_Shoes','M_Lips','M_EyeWhite','M_Iris','M_Pupil','M_Gold','M_Wand','M_Book','M_Page'];
const HEADGEAR=/^(Hair_|Hat|Beard)/,FAR_K=1.5;
function farMaterial(colours){
 const data=new Uint8Array(64),c=new T.Color();
 PALETTE.forEach((n,i)=>{c.copy(colours[n]||c.set('#808080')).convertLinearToSRGB();data.set([Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255),255],i*4);});
 const tex=new T.DataTexture(data,16,1,T.RGBAFormat);tex.colorSpace=T.SRGBColorSpace;tex.magFilter=tex.minFilter=T.NearestFilter;tex.needsUpdate=true;
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0});m.name='M_Far';m.userData.palette=tex;
 m.onBeforeCompile=sh=>{sh.uniforms.palette={value:tex};
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D palette;')
   .replace('#include <color_fragment>','diffuseColor.rgb*=vColor.rgb*texture2D(palette,vec2((floor(vColor.a*16.)+.5)/16.,.5)).rgb;');};
 m.customProgramCacheKey=()=>'far-palette';
 return m;
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
 const lod=[[],[]],wantHair=HAIR[style]||HAIR.short,headMeshes=[],detail=[],used={};
 let far=null,farMat=null;
 // small facial parts only matter up close: hidden on the far model and beyond a few metres
 const DETAIL=new Set(['M_Teeth','M_Mouth','M_Lash','M_EyeGlint']);
 for(const o of parts){
  const base=o.name.replace(/_LOD1$/,''),isLod=o.name!==base;
  if(base==='Body_LOD2'){far=o;continue;}
  let show=true;
  if(base==='Hat')show=!!hat;else if(base==='Beard')show=!!beard;else if(base==='Book')show=false;else if(base.startsWith('Hair_'))show=base===wantHair;
  o.userData.wanted=show;o.userData.base=base;lod[isLod?1:0].push(o);
  o.traverse(m=>{
   if(!m.isMesh)return;
   m.receiveShadow=true;m.castShadow=!isLod;m.layers.set(ACTOR_LAYER);
   const mn=Array.isArray(m.material)?'':m.material?.name;
   if(DETAIL.has(mn)){if(isLod)m.visible=false;else detail.push(m);}
   const swap=mt=>{
    if(mt.name==='M_Lining'){if(!accent){accent=upgrade(mt,null).clone();accent.color.set(color);}return accent;}
    const k=TINT[mt.name];return used[mt.name]=upgrade(mt,k?colours[k]:null);
   };
   m.material=Array.isArray(m.material)?m.material.map(swap):swap(m.material);
   if(base==='Head'&&!isLod&&m.morphTargetDictionary)headMeshes.push(m);
  });
 }
 // Every part arrives with its own copy of the same skeleton, so the bones would be computed and
 // uploaded once per part (thirty times per character). Bind them all to one skeleton instead.
 // Compression gives each part its own position scale, folded into its inverse bind matrices as
 // IBM_part = IBM_shared * Q; the same Q moved into the part's bind matrix gives identical skinning.
 {let sk=null;const Q=new T.Matrix4(),chk=new T.Matrix4();
  model.traverse(o=>{
   if(!o.isSkinnedMesh)return;if(!sk){sk=o.skeleton;return;}
   const a=o.skeleton;if(a===sk||a.bones.length!==sk.bones.length)return;
   for(let i=0;i<a.bones.length;i++)if(a.bones[i]!==sk.bones[i])return;
   Q.copy(sk.boneInverses[0]).invert().multiply(a.boneInverses[0]);
   for(let i=1;i<a.bones.length;i++){chk.multiplyMatrices(sk.boneInverses[i],Q);const x=chk.elements,y=a.boneInverses[i].elements;for(let k=0;k<16;k++)if(Math.abs(x[k]-y[k])>2e-3*(1+Math.abs(y[k])))return;}
   o.bind(sk,Q.multiply(o.bindMatrix));
  });}
 if(far){
  const mesh=[];far.traverse(m=>{if(m.isMesh)mesh.push(m);});
  if(mesh.length&&mesh.every(m=>m.geometry.attributes.color?.itemSize===4)){
   const cols={};for(const n of PALETTE)if(used[n])cols[n]=used[n].color;if(accent)cols.M_Lining=accent.color;
   farMat=farMaterial(cols);
   for(const m of mesh){m.material=farMat;m.receiveShadow=true;m.castShadow=false;m.layers.set(ACTOR_LAYER);m.frustumCulled=false;}
  }else{far.visible=false;far=null;}
 }
 const setLodVisibility=level=>{
  const lv=Math.min(level,1),useFar=level===2&&!!far;
  for(let i=0;i<2;i++)for(const o of lod[i])o.visible=o.userData.wanted&&i===lv&&(!useFar||HEADGEAR.test(o.userData.base));
  if(far)far.visible=useFar;
 };
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
 let detailOn=true;
 let phaseAcc=Math.random(),smoothedSpeed=0,smoothedSide=0,talkWeight=0,disposed=false,lodLevel=0,skipped=0,dist=0;
 const gestures=[];                         // additive one-shots {name,t,speed,hold,release,weight}
 const loops={guard:0,think:0,read:0},loopTarget={guard:0,think:0,read:0};
 let over=null;const fading=[];           // full-body override and the ones fading out
 let down=false,seated=null;
 const expr={},exprTarget={};for(const k of MORPHS){expr[k]=0;exprTarget[k]=0;}
 let jawExpr=0,exprHold=0,blinkT=1+Math.random()*3,blink=0,speech=null,jaw=0,mO=0,mW=0;
 let lookTarget=null,lookWeight=0,lookYaw=0,lookPitch=0,eyeYaw=0,eyePitch=0,lumosGlow=0;
 const saccade={x:0,y:0,t:0},savedNeck=new T.Quaternion(),savedHead=new T.Quaternion();let gazeApplied=false;
 // ---------------------------------------------------------------- drawing a pattern in the air with the wand (two-bone arm IK)
 const ARM={upper:bone('upper_armR'),fore:bone('forearmR'),hand:bone('handR'),tip:bone('wand_tip')};
 const armSaved=[new T.Quaternion(),new T.Quaternion(),new T.Quaternion()];let armApplied=false,trace=null;
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
  // draw a pattern in the air: points in card space (x right, y down, 0..1) over `seconds`;
  // mirror it when the character faces the viewer, so the shape reads the right way round
  trace(points,seconds=1.6,{mirror=false,size=.56}={}){if(!ARM.upper||!points?.length)return 0;trace={path:points,dur:Math.max(.2,seconds),t:-.3,mirror,size,live:false,target:[points[0][0],points[0][1]],w:trace?.w||0,end:false};return seconds+.3;},
  // follow a point that moves live (the player's own stroke on the slate)
  traceLive(on,{mirror=false,size=.56}={}){if(!ARM.upper)return;if(on)trace={path:null,dur:1,t:0,mirror,size,live:true,target:trace?.target||[.5,.5],w:trace?.w||0,end:false};else if(trace)trace.end=true;},
  setTraceTarget(x,y){if(trace?.live){trace.target[0]=x;trace.target[1]=y;}},
  tracing:()=>!!trace&&!trace.end,
  update(dt,time,motion=0,talking=false){
   if(disposed)return;
   const speed=typeof motion==='number'?motion:motion.speed||0,side=typeof motion==='number'?0:motion.side||0,back=typeof motion==='object'&&!!motion.back;
   if(CAMERA){
    dist=CAMERA.position.distanceTo(root.getWorldPosition(_v));
    const t2=LOD_DISTANCE*FAR_K,above1=lodLevel>=1?dist>LOD_DISTANCE*.92:dist>LOD_DISTANCE*1.08,above2=lodLevel>=2?dist>t2*.94:dist>t2*1.06;
    const want=far&&above2?2:above1?1:0;
    if(want!==lodLevel){lodLevel=want;setLodVisibility(lodLevel);}
    // far actors are animated at a lower rate
    const every=dist>55?4:dist>30?2:1;skipped+=dt;
    if(every>1&&(Math.floor(time*60)%every)!==0)return;
    dt=skipped;skipped=0;
   }
   const nearFace=dist<7.5;if(nearFace!==detailOn){detailOn=nearFace;for(const m of detail)m.visible=nearFace;}
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
   if(armApplied){ARM.upper.quaternion.copy(armSaved[0]);ARM.fore.quaternion.copy(armSaved[1]);ARM.hand.quaternion.copy(armSaved[2]);armApplied=false;}
   mixer.update(dt);
   if(lodLevel===0&&dist<26)faceUpdate(dt,time);
   if(trace)armTrace(dt);
   const casting=gestures.some(g=>g.name==='cast'||g.name.startsWith('spell'));
   tip.visible=casting||!!lumosGlow;tip.scale.setScalar(casting?.016+Math.sin(time*40)*.004:.014);
  },
  dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);accent?.dispose();farMat?.userData.palette.dispose();farMat?.dispose();tipMaterial.dispose();tipGeometry.dispose();root.traverse(o=>{if(o.isMesh&&o.material?.map===shadowTexture){o.geometry.dispose();o.material.dispose();}});}
 };
 // ---------------------------------------------------------------- arm IK
 const _S=new T.Vector3(),_E=new T.Vector3(),_Wr=new T.Vector3(),_Tg=new T.Vector3(),_fw=new T.Vector3(),_rt=new T.Vector3(),_UP=new T.Vector3(0,1,0),
  _pole=new T.Vector3(),_dir=new T.Vector3(),_dW=new T.Vector3(),_tp=new T.Vector3(),_o=new T.Vector3(),_a1=new T.Vector3(),_a2=new T.Vector3(),
  _wq=new T.Quaternion(),_pq=new T.Quaternion(),_dq=new T.Quaternion();
 // turn a bone so that a point it carries (child) moves towards a target, blended by weight
 function aimBone(boneObj,child,target,weight){
  boneObj.getWorldPosition(_o);
  _a1.copy(child).sub(_o).normalize();_a2.copy(target).sub(_o).normalize();
  _dq.setFromUnitVectors(_a1,_a2);boneObj.getWorldQuaternion(_wq);_dq.multiply(_wq);
  boneObj.parent.getWorldQuaternion(_pq);_pq.invert().multiply(_dq);
  boneObj.quaternion.slerp(_pq,weight);boneObj.updateMatrixWorld(true);
 }
 function armTrace(dt){
  const tr=trace;
  tr.w=damp(tr.w,tr.end?0:1,tr.end?6:tr.live?14:8,dt);
  if(tr.end&&tr.w<.01){trace=null;return;}
  tr.t+=dt;
  let x=tr.target[0],y=tr.target[1];
  if(!tr.live){
   const u=traceEase(clamp(tr.t/tr.dur,0,1)),n=tr.path.length-1,f=u*n,i=Math.min(n-1,Math.max(0,Math.floor(f))),k=f-i,a=tr.path[i],b=tr.path[Math.min(n,i+1)];
   x=a[0]+(b[0]-a[0])*k;y=a[1]+(b[1]-a[1])*k;
   if(tr.t>tr.dur+.35)tr.end=true;
  }else{tr.sx=damp(tr.sx??x,x,22,dt);tr.sy=damp(tr.sy??y,y,22,dt);x=tr.sx;y=tr.sy;}
  if(tr.mirror)x=1-x;
  armSaved[0].copy(ARM.upper.quaternion);armSaved[1].copy(ARM.fore.quaternion);armSaved[2].copy(ARM.hand.quaternion);armApplied=true;
  root.updateMatrixWorld(true);
  const sc=root.scale.y;
  // the drawing plane floats in front of the right shoulder and faces where the character faces
  root.getWorldQuaternion(_wq);_fw.set(0,0,1).applyQuaternion(_wq).setY(0).normalize();_rt.crossVectors(_fw,_UP);
  B.chest.getWorldPosition(_S);
  _Tg.copy(_S).addScaledVector(_fw,.44*sc).addScaledVector(_UP,.3*sc).addScaledVector(_rt,.13*sc)
   .addScaledVector(_rt,(x-.5)*tr.size*sc).addScaledVector(_UP,(.5-y)*tr.size*sc);
  // the wand points forward and a little up; the wrist sits one wand length behind the tip
  _dW.copy(_fw).multiplyScalar(.82).addScaledVector(_UP,.42).addScaledVector(_rt,.1).normalize();
  ARM.hand.getWorldPosition(_Wr);ARM.tip.getWorldPosition(_tp);const L=_Wr.distanceTo(_tp);
  const wrist=_Tg.clone().addScaledVector(_dW,-L);
  ARM.upper.getWorldPosition(_S);ARM.fore.getWorldPosition(_E);
  const a=_S.distanceTo(_E),b=_E.distanceTo(_Wr);
  _dir.copy(wrist).sub(_S);const d=clamp(_dir.length(),Math.abs(a-b)+1e-3,(a+b)*.998);_dir.normalize();
  // elbow hangs down, a little out and back
  _pole.copy(_UP).multiplyScalar(-1).addScaledVector(_rt,.55).addScaledVector(_fw,-.3);
  _pole.addScaledVector(_dir,-_pole.dot(_dir)).normalize();
  const xx=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-xx*xx));
  const elbow=_S.clone().addScaledVector(_dir,xx).addScaledVector(_pole,h),wristTarget=_S.clone().addScaledVector(_dir,d);
  aimBone(ARM.upper,_E,elbow,tr.w);
  ARM.hand.getWorldPosition(_Wr);aimBone(ARM.fore,_Wr,wristTarget,tr.w);
  ARM.tip.getWorldPosition(_tp);aimBone(ARM.hand,_tp,_Tg,tr.w);
 }
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
