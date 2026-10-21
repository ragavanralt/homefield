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
// The standings table lives on ESPN's "web" host; the plain host only returns a stub with a link.
export const standingsUrl = (lg, level) => `${CONFIG.espnWebBase}/apis/v2/sports/${LEAGUES[lg].sport}/${LEAGUES[lg].slug}/standings${level ? '?level=' + level : ''}`;
export const standingsUrlAlt = (lg) => `${CONFIG.espnBase}/apis/v2/sports/${LEAGUES[lg].sport}/${LEAGUES[lg].slug}/standings`;

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
    note: (comp.notes && comp.notes[0] && comp.notes[0].headline) || '',
    seriesTitle: comp.series?.title || '',
    seriesDone: !!comp.series?.completed,
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
  // who the play is about, so the viewer can show their face
  const a0 = (p.participants || []).map((x) => x.athlete).find(Boolean) || (p.athletesInvolved || [])[0] || null;
  const who = a0 && (a0.id != null) ? { id: String(a0.id), name: a0.displayName || a0.fullName || '', face: (a0.headshot && a0.headshot.href) || '' } : null;
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
    participants, who,
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
        batOrder: num(a.batOrder),
        stats: a.stats || [],
      }));
      groups.push({ name: s.name || s.type || '', labels, rows, totals: s.totals || [] });
    }
    players.push({ teamId: String(p.team?.id || ''), abbr: p.team?.abbreviation || '', groups });
  }
  // soccer has no boxscore.players: each player's match numbers sit on the roster entries instead
  if (!players.length && Array.isArray(j.rosters)) {
    for (const r of j.rosters) {
      const labels = [], rows = [];
      for (const x of r.roster || []) {
        if (!x.starter && !x.subbedIn) continue; // never came on: no stats, so a prop on them is refunded
        const map = {};
        for (const st of x.stats || []) {
          const lab = String(st.abbreviation || st.shortDisplayName || '').toUpperCase();
          if (!lab) continue;
          map[lab] = st.displayValue ?? st.value;
          if (!labels.includes(lab)) labels.push(lab);
        }
        rows.push({ id: String(x.athlete?.id || ''), name: x.athlete?.displayName || x.athlete?.shortName || '', short: x.athlete?.shortName || x.athlete?.displayName || '', jersey: x.jersey || x.athlete?.jersey || '',
          pos: x.position?.abbreviation || x.athlete?.position?.abbreviation || '', face: x.athlete?.headshot?.href || '', starter: !!x.starter, dnp: false, map });
      }
      if (!rows.length) continue;
      players.push({ teamId: String(r.team?.id || ''), abbr: r.team?.abbreviation || '', groups: [{ name: 'soccer', labels, totals: [], rows: rows.map(({ map, ...row }) => ({ ...row, stats: labels.map((l) => String(map[l] ?? '0')) })) }] });
    }
  }
  return { teams, players };
}

// A roster entry's own count of a stat, by its name or abbreviation.
const statOf = (x, names) => { for (const st of x.stats || []) if (names.includes(st.name) || names.includes(String(st.abbreviation || '').toUpperCase())) return num(st.value ?? st.displayValue) || 0; return 0; };

function mapRoster(x) {
  const plays = Array.isArray(x.plays) ? x.plays : [];
  const count = (f) => plays.filter(f).length;
  const sub = plays.find((p) => p.substitution);
  const other = x.subbedInFor || x.subbedOutFor;
  return {
    id: String(x.athlete?.id || ''),
    name: x.athlete?.displayName || x.athlete?.fullName || x.athlete?.shortName || '',
    short: x.athlete?.shortName || '',
    jersey: x.jersey || x.athlete?.jersey || '',
    pos: x.position?.abbreviation || x.athlete?.position?.abbreviation || '',
    place: x.formationPlace || '',
    face: x.athlete?.headshot?.href || '',
    subbedOut: !!x.subbedOut, subbedIn: !!x.subbedIn,
    subMinute: sub?.clock?.displayValue || '',
    subFor: other?.athlete?.displayName || other?.displayName || '',
    events: {
      goals: Math.max(statOf(x, ['totalGoals', 'G']), count((p) => p.didScore && !p.ownGoal)),
      assists: Math.max(statOf(x, ['goalAssists', 'A']), count((p) => p.didAssist)),
      yellow: Math.max(statOf(x, ['yellowCards', 'YC']), count((p) => p.yellowCard)),
      red: Math.max(statOf(x, ['redCards', 'RC']), count((p) => p.redCard)),
    },
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
    const starters = [], bench = [], seen = new Map();
    for (const g of p.groups) for (const r of g.rows) {
      const key = r.id || r.name;
      if (seen.has(key)) { const was = seen.get(key); if (r.batOrder && !was.batOrder) was.batOrder = r.batOrder; continue; } // a two-way player sits in both groups
      const row = { ...r, group: g.name };
      seen.set(key, row);
      if (r.starter) starters.push(row); else if (!r.dnp) bench.push(row);
    }
    if (starters.length) out.push({ teamId: p.teamId, abbr: p.abbr, starters, bench });
  }
  return out.length ? { kind: 'starters', teams: out } : null;
}

