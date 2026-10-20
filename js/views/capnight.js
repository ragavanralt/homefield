// Cap Night (NBA): build a five-player lineup under the salary cap. Best fantasy night wins the prize.
import { h, clear, toast, poll } from '../ui.js';
import * as soc from '../social.js';
import { face } from '../ui.js';
import { gate, claimBar, fmt, dayTime, loader, errText } from '../social-ui.js';

export async function render(root) {
  if (!gate(root, 'Cap Night', 'NBA only. Five players, 2 per team at most, stay under the cap. Highest fantasy score wins.')) return;
  const host = h('div', { class: 'cap' });
  root.append(claimBar(() => run(true)), host);
  let day = null;
  let picks = null; // working lineup, null until loaded
  let dirty = false;
  const run = loader(host, () => soc.cap(day), (d) => {
    day = d.day;
    if (!dirty || !picks) picks = d.mine.slice();
    draw(d);
  });

  function draw(d) {
    const byId = new Map(d.players.map((p) => [p.id, p]));
    const chosen = picks.map((id) => byId.get(id)).filter(Boolean);
    const cost = chosen.reduce((s, p) => s + p.price, 0);
    const teamCount = (t) => chosen.filter((p) => p.team_id === t).length;
    const started = (p) => new Date(p.start_at) <= new Date();
    const wasMine = new Set(d.mine);
    const reason = (p) => {
      if (picks.includes(p.id)) return started(p) && wasMine.has(p.id) ? 'locked' : '';
      if (d.closed || started(p)) return 'tipped';
      if (picks.length >= d.slots) return 'full';
      if (cost + p.price > d.budget) return 'cap';
      if (teamCount(p.team_id) >= d.max_per_team) return 'team';
      return '';
    };
    const toggle = (p) => {
      if (picks.includes(p.id)) { if (started(p) && wasMine.has(p.id)) return toast('That player\'s game has started.'); picks = picks.filter((x) => x !== p.id); } else picks = [...picks, p.id];
      dirty = true; draw(d);
    };
    const same = JSON.stringify([...picks].sort()) === JSON.stringify([...d.mine].sort());
    clear(host).append(
      h('div', { class: 'seg cap-days' }, d.days.map((x) => h('button', { type: 'button', class: 'seg-b' + (x === d.day ? ' on' : ''), 'data-day': x, onclick: () => { day = x; dirty = false; picks = null; run(); } }, new Date(x + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })))),
      h('section', { class: 'card cap-me' },
        h('h2', { class: 'card-h' }, 'Your lineup', h('small', null, `${fmt(cost)} / ${d.budget} cap · ${picks.length}/${d.slots}`)),
        h('div', { class: 'cap-bar' }, h('i', { style: { width: Math.min(100, (cost / d.budget) * 100) + '%' }, class: cost > d.budget ? 'over' : '' })),
        chosen.length ? h('div', { class: 'stack' }, chosen.map((p) => playerRow(p, reason(p) === 'locked' ? 'locked' : 'drop', () => toggle(p)))) : h('p', { class: 'muted' }, 'Tap players below to add them.'),
        d.closed ? h('p', { class: 'muted' }, 'This night is final.') : h('button', { type: 'button', class: 'btn main', id: 'cap-save', disabled: same ? '' : null, onclick: async (e) => {
          e.target.disabled = true;
          try { await soc.capSet(d.day, picks); dirty = false; toast('Lineup saved'); run(true); } catch (er) { toast(errText(er)); e.target.disabled = false; }
        } }, same ? 'Saved' : 'Save lineup'),
        h('p', { class: 'muted' }, `Prize: ${fmt(d.night_prize)} coins for the best night (needs 2+ players). Week prize ${fmt(d.week_prize)} for the best 5 nights, Mon to Sun. Players lock at their own tip-off.`)),
      d.board.length ? h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Tonight', h('small', null, d.closed ? 'final' : 'live')),
        h('ol', { class: 'cap-board' }, d.board.map((b) => h('li', { class: b.me ? 'me' : '' }, h('b', null, b.name), h('span', null, Number(b.score).toFixed(1)),
          b.picks && b.picks.length ? h('small', null, b.picks.map((p) => `${p.name} ${p.score != null ? Number(p.score).toFixed(1) : '–'}`).join(' · ')) : h('small', null, `${b.count} players`))))) : null,
      d.week_board.length ? h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'This week', h('small', null, 'best 5 nights')),
        h('ol', { class: 'cap-board' }, d.week_board.map((b) => h('li', { class: b.me ? 'me' : '' }, h('b', null, b.name), h('span', null, Number(b.total).toFixed(1)), h('small', null, `${b.nights} nights`))))) : null,
      h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Players', h('small', null, 'price · avg fantasy')),
        d.players.length ? h('div', { class: 'stack cap-pool' }, d.players.map((p) => { const why = reason(p); return playerRow(p, picks.includes(p.id) ? 'in' : why, () => (why && !picks.includes(p.id) ? toast(WHY[why]) : toggle(p))); }))
          : h('p', { class: 'muted' }, 'No NBA games on this night.')));
  }

  run();
  const stop = poll(() => { if (!dirty) run(true); }, 60000);
  return () => stop();
}

const WHY = { tipped: 'That game has tipped off.', full: 'Five players max. Drop one first.', cap: 'Over the cap.', team: 'Two players per team at most.' };

function playerRow(p, state, onclick) {
  const live = p.score != null;
  return h('button', { type: 'button', class: `cap-p ${state}`, 'data-id': p.id, onclick, 'aria-label': `${p.name}, ${p.price}`, 'aria-pressed': state === 'in' || state === 'drop' || state === 'locked' ? 'true' : 'false' },
    face({ name: p.name, face: p.face }, 'nba', 36),
    h('span', { class: 'cap-n' }, h('b', null, p.name), h('small', null, `${p.team}${p.pos ? ' · ' + p.pos : ''} · ${dayTime(p.start_at)}`)),
    h('span', { class: 'cap-v' }, live ? h('b', null, p.dnp ? 'DNP' : Number(p.score).toFixed(1)) : h('b', null, `$${p.price}`), h('small', null, live ? `$${p.price}` : `avg ${Number(p.avg).toFixed(1)}`)));
}
