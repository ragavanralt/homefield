// Loads the real app in jsdom with fake ESPN responses and visits every screen.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as F from './fixtures.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script type="module">[\s\S]*?<\/script>/, '').replace(/<link[^>]+>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['document', 'location', 'history', 'navigator', 'localStorage', 'Node', 'HTMLElement', 'Blob', 'URL', 'Event', 'CustomEvent', 'requestAnimationFrame', 'MutationObserver', 'IntersectionObserver', 'FileReader', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch (e) { /* node has its own */ }
}
globalThis.window = w;
w.scrollTo = () => {};
globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} };
w.HTMLCanvasElement.prototype.getContext = () => null;

const errors = [];
w.addEventListener('error', (e) => errors.push(e.error || e.message));
process.on('unhandledRejection', (e) => errors.push(e));

// ---- fake ESPN ----
const byPath = Object.fromEntries(Object.keys({ nhl: 1, nba: 1, nfl: 1, mlb: 1, 'uefa.champions': 1, 'eng.1': 1, 'esp.1': 1, 'ger.1': 1, 'ita.1': 1, 'fra.1': 1, 'uefa.europa': 1, 'usa.1': 1 }).map((lg) => [F.sportPath(lg), lg]));
const calls = [];
globalThis.fetch = async (url) => {
  url = String(url);
  calls.push(url);
  const m = url.match(/sports\/([a-z]+\/[a-z0-9.]+)\/(scoreboard|summary|teams|standings)(?:\/(\d+)\/schedule)?/) || url.match(/sports\/([a-z]+\/[a-z0-9.]+)\/teams\/(\d+)\/schedule/);
  const std = url.match(/apis\/v2\/sports\/([a-z]+\/[a-z0-9.]+)\/standings/);
  let body = {};
  if (std) body = F.standings(byPath[std[1]]);
  else if (url.includes('/athletes/')) { const mm = url.match(/sports\/([a-z]+\/[a-z0-9.]+)\/athletes\/(\d+)/); body = F.overview(byPath[mm[1]], mm[2]); }
  else if (url.includes('/roster')) { const mm = url.match(/sports\/([a-z]+\/[a-z0-9.]+)\/teams\/(\d+)\/roster/); body = F.roster(byPath[mm[1]], mm[2]); }
  else if (url.includes('/schedule')) { const mm = url.match(/sports\/([a-z]+\/[a-z0-9.]+)\/teams\/(\d+)\/schedule/); body = F.schedule(byPath[mm[1]], mm[2]); }
  else if (m && m[2] === 'scoreboard') {
    const lg = byPath[m[1]];
    body = F.scoreboard(lg, [F.event(lg, 1001, { state: 'in' }), F.event(lg, 1002, { state: 'post', hs: 3, as: 2, detail: 'Final' }), F.event(lg, 1003, { state: 'pre', hs: 0, as: 0, date: new Date(Date.now() + 36e5 * 5).toISOString() })]);
  } else if (m && m[2] === 'summary') {
    const lg = byPath[m[1]]; const id = url.match(/event=(\d+)/)[1];
    body = id === '1001' ? F.summary(lg, id, { state: 'in', hs: 2, as: 1, detail: '2nd Period', clock: '8:42', period: 2 })
      : id === '1003' ? F.summary(lg, id, { state: 'pre', hs: 0, as: 0, detail: 'Scheduled', clock: '0:00', period: 0 }) : F.summary(lg, id);
  } else if (m && m[2] === 'teams') body = F.teamsList(byPath[m[1]]);
  return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
};

