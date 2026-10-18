import { hexToRgb, contrast, mix, lighten, darken, colorDistance } from './util.js';
// Appearance: light/dark mode, background colour and accent colour. Saved in settings, applied as CSS variables.
export const BACKGROUNDS = {
  dark: [
    { id: 'midnight', name: 'Midnight', bg: '#0A0E1C', surface: '#121831', surface2: '#1A2142', line: '#262E52' },
    { id: 'black', name: 'Black', bg: '#000000', surface: '#0E0E12', surface2: '#18181E', line: '#2A2A33' },
    { id: 'graphite', name: 'Graphite', bg: '#111316', surface: '#1A1D21', surface2: '#23272D', line: '#333941' },
    { id: 'forest', name: 'Forest', bg: '#08110D', surface: '#0F1C16', surface2: '#162821', line: '#22382F' },
    { id: 'wine', name: 'Wine', bg: '#140A10', surface: '#1F1119', surface2: '#2A1823', line: '#3C2434' },
    { id: 'navy', name: 'Navy', bg: '#06122B', surface: '#0C1D40', surface2: '#122855', line: '#1D3A72' },
  ],
  light: [
    { id: 'paper', name: 'Paper', bg: '#F2F4FB', surface: '#FFFFFF', surface2: '#EAEDF8', line: '#D5DAEE' },
    { id: 'white', name: 'White', bg: '#FFFFFF', surface: '#F6F7FA', surface2: '#ECEEF3', line: '#DADDE6' },
    { id: 'warm', name: 'Warm', bg: '#FAF5EC', surface: '#FFFDF8', surface2: '#F1E9DA', line: '#E3D8C3' },
    { id: 'mint', name: 'Mint', bg: '#EEF7F2', surface: '#FFFFFF', surface2: '#E0EFE7', line: '#C8DFD2' },
    { id: 'sky', name: 'Sky', bg: '#EAF3FC', surface: '#FFFFFF', surface2: '#DCEAF8', line: '#C3D8EE' },
  ],
};

export const ACCENTS = [
  { id: 'coral', name: 'Coral', a: '#FF4D66', b: '#FF8A4D', ink: '#FFFFFF' },
  { id: 'volt', name: 'Volt', a: '#FFD43B', b: '#FF9F1C', ink: '#1B1500' },
  { id: 'aqua', name: 'Aqua', a: '#2BD9EC', b: '#3B82F6', ink: '#04202A' },
  { id: 'violet', name: 'Violet', a: '#8F74FF', b: '#D45CFF', ink: '#FFFFFF' },
  { id: 'green', name: 'Green', a: '#3DDC97', b: '#B6E83B', ink: '#04210F' },
  { id: 'blue', name: 'Blue', a: '#3B82F6', b: '#6366F1', ink: '#FFFFFF' },
];

export const DEFAULT_APPEARANCE = { theme: 'auto', bgDark: 'midnight', bgLight: 'paper', accent: 'coral', teamMode: true };


/* ---------- team mode ---------- */
// Backgrounds and accents taken from a team's colours. Dark and light get their own versions so
// text stays readable in both. Which team: the one with the next game, or the one you are looking at.
const hex = (c) => { const h = String(c || '').replace('#', ''); return hexToRgb(h) ? '#' + h : null; };
function sat(c) {
  const { r, g, b } = hexToRgb(c); const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  const l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
}
const lift = (c, bg, min) => { let x = c; for (let i = 0; i < 14 && contrast(x, bg) < min; i++) x = lighten(x, 0.12); return x; };
const sink = (c, bg, min) => { let x = c; for (let i = 0; i < 14 && contrast(x, bg) < min; i++) x = darken(x, 0.12); return x; };
const inkFor = (...cols) => { const w = Math.min(...cols.map((c) => contrast(c, '#FFFFFF'))), d = Math.min(...cols.map((c) => contrast(c, '#0B1220'))); return w >= d ? '#FFFFFF' : '#0B1220'; };

export function teamPalette(color, alt, mode) {
  const c = hex(color) || '#3B4A8A', a = hex(alt);
  const primary = sat(c) >= 0.2 ? c : (a && sat(a) >= 0.2 ? a : c);
  let second = primary === c ? a : c;
  const dark = mode === 'dark';
  const W = '#FFFFFF', D = '#06080F';
  let bg, surface, surface2, line, acc, acc2;
  if (dark) {
    bg = mix(D, primary, 0.14); surface = mix(D, primary, 0.22); surface2 = mix(D, primary, 0.32); line = mix(D, primary, 0.45);
    acc = lift(primary, bg, 4.5);
    if (!second || colorDistance(second, primary) < 60) second = lighten(primary, 0.35);
    acc2 = lift(second, bg, 3.5);
  } else {
    bg = mix(W, primary, 0.07); surface = W; surface2 = mix(W, primary, 0.13); line = mix(W, primary, 0.24);
    acc = sink(primary, W, 4.5);
    if (!second || colorDistance(second, primary) < 60) second = darken(primary, 0.28);
    acc2 = sink(second, W, 3);
  }
  return { bg, surface, surface2, line, accent: acc, accent2: acc2, ink: inkFor(acc, acc2) };
}

let themeTeam = null, getSettings = null;
/** Remember which team the theme should follow (null for none) and repaint. */
export function setThemeTeam(team) {
  themeTeam = team && (team.color || team.alt) ? { color: team.color, alt: team.alt } : null;
  if (getSettings) applyTheme(getSettings());
}
export const bindSettings = (fn) => { getSettings = fn; };

export const resolveMode = (theme) => (theme === 'dark' || theme === 'light' ? theme : (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

export function applyTheme(settings) {
  const root = document.documentElement;
  const mode = resolveMode(settings.theme);
  root.setAttribute('data-theme', mode);
  const list = BACKGROUNDS[mode];
  const pick = list.find((b) => b.id === (mode === 'dark' ? settings.bgDark : settings.bgLight)) || list[0];
  const acc = ACCENTS.find((a) => a.id === settings.accent) || ACCENTS[0];
  const set = (k, v) => root.style.setProperty(k, v);
  set('--bg', pick.bg); set('--surface', pick.surface); set('--surface-2', pick.surface2); set('--line', pick.line);
  set('--accent', acc.a); set('--accent2', acc.b); set('--accent-ink', acc.ink);
  let bgNow = pick.bg;
  if (settings.teamMode !== false && themeTeam) {
    const t = teamPalette(themeTeam.color, themeTeam.alt, mode);
    set('--bg', t.bg); set('--surface', t.surface); set('--surface-2', t.surface2); set('--line', t.line);
    set('--accent', t.accent); set('--accent2', t.accent2); set('--accent-ink', t.ink);
    bgNow = t.bg;
  }
  root.setAttribute('data-team', settings.teamMode !== false && themeTeam ? 'on' : 'off');
  root.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bgNow);
  return mode;
}

let mq = null;
/** Re-apply when the phone or computer switches between light and dark, if the mode is Auto. */
export function watchSystem(getSettings) {
  if (mq || typeof matchMedia === 'undefined') return;
  mq = matchMedia('(prefers-color-scheme: light)');
  const fn = () => { const s = getSettings(); if (s.theme === 'auto') applyTheme(s); };
  if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
}
