// The crew bots. Two jobs, both talk to your Supabase project with the secret (service) key.
//   node scripts/social.mjs slate [--date=YYYY-MM-DD] [--dry]   morning: publish games, cards, Cap Night players
//   node scripts/social.mjs settle [--dry]                      evening: score finished games, pay out
// Needs SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment (GitHub secrets). --dry prints and sends nothing.
import { getScoreboard, getSummary } from '../js/espn.js';
import { loadPool } from '../js/props.js';
import { buildProps } from '../js/bets.js';
import { buildSlate, buildResults, etDay } from './social-lib.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => args.includes(`--${n}`);
const arg = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];
const dry = flag('dry');
const log = (m) => console.log(m);

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function rpc(name, body) {
  const headers = { 'content-type': 'application/json', apikey: KEY };
  if (!KEY.startsWith('sb_')) headers.authorization = `Bearer ${KEY}`; // new-style secret keys go in apikey only
  const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = text; }
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  return json;
}
async function table(path) {
  const headers = { apikey: KEY };
  if (!KEY.startsWith('sb_')) headers.authorization = `Bearer ${KEY}`;
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

async function slate() {
  const day = arg('date') || etDay(new Date().toISOString());
  let survivorLeagues = ['nfl', 'nba'];
  if (!dry) {
    try { const r = await table('app_config?key=eq.survivor_leagues&select=value'); if (r[0] && Array.isArray(r[0].value)) survivorLeagues = r[0].value; } catch (e) { log(`using the default Survivor leagues (${e.message})`); }
  }
  const out = await buildSlate({ day, getScoreboard: (lg, d) => getScoreboard(lg, d, 0), loadPool, buildProps, survivorLeagues, log });
  const byKind = out.cards.reduce((a, c) => { a[c.kind] = (a[c.kind] || 0) + 1; return a; }, {});
  log(`Slate for ${day}: ${out.games.length} games, ${out.cards.length} cards (${Object.entries(byKind).map(([k, v]) => `${v} ${k}`).join(', ')}), ${out.cap.length} Cap Night players`);
  if (dry) { log(JSON.stringify(out.cards.slice(0, 6), null, 2)); return; }
  const res = await rpc('bot_publish', { p_games: out.games, p_cards: out.cards, p_cap: out.cap });
  log(`Published: ${JSON.stringify(res)}`);
  log(`Settle pass: ${JSON.stringify(await rpc('bot_results', {}))}`);
}

async function settle() {
  const pending = await rpc('bot_pending', {});
  log(`${pending.games.length} started games waiting to be scored`);
  if (!pending.games.length) { log(`Settle pass: ${JSON.stringify(await rpc('bot_results', {}))}`); return; } // still lets 30 minute waits, expiries and rounds move on
  const out = await buildResults({ pending, getSummary: (lg, id) => getSummary(lg, id, 0), log });
  log(`Reporting ${out.p_games.length} games, ${out.p_actuals.length} player lines, ${out.p_cap.length} Cap Night lines`);
  if (dry) { log(JSON.stringify(out, null, 2).slice(0, 2000)); return; }
  log(`Done: ${JSON.stringify(await rpc('bot_results', out))}`);
}

if (!['slate', 'settle'].includes(cmd)) { console.error('Usage: node scripts/social.mjs slate|settle [--dry] [--date=YYYY-MM-DD]'); process.exit(2); }
if (!dry && (!URL_ || !KEY)) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY first (or use --dry).'); process.exit(2); }
try { await (cmd === 'slate' ? slate() : settle()); process.exit(0); } catch (e) { console.error(e.message); process.exit(1); }
