// Where each player stands in the Lineups tab, for every sport. Pure functions, tested in Node.
// A spot is { p, x, y }: x and y are percentages of the drawing, x from the left edge, y from the top.

const up = (s) => String(s || '').toUpperCase().trim();
const lastName = (n) => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w.slice(1).join(' ') : w[0] || ''; };
export const shortName = (p) => p.short && !/^[A-Z]\.\s/.test(p.short) ? p.short : lastName(p.name);

/* ---------- soccer ---------- */
export function parseFormation(f) {
  const parts = String(f || '').split('-').map((n) => parseInt(n, 10));
  return parts.length >= 2 && parts.every((n) => n > 0 && n <= 6) ? parts : null;
}

const isKeeper = (p) => /^(G|GK)$/.test(up(p.pos)) || String(p.place) === '1';

/** How far up the pitch a position plays: 0 keeper, 2 back line, 6 striker. */
export function depthRank(pos) {
  const a = up(pos).replace(/-[LRC]$/, '');
  if (/^(G|GK)$/.test(a)) return 0;
  if (a === 'SW') return 1;
  if (/^(D|DF|CB|CD|LCB|RCB|LB|RB|LD|RD)$/.test(a)) return 2;
  if (/^(LWB|RWB|WB)$/.test(a)) return 2.5;
  if (/^(DM|CDM|LDM|RDM)$/.test(a)) return 3;
  if (/^(M|MF|CM|LM|RM|LCM|RCM)$/.test(a)) return 4;
  if (/^(AM|CAM|LAM|RAM)$/.test(a)) return 5;
  if (/^(LW|RW|W)$/.test(a)) return 5.5;
  if (/^(F|FW|CF|ST|S|LF|RF|LS|RS)$/.test(a)) return 6;
  return 4;
}

/** Where across the pitch a position plays, from the player's own view: -2 wide left, -1 left of centre, 0 middle, 1 and 2 to the right. */
export function sideOf(pos) {
  const a = up(pos);
  if (/-L$/.test(a) || /^LC/.test(a)) return -1;
  if (/-R$/.test(a) || /^RC/.test(a)) return 1;
  if (/^L[A-Z]/.test(a)) return -2;
  if (/^R[A-Z]/.test(a)) return 2;
  return 0;
}

function spread(n, i) {
  if (n === 1) return 0.5;
  const pad = n === 2 ? 0.3 : n === 3 ? 0.2 : 0.1;
  return pad + (1 - 2 * pad) * (i / (n - 1));
}

/**
 * Lines of a starting eleven from its formation, keeper first. Each spot gets l (0 own left, 1 own right)
 * and d (0 own goal line, 1 halfway line). Falls back to back/middle/front lines when the formation does not add up.
 */
export function soccerShape(starters, formation) {
  const list = (starters || []).map((p, i) => ({ p, i, rank: depthRank(p.pos), side: sideOf(p.pos), place: parseInt(p.place, 10) || 99 }));
  let gk = list.find((x) => isKeeper(x.p));
  const out = list.filter((x) => x !== gk).sort((a, b) => a.rank - b.rank || a.place - b.place || a.i - b.i);
  let counts = parseFormation(formation);
  if (!counts || counts.reduce((s, n) => s + n, 0) !== out.length) {
    const buckets = [out.filter((x) => x.rank < 3), out.filter((x) => x.rank >= 3 && x.rank < 5.5), out.filter((x) => x.rank >= 5.5)];
    counts = buckets.map((b) => b.length).filter(Boolean);
  }
  const lines = [];
  let at = 0;
  for (const n of counts) { lines.push(out.slice(at, at + n)); at += n; }
  const spots = [];
  if (gk) spots.push({ p: gk.p, l: 0.5, d: 0.05, line: 0 });
  lines.forEach((ln, k) => {
    ln.sort((a, b) => a.side - b.side || a.place - b.place || a.i - b.i);
    const d = lines.length === 1 ? 0.5 : 0.24 + 0.64 * (k / (lines.length - 1));
    ln.forEach((x, i) => spots.push({ p: x.p, l: spread(ln.length, i), d, line: k + 1 }));
  });
  return { lines: lines.map((ln) => ln.map((x) => x.p)), keeper: gk ? gk.p : null, spots, formation: counts.join('-') };
}

