// Your fan character: a full-body figure with shading and outlines, the item catalog, and the shop rules.
// Everything here is cosmetic. Nothing changes odds or payouts.
import { getState, myTeams, buyItem, grantItem, setAvatar } from './store.js';
import { betStats } from './bets.js';
import { skinFromColors } from './util.js';

export const SKINS = ['#E3B85B', '#F0D3B5', '#DDAE86', '#C58B5E', '#A06A44', '#7A4A2E', '#523320'];
export const HAIR_COLORS = ['#1A1410', '#3D281B', '#6E4A2A', '#B8935A', '#B7BBC4', '#A8402B', '#2C57A8', '#5E3FA6', '#B23F7F', '#2F8A57'];
export const SLOTS = [
  { id: 'hair', label: 'Hair' }, { id: 'hat', label: 'Hat' }, { id: 'face', label: 'Face' }, { id: 'beard', label: 'Facial hair' }, { id: 'ear', label: 'Ears' },
  { id: 'top', label: 'Top' }, { id: 'outer', label: 'Jacket' }, { id: 'scarf', label: 'Neckwear' }, { id: 'chain', label: 'Chain' }, { id: 'wrist', label: 'Wrist' },
  { id: 'bottom', label: 'Pants' }, { id: 'shoes', label: 'Shoes' }, { id: 'back', label: 'Back' }, { id: 'hand', label: 'In hand' },
];
// Shop sections. Each item belongs to one. Real brands and logos are not used; the labels are made up.
export const SECTIONS = [
  { id: 'team', label: 'Team shop', blurb: 'Gear in the colours of the team you follow.' },
  { id: 'look', label: 'Look', blurb: 'Hair, faces, beards and earrings.' },
  { id: 'blank', label: 'Blanks', blurb: 'Plain basics. Cheap, no logos.' },
  { id: 'street', label: 'Streetwear', blurb: 'The everyday fits, from baggy jeans to puffers.' },
  { id: 'formal', label: 'Formal', blurb: 'Shirts, suits, coats and good shoes.' },
  { id: 'brand', label: 'Designer', blurb: 'Labels and heavy jewellery. Priced like the real thing.' },
];
// Body types are free. Upper body and legs are widened separately so a built frame gets broad
// shoulders on normal legs, and clothes stretch with the body.
export const BODIES = [
  { id: 'lean', label: 'Lean', up: 0.9, low: 0.92 },
  { id: 'athletic', label: 'Athletic', up: 1, low: 1 },
  { id: 'built', label: 'Built', up: 1.12, low: 1.04 },
  { id: 'heavy', label: 'Heavy', up: 1.18, low: 1.14 },
];
export const ALWAYS_ON = ['hair', 'top', 'bottom', 'shoes'];
export const TIERS = { free: { label: 'Free' }, common: { label: 'Common' }, rare: { label: 'Rare' }, epic: { label: 'Epic' }, legend: { label: 'Legendary' }, earned: { label: 'Earned' } };

