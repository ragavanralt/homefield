// Every wearable as a small SVG recipe drawn on the shared body (fan.js). A recipe is
// (P, g, col, phase, c): P the pen, g the body geometry, col the chosen colour (or undefined), phase the
// layer being drawn, c = { skin, sk, hair, pal, B, g }. Team gear reads c.pal (t1, t2, tink, tacc).
import { ART, Pen, tubeD, CX, OW, ramp, adj, mix, dk, lt, tube, cutJ, cutF, curve, blob, poly, torsoD, torsoPts, halfD, segs, pt } from './fan.js';

const GOLD = '#E8B93A', GOLD2 = '#A87A1A', GOLDHI = '#FFE9A0', SILVER = '#CDD3DC', SILVER2 = '#8E96A3', INK = '#16131A';
const colOf = (o, c, col) => (o.main ? o.main(c.pal, col) : col || o.def || '#888888');
const mirror = (P2) => P2.map(([x, y]) => [200 - x, y]);
const both = (f) => [-1, 1].forEach(f);

/* ------------------------------------------------------------------ shared garment pieces */
/** shading bands that follow the side of a torso-shaped garment (right side darker, a light edge on the left) */
function bodyShade(B, grow, hem, top, R) {
  const pts = torsoPts(B, grow, hem, top);
  const band = (f) => blob([...pts.map(([x, y]) => [CX + (x - CX) * (1 - f) - 2, y]), [CX + 90, hem + 20], [CX + 90, pts[0][1] - 20]]);
  const lit = blob([...mirror(pts).map(([x, y]) => [CX + (x - CX) * 0.9 + 2, y]), [CX - 90, hem + 20], [CX - 90, pts[0][1] - 20]]);
  return [[band(0.36), R.sh], [band(0.13), R.deep], [lit, R.hi]];
}
function sleeve(P, g, side, f, grow, R, o = {}) {
  const T = tube(cutF(g.armJ(side), 0, f, grow));
  P.tube(T, R, { cap0: o.cap0 ?? true, cap1: false, extra: o.extra, open: o.seam ? 0 : side, hem: true });
  return T;
}
/** the visible skin and collar at a neckline */
function neckline(P, c, type, R, o = {}) {
  const { B, sk } = c, nk = B.nk;
  if (type === 'none') return;
  const depth = { crew: 120, scoop: 128, v: 138, deepv: 150, tank: 128 }[type] || 120;
  const open = type === 'v' || type === 'deepv'
    ? poly([[CX - nk - 1.5, 106], [CX + nk + 1.5, 106], [CX + nk + 3.5, 113], [CX, depth], [CX - nk - 3.5, 113]])
    : blob([[CX - nk - 1, 105], [CX + nk + 1, 105], [CX + nk + 4, 113], [CX + nk * 0.4, depth - 0.5], [CX - nk * 0.4, depth - 0.5], [CX - nk - 4, 113]]);
  P.fill(open, sk.base);
  P.clip(open, `<path d="${poly([[CX + nk * 0.3, 100], [CX + 40, 100], [CX + 40, 160], [CX + nk * 0.3, 160]])}" fill="${sk.sh}"/><path d="${blob([[CX - nk - 4, 100], [CX + nk + 4, 100], [CX + nk + 3, 110], [CX, 113.5], [CX - nk - 3, 110]])}" fill="${sk.deep}" opacity="0.9"/>`);
  const edge = type === 'v' || type === 'deepv' ? [[CX - nk - 3.5, 112.5], [CX - nk * 0.4, 124], [CX, depth], [CX + nk * 0.4, 124], [CX + nk + 3.5, 112.5]] : [[CX - nk - 4, 112.5], [CX - nk * 0.5, depth - 1], [CX + nk * 0.5, depth - 1], [CX + nk + 4, 112.5]];
  if (o.rib !== false) { P.stroke(curve(edge), R.line, 5.2); P.stroke(curve(edge), o.ribCol || R.sh, 3); }
  else P.stroke(curve(edge), R.line, OW);
}
/** a top: o = { def, main, sleeve: short|elbow|long|none, grow, hem, neck, rib, detail, collar, cuff, sleeveCol } */
function top(o) {
  return (P, g, col, ph, c) => {
    const main = colOf(o, c, col), R = ramp(main), B = c.B, grow = o.grow ?? 3, hem = o.hem ?? 203;
    const yEnd = { short: 0.36, elbow: 0.6, long: 0.9, none: null }[o.sleeve ?? 'short'];
    if (ph === 'body') {
      const d = o.shape === 'tank' ? tankD(B, grow, hem) : torsoD(B, grow, hem);
      P.part(d, R, { shade: bodyShade(B, grow, hem, 0, R) });
      if (o.detail) o.detail(P, c, R, d, main);
      neckline(P, c, o.neck ?? 'crew', R, { rib: o.rib, ribCol: o.ribCol ? o.ribCol(c.pal, main) : undefined });
      if (o.collar) o.collar(P, c, R, main);
    }
    if (ph === 'sleeves' && yEnd) both((side) => {
      const SR = o.sleeveCol ? ramp(o.sleeveCol(c.pal, main)) : R;
      sleeve(P, g, side, yEnd, (o.sgrow ?? 4) * (c.B.arm * 0.5 + 0.5), SR, { seam: !!o.sleeveCol });
      if (o.trim) o.trim(P, g, side, yEnd, c, R, main);
    });
    if (ph === 'cuffs' && yEnd && o.sleeve === 'long') both((side) => {
      const SR = o.sleeveCol ? ramp(o.sleeveCol(c.pal, main)) : R;
      const T = tube(cutF(g.armJ(side), 0.85, 1.0, (o.sgrow ?? 4) * (c.B.arm * 0.5 + 0.5) + 0.5));
      P.tube(T, o.cuffCol ? ramp(o.cuffCol(c.pal, main)) : { ...SR, base: SR.sh, hi: SR.base, sh: SR.deep }, { cap0: false, cap1: false });
    });
  };
}
function tankD(B, grow, hem) {
  const nk = B.nk, R = torsoPts(B, grow, hem).filter(([, y]) => y >= 149);
  const side = [[CX + nk + 2, 111], [CX + nk + 9, 112.5], [CX + B.ch - 4 + grow * 0.5, 128], [CX + B.ch + 1 + grow, 141], ...R];
  const Ls = mirror(side).reverse();
  const scoop = [[CX - nk - 2, 111], [CX - nk + 1, 121], [CX, 126], [CX + nk - 1, 121], [CX + nk + 2, 111]];
  return `M${pt(side[0])}${segs(side)} L${pt(Ls[0])}${segs(Ls)} L${pt(scoop[0])}${segs(scoop)}Z`;
}
/** jackets and coats: o = { def, main, len, grow, open, gap, collar, detail, sleeveCol, cuff, closed } */
function outer(o) {
  return (P, g, col, ph, c) => {
    const main = colOf(o, c, col), R = ramp(main), B = c.B, grow = o.grow ?? 6, hem = o.len ?? 214;
    const SR = o.sleeveCol ? ramp(o.sleeveCol(c.pal, main)) : R;
    if (ph === 'body') {
      if (o.closed) {
        const d = torsoD(B, grow, hem, 2);
        P.part(d, R, { shade: bodyShade(B, grow, hem, 2, R) });
        if (o.detail) o.detail(P, c, R, d, main, B, grow, hem);
      } else {
        const gap = o.gap || ((y) => (y < 150 ? 3 + (150 - y) * 0.28 : 3 + (y - 150) * 0.03));
        both((side) => {
          const d = halfD(B, side, grow, hem, 2, gap);
          P.part(d, R, { shade: side > 0 ? bodyShade(B, grow, hem, 2, R).slice(0, 2) : bodyShade(B, grow, hem, 2, R).slice(2) });
        });
        if (o.detail) o.detail(P, c, R, null, main, B, grow, hem);
      }
      if (o.collar) o.collar(P, c, R, main, B);
    }
    if (ph === 'sleeves' && o.sleeve !== 'none') both((side) => {
      const T = sleeve(P, g, side, o.sleeve === 'short' ? 0.38 : 0.92, (o.sgrow ?? 6.5) * (B.arm * 0.5 + 0.5), SR, { seam: !!o.sleeveCol });
      if (o.stripe) { const pts = T.J.map(([x, y, w], i) => [x - side * w * 0.36, y]); const colr = o.stripe(c.pal, main); P.stroke(curve(pts.slice(0, -1)), colr, 2.6); }
    });
    if (ph === 'cuffs' && o.sleeve !== 'none' && o.sleeve !== 'short') both((side) => {
      const T = tube(cutF(g.armJ(side), 0.86, 1.0, (o.sgrow ?? 6.5) * (B.arm * 0.5 + 0.5) + 0.5));
      const CR = o.cuff ? ramp(o.cuff(c.pal, main)) : { ...SR, base: SR.sh, hi: SR.base, sh: SR.deep };
      P.tube(T, CR, { cap0: false, cap1: false });
    });
  };
}
/** trousers and shorts: o = { def, main, end, grow, flare, detail, legCol, band, belt } */
function pants(o) {
  return (P, g, col, ph, c) => {
    if (ph !== 'legs') return;
    const main = colOf(o, c, col), R = ramp(main), B = c.B, grow = (o.grow ?? 3.2) * (B.leg * 0.4 + 0.6), end = o.end ?? 306;
    const Js = {};
    both((side) => {
      let J = cutJ(g.legJ(side), end, grow, 194);
      if (o.flare) J = J.map(([x, y, w], i) => [x + (o.flare * 0.15 * side) * (i / (J.length - 1)), y, w + o.flare * (i / (J.length - 1)) ** 1.6]);
      if (o.straight) J = J.map(([x, y, w], i) => [x, y, Math.max(w, J[0][2] * o.straight)]);
      // baggy: one straight, loose drop from the hip, a touch wider at the hem, no knee or calf shape showing
      if (o.bag) { const a = J[0], b = J[J.length - 1], n = 9, wf = a[2], wh = a[2] - grow + 3, wb = wf * (o.bag.hem ?? 1.06), xb = b[0] + side * (o.bag.out ?? 2.5);
        // fitted at the hip so nothing pokes out under a shirt, then it drops loose and straight
        J = Array.from({ length: n }, (_, i) => { const t = i / (n - 1), u = Math.min(1, t / 0.3), e = u * u * (3 - 2 * u); return [a[0] + (xb - a[0]) * t, a[1] + (b[1] - a[1]) * t, t < 0.3 ? wh + (wf - wh) * e : wf + (wb - wf) * ((t - 0.3) / 0.7)]; }); }
      // never wider than the hips up top, so no pants poke out beside a shirt hem on any body type
      J = J.map(([x, y, w]) => { if (y > 212) return [x, y, w]; const t = Math.max(0, Math.min(1, (y - 184) / 18)), lim = B.wa + B.be + (B.hp + B.be * 0.4 - B.wa - B.be) * t + (y > 203 ? (y - 203) * 0.6 : 0) - 0.5, over = Math.abs(x - CX) + w / 2 - lim; return over > 0 ? [x - side * over / 2 * Math.sign(x - CX) * side, y, w - over] : [x, y, w]; });
      // keep a gap between the legs below the crotch so they read as two legs, not one block
      if (J.length && J[J.length - 1][1] > 230 && !J.some(([, y]) => y > 222 && y < 232)) { const i = J.findIndex(([, y]) => y >= 232); if (i > 0) { const a = J[i - 1], b = J[i], t = (226 - a[1]) / (b[1] - a[1]); if (t > 0 && t < 1) J.splice(i, 0, [a[0] + (b[0] - a[0]) * t, 226, a[2] + (b[2] - a[2]) * t]); } }
      J = J.map(([x, y, w]) => { const m = y <= 222 ? -99 : 0.5 + Math.min(3.2, (y - 222) * 0.05), d = Math.abs(x - CX) - w / 2; return d < m ? [x + side * (m - d) / 2, y, w - (m - d)] : [x, y, w]; });
      if (o.one) { Js[side] = J; return; }
      const LR = o.legCol ? ramp(o.legCol(c.pal, main, side)) : R;
      const TJ = tube(J);
      P.tube(TJ, LR, { cap0: false, cap1: false });
      // leg details (stripes, pockets, folds) stay inside the leg
      if (o.legDetail) { const Q = new Pen(); o.legDetail(Q, g, side, J, c, LR, main); P.clip(tubeD(TJ, false, false), Q.toString()); P.stroke(tubeD(TJ, false, false), LR.line, OW); }
    });
    const w = B.wa + B.be * 0.9 + grow * 0.15 - 2.8, wh = B.hp + B.be * 0.4 + grow * 0.55 - 2.6;
    if (o.one) {
      // shorts: one clean piece from the waist to a straight hem, with a short split between the legs
      const edge = (side, k) => { const [x, , ww] = Js[side][Js[side].length - 1]; return x + k * side * ww / 2; };
      const hy = Js[1][Js[1].length - 1][1], cy = hy - 13;
      const sideR = [[CX + w, 191], [CX + wh + 0.6, 206], [edge(1, 1), hy]], sideL = [[edge(-1, 1), hy], [CX - wh - 0.6, 206], [CX - w, 191]];
      const d = `M${pt([CX - w, 191])} L${pt(sideR[0])}${segs(sideR)} L${pt([Math.max(CX + 2, edge(1, -1)), hy + 0.6])} L${pt([CX, cy])} L${pt([Math.min(CX - 2, edge(-1, -1)), hy + 0.6])} L${pt(sideL[0])}${segs(sideL)}Z`;
      P.fill(d, R.base);
      const Q = new Pen();
      Q.add(`<path d="${poly([[CX + wh * 0.42, 180], [CX + 90, 180], [CX + 90, 340], [CX + wh * 0.5, 340]])}" fill="${R.sh}"/><path d="${poly([[CX + wh * 0.88, 180], [CX + 90, 180], [CX + 90, 340], [CX + wh * 0.92, 340]])}" fill="${R.deep}"/><path d="${poly([[CX - wh - 2, 180], [CX - wh * 0.78, 180], [CX - wh * 0.82, 340], [CX - wh - 6, 340]])}" fill="${R.hi}" opacity="0.6"/>`);
      if (o.legDetail) both((side) => o.legDetail(Q, g, side, Js[side], c, R, main));
      Q.stroke(curve([[CX - 1, 212], [CX - 0.5, 224], [CX, cy]]), R.sh, 1.3, 0.8);
      P.clip(d, Q.toString());
      P.stroke(d, R.line, OW);
    } else {
    // hips: one piece over the tops of both legs
    const hipD = blob([[CX - w, 191], [CX + w, 191], [CX + wh + 0.6, 206], [CX + wh * 0.55, 218], [CX, 224], [CX - wh * 0.55, 218], [CX - wh - 0.6, 206]]);
    P.fill(hipD, R.base);
    P.clip(hipD, `<path d="${poly([[CX + wh * 0.45, 180], [CX + 80, 180], [CX + 80, 240], [CX + wh * 0.4, 240]])}" fill="${R.sh}"/><path d="${poly([[CX + wh * 0.86, 180], [CX + 80, 180], [CX + 80, 240], [CX + wh * 0.8, 240]])}" fill="${R.deep}"/>`);
    P.stroke(curve([[CX - wh - 0.6, 207], [CX - w, 191], [CX + w, 191], [CX + wh + 0.6, 207]]), R.line, OW);
    P.stroke(curve([[CX, 207], [CX, 224]]), R.line, 1.4);
    }
    // waistband
    const bandCol = o.band ? o.band(c.pal, main) : dk(main, 0.06);
    P.part(poly([[CX - w, 191], [CX + w, 191], [CX + w + 0.8, 197], [CX - w - 0.8, 197]]), { ...ramp(bandCol) }, { line: R.line, w: 1.4 });
    if (o.belt) { P.fill(poly([[CX - w, 192.5], [CX + w, 192.5], [CX + w + 0.6, 196.5], [CX - w - 0.6, 196.5]]), o.belt); P.fill(poly([[CX - 3.5, 191.5], [CX + 3.5, 191.5], [CX + 3.5, 197.5], [CX - 3.5, 197.5]]), GOLD); }
    if (o.fly !== false) P.stroke(curve([[CX + 1.5, 198], [CX + 2.2, 212], [CX, 217]]), R.line, 1.2, 0.8);
    if (o.detail) o.detail(P, c, R, main, w);
  };
}
/** shoes, front view: o = { def, main, h (collar height), sole, soleH, toe, laces, detail, shine, wide } */
function shoes(o) {
  return (P, g, col, ph, c) => {
    if (ph !== 'feet') return;
    const main = colOf(o, c, col), R = ramp(main);
    both((side) => {
      const [ax, ay] = g.ankle(side), wd = o.wide ?? 1, hgt = o.h ?? 0, sH = o.soleH ?? 4.5;
      const X = (dx) => ax + dx * side, tx = ax + 3 * side, T = (dx) => tx + dx * side;
      const outline = blob([[X(-8 * wd), ay - 4 - hgt], [X(8 * wd), ay - 4 - hgt], [X(11 * wd), ay + 3], [T(15.5 * wd), ay + 12.5], [T(15 * wd), ay + 20], [tx, ay + 22.5], [T(-15 * wd), ay + 20], [T(-15.5 * wd), ay + 12.5], [X(-11 * wd), ay + 3]]);
      P.fill(outline, R.base);
      const soleCol = o.sole ?? '#F2EFE8';
      P.clip(outline, [
        `<path d="${poly([[tx + 3, ay - 30], [tx + 40, ay - 30], [tx + 40, ay + 30], [tx + 5, ay + 30]])}" fill="${R.sh}"/>`,
        `<path d="${blob([[tx - 9, ay + 3], [tx - 2, ay + 1], [tx - 4, ay + 9], [tx - 10, ay + 10]])}" fill="${R.hi}"/>`,
        soleCol ? `<path d="${poly([[ax - 40, ay + 22.5 - sH], [ax + 40, ay + 22.5 - sH], [ax + 40, ay + 30], [ax - 40, ay + 30]])}" fill="${soleCol}"/><path d="${poly([[tx + 4, ay + 22.5 - sH], [ax + 40, ay + 22.5 - sH], [ax + 40, ay + 30], [tx + 6, ay + 30]])}" fill="${dk(soleCol, 0.12)}"/>` : '',
        o.inner ? o.inner(c, R, main, ax, ay, side, tx) : '',
      ].join(''));
      if (soleCol) P.stroke(curve([[tx - 15.2 * wd, ay + 22.5 - sH], [tx, ay + 23 - sH], [tx + 15 * wd, ay + 22.5 - sH]]), R.line, 1.2, 0.8);
      P.stroke(outline, R.line, OW);
      // collar opening at the ankle
      P.fill(blob([[X(-6.5 * wd), ay - 3.5 - hgt], [X(6.5 * wd), ay - 3.5 - hgt], [X(5 * wd), ay - 0.5 - hgt], [X(-5 * wd), ay - 0.5 - hgt]]), dk(main, 0.32));
      if (o.laces !== false) for (let i = 0; i < (o.laces || 3); i++) P.stroke(curve([[tx - 4.5, ay + 3 + i * 3.4], [tx + 4.5, ay + 2 + i * 3.4]]), o.laceCol || dk(main, 0.25), 1.6);
      if (o.detail) o.detail(P, c, R, main, ax, ay, side, tx);
      if (o.shine) P.stroke(curve([[tx - 7, ay + 6], [tx - 3, ay + 3]]), '#FFFFFF', 1.6, 0.8);
    });
  };
}

