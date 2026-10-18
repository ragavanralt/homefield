// Picks which of your teams sets the app's colours. Rules:
//  - Only one of your teams plays today: the app matches it, automatically.
//  - Two or more play today: it starts with the one on soonest, and Settings lets you choose.
//  - None play today: black and gold.
// Opening a team or game page matches that team while you are there. The last pick is remembered so the
// theme is already right when the app opens.
import { myTeams, getState, setSetting, findTeam } from './store.js';
import { getTeamSchedule, getScoreboard, recallGame } from './espn.js';
import { isSoccer, SOCCER_KEYS } from './leagues.js';
import { setThemeTeam, teamPalette } from './themes.js';
import { lighten, darken, fmtDay, fmtTime, ymd, sameDay } from './util.js';
import { dayKey } from './period.js';

const KEY = 'homefield:brand';
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
  if (typeof document === 'undefined') return;
  const mark = document.querySelector('.brand-mark');
  if (mark) mark.innerHTML = badgeSvg(32, logoColours(team));
  const brand = document.querySelector('.brand');
  if (brand) brand.title = team && getState().settings.teamMode !== false ? `Colours: ${team.name || team.abbr}` : 'Homefield';
}

// Teams that play today and have not finished (live or still to come), soonest first.
let todays = [], main = null, ctx = null, loaded = false;
const listeners = new Set();
export const onBrandChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const teamKey = (t) => `${t.league}:${t.id}`;

function pickMain() {
  if (!todays.length) return null;
  if (todays.length === 1) return todays[0].team;
  const s = getState().settings;
  const chosen = s.themePickDay === dayKey() && todays.find((x) => teamKey(x.team) === s.themePick);
  return (chosen || todays[0]).team;
}
function paint() {
  const t = ctx || main;
  drawLogo(t); setThemeTeam(t);
  listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
}
/** Repaint after the Team colours setting changes. */
export const repaintBrand = () => paint();
/** When two of your teams play today, you choose which one the app matches. */
export function chooseTheme(key) {
  if (!todays.some((x) => teamKey(x.team) === key)) return;
  setSetting('themePick', key); setSetting('themePickDay', dayKey());
  main = pickMain(); remember(); paint();
}
function remember() { writeCache(main ? { id: main.id, league: main.league, name: main.name, color: main.color, alt: main.alt, day: dayKey() } : null); }

/** What the app is matched to right now, in words, for Settings. */
export function themeMatch() {
  if (getState().settings.teamMode === false) return null;
  const when = (g) => (g.state === 'in' ? 'playing right now' : `plays today ${fmtTime(g.date)}`);
  const vs = (x) => { const home = String(x.game.home.id) === String(x.team.id); const o = home ? x.game.away : x.game.home; return `${home ? 'vs' : '@'} ${o.short || o.name || o.abbr}`; };
  const options = todays.map((x) => ({ key: teamKey(x.team), team: x.team, label: `${x.team.short || x.team.name} ${vs(x)}, ${x.game.state === 'in' ? 'live' : fmtTime(x.game.date)}` }));
  if (ctx) return { team: ctx, text: `${ctx.name || ctx.abbr}, because you are on its page.`, options: [] };
  if (!myTeams().length) return { team: null, text: 'No teams yet, so you are seeing black and gold. Follow a team and the app takes its colours on game days.', options: [] };
  if (!loaded) return { team: main, text: main ? `${main.name || main.abbr}, checking today's games…` : 'Checking today\'s games…', options: [] };
  if (!todays.length) return { team: null, text: 'None of your teams play today, so you are seeing black and gold.', options: [] };
  const x = todays.find((y) => y.team === main) || todays[0];
  const name = x.team.name || x.team.abbr;
  if (todays.length === 1) return { team: x.team, text: `${name}, ${when(x.game)} (${vs(x)}). It is the only one of your teams on today.`, options: [] };
  return { team: x.team, text: `${name}, ${when(x.game)} (${vs(x)}). ${todays.length} of your teams play today, so pick one:`, options, current: teamKey(x.team) };
}

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
      const mine = myTeams().find((t) => (t.league === g.league || (isSoccer(t.league) && isSoccer(g.league))) && (t.id === g.home.id || t.id === g.away.id));
      const side = mine ? (String(g.home.id) === String(mine.id) ? g.home : g.away) : g.home;
      return { ...side, color: side.color || (mine && mine.color), alt: side.alt || (mine && mine.alt) };
    }
  } catch (e) { /* keep the current look */ }
  return null;
}
export function setContextTeam(team) { ctx = team || null; paint(); }

/** Look up today's games for your teams (scoreboards plus team schedules). */
async function findToday(now = new Date()) {
  const teams = myTeams();
  if (!teams.length) return [];
  const leagues = new Set(teams.map((t) => t.league));
  if (teams.some((t) => isSoccer(t.league))) SOCCER_KEYS.forEach((k) => leagues.add(k)); // a club can be playing in another competition
  const day = ymd(now);
  const boards = await Promise.all([...leagues].map((l) => getScoreboard(l, day, 60000).catch(() => [])));
  const all = boards.flat();
  const rows = await Promise.all(teams.map(async (t) => {
    const games = all.filter((g) => (g.league === t.league || (isSoccer(t.league) && isSoccer(g.league))) && (String(g.home.id) === String(t.id) || String(g.away.id) === String(t.id)));
    let sched = [];
    try { const s = await getTeamSchedule(t.league, t.id); sched = s.games || []; if (s.team) { t = { ...t, color: s.team.color || t.color, alt: s.team.alt || t.alt }; } } catch (e) { /* the scoreboard may be enough */ }
    const byKey = new Map();
    for (const g of [...sched, ...games]) byKey.set(g.key, g); // scoreboard copy is the freshest
    const today = [...byKey.values()].filter((g) => (g.state === 'in' || (g.state === 'pre' && sameDay(new Date(g.date), now))));
    today.sort((a, b) => (a.state === 'in' ? 0 : 1) - (b.state === 'in' ? 0 : 1) || new Date(a.date) - new Date(b.date));
    return today.length ? { team: t, game: today[0], when: today[0].state === 'in' ? 0 : new Date(today[0].date).getTime() } : null;
  }));
  return rows.filter(Boolean).sort((a, b) => a.when - b.when);
}

/** For tests: pretend these are the teams playing today. */
export function _setToday(list) { todays = list; loaded = true; main = pickMain(); paint(); }

let timer = null;
export async function refreshBrand() {
  const found = await findToday();
  todays = found; loaded = true;
  main = pickMain(); remember(); paint();
}
export function startBrand() {
  const c = readCache();
  main = c && c.day === dayKey() && myTeams().some((t) => t.id === c.id && t.league === c.league) ? c : null; // last pick, for the first paint only
  paint();
  refreshBrand().catch(() => { loaded = true; paint(); });
  if (timer) clearInterval(timer);
  timer = setInterval(() => refreshBrand().catch(() => {}), 10 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBrand().catch(() => {}); });
}
