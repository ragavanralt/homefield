// A team page, skinned in the team's own colours.
import { h, clear, crest, applySkin, errorBox, loading, downloadText, toast } from '../ui.js';
import { findTeam, follow, unfollow, isFollowing } from '../store.js';
import { isSoccer, SOCCER_EXTRAS, leagueLabel } from '../leagues.js';
import { getTeamSchedule } from '../espn.js';
import { gameCard } from '../components.js';
import { buildICS, googleUrl } from '../ics.js';

export async function render(root, { league, id }) {
  const host = h('div', { class: 'tview' }, loading('Loading team'));
  root.append(host);

  const leagues = isSoccer(league) ? [league, ...SOCCER_EXTRAS.filter((l) => l !== league)] : [league];
  const results = await Promise.allSettled(leagues.map((l) => getTeamSchedule(l, id)));
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!ok.length) { clear(host).append(errorBox(results[0].reason, () => location.reload())); return; }

  const info = ok[0].team;
  const known = findTeam(league, id);
  const team = { league, id: String(id), abbr: known?.abbr || info.abbr, name: known?.name || info.name, short: known?.short || info.short, color: known?.color || info.color, alt: known?.alt || info.alt, logo: known?.logo || info.logo };

  const seen = new Set();
  const games = ok.flatMap((s) => s.games).filter((g) => (seen.has(g.key) ? false : seen.add(g.key))).sort((a, b) => new Date(a.date) - new Date(b.date));
  const now = Date.now();
  const upcoming = games.filter((g) => g.state === 'in' || (g.state === 'pre' && new Date(g.date).getTime() > now - 3600000));
  const results2 = games.filter((g) => g.state === 'post').reverse();
  const next = upcoming[0];

  clear(host);
  const hero = h('div', { class: 'thero' });
  applySkin(hero, team.color, team.alt);
  const followBtn = h('button', { type: 'button', class: 'btn on-skin', id: 'follow-btn' });
  const paintFollow = () => { followBtn.textContent = isFollowing(league, id) ? 'Following' : 'Follow'; followBtn.setAttribute('aria-pressed', isFollowing(league, id) ? 'true' : 'false'); };
  followBtn.addEventListener('click', () => { if (isFollowing(league, id)) unfollow(league, id); else follow(team); paintFollow(); toast(isFollowing(league, id) ? `Following ${team.short}` : `Unfollowed ${team.short}`); });
  paintFollow();
  hero.append(
    crest(team, 76),
    h('div', { class: 'th-text' },
      h('p', { class: 'eyebrow' }, leagueLabel(league)),
      h('h1', null, team.name),
      h('p', { class: 'th-sub' }, [info.record, info.standing].filter(Boolean).join(' · ')),
    ),
    followBtn,
  );
  host.append(hero);

  // calendar
  const calRow = h('div', { class: 'row wrap' });
  if (upcoming.length) {
    calRow.append(
      h('button', { type: 'button', class: 'btn main', onclick: () => { downloadText(`${team.abbr}-next-game.ics`, buildICS([next], `${team.short} next game`)); toast('Calendar file ready'); } }, 'Add next game'),
      h('button', { type: 'button', class: 'btn', onclick: () => { downloadText(`${team.abbr}-schedule.ics`, buildICS(upcoming, `${team.name} games`)); toast(`${upcoming.length} games added to a calendar file`); } }, `Add rest of season (${upcoming.length})`),
      h('a', { class: 'btn', href: googleUrl(next), target: '_blank', rel: 'noopener' }, 'Next game in Google Calendar'),
    );
    host.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, 'Calendar'), calRow,
      h('p', { class: 'muted small-note' }, 'Downloads a standard calendar file. Open it and your calendar app adds every game with the right time for your timezone.')));
  }

  if (next) host.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, next.state === 'in' ? 'Live now' : 'Next game'), h('div', { class: 'cards' }, gameCard(next, { team }))));

  const listBlock = (title, list, limit) => {
    if (!list.length) return;
    const cards = h('div', { class: 'cards' });
    const paint = (all) => {
      clear(cards);
      list.slice(0, all ? list.length : limit).forEach((g) => {
        const mineHome = g.home.id === String(id);
        const me = mineHome ? g.home : g.away, them = mineHome ? g.away : g.home;
        const res = g.state === 'post' ? ((me.score ?? 0) > (them.score ?? 0) ? 'W' : (me.score ?? 0) < (them.score ?? 0) ? 'L' : 'D') : '';
        cards.append(h('div', { class: 'res' }, res ? h('span', { class: 'rchip ' + res }, res) : null, gameCard(g, { team })));
      });
      if (!all && list.length > limit) cards.append(h('button', { type: 'button', class: 'btn', onclick: () => paint(true) }, `Show all ${list.length}`));
    };
    paint(false);
    host.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, title, h('small', null, String(list.length))), cards));
  };
  listBlock('Upcoming', upcoming.slice(next ? 1 : 0), 8);
  listBlock('Results', results2, 8);
  if (!games.length) host.append(h('p', { class: 'muted pad' }, 'The feed has no schedule for this team right now.'));
}
