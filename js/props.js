// Pulls rosters and season stats and prices player props for one game.
// Tries ESPN first, then the league's own feed (NHL, MLB), then the season leaders on the game page.
import { getRoster, getAthleteStats, getSummary } from './espn.js';
import { propCandidates, buildProps, propDefsFor, leaderProps } from './bets.js';
import { nhlTeam, mlbTeam } from './alt.js';
import { LEAGUES } from './leagues.js';

const cache = new Map(); // gameKey -> { t, value }

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  }));
}

async function fromEspn(game, side) {
  const team = game[side];
  const roster = await getRoster(game.league, team.id);
  const cands = propCandidates(game.league, roster.players, game);
  const stats = new Map();
  await pool(cands, 6, async (p) => { try { stats.set(p.id, await getAthleteStats(game.league, p.id)); } catch (e) { /* skip */ } });
  return buildProps(game.league, cands, stats, team.id);
}

async function fromLeague(game, side) {
  const grp = LEAGUES[game.league].group;
  const team = game[side];
  if (grp === 'nhl') {
    const { players, stats } = await nhlTeam(team.abbr);
    return buildProps(game.league, propCandidates(game.league, players, game), stats, team.id);
  }
  if (grp === 'mlb') {
    const { players, stats } = await mlbTeam(team.name);
    return buildProps(game.league, propCandidates(game.league, players, game), stats, team.id);
  }
  return [];
}

/** { home: [market], away: [market], supported, sources: {home, away}, notes: [text] } */
export async function loadProps(game) {
  const hit = cache.get(game.key);
  if (hit && Date.now() - hit.t < 600000) return hit.value;
  if (!propDefsFor(game.league).length) return { home: [], away: [], supported: false, sources: {}, notes: [] };
  const out = { home: [], away: [], supported: true, sources: {}, notes: [] };
  let leaders; // loaded once, only if needed
  await Promise.all(['home', 'away'].map(async (side) => {
    const tries = [
      ['ESPN rosters', () => fromEspn(game, side)],
      ['league feed', () => fromLeague(game, side)],
      ['team leaders', async () => {
        leaders ||= getSummary(game.league, game.id).then((s) => s.leaders || []);
        return leaderProps(game.league, await leaders, game[side].id, game[side].record);
      }],
    ];
    for (const [label, fn] of tries) {
      try {
        const list = await fn();
        if (list.length) { out[side] = list; out.sources[side] = label; return; }
        out.notes.push(`${game[side].abbr} ${label}: nothing usable`);
      } catch (e) { out.notes.push(`${game[side].abbr} ${label}: ${e.message}`); }
    }
  }));
  // only keep a result in the cache if it has something in it, so a bad moment does not stick
  if (out.home.length || out.away.length) cache.set(game.key, { t: Date.now(), value: out });
  return out;
}
