// The atmosphere module patches three.js shader chunks; it must load first.
import {
  TIME_STATES,
  WEATHERS,
  mixStates,
  weatherize,
  setHeightFog,
  snowCover,
  createLife,
  createStars,
  createPrecipitation,
} from './atmosphere.js';
import * as THREE from '../assets/three.module.js';
import { createWorld } from './world.js';
import { createInterior } from './interiors.js';
import { createMagic } from './magic.js';
import { createGraphics, createSky, PRESETS, QUALITY_ORDER } from './graphics.js';
import { enhanceEnvironment } from './environment.js';
import { createAudio } from './audio.js';
import { ROOMS, SPELLS, SOURCES, TOURS, PROJECT_NOTE } from './data.js';

window.__atlasBoot = true;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
const safe = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
/** Lower-case, accent-free text for forgiving Polish search ("zakleci" finds "Zaklęcia"). */
const fold = s =>
  String(s ?? '')
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
const clamp = THREE.MathUtils.clamp;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = matchMedia('(pointer: coarse)').matches;

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch {
    return {};
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const icon = {
  castle: '♜',
  lake: '≈',
  forest: '♧',
  hogsmeade: '⌂',
  quidditch: '◎',
  hagrid: '⌂',
  greenhouses: '❧',
  boathouse: '⚓',
  courtyard: '◇',
  astronomy: '✧',
  bridge: '⌒',
  owlery: '♢',
  willow: '❦',
  coveredbridge: '⌒',
};

// ---------------------------------------------------------------------------
// Progress (journal) and settings
// ---------------------------------------------------------------------------

const PROGRESS_KEY = 'hogwart-atlas-v1',
  SETTINGS_KEY = 'hogwart-atlas-settings-v1';
const saved = readJSON(PROGRESS_KEY);
const progress = {
  visited: [...(saved.visited || [])],
  lessons: [...(saved.lessons || [])],
  spells: [...new Set(['lumos', ...(saved.spells || [])])],
  house: saved.house || 'Hogwart',
};
const save = () => {
  if (!writeJSON(PROGRESS_KEY, progress)) toast('Przeglądarka nie pozwala zapisać postępu.');
};
const settings = Object.assign(
  { quality: null, qualityLocked: false, time: 0, weather: 0, sound: false },
  readJSON(SETTINGS_KEY),
);
const saveSettings = () => writeJSON(SETTINGS_KEY, settings);
const params = new URLSearchParams(location.search);

let toastTimer;
function toast(text, duration = 4200) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), duration);
}
function visit(id) {
  if (!progress.visited.includes(id)) {
    progress.visited.push(id);
    save();
    $('#journal-dot').classList.add('on');
  }
}

// ---------------------------------------------------------------------------
// Loading screen: real progress of the photographic 4K materials
// ---------------------------------------------------------------------------

THREE.Cache.enabled = true; // Rooms reuse the exterior photos instead of decoding them again.
const loading = {
  started: performance.now(),
  done: false,
  hidden: false,
  firstFrame: false,
  loaded: 0,
  total: 0,
};
function showLoadProgress() {
  const pct = loading.total ? Math.round((loading.loaded / loading.total) * 100) : 0;
  const bar = $('#loading-bar');
  if (bar) bar.style.transform = `scaleX(${Math.max(0.04, pct / 100)})`;
  const label = $('#loading-label');
  if (label)
    label.textContent = loading.done ? 'Zapalamy świece…' : `Wczytuję kamień, drewno i teren · ${pct}%`;
  const stream = $('#streaming');
  if (stream) {
    stream.hidden = loading.done || !loading.hidden;
    stream.textContent = `Doczytuję tekstury 4K · ${loading.loaded}/${loading.total}`;
  }
}
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  loading.loaded = loaded;
  loading.total = total;
  showLoadProgress();
};
THREE.DefaultLoadingManager.onLoad = () => {
  loading.done = true;
  showLoadProgress();
  if (renderer) renderer.shadowMap.needsUpdate = true;
  maybeHideLoader();
};
THREE.DefaultLoadingManager.onError = url => console.warn('Nie udało się wczytać:', url);
function maybeHideLoader(force = false) {
  if (loading.hidden || !loading.firstFrame) return;
  const waited = performance.now() - loading.started;
  if (!force && !loading.done && waited < 9000) return;
  loading.hidden = true;
  window.__atlasReady = true;
  const el = $('#loading');
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 1000);
  showLoadProgress();
  perf.reset();
}
setTimeout(() => maybeHideLoader(true), 9500);

// ---------------------------------------------------------------------------
// Renderer, scene and lights
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color('#77949c');
const exteriorFog = new THREE.FogExp2('#789196', 0.00165),
  interiorFog = new THREE.FogExp2('#17242b', 0.009);
scene.fog = exteriorFog;
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.15, 2800);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (e) {
  $('#loading').innerHTML =
    '<div class="loading-crest">H</div><p>TA PRZEGLĄDARKA NIE UDOSTĘPNIA WEBGL</p><span>Otwórz atlas w przeglądarce z włączoną akceleracją sprzętową.</span>';
  throw e;
}
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#viewport').append(renderer.domElement);

