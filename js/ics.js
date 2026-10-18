// Calendar export. Makes a standard .ics file that Google, Apple and Outlook calendars all open.
import { groupOf, leagueLabel, isSoccer } from './leagues.js';

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function fold(line) {
  const out = [];
  let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
  out.push(s);
  return out.join('\r\n');
}

export function gameTitle(g) {
  return isSoccer(g.league) ? `${g.home.short || g.home.name} vs ${g.away.short || g.away.name}` : `${g.away.short || g.away.name} at ${g.home.short || g.home.name}`;
}

export function gameWindow(g) {
  const start = new Date(g.date);
  const end = new Date(start.getTime() + groupOf(g.league).hours * 3600 * 1000);
  return { start, end };
}

function description(g) {
  return [leagueLabel(g.league), g.broadcast ? 'TV: ' + g.broadcast : '', g.series || '', 'Added from Homefield'].filter(Boolean).join(' · ');
}

export function buildICS(games, calName = 'Homefield') {
  const now = stamp(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Homefield//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(calName)];
  for (const g of games) {
    if (!g.date) continue;
    const { start, end } = gameWindow(g);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.league}-${g.id}@homefield`,
      'DTSTAMP:' + now,
      'DTSTART:' + stamp(start),
      'DTEND:' + stamp(end),
      'SUMMARY:' + esc(gameTitle(g)),
      'LOCATION:' + esc([g.venue, g.city].filter(Boolean).join(', ')),
      'DESCRIPTION:' + esc(description(g)),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleUrl(g) {
  const { start, end } = gameWindow(g);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: gameTitle(g),
    dates: `${stamp(start)}/${stamp(end)}`,
    location: [g.venue, g.city].filter(Boolean).join(', '),
    details: description(g),
  });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
