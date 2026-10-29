// The October 2026 clothing drop: shoes, hats and accessories (part 1). Every piece is built from the shared parts in fan-items.js.
// Original designs only: no real logos, marks or brand names. The looks come from what people are wearing right now.
import { ART, ramp, dk, lt, mix, curve, blob, poly, CX, OW } from './fan.js';
import { top, outer, pants, hoodie, lapels, shirtCollar, ribCollar, buttons, zip, pockets2, hem, hemLine, knee, cargoPocket, pocketsJ, jeanDetail, shortsDetail, hood, pocket, bodyShade, shoes, held, rightHand, onWrist, wrapScarf, chain, lenses, EYES, capDome, capBill, GOLD, GOLD2, GOLDHI, SILVER, SILVER2, INK, both } from './fan-items.js';

const lum = (h) => { const n = parseInt(String(h).slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
export const contrast = (h) => (lum(h) > 0.55 ? '#26303F' : '#F2EFE8');
const side3 = (colr, w = 1.5) => (P, c, R, m, ax, ay, side, tx) => [0, 3.2, 6.4].forEach((d) => P.stroke(curve([[tx + 9 * side, ay + 4 + d], [tx + 14 * side, ay + 8 + d]]), colr, w));

/* ------------------------------------------------------------------ shoes */
ART.shoes.terrace = shoes({ def: '#2F5D3A', sole: '#C9A66B', soleH: 4, wide: 0.98, laces: 3, laceCol: '#F2EFE8', detail: (P, c, R, m, ax, ay, side, tx) => { side3('#F2EFE8')(P, c, R, m, ax, ay, side, tx); P.stroke(curve([[tx - 5, ay + 20], [tx, ay + 21], [tx + 5, ay + 20]]), '#E8DFC6', 2.4); } });
ART.shoes.skatelow = shoes({ def: '#26272B', sole: '#F2EFE8', soleH: 6.5, wide: 1.13, laces: 4, laceCol: '#E8E6E0', detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx - 7, ay + 1.5], [tx, ay - 1], [tx + 7, ay + 1.5]]), R.hi, 2.8); P.stroke(curve([[tx + 7 * side, ay + 15], [tx + 13 * side, ay + 9]]), '#F2EFE8', 2.2); } });
ART.shoes.retrorun = shoes({ def: '#9AA0A6', sole: '#F4F2EC', soleH: 6, wide: 1.04, laces: 3, laceCol: '#2A2A2A',
  inner: (c, R, main, ax, ay, side, tx) => `<path d="${blob([[tx - 15, ay + 12.5], [tx + 15, ay + 12.5], [tx + 14, ay + 24], [tx - 14, ay + 24]])}" fill="${dk(main, 0.32)}"/><path d="${blob([[ax - 10, ay - 8], [ax + 10, ay - 8], [ax + 10, ay + 1], [ax - 10, ay + 1]])}" fill="#E36414"/>`,
  detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx + 6 * side, ay + 13], [tx + 11 * side, ay + 8], [tx + 14 * side, ay + 10]]), '#F2EFE8', 1.8); [-9, -3, 3, 9].forEach((dx) => P.dot(tx + dx, ay + 17, 0.7, '#F2EFE8')); } });
ART.shoes.combat = shoes({ def: '#1B1B1F', h: 15, sole: '#0E0E10', soleH: 6.5, wide: 1.1, laces: 6, laceCol: '#C9C3B4', detail: (P, c, R, m, ax, ay, side, tx) => { [-10, -4, 2, 8].forEach((dx) => P.stroke(`M${tx + dx} ${ay + 21.5} l2 0`, '#3A3A40', 1.4)); P.stroke(curve([[ax - 8, ay - 12], [ax, ay - 10], [ax + 8, ay - 12]]), R.hi, 1.4, 0.8); } });
ART.shoes.hikers = shoes({ def: '#8A7A5E', h: 13, sole: '#3A3A3E', soleH: 7, wide: 1.1, laces: 5, laceCol: '#E36414', detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx - 13, ay + 17], [tx, ay + 14], [tx + 13, ay + 17]]), '#3A3A3E', 2.8); P.stroke(curve([[ax - 8, ay - 3], [ax, ay - 1], [ax + 8, ay - 3]]), '#3A3A3E', 2); } });
ART.shoes.balletflat = shoes({ def: '#1C1C21', h: -6, sole: '#F2EFE8', soleH: 2.5, wide: 0.95, laces: false, shine: true, detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx - 9, ay + 6], [tx, ay + 9], [tx + 9, ay + 6]]), lt(m, 0.35), 1.8); P.dot(tx, ay + 9.4, 1.6, lt(m, 0.5)); } });
ART.shoes.chelsea = shoes({ def: '#2A1A12', h: 12, sole: '#120A06', soleH: 3.5, wide: 1.02, laces: false, shine: true, detail: (P, c, R, m, ax, ay, side, tx) => { both((s) => P.stroke(curve([[ax + s * 7, ay - 6], [ax + s * 7.5, ay + 2]]), '#15100C', 3)); P.stroke(curve([[ax, ay - 16], [ax, ay - 11]]), R.hi, 2.2); P.stroke(curve([[tx - 7, ay + 12], [tx, ay + 10], [tx + 7, ay + 12]]), R.line, 1.1, 0.8); } });
ART.shoes.desert = shoes({ def: '#B58E5E', h: 6, sole: '#D9C7A0', soleH: 5, wide: 1.04, laces: 2, laceCol: '#6B4A2A', detail: (P, c, R, m, ax, ay, side, tx) => { P.stroke(curve([[tx - 9, ay + 10], [tx, ay + 8], [tx + 9, ay + 10]]), R.line, 1.2); P.stroke(curve([[tx - 10, ay + 17], [tx, ay + 15], [tx + 10, ay + 17]]), R.line, 1, 0.7); } });