/* ---------- football depth charts (NFL game feeds carry no starters) ---------- */
const POS = {
  Offense: new Set(['QB', 'RB', 'FB', 'HB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG', 'T', 'G']),
  Defense: new Set(['DE', 'DT', 'NT', 'DL', 'LB', 'OLB', 'ILB', 'MLB', 'CB', 'S', 'SS', 'FS', 'DB', 'EDGE']),
  'Special teams': new Set(['K', 'P', 'PK', 'LS', 'KR', 'PR', 'H']),
};
export function posGroup(...cands) {
  for (const raw of cands) {
    const a = String(raw || '').toUpperCase().replace(/[0-9]/g, '');
    if (!a) continue;
    for (const [g, set] of Object.entries(POS)) if (set.has(a) || (a.length > 2 && set.has(a.slice(1)))) return g;
  }
  return null;
}
/** The first name at each position of the first offence, defence and special teams chart. Pure, so it can be tested. */
export function normDepth(j, league = 'nfl') {
  const sport = LEAGUES[league]?.slug || 'nfl';
  const picked = {};
  for (const ch of Array.isArray(j?.depthchart) ? j.depthchart : []) {
    const slots = Object.entries(ch.positions || {});
    const votes = {};
    for (const [k, sl] of slots) { const g = posGroup(sl.position?.parent?.abbreviation, sl.position?.abbreviation, k); if (g) votes[g] = (votes[g] || 0) + 1; }
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    if (!best || picked[best[0]]) continue;
    picked[best[0]] = slots.map(([k, sl]) => {
      const a = (sl.athletes || [])[0];
      if (!a) return null;
      const inj = (a.injuries || [])[0];
      return { id: String(a.id), name: a.displayName || a.shortName || '', short: a.shortName || a.displayName || '', pos: String(sl.position?.abbreviation || sl.position?.parent?.abbreviation || k).toUpperCase(),
        jersey: a.jersey || '', face: a.id ? `https://a.espncdn.com/i/headshots/${sport}/players/full/${a.id}.png` : '', injury: inj ? (inj.status || inj.type?.description || inj.type || 'Injured') : '' };
    }).filter(Boolean);
  }
  return ['Offense', 'Defense', 'Special teams'].filter((g) => picked[g] && picked[g].length).map((name) => ({ name, players: picked[name] }));
}
export async function getDepthChart(league, teamId) {
  const j = await getJSON(`${base(league)}/teams/${teamId}/depthcharts`, 1800000);
  return normDepth(j, league);
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
  const walk = (node, trail) => {
    const entries = node.standings?.entries || [];
    if (entries.length) {
      out.push({
        conf: trail.length ? trail[0] : (node.name || ''),
        div: trail.length ? (node.name || '') : '',
        name: [...trail, node.name || node.abbreviation || ''].filter(Boolean).slice(-2).join(' · '),
        rows: entries.map((e) => {
          const stats = {};
          for (const s of e.stats || []) stats[s.name] = { v: s.displayValue ?? s.value, abbr: s.abbreviation || s.shortDisplayName || s.name, value: s.value };
          const t = e.team || {};
          return { team: { id: String(t.id || ''), abbr: t.abbreviation || '', name: t.displayName || t.name || '', logo: t.logos?.[0]?.href || t.logo || '' }, stats };
        }),
      });
    }
    for (const c of node.children || []) walk(c, [...trail, node.name && node !== j ? node.name : ''].filter(Boolean));
  };
  walk(j, []);
  // when a conference table and its division tables both exist, keep the more detailed (smaller) groups
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
    const groups = await getStandings(league);
    const seen = new Map();
    for (const g of groups) for (const r of g.rows) if (r.team.id && !seen.has(r.team.id)) seen.set(r.team.id, r.team);
    const teams = mapTeams(league, [...seen.values()].map((t) => ({ id: t.id, abbreviation: t.abbr, displayName: t.name, logo: t.logo })));
    if (teams.length) return teams;
  } catch (e) { firstErr = firstErr || e; }
  throw firstErr || new Error('No teams came back for ' + L.label);
}

