// Where each starter stands on the field, court, diamond or rink. Pure, so it can be tested.
// Every spot is { ...player, x, y } in percent of the drawing: x from the left, y from the top.

/* ---------- soccer ---------- */
// How far up the pitch a position plays: 0 keeper, 1 back line ... 5 strikers.
export function soccerRank(pos) {
  const p = String(pos || '').toUpperCase().replace(/-[LR]$/, '');
  if (p === 'G' || p === 'GK') return 0;
  if (/WB$/.test(p)) return 1.5;
  if (['D', 'CD', 'CB', 'SW', 'LB', 'RB', 'LCB', 'RCB'].includes(p)) return 1;
  if (p === 'DM' || p === 'CDM') return 2;
  if (p === 'AM' || p === 'CAM' || p === 'LAM' || p === 'RAM') return 4;
  if (['F', 'CF', 'ST', 'LF', 'RF', 'LW', 'RW', 'SS'].includes(p)) return 5;
  if (['M', 'CM', 'LM', 'RM', 'LCM', 'RCM'].includes(p)) return 3;
  return 3;
}
// Which side of the pitch, from the team's own point of view: 0 wide left, 1 left of centre, 2 middle, 3 right of centre, 4 wide right.
export function soccerSide(pos) {
  const p = String(pos || '').toUpperCase();
  if (/^L(B|WB|M|W|F|AM)$/.test(p)) return 0;
  if (/^R(B|WB|M|W|F|AM)$/.test(p)) return 4;
  if (/-L$/.test(p) || /^L(CB|CM)$/.test(p)) return 1;
  if (/-R$/.test(p) || /^R(CB|CM)$/.test(p)) return 3;
  return 2;
}
export const parseFormation = (f) => {
  const n = String(f || '').split('-').map((x) => parseInt(x, 10));
  return n.length > 1 && n.every((x) => x > 0) ? n : null;
};

/** Split starters into a keeper and lines (back line first), each line left to right from the team's view. */
export function soccerLines(starters, formation) {
  const all = [...(starters || [])];
  const gkIdx = all.findIndex((p) => soccerRank(p.pos) === 0);
  const gk = gkIdx >= 0 ? all.splice(gkIdx, 1)[0] : null;
  const order = (a, b) => soccerRank(a.pos) - soccerRank(b.pos) || (a.place || 99) - (b.place || 99);
  const out = all.sort(order);
  const shape = parseFormation(formation);
  let lines;
  if (shape && shape.reduce((s, x) => s + x, 0) === out.length) {
    lines = [];
    let i = 0;
    for (const n of shape) { lines.push(out.slice(i, i + n)); i += n; }
  } else { // no usable formation: one line per kind of position
    const by = new Map();
    for (const p of out) { const r = soccerRank(p.pos); if (!by.has(r)) by.set(r, []); by.get(r).push(p); }
    lines = [...by.keys()].sort((a, b) => a - b).map((k) => by.get(k));
  }
  lines = lines.map((l) => [...l].sort((a, b) => soccerSide(a.pos) - soccerSide(b.pos) || (a.place || 99) - (b.place || 99)));
  return { gk, lines };
}

/** Spots for one team on a vertical pitch. The bottom team attacks up, the top team attacks down. */
export function soccerSpots(starters, formation, half) {
  const { gk, lines } = soccerLines(starters, formation);
  const top = half === 'top';
  const y = (d) => (top ? d : 100 - d); // d: distance from this team's own goal line
  const spots = [];
  if (gk) spots.push({ ...gk, x: 50, y: y(5) });
  const n = lines.length;
  lines.forEach((line, li) => {
    const d = n === 1 ? 28 : 14 + (li * (28 / (n - 1))); // keep the front line clear of the other team's
    line.forEach((p, i) => {
      const x = ((i + 1) / (line.length + 1)) * 100;
      spots.push({ ...p, x: top ? 100 - x : x, y: y(d) }); // facing down, the team's left is the screen's right
    });
  });
  return spots;
}

/* ---------- baseball ---------- */
const DIAMOND = { P: [50, 60], C: [50, 90], '1B': [74, 56], '2B': [63, 39], SS: [37, 39], '3B': [26, 56], LF: [18, 20], CF: [50, 9], RF: [82, 20] };
export const mlbPos = (pos) => { const p = String(pos || '').toUpperCase().split(/[-/]/)[0]; return p === 'SP' || p === 'RP' ? 'P' : p; };

/** Fielders on the diamond plus the batting order. Batters come in lineup order; the pitcher may only be in pitching rows. */
export function mlbSpots(batters, pitcher) {
  const spots = [];
  const used = new Set();
  const put = (p, pos) => { if (!p || used.has(pos) || !DIAMOND[pos]) return false; used.add(pos); spots.push({ ...p, pos, x: DIAMOND[pos][0], y: DIAMOND[pos][1] }); return true; };
  if (pitcher) put(pitcher, 'P');
  const extra = [];
  for (const b of batters || []) if (!put(b, mlbPos(b.pos))) extra.push(b); // DH and anyone without a field spot
  return { spots, order: [...(batters || [])], extra };
}

/* ---------- basketball ---------- */
const COURT = [[50, 24], [83, 42], [17, 42], [68, 70], [32, 72]]; // point, wing, wing, high post, low post (basket at the bottom)
const hoopRank = (pos) => ({ PG: 0, G: 1, SG: 1.5, GF: 2, SF: 2.5, F: 3, PF: 3.5, FC: 4, C: 5 })[String(pos || '').toUpperCase()] ?? 3;
export function nbaSpots(starters) {
  const five = [...(starters || [])].slice(0, 5).map((p, i) => ({ p, i })).sort((a, b) => hoopRank(a.p.pos) - hoopRank(b.p.pos) || a.i - b.i).map((x) => x.p);
  return five.map((p, i) => ({ ...p, x: COURT[i][0], y: COURT[i][1] }));
}

/* ---------- hockey ---------- */
export const hockeyRole = (pos) => { const p = String(pos || '').toUpperCase(); return p === 'G' ? 'G' : p === 'D' ? 'D' : 'F'; };
/** The starting six on a half rink (own net at the bottom): three forwards, two defence, one goalie. */
export function nhlSpots(starters) {
  const by = { F: [], D: [], G: [] };
  for (const p of starters || []) by[hockeyRole(p.pos)].push(p);
  const wing = (p) => ({ LW: 0, L: 0, C: 1, RW: 2, R: 2 })[String(p.pos || '').toUpperCase()] ?? 1;
  const F = by.F.slice(0, 3).sort((a, b) => wing(a) - wing(b));
  const spots = [];
  const fx = F.length === 3 ? [20, 50, 80] : F.length === 2 ? [32, 68] : [50];
  F.forEach((p, i) => spots.push({ ...p, x: fx[i], y: 22 }));
  const D = by.D.slice(0, 2);
  const dx = D.length === 2 ? [32, 68] : [50];
  D.forEach((p, i) => spots.push({ ...p, x: dx[i], y: 56 }));
  if (by.G[0]) spots.push({ ...by.G[0], x: 50, y: 86 });
  return spots;
}

/** Last name, or the whole thing if it is one word. Labels on the drawings are small. */
export const shortName = (n) => { const parts = String(n || '').trim().split(/\s+/); return parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || ''; };
