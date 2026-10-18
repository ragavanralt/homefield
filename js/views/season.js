// Your season: points, record, streaks, boldest call, games watched.
import { h, clear, emptyState } from '../ui.js';
import { getState, myTeams } from '../store.js';
import { LEAGUES } from '../leagues.js';
import { pageHead } from '../components.js';
import { computeStats } from '../picks.js';
import { sparkline } from '../chart.js';
import { settleAll } from '../settle.js';
import { fmtDay } from '../util.js';

export async function render(root) {
  root.append(pageHead('Your season', 'Everything you have picked and watched, saved on this device.'));
  const host = h('div', { class: 'stack' });
  root.append(host);

  function draw() {
    const state = getState();
    const st = computeStats(state.picks);
    const watched = Object.entries(state.watched).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.ts - a.ts);
    clear(host);

    const big = (label, value, sub) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, String(value)), h('div', { class: 'stat-l' }, label), sub ? h('small', null, sub) : null);
    host.append(h('div', { class: 'scoreboard four' },
      big('Points', st.points),
      big('Record', `${st.won}-${st.lost}`, st.accuracy != null ? Math.round(st.accuracy * 100) + '% right' : 'No settled picks yet'),
      big('Best streak', st.streak.best, `Now ${st.streak.cur}`),
      big('Watched', watched.length, 'games')));

    if (st.timeline.length > 1) host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Points over time'), sparkline(st.timeline)));

    const calls = h('div', { class: 'calls' });
    if (st.boldest) calls.append(h('div', { class: 'call good' }, h('small', null, 'Boldest call'), h('div', { class: 'call-t' }, `${st.boldest.side === 'draw' ? 'Draw' : (st.boldest[st.boldest.side].abbr)} in ${st.boldest.away.abbr} ${st.boldest.league === 'nhl' || st.boldest.league === 'nba' || st.boldest.league === 'nfl' || st.boldest.league === 'mlb' ? '@' : 'vs'} ${st.boldest.home.abbr}`), h('p', null, `Paid ${st.boldest.points} points. You gave this side about a ${Math.round(st.boldest.pPicked * 100)}% chance.`)));
    if (st.worst) calls.append(h('div', { class: 'call bad' }, h('small', null, 'Toughest miss'), h('div', { class: 'call-t' }, `${st.worst.side === 'draw' ? 'Draw' : st.worst[st.worst.side].abbr} in ${st.worst.away.abbr} vs ${st.worst.home.abbr}`), h('p', null, `This side was a ${Math.round(st.worst.pPicked * 100)}% favourite and still lost.`)));
    if (st.favorites.total) {
      const youWin = st.won - st.favorites.wins;
      calls.append(h('div', { class: 'call' }, h('small', null, 'You vs always picking favourites'),
        h('div', { class: 'call-t' }, `You ${st.won}-${st.lost}  ·  Favourites ${st.favorites.wins}-${st.favorites.total - st.favorites.wins}`),
        h('p', null, youWin > 0 ? `You are ${youWin} win${youWin === 1 ? '' : 's'} ahead of the safe strategy.` : youWin < 0 ? `The safe strategy is ${-youWin} win${youWin === -1 ? '' : 's'} ahead. Trust your gut a little less.` : 'Dead even with the safe strategy.')));
    }
    if (calls.children.length) host.append(calls);

    const leagues = Object.entries(st.byLeague);
    if (leagues.length) {
      host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'By league'), h('div', { class: 'lb' }, leagues.map(([lg, v]) => h('div', { class: 'lb-row' },
        h('span', null, LEAGUES[lg]?.label || lg),
        h('div', { class: 'pb' }, h('i', { style: { width: Math.round((v.won / v.total) * 100) + '%' } })),
        h('span', { class: 'pt' }, `${v.won}/${v.total}`))))));
    }

    const modes = h('div', { class: 'card' }, h('h2', { class: 'card-h' }, 'Game modes'),
      h('p', null, `Streak Run best: ${st.streakMode.best} · current: ${st.streakMode.cur}`),
      h('p', null, `Perfect Slates: ${st.perfectSlates} of ${st.slatesPlayed} completed`),
      h('p', null, `Open picks: ${st.pending}`));
    host.append(modes);

    if (watched.length) {
      host.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, 'Games you watched', h('small', null, String(watched.length))),
        h('div', { class: 'pk-list' }, watched.slice(0, 20).map((w) => {
          const [lg, id] = w.key.split(':');
          return h('a', { class: 'pk', href: `#/game/${lg}/${id}` }, h('span', { class: 'pk-l' }, LEAGUES[lg]?.label || lg), h('span', { class: 'pk-m' }, `${w.away} ${w.awayScore ?? ''} – ${w.homeScore ?? ''} ${w.home}`), h('span', { class: 'pk-p' }, w.date ? fmtDay(w.date) : ''));
        }))));
    }

    if (!st.total && !watched.length) {
      host.append(emptyState('Nothing here yet', 'Make a pick or mark a game as watched and your season starts filling in.', h('a', { class: 'btn main', href: '#/picks' }, "Go to Pick'em")));
    }
    if (myTeams().length === 0) host.append(h('p', { class: 'muted pad' }, 'Tip: follow some teams in Settings to get a personal home screen.'));
  }

  draw();
  settleAll().then((n) => { if (n) draw(); }).catch(() => {});
}
