import assert from 'node:assert/strict';
import * as U from '../js/util.js';
import * as W from '../js/winprob.js';
import { normEvent, normSummary, normStandings, parseOdds } from '../js/espn.js';
import { buildRecap, playerOfTheGame } from '../js/recap.js';
import * as P from '../js/picks.js';
import { buildICS, googleUrl, gameTitle } from '../js/ics.js';
import * as F from './fixtures.js';

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e); process.exitCode = 1; } };

/* ---------- util ---------- */
t('skin: dark team colour gets white ink and a lighter accent', () => {
  const s = U.skinFromColors('#00205B', '#ffffff');
  assert.equal(s.tink, '#FFFFFF');
  assert.ok(U.contrast(s.tacc, s.t1) >= 3);
});
t('skin: white team (Real Madrid) gets dark ink', () => {
  const s = U.skinFromColors('#ffffff', '#febe10');
  assert.equal(s.tink, '#0B1220');
});
t('skin: missing colour falls back', () => assert.ok(U.skinFromColors('', '').t1.startsWith('#')));
t('clock parsing', () => {
  assert.equal(U.clockSeconds('7:32'), 452);
  assert.equal(U.clockSeconds('0.4'), 0.4);
  assert.equal(U.minuteFromClock("58'"), 58);
  assert.equal(U.minuteFromClock("45'+2'"), 47);
});
t('ymd round trip', () => assert.equal(U.ymd(U.parseYmd('20261017')), '20261017'));

/* ---------- normalizers ---------- */
const nhlEv = F.event('nhl', 1);
const g = normEvent(nhlEv, 'nhl');
t('normEvent basics', () => {
  assert.equal(g.key, 'nhl:1'); assert.equal(g.state, 'in');
  assert.equal(g.home.abbr, 'TB'); assert.equal(g.home.score, 2); assert.equal(g.away.score, 1);
  assert.equal(g.home.color, '#003e7e'); assert.equal(g.venue, 'Test Arena');
  assert.equal(g.broadcast, 'TSN'); assert.equal(g.home.record, '3-1-0');
});
t('odds parse to probabilities', () => {
  assert.ok(Math.abs(g.odds.home - 0.6) < 0.001);
  assert.ok(g.odds.away > 0.4 && g.odds.away < 0.45);
});
t('schedule-style score object', () => {
  const e = F.event('nba', 2, { state: 'post', hs: 100, as: 90 });
  e.competitions[0].competitors[0].score = { value: 100, displayValue: '100' };
  assert.equal(normEvent(e, 'nba').home.score, 100);
});
t('pre game scores stay null-safe', () => {
  const e = normEvent(F.event('nba', 3, { state: 'pre', hs: 0, as: 0 }), 'nba');
  assert.equal(e.state, 'pre');
});
t('standings normalize', () => {
  const s = normStandings(F.standings('nba'));
  assert.equal(s[0].rows.length, 2); assert.equal(s[0].rows[0].stats.wins.v, '4');
});

/* ---------- summaries per sport ---------- */
const sums = {};
for (const lg of ['nba', 'nhl', 'mlb', 'nfl', 'eng.1']) {
  const grp = lg.includes('.') ? 'soccer' : lg;
  const opts = grp === 'soccer' ? { state: 'post', hs: 2, as: 0, detail: 'FT', clock: "90'", period: 2 } : { state: 'post', hs: grp === 'nba' ? 112 : 4, as: grp === 'nba' ? 104 : 2, detail: 'Final', clock: '0:00', period: 4 };
  const s = normSummary(F.summary(lg, 777, opts), lg, 777);
  sums[lg] = s;
  t(`${lg}: summary has game, plays, box`, () => {
    assert.ok(s.game, 'game'); assert.ok(s.plays.length > 0, 'plays'); assert.ok(s.box.players.length > 0 || grp === 'soccer', 'box');
    assert.equal(s.game.state, 'post');
  });
}
t('nfl plays come from drives', () => assert.equal(sums.nfl.plays.length, 24));
t('soccer plays come from keyEvents and get running score', () => {
  const p = sums['eng.1'].plays;
  assert.equal(p[p.length - 1].homeScore, 2);
  assert.ok(sums['eng.1'].lineups.teams[0].starters.length >= 1);
});
t('lineups from boxscore starters', () => assert.ok(sums.nba.lineups.teams[0].starters.length >= 2));
t('h2h and leaders parsed', () => { assert.ok(sums.nba.h2h.series.summary); assert.equal(sums.nba.leaders[0].cats[0].who, 'Test Star'); });