/* ------------------------------------------------------------------ hats */
const bucketMono = (def, big = 0) => (P, g, col, ph) => {
  if (ph !== 'head') return;
  const m = col || def, R = ramp(m), br = big ? [[44, 54], [56, 42], [100, 38], [144, 42], [156, 54], [146, 61], [100, 60], [54, 61]] : [[54, 52], [62, 40], [100, 37], [138, 40], [146, 52], [140, 58], [100, 56], [60, 58]];
  P.part(blob([[68, 44], [70, 22], [84, 10], [100, 8], [116, 10], [130, 22], [132, 44]]), R, { shade: [[poly([[112, 0], [150, 0], [150, 60], [116, 60]]), R.sh]] });
  P.part(blob(br), ramp(dk(m, 0.04)), { shade: [[poly([[112, 30], [165, 30], [165, 70], [116, 70]]), R.sh]] });
  const st = dk(m, 0.28);
  [[[62, 49], [100, 45.5], [138, 49]], [[60, 53], [100, 50], [140, 53]]].forEach((s2) => P.stroke(curve(s2), st, 0.9, 0.8));
  if (big) P.stroke(curve([[68, 42], [100, 39.5], [132, 42]]), lt(m, 0.25), 3);
  else P.stroke(curve([[68, 42], [100, 39.5], [132, 42]]), st, 1.2);
};
ART.hat.nylonbucket = bucketMono('#1C1C21');
ART.hat.boonie = bucketMono('#6B7048', 1);
ART.hat.trapper = (P, g, col, ph) => {
  if (ph !== 'head') return;
  const m = col || '#6B5A3E', R = ramp(m), fur = '#E9E2D0', RF = ramp(fur);
  P.part(blob([[64, 48], [64, 28], [72, 12], [88, 4], [100, 2], [112, 4], [128, 12], [136, 28], [136, 48]]), R, { shade: [[poly([[112, -10], [150, -10], [150, 60], [116, 60]]), R.sh]] });
  both((s) => { const X = (x) => CX + s * x; P.part(blob([[X(34), 40], [X(42), 46], [X(43), 84], [X(38), 100], [X(29), 100], [X(28), 60]]), R, { shade: s > 0 ? [[poly([[X(36), 30], [X(60), 30], [X(60), 110], [X(36), 110]]), R.sh]] : [] }); P.part(blob([[X(27), 96], [X(40), 94], [X(42), 104], [X(36), 109], [X(29), 108]]), RF, {}); });
  P.part(blob([[61, 52], [61, 38], [100, 33], [139, 38], [139, 52], [100, 47]]), RF, { shade: [[poly([[112, 20], [160, 20], [160, 70], [116, 70]]), RF.sh]] });
  for (let x = 66; x <= 134; x += 5) P.stroke(curve([[x, 38 + Math.abs(x - 100) * 0.05], [x + 1, 49]]), '#CFC6B0', 1, 0.7);
};
ART.hat.slouch = (P, g, col, ph) => {
  if (ph !== 'head') return;
  const m = col || '#6B4E3A', R = ramp(m);
  P.part(blob([[63, 46], [63, 24], [70, 8], [88, -2], [110, -4], [130, 2], [146, 14], [150, 30], [138, 30], [136, 46]]), R, { shade: [[poly([[112, -10], [160, -10], [160, 60], [116, 60]]), R.sh]] });
  for (let x = 72; x <= 130; x += 6) P.stroke(curve([[x, 12 + Math.abs(x - 100) * 0.2], [x + (x - 100) * 0.04, 34]]), R.deep, 1, 0.45);
  P.part(blob([[62, 50], [62, 34], [100, 31], [138, 34], [138, 50], [100, 53]]), ramp(dk(m, 0.06)), {}); for (let x = 66; x <= 134; x += 4) P.stroke(`M${x} 35 L${x} 50`, R.deep, 0.8, 0.5);
};
ART.hat.bandana = (P, g, col, ph) => {
  if (ph !== 'head') return;
  const m = col || '#B3202A', R = ramp(m);
  P.part(blob([[62, 44], [63, 32], [100, 27], [137, 32], [138, 44], [100, 41]]), R, { shade: [[poly([[112, 10], [150, 10], [150, 60], [116, 60]]), R.sh]] });
  for (let x = 70; x <= 130; x += 9) { P.dot(x, 36.5 + Math.abs(x - 100) * 0.05, 1.3, '#F2EFE8', 0.9); P.dot(x + 4, 40.5, 0.9, '#F2EFE8', 0.8); }
  P.part(poly([[134, 33], [150, 28], [146, 38], [152, 46], [138, 42]]), R, {}); P.dot(135, 37, 2.6, dk(m, 0.2));
};
ART.hat.flatcap = (P, g, col, ph) => {
  if (ph !== 'head') return;
  const m = col || '#6B6B70', R = ramp(m);
  const d = blob([[60, 44], [62, 30], [78, 18], [100, 15], [122, 18], [138, 30], [140, 44], [100, 49]]);
  P.part(d, R, { shade: [[poly([[112, 0], [150, 0], [150, 60], [116, 60]]), R.sh]] });
  P.clip(d, Array.from({ length: 9 }, (_, i) => `<path d="M${52 + i * 10} 12 L${60 + i * 10} 52" stroke="${R.deep}" stroke-width="0.9" opacity="0.5"/><path d="M${52 + i * 10} 52 L${60 + i * 10} 12" stroke="${R.hi}" stroke-width="0.7" opacity="0.4"/>`).join(''));
  P.stroke(d, R.line, OW);
  P.part(blob([[66, 46], [100, 50], [134, 46], [130, 53], [100, 57], [70, 53]]), ramp(dk(m, 0.2)), {});
  P.dot(100, 17, 2.2, dk(m, 0.2));
};
ART.hat.capvisor = (P, g, col, ph) => {
  if (ph !== 'head') return;
  const m = col || '#F2EFE8', R = ramp(m);
  P.part(blob([[63, 44], [63, 36], [100, 32], [137, 36], [137, 44], [100, 41]]), R, { shade: [[poly([[112, 20], [150, 20], [150, 60], [116, 60]]), R.sh]] });
  capBill(P, dk(m, 0.1), false);
};