/** Put a shape on a full vertical pitch: home in the bottom half attacking up, away in the top half attacking down. */
export function pitchSpots(shape, half) {
  return shape.spots.map((s) => half === 'bottom'
    ? { p: s.p, x: +(s.l * 100).toFixed(1), y: +(100 - 2 - s.d * 46).toFixed(1) }
    : { p: s.p, x: +((1 - s.l) * 100).toFixed(1), y: +(2 + s.d * 46).toFixed(1) });
}

/** Goals, assists and cards per player name, counted from the play feed. Used when roster entries carry none. */
export function tallyFromPlays(plays) {
  const m = new Map();
  const bump = (name, k) => { if (!name) return; const t = m.get(name) || { goals: 0, assists: 0, yellow: 0, red: 0 }; t[k]++; m.set(name, t); };
  for (const p of plays || []) {
    const [who, helper] = p.participants || [];
    if (p.scoring && !/own goal/i.test(p.text || '')) { bump(who, 'goals'); bump(helper, 'assists'); }
    if (p.yellow) bump(who, 'yellow');
    if (p.red) bump(who, 'red');
  }
  return m;
}

/** A player's match events, taking the larger of what the roster entry and the play feed say. */
export function eventsFor(p, tally) {
  const t = (tally && tally.get(p.name)) || {};
  const e = p.events || {};
  return { goals: Math.max(e.goals || 0, t.goals || 0), assists: Math.max(e.assists || 0, t.assists || 0), yellow: Math.max(e.yellow || 0, t.yellow || 0), red: Math.max(e.red || 0, t.red || 0) };
}

/* ---------- baseball ---------- */
const DIAMOND = { P: [50, 66], C: [50, 92], '1B': [72, 60], '2B': [62, 45], SS: [38, 45], '3B': [28, 60], LF: [19, 27], CF: [50, 14], RF: [81, 27] };
export const basePos = (pos) => { const a = up(pos).split(/[-/]/)[0]; return /^(SP|RP|P)$/.test(a) ? 'P' : a; };

/**
 * Fielders on the diamond and the batting order. Players may carry batOrder and group ('batting' or 'pitching').
 * `pitcher` overrides the man on the mound, for example the probable starter before the game.
 */
export function diamond(players, pitcher = null) {
  const list = players || [];
  const taken = new Map();
  const mound = pitcher || list.find((p) => p.group === 'pitching') || list.find((p) => basePos(p.pos) === 'P');
  if (mound) taken.set('P', mound);
  for (const p of list) {
    if (p === mound || p.group === 'pitching') continue;
    const k = basePos(p.pos);
    if (DIAMOND[k] && !taken.has(k)) taken.set(k, p);
  }
  const spots = Object.entries(DIAMOND).filter(([k]) => taken.has(k)).map(([k, [x, y]]) => ({ p: taken.get(k), x, y, pos: k }));
  const batters = list.filter((p) => p.group !== 'pitching' && basePos(p.pos) !== 'P' || p.batOrder);
  const hasOrder = batters.some((p) => p.batOrder);
  const order = hasOrder ? [...batters].filter((p) => p.batOrder).sort((a, b) => a.batOrder - b.batOrder) : [];
  const placed = new Set(spots.map((s) => s.p));
  const extra = list.filter((p) => !placed.has(p) && !order.includes(p) && basePos(p.pos) !== 'P');
  return { spots, order, extra };
}

/* ---------- basketball ---------- */
const COURT = [['PG', 50, 80, 'G'], ['SG', 84, 56, 'G'], ['SF', 16, 56, 'F'], ['PF', 31, 27, 'F'], ['C', 67, 23, 'C']];
const hoopFamily = (pos) => { const a = up(pos); if (/^C|-C$/.test(a)) return 'C'; if (/F/.test(a)) return 'F'; if (/G/.test(a)) return 'G'; return ''; };

/** The starting five on a half court with the basket at the top. */
export function court(starters) {
  const five = (starters || []).slice(0, 5);
  const slot = new Map();
  const free = (p) => ![...slot.values()].includes(p);
  for (const [k] of COURT) { const p = five.find((x) => free(x) && up(x.pos) === k); if (p) slot.set(k, p); }
  for (const [k, , , fam] of COURT) { if (slot.has(k)) continue; const p = five.find((x) => free(x) && hoopFamily(x.pos) === fam); if (p) slot.set(k, p); }
  for (const [k] of COURT) { if (slot.has(k)) continue; const p = five.find(free); if (p) slot.set(k, p); }
  return COURT.filter(([k]) => slot.has(k)).map(([k, x, y]) => ({ p: slot.get(k), x, y, pos: k }));
}