const { route } = await import('../js/main.js');
const store = await import('../js/store.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = () => w.document.getElementById('app');

async function visit(hash, { wait = 120 } = {}) {
  w.location.hash = hash;
  await route();
  await sleep(wait);
  return app().textContent;
}
let n = 0;
const ok = (name) => { n++; console.log('  ok  ' + name); };

// first run -> onboarding
let text = await visit('#/');
assert.ok(w.location.hash === '#/onboarding', 'redirects to onboarding'); ok('first run redirects to onboarding');
text = await visit('#/onboarding', { wait: 300 });
assert.ok(app().querySelectorAll('.tile').length > 0, 'team tiles'); ok('onboarding lists teams');
store.follow({ league: 'nhl', id: '20', abbr: 'TB', name: 'Tampa Bay Lightning', short: 'Lightning', color: '#003e7e', alt: '#ffffff' });
store.follow({ league: 'nba', id: '28', abbr: 'TOR', name: 'Toronto Raptors', short: 'Raptors', color: '#ce1141', alt: '#000000' });
store.setOnboarded(true);

text = await visit('#/', { wait: 300 });
assert.ok(app().querySelector('.gcard'), 'home has game cards'); ok('home shows games');
for (const lg of ['nhl', 'nba', 'nfl', 'mlb', 'soccer']) {
  text = await visit('#/league/' + lg, { wait: 250 });
  assert.ok(app().querySelector('.gcard'), lg + ' cards'); ok('league tab ' + lg);
}
text = await visit('#/team/nhl/20', { wait: 300 });
assert.ok(app().querySelector('.thero'), 'team hero'); ok('team page');
if (!app().querySelector('#ttab-roster')) console.log(app().textContent.slice(0,300)); app().querySelector('#ttab-roster').click(); await sleep(400);
assert.ok(app().querySelectorAll('.pcard').length >= 3, 'roster cards'); ok('team roster with headshots');
app().querySelector('#rs-stats').click(); await sleep(700);
assert.ok(app().querySelector('table.players'), 'stats table'); assert.ok(/PTS/.test(app().textContent)); ok('team player stats');
for (const [lg, id] of [['nfl', 2], ['mlb', 5]]) { await visit(`#/team/${lg}/${id}`, { wait: 300 }); app().querySelector('#ttab-roster').click(); await sleep(400); app().querySelector('#rs-stats').click(); await sleep(700); assert.ok(app().querySelector('table.players'), lg + ' stats'); ok(`${lg} roster and stats`); }

const games = [['nhl', 1001], ['nhl', 1002], ['nhl', 1003], ['nba', 1002], ['nfl', 1002], ['mlb', 1002], ['mlb', 1001], ['eng.1', 1002], ['uefa.champions', 1001], ['usa.1', 1003]];
for (const [lg, id] of games) {
  text = await visit(`#/game/${lg}/${id}`, { wait: 350 });
  if (!app().querySelector('.ghead')) console.log(text.slice(0,300), calls.slice(-3)); assert.ok(app().querySelector('.ghead'), `${lg}/${id} header`);
  const tabs = [...app().querySelectorAll('.tab2')];
  for (const t of tabs) { t.click(); await sleep(60); assert.ok(app().querySelector('.gbody, .view'), 'tab body'); }
  ok(`game ${lg}/${id} (${tabs.length} tabs)`);
}

// pick something in a game and see it on the picks page
await visit('#/game/nhl/1003', { wait: 350 });
const side = app().querySelector('.pp-side');
assert.ok(side, 'pick buttons'); side.click(); await sleep(50);
assert.ok(Object.keys(store.getState().picks).length === 1, 'pick saved'); ok('pick saved from game page');
text = await visit('#/picks', { wait: 400 });
assert.ok(app().querySelector('.mode'), 'modes'); ok('picks page');
app().querySelector('#mode-streak').click(); await sleep(300); ok('switch to Streak Run');
text = await visit('#/season', { wait: 300 }); assert.ok(/Points/.test(text)); ok('season page');
text = await visit('#/settings'); assert.ok(/Spoiler/.test(text)); ok('settings page');
w.document.getElementById('set-spoil').click(); await sleep(20);
assert.equal(store.getState().settings.spoilerFree, true); ok('spoiler toggle');
text = await visit('#/game/nhl/1002', { wait: 350 }); ok('game page in spoiler mode');
text = await visit('#/league/nhl', { wait: 250 }); assert.ok(!/\b3\b.*\b2\b/.test('') ); ok('league in spoiler mode');
store.setSetting('spoilerFree', false);
text = await visit('#/check', { wait: 100 });
app().querySelector('#run-check').click(); await sleep(1500);
assert.ok(app().querySelector('.checklist'), 'check ran'); ok('data check runs');
text = await visit('#/nope', { wait: 50 }); assert.equal(w.location.hash, '#/'); ok('unknown route goes home');

if (errors.length) { console.error('ERRORS:', errors); process.exit(1); }
console.log(`\n${n} render checks passed`);
process.exit(0);