/* ------------------------------------------------------------------ face, ears */
ART.face.rectglasses = (P, g, col, ph) => {
  if (ph !== 'face') return;
  EYES.forEach(([x, y]) => { P.add(`<rect x="${x - 10}" y="${y - 6.4}" width="20" height="12.6" rx="3" fill="#DDEBFF" fill-opacity="0.2" stroke="#3B2A1A" stroke-width="1.8"/>`); });
  P.stroke(curve([[94.5, 60.5], [100, 59.4], [105.5, 60.5]]), '#3B2A1A', 1.8); both((s) => P.stroke(curve([[CX + s * 25, 60], [CX + s * 34.5, 58.5]]), '#3B2A1A', 1.6));
};
ART.face.squareshades = (P, g, col, ph) => { if (ph !== 'face') return; lenses(P, (x, y) => blob([[x - 10, y - 6], [x + 10, y - 6], [x + 10, y + 5.4], [x - 10, y + 5.4]]), '#2B2218', '#0E0E10', 2); EYES.forEach(([x, y]) => P.stroke(curve([[x - 7, y - 3.4], [x - 2, y - 4]]), '#8A7A60', 1.4)); };
ART.face.freckles = (P, g, col, ph) => { if (ph !== 'face') return; [[78, 74], [83, 77], [89, 74], [111, 74], [117, 77], [122, 74], [86, 79], [114, 79]].forEach(([x, y]) => P.dot(x, y, 0.9, '#A5683F', 0.75)); [[96, 67]].forEach(([x, y]) => P.dot(x, y, 0.7, '#A5683F', 0.55)); };
ART.ear.huggies = (P, g, col, ph) => { if (ph === 'face') both((s) => P.add(`<ellipse cx="${CX + s * 35.4}" cy="83.5" rx="2.4" ry="3.2" fill="none" stroke="${GOLD2}" stroke-width="2.2"/><ellipse cx="${CX + s * 35.4}" cy="83.5" rx="2.4" ry="3.2" fill="none" stroke="${GOLD}" stroke-width="1.2"/>`)); };
ART.ear.crossdrop = (P, g, col, ph) => { if (ph === 'face') both((s) => { const x = CX + s * 35.4; P.dot(x, 79.5, 1.4, SILVER, 1); P.stroke(`M${x} 80.5 L${x} 87`, SILVER2, 1); P.add(`<path d="M${x - 0.9} 87 h1.8 v2.6 h2.6 v1.8 h-2.6 v4.2 h-1.8 v-4.2 h-2.6 v-1.8 h2.6Z" fill="${SILVER}" stroke="${SILVER2}" stroke-width="0.6"/>`); }); };
ART.ear.chaindrop = (P, g, col, ph) => { if (ph === 'face') both((s) => { const x = CX + s * 35.4; P.dot(x, 79.5, 1.3, GOLD, 1); P.add(`<path d="M${x} 80.5 q${s * 3} 5 0 10" fill="none" stroke="${GOLD2}" stroke-width="1.8"/><path d="M${x} 80.5 q${s * 3} 5 0 10" fill="none" stroke="${GOLD}" stroke-width="0.9" stroke-dasharray="1 1.4"/>`); P.dot(x, 91.5, 1.3, GOLD, 1); }); };

/* ------------------------------------------------------------------ neck: chains and scarves */
ART.chain.dogtags = (P, g, col, ph, c) => { if (ph !== 'neck') return; chain(P, c, SILVER, null, { w: 1.5, drop: 142 }); [[-2.5, 146, -8], [2.5, 150, 6]].forEach(([dx, y, rot]) => P.add(`<g transform="rotate(${rot} ${CX + dx} ${y})"><rect x="${CX + dx - 5}" y="${y - 7}" width="10" height="14" rx="4" fill="#B9BFC8" stroke="${SILVER2}" stroke-width="1"/><path d="M${CX + dx - 3} ${y - 2} h6 M${CX + dx - 3} ${y + 1.5} h6" stroke="${SILVER2}" stroke-width="0.8"/></g>`)); };
ART.chain.crosschain = (P, g, col, ph, c) => { if (ph !== 'neck') return; chain(P, c, SILVER, '#FFFFFF', { w: 1.6, drop: 140 }); P.add(`<path d="M${CX - 1.8} 142 h3.6 v6 h5.2 v3.6 h-5.2 v10 h-3.6 v-10 h-5.2 v-3.6 h5.2Z" fill="${GOLD}" stroke="${GOLD2}" stroke-width="1"/><path d="M${CX - 0.6} 144 v14" stroke="${GOLDHI}" stroke-width="0.8"/>`); };
ART.chain.layered = (P, g, col, ph, c) => { if (ph !== 'neck') return; chain(P, c, SILVER, null, { w: 1.4, drop: 128 }); chain(P, c, GOLD, GOLDHI, { w: 2, drop: 138 }); chain(P, c, GOLD, null, { w: 2.8, drop: 150 }); P.ell(CX, 150.5, 3.4, 3.4, '#E8F2FF', { line: SILVER2, w: 1 }); };
ART.chain.ropechain = (P, g, col, ph, c) => { if (ph !== 'neck') return; const d = chain(P, c, GOLD, null, { w: 3.2, drop: 136 }); P.add(`<path d="${d}" fill="none" stroke="${GOLD2}" stroke-width="3" stroke-dasharray="1.2 1.8"/>`); };
ART.chain.beads = (P, g, col, ph, c) => { if (ph !== 'neck') return; const d = chain(P, c, '#8A6A4A', null, { w: 0.6, drop: 136 }); P.add(`<path d="${d}" fill="none" stroke="${col || '#2FA3A0'}" stroke-width="4.2" stroke-linecap="round" stroke-dasharray="0.01 5.4"/><path d="${d}" fill="none" stroke="#F2EFE8" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.01 5.4" stroke-dashoffset="-2.7"/>`); };
ART.scarf.knitscarf = (P, g, col, ph, c) => wrapScarf(col || '#B24B3A', null, (PP) => { for (let x = CX + 9; x <= CX + 21; x += 3) PP.stroke(curve([[x, 122], [x + 1, 186]]), ramp(col || '#B24B3A').deep, 1, 0.5); })(P, g, col, ph, c);
ART.scarf.plaidscarf = (P, g, col, ph, c) => { const m = col || '#9B2C2C'; wrapScarf(m, null, (PP) => { [132, 150, 168, 184].forEach((y) => PP.stroke(curve([[CX + 7, y], [CX + 20, y + 1]]), lt(m, 0.35), 1.6)); [CX + 10, CX + 17].forEach((x) => PP.stroke(curve([[x, 120], [x + 1, 188]]), dk(m, 0.35), 1.4)); PP.stroke(curve([[CX - c.B.nk - 5, 114], [CX + c.B.nk + 5, 114]]), lt(m, 0.35), 1.4); })(P, g, col, ph, c); };
ART.scarf.neckbandana = (P, g, col, ph, c) => { if (ph !== 'neck') return; const m = col || '#B3202A', R = ramp(m), nk = c.B.nk; P.part(blob([[CX - nk - 8, 112], [CX - nk - 2, 105], [CX + nk + 2, 105], [CX + nk + 8, 112], [CX + 6, 134], [CX, 140], [CX - 6, 134]]), R, { shade: [[poly([[CX + 4, 100], [CX + 40, 100], [CX + 40, 150], [CX + 4, 150]]), R.sh]] }); [[-8, 118], [0, 124], [8, 118], [-3, 131], [4, 130]].forEach(([dx, y]) => P.dot(CX + dx, y, 1.2, '#F2EFE8', 0.9)); };

