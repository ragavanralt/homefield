// Neutral game bets and first scorer markets. Pure logic, no DOM. Play money only.
// Prices come from the feed's lines when there are any, and from simple models otherwise.
import { fromProb, poissonOver, normalOver, moneylines } from './bets.js';
import { LEAGUES, hasDraw } from './leagues.js';

const nk = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const numOf = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const grpOf = (lg) => LEAGUES[lg]?.group;
const DEF_TOTAL = { nba: 224.5, nhl: 5.5, nfl: 44.5, mlb: 8.5, soccer: 2.5 };
const REG = { nhl: 3, nba: 4, nfl: 4, mlb: 9, soccer: 2 };
const OT_P = { nhl: 0.23, nba: 0.06, nfl: 0.06 };
const TO = { nba: { total: [26.5, 4.8], team: [13.25, 3.5] }, nfl: { total: [2.4], team: [1.2] } }; // [mean, sd] or [lambda]
const SIDE_NAME = (g, side) => g[side].short || g[side].name || g[side].abbr;

function mkLeg(g, grp, id, label, dec, sp) {
  return {
    key: [g.key, 'sp', grp, id].join('|'), kind: 'special', gameKey: g.key, league: g.league, gameId: g.id, date: g.date,
    home: { id: g.home.id, abbr: g.home.abbr, name: g.home.name }, away: { id: g.away.id, abbr: g.away.abbr, name: g.away.name },
    sp: { grp, ...sp }, dec, label, result: 'pending',
  };
}

