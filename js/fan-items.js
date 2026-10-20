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
  P.clip(open, `<path d="${poly([[CX + nk * 0.3, 100], [CX + 40, 100], [CX + 40, 160], [CX + nk * 0.3, 160]])}" fill="${sk.sh}"/><path d="${blob([[CX - nk - 4, 100], [CX + nk + 4, 100], [CX + nk + 3, 106], [CX, 111.5], [CX - nk - 3, 106]])}" fill="${sk.sh}" opacity="0.5"/>`);
  const edge = type === 'v' || type === 'deepv' ? [[CX - nk - 3.5, 112.5], [CX - nk * 0.4, 124], [CX, depth], [CX + nk * 0.4, 124], [CX + nk + 3.5, 112.5]] : [[CX - nk - 4, 112.5], [CX - nk * 0.5, depth - 1], [CX + nk * 0.5, depth - 1], [CX + nk + 4, 112.5]];
  if (o.rib !== false) { P.stroke(curve(edge), R.line, 5.2); P.stroke(curve(edge), o.ribCol || R.sh, 3); }
  else P.stroke(curve(edge), R.line, OW);
}
/** a top: o = { def, main, sleeve: short|elbow|long|none, grow, hem, neck, rib, detail, collar, cuff, sleeveCol } */
function top(o) {
  return (P, g, col, ph, c) => {
    const main = colOf(o, c, col), R = ramp(main), B = c.B, grow = o.grow ?? 3, hem = o.hem ?? 203;
    const YE = { short: 0.36, elbow: 0.6, long: 0.9, none: null };
    const kind = (side) => (side < 0 && o.sleeveL ? o.sleeveL : side > 0 && o.sleeveR ? o.sleeveR : o.sleeve ?? 'short');
    const yEnd = YE[o.sleeve ?? 'short'] ?? YE[o.sleeveL] ?? YE[o.sleeveR];
    if (ph === 'body') {
      const d = o.shape === 'tank' ? tankD(B, grow, hem) : torsoD(B, grow, hem);
      P.part(d, R, { shade: bodyShade(B, grow, hem, 0, R) });
      if (o.detail) o.detail(P, c, R, d, main);
      neckline(P, c, o.neck ?? 'crew', R, { rib: o.rib, ribCol: o.ribCol ? o.ribCol(c.pal, main) : undefined });
      if (o.collar) o.collar(P, c, R, main);
    }
    if (ph === 'sleeves' && yEnd) both((side) => {
      const ye = YE[kind(side)]; if (!ye) return;
      const SR = o.sleeveCol ? ramp(o.sleeveCol(c.pal, main)) : R;
      sleeve(P, g, side, ye, (o.sgrow ?? 4) * (c.B.arm * 0.5 + 0.5), SR, { seam: !!o.sleeveCol });
      if (o.trim) o.trim(P, g, side, ye, c, R, main);
    });
    if (ph === 'cuffs' && yEnd) both((side) => {
      if (kind(side) !== 'long') return;
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
      const open = !!o.zip && c.side === 'open';
      if (o.closed && !open) {
        const d = torsoD(B, grow, hem, 2);
        P.part(d, R, { shade: bodyShade(B, grow, hem, 2, R) });
        if (o.detail) o.detail(P, c, R, d, main, B, grow, hem);
      } else {
        const gap = open ? openGap : o.gap || ((y) => (y < 150 ? 3 + (150 - y) * 0.28 : 3 + (y - 150) * 0.03));
        both((side) => {
          const d = halfD(B, side, grow, hem, 2, gap);
          P.part(d, R, { shade: side > 0 ? bodyShade(B, grow, hem, 2, R).slice(0, 2) : bodyShade(B, grow, hem, 2, R).slice(2) });
        });
        if (open) { edges(P, INK, 2.2, 118, hem - 4, 0.6); edges(P, o.zipCol || SILVER, 0.9, 118, hem - 4, 0.6); both((s) => P.stroke(curve([[CX + s * 26, 178], [CX + s * 20, 196]]), R.line, 1.2, 0.8)); }
        else if (o.detail) o.detail(P, c, R, null, main, B, grow, hem);
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
const hood = (P, c, R) => {
  const nk = c.B.nk, sk = c.sk;
  // a draped cowl: a thick ring that reaches the shoulders, with the neck showing through the middle
  P.shape(blob([[CX - nk - 20, 120], [CX - nk - 12, 106], [CX - nk - 3, 102], [CX + nk + 3, 102], [CX + nk + 12, 106], [CX + nk + 20, 120], [CX + nk + 10, 129], [CX, 133], [CX - nk - 10, 129]]), R.sh, { line: R.line });
  const mouth = blob([[CX - nk - 1, 104], [CX + nk + 1, 104], [CX + nk * 0.8, 114], [CX, 119], [CX - nk * 0.8, 114]]);
  P.fill(mouth, sk.base);
  P.clip(mouth, `<path d="${blob([[CX - nk - 4, 100], [CX + nk + 4, 100], [CX + nk + 3, 108], [CX, 114], [CX - nk - 3, 108]])}" fill="${sk.sh}" opacity="0.5"/>`);
  P.stroke(curve([[CX - nk - 1, 105], [CX - nk * 0.8, 114], [CX, 119], [CX + nk * 0.8, 114], [CX + nk + 1, 105]]), R.line, 1.6);
  P.stroke(curve([[CX - nk - 14, 122], [CX - nk * 0.6, 128], [CX, 130], [CX + nk * 0.6, 128], [CX + nk + 14, 122]]), R.line, 1, 0.45);
};
const strings = (P, R) => { P.stroke(curve([[CX - 5, 121], [CX - 5.5, 136], [CX - 4.5, 140]]), '#E8E6E0', 1.8); P.stroke(curve([[CX + 5, 121], [CX + 5.6, 134], [CX + 4.6, 138]]), '#E8E6E0', 1.8); };
const pocket = (P, R, main) => { P.shape(blob([[CX - 18, 168], [CX + 18, 168], [CX + 22, 192], [CX - 22, 192]]), dk(main, 0.05), { line: R.line, w: 1.4 }); P.stroke(curve([[CX, 168.5], [CX, 191.5]]), R.line, 1.2, 0.7); };
const hem = (P, B, grow, y, R) => { const w = B.hp + B.be * 0.3 + grow + 0.4; P.fill(poly([[CX - w, y - 6], [CX + w, y - 6], [CX + w + 0.3, y], [CX - w - 0.3, y]]), R.sh); P.stroke(curve([[CX - w, y - 6], [CX + w, y - 6]]), R.line, 1.1, 0.7); };
const hoodie = (x = {}) => top({ sleeve: 'long', grow: 5, hem: 205, neck: 'crew', rib: false, sgrow: 6, collar: (P, c, R, main) => { hood(P, c, R); strings(P, R); }, detail: (P, c, R, d, main) => { pocket(P, R, main); hem(P, c.B, 5, 205, R); if (x.detail) x.detail(P, c, R, d, main); }, ...x.o });
// jersey lettering: each style is a web font with a plain fallback
const FONT = {
  block: "Graduate, 'Arial Black', sans-serif", athletic: "'Big Shoulders Display', Oswald, 'Arial Narrow', sans-serif",
  bungee: "Bungee, 'Arial Black', sans-serif", racing: "'Racing Sans One', 'Arial Black', sans-serif", fat: "'Bowlby One', 'Arial Black', sans-serif",
  mono: "'Rubik Mono One', 'Arial Black', sans-serif", round: "Righteous, 'Arial Black', sans-serif", tech: "'Russo One', 'Arial Black', sans-serif",
  tall: "Teko, Oswald, 'Arial Narrow', sans-serif", script: "Yellowtail, 'Brush Script MT', cursive", cond: "Oswald, 'Arial Narrow', sans-serif",
};
const WEIGHT = { athletic: 800, tall: 600, cond: 700 };
const digits = (P, n, x, y, s, fill, line, font, skew) => { const f = FONT[font] ? font : 'block'; P.add(`<text x="${x}" y="${y}" font-family="${FONT[f]}" font-weight="${WEIGHT[f] || 400}" font-size="${s * (f === 'tall' ? 1.25 : f === 'athletic' ? 1.12 : 1)}" text-anchor="middle" fill="${fill}" stroke="${line}" stroke-width="${f === 'tall' || f === 'athletic' || f === 'block' ? 1.3 : 1.8}" paint-order="stroke"${skew ? ` transform="skewX(${skew}) translate(${(-y * Math.tan((skew * Math.PI) / 180)).toFixed(1)} 0)"` : ''}>${n}</text>`); };
// city lettering arched over the number, the way real jerseys set it
let archN = 0;
const arch = (P, t, y, size, maxW, fill, line, font, lift = 6) => {
  const f = FONT[font] ? font : 'block', id = 'ar' + (++archN) + Math.random().toString(36).slice(2, 5), half = maxW / 2 + 4;
  const est = t.length * size * (f === 'tall' || f === 'cond' || f === 'athletic' ? 0.5 : f === 'mono' || f === 'bungee' ? 0.85 : 0.7), fit = est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
  P.add(`<defs><path id="${id}" d="M${CX - half} ${y} Q${CX} ${y - lift * 2} ${CX + half} ${y}"/></defs><text font-family="${FONT[f]}" font-weight="${WEIGHT[f] || 400}" font-size="${size}" fill="${fill}"${line ? ` stroke="${line}" stroke-width="0.9" paint-order="stroke"` : ''} letter-spacing="0.3"><textPath href="#${id}" startOffset="50%" text-anchor="middle"${fit}>${t.replace(/&/g, '&amp;')}</textPath></text>`);
};

// the team's city across the chest, squeezed to fit when the name is long
const cityText = (P, c, y, size, maxW, fill, line, lw = 1.4) => {
  const t = c.pal.city || 'HOME', est = t.length * size * 0.74, fit = est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
  P.add(`<text x="${CX}" y="${y}" font-family="${FONT.athletic}" font-weight="800" font-size="${size * 1.15}" text-anchor="middle" fill="${fill}"${line ? ` stroke="${line}" stroke-width="${lw}" paint-order="stroke"` : ''} letter-spacing="0.6"${fit}>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
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
  detail: (P, c, R) => { arch(P, c.pal.city || 'HOME', 151, 10, 46, c.pal.tink, tout(c), 'athletic', 4); digits(P, '7', CX, 183, 32, c.pal.tink, tout(c), 'athletic'); const B = c.B; both((s) => P.stroke(curve([[CX + s * (B.ch + 3), 140], [CX + s * (B.wa + B.be + 4), 200]]), c.pal.t2, 3)); },
});
ART.top.swingman = top({
  main: (p) => p.t1, sleeve: 'none', shape: 'tank', neck: 'none', grow: 2,
  detail: (P, c, R, d) => {
    const B = c.B;
    P.clip(d, [-1, 1].map((sd) => `<path d="${poly([[CX + sd * (B.ch - 5), 136], [CX + sd * (B.ch + 20), 136], [CX + sd * (B.hp + B.be + 20), 210], [CX + sd * (B.wa + B.be - 3), 210]])}" fill="${c.pal.t2}"/>`).join(''));
    both((sd) => P.stroke(curve([[CX + sd * (B.ch - 5), 136], [CX + sd * (B.wa + B.be - 3), 205]]), c.pal.tacc, 1.6));
    arch(P, c.pal.city || 'HOME', 151, 10, 42, c.pal.tink, tout(c), 'athletic', 5); digits(P, '8', CX, 183, 32, c.pal.tink, tout(c), 'athletic');
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
    digits(P, o.num || '9', CX, 183, 33, ink, inkLine, o.font || 'tall', o.skew);
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
// Curly flow, after Richard Rios: medium wavy curls lifted off the forehead that flow back and out to both sides
// and roll over the temples into loose curl ends, then a taper fade down to the ear instead of thick sideburns.
// The hair is built from clumps (light and dark bands between the flow lines) so it reads as hair, not a blob.
// Everything is drawn on one half and mirrored, so both sides match. No part line, nothing at the back.
let curlN = 0;
// hl: blonde highlights on the lit clumps and curl ends (the paid version)
const curlyFlow = (hl) => hairOf(null, (P, hc) => {
  const R = curlRamp(hc);
  if (hl) { R.hi = mix(R.hi, '#E8C27A', 0.75); R.blond = '#F0D592'; }
  const M = ([x, y]) => [200 - x, y];
  const id = 'cf' + (++curlN) + Math.random().toString(36).slice(2, 6);
  // right half: round top, the flow widening over the temple, curls rolling under at the temple, then the hairline
  const topR = [[100, -4], [111, -4.5], [122, -1.5], [132, 4.5], [139.5, 13], [144.5, 23], [147, 34], [146, 44], [142.5, 50.5]];
  const sideR = [[142.5, 50.5], [138.6, 53.4], [135.6, 52.6], [133.2, 49.4], [131, 46]];
  const lineR = [[131, 46], [128.5, 39], [122.5, 34], [113, 31], [100, 30]];
  const topL = topR.map(M).reverse(), sideL = sideR.map(M).reverse(), lineL = lineR.map(M).reverse();
  const ampR = [2.4, 2.2, 2.6, 2.3, 2.6, 2.4, 2.7, 2.5], ampL = ampR.slice().reverse();
  const HL = `${scallop(lineR, [1.1, 1.5, 1.3, 1], false, [100, 0])}${scallop(lineL, [1, 1.3, 1.5, 1.1], false, [100, 0])}`;
  const d = `M${pt(topL[0])}${scallop(topL, ampL, false, [100, 38])}${scallop(topR, ampR, false, [100, 38])}${segs(sideR)}${HL}${segs(sideL)}Z`;
  const S = (pts, colr, w = 1.6, op) => `<path d="${curve(pts)}" fill="none" stroke="${colr}" stroke-width="${w}" stroke-linecap="round"${op != null ? ` opacity="${op}"` : ''}/>`;
  const band = (a2, b2, colr, op) => `<path d="${curve(a2)} L${curve(b2.slice().reverse()).slice(1)}Z" fill="${colr}"${op != null ? ` opacity="${op}"` : ''}/>`;

  P.add('<g transform="translate(100 46) scale(0.93 0.94) translate(-100 -46)">');
  // taper fade on each side: short hair from the temple down to the ear, fading out toward the bottom
  P.add(`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${R.base}" stop-opacity="1"/><stop offset="0.45" stop-color="${R.base}" stop-opacity="0.7"/><stop offset="1" stop-color="${R.base}" stop-opacity="0.08"/></linearGradient></defs>`);
  both((sd) => { const X = ([x, y]) => [100 + sd * (x - 100), y];
    P.fill(blob([[130.5, 44], [138.2, 48], [137.8, 58], [136.8, 69], [132.8, 68], [131.6, 56]].map(X)), `url(#${id})`);
    for (let k = 0; k < 7; k++) { const y = 51 + k * 2.2, x = 133.6 + (k % 2) * 1.4; P.stroke(`M${pt(X([x, y]))} L${pt(X([x + 0.5, y + 1.3]))}`, R.deep, 0.9, 0.55 - k * 0.06); }
  });

  P.fill(d, R.base);
  // flow lines, front to back: from the front of the hairline up, then out and down over the temple
  const F = [
    [[101, 18], [106, 7], [116, 2], [127, 4], [137, 12]],
    [[104, 29], [109, 18], [119, 11], [131, 12], [140, 21], [144, 33]],
    [[109, 31], [116, 23], [126, 20], [135, 25], [140, 36], [140.5, 47]],
    [[116, 33], [124, 29], [132, 32], [136.5, 41], [136.5, 51]],
  ];
  const top = [[100, -6], [112, -6], [124, -3], [134, 3], [141, 12]];
  const hooksR = [[144.5, 36], [141.5, 47], [137, 51], [133, 13], [121, 5], [108, 3.5], [127, 22], [140, 27]];
  const hook = ([x, y], colr, f, w = 1.4) => S([[x - 3 * f, y - 1.6], [x - 0.6 * f, y - 3.6], [x + 2.4 * f, y - 1.8], [x + 2 * f, y + 1.4], [x - 0.2 * f, y + 1.8]], colr, w, 0.95);
  const L = (pts) => pts.map(M);
  P.clip(d, [
    // clumps: light and dark bands between the flow lines (lit on the left side, shaded on the right)
    band(L(top), L(F[0]), R.hi, 0.55), band(top, F[0], R.base, 1),
    band(L(F[0]), L(F[1]), R.base, 1), band(F[0], F[1], R.sh, 1),
    band(L(F[1]), L(F[2]), R.hi, 0.45), band(F[1], F[2], R.base, 0.9),
    band(L(F[2]), L(F[3]), R.sh, 0.8), band(F[2], F[3], R.deep, 0.75),
    // the right side of the head sits in shadow, the far right edge deeper still
    `<path d="${poly([[124, -30], [170, -30], [170, 90], [128, 90]])}" fill="${R.sh}" opacity="0.45"/>`,
    `<path d="${poly([[140, -30], [170, -30], [170, 90], [142, 90]])}" fill="${R.deep}" opacity="0.55"/>`,
    // shadow tucked under each flow line, then a fine highlight riding on top of it
    ...F.flatMap((f) => [S(f.map(([x, y]) => [x + 0.8, y + 2.6]), R.deep, 2.8, 0.7), S(L(f).map(([x, y]) => [x - 0.8, y + 2.6]), R.deep, 2.8, 0.6)]),
    ...F.flatMap((f) => [S(L(f), lt(R.hi, 0.1), 1.5, 0.95), S(f, lt(R.sh, 0.2), 1.4, 0.9)]),
    // fine strands inside each clump
    ...F.slice(0, 3).flatMap((f, i) => { const g2 = f.map(([x, y], j) => [x + 1.6, y + 5.2 - j * 0.3]); return [S(L(g2), R.hi, 0.9, 0.6), S(g2, lt(R.sh, 0.25), 0.9, 0.55)]; }),
    // curls rolling under at the ends, with a light catch on the left side
    ...hooksR.flatMap((h2) => [hook(h2, R.deep, -1, 1.6), hook(M(h2), R.hi, 1, 1.5), hook([M(h2)[0] - 0.6, M(h2)[1] + 0.8], R.deep, 1, 0.9)]),
    ...(hl ? F.flatMap((f) => [S(L(f).map(([x, y]) => [x - 0.4, y - 1.6]), R.blond, 1.6, 0.9), S(f.map(([x, y]) => [x + 0.4, y - 1.6]), mix(R.blond, R.sh, 0.25), 1.5, 0.85)]).concat(hooksR.slice(3).flatMap((h2) => [hook(M(h2), R.blond, 1, 1.2), hook(h2, mix(R.blond, R.sh, 0.3), -1, 1.1)])) : []),
    // shine across the crown, rim light on the top-left edge, roots along the hairline
    S([[72, 12], [84, 1.5], [100, -0.5], [116, 1.5], [128, 12]], R.hi, 4, 0.28),
    S([[56, 34], [55.5, 22], [62, 10], [72, 2]], lt(R.hi, 0.2), 1.6, 0.5),
    S(lineL.concat(lineR.slice(1)).map(([x, y]) => [x, y - 1.8]), R.deep, 2.6, 0.6),
  ].join(''));
  P.stroke(`M${pt(topL[0])}${scallop(topL, ampL, false, [100, 38])}${scallop(topR, ampR, false, [100, 38])}${segs(sideR)}`, R.line, OW);
  P.stroke(`M${pt(lineR[0])}${HL}`, R.line, 1.4);
  P.stroke(`M${pt(sideL[0])}${segs(sideL)}`, R.line, OW);
  P.add('</g>');
});
ART.hair.curly = curlyFlow(false);
// Curls: the free everyday curly cut, the original thick version: round curl puffs over the top and sides,
// with a fuller curly mass behind.
ART.hair.curls = hairOf((P, hc) => hairShape(P, blob([[62, 68], [58, 50], [62, 30], [80, 12], [100, 6], [120, 12], [138, 30], [142, 50], [138, 68]]), hc, { noHi: true }), (P, hc) => {
  const C = [[70, 36, 9], [80, 24, 10], [94, 18, 10], [108, 18, 10], [121, 24, 10], [130, 36, 9], [66, 48, 7], [134, 48, 7], [86, 36, 8], [100, 32, 8], [114, 36, 8]];
  const R = ramp(hc, { k: 0.9 }); const line = rgbL(hc) < 0.2 ? '#06050A' : adj(hc, -0.22);
  C.forEach(([x, y, r]) => P.ell(x, y, r, r, line, {}));
  C.forEach(([x, y, r]) => P.ell(x, y, r - OW * 0.9, r - OW * 0.9, x > 108 ? R.sh : R.base, {}));
  C.forEach(([x, y, r]) => P.stroke(curve([[x - r * 0.5, y - r * 0.3], [x - r * 0.1, y - r * 0.6]]), lt(hc, 0.18), 1.6, 0.9));
  C.forEach(([x, y, r]) => P.stroke(curve([[x - r * 0.4, y + r * 0.35], [x, y + r * 0.55], [x + r * 0.45, y + r * 0.3]]), R.deep, 1.2, 0.8));
});
ART.hair.curlyhl = curlyFlow(true);
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

/* ============================================================ RETROS, PRINT JEANS, BASICS, OPEN JACKETS, SLEEVES */
// Throwback pieces in fixed colours. They copy the colours, cuts, stripes, numbers and city lettering of famous
// kits; no real logos, crests or brand marks are drawn.
const word = (P, t, y, size, maxW, fill, line, lw = 1.2, font = 'Arial Black, Arial, sans-serif', x = CX) => {
  if (FONT[font]) font = FONT[font];
  const est = t.length * size * 0.74, fit = est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
  P.add(`<text x="${x}" y="${y}" font-family="${font}" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}"${line ? ` stroke="${line}" stroke-width="${lw}" paint-order="stroke"` : ''} letter-spacing="0.4"${fit}>${t.replace(/&/g, '&amp;')}</text>`);
};
// a band across a sleeve or arm at fraction f of the arm's length
const across = (P, g, side, f, grow, colr, w) => { const J = cutF(g.armJ(side), 0, f, grow); const [x, y, ww] = J[J.length - 1]; P.stroke(`M${pt([x - ww / 2 + 1.4, y])} L${pt([x + ww / 2 - 1.4, y])}`, colr, w); };
const vStripes = (cols, w, x0 = CX - 90) => Array.from({ length: Math.ceil(180 / w) }, (_, i) => `<rect x="${x0 + i * w}" y="90" width="${w}" height="140" fill="${cols[i % cols.length]}"/>`).join('');
const hStripes = (cols, w, y0 = 100) => Array.from({ length: Math.ceil(130 / w) }, (_, i) => `<rect x="${CX - 90}" y="${y0 + i * w}" width="180" height="${w}" fill="${cols[i % cols.length]}"/>`).join('');
const pins = (colr, step = 7, op = 0.9) => Array.from({ length: Math.ceil(180 / step) }, (_, i) => `<path d="M${CX - 90 + i * step} 90 L${CX - 90 + i * step} 230" stroke="${colr}" stroke-width="0.9" opacity="${op}"/>`).join('');
const band = (y, hgt, colr, op = 1) => `<rect x="${CX - 90}" y="${y}" width="180" height="${hgt}" fill="${colr}" opacity="${op}"/>`;
// a plain shield on the chest (an original shape, not any club's crest)
const shield = (P, x, y, a, b2) => { const d = blob([[x - 5.5, y - 6.5], [x + 5.5, y - 6.5], [x + 5.5, y + 1], [x, y + 7.5], [x - 5.5, y + 1]]); P.shape(d, a, { line: INK, w: 1 }); P.clip(d, `<rect x="${x}" y="${y - 8}" width="7" height="16" fill="${b2}"/>`); P.stroke(d, INK, 1); };
function starAt0h(x, y, r) { return poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; })); }
// original club-style badges: a ring, a striped field, a motif, the city's letters, stars above, a ribbon below.
// o = { shape: roundel|shield|oval, ring, field: [colours], dir: v|h, text, ink, stars, starCol, motif: ball|diamond|sun|disc|cross|band, motifCol, ribbon, ribbonCol }
const crestPath = (shape, x, y, r) => shape === 'shield'
  ? `M${x - r} ${y - r * 0.95} Q${x} ${y - r * 1.15} ${x + r} ${y - r * 0.95} L${x + r} ${y + r * 0.1} Q${x + r * 0.9} ${y + r * 0.85} ${x} ${y + r * 1.25} Q${x - r * 0.9} ${y + r * 0.85} ${x - r} ${y + r * 0.1}Z`
  : shape === 'oval' ? `M${x} ${y - r * 1.15} A${r * 0.85} ${r * 1.15} 0 1 1 ${x - 0.01} ${y - r * 1.15}Z`
  : `M${x} ${y - r} A${r} ${r} 0 1 1 ${x - 0.01} ${y - r}Z`;
const crest = (P, x, y, r, o) => {
  const out = crestPath(o.shape || 'roundel', x, y, r), inn = crestPath(o.shape || 'roundel', x, y + (o.shape === 'shield' ? r * 0.05 : 0), r * 0.74);
  P.shape(out, o.ring, { line: INK, w: 1.2 });
  const f = o.field || [o.ring], n = o.n || f.length * 2, w2 = (r * 2) / n;
  P.fill(inn, f[0]);
  let art = '';
  if (f.length > 1) art += Array.from({ length: n }, (_, i) => o.dir === 'h' ? `<rect x="${x - r}" y="${y - r * 1.2 + i * (r * 2.4) / n}" width="${r * 2}" height="${(r * 2.4) / n + 0.1}" fill="${f[i % f.length]}"/>` : `<rect x="${x - r + i * w2}" y="${y - r * 1.4}" width="${w2 + 0.1}" height="${r * 2.8}" fill="${f[i % f.length]}"/>`).join('');
  const mc = o.motifCol || '#F4F1EA';
  if (o.motif === 'ball') art += `<circle cx="${x}" cy="${y}" r="${r * 0.36}" fill="#F4F1EA" stroke="${INK}" stroke-width="0.7"/><path d="${poly(Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI * 0.4; return [x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15]; }))}" fill="${INK}"/>`;
  if (o.motif === 'diamond') art += `<path d="${poly([[x, y - r * 0.55], [x + r * 0.7, y], [x, y + r * 0.55], [x - r * 0.7, y]])}" fill="${mc}"/><circle cx="${x}" cy="${y}" r="${r * 0.26}" fill="${o.motifCol2 || '#1F4CA8'}"/>`;
  if (o.motif === 'sun') art += `<circle cx="${x}" cy="${y}" r="${r * 0.26}" fill="#F2C230" stroke="#B88A10" stroke-width="0.5"/>` + Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="M${x + Math.cos(a) * r * 0.3} ${y + Math.sin(a) * r * 0.3} L${x + Math.cos(a) * r * 0.45} ${y + Math.sin(a) * r * 0.45}" stroke="#F2C230" stroke-width="0.8"/>`; }).join('');
  if (o.motif === 'disc') art += `<circle cx="${x}" cy="${y}" r="${r * 0.34}" fill="${mc}"/>`;
  if (o.motif === 'cross') art += `<rect x="${x - r * 0.12}" y="${y - r}" width="${r * 0.24}" height="${r * 2}" fill="${mc}"/><rect x="${x - r}" y="${y - r * 0.12}" width="${r * 2}" height="${r * 0.24}" fill="${mc}"/>`;
  const sym = o.symbol, sc = o.symbolCol || '#F4F1EA', k = r * 0.66;
  if (sym === 'leaf') { const L = [[0, -1], [0.18, -0.62], [0.42, -0.72], [0.36, -0.32], [0.78, -0.42], [0.66, -0.12], [0.9, 0.02], [0.5, 0.22], [0.56, 0.42], [0.12, 0.32], [0.08, 0.62], [0.04, 0.95], [-0.04, 0.95], [-0.08, 0.62], [-0.12, 0.32], [-0.56, 0.42], [-0.5, 0.22], [-0.9, 0.02], [-0.66, -0.12], [-0.78, -0.42], [-0.36, -0.32], [-0.42, -0.72], [-0.18, -0.62]].map(([a, b]) => [x + a * k, y + b * k]); art += `<path d="${poly(L)}" fill="${sc}" stroke="${INK}" stroke-width="0.5"/><path d="M${x} ${y + k * 0.9} L${x} ${y - k * 0.5} M${x} ${y + k * 0.1} L${x + k * 0.5} ${y - k * 0.25} M${x} ${y + k * 0.1} L${x - k * 0.5} ${y - k * 0.25}" stroke="${o.field ? o.field[0] : INK}" stroke-width="0.6" opacity="0.7"/>`; }
  if (sym === 'sabres') [-1, 1].forEach((d) => { art += `<path d="M${x - d * k * 0.85} ${y + k * 0.85} Q${x - d * k * 0.1} ${y} ${x + d * k * 0.8} ${y - k * 0.9}" fill="none" stroke="${sc}" stroke-width="${(r * 0.16).toFixed(2)}" stroke-linecap="round"/><path d="M${x - d * k * 0.95} ${y + k * 0.55} L${x - d * k * 0.5} ${y + k * 0.98}" stroke="${o.symbolCol2 || '#F2C230'}" stroke-width="${(r * 0.14).toFixed(2)}" stroke-linecap="round"/>`; });
  if (sym === 'whale') art += `<path d="M${x - k * 0.95} ${y + k * 0.2} Q${x - k * 0.7} ${y - k * 0.55} ${x + k * 0.1} ${y - k * 0.45} Q${x + k * 0.7} ${y - k * 0.35} ${x + k * 0.75} ${y + k * 0.05} L${x + k * 1.05} ${y - k * 0.35} L${x + k * 0.95} ${y + k * 0.15} L${x + k * 1.1} ${y + k * 0.45} L${x + k * 0.7} ${y + k * 0.3} Q${x + k * 0.2} ${y + k * 0.6} ${x - k * 0.5} ${y + k * 0.5} Q${x - k * 0.95} ${y + k * 0.45} ${x - k * 0.95} ${y + k * 0.2}Z" fill="${sc}" stroke="${INK}" stroke-width="0.5"/><circle cx="${x - k * 0.55}" cy="${y - k * 0.05}" r="${k * 0.07}" fill="${INK}"/><path d="M${x - k * 0.3} ${y - k * 0.55} q-${k * 0.15} -${k * 0.35} -${k * 0.35} -${k * 0.3} M${x - k * 0.3} ${y - k * 0.55} q${k * 0.15} -${k * 0.35} ${k * 0.35} -${k * 0.3}" fill="none" stroke="${sc}" stroke-width="0.8"/>`;
  if (sym === 'snow') art += Array.from({ length: 3 }, (_, i) => { const a = (i / 3) * Math.PI; const dx = Math.cos(a) * k, dy = Math.sin(a) * k; return `<path d="M${x - dx} ${y - dy} L${x + dx} ${y + dy}" stroke="${sc}" stroke-width="${(r * 0.12).toFixed(2)}" stroke-linecap="round"/>` + [-1, 1].map((e) => `<path d="M${x + e * dx * 0.6 + dy * 0.25} ${y + e * dy * 0.6 - dx * 0.25} L${x + e * dx * 0.78} ${y + e * dy * 0.78} L${x + e * dx * 0.6 - dy * 0.25} ${y + e * dy * 0.6 + dx * 0.25}" fill="none" stroke="${sc}" stroke-width="${(r * 0.08).toFixed(2)}"/>`).join(''); }).join('');
  if (sym === 'star') art += `<path d="${starAt0h(x, y, k * 0.95)}" fill="${sc}" stroke="${INK}" stroke-width="0.5"/>`;
  if (sym === 'tulip') art += `<path d="M${x} ${y + k} L${x} ${y}" stroke="#2E7D32" stroke-width="${(r * 0.1).toFixed(2)}"/><path d="M${x} ${y + k * 0.6} q${k * 0.4} -${k * 0.1} ${k * 0.5} -${k * 0.5}" stroke="#2E7D32" stroke-width="${(r * 0.1).toFixed(2)}" fill="none"/><path d="M${x - k * 0.45} ${y - k * 0.6} L${x - k * 0.2} ${y - k * 0.2} L${x} ${y - k * 0.75} L${x + k * 0.2} ${y - k * 0.2} L${x + k * 0.45} ${y - k * 0.6} Q${x + k * 0.5} ${y + k * 0.15} ${x} ${y + k * 0.1} Q${x - k * 0.5} ${y + k * 0.15} ${x - k * 0.45} ${y - k * 0.6}Z" fill="${sc}" stroke="${INK}" stroke-width="0.5"/>`;
  if (sym === 'rose') art += [0, 72, 144, 216, 288].map((a) => { const t = (a * Math.PI) / 180; return `<circle cx="${x + Math.cos(t) * k * 0.45}" cy="${y + Math.sin(t) * k * 0.45}" r="${k * 0.42}" fill="${sc}" stroke="${INK}" stroke-width="0.4"/>`; }).join('') + `<circle cx="${x}" cy="${y}" r="${k * 0.3}" fill="#F2C230" stroke="${INK}" stroke-width="0.4"/>`;
  if (o.motif === 'band') art += `<rect x="${x - r}" y="${y - r * 0.2}" width="${r * 2}" height="${r * 0.4}" fill="${mc}"/>`;
  if (art) P.clip(inn, art);
  P.stroke(inn, INK, 0.8);
  if (o.text) { const sz = r * (o.text.length > 1 ? 0.62 : 0.95); P.add(`<text x="${x}" y="${y + sz * 0.36}" font-family="Georgia, serif" font-weight="700" font-size="${sz.toFixed(1)}" text-anchor="middle" fill="${o.ink || '#F4F1EA'}" stroke="${INK}" stroke-width="${(r * 0.06).toFixed(2)}" paint-order="stroke">${o.text}</text>`); }
  if (o.stars) for (let i = 0; i < o.stars; i++) { const t = o.stars === 1 ? 0 : (i / (o.stars - 1) - 0.5) * 1.1; P.fill(starAt0h(x + Math.sin(t) * r * 1.25, y - Math.cos(t) * r * 1.25 - r * 0.25, r * 0.2), o.starCol || '#F2C230'); }
  if (o.ribbon) { const rb = poly([[x - r * 1.05, y + r * 0.95], [x + r * 1.05, y + r * 0.95], [x + r * 0.9, y + r * 1.35], [x + r * 1.05, y + r * 1.75], [x - r * 1.05, y + r * 1.75], [x - r * 0.9, y + r * 1.35]]); P.shape(rb, o.ribbonCol || o.ring, { line: INK, w: 0.8 }); P.add(`<text x="${x}" y="${y + r * 1.52}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${(r * 0.5).toFixed(1)}" text-anchor="middle" fill="${o.ribbonInk || '#F4F1EA'}"${o.ribbon.length * r * 0.5 * 0.74 > r * 1.8 ? ` textLength="${(r * 1.8).toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ''}>${o.ribbon}</text>`); }
};
const armholes = (P, c, grow, colr, w = 3) => { const B = c.B; both((s) => P.stroke(curve([[CX + s * (B.nk + 9), 112.5], [CX + s * (B.ch - 4 + grow * 0.5), 128], [CX + s * (B.ch + 1 + grow), 141]]), colr, w)); };

// basketball tanks. o = { main, trim, trim2, ink, out, num, city, pin, side, side2 }
const nbaTank = (o) => top({
  main: () => o.main, sleeve: 'none', shape: 'tank', neck: 'none', grow: 4, hem: 207,
  detail: (P, c, R, d) => {
    const B = c.B;
    if (o.pin) P.clip(d, pins(o.pin));
    if (o.pattern) P.clip(d, o.pattern);
    if (o.side) P.clip(d, [-1, 1].map((sd) => `<path d="${poly([[CX + sd * (B.ch - 1), 138], [CX + sd * (B.ch + 22), 138], [CX + sd * (B.hp + B.be + 22), 212], [CX + sd * (B.wa + B.be + 1), 212]])}" fill="${o.side}"/>`).join(''));
    if (o.side2) both((sd) => P.stroke(curve([[CX + sd * (B.ch - 1), 138], [CX + sd * (B.wa + B.be + 1), 207]]), o.side2, 1.8));
    if (o.city) arch(P, o.city, 152, o.citySize || 10, 46, o.ink, o.out, o.cityFont || o.font, 5);
    digits(P, o.num, CX, 184, 34, o.ink, o.out, o.font, o.skew);
  },
  collar: (P, c) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 2, 112], [CX - nk + 2, 122], [CX, 127], [CX + nk - 2, 122], [CX + nk + 2, 112]]), o.trim, 3.6); if (o.trim2) P.stroke(curve([[CX - nk + 0.6, 114], [CX - nk + 3.6, 121], [CX, 124.4], [CX + nk - 3.6, 121], [CX + nk - 0.6, 114]]), o.trim2, 1.2); armholes(P, c, 4, o.trim, 3.2); },
});
ART.top.rt_la04 = nbaTank({ font: 'tall', cityFont: 'cond', skew: -8, main: '#FDB927', trim: '#552583', trim2: '#F4F1EA', ink: '#552583', out: '#F4F1EA', num: '8', city: 'LOS ANGELES', side: '#552583', side2: '#F4F1EA' });
ART.top.rt_la04p = nbaTank({ font: 'tall', cityFont: 'cond', skew: -8, main: '#552583', trim: '#FDB927', trim2: '#F4F1EA', ink: '#FDB927', out: '#F4F1EA', num: '8', city: 'LOS ANGELES', side: '#FDB927', side2: '#F4F1EA' });
ART.top.rt_chi96 = nbaTank({ font: 'cond', cityFont: 'block', main: '#CE1141', trim: '#16161A', trim2: '#F4F1EA', ink: '#F4F1EA', out: '#16161A', num: '23', city: 'CHICAGO' });
ART.top.rt_tor00 = nbaTank({ font: 'bungee', citySize: 8.5, main: '#4B2A7B', trim: '#16161A', trim2: '#CE1141', ink: '#F4F1EA', out: '#16161A', num: '15', city: 'TORONTO', side: '#CE1141', side2: '#16161A', pin: '#6A4A9A' });
ART.top.rt_cha93 = nbaTank({ font: 'block', main: '#00788C', trim: '#1D1160', trim2: '#F4F1EA', ink: '#F4F1EA', out: '#1D1160', num: '1', city: 'CHARLOTTE', pin: '#E6F2F4' });
ART.top.rt_sea96 = nbaTank({ font: 'racing', main: '#00653A', trim: '#FFC200', trim2: '#C8102E', ink: '#FFC200', out: '#F4F1EA', num: '20', city: 'SEATTLE', side: '#FFC200', side2: '#C8102E' });
ART.top.rt_phx93 = nbaTank({ font: 'fat', skew: -6, main: '#1D1160', trim: '#E56020', trim2: '#F4F1EA', ink: '#E56020', out: '#F4F1EA', num: '13', city: 'PHOENIX', side: '#E56020' });

