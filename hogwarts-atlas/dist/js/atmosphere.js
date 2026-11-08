import * as THREE from '../assets/three.module.js';

/*
 * Atmosphere: analytic height fog, the four times of day and the small signs of
 * life around the castle (birds, pennants, lantern halos).
 *
 * The height fog patches three.js shader chunks once, before any material is
 * compiled, so every fogged material — standard, basic, points, the lake and the
 * reflective water — shares one valley mist.
 */

// ---------------------------------------------------------------------------
// Height fog
// ---------------------------------------------------------------------------

/** A Vector4 that is shared by reference when three.js clones uniforms. */
class SharedVector4 extends THREE.Vector4 {
  clone() {
    return this;
  }
}

/** x: density, y: height falloff, z: base height (world Y), w: unused. */
export const fogHeightParams = new SharedVector4(0, 0.05, 0, 0);

let installed = false;
function installHeightFog() {
  if (installed) return;
  installed = true;
  const chunks = THREE.ShaderChunk;
  chunks.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorldPosition;
#endif`;
  // mvPosition is defined by every shader that includes fog_vertex. The view
  // matrix is orthonormal, so its transpose rotates view space back to world space.
  chunks.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorldPosition = cameraPosition + ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif`;
  chunks.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec4 fogHeightParams;
  varying float vFogDepth;
  varying vec3 vFogWorldPosition;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  chunks.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  if ( fogHeightParams.x > 0.0 ) {
    // Closed-form optical depth of density * exp(-falloff * height) along the view ray.
    vec3 fogRay = vFogWorldPosition - cameraPosition;
    float fogDistance = length( fogRay );
    float falloff = max( fogHeightParams.y, 1e-4 );
    float eyeHeight = cameraPosition.y - fogHeightParams.z;
    float rise = fogRay.y;
    float depth;
    if ( abs( rise ) > 0.01 * fogDistance ) {
      depth = ( exp( min( -falloff * eyeHeight, 30.0 ) ) - exp( min( -falloff * ( eyeHeight + rise ), 30.0 ) ) )
        / ( falloff * rise ) * fogDistance;
    } else {
      depth = exp( min( -falloff * ( eyeHeight + rise * 0.5 ), 30.0 ) ) * fogDistance;
    }
    float mist = 1.0 - exp( - fogHeightParams.x * max( depth, 0.0 ) );
    fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - min( mist, 0.985 ) );
  }
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
  // New ShaderMaterials that merge UniformsLib.fog receive the shared vector...
  THREE.UniformsLib.fog.fogHeightParams = { value: fogHeightParams };
  // ...and so do the built-in materials, whose uniforms were merged at import time.
  for (const shader of Object.values(THREE.ShaderLib)) {
    if (shader.uniforms?.fogColor && !shader.uniforms.fogHeightParams)
      shader.uniforms.fogHeightParams = { value: fogHeightParams };
  }
}
installHeightFog();

export function setHeightFog(density = 0, falloff = 0.05, base = 0) {
  fogHeightParams.set(Math.max(0, density), Math.max(1e-4, falloff), base, 0);
}

// ---------------------------------------------------------------------------
// Times of day
// ---------------------------------------------------------------------------

/*
 * Order matters: the time button cycles 0 → 1 → 2 → 3. Each state describes the
 * whole exterior look. `mist` is [density, falloff, base height].
 */
export const TIME_STATES = [
  {
    id: 'dusk',
    name: 'Zmierzch',
    zenith: '#3c6684',
    horizon: '#bac9bd',
    low: '#899d98',
    cloud: '#b9c1b6',
    skySun: '#ffdfac',
    night: 0,
    brightness: 0.92,
    sunDirection: [-0.72, 0.27, 0.39],
    sunColor: '#ffd8a6',
    sun: 3.4,
    hemiSky: '#b5d0dc',
    hemiGround: '#3e4135',
    hemi: 2.1,
    fillColor: '#7fbaef',
    fill: 1.2,
    exposure: 1.22,
    background: '#77949c',
    fogColor: '#7b9497',
    fogDensity: 0.00142,
    mist: [0.0062, 0.07, 1.5],
    stars: 0.28,
    waterSun: '#ffda9f',
    waterColor: '#173e47',
    distortion: 2.8,
    windows: 1.25,
    lanterns: 0.75,
    fireflies: 0.65,
    environment: 0.4,
    gradeContrast: 1.07,
    gradeSaturation: 1.08,
    gradeShadow: [-0.004, 0.002, 0.02],
    gradeHighlight: [0.03, 0.012, -0.016],
    vignette: 0.24,
  },
  {
    id: 'night',
    name: 'Noc',
    zenith: '#071225',
    horizon: '#273e57',
    low: '#172c3c',
    cloud: '#354c62',
    skySun: '#cddffa',
    night: 1,
    brightness: 0.64,
    sunDirection: [-0.35, 0.49, -0.68],
    sunColor: '#a9c2ec',
    sun: 1.45,
    hemiSky: '#7a98c2',
    hemiGround: '#2a3440',
    hemi: 1.35,
    fillColor: '#7fb1e6',
    fill: 0.85,
    exposure: 1.3,
    background: '#0c1a2e',
    fogColor: '#142b3b',
    fogDensity: 0.0015,
    mist: [0.0085, 0.065, 1.5],
    stars: 0.95,
    waterSun: '#99bce5',
    waterColor: '#071b2c',
    distortion: 2,
    windows: 3.4,
    lanterns: 1.5,
    fireflies: 1,
    environment: 0.26,
    gradeContrast: 1.08,
    gradeSaturation: 0.96,
    gradeShadow: [-0.006, 0.0, 0.026],
    gradeHighlight: [0.022, 0.012, -0.004],
    vignette: 0.3,
  },
  {
    id: 'morning',
    name: 'Poranek',
    zenith: '#5a8cb9',
    horizon: '#d6ddd0',
    low: '#a7bdbe',
    cloud: '#e8e8da',
    skySun: '#ffedce',
    night: 0,
    brightness: 1.06,
    sunDirection: [0.7, 0.3, -0.4],
    sunColor: '#ffe7c4',
    sun: 3.9,
    hemiSky: '#c4dbe4',
    hemiGround: '#4a503f',
    hemi: 2.45,
    fillColor: '#9cc7ec',
    fill: 0.9,
    exposure: 1.16,
    background: '#b6cbd0',
    fogColor: '#b2c7c8',
    fogDensity: 0.00118,
    mist: [0.016, 0.1, 1],
    stars: 0,
    waterSun: '#ffe9c5',
    waterColor: '#24555b',
    distortion: 2.6,
    windows: 0.45,
    lanterns: 0.12,
    fireflies: 0,
    environment: 0.5,
    gradeContrast: 1.03,
    gradeSaturation: 1.04,
    gradeShadow: [0.0, 0.006, 0.014],
    gradeHighlight: [0.02, 0.012, 0.0],
    vignette: 0.18,
  },
  {
    id: 'day',
    name: 'Dzień',
    zenith: '#3f7cb6',
    horizon: '#c8d9de',
    low: '#9ab4ba',
    cloud: '#f1f1e9',
    skySun: '#fff4dc',
    night: 0,
    brightness: 1.12,
    sunDirection: [0.32, 0.82, 0.47],
    sunColor: '#fff3df',
    sun: 4.3,
    hemiSky: '#c9dfee',
    hemiGround: '#4e5541',
    hemi: 2.5,
    fillColor: '#9fc6ee',
    fill: 0.7,
    exposure: 1.02,
    background: '#a9c3cf',
    fogColor: '#a7bfc8',
    fogDensity: 0.00104,
    mist: [0.0035, 0.08, 0],
    stars: 0,
    waterSun: '#fff6e2',
    waterColor: '#1f4f5a',
    distortion: 3.1,
    windows: 0.18,
    lanterns: 0,
    fireflies: 0,
    environment: 0.55,
    gradeContrast: 1.05,
    gradeSaturation: 1.1,
    gradeShadow: [-0.002, 0.002, 0.01],
    gradeHighlight: [0.012, 0.008, -0.006],
    vignette: 0.16,
  },
];

const _a = new THREE.Color(),
  _b = new THREE.Color();
/** Interpolates two time states key by key (numbers, colours and vectors). */
export function mixStates(from, to, t) {
  const out = {};
  for (const key of Object.keys(to)) {
    const a = from[key] ?? to[key],
      b = to[key];
    if (typeof b === 'number') out[key] = a + (b - a) * t;
    else if (typeof b === 'string' && b[0] === '#') out[key] = _a.set(a).lerp(_b.set(b), t).clone();
    else if (b?.isColor) out[key] = _a.set(a).lerp(b, t).clone();
    else if (Array.isArray(b)) out[key] = b.map((v, i) => (a[i] ?? v) + (v - (a[i] ?? v)) * t);
    else out[key] = t < 0.5 ? a : b;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weather: rain, snow and the snow that settles on roofs, trees and mountains
// ---------------------------------------------------------------------------

export const WEATHERS = [
  { id: 'clear', name: 'Pogodnie', icon: '☼' },
  { id: 'rain', name: 'Deszcz', icon: '☂' },
  { id: 'snow', name: 'Śnieg', icon: '❄' },
];

/** 0 = bare, 1 = fully white. Shared by every material passed to addSnowCover. */
export const snowCover = { value: 0 };

/**
 * Whitens upward-facing surfaces of a lit material in proportion to snowCover.
 * Chains any existing onBeforeCompile and keeps program cache keys distinct.
 */
export function addSnowCover(material, { slope = [0.45, 0.8], strength = 1 } = {}) {
  if (!material || material.userData.snow) return;
  material.userData.snow = true;
  const previous = material.onBeforeCompile;
  const previousKey =
    material.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey
      ? previous.toString()
      : material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uSnowCover = snowCover;
    shader.fragmentShader =
      'uniform float uSnowCover;\n' +
      shader.fragmentShader.replace(
        '#include <lights_physical_fragment>',
        `{
        vec3 snowNormal = inverseTransformDirection( normal, viewMatrix );
        float snowMask = smoothstep( ${slope[0].toFixed(3)}, ${slope[1].toFixed(3)}, snowNormal.y ) * uSnowCover * ${strength.toFixed(3)};
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.78, 0.81, 0.86 ), clamp( snowMask, 0.0, 1.0 ) );
        roughnessFactor = mix( roughnessFactor, 0.7, clamp( snowMask, 0.0, 1.0 ) );
      }
      #include <lights_physical_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `${previousKey}|snow:${slope}:${strength}`;
  material.needsUpdate = true;
}

