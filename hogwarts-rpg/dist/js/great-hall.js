import * as THREE from '../assets/three.module.js';
import { castleState } from './castle-state.js';

// The Great Hall's showpieces: an enchanted ceiling that shows the sky outside, hundreds of
// floating candles drawn in two draw calls, and a feast that appears on the tables at mealtimes.

// bench seats in room-local coordinates (row 0..3 = the four house tables)
export const HALL_TABLE_X = [0, 1, 2, 3].map((row) => (row - 1.5) * 5.6);
export const HALL_BENCH_X = 1.55; // bench centre, measured from the table's centre line
export const HALL_SEATS = [];
for (let row = 0; row < 4; row++)
  for (const side of [-1, 1])
    for (let z = -9; z <= 11; z += 2) HALL_SEATS.push({ row, x: HALL_TABLE_X[row] + side * HALL_BENCH_X, z, face: -side });
export const HALL_BENCH_LIFT = 0.33; // hall benches are higher than corridor benches

// sky palettes per time of day: 0 golden hour, 1 night, 2 morning
const SKY = [
  { top: '#2f528f', low: '#f09a5c', lit: '#ffd3a0', shade: '#7d5068', glow: '#ff9c58', stars: 0.0, cover: 0.5 },
  { top: '#03071a', low: '#12224a', lit: '#46557e', shade: '#0a1024', glow: '#7f9ae0', stars: 1.0, cover: 0.27 },
  { top: '#4f8fd2', low: '#cfe4f5', lit: '#ffffff', shade: '#93abc8', glow: '#fff0c8', stars: 0.0, cover: 0.42 },
];
const SKY_VERT = `
varying vec3 vW; varying vec3 vL;
void main(){ vL=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const SKY_FRAG = `
uniform float time,stars,cover; uniform vec3 top,low,lit,shade,glow;
varying vec3 vW; varying vec3 vL;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
void main(){
  vec3 d=normalize(vW-cameraPosition);
  // the ceiling opens straight up: there is no horizon inside a hall
  d=normalize(vec3(d.x,max(d.y,0.)*.9+.42,d.z));
  vec2 p=d.xz/d.y;
  float h=1.-d.y;
  vec3 col=mix(top,low,smoothstep(0.,.72,h));
  if(stars>.01){
    vec2 g=p*34.; vec2 id=floor(g); vec2 f=fract(g)-.5; float r=hash(id);
    vec2 off=(vec2(hash(id+3.1),hash(id+7.7))-.5)*.7;
    float s=smoothstep(.05+.07*r,0.,length(f-off))*step(.7,r);
    s*=.55+.45*sin(time*(1.2+r*3.)+r*40.);
    float band=exp(-pow(dot(p,normalize(vec2(.8,.6)))*1.5,2.));
    float milky=fbm(p*3.+4.)*band;
    col+=stars*(vec3(.92,.95,1.)*s*2.2+vec3(.3,.36,.6)*milky*.5);
  }
  vec2 q=p*1.1+vec2(time*.011,time*.0045);
  float c=fbm(q+fbm(q*1.7)*.6);
  float m=smoothstep(1.-cover-.12,1.-cover+.26,c);
  float light=fbm(q*1.9+2.7);
  vec3 cc=mix(shade,lit,smoothstep(.3,.75,light+(c-.5)*.6));
  col=mix(col,cc,m*.92);
  float gl=pow(max(dot(normalize(vec3(p.x,1.,p.y)),normalize(vec3(.25,1.,-.9))),0.),9.);
  col+=glow*gl*.4;
  // the stone vault dissolves into the sky above the walls
  float edge=smoothstep(10.9,13.6,vL.y+fbm(vL.xz*.35)*1.2-.6);
  gl_FragColor=vec4(mix(vec3(.035,.032,.04),col,edge),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const CANDLE_VERT = `
attribute float phase; uniform float time; varying float vY;
void main(){ vY=position.y; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); w.y+=sin(time*.7+phase)*.09; gl_Position=projectionMatrix*viewMatrix*w; }`;
const CANDLE_FRAG = `
varying float vY;
void main(){ vec3 wax=mix(vec3(.2,.13,.07),vec3(1.5,1.12,.62),smoothstep(-.3,.3,vY)); gl_FragColor=vec4(wax,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const FLAME_VERT = `
attribute float phase; uniform float time,scale; varying float vF;
void main(){ vec3 p=position; p.y+=sin(time*.7+phase)*.09;
  vF=.78+.22*sin(time*11.+phase*7.)*sin(time*6.3+phase*3.);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=.2*vF*scale/max(.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const FLAME_FRAG = `
varying float vF;
void main(){ vec2 u=gl_PointCoord-.5; float r=length(u*vec2(1.25,1.));
  float core=smoothstep(.16,.0,r), halo=smoothstep(.5,.0,r);
  vec3 col=vec3(1.,.62,.24)*halo*.55+vec3(1.,.93,.7)*core*1.7;
  gl_FragColor=vec4(col*vF,halo);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function vaultGeometry() {
  // the same pointed profile as the stone ribs, swept along the hall, plus the two gables
  const curve = new THREE.CatmullRomCurve3([[-13.6, 10.4], [-10, 13.2], [-6, 15.5], [0, 18], [6, 15.5], [10, 13.2], [13.6, 10.4]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const prof = curve.getPoints(28), Z0 = -18.6, Z1 = 18.6, pos = [], idx = [];
  prof.forEach((p) => { pos.push(p.x, p.y + 0.12, Z0, p.x, p.y + 0.12, Z1); });
  for (let i = 0; i < prof.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  for (const z of [Z0, Z1]) {
    const base = pos.length / 3; pos.push(0, 10.4, z);
    prof.forEach((p) => pos.push(p.x, p.y + 0.12, z));
    for (let i = 0; i < prof.length - 1; i++) idx.push(base, base + 1 + i, base + 2 + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

export function createHallMagic({ random = Math.random, candles = 420 } = {}) {
  const group = new THREE.Group(); group.userData.noBatch = true;
  const disposable = [];
  // ---------------------------------------------------------------- enchanted ceiling
  const skyU = { time: { value: 0 }, stars: { value: 0 }, cover: { value: 0.5 }, top: { value: new THREE.Color() }, low: { value: new THREE.Color() }, lit: { value: new THREE.Color() }, shade: { value: new THREE.Color() }, glow: { value: new THREE.Color() } };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.DoubleSide, fog: false });
  const vault = new THREE.Mesh(vaultGeometry(), skyMat); vault.userData.skipAO = true; vault.frustumCulled = false; group.add(vault);
  disposable.push(vault.geometry, skyMat);
  const target = SKY.map((s) => ({ ...s, top: new THREE.Color(s.top), low: new THREE.Color(s.low), lit: new THREE.Color(s.lit), shade: new THREE.Color(s.shade), glow: new THREE.Color(s.glow) }));
  let skyInit = false;
  function sky(k) {
    const t = target[castleState.skyMode] || target[0];
    for (const key of ['top', 'low', 'lit', 'shade', 'glow']) skyU[key].value.lerp(t[key], k);
    skyU.stars.value += (t.stars - skyU.stars.value) * k; skyU.cover.value += (t.cover - skyU.cover.value) * k;
  }
  // ---------------------------------------------------------------- floating candles
  const body = new THREE.CylinderGeometry(0.035, 0.04, 0.6, 6, 1);
  const phases = new Float32Array(candles), tips = new Float32Array(candles * 3), m = new THREE.Matrix4();
  const timeU = { value: 0 }, scaleU = { value: 400 };
  const wax = new THREE.InstancedMesh(body, new THREE.ShaderMaterial({ uniforms: { time: timeU }, vertexShader: CANDLE_VERT, fragmentShader: CANDLE_FRAG }), candles);
  const cols = 14, rows = Math.ceil(candles / cols);
  for (let i = 0; i < candles; i++) {
    const cx = i % cols, cz = Math.floor(i / cols);
    const x = -11.4 + ((cx + 0.15 + random() * 0.7) / cols) * 22.8, z = -15.6 + ((cz + 0.15 + random() * 0.7) / rows) * 31.2, y = 6.4 + random() * random() * 5.6 + random() * 0.8, s = 0.75 + random() * 0.5;
    m.makeScale(s, s, s); m.setPosition(x, y, z); wax.setMatrixAt(i, m);
    phases[i] = random() * 6.283; tips.set([x, y + 0.36 * s, z], i * 3);
  }
  body.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
  wax.frustumCulled = false; wax.userData.skipAO = true; group.add(wax);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(tips, 3)); fg.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const flames = new THREE.Points(fg, new THREE.ShaderMaterial({ uniforms: { time: timeU, scale: scaleU }, vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flames.frustumCulled = false; flames.userData.skipAO = true; flames.renderOrder = 4; group.add(flames);
  disposable.push(body, wax.material, fg, flames.material);
  // ---------------------------------------------------------------- the feast
  const feast = new THREE.Group(); feast.position.y = 1.33; feast.visible = false; feast.scale.y = 0.001; group.add(feast);
  const round = [], flat = [];   // [x,y,z, sx,sy,sz, colour]
  const FRUIT = ['#b5332b', '#d98a2b', '#7fa33a', '#8e2f52', '#e2b93b'];
  HALL_TABLE_X.forEach((x, row) => {
    let k = row * 2;
    for (let z = -8; z <= 10; z += 2, k++) {
      const ox = (random() - 0.5) * 0.3;
      switch (k % 5) {
        case 0: // roast on a platter
          flat.push([x + ox, 0.02, z, 0.42, 0.03, 0.42, '#b08a3a']); round.push([x + ox, 0.17, z, 0.3, 0.17, 0.2, '#6f3518']);
          round.push([x + ox + 0.3, 0.07, z + 0.12, 0.07, 0.06, 0.07, '#c7772e'], [x + ox - 0.28, 0.07, z - 0.14, 0.07, 0.06, 0.07, '#7fa33a']);
          break;
        case 1: // bread basket
          flat.push([x + ox, 0.05, z, 0.3, 0.1, 0.3, '#6a4a2a']);
          for (let i = 0; i < 3; i++) round.push([x + ox + Math.cos(i * 2.1) * 0.12, 0.15 + (i === 2 ? 0.07 : 0), z + Math.sin(i * 2.1) * 0.12, 0.17, 0.09, 0.11, '#c68a45']);
          break;
        case 2: // fruit pyramid in a bowl
          flat.push([x + ox, 0.04, z, 0.28, 0.08, 0.28, '#b08a3a']);
          for (let i = 0; i < 7; i++) { const a = i * 1.05, r = i < 6 ? 0.14 : 0; round.push([x + ox + Math.cos(a) * r, i < 6 ? 0.14 : 0.25, z + Math.sin(a) * r, 0.075, 0.075, 0.075, FRUIT[(i + k) % FRUIT.length]]); }
          break;
        case 3: // pie and a jug
          flat.push([x + ox, 0.06, z, 0.3, 0.12, 0.3, '#d4a050'], [x + ox, 0.125, z, 0.24, 0.02, 0.24, '#b4722e']);
          flat.push([x - ox * 2, 0.18, z + 0.62, 0.1, 0.36, 0.1, '#b99a4a']);
          break;
        default: // pudding tower
          flat.push([x + ox, 0.02, z, 0.36, 0.03, 0.36, '#b08a3a']);
          round.push([x + ox, 0.14, z, 0.26, 0.16, 0.26, '#e8d49a'], [x + ox, 0.3, z, 0.17, 0.12, 0.17, '#e3c98a'], [x + ox, 0.42, z, 0.06, 0.06, 0.06, '#b5332b']);
      }
    }
  });
  const c = new THREE.Color(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const [list, geo] of [[round, new THREE.SphereGeometry(1, 12, 9)], [flat, new THREE.CylinderGeometry(1, 0.9, 1, 14)]]) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.05 });
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { m.compose(v.set(it[0], it[1], it[2]), q, sc.set(it[3], it[4], it[5])); inst.setMatrixAt(i, m); inst.setColorAt(i, c.set(it[6])); });
    inst.instanceColor.needsUpdate = true; inst.castShadow = false; inst.receiveShadow = true; feast.add(inst); disposable.push(geo, mat);
  }
  let shown = 0, last = null;
  return {
    group, feast,
    counts: { candles, food: round.length + flat.length },
    update(time) {
      const dt = last === null ? 0 : Math.min(0.1, Math.max(0, time - last)); last = time;
      skyU.time.value = time; timeU.value = time;
      scaleU.value = (typeof innerHeight === 'number' ? innerHeight : 720) * 0.5 * (typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1) * 2.2;
      sky(skyInit ? 1 - Math.exp(-dt * 0.9) : 1); skyInit = true;
      // dishes rise out of the table when the meal bell rings and sink back afterwards
      const want = castleState.meal ? 1 : 0;
      shown += Math.sign(want - shown) * Math.min(Math.abs(want - shown), dt / 0.9);
      const e = shown * shown * (3 - 2 * shown);
      feast.visible = shown > 0.002; feast.scale.set(1, Math.max(0.001, e * (1 + 0.18 * Math.sin(e * Math.PI))), 1);
    },
    dispose() { for (const d of disposable) d.dispose?.(); wax.dispose?.(); },
  };
}
