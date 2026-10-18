// Days and weeks for quests and deals. A "day" is the device's calendar day.
// A quest "week" runs Friday to Thursday, so new weekly quests land on Friday.
const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 'YYYY-MM-DD' to a Date at noon local time (noon avoids clock-change edge cases). */
export const parseDay = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDay = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return dayKey(d); };
/** The Friday that starts the week this day falls in, as 'YYYY-MM-DD'. */
export function weekKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() - 5 + 7) % 7));
  return dayKey(x);
}
export const isDayKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Small seeded random generator, so the same date always gives the same picks. */
export function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