/* ============================================================ TOPS */
const hood = (P, c, R) => { const nk = c.B.nk; P.shape(blob([[CX - nk - 12, 114], [CX - nk - 3, 106], [CX + nk + 3, 106], [CX + nk + 12, 114], [CX + nk + 4, 120], [CX, 124], [CX - nk - 4, 120]]), R.sh, { line: R.line }); P.stroke(curve([[CX - nk - 3, 113], [CX, 121], [CX + nk + 3, 113]]), R.line, 1.3, 0.8); };
const strings = (P, R) => { P.stroke(curve([[CX - 5, 121], [CX - 5.5, 136], [CX - 4.5, 140]]), '#E8E6E0', 1.8); P.stroke(curve([[CX + 5, 121], [CX + 5.6, 134], [CX + 4.6, 138]]), '#E8E6E0', 1.8); };
const pocket = (P, R, main) => { P.shape(blob([[CX - 18, 168], [CX + 18, 168], [CX + 22, 192], [CX - 22, 192]]), dk(main, 0.05), { line: R.line, w: 1.4 }); P.stroke(curve([[CX, 168.5], [CX, 191.5]]), R.line, 1.2, 0.7); };
const hem = (P, B, grow, y, R) => { const w = B.hp + B.be * 0.3 + grow + 0.4; P.fill(poly([[CX - w, y - 6], [CX + w, y - 6], [CX + w + 0.3, y], [CX - w - 0.3, y]]), R.sh); P.stroke(curve([[CX - w, y - 6], [CX + w, y - 6]]), R.line, 1.1, 0.7); };
const hoodie = (x = {}) => top({ sleeve: 'long', grow: 5, hem: 205, neck: 'crew', rib: false, sgrow: 6, collar: (P, c, R, main) => { hood(P, c, R); strings(P, R); }, detail: (P, c, R, d, main) => { pocket(P, R, main); hem(P, c.B, 5, 205, R); if (x.detail) x.detail(P, c, R, d, main); }, ...x.o });
const digits = (P, n, x, y, s, fill, line) => { P.add(`<text x="${x}" y="${y}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${s}" text-anchor="middle" fill="${fill}" stroke="${line}" stroke-width="1.6" paint-order="stroke">${n}</text>`); };

