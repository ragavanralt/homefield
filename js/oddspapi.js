// A second source for sportsbook player props and first-scorer prices: OddsPapi (free key, 250 requests a month).
// Used when there is no Odds API key, or that one runs out. Same idea as odds.js: the key stays on this device,
// answers are remembered, and every call is counted, so each lookup is kept to as few calls as possible.
import { CONFIG } from './config.js';
import { getState } from './store.js';
import { LEAGUES } from './leagues.js';
import { PROP_DEFS } from './bets.js';
import { nameKey } from './alt.js';

const API = 'https://api.oddspapi.io/v4';
const BOOKS = 'draftkings,fanduel';
const NAMES = { draftkings: 'DraftKings', fanduel: 'FanDuel' };
const SPORT_NAME = { nfl: /american football/i, nba: /^basketball$/i, nhl: /ice hockey|^hockey$/i, mlb: /^baseball$/i };
const KNOWN_SPORT_ID = { nba: 11 };
const PER_MARKET = 8;

export const papiKey = () => (getState().settings.papiKey || '').trim();
export const hasPapiKey = () => !!papiKey();
let outUntil = 0, used = null, limit = null;
export const papiOut = () => Date.now() < outUntil;
export const papiLeft = () => (used != null && limit != null ? Math.max(0, limit - used) : null);

/* small on-device cache */
const LS = 'homefield:papi';
const mem = new Map();
const lsAll = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } };
function cacheGet(k, ttl) {
  const v = mem.get(k) || lsAll()[k];
  return v && Date.now() - v.t < ttl ? v.data : null;
}
function cacheSet(k, data) {
  const v = { t: Date.now(), data };
  mem.set(k, v);
  try {
    const all = lsAll(); all[k] = v;
    const keys = Object.keys(all);
    if (keys.length > 40) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 40).forEach((x) => delete all[x]);
    localStorage.setItem(LS, JSON.stringify(all));
  } catch (e) { /* too big or blocked: memory still works */ }
}
export const clearPapiCache = () => { mem.clear(); try { localStorage.removeItem(LS); } catch (e) { /* ignore */ } };
const ttlFor = (game) => { const mins = (new Date(game.date).getTime() - Date.now()) / 60000; return mins > 360 ? 3 * 3600000 : mins > 60 ? 45 * 60000 : 10 * 60000; };

async function call(path, params = {}) {
  if (papiOut()) throw new Error('Out of OddsPapi requests for now');
  const q = new URLSearchParams({ ...params, apiKey: papiKey() });
  const url = `${API}${path}?${q}`;
  let res;
  try { res = await fetch(CONFIG.proxy ? `${CONFIG.proxy}?u=${encodeURIComponent(url)}` : url); } catch (e) { throw new Error('The browser could not reach OddsPapi (it may block web pages from calling it)'); }
  if (res.status === 401 || res.status === 403) throw new Error('OddsPapi rejected that key');
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    if (JSON.stringify(body).includes('REQUEST_LIMIT')) outUntil = Date.now() + 30 * 60000; // out for the month; the cooldown 429 clears itself
    throw new Error(outUntil > Date.now() ? 'Out of OddsPapi requests for now' : 'OddsPapi asked us to slow down');
  }
  if (!res.ok) throw new Error('OddsPapi answered with ' + res.status);
  if (path !== '/account') used = used == null ? null : used + 1;
  return res.json();
}

/** Used by the Settings test button. The account call is free. */
export async function testPapi() {
  const out = { steps: [] };
  const acc = await call('/account');
  limit = acc.request_limit ?? acc.requestLimit ?? null; used = acc.request_count ?? acc.requestCount ?? null;
  out.steps.push(`Key works${limit != null ? `: ${used ?? '?'} of ${limit} requests used this month` : ''}.`);
  const sports = await call('/sports');
  const list = Array.isArray(sports) ? sports : [];
  const found = ['nba', 'nfl', 'nhl', 'mlb'].map((g) => `${g.toUpperCase()} ${sportIdIn(list, g) ?? 'not found'}`);
  cacheSet('sports', list);
  out.steps.push(`Sports found: ${found.join(', ')}.`);
  return out;
}