// football kits. o = { main, collar, cuff, cuff2, stripes, pattern, badge, sleeve, neck }
const kit = (o) => top({
  main: () => o.main, sleeve: o.tank ? 'none' : 'short', shape: o.tank ? 'tank' : undefined, neck: o.tank ? 'none' : (o.neck ?? 'v'), grow: o.grow ?? 6, sgrow: o.sgrow ?? 6.5, hem: 209, ribCol: () => o.collar,
  sleeveCol: o.sleeve ? () => o.sleeve : undefined,
  detail: (P, c, R, d) => {
    if (o.stripes) P.clip(d, vStripes(o.stripes[0], o.stripes[1], o.stripes[2]));
    if (o.pattern) P.clip(d, o.pattern);
    if (o.stripes || o.pattern) P.clip(d, `<path d="${poly([[CX + 22, 90], [CX + 90, 90], [CX + 90, 230], [CX + 26, 230]])}" fill="#000" opacity="0.14"/>`);
    if (o.badge) { if (Array.isArray(o.badge)) shield(P, CX + 16, 140, o.badge[0], o.badge[1]); else crest(P, CX + 11, 143, 6.2, o.badge); }
    if (o.num) digits(P, o.num, CX - 16, 146, 11, o.num[1] || o.collar, INK);
  },
  trim: (P, g, side, yEnd, c) => { const gr = (o.sgrow ?? 6.5) * (c.B.arm * 0.5 + 0.5); if (o.sleeveArt) o.sleeveArt(P, g, side, yEnd, gr); across(P, g, side, yEnd - 0.02, gr, o.cuff || o.collar, 3.2); if (o.cuff2) across(P, g, side, yEnd - 0.07, gr, o.cuff2, 1.4); },
  collar: o.tank ? (P, c) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 2, 112], [CX - nk + 2, 122], [CX, 127], [CX + nk - 2, 122], [CX + nk + 2, 112]]), o.collar, 3.4); armholes(P, c, 6, o.cuff || o.collar, 3); } : undefined,
});
ART.top.rt_blau = kit({ main: '#1A3C8C', stripes: [['#1A3C8C', '#9B1B30'], 15, CX - 97], collar: '#F2C230', cuff: '#F2C230', badge: { shape: 'roundel', ring: '#F2C230', field: ['#1A3C8C', '#9B1B30'], n: 5, motif: 'ball' }, grow: 8, sgrow: 8 });
ART.top.rt_bra02 = kit({ main: '#F9D616', collar: '#0A7A3C', cuff: '#0A7A3C', cuff2: '#1F4CA8', badge: { shape: 'shield', ring: '#1F4CA8', field: ['#0A7A3C'], motif: 'diamond', motifCol: '#F9D616', stars: 5, starCol: '#0A7A3C' }, neck: 'crew' });
ART.top.rt_mil94 = kit({ main: '#16161A', stripes: [['#C8102E', '#16161A'], 10, CX - 95], collar: '#F4F1EA', cuff: '#F4F1EA', badge: { shape: 'oval', ring: '#16161A', field: ['#C8102E', '#16161A'], n: 6, symbol: 'star', symbolCol: '#F4F1EA' } });
ART.top.rt_arg86 = kit({ main: '#F4F1EA', stripes: [['#74ACDF', '#F4F1EA'], 9, CX - 94.5], collar: '#1C2A55', cuff: '#1C2A55', badge: { shape: 'roundel', ring: '#1C2A55', field: ['#74ACDF', '#F4F1EA', '#74ACDF'], dir: 'h', n: 3, motif: 'sun', stars: 2 }, neck: 'crew' });
ART.top.rt_ned88 = kit({ main: '#F36C21', pattern: Array.from({ length: 9 }, (_, i) => `<path d="M${CX - 90 + i * 22} 230 L${CX - 79 + i * 22} 90 L${CX - 68 + i * 22} 230Z" fill="#FFB06B" opacity="0.6"/><path d="M${CX - 79 + i * 22} 90 L${CX - 68 + i * 22} 230 L${CX - 57 + i * 22} 90Z" fill="#C9480F" opacity="0.5"/>`).join(''), collar: '#F4F1EA', cuff: '#F4F1EA', cuff2: '#F36C21', badge: { shape: 'shield', ring: '#1C2A55', field: ['#F36C21'], symbol: 'tulip', symbolCol: '#F36C21' } });

