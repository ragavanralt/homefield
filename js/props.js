// Pulls rosters and season stats from the feed and prices player props for one game.
import { getRoster, getAthleteStats } from './espn.js';
import { propCandidates, buildProps, propDefsFor } from './bets.js';

const cache = new Map(); // gameKey -> { t, value }

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  }));
}

/** { home: [market], away: [market], supported } */
export async function loadProps(game) {
  const hit = cache.get(game.key);
  if (hit && Date.now() - hit.t < 600000) return hit.value;
  if (!propDefsFor(game.league).length) return { home: [], away: [], supported: false };
  const out = { home: [], away: [], supported: true };
  await Promise.all(['home', 'away'].map(async (side) => {
    const team = game[side];
    const roster = await getRoster(game.league, team.id).catch(() => ({ players: [] }));
    let cands = propCandidates(game.league, roster.players, game);
    const stats = new Map();
    await pool(cands, 6, async (p) => {
      try { stats.set(p.id, await getAthleteStats(game.league, p.id)); } catch (e) { /* skip */ }
    });
    out[side] = buildProps(game.league, cands, stats, team.id);
  }));
  cache.set(game.key, { t: Date.now(), value: out });
  return out;
}
