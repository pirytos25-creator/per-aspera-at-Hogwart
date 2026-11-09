import * as T from "../assets/three.module.js";
import { PATTERNS, resample, scoreStroke } from "./gestures.js";
export { PATTERNS, SPELL_PATTERN, scoreStroke } from "./gestures.js";

// Spell lessons. A professor demonstrates a wand movement (the real gesture animation plus a glowing
// trail), the pattern is traced on a practice card, and then you draw it yourself with the mouse
// or a finger. The drawing is resampled, normalised and compared point by point with the pattern.

// ---------------------------------------------------------------- the glowing trail behind a wand tip
function createTrail(scene) {
  const MAX = 90;
  const pos = new Float32Array(MAX * 3),
    col = new Float32Array(MAX * 3);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("color", new T.BufferAttribute(col, 3));
  const line = new T.Line(geo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  line.frustumCulled = pts.frustumCulled = false;
  line.renderOrder = pts.renderOrder = 5;
  const group = new T.Group();
  group.add(line, pts);
  group.visible = false;
  scene.add(group);
  const samples = [],
    base = new T.Color();
  let actor = null,
    fade = 0,
    tmp = new T.Vector3();
  return {
    follow(a, color = "#ffd98a") {
      actor = a;
      base.set(color);
      samples.length = 0;
      fade = 1;
      group.visible = true;
    },
    stop() {
      actor = null;
    },
    update(dt) {
      if (actor) {
        actor.tipWorld(tmp);
        samples.push({ p: tmp.clone(), age: 0 });
        if (samples.length > MAX) samples.shift();
      } else fade = Math.max(0, fade - dt * 1.6);
      for (const s of samples) s.age += dt;
      while (samples.length && samples[0].age > 1.6) samples.shift();
      const n = samples.length;
      for (let i = 0; i < MAX; i++) {
        const s = samples[Math.min(i, n - 1)];
        if (!s) break;
        pos.set([s.p.x, s.p.y, s.p.z], i * 3);
        const k = Math.max(0, 1 - s.age / 1.6) * fade * (i < n ? 1 : 0);
        col.set([base.r * k, base.g * k, base.b * k], i * 3);
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
      group.visible = n > 1 && fade > 0.01;
    },
    dispose() {
      scene.remove(group);
      geo.dispose();
      line.material.dispose();
      pts.material.dispose();
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

export function createLessons({ scene, audio }) {
  const card = createCard();
  const canvas = card.querySelector("#lesson-canvas"),
    ctx = canvas.getContext("2d");
  const $ = (s) => card.querySelector(s);
  const trail = createTrail(scene);
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
  let stroke = null,
    resolveStroke = null;
  const point = (e) => {
    const b = canvas.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * SIZE, ((e.clientY - b.top) / b.height) * SIZE];
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (!resolveStroke) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    stroke = [point(e)];
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!stroke || !resolveStroke) return;
    const p = point(e),
      last = stroke[stroke.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
    stroke.push(p);
    board();
    if (run?.ghost) drawPattern(run.P, 1, "ghost");
    drawStroke(stroke);
  });
  const finishStroke = (e) => {
    if (!stroke || !resolveStroke) return;
    const s = stroke,
      r = resolveStroke;
    stroke = null;
    resolveStroke = null;
    if (e.pointerId !== undefined && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    r(s);
  };
  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);
  const capture = () =>
    new Promise((r) => {
      resolveStroke = r;
    });

  // ---- one demonstration by the teacher
  async function demonstrate() {
    const L = run;
    if (!L) return;
    L.busy = true;
    $("#lesson-again").disabled = true;
    $("#lesson-score").textContent = "";
    $("#lesson-score").className = "";
    L.shot?.("teacher");
    status("Patrz uważnie na ruch różdżki profesora.");
    const c = L.teacher.cast(L.P.clip, L.demoSpeed || 0.55);
    trail.follow(L.teacher, "#ffd98a");
    audio?.note?.(660, 0.5, "sine", 0.025);
    const ms = Math.max(1200, (c?.duration || 2) * 1000);
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => {
        if (run !== L) return done();
        const u = Math.min(1, (performance.now() - t0) / ms);
        board();
        drawPattern(L.P, 0.04 + u * 0.96, "demo");
        if (u < 1) requestAnimationFrame(tick);
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
    board();
    if (L.ghost) drawPattern(L.P, 1, "ghost");
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
      L.player.cast(L.P.clip, 1);
      trail.follow(L.player, "#bfe3ff");
      setTimeout(() => trail.stop(), 900);
      audio?.note?.(880 + L.successes * 110, 0.35, "sine", 0.04);
      L.react?.(true, r);
      status(pct >= 88 ? "Wzorowo! Ruch czysty i pewny." : pct >= 75 ? "Bardzo dobrze. Różdżka słucha ręki." : "Zaliczone. Następnym razem płynniej.");
    } else {
      audio?.note?.(180, 0.3, "triangle", 0.03);
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
      const r = resolveStroke;
      if (!r) return false;
      resolveStroke = null;
      r(points);
      return true;
    },
    _pattern(id, scale = 300, jitter = 0) {
      const P = PATTERNS[id];
      return resample(P.pts, 60).map(([x, y]) => [70 + x * scale + (Math.random() - 0.5) * jitter, 70 + y * scale + (Math.random() - 0.5) * jitter]);
    },
  };
}
