// You: your own record, peak bankroll, biggest wins and losses, favourite teams and trophies. The same page opens for anyone in the
// crew (#/crew/u/handle), built from the stats they publish, so you can see their open tickets and how they stack up against you.
import { h, clear, crest, applySkin, toast } from '../ui.js';
import { pageHead } from '../components.js';
import { getState, getBank } from '../store.js';
import * as soc from '../social.js';
import { renderAvatar, avatarTeam, copyLook } from '../avatar.js';
import { levelFor, xpForLevel, rankFor, badges, fmtX, american } from '../bets.js';
import { leagueLabel } from '../leagues.js';
import { mirrorBet, mirrorMsg } from '../mirror.js';
import { betCard } from '../bankroll.js';
import { fmtDay } from '../util.js';
import { add, bubble, fmt, loader, errText } from '../social-ui.js';

const pct = (a) => (a == null ? '–' : Math.round(a * 100) + '%');
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== undefined && v !== '' ? Number(v) : null);
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 3 ? 'Active now' : m < 60 ? `Active ${m}m ago` : m < 1440 ? `Active ${Math.round(m / 60)}h ago` : `Active ${Math.round(m / 1440)}d ago`; };
const MARKET = { ml: 'Moneylines', prop: 'Player props', special: 'Game bets' };
const CATALOG = badges({ won: 0, biggestParlay: 0, longshot: null, propWins: 0, bestStreak: 0 }, { peak: 0 });

/** A model for one person: { display, handle, avatar, team, stats, ... }. Mine is built from this device, theirs from the crew list. */
function mineModel() {
  const s = getState();
  const pub = soc.publicOf(s);
  const u = soc.signedIn() ? soc.me() : null;
  const team = s.teams.find((x) => `${x.league}:${x.id}` === s.avatar.team) || s.teams[0] || null;
  return { me: true, display: (u && u.display) || 'You', handle: u && u.handle, crew: u && u.crew && u.crew.name, avatar: s.avatar, team: team || pub.team, stats: pub.stats, jersey: avatarTeam(s.avatar) };
}

/** a coloured tile with one number */
const tile = (label, value, sub, cls = '', id) => h('div', { class: 'yo-tile ' + cls, 'data-tile': id || label }, h('small', null, label), h('b', null, value), sub ? h('small', { class: 'yo-sub' }, sub) : null);

function hero(m) {
  const st = m.stats || {};
  const card = h('section', { class: 'card yo-hero' });
  if (m.team) applySkin(card, m.team.color, m.team.alt);
  const lvl = num(st.xp) != null ? levelFor(st.xp) : null;
  const lo = lvl ? xpForLevel(lvl) : 0, hi = lvl ? xpForLevel(lvl + 1) : 1;
  const av = m.avatar && m.avatar.eq ? renderAvatar(m.avatar, m.me ? m.jersey : m.team || null, 'bust') : bubble(m, 'bust');
  add(card,
    h('div', { class: 'yo-stage' }, av),
    h('div', { class: 'yo-id' },
      h('h2', { class: 'yo-name' }, m.me ? m.display : m.display, m.owner ? h('small', { class: 'yo-tag' }, 'owner') : null),
      h('small', { class: 'yo-handle' }, [m.handle ? `@${m.handle}` : null, m.crew, m.me ? 'you' : m.last_seen ? ago(new Date(m.last_seen).getTime()) : null].filter(Boolean).join(' · ')),
      lvl ? h('div', { class: 'yo-rank' }, h('b', null, `Level ${lvl}`), h('span', null, rankFor(lvl))) : null,
      lvl ? h('div', { class: 'xp yo-xp', title: `${fmt(st.xp)} / ${fmt(hi)} XP` }, h('i', { style: { width: Math.max(2, Math.min(100, ((st.xp - lo) / (hi - lo)) * 100)) + '%' } })) : null,
      m.team ? h('div', { class: 'yo-fav' }, crest(m.team, 28), h('span', null, h('small', null, 'Favourite team'), h('b', null, m.team.name || m.team.abbr))) : null),
    h('div', { class: 'yo-coins' }, h('i', { class: 'coin' }), h('b', null, fmt(st.coins)), h('small', null, num(st.pk) != null ? `peak ${fmt(st.pk)}` : 'coins')));
  return card;
}

