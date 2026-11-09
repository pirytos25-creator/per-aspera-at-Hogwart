import * as T from '../assets/three.module.js';
import {FLOORS} from './castle.js';

// The castle's everyday life: students walk the corridors, sit on benches with a book,
// stop to chat in pairs and wave when you pass. A ghost drifts straight through walls,
// a mischievous chalk spirit plays pranks, and the caretaker patrols with a frown.
// Everyone here is an original character of this game.
const NAMES=['Antek','Basia','Celina','Dawid','Ewa','Filip','Gosia','Henio','Iza','Kuba','Kasia','Lena','Marek','Natalia','Olek','Pola','Rafał','Sara','Tomek','Ula','Wiktor','Zosia','Jagna','Bruno'];
const HOUSE=[['Gryffindor','#a64a43'],['Ravenclaw','#547da9'],['Hufflepuff','#c9a34f'],['Slytherin','#508e78']];
const SKIN=['#f0c8a8','#d9b79a','#c69a7a','#a8785a','#8a5d43','#6e4a37','#e6bfa0'];
const HAIRC=['#1b1512','#3a2c26','#6b4630','#957044','#c9a46a','#2a1d17','#7a3b22','#141010'];
const STYLES=['short','long','bun','pony','curly'];
const CHATTER=[
 'Słyszałeś? Schody na drugim piętrze znowu się obróciły w trakcie lekcji.',
 'Jeśli szukasz biblioteki, to drugie piętro, na północ od schodów.',
 'Szelma znowu zgasił pochodnię przy sali zaklęć. Uważaj na kredę!',
 'Pani Leokadia przeszła dziś przez ścianę klasy. Profesor nawet nie mrugnął.',
 'Nie spóźnij się na eliksiry. Lochy są dalej, niż się wydaje.',
 'Zbroje na korytarzu odwracają głowy. Przysięgam, że jedna mrugnęła.',
 'Mówią, że za gobelinem na drugim piętrze jest skrót. Ja go jeszcze nie znalazłam.',
 'W Klubie Pojedynków na dziedzińcu Ada pokonała dziś trzech chętnych.',
 'Ktoś zostawił w korytarzu stronę z przewodnika. Świeciła jak latarenka.',
 'Klepsydry w Sali Wejściowej liczą punkty domów. Nasza dziś drgnęła w górę!',
];
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function rnd(a){return a[Math.floor(Math.random()*a.length)];}
// straight corridor lanes per floor (the castle corridors are straight halls)
const LANES={
 G:[[V(-9,0,17),V(9,0,17)],[V(-9,0,40),V(9,0,40)],[V(-6,0,18),V(-6,0,40)],[V(6,0,18),V(6,0,40)]],
 D:[[V(33,FLOORS.D,34),V(156,FLOORS.D,34)]],
 F1:[[V(18,FLOORS.F1,0),V(142,FLOORS.F1,0)]],
 F2:[[V(0,FLOORS.F2,-18),V(0,FLOORS.F2,-142)]],
 F3:[[V(-18,FLOORS.F3,0),V(-142,FLOORS.F3,0)]],
};
const POP={G:4,D:3,F1:5,F2:5,F3:4};

function pointOn(lane,lateral=0){
 const [a,b]=lane,t=Math.random(),p=a.clone().lerp(b,t);
 const dir=b.clone().sub(a).normalize(),side=V(dir.z,0,-dir.x);
 return p.addScaledVector(side,lateral);
}
function bandOfY(y){return y<-3.5?'D':y<4?'G':y<12?'F1':y<20?'F2':'F3';}

