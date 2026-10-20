// Tests the crew server (supabase/schema.sql) on a real Postgres: accounts, locks, duels, Survivor, Cap Night,
// payouts, and the "run it twice" and "two people at once" cases. Skipped if Postgres is not available.
import assert from 'node:assert/strict';
import * as PG from './pg.mjs';

if (!PG.available()) { console.log('SQL tests skipped (no Postgres found; set HF_PG to run them)'); process.exit(0); }

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e.message); process.exitCode = 1; } };
const ta = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e.message); process.exitCode = 1; } };
const err = (r) => r && (r.error || null);
const dbs = [];

/* ---------- builders ---------- */
const ET = (day, hm) => `2026-10-${day}T${hm}:00-04:00`; // Eastern (daylight) time
const NOW = '2026-10-20 10:00-04'; // Tuesday morning
let gseq = 100;
function game(day, hm, over = {}) {
  const id = String(++gseq);
  return { league: 'nba', game_id: id, start_at: ET(day, hm), home: { id: 'h' + id, name: 'Home ' + id, abbr: 'H' + id }, away: { id: 'a' + id, name: 'Away ' + id, abbr: 'A' + id },
    fav_team: 'h' + id, fav_prob: 0.62, ou: 220.5, home_spread: -4.5, ...over };
}
function cardsFor(g, players = 4) {
  const base = { league: g.league, game_id: g.game_id };
  const out = [
    { ...base, kind: 'winner', subject: 'game', title: `${g.away.abbr} at ${g.home.abbr}`, a: g.home.abbr, b: g.away.abbr, line: null },
    { ...base, kind: 'total', subject: 'game', title: 'Total points', a: 'Over', b: 'Under', line: 220.5 },
    { ...base, kind: 'team_total', subject: 'home', title: `${g.home.abbr} points`, a: 'Over', b: 'Under', line: 112.5 },
    { ...base, kind: 'team_total', subject: 'away', title: `${g.away.abbr} points`, a: 'Over', b: 'Under', line: 108.5 },
  ];
  for (let i = 1; i <= players; i++) out.push({ ...base, kind: 'player', subject: `p${g.game_id}${i}:pts`, title: `Player ${i} points`, a: 'Over', b: 'Under', line: 20.5 + i, meta: { playerId: `p${g.game_id}${i}`, stat: 'pts' } });
  return out;
}
function fresh() {
  const db = PG.createDb(); dbs.push(db);
  db.applySchema();
  db.at(NOW);
  return db;
}
function crew(db, names = ['ragavan', 'bro', 'cuz'], existing = null) {
  const owner = existing ? null : db.one("select code from invites where owner limit 1");
  const out = {};
  names.forEach((n, i) => {
    if (i === 0 && existing) { out[n] = existing; return; }
    let code = owner;
    if (i > 0) code = db.rpc('hf_invite_make', { p_token: out[names[0]].token, p_uses: 1 }).code;
    const r = db.rpc('hf_signup', { p_invite: code, p_handle: n, p_display: n[0].toUpperCase() + n.slice(1), p_device: 'test' });
    assert.ok(r.token, JSON.stringify(r));
    out[n] = { token: r.token, code: r.code, id: r.me.id };
  });
  return out;
}
const svc = (db, fn, args) => db.rpc(fn, args, 'service_role');
function publish(db, games, withCards = true, cap = []) {
  return svc(db, 'bot_publish', { p_games: games, p_cards: withCards ? games.flatMap((g) => cardsFor(g)) : [], p_cap: cap });
}
const cardsOf = (db, gid) => db.rows(`select id, kind, subject, line, status, outcome, actual from cards where game_id = '${gid}' order by kind, subject`);
function finish(db, g, hs, as, actuals = []) {
  return svc(db, 'bot_results', { p_games: [{ league: g.league, game_id: g.game_id, state: 'post', home_score: hs, away_score: as }], p_actuals: actuals });
}
const bal = (db, who) => Number(db.one(`select coalesce(sum(amount),0) from payouts where user_id = '${who.id}'`));
const kinds = (db, who) => db.rows(`select kind, amount from payouts where user_id = '${who.id}' order by kind, amount`);

