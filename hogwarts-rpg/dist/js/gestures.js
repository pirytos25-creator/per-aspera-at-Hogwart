// Wand movement patterns and a small stroke recogniser (no dependencies, unit tested).
// A drawing is resampled to evenly spaced points, centred and scaled uniformly (so proportions
// still matter), then compared point by point with the pattern.

// Patterns in card space: x to the right, y down, roughly inside the unit square.
const arc = (cx, cy, rx, ry, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});
export const PATTERNS = {
  up: { name: "Pewne uniesienie", hint: "Jeden spokojny ruch od dołu do góry.", clip: "lumos", pts: [[0.5, 1], [0.5, 0]] },
  swish: {
    name: "Zamach i pstryknięcie",
    hint: "Płynny zamach w dół i w prawo, a na końcu krótkie pstryknięcie w górę.",
    clip: "leviosa",
    pts: [...arc(0.72, 0.08, 0.72, 0.8, Math.PI, Math.PI / 2, 18), [1, 0.34]],
  },
  dome: { name: "Kopuła", hint: "Łuk nad głową: od lewego dołu, przez szczyt, do prawego dołu.", clip: "protego", pts: arc(0.5, 1, 0.5, 1, Math.PI, 2 * Math.PI, 28) },
  slash: { name: "Cięcie i pchnięcie", hint: "Ukośne cięcie z prawej góry w lewy dół i krótkie pchnięcie w prawo.", clip: "expelliarmus", pts: [[0.95, 0.05], [0.12, 0.82], [0.72, 0.82]] },
  circle: { name: "Okrąg", hint: "Zamknięty okrąg. Kierunek i początek są dowolne.", clip: "incendio", closed: true, pts: arc(0.5, 0.5, 0.5, 0.5, -Math.PI / 2, (3 * Math.PI) / 2, 40) },
  zigzag: { name: "Zygzak", hint: "Trzy ostre zwroty od lewej do prawej.", clip: "glacius", pts: [[0, 0.15], [0.33, 0.85], [0.66, 0.15], [1, 0.85]] },
};
export const SPELL_PATTERN = { lumos: "up", leviosa: "swish", protego: "dome", expelliarmus: "slash", incendio: "circle", reparo: "circle", glacius: "zigzag", accio: "swish" };

const N = 48;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function pathLength(p) {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += dist(p[i], p[i - 1]);
  return d;
}
export function resample(points, n = N) {
  const pts = points.map((p) => [p[0], p[1]]);
  const step = pathLength(pts) / (n - 1);
  if (!(step > 0)) return Array.from({ length: n }, () => pts[0].slice());
  const out = [pts[0].slice()];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i], pts[i - 1]);
    if (d > 0 && acc + d >= step) {
      const t = (step - acc) / d,
        q = [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])];
      out.push(q);
      pts.splice(i, 0, q);
      acc = 0;
    } else acc += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1].slice());
  return out.slice(0, n);
}
// centre on the centroid and scale uniformly, so the proportions of the movement still count
export function normalize(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    cx += x; cy += y;
  }
  cx /= points.length; cy /= points.length;
  const s = Math.max(x1 - x0, y1 - y0) || 1;
  return points.map(([x, y]) => [(x - cx) / s, (y - cy) / s]);
}
const meanDistance = (a, b) => a.reduce((s, p, i) => s + dist(p, b[i]), 0) / a.length;
const templates = new Map();
function template(id) {
  if (!templates.has(id)) templates.set(id, normalize(resample(PATTERNS[id].pts)));
  return templates.get(id);
}
// score in [0,1]; `reversed` tells the shape was right but drawn the other way round
export function scoreStroke(stroke, id, { minLength = 70 } = {}) {
  const P = PATTERNS[id];
  if (!P || stroke.length < 2) return { score: 0, tooShort: true, reversed: false };
  const tooShort = pathLength(stroke) < minLength;
  const tpl = template(id);
  let a = normalize(resample(stroke));
  let d = meanDistance(a, tpl);
  const rev = meanDistance(a.slice().reverse(), tpl);
  let reversed = false;
  if (P.closed) {
    // a circle may start anywhere and go either way
    const closedPts = a.slice(0, -1);
    for (const seq of [closedPts, closedPts.slice().reverse()])
      for (let k = 0; k < seq.length; k += 2) {
        const shifted = normalize(resample([...seq.slice(k), ...seq.slice(0, k + 1)]));
        d = Math.min(d, meanDistance(shifted, tpl));
      }
    // a closed loop has to come back near its start
    const gap = dist(stroke[0], stroke[stroke.length - 1]) / (Math.max(...stroke.map((p) => p[0])) - Math.min(...stroke.map((p) => p[0])) || 1);
    if (gap > 0.45) d += (gap - 0.45) * 0.3;
  } else if (rev < d * 0.6) reversed = true;
  const score = Math.max(0, Math.min(1, 1 - (d - 0.03) / 0.26));
  return { score: tooShort ? Math.min(score, 0.2) : score, tooShort, reversed, d };
}

// the pace of a drawn stroke: it gathers speed and settles at the end (shared by the slate and the arm)
export const traceEase = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