// team: the item picks up the colours of the team you chose for your character.
// ach: cannot be bought; it unlocks by doing something. Prices run from free to 35,000 coins.
const tierOf = (price, ach) => (ach ? 'earned' : price === 0 ? 'free' : price < 400 ? 'common' : price < 2000 ? 'rare' : price < 8000 ? 'epic' : 'legend');
const I = (id, slot, name, sec, price, extra = {}) => ({ id, slot, name, sec, price, tier: tierOf(price, extra.ach), ...extra });
const T = { team: true };
export const ITEMS = [
  // ---- Look: hair, face, beards, ears
  I('short', 'hair', 'Short cut', 'look', 0), I('buzz', 'hair', 'Buzz cut', 'look', 0), I('curly', 'hair', 'Curls', 'look', 0),
  I('fade', 'hair', 'Skin fade', 'look', 120), I('slick', 'hair', 'Slick back', 'look', 150), I('bob', 'hair', 'Bob', 'look', 150), I('ponytail', 'hair', 'Ponytail', 'look', 150),
  I('afro', 'hair', 'Afro', 'look', 150), I('long', 'hair', 'Long hair', 'look', 150), I('bun', 'hair', 'Top bun', 'look', 120),
  I('braids', 'hair', 'Braids', 'look', 400), I('twists', 'hair', 'Twists', 'look', 400), I('mohawk', 'hair', 'Mohawk', 'look', 350), I('dreads', 'hair', 'Dreads', 'look', 450),
  I('eyeblack', 'face', 'Eye black', 'look', 120), I('stubble', 'beard', 'Stubble', 'look', 100), I('stache', 'beard', 'Moustache', 'look', 120), I('goatee', 'beard', 'Goatee', 'look', 150), I('beard', 'beard', 'Full beard', 'look', 300),
  I('studs', 'ear', 'Diamond studs', 'look', 300), I('hoops', 'ear', 'Gold hoops', 'look', 700), I('grill', 'face', 'Gold grill', 'look', 1500),

  // ---- Blanks: plain basics
  I('tee', 'top', 'Plain tee', 'blank', 0), I('tank', 'top', 'Tank top', 'blank', 40), I('jeans', 'bottom', 'Jeans', 'blank', 0), I('joggers', 'bottom', 'Joggers', 'blank', 80),
  I('shorts', 'bottom', 'Denim shorts', 'blank', 60), I('cargo', 'bottom', 'Cargo pants', 'blank', 120), I('sneakers', 'shoes', 'Sneakers', 'blank', 0), I('slides', 'shoes', 'Slides', 'blank', 40),
  I('runners', 'shoes', 'Runners', 'blank', 90), I('plaincap', 'hat', 'Plain cap', 'blank', 100), I('denim', 'outer', 'Denim jacket', 'blank', 300), I('ball', 'hand', 'Ball', 'blank', 100),
  I('shades', 'face', 'Shades', 'blank', 150), I('boots', 'shoes', 'Work boots', 'blank', 180),

  // ---- Streetwear
  I('boxy', 'top', 'Boxy tee', 'street', 250), I('graphic', 'top', 'Graphic tee', 'street', 300), I('washed', 'top', 'Washed hoodie', 'street', 600),
  I('baggy', 'bottom', 'Baggy jeans', 'street', 500), I('techp', 'bottom', 'Tech pants', 'street', 900), I('leatherp', 'bottom', 'Leather pants', 'street', 2200),
  I('bomber', 'outer', 'Flight bomber', 'street', 1100), I('leather', 'outer', 'Leather jacket', 'street', 1800), I('puffer', 'outer', 'Puffer jacket', 'street', 1600), I('parka', 'outer', 'Trapper parka', 'street', 1900),
  I('chunky', 'shoes', 'Chunky sneakers', 'street', 800), I('trucker', 'hat', 'Trucker hat', 'street', 350), I('aviators', 'face', 'Aviators', 'street', 1200),
  I('silver', 'chain', 'Silver chain', 'street', 400), I('gold', 'chain', 'Gold chain', 'street', 1500), I('watch', 'wrist', 'Sport watch', 'street', 800),

  // ---- Formal
  I('dressshirt', 'top', 'Dress shirt', 'formal', 500), I('turtleneck', 'top', 'Turtleneck', 'formal', 600),
  I('blazer', 'outer', 'Charcoal blazer', 'formal', 1800), I('suit', 'outer', 'Navy suit jacket', 'formal', 2600), I('overcoat', 'outer', 'Camel overcoat', 'formal', 3800), I('tux', 'outer', 'Tuxedo jacket', 'formal', 4500),
  I('slacks', 'bottom', 'Grey slacks', 'formal', 900), I('suitp', 'bottom', 'Suit trousers', 'formal', 1400), I('tuxp', 'bottom', 'Tuxedo trousers', 'formal', 2200),
  I('loafers', 'shoes', 'Loafers', 'formal', 1000), I('oxfords', 'shoes', 'Oxfords', 'formal', 1200), I('patent', 'shoes', 'Patent dress shoes', 'formal', 2000),
  I('tie', 'scarf', 'Silk tie', 'formal', 300), I('bowtie', 'scarf', 'Bow tie', 'formal', 400), I('glasses', 'face', 'Round glasses', 'formal', 500), I('dresswatch', 'wrist', 'Dress watch', 'formal', 3000),

  // ---- Designer: made-up labels, priced like the real thing
  I('foghoodie', 'top', 'Fogline fleece hoodie', 'brand', 6500), I('fogsweats', 'bottom', 'Fogline fleece sweats', 'brand', 5500),
  I('northgate', 'outer', 'Northgate summit parka', 'brand', 14000), I('nocturne', 'outer', 'Nocturne leather coat', 'brand', 9500), I('silkbomber', 'outer', 'Atelier silk bomber', 'brand', 5500), I('robe', 'outer', 'Champion robe', 'brand', 18000),
  I('v85red', 'shoes', 'Vantage 85 High, red', 'brand', 4500), I('v85royal', 'shoes', 'Vantage 85 High, royal', 'brand', 4000), I('v85shadow', 'shoes', 'Vantage 85 High, shadow', 'brand', 3800), I('goldkicks', 'shoes', 'Gold kicks', 'brand', 7500),
  I('monobucket', 'hat', 'Maison monogram bucket', 'brand', 4000), I('monoscarf', 'scarf', 'Maison monogram scarf', 'brand', 3500), I('crown', 'hat', 'Gold crown', 'brand', 15000),
  I('ovalshades', 'face', 'Oval luxe shades', 'brand', 4000), I('visor', 'face', 'Gold visor', 'brand', 6000),
  I('cuban', 'chain', 'Cuban link chain', 'brand', 8000), I('tennis', 'chain', 'Iced tennis chain', 'brand', 12000), I('diamond', 'chain', 'Diamond cuban', 'brand', 25000),
  I('royalwatch', 'wrist', 'Aurelle royal watch', 'brand', 20000), I('goldwatch', 'wrist', 'Iced-out watch', 'brand', 35000), I('goldpants', 'bottom', 'Gold pants', 'brand', 9000),
  I('wings', 'back', 'Gold wings', 'brand', 25000), I('trophy', 'hand', 'Trophy', 'brand', 15000),
  I('techhood', 'top', 'Vantage tech fleece hoodie', 'brand', 3500), I('techjog', 'bottom', 'Vantage tech fleece joggers', 'brand', 3000),
  I('sixhood', 'top', 'Sixside crest hoodie', 'brand', 4200), I('sixvarsity', 'outer', 'Sixside varsity', 'brand', 8500), I('duffel', 'hand', 'Maison monogram duffel', 'brand', 9000),
  I('cs_red', 'bottom', 'Courtside mesh shorts, red and black', 'brand', 4000), I('cs_purple', 'bottom', 'Courtside mesh shorts, purple and gold', 'brand', 4000),
  I('cs_green', 'bottom', 'Courtside mesh shorts, green and white', 'brand', 4000), I('cs_royal', 'bottom', 'Courtside mesh shorts, royal and white', 'brand', 4000),

  // ---- Team shop
  I('cap', 'hat', 'Team cap', 'team', 250, T), I('beanie', 'hat', 'Team beanie', 'team', 250, T), I('headband', 'hat', 'Headband', 'team', 150, T), I('durag', 'hat', 'Durag', 'team', 200, T),
  I('bucket', 'hat', 'Bucket hat', 'team', 450, T), I('snapback', 'hat', 'Snapback', 'team', 450, T), I('helmet', 'hat', 'Team helmet', 'team', 900, T),
  I('jersey', 'top', 'Team jersey', 'team', 400, T), I('swingman', 'top', 'Swingman tank jersey', 'team', 450, T), I('polo', 'top', 'Team polo', 'team', 300, T), I('hoodie', 'top', 'Team hoodie', 'team', 700, T),
  I('track', 'outer', 'Track jacket', 'team', 600, T), I('varsity', 'outer', 'Varsity jacket', 'team', 1200, T),
  I('tshorts', 'bottom', 'Team shorts', 'team', 250, T), I('trackp', 'bottom', 'Track pants', 'team', 700, T),
  I('hightops', 'shoes', 'Team high tops', 'team', 500, T), I('retros', 'shoes', 'Team retros', 'team', 1200, T),
  I('scarf', 'scarf', 'Team scarf', 'team', 200, T), I('band', 'wrist', 'Wristband', 'team', 100, T), I('pendant', 'chain', 'Team pendant', 'team', 900, T), I('paint', 'face', 'Face paint', 'team', 150, T),
  I('backpack', 'back', 'Backpack', 'team', 400, T), I('cape', 'back', 'Team cape', 'team', 1500, T), I('finger', 'hand', 'Foam finger', 'team', 250, T), I('pennant', 'hand', 'Pennant', 'team', 150, T),

  // ---- Earned
  I('ghost', 'top', 'Ghost sheet', 'team', 0, { ach: 'Get rescued with free coins once' }), I('goldscarf', 'scarf', 'Golden scarf', 'team', 0, { ach: 'Win 5 bets in a row' }), I('trophycape', 'back', 'Trophy cape', 'team', 0, { ach: 'Hit a parlay' }),
];
export const itemById = (id) => ITEMS.find((i) => i.id === id);
// Colour options. The first entry is the colour the item is drawn in; picking another swaps it in,
// and the listed shade colours (cuffs, collars, pockets) follow it, darker or lighter by the amount.
const W = '#ECEBE7', BK = '#1C1C21', HG = '#8E9196', NV = '#1F2A44', OL = '#4F5A3A', CR = '#E9E4D8';
const COLS = {
  tee: [['Slate', '#64748B'], ['White', W], ['Black', BK], ['Heather', HG], ['Navy', NV], ['Olive', '#5B6440'], ['Burgundy', '#6B1E2A'], ['Cream', CR], ['Sky', '#8DB4D8'], ['Forest', '#2F4F3A']],
  tank: [['Black', '#1F2937'], ['White', W], ['Heather', HG], ['Navy', NV], ['Olive', OL]],
  jeans: [['Mid wash', '#3A5A93'], ['Light wash', '#7FA0C9'], ['Dark wash', '#22324F'], ['Black', '#2A2B30'], ['Grey', '#6B7280']],
  joggers: [['Charcoal', '#46546A'], ['Black', '#1E1F23'], ['Heather', HG], ['Navy', NV], ['Olive', OL], ['Oat', '#CDBFA6']],
  cargo: [['Khaki', '#9C8B63'], ['Black', '#26272B'], ['Olive', OL], ['Stone', '#B9B09A'], ['Navy', '#2A3550']],
  shorts: [['Light wash', '#6B8FC9'], ['Mid wash', '#3A5A93'], ['Black', '#2A2B30'], ['Khaki', '#B9A37A'], ['White', '#E8E6E0']],
  sneakers: [['White', '#F8FAFC'], ['Black', BK], ['Cream', '#EEE6D3'], ['Grey', '#9AA0A6'], ['Navy', '#22305A']],
  slides: [['Black', '#1F2937'], ['White', W], ['Cream', '#EEE6D3'], ['Olive', OL]],
  boots: [['Brown', '#7C4A21'], ['Wheat', '#C08A4A'], ['Black', BK]],
  plaincap: [['Black', BK], ['White', W], ['Navy', NV], ['Beige', '#CDBFA6'], ['Olive', OL], ['Red', '#8E2A2A']],
  denim: [['Mid wash', '#4F78B5'], ['Light wash', '#8DAED6'], ['Dark wash', '#22324F'], ['Black', '#2A2B30']],
  boxy: [['Cream', CR], ['Black', BK], ['White', W], ['Heather', HG], ['Sage', '#9AA58C'], ['Brown', '#6B4E3A'], ['Navy', NV]],
  graphic: [['Black', '#1C1C22'], ['White', W], ['Heather', HG], ['Navy', NV], ['Forest', '#2F4F3A']],
  washed: [['Washed black', '#3A3D44'], ['Washed grey', '#7A7D84'], ['Washed brown', '#6B5546'], ['Washed blue', '#4D6280'], ['Washed green', '#56604A']],
  baggy: [['Mid wash', '#4F6E9F'], ['Light wash', '#8DAED6'], ['Dark wash', '#22324F'], ['Black', '#2A2B30'], ['Grey', '#6B7280']],
  techp: [['Black', '#22252C'], ['Grey', '#6B7078'], ['Olive', OL], ['Sand', '#B9AC92']],
  bomber: [['Olive', '#4E5A3F'], ['Black', '#1E1F23'], ['Navy', NV], ['Sage', '#8E9A80'], ['Burgundy', '#5E1E26']],
  leather: [['Black', '#17171F'], ['Brown', '#4A2E1E'], ['Oxblood', '#3E1418']],
  puffer: [['Black', '#2A3142'], ['Cream', '#E6DFD0'], ['Olive', OL], ['Red', '#8E2A2A'], ['Royal', '#264A99'], ['Silver', '#B8BCC4']],
  chunky: [['Cream', '#EFEAE0'], ['Black', '#26272B'], ['Grey', '#9AA0A6'], ['White', '#FAFAF8']],
  dressshirt: [['White', '#F2F1EC'], ['Light blue', '#BFD3EA'], ['Pink', '#E8C8CC'], ['Lavender', '#CFC6E6'], ['Black', BK]],
  turtleneck: [['Black', '#1C1C21'], ['Cream', CR], ['Grey', HG], ['Camel', '#B98B58'], ['Navy', NV]],
  blazer: [['Charcoal', '#3A3E46'], ['Navy', '#1E2B47'], ['Camel', '#A8865C'], ['Black', '#16161A'], ['Olive', OL]],
  suit: [['Navy', '#1E2B47'], ['Charcoal', '#3A3E46'], ['Black', '#16161A'], ['Light grey', '#9EA3AA'], ['Brown', '#5A4232'], ['Burgundy', '#4E1C24']],
  overcoat: [['Camel', '#B98B58'], ['Charcoal', '#3A3E46'], ['Black', '#1E1E22'], ['Navy', NV], ['Cream', '#DCD3C2']],
  slacks: [['Grey', '#6E737B'], ['Navy', NV], ['Black', '#16161A'], ['Khaki', '#B9A37A'], ['Cream', '#DCD3C2']],
  suitp: [['Navy', '#1E2B47'], ['Charcoal', '#3A3E46'], ['Black', '#16161A'], ['Light grey', '#9EA3AA'], ['Brown', '#5A4232'], ['Burgundy', '#4E1C24']],
  tie: [['Burgundy', '#6B1E2A'], ['Navy', NV], ['Black', '#121216'], ['Forest', '#2F4F3A'], ['Silver', '#9EA3AA'], ['Gold', '#B08D3A']],
  foghoodie: [['Heather', '#8E9196'], ['Black', '#1E1F23'], ['Oat', '#CDBFA6'], ['Moss', '#4A5240'], ['Cement', '#B4B1AA'], ['Dark navy', '#1F2433']],
  fogsweats: [['Heather', '#8E9196'], ['Black', '#1E1F23'], ['Oat', '#CDBFA6'], ['Moss', '#4A5240'], ['Cement', '#B4B1AA'], ['Dark navy', '#1F2433']],
  techhood: [['Grey', '#8A8F96'], ['Black', '#1E1F23'], ['Navy', NV], ['Olive', OL], ['Dark grey', '#4A4E55']],
  techjog: [['Grey', '#8A8F96'], ['Black', '#1E1F23'], ['Navy', NV], ['Olive', OL], ['Dark grey', '#4A4E55']],
  sixhood: [['Black', '#141418'], ['Cream', CR], ['Forest', '#2F4F3A']],
};
const SHADES = {
  joggers: { '#2B3445': 0.35 }, cargo: { '#877748': 0.12, '#6B5E3C': 0.3 }, shorts: { '#4F73AD': 0.2 }, boots: { '#5A3516': 0.25 }, plaincap: { '#141418': 0.25 },
  denim: { '#3E6199': 0.2, '#456CA6': 0.1 }, washed: { '#31343A': 0.12, '#34373D': 0.08 }, techp: { '#1A1C22': 0.2 }, bomber: { '#2F3626': 0.38, '#46513A': 0.08 },
  leather: { '#0F0F15': 0.3 }, dressshirt: { '#FAFAF7': -0.3 }, turtleneck: { '#16161A': 0.2 }, blazer: { '#30343B': 0.15 }, suit: { '#18233B': 0.15 }, overcoat: { '#A57A4A': 0.12 },
  foghoodie: { '#7D8085': 0.12, '#878A8F': 0.05, '#666A70': 0.3 }, fogsweats: { '#7D8085': 0.12 }, techhood: { '#6F747B': 0.18 }, techjog: { '#6F747B': 0.18 }, sixhood: { '#0E0E12': 0.25 },
};
for (const it of ITEMS) if (COLS[it.id]) { it.colors = COLS[it.id].map(([n, k]) => ({ n, k })); it.shades = SHADES[it.id] || {}; }