// gridiron jersey: big shoulders, sleeve stripes, block numbers
ART.top.rt_whiteout = top({
  main: () => '#F4F4F2', sleeve: 'short', neck: 'v', grow: 7, sgrow: 10, hem: 209, ribCol: () => '#00338D',
  detail: (P) => digits(P, '17', CX, 186, 38, '#C60C30', '#00338D', 'cond'),
  trim: (P, g, side, yEnd, c) => { const gr = 10 * (c.B.arm * 0.5 + 0.5); across(P, g, side, yEnd - 0.05, gr, '#00338D', 3.4); across(P, g, side, yEnd - 0.11, gr, '#C60C30', 2.6); across(P, g, side, yEnd - 0.165, gr, '#00338D', 3.4); },
});

// hockey sweaters: long sleeves with arm stripes, hem stripes, laced collar
const sweater = (o) => top({
  main: () => o.main, sleeve: 'long', neck: 'v', grow: 8, sgrow: 7.5, hem: 212, ribCol: () => o.collar, cuffCol: () => o.main,
  detail: (P, c, R, d) => {
    P.clip(d, o.chest ? band(150, 12, o.chest) + band(150, 1.8, o.stripe) + band(160.2, 1.8, o.stripe) : '');
    P.clip(d, band(190, 6, o.stripe) + (o.hem2 ? band(197, 3, o.hem2) : ''));
    [118, 124, 130].forEach((y) => P.stroke(curve([[CX - 3, y], [CX + 3, y + 3]]), o.stripe, 1.1));
    if (o.num) digits(P, o.num, CX, 180, 20, o.stripe, INK, 'block');
    if (o.crest) crest(P, CX, 170, 14, o.crest);
  },
  trim: (P, g, side, yEnd, c) => { const gr = 7.5 * (c.B.arm * 0.5 + 0.5); across(P, g, side, 0.6, gr, o.stripe, 4.2); if (o.hem2) across(P, g, side, 0.66, gr, o.hem2, 2.2); },
});
ART.top.rt_tor67 = sweater({ main: '#00205B', collar: '#F4F1EA', stripe: '#F4F1EA', crest: { shape: 'roundel', ring: '#00205B', field: ['#F4F1EA'], stars: 3, starCol: '#F4F1EA', symbol: 'leaf', symbolCol: '#00205B' } });
ART.top.rt_mtl = sweater({ main: '#AF1E2D', collar: '#192168', stripe: '#F4F1EA', chest: '#192168', hem2: '#192168', crest: { shape: 'roundel', ring: '#192168', field: ['#AF1E2D'], symbol: 'star', symbolCol: '#F4F1EA' } });

