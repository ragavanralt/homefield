// Today's quests, deal and featured items. Read from data/live.json (refreshed by the daily and weekly
// automation). If that file is missing, broken or for another day, build the same content here instead,
// so quests always work, even offline.
import { dayKey, weekKey, isDayKey } from './period.js';
import { genDaily, genWeekly, validQuests } from './live-gen.js';
import { setDealOverride, itemById } from './avatar.js';

let file = null;
let loadedDay = '';
let inflight = null;

async function fetchFile() {
  try {
    if (typeof fetch !== 'function') return null;
    const r = await fetch('./data/live.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.v === 1 ? j : null;
  } catch (e) { return null; }
}

/** Today's content. Always returns something usable. */
export function currentLive(now = new Date()) {
  const day = dayKey(now), wk = weekKey(now);
  const fd = file && file.daily, fw = file && file.weekly;
  const daily = fd && fd.date === day && validQuests(fd.quests) ? fd : genDaily(day);
  const weekly = fw && fw.week === wk && validQuests(fw.quests) ? fw : genWeekly(wk);
  const d = daily.deal;
  setDealOverride(d && itemById(d.itemId) ? { date: daily.date, itemId: d.itemId, pct: Number.isFinite(d.pct) && d.pct >= 5 && d.pct <= 60 ? d.pct : 20 } : null);
  return { daily, weekly: { ...weekly, featured: (weekly.featured || []).filter((id) => itemById(id)) }, fromFile: daily === fd };
}

/** Load the file once per day (and again after the day changes). Safe to call from any page. */
export function ensureLive() {
  const day = dayKey();
  if (!inflight || loadedDay !== day) {
    loadedDay = day;
    inflight = fetchFile().then((f) => { file = f && isDayKey(f.daily && f.daily.date) ? f : null; return currentLive(); });
  }
  return inflight;
}
