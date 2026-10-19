// Your fan character: a full-body figure with shading and outlines, the item catalog, and the shop rules.
// Everything here is cosmetic. Nothing changes odds or payouts.
import { getState, myTeams, buyItem, grantItem, setAvatar, track } from './store.js';
import { betStats } from './bets.js';
import { skinFromColors, contrast, luminance, colorDistance, darken } from './util.js';
import { teamColours } from './team-colors.js';
import { dayKey, seeded } from './period.js';
import { drawFan } from './fan.js';
import './fan-items.js';
import './fan-bgs.js';

export const SKINS = ['#E3B85B', '#F0D3B5', '#DDAE86', '#C58B5E', '#A06A44', '#7A4A2E', '#523320'];
export const HAIR_COLORS = ['#1A1410', '#3D281B', '#6E4A2A', '#B8935A', '#B7BBC4', '#A8402B', '#2C57A8', '#5E3FA6', '#B23F7F', '#2F8A57'];
export const SLOTS = [
  { id: 'expr', label: 'Expression' }, { id: 'hair', label: 'Hair' }, { id: 'hat', label: 'Hat' }, { id: 'face', label: 'Face' }, { id: 'beard', label: 'Facial hair' }, { id: 'ear', label: 'Ears' },
  { id: 'top', label: 'Top' }, { id: 'outer', label: 'Jacket' }, { id: 'scarf', label: 'Neckwear' }, { id: 'chain', label: 'Chain' }, { id: 'wrist', label: 'Wrist' }, { id: 'armwear', label: 'Arm sleeve' },
  { id: 'bottom', label: 'Pants' }, { id: 'legwear', label: 'Leg sleeve' }, { id: 'shoes', label: 'Shoes' }, { id: 'back', label: 'Back' }, { id: 'hand', label: 'In hand' },
  { id: 'bg', label: 'Background' },
];
// Shop sections. Each item belongs to one. Real brands and logos are not used; the labels are made up.
export const SECTIONS = [
  { id: 'team', label: 'Team shop', blurb: 'Gear in the colours of the team you follow.' },
  { id: 'casual', label: 'Casual', blurb: 'Sport-brand style sleeves and calf bands in fixed colours: black, white, red and royal. Original marks, no real logos.' },
  { id: 'retro', label: 'Retros', blurb: 'Throwback jerseys, kits, shorts, hats and jackets from big moments in sports. Fixed colours.' },
  { id: 'look', label: 'Look', blurb: 'Hair, faces, beards and earrings.' },
  { id: 'blank', label: 'Blanks', blurb: 'Plain basics. Cheap, no logos.' },
  { id: 'street', label: 'Streetwear', blurb: 'The everyday fits, from baggy jeans to puffers.' },
  { id: 'formal', label: 'Formal', blurb: 'Shirts, suits, coats and good shoes.' },
  { id: 'brand', label: 'Designer', blurb: 'Labels and heavy jewellery. Priced like the real thing.' },
  { id: 'bg', label: 'Backgrounds', blurb: 'The scene behind your fan: courts, rinks, stadiums and the city at night.' },
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
  // ---- Look: expressions, hair, face, beards, ears
  I('smile', 'expr', 'Smile', 'look', 0), I('smirk', 'expr', 'Smirk', 'look', 0), I('grin', 'expr', 'Big grin', 'look', 150), I('meanmug', 'expr', 'Mean mug', 'look', 300), I('wink', 'expr', 'Wink', 'look', 450), I('tongue', 'expr', 'Tongue out', 'look', 600),
  I('short', 'hair', 'Short cut', 'look', 0), I('buzz', 'hair', 'Buzz cut', 'look', 0), I('curls', 'hair', 'Curls', 'look', 0), I('curly', 'hair', 'Curly flow', 'look', 600), I('curlyhl', 'hair', 'Curly flow, blonde highlights', 'look', 900),
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
  I('cs_stars', 'bottom', 'Courtside pinstripe shorts, stars', 'brand', 4500), I('rj_purple', 'top', 'Courtside retro jersey, purple and gold', 'brand', 5000), I('rj_stars', 'top', 'Courtside pinstripe jersey, stars', 'brand', 5500),

  // ---- Team shop
  I('cap', 'hat', 'Team cap', 'team', 250, T), I('beanie', 'hat', 'Team beanie', 'team', 250, T), I('headband', 'hat', 'Headband', 'team', 150, T), I('durag', 'hat', 'Durag', 'team', 200, T),
  I('bucket', 'hat', 'Bucket hat', 'team', 450, T), I('snapback', 'hat', 'Snapback', 'team', 450, T), I('helmet', 'hat', 'Team helmet', 'team', 900, T),
  I('jersey', 'top', 'Team jersey', 'team', 400, T), I('swingman', 'top', 'Swingman tank jersey', 'team', 450, T), I('polo', 'top', 'Team polo', 'team', 300, T), I('hoodie', 'top', 'Team hoodie', 'team', 700, T),
  I('track', 'outer', 'Track jacket', 'team', 600, T), I('varsity', 'outer', 'Varsity jacket', 'team', 1200, T),
  I('tshorts', 'bottom', 'Team shorts', 'team', 250, T), I('trackp', 'bottom', 'Track pants', 'team', 700, T),
  I('hightops', 'shoes', 'Team high tops', 'team', 500, T), I('retros', 'shoes', 'Team retros', 'team', 1200, T),
  I('scarf', 'scarf', 'Team scarf', 'team', 200, T), I('band', 'wrist', 'Wristband', 'team', 100, T), I('pendant', 'chain', 'Team pendant', 'team', 900, T), I('paint', 'face', 'Face paint', 'team', 150, T),
  I('backpack', 'back', 'Backpack', 'team', 400, T), I('cape', 'back', 'Team cape', 'team', 1500, T), I('finger', 'hand', 'Foam finger', 'team', 250, T), I('pennant', 'hand', 'Pennant', 'team', 150, T),

  // ---- Backgrounds
  I('night', 'bg', 'Night glow', 'bg', 0), I('dusk', 'bg', 'Dusk', 'bg', 0), I('teamwall', 'bg', 'Team wall', 'bg', 300, T),
  I('court', 'bg', 'Home court', 'bg', 600, T), I('rink', 'bg', 'Rink', 'bg', 600), I('turf', 'bg', 'Gridiron', 'bg', 600), I('ballpark', 'bg', 'Ballpark', 'bg', 600),
  I('locker', 'bg', 'Locker room', 'bg', 1200, T), I('lights', 'bg', 'Stadium lights', 'bg', 1500), I('city', 'bg', 'City at night', 'bg', 2000),
  I('jumbo', 'bg', 'Jumbotron', 'bg', 3000, T), I('confetti', 'bg', 'Championship confetti', 'bg', 9000),

  // ---- Retros: fixed-colour throwbacks
  I('rt_la04', 'top', "LA '04 gold home jersey", 'retro', 4500), I('rt_la04p', 'top', "LA '04 purple road jersey", 'retro', 4500),
  I('rt_chi96', 'top', "Chicago '96 red road jersey", 'retro', 6000), I('rt_tor00', 'top', "Toronto '00 purple jersey", 'retro', 5000),
  I('rt_cha93', 'top', "Charlotte '93 teal pinstripe jersey", 'retro', 4000), I('rt_sea96', 'top', "Seattle '96 green jersey", 'retro', 3500),
  I('rt_phx93', 'top', "Phoenix '93 purple jersey", 'retro', 3500), I('rt_whiteout', 'top', 'Buffalo white-out jersey', 'retro', 4000),
  I('rt_blau', 'top', "Barcelona '99 baggy kit", 'retro', 5000), I('rt_bra02', 'top', "Brazil '02 yellow kit", 'retro', 4500),
  I('rt_mil94', 'top', "Milan '94 red and black kit", 'retro', 4000), I('rt_arg86', 'top', "Argentina '86 stripes", 'retro', 5500),
  I('rt_ned88', 'top', "Holland '88 orange kit", 'retro', 4500), I('rt_tor67', 'top', "Toronto '67 hockey sweater", 'retro', 4000),
  I('rt_mtl', 'top', 'Montreal red hockey sweater', 'retro', 4000), I('rt_tor93', 'top', "Toronto '93 powder blue button-up", 'retro', 3500),
  I('rt_lux_chi', 'bottom', 'Luxury court shorts, Chicago red', 'retro', 6500), I('rt_lux_la', 'bottom', 'Luxury court shorts, LA purple', 'retro', 6500),
  I('rt_lux_bos', 'bottom', 'Luxury court shorts, Boston green', 'retro', 6500), I('rt_lux_cha', 'bottom', 'Luxury court shorts, Charlotte teal', 'retro', 6500),
  I('rt_blau_sh', 'bottom', "Barcelona '99 shorts", 'retro', 2000), I('rt_bra_sh', 'bottom', "Brazil '02 shorts", 'retro', 2000),
  I('rt_tear', 'bottom', 'Tear-away pants, black and white', 'retro', 2500),
  I('rt_cap_chi', 'hat', 'Chicago snapback, red and black', 'retro', 1800), I('rt_cap_tor', 'hat', "Toronto '93 fitted", 'retro', 1800),
  I('rt_bucket', 'hat', "'90s teal bucket hat", 'retro', 1500), I('rt_beanie', 'hat', 'Retro pom beanie, black and gold', 'retro', 1200),
  I('rt_satin_chi', 'outer', 'Satin starter jacket, Chicago red', 'retro', 7000), I('rt_satin_la', 'outer', 'Satin bomber, LA blue', 'retro', 6500),
  I('rt_halfzip', 'outer', "'90s half-zip windbreaker, teal and purple", 'retro', 4000),
  I('rt_ita06', 'top', "Italy '06 blue kit", 'retro', 5500), I('rt_ger90', 'top', "Germany '90 white kit", 'retro', 5500), I('rt_fra98', 'top', "France '98 blue kit", 'retro', 5000),
  I('rt_eng96', 'top', "England '96 white kit", 'retro', 4500), I('rt_nga18', 'top', "Nigeria '18 zigzag kit", 'retro', 6000), I('rt_mex98', 'top', "Mexico '98 calendar kit", 'retro', 5500),
  I('rt_lon92', 'top', "North London '92 away kit", 'retro', 6500), I('rt_man99', 'top', "Manchester '99 red kit", 'retro', 5000), I('rt_tur97', 'top', "Turin '97 black and white stripes", 'retro', 4500),
  I('rt_jpn98', 'top', "Japan '98 flame kit", 'retro', 5000), I('rt_cmr02', 'top', "Cameroon '02 sleeveless kit", 'retro', 6500),
  I('rt_van96', 'top', "Vancouver '96 teal jersey", 'retro', 5500), I('rt_hou95', 'top', "Houston '95 red pinstripe jersey", 'retro', 5000), I('rt_det98', 'top', "Detroit '98 teal flame jersey", 'retro', 5000),
  I('rt_uta97', 'top', "Utah '97 mountain jersey", 'retro', 6000), I('rt_den91', 'top', "Denver '91 rainbow jersey", 'retro', 6000), I('rt_gsw96', 'top', "Golden State '96 lightning jersey", 'retro', 5000),
  I('rt_phi01', 'top', "Philadelphia '01 black jersey", 'retro', 5500), I('rt_sac02', 'top', "Sacramento '02 black jersey", 'retro', 4500),
  I('rt_nyy', 'top', 'New York home pinstripes', 'retro', 6000), I('rt_bos', 'top', 'Boston road grey jersey', 'retro', 5000), I('rt_mtl82', 'top', "Montreal '82 powder blue jersey", 'retro', 5000),
  I('rt_tor92', 'top', "Toronto '92 home jersey", 'retro', 5000), I('rt_pit79', 'top', "Pittsburgh '79 gold pullover", 'retro', 4500),
  I('rt_buf80', 'top', "Buffalo '80 blue hockey sweater", 'retro', 5000), I('rt_hfd90', 'top', "Hartford '90 green hockey sweater", 'retro', 4500), I('rt_que95', 'top', "Quebec '95 blue hockey sweater", 'retro', 4500),
  I('rt_hou91', 'top', "Houston '91 powder blue football jersey", 'retro', 5000), I('rt_phi91', 'top', "Philadelphia '91 kelly green football jersey", 'retro', 5500),
  I('rt_cap_mtl', 'hat', "Montreal '82 tricolour cap", 'retro', 2000),

  // ---- More streetwear and designer
  I('lstee', 'top', 'Long-sleeve tee', 'street', 150), I('ringer', 'top', 'Ringer tee', 'street', 200), I('stripetee', 'top', 'Striped tee', 'street', 250),
  I('henley', 'top', 'Henley', 'street', 300), I('crewsweat', 'top', 'Crewneck sweatshirt', 'street', 450),
  I('campshirt', 'outer', 'Open camp shirt', 'street', 500), I('overshirt', 'outer', 'Open overshirt', 'street', 650), I('zipopen', 'outer', 'Open zip hoodie', 'street', 700),
  I('chore', 'outer', 'Chore coat', 'street', 900), I('cardigan', 'outer', 'Open cardigan', 'street', 800),
  I('dz_gothic', 'bottom', 'Gothic patch jeans', 'brand', 15000), I('dz_graffiti', 'bottom', 'Graffiti print jeans', 'brand', 9000),
  I('dz_bandana', 'bottom', 'Bandana print jeans', 'brand', 7500), I('dz_stars', 'bottom', 'Star stencil jeans', 'brand', 8000), I('dz_splatter', 'bottom', 'Paint splatter jeans', 'brand', 6500),

  // ---- More blanks
  I('pockettee', 'top', 'Pocket tee', 'blank', 50), I('thermal', 'top', 'Waffle thermal', 'blank', 120), I('plainhood', 'top', 'Plain hoodie', 'blank', 200),
  I('zipblank', 'outer', 'Zip-up hoodie', 'blank', 250), I('sweatpants', 'bottom', 'Sweatpants', 'blank', 120), I('chinos', 'bottom', 'Chinos', 'blank', 150),
  I('meshshorts', 'bottom', 'Mesh shorts', 'blank', 80), I('cargoshorts', 'bottom', 'Cargo shorts', 'blank', 100), I('plainbeanie', 'hat', 'Plain beanie', 'blank', 60),

  // ---- Trend pieces
  I('balloon', 'outer', 'Balloon bomber', 'street', 2400), I('shearling', 'outer', 'Shearling jacket', 'street', 3200), I('anorak', 'outer', 'Quilted anorak', 'street', 1800),
  I('fleece', 'outer', 'Pile fleece', 'street', 1200), I('linervest', 'outer', 'Quilted liner vest', 'street', 700), I('boucle', 'outer', 'Cropped bouclé jacket', 'street', 1600),
  I('gorp', 'outer', 'Trail shell', 'street', 2000), I('suedeblue', 'outer', 'Blue suede trucker', 'street', 2600), I('leathercrop', 'outer', 'Cropped leather jacket', 'street', 2800),
  I('fauxfur', 'outer', 'Faux fur coat', 'street', 3000), I('workjacket', 'outer', 'Hooded work jacket', 'street', 1500),
  I('heavyhood', 'top', 'Heavyweight boxy hoodie', 'street', 600), I('mohair', 'top', 'Fuzzy mohair knit', 'street', 900),
  I('balaclava', 'hat', 'Knit balaclava', 'street', 500), I('camp5', 'hat', 'Five-panel camp cap', 'street', 400),
  I('clogs', 'shoes', 'Clogs', 'street', 700), I('trail', 'shoes', 'Trail runners', 'street', 900),
  I('wrapshades', 'face', 'Wraparound sport shades', 'street', 600), I('pearls', 'chain', 'Pearl necklace', 'street', 1200), I('sling', 'back', 'Crossbody sling', 'street', 800),
  I('pleated', 'bottom', 'Loose pleated trousers', 'formal', 1000), I('bigcoat', 'outer', 'Houndstooth overcoat', 'formal', 4200),

  // ---- Team sleeves and bands
  I('armsleeve', 'armwear', 'Arm sleeve', 'team', 300, T), I('shooter', 'armwear', 'Shooter sleeve', 'team', 250, T),
  I('armsleeves', 'armwear', 'Arm sleeves, both arms', 'team', 500, T), I('shootersleeves', 'armwear', 'Shooter sleeves, both arms', 'team', 420, T),
  I('fullsleeve', 'armwear', 'Full sleeve, shoulder to wrist', 'team', 450, T), I('fullsleeves', 'armwear', 'Full sleeves, both arms', 'team', 800, T), I('fullleg', 'legwear', 'Full leg sleeves, both legs', 'team', 700, T), I('fullleg1', 'legwear', 'Full leg sleeve, one leg', 'team', 450, T),
  // ---- Casual: sport-brand style pieces in fixed colours
  I('blackcalf', 'legwear', 'Black calf bands', 'casual', 200), I('whitecalf', 'legwear', 'White calf bands', 'casual', 200), I('bredcalf', 'legwear', 'Black and red calf bands', 'casual', 350), I('royalcalf', 'legwear', 'Royal and gold calf bands', 'casual', 350),
  I('blackleg', 'legwear', 'Black full leg sleeves, both legs', 'casual', 600), I('blackleg1', 'legwear', 'Black full leg sleeve, one leg', 'casual', 350),
  I('fsblack1', 'armwear', 'Black full sleeve', 'casual', 350), I('fsblack', 'armwear', 'Black full sleeves, both arms', 'casual', 700), I('fswhite', 'armwear', 'White full sleeves, both arms', 'casual', 700),
  I('fsbred', 'armwear', 'Black and red full sleeves', 'casual', 900), I('fsroyal', 'armwear', 'Royal and gold full sleeves', 'casual', 900), I('elbowblack', 'armwear', 'Black elbow sleeves', 'casual', 250),
  I('legsleeve', 'legwear', 'Leg sleeve', 'team', 350, T), I('kneesleeve', 'legwear', 'Knee sleeve', 'team', 250, T), I('calfbands', 'legwear', 'Calf bands', 'team', 150, T),

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
  cs_stars: [['Black', '#141418'], ['White', '#F2F1EC']], rj_stars: [['Black', '#141418'], ['White', '#F2F1EC']],
  lstee: [['White', W], ['Black', BK], ['Heather', HG], ['Navy', NV], ['Olive', '#5B6440'], ['Cream', CR], ['Brown', '#6B4E3A']],
  ringer: [['Cream', '#F2EFE6'], ['White', W], ['Heather', HG], ['Black', BK], ['Navy', NV]],
  stripetee: [['Navy', '#1F2A44'], ['Black', BK], ['Red', '#9B2C2C'], ['Forest', '#2F4F3A'], ['Brown', '#6B4E3A']],
  henley: [['Oat', '#B9AC92'], ['Black', BK], ['White', W], ['Olive', OL], ['Burgundy', '#6B1E2A']],
  crewsweat: [['Heather', HG], ['Black', BK], ['Navy', NV], ['Cream', CR], ['Forest', '#2F4F3A'], ['Burgundy', '#6B1E2A']],
  campshirt: [['Cream', '#E9E2D0'], ['Black', BK], ['Sage', '#9AA58C'], ['Rust', '#A0522D'], ['Sky', '#8DB4D8']],
  overshirt: [['Olive', '#5B6440'], ['Black', BK], ['Khaki', '#9C8B63'], ['Navy', NV], ['Brown', '#6B4A33']],
  zipopen: [['Charcoal', '#3A3D44'], ['Black', BK], ['Heather', HG], ['Navy', NV], ['Cream', CR]],
  chore: [['Indigo', '#2E4A6E'], ['Brown duck', '#7A5A3A'], ['Black', BK], ['Olive', OL]],
  cardigan: [['Burgundy', '#6B1E2A'], ['Cream', CR], ['Black', BK], ['Forest', '#2F4F3A'], ['Navy', NV]],
  pockettee: [['White', W], ['Black', BK], ['Heather', HG], ['Navy', NV], ['Cream', CR], ['Olive', OL], ['Sky', '#8DB4D8']],
  thermal: [['Oat', '#E6DFD0'], ['Black', BK], ['Heather', HG], ['Brown', '#6B4E3A']],
  plainhood: [['Heather', HG], ['Black', BK], ['Navy', NV], ['Cream', CR], ['Forest', '#2F4F3A'], ['Brown', '#6B4E3A']],
  zipblank: [['Charcoal', '#2A2D33'], ['Heather', HG], ['Navy', NV], ['Cream', CR]],
  sweatpants: [['Heather', HG], ['Black', BK], ['Navy', NV], ['Cream', CR], ['Brown', '#6B4E3A']],
  chinos: [['Khaki', '#B9A37A'], ['Navy', NV], ['Olive', OL], ['Black', BK], ['Stone', '#D2C8B0']],
  meshshorts: [['Black', '#16161A'], ['Royal', '#264A99'], ['Red', '#9B2C2C'], ['White', '#E6E6E2'], ['Grey', '#7A7D84']],
  cargoshorts: [['Khaki', '#9C8B63'], ['Olive', OL], ['Black', BK], ['Stone', '#B9B09A']],
  plainbeanie: [['Black', BK], ['Grey', HG], ['Navy', NV], ['Cream', CR], ['Orange', '#E36414'], ['Brown', '#6B4E3A']],
  balloon: [['Caramel', '#A0662E'], ['Black', BK], ['Chocolate', '#4A2E1E'], ['Olive', OL]],
  shearling: [['Toffee', '#8B5A2B'], ['Black', BK], ['Chocolate', '#4A2E1E']],
  anorak: [['Olive', '#4E5A3F'], ['Black', BK], ['Navy', NV], ['Sand', '#B9AC92']],
  fleece: [['Cream', '#E9E2D0'], ['Black', BK], ['Moss', '#5B6440'], ['Brown', '#6B4E3A']],
  linervest: [['Olive', '#3A4A3A'], ['Black', BK], ['Navy', NV], ['Orange', '#E36414']],
  boucle: [['Beige', '#D8CDB6'], ['Black', BK], ['Cream', CR]],
  gorp: [['Forest', '#2F4F3A'], ['Black', BK], ['Navy', NV], ['Sand', '#B9AC92']],
  suedeblue: [['Blue suede', '#3E6FB5'], ['Tan suede', '#B07A4A'], ['Black suede', '#2A2B30']],
  leathercrop: [['Chocolate', '#3B2418'], ['Tobacco', '#6B4226'], ['Caramel', '#A0662E'], ['Black', '#17171F']],
  fauxfur: [['Brown', '#8A6A4A'], ['Cream', '#E6DCC8'], ['Black', '#1E1E22']],
  workjacket: [['Brown duck', '#7A5A3A'], ['Black', BK], ['Moss', '#5B6440']],
  heavyhood: [['Charcoal', '#4A4E55'], ['Black', BK], ['Cream', CR], ['Brown', '#6B4E3A'], ['Sage', '#9AA58C']],
  mohair: [['Pink', '#B23F7F'], ['Cream', CR], ['Black', BK], ['Green', '#2F8A57'], ['Blue', '#2C57A8']],
  balaclava: [['Charcoal', '#2A2D33'], ['Cream', CR], ['Black', BK], ['Brown', '#6B4E3A']],
  camp5: [['Olive', '#4E5A3F'], ['Black', BK], ['Navy', NV], ['Tan', '#B9AC92']],
  clogs: [['Brown', '#8B6B4A'], ['Black', BK], ['Taupe', '#A89A88']],
  trail: [['Grey', '#6B7078'], ['Black', BK], ['Cream', '#E9E2D0'], ['Olive', OL]],
  sling: [['Black', '#1C1C21'], ['Olive', OL], ['Grey', '#7A7D84']],
  pleated: [['Brown', '#4A4038'], ['Grey', '#6B6B70'], ['Black', BK], ['Cream', CR]],
  bigcoat: [['Charcoal', '#2C2C30'], ['Camel', '#B98B58'], ['Black', '#141416']],
};
const SHADES = {
  carpenter: { '#66492E': 0.14 }, bagcargo: { '#4A5235': 0.14 }, flannel: { '#7A2222': 0.25 },
  joggers: { '#2B3445': 0.35 }, cargo: { '#877748': 0.12, '#6B5E3C': 0.3 }, shorts: { '#4F73AD': 0.2 }, boots: { '#5A3516': 0.25 }, plaincap: { '#141418': 0.25 },
  denim: { '#3E6199': 0.2, '#456CA6': 0.1 }, washed: { '#31343A': 0.12, '#34373D': 0.08 }, techp: { '#1A1C22': 0.2 }, bomber: { '#2F3626': 0.38, '#46513A': 0.08 },
  leather: { '#0F0F15': 0.3 }, dressshirt: { '#FAFAF7': -0.3 }, turtleneck: { '#16161A': 0.2 }, blazer: { '#30343B': 0.15 }, suit: { '#18233B': 0.15 }, overcoat: { '#A57A4A': 0.12 },
  foghoodie: { '#7D8085': 0.12, '#878A8F': 0.05, '#666A70': 0.3 }, fogsweats: { '#7D8085': 0.12 }, techhood: { '#6F747B': 0.18 }, techjog: { '#6F747B': 0.18 }, sixhood: { '#0E0E12': 0.25 },
};
for (const id of ['shorts', 'tshorts', 'jorts', 'cs_red', 'cs_purple', 'cs_green', 'cs_royal', 'cs_stars', 'rt_lux_chi', 'rt_lux_la', 'rt_lux_bos', 'rt_lux_cha', 'rt_blau_sh', 'rt_bra_sh', 'meshshorts', 'cargoshorts']) ITEMS.find((i) => i.id === id).short = true;
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
const NEUTRAL = { t1: '#4B5BA8', t2: '#FFD43B', tink: '#FFFFFF', tout: '#1E2650', tacc: '#FFD43B', city: 'HOMEFIELD' };

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

