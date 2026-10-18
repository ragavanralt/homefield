// Gives the fan a pixel-art finish. The character is still drawn as an SVG; this draws it small, snaps the
// edges and colours to a coarse grid, and shows that scaled up with hard edges. If anything goes wrong
// (no canvas, an old browser) the smooth SVG stays on screen.
const CELL = 1.0;          // size of one "pixel", in drawing units
const STEP = 10;            // colours snap to steps this big (0-255)
const cache = new Map();

function quant(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 120) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round(d[i + k] / STEP) * STEP));
  }
  ctx.putImageData(img, 0, 0);
}

function raster(svg) {
  const vb = svg.viewBox.baseVal;
  if (!vb || !vb.width) return Promise.reject(new Error('no view box'));
  const w = Math.max(8, Math.round(vb.width / CELL)), h = Math.max(8, Math.round(vb.height / CELL));
  const clone = svg.cloneNode(true);
  clone.setAttribute('width', w); clone.setAttribute('height', h);
  clone.removeAttribute('data-px');
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clone.outerHTML);
  if (cache.has(url)) return Promise.resolve(cache.get(url));
  return new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0, w, h); quant(x, w, h);
        const out = c.toDataURL('image/png');
        if (cache.size > 300) cache.clear();
        cache.set(url, out); ok(out);
      } catch (e) { no(e); }
    };
    im.onerror = no; im.src = url;
  });
}

/** Swap every smooth character under root for its pixel version. */
export function pixelate(root = document) {
  if (typeof document === 'undefined' || !root.querySelectorAll) return;
  root.querySelectorAll('.avatar svg:not([data-px])').forEach((svg) => {
    svg.setAttribute('data-px', '1');
    raster(svg).then((src) => {
      if (!svg.isConnected) return;
      const im = document.createElement('img');
      im.className = 'px'; im.alt = svg.getAttribute('aria-label') || ''; im.src = src; im.draggable = false;
      svg.replaceWith(im);
    }).catch(() => { /* keep the SVG */ });
  });
}

/** Watch the page and pixelate characters as they appear. */
export function startPixelate() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || !document.createElement('canvas').getContext) return;
  let queued = false;
  const go = () => { queued = false; pixelate(document.body); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(go); } }).observe(document.body, { childList: true, subtree: true });
  go();
}
