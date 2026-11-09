import * as T from "../assets/three.module.js";
import { ACTOR_LAYER } from "./actors.js";

// Real-time character shadows that do not disturb the baked world shadows.
// Every frame the characters (and only them: they live on their own layer) are drawn as black
// silhouettes from the light's direction into a small texture. A soft decal under the player then
// projects that texture onto the ground, so everyone near you casts a shadow that follows
// every step and gesture. Outdoors the light is the sun, indoors the candles overhead.
export function createCharacterShadows(renderer, scene, { extent = 10 } = {}) {
  let size = 512,
    enabled = true;
  const rt = new T.WebGLRenderTarget(size, size, { depthBuffer: true, generateMipmaps: false });
  rt.texture.minFilter = rt.texture.magFilter = T.LinearFilter;
  const cam = new T.OrthographicCamera(-extent, extent, extent, -extent, 1, 140);
  cam.layers.set(ACTOR_LAYER);
  const silhouette = new T.MeshBasicMaterial({ color: 0x000000 });
  const uniforms = {
    map: { value: rt.texture },
    shadowMatrix: { value: new T.Matrix4() },
    strength: { value: 0.5 },
    center: { value: new T.Vector3() },
    radius: { value: extent },
    texel: { value: 1 / size },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: false,
    vertexShader: `varying vec3 vW;
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform sampler2D map;uniform mat4 shadowMatrix;uniform float strength;uniform vec3 center;uniform float radius;uniform float texel;varying vec3 vW;
void main(){
 vec4 p=shadowMatrix*vec4(vW,1.);vec2 uv=p.xy*.5+.5;
 if(uv.x<.0||uv.x>1.||uv.y<.0||uv.y>1.)discard;
 float s=0.;
 for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++)s+=texture2D(map,uv+vec2(float(x),float(y))*texel*1.25).r;
 s/=25.;
 float edge=1.-smoothstep(radius*.7,radius*.98,distance(vW.xz,center.xz));
 float a=(1.-s)*strength*edge;
 if(a<.004)discard;
 gl_FragColor=vec4(0.,0.,0.,a);
}`,
  });
  // a grid, so outdoors it can follow the terrain
  const N = 24;
  const geometry = new T.PlaneGeometry(extent * 2, extent * 2, N, N);
  geometry.rotateX(-Math.PI / 2);
  const flat = geometry.attributes.position.array.slice();
  const decal = new T.Mesh(geometry, material);
  decal.frustumCulled = false;
  decal.renderOrder = 2;
  decal.userData.skipAO = true;
  decal.name = "Character shadows";
  scene.add(decal);
  const clear = new T.Color(),
    white = new T.Color(1, 1, 1),
    m = new T.Matrix4();
  let terrainTimer = 0,
    frame = 0;
  return {
    get enabled() {
      return enabled;
    },
    setQuality(q) {
      enabled = q !== "balanced";
      const want = q === "ultra" ? 1024 : 512;
      if (want !== size) {
        size = want;
        rt.setSize(size, size);
        uniforms.texel.value = 1 / size;
      }
      decal.visible = enabled;
    },
    // center: the player; dir: unit vector towards the light; ground(x,z): optional terrain height
    update(center, dir, floorY, { strength = 0.5, ground = null, active = true, every = 1 } = {}) {
      decal.visible = enabled && active;
      if (!decal.visible) return;
      // on lighter settings the silhouettes are redrawn every other frame
      if (every > 1 && frame++ % every) return;
      // snap to texels so shadow edges do not crawl while walking
      const snap = (extent * 2) / size;
      const cx = Math.round(center.x / snap) * snap,
        cz = Math.round(center.z / snap) * snap;
      cam.position.set(cx, floorY, cz).addScaledVector(dir, 70);
      cam.up.set(0, 1, 0);
      if (Math.abs(dir.y) > 0.999) cam.up.set(0, 0, 1);
      cam.lookAt(cx, floorY, cz);
      cam.updateMatrixWorld();
      uniforms.shadowMatrix.value.multiplyMatrices(cam.projectionMatrix, m.copy(cam.matrixWorld).invert());
      uniforms.center.value.set(cx, floorY, cz);
      uniforms.strength.value = strength;
      decal.position.set(cx, floorY + 0.03, cz);
      // outdoors the decal follows the terrain (a few times a second is enough)
      terrainTimer -= 1;
      if (ground && terrainTimer <= 0) {
        terrainTimer = 4;
        const pos = geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = flat[i * 3] + cx,
            z = flat[i * 3 + 2] + cz;
          pos.setY(i, ground(x, z) - floorY + 0.04);
        }
        pos.needsUpdate = true;
      } else if (!ground && geometry.attributes.position.getY(0) !== 0) {
        geometry.attributes.position.array.set(flat);
        geometry.attributes.position.needsUpdate = true;
      }
      // draw the silhouettes
      const target = renderer.getRenderTarget(),
        alpha = renderer.getClearAlpha(),
        override = scene.overrideMaterial,
        background = scene.background,
        fog = scene.fog,
        autoShadows = renderer.shadowMap.autoUpdate,
        autoClear = renderer.autoClear;
      renderer.getClearColor(clear);
      scene.overrideMaterial = silhouette;
      scene.background = null;
      scene.fog = null;
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(white, 1);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(target);
      renderer.setClearColor(clear, alpha);
      renderer.autoClear = autoClear;
      renderer.shadowMap.autoUpdate = autoShadows;
      scene.overrideMaterial = override;
      scene.background = background;
      scene.fog = fog;
    },
    // test hook: how much of the silhouette texture is covered
    _coverage() {
      const px = new Uint8Array(size * size * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
      let dark = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark++;
      return { dark, size, visible: decal.visible, y: decal.position.y, cam: cam.position.toArray().map((v) => +v.toFixed(1)) };
    },
    decal,
    dispose() {
      scene.remove(decal);
      geometry.dispose();
      material.dispose();
      silhouette.dispose();
      rt.dispose();
    },
  };
}