// Saved fits: a named snapshot of the whole look (body, skin, hair colour, team, colours, worn items).
export const MAX_FITS = 12;
const snap = (a) => ({ skin: a.skin, hairColor: a.hairColor, body: a.body, team: a.team || '', col: { ...(a.col || {}) }, eq: { ...a.eq } });
export function fitsList() { return getState().avatar.fits || []; }
export function saveFit(name) {
  const fits = fitsList();
  if (fits.length >= MAX_FITS) return { ok: false, why: 'full' };
  const clean = String(name || '').trim().slice(0, 24) || `Fit ${fits.length + 1}`;
  const fit = { id: 'f' + Date.now().toString(36), name: clean, ...snap(getState().avatar) };
  setAvatar((a) => { a.fits = [...(a.fits || []), fit]; });
  return { ok: true, fit };
}
export function wearFit(id) {
  const fit = fitsList().find((f) => f.id === id);
  if (!fit) return false;
  setAvatar((a) => {
    const eq = {};
    for (const [slot, item] of Object.entries(fit.eq || {})) if (a.owned.includes(item)) eq[slot] = item; // skip anything no longer owned
    a.skin = fit.skin; a.hairColor = fit.hairColor; a.body = fit.body; a.team = fit.team || ''; a.col = { ...(fit.col || {}) };
    a.eq = { ...a.eq, ...eq };
    for (const slot of Object.keys(a.eq)) if (!(slot in eq) && !ALWAYS_ON.includes(slot)) delete a.eq[slot];
  });
  track('outfit_changed');
  return true;
}
export function deleteFit(id) { setAvatar((a) => { a.fits = (a.fits || []).filter((f) => f.id !== id); }); }