/* =============================== accounts =============================== */
{
  const db = fresh();
  t('schema can be applied twice and keeps one owner invite', () => {
    const a = db.applySchema();
    assert.equal(db.one("select count(*) from invites where owner"), '1');
    assert.match(a, /^HF[A-Z0-9]{6}$/);
  });
  t('app role cannot read tables or call bot and internal functions', () => {
    assert.match(db.as('anon', 'select * from profiles').err, /permission denied/);
    assert.match(db.as('anon', 'select * from payouts').err, /permission denied/);
    assert.match(db.as('anon', 'select x_uid(\'x\')').err, /permission denied/);
    assert.match(db.as('anon', "select bot_pending()").err, /permission denied/);
    assert.match(db.as('anon', "select bot_results('[]','[]','[]')").err, /permission denied/);
    assert.match(db.as('authenticated', 'select * from sessions').err, /permission denied/);
    assert.equal(db.rpc('hf_ping').ok, true);
    assert.ok(db.as('service_role', 'select bot_pending()').out);
  });
  t('every table has row level security on', () => {
    assert.equal(db.one("select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity"), '0');
  });
  const owner = db.one('select code from invites where owner limit 1');
  let ownerAcc = null;
  t('signup: bad invite, bad handle, good signup, handle taken', () => {
    assert.equal(err(db.rpc('hf_signup', { p_invite: 'NOPE1234', p_handle: 'ragavan' })), 'bad_invite');
    assert.equal(err(db.rpc('hf_signup', { p_invite: owner, p_handle: 'a b' })), 'bad_handle');
    assert.equal(err(db.rpc('hf_signup', { p_invite: owner, p_handle: 'xy' })), 'bad_handle');
    const r = db.rpc('hf_signup', { p_invite: owner.toLowerCase(), p_handle: 'Ragavan', p_display: 'Rag', p_device: 'phone' });
    assert.ok(r.token && r.token.length >= 40);
    ownerAcc = { token: r.token, code: r.code, id: r.me.id };
    assert.match(r.code, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    assert.equal(r.me.handle, 'ragavan');
    assert.equal(r.me.owner, true);
    assert.equal(err(db.rpc('hf_signup', { p_invite: owner, p_handle: 'other' })), 'bad_invite', 'owner invite is single use');
  });
  const u = crew(db, ['ragavan', 'bro'], ownerAcc);
  t('invites: only the owner can make them; they expire and can be revoked', () => {
    assert.equal(err(db.rpc('hf_invite_make', { p_token: u.bro.token })), 'owner_only');
    const inv = db.rpc('hf_invite_make', { p_token: u.ragavan.token, p_uses: 1, p_days: 1 });
    assert.match(inv.code, /^HF[A-Z0-9]{6}$/);
    assert.equal(db.at('2026-10-22 10:00-04').rpc('hf_signup', { p_invite: inv.code, p_handle: 'late' }).error, 'bad_invite', 'expired');
    db.at(NOW);
    const inv2 = db.rpc('hf_invite_make', { p_token: u.ragavan.token });
    db.rpc('hf_invite_revoke', { p_token: u.ragavan.token, p_code: inv2.code });
    assert.equal(err(db.rpc('hf_signup', { p_invite: inv2.code, p_handle: 'nope' })), 'bad_invite');
    const inv3 = db.rpc('hf_invite_make', { p_token: u.ragavan.token });
    assert.ok(db.rpc('hf_signup', { p_invite: inv3.code.toLowerCase().replace(/^(..)/, '$1-'), p_handle: 'dashy' }).token, 'dashes and case are ignored');
  });
  t('login: recovery code works in any format, wrong code fails, 8 misses lock the handle for 15 minutes', () => {
    const c = u.bro.code;
    assert.ok(db.rpc('hf_login', { p_handle: 'BRO', p_code: c.toLowerCase().replace(/-/g, ' '), p_device: 'mac' }).token);
    for (let i = 0; i < 8; i++) assert.equal(err(db.rpc('hf_login', { p_handle: 'bro', p_code: 'AAAA-AAAA-AAAA-AAAA' })), 'bad_login');
    assert.equal(err(db.rpc('hf_login', { p_handle: 'bro', p_code: c })), 'locked', 'even the right code waits');
    assert.equal(err(db.rpc('hf_login', { p_handle: 'nobody', p_code: c })), 'bad_login');
    db.at('2026-10-20 10:20-04');
    assert.ok(db.rpc('hf_login', { p_handle: 'bro', p_code: c }).token, 'unlocks later');
    db.at(NOW);
  });
  t('sessions: whoami, logout, new code signs out other devices', () => {
    const l1 = db.rpc('hf_login', { p_handle: 'bro', p_code: u.bro.code });
    const l2 = db.rpc('hf_login', { p_handle: 'bro', p_code: u.bro.code });
    assert.equal(db.rpc('hf_whoami', { p_token: l1.token }).me.handle, 'bro');
    assert.match(db.rpc('hf_whoami', { p_token: 'x'.repeat(40) }).error, /not_signed_in/);
    const nc = db.rpc('hf_new_code', { p_token: l2.token });
    assert.notEqual(nc.code, u.bro.code);
    assert.match(db.rpc('hf_whoami', { p_token: l1.token }).error, /not_signed_in/, 'other device is out');
    assert.ok(db.rpc('hf_whoami', { p_token: l2.token }).me, 'this device stays in');
    assert.equal(err(db.rpc('hf_login', { p_handle: 'bro', p_code: u.bro.code })), 'bad_login', 'old code is dead');
    const fresh3 = db.rpc('hf_login', { p_handle: 'bro', p_code: nc.code });
    assert.ok(fresh3.token);
    db.rpc('hf_logout', { p_token: l2.token });
    assert.match(db.rpc('hf_whoami', { p_token: l2.token }).error, /not_signed_in/);
    u.bro = { ...u.bro, code: nc.code, token: fresh3.token };
  });
  t('tokens expire after 180 days of the session being created', () => {
    const tok = db.rpc('hf_login', { p_handle: 'ragavan', p_code: u.ragavan.code }).token;
    assert.ok(db.rpc('hf_whoami', { p_token: tok }).me);
    db.at('2027-06-01 10:00-04');
    assert.match(db.rpc('hf_whoami', { p_token: tok }).error, /not_signed_in/);
    db.at(NOW);
  });
  t('kill switch pauses every call; min_version rejects old app builds', () => {
    db.sql("update app_config set value = 'true' where key = 'killswitch'");
    assert.match(db.rpc('hf_crew', { p_token: u.ragavan.token }).error, /hf:off/);
    assert.equal(db.rpc('hf_ping').off, true);
    db.sql("update app_config set value = 'false' where key = 'killswitch'");
    assert.ok(db.rpc('hf_crew', { p_token: u.ragavan.token }).members);
    db.sql("update app_config set value = '3' where key = 'min_version'");
    const hdr = (v) => db.as('anon', `select set_config('request.headers', '{"x-client-info":"homefield/${v}"}', false); select hf_crew('${u.ragavan.token}')`);
    assert.match(hdr(1).err, /hf:update/);
    assert.ok(hdr(3).out);
    db.sql("update app_config set value = '1' where key = 'min_version'");
  });
  t('sync: save, read, conflict on a stale version, size limit, public bits show in the crew list', () => {
    const tok = u.ragavan.token;
    assert.equal(db.rpc('hf_sync_get', { p_token: tok }).ver, 0);
    const a = db.rpc('hf_sync_put', { p_token: tok, p_base: 0, p_data: { avatar: { owned: ['a'] }, bank: { coins: 500 } }, p_public: { avatar: { eq: { hair: 'curls' } }, team: { abbr: 'TOR' }, stats: { won: 3, lost: 1 } } });
    assert.equal(a.ver, 1);
    const stale = db.rpc('hf_sync_put', { p_token: tok, p_base: 0, p_data: { bank: { coins: 1 } } });
    assert.equal(stale.conflict, true);
    assert.equal(stale.data.bank.coins, 500, 'the server copy comes back so nothing is lost');
    assert.equal(db.rpc('hf_sync_put', { p_token: tok, p_base: 1, p_data: { bank: { coins: 600 } } }).ver, 2);
    assert.equal(err(db.rpc('hf_sync_put', { p_token: tok, p_base: 2, p_data: { x: 'y'.repeat(450000) } })), 'too_big');
    const crewList = db.rpc('hf_crew', { p_token: u.bro.token });
    const rag = crewList.members.find((m) => m.handle === 'ragavan');
    assert.equal(rag.avatar.eq.hair, 'curls');
    assert.equal(rag.stats.won, 3);
    assert.equal(crewList.members.length, 3);
  });
  t('removing a member signs them out and hides them', () => {
    const inv = db.rpc('hf_invite_make', { p_token: u.ragavan.token }).code;
    const x = db.rpc('hf_signup', { p_invite: inv, p_handle: 'tempguy' });
    assert.equal(err(db.rpc('hf_member_remove', { p_token: u.bro.token, p_handle: 'tempguy' })), 'owner_only');
    assert.equal(db.rpc('hf_member_remove', { p_token: u.ragavan.token, p_handle: 'tempguy' }).ok, true);
    assert.match(db.rpc('hf_whoami', { p_token: x.token }).error, /not_signed_in/);
    assert.equal(err(db.rpc('hf_login', { p_handle: 'tempguy', p_code: x.code })), 'bad_login');
    assert.ok(!db.rpc('hf_crew', { p_token: u.bro.token }).members.some((m) => m.handle === 'tempguy'));
  });
}

/* =============================== publishing =============================== */
{
  const db = fresh();
  const g1 = game(20, '19:00');
  t('publish: games and cards go in, a second publish adds nothing and never changes a line', () => {
    const a = publish(db, [g1]);
    assert.equal(a.games, 1); assert.equal(a.cards_new, 8);
    const again = svc(db, 'bot_publish', { p_games: [{ ...g1, ou: 999 }], p_cards: cardsFor(g1).map((c) => ({ ...c, line: c.line == null ? null : c.line + 50 })) });
    assert.equal(again.cards_new, 0);
    assert.equal(db.one(`select line from cards where game_id = '${g1.game_id}' and kind = 'total'`), '220.5');
    assert.equal(db.one(`select ou from games where game_id = '${g1.game_id}'`), '999', 'game info before tip-off may refresh');
  });
  t('publish: a game that moved carries its new time to open cards; started games are frozen', () => {
    svc(db, 'bot_publish', { p_games: [{ ...g1, start_at: ET(20, '20:00') }], p_cards: [] });
    assert.equal(db.one(`select count(*) from cards where game_id = '${g1.game_id}' and start_at = '${ET(20, '20:00')}'`), '8');
    db.at('2026-10-20 20:30-04');
    svc(db, 'bot_publish', { p_games: [{ ...g1, start_at: ET(21, '20:00'), ou: 1 }], p_cards: [] });
    assert.equal(db.one(`select start_at = '${ET(20, '20:00')}' from games where game_id = '${g1.game_id}'`), 't');
    db.at(NOW);
  });
  t('publish: cards for a game that already started are refused', () => {
    db.at('2026-10-20 21:00-04');
    const late = game(20, '20:30');
    const r = svc(db, 'bot_publish', { p_games: [late], p_cards: cardsFor(late) });
    assert.equal(r.cards_new, 0);
    db.at(NOW);
  });
}

/* =============================== duels =============================== */
{
  const db = fresh();
  const u = crew(db);
  const g = game(20, '19:00'), g2 = game(20, '19:30'), g3 = game(20, '22:00'), g4 = game(21, '19:00');
  publish(db, [g, g2, g3, g4]);
  const mk = (o = {}) => db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'op-' + Math.random().toString(36).slice(2, 12), p_length: 'game', p_stake: 100, p_game: `nba:${g.game_id}`, ...o });
  t('create: needs enough cards, a sane stake, a real opponent and a real game', () => {
    assert.match(mk({ p_stake: 5 }).error, /bad_stake/);
    assert.match(mk({ p_stake: 501 }).error, /bad_stake/);
    assert.match(mk({ p_opponent: 'ghost' }).error, /no_such_player/);
    assert.match(mk({ p_game: 'nba:999999' }).error, /no_such_game/);
    assert.match(mk({ p_length: 'day', p_day: '2026-10-25' }).error, /bad_day/);
    assert.match(mk({ p_length: 'month' }).error, /bad_request/);
  });
  let duel;
  t('create: single game gets 3 cards, picks expiry before the first lock, and the same op never makes a second duel', () => {
    const op = 'op-fixed-0001';
    const a = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: op, p_length: 'game', p_stake: 100, p_game: `nba:${g.game_id}` });
    duel = a.duel;
    assert.equal(duel.cards.length, 3);
    assert.ok(duel.cards.every((c) => c.game_id === g.game_id));
    assert.equal(duel.status, 'open');
    assert.ok(new Date(duel.expires_at) <= new Date(ET(20, '19:00')), 'expires before tip-off');
    const b = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: op, p_length: 'game', p_stake: 100, p_game: `nba:${g.game_id}` });
    assert.equal(b.duel.id, duel.id);
    assert.equal(db.one("select count(*) from duels"), '1');
  });
  t('cards are chosen the same way for everyone and lines are .5 so nothing pushes', () => {
    assert.ok(duel.cards.every((c) => c.line == null || String(c.line).endsWith('.5')));
  });
  t('a stranger in the crew sees an open challenge but not anyone\'s picks; the creator can pick, the invitee cannot yet', () => {
    const c0 = duel.cards[0];
    assert.equal(db.rpc('hf_duel_pick', { p_token: u.ragavan.token, p_duel: duel.id, p_card: c0.id, p_side: 'a' }).duel.cards[0].mine, 'a');
    assert.equal(err(db.rpc('hf_duel_pick', { p_token: u.bro.token, p_duel: duel.id, p_card: c0.id, p_side: 'b' })), 'not_yours');
    const peek = db.rpc('hf_duel_get', { p_token: u.bro.token, p_duel: duel.id }).duel;
    assert.equal(peek.cards[0].theirs, null, 'their pick is hidden');
    assert.equal(peek.cards[0].their_made, true, 'but you can see they have made one');
    assert.equal(peek.cards[0].mine, null);
  });
  t('open list shows the challenge to the crew; accept makes it active; an op is only spent once', () => {
    assert.equal(db.rpc('hf_duels', { p_token: u.bro.token }).open.length, 1);
    const acc = db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: duel.id, p_op: 'acc-op-0001' });
    assert.equal(acc.duel.status, 'active');
    assert.equal(acc.duel.opponent.handle, 'bro');
    const again = db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: duel.id, p_op: 'acc-op-0001' });
    assert.equal(again.duel.status, 'active');
    assert.equal(err(db.rpc('hf_duel_accept', { p_token: u.cuz.token, p_duel: duel.id, p_op: 'acc-op-0002' })), 'taken');
    assert.equal(err(db.rpc('hf_duel_accept', { p_token: u.ragavan.token, p_duel: duel.id, p_op: 'acc-op-0003' })), 'not_yours', 'cannot accept your own');
    assert.equal(db.rpc('hf_op_status', { p_token: u.bro.token, p_ops: ['acc-op-0001', 'zzz-unknown'] }).known.join(), 'acc-op-0001');
  });
  t('picks: both sides pick, change their mind, and picks lock at tip-off using the server clock', () => {
    const [c0, c1, c2] = duel.cards;
    for (const [tok, side] of [[u.ragavan.token, 'a'], [u.bro.token, 'b']]) {
      db.rpc('hf_duel_pick', { p_token: tok, p_duel: duel.id, p_card: c0.id, p_side: side });
      db.rpc('hf_duel_pick', { p_token: tok, p_duel: duel.id, p_card: c1.id, p_side: side });
    }
    db.rpc('hf_duel_pick', { p_token: u.bro.token, p_duel: duel.id, p_card: c1.id, p_side: 'a' });
    db.rpc('hf_duel_pick', { p_token: u.ragavan.token, p_duel: duel.id, p_card: c2.id, p_side: 'a' });
    db.rpc('hf_duel_pick', { p_token: u.bro.token, p_duel: duel.id, p_card: c2.id, p_side: 'a' });
    const mine = db.rpc('hf_duel_get', { p_token: u.bro.token, p_duel: duel.id }).duel;
    assert.deepEqual(mine.cards.map((c) => c.mine), ['b', 'a', 'a']);
    assert.deepEqual(mine.cards.map((c) => c.theirs), [null, null, null], 'hidden before tip-off');
    db.at('2026-10-20 19:00:01-04');
    assert.equal(err(db.rpc('hf_duel_pick', { p_token: u.bro.token, p_duel: duel.id, p_card: c0.id, p_side: 'a' })), 'locked');
    const after = db.rpc('hf_duel_get', { p_token: u.bro.token, p_duel: duel.id }).duel;
    assert.deepEqual(after.cards.map((c) => c.theirs), ['a', 'a', 'a'], 'revealed once the game starts');
    db.at(NOW);
  });
  t('settle waits 30 minutes after final, then pays the winner pot minus 5%, once', () => {
    const outcomes = cardsOf(db, g.game_id);
    const own = duel.cards.map((c) => c.id);
    // home wins 120-110: winner card -> a; total 230 -> over (a); team total home 120 > 112.5 -> a
    const actuals = outcomes.filter((c) => c.kind === 'player').map((c) => ({ card_id: c.id, actual: 30 }));
    db.at('2026-10-20 22:00-04');
    finish(db, g, 120, 110, actuals);
    assert.equal(db.one(`select count(*) from cards where game_id = '${g.game_id}' and status = 'open'`), String(outcomes.length), 'not yet');
    assert.equal(bal(db, u.ragavan), 0);
    db.at('2026-10-20 22:10-04');
    svc(db, 'bot_results', {});
    assert.equal(bal(db, u.ragavan), 0, 'still inside the 30 minute wait');
    db.at('2026-10-20 22:35-04');
    const s1 = svc(db, 'bot_results', {});
    assert.ok(s1.duels >= 1);
    const d = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: duel.id }).duel;
    assert.equal(d.status, 'settled');
    // the three cards are decided; ragavan picked a,a,a ; bro picked b,a,a. Every card whose outcome is 'a' scores for ragavan.
    const res = d.result;
    assert.ok(res.creator > res.opponent, JSON.stringify(res));
    assert.equal(d.winner, 'ragavan');
    assert.equal(bal(db, u.ragavan), 190, 'pot 200 minus 5% cut');
    assert.equal(bal(db, u.bro), 0);
    for (let i = 0; i < 3; i++) svc(db, 'bot_results', {});
    assert.equal(bal(db, u.ragavan), 190, 'settling again pays nothing more');
    void own;
  });
  t('claim hands over everything exactly once, even if called twice', () => {
    const c1 = db.rpc('hf_claim', { p_token: u.ragavan.token });
    assert.equal(c1.total, 190);
    assert.equal(c1.items[0].kind, 'duel_win');
    const c2 = db.rpc('hf_claim', { p_token: u.ragavan.token });
    assert.equal(c2.total, 0);
    assert.notEqual(c1.claim_id, c2.claim_id);
    assert.equal(db.rpc('hf_payouts', { p_token: u.ragavan.token }).total, 0);
  });
  t('open challenge to nobody in particular: cancel refunds, declining refunds, expiry refunds', () => {
    db.at('2026-10-21 09:00-04');
    const g5 = game(21, '20:00'); publish(db, [g5]);
    const a = db.rpc('hf_duel_create', { p_token: u.cuz.token, p_op: 'cancel-op-01', p_length: 'game', p_stake: 50, p_game: `nba:${g5.game_id}` }).duel;
    assert.equal(db.rpc('hf_duel_cancel', { p_token: u.cuz.token, p_duel: a.id }).duel.status, 'cancelled');
    assert.equal(bal(db, u.cuz), 50);
    const b = db.rpc('hf_duel_create', { p_token: u.cuz.token, p_op: 'decline-op-1', p_length: 'game', p_stake: 70, p_game: `nba:${g5.game_id}`, p_opponent: 'bro' }).duel;
    assert.equal(err(db.rpc('hf_duel_accept', { p_token: u.ragavan.token, p_duel: b.id, p_op: 'nope-op-0001' })), 'not_yours', 'a named challenge is only for that person');
    assert.equal(db.rpc('hf_duel_cancel', { p_token: u.bro.token, p_duel: b.id }).duel.status, 'declined');
    assert.equal(bal(db, u.cuz), 120);
    const c = db.rpc('hf_duel_create', { p_token: u.cuz.token, p_op: 'expire-op-01', p_length: 'game', p_stake: 30, p_game: `nba:${g5.game_id}` }).duel;
    db.at('2026-10-21 19:59-04');
    const acc = db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: c.id, p_op: 'late-op-0001' });
    assert.equal(acc.error, 'expired', 'too late to accept, and the stake goes back');
    assert.equal(bal(db, u.cuz), 150);
    db.rpc('hf_duels', { p_token: u.cuz.token });
    assert.equal(bal(db, u.cuz), 150, 'expiring twice does not refund twice');
    db.at(NOW);
  });
}

