// Small pieces shared by the crew screens.
import { h, clear, toast, loading } from './ui.js';
import { pageHead } from './components.js';
import { renderAvatar } from './avatar.js';
import { getBank } from './store.js';
import * as soc from './social.js';

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
export const ET = 'America/New_York';
export const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dayTime = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString([], { weekday: 'short' })} ${clock(iso)}`; };
export const errText = (e) => (e && e.message) || 'Something went wrong';

/** Shows a message instead of the page when the server is not set up or you are signed out. Returns true when the page can go on. */
export function gate(root, title, sub) {
  root.append(pageHead(title, sub));
  if (!soc.enabled()) {
    root.append(h('div', { class: 'empty' }, h('h3', null, 'Not switched on yet'), h('p', null, 'The crew games need the crew server. Once it is connected in this copy of the app, they show up here.')));
    return false;
  }
  if (!soc.signedIn()) {
    root.append(h('div', { class: 'empty' }, h('h3', null, 'Join the crew first'), h('p', null, 'You need an invite from the crew owner, or sign in with your handle and recovery code.'), h('a', { class: 'btn main', href: '#/crew' }, 'Join or sign in')));
    return false;
  }
  return true;
}

export function coinPill() {
  const el = h('span', { class: 'coin-pill' }, h('i', { class: 'coin' }), fmt(getBank().coins));
  return el;
}

/** A person's avatar bubble, or their initial if they have not saved one yet. */
export function bubble(p, cls = 'bust') {
  const wrap = h('span', { class: 'who-av' });
  if (p && p.avatar && p.avatar.eq) { try { wrap.append(renderAvatar(p.avatar, p.team || null, cls)); return wrap; } catch (e) { /* fall through */ } }
  wrap.append(h('span', { class: 'who-init' }, ((p && (p.display || p.handle)) || '?').slice(0, 1).toUpperCase()));
  return wrap;
}

/** A banner that appears when winnings or refunds are waiting. Tapping Claim adds them to your coins. */
export function claimBar(onDone) {
  const box = h('div', { class: 'claim-host' });
  if (!soc.signedIn()) return box;
  soc.waiting().then((w) => {
    if (!w || !w.total) return;
    const btn = h('button', { type: 'button', class: 'btn main', onclick: async () => {
      btn.disabled = true;
      try {
        const r = await soc.claim();
        toast(r.total ? `+${fmt(r.total)} coins collected` : 'Nothing to collect');
        clear(box);
        if (onDone) onDone();
      } catch (e) { toast(errText(e)); btn.disabled = false; }
    } }, `Collect ${fmt(w.total)} coins`);
    const notes = (w.items || []).slice(0, 4).map((i) => `${i.note || i.kind} +${fmt(i.amount)}`).join(' · ');
    box.append(h('div', { class: 'claim-bar', role: 'status' }, h('div', null, h('b', null, `${fmt(w.total)} coins are waiting for you`), h('small', null, notes)), btn));
  }).catch(() => {});
  return box;
}

/** Loads data into `host`, shows a spinner first and a retry on failure. Returns the load function. */
export function loader(host, fetcher, draw) {
  const run = async (quiet) => {
    if (!quiet) clear(host).append(loading());
    try { const d = await fetcher(); clear(host); draw(d); } catch (e) {
      if (quiet) return;
      clear(host).append(h('div', { class: 'errbox', role: 'alert' }, h('h3', null, 'Could not load that'), h('p', null, errText(e)), h('button', { class: 'btn main', type: 'button', onclick: () => run(false) }, 'Try again')));
    }
  };
  return run;
}

/** Button that runs an async action, locks while it runs and toasts any error. */
export function actionBtn(label, fn, cls = 'btn') {
  const b = h('button', { type: 'button', class: cls }, label);
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    b.disabled = true;
    try { await fn(); } catch (e) { toast(errText(e)); } finally { b.disabled = false; }
  });
  return b;
}

export const sideBtn = (label, on, locked, onclick, extra = '') =>
  h('button', { type: 'button', class: `side${on ? ' on' : ''}${extra ? ' ' + extra : ''}`, disabled: locked ? '' : null, 'aria-pressed': on ? 'true' : 'false', onclick }, label);
