// Small pure helpers: colours, dates, clocks. No DOM in here so it can be tested in Node.

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const pad = (n) => String(n).padStart(2, '0');

/* ---------- colours ---------- */
export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
export function rgbToHex({ r, g, b }) {
  const t = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return '#' + t(r) + t(g) + t(b);
}
export function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return 0;
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return a;
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}
export const darken = (h, t) => mix(h, '#000000', t);
export const lighten = (h, t) => mix(h, '#ffffff', t);
export function colorDistance(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return 999;
  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
}

/** Turn a team's feed colours into the four values the UI skins use. */
export function skinFromColors(color, alt) {
  const base = hexToRgb(color) ? (color.startsWith('#') ? color : '#' + color) : '#3B4A8A';
  const lum = luminance(base);
  const t2 = lum < 0.06 ? lighten(base, 0.22) : darken(base, 0.42);
  const WHITE = '#FFFFFF', DARK = '#0B1220';
  const minW = Math.min(contrast(base, WHITE), contrast(t2, WHITE));
  const minD = Math.min(contrast(base, DARK), contrast(t2, DARK));
  const tink = minW >= minD ? WHITE : DARK;
  let tacc;
  const altOk = alt && hexToRgb(alt) && contrast(alt, base) >= 3 && contrast(alt, t2) >= 3;
  if (altOk) tacc = alt.startsWith('#') ? alt : '#' + alt;
  else tacc = tink === WHITE ? lighten(base, 0.6) : darken(base, 0.55);
  return { t1: base, t2, tink, tacc };
}

/* ---------- dates ---------- */
export const ymd = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const parseYmd = (s) => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
export const sameDay = (a, b) => ymd(a) === ymd(b);
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtDayLong = (d) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
export const fmtDateTime = (iso) => fmtDay(iso) + ' · ' + fmtTime(iso);

/* ---------- clocks ---------- */
/** "7:32" -> 452, "0.4" -> 0.4 */
export function clockSeconds(str) {
  if (str == null || str === '') return 0;
  const s = String(str);
  if (s.includes(':')) { const [m, sec] = s.split(':'); return (+m || 0) * 60 + (parseFloat(sec) || 0); }
  const f = parseFloat(s);
  return Number.isFinite(f) ? f : 0;
}
/** "58'" -> 58, "45'+2'" -> 47 */
export function minuteFromClock(str) {
  const m = String(str || '').match(/(\d+)\s*'?(?:\s*\+\s*(\d+))?/);
  return m ? (+m[1]) + (m[2] ? +m[2] : 0) : 0;
}

export const num = (v) => {
  const x = parseFloat(v && typeof v === 'object' ? (v.displayValue ?? v.value) : v);
  return Number.isFinite(x) ? x : null;
};
export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s || '');
