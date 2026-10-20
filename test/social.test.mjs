// Tests for the crew bots' helpers (scripts/social-lib.mjs), and one full pass through the real database:
// fake ESPN data -> slate -> a duel -> fake final box score -> settle -> payout.
import assert from 'node:assert/strict';
import { normEvent, normSummary, normRoster, normAthleteStats } from '../js/espn.js';
import { buildProps } from '../js/bets.js';
import * as F from './fixtures.js';
import * as L from '../scripts/social-lib.mjs';
import * as PG from './pg.mjs';

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e.message); process.exitCode = 1; } };
const ta = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e.message); process.exitCode = 1; } };

/* ---------- lines ---------- */
t('halfLine never lands on a whole number', () => {
  assert.equal(L.halfLine(221), 221.5);
  assert.equal(L.halfLine(220.5), 220.5);
  assert.equal(L.halfLine(112.25), 112.5);
  assert.equal(L.halfLine(7), 7.5);
  for (const x of [0.3, 5, 44, 9.75, 110.1]) assert.ok(String(L.halfLine(x)).endsWith('.5'));
});
t('spread: read from the odds text for either team', () => {
  assert.equal(L.parseSpread('TOR -4.5', 'TOR', 'NYK'), -4.5);
  assert.equal(L.parseSpread('NYK -3', 'TOR', 'NYK'), 3);
  assert.equal(L.parseSpread('NYK +2.5', 'TOR', 'NYK'), -2.5);
  assert.equal(L.parseSpread('EVEN', 'TOR', 'NYK'), null);
  assert.equal(L.parseSpread('', 'TOR', 'NYK'), null);
  assert.equal(L.parseSpread('XXX -3', 'TOR', 'NYK'), null);
});
t('team totals add up to the game total and the favourite scores more', () => {
  const tt = L.teamTotals(220, -4);
  assert.equal(tt.home + tt.away, 220);
  assert.ok(tt.home > tt.away);
});

/* ---------- games and cards ---------- */
const odds = (details, ou) => ({ details, overUnder: ou, homeTeamOdds: { moneyLine: -180 }, awayTeamOdds: { moneyLine: 150 } });
function ev(lg, id, date, o = {}, oddsObj = odds('TOR -4.5', 221)) {
  const e = F.event(lg, id, { state: 'pre', hs: 0, as: 0, date, ...o });
  e.competitions[0].odds = oddsObj ? [oddsObj] : [];
  return e;
}
const game = (lg, id, date, o, od) => normEvent(ev(lg, id, date, o, od), lg);

t('gameRow: fills in the favourite, total and spread; skips live games, soccer and called-off games', () => {
  const g = game('nba', 501, '2026-10-20T23:00Z');
  const row = L.gameRow(g);
  assert.equal(row.league, 'nba'); assert.equal(row.game_id, '501'); assert.equal(row.start_at, '2026-10-20T23:00:00.000Z');
  assert.equal(row.fav_team, g.home.id); assert.ok(row.fav_prob > 0.5);
  assert.equal(row.ou, 221); assert.equal(row.home_spread, -4.5);
  assert.equal(L.gameRow(normEvent(ev('nba', 502, '2026-10-20T23:00Z', { state: 'in' }), 'nba')), null);
  assert.equal(L.gameRow(game('eng.1', 503, '2026-10-20T23:00Z')), null, 'soccer has no cards yet');
  const off = normEvent(ev('nba', 504, '2026-10-20T23:00Z'), 'nba'); off.void = true;
  assert.equal(L.gameRow(off), null);
  const noOdds = L.gameRow(game('nba', 505, '2026-10-20T23:00Z', {}, null));
  assert.equal(noOdds.ou, null); assert.equal(noOdds.home_spread, null);
});

const fakePool = (lg, g) => {
  const side = (team) => {
    const r = normRoster(F.roster(lg, team.id));
    const stats = new Map(r.players.map((p) => [p.id, normAthleteStats(F.overview(lg, p.id))]));
    return { players: r.players, stats, all: r.players };
  };
  return { home: side(g.home), away: side(g.away) };
};
const marketsFor = (g, pool) => [...buildProps(g.league, pool.home.players, pool.home.stats, g.home.id), ...buildProps(g.league, pool.away.players, pool.away.stats, g.away.id)];

