// Crew server client: sign-in, calls, coin receipts and device sync. No framework, no build.
// The server is Supabase Postgres, reached only through functions (see supabase/schema.sql).
import { dailyBonus } from './economy.js';
import { SOCIAL } from './social-config.js';
import { extrasOf } from './profile-stats.js';
import { getState, update, spendCoins, addCoins, onSaved, mergeClaims, SYNCED_SETTINGS } from './store.js';
import { betStats } from './bets.js';
import { itemById, priceOf } from './avatar.js';

export const VERSION = 1;
const SKEY = 'homefield:social';

/* ---------- storage kept apart from the main save, so a reset of bets never signs you out ---------- */
const mem = {};
const store = (() => {
  try { if (typeof localStorage !== 'undefined') { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } } catch (e) { /* private mode */ }
  return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
})();
const blank = () => ({ token: '', me: null, pending: [], credited: [], ver: 0, hash: '', synced: false });
let S = (() => { try { return { ...blank(), ...JSON.parse(store.getItem(SKEY) || '{}') }; } catch (e) { return blank(); } })();
const save = () => { try { store.setItem(SKEY, JSON.stringify(S)); } catch (e) { /* storage full */ } };

export const enabled = () => !!(SOCIAL.url && SOCIAL.key);
export const signedIn = () => !!(S.token && S.me);
export const me = () => S.me;
export const pendingOps = () => S.pending.slice();

/* ---------- plain-words errors ---------- */
const WORDS = {
  not_signed_in: 'You are signed out. Sign in again.', off: 'The crew games are paused for now.', update: 'Reload the app to get the latest version.',
  bad_invite: 'That invite code does not work (used up, expired or mistyped).', bad_handle: 'Handles are 3 to 16 letters, numbers or underscores.',
  handle_taken: 'Someone already has that handle.', bad_login: 'Handle or recovery code is wrong.', locked: 'Too many tries. Wait 15 minutes.',
  slow_down: 'Too many tries. Wait a bit.', bad_stake: 'That stake is not allowed (10 to 500 coins).', too_many: 'You have too many open duels.',
  bad_post: 'Posts are 1 to 280 characters.', no_such_post: 'That post is gone.',
  no_such_player: 'No one in your crew has that handle.', no_such_game: 'That game is not available.', bad_day: 'Pick today or tomorrow.',
  not_enough_cards: 'Not enough cards for that yet. Try later, after the next slate.', no_such_duel: 'That duel is gone.', not_yours: 'That one is not yours.',
  expired: 'That challenge expired.', taken: 'Someone already took that challenge.', not_open: 'That duel is not open anymore.', not_active: 'That duel is not active.',
  no_such_card: 'That card is not in this duel.', no_such_pool: 'That pool does not exist.', closed: 'It is too late for that one.', already_in: 'You are already in.',
  not_in: 'You are not in this pool.', team_used: 'You already used that team.', no_such_team: 'That team is not in that game.', over_cap: 'Over the salary cap.',
  team_limit: 'No more than 2 players from one team.', too_many_players: 'Five players max.', unknown_player: 'That player is not on tonight\'s list.',
  own_fit: 'You cannot like your own fit.', no_such_fit: 'That fit is gone.', owner_only: 'Only the crew owner can do that.', duplicate: 'You picked the same player twice.', too_big: 'Too much data to sync.', offline: 'Could not reach the server. Check your connection.',
};
export class SocialError extends Error {
  constructor(code, msg) { super(msg || WORDS[code] || code); this.code = code; }
}

