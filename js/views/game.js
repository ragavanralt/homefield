// The game page: story (matchup, recap, win chance with replay), plays, box score, lineups.
import { h, clear, crest, face, applySkin, errorBox, loading, downloadText, toast, isHidden, reveal, scoreText, poll } from '../ui.js';
import { CONFIG } from '../config.js';
import { getState, myTeamIn, markWatched, isWatched, track } from '../store.js';
import { LEAGUES, groupOf, isSoccer, leagueLabel } from '../leagues.js';
import { getSummary, rememberGame, recallGame, getDepthChart } from '../espn.js';
import { getSleeperLineup } from '../sleeper.js';
import { soccerSpots, mlbSpots, nbaSpots, nhlSpots, hockeyRole, shortName } from '../lineup-layout.js';
import { statusInfo, watchBlock } from '../components.js';
import { marketTabs } from '../markets.js';
import { betCard } from '../bankroll.js';
import { buildSeries, swings, preGameProbs } from '../winprob.js';
import { buildRecap, whenLabel } from '../recap.js';
import { wpChart } from '../chart.js';
import { buildICS, googleUrl } from '../ics.js';
import { shareRecap } from '../share.js';
import { fmtDay, fmtTime, fmtDateTime, skinFromColors, colorDistance } from '../util.js';

const titleCase = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const depthCache = new Map(); // league:teamId -> depth chart groups, null if it failed

