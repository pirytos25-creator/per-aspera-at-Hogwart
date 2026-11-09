import * as T from "../assets/three.module.js";
import { createWorld } from "./world.js";
import { createInterior } from "./interiors.js";
import { createGraphics, createSky } from "./graphics.js";
import { enhanceEnvironment } from "./environment.js";
import { createAtmosphere } from "./atmosphere.js";
import { ROOMS } from "./data.js";
import { ACTIVITIES, openRoomActivity, createRoomActivityProps } from "./room-activities.js";
import { createRoomIdentity } from "./room-identity.js";
import { createActor, createDummy, labelSprite, setActorCamera, setActorQuality, setActorRim, ACTOR_LAYER } from "./actors.js";
import { createCameraRig } from "./camera-rig.js";
import { createDuels, DUELISTS } from "./duel.js";
import { createCastle, CASTLE_ROOMS, FLOORS } from "./castle.js";
import { createCastleLife } from "./castle-life.js";
import { createLessons, PATTERNS, SPELL_PATTERN } from "./lessons.js";
import { createCharacterShadows } from "./char-shadows.js";
import { batchStatic } from "./batch.js";
import { createEffects, createAudio } from "./effects.js";
import {
  SAVE_KEY,
  HOUSES,
  ABILITIES,
  QUESTS,
  hydrate,
  newState,
  level,
  points,
  stats,
  unlocked,
  upgrade,
  advance,
  record,
  collect,
  brew,
  usePotion,
  moveCircle,
  segmentBlocked,
  finishRoom,
  ROOM_REWARD,
} from "./state.js";

const $ = (q) => document.querySelector(q),
  $$ = (q) => [...document.querySelectorAll(q)],
  safe = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let state;
