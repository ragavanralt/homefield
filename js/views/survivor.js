// Survivor: pick one team to win each period. Lose and you are out. No team twice. Last one standing takes the pot.
import { h, clear, toast, poll } from '../ui.js';
import * as soc from '../social.js';
import { getBank } from '../store.js';
import { gate, claimBar, fmt, dayTime, loader, actionBtn, errText } from '../social-ui.js';

const NAME = { nfl: 'NFL Survivor', nba: 'NBA Survivor' };
const label = (lg) => NAME[lg] || `${String(lg).toUpperCase()} Survivor`;

export async function render(root) {
  if (!gate(root, 'Survivor', 'Pick a winner each period. One loss and you are out. You cannot use a team twice.')) return;
  const host = h('div', { class: 'survivor' });
  root.append(claimBar(() => run(true)), host);
  const run = loader(host, () => soc.survivor(), (d) => {
    if (!d.pools.length) host.append(h('div', { class: 'empty' }, h('h3', null, 'No pools yet'), h('p', null, 'Pools open automatically when the next slate lands.')));
    d.pools.forEach((p) => host.append(pool(p, () => run(true))));
  });
  run();
  const stop = poll(() => run(true), 45000);
  return () => stop();
}

function pool(p, reload) {
  const teamName = (id) => { for (const g of p.games) { if (g.home.id === id) return g.home; if (g.away.id === id) return g.away; } return null; };
  const used = new Map(p.picks.map((x) => [x.team_id, x]));
  const myPick = p.picks.find((x) => x.period === p.period);
  const status = p.status === 'open' ? (p.lock_at ? `Starts ${dayTime(p.lock_at)}` : 'Waiting for games') : `Live · ${p.period || ''}`;
  const sec = h('section', { class: 'card pool', 'data-league': p.league },
    h('h2', { class: 'card-h' }, label(p.league), h('small', null, `pot ${fmt(p.pot)} · ${p.entries.filter((e) => e.alive).length} alive`)),
    h('p', { class: 'muted' }, `${status} · entry ${fmt(p.entry)} coins${p.round > 1 ? ` · round ${p.round}` : ''}`),
    p.last ? h('p', { class: 'muted' }, `Last round: ${(p.last.winners || []).join(', ') || 'no one'} took ${fmt(p.last.pot)}.`) : null);

  if (!p.joined) {
    if (p.status === 'open' && p.lock_at) {
      sec.append(h('div', { class: 'row wrap' }, actionBtn(`Join for ${fmt(p.entry)} coins`, async () => { await soc.survivorJoin(p.id, p.entry); toast('You are in'); reload(); }, 'btn main'),
        h('small', { class: 'muted' }, `You have ${fmt(getBank().coins)}. Fewer than 2 players? Everyone gets their entry back.`)));
    } else sec.append(h('p', { class: 'muted' }, p.status === 'live' ? 'This round is already going. You can join the next one.' : 'Joining opens when games are on the slate.'));
  } else if (!p.alive) {
    sec.append(h('p', { class: 'pool-out', role: 'status' }, 'You are out this round.'));
  } else {
    sec.append(h('p', { class: 'pool-in', role: 'status' }, myPick ? `Your pick: ${(teamName(myPick.team_id) || {}).name || myPick.team_id}${myPick.auto ? ' (auto)' : ''}` : 'You are in. Pick a team below. If you forget, we pick the favourite you have not used.'));
    if (p.status === 'open') sec.append(actionBtn('Leave and get entry back', async () => { await soc.survivorLeave(p.id); toast('Left. Collect your entry from the banner.'); reload(); }, 'btn small danger'));
    if (p.games.length) {
      sec.append(h('div', { class: 'stack sv-games' }, p.games.map((g) => {
        const started = new Date(g.start_at) <= new Date();
        const btn = (side) => {
          const t = g[side], fav = g.fav_team === t.id;
          const prior = used.get(t.id);
          const blocked = started || (prior && prior.period !== p.period && prior.result !== 'void');
          const on = myPick && myPick.team_id === t.id && myPick.game_id === g.game_id;
          return h('button', { type: 'button', class: 'side' + (on ? ' on' : ''), disabled: blocked ? '' : null, 'aria-pressed': on ? 'true' : 'false', 'data-team': t.id,
            onclick: async () => { try { await soc.survivorPick(p.id, g.game_id, t.id); toast(`${t.name} locked in`); reload(); } catch (e) { toast(errText(e)); } } },
            t.name || t.abbr, h('small', null, prior && prior.period !== p.period ? 'used' : fav ? `fav ${Math.round(g.fav_prob * 100)}%` : ''));
        };
        return h('article', { class: 'dcard', 'data-game': g.game_id }, h('div', { class: 'dc-t' }, h('b', null, `${g.away.abbr || g.away.name} at ${g.home.abbr || g.home.name}`), h('small', null, started ? 'Started' : dayTime(g.start_at))), h('div', { class: 'dc-s' }, btn('away'), btn('home')));
      })));
    }
  }
  if (p.entries.length) {
    sec.append(h('h3', null, 'Who is in'), h('ul', { class: 'sv-list' }, p.entries.map((e) => h('li', { class: e.alive ? 'alive' : 'out' },
      h('b', null, e.display), h('span', null, e.alive ? 'alive' : `out${e.out_period ? ' ' + e.out_period : ''}`),
      e.pick ? h('small', null, `${(teamName(e.pick.team_id) || {}).name || 'picked'}${e.pick.result ? ' · ' + e.pick.result : ''}`) : null))));
  }
  if (p.picks.length) sec.append(h('p', { class: 'muted' }, `Teams used so far: ${p.picks.filter((x) => x.result !== 'void').length}${p.picks.some((x) => x.result === 'win') ? ` (${p.picks.filter((x) => x.result === 'win').length} wins)` : ''}. Those are off the table.`));
  return sec;
}