/** Home spread from the feed's "BUF -3.5" style text. Returns the home team's line, or null. */
export function homeSpread(g) {
  const d = String(g.odds?.details || '').trim();
  const m = d.match(/^(.+?)\s+([+-]\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const line = parseFloat(m[2]);
  if (m[1] === g.home.abbr) return line;
  if (m[1] === g.away.abbr) return -line;
  return null;
}

/** Chance each side scores first. */
export function firstProbs(g) {
  const ml = moneylines(g);
  let ph = ml.home.p, pa = ml.away.p;
  const t = ph + pa; ph /= t; pa /= t;
  const adj = (p) => 0.5 + (p - 0.5) * 0.4;
  let home = adj(ph), away = 1 - home, none = 0;
  if (hasDraw(g.league)) { none = 0.08; home *= 1 - none; away *= 1 - none; }
  return { home, away, none };
}

/** Neutral bets for a game: [{ id, title, note, legs }]. */
export function gameBets(g) {
  const grp = grpOf(g.league);
  const out = [];
  const total = g.odds?.overUnder ? Number(g.odds.overUnder) : DEF_TOTAL[grp];
  if (total) {
    const d = fromProb(0.5);
    out.push({ id: 'total', title: grp === 'soccer' ? 'Total goals' : grp === 'mlb' ? 'Total runs' : 'Total points', legs: [
      mkLeg(g, 'total', 'over', `Over ${total} ${grp === 'soccer' ? 'goals' : 'total'}`, d, { t: 'total', dir: 'over', line: total }),
      mkLeg(g, 'total', 'under', `Under ${total} ${grp === 'soccer' ? 'goals' : 'total'}`, d, { t: 'total', dir: 'under', line: total })] });
  }
  const sp = grp !== 'soccer' ? homeSpread(g) : null;
  if (sp != null) {
    const d = fromProb(0.5);
    const fmt = (n) => (n > 0 ? '+' : '') + n;
    out.push({ id: 'spread', title: 'Spread', legs: [
      mkLeg(g, 'spread', 'away', `${g.away.abbr} ${fmt(-sp)}`, d, { t: 'spread', side: 'away', line: -sp }),
      mkLeg(g, 'spread', 'home', `${g.home.abbr} ${fmt(sp)}`, d, { t: 'spread', side: 'home', line: sp })] });
  }
  const fp = firstProbs(g);
  const firstLegs = [['away', fp.away], ['home', fp.home]].map(([side, p]) => mkLeg(g, 'first', side, `${SIDE_NAME(g, side)} to score first`, fromProb(p), { t: 'first', side }));
  if (fp.none) firstLegs.splice(1, 0, mkLeg(g, 'first', 'none', 'No goals', fromProb(fp.none), { t: 'first', side: 'none' }));
  out.push({ id: 'first', title: 'First team to score', legs: firstLegs });
  if (OT_P[grp]) {
    out.push({ id: 'ot', title: 'Goes to overtime?', legs: [
      mkLeg(g, 'ot', 'yes', 'Overtime: yes', fromProb(OT_P[grp]), { t: 'ot', yes: true }),
      mkLeg(g, 'ot', 'no', 'Overtime: no', fromProb(1 - OT_P[grp]), { t: 'ot', yes: false })] });
  }
  if (TO[grp]) {
    const [m, sd] = TO[grp].total, [tm, tsd] = TO[grp].team;
    const over = (mean, s, line) => (s ? normalOver(mean, s, line) : poissonOver(mean, line));
    const tl = grp === 'nfl' ? 2.5 : 26.5, ml = grp === 'nfl' ? 1.5 : 13.5;
    out.push({ id: 'to-total', title: 'Turnovers, both teams', legs: [
      mkLeg(g, 'to-total', 'over', `Over ${tl} turnovers`, fromProb(over(m, sd, tl)), { t: 'to', scope: 'total', dir: 'over', line: tl }),
      mkLeg(g, 'to-total', 'under', `Under ${tl} turnovers`, fromProb(1 - over(m, sd, tl)), { t: 'to', scope: 'total', dir: 'under', line: tl })] });
    for (const side of ['away', 'home']) {
      const po = over(tm, tsd, ml);
      out.push({ id: 'to-' + side, title: `${SIDE_NAME(g, side)} turnovers`, legs: [
        mkLeg(g, 'to-' + side, 'over', `${g[side].abbr} over ${ml} turnovers`, fromProb(po), { t: 'to', scope: side, dir: 'over', line: ml }),
        mkLeg(g, 'to-' + side, 'under', `${g[side].abbr} under ${ml} turnovers`, fromProb(1 - po), { t: 'to', scope: side, dir: 'under', line: ml })] });
    }
  }
  if (grp === 'soccer') {
    out.push({ id: 'btts', title: 'Both teams to score', legs: [
      mkLeg(g, 'btts', 'yes', 'Both teams score: yes', fromProb(0.52), { t: 'btts', yes: true }),
      mkLeg(g, 'btts', 'no', 'Both teams score: no', fromProb(0.48), { t: 'btts', yes: false })] });
  }
  return out;
}

/* ---------- full ladders of totals, spreads and team totals ---------- */
const SD = { nba: { tot: 18, mar: 12 }, nfl: { tot: 10.5, mar: 13 }, nhl: { tot: 2.3, mar: 2.3 }, mlb: { tot: 3.8, mar: 4.2 }, soccer: { tot: 1.7, mar: 1.7 } };
const STEP = { nba: { tot: 3, sp: 2, tt: 3 }, nfl: { tot: 3, sp: 3, tt: 3 }, nhl: { tot: 1, sp: 1, tt: 1 }, mlb: { tot: 1, sp: 1, tt: 1 }, soccer: { tot: 1, sp: 1, tt: 1 } };
const halfOf = (n) => Math.round(n * 2) / 2;
const unitWord = (grp) => (grp === 'soccer' ? 'goals' : grp === 'mlb' ? 'runs' : 'points');

/** Our own lines when no book is connected: [{ line, over, under }] totals, spread rows by home line, and each team's total. */
export function modelLines(g) {
  const grp = grpOf(g.league);
  const sd = SD[grp] || SD.nba, st = STEP[grp] || STEP.nba;
  const total = g.odds?.overUnder ? Number(g.odds.overUnder) : DEF_TOTAL[grp];
  const sp = homeSpread(g) ?? 0, mu = -sp; // expected home margin
  const ladder = (center, step, n, neg = false) => { const base = halfOf(center), out = []; for (let k = -n; k <= n; k++) { const l = base + k * step; if (neg || l > 0.5) out.push(l); } return [...new Set(out)]; };
  const both = (mean, s, line) => { const p = normalOver(mean, s, line); return { line, over: fromProb(p), under: fromProb(1 - p) }; };
  const out = { totals: [], spreads: [], teamTotals: { home: [], away: [] } };
  if (total) {
    out.totals = ladder(total, st.tot, 3).map((l) => both(total, sd.tot, l));
    const mh = (total + mu) / 2, ma = (total - mu) / 2;
    out.teamTotals.home = ladder(mh, st.tt, 2).map((l) => both(mh, sd.tot * 0.7, l));
    out.teamTotals.away = ladder(ma, st.tt, 2).map((l) => both(ma, sd.tot * 0.7, l));
  }
  if (grp !== 'soccer' && homeSpread(g) != null) {
    out.spreads = ladder(sp, st.sp, 3, true).map((l) => { const p = normalOver(mu, sd.mar, -l); return { line: l, home: fromProb(p), away: fromProb(1 - p) }; });
  }
  return out;
}

const fmtSp = (n) => (n > 0 ? '+' : '') + n;
export const totalLeg = (g, dir, line, dec) => mkLeg(g, 'total', dir + line, `${dir === 'over' ? 'Over' : 'Under'} ${line} ${unitWord(grpOf(g.league))}`, dec, { t: 'total', dir, line });
export const spreadLeg = (g, side, line, dec) => mkLeg(g, 'spread', side + line, `${g[side].abbr} ${fmtSp(line)}`, dec, { t: 'spread', side, line });
export const teamTotalLeg = (g, side, dir, line, dec) => mkLeg(g, 'tt-' + side, dir + line, `${g[side].abbr} ${dir} ${line} ${unitWord(grpOf(g.league))}`, dec, { t: 'tt', side, dir, line });

/* ---------- first scorer ---------- */
export const FIRST = {
  nfl: { label: 'First touchdown scorer', short: 'first TD' },
  nhl: { label: 'First goal scorer', short: 'first goal' },
  nba: { label: 'First basket', short: 'first basket' },
};
export const hasFirst = (league) => !!FIRST[grpOf(league)];

/** How often a player scores, per game, from his season stat blocks. */
export function scoreRate(league, blocks) {
  const grp = grpOf(league);
  let r = 0;
  for (const b of blocks || []) {
    const L = b.labels.map((x) => String(x).toUpperCase());
    const at = (k) => { const i = L.indexOf(k); return i >= 0 ? numOf(b.values[i]) : null; };
    if (grp === 'nba') { const v = at('PTS'); if (v != null) return v; }
    else if (grp === 'nhl') { const g = at('G'), gp = at('GP'); if (g != null && gp) return g / gp; }
    else if (grp === 'nfl') {
      if (L.includes('CMP') || !(L.includes('CAR') || L.includes('REC'))) continue;
      const td = at('TD'), gp = at('GP');
      if (td != null && gp) r += td / gp;
    }
  }
  return r;
}

/** Price first scorer candidates for one team. players: [{id,name,short,pos,face}], rates: Map(id -> per game rate). */
export function scorerMarkets(g, side, players, rates) {
  const grp = grpOf(g.league);
  const fp = firstProbs(g)[side];
  const share = grp === 'nba' ? 0.95 : grp === 'nhl' ? 0.8 : 0.78;
  const weight = (r) => (grp === 'nba' ? r ** 1.4 : r);
  const rows = players.map((p) => ({ p, w: weight(rates.get(p.id) || 0) })).filter((x) => x.w > 0);
  const sum = rows.reduce((t, x) => t + x.w, 0);
  if (!sum) return [];
  return rows.sort((a, b) => b.w - a.w).slice(0, 6).map(({ p, w }) => ({
    teamId: g[side].id, playerId: p.id, name: p.name, short: p.short || p.name, pos: p.pos, face: p.face, stat: 'first', label: FIRST[grp].label, dec: fromProb(fp * share * (w / sum)),
  }));
}

export function firstLeg(g, m) {
  return mkLeg(g, 'firstp', nk(m.name), `${m.name} ${FIRST[grpOf(g.league)].short}`, m.dec, { t: 'firstp', name: m.name, playerId: m.playerId });
}

/* ---------- settlement ---------- */
function firstScoringPlay(league, plays) {
  const grp = grpOf(league);
  const list = (plays || []).filter((p) => p.scoring);
  if (grp === 'nfl') return list.find((p) => /touchdown/i.test(p.type || '') || /touchdown/i.test(p.text || ''));
  if (grp === 'nba') return list.find((p) => !/free throw/i.test(p.text || '') && !/free throw/i.test(p.type || ''));
  return list[0];
}
function scorerOf(p) {
  if (p.participants && p.participants[0]) return p.participants[0];
  const m = String(p.text || '').match(/^([A-Za-z.'\- ]+?)(?:\s+(?:makes|scores|\d|\())/);
  return m ? m[1] : '';
}
const sameName = (a, b) => {
  const x = nk(a), y = nk(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xs = x.split(' '), ys = y.split(' ');
  return xs[xs.length - 1] === ys[ys.length - 1] && xs[0][0] === ys[0][0];
};

const wentToOT = (g) => (g.period || 0) > (REG[grpOf(g.league)] || 99) || /\b(OT|overtime|shootout|SO)\b/i.test(g.detail || g.shortDetail || '');

function teamTurnovers(data, teamId) {
  const t = (data.box?.teams || []).find((x) => x.id === String(teamId));
  const st = t && t.stats.find((x) => /turnovers/i.test(x.label) && !/points|off/i.test(x.label));
  return st ? numOf(st.value) : null;
}

/** 'won' | 'lost' | 'push' | 'void' | 'pending' for a special leg. */
export function evalSpecial(leg, data) {
  const g = data.game;
  const hs = g.home.score ?? 0, as = g.away.score ?? 0;
  const sp = leg.sp;
  switch (sp.t) {
    case 'total': { const t = hs + as; return t === sp.line ? 'push' : (sp.dir === 'over') === (t > sp.line) ? 'won' : 'lost'; }
    case 'spread': { const mine = sp.side === 'home' ? hs : as, other = sp.side === 'home' ? as : hs; const d = mine + sp.line - other; return d === 0 ? 'push' : d > 0 ? 'won' : 'lost'; }
    case 'tt': { const v = sp.side === 'home' ? hs : as; return v === sp.line ? 'push' : (sp.dir === 'over') === (v > sp.line) ? 'won' : 'lost'; }
    case 'ot': return wentToOT(g) === sp.yes ? 'won' : 'lost';
    case 'btts': return (hs > 0 && as > 0) === sp.yes ? 'won' : 'lost';
    case 'first': {
      const p = (data.plays || []).find((x) => x.scoring);
      if (!p) return hs + as === 0 ? (sp.side === 'none' ? 'won' : 'lost') : 'void';
      const side = p.teamId === g.home.id ? 'home' : p.teamId === g.away.id ? 'away' : null;
      if (!side) return 'void';
      return side === sp.side ? 'won' : 'lost';
    }
    case 'firstp': {
      const p = firstScoringPlay(leg.league, data.plays);
      if (!p) return 'void';
      const who = scorerOf(p);
      if (!who) return 'void';
      return sameName(who, sp.name) ? 'won' : 'lost';
    }
    case 'to': {
      const a = teamTurnovers(data, g.away.id), h = teamTurnovers(data, g.home.id);
      const v = sp.scope === 'total' ? (a == null || h == null ? null : a + h) : sp.scope === 'home' ? h : a;
      if (v == null) return 'void';
      return v === sp.line ? 'push' : (sp.dir === 'over') === (v > sp.line) ? 'won' : 'lost';
    }
    default: return 'void';
  }
}