function tickets(m) {
  const st = m.stats || {};
  const box = h('section', { class: 'card yo-open', id: 'yo-open' });
  let list;
  if (m.me) list = Object.values(getState().bets).filter((b) => b.status === 'pending').sort((a, b) => (b.ts || 0) - (a.ts || 0));
  else list = ((st.recent || []).filter((b) => b.status === 'pending')).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const risk = list.reduce((n, b) => n + (b.stake || 0), 0), win = list.reduce((n, b) => n + Math.round((b.stake || 0) * (b.dec || 1)), 0);
  add(box, h('h2', { class: 'card-h' }, 'On the line', h('small', null, list.length ? `${list.length} open · ${fmt(risk)} at risk · up to ${fmt(win)}` : 'nothing open right now')));
  if (!list.length) add(box, h('p', { class: 'muted' }, m.me ? 'No open tickets. Add picks from Pick\'em and they show up here.' : (st.recent ? 'No open tickets right now.' : 'Their open tickets are private.')));
  else if (m.me) add(box, h('div', { class: 'betgrid' }, list.slice(0, 6).map(betCard)), list.length > 6 ? h('a', { class: 'btn small', href: '#/mypicks' }, `See all ${list.length} in Live picks`) : h('a', { class: 'btn small', href: '#/mypicks' }, 'Open Live picks'));
  else add(box, h('div', { class: 'feed-list' }, list.map((b) => ticket(m, b))));
  return box;
}
/** someone else's open ticket, with a Mirror button */
function ticket(m, b, settled) {
  const now = Date.now();
  const live = (b.legs || []).filter((l) => new Date(l.date).getTime() > now);
  const mark = (l) => (l.result === 'won' ? '✓' : l.result === 'lost' ? '✗' : l.result === 'push' || l.result === 'void' ? '–' : '•');
  return h('article', { class: 'bet-card pending yo-ticket', 'data-bet': b.id },
    h('div', { class: 'bet-h' }, h('div', { class: 'bet-who' }, h('b', null, b.mode === 'parlay' ? `${(b.legs || []).length}-leg parlay` : 'Single'), h('small', null, `${fmt(b.stake)} → ${fmt(Math.round(b.stake * (b.dec || 1)))} · ${fmtX(b.dec || 1)} (${american(b.dec || 1)})`)), h('span', { class: 'pill ' + (settled ? b.status : 'pending') }, settled ? (b.cashed ? `Cashed out ${b.payout - b.stake >= 0 ? '+' : '−'}${fmt(Math.abs(b.payout - b.stake))}` : b.status === 'won' ? `Won +${fmt(b.payout - b.stake)}` : b.status === 'lost' ? `Lost ${fmt(b.stake)}` : 'Push') : 'Open')),
    h('ul', { class: 'bet-legs' }, (b.legs || []).map((l) => h('li', { class: l.result || 'pending' }, h('span', { class: 'lm', 'aria-hidden': 'true' }, mark(l)),
      h('span', null, l.label || 'Pick', l.away && l.home ? h('small', null, ` ${l.away.abbr} @ ${l.home.abbr}`) : null), l.dec ? h('em', null, `${Number(l.dec).toFixed(2)}x`) : null))),
    settled ? null : h('div', { class: 'row wrap bet-act' },
      live.length ? h('button', { type: 'button', class: 'btn small main mirror', onclick: () => toast(mirrorMsg(mirrorBet(b))) }, '⇄ Mirror this bet') : h('small', { class: 'muted' }, 'Games already started')));
}


/** Settled bets and games watched, newest first */
function history(m) {
  const st = m.stats || {};
  let done, watched;
  if (m.me) {
    const s = getState();
    done = Object.values(s.bets).filter((b) => b.status !== 'pending').sort((a, b) => (b.settledTs || b.ts || 0) - (a.settledTs || a.ts || 0)).slice(0, 12);
    watched = Object.entries(s.watched || {}).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, 30).map(([k, w]) => [k, w.away, w.home, w.awayScore ?? null, w.homeScore ?? null, w.ts, w.date]);
  } else {
    done = (st.recent || []).filter((b) => b.status !== 'pending');
    watched = Array.isArray(st.wl) ? st.wl : [];
  }
  const total = m.me ? Object.keys(getState().watched || {}).length : num(st.watched) || watched.length;
  const res = h('section', { class: 'card yo-results', id: 'yo-results' }, h('h2', { class: 'card-h' }, 'Recent results'),
    done.length ? (m.me ? h('div', { class: 'betgrid' }, done.map(betCard)) : h('div', { class: 'feed-list' }, done.map((b) => ticket(m, b, true)))) : h('p', { class: 'muted' }, m.me ? 'Nothing settled yet.' : st.recent ? 'Nothing settled yet.' : 'Their results are private.'));
  const gw = h('section', { class: 'card yo-watched', id: 'yo-watched' }, h('h2', { class: 'card-h' }, 'Games watched', h('small', null, total ? String(total) : '')),
    watched.length ? h('div', { class: 'pk-list' }, watched.map(([key, away, home, as, hs, ts, date]) => {
      const [lg, id] = String(key).split(':');
      return h('a', { class: 'pk', href: `#/game/${lg}/${id}` }, h('span', { class: 'pk-l' }, leagueLabel(lg)), h('span', { class: 'pk-m' }, `${away} ${as ?? ''} – ${hs ?? ''} ${home}`), h('span', { class: 'pk-p' }, date ? fmtDay(date) : ts ? fmtDay(ts) : ''));
    })) : h('p', { class: 'muted' }, m.me ? 'Open a game and tap Mark watched. It shows up here.' : 'No games marked as watched yet.'));
  return [res, gw];
}

