// Your fan character: a flat, emoji-style SVG figure, the item catalog, and the shop rules.
// Everything here is cosmetic. Nothing changes odds or payouts.
import { getState, myTeams, buyItem, grantItem, setAvatar } from './store.js';
import { betStats } from './bets.js';
import { skinFromColors } from './util.js';

export const SKINS = ['#FFCB47', '#FDDCB5', '#F2C294', '#D9A066', '#B27546', '#8A5530', '#5C3A21'];
export const HAIR_COLORS = ['#2B2118', '#5A3825', '#A0642D', '#E0B65A', '#C9CED8', '#E8553D', '#3B82F6', '#8B5CF6', '#EC4899', '#22C55E'];
export const SLOTS = [
  { id: 'hair', label: 'Hair' }, { id: 'hat', label: 'Hats' }, { id: 'face', label: 'Face' }, { id: 'chain', label: 'Chains' },
  { id: 'top', label: 'Tops' }, { id: 'scarf', label: 'Scarves' }, { id: 'back', label: 'Capes' }, { id: 'hand', label: 'In hand' },
];
export const TIERS = { free: { label: 'Free', price: 0 }, common: { label: 'Common', price: 100 }, rare: { label: 'Rare', price: 500 }, legend: { label: 'Legendary', price: 2500 }, earned: { label: 'Earned', price: 0 } };

