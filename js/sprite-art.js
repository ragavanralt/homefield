// The fan, drawn as a pixel sprite in three-quarter view: the body is turned toward the viewer's left, the
// near arm and leg are on the right, the far ones peek out on the left. Items are small recipes that use the
// same body shapes, so everything fits every body type.
import { Spr, shadeHex, mix, W, H } from './sprite.js';

/* ------------------------------------------------------------------ body shapes */
const PATH = {
  armF: [[23, 30.8, 5], [21, 38, 4.6], [21.2, 45.5, 4.2], [22.4, 51.6, 3.8]],
  armN: [[41.4, 30.8, 5.8], [44.4, 38, 5.4], [44.6, 45.5, 4.8], [42.4, 51.8, 4.2]],
  legF: [[27.4, 50, 8.4], [26.6, 66, 7.6], [26.4, 84.6, 6.2]],
  legN: [[36.6, 50, 9], [37.2, 66, 8], [36.4, 85, 6.6]],
};
export const TORSO_PTS = [[22.6, 30.8], [27, 28.4], [36.6, 28.4], [41.6, 30.6], [42.6, 35], [41.4, 43.5], [40.4, 51.4], [23.6, 51.4], [22.4, 43.5], [21.6, 35]];

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
const HEAD_POLY = [[24, 16.4], [24.4, 21.8], [26, 25.8], [29, 28.4], [32.6, 28.6], [36, 27], [38.6, 23.6], [39.8, 19.6], [39.8, 15.6]];
function headMasks(S) {
  const m = {};
  m.head = S.or(S.ell(31.8, 16.2, 8, 7.4, false), S.poly(HEAD_POLY, false));
  m.nose = S.poly([[24.4, 19.6], [22, 22.6], [23.6, 24.2], [25.6, 23]], false);
  m.ear = S.ell(38.8, 20.4, 1.8, 2.6, false);
  return m;
}
function drawHead(S, m, skin, hairCol, beard) {
  S.paint(m.head, skin);
  S.paint(m.nose, skin, { bands: 1 });
  S.paint(m.ear, skin, { bands: 1 });
  if (beard) beard();
  const E = '#2A1A14', WH = '#F2EDE4', sk2 = shadeHex(skin, 0.2), sk3 = shadeHex(skin, 0.4), brow = shadeHex(hairCol, 0.12), lip = mix(skin, '#8E2F34', 0.5);
  const R = 'raw';
  // brows
  S.line(25, 14, 27, 14, brow, R); S.line(30, 14, 33, 14, brow, R); S.dot(34, 15, brow, R);
  // eyes: the far one is narrower because the face is turned
  S.dot(26, 16, E, R); S.dot(26, 17, E, R); S.dot(27, 16, WH, R); S.dot(27, 17, sk2, R);
  S.dot(30, 16, E, R); S.dot(31, 16, E, R); S.dot(32, 16, WH, R); S.dot(30, 17, E, R); S.dot(31, 17, E, R); S.dot(32, 17, sk2, R);
  // nose and cheek
  S.dot(25, 19, sk3, R); S.dot(26, 18, sk2, R); S.dot(28, 18, sk2, R); S.dot(28, 19, sk2, R);
  // mouth
  S.line(27, 22, 30, 22, lip, R); S.dot(31, 21, sk2, R); S.dot(28, 23, sk2, R); S.dot(29, 23, sk2, R);
  // jaw shadow
  S.line(30, 24, 36, 23, sk2, R); S.dot(37, 19, sk2, R); S.dot(37, 20, sk2, R); S.dot(37, 21, sk2, R);
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


/** Build the whole sprite. ctx: { skin, hair, eq, colourOf(id, fallback), pal, body } */
export function drawFan(ctx) {
  const S = new Spr(W, H);
  const { skin, eq, colourOf, pal, k } = ctx;
  S.k = k || 1;
  const g = geometry(S); g.k = S.k;
  const hm = headMasks(S);
  const item = (slot) => { const id = eq[slot]; const f = id && ART[slot][id]; return f ? { f, col: colourOf(id), id } : null; };
  const run = (slot, phase) => { const it = item(slot); if (it) it.f(S, g, it.col, phase, { skin, hair: ctx.hair, pal, hm }); };

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
  ['top', 'outer'].forEach((s2) => run(s2, 'near'));
  run('wrist', 'near'); run('hand', 'near');
  // --- head
  S.hs = 0.9; S.cy = 25.6;
  const hair = item('hair');
  if (hair) hair.f(S, g, hair.col, 'back', { skin, hair: ctx.hair, pal, hm });
  drawHead(S, hm, skin, ctx.hair, () => run('beard', 'head'));
  run('ear', 'head'); run('face', 'head');
  if (hair) hair.f(S, g, hair.col, 'front', { skin, hair: ctx.hair, pal, hm });
  run('hat', 'head');
  void mix;
  return S;
}
