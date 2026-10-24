// Builds the daily and weekly content (quests, deal, featured items). Pure functions of the date, so the
// same date always gives the same result. scripts/refresh.mjs writes this to data/live.json each
// morning; the app builds the same thing itself if that file is missing or out of date.
import { ITEMS, dealFor } from './avatar.js';
import { questCoins } from './economy.js';
import { addDay, parseDay, seeded, weekKey } from './period.js';

export const METRICS = {
  daily_claimed: 'claim the daily bonus', shop_visits: 'visit the shop', outfit_changed: 'change your look',
  games_opened: 'open different games', games_marked: 'mark games as watched', bets_placed: 'place bets',
  parlays_placed: 'build parlays', bets_won: 'win bets', items_bought: 'buy things in the shop',
};

const q = (metric, target, coins, title) => ({ metric, target, coins: questCoins(coins), title });
// Each day: one easy habit, one thing to play, one stretch.
const DAILY = {
  easy: [q('daily_claimed', 1, 50, 'Claim your daily bonus'), q('shop_visits', 1, 40, 'Check out the shop'), q('outfit_changed', 1, 40, 'Change something in your fit'), q('games_opened', 3, 60, 'Open 3 different games')],
  play: [q('bets_placed', 1, 70, 'Place a bet'), q('bets_placed', 3, 140, 'Place 3 bets'), q('parlays_placed', 1, 120, 'Build a parlay'), q('games_marked', 1, 60, 'Mark a game as watched')],
  stretch: [q('bets_won', 1, 150, 'Win a bet'), q('bets_won', 2, 300, 'Win 2 bets'), q('games_opened', 6, 120, 'Open 6 different games')],
};
// Each week: bigger. The last one also pays an item.
const WEEKLY = {
  a: [q('bets_placed', 10, 400, 'Place 10 bets'), q('daily_claimed', 5, 400, 'Claim the daily bonus 5 times'), q('games_opened', 15, 350, 'Open 15 different games'), q('games_marked', 5, 350, 'Mark 5 games as watched')],
  b: [q('parlays_placed', 2, 500, 'Build 2 parlays'), q('items_bought', 1, 300, 'Buy something in the shop'), q('outfit_changed', 5, 250, 'Change your fit 5 times')],
  c: [q('bets_won', 5, 700, 'Win 5 bets'), q('bets_won', 3, 500, 'Win 3 bets')],
};

const pickOne = (rnd, list, used) => {
  const ok = list.filter((x) => !used.has(x.metric));
  const from = ok.length ? ok : list;
  return from[Math.floor(rnd() * from.length)];
};

export function genDaily(day) {
  const rnd = seeded('daily:' + day);
  const used = new Set();
  const quests = ['easy', 'play', 'stretch'].map((k, i) => {
    const pick = pickOne(rnd, DAILY[k], used);
    used.add(pick.metric);
    return { id: `d${day}-${i + 1}`, ...pick };
  });
  return { date: day, quests, deal: dealFor(day) };
}

/** `start` is the Friday the week begins on. */
export function genWeekly(start) {
  const rnd = seeded('weekly:' + start);
  const used = new Set();
  const quests = ['a', 'b', 'c'].map((k, i) => {
    const pick = pickOne(rnd, WEEKLY[k], used);
    used.add(pick.metric);
    return { id: `w${start}-${i + 1}`, ...pick };
  });
  const buyable = ITEMS.filter((i) => i.price > 0 && !i.ach);
  const shuffle = (a) => a.map((x) => [rnd(), x]).sort((m, n) => m[0] - n[0]).map((x) => x[1]);
  // the weekly prize item is a nice extra, not a paycheck (400 to 1,200 coins at today's prices)
  const prize = shuffle(buyable.filter((i) => i.price >= 400 && i.price <= 1200))[0];
  if (prize) quests[2].item = prize.id;
  const taken = new Set([prize && prize.id]);
  const featured = shuffle(buyable.filter((i) => (i.base ?? i.price) >= 150 && (i.base ?? i.price) <= 4000 && !taken.has(i.id))).slice(0, 6).map((i) => i.id);
  return { week: start, endsBefore: addDay(start, 7), quests, featured, note: '' };
}

export const genLive = (day) => ({ v: 1, daily: genDaily(day), weekly: genWeekly(weekKey(parseDay(day))) });

/** Is this a usable quest list? Used to ignore a broken data file. */
export function validQuests(list) {
  return Array.isArray(list) && list.length > 0 && list.every((x) => x && typeof x.id === 'string' && x.metric in METRICS && Number.isFinite(x.target) && x.target > 0 && Number.isFinite(x.coins) && x.coins >= 0 && (!x.item || ITEMS.some((i) => i.id === x.item)));
}
