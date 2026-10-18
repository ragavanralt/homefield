// Pulls rosters and season stats and prices player props and first scorers for one game.
// Order of tries: real sportsbook lines (if you added a key), ESPN rosters, the league's own feed (NHL, MLB),
// then the season leaders on the game page.
import { getRoster, getAthleteStats, getSummary } from './espn.js';
import { propCandidates, buildProps, propDefsFor, leaderProps, propCatsFor } from './bets.js';
import { scorerMarkets, scoreRate, hasFirst } from './specials.js';
import { nhlTeam, mlbTeam, nameKey } from './alt.js';
import { LEAGUES } from './leagues.js';
import { bookProps, bookFirst, hasOddsKey, outOfCredits, creditsText } from './odds.js';

const cache = new Map(); // key -> { t, value }
const fresh = (k, ms = 600000) => { const h = cache.get(k); return h && Date.now() - h.t < ms ? h.value : null; };
const keep = (k, value) => { cache.set(k, { t: Date.now(), value }); return value; };

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  }));
}

/** Players and season stat blocks for both teams: { home: { players, stats, source, err }, away: {...} } */
export async function loadPool(game) {
  const hit = fresh('pool:' + game.key);
  if (hit) return hit;
  const out = {};
  await Promise.all(['home', 'away'].map(async (side) => {
    const team = game[side];
    const r = { players: [], stats: new Map(), source: '', err: '' };
    try {
      const roster = await getRoster(game.league, team.id);
      const cands = propCandidates(game.league, roster.players, game);
      await pool(cands, 6, async (p) => { try { r.stats.set(p.id, await getAthleteStats(game.league, p.id)); } catch (e) { /* skip */ } });
      if (r.stats.size) { r.players = cands; r.source = 'ESPN rosters'; }
      r.all = roster.players;
    } catch (e) { r.err = e.message; }
    if (!r.players.length) {
      try {
        const grp = LEAGUES[game.league].group;
        const alt = grp === 'nhl' ? await nhlTeam(team.abbr) : grp === 'mlb' ? await mlbTeam(team.name) : null;
        if (alt && alt.players.length) { r.players = propCandidates(game.league, alt.players, game); r.stats = alt.stats; r.source = 'league feed'; r.all = alt.players; }
      } catch (e) { r.err = r.err || e.message; }
    }
    out[side] = r;
  }));
  return keep('pool:' + game.key, out);
}

/** Simulated props for every category: { home, away, notes, source } */
async function simProps(game) {
  const hit = fresh('sim:' + game.key);
  if (hit) return hit;
  const pl = await loadPool(game);
  const out = { home: [], away: [], other: [], notes: [], source: 'Simulated lines' };
  let leaders;
  await Promise.all(['home', 'away'].map(async (side) => {
    if (pl[side].players.length) out[side] = buildProps(game.league, pl[side].players, pl[side].stats, game[side].id);
    if (!out[side].length) {
      try {
        leaders ||= getSummary(game.league, game.id).then((s) => s.leaders || []);
        out[side] = leaderProps(game.league, await leaders, game[side].id, game[side].record);
        if (out[side].length) out.notes.push(`${game[side].abbr}: built from team leaders`);
      } catch (e) { out.notes.push(`${game[side].abbr}: ${e.message}`); }
    }
  }));
  if (out.home.length || out.away.length) keep('sim:' + game.key, out);
  return out;
}

/** Work out which team each player is on, and find a photo, from whatever roster we have. */
async function sortByTeam(game, markets, key = (m) => m.name) {
  const pl = await loadPool(game).catch(() => null);
  const out = { home: [], away: [], other: [] };
  const lookup = { home: new Map(), away: new Map() };
  if (pl) for (const side of ['home', 'away']) for (const p of pl[side].all || pl[side].players) lookup[side].set(nameKey(p.name), p);
  for (const m of markets) {
    const k = nameKey(key(m));
    const side = lookup.home.has(k) ? 'home' : lookup.away.has(k) ? 'away' : null;
    const p = side && lookup[side].get(k);
    (side ? out[side] : out.other).push({ ...m, teamId: side ? game[side].id : null, face: m.face || p?.face || '', pos: m.pos || p?.pos || '', playerId: m.playerId || p?.id });
  }
  return out;
}

/**
 * Props for one category chip. cat: { id, label, stats }.
 * Returns { home, away, other, source, notes }. Uses the books when there is a key and credits, else simulated lines.
 */
export async function loadPropsCat(game, cat) {
  if (!propDefsFor(game.league).length) return { home: [], away: [], other: [], source: '', notes: [], supported: false };
  const notes = [];
  if (hasOddsKey() && !outOfCredits()) {
    try {
      const b = await bookProps(game, cat.stats);
      if (b.markets.length) {
        const sorted = await sortByTeam(game, b.markets);
        const cap = (arr) => arr.slice(0, 10);
        return { ...Object.fromEntries(Object.entries(sorted).map(([k, v]) => [k, cap(v)])), source: `${b.book} prices${creditsText()}`, notes, supported: true, book: true };
      }
      notes.push('Sportsbook: no lines posted for this yet, showing simulated lines');
    } catch (e) { notes.push('Sportsbook: ' + e.message + '. Showing simulated lines.'); }
  } else if (hasOddsKey()) notes.push('Out of odds requests for now. Showing simulated lines.');
  const sim = await simProps(game);
  const keepStat = (arr) => arr.filter((m) => cat.stats.includes(m.stat));
  return { home: keepStat(sim.home), away: keepStat(sim.away), other: [], source: sim.source, notes: [...notes, ...sim.notes], supported: true };
}

/** First scorer prices. Returns { home, away, other, source, notes, supported }. */
export async function loadFirst(game) {
  if (!hasFirst(game.league)) return { home: [], away: [], other: [], source: '', notes: [], supported: false };
  const notes = [];
  if (hasOddsKey() && !outOfCredits()) {
    try {
      const b = await bookFirst(game);
      if (b.markets.length) {
        const sorted = await sortByTeam(game, b.markets.map((m) => ({ ...m, stat: 'first', playerId: null })), (m) => m.name);
        const label = { nfl: 'First touchdown scorer', nhl: 'First goal scorer', nba: 'First basket' }[LEAGUES[game.league].group];
        const fix = (arr) => arr.slice(0, 10).map((m) => ({ ...m, short: m.name, label }));
        return { home: fix(sorted.home), away: fix(sorted.away), other: fix(sorted.other), source: `${b.book} prices${creditsText()}`, notes, supported: true };
      }
      notes.push('Sportsbook: no first scorer market posted yet, showing simulated prices');
    } catch (e) { notes.push('Sportsbook: ' + e.message + '. Showing simulated prices.'); }
  }
  const pl = await loadPool(game);
  const out = { home: [], away: [], other: [], source: 'Simulated prices', notes, supported: true };
  for (const side of ['home', 'away']) {
    const rates = new Map();
    for (const p of pl[side].players) rates.set(p.id, scoreRate(game.league, pl[side].stats.get(p.id)));
    out[side] = scorerMarkets(game, side, pl[side].players, rates);
  }
  return out;
}

export { propCatsFor };