function numbers(m) {
  const st = m.stats || {};
  const dec = (st.won || 0) + (st.lost || 0);
  const sd = (n, f) => (num(n) == null ? '–' : f(n));
  return h('section', { class: 'card', id: 'yo-numbers' }, h('h2', { class: 'card-h' }, 'The numbers'),
    h('div', { class: 'yo-grid' },
      tile('Record', `${st.won || 0}–${st.lost || 0}`, dec ? `${pct(st.accuracy)} hit rate` : 'no bets settled yet', '', 'record'),
      tile('Profit', sd(st.profit, signed), num(st.staked) != null && st.staked ? `on ${fmt(st.staked)} staked` : 'all time', num(st.profit) > 0 ? 'up' : num(st.profit) < 0 ? 'down' : '', 'profit'),
      tile('Streak', st.streak ? `🔥 ${st.streak}` : '0', `best ${st.bestStreak || 0} in a row`, st.streak >= 3 ? 'up' : '', 'streak'),
      tile('Peak bankroll', sd(st.pk, fmt), 'highest ever', '', 'peak'),
      tile('Biggest win', st.biggest ? '+' + fmt(st.biggest) : '–', 'one bet', st.biggest ? 'up' : '', 'biggest'),
      tile('Biggest loss', num(st.bl) ? '−' + fmt(st.bl) : '–', 'one bet', num(st.bl) ? 'down' : '', 'loss'),
      tile('Longshot hit', st.longshot ? fmtX(st.longshot) : '–', st.longshot ? american(st.longshot) : 'a winner at long odds', '', 'longshot'),
      tile('Best parlay', st.bigParlay ? `${st.bigParlay} legs` : '–', st.parlays ? `${st.parlays} hit in all` : 'none hit yet', '', 'parlay'),
      m.me || num(st.avg) != null ? tile('Typical stake', sd(st.avg, fmt), num(st.mx) ? `biggest ${fmt(st.mx)}` : '', '', 'stake') : null,
      num(st.co) ? tile('Cash outs', String(st.co), `${signed(st.cn || 0)} coins net`, num(st.cn) >= 0 ? 'up' : 'down', 'cashouts') : null));
}

function formStrip(m) {
  const f = String((m.stats || {}).form || '');
  if (!f) return null;
  const tail = f.slice(-3);
  const mood = tail === 'WWW' ? 'Heating up' : tail === 'LLL' ? 'Ice cold' : f.endsWith('W') ? 'Last one landed' : 'Needs one';
  return h('section', { class: 'card yo-form', id: 'yo-form' }, h('h2', { class: 'card-h' }, 'Recent form', h('small', null, `last ${f.length} · ${mood}`)),
    h('div', { class: 'yo-dots', 'aria-label': 'Recent results, oldest first' }, [...f].map((c) => h('i', { class: 'yo-dot ' + (c === 'W' ? 'w' : 'l'), title: c === 'W' ? 'Won' : 'Lost' }, c))));
}

function teamsCard(m) {
  const st = m.stats || {}, wt = Array.isArray(st.wt) ? st.wt : [];
  const t = m.team;
  return h('section', { class: 'card yo-teams', id: 'yo-teams' }, h('h2', { class: 'card-h' }, 'Teams'),
    t ? h('div', { class: 'yo-team-row' }, crest(t, 44), h('div', null, h('small', null, 'Favourite team'), h('b', null, t.name || t.abbr), h('small', { class: 'muted' }, leagueLabel(t.league)))) : h('p', { class: 'muted' }, 'No favourite team yet.'),
    h('p', { class: 'mk-t' }, 'Most watched'),
    wt.length ? h('div', { class: 'yo-watch' }, wt.map(([l, a, n], i) => h('div', { class: 'yo-w' + (i === 0 ? ' top' : '') }, h('span', { class: 'yo-wn' }, i + 1), h('b', null, a), h('small', null, `${leagueLabel(l)} · ${n} game${n === 1 ? '' : 's'}`))))
      : h('p', { class: 'muted' }, num(st.watched) ? `${st.watched} games marked as watched.` : 'No games marked as watched yet.'));
}

