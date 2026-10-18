// Solo Pick'em: scoring, settling and stats. Pure functions; storage lives in store.js.
import { hasDraw } from './leagues.js';
import { preGameProbs } from './winprob.js';
import { clamp, ymd } from './util.js';

export const MODES = {
  classic: {
    label: 'Classic',
    blurb: 'Pick any games you like. Every correct pick scores points, and underdogs pay more.',
  },
  streak: {
    label: 'Streak Run',
    blurb: 'One pick a day. Keep it alive as long as you can. One miss and the streak resets.',
  },
  slate: {
    label: 'Perfect Slate',
    blurb: 'Pick every game in one league on one day. Go perfect for a 25 point bonus.',
  },
};

export const SLATE_BONUS = 25;
export const pointsFor = (p) => clamp(Math.round(20 * (1 - p)), 4, 30);

/** What each side would pay if it wins. */
export function offer(game) {
  const pr = preGameProbs(game);
  const o = {
    home: { p: pr.home, pts: pointsFor(pr.home) },
    away: { p: pr.away, pts: pointsFor(pr.away) },
    draw: hasDraw(game.league) ? { p: pr.draw, pts: pointsFor(pr.draw) } : null,
    source: pr.source,
  };
  return o;
}

export const dayKey = (game) => ymd(new Date(game.date));
export const slateKey = (game) => `${game.league}:${dayKey(game)}`;

export function makePick(game, side, mode) {
  const o = offer(game);
  return {
    key: game.key, league: game.league, gameId: game.id, mode, side,
    date: game.date, dayKey: dayKey(game), slate: slateKey(game),
    pHome: o.home.p, pAway: o.away.p, pDraw: o.draw ? o.draw.p : 0,
    pPicked: o[side].p, pts: o[side].pts,
    home: { abbr: game.home.abbr, name: game.home.short || game.home.name, logo: game.home.logo },
    away: { abbr: game.away.abbr, name: game.away.short || game.away.name, logo: game.away.logo },
    status: 'pending', points: 0, madeAt: Date.now(),
  };
}

export function resultSide(game) {
  if (!game || game.state !== 'post' || game.void) return null;
  const h = game.home.score ?? 0, a = game.away.score ?? 0;
  return h > a ? 'home' : h < a ? 'away' : 'draw';
}

export function settlePick(pick, game) {
  if (!game || pick.status !== 'pending') return pick;
  if (game.void) return { ...pick, status: 'void', points: 0, settledAt: Date.now() };
  const side = resultSide(game);
  if (!side) return pick;
  const won = side === pick.side;
  return { ...pick, status: won ? 'won' : 'lost', points: won ? pick.pts : 0, result: side, finalHome: game.home.score, finalAway: game.away.score, settledAt: Date.now() };
}

function favoriteSide(p) {
  const m = { home: p.pHome, away: p.pAway, draw: p.pDraw || 0 };
  return Object.keys(m).sort((a, b) => m[b] - m[a])[0];
}

export function computeStats(picks) {
  const list = Object.values(picks || {}).sort((a, b) => new Date(a.date) - new Date(b.date));
  const settled = list.filter((p) => p.status === 'won' || p.status === 'lost');
  const won = settled.filter((p) => p.status === 'won');

  // Streaks, counted in game-date order.
  const streakOf = (arr) => {
    let cur = 0, bestRun = 0;
    for (const p of arr) { if (p.status === 'won') { cur++; bestRun = Math.max(bestRun, cur); } else cur = 0; }
    return { cur, best: bestRun };
  };
  const overall = streakOf(settled);
  const streakMode = streakOf(settled.filter((p) => p.mode === 'streak'));

  // Slates: every pick in the slate must be settled, and all must be right.
  const slates = {};
  for (const p of list) if (p.mode === 'slate') (slates[p.slate] = slates[p.slate] || []).push(p);
  let perfectSlates = 0, slatesPlayed = 0;
  for (const arr of Object.values(slates)) {
    if (arr.every((p) => p.status !== 'pending')) {
      const real = arr.filter((p) => p.status !== 'void');
      if (real.length) { slatesPlayed++; if (real.length >= 3 && real.every((p) => p.status === 'won')) perfectSlates++; }
    }
  }

  const base = won.reduce((s, p) => s + (p.points || 0), 0);
  const points = base + perfectSlates * SLATE_BONUS;

  // How "always pick the favourite" would have done on the same games.
  const favWins = settled.filter((p) => p.result && favoriteSide(p) === p.result).length;

  const byLeague = {};
  for (const p of settled) {
    const b = (byLeague[p.league] = byLeague[p.league] || { won: 0, total: 0 });
    b.total++; if (p.status === 'won') b.won++;
  }

  let run = 0;
  const timeline = settled.map((p) => { run += p.points || 0; return { date: p.date, pts: run }; });

  const boldest = won.length ? won.reduce((a, b) => (b.pts > a.pts ? b : a)) : null;
  const lost = settled.filter((p) => p.status === 'lost');
  const worst = lost.length ? lost.reduce((a, b) => (b.pPicked > a.pPicked ? b : a)) : null;

  return {
    total: list.length,
    pending: list.filter((p) => p.status === 'pending').length,
    settled: settled.length,
    won: won.length,
    lost: lost.length,
    accuracy: settled.length ? won.length / settled.length : null,
    points, perfectSlates, slatesPlayed,
    streak: overall, streakMode,
    favorites: { wins: favWins, total: settled.length },
    byLeague, timeline, boldest, worst,
  };
}