t('cardsForGame: winner, total, both team totals and up to 4 player cards, all with .5 lines', () => {
  const g = game('nba', 510, '2026-10-20T23:00Z');
  const pool = fakePool('nba', g);
  const cards = L.cardsForGame(g, marketsFor(g, pool));
  const kinds = cards.reduce((a, c) => { a[c.kind] = (a[c.kind] || 0) + 1; return a; }, {});
  assert.deepEqual(kinds, { winner: 1, total: 1, team_total: 2, player: 4 });
  for (const c of cards.filter((x) => x.kind !== 'winner')) assert.ok(String(c.line).endsWith('.5'), `${c.title} ${c.line}`);
  const win = cards.find((c) => c.kind === 'winner');
  assert.equal(win.a, g.home.abbr); assert.equal(win.b, g.away.abbr);
  const tt = cards.filter((c) => c.kind === 'team_total').map((c) => c.line);
  assert.ok(Math.abs(tt[0] + tt[1] - 221) <= 1, 'team totals roughly add to the game total');
  const players = cards.filter((c) => c.kind === 'player');
  assert.equal(new Set(players.map((c) => c.subject)).size, 4, 'no repeats');
  assert.ok(players.some((c) => c.meta.team === g.home.abbr) && players.some((c) => c.meta.team === g.away.abbr), 'both teams are represented');
  assert.ok(players.every((c) => Array.isArray(c.meta.box) && typeof c.meta.box[0].g === 'string'), 'box recipe is plain JSON');
  JSON.parse(JSON.stringify(cards));
});
t('cardsForGame: without odds there is still a winner card, and no total cards', () => {
  const g = game('nba', 511, '2026-10-20T23:00Z', {}, null);
  const cards = L.cardsForGame(g, []);
  assert.deepEqual(cards.map((c) => c.kind), ['winner']);
});

/* ---------- reading results ---------- */
const sumFor = (lg, id, o) => normSummary(F.summary(lg, id, o), lg, String(id));
t('playerActual reads points from a final box score; a missing player is null', () => {
  const s = sumFor('nba', 520);
  assert.equal(L.playerActual(s.box, { playerId: '1', name: 'Test Star', box: [{ g: '.', l: ['PTS'] }] }), 38);
  assert.equal(L.playerActual(s.box, { playerId: '999', name: 'Nobody Here', box: [{ g: '.', l: ['PTS'] }] }), null);
  assert.equal(L.playerActual(s.box, { playerId: '3', name: 'Bench Guy', box: [{ g: '.', l: ['PTS'] }] }), null, 'did not play');
  assert.equal(L.playerActual(s.box, { playerId: 'x', name: 'Test Star', box: [{ g: '.', l: ['PTS'] }] }), 38, 'falls back to the name');
});
t('playerActual adds goals and assists for a hockey points card', () => {
  const s = sumFor('nhl', 521);
  assert.equal(L.playerActual(s.box, { playerId: '10', name: 'Hat Trick Guy', box: [{ g: '.', l: ['G'] }, { g: '.', l: ['A'] }] }), 4);
});
t('capStatLine: real minutes give a stat line, DNP and absent players are flagged', () => {
  const s = sumFor('nba', 522);
  const star = L.capStatLine(s.box, '1', 'Test Star');
  assert.deepEqual(star, { dnp: false, stats: { pts: 38, reb: 5, ast: 4, stl: 1, blk: 0, to: 2 } });
  assert.equal(L.fantasyOf(star.stats), 51);
  assert.equal(L.capStatLine(s.box, '3', 'Bench Guy').dnp, true);
  assert.equal(L.capStatLine(s.box, '404', 'Ghost').dnp, true);
});
t('fantasy score and price', () => {
  assert.equal(L.fantasyOf({ pts: 30, reb: 10, ast: 8, stl: 2, blk: 1, to: 4 }), 59);
  assert.equal(L.fantasyOf({}), 0);
  const avg = L.fantasyAvg(normAthleteStats(F.overview('nba', 7)));
  assert.equal(avg, 40);
  assert.equal(L.capPrice(avg), 11);
  assert.equal(L.capPrice(0), 1); assert.equal(L.capPrice(500), 40);
  assert.equal(L.fantasyAvg([]), null);
});
t('resultRow: a suspended game is not treated as called off', () => {
  const s = sumFor('nba', 523, { state: 'in', hs: 50, as: 40, detail: 'Suspended', clock: '3:00', period: 2 });
  s.game.void = true; s.game.detail = 'Suspended'; s.game.shortDetail = 'Suspended';
  assert.equal(L.resultRow(s).void, false);
  s.game.detail = 'Postponed'; s.game.shortDetail = 'Postponed';
  assert.equal(L.resultRow(s).void, true);
});

