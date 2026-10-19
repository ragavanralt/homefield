// A small figure engine. You describe shapes (polygons, ellipses, limbs) in a 64 x 96 design grid; each one is
// filled, given a thin dark outline, and shaded in flat bands with light from the top left. Everything is drawn
// several times larger than it is shown and then shrunk, so the edges come out smooth rather than blocky.
export const W = 64, H = 96;
const hexToRgb = (s) => { let t = String(s).replace('#', ''); if (t.length === 3) t = t.split('').map((c) => c + c).join(''); const n = parseInt(t, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pack = (r, g, b, a = 255) => (((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
/** amt > 0 darkens (shadows lean a little cool), amt < 0 lightens (highlights lean a little warm). */
export function tone(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return [cl(r * (1 - amt * 0.95)), cl(g * (1 - amt * 1.02)), cl(b * (1 - amt * 0.8) + amt * 10)];
  const a = -amt;
  return [cl(r + (255 - r) * a), cl(g + (255 - g) * a * 0.93), cl(b + (255 - b) * a * 0.8)];
}
export const rgbHex = ([r, g, b]) => '#' + [r, g, b].map((v) => cl(v).toString(16).padStart(2, '0')).join('');
export const shadeHex = (hex, amt) => rgbHex(tone(hex, amt));
export const mix = (a, b, t) => { const x = hexToRgb(a), y = hexToRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };

export class Spr {
  /** win: the part of the 64 x 96 design grid to draw [x, y, w, h]. R: how many fine pixels per design unit. */
  constructor(win = [0, 0, W, H], R = 1) {
    [this.wx, this.wy, this.ww, this.wh] = win; this.R = R;
    this.w = Math.round(this.ww * R); this.h = Math.round(this.wh * R); this.buf = new Uint32Array(this.w * this.h);
    this.k = 1; this.cx = 32; this.hs = 1; this.cy = 28.6; // k: body width; hs and cy: the head is drawn big and shrunk about the chin
  }
  X(x) { return this.cx + (x - this.cx) * this.k; }
  // body: true = with the body, false = with the head (shrunk about the chin), 'raw' = exact design coordinates
  LX(x, body) { return body === 'raw' ? x : body ? this.X(x) : 31.8 + (x - 31.8) * this.hs; }
  LY(y, body) { return body === 'raw' ? y : body ? y : this.cy + (y - 28.6) * this.hs; }
  PX(x, body) { return (this.LX(x, body) - this.wx) * this.R; }
  PY(y, body) { return (this.LY(y, body) - this.wy) * this.R; }
  mask() { return new Uint8Array(this.w * this.h); }

  /** Polygon mask. Points are [x, y] in design units; pixel centres inside the outline are filled. */
  poly(pts, body = true) {
    const m = this.mask(), { w, h } = this;
    const P = pts.map(([x, y]) => [this.PX(x, body), this.PY(y, body)]);
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of P) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < P.length; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let j = 0; j + 1 < xs.length; j += 2) {
        for (let x = Math.max(0, Math.ceil(xs[j] - 0.5)); x <= Math.min(w - 1, Math.ceil(xs[j + 1] - 0.5) - 1); x++) m[y * w + x] = 1;
      }
    }
    return m;
  }
  ell(cx, cy, rx, ry, body = true) {
    const m = this.mask(), { w, h, R } = this, X = this.PX(cx, body), f = body === 'raw' ? 1 : body ? this.k : this.hs, RX = Math.max(0.3, rx * f * R);
    const RY = Math.max(0.3, (body === 'raw' || body ? ry : ry * this.hs) * R), Y = this.PY(cy, body);
    for (let y = Math.max(0, Math.floor(Y - RY - 1)); y <= Math.min(h - 1, Math.ceil(Y + RY + 1)); y++) {
      for (let x = Math.max(0, Math.floor(X - RX - 1)); x <= Math.min(w - 1, Math.ceil(X + RX + 1)); x++) {
        const dx = (x + 0.5 - X) / RX, dy = (y + 0.5 - Y) / RY;
        if (dx * dx + dy * dy <= 1) m[y * w + x] = 1;
      }
    }
    return m;
  }
  rect(x0, y0, x1, y1, body = true) { return this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], body); }
  /** A thick path: [[x, y, width], ...]. Good for arms, legs, braids and straps. Smoothed with a gentle curve. */
  limb(pts, body = true) {
    const n = pts.length, L = [], Rr = [];
    for (let i = 0; i < n; i++) {
      const [x, y, wd] = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const nx = -dy * wd / 2, ny = dx * wd / 2;
      L.push([x + nx, y + ny]); Rr.unshift([x - nx, y - ny]);
    }
    const sm = (q) => { if (q.length < 3) return q; const o = [q[0]]; for (let i = 0; i < q.length - 1; i++) { const [ax, ay] = q[i], [bx, by] = q[i + 1]; o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); } o.push(q[q.length - 1]); return o; };
    return this.poly([...sm(L), ...sm(Rr)], body);
  }
  or(...ms) { const o = this.mask(); for (const m of ms) if (m) for (let i = 0; i < o.length; i++) if (m[i]) o[i] = 1; return o; }
  sub(a, b) { const o = a.slice(); for (let i = 0; i < o.length; i++) if (b[i]) o[i] = 0; return o; }
  and(a, b) { const o = this.mask(); for (let i = 0; i < o.length; i++) if (a[i] && b[i]) o[i] = 1; return o; }
  shift(m, dx, dy) {
    const o = this.mask(), { w, h, R } = this, sx = Math.round(dx * R), sy = Math.round(dy * R);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { const nx = x + sx, ny = y + sy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) o[ny * w + nx] = 1; }
    return o;
  }
  box(m) {
    const { w, h } = this; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) { const r = y * w; for (let x = 0; x < w; x++) if (m[r + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }

  /** Fill a mask: outline, base colour and flat shading bands (bright top-left edge, darker right and bottom). */
  paint(m, colour, o = {}) {
    const { w, h, buf, R } = this;
    if (o.alpha != null) { const c = pack(...hexToRgb(colour), o.alpha); for (let i = 0; i < m.length; i++) if (m[i]) buf[i] = c; return this; }
    const bx = this.box(m); if (!bx) return this;
    if (o.line !== false) {
      const oc = pack(...tone(o.line || colour, o.lineAmt ?? 0.62));
      const n = Math.max(1, Math.round((o.lw ?? 0.62) * R));
      const x0 = Math.max(0, bx[0] - n - 1), y0 = Math.max(0, bx[1] - n - 1), x1 = Math.min(w - 1, bx[2] + n + 1), y1 = Math.min(h - 1, bx[3] + n + 1), rw = x1 - x0 + 1, rh = y1 - y0 + 1;
      let cur = new Uint8Array(rw * rh);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cur[(y - y0) * rw + (x - x0)] = m[y * w + x];
      for (let s = 0; s < n; s++) {
        const nxt = cur.slice(), diag = s % 2 === 1;
        for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
          if (cur[y * rw + x]) continue;
          const i = y * rw + x;
          if ((x > 0 && cur[i - 1]) || (x < rw - 1 && cur[i + 1]) || (y > 0 && cur[i - rw]) || (y < rh - 1 && cur[i + rw]) ||
            (diag && ((x > 0 && y > 0 && cur[i - rw - 1]) || (x < rw - 1 && y > 0 && cur[i - rw + 1]) || (x > 0 && y < rh - 1 && cur[i + rw - 1]) || (x < rw - 1 && y < rh - 1 && cur[i + rw + 1])))) nxt[i] = 1;
        }
        cur = nxt;
      }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cur[(y - y0) * rw + (x - x0)] && !m[y * w + x]) buf[y * w + x] = oc;
    }
    const c0 = pack(...hexToRgb(colour)), cH = pack(...tone(colour, -(o.hiAmt ?? 0.2))), c1 = pack(...tone(colour, o.d1 ?? 0.17)), c2 = pack(...tone(colour, o.d2 ?? 0.32));
    const [X0, Y0, X1, Y1] = bx, rr = new Int16Array(w * h), bb = new Int16Array(w * h), ll = new Int16Array(w * h), tt = new Int16Array(w * h);
    for (let y = Y0; y <= Y1; y++) {
      for (let x = X1; x >= X0; x--) { const i = y * w + x; rr[i] = m[i] ? (x < w - 1 && m[i + 1] ? rr[i + 1] + 1 : 0) : -1; }
      for (let x = X0; x <= X1; x++) { const i = y * w + x; ll[i] = m[i] ? (x > 0 && m[i - 1] ? ll[i - 1] + 1 : 0) : -1; }
    }
    for (let x = X0; x <= X1; x++) {
      for (let y = Y1; y >= Y0; y--) { const i = y * w + x; bb[i] = m[i] ? (y < h - 1 && m[i + w] ? bb[i + w] + 1 : 0) : -1; }
      for (let y = Y0; y <= Y1; y++) { const i = y * w + x; tt[i] = m[i] ? (y > 0 && m[i - w] ? tt[i - w] + 1 : 0) : -1; }
    }
    const flat = o.flat, noHi = o.hi === false, bands = o.bands ?? 2, u = R;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      let c = c0;
      if (!flat) {
        const wide = ll[i] + rr[i] >= 3 * u, tall = tt[i] + bb[i] >= 3 * u;
        if (wide && rr[i] < 0.9 * u && ll[i] >= 2 * u) c = c2;
        else if (tall && bb[i] < 0.9 * u && tt[i] >= 2 * u) c = c2;
        else if (bands > 1 && wide && rr[i] < 1.8 * u && ll[i] >= 2 * u) c = c1;
        else if (bands > 1 && tall && bb[i] < 1.8 * u && tt[i] >= 2 * u) c = c1;
        else if (!noHi && ((ll[i] < 0.8 * u && rr[i] >= 2 * u) || (tt[i] < 0.8 * u && bb[i] >= 2 * u))) c = cH;
      }
      buf[i] = c;
    }
    return this;
  }
  /** Flat fill, no outline or shading. With alpha below 255 it blends over what is already there. */
  flat(m, colour, alpha = 255) {
    const [r, g, b] = hexToRgb(colour), buf = this.buf;
    if (alpha >= 255) { const c = pack(r, g, b); for (let i = 0; i < m.length; i++) if (m[i]) buf[i] = c; return this; }
    const a = alpha / 255;
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      const d = buf[i], da = d >>> 24;
      if (!da) { buf[i] = pack(r, g, b, alpha); continue; }
      buf[i] = pack(cl((d & 255) * (1 - a) + r * a), cl(((d >> 8) & 255) * (1 - a) + g * a), cl(((d >> 16) & 255) * (1 - a) + b * a), da);
    }
    return this;
  }
  /** Soft detail laid over a shape: darkens (positive amt) or lightens (negative) what is already painted there. */
  shade(m, amt, alpha = 255) {
    const buf = this.buf;
    for (let i = 0; i < m.length; i++) {
      if (!m[i] || !(buf[i] >>> 24)) continue;
      const d = buf[i], t = tone(rgbHex([d & 255, (d >> 8) & 255, (d >> 16) & 255]), amt), a = alpha / 255;
      buf[i] = pack(cl((d & 255) * (1 - a) + t[0] * a), cl(((d >> 8) & 255) * (1 - a) + t[1] * a), cl(((d >> 16) & 255) * (1 - a) + t[2] * a), d >>> 24);
    }
    return this;
  }
  /** Detail only where a shape and the mask under it overlap. */
  inside(shape, m, colour) { return this.flat(this.and(shape, m), colour); }
  disc(gx, gy, rad, c, clip) {
    const { w, h } = this;
    for (let y = Math.max(0, Math.floor(gy - rad)); y <= Math.min(h - 1, Math.ceil(gy + rad)); y++) for (let x = Math.max(0, Math.floor(gx - rad)); x <= Math.min(w - 1, Math.ceil(gx + rad)); x++) {
      const dx = x + 0.5 - gx, dy = y + 0.5 - gy;
      if (dx * dx + dy * dy <= rad * rad && (!clip || clip[y * w + x])) this.buf[y * w + x] = c;
    }
  }
  dot(x, y, colour, body = true, r = 0.58) {
    const lx = Math.round(this.LX(x, body)) + 0.5, ly = Math.round(this.LY(y, body)) + 0.5;
    this.disc((lx - this.wx) * this.R, (ly - this.wy) * this.R, r * this.R, pack(...hexToRgb(colour)));
    return this;
  }
  /** A round spot at an exact position (not snapped to the grid). */
  spot(x, y, rad, colour, body = 'raw') { this.disc(this.PX(x, body), this.PY(y, body), rad * this.R, pack(...hexToRgb(colour))); return this; }
  line(x0, y0, x1, y1, colour, body = true, clip = null, wd = 1) {
    const R = this.R, c = pack(...hexToRgb(colour));
    const ax = (Math.round(this.LX(x0, body)) + 0.5 - this.wx) * R, ay = (Math.round(this.LY(y0, body)) + 0.5 - this.wy) * R;
    const bx = (Math.round(this.LX(x1, body)) + 0.5 - this.wx) * R, by = (Math.round(this.LY(y1, body)) + 0.5 - this.wy) * R;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (R * 0.3)));
    for (let i = 0; i <= n; i++) this.disc(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, wd * R * 0.5, c, clip);
    return this;
  }
  /** A free (not snapped) stroke of any width, as a mask: for brows, folds and face lines. */
  strokeMask(pts, wd = 0.6, body = 'raw') {
    const R = this.R, m = this.mask(), P = pts.map(([x, y]) => [this.PX(x, body), this.PY(y, body)]), rad = wd * R * 0.5, { w, h } = this;
    for (let k = 0; k < P.length - 1; k++) {
      const [ax, ay] = P[k], [bx, by] = P[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (R * 0.2)));
      for (let i = 0; i <= n; i++) {
        const gx = ax + ((bx - ax) * i) / n, gy = ay + ((by - ay) * i) / n;
        for (let y = Math.max(0, Math.floor(gy - rad)); y <= Math.min(h - 1, Math.ceil(gy + rad)); y++) for (let x = Math.max(0, Math.floor(gx - rad)); x <= Math.min(w - 1, Math.ceil(gx + rad)); x++) {
          const dx = x + 0.5 - gx, dy = y + 0.5 - gy; if (dx * dx + dy * dy <= rad * rad) m[y * w + x] = 1;
        }
      }
    }
    return m;
  }
  stroke(pts, colour, wd = 0.6, body = 'raw', alpha = 255) { return this.flat(this.strokeMask(pts, wd, body), colour, alpha); }
  /** Rows of text as dots: '.' is empty, other letters look up in pal. (x, y) is the top-left. */
  art(x, y, rows, pal, body = true) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && ch !== ' ' && pal[ch]) this.dot(x + i, y + j, pal[ch], body); }));
    return this;
  }

  /** The finished picture, shrunk by d (box average) so the edges are smooth. */
  crop(d = 1) {
    const { w, h, buf } = this, ow = Math.floor(w / d), oh = Math.floor(h / d), out = new Uint32Array(ow * oh);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) { const v = buf[(y * d + j) * w + x * d + i], al = v >>> 24; r += (v & 255) * al; g += ((v >> 8) & 255) * al; b += ((v >> 16) & 255) * al; a += al; }
      const n = d * d;
      out[y * ow + x] = a ? pack(cl(r / a), cl(g / a), cl(b / a), cl(a / n)) : 0;
    }
    return { w: ow, h: oh, data: out };
  }
}

