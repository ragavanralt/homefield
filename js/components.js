// Reusable pieces: game cards, the watch-worthy meter and the Pick'em panel.
import { h, crest, applySkin, clear, isHidden, scoreText, toast } from './ui.js';
import { getState, update, savePick, removePick } from './store.js';
import { isSoccer, leagueLabel } from './leagues.js';
import { watchScore, watchLabel, watchReason } from './winprob.js';
import { MODES, offer, makePick, SLATE_BONUS } from './picks.js';
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

function statusWord(pick, game) {
  if (pick.status === 'won') return `Won +${pick.points}`;
  if (pick.status === 'lost') return 'Missed';
  if (pick.status === 'void') return 'Void';
  return game && game.state !== 'pre' ? 'Locked in' : 'Open';
}

/** Saves a pick. In Streak Run there is one pick a day, so a new one replaces the old one. */
export function placePick(game, side, mode) {
  const pick = makePick(game, side, mode);
  if (mode === 'streak') {
    for (const p of Object.values(getState().picks)) {
      if (p.mode === 'streak' && p.dayKey === pick.dayKey && p.status === 'pending' && p.key !== pick.key) removePick(p.key);
    }
  }
  savePick(pick);
  return pick;
}

export const pickLabel = (pick) => (pick.side === 'draw' ? 'Draw' : (pick.side === 'home' ? pick.home.abbr : pick.away.abbr));

/** The buttons to pick a side. onChange runs after any change so the page can refresh. */
export function pickPanel(game, onChange) {
  const wrap = h('div', { class: 'pickpanel' });
  function draw() {
    clear(wrap);
    const st = getState();
    const existing = st.picks[game.key];
    const locked = game.state !== 'pre';
    const settled = existing && existing.status !== 'pending';
    let mode = existing?.mode || st.lastMode || 'classic';
    const o = offer(game);

    wrap.appendChild(h('div', { class: 'pp-head' },
      h('span', { class: 'eyebrow' }, "Pick'em"),
      existing ? h('span', { class: 'pill ' + existing.status }, `${pickLabel(existing)} · ${statusWord(existing, game)}`) : null));

    wrap.appendChild(h('div', { class: 'seg', role: 'group', 'aria-label': 'Game mode' },
      Object.entries(MODES).map(([k, m]) => h('button', {
        type: 'button', class: 'seg-b' + (k === mode ? ' on' : ''), disabled: locked || settled,
        onclick: () => { update((s) => { s.lastMode = k; }); mode = k; draw(); },
      }, m.label))));

    const sides = isSoccer(game.league) ? ['home', 'draw', 'away'] : ['home', 'away'];
    wrap.appendChild(h('div', { class: 'pp-sides' + (sides.length === 3 ? ' three' : '') }, sides.map((side) => {
      const label = side === 'draw' ? 'Draw' : game[side].abbr;
      const on = existing && existing.side === side;
      return h('button', {
        type: 'button', class: 'pp-side' + (on ? ' on' : ''), disabled: locked || settled,
        onclick: () => {
          const pick = placePick(game, side, mode);
          toast(`${label} locked in for ${pick.pts} points`);
          draw();
          onChange && onChange();
        },
      }, h('span', { class: 'ps-l' }, label), h('span', { class: 'ps-p' }, `+${o[side].pts} pts`));
    })));

    const foot = [];
    foot.push(MODES[mode].blurb + (mode === 'slate' ? ` (Bonus: ${SLATE_BONUS} points.)` : ''));
    foot.push(o.source === 'odds' ? 'Payouts follow betting odds. Bigger underdog, bigger payout.' : o.source === 'records' ? 'Payouts follow team records. Bigger underdog, bigger payout.' : 'No odds or records yet, so payouts start even.');
    wrap.appendChild(h('p', { class: 'pp-note' }, foot.join(' ')));
    if (existing && !locked && !settled) {
      wrap.appendChild(h('button', { type: 'button', class: 'btn small', onclick: () => { removePick(game.key); draw(); onChange && onChange(); } }, 'Remove pick'));
    }
    if (locked && !existing) wrap.appendChild(h('p', { class: 'pp-note' }, 'This game has started, so picks are closed.'));
  }
  draw();
  return wrap;
}