/* ---------- raw calls ---------- */
async function rpc(fn, args = {}, { timeout = 15000 } = {}) {
  if (!enabled()) throw new SocialError('off', 'The crew games are not set up in this copy of the app.');
  const headers = { 'content-type': 'application/json', apikey: SOCIAL.key, 'x-client-info': `homefield/${VERSION}` };
  if (!SOCIAL.key.startsWith('sb_')) headers.authorization = `Bearer ${SOCIAL.key}`;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
  let res;
  try { res = await fetch(`${SOCIAL.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args), signal: ctl ? ctl.signal : undefined }); } catch (e) {
    throw new SocialError('offline');
  } finally { if (timer) clearTimeout(timer); }
  let body = null;
  try { body = await res.json(); } catch (e) { /* not json */ }
  if (!res.ok) {
    const m = body && typeof body.message === 'string' ? body.message.match(/hf:([a-z_]+)/) : null;
    if (m) { if (m[1] === 'not_signed_in') signOutLocal(); throw new SocialError(m[1]); }
    throw new SocialError(res.status >= 500 ? 'offline' : 'bad_request', body && body.message ? String(body.message) : `Server said ${res.status}`);
  }
  if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.error === 'string') throw new SocialError(body.error);
  return body;
}
/** A call that carries your sign-in token. */
export const call = (fn, args = {}, opts) => rpc(fn, { p_token: S.token, ...args }, opts);

export async function ping() { try { return await rpc('hf_ping', {}, { timeout: 8000 }); } catch (e) { return { ok: false, error: e.code }; } }

/* ---------- account ---------- */
function signOutLocal() { S = { ...blank(), pending: S.pending, credited: S.credited }; save(); listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); }
const listeners = new Set();
export const onAuthChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const deviceName = () => { try { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Browser'; } catch (e) { return 'Browser'; } };

export async function signup(invite, handle, display) {
  const r = await rpc('hf_signup', { p_invite: invite, p_handle: handle, p_display: display || null, p_device: deviceName() });
  S.token = r.token; S.me = r.me; S.synced = false; save();
  listeners.forEach((f) => f());
  await syncNow().catch(() => {});
  return r; // r.code is the recovery code, shown once
}
export async function login(handle, code) {
  const r = await rpc('hf_login', { p_handle: handle, p_code: code, p_device: deviceName() });
  S.token = r.token; S.me = r.me; S.synced = false; save();
  listeners.forEach((f) => f());
  await syncNow().catch(() => {});
  return r;
}
export async function logout() { try { await call('hf_logout'); } catch (e) { /* signing out anyway */ } signOutLocal(); }
export async function refreshMe() { const r = await call('hf_whoami'); S.me = r.me; save(); return r.me; }
export const newCode = () => call('hf_new_code');
export const setDisplay = async (name) => { await call('hf_set_display', { p_display: name }); await refreshMe(); };
export const crew = () => call('hf_crew');
export const wallGet = () => call('hf_wall_get');
export const wallPost = (body) => call('hf_wall_post', { p_body: body });
export const wallDel = (id) => call('hf_wall_del', { p_id: id });
export const wallCheer = (id) => call('hf_wall_cheer', { p_id: id });
export const makeInvite = (uses = 1, days = 14) => call('hf_invite_make', { p_uses: uses, p_days: days });
export const invites = () => call('hf_invites');
export const revokeInvite = (code) => call('hf_invite_revoke', { p_code: code });
export const fitLike = (handle, fit = 'current') => call('hf_fit_like', { p_handle: handle, p_fit: fit });
export const removeMember = (handle) => call('hf_member_remove', { p_handle: handle });

/* ---------- coin receipts ----------
   A stake is taken from your coins here first, then the server is told. Each call carries an op id so a retry
   can never take the stake twice. Winnings and refunds wait on the server until you claim them once. */
export const newOp = () => 'o' + Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Spend `amount` locally, run `fn(op)`, and give the coins back if the server definitely said no. */
export async function withStake(amount, kind, fn) {
  if (!spendCoins(amount, { k: 'game', note: kind })) throw new SocialError('no_coins', `You need ${amount} coins for that.`);
  const op = newOp();
  S.pending.push({ op, amount, kind, at: Date.now() }); save();
  try {
    const r = await fn(op);
    S.pending = S.pending.filter((p) => p.op !== op); save();
    return r;
  } catch (e) {
    if (e.code === 'offline') throw new SocialError('offline', 'Could not reach the server. Your coins are held and will sort themselves out when you are back online.');
    S.pending = S.pending.filter((p) => p.op !== op); save();
    addCoins(amount, { k: 'game-back', note: `${kind}: the server said no` });
    throw e;
  }
}
/** Settle stakes whose answer never arrived: if the server has the op the coins stay spent, otherwise they come back. */
export async function reconcile() {
  const old = S.pending.filter((p) => Date.now() - p.at > 60000);
  if (!old.length || !signedIn()) return 0;
  const r = await call('hf_op_status', { p_ops: old.map((p) => p.op) });
  const known = new Set(r.known || []);
  let back = 0;
  for (const p of old) { if (!known.has(p.op)) { addCoins(p.amount, { k: 'game-back', note: `${p.kind}: stake returned` }); back += p.amount; } }
  S.pending = S.pending.filter((p) => !old.includes(p)); save();
  return back;
}
export const waiting = () => call('hf_payouts');
/** Take everything waiting (winnings, refunds, prizes) and add it to your coins, exactly once. */
export async function claim() {
  const r = await call('hf_claim');
  if (r && r.total > 0 && !S.credited.includes(r.claim_id)) {
    S.credited.push(r.claim_id); S.credited = S.credited.slice(-30); save();
    addCoins(r.total, { k: 'game-win', note: 'Duel, survivor and cap night payouts' });
  }
  return r;
}

/* ---------- device sync ----------
   Your fan (avatar, teams, coins, bets) is saved to the server so a second device can pick it up after sign-in.
   If both devices changed, teams, bets and owned items are merged; coins come from the side with more XP. */
// A cash out is a decision you made on purpose, so it beats a settle another device worked out by itself from the box score.
const betScore = (b) => (b && b.cashed ? 3 : b && b.status && b.status !== 'pending' ? 2 : 1);
export function mergeFan(local, remote) {
  if (!remote) return local;
  const out = { ...local };
  const teamKey = (t) => `${t.league}:${t.id}`;
  const seen = new Set(local.teams.map(teamKey));
  out.teams = [...local.teams, ...(remote.teams || []).filter((t) => !seen.has(teamKey(t)))];
  out.bets = { ...(remote.bets || {}) };
  for (const [k, b] of Object.entries(local.bets || {})) if (!out.bets[k] || betScore(b) >= betScore(out.bets[k])) out.bets[k] = b;
  // games watched: everything either device saw, keeping the later time
  out.watched = { ...(remote.watched || {}) };
  for (const [k, v] of Object.entries(local.watched || {})) if (!out.watched[k] || (v.ts || 0) >= (out.watched[k].ts || 0)) out.watched[k] = v;
  // a game taken off the list on one device stays off, unless it was marked again afterwards
  const gone = { ...(remote.unwatched || {}) };
  for (const [k, v] of Object.entries(local.unwatched || {})) gone[k] = Math.max(v, gone[k] || 0);
  for (const [k, ts] of Object.entries(gone)) if (out.watched[k] && (out.watched[k].ts || 0) <= ts) delete out.watched[k];
  out.unwatched = gone;
  const lb = local.bank || {}, rb = remote.bank || {};
  // rev goes up with every coin change, so the higher one has seen more (a quest claim earns coins but no xp).
  // Copies saved before rev existed fall back to xp: same xp means nothing was earned in between, so the lower balance already paid for something.
  const lr = lb.rev || 0, rr = rb.rev || 0;
  const useLocal = lr !== rr ? lr > rr : (lb.xp || 0) > (rb.xp || 0) || ((lb.xp || 0) === (rb.xp || 0) && (lb.coins || 0) <= (rb.coins || 0));
  out.bank = { ...(useLocal ? lb : rb) };
  // Once-a-day things are claimed once across all your devices: the later claim day wins, and so do quest claims.
  const chosen = useLocal ? lb : rb, later = (rb.lastDaily || '') > (lb.lastDaily || '') ? rb : lb;
  if ((later.lastDaily || '') > (chosen.lastDaily || '')) {
    out.bank.coins = (out.bank.coins || 0) + dailyBonus(later.dailyStreak || 1); // their bonus was real, don't lose it
    out.bank.peak = Math.max(out.bank.peak || 0, out.bank.coins);
  }
  if (later.lastDaily) { out.bank.lastDaily = later.lastDaily; out.bank.dailyStreak = later.dailyStreak || 0; }
  // Things bought on the other device have to be paid for here too, or a sync would hand the coins back.
  const haveOwned = new Set(((useLocal ? local : remote).avatar || {}).owned || []);
  const unpaid = [...new Set([...((local.avatar || {}).owned || []), ...((remote.avatar || {}).owned || [])])].filter((id) => !haveOwned.has(id));
  const cost = unpaid.reduce((n, id) => { const it = itemById(id); return n + (it && !it.ach ? priceOf(it) || 0 : 0); }, 0);
  if (cost) out.bank.coins = Math.max(0, (out.bank.coins || 0) - cost);
  out.bank.rescued = [lb.rescued || '', rb.rescued || ''].sort().pop();
  // records only ever go up, whichever device set them
  out.bank.peak = Math.max(out.bank.peak || 0, lb.peak || 0, rb.peak || 0);
  out.bank.bestStreak = Math.max(out.bank.bestStreak || 0, lb.bestStreak || 0, rb.bestStreak || 0);
  // looks and spoiler settings: whichever device changed them last
  out.prefs = (remote.prefs && (remote.prefs.at || 0) > ((local.prefs && local.prefs.at) || 0)) ? remote.prefs : (local.prefs || remote.prefs || null);
  // the coin log: everything either device recorded, oldest first
  const seenL = new Set(), allL = [];
  for (const e of [...(remote.ledger || []), ...(local.ledger || [])]) { const k = `${e.ts}|${e.k}|${e.d}`; if (!seenL.has(k)) { seenL.add(k); allL.push(e); } }
  out.ledger = allL.sort((x, y) => x.ts - y.ts).slice(-600);
  out.claims = mergeClaimSets(local.claims, remote.claims);
  const la = local.avatar || {}, ra = remote.avatar || {};
  out.avatar = { ...(useLocal ? ra : la), ...(useLocal ? la : ra), owned: [...new Set([...(la.owned || []), ...(ra.owned || [])])], gone: mergeGone(la.gone, ra.gone) };
  out.avatar.fits = mergeFits(la.fits, ra.fits).filter((f) => !out.avatar.gone.includes(f.id));
  if (!out.avatar.gone.length) delete out.avatar.gone;
  return out;
}
function mergeClaimSets(a, b) {
  if (!a || !b) return a || b || null;
  const pick = (x, y, key) => (x[key] === y[key] ? [...new Set([...(x[key + 's'] || []), ...(y[key + 's'] || [])])] : (x[key] > y[key] ? x : y)[key + 's'] || []);
  const day = a.day > b.day ? a.day : b.day, week = a.week > b.week ? a.week : b.week;
  // progress only carries over when both copies are on the same day or week; then the bigger count wins and "once" keys are shared
  const prog = (key, nk, ok, cur) => { const sides = [a, b].filter((x) => x[key] === cur); const n = {}; for (const x of sides) for (const [m, v] of Object.entries(x[nk] || {})) n[m] = Math.max(n[m] || 0, v); return [n, [...new Set(sides.flatMap((x) => x[ok] || []))]]; };
  const [dn, dO] = prog('day', 'dn', 'do', day), [wn, wO] = prog('week', 'wn', 'wo', week);
  return { day, week, days: pick(a, b, 'day'), weeks: pick(a, b, 'week'), dn, do: dO, wn, wo: wO };
}
/** ids of saved fits that were deleted on either copy; they stay deleted */
const mergeGone = (a = [], b = []) => [...new Set([...a, ...b])].slice(-60);
function mergeFits(a = [], b = []) { const m = new Map(); for (const f of [...b, ...a]) m.set(f.id, f); return [...m.values()]; }

const prefsOf = (s) => ({ at: s.prefsAt || 0, shareBets: s.shareBets !== false, ...Object.fromEntries(SYNCED_SETTINGS.map((k) => [k, (s.settings || {})[k]])) });
const fanOf = (s) => {
  const bets = Object.fromEntries(Object.entries(s.bets || {}).sort((x, y) => (y[1].placedAt || 0) - (x[1].placedAt || 0)).slice(0, 400));
  const q = s.quests || {};
  const watched = Object.fromEntries(Object.entries(s.watched || {}).sort((x, y) => (y[1].ts || 0) - (x[1].ts || 0)).slice(0, 300));
  return { teams: s.teams, avatar: s.avatar, bank: s.bank, bets, watched, unwatched: s.unwatched || {}, claims: { day: q.day || '', week: q.week || '', days: (q.daily && q.daily.claimed) || [], weeks: (q.weekly && q.weekly.claimed) || [],
      dn: (q.daily && q.daily.n) || {}, do: Object.keys((q.daily && q.daily.once) || {}), wn: (q.weekly && q.weekly.n) || {}, wo: Object.keys((q.weekly && q.weekly.once) || {}) },
    prefs: prefsOf(s), ledger: (s.ledger || []).slice(-250) };
};
/** the last few bets, trimmed for the crew to see (and mirror) */
function recentOf(bets, n = 6) {
  const all = Object.values(bets || {}).sort((x, y) => (y.ts || y.placedAt || 0) - (x.ts || x.placedAt || 0));
  // open tickets first (they are what people want to see and mirror), then the newest results
  const open = all.filter((b) => b.status === 'pending').slice(0, Math.min(4, n));
  return [...open, ...all.filter((b) => !open.includes(b)).slice(0, Math.max(0, n - open.length))].sort((x, y) => (y.ts || y.placedAt || 0) - (x.ts || x.placedAt || 0))
    .map((b) => ({ id: b.id, ts: b.ts || b.placedAt || 0, mode: b.mode, stake: b.stake, dec: b.dec, status: b.status, payout: b.payout || 0, cashed: !!b.cashed || undefined, legs: (b.legs || []).map((l) => ({ ...l })) }));
}
export function publicOf(s) {
  const st = betStats(s.bets || {}, s.bank);
  const t = s.teams.find((x) => `${x.league}:${x.id}` === s.avatar.team) || s.teams[0] || null;
  const out = { avatar: s.avatar, team: t ? { league: t.league, id: t.id, abbr: t.abbr, name: t.name, color: t.color, alt: t.alt } : null,
    stats: { won: st.won, lost: st.lost, accuracy: st.accuracy, total: st.total, streak: st.streak, bestStreak: st.bestStreak, coins: s.bank.coins,
      profit: Math.round(st.profit), parlays: st.parlayWins, bigParlay: st.biggestParlay, longshot: st.longshot ? st.longshot.dec : 0,
      biggest: st.biggest ? Math.round(st.biggest.payout - st.biggest.stake) : 0, watched: Object.keys(s.watched || {}).length, ...extrasOf(s) } };
  // recent bets ride along unless the player turned sharing off; trim them if the whole thing gets too big for the server
  if (s.shareBets !== false) {
    for (let n = 6; n >= 0; n -= 2) { out.stats.recent = recentOf(s.bets, n); if (JSON.stringify(out).length < 26000) break; }
    if (!out.stats.recent.length) delete out.stats.recent;
  }
  return out;
}
let syncing = null, applying = false, delay = 1500;
export const _setDelay = (ms) => { delay = ms; };
export function syncNow() {
  if (!enabled() || !signedIn()) return Promise.resolve(false);
  if (syncing) return syncing;
  syncing = (async () => {
    const remote = await call('hf_sync_get');
    const st = getState();
    if (remote.data && remote.data.teams) {
      const merged = mergeFan(fanOf(st), remote.data);
      applying = true;
      try { update((s) => { s.teams = merged.teams; s.bets = merged.bets; s.watched = merged.watched || s.watched; s.unwatched = merged.unwatched || s.unwatched || {};
        if (merged.prefs && (merged.prefs.at || 0) >= (s.prefsAt || 0) && merged.prefs.at) { for (const k of SYNCED_SETTINGS) if (merged.prefs[k] !== undefined) s.settings[k] = merged.prefs[k]; s.shareBets = merged.prefs.shareBets; s.prefsAt = merged.prefs.at; }
        if (merged.ledger) s.ledger = merged.ledger; s.bank = { ...s.bank, ...merged.bank }; s.avatar = { ...s.avatar, ...merged.avatar }; if (!s.onboarded && s.teams.length) s.onboarded = true; }, { k: 'sync', note: 'Brought in from your other device', quiet: Array.isArray(remote.data.ledger) });
        mergeClaims(merged.claims);
      } finally { applying = false; }
    }
    S.ver = remote.ver || 0; S.synced = true; save();
    if (typeof window !== 'undefined' && remote.data && remote.data.teams) window.dispatchEvent(new Event('hf-synced')); // open pages redraw with what came down
    await push();
    return true;
  })().finally(() => { syncing = null; });
  return syncing;
}
const hashOf = (str) => { let a = 5381, b = 52711; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = ((a << 5) + a) ^ c; b = ((b << 5) + b) ^ c; } return `${str.length}:${a >>> 0}:${b >>> 0}`; };
async function push() {
  const st = getState();
  const data = fanOf(st);
  const hash = hashOf(JSON.stringify(data));
  if (hash === S.hash) return;
  let r = await call('hf_sync_put', { p_base: S.ver, p_data: data, p_public: publicOf(st) });
  if (r.conflict) { S.ver = r.ver; save(); r = await call('hf_sync_put', { p_base: S.ver, p_data: fanOf(getState()), p_public: publicOf(getState()) }); }
  if (r.ver) { S.ver = r.ver; S.hash = hash; save(); }
}
let pushTimer = null;
/** Call after the fan changes. Saves a few seconds later, in the background. */
export function queueSync() {
  if (!enabled() || !signedIn() || applying) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { syncNow().catch(() => {}); }, delay);
}

/** Run once when the app opens, and again when it comes back to the foreground. */
export function startSocial() {
  if (!enabled()) return;
  const tick = () => { if (signedIn()) { reconcile().catch(() => {}); syncNow().catch(() => {}); } };
  onSaved(queueSync);
  tick();
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (signedIn()) { clearTimeout(pushTimer); syncNow().catch(() => {}); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); else if (signedIn()) { clearTimeout(pushTimer); syncNow().catch(() => {}); } });
}

/* ---------- crew games ---------- */
export const slate = () => call('hf_slate');
export const duels = () => call('hf_duels');
export const duel = (id) => call('hf_duel_get', { p_duel: id });
export const duelCreate = (a) => withStake(a.stake, 'duel_create', (op) => call('hf_duel_create', { p_op: op, p_length: a.length, p_stake: a.stake, p_opponent: a.opponent || null, p_game: a.game || null, p_day: a.day || null }));
export const duelAccept = (id, stake) => withStake(stake, 'duel_accept', (op) => call('hf_duel_accept', { p_duel: id, p_op: op }));
export const duelCancel = (id) => call('hf_duel_cancel', { p_duel: id });
export const duelPick = (id, card, side) => call('hf_duel_pick', { p_duel: id, p_card: card, p_side: side });
export const daily = () => call('hf_daily');
export const dailyPick = (card, side) => call('hf_daily_pick', { p_card: card, p_side: side });
export const survivor = () => call('hf_survivor');
export const survivorJoin = (pool, entry) => withStake(entry, 'survivor_join', (op) => call('hf_survivor_join', { p_pool: pool, p_op: op }));
export const survivorLeave = (pool) => call('hf_survivor_leave', { p_pool: pool });
export const survivorPick = (pool, game, team) => call('hf_survivor_pick', { p_pool: pool, p_game: game, p_team: team });
export const cap = (day) => call('hf_cap', { p_day: day || null });
export const capSet = (day, players) => call('hf_cap_set', { p_day: day, p_players: players });

/** For tests: swap the saved state. */
export function _reset() { S = blank(); save(); }
export const _state = () => S;
