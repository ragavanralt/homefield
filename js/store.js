// Everything the app remembers lives on this device in localStorage. No accounts.
import { isSoccer } from './leagues.js';
import { dayKey, weekKey } from './period.js';
import { dailyBonus } from './economy.js';
import { START_COINS, MIN_STAKE, MAX_LEGS, conflicts, parlayDec, xpFor } from './bets.js';

const KEY = 'homefield:v1';

const memory = {};
const storage = (() => {
  try {
    if (typeof localStorage !== 'undefined') { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; }
  } catch (e) { /* private mode */ }
  return { getItem: (k) => memory[k] ?? null, setItem: (k, v) => { memory[k] = v; }, removeItem: (k) => { delete memory[k]; } };
})();

const fresh = () => ({
  v: 1,
  onboarded: false,
  teams: [],
  settings: { logos: true, spoilerFree: false, theme: 'auto', bgDark: 'noir', bgLight: 'ivory', accent: 'gold', teamMode: true, hidden: [], oddsKey: '', papiKey: '', papiFirst: false },
  bank: { coins: START_COINS, xp: 0, streak: 0, bestStreak: 0, peak: START_COINS, lastDaily: '', dailyStreak: 0, rescued: '' },
  bets: {},
  ledger: [],
  slip: { legs: [], mode: 'single', stake: 50 },
  notices: [],
  watched: {},
  ask: { day: '', n: 0 },
  soccerLeague: 'uefa.champions',
  lastMode: 'classic',
  quests: { day: '', week: '', daily: { n: {}, once: {}, claimed: [] }, weekly: { n: {}, once: {}, claimed: [] } },
  avatar: { skin: 2, hairColor: 0, body: 1, team: '', colV: 1, colOwned: {}, away: false, col: {}, eq: { hair: 'short', top: 'tee', bottom: 'jeans', shoes: 'sneakers' }, owned: ['short', 'buzz', 'curls', 'smile', 'smirk', 'tee', 'jeans', 'sneakers', 'night', 'dusk'], spent: 0 },
});

function mergeAvatar(d, a) {
  const had = !!a; a = a || {};
  // saves from before colours were unlocked one by one (no colV) keep every colour they already had
  return { ...d, ...a, colV: had ? a.colV : d.colV, colOwned: { ...(a.colOwned || {}) }, col: { ...(a.col || {}) }, eq: { ...d.eq, ...(a.eq || {}) }, owned: [...new Set([...d.owned, ...(Array.isArray(a.owned) ? a.owned : [])])] };
}

let state = load();

function load() {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const f = fresh();
    return { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) }, bank: { ...f.bank, ...(s.bank || {}) }, slip: { ...f.slip, ...(s.slip || {}) }, avatar: mergeAvatar(f.avatar, s.avatar) };
  } catch (e) { return fresh(); }
}
function save() { try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full */ } }

export const getState = () => state;
let saveHook = null;
/** Called after every change is saved. The crew sync uses it to back changes up in the background. */
export const onSaved = (fn) => { saveHook = fn; };
export function update(fn, tag) {
  const coins0 = state.bank && state.bank.coins, rev0 = (state.bank && state.bank.rev) || 0;
  fn(state);
  // every coin change bumps rev, so a device sync can tell which copy of the bank is newer
  if (state.bank && state.bank.coins !== coins0) { state.bank.rev = Math.max(rev0, state.bank.rev || 0) + 1; logCoins(state.bank.coins - coins0, tag); }
  save(); if (saveHook) { try { saveHook(); } catch (e) { /* never block a save */ } } return state; }

/** The coin log: every coin that moved, which way, what for, and what you had after. Kept on this device, newest 600. */
export const LEDGER_MAX = 600;
function logCoins(d, tag) {
  if (tag && tag.quiet) return; // the other device already logged what moved the coins
  if (!Array.isArray(state.ledger)) state.ledger = [];
  state.ledger.push({ ts: Date.now(), d, bal: state.bank.coins, k: (tag && tag.k) || 'other', note: (tag && tag.note) || '' });
  if (state.ledger.length > LEDGER_MAX) state.ledger.splice(0, state.ledger.length - LEDGER_MAX);
}
export const getLedger = () => (Array.isArray(state.ledger) ? state.ledger : []);

export const myTeams = () => state.teams;
export const isFollowing = (league, id) => state.teams.some((t) => t.league === league && t.id === String(id));
export const followedIds = () => new Set(state.teams.map((t) => String(t.id)));

