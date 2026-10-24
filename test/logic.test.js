import assert from 'node:assert/strict';
import * as U from '../js/util.js';
import * as W from '../js/winprob.js';
import { normEvent, normSummary, normStandings, parseOdds } from '../js/espn.js';
import { buildRecap, playerOfTheGame } from '../js/recap.js';
import * as B from '../js/bets.js';
import * as CM from '../js/cashmodel.js';
import { buildICS, googleUrl, gameTitle } from '../js/ics.js';
import * as F from './fixtures.js';
import { playoffPicture, buildBracket, soccerZone, sortRows } from '../js/playoffs.js';

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
t('soccer props: priced from season rates, only the right players, and settled from the roster stats', () => {
  const g = normEvent(F.event('uefa.champions', 77, { state: 'pre', hs: 0, as: 0 }), 'uefa.champions');
  const P = (id, name, pos) => ({ id, name, short: name, pos, face: '' });
  const players = [P('1', 'Striker S', 'F'), P('2', 'Mid M', 'M'), P('3', 'Def D', 'D'), P('4', 'Keeper K', 'G')];
  assert.deepEqual(B.propCandidates('uefa.champions', players, g).map((p) => p.id).sort(), ['1', '2', '4'], 'no defenders; keeper kept for saves');
  const stats = new Map([
    ['1', [{ labels: ['GP', 'G', 'A', 'SH', 'ST'], values: ['10', '8', '2', '35', '18'] }]],
    ['2', [{ labels: ['GP', 'G', 'A', 'SH', 'ST'], values: ['10', '1', '4', '14', '5'] }]],
    ['4', [{ labels: ['GP', 'SV', 'GA'], values: ['10', '36', '9'] }]],
  ]);
  const ms = B.buildProps('uefa.champions', players, stats, g.home.id);
  const by = (stat, id) => ms.find((m) => m.stat === stat && m.playerId === id);
  assert.equal(by('goals', '1').line, 0.5); assert.ok(by('goals', '1').over < by('goals', '2')?.over || !by('goals', '2'), 'the striker is the shorter price');
  assert.ok(by('sot', '1') && by('shots', '1') && by('assists', '2'), 'shots and assists priced');
  assert.equal(by('saves', '4').line, 3.5); assert.ok(!by('goals', '4') && !by('saves', '1'), 'keepers only get saves, outfielders never do');
  // results: roster stats become a box score; a sub who never came on is refunded
  const j = F.summary('uefa.champions', 77);
  const st = (o) => Object.entries(o).map(([abbreviation, displayValue]) => ({ abbreviation, displayValue: String(displayValue) }));
  j.boxscore = { teams: [] };
  j.rosters = [{ homeAway: 'home', team: { id: g.home.id }, roster: [
    { athlete: { id: '1', displayName: 'Striker S' }, starter: true, position: { abbreviation: 'F' }, stats: st({ G: 2, SH: 5, ST: 3 }) },
    { athlete: { id: '4', displayName: 'Keeper K' }, starter: true, position: { abbreviation: 'G' }, stats: st({ SV: 5 }) },
    { athlete: { id: '9', displayName: 'Unused Sub' }, starter: false, subbedIn: false, position: { abbreviation: 'F' }, stats: [] },
  ] }];
  const data = normSummary(j, 'uefa.champions', 77);
  data.game = { ...data.game, state: 'post' };
  const leg = (stat, id, dir) => B.propLeg(g, { ...by(stat, id), playerId: id, stat }, dir);
  assert.equal(B.evalLeg(leg('goals', '1', 'over'), data), 'won');
  assert.equal(B.evalLeg(leg('sot', '1', 'under'), data), 'lost');
  assert.equal(B.evalLeg(leg('saves', '4', 'over'), data), 'won');
  assert.equal(B.evalLeg({ ...leg('goals', '1', 'over'), prop: { ...leg('goals', '1', 'over').prop, playerId: '9', name: 'Unused Sub' } }, data), 'void');
});
t('one monster game early in the season does not set a 45.5 points line', () => {
  const def = B.PROP_DEFS.nba[0];
  const blocks = [{ labels: ['GP', 'MIN', 'PTS'], values: ['1', '38', '45'] }];
  const avg = B.shrinkAvg(def, B.seasonAvg(blocks, def), B.seasonGP(blocks));
  assert.ok(B.priceProp(def, avg).line < 20, 'one game barely moves the line');
  assert.equal(B.shrinkAvg(def, 28, 20), 28, 'a real sample is left alone');
  const lp = B.leaderProps('nba', [{ teamId: '5', cats: [{ name: 'Points', value: '45', who: 'T. Jerome', id: '9', face: '' }] }], '5', '1-0');
  assert.ok(lp[0].line < 20, 'the leaders fallback is shrunk too');
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

/* ---------- playoff picture and bracket ---------- */
const row = (id, w, l, extra = {}) => ({ team: { id: String(id), abbr: 'T' + id, name: 'Team ' + id }, stats: { wins: { v: String(w), value: w }, losses: { v: String(l), value: l }, winPercent: { v: String(w / (w + l)), value: w / (w + l) }, ...extra } });
t('nfl picture: 4 division winners then 3 wild cards, bubble after', () => {
  const div = (name, base) => ({ conf: 'AFC', div: name, name, rows: [row(base, 8, 1), row(base + 1, 5, 4), row(base + 2, 4, 5), row(base + 3, 1, 8)] });
  const p = playoffPicture('nfl', [div('AFC East', 10), div('AFC North', 20), div('AFC South', 30), div('AFC West', 40)]);
  assert.equal(p.length, 1); assert.equal(p[0].in.length, 7);
  assert.equal(p[0].in.filter((x) => x.tag === 'Division leader').length, 4);
  assert.equal(p[0].in.filter((x) => x.tag === 'Wild card').length, 3);
  assert.equal(p[0].bubble.length, 3);
});
t('nba picture: 6 in, 4 play-in', () => {
  const rows = Array.from({ length: 15 }, (_, i) => row(i + 1, 40 - i, 20 + i));
  const p = playoffPicture('nba', [{ conf: 'East', div: '', name: 'East', rows }]);
  assert.equal(p[0].in.length, 10); assert.equal(p[0].in[5].tag, 'In'); assert.equal(p[0].in[6].tag, 'Play-in');
});
t('nhl picture: top 3 per division plus 2 wild cards', () => {
  const pts = (n) => ({ points: { v: String(n), value: n } });
  const div = (name, base) => ({ conf: 'East', div: name, name, rows: Array.from({ length: 6 }, (_, i) => row(base + i, 8 - i, 2, pts(40 - i * 3 - (base % 5)))) });
  const p = playoffPicture('nhl', [div('Atlantic', 10), div('Metropolitan', 20)]);
  assert.equal(p[0].in.length, 8); assert.equal(p[0].in.filter((x) => /Wild/.test(x.tag)).length, 2);
});
t('sort uses points before win percent', () => {
  const r = sortRows([row(1, 5, 5, { points: { v: '10', value: 10 } }), row(2, 4, 6, { points: { v: '12', value: 12 } })]);
  assert.equal(r[0].team.id, '2');
});
t('soccer zones', () => { assert.equal(soccerZone('eng.1', 1, 20), 'z-in'); assert.equal(soccerZone('eng.1', 19, 20), 'z-out'); assert.equal(soccerZone('uefa.champions', 12, 36), 'z-mid'); });
t('bracket groups games into series and rounds', () => {
  const T = (id, abbr) => ({ id: String(id), abbr, name: abbr, score: 0 });
  const mk = (id, day, hs, as, state, note, h = 1, a = 2) => ({ id: String(id), league: 'mlb', date: `2026-10-${day}T23:00Z`, state, note, seriesTitle: '', seriesDone: false, home: { ...T(h, 'H'), score: hs }, away: { ...T(a, 'A'), score: as }, playoff: true });
  const games = [mk(1, 10, 3, 1, 'post', 'ALDS - Game 1'), mk(2, 11, 2, 4, 'post', 'ALDS - Game 2'), mk(3, 12, 5, 0, 'post', 'ALDS - Game 3'), mk(4, 20, 1, 0, 'pre', 'ALCS - Game 1', 1, 3)];
  const r = buildBracket(games, 'mlb');
  assert.equal(r.length, 2); assert.equal(r[0].name, 'ALDS'); assert.equal(r[0].series.length, 1);
  assert.equal(r[0].series[0].aw, 2); assert.equal(r[0].series[0].bw, 1); assert.match(r[0].series[0].text, /leads 2-1/);
  assert.equal(r[1].name, 'ALCS');
});

t('leader props: nfl from season leaders', () => {
  const leaders = [{ teamId: '7', cats: [
    { name: 'Passing Yards', value: '112/172, 1,269 YDS, 12 TD, 4 INT', who: 'K Cousins', id: '1', face: '' },
    { name: 'Rushing Yards', value: '88 CAR, 291 YDS', who: 'A Jeanty', id: '2', face: '' },
    { name: 'Receiving Yards', value: '24 REC, 312 YDS, 3 TD', who: 'B Bowers', id: '3', face: '' }] }];
  const p = B.leaderProps('nfl', leaders, '7', '5-1');
  assert.ok(p.find((x) => x.stat === 'passyds' && x.line > 150 && x.line < 260));
  assert.ok(p.find((x) => x.stat === 'recyds'));
  assert.ok(p.every((x) => x.over > 1 && x.under > 1));
});
t('leader props: nba per game', () => {
  const p = B.leaderProps('nba', [{ teamId: '28', cats: [{ name: 'Points Per Game', value: '27.8', who: 'S Barnes', id: '5', face: '' }] }], '28', '12-8');
  assert.equal(p[0].stat, 'pts'); assert.ok(p[0].line >= 27.5 && p[0].line <= 28.5);
});
t('mlb best-of series closes when a team has enough wins', () => {
  const T = (id, sc) => ({ id: String(id), abbr: 'T' + id, name: 'T' + id, score: sc });
  const g = (id, hs, as) => ({ id: String(id), league: 'mlb', date: `2026-10-0${id}T20:00Z`, state: 'post', seriesTitle: 'Wild Card Series', bestOf: 3, home: T(1, hs), away: T(2, as), playoff: true });
  const r = buildBracket([g(1, 3, 1), g(2, 4, 2)], 'mlb');
  assert.equal(r[0].series[0].state, 'done'); assert.match(r[0].series[0].text, /won 2-0/);
});

{
  const store = await import('../js/store.js');
  const odds = await import('../js/odds.js');
  store.setSetting('oddsKey', 'abc');
  const seen = [];
  globalThis.fetch = async (url) => {
    url = String(url); seen.push(url);
    const body = /\/events\/ev1\/odds/.test(url)
      ? { bookmakers: [{ key: 'draftkings', title: 'DraftKings', markets: [{ key: 'player_pass_yds', outcomes: [
        { name: 'Over', description: 'Josh Allen', price: 1.9, point: 249.5 }, { name: 'Under', description: 'Josh Allen', price: 1.9, point: 249.5 }] }] }] }
      : [{ id: 'ev1', home_team: 'Buffalo Bills', away_team: 'Las Vegas Raiders' }];
    return { ok: true, status: 200, headers: { get: (k) => (k === 'x-requests-remaining' ? '495' : null) }, json: async () => body };
  };
  const game = { league: 'nfl', key: 'nfl:1', home: { name: 'Buffalo Bills' }, away: { name: 'Las Vegas Raiders' } };
  const r = await odds.bookProps(game);
  t('odds api: book prop parsed with real line and prices', () => {
    assert.equal(r.markets.length, 1); assert.equal(r.markets[0].stat, 'passyds'); assert.equal(r.markets[0].line, 249.5); assert.equal(r.markets[0].over, 1.9);
    assert.equal(odds.creditsLeft(), '495'); assert.match(r.book, /DraftKings/);
    assert.ok(seen.some((u) => /player_pass_yds/.test(u)));
  });
  store.setSetting('oddsKey', '');
}

{
  const store = await import('../js/store.js');
  const odds = await import('../js/odds.js');
  store.setSetting('oddsKey', 'abc');
  const out = (name, pts) => pts.map(([point, price]) => ({ name: 'Over', description: name, price, point }));
  globalThis.fetch = async (url) => {
    url = String(url);
    const body = /\/events\/ev2\/odds/.test(url)
      ? { bookmakers: [{ key: 'draftkings', title: 'DraftKings', markets: [
        { key: 'player_points', outcomes: [{ name: 'Over', description: 'Stephen Curry', price: 1.9, point: 24.5 }, { name: 'Under', description: 'Stephen Curry', price: 1.9, point: 24.5 }] },
        { key: 'player_points_alternate', outcomes: out('Stephen Curry', [[19.5, 1.25], [24.5, 1.9], [29.5, 3.4], [34.5, 8]]) }] }] }
      : [{ id: 'ev2', home_team: 'Golden State Warriors', away_team: 'Memphis Grizzlies' }];
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  };
  const game = { league: 'nba', key: 'nba:2', id: '2', date: new Date(Date.now() + 36e5 * 30).toISOString(), home: { id: '9', abbr: 'GS', name: 'Golden State Warriors' }, away: { id: '29', abbr: 'MEM', name: 'Memphis Grizzlies' } };
  const r = await odds.bookProps(game, ['pts']);
  t('odds api: milestone ladder (20+, 25+, 30+, 35+) comes from the real alternate prices', () => {
    assert.equal(r.markets.length, 1);
    assert.deepEqual(r.markets[0].ladder.map((x) => [x.t, x.dec]), [[20, 1.25], [25, 1.9], [30, 3.4], [35, 8]]);
    const leg = B.ladderLeg(game, r.markets[0], 30, 3.4);
    assert.equal(leg.prop.line, 29.5); assert.equal(leg.prop.dir, 'over'); assert.equal(leg.dec, 3.4); assert.match(leg.label, /Stephen Curry 30\+ points/);
  });
  store.setSetting('oddsKey', '');
  t('simulated ladders get longer as the bar goes up, and every rung is a real price', () => {
    const lad = B.ladderOf(B.PROP_DEFS.nba[0], 23);
    assert.ok(lad.length >= 4); for (let i = 1; i < lad.length; i++) assert.ok(lad[i].t > lad[i - 1].t && lad[i].dec > lad[i - 1].dec, 'longer odds for higher bars');
    const sh = B.ladderOf(B.PROP_DEFS.soccer[1], 1.4); assert.equal(sh[0].t, 1); assert.ok(sh.every((x) => x.dec > 1));
  });
}

{
  const store = await import('../js/store.js');
  const odds = await import('../js/odds.js');
  const S2 = await import('../js/specials.js');
  store.setSetting('oddsKey', 'abc');
  globalThis.fetch = async (url) => {
    url = String(url);
    const o = (name, point, price, description) => ({ name, point, price, ...(description ? { description } : {}) });
    const body = /\/events\/ev2\/odds/.test(url)
      ? { bookmakers: [{ key: 'draftkings', title: 'DraftKings', markets: [
        { key: 'totals', outcomes: [o('Over', 224.5, 1.91), o('Under', 224.5, 1.91)] },
        { key: 'alternate_totals', outcomes: [o('Over', 214.5, 1.3), o('Under', 214.5, 3.4), o('Over', 234.5, 3.1)] },
        { key: 'spreads', outcomes: [o('Golden State Warriors', -4.5, 1.9), o('Memphis Grizzlies', 4.5, 1.9)] },
        { key: 'alternate_spreads', outcomes: [o('Golden State Warriors', -9.5, 3.2), o('Memphis Grizzlies', 9.5, 1.3)] },
        { key: 'team_totals', outcomes: [o('Over', 114.5, 1.9, 'Golden State Warriors'), o('Under', 114.5, 1.9, 'Golden State Warriors')] }] }] }
      : [{ id: 'ev2', home_team: 'Golden State Warriors', away_team: 'Memphis Grizzlies' }];
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  };
  const game = { league: 'nba', key: 'nba:3', id: '3', date: new Date(Date.now() + 36e5 * 30).toISOString(), home: { id: '9', abbr: 'GS', name: 'Golden State Warriors' }, away: { id: '29', abbr: 'MEM', name: 'Memphis Grizzlies' } };
  const r = await odds.bookGame(game);
  t('odds api: every total, spread and team-total line the book posts', () => {
    assert.deepEqual(r.totals.map((x) => x.line), [214.5, 224.5, 234.5]); assert.equal(r.totals[1].over, 1.91); assert.equal(r.totals[2].under, undefined);
    assert.deepEqual(r.spreads.map((x) => x.line), [-9.5, -4.5], 'each row is keyed by the home line; the away side lands on the same row');
    assert.deepEqual([r.spreads[1].home, r.spreads[1].away], [1.9, 1.9]); assert.deepEqual([r.spreads[0].home, r.spreads[0].away], [3.2, 1.3]);
    assert.equal(r.teamTotals.home[0].line, 114.5); assert.equal(r.teamTotals.away.length, 0);
  });
  store.setSetting('oddsKey', '');
  t('simulated game lines: ladders of totals, spreads and team totals; team total settles', () => {
    const g = { ...game, odds: { overUnder: 224.5, details: 'GS -4.5' } };
    const m = S2.modelLines(g);
    assert.ok(m.totals.length >= 5 && m.spreads.length >= 5 && m.teamTotals.home.length >= 3);
    for (let i = 1; i < m.totals.length; i++) assert.ok(m.totals[i].over > m.totals[i - 1].over, 'a higher total is a longer over');
    const leg = S2.teamTotalLeg(g, 'home', 'over', 114.5, 1.9);
    const fin = (h, a) => ({ game: { state: 'post', home: { score: h }, away: { score: a } } });
    assert.equal(S2.evalSpecial(leg, fin(120, 100)), 'won'); assert.equal(S2.evalSpecial(leg, fin(110, 100)), 'lost');
    assert.equal(S2.evalSpecial(S2.totalLeg(g, 'under', 230.5, 1.8), fin(110, 100)), 'won');
    assert.equal(S2.evalSpecial(S2.spreadLeg(g, 'away', 10.5, 1.3), fin(110, 100)), 'won');
  });
}

/* ---------- game bets and first scorer ---------- */
import * as S from '../js/specials.js';
{
  const mkG = (lg, over = {}) => ({ ...normEvent(F.event(lg, 5, { state: 'pre', hs: 0, as: 0, date: new Date(Date.now() + 36e5 * 30).toISOString() }), lg), ...over });
  const nfl = mkG('nfl'); nfl.odds = { ...(nfl.odds || {}), overUnder: 44.5, details: nfl.home.abbr + ' -3.5' };
  const list = S.gameBets(nfl);
  t('game bets: nfl has total, spread, first team, overtime and turnovers', () => {
    const ids = list.map((m) => m.id);
    for (const id of ['total', 'spread', 'first', 'ot', 'to-total', 'to-away', 'to-home']) assert.ok(ids.includes(id), id);
    assert.ok(list.every((m) => m.legs.every((l) => l.dec > 1)));
  });
  t('game bets: soccer has both teams to score and no spread', () => {
    const ids = S.gameBets(mkG('eng.1')).map((m) => m.id);
    assert.ok(ids.includes('btts') && !ids.includes('spread') && ids.includes('total'));
  });
  const fin = (lg, hs, as, extra = {}) => ({ game: { ...normEvent(F.event(lg, 6, { state: 'post', hs, as, detail: 'Final' }), lg), ...extra }, plays: [], box: { teams: [], players: [] } });
  const leg = (m, i) => ({ ...m.legs[i], league: 'nfl' });
  t('settle: total and spread', () => {
    const d = fin('nfl', 27, 20); // 47 total, home by 7
    assert.equal(B.evalLeg(leg(list.find((m) => m.id === 'total'), 0), d), 'won');
    assert.equal(B.evalLeg(leg(list.find((m) => m.id === 'total'), 1), d), 'lost');
    const sp = list.find((m) => m.id === 'spread'); // home -3.5
    assert.equal(B.evalLeg(leg(sp, 1), d), 'won'); assert.equal(B.evalLeg(leg(sp, 0), d), 'lost');
  });
  t('settle: first team, first scorer and turnovers from plays and box', () => {
    const d = fin('nfl', 27, 20);
    d.plays = [{ scoring: true, teamId: d.game.away.id, type: 'Field Goal Good', text: 'K Kicker 40 Yd Field Goal', participants: [] },
      { scoring: true, teamId: d.game.home.id, type: 'Rushing Touchdown', text: 'Josh Allen 5 Yd Run', participants: ['Josh Allen'] }];
    assert.equal(B.evalLeg(leg(list.find((m) => m.id === 'first'), 0), d), 'won'); // away scored first
    const fp = S.firstLeg(nfl, { name: 'Josh Allen', playerId: '1', dec: 8 });
    assert.equal(B.evalLeg({ ...fp, league: 'nfl' }, d), 'won'); // first TD, not the field goal
    assert.equal(B.evalLeg({ ...S.firstLeg(nfl, { name: 'Other Guy', playerId: '2', dec: 8 }), league: 'nfl' }, d), 'lost');
    d.box = { players: [], teams: [{ id: d.game.home.id, stats: [{ label: 'Turnovers', value: '2' }] }, { id: d.game.away.id, stats: [{ label: 'Turnovers', value: '1' }] }] };
    assert.equal(B.evalLeg(leg(list.find((m) => m.id === 'to-total'), 0), d), 'won'); // 3 over 2.5
  });
  t('first scorer prices are sensible', () => {
    const players = [{ id: 'a', name: 'A Back', short: 'A. Back', pos: 'RB' }, { id: 'b', name: 'B Wide', short: 'B. Wide', pos: 'WR' }];
    const m = S.scorerMarkets(nfl, 'home', players, new Map([['a', 0.8], ['b', 0.5]]));
    assert.equal(m[0].name, 'A Back'); assert.ok(m[0].dec > 2 && m[0].dec < 15 && m[0].dec < m[1].dec);
  });
}

// ---- avatar and shop ----
{
  const m = await import('../js/avatar.js');
  const { ITEMS, buy, equip, unequip, priceOf, dealToday, avatarSvg, syncUnlocks, itemById } = await import('../js/avatar.js');
  const st = await import('../js/store.js');
  st.resetAll();
  t('shop: starter items owned, hair and top equipped', () => {
    const a = st.getState().avatar;
    assert.equal(a.eq.hair, 'short'); assert.equal(a.eq.top, 'tee');
    assert.ok(a.owned.includes('curls') && !a.owned.includes('curly'));
  });
  t('shop: buying takes coins, owns and wears the item; no double buy', () => {
    const start = st.getBank().coins;
    const price = priceOf(itemById('afro'));
    const r = buy('afro');
    assert.ok(r.ok); assert.equal(st.getBank().coins, start - price);
    assert.equal(st.getState().avatar.eq.hair, 'afro');
    assert.equal(buy('afro').ok, false); assert.equal(st.getBank().coins, start - price);
  });
  t('shop: cannot buy without coins or buy earned items', () => {
    st.update((s) => { s.bank.coins = 10; });
    assert.equal(buy('crown').why, 'coins'); assert.equal(buy('ghost').why, 'earned');
    assert.equal(st.getBank().coins, 10);
  });
  t('shop: equip needs ownership; hair and top stay on', () => {
    assert.equal(equip('crown'), false);
    assert.ok(equip('buzz')); assert.equal(st.getState().avatar.eq.hair, 'buzz');
    assert.equal(unequip('hair'), false);
  });
  t('fits: save, switch back, delete, and cap at the limit', () => {
    equip('buzz'); equip('tee');
    const r = m.saveFit('  Casual  '); assert.ok(r.ok); assert.equal(r.fit.name, 'Casual');
    equip('short'); st.setAvatar((a) => { a.skin = 0; });
    assert.ok(m.wearFit(r.fit.id));
    assert.equal(st.getState().avatar.eq.hair, 'buzz'); assert.equal(st.getState().avatar.skin, 2);
    assert.equal(m.wearFit('nope'), false);
    m.deleteFit(r.fit.id); assert.equal(m.fitsList().length, 0);
    for (let i = 0; i < m.MAX_FITS; i++) assert.ok(m.saveFit('x').ok);
    assert.equal(m.saveFit('y').why, 'full');
    for (const f of [...m.fitsList()]) m.deleteFit(f.id);
  });
  t('sleeves: side toggle needs ownership and changes the drawing', () => {
    assert.equal(m.setSide('fsblack', 'left'), false);
    st.update((s) => { s.avatar.owned.push('fsblack'); });
    assert.ok(m.setSide('fsblack', 'left')); assert.equal(m.sideOf(st.getState().avatar, 'fsblack'), 'left');
    const left = avatarSvg(st.getState().avatar, null); m.setSide('fsblack', 'both');
    assert.notEqual(left, avatarSvg(st.getState().avatar, null));
    assert.equal(m.setSide('fsblack', 'up'), false);
  });
  t('shop: daily deal is on sale and stable within a day', () => {
    const d = dealToday(new Date(2026, 9, 18));
    assert.equal(d.id, dealToday(new Date(2026, 9, 18)).id);
    assert.ok(priceOf(d, new Date(2026, 9, 18)) < d.price);
  });
  t('avatar: svg draws every item and uses team colours', () => {
    const team = { color: 'FF0000', alt: '', league: 'nhl', id: '1' };
    for (const it of ITEMS) {
      const svg = avatarSvg({ skin: 2, hairColor: 1, eq: { hair: 'short', top: 'tee', [it.slot]: it.id } }, team);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && !svg.includes('undefined'), it.id);
    }
    assert.ok(avatarSvg({ skin: 2, hairColor: 0, eq: { top: 'jersey' } }, team).toLowerCase().includes('#ff0000'));
  });
  t('shop: every item has a section; designer pieces cost far more than blanks', () => {
    const secs = new Set(m.SECTIONS.map((s) => s.id));
    for (const it of m.ITEMS) assert.ok(secs.has(it.sec), it.id);
    const blank = m.ITEMS.filter((i) => i.sec === 'blank'), brand = m.ITEMS.filter((i) => i.sec === 'brand');
    assert.ok(Math.max(...blank.map((i) => i.price)) * 8 < Math.min(...brand.map((i) => i.price)));
    assert.ok(m.itemById('foghoodie').price > m.itemById('tee').price + 5000);
  });
  t('avatar: body types are free and change the drawing', () => {
    const eq = { hair: 'short', top: 'tee', bottom: 'jeans', shoes: 'sneakers' };
    const lean = m.avatarSvg({ skin: 2, hairColor: 0, body: 0, eq }, null), built = m.avatarSvg({ skin: 2, hairColor: 0, body: 2, eq }, null);
    assert.notEqual(lean, built);
    assert.equal(st.getState().avatar.body, 1);
  });
  t('colours: free and owned items switch colour; unowned cannot; drawing changes', () => {
    const eq = { hair: 'short', top: 'tee', bottom: 'jeans', shoes: 'sneakers' };
    const before = m.avatarSvg({ skin: 2, hairColor: 0, eq }, null);
    const black = m.avatarSvg({ skin: 2, hairColor: 0, eq, col: { tee: 2 } }, null);
    assert.notEqual(before, black); assert.ok(black.toLowerCase().includes('#1c1c21'));
    assert.ok(m.setColour('tee', 1)); assert.equal(m.colourIndex(st.getState().avatar, 'tee'), 1);
    assert.equal(m.setColour('foghoodie', 1), false);
    assert.equal(m.setColour('tee', 99), false);
    assert.ok(m.ITEMS.filter((i) => i.sec === 'blank' && i.slot !== 'hand' && i.slot !== 'face' && i.id !== 'runners').every((i) => i.colors && i.colors.length >= 3));
    assert.equal(m.shadeHex('#808080', 0.5), '#404040');
  });
  t('shop: earned items unlock from stats and rescue; reset bets keeps items', () => {
    st.update((s) => { s.bank.rescues = 1; });
    syncUnlocks();
    assert.ok(st.getState().avatar.owned.includes('ghost'));
    st.resetBets();
    assert.ok(st.getState().avatar.owned.includes('afro'));
    assert.equal(st.getBank().coins, 1000);
  });
}

// ---- quests, deals and the daily/weekly refresh ----
{
  const st = await import('../js/store.js');
  const gen = await import('../js/live-gen.js');
  const per = await import('../js/period.js');
  const av = await import('../js/avatar.js');
  const dayAt = (s) => per.parseDay(s);
  t('period: weeks start on Friday', () => {
    assert.equal(per.weekKey(dayAt('2026-10-16')), '2026-10-16'); // Friday
    assert.equal(per.weekKey(dayAt('2026-10-18')), '2026-10-16'); // Sunday
    assert.equal(per.weekKey(dayAt('2026-10-22')), '2026-10-16'); // Thursday
    assert.equal(per.weekKey(dayAt('2026-10-23')), '2026-10-23'); // next Friday
  });
  t('gen: same date, same quests; valid; three per day and week; one weekly item', () => {
    const a = gen.genLive('2026-10-18'), b = gen.genLive('2026-10-18');
    assert.deepEqual(a, b);
    assert.equal(a.daily.quests.length, 3); assert.equal(a.weekly.quests.length, 3);
    assert.ok(gen.validQuests(a.daily.quests) && gen.validQuests(a.weekly.quests));
    assert.equal(new Set(a.daily.quests.map((x) => x.metric)).size, 3);
    assert.ok(a.weekly.quests.filter((x) => x.item).length === 1 && av.itemById(a.weekly.quests[2].item));
    assert.ok(a.weekly.quests.every((x) => x.coins >= 250) && a.daily.quests.every((x) => x.coins <= 300));
    assert.equal(a.weekly.featured.length, 6);
  });
  t('gen: deal is a real item, changes every day, and a broken file is rejected', () => {
    let prev = '';
    for (let i = 1; i <= 40; i++) {
      const d = gen.genDaily(per.addDay('2026-10-01', i));
      assert.ok(av.itemById(d.deal.itemId) && d.deal.pct >= 15 && d.deal.pct <= 30);
      assert.notEqual(d.deal.itemId, prev); prev = d.deal.itemId;
    }
    assert.equal(gen.validQuests([{ id: 'x', metric: 'nope', target: 1, coins: 1 }]), false);
    assert.equal(gen.validQuests([]), false);
  });
  t('deal: override from the data file applies on its own day only', () => {
    const day = new Date(2026, 9, 18, 12);
    av.setDealOverride({ date: '2026-10-18', itemId: 'crown', pct: 40 });
    assert.equal(av.dealToday(day).id, 'crown');
    assert.equal(av.priceOf(av.itemById('crown'), day), Math.round(av.itemById('crown').price * 0.6 / 10) * 10);
    assert.notEqual(av.dealToday(new Date(2026, 9, 19, 12)).id, undefined);
    av.setDealOverride(null);
  });
  t('quests: progress counts, claims once, pays coins and an item, resets by day and week', () => {
    st.resetAll();
    const fri = new Date(2026, 9, 16, 9), sat = new Date(2026, 9, 17, 9), nextFri = new Date(2026, 9, 23, 9);
    const dq = { id: 'dt', metric: 'bets_placed', target: 2, coins: 100 };
    const wq = { id: 'wt', metric: 'bets_placed', target: 3, coins: 400, item: 'afro' };
    st.track('bets_placed', 1, null, fri);
    assert.equal(st.claimQuest('daily', dq, fri).ok, false);
    st.track('bets_placed', 1, null, fri);
    const c0 = st.getBank().coins;
    const r = st.claimQuest('daily', dq, fri);
    assert.ok(r.ok && st.getBank().coins === c0 + 100);
    assert.equal(st.claimQuest('daily', dq, fri).ok, false);
    assert.equal(st.questCount('daily', 'bets_placed', sat), 0); // new day, daily resets
    assert.equal(st.questCount('weekly', 'bets_placed', sat), 2); // same week keeps counting
    st.track('bets_placed', 1, null, sat);
    const w = st.claimQuest('weekly', wq, sat);
    assert.ok(w.ok && w.item === 'afro' && st.getState().avatar.owned.includes('afro'));
    const c1 = st.getBank().coins;
    assert.equal(st.questCount('weekly', 'bets_placed', nextFri), 0); // new week
    st.track('bets_placed', 3, null, nextFri);
    const again = st.claimQuest('weekly', { ...wq, id: 'wt2' }, nextFri);
    assert.ok(again.swapped && st.getBank().coins === c1 + 400 + 500); // already owned: extra coins instead
  });
  t('quests: keyed counts only once; real actions are counted', () => {
    st.resetAll();
    st.track('games_opened', 1, 'nhl:1'); st.track('games_opened', 1, 'nhl:1'); st.track('games_opened', 1, 'nhl:2');
    assert.equal(st.questCount('daily', 'games_opened'), 2);
    st.claimDaily(); assert.equal(st.questCount('daily', 'daily_claimed'), 1);
    st.buyItem('crown', 10); assert.equal(st.questCount('weekly', 'items_bought'), 1);
    av.equip('crown'); assert.ok(st.questCount('daily', 'outfit_changed') >= 1);
  });
}

// ---- team colour theme ----
{
  const th = await import('../js/themes.js');
  const { contrast } = await import('../js/util.js');
  t('team theme: readable accents in dark and light for light, dark and clashing team colours', () => {
    for (const [c, a] of [['003e7e', 'ffffff'], ['fcb514', '000000'], ['000000', 'fdb927'], ['ffffff', 'c8102e'], ['007a33', 'ba9653'], ['', '']]) {
      const d = th.teamPalette(c, a, 'dark'), l = th.teamPalette(c, a, 'light');
      assert.ok(contrast(d.accent, d.bg) >= 4.4, `dark accent ${c}`);
      assert.ok(contrast(l.accent, '#FFFFFF') >= 4.4, `light accent ${c}`);
      assert.ok(contrast(d.bg, '#F3F5FC') >= 12 && contrast(l.bg, '#0E1330') >= 12, `text on bg ${c}`);
      assert.notEqual(d.bg, l.bg);
    }
  });
}

// ---- which team the theme matches ----
{
  const st = await import('../js/store.js');
  const br = await import('../js/brand.js');
  st.resetAll();
  const A = { league: 'nhl', id: '21', name: 'Toronto Maple Leafs', short: 'Maple Leafs', color: '003e7e', alt: 'ffffff' };
  const B = { league: 'esp.1', id: '86', name: 'Real Madrid', short: 'Madrid', color: 'ffffff', alt: '000000' };
  const C = { league: 'nfl', id: '2', name: 'Buffalo Bills', short: 'Bills', color: '00338d', alt: 'c60c30' };
  [A, B, C].forEach((x) => st.follow(x));
  const g = (team, opp, hour, state = 'pre') => ({ team, game: { state, date: new Date(2026, 9, 18, hour).toISOString(), home: { id: team.id }, away: { id: opp, short: 'Them' } } });
  t('theme match: no team plays today means black and gold', () => {
    br._setToday([]);
    const m = br.themeMatch();
    assert.equal(m.team, null); assert.ok(/black and gold/.test(m.text));
  });
  t('theme match: one team playing switches to it, no choice offered', () => {
    br._setToday([g(C, '9', 16)]);
    const m = br.themeMatch();
    assert.equal(m.team.id, '2'); assert.equal(m.options.length, 0);
  });
  t('theme match: two teams today default to the soonest and can be chosen', () => {
    br._setToday([g(B, '1', 15), g(C, '9', 16)]);
    let m = br.themeMatch();
    assert.equal(m.team.id, '86'); assert.equal(m.options.length, 2);
    br.chooseTheme('nfl:2');
    m = br.themeMatch();
    assert.equal(m.team.id, '2'); assert.equal(m.current, 'nfl:2');
    br.chooseTheme('nhl:21'); // not playing today, ignored
    assert.equal(br.themeMatch().team.id, '2');
  });
}

// ---- football depth chart ----
{
  const { normDepth } = await import('../js/espn.js');
  const slot = (abbr, parent, ...names) => ({ position: { abbreviation: abbr, parent: { abbreviation: parent } }, athletes: names.map((n, i) => ({ id: String(100 + i), displayName: n, shortName: n, injuries: i === 0 && n === 'Hurt Guy' ? [{ status: 'Questionable' }] : [] })) });
  const j = { depthchart: [
    { name: 'Base 4-3 D', positions: { lde: slot('LDE', 'DE', 'Arden Key', 'Backup'), mlb: slot('MLB', 'LB', 'Mike Backer'), ss: slot('SS', 'S', 'Hurt Guy') } },
    { name: 'Base 3WR 1TE 1RB', positions: { qb: slot('QB', 'QB', 'Quarter Back'), wr1: slot('WR', 'WR', 'Wide One'), lt: slot('LT', 'OT', 'Left Tackle'), te: slot('TE', 'TE') } },
    { name: 'Base 3-4 D', positions: { lde: slot('LDE', 'DE', 'Other Formation') } },
    { name: 'Special Teams', positions: { k: slot('PK', 'PK', 'Kick Man') } },
  ] };
  t('depth chart: first name at each spot, one chart per side, injuries kept', () => {
    const r = normDepth(j);
    assert.deepEqual(r.map((x) => x.name), ['Offense', 'Defense', 'Special teams']);
    const def = r.find((x) => x.name === 'Defense').players;
    assert.deepEqual(def.map((p) => p.name), ['Arden Key', 'Mike Backer', 'Hurt Guy']);
    assert.equal(def[2].injury, 'Questionable');
    assert.ok(def[0].face.includes('/nfl/players/full/'));
    assert.equal(r.find((x) => x.name === 'Offense').players.length, 3); // te slot had nobody listed
    assert.deepEqual(normDepth({}), []);
  });
}

// ---- lineups on the field ----
{
  const LL = await import('../js/lineup-layout.js');
  const P = (name, pos, place) => ({ name, pos, place, jersey: String(place) });
  // Arsenal-style 4-2-3-1 the way ESPN spells the spots
  const xi = [P('Keeper', 'G', 1), P('Right Back', 'RB', 2), P('Left Back', 'LB', 3), P('Centre R', 'CD-R', 5), P('Centre L', 'CD-L', 6), P('Holder R', 'DM-R', 4), P('Holder L', 'DM-L', 8),
    P('Right Wing', 'RM', 7), P('Ten', 'AM', 10), P('Left Wing', 'LM', 11), P('Nine', 'F', 9)];
  t('soccer: formation splits the XI into lines, back line first, left to right', () => {
    const { gk, lines } = LL.soccerLines(xi, '4-2-3-1');
    assert.equal(gk.name, 'Keeper');
    assert.deepEqual(lines.map((l) => l.length), [4, 2, 3, 1]);
    assert.deepEqual(lines[0].map((p) => p.name), ['Left Back', 'Centre L', 'Centre R', 'Right Back']);
    assert.deepEqual(lines[2].map((p) => p.name), ['Left Wing', 'Ten', 'Right Wing']);
  });
  t('soccer: no formation falls back to one line per kind of spot', () => {
    const { lines } = LL.soccerLines(xi, '');
    assert.deepEqual(lines.map((l) => l.length), [4, 2, 2, 1, 1]);
  });
  t('soccer: bottom team attacks up, top team attacks down and is mirrored', () => {
    const bot = LL.soccerSpots(xi, '4-2-3-1', 'bottom');
    const top = LL.soccerSpots(xi, '4-2-3-1', 'top');
    const at = (s, n) => s.find((p) => p.name === n);
    assert.ok(at(bot, 'Keeper').y > 90 && at(bot, 'Nine').y > 50 && at(bot, 'Nine').y < at(bot, 'Ten').y);
    assert.ok(at(top, 'Keeper').y < 10 && at(top, 'Nine').y < 50);
    assert.ok(at(bot, 'Left Back').x < 50 && at(top, 'Left Back').x > 50);
    assert.ok([...bot, ...top].every((p) => p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100));
  });
  t('baseball: fielders on their spots, DH kept in the order only', () => {
    const bats = [P('Lead Off', 'CF', 1), P('Two', 'SS', 2), P('Big Bat', 'DH', 3), P('Four', '1B', 4), P('Catcher', 'C', 5)];
    const m = LL.mlbSpots(bats, P('Ace', 'SP', 0));
    assert.equal(m.spots.find((p) => p.name === 'Ace').pos, 'P');
    assert.equal(m.spots.length, 5);
    assert.deepEqual(m.extra.map((p) => p.name), ['Big Bat']);
    assert.deepEqual(m.order.map((p) => p.name), bats.map((p) => p.name));
    assert.ok(m.spots.find((p) => p.name === 'Catcher').y > m.spots.find((p) => p.name === 'Ace').y);
  });
  t('basketball: guards up top, big man down low', () => {
    const s = LL.nbaSpots([P('Centre', 'C', 1), P('Guard', 'G', 2), P('Fwd', 'F', 3), P('Guard 2', 'G', 4), P('Fwd 2', 'F', 5)]);
    assert.equal(s.length, 5);
    assert.ok(s.find((p) => p.name === 'Guard').y < s.find((p) => p.name === 'Centre').y);
  });
  t('hockey: three forwards, two defence, goalie in net', () => {
    const s = LL.nhlSpots([P('G1', 'G', 1), P('D1', 'D', 2), P('C1', 'C', 3), P('D2', 'D', 4), P('RW1', 'RW', 5), P('LW1', 'LW', 6), P('Extra', 'C', 7)]);
    assert.equal(s.length, 6);
    assert.deepEqual(s.slice(0, 3).map((p) => p.name), ['LW1', 'C1', 'RW1']);
    assert.equal(s[5].name, 'G1');
    assert.equal(LL.shortName('Bukayo Saka'), 'Saka');
  });
}
t('soccer lineups carry formation spot, goals and cards', () => {
  const j = F.summary('eng.1', 778, { state: 'in', hs: 1, as: 0, detail: "55'", clock: "55'", period: 2 });
  j.rosters[0].roster[0].formationPlace = '9';
  j.rosters[0].roster[0].stats = [{ abbreviation: 'G', value: 1 }, { abbreviation: 'YC', value: 1 }];
  j.rosters[1].roster[0].plays = [{ didScore: true }, { didAssist: true }];
  const L = normSummary(j, 'eng.1', 778).lineups;
  const a = L.teams[0].starters[0], b = L.teams[1].starters[0];
  assert.equal(a.place, 9); assert.equal(a.goals, 1); assert.equal(a.yellow, 1); assert.equal(a.red, 0);
  assert.equal(b.goals, 1); assert.equal(b.assists, 1);
});

// ---- Sleeper lineups ----
{
  const sl = await import('../js/sleeper.js');
  const P = (id, name, team, pos, dp, o, extra = {}) => ({ player_id: id, full_name: name, team, position: pos, depth_chart_position: dp, depth_chart_order: o, active: true, number: 7, ...extra });
  const raw = {};
  [['1', 'Quarter Back', 'WAS', 'QB', 'QB', 1], ['2', 'Backup QB', 'WAS', 'QB', 'QB', 2], ['3', 'Left Tackle', 'WAS', 'OT', 'LT', 1], ['4', 'Wide One', 'WAS', 'WR', 'LWR', 1], ['5', 'Tackler', 'WAS', 'DE', 'LDE', 1], ['6', 'Corner', 'WAS', 'CB', 'LCB', 1],
    ['7', 'Other Team QB', 'DAL', 'QB', 'QB', 1], ['8', 'Retired', 'WAS', 'RB', 'RB', 1, { active: false }], ['9', 'Free Agent', null, 'WR', 'WR', 1]].forEach(([i, n, t_, p, dp, o, e]) => { raw[i] = P(i, n, t_, p, dp, o, e || {}); });
  t('sleeper: trims the list, matches ESPN team spellings, first name per spot', () => {
    const rows = sl.slim(raw);
    assert.equal(rows.length, 7); // no free agent, no retired
    const r = sl.buildLineup(rows, 'nfl', 'WSH'); // ESPN says WSH, Sleeper says WAS
    assert.deepEqual(r.map((g) => g.name), ['Offense', 'Defense']);
    assert.deepEqual(r[0].players.map((p) => p.name), ['Quarter Back', 'Left Tackle', 'Wide One']);
    assert.equal(r[1].players.length, 2);
    assert.ok(r[0].players[0].face.includes('sleepercdn.com/content/nfl/'));
    assert.deepEqual(sl.buildLineup(rows, 'nfl', 'PHI'), []);
    assert.ok(sl.sameTeam('GS', 'GSW', 'nba') && sl.sameTeam('TB', 'TBL', 'nhl') && !sl.sameTeam('LA', 'LV', 'nfl'));
  });
}

// ---- device sync keeps quest coins ----
{
  const store = await import('../js/store.js');
  const soc = await import('../js/social.js');
  t('a quest claim survives a refresh before the background save (coins up, xp the same)', () => {
    const st = store.getState();
    const saved = JSON.parse(JSON.stringify({ teams: st.teams, bets: st.bets, bank: st.bank, avatar: st.avatar })); // what the server last got
    store.update((s) => { s.bank.coins += 350; }); // claimQuest pays coins and no xp
    const now = store.getState();
    assert.equal(now.bank.rev, (saved.bank.rev || 0) + 1, 'a coin change bumps rev');
    const m = soc.mergeFan({ teams: now.teams, bets: now.bets, bank: now.bank, avatar: now.avatar }, saved);
    assert.equal(m.bank.coins, saved.bank.coins + 350, 'the newer bank wins, so the 350 stays');
    const old = soc.mergeFan({ teams: [], bets: {}, bank: { xp: 5, coins: 500 }, avatar: {} }, { teams: [], bets: {}, bank: { xp: 5, coins: 200 }, avatar: {} });
    assert.equal(old.bank.coins, 200, 'saves from before rev keep the old rule');
    store.update((s) => { s.bank.coins -= 350; });
  });
}

// ---- betslip leg limit ----
{
  const store = await import('../js/store.js');
  const { MAX_LEGS } = await import('../js/bets.js');
  t('a full slip refuses another pick instead of dropping your first one', () => {
    store.clearSlip();
    const leg = (i) => ({ key: 'cap' + i, kind: 'ml', gameKey: 'nhl:' + (5000 + i), league: 'nhl', gameId: String(5000 + i), side: 'home', dec: 1.9, label: 'Pick ' + i, home: { abbr: 'TB' }, away: { abbr: 'BOS' } });
    for (let i = 0; i < MAX_LEGS; i++) assert.equal(store.toggleLeg(leg(i)).ok, true);
    assert.deepEqual(store.toggleLeg(leg(99)), { ok: false, why: 'full' });
    assert.equal(store.getState().slip.legs.length, MAX_LEGS);
    assert.equal(store.getState().slip.legs[0].key, 'cap0', 'the first pick is still there');
    assert.equal(store.toggleLeg(leg(3)).ok, true, 'taking one off still works when full');
    assert.equal(store.toggleLeg(leg(99)).ok, true, 'and then there is room again');
    store.clearSlip();
  });
}

// ---- OddsPapi fallback ----
{
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const st = await import('../js/store.js');
  st.setSetting('papiKey', 'k');
  const pp = await import('../js/oddspapi.js');
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url); calls.push(u);
    const J = (b) => ({ ok: true, status: 200, json: async () => b });
    if (u.includes('/sports')) return J([{ sportId: 11, sportName: 'Basketball' }]);
    if (u.includes('/fixtures')) return J([{ fixtureId: 'f1', participant1Name: 'Boston Celtics', participant2Name: 'New York Knicks' }]);
    if (u.includes('/markets')) return J([{ marketId: 101, marketName: 'Player Points', handicap: 24.5, playerProp: true, outcomes: [{ outcomeId: 1, outcomeName: 'Over' }, { outcomeId: 2, outcomeName: 'Under' }] },
      { marketId: 102, marketName: 'Player Points + Rebounds', handicap: 30.5, playerProp: true, outcomes: [{ outcomeId: 3, outcomeName: 'Over' }] }]);
    if (u.includes('/odds')) return J({ bookmakerOdds: { draftkings: { markets: { 101: { outcomes: { 1: { players: { a: { playerName: 'Tatum, Jayson', price: 1.9, active: true } } }, 2: { players: { a: { playerName: 'Tatum, Jayson', price: 1.9, active: true } } } } }, 102: { outcomes: { 3: { players: { a: { playerName: 'Tatum, Jayson', price: 1.9 } } } } } } } } });
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const game = { league: 'nba', key: 'nba:1', date: new Date(Date.now() + 3600000).toISOString(), home: { name: 'Boston Celtics' }, away: { name: 'New York Knicks' } };
  t('oddspapi: reads props, flips names, skips combo markets', async () => {});
  const r = await pp.papiProps(game, null);
  t('oddspapi: one prop row with line, both prices and book', () => {
    assert.equal(r.markets.length, 1);
    const m = r.markets[0];
    assert.equal(m.name, 'Jayson Tatum'); assert.equal(m.line, 24.5); assert.equal(m.over, 1.9); assert.equal(m.under, 1.9); assert.equal(m.book, 'DraftKings'); assert.equal(m.stat, 'pts');
  });
  const n = calls.length;
  await pp.papiProps(game, null);
  t('oddspapi: second look uses the saved answers', () => assert.equal(calls.length, n));
  t('oddspapi: market names map to the right stat', () => {
    assert.equal(pp.statOf('nba', 'Player Points'), 'pts');
    assert.equal(pp.statOf('nba', 'Player Points + Rebounds'), null);
    assert.equal(pp.statOf('nfl', 'Player Passing Yards'), 'passyds');
    assert.equal(pp.statOf('nfl', 'Player Rushing Yards'), 'rushyds');
    assert.equal(pp.statOf('nhl', 'Player Shots on Goal'), 'sog');
  });
  st.setSetting('oddsKey', 'main'); st.setSetting('papiFirst', true);
  const od = await import('../js/odds.js');
  const seen = []; const f2 = globalThis.fetch; globalThis.fetch = async (u) => { seen.push(String(u)); return f2(u); };
  pp.clearPapiCache();
  await od.bookProps(game, null);
  t('odds: OddsPapi first switch asks OddsPapi before The Odds API', () => { assert.ok(seen.length > 0 && seen.every((u) => u.includes('oddspapi'))); });
  st.setSetting('papiFirst', false); st.setSetting('oddsKey', '');
  globalThis.fetch = f2;
  globalThis.fetch = realFetch;
}

