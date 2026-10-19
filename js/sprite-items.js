// Every wearable, drawn as a small recipe on top of the shared body shapes (see sprite-art.js).
// Colours come from the item's colour choice, or from the team palette for team gear.
import { ART, HELP as H } from './sprite-art.js';

const { top, pants, shoes, outer, digits, dk, lt, FRONT, PATH, mix } = H;
const GOLD = '#F5C542', GOLD2 = '#B8860B', INK = '#14172B';
const band = (S, m, y0, y1, colour) => S.flat(S.and(m, S.rect(0, y0, 64, y1, false)), colour);
const R = 'raw';

/* ============================================================ TOPS */
const hood = (S, g, c, main) => { S.paint(S.sub(S.ell(30.8, 28.6, 6.6, 3.9), S.ell(30.4, 29.8, 3.9, 2.5)), dk(main, 0.1)); };
const strings = (S, tm) => { S.line(29, 31.5, 29, 38, '#D8D8D4', true, tm); S.line(32.2, 31.5, 32.6, 37, '#D8D8D4', true, tm); };
const ribCuff = (S, m, g, c, side, yEnd, main) => band(S, m, 48.2, 52, dk(main, 0.18));
const hoodie = (extra = {}) => top({
  sleeve: 'long', wide: 1.12, hem: 53, grow: 2.2, neck: 'scoop', collar: hood,
  cuff: (S, m, g, c, side, main) => band(S, m, 48.4, 52, dk(extra.base || '#666', 0.2)),
  detail: (S, tm, g, c, main) => {
    strings(S, tm);
    S.flat(S.and(tm, S.poly([[25.4, 44.4], [38.2, 44.4], [39.4, 50.4], [24.4, 50.4]])), dk(main, 0.13));
    S.line(25.4, 44.4, 38.2, 44.4, dk(main, 0.3), true, tm); S.line(31.8, 44.8, 31.8, 50, dk(main, 0.25), true, tm);
    band(S, tm, 51, 53.6, dk(main, 0.17));
    if (extra.detail) extra.detail(S, tm, g, c, main);
  },
  ...extra.o,
});

ART.top.tee = top({ sleeve: 'short', neck: 'crew', def: '#64748B' });
ART.top.tank = top({ sleeve: 'none', neck: 'tank', wide: 0.98 });
ART.top.boxy = top({ wide: 1.1, hem: 53.2, grow: 2.8, neck: 'crew', detail: (S, tm, g, c, m) => { S.line(24.4, 47, 25.4, 52.6, dk(m, 0.12), true, tm); S.line(39.4, 44, 39.6, 52.6, dk(m, 0.12), true, tm); } });
ART.top.graphic = top({
  sleeve: 'short', neck: 'crew',
  detail: (S, tm, g, c) => {
    S.flat(S.and(tm, S.ell(28.4, 40.4, 4.6, 4.6)), '#C8432E');
    S.line(24.6, 42, 32, 38.6, '#F1E9D8', true, tm); S.line(24.8, 43.2, 32.2, 39.8, '#F1E9D8', true, tm);
    S.line(24.4, 47.4, 33.4, 47.4, '#F1E9D8', true, tm); S.line(25.6, 49, 31.4, 49, '#9AA0A6', true, tm);
  },
});
ART.top.washed = hoodie({ base: '#3A3D44' });
ART.top.dressshirt = top({
  sleeve: 'long', neck: 'v', grow: 1.1,
  collar: (S, g, c, main) => { S.paint(S.poly([[26.2, 27.8], [30.2, 28.6], [30.6, 33.8], [27.6, 30]]), lt(main, 0.05)); S.paint(S.poly([[34.8, 27.8], [30.8, 28.6], [30.8, 33.4], [33.6, 30]]), lt(main, 0.05)); },
  detail: (S, tm) => { [36, 40, 44, 48].forEach((y) => S.dot(FRONT + 1, y, '#C9C5BA')); S.line(FRONT + 0.6, 34, FRONT + 1, 52, 'rgba(0,0,0,0)', true); },
  cuff: (S, m, g, c, side, main) => band(S, m, 49, 52, lt(main, 0.1)),
});
ART.top.turtleneck = top({
  sleeve: 'long', neck: 'none', grow: 1.2,
  collar: (S, g, c, main) => { S.paint(S.poly([[27.2, 22.6], [35.8, 22.6], [36.6, 29.4], [26.6, 29.4]], false), main); [24.2, 25.8, 27.4].forEach((y) => S.line(27, y, 36.2, y, dk(main, 0.2), false)); },
});
ART.top.foghoodie = hoodie({ base: '#7D8085', detail: (S, tm) => { S.flat(S.and(tm, S.rect(26, 36, 35.4, 38.4)), lt('#8E9196', 0.25)); } });
ART.top.techhood = top({
  sleeve: 'long', wide: 1.05, neck: 'scoop', collar: hood, grow: 1.4,
  cuff: (S, m, g, c, side, main) => band(S, m, 49.4, 52, dk(main, 0.22)),
  detail: (S, tm, g, c, main) => {
    S.line(FRONT - 0.4, 31, FRONT + 0.2, 52, '#2A2D33', true, tm); S.dot(FRONT - 0.4, 33, '#C9CED8');
    [[24.4, 38], [24.4, 40.4]].forEach(([x, y]) => { S.dot(x, y, 'rgba(0,0,0,0)'); });
    S.line(35.4, 38.4, 38.4, 37.4, '#2A2D33', true, tm);
    band(S, tm, 51, 53.6, dk(main, 0.2));
  },
});
ART.top.sixhood = hoodie({
  base: '#141418', detail: (S, tm, g, c, main) => {
    S.flat(S.and(tm, S.poly([[25.6, 35.2], [33, 35.2], [33, 41], [29.3, 44.4], [25.6, 41]])), GOLD);
    S.flat(S.and(tm, S.poly([[26.6, 36.2], [32, 36.2], [32, 40.6], [29.3, 43], [26.6, 40.6]])), '#141418');
    S.dot(29.2, 39, GOLD); S.dot(28.2, 38, GOLD); S.dot(29.2, 38, GOLD);
  },
});
ART.top.jersey = top({
  main: (p) => p.t1, sleeve: 'short', neck: 'v', wide: 1.03, grow: 1.7, lineAmt: 0.5,
  collar: (S, g, c, main) => { S.line(26.4, 28, 30.4, 33.8, c.pal.t2, true); S.line(34.8, 28, 30.4, 33.8, c.pal.t2, true); },
  cuff: (S, m, g, c, side) => band(S, m, 36.2, 39, c.pal.t2),
  detail: (S, tm, g, c) => { digits(S, '7', 28.2, 38, c.pal.tink); S.line(40.6, 33, 40, 51.6, c.pal.t2, true, tm); S.line(23.4, 34, 23.6, 51.6, c.pal.t2, true, tm); },
});
ART.top.swingman = top({
  main: (p) => p.t1, sleeve: 'none', neck: 'tank', wide: 1.0, lineAmt: 0.5,
  collar: (S, g, c) => { S.line(26.4, 28, 26.2, 31.4, c.pal.t2, true); S.line(26.2, 31.4, 30.4, 34.6, c.pal.t2, true); S.line(34.8, 28, 35, 31, c.pal.t2, true); S.line(35, 31, 30.4, 34.6, c.pal.t2, true); },
  detail: (S, tm, g, c) => { digits(S, '8', 28.2, 38, c.pal.tink); S.line(22.6, 33, 22.2, 51.6, c.pal.t2, true, tm); S.line(41, 33, 40.6, 51.6, c.pal.t2, true, tm); },
});
ART.top.polo = top({
  main: (p) => p.t1, sleeve: 'short', neck: 'crew', grow: 1.4,
  collar: (S, g, c, main) => { S.paint(S.poly([[26.4, 28], [30.2, 28.6], [29.8, 32.8]]), lt(main, 0.18)); S.paint(S.poly([[34.4, 28], [30.6, 28.6], [30.4, 32.6]]), lt(main, 0.18)); },
  detail: (S, tm, g, c) => { S.dot(FRONT + 0.4, 34.6, c.pal.tink); S.dot(FRONT + 0.4, 37.4, c.pal.tink); },
  cuff: (S, m, g, c) => band(S, m, 36.4, 38.8, c.pal.t2),
});
ART.top.hoodie = hoodie({
  base: '#333', o: { main: (p) => p.t1, cuff: (S, m, g, c) => band(S, m, 48.2, 51.8, c.pal.t2) },
  detail: (S, tm, g, c) => { band(S, tm, 51.2, 53.6, c.pal.t2); },
});
ART.top.ghost = (S, g, col, ph) => {
  if (ph !== 'near') return;
  const sheet = S.poly([[21.6, 31], [27, 27.6], [36.6, 27.6], [42, 30.6], [45.4, 42], [46.6, 58], [47.4, 72], [43.6, 70], [41, 74.6], [37, 71], [33.6, 75.4], [30, 71.4], [26.4, 75], [23.6, 70.6], [20.4, 73], [20.6, 58], [19.2, 42]]);
  S.paint(S.sub(sheet, S.ell(30.4, 28.4, 3.4, 2)), '#EDEBE6');
  S.line(27, 44, 26.4, 68, '#C9C6BF', true, sheet); S.line(36, 46, 37, 68, '#C9C6BF', true, sheet);
};

