// A tiny pixel-art engine. You describe shapes (polygons, ellipses, limbs); each one is filled with hard-edged
// pixels, given a 1px outline, and shaded with light from the top left. Nothing is anti-aliased, so what comes
// out is a real sprite: it is built from a grid, and the grid is shown scaled up with sharp edges.
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
  constructor(w = W, h = H) {
    this.w = w; this.h = h; this.buf = new Uint32Array(w * h);
    this.k = 1; this.cx = 32; this.hs = 1; this.cy = 28.6; // the head and what sits on it are drawn big and shrunk about the chin: x about 31.8, y about cy // body width: x is stretched about cx by k for anything drawn with the body
  }
  X(x) { return this.cx + (x - this.cx) * this.k; }
  // body: true = with the body, false = with the head (shrunk about the chin), 'raw' = exact pixel coordinates
  PX(x, body) { return body === 'raw' ? x : body ? this.X(x) : 31.8 + (x - 31.8) * this.hs; }
  PY(y, body) { return body === 'raw' ? y : body ? y : this.cy + (y - 28.6) * this.hs; }
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
    const m = this.mask(), { w, h } = this, X = this.PX(cx, body), f = body === 'raw' ? 1 : body ? this.k : this.hs, RX = rx * f;
    ry = body === 'raw' ? ry : body ? ry : ry * this.hs; cy = this.PY(cy, body);
    for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(h - 1, Math.ceil(cy + ry + 1)); y++) {
      for (let x = Math.max(0, Math.floor(X - RX - 1)); x <= Math.min(w - 1, Math.ceil(X + RX + 1)); x++) {
        const dx = (x + 0.5 - X) / RX, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) m[y * w + x] = 1;
      }
    }
    return m;
  }
  rect(x0, y0, x1, y1, body = true) { return this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], body); }
  /** A thick path: [[x, y, width], ...]. Good for arms, legs, braids and straps. */
  limb(pts, body = true) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const [x, y, wd] = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const nx = -dy * wd / 2, ny = dx * wd / 2;
      L.push([x + nx, y + ny]); R.unshift([x - nx, y - ny]);
    }
    return this.poly([...L, ...R], body);
  }
  or(...ms) { const o = this.mask(); for (const m of ms) if (m) for (let i = 0; i < o.length; i++) if (m[i]) o[i] = 1; return o; }
  sub(a, b) { const o = a.slice(); for (let i = 0; i < o.length; i++) if (b[i]) o[i] = 0; return o; }
  and(a, b) { const o = this.mask(); for (let i = 0; i < o.length; i++) if (a[i] && b[i]) o[i] = 1; return o; }
  shift(m, dx, dy) {
    const o = this.mask(), { w, h } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) o[ny * w + nx] = 1; }
    return o;
  }

  /** Fill a mask: outline, base colour and hard shading bands (bright top-left edge, darker right and bottom). */
  paint(m, colour, o = {}) {
    const { w, h, buf } = this;
    if (o.alpha != null) { const c = pack(...hexToRgb(colour), o.alpha); for (let i = 0; i < m.length; i++) if (m[i]) buf[i] = c; return this; }
    if (o.line !== false) {
      const oc = pack(...tone(o.line || colour, o.lineAmt ?? 0.62));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (m[i]) continue;
        if ((x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w])) buf[i] = oc;
      }
    }
    const c0 = pack(...hexToRgb(colour)), cH = pack(...tone(colour, -(o.hiAmt ?? 0.2))), c1 = pack(...tone(colour, o.d1 ?? 0.17)), c2 = pack(...tone(colour, o.d2 ?? 0.32));
    const rr = new Int16Array(w * h), bb = new Int16Array(w * h), ll = new Int16Array(w * h), tt = new Int16Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = w - 1; x >= 0; x--) { const i = y * w + x; rr[i] = m[i] ? (x < w - 1 && m[i + 1] ? rr[i + 1] + 1 : 0) : -1; }
      for (let x = 0; x < w; x++) { const i = y * w + x; ll[i] = m[i] ? (x > 0 && m[i - 1] ? ll[i - 1] + 1 : 0) : -1; }
    }
    for (let x = 0; x < w; x++) {
      for (let y = h - 1; y >= 0; y--) { const i = y * w + x; bb[i] = m[i] ? (y < h - 1 && m[i + w] ? bb[i + w] + 1 : 0) : -1; }
      for (let y = 0; y < h; y++) { const i = y * w + x; tt[i] = m[i] ? (y > 0 && m[i - w] ? tt[i - w] + 1 : 0) : -1; }
    }
    const flat = o.flat, noHi = o.hi === false, bands = o.bands ?? 2;
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      let c = c0;
      if (!flat) {
        const wide = ll[i] + rr[i] >= 3, tall = tt[i] + bb[i] >= 3;
        if (wide && rr[i] === 0 && ll[i] >= 2) c = c2;
        else if (tall && bb[i] === 0 && tt[i] >= 2) c = c2;
        else if (bands > 1 && wide && rr[i] === 1 && ll[i] >= 2) c = c1;
        else if (bands > 1 && tall && bb[i] === 1 && tt[i] >= 2) c = c1;
        else if (!noHi && ((ll[i] === 0 && rr[i] >= 2) || (tt[i] === 0 && bb[i] >= 2))) c = cH;
      }
      buf[i] = c;
    }
    return this;
  }
  /** Flat fill, no outline or shading. For details on top of a shape. */
  flat(m, colour, alpha = 255) { const c = pack(...hexToRgb(colour), alpha); for (let i = 0; i < m.length; i++) if (m[i]) this.buf[i] = c; return this; }
  /** Detail only where a shape and the mask under it overlap. */
  inside(shape, m, colour) { return this.flat(this.and(shape, m), colour); }
  dot(x, y, colour, body = true) {
    const px = Math.round(this.PX(x, body)), py = Math.round(this.PY(y, body));
    if (px >= 0 && py >= 0 && px < this.w && py < this.h) this.buf[py * this.w + px] = pack(...hexToRgb(colour));
    return this;
  }
  line(x0, y0, x1, y1, colour, body = true, clip = null) {
    let ax = Math.round(this.PX(x0, body)), ay = Math.round(this.PY(y0, body)); const bx = Math.round(this.PX(x1, body)), by = Math.round(this.PY(y1, body));
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1; let err = dx + dy;
    for (;;) {
      if (ax >= 0 && ay >= 0 && ax < this.w && ay < this.h && (!clip || clip[ay * this.w + ax])) this.buf[ay * this.w + ax] = pack(...hexToRgb(colour));
      if (ax === bx && ay === by) break;
      const e2 = 2 * err; if (e2 >= dy) { err += dy; ax += sx; } if (e2 <= dx) { err += dx; ay += sy; }
    }
    return this;
  }
  /** Rows of text as pixels: '.' is empty, other letters look up in pal. (x, y) is the top-left. */
  art(x, y, rows, pal, body = true) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && ch !== ' ' && pal[ch]) this.dot(x + i, y + j, pal[ch], body); }));
    return this;
  }

  /** Cut out a window of the sprite. */
  crop(x, y, w, h) {
    const out = new Uint32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const sx = x + i, sy = y + j; if (sx >= 0 && sy >= 0 && sx < this.w && sy < this.h) out[j * w + i] = this.buf[sy * this.w + sx]; }
    return { w, h, data: out };
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
  return `<svg viewBox="0 0 ${c.w} ${c.h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">${rects.join('')}</svg>`;
}