export function follow(team) {
  if (isFollowing(team.league, team.id)) return;
  update((s) => { s.teams.push({ league: team.league, id: String(team.id), abbr: team.abbr, name: team.name, short: team.short || team.name, color: team.color, alt: team.alt, logo: team.logo }); });
}
/** Fill in colours and logos for followed teams from live game data (the built-in lists have none). */
export function refreshFollowed(g) {
  if (!state.teams.length) return;
  let changed = false;
  for (const side of [g.home, g.away]) {
    if (!side || !side.id) continue;
    for (const t of state.teams) {
      if (t.id !== side.id || !(t.league === g.league || (isSoccer(t.league) && isSoccer(g.league)))) continue;
      if (side.color && (t.color !== side.color || t.alt !== side.alt)) { t.color = side.color; t.alt = side.alt || t.alt; changed = true; }
      if (side.logo && t.logo !== side.logo) { t.logo = side.logo; changed = true; }
    }
  }
  if (changed) save();
}
export function unfollow(league, id) { update((s) => { s.teams = s.teams.filter((t) => !(t.league === league && t.id === String(id))); }); }
export function findTeam(league, id) { return state.teams.find((t) => t.league === league && t.id === String(id)); }
export function findTeamAnyLeague(id) { return state.teams.find((t) => t.id === String(id)); }
/** The followed team playing in this game, if any. Soccer team ids are shared across competitions. */
export function myTeamIn(g) {
  return state.teams.find((t) => (t.league === g.league || (isSoccer(t.league) && isSoccer(g.league))) && (t.id === g.home.id || t.id === g.away.id)) || null;
}

export const leagueHidden = (lg) => (state.settings.hidden || []).includes(lg);
/** Looks and spoiler settings follow you between devices (newest change wins). Theme and the odds keys stay on each device. */
export const SYNCED_SETTINGS = ['accent', 'bgDark', 'bgLight', 'logos', 'teamMode', 'hidden', 'spoilerFree'];
export const toggleHidden = (lg) => update((s) => { const a = s.settings.hidden || []; s.settings.hidden = a.includes(lg) ? a.filter((x) => x !== lg) : [...a, lg]; s.prefsAt = Date.now(); });
export const setSetting = (k, v) => update((s) => { s.settings[k] = v; if (SYNCED_SETTINGS.includes(k)) s.prefsAt = Date.now(); });
export const setOnboarded = (v = true) => update((s) => { s.onboarded = v; });

/* ---------- the betting game ---------- */
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const listeners = new Set();
export const onSlipChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const ping = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });

export const getBank = () => state.bank;
export const slipHas = (key) => state.slip.legs.some((l) => l.key === key);

/** Add a leg, or take it off if it is already there. A conflicting leg on the same market is swapped out.
 * A full slip says no ({ ok: false, why: 'full' }) instead of quietly dropping a pick you already chose. */
export function toggleLeg(leg) {
  const legs = state.slip.legs;
  if (!legs.some((l) => l.key === leg.key) && legs.filter((l) => !conflicts(l, leg)).length >= MAX_LEGS) return { ok: false, why: 'full' };
  update((s) => {
    const i = s.slip.legs.findIndex((l) => l.key === leg.key);
    if (i >= 0) { s.slip.legs.splice(i, 1); return; }
    s.slip.legs = s.slip.legs.filter((l) => !conflicts(l, leg));
    s.slip.legs.push(leg);
  });
  ping();
  return { ok: true };
}
export function removeLeg(key) { update((s) => { s.slip.legs = s.slip.legs.filter((l) => l.key !== key); }); ping(); }
export function clearSlip() { update((s) => { s.slip.legs = []; }); ping(); }
export function setSlip(patch) { update((s) => { Object.assign(s.slip, patch); }); ping(); }
export const openBets = () => Object.values(state.bets).filter((b) => b.status === 'pending');