/* ---------- football ---------- */
// [spot, x, y, family]. Offense attacks up the screen. The defense faces it, so its left side is on the screen's right.
const OFFENSE = [['QB', 50, 54, 'QB'], ['RB', 50, 80, 'RB'], ['FB', 50, 67, 'FB'], ['LWR', 7, 36, 'WR'], ['RWR', 93, 36, 'WR'], ['SWR', 14, 54, 'WR'],
  ['TE', 86, 54, 'TE'], ['LT', 24, 36, 'OT'], ['LG', 37, 36, 'OG'], ['C', 50, 36, 'C'], ['RG', 63, 36, 'OG'], ['RT', 76, 36, 'OT']];
const DEFENSE = [['LDE', 76, 68, 'DE'], ['RDE', 24, 68, 'DE'], ['LDT', 59, 68, 'DT'], ['RDT', 41, 68, 'DT'], ['NT', 50, 68, 'DT'],
  ['LOLB', 84, 40, 'LB'], ['ROLB', 16, 40, 'LB'], ['WLB', 68, 40, 'LB'], ['SLB', 32, 40, 'LB'], ['LILB', 59, 40, 'LB'], ['RILB', 41, 40, 'LB'], ['MLB', 50, 40, 'LB'],
  ['LCB', 93, 55, 'CB'], ['RCB', 7, 55, 'CB'], ['NB', 88, 26, 'CB'], ['SS', 37, 16, 'S'], ['FS', 63, 16, 'S']];
const FAMILY = { WR: ['WR'], LWR: ['WR'], RWR: ['WR'], SWR: ['WR'], HB: ['RB'], RB: ['RB'], FB: ['FB', 'RB'], TE: ['TE'], T: ['OT'], OT: ['OT'], LT: ['OT'], RT: ['OT'],
  G: ['OG'], OG: ['OG'], LG: ['OG'], RG: ['OG'], C: ['C'], OL: ['OT', 'OG', 'C'], QB: ['QB'],
  DE: ['DE'], LDE: ['DE'], RDE: ['DE'], EDGE: ['DE', 'LB'], DT: ['DT'], LDT: ['DT'], RDT: ['DT'], NT: ['DT'], DL: ['DE', 'DT'],
  LB: ['LB'], OLB: ['LB'], ILB: ['LB'], MLB: ['LB'], WLB: ['LB'], SLB: ['LB'], LOLB: ['LB'], ROLB: ['LB'], LILB: ['LB'], RILB: ['LB'],
  CB: ['CB'], LCB: ['CB'], RCB: ['CB'], NB: ['CB'], DB: ['CB', 'S'], S: ['S'], SS: ['S'], FS: ['S'], SAF: ['S'] };

/** Eleven men in their usual spots for one unit ('Offense' or 'Defense'). Names that do not fit go to extra. */
export function gridiron(players, unit) {
  const table = unit === 'Defense' ? DEFENSE : OFFENSE;
  const slot = new Map();
  const left = [...(players || [])];
  const take = (pred) => { const i = left.findIndex(pred); return i < 0 ? null : left.splice(i, 1)[0]; };
  for (const [k] of table) { const p = take((x) => up(x.pos).replace(/\d+$/, '') === k); if (p) slot.set(k, p); }
  for (const [k, , , fam] of table) {
    if (slot.has(k)) continue;
    const p = take((x) => (FAMILY[up(x.pos).replace(/\d+$/, '')] || []).includes(fam));
    if (p) slot.set(k, p);
  }
  const spots = table.filter(([k]) => slot.has(k)).map(([k, x, y]) => ({ p: slot.get(k), x, y, pos: k }));
  return { spots: spots.slice(0, 11), extra: [...spots.slice(11).map((s) => s.p), ...left] };
}

/* ---------- hockey ---------- */
/** Everyone dressed, split into forwards, defense and goalies. */
export function dressed(players) {
  const seen = new Set();
  const groups = { Forwards: [], Defense: [], Goalies: [] };
  for (const p of players || []) {
    const key = p.id || p.name;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = up(p.pos);
    const g = a === 'G' || /goal/i.test(p.group || '') ? 'Goalies' : a === 'D' || /^[LR]?D$/.test(a) || /defen/i.test(p.group || '') ? 'Defense' : 'Forwards';
    groups[g].push(p);
  }
  return Object.entries(groups).filter(([, ps]) => ps.length).map(([name, ps]) => ({ name, players: ps }));
}
