// The fan, drawn as a pixel sprite in three-quarter view: the body is turned toward the viewer's left, the
// near arm and leg are on the right, the far ones peek out on the left. Items are small recipes that use the
// same body shapes, so everything fits every body type.
import { Spr, shadeHex, mix, W, H } from './sprite.js';

/* ------------------------------------------------------------------ body shapes */
const PATH = {
  armF: [[23, 30.8, 5.4], [21, 38, 4.9], [21, 44.5, 4.5], [21.4, 48.5, 4.5], [22.4, 51.6, 3.7]],
  armN: [[41.4, 30.8, 6.2], [44.4, 37.6, 5.9], [44.8, 43.8, 5.0], [44.2, 47.6, 4.8], [42.4, 51.8, 3.9]],
  legF: [[27.4, 50, 8.6], [26.9, 60, 7.9], [26.6, 66, 7.1], [26.5, 72, 7.7], [26.4, 79, 5.4], [26.4, 85, 5.6]],
  legN: [[36.6, 50, 9.2], [37, 60, 8.5], [37.3, 66, 7.5], [37.3, 72, 8.1], [36.8, 79, 5.8], [36.4, 85, 6.2]],
};
export const TORSO_PTS = [[22.2, 30.8], [27, 28.4], [36.6, 28.4], [42, 30.6], [43, 35], [41.8, 43.5], [40.6, 51.4], [23.4, 51.4], [22.2, 43.5], [21.2, 35]];

/** Cut a path off at y (interpolating the last point) and fatten it a little. */
function cut(path, yEnd, grow = 0) {
  const out = [];
  for (let i = 0; i < path.length; i++) {
    const [x, y, w] = path[i];
    if (y <= yEnd) { out.push([x, y, w + grow]); continue; }
    const [px, py, pw] = path[i - 1] || path[i];
    const t = (yEnd - py) / (y - py || 1);
    out.push([px + (x - px) * t, yEnd, pw + (w - pw) * t + grow]);
    break;
  }
  return out.length > 1 ? out : [...out, [out[0][0], out[0][1] + 0.01, out[0][2]]];
}
const grown = (path, grow) => path.map(([x, y, w]) => [x, y, w + grow]);

/** Everything the items need to hang on. Built once per fan. */
function geometry(S) {
  const g = { S, cut, PATH };
  g.torso = S.poly(TORSO_PTS);
  g.neck = S.poly([[28.4, 22], [35.2, 22], [36, 29], [27.4, 29]], false);
  g.armF = S.limb(PATH.armF); g.armN = S.limb(PATH.armN);
  g.handF = S.or(S.ell(22.6, 53.4, 2.3, 2.7), S.poly([[24, 51.6], [25.8, 53.2], [25, 55.4], [23.4, 53.8]]));
  g.handN = S.or(S.ell(42.2, 54, 2.6, 3), S.poly([[40.4, 52], [38.8, 54], [40, 56], [41.4, 54.2]]));
  g.legF = S.limb(PATH.legF); g.legN = S.limb(PATH.legN);
  g.hips = S.poly([[23.8, 48], [40.2, 48], [40.8, 54.4], [23.2, 54.4]]);
  return g;
}

