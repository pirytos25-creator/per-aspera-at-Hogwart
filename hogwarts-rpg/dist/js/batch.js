import * as T from "../assets/three.module.js";
import { mergeGeometries } from "../assets/addons/utils/BufferGeometryUtils.js";

// Static batching: rooms and corridors are built from hundreds of small meshes, and each one costs a
// draw call (twice with ambient occlusion). Meshes that never move and share a material are merged into
// one. Moving parts are found by running the owners' animation at a few moments and comparing
// positions, or are marked with userData.noBatch (that also covers everything below them).
const _m = new T.Matrix4();

function excluded(mesh, root) {
  for (let o = mesh; o && o !== root; o = o.parent) if (o.userData?.noBatch || o.visible === false) return true;
  return false;
}

export function batchStatic(root, { step = null, minGroup = 2 } = {}) {
  root.updateWorldMatrix(true, true);
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.morphTargetInfluences) return;
    if (excluded(o, root)) return;
    meshes.push(o);
  });
  // anything that moves when its owner animates stays separate
  const moved = new Set();
  if (step) {
    const before = meshes.map((m) => m.matrixWorld.clone());
    for (const t of [0.37, 1.91, 7.3]) {
      step(t);
      root.updateWorldMatrix(true, true);
      meshes.forEach((m, i) => {
        if (!m.matrixWorld.equals(before[i])) moved.add(m);
      });
    }
    step(0);
    root.updateWorldMatrix(true, true);
  }
  const groups = new Map();
  for (const m of meshes) {
    if (moved.has(m)) continue;
    const mat = m.material,
      g = m.geometry;
    if (Array.isArray(mat) || mat.transparent || !g?.attributes?.position || g.morphAttributes?.position) continue;
    const key = [mat.uuid, Object.keys(g.attributes).sort().join(","), g.index ? "i" : "n", m.castShadow, m.receiveShadow, m.renderOrder, m.layers.mask, !!m.userData.skipAO].join("|");
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(m);
  }
  const inverse = new T.Matrix4().copy(root.matrixWorld).invert();
  const created = [];
  let merged = 0;
  for (const list of groups.values()) {
    if (list.length < minGroup) continue;
    const geos = list.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(_m.multiplyMatrices(inverse, m.matrixWorld));
      return g;
    });
    const geometry = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const first = list[0],
      mesh = new T.Mesh(geometry, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.layers.mask = first.layers.mask;
    mesh.userData.skipAO = first.userData.skipAO;
    mesh.userData.batched = true;
    mesh.name = "batched " + (first.material.name || "");
    root.add(mesh);
    created.push(geometry);
    // the originals stay in place (other code may hold them) but are no longer drawn
    for (const m of list) m.visible = false;
    merged += list.length;
  }
  return {
    merged,
    batches: created.length,
    dispose() {
      for (const g of created) g.dispose();
    },
  };
}