const hemi = new THREE.HemisphereLight('#b5d0dc', '#3e4135', 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffdbac', 3.4);
sun.position.set(-180, 250, 130);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 1, far: 900 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.5;
scene.add(sun);
const fill = new THREE.DirectionalLight('#7fbaef', 1.2);
fill.position.set(100, 90, -170);
scene.add(fill);

const world = createWorld();
scene.add(world.group);
const life = createLife(world);
const magic = createMagic(scene, camera);
const sky = createSky(scene);
const environment = enhanceEnvironment(world, renderer);
const graphics = createGraphics(renderer, scene, camera);
const audio = createAudio();
scene.environmentIntensity = 0.4;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

world.enableSnow();
const stars = createStars(scene);
const precipitation = createPrecipitation(scene);

// ---------------------------------------------------------------------------
// Graphics quality (persisted, overridable with ?q=, adaptive by default)
// ---------------------------------------------------------------------------

const QUALITY_LABEL = { ultra: 'Ultra', high: 'Wysoka', balanced: 'Zrównoważona', low: 'Oszczędna' };
const urlQuality = params.get('q');
let qualityLocked = false;
let quality = (() => {
  if (urlQuality && PRESETS[urlQuality]) {
    qualityLocked = true;
    return urlQuality;
  }
  if (settings.qualityLocked && PRESETS[settings.quality]) {
    qualityLocked = true;
    return settings.quality;
  }
  return coarsePointer || Math.min(screen.width, screen.height) < 700 ? 'balanced' : 'ultra';
})();
function applyQuality(next, { manual = false, announce = false } = {}) {
  quality = PRESETS[next] ? next : 'ultra';
  graphics.setQuality(quality);
  environment.setQuality(quality);
  const size = quality === 'ultra' ? 4096 : quality === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  sun.shadow.radius = quality === 'low' ? 1 : 2;
  renderer.shadowMap.needsUpdate = true;
  $('#quality span').textContent = 'Grafika ' + QUALITY_LABEL[quality];
  if (manual) {
    qualityLocked = true;
    settings.quality = quality;
    settings.qualityLocked = true;
    saveSettings();
    perf.enabled = false;
  }
  if (announce) toast('Jakość obrazu: ' + QUALITY_LABEL[quality]);
}

/** Watches real frame times and steps quality down when the GPU cannot keep up. */
const perf = {
  enabled: true,
  samples: 0,
  time: 0,
  good: 0,
  steps: 0,
  reset() {
    this.samples = 0;
    this.time = 0;
  },
  sample(raw) {
    if (!this.enabled || qualityLocked || !loading.hidden || document.hidden || anyModalOpen()) return;
    if (raw > 0.5) return; // a tab switch or a hitch, not steady-state performance
    this.samples++;
    this.time += raw;
    if (this.time < 4) return;
    const fps = this.samples / this.time;
    this.reset();
    if (fps < 27 && this.steps < 3) {
      const next = QUALITY_ORDER[QUALITY_ORDER.indexOf(quality) + 1];
      if (!next) {
        this.enabled = false;
        return;
      }
      this.steps++;
      this.good = 0;
      applyQuality(next);
      toast(
        `Grafika dopasowana do komputera: ${QUALITY_LABEL[next]} (${Math.round(fps)} kl./s). Zmienisz ją przyciskiem ✦.`,
        5200,
      );
    } else if (++this.good >= 2) this.enabled = false;
  },
};

// ---------------------------------------------------------------------------
// Time of day: four states with smooth blends between them
// ---------------------------------------------------------------------------

let timeIndex = (() => {
  const fromUrl = params.get('pora');
  const byId = TIME_STATES.findIndex(s => s.id === fromUrl || fold(s.name) === fold(fromUrl));
  if (byId >= 0) return byId;
  return TIME_STATES[settings.time] ? Number(settings.time) : 0;
})();
let timeLook = TIME_STATES[timeIndex];
const timeTween = { from: timeLook, to: timeLook, t: 1, duration: 2.6 };
const sunVector = new THREE.Vector3();
const INTERIOR_GRADE = {
  contrast: 1.08,
  saturation: 1.05,
  shadow: [-0.006, 0.002, 0.016],
  highlight: [0.035, 0.016, -0.02],
  vignette: 0.32,
};

// Weather blends in over a few seconds; snow settles slowly and melts slowly.
const weather = {
  index: WEATHERS[settings.weather] ? Number(settings.weather) : 0,
  rain: 0,
  snow: 0,
  settled: true,
};
(() => {
  const fromUrl = params.get('pogoda');
  const i = WEATHERS.findIndex(w => w.id === fromUrl || fold(w.name) === fold(fromUrl));
  if (i >= 0) weather.index = i;
  const id = WEATHERS[weather.index].id;
  weather.rain = id === 'rain' ? 1 : 0;
  weather.snow = id === 'snow' ? 1 : 0;
  snowCover.value = weather.snow;
})();
let currentLook = weatherize(timeLook, weather.rain, weather.snow),
  lookDirty = true;

function applyLook(look) {
  currentLook = look;
  sky.apply(look);
  environment.setLook(look);
  world.setLook(look);
  life.setLook(look);
  interior?.setSky(look);
  precipitation.setTint(new THREE.Color('#d5e0ea').lerp(new THREE.Color('#71869a'), look.night));
  stars.opacity = room ? 0 : look.stars;
  exteriorFog.color.set(look.fogColor);
  exteriorFog.density = look.fogDensity;
  if (room) return; // Interiors keep their own lights until the visitor walks out.
  scene.background.set(look.background);
  setHeightFog(...look.mist);
  hemi.color.set(look.hemiSky);
  hemi.groundColor.set(look.hemiGround);
  hemi.intensity = look.hemi;
  sunVector.set(...look.sunDirection).normalize();
  sun.position.copy(sunVector).multiplyScalar(420);
  sun.color.set(look.sunColor);
  sun.intensity = look.sun;
  fill.color.set(look.fillColor);
  fill.intensity = look.fill;
  renderer.toneMappingExposure = look.exposure;
  scene.environmentIntensity = look.environment;
  graphics.setGrade({
    contrast: look.gradeContrast,
    saturation: look.gradeSaturation,
    shadow: look.gradeShadow,
    highlight: look.gradeHighlight,
    vignette: look.vignette,
  });
}
function applyNow() {
  applyLook(weatherize(timeLook, weather.rain, weather.snow));
  lookDirty = false;
}
function refreshEnvironment() {
  scene.environment = sky.createEnvironment(renderer);
  renderer.shadowMap.needsUpdate = true;
}
function setTime(index, { announce = true, instant = false } = {}) {
  timeIndex = (index + TIME_STATES.length) % TIME_STATES.length;
  const target = TIME_STATES[timeIndex];
  settings.time = timeIndex;
  saveSettings();
  $('#time span').textContent = target.name;
  $('#time').dataset.time = target.id;
  audio.setScene({ time: target.id });
  if (instant || room || reducedMotion.matches) {
    timeTween.t = 1;
    timeLook = target;
    applyNow();
    refreshEnvironment();
  } else {
    timeTween.from = timeLook;
    timeTween.to = target;
    timeTween.t = 0;
  }
  if (announce)
    toast(room ? `${target.name} — zobaczysz ją po wyjściu na błonia.` : `${target.name} nad Hogwartem`);
}
function updateTime(dt) {
  if (timeTween.t >= 1) return;
  timeTween.t = Math.min(1, timeTween.t + dt / timeTween.duration);
  timeLook = mixStates(timeTween.from, timeTween.to, easeInOut(timeTween.t));
  lookDirty = true;
  if (frame % 3 === 0) renderer.shadowMap.needsUpdate = true;
  if (timeTween.t >= 1) {
    timeLook = timeTween.to;
    applyNow();
    refreshEnvironment();
  }
}
function setWeather(index, { announce = true, instant = false } = {}) {
  weather.index = (index + WEATHERS.length) % WEATHERS.length;
  const w = WEATHERS[weather.index];
  settings.weather = weather.index;
  saveSettings();
  $('#weather span').textContent = w.name;
  $('#weather .weather-icon').textContent = w.icon;
  audio.setScene({ weather: w.id });
  if (instant || reducedMotion.matches) {
    weather.rain = w.id === 'rain' ? 1 : 0;
    weather.snow = w.id === 'snow' ? 1 : 0;
    snowCover.value = weather.snow;
    applyNow();
    refreshEnvironment();
  }
  weather.settled = false;
  if (announce)
    toast(
      {
        clear: 'Chmury się rozchodzą.',
        rain: 'Nad jeziorem zbiera się deszcz.',
        snow: 'Pada śnieg — zima w Hogwarcie.',
      }[w.id],
    );
}
function updateWeather(dt) {
  const id = WEATHERS[weather.index].id;
  const rainGoal = id === 'rain' ? 1 : 0,
    snowGoal = id === 'snow' ? 1 : 0;
  const k = damp(0.55, dt);
  const before = weather.rain + weather.snow;
  weather.rain += (rainGoal - weather.rain) * k;
  weather.snow += (snowGoal - weather.snow) * k;
  if (Math.abs(rainGoal - weather.rain) < 0.004) weather.rain = rainGoal;
  if (Math.abs(snowGoal - weather.snow) < 0.004) weather.snow = snowGoal;
  // Snow takes ~15 s to settle and ~10 s to melt.
  snowCover.value = clamp(snowCover.value + (snowGoal ? dt / 15 : -dt / 10), 0, 1);
  if (Math.abs(weather.rain + weather.snow - before) > 1e-5) lookDirty = true;
  if (!weather.settled && weather.rain === rainGoal && weather.snow === snowGoal) {
    weather.settled = true;
    applyNow();
    refreshEnvironment();
  }
  precipitation.update(elapsed, camera, weather.rain, weather.snow, !!room);
}

// ---------------------------------------------------------------------------
// Camera state: damped orbit, free flight and walking
// ---------------------------------------------------------------------------

const clock = new THREE.Clock(),
  pointer = { down: false, x: 0, y: 0, moved: false, startX: 0, startY: 0, lastT: 0 },
  pointers = new Map(),
  keys = new Set();
let mode = 'orbit',
  room = null,
  interior = null,
  transition = null,
  autoOrbit = true,
  selected = 'castle',
  activePanel = null,
  tour = null,
  cinematic = false;
const orbit = {
  target: new THREE.Vector3(0, 45, 5),
  radius: 285,
  theta: 0.85,
  phi: 1.17,
  goal: { radius: 285, theta: 0.85, phi: 1.17 },
  spin: { theta: 0, phi: 0 },
};
const look = { yaw: 0, pitch: 0 };
const velocity = new THREE.Vector3();
let pinch = null,
  stepDistance = 0;
const initialPosition = new THREE.Vector3(195, 112, 260);
function setOrbitFromPosition(pos, target) {
  camera.position.copy(pos);
  orbit.target.copy(target);
  const d = pos.clone().sub(target);
  orbit.radius = d.length();
  orbit.theta = Math.atan2(d.x, d.z);
  orbit.phi = Math.acos(clamp(d.y / orbit.radius, -1, 1));
  Object.assign(orbit.goal, { radius: orbit.radius, theta: orbit.theta, phi: orbit.phi });
  orbit.spin.theta = orbit.spin.phi = 0;
}
setOrbitFromPosition(initialPosition, orbit.target);
camera.lookAt(orbit.target);
function lookFromCamera() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  look.yaw = Math.atan2(-dir.x, -dir.z);
  look.pitch = Math.asin(clamp(dir.y, -1, 1));
  camera.rotation.order = 'YXZ';
}
function orient() {
  camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
}

function updateMode() {
  const fly = mode === 'fly';
  $('#intro').hidden = !!room || fly || selected !== 'castle' || !!tour;
  $('#mode span').textContent = room ? 'Spacer po sali' : fly ? 'Swobodny lot' : 'Widok z góry';
  $('#crosshair').hidden = mode === 'orbit';
  $('#mobile-move').classList.toggle('visible', mode !== 'orbit');
  $('#spellbar').hidden = mode === 'orbit';
  $('.control-hint').innerHTML =
    mode === 'orbit'
      ? '<span>PRZECIĄGNIJ, ABY OBRÓCIĆ</span><i></i><span>SCROLL, ABY PRZYBLIŻYĆ</span><i></i><span>DWUKLIK · PRZYBLIŻ MIEJSCE</span><i></i><span>CTRL+K · SZUKAJ</span>'
      : `<span>WASD · ${room ? 'SPACER' : 'LOT'}</span>${room ? '' : '<i></i><span>Q / E · WYSOKOŚĆ</span>'}<i></i><span>PRZECIĄGNIJ · ROZEJRZYJ SIĘ</span><i></i><span>SHIFT · SZYBCIEJ</span>`;
}
function toggleMode() {
  if (room) {
    toast('W salach poruszasz się klawiszami WASD. Przeciągnij widok, aby się rozejrzeć.');
    return;
  }
  transition = null;
  autoOrbit = false;
  velocity.set(0, 0, 0);
  if (mode === 'orbit') {
    mode = 'fly';
    lookFromCamera();
    toast('Swobodny lot · WASD: ruch · Q/E: wysokość · Shift: szybciej');
  } else {
    mode = 'orbit';
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    setOrbitFromPosition(camera.position.clone(), camera.position.clone().addScaledVector(dir, 150));
  }
  updateMode();
}
$('#mode').onclick = toggleMode;

// ---------------------------------------------------------------------------
// Map markers and the place cards in the footer
// ---------------------------------------------------------------------------

const markers = [];
for (const loc of world.locations) {
  const b = document.createElement('button');
  b.className = 'marker' + (['castle', 'hogsmeade', 'forest', 'lake'].includes(loc.id) ? '' : ' minimal');
  b.innerHTML = `<span>${safe(loc.name)}</span>`;
  b.setAttribute('aria-label', loc.name);
  b.dataset.tip = loc.name;
  b.onclick = () => goLocation(loc.id);
  $('#markers').append(b);
  markers.push({ button: b, loc, point: new THREE.Vector3(...(loc.marker || loc.target)) });
}
const featurePlaces = [
  ['castle', 'Hogwart', 'Zamek i jego tajemnice'],
  ['lake', 'Czarne Jezioro', 'Druga strona opowieści'],
  ['forest', 'Zakazany Las', 'Ścieżki wśród cieni'],
  ['hogsmeade', 'Hogsmeade', 'Wioska czarodziejów'],
  ['quidditch', 'Boisko quidditcha', 'Tam, gdzie zaczyna się lot'],
  ['hagrid', 'Chatka Hagrida', 'Tuż za szkolnym progiem'],
];
$('#places').innerHTML = featurePlaces
  .map(
    ([id, name, sub]) =>
      `<button class="place-card ${id === 'castle' ? 'selected' : ''}" data-location="${id}"><span class="place-icon">${icon[id]}</span><span><strong>${name}</strong><small>${sub}</small></span><span class="arrow">↗</span></button>`,
  )
  .join('');
$('#places').onclick = e => {
  const b = e.target.closest('[data-location]');
  if (b) goLocation(b.dataset.location);
};

// ---------------------------------------------------------------------------
// Navigation, with shareable #miejsce/… and #sala/… links
// ---------------------------------------------------------------------------

