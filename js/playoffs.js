// Playoff picture and bracket logic. Pure functions, no DOM.
import { isSoccer } from './leagues.js';

const val = (r, k) => { const s = r.stats[k]; const n = parseFloat(s?.value ?? s?.v); return Number.isFinite(n) ? n : null; };

/** Sort one table the way the league ranks it. */
export function sortRows(rows) {
  const out = [...rows];
  const by = (k, dir) => out.every((r) => val(r, k) != null) && (out.sort((a, b) => dir * (val(a, k) - val(b, k))), true);
  if (by('playoffSeed', 1)) return out;
  if (by('rank', 1)) return out;
  // points first (hockey, soccer), then win percent
  if (out.every((r) => val(r, 'points') != null) && out.some((r) => val(r, 'points') !== val(out[0], 'points'))) {
    return out.sort((a, b) => val(b, 'points') - val(a, 'points') || (val(b, 'wins') ?? 0) - (val(a, 'wins') ?? 0));
  }
  if (by('winPercent', -1)) return out;
  if (by('wins', -1)) return out;
  return out;
}

/** "10-4", "10-4-1" style record from a stats map. */
export function recordOf(league, stats) {
  const v = (k) => stats[k]?.v;
  if (league === 'nhl') return [v('wins'), v('losses'), v('otLosses')].filter((x) => x != null).join('-');
  if (league === 'nfl') { const t = v('ties'); return [v('wins'), v('losses')].concat(t && t !== '0' ? [t] : []).join('-'); }
  if (isSoccer(league)) return [v('wins'), v('ties'), v('losses')].filter((x) => x != null).join('-');
  return [v('wins'), v('losses')].filter((x) => x != null).join('-');
}

const FORMAT = {
  nfl: { label: 'Playoff seeds', note: 'Top 7 per conference: 4 division winners plus 3 wild cards.' },
  nba: { label: 'Seeds', note: 'Top 6 per conference are in. 7 to 10 go to the play-in.' },
  nhl: { label: 'Seeds', note: 'Top 3 in each division plus 2 wild cards per conference.' },
  mlb: { label: 'Seeds', note: 'Top 6 per league: 3 division winners plus 3 wild cards.' },
};
export const pictureNote = (league) => FORMAT[league]?.note || '';

/**
 * Who is in and who is on the bubble, per conference.
 * groups: output of normStandings. Returns [{ name, in: [{row, tag}], bubble: [{row, tag}] }].
 */
export function playoffPicture(league, groups) {
  if (!FORMAT[league]) return [];
  const confs = new Map();
  for (const g of groups) {
    const key = g.conf || g.name || 'League';
    if (!confs.has(key)) confs.set(key, []);
    confs.get(key).push(g);
  }
  const out = [];
  for (const [name, gs] of confs) {
    const all = sortRows(gs.flatMap((g) => g.rows));
    const hasDivs = gs.length > 1 || gs.some((g) => g.div);
    const divTables = gs.map((g) => ({ name: g.div || g.name, rows: sortRows(g.rows) }));
    let ins = [], rest = [];
    const mark = (row, tag) => ({ row, tag });
    if (league === 'nba') {
      ins = all.slice(0, 10).map((r, i) => mark(r, i < 6 ? 'In' : 'Play-in'));
      rest = all.slice(10, 13).map((r) => mark(r, 'Outside'));
    } else if (!hasDivs) {
      const n = league === 'nfl' ? 7 : league === 'mlb' ? 6 : 8;
      ins = all.slice(0, n).map((r) => mark(r, 'In'));
      rest = all.slice(n, n + 3).map((r) => mark(r, 'Outside'));
    } else if (league === 'nhl') {
      const picked = new Set();
      const top = [];
      for (const d of divTables) d.rows.slice(0, 3).forEach((r, i) => { picked.add(r); top.push(mark(r, `${d.name.replace(/ ?Division$/i, '')} ${i + 1}`)); });
      const wc = all.filter((r) => !picked.has(r));
      ins = [...top.sort((a, b) => all.indexOf(a.row) - all.indexOf(b.row)), ...wc.slice(0, 2).map((r, i) => mark(r, `Wild card ${i + 1}`))];
      rest = wc.slice(2, 5).map((r) => mark(r, 'Outside'));
    } else {
      const winners = divTables.map((d) => d.rows[0]).filter(Boolean);
      const lead = sortRows(winners);
      const wcCount = league === 'nfl' ? 3 : 3;
      const others = all.filter((r) => !winners.includes(r));
      ins = [...lead.map((r, i) => mark(r, 'Division leader')), ...others.slice(0, wcCount).map((r) => mark(r, 'Wild card'))];
      rest = others.slice(wcCount, wcCount + 3).map((r) => mark(r, 'Outside'));
    }
    out.push({ name, in: ins, bubble: rest });
  }
  return out;
}

