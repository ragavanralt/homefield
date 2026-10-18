// Reusable pieces: game cards and the watch-worthy meter.
import { h, crest, applySkin, isHidden, scoreText } from './ui.js';
import { isSoccer, leagueLabel } from './leagues.js';
import { watchScore, watchLabel, watchReason } from './winprob.js';
import { fmtDay, fmtTime, sameDay } from './util.js';
import { rememberGame } from './espn.js';

export const pageHead = (title, sub) => h('div', { class: 'page-head' }, h('h1', null, title), sub ? h('p', null, sub) : null);

export function statusInfo(g) {
  if (g.void) return { text: 'Postponed', cls: 'void', sub: '' };
  if (g.state === 'in') return { text: g.shortDetail || 'Live', cls: 'live', sub: '' };
  if (g.state === 'post') return { text: g.shortDetail && g.shortDetail !== 'Final' ? g.shortDetail : 'Final', cls: 'final', sub: '' };
  const d = new Date(g.date);
  const today = sameDay(d, new Date());
  return { text: fmtTime(g.date), cls: 'pre', sub: today ? 'Today' : fmtDay(g.date) };
}

export function gameCard(g, { team = null, showLeague = false } = {}) {
  const st = statusInfo(g);
  const order = isSoccer(g.league) ? ['home', 'away'] : ['away', 'home'];
  const other = (side) => (side === 'home' ? 'away' : 'home');
  const row = (side) => {
    const t = g[side];
    const lose = g.state === 'post' && (g[other(side)].score ?? 0) > (t.score ?? 0);
    return h('div', { class: 'gt' + (lose ? ' lose' : '') },
      crest(t, 34),
      h('div', { class: 'nm' }, h('span', { class: 'n' }, t.name || t.abbr), t.record ? h('small', null, t.record) : null),
      g.state === 'pre' ? null : h('div', { class: 'sc' }, scoreText(g, side)),
    );
  };
  const ws = isHidden(g) ? null : watchScore(g);
  const meta = [showLeague ? leagueLabel(g.league) : '', g.venue, g.broadcast].filter(Boolean).join(' · ');
  const card = h('a', { class: `gcard ${g.state}${team ? ' mine' : ''}`, href: `#/game/${g.league}/${g.id}`, onclick: () => rememberGame(g) },
    h('div', { class: 'g-main' },
      h('div', { class: 'g-teams' }, order.map(row)),
      h('div', { class: 'g-stat' }, h('span', { class: 'st ' + st.cls }, st.cls === 'live' ? h('i', { class: 'ldot' }) : null, st.text), st.sub ? h('small', null, st.sub) : null),
    ),
    meta ? h('div', { class: 'g-meta' }, meta) : null,
    ws != null ? h('div', { class: 'g-watch' },
      h('div', { class: 'wbar' }, h('i', { style: { width: ws + '%' } })),
      h('span', null, `Watch-worthy ${ws}`), h('em', null, watchLabel(ws))) : null,
  );
  if (team) applySkin(card, team.color, team.alt);
  return card;
}

export function watchBlock(g) {
  const ws = watchScore(g);
  if (ws == null) return null;
  return h('div', { class: 'watch' },
    h('div', { class: 'w-num' }, String(ws), h('small', null, '/100')),
    h('div', { class: 'w-body' },
      h('div', { class: 'eyebrow' }, 'Watch-worthy meter'),
      h('div', { class: 'wbar big' }, h('i', { style: { width: ws + '%' } })),
      h('div', { class: 'w-line' }, h('span', { class: 'w-label' }, watchLabel(ws)), ' · ', watchReason(g)),
    ),
  );
}
