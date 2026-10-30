// Home: three tabs.
//  My teams: every team you follow, always shown, with its live or last game and the next fixtures.
//  Live: every game on right now in any league you have not hidden, best to watch first.
//  All: every game on the chosen day across the leagues you have not hidden, grouped by league.
import { h, clear, crest, errorBox, loading, emptyState, poll, isHidden } from '../ui.js';
import { CONFIG } from '../config.js';
import { getState, myTeams, myTeamIn, leagueHidden, setSetting } from '../store.js';
import { LEAGUES, isSoccer, leagueLabel } from '../leagues.js';
import { lookOf } from '../gamelook.js';
import { getScoreboard, getTeamSchedule, rememberGame } from '../espn.js';
import { gameCard, pageHead } from '../components.js';
import { watchScore } from '../winprob.js';
import { addDays, sameDay, ymd, fmtDay, fmtTime } from '../util.js';

const TAB_LIST = [{ id: 'mine', label: 'My teams' }, { id: 'live', label: 'Live' }, { id: 'all', label: 'All games' }];
const DAYS = [{ n: -1, label: 'Yesterday' }, { n: 0, label: 'Today' }, { n: 1, label: 'Tomorrow' }];
const ws = (g) => watchScore(g) ?? 0;
const byTime = (a, b) => new Date(a.date) - new Date(b.date);
const stateRank = { in: 0, pre: 1, post: 2 };

