// Your fan: customise the character, spend coins in the shop, wear what you own.
import { h, clear, toast } from '../ui.js';
import { getState, getBank, myTeams, setAvatar, onSlipChange } from '../store.js';
import { pageHead } from '../components.js';
import { levelFor, rankFor, betStats } from '../bets.js';
import { SKINS, HAIR_COLORS, SLOTS, GROUPS, ALWAYS_ON, ITEMS, TIERS, itemById, buy, equip, unequip, priceOf, dealToday, syncUnlocks, renderAvatar, avatarTeam, previewSvg } from '../avatar.js';

const fmt = (n) => Math.round(n).toLocaleString();

export async function render(root) {
  const unlocked = syncUnlocks();
  if (unlocked.length) toast(`New item unlocked: ${unlocked.map((i) => itemById(i)?.name).join(', ')}`);
  let group = 'head';
  let only = false;
  const host = h('div', { class: 'profile' });
  root.append(pageHead('Your fan', 'Dress your character with coins you win. Looks only. Nothing here changes your odds.'), host);

  function draw() {
    const state = getState(), av = state.avatar, bank = getBank();
    const team = avatarTeam(av);
    const lvl = levelFor(bank.xp);
    const st = betStats(state.bets, bank);
    const deal = dealToday();
    clear(host);

    // left: character
    const teams = myTeams();
    const left = h('section', { class: 'card pf-me' },
      h('div', { class: 'pf-stage', style: team ? { '--stage': team.color ? '#' + String(team.color).replace('#', '') : null } : null }, renderAvatar(av, team, 'lg')),
      h('div', { class: 'pf-name' }, h('b', null, `Level ${lvl} · ${rankFor(lvl)}`), h('small', null, `${st.won}-${st.lost} record · best streak ${st.bestStreak}`)),
      h('div', { class: 'pf-coins' }, h('i', { class: 'coin' }), fmt(bank.coins), h('small', null, 'coins')),
      h('div', { class: 'pf-row' }, h('small', null, 'Skin'), h('div', { class: 'swatches' }, SKINS.map((c, i) => h('button', { type: 'button', class: 'sw' + (av.skin === i ? ' on' : ''), style: { background: c }, 'aria-label': `Skin ${i + 1}`, onclick: () => { setAvatar((a) => { a.skin = i; }); draw(); } })))),
      h('div', { class: 'pf-row' }, h('small', null, 'Hair colour'), h('div', { class: 'swatches' }, HAIR_COLORS.map((c, i) => h('button', { type: 'button', class: 'sw' + (av.hairColor === i ? ' on' : ''), style: { background: c }, 'aria-label': `Hair colour ${i + 1}`, onclick: () => { setAvatar((a) => { a.hairColor = i; }); draw(); } })))),
      teams.length ? h('div', { class: 'pf-row' }, h('small', null, 'Team colours'),
        h('select', { id: 'pf-team', onchange: (e) => { setAvatar((a) => { a.team = e.target.value; }); draw(); } },
          teams.map((t) => h('option', { value: `${t.league}:${t.id}`, selected: team && t.league === team.league && t.id === team.id ? '' : null }, t.name)))) : h('small', { class: 'pf-hint' }, 'Follow a team in Settings and your jersey and gear turn into its colours.'),
      h('div', { class: 'pf-worn' }, SLOTS.map((s) => { const id = av.eq[s.id]; const it = id && itemById(id); return it ? h('span', { class: 'chip' }, it.name) : null; })));

    // right: shop
    const tabs = h('div', { class: 'seg pf-tabs', role: 'tablist' }, GROUPS.map((g) => h('button', { type: 'button', role: 'tab', class: 'seg-b' + (group === g.id ? ' on' : ''), 'aria-selected': group === g.id ? 'true' : 'false', onclick: () => { group = g.id; draw(); } }, g.label)));
    const slots = GROUPS.find((g) => g.id === group).slots;
    const items = ITEMS.filter((i) => slots.includes(i.slot) && (!only || av.owned.includes(i.id))).sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
    const grid = h('div', { class: 'shop-grid' }, items.map((it) => itemCard(it, av, bank, team, deal)));
    if (!items.length) grid.append(h('p', { class: 'muted' }, 'You do not own anything here yet.'));
    const right = h('section', { class: 'card pf-shop' },
      h('div', { class: 'pf-shop-h' }, h('h2', { class: 'card-h' }, 'Shop'),
        h('label', { class: 'pf-only' }, h('input', { type: 'checkbox', id: 'pf-owned', checked: only ? '' : null, onchange: (e) => { only = e.target.checked; draw(); } }), ' Owned only')),
      deal ? h('div', { class: 'deal' }, h('b', null, 'Today only'), ` ${deal.name} is 20% off (${fmt(priceOf(deal))} coins). Find it under ${GROUPS.find((g) => g.slots.includes(deal.slot)).label}.`) : null,
      tabs, grid);

    host.append(left, right);

    host.append(h('section', { class: 'card pf-wide' }, h('h2', { class: 'card-h' }, 'Earned items'),
      h('p', { class: 'muted' }, 'These cannot be bought. Do the thing and they unlock.'),
      h('div', { class: 'shop-grid' }, ITEMS.filter((i) => i.ach).map((it) => itemCard(it, av, bank, team, deal)))));
  }

  function itemCard(it, av, bank, team, deal) {
    const owned = av.owned.includes(it.id);
    const worn = av.eq[it.slot] === it.id;
    const price = priceOf(it);
    const sale = deal && deal.id === it.id;
    const svg = document.createElement('span');
    svg.className = 'avatar pv'; svg.innerHTML = previewSvg(it, av, team);
    let act;
    if (worn) act = ALWAYS_ON.includes(it.slot) ? h('span', { class: 'pill won' }, 'Wearing') : h('button', { type: 'button', class: 'btn small take', onclick: () => { unequip(it.slot); draw(); } }, 'Take off');
    else if (owned) act = h('button', { type: 'button', class: 'btn small wear', onclick: () => { equip(it.id); draw(); } }, 'Wear');
    else if (it.ach) act = h('small', null, it.ach);
    else act = h('button', { type: 'button', class: 'btn small main buy', 'data-id': it.id, disabled: bank.coins < price ? '' : null, onclick: () => {
      const r = buy(it.id);
      if (r.ok) toast(`Bought ${it.name}`); else toast(r.why === 'coins' ? 'Not enough coins yet' : 'Cannot buy that');
      draw();
    } }, h('i', { class: 'coin' }), sale ? h('s', null, fmt(it.price)) : null, ' ' + fmt(price));
    return h('article', { class: `item t-${it.tier}` + (worn ? ' worn' : '') + (owned ? ' owned' : ''), 'data-item': it.id },
      svg,
      h('div', { class: 'it-n' }, it.name),
      h('small', { class: 'it-t' }, `${TIERS[it.tier].label} · ${SLOTS.find((s) => s.id === it.slot).label}${it.team ? ' · team colours' : ''}`),
      act);
  }

  draw();
  const stop = onSlipChange(() => {});
  return () => stop && stop();
}
