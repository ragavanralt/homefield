// Builds the "damn, he was good" recap card from a finished game's data.
// Pure functions. Every lookup is defensive because feed shapes differ per sport.
import { LEAGUES } from './leagues.js';
import { buildSeries, swings } from './winprob.js';
import { truncate } from './util.js';

const numIn = (s) => { const m = String(s ?? '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };
const pair = (s) => { const m = String(s ?? '').match(/(\d+)\s*[-/]\s*(\d+)/); return m ? [+m[1], +m[2]] : [0, 0]; };

function statMap(labels, stats) {
  const m = {};
  (labels || []).forEach((l, i) => { m[String(l).toUpperCase()] = stats ? stats[i] : undefined; });
  return m;
}

function allRows(box) {
  const out = [];
  for (const p of box?.players || []) {
    for (const g of p.groups || []) {
      for (const r of g.rows || []) {
        if (r.dnp || !r.stats || !r.stats.length) continue;
        out.push({ teamId: p.teamId, group: String(g.name || '').toLowerCase(), r, m: statMap(g.labels, r.stats) });
      }
    }
  }
  return out;
}

function person(row, big, sub, score) {
  return { id: row.r.id, name: row.r.name, face: row.r.face, jersey: row.r.jersey, pos: row.r.pos, teamId: row.teamId, big, sub, score };
}

function best(rows, fn) {
  let top = null;
  for (const row of rows) { const s = fn(row); if (s == null) continue; if (!top || s > top.s) top = { row, s }; }
  return top;
}

function ofText(fgText) { const [m, a] = pair(fgText); return a ? `${m} of ${a}` : ''; }
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function nbaPotg(rows) {
  const top = best(rows, ({ m }) => {
    if (m.PTS == null) return null;
    return numIn(m.PTS) + 1.2 * numIn(m.REB) + 1.5 * numIn(m.AST) + 2 * (numIn(m.STL) + numIn(m.BLK)) - 0.7 * numIn(m.TO);
  });
  if (!top) return null;
  const { m } = top.row;
  const pts = numIn(m.PTS), reb = numIn(m.REB), ast = numIn(m.AST);
  const fg = ofText(m.FG);
  const threes = pair(m['3PT'])[0];
  const big = `${pts} points${fg ? ' on ' + fg + ' shooting' : ''}`;
  const parts = [`${reb} rebounds`, `${ast} assists`];
  if (threes >= 4) parts.unshift(plural(threes, 'three'));
  const cats = [pts, reb, ast, numIn(m.STL), numIn(m.BLK)].filter((v) => v >= 10).length;
  const tag = cats >= 3 ? 'Triple-double' : cats === 2 ? 'Double-double' : '';
  const mates = rows.filter((x) => x.teamId === top.row.teamId && x !== top.row).map((x) => numIn(x.m.PTS));
  const second = mates.length ? Math.max(...mates) : 0;
  const quote = pts >= 25 && second ? `He scored ${pts} and the next best scorer on his team had ${second}. That was the game.` : tag ? `${tag} night. He filled every part of the box score.` : '';
  return { ...person(top.row, big, (tag ? tag + ' · ' : '') + parts.join(', '), top.s), quote };
}

function nhlPotg(rows, game) {
  const isGoalie = (m) => m.SA != null || m.GA != null || m.SV != null;
  const top = best(rows, ({ m, group }) => {
    if (isGoalie(m)) {
      const sa = numIn(m.SA), ga = numIn(m.GA), sv = m.SV != null ? numIn(m.SV) : sa - ga;
      if (sv < 15) return null;
      return sv * 0.12 + (ga === 0 ? 6 : 0) - ga * 1.4;
    }
    if (m.G == null && m.A == null) return null;
    return 4 * numIn(m.G) + 2.2 * numIn(m.A) + 0.25 * numIn(m.S) + 0.3 * numIn(m['+/-']);
  });
  if (!top) return null;
  const { m } = top.row;
  if (isGoalie(m)) {
    const sa = numIn(m.SA), ga = numIn(m.GA), sv = m.SV != null ? numIn(m.SV) : sa - ga;
    const big = ga === 0 ? `Shutout, ${sv} saves` : `${sv} saves on ${sa} shots`;
    return { ...person(top.row, big, ga === 0 ? 'Goalie, clean sheet' : `${ga} against`, top.s), quote: `${sv} saves kept the other team off the board when it mattered.` };
  }
  const g = numIn(m.G), a = numIn(m.A);
  const big = g >= 3 ? `Hat trick${a ? ' and ' + plural(a, 'assist') : ''}` : [g ? plural(g, 'goal') : '', a ? plural(a, 'assist') : ''].filter(Boolean).join(' and ') || 'Dominant shift work';
  const teamGoals = top.row.teamId === game.home.id ? game.home.score : game.away.score;
  const hand = g + a;
  const quote = hand >= 2 && teamGoals ? `He had a hand in ${hand} of his team's ${teamGoals} goals.` : '';
  return { ...person(top.row, big, `${numIn(m.S)} shots · ${numIn(m['+/-']) >= 0 ? '+' : ''}${numIn(m['+/-'])}`, top.s), quote };
}

function mlbPotg(rows, game) {
  const top = best(rows, ({ m, group }) => {
    if (group.includes('pitch') || m.IP != null) {
      const ip = numIn(m.IP);
      if (ip < 5) return null;
      return ip * 3 + numIn(m.K) - numIn(m.ER) * 3 - numIn(m.H) * 0.7 - numIn(m.BB) * 0.7;
    }
    if (m.AB == null && m['H-AB'] == null) return null;
    return numIn(m.H) * 2 + numIn(m.HR) * 5 + numIn(m.RBI) * 2 + numIn(m.R) - numIn(m.K) * 0.3;
  });
  if (!top) return null;
  const { m } = top.row;
  if (top.row.group.includes('pitch') || m.IP != null) {
    const ip = m.IP, er = numIn(m.ER), k = numIn(m.K);
    return { ...person(top.row, `${ip} innings, ${plural(k, 'strikeout')}`, `${plural(er, 'earned run')} · ${numIn(m.H)} hits`, top.s), quote: er <= 1 ? `He went ${ip} innings and gave up ${er === 0 ? 'nothing' : 'just one earned run'}.` : '' };
  }
  const [h, ab] = pair(m['H-AB'] ?? `${m.H}-${m.AB}`);
  const hr = numIn(m.HR), rbi = numIn(m.RBI);
  const sub = [hr ? plural(hr, 'home run') : '', rbi ? plural(rbi, 'RBI') : '', numIn(m.R) ? plural(numIn(m.R), 'run') : ''].filter(Boolean).join(', ');
  const teamRuns = top.row.teamId === game.home.id ? game.home.score : game.away.score;
  return { ...person(top.row, `${h} for ${ab}`, sub || 'Hit the ball hard all night', top.s), quote: rbi >= 2 && teamRuns ? `He drove in ${rbi} of his team's ${teamRuns} runs.` : '' };
}

function nflPotg(rows) {
  const top = best(rows, ({ m, group }) => {
    const yds = numIn(m.YDS), td = numIn(m.TD);
    if (group.includes('pass')) return yds / 25 + td * 4 - numIn(m.INT) * 3;
    if (group.includes('rush')) return yds / 10 + td * 6;
    if (group.includes('rec')) return yds / 10 + td * 6;
    return null;
  });
  if (!top) return null;
  const { m, group } = top.row;
  const yds = numIn(m.YDS), td = numIn(m.TD);
  const kind = group.includes('pass') ? 'passing' : group.includes('rush') ? 'rushing' : 'receiving';
  const big = `${yds} ${kind} yards${td ? ', ' + plural(td, 'touchdown') : ''}`;
  const sub = kind === 'passing' ? `${m['C/ATT'] || ''} · ${numIn(m.INT)} INT` : kind === 'rushing' ? `${numIn(m.CAR)} carries` : `${numIn(m.REC)} catches`;
  return { ...person(top.row, big, sub, top.s), quote: td >= 3 ? 'Three touchdowns. He did it all himself.' : yds >= 150 ? `${yds} yards is a monster number in this league.` : '' };
}

function soccerPotg(summary, game) {
  const goals = new Map();
  for (const p of summary.plays) {
    if (!p.scoring || !p.participants.length) continue;
    const who = p.participants[0];
    goals.set(who, { n: (goals.get(who)?.n || 0) + 1, teamId: p.teamId });
  }
  let top = null;
  for (const [name, v] of goals) if (!top || v.n > top.v.n) top = { name, v };
  if (!top) return null;
  const teamGoals = top.v.teamId === game.home.id ? game.home.score : game.away.score;
  const face = findFace(summary, top.name);
  return {
    id: '', name: top.name, face: face?.face || '', jersey: face?.jersey || '', pos: '', teamId: top.v.teamId,
    big: top.v.n >= 3 ? 'Hat trick' : plural(top.v.n, 'goal'),
    sub: 'Scorer',
    score: top.v.n,
    quote: top.v.n >= 2 && teamGoals ? `He scored ${top.v.n} of his team's ${teamGoals} goals.` : '',
  };
}

function findFace(summary, name) {
  for (const t of summary.lineups?.teams || []) for (const p of [...(t.starters || []), ...(t.bench || [])]) if (p.name === name) return p;
  for (const t of summary.leaders || []) for (const c of t.cats) if (c.who === name) return { face: c.face };
  return null;
}

export function playerOfTheGame(summary, game) {
  const group = LEAGUES[game.league]?.group;
  const rows = allRows(summary.box);
  try {
    if (group === 'nba') return nbaPotg(rows);
    if (group === 'nhl') return nhlPotg(rows, game);
    if (group === 'mlb') return mlbPotg(rows, game);
    if (group === 'nfl') return nflPotg(rows);
    if (group === 'soccer') return soccerPotg(summary, game);
  } catch (e) { /* fall through to no standout */ }
  return null;
}

export function whenLabel(p, league) {
  const group = LEAGUES[league]?.group;
  if (group === 'soccer') return p.clock || '';
  let per = p.periodLabel || (p.period ? String(p.period) : '');
  per = per.replace(/(\d)(st|nd|rd|th)\s+Quarter/i, 'Q$1').replace(/(\d)(st|nd|rd|th)\s+Period/i, 'P$1').replace(/Overtime/i, 'OT');
  if (group === 'mlb') return per;
  if (!/^[QP]\d|OT/.test(per) && p.period) per = (group === 'nhl' ? 'P' : 'Q') + p.period;
  return [per, p.clock].filter(Boolean).join(' ');
}

export function recapMoments(summary, game, series) {
  const plays = summary.plays;
  if (!plays.length) return [];
  const group = LEAGUES[game.league]?.group;
  let idx;
  if (group === 'soccer') {
    idx = plays.filter((p) => p.scoring || p.red).map((p) => p.i).slice(0, 4);
  } else {
    idx = swings(series.values, 3, 4).map((s) => s.i).sort((a, b) => a - b);
    if (!idx.length) idx = plays.filter((p) => p.scoring).map((p) => p.i).slice(-3);
  }
  return idx.map((i) => {
    const p = plays[i];
    const delta = i > 0 ? series.values[i] - series.values[i - 1] : 0;
    return { i, when: whenLabel(p, game.league), text: truncate(p.text, 96), delta };
  });
}

export function buildRecap(summary) {
  const game = summary.game;
  if (!game || game.state !== 'post') return null;
  const series = buildSeries(summary.plays, game, summary.wp);
  const potg = playerOfTheGame(summary, game);
  return {
    game,
    potg,
    moments: recapMoments(summary, game, series),
    quote: potg?.quote || '',
    estimated: series.estimated,
    series,
  };
}
