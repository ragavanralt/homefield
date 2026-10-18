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

/** The Homefield mark: a gold medallion with a serif H, laurel and a ticked bezel, on black. Fixed colours. */
export function badgeSvg(size = 32) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#0B0B0D"/><g transform="translate(5 5) scale(.9)"><defs><linearGradient id="hfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F9EBB0"/><stop offset=".45" stop-color="#D9B445"/><stop offset="1" stop-color="#8A6619"/></linearGradient><linearGradient id="hfd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A1A1E"/><stop offset="1" stop-color="#0C0C0E"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(#hfd)"/><circle cx="50" cy="50" r="46" fill="none" stroke="url(#hfg)" stroke-width="2.4"/><circle cx="50" cy="50" r="42.2" fill="none" stroke="#D9B445" stroke-width="2" stroke-dasharray="0.7 3.5" opacity=".8"/><circle cx="50" cy="50" r="39.2" fill="none" stroke="url(#hfg)" stroke-width=".8"/><ellipse cx="38.76" cy="77.82" rx="4.2" ry="1.75" transform="rotate(234.0 38.76 77.82)" fill="url(#hfg)"/><ellipse cx="32.79" cy="74.57" rx="4.2" ry="1.75" transform="rotate(247.0 32.79 74.57)" fill="url(#hfg)"/><ellipse cx="27.71" cy="70.07" rx="4.2" ry="1.75" transform="rotate(260.0 27.71 70.07)" fill="url(#hfg)"/><ellipse cx="23.76" cy="64.54" rx="4.2" ry="1.75" transform="rotate(273.0 23.76 64.54)" fill="url(#hfg)"/><ellipse cx="21.16" cy="58.27" rx="4.2" ry="1.75" transform="rotate(286.0 21.16 58.27)" fill="url(#hfg)"/><ellipse cx="20.04" cy="51.57" rx="4.2" ry="1.75" transform="rotate(299.0 20.04 51.57)" fill="url(#hfg)"/><ellipse cx="20.46" cy="44.79" rx="4.2" ry="1.75" transform="rotate(312.0 20.46 44.79)" fill="url(#hfg)"/><ellipse cx="61.24" cy="77.82" rx="4.2" ry="1.75" transform="rotate(-54.0 61.24 77.82)" fill="url(#hfg)"/><ellipse cx="67.21" cy="74.57" rx="4.2" ry="1.75" transform="rotate(-67.0 67.21 74.57)" fill="url(#hfg)"/><ellipse cx="72.29" cy="70.07" rx="4.2" ry="1.75" transform="rotate(-80.0 72.29 70.07)" fill="url(#hfg)"/><ellipse cx="76.24" cy="64.54" rx="4.2" ry="1.75" transform="rotate(-93.0 76.24 64.54)" fill="url(#hfg)"/><ellipse cx="78.84" cy="58.27" rx="4.2" ry="1.75" transform="rotate(-106.0 78.84 58.27)" fill="url(#hfg)"/><ellipse cx="79.96" cy="51.57" rx="4.2" ry="1.75" transform="rotate(-119.0 79.96 51.57)" fill="url(#hfg)"/><ellipse cx="79.54" cy="44.79" rx="4.2" ry="1.75" transform="rotate(-132.0 79.54 44.79)" fill="url(#hfg)"/><path d="M50 14.2 L53 18.4 L50 22.6 L47 18.4 Z" fill="url(#hfg)"/><path d="M50 77.4 L52.2 80.4 L50 83.4 L47.8 80.4 Z" fill="url(#hfg)"/><g transform="translate(0.9 1.1)" fill="#4A3610"><rect x="33.5" y="32" width="7.6" height="36"/><rect x="58.9" y="32" width="7.6" height="36"/><rect x="41.1" y="48.2" width="17.8" height="3.4"/><rect x="29" y="31" width="16.6" height="2.8"/><rect x="54.4" y="31" width="16.6" height="2.8"/><rect x="29" y="66.2" width="16.6" height="2.8"/><rect x="54.4" y="66.2" width="16.6" height="2.8"/></g><g transform="translate(0 0)" fill="url(#hfg)"><rect x="33.5" y="32" width="7.6" height="36"/><rect x="58.9" y="32" width="7.6" height="36"/><rect x="41.1" y="48.2" width="17.8" height="3.4"/><rect x="29" y="31" width="16.6" height="2.8"/><rect x="54.4" y="31" width="16.6" height="2.8"/><rect x="29" y="66.2" width="16.6" height="2.8"/><rect x="54.4" y="66.2" width="16.6" height="2.8"/></g><rect x="34.3" y="34" width=".9" height="32" fill="#fff" opacity=".35"/><rect x="59.7" y="34" width=".9" height="32" fill="#fff" opacity=".35"/></g></svg>`;
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
