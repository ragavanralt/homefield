// The numbers behind a profile: everything about a player that can be worked out from their bets, bank and watched games.
// Pure (no page needed), so the You page, the crew profiles and the sync all read the same thing.
import { betStats, badges } from './bets.js';

const decided = (b) => b.status === 'won' || b.status === 'lost';
const leagueOf = (b) => (b.legs && b.legs[0] && b.legs[0].league) || '';

/** Compact extras that ride along in the public stats (kept small: the server caps the whole thing). */
export function extrasOf(s) {
  const bets = Object.values(s.bets || {});
  const bank = s.bank || {};
  const st = betStats(s.bets || {}, bank);
  const done = bets.filter(decided).sort((a, b) => (a.settledTs || a.ts || 0) - (b.settledTs || b.ts || 0));
  const open = bets.filter((b) => b.status === 'pending');

  // biggest loss: the most a single bet took from you (a cash out that lost coins counts for what it cost)
  const bl = bets.filter((b) => b.status === 'lost').reduce((m, b) => Math.max(m, (b.stake || 0) - (b.payout || 0)), 0);

  // where the bets go: top leagues by number of bets, with how many hit
  const lg = new Map();
  for (const b of bets) { const l = leagueOf(b); if (!l) continue; const e = lg.get(l) || [0, 0]; if (decided(b)) { e[0]++; if (b.status === 'won') e[1]++; } lg.set(l, e); }
  const leagues = [...lg].filter(([, e]) => e[0] > 0).sort((a, b) => b[1][0] - a[1][0]).slice(0, 3).map(([l, e]) => [l, e[0], e[1]]);

  // singles against parlays
  const mix = { s: [0, 0], p: [0, 0] };
  for (const b of done) { const m = b.mode === 'parlay' ? mix.p : mix.s; m[0]++; if (b.status === 'won') m[1]++; }

  // the kind of pick made most often
  const kinds = {};
  for (const b of bets) for (const l of b.legs || []) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
  const fav = Object.entries(kinds).sort((a, b) => b[1] - a[1])[0];

  // most watched teams: your own teams first, ranked by how many of their games you marked as watched
  const mine = new Set((s.teams || []).map((t) => `${t.league}:${t.abbr}`));
  const count = new Map();
  const bump = (l, a) => { if (a) count.set(`${l}:${a}`, (count.get(`${l}:${a}`) || 0) + 1); };
  for (const w of Object.values(s.watched || {})) for (const a of [w.home, w.away]) if (mine.has(`${w.league}:${a}`)) bump(w.league, a);
  if (!count.size) for (const w of Object.values(s.watched || {})) { bump(w.league, w.home); bump(w.league, w.away); }
  const watchedTeams = [...count].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1), n]; });

  // the last few games marked as watched, small enough to ride along: [key, away, home, awayScore, homeScore, ts]
  const wl = Object.entries(s.watched || {}).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, 12).map(([k, w]) => [k, w.away || '', w.home || '', w.awayScore ?? null, w.homeScore ?? null, w.ts || 0]);
  const cashed = bets.filter((b) => b.cashed);
  const stakes = bets.map((b) => b.stake || 0);
  const firstTs = bets.reduce((m, b) => Math.min(m, b.ts || b.placedAt || Infinity), Infinity);
  return {
    pk: bank.peak || 0, bl, xp: bank.xp || 0, staked: Math.round(st.staked || 0),
    form: done.slice(-10).map((b) => (b.status === 'won' ? 'W' : 'L')).join(''),
    mix, lg: leagues, mk: fav ? fav[0] : '', wt: watchedTeams, wl,
    co: cashed.length, cn: Math.round(cashed.reduce((n, b) => n + (b.payout || 0) - (b.stake || 0), 0)),
    bd: badges(st, bank).filter((x) => x.got).map((x) => x.id),
    since: Number.isFinite(firstTs) ? firstTs : 0,
    avg: stakes.length ? Math.round(stakes.reduce((a, b) => a + b, 0) / stakes.length) : 0, mx: stakes.length ? Math.max(...stakes) : 0,
    dly: bank.dailyStreak || 0,
    open: open.length, risk: open.reduce((n, b) => n + (b.stake || 0), 0), toWin: Math.round(open.reduce((n, b) => n + (b.stake || 0) * (b.dec || 1), 0)),
  };
}
