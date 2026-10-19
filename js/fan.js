// The fan: a front-facing illustrated character drawn as SVG. Smooth curves, a dark outline and flat
// cel shading with the light from the top left. Every item is a small recipe (fan-items.js) that draws on
// the same body geometry, so clothes follow each body type.
//
// Design space: 200 x 340. Head centre x 100. Ground at y ~326.

export const W = 200, H = 340, CX = 100;
export const OW = 2.1; // outline width

/* ------------------------------------------------------------------ colour */
const hx = (s) => { let t = String(s).replace('#', ''); if (t.length === 3) t = [...t].map((c) => c + c).join(''); const n = parseInt(t, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
const toHex = (a) => '#' + a.map((v) => cl(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h * 360, s, l]; }
function hsl2rgb([h, s, l]) { h = (((h % 360) + 360) % 360) / 360; const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255]; }
/** shift lightness (dl), hue (dh degrees) and saturation (ds) */
export function adj(hex, dl, dh = 0, ds = 0) { const [h, s, l] = rgb2hsl(hx(hex)); return toHex(hsl2rgb([h + dh, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl))])); }
export function mix(a, b, t) { const x = hx(a), y = hx(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); }
export const dk = (c, a = 0.2) => adj(c, -a, -4);
export const lt = (c, a = 0.2) => adj(c, a, 3);
/** a cel-shading ramp: light, base, shade, deep shade, outline. Shadows lean a little cool. */
export function ramp(base, o = {}) {
  const k = o.k ?? 1, l = rgb2hsl(hx(base))[2];
  const lineAmt = l > 0.75 ? 0.5 : l > 0.45 ? 0.42 : 0.34;
  return {
    base,
    hi: adj(base, 0.075 * k, 4, 0),
    sh: adj(base, -0.09 * k, -5 * (o.hs ?? 1), 0.02),
    deep: adj(base, -0.18 * k, -9 * (o.hs ?? 1), 0.03),
    line: o.line || (l < 0.16 ? '#06060A' : adj(base, -lineAmt, -10, -0.05)),
  };
}

