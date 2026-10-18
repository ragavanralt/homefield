// Home: live board, today and tomorrow for your teams, and each team's next game.
import { h, clear, crest, errorBox, loading, emptyState, poll } from '../ui.js';
import { CONFIG } from '../config.js';
import { getState, myTeams, myTeamIn, leagueHidden } from '../store.js';
import { isSoccer, SOCCER_EXTRAS } from '../leagues.js';
import { getScoreboard, getTeamSchedule } from '../espn.js';
import { gameCard, pageHead } from '../components.js';
import { watchScore } from '../winprob.js';
import { addDays, sameDay, ymd } from '../util.js';

export async function render(root) {
  const teams = myTeams();
  root.append(pageHead('Home', 'Your teams, live and next up'));
  if (!teams.length) {
    root.append(emptyState('No teams yet', 'Pick the teams you follow and this screen fills up.', h('a', { class: 'btn main', href: '#/onboarding' }, 'Pick teams')));
    return;
  }

  root.append(h('div', { class: 'team-strip' }, teams.map((t) => h('a', { class: 'chip team-chip', href: `#/team/${t.league}/${t.id}` }, crest(t, 24), t.short || t.name))));

  const body = h('div', { class: 'stack' }, loading('Loading games'));
  root.append(body);
  let anyLive = false;

  async function load() {
    const leagues = new Set();
    for (const t of teams) { leagues.add(t.league); if (isSoccer(t.league)) SOCCER_EXTRAS.filter((l) => !leagueHidden(l)).forEach((l) => leagues.add(l)); }
    const now = new Date();
    const days = [-1, 0, 1].map((n) => ymd(addDays(now, n)));
    let fails = 0, total = 0;
    const jobs = [];
    for (const l of leagues) for (const d of days) { total++; jobs.push(getScoreboard(l, d).catch(() => { fails++; return []; })); }
    const lists = await Promise.all(jobs);
    if (fails === total) { clear(body).append(errorBox(new Error('No games could be loaded'), load)); return; }

    const seen = new Set();
    const games = lists.flat().filter((g) => (seen.has(g.key) ? false : seen.add(g.key)));
    const mine = games.filter((g) => myTeamIn(g));
    const live = games.filter((g) => g.state === 'in');
    anyLive = live.length > 0;

    const liveMine = live.filter((g) => myTeamIn(g)).sort((a, b) => (watchScore(b) ?? 0) - (watchScore(a) ?? 0));
    const myLeagues = new Set(teams.map((t) => t.league));
    const liveOther = live.filter((g) => !myTeamIn(g) && !leagueHidden(g.league) && (myLeagues.has(g.league) || (isSoccer(g.league) && teams.some((t) => isSoccer(t.league)))))
      .filter((g) => (watchScore(g) ?? 0) >= 40).sort((a, b) => (watchScore(b) ?? 0) - (watchScore(a) ?? 0)).slice(0, 6);

    clear(body);
    const section = (title, list, sub) => {
      if (!list.length) return;
      body.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, title, sub ? h('small', null, sub) : null), h('div', { class: 'cards' }, list.map((g) => gameCard(g, { team: myTeamIn(g), showLeague: isSoccer(g.league) })))));
    };

    section('Live now', liveMine);
    section('Hot games right now', liveOther, 'Other live games in your leagues, best first');

    const today = mine.filter((g) => g.state !== 'in' && sameDay(new Date(g.date), now)).sort((a, b) => new Date(a.date) - new Date(b.date));
    const tomorrow = mine.filter((g) => g.state === 'pre' && sameDay(new Date(g.date), addDays(now, 1))).sort((a, b) => new Date(a.date) - new Date(b.date));
    const recent = mine.filter((g) => g.state === 'post' && !sameDay(new Date(g.date), now)).sort((a, b) => new Date(b.date) - new Date(a.date));
    section('Today', today);
    section('Tomorrow', tomorrow);
    section('Recent finals', recent.slice(0, 4));

    if (!mine.length) body.append(h('p', { class: 'muted pad' }, 'Nothing for your teams yesterday, today or tomorrow.'));

    // next game per team, filled in as each schedule arrives
    const shown = new Set(mine.map((g) => g.key));
    const nextHost = h('div', { class: 'cards' });
    const nextBlk = h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, 'Next up'), nextHost);
    body.append(nextBlk);
    let any = false;
    await Promise.all(teams.map(async (t) => {
      try {
        const s = await getTeamSchedule(t.league, t.id);
        const next = s.games.find((g) => g.state === 'pre' && new Date(g.date) > now);
        if (next && !shown.has(next.key)) { shown.add(next.key); any = true; nextHost.append(gameCard(next, { team: t, showLeague: isSoccer(next.league) })); }
      } catch (e) { /* skip a team whose schedule is unavailable */ }
    }));
    if (!any) nextBlk.remove();
  }

  try { await load(); } catch (e) { clear(body).append(errorBox(e, load)); }
  return poll(() => load().catch(() => {}), CONFIG.refreshMs, () => anyLive);
}
