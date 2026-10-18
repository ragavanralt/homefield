// A league tab: games by day, plus standings.
import { h, clear, crest, errorBox, loading, emptyState, poll } from '../ui.js';
import { CONFIG } from '../config.js';
import { getState, update, myTeamIn } from '../store.js';
import { LEAGUES, SOCCER_KEYS, isSoccer } from '../leagues.js';
import { getScoreboard, hasPlayoffs } from '../espn.js';
import { renderStandings, renderBracket, hasPicture } from './tables.js';
import { gameCard, pageHead } from '../components.js';
import { watchScore } from '../winprob.js';
import { addDays, fmtDayLong, sameDay, ymd, pad } from '../util.js';

export async function render(root, { id }) {
  const soccerTab = id === 'soccer';
  let league = soccerTab ? (SOCCER_KEYS.includes(getState().soccerLeague) ? getState().soccerLeague : 'uefa.champions') : id;
  if (!LEAGUES[league]) { root.append(errorBox(new Error('Unknown league'))); return; }
  let date = new Date();
  let view = 'games';
  let stMode = 'picture';
  let onlyMine = false;
  let anyLive = false;

  root.append(pageHead(soccerTab ? 'Soccer' : LEAGUES[league].label));
  const controls = h('div', { class: 'controls' });
  const body = h('div', { class: 'stack' });
  root.append(controls, body);

  function drawControls() {
    clear(controls);
    if (soccerTab) {
      controls.append(h('select', { class: 'select', id: 'comp', 'aria-label': 'Competition', onchange: (e) => { league = e.target.value; update((s) => { s.soccerLeague = league; }); if (view === 'playoffs' && !hasPlayoffs(league)) view = 'games'; drawControls(); load(); } },
        SOCCER_KEYS.map((k) => h('option', { value: k, selected: k === league }, LEAGUES[k].label))));
    }
    controls.append(h('div', { class: 'seg' },
      h('button', { type: 'button', class: 'seg-b' + (view === 'games' ? ' on' : ''), onclick: () => { view = 'games'; drawControls(); load(); } }, 'Games'),
      h('button', { type: 'button', class: 'seg-b' + (view === 'standings' ? ' on' : ''), onclick: () => { view = 'standings'; drawControls(); load(); } }, 'Standings'),
      hasPlayoffs(league) ? h('button', { type: 'button', class: 'seg-b' + (view === 'playoffs' ? ' on' : ''), id: 'view-playoffs', onclick: () => { view = 'playoffs'; drawControls(); load(); } }, 'Playoffs') : null));
    if (view === 'standings' && hasPicture(league)) {
      controls.append(h('div', { class: 'seg' }, [['picture', 'Playoff picture'], ['tables', 'Divisions']].map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (stMode === k ? ' on' : ''), id: 'st-' + k, onclick: () => { stMode = k; drawControls(); load(); } }, l))));
    }
    if (view === 'games') {
      const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      controls.append(h('div', { class: 'datebar' },
        h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Previous day', onclick: () => { date = addDays(date, -1); drawControls(); load(); } }, '‹'),
        h('div', { class: 'date-l' }, sameDay(date, new Date()) ? 'Today' : fmtDayLong(date)),
        h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Next day', onclick: () => { date = addDays(date, 1); drawControls(); load(); } }, '›'),
        h('input', { class: 'date-in', type: 'date', id: 'pick-date', value: iso, 'aria-label': 'Jump to date', onchange: (e) => { const [y, m, d] = e.target.value.split('-').map(Number); if (y) { date = new Date(y, m - 1, d); drawControls(); load(); } } }),
        sameDay(date, new Date()) ? null : h('button', { type: 'button', class: 'btn small', onclick: () => { date = new Date(); drawControls(); load(); } }, 'Today'),
        getState().teams.length ? h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'only-mine', checked: onlyMine, onchange: (e) => { onlyMine = e.target.checked; load(); } }), 'My teams only') : null,
      ));
    }
  }

  async function load(quiet = false) {
    const my = ++token;
    if (!quiet) clear(body).append(loading());
    try {
      if (view === 'standings') { await renderStandings(body, league, stMode); if (my !== token) return; return; }
      if (view === 'playoffs') { await renderBracket(body, league); return; }
      const games = await getScoreboard(league, ymd(date));
      if (my !== token) return;
      anyLive = games.some((g) => g.state === 'in');
      const list = onlyMine ? games.filter((g) => myTeamIn(g)) : games;
      clear(body);
      if (!list.length) {
        body.append(emptyState(onlyMine ? 'None of your teams play this day' : 'No games this day', 'Try the arrows to move to another day.'));
        return;
      }
      const group = (title, arr) => arr.length && body.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, title, h('small', null, String(arr.length))), h('div', { class: 'cards' }, arr.map((g) => gameCard(g, { team: myTeamIn(g) })))));
      group('Live', list.filter((g) => g.state === 'in').sort((a, b) => (watchScore(b) ?? 0) - (watchScore(a) ?? 0)));
      group('Upcoming', list.filter((g) => g.state === 'pre').sort((a, b) => new Date(a.date) - new Date(b.date)));
      group('Final', list.filter((g) => g.state === 'post').sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (e) {
      if (my === token && !quiet) clear(body).append(errorBox(e, () => load()));
    }
  }

  let token = 0;
  drawControls();
  await load();
  return poll(() => { if (view === 'games' && sameDay(date, new Date())) load(true); }, CONFIG.refreshMs, () => anyLive);
}
