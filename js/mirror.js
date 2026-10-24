// Copy someone else's bet onto your own slip. Shared by the crew feed and the crew profiles.
import { toggleLeg, setSlip, slipHas, getState } from './store.js';

/** put the not-yet-started legs of someone else's bet on your own slip, results cleared */
export function mirrorBet(b) {
  const now = Date.now();
  const legs = (b.legs || []).filter((l) => new Date(l.date).getTime() > now);
  let added = 0, dupes = 0, full = 0;
  legs.forEach((l) => { if (slipHas(l.key)) dupes++; else if (toggleLeg({ ...l, result: 'pending' }).ok) added++; else full++; });
  if (added) setSlip({ mode: b.mode === 'parlay' && (legs.length > 1 || getState().slip.legs.length > 1) ? 'parlay' : 'single' });
  return { added, dupes, full, started: (b.legs || []).length - legs.length };
}
export const mirrorMsg = (r) => (r.added ? `Added ${r.added} pick${r.added === 1 ? '' : 's'} to your slip${r.started ? ` (${r.started} already started)` : ''}${r.full ? ` · ${r.full} left off, your slip is full` : ''}` : r.full ? 'Your slip is full. Remove a pick first.' : r.dupes ? 'Those picks are already on your slip' : 'Those games already started');