/* ============================================================ OUTER */
const lapels = (c1) => (S, g, c, main) => {
  S.paint(S.poly([[26.6, 28.4], [30.2, 29], [32.2, 40], [30.6, 41.6], [26.4, 34]]), c1 || dk(main, 0.12));
  S.paint(S.poly([[34.6, 28.4], [31, 29], [32.4, 38], [34.6, 34]]), c1 || dk(main, 0.12));
};
const buttons = (n, y0, colour) => (S, tm, g, c) => { for (let i = 0; i < n; i++) S.dot(FRONT + 2.4, y0 + i * 5, colour); };
ART.outer.denim = outer({ def: '#4F78B5', open: true, hem: 52, len: 51.6, wide: 1.07, collar: (S, g, c, main) => { S.paint(S.poly([[26.6, 28.4], [30.4, 29], [29.6, 33.2], [26.6, 31.2]]), dk(main, 0.1)); S.paint(S.poly([[34.4, 28.4], [31, 29], [32, 33]]), dk(main, 0.1)); },
  detail: (S, tm) => { S.flat(S.and(tm, S.rect(24.4, 38, 28.6, 41.2)), dk('#4F78B5', 0.18)); S.line(36.4, 36, 36.4, 41, dk('#4F78B5', 0.25), true, tm); band(S, tm, 50.4, 52.6, dk('#4F78B5', 0.15)); } });
ART.outer.flannel = outer({ def: '#9B2C2C', open: true, wide: 1.12, grow: 2.6, len: 54, collar: (S, g, c, main) => { S.paint(S.poly([[26.4, 28.2], [30.4, 29], [29.4, 33], [26.4, 31]]), dk(main, 0.15)); S.paint(S.poly([[34.6, 28.2], [31, 29], [32, 33]]), dk(main, 0.15)); },
  detail: (S, tm, g, c, main) => { for (const y of [33, 38, 43, 48, 53]) S.line(21, y, 44, y, dk(main, 0.22), true, tm); for (const x of [25, 29, 34, 38]) S.line(x, 30, x, 54, dk(main, 0.16), true, tm); },
  armDetail: (S, m, g, c, main) => { for (const y of [34, 40, 46]) S.line(18, y, 48, y, dk(main, 0.22), true, m); } });
ART.outer.bomber = outer({ def: '#4E5A3F', wide: 1.1, grow: 2.2, len: 53.6, hole: (S) => S.ell(30.6, 28.4, 3.6, 2.2),
  collar: (S, g, c, main) => { S.paint(S.sub(S.ell(30.8, 28.6, 5.6, 3.2), S.ell(30.4, 29.2, 3.4, 2)), dk(main, 0.35)); },
  detail: (S, tm, g, c, main) => { S.line(FRONT, 31, FRONT + 0.6, 52, '#C9C2A8', true, tm); band(S, tm, 51, 54, dk(main, 0.38)); S.flat(S.and(tm, S.rect(35.6, 36, 39.6, 40)), dk(main, 0.1)); S.dot(37, 38, '#E8772E'); },
  cuff: (S, m, g, c, side, main) => band(S, m, 49, 52, dk(main, 0.38)) });
ART.outer.leather = outer({ def: '#17171F', wide: 1.08, len: 53.2, collar: (S, g, c, main) => { S.paint(S.poly([[26.2, 28.2], [30.4, 29], [30, 34], [26.4, 31.4]]), lt(main, 0.1)); S.paint(S.poly([[34.8, 28.2], [31, 29], [31.4, 34]]), lt(main, 0.1)); },
  detail: (S, tm, g, c, main) => { S.line(FRONT + 0.4, 33, FRONT + 0.8, 52, '#8E8E96', true, tm); S.line(26, 36, 24.6, 44, lt(main, 0.25), true, tm); S.line(37, 38, 38.4, 46, lt(main, 0.18), true, tm); S.line(32.2, 44, 38, 44.6, lt(main, 0.18), true, tm); },
  armDetail: (S, m, g, c, main) => { S.line(43, 32, 44.4, 48, lt(main, 0.22), true, m); } });
ART.outer.puffer = outer({ def: '#2A3142', wide: 1.18, grow: 3.2, len: 56, hole: (S) => S.ell(30.6, 28.6, 3.2, 2),
  collar: (S, g, c, main) => { S.paint(S.sub(S.ell(30.8, 28.4, 6, 3.6), S.ell(30.4, 29, 3.4, 2.2)), lt(main, 0.04)); },
  detail: (S, tm, g, c, main) => { for (const y of [34, 39, 44, 49, 54]) S.line(20, y, 44, y, dk(main, 0.28), true, tm); S.line(FRONT, 31, FRONT + 0.8, 55, '#9AA0A6', true, tm); },
  armDetail: (S, m, g, c, main) => { for (const y of [36, 41, 46]) S.line(18, y, 48, y, dk(main, 0.28), true, m); },
  cuff: (S, m, g, c, side, main) => band(S, m, 49.4, 52, dk(main, 0.3)) });
ART.outer.parka = outer({ def: '#4F5A3A', wide: 1.16, grow: 3, len: 62, hole: (S) => S.ell(30.6, 28.8, 3.4, 2),
  collar: (S, g, c, main) => { S.paint(S.sub(S.ell(30.8, 28.4, 7.2, 4.4), S.ell(30.4, 29.4, 3.6, 2.4)), '#EDE7DA', { lineAmt: 0.4 }); },
  detail: (S, tm, g, c, main) => { S.line(FRONT, 32, FRONT + 1, 62, dk(main, 0.35), true, tm); S.flat(S.and(tm, S.rect(24, 48, 29.6, 53)), dk(main, 0.15)); S.flat(S.and(tm, S.rect(34, 48, 39.4, 53)), dk(main, 0.15)); band(S, tm, 59.4, 62, dk(main, 0.2)); } });
const suit = (def, lapC, btn) => outer({ def, wide: 1.05, grow: 1.5, len: 56.4, hole: (S) => S.poly([[27.4, 28.4], [33.8, 28.4], [31.2, 38], [29, 38]]),
  collar: lapels(lapC), detail: (S, tm, g, c, main) => { S.dot(FRONT + 1.4, 44, btn); S.dot(FRONT + 1.4, 49.4, btn); S.line(36, 36, 38.6, 35.6, dk(main, 0.4), true, tm); band(S, tm, 55, 56.6, dk(main, 0.12)); },
  cuff: (S, m, g, c, side, main) => band(S, m, 50, 51.8, dk(main, 0.1)) });