// baseball button-up with piping
ART.top.rt_tor93 = top({
  main: () => '#8EB8E5', sleeve: 'short', neck: 'v', rib: false, grow: 5, sgrow: 6, hem: 209,
  collar: (P, c) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 3.5, 112.5], [CX - nk * 0.4, 124], [CX, 138], [CX + nk * 0.4, 124], [CX + nk + 3.5, 112.5]]), '#13274F', 2.4); },
  detail: (P) => { P.stroke(curve([[CX + 1.5, 138], [CX + 1.5, 207]]), '#13274F', 2); P.stroke(curve([[CX + 3.5, 138], [CX + 3.5, 207]]), '#E8291C', 1); [146, 160, 174, 188, 202].forEach((y) => P.dot(CX - 2, y, 1.4, '#F4F1EA')); arch(P, 'TORONTO', 160, 10, 50, '#13274F', '#E8291C', 'block', 4); },
  trim: (P, g, side, yEnd, c) => { const gr = 6 * (c.B.arm * 0.5 + 0.5); across(P, g, side, yEnd - 0.02, gr, '#13274F', 2.2); across(P, g, side, yEnd - 0.05, gr, '#E8291C', 1.2); },
});

// luxury court shorts: long mesh, a wide side panel with piping, a thick gold waistband
const lux = (main, side, pipe) => pants({ one: true, main: () => main, end: 268, grow: 13, bag: { hem: 1.14, out: 3 }, fly: false, band: () => '#C9A23A',
  legDetail: (P, g, sd, J, c, R) => {
    for (let k = 0; k < 40; k++) { const j = J[1 + (k % (J.length - 2))]; P.dot(j[0] + ((k * 7) % 13 - 6) * j[2] / 16, j[1] + ((k * 5) % 9 - 4), 0.5, R.deep, 0.5); }
    P.stroke(curve(J.map(([x, y, w]) => [x + sd * (w / 2 - 4.5), y])), side, 9);
    P.stroke(curve(J.map(([x, y, w]) => [x + sd * (w / 2 - 9.6), y])), pipe, 1.4);
    P.stroke(curve(J.map(([x, y, w]) => [x + sd * (w / 2 - 1), y])), pipe, 1.2);
    hemLine(P, J, R);
  },
  detail: (P, c, R, m, w) => { for (let x = CX - w + 3; x < CX + w - 3; x += 4) P.stroke(`M${x} 192.6 l2 1.8 l2 -1.8`, '#7A5E14', 0.8, 0.9); P.ell(CX, 194, 3.4, 2.2, '#16161A', { line: '#7A5E14', w: 0.8 }); },
});
ART.bottom.rt_lux_chi = lux('#CE1141', '#16161A', '#F4F1EA');
ART.bottom.rt_lux_la = lux('#552583', '#FDB927', '#F4F1EA');
ART.bottom.rt_lux_bos = lux('#007A33', '#F4F1EA', '#BA9653');
ART.bottom.rt_lux_cha = lux('#00788C', '#1D1160', '#F4F1EA');
const kitShorts = (main, stripe) => pants({ one: true, main: () => main, end: 252, grow: 9, bag: { hem: 1.08, out: 2 }, fly: false, band: () => main, legDetail: (P, g, sd, J, c, R) => { P.stroke(curve(J.map(([x, y, w]) => [x + sd * (w / 2 - 2.5), y])), stripe, 2.2); hemLine(P, J, R); } });
ART.bottom.rt_blau_sh = kitShorts('#1A2A5C', '#F2C230');
ART.bottom.rt_bra_sh = kitShorts('#1F4CA8', '#F4F1EA');
ART.bottom.rt_tear = pants({ main: () => '#16161A', grow: 6, straight: 0.95, fly: false, band: () => '#16161A', legDetail: (P, g, sd, J, c, R) => {
  [-6.8, -4.4, -2].forEach((o) => P.stroke(curve(J.map(([x, y, w]) => [x + sd * (w / 2 + o), y])), '#F4F1EA', 1.2));
  J.slice(1).forEach(([x, y, w]) => P.dot(x + sd * (w / 2 - 4.4), y, 1.3, SILVER));
} });

// retro hats
ART.hat.rt_cap_chi = capOf({ main: () => '#CE1141', bill: () => '#16161A', flat: true, logo: (P) => word(P, 'CHI', 37, 13, 30, '#F4F1EA', '#16161A', 1.4) });
ART.hat.rt_cap_tor = capOf({ main: () => '#134A8E', bill: () => '#134A8E', logo: (P) => { word(P, 'T', 36, 17, 14, '#F4F1EA', '#E8291C', 1.6, 'Georgia, serif'); P.ell(100, 9, 2.6, 1.8, '#E8291C'); } });
const bucketOf = (crown, brim, stitch) => (P, g, col, ph) => { if (ph !== 'head') return; const R = ramp(crown), R2 = ramp(brim); P.part(blob([[68, 44], [70, 22], [84, 10], [100, 8], [116, 10], [130, 22], [132, 44]]), R, { shade: [[poly([[112, 0], [150, 0], [150, 60], [116, 60]]), R.sh]] }); P.part(blob([[54, 52], [62, 40], [100, 37], [138, 40], [146, 52], [140, 58], [100, 56], [60, 58]]), R2, { shade: [[poly([[112, 30], [160, 30], [160, 70], [116, 70]]), R2.sh]] }); [[[62, 49], [100, 45.5], [138, 49]], [[60, 53], [100, 50], [140, 53]]].forEach((s2) => P.stroke(curve(s2), stitch, 0.9, 0.9)); P.stroke(curve([[68, 42], [100, 39.5], [132, 42]]), stitch, 1.2); };
ART.hat.rt_bucket = bucketOf('#00788C', '#1D1160', '#F4F1EA');
ART.hat.rt_beanie = (P, g, col, ph) => {
  if (ph !== 'head') return;
  const R = ramp('#16161A'), d = blob([[63, 46], [63, 28], [72, 12], [88, 3], [100, 1.5], [112, 3], [128, 12], [137, 28], [137, 46]]);
  P.part(d, R, { shade: [[poly([[112, -10], [150, -10], [150, 60], [116, 60]]), R.sh]] });
  P.clip(d, band(16, 5, '#E8B93A') + band(24, 3, '#F4F1EA'));
  for (let x = 72; x <= 128; x += 7) P.stroke(curve([[x, 10 + Math.abs(x - 100) * 0.3], [x + (x - 100) * 0.04, 34]]), R.deep, 1.1, 0.6);
  P.part(blob([[62, 50], [62, 36], [100, 33], [138, 36], [138, 50], [100, 53]]), ramp('#E8B93A'), { shade: [[poly([[114, 20], [150, 20], [150, 60], [118, 60]]), dk('#E8B93A', 0.2)]] });
  P.ell(100, -2, 8, 7, '#16161A', { line: '#000' }); P.ell(97, -4, 3, 2, '#E8B93A', { op: 0.7 });
};

// retro jackets
const satin = (main, rib, o = {}) => outer({ main: () => main, closed: true, len: 210, grow: 9, sgrow: 8.5, collar: ribCollar(() => rib), cuff: () => rib,
  detail: (P, c, R, d, m, B, grow, hemY) => {
    if (o.yoke) P.clip(d, band(100, 36, o.yoke) + band(136, 2.4, '#F4F1EA'));
    P.clip(d, `<path d="${curve([[CX - 34, 150], [CX - 22, 132], [CX - 12, 128]])}" stroke="${lt(main, 0.45)}" stroke-width="5" fill="none" opacity="0.45" stroke-linecap="round"/><path d="${curve([[CX - 30, 190], [CX - 20, 170]])}" stroke="${lt(main, 0.4)}" stroke-width="4" fill="none" opacity="0.35" stroke-linecap="round"/>`);
    [164, 178, 192].forEach((y) => P.dot(CX, y, 1.8, SILVER));
    hem(P, B, grow, hemY, ramp(rib)); P.clip(d, band(hemY - 4.5, 1.2, '#F4F1EA'));
    if (o.text) word(P, o.text, 152, o.size || 13, 40, '#F4F1EA', o.textLine || INK, 1.4, o.font || 'Arial Black, Arial, sans-serif', CX);
  } });