let routing = false;
function setHash(hash) {
  if (routing || (location.hash || '') === hash) return;
  const url = hash || location.pathname + location.search;
  try {
    if (tour) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  } catch {
    /* file:// or sandboxed frames */
  }
}
function route(hash = location.hash) {
  const [, kind, id] = decodeURIComponent(hash).match(/^#(miejsce|sala)\/([\w-]+)/) || [];
  routing = true;
  try {
    if (kind === 'sala' && ROOMS.some(r => r.id === id)) {
      if (room?.id !== id) enterRoom(id);
    } else if (kind === 'miejsce' && world.locations.some(l => l.id === id)) goLocation(id);
    else if (room) exitRoom();
    else if (!kind && selected !== 'castle') goLocation('castle');
  } finally {
    routing = false;
  }
}
addEventListener('popstate', () => route());

function goLocation(id, { keepTour = false } = {}) {
  const loc = world.locations.find(l => l.id === id);
  if (!loc) return;
  if (room) exitRoom(false);
  if (!keepTour && tour) endTour();
  selected = id;
  mode = 'orbit';
  autoOrbit = false;
  velocity.set(0, 0, 0);
  visit(id);
  transition = {
    start: camera.position.clone(),
    end: new THREE.Vector3(...loc.position),
    fromTarget: orbit.target.clone(),
    target: new THREE.Vector3(...loc.target),
    elapsed: 0,
    duration: reducedMotion.matches ? 0.01 : 2.4,
  };
  $('#intro').hidden = id !== 'castle';
  $('#world-caption').hidden = false;
  $('#world-caption h2').textContent = loc.name;
  $('#world-caption p').textContent = loc.description || 'Odkryj kolejny zakątek magicznego świata.';
  $('#world-caption .fine-label').textContent =
    `${String(world.locations.indexOf(loc) + 1).padStart(2, '0')} / ${loc.category || 'BŁONIA I OKOLICE'}`;
  $('#position-label').textContent = loc.name;
  $$('.place-card').forEach(b => b.classList.toggle('selected', b.dataset.location === id));
  closeDrawer();
  updateMode();
  setHash(id === 'castle' ? '' : `#miejsce/${id}`);
}
function enterRoom(id, { keepTour = false } = {}) {
  const found = ROOMS.find(r => r.id === id);
  if (!found) return;
  magic.clear();
  if (!keepTour && tour) endTour();
  if (interior) {
    scene.remove(interior.group);
    interior.dispose();
  }
  room = found;
  graphics.setInterior(true);
  sky.setInterior(true);
  environment.setInterior(true);
  renderer.shadowMap.needsUpdate = true;
  transition = null;
  autoOrbit = false;
  mode = 'walk';
  velocity.set(0, 0, 0);
  world.group.visible = false;
  stars.opacity = 0;
  interior = createInterior(room);
  scene.add(interior.group);
  interior.setSky(currentLook);
  graphics.setGrade(INTERIOR_GRADE);
  scene.fog = interiorFog;
  setHeightFog(0);
  scene.background.set('#15252e');
  hemi.color.set('#b5d0dc');
  hemi.groundColor.set('#3e4135');
  hemi.intensity = 1.15;
  sun.color.set('#ffdbac');
  sun.intensity = 0.8;
  fill.intensity = 0.8;
  renderer.toneMappingExposure = 1.25;
  camera.fov = 48;
  camera.updateProjectionMatrix();
  camera.position.set(...interior.spawn);
  camera.lookAt(new THREE.Vector3(...interior.lookAt));
  lookFromCamera();
  $('#intro').hidden = true;
  $('#room-hud').hidden = false;
  $('#room-name').textContent = room.name;
  $('#room-subject').textContent = room.subject || room.category || 'ZAMEK HOGWART';
  $('#room-description').textContent = room.description;
  $('#room-detail').textContent = room.detail || '';
  $('#room-detail').hidden = true;
  $('#room-more').hidden = !room.detail;
  $('#room-more').textContent = 'Więcej o tym miejscu ↓';
  $('#talk-teacher').hidden = !room.lesson;
  $('#talk-teacher').innerHTML = room.lesson
    ? `Lekcja: ${safe(room.professor || room.subject)} <span>↗</span>`
    : '';
  $('#position-label').textContent = room.name;
  $('#markers').hidden = true;
  document.body.classList.add('interior');
  visit(id);
  closeDrawer();
  updateMode();
  renderSpells();
  audio.setScene({ interior: true, roomType: interior.roomType });
  setHash(`#sala/${id}`);
  toast(
    room.lesson
      ? `${room.professor || room.subject} czeka na Ciebie. Podejdź i naciśnij E albo kliknij profesora.`
      : `${room.name} · WASD — spacer, przeciągnij — rozglądanie`,
  );
}
function exitRoom(returnToCastle = true) {
  magic.clear();
  if (interior) {
    scene.remove(interior.group);
    interior.dispose();
    interior = null;
  }
  room = null;
  graphics.setInterior(false);
  sky.setInterior(false);
  environment.setInterior(false);
  renderer.shadowMap.needsUpdate = true;
  world.group.visible = true;
  scene.fog = exteriorFog;
  document.body.classList.remove('interior');
  $('#room-hud').hidden = true;
  $('#interact').hidden = true;
  $('#markers').hidden = false;
  mode = 'orbit';
  velocity.set(0, 0, 0);
  camera.fov = 48;
  camera.updateProjectionMatrix();
  orbit.target.set(0, 34, 5);
  setOrbitFromPosition(initialPosition, orbit.target);
  applyNow();
  audio.setScene({ interior: false, roomType: '' });
  updateMode();
  if (returnToCastle) goLocation('castle');
}
$('#leave-room').onclick = () => exitRoom();
$('#enter-hall').onclick = () => enterRoom(ROOMS.find(r => r.type === 'hall')?.id);
$('#talk-teacher').onclick = () => openLesson(room);
$('#room-more').onclick = () => {
  const open = $('#room-detail').hidden;
  $('#room-detail').hidden = !open;
  $('#room-more').textContent = open ? 'Zwiń ↑' : 'Więcej o tym miejscu ↓';
};
$('#share-room').onclick = shareLink;
$('.brand').onclick = e => {
  e.preventDefault();
  goLocation('castle');
};
$('#room-count').textContent = ROOMS.length;

async function shareLink() {
  const url = location.href;
  try {
    if (navigator.share && coarsePointer) await navigator.share({ title: document.title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast('Link skopiowany — otworzy dokładnie to miejsce.');
    }
  } catch {
    toast(url, 7000);
  }
}

// ---------------------------------------------------------------------------
// Drawer panels
// ---------------------------------------------------------------------------

function closeDrawer() {
  activePanel = null;
  $('#drawer').hidden = true;
  document.body.classList.remove('drawer-open');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.panel === 'explore'));
}
function openPanel(type) {
  if (activePanel === type) {
    closeDrawer();
    return;
  }
  activePanel = type;
  $('#drawer').hidden = false;
  document.body.classList.add('drawer-open');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.panel === type));
  $('#drawer-kicker').textContent = {
    explore: 'WYBIERZ SWOJĄ ŚCIEŻKĘ',
    rooms: 'ZA MURAMI HOGWARTU',
    lessons: 'OD PIERWSZEGO ZAKLĘCIA',
    journal: 'TWOJA MAGICZNA OPOWIEŚĆ',
  }[type];
  if (type === 'rooms') renderRoomPanel();
  if (type === 'lessons') renderLessonPanel();
  if (type === 'journal') renderJournal();
  if (type === 'explore') renderExplore();
  $('#drawer').scrollTop = 0;
}
$$('.nav-item').forEach(b => (b.onclick = () => openPanel(b.dataset.panel)));
$('#close-drawer').onclick = closeDrawer;

function renderRoomPanel() {
  const categories = [...new Set(ROOMS.map(r => r.category))];
  const count = c => ROOMS.filter(r => c === 'all' || r.category === c).length;
  $('#drawer-content').innerHTML =
    `<h2>Zamek i sale</h2><p class="lead">${ROOMS.length} miejsc. Otwórz drzwi, poznaj profesora i zostań na chwilę.</p><input class="search" type="search" aria-label="Szukaj sali lub profesora" placeholder="Szukaj sali, przedmiotu, profesora…"><div class="filters"><button class="filter active" data-category="all">Wszystkie <i>${count('all')}</i></button>${categories.map(c => `<button class="filter" data-category="${safe(c)}">${safe(c)} <i>${count(c)}</i></button>`).join('')}</div><div id="room-list"></div>`;
  let category = 'all';
  const render = () => {
    const q = fold($('.search').value.trim());
    const list = ROOMS.filter(
      r =>
        (category === 'all' || r.category === category) &&
        fold([r.name, r.professor, r.subject, r.category].join(' ')).includes(q),
    );
    $('#room-list').innerHTML = list.length
      ? list
          .map(r => {
            const visited = progress.visited.includes(r.id),
              done = progress.lessons.includes(r.id);
            const tags = [
              r.lesson ? `<em class="tag ${done ? 'done' : ''}">${done ? '✓ lekcja' : 'lekcja'}</em>` : '',
              visited ? '<em class="tag seen">odkryto</em>' : '',
            ].join('');
            return `<article class="room-card"><button data-room="${r.id}"><span><h3>${safe(r.name)}</h3><small>${safe(r.professor || r.subject || r.category)}</small>${tags ? `<span class="tags">${tags}</span>` : ''}</span><span class="arrow">↗</span></button></article>`;
          })
          .join('')
      : '<p class="empty">Żadna sala nie pasuje do wyszukiwania.</p>';
  };
  $('#room-list').onclick = e => {
    const b = e.target.closest('[data-room]');
    if (b) enterRoom(b.dataset.room);
  };
  $('.search').oninput = render;
  $$('.filter').forEach(
    b =>
      (b.onclick = () => {
        category = b.dataset.category;
        $$('.filter').forEach(x => x.classList.toggle('active', x === b));
        render();
      }),
  );
  render();
  if (!coarsePointer) $('.search').focus({ preventScroll: true });
}
function renderLessonPanel() {
  const lessons = ROOMS.filter(r => r.lesson);
  const done = lessons.filter(r => progress.lessons.includes(r.id)).length;
  $('#drawer-content').innerHTML =
    `<h2>Nauka magii</h2><p class="lead">Wejdź do sali, wysłuchaj profesora i sprawdź swoją wiedzę. Zaklęcia opanujesz ruchem różdżki.</p>${meter(done, lessons.length, 'ukończone lekcje')}${lessons
      .map(r => {
        const spell = findSpell(r.spell);
        return `<article class="lesson-card ${progress.lessons.includes(r.id) ? 'complete' : ''}">${progress.lessons.includes(r.id) ? '<span class="status-badge">✓ LEKCJA UKOŃCZONA</span>' : ''}<small>${safe(r.professor || 'Nauczyciel prowadzący')}</small><h3>${safe(r.subject || r.name)}</h3><p>${safe(r.lesson.title)}${spell ? ` · <span class="spell-tag">zaklęcie: ${safe(spell.name)}</span>` : ''}</p><button data-lesson-room="${r.id}">Przejdź do sali →</button></article>`;
      })
      .join('')}`;
  $$('[data-lesson-room]').forEach(b => (b.onclick = () => enterRoom(b.dataset.lessonRoom)));
}
function meter(value, max, label) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `<div class="meter" role="img" aria-label="${safe(label)}: ${value} z ${max}"><div class="meter-top"><span>${safe(label)}</span><strong>${value}<small> / ${max}</small></strong></div><div class="meter-track"><i style="width:${pct}%"></i></div></div>`;
}
function renderJournal() {
  $('#journal-dot').classList.remove('on');
  const roomsSeen = ROOMS.filter(r => progress.visited.includes(r.id)).length,
    placesSeen = world.locations.filter(l => progress.visited.includes(l.id)).length,
    lessonTotal = ROOMS.filter(r => r.lesson).length;
  $('#drawer-content').innerHTML =
    `<h2>Mój dziennik</h2><p class="lead">${safe(progress.house)} · Postęp zapisuje się w tej przeglądarce.</p><div class="meters">${meter(roomsSeen, ROOMS.length, 'odkryte sale')}${meter(placesSeen, world.locations.length, 'miejsca na błoniach')}${meter(progress.lessons.length, lessonTotal, 'ukończone lekcje')}${meter(SPELLS.filter(hasSpell).length, SPELLS.length, 'znane zaklęcia')}</div><h3>Twoje zaklęcia</h3><div class="spell-chips">${SPELLS.map(
      (s, i) =>
        `<span class="chip ${hasSpell(s) ? 'known' : ''}" title="${safe(hasSpell(s) ? s.description : 'Ukończ odpowiednią lekcję')}">${hasSpell(s) ? spellSymbols[i] : '·'} ${safe(s.name)}</span>`,
    ).join('')}</div><h3>Ostatnio odkryte</h3>${
      [...progress.visited]
        .reverse()
        .slice(0, 15)
        .map(id => {
          const r = ROOMS.find(x => x.id === id),
            l = world.locations.find(x => x.id === id);
          return `<button class="journal-card" data-journal="${safe(id)}" data-kind="${r ? 'room' : 'place'}">${safe(r?.name || l?.name || id)}<span>${r ? 'sala' : 'błonia'} ↗</span></button>`;
        })
        .join('') || '<p class="lead">Twoja podróż dopiero się zaczyna.</p>'
    }<button class="reset-button" id="reset-progress">Wyzeruj dziennik…</button>`;
  $$('[data-journal]').forEach(
    b =>
      (b.onclick = () =>
        b.dataset.kind === 'room' ? enterRoom(b.dataset.journal) : goLocation(b.dataset.journal)),
  );
  $('#reset-progress').onclick = () => {
    openModal(
      'NOWY POCZĄTEK',
      '<h2>Nowy dziennik?</h2><p>Usunie to odkryte miejsca, ukończone lekcje i wybór domu zapisane w tej przeglądarce.</p><button class="primary" id="confirm-reset">Rozpocznij od nowa</button>',
    );
    $('#confirm-reset').onclick = () => {
      progress.visited = [];
      progress.lessons = [];
      progress.spells = ['lumos'];
      progress.house = 'Hogwart';
      save();
      updateHouseBadge();
      $('#modal').close();
      renderJournal();
      renderSpells();
      toast('Nowy dziennik jest gotowy.');
    };
  };
}
/** One projection for the schematic map, its points and the "you are here" arrow. */
const mapXY = (x, z) => [165 + (x - 34) * 0.54, 107 + (z - 5) * 0.54];
const mapPath = points =>
  points
    .map(
      ([x, z], i) =>
        `${i ? 'L' : 'M'}${mapXY(x, z)
          .map(v => v.toFixed(1))
          .join(' ')}`,
    )
    .join('');
