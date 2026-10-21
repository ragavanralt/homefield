// Runs the app's own client code (js/social.js) against the real server code on Postgres, with fetch standing in for the network.
// This is what catches a mismatch between what the app sends and what the database expects.
import assert from 'node:assert/strict';
import * as PG from './pg.mjs';

if (!PG.available()) { console.log('Client tests skipped (no Postgres found; set HF_PG to run them)'); process.exit(0); }

const mem = {};
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

const { SOCIAL } = await import('../js/social-config.js');
const soc = await import('../js/social.js');
const store = await import('../js/store.js');

SOCIAL.url = 'https://example.supabase.co'; SOCIAL.key = 'sb_publishable_test';

const db = PG.createDb();
db.applySchema(); db.at('2026-10-20 10:00-04');
const invite = db.one('select code from invites where owner limit 1');

let offline = false, lastReq = null;
globalThis.fetch = async (url, init) => {
  if (offline) throw new TypeError('network down');
  const fn = String(url).split('/rpc/')[1];
  const args = JSON.parse(init.body);
  lastReq = { fn, headers: init.headers };
  const r = db.rpc(fn, args, fn.startsWith('bot_') ? 'service_role' : 'anon');
  if (r && r.raised) return { ok: false, status: 400, json: async () => ({ message: r.error }) };
  return { ok: true, status: 200, json: async () => r };
};

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e.message); process.exitCode = 1; } };
const fails = async (p, code) => { try { await p; } catch (e) { assert.equal(e.code, code, `got ${e.code}: ${e.message}`); return; } assert.fail('expected ' + code); };
const coins = () => store.getBank().coins;

await t('the client is off until configured and reports not signed in', async () => {
  assert.equal(soc.enabled(), true); assert.equal(soc.signedIn(), false);
  await fails(soc.crew(), 'not_signed_in');
});