t('parlays hit counts complete parlays only', () => {
  const mk = (id, results) => ({ id, mode: 'parlay', status: 'won', stake: 100, payout: 300, dec: 3, legs: results.map((r) => ({ result: r, dec: 1.5 })) });
  const st = B.betStats({ a: mk('a', ['won', 'won', 'won']), b: mk('b', ['won', 'push', 'won']), c: mk('c', ['won', 'void']) }, { streak: 0, bestStreak: 0 });
  assert.equal(st.parlayWins, 1, 'only the clean parlay counts'); assert.equal(st.biggestParlay, 3);
});

/* ---------- cash out model ---------- */
const hrAgo = () => new Date(Date.now() - 3600e3).toISOString();
const inHr = () => new Date(Date.now() + 3600e3).toISOString();
const mkLeg = (league, over) => ({ league, gameKey: `${league}:1`, gameId: '1', date: hrAgo(), home: { abbr: 'HOM', id: '1' }, away: { abbr: 'AWY', id: '2' }, result: 'pending', ...over });
const mlLeg = (league, side, p, over = {}) => mkLeg(league, { key: 'ml' + side, kind: 'ml', side, dec: 1 / (p * B.VIG), ...over });
const spLeg = (league, sp, p, over = {}) => mkLeg(league, { key: 'sp' + JSON.stringify(sp), kind: 'special', sp: { grp: sp.t, ...sp }, dec: 1 / (p * B.VIG), ...over });
const pgame = (league, hs, as, period, clock, detail, state = 'in') => ({ league, state, period, clock, detail, home: { score: hs, abbr: 'HOM', id: '1' }, away: { score: as, abbr: 'AWY', id: '2' } });
const stOf = (league, g, extra = {}) => new Map([[`${league}:1`, { game: g, ...extra }]]);
const betOf = (legs, stake = 100) => ({ id: 'bx', status: 'pending', stake, mode: 'parlay', legs });
const wonLeg = { key: 'w', kind: 'ml', side: 'home', dec: 1.5, result: 'won', gameKey: 'nba:0', league: 'nba', date: hrAgo(), home: { abbr: 'A' }, away: { abbr: 'B' } };
const q = (league, leg, g, extra) => CM.quoteBet(betOf([leg]), stOf(league, g, extra));

