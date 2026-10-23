// Backgrounds: the scene behind the fan. Drawn first, in the fan's 200 x 340 design space, and made
// big enough to fill any full-body or bust view. The fan stands on a floor line at about y 250.
import { ART, curve, blob, poly } from './fan.js';

const X0 = -200, Y0 = -50, W = 600, H = 440, FLOOR = 250;
const uid = () => 'b' + Math.random().toString(36).slice(2, 8);
// a fixed pseudo-random sequence, so a scene looks the same every time it is drawn
const rng = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const vgrad = (stops) => { const id = uid(); return [id, `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient></defs>`]; };
const rgrad = (stops, cx = 0.5, cy = 0.5, r = 0.5) => { const id = uid(); return [id, `<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</radialGradient></defs>`]; };
const sky = (P, stops) => { const [id, defs] = vgrad(stops); P.add(defs + rect(X0, Y0, W, H, `url(#${id})`)); };
const glow = (P, x, y, rx, ry, col, op = 0.5) => { const [id, defs] = rgrad([[0, col, op], [1, col, 0]]); P.add(defs + `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${id})"/>`); };
const floor = (P, top, bottom, y = FLOOR) => { const [id, defs] = vgrad([[0, top], [1, bottom]]); P.add(defs + rect(X0, y, W, Y0 + H - y, `url(#${id})`)); };
const text = (t, x, y, size, fill, extra = '') => `<text x="${x}" y="${y}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}"${extra}>${String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const fit = (t, size, maxW) => (t.length * size * 0.74 > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '');
const bg = (f) => (P, g, col, ph, c) => { if (ph === 'bg') f(P, c, col); };

// ---- free
ART.bg.night = bg((P) => {
  sky(P, [[0, '#0B1020'], [0.6, '#1A2444'], [1, '#121830']]);
  glow(P, 100, 150, 120, 150, '#4A64B0', 0.45);
  floor(P, '#1C2340', '#0C1020');
  glow(P, 100, 312, 90, 22, '#6A84D0', 0.25);
});
ART.bg.dusk = bg((P) => {
  sky(P, [[0, '#2A2356'], [0.45, '#7A4C9E'], [0.75, '#E07A6A'], [1, '#F6B26B']]);
  glow(P, 100, 236, 70, 40, '#FFD9A0', 0.7);
  P.add(`<circle cx="100" cy="238" r="24" fill="#FFD27A" opacity="0.9"/>`);
  P.fill(`M${X0} 236 L-120 226 L-60 240 L-10 230 L30 238 L70 226 L120 236 L170 224 L210 236 L270 226 L330 240 L${X0 + W} 230 L${X0 + W} ${Y0 + H} L${X0} ${Y0 + H}Z`, '#2B1F3E');
  floor(P, '#3A2A4E', '#1E1630', 252);
});

// ---- team colours: a diagonal split with the city written large behind you
ART.bg.teamwall = bg((P, c) => {
  const p = c.pal;
  P.add(rect(X0, Y0, W, H, p.t1));
  P.fill(poly([[X0, 210], [X0 + W, 40], [X0 + W, 130], [X0, 300]]), p.t2);
  P.fill(poly([[X0, 300], [X0 + W, 130], [X0 + W, 140], [X0, 310]]), p.tacc, 0.9);
  const city = p.city || 'HOME';
  P.add(text(city, 100, 96, 54, p.tink, ` opacity="0.16"${fit(city, 54, 230)}`));
  glow(P, 100, 160, 110, 150, '#FFFFFF', 0.18);
  floor(P, 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.5)', 262);
});

// ---- venues
ART.bg.court = bg((P, c) => {
  sky(P, [[0, '#14161E'], [1, '#262A36']]);
  // seats and a lit band behind the baseline
  const r = rng(7);
  for (let row = 0; row < 7; row++) for (let i = 0; i < 50; i++) P.dot(-196 + i * 12 + (row % 2) * 6, 40 + row * 22, 3.4, ['#3A3F52', '#4A5066', '#2E3344'][Math.floor(r() * 3)]);
  P.add(rect(X0, 196, W, 18, c.pal.t1) + rect(X0, 214, W, 4, c.pal.t2));
  // hardwood with plank lines, the painted key in team colours
  floor(P, '#D9A066', '#B67A45', 218);
  for (let x = -200; x < 400; x += 9) P.stroke(`M${x} 218 L${100 + (x - 100) * 1.9} 400`, '#A96F3D', 0.8, 0.6);
  P.fill(poly([[64, 226], [136, 226], [160, 400], [40, 400]]), c.pal.t1, 0.85);
  P.stroke(curve([[-40, 400], [-6, 300], [40, 250], [100, 236], [160, 250], [206, 300], [240, 400]]), '#F4F1EA', 2.2);
  P.stroke(`M64 226 L40 400 M136 226 L160 400 M64 226 L136 226`, '#F4F1EA', 2.2);
});
ART.bg.rink = bg((P) => {
  sky(P, [[0, '#10131C'], [1, '#232838']]);
  const r = rng(11);
  for (let row = 0; row < 6; row++) for (let i = 0; i < 50; i++) P.dot(-196 + i * 12 + (row % 2) * 6, 40 + row * 22, 3.4, ['#3A3F52', '#4A5066', '#2E3344', '#5A3A44'][Math.floor(r() * 4)]);
  // glass, boards with a kick plate, then ice
  P.add(rect(X0, 150, W, 62, '#BFD6E8', ' opacity="0.18"'));
  for (let x = -178; x < 400; x += 46) P.stroke(`M${x} 150 L${x} 212`, '#DCE8F2', 1.2, 0.5);
  P.add(rect(X0, 212, W, 26, '#F2F4F6') + rect(X0, 234, W, 6, '#E8C33A') + rect(X0, 212, W, 2, '#9AA6B4'));
  floor(P, '#EEF5FA', '#CFE0EC', 240);
  P.add(rect(X0, 286, W, 6, '#C8102E', ' opacity="0.75"') + rect(X0, 262, W, 3, '#1D4E9E', ' opacity="0.6"'));
  P.stroke(`M${X0} 330 L${X0 + W} 330`, '#1D4E9E', 2.4, 0.4);
});
ART.bg.turf = bg((P) => {
  sky(P, [[0, '#0D1A2E'], [1, '#294A72']]);
  glow(P, -20, 40, 80, 60, '#FFFFFF', 0.35); glow(P, 220, 40, 80, 60, '#FFFFFF', 0.35);
  P.add(rect(X0, 186, W, 30, '#1B1F2A'));
  const r = rng(5);
  for (let i = 0; i < 130; i++) P.dot(-196 + r() * 592, 188 + r() * 26, 1.8, ['#C8102E', '#F4F1EA', '#3A4A6A'][Math.floor(r() * 3)], 0.8);
  floor(P, '#3E8E3A', '#2C6E2A', 216);
  for (let k = 0; k < 6; k++) P.fill(poly([[X0, 216 + k * 32], [X0 + W, 216 + k * 32], [X0 + W, 232 + k * 32], [X0, 232 + k * 32]]), '#4A9A44', 0.6);
  [-200, -120, -40, 20, 100, 180, 240, 320, 400].forEach((x) => P.stroke(`M${100 + (x - 100) * 0.55} 216 L${x} 400`, '#F4F1EA', 2, 0.85));
});
ART.bg.ballpark = bg((P) => {
  sky(P, [[0, '#3E86C8'], [1, '#A8D4F0']]);
  P.add(`<ellipse cx="30" cy="60" rx="34" ry="10" fill="#FFFFFF" opacity="0.7"/><ellipse cx="170" cy="40" rx="40" ry="11" fill="#FFFFFF" opacity="0.6"/>`);
  P.add(rect(X0, 170, W, 44, '#1F5A3A') + rect(X0, 170, W, 4, '#E8C33A'));
  ['375', '400', '375'].forEach((n, i) => P.add(text(n, 20 + i * 80, 200, 13, '#F4F1EA', ' opacity="0.85"')));
  floor(P, '#4FA04A', '#3A8A36', 214);
  for (let k = 0; k < 9; k++) P.fill(poly([[X0 + k * 70, 214], [X0 + k * 70 + 35, 214], [X0 + k * 70 + 5, 400], [X0 + k * 70 - 30, 400]]), '#5AB054', 0.5);
  P.fill(blob([[-200, 330], [-60, 290], [20, 262], [100, 254], [180, 262], [260, 290], [400, 330], [400, 400], [-200, 400]]), '#C08A5A');
});
ART.bg.locker = bg((P, c) => {
  sky(P, [[0, '#2A2F3A'], [1, '#3A4050']]);
  for (let i = 0; i < 15; i++) {
    const x = -196 + i * 40;
    P.shape(poly([[x, 20], [x + 36, 20], [x + 36, 220], [x, 220]]), '#4E5A6E', { line: '#22262E', w: 1.6 });
    P.fill(poly([[x + 4, 26], [x + 32, 26], [x + 32, 34], [x + 4, 34]]), '#3A4456');
    [44, 50, 56].forEach((y) => P.stroke(`M${x + 8} ${y} L${x + 28} ${y}`, '#2E3644', 1.6));
    P.dot(x + 30, 120, 2, '#A9B2C0');
    P.add(rect(x + 8, 70, 20, 10, c.pal.t1, ' opacity="0.9"'));
  }
  P.add(rect(X0, 220, W, 8, '#22262E'));
  floor(P, '#5A6070', '#3A3F4C', 228);
  P.shape(poly([[-200, 262], [400, 262], [400, 272], [-200, 272]]), '#8A6A48', { line: '#3A2A1A', w: 1.6 });
});
ART.bg.lights = bg((P) => {
  sky(P, [[0, '#05070F'], [0.7, '#141A30'], [1, '#1E2640']]);
  [[-30, 30], [230, 30]].forEach(([x, y]) => { glow(P, x, y, 90, 70, '#FFFFFF', 0.5); P.add(rect(x - 16, y - 8, 32, 16, '#EDEFF5') ); for (let i = 0; i < 4; i++) P.dot(x - 12 + i * 8, y, 2.4, '#FFFFFF'); P.stroke(`M${x} ${y + 8} L${x} 160`, '#2A2F40', 3); });
  const r = rng(19);
  for (let row = 0; row < 8; row++) for (let i = 0; i < 64; i++) P.dot(-196 + i * 9.4 + (row % 2) * 4.7, 110 + row * 13, 3, ['#2A3048', '#3A4260', '#4A5478', '#6A3A48', '#2E4A6A'][Math.floor(r() * 5)]);
  for (let i = 0; i < 50; i++) P.dot(-196 + r() * 592, 110 + r() * 100, 0.9, '#FFFFFF', 0.9);
  floor(P, '#2E6A34', '#1E4A24', 214);
  glow(P, 100, 300, 140, 40, '#FFFFFF', 0.12);
});
ART.bg.city = bg((P) => {
  sky(P, [[0, '#070A18'], [0.6, '#1A1E44'], [1, '#3A2E5A']]);
  P.add(`<circle cx="160" cy="34" r="12" fill="#F2EFE2"/><circle cx="165" cy="30" r="11" fill="#141938"/>`);
  const r = rng(23);
  for (let i = 0; i < 55; i++) P.dot(-196 + r() * 592, -40 + r() * 140, 0.8, '#FFFFFF', 0.4 + r() * 0.5);
  // two rows of buildings with lit windows; the tall tower is made up, not a real landmark
  let x = -200;
  while (x < 400) {
    const w = 18 + r() * 22, h = 70 + r() * 110, top = 240 - h, col = ['#141830', '#1A1F3A', '#202642'][Math.floor(r() * 3)];
    P.add(rect(x, top, w, h + 20, col));
    for (let wy = top + 6; wy < 232; wy += 9) for (let wx = x + 4; wx < x + w - 5; wx += 7) if (r() < 0.45) P.add(rect(wx, wy, 3.2, 4, '#F6D58A', ' opacity="0.85"'));
    x += w + 2;
  }
  P.add(rect(132, 40, 10, 200, '#1E2440') + rect(126, 120, 22, 10, '#1E2440'));
  P.stroke('M137 10 L137 40', '#C8CCD8', 1.4);
  floor(P, '#1A1E30', '#0C0E18', 240);
  for (let i = 0; i < 19; i++) P.add(rect(-190 + i * 32, 270, 18, 2, '#F6D58A', ' opacity="0.25"'));
});
ART.bg.jumbo = bg((P, c) => {
  const p = c.pal;
  sky(P, [[0, '#06070C'], [1, '#141824']]);
  // light beams
  [[-40, '#FFFFFF'], [240, '#FFFFFF'], [100, p.tacc]].forEach(([x, col]) => P.fill(poly([[x - 6, -50], [x + 6, -50], [100 + (x - 100) * 0.2 + 40, 260], [100 + (x - 100) * 0.2 - 40, 260]]), col, 0.08));
  // two video boards either side of your head: the city on one, a chant on the other
  const city = p.city || 'HOME';
  [[4, city], [142, "LET'S GO"]].forEach(([x, t]) => {
    P.shape(poly([[x, 6], [x + 54, 6], [x + 54, 50], [x, 50]]), '#0E1018', { line: '#3A3F52', w: 2.4 });
    P.add(rect(x + 3, 9, 48, 30, p.t1) + rect(x + 3, 39, 48, 8, p.t2));
    P.add(text(t, x + 27, 29, 11, p.tink, ` stroke="${p.tout || p.t2}" stroke-width="1" paint-order="stroke"${fit(t, 11, 42)}`));
    P.stroke(`M${x + 27} -50 L${x + 27} 6`, '#3A3F52', 2);
  });
  const r = rng(31);
  for (let row = 0; row < 9; row++) for (let i = 0; i < 64; i++) P.dot(-196 + i * 9.4 + (row % 2) * 4.7, 90 + row * 14, 3.2, [p.t1, p.t2, '#3A4260', '#2A3048', p.tacc][Math.floor(r() * 5)], 0.75);
  floor(P, '#2A2E3C', '#14161E', 220);
  glow(P, 100, 300, 120, 34, p.t1, 0.35);
});
ART.bg.confetti = bg((P) => {
  sky(P, [[0, '#2A1E06'], [0.5, '#6A4A10'], [1, '#2A1E06']]);
  glow(P, 100, 140, 150, 170, '#FFD86A', 0.55);
  [[-50, 0.12], [250, 0.12], [40, 0.08], [160, 0.08]].forEach(([x, op]) => P.fill(poly([[x - 8, -50], [x + 8, -50], [100 + (x - 100) * 0.3 + 30, 300], [100 + (x - 100) * 0.3 - 30, 300]]), '#FFF2C0', op));
  const r = rng(41), cols = ['#F4C542', '#FFE89A', '#FFFFFF', '#E0A92E', '#C8102E', '#2E6FD0'];
  for (let i = 0; i < 220; i++) {
    const x = -196 + r() * 592, y = -40 + r() * 380, a = Math.floor(r() * 180), w = 2 + r() * 3;
    P.add(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(w * 0.5).toFixed(1)}" fill="${cols[Math.floor(r() * cols.length)]}" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})" opacity="0.9"/>`);
  }
  floor(P, '#3A2A0A', '#1E1606', 250);
  glow(P, 100, 312, 110, 26, '#FFD86A', 0.4);
});

// rooftop at sunset: warm sky, low sun, skyline, a ledge to stand on
ART.bg.sunsetroof = bg((P) => {
  sky(P, [[0, '#5A3A7A'], [0.35, '#D8607A'], [0.65, '#F59A5A'], [1, '#FFD08A']]);
  glow(P, 100, 200, 110, 70, '#FFE2A8', 0.8);
  P.add(`<circle cx="100" cy="206" r="26" fill="#FFE9B8"/>`);
  const r = rng(41);
  let x = -200;
  while (x < 400) { const w = 16 + r() * 24, h = 20 + r() * 60; P.add(rect(x, 232 - h, w, h + 30, '#3A2448')); for (let wy = 232 - h + 5; wy < 228; wy += 9) for (let wx = x + 3; wx < x + w - 4; wx += 7) if (r() < 0.25) P.add(rect(wx, wy, 3, 4, '#FFD08A', ' opacity="0.8"')); x += w + 1; }
  floor(P, '#4A3A52', '#241A2E', 250);
  P.add(rect(X0, 246, W, 5, '#6A5870'));
  for (let i = 0; i < 12; i++) P.add(rect(-190 + i * 50, 264, 24, 2, '#FFD08A', ' opacity="0.18"'));
});