ART.outer.blazer = suit('#3A3E46', '#30343B', '#1A1C20');
ART.outer.suit = suit('#1E2B47', '#18233B', '#0E1424');
ART.outer.tux = suit('#121216', '#2C2C36', '#2C2C36');
const longcoat = (def, lap, btn) => outer({ def, wide: 1.1, grow: 2, len: 70, hole: (S) => S.poly([[27.4, 28.4], [33.8, 28.4], [31.2, 38], [29, 38]]),
  collar: lapels(lap), detail: (S, tm, g, c, main) => { [44, 51].forEach((y) => { S.dot(FRONT + 2, y, btn); S.dot(FRONT + 5, y, btn); }); S.line(FRONT + 1.2, 38, FRONT + 1.6, 70, dk(main, 0.3), true, tm); band(S, tm, 68, 70.4, dk(main, 0.1)); } });
ART.outer.overcoat = longcoat('#B98B58', '#A57A4A', '#5A3F22');
ART.outer.nocturne = longcoat('#141418', '#0E0E12', '#C9CED8');
ART.outer.track = outer({ main: (p) => p.t1, wide: 1.07, len: 52.8, grow: 1.9, lineAmt: 0.5,
  collar: (S, g, c) => { S.paint(S.sub(S.ell(30.8, 28.6, 5.2, 3), S.ell(30.4, 29.2, 3.2, 2)), c.pal.t2); },
  detail: (S, tm, g, c) => { S.line(FRONT, 31, FRONT + 0.8, 52, c.pal.tink, true, tm); S.line(23, 34, 23.4, 51, c.pal.tink, true, tm); S.line(40.8, 34, 40.4, 51, c.pal.tink, true, tm); band(S, tm, 50.6, 53, c.pal.t2); },
  armDetail: (S, m, g, c) => { S.line(43.6, 32, 44.8, 50, c.pal.tink, true, m); S.line(20.4, 32, 20.2, 50, c.pal.tink, true, m); }, cuff: (S, m, g, c) => band(S, m, 49, 52, c.pal.t2) });
ART.outer.varsity = outer({ main: (p) => p.t1, sleeveCol: () => '#E9E4D8', wide: 1.08, len: 53.2, grow: 2, lineAmt: 0.5,
  collar: (S, g, c) => { S.paint(S.sub(S.ell(30.8, 28.6, 5.2, 3), S.ell(30.4, 29.2, 3.2, 2)), c.pal.t2); },
  detail: (S, tm, g, c) => { S.line(FRONT, 31, FRONT + 0.8, 52, '#EDEDED', true, tm); band(S, tm, 51, 53.6, c.pal.t2); S.flat(S.and(tm, S.ell(25.4, 40, 2.6, 2.6)), c.pal.tink); },
  cuff: (S, m, g, c) => band(S, m, 49, 52, c.pal.t2) });
ART.outer.silkbomber = outer({ def: '#131318', wide: 1.1, grow: 2.2, len: 53.6,
  collar: (S, g, c, main) => { S.paint(S.sub(S.ell(30.8, 28.6, 5.6, 3.2), S.ell(30.4, 29.2, 3.4, 2)), '#7A1B2A'); },
  detail: (S, tm, g, c, main) => { S.line(FRONT, 31, FRONT + 0.6, 52, '#8E8E96', true, tm); band(S, tm, 51, 54, '#7A1B2A'); S.line(37, 36, 39.4, 38, GOLD, true, tm); S.line(37.4, 40, 38.8, 44, GOLD, true, tm); S.line(25, 34, 24, 44, lt('#131318', 0.22), true, tm); },
  cuff: (S, m) => band(S, m, 49, 52, '#7A1B2A') });
ART.outer.northgate = outer({ def: '#1F2633', wide: 1.2, grow: 3.4, len: 62, hole: (S) => S.ell(30.6, 28.8, 3.4, 2),
  collar: (S, g, c, main) => { S.paint(S.sub(S.ell(30.8, 28.4, 7.4, 4.6), S.ell(30.4, 29.4, 3.6, 2.4)), '#7A6650', { lineAmt: 0.45 }); },
  detail: (S, tm, g, c, main) => { S.line(FRONT, 32, FRONT + 1, 62, '#1A202B', true, tm); S.flat(S.and(tm, S.rect(24, 46, 29.6, 52)), '#1A202B'); S.flat(S.and(tm, S.rect(34, 46, 39.6, 52)), '#1A202B'); S.dot(40.4, 36, '#A61C22'); S.dot(41.4, 36, '#A61C22'); S.dot(40.4, 37, '#EDEDED'); band(S, tm, 59.6, 62, '#161B25'); } });
ART.outer.robe = outer({ def: '#6B3FA0', wide: 1.16, grow: 3.2, len: 74, hole: (S) => S.ell(30.6, 28.8, 3.6, 2.2),
  collar: (S, g, c, main) => { S.paint(S.sub(S.ell(30.8, 28.4, 7, 4.2), S.ell(30.4, 29.4, 3.6, 2.4)), '#F4EEDF', { lineAmt: 0.35 }); },
  detail: (S, tm, g, c, main) => { S.line(FRONT, 33, FRONT + 1.2, 74, '#F4EEDF', true, tm); S.line(FRONT - 1, 33, FRONT, 74, '#F4EEDF', true, tm); band(S, tm, 71.4, 74.2, '#F4EEDF'); S.dot(27, 54, GOLD); S.dot(34, 60, GOLD); S.dot(26, 66, GOLD); },
  cuff: (S, m) => band(S, m, 48.8, 52, '#F4EEDF') });
ART.outer.sixvarsity = outer({ def: '#141418', sleeveCol: () => '#E9E4D8', wide: 1.1, len: 53.4, grow: 2,
  collar: (S) => { S.paint(S.sub(S.ell(30.8, 28.6, 5.2, 3), S.ell(30.4, 29.2, 3.2, 2)), '#141418'); },
  detail: (S, tm) => { S.line(FRONT, 31, FRONT + 0.8, 52, 'rgba(0,0,0,0)', true); S.line(FRONT, 31, FRONT + 0.8, 52, '#E9E4D8', true, tm); band(S, tm, 51, 54, '#141418'); S.flat(S.and(tm, S.ell(25.6, 40, 2.8, 2.8)), GOLD); S.flat(S.and(tm, S.ell(25.6, 40, 1.8, 1.8)), '#141418'); },
  cuff: (S, m) => band(S, m, 49, 52, '#141418') });

