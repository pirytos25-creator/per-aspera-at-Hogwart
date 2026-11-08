import * as THREE from '../assets/three.module.js';
import {Water} from '../assets/addons/objects/Water.js';

// Photo-based CC0 surface sets, loaded locally. Geometry has procedural fallback maps.
export function enhanceEnvironment(world,renderer){
  const loader=new THREE.TextureLoader(),owned=[];
  const anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  function load(file,repeat,srgb=false){const texture=loader.load(new URL('../assets/textures/'+file,import.meta.url).href,()=>{renderer.shadowMap.needsUpdate=true});texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(...repeat);texture.anisotropy=anisotropy;if(srgb)texture.colorSpace=THREE.SRGBColorSpace;owned.push(texture);return texture}
  function surface(material,name,repeat,tint,normal=.5){if(!material)return;material.map=load(name+'.jpg',repeat,true);material.normalMap=load(name+'-normal.jpg',repeat);material.roughnessMap=load(name+'-rough.jpg',repeat);material.normalScale.set(normal,normal);material.bumpMap=null;material.color.set(tint);material.roughness=1;material.envMapIntensity=.25;material.needsUpdate=true}
  const m=world.materials||{};
  surface(m.stone,'stone',[1,1],'#c8c0aa',.55);surface(m.pale,'stone',[1,1],'#ded5bc',.4);
  surface(m.wood,'wood',[1,1],'#8b6e50',.3);surface(m.terrain,'ground',[16,16],'#a4b29b',.65);
  if(m.terrain){m.terrain.vertexColors=false;m.terrain.needsUpdate=true}
  surface(m.cliff,'ground',[.12,.12],'#969c99',.85);
  const normals=load('water-normal.jpg',[1,1]);
  const water=new Water(new THREE.PlaneGeometry(900,690,1,1),{textureWidth:1024,textureHeight:1024,waterNormals:normals,sunDirection:new THREE.Vector3(-.7,.5,.4).normalize(),sunColor:0xffdeac,waterColor:0x153a41,distortionScale:2.8,alpha:1,fog:true});
  water.rotation.x=-Math.PI/2;water.position.set(0,.7,398);water.userData.excludeAO=true;water.name='Czarne Jezioro — odbicia planarne';world.group.add(water);if(world.lake)world.lake.visible=false;
  let reflected=true,visible=true;
  // SSAO renders the scene with a normal override. Reflect only the lit beauty pass.
  const reflect=water.onBeforeRender;water.onBeforeRender=function(renderer,scene,camera,...rest){if(scene.overrideMaterial)return;reflect.call(this,renderer,scene,camera,...rest)};
  return {water,update(dt){water.material.uniforms.time.value+=dt*.42},setInterior(state){visible=!state;water.visible=visible&&reflected},setQuality(quality){reflected=quality!=='balanced';water.visible=visible&&reflected;if(world.lake)world.lake.visible=!reflected},setTime(index){const u=water.material.uniforms;u.sunColor.value.set(index===1?'#99bce5':index===2?'#ffe9c5':'#ffda9f');u.waterColor.value.set(index===1?'#071b2c':index===2?'#24555b':'#173e47');u.distortionScale.value=index===1?2:2.8},dispose(){owned.forEach(t=>t.dispose());water.geometry.dispose();water.material.dispose()}};
}
