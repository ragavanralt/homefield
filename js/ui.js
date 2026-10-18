// Tiny DOM helpers shared by every screen. No framework.
import { getState } from './store.js';
import { LEAGUES } from './leagues.js';
import { initials, skinFromColors } from './util.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk.startsWith('--') ? sk : sk.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), sv);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/** Put a team's colours on an element as CSS variables so everything inside is skinned. */
export function applySkin(el, color, alt) {
  const sk = skinFromColors(color, alt);
  el.style.setProperty('--t1', sk.t1);
  el.style.setProperty('--t2', sk.t2);
  el.style.setProperty('--tink', sk.tink);
  el.style.setProperty('--tacc', sk.tacc);
  return sk;
}

/** A team logo, or a coloured badge with the abbreviation if logos are off or the image fails. */
export function crest(team, size = 40) {
  const sk = skinFromColors(team.color, team.alt);
  const wrap = h('span', { class: 'crest', style: { width: size + 'px', height: size + 'px' } });
  const badge = () => h('span', { class: 'crest-badge', style: { background: `linear-gradient(135deg, ${sk.t1}, ${sk.t2})`, color: sk.tink, fontSize: Math.round(size * 0.33) + 'px' } }, (team.abbr || '?').slice(0, 3));
  if (getState().settings.logos && team.logo) {
    wrap.appendChild(h('img', { src: team.logo, alt: '', loading: 'lazy', decoding: 'async', onerror: () => wrap.replaceChildren(badge()) }));
  } else wrap.appendChild(badge());
  return wrap;
}

const HEAD_PATH = { nhl: 'nhl', nba: 'nba', nfl: 'nfl', mlb: 'mlb', soccer: 'soccer' };
export function headshotUrl(league, id) {
  const g = LEAGUES[league]?.group;
  return id && HEAD_PATH[g] ? `https://a.espncdn.com/i/headshots/${HEAD_PATH[g]}/players/full/${id}.png` : '';
}

/** A player headshot, or a circle with initials. */
export function face(p, league, size = 36) {
  const wrap = h('span', { class: 'face', style: { width: size + 'px', height: size + 'px' } });
  const fallback = () => h('span', { class: 'face-init', style: { fontSize: Math.round(size * 0.38) + 'px' } }, initials(p.name || p.who));
  const src = p.face || headshotUrl(league, p.id);
  if (getState().settings.logos && src) wrap.appendChild(h('img', { src, alt: '', loading: 'lazy', decoding: 'async', onerror: () => wrap.replaceChildren(fallback()) }));
  else wrap.appendChild(fallback());
  return wrap;
}

/* ---------- spoiler-free mode ---------- */
const revealed = new Set();
export const reveal = (key) => revealed.add(key);
export const isHidden = (g) => getState().settings.spoilerFree && g.state !== 'pre' && !revealed.has(g.key);
export const scoreText = (g, side) => (isHidden(g) ? '•' : (g[side].score ?? '–'));

/* ---------- small things ---------- */
export function toast(msg) {
  const box = document.getElementById('toast');
  if (!box) return;
  const t = h('div', { class: 'toast-item', role: 'status' }, msg);
  box.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

export function downloadText(filename, text, mime = 'text/calendar') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
}

export const loading = (msg = 'Loading') => h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spin' }), msg);
export function emptyState(title, sub, action) {
  return h('div', { class: 'empty' }, h('h3', null, title), sub ? h('p', null, sub) : null, action || null);
}
export function errorBox(err, retry) {
  const msg = err && err.message ? err.message : String(err);
  return h('div', { class: 'errbox', role: 'alert' },
    h('h3', null, 'Could not load that'),
    h('p', null, msg + '. Check your connection and try again.'),
    h('div', { class: 'row' },
      retry ? h('button', { class: 'btn main', type: 'button', onclick: retry }, 'Try again') : null,
      h('a', { class: 'btn', href: '#/check' }, 'Run data check'),
    ),
  );
}

/** Runs fn every ms while the page is visible and shouldRun() is true. Returns a stop function. */
export function poll(fn, ms, shouldRun = () => true) {
  const id = setInterval(() => { if (document.visibilityState !== 'hidden' && shouldRun()) fn(); }, ms);
  const onVis = () => { if (document.visibilityState === 'visible' && shouldRun()) fn(); };
  document.addEventListener('visibilitychange', onVis);
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
}
