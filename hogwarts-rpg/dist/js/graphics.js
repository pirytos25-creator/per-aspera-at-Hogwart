import * as THREE from "../assets/three.module.js";
import { EffectComposer } from "../assets/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../assets/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../assets/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../assets/addons/postprocessing/OutputPass.js";
import { SSAOPass } from "../assets/addons/postprocessing/SSAOPass.js";
import { BokehPass } from "../assets/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "../assets/addons/postprocessing/ShaderPass.js";

const PRESETS = {
  ultra: { dpr: 2, samples: 4, aoScale: 0.8, ao: true, pixels: 6500000 },
  high: { dpr: 1.5, samples: 2, aoScale: 0.62, ao: true, pixels: 4000000 },
  balanced: { dpr: 1, samples: 0, aoScale: 0.5, ao: false, pixels: 2200000 },
};

// The depth-only pass must not treat window glass, water or sky as solid walls.
class ContactShadowsPass extends SSAOPass {
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse((object) => {
      if (object.userData?.skipAO || object.userData?.excludeAO || object.isWater) object.visible = false;
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some((material) => material && (material.depthWrite === false || (material.transparent && material.opacity < 0.85)))) {
        object.visible = false;
      }
    });
  }

  render(renderer, ...args) {
    // The beauty pass already refreshed shadows. Do not render the shadow atlas
    // a second time with an override normal material.
    const autoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      super.render(renderer, ...args);
    } finally {
      renderer.shadowMap.autoUpdate = autoUpdate;
    }
  }
}

/** HDR lighting, contact shadows, restrained light bloom and final ACES output. */
// Final film grade in display space: split toning (cool shadows, warm highlights), a gentle
// S-curve, a lens vignette, chromatic fringing at the edges and fine animated grain.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    aspect: { value: 16 / 9 },
    vignette: { value: 0.3 },
    grain: { value: 0.028 },
    aberration: { value: 0.0016 },
    split: { value: 0.1 },
    shadowTint: { value: new THREE.Color("#4f6f8f") },
    highlightTint: { value: new THREE.Color("#ffd2a0") },
    saturation: { value: 1.06 },
    contrast: { value: 1.05 },
    gamma: { value: 1 },
  },
  vertexShader: `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float time,aspect,vignette,grain,aberration,split,saturation,contrast,gamma;uniform vec3 shadowTint,highlightTint;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
 vec2 d=vUv-.5;float r2=dot(d*vec2(aspect,1.),d*vec2(aspect,1.));
 vec2 off=d*aberration*r2*5.;
 vec3 c=vec3(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b);
 c=pow(max(c,0.),vec3(gamma));
 float l=dot(c,vec3(.2126,.7152,.0722));
 c=mix(c,c*shadowTint*1.6,split*(1.-smoothstep(.05,.5,l)));
 c=mix(c,c*highlightTint*1.18,split*smoothstep(.45,1.,l));
 c=mix(vec3(l),c,saturation);
 c=clamp((c-.5)*contrast+.5,0.,1.);
 c*=1.-vignette*smoothstep(.12,.95,r2);
 float g=hash(floor(vUv*vec2(1600.,900.))+fract(time*7.31)*91.)-.5;
 c+=g*grain*(1.-l*.7);
 gl_FragColor=vec4(c,1.);
}`,
};

