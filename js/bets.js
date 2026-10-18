// The betting game: coins, odds, props, parlays, settlement, levels. Pure logic, no DOM. Play money only.
import { LEAGUES, hasDraw } from './leagues.js';
import { preGameProbs } from './winprob.js';
import { clamp } from './util.js';

export const START_COINS = 1000;
export const MIN_STAKE = 10;
export const MAX_LEGS = 8;
export const VIG = 1.06; // the "house edge" baked into every price
const r2 = (n) => Math.round(n * 100) / 100;

/* ---------- odds ---------- */
export const fromProb = (p) => r2(clamp(1 / (Math.max(p, 0.001) * VIG), 1.04, 40));
export function american(dec) {
  if (dec >= 2) return '+' + Math.round((dec - 1) * 100);
  return String(Math.round(-100 / (dec - 1)));
}
export const fmtX = (dec) => (dec >= 10 ? dec.toFixed(1) : dec.toFixed(2)) + 'x';

function poissonOver(lambda, line) {
  const k = Math.floor(line);
  let term = Math.exp(-lambda), sum = term;
  for (let i = 1; i <= k; i++) { term *= lambda / i; sum += term; }
  return clamp(1 - sum, 0.02, 0.98);
}
function erf(x) { // Abramowitz-Stegun
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const normalOver = (mean, sd, line) => clamp(1 - 0.5 * (1 + erf((line - mean) / (sd * Math.SQRT2))), 0.02, 0.98);

/** Moneyline prices for a game, from the feed's odds or team records. */
export function moneylines(g) {
  const p = preGameProbs(g);
  const out = { home: { p: p.home, dec: fromProb(p.home) }, away: { p: p.away, dec: fromProb(p.away) }, source: p.source };
  if (hasDraw(g.league)) out.draw = { p: p.draw, dec: fromProb(p.draw) };
  return out;
}

/* ---------- player props ---------- */
// Each prop: how to read the season average from a player's stat block, and how to find the result in a box score.
// block: a label that must exist in the season stat block (picks the right block for the position).
export const PROP_DEFS = {
  nba: [
    { key: 'pts', label: 'Points', dist: 'normal', sd: 0.32, labels: ['PTS'], perGame: true, box: [{ g: /./, l: ['PTS'] }], min: 8, top: 3 },
    { key: 'reb', label: 'Rebounds', dist: 'normal', sd: 0.42, labels: ['REB'], perGame: true, box: [{ g: /./, l: ['REB'] }], min: 4, top: 2 },
    { key: 'ast', label: 'Assists', dist: 'normal', sd: 0.5, labels: ['AST'], perGame: true, box: [{ g: /./, l: ['AST'] }], min: 3, top: 2 },
  ],
  nhl: [
    { key: 'pts', label: 'Points', dist: 'poisson', labels: ['PTS'], box: [{ g: /./, l: ['G'] }, { g: /./, l: ['A'] }], min: 0.4, top: 3, skater: true },
    { key: 'sog', label: 'Shots on goal', dist: 'poisson', labels: ['SOG', 'S'], box: [{ g: /./, l: ['S', 'SOG'] }], min: 1.5, top: 3, skater: true },
  ],
  nfl: [
    { key: 'passyds', label: 'Passing yards', dist: 'normal', sd: 0.3, labels: ['YDS'], need: 'CMP', box: [{ g: /pass/i, l: ['YDS'] }], min: 120, top: 1 },
    { key: 'passtd', label: 'Passing TDs', dist: 'poisson', labels: ['TD'], need: 'CMP', box: [{ g: /pass/i, l: ['TD'] }], min: 0.7, top: 1 },
    { key: 'rushyds', label: 'Rushing yards', dist: 'normal', sd: 0.45, labels: ['YDS'], need: 'CAR', box: [{ g: /rush/i, l: ['YDS'] }], min: 25, top: 2 },
    { key: 'recyds', label: 'Receiving yards', dist: 'normal', sd: 0.55, labels: ['YDS'], need: 'REC', box: [{ g: /receiv/i, l: ['YDS'] }], min: 25, top: 3 },
    { key: 'rec', label: 'Receptions', dist: 'poisson', labels: ['REC'], need: 'REC', box: [{ g: /receiv/i, l: ['REC'] }], min: 2.5, top: 3 },
  ],
  mlb: [
    { key: 'hits', label: 'Hits', dist: 'poisson', labels: ['H'], need: 'AB', box: [{ g: /batt/i, l: ['H'] }], min: 0.7, top: 3 },
    { key: 'hr', label: 'Home runs', dist: 'poisson', labels: ['HR'], need: 'AB', box: [{ g: /batt/i, l: ['HR'] }], min: 0.12, top: 2, fixedLine: 0.5 },
  ],
};
export const propDefsFor = (league) => PROP_DEFS[LEAGUES[league]?.group] || [];

const nk = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const numOf = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

/** Season average per game for one prop, from a list of stat blocks ({labels, values}). null if it can't be worked out. */
export function seasonAvg(blocks, def) {
  for (const b of blocks || []) {
    const L = b.labels.map((x) => String(x).toUpperCase());
    if (def.need && !L.includes(def.need)) continue;
    let i = -1;
    for (const lab of def.labels) { i = L.indexOf(lab); if (i >= 0) break; }
    if (i < 0) continue;
    const v = numOf(b.values[i]);
    if (v == null) continue;
    if (def.perGame) return v;
    const gp = numOf(b.values[L.indexOf('GP')]);
    if (!gp || gp < 1) continue;
    return v / gp;
  }
  return null;
}

/** Price one prop. Returns { line, over: dec, under: dec } or null. */
export function priceProp(def, avg) {
  if (avg == null || avg < def.min) return null;
  let line, pOver;
  if (def.dist === 'normal') {
    line = Math.round(avg * 2) / 2;
    if (Number.isInteger(line)) line += 0.5; // never allow a push
    pOver = normalOver(avg, Math.max(1, avg * def.sd), line);
  } else {
    line = def.fixedLine ?? Math.floor(avg) + 0.5;
    pOver = poissonOver(avg, line);
  }
  return { line, pOver, over: fromProb(pOver), under: fromProb(1 - pOver) };
}

const FOOT_POS = { QB: ['passyds', 'passtd'], RB: ['rushyds', 'recyds', 'rec'], FB: ['rushyds'], WR: ['recyds', 'rec'], TE: ['recyds', 'rec'] };

/** Which roster players are worth pulling stats for. Keeps the number of requests small. */
export function propCandidates(league, players, game) {
  const grp = LEAGUES[league]?.group;
  if (grp === 'nba') return players.slice(0, 15);
  if (grp === 'nhl') return players.filter((p) => p.pos !== 'G').slice(0, 16);
  if (grp === 'nfl') {
    const take = (pos, n) => players.filter((p) => p.pos === pos).slice(0, n);
    return [...take('QB', 3), ...take('RB', 4), ...take('WR', 6), ...take('TE', 3)];
  }
  if (grp === 'mlb') return players.filter((p) => !/^(SP|RP|P|CP)$/.test(p.pos)).slice(0, 14);
  return [];
}

const gamesIn = (rec) => { const n = (String(rec || '').match(/\d+/g) || []).map(Number).reduce((a, b) => a + b, 0); return n > 0 ? n : null; };
const grab = (txt, re) => { const m = String(txt).match(re); return m ? parseFloat(m[1].replace(/,/g, '')) : null; };

/**
 * Backup way to make props when rosters will not load: use the season leaders the game page already carries.
 * leaders: [{ teamId, cats: [{ name, value, who, id, face }] }]. Returns markets like buildProps.
 */
export function leaderProps(league, leaders, teamId, record) {
  const grp = LEAGUES[league]?.group;
  const defs = PROP_DEFS[grp] || [];
  const def = (k) => defs.find((d) => d.key === k);
  const gp = gamesIn(record);
  const mine = (leaders || []).find((t) => t.teamId === String(teamId));
  const out = [];
  const add = (c, key, avg) => {
    const d = def(key);
    const pr = d && priceProp(d, avg);
    if (pr) out.push({ teamId, playerId: c.id, name: c.who, short: c.who, pos: '', face: c.face, stat: key, label: d.label, line: pr.line, over: pr.over, under: pr.under, box: d.box });
  };
  for (const c of mine ? mine.cats : []) {
    const n = c.name, v = c.value;
    if (grp === 'nba') {
      const x = grab(v, /^([\d.,]+)/);
      if (x == null) continue;
      const per = x > 70 && gp ? x / gp : x;
      if (/point/i.test(n)) add(c, 'pts', per); else if (/rebound/i.test(n)) add(c, 'reb', per); else if (/assist/i.test(n)) add(c, 'ast', per);
    } else if (grp === 'nfl' && gp) {
      const yds = grab(v, /([\d,]+)\s*YDS/i);
      if (/passing/i.test(n) && yds != null) { add(c, 'passyds', yds / gp); const td = grab(v, /(\d+)\s*TD/i); if (td != null) add(c, 'passtd', td / gp); }
      else if (/rushing/i.test(n) && yds != null) add(c, 'rushyds', yds / gp);
      else if (/receiving/i.test(n) && yds != null) { add(c, 'recyds', yds / gp); const rec = grab(v, /(\d+)\s*REC/i); if (rec != null) add(c, 'rec', rec / gp); }
    } else if (grp === 'nhl' && gp) {
      const x = grab(v, /^([\d.,]+)/);
      if (x != null && /^points/i.test(n)) add(c, 'pts', x / gp);
    }
  }
  return out;
}

/** Turn players + their stat blocks into prop markets for one team. */
export function buildProps(league, players, statsById, teamId) {
  const grp = LEAGUES[league]?.group;
  const defs = PROP_DEFS[grp] || [];
  const out = [];
  for (const def of defs) {
    const rows = [];
    for (const p of players) {
      if (grp === 'nfl' && FOOT_POS[p.pos] && !FOOT_POS[p.pos].includes(def.key)) continue;
      if (grp === 'nfl' && !FOOT_POS[p.pos]) continue;
      const avg = seasonAvg(statsById.get(p.id), def);
      const pr = priceProp(def, avg);
      if (pr) rows.push({ p, avg, pr });
    }
    rows.sort((a, b) => b.avg - a.avg);
    for (const { p, pr } of rows.slice(0, def.top)) {
      out.push({ teamId, playerId: p.id, name: p.name, short: p.short, pos: p.pos, face: p.face, stat: def.key, label: def.label, line: pr.line, over: pr.over, under: pr.under, box: def.box });
    }
  }
  return out;
}

/* ---------- legs and bets ---------- */
export const legKey = (parts) => parts.join('|');

export function mlLeg(g, side) {
  const m = moneylines(g)[side];
  return {
    key: legKey([g.key, 'ml', side]), kind: 'ml', gameKey: g.key, league: g.league, gameId: g.id, date: g.date,
    home: { id: g.home.id, abbr: g.home.abbr, name: g.home.name }, away: { id: g.away.id, abbr: g.away.abbr, name: g.away.name },
    side, dec: m.dec, label: side === 'draw' ? 'Draw' : g[side].abbr + ' to win', result: 'pending',
  };
}

export function propLeg(g, market, dir) {
  return {
    key: legKey([g.key, 'prop', market.playerId, market.stat, dir]), kind: 'prop', gameKey: g.key, league: g.league, gameId: g.id, date: g.date,
    home: { id: g.home.id, abbr: g.home.abbr, name: g.home.name }, away: { id: g.away.id, abbr: g.away.abbr, name: g.away.name },
    prop: { playerId: market.playerId, name: market.name, label: market.label, stat: market.stat, line: market.line, dir, box: market.box.map((b) => ({ g: b.g.source, l: b.l })) },
    dec: market[dir], label: `${market.name} ${dir === 'over' ? 'Over' : 'Under'} ${market.line} ${market.label.toLowerCase()}`, result: 'pending',
  };
}

/** Two legs that can't both be bet: same market, other side. */
export const conflicts = (a, b) => a.key !== b.key && a.gameKey === b.gameKey && (
  (a.kind === 'ml' && b.kind === 'ml') || (a.kind === 'prop' && b.kind === 'prop' && a.prop.playerId === b.prop.playerId && a.prop.stat === b.prop.stat));

export const parlayDec = (legs) => r2(legs.reduce((m, l) => m * l.dec, 1));

/** Result of one leg given the finished game ({ game, box }). */
export function evalLeg(leg, data) {
  const g = data && data.game;
  if (!g) return 'pending';
  if (g.void) return 'void';
  if (g.state !== 'post') return 'pending';
  if (leg.kind === 'ml') {
    const h = g.home.score ?? 0, a = g.away.score ?? 0;
    if (h === a) return leg.side === 'draw' ? 'won' : hasDraw(leg.league) ? 'lost' : 'push';
    const winner = h > a ? 'home' : 'away';
    return leg.side === winner ? 'won' : 'lost';
  }
  let total = 0, found = false;
  for (const spec of leg.prop.box) {
    const re = new RegExp(spec.g, 'i');
    for (const tp of data.box?.players || []) {
      for (const grp of tp.groups) {
        if (!re.test(grp.name || '') && spec.g !== '.') continue;
        const L = grp.labels.map((x) => String(x).toUpperCase());
        const idx = spec.l.map((x) => L.indexOf(x)).find((i) => i >= 0);
        if (idx == null || idx < 0) continue;
        const row = grp.rows.find((r) => r.id === leg.prop.playerId) || grp.rows.find((r) => leg.prop.name && nk(r.name) === nk(leg.prop.name));
        if (!row) continue;
        const v = numOf(row.stats[idx]);
        if (v != null) { total += v; found = true; }
      }
    }
  }
  if (!found) return 'void'; // did not play
  if (total === leg.prop.line) return 'push';
  return (leg.prop.dir === 'over') === (total > leg.prop.line) ? 'won' : 'lost';
}

export const streakBoost = (streak) => Math.min(0.5, 0.05 * Math.max(0, streak));

/** Decide a bet from its leg results. Returns { status, payout } or null while undecided. */
export function decideBet(bet, streak) {
  const legs = bet.legs;
  if (legs.some((l) => l.result === 'lost')) return { status: 'lost', payout: 0 };
  if (legs.some((l) => l.result === 'pending')) return null;
  const live = legs.filter((l) => l.result === 'won');
  if (!live.length) return { status: 'void', payout: bet.stake };
  const dec = live.reduce((m, l) => m * l.dec, 1);
  const boost = streakBoost(streak);
  return { status: 'won', payout: Math.round(bet.stake * dec * (1 + boost)), boost };
}

/* ---------- levels and ranks ---------- */
export const levelFor = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1;
export const xpForLevel = (lvl) => Math.round(120 * (lvl - 1) ** 2);
export const RANKS = ['Rookie', 'Bench Warmer', 'Starter', 'Sixth Man', 'All-Star', 'Franchise Player', 'MVP', 'Hall of Famer', 'GOAT'];
export const rankFor = (lvl) => RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 2))];
export const xpFor = (bet, won) => Math.round(bet.stake / 10) + (won ? 25 + 10 * (bet.legs.length - 1) : 5);

