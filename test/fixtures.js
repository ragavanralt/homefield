// Fake ESPN-shaped responses used only by the tests. Shapes follow the real feed.
const team = (id, abbr, name, color, alt) => ({
  id: String(id), abbreviation: abbr, displayName: name, shortDisplayName: name.split(' ').pop(),
  color, alternateColor: alt, logo: `https://a.espncdn.com/i/teamlogos/x/${id}.png`,
});

export const TEAMS = {
  nhl: [team(20, 'TB', 'Tampa Bay Lightning', '003e7e', 'ffffff'), team(15, 'PHI', 'Philadelphia Flyers', 'fe5823', '000000')],
  nba: [team(28, 'TOR', 'Toronto Raptors', 'ce1141', '000000'), team(18, 'NYK', 'New York Knicks', '1d428a', 'f58426')],
  nfl: [team(7, 'DEN', 'Denver Broncos', 'fb4f14', '0a2343'), team(26, 'SEA', 'Seattle Seahawks', '002a5c', '69be28')],
  mlb: [team(5, 'CLE', 'Cleveland Guardians', '002b5c', 'e31937'), team(30, 'TB', 'Tampa Bay Rays', '092c5c', '8fbce6')],
  soccer: [team(86, 'RMA', 'Real Madrid', 'ffffff', 'febe10'), team(83, 'BAR', 'Barcelona', 'a50044', '004d98')],
};

const SPORT_PATH = { nhl: 'hockey/nhl', nba: 'basketball/nba', nfl: 'football/nfl', mlb: 'baseball/mlb', 'uefa.champions': 'soccer/uefa.champions', 'eng.1': 'soccer/eng.1', 'esp.1': 'soccer/esp.1', 'ger.1': 'soccer/ger.1', 'ita.1': 'soccer/ita.1', 'fra.1': 'soccer/fra.1', 'uefa.europa': 'soccer/uefa.europa', 'usa.1': 'soccer/usa.1' };
export const sportPath = (lg) => SPORT_PATH[lg];

function teamsFor(lg) { return TEAMS[lg.includes('.') ? 'soccer' : lg]; }

export function event(lg, id, { state = 'in', hs = 2, as = 1, detail = '2nd Period', clock = '8:42', period = 2, date = '2026-10-17T23:00Z' } = {}) {
  const [home, away] = teamsFor(lg);
  return {
    id: String(id), date, name: `${away.displayName} at ${home.displayName}`, shortName: `${away.abbreviation} @ ${home.abbreviation}`,
    season: { year: 2026, type: 2 },
    competitions: [{
      id: String(id), neutralSite: false,
      venue: { fullName: 'Test Arena', address: { city: 'Toronto', state: 'ON' } },
      status: { displayClock: clock, period, type: { state, completed: state === 'post', detail: state === 'pre' ? 'Sat, October 17th at 7:00 PM EDT' : detail, shortDetail: detail, name: 'STATUS_X', description: detail } },
      competitors: [
        { homeAway: 'home', score: String(hs), team: home, records: [{ type: 'total', summary: lg === 'nhl' ? '3-1-0' : lg.includes('.') ? '5-2-1' : '3-1' }], probables: lg === 'mlb' ? [{ athlete: { id: '99', displayName: 'Test Pitcher' } }] : undefined },
        { homeAway: 'away', score: String(as), team: away, records: [{ type: 'total', summary: lg === 'nhl' ? '1-2-1' : lg.includes('.') ? '2-3-3' : '1-3' }] },
      ],
      odds: [{ details: 'Home -150', homeTeamOdds: { moneyLine: -150 }, awayTeamOdds: { moneyLine: 130 }, drawOdds: lg.includes('.') ? { moneyLine: 250 } : undefined }],
      broadcasts: [{ names: ['TSN'] }],
      notes: [],
    }],
  };
}

export function scoreboard(lg, events) { return { leagues: [], season: { type: 2 }, day: { date: '2026-10-17' }, events }; }

export function teamsList(lg) {
  return { sports: [{ leagues: [{ teams: teamsFor(lg).map((t) => ({ team: { ...t, logos: [{ href: t.logo }] } })) }] }] };
}

export function schedule(lg, teamId) {
  const t = teamsFor(lg).find((x) => x.id === String(teamId)) || teamsFor(lg)[0];
  const evs = [
    event(lg, 9001, { state: 'post', hs: 3, as: 2, detail: 'Final', date: '2026-10-10T23:00Z' }),
    event(lg, 9002, { state: 'pre', hs: 0, as: 0, date: '2026-10-24T23:00Z' }),
    event(lg, 9003, { state: 'pre', hs: 0, as: 0, date: '2026-10-28T23:00Z' }),
  ];
  return { team: { ...t, recordSummary: '3-1', standingSummary: '2nd in Atlantic', logo: t.logo }, events: evs };
}