export function createGraphics(renderer, scene, camera) {
  const dimensions = renderer.getSize(new THREE.Vector2());
  let width = Math.max(1, dimensions.x),
    height = Math.max(1, dimensions.y);
  let quality = "ultra",
    interior = false,
    disposed = false,
    resScale = 1;
  const hdr = renderer.extensions.has("EXT_color_buffer_float");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const target = new THREE.WebGLRenderTarget(width, height, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.name = "Hogwarts HDR colour";
  const composer = new EffectComposer(renderer, target);
  const beauty = new RenderPass(scene, camera);
  const contact = new ContactShadowsPass(scene, camera, width, height, 24);
  contact.output = SSAOPass.OUTPUT.Default;
  // Keep detail in recesses without turning every corner black.
  contact.ssaoMaterial.uniforms.uContactStrength = { value: 0.58 };
  contact.ssaoMaterial.fragmentShader = contact.ssaoMaterial.fragmentShader
    .replace("uniform float kernelRadius;", "uniform float uContactStrength;\nuniform float kernelRadius;")
    .replace("vec3( 1.0 - occlusion )", "vec3( 1.0 - occlusion * uContactStrength )");
  contact.ssaoMaterial.needsUpdate = true;

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.28, 0.55, hdr ? 1.12 : 0.85);
  const output = new OutputPass();
  // Cinematic depth of field for conversations (off during play).
  const dof = new BokehPass(scene, camera, { focus: 2, aperture: 0.004, maxblur: 0.008 });
  dof.enabled = false;
  composer.addPass(beauty);
  composer.addPass(contact);
  composer.addPass(dof);
  composer.addPass(bloom);
  composer.addPass(output);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  let grainOn = true;

  function refreshContact() {
    const range = Math.max(1, camera.far - camera.near);
    // SSAOPass depth differences are normalised to the camera clipping range,
    // while its sampling radius is in world units.
    contact.kernelRadius = interior ? 1.05 : 5.2;
    contact.minDistance = (interior ? 0.025 : 0.12) / range;
    contact.maxDistance = (interior ? 2.1 : 13) / range;
    contact.ssaoMaterial.uniforms.uContactStrength.value = interior ? 0.48 : 0.6;
    contact.ssaoMaterial.uniforms.cameraNear.value = camera.near;
    contact.ssaoMaterial.uniforms.cameraFar.value = camera.far;
    contact.depthRenderMaterial.uniforms.cameraNear.value = camera.near;
    contact.depthRenderMaterial.uniforms.cameraFar.value = camera.far;
    contact.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    contact.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    bloom.strength = interior ? 0.24 : 0.28;
    bloom.radius = interior ? 0.42 : 0.55;
    bloom.threshold = hdr ? (interior ? 1.25 : 1.12) : 0.85;
    // interiors: lift the midtones a little and warm the highlights (torchlight); outdoors: crisper air
    const u = grade.uniforms;
    u.gamma.value = interior ? 0.9 : 1;
    u.split.value = interior ? 0.12 : 0.08;
    u.highlightTint.value.set(interior ? "#ffc98f" : "#ffe0b8");
    u.shadowTint.value.set(interior ? "#4d6680" : "#56769a");
    u.saturation.value = interior ? 1.08 : 1.05;
    u.contrast.value = interior ? 1.04 : 1.06;
  }

  function resize(w = width, h = height) {
    if (disposed) return;
    width = Math.max(1, Math.floor(w));
    height = Math.max(1, Math.floor(h));
    const preset = PRESETS[quality];
    const device = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const pixelRatio = Math.min(device, preset.dpr, Math.sqrt(preset.pixels / (width * height))) * resScale;
    renderer.setPixelRatio(Math.max(0.55, pixelRatio));
    renderer.setSize(width, height);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
    // indoors the occlusion pass redraws hundreds of small objects: kept for Ultra only
    contact.enabled = preset.ao && hdr && (!interior || quality === "ultra");
    grade.enabled = quality !== "balanced";
    grade.uniforms.aspect.value = width / height;
    grade.uniforms.aberration.value = quality === "ultra" ? 0.0016 : 0;
    grade.uniforms.grain.value = grainOn ? (quality === "ultra" ? 0.028 : 0.02) : 0;
    grade.uniforms.vignette.value = quality === "ultra" ? 0.32 : 0.26;
    contact.setSize(
      Math.max(1, Math.round(width * renderer.getPixelRatio() * preset.aoScale)),
      Math.max(1, Math.round(height * renderer.getPixelRatio() * preset.aoScale)),
    );
    refreshContact();
  }

  function setQuality(next) {
    if (disposed) return;
    quality = Object.hasOwn(PRESETS, next) ? next : "ultra";
    const samples = Math.min(PRESETS[quality].samples, renderer.capabilities.maxSamples || 4);
    for (const buffer of [composer.renderTarget1, composer.renderTarget2]) {
      if (buffer.samples !== samples) {
        buffer.samples = samples;
        buffer.dispose();
      }
    }
    resize();
  }

  setQuality("ultra");
  return {
    render(dt = 0) {
      if (disposed) return;
      // Keeps AO correct if a caller changes lens settings for a photo.
      contact.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      contact.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      grade.uniforms.time.value = (grade.uniforms.time.value + (dt || 0.016)) % 100;
      composer.render(dt);
    },
    resize,
    setQuality,
    setDOF(enabled, focus = 2, aperture = 0.004, maxblur = 0.008) {
      dof.enabled = !!enabled && quality !== "balanced";
      dof.uniforms.focus.value = focus;
      dof.uniforms.aperture.value = aperture;
      dof.uniforms.maxblur.value = maxblur;
    },
    // film grain is motion: off with the reduced-motion preference
    setGrain(on) {
      grainOn = !!on;
      resize();
    },
    setInterior(value) {
      interior = Boolean(value);
      contact.enabled = PRESETS[quality].ao && hdr && (!interior || quality === "ultra");
      refreshContact();
    },
    // dynamic resolution: the game lowers the render scale when frames get slow, and raises it back
    setResolutionScale(s) {
      s = Math.min(1, Math.max(0.6, s));
      if (Math.abs(s - resScale) < 0.02) return;
      resScale = s;
      resize();
    },
    get resolutionScale() {
      return resScale;
    },
    get quality() {
      return quality;
    },
    get hasHDR() {
      return hdr;
    },
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
      grade.dispose();
      composer.dispose();
    },
  };
}

