// A league tab: games by day, plus standings.
import { h, clear, crest, errorBox, loading, emptyState, poll } from '../ui.js';
import { CONFIG } from '../config.js';
import { getState, update, myTeamIn } from '../store.js';
import { LEAGUES, SOCCER_KEYS, isSoccer } from '../leagues.js';
import { getScoreboard, getStandings } from '../espn.js';
import { gameCard, pageHead } from '../components.js';
import { watchScore } from '../winprob.js';
import { addDays, fmtDayLong, sameDay, ymd, pad } from '../util.js';

const COLS = {
  nba: ['wins', 'losses', 'winPercent', 'gamesBehind', 'streak'],
  nhl: ['gamesPlayed', 'wins', 'losses', 'otLosses', 'points'],
  nfl: ['wins', 'losses', 'ties', 'winPercent'],
  mlb: ['wins', 'losses', 'winPercent', 'gamesBehind', 'streak'],
  soccer: ['gamesPlayed', 'wins', 'ties', 'losses', 'pointDifferential', 'points'],
};

export async function render(root, { id }) {
  const soccerTab = id === 'soccer';
  let league = soccerTab ? (SOCCER_KEYS.includes(getState().soccerLeague) ? getState().soccerLeague : 'uefa.champions') : id;
  if (!LEAGUES[league]) { root.append(errorBox(new Error('Unknown league'))); return; }
  let date = new Date();
  let view = 'games';
  let onlyMine = false;
  let anyLive = false;

  root.append(pageHead(soccerTab ? 'Soccer' : LEAGUES[league].label));
  const controls = h('div', { class: 'controls' });
  const body = h('div', { class: 'stack' });
  root.append(controls, body);

  function drawControls() {
    clear(controls);
    if (soccerTab) {
      controls.append(h('select', { class: 'select', id: 'comp', 'aria-label': 'Competition', onchange: (e) => { league = e.target.value; update((s) => { s.soccerLeague = league; }); load(); } },
        SOCCER_KEYS.map((k) => h('option', { value: k, selected: k === league }, LEAGUES[k].label))));
    }
    controls.append(h('div', { class: 'seg' },
      h('button', { type: 'button', class: 'seg-b' + (view === 'games' ? ' on' : ''), onclick: () => { view = 'games'; drawControls(); load(); } }, 'Games'),
      h('button', { type: 'button', class: 'seg-b' + (view === 'standings' ? ' on' : ''), onclick: () => { view = 'standings'; drawControls(); load(); } }, 'Standings')));
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
      if (view === 'standings') {
        const groups = await getStandings(league);
        if (my !== token) return;
        clear(body);
        if (!groups.length) { body.append(emptyState('No standings yet', 'The feed has no table for this league right now.')); return; }
        const cols = COLS[LEAGUES[league].group];
        groups.forEach((gr) => {
          const first = gr.rows[0]?.stats || {};
          const use = cols.filter((c) => first[c]);
          const rows = [...gr.rows];
          if (rows.every((r) => r.stats.rank)) rows.sort((a, b) => a.stats.rank.value - b.stats.rank.value);
          body.append(h('section', { class: 'blk' }, gr.name ? h('h2', { class: 'blk-h' }, gr.name) : null,
            h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl' },
              h('thead', null, h('tr', null, h('th', null, '#'), h('th', { class: 'l' }, 'Team'), use.map((c) => h('th', null, first[c].abbr || c)))),
              h('tbody', null, rows.map((r, i) => {
                const mine = getState().teams.some((t) => t.id === r.team.id && (t.league === league || isSoccer(t.league) === isSoccer(league)));
                return h('tr', { class: mine ? 'mine' : '' }, h('td', null, i + 1),
                  h('td', { class: 'l team-cell' }, crest(r.team, 22), h('span', null, r.team.name || r.team.abbr)),
                  use.map((c) => h('td', null, r.stats[c] ? r.stats[c].v : '')));
              }))))));
        });
        return;
      }
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
