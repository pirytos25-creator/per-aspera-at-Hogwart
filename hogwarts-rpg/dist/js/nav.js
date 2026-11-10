// Navigation across the whole castle. Pure data and maths (no three.js), so it runs in tests.
//
// The castle is a hub: the Entrance Hall, the staircase tower with three galleries and four
// straight corridors. Travel between floors goes over fixed flights and over turning platforms.
// A platform flight only lands where the platform currently points, so the graph has dynamic
// edges: going up you take whichever landing the platform offers, going down you must board
// from the side it is docked at.

export const FLOOR_Y = { D: -8, G: 0, F1: 8, F2: 16, F3: 24 };
// landing directions of the three turning platforms (shared with castle.js)
export const PLATFORM_DIRS = [
  [0, Math.PI / 2, Math.PI],
  [0, Math.PI / 2, -Math.PI / 2],
  [Math.PI / 2, Math.PI, -Math.PI / 2],
];
export const NAV_CORRIDORS = [
  { id: 'D', y: -8, axis: 'x', sign: 1, center: 34, from: 33, to: 156 },
  { id: 'F1', y: 8, axis: 'x', sign: 1, center: 0, from: 17, to: 142 },
  { id: 'F2', y: 16, axis: 'z', sign: -1, center: 0, from: 17, to: 142 },
  { id: 'F3', y: 24, axis: 'x', sign: -1, center: 0, from: 17, to: 142 },
];
const SIDE_VEC = { E: [1, 0], N: [0, -1], W: [-1, 0], S: [0, 1] };
const RING = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
const RING_POS = { E: [1, 0], NE: [1, -1], N: [0, -1], NW: [-1, -1], W: [-1, 0], SW: [-1, 1], S: [0, 1], SE: [1, 1] };
const RING_R = 12.25;
const FLIGHT_LEN = 11.6; // platform-local: deck centre (0) -> foot of the flight (3) -> top (11) -> lip (11.6)
const LEVELS = ['F1', 'F2', 'F3'];

// which gallery side a platform angle points at
export function sideOfAngle(a) {
  const x = Math.round(Math.cos(a)), z = Math.round(-Math.sin(a));
  return x === 1 ? 'E' : x === -1 ? 'W' : z === -1 ? 'N' : 'S';
}
export function sidesAdjacent(a, b) {
  const i = RING.indexOf(a), j = RING.indexOf(b), d = Math.abs(i - j);
  return Math.min(d, 8 - d) === 2;
}
// floor band of a position (T = inside the staircase tower)
export function bandOfPos(x, y, z) {
  if (Math.abs(x) < 14.2 && Math.abs(z) < 14.2) return 'T';
  return y < -3.5 ? 'D' : y < 4 ? 'G' : y < 12 ? 'F1' : y < 20 ? 'F2' : 'F3';
}