/* ------------------------------------------------------------------ wrist and hand */
ART.wrist.digital = (P, g, col, ph, c) => { if (ph === 'wrist') onWrist(P, g, c, '#232428', '#A9C4A0', '#3A3C42'); };
ART.wrist.beadstack = (P, g, col, ph) => { if (ph !== 'wrist') return; const [x, y, w] = g.watch(-1); P.add(`<g transform="rotate(${g.watchTurn(-1).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">`); [[-3.6, '#2FA3A0'], [-0.6, '#E8D8B0'], [2.4, '#B3202A']].forEach(([dy, colr]) => { P.stroke(curve([[x - w / 2 - 1, y + dy], [x + w / 2 + 1, y + dy]]), '#3A2A1A', 1.2); P.add(`<path d="M${x - w / 2 - 1} ${y + dy} L${x + w / 2 + 1} ${y + dy}" stroke="${colr}" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.01 3.6" fill="none"/>`); }); P.add('</g>'); };
ART.wrist.cuff = (P, g, col, ph) => { if (ph !== 'wrist') return; const [x, y, w] = g.watch(-1); P.add(`<g transform="rotate(${g.watchTurn(-1).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">`); P.shape(blob([[x - w / 2 - 1.5, y - 7], [x + w / 2 + 1.5, y - 7], [x + w / 2 + 1.5, y + 3], [x - w / 2 - 1.5, y + 3]]), '#6B4226', { line: '#2A1608', w: 1.4 }); P.dot(x - w / 4, y - 2, 1.1, SILVER); P.dot(x + w / 4, y - 2, 1.1, SILVER); P.stroke(curve([[x - w / 2, y - 6], [x + w / 2, y - 6]]), '#9A6A3C', 1, 0.8); P.add('</g>'); };
ART.wrist.tennisbracelet = (P, g, col, ph) => { if (ph !== 'wrist') return; const [x, y, w] = g.watch(-1); P.add(`<g transform="rotate(${g.watchTurn(-1).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">`); P.stroke(curve([[x - w / 2 - 1, y - 1.5], [x + w / 2 + 1, y - 1.5]]), SILVER2, 3.4); P.add(`<path d="M${x - w / 2 - 1} ${y - 1.5} L${x + w / 2 + 1} ${y - 1.5}" stroke="#F4FBFF" stroke-width="2.6" stroke-dasharray="1.8 0.8" fill="none"/>`); P.add('</g>'); };
ART.hand.skateboard = held(1.5, (P, g, col, ph) => {
  if (ph !== 'hand') return; const [x, y] = rightHand(g), m = col || '#E36414', R = ramp(m);
  P.part(blob([[x - 5.5, y - 6], [x + 5.5, y - 6], [x + 6, y + 46], [x - 6, y + 46]]), R, { shade: [[poly([[x + 1, y - 10], [x + 14, y - 10], [x + 14, y + 52], [x + 1, y + 52]]), R.sh]] });
  [[y + 4], [y + 36]].forEach(([yy]) => { P.stroke(curve([[x - 8, yy], [x + 8, yy]]), '#9AA0A6', 2.2); [-7, 7].forEach((dx) => P.ell(x + dx, yy, 2.6, 3.4, '#F2EFE8', { line: '#26272B', w: 1.2 })); });
  P.stroke(curve([[x - 1, y + 14], [x + 1, y + 26]]), lt(m, 0.35), 1.2, 0.8);
});
ART.hand.icedcoffee = held(1.5, (P, g, col, ph) => {
  if (ph !== 'hand') return; const [x, y] = rightHand(g);
  P.stroke(curve([[x + 2, y + 6], [x + 4, y + 36]]), '#2A8A4A', 2.4);
  P.shape(blob([[x - 8, y + 12], [x + 8, y + 12], [x + 6, y + 40], [x - 6, y + 40]]), '#B98B6A', { line: '#5A3E22', w: 1.4 });
  P.fill(blob([[x - 7.4, y + 12.6], [x + 7.4, y + 12.6], [x + 7, y + 17], [x - 7, y + 17]]), '#F2EFE8', 0.85);
  P.shape(blob([[x - 9, y + 9], [x + 9, y + 9], [x + 8.6, y + 13], [x - 8.6, y + 13]]), '#2A8A4A', { line: '#14501F', w: 1.1 });
  [[-2, 22], [2, 28], [-3, 33]].forEach(([dx, dy]) => P.dot(x + dx, y + dy, 1.2, '#F4EAD8', 0.7));
});
ART.hand.tote = held(1.45, (P, g, col, ph) => {
  if (ph !== 'hand') return; const [x, y] = rightHand(g), m = col || '#E9E2D0', R = ramp(m);
  P.stroke(curve([[x - 8, y + 20], [x - 6, y + 2], [x, y - 4], [x + 6, y + 2], [x + 8, y + 20]]), dk(m, 0.4), 2.6);
  P.part(blob([[x - 17, y + 18], [x + 17, y + 18], [x + 19, y + 48], [x - 19, y + 48]]), R, { shade: [[poly([[x + 4, y + 10], [x + 30, y + 10], [x + 30, y + 56], [x + 4, y + 56]]), R.sh]] });
  P.stroke(curve([[x - 18, y + 28], [x + 18, y + 28]]), contrast(m), 2.2); P.stroke(curve([[x - 18.5, y + 34], [x + 18.5, y + 34]]), contrast(m), 1.2);
});

/* ================================================================== part 2: tops, jackets, bottoms */
// a band across the torso, clipped to the shape of the shirt
const bands = (ys, h, colr, op = 1) => (P, c, R, d) => P.clip(d, ys.map((y) => `<path d="${poly([[CX - 70, y], [CX + 70, y], [CX + 70, y + h], [CX - 70, y + h]])}" fill="${colr}" opacity="${op}"/>`).join(''));
const legStripe = (colr, w = 3, at = 0.36) => (P, g, side, J, c, R) => { P.stroke(curve(J.map(([x, y, ww]) => [x + side * ww * at, y])), colr, w); hemLine(P, J, R); };