/** The sprite as markup: a small image in the browser, or run-length rectangles anywhere else (tests, old browsers). */
export function spriteMarkup(c, label = '') {
  if (typeof document !== 'undefined') {
    try {
      const cv = document.createElement('canvas'); cv.width = c.w; cv.height = c.h;
      const ctx = cv.getContext('2d');
      if (ctx) {
        const id = ctx.createImageData(c.w, c.h); new Uint32Array(id.data.buffer).set(c.data); ctx.putImageData(id, 0, 0);
        return `<img class="px" alt="${label}" width="${c.w}" height="${c.h}" draggable="false" src="${cv.toDataURL('image/png')}">`;
      }
    } catch (e) { /* fall through to the rectangles */ }
  }
  const rects = [];
  for (let y = 0; y < c.h; y++) {
    let x = 0;
    while (x < c.w) {
      const v = c.data[y * c.w + x];
      if (!v) { x++; continue; }
      let e = x + 1; while (e < c.w && c.data[y * c.w + e] === v) e++;
      const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255, a = (v >>> 24) / 255;
      rects.push(`<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="rgb(${r},${g},${b})"${a < 1 ? ` fill-opacity="${a.toFixed(2)}"` : ''}/>`);
      x = e;
    }
  }
  return `<svg viewBox="0 0 ${c.w} ${c.h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${rects.join('')}</svg>`;
}
