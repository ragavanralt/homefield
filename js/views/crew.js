// Crew: join with an invite, sign in on a new device, the table, the fit gallery, and owner tools.
import { h, clear, toast } from '../ui.js';
import { pageHead } from '../components.js';
import * as soc from '../social.js';
import { renderAvatar, copyLook } from '../avatar.js';
import { bubble, claimBar, fmt, loader, actionBtn, errText, add } from '../social-ui.js';

const pct = (a) => (a == null ? '–' : Math.round(a * 100) + '%');
const link = (code) => `${location.origin}${location.pathname}#/join/${code}`;

async function copy(text, msg = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { window.prompt('Copy this:', text); }
}

export async function render(root, params = {}) {
  const host = h('div', { class: 'crew' });
  root.append(pageHead('Crew', 'Your friends, one leaderboard, everyone\'s fits.'), host);
  if (!soc.enabled()) {
    host.append(h('div', { class: 'empty' }, h('h3', null, 'Not switched on yet'), h('p', null, 'The crew server is not connected in this copy of the app.')));
    return;
  }
  const off = soc.onAuthChange(() => draw());
  let shownCode = null; // a fresh recovery code, shown once

  function draw() {
    clear(host);
    if (shownCode) return host.append(codeCard(shownCode, () => { shownCode = null; draw(); }));
    if (!soc.signedIn()) return host.append(entry());
    host.append(claimBar(), me(), h('div', { class: 'crew-body' }));
    body(host.querySelector('.crew-body'));
  }

  /* ----- signed out: join or sign in ----- */
  function entry() {
    let mode = 'join';
    const wrap = h('section', { class: 'card crew-entry' });
    const paint = () => {
      add(clear(wrap),
        h('div', { class: 'seg', role: 'tablist' },
          h('button', { type: 'button', class: 'seg-b' + (mode === 'join' ? ' on' : ''), onclick: () => { mode = 'join'; paint(); } }, 'I have an invite'),
          h('button', { type: 'button', class: 'seg-b' + (mode === 'in' ? ' on' : ''), onclick: () => { mode = 'in'; paint(); } }, 'Sign in on this device')),
        mode === 'join' ? joinForm() : inForm());
    };
    const field = (label, attrs) => h('label', { class: 'field' }, h('span', null, label), h('input', { autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...attrs }));
    function joinForm() {
      const inv = field('Invite code', { id: 'f-invite', value: params.code || '', placeholder: 'HF…' });
      const hd = field('Pick a handle', { id: 'f-handle', placeholder: '3 to 16 letters, numbers, _', maxlength: '16' });
      const dn = field('Display name (optional)', { id: 'f-display', maxlength: '24' });
      const go = actionBtn('Join the crew', async () => {
        const r = await soc.signup(inv.querySelector('input').value, hd.querySelector('input').value, dn.querySelector('input').value);
        shownCode = r.code; draw();
      }, 'btn main big');
      return h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'No email, no password. You get a recovery code once; keep it, it is how you sign in on another device.'), inv, hd, dn, go);
    }
    function inForm() {
      const hd = field('Handle', { id: 'f-handle2' });
      const cd = field('Recovery code', { id: 'f-code', placeholder: 'XXXX-XXXX-XXXX-XXXX' });
      const go = actionBtn('Sign in', async () => { await soc.login(hd.querySelector('input').value, cd.querySelector('input').value); toast('Signed in'); draw(); }, 'btn main big');
      return h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Moving from your phone to your Mac (or back)? Enter your handle and recovery code. Your fan, coins and picks come with you.'), hd, cd, go);
    }
    paint();
    return wrap;
  }

  function codeCard(code, done) {
    return h('section', { class: 'card code-card' },
      h('h2', { class: 'card-h' }, 'Your recovery code'),
      h('p', null, 'Write this down or save it somewhere safe. It is the only way back into your account on a new device, and we cannot show it again.'),
      h('div', { class: 'code-big', id: 'recovery-code' }, code),
      h('div', { class: 'row wrap' },
        h('button', { type: 'button', class: 'btn', onclick: () => copy(code, 'Code copied') }, 'Copy'),
        h('button', { type: 'button', class: 'btn main', id: 'code-saved', onclick: done }, 'I saved it')));
  }

  /* ----- signed in ----- */
  function me() {
    const u = soc.me();
    const name = h('input', { class: 'inp', value: u.display, maxlength: '24', 'aria-label': 'Display name' });
    return h('section', { class: 'card crew-me' },
      h('div', { class: 'crew-me-h' }, bubble({ avatar: null, display: u.display }), h('div', null, h('b', null, u.display), h('small', null, `@${u.handle} · ${u.crew.name}${u.owner ? ' · owner' : ''}`))),
      h('div', { class: 'row wrap' },
        name,
        actionBtn('Rename', async () => { await soc.setDisplay(name.value); toast('Saved'); draw(); }, 'btn small'),
        actionBtn('New recovery code', async () => { if (!confirm('Make a new recovery code? The old one stops working.')) return; shownCode = (await soc.newCode()).code; draw(); }, 'btn small'),
        actionBtn('Sign out', async () => { await soc.logout(); draw(); }, 'btn small danger')));
  }

  function body(el) {
    const run = loader(el, () => soc.crew(), (d) => {
      const ms = d.members.slice();
      const rank = (m) => { const s = m.stats || {}; const dec = (s.won || 0) + (s.lost || 0); return [dec ? (s.won || 0) / dec : -1, s.won || 0]; };
      ms.sort((a, b) => { const x = rank(a), y = rank(b); return y[0] - x[0] || y[1] - x[1] || a.handle.localeCompare(b.handle); });
      add(el,
        h('section', { class: 'card' },
          h('h2', { class: 'card-h' }, 'The table', h('small', null, "ranked by pick'em record")),
          h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl crew-table' },
            h('thead', null, h('tr', null, ['#', 'Player', "Pick'em", 'Hit rate', 'Streak', 'Duels', 'Daily 5'].map((t) => h('th', null, t)))),
            h('tbody', null, ms.map((m, i) => { const s = m.stats || {}; return h('tr', { class: m.me ? 'me' : '', 'data-handle': m.handle },
              h('td', null, i + 1),
              h('td', null, h('span', { class: 'who' }, bubble(m, 'bust sm'), h('span', null, m.display, m.owner ? h('small', null, ' owner') : null))),
              h('td', null, `${s.won || 0}–${s.lost || 0}`), h('td', null, pct(s.accuracy)), h('td', null, s.streak ? `${s.streak}` : '–'),
              h('td', null, `${m.duel_w}–${m.duel_l}${m.duel_t ? `–${m.duel_t}` : ''}`), h('td', null, m.solo_streak ? `${m.solo_streak} d` : '–')); })))),
          h('p', { class: 'muted' }, 'Pick\'em record comes from each person\'s own app, so it is for fun.')),
        h('section', { class: 'card' },
          h('h2', { class: 'card-h' }, 'Fit gallery', h('small', null, 'like a fit, or copy it onto your fan')),
          h('div', { class: 'fit-gallery crew-fits' }, ms.map(fitCard))),
        soc.me().owner ? owner(d.members) : null);
    });
    run();
  }

  /* a person's full look, with their saved fits one tap away; like it, or copy what you own of it */
  function fitCard(m) {
    const fits = (m.avatar && m.avatar.fits) || [];
    let sel = 'current', note = null;
    const likes = { ...(m.likes || {}) }, liked = new Set(m.liked || []);
    const card = h('article', { class: 'fit-card', 'data-handle': m.handle });
    const look = () => (sel === 'current' || !fits.find((f) => f.id === sel) ? m.avatar : { ...m.avatar, ...fits.find((f) => f.id === sel) });
    const paint = () => {
      const av = look();
      const chip = (label, id) => h('button', { type: 'button', class: 'chip' + (sel === id ? ' on' : ''), 'aria-pressed': sel === id ? 'true' : 'false', 'data-fit': id, onclick: () => { sel = id; note = null; paint(); } }, label);
      add(clear(card),
        h('div', { class: 'fit-stage' }, av && av.eq ? renderAvatar(av, m.team || null, 'full') : bubble(m)),
        h('b', { class: 'it-n' }, m.display, m.me ? h('small', null, ' you') : null),
        fits.length ? h('div', { class: 'chip-row fit-pick' }, chip('Now', 'current'), fits.map((f) => chip(f.name, f.id))) : null,
        h('div', { class: 'row wrap fit-act' },
          m.me ? h('span', { class: 'fit-hearts', 'aria-label': 'likes' }, `♥ ${likes[sel] || 0}`)
            : actionBtn(`${liked.has(sel) ? '♥' : '♡'} ${likes[sel] || 0}`, async () => {
              const r = await soc.fitLike(m.handle, sel);
              likes[sel] = r.count; if (r.liked) liked.add(sel); else liked.delete(sel); paint();
            }, 'btn small like' + (liked.has(sel) ? ' on' : '')),
          m.me || !av || !av.eq ? null : h('button', { type: 'button', class: 'btn small copy', onclick: () => {
            const r = copyLook(av);
            note = r;
            toast(r.missing.length ? `Copied ${r.worn.length} piece${r.worn.length === 1 ? '' : 's'}. ${r.missing.length} you do not own yet.` : 'Copied. You are wearing it.');
            paint();
          } }, 'Copy fit')),
        note ? h('div', { class: 'fit-note', role: 'status' },
          h('small', null, note.missing.length ? 'Missing from your closet:' : 'You own every piece.'),
          note.missing.length ? h('ul', null, note.missing.map((x) => h('li', null, `${x.name}${x.earned ? ' (earned)' : x.price != null ? ` · ${fmt(x.price)} coins` : ''}`))) : null,
          note.missing.length ? h('a', { href: '#/shop' }, 'Open the Shop') : null) : null);
    };
    paint();
    return card;
  }

  function owner(members) {
    const box = h('section', { class: 'card crew-owner' }, h('h2', { class: 'card-h' }, 'Owner tools'));
    const list = h('div', { class: 'stack' });
    const paintInv = async () => {
      clear(list);
      try {
        const r = await soc.invites();
        (r.invites || []).filter((i) => !i.revoked).forEach((i) => list.append(h('div', { class: 'row wrap inv', 'data-code': i.code },
          h('code', null, i.code), h('small', null, `${i.uses}/${i.max} used`),
          h('button', { type: 'button', class: 'btn small', onclick: () => copy(link(i.code), 'Link copied') }, 'Copy link'),
          actionBtn('Revoke', async () => { await soc.revokeInvite(i.code); paintInv(); }, 'btn small danger'))));
        if (!list.childNodes.length) list.append(h('p', { class: 'muted' }, 'No active invites.'));
      } catch (e) { list.append(h('p', { class: 'muted' }, errText(e))); }
    };
    add(box,
      h('div', { class: 'row wrap' }, actionBtn('Make an invite link', async () => { const r = await soc.makeInvite(1, 14); await copy(link(r.code), 'Invite link copied'); paintInv(); }, 'btn main'),
        h('small', { class: 'muted' }, 'One use, good for 14 days.')),
      list,
      h('h3', null, 'Members'),
      h('div', { class: 'stack' }, members.filter((m) => !m.me).map((m) => h('div', { class: 'row wrap' }, h('span', null, `${m.display} (@${m.handle})`),
        actionBtn('Remove', async () => { if (!confirm(`Remove ${m.display} from the crew?`)) return; await soc.removeMember(m.handle); toast('Removed'); draw(); }, 'btn small danger')))));
    paintInv();
    return box;
  }

  draw();
  return () => off();
}
