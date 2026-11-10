import test from 'node:test';
import assert from 'node:assert/strict';
import { createNav, sideOfAngle, sidesAdjacent, bandOfPos, PLATFORM_DIRS } from '../dist/js/nav.js';
import { PERIODS, DAY_LENGTH, periodAt, planFor, CLASSROOMS, COMMON_ROOMS } from '../dist/js/schedule.js';

const doors = [
  { id: 'charms', corridor: 'F1', x: 32, y: 8, z: -3 }, { id: 'hospital', corridor: 'F1', x: 32, y: 8, z: 3 },
  { id: 'library', corridor: 'F2', x: -3, y: 16, z: -32 }, { id: 'gryffindor', corridor: 'F3', x: -32, y: 24, z: 3 },
  { id: 'potions', corridor: 'D', x: 48, y: -8, z: 31 }, { id: 'great-hall', corridor: 'G', x: -14.5, y: 0, z: 29 },
];
const nav = createNav({ doors });
const docked = (i) => PLATFORM_DIRS.map((d) => d[i % d.length]);

test('platform angles map to gallery sides', () => {
  assert.equal(sideOfAngle(0), 'E'); assert.equal(sideOfAngle(Math.PI / 2), 'N');
  assert.equal(sideOfAngle(Math.PI), 'W'); assert.equal(sideOfAngle(-Math.PI / 2), 'S');
  assert.ok(sidesAdjacent('E', 'N')); assert.ok(!sidesAdjacent('E', 'W'));
  assert.equal(bandOfPos(0, 8, 0), 'T'); assert.equal(bandOfPos(60, 8, 0), 'F1'); assert.equal(bandOfPos(60, -8, 34), 'D');
});

test('every place in the castle is reachable from the Entrance Hall and back', () => {
  for (const id of nav.nodes.keys()) {
    if (nav.nodes.get(id).dynamic) continue;
    assert.ok(nav.route('hallC', id, { platTo: docked(0) }), `to ${id}`);
    assert.ok(nav.route(id, 'hallC', { platTo: docked(0) }), `from ${id}`);
  }
});

test('the way up climbs through all three platforms in order', () => {
  const path = nav.route('hallC', 'door:gryffindor', { platTo: docked(0) });
  const plats = path.filter((e) => e.kind === 'plat').map((e) => e.plat);
  assert.deepEqual(plats, [0, 1, 2]);
  assert.ok(path.every((e) => e.kind !== 'plat' || !e.rev));
  assert.equal(path.at(-1).to, 'door:gryffindor');
});

test('going down boards a platform only on the side where it is docked', () => {
  for (let k = 0; k < 3; k++) {
    const platTo = docked(k), path = nav.route('door:gryffindor', 'door:potions', { platTo });
    const boards = path.filter((e) => e.kind === 'land');
    assert.equal(boards.length, 3);
    for (const e of boards) { assert.ok(e.rev); assert.equal(e.side, sideOfAngle(platTo[e.plat])); }
  }
});

test('points along edges are continuous, also over a turning platform', () => {
  for (const angle of [0, Math.PI / 2]) {
    const path = nav.route('hallC', 'door:charms', { platTo: [angle, 0, 0] });
    let last = null;
    for (const e of path) {
      for (let s = 0; s <= e.len + 1e-9; s += Math.min(0.25, e.len || 1)) {
        const p = nav.point(e, s, angle);
        if (last) assert.ok(Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) < 0.75, `gap on ${e.from}->${e.to} at ${s.toFixed(2)} (angle ${angle.toFixed(2)})`);
        last = { x: p.x, y: p.y, z: p.z };
      }
      const end = nav.point(e, e.len, angle); last = { x: end.x, y: end.y, z: end.z };
    }
    assert.ok(Math.abs(last.y - 8) < 1e-6);
  }
});

test('the platform flight rises from the deck to the gallery above', () => {
  const up = nav.adj.get('deck1').find((e) => e.kind === 'plat');
  assert.equal(nav.point(up, 0, 0).y, 12); assert.equal(nav.point(up, up.len, 0).y, 16);
  const p = nav.point(up, up.len, Math.PI / 2);
  assert.ok(Math.abs(p.x) < 1e-6 && p.z < -11);
  const down = nav.adj.get('ptop1').find((e) => e.kind === 'plat');
  assert.equal(nav.point(down, 0, 0).y, 16); assert.equal(nav.point(down, down.len, 0).y, 12);
});

test('no turning flight is ever stacked over a fixed flight', () => {
  const arrive = ['S', 'W', 'S'], leaveAbove = ['W', 'S', null];
  PLATFORM_DIRS.forEach((dirs, i) => {
    for (const a of dirs) { const side = sideOfAngle(a); assert.notEqual(side, arrive[i]); assert.notEqual(side, leaveAbove[i]); }
    for (let k = 0; k < dirs.length; k++) assert.ok(sidesAdjacent(sideOfAngle(dirs[k]), sideOfAngle(dirs[(k + 1) % dirs.length])), 'quarter turns only');
  });
  assert.equal(nav.nodes.get('fix1a').x, -11); assert.equal(nav.nodes.get('fix2a').z, 11);
});

test('nearest node respects the floor', () => {
  assert.equal(nav.nearest({ x: 60, y: 8, z: 0.5 }), 'c:F1:80'.replace('80', String(nav.nodes.get(nav.nearest({ x: 60, y: 8, z: 0.5 })).along)));
  assert.equal(nav.nodes.get(nav.nearest({ x: 60, y: 8, z: 0.5 })).band, 'F1');
  assert.equal(nav.nodes.get(nav.nearest({ x: 60, y: -8, z: 34 })).band, 'D');
});

test('the school day cycles through its periods', () => {
  assert.equal(periodAt(0).period.id, 'breakfast');
  assert.equal(periodAt(PERIODS[0].len + 1).period.id, 'lesson1');
  assert.equal(periodAt(DAY_LENGTH + 5).day, 1);
  assert.equal(periodAt(100, true).period.id, 'night');
  let t = 0; for (const p of PERIODS) { assert.equal(periodAt(t + 0.5).period.id, p.id); t += p.len; }
});

test('timetables are stable, valid and leave some students in the corridors', () => {
  const houses = Object.keys(COMMON_ROOMS);
  for (const period of PERIODS) {
    let roam = 0;
    for (let i = 0; i < 21; i++) {
      const a = planFor(i, houses[i % 4], period, 0), b = planFor(i, houses[i % 4], period, 0);
      assert.deepEqual(a, b);
      if (a.kind === 'room') assert.ok(a.room === 'great-hall' || CLASSROOMS.includes(a.room) || Object.values(COMMON_ROOMS).includes(a.room));
      else roam++;
    }
    assert.ok(roam >= 4, `${period.id}: ${roam} roaming`);
  }
  assert.equal(planFor(3, 'Slytherin', { night: true }).room, 'slytherin');
});
