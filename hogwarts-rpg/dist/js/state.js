export const SAVE_KEY = "hogwarts-rpg-v1";
export const HOUSES = {
  gryffindor: { name: "Gryffindor", color: "#b74940", trait: "Odwaga" },
  ravenclaw: { name: "Ravenclaw", color: "#547da9", trait: "Ciekawość" },
  hufflepuff: { name: "Hufflepuff", color: "#d2af57", trait: "Wytrwałość" },
  slytherin: { name: "Slytherin", color: "#508e78", trait: "Ambicja" },
};
export const ABILITIES = [
  {
    id: "basic",
    key: "1",
    name: "Podstawowy czar",
    icon: "ϟ",
    cost: 0,
    cooldown: 0.48,
    color: "#f3c27c",
    desc: "Szybki pocisk z różdżki. Trafia cel i przerywa jego atak.",
  },
  {
    id: "lumos",
    key: "2",
    name: "Lumos",
    icon: "☼",
    cost: 8,
    cooldown: 1,
    color: "#f7e5aa",
    desc: "Zapala różdżkę. Rozświetla leśne runy w promieniu 8 metrów.",
  },
  {
    id: "leviosa",
    key: "3",
    name: "Wingardium Leviosa",
    icon: "〰",
    cost: 16,
    cooldown: 2.5,
    color: "#bd9eff",
    desc: "Unosi kamienie i przeciwników na 4 sekundy. Nauka u Flitwicka.",
  },
  {
    id: "protego",
    key: "4",
    name: "Protego",
    icon: "◇",
    cost: 20,
    cooldown: 4.5,
    color: "#80d5e3",
    desc: "Tarcza blokuje trafienia przez 2,6 sekundy. Idealny blok oddaje manę.",
  },
  {
    id: "expelliarmus",
    key: "5",
    name: "Expelliarmus",
    icon: "✧",
    cost: 24,
    cooldown: 3,
    color: "#ff7a6b",
    desc: "Mocny czerwony pocisk i ogłuszenie. Dostępny od poziomu 2.",
  },
];
export const QUESTS = [
  {
    title: "Pierwszy krok",
    objective: "Porozmawiaj z profesor McGonagall na dziedzińcu.",
    hint: "Podejdź do złotego znacznika i naciśnij E.",
    reward: 50,
  },
  {
    title: "Sztuka lekkości",
    objective: "Odnajdź profesora Flitwicka w sali zaklęć.",
    hint: "Drzwi do sali są po zachodniej stronie dziedzińca.",
    reward: 60,
  },
  {
    title: "Ruch, intencja, magia",
    objective: "Unieś trzy runiczne kamienie zaklęciem Leviosa.",
    hint: "Wybierz 3, wyceluj w kamień i kliknij lub naciśnij Spację.",
    reward: 100,
  },
  {
    title: "Próba różdżki",
    objective: "Pokonaj trzy manekiny treningowe na dziedzińcu.",
    hint: "1: podstawowy czar · 4: Protego · Alt: unik.",
    reward: 140,
  },
  {
    title: "Niepokój na błoniach",
    objective: "Porozmawiaj z Hagridem przy jego chatce.",
    hint: "Wyjdź południową bramą. Świetlista ścieżka wskaże drogę.",
    reward: 60,
  },
  {
    title: "Światło między drzewami",
    objective: "Rozświetl trzy leśne runy zaklęciem Lumos.",
    hint: "Podejdź do każdej runy na 8 metrów i rzuć Lumos.",
    reward: 160,
  },
  {
    title: "Strażnik polany",
    objective: "Uspokój zbuntowaną zbroję w leśnym kręgu.",
    hint: "Unikaj fioletowych pocisków. Tarcza i lewitacja dają czas na kontratak.",
    reward: 220,
  },
  {
    title: "Powrót z opowieścią",
    objective: "Wróć do Hagrida po nagrodę.",
    hint: "Pierwsza przygoda dobiega końca. Hagrid czeka przy chatce.",
    reward: 150,
  },
  {
    title: "Twoja własna ścieżka",
    objective: "Odkrywaj szkołę, zbieraj składniki i rozwijaj talenty.",
    hint: "Rozdział ukończony. W dzienniku znajdziesz dalsze miejsca do odkrycia.",
    reward: 0,
  },
];
const finite = (x, d = 0) => (Number.isFinite(x) ? x : d);
export function newState() {
  return {
    version: 1,
    house: "ravenclaw",
    name: "Adept",
    started: false,
    xp: 0,
    stage: 0,
    levitated: [],
    runes: [],
    defeated: [],
    collected: [],
    roomsCompleted: [],
    visited: ["courtyard"],
    coins: 0,
    potions: 3,
    herbs: 0,
    talents: { power: 0, focus: 0, vitality: 0 },
    duels: { ada: 0, tymon: 0, wrzos: 0 },
    mastery: {},
    lessons: {},
    found: [],
    quality: "ultra",
    sound: false,
    largeText: false,
    highContrast: false,
    reducedMotion: false,
  };
}
export function hydrate(raw) {
  const d = newState();
  if (!raw || raw.version !== 1) return d;
  for (const key of ["levitated", "runes", "defeated", "collected", "visited", "roomsCompleted"])
    d[key] = Array.isArray(raw[key]) ? [...new Set(raw[key].filter((x) => typeof x === "string"))].slice(0, 500) : d[key];
  for (const key of ["xp", "coins", "potions", "herbs"]) d[key] = Math.max(0, Math.min(100000, Math.floor(finite(raw[key]))));
  d.stage = Math.max(0, Math.min(8, Math.floor(finite(raw.stage))));
  d.house = HOUSES[raw.house] ? raw.house : d.house;
  d.name = String(raw.name || "Adept").slice(0, 24);
  d.started = raw.started === true;
  d.sound = raw.sound === true;
  for (const key of ["largeText", "highContrast", "reducedMotion"]) d[key] = raw[key] === true;
  d.quality = ["ultra", "high", "balanced"].includes(raw.quality) ? raw.quality : "high";
  for (const key in d.talents) d.talents[key] = Math.min(3, Math.max(0, Math.floor(finite(raw.talents?.[key]))));
  for (const key in d.duels) d.duels[key] = Math.min(999, Math.max(0, Math.floor(finite(raw.duels?.[key]))));
  for (const [store, max] of [["mastery", 3], ["lessons", 99]])
    if (raw[store] && typeof raw[store] === "object")
      for (const [k, v] of Object.entries(raw[store]).slice(0, 80)) if (/^[a-z0-9-]{1,32}$/.test(k)) d[store][k] = Math.min(max, Math.max(0, Math.floor(finite(v))));
  d.found = Array.isArray(raw.found) ? [...new Set(raw.found.filter((x) => typeof x === "string"))].slice(0, 300) : [];
  if (spent(d) > level(d) - 1) d.talents = { power: 0, focus: 0, vitality: 0 };
  return d;
}
export const level = (s) => Math.min(10, 1 + Math.floor(s.xp / 200));
export const spent = (s) => Object.values(s.talents).reduce((a, b) => a + b, 0);
export const points = (s) => Math.max(0, level(s) - 1 - spent(s));
export const stats = (s) => ({
  health: 100 + s.talents.vitality * 25,
  mana: 100 + s.talents.focus * 20,
  damage: 22 + s.talents.power * 6,
  regen: 8 + s.talents.focus * 2,
});
export const unlocked = (s, id) =>
  (id !== "leviosa" && id !== "expelliarmus") || (id === "leviosa" && s.stage >= 2) || (id === "expelliarmus" && level(s) >= 2);