export async function render(root) {
  const teams = myTeams();
  const saved = getState().settings.homeTab;
  let tab = TAB_LIST.some((t) => t.id === saved) ? saved : 'mine';
  let allDay = 0;
  root.append(pageHead('Home', 'Your teams, everything live, and the full slate'));

  const tabsHost = h('div', { class: 'seg home-tabs', role: 'tablist' });
  const body = h('div', { class: 'stack' }, loading('Loading games'));
  root.append(tabsHost, body);

  // data, refreshed by load()
  let board = new Map(); // ymd -> games across every visible league
  let schedules = new Map(); // league:id -> schedule games
  let anyLive = false;

  const visibleLeagues = () => Object.keys(LEAGUES).filter((l) => !leagueHidden(l));
  async function loadDay(n, ttl) {
    const d = ymd(addDays(new Date(), n));
    const leagues = visibleLeagues();
    // leagues you follow a team in are always fetched, even if hidden, so My teams stays complete
    for (const t of teams) if (!leagues.includes(t.league)) leagues.push(t.league);
    let fails = 0;
    const lists = await Promise.all(leagues.map((l) => getScoreboard(l, d, ttl).catch(() => { fails++; return []; })));
    const seen = new Set();
    board.set(d, lists.flat().filter((g) => (seen.has(g.key) ? false : seen.add(g.key))));
    return fails === leagues.length;
  }
  async function load() {
    const failed = await Promise.all([loadDay(0), loadDay(-1, 60000), loadDay(1, 60000)]);
    if (failed[0] && failed[1] && failed[2]) throw new Error('No games could be loaded');
    const soon = Date.now() + 15 * 60000;
    // keep refreshing while anything is live or about to start
    anyLive = (board.get(ymd(new Date())) || []).some((g) => g.state === 'in' || (g.state === 'pre' && new Date(g.date).getTime() < soon));
    drawTabs(); draw();
    // team schedules fill in the fixtures on My teams; they change slowly
    await Promise.all(teams.map(async (t) => {
      const k = `${t.league}:${t.id}`;
      if (schedules.has(k)) return;
      try { schedules.set(k, (await getTeamSchedule(t.league, t.id)).games || []); } catch (e) { schedules.set(k, []); }
    }));
    if (tab === 'mine') draw();
  }

  const allGames = () => [...board.values()].flat();
  const liveGames = () => {
    const seen = new Set();
    return allGames().filter((g) => g.state === 'in' && !leagueHidden(g.league) && (seen.has(g.key) ? false : seen.add(g.key))).sort((a, b) => ws(b) - ws(a));
  };

  function drawTabs() {
    const n = liveGames().length;
    clear(tabsHost).append(...TAB_LIST.map((t) => h('button', { type: 'button', role: 'tab', class: 'seg-b' + (tab === t.id ? ' on' : ''), 'aria-selected': tab === t.id ? 'true' : 'false', 'data-tab': t.id,
      onclick: () => { tab = t.id; setSetting('homeTab', t.id); drawTabs(); draw(); } }, t.label, t.id === 'live' && n ? h('span', { class: 'tab-n' }, String(n)) : null)));
  }

  function draw() {
    clear(body);
    if (tab === 'mine') drawMine();
    else if (tab === 'live') drawLive();
    else drawAll();
  }

  const cards = (list, opts = {}) => h('div', { class: 'cards' }, list.map((g) => gameCard(g, { team: myTeamIn(g), showLeague: opts.showLeague ?? true })));
  const section = (title, list, sub, opts) => {
    if (!list.length) return null;
    const s = h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, title, sub ? h('small', null, sub) : null), cards(list, opts));
    body.append(s);
    return s;
  };

  /* ---------- My teams ---------- */
  function drawMine() {
    if (!teams.length) {
      body.append(emptyState('No teams yet', 'Pick the teams you follow and they show up here, playing or not.', h('a', { class: 'btn main', href: '#/onboarding' }, 'Pick teams')));
      return;
    }
    const now = new Date();
    // teams playing now first, then whoever plays soonest
    const soonest = (t) => { const c = teamCard.peek(t, now); return c.live ? -1 : c.next ? new Date(c.next.date).getTime() : Infinity; };
    const order = [...teams].sort((a, b) => soonest(a) - soonest(b));
    body.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, 'Your teams', h('small', null, `${teams.length} followed`)),
      h('div', { class: 'myteams' }, order.map((t) => teamCard(t, now)))));
  }

  function teamGames(t, now) {
    const k = `${t.league}:${t.id}`;
    const fromBoard = allGames().filter((g) => [g.home, g.away].some((s) => s && String(s.id) === String(t.id)) && g.league === t.league);
    const sched = schedules.get(k);
    const byKey = new Map();
    for (const g of [...(sched || []), ...fromBoard]) byKey.set(g.key, g);
    const games = [...byKey.values()].sort(byTime);
    return { sched, live: games.find((g) => g.state === 'in'), next: games.find((g) => g.state === 'pre' && new Date(g.date) > now) };
  }
  teamCard.peek = teamGames;
  function teamCard(t, now) {
    const k = `${t.league}:${t.id}`;
    const fromBoard = allGames().filter((g) => [g.home, g.away].some((s) => s && String(s.id) === String(t.id)) && g.league === t.league);
    const sched = schedules.get(k);
    const byKey = new Map();
    for (const g of [...(sched || []), ...fromBoard]) byKey.set(g.key, g); // live scoreboard data wins over the schedule copy
    const games = [...byKey.values()].sort(byTime);
    const live = games.find((g) => g.state === 'in');
    const last = games.filter((g) => g.state === 'post').pop();
    const next = games.filter((g) => g.state === 'pre' && new Date(g.date) > now).slice(0, 3);
    const side = (g) => (String(g.home.id) === String(t.id) ? 'home' : 'away');
    const ref = live || last || next[0];
    const rec = ref ? ref[side(ref)]?.record : '';
    return h('article', { class: 'tcard' + (live ? ' is-live' : '') },
      h('a', { class: 'tc-h', href: `#/team/${t.league}/${t.id}` }, crest(t, 36), h('div', null, h('div', { class: 'tc-n' }, t.name), h('small', null, [leagueLabel(t.league), rec].filter(Boolean).join(' · '))),
        live ? h('span', { class: 'st live' }, h('i', { class: 'ldot' }), 'Live') : null),
      live ? gameCard(live, { team: t }) : null,
      last && !live ? fixtureRow(last, t, 'Last') : null,
      next.length ? h('div', { class: 'tc-next' }, h('small', { class: 'tc-l' }, 'Up next'), next.map((g) => fixtureRow(g, t))) : null,
      !sched && !live && !last && !next.length ? h('small', { class: 'muted' }, 'Loading fixtures…') : null,
      sched && !live && !last && !next.length ? h('small', { class: 'muted' }, 'No games on the schedule right now.') : null);
  }

  function fixtureRow(g, t, label) {
    const home = String(g.home.id) === String(t.id);
    const us = home ? g.home : g.away, opp = home ? g.away : g.home;
    let res = '', cls = '';
    if (g.state === 'post' && !isHidden(g)) {
      const a = Number(us.score), b = Number(opp.score);
      cls = a > b ? 'w' : a < b ? 'l' : 'd';
      res = `${a > b ? 'W' : a < b ? 'L' : 'D'} ${a}-${b}`;
    } else if (g.state === 'post') res = 'Final';
    const when = g.state === 'pre' ? (sameDay(new Date(g.date), new Date()) ? `Today ${fmtTime(g.date)}` : `${fmtDay(g.date)} · ${fmtTime(g.date)}`) : fmtDay(g.date);
    const look = lookOf(g);
    return h('a', { class: 'fx' + (look ? ' fx-special' : ''), href: `#/game/${g.league}/${g.id}`, onclick: () => rememberGame(g) },
      label ? h('small', { class: 'fx-l' }, label) : null,
      h('span', { class: 'fx-d' }, when),
      h('span', { class: 'fx-o' }, h('small', null, home ? 'vs' : '@'), crest(opp, 20), h('span', null, opp.short || opp.name || opp.abbr), look ? h('span', { class: 'look-tag fx-tag', title: look.sub || look.label }, look.label.replace(' Playoffs', ' PO').replace('Champions League', 'UCL').replace('Europa League', 'UEL').replace('MLB Postseason', 'MLB PO').replace('MLS Cup Playoffs', 'MLS PO')) : null),
      h('span', { class: 'fx-r ' + cls }, res));
  }

  /* ---------- Live ---------- */
  function drawLive() {
    const live = liveGames();
    if (!live.length) {
      body.append(emptyState('Nothing live right now', 'When games are on in any league you have not hidden, they show up here, best to watch first.', h('button', { type: 'button', class: 'btn', onclick: () => { tab = 'all'; setSetting('homeTab', 'all'); drawTabs(); draw(); } }, 'See all games')));
      return;
    }
    section('Live now', live, 'Best to watch first');
    body.append(h('p', { class: 'muted' }, 'Every live game in the leagues you have not hidden, sorted by the watch-worthy rating.'));
  }

  /* ---------- All ---------- */
  function drawAll() {
    const day = ymd(addDays(new Date(), allDay));
    body.append(h('div', { class: 'seg day-tabs' }, DAYS.map((d) => h('button', { type: 'button', class: 'seg-b' + (allDay === d.n ? ' on' : ''), onclick: () => { allDay = d.n; draw(); } }, d.label))));
    const games = (board.get(day) || []).filter((g) => !leagueHidden(g.league));
    if (!games.length) { body.append(emptyState('No games', 'Nothing scheduled that day in the leagues you have not hidden.')); return; }
    const order = Object.keys(LEAGUES);
    const groups = new Map();
    for (const g of games) { if (!groups.has(g.league)) groups.set(g.league, []); groups.get(g.league).push(g); }
    // leagues with your teams first, then the usual order
    const mineFirst = [...groups.keys()].sort((a, b) => (teams.some((t) => t.league === b) - teams.some((t) => t.league === a)) || order.indexOf(a) - order.indexOf(b));
    for (const lg of mineFirst) {
      const list = groups.get(lg).sort((a, b) => stateRank[a.state] - stateRank[b.state] || (a.state === 'in' ? ws(b) - ws(a) : a.state === 'post' ? byTime(b, a) : byTime(a, b)));
      const liveN = list.filter((g) => g.state === 'in').length;
      section(leagueLabel(lg), list, `${list.length} game${list.length === 1 ? '' : 's'}${liveN ? ` · ${liveN} live` : ''}`, { showLeague: false });
    }
  }

  try { await load(); } catch (e) { clear(body).append(errorBox(e, () => load().catch(() => {}))); }
  return poll(() => load().catch(() => {}), CONFIG.refreshMs, () => anyLive);
}
