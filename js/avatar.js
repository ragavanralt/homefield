// Your fan character: a full-body figure with shading and outlines, the item catalog, and the shop rules.
// Everything here is cosmetic. Nothing changes odds or payouts.
import { getState, myTeams, buyItem, grantItem, setAvatar } from './store.js';
import { betStats } from './bets.js';
import { skinFromColors } from './util.js';

export const SKINS = ['#F6C453', '#F7D9BC', '#EBB98C', '#D39A66', '#B0734A', '#8A5636', '#5E3B24'];
export const HAIR_COLORS = ['#1E1712', '#4A2E1E', '#8A5A2B', '#D9AE55', '#C9CED8', '#D9472E', '#2F6FE0', '#7C4DDB', '#E04A9A', '#22B35E'];
export const SLOTS = [
  { id: 'hair', label: 'Hair' }, { id: 'hat', label: 'Hat' }, { id: 'face', label: 'Face' }, { id: 'beard', label: 'Facial hair' }, { id: 'ear', label: 'Ears' },
  { id: 'top', label: 'Top' }, { id: 'outer', label: 'Jacket' }, { id: 'scarf', label: 'Scarf' }, { id: 'chain', label: 'Chain' }, { id: 'wrist', label: 'Wrist' },
  { id: 'bottom', label: 'Pants' }, { id: 'shoes', label: 'Shoes' }, { id: 'back', label: 'Back' }, { id: 'hand', label: 'In hand' },
];
// Shop tabs: each one shows the items of several slots.
export const GROUPS = [
  { id: 'head', label: 'Hair and hats', slots: ['hair', 'hat'] },
  { id: 'face', label: 'Face', slots: ['face', 'beard', 'ear'] },
  { id: 'body', label: 'Tops and jackets', slots: ['top', 'outer', 'scarf'] },
  { id: 'bling', label: 'Bling', slots: ['chain', 'wrist'] },
  { id: 'legs', label: 'Pants and shoes', slots: ['bottom', 'shoes'] },
  { id: 'extra', label: 'Extras', slots: ['back', 'hand'] },
];
export const ALWAYS_ON = ['hair', 'top', 'bottom', 'shoes'];
export const TIERS = { free: { label: 'Free', price: 0 }, common: { label: 'Common', price: 100 }, rare: { label: 'Rare', price: 500 }, legend: { label: 'Legendary', price: 2500 }, earned: { label: 'Earned', price: 0 } };

// team: the item picks up the colours of the team you chose for your character.
// ach: cannot be bought; it unlocks by doing something.
const I = (id, slot, name, tier, extra) => ({ id, slot, name, tier, price: TIERS[tier].price, ...extra });
export const ITEMS = [
  I('short', 'hair', 'Short cut', 'free'), I('buzz', 'hair', 'Buzz cut', 'free'), I('curly', 'hair', 'Curls', 'free'),
  I('fade', 'hair', 'Skin fade', 'common'), I('slick', 'hair', 'Slick back', 'common'), I('bob', 'hair', 'Bob', 'common'), I('ponytail', 'hair', 'Ponytail', 'common'),
  I('afro', 'hair', 'Afro', 'common'), I('long', 'hair', 'Long hair', 'common'), I('bun', 'hair', 'Top bun', 'common'),
  I('braids', 'hair', 'Braids', 'rare'), I('twists', 'hair', 'Twists', 'rare'), I('mohawk', 'hair', 'Mohawk', 'rare'), I('dreads', 'hair', 'Dreads', 'rare'),

  I('cap', 'hat', 'Team cap', 'common', { team: true }), I('beanie', 'hat', 'Team beanie', 'common', { team: true }), I('headband', 'hat', 'Headband', 'common', { team: true }),
  I('durag', 'hat', 'Durag', 'common', { team: true }), I('bucket', 'hat', 'Bucket hat', 'rare', { team: true }), I('snapback', 'hat', 'Snapback', 'rare', { team: true }),
  I('helmet', 'hat', 'Team helmet', 'rare', { team: true }), I('crown', 'hat', 'Gold crown', 'legend'),

  I('shades', 'face', 'Shades', 'common'), I('eyeblack', 'face', 'Eye black', 'common'), I('paint', 'face', 'Face paint', 'common', { team: true }),
  I('grill', 'face', 'Gold grill', 'rare'), I('visor', 'face', 'Gold visor', 'legend'),
  I('stubble', 'beard', 'Stubble', 'common'), I('stache', 'beard', 'Moustache', 'common'), I('goatee', 'beard', 'Goatee', 'common'), I('beard', 'beard', 'Full beard', 'rare'),
  I('studs', 'ear', 'Diamond studs', 'common'), I('hoops', 'ear', 'Gold hoops', 'rare'),

  I('tee', 'top', 'Plain tee', 'free'), I('tank', 'top', 'Tank top', 'common'), I('polo', 'top', 'Polo', 'common', { team: true }), I('jersey', 'top', 'Team jersey', 'common', { team: true }),
  I('hoodie', 'top', 'Team hoodie', 'rare', { team: true }), I('ghost', 'top', 'Ghost sheet', 'earned', { ach: 'Get rescued with free coins once' }),
  I('denim', 'outer', 'Denim jacket', 'common'), I('track', 'outer', 'Track jacket', 'common', { team: true }), I('varsity', 'outer', 'Varsity jacket', 'rare', { team: true }),
  I('leather', 'outer', 'Leather jacket', 'rare'), I('puffer', 'outer', 'Puffer jacket', 'rare'), I('parka', 'outer', 'Fur parka', 'rare'), I('robe', 'outer', 'Champion robe', 'legend'),
  I('scarf', 'scarf', 'Team scarf', 'common', { team: true }), I('goldscarf', 'scarf', 'Golden scarf', 'earned', { ach: 'Win 5 bets in a row' }),

  I('silver', 'chain', 'Silver chain', 'common'), I('gold', 'chain', 'Gold chain', 'rare'), I('pendant', 'chain', 'Team pendant', 'rare', { team: true }), I('diamond', 'chain', 'Diamond chain', 'legend'),
  I('band', 'wrist', 'Wristband', 'common', { team: true }), I('watch', 'wrist', 'Watch', 'rare'), I('goldwatch', 'wrist', 'Iced-out watch', 'legend'),

  I('jeans', 'bottom', 'Jeans', 'free'), I('joggers', 'bottom', 'Joggers', 'common'), I('cargo', 'bottom', 'Cargo pants', 'common'), I('shorts', 'bottom', 'Denim shorts', 'common'),
  I('tshorts', 'bottom', 'Team shorts', 'common', { team: true }), I('trackp', 'bottom', 'Track pants', 'rare', { team: true }), I('leatherp', 'bottom', 'Leather pants', 'rare'), I('goldpants', 'bottom', 'Gold pants', 'legend'),
  I('sneakers', 'shoes', 'White sneakers', 'free'), I('runners', 'shoes', 'Runners', 'common'), I('slides', 'shoes', 'Slides', 'common'), I('hightops', 'shoes', 'Team high tops', 'common', { team: true }),
  I('boots', 'shoes', 'Boots', 'rare'), I('retros', 'shoes', 'Team retros', 'rare', { team: true }), I('goldkicks', 'shoes', 'Gold kicks', 'legend'),

  I('backpack', 'back', 'Backpack', 'common', { team: true }), I('cape', 'back', 'Team cape', 'rare', { team: true }), I('wings', 'back', 'Gold wings', 'legend'), I('trophycape', 'back', 'Trophy cape', 'earned', { ach: 'Hit a parlay' }),
  I('ball', 'hand', 'Ball', 'common'), I('finger', 'hand', 'Foam finger', 'common', { team: true }), I('pennant', 'hand', 'Pennant', 'common', { team: true }), I('trophy', 'hand', 'Trophy', 'legend'),
];
export const itemById = (id) => ITEMS.find((i) => i.id === id);
const NEUTRAL = { t1: '#4B5BA8', t2: '#2F3B7A', tink: '#FFFFFF', tacc: '#FFD43B' };