export async function getTeamSchedule(league, teamId) {
  let j;
  try { j = await getJSON(scheduleUrl(league, teamId), 900000); } catch (e) {
    try { j = await getJSON(`${CONFIG.espnWebBase}/apis/site/v2/sports/${LEAGUES[league].sport}/${LEAGUES[league].slug}/teams/${teamId}/schedule`, 900000); } catch (e2) { throw e; }
  }
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


/* ---------- rosters and player stats ---------- */
export const rosterUrl = (lg, id) => `${base(lg)}/teams/${id}/roster`;
const webBase = (lg) => `${CONFIG.espnWebBase}/apis/common/v3/sports/${LEAGUES[lg].sport}/${LEAGUES[lg].slug}`;
export const athleteUrl = (lg, id) => `${webBase(lg)}/athletes/${id}/overview`;

export function normRoster(j) {
  const flat = [];
  for (const a of j.athletes || []) {
    if (Array.isArray(a.items)) a.items.forEach((x) => flat.push({ ...x, _group: a.position || a.name || '' }));
    else flat.push(a);
  }
  const players = flat.filter((a) => a && a.id).map((a) => ({
    id: String(a.id),
    name: a.displayName || a.fullName || a.shortName || '',
    short: a.shortName || a.displayName || '',
    jersey: a.jersey || '',
    pos: a.position?.abbreviation || '',
    posName: a.position?.displayName || a.position?.name || '',
    group: a._group || '',
    age: a.age || '',
    ht: a.displayHeight || '',
    wt: a.displayWeight || '',
    face: a.headshot?.href || '',
    exp: a.experience?.displayValue || (a.experience?.years != null ? a.experience.years + ' yr' : ''),
    status: a.injuries?.[0]?.status || '',
  }));
  const coach = j.coach?.[0] ? [j.coach[0].firstName, j.coach[0].lastName].filter(Boolean).join(' ') : '';
  return { players, coach };
}

export async function getRoster(league, teamId) {
  const L = LEAGUES[league];
  let lastErr;
  for (const url of [rosterUrl(league, teamId), `${CONFIG.espnWebBase}/apis/site/v2/sports/${L.sport}/${L.slug}/teams/${teamId}/roster`]) {
    try {
      const r = normRoster(await getJSON(url, 1800000));
      if (r.players.length) return r;
    } catch (e) { lastErr = lastErr || e; }
  }
  if (lastErr) throw lastErr;
  return { players: [], coach: '' };
}

/** Season stat lines from an athlete overview. Each block is { title, labels, values, split }. */
export function normAthleteStats(j) {
  const st = j.statistics;
  const blocks = Array.isArray(st) ? st : st ? [st] : [];
  const out = [];
  for (const b of blocks) {
    const labels = b.labels || b.names || [];
    const splits = b.splits || [];
    const pick = splits.find((x) => /regular|season|current|^\d{4}/i.test(x.displayName || '') && !/career/i.test(x.displayName || '')) || splits[0];
    if (labels.length && pick && Array.isArray(pick.stats) && pick.stats.length) {
      out.push({ title: b.displayName || b.name || 'Season', labels, values: pick.stats.map(String), split: pick.displayName || '' });
    }
  }
  return out;
}

export async function getAthleteStats(league, athleteId) {
  let lastErr;
  for (const url of [athleteUrl(league, athleteId), `${CONFIG.espnBase}/apis/common/v3/sports/${LEAGUES[league].sport}/${LEAGUES[league].slug}/athletes/${athleteId}/overview`]) {
    try { return normAthleteStats(await getJSON(url, 1800000)); } catch (e) { lastErr = lastErr || e; }
  }
  throw lastErr;
}

export async function getStandings(league) {
  let lastErr, groups = [];
  const tries = [standingsUrl(league, 3), standingsUrl(league), standingsUrlAlt(league)];
  for (const url of tries) {
    try {
      groups = normStandings(await getJSON(url, 300000));
      if (groups.length) return groups;
    } catch (e) { lastErr = lastErr || e; }
  }
  if (lastErr && !groups.length) throw lastErr;
  return groups;
}

/* ---------- playoffs ---------- */
// Usual postseason window for each competition: [startMonth, startDay, endMonth, endDay] (1-based months).
const WINDOWS = {
  nhl: [4, 10, 6, 30], nba: [4, 12, 6, 25], nfl: [1, 9, 2, 15], mlb: [9, 28, 11, 5],
  'uefa.champions': [2, 10, 6, 1], 'uefa.europa': [2, 10, 5, 31], 'usa.1': [10, 20, 12, 15],
};
export const hasPlayoffs = (lg) => !!WINDOWS[lg];

/** The most recent postseason window that has started. Returns { from, to, live }. */
export function playoffWindow(lg, now = new Date()) {
  const w = WINDOWS[lg];
  if (!w) return null;
  const mk = (y) => ({ from: new Date(y, w[0] - 1, w[1]), to: new Date(y, w[2] - 1, w[3], 23, 59) });
  let r = mk(now.getFullYear());
  if (r.from > now) r = mk(now.getFullYear() - 1);
  return { ...r, live: now >= r.from && now <= r.to };
}

export async function getPlayoffGames(league, now = new Date()) {
  const win = playoffWindow(league, now);
  if (!win) return { games: [], win: null };
  const ymdOf = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const url = `${base(league)}/scoreboard?dates=${ymdOf(win.from)}-${ymdOf(win.to)}&limit=1000`;
  const j = await getJSON(url, win.live ? 120000 : 3600000);
  const games = (j.events || []).map((e) => normEvent(e, league)).filter((g) => g.playoff);
  return { games, win };
}
