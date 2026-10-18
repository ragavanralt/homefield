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

/** The Homefield mark: a gold H on black. Fixed colours, it never changes with your team. */
export function badgeSvg(size = 32) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="hfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7E7A9"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#8C6A1C"/></linearGradient></defs><rect width="40" height="40" rx="9.5" fill="#0B0B0D"/><rect x="1.6" y="1.6" width="36.8" height="36.8" rx="8.4" fill="none" stroke="#D4AF37" stroke-opacity=".55" stroke-width=".8"/><path d="M11 12.6 L16.4 9 V31 H11 Z" fill="url(#hfg)"/><path d="M23.6 9 L29 12.6 V31 H23.6 Z" fill="url(#hfg)"/><rect x="16.4" y="18.2" width="7.2" height="3.6" fill="url(#hfg)"/></svg>`;
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