export function standings(lg) {
  const [a, b] = teamsFor(lg);
  const stat = (name, v) => ({ name, abbreviation: name.slice(0, 2).toUpperCase(), displayValue: String(v), value: v });
  return { children: [{ name: 'Eastern', standings: { entries: [
    { team: { ...a, logos: [{ href: a.logo }] }, stats: [stat('wins', 4), stat('losses', 1), stat('points', 9)] },
    { team: { ...b, logos: [{ href: b.logo }] }, stats: [stat('wins', 2), stat('losses', 3), stat('points', 5)] },
  ] } }] };
}

/* ----- summaries ----- */
function ath(id, name, jersey, pos) { return { id: String(id), displayName: name, shortName: name.split(' ').map((w, i) => (i ? w : w[0] + '.')).join(' '), jersey: String(jersey), position: { abbreviation: pos }, headshot: { href: `https://a.espncdn.com/i/headshots/x/${id}.png` } }; }

function header(lg, id, o) {
  const ev = event(lg, id, o);
  return { id: String(id), season: ev.season, competitions: [{ ...ev.competitions[0], date: ev.date, details: lg.includes('.') ? [{ type: { text: 'Goal' }, clock: { displayValue: "49'" }, team: { id: '86' }, scoringPlay: true, athletesInvolved: [{ displayName: 'Test Striker' }] }] : undefined }] };
}

function genPlays(lg, n) {
  const [home, away] = teamsFor(lg);
  const plays = [];
  let h = 0, a = 0;
  for (let i = 0; i < n; i++) {
    const homeScores = i % 3 === 0, awayScores = i % 5 === 0;
    if (homeScores) h += lg === 'nba' ? 2 : 1;
    if (awayScores && !homeScores) a += lg === 'nba' ? 3 : 1;
    const per = Math.min(lg === 'nhl' ? 3 : 4, 1 + Math.floor((i * (lg === 'nhl' ? 3 : 4)) / n));
    plays.push({
      id: `p${i}`, sequenceNumber: String(i + 1), text: `Play ${i + 1}: ${homeScores ? 'Home scores' : awayScores ? 'Away scores' : 'Shot missed'}`,
      type: { text: 'Shot' }, period: { number: per, displayValue: `${per}${['st', 'nd', 'rd', 'th'][per - 1]} ${lg === 'nhl' ? 'Period' : 'Quarter'}` },
      clock: { displayValue: `${11 - (i % 11)}:${i % 2 ? '30' : '05'}` }, homeScore: h, awayScore: a,
      scoringPlay: homeScores || awayScores, team: { id: homeScores ? home.id : away.id },
      participants: [{ athlete: { displayName: 'Test Player' } }],
    });
  }
  return plays;
}

