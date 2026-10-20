// Helpers for the crew bots. Pure functions: they turn ESPN games into rows for the server, and finished box
// scores into results. The two bots (scripts/social.mjs) wire these to the real feeds and the real database.
import { LEAGUES } from '../js/leagues.js';
import { preGameProbs } from '../js/winprob.js';
import { seasonAvg } from '../js/bets.js';

export const CARD_LEAGUES = ['nba', 'nhl', 'nfl', 'mlb'];
const r1 = (n) => Math.round(n * 10) / 10;
const nk = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const numOf = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

/* ---------- days (the slate day is Eastern Time) ---------- */
export const etDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
export const addDays = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const compact = (day) => day.replace(/-/g, '');

/* ---------- lines ---------- */
/** A line that can never land on a whole number, so nothing pushes. */
export function halfLine(x) {
  let v = Math.round(x * 2) / 2;
  if (Number.isInteger(v)) v += 0.5;
  return v;
}
/** "BOS -4.5" -> the home team's spread (negative when the home team is favoured). */
export function parseSpread(details, homeAbbr, awayAbbr) {
  const m = String(details || '').trim().match(/^([A-Za-z.]+)\s+([+-]?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const n = parseFloat(m[2]), ab = m[1].toUpperCase();
  if (ab === String(homeAbbr).toUpperCase()) return n;
  if (ab === String(awayAbbr).toUpperCase()) return -n;
  return null;
}
/** Each team's expected points from the game total and the spread. */
export const teamTotals = (ou, homeSpread) => ({ home: (ou - homeSpread) / 2, away: (ou + homeSpread) / 2 });

/* ---------- games and cards ---------- */
export function gameRow(g) {
  if (!g || !CARD_LEAGUES.includes(g.league) || g.state !== 'pre' || g.void || !g.date) return null;
  const p = preGameProbs(g);
  const homeFav = p.home >= p.away;
  const ou = Number(g.odds && g.odds.overUnder);
  return {
    league: g.league, game_id: String(g.id), start_at: new Date(g.date).toISOString(),
    home: { id: g.home.id, name: g.home.name, abbr: g.home.abbr }, away: { id: g.away.id, name: g.away.name, abbr: g.away.abbr },
    fav_team: homeFav ? g.home.id : g.away.id, fav_prob: Math.round(Math.max(p.home, p.away) * 1000) / 1000,
    ou: Number.isFinite(ou) && ou > 0 ? ou : null,
    home_spread: g.odds ? parseSpread(g.odds.details, g.home.abbr, g.away.abbr) : null,
  };
}

/** Up to `max` player markets, alternating teams and spreading across stats. */
export function pickPlayerMarkets(markets, g, max = 4) {
  const lists = [markets.filter((m) => m.teamId === g.home.id), markets.filter((m) => m.teamId === g.away.id)];
  const out = [], used = new Set();
  for (let round = 0; out.length < max && round < 8; round++) {
    for (const l of lists) {
      const m = l.find((x) => !used.has(x) && (round > 1 || !out.some((o) => o.teamId === x.teamId && o.stat === x.stat)));
      if (m) { used.add(m); out.push(m); if (out.length >= max) break; }
    }
  }
  return out;
}

export function cardsForGame(g, markets = [], maxPlayers = 4) {
  const base = { league: g.league, game_id: String(g.id) };
  const home = g.home.abbr, away = g.away.abbr;
  const out = [{ ...base, kind: 'winner', subject: 'game', title: `${away} at ${home}`, a: home, b: away, line: null, meta: {} }];
  const ou = Number(g.odds && g.odds.overUnder);
  if (Number.isFinite(ou) && ou > 0) {
    out.push({ ...base, kind: 'total', subject: 'game', title: `${away} at ${home}: total points`, a: 'Over', b: 'Under', line: halfLine(ou), meta: {} });
    const sp = parseSpread(g.odds.details, home, away);
    if (sp != null) {
      const tt = teamTotals(ou, sp);
      out.push({ ...base, kind: 'team_total', subject: 'home', title: `${home} team points`, a: 'Over', b: 'Under', line: halfLine(tt.home), meta: { team: home } });
      out.push({ ...base, kind: 'team_total', subject: 'away', title: `${away} team points`, a: 'Over', b: 'Under', line: halfLine(tt.away), meta: { team: away } });
    }
  }
  for (const m of pickPlayerMarkets(markets, g, maxPlayers)) {
    out.push({ ...base, kind: 'player', subject: `${m.playerId}:${m.stat}`, title: `${m.name}: ${m.label.toLowerCase()}`, a: 'Over', b: 'Under', line: m.line,
      meta: { playerId: String(m.playerId), name: m.name, stat: m.stat, label: m.label, face: m.face || '', team: m.teamId === g.home.id ? home : away, box: (m.box || []).map((b) => ({ g: b.g.source, l: b.l })) } });
  }
  return out;
}

/* ---------- reading box scores ---------- */
/** What a player did for one prop card (a number), or null if they did not play. */
export function playerActual(box, meta) {
  let total = 0, found = false;
  for (const spec of (meta && meta.box) || []) {
    const re = new RegExp(spec.g, 'i');
    for (const tp of (box && box.players) || []) {
      for (const grp of tp.groups) {
        if (!re.test(grp.name || '') && spec.g !== '.') continue;
        const L = grp.labels.map((x) => String(x).toUpperCase());
        const idx = spec.l.map((x) => L.indexOf(x)).find((i) => i >= 0);
        if (idx == null || idx < 0) continue;
        const row = grp.rows.find((r) => r.id === meta.playerId) || grp.rows.find((r) => meta.name && nk(r.name) === nk(meta.name));
        if (!row) continue;
        const v = numOf(row.stats[idx]);
        if (v != null) { total += v; found = true; }
      }
    }
  }
  return found ? total : null;
}

export function resultRow(summary) {
  const g = summary && summary.game;
  if (!g) return null;
  // a suspended game may be finished later, so only postponed / cancelled / abandoned games count as called off
  const called = !!g.void && !/suspend/i.test(`${g.detail} ${g.shortDetail}`);
  return { league: g.league, game_id: String(g.id), state: g.state, home_score: g.home.score, away_score: g.away.score, void: called };
}

/* ---------- Cap Night ---------- */
export const FANTASY = { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, to: -1 };
export const fantasyOf = (s) => r1(Object.entries(FANTASY).reduce((a, [k, w]) => a + w * (Number(s && s[k]) || 0), 0));
/** Season average fantasy score per game from an athlete's stat blocks. null when there are no points on file. */
export function fantasyAvg(blocks) {
  const get = (lab) => seasonAvg(blocks, { labels: [lab], perGame: true });
  const pts = get('PTS');
  if (pts == null) return null;
  return r1(pts + 1.2 * (get('REB') || 0) + 1.5 * (get('AST') || 0) + 3 * (get('STL') || 0) + 3 * (get('BLK') || 0) - (get('TO') || 0));
}
export const capPrice = (avg) => Math.max(1, Math.min(40, Math.round(1 + avg / 4)));

export function capPlayers(g, pool, { perTeam = 8, minAvg = 10 } = {}) {
  const out = [];
  for (const side of ['home', 'away']) {
    const team = g[side], p = pool && pool[side];
    if (!p) continue;
    const rows = [];
    for (const pl of p.players || []) {
      const avg = fantasyAvg(p.stats && p.stats.get(pl.id));
      if (avg != null && avg >= minAvg) rows.push({ pl, avg });
    }
    rows.sort((a, b) => b.avg - a.avg);
    for (const { pl, avg } of rows.slice(0, perTeam)) {
      out.push({ league: g.league, game_id: String(g.id), player_id: String(pl.id), name: pl.name, team_id: team.id, team_abbr: team.abbr, pos: pl.pos || '', face: pl.face || '', price: capPrice(avg), avg });
    }
  }
  return out;
}

/** One player's line from a finished NBA box score: { dnp, stats }. A player missing from the box did not play. */
export function capStatLine(box, playerId, name) {
  for (const tp of (box && box.players) || []) {
    for (const grp of tp.groups) {
      const L = grp.labels.map((x) => String(x).toUpperCase());
      const row = grp.rows.find((r) => r.id === String(playerId)) || grp.rows.find((r) => name && nk(r.name) === nk(name));
      if (!row) continue;
      const at = (lab) => { const i = L.indexOf(lab); return i >= 0 ? numOf(row.stats[i]) : null; };
      const min = at('MIN');
      if (row.dnp || !row.stats || !row.stats.length || (min != null && min <= 0)) return { dnp: true, stats: {} };
      return { dnp: false, stats: { pts: at('PTS') || 0, reb: at('REB') || 0, ast: at('AST') || 0, stl: at('STL') || 0, blk: at('BLK') || 0, to: at('TO') || 0 } };
    }
  }
  return { dnp: true, stats: {} };
}

/* ---------- the two jobs, with the network pieces passed in so they can be tested ---------- */
/**
 * Morning job. Reads today's and tomorrow's games, builds cards and the Cap Night pool, and also lists the
 * next week of games for the Survivor leagues. deps: { getScoreboard, loadPool, buildProps, survivorLeagues, log }
 */
export async function buildSlate({ day, getScoreboard, loadPool, buildProps, survivorLeagues = ['nfl', 'nba'], log = () => {} }) {
  const days = [day, addDays(day, 1)];
  const games = new Map();
  const toCard = [];
  let failures = 0, asked = 0;
  for (const lg of CARD_LEAGUES) {
    const span = survivorLeagues.includes(lg) ? 8 : 2;
    for (let i = 0; i < span; i++) {
      const d = addDays(day, i);
      let list = [];
      asked++;
      try { list = await getScoreboard(lg, compact(d)); } catch (e) { failures++; log(`${lg} ${d}: ${e.message}`); continue; }
      for (const g of list) {
        const row = gameRow(g);
        if (!row) continue;
        const key = `${lg}:${row.game_id}`;
        const seen = games.has(key);
        games.set(key, row);
        if (!seen && i < 2 && days.includes(etDay(row.start_at))) toCard.push(g);
      }
    }
  }
  if (asked && failures === asked) throw new Error('The sports feed did not answer for any league, so nothing was published.');
  const cards = [], cap = [];
  for (const g of toCard) {
    let markets = [];
    let pool = null;
    try {
      pool = await loadPool(g);
      markets = [...(pool.home ? buildProps(g.league, pool.home.players, pool.home.stats, g.home.id) : []), ...(pool.away ? buildProps(g.league, pool.away.players, pool.away.stats, g.away.id) : [])];
    } catch (e) { log(`${g.key}: no player lines (${e.message})`); }
    cards.push(...cardsForGame(g, markets));
    if (g.league === 'nba' && pool) cap.push(...capPlayers(g, pool));
  }
  return { games: [...games.values()], cards, cap };
}

/**
 * Evening job. For every started, unscored game: fetch the summary, report the score, the stat lines for open player
 * cards, and the Cap Night lines. pending is the server's bot_pending() answer. deps: { getSummary, log }
 */
export async function buildResults({ pending, getSummary, log = () => {} }) {
  const out = { p_games: [], p_actuals: [], p_cap: [] };
  for (const pg of (pending && pending.games) || []) {
    let s;
    try { s = await getSummary(pg.league, pg.game_id); } catch (e) { log(`${pg.league}:${pg.game_id}: ${e.message}`); continue; }
    const row = resultRow(s);
    if (!row) continue;
    out.p_games.push(row);
    if (row.state !== 'post') continue;
    for (const c of pending.cards || []) {
      if (c.league !== pg.league || c.game_id !== pg.game_id) continue;
      const v = playerActual(s.box, c.meta);
      if (v != null) out.p_actuals.push({ card_id: c.id, actual: v });
    }
    for (const c of pending.cap || []) {
      if (c.league !== pg.league || c.game_id !== pg.game_id) continue;
      const line = capStatLine(s.box, c.player_id, c.name);
      out.p_cap.push({ day: c.day, player_id: c.player_id, dnp: line.dnp, stats: line.stats });
    }
  }
  return out;
}

export const LEAGUE_LABEL = (lg) => (LEAGUES[lg] ? LEAGUES[lg].label : lg);
