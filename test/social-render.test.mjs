// Opens the real Crew, Duels, Survivor and Cap Night screens in jsdom, backed by the real server code on Postgres,
// and uses them the way a person would: join, challenge, pick, lock in a lineup.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as PG from './pg.mjs';

if (!PG.available()) { console.log('Social render tests skipped (no Postgres found; set HF_PG to run them)'); process.exit(0); }

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script type="module">[\s\S]*?<\/script>/, '').replace(/<link[^>]+>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['document', 'location', 'history', 'navigator', 'localStorage', 'Node', 'HTMLElement', 'Blob', 'URL', 'Event', 'CustomEvent', 'requestAnimationFrame', 'MutationObserver', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch (e) { /* node has its own */ }
}
globalThis.window = w; w.scrollTo = () => {}; w.confirm = () => true;
globalThis.confirm = () => true;
w.HTMLCanvasElement.prototype.getContext = () => null;
const errors = [];
w.addEventListener('error', (e) => errors.push(e.error || e.message));
process.on('unhandledRejection', (e) => errors.push(e));

const NOW = '2030-10-22 10:00-04'; // a Tuesday, far enough ahead that the real clock never says "started"
const db = PG.createDb(); db.applySchema(); db.at(NOW);
db.sql(`update app_config set value = '["nba"]' where key = 'survivor_leagues'`);
const invite = db.one('select code from invites where owner limit 1');
const gm = (id, hm) => ({ league: 'nba', game_id: id, start_at: `2030-10-22T${hm}:00-04:00`, home: { id: 'h' + id, name: 'Home ' + id, abbr: 'H' + id }, away: { id: 'a' + id, name: 'Away ' + id, abbr: 'A' + id }, fav_team: 'h' + id, fav_prob: 0.6, ou: 220.5, home_spread: -4.5 });
const games = [gm('7001', '19:00'), gm('7002', '21:00')];
const cards = games.flatMap((g) => {
  const b = { league: 'nba', game_id: g.game_id };
  return [{ ...b, kind: 'winner', subject: 'game', title: `${g.away.abbr} at ${g.home.abbr}`, a: g.home.abbr, b: g.away.abbr, line: null },
    { ...b, kind: 'total', subject: 'game', title: 'Total points', a: 'Over', b: 'Under', line: 220.5 },
    { ...b, kind: 'team_total', subject: 'home', title: 'Home points', a: 'Over', b: 'Under', line: 112.5 },
    { ...b, kind: 'team_total', subject: 'away', title: 'Away points', a: 'Over', b: 'Under', line: 108.5 }];
});
const players = [];
games.forEach((g) => { for (let i = 1; i <= 4; i++) players.push({ day: '2030-10-22', league: 'nba', game_id: g.game_id, player_id: `${g.game_id}-${i}`, name: `Player ${g.game_id}-${i}`, team_id: i % 2 ? g.home.id : g.away.id, team_abbr: i % 2 ? g.home.abbr : g.away.abbr, pos: 'G', price: 12 - i, avg: 30 - i }); });
db.rpc('bot_publish', { p_games: games, p_cards: cards, p_cap: players }, 'service_role');

globalThis.fetch = async (url, init) => {
  const fn = String(url).split('/rpc/')[1];
  const r = db.rpc(fn, JSON.parse(init.body), fn.startsWith('bot_') ? 'service_role' : 'anon');
  if (r && r.raised) return { ok: false, status: 400, json: async () => ({ message: r.error }) };
  return { ok: true, status: 200, json: async () => r };
};

const { SOCIAL } = await import('../js/social-config.js');
SOCIAL.url = 'https://example.supabase.co'; SOCIAL.key = 'sb_publishable_test';
const { route } = await import('../js/main.js');
const store = await import('../js/store.js');
const soc = await import('../js/social.js');
store.setOnboarded(true);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = () => w.document.getElementById('app');
const $ = (sel) => app().querySelector(sel);
const $$ = (sel) => [...app().querySelectorAll(sel)];
const byText = (sel, re) => $$(sel).find((e) => re.test(e.textContent));
const BAD = /null|undefined|NaN|Invalid Date|\[object/;
async function visit(hash, wait = 150) { w.location.hash = hash; await route(); await sleep(wait); const t = app().textContent; assert.ok(!BAD.test(t), `stray placeholder text on ${hash}: ` + (t.match(new RegExp('.{0,40}(' + BAD.source + ').{0,40}')) || [''])[0]); return t; }
const type = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
let n = 0; const ok = (m) => { n++; console.log('  ok  ' + m); };

let text = await visit('#/duels');
assert.match(text, /Join the crew first/); ok('duels asks you to join the crew first');
assert.equal(w.document.querySelector('#subnav a[href="#/duels"]') != null, true); ok("Pick'em sub-tabs include Duels when the server is configured");

text = await visit(`#/join/${invite}`);
assert.equal($('#f-invite').value, invite); ok('invite link fills in the code');
type($('#f-handle'), 'ragavan'); type($('#f-display'), 'Rag');
byText('button', /Join the crew/).click(); await sleep(400);
assert.match($('#recovery-code').textContent, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/); ok('joining shows the recovery code once');
const ownerCode = $('#recovery-code').textContent;
$('#code-saved').click(); await sleep(400);
const tab = async (id) => { $(`[data-tab="${id}"]`).click(); await sleep(250); };
assert.ok($('.crew-table tr[data-handle="ragavan"]'), 'table row'); await tab('fits'); assert.ok($('.crew-fits .fit-card[data-handle="ragavan"]'), 'fit card'); ok('crew table and fit gallery show you');
await tab('owner'); assert.ok(byText('button', /Make an invite link/), 'owner tools'); ok('owner sees invite tools');

/* a second person, made through the client, so there is someone to challenge */
const inv2 = (await soc.makeInvite()).code;
await soc.logout();
const bro = await soc.signup(inv2, 'bro', 'Bro');
await soc.logout(); await soc.login('ragavan', ownerCode);

store.update((s) => { s.bank.coins = 1000; });
text = await visit('#/duels', 250);
assert.ok($('#duel-new')); assert.ok($('.daily-link'), 'link to the Daily Five'); text = await visit('#/daily', 250); assert.match(text, /Daily Five/); assert.ok($$('.daily .dcard').length === 5, 'five daily cards'); ok('Daily Five has its own page under Pick\'em');
$$('.daily .dcard')[0].querySelector('.side').click(); await sleep(250);
assert.ok($('.daily .side.on'), 'daily pick sticks'); ok('a Daily Five pick is saved');

text = await visit('#/duels', 250); $('#duel-new').click(); await sleep(300);
assert.ok($('#d-game'), 'game picker'); assert.ok($('#d-opp')); ok('new duel form loads the slate and the crew');
type($('#d-opp'), 'bro');
type($('#d-stake'), '60');
byText('button', /Send challenge/).click(); await sleep(500);
assert.match(w.location.hash, /^#\/duels\/[0-9a-f-]{36}$/, 'went to the duel'); ok('sending a challenge opens the duel');
assert.equal(store.getBank().coins, 940); ok('the stake left your coins');
const duelHash = w.location.hash;
text = await visit(duelHash, 300);
assert.equal($$('.dcard').length, 3); assert.match(text, /Waiting for someone to accept/);
$$('.dcard').forEach((c) => c.querySelector('.side').click());
await sleep(600);
assert.equal($$('.dcard .side.on').length, 3); ok('picks stick on an open duel');

await soc.logout(); await soc.login('bro', bro.code);
store.update((s) => { s.bank.coins = 500; });
text = await visit('#/duels', 300);
assert.match(text, /Challenges for you/); ok('the friend sees the challenge');
$('.duel-row').click?.();
text = await visit(duelHash, 300);
byText('button', /^Accept/).click(); await sleep(500);
assert.equal(store.getBank().coins, 440); assert.match(app().textContent, /In play/); ok('accepting takes the stake and starts the duel');
assert.ok($$('.dcard .dc-o').every((e) => /has picked/.test(e.textContent)), 'opponent picks are hidden'); ok('you can see that they picked, not what');

text = await visit('#/survivor', 300);
assert.ok($('.pool[data-league="nba"]'), 'nba pool'); assert.match(text, /Join for 50 coins/);
byText('button', /Join for 50/).click(); await sleep(500);
assert.equal(store.getBank().coins, 390); assert.ok($$('.sv-games .dcard').length === 2, 'two games to choose from');
$('.sv-games .dcard .side').click(); await sleep(500);
assert.ok($('.sv-games .side.on'), 'pick marked'); ok('survivor: join, then pick a team');
const fav = $$('.sv-games .side').find((b) => /fav/.test(b.textContent)); assert.ok(fav); ok('favourite is labelled');

text = await visit('#/cap', 400);
assert.equal($$('.cap-pool .cap-p').length, 8); ok('cap night lists the pool');
const rows = $$('.cap-pool .cap-p');
rows[0].click(); rows[1].click(); rows[2].click();
assert.equal($$('.cap-me .cap-p').length, 3, 'three picked');
text = app().textContent; assert.match(text, /\/ 40 cap/);
$('#cap-save').click(); await sleep(500);
assert.match(app().textContent, /Saved/); ok('cap night: pick players and save the lineup');
assert.ok(db.one(`select array_length(players,1) from cap_lineups limit 1`) === '3'); ok('the lineup is on the server');

// the gallery: bro (signed in now) looks at ragavan's saved look, likes it, copies it
await soc.logout(); await soc.login('ragavan', ownerCode);
store.update((s) => { s.avatar.owned.push('curly', 'tank'); s.avatar.eq.top = 'tank'; s.avatar.eq.hair = 'curly'; s.avatar.fits = [{ id: 'fx', name: 'Gym', skin: 2, hairColor: 0, body: 1, team: '', col: {}, side: {}, eq: { top: 'tee', hair: 'short', bottom: 'jeans', shoes: 'sneakers' } }]; });
await soc.syncNow();
await soc.logout(); await soc.login('bro', bro.code);
store.update((s) => { s.avatar.eq.top = 'tee'; s.avatar.eq.hair = 'short'; s.avatar.owned = s.avatar.owned.filter((x) => !['curly', 'tank'].includes(x)); });
text = await visit('#/crew', 400); await tab('fits');
const rc = $('.fit-card[data-handle="ragavan"]');
assert.ok(rc, 'ragavan card'); assert.ok(rc.querySelector('.avatar.full svg'), 'full body look'); assert.ok(!/bust/.test(rc.querySelector('.avatar').className)); ok('gallery shows the full-body look');
assert.equal(rc.querySelectorAll('.fit-pick .chip').length, 0, 'only the current fit'); ok('the gallery shows just the current fit');
rc.querySelector('.btn.like').click(); await sleep(500);
assert.match($('.fit-card[data-handle="ragavan"] .btn.like').textContent, /♥ 1/); ok('liking a fit counts it');
$('.fit-card[data-handle="ragavan"] .btn.copy').click(); await sleep(200);
assert.match($('.fit-card[data-handle="ragavan"] .fit-note').textContent, /Tank top/); assert.equal(store.getState().avatar.eq.top, 'tee', 'unowned top is not worn');
assert.equal(store.getState().avatar.eq.hair, 'short'); ok('copy skips what you do not own and lists it with a link to the shop');
store.update((s) => { s.avatar.owned.push('tank'); });
$('.fit-card[data-handle="ragavan"] .btn.copy').click(); await sleep(200);
assert.equal(store.getState().avatar.eq.top, 'tank'); ok('copy wears the pieces you do own');

// recent bets: ragavan shares a parlay with one live leg and one started leg; bro mirrors it
await soc.logout(); await soc.login('ragavan', ownerCode);
const soon = new Date(Date.now() + 36e5).toISOString(), gone = new Date(Date.now() - 36e5).toISOString();
const L = (key, date, label) => ({ key, kind: 'ml', gameKey: key, league: 'nba', date, home: { id: 'h', abbr: 'HOM', name: 'Home' }, away: { id: 'a', abbr: 'AWY', name: 'Away' }, side: 'home', dec: 1.8, label, result: 'pending' });
store.update((s) => { s.bank.streak = 3; s.bets.mir1 = { id: 'mir1', ts: Date.now(), mode: 'parlay', stake: 50, dec: 3.2, legs: [L('g1|ml|home', soon, 'HOM to win'), L('g2|ml|home', gone, 'BOS to win')], status: 'pending', payout: 0 }; });
await soc.syncNow();
await soc.logout(); await soc.login('bro', bro.code);
store.clearSlip();
text = await visit('#/crew', 500); await tab('bets');
assert.ok($('.bet-card[data-bet="mir1"]'), 'ragavan\'s bet shows in the crew feed'); assert.match($('.bet-card[data-bet="mir1"]').textContent, /HOM to win/); ok('crew bets feed shows what a member just bet');
$('.bet-card[data-bet="mir1"] .mirror').click(); await sleep(200);
assert.equal(store.getState().slip.legs.length, 1, 'only the leg that has not started is copied'); assert.equal(store.getState().slip.legs[0].key, 'g1|ml|home'); assert.equal(store.getState().slip.legs[0].result, 'pending'); ok('mirror copies the open legs onto your slip');
store.clearSlip();
// profiles: tap a name in the crew and see their page, with the open ticket and a mirror button
await tab('table');
assert.ok($('.crew-table tr[data-handle="ragavan"] a.who-link'), 'names in the table are links'); assert.match($('.crew-table tr[data-handle="ragavan"] a.who-link').getAttribute('href'), /#\/crew\/u\/ragavan/); ok('names in the crew table link to profiles');
text = await visit('#/crew/u/ragavan', 600);
assert.ok($('.yo-hero') && /ragavan/i.test($('.yo-hero').textContent), 'hero'); assert.ok($('#yo-open .yo-ticket[data-bet="mir1"]'), 'their open ticket'); assert.match($('#yo-open').textContent, /HOM to win/);
for (const id of ['record', 'profit', 'streak', 'peak', 'biggest', 'loss', 'longshot', 'parlay']) assert.ok($(`.yo-tile[data-tile="${id}"]`), 'tile ' + id);
assert.match($('.yo-tile[data-tile="peak"]').textContent, /1,000/); assert.match($('.yo-tile[data-tile="streak"]').textContent, /3/);
assert.ok($('#yo-trophies') && $('#yo-teams') && $('#yo-style') && $('#yo-vs') && $('#yo-crew'), 'every section'); assert.ok($('#yo-crew a[href^="#/duels/vs/"]'), 'challenge button');
ok('a crew profile shows hero, open tickets, numbers, teams, trophies and a head to head');
$('#yo-open .mirror').click(); await sleep(200);
assert.equal(store.getState().slip.legs.length, 1); assert.equal(store.getState().slip.legs[0].key, 'g1|ml|home'); ok('mirror works from the profile page');
store.clearSlip();
text = await visit('#/crew/u/nobody', 400); assert.match(text, /Not in your crew/); ok('an unknown handle says so');
text = await visit('#/you', 300);
assert.ok($('.yo-hero') && $('#yo-numbers') && $('#yo-links') && !$('#yo-vs'), 'your own page'); assert.ok($('#yo-links a[href="#/coins"]'), 'coin log link'); ok('the You page shows your own numbers and shortcuts');
store.update((s) => { s.shareBets = false; });
await soc.syncNow(); await sleep(100);
// the wall
text = await visit('#/crew', 500); await tab('wall');
$('.wall-in').value = 'who has the Knicks tonight'; $('.crew-wall .wall-form .btn.main').click(); await sleep(600);
assert.match($('.wall-list').textContent, /Knicks tonight/); ok('posting on the wall shows the post');
$('.wall-post .btn.like').click(); await sleep(400);
assert.match($('.wall-post .btn.like').textContent, /1/); ok('cheering a post counts it');
$('.wall-post .btn.danger').click(); await sleep(400);
assert.ok(!$('.wall-post'), 'deleted'); ok('you can delete your own post');
await tab('table'); assert.match($('.crew-awards').textContent, /Hottest streak/); ok('awards card shows the streak leader');
const th = $('.crew-table th [data-sort="streak"]'); th.click(); assert.ok($('.crew-table th [data-sort="streak"].on'), 'sorted'); ok('tapping a column re-ranks the table');

text = await visit('#/crew', 300);
assert.ok($('.crew-table tr.me')); assert.ok(!byText('button', /Make an invite link/), 'only the owner sees owner tools'); ok('a non-owner sees the table but no owner tools');

await soc.logout();
text = await visit('#/crew', 200);
assert.ok($('#f-handle2') || byText('button', /Sign in/)); ok('signed out: sign-in form');

assert.deepEqual(errors, [], 'no script errors: ' + errors.map((e) => (e && e.stack) || e).join('\n'));
console.log(`${n} social screen checks passed`);
db.drop();
process.exit(process.exitCode || 0);
