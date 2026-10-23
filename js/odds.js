// Real sportsbook lines (DraftKings, FanDuel) from The Odds API, with your own free key.
// The key lives only on this device. Without a key (or out of credits) the app uses its own simulated lines.
// Credit saving: every call asks for only the markets on screen, answers are remembered on this device,
// and the schedule lookup is free.
import { CONFIG } from './config.js';
import { getState } from './store.js';
import { LEAGUES } from './leagues.js';
import { PROP_DEFS } from './bets.js';
import { nameKey } from './alt.js';
import { hasPapiKey, papiOut, papiLeft, papiProps, papiFirst, clearPapiCache } from './oddspapi.js';

const API = 'https://api.the-odds-api.com';
const SPORT = { nfl: 'americanfootball_nfl', nba: 'basketball_nba', nhl: 'icehockey_nhl', mlb: 'baseball_mlb' };
// book market key -> our prop key (which also carries the box score settlement rule)
export const BOOK_MARKETS = {
  nfl: { player_pass_yds: 'passyds', player_pass_tds: 'passtd', player_pass_completions: 'passcomp', player_rush_yds: 'rushyds', player_rush_attempts: 'rushatt', player_reception_yds: 'recyds', player_receptions: 'rec' },
  nba: { player_points: 'pts', player_rebounds: 'reb', player_assists: 'ast', player_threes: 'threes', player_steals: 'stl', player_blocks: 'blk', player_turnovers: 'to',
    player_points_rebounds_assists: 'pra', player_points_rebounds: 'pr', player_points_assists: 'pa', player_rebounds_assists: 'ra' },
  nhl: { player_points: 'pts', player_shots_on_goal: 'sog', player_goals: 'goals', player_assists: 'assists', player_blocked_shots: 'blk' },
  mlb: { batter_hits: 'hits', batter_home_runs: 'hr', batter_rbis: 'rbi', batter_runs_scored: 'runs', batter_strikeouts: 'bk', pitcher_strikeouts: 'pk' },
};
// the "X+" milestone ladders books post for the same stats
export const BOOK_ALT = {
  nfl: { player_pass_yds_alternate: 'passyds', player_pass_tds_alternate: 'passtd', player_pass_completions_alternate: 'passcomp', player_rush_yds_alternate: 'rushyds', player_rush_attempts_alternate: 'rushatt', player_reception_yds_alternate: 'recyds', player_receptions_alternate: 'rec' },
  nba: { player_points_alternate: 'pts', player_rebounds_alternate: 'reb', player_assists_alternate: 'ast', player_threes_alternate: 'threes', player_steals_alternate: 'stl', player_blocks_alternate: 'blk', player_turnovers_alternate: 'to',
    player_points_rebounds_assists_alternate: 'pra', player_points_rebounds_alternate: 'pr', player_points_assists_alternate: 'pa', player_rebounds_assists_alternate: 'ra' },
  nhl: { player_points_alternate: 'pts', player_shots_on_goal_alternate: 'sog', player_goals_alternate: 'goals', player_assists_alternate: 'assists', player_blocked_shots_alternate: 'blk' },
  mlb: { batter_hits_alternate: 'hits', batter_home_runs_alternate: 'hr', batter_rbis_alternate: 'rbi', batter_runs_scored_alternate: 'runs', batter_strikeouts_alternate: 'bk', pitcher_strikeouts_alternate: 'pk' },
};
const FIRST_MARKET = { nfl: 'player_1st_td', nhl: 'player_goal_scorer_first', nba: 'player_first_basket' };
const PER_MARKET = 8;

