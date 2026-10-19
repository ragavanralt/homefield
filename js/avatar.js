// Your fan character: a full-body figure with shading and outlines, the item catalog, and the shop rules.
// Everything here is cosmetic. Nothing changes odds or payouts.
import { getState, myTeams, buyItem, grantItem, setAvatar, track } from './store.js';
import { betStats } from './bets.js';
import { skinFromColors } from './util.js';
import { dayKey, seeded } from './period.js';
import { spriteMarkup } from './sprite.js';
import { drawFan } from './sprite-art.js';
import './sprite-items.js';

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
  { id: 'athletic', label: 'Athletic', up: 1.04, low: 1.04 },
  { id: 'built', label: 'Built', up: 1.14, low: 1.12 },
  { id: 'heavy', label: 'Heavy', up: 1.26, low: 1.22 },
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
  I('baggy', 'bottom', 'Baggy jeans', 'street', 500), I('jorts', 'bottom', 'Baggy jorts', 'street', 300), I('parachute', 'bottom', 'Parachute pants', 'street', 550), I('bagcargo', 'bottom', 'Baggy cargos', 'street', 650),
  I('carpenter', 'bottom', 'Carpenter double-knee jeans', 'street', 700), I('flares', 'bottom', 'Stacked flare jeans', 'street', 900), I('flannel', 'outer', 'Oversized flannel', 'street', 400), I('techp', 'bottom', 'Tech pants', 'street', 900), I('leatherp', 'bottom', 'Leather pants', 'street', 2200),
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
  jorts: [['Mid wash', '#4F6E9F'], ['Light wash', '#8DAED6'], ['Dark wash', '#22324F'], ['Black', '#2A2B30']],
  parachute: [['Black', '#1E1F23'], ['Silver', '#A9AEB6'], ['Olive', OL], ['Red', '#8E2A2A'], ['White', '#E6E6E2']],
  bagcargo: [['Olive', '#58613F'], ['Black', '#26272B'], ['Khaki', '#9C8B63'], ['Grey', '#6B7078'], ['Navy', '#2A3550']],
  carpenter: [['Brown duck', '#7A5A3A'], ['Black', '#26272B'], ['Khaki', '#B9A37A'], ['Navy', '#2A3550'], ['Light wash', '#8DAED6']],
  flares: [['Black wash', '#2E3138'], ['Dark wash', '#22324F'], ['Mid wash', '#4F6E9F'], ['Grey', '#6B7280'], ['Cream', '#E6DFD0']],
  flannel: [['Red', '#9B2C2C'], ['Green', '#2F5A3A'], ['Blue', '#2C4A7A'], ['Grey', '#5A5E66'], ['Brown', '#6B4A33']],
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
  carpenter: { '#66492E': 0.14 }, bagcargo: { '#4A5235': 0.14 }, flannel: { '#7A2222': 0.25 },
  joggers: { '#2B3445': 0.35 }, cargo: { '#877748': 0.12, '#6B5E3C': 0.3 }, shorts: { '#4F73AD': 0.2 }, boots: { '#5A3516': 0.25 }, plaincap: { '#141418': 0.25 },
  denim: { '#3E6199': 0.2, '#456CA6': 0.1 }, washed: { '#31343A': 0.12, '#34373D': 0.08 }, techp: { '#1A1C22': 0.2 }, bomber: { '#2F3626': 0.38, '#46513A': 0.08 },
  leather: { '#0F0F15': 0.3 }, dressshirt: { '#FAFAF7': -0.3 }, turtleneck: { '#16161A': 0.2 }, blazer: { '#30343B': 0.15 }, suit: { '#18233B': 0.15 }, overcoat: { '#A57A4A': 0.12 },
  foghoodie: { '#7D8085': 0.12, '#878A8F': 0.05, '#666A70': 0.3 }, fogsweats: { '#7D8085': 0.12 }, techhood: { '#6F747B': 0.18 }, techjog: { '#6F747B': 0.18 }, sixhood: { '#0E0E12': 0.25 },
};
for (const id of ['shorts', 'tshorts', 'jorts', 'cs_red', 'cs_purple', 'cs_green', 'cs_royal']) ITEMS.find((i) => i.id === id).short = true;
for (const it of ITEMS) if (COLS[it.id]) { it.colors = COLS[it.id].map(([n, k]) => ({ n, k })); it.shades = SHADES[it.id] || {}; }

