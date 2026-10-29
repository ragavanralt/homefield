// Backup data sources, used when ESPN's player or bracket data does not come through.
//   NHL: api-web.nhle.com (the league's own feed)    MLB: statsapi.mlb.com (the league's own feed)
// Both allow calls straight from a browser. Everything here is defensive: any failure just means "no data".
import { CONFIG } from './config.js';
import { getJSON } from './espn.js';

export const NHL_API = 'https://api-web.nhle.com';
export const MLB_API = 'https://statsapi.mlb.com';
const wrap = (u) => (CONFIG.proxy ? `${CONFIG.proxy}?u=${encodeURIComponent(u)}` : u);
const get = (u, ttl) => getJSON(wrap(u), ttl);

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
export const nameKey = plain;
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

/* ---------------- NHL ---------------- */
const NHL_TRI = { TB: 'TBL', NJ: 'NJD', SJ: 'SJS', LA: 'LAK', UTAH: 'UTA' };
export const nhlTri = (abbr) => NHL_TRI[abbr] || abbr;

/** Skaters with season stats for one NHL team. Returns { players, stats: Map(id -> blocks) } */
export async function nhlTeam(abbr) {
  const j = await get(`${NHL_API}/v1/club-stats/${nhlTri(abbr)}/now`, 900000);
  const players = [], stats = new Map();
  for (const s of j.skaters || []) {
    const id = 'nhl' + s.playerId;
    const first = s.firstName?.default || '', last = s.lastName?.default || '';
    players.push({ id, name: `${first} ${last}`.trim(), short: first ? `${first[0]}. ${last}` : last, pos: s.positionCode || '', face: s.headshot || '' });
    stats.set(id, [{ labels: ['GP', 'G', 'A', 'PTS', 'SOG'], values: [s.gamesPlayed, s.goals, s.assists, s.points, s.shots].map((x) => String(x ?? 0)) }]);
  }
  return { players: players.sort((a, b) => (num(stats.get(b.id)[0].values[3]) || 0) - (num(stats.get(a.id)[0].values[3]) || 0)), stats };
}

/** Stanley Cup bracket for the playoffs ending in `year`. Returns rounds in the same shape as buildBracket. */
export async function nhlBracket(year) {
  const j = await get(`${NHL_API}/v1/playoff-bracket/${year}`, 600000);
  const names = { 1: 'First Round', 2: 'Second Round', 3: 'Conference Finals', 4: 'Stanley Cup Final' };
  const rounds = new Map();
  for (const s of j.series || []) {
    const top = s.topSeedTeam, bot = s.bottomSeedTeam;
    if (!top || !bot || !top.id || !bot.id) continue;
    const t = (x) => ({ id: String(x.id), abbr: x.abbrev || '', name: x.name?.default || x.abbrev || '', logo: x.logo || '', color: '', alt: '' });
    const a = t(top), b = t(bot), aw = s.topSeedWins || 0, bw = s.bottomSeedWins || 0;
    const done = aw >= 4 || bw >= 4;
    const lead = aw > bw ? a : bw > aw ? b : null;
    const hi = Math.max(aw, bw), lo = Math.min(aw, bw);
    const r = s.playoffRound || 1;
    if (!rounds.has(r)) rounds.set(r, { name: names[r] || s.seriesTitle || 'Round ' + r, first: r, series: [] });
    rounds.get(r).series.push({ id: String(s.seriesLetter || a.id + b.id), a, b, aw, bw, state: done ? 'done' : aw + bw ? 'going' : 'next', winner: done ? lead : null, noLink: true,
      text: done ? `${lead.abbr} won ${hi}-${lo}` : lead ? `${lead.abbr} leads ${hi}-${lo}` : aw + bw ? `Tied ${aw}-${bw}` : 'Not started' });
  }
  return [...rounds.values()].sort((x, y) => x.first - y.first);
}