ART.outer.rt_satin_chi = satin('#C8102E', '#16161A', { text: 'CHICAGO', size: 9, font: 'block' });
ART.outer.rt_satin_la = satin('#005A9C', '#F4F1EA', { text: 'Los Angeles', font: 'script', size: 14, textLine: '#C8102E' });
ART.outer.rt_halfzip = outer({ main: () => '#00788C', closed: true, len: 210, grow: 9, sgrow: 8, sleeveCol: () => '#00788C', cuff: () => '#1D1160',
  collar: (P, c) => { const nk = c.B.nk; P.shape(poly([[CX - nk - 4, 101], [CX + nk + 4, 101], [CX + nk + 6, 115], [CX - nk - 6, 115]]), '#1D1160', { line: INK }); },
  detail: (P, c, R, d, m, B, grow, hemY) => {
    P.clip(d, `<path d="${poly([[CX - 90, 118], [CX + 90, 150], [CX + 90, 172], [CX - 90, 140]])}" fill="#1D1160"/><path d="${poly([[CX - 90, 140], [CX + 90, 172], [CX + 90, 176], [CX - 90, 144]])}" fill="#F4F1EA"/><path d="${poly([[CX - 90, 144], [CX + 90, 176], [CX + 90, 186], [CX - 90, 154]])}" fill="#B23F7F"/>`);
    zip(104, 150)(P); hem(P, B, grow, hemY, ramp('#1D1160'));
  } });

/* ---------- designer print jeans */
const rnd = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const printJeans = (def, draw, o = {}) => pants({ def, grow: o.grow ?? 8, bag: { hem: 1.08, out: 2.5 }, end: o.end ?? 308, legDetail: (P, g, sd, J, c, R) => { draw(P, J, sd, R); hemLine(P, J, R); }, detail: pocketsJ });
const onLeg = (J, t, u) => { const i = Math.min(J.length - 2, Math.floor(t * (J.length - 1))), f = t * (J.length - 1) - i, a = J[i], b = J[i + 1]; const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, w = a[2] + (b[2] - a[2]) * f; return [x + u * w / 2, y, w]; };
// gothic leather patches with silver stitching (an original quatrefoil-and-dagger design)
const gothic = (P, x, y, s) => { const d = `M${x} ${y - 7 * s} Q${x + 2.4 * s} ${y - 2.4 * s} ${x + 7 * s} ${y} Q${x + 2.4 * s} ${y + 2.4 * s} ${x} ${y + 9 * s} Q${x - 2.4 * s} ${y + 2.4 * s} ${x - 7 * s} ${y} Q${x - 2.4 * s} ${y - 2.4 * s} ${x} ${y - 7 * s}Z`; P.shape(d, '#0C0C0F', { line: '#000', w: 1.1 }); P.add(`<path d="${d}" fill="none" stroke="${SILVER}" stroke-width="0.8" stroke-dasharray="1.4 1" transform="translate(${x} ${y}) scale(0.78) translate(${-x} ${-y})"/>`); P.dot(x, y, 1.1, SILVER); };
ART.bottom.dz_gothic = printJeans('#3A3C44', (P, J, sd) => { [[0.2, -0.15, 1.6], [0.48, 0.2, 1.35], [0.74, -0.1, 1.5], [0.34, 0.45, 0.9], [0.62, -0.5, 0.9]].forEach(([t, u, s]) => { const [x, y] = onLeg(J, t, u * sd); gothic(P, x, y, s); }); });
ART.bottom.dz_graffiti = printJeans('#8DAED6', (P, J, sd) => {
  const r = rnd(sd > 0 ? 11 : 29), cols = ['#E8463A', '#2E6FD0', '#F2C230', '#1B9E5A', '#16161A', '#D84FB0'];
  for (let k = 0; k < 9; k++) { const [x, y, w] = onLeg(J, 0.1 + r() * 0.8, (r() - 0.5) * 1.4); const pts = Array.from({ length: 4 }, (_, i) => [x + (i - 1.5) * w * 0.12, y + (r() - 0.5) * 8]); P.stroke(curve(pts), cols[k % cols.length], 1.6 + r()); }
  for (let k = 0; k < 4; k++) { const [x, y] = onLeg(J, 0.15 + r() * 0.7, (r() - 0.5)); P.stroke(`M${x} ${y} l0 ${5 + r() * 6}`, cols[(k + 2) % cols.length], 1.2); }
});
ART.bottom.dz_bandana = printJeans('#22324F', (P, J, sd) => {
  for (let t = 0.06; t < 0.98; t += 0.09) for (let u = -0.8; u <= 0.81; u += 0.4) { const [x, y] = onLeg(J, t, u * sd + (Math.round(t * 11) % 2) * 0.2); const k = Math.round((t * 11 + u * 5)) % 3; if (k === 0) P.add(`<path d="M${x} ${y - 2.8} q2.6 2.2 0 4.6 q-2.2 -1.6 0 -4.6Z" fill="#F4F1EA" opacity="0.9"/>`); else if (k === 1) P.dot(x, y, 1, '#F4F1EA', 0.85); else P.ell(x, y, 1.6, 1.6, 'none', { line: '#F4F1EA', w: 0.7 }); }
});
const starAt0 = (x, y, r) => poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; }));
ART.bottom.dz_stars = printJeans('#2A2B30', (P, J, sd) => { [[0.18, 0.1, 6], [0.42, -0.3, 4.5], [0.62, 0.3, 5.5], [0.84, -0.1, 4]].forEach(([t, u, r]) => { const [x, y] = onLeg(J, t, u * sd); P.fill(starAt0(x, y, r), '#F4F1EA', 0.92); }); });
ART.bottom.dz_splatter = printJeans('#7FA0C9', (P, J, sd) => {
  const r = rnd(sd > 0 ? 5 : 17), cols = ['#F4F1EA', '#16161A', '#E8463A'];
  for (let k = 0; k < 7; k++) { const [x, y] = onLeg(J, 0.08 + r() * 0.85, (r() - 0.5) * 1.5), c2 = cols[k % 3], s = 2.5 + r() * 3; P.fill(blob(Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2; const rr = s * (0.7 + r() * 0.6); return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; })), c2, 0.9); for (let q = 0; q < 3; q++) P.dot(x + (r() - 0.5) * 12, y + (r() - 0.5) * 10, 0.6 + r() * 0.8, c2, 0.9); }
}, { grow: 6 });

/* ---------- streetwear basics */
const contrast = (m) => (rgbL(m) > 0.55 ? '#1F2A44' : '#F2EFE6');
ART.top.lstee = top({ def: '#ECEBE7', sleeve: 'long' });
ART.top.ringer = top({ def: '#F2EFE6', sleeve: 'short', ribCol: (p, m) => contrast(m), trim: (P, g, side, yEnd, c, R, m) => across(P, g, side, yEnd - 0.02, 4 * (c.B.arm * 0.5 + 0.5), contrast(m), 3) });
ART.top.stripetee = top({ def: '#1F2A44', sleeve: 'short', detail: (P, c, R, d, m) => P.clip(d, hStripes([m, contrast(m)], 6, 116)) });
ART.top.henley = top({ def: '#B9AC92', sleeve: 'long', detail: (P, c, R) => { P.stroke(curve([[CX - 2, 119], [CX - 2, 140]]), R.line, 1.1, 0.8); P.stroke(curve([[CX + 2, 119], [CX + 2, 140]]), R.line, 1.1, 0.8); [124, 130, 136].forEach((y) => P.dot(CX, y, 1.3, dk(R.base, 0.3))); } });
ART.top.crewsweat = top({ def: '#8E9196', sleeve: 'long', grow: 5, sgrow: 6, hem: 205, detail: (P, c, R) => { hem(P, c.B, 5, 205, R); P.fill(poly([[CX - 3, 121], [CX + 3, 121], [CX, 127]]), R.sh); } });

/* ---------- open jackets: worn open so the top underneath shows */
const openGap = (y) => (y < 150 ? 10 + (150 - y) * 0.24 : 10 + (y - 150) * 0.12);
const edges = (P, col, w, y0 = 116, y1 = 206, off = 0) => both((s) => P.stroke(curve(Array.from({ length: 6 }, (_, i) => { const y = y0 + ((y1 - y0) * i) / 5; return [CX + s * (openGap(y) + off), y]; })), col, w));
const campCollar = (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 2), 106], [CX + s * (nk + 13), 114], [CX + s * (openGap(130) + 6), 134], [CX + s * (openGap(126) + 0.5), 126]]), lt(main, 0.05), { line: R.line, w: 1.4 })); };
ART.outer.campshirt = outer({ def: '#E9E2D0', sleeve: 'short', len: 212, grow: 6, sgrow: 7.5, gap: openGap, collar: campCollar, detail: (P, c, R) => { [146, 166, 186].forEach((y) => P.dot(CX - openGap(y) - 3, y, 1.4, dk(R.base, 0.3))); } });
ART.outer.overshirt = outer({ def: '#5B6440', len: 214, grow: 6, sgrow: 6.5, gap: openGap, collar: shirtCollar, detail: (P, c, R) => { both((s) => { const x = CX + s * 24; P.shape(poly([[x - 7, 140], [x + 7, 140], [x + 7, 154], [x - 7, 154]]), R.base, { line: R.line, w: 1.2 }); P.stroke(curve([[x - 7, 144], [x + 7, 144]]), R.line, 1); }); [146, 166, 186].forEach((y) => P.dot(CX - openGap(y) - 3, y, 1.4, dk(R.base, 0.35))); } });
ART.outer.zipopen = outer({ def: '#3A3D44', len: 210, grow: 6, sgrow: 6.5, gap: openGap, collar: (P, c, R) => hood(P, c, R), cuff: (p, m) => dk(m, 0.12), detail: (P, c, R, d, m, B, grow, hemY) => { edges(P, INK, 2.2, 118, hemY - 4, 0.6); edges(P, SILVER, 0.9, 118, hemY - 4, 0.6); both((s) => P.stroke(curve([[CX + s * 26, 178], [CX + s * 20, 196]]), R.line, 1.2, 0.8)); } });
ART.outer.chore = outer({ def: '#2E4A6E', len: 222, grow: 7, sgrow: 7, gap: openGap, collar: shirtCollar, detail: (P, c, R) => { both((s) => { const x = CX + s * 26; P.shape(poly([[x - 9, 182], [x + 9, 182], [x + 9, 200], [x - 9, 200]]), R.base, { line: R.line, w: 1.2 }); }); const x = CX + 24; P.shape(poly([[x - 6, 140], [x + 6, 140], [x + 6, 152], [x - 6, 152]]), R.base, { line: R.line, w: 1.1 }); edges(P, dk(R.base, 0.2), 1, 116, 216, 2.4); } });
ART.outer.cardigan = outer({ def: '#6B1E2A', len: 214, grow: 6, sgrow: 6.5, gap: openGap, cuff: (p, m) => dk(m, 0.12), detail: (P, c, R, d, m, B, grow, hemY) => { edges(P, R.line, 5.4, 112, hemY - 1, 1.6); edges(P, dk(m, 0.12), 3.6, 112, hemY - 1, 1.6); [150, 168, 186].forEach((y) => P.dot(CX - openGap(y) - 1.6, y, 1.7, '#E9E2D0')); hem(P, B, grow, hemY, ramp(dk(m, 0.12))); } });

/* ---------- team sleeves and calf bands (team colours) */
const sidesOf = (c) => (c.side === 'left' ? [-1] : c.side === 'right' ? [1] : [-1, 1]);
const sleeveTube = (P, J, c, o = {}) => { const T = tube(J); P.tube(T, ramp(c.pal.t1), { cap0: false, cap1: false }); return T; };
/* arm sleeves are defined with the armPiece factory further down */
const legPiece = (y0, y1, stripes) => (P, g, col, ph, c) => {
  if (ph !== 'legs') return;
  for (const side of sidesOf(c)) {
    const J = cutJ(g.legJ(side), y1, 0.8, y0);
    sleeveTube(P, J, c);
    stripes.forEach(([y, colr, w]) => { const j = J.find((q) => q[1] >= y) || J[J.length - 1]; P.stroke(curve([[j[0] - j[2] / 2 + 0.6, y], [j[0] + j[2] / 2 - 0.6, y]]), c.pal[colr], w); });
  }
};
ART.legwear.legsleeve = legPiece(212, 300, [[290, 't2', 2.6], [294, 'tacc', 1.1]]);
ART.legwear.kneesleeve = legPiece(246, 288, [[250, 't2', 2.4], [283, 't2', 2.4]]);
ART.legwear.calfbands = legPiece(266, 277, [[270, 't2', 1.6], [273.4, 'tacc', 1.1]]);

