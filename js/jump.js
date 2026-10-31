// "Find anything": one button in the header that opens a list of every place in the app.
// Type a word (shop, standings, bulls) or just tap. It works from every screen, and "/" opens it on a keyboard.
import { h, clear } from './ui.js';
import { myTeams } from './store.js';
import { TABS } from './leagues.js';
import { enabled as socialOn } from './social.js';

const SEC = { home: 'Home', sports: 'Sports', bets: 'Bets', crew: 'Crew', you: 'You' };

/** Every destination, with the words people might type for it. Exported so tests can check nothing is missing. */
export function destinations() {
  const out = [
    { id: 'home', sec: 'home', label: 'Home', hint: 'Your teams and everything live', href: '#/', words: 'start my teams live games today' },
    ...TABS.map((t) => ({ id: 'lg-' + t.id, sec: 'sports', label: t.label, hint: 'Scores, standings and schedule', href: `#/league/${t.id}`, words: `${t.id} scores standings schedule table league` })),
    { id: 'picks', sec: 'bets', label: "Pick'em", hint: 'Build a slip and bet coins', href: '#/picks', words: 'bet slip parlay odds picks wager' },
    { id: 'mypicks', sec: 'bets', label: 'Live picks', hint: 'What is riding right now', href: '#/mypicks', words: 'open tickets my bets live cash out' },
    { id: 'quests', sec: 'you', label: 'Quests', hint: 'Daily and weekly coins', href: '#/quests', words: 'daily weekly missions claim rewards coins streak' },
    { id: 'shop', sec: 'you', label: 'Shop', hint: 'Clothes, kits and gear', href: '#/shop', words: 'store buy items clothes jerseys shoes hats drip coins' },
    { id: 'fan', sec: 'you', label: 'Your fan', hint: 'Dress your character, home or away kit', href: '#/profile', words: 'avatar outfit closet look body skin hair kit home away' },
    { id: 'you', sec: 'you', label: 'Your page', hint: 'Record, history, trophies', href: '#/you', words: 'profile stats history trophies record teams level' },
    { id: 'coins', sec: 'you', label: 'Coin log', hint: 'Where every coin came from', href: '#/coins', words: 'balance history ledger spent earned' },
    { id: 'settings', sec: 'you', label: 'Settings', hint: 'Teams, theme, spoilers, sync', href: '#/settings', words: 'preferences theme dark light spoiler free teams follow notifications account' },
  ];
  if (socialOn()) out.push(
    { id: 'daily', sec: 'bets', label: 'Daily 5', hint: 'Five picks a day, same for everyone', href: '#/daily', words: 'daily five challenge' },
    { id: 'crew', sec: 'crew', label: 'Crew', hint: 'Your friends and the leaderboard', href: '#/crew', words: 'friends leaderboard invite group' },
    { id: 'duels', sec: 'crew', label: 'Duels', hint: 'Head to head with a friend', href: '#/duels', words: 'versus challenge friend 1v1' },
    { id: 'survivor', sec: 'crew', label: 'Survivor', hint: 'Pick one team a week, stay alive', href: '#/survivor', words: 'pool eliminator' },
    { id: 'cap', sec: 'crew', label: 'Cap Night', hint: 'A night of picks with the crew', href: '#/cap', words: 'capnight party' });
  for (const t of myTeams()) out.push({ id: `tm-${t.league}-${t.id}`, sec: 'home', label: t.name, hint: 'Team page', href: `#/team/${encodeURIComponent(t.league)}/${encodeURIComponent(t.id)}`, words: `${t.abbr || ''} ${t.short || ''} team` });
  return out;
}

export const filterDestinations = (list, q) => {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((d) => { const hay = `${d.label} ${d.hint} ${d.words} ${SEC[d.sec]}`.toLowerCase(); return terms.every((t) => hay.includes(t)); });
};

let open = null;
export function closeJump() { if (open) { open.remove(); open = null; document.body.classList.remove('jump-open'); } }
export function openJump() {
  if (open) return;
  const all = destinations();
  const list = h('div', { class: 'jump-list', role: 'listbox' });
  const input = h('input', { class: 'jump-in', type: 'search', placeholder: 'Find a page, team or league', 'aria-label': 'Find a page, team or league', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const draw = () => {
    clear(list);
    const hits = filterDestinations(all, input.value);
    if (!hits.length) { list.append(h('p', { class: 'jump-none' }, 'Nothing like that here yet. Try "shop", "quests" or a team name.')); return; }
    let last = '';
    hits.forEach((d) => {
      if (d.sec !== last) { last = d.sec; list.append(h('h3', { class: 'jump-h', 'data-sec': d.sec }, SEC[d.sec])); }
      list.append(h('a', { class: 'jump-i', href: d.href, 'data-sec': d.sec, role: 'option', onclick: () => closeJump() }, h('b', null, d.label), h('small', null, d.hint)));
    });
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = list.querySelector('.jump-i'); if (a) { location.hash = a.getAttribute('href'); closeJump(); } } });
  open = h('div', { class: 'jump-back', onclick: (e) => { if (e.target === e.currentTarget) closeJump(); } },
    h('div', { class: 'jump-panel', role: 'dialog', 'aria-label': 'Find anything' },
      h('div', { class: 'jump-top' }, input, h('button', { type: 'button', class: 'btn small', id: 'jump-close', onclick: closeJump }, 'Close')),
      list));
  document.body.append(open); document.body.classList.add('jump-open');
  draw(); setTimeout(() => input.focus(), 30);
}
export function bindJump() {
  const btn = document.getElementById('find');
  if (btn) btn.addEventListener('click', openJump);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeJump();
    else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); openJump(); }
  });
  window.addEventListener('hashchange', closeJump);
}
