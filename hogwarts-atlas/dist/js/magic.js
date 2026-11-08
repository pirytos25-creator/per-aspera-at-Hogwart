import * as THREE from '../assets/three.module.js';

const TAU = Math.PI * 2,
  clamp = THREE.MathUtils.clamp;
const smooth = t => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = t => t - Math.floor(t);

// Effects remain at their point of casting. Each one owns and releases its GPU resources.
export function createMagic(scene, camera) {
  const effects = [];
  function context(id, isInterior, duration) {
    const root = new THREE.Group();
    root.name = `spell-${id}`;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const scale = isInterior ? 1 : 3.5;
    root.position.copy(camera.getWorldPosition(new THREE.Vector3())).addScaledVector(direction, 5.7 * scale);
    root.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
    root.scale.setScalar(scale);
    scene.add(root);
    const geometries = new Set(),
      materials = new Set();
    const c = { id, root, scale, age: 0, duration, geometries, materials, animate() {} };
    const remember = g => {
      geometries.add(g);
      return g;
    };
    c.material = (color, opacity = 1, extra = {}) => {
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        ...extra,
      });
      m.userData.magicOpacity = opacity;
      materials.add(m);
      return m;
    };
    c.mesh = (geometry, material, parent = root) => {
      remember(geometry);
      const m = new THREE.Mesh(geometry, material);
      parent.add(m);
      return m;
    };
    const sphereGeo = remember(new THREE.SphereGeometry(1, 16, 10)),
      cylinderGeo = remember(new THREE.CylinderGeometry(1, 1, 1, 8));
    c.ball = (position, size, material, parent = root) => {
      const m = c.mesh(sphereGeo, material, parent);
      m.position.set(...position);
      m.scale.set(...(Array.isArray(size) ? size : [size, size, size]));
      return m;
    };
    c.segment = (a, b, radius, material, parent = root) => {
      const av = new THREE.Vector3(...a),
        bv = new THREE.Vector3(...b),
        delta = bv.clone().sub(av);
      const m = c.mesh(cylinderGeo, material, parent);
      m.position.copy(av.add(bv).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
      m.scale.set(radius, delta.length(), radius);
      return m;
    };
    c.ring = (radius, thickness, material, parent = root) =>
      c.mesh(new THREE.TorusGeometry(radius, thickness, 6, 80), material, parent);
    c.tube = (points, radius, material, parent = root) => {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      return c.mesh(
        new THREE.TubeGeometry(curve, Math.max(24, points.length * 5), radius, 5, false),
        material,
        parent,
      );
    };
    c.points = (count, color, size = 0.1) => {
      const geometry = remember(new THREE.BufferGeometry()),
        positions = new Float32Array(count * 3),
        sizes = new Float32Array(count);
      for (let i = 0; i < count; i++) sizes[i] = size * (0.45 + Math.random() * 0.8);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: 1 },
          uScale: { value: scale },
        },
        vertexShader: `attribute float aSize;uniform float uScale;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uScale*500.0/max(0.15,-mv.z),1.0,48.0);}`,
        fragmentShader: `uniform vec3 uColor;uniform float uOpacity;void main(){float r=length(gl_PointCoord-0.5)*2.0;if(r>1.0)discard;float a=pow(1.0-r,2.2);gl_FragColor=vec4(uColor,a*uOpacity);}`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      materials.add(material);
      const mesh = new THREE.Points(geometry, material);
      mesh.frustumCulled = false;
      root.add(mesh);
      return {
        mesh,
        positions,
        geometry,
        count,
        refresh() {
          geometry.attributes.position.needsUpdate = true;
        },
      };
    };
    c.free = () => {
      scene.remove(root);
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    };
    return c;
  }

  function protego(c) {
    const shell = c.material('#4bc9f2', 0.09),
      rim = c.material('#abedff', 0.75),
      tracery = c.material('#68c5f5', 0.23);
    const dome = c.mesh(new THREE.SphereGeometry(1.85, 48, 24, 0, TAU, 0, Math.PI / 2), shell);
    dome.rotation.x = Math.PI / 2;
    const wire = c.mesh(
      new THREE.SphereGeometry(1.86, 28, 14, 0, TAU, 0, Math.PI / 2),
      c.material('#84d9ff', 0.12, { wireframe: true }),
    );
    wire.rotation.x = Math.PI / 2;
    const outer = c.ring(1.85, 0.025, rim),
      inner = c.ring(1.73, 0.009, tracery);
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16,
        x = Math.cos(a),
        y = Math.sin(a);
      c.segment([x * 1.74, y * 1.74, 0.01], [x * 1.85, y * 1.85, 0.01], 0.014, rim);
      c.ball([x * 1.85, y * 1.85, 0.01], 0.035, rim);
    }
    const dust = c.points(150, '#8ddfff', 0.07);
    c.animate = t => {
      const growth = 0.12 + smooth(t / 0.35) * 0.88;
      dome.scale.setScalar(growth);
      wire.scale.setScalar(growth);
      outer.scale.setScalar(growth);
      inner.scale.setScalar(growth);
      wire.rotation.z = t * 0.05;
      inner.rotation.z = -t * 0.1;
      for (let i = 0; i < dust.count; i++) {
        const a = i * 2.39996 + t * 0.2,
          b = (fract(i * 0.618 + t * 0.12) * Math.PI) / 2,
          r = 1.87;
        dust.positions.set(
          [Math.cos(a) * Math.sin(b) * r, Math.sin(a) * Math.sin(b) * r, Math.cos(b) * r],
          i * 3,
        );
      }
      dust.refresh();
    };
  }
  function leviosa(c) {
    const ivory = c.material('#e6f5ff', 0.88),
      edge = c.material('#d7bbfa', 0.65),
      feather = new THREE.Group();
    c.root.add(feather);
    c.tube(
      [
        [-0.2, -0.95, 0],
        [-0.08, -0.35, 0],
        [0.07, 0.3, 0],
        [0.28, 0.95, 0],
      ],
      0.014,
      ivory,
      feather,
    );
    for (let i = 0; i < 17; i++) {
      const u = i / 16,
        y = -0.7 + u * 1.5,
        x = -0.15 + u * 0.38,
        width = Math.sin(u * Math.PI) * 0.4;
      c.segment([x, y, 0], [x - width, y + 0.18, 0], 0.012, ivory, feather);
      c.segment([x, y, 0], [x + width * 0.8, y + 0.12, 0.015], 0.012, ivory, feather);
      const left = c.ball(
        [x - width * 0.46, y + 0.08, 0],
        [Math.max(0.02, width * 0.6), 0.055, 0.013],
        edge,
        feather,
      );
      left.rotation.z = 0.35;
      const right = c.ball(
        [x + width * 0.38, y + 0.06, 0.005],
        [Math.max(0.02, width * 0.45), 0.045, 0.012],
        ivory,
        feather,
      );
      right.rotation.z = -0.3;
    }
    const orbit = c.ring(0.68, 0.008, c.material('#b799ec', 0.28));
    orbit.rotation.x = Math.PI / 2;
    orbit.position.y = -0.85;
    const dust = c.points(100, '#c9b0ff', 0.055);
    c.animate = t => {
      feather.position.y = -0.3 + smooth(t / 0.75) * 0.6 + Math.sin(t * 1.9) * 0.15;
      feather.rotation.set(
        Math.sin(t * 0.7) * 0.16,
        Math.sin(t * 0.6) * 0.4,
        Math.sin(t * 0.9) * 0.18 - 0.17,
      );
      orbit.rotation.z = t * 0.3;
      orbit.position.y = -0.85 + Math.sin(t * 2) * 0.04;
      for (let i = 0; i < dust.count; i++) {
        const u = fract(i / dust.count + t * 0.17),
          a = i * 2.4 + t * 2,
          r = 0.5 * (1 - u) + 0.1;
        dust.positions.set([Math.cos(a) * r, -1.15 + u * 2.35, Math.sin(a) * r], i * 3);
      }
      dust.refresh();
    };
  }
  function patronus(c) {
    const silver = c.material('#ceefff', 0.48),
      white = c.material('#e9fbff', 0.9),
      halo = c.material('#66c3f7', 0.13),
      stag = new THREE.Group();
    stag.position.set(-0.15, -0.1, 0);
    c.root.add(stag);
    c.ball([-0.25, 0, 0], [0.83, 0.38, 0.26], silver, stag);
    c.ball([-0.25, 0, 0], [0.88, 0.43, 0.31], halo, stag);
    c.ball([0.4, 0.14, 0], [0.34, 0.46, 0.26], silver, stag);
    const neck = c.ball([0.62, 0.48, 0], [0.23, 0.55, 0.22], silver, stag);
    neck.rotation.z = -0.42;
    c.ball([0.87, 0.89, 0], [0.35, 0.21, 0.2], silver, stag);
    c.ball([1.16, 0.82, 0], [0.26, 0.12, 0.15], white, stag);
    for (const s of [-1, 1]) {
      const ear = c.ball([0.67, 1.12, s * 0.14], [0.11, 0.27, 0.065], silver, stag);
      ear.rotation.z = 0.5;
      c.ball([0.96, 0.94, s * 0.18], 0.035, white, stag);
    }
    c.tube(
      [
        [-1, 0, 0],
        [-1.22, -0.02, 0],
        [-1.35, 0.16, 0],
      ],
      0.05,
      silver,
      stag,
    );
    const legs = [];
    for (let i = 0; i < 4; i++) {
      const front = i < 2,
        x = front ? 0.25 : -0.78,
        z = (i % 2 ? 1 : -1) * 0.18,
        leg = new THREE.Group();
      leg.position.set(x, -0.18, z);
      stag.add(leg);
      c.segment([0, 0, 0], [front ? 0.06 : -0.1, -0.52, 0], 0.055, silver, leg);
      c.segment([front ? 0.06 : -0.1, -0.52, 0], [front ? -0.06 : 0.1, -1.05, 0.01], 0.035, white, leg);
      c.ball([front ? -0.06 : 0.1, -1.07, 0.02], [0.12, 0.065, 0.08], silver, leg);
      legs.push(leg);
    }
    for (const s of [-1, 1]) {
      const z = s * 0.15;
      c.tube(
        [
          [0.68, 1.03, z],
          [0.5, 1.4, z + s * 0.1],
          [0.33, 1.7, z + s * 0.12],
          [0.08, 1.95, z + s * 0.15],
        ],
        0.025,
        white,
        stag,
      );
      c.tube(
        [
          [0.51, 1.38, z + s * 0.09],
          [0.75, 1.62, z + s * 0.22],
          [0.83, 1.92, z + s * 0.24],
        ],
        0.022,
        white,
        stag,
      );
      c.tube(
        [
          [0.36, 1.67, z + s * 0.12],
          [0.48, 1.89, z + s * 0.13],
          [0.4, 2.13, z + s * 0.15],
        ],
        0.018,
        white,
        stag,
      );
      c.segment([0.19, 1.84, z + s * 0.15], [-0.08, 1.82, z + s * 0.18], 0.016, white, stag);
      c.segment([0.7, 1.59, z + s * 0.2], [0.9, 1.62, z + s * 0.27], 0.016, white, stag);
    }
    const dust = c.points(230, '#b6e9ff', 0.09),
      floor = c.ring(1.3, 0.009, c.material('#a6e0fb', 0.24));
    floor.rotation.x = Math.PI / 2;
    floor.position.y = -1.25;
    c.animate = t => {
      stag.position.y = -0.15 + Math.sin(t * 2) * 0.06;
      stag.rotation.y = Math.sin(t * 0.6) * 0.14;
      stag.scale.setScalar(0.65 + smooth(t / 0.7) * 0.28);
      legs.forEach(
        (leg, i) => (leg.rotation.z = Math.sin(t * 2.8 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.12),
      );
      for (let i = 0; i < dust.count; i++) {
        const u = fract(i / dust.count + t * 0.16),
          a = i * 2.4 + t * 0.7,
          r = 0.3 + u * 0.8;
        dust.positions.set([-1.1 - u * 1.4, Math.sin(a) * r - 0.1, Math.cos(a) * r * 0.45], i * 3);
      }
      dust.refresh();
      floor.rotation.z = t * 0.15;
    };
  }
  function aguamenti(c) {
    const water = c.material('#8fdcf5', 0.18),
      white = c.material('#d0f5ff', 0.55),
      arc = u => [0.7 - u * 1.4, -1.1 + Math.sin(u * Math.PI) * 2.25 - u * 0.22, 1.6 - u * 4.4],
      path = [];
    for (let i = 0; i <= 16; i++) path.push(arc(i / 16));
    const stream = c.tube(path, 0.045, water),
      core = c.tube(path, 0.013, white),
      drops = c.points(310, '#a5e8ff', 0.075),
      ripple = c.ring(0.7, 0.014, water);
    ripple.position.set(-0.7, -1.34, -2.8);
    ripple.rotation.x = Math.PI / 2;
    c.animate = t => {
      stream.visible = core.visible = t < c.duration - 0.4;
      ripple.scale.setScalar(0.6 + fract(t * 0.75) * 1.3);
      for (let i = 0; i < drops.count; i++) {
        if (i < 230) {
          const u = fract(i / 230 + t * 0.6),
            p = arc(u),
            a = i * 2.4 + t * 3,
            jitter = 0.025 + u * 0.07;
          drops.positions.set([p[0] + Math.sin(a) * jitter, p[1] + Math.cos(a) * jitter, p[2]], i * 3);
        } else {
          const u = fract((i - 230) / 80 + t * 1.1),
            a = i * 2.3999;
          drops.positions.set(
            [
              -0.7 + Math.cos(a) * u * 0.8,
              -1.34 + Math.sin(u * Math.PI) * 0.45,
              -2.8 + Math.sin(a) * u * 0.8,
            ],
            i * 3,
          );
        }
      }
      drops.refresh();
    };
  }
  function accio(c) {
    const gold = c.material('#f1cb83', 0.65),
      white = c.material('#ffedc6', 0.95),
      orb = new THREE.Group();
    c.root.add(orb);
    c.ball([0, 0, 0], 0.16, white, orb);
    c.ball([0, 0, 0], 0.32, c.material('#e7ae5a', 0.12), orb);
    const ring1 = c.ring(0.45, 0.012, gold, orb),
      ring2 = c.ring(0.5, 0.01, gold, orb);
    ring2.rotation.x = Math.PI / 2;
    const particles = c.points(220, '#f8d59c', 0.08);
    c.animate = t => {
      const pull = smooth(t / 2.6);
      orb.position.set(Math.sin(t) * 0.15, 0.1, -4.5 + pull * 6.8);
      orb.scale.setScalar(0.6 + pull * 0.6);
      ring1.rotation.y = t * 2;
      ring2.rotation.z = t * 2.3;
      for (let i = 0; i < particles.count; i++) {
        const u = fract(i / particles.count + t * 0.28),
          a = i * 2.4 + u * 7,
          r = (1 - u) * 2.4;
        particles.positions.set(
          [Math.cos(a) * r + orb.position.x, Math.sin(a) * r + orb.position.y, orb.position.z - (1 - u) * 5],
          i * 3,
        );
      }
      particles.refresh();
    };
  }
  function reparo(c) {
    const ceramic = c.material('#98c9d1', 0.8, { blending: THREE.NormalBlending }),
      gold = c.material('#e6c584', 0.85),
      shards = [],
      profile = [
        new THREE.Vector2(0.28, -0.85),
        new THREE.Vector2(0.48, -0.7),
        new THREE.Vector2(0.63, -0.25),
        new THREE.Vector2(0.53, 0.22),
        new THREE.Vector2(0.23, 0.58),
        new THREE.Vector2(0.27, 0.85),
      ];
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 8; i++) {
        const angle = (i * TAU) / 8,
          points = profile.slice(row === 0 ? 0 : row === 1 ? 2 : 4, row === 0 ? 3 : row === 1 ? 5 : 6),
          m = c.mesh(new THREE.LatheGeometry(points, 5, angle, TAU / 8 - 0.018), ceramic),
          initial = new THREE.Vector3(
            Math.sin(angle) * (0.8 + Math.random() * 0.5),
            (row - 1) * 0.7 + (Math.random() - 0.5) * 0.5,
            Math.cos(angle) * (0.6 + Math.random() * 0.3),
          ),
          rotation = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
          );
        shards.push({ m, initial, rotation });
      }
    const lip = c.ring(0.27, 0.025, gold);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.85;
    const base = c.ring(0.29, 0.02, gold);
    base.rotation.x = Math.PI / 2;
    base.position.y = -0.85;
    const band = c.ring(0.535, 0.012, gold);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.2;
    const dust = c.points(130, '#c6f1db', 0.055);
    c.animate = t => {
      const assembled = smooth((t - 0.35) / 2.1),
        left = 1 - assembled;
      for (const { m, initial, rotation } of shards) {
        m.position.copy(initial).multiplyScalar(left);
        m.rotation.set(rotation.x * left, rotation.y * left, rotation.z * left);
      }
      lip.visible = base.visible = band.visible = assembled > 0.94;
      for (let i = 0; i < dust.count; i++) {
        const u = fract(i / dust.count + t * 0.2),
          a = i * 2.4 + t,
          r = 0.8 + (1 - assembled) * 0.6;
        dust.positions.set(
          [Math.sin(a) * r * (1 - u * 0.4), -1.2 + u * 2.4, Math.cos(a) * r * (1 - u * 0.4)],
          i * 3,
        );
      }
      dust.refresh();
    };
  }
  function expelliarmus(c) {
    const red = c.material('#ff4b53', 0.65),
      hot = c.material('#ffd4c2', 0.9),
      bolt = new THREE.Group();
    c.root.add(bolt);
    c.ball([0, 0, 0], [0.1, 0.1, 0.25], hot, bolt);
    c.ball([0, 0, 0], [0.22, 0.22, 0.45], c.material('#ef2836', 0.18), bolt);
    for (let s = 0; s < 2; s++) {
      const p = [];
      for (let i = 0; i < 25; i++) {
        const u = i / 24,
          a = u * TAU * 2 + s * Math.PI;
        p.push([Math.sin(a) * 0.13, Math.cos(a) * 0.13, u * 2.7]);
      }
      c.tube(p, 0.019, red, bolt);
    }
    const sparks = c.points(240, '#ff6b62', 0.09),
      impact = c.ring(0.1, 0.016, c.material('#ff8272', 0.5));
    impact.position.z = -10;
    c.animate = t => {
      bolt.position.set(0.15 * Math.sin(t * 8), 0.08 * Math.cos(t * 8), 3 - t * 10);
      bolt.rotation.z = t * 10;
      bolt.visible = t < 1.5;
      const hit = Math.max(0, t - 1.25);
      impact.visible = hit > 0;
      impact.scale.setScalar(1 + hit * 13);
      for (let i = 0; i < sparks.count; i++) {
        const a = i * 2.4,
          delay = ((i % 60) / 60) * 0.65,
          u = Math.max(0, t - delay);
        if (t < 1.5) {
          const r = 0.04 + u * 0.18;
          sparks.positions.set([Math.sin(a + u * 14) * r, Math.cos(a + u * 14) * r, 3 - u * 10], i * 3);
        } else {
          const r = hit * (0.5 + (i % 7) * 0.25);
          sparks.positions.set([Math.sin(a) * r, Math.cos(a) * r, -10 + Math.sin(i * 0.7) * r], i * 3);
        }
      }
      sparks.refresh();
    };
  }
  function lumos(c) {
    const white = c.material('#fff6d7', 0.9),
      gold = c.material('#ffe1a0', 0.35),
      core = c.ball([0, 0, 0], 0.12, white),
      halo = c.ball([0, 0, 0], 0.35, c.material('#ffe9bc', 0.08)),
      ring1 = c.ring(0.25, 0.014, gold),
      ring2 = c.ring(0.22, 0.008, white);
    ring2.rotation.y = 0.8;
    const dust = c.points(80, '#fff1cf', 0.06);
    c.animate = t => {
      ring1.scale.setScalar(1 + t * 3.5);
      ring2.scale.setScalar(1 + t * 2.6);
      ring1.rotation.z = t;
      halo.scale.setScalar(0.35 + t * 0.2);
      core.scale.setScalar(Math.max(0.02, 0.12 * (1 - t / c.duration)));
      for (let i = 0; i < dust.count; i++) {
        const a = i * 2.4,
          b = i * 0.37,
          r = 0.1 + t * (0.25 + (i % 7) * 0.1);
        dust.positions.set(
          [Math.cos(a) * Math.sin(b) * r, Math.sin(a) * Math.sin(b) * r, Math.cos(b) * r],
          i * 3,
        );
      }
      dust.refresh();
    };
  }
  const builders = { lumos, leviosa, reparo, accio, protego, expelliarmus, patronus, aguamenti },
    durations = {
      lumos: 1.35,
      leviosa: 4.6,
      reparo: 5.2,
      accio: 3.4,
      protego: 4.6,
      expelliarmus: 2.5,
      patronus: 5.6,
      aguamenti: 4.4,
    };
  function cast(spell, isInterior = false) {
    let id = String(typeof spell === 'string' ? spell : spell?.id || spell?.name || 'lumos').toLowerCase();
    if (id.includes('wingardium')) id = 'leviosa';
    if (id.includes('expecto')) id = 'patronus';
    if (!builders[id]) id = 'lumos';
    while (effects.length >= 5) effects.shift().free();
    const e = context(id, isInterior, durations[id]);
    builders[id](e);
    e.animate(0);
    effects.push(e);
    return e;
  }
  function update(dt, time) {
    const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.age += step;
      if (e.age >= e.duration) {
        e.free();
        effects.splice(i, 1);
        continue;
      }
      e.animate(e.age, step, time);
      const fade = smooth(e.age / 0.14) * smooth((e.duration - e.age) / 0.7);
      for (const m of e.materials) {
        if (m.isShaderMaterial) m.uniforms.uOpacity.value = fade;
        else m.opacity = (m.userData.magicOpacity ?? 1) * fade;
      }
    }
    return effects;
  }
  function clear() {
    effects.splice(0).forEach(e => e.free());
  }
  return { cast, update, clear };
}