let ownerCode, broCode, ownerInvite;
await t('signup returns a recovery code once; headers carry the version and key (sb_ keys skip authorization)', async () => {
  const r = await soc.signup(invite, 'Ragavan', 'Rag');
  ownerCode = r.code;
  assert.match(r.code, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  assert.equal(soc.me().handle, 'ragavan'); assert.equal(soc.me().owner, true);
  assert.equal(lastReq.headers['x-client-info'], 'homefield/1'); assert.equal(lastReq.headers.apikey, SOCIAL.key); assert.equal(lastReq.headers.authorization, undefined);
});
await t('a used or bad invite and a taken handle give plain errors', async () => {
  await soc.logout();
  await fails(soc.signup(invite, 'bro'), 'bad_invite');
  await soc.login('ragavan', ownerCode);
  ownerInvite = (await soc.makeInvite(1, 14)).code;
  assert.match(ownerInvite, /^HF/);
  await soc.logout();
  await fails(soc.signup(ownerInvite, 'Ragavan'), 'handle_taken');
  assert.match(new soc.SocialError('handle_taken').message, /already/);
});
await t('a second person joins from the invite link; the crew sees both', async () => {
  const r = await soc.signup(ownerInvite, 'bro', 'Bro'); broCode = r.code;
  const c = await soc.crew();
  assert.deepEqual(c.members.map((m) => m.handle).sort(), ['bro', 'ragavan']);
  assert.equal(c.members.find((m) => m.handle === 'bro').me, true);
  await fails(soc.makeInvite(), 'owner_only');
});
await t('sign in on another device with the recovery code; wrong code fails', async () => {
  await soc.logout();
  await fails(soc.login('bro', 'AAAA-AAAA-AAAA-AAAA'), 'bad_login');
  await soc.login('bro', broCode.toLowerCase().replace(/-/g, ' '));
  assert.equal(soc.me().handle, 'bro');
});

/* ---- device sync ---- */
await t('fan data follows you to another device and merges instead of overwriting', async () => {
  store.update((s) => { s.teams = [{ league: 'nba', id: '13', abbr: 'LAL', name: 'Lakers', short: 'Lakers' }]; s.avatar.owned.push('ghost'); s.bank.xp = 300; s.bank.coins = 1234; });
  await soc.syncNow();
  const remote = db.rpc('hf_sync_get', { p_token: soc._state().token });
  assert.equal(remote.data.teams[0].abbr, 'LAL'); assert.equal(remote.data.bank.coins, 1234);
  const pub = db.one("select (team ->> 'abbr') from profiles where handle = 'bro'");
  assert.equal(pub, 'LAL');
  // "new device": wipe local, sign in, pull
  store.update((s) => { s.teams = []; s.avatar.owned = ['short']; s.bank.coins = 1000; s.bank.xp = 0; });
  await soc.logout(); soc._reset();
  await soc.login('bro', broCode);
  assert.equal(store.getState().teams[0].abbr, 'LAL'); assert.equal(coins(), 1234);
  assert.ok(store.getState().avatar.owned.includes('ghost'));
});
await t('mergeFan unions teams, bets and owned items; settled bets beat pending ones', () => {
  const a = { teams: [{ league: 'nba', id: '1' }], bets: { x: { status: 'pending' }, y: { status: 'won' } }, bank: { xp: 5, coins: 10 }, avatar: { owned: ['a'] } };
  const b = { teams: [{ league: 'nba', id: '1' }, { league: 'nhl', id: '2' }], bets: { x: { status: 'lost' }, z: { status: 'pending' } }, bank: { xp: 9, coins: 99 }, avatar: { owned: ['b'] } };
  const m = soc.mergeFan(a, b);
  assert.equal(m.teams.length, 2); assert.equal(m.bets.x.status, 'lost'); assert.equal(m.bets.y.status, 'won'); assert.ok(m.bets.z);
  assert.deepEqual(m.avatar.owned.sort(), ['a', 'b']); assert.equal(m.bank.coins, 99, 'more xp wins the bank');
});

await t('a deleted saved fit stays deleted when the other copy still has it', () => {
  const f = (id) => ({ id, name: id, eq: {} });
  const a = { teams: [{ league: 'nba', id: '1' }], bets: {}, bank: { xp: 5, coins: 10 }, avatar: { owned: [], fits: [f('keep')], gone: ['old'] } };
  const b = { teams: [{ league: 'nba', id: '1' }], bets: {}, bank: { xp: 5, coins: 10 }, avatar: { owned: [], fits: [f('keep'), f('old')] } };
  const m = soc.mergeFan(a, b);
  assert.deepEqual(m.avatar.fits.map((x) => x.id), ['keep']); assert.deepEqual(m.avatar.gone, ['old']);
  const m2 = soc.mergeFan(b, a); assert.deepEqual(m2.avatar.fits.map((x) => x.id), ['keep'], 'same either way');
});

await t('Daily Five cards say what actually happened and how far a live number is from the line', async () => {
  const live = await import('../js/cardlive.js');
  const player = { kind: 'player', line: 25.5, a: 'Over', b: 'Under', meta: { name: 'Scottie Barnes', label: 'Points' }, actual: 18, outcome: 'b' };
  assert.match(live.finalText(player), /Scottie Barnes: 18 Points · line 25.5 \(under by 7.5\)/);
  assert.match(live.finalText({ kind: 'winner', a: 'TOR', b: 'BOS', actual: -4 }), /BOS won by 4/);
  assert.match(live.finalText({ kind: 'total', line: 220.5, title: 'x total points', actual: 231 }), /231 pts · line 220.5 \(over by 10.5\)/);
  const p = live.progress({ ...player, mine: 'a' }, { state: 'in', now: 18, detail: 'Q3 4:12' });
  assert.equal(p.pct, 71); assert.equal(p.over, false); assert.match(p.lead, /8 more for the over/); assert.equal(live.looking({ mine: 'a' }, p), false); assert.equal(live.looking({ mine: 'b' }, p), true);
  assert.equal(live.progress(player, { state: 'pre' }), null);
});

/* ---- duels and the coin ledger ---- */
const g = { league: 'nba', game_id: '9001', start_at: '2026-10-20T19:00:00-04:00', home: { id: 'h1', name: 'Home', abbr: 'HOM' }, away: { id: 'a1', name: 'Away', abbr: 'AWY' }, fav_team: 'h1', fav_prob: 0.6, ou: 220.5, home_spread: -4.5 };
const base = { league: 'nba', game_id: '9001' };
const cards = [
  { ...base, kind: 'winner', subject: 'game', title: 'AWY at HOM', a: 'HOM', b: 'AWY', line: null },
  { ...base, kind: 'total', subject: 'game', title: 'Total', a: 'Over', b: 'Under', line: 220.5 },
  { ...base, kind: 'team_total', subject: 'home', title: 'HOM pts', a: 'Over', b: 'Under', line: 112.5 },
  { ...base, kind: 'team_total', subject: 'away', title: 'AWY pts', a: 'Over', b: 'Under', line: 108.5 },
];
db.rpc('bot_publish', { p_games: [g], p_cards: cards, p_cap: [] }, 'service_role');

let duelId;
await t('creating a duel takes the stake first, then the server records it once', async () => {
  store.update((s) => { s.bank.coins = 1000; });
  const sl = await soc.slate();
  assert.equal(sl.games[0].key, 'nba:9001'); assert.equal(sl.games[0].cards, 4);
  const r = await soc.duelCreate({ length: 'game', stake: 50, game: 'nba:9001' });
  duelId = r.duel.id;
  assert.equal(coins(), 950); assert.equal(soc.pendingOps().length, 0);
  assert.equal(r.duel.cards.length, 3); assert.equal(r.duel.status, 'open');
  for (const c of r.duel.cards) assert.equal((await soc.duelPick(duelId, c.id, 'b')).duel.cards.find((x) => x.id === c.id).mine, 'b');
});
await t('a rejected create gives the stake straight back', async () => {
  await fails(soc.duelCreate({ length: 'game', stake: 5, game: 'nba:9001' }), 'bad_stake');
  assert.equal(coins(), 950);
  await fails(soc.duelCreate({ length: 'game', stake: 50, game: 'nba:nope' }), 'no_such_game');
  assert.equal(coins(), 950); assert.equal(soc.pendingOps().length, 0);
});
await t('not enough coins is stopped on the device before any call', async () => {
  const before = lastReq;
  store.update((s) => { s.bank.coins = 20; });
  await fails(soc.duelCreate({ length: 'game', stake: 50, game: 'nba:9001' }), 'no_coins');
  assert.equal(lastReq, before); assert.equal(coins(), 20);
  store.update((s) => { s.bank.coins = 950; });
});
await t('lost connection: coins stay held, and reconcile gives them back if the server never saw the op', async () => {
  offline = true;
  await fails(soc.duelCreate({ length: 'game', stake: 50, game: 'nba:9001' }), 'offline');
  offline = false;
  assert.equal(coins(), 900); assert.equal(soc.pendingOps().length, 1);
  assert.equal(await soc.reconcile(), 0, 'too new to judge');
  soc._state().pending[0].at -= 120000;
  assert.equal(await soc.reconcile(), 50); assert.equal(coins(), 950); assert.equal(soc.pendingOps().length, 0);
});
await t('lost answer: if the server did record the op, the coins stay spent', async () => {
  const op = soc.newOp();
  store.spendCoins(50); soc._state().pending.push({ op, amount: 50, kind: 'duel_create', at: Date.now() - 120000 });
  db.rpc('hf_duel_create', { p_token: soc._state().token, p_op: op, p_length: 'game', p_stake: 50, p_game: 'nba:9001' });
  assert.equal(await soc.reconcile(), 0); assert.equal(coins(), 900); assert.equal(soc.pendingOps().length, 0);
  store.update((s) => { s.bank.coins = 950; });
  const mine = await soc.duels();
  const extra = mine.mine.find((d) => d.id !== duelId); await soc.duelCancel(extra.id);
});
await t('the other player accepts, picks, and cannot see picks before lock', async () => {
  await soc.logout(); await soc.login('ragavan', ownerCode);
  store.update((s) => { s.bank.coins = 1000; });
  const open = await soc.duels();
  assert.equal(open.open.length, 1); assert.equal(open.open[0].id, duelId);
  const a = await soc.duelAccept(duelId, 50);
  assert.equal(coins(), 950); assert.equal(a.duel.status, 'active');
  for (const c of a.duel.cards) { assert.equal(c.theirs, null); assert.equal(c.their_made, true); await soc.duelPick(duelId, c.id, 'a'); }
  await fails(soc.duelAccept(duelId, 50), 'taken'); assert.equal(coins(), 950, 'refused accept returns the stake');
});
await t('after the game: winner collects pot minus 5% exactly once', async () => {
  db.at('2026-10-20 22:00-04');
  db.rpc('bot_results', { p_games: [{ league: 'nba', game_id: '9001', state: 'post', home_score: 120, away_score: 110 }], p_actuals: [] }, 'service_role');
  db.at('2026-10-20 22:40-04');
  db.rpc('bot_results', {}, 'service_role');
  const w = await soc.waiting();
  assert.equal(w.total, 95);
  const before = coins();
  const c1 = await soc.claim(); assert.equal(c1.total, 95); assert.equal(coins(), before + 95);
  const c2 = await soc.claim(); assert.equal(c2.total, 0); assert.equal(coins(), before + 95, 'no double pay');
  const d = (await soc.duel(duelId)).duel;
  assert.equal(d.status, 'settled'); assert.equal(d.winner, 'ragavan');
});

await t('changing your avatar or saving a fit backs it up on its own, and a second device then gets it', async () => {
  globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
  soc._setDelay(60); soc.startSocial();
  await new Promise((r) => setTimeout(r, 500));
  store.update((s) => { s.avatar.fits = [{ id: 'f1', name: 'Game day', eq: { top: 'tee' } }]; s.avatar.owned.push('crownitem'); });
  await new Promise((r) => setTimeout(r, 900));
  const remote = db.rpc('hf_sync_get', { p_token: soc._state().token });
  assert.equal(remote.data.avatar.fits[0].name, 'Game day'); assert.ok(remote.data.avatar.owned.includes('crownitem'));
  const ver = remote.ver;
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(db.rpc('hf_sync_get', { p_token: soc._state().token }).ver, ver, 'no endless sync loop');
  // another device: wipe locally, sign in, and it comes back
  store.update((s) => { s.avatar.fits = []; s.avatar.owned = ['short']; });
  await new Promise((r) => setTimeout(r, 300));
  await soc.logout(); soc._reset();
  const r = db.rpc('hf_login', { p_handle: 'ragavan', p_code: ownerCode }); assert.ok(r.token);
  await soc.login('ragavan', ownerCode);
  assert.equal(store.getState().avatar.fits.length, 1); assert.ok(store.getState().avatar.owned.includes('crownitem'));
});

console.log(`${passed} client checks passed`);
db.drop();
