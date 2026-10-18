// The game page: story (matchup, recap, win chance with replay), plays, box score, lineups, ask.
import { h, clear, crest, face, applySkin, errorBox, loading, downloadText, toast, isHidden, reveal, scoreText, poll } from '../ui.js';
import { CONFIG } from '../config.js';
import { getState, myTeamIn, markWatched, isWatched, askLeft, useAsk } from '../store.js';
import { LEAGUES, groupOf, isSoccer, leagueLabel } from '../leagues.js';
import { getSummary, rememberGame, recallGame } from '../espn.js';
import { statusInfo, watchBlock, pickPanel } from '../components.js';
import { buildSeries, swings, preGameProbs } from '../winprob.js';
import { buildRecap, whenLabel } from '../recap.js';
import { wpChart } from '../chart.js';
import { buildICS, googleUrl } from '../ics.js';
import { shareRecap } from '../share.js';
import { askContext, askGame, suggestionsFor } from '../ask.js';
import { fmtDay, fmtTime, fmtDateTime, skinFromColors, colorDistance } from '../util.js';

const titleCase = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

export async function render(root, { league, id }) {
  const key = `${league}:${id}`;
  let data = null;
  let game = recallGame(key) || null;
  let tab = 'story';
  let replayIdx = null;
  let playTimer = null;
  let boxTeam = 'home';
  let showAllPlays = false;
  const askState = { msgs: [], busy: false };
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
      const wb = h('button', { type: 'button', class: 'btn on-skin small', 'aria-pressed': isWatched(g.key) ? 'true' : 'false', onclick: () => { markWatched(g); wb.setAttribute('aria-pressed', isWatched(g.key) ? 'true' : 'false'); wb.textContent = isWatched(g.key) ? 'Watched ✓' : 'Mark watched'; toast(isWatched(g.key) ? 'Added to your season' : 'Removed from your season'); } }, isWatched(g.key) ? 'Watched ✓' : 'Mark watched');
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
  const TABS = [['story', 'Story'], ['plays', 'Plays'], ['box', 'Box score'], ['lineups', 'Lineups'], ['ask', 'Ask']];
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
    const builder = { story, plays, box, lineups, ask }[tab];
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
      put(wrap, matchupCard(), card(null, pickPanel(g)), h2hCard(), leadersCard('Team leaders'));
    } else if (g.state === 'in') {
      put(wrap, watchBlock(g), replayCard(), latestPlaysCard(), leadersCard('Leaders'), h2hCard());
    } else {
      put(wrap, recapCard(), replayCard(), leadersCard('Leaders'), h2hCard());
    }
    return wrap;
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
      return h('div', { class: 'wseg', style: { width: (p * 100).toFixed(1) + '%', background: bg, color: ink } }, h('span', null, (k === 'draw' ? 'Draw' : g[k].abbr) + ' ' + Math.round(p * 100) + '%'));
    }));
    const src = pr.source === 'odds' ? 'From betting odds.' : pr.source === 'records' ? 'Estimated from team records.' : 'No odds or records yet.';
    const prob = (side) => (g[side].probable ? h('div', { class: 'prob' }, face(g[side].probable, league, 34), h('div', null, h('small', null, 'Probable starter'), h('div', null, g[side].probable.name))) : null);
    const info = h('dl', { class: 'facts2' },
      h('div', null, h('dt', null, 'Starts'), h('dd', null, fmtDateTime(g.date))),
      g.venue ? h('div', null, h('dt', null, 'Stadium'), h('dd', null, [g.venue, g.city].filter(Boolean).join(', '))) : null,
      g.broadcast ? h('div', null, h('dt', null, 'Watch on'), h('dd', null, g.broadcast)) : null,
      g.odds && g.odds.details ? h('div', null, h('dt', null, 'Line'), h('dd', null, g.odds.details + (g.odds.overUnder ? ` · O/U ${g.odds.overUnder}` : ''))) : null,
    );
    return card('Matchup', bar, h('p', { class: 'muted small-note' }, src), game.home.probable || game.away.probable ? h('div', { class: 'probs' }, sides.map(prob)) : null, info);
  }

  function leadersCard(title) {
    const lead = (data.leaders || []).filter((t) => t.cats.length);
    if (!lead.length) return null;
    return card(title, h('div', { class: 'leaders' }, lead.map((t) => {
      const side = t.teamId === game.home.id ? 'home' : t.teamId === game.away.id ? 'away' : null;
      return h('div', { class: 'ldr' },
        h('div', { class: 'ldr-h' }, side ? crest(game[side], 22) : null, h('span', null, side ? game[side].name : '')),
        t.cats.slice(0, 4).map((c) => h('div', { class: 'ldr-row' }, face(c, league, 34), h('div', { class: 'ldr-t' }, h('div', null, c.who), h('small', null, c.name)), h('div', { class: 'ldr-v' }, c.value))));
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

  function playRow(p) {
    const sc = p.homeScore != null && p.awayScore != null ? `${game.away.abbr} ${p.awayScore} · ${game.home.abbr} ${p.homeScore}` : '';
    return h('li', { class: 'play' + (p.scoring ? ' sc' : '') }, h('span', { class: 'pw' }, whenLabel(p, league) || '·'), h('span', { class: 'pt' }, p.text), sc ? h('span', { class: 'ps' }, sc) : null);
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
  function lineups() {
    const L = data.lineups;
    const wrap = h('div', { class: 'stack gcols' });
    const probables = sides.map((sd) => game[sd].probable ? [sd, game[sd].probable] : null).filter(Boolean);
    if (probables.length) wrap.append(card('Probable starters', h('div', { class: 'probs' }, probables.map(([sd, p]) => h('div', { class: 'prob' }, face(p, league, 44), h('div', null, h('small', null, game[sd].name), h('div', null, p.name)))))));
    if (!L) {
      wrap.append(card('Starting lineups', note('Lineups are not posted yet. Most feeds publish them shortly before the game starts, and this page fills in by itself.')));
      return wrap;
    }
    const ordered = [...L.teams].sort((a, b) => sides.indexOf(a.teamId === game.home.id ? 'home' : 'away') - sides.indexOf(b.teamId === game.home.id ? 'home' : 'away'));
    ordered.forEach((t) => {
      const side = t.teamId === game.home.id ? 'home' : t.teamId === game.away.id ? 'away' : null;
      const person = (p) => h('li', { class: 'pl-row' }, face(p, league, 34), h('span', { class: 'jn' }, p.jersey ? '#' + p.jersey : ''), h('span', { class: 'pn' }, p.name), p.pos ? h('small', null, p.pos) : null);
      wrap.append(card(null,
        h('div', { class: 'ldr-h' }, side ? crest(game[side], 26) : null, h('span', null, side ? game[side].name : t.abbr), t.formation ? h('small', null, ' · ' + t.formation) : null),
        h('ul', { class: 'pl-list' }, t.starters.map(person)),
        t.bench && t.bench.length ? h('details', null, h('summary', null, `Bench (${t.bench.length})`), h('ul', { class: 'pl-list' }, t.bench.map(person))) : null));
    });
    return wrap;
  }

  /* ---------- ask the game ---------- */
  function ask() {
    const wrap = h('div', { class: 'stack' });
    if (!CONFIG.askUrl) {
      return card('Ask the game', h('p', null, 'This feature needs a small free server to keep the AI key private, and it is not connected yet.'), h('p', { class: 'muted' }, 'Setup takes about 10 minutes. The steps are in the README under "Ask the game".'));
    }
    const left = askLeft(CONFIG.askDailyLimit);
    const log = h('div', { class: 'chat', 'aria-live': 'polite' });
    const input = h('input', { class: 'search', id: 'ask-input', type: 'text', placeholder: 'Ask about this game', 'aria-label': 'Your question', maxlength: 240 });
    const countEl = h('small', { class: 'muted' }, `${left} questions left today`);
    const sendBtn = h('button', { type: 'button', class: 'btn main', id: 'ask-send' }, 'Ask');

    const paint = () => {
      clear(log);
      if (!askState.msgs.length) log.append(h('div', { class: 'sugg' }, suggestionsFor(league).map((q) => h('button', { type: 'button', class: 'chip', onclick: () => { input.value = q; send(); } }, q))));
      askState.msgs.forEach((m) => log.append(h('div', { class: 'bub ' + (m.role === 'user' ? 'q' : 'a') }, m.text, m.role === 'ai' ? h('small', { class: 'src' }, 'From this game\'s data') : null)));
      if (askState.busy) log.append(h('div', { class: 'bub a' }, loading('Thinking')));
    };
    async function send() {
      const q = input.value.trim();
      if (!q || askState.busy) return;
      if (askLeft(CONFIG.askDailyLimit) <= 0) { toast('Daily question limit reached. It resets tomorrow.'); return; }
      askState.msgs.push({ role: 'user', text: q });
      input.value = '';
      askState.busy = true; paint();
      try {
        const a = await askGame(q, askContext(data, game));
        askState.msgs.push({ role: 'ai', text: a });
        useAsk();
      } catch (e) { askState.msgs.push({ role: 'ai', text: 'Sorry, that did not work: ' + e.message }); }
      askState.busy = false;
      countEl.textContent = `${askLeft(CONFIG.askDailyLimit)} questions left today`;
      paint();
    }
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    paint();
    wrap.append(card('Ask the game', log, h('div', { class: 'row' }, input, sendBtn), countEl));
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
    // Do not rebuild the page under someone who is replaying or typing a question.
    const keep = !first && (replayIdx != null || tab === 'ask');
    if (!keep) drawBody();
  }

  if (game) { drawHead(); drawTabs(); }
  bodyHost.append(loading('Loading game'));
  await load(true);

  const stop = poll(() => load(false), CONFIG.refreshMs, () => game && game.state === 'in');
  return () => { stop(); if (playTimer) clearInterval(playTimer); };
}
