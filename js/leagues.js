// League definitions and per-sport constants.

export const LEAGUES = {
  nhl: { label: 'NHL', sport: 'hockey', slug: 'nhl', group: 'nhl', tab: 'nhl' },
  nba: { label: 'NBA', sport: 'basketball', slug: 'nba', group: 'nba', tab: 'nba' },
  nfl: { label: 'NFL', sport: 'football', slug: 'nfl', group: 'nfl', tab: 'nfl' },
  mlb: { label: 'MLB', sport: 'baseball', slug: 'mlb', group: 'mlb', tab: 'mlb' },
  'uefa.champions': { label: 'Champions League', sport: 'soccer', slug: 'uefa.champions', group: 'soccer', tab: 'soccer' },
  'eng.1': { label: 'Premier League', sport: 'soccer', slug: 'eng.1', group: 'soccer', tab: 'soccer' },
  'esp.1': { label: 'La Liga', sport: 'soccer', slug: 'esp.1', group: 'soccer', tab: 'soccer' },
  'ger.1': { label: 'Bundesliga', sport: 'soccer', slug: 'ger.1', group: 'soccer', tab: 'soccer' },
  'ita.1': { label: 'Serie A', sport: 'soccer', slug: 'ita.1', group: 'soccer', tab: 'soccer' },
  'fra.1': { label: 'Ligue 1', sport: 'soccer', slug: 'fra.1', group: 'soccer', tab: 'soccer' },
  'uefa.europa': { label: 'Europa League', sport: 'soccer', slug: 'uefa.europa', group: 'soccer', tab: 'soccer' },
  'usa.1': { label: 'MLS', sport: 'soccer', slug: 'usa.1', group: 'soccer', tab: 'soccer' },
};

for (const [key, l] of Object.entries(LEAGUES)) l.key = key;

// Order shown in the app's tab bar.
export const TABS = [
  { id: 'nhl', label: 'NHL' },
  { id: 'nba', label: 'NBA' },
  { id: 'nfl', label: 'NFL' },
  { id: 'mlb', label: 'MLB' },
  { id: 'soccer', label: 'Soccer' },
];

export const SOCCER_KEYS = ['uefa.champions', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'uefa.europa', 'usa.1'];
export const MAJOR_KEYS = ['nhl', 'nba', 'nfl', 'mlb'];

// Soccer leagues whose games are always added to a soccer fan's Home screen.
export const SOCCER_EXTRAS = ['uefa.champions', 'uefa.europa'];

// Sport specific numbers used by the watch-worthy meter, win probability model and calendar export.
export const GROUP = {
  nhl: { periods: 3, periodSecs: 1200, sd: 2.35, closeScale: 1.1, hours: 3, label: 'period', texture: 'ice' },
  nba: { periods: 4, periodSecs: 720, sd: 12, closeScale: 7, hours: 2.5, label: 'quarter', texture: 'court' },
  nfl: { periods: 4, periodSecs: 900, sd: 13.5, closeScale: 6, hours: 3.5, label: 'quarter', texture: 'gridiron' },
  mlb: { periods: 9, periodSecs: 0, sd: 4.3, closeScale: 1.6, hours: 3.25, label: 'inning', texture: 'diamond' },
  soccer: { periods: 2, periodSecs: 2700, sd: 1.7, closeScale: 0.9, hours: 2, label: 'half', texture: 'pitch' },
};

export const groupOf = (league) => GROUP[LEAGUES[league]?.group] || GROUP.nba;
export const isSoccer = (league) => LEAGUES[league]?.group === 'soccer';
export const hasDraw = (league) => isSoccer(league);
export const leagueLabel = (league) => LEAGUES[league]?.label || league;