/** Colour zone for a soccer table row: 'z-in', 'z-mid', 'z-out' or ''. pos is 1-based. */
export function soccerZone(league, pos, size) {
  if (league === 'uefa.champions' || league === 'uefa.europa') return pos <= 8 ? 'z-in' : pos <= 24 ? 'z-mid' : 'z-out';
  if (league === 'usa.1') return pos <= 9 ? 'z-in' : '';
  if (pos <= 4) return 'z-in';
  if (pos <= 6) return 'z-mid';
  if (pos > size - 3) return 'z-out';
  return '';
}
export function soccerLegend(league) {
  if (league === 'uefa.champions' || league === 'uefa.europa') return [['z-in', 'Top 8: straight to the round of 16'], ['z-mid', '9 to 24: knockout playoff'], ['z-out', 'Out']];
  if (league === 'usa.1') return [['z-in', 'Top 9 in the conference: playoffs']];
  return [['z-in', 'Champions League'], ['z-mid', 'Europa / Conference League'], ['z-out', 'Relegation']];
}

/* ---------- bracket ---------- */
const roundName = (g) => {
  const raw = g.seriesTitle || g.note || '';
  const t = raw.replace(/\s*[-–,:]?\s*(game|leg)\s*\d+.*$/i, '').replace(/\s*\(.*$/, '').replace(/\s*[-–]\s*(best of.*|series.*)$/i, '').trim();
  return t || 'Playoffs';
};

/**
 * Group playoff games into rounds of series.
 * Returns [{ name, first (ms), series: [{ id, a, b, aw, bw, games, state, text, lastGame }] }] ordered by when each round began.
 */
export function buildBracket(games, league, { over = false } = {}) {
  const soccer = isSoccer(league);
  const map = new Map();
  for (const g of games) {
    if (!g.home?.id || !g.away?.id) continue;
    const round = roundName(g);
    const pair = [g.home.id, g.away.id].sort().join('-');
    const key = (soccer ? '' : round) + '|' + pair + (round === 'Playoffs' || !soccer ? '' : '');
    let s = map.get(key);
    if (!s) { s = { id: key, round, a: g.home, b: g.away, aw: 0, bw: 0, games: [] }; map.set(key, s); }
    s.games.push(g);
  }
  const rounds = new Map();
  for (const s of map.values()) {
    s.games.sort((x, y) => new Date(x.date) - new Date(y.date));
    s.lastGame = s.games[s.games.length - 1];
    for (const g of s.games) {
      if (g.state !== 'post') continue;
      const sc = (side) => Number(g[side].score ?? 0);
      const homeIsA = g.home.id === s.a.id;
      const ha = homeIsA ? sc('home') : sc('away'), hb = homeIsA ? sc('away') : sc('home');
      if (soccer) { s.aw += ha; s.bw += hb; }
      else if (ha > hb) s.aw++; else if (hb > ha) s.bw++;
    }
    const live = s.games.some((g) => g.state === 'in');
    const todo = s.games.some((g) => g.state === 'pre');
    const lastDone = s.games.filter((g) => g.state === 'post').length;
    const single = s.games.length === 1 && !s.lastGame.seriesDone;
    const done = !live && (s.lastGame.seriesDone || (over && !todo && lastDone > 0 && s.aw !== s.bw) || (single && s.lastGame.state === 'post'));
    s.state = done ? 'done' : live ? 'live' : lastDone ? 'going' : 'next';
    const lead = s.aw > s.bw ? s.a : s.bw > s.aw ? s.b : null;
    const hi = Math.max(s.aw, s.bw), lo = Math.min(s.aw, s.bw);
    const sc = soccer ? ` agg ${hi}-${lo}` : ` ${hi}-${lo}`;
    s.winner = done && lead ? lead : null;
    s.text = done && lead ? `${lead.abbr} won${sc}` : lead ? `${lead.abbr} leads${sc}` : lastDone ? `Tied ${s.aw}-${s.bw}` : 'Not started';
    if (s.games.length === 1) s.text = done ? `${lead ? lead.abbr + ' won' : 'Final'}` : s.state === 'live' ? 'Live' : 'Upcoming';
    if (!rounds.has(s.round)) rounds.set(s.round, { name: s.round, first: Infinity, series: [] });
    const r = rounds.get(s.round);
    r.first = Math.min(r.first, new Date(s.games[0].date).getTime());
    r.series.push(s);
  }
  return [...rounds.values()].sort((a, b) => a.first - b.first).map((r) => ({ ...r, series: r.series.sort((x, y) => new Date(x.games[0].date) - new Date(y.games[0].date)) }));
}
