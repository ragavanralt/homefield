// The cash out strip under an open bet: the offer, the live win chance, and the button.
import { getSummary } from './espn.js';
import { quoteBet } from './cashmodel.js';
import { cashOutBet, getBank } from './store.js';
import { h, clear, toast } from './ui.js';

/* ---------- on screen ---------- */
const fmt = (n) => Math.round(n).toLocaleString();

/** Live games for a bet, fetched together. Games that have not started need nothing. */
export async function statesFor(bet, ttl = 15000, now = Date.now()) {
  const need = new Map();
  for (const l of bet.legs) if (l.result === 'pending' && new Date(l.date).getTime() <= now) need.set(l.gameKey, l);
  const states = new Map();
  await Promise.all([...need.values()].map(async (l) => { try { const s = await getSummary(l.league, l.gameId, ttl); if (s && s.game) states.set(l.gameKey, s); } catch (e) { /* no feed for that game right now */ } }));
  return states;
}

/** The cash out strip under an open bet. Re-prices every 30 seconds while it is on screen. Returns null for a settled bet. */
export function cashBox(b) {
  if (!b || b.status !== 'pending') return null;
  const box = h('div', { class: 'cash', 'data-cash': b.id });
  let stop = false, shown = false, asking = false;
  const born = Date.now();
  const draw = (q) => {
    clear(box);
    if (!q.ok) { box.append(h('small', { class: 'muted' }, q.reason)); return; }
    const take = async () => {
      asking = true; draw(q);
      const fresh = quoteBet(b, await statesFor(b, 2000), Date.now(), getBank().streak); // price it again right now
      if (!fresh.ok) { asking = false; toast(fresh.reason); draw(fresh); return; }
      clear(box).append(
        h('div', { class: 'cash-ask' },
          h('span', null, fresh.offer === q.offer ? `Take ${fmt(fresh.offer)} coins now?` : `The offer moved to ${fmt(fresh.offer)} coins. Take it?`),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn main', 'data-act': 'cash-yes', onclick: () => { stop = true; if (cashOutBet(b.id, fresh.offer)) { toast(`Cashed out for ${fmt(fresh.offer)} coins${fresh.offer >= b.stake ? ` (+${fmt(fresh.offer - b.stake)})` : ` (${fmt(fresh.offer - b.stake)})`}`); if (typeof window !== 'undefined') window.dispatchEvent(new Event('homefield:settled')); } else toast('That bet is already settled.'); } }, `Cash out ${fmt(fresh.offer)}`),
            h('button', { type: 'button', class: 'btn', onclick: () => { asking = false; draw(q); } }, 'Keep it'))));
    };
    if (asking) { box.append(h('small', { class: 'muted' }, 'Checking the live score…')); return; }
    box.append(
      h('button', { type: 'button', class: 'btn cash-btn', 'data-act': 'cash', onclick: take }, h('span', null, 'Cash out'), h('b', null, fmt(q.offer))),
      h('small', { class: 'muted cash-sub' }, q.final ? 'All games are done.' : `${Math.round(q.pWin * 100)}% to win · pays ${fmt(q.hold)} if it does${q.rough ? ' · rough estimate' : ''}`));
  };
  const tick = async () => {
    if (stop) return;
    if (!box.isConnected) { if (!shown && Date.now() - born < 10000) setTimeout(tick, 300); else stop = true; return; }
    shown = true;
    if (!asking) {
      try { draw(quoteBet(b, await statesFor(b), Date.now(), getBank().streak)); }
      catch (e) { clear(box); box.append(h('small', { class: 'muted' }, 'Cash out is unavailable right now.')); }
    }
    if (!stop) setTimeout(tick, 30000);
  };
  setTimeout(tick, 0);
  return box;
}