export function upgrade(s, id) {
  if (!Object.hasOwn(s.talents, id) || points(s) < 1 || s.talents[id] >= 3) return false;
  s.talents[id]++;
  return true;
}
export function advance(s, stage) {
  if (s.stage !== stage || stage >= 8) return false;
  s.xp += QUESTS[stage].reward;
  s.coins += 20;
  s.stage++;
  return true;
}
export function record(s, key, id) {
  if (!["levitated", "runes", "defeated", "collected", "visited", "roomsCompleted", "found"].includes(key) || s[key].includes(id)) return false;
  s[key].push(id);
  return true;
}
export const ROOM_REWARD = { xp: 30, coins: 10 };
export function finishRoom(s, id) {
  if (typeof id !== "string" || !id || !record(s, "roomsCompleted", id)) return false;
  s.xp += ROOM_REWARD.xp;
  s.coins += ROOM_REWARD.coins;
  return true;
}
export function collect(s, id, type) {
  if (!record(s, "collected", id)) return false;
  if (type === "herb") s.herbs++;
  else {
    s.coins += 30;
    s.xp += 20;
  }
  return true;
}
export function brew(s) {
  if (s.herbs < 3) return false;
  s.herbs -= 3;
  s.potions++;
  return true;
}
export function usePotion(s, hp) {
  const max = stats(s).health;
  if (s.potions <= 0 || hp >= max) return { used: false, hp };
  s.potions--;
  return { used: true, hp: Math.min(max, hp + 65) };
}
export function moveCircle(position, dx, dz, colliders, bounds, r = 0.38) {
  const out = { x: position.x, z: position.z };
  const blocked = (x, z) =>
    colliders.some((c) =>
      c.r ? Math.hypot(x - c.x, z - c.z) < r + c.r : Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r,
    );
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < steps; i++) {
    let x = out.x + dx / steps,
      z = out.z + dz / steps;
    if (bounds) {
      x = Math.max(bounds.minX + r, Math.min(bounds.maxX - r, x));
      z = Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, z));
    }
    if (!blocked(x, out.z)) out.x = x;
    if (!blocked(out.x, z)) out.z = z;
  }
  return out;
}

// Segment tests are shared by projectile impacts and aim visibility.
export function segmentBlocked(a, b, colliders, floor = 0, inside = false) {
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
    steps = Math.max(1, Math.ceil(length / 0.18));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      x = a.x + (b.x - a.x) * t,
      y = a.y + (b.y - a.y) * t,
      z = a.z + (b.z - a.z) * t;
    for (const c of colliders) {
      const top = c.height ?? (inside ? 1.35 : c.r === 4.55 ? 3.4 : 80);
      if (y > floor + top || y < floor - 0.2) continue;
      const hit = c.r ? Math.hypot(x - c.x, z - c.z) < c.r : Math.abs(x - c.x) < c.w / 2 && Math.abs(z - c.z) < c.d / 2;
      if (hit) return { x, y, z };
    }
  }
  return null;
}
