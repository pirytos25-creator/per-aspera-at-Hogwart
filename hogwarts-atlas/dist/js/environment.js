import * as THREE from '../assets/three.module.js';
import { Water } from '../assets/addons/objects/Water.js';

/**
 * Removes the visible 90-metre repeat of the ground photo: a second, rotated
 * sample at a different scale and a very low-frequency brightness variation.
 */
function breakTiling(material) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec2 tileUvB = mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.37 + vec2( 0.31, 0.67 );
        vec4 tileA = texture2D( map, vMapUv );
        vec4 tileB = texture2D( map, tileUvB );
        float tileMacro = texture2D( map, vMapUv * 0.043 + vec2( 0.12, 0.4 ) ).g;
        float tileMix = smoothstep( 0.25, 0.75, texture2D( map, vMapUv * 0.071 ).r );
        vec4 sampledDiffuseColor = mix( tileA, tileB, 0.25 + tileMix * 0.5 );
        sampledDiffuseColor.rgb *= 0.78 + tileMacro * 0.5;
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'atlas-terrain-untiled';
  material.needsUpdate = true;
}

// Photo-based CC0 surface sets, loaded locally. Geometry has procedural fallback maps.
export function enhanceEnvironment(world, renderer) {
  const loader = new THREE.TextureLoader(),
    owned = [];
  const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  function load(file, repeat, srgb = false) {
    const texture = loader.load(new URL('../assets/textures/' + file, import.meta.url).href, () => {
      renderer.shadowMap.needsUpdate = true;
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
    texture.anisotropy = anisotropy;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    owned.push(texture);
    return texture;
  }
  function surface(material, name, repeat, tint, normal = 0.5) {
    if (!material) return;
    material.map = load(name + '.jpg', repeat, true);
    material.normalMap = load(name + '-normal.jpg', repeat);
    material.roughnessMap = load(name + '-rough.jpg', repeat);
    material.normalScale.set(normal, normal);
    material.bumpMap = null;
    material.color.set(tint);
    material.roughness = 1;
    material.envMapIntensity = 0.25;
    material.needsUpdate = true;
  }
  const m = world.materials || {};
  surface(m.stone, 'stone', [1, 1], '#c8c0aa', 0.55);
  surface(m.pale, 'stone', [1, 1], '#ded5bc', 0.4);
  surface(m.wood, 'wood', [1, 1], '#8b6e50', 0.3);
  surface(m.terrain, 'ground', [16, 16], '#b0bda6', 0.65);
  if (m.terrain) {
    breakTiling(m.terrain);
    // The terrain's vertex colours become gentle multipliers around 1.0: meadow
    // patches, darker hollows and greyer slopes without hiding the photo texture.
    const colors = world.terrain?.geometry.attributes.color;
    if (colors) {
      let mean = 0;
      for (let i = 0; i < colors.count; i++) mean += colors.getX(i) + colors.getY(i) + colors.getZ(i);
      mean /= colors.count * 3;
      for (let i = 0; i < colors.count; i++) {
        const r = colors.getX(i) / mean,
          g = colors.getY(i) / mean,
          b = colors.getZ(i) / mean;
        colors.setXYZ(i, Math.pow(r, 0.55), Math.pow(g, 0.55), Math.pow(b, 0.55));
      }
      colors.needsUpdate = true;
      m.terrain.vertexColors = true;
    } else m.terrain.vertexColors = false;
    m.terrain.needsUpdate = true;
  }
  surface(m.cliff, 'ground', [0.12, 0.12], '#969c99', 0.85);
  surface(m.rock, 'ground', [0.6, 0.6], '#8d918b', 0.9);
  const normals = load('water-normal.jpg', [1, 1]);
  const water = new Water(new THREE.PlaneGeometry(900, 690, 1, 1), {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: normals,
    sunDirection: new THREE.Vector3(-0.7, 0.5, 0.4).normalize(),
    sunColor: 0xffdeac,
    waterColor: 0x153a41,
    distortionScale: 2.8,
    alpha: 1,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.7, 398);
  water.userData.excludeAO = true;
  water.name = 'Czarne Jezioro — odbicia planarne';
  world.group.add(water);
  if (world.lake) world.lake.visible = false;
  let reflected = true,
    visible = true;
  // SSAO renders the scene with a normal override. Reflect only the lit beauty pass.
  const reflect = water.onBeforeRender;
  water.onBeforeRender = function (renderer, scene, camera, ...rest) {
    if (scene.overrideMaterial) return;
    reflect.call(this, renderer, scene, camera, ...rest);
  };
  return {
    water,
    update(dt) {
      water.material.uniforms.time.value += dt * 0.42;
    },
    setInterior(state) {
      visible = !state;
      water.visible = visible && reflected;
    },
    setQuality(quality) {
      reflected = quality === 'ultra' || quality === 'high';
      water.visible = visible && reflected;
      if (world.lake) world.lake.visible = !reflected;
    },
    /** Accepts a time state (or a blend of two) from atmosphere.js. */
    setLook(state) {
      const u = water.material.uniforms;
      u.sunColor.value.set(state.waterSun);
      u.waterColor.value.set(state.waterColor);
      u.distortionScale.value = state.distortion;
      u.sunDirection.value.set(...state.sunDirection).normalize();
    },
    dispose() {
      owned.forEach(t => t.dispose());
      water.geometry.dispose();
      water.material.dispose();
    },
  };
}