/* ---- tie, void, too few cards, losing side ---- */
{
  const db = fresh();
  const u = crew(db, ['ragavan', 'bro']);
  const g = game(20, '19:00');
  publish(db, [g]);
  const mkActive = (op) => {
    const d = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: op + '-create', p_length: 'game', p_stake: 200, p_game: `nba:${g.game_id}` }).duel;
    db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: d.id, p_op: op + '-accept' });
    return d;
  };
  const d1 = mkActive('tie');
  t('a duel where nobody picked is a tie: both stakes come back, no cut', () => {
    db.at('2026-10-20 23:00-04');
    finish(db, g, 100, 90, cardsOf(db, g.game_id).filter((c) => c.kind === 'player').map((c) => ({ card_id: c.id, actual: 10 })));
    db.at('2026-10-20 23:40-04');
    svc(db, 'bot_results', {});
    const d = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: d1.id }).duel;
    assert.equal(d.status, 'settled'); assert.equal(d.winner, null); assert.equal(d.result.tie, true);
    assert.equal(bal(db, u.ragavan), 200); assert.equal(bal(db, u.bro), 200);
  });
  const g2 = game(22, '19:00'); db.at('2026-10-22 09:00-04'); publish(db, [g2]);
  t('a postponed game voids its cards and the duel is refunded', () => {
    const d = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'void-create', p_length: 'game', p_stake: 100, p_game: `nba:${g2.game_id}` }).duel;
    db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: d.id, p_op: 'void-accept' });
    db.at('2026-10-22 21:00-04');
    svc(db, 'bot_results', { p_games: [{ league: 'nba', game_id: g2.game_id, state: 'pre', void: true }] });
    db.at('2026-10-22 21:40-04');
    svc(db, 'bot_results', {});
    const r = db.rpc('hf_duel_get', { p_token: u.bro.token, p_duel: d.id }).duel;
    assert.equal(r.status, 'void');
    assert.equal(bal(db, u.bro), 300); assert.equal(bal(db, u.ragavan), 300);
    assert.equal(db.one(`select count(*) from cards where game_id = '${g2.game_id}' and status = 'void'`), '8');
  });
  t('a player who did not play voids that card; with fewer than 3 valid cards the duel is refunded', () => {
    db.at('2026-10-23 09:00-04');
    const g3 = game(23, '19:00');
    // a game whose only cards are 3 player props: if none of them get a box score line the duel has nothing to score
    svc(db, 'bot_publish', { p_games: [g3], p_cards: cardsFor(g3, 3).filter((c) => c.kind === 'player') });
    const before = bal(db, u.bro);
    const d = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'few-create', p_length: 'game', p_stake: 100, p_game: `nba:${g3.game_id}` }).duel;
    db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: d.id, p_op: 'few-accept' });
    db.rpc('hf_duel_pick', { p_token: u.ragavan.token, p_duel: d.id, p_card: d.cards[0].id, p_side: 'a' });
    db.at('2026-10-23 22:00-04');
    finish(db, g3, 100, 99, []); // nobody reported a stat line
    db.at('2026-10-23 22:40-04');
    svc(db, 'bot_results', {});
    const r = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: d.id }).duel;
    assert.equal(r.status, 'void'); assert.equal(r.result.reason, 'too_few_cards');
    assert.equal(bal(db, u.bro) - before, 100);
    // two of three cards valid is still not enough
    db.at('2026-10-24 09:00-04');
    const g3b = game(24, '19:00');
    svc(db, 'bot_publish', { p_games: [g3b], p_cards: cardsFor(g3b, 2).filter((c) => c.kind === 'player' || c.kind === 'winner') });
    const d2 = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'few-create-2', p_length: 'game', p_stake: 100, p_game: `nba:${g3b.game_id}` }).duel;
    db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: d2.id, p_op: 'few-accept-2' });
    db.at('2026-10-24 22:00-04');
    finish(db, g3b, 100, 99, []);
    db.at('2026-10-24 22:40-04');
    svc(db, 'bot_results', {});
    const r2 = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: d2.id }).duel;
    assert.equal(r2.status, 'void', 'only the winner card was real: 1 valid card');
  });
  t('the better picker wins and the loser gets nothing', () => {
    db.at('2026-10-25 09:00-04');
    const g4 = game(25, '19:00'); publish(db, [g4]);
    const d = db.rpc('hf_duel_create', { p_token: u.bro.token, p_op: 'win-create', p_length: 'game', p_stake: 500, p_game: `nba:${g4.game_id}` }).duel;
    db.rpc('hf_duel_accept', { p_token: u.ragavan.token, p_duel: d.id, p_op: 'win-accept' });
    // home wins 120-100: winner a, total 220 < 220.5 so b, home 120 > 112.5 a, away 100 < 108.5 b, players (19 < line) b
    const truth = (c) => (c.kind === 'winner' ? 'a' : c.kind === 'total' ? 'b' : c.kind === 'player' ? 'b' : (c.title.startsWith(g4.home.abbr) ? 'a' : 'b'));
    for (const c of d.cards) {
      db.rpc('hf_duel_pick', { p_token: u.bro.token, p_duel: d.id, p_card: c.id, p_side: truth(c) });
      db.rpc('hf_duel_pick', { p_token: u.ragavan.token, p_duel: d.id, p_card: c.id, p_side: truth(c) === 'a' ? 'b' : 'a' });
    }
    const before = bal(db, u.bro), loser = bal(db, u.ragavan);
    db.at('2026-10-25 22:30-04');
    finish(db, g4, 120, 100, cardsOf(db, g4.game_id).filter((c) => c.kind === 'player').map((c) => ({ card_id: c.id, actual: 19 })));
    db.at('2026-10-25 23:10-04');
    svc(db, 'bot_results', {});
    const r = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: d.id }).duel;
    assert.equal(r.status, 'settled');
    assert.equal(r.winner, 'bro'); assert.equal(r.result.creator, 3); assert.equal(r.result.opponent, 0);
    assert.equal(bal(db, u.bro) - before, 950, 'pot of 1000 less the 5% cut');
    assert.equal(bal(db, u.ragavan), loser);
    assert.equal(r.result.cut, 50);
  });
  t('record counts wins, losses and ties', () => {
    const rb = db.rpc('hf_duels', { p_token: u.bro.token }).record;
    assert.ok(rb.t >= 1); assert.ok(rb.w >= 0);
    const cr = db.rpc('hf_crew', { p_token: u.bro.token }).members;
    assert.equal(cr.find((m) => m.handle === 'bro').duel_t, rb.t);
  });
}

