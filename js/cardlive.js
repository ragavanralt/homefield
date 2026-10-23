// What a card (Daily Five, duels) is doing right now, and what it ended up as.
import { getSummary } from './espn.js';
import { h, clear, toast } from './ui.js';
import * as soc from './social.js';

import { playerNow } from './boxread.js';
export { playerNow };

/** Live read on one card: { state, detail, now, score }. now is the number the line is measured against. */
export async function cardLive(c) {
  const s = await getSummary(c.league, c.game_id, 20000);
  const g = s && s.game;
  if (!g) return null;
  const out = { state: g.state, detail: g.state === 'in' ? (g.shortDetail || g.detail || 'Live') : g.state === 'post' ? 'Final' : '', home: g.home, away: g.away, now: null };
  const hs = g.home.score ?? 0, as = g.away.score ?? 0;
  out.score = `${g.away.abbr} ${as} – ${g.home.abbr} ${hs}`;
  if (c.kind === 'total') out.now = hs + as;
  else if (c.kind === 'team_total') out.now = (c.meta && c.meta.team) === g.home.abbr ? hs : as;
  else if (c.kind === 'player') out.now = playerNow(s.box, c.meta);
  else if (c.kind === 'winner' || c.kind === 'spread' || c.kind === 'score') out.now = hs - as; // home margin
  return out;
}

const fix = (n) => (Math.abs(n % 1) < 1e-9 ? String(Math.round(n)) : n.toFixed(1));
const unit = (c) => ((c.meta && c.meta.label) || (c.kind === 'player' ? '' : /goals/.test(c.title) ? 'goals' : /runs/.test(c.title) ? 'runs' : /points/.test(c.title) ? 'pts' : ''));

/** One plain sentence about how a finished card ended. Uses the stored actual, so it works with no live feed. */
export function finalText(c) {
  if (c.actual == null) return c.outcome === 'push' ? 'Push' : 'No result';
  const a = Number(c.actual);
  if (c.kind === 'winner') return a === 0 ? 'Ended level' : `${a > 0 ? c.a : c.b} won by ${fix(Math.abs(a))}`;
  const u = unit(c);
  const who = c.kind === 'player' && c.meta && c.meta.name ? `${c.meta.name}: ` : '';
  const margin = c.line != null ? a - Number(c.line) : null;
  return `${who}${fix(a)}${u ? ' ' + u : ''}${margin == null ? '' : ` · line ${fix(Number(c.line))} (${margin > 0 ? 'over by ' : margin < 0 ? 'under by ' : 'on the line'}${margin === 0 ? '' : fix(Math.abs(margin))})`}`;
}

/** How far an in-progress number is toward the line: { pct, text, lead, over }. */
export function progress(c, live) {
  if (!live || live.state === 'pre') return null;
  if (c.kind === 'winner') {
    const m = live.now || 0;
    return { pct: null, text: `${live.score}${live.detail ? ` · ${live.detail}` : ''}`, lead: m === 0 ? 'Level' : `${m > 0 ? c.a : c.b} ahead by ${fix(Math.abs(m))}`, side: m === 0 ? null : m > 0 ? 'a' : 'b' };
  }
  if (c.kind === 'spread') { // c.a is the side you took, line is its handicap
    const cover = (c.home ? live.now || 0 : -(live.now || 0)) + Number(c.line);
    return { pct: null, text: `${live.score}${live.detail ? ` · ${live.detail}` : ''}`, lead: cover === 0 ? 'On the number' : cover > 0 ? `${c.a} covering by ${fix(cover)}` : `${c.a} needs ${fix(-cover)} more`, side: cover > 0 ? 'a' : 'b' };
  }
  if (c.kind === 'score') return { pct: null, text: live.score, lead: live.detail || '', side: null };
  const now = live.now == null ? 0 : live.now, line = Number(c.line) || 0;
  const over = now > line;
  const need = Math.floor(line - now) + 1; // the over needs this many more
  const u = unit(c);
  return { pct: line > 0 ? Math.min(100, Math.round((now / line) * 100)) : 0, over, side: over ? 'a' : 'b',
    text: `${fix(now)} of ${fix(line)}${u ? ' ' + u : ''}${live.detail ? ` · ${live.detail}` : ''}`,
    lead: over ? `Over is in, ${fix(now - line)} past the line` : `${need} more for the over` };
}

/** Is the side you took ahead right now? true / false / null (no pick, or nothing to judge yet). */
export function looking(c, p) { return p && p.side && c.mine ? p.side === c.mine : null; }

