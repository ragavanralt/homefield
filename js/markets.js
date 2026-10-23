// Bet buttons and market panels: winner, player props (by stat), first scorer, game bets.
// Tapping a price adds it to the betslip (tap again to remove).
import { h, clear, face, loading, toast } from './ui.js';
import { toggleLeg, slipHas } from './store.js';
import { isSoccer } from './leagues.js';
import { moneylines, mlLeg, propLeg, american, propCatsFor, MAX_LEGS } from './bets.js';
import { gameBets, firstLeg, hasFirst, FIRST } from './specials.js';
import { loadPropsCat, loadFirst } from './props.js';

const open = (g) => g.state === 'pre' && new Date(g.date).getTime() > Date.now() && !g.void;

export function betButton(leg, top, sub, disabled) {
  return h('button', { type: 'button', class: 'bet-btn', 'data-key': leg.key, 'aria-pressed': slipHas(leg.key) ? 'true' : 'false', disabled: disabled || null, onclick: () => { if (!toggleLeg(leg).ok) toast(`Your slip is full: ${MAX_LEGS} picks max. Remove one to add this.`); } },
    h('span', { class: 'bb-t' }, top), h('span', { class: 'bb-o' }, american(leg.dec)), sub ? h('small', null, sub) : null);
}

/** Winner buttons for one game. */
export function moneylineRow(g) {
  const ml = moneylines(g);
  const sides = isSoccer(g.league) ? ['home', 'draw', 'away'] : ['away', 'home'];
  const can = open(g);
  return h('div', { class: 'ml-row' + (sides.length === 3 ? ' three' : '') }, sides.map((s) => betButton(mlLeg(g, s), s === 'draw' ? 'Draw' : g[s].abbr, null, !can)));
}

const note = (t) => h('p', { class: 'muted small-note' }, t);
const why = (notes) => (notes && notes.length ? h('details', { class: 'small-note' }, h('summary', null, 'Details'), h('ul', null, notes.map((n) => h('li', null, n)))) : null);

/** Group a market result by team and draw each row with draw(m). */
function byTeam(g, data, draw) {
  const parts = [];
  for (const side of ['away', 'home', 'other']) {
    const list = data[side] || [];
    if (!list.length) continue;
    parts.push(h('div', { class: 'pr-team' }, side === 'other' ? 'Players' : (g[side].name || g[side].abbr)), h('div', { class: 'pr-list' }, list.map(draw)));
  }
  return parts;
}

/** Player props, split into stat chips so each list is short. */
export function propsPanel(g) {
  const cats = propCatsFor(g.league);
  const wrap = h('div', { class: 'mk' });
  if (!cats.length) { wrap.append(note('Player props are available for NBA, NHL, NFL, MLB and soccer.')); return wrap; }
  const chips = h('div', { class: 'chip-row' });
  const body = h('div', { class: 'props' });
  let cur = cats[0], token = 0;
  const can = open(g);
  const drawChips = () => { clear(chips).append(...cats.map((c) => h('button', { type: 'button', class: 'chip' + (c === cur ? ' on' : ''), 'aria-pressed': c === cur ? 'true' : 'false', id: 'cat-' + c.id, onclick: () => { cur = c; drawChips(); load(); } }, c.label))); };
  async function load() {
    const my = ++token;
    clear(body).append(loading('Loading ' + cur.label.toLowerCase()));
    try {
      const data = await loadPropsCat(g, cur);
      if (my !== token) return;
      clear(body);
      const rows = byTeam(g, data, (m) => h('div', { class: 'pr-row' },
        h('div', { class: 'pr-who' }, face(m, g.league, 34), h('div', null, h('div', { class: 'pr-n' }, m.short || m.name), h('small', null, [m.pos, m.label].filter(Boolean).join(' · ')))),
        h('div', { class: 'pr-line' }, String(m.line)),
        h('div', { class: 'pr-btns' }, betButton(propLeg(g, m, 'over'), 'Over', null, !can), betButton(propLeg(g, m, 'under'), 'Under', null, !can))));
      if (!rows.length) body.append(note('No ' + cur.label.toLowerCase() + ' props could be built for this game yet.'));
      else body.append(...rows);
      body.append(note(`${data.source ? data.source + '. ' : ''}Settled from the final box score. A player who does not play is refunded.`), why(data.notes));
    } catch (e) { if (my === token) clear(body).append(note('Could not load props: ' + e.message)); }
  }
  drawChips(); load();
  wrap.append(chips, body);
  return wrap;
}