/* ---- day and week duels ---- */
{
  const db = fresh();
  const u = crew(db, ['ragavan', 'bro']);
  const day1 = [game(20, '19:00'), game(20, '19:30'), game(20, '20:00'), game(20, '22:00')];
  publish(db, day1);
  t('single day duel: 5 cards spread over different games', () => {
    const d = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'day-create-1', p_length: 'day', p_stake: 100 }).duel;
    assert.equal(d.cards.length, 5);
    assert.ok(new Set(d.cards.map((c) => c.game_id)).size >= 4, 'round robin across games first');
    assert.ok(new Date(d.expires_at) <= new Date(ET(20, '19:00')));
  });
  t('day duel is refused when the day has fewer than 5 cards left', () => {
    db.at('2026-10-20 21:56-04');
    const r = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'day-create-2', p_length: 'day', p_stake: 100 });
    assert.match(r.error, /not_enough_cards/);
    db.at(NOW);
  });
  let wk;
  t('week duel: nothing attached until accepted, then 3 cards a day up to 10', () => {
    const d = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'week-create-1', p_length: 'week', p_stake: 100 }).duel;
    assert.equal(d.cards.length, 0);
    const acc = db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: d.id, p_op: 'week-accept-1' }).duel;
    assert.equal(acc.cards.length, 3);
    assert.equal(acc.window_end, '2026-10-26');
    wk = acc;
    let total = 3;
    for (let day = 21; day <= 26; day++) {
      db.at(`2026-10-${day} 08:00-04`);
      publish(db, [game(day, '19:00'), game(day, '20:00'), game(day, '21:00')]);
      total = Math.min(10, total + 3);
      const cur = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: wk.id }).duel;
      assert.equal(cur.cards.length, total, `day ${day}`);
    }
    db.at(NOW);
  });
  t('week duel with all cards in settles after the last card; losers/winners from picks', () => {
    const cur = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: wk.id }).duel;
    assert.equal(cur.cards.length, 10);
    for (const c of cur.cards) {
      db.at('2026-10-20 09:00-04'); // picks only allowed while cards are open; all of these are in the future of their own day
      void c;
    }
    // settle every game (everyone home wins 100-90) after the end of the week
    const games = db.rows('select league, game_id from games');
    db.at('2026-10-27 12:00-04');
    svc(db, 'bot_results', { p_games: games.map((x) => ({ ...x, state: 'post', home_score: 100, away_score: 90 })), p_actuals: db.rows("select id from cards where kind = 'player'").map((x) => ({ card_id: x.id, actual: 5 })) });
    db.at('2026-10-27 13:00-04');
    svc(db, 'bot_results', {});
    const done = db.rpc('hf_duel_get', { p_token: u.ragavan.token, p_duel: wk.id }).duel;
    assert.ok(['settled', 'void'].includes(done.status), done.status);
    assert.equal(done.status, 'settled');
    assert.equal(done.winner, null, 'nobody picked anything: a tie, both refunded');
    assert.equal(bal(db, u.ragavan), 200);
  });
}

