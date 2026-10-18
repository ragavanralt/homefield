// Settings: display options, your teams, backup and reset.
import { h, clear, crest, toast, downloadText } from '../ui.js';
import { getState, setSetting, unfollow, myTeams, exportData, importData, resetAll } from '../store.js';
import { leagueLabel } from '../leagues.js';
import { pageHead } from '../components.js';

export async function render(root) {
  root.append(pageHead('Settings'));
  const host = h('div', { class: 'stack' });
  root.append(host);

  function toggle(id, label, sub, key) {
    return h('label', { class: 'toggle', for: id },
      h('div', null, h('div', { class: 'tg-l' }, label), h('small', null, sub)),
      h('input', { type: 'checkbox', id, checked: !!getState().settings[key], onchange: (e) => { setSetting(key, e.target.checked); toast(e.target.checked ? 'Turned on' : 'Turned off'); } }));
  }

  function draw() {
    clear(host);
    host.append(
      h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Display'),
        toggle('set-logos', 'Team logos and player photos', 'Loaded from the data feed. If off, you get colour badges and initials.', 'logos'),
        toggle('set-spoil', 'Spoiler-free mode', 'Hides scores and plays until you tap to reveal a game.', 'spoilerFree')),
    );

    const teams = myTeams();
    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Your teams'),
      teams.length ? h('ul', { class: 'team-list' }, teams.map((t) => h('li', null, crest(t, 32), h('a', { href: `#/team/${t.league}/${t.id}` }, t.name), h('small', null, leagueLabel(t.league)),
        h('button', { type: 'button', class: 'btn small', onclick: () => { unfollow(t.league, t.id); draw(); } }, 'Remove')))) : h('p', { class: 'muted' }, 'No teams yet.'),
      h('a', { class: 'btn main', href: '#/onboarding' }, 'Add or change teams')));

    const file = h('input', { type: 'file', id: 'import-file', accept: 'application/json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { importData(await f.text()); toast('Data restored'); draw(); } catch (err) { toast(err.message); }
    } });
    let armed = false;
    const resetBtn = h('button', { type: 'button', class: 'btn danger', id: 'reset-btn', onclick: () => {
      if (!armed) { armed = true; resetBtn.textContent = 'Tap again to erase everything'; setTimeout(() => { armed = false; resetBtn.textContent = 'Erase all data'; }, 4000); return; }
      resetAll(); toast('Everything erased'); location.hash = '#/onboarding';
    } }, 'Erase all data');
    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Your data'),
      h('p', { class: 'muted' }, 'Teams, picks and watched games live only on this device. Back them up if you switch phones.'),
      h('div', { class: 'row wrap' },
        h('button', { type: 'button', class: 'btn', onclick: () => downloadText('homefield-backup.json', exportData(), 'application/json') }, 'Download backup'),
        h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, 'Restore backup'),
        file, resetBtn)));

    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'About'),
      h('p', null, 'Scores, lineups, box scores and plays come from ESPN\'s public data feed. Logos and photos belong to their owners. Homefield is a personal project and is not affiliated with any league or team.'),
      h('a', { class: 'btn', href: '#/check' }, 'Run data check')));
  }
  draw();
}
