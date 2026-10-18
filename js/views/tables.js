// Standings tables, playoff picture and playoff bracket for a league tab.
import { h, clear, crest, emptyState } from '../ui.js';
import { getState } from '../store.js';
import { LEAGUES, isSoccer } from '../leagues.js';
import { getStandings, getPlayoffGames, playoffWindow } from '../espn.js';
import { sortRows, recordOf, playoffPicture, pictureNote, soccerZone, soccerLegend, buildBracket } from '../playoffs.js';
import { fmtDay } from '../util.js';

const COLS = {
  nba: ['wins', 'losses', 'winPercent', 'gamesBehind', 'streak'],
  nhl: ['gamesPlayed', 'wins', 'losses', 'otLosses', 'points'],
  nfl: ['wins', 'losses', 'ties', 'winPercent'],
  mlb: ['wins', 'losses', 'winPercent', 'gamesBehind', 'streak'],
  soccer: ['gamesPlayed', 'wins', 'ties', 'losses', 'pointDifferential', 'points'],
};
export const hasPicture = (lg) => ['nfl', 'nba', 'nhl', 'mlb'].includes(lg);
const isMine = (league, r) => getState().teams.some((t) => t.id === r.team.id && (t.league === league || (isSoccer(t.league) && isSoccer(league))));

function table(league, gr) {
  const cols = COLS[LEAGUES[league].group];
  const first = gr.rows[0]?.stats || {};
  let use = cols.filter((c) => first[c]);
  if (use.length < 3) use = Object.keys(first).filter((k) => !/rank|seed|clincher|note/i.test(k)).slice(0, 8);
  const rows = sortRows(gr.rows);
  const soccer = isSoccer(league);
  return h('section', { class: 'blk' }, gr.name ? h('h2', { class: 'blk-h' }, gr.name) : null,
    h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, '#'), h('th', { class: 'l' }, 'Team'), use.map((c) => h('th', null, first[c].abbr || c)))),
      h('tbody', null, rows.map((r, i) => h('tr', { class: (isMine(league, r) ? 'mine ' : '') + (soccer ? soccerZone(league, i + 1, rows.length) : '') }, h('td', null, i + 1),
        h('td', { class: 'l team-cell' }, crest(r.team, 22), h('span', null, r.team.name || r.team.abbr)),
        use.map((c) => h('td', null, r.stats[c] ? r.stats[c].v : ''))))))));
}

function pictureCard(league, p) {
  const line = (x, i, out) => h('li', { class: 'pic-row' + (isMine(league, x.row) ? ' mine' : '') + (out ? ' out' : '') },
    h('span', { class: 'pic-n' }, out ? '' : String(i + 1)), crest(x.row.team, 26), h('span', { class: 'pic-t' }, x.row.team.name || x.row.team.abbr),
    h('span', { class: 'pic-r' }, recordOf(league, x.row.stats)), h('span', { class: 'pic-tag t-' + x.tag.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') }, x.tag));
  return h('section', { class: 'blk pic' }, h('h2', { class: 'blk-h' }, p.name, h('small', null, 'In the playoffs right now')),
    h('ol', { class: 'pic-list' }, p.in.map((x, i) => line(x, i, false))),
    p.bubble.length ? h('div', { class: 'cutline' }, h('span', null, 'Cut line')) : null,
    p.bubble.length ? h('ol', { class: 'pic-list' }, p.bubble.map((x) => line(x, 0, true))) : null);
}

/** mode: 'picture' | 'tables' */
export async function renderStandings(body, league, mode) {
  const groups = await getStandings(league);
  clear(body);
  if (!groups.length) { body.append(emptyState('No standings yet', 'The feed has no table for this league right now.')); return; }
  if (mode === 'picture' && hasPicture(league)) {
    const pics = playoffPicture(league, groups);
    if (pics.length) {
      body.append(h('p', { class: 'muted pad' }, pictureNote(league)), h('div', { class: 'pic-grid' }, pics.map((p) => pictureCard(league, p))));
      return;
    }
  }
  groups.forEach((gr) => body.append(table(league, gr)));
  if (isSoccer(league)) body.append(h('div', { class: 'legend' }, soccerLegend(league).map(([c, t]) => h('span', { class: 'lg' }, h('i', { class: 'lg-dot ' + c }), t))));
}

function seriesCard(s, league) {
  const row = (t, w) => h('div', { class: 'sr-row' + (s.winner && s.winner.id === t.id ? ' win' : '') + (s.winner && s.winner.id !== t.id ? ' lose' : '') },
    crest(t, 24), h('span', { class: 'sr-n' }, t.abbr || t.name), h('span', { class: 'sr-w' }, String(w)));
  return h('a', { class: 'series s-' + s.state, href: `#/game/${league}/${s.lastGame.id}` }, row(s.a, s.aw), row(s.b, s.bw), h('small', null, s.text));
}

export async function renderBracket(body, league) {
  const { games, win } = await getPlayoffGames(league);
  clear(body);
  const rounds = buildBracket(games, league, { over: !(win && win.live) });
  const span = win ? `${fmtDay(win.from)} to ${fmtDay(win.to)}` : '';
  if (!rounds.length) { body.append(emptyState('No playoff games found', win ? `Nothing in the feed for ${span}.` : 'No postseason for this competition.')); return; }
  body.append(h('p', { class: 'muted pad' }, win && win.live ? 'Playoffs in progress. Tap a series to open its latest game.' : `The playoffs are not on right now. This is the last postseason (${span}).`),
    h('div', { class: 'bracket' }, rounds.map((r) => h('div', { class: 'br-col' }, h('h3', { class: 'br-h' }, r.name), h('div', { class: 'br-list' }, r.series.map((s) => seriesCard(s, league)))))));
}
export { playoffWindow };