/* ---------- win probability ---------- */
t('feed win probability aligns to plays', () => {
  const s = W.buildSeries(sums.nba.plays, sums.nba.game, sums.nba.wp);
  assert.equal(s.estimated, false); assert.equal(s.values.length, sums.nba.plays.length);
});
t('model fallback works without feed data', () => {
  const s = W.buildSeries(sums.nhl.plays, sums.nhl.game, null);
  assert.equal(s.estimated, true);
  assert.equal(s.values[s.values.length - 1], 1); // home won
  assert.ok(s.values.every((v) => v >= 0 && v <= 1));
});
t('model: tie late is a coin flip, big lead late is near certain', () => {
  assert.ok(Math.abs(W.pHome(0, 0.1, 'nba') - 0.5) < 1e-9);
  assert.ok(W.pHome(15, 0.05, 'nba') > 0.97);
  assert.ok(W.pHome(1, 0.9, 'nhl') < 0.7);
});
t('swings find the biggest moves', () => {
  const sw = W.swings([0.5, 0.5, 0.9, 0.9, 0.9, 0.9, 0.2], 2, 2);
  assert.equal(sw[0].i, 6); assert.equal(sw[1].i, 2);
});
t('watch-worthy: close and late beats blowout', () => {
  const close = normEvent(F.event('nba', 5, { hs: 100, as: 99, period: 4, clock: '1:10', detail: '4th Quarter' }), 'nba');
  const blow = normEvent(F.event('nba', 6, { hs: 120, as: 80, period: 4, clock: '1:10', detail: '4th Quarter' }), 'nba');
  assert.ok(W.watchScore(close) > 80); assert.ok(W.watchScore(blow) < 10);
  assert.equal(W.watchLabel(W.watchScore(close)), 'Switch to it');
  assert.equal(W.watchScore(g), W.watchScore(g)); // deterministic
});
t('pre-game probs use odds, else records, and sum to 1', () => {
  const a = W.preGameProbs(g); assert.equal(a.source, 'odds'); assert.ok(Math.abs(a.home + a.away + a.draw - 1) < 1e-9);
  const ev = F.event('nba', 7, { state: 'pre', hs: 0, as: 0 }); ev.competitions[0].odds = [];
  const b = W.preGameProbs(normEvent(ev, 'nba')); assert.equal(b.source, 'records'); assert.ok(Math.abs(b.home + b.away - 1) < 1e-9);
  const sc = normEvent(F.event('eng.1', 8, { state: 'pre' }), 'eng.1'); const c = W.preGameProbs(sc); assert.ok(c.draw > 0.2);
});

/* ---------- recap ---------- */
t('nba recap: standout player and moments', () => {
  const r = buildRecap(sums.nba);
  assert.equal(r.potg.name, 'Test Star'); assert.match(r.potg.big, /38 points on 14 of 21/);
  assert.match(r.quote, /38 and the next best scorer on his team had 17/);
  assert.equal(r.moments.length, 3);
});
t('nhl recap: hat trick', () => { const r = buildRecap(sums.nhl); assert.match(r.potg.big, /Hat trick/); });
t('mlb recap: picks a standout', () => { const r = buildRecap(sums.mlb); assert.ok(r.potg && r.potg.name); });
t('nfl recap: quarterback', () => { const r = buildRecap(sums.nfl); assert.match(r.potg.big, /312 passing yards, 3 touchdowns/); });
t('soccer recap: brace and goal moments', () => {
  const r = buildRecap(sums['eng.1']);
  assert.equal(r.potg.name, 'Test Striker'); assert.equal(r.potg.big, '2 goals'); assert.ok(r.moments.length >= 2);
});
t('no recap for unfinished games', () => {
  const live = normSummary(F.summary('nba', 9, { state: 'in', hs: 50, as: 48, detail: '2nd Quarter', clock: '5:00', period: 2 }), 'nba', 9);
  assert.equal(buildRecap(live), null);
});