/** Overcast skies, wet or snowy air: applied on top of a time-of-day state. */
export function weatherize(look, rain = 0, snow = 0) {
  const a = Math.min(1, rain + snow);
  if (a <= 0.001) return look.overcast === undefined ? { ...look, overcast: 0 } : look;
  const out = { ...look };
  const grey = new THREE.Color(snow > rain ? '#a7b2b9' : '#7e8c90');
  const nightGrey = new THREE.Color(snow > rain ? '#3a4b5c' : '#1a2833');
  const tint = new THREE.Color().lerpColors(grey, nightGrey, look.night);
  const mixColor = (key, amount) => (out[key] = new THREE.Color(look[key]).lerp(tint, amount));
  out.overcast = a;
  out.fogDensity = look.fogDensity * (1 + 0.5 * rain + 0.6 * snow);
  out.mist = [look.mist[0] + 0.0025 * a, look.mist[1], look.mist[2]];
  mixColor('fogColor', 0.42 * a);
  mixColor('background', 0.5 * a);
  mixColor('horizon', 0.5 * a);
  mixColor('low', 0.5 * a);
  mixColor('cloud', 0.4 * a);
  mixColor('zenith', 0.35 * a);
  out.sun = look.sun * (1 - 0.62 * a);
  out.hemi = look.hemi * (1 - 0.08 * a) + 0.12 * snow;
  out.brightness = look.brightness * (1 - 0.12 * rain);
  out.stars = look.stars * (1 - a);
  out.environment = look.environment * (1 - 0.25 * a);
  out.distortion = look.distortion + 2.2 * rain;
  out.exposure = look.exposure * (1 - 0.05 * snow * (1 - look.night));
  out.gradeSaturation = look.gradeSaturation * (1 - 0.14 * rain);
  out.gradeContrast = look.gradeContrast * (1 - 0.03 * a);
  return out;
}