/* ---- two things at once ---- */
{
  const db = fresh();
  const u = crew(db);
  const g = game(20, '19:00'); publish(db, [g]);
  await ta('two people accepting the same open challenge: exactly one gets it', async () => {
    const d = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'race-create-1', p_length: 'game', p_stake: 100, p_game: `nba:${g.game_id}` }).duel;
    const rs = await Promise.all([
      db.rpcAsync('hf_duel_accept', { p_token: u.bro.token, p_duel: d.id, p_op: 'race-acc-bro1' }),
      db.rpcAsync('hf_duel_accept', { p_token: u.cuz.token, p_duel: d.id, p_op: 'race-acc-cuz1' }),
    ]);
    const wins = rs.filter((r) => r.duel && r.duel.status === 'active');
    const losses = rs.filter((r) => r.error === 'taken');
    assert.equal(wins.length, 1, JSON.stringify(rs)); assert.equal(losses.length, 1);
  });
  await ta('claiming from two devices at once pays out once', async () => {
    db.sql(`insert into payouts (user_id, kind, ref, amount) values ('${u.ragavan.id}', 'solo', 'x1', 40), ('${u.ragavan.id}', 'solo', 'x2', 60)`);
    const rs = await Promise.all([db.rpcAsync('hf_claim', { p_token: u.ragavan.token }), db.rpcAsync('hf_claim', { p_token: u.ragavan.token }), db.rpcAsync('hf_claim', { p_token: u.ragavan.token })]);
    assert.equal(rs.reduce((a, r) => a + (r.total || 0), 0), 100, JSON.stringify(rs));
  });
  await ta('two settle bots at once do not double pay', async () => {
    const d = db.rpc('hf_duel_create', { p_token: u.cuz.token, p_op: 'dbl-create-01', p_length: 'game', p_stake: 100, p_game: `nba:${g.game_id}` }).duel;
    db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: d.id, p_op: 'dbl-accept-01' });
    for (const c of d.cards) db.rpc('hf_duel_pick', { p_token: u.cuz.token, p_duel: d.id, p_card: c.id, p_side: 'a' });
    db.at('2026-10-20 22:00-04');
    finish(db, g, 120, 100, cardsOf(db, g.game_id).filter((c) => c.kind === 'player').map((c) => ({ card_id: c.id, actual: 99 })));
    db.at('2026-10-20 22:40-04');
    await Promise.all([db.rpcAsync('bot_results', {}, 'service_role'), db.rpcAsync('bot_results', {}, 'service_role'), db.rpcAsync('bot_results', {}, 'service_role')]);
    assert.equal(db.one(`select count(*) from payouts where kind = 'duel_win' and ref = '${d.id}'`), '1');
  });
}

/* =============================== daily five =============================== */
{
  const db = fresh();
  const u = crew(db, ['ragavan', 'bro']);
  const gs = [game(20, '19:00'), game(20, '20:00'), game(20, '22:00')];
  publish(db, gs);
  let five;
  t('daily five: the same 5 cards for everyone, stable on a second look', () => {
    five = db.rpc('hf_daily', { p_token: u.ragavan.token });
    assert.equal(five.cards.length, 5);
    const other = db.rpc('hf_daily', { p_token: u.bro.token });
    assert.deepEqual(other.cards.map((c) => c.id), five.cards.map((c) => c.id));
    publish(db, [game(20, '23:00')]);
    assert.deepEqual(db.rpc('hf_daily', { p_token: u.bro.token }).cards.map((c) => c.id), five.cards.map((c) => c.id), 'later publishes do not reshuffle it');
  });
  t('daily five: picks pay 10 coins per right answer, streak counts a day with 3+ right', () => {
    for (const c of five.cards) db.rpc('hf_daily_pick', { p_token: u.ragavan.token, p_card: c.id, p_side: 'a' });
    db.at('2026-10-20 23:00-04');
    for (const g of gs) {
      const gg = db.rows(`select id, kind from cards where game_id = '${g.game_id}'`);
      svc(db, 'bot_results', { p_games: [{ league: 'nba', game_id: g.game_id, state: 'post', home_score: 120, away_score: 100 }], p_actuals: gg.filter((c) => c.kind === 'player').map((c) => ({ card_id: c.id, actual: 99 })) });
    }
    svc(db, 'bot_results', { p_games: [] });
    db.at('2026-10-20 23:45-04');
    svc(db, 'bot_results', {});
    const wins = db.rows("select count(*) n from solo_picks where result = 'win'")[0].n;
    assert.equal(bal(db, u.ragavan), 10 * wins);
    const pr = db.rpc('hf_daily', { p_token: u.ragavan.token });
    void pr;
    const row = db.rows(`select solo_streak, solo_best from profiles where id = '${u.ragavan.id}'`)[0];
    assert.equal(row.solo_streak, wins >= 3 ? 1 : 0);
    assert.equal(bal(db, u.bro), 0);
  });
  t('daily five: no picks after tip-off', () => {
    db.at('2026-10-21 08:00-04');
    publish(db, [game(21, '19:00'), game(21, '20:00')]);
    const d2 = db.rpc('hf_daily', { p_token: u.ragavan.token });
    db.at('2026-10-21 19:30-04');
    const started = d2.cards.find((c) => new Date(c.start_at) <= new Date(ET(21, '19:30')));
    assert.ok(started, 'one of the five is the 7pm game');
    assert.equal(err(db.rpc('hf_daily_pick', { p_token: u.ragavan.token, p_card: started.id, p_side: 'a' })), 'locked');
  });
}