/* ---------- the two jobs with fake feeds ---------- */
const day = '2026-10-20';
const feed = (map) => async (lg, ymd) => { if (map instanceof Error) throw map; return map[`${lg}:${ymd}`] || []; };

await ta('buildSlate: cards for today and tomorrow, week of games for Survivor leagues, Cap Night pool for the NBA', async () => {
  const sched = {
    'nba:20261020': [game('nba', 601, '2026-10-20T23:00Z'), game('nba', 602, '2026-10-21T01:30Z')],
    'nba:20261021': [game('nba', 603, '2026-10-21T23:30Z')],
    'nba:20261025': [game('nba', 604, '2026-10-25T23:30Z')],
    'nhl:20261020': [game('nhl', 611, '2026-10-20T23:00Z')],
    'nhl:20261024': [game('nhl', 612, '2026-10-24T23:00Z')],
    'nfl:20261025': [game('nfl', 621, '2026-10-25T17:00Z', {}, odds('DEN -3', 44.5))],
    'eng.1:20261020': [game('eng.1', 631, '2026-10-20T19:00Z')],
  };
  const out = await L.buildSlate({ day, getScoreboard: feed(sched), loadPool: async (g) => fakePool(g.league, g), buildProps, survivorLeagues: ['nfl', 'nba'] });
  const ids = out.games.map((g) => `${g.league}:${g.game_id}`).sort();
  assert.deepEqual(ids, ['nba:601', 'nba:602', 'nba:603', 'nba:604', 'nfl:621', 'nhl:611'], 'nhl game 6 days out is not published; Survivor leagues look a week ahead; soccer is ignored');
  const cardGames = new Set(out.cards.map((c) => `${c.league}:${c.game_id}`));
  assert.deepEqual([...cardGames].sort(), ['nba:601', 'nba:602', 'nba:603', 'nhl:611'], 'cards only for the next two days');
  assert.ok(out.cap.length > 0 && out.cap.every((p) => p.league === 'nba' && p.price >= 1 && p.price <= 40));
  assert.ok(out.cap.every((p) => ['601', '602', '603'].includes(p.game_id)));
  JSON.stringify(out);
});
await ta('buildSlate: refuses to publish when the feed is down for everything', async () => {
  await assert.rejects(L.buildSlate({ day, getScoreboard: feed(new Error('Failed to fetch')), loadPool: async () => null, buildProps }), /did not answer/);
});
await ta('buildSlate: one league failing does not stop the others, and a roster failure still gives winner and total cards', async () => {
  let n = 0;
  const gs = async (lg) => { if (lg === 'nhl') throw new Error('nhl down'); n++; return lg === 'nba' ? [game('nba', 641, '2026-10-20T23:00Z')] : []; };
  const out = await L.buildSlate({ day, getScoreboard: gs, loadPool: async () => { throw new Error('roster feed down'); }, buildProps });
  assert.deepEqual(out.cards.map((c) => c.kind).sort(), ['team_total', 'team_total', 'total', 'winner']);
  assert.equal(out.cap.length, 0);
  assert.ok(n > 0);
});
await ta('buildResults: scores, player lines and Cap Night lines for finished games only', async () => {
  const pending = {
    games: [{ league: 'nba', game_id: '701' }, { league: 'nba', game_id: '702' }],
    cards: [{ id: 'c1', league: 'nba', game_id: '701', meta: { playerId: '1', name: 'Test Star', box: [{ g: '.', l: ['PTS'] }] } }, { id: 'c2', league: 'nba', game_id: '702', meta: { playerId: '1', name: 'Test Star', box: [{ g: '.', l: ['PTS'] }] } }],
    cap: [{ day, player_id: '1', league: 'nba', game_id: '701', name: 'Test Star' }, { day, player_id: '3', league: 'nba', game_id: '701', name: 'Bench Guy' }, { day, player_id: '1', league: 'nba', game_id: '702', name: 'Test Star' }],
  };
  const getSummary = async (lg, id) => (id === '701' ? sumFor(lg, id) : sumFor(lg, id, { state: 'in', hs: 50, as: 45, detail: '3rd Quarter', clock: '4:00', period: 3 }));
  const out = await L.buildResults({ pending, getSummary });
  assert.deepEqual(out.p_games.map((g) => [g.game_id, g.state]), [['701', 'post'], ['702', 'in']]);
  assert.deepEqual(out.p_actuals, [{ card_id: 'c1', actual: 38 }], 'the game still going reports no player lines');
  assert.equal(out.p_cap.length, 2);
  assert.equal(out.p_cap.find((x) => x.player_id === '3').dnp, true);
  const failing = await L.buildResults({ pending, getSummary: async () => { throw new Error('boom'); } });
  assert.deepEqual(failing, { p_games: [], p_actuals: [], p_cap: [] });
});