/* ============================================================ BOTTOMS */
const hemLine = (S, m, y, colour) => S.line(0, y, 63, y, colour, false, m);
ART.bottom.jeans = pants({ end: 83.4, grow: 0.8, def: '#3A5A93', detail: (S, m, g, c, main, ph) => { band(S, m, 81.6, 83.6, dk(main, 0.12)); if (ph === 'nearleg') { S.line(36.4, 51.4, 36.6, 53, dk(main, 0.3), true, m); } } });
ART.bottom.joggers = pants({ end: 83, grow: 1.4, def: '#46546A', cuffEnd: (S, m, g, c, main) => band(S, m, 80.8, 84, dk(main, 0.22)), detail: (S, m, g, c, main, ph) => { if (ph === 'nearleg') S.line(34.4, 50.6, 33.6, 55, '#E5E9F0', true, m); } });
ART.bottom.shorts = pants({ end: 67, grow: 1.5, def: '#6B8FC9', detail: (S, m, g, c, main) => band(S, m, 65, 67.4, dk(main, 0.16)) });
const pocket = (S, m, ph, main) => { if (ph === 'nearleg') { S.flat(S.and(m, S.rect(34.8, 57, 41, 65)), dk(main, 0.15)); S.line(34.8, 57.6, 41, 57.6, dk(main, 0.35), true, m); } };
ART.bottom.cargo = pants({ end: 83, grow: 1.6, def: '#9C8B63', detail: (S, m, g, c, main, ph) => { pocket(S, m, ph, main); band(S, m, 81.2, 83.4, dk(main, 0.16)); } });
const stack = (S, m, main) => { [75.4, 78.6, 81.4].forEach((y) => S.line(0, y, 63, y, dk(main, 0.2), false, m)); };
ART.bottom.baggy = pants({ end: 84, grow: 3.4, flare: 0.6, def: '#4F6E9F', detail: (S, m, g, c, main, ph) => { stack(S, m, main); if (ph === 'nearleg') S.line(40.2, 52, 40.8, 80, lt(main, 0.1), true, m); } });
ART.bottom.jorts = pants({ end: 74, grow: 3.2, def: '#4F6E9F', detail: (S, m, g, c, main) => { band(S, m, 71.8, 74.2, lt(main, 0.18)); S.line(0, 69.6, 63, 69.6, dk(main, 0.2), false, m); } });
ART.bottom.parachute = pants({ end: 84, grow: 3.2, flare: -0.8, def: '#1E1F23', detail: (S, m, g, c, main, ph) => { stack(S, m, main); band(S, m, 80.6, 84.2, dk(main, 0.28)); if (ph === 'nearleg') { S.line(38, 54, 37.4, 76, lt(main, 0.22), true, m); S.line(35, 56, 34.8, 74, lt(main, 0.14), true, m); } } });
ART.bottom.bagcargo = pants({ end: 84, grow: 3.2, def: '#58613F', detail: (S, m, g, c, main, ph) => { if (ph === 'nearleg') { S.flat(S.and(m, S.rect(34.4, 58, 42, 69)), dk(main, 0.18)); S.line(34.4, 59, 42, 59, dk(main, 0.4), true, m); } stack(S, m, main); } });
ART.bottom.carpenter = pants({ end: 84, grow: 2.8, def: '#7A5A3A', detail: (S, m, g, c, main, ph) => { band(S, m, 65, 71, dk(main, 0.14)); if (ph === 'nearleg') S.flat(S.and(m, S.rect(41, 54, 42.4, 60)), '#C9A66B'); stack(S, m, main); } });
ART.bottom.flares = pants({ end: 84.4, grow: 1.2, flare: 4.4, def: '#2E3138', detail: (S, m, g, c, main) => { [78.4, 81.8].forEach((y) => S.line(0, y, 63, y, dk(main, 0.24), false, m)); } });
ART.bottom.techp = pants({ end: 83, grow: 1.5, def: '#22252C', detail: (S, m, g, c, main, ph) => { if (ph === 'nearleg') { S.line(34.6, 55, 38.6, 55, '#3A3F48', true, m); S.flat(S.and(m, S.rect(35, 58, 40, 64)), dk(main, 0.2)); } band(S, m, 80.4, 83.4, dk(main, 0.22)); } });
ART.bottom.leatherp = pants({ end: 83, grow: 0.6, def: '#15151B', detail: (S, m, g, c, main, ph) => { S.line(ph === 'nearleg' ? 34.6 : 24.6, 54, ph === 'nearleg' ? 34.4 : 24.8, 80, lt(main, 0.3), true, m); } });
const crease = (S, m, main, ph) => { S.line(ph === 'nearleg' ? 37.4 : 27.2, 52, ph === 'nearleg' ? 37 : 26.8, 82, lt(main, 0.18), true, m); };
ART.bottom.slacks = pants({ end: 83.4, grow: 0.9, def: '#6E737B', detail: (S, m, g, c, main, ph) => crease(S, m, main, ph) });
ART.bottom.suitp = pants({ end: 83.4, grow: 0.9, def: '#1E2B47', detail: (S, m, g, c, main, ph) => crease(S, m, main, ph) });
ART.bottom.tuxp = pants({ end: 83.4, grow: 0.9, def: '#121216', detail: (S, m, g, c, main, ph) => { crease(S, m, main, ph); S.line(ph === 'nearleg' ? 40.6 : 29.8, 52, ph === 'nearleg' ? 40.4 : 29.6, 82, '#34343E', true, m); } });
ART.bottom.fogsweats = pants({ end: 83, grow: 1.9, def: '#8E9196', cuffEnd: (S, m, g, c, main) => band(S, m, 80.4, 84, dk(main, 0.16)), detail: (S, m, g, c, main, ph) => { if (ph === 'nearleg') S.line(34.4, 50.6, 33.4, 56, '#D8D8D4', true, m); } });
ART.bottom.techjog = pants({ end: 83, grow: 1.4, def: '#8A8F96', cuffEnd: (S, m, g, c, main) => band(S, m, 80.6, 84, dk(main, 0.24)), detail: (S, m, g, c, main, ph) => { if (ph === 'nearleg') { S.line(34.4, 50.6, 33.6, 55, '#E5E9F0', true, m); S.line(39, 58, 41, 60, '#2A2D33', true, m); } } });
ART.bottom.goldpants = pants({ end: 83.4, grow: 1.2, def: GOLD, detail: (S, m, g, c, main, ph) => { S.line(ph === 'nearleg' ? 34.8 : 25, 52, ph === 'nearleg' ? 34.4 : 24.6, 80, lt(GOLD, 0.45), true, m); band(S, m, 81.4, 83.6, GOLD2); } });
ART.bottom.tshorts = pants({ main: (p) => p.t1, end: 66, grow: 1.9, lineAmt: 0.5, detail: (S, m, g, c, main, ph) => { band(S, m, 64.4, 66.4, c.pal.t2); S.line(ph === 'nearleg' ? 40 : 23.2, 52, ph === 'nearleg' ? 40.6 : 23.8, 65, c.pal.t2, true, m); } });
ART.bottom.trackp = pants({ main: (p) => p.t1, end: 83, grow: 1.5, detail: (S, m, g, c, main, ph) => { S.line(ph === 'nearleg' ? 40.4 : 23, 52, ph === 'nearleg' ? 40.2 : 23.4, 82, c.pal.tink, true, m); band(S, m, 80.8, 83.4, c.pal.t2); } });
const courtside = (body, panel, trim) => pants({ end: 70, grow: 2.6, def: body, detail: (S, m, g, c, main, ph) => {
  S.line(ph === 'nearleg' ? 40.8 : 23.4, 52, ph === 'nearleg' ? 41 : 23.2, 69, panel, true, m);
  S.line(ph === 'nearleg' ? 40 : 24.2, 52, ph === 'nearleg' ? 40.2 : 24, 69, panel, true, m);
  band(S, m, 68, 70.4, trim); if (ph === 'nearleg') S.dot(37, 60, GOLD);
}, bandCol: (p, main) => panel });
ART.bottom.cs_red = courtside('#B3202A', '#111114', '#F4F4F2');
ART.bottom.cs_purple = courtside('#4B2A7B', '#E0B43A', '#F4F4F2');
ART.bottom.cs_green = courtside('#1E6B45', '#F4F4F2', '#111114');
ART.bottom.cs_royal = courtside('#1F4FA8', '#F4F4F2', '#C8102E');