export const oddsKey = () => (getState().settings.oddsKey || '').trim();
const hasMainKey = () => !!oddsKey();
/** True if any odds source is set up (The Odds API or OddsPapi). */
export const hasOddsKey = () => hasMainKey() || hasPapiKey();
let remaining = null;
let outUntil = 0; // when a 429 comes back, stop asking for a while
let lastSource = '';
export const creditsLeft = () => (lastSource === 'papi' ? papiLeft() : remaining);
/** ' · 12 credits left' for the source that answered last. */
export const creditsText = () => { const n = creditsLeft(); return n == null ? '' : ` · ${n} ${lastSource === 'papi' ? 'requests' : 'credits'} left`; };
const mainOut = () => !hasMainKey() || Date.now() < outUntil;
export const outOfCredits = () => mainOut() && (!hasPapiKey() || papiOut());

/* small on-device cache so reloads and re-opens cost nothing */
const LS = 'homefield:odds';
const mem = new Map();
function lsGet(k) {
  try { const all = JSON.parse(localStorage.getItem(LS) || '{}'); return all[k]; } catch (e) { return undefined; }
}
function lsSet(k, v) {
  try {
    const all = JSON.parse(localStorage.getItem(LS) || '{}');
    all[k] = v;
    const keys = Object.keys(all);
    if (keys.length > 60) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 60).forEach((x) => delete all[x]);
    localStorage.setItem(LS, JSON.stringify(all));
  } catch (e) { /* storage full or blocked */ }
}
const cacheGet = (k, ttl) => { const v = mem.get(k) || lsGet(k); return v && Date.now() - v.t < ttl ? v.data : null; };
const cacheSet = (k, data) => { const v = { t: Date.now(), data }; mem.set(k, v); lsSet(k, v); };
// lines move more close to the game, so remember them for less time then
const ttlFor = (game) => { const mins = (new Date(game.date).getTime() - Date.now()) / 60000; return mins > 360 ? 3 * 3600000 : mins > 60 ? 45 * 60000 : 10 * 60000; };
export const clearOddsCache = () => { clearPapiCache(); mem.clear(); try { localStorage.removeItem(LS); } catch (e) { /* ignore */ } };

async function call(path, params = {}) {
  if (outOfCredits()) throw new Error('Out of Odds API credits for now');
  const q = new URLSearchParams({ apiKey: oddsKey(), ...params });
  const url = `${API}${path}?${q}`;
  const res = await fetch(CONFIG.proxy ? `${CONFIG.proxy}?u=${encodeURIComponent(url)}` : url);
  const left = res.headers.get('x-requests-remaining');
  if (left != null) remaining = left;
  if (res.status === 401) throw new Error('The Odds API rejected that key');
  if (res.status === 429 || res.status === 402) { outUntil = Date.now() + 30 * 60000; throw new Error('Out of Odds API credits for now'); }
  if (!res.ok) throw new Error('The Odds API answered with ' + res.status);
  return res.json();
}

/** Used by the Settings test button. */
export async function testKey() {
  const j = await call('/v4/sports/', {});
  return { sports: Array.isArray(j) ? j.length : 0, remaining };
}

async function events(sport) {
  const hit = cacheGet('ev:' + sport, 600000);
  if (hit) return hit;
  const list = await call(`/v4/sports/${sport}/events`, {}); // free
  cacheSet('ev:' + sport, list);
  return list;
}

const sameTeam = (a, b) => { const x = nameKey(a), y = nameKey(b); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };

async function findEvent(game, sport) {
  const evs = await events(sport);
  return evs.find((e) => sameTeam(e.home_team, game.home.name) && sameTeam(e.away_team, game.away.name))
    || evs.find((e) => sameTeam(e.home_team, game.home.name) || sameTeam(e.away_team, game.away.name));
}

async function eventOdds(game, sport, markets, ck) {
  const hit = cacheGet(ck, ttlFor(game));
  if (hit) return hit;
  const ev = await findEvent(game, sport);
  if (!ev) return { bookmakers: [] };
  const j = await call(`/v4/sports/${sport}/events/${ev.id}/odds`, { regions: 'us', bookmakers: 'draftkings,fanduel', markets: markets.join(','), oddsFormat: 'decimal' });
  cacheSet(ck, j);
  return j;
}

