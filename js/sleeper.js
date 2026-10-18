// Expected lineups from Sleeper's free public player list (no key, no sign-in). Covers NFL, NBA, NHL and MLB.
// The list is big, so it is trimmed to what we need and kept on this device for half a day.
import { posGroup } from './espn.js';

const SPORT = { nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb' };
const TTL = 12 * 3600000;
// ESPN and Sleeper spell some team abbreviations differently. Each row is one team.
const ALIASES = [['WSH', 'WAS'], ['JAX', 'JAC'], ['GS', 'GSW'], ['NY', 'NYK'], ['SA', 'SAS'], ['NO', 'NOP'], ['UTAH', 'UTA'], ['TB', 'TBL', 'TBR'], ['NJ', 'NJD'], ['LA', 'LAK', 'LAR'], ['SJ', 'SJS'], ['CHW', 'CWS'], ['AZ', 'ARI'], ['KC', 'KCR'], ['SD', 'SDP'], ['SF', 'SFG'], ['OAK', 'ATH', 'LV']];
const canon = (a) => { const x = String(a || '').toUpperCase(); const row = ALIASES.find((r) => r.includes(x)); return row ? row[0] : x; };
export const sameTeam = (a, b, league) => {
  // NFL: LA means the Rams. NHL: LA means the Kings. Keep those apart from Las Vegas and others.
  if (league === 'nfl' && (a === 'LA' || b === 'LA')) return ['LA', 'LAR'].includes(String(a).toUpperCase()) && ['LA', 'LAR'].includes(String(b).toUpperCase());
  return canon(a) === canon(b);
};

const memory = new Map();
const read = (sport) => { try { const v = JSON.parse(localStorage.getItem('homefield:sleeper:' + sport) || 'null'); return v && Date.now() - v.ts < TTL ? v.rows : null; } catch (e) { return null; } };
const write = (sport, rows) => { try { localStorage.setItem('homefield:sleeper:' + sport, JSON.stringify({ ts: Date.now(), rows })); } catch (e) { /* storage full */ } };

/** Keep only active players who are on a team, with the few fields we use. */
export function slim(raw) {
  const out = [];
  for (const p of Object.values(raw || {})) {
    if (!p || !p.team || p.active === false) continue;
    out.push({ i: String(p.player_id), n: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' '), p: p.position || '', dp: p.depth_chart_position || '', o: p.depth_chart_order ?? null, t: p.team, j: p.number ?? '', inj: p.injury_status || '' });
  }
  return out;
}

export async function loadPlayers(league) {
  const sport = SPORT[league];
  if (!sport) return null;
  if (memory.has(sport)) return memory.get(sport);
  const cached = read(sport);
  if (cached) { memory.set(sport, cached); return cached; }
  const p = fetch(`https://api.sleeper.app/v1/players/${sport}`).then((r) => { if (!r.ok) throw new Error('Sleeper ' + r.status); return r.json(); }).then((j) => { const rows = slim(j); write(sport, rows); memory.set(sport, rows); return rows; });
  return p;
}

/** First choice at each spot for one team. Returns groups: [{ name, players }]. Empty if Sleeper has no depth for it. */
export function buildLineup(rows, league, abbr) {
  const sport = SPORT[league];
  const team = (rows || []).filter((r) => sameTeam(r.t, abbr, league) && r.o != null && r.o !== '');
  const best = new Map(); // spot -> players, best first
  for (const r of team) {
    const spot = r.dp || r.p;
    if (!spot) continue;
    if (!best.has(spot)) best.set(spot, []);
    best.get(spot).push(r);
  }
  const take = (spot, n) => (best.get(spot) || []).sort((a, b) => a.o - b.o).filter((r) => r.o <= n).slice(0, n);
  const mk = (r) => ({ id: r.i, name: r.n, pos: r.dp || r.p, jersey: r.j, injury: r.inj === 'Out' || r.inj ? r.inj : '', face: `https://sleepercdn.com/content/${sport}/players/thumb/${r.i}.jpg` });
  const groups = {};
  for (const spot of best.keys()) {
    for (const r of take(spot, 1)) { // the first name at each named spot
      const g = league === 'nfl' ? (posGroup(spot, r.p) || 'Other') : 'Expected lineup';
      (groups[g] = groups[g] || []).push(mk(r));
    }
  }
  let order = league === 'nfl' ? ['Offense', 'Defense', 'Special teams', 'Other'] : ['Expected lineup'];
  let out = order.filter((g) => groups[g] && groups[g].length).map((name) => ({ name, players: groups[name] }));
  if (league === 'nba') out = out.map((g) => ({ ...g, players: g.players.slice(0, 5) }));
  const total = out.reduce((s, g) => s + g.players.length, 0);
  return total >= 3 ? out : []; // a couple of names is not a lineup
}

export async function getSleeperLineup(league, abbr) {
  const rows = await loadPlayers(league);
  return rows ? buildLineup(rows, league, abbr) : null;
}
