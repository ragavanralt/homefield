// Data check: asks every league's feed for a real game and reports what came back.
// If something looks wrong in the app, run this and send the report.
import { h, clear, toast } from '../ui.js';
import { CONFIG } from '../config.js';
import { getJSON, scoreboardUrl, summaryUrl, teamsUrl, standingsUrl, scheduleUrl, getRoster, getAthleteStats, getStandings, normEvent, normSummary } from '../espn.js';
import { pageHead } from '../components.js';
import { addDays, ymd } from '../util.js';
import { LEAGUES } from '../leagues.js';

const CHECK_LEAGUES = ['nhl', 'nba', 'nfl', 'mlb', 'uefa.champions', 'eng.1'];

async function checkLeague(lg) {
  const r = { league: LEAGUES[lg].label, scoreboard: '', events: 0, game: '', items: [], error: '' };
  try {
    let events = [];
    for (let back = 0; back <= 4 && !events.length; back++) {
      const j = await getJSON(scoreboardUrl(lg, ymd(addDays(new Date(), -back))), 1000);
      events = (j.events || []).map((e) => normEvent(e, lg));
      if (back === 0) r.events = events.length;
    }
    r.scoreboard = events.length ? 'ok' : 'no games found in the last 5 days';
    const pick = events.find((e) => e.state === 'in') || events.find((e) => e.state === 'post') || events[0];
    if (!pick) return r;
    r.game = `${pick.away.abbr} at ${pick.home.abbr} (${pick.state})`;
    const raw = await getJSON(summaryUrl(lg, pick.id), 1000);
    const s = normSummary(raw, lg, pick.id);
    const yes = (b, extra = '') => (b ? 'found' + extra : 'missing');
    r.items = [
      ['Game header', yes(!!s.game)],
      ['Logos', yes(!!(s.game && s.game.home.logo))],
      ['Team colours', yes(!!(s.game && s.game.home.color))],
      ['Plays', yes(s.plays.length > 0, ` (${s.plays.length})`)],
      ['Win probability from feed', s.wp ? `found (${s.wp.length})` : 'not in feed, app uses its own estimate'],
      ['Box score players', yes(s.box.players.some((p) => p.groups.some((g) => g.rows.length)))],
      ['Team stats', yes(s.box.teams.some((t) => t.stats.length))],
      ['Lineups', s.lineups ? `found (${s.lineups.kind})` : 'not posted for this game'],
      ['Leaders', yes(s.leaders.length > 0)],
      ['Odds', yes(!!(s.game && s.game.odds && s.game.odds.home != null))],
    ];
    r.keys = s.keys.join(', ');
    try {
      const t = (await getJSON(teamsUrl(lg), 1000)).sports?.[0]?.leagues?.[0]?.teams?.[0]?.team || { id: pick.home.id };
      const ro = await getRoster(lg, t.id);
      r.items.push(['Roster', ro.players.length ? `found (${ro.players.length} players, ${ro.players.filter((p) => p.face).length} headshots)` : 'missing']);
      if (ro.players[0]) {
        const st = await getAthleteStats(lg, ro.players[0].id);
        r.items.push(['Player season stats', st.length ? `found (${st[0].labels.slice(0, 6).join(' ')})` : 'missing']);
      }
    } catch (e) { r.items.push(['Roster / player stats', 'missing: ' + e.message]); }
    try {
      const gr = await getStandings(lg);
      r.items.push(['Standings', gr.length ? `found (${gr.length} tables, ${gr.reduce((n, x) => n + x.rows.length, 0)} teams)` : 'missing: feed returned no table']);
    } catch (e) { r.items.push(['Standings', 'missing: ' + e.message]); }
    for (const [label, url] of [['Team list', teamsUrl(lg)], ['Team schedule', null]]) {
      try {
        let u = url;
        if (!u) { const t = (await getJSON(teamsUrl(lg), 1000)).sports?.[0]?.leagues?.[0]?.teams?.[0]?.team; u = t ? scheduleUrl(lg, t.id) : null; }
        if (!u) { r.items.push([label, 'skipped (no team list)']); continue; }
        await getJSON(u, 1000);
        r.items.push([label, 'found']);
      } catch (e) { r.items.push([label, 'missing: ' + e.message]); }
    }
  } catch (e) {
    r.error = String(e.message).startsWith('Failed to fetch') ? 'Failed to fetch. The browser blocked the request (network or CORS). See the README on using the Worker proxy.' : e.message;
  }
  return r;
}

export async function render(root) {
  root.append(pageHead('Data check', 'Tests the data feed for each league using a real game.'));
  const out = h('div', { class: 'stack' });
  const btn = h('button', { type: 'button', class: 'btn main', id: 'run-check' }, 'Run check');
  root.append(h('p', { class: 'muted' }, 'Feed address: ' + CONFIG.espnBase), btn, out);
  let report = '';

  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Checking…';
    clear(out);
    const lines = [`Homefield data check ${new Date().toISOString()}`, `Feed: ${CONFIG.espnBase}`, `UA: ${navigator.userAgent}`];
    for (const lg of CHECK_LEAGUES) {
      const r = await checkLeague(lg);
      lines.push('', `${r.league}: scoreboard ${r.scoreboard || 'failed'}, ${r.events} games today, test game ${r.game || 'none'}`);
      if (r.error) lines.push('  ERROR ' + r.error);
      r.items.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
      if (r.keys) lines.push('  keys: ' + r.keys);
      out.append(h('section', { class: 'card' },
        h('h2', { class: 'card-h' }, r.league),
        h('p', { class: 'muted' }, `Scoreboard ${r.scoreboard || 'failed'} · ${r.events} games today${r.game ? ' · tested ' + r.game : ''}`),
        r.error ? h('p', { class: 'errtext' }, r.error) : null,
        r.items.length ? h('ul', { class: 'checklist' }, r.items.map(([k, v]) => h('li', { class: v.startsWith('found') ? 'ok' : 'warn' }, h('span', null, k), h('span', null, v)))) : null));
    }
    report = lines.join('\n');
    out.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(report); toast('Report copied'); } catch (e) { toast('Could not copy. Select the text below.'); } } }, 'Copy report'), ));
    out.append(h('pre', { class: 'report' }, report));
    btn.disabled = false; btn.textContent = 'Run again';
  });
}