/* ------------------------------------------------------------------ the head */
// the head outline in final design coordinates (turned to the left), softened with a corner-cutting pass
const HEAD_FINAL = [[24.9, 12.2], [24.4, 16], [24.4, 19.2], [25, 22.2], [26.1, 24.4], [27.9, 26], [30.2, 27], [32.7, 26.8], [35.1, 25.6], [37.2, 23.4], [38.6, 20.6], [39.2, 17.2], [39.1, 13], [37.8, 9.4], [35, 7.4], [31.8, 7], [28.6, 7.8], [26.2, 9.6]];
function chaikin(pts, n = 1) {
  let p = pts;
  for (let k = 0; k < n; k++) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } p = o; }
  return p;
}
function headMasks(S) {
  const m = {};
  m.head = S.poly(chaikin(HEAD_FINAL, 2), 'raw');
  return m;
}
const R = 'raw';
/** The face, drawn in final design coordinates. Eyes sit near y 16.5, brows near 14, mouth near 23. */
function drawHead(S, m, skin, hairCol, beard, neck) {
  const sk1 = shadeHex(skin, 0.1), sk2 = shadeHex(skin, 0.22), sk3 = shadeHex(skin, 0.38), hi = shadeHex(skin, -0.2);
  const ink = '#2A1A14', white = '#F4EFE8', brow = shadeHex(hairCol, 0.18), lip = mix(skin, '#9A3138', 0.55), lipD = mix(skin, '#6E1F26', 0.6);
  // shade under the chin on the neck
  if (neck) S.shade(S.and(neck, S.poly([[24, 24.4], [40, 24.4], [40, 31], [24, 31]], R)), 0.3, 190);
  // the nose pokes past the cheek because the face is turned; head, nose and ear share one outline
  const nose = S.poly(chaikin([[27.4, 15.6], [28.4, 16.4], [28.2, 19], [27.2, 20.6], [25.6, 21.5], [24.3, 21.1], [23.7, 20.3], [24.3, 19.4], [25.8, 17.2]], 2), R);
  const ear = S.or(S.ell(39, 19.6, 1.5, 2.5, R), S.ell(38.8, 21.9, 0.95, 1, R));
  S.paint(S.or(m.head, nose, ear), skin, { bands: 1 });
  // nose: lit tip, shaded underside, nostril
  S.flat(S.and(S.ell(24.6, 20.2, 0.8, 0.8, R), nose), hi, 200);
  S.shade(S.and(S.poly([[23.2, 21], [25.6, 21.9], [27.6, 21], [27.4, 22.4], [23.6, 22.4]], R), S.or(nose, m.head)), 0.2, 200);
  S.stroke([[23.7, 21], [24.8, 21.6], [26.3, 21.8], [27.4, 21]], sk3, 0.45, R, 230);
  S.spot(24.6, 21.2, 0.3, sk3);
  // ear: rim, inner fold and lobe
  S.shade(S.and(ear, S.ell(38.7, 19.9, 0.85, 1.6, R)), 0.26, 220);
  S.stroke([[38, 17.6], [39.4, 17.4], [40.4, 18.8], [40.3, 21], [39.5, 22.4]], sk3, 0.4, R, 240);
  S.stroke([[38.6, 18.6], [39.4, 19.4], [39.1, 21]], sk3, 0.4, R, 240);
  S.shade(S.and(ear, S.ell(39.6, 18.6, 0.5, 0.7, R)), -0.1, 180);
  if (beard) beard();
  // face shading: jaw and neck side, temple, under the brow and cheek
  S.shade(S.and(m.head, S.poly([[32, 26.6], [38.4, 22.4], [40.4, 19.4], [40.4, 29], [30, 29]], R)), 0.2, 170);
  S.shade(S.and(m.head, S.poly([[24, 22.4], [25.6, 24.6], [28.4, 27.4], [27.2, 22.6]], R)), 0.16, 150);
  S.shade(S.and(m.head, S.poly([[35.4, 17.6], [38.4, 17], [38.2, 22.4], [36, 24]], R)), 0.12, 160);
  S.flat(S.and(m.head, S.ell(31.6, 21.2, 2.5, 1.4, R)), '#E58C7C', 30);
  S.flat(S.and(m.head, S.ell(26.8, 21.8, 1.2, 0.9, R)), '#E58C7C', 22);
  // nose bridge, side and nostril
  S.shade(S.and(m.head, S.poly([[28.6, 15.6], [29.7, 16.2], [29.2, 19.6], [27.6, 21.5], [27, 20.6], [28.2, 18.6]], R)), 0.17, 190);
  S.stroke([[25.1, 21.3], [26.2, 21.7], [27, 21.2]], sk3, 0.45, R, 230);
  S.spot(25.1, 21, 0.3, sk3);
  // brows
  S.stroke([[24.9, 14.3], [26.2, 13.5], [27.9, 13.4]], brow, 0.75, R);
  S.stroke([[30, 13.5], [32.4, 13.1], [34.4, 13.8], [35.2, 14.6]], brow, 0.85, R);
  // eyes: far one is narrower because of the turn
  const eye = (cx, cy, rx, ry, ix) => {
    S.flat(S.ell(cx, cy, rx, ry, R), white);
    const clip = S.ell(cx, cy, rx, ry, R);
    S.flat(S.and(clip, S.ell(ix, cy + 0.05, ry * 0.95, ry * 1.05, R)), '#4A3022');
    S.flat(S.and(clip, S.ell(ix - 0.05, cy + 0.05, ry * 0.52, ry * 0.58, R)), '#120A07');
    S.spot(ix - 0.4, cy - 0.35, 0.28, '#FFFFFF');
    S.stroke([[cx - rx - 0.1, cy - 0.1], [cx - rx * 0.4, cy - ry - 0.15], [cx + rx * 0.5, cy - ry - 0.1], [cx + rx + 0.15, cy + 0.15]], ink, 0.55, R);
    S.stroke([[cx - rx * 0.6, cy + ry + 0.1], [cx + rx * 0.5, cy + ry + 0.12]], sk2, 0.35, R, 150);
  };
  eye(26.7, 16.7, 1.35, 1.05, 26.3);
  eye(32.1, 16.5, 1.75, 1.2, 31.5);
  // mouth: a soft curve with a lower-lip highlight
  S.stroke([[26.3, 23.1], [28, 23.7], [29.8, 23.4], [31.2, 22.7]], lipD, 0.5, R);
  S.stroke([[27, 24.3], [28.8, 24.6], [30.2, 24.2]], lip, 0.55, R, 200);
  S.stroke([[27.4, 22.7], [28.8, 22.5], [30.2, 22.5]], lip, 0.4, R, 140);
  S.stroke([[28, 26.4], [30, 26.5]], sk2, 0.5, R, 120);
}