/* ---------- more sleeves: both arms, full shoulder-to-wrist, and fixed-colour casual bands */
const armPiece = (f0, f1, pick, o = {}) => (P, g, col, ph, c) => {
  const k = pick(c);
  if (ph === 'neck' && o.collar) { const nk = c.B.nk; P.stroke(curve([[CX - nk - 3.5, 109], [CX, 122.5], [CX + nk + 3.5, 109]]), INK, 5.2); P.stroke(curve([[CX - nk - 3.5, 109], [CX, 122.5], [CX + nk + 3.5, 109]]), k.main, 3.4); return; }
  if (ph !== 'arms') return;
  for (const side of sidesOf(c)) {
    let J = cutF(g.armJ(side), f0, f1, 0.8);
    // a full sleeve starts at the neck, so it also covers the shoulder
    if (f0 < 0.05) { const a = J[0], b = J[1]; J = [[a[0] - side * 4.5, a[1] - 15, a[2] * 0.96], [a[0] - side * 2, a[1] - 7, a[2] * 1.02], ...J]; }
    P.tube(tube(J), ramp(k.main), { cap0: true, cap1: false });
    if (f0 >= 0.05) across(P, g, side, f0 + 0.06, 0.8, k.trim, 2.2);
    across(P, g, side, f1 - 0.05, 0.8, k.trim, 2.2);
    if (k.acc) across(P, g, side, f1 - 0.09, 0.8, k.acc, 1);
    if (k.mark) { const j = J[Math.min(2, J.length - 1)]; P.dot(j[0], j[1] + 2, 1.7, k.mark); }
  }
};
const legPieceC = (y0, y1, pick) => (P, g, col, ph, c) => {
  if (ph !== 'legs') return;
  const k = pick(c);
  for (const side of sidesOf(c)) {
    const J = cutJ(g.legJ(side), y1, 0.8, y0);
    P.tube(tube(J), ramp(k.main), { cap0: false, cap1: false });
    const band = (y, colr, w) => { const j = J.find((q) => q[1] >= y) || J[J.length - 1]; P.stroke(curve([[j[0] - j[2] / 2 + 0.6, y], [j[0] + j[2] / 2 - 0.6, y]]), colr, w); };
    band(y0 + 4, k.trim, 1.8); band(y0 + 7.4, k.acc || k.trim, 1);
    if (k.mark) { const j = J[Math.floor(J.length / 2)]; P.dot(j[0], (y0 + y1) / 2 + 1, 1.8, k.mark); }
  }
};
const team = (c) => ({ main: c.pal.t1, trim: c.pal.t2, acc: c.pal.tacc });
const fix = (main, trim, acc, mark) => () => ({ main, trim, acc, mark });
ART.armwear.armsleeve = armPiece(0.1, 0.96, team);
ART.armwear.shooter = armPiece(0.5, 0.96, team);
ART.armwear.fullsleeve = armPiece(0.02, 0.97, team);
ART.armwear.fsblack = armPiece(0.02, 0.97, fix('#16181D', '#F2F2F2', null, '#F2F2F2'));
ART.armwear.fswhite = armPiece(0.02, 0.97, fix('#F1F1EE', '#16181D', null, '#16181D'));
ART.armwear.fsbred = armPiece(0.02, 0.97, fix('#16181D', '#C8102E', '#F2F2F2', '#C8102E'));
ART.armwear.fsroyal = armPiece(0.02, 0.97, fix('#1D428A', '#FFC72C', null, '#FFC72C'));
ART.armwear.elbowblack = armPiece(0.35, 0.8, fix('#16181D', '#F2F2F2', null, null));
ART.legwear.fullleg = legPieceC(212, 300, team);
ART.legwear.bredcalf = legPieceC(266, 277, fix('#16181D', '#C8102E', '#F2F2F2', '#C8102E'));
ART.legwear.whitecalf = legPieceC(266, 277, fix('#F1F1EE', '#16181D', null, '#16181D'));
ART.legwear.royalcalf = legPieceC(266, 277, fix('#1D428A', '#FFC72C', null, '#FFC72C'));
ART.legwear.blackcalf = legPieceC(262, 279, fix('#16181D', '#F2F2F2', null, '#F2F2F2'));
ART.legwear.blackleg = legPieceC(212, 300, fix('#16181D', '#F2F2F2', null, '#F2F2F2'));

/* ---------- retros, second drop: more niche, closer to the real thing */
const W2 = '#F4F1EA';
// zigzag band across the chest
const zigBand = (y, hgt, cols, step = 12) => cols.map((colr, k) => `<path d="${Array.from({ length: Math.ceil(180 / step) + 1 }, (_, i) => `${i ? 'L' : 'M'}${CX - 90 + i * step} ${y + k * hgt + (i % 2 ? hgt : 0)}`).join(' ')} L${CX + 90} ${y + (k + 1) * hgt + 30} L${CX - 90} ${y + (k + 1) * hgt + 30}Z" fill="${colr}"/>`).join('');
// sleeve art drawn on the short sleeve, just above its cuff
const sleeveFlames = (cols) => (P, g, side, yEnd, gr) => { const J = cutF(g.armJ(side), 0, yEnd, gr); const [x, y, w] = J[J.length - 1]; for (let k = 0; k < 4; k++) { const fx = x - w / 2 + 2 + k * (w - 4) / 3; P.fill(poly([[fx - 3, y - 1], [fx + 3, y - 1], [fx + 0.5, y - 10 - (k % 2) * 4]]), cols[k % cols.length]); } };
const sleeveChevrons = (a, b) => (P, g, side, yEnd, gr) => { const J = cutF(g.armJ(side), 0, yEnd, gr); const [x, y, w] = J[J.length - 1]; for (let k = 0; k < 3; k++) P.stroke(`M${x - w / 2 + 1.5} ${y - 4 - k * 5} L${x} ${y - 8 - k * 5} L${x + w / 2 - 1.5} ${y - 4 - k * 5}`, k % 2 ? b : a, 2.2); };

ART.top.rt_ita06 = kit({ main: '#1F4E9C', pattern: vStripes(['#1F4E9C', '#1B4690'], 6, CX - 93), collar: W2, cuff: '#C9A23A', cuff2: W2, badge: { shape: 'shield', ring: '#C9A23A', field: ['#009246', '#F4F1EA', '#CE2B37'], n: 3, stars: 4 }, neck: 'v' });
ART.top.rt_ger90 = kit({ main: W2, pattern: zigBand(134, 4, ['#16161A', '#D21034', '#F2C230', W2]), collar: '#16161A', cuff: '#16161A', cuff2: '#D21034', badge: { shape: 'roundel', ring: '#16161A', field: ['#16161A', '#D21034', '#F2C230'], dir: 'h', n: 3, stars: 3, symbol: 'star', symbolCol: '#F2C230' }, neck: 'crew' });
ART.top.rt_fra98 = kit({ main: '#1D2D5C', pattern: band(146, 3, W2) + band(149, 3, '#D21034') + band(152, 3, W2), collar: W2, cuff: '#D21034', cuff2: W2, badge: { shape: 'shield', ring: '#C9A23A', field: ['#1D2D5C'], motif: 'band', motifCol: '#D21034', stars: 1, symbol: 'star', symbolCol: '#F4F1EA' } });
ART.top.rt_eng96 = kit({ main: W2, collar: '#1C2A55', cuff: '#1C2A55', cuff2: '#6CACE4', badge: { shape: 'shield', ring: '#1C2A55', field: ['#F4F1EA'], motif: 'cross', motifCol: '#D21034' }, sleeveArt: sleeveChevrons('#1C2A55', '#6CACE4') });
ART.top.rt_nga18 = kit({ main: '#0B8A3E', pattern: Array.from({ length: 6 }, (_, k) => `<path d="${Array.from({ length: 24 }, (_, i) => `${i ? 'L' : 'M'}${CX - 90 + i * 8} ${116 + k * 5.4 + (i % 2 ? 4 : 0)}`).join(' ')}" fill="none" stroke="${k % 2 ? '#16161A' : '#E9F2E6'}" stroke-width="2.2"/>`).join(''), collar: '#E9F2E6', cuff: '#16161A', badge: { shape: 'roundel', ring: '#0B8A3E', field: ['#0B8A3E', '#F4F1EA', '#0B8A3E'], n: 3, motif: 'ball' }, neck: 'v', sleeveArt: sleeveChevrons('#16161A', '#E9F2E6') });
ART.top.rt_mex98 = kit({ main: '#006847', pattern: [62, 52, 42, 32, 22].map((r, i) => `<circle cx="${CX}" cy="165" r="${r}" fill="none" stroke="${i % 2 ? '#2E8A63' : '#4FA57F'}" stroke-width="${i % 2 ? 4 : 2}" opacity="0.7"/>`).join('') + Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `<path d="M${CX + Math.cos(a) * 24} ${165 + Math.sin(a) * 24} L${CX + Math.cos(a) * 60} ${165 + Math.sin(a) * 60}" stroke="#4FA57F" stroke-width="1.4" opacity="0.6"/>`; }).join(''), collar: W2, cuff: '#CE1126', cuff2: W2, badge: { shape: 'shield', ring: '#C9A23A', field: ['#006847', '#F4F1EA', '#CE1126'], n: 3, symbol: 'star', symbolCol: '#C9A23A' } });
ART.top.rt_lon92 = kit({ main: '#F7D417', pattern: Array.from({ length: 14 }, (_, i) => { const x = CX - 70 + (i % 5) * 32 + (Math.floor(i / 5) % 2) * 14, y = 118 + Math.floor(i / 5) * 32; return `<path d="${poly([[x, y], [x + 14, y + 6], [x + 4, y + 10], [x + 18, y + 20], [x - 2, y + 12], [x + 8, y + 8]])}" fill="${i % 3 ? '#16161A' : '#D21034'}" opacity="0.85"/>`; }).join(''), collar: '#16161A', cuff: '#16161A', badge: { shape: 'shield', ring: '#C9A23A', field: ['#D21034'], symbol: 'star', symbolCol: '#F2C230' } });
ART.top.rt_man99 = kit({ main: '#DA020E', collar: W2, cuff: W2, cuff2: '#16161A', badge: { shape: 'roundel', ring: '#F2C230', field: ['#DA020E'], symbol: 'rose', symbolCol: '#B0101C' }, neck: 'crew' });
ART.top.rt_tur97 = kit({ main: '#16161A', stripes: [[W2, '#16161A'], 11, CX - 93.5], collar: '#16161A', cuff: '#16161A', badge: { shape: 'oval', ring: '#C9A23A', field: ['#16161A', '#F4F1EA'], n: 6, stars: 2, starCol: '#C9A23A', symbol: 'star', symbolCol: '#C9A23A' } });
ART.top.rt_jpn98 = kit({ main: '#1C3F94', collar: W2, cuff: W2, badge: { shape: 'roundel', ring: '#1C3F94', field: ['#F4F1EA'], motif: 'disc', motifCol: '#D21034' }, sleeveArt: sleeveFlames(['#D21034', W2]) });
ART.top.rt_cmr02 = kit({ main: '#007A3D', tank: true, collar: '#F2C230', cuff: '#CE1126', badge: { shape: 'shield', ring: '#F2C230', field: ['#007A3D', '#CE1126', '#FCD116'], n: 3, stars: 1, starCol: '#FCD116' } });

ART.top.rt_van96 = nbaTank({ font: 'mono', citySize: 7.5, main: '#00B2A9', trim: '#7A4A2E', trim2: '#CE1141', ink: W2, out: '#16161A', num: '50', city: 'VANCOUVER', side: '#7A4A2E', side2: '#CE1141' });
ART.top.rt_hou95 = nbaTank({ font: 'round', main: '#CE1141', trim: '#002D62', trim2: '#C4CED4', ink: W2, out: '#002D62', num: '34', city: 'HOUSTON', pin: '#002D62' });
ART.top.rt_det98 = nbaTank({ font: 'tech', skew: -8, main: '#00788C', trim: '#16161A', trim2: '#CE1141', ink: W2, out: '#16161A', num: '33', city: 'DETROIT', pattern: Array.from({ length: 7 }, (_, i) => `<path d="M${CX - 66 + i * 22} 212 Q${CX - 60 + i * 22} 190 ${CX - 54 + i * 22} ${180 - (i % 2) * 12} Q${CX - 50 + i * 22} 196 ${CX - 44 + i * 22} 212Z" fill="${i % 2 ? '#CE1141' : '#F2C230'}"/>`).join('') });
ART.top.rt_uta97 = nbaTank({ font: 'tall', cityFont: 'cond', main: '#4B2A7B', trim: '#00A3AD', trim2: W2, ink: W2, out: '#16161A', num: '12', city: 'UTAH', pattern: `<path d="${poly([[CX - 90, 196], [CX - 50, 168], [CX - 30, 182], [CX - 4, 158], [CX + 20, 180], [CX + 44, 164], [CX + 90, 194], [CX + 90, 230], [CX - 90, 230]])}" fill="#B5651D"/><path d="${poly([[CX - 90, 206], [CX - 46, 186], [CX - 20, 198], [CX + 12, 182], [CX + 50, 200], [CX + 90, 190], [CX + 90, 230], [CX - 90, 230]])}" fill="#00A3AD"/><path d="${poly([[CX - 12, 166], [CX - 4, 158], [CX + 6, 168]])}" fill="${W2}"/>` });
ART.top.rt_den91 = nbaTank({ font: 'block', main: W2, trim: '#0E2240', trim2: '#FEC524', ink: '#0E2240', out: '#FEC524', num: '55', pattern: band(132, 3, '#E03A3E') + band(135, 3, '#F58426') + band(138, 3, '#FEC524') + band(141, 3, '#00A651') + band(144, 3, '#0E5AA7') + `<path d="${poly([[CX - 90, 132], [CX - 60, 132], [CX - 60, 122], [CX - 52, 122], [CX - 52, 116], [CX - 44, 116], [CX - 44, 126], [CX - 30, 126], [CX - 30, 132], [CX + 30, 132], [CX + 30, 120], [CX + 40, 120], [CX + 40, 112], [CX + 48, 112], [CX + 48, 126], [CX + 60, 126], [CX + 60, 132], [CX + 90, 132], [CX + 90, 133], [CX - 90, 133]])}" fill="#0E2240"/>` });
ART.top.rt_gsw96 = nbaTank({ font: 'tech', skew: -6, main: '#1D428A', trim: '#F58426', trim2: W2, ink: W2, out: '#F58426', num: '17', city: 'GOLDEN STATE', pattern: `<path d="${poly([[CX + 40, 100], [CX + 14, 160], [CX + 30, 160], [CX + 4, 230], [CX + 50, 148], [CX + 34, 148], [CX + 60, 100]])}" fill="#F58426" opacity="0.9"/>` });
ART.top.rt_phi01 = nbaTank({ font: 'block', main: '#16161A', trim: '#C9A23A', trim2: '#ED174C', ink: W2, out: '#C9A23A', num: '3', city: 'PHILADELPHIA', side: '#C9A23A', side2: '#ED174C' });
ART.top.rt_sac02 = nbaTank({ font: 'tall', cityFont: 'cond', main: '#16161A', trim: '#5A2D81', trim2: '#C4CED4', ink: W2, out: '#5A2D81', num: '4', city: 'SACRAMENTO', side: '#5A2D81', side2: '#C4CED4' });