try {
  state = hydrate(JSON.parse(localStorage.getItem(SAVE_KEY) || "null"));
} catch {
  state = newState();
}
let saveTimer, toastTimer, chapterTimer;
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3300);
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    $("#save-indicator").classList.add("visible");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => $("#save-indicator").classList.remove("visible"), 1800);
  } catch {
    toast("Zapis jest niedostępny. Postęp pozostaje w tej sesji.");
  }
}
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
} catch (e) {
  $("#loading").innerHTML = "<p>Przeglądarka nie udostępnia WebGL.</p><small>Włącz akcelerację sprzętową, aby uruchomić grę.</small>";
  throw e;
}
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
$("#viewport").append(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color("#8badaf");
scene.fog = new T.FogExp2("#839d9b", 0.0018);
const camera = new T.PerspectiveCamera(57, innerWidth / innerHeight, 0.12, 1900);
camera.position.set(130, 85, 170);
camera.lookAt(0, 44, 0);
const hemi = new T.HemisphereLight("#c3dce1", "#4a4a3a", 2.4),
  sun = new T.DirectionalLight("#ffdda9", 3.6),
  fill = new T.DirectionalLight("#93bcd7", 1);
sun.position.set(-100, 170, 90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 450 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.2;
fill.position.set(90, 80, -100);
scene.add(hemi, sun, fill);
// The sun's shadow map is rendered once per place. Characters live on their own layer, so it never
// captures them (no shadow left behind where someone stood); they get live shadows of their own.
const charShadows = createCharacterShadows(renderer, scene);
function refreshShadows() {
  renderer.shadowMap.needsUpdate = true;
}
const charDir = new T.Vector3();
function updateCharShadows() {
  const inside = !!room || zone === "castle";
  // indoors the light falls from the candles and lanterns overhead; outdoors from the sun
  if (inside) charDir.set(0.55, 1, 0.38).normalize();
  else charDir.copy(sun.position).normalize();
  const outdoors = ["grounds", "forest", "hogsmeade"].includes(zone);
  charShadows.update(playerPos, charDir, floorAt(), {
    active: playing && player.root.visible,
    strength: inside ? 0.6 : timeMode === 1 ? 0.32 : 0.55,
    ground: outdoors ? (x, z) => Math.max(world.groundHeight(x, z), 1) : null,
    every: quality === "ultra" ? 1 : 2,
  });
}
const world = createWorld();
scene.add(world.group);
const sky = createSky(scene),
  environment = enhanceEnvironment(world, renderer),
  graphics = createGraphics(renderer, scene, camera),
  effects = createEffects(scene, (a, b) =>
    segmentBlocked(a, b, getColliders(), room ? 0 : zone === "courtyard" ? 26.4 : height(a.x, a.z), !!room || zone === "castle"),
  ),
  audio = createAudio();
scene.environment = sky.createEnvironment(renderer);
scene.environmentIntensity = 0.38;
let quality = state.quality;
graphics.setQuality(quality);
environment.setQuality(quality);
refreshShadows();
const atmosphere = createAtmosphere(scene, world, renderer);
const rig = createCameraRig(camera, graphics);
setActorCamera(camera);
setActorQuality(state.quality);
const player = createActor({ color: HOUSES[state.house].color, ...(state.look || {}) });
scene.add(player.root);
player.root.visible = false;
function surfaceAt(p) {
  if (zone === "castle") return castle?.surfaceAt?.(p) || "stone";
  if (room) return ["potions", "astronomy", "owlery"].includes(ROOMS.find((r) => r.id === roomId)?.type) ? "stone" : "wood";
  if (zone === "courtyard") return "stone";
  return p.x > 205 && p.z < -120 ? "stone" : "grass";
}
player.onStep = (side, speed) => audio.footstep?.(surfaceAt(playerPos), speed, null, camera);
const playerPos = new T.Vector3(29, 26.4, 38),
  velocity = new T.Vector3();
const lumos = new T.PointLight("#ffe2a4", 0, 14, 2);
let flash = 0,
  flashColor = new T.Color("#ffe2a4");
scene.add(lumos);
let playing = false,
  zone = "courtyard",
  room = null,
  roomId = null,
  zoneGroup = new T.Group(),
  entities = [],
  actors = [],
  owned = [],
  nearby = null,
  target = null,
  dialogueNpc = null,
  transitioning = false,
  elapsed = 0,
  shieldUntil = 0,
  dodgeUntil = 0,
  dodgeCooldown = 0,
  lumosUntil = 0,
  castUntil = 0,
  guideUntil = 0,
  lastCombat = -100,
  health = stats(state).health,
  mana = stats(state).mana,
  selected = 0,
  timeMode = 0,
  downUntil = 0,
  shieldHeld = false,
  combatFocus = null;
const pending = [];
let castle = null;
function castleFloor(p, y = playerPos.y) {
  return castle ? castle.floorAt(p.x, p.z, y) : 0;
}
let duelHit = () => {};
const CELL_NAMES = { entrance: "Sala Wejściowa", exit: "Sala Wejściowa", tower: "Wielkie Schody", stairsD: "Schody do lochów", D: "Lochy", F1: "Pierwsze piętro", F2: "Drugie piętro", F3: "Trzecie piętro" };
let life = null,
  roomBatch = null;
function buildCastle() {
  const c = createCastle({ ROOMS, createInterior, createRoomIdentity, createRoomActivityProps });
  c.onRoomLoaded = (slot) => populateCastleRoom(slot);
  c.onRoomUnloaded = (slot) => clearCastleRoom(slot);
  life = createCastleLife({ castle: c, scene, createActor, labelSprite, bark, effects, audio });
  for (const e of life.people) e.actor.onStep = (side, speed) => audio.footstep?.(c.surfaceAt(e.actor.root.position), speed * 0.7, e.actor.root.position, camera);
  return c;
}
const castleBand = (y) => (y < -3.5 ? "D" : y < 4 ? "G" : y < 12 ? "F1" : y < 20 ? "F2" : "F3");
function professorOptions(id, info) {
  const teacher = id === "charms" ? "flitwick" : id === "potions" ? "snape" : id === "great-hall" ? "dumbledore" : "teacher";
  const opts =
    teacher === "flitwick"
      ? { color: "#ac9a7b", scale: 0.85, beard: true, hair: "#c0b8aa", style: "short" }
      : teacher === "snape"
        ? { color: "#444b49", robe: "#182024", hair: "#171819", style: "long", skin: "#d2b39b" }
        : {
            color: info.color || "#b59a6a",
            hat: teacher === "dumbledore",
            beard: teacher === "dumbledore",
            hair: "#b6b3a7",
            style: teacher === "dumbledore" ? "long" : "short",
            eyes: teacher === "dumbledore" ? "#4d6d8c" : "#4b3a28",
          };
  return { teacher, opts };
}
// professors, practice stations and quest props appear with their classroom
function populateCastleRoom(slot) {
  const info = slot.loaded.info,
    W = slot.loaded.toWorld,
    before = entities.length,
    ownedBefore = owned.length;
  const at = (lx, lz) => W(lx, lz);
  // the room may load while you are still on the stairs: its people and props belong on its own floor
  placeY = slot.y;
  try {
    fillCastleRoom(slot, info, at);
  } finally {
    placeY = null;
  }
  for (const e of entities.slice(before)) e.slotRoom = slot.id;
  slot.owned = owned.slice(ownedBefore);
}
function fillCastleRoom(slot, info, at) {
  if (info.professor) {
    const { teacher, opts } = professorOptions(slot.id, info);
    const tp = slot.loaded.room.teacherPosition || [0, 0, -10];
    const [x, z] = at(tp[0], tp[2]);
    const n = npc(teacher, info.professor, x, z, opts);
    n.actor.root.rotation.y = slot.ry;
    n.slotRoom = slot.id;
  }
  const [px, pz] = at(8.6, 15);
  const station = door("practice-" + slot.id, ACTIVITIES[slot.id]?.title || "Ćwiczenie", px, pz, showCurrentActivity);
  station.kind = "ĆWICZENIE";
  if (slot.id === "charms") for (const [id, lx, lz] of [["stone-a", -9, 11], ["stone-b", 0, 6], ["stone-c", 9, 11]]) stone(id, ...at(lx, lz));
  if (slot.id === "potions")
    door("brew", "Uwarz eliksir zdrowia", ...at(-10, 12), () => {
      if (brew(state)) {
        save();
        refreshHUD();
        toast("Eliksir gotowy. Odzyskuje 65 punktów zdrowia.");
        effects.sparks(playerPos, "#99d6a0");
      } else toast("Potrzebujesz 3 liści dittany. Znajdziesz je na błoniach.");
    });
  if (slot.id === "library") {
    pickup("library-chest", "chest", ...at(-10, 13));
    const [lx, lz] = at(0, -11.5);
    const agata = npc("agata", "Agata Sowińska · pomocnica w bibliotece", lx, lz, { color: "#6d5a8a", robe: "#2a2733", hair: "#b9b4ab", style: "bun", hat: true, face: { old: 0.9, soft: 0.6, nose: 0.3 }, scale: 0.96, mood: "stern" });
    agata.actor.root.rotation.y = slot.ry;
    agata.actor.read(true);
  }
}
function clearCastleRoom(slot) {
  const gone = entities.filter((e) => e.slotRoom === slot.id);
  for (const e of gone) {
    if (e.actor) {
      e.actor.dispose();
      e.actor.root.traverse((o) => {
        if (o.isSprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      zoneGroup.remove(e.actor.root);
      actors = actors.filter((a) => a !== e);
    }
    if (e.mesh?.userData.label) zoneGroup.remove(e.mesh.userData.label);
    if (dialogueNpc === e) closeDialogue();
  }
  for (const o of slot.owned || []) {
    zoneGroup.remove(o);
    o.geometry?.dispose();
    if (o.isSprite) o.material.map?.dispose();
    o.material?.dispose?.();
  }
  owned = owned.filter((o) => !(slot.owned || []).includes(o));
  entities = entities.filter((e) => e.slotRoom !== slot.id);
  if (nearby && nearby.slotRoom === slot.id) nearby = null;
  if (target && target.slotRoom === slot.id) target = null;
}
const bannerEl = document.createElement("div"),
  barkEl = document.createElement("div");
bannerEl.id = "banner";
barkEl.id = "bark";
document.body.append(bannerEl, barkEl);
let bannerTimer, barkTimer;
function banner(text, ms = 1200) {
  bannerEl.textContent = text;
  bannerEl.classList.remove("visible");
  void bannerEl.offsetWidth;
  bannerEl.classList.add("visible");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => bannerEl.classList.remove("visible"), ms);
}
// short spoken lines outside conversations (with lip sync)
function bark(actor, name, text) {
  barkEl.innerHTML = `<b>${safe(name)}</b> ${safe(text)}`;
  barkEl.classList.add("visible");
  const seconds = actor?.say?.(text) || 2;
  clearTimeout(barkTimer);
  barkTimer = setTimeout(() => barkEl.classList.remove("visible"), 1200 + seconds * 1000);
}
const ARENA = { center: new T.Vector3(23, 26.4, 20.6), axis: new T.Vector3(1, 0, 0), half: 7.5, width: 3.6 };
const lessons = createLessons({ scene, audio, camera });
const duels = createDuels({
  scene,
  effects,
  audio,
  rig,
  player,
  playerPos,
  playerVelocity: velocity,
  createActor,
  toast,
  banner,
  say: bark,
  flash: (c) => 0,
  floor: (p) => floorAt(p),
  addEntity: (e) => entities.push(e),
  removeEntity: (e) => {
    entities = entities.filter((x) => x !== e);
    if (target === e) target = null;
  },
  onFinish: (won, def) => {
    const id = Object.keys(DUELISTS).find((k) => DUELISTS[k] === def);
    const master = entities.find((x) => x.id === "wrzos");
    if (master) {
      master.hidden = false;
      master.actor.root.visible = true;
    }
    if (won) {
      const first = !state.duels[id];
      state.duels[id] = (state.duels[id] || 0) + 1;
      const before = level(state);
      state.xp += first ? def.reward.xp : Math.round(def.reward.xp / 4);
      state.coins += first ? def.reward.coins : 5;
      toast(`Wygrany pojedynek: ${def.name}. +${first ? def.reward.xp : Math.round(def.reward.xp / 4)} PD`);
      if (level(state) > before) toast("Nowy poziom! W dzienniku czeka punkt talentu.");
    } else {
      health = Math.max(health, stats(state).health * 0.5);
      downUntil = elapsed + (player.getUp() || 1.4);
    }
    save();
    refreshHUD();
  },
});
duelHit = () => {};
function startDuel(id) {
  closeDialogue();
  if (!duels.start(id, ARENA)) return;
  if (id === "wrzos") {
    const master = entities.find((x) => x.id === "wrzos");
    if (master) {
      master.hidden = true;
      master.actor.root.visible = false;
    }
  }
  health = stats(state).health;
  mana = stats(state).mana;
  downUntil = elapsed + 4.6;
  lastCombat = elapsed;
}
let roomIdentity = null,
  activityProps = null,
  activeActivity = null;
function disposeActivity() {
  activeActivity?.dispose();
  activeActivity = null;
}
scene.add(zoneGroup);
const keys = new Set(),
  cooldowns = new Map(),
  look = { yaw: 0.25, pitch: 0.19, distance: 6.2 };
let dragging = false,
  pointerId = null,
  lastPointer = { x: 0, y: 0 },

  interactCooldown = 0;
const questMarker = document.createElement("div");
questMarker.className = "world-label";
$("#world-labels").append(questMarker);
const guideGeo = new T.BufferGeometry(),
  guideArray = new Float32Array(45 * 3);
guideGeo.setAttribute("position", new T.BufferAttribute(guideArray, 3));
const guideMesh = new T.Points(
  guideGeo,
  new T.PointsMaterial({ color: "#f0cf82", size: 0.15, transparent: true, opacity: 0.75, depthWrite: false }),
);
guideMesh.frustumCulled = false;
scene.add(guideMesh);
guideMesh.visible = false;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z),
  clamp = T.MathUtils.clamp,
  damp = (a, b, rate, dt) => T.MathUtils.lerp(a, b, 1 - Math.exp(-rate * dt));
let placeY = null; // floor level for things being placed in a castle room
function height(x, z) {
  return zone === "courtyard" ? 26.4 : room ? 0 : zone === "castle" ? (placeY ?? castle.floorAt(x, z, playerPos.y)) : Math.max(world.groundHeight(x, z), 1);
}
function position(x, z, y = 0) {
  return V(x, height(x, z) + y, z);
}
function own(object) {
  zoneGroup.add(object);
  owned.push(object);
  return object;
}
function marker(pos, color = "#e5c98e", radius = 0.6) {
  const m = new T.Mesh(
    new T.TorusGeometry(radius, 0.025, 6, 48),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.copy(pos).y += 0.05;
  return own(m);
}
function npc(id, name, x, z, options = {}, route = null) {
  const actor = createActor(options);
  actor.root.position.copy(position(x, z));
  zoneGroup.add(actor.root);
  const label = labelSprite(name);
  label.position.y = 2.65 / (options.scale || 1);
  actor.root.add(label);
  const entity = { id, type: "npc", name, pos: actor.root.position, actor, route, waypoint: 0, pause: 1 + Math.random() * 2, speed: 0, mood: options.mood };
  actor.onStep = (side, speed) => audio.footstep?.(surfaceAt(actor.root.position), speed * 0.7, actor.root.position, camera);
  actors.push(entity);
  entities.push(entity);
  return entity;
}
function door(id, name, x, z, action) {
  const pos = position(x, z);
  const ring = marker(pos, "#cdb17a", 0.8);
  const e = { id, type: "door", name, pos, action, mesh: ring };
  entities.push(e);
  const label = labelSprite(name);
  label.position.copy(pos).y += 2.1;
  label.visible = false;
  ring.userData.label = label;
  own(label);
  return e;
}
function pickup(id, type, x, z) {
  if (state.collected.includes(id)) return;
  const pos = position(x, z, 0.6),
    mat = new T.MeshStandardMaterial({
      color: type === "herb" ? "#88a36c" : "#bfa46b",
      emissive: type === "herb" ? "#304c28" : "#634f1e",
      emissiveIntensity: 0.4,
      roughness: 0.65,
      metalness: 0.3,
    });
  let mesh;
  if (type === "herb") {
    mesh = new T.Mesh(new T.OctahedronGeometry(0.35), mat);
    mesh.scale.set(0.6, 1.5, 0.6);
  } else {
    mesh = new T.Mesh(new T.BoxGeometry(0.75, 0.5, 0.5), mat);
  }
  mesh.position.copy(pos);
  own(mesh);
  entities.push({ id, type, name: type === "herb" ? "Dittany · składnik eliksiru" : "Skrzynka z galeonami", pos, mesh, baseY: pos.y });
}
function enemy(id, name, x, z, boss = false) {
  if (state.defeated.includes(id)) return;
  const d = createDummy(boss);
  d.root.position.copy(position(x, z));
  zoneGroup.add(d.root);
  const e = {
    id,
    type: "enemy",
    name,
    pos: d.root.position,
    model: d,
    hp: boss ? 230 : 66,
    maxHp: boss ? 230 : 66,
    boss,
    attack: 2 + Math.random() * 2,
    stunned: 0,
    baseY: d.root.position.y,
    hit: 0,
  };
  entities.push(e);
  return e;
}
function stone(id, x, z) {
  const pos = position(x, z, 0.7),
    mesh = new T.Mesh(
      new T.IcosahedronGeometry(0.38, 1),
      new T.MeshStandardMaterial({
        color: "#7c8795",
        roughness: 0.5,
        metalness: 0.4,
        emissive: state.levitated.includes(id) ? "#6a4c8c" : "#171a28",
        emissiveIntensity: 0.55,
      }),
    );
  mesh.position.copy(pos);
  own(mesh);
  marker(position(x, z), "#a592d0", 0.65);
  entities.push({ id, type: "stone", name: "Runiczny kamień", pos: mesh.position, mesh, baseY: pos.y, stunned: 0 });
}
function rune(id, x, z) {
  const done = state.runes.includes(id),
    pos = position(x, z, 1.1);
  const mesh = new T.Mesh(
    new T.OctahedronGeometry(0.65),
    new T.MeshStandardMaterial({
      color: "#788687",
      emissive: done ? "#e7bf71" : "#573e7a",
      emissiveIntensity: done ? 1.2 : 0.45,
      metalness: 0.3,
      roughness: 0.6,
    }),
  );
  mesh.position.copy(pos);
  own(mesh);
  marker(position(x, z), done ? "#dfc17e" : "#9b7cc1", 1.1);
  entities.push({ id, type: "rune", name: done ? "Przebudzona runa" : "Uśpiona runa", pos: mesh.position, mesh, baseY: pos.y });
}
function secretPassage(t) {
  const to = castle.passage.find((x) => x.id === t.to);
  const first = record(state, "found", "passage");
  $("#fade").style.opacity = "1";
  setTimeout(() => {
    playerPos.copy(to.pos).add(V(Math.sin(to.ry) * 1.2, 0, Math.cos(to.ry) * 1.2));
    player.root.position.copy(playerPos);
    look.yaw = to.ry;
    rig.snap(playerPos.clone().add(V(0, 1.5, 0)));
    $("#fade").style.opacity = "0";
    if (first) {
      for (const e of entities)
        if (castle.passage.some((x) => x.id === e.id)) {
          e.kind = "SEKRETNE PRZEJŚCIE";
          e.name = "Przejście za gobelinem";
        }
      state.xp += 40;
      toast("Odkryto sekretne przejście za gobelinem! +40 PD");
      save();
      refreshHUD();
    }
  }, 300);
}
function clearZone() {
  duels.abort();
  if (zone === "castle") {
    castle?.unloadAll();
    life?.setActive(null);
  }
  disposeActivity();
  roomIdentity?.dispose();
  activityProps?.dispose();
  roomBatch?.dispose();
  roomBatch = null;
  roomIdentity = null;
  activityProps = null;
  effects.clear();
  for (const a of actors) {
    if (a.life) continue;
    a.actor.dispose();
    a.actor.root.traverse((o) => {
      if (o.isSprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
  for (const o of owned) {
    o.geometry?.dispose();
    if (o.isSprite) o.material.map?.dispose();
    o.material?.dispose();
  }
  for (const e of entities.filter((e) => e.type === "enemy")) {
    e.model.dispose?.();
  }
  scene.remove(zoneGroup);
  zoneGroup = new T.Group();
  scene.add(zoneGroup);
  entities = [];
  actors = [];
  owned = [];
  nearby = null;
  target = null;
}
function populate() {
  if (zone === "courtyard") {
    npc("minerva", "Minerva McGonagall", 29, 35, {
      color: "#baaa70",
      robe: "#25473d",
      hat: true,
      hair: "#88877b",
      style: "bun",
      eyes: "#4f5f3a",
    });
    npc("nora", "Nora · Ravenclaw", 14, 37, { color: "#547da9", skin: "#a6795c", style: "long", hair: "#2a1d17" }, [
      [14, 37],
      [14, 19],
      [31, 19],
      [31, 39],
    ]);
    npc("felix", "Feliks · Hufflepuff", 31, 28, { color: "#c9a34f", hair: "#957044", style: "short", eyes: "#3f5a72" }, [
      [31, 28],
      [31, 39],
      [14, 39],
      [14, 20],
    ]);
    npc("ada", "Ada · Gryffindor", 20, 39, { color: "#a64a43", skin: "#78523f", style: "long", hair: "#1e1714" }, [
      [20, 39],
      [14, 39],
      [14, 19],
      [31, 19],
      [31, 39],
    ]);
    npc("wrzos", "Bartłomiej Wrzos", 13.6, 18.4, { color: "#8a3f36", robe: "#2b2421", hair: "#4b4038", beard: true, face: { old: 0.45, broad: 0.6 }, build: 1.12, scale: 1.05, mood: "stern" });
    door("charms-door", "Sala zaklęć · zamek", 12.1, 31, () => travel("castle", "charms"));
    door("hall-door", "Sala Wejściowa · zamek", 23, 16.6, () => travel("castle", "entrance"));
    door("potions-door", "Lochy eliksirów · zamek", 33, 32, () => travel("castle", "potions"));
    door("grounds-door", "Brama na błonia", 29, 41.5, () => travel("grounds"));
    for (const [i, x, z] of [
      [0, 15, 23],
      [1, 23, 20],
      [2, 31, 23],
    ])
      enemy("dummy-" + i, "Manekin treningowy", x, z);
    pickup("courtyard-chest", "chest", 15, 35);
  } else if (zone === "castle") {
    // classroom doors: quest targets and signs; rooms themselves stream in with their props
    for (const slot of castle.slots) {
      const info = ROOMS.find((r) => r.id === slot.id);
      if (!info) continue;
      const pos = slot.door.clone();
      const e = { id: slot.id === "charms" ? "charms-door" : slot.id + "-door", type: "door", name: info.name, pos, action: () => toast("Wejdź do środka: " + info.name), hidden: true, castleDoor: true };
      entities.push(e);
      const sign = labelSprite(info.name);
      sign.position.copy(pos).y += 4.6;
      sign.userData.castleSign = slot;
      own(sign);
    }
    const placeAt = (e, y) => {
      e.pos.y = y;
      e.mesh.position.y = y + 0.05;
      e.mesh.userData.label.position.y = y + 2.1;
    };
    placeAt(door("exit", "Wyjście na dziedziniec", 0, 42.6, () => travel("courtyard", "castle")), FLOORS.G);
    placeAt(door("astronomy-door", "Schody na Wieżę Astronomiczną", castle.towerDoor.x + 1.2, castle.towerDoor.z, () => travel("astronomy-class")), FLOORS.F3);
    npc("hall-ada", "Ada · Gryffindor", 6.5, 33, { color: "#a64a43", skin: "#6e4a37", style: "pony", hair: "#120d0b", eyes: "#2e1f15", face: { soft: 0.8 } }, [
      [6.5, 33],
      [6.5, 20],
      [-6, 20],
      [-6, 33],
    ]);
    npc("hall-tymon", "Tymon · Slytherin", -7.5, 37, { color: "#508e78", skin: "#d9b79a", style: "curly", hair: "#1b1512", eyes: "#56603a", face: { nose: 0.5 } });
    for (const n of actors) if (n.id.startsWith("hall-")) n.pos.y = FLOORS.G;
    for (const e of life.entities()) {
      entities.push(e);
      if (e.actor) actors.push(e);
    }
    // field guide pages and the tapestry passage
    for (const pg of castle.pages) {
      pg.mesh.visible = !state.found.includes(pg.id);
      if (!state.found.includes(pg.id)) entities.push({ id: pg.id, type: "page", name: "Strona przewodnika · " + pg.place, pos: pg.pos, page: pg });
    }
    for (const t of castle.passage) entities.push({ id: t.id, type: "door", kind: state.found.includes("passage") ? "SEKRETNE PRZEJŚCIE" : "GOBELIN", name: state.found.includes("passage") ? "Przejście za gobelinem" : "Stary gobelin", pos: t.pos.clone(), action: () => secretPassage(t) });
  } else if (room) {
    const info = ROOMS.find((r) => r.id === roomId);
    if (info.professor) {
      const { teacher, opts } = professorOptions(roomId, info);
      const tp = room.teacherPosition || [0, 0, -10];
      npc(teacher, info.professor, tp[0], tp[2], opts);
    }
    door("exit", "Powrót na dziedziniec", 0, 15.7, () => travel("courtyard"));
    door("school", "Korytarze szkoły", 11.5, 13, showRooms);
    const station = door("practice", ACTIVITIES[roomId].title, 8.6, 15, showCurrentActivity);
    station.kind = "ĆWICZENIE";
    if (roomId === "charms") {
      stone("stone-a", -9, 11);
      stone("stone-b", 0, 6);
      stone("stone-c", 9, 11);
    }
    if (roomId === "potions")
      door("brew", "Uwarz eliksir zdrowia", -10, 12, () => {
        if (brew(state)) {
          save();
          refreshHUD();
          toast("Eliksir gotowy. Odzyskuje 65 punktów zdrowia.");
          effects.sparks(playerPos, "#99d6a0");
        } else toast("Potrzebujesz 3 liści dittany. Znajdziesz je na błoniach.");
      });
    if (roomId === "library") pickup("library-chest", "chest", -10, 13);
  } else {
    npc("hagrid", "Rubeus Hagrid", -109, 33, {
      color: "#a18460",
      robe: "#66503d",
      hair: "#493729",
      scale: 1.45,
      // a big man, not a scaled-up pupil: heavier frame, relatively smaller head, weathered face
      build: 1.3,
      headScale: 0.9,
      face: { broad: 0.85, old: 0.4, nose: 0.5 },
      beard: true,
      style: "long",
    });
    npc("walker", "Łucja · prefekt", -76, 44, { color: "#548a73", style: "bun", hair: "#6b4630" }, [
      [-76, 44],
      [-105, 40],
      [-108, 5],
      [-124, -22],
      [-130, 15],
    ]);
    npc("merchant", "Rozalia · zielarka", 238, -155, { color: "#ad8bba", robe: "#55485f", style: "bun", hair: "#a36b45", skin: "#e0b796" });
    door("castle-return", "Brama Hogwartu", -53, 48, () => travel("courtyard"));
    for (let i = 0; i < 10; i++) pickup("herb-" + i, "herb", -73 - i * 8, 37 - Math.sin(i * 0.7) * 15 - i * 3.7);
    pickup("forest-chest", "chest", -150, -8);
    pickup("village-chest", "chest", 235, -153);
    rune("rune-a", -140, -20);
    rune("rune-b", -161, -40);
    rune("rune-c", -183, -60);
    enemy("forest-guardian", "Strażnik leśnego kręgu", -188, -81, true);
  }
}
function setLighting() {
  const inside = !!room || zone === "castle";
  sky.setInterior(inside);
  environment.setInterior(inside);
  graphics.setInterior(inside);
  sky.setTime(timeMode);
  environment.setTime(timeMode);
  atmosphere.setTime(timeMode);
  scene.fog = new T.FogExp2(inside ? "#253137" : timeMode === 1 ? "#182f41" : "#839d9b", inside ? 0.009 : timeMode === 1 ? 0.003 : 0.0018);
  scene.background.set(inside ? "#152631" : timeMode === 1 ? "#101e32" : "#91aeae");
  hemi.intensity = inside ? 1.25 : timeMode === 1 ? 1.25 : 2.4;
  sun.intensity = inside ? 0.65 : timeMode === 1 ? 0.6 : 3.6;
  // characters get a rim of the place's light: torches indoors, sky by day, moonlight at night
  if (inside) setActorRim("#ffc488", 0.5);
  else if (timeMode === 1) setActorRim("#9db8ea", 0.42);
  else setActorRim("#e3efff", 0.3);
  fill.intensity = inside ? 0.6 : 1;
  renderer.toneMappingExposure = inside ? 1.25 : 1.22;
  refreshShadows();
}
function switchZone(destination, arrive = null) {
  clearZone();
  if (room) {
    scene.remove(room.group);
    room.dispose();
    room = null;
  }
  roomId = null;
  zone = destination;
  world.group.visible = ["courtyard", "grounds", "forest", "hogsmeade"].includes(destination);
  if (castle) castle.group.visible = destination === "castle";
  let spawn;
  if (destination === "castle") {
    if (!castle) {
      castle = buildCastle();
      castle.setLightBudget(quality === "ultra" ? 8 : quality === "high" ? 6 : 4);
    }
    if (!castle.group.parent) scene.add(castle.group);
    castle.group.visible = true;
    const door = arrive && arrive !== "entrance" ? castle.doorstep(arrive) : null;
    const p = door ? door.pos : castle.spawn.entrance;
    spawn = [p.x, p.y, p.z];
    look.yaw = door ? door.yaw + Math.PI : 0;
    look.distance = 3.8;
    $("#region").textContent = "ZAMEK HOGWART";
  } else if (destination === "courtyard") {
    spawn = arrive === "castle" ? [23, 26.4, 19.5] : [29, 26.4, 37.5];
    look.yaw = arrive === "castle" ? Math.PI : 0.25;
    look.distance = 4.2;
    $("#location-name").textContent = "Dziedziniec";
    $("#region").textContent = "ZAMEK HOGWART";
  } else if (["grounds", "forest", "hogsmeade"].includes(destination)) {
    zone = "grounds";
    const coords = destination === "forest" ? [-131, -11] : destination === "hogsmeade" ? [228, -151] : [-58, 45];
    spawn = [coords[0], Math.max(world.groundHeight(...coords), 1), coords[1]];
    look.yaw = destination === "hogsmeade" ? -0.5 : -0.7;
    look.distance = 4.6;
    $("#location-name").textContent =
      destination === "hogsmeade" ? "Hogsmeade" : destination === "forest" ? "Skraj Zakazanego Lasu" : "Błonia";
    $("#region").textContent = "SZKOCKIE HIGHLANDS";
  } else {
    const info = ROOMS.find((r) => r.id === destination) || ROOMS[0];
    roomId = info.id;
    zone = "room";
    room = createInterior({ ...info, professor: "" });
    scene.add(room.group);
    roomIdentity = createRoomIdentity(info);
    room.group.add(roomIdentity.group);
    activityProps = createRoomActivityProps(roomId, T);
    activityProps.group.position.set(8.6, 0, 13.8);
    room.group.add(activityProps.group);
    room.colliders.push({ x: 8.6, z: 13.8, w: 1.65, d: 1.2, height: 1.1 });
    roomBatch = batchStatic(room.group, {
      step: (t) => {
        room.update(t);
        roomIdentity.update(t);
        activityProps.update(t);
      },
    });
    spawn = [0, 0, 13.5];
    look.yaw = 0;
    look.distance = 3.9;
    $("#location-name").textContent = info.name;
    $("#region").textContent = info.category.toLocaleUpperCase("pl");
  }
  playerPos.set(...spawn);
  player.root.position.copy(playerPos);
  player.root.rotation.y = look.yaw + Math.PI;
  if (zone === "castle") castle.update(0.016, elapsed, playerPos, camera);
  velocity.set(0, 0, 0);
  look.pitch = 0.04;
  shieldUntil = 0;
  lumosUntil = 0;
  setLighting();
  populate();
  atmosphere.setZone(zone, roomId);
  record(state, "visited", destination);
  refreshHUD();
  updateCamera(0.016, true);
  refreshShadows();
}
function travel(destination, arrive = null) {
  if (CASTLE_ROOMS.has(destination)) {
    arrive = destination;
    destination = "castle";
  }
  if (transitioning) return;
  disposeActivity();
  closeDialogue();
  $("#panel").close();
  releasePointer();
  keys.clear();
  transitioning = true;
  $("#fade").style.opacity = "1";
  setTimeout(async () => {
    try {
      switchZone(destination, arrive);
      save();
      // build shaders for the new place before the fade lifts (avoids a hitch on first entry)
      await Promise.race([renderer.compileAsync?.(scene, camera), new Promise((r) => setTimeout(r, 2500))]);
    } catch (error) {
      console.error(error);
      // a place that fails to load must not leave the screen black: go back to the courtyard
      if (destination !== "courtyard") {
        try {
          switchZone("courtyard");
          toast("Nie udało się wczytać tego miejsca. Wracasz na dziedziniec.");
        } catch (again) {
          console.error(again);
        }
      }
    }
    setTimeout(() => {
      $("#fade").style.opacity = "0";
      transitioning = false;
    }, 100);
  }, 250);
}
function complete(stage) {
  const before = level(state);
  if (!advance(state, stage)) return;
  save();
  refreshHUD();
  $("#chapter-toast h2").textContent = QUESTS[stage].title;
  $("#chapter-toast p").textContent = `+${QUESTS[stage].reward} PD · +20 galeonów${level(state) > before ? " · NOWY POZIOM" : ""}`;
  $("#chapter-toast").classList.add("visible");
  clearTimeout(chapterTimer);
  chapterTimer = setTimeout(() => $("#chapter-toast").classList.remove("visible"), 3500);
  audio.note(660, 0.6, "sine", 0.06);
  if (level(state) > before) {
    health = stats(state).health;
    mana = stats(state).mana;
    toast("Nowy poziom! W dzienniku czeka punkt talentu.");
  }
  if (stage === 1) {
    selected = 2;
    renderSpells();
    toast("Poznano Wingardium Leviosa. Wybierz kamień i rzuć zaklęcie.");
  }
  if (stage === 7) {
    state.potions += 3;
    state.coins += 100;
    save();
    refreshHUD();
    toast("Ukończono rozdział „Światło między drzewami”. +100 galeonów i 3 eliksiry.");
  }
}
function refreshHUD() {
  const q = QUESTS[state.stage];
  $("#quest-title").textContent = q.title;
  $("#quest-objective").textContent = q.objective;
  $("#quest-progress").textContent =
    state.stage === 2
      ? `${state.levitated.length} / 3 kamienie`
      : state.stage === 3
        ? `${state.defeated.filter((x) => x.startsWith("dummy")).length} / 3 manekiny`
        : state.stage === 5
          ? `${state.runes.length} / 3 runy`
          : "";
  $("#hud-name").textContent = state.name;
  $("#hud-house").textContent = HOUSES[state.house].name.toUpperCase();
  $("#level").textContent = level(state);
  $("#potion-count").textContent = state.potions;
  $("#xp-fill").style.width = (state.xp % 200) / 2 + "%";
  renderSpells();
}
function renderSpells() {
  $("#spellbar").innerHTML = ABILITIES.map(
    (a, i) =>
      `<button data-spell="${i}" title="${a.name} · ${a.cost} mocy" aria-label="${a.name}" class="${i === selected ? "selected" : ""} ${unlocked(state, a.id) ? "" : "locked"}" style="--spell:${a.color}"><span>${unlocked(state, a.id) ? a.icon : "⌁"}</span><kbd>${a.key}</kbd><b class="cooldown" hidden></b></button>`,
  ).join("");
  $("#spell-name").textContent = ABILITIES[selected].name;
  $$("[data-spell]").forEach((b) => (b.onclick = () => selectSpell(Number(b.dataset.spell))));
}
function selectSpell(index) {
  const a = ABILITIES[index];
  if (!unlocked(state, a.id)) {
    toast(a.id === "leviosa" ? "Naucz się tego zaklęcia u profesora Flitwicka." : "Expelliarmus odblokujesz na poziomie 2.");
    return;
  }
  selected = index;
  renderSpells();
}
function paused() {
  return !playing || $("#panel").open || !!dialogueNpc || transitioning || document.hidden;
}
function releasePointer() {
  if (document.pointerLockElement) document.exitPointerLock();
  dragging = false;
  keys.clear();
  velocity.set(0, 0, 0);
}
let dialogueLine = null;
let dialogueTimers = [];
function dialogueLater(ms, fn) {
  dialogueTimers.push(setTimeout(fn, ms));
}
function closeDialogue() {
  for (const t of dialogueTimers) clearTimeout(t);
  dialogueTimers = [];
  lessons.cancel();
  dialogueNpc?.actor?.stopSpeaking?.();
  dialogueNpc?.actor?.setExpression?.("neutral");
  player.stopSpeaking?.();
  player.lookAt?.(null);
  dialogueNpc = null;
  dialogueLine = null;
  $("#dialogue").hidden = true;
  document.body.classList.remove("talking");
  rig.endDialogue();
  keys.clear();
}
// A light reading of the line decides the speaker's face.
function emotionFor(text, npc) {
  const t = text.toLocaleLowerCase("pl");
  if (/(udało|znakomicie|brawo|świetnie|witaj|dobrze, że|cieszę)/.test(t)) return "happy";
  if (/(niepokój|zgasł|niebezpiecz|uważ|ostroż|strzela|zbuntowan)/.test(t)) return "worried";
  if (/(cisza|zakaz|wymaga|bez zbędnych|nie spóźn)/.test(t)) return "stern";
  if (/(pojedyn|gotów|walcz)/.test(t)) return "focus";
  if (text.includes("?")) return "thinking";
  return npc.mood || "kind";
}
function showChoices(choices) {
  $("#choices").innerHTML = choices.map((c, i) => `<button data-choice="${i}"><kbd>${i + 1}</kbd> ${safe(c.text)}</button>`).join("");
  $$("[data-choice]").forEach((b) => (b.onclick = () => chooseLine(choices[Number(b.dataset.choice)])));
  $("#choices").hidden = false;
}
// The player says the chosen line aloud, shot over the NPC's shoulder, then the action runs.
function chooseLine(choice) {
  if (!dialogueNpc || !choice) return;
  $("#choices").hidden = true;
  const words = choice.text.replace(/\s*·.*$/, "");
  $("#speaker").textContent = state.name;
  $("#speaker-role").textContent = "TY";
  $("#dialogue-text").textContent = words;
  rig.playerLine();
  const seconds = player.say?.(words) || 1;
  dialogueLine = null;
  const npc = dialogueNpc;
  dialogueLater(Math.min(1700, 350 + seconds * 900), () => dialogueNpc === npc && choice.action());
}
function say(npc, role, text, choices) {
  const here = npc.slotRoom || roomId;
  if ((room || zone === "castle") && ACTIVITIES[here] && ["teacher", "flitwick", "snape", "dumbledore"].includes(npc.id) && !choices.some((c) => c.lesson))
    choices = [
      ...choices.slice(0, -1),
      { text: "Rozpocznij ćwiczenie: " + ACTIVITIES[here].title, action: showCurrentActivity },
      choices.at(-1),
    ];
  const offer = lessonOffer(npc, role);
  if (offer && !choices.some((c) => c.lesson)) choices = [...choices.slice(0, -1), offer, choices.at(-1)];
  releasePointer();
  const first = !dialogueNpc;
  dialogueNpc = npc;
  $("#dialogue").hidden = false;
  document.body.classList.add("talking");
  $("#speaker").textContent = npc.name;
  $("#speaker-role").textContent = role;
  $("#dialogue-text").textContent = "";
  $("#choices").hidden = true;
  if (npc.life && npc.state === "walk") {
    npc.state = "idle";
    npc.timer = 6;
    npc.motion.speed = 0;
  }
  if (npc.actor) {
    npc.actor.root.rotation.y = Math.atan2(playerPos.x - npc.pos.x, playerPos.z - npc.pos.z);
    player.root.rotation.y = Math.atan2(npc.pos.x - playerPos.x, npc.pos.z - playerPos.z);
    for (const t of dialogueTimers) clearTimeout(t);
    dialogueTimers = [];
    const emotion = emotionFor(text, npc),
      emphasis = emotion === "worried" || emotion === "happy";
    if (first) {
      rig.startDialogue(player, npc.actor, { blocked: (a, b) => !!segmentBlocked(a, b, getColliders(), floorAt(), !!room || zone === "castle") });
      // hold the establishing shot of both of you for a moment, then cut to the speaker
      dialogueLater(1300, () => dialogueNpc === npc && dialogueLine?.text === text && rig.npcLine(emphasis));
    } else rig.npcLine(emphasis);
    npc.actor.setExpression?.(emotion);
    npc.actor.lookAt?.(player.head);
    player.lookAt?.(npc.actor.head);
    player.setExpression?.(emotion === "happy" ? "happy" : emotion === "worried" ? "worried" : "neutral");
    const seconds = npc.actor.say?.(text) || text.length * 0.05;
    dialogueLine = { text, t: 0, dur: seconds, choices, shown: 0 };
    // acting: a gesture that fits the line, and on long lines a cut to your reaction
    const line = dialogueLine;
    const gesture = /\?\s*$/.test(text) ? "shrug" : /!/.test(text) ? (emotion === "happy" ? "laugh" : "point") : emotion === "happy" || emotion === "kind" ? "nod" : emotion === "worried" ? "shrug" : emotion === "stern" ? "point" : null;
    if (gesture) dialogueLater(Math.min(seconds * 450, 2200), () => dialogueNpc === npc && npc.actor.gesture?.(gesture));
    if (seconds > 5) dialogueLater(seconds * 650, () => dialogueNpc === npc && npc.actor.gesture?.("nod"));
    if (seconds > 4.2)
      dialogueLater(seconds * 520, () => {
        if (dialogueNpc !== npc || dialogueLine !== line) return;
        player.setExpression?.(emotion === "worried" ? "worried" : emotion === "happy" ? "happy" : "thinking");
        rig.reaction?.(1.35);
      });
  } else {
    $("#dialogue-text").textContent = text;
    showChoices(choices);
  }
}
function finishLine() {
  if (!dialogueLine) return;
  $("#dialogue-text").textContent = dialogueLine.text;
  const choices = dialogueLine.choices;
  dialogueLine = null;
  showChoices(choices);
}
function updateDialogue(dt) {
  rig.updateDialogue(dt);
  if (!dialogueLine) return;
  dialogueLine.t += dt;
  const n = Math.min(dialogueLine.text.length, Math.ceil((dialogueLine.t / dialogueLine.dur) * dialogueLine.text.length));
  if (n !== dialogueLine.shown) {
    dialogueLine.shown = n;
    $("#dialogue-text").textContent = dialogueLine.text.slice(0, n);
  }
  if (dialogueLine.t >= dialogueLine.dur + 0.15) finishLine();
}
function talk(n) {
  const leave = { text: "Do zobaczenia.", action: closeDialogue };
  if (n.id === "minerva")
    say(
      n,
      "PROFESOR TRANSMUTACJI",
      state.stage === 0
        ? "Witaj w Hogwarcie. Różdżka daje możliwości, ale to Twoje wybory nadają im znaczenie. Profesor Flitwick przygotował dla Ciebie pierwszą próbę. Jego sala jest tuż za zachodnimi drzwiami."
        : "Idź uważnie. Przy zamku ćwiczymy, aby chronić innych, a poza jego murami pamiętamy, że magia potrafi zaskoczyć nawet najlepszego ucznia.",
      [
        {
          text: state.stage === 0 ? "Jestem gotowy. Odnajdę profesora." : "Jak znaleźć drogę?",
          action: () => {
            if (state.stage === 0) complete(0);
            else {
              guideUntil = elapsed + 20;
              toast("Podążaj za złotym znacznikiem. Klawisz G pokazuje najbliższy odcinek drogi.");
            }
            closeDialogue();
          },
        },
        {
          text: "Co warto wiedzieć o szkole?",
          action: () =>
            say(
              n,
              "O SZKOLE",
              "Dziennik pod klawiszem J przechowuje zadania i talenty. W salach spotkasz profesorów. Zbieraj dittany na błoniach — w lochach uwarzysz z niego eliksir zdrowia.",
              [leave],
            ),
        },
        leave,
      ],
    );
  else if (n.id === "flitwick")
    say(
      n,
      "MISTRZ ZAKLĘĆ",
      state.stage <= 1
        ? "W lewitacji liczą się spokój i precyzja. Spójrz na trzy kamienie za ławkami. Najpierw intencja, potem ruch różdżki. Wingardium Leviosa!"
        : state.stage === 2
          ? "Trzy kamienie, trzy spokojne próby. Wybierz Leviosa klawiszem 3. Skieruj postać ku kamieniowi, podejdź bliżej i rzuć zaklęcie."
          : "Znakomicie. Teraz możesz wykorzystać lewitację również w pojedynku. Unieruchomiony przeciwnik da Ci czas na odzyskanie równowagi.",
      [
        {
          text: state.stage <= 1 ? "Pokaż mi ruch różdżki." : "Przypomnij podstawy pojedynku.",
          action: () => {
            if (state.stage === 0) {
              toast("Najpierw porozmawiaj z profesor McGonagall na dziedzińcu.");
              closeDialogue();
            } else if (state.stage === 1)
              // the first lesson: the professor shows the movement, you repeat it on the slate
              spellLesson(n, "MISTRZ ZAKLĘĆ", "leviosa", () => {
                complete(1);
                closeDialogue();
              });
            else
              say(
                n,
                "TRENING",
                "Podstawowy czar nie kosztuje mocy. Protego blokuje nadlatujące pociski, a unik pod Alt pomaga zejść z linii ataku. Wybieraj zaklęcia 1–5. Cel podświetli się, kiedy znajdzie się przed Tobą.",
                [leave],
              );
          },
        },
        leave,
      ],
    );
  else if (n.id === "hagrid")
    say(
      n,
      "STRAŻNIK KLUCZY I G A J O W Y".replace("G A J O W Y", "GAJOWY"),
      state.stage === 4
        ? "Dobrze, że jesteś. Na skraju lasu zgasły stare runy, a szkolna zbroja pilnująca polany zaczęła strzelać iskrami do wszystkiego. Zapal trzy runy Lumosem. Wtedy da się uspokoić strażnika."
        : state.stage === 7
          ? "Widziałem światło ponad drzewami. Udało Ci się! Weź te eliksiry i kilka monet na coś ciepłego w Hogsmeade. Pamiętaj: najważniejsza magia to wiedzieć, kiedy pomóc."
          : state.stage < 4
            ? "Las dziś trochę niespokojny. Najpierw ukończ szkolne ćwiczenia. Ja tu poczekam."
            : "Idź ścieżką za chatką. Trzy runy poprowadzą Cię na polanę. Dittany zbieraj po drodze; nigdy nie wiadomo, kiedy przyda się eliksir.",
      [
        {
          text: state.stage === 4 ? "Zajmę się runami." : state.stage === 7 ? "Dziękuję, Hagridzie." : "Zaznacz mi drogę.",
          action: () => {
            if (state.stage === 4) complete(4);
            else if (state.stage === 7) complete(7);
            else guideUntil = elapsed + 20;
            closeDialogue();
          },
        },
        leave,
      ],
    );
  else if (n.id === "snape")
    say(
      n,
      "MISTRZ ELIKSIRÓW",
      "Trzy liście dittany. Czysty kociołek. Odrobina cierpliwości. To powinno wystarczyć, aby sporządzić eliksir przywracający siły. Składniki znajdziesz na błoniach.",
      [
        {
          text: "Uwarz eliksir z 3 liści.",
          action: () => {
            if (brew(state)) {
              save();
              refreshHUD();
              toast("Uwarzono eliksir zdrowia.");
            } else toast("Masz " + state.herbs + " / 3 potrzebne liście.");
            closeDialogue();
          },
        },
        leave,
      ],
    );
  else if (n.life) say(n, n.role || "UCZEŃ HOGWARTU", n.lines[Math.floor(Math.random() * n.lines.length)], [leave]);
  else if (n.id === "agata")
    say(n, "POMOCNICA W BIBLIOTECE", "Cisza, proszę. Książki wracają na półki w tym samym stanie, w jakim je wypożyczono. A strony przewodnika po zamku? Kto je znajdzie, ten wie o Hogwarcie więcej niż niejeden prefekt.", [leave]);
  else if (n.id === "wrzos") {
    const tips = { text: "Jak wygrać pojedynek?", action: () => say(n, "MISTRZ POJEDYNKÓW", "Nie stój w miejscu. Alt z kierunkiem to unik w bok, Protego odbija cios, a mocne Expelliarmus potrafi powalić. Kiedy przeciwnik unosi różdżkę, masz pół sekundy. Obserwuj jego rękę, nie twarz.", [leave]) };
    if (state.stage < 4)
      say(n, "MISTRZ POJEDYNKÓW", "Najpierw pokonaj manekiny na dziedzińcu. Dopiero wtedy przyjmę Cię do kręgu pojedynków.", [tips, leave]);
    else {
      const options = [{ text: "Pojedynek z Adą (łatwy)", action: () => startDuel("ada") }];
      if (state.duels.ada) options.push({ text: "Pojedynek z Tymonem (średni)", action: () => startDuel("tymon") });
      if (state.duels.tymon) options.push({ text: "Pojedynek z mistrzem (trudny)", action: () => startDuel("wrzos") });
      say(n, "MISTRZ POJEDYNKÓW", `Krąg pojedynków jest otwarty. Ukłon, odliczanie i niech wygra lepszy. Wygrane: Ada ${state.duels.ada}, Tymon ${state.duels.tymon}, mistrz ${state.duels.wrzos}.`, [...options, tips, leave]);
    }
  } else if (n.id === "merchant")
    say(
      n,
      "ZIELARKA Z HOGSMEADE",
      "Na wyprawę najlepiej zabrać coś na wzmocnienie. Eliksir zdrowia kosztuje 30 galeonów. Zbierasz dittany? Profesor Snape potrafi pokazać Ci, co z nim zrobić.",
      [
        {
          text: "Kup eliksir · 30 galeonów",
          action: () => {
            if (state.coins >= 30) {
              state.coins -= 30;
              state.potions++;
              save();
              refreshHUD();
              toast("Kupiono eliksir zdrowia.");
            } else toast("Potrzebujesz 30 galeonów.");
            closeDialogue();
          },
        },
        leave,
      ],
    );
  else if (n.id === "dumbledore")
    say(
      n,
      "DYREKTOR HOGWARTU",
      "Każda podróż zostawia w nas coś, czego nie było na początku. Nie spiesz się z odkrywaniem szkoły. Nawet zwykły spacer potrafi stać się początkiem przygody.",
      [
        {
          text: "Chcę zobaczyć więcej sal.",
          action: () => {
            closeDialogue();
            showRooms();
          },
        },
        leave,
      ],
    );
  else if (n.id === "teacher") {
    const info = ROOMS.find((r) => r.id === (n.slotRoom || roomId)) || { description: "Rozejrzyj się. Każda sala skrywa własną historię." };
    say(n, info.subject || "HOGWART", info.lesson?.intro || info.description || "Rozejrzyj się. Każda sala skrywa własną historię.", [
      {
        text: "Czego dotyczy ta sala?",
        action: () => say(n, info.subject || "HOGWART", info.lesson?.explanation || info.description, [leave]),
      },
      leave,
    ]);
  } else
    say(
      n,
      "UCZEŃ HOGWARTU",
      n.id === "nora"
        ? "Zauważyłam, że kamienie w sali Flitwicka świecą, gdy spojrzeć na nie pod odpowiednim kątem. Może to właśnie od tego zaczyna się magia?"
        : n.id === "felix"
          ? "Lubię chodzić tędy po lekcjach. Jeśli potrzebujesz składników do eliksiru, szukaj zielonych liści przy ścieżce do Hagrida."
          : "Kiedy zaklęcia lecą w Twoją stronę, nie stój w miejscu. Protego przydaje się bardziej, niż można sądzić po pierwszej lekcji.",
      [leave],
    );
}
function interact() {
  if (paused() || elapsed < interactCooldown) return;
  interactCooldown = elapsed + 0.25;
  if (!nearby) {
    toast("Podejdź bliżej postaci, drzwi lub przedmiotu.");
    return;
  }
  const e = nearby;
  if (e.type === "npc") talk(e);
  else if (e.type === "door") e.action();
  else if (e.type === "herb" || e.type === "chest") {
    if (collect(state, e.id, e.type)) {
      e.mesh.visible = false;
      e.hidden = true;
      effects.sparks(e.pos, e.type === "herb" ? "#a8d38e" : "#efc983", 24, 2);
      save();
      refreshHUD();
      toast(e.type === "herb" ? `Zebrano dittany · ${state.herbs} liści` : "+30 galeonów · +20 PD");
    }
  } else if (e.type === "page") {
    if (record(state, "found", e.id)) {
      e.hidden = true;
      e.page.mesh.visible = false;
      state.xp += 15;
      effects.sparks(e.pos, "#ffe7a8", 40, 2);
      audio.note(880, 0.4, "sine", 0.04);
      const total = castle.pages.length,
        got = castle.pages.filter((p) => state.found.includes(p.id)).length;
      panel(`<h2>${safe(e.page.place)}</h2><p class="lore">${safe(e.page.text)}</p><p>Strony przewodnika: ${got} / ${total} · +15 PD</p>`, "PRZEWODNIK PO ZAMKU");
      save();
      refreshHUD();
    }
  } else if (e.type === "rune") toast("Rzuć Lumos (2), stojąc blisko runy.");
  else if (e.type === "stone") toast("Wybierz Wingardium Leviosa (3) i rzuć zaklęcie.");
}
function targetForSpell() {
  const dir = V(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
  let best = null,
    score = -100;
  for (const e of entities) {
    if (!["enemy", "stone", "duelist", "spirit"].includes(e.type) || e.hidden || e.hp === 0 || (e.type === "spirit" && !e.active)) continue;
    if (e.type === "enemy" && (e.boss ? state.stage !== 6 : state.stage < 3)) continue;
    if (e.type === "stone" && (state.stage < 2 || (state.stage === 2 && state.levitated.includes(e.id)))) continue;
    const offset = e.pos.clone().sub(playerPos);
    offset.y = 0;
    const distance = offset.length(),
      dot = offset.normalize().dot(dir);
    if (
      distance < 24 &&
      dot > 0.58 &&
      !segmentBlocked(
        playerPos.clone().add(V(0, 1.55, 0)),
        e.pos.clone().add(V(0, e.type === "stone" ? 0.1 : 1.2, 0)),
        getColliders(),
        height(playerPos.x, playerPos.z),
        !!room || zone === "castle",
      )
    ) {
      const s = dot * 30 - distance * 0.3;
      if (s > score) {
        best = e;
        score = s;
      }
    }
  }
  return best;
}
function damageEnemy(e, amount) {
  if (!e || e.hidden || e.hp <= 0) return;
  e.hp = Math.max(0, e.hp - amount);
  e.hit = 0.3;
  e.attack = Math.max(e.attack, 0.65);
  if (e.hp === 0) {
    e.hidden = true;
    e.model.root.visible = false;
    effects.sparks(e.pos.clone().add(V(0, 1, 0)), e.boss ? "#b7ccfa" : "#efcc87", 80, 6);
    record(state, "defeated", e.id);
    if (e.boss && state.stage === 6) complete(6);
    if (!e.boss && state.stage === 3 && state.defeated.filter((id) => id.startsWith("dummy")).length >= 3) complete(3);
    save();
    refreshHUD();
  }
}
function mastery(id) {
  return state.mastery?.[id] || 0;
}
// ---------------------------------------------------------------- lessons: the professor shows a wand movement, you draw it
const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const SPELL_TEACHERS = { flitwick: ["lumos", "leviosa"], wrzos: ["protego", "expelliarmus"] };
const MASTERY_EFFECT = {
  lumos: "Światło Lumos świeci o 6 sekund dłużej i budzi runy z większej odległości.",
  leviosa: "Lewitacja unieruchamia przeciwnika o pół sekundy dłużej.",
  protego: "Tarcza Protego wytrzymuje o 0,4 sekundy dłużej.",
  expelliarmus: "Expelliarmus uderza mocniej i łatwiej powala.",
};
const LESSON_INTRO = {
  lumos: "Lumos to jeden spokojny ruch w górę. Światło idzie za różdżką, nie przed nią.",
  leviosa: "Zamach w dół i w prawo, płynnie, a na końcu lekkie pstryknięcie w górę. Bez szarpania!",
  protego: "Tarcza rośnie razem z ruchem. Prowadź różdżkę łukiem nad głową, od lewej do prawej.",
  expelliarmus: "Cięcie z góry w dół i krótkie pchnięcie. Szybko, ale czysto.",
};
function lessonOffer(n, role) {
  if (lessons.active || !n.actor) return null;
  const here = n.slotRoom || roomId;
  let spells = SPELL_TEACHERS[n.id];
  if (n.id === "teacher" && ["defence", "duelling"].includes(here)) spells = ["protego", "expelliarmus"];
  const info = ROOMS.find((r) => r.id === here);
  const roomOk = info?.lesson && PATTERNS[info.lesson.gesture] && ["teacher", "snape", "flitwick"].includes(n.id);
  if (spells) return { text: "Poproszę o lekcję ruchu różdżki.", lesson: true, action: () => lessonMenu(n, role, spells, roomOk ? info : null) };
  if (roomOk)
    return { text: "Lekcja: " + info.lesson.title + (state.lessons[info.id] ? " · ✓" : ""), lesson: true, action: () => roomLesson(n, role, info) };
  return null;
}
function lessonMenu(n, role, spells, info = null) {
  const leave = { text: "Może innym razem.", action: closeDialogue };
  say(
    n,
    role,
    "Którego ruchu chcesz się dziś uczyć? Pokażę go powoli, a Ty powtórzysz na tabliczce. Trzy czyste próby i biegłość rośnie.",
    [
      ...spells.map((id) => {
        const a = ABILITIES.find((x) => x.id === id);
        return { text: `${a.name} · biegłość ${stars(mastery(id))}`, lesson: true, action: () => spellLesson(n, role, id) };
      }),
      ...(info ? [{ text: "Lekcja w tej sali: " + info.lesson.title + (state.lessons[info.id] ? " · ✓" : ""), lesson: true, action: () => roomLesson(n, role, info) }] : []),
      leave,
    ],
  );
}
// a line spoken during the lesson, without choices
function lessonLine(n, text) {
  $("#speaker").textContent = n.name;
  $("#dialogue-text").textContent = text;
  $("#choices").innerHTML = "";
  $("#choices").hidden = true;
  dialogueLine = null;
  n.actor?.say?.(text);
}
function runLesson(n, role, opts) {
  for (const t of dialogueTimers) clearTimeout(t);
  dialogueTimers = [];
  $("#speaker-role").textContent = role;
  lessonLine(n, opts.intro);
  n.actor.setExpression?.("focus");
  lessons.start({
    teacher: n.actor,
    player,
    ...opts,
    // medium shots that show the wand arm, aimed so the slate does not cover the person
    shot: (who) => rig.shot(who === "teacher" ? "demo" : "practice", innerWidth > 680 ? { shift: 0.7 } : { lift: 0.5 }),
    react: (ok, r) => {
      n.actor.setExpression?.(ok ? "happy" : "thinking");
      n.actor.gesture?.(ok ? "nod" : "shrug");
      player.setExpression?.(ok ? "happy" : "worried");
    },
    onDone: (r) => {
      n.actor.setExpression?.("neutral");
      if (r.cancelled) {
        if (r.by === "button" && dialogueNpc) say(n, role, "Wróć, kiedy zechcesz. Ruchu różdżki uczy się latami, nie minutami.", [{ text: "Do zobaczenia.", action: closeDialogue }]);
        return;
      }
      opts.done(r);
    },
  });
}
function spellLesson(n, role, spell, onPass) {
  const a = ABILITIES.find((x) => x.id === spell),
    m = mastery(spell),
    leave = { text: "Dziękuję za lekcję.", action: closeDialogue };
  runLesson(n, role, {
    patternId: SPELL_PATTERN[spell],
    title: a.name,
    kicker: "LEKCJA ZAKLĘĆ · BIEGŁOŚĆ " + stars(m),
    intro: LESSON_INTRO[spell],
    needed: onPass ? 2 : 3,
    threshold: 0.62 + 0.06 * m,
    ghost: m < 2,
    done: (r) => {
      if (r.passed) {
        state.lessons[spell] = (state.lessons[spell] || 0) + 1;
        state.mastery[spell] = Math.min(3, m + 1);
        state.xp += m < 3 ? 30 : 10;
        save();
        refreshHUD();
        toast(m < 3 ? `${a.name}: biegłość ${stars(state.mastery[spell])} · +30 PD` : `${a.name}: pełna biegłość · +10 PD`);
        if (onPass) return onPass();
        say(n, role, m < 3 ? `Doskonale! Twoja biegłość rośnie: ${stars(state.mastery[spell])}. ${MASTERY_EFFECT[spell]}` : "Perfekcyjnie. Tego ruchu nie muszę Cię już uczyć, ale ćwiczenie nigdy nie szkodzi.", [leave]);
      } else
        say(n, role, `Jeszcze nie dziś. Najlepsza próba: ${Math.round(r.best * 100)}%. ${PATTERNS[SPELL_PATTERN[spell]].hint}`, [
          { text: "Spróbuję jeszcze raz.", lesson: true, action: () => spellLesson(n, role, spell, onPass) },
          onPass ? { text: "Poćwiczę sam.", action: () => onPass() } : leave,
        ]);
    },
  });
}
function roomLesson(n, role, info) {
  const L = info.lesson,
    leave = { text: "Do zobaczenia.", action: closeDialogue };
  say(
    n,
    role,
    L.intro + " " + L.question,
    [
      ...L.choices.map((c, i) => ({
        text: c,
        lesson: true,
        action: () =>
          i === L.answer
            ? say(n, role, "Właśnie tak. Teraz ruch różdżki. Pokażę go powoli, a Ty powtórz na tabliczce.", [{ text: "Jestem gotowy.", lesson: true, action: () => roomGesture(n, role, info) }, leave])
            : say(n, role, "Nie do końca. Pomyśl jeszcze raz o tym, co przed chwilą powiedziałem.", [{ text: "Spróbuję ponownie.", lesson: true, action: () => roomLesson(n, role, info) }, leave]),
      })),
      leave,
    ],
  );
}
function roomGesture(n, role, info) {
  const L = info.lesson;
  runLesson(n, role, {
    patternId: L.gesture,
    title: L.title,
    kicker: "LEKCJA · " + info.name.toUpperCase(),
    intro: "Patrz na różdżkę. " + PATTERNS[L.gesture].hint,
    needed: 2,
    threshold: 0.6,
    done: (r) => {
      if (r.passed) {
        const first = !state.lessons[info.id];
        state.lessons[info.id] = (state.lessons[info.id] || 0) + 1;
        if (first) state.xp += 20;
        save();
        refreshHUD();
        if (first) toast("Lekcja zaliczona: " + L.title + " · +20 PD");
        say(n, role, L.success, [{ text: "Dziękuję.", action: closeDialogue }]);
      } else say(n, role, "Ruch wymaga jeszcze pracy. Spróbuj ponownie, kiedy ręka odpocznie.", [{ text: "Spróbuję teraz.", lesson: true, action: () => roomGesture(n, role, info) }, { text: "Do zobaczenia.", action: closeDialogue }]);
    },
  });
}
function flashSpell(color, k = 1) {
  flash = Math.max(flash, k);
  flashColor.set(color);
}
function facingVec() {
  const r = player.root.rotation.y;
  return V(Math.sin(r), 0, Math.cos(r));
}
function cast() {
  if (paused() || elapsed < castUntil || elapsed < downUntil) return;
  const a = ABILITIES[selected];
  if (!unlocked(state, a.id)) return;
  if ((cooldowns.get(a.id) || 0) > elapsed) return;
  if (mana < a.cost) {
    toast("Brakuje mocy magicznej. Odpocznij chwilę.");
    return;
  }
  mana -= a.cost;
  cooldowns.set(a.id, elapsed + a.cooldown);
  const e = targetForSpell();
  if (e) player.root.rotation.y = Math.atan2(e.pos.x - playerPos.x, e.pos.z - playerPos.z);
  else if (velocity.lengthSq() < 0.5) player.root.rotation.y = look.yaw + Math.PI;
  const timing = player.cast(a.id) || { release: 0.1 };
  castUntil = elapsed + Math.min(timing.release + 0.08, 0.6);
  audio.note(a.id === "protego" ? 240 : 760, 0.25, "sine", 0.035);
  if (a.id === "protego") {
    shieldUntil = elapsed + 2.6 + 0.4 * mastery("protego");
    shieldHeld = true;
    effects.shield(playerPos, shieldUntil - elapsed);
    flashSpell(a.color, 0.7);
    return;
  }
  pending.push({ at: elapsed + timing.release, run: () => releaseSpell(a, e) });
}
function releaseSpell(a, e) {
  if (elapsed < downUntil) return;
  const from = player.tip.getWorldPosition(V());
  flashSpell(a.color);
  if (a.id === "lumos") {
    lumosUntil = elapsed + 24 + 6 * mastery("lumos");
    effects.ring(playerPos.clone().add(V(0, 0.1, 0)), "#fce4a0", 8, 1);
    effects.sparks(from, "#ffebbd", 70, 4);
    if (state.stage === 5) {
      for (const r of entities.filter((x) => x.type === "rune")) {
        if (r.pos.distanceTo(playerPos) < 8 + mastery("lumos") && record(state, "runes", r.id)) {
          r.mesh.material.emissive.set("#f1cd7d");
          r.mesh.material.emissiveIntensity = 1.2;
          effects.sparks(r.pos, "#f8d389", 100, 5);
          toast("Przebudzono leśną runę.");
          save();
        }
      }
      if (state.runes.length >= 3) complete(5);
      refreshHUD();
    }
    return;
  }
  const f = facingVec();
  if (e?.type === "spirit") {
    const at = e.pos.clone(),
      dir = at.clone().sub(from).normalize();
    effects.projectile(from, at.clone().addScaledVector(dir, 8), { color: a.color, targetTest: (p) => !e.hidden && p.distanceTo(e.pos) < 0.7, onHit: () => life.scare() });
    return;
  }
  if (e?.type === "duelist") {
    const at = e.pos.clone().add(V(0, 1.05, 0)),
      dir = at.clone().sub(from).normalize();
    const damage = stats(state).damage * (a.id === "expelliarmus" ? 1.6 + 0.15 * mastery("expelliarmus") : a.id === "leviosa" ? 0.4 : 0.75);
    effects.projectile(from, at.clone().addScaledVector(dir, 10), {
      color: a.color,
      fast: a.id === "expelliarmus",
      targetTest: duels.bodyTest,
      onHit: () => duels.hit(a.id, damage),
    });
    lastCombat = elapsed;
    return;
  }
  const aim = e
    ? e.pos.clone().add(V(0, e.type === "stone" ? 0.1 : 1.2, 0))
    : from.clone().add(V(f.x * 25, 0.3, f.z * 25));
  effects.projectile(from, aim, {
    color: a.color,
    fast: a.id === "expelliarmus",
    onHit: () => {
      if (!e || e.hidden) return;
      if (e.type === "duelist") {
        duelHit(e, a, aim);
        return;
      }
      if (a.id === "leviosa") {
        e.stunned = elapsed + 4 + 0.5 * mastery("leviosa");
        effects.ring(e.pos.clone(), "#c8a3ff", 2, 1.1);
        if (e.type === "stone" && state.stage === 2 && record(state, "levitated", e.id)) {
          e.mesh.material.emissive.set("#8060af");
          save();
          refreshHUD();
          if (state.levitated.length >= 3) complete(2);
        }
      } else if (e.type === "enemy") {
        if (e.boss && state.stage !== 6) {
          toast("Strażnika osłaniają runy. Najpierw ukończ zadanie z Lumosem.");
          return;
        }
        if (!e.boss && state.stage < 3) {
          toast("Najpierw ukończ lekcję lewitacji u Flitwicka.");
          return;
        }
        lastCombat = elapsed;
        damageEnemy(e, stats(state).damage * (a.id === "expelliarmus" ? 2.2 + 0.2 * mastery("expelliarmus") : 1));
        if (a.id === "expelliarmus") e.stunned = elapsed + 1.8;
      }
    },
  });
}
function knockedDown(dir, out = false) {
  player.knockdown();
  rig.shake(0.7);
  if (dir) velocity.copy(dir).setY(0).normalize().multiplyScalar(4.2);
  downUntil = elapsed + (out ? 6 : 3.2);
  if (out) {
    toast("Tracisz przytomność…");
    pending.push({
      at: elapsed + 1.9,
      run: () => {
        health = stats(state).health;
        mana = stats(state).mana;
        toast("Wracasz na dziedziniec; zachowujesz postęp.");
        travel("courtyard");
        pending.push({ at: elapsed + 1.0, run: () => ((downUntil = elapsed + (player.getUp() || 1.4)), 0) });
      },
    });
  } else pending.push({ at: elapsed + 1.5, run: () => ((downUntil = elapsed + (player.getUp() || 1.4)), 0) });
}
function hurt(amount, dir = null) {
  if (elapsed < dodgeUntil || elapsed < downUntil) return;
  if (amount <= 0 && elapsed >= shieldUntil) {
    rig.shake(0.1);
    player.hit(!dir || facingVec().dot(dir) < 0);
    player.setExpression?.("surprised", 1.2);
    effects.sparks(playerPos.clone().add(V(0, 1.3, 0)), "#f4efe2", 26, 1.6);
    audio.note(520, 0.12, "triangle", 0.03);
    return;
  }
  if (elapsed < shieldUntil) {
    effects.ring(playerPos.clone().add(V(0, 0.4, 0)), "#a6ebff", 2, 0.35);
    mana = Math.min(stats(state).mana, mana + 5);
    audio.note(900, 0.14);
    return;
  }
  health = Math.max(0, health - amount);
  lastCombat = elapsed;
  rig.shake(Math.min(0.55, 0.12 + amount / 45));
  $("#hurt").style.opacity = state.reducedMotion ? "0" : ".65";
  setTimeout(() => ($("#hurt").style.opacity = "0"), 230);
  audio.note(70, 0.3, "triangle", 0.07);
  const front = !dir || facingVec().dot(dir) < 0;
  if (health === 0) {
    if (duels.active && duels.playerDefeated()) {
      player.knockdown();
      downUntil = elapsed + 6;
      health = 1;
      return;
    }
    knockedDown(dir, true);
    return;
  }
  if (amount >= 18 && Math.random() < 0.35) knockedDown(dir);
  else player.hit(front);
}
function potion() {
  if (paused()) return;
  const result = usePotion(state, health);
  if (result.used) {
    health = result.hp;
    save();
    refreshHUD();
    effects.sparks(playerPos.clone().add(V(0, 1, 0)), "#a4e3b9", 70, 3);
    toast("Eliksir przywrócił siły.");
  } else toast(state.potions ? "Masz pełne zdrowie." : "Brak eliksirów. Uwarz je z dittany w lochach.");
}
function dodge() {
  if (paused() || elapsed < dodgeCooldown || elapsed < downUntil) return;
  dodgeUntil = elapsed + 0.42;
  dodgeCooldown = elapsed + 1.0;
  let x = Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    z = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const r = player.root.rotation.y;
  let dx, dz;
  if (!x && !z) {
    dx = -Math.sin(r);
    dz = -Math.cos(r);
  } else {
    const l = Math.hypot(x, z);
    x /= l;
    z /= l;
    dx = x * Math.cos(look.yaw) - z * Math.sin(look.yaw);
    dz = -x * Math.sin(look.yaw) - z * Math.cos(look.yaw);
  }
  const forward = dx * Math.sin(r) + dz * Math.cos(r),
    side = dx * Math.cos(r) - dz * Math.sin(r);
  player.dodge(Math.abs(forward) >= Math.abs(side) ? (forward > 0 ? "f" : "b") : side > 0 ? "l" : "r");
  velocity.set(dx * 11, 0, dz * 11);
  audio.swish?.();
  effects.ring(playerPos.clone().add(V(0, 0.08, 0)), "#cbded7", 1, 0.4);
}
function getColliders() {
  if (room) return room.colliders;
  if (zone === "castle") return castle.colliders(playerPos.y);
  return zone === "courtyard" ? [{ x: 23, z: 31, r: 4.55 }] : world.colliders;
}
function getBounds() {
  if (zone === "castle") return null;
  return room
    ? room.bounds
    : zone === "courtyard"
      ? { minX: 11.5, maxX: 33.5, minZ: 16, maxZ: 42 }
      : { minX: -250, maxX: 335, minZ: -250, maxZ: 65 };
}
function floorAt(p = playerPos) {
  return room ? 0 : zone === "courtyard" ? 26.4 : zone === "castle" ? castleFloor(p) : height(p.x, p.z);
}
function inCombat() {
  if (elapsed - lastCombat > 4 || !target || target.hidden) return null;
  return target.type === "enemy" || target.type === "duelist" ? target : null;
}
function updateMovement(dt) {
  if (keys.has("ArrowLeft")) look.yaw += dt * 1.5;
  if (keys.has("ArrowRight")) look.yaw -= dt * 1.5;
  const locked = elapsed < downUntil;
  let x = locked ? 0 : Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    z = locked ? 0 : Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const length = Math.hypot(x, z);
  if (length) {
    x /= length;
    z /= length;
  }
  const casting = elapsed < castUntil + 0.15;
  const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.5 : 3.7) * (casting ? 0.55 : 1) * (shieldHeld ? 0.6 : 1);
  const dx = (x * Math.cos(look.yaw) - z * Math.sin(look.yaw)) * speed,
    dz = (-x * Math.sin(look.yaw) - z * Math.cos(look.yaw)) * speed;
  if (elapsed > dodgeUntil) {
    velocity.x = damp(velocity.x, dx, locked ? 3 : length ? 12 : 16, dt);
    velocity.z = damp(velocity.z, dz, locked ? 3 : length ? 12 : 16, dt);
  }
  const previous = playerPos.clone(),
    next = zone === "castle" ? castle.move(playerPos, velocity.x * dt, velocity.z * dt) : moveCircle(playerPos, velocity.x * dt, velocity.z * dt, getColliders(), getBounds());
  const nextH = zone === "castle" ? next.y : height(next.x, next.z);
  if (zone !== "grounds" || Math.abs(nextH - playerPos.y) < 1.2) {
    playerPos.x = next.x;
    playerPos.z = next.z;
    playerPos.y = zone === "castle" ? nextH : damp(playerPos.y, nextH, 24, dt);
  }
  const actual = previous.distanceTo(playerPos) / dt;
  // in a fight the character keeps facing the opponent and steps around them
  combatFocus = inCombat();
  const r0 = player.root.rotation.y;
  let wantYaw = null;
  if (combatFocus && !locked) wantYaw = Math.atan2(combatFocus.pos.x - playerPos.x, combatFocus.pos.z - playerPos.z);
  else if (actual > 0.1 && elapsed > castUntil && !locked && elapsed > dodgeUntil) wantYaw = Math.atan2(playerPos.x - previous.x, playerPos.z - previous.z);
  if (wantYaw !== null) {
    const diff = Math.atan2(Math.sin(wantYaw - r0), Math.cos(wantYaw - r0));
    player.root.rotation.y += diff * (1 - Math.exp(-(combatFocus ? 10 : 15) * dt));
  }
  const r = player.root.rotation.y,
    vx = (playerPos.x - previous.x) / dt,
    vz = (playerPos.z - previous.z) / dt;
  const fwd = vx * Math.sin(r) + vz * Math.cos(r),
    side = vx * Math.cos(r) - vz * Math.sin(r);
  const motion = { speed: actual, side: combatFocus && actual > 0.3 ? T.MathUtils.clamp(side / Math.max(actual, 0.01), -1, 1) * (Math.abs(side) > Math.abs(fwd) * 0.6 ? 1 : 0) : 0, back: combatFocus ? fwd < -0.3 * actual : false };
  player.root.position.copy(playerPos);
  player.setGuard?.(!!combatFocus);
  player.update(dt, elapsed, motion, player.speaking?.());
  mana = Math.min(stats(state).mana, mana + stats(state).regen * dt);
  if (elapsed - lastCombat > 10) health = Math.min(stats(state).health, health + 2.5 * dt);
  for (let i = pending.length - 1; i >= 0; i--)
    if (elapsed >= pending[i].at) {
      const job = pending.splice(i, 1)[0];
      job.run();
    }
  if (shieldHeld && elapsed > shieldUntil) {
    shieldHeld = false;
    player.releaseShield?.();
  }
}
function cameraCollide(a, b) {
  const colliders = getColliders(),
    floor = floorAt();
  for (let i = 1; i <= 14; i++) {
    const t = i / 14,
      x = a.x + (b.x - a.x) * t,
      y = a.y + (b.y - a.y) * t,
      z = a.z + (b.z - a.z) * t;
    if (zone === "grounds" && y < height(x, z) + 0.5) return t;
    for (const c of colliders) {
      if (c.y0 !== undefined && (y < c.y0 - 0.2 || y > c.y1)) continue;
      const hit = c.r ? Math.hypot(x - c.x, z - c.z) < c.r + 0.2 : Math.abs(x - c.x) < c.w / 2 + 0.2 && Math.abs(z - c.z) < c.d / 2 + 0.2;
      if (hit && (c.height === undefined || y < floor + c.height + 0.5)) return t;
    }
  }
  return 1;
}
function updateCamera(dt, snap = false) {
  const focus = playerPos.clone().add(V(0, 1.55, 0));
  const moving = velocity.lengthSq() > 0.5;
  const sprint = moving && (keys.has("ShiftLeft") || keys.has("ShiftRight")) ? 1 : 0;
  const bounded = room || zone === "courtyard";
  look.yaw = rig.follow(snap ? 1 : dt, {
    focus,
    yaw: look.yaw,
    pitch: look.pitch,
    distance: look.distance,
    sprint,
    facing: player.root.rotation.y,
    moving,
    combat: combatFocus ? combatFocus.pos : null,
    clampTo: bounded ? getBounds() : null,
    collide: cameraCollide,
  });
  if (snap) rig.snap(focus);
  player.root.visible = camera.position.distanceTo(focus) > 0.9;
}
function updateActors(dt) {
  for (const n of actors) {
    let speed = 0;
    if (n.life) {
      if (!n.active) continue;
      speed = n === dialogueNpc ? 0 : n.motion?.speed || 0;
    }
    if (n.route && n !== dialogueNpc) {
      n.pause -= dt;
      if (n.pause <= 0) {
        const [x, z] = n.route[n.waypoint],
          delta = V(x - n.pos.x, 0, z - n.pos.z),
          distance = delta.length();
        if (distance < 0.25) {
          n.waypoint = (n.waypoint + 1) % n.route.length;
          n.pause = 1.5 + Math.random() * 2;
        } else {
          speed = 1.25;
          delta.normalize();
          const p = zone === "castle" ? castle.move(n.pos, delta.x * speed * dt, delta.z * speed * dt, 0.3) : moveCircle(n.pos, delta.x * speed * dt, delta.z * speed * dt, getColliders(), getBounds(), 0.3);
          n.pos.x = p.x;
          n.pos.z = p.z;
          n.pos.y = zone === "castle" ? p.y : height(p.x, p.z);
          const yaw = Math.atan2(delta.x, delta.z),
            diff = Math.atan2(Math.sin(yaw - n.actor.root.rotation.y), Math.cos(yaw - n.actor.root.rotation.y));
          n.actor.root.rotation.y += diff * (1 - Math.exp(-4 * dt));
        }
      }
    }
    // people notice you: they turn their eyes and head when you come close in front of them
    n.gazeT = (n.gazeT || 0) - dt;
    if (n.gazeT <= 0) {
      n.gazeT = 0.3 + Math.random() * 0.2;
      const dx = playerPos.x - n.pos.x,
        dz = playerPos.z - n.pos.z,
        d = Math.hypot(dx, dz),
        rel = Math.atan2(Math.sin(Math.atan2(dx, dz) - n.actor.root.rotation.y), Math.cos(Math.atan2(dx, dz) - n.actor.root.rotation.y));
      // students chatting in pairs keep their eyes on each other
      const target = n.life && n.state === "chat" && n.partner && n !== dialogueNpc ? n.partner.actor.head : d < 6 && Math.abs(rel) < 1.9 ? player.head : null;
      n.actor.lookAt?.(target, target ? 1 : 0);
    }
    n.actor.update(dt, elapsed, speed, (n === dialogueNpc && n.actor.speaking?.()) || !!n.talking);
  }
  for (const e of entities) {
    if (e.hidden) continue;
    if (e.type === "enemy") {
      e.pos.y = damp(e.pos.y, e.baseY + (elapsed < e.stunned ? 2.2 : 0), 5, dt);
      e.model.root.rotation.y = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
      e.hit = Math.max(0, e.hit - dt);
      e.model.body.rotation.z = Math.sin(e.hit * 50) * e.hit * 0.5;
      e.model.gem.rotation.y += dt;
      e.attack -= dt;
      const active = e.boss ? state.stage === 6 : state.stage === 3;
      if (active && elapsed > e.stunned && e.pos.distanceTo(playerPos) < (e.boss ? 24 : 17) && e.attack < 0) {
        e.attack = e.boss ? 1.65 : 3.8;
        lastCombat = elapsed;
        const from = e.pos.clone().add(V(0, e.boss ? 2 : 1.5, 0)),
          to = playerPos.clone().add(V(0, 1, 0));
        effects.projectile(from, to, { color: e.boss ? "#b788ef" : "#dda268", hostile: true, damage: e.boss ? 19 : 9 });
      }
      if (active && e.attack < 0.7 && elapsed > e.stunned) e.model.gem.scale.setScalar(1 + Math.sin(elapsed * 20) * 0.25);
      else e.model.gem.scale.setScalar(1);
    } else if (e.type === "stone") {
      e.pos.y = damp(e.pos.y, e.baseY + (elapsed < e.stunned ? 2 + Math.sin(elapsed * 2) * 0.15 : 0), 4, dt);
      e.mesh.rotation.y += dt * 0.3;
    } else if (e.type === "rune" || e.type === "herb") {
      e.mesh.position.y = e.baseY + Math.sin(elapsed * 1.4 + e.pos.x) * 0.08;
      e.mesh.rotation.y += dt * 0.25;
    }
  }
}
function objectiveEntity() {
  const stage = state.stage;
  if (stage === 0) return entities.find((e) => e.id === "minerva");
  if (stage === 1) return entities.find((e) => e.id === "flitwick") || entities.find((e) => e.id === "charms-door");
  if (stage === 2)
    return entities.find((e) => e.type === "stone" && !state.levitated.includes(e.id)) || entities.find((e) => e.id === "charms-door");
  if (stage === 3)
    return (
      entities.find((e) => e.type === "enemy" && !e.boss && !e.hidden) || entities.find((e) => e.id === "exit" || e.id === "castle-return")
    );
  if (stage === 4 || stage === 7) return entities.find((e) => e.id === "hagrid" || e.id === "grounds-door" || e.id === "exit");
  if (stage === 5)
    return (
      entities.find((e) => e.type === "rune" && !state.runes.includes(e.id)) ||
      entities.find((e) => e.id === "grounds-door" || e.id === "exit")
    );
  if (stage === 6) return entities.find((e) => e.boss && !e.hidden) || entities.find((e) => e.id === "grounds-door" || e.id === "exit");
  return null;
}
function updateInteraction() {
  for (const e of entities) {
    if (e.type === "door" && e.mesh?.userData.label) e.mesh.userData.label.visible = false;
    if (e.type === "npc") {
      e.actor.root.children.forEach((o) => {
        if (o.isSprite) o.visible = e.pos.distanceTo(playerPos) > 4 && e.pos.distanceTo(playerPos) < 10;
      });
    }
  }
  nearby = null;
  let distance = Infinity;
  for (const e of duels.active ? [] : entities) {
    if (e.type === "enemy" || e.type === "spirit" || e.hidden || (e.life && !e.active)) continue;
    const d = e.pos.distanceTo(playerPos),
      range = e.type === "npc" ? 3.1 : e.type === "door" ? 2.4 : 2.5;
    if (d < range && d < distance) {
      nearby = e;
      distance = d;
    }
  }
  $("#interact").hidden = !nearby;
  if (nearby) {
    $("#interaction-name").textContent = nearby.name;
    $("#interaction-kind").textContent =
      nearby.kind ||
      { npc: "ROZMOWA", door: "PRZEJDŹ", herb: "ZBIERZ", chest: "OTWÓRZ", stone: "ZAKLĘCIE", rune: "STARA MAGIA", page: "ZNALEZISKO" }[nearby.type];
  }
  target = targetForSpell();
  $("#target-hud").hidden = !target;
  if (target) {
    $("#target-name").textContent = target.name;
    $("#target-health").style.width = (target.type === "enemy" || target.type === "duelist" ? (target.hp / target.maxHp) * 100 : 100) + "%";
  }
  const goal = objectiveEntity();
  if (goal) {
    const p = goal.pos
      .clone()
      .add(V(0, 3.1, 0))
      .project(camera);
    const d = goal.pos.distanceTo(playerPos);
    questMarker.hidden = p.z > 1 || p.z < -1 || Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.85 || d < 2.5;
    questMarker.style.left = (p.x * 0.5 + 0.5) * innerWidth + "px";
    questMarker.style.top = (-p.y * 0.5 + 0.5) * innerHeight + "px";
    questMarker.innerHTML = `<strong>◇</strong><small>${Math.round(d)} m</small>`;
  } else questMarker.hidden = true;
  guideMesh.visible = elapsed < guideUntil && !!goal;
  if (guideMesh.visible) {
    const delta = goal.pos.clone().sub(playerPos),
      length = Math.min(13, delta.length());
    delta.y = 0;
    delta.normalize();
    for (let i = 0; i < 45; i++) {
      const d = (i / 44) * length + ((elapsed * 0.7) % 1),
        x = playerPos.x + delta.x * d,
        z = playerPos.z + delta.z * d;
      guideArray.set([x, height(x, z) + 0.12 + Math.sin(i * 0.5 + elapsed * 3) * 0.04, z], i * 3);
    }
    guideGeo.attributes.position.needsUpdate = true;
  }
}
const radar = $("#radar"),
  ctx = radar.getContext("2d");
function drawRadar() {
  const size = 190,
    c = size / 2,
    scale = zone === "courtyard" ? 3 : room || zone === "castle" ? 2.5 : 0.6;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, 93, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#12272cd9";
  ctx.fillRect(0, 0, size, size);
  ctx.translate(c, c);
  ctx.rotate(-look.yaw);
  const xy = (x, z) => [(x - playerPos.x) * scale, (z - playerPos.z) * scale];
  ctx.strokeStyle = "#b4b99318";
  ctx.lineWidth = 1;
  for (let i = -100; i <= 100; i += 20) {
    ctx.beginPath();
    ctx.moveTo(-100, i);
    ctx.lineTo(100, i);
    ctx.moveTo(i, -100);
    ctx.lineTo(i, 100);
    ctx.stroke();
  }
  ctx.fillStyle = "#76898145";
  const coll = getColliders();
  for (const b of coll) {
    const p = xy(b.x, b.z);
    if (b.r) {
      ctx.beginPath();
      ctx.arc(...p, b.r * scale, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(p[0] - (b.w * scale) / 2, p[1] - (b.d * scale) / 2, b.w * scale, b.d * scale);
  }
  const goal = objectiveEntity();
  for (const e of entities) {
    if (e.hidden) continue;
    const p = xy(e.pos.x, e.pos.z);
    ctx.fillStyle =
      e === goal ? "#f2cd7a" : e.type === "enemy" ? "#ce8a72" : e.type === "door" ? "#a9c3d0" : e.type === "npc" ? "#a1baa4" : "#82956b";
    ctx.beginPath();
    ctx.arc(p[0], p[1], e === goal ? 4 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(c, c);
  ctx.fillStyle = "#f5e9cd";
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 5);
  ctx.lineTo(0, 2);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#c7ad6b44";
  ctx.beginPath();
  ctx.arc(c, c, 65, 0, Math.PI * 2);
  ctx.stroke();
  $("#radar-label").textContent = room || zone === "castle" ? "HOGWART" : zone === "courtyard" ? "DZIEDZINIEC" : "BŁONIA";
  const angle = ((((look.yaw * 180) / Math.PI) % 360) + 360) % 360;
  $("#bearing").textContent = ["N", "NW", "W", "SW", "S", "SE", "E", "NE"][Math.round(angle / 45) % 8];
}

function panel(html, label = "HOGWART · SZLAKI MAGII") {
  disposeActivity();
  releasePointer();
  closeDialogue();
  $("#panel-kicker").textContent = label;
  $("#panel-content").innerHTML = html;
  if (!$("#panel").open) $("#panel").showModal();
}
function showCurrentActivity() {
  if (!roomId || !ACTIVITIES[roomId]) return;
  const id = roomId,
    info = ROOMS.find((r) => r.id === id);
  panel("", info.name.toLocaleUpperCase("pl") + " · PRAKTYKA");
  activeActivity = openRoomActivity(id, {
    panel: $("#panel-content"),
    state,
    audio,
    toast,
    complete: (completed) => {
      const before = level(state);
      if (!finishRoom(state, completed)) return;
      if (level(state) > before) {
        health = stats(state).health;
        mana = stats(state).mana;
      }
      save();
      refreshHUD();
    },
  });
}
function showJournal(tab = "quests") {
  const tabs = `<div class="panel-tabs">${[
    ["quests", "Zadania"],
    ["practice", "Praktyka"],
    ["talents", "Talenty"],
    ["inventory", "Ekwipunek"],
    ["spells", "Zaklęcia"],
    ["lessons", "Lekcje"],
  ]
    .map(([id, name]) => `<button data-journal="${id}" class="${id === tab ? "active" : ""}">${name}</button>`)
    .join("")}</div>`;
  let content = "";
  if (tab === "quests")
    content = `<h2>Światło między drzewami</h2><p>Rozdział I · ${state.stage} / 8 etapów ukończonych</p>${QUESTS.slice(0, 8)
      .map(
        (q, i) =>
          `<div class="quest-row ${i < state.stage ? "done" : ""}"><span>${i < state.stage ? "✓" : i === state.stage ? "◇" : "·"}</span><div><strong>${q.title}</strong><p>${i <= state.stage ? q.objective : "Dalszy ciąg opowieści…"}</p>${i === state.stage ? `<p>${q.hint}</p>` : ""}</div></div>`,
      )
      .join("")}`;
  if (tab === "practice")
    content = `<h2>Praktyka w Hogwarcie</h2><p>${ROOMS.filter((r) => state.roomsCompleted.includes(r.id)).length} / ${ROOMS.length} ćwiczeń zaliczonych. Pierwsze zaliczenie: +${ROOM_REWARD.xp} PD i +${ROOM_REWARD.coins} galeonów.</p><div class="room-grid">${ROOMS.map((r) => `<button data-practice-room="${r.id}"><span class="practice-status">${state.roomsCompleted.includes(r.id) ? "✓ ZALICZONE" : "DO ODKRYCIA"}</span>${safe(r.name)}<small>${safe(ACTIVITIES[r.id].title)}</small></button>`).join("")}</div>`;
  if (tab === "talents")
    content = `<h2>Talenty</h2><p>Poziom ${level(state)} · ${points(state)} pkt talentów do wydania. Każde 200 PD daje kolejny poziom.</p><div class="talent-grid">${[
      ["power", "ϟ", "Siła zaklęć", "Każdy stopień zwiększa obrażenia czarów o 6."],
      ["focus", "✧", "Skupienie", "Każdy stopień daje +20 mocy i +2 regeneracji na sekundę."],
      ["vitality", "♡", "Wytrzymałość", "Każdy stopień dodaje 25 maksymalnego zdrowia."],
    ]
      .map(
        ([id, icon, title, desc]) =>
          `<div class="talent-card"><span>${icon}</span><h3>${title}</h3><p>${desc}</p><button data-talent="${id}" ${points(state) < 1 || state.talents[id] >= 3 ? "disabled" : ""}>${"◆".repeat(state.talents[id])}${"◇".repeat(3 - state.talents[id])} · Rozwiń</button></div>`,
      )
      .join("")}</div>`;
  if (tab === "inventory")
    content = `<h2>Torba ucznia</h2><div class="stats-grid"><div><strong>${state.coins}</strong><small>GALEONY</small></div><div><strong>${state.herbs}</strong><small>LIŚCIE DITTANY</small></div><div><strong>${state.potions}</strong><small>ELIKSIRY ZDROWIA</small></div></div><div class="item-row"><span>✧</span><div><h3>Twoja różdżka</h3><p>Jesion · smocze serce · 12 cali. Stały towarzysz Twojej pierwszej przygody.</p></div></div><div class="item-row"><span>♧</span><div><h3>Eliksir zdrowia</h3><p>Przywraca 65 punktów zdrowia. Użyj R w grze. Trzy liście dittany wystarczą na jedną porcję w lochach Snape’a.</p></div></div><p>Postęp zapisuje się automatycznie w tej przeglądarce. Atlas Hogwartu ma osobny zapis.</p>`;
  if (tab === "spells")
    content = `<h2>Księga zaklęć</h2>${ABILITIES.map((a) => `<div class="item-row"><span style="font-size:30px;color:${a.color}">${a.icon}</span><div><h3>${a.name} ${unlocked(state, a.id) ? "" : "· zamknięte"}</h3><p>${a.desc}<br>${a.cost} mocy · odnowienie ${a.cooldown} s · klawisz ${a.key}</p></div></div>`).join("")}`;
  if (tab === "lessons") {
    const taught = ROOMS.filter((r) => r.professor && r.lesson && PATTERNS[r.lesson.gesture]);
    content = `<h2>Lekcje i biegłość</h2><p>Profesor pokazuje ruch różdżki, a Ty powtarzasz go na tabliczce. Trzy czyste próby podnoszą biegłość zaklęcia, najwyżej do ★★★. Lumos i Leviosę ćwiczysz u mistrza zaklęć, Protego i Expelliarmus w sali obrony albo u mistrza pojedynków na dziedzińcu.</p>${ABILITIES.filter((a) => SPELL_PATTERN[a.id])
      .map((a) => `<div class="item-row"><span style="font-size:30px;color:${a.color}">${a.icon}</span><div><h3>${a.name} <span class="mastery-stars">${stars(mastery(a.id))}</span></h3><p>Ruch: ${PATTERNS[SPELL_PATTERN[a.id]].name}. ${MASTERY_EFFECT[a.id] || ""} Ukończone lekcje: ${state.lessons[a.id] || 0}.</p></div></div>`)
      .join("")}<h3 class="lesson-sub">Lekcje w salach · ${taught.filter((r) => state.lessons[r.id]).length} / ${taught.length}</h3><div class="room-grid">${taught
      .map((r) => `<button data-practice-room="${r.id}"><span class="practice-status">${state.lessons[r.id] ? "✓ ZALICZONA" : "DO ODBYCIA"}</span>${safe(r.lesson.title)}<small>${safe(r.name)} · ${safe(r.professor)} · ruch: ${PATTERNS[r.lesson.gesture].name}</small></button>`)
      .join("")}</div>`;
  }
  panel(tabs + content, "DZIENNIK · " + state.name.toUpperCase());
  $$("[data-practice-room]").forEach((b) => (b.onclick = () => travel(b.dataset.practiceRoom)));
  $$("[data-journal]").forEach((b) => (b.onclick = () => showJournal(b.dataset.journal)));
  $$("[data-talent]").forEach(
    (b) =>
      (b.onclick = () => {
        if (upgrade(state, b.dataset.talent)) {
          health = Math.min(stats(state).health, health + 25);
          mana = Math.min(stats(state).mana, mana + 20);
          save();
          refreshHUD();
          showJournal("talents");
        }
      }),
  );
}
function showMap() {
  panel(
    `<h2>Mapa Hogwartu</h2><p>Wybierz punkt podróży lub wróć do pieszej eksploracji. Złoty znacznik wskazuje bieżące zadanie.</p><div class="map-layout"><svg class="map-illustration" viewBox="0 0 360 340" role="img" aria-label="Schemat błoni"><path d="M36 100Q65 40 150 38T315 91L330 249Q237 319 143 292T34 218Z"/><path d="M178 156L76 178L59 90M178 156L274 73M178 156L201 253" stroke-dasharray="4 5"/><path d="M104 231Q210 173 292 218T188 294T104 231Z" style="fill:#4a7c8b33"/><path d="M53 119L72 62L88 123M70 124L95 74L113 131M93 134L121 91L140 142"/><circle cx="178" cy="156" r="7"/><circle cx="76" cy="178" r="4"/><circle cx="59" cy="90" r="4"/><circle cx="274" cy="73" r="4"/><text x="189" y="154">Hogwart</text><text x="75" y="197">Chatka Hagrida</text><text x="33" y="50">Zakazany Las</text><text x="241" y="58">Hogsmeade</text><text x="177" y="252">Czarne Jezioro</text><text x="145" y="320" style="font-size:8px">SCHEMAT ORIENTACYJNY</text></svg><div class="travel-list">${[
      ["courtyard", "Dziedziniec"],
      ["castle", "Sala Wejściowa · wnętrze zamku"],
      ["charms", "Sala zaklęć"],
      ["great-hall", "Wielka Sala"],
      ["potions", "Lochy eliksirów"],
      ["grounds", "Błonia · droga do Hagrida"],
      ["forest", "Skraj Zakazanego Lasu"],
      ["hogsmeade", "Hogsmeade"],
    ]
      .map(
        ([id, name]) => `<button data-travel="${id}">${name}<small>${state.visited.includes(id) ? "ODKRYTE" : "PODRÓŻ"} →</small></button>`,
      )
      .join("")}<button id="map-rooms">Pozostałe sale Hogwartu <small>${ROOMS.length} WNĘTRZ →</small></button></div></div>`,
    "MAPA ŚWIATA",
  );
  $$("[data-travel]").forEach((b) => (b.onclick = () => travel(b.dataset.travel)));
  $("#map-rooms").onclick = showRooms;
}
function showRooms() {
  const completed = ROOMS.filter((r) => state.roomsCompleted.includes(r.id)).length;
  panel(
    `<h2>Za drzwiami Hogwartu</h2><p>${completed} / ${ROOMS.length} ćwiczeń zaliczonych. W każdej sali znajdziesz odrębną scenografię i stanowisko praktyki po prawej stronie wejścia. Porozmawiaj z profesorem lub podejdź do stanowiska i naciśnij E.</p><input id="room-search" aria-label="Szukaj sali" placeholder="Szukaj miejsca, profesora lub ćwiczenia…"><div class="room-grid" id="room-list"></div>`,
    "KORYTARZE SZKOŁY",
  );
  const render = () => {
    const q = $("#room-search").value.toLocaleLowerCase("pl");
    $("#room-list").innerHTML = ROOMS.filter((r) =>
      (r.name + " " + r.professor + " " + ACTIVITIES[r.id].title).toLocaleLowerCase("pl").includes(q),
    )
      .map(
        (r) =>
          `<button data-room="${r.id}"><span class="practice-status">${state.roomsCompleted.includes(r.id) ? "✓ ZALICZONE" : state.visited.includes(r.id) ? "ODKRYTE" : "DO ODKRYCIA"}</span>${safe(r.name)}<small>${safe(ACTIVITIES[r.id].title)}</small></button>`,
      )
      .join("");
    $$("[data-room]").forEach((b) => (b.onclick = () => travel(b.dataset.room)));
  };
  $("#room-search").oninput = render;
  render();
}
function setQuality(q, announce = false) {
  quality = q;
  state.quality = q;
  graphics.setQuality(q);
  environment.setQuality(q);
  atmosphere.setQuality(q);
  sun.shadow.mapSize.setScalar(q === "ultra" ? 4096 : q === "high" ? 2048 : 1024);
  charShadows.setQuality(q);
  castle?.setLightBudget(q === "ultra" ? 8 : q === "high" ? 6 : 4);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  refreshShadows();
  if (announce) {
    save();
    toast("Grafika: " + { ultra: "Ultra", high: "Wysoka", balanced: "Płynność" }[q]);
  }
}
function showMenu() {
  panel(
    `<h2>Ustawienia gry</h2><p>Gra jest wstrzymana. Twój zapis jest niezależny od atlasu Hogwartu.</p><div class="settings-row"><div>Jakość grafiki<small>Ultra: odbicia, cienie 4K, kontaktowe cieniowanie. Płynność: lżejszy rendering.</small></div><select id="quality-select" aria-label="Jakość grafiki">${[
      ["balanced", "Płynność"],
      ["high", "Wysoka"],
      ["ultra", "Ultra"],
    ]
      .map(([v, n]) => `<option value="${v}" ${quality === v ? "selected" : ""}>${n}</option>`)
      .join(
        "",
      )}</select></div><div class="settings-row"><div>Pora dnia<small>Zmiana dotyczy otoczenia zamku.</small></div><button id="change-time">${["Złota godzina", "Noc", "Poranek"][timeMode]} ↻</button></div><div class="settings-row"><div>Dźwięk<small>Subtelne tło, kroki i dźwięki zaklęć.</small></div><button id="sound-toggle">${audio.enabled ? "Włączony" : "Wyłączony"}</button></div><div class="menu-buttons"><button class="primary" id="resume">Wróć do gry →</button><button id="controls-help">Sterowanie</button><button id="accessibility">Dostępność</button><button id="about-game">O projekcie</button><button id="return-title">Ekran tytułowy</button></div>`,
    "PAUZA",
  );
  $("#quality-select").onchange = (e) => {
    state.qualityManual = true;
    setQuality(e.target.value, true);
  };
  $("#change-time").onclick = () => {
    timeMode = (timeMode + 1) % 3;
    setLighting();
    $("#change-time").textContent = ["Złota godzina", "Noc", "Poranek"][timeMode] + " ↻";
  };
  $("#sound-toggle").onclick = () => {
    state.sound = audio.toggle();
    save();
    $("#sound-toggle").textContent = audio.enabled ? "Włączony" : "Wyłączony";
  };
  $("#resume").onclick = () => $("#panel").close();
  $("#controls-help").onclick = showControls;
  $("#accessibility").onclick = showAccessibility;
  $("#about-game").onclick = showAbout;
  $("#return-title").onclick = () => {
    save();
    $("#panel").close();
    switchZone("courtyard");
    playing = false;
    $("#hud").hidden = true;
    $("#title-screen").hidden = false;
    $("#continue-game").hidden = false;
    player.root.visible = false;
  };
}
function applyPreferences() {
  graphics.setGrain?.(!state.reducedMotion);
  document.body.classList.toggle("large-text", state.largeText);
  document.body.classList.toggle("high-contrast", state.highContrast);
  document.body.classList.toggle("reduced-motion", state.reducedMotion);
}
function showAccessibility() {
  panel(
    `<h2>Dostępność</h2><p>Dostosuj czytelność interfejsu. Ustawienia są zapisywane razem z Twoją grą.</p>${[
      ["largeText", "Większy tekst", "Powiększa tekst zadań, dialogów i menu."],
      ["highContrast", "Wysoki kontrast", "Dodaje nieprzezroczyste tła pod ważnymi informacjami."],
      ["reducedMotion", "Ograniczony ruch i błyski", "Wyłącza błyski obrażeń, animacje interfejsu i ruch panoramy w menu."],
    ]
      .map(
        ([id, title, desc]) =>
          `<div class="settings-row"><div>${title}<small>${desc}</small></div><button data-pref="${id}" aria-pressed="${state[id]}">${state[id] ? "Włączone" : "Wyłączone"}</button></div>`,
      )
      .join(
        "",
      )}<p>Informacje o czarach mają nazwę, symbol i numer klawisza. Postęp zadań jest podany tekstem; kolor nie jest jedyną wskazówką.</p>`,
    "DOSTĘPNOŚĆ",
  );
  $$("[data-pref]").forEach(
    (b) =>
      (b.onclick = () => {
        const key = b.dataset.pref;
        state[key] = !state[key];
        applyPreferences();
        save();
        showAccessibility();
      }),
  );
}
function showControls() {
  panel(
    `<h2>Sterowanie</h2><div class="item-row"><kbd>W A S D</kbd><p>Ruch względem kamery. Shift — sprint. Alt — unik z krótką niewrażliwością.</p></div><div class="item-row"><kbd>PPM</kbd><p>Przytrzymaj prawy przycisk i poruszaj myszą, aby się rozejrzeć. Scroll przybliża kamerę. Strzałki ← i → obracają kamerę z klawiatury. „Zablokuj kursor” włącza stałe rozglądanie; Esc uwalnia kursor.</p></div><div class="item-row"><kbd>1–5</kbd><p>Wybierz zaklęcie. Lewy przycisk myszy lub Spacja rzuca je na cel przed Tobą. Podejdź bliżej, aby trafić.</p></div><div class="item-row"><kbd>E</kbd><p>Rozmowa, zebranie przedmiotu lub przejście przez drzwi. R — eliksir. G — świetlista wskazówka. M — mapa. J — dziennik.</p></div><p>Na ekranie dotykowym przeciągnij widok, użyj strzałek i przycisku różdżki. Stuknij komunikat rozmowy lub przejścia. Wszystkie dialogi mają przyciski odpowiedzi.</p>`,
    "STEROWANIE",
  );
}
function showAbout() {
  panel(
    `<h2>Nowa historia. Ten sam magiczny świat.</h2><p>„Szlaki Magii” to osobny, fanowski prototyp RPG. Pierwszy grywalny rozdział zawiera osiem etapów zadania, dialogi, walkę zaklęciami, zbieranie składników, eliksiry, doświadczenie i talenty.</p><p>Scenografia wykorzystuje modele i materiały z naszego atlasu. Nowe sterowanie, postacie, animacje, przeciwnicy, dialogi i zapis należą wyłącznie do gry. Wnętrza są osobnymi scenami połączonymi drzwiami i mapą; zamek jest interpretacją filmową, nie rekonstrukcją 1:1. Każde z 40 wnętrz ma własne dekoracje i ćwiczenie: zagadkę, manipulację przedmiotami lub próbę taktyczną. Pierwsze zaliczenia dają doświadczenie i monety; kolejne podejścia służą treningowi. Ćwiczenia odbywają się na osobnych planszach, a walka i główna nauka zaklęć w świecie 3D.</p><p>Proceduralne modele i animacje są autorskie. Fotograficzne tekstury PBR: Poly Haven, CC0. Three.js: MIT. Font Cormorant: SIL Open Font License. Dialogi i zadania są oryginalne. Projekt nie jest oficjalną grą Warner Bros. ani Portkey Games.</p><p class="source-links"><a href="https://polyhaven.com/a/stone_brick_wall_001" target="_blank" rel="noreferrer">Kamień</a><a href="https://polyhaven.com/a/wood_floor_worn" target="_blank" rel="noreferrer">Drewno</a><a href="https://polyhaven.com/a/rocky_terrain_02" target="_blank" rel="noreferrer">Teren</a></p>`,
    "O PROJEKCIE I ŹRÓDŁACH",
  );
}
$("#houses").innerHTML = Object.entries(HOUSES)
  .map(
    ([id, h]) =>
      `<button data-house="${id}" style="--house:${h.color}" class="${state.house === id ? "selected" : ""}"><i>◇</i>${h.name}</button>`,
  )
  .join("");
let chosenHouse = state.house;
$$("[data-house]").forEach(
  (b) =>
    (b.onclick = () => {
      chosenHouse = b.dataset.house;
      $$("[data-house]").forEach((x) => x.classList.toggle("selected", x === b));
    }),
);
$("#player-name").value = state.name;
$("#continue-game").hidden = !state.started;
function start(resume = false) {
  if (!resume) {
    if (state.started) {
      panel(
        '<h2>Nowa przygoda?</h2><p>Rozpoczęcie nowej przygody zastąpi zapis tej gry w tej przeglądarce. Zapis atlasu pozostanie bez zmian.</p><div class="menu-buttons"><button class="primary" id="confirm-new">Rozpocznij od nowa</button><button id="cancel-new">Zachowaj zapis</button></div>',
      );
      $("#confirm-new").onclick = () => {
        const keep = Object.fromEntries(["quality", "qualityManual", "sound", "largeText", "highContrast", "reducedMotion"].map((k) => [k, state[k]]));
        state = Object.assign(newState(), keep);
        $("#panel").close();
        start(false);
      };
      $("#cancel-new").onclick = () => $("#panel").close();
      return;
    }
    state.house = chosenHouse;
    state.name = $("#player-name").value.trim().slice(0, 24) || "Adept";
    state.started = true;
  }
  player.setColor(HOUSES[state.house].color);
  health = stats(state).health;
  mana = stats(state).mana;
  playing = true;
  $("#title-screen").hidden = true;
  $("#hud").hidden = false;
  player.root.visible = true;
  switchZone("courtyard");
  save();
  if (state.sound && !audio.enabled) audio.toggle();
  toast(resume ? "Witaj ponownie. Twój postęp został wczytany." : "WASD — ruch · PPM — kamera · E — rozmowa");
}
$("#start-game").onclick = () => start(false);
$("#continue-game").onclick = () => start(true);
$("#about-title").onclick = showAbout;
$("#open-journal").onclick = () => showJournal();
$("#open-map").onclick = showMap;
$("#open-menu").onclick = showMenu;
$("#close-panel").onclick = () => $("#panel").close();
$("#leave-dialogue").onclick = closeDialogue;
$("#interact").onclick = interact;
$("#potion").onclick = potion;
$("#guide-button").onclick = () => {
  guideUntil = elapsed + 20;
  toast(QUESTS[state.stage].hint);
};
$("#mobile-cast").onclick = cast;
$("#mobile-dodge").onclick = dodge;
$("#panel").addEventListener("close", () => {
  keys.clear();
  disposeActivity();
});
$("#panel").addEventListener("click", (e) => {
  if (e.target === $("#panel")) {
    const b = $("#panel").getBoundingClientRect();
    if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) $("#panel").close();
  }
});
$("#mouse-lock").onclick = () => {
  renderer.domElement.requestPointerLock?.();
};
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea")) return;
  if (e.code === "Escape") {
    if (dialogueNpc) {
      closeDialogue();
      e.preventDefault();
    } else if (!$("#panel").open && playing && !document.pointerLockElement) showMenu();
    return;
  }
  if (!playing) return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "AltLeft", "AltRight"].includes(e.code)) e.preventDefault();
  if (dialogueNpc && !e.repeat) {
    if (dialogueLine && ["Space", "Enter", "KeyE"].includes(e.code)) finishLine();
    else if (/^Digit[1-9]$/.test(e.code)) $$("[data-choice]")[Number(e.code.at(-1)) - 1]?.click();
    return;
  }
  if (paused()) return;
  keys.add(e.code);
  if (e.repeat) return;
  if (/^Digit[1-5]$/.test(e.code)) selectSpell(Number(e.code.at(-1)) - 1);
  if (e.code === "KeyE") interact();
  if (e.code === "Space") cast();
  if (e.code === "KeyR") potion();
  if (e.code === "KeyJ") showJournal();
  if (e.code === "KeyM") showMap();
  if (e.code === "KeyG") {
    guideUntil = elapsed + 20;
    toast(QUESTS[state.stage].hint);
  }
  if (e.code === "AltLeft" || e.code === "AltRight") dodge();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  dragging = false;
});
document.addEventListener("visibilitychange", () => keys.clear());
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (paused()) return;
  if (e.button === 2 || e.pointerType === "touch") {
    dragging = true;
    pointerId = e.pointerId;
    lastPointer = { x: e.clientX, y: e.clientY };
    renderer.domElement.setPointerCapture(e.pointerId);
  } else if (e.button === 0) cast();
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (paused()) return;
  if (document.pointerLockElement === renderer.domElement || (dragging && e.pointerId === pointerId)) rig.yawInput();
  if (document.pointerLockElement === renderer.domElement) {
    look.yaw -= e.movementX * 0.0035;
    look.pitch = clamp(look.pitch + e.movementY * 0.0025, -0.25, 0.8);
  } else if (dragging && e.pointerId === pointerId) {
    look.yaw -= (e.clientX - lastPointer.x) * 0.006;
    look.pitch = clamp(look.pitch + (e.clientY - lastPointer.y) * 0.004, -0.25, 0.8);
    lastPointer = { x: e.clientX, y: e.clientY };
  }
});
const pointerUp = () => (dragging = false);
renderer.domElement.addEventListener("pointerup", pointerUp);
renderer.domElement.addEventListener("pointercancel", pointerUp);
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (paused()) return;
    e.preventDefault();
    look.distance = clamp(look.distance + e.deltaY * 0.006, 2, 9);
  },
  { passive: false },
);
$$("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    keys.add(b.dataset.key);
    b.setPointerCapture(e.pointerId);
  };
  const stop = () => keys.delete(b.dataset.key);
  b.onpointerup = stop;
  b.onpointercancel = stop;
  b.onlostpointercapture = stop;
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  graphics.resize(innerWidth, innerHeight);
});
window.addEventListener("pagehide", () => {
  if (state.started) save();
});
function fixedStep(dt) {
  elapsed += dt;
  updateMovement(dt);
  // castle residents live on the floor you are on; the rest wait, hidden
  if (zone === "castle" && life) {
    const band = castleBand(playerPos.y);
    life.setActive(band);
    if (!dialogueNpc) life.update(dt, elapsed, playerPos, player, band, { douse: (p) => castle.douse(p, elapsed) });
  }
  updateActors(dt);
  duels.update(dt, elapsed);
  if (duels.active) lastCombat = elapsed;
  effects.update(dt, playerPos, hurt);
}
// test hook: advance the simulation quickly (software renderers are slow)
function simulate(seconds, held = []) {
  for (const k of held) keys.add(k);
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    fixedStep(1 / 60);
    if (zone === "castle" && castle && i % 6 === 0) castle.update(0.1, elapsed, playerPos, camera, { onRide: (d) => ((player.root.rotation.y += d), (look.yaw += d)) });
    updateCamera(1 / 60);
  }
  for (const k of held) keys.delete(k);
}
let last = performance.now(),
  accumulator = 0,
  frames = 0,
  frameSeconds = 0,
  uiTick = 0,
  slowSeconds = 0,
  adapted = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const wallDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const running = !paused();
  if (running) {
    accumulator += wallDt;
    while (accumulator >= 1 / 60) {
      fixedStep(1 / 60);
      accumulator -= 1 / 60;
    }
    updateCamera(wallDt);
    uiTick += wallDt;
    if (uiTick > 0.09) {
      uiTick = 0;
      updateInteraction();
      drawRadar();
      if (zone === "castle") {
        const cell = castle.cellAt(playerPos);
        const name = roomId ? ROOMS.find((r) => r.id === roomId)?.name : CELL_NAMES[cell] || CELL_NAMES[String(cell).replace(/^door:/, "")] || "Hogwart";
        if (name && $("#location-name").textContent !== name) $("#location-name").textContent = name;
        for (const o of owned) if (o.userData?.castleSign) o.visible = Math.abs(o.position.y - 4.6 - playerPos.y) < 3 && o.position.distanceTo(playerPos) < 16;
      }
      $("#health-fill").style.width = (health / stats(state).health) * 100 + "%";
      $("#health-label").textContent = Math.ceil(health) + " / " + stats(state).health;
      $("#mana-fill").style.width = (mana / stats(state).mana) * 100 + "%";
      $("#mana-label").textContent = Math.ceil(mana) + " / " + stats(state).mana;
      $$("[data-spell]").forEach((b, i) => {
        const remaining = (cooldowns.get(ABILITIES[i].id) || 0) - elapsed;
        const node = b.querySelector(".cooldown");
        node.hidden = remaining <= 0;
        if (remaining > 0) node.textContent = remaining.toFixed(1);
      });
    }
  } else {
    accumulator = 0;
    if (!playing) {
      const t = state.reducedMotion ? 0 : now * 0.000015;
      camera.position.set(155 + Math.sin(t) * 18, 93, 188);
      camera.lookAt(0, 43, 2);
      player.root.visible = false;
      guideMesh.visible = false;
    }
    if (dialogueNpc) {
      const t = now / 1000;
      updateDialogue(wallDt);
      player.update(wallDt, t, 0, player.speaking?.());
      for (const n of actors) if (!n.life || n.active) n.actor.update(wallDt, t, 0, n === dialogueNpc && n.actor.speaking?.());
    }
  }
  lessons.update(wallDt);
  // the wand is a light source: lumos glows on the face, every spell flashes
  const lumosOn = playing && elapsed < lumosUntil;
  player.setLumos?.(lumosOn);
  flash = Math.max(0, flash - wallDt * 5);
  if (playing && player.root.visible) {
    player.tipWorld?.(lumos.position);
    lumos.intensity = (lumosOn ? 7 : 0) + flash * 14;
    lumos.color.set("#ffe2a4").lerp(flashColor, Math.min(1, flash));
  } else lumos.intensity = 0;
  if (zone === "castle" && castle) {
    castle.update(wallDt, elapsed, playerPos, camera, {
      onTurn: () => audio.note(55, 1.6, "sawtooth", 0.012),
      onRide: (d) => {
        player.root.rotation.y += d;
        look.yaw += d;
      },
    });
    roomId = castle.roomAt(playerPos);
    if (playing && !transitioning && castle.exitAt(playerPos) === "courtyard") travel("courtyard", "castle");
  } else if (room) {
    room.update(elapsed);
    roomIdentity?.update(elapsed);
    activityProps?.update(elapsed);
  } else world.update(elapsed);
  environment.update(running ? wallDt : 0);
  sky.update(elapsed);
  atmosphere.update(running ? wallDt : 0, elapsed, playerPos);
  updateCharShadows();
  graphics.render(wallDt);
  frames++;
  frameSeconds += wallDt;
  if (frameSeconds >= 2) {
    const fps = Math.round(frames / frameSeconds);
    // Slow frames: first trade a little sharpness (dynamic resolution), then step the quality down.
    // A level the player picked in the settings is left alone.
    const r = graphics.resolutionScale;
    if (running && !document.hidden) {
      if (fps < 40 && r > 0.7) graphics.setResolutionScale(Math.max(0.7, r - 0.1));
      else if (fps > 56 && r < 1) graphics.setResolutionScale(r + 0.05);
    }
    $("#fps").textContent = fps + " FPS";
    if (running && !state.qualityManual && adapted < 2 && quality !== "balanced" && fps < 27 && r <= 0.71) slowSeconds += frameSeconds;
    else slowSeconds = 0;
    if (slowSeconds > 6) {
      adapted++;
      slowSeconds = 0;
      const next = quality === "ultra" ? "high" : "balanced";
      setQuality(next);
      graphics.setResolutionScale(1);
      save();
      toast(next === "high" ? "Grafika: Wysoka, żeby gra działała płynniej. Poziom zmienisz w ustawieniach." : "Włączono tryb Płynność. Poziom grafiki zmienisz w ustawieniach.");
    }
    frames = 0;
    frameSeconds = 0;
  }
}
// test and debugging hooks (harmless in play)
window.__hp = { sim: simulate, world, travel, get castle() { return castle; }, get velocity() { return velocity; }, get keys() { return [...keys]; }, get paused() { return paused(); }, get playerPos() { return playerPos; }, get entities() { return entities; }, get life() { return life; }, get nearby() { return nearby; }, get lessons() { return lessons; }, get charShadows() { return charShadows; }, get player() { return player; }, get rig() { return rig; }, talk: (id) => talk(entities.find((e) => e.id === id)), get state() { return state; }, get zone() { return zone; }, look };
applyPreferences();
setQuality(quality);
refreshHUD();
requestAnimationFrame(frame);
setTimeout(() => {
  $("#loading").hidden = true;
  $("#title-screen").hidden = false;
}, 800);
