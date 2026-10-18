// Pick'em: a play-money sportsbook. Winner bets and player props, singles or parlays.
import { h, clear, crest, errorBox, loading, emptyState, toast } from '../ui.js';
import { getState, update, myTeams, myTeamIn, onSlipChange, leagueHidden } from '../store.js';
import { LEAGUES, MAJOR_KEYS, SOCCER_KEYS, SOCCER_EXTRAS, isSoccer } from '../leagues.js';
import { getScoreboard } from '../espn.js';
import { pageHead } from '../components.js';
import { moneylineRow, propsPanel } from '../markets.js';
import { bankStrip, betCard } from '../bankroll.js';
import { settleAll } from '../settle.js';
import { addDays, fmtDay, fmtTime, ymd } from '../util.js';

const SOCCER_ALL = ['uefa.champions', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'usa.1'];

export async function render(root) {
  const mine = myTeams();
  const st0 = getState();
  let scope = st0.pickScope || (mine.length ? 'mine' : 'all'); // 'all' | 'mine'
  let chip = 'all'; // all | nhl | nba | nfl | mlb | soccer
  let offset = 0;
  let tab = 'open';

  root.append(pageHead("Pick'em", 'Play money. Tap a price to add it to your slip. Underdogs pay more.'));
  const bank = bankStrip();
  const controls = h('div', { class: 'controls row-controls' });
  const board = h('div', { class: 'stack' });
  const histHost = h('div', { class: 'stack' });
  root.append(bank.el, controls, board, histHost);

  function leaguesToLoad() {
    let list;
    if (scope === 'mine') {
      const set = new Set();
      for (const t of mine) { set.add(t.league); if (isSoccer(t.league)) SOCCER_EXTRAS.filter((l) => !leagueHidden(l)).forEach((l) => set.add(l)); }
      list = [...set];
    } else list = [...MAJOR_KEYS, ...SOCCER_ALL].filter((l) => !leagueHidden(l));
    if (chip === 'soccer') list = list.filter(isSoccer);
    else if (chip !== 'all') list = list.filter((l) => l === chip);
    return list;
  }

  function drawControls() {
    clear(controls).append(
      h('div', { class: 'seg' }, [['all', 'All games'], ['mine', 'My teams']].map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (scope === k ? ' on' : ''), id: 'scope-' + k, onclick: () => { scope = k; update((s) => { s.pickScope = k; }); drawControls(); loadGames(); } }, l))),
      h('div', { class: 'chip-row' }, [['all', 'All sports'], ['nhl', 'NHL'], ['nba', 'NBA'], ['nfl', 'NFL'], ['mlb', 'MLB'], ['soccer', 'Soccer']].map(([k, l]) => h('button', { type: 'button', class: 'chip' + (chip === k ? ' on' : ''), 'aria-pressed': chip === k ? 'true' : 'false', onclick: () => { chip = k; drawControls(); loadGames(); } }, l))),
      h('div', { class: 'seg' }, ['Today', 'Tomorrow', 'In 2 days'].map((l, i) => h('button', { type: 'button', class: 'seg-b' + (offset === i ? ' on' : ''), onclick: () => { offset = i; drawControls(); loadGames(); } }, l))));
  }

  let token = 0;
  async function loadGames() {
    const my = ++token;
    clear(board).append(loading('Loading games'));
    if (scope === 'mine' && !mine.length) { clear(board).append(emptyState('No teams followed', 'Follow teams to see only their games, or switch to All games.', h('a', { class: 'btn main', href: '#/onboarding' }, 'Pick teams'))); return; }
    const day = ymd(addDays(new Date(), offset));
    const leagues = leaguesToLoad();
    let fails = 0;
    const lists = await Promise.all(leagues.map((l) => getScoreboard(l, day).catch(() => { fails++; return []; })));
    if (my !== token) return;
    if (fails === leagues.length) { clear(board).append(errorBox(new Error('No games could be loaded'), loadGames)); return; }
    let games = lists.flat();
    if (scope === 'mine') games = games.filter((g) => myTeamIn(g));
    games = games.filter((g) => g.state === 'pre').sort((a, b) => new Date(a.date) - new Date(b.date));
    clear(board);
    if (!games.length) { board.append(emptyState('Nothing to bet on', scope === 'mine' ? 'No games left for your teams on this day. Try another day or All games.' : 'No upcoming games for this selection. Try another day.')); return; }
    board.append(h('div', { class: 'pgames' }, games.map(gameRow)));
  }

  function gameRow(g) {
    const holder = h('div', { class: 'pprops', hidden: true });
    let loaded = false;
    const btn = h('button', { type: 'button', class: 'btn small', 'aria-expanded': 'false', onclick: () => {
      holder.hidden = !holder.hidden;
      btn.setAttribute('aria-expanded', holder.hidden ? 'false' : 'true');
      btn.textContent = holder.hidden ? 'Player props' : 'Hide props';
      if (!loaded && !holder.hidden) { loaded = true; holder.append(propsPanel(g)); }
    } }, 'Player props');
    const my = myTeamIn(g);
    return h('div', { class: 'pgame' + (my ? ' mine' : '') },
      h('div', { class: 'pg-h' },
        h('a', { class: 'pg-teams', href: `#/game/${g.league}/${g.id}` }, crest(g.away, 30), h('span', null, `${g.away.abbr} ${isSoccer(g.league) ? 'vs' : '@'} ${g.home.abbr}`), crest(g.home, 30)),
        h('small', null, `${LEAGUES[g.league].label} · ${fmtDay(g.date)} ${fmtTime(g.date)}`)),
      moneylineRow(g),
      g.league && LEAGUES[g.league].group !== 'soccer' ? btn : null,
      holder);
  }

  function drawHistory() {
    clear(histHost);
    const all = Object.values(getState().bets).sort((a, b) => b.ts - a.ts);
    if (!all.length) return;
    const open = all.filter((b) => b.status === 'pending');
    const done = all.filter((b) => b.status !== 'pending');
    const list = tab === 'open' ? open : done;
    histHost.append(h('section', { class: 'blk' },
      h('div', { class: 'blk-h' }, h('h2', { class: 'blk-h' }, 'My bets'),
        h('div', { class: 'seg' }, [['open', `Open (${open.length})`], ['done', `Settled (${done.length})`]].map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (tab === k ? ' on' : ''), id: 'bets-' + k, onclick: () => { tab = k; drawHistory(); } }, l)))),
      list.length ? h('div', { class: 'betgrid' }, list.slice(0, 40).map(betCard)) : h('p', { class: 'muted pad' }, tab === 'open' ? 'No open bets. Tap a price above to start a slip.' : 'Nothing settled yet.')));
  }

  drawControls(); drawHistory();
  loadGames();
  const refresh = () => drawHistory();
  const unsub = onSlipChange(refresh);
  settleAll().then((n) => { if (n) drawHistory(); }).catch(() => {});
  return () => { bank.stop(); unsub(); };
}