/* ------------------------------------------------------------------ tops */
ART.top.babytee = top({ def: '#E7C6D1', sleeve: 'short', grow: 1.2, hem: 178, neck: 'scoop', detail: (P, c, R) => { P.stroke(curve([[CX - 30, 176], [CX, 178], [CX + 30, 176]]), R.line, 1.2, 0.8); } });
ART.top.rugby = top({ def: '#1F3558', sleeve: 'long', grow: 5, neck: 'crew', rib: false, sgrow: 5.5,
  collar: (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 3), 106], [CX + s * (nk + 11), 113], [CX + s * (nk + 6), 126], [CX + s * 3, 122]]), '#F2EFE8', { line: R.line, w: 1.4 })); P.stroke(curve([[CX, 122], [CX, 134]]), '#F2EFE8', 2.2); [127, 132].forEach((y) => P.dot(CX, y, 1.1, '#26303F')); },
  detail: (P, c, R, d) => { bands([140, 168], 10, '#F2EFE8')(P, c, R, d); bands([154], 10, '#B3202A')(P, c, R, d); } });
ART.top.breton = top({ def: '#F2EFE8', sleeve: 'long', grow: 3.2, neck: 'scoop', rib: true, ribCol: () => '#1F2A44',
  detail: (P, c, R, d) => bands([112, 128, 144, 160, 176, 192], 8, '#1F2A44')(P, c, R, d) });
ART.top.quarterzip = top({ def: '#6E7B8F', sleeve: 'long', grow: 4, neck: 'none', sgrow: 5,
  collar: (P, c, R) => { const nk = c.B.nk; P.part(blob([[CX - nk - 2, 100], [CX + nk + 2, 100], [CX + nk + 5, 118], [CX, 122], [CX - nk - 5, 118]]), R, { shade: [[poly([[CX + nk * 0.3, 90], [CX + 30, 90], [CX + 30, 130], [CX + nk * 0.3, 130]]), R.sh]] }); P.stroke(curve([[CX, 102], [CX, 142]]), INK, 2.2); P.stroke(curve([[CX, 102], [CX, 142]]), SILVER, 0.9); P.dot(CX, 104, 1.6, SILVER); },
  detail: (P, c, R, d) => { P.stroke(curve([[CX - 34, 150], [CX - 36, 196]]), R.deep, 1.3, 0.5); hem(P, c.B, 4, 203, R); } });
ART.top.mockknit = top({ def: '#B8A88C', sleeve: 'long', grow: 4.5, neck: 'none', sgrow: 6,
  collar: (P, c, R) => { const nk = c.B.nk; P.part(blob([[CX - nk - 2, 100], [CX + nk + 2, 100], [CX + nk + 4, 116], [CX, 119], [CX - nk - 4, 116]]), R, { shade: [[poly([[CX + nk * 0.3, 90], [CX + 30, 90], [CX + 30, 130], [CX + nk * 0.3, 130]]), R.sh]] }); for (let x = -nk; x <= nk; x += 3) P.stroke(`M${CX + x} 102 L${CX + x} 116`, R.deep, 0.8, 0.5); },
  detail: (P, c, R, d) => { for (let x = CX - 48; x <= CX + 48; x += 5) P.stroke(curve([[x, 122], [x, 200]]), R.deep, 0.8, 0.28); hem(P, c.B, 4.5, 203, R); } });
ART.top.sweatervest = top({ def: '#8C6A3F', sleeve: 'none', shape: 'tank', neck: 'v', grow: 3, hem: 198,
  detail: (P, c, R, d) => { P.clip(d, [128, 142, 156, 170, 184].map((y, i) => [...Array(11)].map((_, j) => `<path d="${poly([[CX - 50 + j * 10 + (i % 2) * 5, y], [CX - 45 + j * 10 + (i % 2) * 5, y + 7], [CX - 50 + j * 10 + (i % 2) * 5, y + 14], [CX - 55 + j * 10 + (i % 2) * 5, y + 7]])}" fill="none" stroke="${R.deep}" stroke-width="1" opacity="0.5"/>`).join('')).join('')); } });
