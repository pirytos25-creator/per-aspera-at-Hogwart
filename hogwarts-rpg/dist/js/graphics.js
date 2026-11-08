import * as THREE from '../assets/three.module.js';
import { EffectComposer } from '../assets/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../assets/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../assets/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../assets/addons/postprocessing/OutputPass.js';
import { SSAOPass } from '../assets/addons/postprocessing/SSAOPass.js';

const PRESETS = {
  ultra: { dpr: 2, samples: 4, aoScale: .8, ao: true, pixels: 6500000 },
  high: { dpr: 1.5, samples: 2, aoScale: .62, ao: true, pixels: 4000000 },
  balanced: { dpr: 1, samples: 0, aoScale: .5, ao: false, pixels: 2200000 }
};

// The depth-only pass must not treat window glass, water or sky as solid walls.
class ContactShadowsPass extends SSAOPass {
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse(object => {
      if (object.userData?.skipAO || object.userData?.excludeAO || object.isWater) object.visible = false;
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material && (material.depthWrite === false || (material.transparent && material.opacity < .85)))) {
        object.visible = false;
      }
    });
  }

  render(renderer, ...args) {
    // The beauty pass already refreshed shadows. Do not render the shadow atlas
    // a second time with an override normal material.
    const autoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try { super.render(renderer, ...args); }
    finally { renderer.shadowMap.autoUpdate = autoUpdate; }
  }
}

/** HDR lighting, contact shadows, restrained light bloom and final ACES output. */
export function createGraphics(renderer, scene, camera) {
  const dimensions = renderer.getSize(new THREE.Vector2());
  let width = Math.max(1, dimensions.x), height = Math.max(1, dimensions.y);
  let quality = 'ultra', interior = false, disposed = false;
  const hdr = renderer.extensions.has('EXT_color_buffer_float');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const target = new THREE.WebGLRenderTarget(width, height, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false
  });
  target.texture.name = 'Hogwarts HDR colour';
  const composer = new EffectComposer(renderer, target);
  const beauty = new RenderPass(scene, camera);
  const contact = new ContactShadowsPass(scene, camera, width, height, 24);
  contact.output = SSAOPass.OUTPUT.Default;
  // Keep detail in recesses without turning every corner black.
  contact.ssaoMaterial.uniforms.uContactStrength = { value: .58 };
  contact.ssaoMaterial.fragmentShader = contact.ssaoMaterial.fragmentShader
    .replace('uniform float kernelRadius;', 'uniform float uContactStrength;\nuniform float kernelRadius;')
    .replace('vec3( 1.0 - occlusion )', 'vec3( 1.0 - occlusion * uContactStrength )');
  contact.ssaoMaterial.needsUpdate = true;

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), .28, .55, hdr ? 1.12 : .85);
  const output = new OutputPass();
  composer.addPass(beauty);
  composer.addPass(contact);
  composer.addPass(bloom);
  composer.addPass(output);

  function refreshContact() {
    const range = Math.max(1, camera.far - camera.near);
    // SSAOPass depth differences are normalised to the camera clipping range,
    // while its sampling radius is in world units.
    contact.kernelRadius = interior ? 1.05 : 5.2;
    contact.minDistance = (interior ? .025 : .12) / range;
    contact.maxDistance = (interior ? 2.1 : 13) / range;
    contact.ssaoMaterial.uniforms.uContactStrength.value = interior ? .48 : .6;
    contact.ssaoMaterial.uniforms.cameraNear.value = camera.near;
    contact.ssaoMaterial.uniforms.cameraFar.value = camera.far;
    contact.depthRenderMaterial.uniforms.cameraNear.value = camera.near;
    contact.depthRenderMaterial.uniforms.cameraFar.value = camera.far;
    contact.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    contact.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    bloom.strength = interior ? .24 : .28;
    bloom.radius = interior ? .42 : .55;
    bloom.threshold = hdr ? (interior ? 1.25 : 1.12) : .85;
  }

  function resize(w = width, h = height) {
    if (disposed) return;
    width = Math.max(1, Math.floor(w)); height = Math.max(1, Math.floor(h));
    const preset = PRESETS[quality];
    const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const pixelRatio = Math.min(device, preset.dpr, Math.sqrt(preset.pixels / (width * height)));
    renderer.setPixelRatio(Math.max(.65, pixelRatio));
    renderer.setSize(width, height);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
    contact.enabled = preset.ao && hdr;
    contact.setSize(
      Math.max(1, Math.round(width * renderer.getPixelRatio() * preset.aoScale)),
      Math.max(1, Math.round(height * renderer.getPixelRatio() * preset.aoScale))
    );
    refreshContact();
  }

  function setQuality(next) {
    if (disposed) return;
    quality = Object.hasOwn(PRESETS, next) ? next : 'ultra';
    const samples = Math.min(PRESETS[quality].samples, renderer.capabilities.maxSamples || 4);
    for (const buffer of [composer.renderTarget1, composer.renderTarget2]) {
      if (buffer.samples !== samples) {
        buffer.samples = samples;
        buffer.dispose();
      }
    }
    resize();
  }

  setQuality('ultra');
  return {
    render(dt = 0) {
      if (disposed) return;
      // Keeps AO correct if a caller changes lens settings for a photo.
      contact.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      contact.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      composer.render(dt);
    },
    resize,
    setQuality,
    setInterior(value) { interior = Boolean(value); refreshContact(); },
    get quality() { return quality; },
    get hasHDR() { return hdr; },
    dispose() {
      if (disposed) return;
      disposed = true;
      beauty.dispose();
      contact.dispose();
      // r170 SSAOPass leaves these two allocations to the caller.
      contact.ssaoMaterial.dispose();
      contact.noiseTexture?.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
    }
  };
}