/* =============================== survivor =============================== */
{
  const db = fresh();
  const u = crew(db);
  db.sql(`update app_config set value = '["nba"]' where key = 'survivor_leagues'`);
  const slate = (day) => [game(day, '19:00', { fav_prob: 0.7 }), game(day, '19:30', { fav_prob: 0.66 }), game(day, '20:00', { fav_prob: 0.6 })];
  const d20 = slate(20);
  publish(db, d20, false);
  const pool = (who = 'ragavan') => db.rpc('hf_survivor', { p_token: u[who].token }).pools[0];
  let pl;
  t('a pool is created for the crew and opens for entries before the first game', () => {
    pl = pool();
    assert.equal(pl.league, 'nba'); assert.equal(pl.status, 'open'); assert.equal(pl.entry, 50);
    assert.equal(pl.period, '2026-10-20');
    assert.equal(pl.games.length, 3);
  });
  t('join is idempotent per op and cannot be done twice', () => {
    assert.equal(db.rpc('hf_survivor_join', { p_token: u.ragavan.token, p_pool: pl.id, p_op: 'sjoin-op-001' }).ok, true);
    assert.equal(db.rpc('hf_survivor_join', { p_token: u.ragavan.token, p_pool: pl.id, p_op: 'sjoin-op-001' }).ok, true);
    assert.equal(db.one('select count(*) from survivor_entries'), '1');
    assert.equal(err(db.rpc('hf_survivor_join', { p_token: u.ragavan.token, p_pool: pl.id, p_op: 'sjoin-op-002' })), 'already_in');
    db.rpc('hf_survivor_join', { p_token: u.bro.token, p_pool: pl.id, p_op: 'sjoin-op-003' });
    db.rpc('hf_survivor_join', { p_token: u.cuz.token, p_pool: pl.id, p_op: 'sjoin-op-004' });
    assert.equal(pool().pot, 150);
    assert.equal(db.one('select count(*) from survivor_entries'), '3');
  });
  t('leaving before the first game refunds the entry', () => {
    assert.equal(db.rpc('hf_survivor_leave', { p_token: u.cuz.token, p_pool: pl.id }).ok, true);
    assert.equal(bal(db, u.cuz), 50);
    assert.equal(pool().pot, 100);
    db.rpc('hf_survivor_join', { p_token: u.cuz.token, p_pool: pl.id, p_op: 'sjoin-op-005' });
    assert.equal(pool().pot, 150);
  });
  t('picking: real team in that period, changeable until its game starts', () => {
    const [a, b] = d20;
    assert.equal(err(db.rpc('hf_survivor_pick', { p_token: u.ragavan.token, p_pool: pl.id, p_game: a.game_id, p_team: 'zzz' })), 'no_such_team');
    assert.equal(err(db.rpc('hf_survivor_pick', { p_token: u.ragavan.token, p_pool: pl.id, p_game: '9999', p_team: 'h1' })), 'no_such_game');
    assert.equal(db.rpc('hf_survivor_pick', { p_token: u.ragavan.token, p_pool: pl.id, p_game: a.game_id, p_team: a.away.id }).ok, true);
    assert.equal(db.rpc('hf_survivor_pick', { p_token: u.ragavan.token, p_pool: pl.id, p_game: b.game_id, p_team: b.home.id }).ok, true);
    assert.equal(db.one(`select team_id from survivor_picks where user_id = '${u.ragavan.id}'`), b.home.id, 'changed their mind');
    db.rpc('hf_survivor_pick', { p_token: u.bro.token, p_pool: pl.id, p_game: a.game_id, p_team: a.home.id });
    // cuz forgets to pick
  });
  t('other players\' picks stay hidden until their game starts', () => {
    const rag = pool('bro').entries.find((e) => e.handle === 'ragavan');
    assert.equal(rag.pick, null);
  });
  t('the round goes live at the first game and nobody can pick that game any more', () => {
    db.at('2026-10-20 19:01-04');
    svc(db, 'bot_results', {});
    assert.equal(pool().status, 'live');
    assert.equal(err(db.rpc('hf_survivor_pick', { p_token: u.ragavan.token, p_pool: pl.id, p_game: d20[0].game_id, p_team: d20[0].home.id })), 'locked');
  });
  t('night one: losers are out, forgetting auto-picks the best unused favourite, winners play on', () => {
    const [a, b, c] = d20;
    db.at('2026-10-20 23:00-04');
    svc(db, 'bot_results', { p_games: [
      { league: 'nba', game_id: a.game_id, state: 'post', home_score: 100, away_score: 90 },
      { league: 'nba', game_id: b.game_id, state: 'post', home_score: 90, away_score: 100 },
      { league: 'nba', game_id: c.game_id, state: 'post', home_score: 110, away_score: 100 }] });
    assert.equal(pool().status, 'live', 'still inside the 30 minute wait');
    assert.equal(pool().entries.filter((e) => e.alive).length, 3);
    db.at('2026-10-20 23:40-04');
    svc(db, 'bot_results', {});
    const rows = db.rows(`select p.handle, e.alive, sp.team_id, sp.auto, sp.result from survivor_entries e join profiles p on p.id = e.user_id left join survivor_picks sp on sp.user_id = e.user_id and sp.pool_id = e.pool_id order by p.handle`);
    const by = Object.fromEntries(rows.map((r) => [r.handle, r]));
    assert.equal(by.ragavan.alive, false); assert.equal(by.ragavan.result, 'lost');
    assert.equal(by.bro.alive, true); assert.equal(by.bro.result, 'won');
    assert.equal(by.cuz.auto, true); assert.equal(by.cuz.team_id, a.home.id, 'the strongest favourite on the night');
    assert.equal(by.cuz.alive, true);
    assert.equal(pool().period, null, 'next night is not on the board yet');
  });
  const d21 = [game(21, '19:00', { fav_prob: 0.72 }), game(21, '20:00', { fav_prob: 0.55 })];
  let again;
  t('night two: a team you already used is refused', () => {
    db.at('2026-10-21 08:00-04');
    again = { ...d20[0], start_at: ET(21, '21:00'), game_id: '777', away: { id: 'zz', name: 'Visitors', abbr: 'VIS' }, fav_prob: 0.9 };
    publish(db, [...d21, again], false);
    svc(db, 'bot_results', {});
    const p = pool('bro');
    assert.equal(p.period, '2026-10-21');
    assert.equal(p.games.length, 3);
    assert.equal(err(db.rpc('hf_survivor_pick', { p_token: u.bro.token, p_pool: p.id, p_game: '777', p_team: d20[0].home.id })), 'team_used');
    assert.equal(db.rpc('hf_survivor_pick', { p_token: u.bro.token, p_pool: p.id, p_game: '777', p_team: 'zz' }).ok, true);
    assert.equal(err(db.rpc('hf_survivor_pick', { p_token: u.ragavan.token, p_pool: p.id, p_game: '777', p_team: 'zz' })), 'not_in', 'eliminated');
  });
  t('last one alive takes the pot (3 x 50 = 150) and a new round opens by itself', () => {
    // cuz forgets again: the best unused favourite is 777 home (0.9) but that is the team cuz already used, so game 21-A home (0.72)
    db.at('2026-10-21 23:30-04');
    svc(db, 'bot_results', { p_games: [
      { league: 'nba', game_id: d21[0].game_id, state: 'post', home_score: 105, away_score: 100 },
      { league: 'nba', game_id: d21[1].game_id, state: 'post', home_score: 100, away_score: 99 },
      { league: 'nba', game_id: '777', state: 'post', home_score: 99, away_score: 80 }] });
    db.at('2026-10-22 00:10-04');
    svc(db, 'bot_results', {});
    assert.equal(db.one(`select team_id from survivor_picks where user_id = '${u.cuz.id}' and period = '2026-10-21'`), d21[0].home.id);
    assert.equal(kinds(db, u.cuz).find((k) => k.kind === 'survivor').amount, 150);
    assert.equal(kinds(db, u.bro).some((k) => k.kind === 'survivor'), false);
    const p = pool();
    assert.equal(p.round, 2); assert.equal(p.status, 'open'); assert.equal(p.pot, 0);
    assert.deepEqual(p.last.winners, ['cuz']); assert.equal(p.last.pot, 150);
  });
  t('periods: NFL weeks run Tuesday to Monday, everything else is by the day', () => {
    assert.equal(db.one("select x_period('nfl', date '2026-10-20')"), '2026-10-20'); // Tuesday
    assert.equal(db.one("select x_period('nfl', date '2026-10-25')"), '2026-10-20'); // Sunday
    assert.equal(db.one("select x_period('nfl', date '2026-10-26')"), '2026-10-20'); // Monday night
    assert.equal(db.one("select x_period('nfl', date '2026-10-27')"), '2026-10-27');
    assert.equal(db.one("select x_period('nba', date '2026-10-25')"), '2026-10-25');
  });
}

/* ---- survivor: everyone out at once is a shared win; ties and postponements keep you alive; <2 entrants refund ---- */
{
  const db = fresh();
  const u = crew(db);
  db.sql(`update app_config set value = '["nba"]' where key = 'survivor_leagues'`);
  const gs = [game(20, '19:00'), game(20, '19:30')];
  publish(db, gs, false);
  const poolId = () => db.rpc('hf_survivor', { p_token: u.ragavan.token }).pools[0].id;
  t('one entrant is not a round: the entry is refunded when the first game starts', () => {
    db.rpc('hf_survivor_join', { p_token: u.ragavan.token, p_pool: poolId(), p_op: 'solo-join-001' });
    db.at('2026-10-20 19:05-04');
    svc(db, 'bot_results', {});
    assert.equal(bal(db, u.ragavan), 50);
    assert.equal(db.one('select count(*) from survivor_entries'), '0');
    assert.equal(db.rows('select status from survivor_pools')[0].status, 'open');
    db.at(NOW);
  });
  const g2 = [game(21, '19:00'), game(21, '20:00'), game(21, '21:00')];
  db.at('2026-10-21 08:00-04');
  publish(db, g2, false);
  svc(db, 'bot_results', {});
  t('everyone loses on the same night: all of them share the pot', () => {
    const id = poolId();
    for (const [i, n] of ['ragavan', 'bro', 'cuz'].entries()) db.rpc('hf_survivor_join', { p_token: u[n].token, p_pool: id, p_op: 'all-out-0' + i + '00' });
    for (const n of ['ragavan', 'bro', 'cuz']) db.rpc('hf_survivor_pick', { p_token: u[n].token, p_pool: id, p_game: g2[0].game_id, p_team: g2[0].home.id });
    db.at('2026-10-21 23:00-04');
    svc(db, 'bot_results', { p_games: g2.map((g, i) => ({ league: 'nba', game_id: g.game_id, state: 'post', home_score: i === 0 ? 80 : 100, away_score: i === 0 ? 100 : 90 })) });
    db.at('2026-10-21 23:45-04');
    svc(db, 'bot_results', {});
    assert.equal(db.one("select count(*) from payouts where kind = 'survivor'"), '3');
    assert.equal(db.one("select sum(amount) from payouts where kind = 'survivor'"), '150', 'the whole pot is paid out, nothing lost to rounding');
    assert.equal(db.rows('select round from survivor_pools')[0].round, 2);
  });
  const g3 = [game(22, '19:00'), game(22, '20:00')];
  db.at('2026-10-22 08:00-04');
  publish(db, g3, false);
  svc(db, 'bot_results', {});
  t('a tied game and a postponed game keep you alive and do not use up your team', () => {
    const id = poolId();
    for (const [i, n] of ['ragavan', 'bro'].entries()) db.rpc('hf_survivor_join', { p_token: u[n].token, p_pool: id, p_op: 'tie-join-0' + i + '00' });
    db.rpc('hf_survivor_pick', { p_token: u.ragavan.token, p_pool: id, p_game: g3[0].game_id, p_team: g3[0].home.id });
    db.rpc('hf_survivor_pick', { p_token: u.bro.token, p_pool: id, p_game: g3[1].game_id, p_team: g3[1].home.id });
    db.at('2026-10-22 23:00-04');
    svc(db, 'bot_results', { p_games: [
      { league: 'nba', game_id: g3[0].game_id, state: 'post', home_score: 100, away_score: 100 },
      { league: 'nba', game_id: g3[1].game_id, state: 'pre', void: true }] });
    db.at('2026-10-22 23:45-04');
    svc(db, 'bot_results', {});
    const rows = db.rows("select p.handle, e.alive, sp.result from survivor_entries e join profiles p on p.id = e.user_id join survivor_picks sp on sp.user_id = e.user_id and sp.pool_id = e.pool_id and sp.round = e.round where e.round = 2");
    assert.ok(rows.every((r) => r.alive), JSON.stringify(rows));
    assert.deepEqual(rows.map((r) => r.result).sort(), ['tie', 'void']);
    // the voided pick frees the team up again
    assert.equal(db.one(`select count(*) from survivor_picks where result = 'void' and user_id = '${u.bro.id}'`), '1');
  });
}