/** Turn the slip into bets and take the stake from the bankroll. */
export function placeSlip(now = Date.now()) {
  const { legs, mode, stake } = state.slip;
  if (!legs.length) return { ok: false, error: 'Your slip is empty.' };
  const started = legs.filter((l) => new Date(l.date).getTime() <= now);
  if (started.length) {
    update((s) => { s.slip.legs = s.slip.legs.filter((l) => new Date(l.date).getTime() > now); });
    ping();
    return { ok: false, error: `${started.length} pick${started.length === 1 ? '' : 's'} already started and ${started.length === 1 ? 'was' : 'were'} removed.` };
  }
  if (mode === 'parlay' && legs.length < 2) return { ok: false, error: 'A parlay needs at least 2 picks.' };
  if (!Number.isFinite(stake) || stake < MIN_STAKE) return { ok: false, error: `The minimum bet is ${MIN_STAKE} coins.` };
  const count = mode === 'parlay' ? 1 : legs.length;
  const total = stake * count;
  if (total > state.bank.coins) return { ok: false, error: `You only have ${state.bank.coins} coins.` };
  const made = [];
  const what = mode === 'parlay' ? `${legs.length}-leg parlay` : legs.length === 1 ? legs[0].label : `${legs.length} single bets`;
  update((s) => {
    const base = Date.now();
    if (mode === 'parlay') made.push({ id: 'b' + base.toString(36), ts: base, mode: 'parlay', stake, dec: parlayDec(legs), legs: legs.map((l) => ({ ...l })), status: 'pending', payout: 0 });
    else legs.forEach((l, i) => made.push({ id: 'b' + (base + i).toString(36), ts: base + i, mode: 'single', stake, dec: l.dec, legs: [{ ...l }], status: 'pending', payout: 0 }));
    made.forEach((b) => { s.bets[b.id] = b; });
    s.bank.coins -= total;
    s.slip.legs = [];
  }, { k: 'stake', note: what });
  track('bets_placed', made.length);
  if (mode === 'parlay') track('parlays_placed');
  ping();
  return { ok: true, bets: made, total };
}

/** Record leg results and, if the bet is decided, pay out. */
export function resolveBet(id, results, decision) {
  const was = state.bets[id];
  const title = was ? (was.mode === 'parlay' ? `${was.legs.length}-leg parlay` : was.legs[0].label) : '';
  update((s) => {
    const b = s.bets[id];
    if (!b || b.status !== 'pending') return;
    b.legs.forEach((l, i) => { if (results[i]) l.result = results[i]; });
    if (!decision) return;
    b.status = decision.status; b.payout = decision.payout; b.boost = decision.boost || 0; b.settledTs = Date.now();
    s.bank.coins += decision.payout;
    s.bank.peak = Math.max(s.bank.peak, s.bank.coins);
    if (decision.status === 'won') { s.bank.streak++; s.bank.bestStreak = Math.max(s.bank.bestStreak, s.bank.streak); }
    else if (decision.status === 'lost') s.bank.streak = 0;
    s.bank.xp += decision.status === 'void' ? 0 : xpFor(b, decision.status === 'won');
    s.notices.push({ id, status: decision.status, payout: decision.payout, stake: b.stake, title: b.mode === 'parlay' ? `${b.legs.length}-leg parlay` : b.legs[0].label });
  }, { k: decision && decision.status === 'void' ? 'refund' : 'win', note: title });
  if (decision && decision.status === 'won') track('bets_won');
  ping();
}
/** Take a cash out offer: the bet ends now at that many coins. Pays no streak boost and does not touch the streak.
 *  It counts as a win when it returns at least the stake, otherwise a loss. Its legs keep resolving afterwards so you can see what would have happened. */
export function cashOutBet(id, amount) {
  let ok = false;
  const was = state.bets[id];
  const title = was ? (was.mode === 'parlay' ? `${was.legs.length}-leg parlay` : was.legs[0].label) : '';
  update((s) => {
    const b = s.bets[id];
    if (!b || b.status !== 'pending' || !Number.isFinite(amount) || amount < 1) return;
    const pay = Math.round(amount);
    b.status = pay >= b.stake ? 'won' : 'lost'; b.payout = pay; b.boost = 0; b.cashed = true; b.settledTs = Date.now();
    s.bank.coins += pay;
    s.bank.peak = Math.max(s.bank.peak, s.bank.coins);
    s.bank.xp += Math.round(b.stake / 10) + (pay >= b.stake ? 10 : 2);
    ok = true;
  }, { k: 'cashout', note: title });
  if (ok) ping();
  return ok;
}
/** A bet that is already decided (say, lost on its first leg) still shows how its other legs went. This only fills in legs, it never changes the payout. */
export function fillLegs(id, results) {
  update((s) => { const b = s.bets[id]; if (!b || b.status === 'pending') return; b.legs.forEach((l, i) => { if (l.result === 'pending' && results[i] && results[i] !== 'pending') l.result = results[i]; }); });
  ping();
}
export const decidedWithOpenLegs = (days = 4) => Object.values(state.bets).filter((b) => b.status !== 'pending' && b.legs.some((l) => l.result === 'pending' && new Date(l.date).getTime() < Date.now() && Date.now() - new Date(l.date).getTime() < days * 864e5));
export function takeNotices() { const n = state.notices; if (n.length) update((s) => { s.notices = []; }); return n; }

