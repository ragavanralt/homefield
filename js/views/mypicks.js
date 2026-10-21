// Live: everything you have riding right now, with a live bar for each pick whose game has started.
import { h, poll } from '../ui.js';
import { pageHead } from '../components.js';
import { openBets, getBank } from '../store.js';
import * as soc from '../social.js';
import { liveLine, legCard } from '../cardlive.js';
import { fmt, dayTime, add, loader } from '../social-ui.js';

const mark = (r) => (r === 'won' ? '✓' : r === 'lost' ? '✗' : r === 'push' || r === 'void' ? '–' : '•');

function betCard(b) {
  const legs = b.legs || [];
  return h('article', { class: 'card live-bet', 'data-bet': b.id },
    h('div', { class: 'bet-h' },
      h('div', { class: 'bet-who' }, h('b', null, b.mode === 'parlay' ? `${legs.length}-leg parlay` : legs[0] ? legs[0].label : 'Pick'), h('small', null, `Stake ${fmt(b.stake)} · pays ${fmt(Math.round(b.stake * (b.dec || 1)))}`)),
      h('span', { class: 'pill' }, `${legs.filter((l) => l.result === 'won').length}/${legs.length} in`)),
    h('div', { class: 'stack' }, legs.map((l) => {
      const c = legCard(l);
      return h('div', { class: 'live-leg ' + (l.result || 'pending') },
        h('div', { class: 'row' }, h('span', { class: 'lm', 'aria-hidden': 'true' }, mark(l.result)), h('div', null, h('span', null, l.label), h('small', { class: 'muted' }, ` ${l.away ? l.away.abbr : ''} @ ${l.home ? l.home.abbr : ''} · ${new Date(l.date).getTime() > Date.now() ? dayTime(l.date) : 'started'}`))),
        c && l.result === 'pending' ? liveLine(c) : null);
    })));
}

export async function render(root) {
  root.append(pageHead('Live picks', 'Everything you have riding right now.'));
  const host = h('div', { class: 'stack' });
  root.append(host);
  const paint = async () => {
    const bets = openBets().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    let f = null;
    if (soc.enabled() && soc.signedIn()) f = await soc.daily().catch(() => null);
    const mineDaily = f ? (f.cards || []).filter((c) => c.mine && !c.result) : [];
    host.replaceChildren();
    add(host,
      h('section', { class: 'stack' }, h('h2', { class: 'card-h' }, 'Your bets', h('small', null, `${bets.length} open · ${fmt(getBank().coins)} coins`)),
        bets.length ? bets.map(betCard) : h('div', { class: 'empty' }, h('p', null, 'Nothing open. Add picks from Pick\'em and they show up here.'), h('a', { class: 'btn main', href: '#/picks' }, 'Find picks'))),
      f ? h('section', { class: 'stack' }, h('h2', { class: 'card-h' }, 'Daily Five', h('small', null, `${mineDaily.length} live`)),
        mineDaily.length ? mineDaily.map((c) => h('article', { class: 'card dcard', 'data-card': c.id },
          h('div', { class: 'dc-t' }, h('b', null, c.title), h('small', null, `You took ${c.line != null && c.kind !== 'winner' ? `${c.mine === 'a' ? c.a : c.b} ${c.line}` : c.mine === 'a' ? c.a : c.b}`)),
          liveLine(c) || h('small', { class: 'muted' }, `Starts ${dayTime(c.start_at)}`)))
          : h('p', { class: 'muted' }, 'No Daily Five picks waiting on a game.'), h('a', { href: '#/daily' }, 'Open the Daily Five')) : null);
  };
  await paint();
  const stop = poll(paint, 120000);
  return () => stop();
}