/* ---------- full pass through the real database ---------- */
if (PG.available()) {
  await ta('end to end: slate -> publish -> duel -> final box score -> settle -> payout', async () => {
    const db = PG.createDb();
    try {
      db.applySchema(); db.at('2026-10-20 10:00-04');
      const g = game('nba', 801, '2026-10-20T23:00Z');
      const out = await L.buildSlate({ day, getScoreboard: feed({ 'nba:20261020': [g] }), loadPool: async (x) => fakePool(x.league, x), buildProps, survivorLeagues: ['nba'] });
      const pub = db.rpc('bot_publish', { p_games: out.games, p_cards: out.cards, p_cap: out.cap }, 'service_role');
      assert.equal(pub.games, 1); assert.equal(pub.cards_new, out.cards.length); assert.equal(pub.cap_new, out.cap.length);
      assert.equal(db.rpc('bot_publish', { p_games: out.games, p_cards: out.cards, p_cap: out.cap }, 'service_role').cards_new, 0, 'a second morning run changes nothing');

      const owner = db.one('select code from invites where owner limit 1');
      const a = db.rpc('hf_signup', { p_invite: owner, p_handle: 'ragavan' });
      const b = db.rpc('hf_signup', { p_invite: db.rpc('hf_invite_make', { p_token: a.token }).code, p_handle: 'bro' });
      const d = db.rpc('hf_duel_create', { p_token: a.token, p_op: 'e2e-create-0001', p_length: 'game', p_stake: 100, p_game: 'nba:801' }).duel;
      assert.equal(d.cards.length, 3);
      db.rpc('hf_duel_accept', { p_token: b.token, p_duel: d.id, p_op: 'e2e-accept-0001' });
      for (const c of d.cards) { db.rpc('hf_duel_pick', { p_token: a.token, p_duel: d.id, p_card: c.id, p_side: 'a' }); db.rpc('hf_duel_pick', { p_token: b.token, p_duel: d.id, p_card: c.id, p_side: 'b' }); }

      db.at('2026-10-20 20:30-04'); // game is on
      let pending = db.rpc('bot_pending', {}, 'service_role');
      assert.equal(pending.games.length, 1);
      const live = await L.buildResults({ pending, getSummary: async (lg, id) => sumFor(lg, id, { state: 'in', hs: 60, as: 55, detail: '2nd Quarter', clock: '1:00', period: 2 }) });
      db.rpc('bot_results', live, 'service_role');
      assert.equal(db.one("select status from games where game_id = '801'"), 'in');

      db.at('2026-10-20 22:45-04'); // game over: home 112, away 104 (fixture), Test Star scored 38
      pending = db.rpc('bot_pending', {}, 'service_role');
      const done = await L.buildResults({ pending, getSummary: async (lg, id) => sumFor(lg, id) });
      db.rpc('bot_results', done, 'service_role');
      assert.equal(db.one("select status from games where game_id = '801'"), 'post');
      assert.equal(db.one("select count(*) from payouts"), '0', 'inside the 30 minute wait');
      db.at('2026-10-20 23:20-04');
      db.rpc('bot_results', {}, 'service_role');
      const fin = db.rpc('hf_duel_get', { p_token: a.token, p_duel: d.id }).duel;
      assert.equal(fin.status, 'settled');
      assert.ok(fin.cards.every((c) => c.status === 'final' || c.status === 'void'));
      assert.equal(fin.cards.filter((c) => c.status === 'final').length, fin.result.valid);
      if (fin.winner) assert.equal(db.one(`select amount from payouts where kind = 'duel_win'`), '190');
      // a settled game is not reported again
      assert.equal(db.rpc('bot_pending', {}, 'service_role').games.length, 0);
    } finally { db.drop(); }
  });
} else console.log('  (database checks skipped: no Postgres)');

console.log(`\n${passed} bot checks passed`);