export async function render(root, { league, id }) {
  const key = `${league}:${id}`;
  track('games_opened', 1, key);
  let data = null;
  let game = recallGame(key) || null;
  let tab = 'story';
  let replayIdx = null;
  let playTimer = null;
  let boxTeam = 'home';
  let showAllPlays = false;
  const sides = isSoccer(league) ? ['home', 'away'] : ['away', 'home'];

  const headHost = h('div');
  const tabsHost = h('div');
  const bodyHost = h('div', { class: 'gbody' });
  root.append(headHost, tabsHost, bodyHost);

  /* ---------- header ---------- */
  function drawHead() {
    clear(headHost);
    const g = game;
    const my = myTeamIn(g);
    const c = my || g.home;
    const st = statusInfo(g);
    const head = h('div', { class: 'ghead tex-' + groupOf(league).texture });
    applySkin(head, c.color, c.alt);

    const teamBlock = (side) => {
      const t = g[side];
      return h('a', { class: 'gh-team', href: `#/team/${league}/${t.id}` }, crest(t, 64), h('div', { class: 'gh-name' }, t.short || t.name), t.record ? h('small', null, t.record) : null);
    };
    const mid = g.state === 'pre'
      ? h('div', { class: 'gh-mid' }, h('div', { class: 'big-time' }, fmtTime(g.date)), h('small', null, fmtDay(g.date)))
      : h('div', { class: 'gh-mid' }, h('div', { class: 'gh-score' }, scoreText(g, sides[0]), h('span', null, '–'), scoreText(g, sides[1])), h('div', { class: 'gh-status ' + st.cls }, st.cls === 'live' ? h('i', { class: 'ldot' }) : null, st.text));

    const actions = h('div', { class: 'gh-actions' });
    if (g.state !== 'post' && g.date) {
      actions.append(
        h('button', { type: 'button', class: 'btn on-skin small', onclick: () => { downloadText(`${g.away.abbr}-at-${g.home.abbr}.ics`, buildICS([g])); toast('Calendar file ready'); } }, 'Add to calendar'),
        h('a', { class: 'btn on-skin small', href: googleUrl(g), target: '_blank', rel: 'noopener' }, 'Google Calendar'),
      );
    }
    if (g.state !== 'pre') {
      const wb = h('button', { type: 'button', class: 'btn on-skin small', 'aria-pressed': isWatched(g.key) ? 'true' : 'false', onclick: () => { markWatched(g); wb.setAttribute('aria-pressed', isWatched(g.key) ? 'true' : 'false'); wb.textContent = isWatched(g.key) ? 'Watched ✓' : 'Mark watched'; toast(isWatched(g.key) ? 'Added to your watched games' : 'Removed from your watched games'); } }, isWatched(g.key) ? 'Watched ✓' : 'Mark watched');
      actions.append(wb);
    }

    head.append(
      h('div', { class: 'gh-top' },
        h('button', { type: 'button', class: 'back', onclick: () => (history.length > 1 ? history.back() : (location.hash = '#/')) }, '‹ Back'),
        h('span', { class: 'gh-league' }, leagueLabel(league) + (g.series ? ' · ' + g.series : ''))),
      h('div', { class: 'gh-main' }, teamBlock(sides[0]), mid, teamBlock(sides[1])),
      h('div', { class: 'gh-meta' }, [g.venue, g.city, g.broadcast ? 'TV ' + g.broadcast : ''].filter(Boolean).join(' · ')),
      actions,
    );
    headHost.append(head);
  }

  /* ---------- tabs ---------- */
  const TABS = [['story', 'Story'], ['plays', 'Plays'], ['box', 'Box score'], ['lineups', 'Lineups']];
  function drawTabs() {
    clear(tabsHost).append(h('div', { class: 'tabs2', role: 'tablist' }, TABS.map(([k, label]) => h('button', {
      type: 'button', role: 'tab', class: 'tab2' + (tab === k ? ' on' : ''), 'aria-selected': tab === k ? 'true' : 'false', id: 'tab-' + k,
      onclick: () => { tab = k; drawTabs(); drawBody(); },
    }, label))));
  }

  function drawBody() {
    clear(bodyHost);
    if (isHidden(game)) {
      bodyHost.append(h('div', { class: 'gate' },
        h('h3', null, 'Spoiler-free is on'),
        h('p', null, 'Scores and plays for this game are hidden until you decide to look.'),
        h('button', { type: 'button', class: 'btn main', id: 'reveal-btn', onclick: () => { reveal(key); drawHead(); drawBody(); } }, 'Show me the game')));
      return;
    }
    if (!data) { bodyHost.append(loading('Loading game')); return; }
    const builder = { story, plays, box, lineups }[tab];
    bodyHost.append(builder());
  }

  /* ---------- helpers ---------- */
  const card = (title, ...kids) => h('section', { class: 'card' }, title ? h('h2', { class: 'card-h' }, title) : null, ...kids);
  const note = (t) => h('p', { class: 'muted pad' }, t);

  function teamColor(side) {
    const t = game[side];
    return skinFromColors(t.color, t.alt).t1;
  }

  /* ---------- story ---------- */
  const put = (el, ...kids) => { for (const k of kids) if (k != null && k !== false) el.append(k); return el; };

  function story() {
    const g = game;
    const wrap = h('div', { class: 'stack gcols' });
    if (g.state === 'pre') {
      put(wrap, matchupCard(), betsCard(), h2hCard(), leadersCard('Team leaders'));
    } else if (g.state === 'in') {
      put(wrap, watchBlock(g), replayCard(), betsCard(), latestPlaysCard(), leadersCard('Leaders'), h2hCard());
    } else {
      put(wrap, recapCard(), replayCard(), betsCard(), leadersCard('Leaders'), h2hCard());
    }
    return wrap;
  }

  function betsCard() {
    const g = game;
    const mineBets = Object.values(getState().bets).filter((b) => b.legs.some((l) => l.gameKey === g.key)).sort((a, b) => b.ts - a.ts);
    const wrap = h('div', { class: 'stack' });
    if (g.state === 'pre') {
      wrap.append(h('h2', { class: 'card-h' }, 'Bet on this game'), marketTabs(g));
    }
    if (mineBets.length) wrap.append(h('h2', { class: 'card-h' }, 'Your bets on this game'), h('div', { class: 'betgrid' }, mineBets.map(betCard)));
    return wrap.children.length ? h('section', { class: 'card' }, wrap) : null;
  }

  function matchupCard() {
    const g = game;
    const pr = preGameProbs(g);
    const order = isSoccer(league) ? ['home', 'draw', 'away'] : ['away', 'home'];
    const bar = h('div', { class: 'winbar', role: 'img', 'aria-label': 'Win chance' }, order.map((k) => {
      const p = pr[k];
      if (!p) return null;
      const bg = k === 'draw' ? 'var(--surface-2)' : teamColor(k);
      const ink = k === 'draw' ? 'var(--fg)' : skinFromColors(g[k].color, g[k].alt).tink;
      return h('div', { class: 'wseg', style: { width: (p * 100).toFixed(1) + '%', background: bg, color: ink } }, p >= 0.2 ? h('span', null, (k === 'draw' ? 'Draw' : g[k].abbr) + ' ' + Math.round(p * 100) + '%') : null);
    }));
    const legend = h('div', { class: 'wlegend' }, order.filter((k) => pr[k]).map((k) => h('span', null, h('i', { style: { background: k === 'draw' ? 'var(--muted)' : teamColor(k) } }), (k === 'draw' ? 'Draw' : g[k].abbr) + ' ' + Math.round(pr[k] * 100) + '%')));
    const src = pr.source === 'odds' ? 'From betting odds.' : pr.source === 'records' ? 'Estimated from team records.' : 'No odds or records yet.';
    const prob = (side) => (g[side].probable ? h('div', { class: 'prob' }, face(g[side].probable, league, 34), h('div', null, h('small', null, 'Probable starter'), h('div', null, g[side].probable.name))) : null);
    const info = h('dl', { class: 'facts2' },
      h('div', null, h('dt', null, 'Starts'), h('dd', null, fmtDateTime(g.date))),
      g.venue ? h('div', null, h('dt', null, 'Stadium'), h('dd', null, [g.venue, g.city].filter(Boolean).join(', '))) : null,
      g.broadcast ? h('div', null, h('dt', null, 'Watch on'), h('dd', null, g.broadcast)) : null,
      g.odds && g.odds.details ? h('div', null, h('dt', null, 'Line'), h('dd', null, g.odds.details + (g.odds.overUnder ? ` · O/U ${g.odds.overUnder}` : ''))) : null,
    );
    return card('Matchup', bar, legend, h('p', { class: 'muted small-note' }, src), game.home.probable || game.away.probable ? h('div', { class: 'probs' }, sides.map(prob)) : null, info);
  }

  function leadersCard(title) {
    const lead = (data.leaders || []).filter((t) => t.cats.length);
    if (!lead.length) return null;
    return card(title, h('div', { class: 'leaders' }, lead.map((t) => {
      const side = t.teamId === game.home.id ? 'home' : t.teamId === game.away.id ? 'away' : null;
      return h('div', { class: 'ldr' },
        h('div', { class: 'ldr-h' }, side ? crest(game[side], 22) : null, h('span', null, side ? game[side].name : '')),
        t.cats.slice(0, 4).map((c) => h('div', { class: 'ldr-row' }, face(c, league, 34), h('div', { class: 'ldr-t' }, h('div', { class: 'ldr-n' }, c.who), h('small', null, c.name), h('div', { class: 'ldr-v' }, c.value)))));
    })));
  }

  function h2hCard() {
    const x = data.h2h;
    if (!x) return null;
    const rows = [];
    if (x.series && (x.series.summary || x.series.score)) rows.push(h('p', { class: 'h2h-s' }, h('span', null, x.series.title + ': '), x.series.summary || x.series.score));
    const five = (x.lastFive || []).filter((t) => t.games.length);
    five.forEach((t) => {
      const side = t.teamId === game.home.id ? 'home' : t.teamId === game.away.id ? 'away' : null;
      rows.push(h('div', { class: 'l5' }, h('span', { class: 'l5-n' }, side ? game[side].abbr : 'Team'), t.games.map((m) => h('span', { class: 'rchip ' + (m.result || '') , title: `${m.atVs} ${m.opp} ${m.score}` }, m.result || '·'))));
    });
    return rows.length ? card('Head to head and form', rows) : null;
  }

  function latestPlaysCard() {
    const last = data.plays.slice(-6).reverse();
    if (!last.length) return null;
    return card('Latest plays', h('ul', { class: 'plays' }, last.map(playRow)));
  }

  // Shorter wording for the feed: drop the assist bracket on ordinary plays, tighten common phrases.
  function shortText(p) {
    let t = String(p.text || '').trim();
    if (!p.scoring) t = t.replace(/\s*\([^)]*\)\s*$/, '');
    return t.replace(/(\d+)-foot/gi, '$1ft').replace(/three point/gi, '3PT').replace(/\bjump shot\b/gi, 'jumper').replace(/\bdefensive rebound\b/gi, 'D rebound').replace(/\boffensive rebound\b/gi, 'O rebound').replace(/\s{2,}/g, ' ');
  }
  function playRow(p) {
    const sc = p.scoring && p.homeScore != null && p.awayScore != null ? `${game.away.abbr} ${p.awayScore}–${p.homeScore} ${game.home.abbr}` : '';
    const side = p.teamId === game.home.id ? 'home' : p.teamId === game.away.id ? 'away' : null;
    const pic = p.who && !isSoccer(league) ? face({ id: p.who.id, name: p.who.name, face: p.who.face }, league, 30) : side ? crest(game[side], 24) : h('span', { class: 'pface-empty' });
    return h('li', { class: 'play' + (p.scoring ? ' scoring' : '') }, h('span', { class: 'pw' }, whenLabel(p, league) || '·'), h('span', { class: 'pface' }, pic),
      h('span', { class: 'pt' }, shortText(p), sc ? h('span', { class: 'ps' }, sc) : null));
  }

  /* ----- replay slider + win chance ----- */
  function replayCard() {
    const plays = data.plays;
    if (plays.length < 2) return card('Win chance', note('Play by play is not in the feed for this game yet, so there is nothing to replay.'));
    const series = buildSeries(plays, game, data.wp);
    const sw = swings(series.values, 5);
    const scoreAt = [];
    let hh = 0, aa = 0;
    plays.forEach((p) => { if (p.homeScore != null) hh = p.homeScore; if (p.awayScore != null) aa = p.awayScore; scoreAt.push({ h: hh, a: aa }); });
    const last = plays.length - 1;
    let idx = replayIdx ?? last;

    const info = h('div', { class: 'rp-info', 'aria-live': 'polite' });
    const range = h('input', { type: 'range', id: 'replay-range', min: 0, max: last, value: idx, 'aria-label': 'Replay position', class: 'range' });
    const chart = wpChart({ values: series.values, plays, game, swingList: sw, index: idx, onPick: (i) => set(i) });

    function paint() {
      const p = plays[idx];
      const v = series.values[idx];
      const sc = scoreAt[idx];
      const chance = v >= 0.5 ? `${Math.round(v * 100)}% ${game.home.abbr}` : `${Math.round((1 - v) * 100)}% ${game.away.abbr}`;
      const scoreNode = (side) => h('span', { class: 'rp-s' }, h('small', null, game[side].abbr), String(side === 'home' ? sc.h : sc.a));
      clear(info).append(
        h('div', { class: 'rp-score' }, sides.map(scoreNode)),
        h('div', { class: 'rp-text' }, h('span', { class: 'pw' }, whenLabel(p, league) || '·'), p.text),
        h('div', { class: 'rp-chance' }, 'Win chance: ', h('b', null, chance), series.estimated ? h('small', null, ' (estimated from score and time left)') : null),
      );
    }
    function set(i) {
      idx = Math.max(0, Math.min(last, i));
      range.value = idx;
      chart.setIndex(idx);
      replayIdx = idx === last && game.state === 'in' ? null : idx;
      paint();
    }
    function stopPlay() { if (playTimer) { clearInterval(playTimer); playTimer = null; } playBtn.textContent = 'Play'; }
    const playBtn = h('button', { type: 'button', class: 'btn small', id: 'replay-play', onclick: () => {
      if (playTimer) { stopPlay(); return; }
      if (idx >= last) set(0);
      playBtn.textContent = 'Pause';
      const stepMs = Math.max(30, Math.min(160, 9000 / plays.length));
      playTimer = setInterval(() => { if (idx >= last) { stopPlay(); return; } set(idx + 1); }, stepMs);
    } }, 'Play');
    range.addEventListener('input', () => { stopPlay(); set(+range.value); });

    paint();
    const controls = h('div', { class: 'row wrap' },
      playBtn,
      h('button', { type: 'button', class: 'btn small', onclick: () => { stopPlay(); set(0); } }, 'Start'),
      sw[0] ? h('button', { type: 'button', class: 'btn small', id: 'replay-swing', onclick: () => { stopPlay(); set(sw[0].i); } }, 'Biggest swing') : null,
      h('button', { type: 'button', class: 'btn small', onclick: () => { stopPlay(); set(last); } }, game.state === 'in' ? 'Back to live' : 'End'),
    );
    return card('Win chance and replay', h('div', { class: 'chart-wrap' }, chart.el), range, controls, info,
      h('p', { class: 'muted small-note' }, 'Drag the slider or the chart to replay the game. The red dot is the biggest swing.'));
  }

  /* ----- recap ----- */
  function recapCard() {
    const r = buildRecap(data);
    if (!r) return null;
    const g = game;
    const winSide = (g.home.score ?? 0) >= (g.away.score ?? 0) ? 'home' : 'away';
    const c = g[winSide];
    const box = h('section', { class: 'recap' });
    applySkin(box, c.color, c.alt);
    box.append(
      h('div', { class: 'rh' },
        h('div', null, h('small', null, 'Final · recap'), h('div', { class: 'big' }, sides.map((sd) => h('span', { class: 'rh-t' }, g[sd].abbr + ' ' + g[sd].score)))),
        crest(c, 54)),
      h('div', { class: 'rb' },
        r.potg ? h('div', { class: 'potg' }, face(r.potg, league, 72), h('div', { class: 'potg-t' },
          h('small', null, 'Player of the game'),
          h('div', { class: 'potg-n' }, r.potg.name + (r.potg.jersey ? '  #' + r.potg.jersey : '')),
          h('div', { class: 'potg-b' }, r.potg.big),
          h('div', { class: 'potg-s' }, r.potg.sub))) : null,
        r.moments.length ? h('div', null, h('small', { class: 'cap' }, 'The moments'), h('ul', { class: 'moments' }, r.moments.map((m) => h('li', null, h('span', { class: 'mt' }, m.when || '·'), h('span', null, m.text))))) : null,
        r.quote ? h('p', { class: 'quote' }, r.quote) : null,
        h('button', { type: 'button', class: 'btn on-skin small', id: 'share-recap', onclick: async () => { try { const how = await shareRecap(r); if (how === 'downloaded') toast('Image saved'); } catch (e) { toast(e.message); } } }, 'Share or save image'),
      ));
    return box;
  }

  /* ---------- plays ---------- */
  function plays() {
    const p = data.plays;
    if (!p.length) return card('Play by play', note('The feed has no play by play for this game yet. It usually appears once the game starts.'));
    const list = [...p].reverse();
    const cut = showAllPlays ? list : list.slice(0, 60);
    return card(`Play by play · ${p.length} plays`, h('ul', { class: 'plays' }, cut.map(playRow)),
      !showAllPlays && list.length > 60 ? h('button', { type: 'button', class: 'btn', onclick: () => { showAllPlays = true; drawBody(); } }, `Show all ${list.length}`) : null);
  }

  /* ---------- box score ---------- */
  function box() {
    const b = data.box;
    const wrap = h('div', { class: 'stack gcols' });
    if (!b.teams.length && !b.players.length) return card('Box score', note('The feed has no box score for this game yet.'));

    const ht = b.teams.find((t) => t.id === game.home.id) || b.teams.find((t) => t.homeAway === 'home');
    const at = b.teams.find((t) => t.id === game.away.id) || b.teams.find((t) => t.homeAway === 'away');
    if (ht && at) {
      const map = new Map(at.stats.map((s) => [s.label, s.value]));
      const rows = ht.stats.filter((s) => map.has(s.label)).slice(0, 18);
      if (rows.length) {
        wrap.append(card('Team stats', h('table', { class: 'tbl cmp' },
          h('thead', null, h('tr', null, h('th', null, game[sides[0]].abbr), h('th', null, ''), h('th', null, game[sides[1]].abbr))),
          h('tbody', null, rows.map((s) => {
            const vals = { home: s.value, away: map.get(s.label) };
            return h('tr', null, h('td', null, String(vals[sides[0]])), h('td', { class: 'lab' }, s.label), h('td', null, String(vals[sides[1]])));
          })))));
      }
    }
    const seg = h('div', { class: 'seg' }, sides.map((sd) => h('button', { type: 'button', class: 'seg-b' + (boxTeam === sd ? ' on' : ''), onclick: () => { boxTeam = sd; drawBody(); } }, game[sd].name || game[sd].abbr)));
    const tp = b.players.find((p) => p.teamId === game[boxTeam].id);
    const groups = (tp ? tp.groups : []).filter((g) => g.rows.some((r) => r.stats.length));
    wrap.append(card('Players', seg, groups.length ? groups.map(playerTable) : note('No player stats yet.')));
    return wrap;
  }

  function playerTable(g) {
    const labels = g.labels;
    return h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl players' },
      h('thead', null, h('tr', null, h('th', { class: 'l' }, titleCase(g.name) || 'Players'), labels.map((l) => h('th', null, l)))),
      h('tbody', null, g.rows.filter((r) => r.stats.length).map((r) => h('tr', null,
        h('td', { class: 'l pl' }, face(r, league, 28), h('span', null, r.short || r.name), r.pos ? h('small', null, r.pos) : null),
        labels.map((_, i) => h('td', null, r.stats[i] ?? ''))))),
      g.totals && g.totals.length ? h('tfoot', null, h('tr', null, h('td', { class: 'l' }, 'Totals'), labels.map((_, i) => h('td', null, g.totals[i] ?? '')))) : null));
  }

  /* ---------- lineups ---------- */
  // Field markings, drawn once per kind. 100 x 100 viewBox stretched to the box.
  const LINES = {
    pitch: '<rect x="2" y="1.5" width="96" height="97" /><line x1="2" y1="50" x2="98" y2="50" /><ellipse cx="50" cy="50" rx="13" ry="8.7" /><rect x="22" y="1.5" width="56" height="15" /><rect x="36" y="1.5" width="28" height="5.2" /><rect x="22" y="83.5" width="56" height="15" /><rect x="36" y="93.3" width="28" height="5.2" />',
    diamond: '<path d="M50 94 L2 46 A68 68 0 0 1 98 46 Z" /><path d="M50 88 L74 64 L50 40 L26 64 Z" /><circle cx="50" cy="60" r="3.5" />',
    court: '<rect x="2" y="2" width="96" height="96" /><rect x="34" y="62" width="32" height="36" /><circle cx="50" cy="62" r="12" /><path d="M8 98 L8 78 A44 44 0 0 1 92 78 L92 98" /><circle cx="50" cy="91" r="2.5" />',
    rink: '<rect x="2" y="2" width="96" height="96" rx="14" /><line x1="2" y1="4" x2="98" y2="4" class="red" /><line x1="2" y1="38" x2="98" y2="38" class="blue" /><line x1="2" y1="90" x2="98" y2="90" class="red" /><path d="M42 90 A8 6 0 0 1 58 90" /><circle cx="26" cy="66" r="11" /><circle cx="74" cy="66" r="11" />',
  };
  function fieldBox(kind, spots, colorOf) {
    const box = h('div', { class: 'lu-field lu-' + kind, role: 'img', 'aria-label': spots.map((p) => `${p.pos || ''} ${p.name}`.trim()).join(', ') });
    const marks = h('div', { class: 'lu-lines', 'aria-hidden': 'true' });
    marks.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${LINES[kind]}</svg>`;
    box.append(marks);
    for (const p of spots) {
      const sk = colorOf(p);
      const tags = [];
      for (let i = 0; i < Math.min(p.goals || 0, 3); i++) tags.push(h('i', { class: 'lu-goal', title: 'Goal' }, '⚽'));
      if (p.red) tags.push(h('i', { class: 'lu-card red', title: 'Red card' }));
      else if (p.yellow) tags.push(h('i', { class: 'lu-card', title: 'Yellow card' }));
      if (p.subbedOut) tags.push(h('i', { class: 'lu-sub', title: 'Subbed off' }, '↓'));
      box.append(h('div', { class: 'lu-spot' + (p.subbedOut ? ' off' : ''), style: { left: p.x + '%', top: p.y + '%' } },
        h('span', { class: 'lu-dot', style: { background: sk.t1, color: sk.tink, borderColor: sk.t2 } }, p.jersey || (p.pos || '').slice(0, 2) || '·',
          tags.length ? h('span', { class: 'lu-tags' }, tags) : null),
        h('span', { class: 'lu-name' }, shortName(p.name)),
        p.assists ? h('small', { class: 'lu-ast' }, p.assists === 1 ? 'Assist' : p.assists + ' assists') : null));
    }
    return box;
  }
  const skinOf = (side) => (side ? skinFromColors(game[side].color, game[side].alt) : skinFromColors('', ''));
  const sideOf = (t) => (t.teamId === game.home.id ? 'home' : t.teamId === game.away.id ? 'away' : null);
  const person = (p) => h('li', { class: 'pl-row' }, face(p, league, 34), h('span', { class: 'jn' }, p.jersey ? '#' + p.jersey : ''), h('span', { class: 'pn' }, p.name),
    p.subbedIn ? h('small', { class: 'lu-in' }, '↑ on') : null, p.injury ? h('small', { class: 'inj' }, String(p.injury)) : null, p.pos ? h('small', null, p.pos) : null);
  const teamHead = (side, fallback, extra) => h('div', { class: 'ldr-h' }, side ? crest(game[side], 26) : null, h('span', null, side ? game[side].name : fallback), extra ? h('small', null, ' · ' + extra) : null);
  const groupList = (name, list) => (list.length ? h('div', null, h('h4', { class: 'dc-h' }, name), h('ul', { class: 'pl-list' }, list.map(person))) : null);

  // One team's drawing for the US sports, or null when there is not enough to draw.
  function teamField(starters, side) {
    const colorOf = () => skinOf(side);
    if (league === 'mlb') {
      const bat = starters.filter((p) => p.group !== 'pitching');
      const pit = starters.find((p) => p.group === 'pitching') || starters.find((p) => /^(SP|RP|P)$/i.test(p.pos || ''));
      const m = mlbSpots(bat.filter((p) => p !== pit), pit);
      if (m.spots.length < 5) return null;
      return [fieldBox('diamond', m.spots, colorOf),
        h('div', null, h('h4', { class: 'dc-h' }, 'Batting order'), h('ol', { class: 'pl-list lu-order' }, m.order.map((p) => person(p))))];
    }
    if (league === 'nba') {
      const spots = nbaSpots(starters);
      return spots.length === 5 ? [fieldBox('court', spots, colorOf)] : null;
    }
    if (league === 'nhl') {
      const spots = nhlSpots(starters);
      return spots.length >= 5 ? [fieldBox('rink', spots, colorOf)] : null;
    }
    return null;
  }

  function lineups() {
    const L = data.lineups;
    const wrap = h('div', { class: 'stack gcols' });
    const probables = sides.map((sd) => game[sd].probable ? [sd, game[sd].probable] : null).filter(Boolean);
    if (probables.length) wrap.append(card('Probable starters', h('div', { class: 'probs' }, probables.map(([sd, p]) => h('div', { class: 'prob' }, face(p, league, 44), h('div', null, h('small', null, game[sd].name), h('div', null, p.name)))))));
    if (!L && ['nfl', 'nba', 'nhl', 'mlb'].includes(league)) { // these feeds carry no starters before the game, so use Sleeper's expected lineups
      const holder = h('div', { class: 'stack gcols' });
      const drawDepth = () => {
        clear(holder);
        for (const sd of sides) {
          const res = depthCache.get(`${league}:${game[sd].id}`);
          const all = res ? res.groups.flatMap((g) => g.players) : [];
          const drawn = res && league !== 'nfl' ? teamField(all, sd) : null;
          holder.append(card(null, teamHead(sd, '', 'expected'),
            res === undefined ? loading('Loading expected lineup')
              : !res ? note('No expected lineup is available for this team yet.')
                : [h('small', { class: 'muted' }, `Source: ${res.src}`), ...(drawn || res.groups.map((grp) => groupList(grp.name, grp.players)))]));
        }
      };
      drawDepth();
      const loadSide = async (sd) => {
        try { const s = await getSleeperLineup(league, game[sd].abbr); if (s && s.length) return { src: 'Sleeper', groups: s }; } catch (e) { /* fall through */ }
        if (league === 'nfl') { try { const d = await getDepthChart(league, game[sd].id); if (d.length) return { src: 'ESPN depth chart', groups: d }; } catch (e) { /* none */ } }
        return null;
      };
      sides.forEach((sd) => {
        const k = `${league}:${game[sd].id}`;
        if (depthCache.has(k)) return;
        loadSide(sd).then((r) => depthCache.set(k, r)).then(() => { if (tab === 'lineups') drawDepth(); });
      });
      wrap.append(holder, note('These are expected lineups from depth charts, not the official game-day list. They fill in with the real starters once the feed posts them.'));
      return wrap;
    }
    if (!L) {
      wrap.append(card('Starting lineups', note('Lineups are not posted yet. Most feeds publish them shortly before the game starts, and this page fills in by itself.')));
      return wrap;
    }
    const ordered = [...L.teams].sort((a, b) => sides.indexOf(sideOf(a)) - sides.indexOf(sideOf(b)));

    if (isSoccer(league)) {
      const home = ordered.find((t) => sideOf(t) === 'home') || ordered[0];
      const away = ordered.find((t) => t !== home);
      if (home && away && home.starters.length >= 7 && away.starters.length >= 7) {
        const spots = [
          ...soccerSpots(away.starters, away.formation, 'top').map((p) => ({ ...p, side: sideOf(away) })),
          ...soccerSpots(home.starters, home.formation, 'bottom').map((p) => ({ ...p, side: sideOf(home) })),
        ];
        const label = (t) => h('div', { class: 'lu-team' }, crest(game[sideOf(t)] || { abbr: t.abbr }, 22), h('b', null, game[sideOf(t)]?.name || t.abbr), t.formation ? h('small', null, t.formation) : null);
        wrap.append(card('On the pitch', label(away), fieldBox('pitch', spots, (p) => skinOf(p.side)), label(home),
          game.state === 'in' ? h('p', { class: 'muted small-note' }, 'Goals, cards and subs update as the match goes on.') : null));
        for (const t of ordered) {
          const used = t.bench.filter((p) => p.subbedIn);
          if (!t.bench.length) continue;
          wrap.append(card(null, teamHead(sideOf(t), t.abbr, t.formation),
            groupList('Came on', used), groupList(used.length ? 'Unused subs' : 'Bench', t.bench.filter((p) => !p.subbedIn))));
        }
        return wrap;
      }
    }

    ordered.forEach((t) => {
      const side = sideOf(t);
      const drawn = teamField(t.starters, side);
      let rest;
      if (league === 'nhl') {
        const everyone = [...t.starters, ...t.bench];
        rest = [['Forwards', 'F'], ['Defence', 'D'], ['Goalies', 'G']].map(([n, r]) => groupList(n, everyone.filter((p) => hockeyRole(p.pos) === r)));
        rest = [h('details', { open: !drawn }, h('summary', null, `Dressed (${everyone.length})`), rest)];
      } else {
        rest = [drawn && league === 'mlb' ? null : h('ul', { class: 'pl-list' }, t.starters.map(person)),
          t.bench && t.bench.length ? h('details', null, h('summary', null, `Bench (${t.bench.length})`), h('ul', { class: 'pl-list' }, t.bench.map(person))) : null];
        if (drawn && league !== 'mlb') rest[0] = null;
      }
      wrap.append(card(null, teamHead(side, t.abbr, t.formation), ...(drawn || []), ...rest));
    });
    return wrap;
  }

  /* ---------- load + refresh ---------- */
  async function load(first) {
    try {
      const s = await getSummary(league, id, first ? 20000 : 8000);
      data = s;
      if (s.game) { game = s.game; rememberGame(game); }
      if (!game) throw new Error('This game is not in the data feed yet');
    } catch (e) {
      if (!data) {
        if (game) { drawHead(); drawTabs(); }
        clear(bodyHost).append(errorBox(e, () => load(true)));
        return;
      }
    }
    drawHead();
    drawTabs();
    // Do not rebuild the page under someone who is replaying.
    const keep = !first && replayIdx != null;
    if (!keep) drawBody();
  }

  if (game) { drawHead(); drawTabs(); }
  bodyHost.append(loading('Loading game'));
  await load(true);

  const stop = poll(() => load(false), CONFIG.refreshMs, () => game && game.state === 'in');
  return () => { stop(); if (playTimer) clearInterval(playTimer); };
}