function style(m) {
  const st = m.stats || {};
  const lg = Array.isArray(st.lg) ? st.lg : [], mix = st.mix || null;
  const row = (label, n, w) => h('div', { class: 'yo-bar' }, h('div', { class: 'yo-bar-t' }, h('span', null, label), h('small', null, n ? `${w}–${n - w} · ${Math.round((w / n) * 100)}%` : 'no results yet')), h('div', { class: 'cl-bar in' }, h('i', { style: { width: n ? Math.max(3, Math.round((w / n) * 100)) + '%' : '0%' } })));
  return h('section', { class: 'card yo-style', id: 'yo-style' }, h('h2', { class: 'card-h' }, 'How they bet'),
    st.mk ? h('p', { class: 'yo-mk' }, 'Goes for ', h('b', null, MARKET[st.mk] || 'Moneylines'), ' most.') : null,
    mix ? [row('Singles', mix.s[0], mix.s[1]), row('Parlays', mix.p[0], mix.p[1])] : null,
    lg.length ? [h('p', { class: 'mk-t' }, 'Favourite leagues'), lg.map(([l, n, w]) => row(leagueLabel(l), n, w))] : (!mix ? h('p', { class: 'muted' }, 'Nothing to show yet.') : null),
    num(st.since) ? h('small', { class: 'muted' }, `Betting since ${new Date(st.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${st.dly ? ` · ${st.dly}-day daily streak` : ''}`) : null);
}

function trophies(m) {
  const got = new Set(((m.stats || {}).bd) || []);
  return h('section', { class: 'card yo-trophies', id: 'yo-trophies' }, h('h2', { class: 'card-h' }, 'Trophy case', h('small', null, `${CATALOG.filter((b) => got.has(b.id)).length} of ${CATALOG.length}`)),
    h('div', { class: 'yo-bd' }, CATALOG.map((b) => h('div', { class: 'yo-badge' + (got.has(b.id) ? ' got' : ''), 'data-badge': b.id, title: b.blurb }, h('span', { class: 'yo-bi', 'aria-hidden': 'true' }, got.has(b.id) ? '🏆' : '🔒'), h('b', null, b.name), h('small', null, b.blurb)))));
}

/** you against them, line by line */
function versus(m) {
  const mine = soc.publicOf(getState()).stats, th = m.stats || {};
  const rows = [
    ['Wins', mine.won || 0, th.won || 0, fmt], ['Hit rate', mine.accuracy, th.accuracy, pct], ['Profit', mine.profit || 0, th.profit || 0, signed],
    ['Best streak', mine.bestStreak || 0, th.bestStreak || 0, fmt], ['Peak bankroll', mine.pk || 0, th.pk, fmt], ['Biggest win', mine.biggest || 0, th.biggest || 0, fmt],
  ];
  const win = (a, b) => (num(a) == null || num(b) == null || a === b ? 0 : a > b ? 1 : -1);
  return h('section', { class: 'card yo-vs', id: 'yo-vs' }, h('h2', { class: 'card-h' }, `You vs ${m.display}`),
    h('table', { class: 'tbl' }, h('tbody', null, rows.map(([label, a, b, f]) => h('tr', null, h('td', { class: win(a, b) > 0 ? 'hot' : '' }, num(a) == null ? '–' : f(a)), h('th', null, label), h('td', { class: win(a, b) < 0 ? 'hot' : '' }, num(b) == null ? '–' : f(b)))))));
}