const MAP_POINTS = [
  ['castle', 'Hogwart'],
  ['hogsmeade', 'Hogsmeade'],
  ['forest', 'Las'],
  ['lake', 'Jezioro', [10, 168]],
  ['quidditch', 'Quidditch'],
  ['hagrid', 'Hagrid'],
  ['owlery', 'Sowiarnia'],
  ['greenhouses', 'Szklarnie'],
  ['boathouse', 'Przystań'],
];
function renderExplore() {
  const roads = [
    [
      [0, 0],
      [60, -28],
      [100, -65],
      [145, -88],
      [180, -130],
      [235, -158],
      [262, -190],
    ],
    [
      [-30, -30],
      [-60, -63],
      [-85, -55],
      [-114, -5],
      [-114, 24],
    ],
    [
      [-114, 24],
      [-60, 55],
      [-94, 65],
      [-130, 85],
      [-160, 105],
    ],
    [
      [-95, -40],
      [-130, -60],
      [-170, -65],
      [-210, -90],
    ],
    [
      [-120, -64],
      [-125, -75],
      [-119, -90],
    ],
    [
      [44, 60],
      [44, 115],
    ],
  ];
  const points = MAP_POINTS.map(([id, label, at]) => {
    const loc = world.locations.find(l => l.id === id);
    if (!loc) return '';
    const [x, y] = mapXY(...(at || [loc.target[0], loc.target[2]]));
    const right = x < 270;
    return `<g class="map-link ${selected === id ? 'current' : ''}" data-map="${id}" tabindex="0" role="button" aria-label="${label}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${id === 'castle' ? 6.5 : 4.5}"/><text x="${(x + (right ? 9 : -9)).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">${label}</text></g>`;
  }).join('');
  $('#drawer-content').innerHTML =
    `<h2>Dokąd prowadzi magia?</h2><p class="lead">Wybierz miejsce na mapie lub podążaj jedną z trzech przygotowanych tras.</p><svg class="map-svg" viewBox="0 0 330 215" role="img" aria-label="Schemat położenia miejsc"><defs><radialGradient id="map-glow"><stop offset="0" stop-color="#e8cf8f" stop-opacity=".55"/><stop offset="1" stop-color="#e8cf8f" stop-opacity="0"/></radialGradient><pattern id="map-trees" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M4.5 1.5 L7 6.5 H2Z" fill="#6f8f73" opacity=".35"/></pattern></defs><path d="${mapPath(
      [
        [-350, -270],
        [-85, -270],
        [-85, 30],
        [-140, 90],
        [-350, 90],
      ],
    )}Z" fill="url(#map-trees)"/><path d="M0 146 Q60 132 118 146 Q150 132 190 140 Q260 130 330 144 V215 H0Z" fill="#4f7d8a3d" stroke="#82a3a555"/><path d="${mapPath(
      [
        [-78, -4],
        [-60, -46],
        [0, -60],
        [56, -46],
        [80, 0],
        [60, 50],
        [0, 64],
        [-60, 50],
      ],
    )}Z" fill="#c9b78a1c" stroke="#c9b78a40"/>${roads.map(r => `<path d="${mapPath(r)}" fill="none" stroke="#bca57466" stroke-dasharray="3 4"/>`).join('')}<g id="map-you"><circle r="14" fill="url(#map-glow)"/><path d="M0 -9 L4 3 L0 1 L-4 3Z" fill="#f4dfa6"/></g>${points}</svg><p class="mini-label">Schemat orientacyjny autorskiej kompozycji filmowej. Złota strzałka pokazuje, gdzie teraz patrzysz.</p><div class="route-title">WYCIECZKI Z PRZEWODNIKIEM</div>${TOURS.map((t, i) => `<article class="tour-card"><span class="tour-number">TRASA 0${i + 1} · ${t.stops.length} PRZYSTANKÓW</span><h3>${safe(t.name)}</h3><p>${safe(t.description)}</p><button data-tour="${t.id}">Wyrusz w drogę ↗</button></article>`).join('')}`;
  $$('[data-map]').forEach(b => {
    b.onclick = () => goLocation(b.dataset.map);
    b.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goLocation(b.dataset.map);
      }
    };
  });
  $$('[data-tour]').forEach(b => (b.onclick = () => startTour(b.dataset.tour)));
  updateMapYou();
}
function updateMapYou() {
  const el = $('#map-you');
  if (!el) return;
  const [x, y] = mapXY(camera.position.x, camera.position.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const angle = (Math.atan2(dir.x, -dir.z) * 180) / Math.PI;
  el.setAttribute(
    'transform',
    `translate(${clamp(x, 8, 322).toFixed(1)} ${clamp(y, 8, 207).toFixed(1)}) rotate(${angle.toFixed(0)})`,
  );
  el.style.display = room ? 'none' : '';
}

// ---------------------------------------------------------------------------
// Guided tours
// ---------------------------------------------------------------------------

function startTour(id) {
  const routeDef = TOURS.find(t => t.id === id) || TOURS[0];
  if (!routeDef) return;
  tour = { route: routeDef, index: 0 };
  document.body.classList.add('touring');
  $('#tour-bar').hidden = false;
  showTourStop();
}
function showTourStop() {
  const stop = tour.route.stops[tour.index];
  if (stop.kind === 'room') enterRoom(stop.id, { keepTour: true });
  else goLocation(stop.id, { keepTour: true });
  $('#intro').hidden = true;
  $('#tour-step').textContent = `${tour.route.name} · ${tour.index + 1} / ${tour.route.stops.length}`;
  $('#tour-title').textContent =
    ROOMS.find(r => r.id === stop.id)?.name || world.locations.find(l => l.id === stop.id)?.name || stop.id;
  $('#tour-caption').textContent = stop.caption;
  $('#tour-progress').style.transform = `scaleX(${(tour.index + 1) / tour.route.stops.length})`;
  $('#tour-prev').disabled = tour.index === 0;
  $('#tour-next').textContent = tour.index === tour.route.stops.length - 1 ? 'Zakończ ✓' : 'Dalej →';
}
function endTour() {
  tour = null;
  $('#tour-bar').hidden = true;
  document.body.classList.remove('touring');
  updateMode();
}
$('#begin-tour').onclick = () => startTour(TOURS[0]?.id);
$('#tour-next').onclick = () => {
  if (!tour) return;
  if (tour.index === tour.route.stops.length - 1) {
    endTour();
    audio.chime();
    toast('Wycieczka zakończona. Teraz czas na własne odkrycia.');
  } else {
    tour.index++;
    showTourStop();
  }
};
$('#tour-prev').onclick = () => {
  if (tour && tour.index > 0) {
    tour.index--;
    showTourStop();
  }
};
$('#tour-stop').onclick = endTour;

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const anyModalOpen = () => $('#modal').open || $('#palette').open;
function openModal(label, html) {
  keys.clear();
  pointer.down = false;
  $('#modal-label').textContent = label;
  $('#modal-content').innerHTML = html;
  if (!$('#modal').open) $('#modal').showModal();
}
$('#close-modal').onclick = () => $('#modal').close();
for (const dialog of [$('#modal'), $('#palette')])
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      dialog.close();
  });