/** First scorer: first touchdown (NFL), first goal (NHL), first basket (NBA). */
export function scorerPanel(g) {
  const wrap = h('div', { class: 'mk' });
  if (!hasFirst(g.league)) { wrap.append(note('First scorer is available for NFL, NHL and NBA games.')); return wrap; }
  const can = open(g);
  wrap.append(loading('Loading first scorer prices'));
  (async () => {
    try {
      const data = await loadFirst(g);
      clear(wrap);
      const rows = byTeam(g, data, (m) => {
        const dec = m.dec;
        const leg = firstLeg(g, { ...m, dec });
        return h('div', { class: 'pr-row first' },
          h('div', { class: 'pr-who' }, face(m, g.league, 34), h('div', null, h('div', { class: 'pr-n' }, m.short || m.name), h('small', null, [m.pos, m.label].filter(Boolean).join(' · ')))),
          h('div', { class: 'pr-btns' }, betButton(leg, 'Yes', null, !can)));
      });
      if (!rows.length) wrap.append(note('No first scorer prices yet. They need rosters and season stats, or a live-lines key in Settings.'));
      else wrap.append(h('p', { class: 'mk-t' }, (FIRST[g.league] || {}).label || 'First scorer'), ...rows);
      wrap.append(note(`${data.source ? data.source + '. ' : ''}${g.league === 'nfl' ? 'Counts touchdowns only. ' : ''}If nobody qualifies, the bet is refunded.`), why(data.notes));
    } catch (e) { clear(wrap).append(note('Could not load first scorer: ' + e.message)); }
  })();
  return wrap;
}

/** Neutral bets: total, spread, first team to score, overtime, turnovers, both teams to score. */
export function gameBetsPanel(g) {
  const can = open(g);
  const list = gameBets(g);
  const wrap = h('div', { class: 'mk' });
  if (!list.length) { wrap.append(note('No game bets for this one yet.')); return wrap; }
  const sections = [
    ['Scoring', ['total', 'spread', 'first', 'btts']],
    ['Other', ['ot', 'to-total', 'to-away', 'to-home']],
  ];
  for (const [title, ids] of sections) {
    const picks = list.filter((m) => ids.includes(m.id));
    if (!picks.length) continue;
    wrap.append(h('p', { class: 'mk-t' }, title), ...picks.map((m) => h('div', { class: 'gb' },
      h('div', { class: 'gb-t' }, m.title),
      h('div', { class: 'ml-row' + (m.legs.length === 3 ? ' three' : '') }, m.legs.map((l) => betButton(l, l.label.replace(/ (turnovers|total|goals)$/, ''), null, !can))))));
  }
  wrap.append(note('Prices come from the feed\'s lines where there are any, and from a simple model otherwise. Settled from the final score, box score and play by play.'));
  return wrap;
}

/** All four sections as tabs. Used on the game page. */
export function marketTabs(g, start = 'winner') {
  const TABS = [['winner', 'Winner'], ['props', 'Player props'], ['first', 'First scorer'], ['game', 'Game bets']];
  const wrap = h('div', { class: 'mkt' });
  const bar = h('div', { class: 'seg mk-tabs' });
  const body = h('div');
  let cur = start;
  const make = (k) => (k === 'winner' ? moneylineRow(g) : k === 'props' ? propsPanel(g) : k === 'first' ? scorerPanel(g) : gameBetsPanel(g));
  const built = {};
  const draw = () => {
    clear(bar).append(...TABS.map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (k === cur ? ' on' : ''), id: 'mk-' + k, onclick: () => { cur = k; draw(); } }, l)));
    clear(body).append((built[cur] ||= make(cur)));
  };
  draw();
  wrap.append(bar, body);
  return wrap;
}
export const panelFor = (type, g) => (type === 'props' ? propsPanel(g) : type === 'first' ? scorerPanel(g) : type === 'game' ? gameBetsPanel(g) : moneylineRow(g));

/** Sync pressed state on every bet button on screen. */
export function syncButtons() {
  document.querySelectorAll('.bet-btn[data-key]').forEach((b) => b.setAttribute('aria-pressed', slipHas(b.dataset.key) ? 'true' : 'false'));
}