ART.top.tiedye = top({ def: '#8E7CC3', sleeve: 'short', grow: 4, detail: (P, c, R, d) => { const cx = CX, cy = 160; P.clip(d, [[60, '#F2B6D2'], [46, '#8E7CC3'], [32, '#5BC0BE'], [19, '#F6E27F'], [8, '#8E7CC3']].map(([r, k]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${k}" opacity="0.9"/>`).join('') + [0, 1, 2, 3, 4, 5].map((i) => `<path d="M${cx} ${cy} L${cx + Math.cos(i * 1.05) * 70} ${cy + Math.sin(i * 1.05) * 70}" stroke="#FFFFFF" stroke-width="2" opacity="0.5"/>`).join('')); } });
ART.top.soccertee = top({ def: '#B3202A', sleeve: 'short', grow: 6, sgrow: 7, hem: 206, neck: 'crew', ribCol: () => '#F2EFE8',
  detail: (P, c, R, d) => { bands([126], 5, '#F2EFE8')(P, c, R, d); P.clip(d, [[CX - 50], [CX + 36]].map(([x]) => `<path d="${poly([[x, 100], [x + 14, 100], [x + 14, 210], [x, 210]])}" fill="#26303F" opacity="0.85"/>`).join('')); } });
ART.top.argyle = top({ def: '#D8CDB4', sleeve: 'long', grow: 4.5, neck: 'v', rib: true, ribCol: () => '#2F4F3A', sgrow: 6,
  detail: (P, c, R, d) => { P.clip(d, [...Array(5)].map((_, i) => [...Array(6)].map((_, j) => { const x = CX - 50 + j * 20 + (i % 2) * 10, y = 124 + i * 18; return `<path d="${poly([[x, y], [x + 10, y + 9], [x, y + 18], [x - 10, y + 9]])}" fill="${(i + j) % 2 ? '#2F4F3A' : '#9B2C2C'}" opacity="0.8"/>`; }).join('')).join('')); } });
ART.top.fairisle = top({ def: '#26364F', sleeve: 'long', grow: 5, neck: 'crew', ribCol: () => '#E9E4D8', sgrow: 6,
  detail: (P, c, R, d) => { const rows = [[132, '#E9E4D8'], [150, '#B3202A'], [168, '#E9E4D8']]; P.clip(d, rows.map(([y, k]) => [...Array(13)].map((_, j) => `<path d="${poly([[CX - 52 + j * 8.5, y + 8], [CX - 48 + j * 8.5, y], [CX - 44 + j * 8.5, y + 8]])}" fill="${k}" opacity="0.9"/>`).join('') + `<path d="M${CX - 60} ${y - 3} H${CX + 60} M${CX - 60} ${y + 11} H${CX + 60}" stroke="${k}" stroke-width="1.6" opacity="0.8"/>`).join('')); } });
ART.top.cropzip = top({ def: '#8A8E96', sleeve: 'long', grow: 4.5, hem: 188, neck: 'none', sgrow: 6,
  collar: (P, c, R, main) => { hood(P, c, R); P.stroke(curve([[CX, 118], [CX, 188]]), INK, 2.2); P.stroke(curve([[CX, 118], [CX, 188]]), SILVER, 0.9); },
  detail: (P, c, R) => { hem(P, c.B, 4.5, 188, R); } });
ART.top.waffle = top({ def: '#CDBFA6', sleeve: 'long', grow: 3.6, neck: 'v', rib: false, sgrow: 5,
  collar: (P, c, R, main) => { const nk = c.B.nk; [126, 133, 140].forEach((y) => P.dot(CX, y - 2, 1.2, dk(main, 0.3))); },
  detail: (P, c, R, d) => { P.clip(d, [...Array(14)].map((_, i) => `<path d="M${CX - 52 + i * 8} 110 L${CX - 52 + i * 8} 210" stroke="${R.deep}" stroke-width="0.7" opacity="0.4"/>`).join('') + [...Array(12)].map((_, i) => `<path d="M${CX - 60} ${116 + i * 8} L${CX + 60} ${116 + i * 8}" stroke="${R.deep}" stroke-width="0.7" opacity="0.4"/>`).join('')); } });

/* ------------------------------------------------------------------ jackets and coats */
const patch = (side = 1, y = 142) => (P, R, colr) => P.shape(poly([[CX + side * 12, y], [CX + side * 26, y - 1], [CX + side * 25, y + 12], [CX + side * 13, y + 12]]), colr, { line: R.line, w: 1.1 });
ART.outer.coachjacket = outer({ def: '#1F2A44', len: 210, grow: 6, collar: (P, c, R, main) => { const nk = c.B.nk; P.stroke(curve([[CX - nk - 7, 116], [CX - nk - 2, 108], [CX + nk + 2, 108], [CX + nk + 7, 116]]), R.line, 5); P.stroke(curve([[CX - nk - 7, 116], [CX - nk - 2, 108], [CX + nk + 2, 108], [CX + nk + 7, 116]]), lt(main, 0.1), 3); },
  detail: (P, c, R, d, main, B, grow, hemY) => { buttons([128, 146, 164, 182], CX + 4, lt(main, 0.35))(P); both((s) => P.stroke(curve([[CX + s * 12, 176], [CX + s * 28, 175]]), R.line, 1.3, 0.8)); hem(P, B, grow, 210, R); } });
ART.outer.shacket = outer({ def: '#7A5C3A', len: 214, grow: 7, collar: shirtCollar, sgrow: 7.5, cuff: (p, m) => dk(m, 0.1),
  detail: (P, c, R, d, main, B, grow, hemY) => { both((s) => { P.shape(poly([[CX + s * 12, 142], [CX + s * 27, 141], [CX + s * 26, 157], [CX + s * 13, 157]]), R.base, { line: R.line, w: 1.2 }); P.stroke(curve([[CX + s * 12, 146], [CX + s * 27, 145]]), lt(main, 0.15), 1); }); buttons([130, 152, 174, 196], CX + 5, '#2A2A2A')(P);
    for (let x = CX - 46; x <= CX + 46; x += 10) P.stroke(curve([[x, 120], [x, 212]]), dk(main, 0.2), 1.2, 0.4); for (let y = 128; y < 212; y += 12) P.stroke(curve([[CX - 50, y], [CX + 50, y]]), dk(main, 0.2), 1.2, 0.4); } });
ART.outer.pufvest = outer({ def: '#E36414', len: 206, grow: 8, closed: true, sleeve: 'none', collar: ribCollar(),
  detail: (P, c, R, d) => { P.clip(d, [130, 148, 166, 184, 200].map((y) => `<path d="${curve([[CX - 70, y], [CX, y + 3], [CX + 70, y]])}" fill="none" stroke="${R.line}" stroke-width="1.5" opacity="0.7"/>`).join('')); P.stroke(curve([[CX, 112], [CX, 206]]), INK, 2.2); P.stroke(curve([[CX, 112], [CX, 206]]), SILVER, 0.9); } });
ART.outer.trench = outer({ def: '#C2A57C', len: 258, grow: 7, gap: (y) => 3 + (y > 150 ? (y - 150) * 0.02 : (150 - y) * 0.3), collar: (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 2), 106], [CX + s * (nk + 16), 118], [CX + s * (nk + 8), 140], [CX + s * 10, 144], [CX + s * 3, 126]]), lt(main, 0.04), { line: R.line, w: 1.4 })); },
  detail: (P, c, R, d, main, B, grow, hemY) => { P.stroke(curve([[CX - 50, 170], [CX, 176], [CX + 50, 170]]), dk(main, 0.35), 5); P.stroke(curve([[CX - 50, 170], [CX, 176], [CX + 50, 170]]), lt(main, 0.1), 3); P.shape(poly([[CX - 5, 172], [CX + 5, 172], [CX + 5, 180], [CX - 5, 180]]), SILVER, { line: SILVER2, w: 1 }); buttons([132, 148, 196, 214, 232], CX + 7, '#5A4128')(P); both((s) => P.stroke(curve([[CX + s * 14, 196], [CX + s * 30, 195]]), R.line, 1.4, 0.8)); } });
ART.outer.retrotrack = outer({ def: '#1F3558', len: 204, grow: 5, collar: ribCollar(), cuff: (p, m) => '#F2EFE8', stripe: () => '#F2EFE8',
  detail: (P, c, R, d, main, B, grow, hemY) => { P.stroke(curve([[CX, 112], [CX, 204]]), INK, 2.4); P.stroke(curve([[CX, 112], [CX, 204]]), SILVER, 0.9); P.clip(d, [`<path d="${poly([[CX - 70, 150], [CX + 70, 150], [CX + 70, 158], [CX - 70, 158]])}" fill="#F2EFE8"/>`, `<path d="${poly([[CX - 70, 160], [CX + 70, 160], [CX + 70, 164], [CX - 70, 164]])}" fill="#B3202A"/>`].join('')); hem(P, B, grow, 204, R); } });
