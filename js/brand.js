// Picks which of your teams sets the app's colours: the one playing now or next (or the team you are looking at).
// The last pick is remembered so the theme is already right when the app opens. The logo never changes.
import { myTeams, getState } from './store.js';
import { getTeamSchedule, recallGame } from './espn.js';
import { setThemeTeam, teamPalette } from './themes.js';
import { lighten, darken, fmtDay, fmtTime } from './util.js';
import { findTeam, myTeamIn } from './store.js';

const KEY = 'homefield:brand';
const FALLBACK = { t1: '#FF6B4A', t2: '#7C5CFF', tink: '#FFFFFF', tacc: '#E8C45A' };

const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const writeCache = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

const GOLD = { g0: '#F9EBB0', g1: '#D9B445', g2: '#8A6619', seam: '#E8C45A' };
/** The Homefield mark: a poker chip (betting) with a basketball's seams inside (sports). Gold by default; takes the team's colours in team mode. */
export function badgeSvg(size = 32, c = GOLD) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="hfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.g0}"/><stop offset=".5" stop-color="${c.g1}"/><stop offset="1" stop-color="${c.g2}"/></linearGradient></defs><circle cx="20" cy="20" r="18.5" fill="url(#hfg)"/><circle cx="20" cy="20" r="18.5" fill="none" stroke="${c.g0}" stroke-opacity=".9" stroke-width="1.4"/><circle cx="20" cy="20" r="15.6" fill="none" stroke="#0B0B0D" stroke-width="3.6" stroke-dasharray="5.1 6.12" stroke-dashoffset="2.5"/><circle cx="20" cy="20" r="11.6" fill="#0B0B0D"/><circle cx="20" cy="20" r="11.6" fill="none" stroke="${c.seam}" stroke-width="1.2"/><g fill="none" stroke="${c.seam}" stroke-width="1.5" stroke-linecap="round"><path d="M20 8.6 V31.4"/><path d="M8.6 20 H31.4"/><path d="M11.6 11.6 C16.6 15.6 16.6 24.4 11.6 28.4"/><path d="M28.4 11.6 C23.4 15.6 23.4 24.4 28.4 28.4"/></g><circle cx="20" cy="20" r="2.3" fill="url(#hfg)" stroke="#0B0B0D" stroke-width=".8"/></svg>`;
}

function logoColours(team) {
  if (!team || getState().settings.teamMode === false) return GOLD;
  const p = teamPalette(team.color, team.alt, 'dark');
  return { g0: lighten(p.accent, 0.5), g1: p.accent, g2: darken(p.accent2, 0.25), seam: lighten(p.accent, 0.25) };
}
function drawLogo(team) {
  const mark = document.querySelector('.brand-mark');
  if (mark) mark.innerHTML = badgeSvg(32, logoColours(team));
  const brand = document.querySelector('.brand');
  if (brand) brand.title = team && getState().settings.teamMode !== false ? `Colours: ${team.name || team.abbr}` : 'Homefield';
}

// Two teams can set the app's look: the one with the next game (main), and the one on screen (context).
let main = null, mainGame = null, ctx = null;
const listeners = new Set();
export const onBrandChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function paint() { const t = ctx || main; drawLogo(t); setThemeTeam(t); listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } }); }
/** Repaint after the Team colours setting changes. */
export const repaintBrand = () => paint();

/** What the app is matched to right now, in words, for Settings. */
export function themeMatch() {
  if (getState().settings.teamMode === false) return null;
  const t = ctx || main;
  if (!t) return { team: null, text: 'No team yet, so you are seeing black and gold. Follow a team and the app takes its colours.' };
  const name = t.name || t.abbr;
  if (ctx) return { team: t, text: `${name}, because you are on its page.` };
  const g = mainGame;
  if (g && String(g.team.id) === String(t.id)) {
    const opp = String(g.game.home.id) === String(t.id) ? g.game.away : g.game.home;
    const o = opp.short || opp.name || opp.abbr;
    return { team: t, text: g.game.state === 'in' ? `${name}, playing ${o} right now.` : `${name}, your next game: ${String(g.game.home.id) === String(t.id) ? 'vs' : '@'} ${o}, ${fmtDay(g.game.date)} ${fmtTime(g.game.date)}.` };
  }
  return { team: t, text: `${name}, your first team (nothing scheduled right now).` };
}
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
  const n = await nextTeam();
  main = n ? n.team : myTeams()[0] || null; // nothing scheduled: fall back to your first team
  mainGame = n;
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
