// Reading one player's number out of a box score. Pure, so the cash out model and the card bars share it.
export const nk = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const numOf = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

/** A box score row that says the player never played: flagged did-not-play, or (once the game is over) zero minutes. */
export function unplayed(row, labels, final = false) {
  if (!row) return true;
  if (row.dnp) return true;
  if (!final) return false;
  const L = (labels || []).map((x) => String(x).toUpperCase());
  const mi = L.indexOf('MIN') >= 0 ? L.indexOf('MIN') : L.indexOf('TOI');
  if (mi < 0) return false;
  const v = row.stats && row.stats[mi];
  if (v == null || v === '' || v === '--') return true;
  return /^0*[:.]?0*$/.test(String(v).trim()); // 0, 00:00, 0:00
}
/** True when the feed lists this player as not playing (inactive, ruled out, coach's decision). Used to price a leg as a refund. */
export function playerOut(box, meta) {
  for (const tp of (box && box.players) || []) for (const grp of tp.groups || []) {
    const row = (grp.rows || []).find((r) => r.id === meta.playerId) || (grp.rows || []).find((r) => meta.name && nk(r.name) === nk(meta.name));
    if (row && row.dnp) return true;
  }
  return false;
}
/** A player's number for a prop card, or null if they have not played. Same reading the server uses to settle. */
export function playerNow(box, meta) {
  let total = 0, found = false;
  for (const spec of (meta && meta.box) || []) {
    const re = new RegExp(spec.g, 'i');
    for (const tp of (box && box.players) || []) {
      for (const grp of tp.groups || []) {
        if (!re.test(grp.name || '') && spec.g !== '.') continue;
        const L = (grp.labels || []).map((x) => String(x).toUpperCase());
        const idx = spec.l.map((x) => L.indexOf(x)).find((i) => i >= 0);
        if (idx == null || idx < 0) continue;
        const row = grp.rows.find((r) => r.id === meta.playerId) || grp.rows.find((r) => meta.name && nk(r.name) === nk(meta.name));
        if (!row || row.dnp) continue; // ruled out: nothing to count
        const v = numOf(row.stats[idx]);
        if (v != null) { total += v; found = true; }
      }
    }
  }
  return found ? total : null;
}