/* ---------- picks ---------- */
t('upset pays more than a favourite', () => {
  assert.ok(P.pointsFor(0.25) > P.pointsFor(0.5)); assert.ok(P.pointsFor(0.5) > P.pointsFor(0.75));
  assert.ok(P.pointsFor(0.99) >= 4 && P.pointsFor(0.01) <= 30);
});
t('pick, settle, stats', () => {
  const pre = normEvent(F.event('nba', 11, { state: 'pre', hs: 0, as: 0 }), 'nba');
  const pk = P.makePick(pre, 'away', 'classic');
  assert.equal(pk.status, 'pending');
  const fin = normEvent(F.event('nba', 11, { state: 'post', hs: 90, as: 100, detail: 'Final' }), 'nba');
  const done = P.settlePick(pk, fin);
  assert.equal(done.status, 'won'); assert.equal(done.points, pk.pts);
  const lost = P.settlePick(P.makePick(pre, 'home', 'streak'), fin);
  assert.equal(lost.status, 'lost');
  const st = P.computeStats({ a: done, b: { ...lost, key: 'b', date: '2026-10-18T00:00:00Z' } });
  assert.equal(st.won, 1); assert.equal(st.lost, 1); assert.equal(st.accuracy, 0.5);
  assert.equal(st.favorites.total, 2);
});
t('soccer draw pick', () => {
  const pre = normEvent(F.event('eng.1', 12, { state: 'pre' }), 'eng.1');
  const pk = P.makePick(pre, 'draw', 'classic');
  const fin = normEvent(F.event('eng.1', 12, { state: 'post', hs: 1, as: 1, detail: 'FT' }), 'eng.1');
  assert.equal(P.settlePick(pk, fin).status, 'won');
});
t('postponed games are void', () => {
  const pre = normEvent(F.event('nba', 13, { state: 'pre' }), 'nba');
  const ev = F.event('nba', 13, { state: 'post', detail: 'Postponed' }); ev.competitions[0].status.type.name = 'STATUS_POSTPONED';
  assert.equal(P.settlePick(P.makePick(pre, 'home', 'classic'), normEvent(ev, 'nba')).status, 'void');
});
t('perfect slate bonus', () => {
  const picks = {};
  for (let i = 0; i < 3; i++) picks['k' + i] = { key: 'k' + i, mode: 'slate', slate: 'nba:20261017', status: 'won', points: 10, pts: 10, date: `2026-10-17T0${i}:00:00Z`, pPicked: 0.5, pHome: 0.5, pAway: 0.5, result: 'home', league: 'nba' };
  const st = P.computeStats(picks);
  assert.equal(st.perfectSlates, 1); assert.equal(st.points, 30 + P.SLATE_BONUS);
});

/* ---------- calendar ---------- */
t('ics is valid-looking and escapes text', () => {
  const ics = buildICS([g], 'My, Teams');
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /DTSTART:20261017T230000Z/); assert.match(ics, /DTEND:20261018T020000Z/);
  assert.match(ics, /X-WR-CALNAME:My\\, Teams/); assert.ok(ics.endsWith('\r\n'));
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
});
t('titles and google link', () => {
  assert.equal(gameTitle(g), 'Flyers at Lightning');
  assert.match(googleUrl(g), /calendar\.google\.com/);
  assert.equal(gameTitle(normEvent(F.event('eng.1', 14), 'eng.1')), 'Madrid vs Barcelona');
});

console.log(`\n${passed} checks passed`);
