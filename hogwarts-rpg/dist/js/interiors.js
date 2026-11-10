import * as THREE from "../assets/three.module.js";
import { createHallMagic, HALL_TABLE_X, HALL_BENCH_X } from "./great-hall.js";

// Individually furnished rooms share an instanced architectural vocabulary.
// All coordinates are local; the entrance is at +Z, the teaching dais at -Z.
const TAU = Math.PI * 2;
const textureCache = new Map();
const archCache = new Map();
const pbrCache = new Map();
const unit = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 24),
  cone: new THREE.ConeGeometry(1, 1, 32),
  sphere: new THREE.SphereGeometry(1, 24, 16),
  torus: new THREE.TorusGeometry(1, 0.065, 8, 32),
  plane: new THREE.PlaneGeometry(1, 1),
};

function rng(seed) {
  let n = seed >>> 0;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function surface(kind) {
  if (textureCache.has(kind)) return textureCache.get(kind);
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const x = c.getContext("2d");
  const random = rng(kind.length * 9389);
  x.scale(2, 2);
  if (kind === "stone") {
    x.fillStyle = "#777568";
    x.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 5; col++) {
        const left = col * 128 + (row % 2 ? 64 : 0),
          top = row * 64;
        const v = 117 + random() * 35;
        const shade = x.createLinearGradient(left, top, left + 124, top + 60);
        shade.addColorStop(0, `rgb(${(v + 13) | 0},${(v + 7) | 0},${(v - 5) | 0})`);
        shade.addColorStop(0.35, `rgb(${v | 0},${(v - 5) | 0},${(v - 16) | 0})`);
        shade.addColorStop(1, `rgb(${(v - 18) | 0},${(v - 21) | 0},${(v - 29) | 0})`);
        x.fillStyle = shade;
        x.fillRect(left + 2, top + 2, 124, 60);
        x.strokeStyle = "rgba(224,215,190,.2)";
        x.strokeRect(left + 3, top + 3, 122, 58);
        for (let chip = 0; chip < 24; chip++) {
          const cx = left + 4 + random() * 120,
            cy = top + 4 + random() * 54;
          x.fillStyle = `rgba(32,29,24,${0.02 + random() * 0.06})`;
          x.beginPath();
          x.ellipse(cx, cy, 2 + random() * 8, 0.8 + random() * 2, random() * 3, 0, TAU);
          x.fill();
        }
      }
    for (let i = 0; i < 20000; i++) {
      x.fillStyle = random() > 0.5 ? "rgba(25,24,20,.06)" : "rgba(255,243,208,.06)";
      x.fillRect(random() * 512, random() * 512, random() * 3 + 1, 1);
    }
  } else if (kind === "wood") {
    x.fillStyle = "#4d3528";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = `hsl(27,26%,${24 + random() * 9}%)`;
      x.fillRect(i * 64 + 2, 0, 60, 512);
      for (let j = 0; j < 80; j++) {
        x.strokeStyle = `rgba(${random() > 0.5 ? "196,151,98" : "24,13,8"},.12)`;
        x.beginPath();
        let px = i * 64 + random() * 60 + 2;
        x.moveTo(px, 0);
        x.bezierCurveTo(px + 8, 180, px - 7, 300, px, 512);
        x.stroke();
      }
      x.fillStyle = "#241c16";
      x.fillRect(i * 64, 128 + (i % 3) * 128, 64, 2);
      const knotX = i * 64 + 18 + random() * 28,
        knotY = 70 + random() * 380;
      for (let r = 1; r < 14; r++) {
        x.strokeStyle = `rgba(26,16,8,${0.2 - r * 0.009})`;
        x.beginPath();
        x.ellipse(knotX, knotY, r * 0.55, r * 2.7, 0.04, 0, TAU);
        x.stroke();
      }
      for (let j = 0; j < 26; j++) {
        x.strokeStyle = "rgba(217,181,130,.08)";
        x.beginPath();
        const sx = i * 64 + 4 + random() * 56,
          sy = random() * 512;
        x.moveTo(sx, sy);
        x.lineTo(sx + 0.5, sy + 8 + random() * 40);
        x.stroke();
      }
    }
  } else {
    x.fillStyle = "#282c2e";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2000; i++) {
      x.fillStyle = `rgba(220,202,163,${random() * 0.1})`;
      x.fillRect(random() * 512, random() * 512, 3, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === "stone" ? 4 : 1, kind === "stone" ? 3 : 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  textureCache.set(kind, t);
  return t;
}

function pbrMaps(kind, repeat) {
  const key = `${kind}-${repeat.join("-")}`;
  if (pbrCache.has(key)) return pbrCache.get(key);
  const loader = new THREE.TextureLoader();
  const loaded = Promise.all(
    ["", "-normal", "-rough"].map(
      (suffix, index) =>
        new Promise((resolve) => {
          const baseKey = `file-${kind}${suffix}`;
          let task = pbrCache.get(baseKey);
          if (!task) {
            task = new Promise((done) =>
              loader.load(
                new URL(`../assets/textures/${kind}${suffix}.jpg`, import.meta.url).href,
                (t) => done(t),
                undefined,
                () => done(null),
              ),
            );
            pbrCache.set(baseKey, task);
          }
          task.then((source) => {
            if (!source) {
              resolve(null);
              return;
            }
            const t = source.clone();
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(...repeat);
            t.anisotropy = 16;
            t.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.needsUpdate = true;
            resolve(t);
          });
        }),
    ),
  );
  pbrCache.set(key, loaded);
  return loaded;
}

function stainedGlass() {
  if (textureCache.has("stained")) return textureCache.get("stained");
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const ctx = c.getContext("2d"),
    random = rng(8925);
  ctx.fillStyle = "#354f57";
  ctx.fillRect(0, 0, 512, 1024);
  const colors = ["#587d88", "#74979b", "#486c83", "#b7a576", "#7b8672", "#62546a"];
  for (let row = -1; row < 18; row++)
    for (let col = -1; col < 8; col++) {
      const x = col * 85 + (row % 2) * 42.5,
        y = row * 67;
      ctx.beginPath();
      ctx.moveTo(x, y - 67);
      ctx.lineTo(x + 42.5, y);
      ctx.lineTo(x, y + 67);
      ctx.lineTo(x - 42.5, y);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(x - 40, y - 60, x + 40, y + 60);
      gradient.addColorStop(0, colors[(random() * colors.length) | 0]);
      gradient.addColorStop(1, "#2f4854");
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = "#17272c";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = "rgba(219,225,201,.19)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  for (let i = 0; i < 16000; i++) {
    ctx.fillStyle = random() > 0.5 ? "rgba(236,242,218,.055)" : "rgba(10,26,34,.07)";
    ctx.fillRect(random() * 512, random() * 1024, 1 + random() * 3, 1 + random() * 6);
  }
  ctx.save();
  ctx.translate(256, 740);
  ctx.strokeStyle = "#b4a57b";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(25,42,57,.6)";
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(Math.sin((i * Math.PI) / 2) * 40, Math.cos((i * Math.PI) / 2) * 40, 42, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(18, -15);
  ctx.lineTo(58, 0);
  ctx.lineTo(18, 15);
  ctx.lineTo(0, 58);
  ctx.lineTo(-18, 15);
  ctx.lineTo(-58, 0);
  ctx.lineTo(-18, -15);
  ctx.closePath();
  ctx.fillStyle = "#b6a16c";
  ctx.fill();
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  textureCache.set("stained", t);
  return t;
}

function candleGlow() {
  if (textureCache.has("candle-glow")) return textureCache.get("candle-glow");
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"),
    gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,235,176,1)");
  gradient.addColorStop(0.08, "rgba(255,201,105,.75)");
  gradient.addColorStop(0.25, "rgba(255,147,52,.2)");
  gradient.addColorStop(1, "rgba(255,107,33,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("candle-glow", t);
  return t;
}

function pointed(w, h, frame = false) {
  const key = `${w}/${h}/${frame}`;
  if (archCache.has(key)) return archCache.get(key);
  function outline(s, ww, hh, inset = 0) {
    s.moveTo(-ww / 2, inset);
    s.lineTo(-ww / 2, hh * 0.56);
    s.quadraticCurveTo(-ww / 2, hh * 0.83, 0, hh);
    s.quadraticCurveTo(ww / 2, hh * 0.83, ww / 2, hh * 0.56);
    s.lineTo(ww / 2, inset);
    s.closePath();
  }
  const s = new THREE.Shape();
  outline(s, w, h);
  if (frame) {
    const hole = new THREE.Path();
    outline(hole, w - 0.34, h - 0.25, 0.17);
    s.holes.push(hole);
  }
  const g = frame
    ? new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.025, bevelSegments: 2 })
    : new THREE.ShapeGeometry(s);
  const positions = g.attributes.position,
    uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + w / 2) / w, positions.getY(i) / h);
  uv.needsUpdate = true;
  archCache.set(key, g);
  return g;
}

