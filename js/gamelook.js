// A look for the games that matter: the NBA Cup, European nights and every league's playoffs each get their own colours, pattern and tag.
// Original colours and patterns only. The class goes on the game card and the game page header (see the "look-" rules in styles.css).

const LOOKS = {
  cup: { label: 'NBA Cup' },
  ucl: { label: 'Champions League' },
  uel: { label: 'Europa League' },
  nba: { label: 'NBA Playoffs' },
  nfl: { label: 'NFL Playoffs' },
  nhl: { label: 'NHL Playoffs' },
  mlb: { label: 'MLB Postseason' },
  mls: { label: 'MLS Cup Playoffs' },
};

/** { id, label, sub, cls } for a game that deserves a look, or null. */
export function lookOf(g) {
  if (!g) return null;
  let id = null, sub = '';
  if (g.cup) { id = 'cup'; sub = g.cupRound || ''; }
  else if (g.league === 'uefa.champions') { id = 'ucl'; sub = g.note || ''; }
  else if (g.league === 'uefa.europa') { id = 'uel'; sub = g.note || ''; }
  else if (g.playoff && LOOKS[g.league] && !String(g.league).includes('.')) { id = g.league; sub = g.series || g.note || ''; }
  else if (g.playoff && g.league === 'usa.1') { id = 'mls'; sub = g.series || g.note || ''; }
  if (!id) return null;
  if (id === 'mlb' && /world series/i.test(`${g.seriesTitle} ${g.note} ${g.series}`)) return { id: 'ws', label: 'World Series', sub: g.series || '', cls: 'look-ws' };
  if (id === 'nfl' && /super bowl/i.test(`${g.note} ${g.seriesTitle} ${g.name}`)) return { id: 'sb', label: 'Super Bowl', sub: '', cls: 'look-sb' };
  return { id, label: LOOKS[id].label, sub: String(sub).replace(/^(NBA Cup|UEFA Champions League|UEFA Europa League)\s*[-–:]\s*/i, '').slice(0, 48), cls: 'look-' + id };
}
