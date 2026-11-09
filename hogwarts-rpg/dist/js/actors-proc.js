import * as T from '../assets/three.module.js';
import {mergeGeometries} from '../assets/addons/utils/BufferGeometryUtils.js';

// Small articulated rigs; static details are merged per material and joint.
// This keeps facial, garment and equipment detail without hundreds of draws.
const sphere=new T.SphereGeometry(1,20,14),cylinder=new T.CylinderGeometry(1,1,1,16),box=new T.BoxGeometry(1,1,1);
const cone=new T.ConeGeometry(1,1,20),octahedron=new T.OctahedronGeometry(1),torus=new T.TorusGeometry(1,.05,6,32);
const sharedMaterials=new Map();
let clothTexture,shadowTexture;
function fabric(){
 if(clothTexture)return clothTexture;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 ctx.fillStyle='#888';ctx.fillRect(0,0,128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=((x*13+y*29)%17)-8,v=126+n+((x+y)%4<2?20:-20);ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);}
 clothTexture=new T.CanvasTexture(c);clothTexture.wrapS=clothTexture.wrapT=T.RepeatWrapping;clothTexture.repeat.set(30,30);return clothTexture;
}
function material(color,kind='matte'){
 const key=color+kind;if(!sharedMaterials.has(key)){
  const m=new T.MeshStandardMaterial({color,roughness:kind==='metal'?.32:kind==='skin'?.68:kind==='hair'?.76:.91,metalness:kind==='metal'?.65:0});
  if(kind==='cloth'){m.bumpMap=fabric();m.bumpScale=.006;}
  sharedMaterials.set(key,m);
 }return sharedMaterials.get(key);
}
const transform=new T.Object3D();
function builder(parent,owned){
 const buckets=new Map();
 function part(geometry,mat,x,y,z,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0){
  transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();
  const g=(geometry.index?geometry.toNonIndexed():geometry.clone());g.applyMatrix4(transform.matrix);
  if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(g);
 }
 return{part,finish(){for(const [mat,geos]of buckets){const g=mergeGeometries(geos,false);geos.forEach(x=>x.dispose());if(!g)continue;g.computeBoundingSphere();owned.add(g);const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;parent.add(mesh);}buckets.clear();}};
}
function curve(points,radius=.006){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*3),radius,5,false);}
function robeGeometry(){
 const rows=16,cols=44,positions=[],uv=[],indices=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=j/rows,y=.12+t*1.4,a=.20+i/cols*(Math.PI*2-.40),waist=Math.exp(-(((t-.69)/.22)**2)),r=.365-.12*t-.045*waist+.035*Math.exp(-(((t-.92)/.1)**2)),fold=(Math.sin(a*12+t*.5)*.016+Math.sin(a*23)*.004)*(1-t*.8);
  positions.push(Math.sin(a)*(r+fold),y,Math.cos(a)*(r+fold)*.72);uv.push(i/cols,t);
  if(j<rows&&i<cols){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const robeBase=robeGeometry();
const headGeometry=sphere.clone();{
 const p=headGeometry.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const jaw=y<-.15?1-(Math.abs(y)-.15)*.25:1;p.setXYZ(i,x*jaw,y,z*(y<-.2?.87:1));}
 headGeometry.computeVertexNormals();
}
const hairCap=new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.63);
function shadow(owned){
 if(!shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'#0008');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(0,0,64,64);shadowTexture=new T.CanvasTexture(c);}
 const g=new T.PlaneGeometry(1.35,1.35),m=new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});owned.add(g);owned.add(m);const mesh=new T.Mesh(g,m);mesh.rotation.x=-Math.PI/2;mesh.position.y=.02;mesh.userData.skipAO=true;return mesh;
}
export function createActor({color='#547da9',skin='#c6a183',hair='#342824',robe='#202c35',hat=false,beard=false,scale=1}={}){
 const root=new T.Group(),rig=new T.Group(),owned=new Set();root.add(rig);root.scale.setScalar(scale);
 const cloth=material(robe,'cloth'),accent=material(color,'cloth').clone(),skinMat=material(skin,'skin'),hairMat=material(hair,'hair'),black=material('#1c2227'),gold=material('#b99a5f','metal'),linen=material('#d3d0bd','cloth'),vest=material('#353c3d','cloth'),lips=material('#926f63','skin'),eyes=material('#c0bdb0','skin'),iris=material('#464c42');owned.add(accent);
 const torso=builder(rig,owned);
 // A fitted waistcoat shows through the open robe, with lapels and house tie.
 torso.part(sphere,vest,0,1.14,.045,.23,.4,.17);
 torso.part(sphere,linen,0,1.43,.09,.15,.16,.105);
 torso.part(sphere,skinMat,0,1.58,0,.075,.13,.075);
 for(const side of [-1,1]){
  torso.part(cone,linen,side*.066,1.48,.19,.065,.16,.026,0,0,side*.35+Math.PI);
  torso.part(sphere,cloth,side*.215,1.42,0,.095,.12,.15,0,0,side*.3);
  torso.part(sphere,cloth,side*.18,1.27,.135,.055,.26,.035,0,0,-side*.19);
 }
 torso.part(sphere,accent,0,1.432,.215,.034,.043,.022);
 torso.part(cone,accent,0,1.245,.206,.048,.32,.026,0,0,Math.PI);
 for(let i=0;i<4;i++)torso.part(box,gold,0,1.35-i*.06,.232,.052,.008,.007,0,0,-.35);
 for(let i=0;i<5;i++)torso.part(sphere,gold,.07,1.29-i*.105,.195,.012,.012,.006);
 // Small enamel shield and embroidered boundary, bound to this actor's colour.
 torso.part(sphere,gold,-.18,1.36,.177,.061,.08,.018);
 torso.part(sphere,accent,-.18,1.365,.191,.048,.063,.012);
 torso.part(cone,gold,-.18,1.355,.206,.021,.044,.004);
 torso.part(cylinder,gold,0,.93,.197,.13,.018,.008,Math.PI/2);
 torso.finish();
 const cloakPivot=new T.Group();cloakPivot.position.y=1.5;rig.add(cloakPivot);
 const cloak=builder(cloakPivot,owned),robeMat=cloth.clone();robeMat.side=T.DoubleSide;owned.add(robeMat);
 cloak.part(robeBase,robeMat,0,-1.5,-.035);
 // The open front carries a fine house-coloured facing, curved like the cloth.
 for(const side of [-1,1]){
  const facing=curve([[side*.052,-1.35,.225],[side*.061,-.9,.18],[side*.052,-.48,.15],[side*.13,-.08,.12]],.018);cloak.part(facing,accent,0,0,0);facing.dispose();
  const seam=curve([[side*.2,-1.28,-.205],[side*.18,-.85,-.2],[side*.15,-.42,-.17],[side*.18,-.07,-.11]],.005);cloak.part(seam,material('#465052'),0,0,0);seam.dispose();
 }
 cloak.part(sphere,cloth,0,-.03,-.125,.21,.15,.14);
 cloak.part(sphere,accent,0,-.02,-.198,.15,.1,.055);
 cloak.finish();
 const head=new T.Group();head.position.y=1.63;rig.add(head);const face=builder(head,owned);
 face.part(headGeometry,skinMat,0,.13,0,.153,.218,.146);
 face.part(sphere,skinMat,0,.068,.123,.061,.062,.04);
 face.part(sphere,skinMat,0,.14,.139,.024,.066,.03);
 face.part(sphere,skinMat,0,.1,.17,.034,.025,.036);
 for(const side of [-1,1]){
  face.part(sphere,skinMat,side*.153,.13,-.006,.027,.052,.032);
  face.part(sphere,lips,side*.161,.13,.014,.014,.032,.012);
  face.part(sphere,skinMat,side*.077,.08,.1,.066,.066,.043);
  face.part(sphere,eyes,side*.059,.169,.137,.027,.015,.014);
  face.part(sphere,iris,side*.059,.169,.149,.011,.012,.005);
  face.part(sphere,black,side*.059,.169,.154,.005,.008,.003);
  face.part(sphere,skinMat,side*.059,.183,.14,.033,.012,.014);
  face.part(sphere,hairMat,side*.062,.205,.137,.035,.009,.014,0,0,-side*.13);
  face.part(sphere,lips,side*.016,.091,.189,.008,.005,.006);
 }
 const mouth=curve([[-.037,.027,.143],[0,.022,.155],[.037,.027,.143]],.005);face.part(mouth,lips,0,0,0);mouth.dispose();
 face.part(sphere,skinMat,0,-.008,.102,.062,.032,.045);
 // Cap and swept locks create a broken hair silhouette rather than a helmet.
 face.part(hairCap,hairMat,0,.19,-.018,.163,.18,.154,0,0,.1);
 for(let j=0;j<10;j++){
  const t=j/9,x=-.135+t*.26,y=.306-Math.sin(t*Math.PI)*.014,z=.075+Math.sin(t*Math.PI)*.055;
  face.part(sphere,hairMat,x,y,z,.047,.046,.095,.55,0,-.5+t*.3);
 }
 for(const side of [-1,1])for(let j=0;j<4;j++)face.part(sphere,hairMat,side*(.145-j*.004),.21-j*.035,-.045,.022,.05,.08,0,0,side*.16);
 if(beard){
  face.part(cone,hairMat,0,-.074,.09,.116,.32,.09,0,0,Math.PI);
  for(let j=-3;j<=3;j++)face.part(sphere,hairMat,j*.029,-.04-Math.abs(j)*.007,.115,.026,.11-Math.abs(j)*.012,.041,.18,0,-j*.08);
  for(const side of [-1,1])face.part(sphere,hairMat,side*.037,.048,.166,.047,.025,.02,0,0,-side*.18);
 }
 if(hat){
  face.part(cylinder,cloth,0,.37,-.01,.32,.035,.28,.04,0,-.05);
  const hatG=new T.LatheGeometry([[.205,0],[.19,.09],[.145,.25],[.08,.46],[.027,.62],[0,.64]].map(p=>new T.Vector2(...p)),24);
  const hp=hatG.attributes.position;for(let i=0;i<hp.count;i++)hp.setX(i,hp.getX(i)+Math.pow(hp.getY(i),2)*.23);hatG.computeVertexNormals();face.part(hatG,cloth,0,.38,-.01,1,1,1,0,0,-.13);hatG.dispose();
  face.part(cylinder,accent,0,.425,-.01,.196,.065,.196);
  face.part(sphere,gold,0,.43,.19,.032,.027,.014);
 }
 face.finish();
 const arms=[],forearms=[],legs=[],knees=[];
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.25,1.43,0);arm.rotation.z=side*.06;rig.add(arm);arms.push(arm);
  const upper=builder(arm,owned);upper.part(sphere,cloth,side*.025,-.135,0,.095,.185,.09,0,0,side*.05);upper.finish();
  const elbow=new T.Group();elbow.position.set(side*.035,-.28,0);arm.add(elbow);forearms.push(elbow);
  const lower=builder(elbow,owned);lower.part(sphere,cloth,side*.009,-.125,.005,.076,.165,.072);lower.part(cylinder,accent,side*.01,-.25,.007,.074,.035,.07);lower.part(sphere,skinMat,side*.01,-.307,.019,.043,.065,.032);
  for(let f=0;f<3;f++)lower.part(sphere,skinMat,side*.01+(f-1)*.022,-.35,.032,.012,.034,.015);
  lower.part(sphere,skinMat,side*-.026,-.302,.039,.018,.035,.019,0,0,side*.4);lower.finish();
  const leg=new T.Group();leg.position.set(side*.125,.9,.025);rig.add(leg);legs.push(leg);const thigh=builder(leg,owned);thigh.part(sphere,black,0,-.21,0,.093,.25,.105);thigh.finish();
  const knee=new T.Group();knee.position.y=-.41;leg.add(knee);knees.push(knee);const shin=builder(knee,owned);shin.part(sphere,black,0,-.16,.015,.067,.2,.074);shin.part(sphere,material('#272a27'),0,-.355,.065,.081,.076,.155);shin.part(sphere,material('#131818'),0,-.398,.067,.083,.025,.154);shin.part(sphere,material('#505148'),0,-.316,.08,.059,.031,.095);shin.finish();
 }
 const wand=new T.Group();wand.position.set(.012,-.33,.041);wand.rotation.x=Math.PI/2;forearms[1].add(wand);const wandParts=builder(wand,owned);wandParts.part(cylinder,material('#63482e'),0,.18,0,.013,.36,.013);wandParts.part(cylinder,material('#352d25'),0,.027,0,.022,.11,.022);for(let i=0;i<3;i++)wandParts.part(cylinder,gold,0,.01+i*.022,0,.024,.006,.024);wandParts.finish();
 const tipMaterial=new T.MeshBasicMaterial({color:'#fff2cc'});owned.add(tipMaterial);const tip=new T.Mesh(sphere,tipMaterial);tip.position.y=.37;tip.scale.setScalar(.018);wand.add(tip);
 root.add(shadow(owned));
 let phase=0,castTime=0,dodgeTime=0,smoothedSpeed=0,disposed=false;
 return{root,rig,head,wand,tip,arms,legs,
  cast(){castTime=.65;},dodge(){dodgeTime=.5;},setColor(c){accent.color.set(c);},
  update(dt,time,speed=0,talking=false){
   smoothedSpeed=T.MathUtils.lerp(smoothedSpeed,speed,1-Math.exp(-12*dt));phase+=dt*smoothedSpeed*2.05;castTime=Math.max(0,castTime-dt);dodgeTime=Math.max(0,dodgeTime-dt);
   const stride=Math.sin(phase)*Math.min(.58,smoothedSpeed*.13),run=smoothedSpeed>4.8;
   legs[0].rotation.x=stride;legs[1].rotation.x=-stride;knees[0].rotation.x=Math.max(0,-Math.sin(phase))*(run?.75:.4);knees[1].rotation.x=Math.max(0,Math.sin(phase))*(run?.75:.4);
   arms[0].rotation.x=-stride*.65+(talking?-.18+Math.sin(time*2.2)*.1:0);arms[1].rotation.x=castTime>0?-1.15-Math.sin((.65-castTime)*Math.PI/.65)*.35:stride*.55;
   forearms[0].rotation.x=run?-.45:talking?-.4:-.12;forearms[1].rotation.x=castTime>0?-.45:run?-.5:-.17;
   arms[0].rotation.z=-.06-Math.sin(time*1.4)*.02;arms[1].rotation.z=.06+(castTime>0?-.13:Math.sin(time*1.6)*.02);
   rig.position.y=Math.abs(Math.sin(phase))*Math.min(.04,smoothedSpeed*.008)+Math.sin(time*1.8)*.009;
   rig.rotation.x=dodgeTime>0?-.62:Math.min(.08,smoothedSpeed*.008);rig.rotation.z=Math.sin(phase)*Math.min(.025,smoothedSpeed*.004);
   cloakPivot.rotation.x=.015+Math.sin(phase+.5)*smoothedSpeed*.006+Math.sin(time*2)*.008+(dodgeTime>0?.12:0);cloakPivot.rotation.z=Math.sin(phase-.5)*smoothedSpeed*.003;
   head.rotation.y=talking?Math.sin(time*1.7)*.08:Math.sin(time*.4)*.025;head.rotation.x=talking?Math.sin(time*2.3)*.035:0;
   tip.scale.setScalar(castTime>0?.035+Math.sin(castTime*18)*.01:.018);
  },
  dispose(){if(disposed)return;disposed=true;owned.forEach(item=>item.dispose());owned.clear();}
 };
}