/* ------------------------------------------------------------------ shared recipe helpers */
const CX = 31.8; // middle of the torso
const FRONT = 30; // the line down the front of a shirt: the body is turned, so it sits left of centre
const sleeveOf = (S, path, yEnd, grow) => S.limb(cut(path, yEnd, grow));
const torsoShape = (S, { wide = 1, hem = 51.8, shoulder = 0 } = {}) => S.poly(TORSO_PTS.map(([x, y]) => [CX + (x - CX) * wide + (y < 31 ? 0 : 0), y >= 51 ? hem : y - (y < 30 ? shoulder : 0)]));
const NECK = {
  crew: (S) => S.ell(30.2, 28.6, 4.3, 2.8),
  v: (S) => S.poly([[26, 27.6], [34.8, 27.6], [30.4, 34.6]]),
  scoop: (S) => S.ell(30.2, 28.4, 4.8, 4.2),
  tank: (S) => S.poly([[26.6, 27.6], [34.6, 27.6], [35, 31], [30.4, 34.5], [26, 31.4]]),
  none: () => null,
};
const dk = (c, a = 0.25) => shadeHex(c, a);
const lt = (c, a = 0.25) => shadeHex(c, -a);
// 3x5 digits for jersey numbers
const DIG = { 0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'] };
function digits(S, str, x, y, colour) {
  [...String(str)].forEach((ch, n) => (DIG[ch] || []).forEach((row, j) => [...row].forEach((v, i) => { if (v === '1') S.dot(x + n * 4 + i, y + j, colour); })));
}

/** A top: torso garment plus sleeves. o: { sleeve, hem, wide, neck, grow, ...hooks } */
function top(o) {
  return (S, g, col, ph, c) => {
    const main = o.main ? o.main(c.pal, col) : (col || o.def || '#888');
    const yEnd = { short: 38.8, elbow: 44.6, long: 51.2, none: null }[o.sleeve || 'short'];
    const grow = o.grow ?? 1.4;
    if (ph === 'far' && yEnd) {
      const m = sleeveOf(S, PATH.armF, yEnd, grow);
      S.paint(m, o.sleeveCol ? o.sleeveCol(c.pal, main) : main);
      if (o.cuff) o.cuff(S, m, g, c, 'far', main);
    }
    if (ph === 'mid') {
      const tm = torsoShape(S, o);
      const hole = (NECK[o.neck || 'crew'] || NECK.crew)(S);
      S.paint(hole ? S.sub(tm, hole) : tm, main, { lineAmt: o.lineAmt });
      if (o.neck === 'tank' || !o.neck) { /* nothing extra */ }
      if (o.detail) o.detail(S, tm, g, c, main);
      if (o.collar) o.collar(S, g, c, main);
    }
    if (ph === 'near' && yEnd) {
      const m = sleeveOf(S, PATH.armN, yEnd, grow);
      S.paint(m, o.sleeveCol ? o.sleeveCol(c.pal, main) : main);
      if (o.cuff) o.cuff(S, m, g, c, 'near', main);
      if (o.nearDetail) o.nearDetail(S, m, g, c, main);
    }
  };
}
/** Pants or shorts. o: { end, grow, flare, band, belt, detail } */
function pants(o) {
  return (S, g, col, ph, c) => {
    if (ph !== 'far' && ph !== 'nearleg' && ph !== 'hips') return;
    const main = o.main ? o.main(c.pal, col) : (col || o.def || '#888');
    const grow = o.grow ?? 1;
    const mk = (path) => {
      let pts = cut(path, o.end ?? 83.6, grow);
      pts = pts.map(([x, y, w], i) => [x, y, w + (o.flare && i === pts.length - 1 ? o.flare : 0)]);
      pts[0] = [pts[0][0], 46.4, pts[0][2] + 1];
      return S.limb(pts);
    };
    if (ph === 'far' || ph === 'nearleg') {
      const m = mk(ph === 'far' ? PATH.legF : PATH.legN);
      S.paint(m, o.legCol ? o.legCol(c.pal, main, ph) : main);
      if (o.detail) o.detail(S, m, g, c, main, ph);
      if (o.cuffEnd) o.cuffEnd(S, m, g, c, main, ph);
    }
    if (ph === 'hips') {
      const band = S.poly([[23.4, 47.4], [40.8, 47.4], [41.2, 50.6], [23, 50.6]]);
      S.paint(band, o.bandCol ? o.bandCol(c.pal, main) : main, { lineAmt: 0.5 });
      if (o.belt) S.flat(S.and(band, S.rect(22, 49, 44, 50)), o.belt);
      if (o.hips) o.hips(S, g, c, main);
    }
  };
}
/** Shoes: o: { up, sole, high, lace, toe } */
const FOOT_F = [[29.8, 82.4], [23.4, 82.8], [19.4, 86.2], [19.2, 89.4], [30.2, 89.4]];
const FOOT_N = [[40, 82.2], [33.4, 82.8], [28.4, 86.2], [28.4, 89.6], [40.8, 89.6]];
function shoes(o) {
  return (S, g, col, ph, c) => {
    if (ph !== 'far' && ph !== 'near') return;
    const main = o.main ? o.main(c.pal, col) : (col || o.def || '#EEE');
    const far = ph === 'far';
    let m = S.poly(far ? FOOT_F : FOOT_N);
    const path = far ? PATH.legF : PATH.legN;
    if (o.high) m = S.or(m, S.limb(cut(path.map(([x, y, w]) => [x, y, w]), 84).filter((p) => p[1] >= o.high).length > 1 ? [[path[2][0], o.high, path[2][2] + 1.4], [path[2][0], 84, path[2][2] + 1.4]] : [[path[2][0], o.high, 7.6], [path[2][0], 84, 7.6]]));
    S.paint(m, main);
    const sole = S.and(m, S.rect(0, o.soleY ?? 87.6, 64, 90));
    if (o.sole !== false) S.flat(sole, o.sole || '#F4F1EA');
    if (o.detail) o.detail(S, m, g, c, main, far);
  };
}


/** A jacket or coat. o: { len, wide, sleeve, grow, open, collar, detail, cuff } */
function outer(o) {
  return (S, g, col, ph, c) => {
    const main = o.main ? o.main(c.pal, col) : (col || o.def || '#555');
    const grow = o.grow ?? 2;
    const yEnd = { short: 40, none: null, long: 51.6 }[o.sleeve || 'long'];
    const sleeveCol = o.sleeveCol ? o.sleeveCol(c.pal, main) : main;
    if (ph === 'far' && yEnd) {
      const m = sleeveOf(S, PATH.armF, yEnd, grow);
      S.paint(m, sleeveCol);
      if (o.cuff) o.cuff(S, m, g, c, 'far', main);
      if (o.armDetail) o.armDetail(S, m, g, c, main, 'far');
    }
    if (ph === 'mid') {
      const len = o.len ?? 52.6, wide = o.wide ?? 1.07;
      const base = TORSO_PTS.slice(0, 5).map(([x, y]) => [CX + (x - CX) * wide, y]);
      const lowL = [[CX + (22.4 - CX) * wide, 43.5]], lowR = [[CX + (41.4 - CX) * wide, 43.5]];
      let pts;
      if (len > 56) pts = [...base, [CX + (42.4 - CX) * wide, 48], [CX + (44 - CX) * wide, len], [CX + (20.6 - CX) * wide, len], [CX + (21.8 - CX) * wide, 48], ...lowL, [CX + (21.6 - CX) * wide, 35]];
      else pts = [...base, ...lowR, [CX + (40.8 - CX) * wide, len], [CX + (23.2 - CX) * wide, len], ...lowL, [CX + (21.6 - CX) * wide, 35]];
      let tm = S.poly(pts);
      const hole = (o.hole || ((SS) => SS.ell(30.4, 28.4, 3.8, 2.4)))(S);
      let shape = hole ? S.sub(tm, hole) : tm;
      if (o.open) shape = S.sub(shape, S.poly([[28.6, 29], [31.6, 29], [32.6, 54], [28.2, 54]]));
      S.paint(shape, main, { lineAmt: o.lineAmt });
      if (o.open) S.line(31, 31, 31.4, len > 56 ? 70 : 52, dk(main, 0.4), true, tm);
      if (o.detail) o.detail(S, tm, g, c, main);
      if (o.collar) o.collar(S, g, c, main);
    }
    if (ph === 'near' && yEnd) {
      const m = sleeveOf(S, PATH.armN, yEnd, grow);
      S.paint(m, sleeveCol);
      if (o.cuff) o.cuff(S, m, g, c, 'near', main);
      if (o.armDetail) o.armDetail(S, m, g, c, main, 'near');
    }
  };
}
export const HELP = { top, pants, shoes, outer, NECK, torsoShape, sleeveOf, digits, dk, lt, CX, FRONT, PATH, cut, TORSO_PTS, FOOT_F, FOOT_N, mix, shadeHex };

/* ------------------------------------------------------------------ registry of item recipes */
export const ART = { hair: {}, hat: {}, face: {}, beard: {}, ear: {}, top: {}, outer: {}, scarf: {}, chain: {}, wrist: {}, bottom: {}, shoes: {}, back: {}, hand: {} };


/** Muscle and joint definition laid over the bare skin: shoulders, biceps, elbows, forearms, knees and calves. */
function definition(S, g, skin, hasLegs) {
  const clipN = g.armN, clipF = g.armF, st = (pts, w) => S.strokeMask(pts, w, true);
  // near arm (the one we see most of)
  S.shade(S.and(S.ell(44.2, 34.4, 2.3, 2.6), clipN), -0.17, 240);
  S.shade(S.and(S.ell(42.9, 40.2, 1.5, 3.1), clipN), -0.15, 240);
  S.shade(S.and(st([[41.6, 43.4], [43, 44.2], [45, 43.4]], 0.8), clipN), 0.37, 240);
  S.shade(S.and(st([[46.9, 35.4], [47.3, 41.4], [47.2, 46.4], [46.1, 50.6]], 1.1), clipN), 0.34, 240);
  S.shade(S.and(S.ell(44.9, 44.9, 1.5, 1.1), clipN), 0.2, 208);
  S.shade(S.and(st([[43.2, 46], [43.2, 49.4]], 0.9), clipN), -0.14, 240);
  S.shade(S.and(st([[41.2, 33], [41.6, 38]], 0.8), clipN), 0.24, 208);
  // far arm
  S.shade(S.and(st([[19.2, 36], [19, 41.6], [19.4, 47]], 1.0), clipF), 0.31, 240);
  S.shade(S.and(S.ell(21.6, 40, 1.2, 2.6), clipF), -0.12, 208);
  S.shade(S.and(S.ell(21.2, 44.8, 1.4, 1.0), clipF), 0.17, 192);
  if (!hasLegs) return;
  // legs: knee, shin highlight, calf split and a narrow ankle
  S.shade(S.and(S.ell(37.2, 64.6, 2.4, 1.6), g.legN), 0.17, 224);
  S.shade(S.and(S.ell(36.2, 64.4, 1.3, 1.0), g.legN), -0.2, 240);
  S.shade(S.and(st([[35.4, 67.4], [35.2, 78]], 0.9), g.legN), -0.17, 240);
  S.shade(S.and(st([[39.4, 69], [39, 74], [38, 80]], 0.9), g.legN), 0.34, 255);
  S.shade(S.and(st([[37.6, 71], [37.6, 76.6], [37, 80]], 0.5), g.legN), 0.31, 208);
  S.shade(S.and(S.ell(26.4, 64.6, 2.2, 1.5), g.legF), 0.17, 224);
  S.shade(S.and(st([[25, 68], [24.8, 78]], 0.8), g.legF), -0.14, 224);
  S.shade(S.and(st([[28.6, 69], [28.2, 76], [27.6, 80]], 0.8), g.legF), 0.34, 240);
}

/** Build the whole figure. ctx: { skin, hair, eq, colourOf(id), pal, k, win: [x, y, w, h], R } */
export function drawFan(ctx) {
  const S = new Spr(ctx.win || [0, 0, W, H], ctx.R || 1);
  const { skin, eq, colourOf, pal, k } = ctx;
  S.k = k || 1;
  const g = geometry(S); g.k = S.k;
  const hm = headMasks(S);
  hm.neck = g.neck;
  const item = (slot) => { const id = eq[slot]; const f = id && ART[slot][id]; return f ? { f, col: colourOf(id), id } : null; };
  const run = (slot, phase) => { const it = item(slot); if (it) it.f(S, g, it.col, phase, { skin, hair: ctx.hair, pal, hm }); };
  const botId = eq.bottom, bareLegs = !botId || /shorts|tshorts|jorts|cs_/.test(botId);

  // ground shadow
  S.paint(S.ell(32, 88.2, 17, 2.6, false), '#000000', { alpha: 70 });

  // --- behind everything
  run('back', 'back');
  // --- far side: the arm that is turned away
  S.paint(g.armF, skin);
  S.paint(g.handF, skin, { bands: 1 });
  ['top', 'outer'].forEach((s2) => run(s2, 'far'));
  S.paint(g.neck, skin);
  S.paint(g.torso, skin);
  // --- legs, far then near, shoes under the trouser hems
  S.paint(g.legF, skin);
  run('shoes', 'far'); run('bottom', 'far');
  S.paint(g.legN, skin);
  run('shoes', 'near'); run('bottom', 'nearleg');
  run('bottom', 'hips');
  // --- the body
  run('top', 'mid'); run('outer', 'mid');
  ['scarf', 'chain'].forEach((s2) => run(s2, 'mid'));
  // --- near arm
  S.paint(g.armN, skin);
  S.paint(g.handN, skin, { bands: 1 });
  definition(S, g, skin, bareLegs);
  ['top', 'outer'].forEach((s2) => run(s2, 'near'));
  run('wrist', 'near'); run('hand', 'near');
  // --- head
  S.hs = 0.9; S.cy = 25.6;
  const hair = item('hair');
  if (hair) hair.f(S, g, hair.col, 'back', { skin, hair: ctx.hair, pal, hm });
  drawHead(S, hm, skin, ctx.hair, () => run('beard', 'head'), g.neck);
  run('ear', 'head'); run('face', 'head');
  if (hair) hair.f(S, g, hair.col, 'front', { skin, hair: ctx.hair, pal, hm });
  run('hat', 'head');
  void mix;
  return S;
}
