// Roster and player stats for a team page. Headshots come from the feed, with initials as a fallback.
import { h, clear, face, loading, errorBox } from '../ui.js';
import { getRoster, getAthleteStats } from '../espn.js';
import { LEAGUES } from '../leagues.js';

const GROUP_ORDER = ['Offense', 'Defense', 'Special Teams', 'Pitchers', 'Catchers', 'Infielders', 'Outfielders', 'Designated Hitters', 'Forwards', 'Defensemen', 'Goalies', 'Goalkeepers', 'Defenders', 'Midfielders', 'Attackers'];
const orderOf = (g) => { const i = GROUP_ORDER.findIndex((x) => x.toLowerCase() === String(g).toLowerCase()); return i < 0 ? 99 : i; };
const titleCase = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

function grouped(players) {
  const map = new Map();
  for (const p of players) {
    const g = titleCase(p.group || p.posName || p.pos || 'Players');
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(p);
  }
  for (const list of map.values()) list.sort((a, b) => (parseInt(a.jersey, 10) || 999) - (parseInt(b.jersey, 10) || 999));
  return [...map.entries()].sort((a, b) => orderOf(a[0]) - orderOf(b[0]));
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const my = items[i++]; await fn(my); }
  }));
}

/** Returns { el } with a Roster / Stats switch. Loads lazily. */
export function rosterBlock(league) {
  return (teamId) => {
    const host = h('div', { class: 'stack' }, loading('Loading roster'));
    let mode = 'roster';
    let data = null;
    const statsCache = new Map(); // playerId -> block or null
    let statsRun = 0;

    const switcher = () => h('div', { class: 'seg' }, [['roster', 'Roster'], ['stats', 'Player stats']].map(([k, l]) => h('button', { type: 'button', class: 'seg-b' + (mode === k ? ' on' : ''), id: 'rs-' + k, onclick: () => { mode = k; draw(); } }, l)));

    function playerCard(p) {
      return h('div', { class: 'pcard' + (p.status ? ' hurt' : '') },
        face(p, league, 56),
        h('div', { class: 'pc-t' },
          h('div', { class: 'pc-n' }, p.name),
          h('small', null, [p.jersey ? '#' + p.jersey : '', p.pos, p.age ? 'Age ' + p.age : ''].filter(Boolean).join(' · ')),
          h('small', null, [p.ht, p.wt, p.exp].filter(Boolean).join(' · ')),
          p.status ? h('small', { class: 'inj' }, p.status) : null));
    }

    function drawRoster() {
      const out = h('div', { class: 'stack' });
      for (const [g, list] of grouped(data.players)) {
        out.append(h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, g, h('small', null, String(list.length))), h('div', { class: 'pgrid' }, list.map(playerCard))));
      }
      if (data.coach) out.append(h('p', { class: 'muted small-note' }, 'Head coach: ' + data.coach));
      return out;
    }

    function statsTable(title, labels, rows) {
      const cols = labels.slice(0, 14);
      return h('section', { class: 'blk' }, h('h2', { class: 'blk-h' }, title),
        h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl players' },
          h('thead', null, h('tr', null, h('th', { class: 'l' }, 'Player'), cols.map((c) => h('th', null, c)))),
          h('tbody', null, rows.map((r) => h('tr', null,
            h('td', { class: 'l team-cell' }, face(r.p, league, 28), h('span', null, r.p.short || r.p.name), h('small', null, r.p.pos)),
            cols.map((c, i) => h('td', null, r.values[i] ?? ''))))))));
    }

    async function drawStats() {
      const out = h('div', { class: 'stack' });
      const status = h('p', { class: 'muted small-note' }, '');
      out.append(status);
      const tablesHost = h('div', { class: 'stack' });
      out.append(tablesHost);
      const run = ++statsRun;
      const need = data.players.filter((p) => !statsCache.has(p.id));
      const repaint = () => {
        if (run !== statsRun) return;
        clear(tablesHost);
        const byGroup = new Map();
        for (const p of data.players) {
          const b = statsCache.get(p.id);
          if (!b) continue;
          const key = b.labels.join(',');
          if (!byGroup.has(key)) byGroup.set(key, { b, rows: [] });
          byGroup.get(key).rows.push({ p, values: b.values, o: orderOf(titleCase(p.group || p.posName || p.pos || '')) });
        }
        const tables = [...byGroup.values()].sort((a, b) => b.rows.length - a.rows.length);
        tables.forEach((t) => { t.rows.sort((a, b) => a.o - b.o); tablesHost.append(statsTable(`${t.b.title}${t.b.split ? ' · ' + t.b.split : ''} · ${t.rows.length} players`, t.b.labels, t.rows)); });
        const have = data.players.filter((p) => statsCache.get(p.id)).length;
        status.textContent = need.length && statsCache.size < data.players.length ? `Loading stats… ${statsCache.size} of ${data.players.length} players` : have ? `Season stats for ${have} players.` : 'The feed returned no season stats for these players.';
      };
      repaint();
      if (need.length) {
        await pool(need, 6, async (p) => {
          try { const blocks = await getAthleteStats(league, p.id); statsCache.set(p.id, blocks[0] || null); } catch (e) { statsCache.set(p.id, null); }
          if (run === statsRun) repaint();
        });
        repaint();
      }
      return out;
    }

    async function draw() {
      if (!data) return;
      clear(host);
      host.append(switcher());
      host.append(mode === 'roster' ? drawRoster() : await drawStats());
    }

    (async () => {
      try {
        data = await getRoster(league, teamId);
        if (!data.players.length) { clear(host).append(h('p', { class: 'muted pad' }, 'The feed has no roster for this team right now.')); return; }
        await draw();
      } catch (e) { clear(host).append(errorBox(e, () => location.reload())); }
    })();
    return host;
  };
}