// the team's city across the chest, squeezed to fit when the name is long
const cityText = (P, c, y, size, maxW, fill, line, lw = 1.4) => {
  const t = c.pal.city || 'HOME', est = t.length * size * 0.74, fit = est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
  P.add(`<text x="${CX}" y="${y}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}"${line ? ` stroke="${line}" stroke-width="${lw}" paint-order="stroke"` : ''} letter-spacing="0.4"${fit}>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
};
const tout = (c) => c.pal.tout || c.pal.t2;
const ini = (c) => (c.pal.city || 'H').replace(/[^A-Z]/g, '').charAt(0) || 'H';
ART.top.tee = top({ def: '#64748B', sleeve: 'short' });
ART.top.tank = top({ def: '#1F2937', sleeve: 'none', shape: 'tank', neck: 'none', grow: 1.5 });
ART.top.boxy = top({ def: '#E9E4D8', sleeve: 'elbow', grow: 7, sgrow: 8, hem: 206, detail: (P, c, R) => { P.stroke(curve([[CX - 30, 160], [CX - 26, 190]]), R.sh, 1.4, 0.8); P.stroke(curve([[CX + 32, 150], [CX + 30, 196]]), R.deep, 1.4, 0.8); } });
ART.top.graphic = top({ def: '#1C1C22', sleeve: 'short', detail: (P, c, R) => {
  P.ell(CX, 152, 13, 13, '#C8432E', { line: '#2A0E0A', w: 1.4 });
  P.stroke(curve([[CX - 20, 168], [CX, 162], [CX + 20, 168]]), '#F1E9D8', 2.6); P.stroke(curve([[CX - 16, 174], [CX + 16, 174]]), '#9AA0A6', 2);
  P.stroke(curve([[CX - 8, 146], [CX + 8, 158]]), '#F1E9D8', 2.2); P.stroke(curve([[CX + 8, 146], [CX - 8, 158]]), '#F1E9D8', 2.2);
} });
ART.top.washed = hoodie({ o: { def: '#3A3D44' }, detail: (P, c, R) => { P.stroke(curve([[CX - 24, 140], [CX - 18, 160]]), lt(R.base, 0.12), 2.2, 0.6); P.stroke(curve([[CX + 14, 132], [CX + 20, 150]]), lt(R.base, 0.1), 2, 0.5); } });
ART.top.dressshirt = top({
  def: '#F2F1EC', sleeve: 'long', neck: 'v', rib: false, grow: 3.5,
  collar: (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 3), 108], [CX + s * 2, 121], [CX + s * 6, 128], [CX + s * (nk + 6), 115]]), lt(main, 0.04), { line: R.line, w: 1.4 })); },
  detail: (P, c, R) => { P.stroke(curve([[CX, 128], [CX, 205]]), R.line, 1.1, 0.6); [140, 156, 172, 188].forEach((y) => P.dot(CX + 2.6, y, 1.3, dk(R.base, 0.18))); },
});
ART.top.turtleneck = top({
  def: '#1C1C21', sleeve: 'long', neck: 'none',
  collar: (P, c, R) => { const nk = c.B.nk; P.part(blob([[CX - nk - 2, 98], [CX + nk + 2, 98], [CX + nk + 5, 118], [CX, 121], [CX - nk - 5, 118]]), R, { shade: [[poly([[CX + nk * 0.3, 90], [CX + 30, 90], [CX + 30, 130], [CX + nk * 0.3, 130]]), R.sh]] }); [104, 109, 114].forEach((y) => P.stroke(curve([[CX - nk, y], [CX, y + 1.5], [CX + nk, y]]), R.deep, 1.1, 0.8)); },
});
ART.top.foghoodie = hoodie({ o: { def: '#8E9196' }, detail: (P, c, R) => { P.shape(poly([[CX - 15, 140], [CX + 15, 140], [CX + 15, 146], [CX - 15, 146]]), lt(R.base, 0.18), { line: R.line, w: 1 }); } });
ART.top.techhood = top({
  def: '#2A2D33', sleeve: 'long', grow: 3.5, neck: 'crew', rib: false,
  collar: (P, c, R) => hood(P, c, R),
  detail: (P, c, R) => { P.stroke(curve([[CX - 2, 120], [CX - 1, 205]]), INK, 2); P.dot(CX - 2, 124, 1.8, SILVER); P.stroke(curve([[CX + 14, 150], [CX + 26, 146]]), INK, 1.8); P.stroke(curve([[CX - 26, 172], [CX - 26, 196]]), dk(R.base, 0.25), 1.6); hem(P, c.B, 3.5, 203, R); },
});
ART.top.sixhood = hoodie({ o: { def: '#141418' }, detail: (P) => { P.shape(blob([[CX - 13, 136], [CX + 13, 136], [CX + 13, 152], [CX, 162], [CX - 13, 152]]), GOLD, { line: GOLD2, w: 1.4 }); P.shape(blob([[CX - 8, 141], [CX + 8, 141], [CX + 8, 151], [CX, 157], [CX - 8, 151]]), '#141418', { line: GOLD2, w: 1 }); P.dot(CX, 148, 2.6, GOLD); } });
const jerseyTrim = (P, g, side, yEnd, c) => { const J = cutF(g.armJ(side), 0, yEnd, 4 * (c.B.arm * 0.5 + 0.5)); const [x, y, w] = J[J.length - 1]; P.stroke(curve([[x - w / 2, y - 3], [x + w / 2, y - 3]]), c.pal.t2, 3.2); };
ART.top.jersey = top({
  main: (p) => p.t1, sleeve: 'short', neck: 'v', grow: 4, ribCol: (p) => p.t2, sleeveCol: (p) => p.t2, trim: (P, g, side, yEnd, c) => { const J = cutF(g.armJ(side), 0, yEnd, 4 * (c.B.arm * 0.5 + 0.5)); const [x, y, w] = J[J.length - 1]; P.stroke(curve([[x - w / 2, y - 3.5], [x + w / 2, y - 3.5]]), c.pal.tacc, 2.6); },
  detail: (P, c, R) => { cityText(P, c, 146, 9, 44, c.pal.tink, tout(c), 1.2); digits(P, '7', CX, 180, 32, c.pal.tink, tout(c)); const B = c.B; both((s) => P.stroke(curve([[CX + s * (B.ch + 3), 140], [CX + s * (B.wa + B.be + 4), 200]]), c.pal.t2, 3)); },
});
ART.top.swingman = top({
  main: (p) => p.t1, sleeve: 'none', shape: 'tank', neck: 'none', grow: 2,
  detail: (P, c, R, d) => {
    const B = c.B;
    P.clip(d, [-1, 1].map((sd) => `<path d="${poly([[CX + sd * (B.ch - 5), 136], [CX + sd * (B.ch + 20), 136], [CX + sd * (B.hp + B.be + 20), 210], [CX + sd * (B.wa + B.be - 3), 210]])}" fill="${c.pal.t2}"/>`).join(''));
    both((sd) => P.stroke(curve([[CX + sd * (B.ch - 5), 136], [CX + sd * (B.wa + B.be - 3), 205]]), c.pal.tacc, 1.6));
    cityText(P, c, 146, 9, 40, c.pal.tink, tout(c), 1.2); digits(P, '8', CX, 179, 32, c.pal.tink, tout(c));
  },
  collar: (P, c) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 2, 112], [CX - nk + 2, 122], [CX, 127], [CX + nk - 2, 122], [CX + nk + 2, 112]]), c.pal.t2, 3); P.stroke(curve([[CX - nk + 0.5, 114], [CX - nk + 3.5, 121], [CX, 124.5], [CX + nk - 3.5, 121], [CX + nk - 0.5, 114]]), c.pal.tacc, 1.2); },
});
ART.top.polo = top({
  main: (p) => p.t1, sleeve: 'short', neck: 'v', rib: false,
  collar: (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 3), 108], [CX + s * 1, 120], [CX + s * 5, 127], [CX + s * (nk + 7), 117]]), lt(main, 0.1), { line: R.line, w: 1.4 })); [126, 133].forEach((y) => P.dot(CX + 1.5, y, 1.3, lt(main, 0.3))); },
  detail: (P, c) => { P.ell(CX - 18, 140, 3.6, 3.6, c.pal.t2); },
  trim: (P, g, side, yEnd, c) => jerseyTrim(P, g, side, yEnd, c),
});
ART.top.hoodie = hoodie({ o: { main: (p) => p.t1, cuffCol: (p) => p.t2 }, detail: (P, c) => { P.shape(blob([[CX - 18, 172], [CX + 18, 172], [CX + 22, 194], [CX - 22, 194]]), c.pal.t2, { line: INK, w: 1.4 }); cityText(P, c, 157, 12, 50, c.pal.tink, tout(c), 1.6); P.stroke(curve([[CX - 22, 162], [CX + 22, 162]]), c.pal.t2, 2); } });
ART.top.ghost = (P, g, col, ph, c) => {
  if (ph !== 'body') return;
  const R = ramp('#F4F2EC');
  const d = blob([[CX, 104], [CX + 30, 112], [CX + c.B.sh + 6, 136], [CX + c.B.sh + 12, 210], [CX + 40, 222], [CX + 22, 214], [CX + 6, 226], [CX - 10, 214], [CX - 26, 224], [CX - c.B.sh - 12, 210], [CX - c.B.sh - 6, 136], [CX - 30, 112]]);
  P.part(d, R, { shade: [[poly([[CX + 20, 90], [CX + 90, 90], [CX + 90, 240], [CX + 20, 240]]), R.sh]] });
  P.ell(CX - 12, 150, 4, 6, INK); P.ell(CX + 12, 150, 4, 6, INK); P.ell(CX, 172, 5, 3.4, INK);
};

/* ============================================================ JACKETS AND COATS */
const lapels = (wide = 1, col) => (P, c, R, main) => {
  const nk = c.B.nk, L = col ? ramp(col) : { ...R, base: dk(main, 0.06) };
  both((s) => P.shape(poly([[CX + s * (nk + 2), 110], [CX + s * (nk + 13 * wide), 116], [CX + s * (nk + 7 * wide), 132], [CX + s * (12 * wide), 140], [CX + s * 4, 160]]), L.base, { line: R.line, w: 1.4 }));
};
const shirtCollar = (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 2), 106], [CX + s * (nk + 11), 113], [CX + s * (nk + 6), 126], [CX + s * 3, 122]]), lt(main, 0.05), { line: R.line, w: 1.4 })); };
const ribCollar = (col) => (P, c, R, main) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 8, 116], [CX - nk - 2, 108], [CX + nk + 2, 108], [CX + nk + 8, 116]]), R.line, 6.4); P.stroke(curve([[CX - nk - 8, 116], [CX - nk - 2, 108], [CX + nk + 2, 108], [CX + nk + 8, 116]]), col ? col(c.pal, main) : dk(main, 0.15), 4.4); };
const buttons = (ys, x = CX + 7, colr = '#2A2A2A') => (P) => ys.forEach((y) => P.dot(x, y, 1.6, colr));
const zip = (from = 112, to = 212, colr = SILVER) => (P) => { P.stroke(curve([[CX, from], [CX, to]]), INK, 2.4); P.stroke(curve([[CX, from], [CX, to]]), colr, 1); P.dot(CX, from + 6, 2, colr); };
const flannelLines = (P, c, R, main, B, grow, hemY) => { for (let x = CX - 46; x <= CX + 46; x += 9) P.stroke(curve([[x, 110], [x, hemY]]), dk(main, 0.2), 1.4, 0.55); for (let y = 122; y < hemY; y += 10) P.stroke(curve([[CX - 50, y], [CX + 50, y]]), dk(main, 0.2), 1.4, 0.55); };
const pockets2 = (P, R, y = 178) => both((s) => P.stroke(curve([[CX + s * 12, y], [CX + s * 26, y - 1]]), R.line, 1.4, 0.8));

ART.outer.denim = outer({ def: '#4F78B5', len: 212, collar: shirtCollar, detail: (P, c, R) => { both((s) => { P.stroke(curve([[CX + s * 10, 140], [CX + s * 28, 138]]), lt(R.base, 0.18), 1.4); P.shape(poly([[CX + s * 12, 142], [CX + s * 26, 141], [CX + s * 25, 154], [CX + s * 13, 154]]), R.base, { line: R.line, w: 1.2 }); }); buttons([146, 168, 190], CX + 6, '#C9A45A')(P); } });
ART.outer.flannel = outer({ def: '#9B2C2C', len: 216, collar: shirtCollar, detail: (P, c, R, d, main, B, grow, hemY) => { P.clip(torsoD(B, grow, hemY, 2), `<g>${(() => { const PP = { out: [], stroke(dd, colr, w, op) { this.out.push(`<path d="${dd}" fill="none" stroke="${colr}" stroke-width="${w}" opacity="${op}"/>`); } }; flannelLines(PP, c, R, main, B, grow, hemY); return PP.out.join(''); })()}</g>`); buttons([150, 172, 194])(P); } });
ART.outer.bomber = outer({ def: '#4E5A3F', len: 206, collar: ribCollar(), cuff: (p, m) => dk(m, 0.15), detail: (P, c, R, d, main, B, grow) => { hem(P, B, grow, 206, R); both((s) => P.stroke(curve([[CX + s * 30, 138], [CX + s * 34, 130]]), R.line, 1.3)); P.dot(CX - 34, 140, 2.2, '#C8432E'); } });
ART.outer.leather = outer({ def: '#17171F', len: 208, collar: lapels(1.1, '#22222C'), detail: (P, c, R) => { P.stroke(curve([[CX + 4, 160], [CX + 30, 200]]), SILVER, 1.6); P.stroke(curve([[CX - 22, 176], [CX - 12, 186]]), SILVER, 1.4); P.stroke(curve([[CX - 30, 128], [CX - 18, 126]]), lt(R.base, 0.25), 2, 0.6); } });
ART.outer.puffer = outer({ def: '#2A3142', len: 212, grow: 11, sgrow: 10, closed: true, collar: ribCollar(), detail: (P, c, R, d, main, B, grow, hemY) => { P.clip(d, [130, 150, 170, 190].map((y) => `<path d="${curve([[CX - 70, y], [CX, y + 3], [CX + 70, y]])}" fill="none" stroke="${R.line}" stroke-width="1.6" opacity="0.7"/><path d="${curve([[CX - 70, y - 9], [CX, y - 7], [CX + 70, y - 9]])}" fill="none" stroke="${R.hi}" stroke-width="3" opacity="0.6"/>`).join('')); zip(110, hemY)(P); } });
ART.outer.parka = outer({ def: '#4F5A3A', len: 236, grow: 9, sgrow: 8, closed: true, collar: (P, c, R) => { const nk = c.B.nk; P.shape(blob([[CX - nk - 16, 118], [CX - nk - 6, 102], [CX + nk + 6, 102], [CX + nk + 16, 118], [CX + nk + 6, 126], [CX - nk - 6, 126]]), '#D9CBB0', { line: '#8C7B5E' }); [-10, -4, 2, 8].forEach((x) => P.stroke(curve([[CX + x, 104], [CX + x + 2, 114]]), '#B8A888', 1.2)); }, detail: (P, c, R, d, main, B, grow, hemY) => { zip(126, hemY)(P); both((s) => P.shape(poly([[CX + s * 12, 186], [CX + s * 32, 186], [CX + s * 33, 204], [CX + s * 13, 204]]), R.base, { line: R.line, w: 1.3 })); } });
ART.outer.blazer = outer({ def: '#3A3E46', len: 218, collar: lapels(1), detail: (P, c, R) => { buttons([178, 194], CX + 3.5, INK)(P); pockets2(P, R, 196); P.stroke(curve([[CX - 26, 148], [CX - 16, 147]]), R.line, 1.2, 0.8); } });
ART.outer.suit = outer({ def: '#1E2B47', len: 218, collar: lapels(1.05), detail: (P, c, R) => { buttons([180, 196], CX + 3.5, INK)(P); pockets2(P, R, 198); P.shape(poly([[CX - 28, 146], [CX - 18, 145], [CX - 19, 149], [CX - 28, 150]]), '#F2F1EC', { line: R.line, w: 1 }); } });
ART.outer.tux = outer({ def: '#121216', len: 218, collar: lapels(1.1, '#26262E'), detail: (P, c, R) => { buttons([186], CX + 3, '#3A3A44')(P); pockets2(P, R, 198); } });
ART.outer.overcoat = outer({ def: '#B98B58', len: 262, grow: 8, collar: lapels(1.25), detail: (P, c, R) => { buttons([166, 192, 218], CX + 5, dk(R.base, 0.4))(P); pockets2(P, R, 224); } });
ART.outer.nocturne = outer({ def: '#121216', len: 256, grow: 8, collar: lapels(1.3, '#1E1E26'), detail: (P, c, R) => { P.stroke(curve([[CX - 44, 200], [CX + 44, 200]]), '#2A2A34', 4); P.fill(poly([[CX - 5, 197], [CX + 5, 197], [CX + 5, 203], [CX - 5, 203]]), SILVER); P.stroke(curve([[CX - 34, 130], [CX - 26, 128]]), '#3A3A48', 2, 0.8); } });
ART.outer.track = outer({ main: (p) => p.t1, sleeveCol: (p) => p.t2, len: 208, closed: true, stripe: (p) => p.tink, collar: (P, c, R) => { const nk = c.B.nk; P.shape(poly([[CX - nk - 4, 102], [CX + nk + 4, 102], [CX + nk + 6, 116], [CX - nk - 6, 116]]), R.base, { line: R.line }); }, detail: (P, c, R, d, main, B, grow, hemY) => { zip(102, hemY)(P); hem(P, B, grow, hemY, ramp(dk(main, 0.1))); } });
ART.outer.varsity = outer({ main: (p) => p.t1, sleeveCol: (p) => p.t2, len: 208, collar: ribCollar((p) => p.t2), cuff: (p) => p.t1, detail: (P, c, R, d, main, B, grow) => { hem(P, B, grow, 208, ramp(c.pal.t2)); buttons([140, 156, 172, 188], CX + 6, '#F1EDE3')(P); P.add(`<text x="${CX - 22}" y="160" font-family="Georgia, serif" font-weight="700" font-size="22" text-anchor="middle" fill="${c.pal.tink}" stroke="${tout(c)}" stroke-width="1.6" paint-order="stroke">${ini(c)}</text>`); } });
ART.outer.silkbomber = outer({ def: '#1D2B4A', len: 206, collar: ribCollar(() => '#141418'), cuff: () => '#141418', detail: (P, c, R, d, main, B, grow) => { hem(P, B, grow, 206, ramp('#141418')); P.stroke(curve([[CX - 34, 150], [CX - 26, 140], [CX - 18, 152], [CX - 24, 162]]), GOLD, 1.6); P.stroke(curve([[CX + 18, 168], [CX + 28, 160], [CX + 34, 172]]), GOLD, 1.6); P.dot(CX - 26, 150, 2.2, '#C8432E'); } });
ART.outer.northgate = outer({ def: '#1B1C22', len: 216, grow: 12, sgrow: 11, closed: true, collar: ribCollar(), detail: (P, c, R, d, main, B, grow, hemY) => { P.clip(d, [128, 148, 168, 188, 206].map((y) => `<path d="${curve([[CX - 70, y], [CX, y + 3], [CX + 70, y]])}" fill="none" stroke="${R.line}" stroke-width="1.6" opacity="0.8"/><path d="${curve([[CX - 70, y - 10], [CX, y - 8], [CX + 70, y - 10]])}" fill="none" stroke="${R.hi}" stroke-width="3" opacity="0.6"/>`).join('')); zip(108, hemY)(P); P.fill(blob([[CX - 32, 136], [CX - 20, 136], [CX - 20, 142], [CX - 32, 142]]), '#E8E6E0'); } });
ART.outer.robe = outer({ def: '#6B1E2A', len: 290, grow: 10, sgrow: 10, collar: lapels(1.3, GOLD), cuff: () => GOLD, detail: (P, c, R) => { P.stroke(curve([[CX - 40, 196], [CX, 200], [CX + 40, 196]]), GOLD, 4); P.add(`<text x="${CX + 22}" y="160" font-family="Georgia, serif" font-weight="700" font-size="14" text-anchor="middle" fill="${GOLD}">1</text>`); } });
ART.outer.sixvarsity = outer({ def: '#141418', sleeveCol: () => '#F1EDE3', len: 208, collar: ribCollar(() => GOLD), cuff: () => GOLD, detail: (P, c, R, d, main, B, grow) => { hem(P, B, grow, 208, ramp(GOLD)); buttons([140, 156, 172, 188], CX + 6, GOLD)(P); P.shape(blob([[CX - 30, 140], [CX - 14, 140], [CX - 14, 154], [CX - 22, 162], [CX - 30, 154]]), GOLD, { line: GOLD2, w: 1.2 }); } });

/* ============================================================ NECKWEAR AND CHAINS */
ART.scarf.tie = (P, g, col, ph, c) => {
  if (ph !== 'neck') return;
  const m = col || '#6B1E2A', R = ramp(m);
  P.shape(poly([[CX - 4, 117], [CX + 4, 117], [CX + 3, 124], [CX - 3, 124]]), R.base, { line: R.line, w: 1.3 });
  P.part(poly([[CX - 3.2, 124], [CX + 3.2, 124], [CX + 6.5, 178], [CX, 188], [CX - 6.5, 178]]), R, { shade: [[poly([[CX + 1, 120], [CX + 10, 120], [CX + 10, 190], [CX + 1, 190]]), R.sh]], w: 1.3 });
  [140, 156, 170].forEach((y) => P.stroke(curve([[CX - 4, y + 4], [CX + 4, y - 2]]), lt(m, 0.15), 1.4, 0.8));
};
ART.scarf.bowtie = (P, g, col, ph, c) => {
  if (ph !== 'neck') return;
  const R = ramp('#121216');
  both((s) => P.shape(poly([[CX, 119], [CX + s * 11, 113], [CX + s * 12, 126], [CX, 121]]), R.base, { line: '#000', w: 1.3 }));
  P.shape(blob([[CX - 3, 116.5], [CX + 3, 116.5], [CX + 3, 123.5], [CX - 3, 123.5]]), '#2A2A34', { line: '#000', w: 1.2 });
};
const wrapScarf = (a, b, pattern) => (P, g, col, ph, c) => {
  if (ph !== 'neck') return;
  const nk = c.B.nk, R = ramp(a);
  P.part(blob([[CX - nk - 9, 112], [CX - nk - 2, 104], [CX + nk + 2, 104], [CX + nk + 9, 112], [CX + nk + 4, 124], [CX, 127], [CX - nk - 4, 124]]), R, { shade: [[poly([[CX + 4, 90], [CX + 40, 90], [CX + 40, 140], [CX + 4, 140]]), R.sh]] });
  P.part(poly([[CX + 6, 118], [CX + 18, 118], [CX + 21, 188], [CX + 9, 190]]), R, { shade: [[poly([[CX + 15, 110], [CX + 30, 110], [CX + 30, 200], [CX + 15, 200]]), R.sh]] });
  if (b) { [150, 170].forEach((y) => P.stroke(curve([[CX + 7.5, y], [CX + 19, y]]), b, 3.4)); P.stroke(curve([[CX - nk - 6, 116], [CX + nk + 6, 116]]), b, 2.6); }
  for (let x = CX + 10; x <= CX + 20; x += 3) P.stroke(curve([[x, 190], [x, 195]]), R.base, 1.6);
  if (pattern) pattern(P, c);
};
ART.scarf.scarf = (P, g, col, ph, c) => wrapScarf(c.pal.t1, c.pal.t2)(P, g, col, ph, c);
ART.scarf.goldscarf = wrapScarf(GOLD, GOLDHI);
ART.scarf.monoscarf = wrapScarf('#6B4A2E', null, (P) => [[CX + 12, 132], [CX + 16, 146], [CX + 12, 160], [CX + 16, 174], [CX - 6, 112], [CX + 6, 114]].forEach(([x, y]) => P.dot(x, y, 1.6, '#D8B66A')));
function chain(P, c, colr, hi, o = {}) {
  const nk = c.B.nk, d = curve([[CX - nk - 5, 112], [CX - nk * 0.8, o.drop ? 140 : 128], [CX, o.drop || 134], [CX + nk * 0.8, o.drop ? 140 : 128], [CX + nk + 5, 112]]);
  P.stroke(d, '#1A1410', (o.w ?? 2.4) + 1.6); P.stroke(d, colr, o.w ?? 2.4);
  if (hi) P.add(`<path d="${d}" fill="none" stroke="${hi}" stroke-width="${(o.w ?? 2.4) * 0.5}" stroke-dasharray="1.6 2.6" stroke-linecap="round"/>`);
  return d;
}
ART.chain.silver = (P, g, col, ph, c) => { if (ph === 'neck') chain(P, c, SILVER, '#FFFFFF', { w: 1.8 }); };
ART.chain.gold = (P, g, col, ph, c) => { if (ph === 'neck') chain(P, c, GOLD, GOLDHI, { w: 2.4 }); };
ART.chain.cuban = (P, g, col, ph, c) => { if (ph === 'neck') chain(P, c, GOLD, GOLDHI, { w: 3.6 }); };
ART.chain.tennis = (P, g, col, ph, c) => { if (ph === 'neck') chain(P, c, '#E8F2FF', '#FFFFFF', { w: 2.4 }); };
ART.chain.diamond = (P, g, col, ph, c) => { if (ph !== 'neck') return; chain(P, c, GOLD, '#FFFFFF', { w: 3.8, drop: 138 }); P.shape(poly([[CX, 138], [CX + 7, 146], [CX, 156], [CX - 7, 146]]), '#DDF1FF', { line: '#5A7A9A', w: 1.3 }); P.stroke(curve([[CX - 3, 143], [CX, 141]]), '#FFFFFF', 1.4); };
ART.chain.pendant = (P, g, col, ph, c) => { if (ph !== 'neck') return; chain(P, c, SILVER, null, { w: 1.6, drop: 140 }); P.ell(CX, 146, 7, 7, c.pal.t1, { line: SILVER2, w: 1.6 }); P.ell(CX, 146, 3, 3, c.pal.tacc); };

/* ============================================================ WRIST AND HAND */
const onWrist = (P, g, c, strap, face, ring) => {
  const [x, y, w] = g.watch(-1);
  const a = c.B.arm;
  P.add(`<g transform="rotate(${g.watchTurn(-1).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">`);
  P.shape(blob([[x - w / 2 - 0.2, y - 4], [x + w / 2 + 0.2, y - 4], [x + w / 2 + 0.2, y + 2.5], [x - w / 2 - 0.2, y + 2.5]]), strap, { line: '#121212', w: 1.3 });
  if (face) { P.ell(x - 1, y - 0.8, 4.6 * a, 4.6, face, { line: ring || '#121212', w: 1.6 }); P.stroke(curve([[x - 1, y - 0.8], [x - 1, y - 3.4]]), ring || '#FFFFFF', 0.9); }
  P.add('</g>');
};
ART.wrist.watch = (P, g, col, ph, c) => { if (ph === 'wrist') onWrist(P, g, c, '#1E1F23', '#3A6FB8', '#9CC7FF'); };
ART.wrist.dresswatch = (P, g, col, ph, c) => { if (ph === 'wrist') onWrist(P, g, c, '#3B2414', '#EDEBE5', GOLD); };
ART.wrist.royalwatch = (P, g, col, ph, c) => { if (ph === 'wrist') onWrist(P, g, c, GOLD, '#123C7A', GOLD2); };
ART.wrist.goldwatch = (P, g, col, ph, c) => { if (ph === 'wrist') { onWrist(P, g, c, GOLD, '#F4F7FF', '#FFFFFF'); const [x, y] = g.watch(-1); [[-4, -4], [3, -5], [4, 1], [-5, 1]].forEach(([dx, dy]) => P.dot(x + dx, y + dy, 0.9, '#FFFFFF')); } };
ART.wrist.band = (P, g, col, ph, c) => { if (ph !== 'wrist') return; const [x, y, w] = g.watch(-1); P.add(`<g transform="rotate(${g.watchTurn(-1).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">`); P.shape(blob([[x - w / 2 - 1.5, y - 6], [x + w / 2 + 1.5, y - 6], [x + w / 2 + 1.5, y + 2], [x - w / 2 - 1.5, y + 2]]), c.pal.t1, { line: dk(c.pal.t1, 0.4), w: 1.4 }); P.stroke(curve([[x - w / 2, y - 2], [x + w / 2, y - 2]]), c.pal.t2, 1.8); P.add('</g>'); };
const rightHand = (g) => { const [x, y] = g.wrist(1); return [x, y]; };
/** draw a held item bigger, scaled about the hand */
const held = (k, f) => (P, g, col, ph, c) => { if (ph !== 'hand') return; const [x, y] = rightHand(g); P.add(`<g transform="translate(${x} ${y + 10}) scale(${k}) translate(${-x} ${-(y + 10)})">`); f(P, g, col, ph, c); P.add('</g>'); };
ART.hand.ball = held(1.35, (P, g, col, ph) => { if (ph !== 'hand') return; const [x, y] = rightHand(g); const cx = x + 4, cy = y + 30, r = 15; P.ell(cx, cy, r, r, '#D9822B', { line: '#5A2A08', w: OW }); P.stroke(curve([[cx - r, cy], [cx + r, cy]]), '#5A2A08', 1.4); P.stroke(curve([[cx, cy - r], [cx, cy + r]]), '#5A2A08', 1.4); P.stroke(curve([[cx - 10, cy - 11], [cx - 4, cy], [cx - 10, cy + 11]]), '#5A2A08', 1.3); P.stroke(curve([[cx + 10, cy - 11], [cx + 4, cy], [cx + 10, cy + 11]]), '#5A2A08', 1.3); P.stroke(curve([[cx - 8, cy - 10], [cx - 2, cy - 13]]), '#F2B067', 2, 0.8); });
ART.hand.finger = held(1.7, (P, g, col, ph, c) => { if (ph !== 'hand') return; const [x, y] = rightHand(g); const R = ramp(c.pal.t1); P.part(blob([[x - 9, y - 2], [x + 9, y - 2], [x + 10, y + 20], [x - 10, y + 20]]), R, { shade: [[poly([[x + 3, y - 10], [x + 20, y - 10], [x + 20, y + 30], [x + 3, y + 30]]), R.sh]] }); P.part(blob([[x - 3.5, y - 34], [x + 3.5, y - 34], [x + 4, y], [x - 4, y]]), R, {}); P.stroke(curve([[x - 7, y + 10], [x + 7, y + 10]]), c.pal.t2, 2.4); });
ART.hand.pennant = held(1.6, (P, g, col, ph, c) => { if (ph !== 'hand') return; const [x, y] = rightHand(g); P.stroke(curve([[x, y - 46], [x + 1, y + 22]]), '#5A3E22', 3.2); const R = ramp(c.pal.t1); P.part(poly([[x + 1.5, y - 46], [x + 42, y - 36], [x + 1.5, y - 24]]), R, {}); P.stroke(curve([[x + 6, y - 35], [x + 30, y - 35.5]]), c.pal.t2, 2.4); });
ART.hand.trophy = held(1.8, (P, g, col, ph) => { if (ph !== 'hand') return; const [x, y] = rightHand(g); const R = ramp(GOLD); P.part(blob([[x - 12, y - 30], [x + 12, y - 30], [x + 10, y - 16], [x + 3, y - 8], [x - 3, y - 8], [x - 10, y - 16]]), R, { shade: [[poly([[x + 3, y - 40], [x + 20, y - 40], [x + 20, y], [x + 3, y]]), R.sh]] }); both((s) => P.stroke(curve([[x + s * 11, y - 27], [x + s * 17, y - 24], [x + s * 10, y - 17]]), GOLD2, 2)); P.shape(poly([[x - 3, y - 8], [x + 3, y - 8], [x + 4, y + 2], [x - 4, y + 2]]), GOLD2, { line: '#5A3E08', w: 1.2 }); P.shape(poly([[x - 8, y + 2], [x + 8, y + 2], [x + 8, y + 7], [x - 8, y + 7]]), '#3A2A18', { line: '#1A1208', w: 1.2 }); P.stroke(curve([[x - 7, y - 26], [x - 4, y - 17]]), GOLDHI, 2); });
ART.hand.duffel = held(1.5, (P, g, col, ph) => { if (ph !== 'hand') return; const [x, y] = rightHand(g); P.stroke(curve([[x - 6, y + 6], [x, y - 2], [x + 6, y + 6]]), '#3B2A1A', 2.6); const R = ramp('#6B4A2E'); P.part(blob([[x - 20, y + 8], [x + 20, y + 8], [x + 24, y + 26], [x + 18, y + 34], [x - 18, y + 34], [x - 24, y + 26]]), R, { shade: [[poly([[x + 6, y], [x + 30, y], [x + 30, y + 40], [x + 6, y + 40]]), R.sh]] }); [[x - 12, y + 16], [x, y + 14], [x + 12, y + 16], [x - 8, y + 26], [x + 6, y + 26]].forEach(([a, b]) => P.dot(a, b, 1.6, '#D8B66A')); P.stroke(curve([[x - 22, y + 18], [x + 22, y + 18]]), '#3B2A1A', 1.4, 0.8); });

/* ============================================================ BACK */
ART.back.backpack = (P, g, col, ph, c) => {
  const B = c.B, R = ramp(c.pal.t1);
  if (ph === 'back') both((s) => P.part(blob([[CX + s * (B.ch + 4), 124], [CX + s * (B.sh + 4), 136], [CX + s * (B.sh + 6), 196], [CX + s * (B.ch + 6), 204]]), R, { shade: s > 0 ? [[poly([[CX, 100], [CX + 100, 100], [CX + 100, 220], [CX, 220]]), R.sh]] : [] }));
  if (ph === 'neck') both((s) => { const d = curve([[CX + s * (B.nk + 9), 113], [CX + s * (B.ch - 4), 140], [CX + s * (B.ch - 2), 176]]); P.stroke(d, R.line, 6.4); P.stroke(d, c.pal.t2, 4.2); });
};
const capeShape = (P, c, colr, trim) => {
  const B = c.B, R = ramp(colr);
  P.part(blob([[CX - B.sh + 6, 116], [CX + B.sh - 6, 116], [CX + B.sh + 22, 250], [CX + B.sh + 26, 312], [CX, 318], [CX - B.sh - 26, 312], [CX - B.sh - 22, 250]]), R, { shade: [[poly([[CX + 20, 100], [CX + 120, 100], [CX + 120, 330], [CX + 30, 330]]), R.sh]] });
  if (trim) { P.stroke(curve([[CX - B.sh - 25, 306], [CX, 312], [CX + B.sh + 25, 306]]), trim, 6); both((sd) => P.stroke(curve([[CX + sd * (B.sh - 4), 120], [CX + sd * (B.sh + 19), 250], [CX + sd * (B.sh + 23), 304]]), trim, 4)); }
};
ART.back.cape = (P, g, col, ph, c) => { if (ph === 'back') capeShape(P, c, c.pal.t1, c.pal.t2); if (ph === 'neck') { P.ell(CX - c.B.nk - 8, 116, 4, 4, c.pal.tacc, { line: dk(c.pal.tacc, 0.4), w: 1.3 }); P.ell(CX + c.B.nk + 8, 116, 4, 4, c.pal.tacc, { line: dk(c.pal.tacc, 0.4), w: 1.3 }); } };
ART.back.trophycape = (P, g, col, ph, c) => { if (ph === 'back') capeShape(P, c, GOLD, GOLDHI); if (ph === 'neck') both((s) => P.ell(CX + s * (c.B.nk + 8), 116, 4, 4, '#FFFFFF', { line: GOLD2, w: 1.3 })); };
ART.back.wings = (P, g, col, ph) => {
  if (ph !== 'back') return;
  both((s) => {
    const X = (x) => CX + x * s;
    const d = blob([[X(16), 132], [X(48), 90], [X(88), 76], [X(98), 96], [X(92), 136], [X(78), 176], [X(56), 196], [X(36), 176]]);
    P.part(d, ramp('#F6F1E4'), { shade: [[poly([[X(40), 150], [X(100), 120], [X(100), 210], [X(40), 210]]), '#E4D8BC']] });
    [[X(56), 104, X(78), 128], [X(48), 124, X(70), 160], [X(40), 146, X(58), 180]].forEach(([a, b, cc, d2]) => P.stroke(curve([[a, b], [cc, d2]]), GOLD, 2));
  });
};

/* ============================================================ PANTS AND SHORTS */
const seam = (P, J, side, R) => { const p = J.map(([x, y, w]) => [x - side * w * 0.3, y]); P.stroke(curve(p), R.line, 1.1, 0.5); };
const knee = (P, J, side, R, y = 258) => { const j = J.find((q) => q[1] >= y) || J[J.length - 1]; P.stroke(curve([[j[0] - 6, y], [j[0], y + 2], [j[0] + 6, y]]), R.sh, 1.4, 0.9); };
const hemLine = (P, J, R) => { const [x, y, w] = J[J.length - 1]; P.stroke(curve([[x - w / 2, y - 4], [x + w / 2, y - 4]]), R.line, 1.2, 0.7); };
const drape = (P, J, side, R) => {
  const at = (y) => J.find((q) => q[1] >= y) || J[J.length - 1], top = J[0][1], bot = J[J.length - 1][1];
  // two long soft folds down the leg
  [[-0.18, R.sh], [0.24, R.hi]].forEach(([f, colr]) => { const pts = [top + 30, top + 60, bot - 18].map((y) => { const j = at(y); return [j[0] + side * j[2] * f + side * (y - top) * 0.01, y]; }); P.stroke(curve(pts), colr, 1.4, 0.55); });
  // fabric stacking over the shoe
  if (bot > 280) [bot - 22, bot - 13].forEach((y, k) => { const j = at(y), w = j[2] / 2 - 1.5; P.stroke(curve([[j[0] - w, y + 1], [j[0] - w * 0.35, y - 2.2], [j[0] + w * 0.25, y + 1.6], [j[0] + w, y - 1]]), k ? R.deep : R.sh, 1.4, 0.75); });
};
const cargoPocket = (P, J, side, R) => { const j = J.find((q) => q[1] >= 238) || J[J.length - 1]; const x = j[0] + side * j[2] * 0.22; P.shape(poly([[x - 7, j[1]], [x + 7, j[1]], [x + 7, j[1] + 16], [x - 7, j[1] + 16]]), R.base, { line: R.line, w: 1.3 }); P.stroke(curve([[x - 7, j[1] + 4], [x + 7, j[1] + 4]]), R.line, 1.1); };
const jeanDetail = (P, g, side, J, c, R) => { knee(P, J, side, R); hemLine(P, J, R); };
const shortsDetail = (P, g, side, J, c, R) => hemLine(P, J, R);
const stripe = (colFn, w = 3) => (P, g, side, J, c, R, main) => { const p = J.map(([x, y, ww]) => [x + side * (ww / 2 - Math.max(2.5, w / 2 + 1.2)), y]); P.stroke(curve(p), colFn(c.pal, main), w); hemLine(P, J, R); };
const pocketsJ = (P, c, R, main, w) => both((s) => P.stroke(curve([[CX + s * (w - 1), 198], [CX + s * (w - 10), 206]]), R.line, 1.3, 0.8));

ART.bottom.jeans = pants({ def: '#3A5A93', legDetail: jeanDetail, detail: pocketsJ, belt: null });
ART.bottom.joggers = pants({ def: '#46546A', grow: 4.5, legDetail: (P, g, side, J, c, R) => { knee(P, J, side, R); const [x, y, w] = J[J.length - 1]; P.fill(poly([[x - w / 2, y - 7], [x + w / 2, y - 7], [x + w / 2 - 1, y], [x - w / 2 + 1, y]]), R.sh); }, band: (p, m) => dk(m, 0.12), fly: false, detail: (P) => { P.stroke(curve([[CX - 3, 197], [CX - 4, 208]]), '#E8E6E0', 1.4); P.stroke(curve([[CX + 3, 197], [CX + 4, 208]]), '#E8E6E0', 1.4); } });
ART.bottom.shorts = pants({ one: true, def: '#6B8FC9', end: 250, grow: 6, legDetail: shortsDetail, detail: pocketsJ });
ART.bottom.cargo = pants({ def: '#9C8B63', grow: 5, legDetail: (P, g, side, J, c, R) => { cargoPocket(P, J, side, R); knee(P, J, side, R); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.baggy = pants({ def: '#4F6E9F', grow: 11, end: 310, bag: { hem: 1.1, out: 3 }, legDetail: (P, g, side, J, c, R) => { drape(P, J, side, R); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.jorts = pants({ one: true, def: '#4F6E9F', end: 262, grow: 11, bag: { hem: 1.08, out: 2 }, legDetail: shortsDetail, detail: pocketsJ });
ART.bottom.parachute = pants({ def: '#1E1F23', grow: 11, end: 309, bag: { hem: 1.06, out: 2.5 }, legDetail: (P, g, side, J, c, R) => { [232, 258, 286].forEach((y) => { const j = J.find((q) => q[1] >= y) || J[J.length - 1]; P.stroke(curve([[j[0] - j[2] / 2 + 2, y], [j[0] + 2, y + 4], [j[0] + j[2] / 2 - 2, y]]), R.hi, 1.6, 0.7); }); const [x, y, w] = J[J.length - 1]; P.fill(poly([[x - w / 2, y - 6], [x + w / 2, y - 6], [x + w / 2 - 2, y], [x - w / 2 + 2, y]]), R.sh); }, fly: false });
ART.bottom.bagcargo = pants({ def: '#58613F', grow: 11, end: 310, bag: { hem: 1.1, out: 3 }, legDetail: (P, g, side, J, c, R) => { drape(P, J, side, R); cargoPocket(P, J, side, R); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.carpenter = pants({ def: '#7A5A3A', grow: 7, straight: 0.9, legDetail: (P, g, side, J, c, R) => { const j = J.find((q) => q[1] >= 248); const k = J.find((q) => q[1] >= 272) || J[J.length - 1]; P.shape(poly([[j[0] - j[2] / 2 + 1.5, 248], [j[0] + j[2] / 2 - 1.5, 248], [k[0] + k[2] / 2 - 1.5, 272], [k[0] - k[2] / 2 + 1.5, 272]]), dk(R.base, 0.06), { line: R.line, w: 1.3 }); if (side > 0) P.stroke(curve([[J[1][0] + 8, 214], [J[1][0] + 9, 236]]), R.line, 2.2); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.flares = pants({ def: '#2E3138', grow: 3, flare: 14, legDetail: (P, g, side, J, c, R) => { knee(P, J, side, R); [292, 298].forEach((y) => { const j = J.find((q) => q[1] >= y) || J[J.length - 1]; P.stroke(curve([[j[0] - j[2] / 2 + 2, y], [j[0], y + 2], [j[0] + j[2] / 2 - 2, y]]), R.sh, 1.4); }); }, detail: pocketsJ });
ART.bottom.techp = pants({ def: '#22252C', grow: 3.5, legDetail: (P, g, side, J, c, R) => { knee(P, J, side, R); const j = J.find((q) => q[1] >= 230); P.stroke(curve([[j[0] - 5, 230], [j[0] + 5, 230]]), '#3A3E46', 2); }, fly: false });
ART.bottom.leatherp = pants({ def: '#16161C', grow: 3, legDetail: (P, g, side, J, c, R) => { P.stroke(curve(J.slice(1, 4).map(([x, y, w]) => [x - w * 0.2, y])), '#4A4A58', 2, 0.8); knee(P, J, side, R); }, detail: pocketsJ });
ART.bottom.slacks = pants({ def: '#6E737B', grow: 4, straight: 0.82, legDetail: (P, g, side, J, c, R) => { P.stroke(curve(J.map(([x, y]) => [x, y])), R.line, 1, 0.45); hemLine(P, J, R); }, belt: '#2A1E14' });
ART.bottom.suitp = pants({ def: '#1E2B47', grow: 4, straight: 0.82, legDetail: (P, g, side, J, c, R) => { P.stroke(curve(J.map(([x, y]) => [x, y])), R.line, 1, 0.45); hemLine(P, J, R); }, belt: '#141418' });
ART.bottom.tuxp = pants({ def: '#121216', grow: 4, straight: 0.82, legDetail: (P, g, side, J, c, R) => { P.stroke(curve(J.map(([x, y, w]) => [x + side * (w / 2 - 2), y])), '#2E2E38', 2.6); }, belt: '#26262E' });
ART.bottom.fogsweats = pants({ def: '#8E9196', grow: 5.5, legDetail: (P, g, side, J, c, R) => { knee(P, J, side, R); const [x, y, w] = J[J.length - 1]; P.fill(poly([[x - w / 2, y - 7], [x + w / 2, y - 7], [x + w / 2 - 1, y], [x - w / 2 + 1, y]]), R.sh); }, band: (p, m) => dk(m, 0.12), fly: false, detail: (P) => P.add(`<rect x="${CX + 12}" y="200" width="10" height="3" fill="#2A2A2E"/>`) });
ART.bottom.techjog = pants({ def: '#2A2D33', grow: 3.5, legDetail: (P, g, side, J, c, R) => { knee(P, J, side, R); const j = J.find((q) => q[1] >= 236); P.stroke(curve([[j[0] - 6, 236], [j[0] + 4, 232]]), '#16181C', 2); const [x, y, w] = J[J.length - 1]; P.fill(poly([[x - w / 2, y - 6], [x + w / 2, y - 6], [x + w / 2 - 1, y], [x - w / 2 + 1, y]]), R.sh); }, fly: false });
ART.bottom.goldpants = pants({ def: GOLD, main: () => GOLD, grow: 4, legDetail: (P, g, side, J, c, R) => { knee(P, J, side, R); P.stroke(curve(J.slice(0, 4).map(([x, y, w]) => [x - w * 0.25, y])), GOLDHI, 2, 0.8); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.tshorts = pants({ one: true, main: (p) => p.t1, end: 256, grow: 8, bag: { hem: 1.08, out: 2 }, legDetail: (P, g, side, J, c, R, main) => { stripe((p) => p.t2, 6)(P, g, side, J, c, R, main); const q = J.map(([x, y, ww]) => [x + side * (ww / 2 - 7.6), y]); P.stroke(curve(q), c.pal.tink, 1.2); }, fly: false, band: (p) => p.t2 });
ART.bottom.trackp = pants({ main: (p) => p.t2, grow: 4.5, legDetail: (P, g, side, J, c, R, main) => { stripe((p) => p.t1, 5)(P, g, side, J, c, R, main); const q = J.map(([x, y, ww]) => [x + side * (ww / 2 - 7.2), y]); P.stroke(curve(q), c.pal.tink, 1.1); }, fly: false, band: (p, m) => dk(m, 0.15) });
// a five-point star centred on x, y
const star = (x, y, r) => poly(Array.from({ length: 10 }, (_, i) => { const t = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; return [x + Math.cos(t) * rr, y + Math.sin(t) * rr]; }));
// retro mesh shorts: long and loose, past the knee, a wide side panel. o = { pipe, pin, stars }
const courtside = (a, b, o = {}) => pants({ one: true, main: (p, col) => col || a, end: 268, grow: 13, bag: { hem: 1.14, out: 3 }, fly: false, band: () => b,
  legDetail: (P, g, side, J, c, R, main) => {
    if (o.pin) { const pin = o.pin(main); for (let k = -3; k <= 2; k++) P.stroke(curve(J.map(([x, y, w]) => [x + (k + 0.5) * w / 7.5 - side * 3, y])), pin, 0.9, 0.85); }
    P.stroke(curve(J.map(([x, y, w]) => [x + side * (w / 2 - 4), y])), b, 7);
    if (o.pipe) P.stroke(curve(J.map(([x, y, w]) => [x + side * (w / 2 - 8.2), y])), o.pipe, 1.3);
    if (o.stars) [0.3, 0.55, 0.8].forEach((t) => { const i = Math.min(J.length - 1, Math.round(t * (J.length - 1))); const [x, y, w] = J[i]; P.fill(star(x + side * (w / 2 - 4), y, 2.8), '#F4F1EA'); });
    hemLine(P, J, R);
  } });
// retro tank jerseys in fixed colours. o = { pin, stars, num }
const fv = (x, m) => (typeof x === 'function' ? x(m) : x);
const retroTank = (main, trim, ink0, inkLine, o = {}) => top({ main: (p, col) => col || main, sleeve: 'none', shape: 'tank', neck: 'none', grow: 2,
  detail: (P, c, R, d, m) => {
    const B = c.B, pin = o.pin ? o.pin(m) : null, ink = fv(ink0, m), stars = fv(o.stars, m);
    if (pin) P.clip(d, Array.from({ length: 17 }, (_, i) => `<path d="M${CX - 64 + i * 8} 100 L${CX - 64 + i * 8} 220" stroke="${pin}" stroke-width="1" opacity="0.85"/>`).join(''));
    P.clip(d, [-1, 1].map((sd) => `<path d="${poly([[CX + sd * (B.ch - 3), 136], [CX + sd * (B.ch + 20), 136], [CX + sd * (B.hp + B.be + 20), 210], [CX + sd * (B.wa + B.be - 1), 210]])}" fill="${trim}"/>`).join(''));
    if (stars) both((sd) => [150, 172, 194].forEach((y, k) => P.fill(star(CX + sd * (B.ch - 1 + k * 2.4), y, 2.6), stars)));
    if (stars) P.shape(star(CX, 141, 5), stars, { line: inkLine, w: 1.2 });
    digits(P, o.num || '9', CX, 181, 33, ink, inkLine);
  },
  collar: (P, c, R, m) => { const nk = c.B.nk, ink = fv(ink0, m); P.stroke(curve([[CX - nk - 2, 112], [CX - nk + 2, 122], [CX, 127], [CX + nk - 2, 122], [CX + nk + 2, 112]]), trim, 3.4); P.stroke(curve([[CX - nk + 0.5, 114], [CX - nk + 3.5, 121], [CX, 124.5], [CX + nk - 3.5, 121], [CX + nk - 0.5, 114]]), ink, 1.1); },
});
const pinFor = (m) => (rgbL(m) > 0.6 ? '#141418' : '#2E6FD0');
ART.bottom.cs_red = courtside('#B3202A', '#16161A');
ART.bottom.cs_purple = courtside('#552583', '#FDB927', { pipe: '#F4F1EA' });
ART.bottom.cs_stars = courtside('#141418', '#2E6FD0', { pin: pinFor, pipe: '#F4F1EA', stars: '#F4F1EA' });
ART.top.rj_purple = retroTank('#552583', '#FDB927', '#FDB927', '#F4F1EA', { num: '9' });
const inkFor = (m) => (rgbL(m) > 0.6 ? '#141418' : '#F4F1EA');
ART.top.rj_stars = retroTank('#141418', '#2E6FD0', inkFor, '#2E6FD0', { pin: pinFor, stars: inkFor, num: '5' });
ART.bottom.cs_green = courtside('#0E7A3E', '#F2F1EC');
ART.bottom.cs_royal = courtside('#1D428A', '#F2F1EC');

/* ============================================================ SHOES */
const swoosh = (colr) => (P, c, R, main, ax, ay, side, tx) => P.stroke(curve([[tx - 9 * side, ay + 13], [tx + 2 * side, ay + 12], [tx + 11 * side, ay + 6]]), colr, 2.2);
ART.shoes.sneakers = shoes({ def: '#F8FAFC' });
ART.shoes.runners = shoes({ def: '#9AA0A6', sole: '#F4F2EC', soleH: 5.5, detail: swoosh('#E46A2E'), laceCol: '#2A2A2A' });
ART.shoes.slides = (P, g, col, ph, c) => {
  if (ph !== 'feet') return;
  const main = col || '#1F2937', R = ramp(main), sk = c.sk;
  both((side) => {
    const [ax, ay] = g.ankle(side), tx = ax + 3 * side;
    const foot = blob([[ax - 6, ay - 3], [ax + 6, ay - 3], [tx + 10, ay + 10], [tx + 9, ay + 17], [tx, ay + 18.5], [tx - 9, ay + 17], [tx - 10, ay + 10]]);
    P.shape(foot, sk.base, { line: sk.line });
    [[-5, 16.5], [-1.5, 17.6], [2, 17.6], [5.5, 16.5]].forEach(([dx, dy]) => P.stroke(curve([[tx + dx, ay + dy - 2.6], [tx + dx, ay + dy]]), sk.sh, 1.2));
    P.shape(poly([[tx - 13, ay + 18.5], [tx + 13, ay + 18.5], [tx + 13, ay + 22], [tx - 13, ay + 22]]), dk(main, 0.1), { line: R.line, w: 1.4 });
    P.part(blob([[tx - 11, ay + 2], [tx + 11, ay + 2], [tx + 12, ay + 10], [tx - 12, ay + 10]]), R, { shade: [[poly([[tx + 3, ay], [tx + 20, ay], [tx + 20, ay + 12], [tx + 3, ay + 12]]), R.sh]] });
  });
};
ART.shoes.boots = shoes({ def: '#7C4A21', h: 10, sole: '#3A2A1A', soleH: 5, laces: 4, laceCol: '#E8D8B0', wide: 1.08 });
ART.shoes.chunky = shoes({ def: '#EFEAE0', sole: '#F8F6F0', soleH: 8, wide: 1.1, detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx - 10 * side, ay + 10], [tx + 10 * side, ay + 4]]), '#9AA0A6', 2); P.stroke(curve([[tx - 8, ay + 15], [tx + 8, ay + 15]]), '#C9C3B4', 1.4); } });
ART.shoes.loafers = shoes({ def: '#4A2A18', sole: '#2A1A10', soleH: 3, h: -3, laces: false, detail: (P, c, R, m, ax, ay, side, tx) => P.stroke(curve([[tx - 6, ay + 6], [tx, ay + 8.5], [tx + 6, ay + 6]]), R.line, 1.4), shine: true });
ART.shoes.oxfords = shoes({ def: '#2A1A12', sole: '#1A100A', soleH: 3, h: -2, laces: 2, laceCol: '#4A3A2A', detail: (P, c, R, m, ax, ay, side, tx) => P.stroke(curve([[tx - 10, ay + 11], [tx, ay + 9], [tx + 10, ay + 11]]), R.line, 1.3), shine: true });
ART.shoes.patent = shoes({ def: '#0E0E12', sole: '#0A0A0C', soleH: 3, h: -2, laces: false, shine: true, detail: (P, c, R, m, ax, ay, side, tx) => P.stroke(curve([[tx + 2, ay + 4], [tx + 7, ay + 9]]), '#FFFFFF', 1.6, 0.7) });
const v85 = (a, b, s = '#F4F1EA') => shoes({ main: () => a, h: 8, sole: s, soleH: 5, inner: (c, R, main, ax, ay, side, tx) => `<path d="${blob([[tx - 13, ay + 6], [tx - 3, ay + 6], [tx - 2, ay + 17], [tx - 13, ay + 17]])}" fill="${b}"/><path d="${blob([[ax - 9, ay - 12], [ax + 9, ay - 12], [ax + 9, ay - 4], [ax - 9, ay - 4]])}" fill="${b}"/>`, detail: swoosh(b === '#F4F1EA' ? '#16161A' : '#F4F1EA') });
ART.shoes.v85red = v85('#F4F1EA', '#C8202E');
ART.shoes.v85royal = v85('#F4F1EA', '#1E4BB8');
ART.shoes.v85shadow = v85('#9AA0A6', '#2E3138');
ART.shoes.goldkicks = shoes({ main: () => GOLD, sole: '#F8F2DC', soleH: 5, shine: true, laceCol: GOLDHI });
ART.shoes.hightops = shoes({ main: (p) => p.t1, h: 10, sole: '#F2EFE8', soleH: 5, laceCol: '#F2EFE8', detail: (P, c, R, m, ax, ay, side, tx) => swoosh(c.pal.t2)(P, c, R, m, ax, ay, side, tx) });
ART.shoes.retros = shoes({ main: (p) => p.tink === '#FFFFFF' ? '#F4F1EA' : p.tink, h: 9, sole: '#F2EFE8', soleH: 5, inner: (c, R, main, ax, ay, side, tx) => `<path d="${blob([[tx - 13, ay + 9], [tx + 13, ay + 9], [tx + 13, ay + 17], [tx - 13, ay + 17]])}" fill="${c.pal.t1}"/><path d="${blob([[ax - 9, ay - 11], [ax + 9, ay - 11], [ax + 9, ay - 3], [ax - 9, ay - 3]])}" fill="${c.pal.t1}"/>`, detail: (P, c, R, m, ax, ay, side, tx) => swoosh(c.pal.t2)(P, c, R, m, ax, ay, side, tx) });

/* ============================================================ HAIR */
// Head: x 64..136, top y 22, brows y 52, eyes y 63, ears y 57..81. 'back' draws behind the head, 'front' over it.
function hairShape(P, d, hc, o = {}) {
  const R = ramp(hc, { k: 0.9 });
  R.line = adj(hc, -0.22, -6, -0.05);
  if (rgbL(hc) < 0.2) R.line = '#06050A';
  P.fill(d, R.base);
  P.clip(d, [
    `<path d="${poly([[o.shX ?? 112, -20], [200, -20], [200, 200], [o.shX2 ?? 116, 200]])}" fill="${R.sh}"/>`,
    o.noHi ? '' : `<path d="${blob(o.hi || [[74, 26], [90, 16], [104, 14], [92, 22], [78, 34]])}" fill="${R.hi}"/>`,
    ...(o.strands || []).map((s) => `<path d="${curve(s)}" fill="none" stroke="${R.deep}" stroke-width="1.3" stroke-linecap="round"/>`),
    ...(o.lights || []).map((s) => `<path d="${curve(s)}" fill="none" stroke="${lt(hc, 0.16)}" stroke-width="1.6" stroke-linecap="round"/>`),
  ].join(''));
  P.stroke(d, R.line, OW);
  return R;
}
const rgbL = (h) => { const n = parseInt(h.replace('#', ''), 16); return (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 765; };
const hairOf = (back, front) => (P, g, col, ph, c) => { if (ph === 'back' && back) back(P, c.hair, c); if (ph === 'front' && front) front(P, c.hair, c); };
const SHORT = [[66, 58], [63.5, 44], [66, 30], [76, 18], [90, 11.5], [106, 10.5], [121, 14], [131, 23], [136.5, 37], [136.5, 57], [133.2, 56], [132.4, 45], [127, 39.5], [119, 37], [110, 40], [101, 36.5], [91, 39.5], [81, 37], [73, 42], [68.4, 48], [68, 57]];
ART.hair.short = hairOf(null, (P, hc) => hairShape(P, blob(SHORT), hc, { strands: [[[84, 24], [92, 32]], [[100, 20], [106, 30]], [[114, 24], [120, 34]], [[76, 32], [80, 38]]], lights: [[[80, 22], [90, 17]]] }));
ART.hair.buzz = hairOf(null, (P, hc, c) => {
  const d = blob([[65, 52], [64.5, 40], [70, 28], [84, 21], [100, 19.5], [116, 21], [130, 28], [135.5, 40], [135.5, 52], [132.5, 50], [130, 42], [118, 36.5], [100, 35.5], [82, 36.5], [70, 42], [67.5, 50]]);
  P.fill(d, hc, 0.82); P.clip(d, `<path d="${poly([[114, 0], [200, 0], [200, 80], [118, 80]])}" fill="#000" opacity="0.22"/>`);
  P.stroke(d, adj(hc, -0.15), 1.2, 0.7);
});
ART.hair.fade = hairOf(null, (P, hc, c) => {
  P.fill(blob([[65, 56], [64.5, 42], [70, 32], [70, 42], [68, 54]]), hc, 0.45); P.fill(blob([[135, 56], [135.5, 42], [130, 32], [130, 42], [132, 54]]), hc, 0.45);
  hairShape(P, blob([[70, 40], [70, 28], [80, 15], [96, 9], [112, 10], [126, 17], [131, 30], [130, 40], [122, 37], [110, 39], [100, 35], [88, 38], [78, 36]]), hc, { strands: [[[88, 20], [96, 30]], [[106, 18], [110, 28]]], lights: [[[82, 20], [94, 14]]] });
});
ART.hair.slick = hairOf(null, (P, hc) => hairShape(P, blob([[66, 56], [63.5, 42], [67, 27], [80, 15], [98, 10], [116, 11.5], [130, 20], [136.5, 36], [136.5, 56], [133, 55], [132, 42], [124, 32.5], [110, 30], [96, 30.5], [82, 33], [72, 40], [68, 56]]), hc, { strands: [[[78, 30], [96, 18], [118, 18]], [[84, 32], [102, 24], [124, 26]]], lights: [[[76, 26], [94, 16], [112, 15]], [[90, 26], [108, 22]]], noHi: true }));
// Curls: loose brown curls with a middle part. One seamless rounded shape with real volume (fro-shaped outline,
// but not an afro): a soft scalloped curly edge, curls falling to each side of the part over the temples, texture all through.
function scallop(pts, amp, closed = true, centre) {
  // rounded bumps between neighbouring points, pushed away from the centre of the shape
  const n = pts.length, cx = centre ? centre[0] : pts.reduce((a, p) => a + p[0], 0) / n, cy = centre ? centre[1] : pts.reduce((a, p) => a + p[1], 0) / n;
  let d = '';
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = mx - cx, dy = my - cy, l = Math.hypot(dx, dy) || 1, k = Array.isArray(amp) ? amp[i % amp.length] : amp;
    d += ` Q${pt([mx + (dx / l) * k, my + (dy / l) * k])} ${pt(b)}`;
  }
  return d;
}
const curlTex = (R, spots, s = 1) => spots.map(([x, y], i) => {
  const r = 3.8 * s, lit = x < 106;
  return `<path d="${curve([[x - r, y + r * 0.35], [x - r * 0.35, y - r * 0.8], [x + r * 0.7, y - r * 0.4], [x + r * 0.5, y + r * 0.6], [x - r * 0.15, y + r * 0.75]])}" fill="none" stroke="${lit && i % 3 !== 2 ? R.hi : R.deep}" stroke-width="1.45" stroke-linecap="round"/>`;
}).join('');
const curlRamp = (hc) => { const R = ramp(hc, { k: 0.9 }); if (rgbL(hc) < 0.2) { R.base = adj(hc, 0.07); R.sh = adj(hc, 0.02); R.deep = adj(hc, 0.17); R.hi = adj(hc, 0.16); } R.line = rgbL(hc) < 0.2 ? '#06050A' : adj(hc, -0.22); return R; };
// Curly flow: a round, full curly crown in a fro-like shape but made of loose brown ringlets, not a tight afro.
// Even on both sides, curls falling onto the forehead, two strands at the front, short above the ears, nothing at the back.
ART.hair.curly = hairOf(null, (P, hc) => {
  const R = curlRamp(hc);
  const mir = (a) => a.map(([x, y]) => [200 - x, y]);
  const topR = [[100, -11], [113, -10], [125, -6], [136, 1], [144, 11], [149, 23], [150, 35], [147, 46], [141, 54], [136, 60]];
  const fringeR = [[136, 60], [134.5, 50], [131, 43.5], [125, 40], [120, 44.5], [115, 38.5], [109, 42], [104.5, 37], [100, 39.5]];
  const topL = mir(topR).reverse(), fringeL = mir(fringeR).reverse();
  const d = `M${pt(topL[0])}${scallop(topL, 4.2, false, [100, 40])}${scallop(topR, 4.2, false, [100, 40])}${scallop(fringeR, 2.4, false, [100, 70])}${scallop(fringeL, 2.4, false, [100, 70])}Z`;
  P.fill(d, R.base);
  // loose ringlets in staggered rows; lit on the left, in shadow on the right
  const ring = ([x, y], colr, k) => { const r = 4.4 + (k % 3) * 0.6, f = k % 2 ? 1 : -1; return `<path d="${curve([[x - r * f, y + r * 0.2], [x - r * 0.4 * f, y - r * 0.85], [x + r * 0.75 * f, y - r * 0.45], [x + r * 0.6 * f, y + r * 0.6], [x - r * 0.1 * f, y + r * 0.9], [x - r * 0.35 * f, y + r * 0.2]])}" fill="none" stroke="${colr}" stroke-width="1.5" stroke-linecap="round"/>`; };
  const spots = [];
  for (let row = 0; row < 5; row++) for (let i = 0; i < 8; i++) { const x = 60 + i * 12.5 + (row % 2) * 6.2, y = -2 + row * 11.5; if (Math.hypot((x - 100) / 48, (y - 24) / 36) < 1) spots.push([x, y]); }
  P.clip(d, [
    `<path d="${poly([[118, -30], [170, -30], [170, 90], [124, 90]])}" fill="${R.sh}"/>`,
    `<path d="${poly([[138, -30], [170, -30], [170, 90], [140, 90]])}" fill="${R.deep}" opacity="0.6"/>`,
    `<path d="${curve([[64, 18], [74, 2], [92, -6], [104, -7]])}" fill="none" stroke="${R.hi}" stroke-width="5" stroke-linecap="round" opacity="0.35"/>`,
    `<path d="${curve([[60, 52], [76, 44], [100, 42], [124, 44], [140, 52]])}" fill="none" stroke="${R.deep}" stroke-width="6" stroke-linecap="round" opacity="0.45"/>`,
    ...spots.map((p2, k) => ring(p2, p2[0] < 108 ? (k % 3 === 2 ? R.deep : R.hi) : (k % 3 === 2 ? R.hi : R.deep), k)),
  ].join(''));
  P.stroke(d, R.line, OW);
  // two loose curly strands falling at the front, one each side
  [-1, 1].forEach((sd) => { const X = (x) => 100 + sd * x;
    const sd2 = `M${X(0.5)} 32 Q${X(1.5)} 46 ${X(8.5)} 51.5 Q${X(15)} 52.5 ${X(14)} 45.5 Q${X(12.5)} 41 ${X(8.5)} 44 Q${X(8)} 38.5 ${X(6)} 33 Z`;
    P.fill(sd2, R.base); P.stroke(sd2, R.line, 1.6);
    P.stroke(curve([[X(2), 35], [X(4), 44], [X(9), 49.5]]), sd < 0 ? R.hi : R.deep, 1.2, 0.8); });
});
ART.hair.afro = hairOf((P, hc) => hairShape(P, blob([[56, 66], [48, 44], [54, 20], [76, 2], [100, -3], [124, 2], [146, 20], [152, 44], [144, 66], [136, 70], [64, 70]]), hc, { shX: 118, shX2: 124, hi: [[64, 22], [80, 8], [96, 4], [84, 14], [70, 28]], strands: [[[70, 40], [74, 46]], [[130, 30], [134, 38]], [[90, 10], [96, 14]], [[116, 12], [122, 18]], [[60, 52], [64, 58]], [[140, 52], [136, 58]]] }), (P, hc) => {
  const d = blob([[66, 58], [64, 40], [72, 30], [86, 26], [100, 25], [114, 26], [128, 30], [136, 40], [134, 58], [131, 46], [122, 39], [100, 36], [78, 39], [69, 46]]);
  const R = ramp(hc, { k: 0.9 });
  P.fill(d, R.base); P.clip(d, `<path d="${poly([[118, 0], [200, 0], [200, 80], [124, 80]])}" fill="${R.sh}"/>`);
  P.stroke(curve([[66, 58], [69, 46], [78, 39], [100, 36], [122, 39], [131, 46], [134, 58]]), rgbL(hc) < 0.2 ? '#06050A' : adj(hc, -0.22), OW);
});
ART.hair.bob = hairOf((P, hc) => hairShape(P, blob([[60, 50], [62, 28], [80, 12], [100, 8], [120, 12], [138, 28], [140, 50], [142, 100], [126, 108], [124, 80], [76, 80], [74, 108], [58, 100]]), hc, { noHi: true }), (P, hc) => hairShape(P, blob([[64, 104], [61, 60], [64, 36], [76, 18], [96, 10.5], [116, 12], [132, 22], [138, 38], [139, 62], [136, 104], [128, 102], [130, 64], [127, 46], [114, 42], [100, 44], [86, 40], [74, 46], [70, 64], [72, 102]]), hc, { strands: [[[90, 16], [80, 30], [76, 46]], [[110, 16], [118, 30], [126, 44]]], lights: [[[80, 22], [94, 14]]] }));
ART.hair.long = hairOf((P, hc) => hairShape(P, blob([[60, 50], [62, 28], [80, 12], [100, 8], [120, 12], [138, 28], [140, 50], [144, 110], [146, 150], [126, 156], [122, 110], [78, 110], [74, 156], [54, 150], [56, 110]]), hc, { noHi: true }), (P, hc) => hairShape(P, blob([[63, 120], [61, 62], [64, 36], [76, 18], [96, 10.5], [104, 14], [116, 12], [132, 22], [138, 38], [139, 64], [138, 120], [130, 118], [130, 66], [127, 48], [112, 40], [104, 26], [96, 40], [80, 46], [72, 64], [71, 118]]), hc, { strands: [[[96, 18], [86, 32], [76, 50]], [[106, 20], [118, 32], [126, 48]], [[66, 80], [67, 110]], [[134, 80], [133, 110]]], lights: [[[82, 22], [94, 14]]] }));
ART.hair.ponytail = hairOf((P, hc) => hairShape(P, blob([[124, 30], [146, 40], [154, 70], [150, 108], [140, 118], [138, 86], [134, 54]]), hc, { noHi: true, shX: 140, shX2: 144 }), (P, hc) => { hairShape(P, blob([[66, 56], [63.5, 42], [67, 27], [80, 15], [98, 10], [116, 11.5], [130, 20], [136.5, 36], [136.5, 56], [133, 55], [132, 42], [124, 32.5], [110, 31], [96, 31.5], [82, 33], [72, 40], [68, 56]]), hc, { strands: [[[80, 30], [96, 18], [116, 18]], [[90, 32], [108, 24], [126, 28]]], lights: [[[78, 26], [94, 16]]], noHi: true }); P.shape(blob([[130, 24], [136, 22], [138, 30], [132, 32]]), '#C8432E', { line: '#5A1A10', w: 1.3 }); });
ART.hair.bun = hairOf(null, (P, hc) => { hairShape(P, blob([[90, 12], [92, -2], [100, -6], [108, -2], [110, 12]]), hc, { noHi: true }); hairShape(P, blob([[66, 56], [63.5, 42], [67, 27], [80, 15], [98, 10], [116, 11.5], [130, 20], [136.5, 36], [136.5, 56], [133, 55], [132, 42], [124, 32.5], [110, 31], [96, 31.5], [82, 33], [72, 40], [68, 56]]), hc, { strands: [[[80, 30], [96, 16]], [[104, 16], [122, 28]]], lights: [[[78, 26], [92, 16]]], noHi: true }); });
ART.hair.braids = hairOf((P, hc) => both((s) => { const X = (x) => CX + x * s; for (let k = 0; k < 2; k++) { const x0 = 33 + k * 5; const pts = [[X(x0), 60], [X(x0 + 1), 90], [X(x0 + 2), 120], [X(x0 + 1.5), 150]]; P.stroke(curve(pts), adj(hc, -0.25), 7.4); P.stroke(curve(pts), hc, 5); for (let y = 66; y < 150; y += 7) P.stroke(curve([[X(x0 - 2), y], [X(x0 + 2), y + 3]]), adj(hc, -0.2), 1.1); } }), (P, hc) => {
  const R = hairShape(P, blob([[66, 56], [63.5, 42], [66, 30], [76, 18], [90, 11.5], [106, 10.5], [121, 14], [131, 23], [136.5, 37], [136.5, 56], [133, 55], [131, 44], [124, 37], [100, 35], [76, 37], [69, 44], [68, 56]]), hc, { noHi: true });
  [76, 88, 100, 112, 124].forEach((x) => P.stroke(curve([[x + (x - 100) * 0.1, 36], [x + (x - 100) * 0.05, 24], [x, 12]]), R.deep, 1.4));
});
ART.hair.twists = hairOf(null, (P, hc) => {
  const R = ramp(hc), line = rgbL(hc) < 0.2 ? '#06050A' : adj(hc, -0.22);
  P.fill(blob([[66, 54], [64, 40], [70, 30], [86, 24], [114, 24], [130, 30], [136, 40], [134, 54], [130, 44], [100, 38], [70, 44]]), R.sh);
  const T = [[70, 34], [78, 26], [88, 20], [100, 18], [112, 20], [122, 26], [130, 34], [82, 34], [94, 30], [106, 30], [118, 34], [66, 44], [134, 44]];
  T.forEach(([x, y]) => { const d = blob([[x - 4.5, y + 6], [x - 4, y - 6], [x, y - 10], [x + 4, y - 6], [x + 4.5, y + 6], [x, y + 8]]); P.shape(d, x > 108 ? R.sh : R.base, { line, w: 1.6 }); P.stroke(curve([[x - 3, y - 4], [x + 3, y - 1]]), R.deep, 1); P.stroke(curve([[x - 3, y + 1], [x + 3, y + 4]]), R.deep, 1); });
});
ART.hair.mohawk = hairOf(null, (P, hc, c) => {
  P.fill(blob([[66, 54], [65, 40], [72, 30], [72, 44], [68, 54]]), hc, 0.4); P.fill(blob([[134, 54], [135, 40], [128, 30], [128, 44], [132, 54]]), hc, 0.4);
  hairShape(P, blob([[88, 38], [86, 20], [90, 2], [96, 12], [100, -6], [106, 10], [112, 0], [114, 20], [112, 38], [100, 36]]), hc, { shX: 102, shX2: 106, hi: [[90, 10], [94, 6], [96, 20], [92, 26]] });
});
ART.hair.dreads = hairOf((P, hc) => both((s) => { const X = (x) => CX + x * s; [[30, 150], [36, 140], [42, 128]].forEach(([x0, end]) => { const pts = [[X(x0), 40], [X(x0 + 3), 80], [X(x0 + 5), 115], [X(x0 + 4), end]]; P.stroke(curve(pts), adj(hc, -0.25), 8); P.stroke(curve(pts), hc, 5.6); P.stroke(curve(pts.map(([x, y]) => [x - 1, y])), lt(hc, 0.12), 1.2, 0.8); }); }), (P, hc) => {
  hairShape(P, blob([[66, 56], [63.5, 42], [66, 30], [76, 18], [90, 11.5], [106, 10.5], [121, 14], [131, 23], [136.5, 37], [136.5, 56], [130, 50], [120, 38], [100, 36], [80, 38], [70, 50]]), hc, { noHi: true });
  [[78, 36, 60], [90, 34, 52], [110, 34, 52], [122, 36, 60]].forEach(([x, y0, y1]) => { P.stroke(curve([[x, y0 - 6], [x - 1, y1]]), adj(hc, -0.25), 7.4); P.stroke(curve([[x, y0 - 6], [x - 1, y1]]), hc, 5); });
});

/* ============================================================ HATS */
const capDome = (P, crown, line) => { const d = blob([[64, 50], [64, 34], [72, 18], [88, 9], [100, 7.5], [112, 9], [128, 18], [136, 34], [136, 50], [118, 45], [100, 44], [82, 45]]); P.part(d, ramp(crown), { shade: [[poly([[112, 0], [150, 0], [150, 60], [116, 60]]), ramp(crown).sh], [blob([[74, 22], [88, 13], [96, 13], [84, 24], [76, 32]]), ramp(crown).hi]], line }); P.stroke(curve([[100, 8], [100, 44]]), dk(crown, 0.2), 1.2, 0.8); P.stroke(curve([[82, 10], [76, 44]]), dk(crown, 0.15), 1, 0.6); P.stroke(curve([[118, 10], [124, 44]]), dk(crown, 0.25), 1, 0.6); P.ell(100, 8, 3.2, 2, dk(crown, 0.1), { line: dk(crown, 0.45), w: 1.1 }); return d; };
const capBill = (P, bill, flat) => { const d = flat ? blob([[58, 44], [100, 41], [142, 44], [143, 50], [100, 52], [57, 50]]) : blob([[60, 45], [100, 40.5], [140, 45], [138, 53], [100, 58], [62, 53]]); P.part(d, ramp(bill), { shade: [[poly([[112, 30], [150, 30], [150, 70], [112, 70]]), ramp(bill).sh], [poly([[50, 50], [150, 50], [150, 70], [50, 70]]), ramp(bill).deep]] }); };
const logo = (P, x, y, colr, s = 12, ch = 'F') => P.add(`<text x="${x}" y="${y}" font-family="Georgia, serif" font-weight="700" font-size="${s}" text-anchor="middle" fill="${colr}">${ch}</text>`);
const capOf = (o) => (P, g, col, ph, c) => { if (ph !== 'head') return; const crown = o.main ? o.main(c.pal, col) : col || o.def; const bill = o.bill ? o.bill(c.pal, crown) : dk(crown, 0.08); capDome(P, crown); if (o.extra) o.extra(P, c, crown); capBill(P, bill, o.flat); if (o.logo) o.logo(P, c, crown); };
ART.hat.plaincap = capOf({ def: '#1C1C21' });
ART.hat.cap = capOf({ main: (p) => p.t1, bill: (p) => p.t2, logo: (P, c) => { P.add(`<text x="100" y="35" font-family="Georgia, serif" font-weight="700" font-size="16" text-anchor="middle" fill="${c.pal.tink}" stroke="${tout(c)}" stroke-width="1.2" paint-order="stroke">${ini(c)}</text>`); P.ell(100, 9, 2.6, 1.8, c.pal.t2); } });
ART.hat.snapback = capOf({ main: (p) => p.t1, bill: (p) => p.t2, flat: true, extra: (P, c) => P.fill(blob([[84, 20], [116, 20], [118, 42], [82, 42]]), dk(c.pal.t1, 0.06)), logo: (P, c) => { P.add(`<text x="100" y="37" font-family="Georgia, serif" font-weight="700" font-size="18" text-anchor="middle" fill="${c.pal.tink}" stroke="${tout(c)}" stroke-width="1.3" paint-order="stroke">${ini(c)}</text>`); P.ell(114, 46.5, 3, 2, '#E8E6E0'); } });
ART.hat.trucker = capOf({ def: '#EFE9DC', bill: () => '#3A3F48', extra: (P) => { both((s) => { const X = (x) => CX + x * s; P.fill(blob([[X(18), 12], [X(32), 22], [X(36), 44], [X(22), 42]]), '#3A3F48'); for (let y = 18; y < 42; y += 5) P.stroke(curve([[X(22), y], [X(33), y + 2]]), '#5A606A', 1, 0.8); }); }, logo: (P) => { P.shape(blob([[88, 25], [112, 25], [112, 37], [88, 37]]), '#C8432E', { line: '#5A1A10', w: 1.2 }); logo(P, 100, 35, '#F2EFE8', 10, 'H'); } });
ART.hat.beanie = (P, g, col, ph, c) => {
  if (ph !== 'head') return;
  const R = ramp(c.pal.t1), R2 = ramp(c.pal.t2);
  P.part(blob([[63, 46], [63, 28], [72, 12], [88, 3], [100, 1.5], [112, 3], [128, 12], [137, 28], [137, 46]]), R, { shade: [[poly([[112, -10], [150, -10], [150, 60], [116, 60]]), R.sh]] });
  for (let x = 72; x <= 128; x += 7) P.stroke(curve([[x, 10 + Math.abs(x - 100) * 0.3], [x + (x - 100) * 0.04, 34]]), R.deep, 1.1, 0.7);
  P.part(blob([[62, 50], [62, 36], [100, 33], [138, 36], [138, 50], [100, 53]]), R2, { shade: [[poly([[114, 20], [150, 20], [150, 60], [118, 60]]), R2.sh]] });
  P.ell(100, -2, 8, 7, c.pal.tacc, { line: dk(c.pal.tacc, 0.45) });
};
ART.hat.headband = (P, g, col, ph, c) => { if (ph !== 'head') return; P.part(blob([[63, 44], [64, 35], [100, 31], [136, 35], [137, 44], [100, 41]]), ramp(c.pal.tink), { shade: [[poly([[112, 20], [150, 20], [150, 60], [116, 60]]), ramp(c.pal.tink).sh]] }); P.stroke(curve([[64, 39.5], [100, 36], [136, 39.5]]), c.pal.t1, 2.4); };
ART.hat.durag = (P, g, col, ph, c) => {
  if (ph === 'back') return;
  if (ph !== 'head') return;
  const R = ramp(c.pal.t1);
  P.part(blob([[64, 54], [63, 34], [72, 18], [88, 10], [100, 9], [112, 10], [128, 18], [137, 34], [136, 54], [132, 48], [120, 40], [100, 38], [80, 40], [68, 48]]), R, { shade: [[poly([[114, 0], [150, 0], [150, 60], [118, 60]]), R.sh]], extra: null });
  P.stroke(curve([[100, 10], [100, 38]]), c.pal.t2, 2.4);
  P.stroke(curve([[72, 22], [86, 34]]), lt(c.pal.t1, 0.2), 2.4, 0.7);
  P.shape(blob([[133, 42], [146, 50], [150, 78], [142, 86], [138, 60]]), c.pal.t2, { line: R.line });
};
ART.hat.bucket = (P, g, col, ph, c) => { if (ph !== 'head') return; const R = ramp(c.pal.t1), R2 = ramp(c.pal.t2); P.part(blob([[68, 44], [70, 22], [84, 10], [100, 8], [116, 10], [130, 22], [132, 44]]), R, { shade: [[poly([[112, 0], [150, 0], [150, 60], [116, 60]]), R.sh]] }); P.part(blob([[54, 52], [62, 40], [100, 37], [138, 40], [146, 52], [140, 58], [100, 56], [60, 58]]), R2, { shade: [[poly([[112, 30], [160, 30], [160, 70], [116, 70]]), R2.sh]] }); P.stroke(curve([[68, 42], [100, 39.5], [132, 42]]), R.line, 1.2, 0.8); };
ART.hat.monobucket = (P, g, col, ph, c) => { if (ph !== 'head') return; const R = ramp('#6B4A2E'); P.part(blob([[68, 44], [70, 22], [84, 10], [100, 8], [116, 10], [130, 22], [132, 44]]), R, { shade: [[poly([[112, 0], [150, 0], [150, 60], [116, 60]]), R.sh]] }); P.part(blob([[54, 52], [62, 40], [100, 37], [138, 40], [146, 52], [140, 58], [100, 56], [60, 58]]), R, { shade: [[poly([[112, 30], [160, 30], [160, 70], [116, 70]]), R.sh]] }); [[80, 18], [94, 14], [108, 14], [122, 20], [74, 32], [88, 28], [102, 28], [116, 30], [126, 36], [66, 50], [84, 48], [100, 48], [116, 48], [134, 50]].forEach(([x, y]) => P.add(`<path d="M${x - 2} ${y} L${x} ${y - 2} L${x + 2} ${y} L${x} ${y + 2}Z" fill="#D8B66A"/>`)); };
ART.hat.helmet = (P, g, col, ph, c) => {
  if (ph !== 'head') return;
  const R = ramp(c.pal.t1);
  const d = blob([[58, 84], [56, 50], [62, 24], [80, 6], [100, 2], [120, 6], [138, 24], [144, 50], [142, 84], [134, 92], [130, 70], [126, 50], [100, 44], [74, 50], [70, 70], [66, 92]]);
  P.part(d, R, { shade: [[poly([[114, -10], [160, -10], [160, 100], [118, 100]]), R.sh]], extra: null });
  P.stroke(curve([[100, 3], [100, 44]]), c.pal.tink, 4.4); P.stroke(curve([[96, 3.4], [96, 44]]), c.pal.t2, 1.4); P.stroke(curve([[104, 3.4], [104, 44]]), c.pal.t2, 1.4);
  both((s) => P.ell(CX + 36 * s, 70, 3, 4, '#1A1A1A'));
  const mask = '#D8DDE4';
  [[[70, 72], [100, 76], [130, 72]], [[70, 86], [100, 92], [130, 86]], [[74, 98], [100, 104], [126, 98]]].forEach((pts) => { P.stroke(curve(pts), '#5A606A', 4.4); P.stroke(curve(pts), mask, 2.6); });
  [[[100, 76], [100, 104]], [[86, 74], [88, 101]], [[114, 74], [112, 101]]].forEach((pts) => { P.stroke(curve(pts), '#5A606A', 4); P.stroke(curve(pts), mask, 2.2); });
};
ART.hat.crown = (P, g, col, ph) => { if (ph !== 'head') return; const R = ramp(GOLD); P.part(poly([[74, 26], [72, 0], [86, 14], [100, -6], [114, 14], [128, 0], [126, 26]]), R, { shade: [[poly([[106, -20], [140, -20], [140, 40], [108, 40]]), R.sh]], line: GOLD2 }); P.stroke(curve([[74, 22], [100, 20], [126, 22]]), GOLD2, 2); P.ell(100, 14, 3.4, 3.4, '#E03B3B', { line: '#6A1010', w: 1 }); P.ell(85, 18, 2.4, 2.4, '#4FA3E0', { line: '#1A3A6A', w: 1 }); P.ell(115, 18, 2.4, 2.4, '#4FA3E0', { line: '#1A3A6A', w: 1 }); [[72, 0], [100, -6], [128, 0]].forEach(([x, y]) => P.ell(x, y, 2.6, 2.6, GOLDHI, { line: GOLD2, w: 1 })); };

/* ============================================================ FACE, BEARD, EARS */
const EYES = [[84.5, 63.4], [115.5, 63.4]];
ART.face.eyeblack = (P, g, col, ph) => { if (ph === 'face') EYES.forEach(([x, y]) => P.fill(blob([[x - 7, y + 6], [x + 6, y + 6], [x + 5, y + 9.5], [x - 6, y + 9.5]]), '#16161B', 0.92)); };
const lenses = (P, shape, fill, frame, w = 1.8) => { EYES.forEach(([x, y]) => P.shape(shape(x, y), fill, { line: frame, w })); P.stroke(curve([[92.5, 61], [100, 59.5], [107.5, 61]]), frame, w); both((s) => P.stroke(curve([[CX + s * 23.5, 60], [CX + s * 34, 58.5]]), frame, w)); };
ART.face.shades = (P, g, col, ph) => { if (ph !== 'face') return; lenses(P, (x, y) => blob([[x - 9, y - 5], [x + 8.5, y - 5.5], [x + 8, y + 3], [x + 2, y + 6.5], [x - 7, y + 5]]), '#121216', '#060608', 2.2); EYES.forEach(([x, y]) => P.stroke(curve([[x - 6, y - 2.5], [x - 2, y - 3.4]]), '#5A606A', 1.6)); };
ART.face.aviators = (P, g, col, ph) => { if (ph !== 'face') return; lenses(P, (x, y) => blob([[x - 9, y - 5], [x + 8, y - 5], [x + 7, y + 3], [x + 1, y + 8], [x - 7, y + 5]]), '#4A3218', GOLD, 1.6); EYES.forEach(([x, y]) => P.stroke(curve([[x - 6, y - 2], [x - 1, y - 3.2]]), '#B08A5A', 1.6)); };
ART.face.ovalshades = (P, g, col, ph) => { if (ph !== 'face') return; lenses(P, (x, y) => blob([[x - 7.5, y], [x, y - 5], [x + 7.5, y], [x, y + 5]]), '#0C0C10', '#0C0C10', 2); both((s) => P.stroke(curve([[CX + s * 24, 59], [CX + s * 34, 58]]), GOLD, 1.8)); };
ART.face.glasses = (P, g, col, ph) => { if (ph !== 'face') return; EYES.forEach(([x, y]) => { P.ell(x, y, 9, 7.6, '#DDEBFF', { op: 0.18 }); P.add(`<ellipse cx="${x}" cy="${y}" rx="9" ry="7.6" fill="none" stroke="#2A2A2A" stroke-width="1.8"/>`); }); P.stroke(curve([[93.5, 61], [100, 59.5], [106.5, 61]]), '#2A2A2A', 1.8); both((s) => P.stroke(curve([[CX + s * 24.5, 61], [CX + s * 34, 59]]), '#2A2A2A', 1.6)); };
ART.face.paint = (P, g, col, ph, c) => { if (ph !== 'face') return; both((s) => { const x = CX + s * 21; [[c.pal.t1, 0], [c.pal.tink, 4], [c.pal.t1, 8]].forEach(([colr, dy]) => P.stroke(curve([[x - 5, 74 + dy], [x + 5, 73 + dy]]), colr, 3)); }); };
ART.face.visor = (P, g, col, ph) => { if (ph !== 'face') return; const d = blob([[68, 56], [100, 53], [132, 56], [132, 70], [100, 72], [68, 70]]); P.part(d, ramp(GOLD), { shade: [[poly([[106, 40], [140, 40], [140, 80], [110, 80]]), ramp(GOLD).sh]], line: GOLD2 }); P.stroke(curve([[74, 59], [96, 57]]), GOLDHI, 2.4); };
ART.face.grill = (P, g, col, ph) => { if (ph !== 'face') return; P.shape(blob([[92, 94.2], [108, 94.2], [106, 97.2], [94, 97.2]]), GOLD, { line: GOLD2, w: 1.1 }); [96, 100, 104].forEach((x) => P.stroke(curve([[x, 94.4], [x, 97]]), GOLD2, 0.8)); P.dot(97.5, 95.3, 0.8, GOLDHI); };
const beardCol = (c) => adj(c.hair, -0.02);
ART.beard.stubble = (P, g, col, ph, c) => { if (ph !== 'face') return; const d = blob([[68, 76], [72, 92], [84, 104], [100, 108], [116, 104], [128, 92], [132, 76], [124, 84], [112, 90], [100, 88], [88, 90], [76, 84]]); P.fill(d, beardCol(c), 0.22); P.fill(blob([[89, 89], [100, 88], [111, 89], [110, 92], [100, 91.5], [90, 92]]), beardCol(c), 0.3); };
ART.beard.stache = (P, g, col, ph, c) => { if (ph !== 'face') return; P.shape(blob([[88, 92.5], [94, 88.6], [100, 89.8], [106, 88.6], [112, 92.5], [106, 92], [100, 92.6], [94, 92]]), beardCol(c), { line: adj(c.hair, -0.2), w: 1.2 }); };
ART.beard.goatee = (P, g, col, ph, c) => { if (ph !== 'face') return; ART.beard.stache(P, g, col, ph, c); P.shape(blob([[92, 99], [100, 100.5], [108, 99], [107, 106], [100, 109], [93, 106]]), beardCol(c), { line: adj(c.hair, -0.2), w: 1.2 }); };
ART.beard.beard = (P, g, col, ph, c) => {
  if (ph !== 'face') return;
  const d = blob([[66, 64], [70, 84], [80, 100], [92, 110], [100, 112], [108, 110], [120, 100], [130, 84], [134, 64], [130, 66], [126, 82], [112, 88], [100, 87], [88, 88], [74, 82], [70, 66]]);
  const R = ramp(beardCol(c)); P.part(d, R, { shade: [[poly([[112, 60], [150, 60], [150, 120], [112, 120]]), R.sh]], line: adj(c.hair, -0.2) });
  ART.beard.stache(P, g, col, ph, c);
};
ART.ear.studs = (P, g, col, ph) => { if (ph === 'face') both((s) => { P.add(`<path d="M${CX + s * 35.2} 77.4 l2.2 2.2 l-2.2 2.2 l-2.2 -2.2Z" fill="#F4FBFF" stroke="#7A9AB8" stroke-width="0.8"/>`); }); };
ART.ear.hoops = (P, g, col, ph) => { if (ph === 'face') both((s) => { P.add(`<ellipse cx="${CX + s * 35.6}" cy="85" rx="3.6" ry="5" fill="none" stroke="${GOLD2}" stroke-width="2.8"/><ellipse cx="${CX + s * 35.6}" cy="85" rx="3.6" ry="5" fill="none" stroke="${GOLD}" stroke-width="1.6"/>`); }); };
