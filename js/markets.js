// Bet buttons: moneyline and player props. Tapping one adds it to the betslip (tap again to remove).
import { h, clear, face, loading } from './ui.js';
import { toggleLeg, slipHas } from './store.js';
import { isSoccer } from './leagues.js';
import { moneylines, mlLeg, propLeg, american } from './bets.js';
import { loadProps } from './props.js';

const open = (g) => g.state === 'pre' && new Date(g.date).getTime() > Date.now() && !g.void;

export function betButton(leg, top, sub, disabled) {
  return h('button', { type: 'button', class: 'bet-btn', 'data-key': leg.key, 'aria-pressed': slipHas(leg.key) ? 'true' : 'false', disabled: disabled || null, onclick: () => toggleLeg(leg) },
    h('span', { class: 'bb-t' }, top), h('span', { class: 'bb-o' }, american(leg.dec)), sub ? h('small', null, sub) : null);
}

/** Winner buttons for one game. */
export function moneylineRow(g) {
  const ml = moneylines(g);
  const sides = isSoccer(g.league) ? ['home', 'draw', 'away'] : ['away', 'home'];
  const can = open(g);
  return h('div', { class: 'ml-row' + (sides.length === 3 ? ' three' : '') }, sides.map((s) => betButton(mlLeg(g, s), s === 'draw' ? 'Draw' : g[s].abbr, null, !can)));
}

/** Player props for both teams. Loads from the feed when first shown. */
export function propsPanel(g) {
  const host = h('div', { class: 'props' }, loading('Loading player props'));
  const can = open(g);
  (async () => {
    try {
      const data = await loadProps(g);
      clear(host);
      if (!data.supported) { host.append(h('p', { class: 'muted small-note' }, 'Player props are available for NBA, NHL, NFL and MLB. Soccer has winner bets only.')); return; }
      if (!data.home.length && !data.away.length) { host.append(h('p', { class: 'muted small-note' }, 'No player props yet. They show up once the feed has rosters and season stats for these teams.')); return; }
      for (const side of ['away', 'home']) {
        const list = data[side];
        if (!list.length) continue;
        host.append(h('div', { class: 'pr-team' }, g[side].name || g[side].abbr),
          h('div', { class: 'pr-list' }, list.map((m) => h('div', { class: 'pr-row' },
            h('div', { class: 'pr-who' }, face(m, g.league, 34), h('div', null, h('div', { class: 'pr-n' }, m.short || m.name), h('small', null, [m.pos, m.label].filter(Boolean).join(' · ')))),
            h('div', { class: 'pr-line' }, String(m.line)),
            h('div', { class: 'pr-btns' }, betButton(propLeg(g, m, 'over'), 'Over', null, !can), betButton(propLeg(g, m, 'under'), 'Under', null, !can))))));
      }
      host.append(h('p', { class: 'muted small-note' }, 'Lines are set from each player\'s season average in the feed. Settled from the final box score. A player who does not play is refunded.'));
    } catch (e) { clear(host).append(h('p', { class: 'muted small-note' }, 'Could not load props: ' + e.message)); }
  })();
  return host;
}

/** Sync pressed state on every bet button on screen. */
export function syncButtons() {
  document.querySelectorAll('.bet-btn[data-key]').forEach((b) => b.setAttribute('aria-pressed', slipHas(b.dataset.key) ? 'true' : 'false'));
}
