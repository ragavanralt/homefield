// Coin log: every coin that came in or went out, and what it was for. Built to help tune the economy.
import { h, clear, toast } from '../ui.js';
import { pageHead } from '../components.js';
import { getLedger, getBank } from '../store.js';
import { itemById } from '../avatar.js';

const fmt = (n) => Math.round(n).toLocaleString();
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

// name shown for each kind of entry, and which side of the ledger the group sits on in the summary
export const KINDS = {
  stake: 'Bets placed', win: 'Bet winnings', refund: 'Bet refunds', cashout: 'Cash outs',
  daily: 'Daily bonus', quest: 'Quests', rescue: 'Rescue coins', shop: 'Shop',
  game: 'Crew game stakes', 'game-back': 'Crew stakes returned', 'game-win': 'Crew game winnings',
  sync: 'Other device (sync)', reset: 'Reset', other: 'Other',
};
const RANGES = [['today', 'Today', 1], ['week', '7 days', 7], ['all', 'All kept', 0]];

export const noteOf = (e) => (e.k === 'shop' ? ((itemById(e.note) || {}).name || e.note || 'Item') : e.note || '');
const dayKey = (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Group entries by kind: { k, label, in, out, n } sorted by size. */
export function tally(entries) {
  const by = new Map();
  for (const e of entries) {
    const g = by.get(e.k) || { k: e.k, label: KINDS[e.k] || KINDS.other, in: 0, out: 0, n: 0 };
    if (e.d > 0) g.in += e.d; else g.out += -e.d;
    g.n++; by.set(e.k, g);
  }
  return [...by.values()];
}
export const csvOf = (entries) => ['when,kind,what,coins,balance', ...entries.map((e) => [new Date(e.ts).toISOString(), KINDS[e.k] || e.k, `"${String(noteOf(e)).replace(/"/g, '""')}"`, e.d, e.bal].join(','))].join('\n');

export async function render(root) {
  root.append(h('a', { class: 'back-link', href: '#/settings' }, '‹ Settings'), pageHead('Coin log', 'Every coin in and out, and what it was for.'));
  let range = 'week';
  const top = h('div', { class: 'stack' });
  root.append(top);

  const draw = () => {
    const all = getLedger();
    const days = (RANGES.find((r) => r[0] === range) || RANGES[1])[2];
    const from = days ? Date.now() - days * 864e5 : 0;
    const list = all.filter((e) => e.ts >= (range === 'today' ? new Date().setHours(0, 0, 0, 0) : from));
    const inn = list.reduce((n, e) => n + (e.d > 0 ? e.d : 0), 0), out = list.reduce((n, e) => n + (e.d < 0 ? -e.d : 0), 0);
    const tl = tally(list);
    const bar = (v, max, cls) => h('div', { class: 'cl-bar ' + cls }, h('i', { style: { width: `${max ? Math.max(2, Math.round((v / max) * 100)) : 0}%` } }));
    const side = (title, key, cls) => {
      const rows = tl.filter((g) => g[key] > 0).sort((a, b) => b[key] - a[key]);
      const max = rows.length ? rows[0][key] : 0, total = key === 'in' ? inn : out;
      return h('section', { class: 'card cl-side' }, h('h3', { class: 'card-h' }, title),
        rows.length ? rows.map((g) => h('div', { class: 'cl-row', 'data-kind': g.k },
          h('div', { class: 'cl-top' }, h('span', null, g.label, h('small', { class: 'muted' }, ` · ${g.n}`)), h('b', null, fmt(g[key]), h('small', { class: 'muted' }, total ? ` ${Math.round((g[key] / total) * 100)}%` : ''))),
          bar(g[key], max, cls))) : h('p', { class: 'muted' }, 'Nothing yet.'));
    };
    const first = all.length ? all[0].ts : null;
    const byDay = new Map();
    for (const e of [...list].reverse()) { const k = dayKey(e.ts); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
    clear(top).append(
      h('div', { class: 'seg' }, RANGES.map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (range === k ? ' on' : ''), id: 'cl-' + k, onclick: () => { range = k; draw(); } }, l))),
      h('div', { class: 'cl-sum' },
        h('div', { class: 'card cl-n in' }, h('small', null, 'Came in'), h('b', null, '+' + fmt(inn))),
        h('div', { class: 'card cl-n out' }, h('small', null, 'Went out'), h('b', null, '−' + fmt(out))),
        h('div', { class: 'card cl-n' }, h('small', null, 'Net'), h('b', { class: inn - out >= 0 ? 'ok' : 'no' }, signed(inn - out))),
        h('div', { class: 'card cl-n' }, h('small', null, 'Balance now'), h('b', null, fmt(getBank().coins)))),
      h('div', { class: 'cl-grid' }, side('Where it came from', 'in', 'in'), side('Where it went', 'out', 'out')),
      h('section', { class: 'card' },
        h('div', { class: 'row wrap', style: { justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
          h('h3', { class: 'card-h' }, `Every entry (${list.length})`),
          h('button', { type: 'button', class: 'btn small', id: 'cl-copy', disabled: !list.length, onclick: async () => { try { await navigator.clipboard.writeText(csvOf([...list].reverse())); toast('Copied. Paste it into a sheet.'); } catch (e) { toast('Could not copy on this device.'); } } }, 'Copy as CSV')),
        list.length ? [...byDay.entries()].map(([day, es]) => h('div', { class: 'cl-day' }, h('p', { class: 'mk-t' }, day),
          h('ul', { class: 'cl-list' }, es.map((e) => h('li', { class: 'cl-e ' + (e.d > 0 ? 'in' : 'out'), 'data-kind': e.k },
            h('div', { class: 'cl-w' }, h('b', null, KINDS[e.k] || KINDS.other), noteOf(e) ? h('small', { class: 'muted' }, noteOf(e)) : null, h('small', { class: 'muted' }, clock(e.ts))),
            h('div', { class: 'cl-a' }, h('b', null, signed(e.d)), h('small', { class: 'muted' }, `bal ${fmt(e.bal)}`))))))) : h('p', { class: 'muted pad' }, 'No coins moved in this range.')),
      h('p', { class: 'muted small-note' }, `This log is kept on this device (the newest 600 entries)${first ? `, and started ${new Date(first).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}. Coins you had before it started aren't in it.`));
  };
  draw();
}