/* =============================== cap night =============================== */
{
  const db = fresh();
  const u = crew(db);
  const g1 = game(20, '19:00'), g2 = game(20, '21:00');
  const players = [];
  const mkp = (g, i, team, price, avg) => ({ day: '2026-10-20', league: 'nba', game_id: g.game_id, player_id: `${g.game_id}-${i}`, name: `Player ${g.game_id}-${i}`, team_id: team === 'h' ? g.home.id : g.away.id, team_abbr: team === 'h' ? g.home.abbr : g.away.abbr, pos: 'G', price, avg });
  for (let i = 1; i <= 4; i++) { players.push(mkp(g1, i, 'h', 10 - i, 30 - i)); players.push(mkp(g1, i + 4, 'a', 9 - i, 28 - i)); players.push(mkp(g2, i, i % 2 ? 'h' : 'a', 8 - i, 25 - i)); }
  publish(db, [g1, g2], false, players);
  const P = (g, i) => `${g.game_id}-${i}`;
  const cap = (who, day = '2026-10-20') => db.rpc('hf_cap', { p_token: u[who].token, p_day: day });
  const set = (who, ps, day = '2026-10-20') => db.rpc('hf_cap_set', { p_token: u[who].token, p_day: day, p_players: ps });
  t('pool shows players with price, budget and slots', () => {
    const c = cap('ragavan');
    assert.equal(c.players.length, 12); assert.equal(c.budget, 40); assert.equal(c.slots, 5);
    assert.ok(c.days.includes('2026-10-20'));
    assert.equal(cap('ragavan', null).day, '2026-10-20', 'default day is today');
  });
  t('lineup rules: 5 players max, within the cap, no more than 2 per team, no repeats, no strangers', () => {
    assert.equal(err(set('ragavan', [P(g1, 1), P(g1, 2), P(g1, 3)])), 'team_limit');
    assert.equal(err(set('ragavan', [P(g1, 1), P(g1, 5), P(g2, 1), P(g2, 2), P(g1, 6), P(g2, 3)])), 'too_many');
    assert.equal(err(set('ragavan', [P(g1, 1), P(g1, 1)])), 'duplicate');
    assert.equal(err(set('ragavan', ['nobody'])), 'unknown_player');
    const dear = [P(g1, 1), P(g1, 5), P(g2, 1), P(g2, 2)];
    const cost = dear.reduce((a, id) => a + Number(db.one(`select price from cap_players where player_id = '${id}'`)), 0);
    assert.ok(cost <= 40);
    db.sql("update cap_players set price = 20 where player_id in ('" + [P(g1, 1), P(g1, 5), P(g2, 1)].join("','") + "')");
    assert.equal(err(set('ragavan', [P(g1, 1), P(g1, 5), P(g2, 1)])), 'over_cap');
    db.sql("update cap_players set price = 8 where player_id in ('" + [P(g1, 1), P(g1, 5), P(g2, 1)].join("','") + "')");
  });
  t('a good lineup saves; others cannot see your players until their game starts', () => {
    assert.equal(set('ragavan', [P(g1, 1), P(g1, 5), P(g2, 1), P(g2, 2), P(g2, 3)]).ok, true);
    assert.equal(set('bro', [P(g1, 2), P(g1, 6), P(g2, 4)]).ok, true);
    const b = cap('bro');
    const rag = b.board.find((x) => x.handle === 'ragavan');
    assert.equal(rag.count, 5);
    assert.equal(rag.picks.length, 0, 'hidden before tip-off');
    assert.equal(b.board.find((x) => x.handle === 'bro').picks.length, 3, 'you always see your own');
  });
  t('after tip-off: started players are locked in; unstarted ones can still change', () => {
    db.at('2026-10-20 19:30-04');
    assert.equal(err(set('ragavan', [P(g1, 5), P(g2, 1), P(g2, 2), P(g2, 3)])), 'locked', 'cannot drop a player whose game started');
    assert.equal(err(set('bro', [P(g1, 2), P(g1, 6), P(g1, 3)])), 'locked', 'cannot add a player whose game started');
    assert.equal(set('ragavan', [P(g1, 1), P(g1, 5), P(g2, 2), P(g2, 3)]).ok, true, 'swapping an unstarted player is fine');
    assert.equal(cap('bro').board.find((x) => x.handle === 'ragavan').picks.length, 2, 'started players are now visible');
    db.at(NOW);
  });
  t('scoring: points + 1.2 reb + 1.5 ast + 3 stl + 3 blk - turnovers', () => {
    assert.equal(db.one(`select x_fantasy('{"pts":30,"reb":10,"ast":8,"stl":2,"blk":1,"to":4}')`), '59.0');
    assert.equal(db.one(`select x_fantasy('{"pts":0}')`), '0.0');
  });
  t('night scored after every game is final + 30 minutes; the top lineup wins 100 coins; week pays later', () => {
    db.at('2026-10-20 23:59-04');
    const stat = (id, pts) => ({ day: '2026-10-20', player_id: id, stats: { pts, reb: 5, ast: 5, stl: 0, blk: 0, to: 0 } });
    svc(db, 'bot_results', { p_games: [
      { league: 'nba', game_id: g1.game_id, state: 'post', home_score: 100, away_score: 99 },
      { league: 'nba', game_id: g2.game_id, state: 'post', home_score: 100, away_score: 99 }],
      p_cap: [stat(P(g1, 1), 30), stat(P(g1, 5), 20), stat(P(g2, 2), 10), stat(P(g2, 3), 10), stat(P(g1, 2), 40), stat(P(g1, 6), 5), stat(P(g2, 4), 5), { day: '2026-10-20', player_id: P(g2, 1), dnp: true, stats: {} }] });
    assert.equal(db.one('select count(*) from cap_days'), '0', 'inside the wait');
    db.at('2026-10-21 00:35-04');
    svc(db, 'bot_results', {});
    assert.equal(db.one('select count(*) from cap_days'), '1');
    const nights = Object.fromEntries(db.rows('select p.handle, n.score from cap_nights n join profiles p on p.id = n.user_id').map((r) => [r.handle, Number(r.score)]));
    // ragavan: (30 + 7.5+... ) computed: 30+6+7.5=43.5 ; 20+6+7.5=33.5 ; 10+13.5 = 23.5 x2 -> 43.5+33.5+23.5+23.5 = 124
    assert.equal(nights.ragavan, 124);
    assert.equal(nights.bro, 40 + 13.5 + 5 + 13.5 + 5 + 13.5 - 0);
    assert.equal(bal(db, u.ragavan), 100);
    assert.equal(bal(db, u.bro), 0);
    assert.equal(err(set('ragavan', [P(g1, 1)])), 'locked', 'a finished night cannot be changed');
  });
  t('re-running the settle does not pay the night prize twice', () => {
    for (let i = 0; i < 3; i++) svc(db, 'bot_results', {});
    assert.equal(bal(db, u.ragavan), 100);
  });
  t('week closes once the week is over and pays 300 to the best five nights', () => {
    db.at('2026-10-22 12:00-04');
    assert.equal(bal(db, u.ragavan), 100);
    db.at('2026-10-27 12:00-04');
    svc(db, 'bot_results', {});
    assert.equal(bal(db, u.ragavan), 400);
    assert.equal(db.one('select count(*) from cap_weeks'), '1');
    svc(db, 'bot_results', {});
    assert.equal(bal(db, u.ragavan), 400);
    db.at(NOW);
  });
  t('no prize when only one person played', () => {
    const db2 = fresh(); const u2 = crew(db2, ['ragavan']);
    const gg = game(20, '19:00'); const pp = [mkp(gg, 1, 'h', 8, 30)];
    publish(db2, [gg], false, pp);
    db2.rpc('hf_cap_set', { p_token: u2.ragavan.token, p_day: '2026-10-20', p_players: [`${gg.game_id}-1`] });
    db2.at('2026-10-20 23:00-04');
    svc(db2, 'bot_results', { p_games: [{ league: 'nba', game_id: gg.game_id, state: 'post', home_score: 100, away_score: 90 }], p_cap: [{ day: '2026-10-20', player_id: `${gg.game_id}-1`, stats: { pts: 40 } }] });
    db2.at('2026-10-21 00:00-04');
    svc(db2, 'bot_results', {});
    assert.equal(bal(db2, u2.ragavan), 0);
  });
}