/* ---------- stats and badges ---------- */
export function betStats(bets, bank) {
  const all = Object.values(bets);
  const settled = all.filter((b) => b.status !== 'pending');
  const won = settled.filter((b) => b.status === 'won'), lost = settled.filter((b) => b.status === 'lost');
  const staked = settled.filter((b) => b.status !== 'void').reduce((s, b) => s + b.stake, 0);
  const returned = settled.reduce((s, b) => s + (b.payout || 0), 0) - settled.filter((b) => b.status === 'void').reduce((s, b) => s + b.stake, 0);
  const biggest = won.reduce((m, b) => (!m || b.payout - b.stake > m.payout - m.stake ? b : m), null);
  const longshot = won.reduce((m, b) => (!m || b.dec > m.dec ? b : m), null);
  const propWins = won.reduce((n, b) => n + b.legs.filter((l) => l.kind === 'prop' && l.result === 'won').length, 0);
  const parlayWins = won.filter((b) => b.mode === 'parlay');
  return {
    total: all.length, pending: all.length - settled.length, won: won.length, lost: lost.length,
    accuracy: won.length + lost.length ? won.length / (won.length + lost.length) : null,
    staked, profit: returned - staked, biggest, longshot, propWins, parlayWins: parlayWins.length, biggestParlay: parlayWins.reduce((m, b) => Math.max(m, b.legs.length), 0),
    streak: bank.streak, bestStreak: bank.bestStreak,
  };
}

export function badges(st, bank) {
  return [
    { id: 'first', name: 'First blood', blurb: 'Win your first bet', got: st.won >= 1 },
    { id: 'parlay', name: 'Parlay pro', blurb: 'Hit a 3+ leg parlay', got: st.biggestParlay >= 3 },
    { id: 'long', name: 'Longshot', blurb: 'Win a bet paying 4x or more', got: !!st.longshot && st.longshot.dec >= 4 },
    { id: 'props', name: 'Prop master', blurb: 'Win 5 player props', got: st.propWins >= 5 },
    { id: 'heat', name: 'On fire', blurb: 'Win 5 bets in a row', got: st.bestStreak >= 5 },
    { id: 'rich', name: 'High roller', blurb: 'Reach 5,000 coins', got: bank.peak >= 5000 },
  ];
}