ART.outer.halfwind = outer({ def: '#5BA8C9', len: 206, grow: 7, closed: true, collar: ribCollar(),
  detail: (P, c, R, d, main, B, grow, hemY) => { P.stroke(curve([[CX, 112], [CX, 150]]), INK, 2.4); P.stroke(curve([[CX, 112], [CX, 150]]), SILVER, 0.9); P.clip(d, `<path d="${poly([[CX - 70, 146], [CX + 70, 160], [CX + 70, 212], [CX - 70, 212]])}" fill="${dk(main, 0.22)}"/>`); P.shape(poly([[CX - 16, 172], [CX + 16, 172], [CX + 14, 190], [CX - 14, 190]]), dk(main, 0.12), { line: R.line, w: 1.2 }); hem(P, B, grow, 206, R); } });
ART.outer.harrington = outer({ def: '#B8A070', len: 204, grow: 5, collar: (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 2), 106], [CX + s * (nk + 12), 112], [CX + s * (nk + 6), 124], [CX + s * 3, 120]]), lt(main, 0.04), { line: R.line, w: 1.4 })); },
  detail: (P, c, R, d, main, B, grow) => { P.stroke(curve([[CX, 118], [CX, 204]]), INK, 2.4); P.stroke(curve([[CX, 118], [CX, 204]]), SILVER, 0.9); both((s) => P.stroke(curve([[CX + s * 14, 176], [CX + s * 28, 175]]), R.line, 1.4, 0.8)); P.clip(d, [`<path d="${poly([[CX - 70, 134], [CX + 70, 134], [CX + 70, 138], [CX - 70, 138]])}" fill="#3A4F3A" opacity="0.8"/>`].join('')); hem(P, B, grow, 204, R); } });
ART.outer.cordjacket = outer({ def: '#8A5A34', len: 206, grow: 6, collar: shirtCollar, cuff: (p, m) => dk(m, 0.12),
  detail: (P, c, R, d, main, B, grow) => { P.clip(d, [...Array(18)].map((_, i) => `<path d="M${CX - 54 + i * 6.4} 110 L${CX - 54 + i * 6.4} 210" stroke="${R.deep}" stroke-width="1" opacity="0.4"/>`).join('')); both((s) => P.shape(poly([[CX + s * 12, 144], [CX + s * 26, 143], [CX + s * 25, 156], [CX + s * 13, 156]]), R.base, { line: R.line, w: 1.1 })); buttons([128, 150, 172, 194], CX + 5, '#C9A45A')(P); } });
ART.outer.quilted = outer({ def: '#3A4F3A', len: 220, grow: 7, collar: (P, c, R, main) => { const nk = c.B.nk; both((s) => P.shape(poly([[CX + s * (nk + 2), 106], [CX + s * (nk + 12), 113], [CX + s * (nk + 6), 126], [CX + s * 3, 122]]), '#5A4128', { line: R.line, w: 1.4 })); },
  detail: (P, c, R, d, main, B, grow) => { P.clip(d, [...Array(8)].map((_, i) => `<path d="M${CX - 60 + i * 17} 110 L${CX - 40 + i * 17} 224" stroke="${R.line}" stroke-width="1.2" opacity="0.5"/><path d="M${CX - 40 + i * 17} 110 L${CX - 60 + i * 17} 224" stroke="${R.line}" stroke-width="1.2" opacity="0.5"/>`).join('')); buttons([130, 152, 174, 196], CX + 5, '#C9A45A')(P); } });
ART.outer.peacoat = outer({ def: '#1F2A44', len: 232, grow: 7, collar: lapels(1.25), cuff: (p, m) => dk(m, 0.1),
  detail: (P, c, R, d, main) => { buttons([146, 160, 176, 192], CX + 7, '#C9B27A')(P); buttons([146, 160, 176, 192], CX - 7, '#C9B27A')(P); both((s) => P.stroke(curve([[CX + s * 14, 186], [CX + s * 30, 184]]), R.line, 1.5, 0.9)); } });
ART.outer.baseballjacket = outer({ def: '#E9E4D8', len: 204, grow: 6, collar: ribCollar(), sleeveCol: () => '#1F3558', cuff: () => '#1F3558',
  detail: (P, c, R, d, main, B, grow) => { P.stroke(curve([[CX, 112], [CX, 204]]), INK, 2); P.stroke(curve([[CX, 112], [CX, 204]]), SILVER, 0.8); [132, 150, 168, 186].forEach((y) => P.dot(CX + 4, y, 1.5, '#9AA0A6')); hem(P, B, grow, 204, R); } });
ART.outer.denimlong = outer({ def: '#7A9CC4', len: 240, grow: 8, collar: shirtCollar, sgrow: 8,
  detail: (P, c, R, d, main) => { both((s) => { P.shape(poly([[CX + s * 12, 146], [CX + s * 26, 145], [CX + s * 25, 160], [CX + s * 13, 160]]), R.base, { line: R.line, w: 1.2 }); }); buttons([132, 156, 180, 204, 228], CX + 6, '#C9A45A')(P); P.stroke(curve([[CX - 20, 236], [CX + 20, 236]]), R.line, 1.1, 0.7); } });
ART.outer.sherpa = outer({ def: '#C9A66B', len: 208, grow: 7, collar: (P, c, R, main) => { const nk = c.B.nk; P.part(blob([[CX - nk - 10, 112], [CX - nk - 4, 104], [CX + nk + 4, 104], [CX + nk + 10, 112], [CX + nk + 8, 124], [CX - nk - 8, 124]]), ramp('#EFE7D4'), {}); for (let x = -nk - 6; x <= nk + 6; x += 4) P.dot(CX + x, 108 + (x % 8 ? 4 : 0), 1.6, '#D8CFB8', 0.8); },
  detail: (P, c, R, d, main, B, grow) => { P.stroke(curve([[CX, 120], [CX, 208]]), INK, 2.2); P.dot(CX, 130, 1.8, '#8A7A5E'); both((s) => P.stroke(curve([[CX + s * 14, 180], [CX + s * 28, 179]]), R.line, 1.4, 0.8)); P.fill(poly([[CX - 52, 200], [CX + 52, 200], [CX + 52, 208], [CX - 52, 208]]), '#EFE7D4'); } });

