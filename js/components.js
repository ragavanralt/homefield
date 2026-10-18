// Reusable pieces: game cards and the watch-worthy meter.
import { h, crest, applySkin, isHidden, scoreText } from './ui.js';
import { isSoccer, leagueLabel, LEAGUES, MAJOR_KEYS, SOCCER_KEYS } from './leagues.js';
import { getState, toggleHidden, setSetting } from './store.js';
import { BACKGROUNDS, ACCENTS, DEFAULT_APPEARANCE, applyTheme, resolveMode } from './themes.js';
import { watchScore, watchLabel, watchReason } from './winprob.js';
import { fmtDay, fmtTime, sameDay } from './util.js';
import { rememberGame } from './espn.js';

export const pageHead = (title, sub) => h('div', { class: 'page-head' }, h('h1', null, title), sub ? h('p', null, sub) : null);

export function statusInfo(g) {
  if (g.void) return { text: 'Postponed', cls: 'void', sub: '' };
  if (g.state === 'in') return { text: g.shortDetail || 'Live', cls: 'live', sub: '' };
  if (g.state === 'post') return { text: g.shortDetail && g.shortDetail !== 'Final' ? g.shortDetail : 'Final', cls: 'final', sub: '' };
  const d = new Date(g.date);
  const today = sameDay(d, new Date());
  return { text: fmtTime(g.date), cls: 'pre', sub: today ? 'Today' : fmtDay(g.date) };
}

export function gameCard(g, { team = null, showLeague = false } = {}) {
  const st = statusInfo(g);
  const order = isSoccer(g.league) ? ['home', 'away'] : ['away', 'home'];
  const other = (side) => (side === 'home' ? 'away' : 'home');
  const row = (side) => {
    const t = g[side];
    const lose = g.state === 'post' && (g[other(side)].score ?? 0) > (t.score ?? 0);
    return h('div', { class: 'gt' + (lose ? ' lose' : '') },
      crest(t, 34),
      h('div', { class: 'nm' }, h('span', { class: 'n' }, t.name || t.abbr), t.record ? h('small', null, t.record) : null),
      g.state === 'pre' ? null : h('div', { class: 'sc' }, scoreText(g, side)),
    );
  };
  const ws = isHidden(g) ? null : watchScore(g);
  const meta = [showLeague ? leagueLabel(g.league) : '', g.venue, g.broadcast].filter(Boolean).join(' · ');
  const card = h('a', { class: `gcard ${g.state}${team ? ' mine' : ''}`, href: `#/game/${g.league}/${g.id}`, onclick: () => rememberGame(g) },
    h('div', { class: 'g-main' },
      h('div', { class: 'g-teams' }, order.map(row)),
      h('div', { class: 'g-stat' }, h('span', { class: 'st ' + st.cls }, st.cls === 'live' ? h('i', { class: 'ldot' }) : null, st.text), st.sub ? h('small', null, st.sub) : null),
    ),
    meta ? h('div', { class: 'g-meta' }, meta) : null,
    ws != null ? h('div', { class: 'g-watch' },
      h('div', { class: 'wbar' }, h('i', { style: { width: ws + '%' } })),
      h('span', null, `Watch-worthy ${ws}`), h('em', null, watchLabel(ws))) : null,
  );
  if (team) applySkin(card, team.color, team.alt);
  return card;
}

export function watchBlock(g) {
  const ws = watchScore(g);
  if (ws == null) return null;
  return h('div', { class: 'watch' },
    h('div', { class: 'w-num' }, String(ws), h('small', null, '/100')),
    h('div', { class: 'w-body' },
      h('div', { class: 'eyebrow' }, 'Watch-worthy meter'),
      h('div', { class: 'wbar big' }, h('i', { style: { width: ws + '%' } })),
      h('div', { class: 'w-line' }, h('span', { class: 'w-label' }, watchLabel(ws)), ' · ', watchReason(g)),
    ),
  );
}

/** Chips to hide leagues from Home and Pick'em. A hidden league still has its own tab. */
export function hideChips() {
  const host = h('div', { class: 'chip-grid', id: 'hide-chips' });
  const draw = () => {
    host.replaceChildren(
      ...[['Major leagues', MAJOR_KEYS], ['Soccer', SOCCER_KEYS]].map(([title, keys]) => h('div', { class: 'chip-row' }, h('span', { class: 'chip-label' }, title),
        keys.map((k) => {
          const hid = (getState().settings.hidden || []).includes(k);
          return h('button', { type: 'button', class: 'chip hide-chip' + (hid ? ' is-hidden' : ''), id: 'hide-' + k.replace('.', '-'), 'aria-pressed': hid ? 'true' : 'false', onclick: () => { toggleHidden(k); draw(); } }, LEAGUES[k].label, hid ? h('small', null, 'hidden') : null);
        }))));
  };
  draw();
  return host;
}

/** Theme, background and accent pickers. Applies changes straight away. */
export function appearanceCard(title = 'Appearance') {
  const host = h('section', { class: 'card', id: 'appearance' });
  const repaint = () => applyTheme(getState().settings);
  const draw = () => {
    const s = getState().settings;
    const mode = resolveMode(s.theme);
    const key = mode === 'dark' ? 'bgDark' : 'bgLight';
    const swatch = (label, bg, on, onclick, id) => h('button', { type: 'button', class: 'swatch', id, 'aria-pressed': on ? 'true' : 'false', onclick }, h('i', { style: { background: bg } }), label);
    host.replaceChildren(h('h2', { class: 'card-h' }, title),
      h('div', { class: 'set-row' }, h('div', { class: 'set-l' }, 'Theme'),
        h('div', { class: 'seg' }, [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']].map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (s.theme === k ? ' on' : ''), id: 'theme-' + k, onclick: () => { setSetting('theme', k); repaint(); draw(); } }, l))),
        h('small', null, s.theme === 'auto' ? 'Follows your phone or computer.' : '')),
      h('div', { class: 'set-row' }, h('div', { class: 'set-l' }, `Background (${mode})`),
        h('div', { class: 'swatches' }, BACKGROUNDS[mode].map((b) => swatch(b.name, `linear-gradient(135deg, ${b.bg} 50%, ${b.surface} 50%)`, s[key] === b.id, () => { setSetting(key, b.id); repaint(); draw(); }, 'bg-' + b.id)))),
      h('div', { class: 'set-row' }, h('div', { class: 'set-l' }, 'Accent colour'),
        h('div', { class: 'swatches' }, ACCENTS.map((a) => swatch(a.name, `linear-gradient(135deg, ${a.a}, ${a.b})`, s.accent === a.id, () => { setSetting('accent', a.id); repaint(); draw(); }, 'acc-' + a.id)))),
      h('div', { class: 'set-row' }, h('button', { type: 'button', class: 'btn small', id: 'reset-look', onclick: () => { Object.entries(DEFAULT_APPEARANCE).forEach(([k, v]) => setSetting(k, v)); repaint(); draw(); } }, 'Reset to default')));
  };
  draw();
  return host;
}
