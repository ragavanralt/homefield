// App shell: hash router, nav bar, first-run redirect.
import { h, clear } from './ui.js';
import { getState, takeNotices } from './store.js';
import { mountSlip, slipHidden } from './slip.js';
import { toast } from './ui.js';
import { TABS } from './leagues.js';
import { settleAll } from './settle.js';
import { applyTheme, watchSystem, bindSettings } from './themes.js';
import { startBrand, setContextTeam, teamForRoute } from './brand.js';
import { enabled as socialOn, startSocial, queueSync } from './social.js';

const ROUTES = [
  { re: /^\/?$/, view: () => import('./views/home.js'), nav: 'home', params: () => ({}) },
  { re: /^\/league\/([^/]+)$/, view: () => import('./views/league.js'), nav: (m) => m[1], params: (m) => ({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/team\/([^/]+)\/([^/]+)$/, view: () => import('./views/team.js'), nav: 'home', params: (m) => ({ league: decodeURIComponent(m[1]), id: decodeURIComponent(m[2]) }) },
  { re: /^\/game\/([^/]+)\/([^/]+)$/, view: () => import('./views/game.js'), nav: 'home', params: (m) => ({ league: decodeURIComponent(m[1]), id: decodeURIComponent(m[2]) }) },
  { re: /^\/picks$/, view: () => import('./views/picks.js'), nav: 'picks', params: () => ({}) },
  { re: /^\/season$/, view: () => import('./views/season.js'), nav: 'season', params: () => ({}) },
  { re: /^\/profile$/, view: () => import('./views/profile.js'), nav: 'profile', params: () => ({ mode: 'fan' }) },
  { re: /^\/shop$/, view: () => import('./views/profile.js'), nav: 'shop', params: () => ({ mode: 'shop' }) },
  { re: /^\/quests$/, view: () => import('./views/quests.js'), nav: 'quests', params: () => ({}) },
  { re: /^\/crew$/, view: () => import('./views/crew.js'), nav: 'crew', params: () => ({}) },
  { re: /^\/join\/([^/]+)$/, view: () => import('./views/crew.js'), nav: 'crew', params: (m) => ({ code: decodeURIComponent(m[1]) }) },
  { re: /^\/daily$/, view: () => import('./views/daily.js'), nav: 'daily', params: () => ({}) },
  { re: /^\/duels$/, view: () => import('./views/duels.js'), nav: 'duels', params: () => ({}) },
  { re: /^\/duels\/vs\/([^/]+)$/, view: () => import('./views/duels.js'), nav: 'duels', params: (m) => ({ vs: decodeURIComponent(m[1]) }) },
  { re: /^\/duels\/([^/]+)$/, view: () => import('./views/duels.js'), nav: 'duels', params: (m) => ({ id: decodeURIComponent(m[1]) }) },
  { re: /^\/survivor$/, view: () => import('./views/survivor.js'), nav: 'survivor', params: () => ({}) },
  { re: /^\/cap$/, view: () => import('./views/capnight.js'), nav: 'cap', params: () => ({}) },
  { re: /^\/onboarding$/, view: () => import('./views/onboarding.js'), nav: 'none', params: () => ({}) },
  { re: /^\/settings$/, view: () => import('./views/settings.js'), nav: 'settings', params: () => ({}) },
  { re: /^\/check$/, view: () => import('./views/check.js'), nav: 'settings', params: () => ({}) },
];

// Five sections. On phones they sit in a bar at the bottom; on wide screens they are the top tabs.
// Sections with more than one page show a small row of sub-tabs under the header.
const ICON = {
  home: '<path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/>',
  sports: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18"/>',
  picks: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="m9 12 2 2 4-4"/>',
  quests: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  fan: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
};
const LAST_KEY = 'homefield:lastLeague';
const lastLeague = () => { try { const v = localStorage.getItem(LAST_KEY); if (TABS.some((t) => t.id === v)) return v; } catch (e) { /* storage may be off */ } return TABS[0].id; };
const SECTIONS = [
  { id: 'home', label: 'Home', href: () => '#/', subs: [] },
  { id: 'sports', label: 'Sports', href: () => `#/league/${lastLeague()}`, subs: TABS.map((t) => ({ id: t.id, label: t.label, href: `#/league/${t.id}` })) },
  { id: 'picks', label: "Pick'em", href: () => '#/picks', get subs() { return socialOn() ? [{ id: 'picks', label: "Pick'em", href: '#/picks' }, { id: 'daily', label: 'Daily 5', href: '#/daily' }, { id: 'duels', label: 'Duels', href: '#/duels' }, { id: 'survivor', label: 'Survivor', href: '#/survivor' }, { id: 'cap', label: 'Cap Night', href: '#/cap' }] : []; } },
  { id: 'quests', label: 'Quests', href: () => '#/quests', subs: [{ id: 'quests', label: 'Quests', href: '#/quests' }, { id: 'season', label: 'Season', href: '#/season' }] },
  { id: 'fan', label: 'Fan', href: () => '#/profile', get subs() { return [{ id: 'profile', label: 'Your fan', href: '#/profile' }, { id: 'shop', label: 'Shop', href: '#/shop' }, ...(socialOn() ? [{ id: 'crew', label: 'Crew', href: '#/crew' }] : [])]; } },
];
const sectionOf = (navId) => (TABS.some((t) => t.id === navId) ? 'sports' : navId === 'season' ? 'quests' : navId === 'profile' || navId === 'shop' || navId === 'crew' ? 'fan' : navId === 'duels' || navId === 'daily' || navId === 'survivor' || navId === 'cap' ? 'picks' : navId);

let cleanup = null;
let token = 0;

export function currentPath() {
  return (location.hash || '#/').replace(/^#/, '').split('?')[0] || '/';
}

export async function route() {
  const my = ++token;
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  let path = currentPath();

  if (!getState().onboarded && path !== '/onboarding' && path !== '/check' && path !== '/settings' && !path.startsWith('/join/')) {
    location.hash = '#/onboarding';
    return;
  }

  let found = null;
  for (const r of ROUTES) { const m = path.match(r.re); if (m) { found = { r, m }; break; } }
  if (!found) { location.hash = '#/'; return; }

  const navId = typeof found.r.nav === 'function' ? found.r.nav(found.m) : found.r.nav;
  drawNav(nav, navId);
  document.body.classList.toggle('onboarding', navId === 'none');
  slipHidden(navId === 'none');
  document.body.removeAttribute('style');

  // team and game pages take on that team's colours; everything else uses the team playing next
  const kind = /^\/team\//.test(path) ? 'team' : /^\/game\//.test(path) ? 'game' : '';
  if (kind) teamForRoute(kind, found.r.params(found.m)).then((t) => { if (my === token) setContextTeam(t); }).catch(() => {});
  else setContextTeam(null);

  clear(app);
  const root = h('div', { class: 'view' });
  app.append(root);
  try {
    const mod = await found.r.view();
    if (my !== token) return;
    const result = await mod.render(root, found.r.params(found.m));
    if (my !== token) { if (typeof result === 'function') result(); return; }
    if (typeof result === 'function') cleanup = result;
  } catch (e) {
    console.error(e);
    clear(root).append(h('div', { class: 'errbox', role: 'alert' }, h('h3', null, 'Something broke'), h('p', null, e.message || String(e)), h('a', { class: 'btn', href: '#/check' }, 'Run data check')));
  }
  window.scrollTo(0, 0);
}

function icon(id) {
  const el = h('span', { class: 'ic' });
  el.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg>`;
  return el;
}
function drawNav(nav, active) {
  const sec = sectionOf(active);
  if (TABS.some((t) => t.id === active)) { try { localStorage.setItem(LAST_KEY, active); } catch (e) { /* fine */ } }
  const hide = active === 'none';
  const item = (S, cls) => h('a', { href: S.href(), class: cls + (S.id === sec ? ' on' : ''), 'aria-current': S.id === sec ? 'page' : null, 'data-sec': S.id },
    icon(S.id),
    h('span', { class: 'lb' }, S.label));
  clear(nav); nav.hidden = hide;
  SECTIONS.forEach((S) => nav.append(item(S, 'nav-i')));
  const bar = document.getElementById('tabbar');
  if (bar) { clear(bar); bar.hidden = hide; SECTIONS.forEach((S) => bar.append(item(S, 'tb-i'))); }
  const gear = document.getElementById('gear');
  if (gear) { gear.hidden = hide; gear.classList.toggle('on', active === 'settings'); }
  const sub = document.getElementById('subnav');
  if (sub) {
    const S = SECTIONS.find((x) => x.id === sec);
    clear(sub);
    sub.hidden = hide || !S || S.subs.length < 2;
    if (!sub.hidden) S.subs.forEach((x) => sub.append(h('a', { href: x.href, class: 'sub-i' + (x.id === active ? ' on' : ''), 'aria-current': x.id === active ? 'page' : null }, x.label)));
  }
  document.body.classList.toggle('has-sub', !!sub && !sub.hidden);
  measureTop();
}
function measureTop() {
  const top = document.querySelector('header.top');
  if (top && top.offsetHeight) document.documentElement.style.setProperty('--top-h', top.offsetHeight + 'px');
}

export function start() {
  bindSettings(() => getState().settings);
  applyTheme(getState().settings);
  watchSystem(() => getState().settings);
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', measureTop);
  const slip = document.getElementById('slip');
  if (slip) mountSlip(slip);
  route();
  try { startBrand(); } catch (e) { /* the logo is optional */ }
  try {
    settleAll().then(() => {
      for (const n of takeNotices()) {
        if (n.status === 'won') toast(`You won! ${n.title}: +${(n.payout - n.stake).toLocaleString()} coins`);
        else if (n.status === 'lost') toast(`Lost: ${n.title}`);
        else toast(`Refunded: ${n.title}`);
      }
      queueSync();
    }).catch(() => {});
  } catch (e) { /* ignore */ }
  try { startSocial(); } catch (e) { /* the crew games are optional */ }
  try {
    import('./cardlive.js').then((m) => {
      const go = () => m.announceDaily().catch(() => {});
      setTimeout(go, 2500);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
    }).catch(() => {});
  } catch (e) { /* notices are optional */ }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