export function claimDaily() {
  const today = localDay();
  const b = state.bank;
  if (b.lastDaily === today) return { ok: false };
  const y = new Date(); y.setDate(y.getDate() - 1);
  const streakDays = b.lastDaily === localDay(y) ? b.dailyStreak + 1 : 1;
  const bonus = dailyBonus(streakDays);
  update((s) => { s.bank.coins += bonus; s.bank.lastDaily = today; s.bank.dailyStreak = streakDays; s.bank.peak = Math.max(s.bank.peak, s.bank.coins); }, { k: 'daily', note: `Day ${streakDays} in a row` });
  track('daily_claimed');
  ping();
  return { ok: true, bonus, streakDays };
}
export const dailyReady = () => state.bank.lastDaily !== localDay();
export const canRescue = () => state.bank.coins < MIN_STAKE && !openBets().length && state.bank.rescued !== localDay();
export function rescue() {
  if (!canRescue()) return false;
  update((s) => { s.bank.coins += 200; s.bank.rescued = localDay(); s.bank.rescues = (s.bank.rescues || 0) + 1; if (!s.avatar.owned.includes('ghost')) s.avatar.owned.push('ghost'); }, { k: 'rescue', note: 'Ran out of coins' });
  ping(); return true;
}

/* ---------- quests ---------- */
// Progress is counted by what you do (bets placed, games opened...). What the quests ask for each day and
// week comes from js/live.js. Counters reset when the day (or the Friday-to-Thursday week) changes.
const emptyPeriod = () => ({ n: {}, once: {}, claimed: [] });
function rollQuests(s, now = new Date()) {
  if (!s.quests || typeof s.quests !== 'object') s.quests = {};
  const q = s.quests, d = dayKey(now), w = weekKey(now);
  if (q.day !== d || !q.daily) { q.day = d; q.daily = emptyPeriod(); }
  if (q.week !== w || !q.weekly) { q.week = w; q.weekly = emptyPeriod(); }
  return q;
}
/** Count something you did. Pass a key to count each thing only once per day and week (a game, say). */
export function track(metric, n = 1, key = null, now = new Date()) {
  const q = rollQuests(state, now);
  for (const p of [q.daily, q.weekly]) {
    if (key != null) { const k = metric + '|' + key; if (p.once[k]) continue; p.once[k] = 1; }
    p.n[metric] = (p.n[metric] || 0) + n;
  }
  save();
}
/** Progress made on another device: the bigger count wins, and things counted once (a game opened) are counted across both. */
function foldProgress(p, n, once) {
  for (const [m, v] of Object.entries(n || {})) p.n[m] = Math.max(p.n[m] || 0, v);
  for (const k of once || []) p.once[k] = 1;
  const per = {};
  for (const k of Object.keys(p.once)) { const m = k.split('|')[0]; per[m] = (per[m] || 0) + 1; }
  for (const [m, v] of Object.entries(per)) p.n[m] = Math.max(p.n[m] || 0, v);
}
/** Fold in quest claims made on another device, so a quest or the daily bonus pays out once. */
export function mergeClaims(c) {
  if (!c) return;
  update((s) => {
    const q = rollQuests(s);
    if (c.day === q.day) { q.daily.claimed = [...new Set([...q.daily.claimed, ...(c.days || [])])]; foldProgress(q.daily, c.dn, c.do); }
    if (c.week === q.week) { q.weekly.claimed = [...new Set([...q.weekly.claimed, ...(c.weeks || [])])]; foldProgress(q.weekly, c.wn, c.wo); }
  });
}
/** This period's counters, without changing anything. which is 'daily' or 'weekly'. */
export function questPeriod(which, now = new Date()) {
  const q = state.quests || {};
  const ok = which === 'daily' ? q.day === dayKey(now) : q.week === weekKey(now);
  return ok && q[which] ? q[which] : emptyPeriod();
}
export const questCount = (which, metric, now) => questPeriod(which, now).n[metric] || 0;
export const questDone = (which, quest, now) => questCount(which, quest.metric, now) >= quest.target;
export const questClaimed = (which, quest, now) => questPeriod(which, now).claimed.includes(quest.id);
/** Pay out a finished quest: coins, plus an item if it has one (coins instead if you already own it). */
export function claimQuest(which, quest, now = new Date()) {
  if (!quest || !quest.id) return { ok: false, why: 'unknown' };
  if (questClaimed(which, quest, now)) return { ok: false, why: 'claimed' };
  if (!questDone(which, quest, now)) return { ok: false, why: 'not done' };
  const out = { ok: true, coins: quest.coins || 0, item: null, swapped: false };
  update((s) => {
    const p = rollQuests(s, now)[which];
    p.claimed.push(quest.id);
    if (quest.item) {
      if (s.avatar.owned.includes(quest.item)) { out.coins += 200; out.swapped = true; } // already own the prize: coins instead
      else { s.avatar.owned.push(quest.item); out.item = quest.item; }
    }
    s.bank.coins += out.coins;
    s.bank.peak = Math.max(s.bank.peak, s.bank.coins);
  }, { k: 'quest', note: `${which === 'daily' ? 'Daily' : 'Weekly'} quest${quest.title ? ': ' + quest.title : ''}` });
  ping();
  return out;
}

