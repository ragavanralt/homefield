// Settings: appearance, display options, your teams, backup and resets.
import { h, clear, crest, toast, downloadText } from '../ui.js';
import { getState, setSetting, unfollow, myTeams, exportData, importData, resetAll, resetBets, resetTeams } from '../store.js';
import { leagueLabel } from '../leagues.js';
import { pageHead, hideChips, appearanceCard } from '../components.js';
import { applyTheme } from '../themes.js';
import { testKey } from '../odds.js';

export async function render(root) {
  root.append(pageHead('Settings'));
  const host = h('div', { class: 'settings-grid' });
  root.append(host);

  const repaintTheme = () => applyTheme(getState().settings);

  function toggle(id, label, sub, key) {
    return h('label', { class: 'toggle', for: id },
      h('div', null, h('div', { class: 'tg-l' }, label), h('small', null, sub)),
      h('input', { type: 'checkbox', id, checked: !!getState().settings[key], onchange: (e) => { setSetting(key, e.target.checked); toast(e.target.checked ? 'Turned on' : 'Turned off'); } }));
  }

  /** A button that needs a second tap to confirm. */
  function confirmBtn(id, title, sub, doIt, cls = 'btn danger') {
    let armed = false, timer;
    const b = h('button', { type: 'button', class: cls, id }, h('b', null, title), h('small', null, sub));
    b.addEventListener('click', () => {
      if (!armed) {
        armed = true; clear(b).append(h('b', null, 'Tap again to confirm'), h('small', null, title));
        timer = setTimeout(() => { armed = false; clear(b).append(h('b', null, title), h('small', null, sub)); }, 4000);
        return;
      }
      clearTimeout(timer); armed = false; doIt();
    });
    return b;
  }

  function draw() {
    clear(host);
    host.append(appearanceCard());
    host.append(
      h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Display'),
        toggle('set-logos', 'Team logos and player photos', 'Loaded from the data feed. If off, you get colour badges and initials.', 'logos'),
        toggle('set-spoil', 'Spoiler-free mode', 'Hides scores and plays until you tap to reveal a game.', 'spoilerFree')),
    );

    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Hide leagues'),
      h('p', { class: 'muted' }, 'A hidden league stops showing in Home, scores and Pick\'em. It keeps its own tab.'), hideChips()));

    const keyIn = h('input', { class: 'search', type: 'password', id: 'odds-key', placeholder: 'Paste your Odds API key', autocomplete: 'off', value: getState().settings.oddsKey || '' });
    const keyMsg = h('p', { class: 'muted small-note', id: 'odds-msg' }, getState().settings.oddsKey ? 'A key is saved on this device.' : 'No key yet. Pick\'em uses simulated lines.');
    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Live sportsbook lines (optional)'),
      h('p', { class: 'muted' }, 'Gets real DraftKings and FanDuel player props for NFL, NBA, NHL and MLB through The Odds API. Make a free key at the-odds-api.com (500 credits a month, about 3 to 5 credits per game you open). The key stays on this device.'),
      keyIn, keyMsg,
      h('div', { class: 'row wrap' },
        h('button', { type: 'button', class: 'btn main', id: 'odds-save', onclick: async () => {
          setSetting('oddsKey', keyIn.value.trim());
          if (!keyIn.value.trim()) { keyMsg.textContent = 'Key removed. Using simulated lines.'; return; }
          keyMsg.textContent = 'Testing…';
          try { const r = await testKey(); keyMsg.textContent = `Key works.${r.remaining != null ? ' ' + r.remaining + ' credits left this month.' : ''}`; } catch (e) { keyMsg.textContent = 'Saved, but the test failed: ' + e.message; }
        } }, 'Save and test'),
        h('button', { type: 'button', class: 'btn', onclick: () => { keyIn.value = ''; setSetting('oddsKey', ''); keyMsg.textContent = 'Key removed. Using simulated lines.'; } }, 'Remove key'))));

    const teams = myTeams();
    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Your teams'),
      teams.length ? h('ul', { class: 'team-list' }, teams.map((t) => h('li', null, crest(t, 32), h('a', { href: `#/team/${t.league}/${t.id}` }, t.name), h('small', null, leagueLabel(t.league)),
        h('button', { type: 'button', class: 'btn small', onclick: () => { unfollow(t.league, t.id); draw(); } }, 'Remove')))) : h('p', { class: 'muted' }, 'No teams yet.'),
      h('a', { class: 'btn main', href: '#/onboarding' }, 'Add or change teams')));

    const file = h('input', { type: 'file', id: 'import-file', accept: 'application/json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { importData(await f.text()); repaintTheme(); toast('Data restored'); draw(); } catch (err) { toast(err.message); }
    } });
    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Your data'),
      h('p', { class: 'muted' }, 'Everything lives only on this device. Back it up if you switch phones.'),
      h('div', { class: 'row wrap' },
        h('button', { type: 'button', class: 'btn', onclick: () => downloadText('homefield-backup.json', exportData(), 'application/json') }, 'Download backup'),
        h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, 'Restore backup'), file)));

    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Reset'),
      h('p', { class: 'muted' }, 'Each button asks you to tap twice so nothing gets wiped by accident.'),
      h('div', { class: 'reset-grid' },
        confirmBtn('reset-bets', 'Reset bets and bankroll', 'Back to 1,000 coins, clears all bets, streaks and XP', () => { resetBets(); toast('Bankroll reset to 1,000 coins'); draw(); }),
        confirmBtn('reset-teams', 'Reset followed teams', 'Unfollow everyone and start over', () => { resetTeams(); toast('Teams cleared'); location.hash = '#/onboarding'; }),
        confirmBtn('reset-btn', 'Erase everything', 'Teams, bets, watched games and settings', () => { resetAll(); repaintTheme(); toast('Everything erased'); location.hash = '#/onboarding'; }))));

    host.append(h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'About'),
      h('p', null, 'Scores, lineups, box scores and plays come from ESPN\'s public data feed. Logos and photos belong to their owners. Homefield is a personal project and is not affiliated with any league or team.'),
      h('a', { class: 'btn', href: '#/check' }, 'Run data check')));
  }
  draw();
}