/* ============================================================ SHOES */
const laces = (S, far) => { const x = far ? 24.6 : 33.6; S.dot(x, 84.4, '#FFFFFF'); S.dot(x + 1.6, 85, '#FFFFFF'); S.dot(x - 1.4, 85.6, '#FFFFFF'); };
ART.shoes.sneakers = shoes({ def: '#F8FAFC', detail: (S, m, g, c, main, far) => { laces(S, far); S.line(far ? 21 : 30, 86.2, far ? 27 : 36, 86.2, dk(main, 0.12), true, m); } });
ART.shoes.runners = shoes({ def: '#9AA0A6', soleY: 87.2, detail: (S, m, g, c, main, far) => { laces(S, far); S.line(far ? 21 : 30, 85.6, far ? 28 : 37, 83.6, '#E8772E', true, m); } });
ART.shoes.slides = (S, g, col, ph, c) => {
  if (ph !== 'far' && ph !== 'near') return;
  const far = ph === 'far'; const foot = S.poly(far ? H.FOOT_F : H.FOOT_N);
  S.paint(S.sub(foot, S.rect(0, 0, 64, 85.6)), c.skin);
  S.paint(S.and(foot, S.rect(0, 88.4, 64, 90)), col || '#1F2937');
  S.flat(S.and(foot, S.rect(0, 86, 64, 88.4)), col || '#1F2937');
};
ART.shoes.boots = shoes({ def: '#7C4A21', high: 77, soleY: 88, sole: '#2A1A0E', detail: (S, m, g, c, main, far) => { [78.6, 80.8, 83].forEach((y) => S.line(far ? 25.6 : 35.4, y, far ? 28 : 37.8, y, '#2A1A0E', true, m)); band(S, m, 76, 78, lt(main, 0.1)); } });
ART.shoes.chunky = shoes({ def: '#EFEAE0', soleY: 86.4, sole: '#F7F4EE', detail: (S, m, g, c, main, far) => { laces(S, far); S.flat(S.and(m, S.rect(far ? 19 : 28, 85, far ? 24 : 33, 86.4)), '#A9B3C1'); S.line(far ? 22 : 31, 88, far ? 30 : 40, 88, '#C9C2B4', true, m); } });
const dress = (def, soleC, accent) => shoes({ def, soleY: 88.4, sole: soleC, detail: (S, m, g, c, main, far) => { if (accent) { S.dot(far ? 24 : 33, 85.2, accent); S.dot((far ? 24 : 33) + 1, 85.2, accent); } S.line(far ? 20 : 29, 87.4, far ? 28 : 37, 87.2, lt(main, 0.22), true, m); } });
ART.shoes.loafers = dress('#1A1A20', '#0E0E12', GOLD);
ART.shoes.oxfords = dress('#5A3820', '#2A1A0E', null);
ART.shoes.patent = dress('#0B0B0E', '#050507', null);
const v85 = (over) => shoes({ def: '#F4F4F2', high: 77, soleY: 87.8, sole: '#F4F1EA', detail: (S, m, g, c, main, far) => {
  S.flat(S.and(m, S.rect(far ? 19 : 28, 84.6, far ? 24 : 33, 90)), over); S.flat(S.and(m, S.rect(0, 76, 64, 79)), over);
  S.line(far ? 22 : 31, 87, far ? 27 : 36, 83, '#111114', true, m); laces(S, far);
} });
ART.shoes.v85red = v85('#B3202A'); ART.shoes.v85royal = v85('#1F4FA8'); ART.shoes.v85shadow = v85('#26282D');
ART.shoes.goldkicks = shoes({ def: GOLD, soleY: 87.4, sole: '#F4EBC8', detail: (S, m, g, c, main, far) => { laces(S, far); S.line(far ? 21 : 30, 86.4, far ? 28 : 37, 84.6, GOLD2, true, m); } });
ART.shoes.hightops = shoes({ main: (p) => p.t1, high: 77, soleY: 87.6, lineAmt: 0.5, detail: (S, m, g, c, main, far) => { band(S, m, 76, 78, c.pal.t2); S.flat(S.and(m, S.rect(far ? 19 : 28, 84.6, far ? 24 : 33, 90)), c.pal.t2); laces(S, far); } });
ART.shoes.retros = shoes({ main: (p) => p.tink, high: 77, soleY: 87.6, detail: (S, m, g, c, main, far) => { band(S, m, 76, 78, c.pal.t1); S.flat(S.and(m, S.rect(far ? 19 : 28, 84.6, far ? 24 : 33, 90)), c.pal.t1); S.line(far ? 22 : 31, 87, far ? 27 : 36, 83, c.pal.t2, true, m); } });

/* ============================================================ HAIR */
// Drawn big in head space, then the head shrinks. 'back' goes behind the head, 'front' on top of it.
const CAP = [[23.4, 17.6], [22.8, 12.4], [25.2, 8], [30.4, 5.8], [36, 6.2], [39.8, 9.4], [41, 14.4], [40.2, 19.8], [38.4, 15.4], [35.4, 12.4], [30.8, 12.2], [27.2, 13.8], [25, 17.4]];
const hairOf = (back, front) => (S, g, col, ph, c) => { if (ph === 'back' && back) back(S, c.hair, c); if (ph === 'front' && front) front(S, c.hair, c); };
const P = (S, pts, colour, o) => S.paint(S.poly(pts, false), colour, o);
const Lm = (S, pts) => S.limb(pts, false);
ART.hair.short = hairOf(null, (S, hc) => { P(S, CAP, hc); S.line(27, 8.6, 33, 7, lt(hc, 0.28), false); });
ART.hair.buzz = hairOf(null, (S, hc) => { P(S, [[24.4, 15.4], [24, 11.6], [26.2, 8.2], [30.8, 6.6], [35.6, 7], [39.2, 9.8], [40.4, 14.2], [39.6, 17.4], [38.2, 13.8], [35, 11.8], [30.8, 11.2], [27.4, 12.6], [25.6, 15.4]], hc, { flat: true, bands: 1 }); });
ART.hair.fade = hairOf(null, (S, hc) => {
  S.flat(S.poly([[23.6, 17.6], [23.4, 12.4], [25.8, 11.8], [25.8, 17.4]], false), hc, 110); S.flat(S.poly([[39.2, 18], [40.6, 13], [38.4, 11.6], [38.2, 17.4]], false), hc, 110);
  P(S, [[26, 13], [25.2, 8.4], [29.6, 5], [35.8, 5.4], [39.4, 8.6], [39.6, 13], [36.2, 11], [30.6, 10.2]], hc); S.line(27.4, 7.4, 34, 6.4, lt(hc, 0.3), false);
});
ART.hair.slick = hairOf(null, (S, hc) => { P(S, [[24, 17], [23.2, 11.6], [26, 7.4], [31, 5.4], [36.4, 5.4], [40.4, 9.4], [41.6, 15.6], [40.4, 19.6], [38.6, 14.6], [34, 11.2], [28.6, 11.6], [25.4, 14.6]], hc); S.line(26.6, 8.4, 36.4, 7, lt(hc, 0.32), false); S.line(28, 10, 34, 8.8, lt(hc, 0.2), false); });
ART.hair.curly = hairOf(null, (S, hc) => {
  const m = S.or(S.ell(25.6, 12, 3.6, 3.6, false), S.ell(28.8, 7.6, 4, 3.4, false), S.ell(34.2, 7, 4.2, 3.6, false), S.ell(38.8, 11, 3.4, 3.6, false), S.ell(24.4, 16, 2.2, 3, false), S.ell(31.8, 10.6, 6.6, 3, false), S.ell(39.6, 15.6, 2.2, 3.2, false));
  S.paint(m, hc); S.dot(28, 7.4, lt(hc, 0.3), false); S.dot(34, 6.6, lt(hc, 0.3), false);
});
ART.hair.afro = hairOf((S, hc) => { S.paint(S.ell(31.8, 11.2, 12, 10.4, false), hc); }, (S, hc) => { P(S, [[24.6, 15.4], [24, 10], [28, 6.8], [34, 6.4], [39, 9.6], [39.8, 15.4], [37.4, 12], [31.6, 10.6], [26.8, 12.2]], hc, { line: false }); S.dot(27, 6, lt(hc, 0.3), false); S.dot(33, 3.8, lt(hc, 0.3), false); });
ART.hair.bob = hairOf((S, hc) => { P(S, [[22.2, 12], [21.4, 23], [22.6, 28.6], [25.4, 28.8], [25.6, 16]], hc); P(S, [[40.2, 12], [41.8, 22], [41, 28.4], [37.6, 27.4], [38, 16]], hc); }, (S, hc) => { P(S, [[23.6, 16], [23, 11], [26, 7.2], [31, 5.6], [36.6, 6], [40.4, 9.6], [41, 15.4], [39.2, 13.4], [28.6, 13.6], [25, 16.4]], hc); S.line(27, 8.6, 34, 7.2, lt(hc, 0.3), false); });
ART.hair.long = hairOf((S, hc) => { P(S, [[22, 12], [19.8, 24], [20.2, 38], [24.6, 40.4], [25.8, 20]], hc); P(S, [[40.6, 12], [43.4, 24], [43.8, 38], [38.4, 40.4], [38.2, 20]], hc); }, (S, hc) => { P(S, [[23.6, 17], [22.4, 11], [25.6, 7], [31, 5.4], [36.6, 5.8], [41, 9.6], [42, 16.4], [40.4, 14.2], [34, 11.8], [28.4, 12.8], [25, 17.4]], hc); S.line(27, 8, 34, 6.6, lt(hc, 0.3), false); });
ART.hair.ponytail = hairOf((S, hc) => { S.paint(Lm(S, [[39, 10, 3.6], [43.4, 15, 3.8], [44.6, 23, 3.6], [43, 31, 2.4]]), hc); }, (S, hc) => { P(S, CAP, hc); S.dot(40.6, 11, '#C8432E', false); S.dot(40.6, 12, '#C8432E', false); });
ART.hair.bun = hairOf(null, (S, hc) => { S.paint(S.ell(34.4, 4.2, 3.4, 3, false), hc); P(S, CAP, hc); S.line(27, 8.6, 33, 7, lt(hc, 0.28), false); });
ART.hair.braids = hairOf((S, hc) => {
  S.paint(Lm(S, [[38, 14, 2.6], [41, 22, 2.6], [40.4, 32, 2.2], [41, 41, 2]]), hc); S.paint(Lm(S, [[39.6, 13, 2.6], [43.6, 20, 2.6], [43.4, 30, 2.2], [44.4, 39, 2]]), hc); S.paint(Lm(S, [[24.6, 15, 2.6], [22, 24, 2.6], [22.4, 33, 2.2], [22, 41, 2]]), hc);
}, (S, hc) => { P(S, CAP, hc); [[28, 8], [31, 7], [34, 7.4]].forEach(([x, y]) => S.line(x, y, x + 0.4, y + 4.6, dk(hc, 0.4), false)); });
ART.hair.twists = hairOf(null, (S, hc) => { P(S, [[24, 16], [23.4, 11.6], [26, 8.2], [31, 7], [36, 7.6], [39.6, 10], [40.6, 14.6], [39.4, 16.6], [36, 12.6], [30.8, 12], [26.6, 13.4]], hc); [[26, 8], [28.6, 5.6], [31.6, 4.6], [34.6, 5], [37.4, 6.6], [24.6, 11.4], [39.4, 9.4]].forEach(([x, y]) => S.paint(S.ell(x, y, 1.9, 1.9, false), hc)); });
ART.hair.mohawk = hairOf(null, (S, hc) => { S.flat(S.poly([[24, 15], [23.6, 12], [26, 9.4], [26, 14]], false), hc, 100); S.flat(S.poly([[39.6, 15], [40.6, 12], [38, 9.4], [38.6, 14]], false), hc, 100); P(S, [[27.4, 10.6], [28, 3.4], [31, 6.2], [32.4, 1.6], [35, 6], [36.8, 3.4], [37.2, 11], [32, 8.4]], hc); });
ART.hair.dreads = hairOf((S, hc) => {
  [[[25, 14, 2.6], [22, 26, 2.4], [22.6, 39, 2.2]], [[27, 12, 2.6], [25, 26, 2.4], [26, 41, 2.2]], [[36, 12, 2.6], [40.4, 26, 2.4], [40, 41, 2.2]], [[38.4, 13, 2.6], [43, 24, 2.4], [43.6, 38, 2.2]]].forEach((pts) => S.paint(Lm(S, pts), hc));
}, (S, hc) => { P(S, CAP, hc); });

