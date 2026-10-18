// Real sportsbook player prop lines (DraftKings, FanDuel) from The Odds API, with your own free key.
// The key lives only on this device. Without a key the app uses its own simulated lines.
import { CONFIG } from './config.js';
import { getState } from './store.js';
import { LEAGUES } from './leagues.js';
import { PROP_DEFS } from './bets.js';
import { nameKey } from './alt.js';

const API = 'https://api.the-odds-api.com';
const SPORT = { nfl: 'americanfootball_nfl', nba: 'basketball_nba', nhl: 'icehockey_nhl', mlb: 'baseball_mlb' };
// book market key -> our prop key (which also carries the box score settlement rule)
export const BOOK_MARKETS = {
  nfl: { player_pass_yds: 'passyds', player_pass_tds: 'passtd', player_rush_yds: 'rushyds', player_reception_yds: 'recyds', player_receptions: 'rec' },
  nba: { player_points: 'pts', player_rebounds: 'reb', player_assists: 'ast' },
  nhl: { player_points: 'pts', player_shots_on_goal: 'sog' },
  mlb: { batter_hits: 'hits', batter_home_runs: 'hr' },
};
const PER_MARKET = { nfl: 6, nba: 6, nhl: 6, mlb: 6 };

export const oddsKey = () => (getState().settings.oddsKey || '').trim();
export const hasOddsKey = () => !!oddsKey();
let remaining = null;
export const creditsLeft = () => remaining;

async function call(path, params = {}) {
  const q = new URLSearchParams({ apiKey: oddsKey(), ...params });
  const url = `${API}${path}?${q}`;
  const res = await fetch(CONFIG.proxy ? `${CONFIG.proxy}?u=${encodeURIComponent(url)}` : url);
  const left = res.headers.get('x-requests-remaining');
  if (left != null) remaining = left;
  if (res.status === 401) throw new Error('The Odds API rejected that key');
  if (res.status === 429) throw new Error('Out of Odds API credits for now');
  if (!res.ok) throw new Error('The Odds API answered with ' + res.status);
  return res.json();
}

/** Used by the Settings test button. */
export async function testKey() {
  const j = await call('/v4/sports/', {});
  return { sports: Array.isArray(j) ? j.length : 0, remaining };
}

const evCache = new Map(); // sport -> { t, list }
async function events(sport) {
  const hit = evCache.get(sport);
  if (hit && Date.now() - hit.t < 600000) return hit.list;
  const list = await call(`/v4/sports/${sport}/events`, {});
  evCache.set(sport, { t: Date.now(), list });
  return list;
}

const sameTeam = (a, b) => { const x = nameKey(a), y = nameKey(b); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };

/** Props for one game from the books. Returns { markets: [market], book }. markets have no teamId yet. */
export async function bookProps(game) {
  const grp = LEAGUES[game.league]?.group;
  const sport = SPORT[grp];
  if (!sport || !hasOddsKey()) return { markets: [], book: '' };
  const evs = await events(sport);
  const ev = evs.find((e) => sameTeam(e.home_team, game.home.name) && sameTeam(e.away_team, game.away.name))
    || evs.find((e) => sameTeam(e.home_team, game.home.name) || sameTeam(e.away_team, game.away.name));
  if (!ev) return { markets: [], book: '' };
  const map = BOOK_MARKETS[grp];
  const j = await call(`/v4/sports/${sport}/events/${ev.id}/odds`, { regions: 'us', bookmakers: 'draftkings,fanduel', markets: Object.keys(map).join(','), oddsFormat: 'decimal' });
  const defs = PROP_DEFS[grp];
  const rows = new Map(); // market|player -> market
  for (const bk of ['draftkings', 'fanduel']) {
    const b = (j.bookmakers || []).find((x) => x.key === bk);
    if (!b) continue;
    for (const m of b.markets || []) {
      const key = map[m.key];
      const def = defs.find((d) => d.key === key);
      if (!def) continue;
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
  // keep the busiest few per market
  const byStat = new Map();
  for (const m of rows.values()) { if (!byStat.has(m.stat)) byStat.set(m.stat, []); byStat.get(m.stat).push(m); }
  const out = [];
  for (const list of byStat.values()) out.push(...list.sort((a, b) => b.line - a.line).slice(0, PER_MARKET[grp] || 6));
  return { markets: out, book: [...new Set(out.map((m) => m.book))].join(' and ') };
}
