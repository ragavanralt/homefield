import assert from 'node:assert/strict';
import * as U from '../js/util.js';
import * as W from '../js/winprob.js';
import { normEvent, normSummary, normStandings, parseOdds } from '../js/espn.js';
import { buildRecap, playerOfTheGame } from '../js/recap.js';
import * as B from '../js/bets.js';
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
  const p = B.leaderProps('nba', [{ teamId: '28', cats: [{ name: 'Points Per Game', value: '27.8', who: 'S Barnes', id: '5', face: '' }] }], '28', '3-1');
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
    assert.ok(again.swapped && st.getBank().coins === c1 + 400 + 250); // already owned: extra coins instead
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

// ---- lineups on the field ----
{
  const LY = await import('../js/lineup-layout.js');
  const ath = (id, name, extra = {}) => ({ athlete: { id: String(id), displayName: name, shortName: name.replace(/^(\S)\S*\s/, '$1. ') }, ...extra });
  // a 4-2-3-1 the way ESPN's soccer summary lists it: formationPlace, detailed positions, stats and plays on each entry
  const xi = [['G', 'Keeper Kay', 1], ['RB', 'Right Back', 2], ['CD-R', 'Centre Right', 5], ['CD-L', 'Centre Left', 6], ['LB', 'Left Back', 3], ['DM-R', 'Holder Right', 4], ['DM-L', 'Holder Left', 8],
    ['AM-R', 'Wide Right', 7], ['AM', 'Ten Ten', 10], ['AM-L', 'Wide Left', 11], ['F', 'Nine Nine', 9]];
  const j = F.summary('uefa.champions', 900, { state: 'in', hs: 2, as: 1, detail: "67'", clock: "67'", period: 2 });
  j.rosters = [
    { homeAway: 'home', team: j.header.competitions[0].competitors.find((c) => c.homeAway === 'home').team, formation: '4-2-3-1', roster: [
      ...xi.map(([pos, name, place], i) => ath(100 + i, name, { starter: true, jersey: String(place), formationPlace: String(place), position: { abbreviation: pos },
        stats: name === 'Nine Nine' ? [{ name: 'totalGoals', abbreviation: 'G', value: 2 }] : name === 'Holder Left' ? [{ name: 'yellowCards', abbreviation: 'YC', value: 1 }] : [],
        plays: name === 'Ten Ten' ? [{ didAssist: true, clock: { displayValue: "23'" } }] : name === 'Wide Left' ? [{ substitution: true, clock: { displayValue: "61'" } }] : [],
        subbedOut: name === 'Wide Left' })),
      ath(150, 'Super Sub', { starter: false, subbedIn: true, jersey: '19', position: { abbreviation: 'F' }, plays: [{ substitution: true, clock: { displayValue: "61'" } }], subbedInFor: { athlete: { displayName: 'Wide Left' } } }),
      ath(151, 'Unused Keeper', { starter: false, jersey: '13', position: { abbreviation: 'G' } }),
    ] },
  ];
  const L = normSummary(j, 'uefa.champions', 900).lineups;
  const home = L.teams[0];
  t('soccer roster entries keep formation place, goals, assists, cards and subs', () => {
    const by = (n) => [...home.starters, ...home.bench].find((p) => p.name === n);
    assert.equal(by('Nine Nine').events.goals, 2);
    assert.equal(by('Ten Ten').events.assists, 1);
    assert.equal(by('Holder Left').events.yellow, 1);
    assert.ok(by('Wide Left').subbedOut); assert.equal(by('Wide Left').subMinute, "61'");
    assert.equal(by('Super Sub').subFor, 'Wide Left'); assert.equal(by('Keeper Kay').place, '1');
  });
  t('soccer: 4-2-3-1 lands in four lines, left to right, keeper deepest', () => {
    const sh = LY.soccerShape(home.starters, home.formation);
    assert.deepEqual(sh.lines.map((l) => l.length), [4, 2, 3, 1]);
    assert.deepEqual(sh.lines[0].map((p) => p.name), ['Left Back', 'Centre Left', 'Centre Right', 'Right Back']);
    assert.deepEqual(sh.lines[2].map((p) => p.name), ['Wide Left', 'Ten Ten', 'Wide Right']);
    assert.equal(sh.keeper.name, 'Keeper Kay');
    const bottom = LY.pitchSpots(sh, 'bottom'), top = LY.pitchSpots(sh, 'top');
    const at = (sp, n) => sp.find((x) => x.p.name === n);
    assert.ok(at(bottom, 'Keeper Kay').y > 90 && at(bottom, 'Nine Nine').y > 50, 'home stays in its own half');
    assert.ok(at(top, 'Keeper Kay').y < 10 && at(top, 'Nine Nine').y < 50, 'away stays in its own half');
    assert.ok(at(bottom, 'Left Back').x < 50 && at(top, 'Left Back').x > 50, 'away is mirrored because it attacks down');
  });
  t('soccer: a formation that does not add up falls back to back, middle and front', () => {
    const sh = LY.soccerShape(home.starters, '4-4-4');
    assert.equal(sh.formation, '4-5-1');
    assert.deepEqual(LY.parseFormation('3-5-2'), [3, 5, 2]); assert.equal(LY.parseFormation(''), null);
  });
  t('soccer: goals and cards are also counted from the play feed', () => {
    const tl = LY.tallyFromPlays([{ scoring: true, participants: ['A Striker', 'A Maker'], text: 'Goal!' }, { scoring: true, participants: ['A Striker'], text: 'Own Goal by X' }, { red: true, participants: ['Hot Head'] }]);
    assert.deepEqual(LY.eventsFor({ name: 'A Striker', events: { goals: 0 } }, tl), { goals: 1, assists: 0, yellow: 0, red: 0 });
    assert.equal(LY.eventsFor({ name: 'A Maker' }, tl).assists, 1);
    assert.equal(LY.eventsFor({ name: 'Hot Head', events: { red: 1 } }, tl).red, 1, 'roster and feed are not added together');
  });
  t('mlb: fielders on the diamond, pitcher on the mound, batting order from batOrder, DH off the field', () => {
    const P = (name, pos, batOrder, group = 'batting') => ({ name, pos, batOrder, group });
    const ps = [P('Lead Off', 'CF', 1), P('Two Hole', 'SS', 2), P('Big Bat', 'DH', 3), P('Clean Up', '1B', 4), P('Five', 'RF', 5), P('Six', '3B', 6), P('Seven', 'LF', 7), P('Eight', '2B', 8), P('Nine', 'C', 9), P('Ace', 'SP', null, 'pitching')];
    const d = LY.diamond(ps);
    assert.equal(d.spots.length, 9);
    const at = (k) => d.spots.find((s) => s.pos === k);
    assert.equal(at('P').p.name, 'Ace'); assert.equal(at('C').p.name, 'Nine');
    assert.ok(at('CF').y < at('2B').y && at('2B').y < at('P').y && at('P').y < at('C').y, 'outfield deep, catcher behind the plate');
    assert.deepEqual(d.order.map((p) => p.name), ['Lead Off', 'Two Hole', 'Big Bat', 'Clean Up', 'Five', 'Six', 'Seven', 'Eight', 'Nine']);
    assert.ok(!d.spots.some((s) => s.p.name === 'Big Bat'));
    assert.equal(LY.diamond(ps, { name: 'Probable Guy' }).spots.find((s) => s.pos === 'P').p.name, 'Probable Guy');
  });
  t('mlb: box score starters keep batting order and a two-way player is listed once', () => {
    const jj = F.summary('mlb', 901);
    const bat = jj.boxscore.players[0].statistics[0], pit = jj.boxscore.players[0].statistics[1];
    bat.athletes = [{ athlete: { id: '7', displayName: 'Two Way', position: { abbreviation: 'DH' } }, starter: true, batOrder: 1, stats: [] }, { athlete: { id: '8', displayName: 'Catcher', position: { abbreviation: 'C' } }, starter: true, batOrder: 2, stats: [] }];
    pit.athletes = [{ athlete: { id: '7', displayName: 'Two Way', position: { abbreviation: 'SP' } }, starter: true, stats: [] }];
    const tm = normSummary(jj, 'mlb', 901).lineups.teams[0];
    assert.equal(tm.starters.length, 2); assert.equal(tm.starters[0].batOrder, 1);
  });
  t('nba: starting five fill the court by position, guards out top, bigs near the rim', () => {
    const sp = LY.court([{ name: 'Big', pos: 'C' }, { name: 'G1', pos: 'G' }, { name: 'F1', pos: 'F' }, { name: 'G2', pos: 'G' }, { name: 'F2', pos: 'F' }, { name: 'Sixth', pos: 'G' }]);
    assert.equal(sp.length, 5);
    assert.equal(sp.find((s) => s.pos === 'C').p.name, 'Big');
    assert.deepEqual(sp.filter((s) => s.pos === 'PG' || s.pos === 'SG').map((s) => s.p.name), ['G1', 'G2']);
    assert.ok(!sp.some((s) => s.p.name === 'Sixth'));
  });
  t('nfl: depth chart spots become an offense and a defense formation', () => {
    const off = LY.gridiron(['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'K'].map((pos, i) => ({ name: pos + i, pos })), 'Offense');
    assert.equal(off.spots.length, 11); assert.deepEqual(off.extra.map((p) => p.pos), ['K']);
    const at = (g, k) => g.spots.find((s) => s.pos === k);
    assert.ok(at(off, 'QB').y > at(off, 'C').y && at(off, 'RB').y > at(off, 'QB').y, 'backs behind the line');
    assert.ok(at(off, 'LT').x < at(off, 'C').x && at(off, 'C').x < at(off, 'RT').x);
    const def = LY.gridiron(['LDE', 'NT', 'RDE', 'LOLB', 'LILB', 'RILB', 'ROLB', 'LCB', 'RCB', 'SS', 'FS'].map((pos) => ({ name: pos, pos })), 'Defense');
    assert.equal(def.spots.length, 11); assert.equal(def.extra.length, 0);
    assert.ok(at(def, 'FS').y < at(def, 'LILB').y && at(def, 'LILB').y < at(def, 'NT').y, 'safeties deep, line at the ball');
  });
  t('nhl: dressed players split into forwards, defense and goalies', () => {
    const g = LY.dressed([{ id: '1', name: 'C1', pos: 'C' }, { id: '2', name: 'W1', pos: 'LW' }, { id: '3', name: 'D1', pos: 'D' }, { id: '4', name: 'G1', pos: 'G' }, { id: '1', name: 'C1', pos: 'C' }]);
    assert.deepEqual(g.map((x) => [x.name, x.players.length]), [['Forwards', 2], ['Defense', 1], ['Goalies', 1]]);
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

console.log(`\n${passed} checks passed`);
