// "Ask the game": builds a compact text version of the game for the AI, and sends the question.
import { CONFIG } from './config.js';
import { LEAGUES, leagueLabel } from './leagues.js';
import { whenLabel } from './recap.js';

export function askContext(data, game) {
  const L = [];
  L.push(`${leagueLabel(game.league)} game: ${game.away.name} at ${game.home.name}. Venue: ${game.venue || 'unknown'}.`);
  L.push(`Status: ${game.state === 'pre' ? 'not started, starts ' + game.date : game.state === 'in' ? 'live, ' + game.detail : 'final'}. Score: ${game.away.abbr} ${game.away.score ?? 0}, ${game.home.abbr} ${game.home.score ?? 0}.`);
  if (game.series) L.push('Series: ' + game.series);
  if (game.home.record || game.away.record) L.push(`Records: ${game.away.abbr} ${game.away.record || '?'}, ${game.home.abbr} ${game.home.record || '?'}.`);
  for (const t of data.leaders || []) {
    const abbr = t.teamId === game.home.id ? game.home.abbr : t.teamId === game.away.id ? game.away.abbr : t.teamId;
    const line = t.cats.map((c) => `${c.name}: ${c.who} ${c.value}`).join('; ');
    if (line) L.push(`Leaders ${abbr}: ${line}`);
  }
  const plays = (data.plays || []).slice(-45);
  if (plays.length) {
    L.push('Recent plays, oldest first:');
    for (const p of plays) {
      const sc = p.homeScore != null && p.awayScore != null ? ` (${game.away.abbr} ${p.awayScore}, ${game.home.abbr} ${p.homeScore})` : '';
      L.push(`- ${whenLabel(p, game.league)} ${p.text}${sc}`);
    }
  }
  let out = L.join('\n');
  if (out.length > 7000) out = out.slice(0, 7000);
  return out;
}

export async function askGame(question, context) {
  const res = await fetch(CONFIG.askUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });
  if (!res.ok) {
    let msg = 'The question service answered with ' + res.status;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  const j = await res.json();
  return j.answer || 'No answer came back.';
}

export const SUGGESTIONS = {
  nhl: ['Why was that a penalty?', 'Who has been the best player so far?', 'How did this lead change?'],
  nba: ['Who is carrying their team tonight?', 'Why did they call a timeout?', 'How did this lead change?'],
  nfl: ['Which drive changed the game?', 'Who has been the best player so far?', 'Why did they go for it?'],
  mlb: ['Who is pitching well?', 'What was the key at bat?', 'How did the runs score?'],
  soccer: ['Who scored and how?', 'Was there a red card?', 'Who has been the best player so far?'],
};
export const suggestionsFor = (league) => SUGGESTIONS[LEAGUES[league]?.group] || SUGGESTIONS.nba;