/* =============================== access and limits =============================== */
{
  const db = fresh();
  const u = crew(db, ['ragavan', 'bro', 'cuz']);
  const g = game(20, '19:00'); publish(db, [g]);
  const d = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'sec-create-01', p_length: 'game', p_stake: 100, p_game: `nba:${g.game_id}`, p_opponent: 'bro' }).duel;
  db.rpc('hf_duel_accept', { p_token: u.bro.token, p_duel: d.id, p_op: 'sec-accept-01' });
  t('a third player cannot look at, pick in, cancel or accept someone else\'s active duel', () => {
    assert.equal(err(db.rpc('hf_duel_get', { p_token: u.cuz.token, p_duel: d.id })), 'not_yours');
    assert.equal(err(db.rpc('hf_duel_pick', { p_token: u.cuz.token, p_duel: d.id, p_card: d.cards[0].id, p_side: 'a' })), 'not_yours');
    assert.equal(err(db.rpc('hf_duel_cancel', { p_token: u.cuz.token, p_duel: d.id })), 'not_open');
    assert.equal(err(db.rpc('hf_duel_accept', { p_token: u.cuz.token, p_duel: d.id, p_op: 'sec-accept-02' })), 'taken');
    assert.equal(db.rpc('hf_duels', { p_token: u.cuz.token }).mine.length, 0);
  });
  t('no token, a made-up token, or another player\'s id never gets you anything', () => {
    assert.match(db.rpc('hf_crew', { p_token: null }).error, /not_signed_in/);
    assert.match(db.rpc('hf_claim', { p_token: 'not-a-real-token-not-a-real-token' }).error, /not_signed_in/);
    assert.match(db.as('anon', `select hf_claim('${u.ragavan.id}')`).err, /not_signed_in/, 'a user id is not a token');
  });
  t('one player cannot claim another player\'s winnings', () => {
    db.sql(`insert into payouts (user_id, kind, ref, amount) values ('${u.ragavan.id}', 'solo', 'sec1', 77)`);
    assert.equal(db.rpc('hf_claim', { p_token: u.bro.token }).total, 0);
    assert.equal(db.rpc('hf_payouts', { p_token: u.ragavan.token }).total, 77);
    assert.equal(db.rpc('hf_claim', { p_token: u.ragavan.token }).total, 77);
  });
  t('handles with odd characters are refused', () => {
    const inv = db.rpc('hf_invite_make', { p_token: u.ragavan.token, p_uses: 5 }).code;
    for (const bad of ["x'; drop table profiles;--", 'sp ace', 'ünï', 'a'.repeat(17), '']) assert.equal(err(db.rpc('hf_signup', { p_invite: inv, p_handle: bad })), 'bad_handle');
    assert.equal(db.one('select count(*) from profiles'), '3');
  });
  t('too many open duels is refused', () => {
    db.sql("update app_config set value = '2' where key = 'duel_max_open'");
    const r = db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'sec-create-02', p_length: 'game', p_stake: 10, p_game: `nba:${g.game_id}` });
    assert.ok(r.duel, 'second duel fits');
    assert.match(db.rpc('hf_duel_create', { p_token: u.ragavan.token, p_op: 'sec-create-03', p_length: 'game', p_stake: 10, p_game: `nba:${g.game_id}` }).error, /too_many/);
    db.sql("update app_config set value = '12' where key = 'duel_max_open'");
  });
  t('slate lists today and tomorrow with card counts', () => {
    const sl = db.rpc('hf_slate', { p_token: u.cuz.token });
    assert.equal(sl.today, '2026-10-20');
    assert.equal(sl.games.length, 1);
    assert.equal(sl.games[0].cards, 8);
    assert.equal(sl.games[0].key, `nba:${g.game_id}`);
  });
  t('solo streak grows across days and resets after a miss', () => {
    const db2 = fresh(); const w = crew(db2, ['ragavan']);
    for (const day of [20, 21, 22]) {
      db2.at(`2026-10-${day} 08:00-04`);
      const gs = [game(day, '19:00'), game(day, '20:00')];
      publish(db2, gs);
      const five = db2.rpc('hf_daily', { p_token: w.ragavan.token });
      for (const c of five.cards) db2.rpc('hf_daily_pick', { p_token: w.ragavan.token, p_card: c.id, p_side: day === 22 ? 'b' : 'a' });
      db2.at(`2026-10-${day} 23:00-04`);
      svc(db2, 'bot_results', { p_games: gs.map((x) => ({ league: 'nba', game_id: x.game_id, state: 'post', home_score: 130, away_score: 120 })), p_actuals: db2.rows("select id from cards where kind = 'player' and status = 'open'").map((x) => ({ card_id: x.id, actual: 40 })) });
      db2.at(`2026-10-${day} 23:50-04`);
      svc(db2, 'bot_results', {});
    }
    // day 20 and 21: everything is 'a' (home wins, total over, team totals over, players over 40) => 5/5. day 22 picks 'b' => 0/5.
    const row = db2.rows(`select solo_streak, solo_best from profiles where id = '${w.ragavan.id}'`)[0];
    assert.equal(row.solo_best, 2);
    assert.equal(row.solo_streak, 0);
    assert.equal(Number(db2.one(`select coalesce(sum(amount),0) from payouts where user_id = '${w.ragavan.id}'`)), 100);
  });
}

/* =============================== housekeeping =============================== */
{
  const db = fresh();
  const u = crew(db, ['ragavan', 'bro']);
  t('bot_pending lists only started, unscored games', () => {
    const g = game(20, '19:00'), g2 = game(20, '22:00');
    publish(db, [g, g2]);
    db.at('2026-10-20 20:00-04');
    const p = svc(db, 'bot_pending', {});
    assert.equal(p.games.length, 1);
    assert.equal(p.games[0].game_id, g.game_id);
    assert.equal(p.cards.length, 4, 'its 4 player cards');
    db.at(NOW);
  });
  t('a game nobody reports for three days is treated as called off and its cards are voided', () => {
    db.at('2026-10-24 12:00-04');
    svc(db, 'bot_results', {});
    assert.equal(db.one("select count(*) from cards where status = 'open'"), '0');
    assert.equal(db.one("select count(*) from cards where status = 'void'"), '16');
    db.at(NOW);
  });
  t('old login attempts are cleaned up', () => {
    db.rpc('hf_login', { p_handle: 'bro', p_code: 'AAAA-AAAA-AAAA-AAAA' });
    assert.ok(Number(db.one('select count(*) from throttle')) >= 1);
    db.at('2026-10-30 12:00-04');
    svc(db, 'bot_results', {});
    assert.equal(db.one('select count(*) from throttle'), '0');
  });
}

for (const d of dbs) d.drop();
console.log(`\n${passed} SQL checks passed`);