/** The team the character wears: the one chosen, else your first followed team, else a neutral blue. */
export function avatarTeam(a = getState().avatar) {
  const teams = myTeams();
  return teams.find((t) => `${t.league}:${t.id}` === a.team) || teams[0] || null;
}
// Team gear uses up to three team colours: t1 the main body, t2 trim, tink lettering, tout the outline
// around lettering, tacc small accents. city goes on jerseys and hoodies.
export function cityOf(team) {
  if (!team) return 'HOMEFIELD';
  const name = String(team.name || ''), short = String(team.short || '');
  const city = short && name.endsWith(short) ? name.slice(0, -short.length).trim() : '';
  return (city || short || name || team.abbr || 'HOME').toUpperCase();
}
export function palette(team) {
  if (!team) return NEUTRAL;
  const hex = (x) => (x ? (String(x).startsWith('#') ? String(x) : '#' + x) : '');
  let cs = teamColours(team);
  if (!cs) {
    const sk = skinFromColors(team.color, team.alt), a = hex(team.alt);
    const c2 = a && colorDistance(a, sk.t1) > 60 ? a : sk.t2;
    cs = [sk.t1, c2, luminance(sk.t1) < 0.3 ? '#FFFFFF' : '#111111'];
  }
  const [t1, c2, c3] = cs, W = '#FFFFFF', D = '#0B1220';
  const far = (x, y) => colorDistance(x, y) > 60;
  const t2 = far(c2, t1) ? c2 : far(c3, t1) ? c3 : darken(t1, 0.42);
  const dark = luminance(t1) < 0.3;
  const tink = [c2, c3, W, D].find((x) => contrast(x, t1) >= 3 && (dark ? luminance(x) > 0.2 : luminance(x) < 0.2)) || (dark ? W : D);
  const tout = [t2, c3, c2, dark ? D : W].find((x) => far(x, tink) && contrast(x, tink) >= 1.6) || (dark ? D : W);
  const tacc = [c3, c2].find((x) => far(x, t1)) || tink;
  return { t1, t2, tink, tout, tacc, city: cityOf(team) };
}

