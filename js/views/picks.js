// Solo Pick'em: choose a game mode, pick winners, watch your points build.
import { h, clear, crest, errorBox, loading, emptyState, toast } from '../ui.js';
import { getState, update, myTeams, removePick } from '../store.js';
import { LEAGUES, MAJOR_KEYS, SOCCER_KEYS, isSoccer } from '../leagues.js';
import { getScoreboard } from '../espn.js';
import { pageHead, placePick, pickLabel } from '../components.js';
import { MODES, offer, computeStats, slateKey, SLATE_BONUS } from '../picks.js';
import { settleAll } from '../settle.js';
import { addDays, fmtDay, fmtTime, ymd } from '../util.js';

export async function render(root) {
  const mine = myTeams();
  let mode = getState().lastMode || 'classic';
  let league = mine.find((t) => !isSoccer(t.league))?.league || mine[0]?.league || 'nhl';
  let offset = 0;

  root.append(pageHead("Pick'em", 'Solo games. You against the odds. Underdogs pay more.'));
  const scoreHost = h('div');
  const modeHost = h('div');
  const pickerHost = h('div', { class: 'stack' });
  const listHost = h('div', { class: 'stack' });
  root.append(scoreHost, modeHost, pickerHost, listHost);

  function drawScore() {
    const st = computeStats(getState().picks);
    const stat = (label, value, sub) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, String(value)), h('div', { class: 'stat-l' }, label), sub ? h('small', null, sub) : null);
    clear(scoreHost).append(h('div', { class: 'scoreboard' },
      stat('Points', st.points),
      stat('Record', `${st.won}-${st.lost}`, st.accuracy != null ? Math.round(st.accuracy * 100) + '% right' : 'No settled picks'),
      stat('Streak', st.streak.cur, `Best ${st.streak.best}`),
      stat('Open picks', st.pending)));
  }

  function drawModes() {
    const st = computeStats(getState().picks);
    clear(modeHost).append(h('div', { class: 'mode-grid' }, Object.entries(MODES).map(([k, m]) => {
      let extra = '';
      if (k === 'streak') extra = `Streak ${st.streakMode.cur} · best ${st.streakMode.best}`;
      if (k === 'slate') extra = `${st.perfectSlates} perfect slate${st.perfectSlates === 1 ? '' : 's'} · +${SLATE_BONUS} each`;
      if (k === 'classic') extra = `${st.points} points so far`;
      return h('button', { type: 'button', class: 'mode' + (k === mode ? ' on' : ''), id: 'mode-' + k, 'aria-pressed': k === mode ? 'true' : 'false', onclick: () => { mode = k; update((s) => { s.lastMode = k; }); drawModes(); loadGames(); } },
        h('h3', null, m.label), h('p', null, m.blurb), h('small', null, extra));
    })));
  }

  const leagueChoices = () => {
    const set = new Set([...MAJOR_KEYS, ...mine.filter((t) => isSoccer(t.league)).map((t) => t.league), 'uefa.champions']);
    return [...set];
  };

  function drawPickerBar() {
    clear(pickerHost).append(
      h('div', { class: 'controls' },
        h('div', { class: 'chip-row' }, leagueChoices().map((k) => h('button', { type: 'button', class: 'chip' + (k === league ? ' on' : ''), 'aria-pressed': k === league ? 'true' : 'false', onclick: () => { league = k; drawPickerBar(); loadGames(); } }, LEAGUES[k].label))),
        h('div', { class: 'seg' }, ['Today', 'Tomorrow', 'In 2 days'].map((l, i) => h('button', { type: 'button', class: 'seg-b' + (offset === i ? ' on' : ''), onclick: () => { offset = i; drawPickerBar(); loadGames(); } }, l)))),
      h('div', { id: 'pick-games', class: 'stack' }, loading('Loading games')));
  }

  let token = 0;
  async function loadGames() {
    const my = ++token;
    const host = pickerHost.querySelector('#pick-games');
    if (!host) return;
    clear(host).append(loading('Loading games'));
    try {
      const games = (await getScoreboard(league, ymd(addDays(new Date(), offset)))).filter((g) => g.state === 'pre' || getState().picks[g.key]);
      if (my !== token) return;
      clear(host);
      if (mode === 'slate') {
        const key = `${league}:${ymd(addDays(new Date(), offset))}`;
        const n = Object.values(getState().picks).filter((p) => p.mode === 'slate' && p.slate === key).length;
        host.append(h('p', { class: 'slate-note' }, `Slate progress: ${n} of ${games.length} games picked. Get them all right for +${SLATE_BONUS} bonus points.`));
      }
      if (mode === 'streak') {
        const today = ymd(addDays(new Date(), offset));
        const has = Object.values(getState().picks).find((p) => p.mode === 'streak' && p.dayKey === today);
        host.append(h('p', { class: 'slate-note' }, has ? `Your streak pick for this day: ${pickLabel(has)}. Tap another team to switch before the game starts.` : 'One pick a day keeps the streak alive. Choose your best bet.'));
      }
      if (!games.length) { host.append(emptyState('No open games', 'Nothing left to pick for this league on this day. Try another day or league.')); return; }
      games.sort((a, b) => new Date(a.date) - new Date(b.date));
      host.append(h('div', { class: 'cards' }, games.map(row)));
    } catch (e) { if (my === token) clear(host).append(errorBox(e, loadGames)); }
  }

  function row(g) {
    const existing = getState().picks[g.key];
    const o = offer(g);
    const sidesList = isSoccer(g.league) ? ['home', 'draw', 'away'] : ['away', 'home'];
    const locked = g.state !== 'pre';
    return h('div', { class: 'prow' },
      h('a', { class: 'prow-t', href: `#/game/${g.league}/${g.id}` },
        h('div', { class: 'prow-teams' }, crest(g.away, 28), h('span', null, `${g.away.abbr} ${isSoccer(g.league) ? 'vs' : '@'} ${g.home.abbr}`), crest(g.home, 28)),
        h('small', null, `${fmtDay(g.date)} · ${fmtTime(g.date)}`)),
      h('div', { class: 'pp-sides' + (sidesList.length === 3 ? ' three' : '') }, sidesList.map((side) => {
        const on = existing && existing.side === side;
        return h('button', {
          type: 'button', class: 'pp-side' + (on ? ' on' : ''), disabled: locked || (existing && existing.status !== 'pending'),
          onclick: () => { const p = placePick(g, side, mode); toast(`${pickLabel(p)} locked in for ${p.pts} points`); drawScore(); drawModes(); drawList(); loadGames(); },
        }, h('span', { class: 'ps-l' }, side === 'draw' ? 'Draw' : g[side].abbr), h('span', { class: 'ps-p' }, `+${o[side].pts}`));
      })));
  }

  function drawList() {
    const picks = Object.values(getState().picks);
    clear(listHost);
    if (!picks.length) { listHost.append(h('p', { class: 'muted pad' }, 'No picks yet. Choose a game above.')); return; }
    const open = picks.filter((p) => p.status === 'pending').sort((a, b) => new Date(a.date) - new Date(b.date));
    const done = picks.filter((p) => p.status !== 'pending').sort((a, b) => new Date(b.date) - new Date(a.date));
    const line = (p) => h('a', { class: 'pk', href: `#/game/${p.league}/${p.gameId}` },
      h('span', { class: 'pk-l' }, LEAGUES[p.league]?.label || p.league),
      h('span', { class: 'pk-m' }, `${p.away.abbr} ${isSoccer(p.league) ? 'vs' : '@'} ${p.home.abbr}`),
      h('span', { class: 'pk-p' }, `${pickLabel(p)} · ${MODES[p.mode]?.label || ''}`),
      h('span', { class: 'pill ' + p.status }, p.status === 'won' ? `Won +${p.points}` : p.status === 'lost' ? 'Missed' : p.status === 'void' ? 'Void' : `+${p.pts} if right`));
    const block = (title, arr) => arr.length && listHost.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, title, h('small', null, String(arr.length))), h('div', { class: 'pk-list' }, arr.slice(0, 40).map(line))));
    block('Open picks', open);
    block('Settled', done);
  }

  drawScore(); drawModes(); drawPickerBar(); drawList();
  loadGames();
  settleAll().then((n) => { if (n) { drawScore(); drawModes(); drawList(); } }).catch(() => {});
}
