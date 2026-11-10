import test from 'node:test';
import assert from 'node:assert/strict';
import { HALL_SEATS, HALL_TABLE_X, HALL_BENCH_X, createHallMagic } from '../dist/js/great-hall.js';
import { castleState } from '../dist/js/castle-state.js';

test('four house tables leave aisles wide enough to walk', () => {
  assert.equal(HALL_TABLE_X.length, 4);
  const benchEdge = HALL_BENCH_X + 0.25;
  for (let i = 1; i < 4; i++) assert.ok(HALL_TABLE_X[i] - HALL_TABLE_X[i - 1] - 2 * benchEdge >= 1.6, 'aisle between tables');
  assert.ok(12.3 - (HALL_TABLE_X[3] + benchEdge) >= 1.6, 'aisle along the wall');
});

test('every bench seat faces its own table', () => {
  assert.equal(HALL_SEATS.length, 88);
  for (const s of HALL_SEATS) {
    const tx = HALL_TABLE_X[s.row];
    assert.ok(Math.abs(Math.abs(s.x - tx) - HALL_BENCH_X) < 1e-9);
    assert.equal(Math.sign(tx - s.x), s.face);
  }
});

test('the feast rises at mealtimes and sinks back after the bell', () => {
  const magic = createHallMagic({ candles: 40 });
  castleState.meal = false; magic.update(0); magic.update(1);
  assert.equal(magic.feast.visible, false);
  castleState.meal = true; for (let t = 1; t <= 3; t += 0.05) magic.update(t);
  assert.equal(magic.feast.visible, true); assert.ok(Math.abs(magic.feast.scale.y - 1) < 1e-6);
  castleState.meal = false; for (let t = 3; t <= 6; t += 0.05) magic.update(t);
  assert.equal(magic.feast.visible, false);
  assert.ok(magic.counts.food > 100);
  magic.dispose();
});