function showSources() {
  openModal(
    'O ATLASIE',
    `<h2>Świat utkany z magii</h2><p>Autorski, interaktywny model 3D inspirowany filmowym Hogwartem. Możesz zwiedzać błonia, latać nad zamkiem, odwiedzać ${ROOMS.length} wnętrz i uczyć się u profesorów.</p><p>${safe(PROJECT_NOTE)}</p><p><strong>Zakres rekonstrukcji:</strong> bryły, teren i wnętrza są modelowane proceduralnie. To interpretacja, a nie rekonstrukcja 1:1 ani oficjalna mapa. Układ zamku zmieniał się między filmami; położenia części lokacji i połączenia pomieszczeń są umowne. Wejścia do wnętrz odbywają się przez atlas.</p><p>Geometria, scenografia, mgła, ptaki i dźwięki powstały w kodzie. Powierzchnie kamienia, drewna i terenu korzystają z fotograficznych materiałów PBR 4K z Poly Haven (CC0). Nazwy świata Harry’ego Pottera należą do ich uprawnionych właścicieli. Nieoficjalny projekt fanowski.</p><h3>Materiały graficzne</h3><p><a href="https://polyhaven.com/a/stone_brick_wall_001" target="_blank" rel="noopener">Kamień</a> · <a href="https://polyhaven.com/a/wood_floor_worn" target="_blank" rel="noopener">Drewno</a> · <a href="https://polyhaven.com/a/rocky_terrain_02" target="_blank" rel="noopener">Teren</a></p><h3>Materiały odniesienia</h3><ul class="source-list">${SOURCES.map(s => `<li><a href="${safe(s.url)}" target="_blank" rel="noopener noreferrer">${safe(s.title)} ↗</a><span>${safe(s.note)}</span></li>`).join('')}</ul><p class="mini-label">Silnik 3D: Three.js (MIT). Dziennik i ustawienia są przechowywane wyłącznie lokalnie w przeglądarce.</p>`,
  );
}
$('#sources').onclick = showSources;
function showHelp() {
  openModal(
    'WSKAZÓWKI DLA ODKRYWCY',
    `<h2>Twoja droga do Hogwartu</h2><p>Obróć model, wybierz miejsce i wejdź do sal przez „Zamek i sale” albo wyszukiwarkę. Każda lekcja zaczyna się u profesora.</p><div class="key-grid"><kbd>Przeciągnij</kbd><span>Obracaj widok / rozglądaj się w salach</span><kbd>Scroll · szczypanie</kbd><span>Przybliżaj i oddalaj model</span><kbd>Dwuklik</kbd><span>Przybliż wskazane miejsce</span><kbd>Ctrl + K  ·  /</kbd><span>Szukaj sal, miejsc, wycieczek i akcji</span><kbd>F</kbd><span>Przełącz widok z góry i swobodny lot</span><kbd>W A S D</kbd><span>Spaceruj po sali lub lataj po błoniach</span><kbd>Q / E</kbd><span>W locie: opadaj / wznoś się</span><kbd>E</kbd><span>W sali: porozmawiaj z profesorem, wyjdź przez drzwi</span><kbd>Shift</kbd><span>Poruszaj się szybciej</span><kbd>1 – 8</kbd><span>Rzuć opanowane zaklęcie</span><kbd>T</kbd><span>Zmień porę dnia</span><kbd>O</kbd><span>Zmień pogodę: pogodnie, deszcz, śnieg</span><kbd>C</kbd><span>Tryb kinowy bez interfejsu</span><kbd>P</kbd><span>Zrób zdjęcie</span><kbd>M</kbd><span>Dźwięki otoczenia</span><kbd>Esc</kbd><span>Zamknij okno lub panel</span></div><p>Na telefonie rozglądaj się palcem, przybliżaj dwoma palcami, a do ruchu użyj strzałek. Wybierz dom przyciskiem w prawym górnym rogu.</p>`,
  );
}
$('#help').onclick = showHelp;
const HOUSES = [
  ['Gryffindor', 'Odwaga i determinacja', '#be7b65'],
  ['Ravenclaw', 'Wiedza i wyobraźnia', '#8cacc2'],
  ['Hufflepuff', 'Lojalność i cierpliwość', '#ceb775'],
  ['Slytherin', 'Ambicja i spryt', '#8bb39b'],
];
function updateHouseBadge() {
  const house = HOUSES.find(h => h[0] === progress.house);
  $('#house').textContent = house ? house[0][0] : 'H';
  $('#house').title = house ? house[0] : 'Wybierz swój dom';
  $('#house').style.setProperty('--house', house ? house[2] : '#bd9c57');
  document.documentElement.style.setProperty('--house', house ? house[2] : '#d4bb83');
}
$('#house').onclick = () => {
  openModal(
    'TWÓJ DOM',
    `<h2>Gdzie jest Twoje miejsce?</h2><p>Wybierz barwy, w których zaczniesz szkolną przygodę.</p><div class="house-grid">${HOUSES.map(([n, d, c]) => `<button class="house-choice ${progress.house === n ? 'chosen' : ''}" data-house="${n}" style="--house:${c}"><strong>${n}</strong><small>${d}</small></button>`).join('')}</div>`,
  );
  $$('[data-house]').forEach(
    b =>
      (b.onclick = () => {
        progress.house = b.dataset.house;
        save();
        updateHouseBadge();
        $('#modal').close();
        audio.chime();
        toast(`Witaj w ${progress.house}!`);
        if (activePanel === 'journal') renderJournal();
      }),
  );
};
updateHouseBadge();

// ---------------------------------------------------------------------------
// Lessons, gestures and spells
// ---------------------------------------------------------------------------

function hasSpell(spell) {
  return progress.spells.some(
    x => x.toLowerCase() === spell.id?.toLowerCase() || x.toLowerCase() === spell.name?.toLowerCase(),
  );
}
const findSpell = name =>
  name ? SPELLS.find(s => s.name.toLowerCase() === String(name).toLowerCase() || s.id === name) : null;
const spellSymbols = ['✧', '↟', '⌁', '◈', '✷', '❋', '◌', '↯'];
function renderSpells() {
  $('#spell-buttons').innerHTML = SPELLS.slice(0, 8)
    .map(
      (s, i) =>
        `<button class="spell-slot ${hasSpell(s) ? '' : 'locked'}" data-spell="${s.id}" style="--spell:${s.color || '#e1c58c'}" title="${safe(s.name)} — ${hasSpell(s) ? safe(s.description) : 'Ukończ odpowiednią lekcję'}"><kbd>${i + 1}</kbd><strong>${hasSpell(s) ? spellSymbols[i] : '·'}</strong><small>${safe(s.name)}</small></button>`,
    )
    .join('');
  $$('[data-spell]').forEach(b => (b.onclick = () => castSpell(SPELLS.find(s => s.id === b.dataset.spell))));
}
function openLesson(r) {
  if (!r?.lesson) return;
  const l = r.lesson;
  const done = progress.lessons.includes(r.id);
  openModal(
    r.professor || r.subject,
    `<h2>${safe(l.title)}</h2>${done ? '<span class="status-badge">✓ JUŻ UKOŃCZONA — MOŻESZ POWTÓRZYĆ</span>' : ''}<p class="quote">${safe(l.intro)}</p><p>${safe(l.question)}</p><div class="answers">${l.choices.map((c, i) => `<button class="answer" data-answer="${i}"><b>${String.fromCharCode(65 + i)}</b> ${safe(c)}</button>`).join('')}</div><div class="answer-note" role="status"></div>`,
  );
  $$('[data-answer]').forEach(
    b =>
      (b.onclick = () => {
        if (Number(b.dataset.answer) === l.answer) {
          b.classList.add('correct');
          $$('[data-answer]').forEach(x => (x.disabled = true));
          $('.answer-note').textContent = 'Bardzo dobrze. Wiedza to pierwszy krok.';
          setTimeout(() => {
            if (!$('#modal').open) return;
            if (findSpell(r.spell)) showGesture(r);
            else completeLesson(r);
          }, 700);
        } else {
          b.classList.add('wrong');
          b.disabled = true;
          $('.answer-note').textContent =
            'Jeszcze chwila namysłu. Wskazówkę znajdziesz we wprowadzeniu profesora.';
        }
      }),
  );
}
/** Professors without a lesson still say a few words about their room. */
function openConversation(r) {
  if (r.lesson) return openLesson(r);
  openModal(
    r.professor || r.name,
    `<h2>${safe(r.name)}</h2><p class="quote">${safe(r.detail || r.description)}</p><p class="mini-label">${safe(r.professor || '')}${r.subject ? ' · ' + safe(r.subject) : ''}</p><button class="primary" id="close-talk">Dziękuję <span>→</span></button>`,
  );
  $('#close-talk').onclick = () => $('#modal').close();
}
function completeLesson(r) {
  const firstTime = !progress.lessons.includes(r.id);
  if (firstTime) progress.lessons.push(r.id);
  const spell = findSpell(r.spell);
  const newSpell = spell && !hasSpell(spell);
  if (newSpell) progress.spells.push(spell.id);
  save();
  renderSpells();
  $('#journal-dot').classList.add('on');
  audio.chime();
  const lessonTotal = ROOMS.filter(x => x.lesson).length;
  openModal(
    'LEKCJA UKOŃCZONA',
    `<div class="lesson-seal">✧</div><h2>${spell ? safe(spell.name) : 'Nowa wiedza, nowe możliwości'}</h2><p>${safe(r.lesson.success)}</p>${meter(progress.lessons.length, lessonTotal, 'ukończone lekcje')}<p class="mini-label">Osiągnięcie zapisane w Twoim dzienniku.${newSpell ? ' Zaklęcie jest teraz dostępne na pasku różdżki.' : ''}</p><button class="primary" id="finish-lesson">${spell ? 'Wypróbuj zaklęcie <span>↗</span>' : 'Wróć do zwiedzania <span>→</span>'}</button>`,
  );
  $('#finish-lesson').onclick = () => {
    $('#modal').close();
    if (spell) castSpell(spell);
    else toast('Lekcja zapisana w dzienniku.');
  };
}
function showGesture(r) {
  const spell = findSpell(r.spell);
  const pattern = r.lesson.gesture || spell?.pattern || 'up';
  const guide = {
    up: 'Narysuj zdecydowaną linię od dołu do góry.',
    circle: 'Zatocz szeroki krąg i wróć w pobliże początku.',
    zigzag: 'Narysuj zygzak, zmieniając kierunek przynajmniej dwa razy.',
  }[pattern];
  const sequence = { up: ['↑', '↑', '↑'], circle: ['↑', '→', '↓', '←'], zigzag: ['←', '→', '←'] }[pattern];
  openModal(
    'PRAKTYKA · RUCH RÓŻDŻKI',
    `<h2>${safe(r.spell)}</h2><p>${guide} Prowadź różdżkę po polu poniżej.</p><canvas class="gesture-pad" id="gesture" width="900" height="380" aria-label="Pole do narysowania ruchu różdżki"></canvas><div class="gesture-actions"><button id="clear-gesture">Wyczyść ruch ↻</button><span class="mini-label" id="gesture-status">${safe(r.spell)} · ${pattern === 'up' ? '↑' : pattern === 'circle' ? '◯' : 'ϟ'}</span></div><p class="mini-label">Alternatywnie kliknij kolejno kierunki: ${sequence.join(' ')}</p><div class="gesture-keyboard">${['↑', '→', '↓', '←'].map(c => `<button data-direction="${c}" aria-label="Kierunek ${c}">${c}</button>`).join('')}</div>`,
  );
  const canvas = $('#gesture'),
    ctx = canvas.getContext('2d');
  let points = [],
    drawing = false,
    typed = [];
  const clear = () => {
    ctx.clearRect(0, 0, 900, 380);
    ctx.strokeStyle = '#baa77144';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    if (pattern === 'up') {
      ctx.moveTo(450, 310);
      ctx.lineTo(450, 60);
    } else if (pattern === 'circle') ctx.arc(450, 190, 130, 0, Math.PI * 2);
    else {
      ctx.moveTo(540, 50);
      ctx.lineTo(360, 160);
      ctx.lineTo(530, 210);
      ctx.lineTo(360, 330);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  clear();
  const point = e => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * 900) / rect.width,
      y: ((e.clientY - rect.top) * 380) / rect.height,
    };
  };
  canvas.onpointerdown = e => {
    drawing = true;
    points = [point(e)];
    clear();
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = e => {
    if (!drawing) return;
    const p = point(e),
      last = points[points.length - 1];
    ctx.strokeStyle = '#f1d99a';
    ctx.shadowColor = '#edc474';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    points.push(p);
  };
  canvas.onpointerup = () => {
    drawing = false;
    if (points.length < 5) {
      $('#gesture-status').textContent = 'Spróbuj dłuższego ruchu.';
      return;
    }
    let length = 0;
    for (let i = 1; i < points.length; i++)
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const first = points[0],
      last = points.at(-1);
    let ok = false;
    if (pattern === 'up') ok = first.y - last.y > 120 && Math.abs(first.x - last.x) < 180 && length < 650;
    if (pattern === 'circle') {
      const xs = points.map(p => p.x),
        ys = points.map(p => p.y);
      ok =
        length > 450 &&
        Math.hypot(first.x - last.x, first.y - last.y) < 110 &&
        Math.max(...xs) - Math.min(...xs) > 150 &&
        Math.max(...ys) - Math.min(...ys) > 120;
    }
    if (pattern === 'zigzag') {
      let turns = 0,
        sign = 0,
        prev = points[0];
      for (const p of points) {
        if (Math.abs(p.x - prev.x) > 28) {
          const s = Math.sign(p.x - prev.x);
          if (sign && s !== sign) turns++;
          sign = s;
          prev = p;
        }
      }
      ok = turns >= 2 && length > 220;
    }
    if (ok) completeLesson(r);
    else $('#gesture-status').textContent = 'Jeszcze raz — podążaj za konturem.';
  };
  canvas.onpointercancel = () => (drawing = false);
  $('#clear-gesture').onclick = () => {
    typed = [];
    points = [];
    clear();
    $('#gesture-status').textContent = 'Zacznij nowy ruch.';
  };
  $$('[data-direction]').forEach(
    b =>
      (b.onclick = () => {
        typed.push(b.dataset.direction);
        if (typed.some((x, i) => x !== sequence[i])) {
          typed = [];
          $('#gesture-status').textContent = 'Zacznij ponownie: ' + sequence.join(' ');
        } else if (typed.length === sequence.length) completeLesson(r);
        else $('#gesture-status').textContent = typed.join(' ') + ' …';
      }),
  );
}