const sportIdIn = (list, grp) => {
  const hit = list.find((s) => SPORT_NAME[grp].test(String(s.sportName ?? s.name ?? s.sportSlug ?? s.slug ?? '')));
  return hit ? (hit.sportId ?? hit.id) : (KNOWN_SPORT_ID[grp] ?? null);
};
async function sportId(grp) {
  let list = cacheGet('sports', 7 * 86400000);
  if (!list) { const j = await call('/sports'); list = Array.isArray(j) ? j : []; cacheSet('sports', list); }
  return sportIdIn(list, grp);
}

const sameName = (a, b) => { const x = nameKey(a), y = nameKey(b); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };
async function findFixture(game, grp) {
  const sid = await sportId(grp);
  if (sid == null) return null;
  let list = cacheGet('fx:' + sid, 3 * 3600000);
  if (!list) {
    const from = new Date(Date.now() - 6 * 3600000).toISOString(), to = new Date(Date.now() + 40 * 3600000).toISOString();
    const j = await call('/fixtures', { sportId: sid, from, to, hasOdds: true });
    list = (Array.isArray(j) ? j : []).map((f) => ({ id: f.fixtureId, a: f.participant1Name, b: f.participant2Name }));
    cacheSet('fx:' + sid, list);
  }
  const H = game.home.name, A = game.away.name;
  return list.find((f) => (sameName(f.a, H) && sameName(f.b, A)) || (sameName(f.a, A) && sameName(f.b, H)))
    || list.find((f) => [f.a, f.b].some((n) => sameName(n, H)) && [f.a, f.b].some((n) => sameName(n, A))) || null;
}

/** Player-prop markets for a sport: id -> { name, line, outcomes: { id: name } }. */
async function catalog(grp) {
  const sid = await sportId(grp);
  let list = cacheGet('mk:' + sid, 24 * 3600000);
  if (!list) {
    const j = await call('/markets', { sportId: sid });
    list = (Array.isArray(j) ? j : []).filter((m) => m.playerProp !== false && /player|first|anytime|scorer|basket|goal|touchdown/i.test(m.marketName || '')).map((m) => ({
      id: m.marketId, name: m.marketName || '', line: m.handicap, outcomes: Object.fromEntries((m.outcomes || []).map((o) => [o.outcomeId, o.outcomeName])),
    }));
    cacheSet('mk:' + sid, list);
  }
  return new Map(list.map((m) => [String(m.id), m]));
}

async function fixtureOdds(game, grp, fx) {
  const ck = 'od:' + fx.id;
  const hit = cacheGet(ck, ttlFor(game));
  if (hit) return hit;
  const j = await call('/odds', { fixtureId: fx.id, bookmakers: BOOKS, oddsFormat: 'decimal' });
  cacheSet(ck, j);
  return j;
}

/* which of our stats a market name is about */
const BLOCK = /(\+|combo|pra\b|alt\b|alternate|first|1st|2nd|3rd|quarter|half|period|double|triple|team total|anytime)/i;
export function statOf(grp, name) {
  const n = String(name || '').toLowerCase();
  if (BLOCK.test(n)) return null;
  if (grp === 'nba') { const hits = ['points', 'rebounds', 'assists'].filter((w) => n.includes(w)); return hits.length === 1 ? { points: 'pts', rebounds: 'reb', assists: 'ast' }[hits[0]] : null; }
  if (grp === 'nhl') { if (/shots? on goal|\bsog\b/.test(n)) return 'sog'; return /\bpoints?\b/.test(n) && !/shots?/.test(n) ? 'pts' : null; }
  if (grp === 'nfl') {
    if (/pass(ing)?\s+(yards?|yds)/.test(n)) return 'passyds';
    if (/pass(ing)?\s+(tds?|touchdowns?)/.test(n)) return 'passtd';
    if (/rush(ing)?\s+(yards?|yds)/.test(n)) return 'rushyds';
    if (/rec(eiving)?\s+(yards?|yds)/.test(n)) return 'recyds';
    if (/receptions?/.test(n)) return 'rec';
    return null;
  }
  if (grp === 'mlb') { if (/home runs?/.test(n)) return 'hr'; return /\bhits?\b/.test(n) && !/(allowed|pitcher)/.test(n) ? 'hits' : null; }
  return null;
}
const FIRST_RX = { nfl: /first (touchdown|td)/i, nhl: /first goal/i, nba: /first basket/i };
const tidy = (n) => { const s = String(n || ''); return s.includes(',') ? s.split(',').map((x) => x.trim()).reverse().join(' ') : s; };

