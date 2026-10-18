// Win probability, game progress, watch-worthy meter and pre-game odds.
// All pure functions so they can be tested without a browser.
import { LEAGUES, GROUP, groupOf, hasDraw } from './leagues.js';
import { clamp, clockSeconds, minuteFromClock } from './util.js';

const HOME_EDGE = { nhl: 0.03, nba: 0.045, nfl: 0.035, mlb: 0.03, soccer: 0.07 };

/* ---------- how far into the game are we (0 to 1) ---------- */
function frac(group, period, clock, label) {
  const g = GROUP[group];
  const per = period || 1;
  const cs = clockSeconds(clock);
  if (group === 'nba') {
    const before = per <= 4 ? (per - 1) * 720 : 2880 + (per - 5) * 300;
    const len = per <= 4 ? 720 : 300;
    return clamp((before + (len - cs)) / 2880, 0, 1);
  }
  if (group === 'nhl') return per <= 3 ? clamp(((per - 1) * 1200 + (1200 - cs)) / 3600, 0, 1) : 1;
  if (group === 'nfl') return per <= 4 ? clamp(((per - 1) * 900 + (900 - cs)) / 3600, 0, 1) : 1;
  if (group === 'mlb') {
    const text = String(label || '');
    const top = /top/i.test(text);
    return clamp(((per - 1) + (top ? 0.25 : 0.75)) / g.periods, 0, 1);
  }
  return clamp(minuteFromClock(clock) / 90, 0, 1); // soccer
}

export function gameProgress(g) {
  if (!g) return 0;
  if (g.state === 'pre') return 0;
  if (g.state === 'post') return 1;
  const group = LEAGUES[g.league]?.group;
  return frac(group, g.period, g.clock, g.detail);
}

export function playProgress(p, league) {
  const group = LEAGUES[league]?.group;
  return frac(group, p.period, p.clock, p.periodLabel);
}

/* ---------- live win probability model (used when the feed has none) ---------- */
export function pHome(lead, remFrac, group) {
  const sd0 = GROUP[group]?.sd || 10;
  if (remFrac <= 0.001) return lead > 0 ? 1 : lead < 0 ? 0 : 0.5;
  const z = lead / (sd0 * Math.sqrt(remFrac));
  return 1 / (1 + Math.exp(-1.702 * z));
}

export function alignWP(plays, wp) {
  if (!wp || !wp.length || !plays.length) return null;
  const toP = (v) => { v = +v; return v > 1.5 ? v / 100 : v; };
  const by = new Map();
  wp.forEach((w) => { if (w.playId != null) by.set(String(w.playId), toP(w.homeWinPercentage)); });
  if (by.size >= Math.min(5, wp.length)) {
    let last = toP(wp[0].homeWinPercentage);
    return plays.map((p) => { if (by.has(p.id)) last = by.get(p.id); return last; });
  }
  return plays.map((_, i) => toP(wp[Math.min(wp.length - 1, Math.round((i * (wp.length - 1)) / Math.max(1, plays.length - 1)))].homeWinPercentage));
}

/** values[i] is the home team's win chance (0 to 1) right after plays[i]. */
export function buildSeries(plays, game, wp) {
  const aligned = alignWP(plays, wp);
  if (aligned) return { values: aligned, estimated: false };
  const group = LEAGUES[game?.league]?.group || 'nba';
  let h = 0, a = 0;
  const values = plays.map((p) => {
    if (p.homeScore != null) h = p.homeScore;
    if (p.awayScore != null) a = p.awayScore;
    return pHome(h - a, 1 - playProgress(p, game.league), group);
  });
  if (game?.state === 'post' && values.length) {
    const hs = game.home.score, as = game.away.score;
    values[values.length - 1] = hs > as ? 1 : hs < as ? 0 : 0.5;
  }
  return { values, estimated: true };
}

/** Biggest one-play moves in win chance, largest first. */
export function swings(values, topN = 5, minGap = 3) {
  const all = [];
  for (let i = 1; i < values.length; i++) all.push({ i, delta: values[i] - values[i - 1], size: Math.abs(values[i] - values[i - 1]) });
  all.sort((x, y) => y.size - x.size);
  const out = [];
  for (const s of all) {
    if (out.length >= topN) break;
    if (out.every((o) => Math.abs(o.i - s.i) >= minGap)) out.push(s);
  }
  return out;
}

/* ---------- watch-worthy meter ---------- */
export function watchScore(g) {
  if (!g || g.state !== 'in') return null;
  const group = LEAGUES[g.league]?.group;
  const margin = Math.abs((g.home.score ?? 0) - (g.away.score ?? 0));
  const close = Math.exp(-margin / (GROUP[group]?.closeScale || 5));
  const late = gameProgress(g);
  const s = close * (0.3 + 0.7 * late) + (g.playoff ? 0.12 : 0);
  return Math.round(100 * clamp(s, 0, 1));
}

export function watchLabel(score) {
  if (score == null) return '';
  if (score >= 75) return 'Switch to it';
  if (score >= 45) return 'Worth a look';
  return 'Can skip';
}

export function watchReason(g) {
  if (!g || g.state !== 'in') return '';
  const group = LEAGUES[g.league]?.group;
  const margin = Math.abs((g.home.score ?? 0) - (g.away.score ?? 0));
  const late = gameProgress(g);
  const scale = GROUP[group]?.closeScale || 5;
  const when = late > 0.8 ? 'late' : late > 0.45 ? 'second half' : 'early';
  if (margin === 0) return `Tied, ${when}`;
  if (margin <= scale * 0.7) return `One-score game, ${when}`;
  if (margin <= scale * 1.6) return `Within reach, ${when}`;
  return `Blowout, ${when}`;
}

/* ---------- pre-game probabilities (odds if the feed has them, records if not) ---------- */
function parseRecord(rec) {
  const nums = String(rec || '').match(/\d+/g);
  return nums ? nums.map(Number) : null;
}
function winPct(rec, league) {
  const n = parseRecord(rec);
  if (!n || n.length < 2) return null;
  const group = LEAGUES[league]?.group;
  let w, total;
  if (group === 'soccer') { w = n[0] + 0.33 * (n[1] || 0); total = n[0] + (n[1] || 0) + (n[2] || 0); }
  else { w = n[0]; total = n.reduce((a, b) => a + b, 0); }
  if (total < 3) return null;
  return clamp(w / total, 0.05, 0.95);
}

export function preGameProbs(g) {
  const group = LEAGUES[g.league]?.group;
  const draw = hasDraw(g.league);
  if (g.odds && g.odds.home != null && g.odds.away != null) {
    let { home, away, draw: d } = g.odds;
    if (draw && d == null) d = 0.26;
    const sum = home + away + (draw ? d : 0);
    return { home: home / sum, away: away / sum, draw: draw ? d / sum : 0, source: 'odds' };
  }
  const ph = winPct(g.home.record, g.league), pa = winPct(g.away.record, g.league);
  let home = 0.5, source = 'even';
  if (ph != null && pa != null) {
    const a = ph, b = pa;
    home = (a - a * b) / (a + b - 2 * a * b);
    source = 'records';
  }
  home = clamp(home + (HOME_EDGE[group] || 0.03), 0.08, 0.92);
  if (!draw) return { home, away: 1 - home, draw: 0, source };
  const d = 0.26;
  return { home: home * (1 - d), away: (1 - home) * (1 - d), draw: d, source };
}
