// Picks which of your teams sets the app's colours: the one playing now or next (or the team you are looking at).
// The last pick is remembered so the theme is already right when the app opens. The logo never changes.
import { myTeams } from './store.js';
import { getTeamSchedule, recallGame } from './espn.js';
import { setThemeTeam } from './themes.js';
import { findTeam, myTeamIn } from './store.js';

const KEY = 'homefield:brand';
const FALLBACK = { t1: '#FF6B4A', t2: '#7C5CFF', tink: '#FFFFFF', tacc: '#FFD43B' };

const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const writeCache = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

/** The Homefield mark: a poker chip (betting) with a basketball's seams inside (sports). Fixed colours, it never changes. */
export function badgeSvg(size = 32) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="#FF6B4A"/><circle cx="20" cy="20" r="18.5" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.4"/><circle cx="20" cy="20" r="15.6" fill="none" stroke="#fff" stroke-width="3.6" stroke-dasharray="5.1 6.12" stroke-dashoffset="2.5"/><circle cx="20" cy="20" r="11.6" fill="#14172B"/><circle cx="20" cy="20" r="11.6" fill="none" stroke="#FFD43B" stroke-width="1.2"/><g fill="none" stroke="#FFD43B" stroke-width="1.5" stroke-linecap="round"><path d="M20 8.6 V31.4"/><path d="M8.6 20 H31.4"/><path d="M11.6 11.6 C16.6 15.6 16.6 24.4 11.6 28.4"/><path d="M28.4 11.6 C23.4 15.6 23.4 24.4 28.4 28.4"/></g><circle cx="20" cy="20" r="2.3" fill="#FF6B4A" stroke="#14172B" stroke-width=".8"/></svg>`;
}

// Two teams can set the app's theme: the one with the next game (main), and the one on screen (context).
// The logo itself stays the same.
function drawLogo() {
  const mark = document.querySelector('.brand-mark');
  if (mark && !mark.firstChild) mark.innerHTML = badgeSvg();
}
let main = null, ctx = null;
function paint() { drawLogo(); setThemeTeam(ctx || main); }
export function setContextTeam(team) { ctx = team || null; paint(); }

/** The team a page is about: a team page, or a game (your team in it, else the home side). */
export async function teamForRoute(name, params) {
  try {
    if (name === 'team') {
      const f = findTeam(params.league, params.id);
      if (f && (f.color || f.alt)) return f;
      const s = await getTeamSchedule(params.league, params.id);
      return { ...s.team };
    }
    if (name === 'game') {
      const g = recallGame(`${params.league}:${params.id}`);
      if (!g) return null;
      const mine = myTeamIn(g);
      const side = mine ? (String(g.home.id) === String(mine.id) ? g.home : g.away) : g.home;
      return { ...side, color: side.color || (mine && mine.color), alt: side.alt || (mine && mine.alt) };
    }
  } catch (e) { /* keep the current look */ }
  return null;
}

let timer = null;
export async function refreshBrand() {
  const t = await nextTeam();
  main = t || myTeams()[0] || null; // nothing scheduled: fall back to your first team
  paint();
  writeCache(main ? { id: main.id, league: main.league, name: main.name, color: main.color, alt: main.alt } : null);
}
export function startBrand() {
  const c = readCache();
  const still = c && myTeams().some((t) => t.id === c.id && t.league === c.league);
  main = still ? c : myTeams()[0] || null;
  paint();
  refreshBrand().catch(() => {});
  if (timer) clearInterval(timer);
  timer = setInterval(() => refreshBrand().catch(() => {}), 15 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBrand().catch(() => {}); });
}