function lettering(text = "", smallText = "", color = "#dfc790", bg = "#172424") {
  text = String(text ?? "");
  smallText = String(smallText ?? "");
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 992, 224);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `${text.length > 25 ? 40 : 50}px Georgia`;
  ctx.fillText(text, 512, smallText ? 105 : 128, 945);
  if (smallText) {
    ctx.globalAlpha = 0.72;
    ctx.font = "24px Georgia";
    ctx.fillText(smallText, 512, 173, 945);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createInterior(room) {
  const group = new THREE.Group();
  group.name = `interior-${room.id}`;
  const type = room.type || "classroom",
    id = room.id || "",
    random = rng([...id].reduce((n, c) => n + c.charCodeAt(0), 17) * 97);
  const pools = new Map(),
    animated = [],
    disposable = [],
    colliders = [],
    glowPositions = [],
    lightAnchors = [];
  // embedded rooms live inside the walkable castle: an open doorway and no lights of their own
  const embedded = !!room.embedded;
  let disposed = false;
  const matrix = new THREE.Matrix4(),
    quat = new THREE.Quaternion(),
    euler = new THREE.Euler();
  const make = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });
    disposable.push(m);
    return m;
  };
  const stone = make("#b8af99", { map: surface("stone") });
  const pale = make("#b7b19d"),
    darkStone = make("#4a4e49"),
    wood = make("#927454", { map: surface("wood") });
  const darkWood = make("#39261f"),
    gold = make("#bd9956", { metalness: 0.65, roughness: 0.32 });
  const iron = make("#2b3437", { metalness: 0.65, roughness: 0.5 }),
    black = make("#101c23");
  const parchment = make("#d9c9a0"),
    ivory = make("#d7cca8"),
    glass = make("#72949d", { metalness: 0.2, roughness: 0.12, transparent: true, opacity: 0.24, side: THREE.DoubleSide });
  const glow = make("#fbd596", { emissive: "#ffb94d", emissiveIntensity: 2 });
  const windowMat = make("#c6d8d7", {
    map: stainedGlass(),
    emissive: "#bfd8d8",
    emissiveMap: stainedGlass(),
    emissiveIntensity: 0.65,
    roughness: 0.2,
    side: THREE.DoubleSide,
  });
  const floorWood = make("#a99275", { map: surface("wood"), roughness: 0.72 });
  function bindPBR(material, kind, repeat, strength = 0.4) {
    pbrMaps(kind, repeat).then(([map, normalMap, roughnessMap]) => {
      if (disposed || !map) return;
      material.map = map;
      material.normalMap = normalMap;
      material.roughnessMap = roughnessMap;
      material.normalScale.set(strength, strength);
      material.needsUpdate = true;
    });
  }
  bindPBR(stone, "stone", [4, 3], 0.48);
  bindPBR(wood, "wood", [1, 1], 0.3);
  bindPBR(floorWood, "wood", [5, 7], 0.35);
  bindPBR(darkWood, "wood", [1, 1], 0.25);
  const bannerColors = ["#803329", "#b09a4b", "#315867", "#315443"];
  const fabrics = bannerColors.map((c) => make(c));
  const bookMats = ["#694234", "#47594d", "#3c5260", "#9b815a", "#6b4560", "#302b30"].map((c) => make(c));
  const herb = make("#375b40"),
    herbLight = make("#66804b"),
    terra = make("#745044");
  function put(g, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const k = `${g.uuid}/${m.uuid}`;
    if (!pools.has(k)) pools.set(k, { g, m, matrices: [] });
    euler.set(rx, ry, rz);
    quat.setFromEuler(euler);
    matrix.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(sx, sy, sz));
    pools.get(k).matrices.push(matrix.clone());
  }
  const box = (m, x, y, z, w, h, d, ry = 0) => put(unit.box, m, x, y, z, w, h, d, 0, ry);
  const cyl = (m, x, y, z, r, h, rx = 0, rz = 0) => put(unit.cylinder, m, x, y, z, r, h, r, rx, 0, rz);
  const ball = (m, x, y, z, r, sx = 1, sy = 1, sz = 1) => put(unit.sphere, m, x, y, z, r * sx, r * sy, r * sz);
  const cone = (m, x, y, z, r, h, rx = 0, rz = 0) => put(unit.cone, m, x, y, z, r, h, r, rx, 0, rz);
  const ring = (m, x, y, z, r, rx = 0, ry = 0, rz = 0) => put(unit.torus, m, x, y, z, r, r, r, rx, ry, rz);
  function label(text, sub, x, y, z, w = 6, ry = 0, bg) {
    const t = lettering(text, sub, "#d8bf83", bg);
    disposable.push(t);
    const m = make("#ffffff", { map: t, emissive: "#b49c70", emissiveIntensity: 0.15, side: THREE.DoubleSide });
    put(unit.plane, m, x, y, z, w, w / 4, 1, 0, ry);
  }
  function beam(a, b, r = 0.09, mat = gold) {
    const va = new THREE.Vector3(...a),
      vb = new THREE.Vector3(...b),
      d = vb.clone().sub(va);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    matrix.compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(r, d.length(), r));
    const k = `${unit.cylinder.uuid}/${mat.uuid}`;
    if (!pools.has(k)) pools.set(k, { g: unit.cylinder, m: mat, matrices: [] });
    pools.get(k).matrices.push(matrix.clone());
  }
  function candle(x, y, z, s = 1) {
    cyl(gold, x, y + 0.025 * s, z, 0.14 * s, 0.05 * s);
    cyl(ivory, x, y + s * 0.3, z, 0.07 * s, 0.6 * s);
    cyl(black, x, y + s * 0.62, z, 0.012 * s, 0.07 * s);
    ball(ivory, x + 0.055 * s, y + s * 0.48, z, 0.026 * s, 0.7, 2.4, 1);
    ball(glow, x, y + s * 0.68, z, 0.075 * s, 0.65, 1.8, 0.65);
    glowPositions.push(x, y + s * 0.68, z);
  }
  function lamp(x, y, z) {
    cyl(gold, x, y - 0.55, z, 0.045, 1);
    ball(glow, x, y, z, 0.18, 1, 1.6, 1);
    ring(gold, x, y, z, 0.3, Math.PI / 2);
    cone(iron, x, y + 0.4, z, 0.3, 0.25);
    glowPositions.push(x, y, z);
  }
  function column(x, z, height = 11) {
    cyl(pale, x, height / 2, z, 0.38, height);
    cyl(stone, x, 0.2, z, 0.65, 0.4);
    cyl(stone, x, height - 0.2, z, 0.65, 0.4);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      cyl(pale, x + Math.sin(a) * 0.35, height / 2, z + Math.cos(a) * 0.35, 0.13, height);
      ball(pale, x + Math.sin(a) * 0.45, height - 0.65, z + Math.cos(a) * 0.45, 0.24, 1, 1.6, 1);
      cone(pale, x + Math.sin(a) * 0.45, height - 1, z + Math.cos(a) * 0.45, 0.18, 0.45, 0, Math.PI);
    }
    for (let y of [0.52, height - 1.1, height - 0.45]) ring(pale, x, y, z, 0.49, Math.PI / 2);
  }
  function archWindow(x, y, z, rotation = 0, w = 2.6, h = 6.2) {
    put(pointed(w, h), windowMat, x, y, z, 1, 1, 1, 0, rotation);
    put(pointed(w + 0.45, h + 0.35, true), pale, x, y - 0.15, z + 0.01, 1, 1, 1, 0, rotation);
    const dx = Math.sin(rotation),
      dz = Math.cos(rotation);
    put(pointed(w + 0.8, h + 0.62, true), stone, x - dx * 0.08, y - 0.29, z - dz * 0.08, 1, 1, 1, 0, rotation);
    box(pale, x + dx * 0.15, y - 0.25, z + dz * 0.15, w + 0.85, 0.22, 0.55, rotation);
    for (let j = -1; j <= 1; j++) {
      const offset = j * w * 0.24;
      box(iron, x + Math.cos(rotation) * offset, y + h * 0.38, z - Math.sin(rotation) * offset, 0.055, h * 0.75, 0.06, rotation);
    }
    for (let j = 1; j <= 3; j++) box(iron, x + dx * 0.025, y + j * h * 0.2, z + dz * 0.025, w, 0.055, 0.07, rotation);
  }
  function table(x, z, w = 3, d = 1.7, y = 1.15) {
    box(wood, x, y, z, w, 0.16, d);
    box(darkWood, x, y - 0.15, z, w - 0.12, 0.13, d - 0.12);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const px = x + a * (w / 2 - 0.22),
          pz = z + b * (d / 2 - 0.18);
        cyl(darkWood, px, y / 2, pz, 0.1, y);
        for (const yy of [0.18, y - 0.25]) cyl(wood, px, yy, pz, 0.135, 0.09);
      }
    for (const a of [-1, 1]) box(darkWood, x + a * (w / 2 - 0.22), 0.23, z, 0.08, 0.1, d - 0.2);
    colliders.push({ x, z, w, d });
  }
  function chair(x, z, rotation = 0, mat = darkWood) {
    const ca = Math.cos(rotation),
      sa = Math.sin(rotation);
    box(mat, x, 0.7, z, 0.72, 0.13, 0.74, rotation);
    box(mat, x - sa * 0.32, 1.22, z - ca * 0.32, 0.72, 1.15, 0.1, rotation);
    box(wood, x - sa * 0.37, 1.24, z - ca * 0.37, 0.55, 0.84, 0.05, rotation);
    for (const side of [-1, 1]) {
      ball(gold, x + side * 0.27 * ca - sa * 0.32, 1.85, z - side * 0.27 * sa - ca * 0.32, 0.055);
      box(mat, x + side * 0.29 * ca - sa * 0.32, 1.35, z - side * 0.29 * sa - ca * 0.32, 0.075, 1.03, 0.15, rotation);
    }
    for (const a of [-0.27, 0.27])
      for (const b of [-0.26, 0.26]) box(mat, x + a * ca + b * sa, 0.35, z - a * sa + b * ca, 0.08, 0.7, 0.08, rotation);
  }
  function scroll(x, y, z) {
    box(parchment, x, y, z, 0.48, 0.025, 0.34, 0.1);
    cyl(parchment, x - 0.25, y + 0.035, z, 0.035, 0.34, Math.PI / 2);
  }
  function bottle(x, y, z, mat = herb, s = 0.8) {
    cyl(mat, x, y + 0.18 * s, z, 0.13 * s, 0.36 * s);
    cyl(mat, x, y + 0.42 * s, z, 0.055 * s, 0.2 * s);
    cyl(gold, x, y + 0.53 * s, z, 0.065 * s, 0.05 * s);
  }
  function books(x, y, z, count = 10, axis = "x", scale = 1) {
    for (let i = 0; i < count; i++) {
      const ht = (0.35 + random() * 0.3) * scale;
      const px = x + (axis === "x" ? i * 0.17 * scale : 0),
        pz = z + (axis === "z" ? i * 0.17 * scale : 0);
      box(
        bookMats[(random() * bookMats.length) | 0],
        px,
        y + ht / 2,
        pz,
        axis === "x" ? 0.13 * scale : 0.4 * scale,
        ht,
        axis === "x" ? 0.4 * scale : 0.13 * scale,
      );
      box(gold, px, y + ht * 0.7, pz + 0.205 * scale, 0.12 * scale, 0.025 * scale, 0.012);
    }
  }
  function bookshelf(x, z, width = 5, rotation = 0, h = 6) {
    const along = (ox, oy, oz, m, w, hh, d) =>
      box(
        m,
        x + ox * Math.cos(rotation) + oz * Math.sin(rotation),
        oy,
        z - ox * Math.sin(rotation) + oz * Math.cos(rotation),
        w,
        hh,
        d,
        rotation,
      );
    along(0, h / 2, 0, darkWood, width, h, 0.8);
    for (let j = 0; j < 6; j++) {
      const y = 0.3 + (j * (h - 0.5)) / 6;
      along(0, y, 0.48, wood, width + 0.1, 0.12, 1);
      for (let i = 0; i < Math.floor(width / 0.21) - 1; i++) {
        const ox = -width / 2 + 0.25 + i * 0.21,
          ht = 0.4 + random() * 0.43;
        along(ox, y + 0.1 + ht / 2, 0.45, bookMats[(random() * 6) | 0], 0.16, ht, 0.65);
        along(ox, y + 0.1 + ht * 0.7, 0.79, gold, 0.14, 0.025, 0.02);
      }
    }
    along(-width / 2, h / 2, 0.4, wood, 0.14, h, 0.95);
    along(width / 2, h / 2, 0.4, wood, 0.14, h, 0.95);
    along(0, h + 0.1, 0.3, wood, width + 0.3, 0.2, 1.1);
  }
  function potPlant(x, y, z, s = 1, flower = false) {
    cyl(terra, x, y + 0.22 * s, z, 0.3 * s, 0.45 * s);
    cyl(pale, x, y + 0.45 * s, z, 0.32 * s, 0.07 * s);
    for (let j = 0; j < 7; j++) {
      const a = (j * TAU) / 7,
        ht = (0.6 + random() * 0.7) * s;
      beam([x, y + 0.4 * s, z], [x + Math.sin(a) * 0.3 * s, y + ht, z + Math.cos(a) * 0.3 * s], 0.025 * s, herb);
      put(
        unit.sphere,
        j % 2 ? herb : herbLight,
        x + Math.sin(a) * 0.33 * s,
        y + ht * 0.77,
        z + Math.cos(a) * 0.33 * s,
        0.13 * s,
        0.38 * s,
        0.09 * s,
        Math.cos(a) * 0.6,
        a,
        Math.sin(a) * 0.6,
      );
      if (flower) ball(fabrics[1], x + Math.sin(a) * 0.3 * s, y + ht, z + Math.cos(a) * 0.3 * s, 0.1 * s);
    }
  }
  function cauldron(x, y, z, s = 1) {
    ball(iron, x, y + 0.6 * s, z, 0.65 * s, 1, 0.8, 1);
    cyl(black, x, y + 0.96 * s, z, 0.52 * s, 0.035);
    ring(gold, x, y + 0.98 * s, z, 0.53 * s, Math.PI / 2);
    const liquid = make("#4da38a", { emissive: "#49caa8", emissiveIntensity: 0.5 });
    cyl(liquid, x, y + 0.98 * s, z, 0.46 * s, 0.025);
    for (let j = 0; j < 3; j++) {
      let a = (j * TAU) / 3;
      box(iron, x + Math.cos(a) * 0.42 * s, y + 0.15 * s, z + Math.sin(a) * 0.42 * s, 0.12 * s, 0.35 * s, 0.12 * s);
    }
    for (let j = 0; j < 4; j++) {
      const sp = new THREE.Mesh(
        unit.sphere,
        new THREE.MeshBasicMaterial({ color: "#99baa8", transparent: true, opacity: 0.1, depthWrite: false }),
      );
      sp.position.set(x + Math.sin(j) * 0.22 * s, y + 1.3 * s + j * 0.28, z);
      sp.scale.set(0.18 * s, 0.22 * s, 0.18 * s);
      group.add(sp);
      animated.push({ mesh: sp, kind: "steam", base: sp.position.clone(), phase: j, s });
      disposable.push(sp.material);
    }
  }
  function hearth(x, z, w = 5) {
    box(darkStone, x, 2, z, w, 4, 1.4);
    box(black, x, 1.3, z + 0.74, w - 1, 2.6, 0.05);
    box(pale, x, 4.1, z, w + 0.8, 0.3, 1.8);
    box(pale, x, 0.14, z + 0.6, w + 0.7, 0.28, 2);
    for (let j = 0; j < 6; j++) {
      const px = x + (j - 2.5) * 0.45;
      box(darkWood, px, 0.35, z + 0.8, 0.25, 0.25, 1, j * 0.3);
      cone(glow, px, 0.9, z + 0.9, 0.19, 0.95 + (j % 2) * 0.3);
    }
    if (embedded) lightAnchors.push({ x, y: 2, z: z + 2, color: "#ffae4c", intensity: 25, distance: 13, fire: true });
    else {
      const p = new THREE.PointLight("#ffae4c", 25, 13, 2);
      p.position.set(x, 2, z + 2);
      group.add(p);
      animated.push({ mesh: p, kind: "fire" });
    }
  }
  function rug(x, z, w, d, color = 0) {
    box(fabrics[color], x, 0.035, z, w, 0.035, d);
    for (const k of [-1, 1]) {
      box(gold, x + k * (w / 2 - 0.12), 0.06, z, 0.045, 0.01, d - 0.2);
      box(gold, x, 0.06, z + k * (d / 2 - 0.12), w - 0.2, 0.01, 0.045);
    }
  }
  function globe(x, y, z, s = 1) {
    ball(make("#3f696c", { roughness: 0.35 }), x, y, z, 0.65 * s);
    ring(gold, x, y, z, 0.78 * s, 0, 0, 0.3);
    cyl(gold, x, y - 0.9 * s, z, 0.05 * s, 0.8 * s);
    cyl(wood, x, y - 1.3 * s, z, 0.4 * s, 0.12 * s);
    for (let j = 0; j < 3; j++) ring(gold, x, y, z, 0.67 * s, Math.PI / 2, j * 0.8);
  }

  // Enclosing architecture: the rooms are intentionally tall, with the camera below the vault.
  const openTower = ["astronomy", "owlery"].includes(type),
    greenhouse = type === "herbology";
  box(type === "potions" || openTower ? stone : floorWood, 0, -0.3, 0, 29, 0.6, 37);
  if (greenhouse) {
    box(stone, 0, 0.5, -18, 28, 1, 1);
    for (const side of [-1, 1]) {
      box(stone, side * 14, 0.5, 0, 1, 1, 36);
      box(glass, side * 14, 5, 0, 0.12, 9, 36);
      for (let z = -17; z <= 17; z += 4) {
        beam([side * 14, 1, z], [side * 14, 10, z], 0.09, iron);
        beam([side * 14, 10, z], [0, 16, z], 0.1, iron);
      }
      put(unit.plane, glass, side * 7, 13, 0, 15.3, 36, 1, Math.PI / 2, -side * 0.405, 0);
    }
    for (let z = -17; z <= 17; z += 4) beam([-14, 10, z], [14, 10, z], 0.06, iron);
    box(glass, 0, 7, -18, 28, 13, 0.12);
    box(glass, 0, 7, 18, 28, 13, 0.12);
  } else if (openTower) {
    for (let s = 0; s < 8; s++) {
      let a = (s * Math.PI) / 4;
      box(stone, Math.sin(a) * 13.8, 1.5, Math.cos(a) * 13.8, 11.7, 3, 0.8, -a);
      for (let j = -2; j <= 2; j++)
        box(pale, Math.sin(a) * 13.8 + Math.cos(a) * j * 2.1, 3.4, Math.cos(a) * 13.8 - Math.sin(a) * j * 2.1, 1.1, 0.8, 1, -a);
    }
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(180, 24, 12),
      new THREE.MeshBasicMaterial({ color: "#101e35", side: THREE.BackSide }),
    );
    group.add(sky);
    disposable.push(sky.geometry, sky.material);
    const pts = [];
    for (let i = 0; i < 500; i++) {
      const a = random() * TAU,
        b = random() * Math.PI * 0.47,
        r = 160;
      pts.push(Math.sin(a) * Math.sin(b) * r, Math.cos(b) * r, Math.cos(a) * Math.sin(b) * r);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const sm = new THREE.PointsMaterial({ color: "#dbe6ef", size: 0.32, sizeAttenuation: true });
    group.add(new THREE.Points(sg, sm));
    disposable.push(sg, sm);
  } else {
    box(stone, 0, 7, -18, 29, 14, 1);
    if (embedded) {
      box(stone, -8.1, 7, 18, 12.8, 14, 1);
      box(stone, 8.1, 7, 18, 12.8, 14, 1);
      box(stone, 0, 10.2, 18, 3.4, 7.6, 1);
    } else box(stone, 0, 7, 18, 29, 14, 1);
    for (const side of [-1, 1]) {
      box(stone, side * 14, 7, 0, 1, 14, 37);
      for (let z = -12; z <= 12; z += 8) {
        archWindow(side * 13.46, 3, z, side < 0 ? Math.PI / 2 : -Math.PI / 2);
        column(side * 12.9, z - 3.6, 11.2);
        lamp(side * 12.5, 4.1, z - 3.2);
      }
    }
    for (let z = -16; z <= 16; z += 8) {
      // Stone ribs meet at a pointed central ridge.
      const rib = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-13, 10.8, z),
        new THREE.Vector3(-10, 13.2, z),
        new THREE.Vector3(-6, 15.5, z),
        new THREE.Vector3(0, 18, z),
        new THREE.Vector3(6, 15.5, z),
        new THREE.Vector3(10, 13.2, z),
        new THREE.Vector3(13, 10.8, z),
      ]);
      const geo = new THREE.TubeGeometry(rib, 32, 0.16, 6, false);
      put(geo, pale);
      disposable.push(geo);
    }
    if (type !== "hall") {
      for (const side of [-1, 1]) {
        put(unit.box, darkStone, side * 7, 14.5, 0, 16.4, 0.25, 37, 0, 0, -side * 0.46);
      }
      // A separate high canopy leaves every window and vault visible from a walking camera.
      box(darkStone, 0, 18.3, 0, 29, 0.25, 37);
    }
    for (let x = -7; x <= 7; x += 7) archWindow(x, 5, -17.45, 0, 3, 7.5);
    if (!embedded) put(pointed(3.7, 6), darkWood, 0, 0, 17.46, 1, 1, 1, 0, Math.PI);
    put(pointed(4.1, 6.3, true), pale, 0, 0, 17.4, 1, 1, 1, 0, Math.PI);
    label("HOGWART", room.name || "Szkoła Magii i Czarodziejstwa", 0, 7.4, 17.35, 5, Math.PI);
  }

  // rooms with raised floors (a walkable flight of stairs) report their height here
  let floorAt = null;
  // Each room has a distinct arrangement and silhouette.
  if (type === "hall") {
    // four house tables with real aisles between them (the benches sit clear of the next table)
    for (let row = 0; row < 4; row++) {
      const x = HALL_TABLE_X[row];
      table(x, 1, 2.2, 23, 1.25);
      for (const side of [-1, 1]) {
        box(wood, x + side * HALL_BENCH_X, 0.7, 1, 0.5, 0.18, 23);
        for (let z = -9; z <= 11; z += 4) box(darkWood, x + side * HALL_BENCH_X, 0.35, z, 0.2, 0.7, 0.3);
      }
      for (let z = -9; z <= 11; z += 2) {
        for (const side of [-1, 1]) {
          cyl(gold, x + side * 0.7, 1.38, z, 0.26, 0.045);
          cyl(gold, x + side * 0.3, 1.55, z + 0.36, 0.085, 0.35);
          box(iron, x + side * 1.02, 1.38, z, 0.04, 0.02, 0.42);
        }
        candle(x, 1.35, z, 1.1);
      }
      box(fabrics[row], x, 9, -16.7, 2, 5, 0.06);
      cone(gold, x, 6.25, -16.7, 1, 0.7, 0, Math.PI);
    }
    box(stone, 0, 0.04, -14.5, 24, 0.08, 5);
    table(0, -14.5, 21, 1.8, 1.25);
    for (let x = -9; x <= 9; x += 3) chair(x, -15.5);
    label("DRACO DORMIENS NUNQUAM TITILLANDUS", "", 0, 10.8, -17.3, 9);
    // enchanted ceiling, floating candles and the feast live in their own module
    const magic = createHallMagic({ random });
    group.add(magic.group);
    animated.push({ kind: "magic", magic });
    disposable.push(magic);
  } else if (type === "classroom") {
    for (let row = 0; row < 4; row++)
      for (const side of [-1, 1]) {
        const x = side * 5,
          z = 8 - row * 5;
        table(x, z, 5.7, 2.1);
        chair(x - 1.4, z + 1.45);
        chair(x + 1.4, z + 1.45);
        scroll(x - 1.4, 1.25, z);
        scroll(x + 1.4, 1.25, z);
        books(x, 1.25, z, 3);
      }
    box(stone, 0, 0.25, -13, 20, 0.5, 6);
    table(0, -12.4, 5, 2, 1.45);
    box(darkWood, 0, 5, -17.25, 11, 5.8, 0.3);
    label(room.subject || room.name, "Bądź uważny. Każde zaklęcie zaczyna się od skupienia.", 0, 5, -17.05, 10.4, 0, "#163630");
    bookshelf(-10.7, -15, 4);
    bookshelf(10.7, -15, 4);
    if (/trans|przem|mcgon/i.test(id + room.subject)) {
      for (let x of [-8, 8]) {
        table(x, -10, 2, 1.5);
        ball(pale, x, 1.65, -10, 0.22, 1, 1.4, 1);
        cone(pale, x, 1.93, -10, 0.18, 0.3);
      }
      rug(0, -7, 3.5, 7, 0);
    } else if (/obron|defen|lupin|czarn/i.test(id + room.subject)) {
      for (let x of [-10, 10]) {
        cyl(wood, x, 1.8, -7, 0.14, 3.6);
        ball(fabrics[0], x, 2.8, -7, 0.6);
        box(darkWood, x, 1, -7, 1, 0.2, 1);
        ring(gold, x, 2.8, -6.4, 0.38);
      }
      box(wood, 0, 2.6, -17, 1.3, 0.3, 1);
    } else if (/wroz|divin/i.test(id + room.subject)) {
      for (let x of [-9, 9]) {
        table(x, -7, 2, 2);
        ball(make("#bccfdd", { transparent: true, opacity: 0.55, emissive: "#7794a6", emissiveIntensity: 0.35 }), x, 1.65, -7, 0.45);
      }
      rug(0, -7, 4, 8, 0);
    } else {
      for (let x of [-9, 9]) {
        table(x, -8, 2, 1.6);
        const quill = make("#e1dfcc");
        put(unit.sphere, quill, x, 1.9, -8, 0.12, 0.55, 0.04, 0.3, 0, 0.5);
      }
    }
  } else if (type === "potions") {
    for (let row = 0; row < 3; row++)
      for (const side of [-1, 1]) {
        const x = side * 5.5,
          z = 7 - row * 6;
        table(x, z, 5.5, 3);
        cauldron(x, 1.25, z, 0.8);
        for (let j = -1; j <= 1; j++) bottle(x + j * 1.6, 1.25, z - 0.7, bookMats[(j + row + 4) % 6], 0.8);
        scroll(x + 1.7, 1.25, z + 0.6);
        chair(x, z + 2.1);
      }
    for (let s of [-1, 1])
      for (let z of [-12, -4, 4]) {
        box(darkWood, s * 12.5, 3, z, 1.5, 6, 5);
        for (let y = 1; y <= 5; y += 1) {
          box(wood, s * 12.2, y, z, 1.8, 0.12, 5);
          for (let j = -2; j <= 2; j++) bottle(s * 11.8, y + 0.1, z + j * 0.8, bookMats[(j + y + 4) % 6], 1.1);
        }
      }
    table(0, -13, 7, 2.5, 1.5);
    cauldron(0, 1.6, -13, 1.1);
    label("POTIONES", "Precyzja. Cierpliwość. Ani kropli więcej.", 0, 6, -17.25, 9);
    for (let x of [-6, 6]) {
      cyl(iron, x, 2.5, -16, 0.3, 5);
      for (let y of [1, 4]) ring(gold, x, y, -16, 0.34, Math.PI / 2);
    }
  } else if (type === "herbology") {
    for (let row = 0; row < 4; row++)
      for (let side of [-1, 1]) {
        const x = side * 6,
          z = 9 - row * 6;
        table(x, z, 7, 3, 1.1);
        for (let j = 0; j < 6; j++) potPlant(x + ((j % 3) - 1) * 1.9, 1.2, z + (j < 3 ? -0.7 : 0.7), 0.8 + random() * 0.4, j % 3 === 0);
      }
    for (let side of [-1, 1]) for (let z = -14; z <= 14; z += 4) potPlant(side * 12, 0, z, 2.4);
    table(0, -13, 5, 2, 1.2);
    potPlant(0, 1.3, -13, 1.6, true);
    label("HERBOLOGIA", "Serce szklarni bije bardzo powoli.", 0, 6, -17.8, 8);
    for (let side of [-1, 1])
      for (let z of [-10, 0, 10]) {
        beam([side * 7, 14, z], [side * 7, 8, z], 0.025, iron);
        cyl(terra, side * 7, 7.8, z, 0.55, 0.5);
        for (let j = 0; j < 5; j++)
          put(unit.sphere, herb, side * 7 + Math.sin(j) * 0.4, 7.2 - j * 0.2, z + Math.cos(j) * 0.3, 0.2, 0.9, 0.2);
      }
  } else if (type === "astronomy") {
    rug(0, 0, 7, 10, 2);
    for (let x of [-7, 0, 7]) {
      const z = x === 0 ? -7 : 2;
      for (let a = 0; a < 3; a++) {
        let angle = (a * TAU) / 3;
        beam([x, 2.2, z], [x + Math.sin(angle) * 1.2, 0, z + Math.cos(angle) * 1.2], 0.08, gold);
      }
      beam([x, 2.3, z], [x, 3.4, z - 2.9], 0.32, gold);
      beam([x, 2.25, z + 0.2], [x, 2.8, z - 1], 0.22, iron);
      cyl(glass, x, 3.4, z - 2.9, 0.3, 0.02, 1.2);
    }
    table(-8, -8, 5, 2);
    scroll(-8, 1.25, -8);
    globe(8, 2, -8, 1.4);
    label("ASTRONOMIA", "Spójrz dalej niż sięga światło zamku.", 0, 3, -13.3, 7);
    for (let i = 0; i < 12; i++) {
      let a = (i * TAU) / 12;
      box(gold, Math.sin(a) * 5, 0.025, Math.cos(a) * 5, 0.06, 0.025, 0.4, -a);
    }
    ring(gold, 0, 0.07, 0, 5, Math.PI / 2);
  } else if (type === "library") {
    for (const s of [-1, 1]) for (let z of [-12, -4, 4, 12]) bookshelf(s * 12.5, z, 7, s < 0 ? Math.PI / 2 : -Math.PI / 2, 8);
    for (let x of [-7, 7]) for (let z of [-10, 0, 10]) bookshelf(x, z, 5, Math.PI / 2, 6);
    for (let z of [-6, 5]) {
      table(0, z, 5, 5);
      for (let x of [-1.4, 1.4]) {
        chair(x, z + 3);
        scroll(x, 1.25, z + 1.2);
        books(x, 1.25, z - 1, 6);
      }
      candle(0, 1.3, z, 1.2);
    }
    label("BIBLIOTEKA HOGWARTU", "Wiedza czeka na tych, którzy potrafią słuchać.", 0, 9, -17.3, 9);
    for (let x = -6; x <= 6; x += 2) {
      box(iron, x, 3, -15, 0.05, 6, 0.08);
    }
    box(iron, 0, 6, -15, 12, 0.1, 0.1);
    label("DZIAŁ KSIĄG ZAKAZANYCH", "", 0, 6.7, -14.9, 5);
  } else if (type === "common") {
    const house = /slyth|sliz/i.test(id) ? 3 : /raven|kruk/i.test(id) ? 2 : /huff|puch/i.test(id) ? 1 : 0;
    hearth(0, -16, 7);
    rug(0, -7, 14, 13, house);
    for (let side of [-1, 1]) {
      box(fabrics[house], side * 5, 1, -7, 2, 1.4, 6);
      box(fabrics[house], side * 6, 1.7, -7, 0.6, 2.3, 6);
      for (let z of [-9.8, -4.2]) box(darkWood, side * 5, 1.4, z, 2.3, 1.7, 0.4);
      bookshelf(side * 10, -15, 5);
    }
    table(0, -6, 4, 4, 0.65);
    books(-0.7, 0.75, -6, 7);
    candle(1, 0.75, -6, 1.3);
    for (let x of [-8, 8]) {
      table(x, 7, 4, 3);
      chair(x, 9);
      scroll(x, 1.25, 7);
      lamp(x, 3, 7);
    }
    for (let x of [-8, 8]) {
      box(gold, x, 5, -17.35, 3, 3.8, 0.15);
      box(fabrics[house], x, 5, -17.25, 2.8, 3.6, 0.1);
      ball(gold, x, 5.2, -17.12, 0.55, 1, 1.3, 0.1);
    }
  } else if (type === "office") {
    rug(0, -3, 12, 17, 2);
    table(0, -8, 7, 3, 1.3);
    chair(0, -10);
    scroll(-2, 1.4, -8);
    books(1, 1.4, -8, 6);
    candle(-2.6, 1.4, -8, 1.2);
    for (const s of [-1, 1]) {
      bookshelf(s * 10, -13, 5);
      bookshelf(s * 12, 0, 6, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      globe(s * 8, 2, -5, 1.3);
    }
    hearth(0, -17, 5);
    for (let x of [-8, 8]) {
      box(gold, x, 6, -17.3, 3.5, 4.5, 0.18);
      box(fabrics[2], x, 6, -17.18, 3.3, 4.3, 0.08);
      ball(ivory, x, 6.3, -17.05, 0.5, 1, 1.3, 0.1);
    }
    if (/dumbled|dyrekt|head/i.test(id + room.professor)) {
      cyl(gold, 5, 1.8, -9, 0.07, 3.6);
      ball(fabrics[0], 5, 3.7, -9, 0.35, 1, 1.3, 1);
      cone(gold, 5, 4.1, -9, 0.17, 0.4);
      put(unit.sphere, fabrics[0], 5.3, 3.7, -9, 0.8, 0.15, 0.25);
      table(-6, 0, 3, 3);
      cyl(pale, -6, 1.4, 0, 1, 0.45);
      cyl(windowMat, -6, 1.65, 0, 0.85, 0.04);
    }
  } else if (type === "hospital") {
    for (let side of [-1, 1])
      for (let z of [-12, -5, 2, 9]) {
        const x = side * 8;
        box(iron, x, 0.6, z, 4, 0.12, 2.3);
        box(ivory, x, 0.84, z, 3.9, 0.35, 2.2);
        box(parchment, x - side * 1.3, 1.08, z, 0.8, 0.2, 1.8);
        box(fabrics[2], x + side * 0.5, 1.04, z, 2.7, 0.04, 2.2);
        for (let xx of [-1.9, 1.9]) for (let zz of [-1, 1]) cyl(iron, x + xx, 0.75, z + zz, 0.055, 1.5);
        table(side * 11.5, z + 1.7, 1.3, 1.3, 0.9);
        bottle(side * 11.5, 1, z + 1.7, herbLight);
      }
    table(0, -14, 4, 2);
    books(-1, 1.25, -14, 6);
    label("SKRZYDŁO SZPITALNE", "Spokój jest częścią każdego lekarstwa.", 0, 6, -17.3, 8);
  } else if (type === "bathroom") {
    box(pale, 0, 0.4, -1, 18, 0.8, 22);
    box(windowMat, 0, 0.82, -1, 15, 0.06, 19);
    for (let x of [-8, 8]) box(pale, x, 1, -1, 1.2, 0.4, 22);
    for (let z of [-11.5, 9.5]) box(pale, 0, 1, z, 18, 0.4, 1.2);
    for (let x = -6; x <= 6; x += 2) {
      beam([x, 1, -12], [x, 1.8, -12], 0.12, gold);
      beam([x, 1.8, -12], [x, 1.8, -11.2], 0.12, gold);
      ball(gold, x, 1.8, -12.2, 0.16);
    }
    label("ŁAZIENKA PREFEKTÓW", "", 0, 7, -17.3, 8);
    for (let x of [-11, 11]) {
      cyl(pale, x, 1.4, 4, 0.8, 0.3);
      cyl(pale, x, 0.7, 4, 0.22, 1.3);
    }
  } else if (type === "kitchen") {
    for (let row = 0; row < 3; row++)
      for (let x of [-6, 6]) {
        const z = 8 - row * 7;
        table(x, z, 7, 4);
        for (let j = 0; j < 5; j++) {
          ball(terra, x - 2 + j, 1.4, z, 0.3, 1, 0.6, 1);
          cyl(pale, x - 2 + j, 1.3, z + 1, 0.35, 0.06);
        }
        cauldron(x, 0, z - 2.8, 0.8);
      }
    for (let x of [-8, 0, 8]) hearth(x, -17, 5);
    for (let s of [-1, 1])
      for (let z of [-10, 0, 10]) {
        cyl(wood, s * 12, 0.8, z, 0.65, 1.6);
        for (let y of [0.2, 1.3]) ring(iron, s * 12, y, z, 0.68, Math.PI / 2);
      }
    label("KUCHNIE HOGWARTU", "", 0, 7, -17.25, 8);
  } else if (type === "chamber") {
    for (let s of [-1, 1])
      for (let z of [-12, -4, 4, 12]) {
        column(s * 8, z, 10);
        const a = new THREE.CatmullRomCurve3([
          new THREE.Vector3(s * 9, 0.2, z),
          new THREE.Vector3(s * 9.8, 2, z),
          new THREE.Vector3(s * 8.4, 4, z),
          new THREE.Vector3(s * 9.3, 6, z),
        ]);
        const geo = new THREE.TubeGeometry(a, 20, 0.22, 8, false);
        put(geo, herb);
        disposable.push(geo);
        ball(herb, s * 9.3, 6.2, z, 0.38, 1, 1.5, 1);
      }
    box(windowMat, 0, 0.04, 0, 6, 0.05, 29);
    for (let s of [-1, 1]) box(stone, s * 5, 0.15, 0, 3, 0.3, 32);
    ball(darkStone, 0, 6, -16.7, 4, 1, 1.4, 0.25);
    ball(black, -1.4, 7, -15.6, 0.5);
    ball(black, 1.4, 7, -15.6, 0.5);
    put(pointed(2.8, 4), black, 0, 0.3, -15.6);
    label("KOMNATA TAJEMNIC", "", 0, 12, -17.3, 8);
  } else if (type === "owlery") {
    for (let s = 0; s < 8; s++) {
      let a = (s * TAU) / 8;
      const x = Math.sin(a) * 11,
        z = Math.cos(a) * 11;
      box(wood, x, 2, z, 4, 4, 1, -a);
      for (let i = 0; i < 6; i++) {
        const px = x + Math.cos(a) * ((i % 3) - 1) * 1.2,
          pz = z - Math.sin(a) * ((i % 3) - 1) * 1.2,
          py = 0.7 + (i > 2 ? 1.8 : 0);
        ball(black, px, py + 0.5, pz, 0.45, 1, 1, 0.3);
        ball(ivory, px, py + 0.4, pz + 0.4, 0.23, 1, 1.5, 1);
        ball(ivory, px, py + 0.7, pz + 0.4, 0.19);
        ball(black, px - 0.065, py + 0.72, pz + 0.57, 0.04);
        ball(black, px + 0.065, py + 0.72, pz + 0.57, 0.04);
      }
    }
    table(0, 0, 3, 3);
    scroll(0, 1.25, 0);
    for (let j = 0; j < 12; j++) box(parchment, (random() - 0.5) * 20, 0.015, (random() - 0.5) * 20, 0.1, 0.01, 0.5, random() * TAU);
  } else {
    // Passage / moving stair landing / trophy gallery.
    rug(0, 0, 4, 32, 0);
    for (let side of [-1, 1])
      for (let z of [-12, -4, 4, 12]) {
        box(gold, side * 13.35, 5, z, 0.18, 3.8, 2.7);
        box(fabrics[((z + 12) / 8) % 4], side * 13.22, 5, z, 0.1, 3.6, 2.5);
        ball(pale, side * 13.12, 5.3, z, 0.43, 0.12, 1.3, 1);
      }
    if (/stair|schod/i.test(id)) {
      // A real flight: you climb it to a landing with a door into the castle's staircase tower.
      for (let k = 0; k < 18; k++) box(stone, -7, (k * 0.25 + 0.25) / 2, 9 - k * 0.85, 5, k * 0.25 + 0.25, 0.95);
      box(stone, -8.75, 4.25, -8.3, 8.7, 0.5, 4.9);
      for (const [cx, cz] of [[-5.1, -10.2], [-12.4, -10.2], [-12.4, -6.4]]) cyl(stone, cx, 2, cz, 0.32, 4);
      for (const rx of [-9.4, -4.6]) {
        for (let k = 0; k < 18; k += 2) cyl(gold, rx, k * 0.25 + 0.25 + 0.55, 9 - k * 0.85, 0.04, 1.1);
        beam([rx, 1.35, 9], [rx, 5.6, -5.45], 0.08, gold);
      }
      // landing rails: east edge, north edge and the short edge beside the top step
      const rails = [[[-4.6, -5.45], [-4.6, -10.55]], [[-4.6, -10.55], [-13.2, -10.55]], [[-9.4, -5.85], [-13.2, -5.85]]];
      for (const [[ax, az], [bx, bz]] of rails) {
        beam([ax, 5.6, az], [bx, 5.6, bz], 0.08, gold);
        const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 1.3));
        for (let i = 0; i <= n; i++) cyl(gold, ax + ((bx - ax) * i) / n, 5.05, az + ((bz - az) * i) / n, 0.04, 1.1);
      }
      // the door in the west wall
      box(darkWood, -13.42, 6.1, -8.3, 0.12, 3.2, 2.0);
      box(gold, -13.4, 7.78, -8.3, 0.16, 0.16, 2.4);
      for (const dz of [-1.12, 1.12]) box(gold, -13.4, 6.1, -8.3 + dz, 0.16, 3.3, 0.16);
      ball(gold, -13.3, 6.0, -7.55, 0.07);
      label("WIEŻA SCHODÓW", "przejście do zamku", -13.3, 8.7, -8.3, 3.2, Math.PI / 2);
      // thin walls keep you on the flight: the only way up is from the bottom step
      colliders.push({ x: -9.6, z: 1.78, w: 0.2, d: 15.35, height: 6 }, { x: -4.4, z: -0.58, w: 0.2, d: 20.05, height: 6 });
      colliders.push({ x: -8.7, z: -10.7, w: 8.8, d: 0.2, height: 6 }, { x: -11.3, z: -5.8, w: 3.4, d: 0.2, height: 6 });
      floorAt = (x, z) => {
        if (x >= -4.4 || z > 9.45 || z < -10.7) return 0;
        if (z < -5.9) return 4.5;
        return x > -9.6 ? Math.min(4.5, Math.max(0, (9.45 - z) / 0.85) * 0.25) : 0;
      };
    } else {
      for (let x of [-8, 8])
        for (let z of [-10, 2, 10]) {
          cyl(stone, x, 0.65, z, 0.6, 1.3);
          cyl(gold, x, 1.65, z, 0.08, 0.8);
          ball(gold, x, 2.2, z, 0.35, 0.9, 0.9, 0.9);
          ring(gold, x - 0.35, 2.2, z, 0.23);
          ring(gold, x + 0.35, 2.2, z, 0.23);
        }
    }
    label(room.name || "Korytarze Hogwartu", "", 0, 9, -17.25, 9);
  }

  const professor = typeof room.professor === "string" ? room.professor : room.professor?.name || "";
  let teacherPosition = [0, 0, -10];
  if (type === "hall") teacherPosition = [0, 0.08, -12.9];
  else if (type === "potions") teacherPosition = [2, 0, -10];
  else if (type === "astronomy") teacherPosition = [3, 0, -8];
  else if (type === "herbology") teacherPosition = [2, 0, -11];
  else if (type === "office") teacherPosition = [3, 0, -7];
  if (professor) {
    const [x, y, z] = teacherPosition;
    const snape = /snape/i.test(professor),
      mcgon = /mcgon/i.test(professor),
      dumble = /dumbled/i.test(professor),
      hagrid = /hagrid/i.test(professor),
      sprout = /sprout/i.test(professor),
      flit = /flitwick/i.test(professor),
      trelaw = /trelaw/i.test(professor),
      lupin = /lupin/i.test(professor),
      binns = /binns/i.test(professor);
    const s = hagrid ? 1.45 : flit ? 0.72 : 1;
    const robe = make(
      snape ? "#121822" : mcgon ? "#264e3d" : dumble ? "#777788" : sprout ? "#82734d" : lupin ? "#6d6151" : trelaw ? "#965e49" : "#4a4b60",
      binns ? { transparent: true, opacity: 0.5, emissive: "#5e849b", emissiveIntensity: 0.25 } : {},
    );
    const skin = make("#c4a48d", { roughness: 0.62 }),
      hair = make(snape ? "#17191d" : mcgon ? "#79746a" : dumble ? "#d3d2c3" : hagrid ? "#3f3127" : sprout ? "#8c7a5c" : "#897a68");
    const lips = make("#825e54", { roughness: 0.65 }),
      eyeWhite = make("#ddd7c6", { roughness: 0.4 }),
      iris = make(snape ? "#34352d" : dumble ? "#597f9b" : "#756e52");
    const robeGeo = new THREE.LatheGeometry(
      [
        [0.59, 0.08],
        [0.62, 0.18],
        [0.57, 0.45],
        [0.48, 0.8],
        [0.37, 1.1],
        [0.34, 1.38],
        [0.43, 1.65],
        [0.36, 1.82],
        [0.16, 1.94],
      ].map(([r, h]) => new THREE.Vector2(r, h)),
      36,
    );
    const robePos = robeGeo.attributes.position;
    for (let i = 0; i < robePos.count; i++) {
      const a = Math.atan2(robePos.getX(i), robePos.getZ(i)),
        h = robePos.getY(i),
        fold = 1 + Math.sin(a * 12 + 0.4) * 0.035 * (1 - h / 2);
      robePos.setX(i, robePos.getX(i) * fold);
      robePos.setZ(i, robePos.getZ(i) * fold * 0.72);
    }
    robeGeo.computeVertexNormals();
    put(robeGeo, robe, x, y, z, s, s, s);
    disposable.push(robeGeo);
    for (let side of [-1, 1]) {
      ball(black, x + side * 0.23 * s, y + 0.12 * s, z + 0.15 * s, 0.2 * s, 0.8, 0.6, 1.7);
      beam(
        [x + side * 0.07 * s, y + 1.82 * s, z + 0.18 * s],
        [x + side * 0.1 * s, y + 0.32 * s, z + 0.43 * s],
        0.015 * s,
        dumble || mcgon ? gold : darkWood,
      );
    }
    for (let j = 0; j < 6; j++) ball(gold, x, y + (1.67 - j * 0.16) * s, z + (0.27 + j * 0.02) * s, 0.022 * s);
    ball(parchment, x, y + 1.89 * s, z + 0.055 * s, 0.13 * s, 1, 0.65, 1);
    put(unit.cylinder, robe, x - 0.42 * s, y + 1.4 * s, z, 0.17 * s, 0.85 * s, 0.17 * s, 0, 0, -0.25);
    put(unit.cylinder, robe, x + 0.42 * s, y + 1.4 * s, z, 0.17 * s, 0.85 * s, 0.17 * s, 0, 0, 0.25);
    ball(skin, x - 0.51 * s, y + 1.02 * s, z + 0.06, 0.13 * s);
    ball(skin, x + 0.51 * s, y + 1.02 * s, z + 0.06, 0.13 * s);
    ball(skin, x, y + 2.12 * s, z, 0.3 * s, 0.86, 1.2, 0.85);
    ball(hair, x, y + 2.34 * s, z - 0.03, 0.29 * s, 1, 0.5, 1);
    ball(skin, x, y + 2.12 * s, z + 0.27 * s, 0.055 * s, 0.7, 1.2, 1.4);
    ball(skin, x, y + 2.03 * s, z + 0.23 * s, 0.12 * s, 0.85, 0.65, 0.5);
    for (let side of [-1, 1]) {
      ball(skin, x + side * 0.25 * s, y + 2.13 * s, z, 0.062 * s, 0.6, 1.3, 0.9);
      ball(eyeWhite, x + side * 0.105 * s, y + 2.17 * s, z + 0.249 * s, 0.037 * s, 1.1, 0.62, 0.6);
      ball(iris, x + side * 0.105 * s, y + 2.17 * s, z + 0.271 * s, 0.018 * s, 1, 1, 0.35);
      ball(black, x + side * 0.105 * s, y + 2.17 * s, z + 0.279 * s, 0.008 * s);
      beam([x + side * 0.065 * s, y + 2.225 * s, z + 0.248 * s], [x + side * 0.15 * s, y + 2.23 * s, z + 0.23 * s], 0.014 * s, hair);
      for (let f = 0; f < 3; f++) ball(skin, x + side * (0.49 + f * 0.035) * s, y + 0.98 * s, z + 0.12 * s, 0.028 * s, 0.8, 1.7, 0.8);
    }
    beam([x - 0.059 * s, y + 2.02 * s, z + 0.269 * s], [x + 0.059 * s, y + 2.02 * s, z + 0.269 * s], 0.012 * s, lips);
    if (snape || hagrid || trelaw) {
      for (let side of [-1, 1]) ball(hair, x + side * 0.24 * s, y + 2.05 * s, z - 0.04, 0.2 * s, 0.6, 1.7, 1.2);
    }
    if (dumble || hagrid || flit) {
      cone(hair, x, y + 1.8 * s, z + 0.22 * s, 0.23 * s, dumble ? 0.85 * s : 0.4 * s, 0, Math.PI);
      for (let j = -3; j <= 3; j++)
        beam(
          [x + j * 0.05 * s, y + 2.02 * s, z + 0.26 * s],
          [x + j * 0.025 * s, y + (dumble ? 1.43 : 1.68) * s, z + 0.28 * s],
          0.016 * s,
          hair,
        );
    }
    if (mcgon || sprout || dumble) {
      cyl(robe, x, y + 2.48 * s, z, 0.5 * s, 0.06 * s);
      cone(robe, x, y + 2.84 * s, z, 0.29 * s, 0.8 * s, 0, 0.06);
      ring(gold, x, y + 2.52 * s, z, 0.31 * s, Math.PI / 2);
    }
    if (mcgon || dumble || flit || trelaw) {
      for (let side of [-1, 1]) ring(gold, x + side * 0.11 * s, y + 2.17 * s, z + 0.27 * s, 0.092 * s);
      beam([x - 0.02 * s, y + 2.17 * s, z + 0.27 * s], [x + 0.02 * s, y + 2.17 * s, z + 0.27 * s], 0.012, gold);
    }
    beam([x + 0.52 * s, y + 1.05 * s, z], [x + 0.67 * s, y + 1.45 * s, z + 0.7 * s], 0.022, darkWood);
    // A discreet floor ring gives the encounter a clear spatial focus.
    ring(gold, x, y + 0.035, z, 0.95 * s, Math.PI / 2);
    label(professor, room.subject || "Profesor Hogwartu", x, y + 3.4 * s, z, 3.5);
  }

  for (const { g, m, matrices } of pools.values()) {
    const mesh = new THREE.InstancedMesh(g, m, matrices.length);
    matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (!embedded) {
    group.add(
      new THREE.HemisphereLight(
        greenhouse ? "#d2e0df" : openTower ? "#a2bad4" : "#e0d9c4",
        type === "potions" ? "#23382f" : "#4e382a",
        greenhouse ? 1.65 : 0.85,
      ),
    );
    const key = new THREE.DirectionalLight(openTower ? "#9bb6de" : "#e3d5ae", openTower ? 1.3 : 1.65);
    key.position.set(-5, 12, 8);
    group.add(key);
  }
  for (let z of [-10, 6]) {
    const color = type === "potions" ? "#a7c7a8" : "#ffcf86",
      intensity = type === "hall" ? 55 : 35;
    if (embedded) {
      lightAnchors.push({ x: 0, y: 6, z, color, intensity, distance: 30, room: true });
      continue;
    }
    const light = new THREE.PointLight(color, intensity, 30, 2);
    light.position.set(0, 6, z);
    group.add(light);
  }
  const dustGeo = new THREE.BufferGeometry(),
    dust = [];
  for (let i = 0; i < 180; i++) dust.push((random() - 0.5) * 25, 1 + random() * 12, (random() - 0.5) * 32);
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dust, 3));
  const dustMat = new THREE.PointsMaterial({ color: "#d5c19b", size: 0.026, transparent: true, opacity: 0.45, depthWrite: false });
  const motes = new THREE.Points(dustGeo, dustMat);
  group.add(motes);
  disposable.push(dustGeo, dustMat);
  if (glowPositions.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(glowPositions, 3));
    const m = new THREE.PointsMaterial({
      map: candleGlow(),
      color: "#ffd994",
      size: 0.7,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halos = new THREE.Points(g, m);
    halos.userData.skipAO = true;
    group.add(halos);
    disposable.push(g, m);
  }
  return {
    group,
    spawn: [0, 2.4, 14],
    lookAt: [0, 3, -10],
    bounds: { minX: -12.6, maxX: 12.6, minZ: -16.3, maxZ: 16.3 },
    teacherPosition,
    colliders,
    floorAt,
    lightAnchors,
    type,
    update(time) {
      motes.rotation.y = Math.sin(time * 0.04) * 0.025;
      for (const a of animated) {
        if (a.kind === "steam") {
          a.mesh.position.y = a.base.y + ((time * 0.2 + a.phase * 0.2) % 1) * a.s;
          a.mesh.position.x = a.base.x + Math.sin(time * 0.5 + a.phase) * 0.12;
          a.mesh.material.opacity = 0.065 + Math.sin(time + a.phase) * 0.025;
        } else if (a.kind === "magic") a.magic.update(time);
        else if (a.kind === "fire") a.mesh.intensity = 24 + Math.sin(time * 7) * 2 + Math.sin(time * 11) * 2;
      }
    },
    dispose() {
      disposed = true;
      for (const item of disposable) item.dispose?.();
      group.traverse((o) => {
        if (o.isInstancedMesh) o.dispose?.();
      });
    },
  };
}