/* ------------------------------------------------------------------ bottoms */
ART.bottom.widetrouser = pants({ def: '#46474D', grow: 8, bag: { hem: 1.1, out: 3 }, belt: '#26272B', legDetail: (P, g, side, J, c, R) => { const j = J[Math.floor(J.length * 0.3)]; P.stroke(curve([[j[0], j[1]], [j[0], J[J.length - 1][1]]]), R.line, 1, 0.5); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.pinstripe = pants({ def: '#2A3042', grow: 4, belt: '#1A1410', legDetail: (P, g, side, J, c, R) => { [-0.3, 0, 0.3].forEach((k) => P.stroke(curve(J.map(([x, y, w]) => [x + w * k, y])), lt('#2A3042', 0.45), 0.8, 0.7)); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.cordbaggy = pants({ def: '#8A5A34', grow: 8, bag: { hem: 1.08, out: 2.5 }, legDetail: (P, g, side, J, c, R) => { for (let k = -0.4; k <= 0.4; k += 0.2) P.stroke(curve(J.map(([x, y, w]) => [x + w * k, y])), R.deep, 0.9, 0.35); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.sidestripe = pants({ def: '#1C1C21', grow: 4.5, band: (p, m) => dk(m, 0.1), fly: false, legDetail: (P, g, side, J, c, R) => { P.stroke(curve(J.map(([x, y, ww]) => [x + side * ww * 0.4, y])), '#F2EFE8', 2.6); P.stroke(curve(J.map(([x, y, ww]) => [x + side * ww * 0.4 + side * 3.4, y])), '#F2EFE8', 1.2); hemLine(P, J, R); } });
ART.bottom.stackedjeans = pants({ def: '#3A4F7A', grow: 5.5, legDetail: (P, g, side, J, c, R) => { const b = J[J.length - 1]; [8, 14, 20].forEach((o) => P.stroke(curve([[b[0] - b[2] / 2, b[1] - o], [b[0], b[1] - o + 2], [b[0] + b[2] / 2, b[1] - o]]), R.sh, 1.6, 0.9)); knee(P, J, side, R); }, detail: pocketsJ });
ART.bottom.ripped = pants({ def: '#6F8FB8', grow: 3.6, legDetail: (P, g, side, J, c, R) => { knee(P, J, side, R); const k = J.find((q) => q[1] >= 262) || J[J.length - 1]; P.shape(poly([[k[0] - 7, k[1] - 6], [k[0] + 7, k[1] - 7], [k[0] + 6, k[1] + 6], [k[0] - 6, k[1] + 5]]), '#C99B78', { line: R.line, w: 0.9 }); [-4, 0, 4].forEach((o) => P.stroke(`M${k[0] + o} ${k[1] - 5} l0 10`, '#EDEFF4', 0.8)); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.painter = pants({ def: '#EDEBE5', grow: 6, bag: { hem: 1.06, out: 2 }, legDetail: (P, g, side, J, c, R) => { const j = J[Math.floor(J.length * 0.25)]; P.shape(poly([[j[0] - 6, j[1]], [j[0] + 7, j[1]], [j[0] + 6, j[1] + 22], [j[0] - 6, j[1] + 22]]), R.base, { line: R.line, w: 1 }); [[-3, 270, '#C8432E'], [3, 285, '#2C57A8'], [-2, 298, '#E8C547']].forEach(([dx, y, k]) => { const q = J.find((r) => r[1] >= y) || J[J.length - 1]; P.dot(q[0] + dx * 2, y, 2.2, k, 0.85); }); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.linen = pants({ def: '#D9CDB0', grow: 6, flare: 3, legDetail: (P, g, side, J, c, R) => { for (let y = 232; y < 300; y += 14) P.stroke(curve([[J.find((q) => q[1] >= y)?.[0] - 5 || 0, y], [J.find((q) => q[1] >= y)?.[0] + 5 || 0, y + 2]]), R.sh, 1, 0.5); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.bermuda = pants({ one: true, def: '#B9A878', end: 276, grow: 9, bag: { hem: 1.05, out: 2 }, legDetail: shortsDetail, detail: pocketsJ });
ART.bottom.bikeshorts = pants({ one: true, def: '#1C1C21', end: 246, grow: 0.5, legDetail: (P, g, side, J, c, R) => { P.stroke(curve(J.map(([x, y, w]) => [x + side * w * 0.35, y])), '#E9E4D8', 1.6); hemLine(P, J, R); }, detail: () => {} });
ART.bottom.sweatshorts = pants({ one: true, def: '#8E9196', end: 262, grow: 9, bag: { hem: 1.08, out: 2 }, band: (p, m) => dk(m, 0.12), fly: false, legDetail: (P, g, side, J, c, R) => { const [x, y, w] = J[J.length - 1]; P.fill(poly([[x - w / 2, y - 6], [x + w / 2, y - 6], [x + w / 2, y], [x - w / 2, y]]), R.sh); }, detail: (P) => { P.stroke(curve([[CX - 3, 197], [CX - 4, 208]]), '#E8E6E0', 1.4); P.stroke(curve([[CX + 3, 197], [CX + 4, 208]]), '#E8E6E0', 1.4); } });
ART.bottom.pleatshorts = pants({ one: true, def: '#7A8B6A', end: 268, grow: 8, bag: { hem: 1.04, out: 1.5 }, belt: '#3A2A1A', legDetail: (P, g, side, J, c, R) => { const j = J[0]; P.stroke(curve([[j[0], j[1] + 2], [j[0] - 1, J[J.length - 1][1]]]), R.line, 1, 0.5); hemLine(P, J, R); }, detail: pocketsJ });
ART.bottom.cargoparachute = pants({ def: '#4A5235', grow: 9, bag: { hem: 1.12, out: 3 }, legDetail: (P, g, side, J, c, R) => { cargoPocket(P, J, side, R); const b = J[J.length - 1]; P.stroke(curve([[b[0] - b[2] / 2, b[1] - 3], [b[0] + b[2] / 2, b[1] - 3]]), R.line, 2.2); P.dot(b[0] + side * b[2] * 0.2, b[1] - 8, 1.5, '#C9C3B4'); }, detail: pocketsJ });
ART.bottom.baggyjorts = pants({ one: true, def: '#5A7FB5', end: 276, grow: 10, bag: { hem: 1.06, out: 2 }, legDetail: (P, g, side, J, c, R) => { const b = J[J.length - 1]; for (let i = -3; i <= 3; i += 2) P.stroke(`M${b[0] + i * 3} ${b[1] - 4} l0 4`, '#EDEFF4', 0.9); hemLine(P, J, R); }, detail: pocketsJ });
