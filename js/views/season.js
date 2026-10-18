// Your season: bankroll, record, best calls, badges and games watched.
import { h, clear, emptyState } from '../ui.js';
import { getState } from '../store.js';
import { LEAGUES } from '../leagues.js';
import { pageHead } from '../components.js';
import { bankStrip, betCard } from '../bankroll.js';
import { betStats, badges, american, fmtX } from '../bets.js';
import { settleAll } from '../settle.js';
import { fmtDay } from '../util.js';

export async function render(root) {
  root.append(pageHead('Your season', 'Everything you have bet and watched, saved on this device.'));
  const bank = bankStrip();
  const host = h('div', { class: 'stack' });
  root.append(bank.el, host);

  function draw() {
    const state = getState();
    const st = betStats(state.bets, state.bank);
    const watched = Object.entries(state.watched).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.ts - a.ts);
    clear(host);

    host.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, 'Badges', h('small', null, `${badges(st, state.bank).filter((b) => b.got).length} of 6`)),
      h('div', { class: 'badges' }, badges(st, state.bank).map((b) => h('div', { class: 'badge' + (b.got ? ' got' : '') }, h('div', { class: 'bd-n' }, b.name), h('small', null, b.blurb))))));

    const calls = h('div', { class: 'calls' });
    const call = (cls, label, b, text) => calls.append(h('div', { class: 'call ' + cls }, h('small', null, label), h('div', { class: 'call-t' }, b.mode === 'parlay' ? `${b.legs.length}-leg parlay` : b.legs[0].label), h('p', null, text)));
    if (st.biggest) call('good', 'Biggest win', st.biggest, `Paid ${(st.biggest.payout).toLocaleString()} coins on a ${st.biggest.stake.toLocaleString()} stake.`);
    if (st.longshot && st.longshot.dec >= 2) call('good', 'Boldest hit', st.longshot, `You cashed a ${fmtX(st.longshot.dec)} (${american(st.longshot.dec)}) price.`);
    if (calls.children.length) host.append(calls);

    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Numbers'),
      h('dl', { class: 'facts2' },
        h('dt', null, 'Bets placed'), h('dd', null, String(st.total)),
        h('dt', null, 'Open'), h('dd', null, String(st.pending)),
        h('dt', null, 'Win rate'), h('dd', null, st.accuracy != null ? Math.round(st.accuracy * 100) + '%' : 'No settled bets yet'),
        h('dt', null, 'Best streak'), h('dd', null, String(st.bestStreak)),
        h('dt', null, 'Prop wins'), h('dd', null, String(st.propWins)),
        h('dt', null, 'Parlays hit'), h('dd', null, `${st.parlayWins}${st.biggestParlay ? ` (biggest: ${st.biggestParlay} legs)` : ''}`),
        h('dt', null, 'Peak bankroll'), h('dd', null, state.bank.peak.toLocaleString()))));

    const recent = Object.values(state.bets).filter((b) => b.status !== 'pending').sort((a, b) => b.ts - a.ts).slice(0, 6);
    if (recent.length) host.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, 'Recent results'), h('div', { class: 'betgrid' }, recent.map(betCard))));

    if (watched.length) {
      host.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, 'Games you watched', h('small', null, String(watched.length))),
        h('div', { class: 'pk-list' }, watched.slice(0, 20).map((w) => {
          const [lg, id] = w.key.split(':');
          return h('a', { class: 'pk', href: `#/game/${lg}/${id}` }, h('span', { class: 'pk-l' }, LEAGUES[lg]?.label || lg), h('span', { class: 'pk-m' }, `${w.away} ${w.awayScore ?? ''} – ${w.homeScore ?? ''} ${w.home}`), h('span', { class: 'pk-p' }, w.date ? fmtDay(w.date) : ''));
        }))));
    }
    if (!st.total && !watched.length) host.append(emptyState('Nothing here yet', 'Place a bet or mark a game as watched and your season starts filling in.', h('a', { class: 'btn main', href: '#/picks' }, "Go to Pick'em")));
  }
  draw();
  settleAll().then((n) => { if (n) draw(); }).catch(() => {});
  return () => bank.stop();
}
