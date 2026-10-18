// Win probability line with a replay cursor. Drawn as SVG, to scale.
import { s } from './ui.js';
import { LEAGUES } from './leagues.js';
import { colorDistance } from './util.js';

const W = 480, H = 230, L = 40, R = 14, T = 18, B = 30;

export function wpChart({ values, plays, game, swingList = [], index, onPick }) {
  const n = values.length;
  const x = (i) => L + (n <= 1 ? 0 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (1 - v) * (H - T - B);
  const mid = y(0.5);
  const homeC = game.home.color || '#2bd9ec';
  let awayC = game.away.color || '#ff4d66';
  if (colorDistance(homeC, awayC) < 70) awayC = '#ff4d66';

  const svg = s('svg', { class: 'wp', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Win chance for ${game.home.name} over the course of the game` });
  const uid = 'c' + Math.random().toString(36).slice(2, 7);
  svg.appendChild(s('defs', null,
    s('clipPath', { id: uid + 't' }, s('rect', { x: L, y: T, width: W - L - R, height: mid - T })),
    s('clipPath', { id: uid + 'b' }, s('rect', { x: L, y: mid, width: W - L - R, height: H - B - mid })),
  ));

  [1, 0.5, 0].forEach((v) => {
    svg.appendChild(s('line', { class: 'g' + (v === 0.5 ? ' mid' : ''), x1: L, x2: W - R, y1: y(v), y2: y(v) }));
  });
  svg.appendChild(s('text', { class: 'ax', x: L - 6, y: y(1) + 4, 'text-anchor': 'end' }, game.home.abbr));
  svg.appendChild(s('text', { class: 'ax', x: L - 6, y: y(0.5) + 4, 'text-anchor': 'end' }, '50%'));
  svg.appendChild(s('text', { class: 'ax', x: L - 6, y: y(0) + 4, 'text-anchor': 'end' }, game.away.abbr));

  // period boundaries
  const group = LEAGUES[game.league]?.group;
  const marks = [];
  for (let i = 1; i < plays.length; i++) if (plays[i].period != null && plays[i - 1].period != null && plays[i].period !== plays[i - 1].period) marks.push(i);
  if (marks.length <= 8 && group !== 'mlb') {
    marks.forEach((i) => {
      svg.appendChild(s('line', { class: 'pd', x1: x(i), x2: x(i), y1: T, y2: H - B }));
      const lab = (group === 'nhl' ? 'P' : 'Q') + plays[i].period;
      svg.appendChild(s('text', { class: 'ax', x: x(i) + 3, y: H - B + 14 }, lab));
    });
  }
  svg.appendChild(s('text', { class: 'ax', x: L, y: H - 6 }, 'Start'));
  svg.appendChild(s('text', { class: 'ax', x: W - R, y: H - 6, 'text-anchor': 'end' }, game.state === 'post' ? 'Final' : 'Now'));

  const line = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = `M${x(0).toFixed(1)} ${mid} ` + values.map((v, i) => 'L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ') + ` L${x(n - 1).toFixed(1)} ${mid} Z`;
  svg.appendChild(s('path', { d: area, fill: homeC, opacity: '0.5', 'clip-path': `url(#${uid}t)` }));
  svg.appendChild(s('path', { d: area, fill: awayC, opacity: '0.5', 'clip-path': `url(#${uid}b)` }));
  svg.appendChild(s('path', { class: 'ln', d: line }));

  swingList.slice(0, 1).forEach((sw) => {
    svg.appendChild(s('circle', { class: 'mk', cx: x(sw.i), cy: y(values[sw.i]), r: 5 }));
  });

  const cursor = s('line', { class: 'cur', y1: T, y2: H - B, x1: 0, x2: 0 });
  const dot = s('circle', { class: 'dot', r: 6, cx: 0, cy: 0 });
  svg.appendChild(cursor);
  svg.appendChild(dot);

  function setIndex(i) {
    const k = Math.max(0, Math.min(n - 1, i));
    cursor.setAttribute('x1', x(k)); cursor.setAttribute('x2', x(k));
    dot.setAttribute('cx', x(k)); dot.setAttribute('cy', y(values[k]));
  }
  setIndex(index ?? n - 1);

  let down = false;
  const pick = (ev) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (n - 1));
    onPick && onPick(Math.max(0, Math.min(n - 1, i)));
  };
  svg.addEventListener('pointerdown', (e) => { down = true; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } pick(e); });
  svg.addEventListener('pointermove', (e) => { if (down) pick(e); });
  svg.addEventListener('pointerup', () => { down = false; });
  svg.addEventListener('pointercancel', () => { down = false; });

  return { el: svg, setIndex };
}

/** A tiny line chart for cumulative points. */
export function sparkline(points, { width = 420, height = 110 } = {}) {
  const svg = s('svg', { class: 'spark', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Points over time' });
  if (points.length < 2) return svg;
  const max = Math.max(...points.map((p) => p.pts), 1);
  const x = (i) => 8 + (i * (width - 16)) / (points.length - 1);
  const y = (v) => height - 10 - (v / max) * (height - 24);
  const d = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.pts).toFixed(1)).join(' ');
  svg.appendChild(s('path', { class: 'sp-area', d: d + ` L${x(points.length - 1)} ${height - 10} L${x(0)} ${height - 10} Z` }));
  svg.appendChild(s('path', { class: 'sp-line', d }));
  svg.appendChild(s('circle', { class: 'sp-dot', cx: x(points.length - 1), cy: y(points[points.length - 1].pts), r: 4.5 }));
  svg.appendChild(s('text', { class: 'ax', x: width - 8, y: 12, 'text-anchor': 'end' }, max + ' pts'));
  return svg;
}
