import * as THREE from '../assets/three.module.js';

// An original, explorable interpretation of the film-era castle and grounds.
export function createWorld() {
  const group = new THREE.Group();
  const colliders=[];
  group.name = 'Hogwarts and the Scottish Highlands';
  let seed = 38471;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const clamp = THREE.MathUtils.clamp;
  const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t);};
  function groundHeight(x,z) {
    let h = 9 + 5*Math.sin(x*.014)*Math.cos(z*.017) + 3*Math.sin(x*.035+z*.021);
    h += 22*Math.exp(-((x+190)**2+(z+100)**2)/29000);
    h += 19*Math.exp(-((x-240)**2+(z+175)**2)/26000);
    const island = 1-smooth(70,132,Math.sqrt(x*x+z*z*1.17));
    h = h*(1-island)+26*island;
    h -= 14*Math.exp(-((x-110)**2/750+(z-40)**2/5000));
    const lake = smooth(68,150,z)*(1-smooth(280,430,Math.abs(x)));
    h = h*(1-lake)-7*lake;
    if(z < -260) h += Math.min(100,(-z-260)*.22);
    return h;
  }

  function texture(type) {
    const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=1024;
    const c=canvas.getContext('2d');
    if(type==='stone') {
      c.fillStyle='#55564f'; c.fillRect(0,0,1024,1024);
      for(let row=0;row<16;row++) for(let col=-1;col<9;col++) {
        const x=col*136+(row%2)*68,y=row*64,v=108+Math.floor(rnd()*37);
        c.fillStyle=`rgb(${v+15},${v+10},${v})`; c.fillRect(x+2,y+2,132,60);
        c.fillStyle='rgba(225,220,200,.17)';c.fillRect(x+3,y+3,130,2);
        c.fillStyle='rgba(28,35,28,.14)';c.fillRect(x+4,y+58,127,3);
        for(let k=0;k<12;k++){c.fillStyle=`rgba(35,48,30,${rnd()*.11})`;c.fillRect(x+5+rnd()*123,y+5+rnd()*54,3+rnd()*20,1+rnd()*7);}
      }
      for(let i=0;i<42000;i++){const v=rnd()>0.5?255:0;c.fillStyle=`rgba(${v},${v},${v},.06)`;c.fillRect(rnd()*1024,rnd()*1024,1+rnd()*3,1+rnd()*3);}
      for(let i=0;i<90;i++){const x=rnd()*1024,y=rnd()*1024;c.strokeStyle='rgba(37,44,34,.12)';c.lineWidth=.4+rnd();c.beginPath();c.moveTo(x,y);c.lineTo(x+3+rnd()*5,y+12+rnd()*40);c.lineTo(x+rnd()*12,y+30+rnd()*70);c.stroke();}
    } else {
      c.fillStyle='#26343c';c.fillRect(0,0,1024,1024);
      for(let row=0;row<32;row++) for(let col=-1;col<17;col++) {
        const v=28+Math.floor(rnd()*20);c.fillStyle=`rgb(${v},${v+8},${v+13})`;
        const x=col*64+(row%2)*32,y=row*32;c.fillRect(x+1,y+1,62,30);
        c.fillStyle='rgba(160,175,175,.15)';c.fillRect(x+2,y+2,59,1);c.fillStyle='rgba(0,0,0,.3)';c.fillRect(x+1,y+28,62,3);
        for(let k=0;k<3;k++){c.strokeStyle='rgba(160,170,165,.06)';c.beginPath();c.moveTo(x+4+rnd()*54,y+3);c.lineTo(x+4+rnd()*54,y+26);c.stroke();}
      }
    }
    const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
  }
  const stoneMap=texture('stone'), slateMap=texture('slate');
  const stoneBump=stoneMap.clone(),slateBump=slateMap.clone();stoneBump.colorSpace=slateBump.colorSpace=THREE.NoColorSpace;
  const mats={
    stone:new THREE.MeshStandardMaterial({color:0xb3aa95,map:stoneMap,bumpMap:stoneBump,bumpScale:.12,roughness:.96}),
    pale:new THREE.MeshStandardMaterial({color:0xc1baa9,map:stoneMap,bumpMap:stoneBump,bumpScale:.08,roughness:1}),
    roof:new THREE.MeshStandardMaterial({color:0x8293a0,map:slateMap,bumpMap:slateBump,bumpScale:.11,roughness:.72,metalness:.08}),
    roofTrim:new THREE.MeshStandardMaterial({color:0x425560,roughness:.62,metalness:.25}),
    dark:new THREE.MeshStandardMaterial({color:0x172831,roughness:.98}),
    wood:new THREE.MeshStandardMaterial({color:0x48372c,roughness:.94}),
    brass:new THREE.MeshStandardMaterial({color:0xa68e55,metalness:.48,roughness:.5}),
    glow:new THREE.MeshBasicMaterial({color:0xf8c36d}),
    softglow:new THREE.MeshBasicMaterial({color:0xcc9c59}),
    white:new THREE.MeshStandardMaterial({color:0xc5b9a1,roughness:.9}),
    red:new THREE.MeshStandardMaterial({color:0x6c3230,roughness:.9}),
    green:new THREE.MeshStandardMaterial({color:0x23483e,roughness:.9}),
    blue:new THREE.MeshStandardMaterial({color:0x294959,roughness:.9}),
    yellow:new THREE.MeshStandardMaterial({color:0xa88b45,roughness:.9}),
    glass:new THREE.MeshStandardMaterial({color:0x8baea3,metalness:.35,roughness:.3,transparent:true,opacity:.48,side:THREE.DoubleSide}),
    rock:new THREE.MeshStandardMaterial({color:0x525c5c,roughness:1,flatShading:true}),
    path:new THREE.MeshStandardMaterial({color:0x969284,roughness:1}),
    black:new THREE.MeshStandardMaterial({color:0x121e22,roughness:.8})
  };
  const buckets=new Map();
  const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3();
  const boxG=new THREE.BoxGeometry(1,1,1),cylinderG=new THREE.CylinderGeometry(1,1,1,20),coneG=new THREE.ConeGeometry(1,1,20);
  function put(geo,mat,x,y,z,sx=1,sy=1,sz=1,ry=0,rx=0,rz=0) {
    pos.set(x,y,z);scale.set(sx,sy,sz);quat.setFromEuler(new THREE.Euler(rx,ry,rz));matrix.compose(pos,quat,scale);
    const g=geo.clone();
    // Architectural UVs use approximately four metres per repeat, so stone
    // courses retain their scale across a giant tower and a small buttress.
    if(g.attributes.uv&&(mat===mats.stone||mat===mats.pale||mat===mats.wood||mat===mats.roof)){
      const uv=g.attributes.uv,n=g.attributes.normal;
      for(let i=0;i<uv.count;i++){
        let us=1,vs=1;
        if(geo===boxG){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));us=(nx>.5?sz:sx)/4;vs=(ny>.5?sz:sy)/4;}
        else if(geo===cylinderG||geo===coneG){us=sx*Math.PI*.5;vs=sy/4;}
        else if(geo.type==='ExtrudeGeometry'){us=.25;vs=.25;}
        uv.setXY(i,uv.getX(i)*us,uv.getY(i)*vs);
      }
    }
    g.applyMatrix4(matrix);if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(g);
  }
  const box=(x,y,z,w,h,d,mat=mats.stone,ry=0)=>put(boxG,mat,x,y,z,w,h,d,ry);
  const cyl=(x,y,z,r,h,mat=mats.stone,ry=0)=>put(cylinderG,mat,x,y,z,r,h,r,ry);
  const cone=(x,y,z,r,h,mat=mats.roof)=>put(coneG,mat,x,y,z,r,h,r);
  const winShape=new THREE.Shape();winShape.moveTo(-.5,0);winShape.lineTo(.5,0);winShape.lineTo(.5,.62);winShape.quadraticCurveTo(.44,.84,0,1);winShape.quadraticCurveTo(-.44,.84,-.5,.62);winShape.closePath();
  const winG=new THREE.ShapeGeometry(winShape,6);
  const frameShape=new THREE.Shape();frameShape.moveTo(-.66,-.045);frameShape.lineTo(.66,-.045);frameShape.lineTo(.66,.63);frameShape.quadraticCurveTo(.59,.9,0,1.10);frameShape.quadraticCurveTo(-.59,.9,-.66,.63);frameShape.closePath();frameShape.holes.push(new THREE.Path(winShape.getPoints(7)));const windowFrameG=new THREE.ShapeGeometry(frameShape,7);
  const slenderG=new THREE.CylinderGeometry(1,1,1,6);
  function rod(a,b,r,mat=mats.pale){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av);pos.copy(av).lerp(bv,.5);quat.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());scale.set(r,dir.length(),r);matrix.compose(pos,quat,scale);const g=slenderG.clone().applyMatrix4(matrix);if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(g);}
  function windowAt(x,y,z,w=1.1,h=3,ry=0,lit=true) {
    put(winG,mats.dark,x,y-.13,z,w*1.32,h*1.09,1,ry);
    put(winG,lit?mats.glow:mats.black,x+Math.sin(ry)*.04,y,z+Math.cos(ry)*.04,w,h,1,ry);
    put(windowFrameG,mats.pale,x+Math.sin(ry)*.075,y,z+Math.cos(ry)*.075,w,h,1,ry);
    box(x+Math.sin(ry)*.08,y+h*.43,z+Math.cos(ry)*.08,.10,h*.85,.10,mats.stone,ry);
    if(h>3){box(x+Math.sin(ry)*.10,y+h*.39,z+Math.cos(ry)*.10,w,.11,.1,mats.pale,ry);box(x+Math.sin(ry)*.10,y+h*.66,z+Math.cos(ry)*.10,w*.9,.09,.1,mats.pale,ry);}
    box(x+Math.sin(ry)*.18,y-.12,z+Math.cos(ry)*.18,w*1.45,.19,.38,mats.pale,ry);
  }
  function gable(x,y,z,w,h,d,mat=mats.roof,ry=0){
    const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,steps:1});geo.translate(0,0,-d/2);put(geo,mat,x,y,z,1,1,1,ry);geo.dispose();
    if(mat===mats.roof&&w>6&&h>3){
      const wp=(xx,yy,zz)=>[x+xx*Math.cos(ry)+zz*Math.sin(ry),y+yy,z-xx*Math.sin(ry)+zz*Math.cos(ry)];
      rod(wp(0,h+.06,-d/2),wp(0,h+.06,d/2),.13,mats.roofTrim);
      for(let zz=-d/2;zz<=d/2+.1;zz+=Math.max(3,d/10))for(const side of[-1,1])rod(wp(side*w/2,.06,zz),wp(0,h+.06,zz),.045,mats.roofTrim);
      for(const side of[-1,1])rod(wp(side*w/2,.04,-d/2),wp(side*w/2,.04,d/2),.12,mats.roofTrim);
    }
  }
  function finial(x,y,z,h=4){cyl(x,y+h*.25,z,.13,h*.5,mats.brass);cone(x,y+h*.65,z,.44,h*.8,mats.roof);}
  function battlement(x,y,z,w,d){
    box(x,y,z,w,1.1,d,mats.pale);for(let xx=-w/2+.6;xx<w/2;xx+=2)for(const zz of[-d/2+.4,d/2-.4])box(x+xx,y+1,z+zz,.9,1.1,.8,mats.pale);
    for(let zz=-d/2+2;zz<d/2-1;zz+=2)for(const xx of[-w/2+.4,w/2-.4])box(x+xx,y+1,z+zz,.8,1.1,.9,mats.pale);
  }
  function tower(x,z,r,h,{base=26,roof=20,windows=true,turrets=false}={}) {
    if(base<40)colliders.push({x,z,r:r+.5});
    cyl(x,base+h/2,z,r,h);cyl(x,base+1,z,r+1,2,mats.pale);cyl(x,base+h-1,z,r+.65,1.5,mats.pale);
    for(let y=base+8;y<base+h-3;y+=9){cyl(x,y-1.3,z,r+.17,.4,mats.pale);if(windows)for(let i=0;i<10;i++){const a=i*Math.PI/5;windowAt(x+Math.sin(a)*(r+.025),y,z+Math.cos(a)*(r+.025),.9,3.4,a,rnd()>.15);}}
    cone(x,base+h+roof/2,z,r+1.6,roof);finial(x,base+h+roof,z,3);
    if(r>3){
      for(let k=1;k<8;k++){const t=k/8;cyl(x,base+h+roof*t,z,(r+1.6)*(1-t)+.045,.11,mats.roofTrim);}
      for(let i=0;i<8;i++){const a=i*Math.PI/4+.15;box(x+Math.sin(a)*(r+.08),base+h*.46,z+Math.cos(a)*(r+.08),.55,h*.87,.55,mats.pale,a);box(x+Math.sin(a)*(r+.35),base+2,z+Math.cos(a)*(r+.35),1.2,4,1.2,mats.pale,a);}
    }
    if(r>4.5){for(let i=0;i<4;i++){const a=i*Math.PI/2+.2,tx=x+Math.sin(a)*r*.92,tz=z+Math.cos(a)*r*.92,yy=base+h+roof*.05;box(tx,yy+1.6,tz,2.4,3.2,2.5,mats.stone,a);gable(tx,yy+3.2,tz,3.2,3.6,3.2,mats.roof,a);windowAt(tx+Math.sin(a)*1.28,yy+.45,tz+Math.cos(a)*1.28,.8,2.4,a);finial(tx,yy+6.8,tz,1.7);}}
    if(turrets)for(let i=0;i<4;i++){const a=i*Math.PI/2+.6,tx=x+Math.sin(a)*r*.88,tz=z+Math.cos(a)*r*.88; cyl(tx,base+h+1.5,tz,1.8,7);cone(tx,base+h+8,tz,2.2,7);}
  }
  function building(x,z,w,d,h,{base=26,rh=8,rotation=0,windows=true}={}){
    colliders.push({x,z,w:w+1,d:d+1});
    box(x,base+h/2,z,w,h,d,mats.stone,rotation);gable(x,base+h,z,w+1.5,rh,d+1.5,mats.roof,rotation);
    if(rotation===0&&windows){for(const side of[-1,1])for(let xx=-w/2+2;xx<w/2-1;xx+=3.8)for(let y=base+3;y<base+h-3;y+=7)windowAt(x+xx,y,z+side*(d/2+.02),1.1,3.4,side===1?0:Math.PI,rnd()>.18);for(const side of[-1,1])for(let zz=-d/2+2;zz<d/2-1;zz+=4.5)for(let y=base+4;y<base+h-2;y+=7)windowAt(x+side*(w/2+.02),y,z+zz,1.1,3.4,side*Math.PI/2,rnd()>.12);}
    for(const xx of[-1,1])for(const zz of[-1,1])box(x+xx*w/2,base+h/2,z+zz*d/2,1.1,h+1,1.1,mats.pale);
    for(let i=0;i<Math.floor(d/12);i++){const cz=z-d/2+5+i*12;box(x+w*.26,base+h+rh*.45,cz,1.2,rh,1.6,mats.stone);box(x+w*.26,base+h+rh*.94,cz,1.65,.35,2.05,mats.pale);for(const dx of[-.3,.3])cyl(x+w*.26+dx,base+h+rh+1,cz,.21,1.3,mats.dark);}
    if(rotation===0){
      for(let yy=base+1;yy<base+h;yy+=2.2)for(const xx of[-1,1])for(const zz of[-1,1])box(x+xx*w/2,yy,z+zz*d/2,1.22,.65,1.22,mats.pale);
      for(const side of[-1,1]){box(x,base+h-.3,z+side*d/2,w+.7,.45,.5,mats.pale);box(x+side*w/2,base+h-.3,z,.5,.45,d+.7,mats.pale);}
      if(h>=14&&d>18){for(let zz=-d/2+5;zz<d/2-3;zz+=8)for(const side of[-1,1]){const dx=x+side*w*.35,dz=z+zz,dy=base+h+rh*.13,angle=side*Math.PI/2;box(dx,dy+1.8,dz,2.6,3.6,2.4,mats.stone,angle);gable(dx,dy+3.6,dz,3.5,3.7,3.7,mats.roof,angle);windowAt(dx+side*1.25,dy+.4,dz,1,2.9,angle);}}
    }
  }

  // Landscape, with a high plateau under the castle and a deep glacial lake below it.
  const terrainG=new THREE.PlaneGeometry(1450,1450,210,210);terrainG.rotateX(-Math.PI/2);
  const tp=terrainG.attributes.position,colors=[];
  const grassA=new THREE.Color(0x344d43),grassB=new THREE.Color(0x65715a),rockColor=new THREE.Color(0x687477);
  for(let i=0;i<tp.count;i++){
    const x=tp.getX(i),z=tp.getZ(i),h=groundHeight(x,z);tp.setY(i,h);
    const slope=Math.abs(groundHeight(x+3,z)-h)+Math.abs(groundHeight(x,z+3)-h);
    const col=grassA.clone().lerp(grassB,clamp((Math.sin(x*.025+z*.04)+1)*.25+rnd()*.15,0,1));
    if(slope>1.7)col.lerp(rockColor,clamp(slope*.22,0,.9));colors.push(col.r,col.g,col.b);
  }
  terrainG.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainG.computeVertexNormals();
  const terrainMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  const terrain=new THREE.Mesh(terrainG,terrainMaterial);terrain.receiveShadow=true;group.add(terrain);
  // Coherent terrain noise keeps the hills connected rather than assembling cones.
  const hash2=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
  function noise2(x,z){const ix=Math.floor(x),iz=Math.floor(z),tx=x-ix,tz=z-iz,u=tx*tx*(3-2*tx),v=tz*tz*(3-2*tz);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash2(ix,iz),hash2(ix+1,iz),u),THREE.MathUtils.lerp(hash2(ix,iz+1),hash2(ix+1,iz+1),u),v);}
  function fbm(x,z){let sum=0,amp=.57;for(let k=0;k<5;k++){sum+=noise2(x,z)*amp;x=x*2.07+17.3;z=z*2.03-8.1;amp*=.47;}return sum;}
  const cragG=new THREE.DodecahedronGeometry(1,1);
  const rockG=new THREE.IcosahedronGeometry(1,1),rp=rockG.attributes.position;
  for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),f=.77+noise2(x*4.3+z*2.7,y*3.5)*.48;rp.setXYZ(i,x*f,y*f*(.82+.18*Math.sin(x*5+z*3)),z*f);}
  rockG.computeVertexNormals();mats.rock.bumpMap=stoneBump;mats.rock.bumpScale=.22;
  // The castle sits on continuous, sedimentary cliff faces with eroded ribs.
  const cliffV=[],cliffC=[],cliffI=[],cliffUV=[],cliffSteps=220,cliffDepth=46;
  const cLight=new THREE.Color(0x7c8077),cDark=new THREE.Color(0x454f4c);
  for(let j=0;j<=cliffDepth;j++)for(let i=0;i<=cliffSteps;i++){
    const a=.04+i/cliffSteps*(Math.PI-.08),t=j/cliffDepth;
    const rim=77+Math.sin(a*5)*3+Math.sin(a*13)*1.3;
    const ribs=(noise2(a*19,1.2)-.5)*7+Math.sin(a*37)*.7;
    const strata=Math.sin(t*24+a*.7)*1.0+Math.sin(t*53)*.4+Math.sin(t*113+a*.4)*.13;
    const r=rim+t*25+ribs*Math.sin(t*Math.PI)+strata*Math.sin(t*Math.PI);
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const top=groundHeight(Math.cos(a)*rim,Math.sin(a)*rim)+.25;
    const y=top*(1-t)-5*t+Math.sin(a*13+t*9)*.45*Math.sin(t*Math.PI);
    cliffV.push(x,y,z);cliffUV.push(a*77/4,y/4);
    const bedding=.42+.18*Math.sin(t*48+a*.5)+(noise2(a*45,t*7)-.5)*.4;
    const color=cDark.clone().lerp(cLight,clamp(bedding,0,1));
    if(t<.08)color.lerp(grassA,.35);cliffC.push(color.r,color.g,color.b);
    if(j<cliffDepth&&i<cliffSteps){const n=j*(cliffSteps+1)+i;cliffI.push(n,n+1,n+cliffSteps+1,n+1,n+cliffSteps+2,n+cliffSteps+1);}
  }
  const cliffGeo=new THREE.BufferGeometry();cliffGeo.setAttribute('position',new THREE.Float32BufferAttribute(cliffV,3));cliffGeo.setAttribute('color',new THREE.Float32BufferAttribute(cliffC,3));cliffGeo.setAttribute('uv',new THREE.Float32BufferAttribute(cliffUV,2));cliffGeo.setIndex(cliffI);cliffGeo.computeVertexNormals();
  const cliffMaterial=new THREE.MeshStandardMaterial({vertexColors:true,bumpMap:stoneBump,bumpScale:.24,roughness:1,side:THREE.DoubleSide});
  const cliffs=new THREE.Mesh(cliffGeo,cliffMaterial);cliffs.receiveShadow=true;cliffs.castShadow=true;group.add(cliffs);
  // Small shoreline scree nests into the rock face instead of floating above it.
  for(let i=0;i<70;i++){const a=.2+rnd()*2.7,r=95+rnd()*15,x=Math.cos(a)*r,z=Math.sin(a)*r;put(rockG,mats.rock,x,groundHeight(x,z)-.5,z,.7+rnd()*2.4,.6+rnd()*2.5,.9+rnd()*2.4,rnd()*6,.1,rnd()*.3);}
  // Three continuous, irregular Highland ridgelines. Broad rounded shoulders,
  // sharp gullies and uneven saddles produce natural silhouettes in every view.
  for(let ring=0;ring<3;ring++){
    const radialSteps=42,angularSteps=220,verts=[],cols=[],inds=[];
    const inner=340+ring*180,depth=440+ring*80;
    const baseColor=new THREE.Color([0x43574f,0x475f5f,0x557079][ring]);
    const highColor=new THREE.Color([0x69746a,0x687b78,0x788f92][ring]);
    for(let j=0;j<=radialSteps;j++)for(let i=0;i<=angularSteps;i++){
      const a=Math.PI*.64+i/angularSteps*Math.PI*1.73,t=j/radialSteps;
      const r=inner+t*depth,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const ridgeCenter=.44+.12*Math.sin(a*3.3+ring)+.07*Math.sin(a*7.7+ring*2.4);
      const profile=Math.exp(-Math.pow((t-ridgeCenter)/(.21+.025*Math.sin(a*5)),2));
      const silhouette=100+ring*26+fbm(a*4.9+ring*15,ring*7.1)*190+Math.sin(a*4.2+ring*1.7)*28;
      const valleys=1-.29*Math.pow(noise2(a*15+ring*8,t*3.8),2);
      const detail=(fbm(x*.016+ring*19,z*.016)-.47)*45+(noise2(x*.058,z*.058)-.5)*7;
      const sideFade=smooth(0,.065,i/angularSteps)*(1-smooth(.935,1,i/angularSteps));
      const skirt=groundHeight(x,z)-4;
      const h=skirt+Math.max(0,profile*silhouette*valleys+detail*Math.sin(t*Math.PI))*sideFade;
      verts.push(x,h,z);
      const crag=clamp(.25+profile*.4+(noise2(x*.025,z*.025)-.5)*.45,0,1);
      const color=baseColor.clone().lerp(highColor,crag);cols.push(color.r,color.g,color.b);
      if(j<radialSteps&&i<angularSteps){const n=j*(angularSteps+1)+i;inds.push(n,n+1,n+angularSteps+1,n+1,n+angularSteps+2,n+angularSteps+1);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.setIndex(inds);g.computeVertexNormals();
    const ridge=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));ridge.receiveShadow=true;group.add(ridge);
  }
  // Paths are laid onto the real height field.
  const pathSamples=[];
  function path(points,width=3){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,groundHeight(x,z)+.18,z)));
    const pts=curve.getPoints(110),vs=[],inds=[];for(let i=0;i<pts.length;i+=3)pathSamples.push({x:pts[i].x,z:pts[i].z,r:width*.7+1});
    for(let i=0;i<pts.length;i++){const p=pts[i],next=pts[Math.min(i+1,pts.length-1)],prev=pts[Math.max(0,i-1)],dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;for(const s of[-1,1]){const x=p.x-dz/len*width/2*s,z=p.z+dx/len*width/2*s;vs.push(x,groundHeight(x,z)+.24,z);}if(i<pts.length-1){const n=i*2;inds.push(n,n+2,n+1,n+1,n+2,n+3);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));geo.setIndex(inds);geo.computeVertexNormals();const m=new THREE.Mesh(geo,mats.path);m.receiveShadow=true;group.add(m);
  }
  path([[-40,-45],[-60,-63],[-85,-55],[-114,-5],[-114,24]],3);
  path([[-95,-40],[-130,-60],[-170,-65],[-210,-90]],2.8);
  path([[60,-28],[100,-65],[145,-88],[180,-130],[235,-158]],5);
  path([[-60,55],[-94,65],[-130,85],[-160,105]],4);
  path([[50,18],[60,-5],[68,-18]],3);

  // Great Hall: a tall nave, lancet windows, buttresses and a steep slate roof.
  building(-29,32,20,44,26,{rh:13,windows:false});
  for(const side of[-1,1])for(let z=14;z<54;z+=6.3){windowAt(-29+side*10.04,32,z,2.6,12,side*Math.PI/2);box(-29+side*10.7,35,z+2.6,1.5,18,1.5,mats.pale);box(-29+side*12.1,29,z+2.6,2,7,2,mats.pale);}
  for(let i=-2;i<=2;i++)windowAt(-29+i*2.7,34,54.04,1.75,i===0?15:12,0);
  windowAt(-29,27,54.13,4.5,6.5,0,false);
  for(const x of[-39,-19])for(const z of[10,54]){tower(x,z,1.9,29,{roof:8,windows:false});}
  finial(-29,65,11,3);finial(-29,65,53,3);
  // Grand Staircase tower and central wings.
  tower(0,3,10.4,63,{roof:25,turrets:true});
  tower(-13,-1,3.1,47,{roof:15});
  tower(11,7,3.3,49,{roof:17});
  building(0,-20,19,25,26,{rh:12});
  building(-16,-16,12,22,25,{rh:10});
  building(26,-4,14,37,29,{rh:12});
  building(46,0,14,25,24,{rh:10});
  // Astronomy complex with its unusually tall, asymmetric tower.
  tower(37,-35,8.8,56,{roof:27,turrets:true});
  tower(48,-39,3.6,39,{roof:16});
  tower(29,-44,3.8,36,{roof:15});
  building(18,-36,15,14,27,{rh:12});
  tower(5,-38,5.5,31,{roof:16});
  // Open stone courtyard and arcaded east wing.
  box(22,26.2,31,31,.4,28,mats.pale);
  building(7,31,8,29,12,{rh:6});
  building(38,31,8,29,14,{rh:7});
  building(23,47,38,8,11,{rh:7});
  const archShape=new THREE.Shape();archShape.moveTo(-.5,0);archShape.lineTo(-.5,1);archShape.lineTo(.5,1);archShape.lineTo(.5,0);archShape.lineTo(.30,0);archShape.lineTo(.30,.52);archShape.quadraticCurveTo(.25,.71,0,.85);archShape.quadraticCurveTo(-.25,.71,-.30,.52);archShape.lineTo(-.30,0);archShape.closePath();
  const archG=new THREE.ExtrudeGeometry(archShape,{depth:1,bevelEnabled:false});
  for(let x=9;x<=37;x+=4)put(archG,mats.pale,x,26.4,41.6,4,7,1.5);
  for(let z=19;z<44;z+=4)put(archG,mats.pale,10.8,26.4,z,4,7,1.5,Math.PI/2);
  const fountainMat=new THREE.MeshStandardMaterial({color:0x5a807f,roughness:.3,metalness:.2});
  cyl(23,26.8,31,4.3,1.1,mats.pale);cyl(23,27.4,31,3.8,.12,fountainMat);cyl(23,28,31,.5,2,mats.pale);cyl(23,29.2,31,1.7,.4,mats.pale);
  tower(45,46,3.2,19,{roof:11});tower(1,46,3.2,18,{roof:10});
  // Clock tower and twin bell towers overlooking their own courtyard.
  building(-42,-27,14,15,43,{rh:19,windows:false});
  for(let y=31;y<61;y+=8)for(let i=-1;i<=1;i++)windowAt(-42+i*3.2,y,-19.45,1.3,4);
  const clockCanvas=document.createElement('canvas');clockCanvas.width=256;clockCanvas.height=256;const cc=clockCanvas.getContext('2d');cc.fillStyle='#263236';cc.fillRect(0,0,256,256);cc.strokeStyle='#bea77a';cc.lineWidth=5;cc.beginPath();cc.arc(128,128,113,0,Math.PI*2);cc.stroke();cc.beginPath();cc.arc(128,128,99,0,Math.PI*2);cc.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;cc.lineWidth=i%3?3:6;cc.beginPath();cc.moveTo(128+Math.sin(a)*82,128-Math.cos(a)*82);cc.lineTo(128+Math.sin(a)*96,128-Math.cos(a)*96);cc.stroke();}cc.lineWidth=5;cc.beginPath();cc.moveTo(128,128);cc.lineTo(87,90);cc.moveTo(128,128);cc.lineTo(151,59);cc.stroke();cc.fillStyle='#bea77a';cc.beginPath();cc.arc(128,128,6,0,Math.PI*2);cc.fill();const clockTex=new THREE.CanvasTexture(clockCanvas);clockTex.colorSpace=THREE.SRGBColorSpace;const clockMat=new THREE.MeshStandardMaterial({map:clockTex,roughness:.8,emissive:0xb7a170,emissiveMap:clockTex,emissiveIntensity:.25});
  put(new THREE.CircleGeometry(1,40),clockMat,-42,64,-19.43,3.6,3.6,1);put(new THREE.CircleGeometry(1,40),clockMat,-42,64,-34.57,3.6,3.6,1,Math.PI);
  tower(-29,-31,5,35,{roof:16});tower(-57,-31,5,35,{roof:16});
  building(-52,-2,9,29,14,{rh:7});building(-66,-20,21,9,17,{rh:9});
  box(-61,26.2,-1,24,.35,26,mats.pale);
  for(let z=-11;z<13;z+=4)put(archG,mats.pale,-71,26,z,4,6,1.4,Math.PI/2);
  building(-68,15,17,7,13,{rh:7});tower(-77,12,3.3,23,{roof:12});
  // Defensive lower retaining walls, gates and steps.
  box(3,24.2,58,95,4.5,2.5);battlement(3,26.6,58,95,2.5);
  box(50,24.2,41,2.5,4.5,36);battlement(50,26.6,41,2.5,36);
  tower(-45,59,3.4,9,{roof:8,windows:false});tower(51,59,3.4,9,{roof:8,windows:false});
  for(let i=0;i<27;i++)box(44,26-i*.79,66+i*1.8,5,.55,2,mats.pale);
  // The viaduct spans a low ravine. Each opening is real geometry.
  for(let i=0;i<10;i++){const x=57+i*9.3,y=1.3;put(archG,mats.stone,x,y,33,9.3,26.5,6);box(x,28.9,36,9.3,1.4,7,mats.pale);box(x,30.1,32.7,9.3,1.2,.6,mats.pale);box(x,30.1,39.3,9.3,1.2,.6,mats.pale);}
  for(const x of[53,149]){tower(x,32.7,1.5,7,{base:29.2,roof:5,windows:false});tower(x,39.3,1.5,7,{base:29.2,roof:5,windows:false});}
  path([[151,36],[170,20],[175,-25],[181,-70],[214,-132]],4);

  // Timber covered bridge beyond the clock courtyard and the hilltop owlery.
  const cba=new THREE.Vector3(-74,29,-23),cbb=new THREE.Vector3(-120,35,-64),cbdir=cbb.clone().sub(cba),cblen=Math.hypot(cbdir.x,cbdir.z),cbrot=Math.atan2(cbdir.x,cbdir.z);
  for(let i=0;i<12;i++){
    const t=(i+.5)/12,p=cba.clone().lerp(cbb,t),span=cblen/12+.15;
    box(p.x,p.y,p.z,5,.6,span,mats.wood,cbrot);gable(p.x,p.y+5,p.z,6.6,3,span+.15,mats.roof,cbrot);
    for(const side of[-1,1]){
      const xx=p.x+Math.cos(cbrot)*side*2.4,zz=p.z-Math.sin(cbrot)*side*2.4;
      box(xx,p.y+2.5,zz,.4,5,.4,mats.wood);box(xx,p.y+1.2,zz,.3,.35,span,mats.wood,cbrot);
      const gy=groundHeight(xx,zz);box(xx,(gy+p.y)/2,zz,.6,Math.max(.4,p.y-gy),.6,mats.stone);
    }
  }
  const oy=groundHeight(-119,-95);tower(-119,-95,6.2,23,{base:oy,roof:16,windows:false});
  for(let i=0;i<12;i++){const a=i*Math.PI/6;windowAt(-119+Math.sin(a)*6.25,oy+12,-95+Math.cos(a)*6.25,1.2,6,a,false);windowAt(-119+Math.sin(a)*6.25,oy+3,-95+Math.cos(a)*6.25,1,3,a,false);}
  path([[-120,-64],[-125,-75],[-119,-90]],2.5);

  // Whomping Willow: a visibly distinct old tree with heavy, crooked branches.
  const wx=-92,wz=55,wy=groundHeight(wx,wz),willowWood=new THREE.MeshStandardMaterial({color:0x4a4a3e,roughness:1});
  function branch(a,b,r1,r2){const dir=b.clone().sub(a),len=dir.length(),g=new THREE.CylinderGeometry(r2,r1,len,7);const m=new THREE.Mesh(g,willowWood);m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());m.updateMatrix();const gg=g.clone().applyMatrix4(m.matrix);if(!buckets.has(willowWood))buckets.set(willowWood,[]);buckets.get(willowWood).push(gg);g.dispose();}
  branch(new THREE.Vector3(wx,wy,wz),new THREE.Vector3(wx+1.5,wy+14,wz),2.2,1.5);
  const willowLeaves=new THREE.MeshStandardMaterial({color:0x405947,roughness:1,flatShading:true});
  for(let i=0;i<8;i++){const a=i*Math.PI/4,ax=wx+Math.sin(a)*8,az=wz+Math.cos(a)*8,ay=wy+12+rnd()*5;branch(new THREE.Vector3(wx+1,wy+10,wz),new THREE.Vector3(ax,ay,az),1.1,.45);branch(new THREE.Vector3(ax,ay,az),new THREE.Vector3(ax+Math.sin(a)*5,ay-1,az+Math.cos(a)*5),.5,.12);put(cragG,willowLeaves,ax,ay+1,az,4.7,2.9,4.7,rnd());for(let j=0;j<3;j++){const bx=ax+(rnd()-.5)*7,bz=az+(rnd()-.5)*7;put(new THREE.ConeGeometry(1,1,5),willowLeaves,bx,ay-3,bz,.5,7+rnd()*3,.5,0,Math.PI);}}

  // Boathouse and timber jetty at the foot of the long staircase.
  building(45,119,16,22,9,{base:1.2,rh:7,windows:false});
  put(archG,mats.pale,45,1.2,130.1,11,8.7,1.2);box(45,2,142,12,.6,22,mats.wood);
  for(const x of[40,50])for(let z=135;z<155;z+=5)cyl(x,1.2,z,.35,4,mats.wood);
  for(let i=0;i<4;i++){const bx=31+i*8,bz=150+i%2*8;const boatGeo=new THREE.SphereGeometry(1,12,7,0,Math.PI*2,0,Math.PI/2);put(boatGeo,mats.wood,bx,1.2,bz,2,.65,4,0,Math.PI);box(bx,1.2,bz,2.8,.15,.7,mats.pale);}

  // Hagrid's hut, smoking chimney, vegetable patch and enclosure.
  const hy=groundHeight(-114,25);
  cyl(-114,hy+4,25,6.5,8);cone(-114,hy+11,25,7.8,8);box(-110,hy+11,24,1.6,10,1.7);windowAt(-114,hy+2,31.55,2.5,4.3,0,false);windowAt(-108.2,hy+3,27.5,1.2,2.2,1.15);
  for(let i=0;i<25;i++){const x=-122+rnd()*17,z=38+rnd()*12;put(new THREE.SphereGeometry(1,8,6),mats.yellow,x,groundHeight(x,z)+.6,z,.6+rnd()*.4,.6,.65);}
  for(let i=0;i<12;i++){const x=-131+i*2.2,y=groundHeight(x,37);box(x,y+1,37,.15,2,.15,mats.wood);box(x,y+.8,37,2.3,.15,.15,mats.wood);box(x,y+1.5,37,2.3,.15,.15,mats.wood);}

  // Greenhouses, transparent glass panes and iron ribs.
  for(let n=0;n<3;n++){
    const x=65+n*11,z=-12-n*2,y=groundHeight(x,z);box(x,y+1,z,9,2,24,mats.pale);box(x,y+4,z,9,5,24,mats.glass);gable(x,y+6.5,z,9,4,24,mats.glass);
    for(let zz=-12;zz<=12;zz+=3){box(x-4.6,y+4,z+zz,.16,5,.16,mats.dark);box(x+4.6,y+4,z+zz,.16,5,.16,mats.dark);for(const side of[-1,1])put(boxG,mats.dark,x+side*2.25,y+8.5,z+zz,.15,6,.15,0,0,-side*.84);}
    for(let j=0;j<12;j++){const px=x-3+rnd()*6,pz=z-10+rnd()*20;cone(px,y+2.8,pz,.6,2.5,mats.green);}
  }
  // Quidditch ground: elliptical field, house stands and six regulation hoops.
  const qx=-164,qz=122,qy=groundHeight(qx,qz)+.25;
  const fieldMat=new THREE.MeshStandardMaterial({color:0x3f6650,roughness:1});put(new THREE.CircleGeometry(1,80),fieldMat,qx,qy,qz,43,67,1,0,-Math.PI/2);
  const lineMat=new THREE.MeshBasicMaterial({color:0xb8b4a0});
  const ellipse=new THREE.EllipseCurve(0,0,41,64,0,Math.PI*2);const linePts=ellipse.getPoints(100).map(p=>new THREE.Vector3(qx+p.x,qy+.1,qz+p.y));const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(linePts),lineMat);group.add(line);
  const midcircle=new THREE.Mesh(new THREE.RingGeometry(9.7,10,48),lineMat);midcircle.rotation.x=-Math.PI/2;midcircle.position.set(qx,qy+.12,qz);group.add(midcircle);
  [mats.red,mats.green,mats.blue,mats.yellow].forEach((mat,n)=>{
    for(let j=0;j<2;j++){const a=(n*2+j)/8*Math.PI*2,x=qx+Math.sin(a)*49,z=qz+Math.cos(a)*72,y=groundHeight(x,z);cyl(x,y+7,z,4,14,mats.wood);for(let k=0;k<4;k++)box(x,y+4+k*3,z,8,.5,8,mats.white);cone(x,y+17,z,5.8,6,mat);box(x,y+11,z,8.15,6,8.15,mat);}}
  );
  const torus=new THREE.TorusGeometry(2.1,.16,6,28);for(const side of[-1,1])for(let i=-1;i<=1;i++){const x=qx+i*8,z=qz+side*52,h=12+(1-Math.abs(i))*4;cyl(x,qy+h/2,z,.18,h,mats.brass);put(torus,mats.brass,x,qy+h,z,1,1,1);}

  // The village of Hogsmeade, winding main street and individual medieval shops.
  path([[204,-126],[220,-145],[235,-158],[253,-177],[267,-201],[291,-218]],4.8);
  function cottage(x,z,w,d,h,ry=0,signature=false){
    const y=groundHeight(x,z);building(x,z,w,d,h,{base:y,rh:h*.8,windows:false});
    for(let i=-1;i<=1;i++)windowAt(x+i*w*.28,y+2,z+d/2+.02,1.2,2.2,0,true);
    windowAt(x,y+2,z-d/2-.02,1.2,2.2,Math.PI,true);box(x+w*.32,y+h+2,z-d*.2,1.3,7,1.4,mats.stone);
    box(x,y+h*.75,z+d/2+.07,w+.1,.25,.18,mats.wood);box(x,y+h*.35,z+d/2+.07,w+.1,.25,.18,mats.wood);
    for(const xx of[-.46,0,.46])box(x+w*xx,y+h*.48,z+d/2+.1,.18,h*.92,.2,mats.wood);
    if(signature){box(x,y+2,z+d/2+.13,w*.7,3,.25,mats.green);for(let i=-1;i<=1;i++)windowAt(x+i*2,y+2.3,z+d/2+.3,1.1,1.8);}
  }
  for(let i=0;i<27;i++){
    const row=i%2,idx=Math.floor(i/2),x=214+idx*5.2+(row?19:-11),z=-131-idx*6.4+(row?8:-7);cottage(x,z,7+rnd()*5,7+rnd()*5,6+rnd()*5,0,i===7||i===10);
  }
  cottage(234,-128,14,13,12,0,true);tower(263,-194,3.5,14,{base:groundHeight(263,-194),roof:10,windows:true});
  // Railway platform and rails beyond the village.
  const railY=groundHeight(312,-207);box(312,railY+.3,-207,12,.6,48,mats.pale);building(319,-205,8,20,5,{base:railY+.6,rh:4});
  for(const x of[301,304])box(x,railY+.1,-213,.16,.18,120,mats.dark);
  for(let z=-270;z<-150;z+=2.7)box(302.5,railY-.1,z,4.4,.2,.4,mats.wood);
  // Lamplit paths; lamp meshes are batched, no costly point lights per window.
  const lanterns=[];
  function lantern(x,z){const y=groundHeight(x,z);cyl(x,y+2.6,z,.12,5.2,mats.dark);box(x,y+5.4,z,.6,.9,.6,mats.glow);cone(x,y+6,z,.6,.6,mats.dark);lanterns.push(new THREE.Vector3(x,y+5.3,z));}
  [[-80,-30],[-97,0],[-108,20],[62,-29],[90,-59],[125,-78],[168,-116],[215,-139],[235,-160],[253,-178],[274,-207],[-91,64],[-121,83]].forEach(([x,z])=>lantern(x,z));

  // Instanced forest: varied conifers and ancient broad-leaved trees.
  const treePositions=[];
  for(let i=0;i<1100;i++){
    const x=-350+rnd()*265,z=-270+rnd()*355;
    if((x+114)**2+(z-25)**2<600 || (x+164)**2+(z-122)**2<4800)continue;
    if(Math.abs(z+65)<9&&x>-220)continue;
    treePositions.push([x,z,7+rnd()*16,rnd()*6.28]);
  }
  for(let i=0;i<220;i++){const x=100+rnd()*290,z=-330+rnd()*125;if((x-246)**2+(z+180)**2>4800)treePositions.push([x,z,6+rnd()*12,rnd()*6.28]);}
  const trunkMat=new THREE.MeshStandardMaterial({color:0x544b3a,bumpMap:stoneBump,bumpScale:.12,roughness:1});
  const pineMat=new THREE.MeshStandardMaterial({color:0x9caa96,roughness:.95,side:THREE.DoubleSide});
  // Tiered, irregular branch whorls replace the smooth cones. Alternating radii
  // leave deep recesses between boughs while the broken edge catches sidelight.
  const needleV=[],needleI=[],needleColor=[],rings=16,radial=10;
  for(let j=0;j<=rings;j++){
    const t=j/rings,base=Math.pow(1-t,.82),whorl=j%2?.58:1;
    for(let k=0;k<=radial;k++){
      const a=k/radial*Math.PI*2,ruffle=1+.17*Math.sin(k*2.71+j*1.7)+.08*Math.cos(k*4.91-j*.8);
      const r=base*whorl*ruffle;
      needleV.push(Math.cos(a)*r, t+(j>0&&j<rings?Math.sin(k*3.7+j)*.016:0), Math.sin(a)*r);
      const shade=.77+t*.18+(j%2?0:.05);needleColor.push(shade*.96,shade,shade*.92);
      if(j<rings&&k<radial){const n=j*(radial+1)+k;needleI.push(n,n+radial+1,n+1,n+1,n+radial+1,n+radial+2);}
    }
  }
  const needleG=new THREE.BufferGeometry();needleG.setAttribute('position',new THREE.Float32BufferAttribute(needleV,3));needleG.setAttribute('color',new THREE.Float32BufferAttribute(needleColor,3));needleG.setIndex(needleI);needleG.computeVertexNormals();pineMat.vertexColors=true;
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.35,1,7),trunkMat,treePositions.length);
  const foliage=new THREE.InstancedMesh(needleG,pineMat,treePositions.length);
  treePositions.forEach(([x,z,h,rot],i)=>{
    const y=groundHeight(x,z);pos.set(x,y+h*.36,z);quat.setFromEuler(new THREE.Euler(0,rot,0));scale.set(h*.15,h*.72,h*.15);matrix.compose(pos,quat,scale);trunks.setMatrixAt(i,matrix);
    pos.set(x,y+h*.15,z);quat.setFromEuler(new THREE.Euler((rnd()-.5)*.06,rot,(rnd()-.5)*.06));scale.set(h*(.23+rnd()*.05),h*.9,h*(.23+rnd()*.05));matrix.compose(pos,quat,scale);foliage.setMatrixAt(i,matrix);
    foliage.setColorAt(i,new THREE.Color().setHSL(.37+rnd()*.07,.23+rnd()*.12,.22+rnd()*.15));
  });
  trunks.castShadow=true;foliage.castShadow=true;trunks.receiveShadow=true;foliage.receiveShadow=true;group.add(trunks,foliage);

  // Sparse understory: individual meadow blades and bracken-like clumps. They
  // avoid the castle, the village, the pitch, the shoreline and every path.
  const wind={value:0};
  const bladeV=[],bladeC=[];
  for(let j=0;j<4;j++){
    const a=j*Math.PI*.61,c=Math.cos(a),z=Math.sin(a),h=.65+j*.11,w=.075;
    const verts=[[-c*w,0,-z*w],[c*w,0,z*w],[c*.12,h*.57,z*.12],[-c*w,0,-z*w],[c*.12,h*.57,z*.12],[c*.23,h,z*.23]];
    verts.forEach((v,i)=>{bladeV.push(...v);const f=i===5?1:.55+(v[1]/h)*.35;bladeC.push(.49*f,.64*f,.35*f);});
  }
  const bladeG=new THREE.BufferGeometry();bladeG.setAttribute('position',new THREE.Float32BufferAttribute(bladeV,3));bladeG.setAttribute('color',new THREE.Float32BufferAttribute(bladeC,3));bladeG.computeVertexNormals();
  const grassMat=new THREE.MeshStandardMaterial({vertexColors:true,color:0xcbd4ac,side:THREE.DoubleSide,roughness:1});
  grassMat.onBeforeCompile=shader=>{shader.uniforms.uMeadowTime=wind;shader.vertexShader='uniform float uMeadowTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(uMeadowTime*.8 + instanceMatrix[3].x*.13 + instanceMatrix[3].z*.17)*position.y*position.y*.12;');};
  grassMat.customProgramCacheKey=()=> 'hogwart-meadow-wind';
  const grassPositions=[];
  for(let i=0;i<18000&&grassPositions.length<6800;i++){
    const x=-340+rnd()*690,z=-250+rnd()*430,y=groundHeight(x,z);
    if(x*x+z*z<11000||y<2||(x+164)**2/2500+(z-122)**2/6200<1.1||(x>190&&z<-110)||(x+114)**2+(z-25)**2<470)continue;
    if(pathSamples.some(p=>(x-p.x)**2+(z-p.z)**2<p.r*p.r))continue;
    const slope=Math.abs(groundHeight(x+1,z)-y)+Math.abs(groundHeight(x,z+1)-y);if(slope>1.1)continue;
    grassPositions.push([x,y,z]);
  }
  const grass=new THREE.InstancedMesh(bladeG,grassMat,grassPositions.length);
  grassPositions.forEach(([x,y,z],i)=>{pos.set(x,y+.03,z);quat.setFromEuler(new THREE.Euler(0,rnd()*Math.PI*2,0));const h=.65+rnd()*1.2;scale.set(h,h,h);matrix.compose(pos,quat,scale);grass.setMatrixAt(i,matrix);grass.setColorAt(i,new THREE.Color().setHSL(.19+rnd()*.07,.23,.5+rnd()*.18));});
  grass.receiveShadow=true;group.add(grass);
  // A few massive, distinctive trees at the forest threshold.
  const leafMat=new THREE.MeshStandardMaterial({color:0x2c4739,roughness:1,flatShading:true});
  for(let i=0;i<14;i++){const x=-142-rnd()*75,z=-30-rnd()*100,y=groundHeight(x,z),h=13+rnd()*10;put(cylinderG,trunkMat,x,y+h/2,z,1.1,h,1.1,rnd());for(let j=0;j<4;j++)put(cragG,leafMat,x+(rnd()-.5)*9,y+h+(rnd()-.5)*6,z+(rnd()-.5)*9,5+rnd()*3,5+rnd()*4,5+rnd()*3,rnd());}

  // A subtly rippled, reflective glacial lake. Fog integration keeps distant water soft.
  const lakeUniforms={uTime:{value:0},uColor:{value:new THREE.Color(0x254c58)},uSky:{value:new THREE.Color(0x8eaaa8)}};
  const lakeMat=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,lakeUniforms]),fog:true,transparent:true,opacity:.96,vertexShader:`
    uniform float uTime; varying vec3 vWorld; varying vec3 vNormal; varying vec3 vView;
    #include <fog_pars_vertex>
    void main(){vec3 p=position;p.z+=sin(p.x*.065+uTime*.28)*.16+cos(p.y*.091-uTime*.32)*.12;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*vec3(-.0104*cos(p.x*.065+uTime*.28),.01092*sin(p.y*.091-uTime*.32),1.));vView=cameraPosition-world.xyz;vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,fragmentShader:`
    uniform float uTime;uniform vec3 uColor;uniform vec3 uSky;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vView;
    #include <fog_pars_fragment>
    void main(){float fres=pow(1.-max(dot(normalize(vView),normalize(vNormal)),0.),2.8);float rip=sin(vWorld.x*.31+vWorld.z*.7+uTime*.4)*sin(vWorld.z*.16-uTime*.24);vec3 col=mix(uColor,uSky,fres*.55)+rip*.018;float shine=pow(max(dot(reflect(normalize(vec3(-.4,-.5,-.7)),normalize(vNormal)),normalize(vView)),0.),90.);col+=vec3(.48,.37,.18)*shine*.45;gl_FragColor=vec4(col,.97);
    #include <fog_fragment>
    }`});
  const lake=new THREE.Mesh(new THREE.PlaneGeometry(900,690,130,100),lakeMat);lake.rotation.x=-Math.PI/2;lake.position.set(0,.65,398);lake.renderOrder=1;group.add(lake);
  // Tiny drifting lights at the forest edge.
  const motePositions=new Float32Array(150*3);for(let i=0;i<150;i++){const x=-170+rnd()*95,z=-80+rnd()*120;motePositions[i*3]=x;motePositions[i*3+1]=groundHeight(x,z)+1+rnd()*10;motePositions[i*3+2]=z;}
  const moteG=new THREE.BufferGeometry();moteG.setAttribute('position',new THREE.BufferAttribute(motePositions,3));const motes=new THREE.Points(moteG,new THREE.PointsMaterial({color:0xe9cc86,size:.32,transparent:true,opacity:.7,sizeAttenuation:true,depthWrite:false}));group.add(motes);
  // Finish the static geometry into one draw call per material.
  function merge(geos){
    const non=geos.map(g=>g.index?g.toNonIndexed():g);let count=0;non.forEach(g=>count+=g.attributes.position.count);
    const p=new Float32Array(count*3),n=new Float32Array(count*3),uv=new Float32Array(count*2);let offset=0;
    non.forEach(g=>{p.set(g.attributes.position.array,offset*3);if(g.attributes.normal)n.set(g.attributes.normal.array,offset*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;});
    const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(p,3));out.setAttribute('normal',new THREE.BufferAttribute(n,3));out.setAttribute('uv',new THREE.BufferAttribute(uv,2));out.computeBoundingSphere();non.forEach(g=>g.dispose());geos.forEach(g=>g.dispose());return out;
  }
  for(const [material,geos] of buckets){const mesh=new THREE.Mesh(merge(geos),material);mesh.castShadow=material!==mats.glow&&material!==mats.glass;mesh.receiveShadow=true;group.add(mesh);}

  const locations=[
    {id:'castle',name:'Zamek Hogwart',position:[158,115,209],target:[0,51,0],category:'Zamek',description:'Wieże, dziedzińce i gotyckie skrzydła szkoły na skalistym brzegu Czarnego Jeziora.'},
    {id:'courtyard',name:'Dziedziniec',position:[30,43,67],target:[22,32,29],category:'Zamek',description:'Kamienne arkady, fontanna i przejścia do wschodniego skrzydła.'},
    {id:'astronomy',name:'Wieża Astronomiczna',position:[101,112,-83],target:[35,73,-34],category:'Zamek',description:'Najwyższe partie zamku i widok na całą dolinę.'},
    {id:'bridge',name:'Kamienny wiadukt',position:[155,57,100],target:[95,24,36],category:'Błonia',description:'Wysoki kamienny most łączący zamek z drogą przez wzgórza.'},
    {id:'lake',name:'Czarne Jezioro',position:[-76,19,254],target:[0,43,4],marker:[0,3,180],category:'Błonia',description:'Filmowa panorama zamku z wody. U stóp klifu leży przystań dla łodzi.'},
    {id:'boathouse',name:'Przystań',position:[77,14,168],target:[45,8,121],category:'Błonia',description:'Łodzie pierwszorocznych i długie schody prowadzące na zamkowy taras.'},
    {id:'hagrid',name:'Chatka Hagrida',position:[-144,hy+18,60],target:[-114,hy+5,25],category:'Błonia',description:'Kamienna chatka na skraju lasu, ogródek dyniowy i ścieżka do zamku.'},
    {id:'forest',name:'Zakazany Las',position:[-222,60,4],target:[-180,35,-70],category:'Błonia',description:'Gęsty, stary las za błoniami. Między drzewami migoczą świetliki.'},
    {id:'greenhouses',name:'Szklarnie',position:[111,53,15],target:[76,31,-15],category:'Błonia',description:'Trzy przeszklone szklarnie w pobliżu wschodniego skrzydła.'},
    {id:'quidditch',name:'Boisko do quidditcha',position:[-255,84,211],target:[-164,qy+5,122],category:'Błonia',description:'Owalna murawa, sześć obręczy i wieżowe trybuny w barwach czterech domów.'},
    {id:'hogsmeade',name:'Hogsmeade',position:[310,93,-106],target:[248,33,-170],category:'Okolica',description:'Kamienne domy, strome dachy, sklepiki i stacja kolejowa jedynej całkowicie czarodziejskiej wioski w Wielkiej Brytanii.'}
    ,{id:'owlery',name:'Sowiarnia',position:[-164,oy+35,-130],target:[-119,oy+14,-95],category:'Błonia',description:'Kamienna wieża na wzgórzu, z otwartymi łukowymi oknami dla szkolnych sów.'}
    ,{id:'willow',name:'Wierzba Bijąca',position:[-121,wy+22,85],target:[wx,wy+10,wz],category:'Błonia',description:'Stare drzewo o ciężkich, powykręcanych konarach, rosnące na zachodnich błoniach.'}
    ,{id:'coveredbridge',name:'Drewniany most',position:[-142,52,-14],target:[-97,35,-44],category:'Zamek',description:'Zadaszony drewniany most za dziedzińcem wieży zegarowej.'}
  ];
  return {group,locations,colliders,groundHeight,lake,materials:{stone:mats.stone,pale:mats.pale,wood:mats.wood,roof:mats.roof,terrain:terrain.material,cliff:cliffs.material},bounds:{minX:-430,maxX:410,minZ:-400,maxZ:470},update(time){wind.value=time;lakeMat.uniforms.uTime.value=time;motes.material.opacity=.5+Math.sin(time*.55)*.16;}};
}
