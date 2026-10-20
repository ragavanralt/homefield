// Feeds the crew screens the emptiest, most null-filled answers the server could give and checks nothing breaks
// and no "null", "undefined", "NaN" or "Invalid Date" leaks onto the page.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script type="module">[\s\S]*?<\/script>/, '').replace(/<link[^>]+>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['document', 'location', 'history', 'navigator', 'localStorage', 'Node', 'HTMLElement', 'Blob', 'URL', 'Event', 'CustomEvent', 'requestAnimationFrame', 'MutationObserver', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch (e) { /* node has its own */ }
}
globalThis.window = w; w.scrollTo = () => {}; w.HTMLCanvasElement.prototype.getContext = () => null;
const errors = [];
w.addEventListener('error', (e) => errors.push(e.error || e.message));
process.on('unhandledRejection', (e) => errors.push(e));

const me = { id: 'u1', handle: 'raggy', display: 'raggy', owner: true, crew: { id: 'c1', name: 'Crew' } };
const iso = (h) => new Date(Date.UTC(2030, 9, 22, h)).toISOString();
const card = (o = {}) => ({ id: 'c' + Math.random(), kind: 'winner', league: 'nba', game_id: '1', title: 'A at B', a: 'B', b: 'A', line: null, start_at: iso(23), status: 'open', outcome: null, actual: null, meta: null, locked: false, mine: null, their_made: false, theirs: null, ...o });
const duel = (o = {}) => ({ id: 'd1', length: 'game', stake: 50, target: 3, status: 'open', creator: { handle: 'bro', display: 'bro', avatar: null, team: null }, opponent: null, you: 'viewer', created_at: iso(10), expires_at: iso(20), accepted_at: null, window_end: null, day: null, winner: null, result: null, cards: [card()], pot: 100, cut_pct: 5, ...o });
const R = {
  hf_ping: { ok: true }, hf_payouts: { total: 0, items: null }, hf_claim: { claim_id: 'x', total: 0, items: [] },
  hf_crew: { me, members: [{ handle: 'raggy', display: 'raggy', owner: true, me: true, avatar: null, team: null, stats: null, solo_streak: null, solo_best: null, last_seen: null, duel_w: 0, duel_l: 0, duel_t: 0, likes: null, liked: null },
    { handle: 'bro', display: 'bro', owner: false, me: false, avatar: { eq: {}, fits: null, owned: null }, team: null, stats: { won: null, accuracy: null }, duel_w: 0, duel_l: 0, duel_t: 0 }] },
  hf_invites: { invites: null },
  hf_duels: { open: [duel(), duel({ id: 'd2', opponent: null, creator: { handle: 'x', display: 'x' } })], mine: [duel({ you: 'creator', status: 'settled', winner: null, result: { tie: true } }), duel({ id: 'd3', you: 'creator', status: 'void', result: {} })], record: { w: 0, l: 0, t: 0 } },
  hf_daily: { day: '2030-10-22', coins_per_win: 10, streak: null, best: null, last: null, cards: [card({ result: null }), card({ kind: 'total', line: 220.5, a: 'Over', b: 'Under', status: 'final', outcome: null, locked: true })] },
  hf_slate: { today: '2030-10-22', games: [], open_cards: 0 },
  hf_duel_get: { duel: duel({ id: 'd9', status: 'active', you: 'creator', opponent: { handle: 'bro', display: 'bro', avatar: null, team: null }, cards: [card({ status: 'final', outcome: null, locked: true }), card({ status: 'void', locked: true }), card({ status: 'final', outcome: 'push', locked: true, mine: 'a' }), card({ kind: 'player', line: 20.5, a: 'Over', b: 'Under', title: 'P pts', actual: null })] }) },
  hf_survivor: { pools: [{ id: 'p1', league: 'nfl', round: 1, status: 'open', entry: 50, period: null, lock_at: null, pot: 0, joined: false, alive: false, picks: [], games: [], entries: [], last: null },
    { id: 'p2', league: 'nba', round: 2, status: 'live', entry: 50, period: null, lock_at: null, pot: 100, joined: true, alive: true, picks: [{ period: '2030-10-21', team_id: 't', result: null, auto: true }],
      games: [{ game_id: '1', start_at: iso(23), status: 'pre', home: { id: 'h', name: 'H', abbr: null }, away: { id: 'a', name: null, abbr: 'A' }, fav_team: null, fav_prob: null }],
      entries: [{ handle: 'x', display: 'x', alive: false, out_period: null, pick: null }], last: { round: 1, winners: null, pot: 0 } }] },
  hf_cap: { day: '2030-10-22', week: '2030-10-21', budget: 40, max_per_team: 2, slots: 5, night_prize: 100, week_prize: 300, players: [{ id: 'z1', name: 'Z', team_id: 't', team: null, pos: null, face: null, price: 5, avg: null, game_id: '1', start_at: iso(23), score: null, dnp: null, stats: null }],
    days: [], mine: [], cost: 0, closed: false, board: [{ name: 'x', handle: 'x', me: false, count: 0, score: null, final: false, picks: null }], week_board: [{ name: 'x', handle: 'x', me: false, total: null, nights: 0 }] },
};
globalThis.fetch = async (url, init) => {
  const fn = String(url).split('/rpc/')[1];
  const body = fn === 'hf_signup' || fn === 'hf_login' ? { token: 'tok'.padEnd(30, 'x'), code: 'AAAA-BBBB-CCCC-DDDD', me } : (R[fn] ?? { ok: true });
  return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
};

const { SOCIAL } = await import('../js/social-config.js');
SOCIAL.url = 'https://example.supabase.co'; SOCIAL.key = 'sb_publishable_test';
const { route } = await import('../js/main.js');
const store = await import('../js/store.js');
const soc = await import('../js/social.js');
store.setOnboarded(true);
await soc.login('raggy', 'AAAA-BBBB-CCCC-DDDD');
const BAD = /null|undefined|NaN|Invalid Date|\[object/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
for (const hash of ['#/crew', '#/duels', '#/duels/d9', '#/survivor', '#/cap']) {
  w.location.hash = hash; await route(); await sleep(400);
  const t = w.document.getElementById('app').textContent;
  assert.ok(!/Something broke|Could not load/.test(t), `${hash} broke: ${t.slice(0, 200)}`);
  assert.ok(!BAD.test(t), `${hash} shows stray text: ` + (t.match(new RegExp('.{0,50}(' + BAD.source + ').{0,50}')) || [''])[0]);
  assert.ok(t.length > 40, hash + ' is empty');
  if (process.env.DUMP) console.log('---', hash, '\n' + t.replace(/\s{2,}/g, ' | ').slice(0, 900));
  n++; console.log('  ok  ' + hash + ' handles empty and null data');
}
assert.deepEqual(errors, [], 'script errors: ' + errors.map((e) => (e && e.stack) || e).join('\n'));
console.log(`${n} null-safety checks passed`);
process.exit(0);
