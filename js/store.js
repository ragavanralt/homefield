// Everything the app remembers lives on this device in localStorage. No accounts.
import { isSoccer } from './leagues.js';

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
  picks: {},
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
    return { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) } };
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

export const savePick = (pick) => update((s) => { s.picks[pick.key] = pick; });
export const removePick = (key) => update((s) => { delete s.picks[key]; });

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