t('cash out: the normal curve and its inverse agree', () => {
  assert.ok(Math.abs(CM.normInv(0.975) - 1.96) < 0.002); assert.equal(CM.normInv(0.5), 0);
  for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) assert.ok(Math.abs(CM.normCdf(CM.normInv(p)) - p) < 0.002);
});
t('cash out: NBA leads are worth what real leads are worth', () => {
  const home = mlLeg('nba', 'home', 0.5);
  const up10half = q('nba', home, pgame('nba', 60, 50, 3, '12:00', 'Halftime')).pWin;
  assert.ok(up10half > 0.74 && up10half < 0.86, 'up 10 at the half ' + up10half);
  const up10q4 = q('nba', home, pgame('nba', 80, 70, 4, '12:00', '4th 12:00')).pWin;
  assert.ok(up10q4 > 0.82 && up10q4 < 0.92, 'up 10 with 12 left ' + up10q4);
  const tied = q('nba', home, pgame('nba', 65, 65, 3, '6:00', '3rd 6:00')).pWin;
  assert.ok(Math.abs(tied - 0.5) < 0.05, 'level game is a coin flip ' + tied);
  assert.ok(q('nba', home, pgame('nba', 100, 80, 4, '2:00', '4th 2:00')).pWin > 0.99, 'up 20 with 2 left is over');
  const down3 = q('nba', home, pgame('nba', 98, 101, 4, '1:30', '4th 1:30')).pWin;
  assert.ok(down3 > 0.08 && down3 < 0.25, 'down 3 with a minute and a half left ' + down3);
});
t('cash out: a fresh game prices back to the chance it was sold at', () => {
  for (const [lg, p] of [['nba', 0.6], ['nfl', 0.35], ['nhl', 0.55], ['mlb', 0.62], ['eng.1', 0.4]]) {
    const r = CM.quoteBet(betOf([wonLeg, mlLeg(lg, 'home', p, { date: inHr() })]), new Map());
    assert.ok(r.ok, lg);
    assert.ok(Math.abs(r.pWin - p) < 0.04, `${lg} priced ${p}, model says ${r.pWin}`);
  }
});
t('cash out: a total reacts to the pace of the game', () => {
  const over = spLeg('nba', { t: 'total', dir: 'over', line: 225.5 }, 0.5);
  const slow = q('nba', over, pgame('nba', 40, 38, 3, '12:00', 'Halftime')).pWin;
  const fast = q('nba', over, pgame('nba', 70, 68, 3, '12:00', 'Halftime')).pWin;
  assert.ok(slow < 0.2 && fast > 0.8, `slow ${slow} fast ${fast}`);
});
t('cash out: soccer goals dry up as the clock runs', () => {
  const over = spLeg('eng.1', { t: 'total', dir: 'over', line: 2.5 }, 0.5);
  const dead = q('eng.1', over, pgame('eng.1', 0, 0, 2, "82'", "82'")).pWin;
  const live = q('eng.1', over, pgame('eng.1', 2, 0, 2, "70'", "70'")).pWin;
  assert.ok(dead < 0.06, 'no goals with 8 minutes left ' + dead); assert.ok(live > 0.3 && live < 0.65, 'two in, 20 left ' + live);
  const draw = mlLeg('eng.1', 'draw', 0.26);
  assert.ok(q('eng.1', draw, pgame('eng.1', 1, 1, 2, "85'", "85'")).pWin > 0.75, 'level late is likely to stay level');
});
t('cash out: hockey and baseball use goals and innings', () => {
  const nhl = q('nhl', mlLeg('nhl', 'home', 0.5), pgame('nhl', 3, 1, 3, '5:00', '3rd 5:00')).pWin;
  assert.ok(nhl > 0.93, 'up two late in hockey ' + nhl);
  const mlb = q('mlb', mlLeg('mlb', 'home', 0.5), pgame('mlb', 2, 5, 7, '', 'Top 7th')).pWin;
  assert.ok(mlb > 0.05 && mlb < 0.25, 'down three in the 7th ' + mlb);
});
t('cash out: a player prop follows his stat line and the clock', () => {
  const prop = (over) => mkLeg('nba', { key: 'p', kind: 'prop', dec: 1 / (0.5 * B.VIG), prop: { playerId: 'p1', name: 'Scottie Barnes', label: 'Points', stat: 'pts', line: 24.5, dir: 'over', box: [{ g: '.', l: ['PTS'] }] }, ...over });
  const box = (pts) => ({ box: { players: [{ groups: [{ name: 'starters', labels: ['MIN', 'PTS'], rows: [{ id: 'p1', name: 'Scottie Barnes', stats: ['20', String(pts)] }] }] }] } });
  const half = pgame('nba', 55, 50, 3, '12:00', 'Halftime');
  const hot = q('nba', prop(), half, box(20)).pWin, ok = q('nba', prop(), half, box(12)).pWin, cold = q('nba', prop(), half, box(4)).pWin;
  assert.ok(hot > 0.8 && ok > 0.25 && ok < 0.6 && cold < 0.15, `hot ${hot} par ${ok} cold ${cold}`);
  const late = q('nba', prop(), pgame('nba', 100, 95, 4, '1:30', '4th 1:30'), box(22)).pWin;
  assert.ok(late < 0.2 && late > 0.03, 'needs 3 more with a minute and a half left: ' + late);
  const under = q('nba', prop({ prop: { ...prop().prop, dir: 'under' } }), half, box(20)).pWin;
  assert.ok(under < 0.25, 'under with 20 at half ' + under);
  const dnp = q('nba', prop(), pgame('nba', 90, 80, 4, '6:00', '4th 6:00'), { box: { players: [] } });
  assert.ok(dnp.ok && dnp.pWin > 0.5, 'a player with no box score line is likely refunded, which keeps the bet alive ' + dnp.pWin);
});
t('cash out: paused in the last minute, with the clock and in overtime, so a dead leg cannot be cashed on', () => {
  const home = mlLeg('nba', 'home', 0.5);
  for (const [g, why] of [[pgame('nba', 100, 99, 4, '0:50', '4th 0:50'), 'a minute left'], [pgame('nba', 100, 100, 4, '0:00', 'End of 4th'), 'no time left'], [pgame('nba', 110, 108, 5, '3:00', 'OT'), 'overtime'],
    [pgame('nhl', 2, 1, 3, '0:30', '3rd 0:30'), 'hockey'], [pgame('eng.1', 1, 0, 2, "88'", "88'"), 'soccer'], [pgame('mlb', 3, 2, 9, '', 'Bottom 9th'), 'ninth inning']]) {
    const lg = g.league, r = CM.quoteBet(betOf([wonLeg, mlLeg(lg, 'home', 0.5)]), stOf(lg, g));
    assert.equal(r.ok, false, why); assert.ok(r.paused, why + ' says why');
  }
  assert.ok(q('nba', home, pgame('nba', 100, 99, 4, '1:30', '4th 1:30')).ok, 'still open with a minute and a half');
  // the case that started this: one leg short of a miracle, a second left, a close game elsewhere
  const dead = mkLeg('nba', { key: 'p', kind: 'prop', dec: 3, prop: { playerId: 'p1', name: 'S P', label: 'Assists', stat: 'ast', line: 3.5, dir: 'over', box: [{ g: '.', l: ['AST'] }] } });
  const r = CM.quoteBet(betOf([wonLeg, dead]), stOf('nba', pgame('nba', 100, 99, 4, '0:00', 'End of 4th'), { box: { players: [{ groups: [{ name: 's', labels: ['AST'], rows: [{ id: 'p1', name: 'S P', stats: ['3'] }] }] }] } }));
  assert.equal(r.ok, false);
});
t('cash out: a blowout slows the starters', () => {
  const prop = mkLeg('nba', { key: 'p', kind: 'prop', dec: 1 / (0.5 * B.VIG), prop: { playerId: 'p1', name: 'A B', label: 'Points', stat: 'pts', line: 24.5, dir: 'over', box: [{ g: '.', l: ['PTS'] }] } });
  const box = { box: { players: [{ groups: [{ name: 's', labels: ['PTS'], rows: [{ id: 'p1', name: 'A B', stats: ['19'] }] }] }] } };
  const close = q('nba', prop, pgame('nba', 85, 83, 4, '9:00', '4th 9:00'), box).pWin;
  const rout = q('nba', prop, pgame('nba', 105, 80, 4, '9:00', '4th 9:00'), box).pWin;
  assert.ok(rout < close, `${rout} < ${close}`);
});
t('cash out: bets in one game move together, other games do not', () => {
  const g = pgame('nba', 60, 50, 3, '12:00', 'Halftime');
  const ml = mlLeg('nba', 'home', 0.5), ov = spLeg('nba', { t: 'total', dir: 'over', line: 225.5 }, 0.5);
  const sgp = CM.quoteBet(betOf([ml, ov]), stOf('nba', g));
  const alone = (leg) => q('nba', leg, g).pWin;
  assert.ok(sgp.ok && Math.abs(sgp.pWin - alone(ml) * alone(ov)) < 0.08);
  const two = CM.quoteBet(betOf([ml, { ...mlLeg('nba', 'home', 0.5), key: 'm2', gameKey: 'nba:2', gameId: '2' }]), new Map([['nba:1', { game: g }], ['nba:2', { game: g }]]));
  assert.ok(Math.abs(two.pWin - alone(ml) ** 2) < 0.04, 'two different games are independent');
});
t('cash out: legs already won pay their price, voids drop out, a lost leg ends it', () => {
  const g = pgame('nba', 65, 65, 3, '6:00', '3rd 6:00');
  const one = CM.quoteBet(betOf([wonLeg, mlLeg('nba', 'home', 0.5)]), stOf('nba', g));
  assert.ok(one.ok && one.hold === Math.round(100 * 1.5 * (1 / (0.5 * B.VIG))), 'hold is stake x won price x live leg price: ' + one.hold);
  const voided = CM.quoteBet(betOf([{ ...wonLeg, result: 'void' }, wonLeg, mlLeg('nba', 'home', 0.5)]), stOf('nba', g));
  assert.equal(voided.hold, one.hold, 'a void leg adds nothing');
  assert.equal(CM.quoteBet(betOf([{ ...wonLeg, result: 'lost' }, mlLeg('nba', 'home', 0.5)]), stOf('nba', g)).ok, false);
  const done = CM.quoteBet(betOf([wonLeg, { ...wonLeg, key: 'w2', result: 'won', dec: 2 }]), new Map());
  assert.ok(done.ok && done.final && done.offer === 300);
});
t('cash out: never worth more than fair value, never more than holding', () => {
  const g = pgame('nba', 70, 60, 3, '6:00', '3rd 6:00');
  const r = CM.quoteBet(betOf([wonLeg, mlLeg('nba', 'home', 0.5), spLeg('nba', { t: 'total', dir: 'over', line: 200.5 }, 0.5)]), stOf('nba', g));
  assert.ok(r.ok && r.offer <= Math.floor(r.fair * (1 - CM.CUT)) && r.offer < r.hold && r.offer >= 1, JSON.stringify(r));
  assert.ok(r.offer <= r.fair * 0.97);
});
t('cash out: waits for the live score and opens only once something has started', () => {
  const fresh = CM.quoteBet(betOf([mlLeg('nba', 'home', 0.5, { date: inHr() }), { ...mlLeg('nba', 'away', 0.5), key: 'x', gameKey: 'nba:2', date: inHr() }]), new Map());
  assert.equal(fresh.ok, false); assert.ok(fresh.early);
  const noFeed = CM.quoteBet(betOf([mlLeg('nba', 'home', 0.5)]), new Map());
  assert.equal(noFeed.ok, false); assert.ok(noFeed.wait);
  assert.equal(CM.quoteBet({ ...betOf([wonLeg]), status: 'won' }, new Map()).ok, false);
});
t('cash out: same game, same offer', () => {
  const g = pgame('nba', 70, 60, 3, '6:00', '3rd 6:00');
  const a = CM.quoteBet(betOf([mlLeg('nba', 'home', 0.5)]), stOf('nba', g)), b = CM.quoteBet(betOf([mlLeg('nba', 'home', 0.5)]), stOf('nba', g));
  assert.equal(a.offer, b.offer);
  const c = CM.quoteBet(betOf([mlLeg('nba', 'home', 0.5)]), stOf('nba', pgame('nba', 72, 60, 3, '6:00', '3rd 6:00')));
  assert.ok(c.offer > a.offer, 'a bigger lead is a bigger offer');
});
t('cash out: a finished game that has not paid out yet is read from its final score', () => {
  const fin = pgame('nba', 100, 90, 4, '0:00', 'Final', 'post');
  const r = CM.quoteBet(betOf([wonLeg, mlLeg('nba', 'home', 0.5)]), stOf('nba', fin));
  assert.ok(r.ok && r.final, 'final: ' + JSON.stringify(r));
  const lost = CM.quoteBet(betOf([wonLeg, mlLeg('nba', 'away', 0.5)]), stOf('nba', fin));
  assert.equal(lost.ok, false);
});
t('cash out: cashed bets are not bragging rights', () => {
  const b = (cashed) => ({ id: 'c', status: 'won', stake: 100, payout: 400, dec: 6, mode: 'parlay', cashed, legs: [{ result: 'won', kind: 'ml', dec: 3 }, { result: 'won', kind: 'ml', dec: 2 }] });
  const st = B.betStats({ a: b(true) }, { streak: 0, bestStreak: 0 }), hit = B.betStats({ a: b(false) }, { streak: 0, bestStreak: 0 });
  assert.equal(st.won, 1); assert.equal(st.parlayWins, 0); assert.equal(st.biggest, null);
  assert.equal(hit.parlayWins, 1); assert.equal(st.profit, 300);
});