/** Over/under props for the given stat keys (for example ['passyds','passtd']). Returns { markets, book }. */
async function oddsApiProps(game, stats) {
  const grp = LEAGUES[game.league]?.group;
  const sport = SPORT[grp];
  if (!sport || !hasMainKey()) return { markets: [], book: '' };
  const map = { ...BOOK_MARKETS[grp], ...(BOOK_ALT[grp] || {}) };
  const want = Object.keys(map).filter((k) => !stats || stats.includes(map[k]));
  if (!want.length) return { markets: [], book: '' };
  const j = await eventOdds(game, sport, want, `p:${game.key}:${want.join(',')}`);
  const defs = PROP_DEFS[grp];
  const rows = new Map(), lad = new Map();
  for (const bk of ['draftkings', 'fanduel']) {
    const b = (j.bookmakers || []).find((x) => x.key === bk);
    if (!b) continue;
    for (const m of b.markets || []) {
      const key = map[m.key];
      const def = defs.find((d) => d.key === key);
      if (!def) continue;
      if (/_alternate$/.test(m.key)) { // milestone ladder: Over 24.5 is "25+"
        for (const o of m.outcomes || []) {
          if (!/^over$/i.test(o.name) || !o.description || o.point == null || !(o.price > 1)) continue;
          const lk = key + '|' + nameKey(o.description);
          const rungs = lad.get(lk) || new Map();
          const t = Math.ceil(o.point);
          if (!rungs.has(t)) rungs.set(t, o.price); // first book wins
          lad.set(lk, rungs);
        }
        continue;
      }
      const by = new Map();
      for (const o of m.outcomes || []) {
        const who = o.description || '';
        if (!who || o.point == null) continue;
        const id = who + '|' + o.point;
        const e = by.get(id) || { who, point: o.point };
        if (/^over$/i.test(o.name)) e.over = o.price; else if (/^under$/i.test(o.name)) e.under = o.price;
        by.set(id, e);
      }
      for (const e of by.values()) {
        if (!(e.over > 1 && e.under > 1)) continue;
        const rk = key + '|' + nameKey(e.who);
        if (rows.has(rk)) continue; // first book wins (DraftKings before FanDuel)
        rows.set(rk, { teamId: null, playerId: 'bk:' + nameKey(e.who), name: e.who, short: e.who, pos: '', face: '', stat: key, label: def.label, line: e.point, over: e.over, under: e.under, box: def.box, book: b.title || bk, avg: e.point });
      }
    }
  }
  for (const m of rows.values()) { // attach each player's ladder, cheapest rung first
    const rungs = lad.get(m.stat + '|' + nameKey(m.name));
    if (rungs) m.ladder = [...rungs].map(([t, dec]) => ({ t, dec })).filter((x) => x.dec >= 1.05).sort((a, b) => a.t - b.t).slice(0, 8);
  }
  const byStat = new Map();
  for (const m of rows.values()) { if (!byStat.has(m.stat)) byStat.set(m.stat, []); byStat.get(m.stat).push(m); }
  const out = [];
  for (const list of byStat.values()) out.push(...list.sort((a, b) => b.line - a.line).slice(0, PER_MARKET * 2));
  return { markets: out, book: [...new Set(out.map((m) => m.book))].join(' and ') };
}