// team: the item picks up the colours of the team you chose for your character.
// ach: cannot be bought; it unlocks by doing something.
const I = (id, slot, name, tier, extra) => ({ id, slot, name, tier, price: TIERS[tier].price, ...extra });
export const ITEMS = [
  I('short', 'hair', 'Short cut', 'free'), I('buzz', 'hair', 'Buzz cut', 'free'), I('curly', 'hair', 'Curls', 'free'),
  I('afro', 'hair', 'Afro', 'common'), I('long', 'hair', 'Long hair', 'common'), I('bun', 'hair', 'Top bun', 'common'),
  I('braids', 'hair', 'Braids', 'rare'), I('mohawk', 'hair', 'Mohawk', 'rare'), I('dreads', 'hair', 'Dreads', 'rare'),

  I('cap', 'hat', 'Team cap', 'common', { team: true }), I('beanie', 'hat', 'Team beanie', 'common', { team: true }), I('headband', 'hat', 'Headband', 'common', { team: true }),
  I('bucket', 'hat', 'Bucket hat', 'rare', { team: true }), I('crown', 'hat', 'Gold crown', 'legend'),

  I('shades', 'face', 'Shades', 'common'), I('eyeblack', 'face', 'Eye black', 'common'), I('paint', 'face', 'Face paint', 'common', { team: true }),
  I('grill', 'face', 'Gold grill', 'rare'), I('visor', 'face', 'Gold visor', 'legend'),

  I('silver', 'chain', 'Silver chain', 'common'), I('gold', 'chain', 'Gold chain', 'rare'), I('pendant', 'chain', 'Team pendant', 'rare', { team: true }), I('diamond', 'chain', 'Diamond chain', 'legend'),

  I('tee', 'top', 'Plain tee', 'free'), I('jersey', 'top', 'Team jersey', 'common', { team: true }), I('hoodie', 'top', 'Team hoodie', 'rare', { team: true }),
  I('varsity', 'top', 'Varsity jacket', 'rare', { team: true }), I('robe', 'top', 'Champion robe', 'legend'),
  I('ghost', 'top', 'Ghost sheet', 'earned', { ach: 'Get rescued with free coins once' }),

  I('scarf', 'scarf', 'Team scarf', 'common', { team: true }), I('goldscarf', 'scarf', 'Golden scarf', 'earned', { ach: 'Win 5 bets in a row' }),

  I('cape', 'back', 'Team cape', 'rare', { team: true }), I('trophycape', 'back', 'Trophy cape', 'earned', { ach: 'Hit a parlay' }),

  I('finger', 'hand', 'Foam finger', 'common', { team: true }), I('pennant', 'hand', 'Pennant', 'common', { team: true }), I('trophy', 'hand', 'Trophy', 'legend'),
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
  if (slot === 'hair' || slot === 'top') return false; // always keep hair and a top on
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
const GOLD = '#F5C542', GOLD2 = '#C99A1B';

const BACK = {
  cape: (c) => `<path d="M26 92 L10 140 L110 140 L94 92 Z" fill="${c.t2}"/><path d="M26 92 L18 140 L40 140 Z" fill="${c.t1}" opacity=".55"/>`,
  trophycape: () => `<path d="M26 92 L8 140 L112 140 L94 92 Z" fill="#7C3AED"/><path d="M26 92 L8 140 L30 140 Z" fill="${GOLD}"/><path d="M94 92 L112 140 L90 140 Z" fill="${GOLD}"/>`,
};
const TOP = {
  tee: () => `<path d="M22 140 C22 110 38 96 60 96 C82 96 98 110 98 140 Z" fill="#64748B"/>`,
  jersey: (c) => `<path d="M20 140 C20 108 38 96 60 96 C82 96 100 108 100 140 Z" fill="${c.t1}"/><path d="M20 140 C20 120 24 110 30 104 L38 112 C34 120 32 130 32 140 Z" fill="${c.t2}"/><path d="M100 140 C100 120 96 110 90 104 L82 112 C86 120 88 130 88 140 Z" fill="${c.t2}"/><path d="M48 96 Q60 108 72 96" fill="none" stroke="${c.tacc}" stroke-width="3"/><text x="60" y="130" font-family="Arial Black, Impact, sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="${c.tink}">7</text>`,
  hoodie: (c) => `<path d="M20 140 C20 108 38 96 60 96 C82 96 100 108 100 140 Z" fill="${c.t1}"/><path d="M40 98 C46 112 74 112 80 98 C74 92 46 92 40 98Z" fill="${c.t2}"/><path d="M54 108 L52 126 M66 108 L68 126" stroke="${c.tink}" stroke-width="2.5" stroke-linecap="round"/><rect x="46" y="124" width="28" height="12" rx="6" fill="${c.t2}" opacity=".7"/>`,
  varsity: (c) => `<path d="M20 140 C20 108 38 96 60 96 C82 96 100 108 100 140 Z" fill="${c.t2}"/><path d="M20 140 C20 120 24 110 30 104 L40 112 C36 122 34 130 34 140 Z" fill="${c.t1}"/><path d="M100 140 C100 120 96 110 90 104 L80 112 C84 122 86 130 86 140 Z" fill="${c.t1}"/><path d="M60 98 L60 140" stroke="${c.tacc}" stroke-width="2.5"/><circle cx="76" cy="116" r="6" fill="${c.tacc}"/>`,
  robe: () => `<path d="M16 140 C16 106 36 94 60 94 C84 94 104 106 104 140 Z" fill="#7C3AED"/><path d="M46 96 L60 140 L74 96 Z" fill="#F8FAFC"/><path d="M42 94 Q60 112 78 94" fill="none" stroke="${GOLD}" stroke-width="5"/><circle cx="60" cy="118" r="3" fill="${GOLD}"/><circle cx="60" cy="130" r="3" fill="${GOLD}"/>`,
  ghost: () => `<path d="M18 140 L18 112 C18 100 36 94 60 94 C84 94 102 100 102 112 L102 140 L92 132 L82 140 L71 132 L60 140 L49 132 L38 140 L28 132 Z" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="2"/>`,
};
const SCARF = {
  scarf: (c) => `<path d="M38 92 Q60 110 82 92 L84 102 Q60 120 36 102 Z" fill="${c.t1}"/><path d="M46 99 L50 108 M58 103 L62 112 M70 103 L74 108" stroke="${c.t2}" stroke-width="4"/><path d="M70 106 L80 130 L90 124 L82 104 Z" fill="${c.t1}"/><path d="M76 118 L86 112" stroke="${c.t2}" stroke-width="3.5"/>`,
  goldscarf: () => `<path d="M38 92 Q60 110 82 92 L84 102 Q60 120 36 102 Z" fill="${GOLD}"/><path d="M46 99 L50 108 M58 103 L62 112 M70 103 L74 108" stroke="${GOLD2}" stroke-width="4"/><path d="M70 106 L80 130 L90 124 L82 104 Z" fill="${GOLD}"/><path d="M76 118 L86 112" stroke="${GOLD2}" stroke-width="3.5"/>`,
};
const CHAIN = {
  silver: () => `<path d="M42 98 Q60 124 78 98" fill="none" stroke="#D5DAE3" stroke-width="3.5" stroke-linecap="round"/><circle cx="60" cy="116" r="4" fill="#EEF1F6"/>`,
  gold: () => `<path d="M42 98 Q60 124 78 98" fill="none" stroke="${GOLD}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="6 2.5"/><rect x="55" y="113" width="10" height="10" rx="2" fill="${GOLD}" stroke="${GOLD2}" stroke-width="1.5"/>`,
  pendant: (c) => `<path d="M42 98 Q60 124 78 98" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="120" r="8" fill="${c.t1}" stroke="${GOLD}" stroke-width="2.5"/><circle cx="60" cy="120" r="3" fill="${c.tacc}"/>`,
  diamond: () => `<path d="M40 98 Q60 128 80 98" fill="none" stroke="#E2E8F0" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 5.5"/><path d="M40 98 Q60 128 80 98" fill="none" stroke="#7DD3FC" stroke-width="2" stroke-linecap="round"/><path d="M60 116 L68 124 L60 134 L52 124 Z" fill="#7DD3FC" stroke="#E0F2FE" stroke-width="2"/>`,
};
const FACE = {
  shades: () => `<rect x="36" y="46" width="21" height="13" rx="5" fill="#111827"/><rect x="63" y="46" width="21" height="13" rx="5" fill="#111827"/><path d="M57 51 H63" stroke="#111827" stroke-width="3"/><path d="M40 49 L46 49" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>`,
  eyeblack: () => `<path d="M38 62 H52 M68 62 H82" stroke="#0F172A" stroke-width="5" stroke-linecap="round"/>`,
  paint: (c) => `<path d="M33 58 H52" stroke="${c.t1}" stroke-width="5" stroke-linecap="round"/><path d="M33 66 H48" stroke="${c.t2}" stroke-width="5" stroke-linecap="round"/><path d="M87 58 H68" stroke="${c.t1}" stroke-width="5" stroke-linecap="round"/><path d="M87 66 H72" stroke="${c.t2}" stroke-width="5" stroke-linecap="round"/>`,
  grill: () => `<path d="M48 72 Q60 80 72 72 L72 77 Q60 84 48 77 Z" fill="${GOLD}" stroke="${GOLD2}" stroke-width="1.2"/>`,
  visor: () => `<path d="M30 46 Q60 38 90 46 L88 60 Q60 66 32 60 Z" fill="${GOLD}" opacity=".95"/><path d="M36 50 Q60 44 84 50" fill="none" stroke="#FFF7D6" stroke-width="3" stroke-linecap="round"/><path d="M30 46 Q60 38 90 46 L88 60 Q60 66 32 60 Z" fill="none" stroke="${GOLD2}" stroke-width="2"/>`,
};
const HAIR_BACK = {
  afro: (h) => `<circle cx="60" cy="38" r="37" fill="${h}"/>`,
  long: (h) => `<path d="M30 48 C28 24 44 18 60 18 C76 18 92 24 90 48 L94 96 Q60 106 26 96 Z" fill="${h}"/>`,
  braids: (h) => `<g stroke="${h}" stroke-width="7" stroke-linecap="round"><path d="M32 50 L28 96"/><path d="M40 54 L38 104"/><path d="M88 50 L92 96"/><path d="M80 54 L82 104"/></g><g fill="#F8FAFC"><circle cx="28" cy="98" r="3"/><circle cx="38" cy="106" r="3"/><circle cx="92" cy="98" r="3"/><circle cx="82" cy="106" r="3"/></g>`,
  dreads: (h) => `<g stroke="${h}" stroke-width="8" stroke-linecap="round" fill="none"><path d="M30 46 Q22 70 28 98"/><path d="M38 52 Q32 76 38 106"/><path d="M90 46 Q98 70 92 98"/><path d="M82 52 Q88 76 82 106"/></g>`,
};
const HAIR_FRONT = {
  short: (h) => `<path d="M32 52 C28 26 46 18 60 18 C76 18 92 26 88 52 C84 42 78 36 70 34 C60 40 42 38 32 52Z" fill="${h}"/>`,
  buzz: (h) => `<path d="M34 48 C34 30 46 22 60 22 C74 22 86 30 86 48 C80 38 70 33 60 33 C50 33 40 38 34 48Z" fill="${h}" opacity=".85"/>`,
  curly: (h) => `<g fill="${h}"><circle cx="40" cy="34" r="11"/><circle cx="54" cy="26" r="12"/><circle cx="68" cy="26" r="12"/><circle cx="81" cy="35" r="11"/><circle cx="34" cy="46" r="8"/><circle cx="87" cy="46" r="8"/></g>`,
  afro: (h) => `<path d="M32 50 C34 36 46 32 60 32 C74 32 86 36 88 50 C80 44 70 42 60 42 C50 42 40 44 32 50Z" fill="${h}"/>`,
  long: (h) => `<path d="M32 52 C30 28 46 20 60 20 C76 20 90 28 88 52 C80 40 70 34 56 34 C44 34 38 42 32 52Z" fill="${h}"/>`,
  bun: (h) => `<circle cx="60" cy="14" r="10" fill="${h}"/><path d="M32 52 C28 28 46 20 60 20 C76 20 92 28 88 52 C84 42 78 36 70 34 C60 40 42 38 32 52Z" fill="${h}"/>`,
  braids: (h) => `<path d="M32 52 C28 26 46 18 60 18 C76 18 92 26 88 52 C84 42 78 36 70 34 C60 40 42 38 32 52Z" fill="${h}"/>`,
  mohawk: (h) => `<path d="M50 32 L52 6 L60 14 L68 4 L70 32 Z" fill="${h}"/><path d="M36 44 C40 34 80 34 84 44 C76 38 44 38 36 44Z" fill="${h}" opacity=".5"/>`,
  dreads: (h) => `<path d="M32 52 C28 26 46 18 60 18 C76 18 92 26 88 52 C84 42 78 36 70 34 C60 40 42 38 32 52Z" fill="${h}"/>`,
};
const HAT = {
  cap: (c) => `<path d="M33 42 C33 22 46 16 60 16 C74 16 87 22 87 42 Z" fill="${c.t1}"/><path d="M30 42 H66 Q60 50 30 48 Z" fill="${c.t2}"/><circle cx="60" cy="18" r="3" fill="${c.t2}"/><path d="M60 22 V40" stroke="${c.t2}" stroke-width="1.5" opacity=".6"/>`,
  beanie: (c) => `<path d="M33 44 C33 20 46 14 60 14 C74 14 87 20 87 44 Z" fill="${c.t1}"/><rect x="31" y="38" width="58" height="10" rx="5" fill="${c.t2}"/><circle cx="60" cy="10" r="6" fill="${c.tacc}"/>`,
  headband: (c) => `<path d="M33 40 Q60 30 87 40 L87 47 Q60 37 33 47 Z" fill="${c.t1}"/><path d="M33 43 Q60 33 87 43" fill="none" stroke="${c.tacc}" stroke-width="2"/>`,
  bucket: (c) => `<path d="M36 40 C36 22 46 18 60 18 C74 18 84 22 84 40 Z" fill="${c.t1}"/><path d="M22 44 C22 38 36 38 60 38 C84 38 98 38 98 44 C98 50 80 50 60 50 C40 50 22 50 22 44Z" fill="${c.t2}"/>`,
  crown: () => `<path d="M36 40 L36 18 L48 28 L60 10 L72 28 L84 18 L84 40 Z" fill="${GOLD}" stroke="${GOLD2}" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="24" r="3.5" fill="#EF4444"/><circle cx="46" cy="33" r="2.5" fill="#38BDF8"/><circle cx="74" cy="33" r="2.5" fill="#38BDF8"/>`,
};
const HAND = {
  finger: (c) => `<g transform="translate(88 64)" stroke="${c.t2}" stroke-width="2.2" stroke-linejoin="round"><ellipse cx="-1" cy="46" rx="5" ry="9" transform="rotate(-25 -1 46)" fill="${c.t1}"/><rect x="12" y="20" width="19" height="16" rx="8" fill="${c.t1}"/><rect x="2" y="0" width="11" height="40" rx="5.5" fill="${c.t1}"/><rect x="0" y="30" width="31" height="40" rx="9" fill="${c.t1}"/><text x="15.5" y="57" font-family="Arial Black, Impact, sans-serif" font-size="13" font-weight="900" text-anchor="middle" fill="${c.tink}" stroke="none">#1</text></g>`,
  pennant: (c) => `<rect x="95" y="62" width="3.5" height="70" rx="1.5" fill="#E2E8F0"/><path d="M98 64 L98 90 L118 77 Z" fill="${c.t1}"/><path d="M98 71 L98 83 L110 77 Z" fill="${c.tacc}"/>`,
  trophy: () => `<g transform="translate(90 92) scale(.75)"><path d="M4 0 H28 V14 C28 22 22 28 16 28 C10 28 4 22 4 14 Z" fill="${GOLD}" stroke="${GOLD2}" stroke-width="2"/><path d="M4 4 C-6 4 -4 18 6 18 M28 4 C38 4 36 18 26 18" fill="none" stroke="${GOLD2}" stroke-width="3"/><rect x="13" y="28" width="6" height="8" fill="${GOLD2}"/><rect x="7" y="36" width="18" height="6" rx="2" fill="${GOLD}" stroke="${GOLD2}" stroke-width="1.5"/></g>`,
};

/** Returns the SVG markup for a character. */
export function avatarSvg(av, team) {
  const c = palette(team);
  const eq = av.eq || {};
  const skin = SKINS[av.skin] || SKINS[2];
  const hair = HAIR_COLORS[av.hairColor] || HAIR_COLORS[0];
  const hd = eq.hair || 'short';
  const layer = (map, id) => (id && map[id] ? map[id](c, hair) : '');
  const hairFront = HAIR_FRONT[hd] ? HAIR_FRONT[hd](hair) : '';
  const hairBack = HAIR_BACK[hd] ? HAIR_BACK[hd](hair) : '';
  const hatOn = !!eq.hat && !!HAT[eq.hat];
  const shade = skin === SKINS[0] ? '#E8A92B' : 'rgba(0,0,0,.14)';
  return `<svg viewBox="0 0 120 140" role="img" aria-label="Your fan character" xmlns="http://www.w3.org/2000/svg">`
    + layer(BACK, eq.back) + hairBack
    + `<rect x="50" y="76" width="20" height="24" rx="8" fill="${skin}"/><path d="M50 90 Q60 98 70 90 V84 H50Z" fill="${shade}"/>`
    + (TOP[eq.top] ? TOP[eq.top](c) : TOP.tee(c))
    + layer(SCARF, eq.scarf) + layer(CHAIN, eq.chain)
    + `<ellipse cx="33" cy="58" rx="5" ry="7" fill="${skin}"/><ellipse cx="87" cy="58" rx="5" ry="7" fill="${skin}"/>`
    + `<ellipse cx="60" cy="54" rx="28" ry="30" fill="${skin}"/>`
    + `<ellipse cx="44" cy="52" rx="3.4" ry="4.4" fill="#1F2937"/><ellipse cx="76" cy="52" rx="3.4" ry="4.4" fill="#1F2937"/><circle cx="45.2" cy="50.6" r="1.1" fill="#fff"/><circle cx="77.2" cy="50.6" r="1.1" fill="#fff"/>`
    + `<path d="M50 68 Q60 77 70 68" fill="none" stroke="#1F2937" stroke-width="3" stroke-linecap="round"/>`
    + `<circle cx="38" cy="64" r="4.5" fill="#F87171" opacity=".28"/><circle cx="82" cy="64" r="4.5" fill="#F87171" opacity=".28"/>`
    + layer(FACE, eq.face)
    + hairFront + (hatOn ? HAT[eq.hat](c) : '')
    + layer(HAND, eq.hand)
    + `</svg>`;
}

/** A DOM element with the character in it. */
export function renderAvatar(av = getState().avatar, team = avatarTeam(av), cls = '') {
  const el = document.createElement('span');
  el.className = 'avatar ' + cls;
  el.innerHTML = avatarSvg(av, team);
  return el;
}
/** Preview of just one item on the current character. */
export function previewSvg(item, av = getState().avatar, team = avatarTeam(av)) {
  return avatarSvg({ ...av, eq: { ...av.eq, [item.slot]: item.id } }, team);
}
