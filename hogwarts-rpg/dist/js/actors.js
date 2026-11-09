import * as T from '../assets/three.module.js';
import {GLTFLoader} from '../assets/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from '../assets/addons/utils/SkeletonUtils.js';
import * as Proc from './actors-proc.js';
export {createDummy,labelSprite} from './actors-proc.js';

// Skinned, keyframed wizard built in Blender (tools/blender). One rig serves every
// student and professor; hair, beard and hat are switchable parts, colours are tinted
// per actor. If the model cannot load, the older procedural figures are used instead.

let ASSET=null;
try{ASSET=await new GLTFLoader().loadAsync(new URL('../assets/models/wizard.glb',import.meta.url).href);}
catch(e){console.warn('Model czarodzieja niedostępny, używam prostszych postaci.',e);}

const CLIPS={};
if(ASSET){
 for(const c of ASSET.animations)CLIPS[c.name]=c;
 for(const n of ['talk','cast'])if(CLIPS[n])CLIPS[n]=T.AnimationUtils.makeClipAdditive(CLIPS[n].clone());
 ASSET.scene.traverse(o=>{if(o.isMesh){o.geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1,0),1.7);}});
}

// Locomotion is a 1-D blend space. Every clip starts with the left heel strike,
// so the phase can be shared and the feet do not slide (metres travelled per cycle).
const GAITS=[{name:'walk',speed:1.25,stride:1.0},{name:'jog',speed:3.7,stride:2.467},{name:'run',speed:7.5,stride:4.5}];
const HAIR={short:'Hair_Short',long:'Hair_Long',bun:'Hair_Bun'};
const TINT={M_Skin:'skin',M_Hair:'hair',M_Robe:'robe',M_Iris:'eyes'};
const shared=new Map();
let clothTexture,shadowTexture;
function fabric(){
 if(clothTexture)return clothTexture;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=((x*13+y*29)%17)-8,v=126+n+((x+y)%4<2?20:-20);ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);}
 clothTexture=new T.CanvasTexture(c);clothTexture.wrapS=clothTexture.wrapT=T.RepeatWrapping;clothTexture.repeat.set(26,26);return clothTexture;
}
function tinted(base,hex){
 const key=base.name+'|'+hex;
 if(!shared.has(key)){const m=base.clone();m.color.set(hex);if(base.name==='M_Robe'){m.bumpMap=fabric();m.bumpScale=.18;}shared.set(key,m);}
 return shared.get(key);
}
function blobShadow(){
 if(!shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'#0008');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(0,0,64,64);shadowTexture=new T.CanvasTexture(c);}
 const g=new T.PlaneGeometry(1.35,1.35),m=new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});const mesh=new T.Mesh(g,m);mesh.rotation.x=-Math.PI/2;mesh.position.y=.02;mesh.userData.skipAO=true;return mesh;
}
const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};

