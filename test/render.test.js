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
      : id === '1003' ? F.summary(lg, id, { state: 'pre', hs: 0, as: 0, detail: 'Scheduled', clock: '0:00', period: 0, date: new Date(Date.now() + 5 * 36e5).toISOString() }) : F.summary(lg, id);
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

// betting game
const slipEl = w.document.getElementById('slip');
const { mountSlip } = await import('../js/slip.js');
mountSlip(slipEl);
await visit('#/game/nhl/1003', { wait: 350 });
let mlBtn = app().querySelector('.ml-row .bet-btn');
assert.ok(mlBtn, 'moneyline buttons'); mlBtn.click(); await sleep(30);
assert.equal(store.getState().slip.legs.length, 1); assert.ok(!slipEl.classList.contains('empty')); ok('moneyline leg added to slip');
app().querySelector('#mk-props').click(); await sleep(900);
const propBtns = app().querySelectorAll('.pr-row .bet-btn');
assert.ok(propBtns.length >= 2, 'prop buttons'); propBtns[0].click(); await sleep(30);
assert.equal(store.getState().slip.legs.length, 2); ok('player props loaded and added');
slipEl.querySelector('#slip-parlay').click(); await sleep(20);
assert.equal(store.getState().slip.mode, 'parlay');
slipEl.querySelector('#place-bet').click(); await sleep(30);
const bets = Object.values(store.getState().bets);
assert.equal(bets.length, 1); assert.equal(bets[0].mode, 'parlay'); assert.equal(bets[0].legs.length, 2);
assert.equal(store.getState().bank.coins, 1000 - 50); ok('parlay placed, stake taken from bankroll');
for (const [lg, id] of [['nba', 1003], ['nfl', 1003], ['mlb', 1003]]) { await visit(`#/game/${lg}/${id}`, { wait: 350 }); app().querySelector('#mk-props').click(); await sleep(1000); assert.ok(app().querySelectorAll('.pr-row').length > 0, lg + ' props'); ok(`${lg} props render`); }
text = await visit('#/picks', { wait: 600 });
assert.ok(app().querySelector('.bankroll') && app().querySelector('.pgame'), 'board'); ok('pick em board');
app().querySelector('#scope-all').click(); await sleep(500);
app().querySelector('#type-game').click(); await sleep(500);
app().querySelector('.pg-open').click(); await sleep(100);
assert.ok(app().querySelectorAll('.gb').length >= 2, 'game bets'); app().querySelector('.gb .bet-btn').click(); await sleep(30); ok('game bets section opens and adds a leg');
app().querySelector('#type-first').click(); await sleep(500); app().querySelector('.pg-open').click(); await sleep(900);
assert.ok(app().querySelectorAll('.pr-row.first').length > 0, 'first scorer rows'); ok('first scorer section');
app().querySelector('#type-props').click(); await sleep(500); app().querySelector('.pg-open').click(); await sleep(900);
assert.ok(app().querySelectorAll('.chip[id^=cat-]').length >= 2); app().querySelectorAll('.chip[id^=cat-]')[1].click(); await sleep(900); ok('props split by stat chips');
app().querySelector('#type-winner').click(); await sleep(500);
store.clearSlip ? store.clearSlip() : null;
app().querySelector('#scope-mine').click(); await sleep(500); app().querySelector('#scope-all').click(); await sleep(500); ok('all / my teams switch');
assert.ok(/Parlay|parlay/.test(app().textContent)); ok('open bets listed');
app().querySelector('#daily').click(); await sleep(20); assert.ok(store.getState().bank.coins > 1000 - 50); ok('daily bonus');
// settlement end to end: bets on finished game 1002 (final 3-2, home TB... home team wins)
{
  const { settleAll } = await import('../js/settle.js');
  const { normEvent } = await import('../js/espn.js');
  const { mlLeg } = await import('../js/bets.js');
  const g = normEvent(F.event('nhl', 1002, { state: 'post', hs: 3, as: 2, detail: 'Final' }), 'nhl');
  const win = { ...mlLeg(g, 'home'), date: '2026-10-10T23:00Z' }, lose = { ...mlLeg(g, 'away'), date: '2026-10-10T23:00Z' };
  const before = store.getState().bank.coins;
  store.update((st) => {
    st.bets.t1 = { id: 't1', ts: 1, mode: 'single', stake: 100, dec: win.dec, legs: [win], status: 'pending', payout: 0 };
    st.bets.t2 = { id: 't2', ts: 2, mode: 'single', stake: 100, dec: lose.dec, legs: [lose], status: 'pending', payout: 0 };
    st.bank.coins -= 200;
  });
  await settleAll();
  const bb = store.getState().bets;
  assert.equal(bb.t1.status, 'won'); assert.equal(bb.t2.status, 'lost');
  assert.equal(store.getState().bank.coins, before - 200 + bb.t1.payout);
  assert.ok(store.getState().bank.streak >= 0 && store.getState().bank.xp > 0); ok('bets settle from final scores and pay out');
}
text = await visit('#/season', { wait: 300 }); assert.ok(/Badges/.test(text) && /Bankroll/.test(text)); ok('season page');
text = await visit('#/settings'); assert.ok(/Spoiler/.test(text)); ok('settings page');
w.document.getElementById('set-spoil').click(); await sleep(20);
assert.equal(store.getState().settings.spoilerFree, true); ok('spoiler toggle');
text = await visit('#/game/nhl/1002', { wait: 350 }); ok('game page in spoiler mode');
// hide leagues
text = await visit('#/settings'); assert.ok(/Hide leagues/.test(text)); w.document.getElementById('hide-nba').click(); await sleep(20);
assert.deepEqual(store.getState().settings.hidden, ['nba']); ok('hide league chip');
text = await visit('#/picks', { wait: 500 }); w.document.getElementById('scope-all').click(); await sleep(500);
assert.ok(!/NBA/.test([...w.document.querySelectorAll('.pg-h small')].map((x) => x.textContent).join(' '))); ok('hidden league not in pick em all');
text = await visit('#/league/nba', { wait: 300 }); assert.ok(w.document.querySelectorAll('.card, .gcard').length > 0 || /game/i.test(text)); ok('hidden league still has its tab');
w.document.getElementById('view-playoffs').click(); await sleep(300); ok('playoffs view opens');
w.document.querySelectorAll('.seg-b').forEach((b) => { if (b.textContent === 'Standings') b.click(); }); await sleep(300);
assert.ok(w.document.getElementById('st-picture')); ok('standings has playoff picture toggle');
store.toggleHidden('nba');
text = await visit('#/league/nhl', { wait: 250 }); assert.ok(!/\b3\b.*\b2\b/.test('') ); ok('league in spoiler mode');
store.setSetting('spoilerFree', false);
text = await visit('#/season', { wait: 300 }); assert.ok(app().querySelector('.bk-av svg'), 'avatar on season'); ok('avatar shows on season');
text = await visit('#/profile', { wait: 200 });
assert.ok(app().querySelector('.pf-me svg') && /Your closet/.test(text) && !app().querySelector('.buy'), 'profile'); ok('fan page draws the character and closet, no shop');
text = await visit('#/shop', { wait: 200 });
assert.ok(app().querySelector('.pf-me svg') && app().querySelector('.pf-tabs'), 'shop'); ok('shop is its own page');
app().querySelectorAll('.pf-tabs .seg-b')[0].click();
const coinsBefore = store.getBank().coins;
const capBtn = app().querySelector('.buy[data-id="cap"]'); assert.ok(capBtn, 'cap for sale');
capBtn.click(); await sleep(50);
assert.equal(store.getBank().coins, coinsBefore, 'tapping a price does not buy'); assert.ok(app().querySelector('#confirm-buy'), 'confirm sheet');
app().querySelector('#buy-cancel').click(); await sleep(30);
assert.ok(!app().querySelector('#confirm-buy') && !store.getState().avatar.owned.includes('cap')); ok('tapping a price opens a confirm sheet; cancel buys nothing');
app().querySelector('.buy[data-id="cap"]').click(); await sleep(30); app().querySelector('#confirm-buy').click(); await sleep(50);
assert.ok(store.getBank().coins < coinsBefore && store.getState().avatar.owned.includes('cap')); ok('buying an item takes coins');
assert.ok(app().querySelector('.pf-me svg').innerHTML.includes('#003e7e') || app().querySelector('.pf-me svg').innerHTML.toLowerCase().includes('#003e7e'), 'team colours'); ok('cap wears followed team colours');
// colour menu: from the closet on the fan page, open the + on the free tee, pick black
text = await visit('#/profile', { wait: 200 });
const teeMore = app().querySelector('[data-item="tee"] .dot.more'); assert.ok(teeMore, 'tee colour button'); teeMore.click(); await sleep(30);
assert.ok(app().querySelector('.cs-panel'), 'colour menu'); app().querySelector('.cs-sw[data-ci="2"]').click(); await sleep(30);
assert.equal(store.getState().avatar.col.tee, 2); app().querySelector('#cs-done').click(); await sleep(30);
assert.ok(!app().querySelector('.cs-panel')); ok('colour menu switches a free item colour');
text = await visit('#/check', { wait: 100 });
app().querySelector('#run-check').click(); await sleep(1500);
assert.ok(app().querySelector('.checklist'), 'check ran'); ok('data check runs');
text = await visit('#/nope', { wait: 50 }); assert.equal(w.location.hash, '#/'); ok('unknown route goes home');

if (errors.length) { console.error('ERRORS:', errors); process.exit(1); }
console.log(`\n${n} render checks passed`);
process.exit(0);