/** Darken (amt > 0) or lighten (amt < 0) a #rrggbb colour. */
export function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (x) => Math.max(0, Math.min(255, Math.round(amt > 0 ? x * (1 - amt) : x + (255 - x) * -amt)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
/** Recolour an item's drawing for the chosen colour option. */
function tint(svg, id, idx) {
  if (!idx) return svg;
  const it = itemById(id);
  const k = it && it.colors && it.colors[idx] && it.colors[idx].k;
  if (!k) return svg;
  let out = svg.split(it.colors[0].k).join(k);
  for (const [hex, amt] of Object.entries(it.shades)) out = out.split(hex).join(shadeHex(k, amt));
  return out;
}
export const colourIndex = (av, id) => (av.col && av.col[id]) || 0;
export function setColour(id, i) {
  const it = itemById(id);
  const a = getState().avatar;
  if (!it || !it.colors || !it.colors[i] || !a.owned.includes(id)) return false;
  setAvatar((av) => { av.col = av.col || {}; av.col[id] = i; av.eq[it.slot] = id; });
  return true;
}
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
  const pool = ITEMS.filter((i) => i.price > 0 && i.price <= 2500);
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
const BOTH = (s) => s + M(s);
// both() draws a left-side part and its mirror. While the legs are drawn it is swapped for a version
// that angles each leg out a little, so the figure stands with feet apart instead of like a block.
let both = BOTH;
const LEG_SKIN = 'M40.6 128 C40 140 40.4 152 41.8 160 C41 166 41.4 173 42.4 180 L43.2 194 L57.8 194 L58.2 180 C59 173 59 166 58.4 160 C59.2 150 59.6 140 59.6 128 Z';

const TORSO = 'M38 77 Q60 71 82 77 C84.4 88 84.6 100 83 112 L81.6 131 Q60 137 38.4 131 L37 112 C35.4 100 35.6 88 38 77 Z';
const ARM = 'M38 77.6 C33 76.6 26.4 77.2 24.2 82 C22.4 86 22.6 90 23.2 94 C22.4 98 22.4 102 23.6 106 C22.4 111 22 116 22.8 121 L33.8 122 C34.6 117 35 112 35.6 108 C37.8 104 38.8 100 39 94 Z';
const SLEEVE_S = 'M38 77.6 C33 76.6 26.4 77.2 24.2 82 C22.4 86 22.4 90 22.8 94 L22.8 106 L37 108 L39 96 Z';
const SLEEVE_L = 'M38 77.6 C33 76.6 26.4 77.2 24.2 82 C22.4 86 22.4 90 22.6 94 L22 119 L34 121 L39 98 Z';
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
    + L('M37 100 L38 130', c.t2, 3) + L('M83 100 L82 130', c.t2, 3) + `<text x="60" y="121" font-family="'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="${c.tink}" stroke="${c.t2}" stroke-width=".8">7</text>`,
  hoodie: (c) => P(TORSO, c.t1) + both(P(SLEEVE_L, c.t1) + P(CUFF_L, c.t2)) + P('M42 78 C46 70 74 70 78 78 C75 90 45 90 42 78 Z', c.t2) + L('M55 86 L54 106', c.tink, 1.8) + L('M65 86 L66 106', c.tink, 1.8)
    + P('M44 114 H76 L80 130 Q60 134 40 130 Z', c.t2) + L('M45 122 L50 128 M75 122 L70 128', 'rgba(0,0,0,.3)'),
  ghost: () => P('M24 84 C24 74 40 70 60 70 C80 70 96 74 96 84 L100 178 L90 170 L80 180 L70 170 L60 180 L50 170 L40 180 L30 170 L20 178 Z', '#F1F5F9') + L('M40 100 Q42 140 38 168 M80 100 Q78 140 82 168 M60 96 V170', 'rgba(100,116,139,.35)', 1.4),
};
const OUTER = {
  denim: () => both(P(PANEL, '#4F78B5') + P(SLEEVE_L, '#4F78B5') + P(CUFF_L, '#3E6199') + P('M38 100 H50 V112 H38 Z', '#456CA6') + L('M38 104 H50', '#F1D17A', 1)) + P('M46 74 L53 74 L56 88 L48 80 Z', '#3E6199') + M(P('M46 74 L53 74 L56 88 L48 80 Z', '#3E6199')),
  track: (c) => both(P(PANEL, c.t1) + P(SLEEVE_L, c.t1) + P(CUFF_L, c.t2) + L('M24 90 L22.6 118', c.tacc, 2.4) + L('M37 80 L38 130', c.tacc, 2.4)) + P('M47 73 Q60 80 73 73 L73 79 Q60 86 47 79 Z', c.t2) + L('M56 80 L56 136', 'rgba(255,255,255,.5)', 1.4),
  varsity: (c) => P(JACKET, c.t2) + both(P(SLEEVE_L, c.t1) + P(CUFF_L, '#F8FAFC') + L('M23.2 108 L35.2 110', c.t2, 1.6)) + P('M46 74 Q60 82 74 74 L74 79 Q60 87 46 79 Z', c.t1) + P('M35 131 Q60 138 85 131 L85 139 Q60 145 35 139 Z', c.t1) + L('M60 82 V136', 'rgba(255,255,255,.55)', 1.5) + C(73, 96, 5.5, c.tacc) + `<text x="73" y="99.3" font-family="'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif" font-size="8" font-weight="900" text-anchor="middle" fill="${c.t2}">H</text>`,
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
  shorts: () => both(P(LEG_SKIN, 'var(--sk)')) + legs('#6B8FC9', 160, both(L('M41 154 L58.5 156', 'rgba(255,255,255,.4)'))) + P('M38.5 130 H81.5 V136 H38.5 Z', '#4F73AD'),
  tshorts: (c) => both(P(LEG_SKIN, 'var(--sk)')) + legs(c.t1, 163, both(L('M41.4 132 L42 162', c.t2, 3.2))) + P('M38.5 130 H81.5 V136 H38.5 Z', c.t2),
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
  finger: (c) => `<g transform="translate(80 76) rotate(-16 15 60)" stroke="${c.t2}" stroke-width="2.2" stroke-linejoin="round"><ellipse cx="-1" cy="44" rx="5.5" ry="9" transform="rotate(-30 -1 44)" fill="${c.t1}"/><rect x="0" y="30" width="31" height="36" rx="9" fill="${c.t1}"/><rect x="14" y="16" width="16" height="22" rx="8" fill="${c.t1}"/><rect x="1" y="-2" width="14" height="38" rx="7" fill="${c.t1}"/><rect x="0" y="30" width="31" height="36" rx="9" fill="url(#hf-sh)" stroke="none"/><text x="15.5" y="53" font-family="'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif" font-size="13" font-weight="900" text-anchor="middle" fill="${c.tink}" stroke="none">#1</text></g>`,
  pennant: (c) => `<rect x="90.5" y="62" width="3.6" height="76" rx="1.6" fill="#E2E8F0" ${OUT}/>` + P('M94 64 L94 90 L118 77 Z', c.t1) + `<path d="M94 71 L94 83 L108 77 Z" fill="${c.tacc}"/>`,
  trophy: () => `<g transform="translate(79 94) scale(.82)">` + `<path d="M4 0 H28 V14 C28 22 22 28 16 28 C10 28 4 22 4 14 Z" fill="${GOLD}" ${OUT}/><path d="M4 0 H28 V14 C28 22 22 28 16 28 C10 28 4 22 4 14 Z" fill="url(#hf-sh)"/><path d="M4 4 C-6 4 -4 18 6 18 M28 4 C38 4 36 18 26 18" fill="none" stroke="${GOLD2}" stroke-width="3"/><rect x="13" y="28" width="6" height="8" fill="${GOLD2}"/><rect x="7" y="36" width="18" height="6" rx="2" fill="${GOLD}" ${OUT}/></g>`,
};

/* ----- head ----- */
const HEAD = 'M40 40 C40 25 49 17.6 60 17.6 C71 17.6 80 25 80 40 L80.4 49 C80.4 55 79 59 75.6 62.4 L67 68.6 Q60 71.6 53 68.6 L44.4 62.4 C41 59 39.6 55 39.6 49 Z';
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
  twists: (h) => HP('M38 46 C35 26 46 16 60 16 C74 16 85 26 82 46 C78 36 72 30 60 30 C48 30 42 36 38 46 Z', h) + `<g fill="none" stroke-linecap="round"><path d="M40 30 q-2.4 -4 -4.0 -8 M45 24 q-1.8 -4 -3.0 -8 M51 20 q-1.2 -4 -2.0 -8 M57 18 q-0.5 -4 -0.8 -8 M63 18 q0.5 -4 0.8 -8 M69 20 q1.2 -4 2.0 -8 M75 24 q1.8 -4 3.0 -8 M80 30 q2.4 -4 4.0 -8 M48 28 q-1.2 -4 -2.0 -8 M60 25 q0.0 -4 0.0 -8 M72 28 q1.2 -4 2.0 -8" stroke="rgba(8,10,28,.5)" stroke-width="7"/><path d="M40 30 q-2.4 -4 -4.0 -8 M45 24 q-1.8 -4 -3.0 -8 M51 20 q-1.2 -4 -2.0 -8 M57 18 q-0.5 -4 -0.8 -8 M63 18 q0.5 -4 0.8 -8 M69 20 q1.2 -4 2.0 -8 M75 24 q1.8 -4 3.0 -8 M80 30 q2.4 -4 4.0 -8 M48 28 q-1.2 -4 -2.0 -8 M60 25 q0.0 -4 0.0 -8 M72 28 q1.2 -4 2.0 -8" stroke="${h}" stroke-width="5.2"/><path d="M40 30 q-2.4 -4 -4.0 -8 M45 24 q-1.8 -4 -3.0 -8 M51 20 q-1.2 -4 -2.0 -8 M57 18 q-0.5 -4 -0.8 -8 M63 18 q0.5 -4 0.8 -8 M69 20 q1.2 -4 2.0 -8 M75 24 q1.8 -4 3.0 -8 M80 30 q2.4 -4 4.0 -8 M48 28 q-1.2 -4 -2.0 -8 M60 25 q0.0 -4 0.0 -8 M72 28 q1.2 -4 2.0 -8" stroke="rgba(0,0,0,.35)" stroke-width="1" stroke-dasharray="1.6 1.8"/></g>`,
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

/* ----- more pieces: streetwear, formal, designer ----- */
const BOXY = 'M34 77 Q60 70 86 77 L88 114 L86 136 Q60 142 34 136 L32 114 Z';
const SLEEVE_SW = 'M37 78 C28 77 22 83 21 92 L19 109 L36 112 L38 97 Z';
const SLEEVE_LW = 'M37 78 C28 77 22 83 21 92 L19 120 L35 122 L38 98 Z';
const CUFF_LW = 'M19.3 114 L35.4 116 L35 122 L19 120 Z';
const PUFFY = 'M38 78 C29 77 23 83 22 92 L19 119 C19 125 33 126 35 121 L40 98 Z';
const BOMBER = 'M35 77 Q60 70 85 77 L87 112 L86 130 Q60 136 34 130 L33 112 Z';
const SUIT_PANEL = 'M36 77 L52 74 L61 116 L61 144 L35 145 L34 112 Z';
const LAPEL = 'M45 74 L52 74 L60.4 114 L55 107 L46 87 L49.4 81 Z';
const LONG_PANEL = 'M36 77 L52 74 L60 114 L60 176 L31 178 L33 112 Z';
const HEATHER = '#8E9196', HEATHER2 = '#7D8085', MONO = '#6B4A2E', MONO2 = '#D8B66A';
const monoDots = (pts) => pts.map(([x, y]) => `<path d="M${x} ${y - 2} L${x + 1.6} ${y} L${x} ${y + 2} L${x - 1.6} ${y} Z" fill="${MONO2}" opacity=".9"/>`).join('');
const suitJ = (f, lap, btn, ex = '') => both(P(SUIT_PANEL, f) + P(SLEEVE_L, f) + P(LAPEL, lap) + L('M23.4 112.4 L34.4 114.4', 'rgba(0,0,0,.3)') + L('M39 124 H50', 'rgba(0,0,0,.4)', 1.4))
  + C(60, 121, 1.5, btn) + C(60, 132, 1.5, btn) + L('M67 96 L76 95', 'rgba(0,0,0,.4)', 1.4) + ex;
const longCoat = (f, lap, ex = '') => both(P(LONG_PANEL, f) + P(SLEEVE_L, f) + P(LAPEL, lap) + L('M38 132 H50', 'rgba(0,0,0,.35)', 1.4) + L('M23.4 112.4 L34.4 114.4', 'rgba(0,0,0,.3)')) + ex;
const legsW = (f, y, ex = '') => both(P(`M37 128 L60 128 L60 ${y} L39 ${y} Z`, f)) + ex + L('M60 130 V150', 'rgba(0,0,0,.4)', 1.4);
const belt = (f = '#17171C', buckle = '#C9CED8') => P('M38.5 130 H81.5 V136 H38.5 Z', f) + `<rect x="56.4" y="131" width="7.2" height="4.4" rx="1" fill="none" stroke="${buckle}" stroke-width="1.3"/>`;
const FOOT_F = 'M42 190 L58 190 L59 199 Q59 203 52 203 L35 203 Q32 202 34 199 Q40 197.5 42 190 Z';
const SOLE_F = 'M33.6 202 H59 V205.4 Q57 206.6 37 206.6 Q33 206.4 33.6 202 Z';
const formal = (up, sole, ex = '') => both(P(FOOT_F, up) + P(SOLE_F, sole) + L('M37 199.6 Q42 198.4 47 199.6', 'rgba(255,255,255,.35)', 1.2) + ex);
const HI = 'M41.5 176 L58.5 176 L60 199 Q60 204 54 204 L38 204 Q34 203 36 199 Q41 197 41.5 176 Z';
const v85 = (base, over, stripe) => both(P(HI, base) + P(SOLE, '#F4F1EA') + `<path d="M36 199 Q41 197 43 195 L50 195 L50 204 L38 204 Q34 203 36 199 Z" fill="${over}"/><path d="M41.5 176 L58.5 176 L58.8 184 L41.7 184 Z" fill="${over}"/><path d="M53 185 L59.4 186 L60 199 L54 199 Z" fill="${over}"/>`
  + L('M40.6 199 L46.6 187 L52.6 196', stripe, 2.2) + L('M44 180 H56', 'rgba(255,255,255,.5)', 1) + `<path d="${HI}" fill="none" ${OUT}/>`);

Object.assign(TOP, {
  boxy: () => P(BOXY, '#E9E4D8') + both(P(SLEEVE_SW, '#E9E4D8')) + L('M49 75 Q60 85 71 75', 'rgba(0,0,0,.35)', 2.6) + L('M44 100 Q46 120 42 134 M76 100 Q74 120 78 134', 'rgba(0,0,0,.12)', 1.4),
  graphic: () => P(TORSO, '#1C1C22') + both(P(SLEEVE_S, '#1C1C22')) + L('M50 75 Q60 84 70 75', 'rgba(255,255,255,.18)', 2)
    + `<circle cx="60" cy="104" r="10" fill="#C8432E"/><path d="M50.4 108 Q60 92 69.6 108" fill="none" stroke="#F1E9D8" stroke-width="2.2"/><path d="M53 112 H67" stroke="#F1E9D8" stroke-width="1.6"/>`
    + `<text x="60" y="124" font-family="'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif" font-size="5.6" text-anchor="middle" fill="#F1E9D8" letter-spacing=".5">NIGHT GAME</text>`,
  washed: () => P(BOXY, '#3A3D44') + both(P(SLEEVE_LW, '#3A3D44') + P(CUFF_LW, '#31343A')) + P('M40 78 C44 68 76 68 80 78 C76 92 44 92 40 78 Z', '#34373D')
    + L('M44 100 L46 114 M74 104 L72 120 M28 96 L26 108', 'rgba(255,255,255,.07)', 6) + L('M55 86 L54 104 M65 86 L66 104', '#C9CED8', 1.4) + P('M44 116 H76 L79 132 Q60 136 41 132 Z', '#34373D'),
  dressshirt: () => P(TORSO, '#F2F1EC') + both(P(SLEEVE_L, '#F2F1EC') + P(CUFF_L, '#FAFAF7') + P('M50 72 L60 80 L55 87 L46 76 Z', '#FAFAF7'))
    + L('M60 80 V134', 'rgba(0,0,0,.18)', 1.2) + C(60, 92, 0.9, '#D6D3CA') + C(60, 104, 0.9, '#D6D3CA') + C(60, 116, 0.9, '#D6D3CA') + L('M44 102 Q47 116 44 128 M76 102 Q73 116 76 128', 'rgba(0,0,0,.08)', 1.2),
  turtleneck: () => P(TORSO, '#1C1C21') + both(P(SLEEVE_L, '#1C1C21') + P(CUFF_L, '#16161A')) + P('M50 60 H70 V79 Q60 84 50 79 Z', '#1C1C21') + L('M53 62 V79 M57 62 V81 M61 62 V81.5 M65 62 V80 M68 62 V78', 'rgba(255,255,255,.07)', 1.2),
  foghoodie: () => P(BOXY, HEATHER) + both(P(SLEEVE_LW, HEATHER) + P(CUFF_LW, HEATHER2)) + P('M40 78 C44 67 76 67 80 78 C76 93 44 93 40 78 Z', HEATHER2)
    + L('M55 87 L54 105 M65 87 L66 105', '#D8D8D4', 1.3) + `<rect x="49" y="96" width="22" height="5.4" rx="1.6" fill="rgba(0,0,0,.12)"/><text x="60" y="100.2" font-family="Arial, sans-serif" font-weight="700" font-size="3.8" text-anchor="middle" fill="#666A70" letter-spacing=".9">FOGLINE</text>`
    + P('M44 116 H76 L79 132 Q60 136 41 132 Z', '#878A8F') + P('M33 132 Q60 139 87 132 L87 138 Q60 145 33 138 Z', HEATHER2),
});
Object.assign(OUTER, {
  bomber: () => P(BOMBER, '#4E5A3F') + both(P(PUFFY, '#4E5A3F') + P('M19.6 114 L35 116.4 L34.8 122 L19.3 120 Z', '#2F3626')) + P('M46 73 Q60 81 74 73 L74 79 Q60 87 46 79 Z', '#2F3626')
    + P('M34 127 Q60 133 86 127 L86 135 Q60 141 34 135 Z', '#2F3626') + L('M60 80 V134', '#C9C2A8', 1.4) + P('M25 92 H32 V100 H25 Z', '#46513A') + L('M58 81 L60 86', '#E8772E', 1.8),
  silkbomber: () => P(BOMBER, '#131318') + both(P(PUFFY, '#131318') + P('M19.6 114 L35 116.4 L34.8 122 L19.3 120 Z', '#7A1B2A') + L('M26 88 Q24 100 23 112', 'rgba(255,255,255,.22)', 2.2))
    + P('M46 73 Q60 81 74 73 L74 79 Q60 87 46 79 Z', '#7A1B2A') + P('M34 127 Q60 133 86 127 L86 135 Q60 141 34 135 Z', '#7A1B2A') + L('M35 130.5 Q60 136.5 85 130.5', GOLD, 1)
    + L('M60 80 V134', '#8E8E96', 1.2) + `<path d="M66 100 C70 92 80 94 77 102 C75 108 67 106 70 101 C72 98 76 100 74 103" fill="none" stroke="${GOLD}" stroke-width="1.5" stroke-linecap="round"/><path d="M70 110 l1 2 l2 .3 l-1.6 1.4 l.4 2 l-1.8 -1 l-1.8 1 l.4 -2 l-1.6 -1.4 l2 -.3 Z" fill="${GOLD}"/>`
    + L('M42 92 Q46 104 44 120', 'rgba(255,255,255,.18)', 2),
  blazer: () => suitJ('#3A3E46', '#30343B', '#1A1C20'),
  suit: () => suitJ('#1E2B47', '#18233B', '#0E1424', `<path d="M68 95 L71 91 L74 95 Z" fill="#F4F4F2"/>`),
  tux: () => suitJ('#121216', '#24242C', '#24242C', L('M47 86 L57 110', 'rgba(255,255,255,.22)', 1.2) + M(L('M47 86 L57 110', 'rgba(255,255,255,.22)', 1.2))),
  overcoat: () => longCoat('#B98B58', '#A57A4A', C(52, 120, 1.7, '#5A3F22') + C(52, 132, 1.7, '#5A3F22') + C(68, 120, 1.7, '#5A3F22') + C(68, 132, 1.7, '#5A3F22')),
  nocturne: () => longCoat('#141418', '#0E0E12', both(P('M33 120 L60 118 L60 124 L33 126 Z', '#0B0B0E') + L('M38 90 Q41 130 37 170', 'rgba(255,255,255,.18)', 1.8)) + `<rect x="56" y="117.4" width="8" height="7" rx="1" fill="none" stroke="#C9CED8" stroke-width="1.3"/>`),
  northgate: () => P('M34 77 Q60 70 86 77 L89 114 L89 160 Q60 166 31 160 L31 114 Z', '#1F2633') + both(P(PUFFY, '#1F2633') + P('M19.6 114 L35 116.4 L34.8 122 L19.3 120 Z', '#161B25') + P('M35 128 H52 V142 H35 Z', '#1A202B') + L('M35 131 H52', 'rgba(255,255,255,.1)'))
    + P('M57 80 H63 V162 H57 Z', '#1A202B') + P('M30 86 C28 62 92 62 90 86 L83 91 C80 74 40 74 37 91 Z', '#7A6650')
    + L('M35 82 l3 -2 M39 75 l3 -1 M46 70 l2.4 0 M54 68 l2.4 0 M63 68 l2.4 0 M71 70 l2.4 0 M78 75 l3 1 M82 82 l3 2', '#A08A6E', 1.6) + L('M38 86 Q60 70 82 86', 'rgba(0,0,0,.25)', 1.4)
    + L('M37 100 Q60 106 83 100 M37 116 Q60 122 83 116', 'rgba(0,0,0,.35)', 1.4)
    + `<circle cx="91.4" cy="92" r="4.8" fill="#A61C22" stroke="#EDEDED" stroke-width="1.2"/><path d="M88.8 94.4 L91.4 89.6 L94 94.4 Z" fill="#EDEDED"/>`,
});
Object.assign(BOTTOM, {
  baggy: () => legsW('#4F6E9F', 198, both(L('M40 180 Q49 184 59 180 M40 189 Q49 192 59 189', 'rgba(0,0,0,.22)', 1.2) + L('M42 136 Q49 143 57 137', 'rgba(255,255,255,.3)') + L('M46 142 L47 172', 'rgba(255,255,255,.12)', 4))) + belt('#1F2937', GOLD),
  techp: () => legs('#22252C', 190, both(P('M41 148 H52 V163 H41 Z', '#1A1C22') + L('M42 152 H51', '#3A3F48', 1) + L('M40 172 L58.6 170', '#3A3F48', 2.4) + P('M42.4 184 L58.5 184 L58.5 190 L42 190 Z', '#1A1C22'))) + belt('#121217', '#8E8E96'),
  slacks: () => legs('#6E737B', 193, both(L('M50 136 L50.4 192', 'rgba(255,255,255,.22)', 1))) + belt(),
  suitp: () => legs('#1E2B47', 193, both(L('M50 136 L50.4 192', 'rgba(255,255,255,.16)', 1))) + belt(),
  tuxp: () => legs('#121216', 193, both(L('M40.4 134 L42.4 192', '#30303A', 2.2))) + belt('#0B0B0E', '#24242C'),
  fogsweats: () => legsW(HEATHER, 192, both(P('M39 184 L60 184 L60 192 L39 192 Z', HEATHER2) + L('M42 185 V191 M46 185 V191 M50 185 V191 M54 185 V191 M58 185 V191', 'rgba(0,0,0,.12)', 1) + L('M44 150 Q46 165 43 180', 'rgba(0,0,0,.1)', 1.4)))
    + P('M37.5 128 H82.5 V136 H37.5 Z', HEATHER2) + L('M57 134 L56 144 M63 134 L64 144', '#D8D8D4', 1.2) + `<rect x="66" y="141" width="10" height="3" rx="1" fill="rgba(0,0,0,.14)"/>`,
});
Object.assign(SHOES, {
  oxfords: () => formal('#5A3820', '#2A1A0E', L('M46 192 L53 192 M46 194.6 L53 194.6', '#2A1A0E', 1) + L('M37 199.4 Q40 196 44 196.6', 'rgba(0,0,0,.35)')),
  loafers: () => formal('#1A1A20', '#0E0E12', L('M42 195.6 H49', GOLD, 1.8)),
  patent: () => formal('#0B0B0E', '#050507', L('M36.6 200 Q42 197.8 49 199.2', 'rgba(255,255,255,.7)', 1.5)),
  chunky: () => both(P(FOOT, '#EFEAE0') + `<path d="M36 199 Q41 197 44 195 L52 195 L54 202 L37 203 Z" fill="#A9B3C1"/><path d="M48 189 L58 189 L59 196 L50 196 Z" fill="#2F5FA8" opacity=".8"/>` + P('M33 200 H61 V208 Q58 210 38 210 Q32 209 33 200 Z', '#F7F4EE') + L('M34 205 H60', 'rgba(0,0,0,.2)', 1.2)),
  v85red: () => v85('#F4F4F2', '#B3202A', '#111114'),
  v85royal: () => v85('#F4F4F2', '#1F4FA8', '#111114'),
  v85shadow: () => v85('#9AA0A6', '#26282D', '#111114'),
});
Object.assign(HAT, {
  plaincap: () => P('M38 32 C37 10 48 6 60 6 C72 6 83 10 82 32 Z', '#1C1C21') + L('M60 8 V30', 'rgba(255,255,255,.08)') + P('M33 32 H72 Q66 42 33 39 Z', '#141418'),
  trucker: () => P('M38 32 C37 10 48 6 60 6 C72 6 83 10 82 32 Z', '#EFE9DC') + P('M66 7 C76 9 83 14 82 32 L66 32 Z', '#3A3F48') + L('M70 12 L70 31 M75 14 L75 31 M68 18 H82 M67 25 H82', 'rgba(255,255,255,.2)', .8) + `<rect x="46" y="16" width="14" height="7" rx="1.4" fill="#C8432E"/>` + P('M33 32 H72 Q66 42 33 39 Z', '#3A3F48'),
  monobucket: () => P('M40 32 C39 12 48 8 60 8 C72 8 81 12 80 32 Z', MONO) + P('M24 34 C24 28 40 28 60 28 C80 28 96 28 96 34 C96 42 78 42 60 42 C42 42 24 42 24 34 Z', MONO)
    + monoDots([[48, 16], [60, 13], [72, 16], [44, 25], [54, 22], [66, 22], [76, 25], [32, 36], [44, 37], [56, 38], [68, 38], [80, 37], [90, 35]]),
});
Object.assign(FACE, {
  aviators: () => both(`<path d="M42.6 38.6 H57 Q57.6 48.6 50.6 49.6 Q43 49 42.6 38.6 Z" fill="#3B2A1A" fill-opacity=".86" stroke="${GOLD}" stroke-width="1.2"/>` + L('M44.6 41 L49 40.4', 'rgba(255,255,255,.4)', 1.4))
    + L('M57 39.6 Q60 38 63 39.6 M57.4 41.8 Q60 40.8 62.6 41.8', GOLD, 1) + L('M42.6 39.4 L38.4 38.6 M77.4 39.4 L81.6 38.6', GOLD, 1.2),
  ovalshades: () => both(`<ellipse cx="50.6" cy="44" rx="7" ry="3.6" fill="#0D0D10" ${OUT}/>` + L('M46 42.6 L50 42', 'rgba(255,255,255,.35)', 1.2)) + L('M57.4 43.6 Q60 42.6 62.6 43.6', '#0D0D10', 1.6) + L('M43.6 43.4 L39 42.6 M76.4 43.4 L81 42.6', GOLD, 1.4),
  glasses: () => both(`<circle cx="50.6" cy="44" r="5.4" fill="rgba(200,220,255,.12)" stroke="#2A2A2A" stroke-width="1.2"/>`) + L('M56 43.4 Q60 41.6 64 43.4', '#2A2A2A', 1.2) + L('M45.2 43 L39.6 42 M74.8 43 L80.4 42', '#2A2A2A', 1),
});
Object.assign(SCARF, {
  tie: () => P('M57 76 H63 L62 82 H58 Z', '#6B1E2A') + P('M58 82 L62 82 L65 118 L60 125 L55 118 Z', '#6B1E2A') + L('M57.4 92 L62.6 88.6 M56.8 102 L63.4 97.6 M56.2 112 L64 106.6', 'rgba(255,255,255,.22)', 1.4),
  bowtie: () => P('M60 78 L51 73 L51 83 Z', '#121216') + P('M60 78 L69 73 L69 83 Z', '#121216') + C(60, 78, 2.2, '#1C1C22'),
  monoscarf: () => P('M40 70 Q60 86 80 70 L82 80 Q60 96 38 80 Z', MONO) + P('M68 84 L80 114 L90 108 L78 80 Z', MONO) + monoDots([[46, 79], [54, 83], [62, 84], [70, 82], [77, 78], [74, 92], [79, 102], [84, 108]]),
});
Object.assign(CHAIN, {
  cuban: () => `<path d="M44 76 Q60 116 76 76" fill="none" stroke="${GOLD2}" stroke-width="7.4" stroke-linecap="round"/><path d="M44 76 Q60 116 76 76" fill="none" stroke="${GOLD}" stroke-width="5.4" stroke-dasharray="4 1.4"/><path d="M44 76 Q60 116 76 76" fill="none" stroke="#FFF3B0" stroke-width="1.2" stroke-dasharray="1.4 4"/>`,
  tennis: () => `<path d="M45 76 Q60 112 75 76" fill="none" stroke="#9AA8B8" stroke-width="3.6" stroke-linecap="round"/><path d="M45 76 Q60 112 75 76" fill="none" stroke="#F0F9FF" stroke-width="2.6" stroke-linecap="round" stroke-dasharray=".1 3.2"/>`
    + `<path d="M52 92 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 Z M67 88 l.8 -2.4 l.8 2.4 l2.4 .8 l-2.4 .8 l-.8 2.4 l-.8 -2.4 l-2.4 -.8 Z" fill="#FFFFFF"/>`,
});
Object.assign(WRIST, {
  dresswatch: () => P('M22.4 114 L34.4 116 L34 119 L22 117 Z', '#3B2414') + C(28, 116.2, 3.8, '#E8E6E0') + L('M28 116.2 V113.6 M28 116.2 L29.6 117', '#1A1A1A', .9),
  royalwatch: () => P('M22.2 113 L34.6 115 L34 120 L21.8 118 Z', GOLD) + L('M25 113.6 L24.6 118.6 M28 114 L27.8 119 M31 114.6 L30.8 119.4', GOLD2, .8) + C(28, 116.4, 4.8, GOLD) + `<circle cx="28" cy="116.4" r="3.1" fill="#123C7A"/>` + L('M28 116.4 V114 M28 116.4 L29.8 117.2', '#F5F5F5', .8),
});

/* ----- tech fleece, Sixside, Courtside shorts, duffel, swingman ----- */
const TF2 = '#6F747B', ZIP = '#2A2D33';
const chevron = (x, y) => L(`M${x} ${y} l2 2.6 l3 -4`, 'rgba(255,255,255,.6)', 1.1);
const courtside = (body, panel, trim) => () => both(P(LEG_SKIN, 'var(--sk)')) + legs(body, 166, both(L('M41.2 132 L42.2 165', panel, 4.2)
  + L('M45 136 V160 M49 136 V161 M53 136 V161 M57 136 V160', 'rgba(255,255,255,.16)', 1.2).replace('fill="none"', 'fill="none" stroke-dasharray=".1 2.2"') + L('M42.2 161.6 L58.6 161.8', trim, 1.6)))
  + P('M38.5 128.5 H81.5 V136 H38.5 Z', panel) + L('M38.5 132.2 H81.5', trim, 1.2) + `<circle cx="47.4" cy="154" r="2.6" fill="${GOLD}" stroke="${GOLD2}" stroke-width=".8"/>`;
Object.assign(TOP, {
  techhood: () => P(TORSO, '#8A8F96') + both(P(SLEEVE_L, '#8A8F96') + P(CUFF_L, TF2) + L('M37 96 Q47 92 53 100 Q56.6 110 56 134', 'rgba(0,0,0,.22)', 1.2))
    + P('M42 78 C46 70 74 70 78 78 C75 88 45 88 42 78 Z', TF2) + P('M37 128 Q60 134 83 128 L83 134 Q60 140 37 134 Z', TF2)
    + L('M60 82 V136', ZIP, 1.6) + `<rect x="58.8" y="84" width="2.4" height="5" rx=".8" fill="#C9CED8"/>` + L('M66 93 L74.4 89', ZIP, 1.4) + chevron(43, 91),
  sixhood: () => P(BOXY, '#141418') + both(P(SLEEVE_LW, '#141418') + P(CUFF_LW, '#0E0E12')) + P('M40 78 C44 67 76 67 80 78 C76 93 44 93 40 78 Z', '#0E0E12')
    + L('M55 87 L54 104 M65 87 L66 104', GOLD, 1.2) + `<path d="M54.6 96 H65.4 V103 Q65.4 108.4 60 110.6 Q54.6 108.4 54.6 103 Z" fill="none" stroke="${GOLD}" stroke-width="1.4"/><text x="60" y="106.2" font-family="Georgia, serif" font-size="8" font-weight="700" text-anchor="middle" fill="${GOLD}">6</text>`
    + P('M44 116 H76 L79 132 Q60 136 41 132 Z', '#0E0E12') + P('M33 132 Q60 139 87 132 L87 138 Q60 145 33 138 Z', '#0E0E12'),
  swingman: (c, h, skin) => `<path d="M45 76 Q47.6 70.6 51 74 Q60 92 69 74 Q72.4 70.6 75 76 L83 86 L84 112 L83 131 Q60 137 37 131 L36 112 L37 86 Z" fill="${c.t1}" ${OUT}/><path d="M45 76 Q47.6 70.6 51 74 Q60 92 69 74 Q72.4 70.6 75 76 L83 86 L84 112 L83 131 Q60 137 37 131 L36 112 L37 86 Z" fill="url(#hf-sh)"/>`
    + L('M51 74 Q60 92 69 74', c.t2, 2.6) + L('M45 76 Q41 80 37 86 M75 76 Q79 80 83 86', c.t2, 2.6) + L('M37.4 128.6 Q60 134.4 82.6 128.6', c.t2, 2.2)
    + `<text x="60" y="118" font-family="'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif" font-size="20" font-weight="900" text-anchor="middle" fill="${c.tink}" stroke="${c.t2}" stroke-width="1">8</text>`,
});
Object.assign(OUTER, {
  sixvarsity: () => P(JACKET, '#141418') + both(P(SLEEVE_L, '#E9E4D8') + P(CUFF_L, '#141418') + L('M22.6 115 L34.6 117', GOLD, 1.2) + L('M26 88 Q24.4 100 23.6 110', 'rgba(255,255,255,.35)', 2))
    + P('M46 74 Q60 82 74 74 L74 79 Q60 87 46 79 Z', '#141418') + L('M46.6 77 Q60 84.6 73.4 77', GOLD, 1.1) + P('M35 131 Q60 138 85 131 L85 139 Q60 145 35 139 Z', '#141418') + L('M35 134.6 Q60 141.4 85 134.6', GOLD, 1.1)
    + L('M60 82 V136', 'rgba(255,255,255,.4)', 1.3) + C(46, 96, 6, '#141418', `stroke="${GOLD}"`) + `<text x="46" y="99.4" font-family="Georgia, serif" font-size="9" font-weight="700" text-anchor="middle" fill="${GOLD}">6</text>`,
});
Object.assign(BOTTOM, {
  techjog: () => legs('#8A8F96', 190, both(L('M42 134 Q50 150 46 172', 'rgba(0,0,0,.2)', 1.2) + L('M43 140 L50 150', ZIP, 1.3) + P('M42.4 183 L58.6 183 L58.5 190 L42 190 Z', TF2)))
    + P('M38.5 130 H81.5 V136 H38.5 Z', TF2) + L('M56 132 L55 140 M64 132 L65 140', '#E5E9F0', 1.1) + chevron(66, 142),
  cs_red: courtside('#B3202A', '#111114', '#F4F4F2'),
  cs_purple: courtside('#4B2A7B', '#E0B43A', '#F4F4F2'),
  cs_green: courtside('#1E6B45', '#F4F4F2', '#111114'),
  cs_royal: courtside('#1F4FA8', '#F4F4F2', '#C8102E'),
});
Object.assign(HAND, {
  duffel: () => L('M82 132 Q92 114 102 132', '#3B2A1A', 2.6) + P('M72 131 H112 Q116 142 112 154 H72 Q68 142 72 131 Z', MONO)
    + monoDots([[78, 137], [86, 136], [94, 136], [102, 136], [108, 138], [80, 146], [88, 147], [96, 147], [104, 146]])
    + P('M72 131 H77 V154 H72 Q68 142 72 131 Z', '#3B2A1A') + P('M107 131 H112 Q116 142 112 154 H107 Z', '#3B2A1A') + L('M77 134 H107', GOLD, 1.2),
});

/** Returns the SVG markup for a character. vb overrides the view box (used for shop previews and busts). */
export function avatarSvg(av, team, vb) {
  const c = palette(team);
  const eq = av.eq || {};
  const skin = SKINS[av.skin] ?? SKINS[2];
  const hair = HAIR_COLORS[av.hairColor] ?? HAIR_COLORS[0];
  const hd = eq.hair || 'short';
  const pick = (map, id, fallback) => { const use = map[id] ? id : fallback; return use && map[use] ? tint(map[use](c, hair, skin), use, av.col && av.col[use]) : ''; };
  const sk = (s) => s.replace(/var\(--sk\)/g, skin);
  const body = BODIES[av.body ?? 1] || BODIES[1];
  const sx = (k) => `translate(60 0) scale(${k} 1) translate(-60 0)`;
  const UP = (s) => (s ? `<g transform="${sx(body.up)}">${s}</g>` : '');
  const LOW = (s) => `<g transform="${sx(body.low)}">${s}</g>`;
  // a closed fist with a thumb, not a ball
  const FIST = 'M22.4 120.6 L34 121.6 Q34.8 127 33.2 130.4 Q30.6 133.4 27 133 Q23.4 132.4 22.4 128.6 Q21.8 124.6 22.4 120.6 Z';
  const hand = P(FIST, skin) + L('M30.6 123.4 Q33.4 125 32.4 128.6', 'rgba(0,0,0,.28)', 1) + L('M24 127.6 H30', 'rgba(0,0,0,.14)', 1);
  const muscle = L('M25.4 84.6 Q29.2 87.6 31.4 86', 'rgba(0,0,0,.12)', 1.1) + L('M24.6 96 Q28.4 100.6 26.6 105.6', `rgba(0,0,0,${body.up >= 1.1 ? .2 : .1})`, 1.2) + L('M24.4 106.4 Q27 107.6 29.4 106.8', 'rgba(0,0,0,.12)', 1);
  const out = [];
  out.push(`<svg viewBox="${vb || '-12 12 144 202'}" role="img" aria-label="Your fan character" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="filter:saturate(.82) contrast(1.04)">`, DEFS);
  out.push(LOW('<ellipse cx="60" cy="208" rx="38" ry="5" fill="rgba(0,0,0,.3)"/>'));
  out.push(UP(pick(BACK, eq.back)));
  out.push(`<g transform="translate(60 76) scale(.76 .8) translate(-60 -76)">${HAIR_BACK[hd] ? HAIR_BACK[hd](hair) : ''}</g>`);
  const lean = (s) => `<g transform="rotate(2.4 50 130)">${s}</g>`;
  const shift = (s) => `<g transform="translate(-2.9 .1)">${s}</g>`;
  let lower = '';
  try {
    both = (s) => lean(s) + M(lean(s));
    const skinLegs = both(P(LEG_SKIN, skin) + L('M44.4 160 Q50 162.6 55.8 160', 'rgba(0,0,0,.14)', 1.1) + L('M44 170 Q46 176 45.4 184', 'rgba(0,0,0,.08)', 1.4));
    both = (s) => shift(s) + M(shift(s));
    const shoes = sk(pick(SHOES, eq.shoes, 'sneakers'));
    both = (s) => lean(s) + M(lean(s));
    lower = sk(skinLegs) + shoes + sk(pick(BOTTOM, eq.bottom, 'jeans'));
  } finally { both = BOTH; }
  out.push(LOW(lower));
  const upper = [];
  upper.push(both(P(ARM, skin) + muscle) + both(hand));
  // neck with a little trapezius slope into the shoulders
  upper.push(`<path d="M50 58 H70 L71 74 Q77 76 82 77.4 L38 77.4 Q43 76 49 74 Z" fill="${skin}" ${OUT}/><path d="M50 64 Q60 76 70 64 V74 H50 Z" fill="rgba(0,0,0,.22)"/>` + L('M53.4 66 L56.6 77 M66.6 66 L63.4 77', 'rgba(0,0,0,.12)', 1.2));
  upper.push(P(TORSO, skin));
  if (eq.top === 'tank' && body.up >= 1.1) upper.push(L('M44 96 Q52 100 58 97 M62 97 Q68 100 76 96', 'rgba(0,0,0,.16)', 1.2));
  upper.push(pick(TOP, eq.top, 'tee'));
  upper.push(pick(OUTER, eq.outer));
  upper.push(pick(SCARF, eq.scarf));
  upper.push(pick(CHAIN, eq.chain));
  upper.push(pick(WRIST, eq.wrist));
  out.push(UP(upper.join('')));
  // head: scaled down a little and set on the neck so the proportions look grown up
  out.push(`<g transform="translate(60 76) scale(.76 .8) translate(-60 -76)">`);
  out.push(`<ellipse cx="39.6" cy="46" rx="3" ry="5.2" fill="${skin}" ${OUT}/><ellipse cx="80.4" cy="46" rx="3" ry="5.2" fill="${skin}" ${OUT}/>`);
  out.push(pick(EAR, eq.ear));
  out.push(P(HEAD, skin));
  // shading: under the jaw line, cheekbones and temples, so the face reads angular rather than round
  out.push(both('<path d="M40 49 C40.4 55 42 58.6 44.8 61.6 L53.4 67.6 Q56 68.8 58.4 69.4 L52.4 64.6 L46.8 60.4 C43.8 57.8 41.4 54.4 40 49 Z" fill="rgba(0,0,0,.14)"/><path d="M40.2 37 C40 44 40.4 48 41.4 50.6 L44 45 L44 35.6 Z" fill="rgba(0,0,0,.1)"/>'));
  out.push(pick(BEARD, eq.beard));
  const eye = `<path d="M45.4 44.8 Q51 40.8 56.6 44.2 Q51 47.2 45.4 44.8 Z" fill="#E6E1D6" stroke="rgba(0,0,0,.5)" stroke-width=".8"/><circle cx="51.8" cy="44.2" r="2.3" fill="#3A281B"/><circle cx="51.8" cy="44.2" r="1.1" fill="#0B0B10"/><circle cx="52.5" cy="43.5" r=".5" fill="#fff" opacity=".8"/>`
    + `<path d="M44.8 44.6 Q51 40.4 57 43.8" fill="none" stroke="#24180F" stroke-width="1.5" stroke-linecap="round"/><path d="M46 41.4 Q51 38.4 56 41" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1"/><path d="M46.6 46.8 Q51 48.6 56 46.4" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="1.5" stroke-linecap="round"/>`
    + `<path d="M44.6 37.8 Q50.6 35.6 57 38.8" fill="none" stroke="#2A1C12" stroke-opacity=".9" stroke-width="3" stroke-linecap="round"/>`;
  out.push(both(eye));
  out.push(`<path d="M58.4 42 Q57.6 48 57.2 51.6" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="2"/>` + L('M56.6 53.2 Q58.2 55.6 60 54.2 Q61.8 55.6 63.4 53.2', 'rgba(60,20,10,.5)', 1.4) + `<path d="M62.6 42 Q63.4 48 63.4 52" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1.6"/>`);
  out.push(`<path d="M54.6 60 Q60 60.9 65.8 59.6" fill="none" stroke="#3A1C1C" stroke-width="1.8" stroke-linecap="round"/><path d="M56 62.6 Q60 64 64 62.4" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="1.5" stroke-linecap="round"/>`);
  out.push(pick(FACE, eq.face));
  out.push(HAIR_FRONT[hd] ? HAIR_FRONT[hd](hair) : '');
  out.push(pick(HAT, eq.hat));
  out.push('</g>');
  const hx = ((92 - 60) * (body.up - 1)).toFixed(2);
  out.push(`<g transform="translate(${hx} 0)">${sk(pick(HAND, eq.hand))}</g>`);
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
const BUST = '20 12 80 80';
const VB = { hair: BUST, hat: BUST, face: BUST, beard: BUST, ear: BUST, top: '0 62 120 100', outer: '0 62 120 120', scarf: '8 58 104 80', chain: '20 60 80 66', wrist: '4 92 48 48', bottom: '16 118 88 96', shoes: '14 164 92 52', back: '-12 12 144 202', hand: '-12 12 144 202' };
/** Preview of just one item on the current character, zoomed to where it is worn. */
export function previewSvg(item, av = getState().avatar, team = avatarTeam(av), ci) {
  const col = ci == null ? av.col : { ...(av.col || {}), [item.id]: ci };
  return avatarSvg({ ...av, col, eq: { ...av.eq, [item.slot]: item.id } }, team, VB[item.slot]);
}
