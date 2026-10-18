// First-run screen: choose leagues, then tap the teams you follow.
import { h, clear, crest, loading, errorBox, applySkin } from '../ui.js';
import { LEAGUES, MAJOR_KEYS, SOCCER_KEYS } from '../leagues.js';
import { getTeams } from '../espn.js';
import { follow, unfollow, isFollowing, setOnboarded, myTeams } from '../store.js';

export async function render(root) {
  const open = new Set(myTeams().length ? myTeams().map((t) => t.league) : MAJOR_KEYS);
  const sections = new Map();

  const count = h('span', null, '0');
  const doneBtn = h('button', { class: 'btn main big', type: 'button', onclick: () => { setOnboarded(true); location.hash = '#/'; } }, 'Done');
  const updateCount = () => {
    const n = myTeams().length;
    clear(doneBtn).append(n ? `Done · ${n} team${n === 1 ? '' : 's'}` : 'Skip for now');
  };

  root.append(
    h('div', { class: 'ob-hero' },
      h('p', { class: 'eyebrow' }, 'Welcome'),
      h('h1', null, 'Pick your teams'),
      h('p', null, 'Choose your leagues, then tap every team you follow. Each team gets its own colours. You can change this any time in Settings.'),
    ),
  );

  const chipHost = h('div', { class: 'chip-grid' });
  const sectionsHost = h('div', { class: 'stack' });

  function chip(key) {
    const on = open.has(key);
    return h('button', {
      type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', id: 'lg-' + key.replace('.', '-'),
      onclick: () => { if (open.has(key)) { open.delete(key); removeSection(key); } else { open.add(key); addSection(key); } drawChips(); },
    }, LEAGUES[key].label);
  }
  function drawChips() {
    clear(chipHost);
    chipHost.append(
      h('div', { class: 'chip-row' }, h('span', { class: 'chip-label' }, 'Major leagues'), MAJOR_KEYS.map(chip)),
      h('div', { class: 'chip-row' }, h('span', { class: 'chip-label' }, 'Soccer'), SOCCER_KEYS.map(chip)),
    );
  }

  function removeSection(key) { const s = sections.get(key); if (s) { s.remove(); sections.delete(key); } }

  async function addSection(key) {
    const sec = h('section', { class: 'ob-sec' });
    const grid = h('div', { class: 'tile-grid' }, loading('Loading teams'));
    const search = h('input', { class: 'search', type: 'search', placeholder: `Search ${LEAGUES[key].label} teams`, id: 'search-' + key.replace('.', '-'), 'aria-label': 'Search teams' });
    sec.append(h('div', { class: 'ob-sec-head' }, h('h2', null, LEAGUES[key].label), search), grid);
    sections.set(key, sec);
    // keep sections in the same order as the chips
    sectionsHost.append(sec);
    try {
      const teams = await getTeams(key);
      clear(grid);
      const tiles = teams.map((t) => {
        const tile = h('button', { type: 'button', class: 'tile', 'data-name': (t.name + ' ' + t.abbr).toLowerCase(), 'aria-pressed': isFollowing(key, t.id) ? 'true' : 'false' },
          crest(t, 44), h('span', { class: 'tl-n' }, t.name));
        applySkin(tile, t.color, t.alt);
        tile.addEventListener('click', () => {
          if (isFollowing(key, t.id)) { unfollow(key, t.id); tile.setAttribute('aria-pressed', 'false'); }
          else { follow(t); tile.setAttribute('aria-pressed', 'true'); }
          updateCount();
        });
        return tile;
      });
      if (!tiles.length) grid.append(h('p', { class: 'muted' }, 'No teams came back for this league right now.'));
      grid.append(...tiles);
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        tiles.forEach((tl) => { tl.hidden = q && !tl.getAttribute('data-name').includes(q); });
      });
    } catch (e) {
      clear(grid).append(errorBox(e, () => { removeSection(key); addSection(key); }));
    }
  }

  drawChips();
  root.append(
    h('h2', { class: 'step' }, '1. Leagues'), chipHost,
    h('h2', { class: 'step' }, '2. Teams'),
    sectionsHost,
    h('div', { class: 'ob-bar' }, doneBtn),
  );
  updateCount();
  for (const key of open) addSection(key);
  if (!open.size) sectionsHost.append(h('p', { class: 'muted' }, 'Pick a league above and its teams show up here.'));
  // clear the hint once a section appears
  const mo = new MutationObserver(() => { const hint = sectionsHost.querySelector(':scope > p.muted'); if (hint && sectionsHost.querySelector('.ob-sec')) hint.remove(); });
  mo.observe(sectionsHost, { childList: true });
  return () => mo.disconnect();
}
