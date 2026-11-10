import * as T from '../assets/three.module.js';
import {FLOORS} from './castle.js';
import {createNav,bandOfPos,sidesAdjacent} from './nav.js';
import {periodAt,planFor,dutyPost,PATROL} from './schedule.js';
import {ROOMS} from './data.js';
import {castleState} from './castle-state.js';
import {HALL_SEATS,HALL_BENCH_LIFT} from './great-hall.js';

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

export function createCastleLife({castle,scene,createActor,labelSprite,bark,effects,audio}){
 const people=[];
 let spirit=null,ghost=null;
 // ---------------------------------------------------------------- students and the caretaker
 function student(band,i){
  const [house,color]=HOUSE[(i+band.length)%4];
  const style=rnd(STYLES),name=rnd(NAMES);
  const look={color,skin:rnd(SKIN),hair:rnd(HAIRC),style,eyes:rnd(['#3b2a1d','#4b3a28','#3f5a72','#56603a','#2e1f15']),face:{soft:['long','bun','pony'].includes(style)?.6+Math.random()*.4:Math.random()*.3,broad:Math.random()*.4,nose:Math.random()*.5},headScale:1.02+Math.random()*.06,scale:.9+Math.random()*.12};
  return {id:`life-${band}-${i}`,name:`${name} · ${house}`,role:'UCZEŃ HOGWARTU',look,band,house,lines:[rnd(CHATTER),rnd(CHATTER)]};
 }
 function make(def,pos){
  const actor=createActor(def.look);
  actor.root.position.copy(pos);actor.root.rotation.y=Math.random()*Math.PI*2;
  const label=labelSprite(def.name);label.position.y=2.65/(def.look.scale||1);actor.root.add(label);
  scene.add(actor.root);
  const e={id:def.id,type:'npc',name:def.name,role:def.role,lines:def.lines,pos:actor.root.position,actor,life:true,band:def.band,mood:def.mood||'kind',
   state:'idle',timer:1+Math.random()*4,goal:null,motion:{speed:0},seat:null,partner:null,waved:-100,lane:def.lane||0,
   home:def.band,house:def.house||null,idx:people.length,baseLine:def.lines[0],pace:1.22+(people.length%5)*.07,lat:.3+(people.length%4)*.14,inside:null,path:null};
  people.push(e);return e;
 }
 for(const [band,n] of Object.entries(POP))for(let i=0;i<n;i++){const d=student(band,i);d.lane=i%LANES[band].length;make(d,pointOn(LANES[band][d.lane],(Math.random()-.5)*2.4));}
 const caretaker=make({id:'caretaker',name:'Igor Mrok · woźny',role:'WOŹNY ZAMKU',band:'F1',mood:'stern',look:{color:'#5e5a4c',robe:'#2e2c26',hair:'#5b5650',beard:true,face:{old:.7,nose:.9,broad:.3},build:1.06,scale:1.02},
  lines:['Kto znowu nanosił błota na schody? Ja to wszystko potem szoruję.','Szelma? Jak go złapię, to wyczyści każdą zbroję w zamku. Własnoręcznie.','Po ciszy nocnej korytarze są zamknięte. Pamiętaj.']},V(60,FLOORS.F1,1));
 caretaker.patrol=true;caretaker.pace=1.05;
 // the duty teacher keeps an eye on whichever floor the timetable sends her to (an original character)
 const duty=make({id:'duty-jaworowa',name:'Prof. Kalina Jaworowa · dyżur',role:'NAUCZYCIELKA DYŻURNA',band:'G',mood:'stern',look:{color:'#6d5a86',robe:'#2b2536',hair:'#3a2c26',style:'bun',hat:true,skin:'#e6bfa0',eyes:'#3f5a72',face:{soft:.5,old:.35},scale:1.04},
  lines:['Dyżur to sztuka bycia wszędzie naraz. Schody mi w tym nie pomagają.','Dzwon nie jest sugestią. Jeśli masz lekcję, to już na nią idziesz.','Ruchome schody czekają tylko na cierpliwych. Stań na podeście i licz do dziesięciu.']},V(3,FLOORS.G,24));
 duty.duty=true;duty.pace=1.15;
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
 // ---------------------------------------------------------------- navigation and the school day
 const nav=createNav({doors:castle.slots.map(s=>({id:s.id,corridor:s.corridor,x:s.door.x,y:s.y,z:s.door.z}))});
 const roomName=id=>ROOMS.find(r=>r.id===id)?.name||id;
 const FLOOR_NAME={D:'lochy',G:'parter',F1:'pierwsze piętro',F2:'drugie piętro',F3:'trzecie piętro'};
 let clockOffset=0,current=null,lastPlayer=V(0,-99,0);
 const platTo=()=>castle.platforms.map(p=>p.to);
 const _pt={};
 function corridorNode(band){
  if(band==='G')return rnd(['hallS','hallC','hallN']);
  const list=[...nav.nodes.values()].filter(n=>n.corridor===band&&n.along!==undefined);
  return list.length?rnd(list).id:'hallC';
 }
 // students who went in for a meal sit at their house table whenever the Great Hall is on screen
 const hallSlot=castle.slots.find(s=>s.id==='great-hall'),hallTaken=new Array(HALL_SEATS.length).fill(null);
 const HOUSE_ROW={Gryffindor:0,Hufflepuff:1,Ravenclaw:2,Slytherin:3};
 function seatInHall(e){
  const L=hallSlot?.loaded;if(!L)return;
  const row=HOUSE_ROW[e.house]??(e.idx%4),free=[];
  HALL_SEATS.forEach((s,i)=>{if(s.row===row&&!hallTaken[i])free.push(i);});
  if(!free.length)return;
  // sit near the others, facing a neighbour across the table when there is one
  const i=free[(e.idx*7)%Math.min(free.length,8)],s=HALL_SEATS[i];hallTaken[i]=e;e.hallSeat=i;
  const [x,z]=L.toWorld(s.x,s.z),[fx,fz]=L.toWorld(s.x+s.face,s.z);
  e.pos.set(x,hallSlot.y+HALL_BENCH_LIFT,z);e.actor.root.rotation.y=Math.atan2(fx-x,fz-z);e.actor.sit(true,false);e.talking=false;
 }
 function leaveHall(e){
  if(e.hallSeat==null)return;hallTaken[e.hallSeat]=null;e.hallSeat=null;e.actor.sit(false);e.talking=false;
  const n=nav.nodes.get('door:great-hall');if(n)e.pos.set(n.x,n.y,n.z);
 }
 // set off for a node anywhere in the castle; arrive(e) runs at the destination
 function travel(e,dest,arrive){
  stopActivity(e);release(e);e.actor.lookAt?.(null);leaveHall(e);e.inside=null;
  // already under way: finish the stretch you are on (or turn back on it), then follow the new route
  if(e.state==='travel'&&e.path&&e.pi>=0&&e.path[e.pi]){
   const seg=e.path[e.pi],fwd=nav.route(seg.to,dest,{platTo:platTo()});
   const back=seg.kind==='walk'?nav.adj.get(seg.to).find(x=>x.to===seg.from&&x.kind==='walk'):null;
   const rev=back&&nav.route(seg.from,dest,{platTo:platTo()});
   if(fwd&&(!rev||(seg.len-e.s)+nav.length(fwd)<=e.s+nav.length(rev))){e.path=[seg,...fwd];e.pi=0;e.dest=dest;e.arrive=arrive||null;return true;}
   if(rev){e.path=[back,...rev];e.pi=0;e.s=Math.max(0,seg.len-e.s);e.dest=dest;e.arrive=arrive||null;return true;}
  }
  const start=nav.nearest(e.pos)||'hallC';
  const path=nav.route(start,dest,{platTo:platTo()});
  if(!path){e.state='idle';e.timer=2;e.path=null;return false;}
  // skip walking back to the first stop when the second one lies straight ahead in the same corridor
  let first=nav.nodes.get(start);
  if(path.length&&path[0].corridor){const b=nav.nodes.get(path[0].to);if(Math.hypot(b.x-e.pos.x,b.z-e.pos.z)<path[0].len+.5){first=b;path.shift();}}
  e.path=path;e.pi=-1;e.s=0;e.dest=dest;e.arrive=arrive||null;e.state='travel';e.wait=0;e.hold=false;
  e.lead={x:e.pos.x,y:e.pos.y,z:e.pos.z,to:first,len:Math.max(.01,Math.hypot(first.x-e.pos.x,first.y-e.pos.y,first.z-e.pos.z))};
  return true;
 }
 function enter(e){const n=nav.nodes.get(e.dest);e.state='inside';e.inside=n?.room||true;e.home=n?.corridor||n?.band||e.home;e.motion.speed=0;e.path=null;}
 function stepTravel(e,dt,time,pd,toPlayer){
  const seg=e.pi<0?null:e.path[e.pi],len=seg?seg.len:e.lead.len;
  const stairs=seg?.stairs,v=(e.ghost?.8:e.pace)*(stairs?.82:1);
  let hold=false;
  if(e.s>=len){
   const next=e.path[e.pi+1];
   if(seg&&seg.kind==='plat'&&!seg.rev){
    // top of a turning flight: step off where it has actually docked
    const p=castle.platforms[seg.plat];
    if(p.moving)hold=true;
    else{const side=nav.sideOfAngle(p.piv.rotation.y);
     if(!next||next.kind!=='land'||next.side!==side){
      const land=nav.adj.get(`ptop${seg.plat}`).find(x=>x.kind==='land'&&x.side===side);
      const rest=land&&nav.route(land.to,e.dest,{platTo:platTo()});
      if(land&&rest){e.path=[land,...rest];e.pi=0;e.s=0;return;}
      hold=true;
     }
    }
   }
   if(!hold&&next){
    // going up you may step on at any time and ride while the stairs turn; going down you board where they are docked
    if(next.kind==='land'&&next.rev){
     const p=castle.platforms[next.plat],to=nav.sideOfAngle(p.to);
     if(to!==next.side){
      // the stairs point elsewhere: chase them to the next side, or wait here until they come back
      if(sidesAdjacent(to,next.side)||!p.dirs.some(a=>nav.sideOfAngle(a)===next.side)){travel(e,e.dest,e.arrive);return;}
      hold=true;
     }else if(p.moving)hold=true;
    }
   }
   if(!hold){
    if(!next){e.state='idle';e.timer=1+Math.random()*3;e.motion.speed=0;e.path=null;const fn=e.arrive;e.arrive=null;fn?.(e);return;}
    e.pi++;e.s=0;return;
   }
  }
  // people wait for you instead of walking through you (but never for long)
  let dx,dz,tx,ty,tz;
  if(seg){const p=castle.platforms[seg.plat??0];nav.point(seg,e.s,p.piv.rotation.y,_pt);dx=_pt.dx;dz=_pt.dz;tx=_pt.x;ty=_pt.y;tz=_pt.z;}
  else{const L=e.lead,t=Math.min(1,e.s/L.len);tx=L.x+(L.to.x-L.x)*t;ty=L.y+(L.to.y-L.y)*t;tz=L.z+(L.to.z-L.z)*t;const l=Math.hypot(L.to.x-L.x,L.to.z-L.z)||1;dx=(L.to.x-L.x)/l;dz=(L.to.z-L.z)/l;}
  const lat=seg?Math.min(seg.w,e.lat):0;tx+=-dz*lat;tz+=dx*lat;
  // on a turning flight you turn with it
  if(seg&&seg.kind==='plat'){const a=castle.platforms[seg.plat].piv.rotation.y;
   if(e.pa!==undefined&&e.pa!==a){const d=a-e.pa,c=Math.cos(d),sn=Math.sin(d),x=e.pos.x,z=e.pos.z;e.pos.x=x*c+z*sn;e.pos.z=-x*sn+z*c;e.actor.root.rotation.y+=d;}
   e.pa=a;}else e.pa=undefined;
  if(!hold&&!e.ghost&&pd<1.05&&time>(e.ignore||0)&&(toPlayer.x*dx+toPlayer.z*dz)>pd*.35){hold=true;e.wait+=dt;if(e.wait>2.5){e.wait=0;e.ignore=time+4;}}else if(!hold)e.wait=0;
  if(!hold)e.s=Math.min(len,e.s+v*dt);
  // while the stairs turn, stay on the steps: their far end swings over the open well
  if(seg&&seg.kind==='plat'&&castle.platforms[seg.plat].moving)e.s=seg.rev?Math.max(e.s,1.3):Math.min(e.s,10.3);
  const k=1-Math.exp(-9*dt),before=tmp2.copy(e.pos);
  e.pos.x+=(tx-e.pos.x)*k;e.pos.y+=(ty-e.pos.y)*Math.min(1,k*1.6);e.pos.z+=(tz-e.pos.z)*k;
  const moved=Math.hypot(e.pos.x-before.x,e.pos.z-before.z)/Math.max(dt,1e-4);
  const yaw=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(yaw-e.actor.root.rotation.y),Math.cos(yaw-e.actor.root.rotation.y));
  e.actor.root.rotation.y+=diff*(1-Math.exp(-7*dt));
  e.motion.speed=hold&&moved<.25?0:Math.min(v,Math.max(moved,hold?0:v*.6));
  e.hold=hold;
 }
 // what this person should be doing in the current period
 function applyPlan(e,first){
  if(e.ghost||e.patrol)return;
  const per=current.period;
  const plan=e.duty?dutyPost(per,current.day):planFor(e.idx,e.house,per,current.day);
  if(plan.kind==='room'){
   const dest=`door:${plan.room}`,n=nav.nodes.get(dest);
   if(n){
    const fl=FLOOR_NAME[n.band]||'';
    e.lines[0]=per.meal?'Idę do Wielkiej Sali. Kto przychodzi ostatni, ten siedzi najbliżej drzwi i przeciągu.':per.lesson!==undefined?`Spieszę się na lekcję. ${roomName(plan.room)}, ${fl}.`:per.night?'Wracam do pokoju wspólnego. Po ciszy nocnej woźny nie zna się na żartach.':`Idę do pokoju wspólnego, ${fl}. Mam dość korytarzy na dziś.`;
    if(e.inside===plan.room)return;
    if(first&&Math.random()<.5){stopActivity(e);release(e);e.pos.set(n.x,n.y,n.z);e.dest=dest;enter(e);return;}
    travel(e,dest,enter);return;
   }
  }
  e.lines[0]=e.baseLine;
  const band=plan.band||(e.inside?e.home:null);
  if(!band){if(e.inside){e.inside=null;e.state='idle';e.timer=.5;}return;}
  if(band===e.home&&!e.inside&&e.state!=='travel')return;
  const dest=corridorNode(band),n=nav.nodes.get(dest);
  if(first&&Math.random()<.5){stopActivity(e);release(e);e.inside=null;e.pos.set(n.x,n.y,n.z);e.home=band;e.state='idle';e.timer=Math.random()*3;return;}
  travel(e,dest,x=>{x.home=band;});
 }
 // ---------------------------------------------------------------- behaviour
 function walkTo(e,p){e.goal=p.clone();e.state='walk';}
 function nearestSeat(e){
  let best=null,bd=18;
  for(const s of castle.seats){if(s.taken||s.band!==e.home)continue;const d=s.pos.distanceTo(e.pos);if(d<bd){bd=d;best=s;}}
  return best;
 }
 function freePartner(e){return people.find(o=>o!==e&&!o.ghost&&!o.patrol&&!o.duty&&!o.inside&&o.home===e.home&&o.state==='idle'&&!o.partner&&o.pos.distanceTo(e.pos)<20);}
 function release(e){
  if(e.seat&&e.state!=='sit'){e.seat.taken=null;e.seat=null;}
  if(e.partner&&e.state!=='chat'){const o=e.partner;e.partner=null;if(o.partner===e){o.partner=null;if(o.after==='chat')o.after=null;}}
  e.after=null;
 }
 function decide(e){
  release(e);
  if(e.ghost){
   // the ghost drifts anywhere in the castle, straight through walls and floors
   const list=[...nav.nodes.values()].filter(n=>!n.dynamic&&n.band!=='D');const n=rnd(list);
   e.goal=V(n.x+(Math.random()-.5)*4,n.y+.25,n.z+(Math.random()-.5)*4);e.state='walk';return;}
  if(e.patrol){
   // the caretaker's round: one floor after another, to the far end and back
   e.round=(e.round||0)+1;const band=PATROL[e.round%PATROL.length];
   const list=[...nav.nodes.values()].filter(n=>n.corridor===band&&n.along!==undefined).sort((a,b)=>b.along-a.along);
   const dest=band==='G'?rnd(['hallS','hallN']):list[e.round%2?0:Math.floor(list.length/2)].id;
   if(travel(e,dest,x=>{x.home=band;x.timer=5+Math.random()*6;}))return;
  }
  if(!LANES[e.home])e.home='G';
  if(e.duty){walkTo(e,pointOn(LANES[e.home][0],(Math.random()-.5)*2));return;}
  const r=Math.random();
  if(r<.28){const s=nearestSeat(e);if(s){s.taken=e;e.seat=s;const lane=LANES[e.home][0],c=lane[0].clone().lerp(lane[1],.5);
    // face the middle of the hall; stand up from a spot just in front of the bench
    const ax=lane[1].clone().sub(lane[0]).normalize(),rel=s.pos.clone().sub(lane[0]),along=rel.dot(ax),onLine=lane[0].clone().addScaledVector(ax,along);
    const face=onLine.sub(s.pos).setY(0).normalize();s.face=Math.atan2(face.x,face.z);walkTo(e,s.pos.clone().addScaledVector(face,.75));e.after='sit';return;}}
  if(r<.5){const o=freePartner(e);if(o){const mid=e.pos.clone().lerp(o.pos,.5);const dir=o.pos.clone().sub(e.pos).setY(0).normalize();
   e.partner=o;o.partner=e;walkTo(e,mid.clone().addScaledVector(dir,-.7));walkTo(o,mid.clone().addScaledVector(dir,.7));e.after=o.after='chat';return;}}
  if(r<.62){e.state='read';e.timer=8+Math.random()*10;e.actor.read(true);return;}
  // stroll: stay near where you are rather than crossing the whole corridor
  const lane=LANES[e.home][e.lane%LANES[e.home].length],p=pointOn(lane,(Math.random()-.5)*2.6);
  if(p.distanceTo(e.pos)>26){const d=p.clone().sub(e.pos).setY(0).normalize();p.copy(e.pos).addScaledVector(d,10+Math.random()*14);p.y=e.pos.y;}
  walkTo(e,p);e.after=null;
 }
 function stopActivity(e){
  if(e.seat){e.actor.sit(false);const f=e.seat.face||0;e.pos.set(e.seat.pos.x+Math.sin(f)*.75,e.seat.pos.y,e.seat.pos.z+Math.cos(f)*.75);e.seat.taken=null;e.seat=null;}
  if(e.state==='read')e.actor.read(false);
  if(e.partner){const o=e.partner;e.partner=null;if(o.partner===e){o.partner=null;if(o.state==='chat'){o.state='idle';o.timer=.5+Math.random();o.actor.lookAt?.(null);}}}
 }
 const tmp=V(),tmp2=V();
 return {
  people,spirit,ghost,nav,
  entities(){return [...people,spirit];},
  period(){return current;},
  // jump the school clock (tests and debugging)
  setClock(t,time=0){clockOffset=t-time;},
  travel,
  setActive(band,playerPos){
   if(playerPos)lastPlayer.copy(playerPos);
   for(const e of people){
    const b=bandOfPos(e.pos.x,e.pos.y,e.pos.z);e.band=b;
    const on=(!e.inside||e.hallSeat!=null)&&(b===band||((b==='T'||band==='T')&&Math.abs(e.pos.y-lastPlayer.y)<13&&Math.hypot(e.pos.x-lastPlayer.x,e.pos.z-lastPlayer.z)<50)||(b==='G'&&band==='D'&&lastPlayer.x<34)||(b==='D'&&band==='G'&&e.pos.x<34));
    e.active=on;e.actor.root.visible=on;
   }
   const sOn=spirit.band===band&&!spirit.hidden;spirit.root.visible=sOn;spirit.active=sOn;
  },
  // a spell landed on the spirit: it shrieks and vanishes for a while
  scare(){if(!spirit||spirit.hidden)return;spirit.hidden=true;spirit.root.visible=false;spirit.scared=22;effects.sparks(spirit.pos.clone(),'#f4efe2',90,4);audio.note(1400,.4,'square',.03);bark(null,'Szelma','Ała-ała! Dobrze już, dobrze, uciekam!');},
  update(dt,time,playerPos,player,band,{hurtLight,douse,night=false}={}){
   lastPlayer.copy(playerPos);
   // the bell: a new period sends everyone on their way, a few seconds apart
   const now=periodAt(time+clockOffset,night);
   castleState.meal=!!now.period.meal;castleState.period=now.period.id;
   if(!current||now.index!==current.index||now.day!==current.day){
    const first=!current;current=now;
    for(const e of people){if(first)applyPlan(e,true);else e.pending=time+Math.random()*14;}
    if(!first){bark(null,'Dzwon zamkowy',now.period.label+'.');audio.note(523,.9,'sine',.035);setTimeout(()=>audio.note(392,1.2,'sine',.03),420);}
   }
   for(const e of people){
    if(e.pending&&time>=e.pending){e.pending=0;applyPlan(e,false);}
    if(e.state==='inside'){
     e.motion.speed=0;
     if(e.inside==='great-hall'){
      if(e.hallSeat==null&&hallSlot?.loaded&&now.period.meal)seatInHall(e);
      else if(e.hallSeat!=null&&!hallSlot?.loaded)leaveHall(e);
      if(e.hallSeat!=null){e.talking=Math.sin(time*.8+e.idx*1.7)>.35;if(Math.random()<dt*.12)e.actor.gesture(rnd(['nod','laugh','nod','shrug']));}
     }
     continue;
    }
    e.timer-=dt;
    const toPlayer=tmp.copy(playerPos).sub(e.pos);toPlayer.y=0;const pd=Math.abs(playerPos.y-e.pos.y)<2.2?toPlayer.length():99;
    // a friendly wave when you pass close by
    if(e.active&&!e.ghost&&!e.patrol&&pd<4.5&&time-e.waved>40&&e.state!=='sit'&&Math.random()<dt*.6){e.waved=time;e.actor.gesture('wave');}
    if(e.state==='travel'){stepTravel(e,dt,time,pd,toPlayer);continue;}
    if(e.state==='walk'&&e.goal){
     const d=V(e.goal.x-e.pos.x,0,e.goal.z-e.pos.z),len=d.length();
     const speed=e.ghost?.75:e.patrol?1.05:1.15+((e.id.length%3)*.08);
     if(e.ghost){
      const dy=e.goal.y-e.pos.y;
      if(len<.4&&Math.abs(dy)<.4){e.motion.speed=0;e.state='idle';e.timer=3+Math.random()*6;continue;}
      d.normalize();const flat=Math.min(1,len/2);
      e.pos.x+=d.x*speed*dt*flat;e.pos.z+=d.z*speed*dt*flat;e.pos.y+=Math.sign(dy)*Math.min(Math.abs(dy),.55*dt)+Math.sin(time*1.3)*.0015;
      const yaw=Math.atan2(d.x,d.z),diff=Math.atan2(Math.sin(yaw-e.actor.root.rotation.y),Math.cos(yaw-e.actor.root.rotation.y));
      e.actor.root.rotation.y+=diff*(1-Math.exp(-3*dt));e.motion.speed=0;continue;
     }
     if(len<.25){e.motion.speed=0;e.state='idle';e.timer=1+Math.random()*3;
      if(e.after==='sit'&&e.seat){const f=e.seat.face;e.actor.root.rotation.y=f;e.pos.set(e.seat.pos.x+Math.sin(f)*.1,e.seat.pos.y,e.seat.pos.z+Math.cos(f)*.1);e.actor.sit(true,Math.random()<.5);e.state='sit';e.timer=12+Math.random()*20;}
      else if(e.after==='chat'&&e.partner&&e.partner.partner===e&&e.partner.pos.distanceTo(e.pos)<3.2){e.state='chat';e.timer=9+Math.random()*9;const o=e.partner;e.actor.root.rotation.y=Math.atan2(o.pos.x-e.pos.x,o.pos.z-e.pos.z);e.actor.lookAt(o.actor.head);}
      e.after=e.after==='chat'||e.after==='sit'?null:e.after;
     }else{
      d.normalize();
      // people step aside for you instead of walking through you
      const ahead=pd<1.05&&(toPlayer.x*d.x+toPlayer.z*d.z)>pd*.35;
      if(ahead){e.motion.speed=0;e.wait=(e.wait||0)+dt;if(e.wait>2.5){e.wait=0;release(e);e.state='idle';e.timer=.4;}
       const yawP=Math.atan2(d.x,d.z),df=Math.atan2(Math.sin(yawP-e.actor.root.rotation.y),Math.cos(yawP-e.actor.root.rotation.y));e.actor.root.rotation.y+=df*(1-Math.exp(-6*dt));continue;}
      e.wait=0;
      const p=castle.move(e.pos,d.x*speed*dt,d.z*speed*dt,.3);if(Math.hypot(p.x-e.pos.x,p.z-e.pos.z)<speed*dt*.25){e.stuck=(e.stuck||0)+dt;if(e.stuck>1.5){e.stuck=0;release(e);e.state='idle';e.timer=.5;}}else e.stuck=0;e.pos.set(p.x,p.y,p.z);
      const yaw=Math.atan2(d.x,d.z),diff=Math.atan2(Math.sin(yaw-e.actor.root.rotation.y),Math.cos(yaw-e.actor.root.rotation.y));
      e.actor.root.rotation.y+=diff*(1-Math.exp(-6*dt));
      e.motion.speed=speed;
     }
    }else if(e.state==='chat'){
     e.motion.speed=0;
     if(e.partner&&Math.random()<dt*.5)e.actor.gesture(rnd(['nod','laugh','shrug','point','nod']));
     e.talking=Math.sin(time*.9+e.id.length)>0;
     if(e.timer<=0||!e.partner){stopActivity(e);e.state='idle';e.timer=1+Math.random()*2;e.actor.lookAt(null);}
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