const wand = new THREE.Group();
const wandWood = new THREE.Mesh(
  new THREE.CylinderGeometry(0.025, 0.045, 0.8, 8),
  new THREE.MeshStandardMaterial({ color: '#4e3325', roughness: 0.8 }),
);
wandWood.rotation.x = Math.PI / 2;
wand.add(wandWood);
const tip = new THREE.PointLight('#c4e8ff', 0, 14, 2);
tip.position.set(0, 0, -0.4);
wand.add(tip);
const tipMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.035, 8, 8),
  new THREE.MeshBasicMaterial({ color: '#fff0ca' }),
);
tipMesh.position.copy(tip.position);
wand.add(tipMesh);
camera.add(wand);
wand.position.set(0.55, -0.42, -1);
wand.rotation.set(-0.18, -0.2, -0.3);
scene.add(camera);
wand.visible = false;
let lumos = false,
  wandKick = 0;
function castSpell(spell) {
  if (!spell) return;
  if (!hasSpell(spell)) {
    toast(`Poznaj ${spell.name} podczas lekcji u profesora.`);
    return;
  }
  if (mode === 'orbit') toggleMode();
  const color = new THREE.Color(spell.color || '#bbd8ff');
  magic.cast(spell, !!room);
  if (spell.id === 'lumos') {
    lumos = !lumos;
    tip.intensity = lumos ? 28 : 0;
    tipMesh.material.color.set(lumos ? '#ffffff' : '#fff0ca');
  }
  const flash = $('#spell-flash');
  flash.style.background = `radial-gradient(ellipse at 55% 65%,#${color.getHexString()}44,transparent 65%)`;
  flash.style.opacity = '.8';
  setTimeout(() => (flash.style.opacity = '0'), 120);
  toast(
    spell.name +
      '! ' +
      (spell.id === 'lumos'
        ? lumos
          ? 'Różdżka rozświetla otoczenie.'
          : 'Światło gaśnie.'
        : spell.description),
  );
  audio.spell(SPELLS.indexOf(spell));
  wandKick = 1;
}

// ---------------------------------------------------------------------------
// Tools: time, photo, quality, sound
// ---------------------------------------------------------------------------

$('#time').onclick = () => setTime(timeIndex + 1);
$('#weather').onclick = () => setWeather(weather.index + 1);
function takePhoto() {
  graphics.render(0);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  link.download = `Hogwart-${room?.id || selected}-${TIME_STATES[timeIndex].id}-${stamp}.png`;
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
  $('#shutter').classList.remove('flash');
  void $('#shutter').offsetWidth;
  $('#shutter').classList.add('flash');
  toast('Zapisano widok magicznego świata.');
}
$('#photo').onclick = takePhoto;
function showQuality() {
  const option = (id, label, desc) =>
    `<button class="answer ${quality === id && qualityLocked ? 'correct' : ''}" data-quality="${id}"><strong>${label}${quality === id && qualityLocked ? ' ✓' : ''}</strong><br><small>${desc}</small></button>`;
  openModal(
    'OBRAZ I ŚWIATŁO',
    `<h2>Grafika bez pośpiechu</h2><p>Wybierz jakość odpowiednią dla swojego komputera. Materiały fotograficzne 4K są dostępne w każdym trybie. Teraz: <strong>${QUALITY_LABEL[quality]}</strong>${qualityLocked ? '' : ' (dobrana automatycznie)'}.</p><div class="answers">${[
      `<button class="answer ${!qualityLocked ? 'correct' : ''}" data-quality="auto"><strong>Automatyczna${!qualityLocked ? ' ✓' : ''}</strong><br><small>Start w najwyższej jakości, obniżanie, gdy obraz przestaje być płynny</small></button>`,
      option(
        'ultra',
        'Ultra',
        'Cienie 4096 px · odbicia na jeziorze · wygładzanie 4× · cienie kontaktowe · HDR i bloom',
      ),
      option('high', 'Wysoka', 'Cienie 2048 px · odbicia na jeziorze · wygładzanie 2× · cienie kontaktowe'),
      option(
        'balanced',
        'Zrównoważona',
        'Lżejszy obraz dla laptopów i telefonów · cienie 1024 px · uproszczona woda',
      ),
      option('low', 'Oszczędna', 'Dla słabszych kart i baterii · niższa rozdzielczość · bez bloomu'),
    ].join(
      '',
    )}</div><p class="mini-label">Dostępność HDR i cieni kontaktowych zależy od obsługi WebGL przez kartę graficzną. Jakość możesz też wymusić adresem, np. <code>?q=balanced</code>.</p>`,
  );
  $$('[data-quality]').forEach(
    b =>
      (b.onclick = () => {
        $('#modal').close();
        if (b.dataset.quality === 'auto') {
          qualityLocked = false;
          settings.qualityLocked = false;
          settings.quality = null;
          saveSettings();
          Object.assign(perf, { enabled: true, steps: 0, good: 0 });
          perf.reset();
          applyQuality(coarsePointer ? 'balanced' : 'ultra');
          toast('Jakość będzie dobierana automatycznie.');
        } else applyQuality(b.dataset.quality, { manual: true, announce: true });
      }),
  );
}
$('#quality').onclick = showQuality;

async function toggleAudio(force) {
  try {
    const on = await audio.toggle(force);
    settings.sound = on;
    saveSettings();
    $('#sound').classList.toggle('on', on);
    $('#sound').setAttribute('aria-label', on ? 'Wyłącz dźwięki otoczenia' : 'Włącz dźwięki otoczenia');
    $('#sound').title = on ? 'Wyłącz dźwięki otoczenia (M)' : 'Włącz dźwięki otoczenia (M)';
    if (force === undefined) toast(on ? 'Dźwięki otoczenia włączone' : 'Dźwięki wyłączone');
  } catch {
    toast('Ta przeglądarka nie udostępnia dźwięku.');
  }
}
$('#sound').onclick = () => toggleAudio();
// Browsers start audio only after a gesture: honour a saved preference on the first one.
if (settings.sound) {
  const resume = () => {
    removeEventListener('pointerdown', resume, true);
    removeEventListener('keydown', resume, true);
    if (!audio.enabled) toggleAudio(true);
  };
  addEventListener('pointerdown', resume, true);
  addEventListener('keydown', resume, true);
}
document.addEventListener('visibilitychange', () => {
  if (!settings.sound) return;
  if (document.hidden) audio.toggle(false);
  else if (navigator.userActivation?.hasBeenActive) audio.toggle(true);
});

// ---------------------------------------------------------------------------
// Quick search palette (Ctrl+K or /)
// ---------------------------------------------------------------------------