/** Walk the odds answer: yields { slug, market, outcomeName, player, price }. */
function* walk(odds, cat) {
  for (const [slug, b] of Object.entries(odds.bookmakerOdds || {})) {
    for (const [mid, m] of Object.entries(b.markets || {})) {
      const market = cat.get(String(mid));
      if (!market) continue;
      for (const [oid, o] of Object.entries(m.outcomes || {})) {
        for (const pl of Object.values(o.players || {})) {
          if (!pl || !pl.playerName || pl.active === false || !(pl.price > 1)) continue;
          yield { slug, market, outcomeName: market.outcomes[oid] || '', player: tidy(pl.playerName), price: pl.price };
        }
      }
    }
  }
}
const bookRank = (s) => (s === 'draftkings' ? 0 : s === 'fanduel' ? 1 : 2);

/** Same shape as bookProps in odds.js. */
export async function papiProps(game, stats) {
  const grp = LEAGUES[game.league]?.group;
  if (!SPORT_NAME[grp] || !hasPapiKey()) return { markets: [], book: '' };
  const fx = await findFixture(game, grp);
  if (!fx) return { markets: [], book: '' };
  const [cat, odds] = await Promise.all([catalog(grp), fixtureOdds(game, grp, fx)]);
  const defs = PROP_DEFS[grp];
  const rows = new Map(), by = new Map();
  for (const x of walk(odds, cat)) {
    const key = statOf(grp, x.market.name);
    const def = key && defs.find((d) => d.key === key);
    if (!def || (stats && !stats.includes(key)) || x.market.line == null) continue;
    const id = `${x.slug}|${key}|${nameKey(x.player)}|${x.market.line}`;
    const e = by.get(id) || { slug: x.slug, key, def, who: x.player, point: x.market.line };
    if (/^over$/i.test(x.outcomeName)) e.over = x.price; else if (/^under$/i.test(x.outcomeName)) e.under = x.price;
    by.set(id, e);
  }
  for (const e of [...by.values()].sort((a, b) => bookRank(a.slug) - bookRank(b.slug))) {
    if (!(e.over > 1 && e.under > 1)) continue;
    const rk = e.key + '|' + nameKey(e.who);
    if (rows.has(rk)) continue; // first book wins (DraftKings before FanDuel)
    rows.set(rk, { teamId: null, playerId: 'bk:' + nameKey(e.who), name: e.who, short: e.who, pos: '', face: '', stat: e.key, label: e.def.label, line: e.point, over: e.over, under: e.under, box: e.def.box, book: NAMES[e.slug] || e.slug, avg: e.point });
  }
  const byStat = new Map();
  for (const m of rows.values()) { if (!byStat.has(m.stat)) byStat.set(m.stat, []); byStat.get(m.stat).push(m); }
  const out = [];
  for (const list of byStat.values()) out.push(...list.sort((a, b) => b.line - a.line).slice(0, PER_MARKET * 2));
  return { markets: out, book: [...new Set(out.map((m) => m.book))].join(' and ') };
}

/** Same shape as bookFirst in odds.js. */
export async function papiFirst(game) {
  const grp = LEAGUES[game.league]?.group;
  const rx = FIRST_RX[grp];
  if (!rx || !hasPapiKey()) return { markets: [], book: '' };
  const fx = await findFixture(game, grp);
  if (!fx) return { markets: [], book: '' };
  const [cat, odds] = await Promise.all([catalog(grp), fixtureOdds(game, grp, fx)]);
  const out = new Map();
  for (const x of [...walk(odds, cat)].sort((a, b) => bookRank(a.slug) - bookRank(b.slug))) {
    if (!rx.test(x.market.name) || /^(under|no)$/i.test(x.outcomeName)) continue;
    const k = nameKey(x.player);
    if (!out.has(k)) out.set(k, { name: x.player, dec: x.price, book: NAMES[x.slug] || x.slug });
  }
  const list = [...out.values()].sort((a, b) => a.dec - b.dec);
  return { markets: list, book: [...new Set(list.map((x) => x.book))].join(' and ') };
}