const SKY_STATES = [
  { zenith: '#3c6684', horizon: '#bac9bd', low: '#899d98', cloud: '#b9c1b6', sun: '#ffdfac', direction: [-.72, .27, .39], night: 0, brightness: .92 },
  { zenith: '#071225', horizon: '#273e57', low: '#172c3c', cloud: '#354c62', sun: '#cddffa', direction: [-.35, .49, -.68], night: 1, brightness: .64 },
  { zenith: '#5a8cb9', horizon: '#d1dace', low: '#9eb6b9', cloud: '#e5e7da', sun: '#ffedce', direction: [.7, .34, -.4], night: 0, brightness: 1.08 }
];

/** A distant atmospheric dome: layered cirrus, haze, solar glow and moonlight. */
export function createSky(scene) {
  const group = new THREE.Group();
  group.name = 'Atmosphere · layered clouds and horizon';
  group.userData.skipAO = true;
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uLow: { value: new THREE.Color() }, uCloud: { value: new THREE.Color() },
    uSun: { value: new THREE.Color() }, uSunDirection: { value: new THREE.Vector3() },
    uNight: { value: 0 }, uTime: { value: 0 }, uBrightness: { value: 1 }
  };
  const geometry = new THREE.SphereGeometry(1800, 48, 32);
  const material = new THREE.ShaderMaterial({
    name: 'Scottish highlands atmosphere', side: THREE.BackSide,
    depthWrite: false, depthTest: false, fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uZenith, uHorizon, uLow, uCloud, uSun, uSunDirection;
      uniform float uNight, uTime, uBrightness;
      varying vec3 vDirection;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float cloudNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash21(i), hash21(i+vec2(1.0,0.0)),f.x),
                   mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y);
      }
      float fbm(vec2 p) {
        float value=0.0, amplitude=.5;
        mat2 turn=mat2(.8,-.6,.6,.8);
        for(int i=0;i<5;i++) {
          value += amplitude*cloudNoise(p);
          p=turn*p*2.06+vec2(13.7,9.2);
          amplitude*=.49;
        }
        return value;
      }
      void main() {
        vec3 ray=normalize(vDirection);
        float elevation=max(ray.y,0.0);
        float gradient=pow(smoothstep(-.025,.88,ray.y),.58);
        vec3 sky=mix(uHorizon,uZenith,gradient);
        sky=mix(sky,uLow,1.0-smoothstep(-.28,.015,ray.y));

        float solar=clamp(dot(ray,normalize(uSunDirection)),0.0,1.0);
        float warmHaze=pow(solar,7.0)*exp(-abs(ray.y-.12)*3.2);
        sky+=uSun*warmHaze*mix(.32,.04,uNight);
        sky+=uSun*pow(solar,90.0)*mix(.24,.10,uNight);
        float disk=smoothstep(mix(.99962,.9994,uNight),mix(.99992,.99984,uNight),solar);
        sky+=uSun*disk*mix(3.7,1.6,uNight);

        // Project two cloud heights onto the view ray. Their different scales
        // and wind directions avoid an obvious repeating texture in orbit.
        vec2 plane=ray.xz/max(ray.y+.08,.115);
        vec2 drift=vec2(uTime*.0032,uTime*.0009);
        float broad=fbm(plane*1.35+drift+vec2(19.0,8.0));
        float detail=fbm(plane*3.3-drift*.6);
        float density=smoothstep(.44,.73,broad*.77+detail*.23);
        float horizonFade=smoothstep(.015,.16,ray.y)*(1.0-smoothstep(.82,.99,ray.y));
        density*=horizonFade*.7;
        vec3 litCloud=mix(uCloud,uSun,pow(solar,8.0)*mix(.35,.08,uNight));
        litCloud*=.83+detail*.25;
        sky=mix(sky,litCloud,density);

        // Thin, high ice-cloud ribbons catch the last light above the valley.
        float wisps=fbm(plane*vec2(1.2,6.5)+vec2(3.0,41.0)-drift*.3);
        float wispy=smoothstep(.58,.78,wisps)*horizonFade*.14;
        sky=mix(sky,litCloud*1.07,wispy);
        gl_FragColor=vec4(max(vec3(0.0),sky*uBrightness),1.0);
      }
    `
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'Atmospheric sky dome';
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  dome.userData.skipAO = true;
  dome.onBeforeRender = (_renderer, _scene, camera) => {
    dome.position.copy(camera.position);
    dome.updateMatrixWorld();
  };
  group.add(dome);
  scene.add(group);
  let current = 0, disposed = false, environmentTarget = null;
  function setTime(index) {
    current = SKY_STATES[index] ? index : 0;
    const state = SKY_STATES[current];
    for (const [key, value] of [['uZenith',state.zenith],['uHorizon',state.horizon],['uLow',state.low],['uCloud',state.cloud],['uSun',state.sun]]) uniforms[key].value.set(value);
    uniforms.uSunDirection.value.set(...state.direction).normalize();
    uniforms.uNight.value = state.night;
    uniforms.uBrightness.value = state.brightness;
  }
  setTime(0);
  return {
    group,
    setTime,
    update(time) { if (!disposed) uniforms.uTime.value = Number.isFinite(time) ? time : 0; },
    setInterior(value) { group.visible = !value; },
    createEnvironment(renderer) {
      if (disposed) return null;
      // Call once after creation (and optionally when the time of day changes).
      // No buildings or transparent effects enter the lighting capture.
      const captureScene = new THREE.Scene();
      const captureDome = new THREE.Mesh(geometry, material);
      captureDome.frustumCulled = false;
      captureScene.add(captureDome);
      const generator = new THREE.PMREMGenerator(renderer);
      const next = generator.fromScene(captureScene, .025, .1, 2200);
      generator.dispose();
      environmentTarget?.dispose();
      environmentTarget = next;
      return next.texture;
    },
    get timeMode() { return current; },
    dispose() { if (disposed) return; disposed = true; scene.remove(group); geometry.dispose(); material.dispose(); environmentTarget?.dispose(); }
  };
}
