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
  const { ITEMS, buy, equip, unequip, priceOf, dealToday, avatarSvg, syncUnlocks, itemById } = await import('../js/avatar.js');
  const st = await import('../js/store.js');
  st.resetAll();
  t('shop: starter items owned, hair and top equipped', () => {
    const a = st.getState().avatar;
    assert.equal(a.eq.hair, 'short'); assert.equal(a.eq.top, 'tee');
    assert.ok(a.owned.includes('curly'));
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
  t('shop: daily deal is 20% off and stable within a day', () => {
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
    assert.ok(avatarSvg({ skin: 2, hairColor: 0, eq: { top: 'jersey' } }, team).includes('#FF0000'));
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

console.log(`\n${passed} checks passed`);
