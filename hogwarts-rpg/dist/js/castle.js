import * as T from '../assets/three.module.js';
import {mergeGeometries} from '../assets/addons/utils/BufferGeometryUtils.js';

// A walkable castle interior: Entrance Hall, the great staircase tower with platforms that
// turn between landings, four long corridors (dungeons and three floors) and classrooms that
// open straight off them. Rooms are built from the same interiors as before and are loaded
// when you approach their door, so walking from hall to classroom never cuts to black.
export const FLOORS={D:-8,G:0,F1:8,F2:16,F3:24};
const ROOM_W=29,ROOM_D=37;
const CORRIDORS=[
 {id:'D',name:'Lochy',y:-8,axis:'x',sign:1,center:34,start:29,end:160,width:6,height:5.6,a:['potions','snape-office','alchemy','kitchens'],b:['slytherin','hufflepuff','water','chamber'],at:[48,80,112,144],tint:'#9fb0a2'},
 {id:'F1',name:'Pierwsze piętro',y:8,axis:'x',sign:1,center:0,start:14,end:145,width:6,height:7,a:['charms','transfiguration','defence','history'],b:['hospital','muggle-studies','apparition','prefects'],at:[32,64,96,128],tint:'#c7b9a0'},
 {id:'F2',name:'Drugie piętro',y:16,axis:'z',sign:-1,center:0,start:14,end:145,width:6,height:7,a:['library','restricted','arithmancy','runes'],b:['myrtle','duelling','repair','trophy'],at:[32,64,96,128],tint:'#bfb6a4'},
 {id:'F3',name:'Trzecie piętro',y:24,axis:'x',sign:-1,center:0,start:14,end:145,width:6,height:7,a:['requirement','patronus','hidden-corridor','headmaster'],b:['gryffindor','ravenclaw','divination','music'],at:[32,64,96,128],tint:'#c2b7a8'},
];
export const CASTLE_ROOMS=new Set(['great-hall',...CORRIDORS.flatMap(c=>[...c.a,...c.b])]);