function paletteItems() {
  const items = [];
  for (const l of world.locations)
    items.push({
      kind: 'Błonia',
      icon: icon[l.id] || '◇',
      label: l.name,
      sub: l.description,
      run: () => goLocation(l.id),
    });
  for (const r of ROOMS)
    items.push({
      kind: r.lesson ? 'Lekcja' : 'Sala',
      icon: r.lesson ? '✎' : '▢',
      label: r.name,
      sub: [r.professor, r.subject, r.category].filter(Boolean).join(' · '),
      keywords: r.lesson?.title,
      run: () => enterRoom(r.id),
    });
  for (const t of TOURS)
    items.push({
      kind: 'Wycieczka',
      icon: '↝',
      label: t.name,
      sub: t.description,
      run: () => startTour(t.id),
    });
  SPELLS.forEach((s, i) => {
    if (hasSpell(s))
      items.push({
        kind: 'Zaklęcie',
        icon: spellSymbols[i],
        label: s.name,
        sub: s.description,
        run: () => castSpell(s),
      });
  });
  items.push(
    ...TIME_STATES.map((s, i) => ({
      kind: 'Pora dnia',
      icon: '◒',
      label: s.name,
      sub: i === timeIndex ? 'teraz' : 'zmień porę dnia',
      run: () => setTime(i),
    })),
    ...WEATHERS.map((w, i) => ({
      kind: 'Pogoda',
      icon: w.icon,
      label: w.name,
      sub: i === weather.index ? 'teraz' : w.id === 'snow' ? 'zima w Hogwarcie' : 'zmień pogodę',
      keywords: w.id === 'snow' ? 'zima snieg boze narodzenie' : w.id === 'rain' ? 'burza ulewa' : 'slonce',
      run: () => setWeather(i),
    })),
    {
      kind: 'Akcja',
      icon: '◇',
      label: mode === 'fly' ? 'Widok z góry' : 'Swobodny lot',
      sub: 'klawisz F',
      run: toggleMode,
    },
    { kind: 'Akcja', icon: '▣', label: 'Zrób zdjęcie', sub: 'klawisz P', run: takePhoto },
    {
      kind: 'Akcja',
      icon: '◐',
      label: 'Tryb kinowy',
      sub: 'ukryj interfejs · klawisz C',
      run: toggleCinematic,
    },
    { kind: 'Akcja', icon: '✦', label: 'Jakość grafiki', sub: QUALITY_LABEL[quality], run: showQuality },
    {
      kind: 'Akcja',
      icon: '♫',
      label: audio.enabled ? 'Wyłącz dźwięki' : 'Włącz dźwięki',
      sub: 'klawisz M',
      run: () => toggleAudio(),
    },
    {
      kind: 'Akcja',
      icon: '⧉',
      label: 'Kopiuj link do tego miejsca',
      sub: 'udostępnij widok',
      run: shareLink,
    },
    {
      kind: 'Akcja',
      icon: '✎',
      label: 'Mój dziennik',
      sub: 'postęp i zaklęcia',
      run: () => openPanel('journal'),
    },
    { kind: 'Akcja', icon: '?', label: 'Sterowanie i skróty', sub: 'pomoc', run: showHelp },
    { kind: 'Akcja', icon: '⌂', label: 'Wybierz dom', sub: progress.house, run: () => $('#house').click() },
  );
  return items;
}
const palette = { items: [], shown: [], active: 0 };
function openPalette() {
  if ($('#modal').open) $('#modal').close();
  keys.clear();
  palette.items = paletteItems();
  $('#palette-input').value = '';
  renderPalette();
  $('#palette').showModal();
  $('#palette-input').focus();
}
function renderPalette() {
  const q = fold($('#palette-input').value.trim());
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const item of palette.items) {
    const name = fold(item.label),
      hay = fold([item.label, item.sub, item.kind, item.keywords].join(' '));
    if (!terms.every(t => hay.includes(t))) continue;
    let score = 0;
    if (q && name.startsWith(q)) score += 3;
    else if (q && name.includes(q)) score += 2;
    if (['Akcja', 'Pora dnia', 'Pogoda'].includes(item.kind)) score -= q ? 0 : 5;
    scored.push([score, item]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  palette.shown = scored.slice(0, 40).map(x => x[1]);
  palette.active = 0;
  $('#palette-list').innerHTML = palette.shown.length
    ? palette.shown
        .map(
          (item, i) =>
            `<button class="palette-item ${i === 0 ? 'active' : ''}" data-index="${i}" role="option" aria-selected="${i === 0}"><span class="palette-icon">${safe(item.icon)}</span><span class="palette-text"><strong>${safe(item.label)}</strong><small>${safe(item.sub || '')}</small></span><em>${safe(item.kind)}</em></button>`,
        )
        .join('')
    : '<p class="empty">Nic nie znaleziono. Spróbuj „eliksir”, „noc” albo „las”.</p>';
}
function movePalette(step) {
  if (!palette.shown.length) return;
  palette.active = (palette.active + step + palette.shown.length) % palette.shown.length;
  $$('.palette-item').forEach((b, i) => {
    b.classList.toggle('active', i === palette.active);
    b.setAttribute('aria-selected', i === palette.active);
  });
  $(`.palette-item[data-index="${palette.active}"]`)?.scrollIntoView({ block: 'nearest' });
}
function runPalette(index = palette.active) {
  const item = palette.shown[index];
  if (!item) return;
  $('#palette').close();
  item.run();
}
$('#palette-input').oninput = renderPalette;
$('#palette-input').onkeydown = e => {
  if (e.key === 'ArrowDown') (e.preventDefault(), movePalette(1));
  else if (e.key === 'ArrowUp') (e.preventDefault(), movePalette(-1));
  else if (e.key === 'Enter') (e.preventDefault(), runPalette());
};
$('#palette-list').onclick = e => {
  const b = e.target.closest('[data-index]');
  if (b) runPalette(Number(b.dataset.index));
};
$('#palette-list').onmousemove = e => {
  const b = e.target.closest('[data-index]');
  if (b && Number(b.dataset.index) !== palette.active) movePalette(Number(b.dataset.index) - palette.active);
};
$('#search-button').onclick = openPalette;

// ---------------------------------------------------------------------------
// Cinematic mode
// ---------------------------------------------------------------------------

function toggleCinematic(force) {
  cinematic = force ?? !cinematic;
  document.body.classList.toggle('cinematic', cinematic);
  if (cinematic) {
    closeDrawer();
    toast('Tryb kinowy · C lub Esc przywraca interfejs', 2600);
  }
}

// ---------------------------------------------------------------------------
// Talking to professors and leaving rooms on foot
// ---------------------------------------------------------------------------

const interaction = { kind: null };
function updateInteraction() {
  let next = null;
  if (room && mode === 'walk' && interior && !anyModalOpen()) {
    const [tx, , tz] = interior.teacherPosition;
    const near = Math.hypot(camera.position.x - tx, camera.position.z - tz) < 4.4;
    const facingDoor = -Math.cos(look.yaw) > 0.45;
    if (room.professor && near) next = 'talk';
    else if (
      camera.position.z > interior.bounds.maxZ - 1.6 &&
      Math.abs(camera.position.x) < 2.6 &&
      facingDoor
    )
      next = 'door';
  }
  if (next === interaction.kind) return;
  interaction.kind = next;
  const el = $('#interact');
  el.hidden = !next;
  if (next === 'talk')
    el.innerHTML = `<kbd>E</kbd> ${room.lesson ? 'Rozpocznij lekcję u' : 'Porozmawiaj z'}: <strong>${safe(room.professor)}</strong>`;
  if (next === 'door') el.innerHTML = '<kbd>E</kbd> Wyjdź na błonia';
}
function interact() {
  if (interaction.kind === 'talk') openConversation(room);
  else if (interaction.kind === 'door') exitRoom();
}
$('#interact').onclick = interact;
const raycaster = new THREE.Raycaster(),
  ndc = new THREE.Vector2();
function pointerRay(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray;
}
/** A click (not a drag) on a professor opens the conversation. */
function clickInRoom(clientX, clientY) {
  if (!room?.professor || !interior?.teacherHeight) return false;
  const [tx, ty, tz] = interior.teacherPosition;
  const ray = pointerRay(clientX, clientY);
  const chest = new THREE.Vector3(tx, ty + interior.teacherHeight * 0.65, tz);
  if (ray.distanceToPoint(chest) < interior.teacherHeight * 0.45 && camera.position.distanceTo(chest) < 26) {
    openConversation(room);
    return true;
  }
  return false;
}
/** Double-click in orbit view: glide towards the clicked point of terrain or castle. */
const focusTargets = world.group.children.filter(o => o.isMesh && !o.isInstancedMesh && !o.isWater);
function focusAt(clientX, clientY) {
  if (room || mode !== 'orbit') return;
  pointerRay(clientX, clientY);
  raycaster.far = 2000;
  const hit = raycaster.intersectObjects(focusTargets, false)[0];
  if (!hit) return;
  autoOrbit = false;
  const offset = camera.position.clone().sub(orbit.target).normalize();
  const radius = clamp(orbit.radius * 0.55, 45, 170);
  transition = {
    start: camera.position.clone(),
    end: hit.point.clone().addScaledVector(offset, radius),
    fromTarget: orbit.target.clone(),
    target: hit.point.clone(),
    elapsed: 0,
    duration: reducedMotion.matches ? 0.01 : 1.6,
  };
  transition.end.y = Math.max(
    transition.end.y,
    (world.groundHeight(transition.end.x, transition.end.z) || 0) + 8,
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  autoOrbit = false;
  transition = null;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), radius: orbit.goal.radius };
    pointer.moved = true;
    return;
  }
  Object.assign(pointer, {
    down: true,
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    lastT: performance.now(),
  });
  orbit.spin.theta = orbit.spin.phi = 0;
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (mode === 'orbit')
      orbit.goal.radius = clamp((pinch.radius * pinch.distance) / Math.max(20, distance), 35, 950);
    return;
  }
  if (!pointer.down) return;
  const dx = e.clientX - pointer.x,
    dy = e.clientY - pointer.y,
    now = performance.now(),
    elapsed = Math.max(8, now - pointer.lastT) / 1000;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.lastT = now;
  if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 5) pointer.moved = true;
  if (mode === 'orbit') {
    const dTheta = -dx * 0.0045,
      dPhi = dy * 0.004;
    orbit.goal.theta += dTheta;
    orbit.goal.phi = clamp(orbit.goal.phi + dPhi, 0.15, 1.48);
    orbit.spin.theta = clamp(dTheta / elapsed, -3, 3);
    orbit.spin.phi = clamp(dPhi / elapsed, -2, 2);
  } else {
    look.yaw -= dx * 0.003;
    look.pitch = clamp(look.pitch - dy * 0.003, -1.3, 1.3);
    orient();
  }
});
function releasePointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 1) {
    // Continue dragging with the finger that stayed on the screen, without a jump.
    const [rest] = pointers.values();
    pointer.x = rest.x;
    pointer.y = rest.y;
    return;
  }
  if (pointers.size > 0) return;
  const wasClick = pointer.down && !pointer.moved;
  pointer.down = false;
  if (performance.now() - pointer.lastT > 90) orbit.spin.theta = orbit.spin.phi = 0;
  if (wasClick && e.type === 'pointerup' && room) clickInRoom(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('dblclick', e => focusAt(e.clientX, e.clientY));
canvas.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    autoOrbit = false;
    transition = null;
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    if (mode === 'orbit') orbit.goal.radius = clamp(orbit.goal.radius * Math.exp(delta * 0.0011), 35, 950);
    else if (mode === 'fly') {
      const d = new THREE.Vector3();
      camera.getWorldDirection(d);
      velocity.addScaledVector(d, -delta * 0.08);
    } else {
      camera.fov = clamp(camera.fov + delta * 0.02, 32, 70);
      camera.updateProjectionMatrix();
    }
  },
  { passive: false },
);
const MOVE_KEYS = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
];
addEventListener('keydown', e => {
  const typing = e.target.matches('input,textarea,[contenteditable]');
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
    e.preventDefault();
    if ($('#palette').open) $('#palette').close();
    else openPalette();
    return;
  }
  if (typing || anyModalOpen()) return;
  if (e.key === '/') {
    e.preventDefault();
    openPalette();
    return;
  }
  if (e.code === 'Escape') {
    if (cinematic) toggleCinematic(false);
    else closeDrawer();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (MOVE_KEYS.includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyE' && room && interaction.kind) {
    interact();
    return;
  }
  if (e.code === 'KeyF') toggleMode();
  if (e.code === 'KeyC') toggleCinematic();
  if (e.code === 'KeyT') setTime(timeIndex + 1);
  if (e.code === 'KeyO') setWeather(weather.index + 1);
  if (e.code === 'KeyP') takePhoto();
  if (e.code === 'KeyM') toggleAudio();
  if (/^Digit[1-8]$/.test(e.code)) castSpell(SPELLS[Number(e.code.slice(-1)) - 1]);
  keys.add(e.code);
  if (mode === 'orbit' && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) toggleMode();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  pointers.clear();
  pointer.down = false;
  pinch = null;
});
$$('[data-move]').forEach(b => {
  b.onpointerdown = e => {
    keys.add(b.dataset.move);
    b.setPointerCapture(e.pointerId);
  };
  b.onpointerup = () => keys.delete(b.dataset.move);
  b.onpointercancel = () => keys.delete(b.dataset.move);
});