/* ============================================================ HATS */
const dome = (S, hc, top = 4.8) => P(S, [[23.2, 16], [22.8, 11.4], [25.4, 7], [30.6, top], [36.2, top + 0.4], [40.4, 8.6], [41.6, 14], [40.6, 17], [37, 15], [30, 14.2], [25.6, 16.4]], hc);
const brim = (S, colour) => P(S, [[25, 14.6], [31, 13.8], [33.6, 15.4], [30.8, 17.8], [23.4, 19.2], [19.2, 18], [19, 16.4]], colour);
const capOf = (o) => (S, g, col, ph, c) => {
  if (ph !== 'head') return;
  const body = o.main ? o.main(c.pal, col) : (col || o.def);
  const bill = o.bill ? o.bill(c.pal, body) : dk(body, 0.14);
  dome(S, body); brim(S, bill);
  S.line(31, 5.4, 31.6, 14, dk(body, 0.16), false); S.dot(31.2, 5.2, lt(body, 0.2), false);
  if (o.extra) o.extra(S, body, c);
};
ART.hat.plaincap = capOf({ def: '#1C1C21' });
ART.hat.cap = capOf({ main: (p) => p.t1, bill: (p) => p.t2 });
ART.hat.snapback = capOf({ main: (p) => p.t1, bill: (p) => p.t2, extra: (S, body, c) => S.flat(S.poly([[24.4, 13.6], [38, 13], [39, 14.6], [25, 15.6]], false), c.pal.t2) });
ART.hat.trucker = capOf({ def: '#EFE9DC', bill: () => '#3A3F48', extra: (S, body, c) => { S.flat(S.poly([[33.6, 7], [39.6, 8.6], [41, 13.6], [36.6, 14]], false), '#3A3F48'); S.dot(36, 10, '#7A808A', false); S.dot(38, 12, '#7A808A', false); S.dot(37, 8.4, '#7A808A', false); S.flat(S.rect(26, 9.4, 30.6, 11.6, false), '#C8432E'); } });
ART.hat.beanie = (S, g, col, ph, c) => {
  if (ph !== 'head') return;
  P(S, [[22.8, 17.4], [22.2, 10.6], [25.4, 6], [31, 3.8], [37, 4.6], [41.4, 9], [42, 17], [38, 15.4], [30.6, 14.6], [25.6, 16.8]], c.pal.t1);
  P(S, [[22.6, 17.6], [22.4, 12.6], [30.6, 11.8], [41.8, 12.2], [42, 17.2], [38, 15.6], [30.6, 14.8], [25.6, 17]], c.pal.t2);
  S.paint(S.ell(31.8, 3, 2.8, 2.6, false), c.pal.tacc);
};
ART.hat.headband = (S, g, col, ph, c) => { if (ph === 'head') { P(S, [[23.2, 13.4], [40.4, 12.2], [40.6, 15.6], [23.6, 17]], c.pal.tink); S.line(24, 14.6, 40, 13.6, c.pal.t1, false); } };
ART.hat.durag = (S, g, col, ph, c) => {
  if (ph !== 'head') return;
  S.paint(Lm(S, [[39.4, 9, 3.2], [43.8, 13.4, 3.4], [46.4, 20, 2.8]]), c.pal.t1); S.paint(Lm(S, [[39.8, 10.6, 2.6], [44.4, 18, 2.8], [46, 26, 2.4]]), c.pal.t1);
  P(S, [[23.6, 17], [23.2, 11.6], [26, 7.8], [31, 6.2], [36.4, 6.6], [40.4, 10], [41.2, 15.4], [38.6, 13.8], [31, 12.6], [25.6, 15.2]], c.pal.t1); S.dot(40.2, 9, c.pal.t2, false);
};
ART.hat.bucket = (S, g, col, ph, c) => {
  if (ph !== 'head') return;
  P(S, [[24, 16], [23.6, 11.4], [26, 7.4], [31, 5.6], [36.4, 6], [40.2, 9], [41, 15]], c.pal.t1);
  S.paint(S.ell(31.8, 14.4, 11.8, 3.2, false), c.pal.t2);
};
ART.hat.helmet = (S, g, col, ph, c) => {
  if (ph !== 'head') return;
  P(S, [[22.4, 18.4], [21.6, 10.6], [25.4, 5.6], [31.6, 3.8], [38, 5.2], [42, 10.6], [42.4, 20.8], [40, 24.6], [36.4, 23.8], [37.2, 18.2], [30, 13.6], [25, 17]], c.pal.t1);
  S.line(31.6, 4.4, 31.8, 13.4, '#EDEDED', false);
  [[21.8, 17.4, 28.6, 20.4], [21.8, 20.4, 28.6, 23.2], [22.8, 23, 29.4, 25.4]].forEach(([x0, y0, x1, y1]) => S.line(x0, y0, x1, y1, '#C9CED8', false));
  S.line(24.6, 16.4, 25, 24.6, '#C9CED8', false);
};
ART.hat.monobucket = (S, g, col, ph, c) => {
  if (ph !== 'head') return;
  P(S, [[24, 16], [23.6, 11.4], [26, 7.4], [31, 5.6], [36.4, 6], [40.2, 9], [41, 15]], '#6B4A2E');
  S.paint(S.ell(31.8, 14.4, 11.8, 3.2, false), '#6B4A2E');
  [[27, 9], [31, 7.6], [35.4, 9], [29, 12], [33.4, 12], [37.6, 13], [24.6, 14.8], [30.8, 15.8], [38.4, 15.6], [27.4, 16], [34.6, 16.4]].forEach(([x, y]) => S.dot(x, y, '#D8B66A', false));
};
ART.hat.crown = (S, g, col, ph, c) => {
  if (ph !== 'head') return;
  P(S, [[24.4, 12], [24.8, 3.8], [28.4, 8], [31.8, 1.8], [35.2, 8], [38.8, 3.8], [39.4, 12]], GOLD);
  S.dot(31.8, 8.4, '#E03B3B', false); S.dot(27.2, 10, '#4FA3E0', false); S.dot(36.4, 10, '#4FA3E0', false); S.line(25, 11.4, 39, 11.4, GOLD2, false);
};

