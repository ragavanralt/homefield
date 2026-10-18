// Quests: a few small goals each day, bigger ones each week. Pay coins (and sometimes an item).
import { h, clear, toast } from '../ui.js';
import { getBank, onSlipChange, questCount, questClaimed, claimQuest } from '../store.js';
import { pageHead } from '../components.js';
import { itemById } from '../avatar.js';
import { ensureLive } from '../live.js';
import { parseDay } from '../period.js';

const fmt = (n) => Math.round(n).toLocaleString();

export async function render(root) {
  const host = h('div', { class: 'quests' });
  root.append(pageHead('Quests', 'Small goals for coins and gear. New ones every morning, bigger ones every Friday.'), host);
  let live = await ensureLive();

  function questRow(which, qu) {
    const n = Math.min(questCount(which, qu.metric), qu.target);
    const done = n >= qu.target, claimed = questClaimed(which, qu);
    const item = qu.item && itemById(qu.item);
    return h('li', { class: 'quest' + (claimed ? ' claimed' : done ? ' ready' : ''), 'data-q': qu.id },
      h('div', { class: 'q-main' },
        h('b', null, qu.title),
        h('div', { class: 'xp' }, h('i', { style: { width: (n / qu.target) * 100 + '%' } })),
        h('small', null, `${n} / ${qu.target}`)),
      h('div', { class: 'q-rew' },
        h('span', { class: 'q-coins' }, h('i', { class: 'coin' }), `+${fmt(qu.coins)}`),
        item ? h('small', null, `+ ${item.name}`) : null),
      claimed ? h('span', { class: 'q-done' }, 'Claimed')
        : h('button', { type: 'button', class: 'btn' + (done ? ' main' : ''), disabled: done ? null : '', 'data-claim': qu.id, onclick: () => {
          const r = claimQuest(which, qu);
          if (!r.ok) return;
          const it = r.item && itemById(r.item);
          toast(`Quest done: +${fmt(r.coins)} coins${it ? ` and ${it.name}` : ''}${r.swapped ? ' (you already had the item, so extra coins)' : ''}`);
          draw();
        } }, done ? 'Claim' : 'In progress'));
  }

  function draw() {
    const daily = live.daily, weekly = live.weekly;
    const left = (which, list) => list.filter((x) => !questClaimed(which, x)).length;
    const ends = parseDay(weekly.endsBefore || weekly.week);
    clear(host).append(
      h('div', { class: 'q-bank' }, h('i', { class: 'coin' }), fmt(getBank().coins), h('small', null, 'coins')),
      h('section', { class: 'card' },
        h('h2', { class: 'card-h' }, 'Today', h('small', null, `${left('daily', daily.quests)} left · new ones every morning`)),
        h('ul', { class: 'quest-list' }, daily.quests.map((x) => questRow('daily', x)))),
      h('section', { class: 'card' },
        h('h2', { class: 'card-h' }, 'This week', h('small', null, `${left('weekly', weekly.quests)} left · resets Friday`)),
        h('ul', { class: 'quest-list' }, weekly.quests.map((x) => questRow('weekly', x))),
        weekly.note ? h('p', { class: 'muted' }, weekly.note) : null),
      h('p', { class: 'muted' }, 'Counts what you do on this device. Coins and items from quests are yours to keep.'));
    void ends;
  }
  draw();
  return onSlipChange(draw);
}