/* ---------------- MLB ---------------- */
let mlbTeamsP;
const mlbTeams = () => (mlbTeamsP ||= get(`${MLB_API}/api/v1/teams?sportId=1`, 86400000).then((j) => j.teams || []).catch((e) => { mlbTeamsP = null; throw e; }));
export async function mlbIdFor(name) {
  const k = plain(name);
  const t = (await mlbTeams()).find((x) => plain(x.name) === k || plain(x.teamName) === k || plain(x.name).endsWith(k) || k.endsWith(plain(x.teamName)));
  return t ? t.id : null;
}

/** Active hitters with season stats for one MLB team (matched by team name). */
export async function mlbTeam(teamName) {
  const id = await mlbIdFor(teamName);
  if (!id) throw new Error('MLB team not found: ' + teamName);
  const j = await get(`${MLB_API}/api/v1/teams/${id}/roster?rosterType=active&hydrate=${encodeURIComponent('person(stats(group=[hitting],type=[season]))')}`, 900000);
  const players = [], stats = new Map();
  for (const r of j.roster || []) {
    const p = r.person || {};
    const split = (p.stats || []).find((x) => /hitting/i.test(x.group?.displayName || ''))?.splits?.[0]?.stat;
    if (!split || /^(P|SP|RP)$/.test(r.position?.abbreviation || '')) continue;
    const pid = 'mlb' + p.id;
    players.push({ id: pid, name: p.fullName || '', short: p.fullName || '', pos: r.position?.abbreviation || '', face: `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${p.id}/headshot/67/current` });
    stats.set(pid, [{ labels: ['GP', 'AB', 'H', 'HR'], values: [split.gamesPlayed, split.atBats, split.hits, split.homeRuns].map((x) => String(x ?? 0)) }]);
  }
  return { players: players.sort((a, b) => (num(stats.get(b.id)[0].values[2]) || 0) - (num(stats.get(a.id)[0].values[2]) || 0)), stats };
}

/** Postseason games from the MLB feed, shaped like our normal games so buildBracket can group them. */
export async function mlbPostseasonGames(from, to) {
  const d = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const j = await get(`${MLB_API}/api/v1/schedule?sportId=1&gameType=F,D,L,W&startDate=${d(from)}&endDate=${d(to)}&hydrate=team`, 120000);
  const out = [];
  for (const day of j.dates || []) for (const g of day.games || []) {
    const st = g.status?.abstractGameState;
    const t = (side) => { const x = g.teams?.[side] || {}; const tm = x.team || {}; return { id: String(tm.id || ''), abbr: tm.abbreviation || tm.teamName || '', name: tm.name || '', score: x.score ?? 0, logo: tm.id ? `https://www.mlbstatic.com/team-logos/${tm.id}.svg` : '', color: '', alt: '' }; };
    out.push({ id: String(g.gamePk), league: 'mlb', date: g.gameDate, state: st === 'Final' ? 'post' : st === 'Live' ? 'in' : 'pre', seriesTitle: g.seriesDescription || '', note: '', seriesDone: false, bestOf: g.gamesInSeries || 0, playoff: true, home: t('home'), away: t('away'), noLink: true });
  }
  return out;
}

/** The league's own scores for MLB games around these dates, keyed "away|home" (plain names). Used when ESPN's board is behind. */
export async function mlbOfficial(from, to) {
  const d = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const j = await get(`${MLB_API}/api/v1/schedule?sportId=1&startDate=${d(from)}&endDate=${d(to)}&hydrate=linescore,team`, 30000);
  const out = [];
  for (const day of j.dates || []) for (const g of day.games || []) {
    const ls = g.linescore || {}, st = g.status || {};
    out.push({ key: `${plain(g.teams?.away?.team?.name)}|${plain(g.teams?.home?.team?.name)}`, at: Date.parse(g.gameDate) || 0, state: st.abstractGameState === 'Final' ? 'post' : st.abstractGameState === 'Live' ? 'in' : 'pre', detailed: st.detailedState || '', away: g.teams?.away?.score ?? 0, home: g.teams?.home?.score ?? 0, detail: st.abstractGameState === 'Live' ? `${ls.inningState || ''} ${ls.currentInningOrdinal || ''}`.trim() : st.abstractGameState === 'Final' ? (ls.currentInning > 9 ? `Final/${ls.currentInning}` : 'Final') : '' });
  }
  return out;
}