/* ============================================================ FACE (exact pixels: eyes sit at y 16-17) */
const lens = (S, colour, frame) => {
  const o = frame ? { line: frame, lineAmt: 0, flat: true } : { flat: true };
  S.paint(S.rect(24.8, 14.8, 27.8, 18, R), colour, o); S.paint(S.rect(29.4, 14.8, 34, 18.2, R), colour, o);
  S.line(28, 15, 29, 15, frame || colour, R); S.line(34.4, 15.4, 38, 16, frame || colour, R);
};
ART.face.shades = (S, g, col, ph) => { if (ph === 'head') { lens(S, '#101014'); S.dot(30.4, 15.4, '#5A5F6B', R); S.dot(25.6, 15.4, '#5A5F6B', R); } };
ART.face.aviators = (S, g, col, ph) => { if (ph === 'head') { lens(S, '#3B2A1A', GOLD); S.dot(30.4, 15.8, '#9A7A4A', R); } };
ART.face.ovalshades = (S, g, col, ph) => { if (ph === 'head') { S.paint(S.ell(26.4, 16.6, 1.8, 1.7, R), '#0D0D10', { flat: true }); S.paint(S.ell(31.8, 16.6, 2.6, 1.9, R), '#0D0D10', { flat: true }); S.line(28.2, 16, 29.2, 16, '#0D0D10', R); S.line(34.4, 16, 38, 16.4, GOLD, R); S.dot(30.6, 15.8, '#5A5F6B', R); } };
ART.face.glasses = (S, g, col, ph) => { if (ph === 'head') { [[26.4, 16.7, 2.2], [31.8, 16.7, 2.9]].forEach(([x, y, r]) => S.flat(S.sub(S.ell(x, y, r, 2.4, R), S.ell(x, y, r - 1, 1.4, R)), '#2A2A2A')); S.line(28.6, 16, 29.2, 16, '#2A2A2A', R); S.line(34.6, 16, 38, 16.4, '#2A2A2A', R); } };
ART.face.eyeblack = (S, g, col, ph) => { if (ph === 'head') { S.line(26, 18.4, 27, 18.4, '#16161B', R); S.line(30, 18.4, 32, 18.4, '#16161B', R); } };
ART.face.paint = (S, g, col, ph, c) => { if (ph === 'head') { S.line(35, 18, 38, 18, c.pal.t1, R); S.line(35, 19, 38, 19, c.pal.tink, R); S.line(35, 20, 38, 20, c.pal.t1, R); S.line(25, 18.6, 26, 18.6, c.pal.t1, R); S.line(25, 19.6, 26, 19.6, c.pal.tink, R); } };
ART.face.visor = (S, g, col, ph) => { if (ph === 'head') { S.paint(S.rect(24.4, 14.6, 38.6, 18, R), GOLD, { lineAmt: 0.4 }); S.line(25, 15.4, 36, 15.4, '#FFF3B0', R); } };
ART.face.grill = (S, g, col, ph) => { if (ph === 'head') { S.line(27, 22, 30, 22, GOLD, R); S.dot(28, 21, '#FFF3B0', R); } };

/* ============================================================ BEARD, EARS */
const stubbleMask = (S, hm) => { const m = S.and(hm.head, S.rect(24, 19, 40, 26, R)), o = S.mask(); const q = Math.max(1, Math.round(S.R * 0.5)); for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (m[y * S.w + x] && (Math.floor(x / q) + Math.floor(y / q)) % 2 === 0) o[y * S.w + x] = 1; return o; };
ART.beard.stubble = (S, g, col, ph, c) => { if (ph === 'head') S.flat(stubbleMask(S, c.hm), dk(c.hair, 0.1), 150); };
ART.beard.stache = (S, g, col, ph, c) => { if (ph === 'head') { S.line(26.6, 20.6, 30.6, 20.6, c.hair, R); S.line(27, 21.6, 30, 21.6, c.hair, R); S.dot(31.4, 20, c.hair, R); } };
ART.beard.goatee = (S, g, col, ph, c) => { if (ph === 'head') { S.flat(S.poly([[27.6, 22.8], [31.6, 22.8], [31, 26.4], [28.4, 26.4]], R), c.hair); S.line(26.6, 20.6, 30.6, 20.6, c.hair, R); } };
ART.beard.beard = (S, g, col, ph, c) => { if (ph === 'head') { S.flat(S.poly([[25.6, 19.6], [26, 22.8], [28.4, 26.2], [33, 26.6], [36.8, 24], [38.8, 19.6], [38.8, 16.6], [36.8, 19.8], [33.4, 21.6], [29.4, 21.4], [27, 20]], R), c.hair); S.line(27, 20.6, 31, 20.6, c.hair, R); } };
ART.ear.studs = (S, g, col, ph) => { if (ph === 'head') { S.dot(38, 19.4, '#FFFFFF', R); S.dot(38, 19.4, '#DDF1FF', R); } };
ART.ear.hoops = (S, g, col, ph) => { if (ph === 'head') S.flat(S.sub(S.ell(38.2, 21, 1.7, 1.9, R), S.ell(38.2, 21, 0.6, 0.9, R)), GOLD); };

