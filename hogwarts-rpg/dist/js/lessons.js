import * as T from "../assets/three.module.js";
import { PATTERNS, resample, scoreStroke, traceEase } from "./gestures.js";
export { PATTERNS, SPELL_PATTERN, scoreStroke } from "./gestures.js";

// Spell lessons. A professor demonstrates a wand movement (the real gesture animation plus a glowing
// trail), the pattern is traced on a practice card, and then you draw it yourself with the mouse
// or a finger. The drawing is resampled, normalised and compared point by point with the pattern.

// ---------------------------------------------------------------- light painting: a ribbon behind the wand tip, with sparks
function createTrail(scene, camera) {
  const SEG = 96,
    LIFE = 1.5,
    WIDTH = 0.045;
  const pos = new Float32Array(SEG * 2 * 3),
    fade = new Float32Array(SEG * 2),
    across = new Float32Array(SEG * 2);
  for (let i = 0; i < SEG; i++) {
    across[i * 2] = -1;
    across[i * 2 + 1] = 1;
  }
  const index = [];
  for (let i = 0; i < SEG - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("fade", new T.BufferAttribute(fade, 1));
  geo.setAttribute("across", new T.BufferAttribute(across, 1));
  geo.setIndex(index);
  const ribbonMat = new T.ShaderMaterial({
    uniforms: { color: { value: new T.Color() } },
    vertexShader: `attribute float fade;attribute float across;varying float vF;varying float vA;
void main(){vF=fade;vA=across;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 color;varying float vF;varying float vA;
void main(){float e=1.-abs(vA);float core=pow(e,4.);float a=vF*(e*e*.6+core*1.6);if(a<.003)discard;gl_FragColor=vec4(mix(color,vec3(1.),core*.65)*a,1.);}`,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
  });
  const ribbon = new T.Mesh(geo, ribbonMat);
  ribbon.frustumCulled = false;
  ribbon.renderOrder = 6;
  ribbon.userData.skipAO = true;
  // sparks shed by the tip, and bursts on success
  const SP = 220;
  const spPos = new Float32Array(SP * 3),
    spLife = new Float32Array(SP),
    spVel = new Float32Array(SP * 3),
    spCol = new Float32Array(SP * 3);
  const spGeo = new T.BufferGeometry();
  spGeo.setAttribute("position", new T.BufferAttribute(spPos, 3));
  spGeo.setAttribute("life", new T.BufferAttribute(spLife, 1));
  spGeo.setAttribute("tint", new T.BufferAttribute(spCol, 3));
  const spMat = new T.ShaderMaterial({
    uniforms: { scale: { value: 400 } },
    vertexShader: `attribute float life;attribute vec3 tint;varying float vL;varying vec3 vC;uniform float scale;
void main(){vL=life;vC=tint;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=scale*.028*(.35+life)/max(.2,-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float vL;varying vec3 vC;
void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r),2.)*vL;if(a<.01)discard;gl_FragColor=vec4(mix(vC,vec3(1.),.45)*a*1.4,1.);}`,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const sparks = new T.Points(spGeo, spMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 7;
  sparks.userData.skipAO = true;
  const group = new T.Group();
  group.add(ribbon, sparks);
  scene.add(group);
  const samples = [],
    base = new T.Color(),
    tmp = new T.Vector3(),
    tan = new T.Vector3(),
    view = new T.Vector3(),
    nrm = new T.Vector3();
  let actor = null,
    fadeAll = 0,
    nextSpark = 0,
    cursor = 0;
  function spark(p, color, speed = 0.6, life = 1) {
    const i = cursor++ % SP;
    spPos.set([p.x, p.y, p.z], i * 3);
    const a = Math.random() * Math.PI * 2,
      b = Math.acos(2 * Math.random() - 1),
      v = speed * (0.3 + Math.random());
    spVel.set([Math.sin(b) * Math.cos(a) * v, Math.cos(b) * v * 0.6 + 0.15, Math.sin(b) * Math.sin(a) * v], i * 3);
    spLife[i] = life * (0.6 + Math.random() * 0.4);
    const c = new T.Color(color);
    spCol.set([c.r, c.g, c.b], i * 3);
  }
  return {
    follow(a, color = "#ffd98a") {
      actor = a;
      base.set(color);
      ribbonMat.uniforms.color.value.copy(base);
      samples.length = 0;
      fadeAll = 1;
    },
    stop() {
      actor = null;
    },
    burst(p, color = "#cfe8ff", n = 60) {
      for (let k = 0; k < n; k++) spark(p, color, 1.5, 1.2);
    },
    fizzle(p) {
      for (let k = 0; k < 26; k++) spark(p, "#8a8f96", 0.35, 0.9);
    },
    update(dt) {
      if (actor) {
        actor.tipWorld(tmp);
        const last = samples[samples.length - 1];
        if (!last || last.p.distanceToSquared(tmp) > 1e-6) samples.push({ p: tmp.clone(), age: 0 });
        nextSpark -= dt;
        if (nextSpark <= 0) {
          nextSpark = 0.016;
          spark(tmp, "#" + base.getHexString(), 0.25, 0.8);
        }
      } else fadeAll = Math.max(0, fadeAll - dt * 1.2);
      for (const s of samples) s.age += dt;
      while (samples.length && samples[0].age > LIFE) samples.shift();
      while (samples.length > 160) samples.shift();
      // ribbon: smooth the samples and face it to the camera
      const n = samples.length;
      ribbon.visible = n > 2 && fadeAll > 0.01;
      if (ribbon.visible) {
        const pts = n >= 4 ? new T.CatmullRomCurve3(samples.map((s) => s.p), false, "centripetal").getPoints(SEG - 1) : null;
        for (let i = 0; i < SEG; i++) {
          const u = i / (SEG - 1),
            si = Math.min(n - 1, Math.round(u * (n - 1))),
            p = pts ? pts[i] : samples[si].p;
          const prev = pts ? pts[Math.max(0, i - 1)] : samples[Math.max(0, si - 1)].p,
            next = pts ? pts[Math.min(SEG - 1, i + 1)] : samples[Math.min(n - 1, si + 1)].p;
          tan.subVectors(next, prev);
          if (tan.lengthSq() < 1e-10) tan.set(0, 1, 0);
          view.subVectors(camera.position, p);
          nrm.crossVectors(tan, view).normalize();
          const age = samples[si].age / LIFE,
            w = WIDTH * (0.25 + 0.75 * u) * (1 - age * 0.6);
          pos.set([p.x + nrm.x * w, p.y + nrm.y * w, p.z + nrm.z * w, p.x - nrm.x * w, p.y - nrm.y * w, p.z - nrm.z * w], i * 6);
          const f = Math.max(0, 1 - age) * fadeAll * (0.2 + 0.8 * u);
          fade[i * 2] = fade[i * 2 + 1] = f;
        }
        geo.attributes.position.needsUpdate = geo.attributes.fade.needsUpdate = true;
      }
      // sparks drift, fall a little and fade
      let alive = 0;
      for (let i = 0; i < SP; i++) {
        if (spLife[i] <= 0) continue;
        alive++;
        spLife[i] -= dt * 1.3;
        spVel[i * 3 + 1] -= dt * 0.7;
        for (let k = 0; k < 3; k++) {
          spVel[i * 3 + k] *= 1 - dt * 1.8;
          spPos[i * 3 + k] += spVel[i * 3 + k] * dt;
        }
      }
      sparks.visible = alive > 0;
      if (alive) spGeo.attributes.position.needsUpdate = spGeo.attributes.life.needsUpdate = spGeo.attributes.tint.needsUpdate = true;
      spMat.uniforms.scale.value = (typeof innerHeight === "number" ? innerHeight : 720) * 0.5;
    },
    dispose() {
      scene.remove(group);
      geo.dispose();
      ribbonMat.dispose();
      spGeo.dispose();
      spMat.dispose();
    },
  };
}

// ---------------------------------------------------------------- the practice card
function createCard() {
  const el = document.createElement("section");
  el.id = "lesson";
  el.hidden = true;
  el.setAttribute("aria-label", "Lekcja zaklęć");
  el.innerHTML = `<div class="lesson-head"><span class="eyebrow" id="lesson-kicker">LEKCJA</span><h2 id="lesson-title"></h2><p id="lesson-pattern"></p></div>
<div class="lesson-board"><canvas id="lesson-canvas" width="440" height="440" aria-label="Pole do rysowania ruchu różdżki"></canvas><div id="lesson-score" aria-live="polite"></div></div>
<p id="lesson-status"></p><div class="lesson-pips" id="lesson-pips"></div>
<div class="lesson-actions"><button id="lesson-again">Pokaż ponownie</button><button id="lesson-end">Zakończ lekcję</button></div>`;
  document.body.append(el);
  return el;
}

export function createLessons({ scene, audio, camera }) {
  const card = createCard();
  const canvas = card.querySelector("#lesson-canvas"),
    ctx = canvas.getContext("2d");
  const $ = (s) => card.querySelector(s);
  const trail = createTrail(scene, camera);
  let run = null; // the lesson in progress
  const PAD = 56,
    SIZE = 440;
  const toCard = ([x, y], P) => {
    // fit the pattern box into the card, keeping proportions
    const xs = P.pts.map((p) => p[0]),
      ys = P.pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs),
      h = Math.max(...ys) - Math.min(...ys),
      s = (SIZE - PAD * 2) / Math.max(w, h, 0.001);
    const ox = (SIZE - w * s) / 2 - Math.min(...xs) * s,
      oy = (SIZE - h * s) / 2 - Math.min(...ys) * s;
    return [ox + x * s, oy + y * s];
  };
  function board() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // faint guide circle and grid of the practice parchment
    ctx.strokeStyle = "#c9b17c1f";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((SIZE * i) / 4, 18);
      ctx.lineTo((SIZE * i) / 4, SIZE - 18);
      ctx.moveTo(18, (SIZE * i) / 4);
      ctx.lineTo(SIZE - 18, (SIZE * i) / 4);
      ctx.stroke();
    }
  }
  function drawPattern(P, upto = 1, style = "demo") {
    const pts = resample(P.pts, 120).map((p) => toCard(p, P));
    const n = Math.max(2, Math.round(pts.length * upto));
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    if (style === "ghost") {
      ctx.setLineDash([3, 11]);
      ctx.strokeStyle = "#e8d3a07a";
      ctx.lineWidth = 6;
    } else {
      ctx.shadowColor = "#ffcf7a";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#ffe2a6";
      ctx.lineWidth = 7;
    }
    ctx.beginPath();
    pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
    // start marker and the moving spark
    const [sx, sy] = pts[0];
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#86d39a";
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
    if (style === "demo") {
      const [hx, hy] = pts[n - 1];
      ctx.shadowColor = "#fff2c8";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#fffbe8";
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // arrow head at the end
      const [ex, ey] = pts[pts.length - 1],
        [px, py] = pts[pts.length - 6];
      const a = Math.atan2(ey - py, ex - px);
      ctx.fillStyle = "#e8d3a0aa";
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 12, ey + Math.sin(a) * 12);
      ctx.lineTo(ex + Math.cos(a + 2.5) * 12, ey + Math.sin(a + 2.5) * 12);
      ctx.lineTo(ex + Math.cos(a - 2.5) * 12, ey + Math.sin(a - 2.5) * 12);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawStroke(stroke, color = "#bfe3ff") {
    if (stroke.length < 2) return;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    stroke.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }
  const status = (text) => ($("#lesson-status").textContent = text);
  const pips = () => {
    if (!run) return;
    $("#lesson-pips").innerHTML = Array.from({ length: run.needed }, (_, i) => `<span class="${i < run.successes ? "on" : ""}"></span>`).join("") + `<small>${run.successes} / ${run.needed} udanych prób</small>`;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- drawing input
  // a stroke may start a moment before the slate is ready again; it is kept and used then
  let stroke = null,
    resolveStroke = null,
    pendingStroke = null;
  const point = (e) => {
    const b = canvas.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * SIZE, ((e.clientY - b.top) / b.height) * SIZE];
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (!run || run.busy) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    stroke = [point(e)];
    pendingStroke = null;
    // your character draws the same stroke in the air, live
    if (run.player.traceLive) {
      // seen from the front, the character draws the stroke mirrored, so it reads like the slate
      run.player.traceLive(true, { mirror: true });
      run.player.setTraceTarget(stroke[0][0] / SIZE, stroke[0][1] / SIZE);
      run.trailAt = performance.now() + 200;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!stroke) return;
    const p = point(e),
      last = stroke[stroke.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
    stroke.push(p);
    run?.player.setTraceTarget?.(p[0] / SIZE, p[1] / SIZE);
    if (run?.trailAt && performance.now() >= run.trailAt) {
      run.trailAt = 0;
      trail.follow(run.player, "#bfe3ff");
    }
    board();
    if (run?.ghost) drawPattern(run.P, 1, "ghost");
    drawStroke(stroke);
  });
  const finishStroke = (e) => {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    run?.player.traceLive?.(false);
    trail.stop();
    if (e.pointerId !== undefined && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (resolveStroke) {
      const r = resolveStroke;
      resolveStroke = null;
      r(s);
    } else pendingStroke = s;
  };
  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);
  const capture = () =>
    new Promise((r) => {
      if (pendingStroke) {
        const s = pendingStroke;
        pendingStroke = null;
        r(s);
      } else resolveStroke = r;
    });

  // ---- one demonstration by the teacher
  async function demonstrate() {
    const L = run;
    if (!L) return;
    L.busy = true;
    stroke = pendingStroke = null;
    $("#lesson-again").disabled = true;
    $("#lesson-score").textContent = "";
    $("#lesson-score").className = "";
    L.shot?.("teacher");
    status("Patrz uważnie na ruch różdżki profesora.");
    const secs = (L.demoSeconds || 2.2) * (L.demoSpeed ? 0.55 / L.demoSpeed : 1),
      pre = 300;
    const path = resample(L.P.pts, 72);
    let ms;
    if (L.teacher.trace) ms = L.teacher.trace(path, secs, { mirror: true }) * 1000;
    else ms = Math.max(1200, (L.teacher.cast(L.P.clip, 0.55)?.duration || 2) * 1000);
    audio?.note?.(660, 0.5, "sine", 0.025);
    const t0 = performance.now();
    let lit = false;
    await new Promise((done) => {
      const tick = () => {
        if (run !== L) return done();
        const el = performance.now() - t0;
        if (!lit && el >= pre) {
          lit = true;
          trail.follow(L.teacher, "#ffd98a");
        }
        const u = L.teacher.trace ? traceEase(Math.min(1, Math.max(0, (el - pre) / (secs * 1000)))) : Math.min(1, el / ms);
        board();
        drawPattern(L.P, 0.03 + u * 0.97, "demo");
        if (el < ms + 120) requestAnimationFrame(tick);
        else done();
      };
      tick();
    });
    trail.stop();
    if (L.P.clip === "protego") L.teacher.releaseShield?.();
    await wait(450);
    if (run !== L) return;
    L.busy = false;
    $("#lesson-again").disabled = false;
  }
  async function attempt() {
    const L = run;
    if (!L) return null;
    L.shot?.("player");
    if (!stroke) {
      board();
      if (L.ghost) drawPattern(L.P, 1, "ghost");
    }
    status(L.attempts ? "Jeszcze raz. Narysuj ruch jednym pociągnięciem." : "Twoja kolej: narysuj ten ruch myszą lub palcem, jednym pociągnięciem.");
    const s = await capture();
    if (run !== L || !s) return null;
    L.attempts++;
    const r = scoreStroke(s, L.patternId);
    const ok = r.score >= L.threshold;
    const pct = Math.round(r.score * 100);
    board();
    if (L.ghost) drawPattern(L.P, 1, "ghost");
    drawStroke(s, ok ? "#a8f0b8" : "#ffb3a1");
    const el = $("#lesson-score");
    el.textContent = pct + "%";
    el.className = ok ? "good" : "bad";
    L.best = Math.max(L.best, r.score);
    if (ok) {
      L.successes++;
      pips();
      const tipPos = L.player.tipWorld ? L.player.tipWorld(new T.Vector3()) : null;
      if (tipPos) trail.burst(tipPos, "#d8ecff", 70);
      else L.player.cast(L.P.clip, 1);
      audio?.note?.(880 + L.successes * 110, 0.35, "sine", 0.04);
      L.react?.(true, r);
      status(pct >= 88 ? "Wzorowo! Ruch czysty i pewny." : pct >= 75 ? "Bardzo dobrze. Różdżka słucha ręki." : "Zaliczone. Następnym razem płynniej.");
    } else {
      audio?.note?.(180, 0.3, "triangle", 0.03);
      if (L.player.tipWorld) trail.fizzle(L.player.tipWorld(new T.Vector3()));
      L.react?.(false, r);
      status(r.tooShort ? "Za krótko. Wykonaj pełny, wyraźny ruch na całej karcie." : r.reversed ? "Kształt dobry, ale ruch idzie w przeciwną stronę. Zacznij od zielonego punktu." : pct > 45 ? "Blisko. " + L.P.hint : "To jeszcze nie ten ruch. " + L.P.hint);
    }
    await wait(1250);
    return ok;
  }
  async function loop() {
    const L = run;
    await demonstrate();
    while (run === L && L.successes < L.needed && L.attempts < L.maxAttempts) {
      if (L.busy) await wait(200);
      const ok = await attempt();
      if (ok === null) return;
      // after two misses in a row the professor shows the movement once more
      L.misses = ok ? 0 : (L.misses || 0) + 1;
      if (L.misses === 2 && run === L && L.successes < L.needed) {
        L.misses = 0;
        await demonstrate();
      }
    }
    if (run !== L) return;
    const passed = L.successes >= L.needed;
    finish({ passed, attempts: L.attempts, successes: L.successes, best: L.best });
  }
  function finish(result) {
    const L = run;
    run = null;
    card.hidden = true;
    document.body.classList.remove("lesson-on");
    trail.stop();
    resolveStroke?.(null);
    resolveStroke = null;
    stroke = pendingStroke = null;
    L?.onDone?.(result);
  }
  $("#lesson-again").onclick = async () => {
    if (!run || run.busy) return;
    const r = resolveStroke;
    resolveStroke = null;
    run.redo = true;
    await demonstrate();
    if (r) {
      resolveStroke = r;
      board();
      if (run?.ghost) drawPattern(run.P, 1, "ghost");
      status("Twoja kolej: narysuj ten ruch.");
      run?.shot?.("player");
    }
  };
  $("#lesson-end").onclick = () => run && finish({ passed: false, cancelled: true, by: "button", attempts: run.attempts, successes: run.successes, best: run.best });

  return {
    get active() {
      return !!run;
    },
    // opts: {teacher, player, patternId, title, kicker, needed, threshold, ghost, shot(who), react(ok,result), onDone(result)}
    start(opts) {
      if (run) finish({ passed: false, cancelled: true, by: "restart" });
      const P = PATTERNS[opts.patternId];
      run = { ...opts, P, needed: opts.needed || 3, threshold: opts.threshold || 0.62, maxAttempts: opts.maxAttempts || 8, successes: 0, attempts: 0, best: 0, ghost: opts.ghost !== false };
      $("#lesson-kicker").textContent = opts.kicker || "LEKCJA";
      $("#lesson-title").textContent = opts.title;
      $("#lesson-pattern").textContent = "Ruch: " + P.name + " · " + P.hint;
      card.hidden = false;
      document.body.classList.add("lesson-on");
      board();
      pips();
      loop();
    },
    cancel() {
      if (run) finish({ passed: false, cancelled: true, by: "close", attempts: run.attempts, successes: run.successes, best: run.best });
    },
    update(dt) {
      trail.update(dt);
    },
    // test hook: feed a stroke as if drawn on the card
    _draw(points) {
      if (!run) return false;
      run.player.traceLive?.(false);
      const r = resolveStroke;
      resolveStroke = null;
      if (r) r(points);
      else pendingStroke = points;
      return true;
    },
    _pattern(id, scale = 300, jitter = 0) {
      const P = PATTERNS[id];
      return resample(P.pts, 60).map(([x, y]) => [70 + x * scale + (Math.random() - 0.5) * jitter, 70 + y * scale + (Math.random() - 0.5) * jitter]);
    },
  };
}
