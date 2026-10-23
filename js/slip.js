// The betslip: a panel that follows you around the app. Singles or a parlay, then place the bet.
import { h, clear, toast } from './ui.js';
import { getState, getBank, removeLeg, clearSlip, setSlip, placeSlip, onSlipChange } from './store.js';
import { MIN_STAKE, MAX_LEGS, parlayDec, streakBoost, american, fmtX } from './bets.js';
import { syncButtons } from './markets.js';

let host, open = false, lastCount = 0;
const fmt = (n) => Math.round(n).toLocaleString();

export function mountSlip(el) {
  host = el;
  onSlipChange(() => { syncButtons(); draw(); });
  draw();
}
export const slipHidden = (v) => { if (host) { host.hidden = !!v; draw(); } };

function draw() {
  if (!host) return;
  const { slip } = getState();
  const bank = getBank();
  const legs = slip.legs;
  if (legs.length > lastCount) open = true;
  lastCount = legs.length;
  clear(host);
  document.body.classList.toggle('slip-on', legs.length > 0 && !host.hidden);
  host.classList.toggle('empty', !legs.length);
  host.classList.toggle('open', open && legs.length > 0);
  if (!legs.length) return;

  const parlay = slip.mode === 'parlay' && legs.length >= 2;
  const boost = streakBoost(bank.streak);
  const count = parlay ? 1 : legs.length;
  const total = slip.stake * count;
  const dec = parlay ? parlayDec(legs) : null;
  const payout = parlay ? slip.stake * dec * (1 + boost) : legs.reduce((s, l) => s + slip.stake * l.dec * (1 + boost), 0);

  host.append(h('button', { type: 'button', class: 'slip-bar', id: 'slip-toggle', 'aria-expanded': open ? 'true' : 'false', onclick: () => { open = !open; draw(); } },
    h('span', { class: 'sb-n' }, String(legs.length)), h('span', { class: 'sb-t' }, 'Betslip', legs.length >= MAX_LEGS ? h('small', null, ' · full') : null),
    h('span', { class: 'sb-p' }, `${fmt(total)} → ${fmt(payout)}`), h('span', { class: 'sb-c' }, open ? '▾' : '▴')));

  // the picks scroll on their own, so the stake and the place button always stay on screen however long the parlay gets
  const body = h('div', { class: 'slip-body' });
  const scroll = h('div', { class: 'slip-scroll' });
  const foot = h('div', { class: 'slip-foot' });
  body.append(scroll, foot);
  scroll.append(h('ul', { class: 'slip-legs' }, legs.map((l) => h('li', null,
    h('div', { class: 'sl-t' }, h('div', { class: 'sl-n' }, l.label), h('small', null, `${l.away.abbr} @ ${l.home.abbr}`)),
    h('div', { class: 'sl-o' }, american(l.dec)),
    h('button', { type: 'button', class: 'x', 'aria-label': 'Remove', onclick: () => removeLeg(l.key) }, '×')))));

  foot.append(h('div', { class: 'seg' }, [['single', 'Singles'], ['parlay', 'Parlay']].map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (slip.mode === k ? ' on' : ''), id: 'slip-' + k, disabled: k === 'parlay' && legs.length < 2 ? true : null, onclick: () => setSlip({ mode: k }) }, l))));
  if (slip.mode === 'parlay' && legs.length < 2) foot.append(h('p', { class: 'muted small-note' }, 'Add a second pick to build a parlay.'));

  const input = h('input', { class: 'stake', id: 'stake', type: 'number', inputmode: 'numeric', min: MIN_STAKE, step: 5, value: String(slip.stake), 'aria-label': 'Stake in coins' });
  input.addEventListener('change', () => setSlip({ stake: Math.max(0, Math.floor(Number(input.value) || 0)) }));
  foot.append(h('label', { class: 'stake-l' }, h('span', null, parlay || legs.length === 1 ? 'Stake' : 'Stake per bet'), input),
    h('div', { class: 'chip-row' }, [10, 25, 50, 100, 250].map((n) => h('button', { type: 'button', class: 'chip', onclick: () => setSlip({ stake: n }) }, String(n))),
      h('button', { type: 'button', class: 'chip', onclick: () => setSlip({ stake: Math.max(MIN_STAKE, Math.floor(bank.coins / count)) }) }, 'Max')));

  foot.append(h('dl', { class: 'slip-sum' },
    h('dt', null, 'Total stake'), h('dd', null, fmt(total)),
    parlay ? h('dt', null, 'Parlay odds') : null, parlay ? h('dd', null, `${fmtX(dec)} (${american(dec)})`) : null,
    boost > 0 ? h('dt', null, 'Streak boost') : null, boost > 0 ? h('dd', { class: 'hot' }, `+${Math.round(boost * 100)}%`) : null,
    h('dt', null, 'To collect'), h('dd', { class: 'big' }, fmt(payout))));

  foot.append(h('div', { class: 'row' },
    h('button', { type: 'button', class: 'btn main grow', id: 'place-bet', onclick: () => {
      const r = placeSlip();
      if (!r.ok) { toast(r.error); return; }
      open = false;
      toast(r.bets.length === 1 ? `Bet placed: ${fmt(r.total)} coins on the line` : `${r.bets.length} bets placed: ${fmt(r.total)} coins on the line`);
    } }, `Place bet · ${fmt(total)}`),
    h('button', { type: 'button', class: 'btn', onclick: () => clearSlip() }, 'Clear')));
  foot.append(h('p', { class: 'muted small-note' }, `Play money only. Bankroll: ${fmt(bank.coins)} coins.`));
  host.append(body);
}