/* ============================================================ NECKWEAR, CHAINS, WRISTS */
const need = (ph) => ph === 'mid';
ART.scarf.tie = (S, g, col, ph) => { if (!need(ph)) return; const c = col || '#6B1E2A'; S.paint(S.poly([[29, 29.6], [31.6, 29.6], [31.8, 32]]), dk(c, 0.1)); S.paint(S.poly([[29.4, 31.6], [31.8, 31.6], [32.6, 44], [30.6, 46.8], [28.8, 44]]), c); S.line(29.4, 38, 32, 36.4, lt(c, 0.25), true); S.line(29.2, 42, 32.4, 40.2, lt(c, 0.25), true); };
ART.scarf.bowtie = (S, g, col, ph) => { if (!need(ph)) return; S.paint(S.poly([[30.4, 29.8], [26.4, 27.8], [26.4, 31.8]]), '#121216'); S.paint(S.poly([[30.8, 29.8], [35, 27.8], [35, 31.8]]), '#121216'); S.paint(S.ell(30.6, 29.8, 1.6, 1.6), '#2A2A34'); };
const wrap = (S, a, b, tail, stripe) => { S.paint(S.sub(S.ell(30.8, 29.2, 7, 3.2), S.ell(30.4, 28.2, 3.6, 2)), a); S.paint(S.poly([[28.8, 31], [33.6, 31], [34.8, 45], [30, 47]]), a); if (stripe) { S.line(29.6, 38, 34.2, 38, stripe, true); S.line(29.8, 43, 34.6, 43, stripe, true); } };
ART.scarf.scarf = (S, g, col, ph, c) => { if (need(ph)) wrap(S, c.pal.t1, null, null, c.pal.t2); };
ART.scarf.goldscarf = (S, g, col, ph) => { if (need(ph)) wrap(S, GOLD, null, null, GOLD2); };
ART.scarf.monoscarf = (S, g, col, ph) => { if (!need(ph)) return; wrap(S, '#6B4A2E', null, null, null); [[26, 29], [31, 30.6], [35, 29], [31, 36], [32, 41]].forEach(([x, y]) => S.dot(x, y, '#D8B66A')); };
const chain = (S, colour, hi, thick) => {
  const pts = [[26.4, 29.4], [26.8, 32], [28.2, 34.4], [30.4, 35.6], [32.6, 34.4], [34.2, 32], [34.6, 29.4]];
  for (let i = 0; i < pts.length - 1; i++) { S.line(...pts[i], ...pts[i + 1], colour, true); if (thick) S.line(pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, dk(colour, 0.25), true); }
  if (hi) pts.forEach(([x, y], i) => { if (i % 2 === 0) S.dot(x, y, hi, true); });
};
ART.chain.silver = (S, g, col, ph) => { if (need(ph)) chain(S, '#C9CED8', '#FFFFFF', false); };
ART.chain.gold = (S, g, col, ph) => { if (need(ph)) chain(S, GOLD, '#FFF3B0', true); };
ART.chain.cuban = (S, g, col, ph) => { if (need(ph)) chain(S, GOLD, '#FFF3B0', true); };
ART.chain.tennis = (S, g, col, ph) => { if (need(ph)) chain(S, '#9AA8B8', '#FFFFFF', false); };
ART.chain.diamond = (S, g, col, ph) => { if (need(ph)) { chain(S, GOLD, '#FFFFFF', true); S.paint(S.poly([[30.4, 35.4], [32.4, 37.4], [30.4, 40], [28.4, 37.4]]), '#E8F6FF'); } };
ART.chain.pendant = (S, g, col, ph, c) => { if (need(ph)) { chain(S, '#C9CED8', null, false); S.paint(S.ell(30.4, 38, 2.2, 2.4), c.pal.tacc); S.dot(30, 37.4, c.pal.t1); } };
const wristAt = (S, strap, face, ring) => { S.paint(S.poly([[40.2, 48.4], [44.8, 49.2], [44.4, 52], [40.4, 51.4]]), strap); if (face) S.paint(S.ell(42.4, 50.2, 1.9, 1.8), face); if (ring) S.dot(42.4, 50.2, ring); };
ART.wrist.watch = (S, g, col, ph) => { if (ph === 'near') wristAt(S, '#1E1F23', '#3A6FB8', '#9CC7FF'); };
ART.wrist.dresswatch = (S, g, col, ph) => { if (ph === 'near') wristAt(S, '#3B2414', '#E8E6E0', '#1A1A1A'); };
ART.wrist.royalwatch = (S, g, col, ph) => { if (ph === 'near') wristAt(S, GOLD, '#123C7A', '#F5F5F5'); };
ART.wrist.goldwatch = (S, g, col, ph) => { if (ph === 'near') wristAt(S, GOLD, '#FFF3B0', '#fff'); };
ART.wrist.band = (S, g, col, ph, c) => { if (ph === 'near') { S.paint(S.poly([[40.2, 48.6], [44.8, 49.4], [44.4, 52.2], [40.4, 51.6]]), c.pal.t1); S.line(40.6, 50, 44.4, 50.6, c.pal.t2, true); } };

/* ============================================================ BACK and HAND */
ART.back.backpack = (S, g, col, ph, c) => {
  if (ph === 'back') { S.paint(S.poly([[38, 31], [47, 32.4], [48.6, 47], [45.6, 51], [38.4, 48.4]]), c.pal.t1); S.flat(S.poly([[43, 40], [47.6, 40.6], [47.6, 47], [43, 46.6]]), c.pal.t2); }
};
ART.back.cape = (S, g, col, ph, c) => {
  if (ph === 'back') { S.paint(S.poly([[24, 31], [40, 31], [47.4, 58], [45, 77], [41, 74], [37, 78], [33, 75], [29, 78], [25, 74], [20, 77], [17, 58]]), c.pal.t1, { lineAmt: 0.5 }); S.line(31.8, 33, 32.4, 75, dk(c.pal.t1, 0.3), true); S.line(19, 74, 45, 74, c.pal.t2, true); }
};
ART.back.trophycape = (S, g, col, ph) => {
  if (ph === 'back') { S.paint(S.poly([[24, 31], [40, 31], [47.4, 58], [45, 77], [41, 74], [37, 78], [33, 75], [29, 78], [25, 74], [20, 77], [17, 58]]), GOLD); S.line(31.8, 33, 32.4, 75, GOLD2, true); S.line(19, 74, 45, 74, '#FFF3B0', true); }
};
ART.back.wings = (S, g, col, ph) => {
  if (ph !== 'back') return;
  const wing = (m) => [[22.6, 33], [14, 24], [5, 25], [2, 34], [5, 44], [11, 51], [18, 50], [23, 45]].map(([x, y]) => [m ? 64 - x : x, y]);
  [false, true].forEach((m) => { S.paint(S.poly(wing(m), false ? 0 : 1 ? true : true), '#F4F0E6', { lineAmt: 0.45 }); });
  [[8, 30, 13, 40], [5, 36, 12, 45], [12, 28, 17, 38]].forEach(([x0, y0, x1, y1]) => { S.line(x0, y0, x1, y1, GOLD, true); S.line(64 - x0, y0, 64 - x1, y1, GOLD, true); });
};
ART.hand.ball = (S, g, col, ph) => { if (ph === 'near') { S.paint(S.ell(45.4, 58, 3.6, 3.6), '#D9822B'); S.line(41.8, 58, 49, 58, '#6B3A10', true); S.line(45.4, 54.4, 45.4, 61.6, '#6B3A10', true); } };
ART.hand.finger = (S, g, col, ph, c) => { if (ph === 'near') { S.paint(S.limb([[43.4, 50, 5], [44.4, 42, 3.6], [44.4, 35, 3]]), c.pal.t1); S.paint(S.ell(43, 52.6, 4.4, 3.4), c.pal.t1); S.dot(44.4, 34.4, c.pal.t2); S.dot(44.4, 35.4, c.pal.t2); } };
ART.hand.pennant = (S, g, col, ph, c) => { if (ph === 'near') { S.paint(S.limb([[44.8, 62, 1.6], [45.6, 36, 1.6]]), '#7C5A33'); S.paint(S.poly([[46.4, 36], [58, 40], [46.4, 45]]), c.pal.t1); S.line(46.8, 40.4, 56, 40.2, c.pal.t2, true); } };
ART.hand.trophy = (S, g, col, ph) => { if (ph === 'near') { S.paint(S.poly([[41.6, 42], [49.6, 42], [48.6, 48], [46.4, 50.4], [44.8, 50.4], [42.6, 48]]), GOLD); S.paint(S.rect(44, 50, 47, 54), GOLD2); S.paint(S.rect(42.4, 54, 48.6, 56.4), GOLD2); S.dot(43.6, 44, '#FFF3B0'); } };
ART.hand.duffel = (S, g, col, ph) => { if (ph === 'near') { S.line(43, 56, 47, 60, '#3B2A1A', true); S.paint(S.poly([[40, 60], [54, 60], [55.4, 72], [39, 72]]), '#6B4A2E'); [[43, 63], [48, 62.6], [52, 64], [44, 68], [50, 68.4]].forEach(([x, y]) => S.dot(x, y, '#D8B66A')); S.line(40, 62, 54.6, 62, '#3B2A1A', true); } };
