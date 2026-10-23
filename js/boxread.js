// Reading one player's number out of a box score. Pure, so the cash out model and the card bars share it.
export const nk = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const numOf = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

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
        if (!row) continue;
        const v = numOf(row.stats[idx]);
        if (v != null) { total += v; found = true; }
      }
    }
  }
  return found ? total : null;
}