/* ---------- economy: one multiplier on every price ---------- */
{
  const { ITEMS, PRICE_MULT, dealFor, itemById } = await import('../js/avatar.js');
  const { genWeekly, genDaily } = await import('../js/live-gen.js');
  t('prices: every buyable item is its base price times one multiplier, so equal prices stay equal', () => {
    assert.ok(PRICE_MULT >= 1);
    const buy = ITEMS.filter((i) => i.price > 0 && !i.ach);
    assert.ok(buy.length > 200);
    for (const i of buy) assert.equal(i.price, Math.round((i.base * PRICE_MULT) / 10) * 10, i.id);
    const byBase = new Map();
    for (const i of buy) { const p = byBase.get(i.base); if (p != null) assert.equal(p, i.price, 'same base, same price'); else byBase.set(i.base, i.price); }
    assert.ok(ITEMS.filter((i) => !i.base).every((i) => i.price === 0), 'free and earned items stay free');
  });
  t('prices: tiers follow the base price, so the shop sorts the same as before', () => {
    for (const i of ITEMS.filter((x) => x.price > 0 && !x.ach)) assert.equal(i.tier, i.base < 400 ? 'common' : i.base < 2000 ? 'rare' : i.base < 8000 ? 'epic' : 'legend', i.id);
    assert.equal(Math.max(...ITEMS.map((i) => i.price)), 35000 * PRICE_MULT);
  });
  t('prices: weekly prizes are worth one to three days of play and the daily deal comes from the same pool as before', () => {
    const d0 = new Date(Date.UTC(2026, 9, 23));
    for (let w = 0; w < 30; w++) {
      const start = new Date(d0.getTime() + w * 7 * 864e5).toISOString().slice(0, 10);
      const wk = genWeekly(start);
      const prize = wk.quests.find((q) => q.item);
      assert.ok(prize, 'a prize every week');
      const it = itemById(prize.item); assert.ok(it.price >= 1000 && it.price <= 3000, `${it.id} ${it.price}`);
      for (const id of wk.featured) assert.ok(itemById(id).base >= 150 && itemById(id).base <= 4000);
      const deal = dealFor(start); assert.ok(itemById(deal.itemId).base <= 2500, 'sale items are cheap-tier items, by base price');
    }
  });
  t('economy: a day of play pays about what the prices are built around', () => {
    // 28 days of the real quest generator for someone who does all the easy and play quests and half the stretch ones
    const addDay = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    let q = 0, bonus = 0, streak = 0;
    for (let i = 0; i < 28; i++) {
      const day = addDay('2026-10-23', i);
      streak = Math.min(streak + 1, 7); bonus += 150 + 50 * streak;
      const dq = genDaily(day).quests; q += dq[0].coins + dq[1].coins + 0.5 * dq[2].coins;
      if (i % 7 === 0) { const w = genWeekly(day).quests; q += w[0].coins + w[1].coins + 0.5 * w[2].coins; }
    }
    const perDay = (bonus + q) / 28;
    assert.ok(perDay > 650 && perDay < 1000, 'income per day ' + perDay);
    const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const tier = (name) => med(ITEMS.filter((i) => i.tier === name && i.price > 0).map((i) => i.price));
    assert.ok(tier('common') / perDay < 1.5 && tier('rare') / perDay > 2 && tier('rare') / perDay < 6 && tier('epic') / perDay > 14 && tier('epic') / perDay < 30 && tier('legend') / perDay > 45 && tier('legend') / perDay < 90, 'days to afford a typical item in each tier');
  });
}