// baseball: o = { main, pin, text, fill, line, pipe, pipe2, font, num, pullover }
const baseball = (o) => top({
  main: () => o.main, sleeve: 'short', neck: 'v', rib: false, grow: 5, sgrow: 6, hem: 209,
  collar: (P, c) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 3.5, 112.5], [CX - nk * 0.4, 124], [CX, 138], [CX + nk * 0.4, 124], [CX + nk + 3.5, 112.5]]), o.pipe, 2.4); if (o.pipe2) P.stroke(curve([[CX - nk - 1.8, 114], [CX - nk * 0.4, 125.4], [CX, 136], [CX + nk * 0.4, 125.4], [CX + nk + 1.8, 114]]), o.pipe2, 1); },
  detail: (P, c, R, d) => {
    if (o.pin) P.clip(d, pins(o.pin, 6, 0.95));
    if (!o.pullover) { P.stroke(curve([[CX + 1.5, 138], [CX + 1.5, 207]]), o.pipe, 2); if (o.pipe2) P.stroke(curve([[CX + 3.5, 138], [CX + 3.5, 207]]), o.pipe2, 1); [146, 160, 174, 188, 202].forEach((y) => P.dot(CX - 2, y, 1.4, o.btn || o.pipe)); }
    if (o.text) { if (o.font === 'script') word(P, o.text, 162, o.size || 13, 54, o.fill, o.line, 0.9, 'script'); else arch(P, o.text, 160, o.size || 10, 52, o.fill, o.line, o.font || 'block', 4); }
    if (o.num) digits(P, o.num, CX - 22, 184, 12, o.fill, o.line, 'block');
  },
  trim: (P, g, side, yEnd, c) => { const gr = 6 * (c.B.arm * 0.5 + 0.5); across(P, g, side, yEnd - 0.02, gr, o.pipe, 2.2); if (o.pipe2) across(P, g, side, yEnd - 0.05, gr, o.pipe2, 1.2); if (o.pipe3) across(P, g, side, yEnd - 0.08, gr, o.pipe3, 1.2); },
});
ART.top.rt_nyy = baseball({ main: '#F7F6F1', pin: '#1C2841', pipe: '#1C2841', btn: '#1C2841' });
ART.top.rt_bos = baseball({ main: '#A9ADB4', text: 'BOSTON', fill: '#BD3039', line: '#0C2340', pipe: '#0C2340', pipe2: '#BD3039', size: 11, font: 'block' });
ART.top.rt_mtl82 = baseball({ main: '#8EB8E5', text: 'MONTREAL', fill: '#E4002B', line: '#003DA5', pipe: '#003DA5', pipe2: W2, pipe3: '#E4002B', font: 'script', size: 14 });
ART.top.rt_tor92 = baseball({ main: '#F7F6F1', text: 'TORONTO', fill: '#134A8E', line: '#E8291C', pipe: '#134A8E', pipe2: '#E8291C', num: '12' });
ART.top.rt_pit79 = baseball({ main: '#FDB827', text: 'PITTSBURGH', fill: '#16161A', line: W2, pipe: '#16161A', pipe2: W2, pullover: true, size: 9, font: 'block' });

ART.top.rt_buf80 = sweater({ main: '#003087', collar: '#FFB81C', stripe: '#FFB81C', hem2: W2, crest: { shape: 'shield', ring: '#FFB81C', field: ['#003087'], motif: 'band', motifCol: '#FFB81C', symbol: 'sabres', symbolCol: '#F4F1EA', symbolCol2: '#FFB81C' } });
ART.top.rt_hfd90 = sweater({ main: '#00843D', collar: '#1C2A55', stripe: W2, hem2: '#1C2A55', crest: { shape: 'roundel', ring: '#1C2A55', field: ['#F4F1EA'], symbol: 'whale', symbolCol: '#00843D' } });
ART.top.rt_que95 = sweater({ main: '#005BAA', collar: W2, stripe: W2, hem2: '#D21034', crest: { shape: 'shield', ring: '#D21034', field: ['#F4F1EA'], symbol: 'snow', symbolCol: '#005BAA' } });

// gridiron: o = { main, collar, bands: [[colour, offset, width]], ink, out, num }
const gridiron = (o) => top({
  main: () => o.main, sleeve: 'short', neck: 'v', grow: 7, sgrow: 10, hem: 209, ribCol: () => o.collar,
  detail: (P) => digits(P, o.num, CX, 186, 38, o.ink, o.out, 'cond'),
  trim: (P, g, side, yEnd, c) => { const gr = 10 * (c.B.arm * 0.5 + 0.5); o.bands.forEach(([colr, off, w]) => across(P, g, side, yEnd - off, gr, colr, w)); },
});
ART.top.rt_hou91 = gridiron({ main: '#6CACE4', collar: '#C8102E', bands: [[W2, 0.05, 3], [ '#C8102E', 0.1, 3], [W2, 0.15, 3]], ink: W2, out: '#C8102E', num: '1' });
ART.top.rt_phi91 = gridiron({ main: '#00835D', collar: W2, bands: [[W2, 0.06, 3.6], [W2, 0.13, 3.6]], ink: W2, out: '#A5ACAF', num: '92' });
const DOME = blob([[64, 50], [64, 34], [72, 18], [88, 9], [100, 7.5], [112, 9], [128, 18], [136, 34], [136, 50], [118, 45], [100, 44], [82, 45]]);
ART.hat.rt_cap_mtl = capOf({ main: () => W2, bill: () => '#003DA5', extra: (P) => { P.clip(DOME, `<path d="${poly([[50, -10], [88, -10], [90, 60], [50, 60]])}" fill="#003DA5"/><path d="${poly([[112, -10], [150, -10], [150, 60], [110, 60]])}" fill="#E4002B"/>`); P.stroke(DOME, INK, OW); }, logo: (P) => P.ell(100, 9, 2.6, 1.8, '#E4002B') });

