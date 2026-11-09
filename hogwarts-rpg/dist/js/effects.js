import * as T from "../assets/three.module.js";
export function createEffects(scene, blocked = () => null) {
  const active = [],
    bullets = [],
    v = new T.Vector3();
  const sphere = new T.SphereGeometry(1, 8, 6);
  let glow;
  {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d"),
      g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.13, "#fff");
    g.addColorStop(0.35, "#ffffff90");
    g.addColorStop(1, "#ffffff00");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glow = new T.CanvasTexture(c);
  }
  function sparks(position, color, count = 50, force = 3) {
    const data = new Float32Array(count * 3),
      vel = [];
    for (let i = 0; i < count; i++) {
      data.set([position.x, position.y, position.z], i * 3);
      vel.push(new T.Vector3((Math.random() - 0.5) * force, Math.random() * force, (Math.random() - 0.5) * force));
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(data, 3));
    const mat = new T.PointsMaterial({ color, size: 0.18, map: glow, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const mesh = new T.Points(g, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    active.push({
      age: 0,
      duration: 1.1,
      mesh,
      update(dt, t) {
        for (let i = 0; i < count; i++) {
          vel[i].y -= dt * 2;
          data[i * 3] += vel[i].x * dt;
          data[i * 3 + 1] += vel[i].y * dt;
          data[i * 3 + 2] += vel[i].z * dt;
        }
        g.attributes.position.needsUpdate = true;
        mat.opacity = 1 - t / 1.1;
      },
    });
  }
  function ring(position, color, radius = 2, duration = 0.7) {
    const mesh = new T.Mesh(
      new T.TorusGeometry(1, 0.025, 6, 60),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending }),
    );
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    active.push({
      age: 0,
      duration,
      mesh,
      update(dt, t) {
        mesh.scale.setScalar(0.1 + (t / duration) * radius);
        mesh.material.opacity = 1 - t / duration;
      },
    });
  }
  function shield(target, duration = 2.6) {
    const mesh = new T.Mesh(
      new T.IcosahedronGeometry(1.3, 2),
      new T.MeshBasicMaterial({
        color: "#8fe6ff",
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    scene.add(mesh);
    active.push({
      age: 0,
      duration,
      mesh,
      update(dt, t) {
        mesh.position.copy(target).y += 1.15;
        mesh.rotation.y = t * 0.3;
        mesh.material.opacity = Math.min(0.38, (duration - t) * 0.5);
      },
    });
    ring(target.clone().add(new T.Vector3(0, 0.08, 0)), "#9ae6ff", 2.5, 0.8);
  }
  function projectile(from, to, { color = "#ffd392", hostile = false, damage = 20, onHit, fast = false, targetTest = null, speed = 0, playerTest = true } = {}) {
    if (bullets.length > 30) return;
    const root = new T.Group(),
      core = new T.Mesh(sphere, new T.MeshBasicMaterial({ color }));
    core.scale.setScalar(0.09);
    root.add(core);
    const halo = new T.Sprite(
      new T.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending }),
    );
    halo.scale.set(0.65, 0.65, 1);
    root.add(halo);
    root.position.copy(from);
    const trailGeo = new T.BufferGeometry(),
      positions = new Float32Array(45);
    for (let i = 0; i < 15; i++) positions.set(from.toArray(), i * 3);
    trailGeo.setAttribute("position", new T.BufferAttribute(positions, 3));
    const trail = new T.Points(
      trailGeo,
      new T.PointsMaterial({
        color,
        map: glow,
        size: 0.22,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    trail.frustumCulled = false;
    scene.add(root, trail);
    bullets.push({
      root,
      trail,
      positions,
      direction: to.clone().sub(from).normalize(),
      destination: to.clone(),
      speed: speed || (hostile ? 9 : fast ? 55 : 35),
      hostile,
      damage,
      onHit,
      targetTest,
      playerTest,
      age: 0,
    });
  }
  function freeEffect(e) {
    scene.remove(e.mesh);
    e.mesh.geometry?.dispose();
    e.mesh.material?.dispose();
  }
  function freeBullet(b) {
    scene.remove(b.root, b.trail);
    b.root.children.forEach((m) => m.material.dispose());
    b.trail.geometry.dispose();
    b.trail.material.dispose();
  }
  function update(dt, player, onDamage) {
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      e.age += dt;
      if (e.age >= e.duration) {
        freeEffect(e);
        active.splice(i, 1);
      } else e.update(dt, e.age);
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.age += dt;
      const step = b.speed * dt,
        remain = b.root.position.distanceTo(b.destination);
      const prev = b.root.position.clone();
      b.root.position.addScaledVector(b.direction, Math.min(step, remain));
      const obstruction = blocked(prev, b.root.position);
      if (obstruction) b.root.position.set(obstruction.x, obstruction.y, obstruction.z);
      b.positions.copyWithin(3, 0, 42);
      b.positions.set(b.root.position.toArray(), 0);
      b.trail.geometry.attributes.position.needsUpdate = true;
      const hit = b.hostile && b.playerTest && b.root.position.distanceTo(v.copy(player).add(new T.Vector3(0, 1, 0))) < 0.85;
      if (!obstruction && b.targetTest && b.targetTest(b.root.position)) {
        b.onHit?.(b.root.position.clone());
        sparks(b.root.position, "#f3c987", 30, 2.5);
        freeBullet(b);
        bullets.splice(i, 1);
        continue;
      }
      if (obstruction || hit || remain < step + 0.1 || b.age > 5) {
        if (hit && !obstruction) onDamage(b.damage, b.direction.clone());
        if (!obstruction && !b.hostile && remain < step + 0.1) b.onHit?.();
        sparks(b.root.position, b.hostile ? "#ba89fa" : "#f3c987", 22, 2);
        freeBullet(b);
        bullets.splice(i, 1);
      }
    }
  }
  function clear() {
    active.splice(0).forEach(freeEffect);
    bullets.splice(0).forEach(freeBullet);
  }
  // Earliest friendly bolt that will pass within `radius` of `pos` in the next `horizon` seconds.
  function incoming(pos, radius = 1, horizon = 0.9, hostile = false) {
    let best = null;
    for (const b of bullets) {
      if (b.hostile !== hostile) continue;
      const rel = v.copy(pos).sub(b.root.position),
        along = rel.dot(b.direction);
      if (along < 0) continue;
      const eta = along / b.speed;
      if (eta > horizon) continue;
      const miss = Math.sqrt(Math.max(0, rel.lengthSq() - along * along));
      if (miss < radius && (!best || eta < best.eta)) best = { eta, dir: b.direction.clone() };
    }
    return best;
  }
  return { sparks, ring, shield, projectile, update, clear, incoming };
}
export function createAudio() {
  let context,
    enabled = false,
    ambient,
    noiseBuffer;
  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.5), context.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }
  function init() {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    context.resume();
  }
  function note(f = 220, t = 0.16, type = "sine", volume = 0.04) {
    if (!enabled || !context) return;
    const o = context.createOscillator(),
      g = context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, context.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(35, f * 0.52), context.currentTime + t);
    g.gain.setValueAtTime(volume, context.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + t);
    o.connect(g);
    g.connect(context.destination);
    o.start();
    o.stop(context.currentTime + t);
  }
  return {
    toggle() {
      enabled = !enabled;
      if (enabled) {
        init();
        ambient = context.createOscillator();
        const gain = context.createGain();
        ambient.frequency.value = 73.42;
        gain.gain.value = 0.006;
        ambient.connect(gain);
        gain.connect(context.destination);
        ambient.start();
      } else {
        ambient?.stop();
        ambient = null;
      }
      return enabled;
    },
    note,
    step() {
      note(75, 0.06, "triangle", 0.014);
    },
    // Procedural footsteps: filtered noise for the surface plus a soft body thump.
    footstep(surface = "stone", speed = 1.25, pos = null, camera = null) {
      if (!enabled || !context) return;
      let vol = 0.05 * Math.min(1.6, 0.55 + speed / 4),
        pan = 0;
      if (pos && camera) {
        const dx = pos.x - camera.position.x,
          dy = pos.y - camera.position.y,
          dz = pos.z - camera.position.z,
          d = Math.hypot(dx, dy, dz);
        if (d > 14) return;
        vol *= Math.max(0, 1 - d / 14) ** 1.5;
        const m = camera.matrixWorld.elements;
        pan = Math.max(-1, Math.min(1, (dx * m[0] + dy * m[1] + dz * m[2]) / Math.max(1, d))) * 0.8;
      }
      const t = context.currentTime,
        out = context.createStereoPanner();
      out.pan.value = pan;
      out.connect(context.destination);
      const src = context.createBufferSource();
      src.buffer = noise();
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = context.createBiquadFilter(),
        g = context.createGain();
      let dur = 0.06;
      if (surface === "grass") {
        f.type = "highpass";
        f.frequency.value = 1300 + Math.random() * 600;
        dur = 0.15;
        vol *= 0.75;
      } else if (surface === "wood") {
        f.type = "bandpass";
        f.frequency.value = 380 + Math.random() * 140;
        f.Q.value = 3.2;
        dur = 0.1;
        vol *= 1.5;
      } else {
        f.type = "bandpass";
        f.frequency.value = 2300 + Math.random() * 700;
        f.Q.value = 1.1;
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random() * 0.2);
      src.stop(t + dur + 0.03);
      const o = context.createOscillator(),
        og = context.createGain();
      o.frequency.setValueAtTime(surface === "wood" ? 150 : surface === "grass" ? 85 : 110, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.08);
      og.gain.setValueAtTime(vol * 0.9, t);
      og.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
      o.connect(og).connect(out);
      o.start(t);
      o.stop(t + 0.1);
    },
    swish() {
      if (!enabled || !context) return;
      const t = context.currentTime,
        src = context.createBufferSource(),
        f = context.createBiquadFilter(),
        g = context.createGain();
      src.buffer = noise();
      f.type = "bandpass";
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(2200, t + 0.22);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
      src.connect(f).connect(g).connect(context.destination);
      src.start(t);
      src.stop(t + 0.32);
    },
    get enabled() {
      return enabled;
    },
  };
}
