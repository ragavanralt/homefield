// App shell: hash router, nav bar, first-run redirect.
import { h, clear } from './ui.js';
import { getState, takeNotices } from './store.js';
import { mountSlip, slipHidden } from './slip.js';
import { toast } from './ui.js';
import { TABS } from './leagues.js';
import { settleAll } from './settle.js';
import { applyTheme, watchSystem, bindSettings } from './themes.js';
import { startBrand, setContextTeam, teamForRoute } from './brand.js';
import { startPixelate } from './pixel.js';

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
  { re: /^\/onboarding$/, view: () => import('./views/onboarding.js'), nav: 'none', params: () => ({}) },
  { re: /^\/settings$/, view: () => import('./views/settings.js'), nav: 'settings', params: () => ({}) },
  { re: /^\/check$/, view: () => import('./views/check.js'), nav: 'settings', params: () => ({}) },
];

const NAV = [
  { id: 'home', label: 'Home', href: '#/' },
  ...TABS.map((t) => ({ id: t.id, label: t.label, href: `#/league/${t.id}` })),
  { id: 'picks', label: "Pick'em", href: '#/picks' },
  { id: 'season', label: 'Season', href: '#/season' },
  { id: 'profile', label: 'Fan', href: '#/profile' },
  { id: 'shop', label: 'Shop', href: '#/shop' },
  { id: 'quests', label: 'Quests', href: '#/quests' },
  { id: 'settings', label: 'Settings', href: '#/settings' },
];

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

  if (!getState().onboarded && path !== '/onboarding' && path !== '/check' && path !== '/settings') {
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

function drawNav(nav, active) {
  clear(nav);
  nav.hidden = active === 'none';
  NAV.forEach((n) => nav.append(h('a', { href: n.href, class: 'nav-i' + (n.id === active ? ' on' : ''), 'aria-current': n.id === active ? 'page' : null }, h('span', null, n.label))));
}

export function start() {
  bindSettings(() => getState().settings);
  applyTheme(getState().settings);
  watchSystem(() => getState().settings);
  window.addEventListener('hashchange', route);
  const slip = document.getElementById('slip');
  if (slip) mountSlip(slip);
  route();
  try { startBrand(); } catch (e) { /* the logo is optional */ }
  try { startPixelate(); } catch (e) { /* the smooth fan is fine too */ }
  try {
    settleAll().then(() => {
      for (const n of takeNotices()) {
        if (n.status === 'won') toast(`You won! ${n.title}: +${(n.payout - n.stake).toLocaleString()} coins`);
        else if (n.status === 'lost') toast(`Lost: ${n.title}`);
        else toast(`Refunded: ${n.title}`);
      }
    }).catch(() => {});
  } catch (e) { /* ignore */ }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