/* ---------- drawing ---------- */
// A front-facing illustrated fan, drawn as SVG by fan.js (body, head, face) and fan-items.js (every item).
// View boxes are in the fan's 200 x 340 design space.
const FULL = '0 -14 200 354';
const BUST = '42 -14 116 150';
const HEADVB = '50 -12 100 124';
const VB = { expr: HEADVB, hair: HEADVB, hat: HEADVB, face: HEADVB, beard: HEADVB, ear: HEADVB, top: '18 90 164 132', outer: '12 90 176 180', scarf: '46 92 108 112', chain: '50 94 100 84', wrist: '14 176 76 64', bottom: '28 178 144 162', shoes: '40 282 120 54', back: '-30 -20 260 364', hand: '70 120 130 170', bg: FULL, armwear: '34 100 132 130', legwear: '40 200 120 120' };
const cache = new Map();

/** Returns the SVG markup for a character. vb overrides the view box (shop previews and busts). */
export function avatarSvg(av, team, vb) {
  const eq = av.eq || {};
  const pal = palette(team);
  const body = BODIES[av.body ?? 1] || BODIES[1];
  const key = JSON.stringify([av.skin, av.hairColor, av.body, av.col, eq, pal, vb]);
  if (cache.has(key)) return cache.get(key);
  const colourOf = (id) => {
    const it = itemById(id);
    if (!it || !it.colors) return undefined;
    const i = (av.col && av.col[id]) || 0;
    return (it.colors[i] || it.colors[0]).k;
  };
  const inner = drawFan({
    skin: SKINS[av.skin] ?? SKINS[2],
    hair: HAIR_COLORS[av.hairColor] ?? HAIR_COLORS[0],
    eq: { ...eq, hair: eq.hair || 'short', top: eq.top || 'tee', bottom: eq.bottom || 'jeans', shoes: eq.shoes || 'sneakers' },
    colourOf, pal, build: body.id, bg: !vb || vb === FULL || vb === BUST,
    bareLegs: !!itemById(eq.bottom || 'jeans')?.short, // long pants hide the legs, so no skin shows between them
  });
  const out = `<svg viewBox="${vb || FULL}" role="img" aria-label="Your fan character" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

/** A DOM element with the character in it. Add 'bust' to the class for just head and shoulders. */
export function renderAvatar(av = getState().avatar, team = avatarTeam(av), cls = '') {
  const el = document.createElement('span');
  el.className = 'avatar ' + cls;
  el.innerHTML = avatarSvg(av, team, /\bbust\b/.test(cls) ? BUST : undefined);
  return el;
}
/** Preview of just one item on the current character, zoomed to where it is worn. */
export function previewSvg(item, av = getState().avatar, team = avatarTeam(av), ci) {
  const col = ci == null ? av.col : { ...(av.col || {}), [item.id]: ci };
  const eq = { ...av.eq, [item.slot]: item.id };
  // sleeves only show on bare arms and legs, so the preview puts on a tank or shorts
  if (item.slot === 'armwear') eq.top = 'tank';
  if (item.slot === 'legwear' && !itemById(eq.bottom || 'jeans')?.short) eq.bottom = 'shorts';
  return avatarSvg({ ...av, col, eq }, team, VB[item.slot]);
}
