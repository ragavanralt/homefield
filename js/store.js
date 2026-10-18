// Everything the app remembers lives on this device in localStorage. No accounts.
import { isSoccer } from './leagues.js';
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
  settings: { logos: true, spoilerFree: false },
  bank: { coins: START_COINS, xp: 0, streak: 0, bestStreak: 0, peak: START_COINS, lastDaily: '', dailyStreak: 0, rescued: '' },
  bets: {},
  slip: { legs: [], mode: 'single', stake: 50 },
  notices: [],
  watched: {},
  ask: { day: '', n: 0 },
  soccerLeague: 'uefa.champions',
  lastMode: 'classic',
});

let state = load();

function load() {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const f = fresh();
    return { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) }, bank: { ...f.bank, ...(s.bank || {}) }, slip: { ...f.slip, ...(s.slip || {}) } };
  } catch (e) { return fresh(); }
}
function save() { try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full */ } }

export const getState = () => state;
export function update(fn) { fn(state); save(); return state; }

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

export const setSetting = (k, v) => update((s) => { s.settings[k] = v; });
export const setOnboarded = (v = true) => update((s) => { s.onboarded = v; });

/* ---------- the betting game ---------- */
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const listeners = new Set();
export const onSlipChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const ping = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });

export const getBank = () => state.bank;
export const slipHas = (key) => state.slip.legs.some((l) => l.key === key);

/** Add a leg, or take it off if it is already there. A conflicting leg on the same market is swapped out. */
export function toggleLeg(leg) {
  update((s) => {
    const i = s.slip.legs.findIndex((l) => l.key === leg.key);
    if (i >= 0) { s.slip.legs.splice(i, 1); return; }
    s.slip.legs = s.slip.legs.filter((l) => !conflicts(l, leg));
    if (s.slip.legs.length >= MAX_LEGS) s.slip.legs.shift();
    s.slip.legs.push(leg);
  });
  ping();
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
  update((s) => {
    const base = Date.now();
    if (mode === 'parlay') made.push({ id: 'b' + base.toString(36), ts: base, mode: 'parlay', stake, dec: parlayDec(legs), legs: legs.map((l) => ({ ...l })), status: 'pending', payout: 0 });
    else legs.forEach((l, i) => made.push({ id: 'b' + (base + i).toString(36), ts: base + i, mode: 'single', stake, dec: l.dec, legs: [{ ...l }], status: 'pending', payout: 0 }));
    made.forEach((b) => { s.bets[b.id] = b; });
    s.bank.coins -= total;
    s.slip.legs = [];
  });
  ping();
  return { ok: true, bets: made, total };
}

/** Record leg results and, if the bet is decided, pay out. */
export function resolveBet(id, results, decision) {
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
  });
  ping();
}
export function takeNotices() { const n = state.notices; if (n.length) update((s) => { s.notices = []; }); return n; }

export function claimDaily() {
  const today = localDay();
  const b = state.bank;
  if (b.lastDaily === today) return { ok: false };
  const y = new Date(); y.setDate(y.getDate() - 1);
  const streakDays = b.lastDaily === localDay(y) ? b.dailyStreak + 1 : 1;
  const bonus = 150 + 50 * Math.min(streakDays, 7);
  update((s) => { s.bank.coins += bonus; s.bank.lastDaily = today; s.bank.dailyStreak = streakDays; s.bank.peak = Math.max(s.bank.peak, s.bank.coins); });
  ping();
  return { ok: true, bonus, streakDays };
}
export const dailyReady = () => state.bank.lastDaily !== localDay();
export const canRescue = () => state.bank.coins < MIN_STAKE && !openBets().length && state.bank.rescued !== localDay();
export function rescue() { if (!canRescue()) return false; update((s) => { s.bank.coins += 200; s.bank.rescued = localDay(); }); ping(); return true; }

export const markWatched = (g) => update((s) => {
  if (s.watched[g.key]) delete s.watched[g.key];
  else s.watched[g.key] = { ts: Date.now(), league: g.league, date: g.date, home: g.home.abbr, away: g.away.abbr, homeScore: g.home.score, awayScore: g.away.score };
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
  state = { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) } };
  save();
}
export function resetAll() { state = fresh(); save(); }