/** Totals, spreads and team totals with every alternate line the books post. Returns { totals, spreads, teamTotals, book } or null. */
export async function bookGame(game) {
  const grp = LEAGUES[game.league]?.group;
  const sport = SPORT[grp];
  if (!sport || !hasMainKey() || mainOut()) return null;
  const markets = ['spreads', 'totals', 'alternate_spreads', 'alternate_totals', 'team_totals', 'alternate_team_totals'];
  const j = await eventOdds(game, sport, markets, `g:${game.key}`);
  const tot = new Map(), spr = new Map(), tt = { home: new Map(), away: new Map() }, books = new Set();
  const put = (map, line, field, price) => { const r = map.get(line) || { line }; if (!(r[field] > 1)) r[field] = price; map.set(line, r); };
  for (const bk of ['draftkings', 'fanduel']) {
    const b = (j.bookmakers || []).find((x) => x.key === bk);
    if (!b) continue;
    for (const m of b.markets || []) {
      for (const o of m.outcomes || []) {
        if (o.point == null || !(o.price > 1)) continue;
        const over = /^over$/i.test(o.name), under = /^under$/i.test(o.name);
        if (m.key === 'totals' || m.key === 'alternate_totals') { if (over || under) { put(tot, o.point, over ? 'over' : 'under', o.price); books.add(b.title || bk); } }
        else if (m.key === 'spreads' || m.key === 'alternate_spreads') {
          if (sameTeam(o.name, game.home.name)) { put(spr, o.point, 'home', o.price); books.add(b.title || bk); }
          else if (sameTeam(o.name, game.away.name)) { put(spr, -o.point, 'away', o.price); books.add(b.title || bk); }
        } else if ((m.key === 'team_totals' || m.key === 'alternate_team_totals') && (over || under)) {
          const side = sameTeam(o.description, game.home.name) ? 'home' : sameTeam(o.description, game.away.name) ? 'away' : null;
          if (side) { put(tt[side], o.point, over ? 'over' : 'under', o.price); books.add(b.title || bk); }
        }
      }
    }
  }
  const list = (map) => [...map.values()].sort((a, b) => a.line - b.line);
  const out = { totals: list(tot), spreads: list(spr), teamTotals: { home: list(tt.home), away: list(tt.away) }, book: [...books].join(' and ') };
  return out.totals.length || out.spreads.length || out.teamTotals.home.length || out.teamTotals.away.length ? out : null;
}

/** First scorer prices. Returns { markets: [{ name, dec }], book }. */
async function oddsApiFirst(game) {
  const grp = LEAGUES[game.league]?.group;
  const sport = SPORT[grp], market = FIRST_MARKET[grp];
  if (!sport || !market || !hasMainKey()) return { markets: [], book: '' };
  const j = await eventOdds(game, sport, [market], `f:${game.key}`);
  const out = new Map();
  for (const bk of ['draftkings', 'fanduel']) {
    const b = (j.bookmakers || []).find((x) => x.key === bk);
    const m = b && (b.markets || []).find((x) => x.key === market);
    if (!m) continue;
    for (const o of m.outcomes || []) {
      const who = o.description || o.name;
      if (!who || !(o.price > 1) || /^(over|under|yes|no)$/i.test(who)) continue;
      const k = nameKey(who);
      if (!out.has(k)) out.set(k, { name: who, dec: o.price, book: b.title || bk });
    }
  }
  const list = [...out.values()].sort((a, b) => a.dec - b.dec);
  return { markets: list, book: [...new Set(list.map((x) => x.book))].join(' and ') };
}

/** Tries the sources in order: The Odds API first, or OddsPapi first if that switch is on. A source is skipped if it has no key
 *  or is out of requests, and the next one is tried if it errors or has nothing. */
async function viaSources(mainFn, papiFn) {
  const main = { id: 'main', ok: () => hasMainKey() && !mainOut(), run: mainFn };
  const papi = { id: 'papi', ok: () => hasPapiKey() && !papiOut(), run: papiFn };
  const order = getState().settings.papiFirst ? [papi, main] : [main, papi];
  const usable = order.filter((x) => x.ok());
  let err = null;
  for (let n = 0; n < usable.length; n++) {
    const x = usable[n];
    try { const r = await x.run(); lastSource = x.id; if (r.markets.length || n === usable.length - 1) return r; } catch (e) { err = e; }
  }
  if (err) throw err;
  return { markets: [], book: '' };
}

/** Over/under props. */
export const bookProps = (game, stats) => viaSources(() => oddsApiProps(game, stats), () => papiProps(game, stats));

/** First scorer prices. */
export const bookFirst = (game) => viaSources(() => oddsApiFirst(game), () => papiFirst(game));