export function createActor(options={}){
 if(!ASSET)return Proc.createActor(options);
 const {color='#547da9',skin='#c6a183',hair='#342824',robe='#202c35',eyes='#4b3a28',hat=false,beard=false,style='short',scale=1}=options;
 const root=new T.Group(),model=cloneSkinned(ASSET.scene);root.add(model);root.scale.setScalar(scale);
 const colours={skin,hair,robe,eyes};
 let accent=null;
 model.traverse(o=>{
  if(o.name==='Hat')o.visible=!!hat;
  if(o.name==='Beard')o.visible=!!beard;
  if(o.name.startsWith('Hair_'))o.visible=o.name===(HAIR[style]||HAIR.short);
  if(!o.isMesh)return;
  o.receiveShadow=true;o.castShadow=true;
  const swap=m=>{
   if(m.name==='M_Lining'){if(!accent){accent=m.clone();accent.color.set(color);}return accent;}
   const k=TINT[m.name];return k?tinted(m,colours[k]):m;
  };
  o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);
 });
 const bone=n=>model.getObjectByName(n);
 const tipBone=bone('wand_tip')||model;
 const tipMaterial=new T.MeshBasicMaterial({color:'#fff2cc'}),tipGeometry=new T.SphereGeometry(1,12,8);
 const tip=new T.Mesh(tipGeometry,tipMaterial);tip.scale.setScalar(.018);tipBone.add(tip);
 root.add(blobShadow());

 const mixer=new T.AnimationMixer(model);
 const A={};
 for(const n of ['idle','walk','jog','run','dodge','talk','cast']){if(!CLIPS[n])continue;const a=mixer.clipAction(CLIPS[n]);a.play();a.setEffectiveWeight(0);A[n]=a;}
 for(const n of ['walk','jog','run','dodge','cast'])if(A[n])A[n].timeScale=0;     // driven by phase, not by the clock
 if(A.idle){A.idle.time=Math.random()*A.idle.getClip().duration;A.idle.timeScale=.9+Math.random()*.2;}
 if(A.talk)A.talk.time=Math.random()*A.talk.getClip().duration;

 let phase=Math.random(),castTime=0,dodgeTime=0,smoothedSpeed=0,talkWeight=0,disposed=false;
 const CAST=.65,DODGE=.42;
 return{root,rig:model,head:bone('head'),wand:bone('wand'),tip,arms:[bone('upper_armL'),bone('upper_armR')],legs:[bone('thighL'),bone('thighR')],
  cast(){castTime=CAST;},dodge(){dodgeTime=DODGE;},setColor(c){accent?.color.set(c);},
  update(dt,time,speed=0,talking=false){
   smoothedSpeed=T.MathUtils.lerp(smoothedSpeed,speed,1-Math.exp(-10*dt));castTime=Math.max(0,castTime-dt);dodgeTime=Math.max(0,dodgeTime-dt);
   const s=smoothedSpeed<.05?0:smoothedSpeed;
   // blend weights across idle → walk → jog → run
   const w={idle:0,walk:0,jog:0,run:0};let stride=GAITS[0].stride;
   if(s<=GAITS[0].speed){const k=smooth(s/GAITS[0].speed);w.idle=1-k;w.walk=k;}
   else{let done=false;for(let i=0;i<GAITS.length-1;i++){const a=GAITS[i],b=GAITS[i+1];if(s<=b.speed){const k=smooth((s-a.speed)/(b.speed-a.speed));w[a.name]=1-k;w[b.name]=k;stride=a.stride*(1-k)+b.stride*k;done=true;break;}}
    if(!done){w.run=1;stride=GAITS[2].stride;}}
   if(s<=GAITS[0].speed)stride=GAITS[0].stride;
   phase=(phase+dt*s/stride)%1;
   for(const g of GAITS)if(A[g.name])A[g.name].time=phase*A[g.name].getClip().duration;
   // dodge takes over the whole body for a moment
   let dw=0;if(dodgeTime>0&&A.dodge){const p=1-dodgeTime/DODGE;dw=Math.min(1,p/.12,(1-p)/.22);A.dodge.time=p*A.dodge.getClip().duration;}
   for(const n of ['idle','walk','jog','run'])A[n]?.setEffectiveWeight(w[n]*(1-dw));
   A.dodge?.setEffectiveWeight(dw);
   // additive layers: conversation gestures and the casting arm
   talkWeight=T.MathUtils.lerp(talkWeight,talking&&s<.5?1:0,1-Math.exp(-5*dt));
   A.talk?.setEffectiveWeight(talkWeight);
   if(A.cast){const p=castTime>0?1-castTime/CAST:0;A.cast.time=p*A.cast.getClip().duration;A.cast.setEffectiveWeight(castTime>0?1:0);}
   mixer.update(dt);
   tip.scale.setScalar(castTime>0?.035+Math.sin(castTime*18)*.01:.018);
  },
  dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);accent?.dispose();tipMaterial.dispose();tipGeometry.dispose();root.traverse(o=>{if(o.isMesh&&o.material?.map===shadowTexture){o.geometry.dispose();o.material.dispose();}});}
 };
}
