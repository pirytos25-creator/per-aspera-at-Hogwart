import * as T from '../assets/three.module.js';
import {mergeGeometries} from '../assets/addons/utils/BufferGeometryUtils.js';

/** Close-range courtyard details, batched into a small number of draw calls.
 * The atlas geometry stays untouched. Every owned GPU resource is released.
 */
export function createAtmosphere(scene,world,renderer){
  const root=new T.Group();root.name='Hogwarts RPG · courtyard atmosphere';scene.add(root);
  const courtyard=new T.Group(),landscape=new T.Group();root.add(courtyard,landscape);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const ownG=g=>(geometries.add(g),g),ownM=m=>(materials.add(m),m);
  const time={value:0};let quality='high',zone='courtyard',day=0,disposed=false;
  const gold=ownM(new T.MeshStandardMaterial({color:'#8f7950',metalness:.65,roughness:.52}));
  const iron=ownM(new T.MeshStandardMaterial({color:'#354449',metalness:.8,roughness:.46}));
  const warmGlass=ownM(new T.MeshStandardMaterial({color:'#bda26b',emissive:'#ffb94f',emissiveIntensity:1.25,metalness:.12,roughness:.4}));
  const batches=new Map(),matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
  function put(geometry,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
    p.set(x,y,z);q.setFromEuler(new T.Euler(rx,ry,rz));s.set(sx,sy,sz);matrix.compose(p,q,s);
    const copy=geometry.clone().applyMatrix4(matrix);if(!batches.has(material))batches.set(material,[]);batches.get(material).push(copy);
  }
  const tube=new T.CylinderGeometry(1,1,1,8),cube=new T.BoxGeometry(1,1,1),ringG=new T.TorusGeometry(1,.009,5,96);
  function beam(a,b,r,material){const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);p.copy(start).lerp(end,.5);q.setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize());s.set(r,dir.length(),r);matrix.compose(p,q,s);const g=tube.clone().applyMatrix4(matrix);if(!batches.has(material))batches.set(material,[]);batches.get(material).push(g);}

  // Inlaid brass rings and a compass rose sit almost flush with the stone.
  for(const r of [4.57,4.73])put(ringG,gold,23,26.425,31,r,r,1,Math.PI/2);
  for(let i=0;i<32;i++){const a=i*Math.PI/16,r0=i%4?4.58:4.5,r1=i%4?4.72:4.8;beam([23+Math.sin(a)*r0,26.43,31+Math.cos(a)*r0],[23+Math.sin(a)*r1,26.43,31+Math.cos(a)*r1],.009,gold);}
  for(const r of [1.58,1.72])put(ringG,gold,22.7,26.425,38.4,r,r,1,Math.PI/2);
  const starVertices=[];
  for(let i=0;i<8;i++){const a=i*Math.PI/4,length=i%2?1.04:1.47;const center=[22.7,26.432,38.4],tip=[center[0]+Math.sin(a)*length,center[1],center[2]+Math.cos(a)*length];const left=[center[0]+Math.sin(a+.55)*.32,center[1],center[2]+Math.cos(a+.55)*.32],right=[center[0]+Math.sin(a-.55)*.32,center[1],center[2]+Math.cos(a-.55)*.32];starVertices.push(...center,...tip,...left,...center,...right,...tip);}
  const starG=new T.BufferGeometry();starG.setAttribute('position',new T.Float32BufferAttribute(starVertices,3));starG.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(starVertices.length/3*2),2));starG.setIndex(Array.from({length:starVertices.length/3},(_,i)=>i));starG.computeVertexNormals();put(starG,gold,0,0,0);starG.dispose();

  // Lanterns remain against the walls and never obstruct a playable doorway.
  const lanterns=[[12.2,27.7,21.5],[32.8,27.7,20],[12.2,27.7,38],[32.8,27.7,39.4]];
  for(const [x,y,z]of lanterns){
    put(tube,iron,x,y,z,.045,2.5,.045);put(tube,iron,x,y-1.21,z,.19,.09,.19);
    put(cube,iron,x,y+1.55,z,.48,.07,.48);put(cube,iron,x,y+2.1,z,.55,.07,.55);
    put(cube,warmGlass,x,y+1.82,z,.29,.45,.29);
    for(const sx of [-1,1])for(const sz of [-1,1])beam([x+sx*.2,y+1.55,z+sz*.2],[x+sx*.2,y+2.12,z+sz*.2],.022,iron);
    const roof=new T.ConeGeometry(.42,.35,4);put(roof,iron,x,y+2.29,z,1,1,1,0,Math.PI/4);roof.dispose();
    put(tube,gold,x,y+2.51,z,.04,.17,.04);
  }
  for(const [mat,list]of batches){const geometry=ownG(mergeGeometries(list));list.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,mat);mesh.receiveShadow=true;mesh.castShadow=false;courtyard.add(mesh);}
  tube.dispose();cube.dispose();ringG.dispose();

  const waterMat=ownM(new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{uTime:time,uNight:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uNight;void main(){vec2 p=vUv-.5;float r=length(p);float ripple=sin(r*82.-uTime*3.5)*.5+.5;float ripple2=sin((p.x+p.y)*91.+uTime*1.6)*.5+.5;float foam=smoothstep(.8,1.,ripple*ripple2)*.36;vec3 col=mix(vec3(.20,.39,.41),vec3(.42,.62,.61),ripple*.18+foam);col=mix(col,col*.45,uNight);gl_FragColor=vec4(col,.86);}` }));
  const pool=new T.Mesh(ownG(new T.CircleGeometry(3.72,80)),waterMat);pool.rotation.x=-Math.PI/2;pool.position.set(23,27.475,31);pool.userData.skipAO=true;courtyard.add(pool);
  const streamGeometries=[],curves=[];
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6+.13,points=[];
    for(let j=0;j<=16;j++){const t=j/16,r=1.62+t*1.45,y=29.4+t*.25-t*t*2.08;points.push(new T.Vector3(23+Math.sin(a)*r,y,31+Math.cos(a)*r));}
    const curve=new T.CatmullRomCurve3(points);curves.push(curve);streamGeometries.push(new T.TubeGeometry(curve,20,.027,5,false));
  }
  const streamMat=ownM(new T.MeshPhysicalMaterial({color:'#b8d9d6',metalness:0,roughness:.08,transparent:true,opacity:.35,depthWrite:false,clearcoat:1,clearcoatRoughness:.04}));
  const streams=new T.Mesh(ownG(mergeGeometries(streamGeometries)),streamMat);streams.userData.skipAO=true;courtyard.add(streams);streamGeometries.forEach(g=>g.dispose());
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const gctx=glowCanvas.getContext('2d'),grad=gctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'#fff');grad.addColorStop(.12,'#ffffffeb');grad.addColorStop(.45,'#ffffff35');grad.addColorStop(1,'#ffffff00');gctx.fillStyle=grad;gctx.fillRect(0,0,64,64);const glow=new T.CanvasTexture(glowCanvas);textures.add(glow);
  const dropCount=240,dropData=new Float32Array(dropCount*3),dropG=ownG(new T.BufferGeometry());dropG.setAttribute('position',new T.BufferAttribute(dropData,3));const drops=new T.Points(dropG,ownM(new T.PointsMaterial({color:'#cee2d8',map:glow,size:.075,transparent:true,opacity:.66,depthWrite:false,blending:T.AdditiveBlending})));drops.frustumCulled=false;drops.userData.skipAO=true;courtyard.add(drops);

  // One additive flame batch: four slender billboards at the lantern cores.
  const flames=new T.InstancedMesh(ownG(new T.PlaneGeometry(.34,.7)),ownM(new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{uTime:time},vertexShader:`uniform float uTime;varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vSeed=instanceMatrix[3].x;vec3 p=position;p.x+=sin(uTime*8.+vSeed+uv.y*5.)*uv.y*.025;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`uniform float uTime;varying vec2 vUv;varying float vSeed;void main(){float x=(vUv.x-.5)*2.;float y=vUv.y;float width=.75*(1.-y)+.02;float edge=1.-smoothstep(width*.2,width,abs(x+.07*sin(y*12.-uTime*6.+vSeed)));float alpha=edge*smoothstep(0.,.12,y)*(1.-smoothstep(.65,1.,y));vec3 col=mix(vec3(2.1,.50,.07),vec3(2.4,1.8,.62),edge*(1.-y));gl_FragColor=vec4(col,alpha*.6);}` })),8);
  lanterns.forEach(([x,y,z],i)=>{for(let side=0;side<2;side++){p.set(x,y+1.84,z);q.setFromEuler(new T.Euler(0,side*Math.PI/2,0));matrix.compose(p,q,new T.Vector3(1,1,1));flames.setMatrixAt(i*2+side,matrix);}});flames.userData.skipAO=true;courtyard.add(flames);
  const glowPositions=[];lanterns.forEach(([x,y,z])=>glowPositions.push(x,y+1.8,z));const haloG=ownG(new T.BufferGeometry());haloG.setAttribute('position',new T.Float32BufferAttribute(glowPositions,3));const halos=new T.Points(haloG,ownM(new T.PointsMaterial({map:glow,color:'#ffd18a',size:1.4,transparent:true,opacity:.24,depthWrite:false,blending:T.AdditiveBlending})));halos.userData.skipAO=true;courtyard.add(halos);
  const lights=lanterns.slice(0,2).map(([x,y,z])=>{const light=new T.PointLight('#ffc780',6,11,2);light.position.set(x,y+1.8,z);courtyard.add(light);return light;});

  const moteCount=160,moteData=new Float32Array(moteCount*3),moteBases=[];let seed=8951;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let i=0;i<moteCount;i++)moteBases.push([12+rand()*21,27+rand()*7,17+rand()*25,rand()*6.28]);
  const moteG=ownG(new T.BufferGeometry());moteG.setAttribute('position',new T.BufferAttribute(moteData,3));const motes=new T.Points(moteG,ownM(new T.PointsMaterial({map:glow,color:'#e1d4aa',size:.055,transparent:true,opacity:.38,depthWrite:false,blending:T.AdditiveBlending})));motes.frustumCulled=false;motes.userData.skipAO=true;courtyard.add(motes);

  // Distant birds are one animated instanced mesh, not separate wing objects.
  const birdG=ownG(new T.BufferGeometry());birdG.setAttribute('position',new T.Float32BufferAttribute([0,0,.3,-1,.08,-.05,-.32,0,.12,0,0,.3,.32,0,.12,1,.08,-.05,0,0,.3,-.1,.02,-.25,.1,.02,-.25],3));birdG.computeVertexNormals();
  const birdMat=ownM(new T.MeshBasicMaterial({color:'#26353b',side:T.DoubleSide}));birdMat.onBeforeCompile=shader=>{shader.uniforms.uBirdTime=time;shader.vertexShader='uniform float uBirdTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=abs(position.x)*sin(uBirdTime*4.+instanceMatrix[3].x)*.47;');};birdMat.customProgramCacheKey=()=> 'rpg-bird-flight';
  const birds=new T.InstancedMesh(birdG,birdMat,10);birds.frustumCulled=false;landscape.add(birds);

  function refreshVisibility(){const outside=zone!=='room';root.visible=outside;courtyard.visible=outside&&(zone==='courtyard');landscape.visible=outside;motes.visible=quality!=='balanced';streams.visible=quality!=='balanced';dropG.setDrawRange(0,quality==='ultra'?240:quality==='high'?156:72);moteG.setDrawRange(0,quality==='ultra'?160:100);lights.forEach(l=>l.visible=quality==='ultra');halos.material.opacity=day===1?.38:.17;waterMat.uniforms.uNight.value=day===1?1:0;}
  function update(dt,t,playerPos){if(disposed)return;time.value=Number.isFinite(t)?t:0;if(!root.visible)return;
    if(courtyard.visible){const point=new T.Vector3();for(let i=0;i<dropCount;i++){const u=(i*.053+time.value*.55)%1,curve=curves[i%12];curve.getPoint(u,point);point.x+=Math.sin(i*2.4)*.035;point.z+=Math.cos(i*2.4)*.035;dropData.set(point.toArray(),i*3);}dropG.attributes.position.needsUpdate=true;for(let i=0;i<moteCount;i++){const [x,y,z,phase]=moteBases[i];moteData.set([x+Math.sin(time.value*.15+phase)*.4,y+Math.sin(time.value*.23+phase)*.3,z+Math.cos(time.value*.14+phase)*.35],i*3);}moteG.attributes.position.needsUpdate=true;lights.forEach((l,i)=>{l.intensity=(day===1?13:5)*(1+Math.sin(time.value*9+i)*.045+Math.sin(time.value*17+i)*.035);});}
    for(let i=0;i<10;i++){const a=time.value*(.035+i*.002)+i*.7,r=40+i*4;p.set(Math.sin(a)*r,78+Math.sin(a*1.7)*4+i*.6,Math.cos(a)*r-20);q.setFromEuler(new T.Euler(0,-a+Math.PI/2,.08));s.setScalar(.7+(i%3)*.1);matrix.compose(p,q,s);birds.setMatrixAt(i,matrix);}birds.instanceMatrix.needsUpdate=true;
  }
  refreshVisibility();update(0,0);
  return{update,setZone(next,roomId){zone=roomId?'room':next;refreshVisibility();},setTime(index){day=index;refreshVisibility();},setQuality(next){quality=next;refreshVisibility();},dispose(){if(disposed)return;disposed=true;scene.remove(root);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());flames.dispose();birds.dispose();}};
}