const SKY_STATES = [
  {
    zenith: "#3c6684",
    horizon: "#bac9bd",
    low: "#899d98",
    cloud: "#b9c1b6",
    sun: "#ffdfac",
    direction: [-0.72, 0.27, 0.39],
    night: 0,
    brightness: 0.92,
  },
  {
    zenith: "#071225",
    horizon: "#273e57",
    low: "#172c3c",
    cloud: "#354c62",
    sun: "#cddffa",
    direction: [-0.35, 0.49, -0.68],
    night: 1,
    brightness: 0.64,
  },
  {
    zenith: "#5a8cb9",
    horizon: "#d1dace",
    low: "#9eb6b9",
    cloud: "#e5e7da",
    sun: "#ffedce",
    direction: [0.7, 0.34, -0.4],
    night: 0,
    brightness: 1.08,
  },
];

/** A distant atmospheric dome: layered cirrus, haze, solar glow and moonlight. */
export function createSky(scene) {
  const group = new THREE.Group();
  group.name = "Atmosphere · layered clouds and horizon";
  group.userData.skipAO = true;
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uLow: { value: new THREE.Color() },
    uCloud: { value: new THREE.Color() },
    uSun: { value: new THREE.Color() },
    uSunDirection: { value: new THREE.Vector3() },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uBrightness: { value: 1 },
  };
  const geometry = new THREE.SphereGeometry(1800, 48, 32);
  const material = new THREE.ShaderMaterial({
    name: "Scottish highlands atmosphere",
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
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
    `,
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = "Atmospheric sky dome";
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  dome.userData.skipAO = true;
  dome.onBeforeRender = (_renderer, _scene, camera) => {
    dome.position.copy(camera.position);
    dome.updateMatrixWorld();
  };
  group.add(dome);
  scene.add(group);
  let current = 0,
    disposed = false,
    environmentTarget = null;
  function setTime(index) {
    current = SKY_STATES[index] ? index : 0;
    const state = SKY_STATES[current];
    for (const [key, value] of [
      ["uZenith", state.zenith],
      ["uHorizon", state.horizon],
      ["uLow", state.low],
      ["uCloud", state.cloud],
      ["uSun", state.sun],
    ])
      uniforms[key].value.set(value);
    uniforms.uSunDirection.value.set(...state.direction).normalize();
    uniforms.uNight.value = state.night;
    uniforms.uBrightness.value = state.brightness;
  }
  setTime(0);
  return {
    group,
    setTime,
    update(time) {
      if (!disposed) uniforms.uTime.value = Number.isFinite(time) ? time : 0;
    },
    setInterior(value) {
      group.visible = !value;
    },
    createEnvironment(renderer) {
      if (disposed) return null;
      // Call once after creation (and optionally when the time of day changes).
      // No buildings or transparent effects enter the lighting capture.
      const captureScene = new THREE.Scene();
      const captureDome = new THREE.Mesh(geometry, material);
      captureDome.frustumCulled = false;
      captureScene.add(captureDome);
      const generator = new THREE.PMREMGenerator(renderer);
      const next = generator.fromScene(captureScene, 0.025, 0.1, 2200);
      generator.dispose();
      environmentTarget?.dispose();
      environmentTarget = next;
      return next.texture;
    },
    get timeMode() {
      return current;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      geometry.dispose();
      material.dispose();
      environmentTarget?.dispose();
    },
  };
}