export function summary(lg, id, o = { state: 'post', hs: 112, as: 104, detail: 'Final', clock: '0:00', period: 4 }) {
  const grp = lg.includes('.') ? 'soccer' : lg;
  const [home, away] = teamsFor(lg);
  const j = {
    header: header(lg, id, o),
    gameInfo: { venue: { fullName: 'Test Arena', address: { city: 'Toronto', state: 'ON' } }, attendance: 18000 },
    boxscore: { teams: [
      { team: home, homeAway: 'home', statistics: [{ name: 'fg', label: 'Field Goals', displayValue: '40-80' }] },
      { team: away, homeAway: 'away', statistics: [{ name: 'fg', label: 'Field Goals', displayValue: '38-85' }] },
    ], players: [] },
    leaders: [{ team: home, leaders: [{ name: 'points', displayName: 'Points', leaders: [{ displayValue: '38', athlete: ath(1, 'Test Star', 4, 'G') }] }] }],
    seasonseries: [{ title: 'Regular Season Series', summary: 'Series tied 1-1', seriesScore: '1-1' }],
    lastFiveGames: [{ team: home, events: [{ gameResult: 'W', score: '110-100', opponent: { displayName: 'Opp' }, atVs: 'vs' }] }],
  };
  if (grp === 'nba') {
    const plays = genPlays('nba', 40);
    j.plays = plays;
    j.winprobability = plays.map((p, i) => ({ playId: p.id, homeWinPercentage: Math.min(0.99, 0.4 + i * 0.015) }));
    const labels = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK'];
    j.boxscore.players = [
      { team: home, statistics: [{ labels, athletes: [
        { athlete: ath(1, 'Test Star', 4, 'G'), starter: true, stats: ['34', '38', '14-21', '7-12', '3-4', '5', '4', '2', '1', '0'] },
        { athlete: ath(2, 'Second Option', 9, 'F'), starter: true, stats: ['30', '17', '6-12', '1-4', '4-4', '8', '2', '1', '0', '1'] },
        { athlete: ath(3, 'Bench Guy', 12, 'C'), starter: false, didNotPlay: true, stats: [] },
      ] }] },
      { team: away, statistics: [{ labels, athletes: [{ athlete: ath(5, 'Opp One', 3, 'G'), starter: true, stats: ['36', '25', '9-20', '2-8', '5-6', '4', '6', '3', '0', '0'] }] }] },
    ];
  }
  if (grp === 'nhl') {
    const plays = genPlays('nhl', 30);
    j.plays = plays;
    j.boxscore.players = [
      { team: home, statistics: [
        { name: 'forwards', labels: ['G', 'A', '+/-', 'S', 'SM', 'BS', 'PN', 'PIM', 'HT', 'TK', 'GV', 'TOI'], athletes: [
          { athlete: ath(10, 'Hat Trick Guy', 34, 'C'), starter: true, stats: ['3', '1', '+3', '6', '1', '0', '0', '0', '2', '1', '0', '19:02'] },
          { athlete: ath(11, 'Winger Two', 16, 'W'), starter: true, stats: ['0', '1', '+1', '2', '0', '0', '0', '0', '1', '0', '1', '16:40'] },
        ] },
        { name: 'goalies', labels: ['SA', 'GA', 'SV', 'SV%', 'TOI'], athletes: [{ athlete: ath(12, 'Net Minder', 88, 'G'), starter: true, stats: ['28', '2', '26', '.929', '60:00'] }] },
      ] },
      { team: away, statistics: [{ name: 'forwards', labels: ['G', 'A', '+/-', 'S', 'SM', 'BS', 'PN', 'PIM', 'HT', 'TK', 'GV', 'TOI'], athletes: [{ athlete: ath(13, 'Opp Forward', 9, 'C'), starter: true, stats: ['1', '0', '-1', '3', '0', '0', '0', '0', '0', '0', '0', '17:00'] }] }] },
    ];
  }
  if (grp === 'mlb') {
    j.plays = genPlays('mlb', 60).map((p) => ({ ...p, period: { number: 1 + Math.floor(p.sequenceNumber / 7), displayValue: (p.sequenceNumber % 2 ? 'Top ' : 'Bottom ') + '3rd' } }));
    j.boxscore.players = [
      { team: home, statistics: [
        { type: 'batting', labels: ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG'], athletes: [{ athlete: ath(20, 'Slugger Sam', 12, 'DH'), starter: true, stats: ['3-4', '4', '2', '3', '3', '1', '0', '0', '15', '.300', '.400', '.500'] }] },
        { type: 'pitching', labels: ['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST', 'ERA', 'PC'], athletes: [{ athlete: ath(21, 'Ace Arm', 45, 'SP'), starter: true, stats: ['7.0', '4', '1', '1', '1', '9', '0', '99-66', '2.10', '99'] }] },
      ] },
      { team: away, statistics: [{ type: 'batting', labels: ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K'], athletes: [{ athlete: ath(22, 'Opp Bat', 7, 'SS'), starter: true, stats: ['1-4', '4', '0', '1', '0', '0', '0', '2'] }] }] },
    ];
    j.winprobability = j.plays.map((p, i) => ({ playId: p.id, homeWinPercentage: 0.5 + Math.sin(i / 5) * 0.3 }));
  }
  if (grp === 'nfl') {
    const plays = genPlays('nfl', 24);
    j.drives = { previous: [{ plays: plays.slice(0, 12) }, { plays: plays.slice(12) }] };
    j.boxscore.players = [
      { team: home, statistics: [
        { name: 'passing', labels: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'SACKS', 'QBR', 'RTG'], athletes: [{ athlete: ath(30, 'Quarterback Q', 3, 'QB'), starter: true, stats: ['25/33', '312', '9.5', '3', '0', '1-5', '88', '125'] }] },
        { name: 'rushing', labels: ['CAR', 'YDS', 'AVG', 'TD', 'LONG'], athletes: [{ athlete: ath(31, 'Runner R', 22, 'RB'), starter: true, stats: ['18', '82', '4.6', '1', '20'] }] },
      ] },
      { team: away, statistics: [{ name: 'passing', labels: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'SACKS', 'QBR', 'RTG'], athletes: [{ athlete: ath(32, 'Opp QB', 7, 'QB'), starter: true, stats: ['20/35', '210', '6.0', '1', '2', '3-20', '40', '70'] }] }] },
    ];
    j.winprobability = plays.map((p, i) => ({ playId: p.id, homeWinPercentage: 0.45 + i * 0.02 }));
  }
  if (grp === 'soccer') {
    const [h, a] = [home, away];
    j.keyEvents = [
      { id: 'k1', type: { text: 'Kickoff' }, text: 'First half begins.', clock: { displayValue: "0'" }, scoringPlay: false },
      { id: 'k2', type: { text: 'Goal' }, text: 'Goal! Real Madrid 1, Barcelona 0. Test Striker scores.', clock: { displayValue: "49'" }, scoringPlay: true, team: { id: h.id }, participants: [{ athlete: { displayName: 'Test Striker' } }] },
      { id: 'k3', type: { text: 'Goal' }, text: 'Goal! Real Madrid 2, Barcelona 0. Test Striker scores again.', clock: { displayValue: "61'" }, scoringPlay: true, team: { id: h.id }, participants: [{ athlete: { displayName: 'Test Striker' } }] },
      { id: 'k4', type: { text: 'Red Card' }, text: 'Red card for Defender D.', clock: { displayValue: "70'" }, scoringPlay: false, redCard: true, team: { id: a.id }, participants: [{ athlete: { displayName: 'Defender D' } }] },
    ];
    j.rosters = [
      { homeAway: 'home', team: h, formation: '4-3-3', roster: [{ athlete: ath(40, 'Test Striker', 9, 'F'), starter: true, jersey: '9', position: { abbreviation: 'F' } }, { athlete: ath(41, 'Sub Guy', 14, 'M'), starter: false, jersey: '14', position: { abbreviation: 'M' } }] },
      { homeAway: 'away', team: a, formation: '4-4-2', roster: [{ athlete: ath(42, 'Defender D', 4, 'D'), starter: true, jersey: '4', position: { abbreviation: 'D' } }] },
    ];
    j.winprobability = undefined;
  }
  return j;
}

/* ----- rosters and player stats ----- */
function rp(id, name, jersey, pos, group) {
  return { id: String(id), displayName: name, shortName: name.split(' ')[0][0] + '. ' + name.split(' ').slice(-1)[0], jersey: String(jersey), position: { abbreviation: pos, displayName: pos }, age: 25 + (id % 8), displayHeight: "6' 2\"", displayWeight: '205 lbs', headshot: { href: `https://a.espncdn.com/i/headshots/x/players/full/${id}.png` }, experience: { years: id % 6 }, ...(id % 7 === 0 ? { injuries: [{ status: 'Questionable' }] } : {}), _g: group };
}
export function roster(lg, teamId) {
  const grp = lg === 'nfl' ? 'nfl' : lg === 'mlb' ? 'mlb' : 'flat';
  const idb = Number(teamId) * 100;
  if (grp === 'nfl') {
    return { team: { id: String(teamId) }, coach: [{ firstName: 'Test', lastName: 'Coach' }], athletes: [
      { position: 'offense', items: [rp(idb + 1, 'Josh Allen', 17, 'QB'), rp(idb + 2, 'James Cook', 4, 'RB'), rp(idb + 3, 'Khalil Shakir', 10, 'WR'), rp(idb + 4, 'Dalton Kincaid', 86, 'TE')] },
      { position: 'defense', items: [rp(idb + 5, 'Von Miller', 40, 'LB')] },
    ] };
  }
  if (grp === 'mlb') {
    return { team: { id: String(teamId) }, athletes: [
      { position: 'pitchers', items: [rp(idb + 1, 'Test Pitcher', 45, 'SP')] },
      { position: 'catchers', items: [rp(idb + 2, 'Test Catcher', 12, 'C')] },
      { position: 'outfielders', items: [rp(idb + 3, 'Test Outfielder', 24, 'RF')] },
    ] };
  }
  return { team: { id: String(teamId) }, athletes: [rp(idb + 1, 'Test Star', 4, 'G'), rp(idb + 2, 'Test Center', 21, 'C'), rp(idb + 3, 'Test Wing', 8, 'F'), rp(idb + 7, 'Test Bench', 30, 'G')] };
}
export function overview(lg, athleteId) {
  const labs = lg === 'nba' ? ['GP', 'MIN', 'PTS', 'REB', 'AST'] : lg === 'nhl' ? ['GP', 'G', 'A', 'PTS', 'SOG'] : lg === 'nfl' ? ['GP', 'CMP', 'ATT', 'YDS', 'TD'] : lg === 'mlb' ? ['GP', 'AB', 'H', 'HR', 'RBI'] : ['GP', 'G', 'A'];
  const vals = lg === 'nba' ? ['10', '32.1', '24.6', '5.2', '6.1'] : lg === 'nhl' ? ['10', '5', '6', '11', '31'] : lg === 'nfl' ? ['6', '150', '230', '1520', '12'] : lg === 'mlb' ? ['120', '450', '120', '25', '80'] : ['10', '4', '3'];
  return { statistics: { displayName: 'Season Stats', labels: labs, splits: [{ displayName: 'Regular Season', stats: vals }, { displayName: 'Career', stats: vals }] } };
}
