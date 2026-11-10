// The school day. Pure functions: the same student always has the same timetable.
export const PERIODS = [
  { id: 'breakfast', label: 'Śniadanie w Wielkiej Sali', len: 170, meal: true },
  { id: 'lesson1', label: 'Pierwsza lekcja', len: 230, lesson: 0 },
  { id: 'break', label: 'Przerwa', len: 110 },
  { id: 'lesson2', label: 'Druga lekcja', len: 230, lesson: 1 },
  { id: 'lunch', label: 'Obiad w Wielkiej Sali', len: 170, meal: true },
  { id: 'lesson3', label: 'Trzecia lekcja', len: 230, lesson: 2 },
  { id: 'free', label: 'Czas wolny', len: 200 },
  { id: 'dinner', label: 'Kolacja w Wielkiej Sali', len: 170, meal: true },
];
export const DAY_LENGTH = PERIODS.reduce((s, p) => s + p.len, 0);
export const NIGHT = { id: 'night', label: 'Cisza nocna', len: Infinity, night: true };
export const CLASSROOMS = ['charms', 'transfiguration', 'defence', 'history', 'library', 'arithmancy', 'runes', 'duelling', 'divination', 'music', 'patronus', 'potions', 'alchemy'];
export const COMMON_ROOMS = { Gryffindor: 'gryffindor', Ravenclaw: 'ravenclaw', Hufflepuff: 'hufflepuff', Slytherin: 'slytherin' };
// classrooms by floor, and four class groups whose lessons stay within a floor or two of each other
export const FLOOR_ROOMS = { F1: ['charms', 'transfiguration', 'defence', 'history'], F2: ['library', 'arithmancy', 'runes', 'duelling'], F3: ['divination', 'music', 'patronus'], D: ['potions', 'alchemy'] };
const TIMETABLE = [['F1', 'F2', 'F1'], ['F2', 'F1', 'D'], ['F3', 'F2', 'F2'], ['D', 'F1', 'F3']];

export function periodAt(t, night = false) {
  if (night) return { index: -1, period: NIGHT, left: Infinity, day: Math.floor(Math.max(0, t) / DAY_LENGTH) };
  const day = Math.floor(Math.max(0, t) / DAY_LENGTH);
  let u = Math.max(0, t) - day * DAY_LENGTH;
  for (let i = 0; i < PERIODS.length; i++) { if (u < PERIODS[i].len) return { index: i, period: PERIODS[i], left: PERIODS[i].len - u, day }; u -= PERIODS[i].len; }
  return { index: 0, period: PERIODS[0], left: PERIODS[0].len, day: day + 1 };
}
// where student number i of a house should be in a period:
//   {kind:'room', room}   go inside that room
//   {kind:'roam', band}   spend the time in a corridor (band null = stay on the floor you are on)
export function planFor(i, house, period, day = 0) {
  if (period.night) return { kind: 'room', room: COMMON_ROOMS[house] || 'gryffindor' };
  if (period.meal) return (i + day) % 5 < 3 ? { kind: 'room', room: 'great-hall' } : { kind: 'roam', band: (i + day) % 5 === 3 ? 'G' : null };
  if (period.lesson !== undefined) {
    if ((i + period.lesson + day) % 3 === 0) return { kind: 'roam', band: null };
    const floor = TIMETABLE[(i + day) % 4][period.lesson], rooms = FLOOR_ROOMS[floor];
    return { kind: 'room', room: rooms[((i >> 2) + period.lesson + day) % rooms.length] };
  }
  if (period.id === 'free') return (i + day) % 2 === 0 ? { kind: 'room', room: COMMON_ROOMS[house] || 'gryffindor' } : { kind: 'roam', band: null };
  return { kind: 'roam', band: null };
}
// the caretaker's round and the duty teacher's posts
export const PATROL = ['F1', 'F2', 'F3', 'G', 'D'];
export function dutyPost(period, day = 0) {
  if (period.night) return { kind: 'roam', band: 'G' };
  if (period.meal) return { kind: 'roam', band: 'G' };
  if (period.lesson !== undefined) return { kind: 'roam', band: ['F1', 'F2', 'F3'][(period.lesson + day) % 3] };
  return { kind: 'roam', band: 'G' };
}