const loader=new T.TextureLoader();
const texCache=new Map();
function tex(name,repeat=1,srgb=true){
 const key=name+repeat;if(texCache.has(key))return texCache.get(key);
 const t=loader.load(new URL(`../assets/textures/${name}.jpg`,import.meta.url).href);
 t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;
 texCache.set(key,t);return t;
}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
// leaded glass: diamond quarries in amber, ruby, cobalt, moss and clear panes
function stainedGlass(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 const r=rng(4242),pal=['#e7b45a','#c2453b','#3b5fa8','#5f8f4a','#e9dfc4','#d98a3c','#7d5aa0','#cfe0e8'];
 x.fillStyle='#14120f';x.fillRect(0,0,256,256);
 const N=4,w=256/N;
 for(let i=-1;i<=N;i++)for(let j=-1;j<=N*2;j++){
  const cx=i*w+(j%2?w/2:0),cy=j*w/2;
  const col=r()<.35?pal[7]:pal[Math.floor(r()*7)];
  const g=x.createRadialGradient(cx-w*.12,cy-w*.12,2,cx,cy,w*.6);g.addColorStop(0,'#ffffff');g.addColorStop(.18,col);g.addColorStop(1,col);
  x.fillStyle=g;x.globalAlpha=.88+r()*.12;x.beginPath();x.moveTo(cx,cy-w/2+3);x.lineTo(cx+w/2-3,cy);x.lineTo(cx,cy+w/2-3);x.lineTo(cx-w/2+3,cy);x.closePath();x.fill();
 }
 x.globalAlpha=1;
 // seeds and streaks in the old glass
 for(let k=0;k<900;k++){x.fillStyle=r()<.5?'#ffffff14':'#00000018';x.fillRect(r()*256,r()*256,1+r()*3,1);}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;
}
function rng(seed){let n=seed>>>0;return()=>(n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296;}

// box with world-scaled UVs, so textures keep their size on long walls
function uvBox(w,h,d,size=3){
 const g=new T.BoxGeometry(w,h,d),uv=g.attributes.uv;
 const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
 for(let f=0;f<6;f++)for(let i=0;i<4;i++){const k=f*4+i;uv.setXY(k,uv.getX(k)*dims[f][0]/size,uv.getY(k)*dims[f][1]/size);}
 return g;
}

export function createCastle({ROOMS,createInterior,createRoomIdentity,createRoomActivityProps}){
 const group=new T.Group();group.name='Castle interior';
 const random=rng(1234);
 const disposables=[];
 // ---------------------------------------------------------------- materials
 const M={
  wall:new T.MeshStandardMaterial({color:'#b8ab92',map:tex('stone',1),normalMap:tex('stone-normal',1,false),roughnessMap:tex('stone-rough',1,false),normalScale:new T.Vector2(.9,.9),roughness:.95}),
  floor:new T.MeshStandardMaterial({color:'#958d80',map:tex('stone',1),normalMap:tex('stone-normal',1,false),roughnessMap:tex('stone-rough',1,false),roughness:.68,normalScale:new T.Vector2(.7,.7)}),
  dark:new T.MeshStandardMaterial({color:'#4e5650',map:tex('stone',1),normalMap:tex('stone-normal',1,false),roughness:.95}),
  trim:new T.MeshStandardMaterial({color:'#d2c6ad',roughness:.8}),
  wood:new T.MeshStandardMaterial({color:'#7a5b40',map:tex('wood',1),roughness:.7}),
  darkWood:new T.MeshStandardMaterial({color:'#3d2a1e',map:tex('wood',1),roughness:.7}),
  gold:new T.MeshStandardMaterial({color:'#c9a45c',metalness:.8,roughness:.32}),
  iron:new T.MeshStandardMaterial({color:'#3b4246',metalness:.75,roughness:.45}),
  steel:new T.MeshStandardMaterial({color:'#aeb6bb',metalness:.9,roughness:.28}),
  flame:new T.MeshStandardMaterial({color:'#ffcf7a',emissive:'#ff9a2e',emissiveIntensity:3.2}),
  greenFlame:new T.MeshStandardMaterial({color:'#bff5c8',emissive:'#4bd27a',emissiveIntensity:2.6}),
  glass:new T.MeshStandardMaterial({color:'#9fc0c8',transparent:true,opacity:.22,roughness:.05,metalness:.1,depthWrite:false}),
  window:(()=>{const t=stainedGlass();return new T.MeshStandardMaterial({color:'#ffffff',map:t,emissive:'#ffffff',emissiveMap:t,emissiveIntensity:1.35,roughness:.25});})(),
  carpet:new T.MeshStandardMaterial({color:'#6e1f22',roughness:.95}),
 };
 for(const m of Object.values(M))disposables.push(m);
 disposables.push(M.window.map);
 const houseCols=['#a5332f','#2f4f8f','#d1a23c','#2e7055'];
 const banners=houseCols.map(c=>new T.MeshStandardMaterial({color:c,roughness:.9,side:T.DoubleSide}));disposables.push(...banners);

 // ---------------------------------------------------------------- builders (merged per band and material)
 const buckets=new Map();       // band|material -> geometries
 const walls=[];                // colliders {x,z,w,d,y0,y1,band}
 const regions=[];              // walk regions
 const anchors=[];              // light anchors {pos,color,intensity,distance,band}
 const animated=[];             // flames, portraits, armour, candles...
 const bands={D:new T.Group(),G:new T.Group(),T:new T.Group(),F1:new T.Group(),F2:new T.Group(),F3:new T.Group()};
 for(const [k,g] of Object.entries(bands)){g.name='band '+k;group.add(g);}
 function add(band,mat,geo){const key=band+'|'+mat.uuid;if(!buckets.has(key))buckets.set(key,{band,mat,geos:[]});buckets.get(key).geos.push(geo);}
 function box(band,mat,x,y,z,w,h,d,{ry=0,size=3,collide=false}={}){
  const g=uvBox(w,h,d,size);if(ry)g.rotateY(ry);g.translate(x,y,z);add(band,mat,g);
  if(collide)walls.push({x,z,w:ry?d:w,d:ry?w:d,y0:y-h/2,y1:y+h/2,band});
 }
 function cyl(band,mat,x,y,z,r,h,seg=12,r2=r){const g=new T.CylinderGeometry(r2,r,h,seg);g.translate(x,y,z);add(band,mat,g);}
 function region(r){regions.push({band:r.band||'G',...r});}
 // a wall along x or z, with door gaps [{at,w,h}]
 function wallRun(band,axis,fixed,from,to,y0,height,thick,gaps=[],mat=M.wall){
  const lo=Math.min(from,to),hi=Math.max(from,to);
  const cuts=gaps.filter(g=>g.at>lo&&g.at<hi).sort((a,b)=>a.at-b.at);
  let cur=lo;
  const piece=(a,b,yb,h)=>{if(b-a<.05)return;const c=(a+b)/2,len=b-a;
   if(axis==='x')box(band,mat,c,yb+h/2,fixed,len,h,thick,{collide:true});else box(band,mat,fixed,yb+h/2,c,thick,h,len,{collide:true});};
  for(const g of cuts){piece(cur,g.at-g.w/2,y0,height);
   // lintel above the opening
   if(g.h<height){if(axis==='x')box(band,mat,g.at,y0+g.h+(height-g.h)/2,fixed,g.w,height-g.h,thick);else box(band,mat,fixed,y0+g.h+(height-g.h)/2,g.at,thick,height-g.h,g.w);}
   // pointed arch frame
   archFrame(band,axis,fixed,g.at,y0,g.w,g.h,thick);
   cur=g.at+g.w/2;}
  piece(cur,hi,y0,height);
 }
 function archFrame(band,axis,fixed,at,y0,w,h,thick){
  const s=new T.Shape(),hw=w/2+.25,sh=h-w*.55;
  s.moveTo(-hw,0);s.lineTo(-hw,sh);s.quadraticCurveTo(-hw,h+.15,0,h+.35);s.quadraticCurveTo(hw,h+.15,hw,sh);s.lineTo(hw,0);s.lineTo(hw-.22,0);s.lineTo(hw-.22,sh);s.quadraticCurveTo(hw-.22,h-.1,0,h+.1);s.quadraticCurveTo(-hw+.22,h-.1,-hw+.22,sh);s.lineTo(-hw+.22,0);
  const g=new T.ExtrudeGeometry(s,{depth:thick+.16,bevelEnabled:false});g.translate(0,0,-(thick+.16)/2);
  if(axis==='z')g.rotateY(Math.PI/2);
  g.translate(axis==='x'?at:fixed,y0,axis==='x'?fixed:at);add(band,M.trim,g);
 }
 const halos={};   // band -> [{x,y,z,phase,green,anchor}]
 function torch(band,x,y,z,nx,nz,green=false){
  box(band,M.iron,x-nx*.12,y-.3,z-nz*.12,.08,.5,.08);
  const g=new T.ConeGeometry(.13,.35,8);g.translate(x+nx*.05,y,z+nz*.05);add(band,M.iron,g);
  const f=new T.Mesh(new T.ConeGeometry(.1,.42,7),green?M.greenFlame:M.flame);f.position.set(x+nx*.06,y+.33,z+nz*.06);bands[band].add(f);
  animated.push({kind:'flame',mesh:f,phase:random()*9});
  const anchor={pos:new T.Vector3(x+nx*.5,y+.5,z+nz*.5),color:green?'#7fe6a0':'#ffb45e',intensity:green?14:19,distance:15,band,flicker:true,flame:f,face:Math.atan2(nx,nz)};
  anchors.push(anchor);
  (halos[band]??=[]).push({x:x+nx*.06,y:y+.36,z:z+nz*.06,phase:random()*9,green,anchor});
 }
 // ---------------------------------------------------------------- volumetric light shafts from the windows
 const shaftGeo=new T.CylinderGeometry(1,1,1,20,1,true);disposables.push(shaftGeo);
 const shaftMats=[];
 // a soft patch of window light on the floor where a shaft lands
 const poolMat=new T.ShaderMaterial({uniforms:{color:{value:new T.Color('#fff')},intensity:{value:.3}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 color;uniform float intensity;varying vec2 vUv;void main(){float r=length((vUv-.5)*2.);float a=pow(max(0.,1.-r),1.7)*intensity;gl_FragColor=vec4(color*a,1.);}`,
  transparent:true,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 disposables.push(poolMat);
 function lightPool(band,x,y,z,rx,rz,color,intensity){
  const m=poolMat.clone();m.uniforms.color.value=new T.Color(color);m.uniforms.intensity.value=intensity;disposables.push(m);
  const g=new T.PlaneGeometry(rx*2,rz*2);g.rotateX(-Math.PI/2);disposables.push(g);
  const mesh=new T.Mesh(g,m);mesh.position.set(x,y+.035,z);mesh.renderOrder=2;mesh.userData.skipAO=true;bands[band].add(mesh);
 }
 function shaft(band,from,to,r0,r1,color,intensity){
  const m=new T.ShaderMaterial({uniforms:{color:{value:new T.Color(color)},intensity:{value:intensity},time:{value:0}},
   vertexShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vV;
void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`uniform vec3 color;uniform float intensity;uniform float time;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
 float along=vUv.y;
 float fall=smoothstep(0.,.35,along)*(1.-smoothstep(.9,1.,along))*(.35+.65*along);
 float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.25);
 float n=n2(vec2(vUv.x*9.+time*.04,vUv.y*4.-time*.07))*.6+n2(vec2(vUv.x*23.-time*.03,vUv.y*9.))*.4;
 float a=intensity*fall*edge*(.55+.45*n);
 gl_FragColor=vec4(color*a,1.);
}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
  shaftMats.push(m);disposables.push(m);
  const mesh=new T.Mesh(shaftGeo,m);
  const dir=new T.Vector3().subVectors(from,to),len=dir.length();
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
  // a cone: radius r0 at the window (top), r1 on the floor (bottom)
  mesh.scale.set(1,len,1);mesh.userData.skipAO=true;mesh.renderOrder=3;
  const g=new T.CylinderGeometry(r0,r1,1,20,1,true);mesh.geometry=g;disposables.push(g);
  bands[band].add(mesh);
 }
 // ---------------------------------------------------------------- living portraits (original paintings)
 const paintTex=[];
 for(let i=0;i<8;i++){
  const r=rng(77+i*13);
  paintTex.push(canvasTex(256,320,(c,w,h)=>{
   const sky=c.createLinearGradient(0,0,0,h);const hue=[30,200,120,260,15,180,45,330][i];
   sky.addColorStop(0,`hsl(${hue},28%,${32+r()*10}%)`);sky.addColorStop(1,`hsl(${(hue+40)%360},24%,${14+r()*8}%)`);c.fillStyle=sky;c.fillRect(0,0,w,h);
   if(i%2){c.fillStyle=`hsl(${hue},20%,20%)`;c.beginPath();c.moveTo(0,h*.72);for(let x=0;x<=w;x+=16)c.lineTo(x,h*(.6+.12*Math.sin(x*.03+i)+r()*.05));c.lineTo(w,h);c.lineTo(0,h);c.fill();}
   else{c.fillStyle='#00000055';c.fillRect(w*.1,h*.08,w*.8,h*.84);}
   for(let k=0;k<1800;k++){c.fillStyle=r()>.5?'#ffffff08':'#00000010';c.fillRect(r()*w,r()*h,2+r()*5,1+r()*3);}
  }));
 }
 const figureTex=canvasTex(128,256,(c,w,h)=>{c.fillStyle='#1d1a17';c.beginPath();c.ellipse(64,58,24,28,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(30,250);c.quadraticCurveTo(26,120,64,92);c.quadraticCurveTo(102,120,98,250);c.fill();c.fillStyle='#c9a37e';c.beginPath();c.ellipse(64,60,15,19,0,0,Math.PI*2);c.fill();});
 const frameGeo=new T.BoxGeometry(1,1,.12);disposables.push(frameGeo,...paintTex,figureTex);
 function portrait(band,x,y,z,ry,w=1.4,h=1.8){
  const holder=new T.Group();holder.position.set(x,y,z);holder.rotation.y=ry;bands[band].add(holder);
  const frame=new T.Mesh(frameGeo,M.gold);frame.scale.set(w+.22,h+.22,1);holder.add(frame);
  const canvas=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:paintTex[Math.floor(random()*paintTex.length)],roughness:.85}));canvas.position.z=.065;holder.add(canvas);
  const fig=new T.Mesh(new T.PlaneGeometry(w*.42,h*.62),new T.MeshStandardMaterial({map:figureTex,transparent:true,alphaTest:.3,roughness:.9}));fig.position.set(0,-h*.18,.07);holder.add(fig);
  disposables.push(canvas.geometry,canvas.material,fig.geometry,fig.material);
  animated.push({kind:'portrait',fig,w,phase:random()*20,speed:.2+random()*.3});
 }
 // ---------------------------------------------------------------- suits of armour that follow you with their helmets
 function armour(band,x,y,z,ry){
  const a=new T.Group();a.position.set(x,y,z);a.rotation.y=ry;bands[band].add(a);
  const P=(geo,mat,px,py,pz,sx=1,sy=1,sz=1)=>{const m=new T.Mesh(geo,mat);m.position.set(px,py,pz);m.scale.set(sx,sy,sz);a.add(m);return m;};
  const sph=new T.SphereGeometry(1,12,8),cy=new T.CylinderGeometry(1,1,1,10),bx=new T.BoxGeometry(1,1,1);disposables.push(sph,cy,bx);
  P(bx,M.dark,0,.15,0,.9,.3,.7);
  P(cy,M.steel,-.13,.75,0,.09,.9,.09);P(cy,M.steel,.13,.75,0,.09,.9,.09);
  P(sph,M.steel,0,1.42,0,.27,.42,.19);P(sph,M.steel,0,1.1,0,.24,.18,.17);
  P(cy,M.steel,-.34,1.35,0,.07,.62,.07).rotation.z=.15;P(cy,M.steel,.34,1.35,0,.07,.62,.07).rotation.z=-.15;
  P(sph,M.steel,-.3,1.72,0,.13,.09,.12);P(sph,M.steel,.3,1.72,0,.13,.09,.12);
  const head=P(sph,M.steel,0,1.98,0,.13,.16,.14);
  const visor=new T.Mesh(bx,M.iron);visor.scale.set(.18,.03,.06);visor.position.set(0,.02,.12);head.add(visor);
  const halb=P(cy,M.darkWood,.42,1.2,.1,.025,2.4,.025);const blade=new T.Mesh(bx,M.steel);blade.scale.set(.03,.35,.18);blade.position.y=1.15;halb.add(blade);
  walls.push({x,z,r:.45,y0:y,y1:y+2.3,band});
  animated.push({kind:'armour',head,root:a,base:ry,turn:0});
 }
 // ---------------------------------------------------------------- floating candles
 function candles(band,cx,cy,cz,sx,sy,sz,n){
  const pos=[],data=[];
  const g=new T.CylinderGeometry(.035,.04,.32,6);disposables.push(g);
  const inst=new T.InstancedMesh(g,new T.MeshStandardMaterial({color:'#efe6cf',emissive:'#ffcf86',emissiveIntensity:.25,roughness:.6}),n);
  const fl=new T.InstancedMesh(new T.SphereGeometry(.035,6,4),M.flame,n);
  for(let i=0;i<n;i++){const p=new T.Vector3(cx+(random()-.5)*sx,cy+(random()-.5)*sy,cz+(random()-.5)*sz);data.push({p,ph:random()*9});}
  bands[band].add(inst,fl);disposables.push(inst.material,fl.geometry);
  animated.push({kind:'candles',inst,fl,data});
  anchors.push({pos:new T.Vector3(cx,cy,cz),color:'#ffcf86',intensity:18,distance:Math.max(sx,sz),band});
 }
 // ---------------------------------------------------------------- bench (NPCs can sit)
 const seats=[];
 function bench(band,x,y,z,ry){
  box(band,M.wood,x,y+.42,z,ry?.42:1.9,.08,ry?1.9:.42);
  for(const s of [-.8,.8])box(band,M.darkWood,x+(ry?0:s),y+.2,z+(ry?s:0),.08,.4,.36);
  walls.push({x,z,w:ry?.5:1.9,d:ry?1.9:.5,y0:y,y1:y+.5,band});
  seats.push({pos:new T.Vector3(x,y,z),yaw:ry,band,taken:null});
 }

 // ================================================================ ENTRANCE HALL (ground floor)
 const G=FLOORS.G;
 box('G',M.floor,0,G-.25,29,28,.5,30,{size:4});
 box('G',M.dark,0,G+16.2,29,28.4,.4,30.4);
 wallRun('G','x',44,-14,14,G,16,1,[{at:0,w:7,h:8.5}]);            // great doors to the courtyard
 wallRun('G','z',-14,14,44,G,16,1,[{at:29,w:3.6,h:6}]);            // to the Great Hall
 wallRun('G','z',14,14,44,G,16,1,[{at:34,w:3.6,h:5.5}]);           // down to the dungeons
 wallRun('G','x',14,-14,14,G,16,1,[{at:0,w:10,h:10}]);             // into the staircase tower
 region({band:'G',cell:'entrance',x0:-13.5,x1:13.5,z0:14,z1:43.6,y:G,surface:'stone'});
 region({band:'G',cell:'exit',x0:-3.2,x1:3.2,z0:43,z1:45.4,y:G,surface:'stone',exit:'courtyard'});
 // great doors (open), carpet, columns, banners, torches
 for(const s of [-1,1]){box('G',M.darkWood,s*4.8,G+4.2,43.2,.25,8.4,3.4,{ry:s*.5});}
 box('G',M.carpet,0,G+.02,30,3.2,.03,27);
 for(let z=18;z<=40;z+=7.3)for(const s of [-1,1]){cyl('G',M.trim,s*9.5,G+8,z,.55,16,14);walls.push({x:s*9.5,z,r:.6,y0:G,y1:G+16,band:'G'});cyl('G',M.trim,s*9.5,G+.3,z,.8,.6,14);}
 for(let i=0;i<4;i++){const z=20+i*5.5;const m=new T.Mesh(new T.PlaneGeometry(1.6,5),banners[i]);m.position.set(13.4,G+9,z);m.rotation.y=-Math.PI/2;bands.G.add(m);disposables.push(m.geometry);}
 for(const z of [18,26,38])for(const s of [-1,1])torch('G',s*13.35,G+3.4,z,-s,0);
 // house-point hourglasses: gems trickle as points are earned
 const hourglasses=[];
 for(let i=0;i<4;i++){
  const x=-12+i*1.15+0,z=21.5;const hg=new T.Group();hg.position.set(-12.2,G,17+i*1.7);bands.G.add(hg);
  const glass=new T.Mesh(new T.CylinderGeometry(.42,.42,3.2,18,1,true),M.glass);glass.position.y=2.2;hg.add(glass);
  for(const y of [.55,3.85]){const cap=new T.Mesh(new T.CylinderGeometry(.55,.55,.22,18),M.gold);cap.position.y=y;hg.add(cap);}
  const gemMat=new T.MeshStandardMaterial({color:houseCols[i],emissive:houseCols[i],emissiveIntensity:.55,roughness:.25,metalness:.2});disposables.push(gemMat,glass.geometry);
  const lower=new T.Mesh(new T.CylinderGeometry(.38,.38,1,16),gemMat);lower.position.y=.68;hg.add(lower);
  const upper=new T.Mesh(new T.CylinderGeometry(.38,.38,1,16),gemMat);upper.position.y=3.72;hg.add(upper);
  hourglasses.push({lower,upper,level:.25+random()*.5});
  walls.push({x:-12.2,z:17+i*1.7,r:.6,y0:G,y1:G+4,band:'G'});
 }
 candles('G',0,G+10,29,18,2.5,22,70);
 const day=new T.Mesh(new T.PlaneGeometry(9,10),new T.MeshBasicMaterial({color:'#f3e2bd'}));day.position.set(0,G+5,45.2);day.rotation.y=Math.PI;bands.G.add(day);disposables.push(day.geometry,day.material);
 anchors.push({pos:new T.Vector3(0,G+4,42),color:'#f6e3bd',intensity:30,distance:22,band:'G'});
 portrait('G',-13.42,G+5.4,38,Math.PI/2);portrait('G',13.42,G+5.4,22,-Math.PI/2);
 shaft('G',new T.Vector3(0,G+8,44.4),new T.Vector3(0,G+1.3,33),3.1,4.2,'#f6e2b8',.3);lightPool('G',0,G,33.5,4.6,6.5,'#f6dfb0',.32);
 armour('G',-11.8,G,41.5,Math.PI*.85);armour('G',11.8,G,41.5,-Math.PI*.85);
 bench('G',12.2,G,30,Math.PI/2);bench('G',-12.2,G,34,Math.PI/2);

 // ================================================================ STAIRCASE TOWER
 const TW=14,TH=36;
 box('T',M.floor,0,G-.25,0,28,.5,28,{size:4});
 box('T',M.dark,0,TH,0,28.4,.5,28.4);
 // walls with the corridor openings at their floors (built as stacked runs)
 const towerWall=(axis,fixed,openAt,openY)=>{
  for(const [y0,y1] of [[G,FLOORS.F1],[FLOORS.F1,FLOORS.F2],[FLOORS.F2,FLOORS.F3],[FLOORS.F3,TH]]){
   const gaps=[];if(openY===y0)gaps.push({at:0,w:openY===G?10:5.4,h:openY===G?10:6.2});
   wallRun('T',axis,fixed,-TW,TW,y0,y1-y0,1,gaps);
  }
 };
 towerWall('x',TW,0,G);           // south: entrance hall
 towerWall('z',TW,0,FLOORS.F1);   // east: first floor corridor
 towerWall('x',-TW,0,FLOORS.F2);  // north: second floor corridor
 towerWall('z',-TW,0,FLOORS.F3);  // west: third floor corridor
 region({band:'T',cell:'tower',x0:-13.5,x1:13.5,z0:-13.5,z1:14.6,y:G,surface:'stone',holes:[{x0:-1.7,x1:1.7,z0:6,z1:9.35}]});
 for(const [key,y] of [['F1',FLOORS.F1],['F2',FLOORS.F2],['F3',FLOORS.F3]]){
  // gallery ring with balustrades (gaps where staircases may land)
  for(const [x0,x1,z0,z1] of [[-13.5,13.5,11,13.5],[-13.5,13.5,-13.5,-11],[11,13.5,-13.5,13.5],[-13.5,-11,-13.5,13.5]]){
   box('T',M.floor,(x0+x1)/2,y-.2,(z0+z1)/2,x1-x0,.4,z1-z0,{size:4});
   region({band:'T',cell:'tower',x0,x1,z0,z1,y,surface:'stone'});
  }
  for(const s of [-1,1]){for(const [a,b] of [[-11,-2.2],[2.2,11]]){
   box('T',M.trim,(a+b)/2,y+.95,s*11.05,b-a,.12,.18);box('T',M.trim,s*11.05,y+.95,(a+b)/2,.18,.12,b-a);
   for(let p=a;p<=b;p+=.9){cyl('T',M.trim,p,y+.45,s*11.05,.05,.9,6);cyl('T',M.trim,s*11.05,y+.45,p,.05,.9,6);}
  }}
  for(const [x,z,nx,nz] of [[-13.35,-7,1,0],[-13.35,7,1,0],[13.35,-7,-1,0],[13.35,7,-1,0],[-7,13.35,0,-1],[7,-13.35,0,1]])torch('T',x,y+3.2,z,nx,nz);
  for(const [x,z,ry] of [[-13.4,-3.6,Math.PI/2],[-13.4,3.6,Math.PI/2],[13.4,-3.6,-Math.PI/2],[3.6,13.4,Math.PI],[-3.6,-13.4,0]])portrait('T',x,y+3.6+random()*.8,z,ry,1.1+random()*.5,1.4+random()*.6);
 }
 for(const [x,z,ry] of [[-13.4,-6,Math.PI/2],[-13.4,6,Math.PI/2],[13.4,-6,-Math.PI/2],[13.4,6,-Math.PI/2],[-6,-13.4,0],[6,-13.4,0]])portrait('T',x,G+5,z,ry,1.6,2.1);
 candles('T',0,FLOORS.F2,0,18,26,18,120);
 for(const [x,z] of [[0,-13.45],[13.45,0],[-13.45,0],[0,13.45]])shaft('T',new T.Vector3(x*.97,TH-7,z*.97),new T.Vector3(x*.12,FLOORS.F2-1,z*.12),1.5,3.4,'#c8dbf2',.17);
 for(const [x,z,ry] of [[0,-13.45,0],[13.45,0,-Math.PI/2],[-13.45,0,Math.PI/2],[0,13.45,Math.PI]]){const wg=new T.PlaneGeometry(3.2,9);{const uv=wg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*9/3.2);}const w=new T.Mesh(wg,M.window);w.position.set(x,TH-7,z);w.rotation.y=ry;bands.T.add(w);disposables.push(w.geometry);anchors.push({pos:new T.Vector3(x*.75,TH-8,z*.75),color:'#b9cde4',intensity:26,distance:26,band:'T'});}
 for(const [x,z,nx,nz] of [[-13.35,-9,1,0],[13.35,-9,-1,0],[-9,-13.35,0,1],[9,-13.35,0,1]])torch('T',x,G+3.2,z,nx,nz);
 // stairs: a ramp of steps from (a) to (b); returns its mesh group
 function flight(parent,ax,az,ay,bx,bz,by,w=3.2){
  const g=new T.Group();parent.add(g);
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),n=Math.max(4,Math.round((by-ay)/.2)),yaw=Math.atan2(dx,dz);
  const step=new T.BoxGeometry(w,.22,len/n+.02),stringer=new T.BoxGeometry(.25,.5,len/n+.04);disposables.push(step,stringer);
  for(let i=0;i<n;i++){const t=(i+.5)/n;const m=new T.Mesh(step,M.floor);m.position.set(ax+dx*t,ay+(by-ay)*((i+1)/n)-.11,az+dz*t);m.rotation.y=yaw;g.add(m);
   for(const s of [-1,1]){const r=new T.Mesh(stringer,M.trim);r.position.copy(m.position).add(new T.Vector3(Math.cos(yaw)*s*(w/2),.35,-Math.sin(yaw)*s*(w/2)));r.rotation.y=yaw;g.add(r);}}
  const under=new T.Mesh(new T.BoxGeometry(w,.3,Math.hypot(len,by-ay)),M.wall);under.position.set((ax+bx)/2,(ay+by)/2-.35,(az+bz)/2);under.rotation.order='YXZ';under.rotation.y=yaw;under.rotation.x=Math.atan2(by-ay,len);g.add(under);disposables.push(under.geometry);
  return g;
 }
 const ramp=(o)=>region({band:'T',cell:'tower',surface:'stone',...o});
 // fixed flights
 flight(bands.T,0,9.6,G,0,3,4);ramp({x0:-1.6,x1:1.6,z0:3,z1:9.8,ramp:'z',c0:9.6,c1:3,y0:G,y1:4});
 flight(bands.T,-11,0,FLOORS.F1,-3,0,FLOORS.F1+4);ramp({x0:-11.2,x1:-3,z0:-1.6,z1:1.6,ramp:'x',c0:-11,c1:-3,y0:FLOORS.F1,y1:FLOORS.F1+4});
 flight(bands.T,11,0,FLOORS.F2,3,0,FLOORS.F2+4);ramp({x0:3,x1:11.2,z0:-1.6,z1:1.6,ramp:'x',c0:11,c1:3,y0:FLOORS.F2,y1:FLOORS.F2+4});
 // turning platforms: each carries one flight up to the next gallery; they rotate between allowed landings
 const platforms=[];
 for(const [y,dirs] of [[4,[0,Math.PI/2,Math.PI]],[12,[0,Math.PI/2,-Math.PI/2]],[20,[Math.PI/2,Math.PI,-Math.PI/2]]]){
  const piv=new T.Group();piv.position.set(0,0,0);bands.T.add(piv);
  const deck=new T.Mesh(new T.BoxGeometry(6,.45,6),M.floor);deck.position.y=y-.225;piv.add(deck);disposables.push(deck.geometry);
  for(const [x,z] of [[-2.9,-2.9],[2.9,-2.9],[-2.9,2.9],[2.9,2.9]]){const p=new T.Mesh(new T.CylinderGeometry(.12,.12,1.1,8),M.gold);p.position.set(x,y+.55,z);piv.add(p);disposables.push(p.geometry);}
  const rot=new T.Group();piv.add(rot);
  flight(rot,3,0,y,11,0,y+4);
  const plat={piv,rot,y,dirs,index:0,angle:dirs[0],from:dirs[0],to:dirs[0],t:1,timer:14+random()*16,moving:false};
  piv.rotation.y=plat.angle;platforms.push(plat);
  region({band:'T',cell:'tower',surface:'stone',plat,lx0:-3,lx1:3,lz0:-3,lz1:3,y});
  region({band:'T',cell:'tower',surface:'stone',plat,lx0:3,lx1:11.2,lz0:-1.6,lz1:1.6,ramp:'lx',c0:3,c1:11,y0:y,y1:y+4});
 }

 // ================================================================ DUNGEON STAIRS
 const D=FLOORS.D;
 wallRun('G','x',31.2,14,30,D,11.4,.8);wallRun('G','x',36.8,14,30,D,11.4,.8);
 for(let i=0;i<40;i++){const x=14.7+i*.4;box('G',M.floor,x,G-(i+1)*.2-.02,34,.42,.48,5.2);}
 box('G',M.dark,22,G+3.2,34,16.4,.4,6);
 region({band:'G',cell:'stairsD',x0:13,x1:15.2,z0:32.2,z1:35.8,y:G,surface:'stone'});
 region({band:'G',cell:'stairsD',x0:14.6,x1:30.4,z0:31.8,z1:36.2,ramp:'x',c0:14.5,c1:30.3,y0:G,y1:D,surface:'stone'});
 torch('G',22,G-1.2,31.6,0,1,true);

 // ================================================================ CORRIDORS + ROOM SLOTS
 const slots=[];
 const rot2=(x,z,a)=>[x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)];
 for(const C of CORRIDORS){
  const band=C.id,y=C.y,hw=C.width/2,H=C.height;
  const along=(t)=>C.sign*t;                         // along-axis coordinate
  const A0=along(C.start),A1=along(C.end);
  const lo=Math.min(A0,A1),hi=Math.max(A0,A1),mid=(lo+hi)/2,len=hi-lo;
  const P=(a,p)=>C.axis==='x'?[a,p]:[p,a];         // (along,perp) -> (x,z)
  const [fx,fz]=P(mid,C.center);
  box(band,M.floor,fx,y-.25,fz,C.axis==='x'?len:C.width+1,.5,C.axis==='x'?C.width+1:len,{size:4});
  box(band,M.dark,fx,y+H+.2,fz,C.axis==='x'?len:C.width+1.2,.4,C.axis==='x'?C.width+1.2:len);
  // vault ribs and carpet
  for(let a=lo+4;a<hi;a+=6){const [rx,rz]=P(a,C.center);box(band,M.trim,rx,y+H-.15,rz,C.axis==='x'?.35:C.width,.3,C.axis==='x'?C.width:.35);}
  if(C.id!=='D'){const [cx,cz]=P(mid,C.center);box(band,M.carpet,cx,y+.02,cz,C.axis==='x'?len-2:1.8,.03,C.axis==='x'?1.8:len-2);}
  // doors on both sides
  const gapsA=[],gapsB=[];
  C.at.forEach((t,i)=>{for(const [list,side,ids] of [[gapsA,-1,C.a],[gapsB,1,C.b]]){const id=ids[i];if(!id)continue;const a=along(t);list.push({at:a,w:3.4,h:5.8});
   // room slot: the room's entrance (+Z local) faces the corridor
   const perp=C.center+side*(hw+ROOM_D/2);const [x,z]=P(a,perp);
   let ry;if(C.axis==='x')ry=side<0?0:Math.PI;else ry=side<0?Math.PI/2:-Math.PI/2;
   // for corridors along z, side -1 is west (x<center) facing +x
   const [dx,dz]=rot2(0,18,ry);
   slots.push({id,band,y,center:new T.Vector3(x,y,z),ry,door:new T.Vector3(x+dx,y,z+dz),corridor:C.id,loaded:null});
  }});
  const fixedA=C.center-hw-.5,fixedB=C.center+hw+.5;
  wallRun(band,C.axis==='x'?'x':'z',fixedA,lo,hi,y,H,1,gapsA,C.id==='D'?M.dark:M.wall);
  wallRun(band,C.axis==='x'?'x':'z',fixedB,lo,hi,y,H,1,gapsB,C.id==='D'?M.dark:M.wall);
  // end wall with a tall window (and the tower stairs on the third floor)
  const endA=C.sign>0?hi:lo;const [ex,ez]=P(endA+C.sign*.5,C.center);
  box(band,C.id==='D'?M.dark:M.wall,ex,y+H/2,ez,C.axis==='x'?1:C.width+2,H,C.axis==='x'?C.width+2:1,{collide:true});
  if(C.id!=='D'){const [wx,wz]=P(endA,C.center);const [sx,sz]=P(endA-C.sign*9,C.center);shaft(band,new T.Vector3(wx,y+H*.55,wz),new T.Vector3(sx,y+1.1,sz),1,2.1,'#d6c7f0',.24);{const [px,pz]=P(endA-C.sign*9.6,C.center);lightPool(band,px,y,pz,C.axis==='x'?3.4:2.6,C.axis==='x'?2.6:3.4,'#e8d6ff',.22);}box(band,M.window,wx,y+H*.55,wz,C.axis==='x'?.12:2.2,H*.7,C.axis==='x'?2.2:.12);anchors.push({pos:new T.Vector3(wx,y+4,wz).add(new T.Vector3(C.axis==='x'?-C.sign*2:0,0,C.axis==='z'?-C.sign*2:0)),color:'#b8cde0',intensity:14,distance:16,band});}
  // walkable floor
  const [rx0,rz0]=P(lo,C.center-hw+.3),[rx1,rz1]=P(hi,C.center+hw-.3);
  region({band,cell:C.id,x0:Math.min(rx0,rx1),x1:Math.max(rx0,rx1),z0:Math.min(rz0,rz1),z1:Math.max(rz0,rz1),y,surface:'stone'});
  // tower doorway (or the dungeon stairs landing)
  // details: torches, portraits, armour, benches between doors
  for(let t=C.start+6;t<C.end-2;t+=8){const a=along(t);
   const nearDoor=C.at.some(d=>Math.abs(d-t)<3.4);if(nearDoor)continue;
   for(const side of [-1,1]){const [x,z]=P(a,C.center+side*(hw-.05));
    const k=Math.round(t/8)%3;
    if(k===0)torch(band,x,y+3.1,z,C.axis==='x'?0:-side,C.axis==='x'?-side:0,C.id==='D');
    else if(k===1&&C.id!=='D')portrait(band,x,y+3.3,z,C.axis==='x'?(side<0?0:Math.PI):(side<0?Math.PI/2:-Math.PI/2),1.2+random()*.5,1.5+random()*.6);
    else if(C.id!=='D'&&random()<.5){const [bx,bz]=P(a,C.center+side*(hw-.45));if(random()<.5)bench(band,bx,y,bz,C.axis==='x'?0:Math.PI/2);else armour(band,bx,y,bz,C.axis==='x'?(side<0?0:Math.PI):(side<0?Math.PI/2:-Math.PI/2));}
    else if(C.id==='D'&&k===2)torch(band,x,y+2.8,z,C.axis==='x'?0:-side,C.axis==='x'?-side:0,true);
   }}
 }
 // tower doorways between galleries and corridors
 region({band:'F1',cell:'F1',x0:13,x1:15,z0:-2.7,z1:2.7,y:FLOORS.F1,surface:'stone'});
 region({band:'F2',cell:'F2',x0:-2.7,x1:2.7,z0:-15,z1:-13,y:FLOORS.F2,surface:'stone'});
 region({band:'F3',cell:'F3',x0:-15,x1:-13,z0:-2.7,z1:2.7,y:FLOORS.F3,surface:'stone'});
 // dungeon corridor join with the stairs
 region({band:'D',cell:'D',x0:29,x1:31,z0:31.8,z1:36.2,y:D,surface:'stone'});
 // the Great Hall opens off the Entrance Hall
 slots.push({id:'great-hall',band:'G',y:G,center:new T.Vector3(-32.5,G,29),ry:Math.PI/2,door:new T.Vector3(-14.5,G,29),corridor:'G',loaded:null});
 // tower stairs to the astronomy tower and the owlery at the end of the third floor
 const towerDoor=new T.Vector3(-144,FLOORS.F3,0);

 // ---------------------------------------------------------------- secrets
 const pageTex=canvasTex(128,160,(c,w,h)=>{c.fillStyle='#e9dcb8';c.fillRect(6,6,w-12,h-12);c.strokeStyle='#8a6a3a';c.lineWidth=3;c.strokeRect(10,10,w-20,h-20);c.fillStyle='#5a4426';for(let i=0;i<9;i++)c.fillRect(22,30+i*12,w-44-(i%3)*12,3);c.beginPath();c.arc(w/2,h-34,12,0,7);c.stroke();});
 disposables.push(pageTex);
 const PAGES=[
  ['page-hall',new T.Vector3(12.3,G+1.1,42.6),'Sala Wejściowa','Wielkie drzwi zamka podobno otwierają się same przed tym, kto naprawdę wraca do domu. Pozostali muszą pchać.'],
  ['page-tower',new T.Vector3(-12.3,FLOORS.F1+1.1,12.3),'Wielkie Schody','Schody obracają się według własnego kalendarza. Starsi uczniowie twierdzą, że lubią punktualnych.'],
  ['page-f1',new T.Vector3(143.5,FLOORS.F1+1.1,2),'Pierwsze piętro','Zbroje na korytarzach pamiętają każdego, kto przeszedł obok. Dlatego warto mówić im dzień dobry.'],
  ['page-f2',new T.Vector3(2,FLOORS.F2+1.1,-143.5),'Drugie piętro','Pergamin z tego korytarza pachnie wanilią. Nikt nie wie dlaczego, ale biblioteka twierdzi, że to nie jej wina.'],
  ['page-f3',new T.Vector3(-143.5,FLOORS.F3+1.1,-2),'Trzecie piętro','Za ostatnim oknem trzeciego piętra widać jezioro. W pochmurne dni widać też to, co pod nim.'],
  ['page-dungeon',new T.Vector3(158.5,FLOORS.D+1.1,36.2),'Lochy','W lochach zielone pochodnie palą się dłużej. Ponoć karmią się ciszą.'],
  ['page-top',new T.Vector3(12.3,FLOORS.F3+1.1,-12.3),'Szczyt schodów','Najwyższa galeria wieży to jedyne miejsce, gdzie świece nie spadają. Próbowano.'],
 ].map(([id,pos,place,text])=>{const m=new T.Mesh(new T.PlaneGeometry(.42,.52),new T.MeshStandardMaterial({map:pageTex,emissive:'#ffe7a8',emissiveMap:pageTex,emissiveIntensity:.8,side:T.DoubleSide,transparent:true}));m.position.copy(pos);group.add(m);disposables.push(m.geometry,m.material);animated.push({kind:'page',mesh:m,base:pos.y});return {id,pos,place,text,mesh:m};});
 const tapestryMat=new T.MeshStandardMaterial({map:canvasTex(256,512,(c,w,h)=>{c.fillStyle='#3d2a4a';c.fillRect(0,0,w,h);c.strokeStyle='#c9a45c';c.lineWidth=8;c.strokeRect(12,12,w-24,h-24);for(let i=0;i<7;i++){c.fillStyle=i%2?'#5b3d6b':'#2e1f38';c.fillRect(24,30+i*64,w-48,40);}c.fillStyle='#c9a45c';c.beginPath();c.moveTo(w/2,h*.35);c.lineTo(w*.7,h*.5);c.lineTo(w/2,h*.65);c.lineTo(w*.3,h*.5);c.fill();}),roughness:.95,side:T.DoubleSide});
 disposables.push(tapestryMat,tapestryMat.map);
 const passage=[
  {id:'tapestry-f2',pos:new T.Vector3(-2.95,FLOORS.F2,-48),ry:Math.PI/2,to:'tapestry-f3'},
  {id:'tapestry-f3',pos:new T.Vector3(-48,FLOORS.F3,2.95),ry:Math.PI,to:'tapestry-f2'},
 ];
 for(const t of passage){const m=new T.Mesh(new T.PlaneGeometry(2.4,4.8),tapestryMat);m.position.copy(t.pos).add(new T.Vector3(0,2.8,0));m.rotation.y=t.ry;bands[t.id.endsWith('f2')?'F2':'F3'].add(m);disposables.push(m.geometry);t.mesh=m;}
 // ---------------------------------------------------------------- merge static geometry
 for(const {band,mat,geos} of buckets.values()){
  const merged=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g),false);
  for(const g of geos)g.dispose();
  const mesh=new T.Mesh(merged,mat);mesh.receiveShadow=true;mesh.castShadow=mat!==M.carpet;bands[band].add(mesh);disposables.push(merged);
 }

 // ---------------------------------------------------------------- torch halos (one draw call per floor)
 const haloMats=[];
 for(const [band,list] of Object.entries(halos)){
  const g=new T.BufferGeometry(),pos=new Float32Array(list.length*3),ph=new Float32Array(list.length),col=new Float32Array(list.length*3),on=new Float32Array(list.length).fill(1);
  list.forEach((h,i)=>{pos.set([h.x,h.y,h.z],i*3);ph[i]=h.phase;col.set(h.green?[.45,1,.6]:[1,.62,.28],i*3);h.anchor.halo={i,on,g};});
  g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('phase',new T.BufferAttribute(ph,1));g.setAttribute('color',new T.BufferAttribute(col,3));g.setAttribute('on',new T.BufferAttribute(on,1));
  const m=new T.ShaderMaterial({uniforms:{time:{value:0},scale:{value:400}},
   vertexShader:`attribute float phase;attribute float on;attribute vec3 color;varying vec3 vC;uniform float time;uniform float scale;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float f=.86+.1*sin(time*11.+phase)+.05*sin(time*23.+phase*2.);vC=color*on*f;gl_PointSize=scale*.62*f/max(.5,-mv.z);gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`varying vec3 vC;void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r),2.4);if(a*max(vC.r,vC.g)<.01)discard;gl_FragColor=vec4(vC*a*.85,1.);}`,
   transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const pts=new T.Points(g,m);pts.frustumCulled=false;pts.renderOrder=4;pts.userData.skipAO=true;bands[band].add(pts);haloMats.push(m);disposables.push(g,m);
 }
 // ---------------------------------------------------------------- dust in the air around you (wraps around the player in the shader)
 const DUST=900,dustGeo=new T.BufferGeometry(),dustSeed=new Float32Array(DUST*4);
 for(let i=0;i<DUST*4;i++)dustSeed[i]=random();
 dustGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(DUST*3),3));dustGeo.setAttribute('seed',new T.BufferAttribute(dustSeed,4));
 const dustMat=new T.ShaderMaterial({uniforms:{time:{value:0},center:{value:new T.Vector3()},box:{value:new T.Vector3(18,7,18)},scale:{value:400},strength:{value:.8}},
  vertexShader:`attribute vec4 seed;uniform float time;uniform vec3 center;uniform vec3 box;uniform float scale;varying float vA;
