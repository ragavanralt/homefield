// The logo wears the colours of whichever of your teams plays next (or is playing now).
// The last pick is remembered so the logo is already coloured the next time the app opens.
import { myTeams } from './store.js';
import { getTeamSchedule, recallGame } from './espn.js';
import { setThemeTeam } from './themes.js';
import { findTeam, myTeamIn } from './store.js';
import { palette } from './avatar.js';

const KEY = 'homefield:brand';
const FALLBACK = { t1: '#FF6B4A', t2: '#7C5CFF', tink: '#FFFFFF', tacc: '#FFD43B' };

const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const writeCache = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

/** A shield badge with a bold H, in a team's colours. Used in the header and as the tab icon. */
export function badgeSvg(p = FALLBACK, size = 32) {
  const c = { ...FALLBACK, ...p };
  const shield = 'M16 1.5 L30 6.5 V18 C30 26.5 23.5 31.5 16 34.5 C8.5 31.5 2 26.5 2 18 V6.5 Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 36" width="${size}" height="${Math.round(size * 36 / 32)}" aria-hidden="true">
<defs><clipPath id="hf-bc"><path d="${shield}"/></clipPath></defs>
<path d="${shield}" fill="${c.t1}"/>
<g clip-path="url(#hf-bc)"><path d="M-2 25 L34 12 V19.5 L-2 32.5 Z" fill="${c.t2}"/><path d="M-2 22.5 L34 9.5 V11.2 L-2 24.2 Z" fill="${c.tacc}"/><path d="M0 0 H32 V9 H0 Z" fill="#000" opacity=".12"/></g>
<path d="M9.5 8.5 H13.6 V15.2 H18.4 V8.5 H22.5 V24 H18.4 V18.6 H13.6 V24 H9.5 Z" fill="${c.tink}" stroke="rgba(0,0,0,.35)" stroke-width=".8" stroke-linejoin="round"/>
<path d="${shield}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>
</svg>`;
}

export function applyBrand(team) {
  const p = team ? palette(team) : FALLBACK;
  const mark = document.querySelector('.brand-mark');
  if (mark) mark.innerHTML = badgeSvg(p);
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.title = team ? `Next up: ${team.name || team.abbr}` : 'Homefield';
    brand.classList.toggle('themed', !!team);
    brand.style.setProperty('--bt1', p.t1); brand.style.setProperty('--bt2', p.t2);
  }
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) { icon.type = 'image/svg+xml'; icon.href = 'data:image/svg+xml,' + encodeURIComponent(badgeSvg(p, 64)); }
}

/** Of the teams you follow, the one playing now or soonest. */
export async function nextTeam(now = Date.now()) {
  const teams = myTeams();
  if (!teams.length) return null;
  const rows = await Promise.all(teams.map(async (t) => {
    try {
      const s = await getTeamSchedule(t.league, t.id);
      const g = (s.games || []).find((x) => x.state === 'in' || (x.state === 'pre' && new Date(x.date).getTime() > now));
      if (!g) return null;
      return { when: g.state === 'in' ? 0 : new Date(g.date).getTime(), team: { ...t, color: s.team.color || t.color, alt: s.team.alt || t.alt } };
    } catch (e) { return null; }
  }));
  const best = rows.filter(Boolean).sort((a, b) => a.when - b.when)[0];
  return best ? best.team : null;
}

// Two teams can set the look: the one with the next game (main), and the one on screen (context).
let main = null, ctx = null;
function paint() { const t = ctx || main; applyBrand(t); setThemeTeam(t); }
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
