// Refreshes data/live.json: today's quests and deal, and (on Fridays) the weekly quests and featured items.
//   node scripts/refresh.mjs            daily refresh (also builds the weekly part if it is missing or old)
//   node scripts/refresh.mjs --weekly   daily plus a fresh weekly
//   node scripts/refresh.mjs --date=2026-10-23   pretend it is that day (YYYY-MM-DD)
// "Today" is the calendar day in Toronto, so the 8am job always lands on the right date.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { genDaily, genWeekly, validQuests } from '../js/live-gen.js';
import { weekKey, parseDay, isDayKey } from '../js/period.js';
import { itemById } from '../js/avatar.js';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../data/live.json');
const args = process.argv.slice(2);
const arg = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];

const torontoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const day = arg('date') || torontoToday();
if (!isDayKey(day)) { console.error(`Bad date: ${day}`); process.exit(1); }
const week = weekKey(parseDay(day));

let old = {};
try { old = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { /* first run */ }

const daily = genDaily(day);
const keepWeekly = !args.includes('--weekly') && old.weekly && old.weekly.week === week && validQuests(old.weekly.quests);
const weekly = keepWeekly ? old.weekly : genWeekly(week);

// checks before anything is written
const problems = [];
if (!validQuests(daily.quests)) problems.push('daily quests are not valid');
if (!validQuests(weekly.quests)) problems.push('weekly quests are not valid');
if (!itemById(daily.deal.itemId)) problems.push(`deal item ${daily.deal.itemId} does not exist`);
for (const id of weekly.featured || []) if (!itemById(id)) problems.push(`featured item ${id} does not exist`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const out = { v: 1, updated: day, daily, weekly };
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

const deal = itemById(daily.deal.itemId);
console.log(`Updated ${day} (week of ${week}${keepWeekly ? ', weekly kept' : ', weekly rebuilt'})`);
console.log(`  Deal: ${deal.name} ${daily.deal.pct}% off`);
for (const x of daily.quests) console.log(`  Daily:  ${x.title} -> ${x.coins} coins`);
for (const x of weekly.quests) console.log(`  Weekly: ${x.title} -> ${x.coins} coins${x.item ? ' + ' + itemById(x.item).name : ''}`);
console.log(`  Featured: ${weekly.featured.map((id) => itemById(id).name).join(', ')}`);