/** Darken (amt > 0) or lighten (amt < 0) a #rrggbb colour. */
export function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (x) => Math.max(0, Math.min(255, Math.round(amt > 0 ? x * (1 - amt) : x + (255 - x) * -amt)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
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

/** One featured item a day is on sale. The pick is seeded by the date, so it is the same all day and
 *  never the same item two days running. data/live.json can override it (see setDealOverride). */
const DEAL_PCTS = [15, 20, 20, 25, 30];
export function dealFor(day) {
  const pool = ITEMS.filter((i) => i.price > 0 && i.price <= 2500 && !i.ach);
  const pick = (d) => pool[Math.floor(seeded('deal:' + d)() * pool.length)];
  const [y, m, d] = day.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1, 12);
  const yesterday = pick(dayKey(prev));
  let it = pick(day);
  if (it.id === yesterday.id) it = pool[(pool.indexOf(it) + 1) % pool.length];
  return { itemId: it.id, pct: DEAL_PCTS[Math.floor(seeded('pct:' + day)() * DEAL_PCTS.length)] };
}
let dealOverride = null;
export function setDealOverride(o) { dealOverride = o && o.date && o.itemId ? o : null; }
export function dealInfo(date = new Date()) {
  const day = dayKey(date);
  const o = dealOverride && dealOverride.date === day && itemById(dealOverride.itemId) ? dealOverride : null;
  return o ? { itemId: o.itemId, pct: o.pct || 20, date: day } : { ...dealFor(day), date: day };
}
export function dealToday(date = new Date()) { return itemById(dealInfo(date).itemId) || null; }
export function priceOf(item, date) {
  if (!item.price) return 0;
  const d = dealInfo(date);
  return d.itemId === item.id ? Math.round((item.price * (1 - d.pct / 100)) / 10) * 10 : item.price;
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
  track('outfit_changed');
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
// A smooth illustrated figure on a 64 x 96 design grid, three-quarter view, drawn by sprite-art.js and
// sprite-items.js. It is drawn several times larger than shown and shrunk so the edges are clean.
// Crop windows below are in design units: [x, y, width, height].
const FULL = [0, 0, 64, 96];
const BUST = [14, 0, 36, 44];
const VB = { hair: [16, 0, 32, 34], hat: [16, 0, 32, 34], face: [16, 0, 32, 34], beard: [16, 0, 32, 34], ear: [16, 0, 32, 34], top: [12, 26, 40, 34], outer: [12, 26, 40, 40], scarf: [14, 22, 36, 34], chain: [14, 22, 36, 30], wrist: [28, 38, 30, 28], bottom: [12, 44, 40, 40], shoes: [12, 72, 40, 24], back: FULL, hand: [20, 26, 44, 60] };
// fine pixels per design unit (R) and how much the picture is shrunk afterwards (D). Tests in node stay tiny.
const QUAL = typeof document === 'undefined' ? { hi: { R: 1, D: 1 }, mid: { R: 1, D: 1 }, lo: { R: 1, D: 1 } } : { hi: { R: 8, D: 2 }, mid: { R: 5, D: 1 }, lo: { R: 4, D: 2 } };
const cache = new Map();

/** Returns the markup for a character. vb overrides the crop window (shop previews and busts). */
export function avatarSvg(av, team, vb, quality) {
  const eq = av.eq || {};
  const body = BODIES[av.body ?? 1] || BODIES[1];
  const q = QUAL[quality || (vb ? 'mid' : 'hi')];
  const pal = palette(team);
  const key = JSON.stringify([av.skin, av.hairColor, av.body, av.col, eq, pal, vb, q]);
  if (cache.has(key)) return cache.get(key);
  const colourOf = (id) => {
    const i = av.col && av.col[id];
    const it = itemById(id);
    return i && it && it.colors && it.colors[i] ? it.colors[i].k : undefined;
  };
  const S = drawFan({
    win: vb || FULL, R: q.R,
    skin: SKINS[av.skin] ?? SKINS[2],
    hair: HAIR_COLORS[av.hairColor] ?? HAIR_COLORS[0],
    eq: { ...eq, hair: eq.hair || 'short', top: eq.top || 'tee', bottom: eq.bottom || 'jeans', shoes: eq.shoes || 'sneakers' },
    colourOf, pal, k: (body.up + body.low) / 2,
  });
  const out = spriteMarkup(S.crop(q.D), 'Your fan character');
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

/** A DOM element with the character in it. Add 'bust' to the class for just head and shoulders. */
export function renderAvatar(av = getState().avatar, team = avatarTeam(av), cls = '') {
  const el = document.createElement('span');
  el.className = 'avatar ' + cls;
  const bust = /\bbust\b/.test(cls);
  el.innerHTML = avatarSvg(av, team, bust ? BUST : undefined, bust ? 'lo' : /\blg\b/.test(cls) ? 'hi' : 'mid');
  return el;
}
/** Preview of just one item on the current character, zoomed to where it is worn. */
export function previewSvg(item, av = getState().avatar, team = avatarTeam(av), ci) {
  const col = ci == null ? av.col : { ...(av.col || {}), [item.id]: ci };
  return avatarSvg({ ...av, col, eq: { ...av.eq, [item.slot]: item.id } }, team, VB[item.slot]);
}
