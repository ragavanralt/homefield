import assert from 'node:assert/strict';
import * as U from '../js/util.js';
import * as W from '../js/winprob.js';
import { normEvent, normSummary, normStandings, parseOdds } from '../js/espn.js';
import { buildRecap, playerOfTheGame } from '../js/recap.js';
import * as B from '../js/bets.js';
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

/* ---------- betting game ---------- */
const nbaPre = normEvent(F.event('nba', 11, { state: 'pre', hs: 0, as: 0 }), 'nba');
t('underdogs pay more, and the house keeps an edge', () => {
  const ml = B.moneylines(nbaPre);
  assert.ok(ml.home.dec < ml.away.dec); // home is the favourite in the fixture odds
  assert.ok(1 / ml.home.dec + 1 / ml.away.dec > 1); // vig
});
t('american odds display', () => { assert.equal(B.american(2.5), '+150'); assert.equal(B.american(1.5), '-200'); });
t('parlay odds multiply', () => assert.equal(B.parlayDec([{ dec: 2 }, { dec: 1.5 }, { dec: 2 }]), 6));
t('moneyline legs settle', () => {
  const win = B.mlLeg(nbaPre, 'away');
  const fin = { game: normEvent(F.event('nba', 11, { state: 'post', hs: 90, as: 100, detail: 'Final' }), 'nba') };
  assert.equal(B.evalLeg(win, fin), 'won');
  assert.equal(B.evalLeg(B.mlLeg(nbaPre, 'home'), fin), 'lost');
  const live = { game: normEvent(F.event('nba', 11, { state: 'in', hs: 50, as: 40 }), 'nba') };
  assert.equal(B.evalLeg(win, live), 'pending');
});
t('soccer draw leg', () => {
  const pre = normEvent(F.event('eng.1', 12, { state: 'pre' }), 'eng.1');
  const fin = { game: normEvent(F.event('eng.1', 12, { state: 'post', hs: 1, as: 1, detail: 'FT' }), 'eng.1') };
  assert.equal(B.evalLeg(B.mlLeg(pre, 'draw'), fin), 'won');
  assert.equal(B.evalLeg(B.mlLeg(pre, 'home'), fin), 'lost');
});
const fin = (hs, as) => normEvent(F.event('nfl', 14, { state: 'post', hs, as, detail: 'Final' }), 'nfl');
const nflPre = normEvent(F.event('nfl', 14, { state: 'pre', hs: 0, as: 0 }), 'nfl');
const box = { players: [{ teamId: '7', groups: [{ name: 'passing', labels: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT'], rows: [{ id: '700', stats: ['20/30', '287', '9.5', '3', '0'] }] }, { name: 'rushing', labels: ['CAR', 'YDS', 'TD'], rows: [{ id: '700', stats: ['5', '33', '1'] }] }] }] };
t('props settle from the box score', () => {
  const mk = (stat, line, dir, g, l) => B.propLeg(nflPre, { playerId: '700', name: 'Josh Allen', label: stat, stat, line, over: 2, under: 2, box: [{ g: new RegExp(g), l: [l] }] }, dir);
  const data = { game: fin(30, 20), box };
  assert.equal(B.evalLeg(mk('Passing TDs', 2.5, 'over', 'pass', 'TD'), data), 'won');
  assert.equal(B.evalLeg(mk('Passing TDs', 2.5, 'under', 'pass', 'TD'), data), 'lost');
  assert.equal(B.evalLeg(mk('Passing yards', 300.5, 'over', 'pass', 'YDS'), data), 'lost');
  assert.equal(B.evalLeg(mk('Rushing yards', 33, 'over', 'rush', 'YDS'), data), 'push');
  const dnp = B.propLeg(nflPre, { playerId: '999', name: 'Bench Guy', label: 'x', stat: 'passyds', line: 1.5, over: 2, under: 2, box: [{ g: /pass/, l: ['YDS'] }] }, 'over');
  assert.equal(B.evalLeg(dnp, data), 'void');
});
t('prop lines come from season averages and never push', () => {
  const def = B.PROP_DEFS.nba[0];
  const p = B.priceProp(def, 24.6);
  assert.ok(p.line % 1 === 0.5); assert.ok(p.over > 1 && p.under > 1);
  assert.equal(B.priceProp(def, 3), null); // too small to be a real prop
  const blocks = [{ labels: ['GP', 'MIN', 'PTS'], values: ['10', '30', '24.6'] }];
  assert.equal(B.seasonAvg(blocks, def), 24.6);
  const nfl = [{ labels: ['GP', 'CMP', 'ATT', 'YDS', 'TD'], values: ['6', '150', '230', '1,500', '12'] }];
  assert.equal(B.seasonAvg(nfl, B.PROP_DEFS.nfl[0]), 250); assert.equal(B.seasonAvg(nfl, B.PROP_DEFS.nfl[1]), 2);
  const rb = [{ labels: ['GP', 'CAR', 'YDS', 'TD'], values: ['5', '100', '500', '4'] }];
  assert.equal(B.seasonAvg(rb, B.PROP_DEFS.nfl[0]), null); // a runner's block has no passing stats
  assert.equal(B.seasonAvg(rb, B.PROP_DEFS.nfl[2]), 100);
});
t('payouts: parlay, streak boost, loss, refund', () => {
  const L = (r, dec) => ({ result: r, dec });
  assert.equal(B.decideBet({ stake: 100, legs: [L('won', 2), L('won', 1.5)] }, 0).payout, 300);
  assert.equal(B.decideBet({ stake: 100, legs: [L('won', 2)] }, 2).payout, 220);
  assert.equal(B.decideBet({ stake: 100, legs: [L('won', 2), L('lost', 2)] }, 0).status, 'lost');
  assert.equal(B.decideBet({ stake: 100, legs: [L('won', 2), L('pending', 2)] }, 0), null);
  assert.equal(B.decideBet({ stake: 100, legs: [L('won', 2), L('lost', 2), L('pending', 2)] }, 0).status, 'lost'); // dead parlay settles early
  const d = B.decideBet({ stake: 100, legs: [L('won', 2), L('void', 3)] }, 0);
  assert.equal(d.payout, 200); // voided leg counts as 1.0
  assert.equal(B.decideBet({ stake: 100, legs: [L('void', 2)] }, 0).status, 'void');
  assert.equal(B.streakBoost(20), 0.5);
});
t('levels get harder', () => { assert.equal(B.levelFor(0), 1); assert.ok(B.levelFor(5000) > B.levelFor(500)); assert.ok(B.xpForLevel(5) > B.xpForLevel(4)); });
t('conflicting legs are detected', () => {
  assert.ok(B.conflicts(B.mlLeg(nbaPre, 'home'), B.mlLeg(nbaPre, 'away')));
  assert.ok(!B.conflicts(B.mlLeg(nbaPre, 'home'), B.mlLeg(nflPre, 'home')));
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