/** Avatar and shop. Cosmetics only. The catalog and prices live in avatar.js; this just moves coins and items. */
export function buyItem(id, price) {
  const st = state;
  if (st.avatar.owned.includes(id)) return { ok: false, why: 'owned' };
  if (st.bank.coins < price) return { ok: false, why: 'coins' };
  update((s) => { s.bank.coins -= price; s.avatar.owned.push(id); s.avatar.spent = (s.avatar.spent || 0) + price; }, { k: 'shop', note: id });
  track('items_bought');
  ping(); return { ok: true };
}
/** Extra colours are bought one at a time. The first colour, black and white come with the item. */
export function buyColour(id, i, price) {
  const st = state;
  if (st.bank.coins < price) return { ok: false, why: 'coins' };
  update((s) => { s.bank.coins -= price; const o = s.avatar.colOwned = s.avatar.colOwned || {}; o[id] = [...new Set([...(o[id] || []), i])]; s.avatar.spent = (s.avatar.spent || 0) + price; }, { k: 'shop', note: `${id} colour` });
  ping(); return { ok: true };
}
export function grantItem(id) { if (state.avatar.owned.includes(id)) return false; update((s) => { s.avatar.owned.push(id); }); ping(); return true; }
export function setAvatar(fn) { update((s) => fn(s.avatar)); ping(); }

export const markWatched = (g) => update((s) => {
  if (s.watched[g.key]) { delete s.watched[g.key]; s.unwatched = { ...(s.unwatched || {}), [g.key]: Date.now() }; const k = Object.keys(s.unwatched); if (k.length > 200) for (const x of k.sort((a, b) => s.unwatched[a] - s.unwatched[b]).slice(0, k.length - 200)) delete s.unwatched[x]; } // the removal is remembered so another device cannot bring the game back
  else track('games_marked', 1, g.key), s.unwatched && delete s.unwatched[g.key], s.watched[g.key] = { ts: Date.now(), league: g.league, date: g.date, home: g.home.abbr, away: g.away.abbr, homeScore: g.home.score, awayScore: g.away.score };
});
export const isWatched = (key) => !!state.watched[key];

const today = () => new Date().toISOString().slice(0, 10);
export function askLeft(limit) {
  if (state.ask.day !== today()) return limit;
  return Math.max(0, limit - state.ask.n);
}
export function useAsk() {
  update((s) => { if (s.ask.day !== today()) s.ask = { day: today(), n: 0 }; s.ask.n++; });
}

export function exportData() { return JSON.stringify(state, null, 2); }
export function importData(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || !Array.isArray(s.teams)) throw new Error('That file does not look like Homefield data.');
  const f = fresh();
  state = { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) }, avatar: mergeAvatar(f.avatar, s.avatar) };
  save();
}
export function resetBets() {
  const f = fresh();
  update((s) => { s.bank = f.bank; s.bets = {}; s.slip = f.slip; s.notices = []; s.lastMode = f.lastMode; /* avatar and owned items are kept */ }, { k: 'reset', note: 'Bets reset' });
  ping();
}
export function resetTeams() { update((s) => { s.teams = []; }); }
export function resetAll() { state = fresh(); save(); ping(); }

/* ---------- coins moved by the crew games (duels, survivor, cap night) ---------- */
/** Take coins out of the bankroll. Returns false (and changes nothing) if there are not enough. */
export function spendCoins(n, tag) {
  n = Math.floor(n);
  if (!(n > 0) || state.bank.coins < n) return false;
  update((s) => { s.bank.coins -= n; }, tag);
  ping();
  return true;
}
export function addCoins(n, tag) {
  n = Math.floor(n);
  if (!(n > 0)) return;
  update((s) => { s.bank.coins += n; s.bank.peak = Math.max(s.bank.peak, s.bank.coins); }, tag);
  ping();
}