function crewCard(m) {
  const likes = (m.likes && m.likes.current) || 0;
  const tiles = [
    tile('Duels', `${m.duel_w || 0}–${m.duel_l || 0}${m.duel_t ? `–${m.duel_t}` : ''}`, 'won–lost', '', 'duels'),
    tile('Daily 5', m.solo_streak ? `${m.solo_streak} d` : '–', m.solo_best ? `best ${m.solo_best} days` : 'streak', '', 'daily5'),
    tile('Fit likes', `♥ ${likes}`, 'on their current look', '', 'likes'),
  ];
  return h('section', { class: 'card', id: 'yo-crew' }, h('h2', { class: 'card-h' }, 'In the crew'), h('div', { class: 'yo-grid three' }, tiles),
    m.me ? null : h('div', { class: 'row wrap bet-act' },
      h('a', { class: 'btn main', href: `#/duels/vs/${encodeURIComponent(m.handle)}` }, '⚔ Challenge'),
      m.avatar && m.avatar.eq ? h('button', { type: 'button', class: 'btn', onclick: () => { const r = copyLook(m.avatar); toast(r.missing.length ? `Copied ${r.worn.length} piece${r.worn.length === 1 ? '' : 's'}. ${r.missing.length} you do not own yet.` : 'Copied. You are wearing it.'); } }, 'Copy their fit') : null,
      h('a', { class: 'btn', href: '#/crew' }, 'Back to the crew')));
}

function mineExtras() {
  return h('section', { class: 'card', id: 'yo-links' }, h('h2', { class: 'card-h' }, 'Yours'),
    h('div', { class: 'row wrap' },
      h('a', { class: 'btn main', href: '#/profile' }, 'Change your look'), h('a', { class: 'btn', href: '#/coins' }, 'Coin log'), h('a', { class: 'btn', href: '#/mypicks' }, 'Live picks'), h('a', { class: 'btn', href: '#/shop' }, 'Shop')),
    soc.signedIn() ? h('p', { class: 'muted small-note' }, 'The crew sees everything on this page except your private details. Turn "Show my recent bets" off in the Crew tab to hide your tickets.') : h('p', { class: 'muted small-note' }, 'Join the crew and your friends can open this page for you.'));
}

let tab = 'live';
/** The page in tabs: what is on the line now, the numbers, teams, trophies. Every pane is built; only one shows. */
function page(m) {
  const panes = [
    ['live', 'Live', [tickets(m), formStrip(m)]],
    ['numbers', 'Numbers', [numbers(m), style(m), m.me ? null : versus(m), m.me ? null : crewCard(m)]],
    ['history', 'History', history(m)],
    ['teams', 'Teams', [teamsCard(m)]],
    ['trophies', 'Trophies', [trophies(m)]],
  ];
  if (!panes.some(([id]) => id === tab)) tab = 'live';
  const bar = h('div', { class: 'seg yo-tabs', role: 'tablist' });
  const body = h('div', { class: 'stack yo-panes' });
  const paint = () => {
    clear(bar);
    add(bar, panes.map(([id, label]) => h('button', { type: 'button', role: 'tab', class: 'seg-b' + (tab === id ? ' on' : ''), 'aria-selected': tab === id ? 'true' : 'false', 'data-tab': id, onclick: () => { tab = id; paint(); } }, label)));
    for (const el of body.children) el.hidden = el.dataset.pane !== tab;
  };
  for (const [id, , kids] of panes) { const pane = h('div', { class: 'stack yo-pane', 'data-pane': id }); add(pane, kids); body.append(pane); }
  paint();
  return [hero(m), bar, body, m.me ? mineExtras() : null];
}

export async function render(root, params = {}) {
  if (!params.handle) {
    root.append(pageHead('You', 'Your record, your wins and losses, your teams and your trophies.'));
    const host = h('div', { class: 'stack yo' });
    root.append(host);
    add(host, page(mineModel()));
    return;
  }
  const back = h('a', { class: 'back-link', href: '#/crew' }, '‹ Crew');
  root.append(back);
  const host = h('div', { class: 'stack yo' });
  root.append(host);
  if (!soc.enabled() || !soc.signedIn()) { add(host, h('div', { class: 'empty' }, h('h3', null, 'Join the crew first'), h('p', null, 'You need to be in the crew to open profiles.'), h('a', { class: 'btn main', href: '#/crew' }, 'Join or sign in'))); return; }
  const want = String(params.handle).toLowerCase();
  loader(host, () => soc.crew(), (d) => {
    const m = (d.members || []).find((x) => String(x.handle).toLowerCase() === want);
    if (!m) { add(host, h('div', { class: 'empty' }, h('h3', null, 'Not in your crew'), h('p', null, `Nobody called @${params.handle} is in this crew.`), h('a', { class: 'btn', href: '#/crew' }, 'Back to the crew'))); return; }
    if (m.me) { location.hash = '#/you'; return; }
    add(host, page({ ...m, crew: soc.me().crew && soc.me().crew.name }));
  })();
}
