import * as THREE from '../assets/three.module.js';

// These additions belong to the RPG only. All ornaments are above head height,
// or recessed against the back wall: no new collision obstacles in the aisles.
// Geometry is baked by material, including per-vertex colour, to keep each room
// under twenty extra draws without sharing disposable resources between rooms.
const TAU = Math.PI * 2;
const PAL = { brass:'#c5a363', copper:'#a86e47', silver:'#b7c9cd', ivory:'#ddd5b9',
  ink:'#17232c', wood:'#4b3027', green:'#557a47', leaf:'#82a966', blue:'#47708a',
  red:'#923e3e', purple:'#765774', stone:'#737b73', light:'#b3e8ec' };

export function createRoomIdentity(roomInfo = {}) {
  const id = roomInfo.id || '', group = new THREE.Group();
  group.name = `room-identity-${id}`;
  const accent = roomInfo.color || '#b7a071';
  const materials = [
    new THREE.MeshStandardMaterial({vertexColors:true, roughness:.8}),
    new THREE.MeshStandardMaterial({vertexColors:true, metalness:.7, roughness:.3}),
    new THREE.MeshStandardMaterial({vertexColors:true, emissive:'#ffffff', emissiveIntensity:.55, roughness:.45}),
    new THREE.MeshStandardMaterial({vertexColors:true, transparent:true, opacity:.28, roughness:.15, metalness:.25, depthWrite:false}),
  ];
  const units = {
    box:new THREE.BoxGeometry(1,1,1), ball:new THREE.SphereGeometry(1,16,10),
    rod:new THREE.CylinderGeometry(1,1,1,10), cone:new THREE.ConeGeometry(1,1,16),
    ring:new THREE.TorusGeometry(1,.04,6,40), crystal:new THREE.OctahedronGeometry(1),
  };
  const stores = new Map(), geometries = [], motions = [];
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const euler = new THREE.Euler(), quaternion = new THREE.Quaternion(), colour = new THREE.Color();
  const direction = new THREE.Vector3(), up = new THREE.Vector3(0,1,0);
  let target = group, disposed = false;
  function add(shape, color, x,y,z,sx=1,sy=sx,sz=sx, rx=0,ry=0,rz=0, material=0) {
    const geometry = units[shape].clone();
    position.set(x,y,z);scale.set(sx,sy,sz);euler.set(rx,ry,rz);quaternion.setFromEuler(euler);
    geometry.applyMatrix4(matrix.compose(position,quaternion,scale));
    let buckets=stores.get(target);if(!buckets){buckets=new Map();stores.set(target,buckets);}
    if(!buckets.has(material))buckets.set(material,[]);
    buckets.get(material).push({geometry,color});
  }
  const box=(c,x,y,z,w,h,d,ry=0,m=0)=>add('box',c,x,y,z,w,h,d,0,ry,0,m);
  const ball=(c,x,y,z,r,sx=1,sy=1,sz=1,m=0)=>add('ball',c,x,y,z,r*sx,r*sy,r*sz,0,0,0,m);
  const rod=(c,x,y,z,r,h,rx=0,rz=0,m=1)=>add('rod',c,x,y,z,r,h,r,rx,0,rz,m);
  const ring=(c,x,y,z,r,rx=0,ry=0,m=1)=>add('ring',c,x,y,z,r,r,r,rx,ry,0,m);
  const cone=(c,x,y,z,r,h,rx=0,rz=0,m=0)=>add('cone',c,x,y,z,r,h,r,rx,0,rz,m);
  function beam(c,a,b,r=.05,m=1){
    direction.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const len=direction.length();if(len<.0001)return;
    quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/len));euler.setFromQuaternion(quaternion);
    add('rod',c,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,len,r,euler.x,euler.y,euler.z,m);
  }
  function path(c,points,r=.05,m=1){for(let i=1;i<points.length;i++)beam(c,points[i-1],points[i],r,m);}
  function motion(name,x,y,z,speed=.2,bob=0,axis='y'){
    const g=new THREE.Group();g.name=name;g.position.set(x,y,z);group.add(g);
    motions.push({group:g,y,speed,bob,axis});target=g;return g;
  }
  function fixed(){target=group;}
  function frame(x,y,z,w,h,c=PAL.brass){
    box(PAL.ink,x,y,z,w,h,.12);for(const side of [-1,1]){
      box(c,x+side*w/2,y,z+.1,.13,h+.2,.15,0,1);
      box(c,x,y+side*h/2,z+.1,w+.15,.13,.15,0,1);
    }
  }
  function book(x,y,z,s=1,c=accent,angle=0){
    box(c,x,y,z,.85*s,1.2*s,.22*s,angle);box(PAL.ivory,x,y,z+.035,.72*s,1.07*s,.2*s,angle);
    box(c,x,y,z+.15,.85*s,1.2*s,.07*s,angle);box(PAL.brass,x,y+.32*s,z+.2,.5*s,.035*s,.025*s,angle,1);
  }
  function bottle(x,y,z,s=1,c=accent){
    ball(c,x,y,z,.28*s,1,1.2,1,3);rod(c,x,y+.34*s,z,.1*s,.3*s,0,0,3);
    rod(PAL.wood,x,y+.52*s,z,.12*s,.1*s,0,0,0);ball(c,x,y-.08*s,z,.22*s,1,.8,1,2);
  }
  function feather(x,y,z,s=1,angle=0,c=PAL.ivory){
    const dx=Math.sin(angle)*s,dy=Math.cos(angle)*s;
    beam(PAL.brass,[x-dx,y-dy,z],[x+dx,y+dy,z],.018*s);
    for(let j=-4;j<=4;j++){
      const t=j/5,w=(1-t*t)*s*.34;
      beam(c,[x+dx*t,y+dy*t,z],[x+dx*t+dy*w/s,y+dy*t-dx*w/s+.13*s,z],.035*s,0);
      beam(c,[x+dx*t,y+dy*t,z],[x+dx*t-dy*w/s,y+dy*t+dx*w/s+.13*s,z],.035*s,0);
    }
  }
  function vine(x,y,z,len=4,c=PAL.green){
    const pts=[];for(let i=0;i<=12;i++){
      const t=i/12,px=x+Math.sin(t*8)*.23,py=y-len*t,pz=z+Math.cos(t*5)*.18;pts.push([px,py,pz]);
      if(i%2===0){ball(c,px+(i%4?.3:-.3),py,pz,.22,1.8,.55,1);ball(PAL.leaf,px,py+.2,pz+.1,.16,.6,1.5,.5);}
    }path(PAL.green,pts,.035,0);
  }
  function owl(x,y,z,s=1){
    ball(PAL.ivory,x,y,z,.35*s,1,1.4,1);ball(PAL.ivory,x,y+.4*s,z,.28*s);
    for(const a of [-1,1]){ball(PAL.ink,x+a*.12*s,y+.43*s,z+.24*s,.085*s);ball(PAL.brass,x+a*.12*s,y+.43*s,z+.3*s,.045*s,1,1,1,1);}
    cone(PAL.copper,x,y+.31*s,z+.3*s,.06*s,.16*s,Math.PI/2);
    ball(PAL.stone,x-.28*s,y-.05*s,z,.2*s,.5,1.8,.8);ball(PAL.stone,x+.28*s,y-.05*s,z,.2*s,.5,1.8,.8);
  }
  function hourglass(x,y,z,c){
    for(const a of [-1,1]){rod(PAL.brass,x,y+a*1.35,z,.8,.12);cone(c,x,y+a*.66,z,.6,1.3,a>0?0:Math.PI,0,3);}
    for(let a=0;a<TAU;a+=TAU/4)rod(PAL.brass,x+Math.sin(a)*.72,y,z+Math.cos(a)*.72,.045,2.8);
    cone(c,x,y-.9,z,.45,.85);rod(c,x,y-.25,z,.025,1.2,0,0,2);
  }
  function skull(x,y,z,s=1,c=PAL.ivory){
    ball(c,x,y,z,.45*s,1,1.15,1);ball(c,x,y-.28*s,z+.22*s,.3*s,1,.5,1);
    for(const side of [-1,1])ball(PAL.ink,x+side*.19*s,y+.04*s,z+.36*s,.14*s,1,1,.4);
    cone(PAL.ink,x,y-.1*s,z+.42*s,.08*s,.16*s,0,0,0);
  }
  function star(x,y,z,s=.2,c=PAL.light){
    for(let i=0;i<3;i++){const a=i*Math.PI/3;beam(c,[x-Math.sin(a)*s,y-Math.cos(a)*s,z],[x+Math.sin(a)*s,y+Math.cos(a)*s,z],s*.065,2);}
  }
  function constellation(x,y,z,variant=0){
    const pts=[];for(let j=0;j<7;j++){const px=x+(j-3)*.58,py=y+Math.sin(j*1.7+variant)*.72;pts.push([px,py,z]);star(px,py,z,.12);}
    path(PAL.blue,pts,.018,2);
  }
  function banner(x,y,z,c,symbol='diamond'){
    box(c,x,y,z,2.4,3.5,.06);cone(c,x,y-1.8,z,1.2,1.2,0,Math.PI,0);
    rod(PAL.brass,x,y+1.8,z,.06,2.8,0,Math.PI/2);
    ring(PAL.brass,x,y+.1,z+.12,.65);
    if(symbol==='diamond')add('crystal',PAL.ivory,x,y+.1,z+.12,.3,.5,.08);
    else if(symbol==='sun')star(x,y+.1,z+.15,.46,PAL.brass);
    else for(const s of [-1,1])beam(PAL.ivory,[x-s*.4,y-.2,z+.15],[x+s*.4,y+.4,z+.15],.06);
  }
  function cabinet(x,y,z,w=3,h=3){
    frame(x,y,z,w,h,PAL.wood);for(const d of [-.7,.7])box(PAL.wood,x,y+d,z+.2,w,.1,.65);
  }

  switch(id){
    case 'great-hall':
      [-8.5,-2.8,2.8,8.5].forEach((x,i)=>hourglass(x,7.3,-16,['#af4640','#b8a04d','#5279ae','#43836d'][i]));
      for(let i=0;i<5;i++)constellation((i-2)*4.7,14+Math.sin(i),-11,i);
      break;
    case 'transfiguration':
      frame(-8,6,-16.8,6.5,4.4);frame(8,6,-16.8,6.5,4.4);
      // A cat silhouette faces a silver bird: the room's teaching specimens.
      ball(PAL.copper,-8,5.7,-16.4,.9,1.2,.8,.3);ball(PAL.copper,-7.3,6.5,-16.4,.5);
      for(const x of [-7.65,-7])cone(PAL.copper,x,7,-16.4,.22,.6);
      path(PAL.copper,[[-8.8,5.8,-16.4],[-9.5,6.2,-16.4],[-9.7,7,-16.4],[-9.2,7.3,-16.4]],.16,0);
      for(const s of [-1,1])for(let i=0;i<5;i++)feather(8+s*(.3+i*.27),6.2-i*.1,-16.4,.55,s*.85,PAL.silver);
      ball(PAL.silver,8,6.3,-16.4,.35,.7,1.8,.6,1);
      motion('suspended-needles',-6,6,-7,.15,.12);for(let i=0;i<8;i++)beam(PAL.silver,[Math.sin(i)*1.5,-.8,Math.cos(i)*1.5],[Math.sin(i)*1.5,.8,Math.cos(i)*1.5],.025);fixed();
      break;
    case 'charms':
      motion('levitating-quills',0,7,-7,.12,.25);for(let i=0;i<12;i++){const a=i*TAU/12;feather(Math.sin(a)*4,Math.cos(a*3)*.5,Math.cos(a)*2,.7,a*.5);}
      for(const r of [1.5,2.8,4])ring('#b5a5ce',0,0,0,r,Math.PI/2,0,2);fixed();
      break;
    case 'potions':
      for(const side of [-1,1]){cabinet(side*8,6.3,-16.7,5,4.8);for(let row=0;row<3;row++)for(let i=0;i<5;i++)bottle(side*8+(i-2)*.8,4.8+row*1.3,-16.1,.85,['#4b9c72','#9d8046','#7866a0'][row]);}
      path(PAL.copper,[[-10,9,-15],[-10,10,-15],[-5,10,-15],[-5,9,-15],[5,9,-15],[5,10,-15],[10,10,-15],[10,8,-15]],.13);
      break;
    case 'defence':
      motion('dragon-skeleton',0,9,-5,.02,.07);
      for(let i=0;i<13;i++){const z=i*.52-3;ball(PAL.ivory,0,Math.sin(i*.3)*.2,z,.22);if(i>1&&i<10)for(const s of [-1,1])path(PAL.ivory,[[0,0,z],[s*.7,-.3,z+.1],[s*1.1,-.9,z+.15],[s*.8,-1.4,z+.1]],.065,0);}
      skull(0,0,3.9,1.5);for(const s of [-1,1]){path(PAL.ivory,[[s*.2,0,-1],[s*1.8,.5,-1.2],[s*4.4,.1,-2]],.12,0);for(let i=0;i<4;i++)beam(PAL.ivory,[s*1.8,.5,-1.2],[s*(3.2+i*.5),-.1,1-i*1.1],.055,0);}fixed();
      break;
    case 'herbology':
      for(const side of [-1,1])for(let i=0;i<5;i++){const z=-11+i*4;rod(PAL.brass,side*10,9,z,.025,3);cone(PAL.copper,side*10,7.3,z,.65,.7,Math.PI);vine(side*10,7.4,z,3.7);for(let j=0;j<4;j++)ball('#b98bba',side*10+Math.sin(j)*.5,7.7,z+Math.cos(j)*.5,.24);}
      break;
    case 'divination':
      for(const side of [-1,1]){banner(side*10,7,-15.5,PAL.purple,'sun');for(let i=0;i<5;i++)ball('#5d3d5e',side*(12-i*.45),8-i*.32,-10+i*3,1,.35,2.2,.4);}
      motion('crystal-oracle',0,7.6,-10,.07,.12);ball('#a3c7dc',0,0,0,1.1,1,1,1,3);ring(PAL.brass,0,0,0,1.3,Math.PI/2);star(0,0,0,.4);fixed();
      for(let i=0;i<7;i++){ball(PAL.brass,(i-3)*1.3,10.6,-16.5,.4,1,1,.2,1);ball(PAL.ink,(i-3)*1.3+.25*Math.sin(i*.5),10.6,-16.35,.35,1,1,.2);}
      break;
    case 'astronomy-class':
      motion('planetary-orrery',0,8,-3,.1,0);ball('#f6c877',0,0,0,.72,1,1,1,2);
      for(let i=0;i<7;i++){const r=1.4+i*.5,a=i*1.9;ring(PAL.brass,0,0,0,r,Math.PI/2);ball([PAL.silver,PAL.copper,PAL.blue,PAL.red][i%4],Math.sin(a)*r,0,Math.cos(a)*r,.16+i*.035,1,1,1,1);}fixed();
      for(const s of [-1,1])constellation(s*7,5.7,-11,s);
      break;
    case 'history':
      for(let i=0;i<4;i++){const x=(i-1.5)*5.1;frame(x,7,-16.7,3.5,5);ball([PAL.red,PAL.green,PAL.blue,PAL.brass][i],x,6.2,-16.45,1,.9,1.2,.1);ball(PAL.ivory,x,7.7,-16.35,.5,1,1.3,.25);for(let j=0;j<=i;j++)star(x+(j-i*.5)*.42,4,-16.4,.11,PAL.brass);}
      beam(PAL.brass,[-10,3.5,-16.4],[10,3.5,-16.4],.04);
      break;
    case 'runes':
      for(let i=0;i<7;i++){const x=(i-3)*3.1;box(PAL.stone,x,6.6,-16.7,2.1,4.4,.45);const z=-16.4;beam(PAL.brass,[x,5.2,z],[x,8,z],.065);beam(PAL.brass,[x,7.8,z],[x+.7,7.1,z],.065);beam(PAL.brass,[x,6.5,z],[x+((i%2)*2-1)*.65,5.8,z],.065);if(i%3===0)beam(PAL.brass,[x-.7,7.2,z],[x,6.5,z],.065);}
      motion('runic-disc',-8,8,-7,.18,.08);for(let i=0;i<6;i++)add('crystal',accent,Math.sin(i)*1.2,Math.cos(i)*1.2,0,.14,.35,.14,0,0,i,2);fixed();
      break;
    case 'arithmancy':
      frame(0,8,-16.7,12,5);for(let row=0;row<4;row++){beam(PAL.brass,[-5,6.5+row,-16.4],[5,6.5+row,-16.4],.045);for(let j=0;j<8;j++)ball(j<row+2?accent:PAL.wood,-4+j*.7+(j<row+2?0:2),6.5+row,-16.4,.23,1,1,.55,1);}
      for(const side of [-1,1])for(let i=0;i<3;i++)add('crystal',PAL.brass,side*9,5+i*1.5,-15,.6,.6,.6,0,i*.4,0,1);
      break;
    case 'muggle-studies':
      cabinet(-7,6.5,-16.7,6,4);cabinet(7,6.5,-16.7,6,4);
      box(PAL.wood,-7,6,-16.2,3.3,2,.6);ring(PAL.brass,-7.6,6,-15.85,.6);for(let i=0;i<5;i++)box(PAL.brass,-6.2+i*.17,6,-15.8,.05,1.3,.04,0,1);
      for(const x of [5.5,8.5])ring(PAL.ink,x,6,-16,.9);path(PAL.copper,[[5.5,6,-16],[6.8,7.2,-16],[8.5,6,-16],[6.4,6,-16],[7.4,7.7,-16]],.08);
      for(let i=0;i<4;i++){beam(PAL.copper,[-5+i*3,9,-16],[-5+i*3,10,-16],.04);ball('#dbc584',-5+i*3,10,-16,.27,1,1.2,1,2);}
      break;
    case 'creatures':
      for(const s of [-1,1]){box(PAL.wood,s*8,5,-15,5,.25,1);for(let j=0;j<3;j++){ring(PAL.wood,s*8+(j-1)*1.2,5.7,-15,.4,Math.PI/2);add('crystal',PAL.ivory,s*8+(j-1)*1.2,5.6,-15,.3,.45,.3);}}
      for(const s of [-1,1])for(let i=0;i<8;i++)feather(s*(1+i*.43),8.1-i*.15,-15.7,1,s*.8,PAL.stone);
      skull(0,8.2,-15.6,1.2);cone(PAL.brass,0,7.8,-15,.25,1,Math.PI/2);
      break;
    case 'flying':
      for(let i=0;i<7;i++){const x=(i-3)*3.1;beam(PAL.wood,[x,4.5,-16.1],[x+.4,8,-16.1],.07,0);for(let j=-3;j<=3;j++)beam(PAL.copper,[x,4.8,-16.1],[x+j*.12,3.7,-16],.05,0);}
      motion('training-hoops',0,9,-6,.06,0);for(const x of [-5,0,5])ring(PAL.brass,x,0,0,1.5);ball(PAL.brass,0,0,0,.18,1,1,1,1);for(const s of [-1,1])feather(s*.45,0,0,.4,s*1.2);fixed();
      break;
    case 'alchemy':
      motion('alchemical-armillary',0,8,-8,.15,0);for(let i=0;i<3;i++)ring(PAL.brass,0,0,0,2.2,i*1.05,i*.8);add('crystal','#dc9e5e',0,0,0,.7,1,.7,0,0,0,2);fixed();
      for(const side of [-1,1]){frame(side*8,6.5,-16.7,5,4.5);beam(PAL.brass,[side*8-1.5,7.8,-16.4],[side*8+1.5,7.8,-16.4],.08);rod(PAL.brass,side*8,6.4,-16.4,.08,3);for(const d of [-1,1]){rod(PAL.brass,side*8+d*1.4,7,-16.4,.025,1.6);ring(PAL.brass,side*8+d*1.4,6.2,-16.4,.65,Math.PI/2);}}
      break;
    case 'apparition':
      for(const x of [-7,0,7]){ring(accent,x,7,-15.5,2.2,0,0,2);ring(PAL.silver,x,7,-15.55,2.5);for(let i=0;i<8;i++)star(x+Math.sin(i*TAU/8)*2.5,7+Math.cos(i*TAU/8)*2.5,-15.4,.13);}
      motion('apparition-compass',0,9,-5,-.12,0);for(let i=0;i<3;i++)ring(PAL.brass,0,0,0,1+i*.5,Math.PI/2,i);fixed();
      break;
    case 'library':
      motion('flying-reference-books',0,7,-7,.05,.13);for(let i=0;i<9;i++)book((i%3-1)*3,Math.floor(i/3)*.7-1,Math.sin(i)*2,.8,[PAL.red,PAL.green,PAL.blue][i%3],Math.sin(i)*.3);fixed();
      for(const s of [-1,1]){frame(s*9,9,-16.7,3,3);feather(s*9,9,-16.45,1,Math.PI/4);}
      break;
    case 'restricted':
      for(const x of [-8,-4,0,4,8]){book(x,6,-16,1.8,'#2c3c35');for(const d of [-.4,.4])beam(PAL.iron||PAL.silver,[x+d,4.9,-15.7],[x-d,7.1,-15.7],.045);ring(PAL.brass,x,6,-15.55,.22);}
      for(let i=0;i<15;i++)ring(PAL.silver,(i-7)*1.5,9-Math.sin(i/14*Math.PI),-15.8,.5,i%2*Math.PI/2);
      motion('sealed-emerald',0,9.5,-7,.25,.12);add('crystal','#5b9e86',0,0,0,.6,1.1,.6,0,0,0,2);fixed();
      break;
    case 'gryffindor':
      for(const x of [-9,9])banner(x,7,-16,PAL.red,'cross');
      frame(0,8,-16.6,7,4.6,PAL.brass);ball(PAL.brass,0,8.2,-16.1,1.25,1,1,.2,1);ball(PAL.copper,0,8,-15.9,.85,1,1,.3);for(let i=0;i<14;i++)cone(PAL.brass,Math.sin(i*TAU/14)*1.1,8+Math.cos(i*TAU/14)*1.1,-16,.23,.65,0,-i*TAU/14,1);
      for(const s of [-1,1])beam(PAL.silver,[s*2.1,6,-15.8],[-s*2.1,10,-15.8],.06);
      break;
    case 'slytherin':
      for(const x of [-9,9])banner(x,7,-16,'#245c49');
      for(const side of [-1,1]){const pts=[];for(let i=0;i<25;i++)pts.push([side*(2+Math.sin(i*.45)*1.2),5+i*.2,-16]);path(PAL.silver,pts,.16);ball(PAL.silver,side*(2+Math.sin(24*.45)*1.2),10,-16,.33,1,1.3,.7,1);}
      motion('lake-reflections',0,9,-7,.06,.1);for(let i=0;i<5;i++)ring('#67b8a1',0,0,0,1+i*.6,Math.PI/2,i*.2,2);fixed();
      break;
    case 'ravenclaw':
      for(const x of [-9,9])banner(x,7,-16,'#344f7c','sun');
      for(const s of [-1,1])for(let i=0;i<7;i++)feather(s*(.3+i*.4),8-i*.25,-16,1,s*.9,PAL.copper);
      ball(PAL.copper,0,8,-16,.65,.6,1.5,.5,1);constellation(0,11,-16,2);
      motion('celestial-ravenclaw',0,8,-7,.13,0);for(let i=0;i<3;i++)ring(PAL.copper,0,0,0,1.5,i*.9);fixed();
      break;
    case 'hufflepuff':
      for(const x of [-9,9])banner(x,7,-16,'#a78d37','sun');
      for(let i=0;i<6;i++){const x=(i-2.5)*2.8;ring(PAL.wood,x,7,-16.5,1.1);for(let j=0;j<5;j++)beam(PAL.wood,[x-.8+j*.4,6.3,-16.45],[x-.8+j*.4,7.7,-16.45],.12,0);vine(x,9.8,-16.1,4.8);}
      break;
    case 'headmaster':
      motion('silver-instruments',0,9,-8,.1,0);for(let i=0;i<4;i++){const x=(i-1.5)*2.3;ring(PAL.silver,x,0,0,.8,0,i*.5);ring(PAL.brass,x,0,0,.55,Math.PI/2);ball(PAL.light,x,0,0,.16,1,1,1,2);}fixed();
      rod(PAL.brass,-9,5.5,-15,.13,4);beam(PAL.brass,[-10,7.5,-15],[-8,7.5,-15],.12);
      ball('#9e4e35',-9,8,-15,.45,.8,1.4,.8);for(const s of [-1,1])for(let i=0;i<5;i++)feather(-9+s*(.2+i*.23),8-i*.1,-15,.7,s*.65,'#d08b43');
      break;
    case 'owlery':
      for(const side of [-1,1])for(let i=0;i<4;i++){const z=-8+i*4;beam(PAL.wood,[side*8,4.5,z],[side*11.8,4.5,z],.12,0);owl(side*10,5.3,z,.9);owl(side*8.8,5.1,z,.65);}
      for(let i=0;i<7;i++)box(PAL.ivory,(i-3)*.9,7+Math.sin(i)*.35,-10,.7,.4,.03,i*.1);
      break;
    case 'kitchens':
      for(let i=0;i<8;i++){const x=(i-3.5)*2.7;rod(PAL.ink,x,8.2,-13,.035,1.8);ball(PAL.copper,x,6.8,-13,.7,1,.4,1,1);ring(PAL.copper,x,7.3,-13,.65,Math.PI/2);ring(PAL.copper,x+.8,6.9,-13,.24,0,Math.PI/2);}
      beam(PAL.ink,[-11,9.1,-13],[11,9.1,-13],.09);for(let i=0;i<12;i++)vine(-11+(i%2)*.6,6.8,-10+Math.floor(i/2)*2,.9);
      break;
    case 'hospital':
      for(const side of [-1,1])for(let i=0;i<4;i++){const z=-10+i*5;beam(PAL.silver,[side*8,6.2,z],[side*12,6.2,z],.055);for(let j=0;j<8;j++)ball('#becbc6',side*(8+j*.5),4.7,z,.3,.9,4,.3);}
      frame(0,8,-16.7,4,3,PAL.silver);box(PAL.ivory,0,8,-16.45,.6,2,.08);box(PAL.ivory,0,8,-16.4,2,.6,.08);
      break;
    case 'prefects':
      frame(0,8,-16.7,9,6,PAL.brass);for(let i=0;i<7;i++)path('#5aa5af',[[-4,6+i*.55,-16.4],[-2,6.2+i*.55,-16.4],[0,6+i*.55,-16.4],[2,6.2+i*.55,-16.4],[4,6+i*.55,-16.4]],.035,2);
      ball(PAL.brass,0,9,-16.25,.35,1,1.3,.3,1);beam(PAL.brass,[0,8.6,-16.25],[0,7.5,-16.25],.25);path(PAL.brass,[[0,7.5,-16.25],[-.5,6.7,-16.25],[.3,6,-16.25],[1,6.2,-16.25]],.17);for(const s of [-1,1])feather(s*.55,8,-16.2,.7,s*1.1,PAL.brass);
      for(let i=0;i<12;i++)ball('#bbf5e8',Math.sin(i*2)*9,5.5+(i%4),-7+Math.cos(i*2)*5,.15+i%3*.1,1,1,1,3);
      break;
    case 'myrtle':
      for(const x of [-8,0,8]){frame(x,6.5,-16.7,4.8,4.5,PAL.stone);box('#9bbac0',x,6.5,-16.5,4.5,4.2,.03,0,3);path(PAL.ink,[[x-1.5,8.2,-16.3],[x-.5,7.1,-16.3],[x+.1,7.4,-16.3],[x+.4,6.1,-16.3],[x+1.4,4.5,-16.3]],.025,0);}
      motion('ghostly-teardrops',0,7,-9,0,.22);for(let i=0;i<9;i++)add('crystal','#a2cbd3',(i-4)*.7,Math.sin(i)*.8,0,.09,.3,.09,0,0,0,3);fixed();
      break;
    case 'requirement':
      for(const side of [-1,1]){for(let i=0;i<4;i++){const x=side*(6+i*1.5);book(x,4.8+i*.55,-16,.8+i*.2,[PAL.red,PAL.green,PAL.blue,PAL.wood][i],side*.2);ring(PAL.brass,x,7+i*.3,-16,.4+i*.15);}}
      motion('room-of-possibilities',0,8,-8,.14,.15);for(const s of [-1,1]){box(PAL.wood,s*1.2,0,0,1.4,2.8,.3,s*.5);ring(accent,s*1.2,0,.2,.5,0,0,2);}add('crystal',PAL.light,0,0,0,.4,.8,.4,0,0,0,2);fixed();
      break;
    case 'chamber':
      for(const side of [-1,1]){const pts=[];for(let i=0;i<32;i++)pts.push([side*(5+Math.sin(i*.3)*1.4),4.5+i*.22,-16]);path('#668578',pts,.42);ball('#829d87',side*(5+Math.sin(31*.3)*1.4),11.7,-16,.75,1,1.3,.9);ball('#b8d265',side*4.9,11.8,-15.3,.12,1,1,1,2);}
      ring(PAL.stone,0,8,-16.5,3.1);skull(0,8,-16,3,'#798d7c');
      break;
    case 'stairs':
      for(let i=0;i<6;i++){const x=(i%2?1:-1)*8,y=4+(i%3)*2.7;frame(x,y,-16.6,3.5,2.2,PAL.copper);ball([PAL.blue,PAL.purple,PAL.green][i%3],x,y-.2,-16.4,.65,1,.8,.15);ball(PAL.ivory,x,y+.45,-16.3,.3,1,1.2,.2);}
      motion('upper-moving-stair',0,10,-5,.035,0);for(let i=0;i<10;i++)box(PAL.stone,-4+i*.8,i*.18,0,.85,.18,1.6);for(const z of [-.8,.8])beam(PAL.brass,[-4,1,z],[3.2,2.62,z],.055);fixed();
      break;
    case 'entrance':
      for(let i=0;i<4;i++)banner((i-1.5)*5.4,8,-16,[PAL.red,PAL.green,PAL.blue,'#a99143'][i],i%2?'sun':'diamond');
      for(const side of [-1,1]){frame(side*10,5,-16.4,2,2,PAL.wood);for(let j=0;j<3;j++)box(PAL.brass,side*10,4.5+j*.45,-16.2,1.3,.12,.06,0,1);}
      break;
    case 'trophy':
      for(let row=0;row<2;row++)for(let i=0;i<7;i++){const x=(i-3)*3.2,y=5+row*3;rod(PAL.brass,x,y-.4,-16,.12,.8);ball(i%2?PAL.silver:PAL.brass,x,y+.3,-16,.55,1,.8,1,1);ring(PAL.brass,x,y+.65,-16,.55,Math.PI/2);for(const s of [-1,1])ring(PAL.brass,x+s*.65,y+.3,-16,.3);box(PAL.wood,x,y-.9,-16,1,.16,1);}
      for(const y of [4,7])box(PAL.wood,0,y,-16,23,.2,1.4);
      break;
    case 'duelling':
      for(const side of [-1,1]){banner(side*9,8,-16,side<0?'#693a54':'#3a5975','cross');for(let i=0;i<3;i++){ring(side<0?'#cf7187':'#81b8de',side*6,5+i*2,-16,.65,0,0,2);star(side*6,5+i*2,-16,.25);}}
      motion('crossed-duelling-wands',0,8,-9,.1,.08);for(const s of [-1,1])beam(PAL.wood,[-s*2,-1,0],[s*2,1,0],.07,0);star(-2,1,0,.3);star(2,1,0,.3);fixed();
      break;
    case 'repair':
      for(const x of [-8,8]){frame(x,6.7,-16.7,5,4);for(let j=0;j<5;j++){beam(PAL.silver,[x-1.6+j*.8,5.4,-16.3],[x-1.6+j*.8,7.8,-16.3],.055);box(PAL.wood,x-1.6+j*.8,5.4,-16.3,.22,.6,.15);}}
      motion('suspended-fragments',0,7.8,-7,.18,.08);for(let i=0;i<8;i++){const a=i*TAU/8;box(PAL.ivory,Math.sin(a)*1.6,Math.cos(a)*1.6,Math.sin(a*3)*.3,.65,.65,.15,a);beam('#c2d5ed',[0,0,0],[Math.sin(a)*1.3,Math.cos(a)*1.3,0],.015,2);}fixed();
      break;
    case 'patronus':
      motion('silver-stag',0,7,-8,.035,.18);ball(PAL.light,0,0,0,1,1.7,.7,.5,2);beam(PAL.light,[1,0,0],[1.5,1,0],.25,2);ball(PAL.light,1.7,1.2,0,.4,1.2,1,.65,2);for(const x of [-1,.9])for(const z of [-.35,.35])beam(PAL.light,[x,-.2,z],[x-.2,-1.8,z],.09,2);
      for(const z of [-.25,.25]){path(PAL.light,[[1.5,1.4,z],[1.2,2.2,z*2],[.5,2.9,z*3]],.055,2);for(let i=0;i<3;i++)beam(PAL.light,[1.1-i*.2,2.1+i*.25,z*(2+i*.3)],[1.4-i*.2,2.7+i*.25,z*(2+i*.5)],.035,2);}fixed();
      for(let i=0;i<16;i++)star(Math.sin(i*2.4)*9,6+Math.cos(i*1.8)*2,-13+Math.sin(i)*2,.12);
      break;
    case 'water':
      for(const s of [-1,1]){path(PAL.copper,[[s*11,3.5,-16],[s*11,8.5,-16],[s*7,8.5,-16],[s*7,6.5,-16]],.12);ring(PAL.brass,s*11,5,-15.7,.4);}
      for(let j=0;j<5;j++){const pts=[];for(let i=0;i<=30;i++)pts.push([-9+i*.6,6+j*.6+Math.sin(i*.3+j)*.4,-15.7]);path('#85b8cc',pts,.05,2);}
      motion('water-droplets',0,9,-8,.1,.18);for(let i=0;i<12;i++)ball('#8ec7d6',Math.sin(i)*2.5,Math.cos(i*2)*.4,Math.cos(i)*2,.12,1,1.6,1,3);fixed();
      break;
    case 'music':
      for(let i=0;i<17;i++){const x=(i-8)*1.1,h=2.5+Math.abs(i-8)*.4;rod(PAL.silver,x,7.3+h/2,-16.4,.24,h);ring(PAL.brass,x,7.3,-16.4,.27,Math.PI/2);}
      for(let y=0;y<5;y++)beam(PAL.brass,[-10,5+y*.3,-16],[10,5+y*.3,-16],.018);
      for(let i=0;i<8;i++){const x=(i-3.5)*2.1,y=5+(i%4)*.3;ball(PAL.ink,x,y,-15.9,.19,1.4,.7,.35);beam(PAL.ink,[x+.2,y,-15.9],[x+.2,y+1,-15.9],.03,0);}
      break;
    case 'snape-office':
      for(const x of [-9,-5,5,9]){cabinet(x,6.5,-16.7,3,5);for(let j=0;j<3;j++){bottle(x-.6,4.9+j*1.4,-16,1.1,'#7c9680');bottle(x+.6,4.9+j*1.4,-16,.8,'#6f7964');}}
      frame(0,8,-16.7,4,4,'#39483c');skull(0,8,-16.2,1.6,PAL.stone);for(const s of [-1,1])beam(PAL.ivory,[-s*1.5,6.3,-16.2],[s*1.5,9.5,-16.2],.08,0);
      break;
    case 'hidden-corridor':
      frame(0,8,-16.7,10,6,PAL.wood);for(const x of [-3,0,3]){ball(PAL.stone,x,8,-16,.95,1,1.1,.5);ball(PAL.ink,x,7.8,-15.6,.55,1,.55,.3);for(const s of [-1,1]){cone(PAL.stone,x+s*.65,9,-16,.35,.85);ball('#bd9957',x+s*.3,8.3,-15.5,.1,1,1,1,2);}}
      for(let i=0;i<10;i++)ring(PAL.silver,(i-4.5)*1.7,4.6-Math.sin(i/9*Math.PI)*.8,-15.9,.55,i%2*Math.PI/2);
      break;
  }

  // Bake each bucket into one non-indexed geometry. Static ornaments typically
  // need 2–4 draws; movable installations are batched independently.
  for(const [parent,buckets] of stores)for(const [material,parts] of buckets){
    let count=0;for(const part of parts){const g=part.geometry;if(g.index){const n=g.toNonIndexed();g.dispose();part.geometry=n;}count+=part.geometry.attributes.position.count;}
    const positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3);let offset=0;
    for(const {geometry,color} of parts){const p=geometry.attributes.position,n=geometry.attributes.normal;colour.set(color);positions.set(p.array,offset);normals.set(n.array,offset);for(let i=0;i<p.count;i++){const j=offset+i*3;colors[j]=colour.r;colors[j+1]=colour.g;colors[j+2]=colour.b;}offset+=p.count*3;geometry.dispose();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.push(geometry);
    const mesh=new THREE.Mesh(geometry,materials[material]);mesh.name=`${id}-ornaments-${material}`;mesh.castShadow=false;mesh.receiveShadow=material<2;parent.add(mesh);
  }
  stores.clear();for(const geometry of Object.values(units))geometry.dispose();
  group.userData.roomId=id;group.userData.drawCalls=geometries.length;
  return {
    group,
    update(time){if(disposed)return;for(const item of motions){item.group.rotation[item.axis]=time*item.speed;item.group.position.y=item.y+Math.sin(time*.8)*item.bob;}},
    dispose(){if(disposed)return;disposed=true;for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();group.removeFromParent();group.clear();motions.length=0;},
  };
}