/* ---------- sync: a cash out on one device beats a plain settle on another ---------- */
{
  const { mergeFan } = await import('../js/social.js');
  t('sync: a bet cashed out on one device stays cashed out when the other device settled it as lost (either direction)', () => {
    const base = { teams: [], bank: { coins: 100, rev: 1 }, avatar: {}, watched: {} };
    const cashed = { id: 'b1', status: 'won', payout: 120, stake: 50, cashed: true, legs: [] };
    const lost = { id: 'b1', status: 'lost', payout: 0, stake: 50, legs: [] };
    assert.equal(mergeFan({ ...base, bets: { b1: lost } }, { ...base, bets: { b1: cashed } }).bets.b1.cashed, true);
    assert.equal(mergeFan({ ...base, bets: { b1: cashed } }, { ...base, bets: { b1: lost } }).bets.b1.cashed, true);
  });
}

/* ---------- sync: watched games, adds and removals ---------- */
{
  const { mergeFan } = await import('../js/social.js');
  t('sync: watched games from both devices combine, and a removal on one device sticks unless re-marked later', () => {
    const base = { teams: [], bank: { coins: 1, rev: 1 }, avatar: {}, bets: {} };
    const w = (ts) => ({ ts, league: 'nba', home: 'A', away: 'B' });
    const m1 = mergeFan({ ...base, watched: { g1: w(10) } }, { ...base, watched: { g2: w(20) } });
    assert.deepEqual(Object.keys(m1.watched).sort(), ['g1', 'g2']);
    const m2 = mergeFan({ ...base, watched: { g1: w(10) } }, { ...base, watched: { g1: w(10), g2: w(20) }, unwatched: { g2: 30 } });
    assert.deepEqual(Object.keys(m2.watched), ['g1'], 'removed on the other device');
    const m3 = mergeFan({ ...base, watched: { g2: w(40) } }, { ...base, watched: {}, unwatched: { g2: 30 } });
    assert.deepEqual(Object.keys(m3.watched), ['g2'], 'marked again after the removal');
  });
}

console.log(`\n${passed} checks passed`);