/** The extra line under a card: how it ended, or a live bar while the game is on. Returns null before lock. */
export function liveLine(c) {
  const done = c.status === 'final' || c.outcome === 'a' || c.outcome === 'b' || c.outcome === 'push' || c.result;
  if (done) return c.status === 'void' ? null : h('div', { class: 'lv-final' }, finalText(c));
  if (!c.locked || c.status === 'void') return null;
  const box = h('div', { class: 'lv', 'aria-live': 'polite' }, h('small', { class: 'muted' }, 'Checking the game…'));
  let stop = false, shown = false;
  const born = Date.now();
  const tick = async () => {
    if (stop) return;
    // The box is built before the page puts it on screen, so wait for it. Once it has been shown and is gone, stop.
    if (!box.isConnected) { if (!shown && Date.now() - born < 10000) setTimeout(tick, 300); else stop = true; return; }
    shown = true;
    try {
      const live = await cardLive(c), p = progress(c, live);
      clear(box);
      if (!p) { box.append(h('small', { class: 'muted' }, 'Not started yet')); }
      else {
        const good = looking(c, p);
        box.append(h('div', { class: 'lv-row' }, h('span', null, p.text), h('b', { class: good == null ? '' : good ? 'ok' : 'no' }, p.lead)));
        if (p.pct != null) box.append(h('div', { class: 'lv-bar' + (good == null ? '' : good ? ' ok' : ' no'), role: 'progressbar', 'aria-valuenow': String(p.pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: { width: `${p.pct}%` } })));
        if (live && live.state === 'post') {
          stop = true;
          box.append(h('small', { class: 'muted' }, 'Final. Result lands shortly.'));
          if (c.bet) import('./settle.js').then((m) => m.settleAll()).catch(() => {}); // settle now instead of on the next app open
        }
      }
    } catch (e) { clear(box); box.append(h('small', { class: 'muted' }, 'Live feed unavailable right now')); }
    if (!stop) setTimeout(tick, 30000);
  };
  setTimeout(tick, 0);
  return box;
}

/** After games end: a short notice with how your Daily Five picks went. Runs on open and when you come back to the app. */
const SEEN = 'homefield:dailyseen';
export async function announceDaily() {
  if (!soc.enabled() || !soc.signedIn()) return;
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch (e) { /* none yet */ }
  const f = await soc.daily().catch(() => null);
  if (!f) return;
  const fresh = [...(f.cards || []), ...(f.prev || [])].filter((c) => c.mine && (c.result === 'win' || c.result === 'loss') && !seen.includes(c.id));
  if (!fresh.length) return;
  const right = fresh.filter((c) => c.result === 'win').length;
  const first = fresh[0];
  toast(`Daily Five: ${right} right, ${fresh.length - right} wrong. ${fresh.length === 1 ? finalText(first) : 'Open Duels for the breakdown.'}`);
  try { localStorage.setItem(SEEN, JSON.stringify([...seen, ...fresh.map((c) => c.id)].slice(-60))); } catch (e) { /* fine */ }
}

/** a bet leg as the kind of card the live bar understands */
export function legCard(l) {
  const base = { id: l.key, league: l.league, game_id: l.gameId, locked: new Date(l.date).getTime() <= Date.now(), status: 'open', bet: true };
  if (l.kind === 'ml') {
    if (l.side === 'draw') return null;
    return { ...base, kind: 'winner', a: l.home.abbr, b: l.away.abbr, mine: l.side === 'home' ? 'a' : 'b' };
  }
  if (l.kind === 'prop' && l.prop) return { ...base, kind: 'player', line: l.prop.line, a: 'Over', b: 'Under', mine: l.prop.dir === 'over' ? 'a' : 'b', meta: { playerId: l.prop.playerId, name: l.prop.name, label: l.prop.label, box: l.prop.box } };
  if (l.kind === 'special' && l.sp) {
    const sp = l.sp;
    if (sp.t === 'total') return { ...base, kind: 'total', line: sp.line, a: 'Over', b: 'Under', mine: sp.dir === 'over' ? 'a' : 'b', meta: { label: /goals/i.test(l.label) ? 'goals' : '' } };
    if (sp.t === 'spread') { const side = sp.side === 'home' ? l.home : l.away; return { ...base, kind: 'spread', line: sp.line, home: sp.side === 'home', a: side.abbr, b: 'Other side', mine: 'a' }; }
    return { ...base, kind: 'score' }; // first scorer, overtime and the rest: show the live score
  }
  return null;
}