/* ------------------------------------------------------------------ geometry */
const r1 = (n) => Math.round(n * 10) / 10;
export const pt = ([x, y]) => `${r1(x)} ${r1(y)}`;
/** Catmull-Rom spline through points as cubic Bezier segments, starting after the first point */
export function segs(P) {
  let d = '';
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}
/** open smooth curve */
export const curve = (P) => `M${pt(P[0])}${segs(P)}`;
/** closed smooth shape through points */
export function blob(P) {
  const n = P.length; let d = `M${pt(P[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + 'Z';
}
/** straight-edged closed shape */
export const poly = (P) => `M${P.map(pt).join(' L')}Z`;
/** A tube through joints [[x, y, width], ...]: left and right edges (left = viewer's left when going down). */
export function tube(J) {
  const L = [], R = [];
  for (let i = 0; i < J.length; i++) {
    const a = J[Math.max(0, i - 1)], b = J[Math.min(J.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const [x, y, w] = J[i], nx = -dy, ny = dx;
    L.push([x + nx * w / 2, y + ny * w / 2]); R.push([x - nx * w / 2, y - ny * w / 2]);
  }
  return { J, L, R };
}
const capArc = (a, b, round) => (round ? ` A${r1(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)} ${r1(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 * (round === true ? 1 : round))} 0 0 0 ${pt(b)}` : ` L${pt(b)}`);
/** outline of a tube; cap0 / cap1: true = round, false = flat, or a number to squash the round cap */
export function tubeD(T, cap0 = true, cap1 = true) {
  const R = T.R.slice().reverse();
  return `M${pt(T.L[0])}${segs(T.L)}${capArc(T.L[T.L.length - 1], R[0], cap1)}${segs(R)}${capArc(R[R.length - 1], T.L[0], cap0)}Z`;
}
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** a stripe running along the tube between fractions t0..t1 across its width (0 = left edge, 1 = right) */
export function bandD(T, t0, t1, i0 = 0, i1 = T.J.length - 1) {
  const A = [], B = [];
  for (let i = i0; i <= i1; i++) { A.push(lerp2(T.L[i], T.R[i], t0)); B.push(lerp2(T.L[i], T.R[i], t1)); }
  B.reverse();
  return `M${pt(A[0])}${segs(A)} L${pt(B[0])}${segs(B)}Z`;
}
/** a tube cut off at y (for sleeves and trouser legs), optionally widened */
export function cutJ(J, yEnd, grow = 0, from = -Infinity) {
  const out = [];
  for (let i = 0; i < J.length; i++) {
    const [x, y, w] = J[i];
    if (y < from) {
      const nx = J[i + 1]; if (nx && nx[1] > from) { const t = (from - y) / (nx[1] - y); out.push([x + (nx[0] - x) * t, from, w + (nx[2] - w) * t + grow]); }
      continue;
    }
    if (y <= yEnd) { out.push([x, y, w + grow]); continue; }
    const p = J[i - 1] || J[i], t = (yEnd - p[1]) / (y - p[1] || 1);
    out.push([p[0] + (x - p[0]) * t, yEnd, p[2] + (w - p[2]) * t + grow]);
    break;
  }
  return out.length > 1 ? out : [out[0], [out[0][0], out[0][1] + 0.5, out[0][2]]];
}

/** part of a tube between fractions f0..f1 of its length (sleeves follow the arm whatever the pose) */
export function cutF(J, f0, f1, grow = 0) {
  const L = [0];
  for (let i = 1; i < J.length; i++) L.push(L[i - 1] + Math.hypot(J[i][0] - J[i - 1][0], J[i][1] - J[i - 1][1]));
  const tot = L[L.length - 1], at = (d) => { let i = 1; while (i < J.length - 1 && L[i] < d) i++; const t = Math.max(0, Math.min(1, (d - L[i - 1]) / (L[i] - L[i - 1] || 1))); const a = J[i - 1], b = J[i]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + grow]; };
  const d0 = tot * f0, d1 = tot * Math.min(1, f1), out = [at(d0)];
  for (let i = 1; i < J.length - 1; i++) if (L[i] > d0 + 0.5 && L[i] < d1 - 0.5) out.push([J[i][0], J[i][1], J[i][2] + grow]);
  out.push(at(d1));
  return out;
}

/* ------------------------------------------------------------------ svg builder */
export class Pen {
  constructor() { this.out = []; }
  add(s) { this.out.push(s); return this; }
  /** filled shape with outline */
  shape(d, fill, o = {}) {
    this.out.push(`<path d="${d}" fill="${fill}"${o.line === false ? '' : ` stroke="${o.line || dk(fill, 0.4)}" stroke-width="${o.w ?? OW}" stroke-linejoin="round"`}${o.op != null ? ` opacity="${o.op}"` : ''}/>`);
    return this;
  }
  fill(d, fill, op) { this.out.push(`<path d="${d}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`); return this; }
  stroke(d, col, w = 1.4, op) { this.out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op != null ? ` opacity="${op}"` : ''}/>`); return this; }
  dot(x, y, r, col, op) { this.out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${col}"${op != null ? ` opacity="${op}"` : ''}/>`); return this; }
  ell(x, y, rx, ry, col, o = {}) { this.out.push(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${col}"${o.line ? ` stroke="${o.line}" stroke-width="${o.w ?? OW}"` : ''}${o.op != null ? ` opacity="${o.op}"` : ''}/>`); return this; }
  /** a tube with cel shading: base, light edge, shade band, deep edge, outline on top */
  tube(T, Rm, o = {}) {
    const d = tubeD(T, o.cap0 ?? true, o.cap1 ?? true);
    this.fill(d, Rm.base);
    const lit = o.lit ?? 'left';
    const [a, b] = lit === 'left' ? [0, 1] : [1, 0];
    if (o.hi !== false) this.fill(bandD(T, a, a + (b - a) * (o.hiW ?? 0.16)), Rm.hi);
    this.fill(bandD(T, a + (b - a) * (o.shAt ?? 0.66), b), Rm.sh);
    if (o.deep !== false) this.fill(bandD(T, a + (b - a) * (o.deepAt ?? 0.88), b), Rm.deep);
    if (o.extra) o.extra(this, T);
    this.stroke(d, Rm.line, o.w ?? OW);
    return this;
  }
  /** a closed shape with a shade on its right part (clipped to the shape) */
  part(d, Rm, o = {}) {
    const id = `c${Pen.n = (Pen.n || 0) + 1}${Math.random().toString(36).slice(2, 6)}`;
    this.fill(d, Rm.base);
    this.out.push(`<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`);
    if (o.shade) for (const [sd, col, op] of o.shade) this.fill(sd, col, op);
    this.out.push('</g>');
    if (o.line !== false) this.stroke(d, o.line || Rm.line, o.w ?? OW);
    return this;
  }
  /** detail clipped to a shape */
  clip(d, inner) {
    const id = `c${Pen.n = (Pen.n || 0) + 1}${Math.random().toString(36).slice(2, 6)}`;
    this.out.push(`<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`);
    return this;
  }
  toString() { return this.out.join(''); }
}

/* ------------------------------------------------------------------ the body */
// Body types. sh: shoulder (deltoid) half-width, ch: chest, wa: waist, hp: hips, be: belly, arm / leg thickness,
// nk: neck half-width, jaw: extra width at the jaw, def: how much muscle definition shows.
export const BUILDS = [
  { id: 'lean', sh: 43, ch: 28, wa: 24, hp: 26, be: 0, arm: 0.8, leg: 0.84, nk: 11.5, jaw: 0, def: 0.6 },
  { id: 'athletic', sh: 49, ch: 33, wa: 27, hp: 28.5, be: 0, arm: 1, leg: 1, nk: 13, jaw: 0, def: 1 },
  { id: 'built', sh: 57, ch: 40, wa: 30, hp: 30.5, be: 0, arm: 1.3, leg: 1.16, nk: 16, jaw: 1.5, def: 1.3 },
  { id: 'heavy', sh: 53, ch: 39, wa: 39, hp: 37, be: 7, arm: 1.22, leg: 1.26, nk: 16, jaw: 4, def: 0.3 },
];

/** Everything items hang on. side: -1 = viewer's left, 1 = viewer's right. */
export function geometry(B, pose = 'relaxed') {
  const g = { B };
  const s = (x, side) => (side < 0 ? x : 2 * CX - x); // shapes are defined on the left; mirror for the right
  // arms: hanging a little away from the body (open, relaxed), slight bend at the elbow
  const a = B.arm, ax = CX - B.sh + 12;
  // poses: relaxed (arms hanging a little away from the body), hands on hips, or one hand on the hip
  const onHip = (side) => pose === 'hips' || (pose === 'onehip' && side < 0);
  g.onHip = onHip;
  g.armJ = (side) => (onHip(side)
    ? [[ax + 2, 127, 25 * a], [ax - 6, 140, 25 * a], [ax - 13, 153, 21 * a], [CX - B.sh - 11, 166, 16.5 * a], [CX - B.wa - B.be - 11, 179, 18 * a], [CX - B.wa - B.be - 2, 190, 12.5 * a]]
    : [[ax + 2, 127, 25 * a], [ax - 4, 141, 25 * a], [ax - 8.5, 159, 21 * a], [ax - 11.5, 177, 16 * a], [ax - 13, 190, 18.5 * a], [ax - 15.5, 211, 12 * a]]
  ).map(([x, y, w]) => [s(x, side), y, w]);
  g.wrist = (side) => { const j = g.armJ(side); return j[j.length - 1]; };
  // where a watch sits: a little up the forearm from the wrist
  g.watch = (side) => { const j = g.armJ(side), p = j[4], q = j[5], t = 0.72; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; };
  g.watchTurn = (side) => { const j = g.armJ(side), p = j[4], q = j[5]; return Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI - 90; };
  g.handTurn = (side) => (onHip(side) ? (side < 0 ? -28 : 28) : 0);
  // legs: slight A-stance, thigh, knee, calf swell on the outside, narrow ankle
  const l = B.leg, lx = CX - 15 - (B.hp - 28.5) * 0.45;
  g.legJ = (side) => [[lx + 2.2, 196, 31 * l], [lx, 226, 30 * l], [lx - 1, 256, 21 * l], [lx - 2.2, 270, 24.5 * l], [lx - 2, 288, 16 * l], [lx - 2.2, 304, 12.5 * l]].map(([x, y, w]) => [s(x, side), y, w]);
  g.ankle = (side) => { const j = g.legJ(side); return j[j.length - 1]; };
  // torso, as a tube down the middle
  g.torsoJ = [[CX, 119, B.nk * 2 + 10], [CX, 128, B.ch * 2 + 10], [CX, 146, B.ch * 2], [CX, 166, (B.ch + B.wa) + B.be * 1.2], [CX, 184, B.wa * 2 + B.be * 2], [CX, 200, B.hp * 2 + B.be * 0.6]];
  g.neckJ = [[CX, 92, B.nk * 2 - 2], [CX, 124, B.nk * 2 + 2]];
  g.hipY = 192; g.crotchY = 222;
  return g;
}

/** The torso outline: neck base, sloping traps, armpits, chest, waist, belly and hips. grow widens it (clothes). */
export function torsoPts(B, grow = 0, hem = 204, top = 0) {
  const R = [[CX + B.nk - 1, 110 - top], [CX + B.nk + 8 + grow * 0.5, 117 - top], [CX + B.sh - 14 + grow, 122.5 - top * 0.6], [CX + B.ch + 3 + grow, 136], [CX + B.ch + grow, 150], [CX + (B.ch + B.wa) / 2 + B.be * 0.7 + grow, 168], [CX + B.wa + B.be + grow * 1.15, 184], [CX + B.hp + B.be * 0.4 + grow * 1.3, Math.min(hem, 202)]];
  if (hem > 203) R.push([CX + B.hp + B.be * 0.3 + grow + (hem - 202) * 0.1, hem]);
  return R;
}
export function torsoD(B, grow = 0, hem = 204, top = 0) {
  const R = torsoPts(B, grow, hem, top), Lf = R.slice().reverse().map(([x, y]) => [200 - x, y]);
  return `M${pt(R[0])}${segs(R)} L${pt(Lf[0])}${segs(Lf)}Z`;
}
/** one half of a garment front (side -1 or 1), cut down the middle at x = CX + gapAt(y) * side */
export function halfD(B, side, grow, hem, top, gapAt) {
  const R = torsoPts(B, grow, hem, top).map(([x, y]) => [CX + (x - CX) * side, y]);
  const y0 = R[0][1], front = [];
  for (let y = hem; y > y0 + 0.5; y -= Math.max(4, (hem - y0) / 6)) front.push([CX + gapAt(y) * side, y]);
  front.push([CX + gapAt(y0) * side, y0]);
  return `M${pt(R[0])}${segs(R)} L${pt(front[0])}${segs(front)}Z`;
}

/* ------------------------------------------------------------------ hands */
// A relaxed hand, palm toward the leg, fingers loosely curled, thumb toward the front.
export function hand(P, side, wj, sk, scale = 1) {
  const [x, y] = wj, k = scale * (side < 0 ? 1 : -1), m = scale;
  const X = (dx) => x + dx * k, Y = (dy) => y + dy * m;
  const d = blob([[X(-6.5), Y(-1)], [X(5.5), Y(-1.5)], [X(7.5), Y(8)], [X(6.5), Y(17)], [X(2), Y(22.5)], [X(-3.5), Y(21)], [X(-7), Y(13)], [X(-8), Y(5)]]);
  P.fill(d, sk.base);
  P.clip(d, `<path d="${blob([[X(1.5), Y(-4)], [X(10), Y(-2)], [X(10), Y(26)], [X(0.5), Y(26)], [X(3), Y(12)]])}" fill="${sk.sh}"/>`);
  P.stroke(d, sk.line, OW);
  // thumb along the front edge, finger creases
  P.stroke(curve([[X(-6), Y(4)], [X(-7.6), Y(10)], [X(-5.2), Y(15)]]), sk.line, 1.3);
  P.stroke(curve([[X(-2), Y(12)], [X(0.5), Y(18)]]), sk.deep, 1.1, 0.9);
  P.stroke(curve([[X(2.6), Y(11)], [X(4.5), Y(17)]]), sk.deep, 1.1, 0.9);
}

/* ------------------------------------------------------------------ head and face */
const HEAD_R = (jaw) => [[100, 22], [115, 24], [127, 31.5], [133, 44], [134.6, 58], [134.2, 70], [132.2 + jaw * 0.4, 81], [128.6 + jaw * 0.8, 90.5], [121 + jaw * 0.7, 99.5], [110.5 + jaw * 0.3, 105.6], [104, 107.2]];
const HEAD = (jaw) => { const R = HEAD_R(jaw); return [...R, ...R.slice(1).reverse().map(([x, y]) => [200 - x, y])]; };
export function drawHead(P, sk, hairCol, opts = {}) {
  const jaw = opts.jaw || 0;
  const ink = '#1A1216';
  const headD = blob(HEAD(jaw));
  // ears first so the head outline sits over their inner edge
  for (const side of [-1, 1]) {
    const X = (dx) => CX + dx * side;
    const ear = blob([[X(31.5), Y0(59)], [X(36.5), Y0(57)], [X(39.6), Y0(61)], [X(39), Y0(70)], [X(36), Y0(78.5)], [X(32), Y0(81)]]);
    P.fill(ear, sk.base); P.fill(blob([[X(34), Y0(62)], [X(37.2), Y0(61.5)], [X(36.8), Y0(70)], [X(34.4), Y0(76)]]), side < 0 ? sk.sh : sk.deep);
    P.stroke(ear, sk.line, OW);
    P.stroke(curve([[X(35), Y0(61)], [X(37.8), Y0(63.4)], [X(37), Y0(71)], [X(35), Y0(75.5)]]), sk.line, 1.1, 0.8);
  }
  function Y0(v) { return v; }
  P.fill(headD, sk.base);
  // cel shading: right side of the face, under the cheekbone, jaw, and a lit forehead
  P.clip(headD, [
    // the right side of the face turns away from the light
    `<path d="${blob([[119, 18], [142, 30], [142, 112], [106, 112], [118, 101], [125.5, 90], [127.5, 76], [127, 56], [123, 38]])}" fill="${sk.sh}"/>`,
    `<path d="${blob([[134, 66], [141, 74], [139, 104], [112, 110], [121, 100], [129, 88]])}" fill="${sk.deep}"/>`,
    // cheekbone hollows and the jaw line on the lit side
    `<path d="${curve([[70.5, 88], [77, 97.5], [88, 104.2]])}" fill="none" stroke="${sk.sh}" stroke-width="2.6" stroke-linecap="round"/>`,
    // lit forehead and the chin
    `<path d="${blob([[78, 33], [89, 27.5], [95, 30], [85, 36], [78, 40]])}" fill="${sk.hi}"/>`,
    // the shadow side of the nose
    `<path d="${blob([[104.4, 67], [107.6, 72], [107.4, 82.5], [104, 84], [104.8, 76]])}" fill="${sk.sh}"/>`,
  ].join(''));
  P.stroke(headD, sk.line, OW);
  if (opts.beforeFace) opts.beforeFace();
  // brows: tapered, slightly angled for a calm, confident look
  const brow = adj(hairCol, -0.06);
  P.fill(blob([[93, 53.2], [84, 50.6], [76, 51.6], [74.2, 53.6], [84, 53.4], [92.6, 55.6]]), brow);
  P.fill(blob([[107, 53.2], [116, 50.6], [124, 51.6], [125.8, 53.6], [116, 53.4], [107.4, 55.6]]), brow);
  // eyes: almond whites, iris + pupil + catchlight, a strong upper lid, a light lower lid
  for (const side of [-1, 1]) {
    const ex = CX + 15.5 * side, ey = 63.4;
    const X = (dx) => ex + dx * side;
    const white = blob([[X(-7.6), ey + 0.4], [X(-3), ey - 3.6], [X(3), ey - 3.8], [X(7.6), ey - 0.6], [X(3.6), ey + 2.8], [X(-3.2), ey + 2.9]]);
    P.fill(white, '#F2EEE6');
    P.clip(white, `<circle cx="${r1(ex - 0.4 * side * 0 - 0.3)}" cy="${r1(ey - 0.2)}" r="4.1" fill="#4A2C1E"/><circle cx="${r1(ex - 0.3)}" cy="${r1(ey - 0.2)}" r="2.2" fill="#120C0A"/><path d="${curve([[X(-8), ey - 2.2], [X(0), ey - 4.2], [X(8), ey - 2.2]])}" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="2.4"/>`);
    P.dot(ex - 1.7, ey - 1.6, 1.15, '#FFFFFF');
    P.stroke(curve([[X(-8.2), ey + 0.8], [X(-4), ey - 3.6], [X(2.5), ey - 4.2], [X(7.4), ey - 1.4], [X(8.6), ey - 0.4]]), ink, 2.1);
    P.stroke(curve([[X(-6.5), ey + 2.4], [X(-1), ey + 3.6], [X(5), ey + 2.4]]), sk.deep, 1.1, 0.85);
    P.stroke(curve([[X(-7), ey - 6.4], [X(0), ey - 7.6], [X(6), ey - 6.6]]), sk.sh, 1.1, 0.8);
  }
  // nose: bridge shade, a lit tip, nostril wings and the shadow under it
  P.stroke(curve([[103.4, 66], [104.6, 74], [105.6, 80]]), sk.sh, 1.5, 0.9);
  P.ell(100, 80.2, 2.8, 2.2, sk.hi, { op: 0.85 });
  P.stroke(curve([[94.6, 79.2], [93.6, 82.4], [96.2, 84.2]]), sk.line, 1.3, 0.85);
  P.stroke(curve([[105.4, 79.2], [106.4, 82.4], [103.8, 84.2]]), sk.line, 1.3, 0.85);
  P.ell(97.4, 84, 1.3, 0.8, sk.line, { op: 0.7 }); P.ell(102.6, 84, 1.3, 0.8, sk.line, { op: 0.7 });
  P.stroke(curve([[96.5, 86.6], [100, 87.2], [103.5, 86.6]]), sk.sh, 1.3, 0.8);
  // mouth: upper lip line with a soft dip, a fuller lower lip, corners
  const lip = mix(sk.base, '#9B4A49', 0.38), lipD = mix(sk.base, '#3A1A1C', 0.62);
  P.fill(blob([[90.6, 93.2], [100, 92.2], [109.4, 93.2], [105, 98.4], [100, 99.4], [95, 98.4]]), lip);
  P.stroke(curve([[89.6, 93.4], [94.5, 92.4], [100, 93.6], [105.5, 92.4], [110.4, 93.4]]), lipD, 1.7);
  P.stroke(curve([[96, 97.4], [100, 98.2], [104, 97.4]]), lt(lip, 0.08), 1.2, 0.8);
  P.stroke(curve([[97, 102.4], [100, 103], [103, 102.4]]), sk.sh, 1.4, 0.7);
}

/* ------------------------------------------------------------------ registry of item recipes */
export const ART = { hair: {}, hat: {}, face: {}, beard: {}, ear: {}, top: {}, outer: {}, scarf: {}, chain: {}, wrist: {}, bottom: {}, shoes: {}, back: {}, hand: {} };

/** Draw the whole fan. ctx: { skin, hair, eq, colourOf(id), pal, build } -> svg inner markup */
export function drawFan(ctx) {
  const B = BUILDS.find((b) => b.id === ctx.build) || BUILDS[1];
  const g = geometry(B, ctx.pose);
  const P = new Pen();
  const sk = ramp(ctx.skin, { hs: 0.25 });
  sk.line = adj(ctx.skin, -0.5, -8, -0.08);
  const c = { skin: ctx.skin, sk, hair: ctx.hair, pal: ctx.pal, B, g };
  const item = (slot) => { const id = ctx.eq[slot]; const f = id && ART[slot][id]; return f ? { f, col: ctx.colourOf(id), id } : null; };
  const run = (slot, phase) => { const it = item(slot); if (it) it.f(P, g, it.col, phase, c); };

  // ground shadow
  P.ell(CX, 326, 52, 6, '#000000', { op: 0.28 });
  run('back', 'back');
  run('hair', 'back');
  // legs (bare skin under trousers, so shorts show real legs)
  for (const side of [-1, 1]) {
    const T = tube(g.legJ(side));
    P.tube(T, sk, { cap0: false });
    if (B.def > 0.5) { // knee cap, the calf line on the outer edge, shin light
      const [kx] = g.legJ(side)[2];
      P.stroke(curve([[kx - 4, 254], [kx, 258.4], [kx + 4, 254]]), sk.sh, 1.4, 0.9);
      const ox = kx + 8.5 * side * B.leg * (side < 0 ? 1 : 1) * -1 * -1;
      P.stroke(curve([[kx + side * 7.5 * B.leg, 263], [kx + side * 9 * B.leg, 272], [kx + side * 6.5 * B.leg, 283]]), sk.deep, 1.3, 0.75);
      void ox;
    }
  }
  run('shoes', 'feet');
  run('bottom', 'legs');
  // torso, then the neck over it (open at the bottom so it flows into the traps)
  const tD = torsoD(B);
  P.part(tD, sk, { shade: [
    [blob([[CX + B.ch * 0.42, 112], [CX + B.sh, 118], [CX + B.hp + B.be + 8, 210], [CX + B.wa * 0.55, 210], [CX + B.ch * 0.5, 170]]), sk.sh],
    [blob([[CX + B.ch * 0.9, 130], [CX + B.sh, 130], [CX + B.hp + B.be + 8, 210], [CX + B.wa + B.be * 0.7 - 4, 210], [CX + B.ch - 3, 168]]), sk.deep],
    [blob([[CX - B.ch + 4, 128], [CX - 8, 124], [CX - 6, 134], [CX - B.ch + 6, 140]]), sk.hi],
  ] });
  if (B.def > 0.5) {
    P.stroke(curve([[CX - B.ch + 7, 147.5], [CX - 11, 155], [CX - 1.2, 150.5]]), sk.sh, 1.6);
    P.stroke(curve([[CX + 1.2, 150.5], [CX + 11, 155], [CX + B.ch - 7, 147.5]]), sk.deep, 1.6);
    P.stroke(curve([[CX, 158], [CX, 186]]), sk.sh, 1.2, 0.8);
    P.stroke(curve([[CX - 9, 168], [CX - 3, 169.5]]), sk.sh, 1.2, 0.7); P.stroke(curve([[CX + 3, 169.5], [CX + 9, 168]]), sk.sh, 1.2, 0.7);
    P.stroke(curve([[CX - 8, 179], [CX - 3, 180]]), sk.sh, 1.2, 0.7); P.stroke(curve([[CX + 3, 180], [CX + 8, 179]]), sk.sh, 1.2, 0.7);
  }
  if (B.be) P.stroke(curve([[CX - B.wa, 186], [CX, 194], [CX + B.wa, 186]]), sk.sh, 1.6, 0.9);
  const nk = B.nk, neckD = blob([[CX - nk + 1, 92], [CX + nk - 1, 92], [CX + nk + 0.5, 112], [CX + nk + 6, 118], [CX - nk - 6, 118], [CX - nk - 0.5, 112]]);
  P.fill(neckD, sk.base);
  P.clip(neckD, `<path d="${poly([[CX + nk * 0.35, 90], [CX + nk + 8, 90], [CX + nk + 8, 120], [CX + nk * 0.45, 120]])}" fill="${sk.sh}"/><path d="${blob([[CX - nk - 2, 96], [CX + nk + 2, 96], [CX + nk + 2, 106], [CX, 112], [CX - nk - 2, 106]])}" fill="${sk.deep}"/>`);
  P.stroke(curve([[CX - nk + 1, 96], [CX - nk - 0.5, 110], [CX - nk - 6, 117.5]]), sk.line, OW);
  P.stroke(curve([[CX + nk - 1, 96], [CX + nk + 0.5, 110], [CX + nk + 6, 117.5]]), sk.line, OW);
  if (B.def > 0.5) { P.stroke(curve([[CX - 4, 121], [CX - 12, 119], [CX - 22, 121]]), sk.sh, 1.3, 0.8); P.stroke(curve([[CX + 4, 121], [CX + 12, 119], [CX + 22, 121]]), sk.sh, 1.3, 0.8); }
  // arms, over the torso edge so the shoulders read
  for (const side of [-1, 1]) {
    const T = tube(g.armJ(side));
    P.tube(T, sk, {
      cap1: false, lit: 'left', extra: (PP, TT) => {
        if (B.def <= 0.5) return;
        const J = g.armJ(side), k = B.arm;
        const at = (i, t) => lerp2(TT.L[i], TT.R[i], side < 0 ? t : 1 - t); // t from the outer edge
        PP.stroke(curve([at(0, 0.62), at(1, 0.66), lerp2(at(1, 0.6), at(2, 0.58), 0.6)]), sk.sh, 1.3);
        PP.stroke(curve([lerp2(at(1, 0.22), at(2, 0.22), 0.5), at(2, 0.2), lerp2(at(2, 0.24), at(3, 0.24), 0.7)]), sk.deep, 1.2, 0.75);
        const e = J[3];
        PP.stroke(curve([[e[0] - 3 * k, e[1] + 0.5], [e[0], e[1] + 2.6], [e[0] + 3 * k, e[1] + 0.5]]), sk.deep, 1.2, 0.85);
        PP.stroke(curve([at(4, 0.62), lerp2(at(4, 0.6), at(5, 0.58), 0.65)]), sk.sh, 1.2, 0.85);
      },
    });
  }
  run('top', 'body'); run('top', 'sleeves');
  run('outer', 'body'); run('outer', 'sleeves');
  run('back', 'neck'); run('scarf', 'neck'); run('chain', 'neck');
  // hands
  for (const side of [-1, 1]) {
    const [wx, wy] = g.wrist(side), turn = g.handTurn(side);
    if (turn) P.add(`<g transform="rotate(${turn} ${wx} ${wy})">`);
    hand(P, side, g.wrist(side), sk, (B.arm * 0.6 + 0.4) * 1.18);
    if (turn) P.add('</g>');
  }
  run('top', 'cuffs'); run('outer', 'cuffs');
  run('wrist', 'wrist'); run('hand', 'hand');
  // head
  drawHead(P, sk, ctx.hair, { jaw: B.jaw, beforeFace: () => run('beard', 'face') });
  run('ear', 'face'); run('face', 'face');
  run('hair', 'front');
  run('hat', 'head');
  return P.toString();
}