export function createNav({ doors = [], platformDirs = PLATFORM_DIRS } = {}) {
  const nodes = new Map(), adj = new Map();
  const node = (id, x, y, z, extra = {}) => { nodes.set(id, { id, x, y, z, ...extra }); adj.set(id, []); return id; };
  const link = (a, b, o = {}) => {
    const A = nodes.get(a), B = nodes.get(b);
    const len = o.len ?? Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z);
    const e = { from: a, to: b, len, kind: 'walk', w: 0.7, rev: false, ...o };
    adj.get(a).push(e); adj.get(b).push({ ...e, from: b, to: a, rev: true });
  };
  // ---------------------------------------------------------------- ground floor
  node('hallS', 0, 0, 40, { band: 'G' }); node('hallC', 0, 0, 29, { band: 'G' }); node('hallN', 0, 0, 17.5, { band: 'G' });
  node('hallW', -9, 0, 29, { band: 'G' }); node('hallE', 9.5, 0, 36.2, { band: 'G' }); node('dHead', 13.3, 0, 34.5, { band: 'G' });
  link('hallS', 'hallC', { w: 1 }); link('hallC', 'hallN', { w: 1 }); link('hallC', 'hallW', { w: 0.6 }); link('hallC', 'hallE', { w: 0.6 });
  node('towerS', 0, 0, 14.3, { band: 'T' }); node('towerG', 0, 0, 11.4, { band: 'T' });
  link('hallN', 'towerS', { w: 1 }); link('towerS', 'towerG', { w: 0.9 });
  // dungeon stairs
  node('dTop', 14.5, 0, 34, { band: 'G' }); node('dBot', 30.3, -8, 34, { band: 'D' });
  link('hallE', 'dHead', { w: 0.4 }); link('dHead', 'dTop', { w: 0.5 }); link('dTop', 'dBot', { w: 0.9, stairs: true });
  // ---------------------------------------------------------------- tower galleries
  for (const L of LEVELS) {
    const y = FLOOR_Y[L];
    for (const k of RING) node(`ring:${L}:${k}`, RING_POS[k][0] * RING_R, y, RING_POS[k][1] * RING_R, { band: 'T', ring: L, side: k });
    RING.forEach((k, i) => link(`ring:${L}:${k}`, `ring:${L}:${RING[(i + 1) % 8]}`, { w: 0.45 }));
  }
  // ---------------------------------------------------------------- stairs: fixed flight + turning platform per level
  const fixed = [
    { foot: ['fix0a', 0, 0, 9.8], top: ['fix0b', 0, 4, 3], from: 'towerG' },
    { foot: ['fix1a', -11, 8, 0], top: ['fix1b', -3, 12, 0], from: 'ring:F1:W' },
    { foot: ['fix2a', 11, 16, 0], top: ['fix2b', 3, 20, 0], from: 'ring:F2:E' },
  ];
  fixed.forEach((f, i) => {
    const py = 4 + i * 8, L = LEVELS[i];
    node(f.foot[0], f.foot[1], f.foot[2], f.foot[3], { band: 'T' }); node(f.top[0], f.top[1], f.top[2], f.top[3], { band: 'T' });
    link(f.from, f.foot[0], { w: 0.5 }); link(f.foot[0], f.top[0], { w: 0.75, stairs: true });
    node(`deck${i}`, 0, py, 0, { band: 'T', plat: i });
    link(f.top[0], `deck${i}`, { w: 0.7 });
    // the far end of the platform flight moves with the platform; its node holds the platform-local spot
    node(`ptop${i}`, FLIGHT_LEN, py + 4, 0, { band: 'T', plat: i, dynamic: true });
    link(`deck${i}`, `ptop${i}`, { kind: 'plat', plat: i, len: FLIGHT_LEN, w: 0.75, stairs: true });
    for (const a of platformDirs[i]) {
      const side = sideOfAngle(a);
      link(`ptop${i}`, `ring:${L}:${side}`, { kind: 'land', plat: i, side, len: RING_R - FLIGHT_LEN, w: 0.5 });
    }
  });
  // ---------------------------------------------------------------- corridors and room doors
  const P = (C, along, perp) => (C.axis === 'x' ? [C.sign * along, perp] : [perp, C.sign * along]);
  for (const C of NAV_CORRIDORS) {
    const mine = doors.filter((d) => d.corridor === C.id && d.id !== 'great-hall');
    const stops = new Set([C.from, C.to, Math.round((C.from + C.to) / 2)]);
    for (const d of mine) stops.add(Math.round(Math.abs(C.axis === 'x' ? d.x : d.z) * 10) / 10);
    const sorted = [...stops].sort((a, b) => a - b);
    sorted.forEach((s, i) => {
      const [x, z] = P(C, s, C.center);
      node(`c:${C.id}:${s}`, x, C.y, z, { band: C.id, corridor: C.id, along: s });
      if (i) link(`c:${C.id}:${sorted[i - 1]}`, `c:${C.id}:${s}`, { w: 0.9, corridor: C.id });
    });
    for (const d of mine) {
      const s = Math.round(Math.abs(C.axis === 'x' ? d.x : d.z) * 10) / 10;
      const perp = C.axis === 'x' ? d.z : d.x, side = Math.sign(perp - C.center) || 1;
      const [x, z] = P(C, s, C.center + side * 2.05);
      node(`door:${d.id}`, x, C.y, z, { band: C.id, corridor: C.id, room: d.id });
      link(`c:${C.id}:${s}`, `door:${d.id}`, { w: 0 });
    }
    // corridor mouths
    if (C.id === 'D') link('dBot', `c:D:${sorted[0]}`, { w: 0.8 });
    else {
      const side = C.id === 'F1' ? 'E' : C.id === 'F2' ? 'N' : 'W';
      const [mx, mz] = P(C, 14.2, 0);
      node(`mouth:${C.id}`, mx, C.y, mz, { band: C.id });
      link(`ring:${C.id}:${side}`, `mouth:${C.id}`, { w: 0.7 }); link(`mouth:${C.id}`, `c:${C.id}:${sorted[0]}`, { w: 0.8 });
    }
  }
  if (doors.some((d) => d.id === 'great-hall')) { node('door:great-hall', -13, 0, 29, { band: 'G', room: 'great-hall' }); link('hallW', 'door:great-hall', { w: 0.3 }); }

  // ---------------------------------------------------------------- queries
  function nearest(pos, { maxDy = 2.6, band = null } = {}) {
    let best = null, bd = Infinity;
    for (const n of nodes.values()) {
      if (n.dynamic || Math.abs(n.y - pos.y) > maxDy) continue;
      if (band && n.band !== band) continue;
      const d = Math.hypot(n.x - pos.x, n.z - pos.z) + Math.abs(n.y - pos.y) * 3;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }
  // shortest path as a list of directed edges. platTo: the angle each platform is docked at (or turning to)
  function route(from, to, { platTo = null } = {}) {
    if (!nodes.has(from) || !nodes.has(to)) return null;
    if (from === to) return [];
    const dist = new Map([[from, 0]]), prev = new Map(), open = new Set([from]), done = new Set();
    while (open.size) {
      let u = null, ud = Infinity;
      for (const k of open) { const d = dist.get(k); if (d < ud) { ud = d; u = k; } }
      open.delete(u); done.add(u);
      if (u === to) break;
      for (const e of adj.get(u)) {
        if (done.has(e.to)) continue;
        // a platform flight meets the gallery only on the side it is docked at (walkers re-plan if it turns meanwhile)
        if (e.kind === 'land' && platTo && sideOfAngle(platTo[e.plat]) !== e.side) continue;
        const cost = e.len * (e.stairs ? 1.25 : 1) + (e.kind === 'plat' ? 8 : 0);
        const nd = ud + cost;
        if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, e); open.add(e.to); }
      }
    }
    if (!prev.has(to)) return null;
    const path = [];
    for (let at = to; at !== from;) { const e = prev.get(at); path.unshift(e); at = e.from; }
    return path;
  }
  // world position at distance s along an edge; platAngle is needed for platform flights
  function point(edge, s, platAngle = 0, out = {}) {
    const t = edge.len > 0 ? Math.min(1, Math.max(0, s / edge.len)) : 1;
    if (edge.kind === 'plat') {
      const lx = (edge.rev ? 1 - t : t) * FLIGHT_LEN, py = nodes.get(`deck${edge.plat}`).y;
      const c = Math.cos(platAngle), sn = Math.sin(platAngle), dir = edge.rev ? -1 : 1;
      out.x = lx * c; out.z = -lx * sn; out.y = py + 4 * Math.min(1, Math.max(0, (lx - 3) / 8));
      out.dx = c * dir; out.dz = -sn * dir;
      return out;
    }
    let A = nodes.get(edge.from), B = nodes.get(edge.to);
    if (edge.kind === 'land') {
      const [sx, sz] = SIDE_VEC[edge.side], top = { x: sx * FLIGHT_LEN, y: nodes.get(`ptop${edge.plat}`).y, z: sz * FLIGHT_LEN };
      if (edge.rev) B = top; else A = top;
    }
    out.x = A.x + (B.x - A.x) * t; out.y = A.y + (B.y - A.y) * t; out.z = A.z + (B.z - A.z) * t;
    const l = Math.hypot(B.x - A.x, B.z - A.z) || 1;
    out.dx = (B.x - A.x) / l; out.dz = (B.z - A.z) / l;
    return out;
  }
  const length = (path) => path.reduce((s, e) => s + e.len, 0);
  return { nodes, adj, nearest, route, point, length, sideOfAngle };
}