/** Earned items. Checked against your stats. */
export const EARNED = {
  goldscarf: (st) => st.bestStreak >= 5,
  trophycape: (st) => st.parlayWins >= 1,
};
export function syncUnlocks() {
  const state = getState();
  const st = betStats(state.bets, state.bank);
  let got = [];
  for (const [id, test] of Object.entries(EARNED)) if (test(st) && grantItem(id)) got.push(id);
  if ((state.bank.rescues || 0) > 0 && grantItem('ghost')) got.push('ghost');
  return got;
}

/** One featured item a day is 20% off. Same item all day, picked from what can be bought. */
export function dealToday(date = new Date()) {
  const pool = ITEMS.filter((i) => i.price > 0);
  const n = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
  return pool[(n * 7) % pool.length];
}
export function priceOf(item, date) {
  if (!item.price) return 0;
  const d = dealToday(date);
  return d && d.id === item.id ? Math.round((item.price * 0.8) / 10) * 10 : item.price;
}

export function buy(id) {
  const item = itemById(id);
  if (!item) return { ok: false, why: 'unknown' };
  if (item.ach) return { ok: false, why: 'earned' };
  const r = buyItem(id, priceOf(item));
  if (r.ok) setAvatar((a) => { a.eq[item.slot] = id; });
  return r;
}
export function equip(id) {
  const item = itemById(id);
  const a = getState().avatar;
  if (!item || !a.owned.includes(id)) return false;
  setAvatar((av) => { av.eq[item.slot] = id; });
  return true;
}
export function unequip(slot) {
  if (ALWAYS_ON.includes(slot)) return false; // always keep hair, a top, pants and shoes on
  setAvatar((av) => { delete av.eq[slot]; });
  return true;
}

/** The team the character wears: the one chosen, else your first followed team, else a neutral blue. */
export function avatarTeam(a = getState().avatar) {
  const teams = myTeams();
  return teams.find((t) => `${t.league}:${t.id}` === a.team) || teams[0] || null;
}
export function palette(team) {
  if (!team) return NEUTRAL;
  const sk = skinFromColors(team.color, team.alt);
  return { t1: sk.t1, t2: sk.t2, tink: sk.tink, tacc: sk.tacc };
}

/* ---------- drawing ---------- */
// Full body, front view, 144 x 214. Flat colour plus soft shading overlays and dark outlines,
// so it reads as a small figure rather than a flat icon. Light comes from the top left.
const GOLD = '#F5C542', GOLD2 = '#B8860B', INK = '#14172B';
const OUT = 'stroke="rgba(8,10,28,.62)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
const DEFS = '<defs><linearGradient id="hf-sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>'
  + '<linearGradient id="hf-sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>';
