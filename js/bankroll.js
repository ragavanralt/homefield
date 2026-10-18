// Bankroll strip (coins, level, streak, daily bonus) and bet cards. Shared by Pick'em and Season.
import { h, clear, toast } from './ui.js';
import { getState, getBank, claimDaily, dailyReady, canRescue, rescue, onSlipChange } from './store.js';
import { levelFor, xpForLevel, rankFor, streakBoost, betStats, american, fmtX } from './bets.js';
import { fmtDay, fmtTime } from './util.js';

const fmt = (n) => Math.round(n).toLocaleString();

export function bankStrip() {
  const el = h('section', { class: 'bankroll' });
  function draw() {
    const bank = getBank();
    const st = betStats(getState().bets, bank);
    const lvl = levelFor(bank.xp);
    const lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1);
    const pct = Math.max(0, Math.min(100, ((bank.xp - lo) / (hi - lo)) * 100));
    const boost = streakBoost(bank.streak);
    clear(el).append(
      h('div', { class: 'bk-main' }, h('small', null, 'Bankroll'), h('div', { class: 'bk-coins' }, h('i', { class: 'coin' }), fmt(bank.coins))),
      h('div', { class: 'bk-lvl' }, h('div', { class: 'bk-rank' }, `Level ${lvl} · ${rankFor(lvl)}`), h('div', { class: 'xp' }, h('i', { style: { width: pct + '%' } })), h('small', null, `${fmt(bank.xp)} / ${fmt(hi)} XP`)),
      h('div', { class: 'bk-streak' + (bank.streak >= 2 ? ' hot' : '') }, h('small', null, 'Hot streak'), h('div', { class: 'bk-big' }, bank.streak ? `🔥 ${bank.streak}` : '0'), h('small', null, boost ? `+${Math.round(boost * 100)}% on wins` : 'Win bets to build a boost')),
      h('div', { class: 'bk-rec' }, h('small', null, 'Record'), h('div', { class: 'bk-big' }, `${st.won}-${st.lost}`), h('small', null, `${st.profit >= 0 ? '+' : ''}${fmt(st.profit)} coins overall`)),
      h('div', { class: 'bk-act' },
        dailyReady() ? h('button', { type: 'button', class: 'btn main', id: 'daily', onclick: () => { const r = claimDaily(); if (r.ok) toast(`Daily bonus: +${r.bonus} coins (day ${r.streakDays} in a row)`); } }, 'Claim daily bonus') : h('small', null, 'Daily bonus claimed. Back tomorrow.'),
        canRescue() ? h('button', { type: 'button', class: 'btn', id: 'rescue', onclick: () => { if (rescue()) toast('Here is 200 coins to get back in'); } }, 'Out of coins? Get 200') : null));
  }
  draw();
  const stop = onSlipChange(draw);
  return { el, stop };
}

const ICON = { won: '✓', lost: '✕', push: '=', void: '–', pending: '•' };

export function betCard(b) {
  const pend = b.status === 'pending';
  const potential = Math.round(b.stake * b.dec * (1 + streakBoost(getBank().streak)));
  return h('article', { class: 'bet ' + b.status },
    h('div', { class: 'bet-h' },
      h('div', null, h('b', null, b.mode === 'parlay' ? `${b.legs.length}-leg parlay` : 'Single'), h('small', null, ` · ${fmtX(b.dec)} (${american(b.dec)})`)),
      h('span', { class: 'pill ' + b.status }, b.status === 'won' ? `Won +${fmt(b.payout - b.stake)}` : b.status === 'lost' ? `Lost ${fmt(b.stake)}` : b.status === 'void' ? 'Refunded' : 'Open')),
    h('ul', { class: 'bet-legs' }, b.legs.map((l) => h('li', { class: l.result },
      h('span', { class: 'ico' }, ICON[l.result] || '•'),
      h('div', null, h('div', null, l.label), h('small', null, `${l.away.abbr} @ ${l.home.abbr}${l.result === 'pending' && l.date ? ' · ' + fmtDay(l.date) + ' ' + fmtTime(l.date) : ''}`)),
      h('span', { class: 'lo' }, american(l.dec))))),
    h('div', { class: 'bet-f' }, h('span', null, `Stake ${fmt(b.stake)}`), h('span', null, pend ? `To collect ${fmt(potential)}` : b.status === 'won' ? `Paid ${fmt(b.payout)}${b.boost ? ` (incl. +${Math.round(b.boost * 100)}% streak boost)` : ''}` : '')));
}