void main(){
 vec3 drift=vec3(sin(time*.11+seed.w*6.)*.6,-.05-seed.w*.06,cos(time*.09+seed.x*6.)*.6)*time;
 vec3 p=mod(seed.xyz*box+drift-center+box*.5,box)-box*.5+center;
 p+=vec3(sin(time*.7+seed.y*20.),sin(time*.5+seed.z*20.),cos(time*.6+seed.x*20.))*.06;
 vec3 q=(p-center)/(box*.5);vA=(1.-smoothstep(.6,1.,max(abs(q.x),max(abs(q.y),abs(q.z)))))*(.35+.65*seed.w);
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=scale*.034*(.6+seed.y)/max(.3,-mv.z);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float strength;varying float vA;void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r),1.6)*vA*strength;if(a<.004)discard;gl_FragColor=vec4(vec3(1.,.93,.82)*a,1.);}`,
  transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 const dust=new T.Points(dustGeo,dustMat);dust.frustumCulled=false;dust.renderOrder=5;dust.userData.skipAO=true;group.add(dust);disposables.push(dustGeo,dustMat);

 // ================================================================ queries
 const _p=new T.Vector3();
 function regionHeight(r,x,z){
  let lx=x,lz=z;
  if(r.plat){const a=-r.plat.piv.rotation.y;[lx,lz]=rot2(x,z,a);
   if(lx<r.lx0||lx>r.lx1||lz<r.lz0||lz>r.lz1)return null;
   if(r.ramp==='lx'){const t=T.MathUtils.clamp((lx-r.c0)/(r.c1-r.c0),0,1);return r.y0+(r.y1-r.y0)*t;}
   return r.y;
  }
  if(x<r.x0||x>r.x1||z<r.z0||z>r.z1)return null;
  if(r.holes)for(const h of r.holes)if(x>h.x0&&x<h.x1&&z>h.z0&&z<h.z1)return null;
  if(r.ramp){const c=r.ramp==='x'?x:z,t=T.MathUtils.clamp((c-r.c0)/(r.c1-r.c0),0,1);return r.y0+(r.y1-r.y0)*t;}
  return r.y;
 }
 function regionAt(x,z,y,tol=1.1){
  let best=null,bh=0,bd=tol;
  for(const r of regions){if(r.disabled)continue;const h=regionHeight(r,x,z);if(h===null)continue;const d=Math.abs(h-y);if(d<=bd){bd=d;best=r;bh=h;}}
  return best?{r:best,h:bh}:null;
 }
 function blockedAt(x,z,y,rad){
  for(const c of walls){if(y+1.7<c.y0||y+.15>c.y1)continue;
   if(c.r?Math.hypot(x-c.x,z-c.z)<c.r+rad:Math.abs(x-c.x)<c.w/2+rad&&Math.abs(z-c.z)<c.d/2+rad)return true;}
  return false;
 }
 function walkable(x,z,y,rad){
  const c=regionAt(x,z,y,.65);if(!c)return null;
  for(const [ox,oz] of [[rad,0],[-rad,0],[0,rad],[0,-rad]])if(!regionAt(x+ox,z+oz,c.h,.65))return null;
  if(blockedAt(x,z,c.h,rad))return null;
  return c;
 }
 function bandOf(y,x,z){
  const inTower=Math.abs(x)<14.2&&Math.abs(z)<14.2;
  if(inTower)return 'T';
  if(y<-3.5)return 'D';
  if(y<4)return x>14&&z>30?'G':'G';
  return y<12?'F1':y<20?'F2':'F3';
 }

 // ---------------------------------------------------------------- room streaming
 const roomInfo=id=>ROOMS.find(r=>r.id===id);
 function loadRoom(slot){
  const info=roomInfo(slot.id);if(!info)return;
  const room=createInterior({...info,professor:'',embedded:true});
  const holder=new T.Group();holder.position.copy(slot.center);holder.rotation.y=slot.ry;holder.add(room.group);
  const identity=createRoomIdentity(info);room.group.add(identity.group);
  const props=createRoomActivityProps(slot.id,T);props.group.position.set(8.6,0,13.8);room.group.add(props.group);
  group.add(holder);
  const ry=slot.ry,cx=slot.center.x,cz=slot.center.z,swap=Math.abs(Math.sin(ry))>.5;
  const toWorld=(x,z)=>{const [a,b]=rot2(x,z,ry);return [cx+a,cz+b];};
  const cols=[];
  for(const c of [...room.colliders,{x:8.6,z:13.8,w:1.65,d:1.2,height:1.1}]){const [x,z]=toWorld(c.x,c.z);cols.push(c.r?{x,z,r:c.r,y0:slot.y,y1:slot.y+(c.height??2.2),band:slot.band,room:slot.id}:{x,z,w:swap?c.d:c.w,d:swap?c.w:c.d,y0:slot.y,y1:slot.y+(c.height??2.2),band:slot.band,room:slot.id});}
  // perimeter walls for the camera
  for(const [lx,lz,w,d] of [[0,-18.2,29,.6],[-14.3,0,.6,37],[14.3,0,.6,37],[-8.2,18.2,12.6,.6],[8.2,18.2,12.6,.6]]){const [x,z]=toWorld(lx,lz);cols.push({x,z,w:swap?d:w,d:swap?w:d,y0:slot.y,y1:slot.y+14,band:slot.band,room:slot.id,wall:true});}
  walls.push(...cols);
  const corners=[toWorld(-12.6,-16.3),toWorld(12.6,16.3)],dc=[toWorld(-1.5,15.8),toWorld(1.5,19.8)];
  const rr={band:slot.band,cell:'room:'+slot.id,room:slot.id,x0:Math.min(corners[0][0],corners[1][0]),x1:Math.max(corners[0][0],corners[1][0]),z0:Math.min(corners[0][1],corners[1][1]),z1:Math.max(corners[0][1],corners[1][1]),y:slot.y,surface:['potions','chamber','bathroom','kitchen'].includes(info.type)?'stone':'wood'};
  const dr={band:slot.band,cell:'door:'+slot.id,room:slot.id,x0:Math.min(dc[0][0],dc[1][0]),x1:Math.max(dc[0][0],dc[1][0]),z0:Math.min(dc[0][1],dc[1][1]),z1:Math.max(dc[0][1],dc[1][1]),y:slot.y,surface:'stone'};
  regions.push(rr,dr);
  const lights=room.lightAnchors.map(a=>{const [x,z]=toWorld(a.x,a.z);return {pos:new T.Vector3(x,slot.y+a.y,z),color:a.color,intensity:a.intensity*.55,distance:a.distance,band:slot.band,room:slot.id,flicker:a.fire};});
  anchors.push(...lights);
  slot.loaded={room,holder,identity,props,cols,regions:[rr,dr],lights,info,toWorld};
  api.onRoomLoaded?.(slot);
 }
 function unloadRoom(slot){
  const L=slot.loaded;if(!L)return;
  api.onRoomUnloaded?.(slot);
  group.remove(L.holder);L.identity.dispose();L.props.dispose();L.room.dispose();
  for(const c of L.cols){const i=walls.indexOf(c);if(i>=0)walls.splice(i,1);}
  for(const r of L.regions){const i=regions.indexOf(r);if(i>=0)regions.splice(i,1);}
  for(const a of L.lights){const i=anchors.indexOf(a);if(i>=0)anchors.splice(i,1);}
  slot.loaded=null;
 }

 function setHalo(a,v){const h=a.halo;if(!h)return;h.on[h.i]=v;h.g.attributes.on.needsUpdate=true;}
 // ---------------------------------------------------------------- light pool
 const POOL=8,pool=[];
 for(let i=0;i<POOL;i++){const l=new T.PointLight('#ffb45e',0,12,2);group.add(l);pool.push({light:l,anchor:null,w:0});}
 const ambient=new T.HemisphereLight('#d8cdb6','#4a3b2e',.95);group.add(ambient);
 let lightTimer=0;

 const api={
  group,slots,regions,walls,platforms,anchors,seats,hourglasses,towerDoor,pages:PAGES,passage,
  // a prankster can blow out a torch for a while
  douse(p,time){let best=null,bd=7;for(const a of anchors){if(!a.flame)continue;const d=a.pos.distanceTo(p);if(d<bd){bd=d;best=a;}}if(best){best.dousedUntil=time+7;best.flame.visible=false;setHalo(best,0);}return best;},
  spawn:{entrance:new T.Vector3(0,G,41.5),tower:new T.Vector3(0,G,10)},
  floorAt(x,z,y=0){const c=regionAt(x,z,y,1.3);return c?c.h:y;},
  regionAt,
  surfaceAt(p){const c=regionAt(p.x,p.z,p.y,1.3);return c?.r.surface||'stone';},
  cellAt(p){const c=regionAt(p.x,p.z,p.y,1.3);return c?.r.cell||null;},
  roomAt(p){const c=regionAt(p.x,p.z,p.y,1.3);return c?.r.room||null;},
  exitAt(p){const c=regionAt(p.x,p.z,p.y,.6);return c?.r.exit||null;},
  colliders(y){return walls.filter(c=>y+3>c.y0&&y-1<c.y1);},
  // collide-and-slide inside walkable regions; returns the new position (x,z,y)
  move(pos,dx,dz,rad=.38){
   const out={x:pos.x,z:pos.z,y:pos.y};
   const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
   for(let i=0;i<steps;i++){
    let c=walkable(out.x+dx/steps,out.z,out.y,rad);if(c){out.x+=dx/steps;out.y=c.h;}
    c=walkable(out.x,out.z+dz/steps,out.y,rad);if(c){out.z+=dz/steps;out.y=c.h;}
   }
   return out;
  },
  slotNear(p,range=3){for(const s of slots){if(Math.abs(s.y-p.y)>3)continue;if(Math.hypot(s.door.x-p.x,s.door.z-p.z)<range)return s;}return null;},
  slotById(id){return slots.find(s=>s.id===id);},
  // where to put the player when arriving at a room from the map
  doorstep(id){const s=slots.find(x=>x.id===id);if(!s)return null;const [dx,dz]=rot2(0,22.5,s.ry);return {pos:new T.Vector3(s.center.x+dx,s.y,s.center.z+dz),yaw:Math.atan2(-dx,-dz)};},
  // rotate riders standing on a turning platform
  update(dt,time,player,camera,{onTurn,onRide}={}){
   const band=bandOf(player.y,player.x,player.z);
   // visibility: your floor, the tower, and the entrance hall around the ground floor
   for(const [k,g] of Object.entries(bands))g.visible=k===band||k==='T'||(k==='G'&&(band==='D'||band==='T'))||(band==='T'&&k!=='D')||(band==='G'&&k==='D'&&player.x>12);
   // rooms on your floor stream in around their doors
   for(const s of slots){
    const near=Math.abs(s.y-player.y)<3.5&&Math.hypot(s.door.x-player.x,s.door.z-player.z)<26;
    const far=Math.abs(s.y-player.y)>3.5||Math.hypot(s.door.x-player.x,s.door.z-player.z)>44;
    if(near&&!s.loaded)loadRoom(s);else if(far&&s.loaded&&api.roomAt(player)!==s.id)unloadRoom(s);
    if(s.loaded){s.loaded.holder.visible=Math.abs(s.y-player.y)<3.5;s.loaded.room.update(time);s.loaded.identity.update(time);s.loaded.props.update(time);}
   }
   // turning platforms
   for(const p of platforms){
    p.timer-=dt;
    if(!p.moving&&p.timer<=0){
     const riding=api.regionAt(player.x,player.z,player.y,.6)?.r.plat===p;
     if(!riding||Math.random()<.5){p.moving=true;p.from=p.piv.rotation.y;p.index=(p.index+1)%p.dirs.length;p.to=p.dirs[p.index];p.t=0;onTurn?.(p);}
     else p.timer=4;
    }
    if(p.moving){
     const riding=api.regionAt(player.x,player.z,player.y,.6)?.r.plat===p;
     const before=p.piv.rotation.y;p.t=Math.min(1,p.t+dt/4.5);const k=p.t*p.t*(3-2*p.t);
     let d=p.to-p.from;d=Math.atan2(Math.sin(d),Math.cos(d));p.piv.rotation.y=p.from+d*k;
     if(p.t>=1){p.moving=false;p.timer=18+Math.random()*16;p.piv.rotation.y=p.to;}
     const delta=p.piv.rotation.y-before;
     if(riding&&delta){const [x,z]=rot2(player.x,player.z,delta);player.x=x;player.z=z;onRide?.(delta);}
    }
   }
   // flames, portraits, armour, candles, hourglasses
   for(const a of animated){
    if(a.kind==='flame'){a.mesh.scale.set(1+Math.sin(time*13+a.phase)*.12,1+Math.sin(time*9.7+a.phase)*.18,1);}
    else if(a.kind==='page'){a.mesh.position.y=a.base+Math.sin(time*1.6+a.base)*.08;a.mesh.rotation.y=time*.8;}
    else if(a.kind==='portrait'){const u=(Math.sin(time*a.speed+a.phase)+1)/2;a.fig.position.x=(u-.5)*a.w*.45;a.fig.scale.x=Math.cos(time*a.speed+a.phase)>0?1:-1;}
    else if(a.kind==='armour'){
     if(!a.root.visible||!a.root.parent?.visible)continue;
     a.root.getWorldPosition(_p);const dx=player.x-_p.x,dz=player.z-_p.z,dist=Math.hypot(dx,dz);
     let want=0;if(dist<5.5&&Math.abs(player.y-_p.y)<2){want=Math.atan2(dx,dz)-a.base;want=Math.atan2(Math.sin(want),Math.cos(want));want=T.MathUtils.clamp(want,-1.1,1.1);}
     a.turn+= (want-a.turn)*(1-Math.exp(-3*dt));a.head.rotation.y=a.turn;
    }else if(a.kind==='candles'){
     if(!a.inst.parent?.visible)continue;const m=new T.Matrix4();
     a.data.forEach((c,i)=>{const y=c.p.y+Math.sin(time*.7+c.ph)*.08;m.makeTranslation(c.p.x,y,c.p.z);a.inst.setMatrixAt(i,m);m.makeTranslation(c.p.x,y+.2,c.p.z);a.fl.setMatrixAt(i,m);});
     a.inst.instanceMatrix.needsUpdate=true;a.fl.instanceMatrix.needsUpdate=true;
    }
   }
   const pxScale=(typeof innerHeight==='number'?innerHeight:720)*.5*(typeof devicePixelRatio==='number'?Math.min(2,devicePixelRatio):1);
   for(const m of shaftMats)m.uniforms.time.value=time;
   for(const m of haloMats){m.uniforms.time.value=time;m.uniforms.scale.value=pxScale;}
   dustMat.uniforms.time.value=time;dustMat.uniforms.center.value.set(player.x,player.y+2.2,player.z);dustMat.uniforms.scale.value=pxScale;
   for(const h of hourglasses){const k=.5+.5*Math.sin(time*.05+h.level*9);h.lower.scale.y=.25+h.level*1.6;h.lower.position.y=.55+h.lower.scale.y/2;h.upper.scale.y=Math.max(.05,1-h.level)*.9;h.upper.position.y=3.8-h.upper.scale.y/2;}
   // nearest light anchors get the real lights (fixed count, no shader recompiles)
   lightTimer-=dt;
   if(lightTimer<=0){
    lightTimer=.25;const cam=camera.position;
    const list=anchors.filter(a=>a.intensity>0&&Math.abs(a.pos.y-player.y)<9).map(a=>({a,d:a.pos.distanceToSquared(cam)})).sort((x,y)=>x.d-y.d).slice(0,POOL).map(x=>x.a);
    for(const slot of pool){if(slot.anchor&&!list.includes(slot.anchor))slot.anchor=null;}
    for(const a of list){if(pool.some(s=>s.anchor===a))continue;const free=pool.find(s=>!s.anchor);if(free){free.anchor=a;free.w=0;}}
   }
   for(const s of pool){
    const a=s.anchor,L=s.light;
    s.w=Math.min(1,s.w+dt*2);
    if(!a){L.intensity=Math.max(0,L.intensity-dt*30);continue;}
    L.position.copy(a.pos);L.color.set(a.color);L.distance=a.distance;
    if(a.dousedUntil&&time>a.dousedUntil){a.dousedUntil=0;a.flame.visible=true;setHalo(a,1);}
    L.intensity=a.dousedUntil?0:a.intensity*s.w*(a.flicker?(.88+.12*Math.sin(time*11+a.pos.x)+.05*Math.sin(time*23)):1);
   }
  },
  unloadAll(){for(const s of slots)unloadRoom(s);},
  setHouseLevels(levels){hourglasses.forEach((h,i)=>h.level=T.MathUtils.clamp(levels[i]??h.level,0,1));},
  dispose(){for(const s of slots)unloadRoom(s);for(const d of disposables)d.dispose?.();},
  onRoomLoaded:null,onRoomUnloaded:null,
 };
 return api;
}