export function createCastleLife({castle,scene,createActor,labelSprite,bark,effects,audio}){
 const people=[];
 let spirit=null,ghost=null;
 // ---------------------------------------------------------------- students and the caretaker
 function student(band,i){
  const [house,color]=HOUSE[(i+band.length)%4];
  const style=rnd(STYLES),name=rnd(NAMES);
  const look={color,skin:rnd(SKIN),hair:rnd(HAIRC),style,eyes:rnd(['#3b2a1d','#4b3a28','#3f5a72','#56603a','#2e1f15']),face:{soft:['long','bun','pony'].includes(style)?.6+Math.random()*.4:Math.random()*.3,broad:Math.random()*.4,nose:Math.random()*.5},headScale:1.02+Math.random()*.06,scale:.9+Math.random()*.12};
  return {id:`life-${band}-${i}`,name:`${name} · ${house}`,role:'UCZEŃ HOGWARTU',look,band,lines:[rnd(CHATTER),rnd(CHATTER)]};
 }
 function make(def,pos){
  const actor=createActor(def.look);
  actor.root.position.copy(pos);actor.root.rotation.y=Math.random()*Math.PI*2;
  const label=labelSprite(def.name);label.position.y=2.65/(def.look.scale||1);actor.root.add(label);
  scene.add(actor.root);
  const e={id:def.id,type:'npc',name:def.name,role:def.role,lines:def.lines,pos:actor.root.position,actor,life:true,band:def.band,mood:def.mood||'kind',
   state:'idle',timer:1+Math.random()*4,goal:null,motion:{speed:0},seat:null,partner:null,waved:0,lane:def.lane||0};
  people.push(e);return e;
 }
 for(const [band,n] of Object.entries(POP))for(let i=0;i<n;i++){const d=student(band,i);d.lane=i%LANES[band].length;make(d,pointOn(LANES[band][d.lane],(Math.random()-.5)*2.4));}
 const caretaker=make({id:'caretaker',name:'Igor Mrok · woźny',role:'WOŹNY ZAMKU',band:'F1',mood:'stern',look:{color:'#5e5a4c',robe:'#2e2c26',hair:'#5b5650',beard:true,face:{old:.7,nose:.9,broad:.3},build:1.06,scale:1.02},
  lines:['Kto znowu nanosił błota na schody? Ja to wszystko potem szoruję.','Szelma? Jak go złapię, to wyczyści każdą zbroję w zamku. Własnoręcznie.','Po ciszy nocnej korytarze są zamknięte. Pamiętaj.']},V(60,FLOORS.F1,1));
 caretaker.patrol=true;
 // ---------------------------------------------------------------- the ghost who walks through walls
 {
  const g=make({id:'ghost-leokadia',name:'Pani Leokadia · duch',role:'DUCH ZAMKU',band:'F2',mood:'kind',look:{color:'#9fb6c8',robe:'#a9bfd0',skin:'#d8e6ee',hair:'#e2ecf2',style:'bun',hat:true,face:{old:.6,soft:.8}},
   lines:['Kiedyś uczyłam tu kaligrafii. Atrament był wtedy gęstszy, a korytarze krótsze.','Ściany? Och, kochanie, dla mnie to tylko uprzejme sugestie.','Jeśli zgubisz drogę, idź za zapachem pergaminu. Biblioteka zawsze przyciąga zagubionych.']},V(0,FLOORS.F2+.25,-40));
  g.ghost=true;ghost=g;
  // a ghost casts no shadow: hide the blob under its feet and make the body translucent
  g.actor.root.children.filter(c=>c.isMesh).forEach(c=>c.visible=false);
  const ghostMat=new T.MeshStandardMaterial({color:'#b8d8ee',emissive:'#5f90b8',emissiveIntensity:.7,transparent:true,opacity:.42,depthWrite:false,roughness:.4});
  g.actor.rig.traverse(o=>{if(o.isMesh&&o!==g.actor.tip){o.material=Array.isArray(o.material)?o.material.map(()=>ghostMat):ghostMat;o.castShadow=false;o.layers.set(0);}});
 }
 // ---------------------------------------------------------------- Szelma, the chalk spirit (original design)
 {
  const root=new T.Group();scene.add(root);
  const faceTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#f4efe2';x.beginPath();x.ellipse(64,64,56,62,0,0,Math.PI*2);x.fill();
   x.fillStyle='#1c1612';x.beginPath();x.ellipse(42,54,12,7,-.35,0,Math.PI*2);x.fill();x.beginPath();x.ellipse(86,54,12,7,.35,0,Math.PI*2);x.fill();
   x.strokeStyle='#1c1612';x.lineWidth=6;x.beginPath();x.arc(64,74,26,.15*Math.PI,.85*Math.PI);x.stroke();x.fillStyle='#d9534f88';x.beginPath();x.arc(36,80,7,0,7);x.arc(92,80,7,0,7);x.fill();
   const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;})();
  const mask=new T.Mesh(new T.SphereGeometry(.24,20,14,0,Math.PI*2,0,Math.PI),new T.MeshStandardMaterial({map:faceTex,emissive:'#ffffff',emissiveMap:faceTex,emissiveIntensity:.35,roughness:.6}));mask.scale.set(1,1.1,.55);root.add(mask);
  const gloves=[-1,1].map(s=>{const g=new T.Mesh(new T.SphereGeometry(.09,12,8),new T.MeshStandardMaterial({color:'#efeae0',roughness:.7}));g.scale.set(1,1.3,.7);root.add(g);return g;});
  const N=90,pos=new Float32Array(N*3),seeds=[];for(let i=0;i<N;i++)seeds.push([Math.random()*6.28,Math.random()*.5+.15,Math.random()*.6-.45,Math.random()*2+1]);
  const dg=new T.BufferGeometry();dg.setAttribute('position',new T.BufferAttribute(pos,3));
  const dot=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#fff');g.addColorStop(.45,'#ffffffaa');g.addColorStop(1,'#fff0');x.fillStyle=g;x.fillRect(0,0,32,32);return new T.CanvasTexture(c);})();
  const dust=new T.Points(dg,new T.PointsMaterial({color:'#efeae4',map:dot,size:.05,transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending}));dust.frustumCulled=false;root.add(dust);
  root.position.set(90,FLOORS.F1+2.4,0);
  // the glow borrows a light from the castle's fixed pool, so showing or hiding Szelma never recompiles shaders
  const glow={pos:root.position,color:'#dfe8ff',intensity:0,distance:6,band:'F1'};castle.anchors.push(glow);
  spirit={id:'spirit-szelma',type:'spirit',name:'Szelma · psotny duch kredy',pos:root.position,root,mask,gloves,dust,seeds,pos3:pos,dg,band:'F1',state:'wander',timer:3,goal:root.position.clone(),hidden:false,scared:0,prankT:6,glow};
 }
 // ---------------------------------------------------------------- behaviour
 function walkTo(e,p){e.goal=p.clone();e.state='walk';}
 function nearestSeat(e){
  let best=null,bd=18;
  for(const s of castle.seats){if(s.taken||s.band!==e.band)continue;const d=s.pos.distanceTo(e.pos);if(d<bd){bd=d;best=s;}}
  return best;
 }
 function freePartner(e){return people.find(o=>o!==e&&!o.ghost&&!o.patrol&&o.band===e.band&&o.state==='idle'&&!o.partner&&o.pos.distanceTo(e.pos)<20);}
 function decide(e){
  if(e.ghost){const lane=LANES[e.band][0];const p=pointOn(lane,(Math.random()-.5)*14);p.y=FLOORS.F2+.25;walkTo(e,p);return;}
  if(e.patrol){walkTo(e,pointOn(LANES[e.band][0],(Math.random()-.5)*2));return;}
  const r=Math.random();
  if(r<.28){const s=nearestSeat(e);if(s){s.taken=e;e.seat=s;const lane=LANES[e.band][0],c=lane[0].clone().lerp(lane[1],.5);
    // face the middle of the hall; stand up from a spot just in front of the bench
    const ax=lane[1].clone().sub(lane[0]).normalize(),rel=s.pos.clone().sub(lane[0]),along=rel.dot(ax),onLine=lane[0].clone().addScaledVector(ax,along);
    const face=onLine.sub(s.pos).setY(0).normalize();s.face=Math.atan2(face.x,face.z);walkTo(e,s.pos.clone().addScaledVector(face,.75));e.after='sit';return;}}
  if(r<.5){const o=freePartner(e);if(o){const mid=e.pos.clone().lerp(o.pos,.5);const dir=o.pos.clone().sub(e.pos).setY(0).normalize();
   e.partner=o;o.partner=e;walkTo(e,mid.clone().addScaledVector(dir,-.7));walkTo(o,mid.clone().addScaledVector(dir,.7));e.after=o.after='chat';return;}}
  if(r<.62){e.state='read';e.timer=8+Math.random()*10;e.actor.read(true);return;}
  walkTo(e,pointOn(LANES[e.band][e.lane%LANES[e.band].length],(Math.random()-.5)*2.6));e.after=null;
 }
 function stopActivity(e){
  if(e.seat){e.actor.sit(false);const f=e.seat.face||0;e.pos.set(e.seat.pos.x+Math.sin(f)*.75,e.seat.pos.y,e.seat.pos.z+Math.cos(f)*.75);e.seat.taken=null;e.seat=null;}
  if(e.state==='read')e.actor.read(false);
  if(e.partner){const o=e.partner;e.partner=null;if(o.partner===e){o.partner=null;o.state='idle';o.timer=.5+Math.random();}}
 }
 const tmp=V();
 return {
  people,spirit,ghost,
  entities(){return [...people,spirit];},
  setActive(band){
   for(const e of people){const on=e.band===band||(band==='T'&&false);e.active=on;e.actor.root.visible=on;}
   const sOn=spirit.band===band&&!spirit.hidden;spirit.root.visible=sOn;spirit.active=sOn;
  },
  // a spell landed on the spirit: it shrieks and vanishes for a while
  scare(){if(!spirit||spirit.hidden)return;spirit.hidden=true;spirit.root.visible=false;spirit.scared=22;effects.sparks(spirit.pos.clone(),'#f4efe2',90,4);audio.note(1400,.4,'square',.03);bark(null,'Szelma','Ała-ała! Dobrze już, dobrze, uciekam!');},
  update(dt,time,playerPos,player,band,{hurtLight,douse}={}){
   for(const e of people){
    if(!e.active){e.motion.speed=0;continue;}
    e.timer-=dt;
    const toPlayer=tmp.copy(playerPos).sub(e.pos);toPlayer.y=0;const pd=toPlayer.length();
    // a friendly wave when you pass close by
    if(!e.ghost&&!e.patrol&&pd<4.5&&time-e.waved>40&&e.state!=='sit'&&Math.random()<dt*.6){e.waved=time;e.actor.gesture('wave');}
    if(e.state==='walk'&&e.goal){
     const d=V(e.goal.x-e.pos.x,0,e.goal.z-e.pos.z),len=d.length();
     const speed=e.ghost?.75:e.patrol?1.05:1.15+((e.id.length%3)*.08);
     if(len<.25){e.motion.speed=0;e.state='idle';e.timer=1+Math.random()*3;
      if(e.after==='sit'&&e.seat){const f=e.seat.face;e.actor.root.rotation.y=f;e.pos.set(e.seat.pos.x+Math.sin(f)*.1,e.seat.pos.y,e.seat.pos.z+Math.cos(f)*.1);e.actor.sit(true,Math.random()<.5);e.state='sit';e.timer=12+Math.random()*20;}
      else if(e.after==='chat'&&e.partner){e.state='chat';e.timer=9+Math.random()*9;const o=e.partner;e.actor.root.rotation.y=Math.atan2(o.pos.x-e.pos.x,o.pos.z-e.pos.z);e.actor.lookAt(o.actor.head);}
      e.after=e.after==='chat'||e.after==='sit'?null:e.after;
     }else{
      d.normalize();
      if(e.ghost){e.pos.x+=d.x*speed*dt;e.pos.z+=d.z*speed*dt;e.pos.y=FLOORS.F2+.25+Math.sin(time*1.3)*.06;}
      else{const p=castle.move(e.pos,d.x*speed*dt,d.z*speed*dt,.3);if(Math.hypot(p.x-e.pos.x,p.z-e.pos.z)<speed*dt*.25){e.stuck=(e.stuck||0)+dt;if(e.stuck>1.5){e.stuck=0;e.state='idle';e.timer=.5;}}else e.stuck=0;e.pos.set(p.x,p.y,p.z);}
      const yaw=Math.atan2(d.x,d.z),diff=Math.atan2(Math.sin(yaw-e.actor.root.rotation.y),Math.cos(yaw-e.actor.root.rotation.y));
      e.actor.root.rotation.y+=diff*(1-Math.exp(-6*dt));
      e.motion.speed=e.ghost?0:speed;
     }
    }else if(e.state==='chat'){
     e.motion.speed=0;
     if(e.partner&&Math.random()<dt*.5)e.actor.gesture(rnd(['nod','laugh','shrug','point','nod']));
     e.talking=Math.sin(time*.9+e.id.length)>0;
     if(e.timer<=0){stopActivity(e);e.state='idle';e.timer=1+Math.random()*2;e.actor.lookAt(null);}
    }else if(e.state==='sit'||e.state==='read'){
     e.motion.speed=0;
     if(e.timer<=0){stopActivity(e);e.state='idle';e.timer=.6+Math.random()*2;}
    }else{
     e.motion.speed=0;e.talking=false;
     if(e.timer<=0)decide(e);
    }
   }
   // ---------------------------------------------------------------- Szelma
   const s=spirit;if(!s)return;
   s.glow.intensity=0;
   if(s.hidden){s.scared-=dt;if(s.scared<=0){s.hidden=false;s.root.visible=s.band===band;s.pos.set(40+Math.random()*90,FLOORS.F1+2.4,(Math.random()-.5)*2);}return;}
   if(!s.active)return;
   s.timer-=dt;s.prankT-=dt;
   const pd=Math.hypot(playerPos.x-s.pos.x,playerPos.z-s.pos.z);
   if(s.state==='wander'){if(s.timer<=0||s.pos.distanceTo(s.goal)<.5){s.goal.set(20+Math.random()*120,FLOORS.F1+2+Math.random()*1.5,(Math.random()-.5)*4);s.timer=4+Math.random()*4;}
    if(pd<11&&Math.abs(playerPos.y-FLOORS.F1)<2&&s.prankT<=0){s.state='tease';s.timer=7;bark(null,'Szelma',rnd(['Hi-hi! Zgubiłeś się, adepcie?','Kreda dla pilnego ucznia!','Uuuu, nowa twarz na korytarzu!']));audio.note(990,.25,'triangle',.02);}}
   else if(s.state==='tease'){
    // tease from in front of the player, where the camera can see it (never between the lens and you)
    const f=player.root.rotation.y,sway=Math.sin(time*.9)*1.6;
    s.goal.set(playerPos.x+Math.sin(f)*3.4+Math.cos(f)*sway,FLOORS.F1+2.1+Math.sin(time*2)*.3,playerPos.z+Math.cos(f)*3.4-Math.sin(f)*sway);
    if(s.prankT<=0){s.prankT=7+Math.random()*6;
     if(Math.random()<.6){const from=s.pos.clone(),to=playerPos.clone().add(V(0,1.1,0));effects.projectile(from,to.clone().addScaledVector(to.clone().sub(from).normalize(),4),{color:'#f4efe2',hostile:true,damage:0,speed:11});}
     else douse?.(s.pos);
    }
    if(s.timer<=0||pd>16){s.state='wander';s.timer=3;s.prankT=12;}
   }
   s.pos.lerp(s.goal,1-Math.exp(-(s.state==='tease'?2.2:.9)*dt));
   s.mask.rotation.y=Math.atan2(playerPos.x-s.pos.x,playerPos.z-s.pos.z);s.mask.rotation.z=Math.sin(time*3)*.18;
   s.gloves.forEach((g,i)=>{const a=time*2.3+i*Math.PI;g.position.set(Math.cos(a)*.42,Math.sin(time*3+i)*.12-.12,Math.sin(a)*.3);});
   for(let i=0;i<s.seeds.length;i++){const [a,r,y,sp]=s.seeds[i];const ang=a+time*sp;s.pos3.set([Math.cos(ang)*r,y+Math.sin(time*2+a)*.08,Math.sin(ang)*r],i*3);}
   s.dg.attributes.position.needsUpdate=true;s.glow.intensity=4+Math.sin(time*7)*.8;
  },
  dispose(){for(const e of people){e.actor.dispose();scene.remove(e.actor.root);}if(spirit){scene.remove(spirit.root);const i=castle.anchors.indexOf(spirit.glow);if(i>=0)castle.anchors.splice(i,1);}}
 };
}
