// Talks to the ESPN public JSON feed and turns its responses into one clean shape.
// The normalize* functions are pure (tested in Node). The get* functions call fetch().
import { CONFIG } from './config.js';
import { LEAGUES, isSoccer } from './leagues.js';
import { num } from './util.js';
import { staticTeams } from './teams-static.js';
import { refreshFollowed } from './store.js';

/* ---------- fetch with a small cache ---------- */
const cache = new Map();
export async function getJSON(url, ttl = 15000) {
  const hit = cache.get(url);
  const now = Date.now();
  if (hit && now - hit.t < ttl) return hit.v;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 14000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('The data feed answered with ' + res.status);
      const v = await res.json();
      cache.set(url, { t: now, v });
      return v;
    } catch (e) {
      lastErr = e;
      if (e.name === 'TypeError' && attempt === 0) { await new Promise((r) => setTimeout(r, 700)); continue; } // network blip, try once more
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  if (hit) return hit.v; // keep showing the last good data if the network drops
  if (lastErr && lastErr.name === 'TypeError') {
    let part = url;
    try { part = new URL(url).pathname.replace(/^.*\/sports\//, ''); } catch (e) { /* ignore */ }
    throw new Error('Failed to fetch (' + part + ')');
  }
  throw lastErr;
}

const base = (lg) => `${CONFIG.espnBase}/apis/site/v2/sports/${LEAGUES[lg].sport}/${LEAGUES[lg].slug}`;
export const scoreboardUrl = (lg, ymdStr) => `${base(lg)}/scoreboard?dates=${ymdStr}&limit=200`;
export const summaryUrl = (lg, id) => `${base(lg)}/summary?event=${id}`;
export const teamsUrl = (lg) => `${base(lg)}/teams?limit=300`;
export const scheduleUrl = (lg, teamId) => `${base(lg)}/teams/${teamId}/schedule`;
export const standingsUrl = (lg) => `${CONFIG.espnBase}/apis/v2/sports/${LEAGUES[lg].sport}/${LEAGUES[lg].slug}/standings`;

/* ---------- remember games we have seen so a game page can open instantly ---------- */
const seen = new Map();
export const rememberGame = (g) => { if (g?.key) seen.set(g.key, g); };
export const recallGame = (key) => seen.get(key);

/* ---------- normalizers ---------- */
const hexColor = (c) => (c ? '#' + String(c).replace('#', '') : '');

function moneylineProb(x) {
  if (x == null || x === '') return null;
  const s = String(x).trim().toUpperCase();
  const n = s === 'EVEN' || s === 'EV' ? 100 : parseFloat(s.replace('+', ''));
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 100 / (n + 100) : -n / (-n + 100);
}

export function parseOdds(o) {
  if (!o) return null;
  const h = moneylineProb(o.homeTeamOdds?.moneyLine ?? o.moneyline?.home?.close?.odds ?? o.moneyline?.home?.current?.odds);
  const a = moneylineProb(o.awayTeamOdds?.moneyLine ?? o.moneyline?.away?.close?.odds ?? o.moneyline?.away?.current?.odds);
  const d = moneylineProb(o.drawOdds?.moneyLine ?? o.moneyline?.draw?.close?.odds ?? o.moneyline?.draw?.current?.odds);
  if (h == null || a == null) return { home: null, away: null, draw: null, details: o.details || '', overUnder: o.overUnder ?? null };
  return { home: h, away: a, draw: d, details: o.details || '', overUnder: o.overUnder ?? null };
}

function pickRecord(c) {
  const r = (c.records || []).find((x) => x.type === 'total' || x.name === 'overall') || (c.records || [])[0];
  return (r && r.summary) || (typeof c.record === 'string' ? c.record : '') || '';
}

function pickProbable(c) {
  const p = (c.probables || [])[0];
  if (!p || !p.athlete) return null;
  return { id: String(p.athlete.id || p.playerId || ''), name: p.athlete.displayName || p.athlete.fullName || '', face: p.athlete.headshot?.href || '' };
}

export function normTeam(c) {
  c = c || {};
  const t = c.team || {};
  const logo = t.logo || (t.logos && (t.logos.find((l) => (l.rel || []).includes('default')) || t.logos[0])?.href) || '';
  return {
    id: String(t.id ?? c.id ?? ''),
    abbr: t.abbreviation || t.shortDisplayName || (t.displayName || '').slice(0, 3).toUpperCase(),
    name: t.displayName || t.name || t.location || '',
    short: t.shortDisplayName || t.name || t.displayName || '',
    color: hexColor(t.color),
    alt: hexColor(t.alternateColor),
    logo,
    score: num(c.score),
    record: pickRecord(c),
    winner: !!c.winner,
    probable: pickProbable(c),
  };
}

export function normEvent(ev, league) {
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const st = comp.status || ev.status || {};
  const ty = st.type || {};
  const cs = comp.competitors || [];
  const homeC = cs.find((c) => c.homeAway === 'home') || cs[0] || {};
  const awayC = cs.find((c) => c.homeAway === 'away') || cs[1] || {};
  const home = normTeam(homeC), away = normTeam(awayC);
  const state = ty.state || 'pre';
  if (state !== 'pre') { if (home.score == null) home.score = 0; if (away.score == null) away.score = 0; }
  const statusText = `${ty.name || ''} ${ty.description || ''} ${ty.detail || ''}`;
  return {
    key: `${league}:${ev.id}`,
    id: String(ev.id),
    league,
    date: ev.date || comp.date || comp.startDate || '',
    name: ev.name || '',
    state,
    completed: !!ty.completed,
    detail: ty.detail || ty.shortDetail || '',
    shortDetail: ty.shortDetail || ty.detail || '',
    clock: st.displayClock || '',
    period: st.period || 0,
    void: /postponed|cancel|suspend|abandon/i.test(statusText),
    venue: comp.venue?.fullName || ev.venue?.displayName || '',
    city: [comp.venue?.address?.city, comp.venue?.address?.state || comp.venue?.address?.country].filter(Boolean).join(', '),
    neutral: !!comp.neutralSite,
    broadcast: ((comp.broadcasts && comp.broadcasts[0] && comp.broadcasts[0].names) || []).join(', ') || (typeof comp.broadcast === 'string' ? comp.broadcast : ''),
    series: comp.series?.summary || (comp.notes && comp.notes[0] && comp.notes[0].headline) || '',
    playoff: ev.season?.type === 3 || /playoff|final|quarter|semi/i.test((comp.notes && comp.notes[0] && comp.notes[0].headline) || ''),
    odds: parseOdds(comp.odds && comp.odds[0]),
    lastPlay: comp.situation?.lastPlay?.text || '',
    home, away,
  };
}

function normPlay(p, i) {
  const participants = [];
  for (const x of p.participants || []) { const n = x.athlete?.displayName || x.athlete?.fullName; if (n) participants.push(n); }
  for (const x of p.athletesInvolved || []) { const n = x.displayName || x.fullName; if (n) participants.push(n); }
  const label = p.period?.displayValue || p.periodText || '';
  return {
    id: String(p.id ?? i),
    i,
    seq: p.sequenceNumber != null ? Number(p.sequenceNumber) : null,
    text: p.text || p.shortText || p.type?.text || '',
    type: p.type?.text || '',
    period: p.period?.number ?? (typeof p.period === 'number' ? p.period : null),
    periodLabel: label,
    clock: p.clock?.displayValue ?? p.time?.displayValue ?? (typeof p.clock === 'string' ? p.clock : '') ?? '',
    homeScore: num(p.homeScore),
    awayScore: num(p.awayScore),
    scoring: !!p.scoringPlay,
    teamId: p.team?.id != null ? String(p.team.id) : null,
    participants,
    yellow: !!p.yellowCard, red: !!p.redCard,
  };
}

function detailToPlay(d, i) {
  return { id: `d${i}`, text: [d.type?.text, (d.athletesInvolved || []).map((a) => a.displayName).filter(Boolean).join(', ')].filter(Boolean).join(' · '), type: d.type, clock: d.clock, team: d.team, scoringPlay: d.scoringPlay, athletesInvolved: d.athletesInvolved, yellowCard: d.yellowCard, redCard: d.redCard };
}

export function normPlays(arr, game) {
  let plays = (arr || []).map((p, i) => normPlay(p, i));
  if (plays.length > 1 && plays.every((p) => p.seq != null)) plays.sort((a, b) => a.seq - b.seq);
  plays = plays.map((p, i) => ({ ...p, i }));
  // Soccer feeds rarely carry a running score, so count the goals ourselves.
  if (game && isSoccer(game.league) && plays.some((p) => p.homeScore == null)) {
    let h = 0, a = 0;
    plays = plays.map((p) => {
      if (p.scoring) { if (p.teamId === game.home.id) h++; else if (p.teamId === game.away.id) a++; }
      return { ...p, homeScore: h, awayScore: a };
    });
  }
  return plays;
}

function normBox(j) {
  const teams = [];
  for (const t of j.boxscore?.teams || []) {
    const stats = [];
    for (const s of t.statistics || []) {
      if (Array.isArray(s.stats)) for (const x of s.stats) stats.push({ label: x.displayName || x.label || x.name, value: x.displayValue ?? x.value });
      else stats.push({ label: s.label || s.displayName || s.name, value: s.displayValue ?? s.value });
    }
    teams.push({ id: String(t.team?.id || ''), homeAway: t.homeAway || '', abbr: t.team?.abbreviation || '', stats: stats.filter((s) => s.label && s.value != null && s.value !== '') });
  }
  const players = [];
  for (const p of j.boxscore?.players || []) {
    const groups = [];
    for (const s of p.statistics || []) {
      const labels = s.labels || s.names || s.keys || [];
      const rows = (s.athletes || []).map((a) => ({
        id: String(a.athlete?.id || ''),
        name: a.athlete?.displayName || a.athlete?.shortName || '',
        short: a.athlete?.shortName || a.athlete?.displayName || '',
        jersey: a.athlete?.jersey || '',
        pos: a.athlete?.position?.abbreviation || '',
        face: a.athlete?.headshot?.href || '',
        starter: !!a.starter,
        dnp: !!a.didNotPlay,
        stats: a.stats || [],
      }));
      groups.push({ name: s.name || s.type || '', labels, rows, totals: s.totals || [] });
    }
    players.push({ teamId: String(p.team?.id || ''), abbr: p.team?.abbreviation || '', groups });
  }
  return { teams, players };
}

function mapRoster(x) {
  return {
    id: String(x.athlete?.id || ''),
    name: x.athlete?.displayName || x.athlete?.fullName || x.athlete?.shortName || '',
    jersey: x.jersey || x.athlete?.jersey || '',
    pos: x.position?.abbreviation || x.athlete?.position?.abbreviation || '',
    face: x.athlete?.headshot?.href || '',
    subbedOut: !!x.subbedOut, subbedIn: !!x.subbedIn,
  };
}

function normLineups(j, box) {
  if (Array.isArray(j.rosters) && j.rosters.length) {
    return {
      kind: 'rosters',
      teams: j.rosters.map((r) => ({
        teamId: String(r.team?.id || ''), abbr: r.team?.abbreviation || '', homeAway: r.homeAway || '', formation: r.formation || '',
        starters: (r.roster || []).filter((x) => x.starter).map(mapRoster),
        bench: (r.roster || []).filter((x) => !x.starter).map(mapRoster),
      })),
    };
  }
  const out = [];
  for (const p of box.players) {
    const starters = [];
    for (const g of p.groups) for (const r of g.rows) if (r.starter) starters.push({ ...r, group: g.name });
    if (starters.length) out.push({ teamId: p.teamId, abbr: p.abbr, starters, bench: [] });
  }
  return out.length ? { kind: 'starters', teams: out } : null;
}

function normLeaders(j) {
  return (j.leaders || []).map((t) => ({
    teamId: String(t.team?.id || ''),
    cats: (t.leaders || []).map((c) => {
      const top = c.leaders && c.leaders[0];
      if (!top) return null;
      return { name: c.displayName || c.name || '', value: top.displayValue || '', who: top.athlete?.displayName || top.athlete?.fullName || '', id: String(top.athlete?.id || ''), face: top.athlete?.headshot?.href || '', summary: top.summary || '' };
    }).filter(Boolean),
  }));
}

export function normSummary(j, league, id) {
  const hdr = j.header?.competitions?.[0];
  let game = null;
  if (hdr) {
    game = normEvent({ id, date: hdr.date || j.header?.date, name: j.header?.name || '', season: j.header?.season, competitions: [hdr] }, league);
    const v = j.gameInfo?.venue;
    if (v) {
      game.venue = v.fullName || game.venue;
      game.city = [v.address?.city, v.address?.state || v.address?.country].filter(Boolean).join(', ') || game.city;
    }
    const prev = recallGame(game.key);
    if (prev) { // the scoreboard carries odds and probable pitchers that the summary header lacks
      if (!game.odds && prev.odds) game.odds = prev.odds;
      if (!game.home.probable && prev.home.probable) game.home.probable = prev.home.probable;
      if (!game.away.probable && prev.away.probable) game.away.probable = prev.away.probable;
      if (!game.broadcast && prev.broadcast) game.broadcast = prev.broadcast;
    }
    if (!game.odds && Array.isArray(j.pickcenter) && j.pickcenter[0]) game.odds = parseOdds(j.pickcenter[0]);
  }

  let raw = Array.isArray(j.plays) ? j.plays : null;
  if ((!raw || !raw.length) && j.drives) {
    raw = [];
    for (const d of [...(j.drives.previous || []), ...(j.drives.current ? [j.drives.current] : [])]) for (const p of d.plays || []) raw.push(p);
  }
  if ((!raw || !raw.length) && Array.isArray(j.keyEvents)) raw = j.keyEvents;
  if ((!raw || !raw.length) && hdr && Array.isArray(hdr.details)) raw = hdr.details.map(detailToPlay);
  const plays = normPlays(raw || [], game);

  const box = normBox(j);
  const ss = Array.isArray(j.seasonseries) ? j.seasonseries[0] : null;
  const h2h = (ss || (j.lastFiveGames && j.lastFiveGames.length)) ? {
    series: ss ? { title: ss.title || 'Season series', summary: ss.summary || '', score: ss.seriesScore || '' } : null,
    lastFive: (j.lastFiveGames || []).map((t) => ({ teamId: String(t.team?.id || ''), games: (t.events || []).slice(0, 5).map((e) => ({ result: e.gameResult || '', score: e.score || '', opp: e.opponent?.displayName || e.opponent?.abbreviation || '', atVs: e.atVs || '' })) })),
  } : null;

  return {
    game,
    plays,
    wp: Array.isArray(j.winprobability) && j.winprobability.length ? j.winprobability : null,
    box,
    lineups: normLineups(j, box),
    leaders: normLeaders(j),
    h2h,
    attendance: j.gameInfo?.attendance || null,
    keys: Object.keys(j),
  };
}

export function normStandings(j) {
  const out = [];
  const nodes = j.children && j.children.length ? j.children : [j];
  for (const ch of nodes) {
    const entries = ch.standings?.entries || [];
    if (!entries.length) continue;
    out.push({
      name: ch.name || ch.abbreviation || '',
      rows: entries.map((e) => {
        const stats = {};
        for (const s of e.stats || []) stats[s.name] = { v: s.displayValue ?? s.value, abbr: s.abbreviation || s.shortDisplayName || s.name, value: s.value };
        const t = e.team || {};
        return { team: { id: String(t.id || ''), abbr: t.abbreviation || '', name: t.displayName || t.name || '', logo: t.logos?.[0]?.href || t.logo || '' }, stats };
      }),
    });
  }
  return out;
}

/* ---------- fetchers ---------- */
export async function getScoreboard(league, ymdStr, ttl = 15000) {
  const j = await getJSON(scoreboardUrl(league, ymdStr), ttl);
  const games = (j.events || []).map((e) => normEvent(e, league));
  games.forEach((g) => { rememberGame(g); refreshFollowed(g); });
  return games;
}

export async function getSummary(league, id, ttl = 12000) {
  const j = await getJSON(summaryUrl(league, id), ttl);
  return normSummary(j, league, id);
}

const mapTeams = (league, raw) => raw.map((x) => x.team || x).filter((t) => t && t.id).map((t) => ({
  league,
  id: String(t.id),
  abbr: t.abbreviation || '',
  name: t.displayName || t.name || '',
  short: t.shortDisplayName || t.name || '',
  color: hexColor(t.color),
  alt: hexColor(t.alternateColor),
  logo: t.logos?.[0]?.href || t.logo || '',
})).sort((a, b) => a.name.localeCompare(b.name));

/** Team list. Tries a few addresses because the feed is picky; the standings table is the last resort. */
export async function getTeams(league) {
  const built = staticTeams(league);
  if (built) return built;
  const L = LEAGUES[league];
  const tries = [
    () => getJSON(teamsUrl(league), 3600000),
    () => getJSON(`${CONFIG.espnBase}/apis/site/v2/sports/${L.sport}/${L.slug}/teams`, 3600000),
    () => getJSON(`https://site.web.api.espn.com/apis/site/v2/sports/${L.sport}/${L.slug}/teams`, 3600000),
  ];
  let firstErr;
  for (const t of tries) {
    try {
      const j = await t();
      const teams = mapTeams(league, j.sports?.[0]?.leagues?.[0]?.teams || []);
      if (teams.length) return teams;
    } catch (e) { firstErr = firstErr || e; }
  }
  try {
    const groups = normStandings(await getJSON(standingsUrl(league), 3600000));
    const seen = new Map();
    for (const g of groups) for (const r of g.rows) if (r.team.id && !seen.has(r.team.id)) seen.set(r.team.id, r.team);
    const teams = mapTeams(league, [...seen.values()].map((t) => ({ id: t.id, abbreviation: t.abbr, displayName: t.name, logo: t.logo })));
    if (teams.length) return teams;
  } catch (e) { firstErr = firstErr || e; }
  throw firstErr || new Error('No teams came back for ' + L.label);
}

export async function getTeamSchedule(league, teamId) {
  const j = await getJSON(scheduleUrl(league, teamId), 900000);
  const games = (j.events || []).map((e) => normEvent(e, league)).filter((g) => g.date);
  games.forEach(rememberGame);
  games.sort((a, b) => new Date(a.date) - new Date(b.date));
  const t = j.team || {};
  return {
    team: {
      league, id: String(t.id || teamId), abbr: t.abbreviation || '', name: t.displayName || '', short: t.shortDisplayName || t.name || '',
      color: hexColor(t.color), alt: hexColor(t.alternateColor), logo: t.logo || t.logos?.[0]?.href || '', record: t.recordSummary || '', standing: t.standingSummary || '',
    },
    games,
  };
}

export async function getStandings(league) {
  const j = await getJSON(standingsUrl(league), 300000);
  return normStandings(j);
}
