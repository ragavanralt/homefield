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

export const DEFAULT_APPEARANCE = { theme: 'auto', bgDark: 'midnight', bgLight: 'paper', accent: 'coral' };

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
  root.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', pick.bg);
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