export function createDummy(boss=false){
 const root=new T.Group(),body=new T.Group(),owned=new Set();root.add(body);const build=builder(body,owned),wood=material(boss?'#596971':'#66513b',boss?'metal':'matte'),trim=material(boss?'#b5afa0':'#99835b','metal'),dark=material('#283038','metal');
 if(boss){
  build.part(sphere,wood,0,1.22,0,.36,.45,.23);build.part(sphere,trim,0,1.2,.14,.28,.34,.11);build.part(sphere,wood,0,1.78,0,.24,.29,.22);
  build.part(sphere,dark,0,1.81,.198,.18,.048,.03);build.part(cylinder,trim,0,1.86,.217,.016,.36,.016,0,0,Math.PI/2);
  build.part(cone,trim,0,2.1,-.02,.07,.25,.11);for(const side of[-1,1]){build.part(sphere,wood,side*.4,1.5,0,.19,.18,.25);build.part(sphere,trim,side*.4,1.55,.03,.17,.12,.23);build.part(sphere,wood,side*.5,1.17,0,.11,.28,.12,0,0,side*.2);build.part(sphere,wood,side*.17,.58,0,.12,.38,.14);build.part(sphere,trim,side*.17,.38,.1,.13,.16,.07);build.part(sphere,dark,side*.17,.15,.06,.13,.13,.24);}
  for(let j=0;j<4;j++)build.part(sphere,wood,0,.92-j*.07,.04,.3+j*.013,.07,.23);
 }else{
  build.part(cylinder,wood,0,.83,0,.065,1.6,.065);build.part(sphere,material('#96856a','cloth'),0,1.22,0,.29,.4,.21);build.part(sphere,material('#ac9a7b','cloth'),0,1.8,0,.22,.28,.2);build.part(cylinder,wood,0,1.42,0,.065,1.5,.065,0,0,Math.PI/2);
  for(const y of[1.05,1.28,1.52])build.part(torus,material('#584d3b'),0,y,0,.3,.22,.3,Math.PI/2);
  for(const side of[-1,1])build.part(box,wood,side*.24,.08,0,.62,.11,.13,0,side*.65);
  build.part(sphere,trim,0,1.28,.197,.23,.24,.035);build.part(torus,dark,0,1.28,.238,.145,.145,.145);
 }
 build.finish();const gm=new T.MeshBasicMaterial({color:boss?'#bd90ed':'#dcae6c'}),gg=new T.OctahedronGeometry(.105);owned.add(gm);owned.add(gg);const gem=new T.Mesh(gg,gm);gem.position.set(0,1.3,boss?.27:.26);body.add(gem);root.add(shadow(owned));if(boss)root.scale.setScalar(1.3);let disposed=false;return{root,body,gem,dispose(){if(disposed)return;disposed=true;owned.forEach(x=>x.dispose());owned.clear();}};
}
export function labelSprite(text,color='#ead4a0'){
 const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.textAlign='center';x.font='500 27px Georgia';x.shadowColor='#08151b';x.shadowBlur=7;x.fillStyle=color;x.fillText(text,256,50);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false});const s=new T.Sprite(m);s.scale.set(2.7,.51,1);s.userData.skipAO=true;return s;
}