/**
 * Rain streaks or snowflakes in a box that follows the camera. The particles
 * wrap around in the vertex shader, so nothing is updated on the CPU.
 */
export function createPrecipitation(scene) {
  const COUNT = 9000,
    BOX = new THREE.Vector3(170, 110, 170);
  const positions = new Float32Array(COUNT * 3),
    seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = Math.random() * BOX.x;
    positions[i * 3 + 1] = Math.random() * BOX.y;
    positions[i * 3 + 2] = Math.random() * BOX.z;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const uniforms = {
    uTime: { value: 0 },
    uBox: { value: BOX },
    uCenter: { value: new THREE.Vector3() },
    uSnow: { value: 0 },
    uAmount: { value: 0 },
    uColor: { value: new THREE.Color('#c9d6e0') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uSnow, uAmount; uniform vec3 uBox, uCenter;
      varying float vAlpha; varying float vSnow;
      void main() {
        float fall = mix( 58.0 + aSeed * 18.0, 3.2 + aSeed * 1.6, uSnow );
        vec3 p = position;
        p.y -= uTime * fall;
        p.x += uTime * mix( 6.0, 1.4, uSnow ) + uSnow * sin( uTime * 0.7 + aSeed * 40.0 ) * 1.6;
        p.z += uSnow * cos( uTime * 0.53 + aSeed * 31.0 ) * 1.6;
        vec3 world = mod( p - uCenter + uBox * 0.5, uBox ) + uCenter - uBox * 0.5;
        vec4 mv = viewMatrix * vec4( world, 1.0 );
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        gl_PointSize = clamp( mix( 70.0, 30.0, uSnow ) * ( 0.6 + aSeed * 0.6 ) / max( depth, 1.0 ), 1.0, mix( 26.0, 9.0, uSnow ) );
        float density = step( aSeed, uAmount * mix( 1.0, 0.75, uSnow ) );
        vAlpha = density * smoothstep( 1.0, 4.0, depth ) * ( 1.0 - smoothstep( 55.0, 85.0, depth ) );
        vSnow = uSnow;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha; varying float vSnow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float flake = 1.0 - smoothstep( 0.15, 0.5, length( c ) );
        float streak = ( 1.0 - smoothstep( 0.0, 0.07, abs( c.x + c.y * 0.12 ) ) ) * ( 1.0 - smoothstep( 0.3, 0.5, abs( c.y ) ) );
        float shape = mix( streak * 0.55, flake * 0.9, vSnow );
        if ( shape * vAlpha < 0.01 ) discard;
        gl_FragColor = vec4( uColor * mix( 0.9, 1.25, vSnow ), shape * vAlpha );
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.userData.skipAO = true;
  points.renderOrder = 5;
  points.visible = false;
  scene.add(points);
  return {
    update(time, camera, rain, snow, hidden) {
      const amount = Math.max(rain, snow);
      points.visible = !hidden && amount > 0.01;
      if (!points.visible) return;
      uniforms.uTime.value = time;
      uniforms.uCenter.value.copy(camera.position);
      uniforms.uAmount.value = amount;
      uniforms.uSnow.value = snow / Math.max(amount, 1e-4);
    },
    setTint(color) {
      uniforms.uColor.value.set(color);
    },
  };
}

/** Stars with individual sizes that twinkle. Hidden in daylight. */
export function createStars(scene) {
  const COUNT = 2200,
    positions = new Float32Array(COUNT * 3),
    data = new Float32Array(COUNT * 2);
  let seed = 19;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < COUNT; i++) {
    const a = random() * Math.PI * 2,
      b = Math.acos(1 - random() * 0.98),
      r = 1100;
    positions.set([Math.cos(a) * Math.sin(b) * r, Math.cos(b) * r, Math.sin(a) * Math.sin(b) * r], i * 3);
    data[i * 2] = Math.pow(random(), 5) * 2.6 + 0.7;
    data[i * 2 + 1] = random() * 100;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aStar', new THREE.BufferAttribute(data, 2));
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0.3 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec2 aStar; uniform float uTime; varying float vTwinkle; varying float vSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mv;
        vTwinkle = 0.65 + 0.35 * sin( uTime * ( 0.8 + fract( aStar.y ) * 2.6 ) + aStar.y );
        vSize = aStar.x;
        gl_PointSize = aStar.x * 1.6;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vTwinkle; varying float vSize;
      void main() {
        float d = length( gl_PointCoord - 0.5 ) * 2.0;
        float core = 1.0 - smoothstep( 0.0, 1.0, d );
        vec3 tint = mix( vec3( 0.86, 0.9, 1.0 ), vec3( 1.0, 0.93, 0.8 ), fract( vSize * 7.0 ) );
        gl_FragColor = vec4( tint, core * core * vTwinkle * uOpacity );
      }`,
  });
  const stars = new THREE.Points(geometry, material);
  stars.userData.skipAO = true;
  stars.renderOrder = -900;
  stars.frustumCulled = false;
  scene.add(stars);
  return {
    points: stars,
    set opacity(value) {
      uniforms.uOpacity.value = value;
      stars.visible = value > 0.01;
    },
    update(time, camera) {
      uniforms.uTime.value = time;
      stars.position.copy(camera.position);
    },
  };
}

// ---------------------------------------------------------------------------
// Life: birds, pennants and lantern halos
// ---------------------------------------------------------------------------

function radialTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'),
    gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Adds ambient life to the exterior world group. Everything here is cheap:
 * one instanced mesh for birds, one for pennants, one point cloud of halos.
 */
export function createLife(world) {
  const owned = [];
  const own = x => (owned.push(x), x);
  const wind = { value: 0 };
  const group = new THREE.Group();
  group.name = 'Ambient life';
  world.group.add(group);

  // Birds: two-triangle silhouettes, wings flap in the vertex shader.
  const birdGeometry = own(new THREE.BufferGeometry());
  birdGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-1.3, 0.12, 0.35, 0, 0, -0.45, 0, 0, 0.55, 0, 0, -0.45, 1.3, 0.12, 0.35, 0, 0, 0.55],
      3,
    ),
  );
  birdGeometry.computeVertexNormals();
  const birdMaterial = own(
    new THREE.MeshBasicMaterial({ color: '#1b2226', side: THREE.DoubleSide, fog: true }),
  );
  birdMaterial.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind;
    shader.vertexShader =
      'uniform float uWind;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float flapPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
      #else
        float flapPhase = 0.0;
      #endif
      transformed.y += sin( uWind * 9.0 + flapPhase ) * abs( position.x ) * 0.55;`,
      );
  };
  birdMaterial.customProgramCacheKey = () => 'atlas-bird-flap';
  // Owls first: at night only the first flock keeps flying.
  const flocks = [
    { center: [-119, 0, -95], radius: 22, height: 0, count: 7, speed: 0.22, ground: true, owls: true },
    { center: [4, 0, -8], radius: 70, height: 104, count: 14, speed: 0.11 },
    { center: [60, 0, 160], radius: 120, height: 48, count: 9, speed: 0.06 },
  ];
  const birds = [];
  for (const flock of flocks) {
    const base = flock.ground ? world.groundHeight(flock.center[0], flock.center[2]) + 34 : flock.height;
    for (let i = 0; i < flock.count; i++)
      birds.push({
        cx: flock.center[0],
        cz: flock.center[2],
        y: base + ((i * 7.3) % 13) - 6,
        r: flock.radius * (0.72 + ((i * 0.618) % 1) * 0.55),
        phase: i * 2.399 + flock.radius,
        speed: flock.speed * (0.85 + ((i * 0.37) % 0.3)) * (i % 4 === 0 ? -1 : 1),
        bob: 1.5 + (i % 3),
        scale: flock.ground ? 0.85 : 1.15,
      });
  }
  const birdMesh = new THREE.InstancedMesh(birdGeometry, birdMaterial, birds.length);
  birdMesh.frustumCulled = false;
  birdMesh.userData.skipAO = true;
  // Crows and jackdaws around the towers; pale barn owls around the owlery.
  const owlCount = flocks[0].count;
  for (let i = 0; i < birds.length; i++)
    birdMesh.setColorAt(i, new THREE.Color(i < owlCount ? '#b9ab8f' : '#1b2226'));
  birdMaterial.color.set('#ffffff');
  group.add(birdMesh);

  // First-years' boats: a lantern-lit procession across the loch after sunset.
  const boatGroup = new THREE.Group();
  boatGroup.name = 'Lantern boats';
  group.add(boatGroup);
  const hullGeometry = own(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  hullGeometry.rotateX(Math.PI);
  const hullMaterial = own(new THREE.MeshStandardMaterial({ color: '#3b2b22', roughness: 0.85 }));
  const rimMaterial = own(new THREE.MeshStandardMaterial({ color: '#6b5238', roughness: 0.7 }));
  const poleGeometryBoat = own(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5));
  const lanternGeometry = own(new THREE.BoxGeometry(0.42, 0.55, 0.42));
  const lanternMaterial = own(
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc477').multiplyScalar(4) }),
  );
  const rimGeometry = own(new THREE.TorusGeometry(1, 0.06, 5, 20));
  rimGeometry.rotateX(Math.PI / 2);
  const boats = [];
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(hullGeometry, hullMaterial);
    hull.scale.set(1.15, 0.5, 2.4);
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.scale.set(1.15, 1, 2.4);
    const pole = new THREE.Mesh(poleGeometryBoat, rimMaterial);
    pole.position.set(0, 1.1, -1.9);
    const lantern = new THREE.Mesh(lanternGeometry, lanternMaterial);
    lantern.position.set(0, 2.25, -1.9);
    boat.add(hull, rim, pole, lantern);
    boatGroup.add(boat);
    boats.push({ boat, lane: (i % 3) - 1, offset: i / 6 });
  }
  const boatHaloGeometry = own(new THREE.BufferGeometry());
  boatHaloGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(boats.length * 3), 3),
  );
  const boatHalos = new THREE.Points(
    boatHaloGeometry,
    own(
      new THREE.PointsMaterial({
        map: own(
          radialTexture([
            [0, 'rgba(255,236,190,1)'],
            [0.15, 'rgba(255,200,110,.6)'],
            [0.45, 'rgba(255,150,60,.12)'],
            [1, 'rgba(255,120,40,0)'],
          ]),
        ),
        color: '#ffd391',
        size: 7,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  boatHalos.frustumCulled = false;
  boatHalos.userData.skipAO = true;
  boatGroup.add(boatHalos);
  const boatStart = new THREE.Vector3(-150, 0.75, 470),
    boatMid = new THREE.Vector3(-40, 0.75, 300),
    boatEnd = new THREE.Vector3(42, 0.75, 168);
  const boatCurve = new THREE.QuadraticBezierCurve3(boatStart, boatMid, boatEnd);
  const boatPoint = new THREE.Vector3(),
    boatTangent = new THREE.Vector3();

  // Pennants on the tallest roofs, in the four house colours.
  const towerTops = [
    [0, 3, 117.2],
    [37, -35, 112.2],
    [11, 7, 95.2],
    [-13, -1, 91.2],
    [-29, -31, 80.2],
    [-57, -31, 80.2],
  ];
  const flagColors = ['#8a2f2a', '#2e4f6a', '#b0913f', '#2f5a43'];
  const flagGeometry = own(new THREE.PlaneGeometry(6, 1.7, 18, 2));
  flagGeometry.translate(3, 0, 0);
  const fp = flagGeometry.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const u = fp.getX(i) / 6;
    fp.setY(i, fp.getY(i) * (1 - u * 0.78));
  }
  flagGeometry.computeVertexNormals();
  const flagMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, side: THREE.DoubleSide }),
  );
  flagMaterial.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind;
    shader.vertexShader =
      'uniform float uWind;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float flagPhase = instanceMatrix[3].x * 0.19;
      #else
        float flagPhase = 0.0;
      #endif
      float along = position.x / 6.0;
      transformed.z += sin( position.x * 1.15 - uWind * 5.2 + flagPhase ) * 0.42 * along;
      transformed.y += sin( position.x * 0.8 - uWind * 3.1 + flagPhase ) * 0.16 * along;`,
      );
  };
  flagMaterial.customProgramCacheKey = () => 'atlas-pennant-wave';
  const flags = new THREE.InstancedMesh(flagGeometry, flagMaterial, towerTops.length);
  const poleGeometry = own(new THREE.CylinderGeometry(0.09, 0.12, 6, 6));
  const poleMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#2b3236', metalness: 0.5, roughness: 0.5 }),
  );
  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, towerTops.length);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    p = new THREE.Vector3(),
    s = new THREE.Vector3(1, 1, 1);
  towerTops.forEach(([x, z, y], i) => {
    p.set(x, y + 3, z);
    q.identity();
    m.compose(p, q, s);
    poles.setMatrixAt(i, m);
    // The prevailing wind blows from the loch towards the forest.
    p.set(x, y + 5.1, z);
    q.setFromEuler(new THREE.Euler(0, 2.35 + i * 0.08, 0));
    m.compose(p, q, s);
    flags.setMatrixAt(i, m);
    flags.setColorAt(i, new THREE.Color(flagColors[i % flagColors.length]));
  });
  group.add(flags, poles);

  // Lantern halos: soft additive discs that fade in after sunset.
  const halos = (() => {
    const positions = (world.lanterns || []).flatMap(v => [v.x, v.y, v.z]);
    if (!positions.length) return null;
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = own(
      new THREE.PointsMaterial({
        map: own(
          radialTexture([
            [0, 'rgba(255,236,190,1)'],
            [0.12, 'rgba(255,205,120,.7)'],
            [0.4, 'rgba(255,160,70,.16)'],
            [1, 'rgba(255,120,40,0)'],
          ]),
        ),
        color: '#ffd391',
        size: 9,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const points = new THREE.Points(geometry, material);
    points.userData.skipAO = true;
    group.add(points);
    return points;
  })();

  const birdMatrix = new THREE.Matrix4(),
    birdQuat = new THREE.Quaternion(),
    birdPos = new THREE.Vector3(),
    birdScale = new THREE.Vector3(),
    birdEuler = new THREE.Euler();
  let look = { lanterns: 0, night: 0 };
  function updateBoats(time) {
    boatGroup.visible = look.lanterns > 0.3;
    if (!boatGroup.visible) return;
    const halo = boatHaloGeometry.attributes.position;
    boats.forEach((b, i) => {
      // One crossing takes three minutes; boats sail in three loose lanes.
      const u = (time / 180 + b.offset) % 1;
      boatCurve.getPointAt(u, boatPoint);
      boatCurve.getTangentAt(u, boatTangent);
      const side = new THREE.Vector3(-boatTangent.z, 0, boatTangent.x).normalize();
      b.boat.position.copy(boatPoint).addScaledVector(side, b.lane * 7);
      b.boat.position.y = 0.75 + Math.sin(time * 1.3 + i) * 0.08;
      b.boat.rotation.set(
        Math.sin(time * 0.9 + i) * 0.03,
        Math.atan2(-boatTangent.x, -boatTangent.z),
        Math.sin(time * 1.1 + i * 2) * 0.04,
      );
      const fade = Math.min(1, u * 12, (1 - u) * 12);
      b.boat.scale.setScalar(Math.max(0.001, fade));
      const lantern = b.boat.children[3].getWorldPosition(boatPoint);
      halo.setXYZ(i, lantern.x, lantern.y, lantern.z);
    });
    halo.needsUpdate = true;
    boatHalos.material.opacity = Math.min(1, look.lanterns);
  }
  return {
    group,
    setLook(state) {
      look = state;
      if (halos) {
        halos.material.opacity = Math.min(1, state.lanterns * 0.75);
        halos.visible = state.lanterns > 0.02;
      }
      // Birds roost at night; only a few owls stay near the owlery.
      birdMesh.count = state.night > 0.5 ? owlCount : birds.length;
    },
    update(time, dt = 0) {
      wind.value = time;
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i],
          a = b.phase + time * b.speed;
        const dir = Math.sign(b.speed) || 1;
        birdPos.set(
          b.cx + Math.cos(a) * b.r,
          b.y + Math.sin(time * 0.4 + b.phase) * b.bob,
          b.cz + Math.sin(a) * b.r,
        );
        // Nose points along local -Z; face along the tangent of the circling path.
        birdEuler.set(0, dir > 0 ? Math.PI - a : -a, Math.sin(time * 0.6 + i) * 0.25 * dir);
        birdQuat.setFromEuler(birdEuler);
        birdScale.setScalar(b.scale);
        birdMatrix.compose(birdPos, birdQuat, birdScale);
        birdMesh.setMatrixAt(i, birdMatrix);
      }
      birdMesh.instanceMatrix.needsUpdate = true;
      if (halos && look.lanterns > 0.02)
        halos.material.size = 8.5 + Math.sin(time * 2.3) * 0.35 + Math.sin(time * 5.1) * 0.2;
      updateBoats(time);
    },
    dispose() {
      world.group.remove(group);
      owned.forEach(x => x.dispose?.());
      birdMesh.dispose();
      flags.dispose();
      poles.dispose();
    },
  };
}
