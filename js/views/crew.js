// Crew: join with an invite, sign in on a new device, the table, the fit gallery, and owner tools.
import { h, clear, toast } from '../ui.js';
import { pageHead } from '../components.js';
import * as soc from '../social.js';
import { renderAvatar, copyLook } from '../avatar.js';
import { bubble, claimBar, fmt, loader, actionBtn, errText, add } from '../social-ui.js';
import { toggleLeg, setSlip, slipHas, getState, update } from '../store.js';

const pct = (a) => (a == null ? '–' : Math.round(a * 100) + '%');
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
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
  let timer = null;
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
        actionBtn('Sign out', async () => { await soc.logout(); draw(); }, 'btn small danger')),
      h('label', { class: 'share-row' },
        h('input', { type: 'checkbox', id: 'share-bets', checked: getState().shareBets !== false ? '' : null, onchange: (e) => { update((st) => { st.shareBets = e.target.checked; }); toast(e.target.checked ? 'The crew can see your recent bets' : 'Your bets are hidden from the crew'); } }),
        h('span', null, 'Show my recent bets to the crew (they can mirror them)')));
  }

  function body(el) {
    const run = loader(el, () => soc.crew(), (d) => {
      const ms = d.members.slice();
      add(el,
        awards(ms),
        h('section', { class: 'card' },
          h('h2', { class: 'card-h' }, 'The table', h('small', null, 'tap a column to re-rank')),
          tableBox(ms),
          h('p', { class: 'muted' }, 'Records come from each person\'s own app, so it is for fun.')),
        feed(ms),
        wall(ms),
        h('section', { class: 'card' },
          h('h2', { class: 'card-h' }, 'Fit gallery', h('small', null, "what everyone's wearing right now")),
          h('div', { class: 'fit-gallery crew-fits' }, ms.map(fitCard))),
        soc.me().owner ? owner(d.members) : null);
    });
    run();
  }

  /* ----- the table, ranked by whatever you tap ----- */
  function tableBox(ms) {
    const dec = (s) => (s.won || 0) + (s.lost || 0);
    const COLS = [
      ['pick', "Pick'em", (m) => { const s = m.stats || {}; return [dec(s) ? (s.won || 0) / dec(s) : -1, s.won || 0]; }, (m) => `${(m.stats || {}).won || 0}–${(m.stats || {}).lost || 0}`],
      ['rate', 'Hit rate', (m) => [(m.stats || {}).accuracy == null ? -1 : m.stats.accuracy, dec(m.stats || {})], (m) => pct((m.stats || {}).accuracy)],
      ['profit', 'Profit', (m) => [(m.stats || {}).profit || 0, 0], (m) => ((m.stats || {}).profit == null ? '–' : signed(m.stats.profit))],
      ['streak', 'Streak', (m) => [(m.stats || {}).streak || 0, (m.stats || {}).bestStreak || 0], (m) => ((m.stats || {}).streak ? `${m.stats.streak}` : '–')],
      ['parlay', 'Parlays', (m) => [(m.stats || {}).parlays || 0, (m.stats || {}).bigParlay || 0], (m) => ((m.stats || {}).parlays ? `${m.stats.parlays}` : '–')],
      ['duels', 'Duels', (m) => [m.duel_w - m.duel_l, m.duel_w], (m) => `${m.duel_w}–${m.duel_l}${m.duel_t ? `–${m.duel_t}` : ''}`],
      ['daily', 'Daily 5', (m) => [m.solo_streak || 0, m.solo_best || 0], (m) => (m.solo_streak ? `${m.solo_streak} d` : '–')],
    ];
    let key = 'pick';
    const box = h('div', { class: 'tbl-scroll' });
    const paint = () => {
      const col = COLS.find((c) => c[0] === key);
      const rows = ms.slice().sort((a, b) => { const x = col[2](a), y = col[2](b); return y[0] - x[0] || y[1] - x[1] || a.handle.localeCompare(b.handle); });
      add(clear(box), h('table', { class: 'tbl crew-table' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Player'), COLS.map((c) => h('th', null, h('button', { type: 'button', class: 'th-b' + (c[0] === key ? ' on' : ''), 'data-sort': c[0], onclick: () => { key = c[0]; paint(); } }, c[1], c[0] === key ? ' ↓' : ''))))),
        h('tbody', null, rows.map((m, i) => h('tr', { class: m.me ? 'me' : '', 'data-handle': m.handle },
          h('td', null, i + 1),
          h('td', null, h('span', { class: 'who' }, bubble(m, 'bust sm'), h('span', null, m.display, m.owner ? h('small', null, ' owner') : null))),
          COLS.map((c) => h('td', { class: c[0] === key ? 'hot' : '' }, c[3](m))))))));
    };
    paint();
    return box;
  }

  /* ----- awards: who is the best at what, this week's bragging rights ----- */
  function awards(ms) {
    const best = (f, min = 1) => ms.reduce((top, m) => { const v = f(m.stats || {}); return v >= min && (!top || v > top.v) ? { m, v } : top; }, null);
    const list = [
      ['💰', 'Top earner', best((s) => s.profit || 0), (v) => `${signed(v)} coins`],
      ['🔥', 'Hottest streak', best((s) => s.streak || 0), (v) => `${v} in a row`],
      ['🎯', 'Sharpest', ms.reduce((top, m) => { const s = m.stats || {}; const n = (s.won || 0) + (s.lost || 0); return n >= 5 && s.accuracy != null && (!top || s.accuracy > top.v) ? { m, v: s.accuracy } : top; }, null), (v) => `${pct(v)} hit rate`],
      ['🧾', 'Parlay king', best((s) => s.parlays || 0), (v) => `${v} hit`],
      ['🚀', 'Longshot', best((s) => s.longshot || 0, 2), (v) => `${v.toFixed(1)}x winner`],
      ['⚔️', 'Duel boss', ms.reduce((top, m) => (m.duel_w >= 1 && (!top || m.duel_w > top.v) ? { m, v: m.duel_w } : top), null), (v) => `${v} duel win${v === 1 ? '' : 's'}`],
      ['📺', 'Most watched', best((s) => s.watched || 0), (v) => `${v} games`],
      ['🗓️', 'Daily 5 streak', ms.reduce((top, m) => (m.solo_streak >= 1 && (!top || m.solo_streak > top.v) ? { m, v: m.solo_streak } : top), null), (v) => `${v} days`],
    ].filter((a) => a[2]);
    if (!list.length) return null;
    return h('section', { class: 'card crew-awards' },
      h('h2', { class: 'card-h' }, 'Crew awards', h('small', null, 'who is winning at what')),
      h('div', { class: 'award-grid' }, list.map(([icon, name, w, fmtV]) => h('div', { class: 'award' + (w.m.me ? ' me' : ''), 'data-award': name },
        h('span', { class: 'award-i', 'aria-hidden': 'true' }, icon), bubble(w.m, 'bust sm'),
        h('div', null, h('small', null, name), h('b', null, w.m.me ? 'You' : w.m.display), h('small', null, fmtV(w.v)))))));
  }

  /* ----- live feed: what everyone just bet, with a Mirror button to put it on your own slip ----- */
  function feed(ms) {
    let mode = 'all';
    const items = [];
    ms.forEach((m) => ((m.stats && m.stats.recent) || []).forEach((b) => items.push({ m, b })));
    items.sort((x, y) => (y.b.ts || 0) - (x.b.ts || 0));
    const box = h('section', { class: 'card crew-feed' });
    const paint = () => {
      const shown = items.filter(({ b }) => mode === 'all' || (mode === 'parlay' && b.mode === 'parlay') || (mode === 'open' && b.status === 'pending') || (mode === 'hit' && b.status === 'won')).slice(0, 20);
      const chip = (id, label) => h('button', { type: 'button', class: 'chip' + (mode === id ? ' on' : ''), 'aria-pressed': mode === id ? 'true' : 'false', 'data-feed': id, onclick: () => { mode = id; paint(); } }, label);
      add(clear(box),
        h('h2', { class: 'card-h' }, 'Crew bets', h('small', null, 'mirror one to copy it onto your slip')),
        h('div', { class: 'chip-row' }, chip('all', 'All'), chip('open', 'Open'), chip('parlay', 'Parlays'), chip('hit', 'Hits')),
        shown.length ? h('div', { class: 'feed-list' }, shown.map(({ m, b }) => betRow(m, b)))
          : h('p', { class: 'muted' }, items.length ? 'Nothing like that yet.' : 'No bets to show yet. When someone in the crew places a bet it lands here.'));
    };
    paint();
    return box;
  }
  function betRow(m, b) {
    const now = Date.now();
    const open = b.status === 'pending';
    const live = (b.legs || []).filter((l) => new Date(l.date).getTime() > now);
    const net = b.status === 'won' ? (b.payout || 0) - b.stake : b.status === 'lost' ? -b.stake : 0;
    const mark = (l) => (l.result === 'won' ? '✓' : l.result === 'lost' ? '✗' : l.result === 'push' || l.result === 'void' ? '–' : '•');
    const row = h('article', { class: 'bet-card ' + b.status, 'data-bet': b.id },
      h('div', { class: 'bet-h' }, bubble(m, 'bust sm'),
        h('div', { class: 'bet-who' }, h('b', null, m.me ? 'You' : m.display), h('small', null, `${b.mode === 'parlay' ? `${(b.legs || []).length}-leg parlay` : 'Single'} · ${ago(b.ts)}`)),
        h('div', { class: 'bet-res' }, h('span', { class: 'pill ' + b.status }, open ? 'Open' : b.status === 'won' ? 'Hit' : b.status === 'lost' ? 'Missed' : 'Refunded'),
          h('small', null, open ? `${fmt(b.stake)} → ${fmt(Math.round(b.stake * (b.dec || 1)))}` : b.status === 'void' ? `${fmt(b.stake)} back` : `${signed(net)} coins`))),
      h('ul', { class: 'bet-legs' }, (b.legs || []).map((l) => h('li', { class: l.result || 'pending' }, h('span', { class: 'lm', 'aria-hidden': 'true' }, mark(l)),
        h('span', null, l.label || 'Pick', l.away && l.home ? h('small', null, ` ${l.away.abbr} @ ${l.home.abbr}`) : null),
        l.dec ? h('em', null, `${Number(l.dec).toFixed(2)}x`) : null))),
      m.me ? null : h('div', { class: 'row wrap bet-act' },
        live.length ? h('button', { type: 'button', class: 'btn small main mirror', onclick: () => {
          const r = mirrorBet(b);
          toast(r.added ? `Added ${r.added} pick${r.added === 1 ? '' : 's'} to your slip${r.started ? ` (${r.started} already started)` : ''}` : r.dupes ? 'Those picks are already on your slip' : 'Those games already started');
        } }, '⇄ Mirror this bet') : h('small', { class: 'muted' }, 'Games already started'),
        h('a', { class: 'btn small', href: `#/duels/vs/${encodeURIComponent(m.handle)}` }, 'Challenge')));
    return row;
  }
  /* put the not-yet-started legs of someone else's bet on your own slip, results cleared */
  function mirrorBet(b) {
    const now = Date.now();
    const legs = (b.legs || []).filter((l) => new Date(l.date).getTime() > now);
    let added = 0, dupes = 0;
    legs.forEach((l) => { if (slipHas(l.key)) dupes++; else { toggleLeg({ ...l, result: 'pending' }); added++; } });
    if (added) setSlip({ mode: b.mode === 'parlay' && (legs.length > 1 || getState().slip.legs.length > 1) ? 'parlay' : 'single' });
    return { added, dupes, started: (b.legs || []).length - legs.length };
  }

  /* ----- the wall ----- */
  function wall(ms) {
    const byHandle = new Map(ms.map((m) => [m.handle.toLowerCase(), m]));
    const box = h('section', { class: 'card crew-wall' }, h('h2', { class: 'card-h' }, 'The wall', h('small', null, 'talk your talk')));
    const input = h('textarea', { class: 'inp wall-in', maxlength: '280', rows: '2', placeholder: 'Say something to the crew…', 'aria-label': 'Write on the wall' });
    const list = h('div', { class: 'wall-list' });
    const load = async () => {
      try {
        const r = await soc.wallGet();
        clear(list);
        if (!r.posts.length) return list.append(h('p', { class: 'muted' }, 'Nobody has posted yet. Be first.'));
        r.posts.forEach((p) => {
          const m = byHandle.get(String(p.handle).toLowerCase()) || { handle: p.handle, display: p.handle };
          let cheers = p.cheers, cheered = p.cheered;
          const post = h('article', { class: 'wall-post', 'data-post': p.id });
          const paint = () => add(clear(post), bubble(m, 'bust sm'),
            h('div', { class: 'wall-b' }, h('div', { class: 'wall-h' }, h('b', null, m.me ? 'You' : m.display), h('small', null, ago(new Date(p.at).getTime()))), h('p', null, p.body),
              h('div', { class: 'row wall-act' },
                h('button', { type: 'button', class: 'btn small like' + (cheered ? ' on' : ''), onclick: async () => { try { const c = await soc.wallCheer(p.id); cheers = c.count; cheered = c.cheered; paint(); } catch (e) { toast(errText(e)); } } }, `🔥 ${cheers}`),
                (p.mine || soc.me().owner) ? h('button', { type: 'button', class: 'btn small danger', onclick: async () => { try { await soc.wallDel(p.id); post.remove(); } catch (e) { toast(errText(e)); } } }, 'Delete') : null)));
          paint(); list.append(post);
        });
      } catch (e) { clear(list); list.append(h('p', { class: 'muted' }, errText(e))); }
    };
    add(box, h('div', { class: 'wall-form' }, input, actionBtn('Post', async () => {
      const v = input.value.trim();
      if (!v) return;
      await soc.wallPost(v); input.value = ''; await load();
    }, 'btn main')), list);
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (document.hidden || !document.body.contains(box)) return; load(); }, 30000);
    return box;
  }

  /* one person's look right now: like it, copy it onto your fan, or challenge them */
  function fitCard(m) {
    const sel = 'current';
    let note = null;
    const likes = { ...(m.likes || {}) }, liked = new Set(m.liked || []);
    const card = h('article', { class: 'fit-card', 'data-handle': m.handle });
    const paint = () => {
      const av = m.avatar;
      add(clear(card),
        h('div', { class: 'fit-stage' }, av && av.eq ? renderAvatar(av, m.team || null, 'full') : bubble(m)),
        h('b', { class: 'it-n' }, m.display, m.me ? h('small', null, ' you') : null),
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
          } }, 'Copy fit'),
          m.me ? null : h('a', { class: 'btn small', href: `#/duels/vs/${encodeURIComponent(m.handle)}` }, 'Challenge')),
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
  return () => { off(); clearInterval(timer); };
}
