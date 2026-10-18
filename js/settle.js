// Settles pending Pick'em picks by looking up the final score of each game.
import { getState, update } from './store.js';
import { getSummary } from './espn.js';
import { settlePick } from './picks.js';

let running = null;

export function settleAll() {
  if (running) return running;
  running = (async () => {
    const pending = Object.values(getState().picks).filter((p) => p.status === 'pending' && new Date(p.date).getTime() < Date.now());
    let changed = 0;
    for (let i = 0; i < pending.length; i += 4) {
      const batch = pending.slice(i, i + 4);
      const results = await Promise.allSettled(batch.map((p) => getSummary(p.league, p.gameId, 60000)));
      results.forEach((r, k) => {
        if (r.status !== 'fulfilled' || !r.value.game) return;
        const next = settlePick(batch[k], r.value.game);
        if (next.status !== 'pending') { update((s) => { s.picks[next.key] = next; }); changed++; }
      });
    }
    return changed;
  })().finally(() => { running = null; });
  return running;
}