/* ============================================================ MORE BLANKS AND TREND PIECES */
// blanks
ART.top.pockettee = top({ def: '#ECEBE7', sleeve: 'short', detail: (P, c, R) => { const x = CX + 18; P.shape(poly([[x - 7, 136], [x + 7, 136], [x + 7, 150], [x, 152], [x - 7, 150]]), R.base, { line: R.line, w: 1.2 }); } });
ART.top.thermal = top({ def: '#E6DFD0', sleeve: 'long', detail: (P, c, R, d) => P.clip(d, Array.from({ length: 30 }, (_, i) => `<path d="M${CX - 90 + i * 6} 100 L${CX - 90 + i * 6} 230" stroke="${R.sh}" stroke-width="0.8" opacity="0.5"/>`).join('') + Array.from({ length: 22 }, (_, i) => `<path d="M${CX - 90} ${110 + i * 6} L${CX + 90} ${110 + i * 6}" stroke="${R.sh}" stroke-width="0.8" opacity="0.5"/>`).join('')) });
ART.top.plainhood = hoodie({ o: { def: '#8E9196' } });
ART.outer.zipblank = outer({ def: '#2A2D33', zip: true, closed: true, len: 208, grow: 5, sgrow: 6, collar: (P, c, R) => hood(P, c, R), cuff: (p, m) => dk(m, 0.12), detail: (P, c, R, d, m, B, grow, hemY) => { zip(116, hemY - 2)(P); both((s) => P.stroke(curve([[CX + s * 22, 176], [CX + s * 16, 196]]), R.line, 1.2, 0.8)); hem(P, B, grow, hemY, ramp(dk(m, 0.1))); } });
ART.bottom.sweatpants = pants({ def: '#8E9196', grow: 5, fly: false, band: (p, m) => dk(m, 0.12), legDetail: (P, g, sd, J, c, R) => { const [x, y, w] = J[J.length - 1]; P.fill(poly([[x - w / 2, y - 7], [x + w / 2, y - 7], [x + w / 2 - 1.5, y], [x - w / 2 + 1.5, y]]), R.sh); P.stroke(curve([[x - w / 2 + 1, y - 7], [x + w / 2 - 1, y - 7]]), R.line, 1, 0.7); }, detail: (P) => { P.stroke(curve([[CX - 3, 196], [CX - 4, 208]]), '#E8E6E0', 1.4); P.stroke(curve([[CX + 3, 196], [CX + 4, 208]]), '#E8E6E0', 1.4); } });
ART.bottom.chinos = pants({ def: '#B9A37A', grow: 3.5, straight: 0.82, legDetail: (P, g, sd, J, c, R) => { P.stroke(curve(J.slice(1).map(([x, y]) => [x - sd * 1.5, y])), R.sh, 1, 0.6); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.meshshorts = pants({ one: true, def: '#16161A', end: 262, grow: 11, bag: { hem: 1.1, out: 2.5 }, fly: false, legDetail: (P, g, sd, J, c, R) => { for (let k = 0; k < 36; k++) { const j = J[1 + (k % (J.length - 2))]; P.dot(j[0] + ((k * 7) % 13 - 6) * j[2] / 15, j[1] + ((k * 5) % 9 - 4), 0.5, R.hi, 0.5); } hemLine(P, J, R); } });
ART.bottom.cargoshorts = pants({ one: true, def: '#9C8B63', end: 258, grow: 9, bag: { hem: 1.06, out: 2 }, legDetail: (P, g, sd, J, c, R) => { cargoPocket(P, J, sd, R); hemLine(P, J, R); }, detail: pocketsJ });
ART.hat.plainbeanie = (P, g, col, ph) => { if (ph !== 'head') return; const m = col || '#1C1C21', R = ramp(m), d = blob([[63, 46], [63, 26], [72, 10], [88, 2], [100, 0.5], [112, 2], [128, 10], [137, 26], [137, 46]]); P.part(d, R, { shade: [[poly([[112, -10], [150, -10], [150, 60], [116, 60]]), R.sh]] }); for (let x = 72; x <= 128; x += 6) P.stroke(curve([[x, 8 + Math.abs(x - 100) * 0.3], [x + (x - 100) * 0.04, 34]]), R.deep, 1, 0.5); P.part(blob([[62, 50], [62, 34], [100, 31], [138, 34], [138, 50], [100, 53]]), ramp(dk(m, 0.06)), {}); for (let x = 66; x <= 134; x += 4) P.stroke(`M${x} 35 L${x} 50`, R.deep, 0.8, 0.5); };

// trend pieces
// balloon bomber: short, round and puffy, big sleeves, cinched rib hem
ART.outer.balloon = outer({ def: '#A0662E', closed: true, len: 200, grow: 13, sgrow: 12, collar: ribCollar((p, m) => dk(m, 0.3)), cuff: (p, m) => dk(m, 0.3), detail: (P, c, R, d, m, B, grow, hemY) => { zip(108, hemY - 3, '#C9A23A')(P); P.clip(d, `<path d="${curve([[CX - 36, 160], [CX - 28, 132], [CX - 14, 122]])}" stroke="${R.hi}" stroke-width="6" fill="none" opacity="0.5" stroke-linecap="round"/>`); hem(P, B, grow, hemY, ramp(dk(m, 0.3))); } });
// shearling: suede body, cream fleece collar, cuffs and edges, worn open
ART.outer.shearling = outer({ def: '#8B5A2B', len: 214, grow: 8, sgrow: 7.5, gap: openGap, cuff: () => '#EDE3CF', collar: (P, c) => { const nk = c.B.nk; both((s) => P.shape(blob([[CX + s * (nk - 2), 104], [CX + s * (nk + 18), 110], [CX + s * (openGap(140) + 8), 146], [CX + s * (openGap(128)), 128]]), '#EDE3CF', { line: '#8A7A5E', w: 1.4 })); }, detail: (P) => { edges(P, '#8A7A5E', 6.2, 128, 210, 2.6); edges(P, '#EDE3CF', 4.6, 128, 210, 2.6); } });
// cropped quilted anorak with a high collar and toggles
ART.outer.anorak = outer({ def: '#4E5A3F', closed: true, len: 202, grow: 10, sgrow: 9, cuff: (p, m) => dk(m, 0.2), collar: (P, c, R) => { const nk = c.B.nk; P.part(blob([[CX - nk - 7, 96], [CX + nk + 7, 96], [CX + nk + 9, 116], [CX, 120], [CX - nk - 9, 116]]), R, {}); }, detail: (P, c, R, d) => { P.clip(d, Array.from({ length: 10 }, (_, i) => `<path d="M${CX - 90} ${120 + i * 9} L${CX + 90} ${120 + i * 9}" stroke="${R.deep}" stroke-width="1.2" opacity="0.7"/>`).join('')); [140, 160, 180].forEach((y) => { P.shape(poly([[CX - 2, y - 3.5], [CX + 2, y - 3.5], [CX + 2, y + 3.5], [CX - 2, y + 3.5]]), '#C9B48A', { line: INK, w: 0.8 }); P.stroke(`M${CX - 7} ${y} L${CX + 7} ${y}`, INK, 1); }); } });
// thick pile fleece, zip front
ART.outer.fleece = outer({ def: '#E9E2D0', closed: true, len: 208, grow: 9, sgrow: 8.5, cuff: (p, m) => dk(m, 0.08), collar: (P, c, R) => { const nk = c.B.nk; P.part(blob([[CX - nk - 6, 98], [CX + nk + 6, 98], [CX + nk + 8, 116], [CX - nk - 8, 116]]), R, {}); }, detail: (P, c, R, d) => { P.clip(d, Array.from({ length: 60 }, (_, i) => `<circle cx="${CX - 50 + (i * 37) % 100}" cy="${112 + (i * 23) % 96}" r="2.4" fill="none" stroke="${R.sh}" stroke-width="1" opacity="0.7"/>`).join('')); zip(100, 204, '#3A3D44')(P); P.shape(poly([[CX + 16, 150], [CX + 30, 150], [CX + 30, 162], [CX + 16, 162]]), '#3A3D44', { line: INK, w: 1 }); } });
// quilted liner vest
ART.outer.linervest = outer({ def: '#3A4A3A', sleeve: 'none', closed: true, len: 204, grow: 6, collar: (P, c, R) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 6, 114], [CX, 122], [CX + nk + 6, 114]]), R.line, 3.4); }, detail: (P, c, R, d) => { P.clip(d, Array.from({ length: 14 }, (_, i) => `<path d="M${CX - 90 + i * 14} 100 L${CX - 30 + i * 14} 230" stroke="${R.deep}" stroke-width="1" opacity="0.7"/><path d="M${CX + 90 - i * 14} 100 L${CX + 30 - i * 14} 230" stroke="${R.deep}" stroke-width="1" opacity="0.7"/>`).join('')); [134, 150, 166, 182, 198].forEach((y) => P.dot(CX, y, 1.6, SILVER)); } });
// cropped boxy bouclé jacket with a corduroy collar
ART.outer.boucle = outer({ def: '#D8CDB6', closed: true, len: 198, grow: 9, sgrow: 8, collar: shirtCollar, cuff: (p, m) => dk(m, 0.06), detail: (P, c, R, d) => { P.clip(d, Array.from({ length: 140 }, (_, i) => `<path d="M${CX - 50 + (i * 41) % 100} ${108 + (i * 29) % 92} q2 -2 3 0 q1 2 3 0" stroke="${i % 2 ? R.sh : R.hi}" stroke-width="1" fill="none" opacity="0.8"/>`).join('')); [140, 160, 180].forEach((y) => P.ell(CX + 5, y, 2.2, 2.2, '#C9A23A', { line: '#7A5E14', w: 0.8 })); } });
// gorpcore shell: technical nylon, hood up front, contrast zip and toggles
ART.outer.gorp = outer({ def: '#2F4F3A', closed: true, len: 212, grow: 10, sgrow: 9, sleeveCol: (p, m) => m, cuff: (p, m) => dk(m, 0.25), collar: (P, c, R) => hood(P, c, R), detail: (P, c, R, d) => { P.clip(d, `<path d="${poly([[CX - 90, 150], [CX + 90, 130], [CX + 90, 146], [CX - 90, 166]])}" fill="#E36414"/>`); zip(110, 208, '#E36414')(P); both((s) => { P.stroke(curve([[CX + s * 8, 122], [CX + s * 9, 132]]), '#E8E6E0', 1.2); P.dot(CX + s * 9, 133, 1.6, '#16161A'); P.stroke(curve([[CX + s * 26, 180], [CX + s * 30, 200]]), INK, 1.8); }); } });
// blue suede trucker, worn open
ART.outer.suedeblue = outer({ def: '#3E6FB5', len: 208, grow: 6, sgrow: 6.5, gap: openGap, collar: shirtCollar, detail: (P, c, R) => { both((s) => { const x = CX + s * 24; P.stroke(curve([[x - 9, 142], [x + 9, 142]]), R.deep, 1.4); P.shape(poly([[x - 6, 145], [x + 6, 145], [x + 6, 156], [x, 158], [x - 6, 156]]), R.base, { line: R.deep, w: 1 }); P.stroke(curve([[CX + s * 14, 170], [CX + s * 16, 200]]), R.deep, 1.2, 0.8); }); [148, 172, 196].forEach((y) => P.dot(CX - openGap(y) - 3, y, 1.4, '#C9A23A')); } });
// cropped structured leather, chocolate
ART.outer.leathercrop = outer({ def: '#3B2418', closed: true, len: 200, grow: 7, sgrow: 7, collar: shirtCollar, cuff: (p, m) => dk(m, 0.15), detail: (P, c, R, d, m, B, grow, hemY) => { zip(112, hemY - 1, '#C9A23A')(P); P.clip(d, `<path d="${curve([[CX - 34, 170], [CX - 26, 140], [CX - 12, 126]])}" stroke="${lt(m, 0.35)}" stroke-width="4" fill="none" opacity="0.5" stroke-linecap="round"/>`); hem(P, B, grow, hemY, ramp(dk(m, 0.1))); } });
// short faux fur coat with a leather collar and toggles
ART.outer.fauxfur = outer({ def: '#8A6A4A', len: 214, grow: 12, sgrow: 11, gap: openGap, collar: (P, c) => { const nk = c.B.nk; both((s) => P.shape(blob([[CX + s * (nk - 1), 104], [CX + s * (nk + 14), 110], [CX + s * (openGap(130) + 6), 134], [CX + s * openGap(124), 124]]), '#2A1A10', { line: INK, w: 1.2 })); }, detail: (P, c, R) => { for (let k = 0; k < 70; k++) { const s = k % 2 ? 1 : -1, x = CX + s * (openGap(120) + 4 + (k * 7) % 30), y = 120 + (k * 13) % 90; P.stroke(`M${x} ${y} q${s * 2} 3 ${s * 1} 6`, k % 3 ? R.sh : R.hi, 1.2, 0.8); } } });
// heavyweight boxy cropped hoodie
ART.top.heavyhood = top({ def: '#4A4E55', sleeve: 'long', grow: 9, sgrow: 8, hem: 198, neck: 'crew', rib: false, collar: (P, c, R) => { hood(P, c, R); strings(P, R); }, cuffCol: (p, m) => dk(m, 0.1), detail: (P, c, R, d, m) => { pocket(P, R, m); hem(P, c.B, 9, 198, R); } });
// fuzzy mohair knit
ART.top.mohair = top({ def: '#B23F7F', sleeve: 'long', grow: 7, sgrow: 7, hem: 206, neck: 'crew', detail: (P, c, R, d) => P.clip(d, Array.from({ length: 120 }, (_, i) => `<path d="M${CX - 50 + (i * 41) % 100} ${108 + (i * 29) % 96} l${(i % 3) - 1} -3" stroke="${i % 2 ? R.hi : R.sh}" stroke-width="1" opacity="0.8"/>`).join('')) });
// loose pleated trousers and a big houndstooth overcoat
ART.bottom.pleated = pants({ def: '#4A4038', grow: 9, bag: { hem: 1.02, out: 1.5 }, belt: '#2A1A10', legDetail: (P, g, sd, J, c, R) => { P.stroke(curve(J.slice(0, 4).map(([x, y], i) => [x - sd * 2, y + (i ? 0 : 6)])), R.line, 1.1, 0.7); P.stroke(curve(J.slice(1).map(([x, y]) => [x + sd * 2, y])), R.sh, 1, 0.6); hemLine(P, J, R); }, detail: pocketsJ });
ART.outer.bigcoat = outer({ def: '#2C2C30', len: 290, grow: 12, sgrow: 9, collar: lapels(1.3), detail: (P, c, R) => { both((s) => P.clip(halfD(c.B, s, 12, 290, 2, (y) => (y < 150 ? 3 + (150 - y) * 0.28 : 3 + (y - 150) * 0.03)), Array.from({ length: 300 }, (_, i) => { const x = CX - 70 + (i % 20) * 7, y = 104 + Math.floor(i / 20) * 7 + (i % 2) * 3.5; return `<path d="M${x} ${y} l2 2 l-1 2 l3 -1" stroke="#9A9AA0" stroke-width="1" fill="none" opacity="0.7"/>`; }).join(''))); buttons([176, 206, 236], CX + 6, '#121214')(P); } });
// hooded work jacket in brown duck
ART.outer.workjacket = outer({ def: '#7A5A3A', zip: true, zipCol: '#C9A23A', closed: true, len: 210, grow: 9, sgrow: 8, cuff: (p, m) => dk(m, 0.2), collar: (P, c, R) => hood(P, c, ramp('#5E5E62')), detail: (P, c, R, d, m, B, grow, hemY) => { zip(112, hemY - 2, '#C9A23A')(P); both((s) => { const x = CX + s * 24; P.shape(poly([[x - 9, 176], [x + 9, 176], [x + 9, 196], [x - 9, 196]]), R.base, { line: R.line, w: 1.2 }); }); P.shape(poly([[CX + 16, 138], [CX + 30, 138], [CX + 30, 152], [CX + 16, 152]]), R.base, { line: R.line, w: 1.1 }); P.clip(d, Array.from({ length: 12 }, (_, i) => `<path d="M${CX - 90} ${110 + i * 9} L${CX + 90} ${116 + i * 9}" stroke="${R.sh}" stroke-width="0.8" opacity="0.4"/>`).join('')); hem(P, B, grow, hemY, ramp(dk(m, 0.12))); } });
// knit balaclava and a five-panel camp cap
ART.hat.balaclava = (P, g, col, ph) => { if (ph !== 'head') return; const m = col || '#2A2D33', R = ramp(m); const outerD = blob([[58, 100], [56, 50], [62, 22], [80, 4], [100, 0], [120, 4], [138, 22], [144, 50], [142, 100], [124, 112], [100, 116], [76, 112]]); const hole = blob([[72, 52], [100, 46], [128, 52], [130, 80], [122, 102], [100, 110], [78, 102], [70, 80]]); P.add(`<path d="${outerD} ${hole}" fill="${R.base}" fill-rule="evenodd" stroke="${R.line}" stroke-width="${OW}"/>`); const cid = 'bc' + Math.random().toString(36).slice(2, 8); P.add(`<clipPath id="${cid}"><path d="${outerD} ${hole}" clip-rule="evenodd"/></clipPath><g clip-path="url(#${cid})"><path d="${poly([[118, -10], [160, -10], [160, 130], [122, 130]])}" fill="${R.sh}" opacity="0.8"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${60 + i * 6} 0 L${60 + i * 6} 120" stroke="${R.deep}" stroke-width="0.8" opacity="0.4"/>`).join('')}</g>`); P.stroke(hole, R.line, 2); };
ART.hat.camp5 = capOf({ def: '#4E5A3F', bill: (p, m) => dk(m, 0.15), flat: true, extra: (P, c, crown) => { P.stroke(curve([[100, 8], [100, 44]]), dk(crown, 0.25), 1, 0.8); P.shape(poly([[90, 26], [110, 26], [110, 34], [90, 34]]), '#E9E2D0', { line: INK, w: 0.8 }); } });
// clogs and trail runners
ART.shoes.clogs = shoes({ def: '#8B6B4A', h: -4, sole: '#3A2A1A', soleH: 4, laces: false, wide: 1.12, detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx - 11, ay + 2], [tx, ay - 1], [tx + 11, ay + 2]]), R.line, 1.4); } });
ART.shoes.trail = shoes({ def: '#6B7078', h: 4, sole: '#E36414', soleH: 6, wide: 1.06, laceCol: '#E8E6E0', detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx - 12 * side, ay + 14], [tx, ay + 10], [tx + 12 * side, ay + 13]]), '#1C1C21', 2); [-8, -2, 4, 10].forEach((dx) => P.stroke(`M${tx + dx} ${ay + 21} l2 0`, '#1C1C21', 1.4)); } });
// wraparound sport shades, pearl necklace, crossbody sling
ART.face.wrapshades = (P, g, col, ph) => { if (ph !== 'face') return; const d = blob([[66, 58], [100, 54], [134, 58], [132, 66], [114, 70], [100, 66], [86, 70], [68, 66]]); P.shape(d, '#1A2A3A', { line: '#0A0A0E', w: 1.8 }); P.clip(d, `<path d="${poly([[66, 54], [134, 54], [134, 59], [66, 59]])}" fill="#7FD0E8" opacity="0.6"/><path d="${poly([[66, 59], [134, 59], [134, 62], [66, 62]])}" fill="#B7E86A" opacity="0.35"/>`); };
ART.chain.pearls = (P, g, col, ph, c) => { if (ph !== 'neck') return; const nk = c.B.nk; const pts = Array.from({ length: 17 }, (_, i) => { const t = i / 16, a = Math.PI * t; return [CX - (nk + 5) * Math.cos(a), 112 + Math.sin(a) * 18]; }); pts.forEach(([x, y]) => { P.ell(x, y, 2.4, 2.4, '#F4F1EA', { line: '#9A968C', w: 0.7 }); P.dot(x - 0.7, y - 0.8, 0.7, '#FFFFFF'); }); };
ART.back.sling = (P, g, col, ph, c) => {
  if (ph !== 'neck') return;
  const m = col || '#1C1C21', R = ramp(m), B = c.B;
  const strap = curve([[CX - B.nk - 6, 112], [CX - 6, 150], [CX + B.ch - 4, 180]]);
  P.stroke(strap, R.line, 5); P.stroke(strap, dk(m, 0.1), 3.4);
  const d = blob([[CX + 6, 162], [CX + 34, 168], [CX + 36, 186], [CX + 8, 182]]);
  P.part(d, R, { shade: [[poly([[CX + 24, 150], [CX + 50, 150], [CX + 50, 200], [CX + 24, 200]]), R.sh]] });
  P.stroke(curve([[CX + 8, 168], [CX + 34, 173]]), SILVER, 1.4); P.dot(CX + 12, 168.6, 1.6, SILVER);
};
