// Settles open bets by looking up each game's final score and box score.
import { getState, openBets, resolveBet, getBank, fillLegs, decidedWithOpenLegs } from './store.js';
import { getSummary } from './espn.js';
import { evalLeg, decideBet } from './bets.js';

let running = null;

export function settleAll() {
  if (running) return running;
  running = (async () => {
    const pending = openBets();
    const done = decidedWithOpenLegs(); // lost parlays whose other games finished later
    // one lookup per game, shared by every bet that uses it
    const need = new Map();
    for (const b of [...pending, ...done]) for (const l of b.legs) if (l.result === 'pending' && new Date(l.date).getTime() < Date.now()) need.set(l.gameKey, l);
    const data = new Map();
    const list = [...need.values()];
    for (let i = 0; i < list.length; i += 4) {
      const batch = list.slice(i, i + 4);
      const res = await Promise.allSettled(batch.map((l) => getSummary(l.league, l.gameId, 60000)));
      res.forEach((r, k) => { if (r.status === 'fulfilled' && r.value.game) data.set(batch[k].gameKey, r.value); });
    }
    let changed = 0;
    for (const b of pending) {
      const results = b.legs.map((l) => (l.result !== 'pending' ? l.result : data.has(l.gameKey) ? evalLeg(l, data.get(l.gameKey)) : 'pending'));
      const probe = { ...b, legs: b.legs.map((l, i) => ({ ...l, result: results[i] })) };
      const decision = decideBet(probe, getBank().streak);
      if (decision || results.some((r, i) => r !== b.legs[i].result)) { resolveBet(b.id, results, decision); if (decision) changed++; }
    }
    for (const b of done) fillLegs(b.id, b.legs.map((l) => (l.result !== 'pending' ? l.result : data.has(l.gameKey) ? evalLeg(l, data.get(l.gameKey)) : 'pending')));
    if (changed && typeof window !== 'undefined') window.dispatchEvent(new Event('homefield:settled'));
    return changed;
  })().finally(() => { running = null; });
  return running;
}