const P = (d, f, x = '') => `<path d="${d}" fill="${f}" ${OUT} ${x}/><path d="${d}" fill="url(#hf-sh)"/>`;
const PV = (d, f, x = '') => `<path d="${d}" fill="${f}" ${OUT} ${x}/><path d="${d}" fill="url(#hf-sv)"/>`;
const L = (d, s = 'rgba(0,0,0,.3)', w = 1.2) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (cx, cy, r, f, x = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${OUT} ${x}/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#hf-sh)"/>`;
const M = (s) => `<g transform="matrix(-1 0 0 1 120 0)">${s}</g>`;
const both = (s) => s + M(s);

const TORSO = 'M38 77 Q60 71 82 77 L84 112 L83 131 Q60 137 37 131 L36 112 Z';
const ARM = 'M38 78 C31 77 26 82 25 90 L22 121 C22 126 33 127 34 122 L39 98 Z';
const SLEEVE_S = 'M38 78 C31 77 26 82 25 90 L23 106 L37 108 L39 96 Z';
const SLEEVE_L = 'M38 78 C31 77 26 82 25 90 L22 119 L34 121 L39 98 Z';
const CUFF_S = 'M23.4 100 L37.6 102 L37 108 L23 106 Z';
const CUFF_L = 'M22.4 113.5 L34.6 115.5 L34 121 L22 119 Z';
const JACKET = 'M36 77 Q60 70 84 77 L86 112 L85 137 Q60 143 35 137 L34 112 Z';
const PANEL = 'M36 77 L53 74 L56 136 L35 137 L34 112 Z';
const COAT = 'M36 77 L53 74 L55 176 L31 178 L33 112 Z';
const FUR = '#EDE7DA';

const BACK = {
  cape: (c) => `<path d="M30 80 L10 186 Q60 198 110 186 L90 80 Z" fill="${c.t2}" ${OUT}/><path d="M30 80 L10 186 L40 192 L44 80 Z" fill="${c.t1}" opacity=".6"/><path d="M30 80 L10 186 Q60 198 110 186 L90 80 Z" fill="url(#hf-sv)"/>`,
  trophycape: () => `<path d="M30 80 L8 188 Q60 200 112 188 L90 80 Z" fill="#6D28D9" ${OUT}/><path d="M30 80 L8 188 L34 194 L42 80 Z" fill="${GOLD}"/><path d="M90 80 L112 188 L86 194 L78 80 Z" fill="${GOLD}"/><path d="M30 80 L8 188 Q60 200 112 188 L90 80 Z" fill="url(#hf-sv)"/>`,
  backpack: (c) => P('M25 84 H95 L97 138 Q60 146 23 138 Z', c.t2) + L('M30 122 H90', 'rgba(255,255,255,.35)', 1.5),
  wings: () => both(`<path d="M38 86 C12 44 -6 62 -4 112 C2 98 10 94 18 98 C12 112 16 126 26 134 C26 126 30 120 38 118 Z" fill="#F8FAFC" ${OUT}/>`
    + `<path d="M38 86 C12 44 -6 62 -4 112 C2 98 10 94 18 98 C12 112 16 126 26 134 C26 126 30 120 38 118 Z" fill="url(#hf-sh)"/>` + L('M30 92 C14 66 6 80 4 104', GOLD, 2.4) + L('M30 104 C18 90 10 100 12 118', GOLD, 2.4)),
};

const TOP = {
  tee: () => P(TORSO, '#64748B') + both(P(SLEEVE_S, '#64748B')) + L('M50 75 Q60 84 70 75', 'rgba(0,0,0,.4)', 2) + L('M44 112 Q60 118 76 112', 'rgba(0,0,0,.18)', 1.2),
  tank: (c, h, skin) => `<path d="M44 76 Q47 70 51 74 Q60 94 69 74 Q73 70 76 76 L84 88 L84 112 L83 131 Q60 137 37 131 L36 112 L36 88 Z" fill="#1F2937" ${OUT}/><path d="M44 76 Q47 70 51 74 Q60 94 69 74 Q73 70 76 76 L84 88 L84 112 L83 131 Q60 137 37 131 L36 112 L36 88 Z" fill="url(#hf-sh)"/>` + L('M44 118 Q60 124 76 118', 'rgba(255,255,255,.1)'),
  polo: (c) => P(TORSO, '#E2E8F0') + both(P(SLEEVE_S, '#E2E8F0') + P(CUFF_S, c.t1)) + P('M49 74 L59 84 L55 90 L46 79 Z', c.t1) + P('M71 74 L61 84 L65 90 L74 79 Z', c.t1) + L('M60 84 V100', 'rgba(0,0,0,.3)') + C(60, 92, 1.1, '#94A3B8') + C(60, 99, 1.1, '#94A3B8'),
  jersey: (c, h, skin) => P(TORSO, c.t1) + both(P(SLEEVE_S, c.t1) + P(CUFF_S, c.t2)) + `<path d="M50 74 L60 90 L70 74 Z" fill="${skin}" stroke="${c.tacc}" stroke-width="2.4" stroke-linejoin="round"/>`
    + L('M37 100 L38 130', c.t2, 3) + L('M83 100 L82 130', c.t2, 3) + `<text x="60" y="121" font-family="Arial Black, Impact, sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="${c.tink}" stroke="${c.t2}" stroke-width=".8">7</text>`,
  hoodie: (c) => P(TORSO, c.t1) + both(P(SLEEVE_L, c.t1) + P(CUFF_L, c.t2)) + P('M42 78 C46 70 74 70 78 78 C75 90 45 90 42 78 Z', c.t2) + L('M55 86 L54 106', c.tink, 1.8) + L('M65 86 L66 106', c.tink, 1.8)
    + P('M44 114 H76 L80 130 Q60 134 40 130 Z', c.t2) + L('M45 122 L50 128 M75 122 L70 128', 'rgba(0,0,0,.3)'),
  ghost: () => P('M24 84 C24 74 40 70 60 70 C80 70 96 74 96 84 L100 178 L90 170 L80 180 L70 170 L60 180 L50 170 L40 180 L30 170 L20 178 Z', '#F1F5F9') + L('M40 100 Q42 140 38 168 M80 100 Q78 140 82 168 M60 96 V170', 'rgba(100,116,139,.35)', 1.4),
};
const OUTER = {
  denim: () => both(P(PANEL, '#4F78B5') + P(SLEEVE_L, '#4F78B5') + P(CUFF_L, '#3E6199') + P('M38 100 H50 V112 H38 Z', '#456CA6') + L('M38 104 H50', '#F1D17A', 1)) + P('M46 74 L53 74 L56 88 L48 80 Z', '#3E6199') + M(P('M46 74 L53 74 L56 88 L48 80 Z', '#3E6199')),
  track: (c) => both(P(PANEL, c.t1) + P(SLEEVE_L, c.t1) + P(CUFF_L, c.t2) + L('M24 90 L22.6 118', c.tacc, 2.4) + L('M37 80 L38 130', c.tacc, 2.4)) + P('M47 73 Q60 80 73 73 L73 79 Q60 86 47 79 Z', c.t2) + L('M56 80 L56 136', 'rgba(255,255,255,.5)', 1.4),
  varsity: (c) => P(JACKET, c.t2) + both(P(SLEEVE_L, c.t1) + P(CUFF_L, '#F8FAFC') + L('M23.2 108 L35.2 110', c.t2, 1.6)) + P('M46 74 Q60 82 74 74 L74 79 Q60 87 46 79 Z', c.t1) + P('M35 131 Q60 138 85 131 L85 139 Q60 145 35 139 Z', c.t1) + L('M60 82 V136', 'rgba(255,255,255,.55)', 1.5) + C(73, 96, 5.5, c.tacc) + `<text x="73" y="99.3" font-family="Arial Black, Impact, sans-serif" font-size="8" font-weight="900" text-anchor="middle" fill="${c.t2}">H</text>`,
  leather: () => both(P(PANEL, '#17171F') + P(SLEEVE_L, '#17171F') + P(CUFF_L, '#0F0F15') + L('M30 90 L27 110', 'rgba(255,255,255,.28)', 2) + L('M40 90 L41 120', 'rgba(255,255,255,.2)', 2) + P('M43 74 L53 74 L57 96 L47 86 Z', '#0F0F15') + L('M56 80 L56 136', GOLD, 1.4)),
  puffer: () => P('M35 77 Q60 69 85 77 L88 114 L87 138 Q60 145 33 138 L32 114 Z', '#2A3142') + both(P('M38 78 C29 77 23 83 22 92 L19 119 C19 125 33 126 35 121 L40 98 Z', '#2A3142')) + L('M33 94 Q60 100 87 94 M32 110 Q60 116 88 110 M33 125 Q60 131 87 125', 'rgba(0,0,0,.45)', 1.8) + L('M60 76 V140', 'rgba(255,255,255,.3)', 1.4)
    + P('M44 72 Q60 80 76 72 L76 80 Q60 88 44 80 Z', '#2A3142') + both(L('M21 100 Q28 103 36 100 M20 112 Q28 115 36 112', 'rgba(0,0,0,.4)', 1.6)),
  parka: () => both(P(COAT, '#2F4257') + P(SLEEVE_L, '#2F4257') + P(CUFF_L, FUR) + C(41, 104, 1.6, '#C9A66B') + C(41, 118, 1.6, '#C9A66B') + P('M31 168 L55 166 L55 177 L31 179 Z', FUR)) + P('M36 77 Q60 64 84 77 L80 86 Q60 76 40 86 Z', FUR) + L('M42 80 Q60 71 78 80', 'rgba(0,0,0,.15)', 3),
  robe: () => both(P(COAT, '#7C3AED') + P(SLEEVE_L, '#7C3AED') + P(CUFF_L, '#EDE7DA') + L('M53 74 L55 176', GOLD, 2.6) + C(44, 100, 2.6, '#34D399') + C(44, 116, 2.6, '#34D399') + P('M31 168 L55 166 L55 177 L31 179 Z', '#EDE7DA') + L('M26 96 L24 112', GOLD, 1.8))
    + P('M34 77 Q60 62 86 77 L81 88 Q60 76 39 88 Z', '#EDE7DA') + L('M40 80 Q60 69 80 80', 'rgba(0,0,0,.15)', 3),
};
const SCARF = {
  scarf: (c) => P('M40 70 Q60 86 80 70 L82 80 Q60 96 38 80 Z', c.t1) + L('M46 77 L50 88 M58 81 L62 92 M70 77 L74 88', c.t2, 3.4) + P('M68 84 L80 114 L90 108 L78 80 Z', c.t1) + L('M74 98 L84 92 M77 106 L87 100', c.t2, 3),
  goldscarf: () => P('M40 70 Q60 86 80 70 L82 80 Q60 96 38 80 Z', GOLD) + L('M46 77 L50 88 M58 81 L62 92 M70 77 L74 88', GOLD2, 3.4) + P('M68 84 L80 114 L90 108 L78 80 Z', GOLD) + L('M74 98 L84 92 M77 106 L87 100', GOLD2, 3),
};
const CHAIN = {
  silver: () => L('M46 76 Q60 112 74 76', '#8A93A5', 4.2) + L('M46 76 Q60 112 74 76', '#E5E9F0', 2.6) + C(60, 101, 3.2, '#EEF1F6'),
  gold: () => L('M46 76 Q60 114 74 76', GOLD2, 5.4) + L('M46 76 Q60 114 74 76', GOLD, 3.4) + `<rect x="55" y="100" width="10" height="10" rx="2.4" fill="${GOLD}" ${OUT}/>` + L('M58 104 H62', '#FFF3B0', 1.6),
  pendant: (c) => L('M46 76 Q60 112 74 76', GOLD2, 3.6) + L('M46 76 Q60 112 74 76', GOLD, 2.2) + C(60, 107, 8, c.t1) + `<circle cx="60" cy="107" r="3" fill="${c.tacc}"/><circle cx="60" cy="107" r="8" fill="none" stroke="${GOLD}" stroke-width="2.4"/>`,
  diamond: () => L('M44 76 Q60 118 76 76', '#B8C6D6', 5.6) + L('M44 76 Q60 118 76 76', '#E0F2FE', 3.2) + `<path d="M60 106 L68 115 L60 127 L52 115 Z" fill="#7DD3FC" ${OUT}/><path d="M60 106 L64 115 L60 127 L56 115 Z" fill="#E0F2FE" opacity=".7"/>`,
};
const WRIST = {
  band: (c) => P('M22.2 113 L34.6 115 L34 120 L21.8 118 Z', c.t1) + L('M22 116 L34.3 117.8', c.t2, 1.6),
  watch: () => P('M22.2 113 L34.6 115 L34 120 L21.8 118 Z', '#1F2937') + C(28, 116.4, 4.3, '#E2E8F0') + L('M28 116.4 V113.8 M28 116.4 L29.8 117', '#111827', 1),
  goldwatch: () => P('M22.2 113 L34.6 115 L34 120 L21.8 118 Z', GOLD) + C(28, 116.4, 4.8, GOLD) + `<circle cx="28" cy="116.4" r="3" fill="#7DD3FC" stroke="#E0F2FE" stroke-width=".8"/>`,
};
const legs = (f, y, ex = '') => both(P(`M39.5 128 L60 128 L58.5 ${y} L42 ${y} Z`, f)) + ex + L('M60 130 V148', 'rgba(0,0,0,.4)', 1.4);
const BOTTOM = {
  jeans: () => legs('#3A5A93', 192, both(L('M41 132 L43 190', 'rgba(0,0,0,.25)') + L('M43 134 Q50 142 57 135', 'rgba(255,255,255,.3)') + L('M45 160 Q50 163 56 160', 'rgba(0,0,0,.25)') + L('M43.4 186 H58.4', 'rgba(255,255,255,.22)')))
    + P('M38.5 130 H81.5 V137 H38.5 Z', '#1F2937') + `<rect x="56.4" y="131" width="7.2" height="5" rx="1" fill="none" stroke="${GOLD}" stroke-width="1.4"/>`,
  joggers: () => legs('#46546A', 190, both(P('M42 183 L58.6 183 L58.5 191 L42 191 Z', '#2B3445') + L('M41 134 L43 182', 'rgba(255,255,255,.45)', 2.2))) + P('M38.5 130 H81.5 V136 H38.5 Z', '#2B3445') + L('M56 132 L55 140 M64 132 L65 140', '#E5E9F0', 1.2),
  cargo: () => legs('#9C8B63', 192, both(P('M41 146 H53 V162 H41 Z', '#877748') + L('M41 150 H53', 'rgba(0,0,0,.3)') + L('M43.4 187 H58.4', 'rgba(0,0,0,.25)'))) + P('M38.5 130 H81.5 V136 H38.5 Z', '#6B5E3C'),
  shorts: () => both(P('M41 128 L59 128 L58 194 L43 194 Z', 'var(--sk)')) + legs('#6B8FC9', 160, both(L('M41 154 L58.5 156', 'rgba(255,255,255,.4)'))) + P('M38.5 130 H81.5 V136 H38.5 Z', '#4F73AD'),
  tshorts: (c) => both(P('M41 128 L59 128 L58 194 L43 194 Z', 'var(--sk)')) + legs(c.t1, 163, both(L('M41.4 132 L42 162', c.t2, 3.2))) + P('M38.5 130 H81.5 V136 H38.5 Z', c.t2),
  trackp: (c) => legs(c.t1, 191, both(L('M41.4 134 L43 188', c.tacc, 2.6) + P('M42 184 L58.6 184 L58.5 192 L42 192 Z', c.t2))) + P('M38.5 130 H81.5 V136 H38.5 Z', c.t2),
  leatherp: () => legs('#17171F', 192, both(L('M44 136 L45 186', 'rgba(255,255,255,.28)', 2.4) + L('M50 150 L51 180', 'rgba(255,255,255,.12)', 2))) + P('M38.5 130 H81.5 V136 H38.5 Z', '#0F0F15'),
  goldpants: () => legs(GOLD, 192, both(L('M44 136 L45 186', '#FFF3B0', 2.4) + L('M52 150 L52.6 182', '#FFF3B0', 1.4))) + P('M38.5 130 H81.5 V136 H38.5 Z', GOLD2),
};
const FOOT = 'M42 188 L58 188 L60 199 Q60 204 54 204 L38 204 Q34 203 36 199 Q41 197 42 188 Z';
const SOLE = 'M35 202.5 H60 V207 Q58 208.5 38 208.5 Q34 208 35 202.5 Z';
const shoe = (up, sole, acc, ex = '') => both(P(FOOT, up) + P(SOLE, sole) + L('M38 200 Q47 198 57 200', acc, 2) + ex);
const SHOES = {
  sneakers: () => shoe('#F8FAFC', '#CBD5E1', '#94A3B8', L('M44 191 L46 196 M48 191 L50 196', '#94A3B8', 1)),
  runners: () => shoe('#E5E7EB', '#374151', '#84CC16', L('M40 202 Q50 192 58 190', '#84CC16', 2.4)),
  slides: () => both(P('M42 192 L58 192 L60 202 Q60 205 54 205 L38 205 Q34 204 36 201 Q41 198 42 192 Z', 'var(--sk)') + P(SOLE, '#1F2937') + P('M38 197 Q48 192 59 196 L59 200 Q48 196 38 201 Z', '#1F2937')),
  hightops: (c) => both(P('M41.5 176 L58.5 176 L60 199 Q60 204 54 204 L38 204 Q34 203 36 199 Q41 197 41.5 176 Z', c.t1) + P(SOLE, '#F8FAFC') + P('M41.5 176 L58.5 176 L58.2 181 L41.6 181 Z', c.t2) + L('M44 186 H56 M43 191 H55', c.tink, 1.2) + L('M38 200 Q47 198 57 200', c.tacc, 2)),
  boots: () => both(P('M41.5 172 L58.5 172 L60 199 Q60 204 54 204 L38 204 Q34 203 36 199 Q41 197 41.5 172 Z', '#7C4A21') + P(SOLE, '#2B1B10') + L('M44 178 H56 M44 183 H56 M44 188 H56', '#E8C48A', 1.2) + P('M41.5 172 L58.5 172 L58.4 176 L41.6 176 Z', '#5A3516')),
  retros: (c) => both(P(FOOT, '#F8FAFC') + P(SOLE, '#F1F5F9') + `<path d="M42 188 L58 188 L59 194 L41 194 Z" fill="${c.t1}"/><path d="M36 199 Q41 197 42 192 L48 192 L48 204 L38 204 Q34 203 36 199 Z" fill="${c.t2}" opacity=".85"/>` + L('M38 200 Q47 198 57 200', c.tacc, 2)),
  goldkicks: () => shoe(GOLD, '#F8FAFC', '#FFF3B0', L('M44 191 L46 196 M48 191 L50 196', GOLD2, 1.2)),
};
const HAND = {
  ball: () => C(94, 138, 10, '#E8772E') + L('M84 138 H104 M94 128 V148 M86.5 131 Q94 138 86.5 145 M101.5 131 Q94 138 101.5 145', '#5B2A0A', 1.2),
  finger: (c) => `<g transform="translate(80 76) rotate(-16 15 60)" stroke="${c.t2}" stroke-width="2.2" stroke-linejoin="round"><ellipse cx="-1" cy="44" rx="5.5" ry="9" transform="rotate(-30 -1 44)" fill="${c.t1}"/><rect x="0" y="30" width="31" height="36" rx="9" fill="${c.t1}"/><rect x="14" y="16" width="16" height="22" rx="8" fill="${c.t1}"/><rect x="1" y="-2" width="14" height="38" rx="7" fill="${c.t1}"/><rect x="0" y="30" width="31" height="36" rx="9" fill="url(#hf-sh)" stroke="none"/><text x="15.5" y="53" font-family="Arial Black, Impact, sans-serif" font-size="13" font-weight="900" text-anchor="middle" fill="${c.tink}" stroke="none">#1</text></g>`,
  pennant: (c) => `<rect x="90.5" y="62" width="3.6" height="76" rx="1.6" fill="#E2E8F0" ${OUT}/>` + P('M94 64 L94 90 L118 77 Z', c.t1) + `<path d="M94 71 L94 83 L108 77 Z" fill="${c.tacc}"/>`,
  trophy: () => `<g transform="translate(79 94) scale(.82)">` + `<path d="M4 0 H28 V14 C28 22 22 28 16 28 C10 28 4 22 4 14 Z" fill="${GOLD}" ${OUT}/><path d="M4 0 H28 V14 C28 22 22 28 16 28 C10 28 4 22 4 14 Z" fill="url(#hf-sh)"/><path d="M4 4 C-6 4 -4 18 6 18 M28 4 C38 4 36 18 26 18" fill="none" stroke="${GOLD2}" stroke-width="3"/><rect x="13" y="28" width="6" height="8" fill="${GOLD2}"/><rect x="7" y="36" width="18" height="6" rx="2" fill="${GOLD}" ${OUT}/></g>`,
};

/* ----- head ----- */
const HEAD = 'M39 42 C39 26 48 18 60 18 C72 18 81 26 81 42 C81 55 74 67 60 68 C46 67 39 55 39 42 Z';
const HP = (d, h, x = '') => `<path d="${d}" fill="${h}" stroke="rgba(8,10,28,.5)" stroke-width="1.2" stroke-linejoin="round" ${x}/><path d="${d}" fill="url(#hf-sv)"/>`;
const SHINE = (d) => L(d, 'rgba(255,255,255,.28)', 1.4);
const SHORT = 'M38 46 C33 22 46 11 60 11 C74 11 87 22 82 46 C81 36 75 29 67 27 C58 32 46 31 38 46 Z';
const HAIR_BACK = {
  afro: (h) => HP('M60 0 C84 0 94 18 90 38 C88 48 82 50 80 44 L40 44 C38 50 32 48 30 38 C26 18 36 0 60 0 Z', h),
  long: (h) => HP('M36 44 C33 16 46 8 60 8 C74 8 87 16 84 44 L90 104 Q60 114 30 104 Z', h),
  bob: (h) => HP('M36 44 C33 16 46 8 60 8 C74 8 87 16 84 44 L87 76 Q60 84 33 76 Z', h),
  ponytail: (h) => `<path d="M44 22 C22 26 18 66 30 98" fill="none" stroke="rgba(8,10,28,.5)" stroke-width="12" stroke-linecap="round"/><path d="M44 22 C22 26 18 66 30 98" fill="none" stroke="${h}" stroke-width="9.5" stroke-linecap="round"/>` + L('M42 28 C26 34 23 62 31 92', 'rgba(255,255,255,.25)', 1.6) + `<circle cx="42" cy="26" r="3.4" fill="${GOLD}"/>`,
  braids: (h) => `<g fill="none" stroke-linecap="round"><g stroke="rgba(8,10,28,.5)" stroke-width="9"><path d="M38 38 L31 104"/><path d="M44 50 L40 112"/><path d="M82 38 L89 104"/><path d="M76 50 L80 112"/></g><g stroke="${h}" stroke-width="6.6"><path d="M38 38 L31 104"/><path d="M44 50 L40 112"/><path d="M82 38 L89 104"/><path d="M76 50 L80 112"/></g><g stroke="rgba(0,0,0,.35)" stroke-width="1.2" stroke-dasharray="2 3"><path d="M38 38 L31 104"/><path d="M44 50 L40 112"/><path d="M82 38 L89 104"/><path d="M76 50 L80 112"/></g></g><g fill="#F8FAFC"><circle cx="31" cy="106" r="3"/><circle cx="40" cy="114" r="3"/><circle cx="89" cy="106" r="3"/><circle cx="80" cy="114" r="3"/></g>`,
  dreads: (h) => `<g fill="none" stroke-linecap="round"><g stroke="rgba(8,10,28,.5)" stroke-width="10"><path d="M38 36 Q27 70 33 104"/><path d="M44 50 Q38 82 44 114"/><path d="M82 36 Q93 70 87 104"/><path d="M76 50 Q82 82 76 114"/></g><g stroke="${h}" stroke-width="7.6"><path d="M38 36 Q27 70 33 104"/><path d="M44 50 Q38 82 44 114"/><path d="M82 36 Q93 70 87 104"/><path d="M76 50 Q82 82 76 114"/></g></g>`,
};
const HAIR_FRONT = {
  short: (h) => HP(SHORT, h) + SHINE('M46 19 Q54 14 62 14') + L('M66 20 Q74 22 78 28', 'rgba(255,255,255,.2)', 1.3),
  buzz: (h) => HP('M40 40 C38 24 48 16 60 16 C72 16 82 24 80 40 C77 31 70 26 60 26 C50 26 43 31 40 40 Z', h, 'opacity=".92"'),
  fade: (h) => HP('M40 38 C38 22 48 13 60 13 C72 13 82 22 80 38 C77 29 70 24 60 24 C50 24 43 29 40 38 Z', h) + `<path d="M39 40 C39 48 40 52 41 54 L42 44 Z M81 40 C81 48 80 52 79 54 L78 44 Z" fill="${h}" opacity=".45"/>` + SHINE('M48 17 Q56 13 64 14'),
  curly: (h) => `<g fill="${h}" ${OUT}><circle cx="42" cy="30" r="10"/><circle cx="54" cy="20" r="11"/><circle cx="67" cy="20" r="11"/><circle cx="79" cy="31" r="10"/><circle cx="37" cy="42" r="7"/><circle cx="83" cy="42" r="7"/></g><g fill="url(#hf-sv)"><circle cx="54" cy="20" r="11"/><circle cx="67" cy="20" r="11"/></g>` + `<path d="M42 34 Q60 22 78 34 Q74 26 60 24 Q46 26 42 34 Z" fill="${h}"/>`,
  afro: (h) => HP('M39 40 C40 26 50 20 60 20 C70 20 80 26 81 40 C76 33 68 30 60 30 C52 30 44 33 39 40 Z', h),
  long: (h) => HP('M37 46 C34 20 46 11 60 11 C74 11 86 20 83 46 C80 34 74 27 62 26 C52 30 42 34 37 46 Z', h) + SHINE('M46 17 Q54 13 62 15'),
  bob: (h) => HP('M37 48 C34 20 46 11 60 11 C74 11 86 20 83 48 C80 36 74 28 62 26 C52 32 42 36 37 48 Z', h) + SHINE('M46 17 Q54 13 62 15'),
  ponytail: (h) => HP(SHORT, h) + SHINE('M46 19 Q54 14 62 14'),
  bun: (h) => `<circle cx="60" cy="8" r="9.5" fill="${h}" ${OUT}/><circle cx="60" cy="8" r="9.5" fill="url(#hf-sh)"/>` + HP(SHORT, h) + SHINE('M46 19 Q54 14 62 14'),
  slick: (h) => HP('M38 46 C34 22 48 10 64 10 C78 10 87 24 82 46 C80 34 72 22 60 21 C48 22 40 32 38 46 Z', h) + SHINE('M46 20 Q58 13 72 17') + SHINE('M42 28 Q54 19 70 22') + SHINE('M40 36 Q50 27 66 28'),
  braids: (h) => HP(SHORT, h) + L('M50 16 Q48 24 46 30 M58 13 Q58 22 58 29 M66 14 Q68 22 70 28', 'rgba(0,0,0,.35)', 1.4),
  twists: (h) => HP('M38 44 C35 24 46 14 60 14 C74 14 85 24 82 44 C78 34 72 28 60 28 C48 28 42 34 38 44 Z', h) + `<g stroke="${h}" stroke-width="6" stroke-linecap="round" ${''}><path d="M44 22 L42 8"/><path d="M52 18 L51 3"/><path d="M60 16 L60 1"/><path d="M68 18 L69 3"/><path d="M76 22 L78 8"/></g><g stroke="rgba(0,0,0,.35)" stroke-width="1.2" stroke-dasharray="2 2.6"><path d="M44 22 L42 8"/><path d="M52 18 L51 3"/><path d="M60 16 L60 1"/><path d="M68 18 L69 3"/><path d="M76 22 L78 8"/></g>`,
  mohawk: (h) => HP('M52 30 L53 4 L60 14 L67 2 L68 30 Z', h) + `<path d="M40 40 C42 30 78 30 80 40 C74 34 46 34 40 40 Z" fill="${h}" opacity=".45"/>`,
  dreads: (h) => HP(SHORT, h) + L('M48 18 Q46 24 44 30 M56 14 Q55 22 54 28 M64 14 Q66 22 66 28', 'rgba(0,0,0,.35)', 1.4),
};
const HAT = {
  cap: (c) => P('M38 32 C37 10 48 6 60 6 C72 6 83 10 82 32 Z', c.t1) + L('M60 8 V30', 'rgba(0,0,0,.25)') + `<circle cx="60" cy="7" r="2.6" fill="${c.t2}"/>` + P('M33 32 H72 Q66 42 33 39 Z', c.t2),
  snapback: (c) => P('M38 32 C37 10 48 6 60 6 C72 6 83 10 82 32 Z', c.t1) + `<circle cx="60" cy="19" r="5" fill="${c.tacc}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>` + P('M28 31 H92 L90 38 H30 Z', c.t2),
  beanie: (c) => P('M37 36 C36 12 48 6 60 6 C72 6 84 12 83 36 Z', c.t1) + P('M35 30 H85 V40 H35 Z', c.t2) + L('M42 31 V39 M50 31 V39 M58 31 V39 M66 31 V39 M74 31 V39', 'rgba(0,0,0,.25)') + C(60, 4, 6, c.tacc),
  headband: (c) => P('M38 28 Q60 20 82 28 L82 35 Q60 27 38 35 Z', c.t1) + L('M39 31.5 Q60 23.5 81 31.5', c.tacc, 2),
  durag: (c) => P('M38 40 C35 16 48 8 60 8 C72 8 85 16 82 40 Q60 30 38 40 Z', c.t1) + L('M44 24 Q60 18 76 24', 'rgba(255,255,255,.25)', 1.4) + P('M82 38 L98 48 L94 56 L80 44 Z', c.t1) + P('M38 38 L22 48 L26 56 L40 44 Z', c.t1),
  bucket: (c) => P('M40 32 C39 12 48 8 60 8 C72 8 81 12 80 32 Z', c.t1) + P('M24 34 C24 28 40 28 60 28 C80 28 96 28 96 34 C96 42 78 42 60 42 C42 42 24 42 24 34 Z', c.t2),
  helmet: (c) => P('M34 46 C30 12 48 2 60 2 C72 2 90 12 86 46 L80 52 L80 36 C70 30 50 30 40 36 L40 52 Z', c.t1) + L('M60 3 V28', c.tacc, 4) + P('M40 36 H80 L82 40 H38 Z', 'rgba(0,0,0,.25)') + L('M44 48 H76 M46 55 H74 M44 41 V57 M52 44 V59 M60 44 V60 M68 44 V59 M76 41 V57', '#D1D5DB', 1.8),
  crown: () => P('M36 34 L35 8 L48 20 L60 2 L72 20 L85 8 L84 34 Z', GOLD) + `<circle cx="60" cy="19" r="3.6" fill="#EF4444"/><circle cx="45" cy="28" r="2.6" fill="#38BDF8"/><circle cx="75" cy="28" r="2.6" fill="#38BDF8"/>` + L('M38 31 H82', GOLD2, 1.4),
};
const BEARD = {
  stubble: (h) => `<path d="M41 44 C41 62 50 70 60 70 C70 70 79 62 79 44 C76 54 70 58 60 58 C50 58 44 54 41 44 Z" fill="${h}" opacity=".3"/>`,
  stache: (h) => `<path d="M49 55 Q55 51 60 54 Q65 51 71 55 Q65 58 60 56.5 Q55 58 49 55 Z" fill="${h}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>`,
  goatee: (h) => `<path d="M49 55 Q55 51 60 54 Q65 51 71 55 Q65 58 60 56.5 Q55 58 49 55 Z" fill="${h}" stroke="rgba(0,0,0,.4)" stroke-width="1"/><path d="M53 63 Q60 61 67 63 Q65 71 60 72 Q55 71 53 63 Z" fill="${h}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>`,
  beard: (h) => `<path d="M39 44 C39 62 48 74 60 74 C72 74 81 62 81 44 C79 54 74 58 68 58 Q60 54 52 58 C46 58 41 54 39 44 Z" fill="${h}" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/><path d="M39 44 C39 62 48 74 60 74 C72 74 81 62 81 44 C79 54 74 58 68 58 Q60 54 52 58 C46 58 41 54 39 44 Z" fill="url(#hf-sv)"/>`,
};
const EAR = {
  studs: () => `<circle cx="39.4" cy="52" r="2.1" fill="#E0F2FE" stroke="#7DD3FC" stroke-width=".8"/><circle cx="80.6" cy="52" r="2.1" fill="#E0F2FE" stroke="#7DD3FC" stroke-width=".8"/>`,
  hoops: () => `<circle cx="38.6" cy="56.5" r="4.6" fill="none" stroke="${GOLD}" stroke-width="1.8"/><circle cx="81.4" cy="56.5" r="4.6" fill="none" stroke="${GOLD}" stroke-width="1.8"/>`,
};
const FACE = {
  shades: () => `<path d="M42 38 H58 Q58 50 50 50 Q42 50 42 38 Z M62 38 H78 Q78 50 70 50 Q62 50 62 38 Z" fill="#0D1117" ${OUT}/><path d="M58 40 Q60 38.5 62 40" fill="none" stroke="#0D1117" stroke-width="2.4"/>` + L('M44 41 L50 40 M64 41 L70 40', 'rgba(255,255,255,.4)', 1.6) + L('M42 39 L38 38 M78 39 L82 38', '#0D1117', 2),
  eyeblack: () => L('M44 50 H57 M63 50 H76', '#0F172A', 4.4),
  paint: (c) => L('M41 50 H50', c.t1, 4.4) + L('M41 57 H48', c.t2, 4.4) + L('M79 50 H70', c.t1, 4.4) + L('M79 57 H72', c.t2, 4.4),
  grill: () => `<path d="M53 57.6 Q60 62 67 57.6 L67 61 Q60 65.4 53 61 Z" fill="${GOLD}" stroke="${GOLD2}" stroke-width="1"/>` + L('M56 59.4 V63 M60 60.4 V64 M64 59.4 V63', GOLD2, 1),
  visor: () => `<path d="M39 38 Q60 31 81 38 L80 49 Q60 55 40 49 Z" fill="${GOLD}" opacity=".95" ${OUT}/>` + L('M43 42 Q60 36 77 42', '#FFF7D6', 2.2),
};

/** Returns the SVG markup for a character. vb overrides the view box (used for shop previews and busts). */
export function avatarSvg(av, team, vb) {
  const c = palette(team);
  const eq = av.eq || {};
  const skin = SKINS[av.skin] ?? SKINS[2];
  const hair = HAIR_COLORS[av.hairColor] ?? HAIR_COLORS[0];
  const hd = eq.hair || 'short';
  const pick = (map, id, fallback) => (map[id] ? map[id](c, hair, skin) : fallback ? map[fallback](c, hair, skin) : '');
  const sk = (s) => s.replace(/var\(--sk\)/g, skin);
  const hand = `<circle cx="28" cy="127" r="5.6" fill="${skin}" ${OUT}/><circle cx="28" cy="127" r="5.6" fill="url(#hf-sh)"/>`;
  const out = [];
  out.push(`<svg viewBox="${vb || '-12 0 144 214'}" role="img" aria-label="Your fan character" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`, DEFS);
  out.push('<ellipse cx="60" cy="208" rx="38" ry="5" fill="rgba(0,0,0,.3)"/>');
  out.push(pick(BACK, eq.back));
  out.push(HAIR_BACK[hd] ? HAIR_BACK[hd](hair) : '');
  out.push(sk(`<g>${both(P('M41 128 L59 128 L58 194 L43 194 Z', skin))}</g>`));
  out.push(sk(pick(SHOES, eq.shoes, 'sneakers')));
  out.push(sk(pick(BOTTOM, eq.bottom, 'jeans')));
  out.push(both(P(ARM, skin)) + both(hand));
  out.push(`<rect x="51" y="60" width="18" height="22" rx="7" fill="${skin}" ${OUT}/><path d="M51 66 Q60 78 69 66 V74 H51 Z" fill="rgba(0,0,0,.22)"/>`);
  out.push(P(TORSO, skin));
  out.push(pick(TOP, eq.top, 'tee'));
  out.push(pick(OUTER, eq.outer));
  out.push(pick(SCARF, eq.scarf));
  out.push(pick(CHAIN, eq.chain));
  out.push(pick(WRIST, eq.wrist));
  // head
  out.push(`<ellipse cx="39.4" cy="46" rx="3.8" ry="5.8" fill="${skin}" ${OUT}/><ellipse cx="80.6" cy="46" rx="3.8" ry="5.8" fill="${skin}" ${OUT}/>`);
  out.push(pick(EAR, eq.ear));
  out.push(P(HEAD, skin));
  out.push(`<circle cx="46" cy="53" r="5" fill="#F0605D" opacity=".16"/><circle cx="74" cy="53" r="5" fill="#F0605D" opacity=".16"/>`);
  out.push(pick(BEARD, eq.beard));
  // eyes, brows, nose, mouth: a relaxed, slightly cool look
  const eye = `<ellipse cx="51" cy="44.4" rx="4.6" ry="3.3" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width=".8"/><circle cx="51.8" cy="44.6" r="2.5" fill="#33241A"/><circle cx="51.8" cy="44.6" r="1.2" fill="#0B0B10"/><circle cx="52.6" cy="43.6" r=".9" fill="#fff"/>`
    + `<path d="M46.2 43.4 Q51 40.2 55.8 43.4" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/><path d="M46 38.4 Q51 36.4 56 38.8" fill="none" stroke="#2A1C12" stroke-opacity=".85" stroke-width="2.6" stroke-linecap="round"/>`;
  out.push(both(eye).replace(/<g transform="matrix\(-1 0 0 1 120 0\)">/, '<g transform="matrix(-1 0 0 1 120 0)">'));
  out.push(L('M60 46 Q58.4 52 60.4 53.4 Q62.4 53.6 63.4 52', 'rgba(60,20,10,.4)', 1.3));
  out.push(`<path d="M53 58 Q60 62.4 67.4 57.6" fill="none" stroke="#4A2323" stroke-width="2" stroke-linecap="round"/><path d="M56 60.4 Q60 62.4 64 60.4" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.2" stroke-linecap="round"/>`);
  out.push(pick(FACE, eq.face));
  out.push(HAIR_FRONT[hd] ? HAIR_FRONT[hd](hair) : '');
  out.push(pick(HAT, eq.hat));
  out.push(sk(pick(HAND, eq.hand)));
  out.push('</svg>');
  return out.join('');
}

/** A DOM element with the character in it. Add 'bust' to the class for just head and shoulders. */
export function renderAvatar(av = getState().avatar, team = avatarTeam(av), cls = '') {
  const el = document.createElement('span');
  el.className = 'avatar ' + cls;
  el.innerHTML = avatarSvg(av, team, /\bbust\b/.test(cls) ? BUST : undefined);
  return el;
}
const BUST = '8 0 104 104';
const VB = { hair: BUST, hat: BUST, face: BUST, beard: BUST, ear: BUST, top: '0 62 120 100', outer: '0 62 120 120', scarf: '8 58 104 80', chain: '20 60 80 66', wrist: '4 92 48 48', bottom: '16 118 88 96', shoes: '14 164 92 52', back: '-12 0 144 214', hand: '-12 0 144 214' };
/** Preview of just one item on the current character, zoomed to where it is worn. */
export function previewSvg(item, av = getState().avatar, team = avatarTeam(av)) {
  return avatarSvg({ ...av, eq: { ...av.eq, [item.slot]: item.id } }, team, VB[item.slot]);
}
