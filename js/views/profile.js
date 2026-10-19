// Your fan: customise the character, spend coins in the shop, wear what you own.
import { h, clear, toast } from '../ui.js';
import { getState, getBank, myTeams, setAvatar, onSlipChange, track } from '../store.js';
import { ensureLive } from '../live.js';
import { pageHead } from '../components.js';
import { levelFor, rankFor, betStats } from '../bets.js';
import { SKINS, HAIR_COLORS, BODIES, SLOTS, SECTIONS, ALWAYS_ON, ITEMS, TIERS, itemById, buy, equip, unequip, priceOf, dealToday, dealInfo, syncUnlocks, renderAvatar, avatarTeam, previewSvg, setColour, colourIndex } from '../avatar.js';

const fmt = (n) => Math.round(n).toLocaleString();

// Two pages share this file: #/profile (your character and closet) and #/shop (buying).
export async function render(root, params = {}) {
  const shop = params.mode === 'shop';
  const live = await ensureLive();
  if (shop) track('shop_visits', 1, 'v');
  const unlocked = syncUnlocks();
  if (unlocked.length) toast(`New item unlocked: ${unlocked.map((i) => itemById(i)?.name).join(', ')}`);
  let sec = 'team';
  let only = false;
  let picking = null; // item id whose colour menu is open
  let confirming = null, confirmCi = 0; // item waiting for a confirmed buy, and the colour being tried
  const host = h('div', { class: 'profile' });
  root.append(shop ? pageHead('Shop', 'Spend the coins you win on clothes and gear. Looks only. Nothing here changes your odds.') : pageHead('Your fan', 'Your character and everything you own. Changing your look is free.'), host);
  host.classList.toggle('is-shop', shop);

  function draw() {
    const state = getState(), av = state.avatar, bank = getBank();
    const team = avatarTeam(av);
    const lvl = levelFor(bank.xp);
    const st = betStats(state.bets, bank);
    const deal = dealToday();
    clear(host);

    // left: character
    const teams = myTeams();
    const stage = h('div', { class: 'pf-stage', style: team ? { '--stage': team.color ? '#' + String(team.color).replace('#', '') : null } : null }, renderAvatar(av, team, 'lg'));
    const coins = h('div', { class: 'pf-coins' }, h('i', { class: 'coin' }), fmt(bank.coins), h('small', null, 'coins'));
    const left = shop
      ? h('section', { class: 'card pf-me pf-mini' }, stage, coins, h('a', { class: 'btn', href: '#/profile' }, 'Change your look'))
      : h('section', { class: 'card pf-me' }, stage,
      h('div', { class: 'pf-name' }, h('b', null, `Level ${lvl} · ${rankFor(lvl)}`), h('small', null, `${st.won}-${st.lost} record · best streak ${st.bestStreak}`)),
      coins,
      h('div', { class: 'pf-row' }, h('small', null, 'Body type (free)'), h('div', { class: 'seg pf-body' }, BODIES.map((b, i) => h('button', { type: 'button', class: 'seg-b' + ((av.body ?? 1) === i ? ' on' : ''), 'data-body': b.id, onclick: () => { setAvatar((a) => { a.body = i; }); draw(); } }, b.label)))),
      h('div', { class: 'pf-row' }, h('small', null, 'Skin'), h('div', { class: 'swatches' }, SKINS.map((c, i) => h('button', { type: 'button', class: 'sw' + (av.skin === i ? ' on' : ''), style: { background: c }, 'aria-label': `Skin ${i + 1}`, onclick: () => { setAvatar((a) => { a.skin = i; }); draw(); } })))),
      h('div', { class: 'pf-row' }, h('small', null, 'Hair colour'), h('div', { class: 'swatches' }, HAIR_COLORS.map((c, i) => h('button', { type: 'button', class: 'sw' + (av.hairColor === i ? ' on' : ''), style: { background: c }, 'aria-label': `Hair colour ${i + 1}`, onclick: () => { setAvatar((a) => { a.hairColor = i; }); draw(); } })))),
      teams.length ? h('div', { class: 'pf-row' }, h('small', null, 'Team colours'),
        h('select', { id: 'pf-team', onchange: (e) => { setAvatar((a) => { a.team = e.target.value; }); draw(); } },
          teams.map((t) => h('option', { value: `${t.league}:${t.id}`, selected: team && t.league === team.league && t.id === team.id ? '' : null }, t.name)))) : h('small', { class: 'pf-hint' }, 'Follow a team in Settings and your jersey and gear turn into its colours.'),
      h('div', { class: 'pf-worn' }, SLOTS.map((s) => { const id = av.eq[s.id]; const it = id && itemById(id); return it ? h('span', { class: 'chip' }, it.name) : null; })));

    // right: shop
    const tabs = h('div', { class: 'seg pf-tabs', role: 'tablist' }, SECTIONS.map((s) => h('button', { type: 'button', role: 'tab', class: 'seg-b' + (sec === s.id ? ' on' : ''), 'aria-selected': sec === s.id ? 'true' : 'false', onclick: () => { sec = s.id; draw(); } }, s.label)));
    const cur = SECTIONS.find((s) => s.id === sec);
    const items = shop ? ITEMS.filter((i) => i.sec === sec && !i.ach && (!only || av.owned.includes(i.id))) : ITEMS.filter((i) => av.owned.includes(i.id));
    const body = h('div', { class: 'shop-body' });
    for (const s of SLOTS) {
      const list = items.filter((i) => i.slot === s.id).sort((a, b) => a.price - b.price);
      if (!list.length) continue;
      body.append(h('h3', { class: 'shop-slot' }, s.label, h('small', null, String(list.length))), h('div', { class: 'shop-grid' }, list.map((it) => itemCard(it, av, bank, team, deal))));
    }
    if (!items.length) body.append(h('p', { class: 'muted' }, shop ? 'You do not own anything here yet.' : 'Nothing yet.'));
    const dealSec = deal && SECTIONS.find((s) => s.id === deal.sec);
    const featured = (live.weekly.featured || []).map(itemById).filter(Boolean);
    const right = !shop ? h('section', { class: 'card pf-shop pf-closet' },
      h('div', { class: 'pf-shop-h' }, h('h2', { class: 'card-h' }, 'Your closet', h('small', null, `${av.owned.length} items`)), h('a', { class: 'btn main', href: '#/shop' }, 'Go to the shop')),
      h('p', { class: 'muted pf-blurb' }, 'Tap Wear to put something on. The dots switch colours.'), body)
      : h('section', { class: 'card pf-shop' },
      h('div', { class: 'pf-shop-h' }, h('h2', { class: 'card-h' }, 'Shop'),
        h('label', { class: 'pf-only' }, h('input', { type: 'checkbox', id: 'pf-owned', checked: only ? '' : null, onchange: (e) => { only = e.target.checked; draw(); } }), ' Owned only')),
      deal ? h('div', { class: 'deal' }, h('i', null, 'Today only:'), ` ${deal.name} is ${dealInfo().pct}% off (${fmt(priceOf(deal))} coins, normally ${fmt(deal.price)}). It is in ${dealSec ? dealSec.label : 'the shop'}.`) : null,
      featured.length ? h('div', { class: 'featured' }, h('h3', { class: 'shop-slot' }, 'Featured this week', h('small', null, 'changes every Friday')), h('div', { class: 'shop-grid' }, featured.map((it) => itemCard(it, av, bank, team, deal)))) : null,
      tabs, h('p', { class: 'muted pf-blurb' }, cur.blurb), body);

    host.append(left, right);
    if (picking) host.append(colourSheet(itemById(picking), av, team));
    if (confirming) host.append(buySheet(itemById(confirming), av, bank, team));

    if (!shop) host.append(h('section', { class: 'card pf-wide' }, h('h2', { class: 'card-h' }, 'Earned items'),
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
    else act = h('button', { type: 'button', class: 'btn small main buy' + (bank.coins < price ? ' short' : ''), 'data-id': it.id, onclick: () => { confirming = it.id; confirmCi = 0; draw(); } }, h('i', { class: 'coin' }), sale ? h('s', null, fmt(it.price)) : null, ' ' + fmt(price));
    return h('article', { class: `item t-${it.tier}` + (worn ? ' worn' : '') + (owned ? ' owned' : ''), 'data-item': it.id },
      svg,
      h('div', { class: 'it-n' }, it.name),
      h('small', { class: 'it-t' }, TIERS[it.tier].label),
      it.colors ? colourDots(it, av, owned) : null,
      act);
  }

  // Small swatches on the card. Owned items switch colour right there; the + opens the full menu.
  function colourDots(it, av, owned) {
    const cur = colourIndex(av, it.id);
    const shown = it.colors.slice(0, 5);
    return h('div', { class: 'it-cols' + (owned ? ' can' : '') },
      shown.map((col, i) => owned
        ? h('button', { type: 'button', class: 'dot' + (i === cur ? ' on' : ''), style: { background: col.k }, title: col.n, 'aria-label': `${it.name} in ${col.n}`, onclick: () => { setColour(it.id, i); draw(); } })
        : h('i', { class: 'dot', style: { background: col.k }, title: col.n })),
      owned ? h('button', { type: 'button', class: 'dot more', 'aria-label': `All colours for ${it.name}`, onclick: () => { picking = it.id; draw(); } }, '+')
        : h('small', null, `${it.colors.length} colours`));
  }

  // Tapping a price only opens this. Nothing is bought until you press the buy button here.
  function buySheet(it, av, bank, team) {
    const price = priceOf(it);
    const after = bank.coins - price;
    const close = () => { confirming = null; draw(); };
    const pv = document.createElement('span');
    pv.className = 'avatar cs-pv'; pv.innerHTML = previewSvg(it, av, team, it.colors ? confirmCi : null);
    const yes = () => {
      const r = buy(it.id);
      if (r.ok) { if (it.colors && confirmCi) setColour(it.id, confirmCi); toast(`Bought ${it.name}${it.colors ? ' in ' + it.colors[confirmCi].n.toLowerCase() : ''}`); }
      else toast(r.why === 'coins' ? 'Not enough coins yet' : 'Cannot buy that');
      confirming = null; draw();
    };
    return h('div', { class: 'cs-back', onclick: (e) => { if (e.target === e.currentTarget) close(); } },
      h('div', { class: 'cs-panel', role: 'dialog', 'aria-label': `Buy ${it.name}` },
        h('div', { class: 'cs-h' }, h('div', null, h('small', null, 'Try it on'), h('div', { class: 'cs-n' }, it.name)), h('button', { type: 'button', class: 'btn small', id: 'buy-cancel', onclick: close }, 'Cancel')),
        pv,
        it.colors ? h('div', { class: 'cs-grid' }, it.colors.map((col, i) => h('button', { type: 'button', class: 'cs-sw' + (i === confirmCi ? ' on' : ''), 'data-ci': i, onclick: () => { confirmCi = i; draw(); } },
          h('i', { style: { background: col.k } }), h('small', null, col.n)))) : null,
        h('div', { class: 'buy-sum' },
          h('div', null, h('small', null, 'Price'), h('div', null, h('i', { class: 'coin' }), fmt(price))),
          h('div', null, h('small', null, 'You have'), h('div', null, fmt(bank.coins))),
          h('div', null, h('small', null, 'After'), h('div', { class: after < 0 ? 'neg' : '' }, after < 0 ? `${fmt(-after)} short` : fmt(after)))),
        it.colors ? h('small', { class: 'muted' }, 'All colours come with it. This just picks the one you start in.') : null,
        h('button', { type: 'button', class: 'btn main big', id: 'confirm-buy', disabled: after < 0 ? '' : null, onclick: yes }, after < 0 ? 'Not enough coins' : `Buy for ${fmt(price)} coins`)));
  }

  // The colour menu: opens after you buy something that comes in colours, or from the + on a card.
  function colourSheet(it, av, team) {
    const cur = colourIndex(av, it.id);
    const close = () => { picking = null; draw(); };
    const pv = document.createElement('span');
    pv.className = 'avatar cs-pv'; pv.innerHTML = previewSvg(it, av, team, cur);
    return h('div', { class: 'cs-back', onclick: (e) => { if (e.target === e.currentTarget) close(); } },
      h('div', { class: 'cs-panel', role: 'dialog', 'aria-label': `Colours for ${it.name}` },
        h('div', { class: 'cs-h' }, h('div', null, h('small', null, 'Pick a colour'), h('div', { class: 'cs-n' }, it.name)), h('button', { type: 'button', class: 'btn small', id: 'cs-done', onclick: close }, 'Done')),
        pv,
        h('div', { class: 'cs-grid' }, it.colors.map((col, i) => h('button', { type: 'button', class: 'cs-sw' + (i === cur ? ' on' : ''), 'data-ci': i, onclick: () => { setColour(it.id, i); draw(); } },
          h('i', { style: { background: col.k } }), h('small', null, col.n)))),
        h('small', { class: 'muted' }, 'Every colour is included. Switch any time.')));
  }

  draw();
  const stop = onSlipChange(() => {});
  return () => stop && stop();
}