// ---------------------------------------------------------------------------
// Movement with gentle acceleration
// ---------------------------------------------------------------------------

const wish = new THREE.Vector3(),
  forward = new THREE.Vector3(),
  right = new THREE.Vector3();
function blocked(x, z) {
  return (interior?.colliders || []).some(
    c => Math.abs(x - c.x) < c.w / 2 + 0.35 && Math.abs(z - c.z) < c.d / 2 + 0.35,
  );
}
function updateMovement(dt, t) {
  if (mode === 'orbit' || anyModalOpen()) {
    velocity.multiplyScalar(0);
    return;
  }
  const walk = mode === 'walk';
  const dx =
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    dz =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
    dy = walk ? 0 : (keys.has('KeyE') || keys.has('Space') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.5 : 1;
  const maxSpeed = (walk ? 6.5 : 42) * boost;
  // In flight, W follows the gaze (including pitch); on foot it stays level.
  const pitch = walk ? 0 : look.pitch;
  forward.set(-Math.sin(look.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(look.yaw) * Math.cos(pitch));
  right.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
  wish.set(0, 0, 0).addScaledVector(right, dx).addScaledVector(forward, dz);
  wish.y += dy;
  if (wish.lengthSq() > 1) wish.normalize();
  wish.multiplyScalar(maxSpeed);
  velocity.lerp(wish, damp(walk ? 11 : 3.4, dt));
  if (velocity.lengthSq() < 1e-5) velocity.set(0, 0, 0);
  const step = velocity.clone().multiplyScalar(dt);
  if (walk) {
    if (!blocked(camera.position.x + step.x, camera.position.z)) camera.position.x += step.x;
    else velocity.x = 0;
    if (!blocked(camera.position.x, camera.position.z + step.z)) camera.position.z += step.z;
    else velocity.z = 0;
    const b = interior.bounds;
    camera.position.x = clamp(camera.position.x, b.minX + 0.8, b.maxX - 0.8);
    camera.position.z = clamp(camera.position.z, b.minZ + 0.8, b.maxZ - 0.8);
    const speed = Math.hypot(velocity.x, velocity.z);
    camera.position.y = (interior.spawn[1] || 2.4) + Math.sin(t * 9) * 0.045 * Math.min(1, speed / 6);
    stepDistance += speed * dt;
    if (stepDistance > 1.7) {
      stepDistance = 0;
      audio.step();
    }
  } else {
    camera.position.add(step);
    camera.position.x = clamp(camera.position.x, -650, 650);
    camera.position.z = clamp(camera.position.z, -600, 650);
    const ground = world.groundHeight?.(camera.position.x, camera.position.z) || 0;
    camera.position.y = clamp(camera.position.y, Math.max(ground + 3, 4), 600);
  }
  wandKick = Math.max(0, wandKick - dt * 4);
  wand.position.y = -0.42 + Math.sin(t * 2) * 0.008 - Math.min(1, velocity.length() / 40) * 0.02;
  wand.rotation.z = -0.3 - Math.sin(wandKick * Math.PI) * 0.4;
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------

const project = new THREE.Vector3();
let frame = 0,
  elapsed = 0;
function updateMarkers() {
  if (room) return;
  const introRect = !$('#intro').hidden ? $('#intro').getBoundingClientRect() : null;
  for (const m of markers) {
    project.copy(m.point);
    project.y += 8;
    const distance = camera.position.distanceTo(project);
    project.project(camera);
    const x = (project.x * 0.5 + 0.5) * innerWidth,
      y = (-project.y * 0.5 + 0.5) * innerHeight;
    const underIntro =
      introRect && x < introRect.right + 24 && y > introRect.top - 20 && y < introRect.bottom + 20;
    const visible =
      project.z < 1 &&
      x > 40 &&
      x < innerWidth - 40 &&
      y > 125 &&
      y < innerHeight - 200 &&
      !activePanel &&
      !cinematic &&
      !underIntro;
    m.button.hidden = !visible;
    if (visible) {
      m.button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      m.button.style.opacity = clamp(1.25 - distance / 750, 0.5, 1).toFixed(2);
      m.button.classList.toggle('current', m.loc.id === selected);
    }
  }
  const compassDeg =
    (Math.atan2(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z) * 180) / Math.PI;
  $('.compass svg').style.transform =
    `rotate(${mode === 'orbit' ? compassDeg : (look.yaw * 180) / Math.PI}deg)`;
}
function animate() {
  requestAnimationFrame(animate);
  const raw = clock.getDelta(),
    dt = Math.min(raw, 0.05);
  elapsed += dt;
  frame++;
  perf.sample(raw);
  updateTime(dt);
  updateWeather(dt);
  if (lookDirty) applyNow();
  if (transition) {
    transition.elapsed += dt;
    const p = clamp(transition.elapsed / transition.duration, 0, 1),
      ease = easeInOut(p);
    camera.position.lerpVectors(transition.start, transition.end, ease);
    orbit.target.lerpVectors(transition.fromTarget, transition.target, ease);
    camera.lookAt(orbit.target);
    if (p === 1) {
      setOrbitFromPosition(camera.position.clone(), transition.target);
      transition = null;
    }
  } else if (mode === 'orbit') {
    const goal = orbit.goal;
    if (cinematic && !pointer.down) goal.theta += dt * 0.035;
    else if (autoOrbit && !reducedMotion.matches && !activePanel)
      goal.theta = 0.643 + Math.sin(elapsed * 0.025) * 0.15;
    if (!pointer.down && (orbit.spin.theta || orbit.spin.phi)) {
      goal.theta += orbit.spin.theta * dt;
      goal.phi = clamp(goal.phi + orbit.spin.phi * dt, 0.15, 1.48);
      const decay = Math.exp(-dt * 3.2);
      orbit.spin.theta = Math.abs(orbit.spin.theta * decay) < 1e-3 ? 0 : orbit.spin.theta * decay;
      orbit.spin.phi = Math.abs(orbit.spin.phi * decay) < 1e-3 ? 0 : orbit.spin.phi * decay;
    }
    const k = damp(reducedMotion.matches ? 60 : 10, dt);
    orbit.theta += (goal.theta - orbit.theta) * k;
    orbit.phi += (goal.phi - orbit.phi) * k;
    orbit.radius += (goal.radius - orbit.radius) * damp(reducedMotion.matches ? 60 : 7, dt);
    camera.position.set(
      orbit.target.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
    );
    // Never let the orbit dip below the hills.
    const ground = world.groundHeight(camera.position.x, camera.position.z) + 4;
    if (camera.position.y < ground) camera.position.y = ground;
    camera.lookAt(orbit.target);
  }
  updateMovement(dt, elapsed);
  if (interior) interior.update?.(elapsed);
  else {
    world.update?.(elapsed);
    life.update(elapsed, dt);
  }
  wand.visible = mode !== 'orbit';
  magic.update(dt, elapsed);
  environment.update(dt);
  sky.update(elapsed);
  stars.update(elapsed, camera);
  if (frame % 3 === 0) {
    updateMarkers();
    updateInteraction();
  }
  if (frame % 10 === 0 && activePanel === 'explore') updateMapYou();
  graphics.render(dt);
  if (!loading.firstFrame) {
    loading.firstFrame = true;
    maybeHideLoader();
  }
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  graphics.resize(innerWidth, innerHeight);
});
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  toast('Utracono połączenie z grafiką. Odśwież stronę, aby wrócić do świata.', 12000);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

applyQuality(quality);
setWeather(weather.index, { announce: false, instant: true });
setTime(timeIndex, { announce: false, instant: true });
visit('castle');
renderSpells();
updateMode();
if (location.hash) route();
showLoadProgress();
animate();
// Exposed for debugging in the console: atlas.quality, atlas.setTime(1)…
window.atlas = {
  get quality() {
    return quality;
  },
  setQuality: q => applyQuality(q, { manual: true }),
  setTime: (i, instant = false) => setTime(i, { announce: false, instant }),
  setWeather: (i, instant = false) => setWeather(i, { announce: false, instant }),
  goLocation,
  enterRoom,
  exitRoom,
  renderer,
  camera,
  /** Debug helper: turn the walking camera, e.g. atlas.look(0, 0.6) to see the ceiling. */
  look(yaw = look.yaw, pitch = look.pitch) {
    look.yaw = yaw;
    look.pitch = pitch;
    orient();
  },
};
